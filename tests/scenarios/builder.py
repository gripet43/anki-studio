"""场景 collection 构造器。

Anki 26 的 collection 有两条限制，决定了这里必须分两段：

1. 打开状态下由 Rust 后端持有连接，raw SQL 通过 ``col.db`` 会经过
   protobuf 序列化，写调度字段这类操作既慢又容易踩类型限制；
2. 部分调度字段（``due`` / ``queue`` / ``type``）没有稳定的高层 API 能精确
   指定到「逾期 12 天的复习卡 + 已暂停」这种组合。

所以流程拆成两段：

* **第一段**：用官方 ``anki`` 包建牌组、建笔记、加卡片，正常关闭；
* **第二段**：关闭后用标准库 ``sqlite3`` 直接写调度字段与 revlog；
* **第三段**：重新用官方 API 打开，校验 Anki 认这份数据。

生成过程完全不读取真实 collection，只依赖 Anki.app 自带的 Python 包。
"""

from __future__ import annotations

import base64
import hashlib
import json
import random
import sqlite3
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

try:  # 直接运行脚本时走这个分支
    from guard import assert_real_collection_untouched, assert_sandboxed, ensure_dir
except ImportError:  # 作为 tests.scenarios 包导入时走这个分支
    from .guard import assert_real_collection_untouched, assert_sandboxed, ensure_dir

# ---------------------------------------------------------------------------
# Anki 运行时
# ---------------------------------------------------------------------------

try:  # 作为包导入时走相对路径，直接运行脚本时走同级模块
    from .paths import require_app_packages
except ImportError:
    from paths import require_app_packages


def load_anki():
    """把 Anki 自带的 Python 包挂到 sys.path 并返回 Collection 类。

    不做 pip 安装、不复制包体，避免污染系统环境与产生版本漂移。
    包目录按平台自动探测，可用环境变量 ``ANKI_APP_PACKAGES`` 覆盖。
    """
    packages = require_app_packages()
    if str(packages) not in sys.path:
        sys.path.insert(0, str(packages))
    from anki.collection import Collection  # noqa: PLC0415

    return Collection


# ---------------------------------------------------------------------------
# 场景描述
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class DeckSpec:
    """一个牌组。``name`` 用 ``A::B::C`` 表示嵌套层级。"""

    name: str
    weight: float = 1.0


@dataclass(frozen=True)
class ScenarioSpec:
    """一个「用户画像」的完整数据配方。

    所有随机性都由 ``seed`` 驱动，同一份配方永远生成同一个库。
    """

    key: str
    title: str
    description: str
    total_cards: int
    decks: tuple[DeckSpec, ...]
    #: 笔记类型占比，键必须是内置类型名
    notetype_mix: dict[str, float] = field(default_factory=lambda: {"Basic": 1.0})
    #: 状态占比，键取自 STATE_KEYS，剩余部分补 review
    state_mix: dict[str, float] = field(default_factory=dict)
    #: 每张卡的复习次数范围，0 表示不写 revlog
    revlog_per_card: tuple[int, int] = (0, 0)
    #: 复习卡间隔范围（天）
    interval_range: tuple[int, int] = (1, 120)
    #: 逾期天数范围（负值表示未来到期）
    overdue_range: tuple[int, int] = (-10, 60)
    #: 标签池，每次从中抽 0~3 个
    tag_pool: tuple[str, ...] = ()
    #: 需要真实写入 collection.media 的文件名（.png / .mp3）
    media_assets: tuple[str, ...] = ()
    #: 有多大比例的笔记会引用媒体
    media_ref_ratio: float = 0.0
    #: 有多大比例的 Basic 笔记生成图片遮挡结构（需 media_assets 里有图片）
    occlusion_ratio: float = 0.0
    #: 额外生成但不被任何笔记引用的媒体文件（验证 check_media 的清理能力）
    orphan_media: int = 0
    #: 脏数据注入标记，见 DIRTY_KINDS
    dirty: frozenset[str] = frozenset()
    seed: int = 20261111


