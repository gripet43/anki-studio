#!/usr/bin/env python3
"""对场景库跑真实业务路径的冒烟回归。

场景库如果只是「导入进去看一眼」，那它只是素材。这里把它变成回归测试：
不启动 GUI，直接把 ``BridgeRouter`` 接到场景 collection 上，调用前端真正会调的
那些 action，断言「不崩、结构完整、数值和库里的实际情况对得上」。

    python3 smoke.py              # 跑全部场景
    python3 smoke.py exam empty   # 只跑指定场景
    python3 smoke.py --list       # 列出会跑哪些检查

每次都在 ``state/smoke/`` 里操作副本，跑完即删，场景库本身永远不变。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import time
import sys
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

THIS = Path(__file__).resolve().parent
DEV_ROOT = THIS.parents[1]
sys.path.insert(0, str(THIS))
sys.path.insert(0, str(DEV_ROOT))

from builder import load_anki  # noqa: E402
from guard import assert_sandboxed, ensure_dir, lib_dir, state_dir  # noqa: E402


@dataclass
class CheckResult:
    scenario: str
    action: str
    ok: bool
    detail: str = ""


class FakeMW:
    """最小 mw 替身：只实现服务层会碰到的 UI 副作用。"""

    def reset(self, *args, **kwargs):
        return None

    def on_sync_button_clicked(self):
        return None


class ScenarioRunner:
    """一个场景的测试会话。"""

    def __init__(self, key: str, verbose: bool = False):
        self.key = key
        self.verbose = verbose
        self.results: list[CheckResult] = []
        self.warnings: list[tuple[str, str]] = []
        self.col = None
        self.router = None
        self.cfg: dict[str, Any] = {}

    def warn(self, label: str, message: str) -> None:
        """记录「已知缺陷」而非失败。

        这类问题不是测试写错了，而是产品当前确实不支持。用 warning 而不是 FAIL，
        是为了让门禁保持绿的同事，每次都能看到它还欠着。
        """
        self.warnings.append((label, message))

    # ---------------------------------------------------------------- 生命周期
    def __enter__(self) -> "ScenarioRunner":
        src = lib_dir() / f"{self.key}.anki2"
        if not src.exists():
            raise FileNotFoundError(f"场景不存在：{src}")
        work = ensure_dir(state_dir() / "smoke")
        self.copy = assert_sandboxed(work / f"{self.key}.anki2", purpose="复制场景副本")
        shutil.copy2(src, self.copy)
        for suffix in ("-wal", "-shm"):
            stale = Path(str(self.copy) + suffix)
            if stale.exists():
                stale.unlink()

        # 媒体目录必须一起复制，否则 check_media 会误报「引用存在但文件缺失」
        src_media = lib_dir() / f"{self.key}.media"
        self.media_copy = work / f"{self.key}.media"
        if self.media_copy.exists():
            shutil.rmtree(self.media_copy)
        if src_media.is_dir():
            shutil.copytree(src_media, self.media_copy)
        else:
            ensure_dir(self.media_copy)

        Collection = load_anki()
        self.col = Collection(str(self.copy))

        from bridge.router import BridgeRouter  # noqa: PLC0415

        self.router = BridgeRouter(
            col_getter=lambda: self.col,
            mw_getter=lambda: FakeMW(),
            config_getter=lambda: self.cfg,
            config_writer=self._write_config,
        )
        return self

    def _write_config(self, cfg: dict) -> dict:
        """按产品语义合并写入。

        `__init__.py` 的 `write_config` 是 `{**old, **new}` 合并；这里原先用整体
        替换，会让 `rescue_backlog` 只写 receipt 时把 vacation_state 等键清掉，
        测出来的行为与真实环境不符。
        """
        merged = {**self.cfg, **(cfg or {})}
        self.cfg.clear()
        self.cfg.update(merged)
        return self.cfg

    def __exit__(self, *exc) -> None:
        if self.col is not None:
            try:
                self.col.close()
            finally:
                self.col = None
        for path in (self.copy, Path(str(self.copy) + "-wal"), Path(str(self.copy) + "-shm")):
            if path.exists():
                try:
                    path.unlink()
                except OSError:
                    pass
        if getattr(self, "media_copy", None) and self.media_copy.exists():
            shutil.rmtree(self.media_copy, ignore_errors=True)

    # ---------------------------------------------------------------- 工具
    def call(self, action: str, data: dict | None = None) -> dict[str, Any]:
        payload = json.dumps({"action": action, "data": data or {}})
        raw = self.router.handle_pycmd("modern_anki:" + payload)
        if raw is None:
            raise AssertionError(f"{action} 返回 None，前缀未被识别")
        return json.loads(raw)

    def check(
        self,
        action: str,
        fn: Callable[[dict], None],
        data: dict | None = None,
        label: str | None = None,
    ) -> None:
        """调用一个 action 并执行断言。异常即失败，不会中断其余检查。

        ``label`` 用于同一 action 的多种用法（如 run_maintenance 的 toolType）。
        """
        try:
            payload = self.call(action, data)
            fn(payload)
            self.results.append(CheckResult(self.key, label or action, True))
        except Exception as exc:  # noqa: BLE001
            detail = f"{type(exc).__name__}: {exc}"
            if self.verbose:
                detail += "\n" + traceback.format_exc(limit=2)
            self.results.append(CheckResult(self.key, label or action, False, detail))

    # ---------------------------------------------------------------- 断言辅助
    def expect_success(self, payload: dict) -> dict:
        if payload.get("status") != "success":
            raise AssertionError(f"status={payload.get('status')} message={payload.get('message')}")
        data = payload.get("data") or {}
        self.assert_json_safe(data)
        return data

    @staticmethod
    def assert_json_safe(data: Any) -> None:
        """返回值里不能出现 Infinity / NaN。

        Python 的 json 模块会把它们写成非法 JSON 字面量，前端 JSON.parse 会直接抛错。
        极端调度值（ivl=0、due=1e9）最容易制造这类数值。
        """
        text = json.dumps(data, ensure_ascii=False)
        for token in ("Infinity", "NaN"):
            if token in text:
                raise AssertionError(f"返回值含非法数值 {token}，前端无法解析")

    def sqlite_count(self, sql: str) -> int:
        # Windows 下 Anki 26 以 WAL + 独占句柄锁持有 collection，同进程二次 sqlite3.connect
        # 会直接触发 OperationalError: database is locked；统一优先走已打开的 col.db 连接。
        if self.col is not None and hasattr(self.col, "db") and self.col.db is not None:
            val = self.col.db.scalar(sql)
            return int(val) if val is not None else 0
        conn = sqlite3.connect(f"file:{self.copy}?mode=ro", uri=True)
        try:
            row = conn.execute(sql).fetchone()
            return int(row[0]) if row and row[0] is not None else 0
        finally:
            conn.close()

    def _sqlite_rows(self, sql: str) -> list[tuple]:
        if self.col is not None and hasattr(self.col, "db") and self.col.db is not None:
            return [tuple(r) for r in self.col.db.all(sql)]
        conn = sqlite3.connect(f"file:{self.copy}?mode=ro", uri=True)
        try:
            return conn.execute(sql).fetchall()
        finally:
            conn.close()

    def manifest(self) -> dict[str, Any]:
        path = lib_dir() / f"{self.key}.manifest.json"
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# 各场景共用的检查
# ---------------------------------------------------------------------------


def run_checks(runner: ScenarioRunner) -> None:
    cards = runner.sqlite_count("select count(*) from cards")

    def dashboard(payload: dict) -> None:
        data = runner.expect_success(payload)
        for key in ("decks", "heatmap", "todayStats", "streak", "vacation", "preferences"):
            if key not in data:
                raise KeyError(f"dashboard 缺字段 {key}")
        if not isinstance(data["decks"], list):
            raise TypeError("decks 不是列表")
        # 牌组数与库里的实际分布一致（默认牌组可能没有卡，允许 <=）
        distinct = runner.sqlite_count("select count(distinct did) from cards")
        if distinct and len(data["decks"]) < distinct:
            raise AssertionError(f"dashboard 牌组数 {len(data['decks'])} 少于实际 {distinct}")

    runner.check("get_dashboard", dashboard)

    def statistics(payload: dict) -> None:
        data = runner.expect_success(payload)
        expected = {"maturityBreakdown", "forecast30d", "retentionCurve",
                    "hourlyDistribution", "answerButtons", "trueRetention", "dailyLoad"}
        missing = expected - set(data)
        if missing:
            raise KeyError(f"统计缺块：{sorted(missing)}")
        tr = data["trueRetention"]
        if isinstance(tr, dict):
            for scope in ("young", "mature", "all"):
                block = tr.get(scope)
                if isinstance(block, dict):
                    for period in ("last30", "allTime"):
                        val = block.get(period)
                        if val is not None and not (0.0 <= float(val) <= 1.0):
                            raise AssertionError(f"留存率越界 {scope}.{period}={val}")

    runner.check("get_statistics", statistics)

    def search_all(payload: dict) -> None:
        data = runner.expect_success(payload)
        total = data.get("total")
        if total is None:
            raise KeyError("search 结果缺 total")
        if total != cards:
            raise AssertionError(f"全库搜索返回 {total}，实际 {cards}")

    runner.check("search_cards", search_all, {"query": ""})

    def search_new(payload: dict) -> None:
        data = runner.expect_success(payload)
        new_count = runner.sqlite_count("select count(*) from cards where queue=0 and type=0")
        # 只验证不报错、数量不超过全库
        if data.get("total", 0) > cards:
            raise AssertionError("筛选结果超过全库")

    runner.check("search_cards", search_new, {"query": "", "filter": "new"})

    def vacation(payload: dict) -> None:
        data = runner.expect_success(payload)
        if not isinstance(data, dict):
            raise TypeError("vacation 状态不是对象")

    runner.check("get_vacation_status", vacation)

    def preferences(payload: dict) -> None:
        data = runner.expect_success(payload)
        prefs = data.get("preferences") if isinstance(data.get("preferences"), dict) else data
        for key in ("autoPlayFrontAudio", "autoPlayBackAudio"):
            if not isinstance(prefs.get(key), bool):
                raise AssertionError(f"preferences.{key} 应为 bool，实际 {prefs.get(key)!r}")
        if prefs.get("reviewStageWidth") not in ("standard", "auto", "wide", "full"):
            raise AssertionError(f"reviewStageWidth 非法：{prefs.get('reviewStageWidth')!r}")
        if int(prefs.get("reviewContentScale") or 0) not in (90, 100, 115, 130, 150):
            raise AssertionError(f"reviewContentScale 非法：{prefs.get('reviewContentScale')!r}")

    runner.check("get_preferences", preferences)

    audio_rows = runner._sqlite_rows(
        "select c.id from cards c join notes n on c.nid=n.id "
        "where n.flds like '%[sound:%' order by c.id limit 1"
    )
    if audio_rows:
        audio_cid = audio_rows[0][0]

        def audio_side_split(payload: dict) -> None:
            data = runner.expect_success(payload)
            cards_out = data.get("cards") or []
            if not cards_out:
                raise AssertionError("音频卡片 get_review_queue 返回空列表")
            item = cards_out[0]
            front_aud = item.get("frontAudioFiles")
            back_aud = item.get("backAudioFiles")
            if not isinstance(front_aud, list) or not isinstance(back_aud, list):
                raise AssertionError("缺少 frontAudioFiles / backAudioFiles 列表")
            if not front_aud:
                raise AssertionError("正面 [sound:...] 音频未提取到 frontAudioFiles")
            dup = [f for f in back_aud if f in front_aud]
            if dup:
                raise AssertionError(f"backAudioFiles 重复携带了正面音频：{dup}")

        runner.check(
            "get_review_queue",
            audio_side_split,
            {"cardIds": [str(audio_cid)]},
            label="media:audio-side-split",
        )


def run_deck_options(runner: ScenarioRunner) -> None:
    """牌组选项：需要先从 dashboard 拿一个 did。"""
    try:
        dash = runner.expect_success(runner.call("get_dashboard"))
        decks = dash.get("decks") or []
        if not decks:
            return
        did = decks[0].get("id")
        if not did:
            return
    except Exception as exc:  # noqa: BLE001
        runner.results.append(CheckResult(runner.key, "get_deck_options", False, f"取 did 失败：{exc}"))
        return

    def options(payload: dict) -> None:
        data = runner.expect_success(payload)
        # 返回可能是扁平的，也可能包一层 options，两种都接受
        block = data.get("options") if isinstance(data.get("options"), dict) else data
        for key in ("newPerDay", "revPerDay", "desiredRetention"):
            if key not in block:
                raise KeyError(f"牌组选项缺 {key}（实际键：{sorted(block)[:10]}）")

    runner.check("get_deck_options", options, {"deckId": did})


def run_maintenance_checks(runner: ScenarioRunner) -> None:
    """脏数据场景专用：维护工具必须真的「检出」问题，而不是报成功。

    这是 dirty 场景存在的唯一目的——如果一个工具对空卡返回 0，那它比不检查更危险。
    """
    dirty = runner.manifest().get("dirty") or {}
    if not dirty:
        return

    def check_db(payload: dict) -> None:
        data = runner.expect_success(payload)
        if data.get("integrityResult") != "ok":
            raise AssertionError(f"完整性检查未通过：{data.get('integrityResult')}")

    runner.check("run_maintenance", check_db, {"toolType": "check_db"}, label="maintenance:check_db")

    if "empty_cards" in dirty:
        expected = int(dirty["empty_cards"])

        def empty_cards(payload: dict) -> None:
            data = runner.expect_success(payload)
            found = int(data.get("emptyCount") or 0)
            if found < expected:
                raise AssertionError(f"空卡只检出 {found}，应至少 {expected}")

        runner.check("run_maintenance", empty_cards,
                     {"toolType": "check_empty_cards"}, label="maintenance:check_empty_cards")

    if "missing_media" in dirty:
        expected = int(dirty["missing_media"])

        def media(payload: dict) -> None:
            data = runner.expect_success(payload)
            missing = int(data.get("missingCount") or 0)
            if missing < expected:
                raise AssertionError(f"缺失媒体只检出 {missing}，应至少 {expected}")

        runner.check("run_maintenance", media, {"toolType": "check_media"}, label="maintenance:check_media")

    if runner.manifest().get("media"):
        def unused(payload: dict) -> None:
            data = runner.expect_success(payload)
            total = int(data.get("totalFiles") or 0)
            if total <= 0:
                raise AssertionError("媒体目录应含素材文件，却报告 0 个")

        runner.check("run_maintenance", unused, {"toolType": "check_media"}, label="maintenance:check_media_files")


def run_write_checks(runner: ScenarioRunner) -> None:
    """写路径回归：旗标、暂停、快速加卡。

    只读回归再全，也发现不了「写下去没生效」这类问题。全部在副本上做，
    会话结束就删掉，场景库本身不受影响。
    """
    cards = runner.sqlite_count("select count(*) from cards")
    cid = runner.sqlite_count("select min(id) from cards") if cards else 0

    if cid:
        def flag(payload: dict) -> None:
            runner.expect_success(payload)
            raw = int(runner.sqlite_count(f"select flags from cards where id={cid}"))
            if (raw & 7) != 3:
                raise AssertionError(f"旗标未落库：flags={raw}，期望低三位为 3")

        runner.check("set_card_flag", flag, {"cardId": str(cid), "flag": 3})

        def suspend(payload: dict) -> None:
            runner.expect_success(payload)
            queue = int(runner.sqlite_count(f"select queue from cards where id={cid}"))
            if queue != -1:
                raise AssertionError(f"暂停后 queue={queue}，期望 -1")

        runner.check("toggle_suspend", suspend, {"cardIds": [str(cid)], "suspend": True})

    try:
        dash = runner.expect_success(runner.call("get_dashboard"))
        did = (dash.get("decks") or [{}])[0].get("id")
    except Exception:  # noqa: BLE001
        did = None

    if did:
        def quick_add(payload: dict) -> None:
            data = runner.expect_success(payload)
            if data.get("success") is False:
                raise AssertionError(f"快速添加未成功：{data.get('message')}")
            after = runner.sqlite_count("select count(*) from cards")
            if after != cards + 1:
                raise AssertionError(f"加卡后共 {after} 张，期望 {cards + 1}")

        runner.check(
            "quick_add",
            quick_add,
            {"front": "冒烟新增题目", "back": "自动生成答案", "deckId": did, "tags": ["smoke"]},
        )


def run_occlusion_checks(runner: ScenarioRunner) -> None:
    """图片遮挡场景专用：验证后端的遮罩解析没有被破坏。

    实测口径（26.9.4）：后端 ``search_service`` 已经把 ``span.anki-io-rect``
    里的 cloze 消费掉，并注入遮罩样式与 ``data-io-rect``；``<img src>`` 同时被
    重写成 ``file://``。因此「cloze 仍在」反而是错的——那说明解析没生效。
    """
    if not runner.manifest().get("occlusion_ratio"):
        return

    def occlusion(payload: dict) -> None:
        data = runner.expect_success(payload)
        cards = data.get("cards") or []
        if not cards:
            raise AssertionError("遮挡场景没有任何卡片")
        hit = 0
        for card in cards:
            front = card.get("frontHtml") or ""
            if "anki-io-wrap" not in front:
                continue
            hit += 1
            if "data-io-mode=" not in front:
                raise AssertionError("遮挡容器缺少 data-io-mode")
            if 'src="file://' not in front:
                raise AssertionError("遮挡图片路径未重写为 file://")
            if "anki-io-rect" not in front:
                raise AssertionError("遮挡矩形 span 丢失")
            if "{{c" in front:
                raise AssertionError("cloze 标记未被消费，遮罩不会生效")
            if "data-io-rect=" not in front:
                raise AssertionError("遮挡矩形缺少 data-io-rect 编号")
            if "background:" not in front:
                raise AssertionError("遮挡矩形未注入遮罩样式")
        if hit == 0:
            raise AssertionError("搜索返回的卡片里没有一张带 anki-io-wrap")

    runner.check("search_cards", occlusion, {"query": ""}, label="occlusion:frontHtml")


def run_native_io_checks(runner: ScenarioRunner) -> None:
    """Anki 原生 Image Occlusion：必须渲染成静态遮罩，而不是裸 SVG。

    原生卡的正规渲染是「模板 → #image-occlusion-container + canvas +
    anki.imageOcclusion.setup()」。插件 WebView 不执行模板里的 script，因此在
    bridge 层把 ``Image`` 底图与 ``Occlusion`` 里的 SVG 矩形转成
    ``.anki-io-wrap`` + ``span.anki-io-rect``，复用既有静态遮罩链路。

    这里同时守住列表与复习两条路径：底图在、遮罩在、cloze 已消费、标题不是
    SVG 文本。任何一条挂了，用户看到的就又是几个黑框。
    """
    manifest = runner.manifest()
    if "Image Occlusion" not in (manifest.get("notetypes") or []):
        return

    def native_io(payload: dict) -> None:
        data = runner.expect_success(payload)
        cards = data.get("cards") or []
        if not cards:
            raise AssertionError("原生遮挡场景没有任何卡片")
        for card in cards:
            front = card.get("frontHtml") or ""
            if not front:
                raise AssertionError("原生遮挡卡返回空 frontHtml")
            if "anki-io-wrap" not in front:
                raise AssertionError("未转成静态遮罩容器（anki-io-wrap 缺失）")
            if 'src="file://' not in front:
                raise AssertionError("底图路径未重写为 file://")
            if "anki-io-rect" not in front:
                raise AssertionError("遮挡矩形未生成")
            if "background:" not in front:
                raise AssertionError("遮罩样式未注入")
            if "{{c" in front:
                raise AssertionError("cloze 未被消费")
            plain = card.get("front") or ""
            if "<svg" in plain:
                raise AssertionError(f"列表标题仍是 SVG 文本：{plain[:40]}")
            if not plain.strip():
                raise AssertionError("列表标题为空，应回落到 Header")

    runner.check("search_cards", native_io, {"query": ""}, label="native-io:frontHtml")

    def review_card(payload: dict) -> None:
        data = runner.expect_success(payload)
        cards = data.get("cards") or []
        if not cards:
            raise AssertionError("复习队列为空")
        front = cards[0].get("frontHtml") or ""
        if "anki-io-wrap" not in front or "anki-io-rect" not in front:
            raise AssertionError("复习界面的原生遮挡未渲染成静态遮罩")
        if 'src="file://' not in front:
            raise AssertionError("复习界面底图路径未重写")

    runner.check("start_review", review_card, {}, label="native-io:review")

    # 多 cloze 语义：同一笔记的两张卡必须只高亮自己那一片区域。
    # 这条只能直接调 service（没有对应的 action），但它是遮挡正确性的核心。
    try:
        nid = runner.col.db.scalar(
            "select nid from cards group by nid having count(*)=2 limit 1"
        )
    except Exception:  # noqa: BLE001
        nid = None

    if not nid:
        runner.warn("native-io:multi-cloze", "场景中没有多 cloze 笔记，该分支未被覆盖")
        return

    try:
        cids = [
            row[0]
            for row in runner.col.db.all(
                "select id from cards where nid=? order by ord", nid
            )
        ]
        highlights = []
        for cid in cids:
            data = runner.router.review_service._serialize_review_card(runner.col, cid)
            if not data:
                raise AssertionError(f"cid {cid} 渲染失败")
            front = data.get("frontHtml") or ""
            # 先确认遮罩真的按 cloze_ord 解析过了。少了这一步，下面 findall 返回空元组
            # 时只会看到「两张卡隐藏了相同区域：[(), ()]」这种毫无信息量的报错。
            if "anki-io-rect-resolved" not in front:
                raise AssertionError(f"cid {cid} 的遮罩未按 cloze_ord 解析：{front[:120]}")
            own = tuple(re.findall(r'data-io-rect="(\d+)"[^>]*>\? #\d+', front))
            if not own:
                raise AssertionError(f"cid {cid} 没有任何被标记为答案的遮罩")
            highlights.append(own)
        if len(set(highlights)) != len(highlights):
            raise AssertionError(f"同一笔记的多张卡隐藏了相同区域：{highlights}")
        runner.results.append(CheckResult(runner.key, "native-io:multi-cloze", True))
    except Exception as exc:  # noqa: BLE001
        runner.results.append(
            CheckResult(
                runner.key,
                "native-io:multi-cloze",
                False,
                f"{type(exc).__name__}: {exc}",
            )
        )


def _schedule_snapshot(runner: ScenarioRunner) -> list[tuple]:
    """逐卡调度快照，用于零 diff 断言（复用 runner.col.db 避免 Windows 独占文件锁冲突）。"""
    return runner._sqlite_rows(
        "select id, type, queue, due, ivl, factor, reps, lapses from cards order by id"
    )


def _diff_count(before: list[tuple], after: list[tuple]) -> int:
    return sum(1 for a, b in zip(before, after) if a != b) + abs(len(before) - len(after))


def _strip_type(rows: list[tuple]) -> list[tuple]:
    """只保留 id 与调度数值，忽略 type/queue。

    极端 `due` 值下 Anki 会把 relearn 卡规范化成 review 卡，这属于框架行为，
    不该让门禁红；但 due/ivl/factor/reps/lapses 必须一字不差。
    """
    return [(r[0], r[3], r[4], r[5], r[6], r[7]) for r in rows]


def run_vacation_checks(runner: ScenarioRunner) -> None:
    """休假 / 减负 / 低能量全链路。

    这三条链路是项目里最危险的写路径（前几轮加固全在这里），而它们此前只有
    ``get_vacation_status`` 一个只读检查。核心断言不是「返回 success」，而是
    **撤销之后每一张卡的调度字段回到原样**——安全壳真正要保证的就是这件事。
    """
    if runner.sqlite_count("select count(*) from cards") == 0:
        return

    # 极端 due/ivl 场景下，Anki 自己会规范化 type/queue，零 diff 只对调度数值成立
    dirty = runner.manifest().get("dirty") or {}
    strict = not ({"extreme_due", "extreme_ivl"} & set(dirty))

    def record(label: str, ok: bool, detail: str = "") -> None:
        runner.results.append(CheckResult(runner.key, label, ok, detail))

    def check_zero_diff(label: str, before: list[tuple], after: list[tuple], what: str) -> None:
        if strict:
            diff = _diff_count(before, after)
            detail = "" if diff == 0 else f"{what}仍有 {diff} 张卡的调度字段与操作前不同"
        else:
            diff = _diff_count(_strip_type(before), _strip_type(after))
            detail = "" if diff == 0 else f"{what}仍有 {diff} 张卡的调度数值被改写"
            changed = sum(1 for a, b in zip(before, after) if a[1] != b[1] or a[2] != b[2])
            if changed:
                runner.warn(
                    "vacation:type-normalized",
                    f"{changed} 张卡的 type/queue 被 Anki 规范化（极端 due 下的框架行为）",
                )
        record(label, diff == 0, detail)

    # ---- 休假：开启 → 状态 → 撤销 → 零 diff
    before = _schedule_snapshot(runner)

    def set_vac(payload: dict) -> None:
        data = runner.expect_success(payload)
        if data.get("success") is False:
            raise AssertionError(f"开启休假失败：{data.get('message')}")

    runner.check(
        "set_vacation",
        set_vac,
        {"days": 2, "freezeNewCards": True, "shiftReviewCards": True, "freezeStreak": True},
    )

    def vacation_active(payload: dict) -> None:
        data = runner.expect_success(payload)
        vacation = data.get("vacation") or {}
        if not vacation.get("isActive"):
            raise AssertionError("开启后 vacation.isActive 仍为 False")

    runner.check("get_vacation_status", vacation_active, label="vacation:active")

    runner.check("cancel_vacation", lambda p: runner.expect_success(p), label="vacation:cancel")

    after = _schedule_snapshot(runner)
    check_zero_diff("vacation:zero-diff", before, after, "撤销休假后")

    def has_history(payload: dict) -> None:
        data = runner.expect_success(payload)
        history = data.get("history")
        if history is None:
            raise KeyError("vacation 历史缺 history 字段")

    runner.check("get_vacation_history", has_history, label="vacation:history")

    # ---- 减负：分摊 → 撤销 → 零 diff
    # 前提是存在到期的复习卡；全新卡场景（newbie）本来就没有积压可救。
    today = runner.col.sched.today
    due_review = runner.sqlite_count(
        f"select count(*) from cards where queue=2 and due<={today}"
    )
    if due_review == 0:
        runner.warn(
            "vacation:rescue-skip",
            "场景里没有到期的复习卡，减负与低能量分支未被覆盖",
        )
        return

    before_rescue = _schedule_snapshot(runner)

    def rescue(payload: dict) -> None:
        data = runner.expect_success(payload)
        if data.get("success") is False:
            raise AssertionError(f"减负失败：{data.get('message')}")
        # 返回字段是 count；兼容旧版可能给 rescheduledCids 列表
        count = data.get("count")
        if count is None:
            count = len(data.get("rescheduledCids") or [])
        if int(count) <= 0:
            raise AssertionError(f"减负没有重排任何卡片（count={count}，{data.get('message')}）")

    runner.check(
        "rescue_backlog", rescue, {"mode": "amortize", "days": 3}, label="rescue:amortize"
    )

    runner.check("undo_rescue", lambda p: runner.expect_success(p), label="rescue:undo")

    after_rescue = _schedule_snapshot(runner)
    check_zero_diff("rescue:zero-diff", before_rescue, after_rescue, "撤销减负后")

    runner.check("get_rescue_history", lambda p: runner.expect_success(p), label="rescue:history")

    # ---- 低能量模式：应挑出成熟到期卡
    def low_energy(payload: dict) -> None:
        data = runner.expect_success(payload)
        cards = data.get("cards") or data.get("cardIds") or []
        if not cards:
            raise AssertionError("低能量模式没有返回任何卡片")

    runner.check("start_low_energy", low_energy, {"limit": 10}, label="low-energy")


def run_crud_checks(runner: ScenarioRunner) -> None:
    """牌组增删改、牌组选项往返、批量操作、答题写路径。

    这些是前端天天调用、但此前一项都没进回归的接口。共同点是「写完要读回来
    对得上」——只看 success 字段没有意义。
    """
    def record(label: str, ok: bool, detail: str = "") -> None:
        runner.results.append(CheckResult(runner.key, label, ok, detail))

    def deck_names() -> list[str]:
        dash = runner.expect_success(runner.call("get_dashboard"))
        return [d.get("name") for d in (dash.get("decks") or [])]

    def note_types(payload: dict) -> None:
        data = runner.expect_success(payload)
        items = data.get("noteTypes") or data.get("models") or []
        if not items:
            raise AssertionError("没有返回任何笔记类型")

    runner.check("get_note_types", note_types)

    # ---- 牌组 CRUD：建 → 改名 → 删
    created: dict[str, str] = {}

    def create(payload: dict) -> None:
        data = runner.expect_success(payload)
        did = data.get("id")
        if not did:
            raise AssertionError("创建牌组未返回 id")
        created["id"] = str(did)

    runner.check("create_deck", create, {"name": "冒烟临时牌组"})

    if created.get("id"):
        def renamed(payload: dict) -> None:
            runner.expect_success(payload)
            if "冒烟临时牌组-改名" not in deck_names():
                raise AssertionError("改名后 dashboard 里找不到新名字")

        runner.check(
            "rename_deck", renamed, {"deckId": created["id"], "name": "冒烟临时牌组-改名"}
        )

        def removed(payload: dict) -> None:
            runner.expect_success(payload)
            if "冒烟临时牌组-改名" in deck_names():
                raise AssertionError("删除后牌组仍在列表里")

        runner.check("delete_deck", removed, {"deckId": created["id"]})

    # ---- 牌组选项往返：改 → 读 → 还原
    decks = runner.expect_success(runner.call("get_dashboard")).get("decks") or []
    if decks:
        did = decks[0].get("id")
        original = (decks[0].get("options") or {}).get("newPerDay", 20)

        def save_opt(payload: dict) -> None:
            data = runner.expect_success(payload)
            if data.get("saved") is False:
                raise AssertionError(f"牌组选项未保存：{data.get('error')}")

        runner.check("save_deck_options", save_opt, {"deckId": did, "newPerDay": 42})

        def read_opt(payload: dict) -> None:
            data = runner.expect_success(payload)
            block = data.get("options") if isinstance(data.get("options"), dict) else data
            if int(block.get("newPerDay", -1)) != 42:
                raise AssertionError(f"写 42 读回 {block.get('newPerDay')}，往返不一致")

        runner.check(
            "get_deck_options", read_opt, {"deckId": did}, label="deck-options:roundtrip"
        )
        runner.call("save_deck_options", {"deckId": did, "newPerDay": int(original)})

    # ---- 批量操作：加标签后必须真的写进 notes.tags
    cids = [row[0] for row in runner._sqlite_rows("select id from cards order by id limit 3")]

    if cids:
        def batch(payload: dict) -> None:
            data = runner.expect_success(payload)
            if data.get("success") is False:
                raise AssertionError(f"批量操作失败：{data.get('error')}")
            if int(data.get("affected") or 0) <= 0:
                raise AssertionError("批量操作 affected 为 0")

        runner.check(
            "batch_action",
            batch,
            {"actionType": "addTag", "cardIds": [str(c) for c in cids], "tag": "smoke-batch"},
        )
        tagged = runner.sqlite_count(
            "select count(*) from notes where tags like '%smoke-batch%'"
        )
        record(
            "batch:tag-persisted",
            tagged > 0,
            "" if tagged else "批量加标签返回成功，但 notes.tags 里没有写入",
        )

    # ---- 答题写路径：revlog 必须 +1
    target_cid = runner.sqlite_count("select min(id) from cards")
    if target_cid:
        before = runner.sqlite_count("select count(*) from revlog")

        def answer(payload: dict) -> None:
            data = runner.expect_success(payload)
            if data.get("answered") is False:
                raise AssertionError(f"答题未落库：{data.get('error')}")

        runner.check(
            "answer_card",
            answer,
            {"cardId": str(target_cid), "ease": 3, "elapsedMs": 5000},
        )
        after = runner.sqlite_count("select count(*) from revlog")
        record(
            "answer:revlog",
            after == before + 1,
            "" if after == before + 1 else f"复习记录从 {before} 变为 {after}，期望 +1",
        )


def run_remaining_checks(runner: ScenarioRunner) -> None:
    """补齐此前未覆盖的 13 个业务 action。

    顺序是按副作用排的：只读 → 偏好 → 休假结束 → 埋没 → 编辑 → 媒体 → 撤销 →
    同步降级 → 删除。删除放最后，因为它会让后续检查失去操作对象。
    """
    def record(label: str, ok: bool, detail: str = "") -> None:
        runner.results.append(CheckResult(runner.key, label, ok, detail))

    # ---- 只读：复习队列与卡片调试诊断
    def review_queue(payload: dict) -> None:
        data = runner.expect_success(payload)
        for key in ("cards", "totalDue"):
            if key not in data:
                raise KeyError(f"复习队列缺 {key}（实际：{sorted(data)}）")

    runner.check("get_review_queue", review_queue, {"limit": 5})

    probe_cid = runner.sqlite_count("select min(id) from cards")
    if probe_cid:
        def card_debug_info(payload: dict) -> None:
            data = runner.expect_success(payload)
            if not data.get("available"):
                raise AssertionError(f"get_card_debug_info 不可用：{data.get('reason')}")
            for key in (
                "cardInfo",
                "noteInfo",
                "noteTypeInfo",
                "nativeRender",
                "clozeAndCharDiagnostics",
                "runtime",
            ):
                if not isinstance(data.get(key), dict):
                    raise KeyError(f"get_card_debug_info 缺 {key}")
            if not isinstance(data["noteTypeInfo"].get("activeTemplate"), dict):
                raise KeyError("noteTypeInfo 缺 activeTemplate")
            snap = data["runtime"].get("configSnapshot") or {}
            for key in (
                "autoPlayFrontAudio",
                "autoPlayBackAudio",
                "reviewStageWidth",
                "reviewContentScale",
            ):
                if key not in snap:
                    raise KeyError(f"configSnapshot 缺 {key}")

        runner.check(
            "get_card_debug_info",
            card_debug_info,
            {"cardId": str(probe_cid)},
            label="debug-info",
        )

    # ---- 自定义学习：预览与启动
    def preview(payload: dict) -> None:
        data = runner.expect_success(payload)
        matched = int(data.get("totalMatched", -1))
        if matched < 0:
            raise KeyError("预览缺 totalMatched")
        if int(data.get("count", 0)) > 10:
            raise AssertionError("预览返回数超过 limit")

    runner.check(
        "preview_custom_study", preview, {"preset": "mistakes", "limit": 10},
        label="custom-study:preview",
    )

    def start_custom(payload: dict) -> None:
        data = runner.expect_success(payload)
        ids = data.get("cardIds")
        if ids is None:
            raise KeyError("启动特训缺 cardIds")
        if len(ids) > 10:
            raise AssertionError(f"返回 {len(ids)} 张，超过 limit=10")

    runner.check(
        "start_custom_study", start_custom, {"preset": "flagged", "limit": 10},
        label="custom-study:start",
    )

    # ---- 查重：拿真实卡片正文去查，必须判定为重复
    # dirty 场景会把前几条笔记置为空卡，因此扫描前 30 条找到第一条有实际文本的笔记
    rows = runner._sqlite_rows("select flds from notes limit 30")
    front_text = ""
    plain_front = ""
    for r in rows:
        candidate = (r[0] or "").split("\x1f")[0]
        # 遮挡类笔记的正文是 `{{c1::<svg>…</svg>}}`，先把 cloze 与标签都剥掉再判断，
        # 否则剩下的 `{{c1::}}` 会被误认为可比较文本，查重必然落空。
        stripped = re.sub(r"\{\{c\d+::[\s\S]*?\}\}", "", candidate)
        stripped = re.sub(r"<[^>]+>", "", stripped).strip()
        if len(stripped) >= 4:
            front_text = candidate
            plain_front = stripped
            break

    if len(plain_front) >= 4:
        def duplicate(payload: dict) -> None:
            data = runner.expect_success(payload)
            if not data.get("isDuplicate"):
                raise AssertionError(f"用已有正文查重未判定重复，matched={data.get('duplicateCount')}")

        runner.check("check_duplicate", duplicate, {"front": front_text}, label="duplicate:found")
    else:
        runner.warn("duplicate:skip", "首条笔记正文去标签后为空，查重分支未被覆盖")

    # ---- 偏好往返（含主题、音频双开关与视图双维调节）
    def save_pref(payload: dict) -> None:
        data = runner.expect_success(payload)
        if data.get("saved") is False:
            raise AssertionError("偏好未保存")

    runner.check(
        "save_preferences",
        save_pref,
        {
            "theme": "dark",
            "autoPlayFrontAudio": True,
            "autoPlayBackAudio": False,
            "reviewStageWidth": "wide",
            "reviewContentScale": 115,
        },
        label="preferences:save",
    )

    def read_pref(payload: dict) -> None:
        data = runner.expect_success(payload)
        prefs = data.get("preferences") if isinstance(data.get("preferences"), dict) else data
        if prefs.get("theme") != "dark":
            raise AssertionError(f"写 dark 读回 {prefs.get('theme')}")
        if prefs.get("autoPlayFrontAudio") is not True or prefs.get("autoPlayBackAudio") is not False:
            raise AssertionError(
                f"音频自动播放开关往返不一致：{prefs.get('autoPlayFrontAudio')}/{prefs.get('autoPlayBackAudio')}"
            )
        if prefs.get("reviewStageWidth") != "wide" or int(prefs.get("reviewContentScale") or 0) != 115:
            raise AssertionError(
                f"视图宽度/缩放往返不一致：{prefs.get('reviewStageWidth')}/{prefs.get('reviewContentScale')}"
            )

    runner.check("get_preferences", read_pref, label="preferences:roundtrip")

    # ---- 休假改为「自然结束」
    runner.call("set_vacation", {"days": 1})

    def end_vac(payload: dict) -> None:
        data = runner.expect_success(payload)
        if not data.get("wasActive"):
            raise AssertionError("结束休假时未识别到进行中的休假")

    runner.check("end_vacation", end_vac, {}, label="vacation:end")

    # ---- 埋没：写下去必须真的进 queue=-2
    bury_cid = runner.sqlite_count("select min(id) from cards where queue=2")

    def bury(payload: dict) -> None:
        data = runner.expect_success(payload)
        if not data.get("buried"):
            raise AssertionError("toggle_bury 未返回 buried=True")
        queue = int(runner.sqlite_count(f"select queue from cards where id={bury_cid}"))
        # -2 = 用户手动埋没，-3 = 调度器埋没。Anki 26 的 bury_cards(manual=True)
        # 实测写入的是 -3，两者都表示「今天不再出现」，不该硬编码 -2。
        if queue not in (-2, -3):
            raise AssertionError(f"埋没后 queue={queue}，期望 -2 或 -3")

    if bury_cid:
        runner.check("toggle_bury", bury, {"cardId": str(bury_cid)}, label="cards:bury")
        runner.call("toggle_bury", {"cardId": str(bury_cid), "bury": False})

    # ---- 编辑：内容必须写进 notes.flds
    edit_cid = runner.sqlite_count("select min(id) from cards")
    edit_nid = runner.sqlite_count(f"select nid from cards where id={edit_cid}")

    if edit_cid and edit_nid:
        def edit(payload: dict) -> None:
            data = runner.expect_success(payload)
            if data.get("saved") is False:
                raise AssertionError("编辑返回 saved=False")
            flds = runner._sqlite_rows(f"select flds from notes where id={edit_nid}")
            flds_str = str(flds[0][0]) if flds else ""
            if "冒烟编辑" not in flds_str:
                raise AssertionError("编辑内容没写进 notes.flds")

        runner.check(
            "update_card_inline",
            edit,
            {"cardId": str(edit_cid), "noteId": str(edit_nid),
             "front": "冒烟编辑正面", "back": "冒烟编辑背面"},
            label="editor:persisted",
        )

    # ---- 普通卡加挖空自动派生 (Cloze) 伴生卡型（仅在 exam 场景跑，避免污染基础计数）
    if runner.key == "exam":
        added_basic = runner.expect_success(
            runner.call(
                "quick_add",
                {
                    "front": "Windows smoke companion basic",
                    "back": "smoke companion back",
                    "deckName": "Default",
                },
            )
        )
        added_cid = added_basic.get("cardId")
        added_nid = added_basic.get("noteId")
        if added_cid and added_nid:
            def companion_cloze(payload: dict) -> None:
                data = runner.expect_success(payload)
                if not data.get("saved") or not data.get("isCloze"):
                    raise AssertionError(f"普通卡转伴生挖空失败：{data}")
                if not data.get("convertedToCloze"):
                    raise AssertionError(f"未触发 convertedToCloze：{data}")
                if "(Cloze)" not in str(data.get("noteTypeName") or ""):
                    raise AssertionError(f"期望伴生 (Cloze) 卡型，实际：{data.get('noteTypeName')}")

            runner.check(
                "update_card_inline",
                companion_cloze,
                {
                    "cardId": str(added_cid),
                    "noteId": str(added_nid),
                    "front": "Windows smoke {{c1::companion cloze}}",
                    "back": "smoke companion back",
                },
                label="editor:companion-cloze",
            )

    # ---- 粘贴图片：素材必须真的落盘
    def paste(payload: dict) -> None:
        data = runner.expect_success(payload)
        if data.get("saved") is False:
            raise AssertionError("粘贴图片未保存")
        name = data.get("filename")
        if not name:
            raise KeyError("粘贴图片未返回 filename")
        if not (runner.media_copy / name).exists():
            raise AssertionError(f"媒体目录里找不到 {name}")

    runner.check(
        "save_pasted_image",
        paste,
        {"base64Data": "iVBORw0KGgo=", "ext": "png", "filename": "smoke-paste.png"},
        label="editor:paste-image",
    )

    # ---- 撤销：先制造一次可撤销操作，再撤
    if edit_cid:
        runner.call("answer_card", {"cardId": str(edit_cid), "ease": 3, "elapsedMs": 3000})

        def undo(payload: dict) -> None:
            data = runner.expect_success(payload)
            if not data.get("undone"):
                raise AssertionError(f"撤销失败：{data.get('label')}")

        runner.check("undo", undo, {}, label="undo:after-answer")

    # ---- 同步：无真实 mw 时必须优雅降级，而不是抛异常
    def sync_shape(payload: dict) -> None:
        data = runner.expect_success(payload)
        for key in ("synced", "triggeredNativeSync"):
            if key not in data:
                raise KeyError(f"同步返回缺 {key}（实际：{sorted(data)}）")

    runner.check("sync", sync_shape, {}, label="sync:degrade")
    runner.check("sync_collection", sync_shape, {}, label="sync-collection:degrade")

    # ---- 删除：放最后
    before = runner.sqlite_count("select count(*) from cards")
    victim = runner.sqlite_count("select max(id) from cards")

    if victim:
        def delete(payload: dict) -> None:
            data = runner.expect_success(payload)
            if not data.get("deleted"):
                raise AssertionError("删除未返回 deleted=True")
            after = runner.sqlite_count("select count(*) from cards")
            if after >= before:
                raise AssertionError(f"删除后卡片数 {after} 未减少（原 {before}）")

        runner.check("delete_cards", delete, {"cardIds": [str(victim)]}, label="cards:delete")


# ---------------------------------------------------------------------------
# 卡片库排序（LibraryView 排序控件的后端契约）
# ---------------------------------------------------------------------------

#: 排序下拉里的全部非默认选项。前端把 key 原样塞进 sortBy，后端逐个分支处理，
#: 任何一个拼错或分支漏掉都会表现为「排序点了没反应」，所以逐个守住。
SORT_KEYS = (
    "lapses_desc",
    "ivl_asc",
    "ivl_desc",
    "due_asc",
    "stability_asc",
    "front_asc",
    "newest",
)


def _sort_projection(key: str, card: dict[str, Any]) -> tuple:
    """把一张卡映射成排序键元组，必须与 search_service 的 sort 分支一一对应。

    只取参与比较的前几个字段（不含 id 兜底项）：id 是时间戳，主键相同时才
    参与比较，不影响「整体单调」这个不变量。
    """
    if key == "lapses_desc":
        return (-int(card.get("lapses", 0) or 0),)
    if key == "ivl_asc":
        return (int(card.get("intervalDays", 0) or 0),)
    if key == "ivl_desc":
        return (-int(card.get("intervalDays", 0) or 0),)
    if key == "due_asc":
        status = card.get("status")
        rank = 0 if status == "due" else (1 if status == "review" else 2)
        return (rank, int(card.get("dueRaw", 999999) or 0))
    if key == "stability_asc":
        return (int(card.get("mastery", 0) or 0), float(card.get("stability", 0.0) or 0.0))
    if key == "front_asc":
        return (str(card.get("front", "")).lower(),)
    if key == "newest":
        return (-int(card.get("id", 0) or 0),)
    raise KeyError(f"未知排序项 {key}")


def run_library_sort_checks(runner: ScenarioRunner) -> None:
    """七种排序：结果集不能变，顺序必须单调。"""

    baseline_total: int | None = None

    def baseline(payload: dict) -> None:
        nonlocal baseline_total
        data = runner.expect_success(payload)
        if data.get("total") is None:
            raise KeyError("默认查询缺 total")
        baseline_total = int(data["total"])

    runner.check("search_cards", baseline, {"query": "", "limit": 200}, label="sort:baseline")

    for key in SORT_KEYS:
        def check(payload: dict, key: str = key) -> None:
            data = runner.expect_success(payload)
            cards = data.get("cards") or []
            if baseline_total is not None and int(data.get("total", -1)) != baseline_total:
                raise AssertionError(
                    f"排序 {key} 改变了结果集总数：{data.get('total')} != {baseline_total}"
                )
            values = [_sort_projection(key, c) for c in cards]
            for i in range(1, len(values)):
                if values[i] < values[i - 1]:
                    raise AssertionError(
                        f"排序 {key} 在第 {i} 项逆序：{values[i - 1]} → {values[i]}"
                    )

        runner.check(
            "search_cards", check, {"query": "", "sortBy": key, "limit": 200},
            label=f"sort:{key}",
        )

    def unknown_key(payload: dict) -> None:
        # 前端万一写了个新 key 而后端还没实现，也不允许 500 或静默清空
        data = runner.expect_success(payload)
        if data.get("error"):
            raise AssertionError(f"未知排序项报错：{data['error']}")
        if baseline_total is not None and int(data.get("total", -1)) != baseline_total:
            raise AssertionError("未知排序项把结果集改掉了")

    runner.check(
        "search_cards", unknown_key, {"query": "", "sortBy": "definitely_not_a_sort", "limit": 50},
        label="sort:unknown-key",
    )


# ---------------------------------------------------------------------------
# 自定义学习：四种预设的语义边界（CustomStudyModal 三层改造后的契约）
# ---------------------------------------------------------------------------


def _assert_preset_semantics(runner: ScenarioRunner, preset: str, ids: list[int]) -> None:
    id_list = ",".join(str(i) for i in ids)
    if preset == "extra_new":
        bad = runner.sqlite_count(
            f"select count(*) from cards where id in ({id_list}) and not (type=0 or queue=0)"
        )
        if bad:
            raise AssertionError(f"额外新卡里混入 {bad} 张非新卡")
    elif preset == "flagged":
        bad = runner.sqlite_count(
            f"select count(*) from cards where id in ({id_list}) and (flags & 7) = 0"
        )
        if bad:
            raise AssertionError(f"旗标专项里混入 {bad} 张无旗标卡")
    elif preset == "ahead":
        bad = runner.sqlite_count(
            f"select count(*) from cards where id in ({id_list})"
            " and not (queue in (2, 3) or type=2)"
        )
        if bad:
            raise AssertionError(f"提前复习里混入 {bad} 张非复习型卡片")


def run_custom_study_preset_checks(runner: ScenarioRunner) -> None:
    """四种预设各自返回什么，以及「启动特训」必须零副作用。

    ``extra_new`` 在本轮改造后默认 ``isPreviewOnly=false``（计入 FSRS），
    这条路径以前从没跑过，所以顺手把「启动后调度字段零 diff」钉死：
    只要哪天它开始偷偷改队列/到期，这里立刻红。
    """

    if runner.key == "mixed":
        flagged = runner.sqlite_count("select count(*) from cards where (flags & 7) > 0")
        runner.results.append(
            CheckResult(
                runner.key,
                "custom-study:flag-data",
                flagged > 0,
                "" if flagged > 0 else "mixed 场景声明了 7 色旗标，但库里一张带旗标的卡都没有",
            )
        )

    limit = 30
    presets = ("extra_new", "mistakes", "flagged", "ahead")
    before = _schedule_snapshot(runner)

    for preset in presets:
        def preview(payload: dict, preset: str = preset) -> None:
            data = runner.expect_success(payload)
            matched = int(data.get("totalMatched", -1))
            count = int(data.get("count", -1))
            if matched < 0 or count < 0:
                raise KeyError(f"{preset} 预览缺 totalMatched/count")
            if count != min(limit, matched):
                raise AssertionError(f"{preset} 预览 count={count} 与 min(limit, totalMatched)={min(limit, matched)} 不符")
            if data.get("isPreviewOnly") is not True:
                raise AssertionError(f"{preset} 预览默认应为纯预览")

        runner.check(
            "preview_custom_study", preview, {"preset": preset, "limit": limit},
            label=f"custom-study:preview:{preset}",
        )

        # 额外新卡加练默认计入 FSRS，其余预设默认纯预览
        preview_only = preset != "extra_new"

        def start(payload: dict, preset: str = preset, preview_only: bool = preview_only) -> None:
            data = runner.expect_success(payload)
            ids = [int(x) for x in (data.get("cardIds") or [])]
            if len(ids) > limit:
                raise AssertionError(f"{preset} 返回 {len(ids)} 张，超过 limit={limit}")
            if int(data.get("count", -1)) != len(ids):
                raise AssertionError(f"{preset} 的 count 与 cardIds 长度不一致")
            if bool(data.get("isPreviewOnly")) != preview_only:
                raise AssertionError(
                    f"{preset} 的 isPreviewOnly 回显 {data.get('isPreviewOnly')}，期望 {preview_only}"
                )
            if ids:
                _assert_preset_semantics(runner, preset, ids)

        runner.check(
            "start_custom_study", start,
            {"preset": preset, "limit": limit, "isPreviewOnly": preview_only},
            label=f"custom-study:start:{preset}",
        )

    # 指定旗标颜色（7 色旗标专项），逐张核对 colors
    def flag_color(payload: dict) -> None:
        data = runner.expect_success(payload)
        ids = [int(x) for x in (data.get("cardIds") or [])]
        if not ids:
            return
        bad = runner.sqlite_count(
            "select count(*) from cards where id in ("
            + ",".join(str(i) for i in ids)
            + ") and (flags & 7) <> 3"
        )
        if bad:
            raise AssertionError(f"旗标色 3 专项里混入 {bad} 张其它颜色")

    runner.check(
        "start_custom_study", flag_color,
        {"preset": "flagged", "flag": "3", "limit": limit},
        label="custom-study:flag-color",
    )

    # 牌组作用域：目标牌组从弹窗顶栏进来，返回的卡必须都落在该牌组（含子牌组）里。
    # 注意两点来自实战的坑：
    #   1) 裸 SQL 读到的 decks.name 用 \x1f 分层级，不是 API 返回的 ::；
    #   2) 必须挑一个真的有卡的牌组，否则返回空集，检查等于没跑。
    deck_rows = runner._sqlite_rows(
        "select d.id, d.name, count(c.id) as n from decks d"
        " left join cards c on c.did = d.id where d.id > 1 group by d.id"
        " order by n desc, d.id"
    )
    deck_rows = [row for row in deck_rows if int(row[2]) > 0]
    if deck_rows:
        did = int(deck_rows[0][0])
        deck_name = str(deck_rows[0][1]).replace("\x1f", "::")
        allowed = {did} | {
            int(row[0])
            for row in deck_rows
            if str(row[1]).replace("\x1f", "::").startswith(deck_name + "::")
        }
        allowed_sql = ",".join(str(d) for d in sorted(allowed))

        def deck_scope(payload: dict, allowed_sql: str = allowed_sql) -> None:
            data = runner.expect_success(payload)
            ids = [int(x) for x in (data.get("cardIds") or [])]
            if not ids:
                return
            bad = runner.sqlite_count(
                "select count(*) from cards where id in ("
                + ",".join(str(i) for i in ids)
                + f") and did not in ({allowed_sql})"
            )
            if bad:
                raise AssertionError(f"牌组专项里混入 {bad} 张其它牌组的卡")

        runner.check(
            "start_custom_study", deck_scope,
            {"preset": "custom", "deckId": str(did), "cardScope": "all", "limit": limit},
            label="custom-study:deck-scope",
        )

    after = _schedule_snapshot(runner)
    diff = _diff_count(before, after)
    runner.results.append(
        CheckResult(
            runner.key,
            "custom-study:no-schedule-side-effect",
            diff == 0,
            "" if diff == 0 else f"启动特训改动了 {diff} 张卡的调度字段",
        )
    )


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def available_scenarios() -> list[str]:
    return sorted(p.stem for p in lib_dir().glob("*.anki2"))


def main() -> int:
    parser = argparse.ArgumentParser(description="场景库冒烟回归")
    parser.add_argument("keys", nargs="*", help="场景 key，省略则全部")
    parser.add_argument("--list", action="store_true", help="列出场景")
    parser.add_argument("-v", "--verbose", action="store_true", help="打印完整错误栈")
    parser.add_argument("-q", "--quiet", action="store_true", help="只输出失败项与汇总")
    args = parser.parse_args()

    scenarios = available_scenarios()
    if args.list:
        print("可用场景：", ", ".join(scenarios) or "（无，先运行 build.py）")
        return 0
    if not scenarios:
        print("没有场景，先运行：python3 build.py --core", file=sys.stderr)
        return 2

    keys = args.keys or scenarios
    unknown = [k for k in keys if k not in scenarios]
    if unknown:
        print(f"未知场景：{', '.join(unknown)}", file=sys.stderr)
        return 2

    all_results: list[CheckResult] = []
    all_warnings: list[tuple[str, str]] = []
    for key in keys:
        if not args.quiet:
            print(f"→ {key}", flush=True)
        try:
            with ScenarioRunner(key, verbose=args.verbose) as runner:
                run_checks(runner)
                run_library_sort_checks(runner)
                run_custom_study_preset_checks(runner)
                run_deck_options(runner)
                run_maintenance_checks(runner)
                run_occlusion_checks(runner)
                run_native_io_checks(runner)
                run_vacation_checks(runner)
                run_write_checks(runner)
                run_crud_checks(runner)
                run_remaining_checks(runner)
                all_results.extend(runner.results)
                all_warnings.extend(runner.warnings)
                for r in runner.results:
                    if r.ok and args.quiet:
                        continue
                    mark = "ok  " if r.ok else "FAIL"
                    line = f"    [{mark}] {r.action}"
                    if not r.ok:
                        line += f"  {r.detail}"
                    print(line)
        except Exception as exc:  # noqa: BLE001
            print(f"    [FAIL] 场景启动失败：{type(exc).__name__}: {exc}")
            all_results.append(CheckResult(key, "<setup>", False, str(exc)))

    total = len(all_results)
    failed = [r for r in all_results if not r.ok]
    if all_warnings:
        # 同一条已知缺陷可能在多个场景重复出现，按 label 去重后再展示
        seen: set[str] = set()
        unique = []
        for label, message in all_warnings:
            if label in seen:
                continue
            seen.add(label)
            unique.append((label, message))
        print(f"\n已知缺陷 {len(unique)} 项（不计入失败，但需要有人认领）：")
        for label, message in unique:
            print(f"  ! {label}: {message}")
    print()
    if failed:
        print(f"{len(failed)}/{total} 项失败")
        for r in failed:
            print(f"  - {r.scenario} / {r.action}: {r.detail}")
        return 1
    print(f"{total} 项检查全部通过（{len(keys)} 个场景）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