#: 可注入的脏数据类型
DIRTY_KINDS = (
    "empty_cards",
    "duplicate_notes",
    "missing_media",
    "long_fields",
    "extreme_due",
    "extreme_ivl",
)


#: 卡片状态到 (type, queue) 的映射。
STATE_KEYS: dict[str, tuple[int, int]] = {
    "new": (0, 0),
    "learning": (1, 1),
    "review": (2, 2),
    "relearn": (3, 3),
    "suspended": (2, -1),
    "buried": (2, -2),
}


# ---------------------------------------------------------------------------
# 内容生成
# ---------------------------------------------------------------------------

_TOPICS = (
    "常识判断", "言语理解", "数量关系", "判断推理", "资料分析",
    "申论归纳", "申论对策", "公文格式", "政治理论", "法律常识",
)

_HTML_SNIPPETS = (
    "<b>{t}</b>",
    "<i>{t}</i>",
    "<span style=\"color:#3076C3\">{t}</span>",
    "{t}",
    "{t}<br>",
)

_LONG_TEXT = "这是一段用于验证超长字段换行与滚动的占位内容。" * 8

#: 1×1 透明 PNG。用于造真实可解码的图片素材，而不是随便写几个字节。
_MIN_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _make_occlusion_html(
    asset: str, rng: random.Random, n_rects: int, mode: str
) -> str:
    """复刻 ImageOcclusionEditorModal.buildImageOcclusionHtml 的真实结构。

    项目用的是「Basic 笔记 + .anki-io-wrap + span.anki-io-rect 包裹 cloze」这套
    自定义方案，前端 mathRenderer 再把它解析成静态遮罩。这里必须逐字对齐，
    否则测到的是另一条渲染路径。
    """
    rects = []
    for i in range(n_rects):
        left = rng.randint(5, 65)
        top = rng.randint(5, 65)
        width = rng.randint(12, 28)
        height = rng.randint(10, 22)
        label = f"遮挡区域 {i + 1}"
        rects.append(
            f'<span class="anki-io-rect" data-io-rect="{i + 1}" '
            f'style="position:absolute;left:{left}%;top:{top}%;width:{width}%;height:{height}%;">'
            f"{{{{c{i + 1}::{label}}}}}</span>"
        )
    return (
        f'<div class="anki-io-wrap" data-io-mode="{mode}" '
        f'style="position:relative;display:inline-block;max-width:100%;line-height:0;'
        f'border-radius:12px;overflow:hidden;">'
        f'<img src="{asset}" data-anki-media="{asset}" '
        f'style="display:block;max-width:100%;height:auto;margin:0;border-radius:12px;" />'
        f'{"".join(rects)}</div>'
    )


def _make_io_svg(rng: random.Random, n_rects: int) -> str:
    """生成 Anki 原生 Image Occlusion 的 SVG 覆盖层。

    真实格式是 ``{{c1::<svg>…<rect/>…</svg>}}``：Anki 渲染时把 SVG 整体转义进
    ``<span class="cloze" data-cloze="…">``，再由 ``anki.imageOcclusion.setup()``
    读出来画到 canvas 上。
    """
    rects = "".join(
        f'<rect x="{rng.randint(5, 70)}" y="{rng.randint(5, 70)}" '
        f'width="{rng.randint(10, 25)}" height="{rng.randint(8, 20)}" '
        f'fill="rgba(0,0,0,0.5)" />'
        for _ in range(n_rects)
    )
    return (
        '<svg width="100%" height="100%" viewBox="0 0 100 100" '
        f'preserveAspectRatio="none">{rects}</svg>'
    )


def _make_fields(
    notetype: str,
    idx: int,
    rng: random.Random,
    media_pool: tuple[str, ...] = (),
    media_ratio: float = 0.0,
    occlusion_ratio: float = 0.0,
) -> dict[str, str]:
    """按索引与笔记类型造一条笔记的字段内容。

    刻意混入 HTML、LaTeX、emoji 与超长文本，让渲染路径被真实覆盖，
    而不是清一色的纯文本。配置了媒体时按比例挂载图片或音频引用。
    """
    topic = _TOPICS[idx % len(_TOPICS)]
    n = idx + 1
    images = [m for m in media_pool if m.endswith((".png", ".jpg", ".jpeg"))]

    # Anki 原生 Image Occlusion：字段名与顺序由内置类型固定
    if notetype == "Image Occlusion":
        asset = rng.choice(images) if images else "io_01.png"
        # 一部分笔记做多 cloze（c1 / c2 各生成一张卡），用来覆盖 cloze_ord 分支：
        # 不同卡必须只隐藏自己那一片区域，而不是全部。
        n_clozes = rng.randint(1, 2)
        parts = [
            f"{{{{c{k + 1}::{_make_io_svg(rng, rng.randint(1, 2))}}}}}"
            for k in range(n_clozes)
        ]
        return {
            "Occlusion": "".join(parts),
            "Image": f'<img src="{asset}">',
            "Header": f"遮挡练习 {n}",
            "Back Extra": "",
            "Comments": "",
        }

    if notetype.startswith("Cloze"):
        body = rng.choice(
            (
                f"{topic}第 {n} 题：{{{{c1::正确选项}}}} 是本题的关键。",
                f"{{{{c1::第 {n} 条}}}} 规定了公文用纸幅面尺寸。",
                f"{topic}：{{{{c1::依法行政}}}}，{{{{c2::程序正当}}}}，第 {n} 组。",
            )
        )
        return {
            "Text": f"<div>{body}</div>",
            "Back Extra": f"解析见 {topic} 讲义第 {n} 页。",
        }

    body = rng.choice(_HTML_SNIPPETS).format(t=topic)
    front_variants = (
        f"{body} 第 {n} 题：下列关于{topic}的说法，正确的是？",
        f"<div>{topic} · 第 {n} 题</div><div>请选出错误项。</div>",
        f"{body} 第 {n} 题：$x_{{{n}}} = {n % 7}$ 的取值是？",
        f"{body} 第 {n} 题：📌 记忆点 {n}",
    )
    back_variants = (
        f"答案：第 {n} 项。考察 {topic} 的基础概念。",
        f"<b>答案</b>：{n}；<span style=\"color:#8E8E93\">易错点：混淆项</span>",
        f"答案：{n}。\n{_LONG_TEXT}" if idx % 37 == 0 else f"答案：{n}。",
    )
    fields = {"Front": rng.choice(front_variants), "Back": rng.choice(back_variants)}

    if occlusion_ratio > 0 and images and rng.random() < occlusion_ratio:
        return {
            "Front": _make_occlusion_html(
                rng.choice(images), rng, rng.randint(1, 3), rng.choice(("hide-all", "hide-one"))
            ),
            "Back": f"答案：第 {n} 组遮挡区域已揭示。",
        }

    if media_pool and rng.random() < media_ratio:
        asset = rng.choice(media_pool)
        if asset.endswith((".png", ".jpg", ".jpeg")):
            fields["Back"] += f'<img src="{asset}">'
        else:
            fields["Front"] += f"[sound:{asset}]"
    return fields


# ---------------------------------------------------------------------------
# 第一段：官方 API 建结构
# ---------------------------------------------------------------------------


def _pick_deck(rng: random.Random, decks: Iterable[DeckSpec]) -> str:
    pool = list(decks)
    weights = [d.weight for d in pool]
    return rng.choices(pool, weights=weights, k=1)[0].name


def _create_structure(spec: ScenarioSpec, coll_path: Path) -> dict[str, int]:
    """建牌组与笔记，返回 {牌组名: 卡片数} 之外的统计信息。"""
    Collection = load_anki()
    assert_real_collection_untouched(coll_path)
    col = Collection(str(coll_path))

    try:
        deck_ids: dict[str, int] = {}
        for deck in spec.decks:
            deck_ids[deck.name] = col.decks.add_normal_deck_with_name(deck.name).id

        # 只取实际用到的内置笔记类型，避免每个库都拖着 6 个类型
        wanted = list(spec.notetype_mix)
        notetypes = {name: col.models.by_name(name) for name in wanted}
        missing = [name for name, nt in notetypes.items() if nt is None]
        if missing:
            raise RuntimeError(f"Anki 内置笔记类型缺失：{missing}")

        rng = random.Random(spec.seed)
        type_names = list(spec.notetype_mix)
        type_weights = [spec.notetype_mix[n] for n in type_names]

        # Cloze 一条笔记可能生成多张卡，所以按「实际卡片数」收敛，而不是笔记数。
        # 每 32 条查一次库，避免每条都查的开销。
        added_notes = 0
        idx = 0
        while idx < spec.total_cards * 3:
            nt_name = rng.choices(type_names, weights=type_weights, k=1)[0]
            note = col.new_note(notetypes[nt_name])
            for key, value in _make_fields(
                nt_name,
                idx,
                rng,
                spec.media_assets,
                spec.media_ref_ratio,
                spec.occlusion_ratio,
            ).items():
                note[key] = value
            if spec.tag_pool and idx % 3 != 1:
                picked = rng.sample(spec.tag_pool, k=min(len(spec.tag_pool), rng.randint(1, 3)))
                note.tags = picked
            col.add_note(note, deck_ids[_pick_deck(rng, spec.decks)])
            added_notes += 1
            idx += 1
            if added_notes % 32 == 0 and col.card_count() >= spec.total_cards:
                break

        # 媒体文件必须真实落盘，否则维护工具与图片遮挡渲染都测不到
        if spec.media_assets or spec.orphan_media:
            png = _MIN_PNG
            assets = list(spec.media_assets)
            assets.extend(f"orphan_{i}.png" for i in range(spec.orphan_media))
            for asset in assets:
                payload = png if asset.endswith((".png", ".jpg", ".jpeg")) else b""
                col.media.write_data(asset, payload)

        return {"decks": len(deck_ids), "notes": added_notes, "cards": col.card_count()}
    finally:
        col.close()


# ---------------------------------------------------------------------------
# 第二段：sqlite3 写调度
# ---------------------------------------------------------------------------


def _assign_states(spec: ScenarioSpec, db_path: Path) -> dict[str, Any]:
    rng = random.Random(spec.seed + 1)
    now_ms = int(time.time() * 1000)
    now_s = int(time.time())

    conn = sqlite3.connect(db_path)
    try:
        cids = [row[0] for row in conn.execute("select id from cards order by id")]
        if spec.total_cards and len(cids) < spec.total_cards * 0.8:
            raise RuntimeError(
                f"卡片数明显不足：目标 {spec.total_cards}，实际 {len(cids)}，生成逻辑有问题"
            )

        # 关键：Anki 的 review 卡 ``due`` 是「距 collection 创建日的天数」，
        # 不是 Unix 天数。用 Unix 天数会得到两万多的值，等价于几万年后到期，
        # 于是「积压场景」里一张到期卡都没有，减负与低能量全部空跑。
        crt_row = conn.execute("select crt from col").fetchone()
        crt = int(crt_row[0]) if crt_row and crt_row[0] else now_s
        today = max(0, (now_s - crt) // 86_400)

        # 展开状态配额：先按比例取整，余数补给 review
        states: list[str] = []
        for key, ratio in spec.state_mix.items():
            states.extend([key] * int(round(len(cids) * ratio)))
        states = states[: len(cids)]
        states.extend(["review"] * (len(cids) - len(states)))
        rng.shuffle(states)

        queue_dist: dict[str, int] = {}
        for cid, state in zip(cids, states):
            ctype, queue = STATE_KEYS[state]
            queue_dist[state] = queue_dist.get(state, 0) + 1

            if state == "new":
                due = rng.randint(1, max(1, len(cids)))
                ivl, factor, reps, lapses = 0, 0, 0, 0
            elif state == "learning":
                due = now_ms + rng.randint(60_000, 3_600_000)
                ivl, factor, reps, lapses = rng.randint(0, 1), 0, rng.randint(1, 3), 0
            else:
                ivl = rng.randint(*spec.interval_range)
                factor = rng.choice((1300, 1500, 2300, 2500, 2600, 2800))
                reps = rng.randint(1, 12)
                lapses = rng.randint(0, min(4, reps))
                if state == "relearn":
                    due = now_ms + rng.randint(600_000, 7_200_000)
                else:
                    due = today + rng.randint(*spec.overdue_range)

            conn.execute(
                "update cards set type=?, queue=?, due=?, ivl=?, factor=?, reps=?, lapses=? where id=?",
                (ctype, queue, due, ivl, factor, reps, lapses, cid),
            )

        # revlog：按卡片状态生成合理的复习历史
        revlog_count = 0
        lo, hi = spec.revlog_per_card
        if hi > 0:
            for cid in cids:
                for _ in range(rng.randint(lo, hi)):
                    ts = now_ms - rng.randint(0, 180) * 86_400_000 - rng.randint(0, 86_399_000)
                    ease = rng.choices((1, 2, 3, 4), weights=(15, 10, 60, 15), k=1)[0]
                    ivl = rng.randint(1, 200)
                    conn.execute(
                        "insert into revlog (id, cid, usn, ease, ivl, lastIvl, factor, time, type)"
                        " values (?,?,?,?,?,?,?,?,?)",
                        (ts, cid, -1, ease, ivl, max(1, ivl // 2), 2500, rng.randint(3000, 20000),
                         rng.choice((0, 1, 1, 1, 2))),
                    )
                    revlog_count += 1

        conn.commit()
        return {"queue_dist": queue_dist, "revlog": revlog_count}
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 第三段：注入脏数据
# ---------------------------------------------------------------------------


def _inject_dirty(spec: ScenarioSpec, db_path: Path) -> dict[str, int]:
    """按 dirty 标记写入脏数据，返回每类注入的条数。

    全部在笔记层面做：``flds`` 用 ``\\x1f`` 分隔，**不改变字段数量**，
    否则 Anki 解析时会越界。卡片数与调度不受影响。
    """
    if not spec.dirty:
        return {}
    unknown = set(spec.dirty) - set(DIRTY_KINDS)
    if unknown:
        raise ValueError(f"未知脏数据类型：{sorted(unknown)}（可选：{', '.join(DIRTY_KINDS)}）")

    conn = sqlite3.connect(db_path)
    injected: dict[str, int] = {}
    try:
        rows = conn.execute("select id, flds from notes order by id").fetchall()
        if not rows:
            return {}
        n = len(rows)
        chunk = max(1, n // 40)

        if "empty_cards" in spec.dirty:
            target = rows[:chunk]
            for nid, flds in target:
                blank = "\x1f".join([""] * (flds.count("\x1f") + 1))
                conn.execute("update notes set flds=? where id=?", (blank, nid))
            injected["empty_cards"] = len(target)

        if "duplicate_notes" in spec.dirty:
            src = rows[0][1]
            start = max(1, n // 2)
            target = rows[start:start + chunk]
            for nid, _ in target:
                conn.execute("update notes set flds=? where id=?", (src, nid))
            injected["duplicate_notes"] = len(target)

        if "missing_media" in spec.dirty:
            start = max(1, n // 3)
            target = rows[start:start + chunk]
            # 每条用不同文件名：check_media 按文件名去重，共用同一个名会让断言失去区分度
            for i, (nid, flds) in enumerate(target):
                conn.execute(
                    "update notes set flds=? where id=?",
                    (flds + f'<img src="missing_{i}.png">', nid),
                )
            injected["missing_media"] = len(target)

        if "long_fields" in spec.dirty:
            start = max(1, 2 * n // 3)
            target = rows[start:start + max(1, n // 80)]
            for nid, flds in target:
                parts = flds.split("\x1f")
                parts[0] = "超长字段用于验证换行与滚动。" * 400
                conn.execute("update notes set flds=? where id=?", ("\x1f".join(parts), nid))
            injected["long_fields"] = len(target)

        if "extreme_due" in spec.dirty:
            # 负数 due、极大 due。统计口径里 due 会参与 overdue/dailyLoad 计算，
            # 这里专门制造溢出与除零的机会。
            values = (-99999, -1, 0, 1, 999999999)
            target = rows[: max(1, n // 20)]
            touched = 0
            for i, (nid, _) in enumerate(target):
                cid = conn.execute("select id from cards where nid=?", (nid,)).fetchone()
                if cid:
                    conn.execute("update cards set due=? where id=?", (values[i % len(values)], cid[0]))
                    touched += 1
            injected["extreme_due"] = touched

        if "extreme_ivl" in spec.dirty:
            # ivl 为 0 会让 Σ(1/ivl) 类计算直接除零；极大值则压测格式化。
            values = (0, -1, 1, 36500, 2147483647)
            start = max(1, n // 20)
            target = rows[start:start + max(1, n // 20)]
            touched = 0
            for i, (nid, _) in enumerate(target):
                cid = conn.execute("select id from cards where nid=?", (nid,)).fetchone()
                if cid:
                    conn.execute("update cards set ivl=? where id=?", (values[i % len(values)], cid[0]))
                    touched += 1
            injected["extreme_ivl"] = touched

        conn.commit()
        return injected
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 第四段：官方 API 复验
# ---------------------------------------------------------------------------


def _verify(coll_path: Path, expected_cards: int) -> dict[str, Any]:
    Collection = load_anki()
    col = Collection(str(coll_path))
    try:
        cards = col.card_count()
        if cards != expected_cards:
            raise RuntimeError(f"复验失败：Anki 只认到 {cards} 张卡，期望 {expected_cards}")
        queues = dict(col.db.all("select queue, count(*) from cards group by queue"))
        revlog = col.db.scalar("select count(*) from revlog")
        return {"anki_card_count": cards, "anki_queue_dist": queues, "anki_revlog": revlog}
    finally:
        col.close()


# ---------------------------------------------------------------------------
# 对外入口
# ---------------------------------------------------------------------------


def build(spec: ScenarioSpec, out_path: Path) -> dict[str, Any]:
    """按配方生成一个场景 collection，返回 manifest。"""
    out_path = assert_sandboxed(out_path, purpose="生成场景")
    ensure_dir(out_path.parent)
    for suffix in ("", "-wal", "-shm", ".log"):
        stale = Path(str(out_path) + suffix)
        if stale.exists():
            stale.unlink()
    media_dir = out_path.with_suffix(".media")
    if media_dir.exists():
        for item in media_dir.iterdir():
            item.unlink()
    ensure_dir(media_dir)

    structure = _create_structure(spec, out_path)
    actual_cards = structure["cards"]
    scheduling = _assign_states(spec, out_path)
    dirty = _inject_dirty(spec, out_path)
    verification = _verify(out_path, actual_cards)

    digest = hashlib.sha256(out_path.read_bytes()).hexdigest()[:16]
    manifest = {
        "key": spec.key,
        "title": spec.title,
        "description": spec.description,
        "seed": spec.seed,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "target_cards": spec.total_cards,
        "cards": actual_cards,
        "decks": [d.name for d in spec.decks],
        "notetypes": list(spec.notetype_mix),
        "structure": structure,
        "scheduling": scheduling,
        "dirty": dirty,
        "occlusion_ratio": spec.occlusion_ratio,
        "media": list(spec.media_assets)
        + [f"orphan_{i}.png" for i in range(spec.orphan_media)],
        "verification": verification,
        "sha256_16": digest,
    }
    manifest_path = assert_sandboxed(out_path.with_suffix(".manifest.json"), purpose="写 manifest")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest
