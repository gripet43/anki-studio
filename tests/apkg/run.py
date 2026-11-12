#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anki Studio — 真实 .apkg 卡组显示兼容性测试。

为什么需要它
------------
``tests/scenarios`` 用合成数据覆盖业务边界，但真实卡包的模板千奇百怪：内联
``<style>``/``<script>``、``{{hint}}``、LaTeX 实体、多模板、媒体路径、Cloze/IO……
这些只有在「把真实 .apkg 导入 Anki、走真实渲染管线」时才会暴露。本套件把
AnkiWeb 排名靠前的卡组变成可重复执行的回归用例：

1. 每个 ``.apkg`` 导入一个**临时隔离 collection**（绝不碰真实 Anki 数据）；
2. 按卡型抽样，调用 ``ReviewService`` / ``SearchService`` 走与界面完全相同的
   序列化管线；
3. 后端断言：空卡面、模板占位符残留、``<script>`` 泄漏、``[sound:]`` 未消费、
   ``<img>`` 相对路径未重写、公式里的 HTML 实体（``&nbsp;`` 字面量）、
   正面丢失模板 ``display:none`` 隐藏规则、搜索接口未下发正面样式等；
4. 再交给 Node 端 ``render_check.mjs``，用**前端同一个** ``renderMathAndRichHtml``
   渲染抽样 HTML，断言没有二次转义实体、未渲染的 LaTeX 命令、残留占位符等。

用法
----
    python3 tests/apkg/run.py                 # 跑 decks.json 里的卡组
    python3 tests/apkg/run.py --all           # 跑目录下全部 .apkg
    python3 tests/apkg/run.py --only JLPT     # 只跑名字匹配的卡组
    python3 tests/apkg/run.py --dir ~/somewhere/else
    python3 tests/apkg/run.py --list          # 只列清单
    python3 tests/apkg/run.py --no-frontend   # 跳过 Node 渲染检查
    python3 tests/apkg/run.py --keep          # 保留临时 collection 便于排查

脚本会自动切换到 Anki 自带的 Python（系统 Python 版本不匹配时），也可以显式
用 ``ANKI_APP_PYTHON`` 指定解释器、``ANKI_APP_PACKAGES`` 指定包目录。

卡组文件不在仓库里（体积太大），所以默认目录是 ``~/Downloads``；CI 上可用
``ANKI_STUDIO_APKG_DIR`` 指向一个缓存目录。找不到卡组时只打印 SKIP，不算失败。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ADDON_ROOT = HERE.parent.parent
SCENARIOS_DIR = ADDON_ROOT / "tests" / "scenarios"
PROGRESS_PREFIX = "[apkg]"
REEXEC_ENV = "ANKI_STUDIO_APKG_REEXEC"

# 抽样与上限（真实卡组动辄上万张卡，全量渲染没有必要）
DEFAULT_SAMPLES_PER_NOTETYPE = 3
DEFAULT_MAX_CARDS_PER_DECK = 80

MATH_SEGMENT_RE = re.compile(
    r"\[\$\]([\s\S]*?)\[/\$\]|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$",
    re.I,
)
ENTITY_IN_MATH_RE = re.compile(r"&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d+|#x[0-9a-fA-F]+);")
# 前端 decodeMathEntities 会先解码这些再统一转义，所以它们出现在公式里是安全的；
# 不在这张表里的命名实体才会被二次转义成字面量。
DECODABLE_MATH_ENTITIES = {"nbsp", "amp", "lt", "gt", "quot", "apos"}
SCRIPT_TAG_RE = re.compile(r"<script\b", re.I)
STYLE_BLOCK_RE = re.compile(r"<style\b[^>]*>([\s\S]*?)</style\s*>", re.I)
IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.I)
IMG_SRC_RE = re.compile(r"""\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))""", re.I)
TEMPLATE_PLACEHOLDER_RE = re.compile(r"\{\{[^{}]{1,120}\}\}")
SOUND_TAG_RE = re.compile(r"\[sound:[^\]]+\]", re.I)
BAD_LITERAL_RE = re.compile(r"&amp;(?:nbsp|amp|lt|gt|quot|#\d+|#x[0-9a-f]+);", re.I)
UNRENDERED_LATEX_RE = re.compile(r"\\(?:frac|sqrt|pi|alpha|beta|gamma|theta|sum|int|cdot|times)\b")
NON_FINITE_RE = re.compile(r"\b(?:undefined|NaN|Infinity)\b")


# ---------------------------------------------------------------------------
# 运行时引导：系统 Python 与 Anki 自带 Python 版本不一致时自动重跑
# ---------------------------------------------------------------------------

def _bootstrap_paths() -> None:
    sys.path.insert(0, str(SCENARIOS_DIR))
    sys.path.insert(0, str(ADDON_ROOT))


def _find_anki_python() -> str | None:
    import glob

    env = os.environ.get("ANKI_APP_PYTHON")
    if env and Path(env).exists():
        return env
    if sys.platform == "darwin":
        root = (
            "/Applications/Anki.app/Contents/Frameworks/Python.framework/Versions"
        )
        candidates: list[str] = []
        # 优先通用二进制：Apple Silicon 上 ``*-intel64`` 是 x86_64-only，
        # 在 Rosetta 下能跑 ``--version`` 却加载不了 arm64 的 anki 原生扩展。
        for pattern in (
            f"{root}/3.13/bin/python3",
            f"{root}/Current/bin/python3",
            f"{root}/3.13/bin/python3.*",
            f"{root}/Current/bin/python3.*",
            f"{root}/*/bin/python3",
        ):
            candidates.extend(sorted(glob.glob(pattern), reverse=True))
        for candidate in candidates:
            name = Path(candidate).name
            if not Path(candidate).is_file():
                continue
            if "config" in name or "intel64" in name or "arm64" in name:
                continue
            return candidate
    return None


def ensure_anki_runtime() -> None:
    """确保当前解释器能 import ``anki``；不行就 exec 到 Anki 自带 Python。"""
    _bootstrap_paths()
    try:
        import paths  # noqa: F401

        sys.path.insert(0, str(paths.require_app_packages()))
        import anki.collection  # noqa: F401

        return
    except BaseException:
        pass

    if os.environ.get(REEXEC_ENV) == "1":
        sys.exit(
            f"{PROGRESS_PREFIX} 无法在当前 Python 中 import anki（已尝试 Anki app_packages）。\n"
            f"{PROGRESS_PREFIX} 请用 Anki 自带 Python 运行，或设置 ANKI_APP_PYTHON。"
        )

    app_packages = None
    try:
        import paths

        app_packages = paths.anki_app_packages()
    except Exception:
        app_packages = None
    if app_packages is None:
        sys.exit(
            f"{PROGRESS_PREFIX} 找不到 Anki 的 app_packages。\n"
            f"{PROGRESS_PREFIX} 请设置 ANKI_APP_PACKAGES 指向含 anki/ 子包的目录。"
        )

    python = _find_anki_python() or sys.executable
    env = dict(os.environ)
    env[REEXEC_ENV] = "1"
    env["PYTHONPATH"] = str(app_packages) + (
        os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
    )
    os.execve(python, [python, str(Path(__file__).resolve()), *sys.argv[1:]], env)


# ---------------------------------------------------------------------------
# 清单与发现
# ---------------------------------------------------------------------------

def _default_apkg_dir() -> Path:
    env = os.environ.get("ANKI_STUDIO_APKG_DIR")
    if env:
        return Path(env).expanduser().resolve()
    return (Path.home() / "Downloads").resolve()


def load_known_issues() -> dict:
    """已知显示限制：命中的失败降级为 warning（仍逐条打印，避免「全绿=没问题」的错觉）。"""
    path = HERE / "known_issues.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"{PROGRESS_PREFIX} WARN: known_issues.json 解析失败：{exc}")
        return {}


def known_reason(known: dict, deck_name: str, check: str) -> str | None:
    for pattern, entry in known.items():
        if pattern not in deck_name:
            continue
        checks = entry.get("checks") or {}
        if check in checks:
            return str(checks[check] or entry.get("reason") or "已知限制")
    return None


def load_manifest() -> dict:
    path = HERE / "decks.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"{PROGRESS_PREFIX} WARN: decks.json 解析失败：{exc}")
        return {}


def dedupe_copies(files: list[Path]) -> list[Path]:
    """跳过浏览器重复下载产生的 ``xxx (1).apkg``（同目录已有 ``xxx.apkg`` 时）。"""
    names = {f.name: f for f in files}
    kept: list[Path] = []
    for path in files:
        m = re.match(r"^(.*) \((\d+)\)(\.[^.]+)$", path.name)
        if m and (m.group(1) + m.group(3)) in names:
            continue
        kept.append(path)
    return kept


def discover(apkg_dir: Path, manifest: dict, all_mode: bool, only: str | None) -> tuple[list[Path], list[str]]:
    if not apkg_dir.is_dir():
        return [], [f"目录不存在：{apkg_dir}"]
    files = dedupe_copies(sorted(apkg_dir.glob("*.apkg")))
    if only:
        return [f for f in files if only.lower() in f.name.lower()], []

    entries = manifest.get("decks") or []
    if all_mode or not entries:
        return files, []

    selected: list[Path] = []
    missing: list[str] = []
    for entry in entries:
        match = str(entry.get("match") or "").strip()
        if not match:
            continue
        candidates = [f for f in files if match in f.name]
        if candidates:
            selected.append(candidates[0])
        else:
            missing.append(match)
    return selected, missing


# ---------------------------------------------------------------------------
# 导入
# ---------------------------------------------------------------------------

def import_package(package_path: Path, work_dir: Path):
    from anki.collection import Collection
    from anki.import_export_pb2 import (
        ImportAnkiPackageOptions,
        ImportAnkiPackageRequest,
    )

    base = work_dir / "collection"
    base.mkdir(parents=True, exist_ok=True)
    col = Collection(str(base / "collection.anki2"))
    request = ImportAnkiPackageRequest(
        package_path=str(package_path),
        options=ImportAnkiPackageOptions(
            merge_notetypes=True,
            with_scheduling=False,
            with_deck_configs=False,
        ),
    )
    col.import_anki_package(request)
    return col, base


def model_card_counts(col) -> list[tuple[int, int]]:
    rows = col.db.all(
        "select n.mid, count(*) from cards c join notes n on n.id = c.nid group by n.mid"
    )
    return [(int(mid), int(count)) for mid, count in rows]


def sample_cids(col, mid: int, samples: int) -> list[int]:
    rows = col.db.all(
        "select c.id from cards c join notes n on n.id = c.nid "
        "where n.mid = ? order by c.id",
        mid,
    )
    cids = [int(r[0]) for r in rows]
    if not cids:
        return []
    if len(cids) <= samples:
        return cids
    # 首、中、尾 + 均匀取样，兼顾「第一张」和「最后一张」这类边界卡
    picks = {0, len(cids) // 2, len(cids) - 1}
    step = max(1, len(cids) // samples)
    for offset in range(0, len(cids), step):
        picks.add(min(offset, len(cids) - 1))
        if len(picks) >= samples:
            break
    return [cids[i] for i in sorted(picks)][: max(1, samples)]


# ---------------------------------------------------------------------------
# 后端断言
# ---------------------------------------------------------------------------

class Issues:
    def __init__(self) -> None:
        self.items: list[dict] = []

    def add(self, severity: str, check: str, detail: str) -> None:
        self.items.append({"severity": severity, "check": check, "detail": detail})

    def fail(self, check: str, detail: str) -> None:
        self.add("fail", check, detail)

    def warn(self, check: str, detail: str) -> None:
        self.add("warn", check, detail)

    def extend(self, other: "Issues") -> None:
        self.items.extend(other.items)


def _style_text(html: str) -> str:
    return "\n".join(STYLE_BLOCK_RE.findall(html or ""))


def _visible_html(html: str) -> str:
    return STYLE_BLOCK_RE.sub(" ", html or "")


def css_has_display_none_declaration(css: str) -> bool:
    """只认「声明区」里的 display:none，忽略选择器里的同名子串。

    JLPT10k 的模板里有 ``a.hint[style*='display: none']+div.hint{...}``：
    选择器文本里含 ``display: none``，但它不是隐藏声明。用简单状态机区分
    选择器区（花括号外）与声明区（花括号内），避免误报。
    """
    depth = 0
    buf: list[str] = []
    for ch in css or "":
        if ch == "{":
            depth += 1
            buf = []
            continue
        if ch == "}":
            depth = max(0, depth - 1)
            buf = []
            continue
        if ch == ";":
            if depth >= 1 and re.match(r"\s*display\s*:\s*none\b", "".join(buf), re.I):
                return True
            buf = []
            continue
        buf.append(ch)
    return False


def check_html(issues: Issues, label: str, html: str, model_css: str = "", side: str = "front") -> None:
    visible = _visible_html(html)
    if SCRIPT_TAG_RE.search(visible):
        issues.fail(f"{side}:script-leak", f"{label} 的 {side} HTML 里残留 <script>")
    if SOUND_TAG_RE.search(visible):
        issues.fail(f"{side}:sound-tag", f"{label} 的 {side} HTML 里残留 [sound:] 标记")
    if NON_FINITE_RE.search(visible):
        issues.fail(f"{side}:non-finite", f"{label} 的 {side} HTML 里出现 undefined/NaN")
    placeholder = TEMPLATE_PLACEHOLDER_RE.search(visible)
    if placeholder:
        issues.fail(
            f"{side}:template-placeholder",
            f"{label} 的 {side} HTML 残留模板占位符 {placeholder.group(0)!r}",
        )
    for tag in IMG_TAG_RE.findall(visible):
        src_match = IMG_SRC_RE.search(tag)
        if not src_match:
            continue
        src = (src_match.group(1) or src_match.group(2) or src_match.group(3) or "").strip()
        if not src:
            continue
        if src.lower().startswith(("file://", "data:", "http://", "https://", "blob:", "/")):
            continue
        issues.fail(f"{side}:relative-img-src", f"{label} 的 {side} HTML 图片未重写：src={src[:80]}")
    # 公式里不允许出现 HTML 实体（否则会被显示成字面量 &nbsp; ——PCSI 真实踩过）
    for groups in MATH_SEGMENT_RE.findall(visible):
        segment = next((g for g in groups if g), "")
        for entity in ENTITY_IN_MATH_RE.finditer(segment):
            raw_entity = entity.group(0)
            name = raw_entity[1:-1].split(";")[0].lower()
            if name in DECODABLE_MATH_ENTITIES or name.startswith(("#", "#x")):
                continue
            issues.fail(
                f"{side}:math-entity",
                f"{label} 的 {side} 公式里有前端无法解码的实体 {raw_entity!r}：{segment[:80]!r}",
            )
    # 正面必须保留模板的 display:none（否则隐藏的详解/提示会摊在正面）
    if side == "front" and css_has_display_none_declaration(model_css or ""):
        front_styles = _style_text(html)
        if front_styles and not css_has_display_none_declaration(front_styles):
            issues.fail(
                "front:hidden-lost",
                f"{label} 的正面样式表丢失了模板的 display:none 隐藏规则",
            )
    if side == "back":
        back_styles = _style_text(html)
        if back_styles and css_has_display_none_declaration(back_styles):
            issues.fail(
                "back:hidden-not-revealed",
                f"{label} 的背面样式表仍保留 display:none，点击展开的内容永远不可达",
            )


def check_review_card(col, service, cid: int, model_css: str, issues: Issues) -> dict | None:
    item = service._serialize_review_card(col, cid, "zh-CN", False)
    if not item:
        issues.fail("serialize:review", f"卡片 {cid} 序列化返回 None")
        return None
    label = f"card {cid}"
    front = item.get("frontHtml") or ""
    back = item.get("backHtml") or ""
    if not front.strip():
        issues.fail("front:empty", f"{label} 的 frontHtml 为空")
    if not back.strip():
        issues.fail("back:empty", f"{label} 的 backHtml 为空")
    check_html(issues, label, front, model_css, "front")
    check_html(issues, label, back, model_css, "back")
    if not isinstance(item.get("replaceFrontOnFlip"), bool):
        issues.fail("flip:flag", f"{label} 缺少 replaceFrontOnFlip 标识")
    return item


def check_library_card(col, near_side: str, cid: int, issues: Issues) -> None:
    from bridge.search_service import SearchService

    service = SearchService(col_getter=lambda: col)
    back_sink: dict[str, str] = {}
    front_sink: dict[str, str] = {}
    item = service._serialize_library_card(col, cid, "", "zh-CN", back_sink, front_sink)
    if not item:
        issues.fail("serialize:library", f"卡片 {cid} 的卡片库序列化返回 None")
        return
    model_key = str(item.get("notetypeId") or "")
    if not model_key:
        issues.fail("library:notetype", f"卡片 {cid} 缺少 notetypeId")
        return
    if back_sink.get(model_key) and "anki-native-card-front" in back_sink[model_key]:
        issues.fail("library:back-style", f"{near_side} 的背面样式误用了正面作用域")
    if front_sink.get(model_key):
        if ".anki-native-card-front" not in front_sink[model_key]:
            issues.fail("library:front-style-scope", f"{near_side} 的正面样式缺少独立作用域")
        if css_has_display_none_declaration(back_sink.get(model_key, "")):
            issues.fail("library:back-hidden", f"{near_side} 的背面样式仍保留 display:none")


# ---------------------------------------------------------------------------
# 前端渲染断言（Node + esbuild 复用 frontend/node_modules）
# ---------------------------------------------------------------------------

def run_frontend_checks(samples: list[dict], timeout: int = 180) -> tuple[list[dict], str]:
    script = HERE / "render_check.mjs"
    if not script.exists():
        return [], "render_check.mjs 缺失"
    if shutil.which("node") is None:
        return [], "未找到 node"
    node_modules = ADDON_ROOT / "frontend" / "node_modules"
    if not (node_modules / "esbuild").is_dir():
        return [], "frontend/node_modules 未安装（先 cd frontend && npm install）"
    payload = Path(tempfile.mkstemp(prefix="anki-apkg-frontend-", suffix=".json")[1])
    try:
        payload.write_text(json.dumps(samples, ensure_ascii=False), encoding="utf-8")
        proc = subprocess.run(
            ["node", str(script), str(payload)],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(ADDON_ROOT),
        )
        if proc.returncode != 0:
            return [], f"node 退出码 {proc.returncode}：{(proc.stderr or proc.stdout)[-400:]}"
        try:
            data = json.loads(proc.stdout.strip().splitlines()[-1])
        except Exception:
            return [], f"node 输出无法解析：{proc.stdout[-300:]}"
        return data.get("issues") or [], ""
    except subprocess.TimeoutExpired:
        return [], "前端渲染检查超时"
    finally:
        try:
            payload.unlink()
        except OSError:
            pass


# ---------------------------------------------------------------------------
# 单卡组执行
# ---------------------------------------------------------------------------

def test_deck(package_path: Path, args) -> dict:
    from bridge.review_service import ReviewService

    result = {
        "deck": package_path.name,
        "status": "PASS",
        "import_seconds": 0.0,
        "notes": 0,
        "cards": 0,
        "notetypes": 0,
        "sampled_cards": 0,
        "issues": [],
        "notes_list": [],
    }
    issues = Issues()
    work_dir = Path(tempfile.mkdtemp(prefix="anki-studio-apkg-"))
    started = time.time()
    try:
        col, collection_dir = import_package(package_path, work_dir)
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(work_dir, ignore_errors=True)
        result["status"] = "FAIL"
        result["issues"] = [
            {"severity": "fail", "check": "import", "detail": f"导入失败：{exc}"}
        ]
        return result

    try:
        result["import_seconds"] = round(time.time() - started, 2)
        result["notes"] = int(col.note_count())
        result["cards"] = int(col.card_count())
        review = ReviewService(
            col_getter=lambda: col, mw_getter=lambda: None, lang_getter=lambda: "zh-CN"
        )
        math_samples: list[dict] = []
        counts = model_card_counts(col)
        result["notetypes"] = len(counts)
        remaining = args.max_cards

        for mid, card_count in counts:
            if remaining <= 0:
                break
            model = col.models.get(mid) or {}
            model_name = str(model.get("name") or mid)
            model_css = str(model.get("css") or "")
            samples = min(args.samples_per_notetype, remaining)
            cids = sample_cids(col, mid, samples)
            tested_library = False
            for cid in cids:
                item = check_review_card(col, review, cid, model_css, issues)
                if item:
                    math_samples.append(
                        {
                            "deck": package_path.name,
                            "model": model_name,
                            "card": int(cid),
                            "frontHtml": item.get("frontHtml") or "",
                            "backHtml": item.get("backHtml") or "",
                        }
                    )
                if not tested_library:
                    check_library_card(col, f"{model_name} card {cid}", cid, issues)
                    tested_library = True
                remaining -= 1
                if remaining <= 0:
                    break
            result["sampled_cards"] += len(cids)

        if not args.no_frontend and math_samples:
            fe_issues, fe_error = run_frontend_checks(math_samples)
            if fe_error:
                issues.warn("frontend:skipped", fe_error)
            for issue in fe_issues:
                issues.fail(issue.get("check", "frontend"), issue.get("detail", ""))

        known = load_known_issues()
        for issue in issues.items:
            if issue["severity"] != "fail":
                continue
            reason = known_reason(known, package_path.name, issue["check"])
            if reason:
                issue["severity"] = "warn"
                issue["known"] = True
                issue["reason"] = reason

        result["issues"] = issues.items
        result["status"] = "FAIL" if any(i["severity"] == "fail" for i in issues.items) else "PASS"
        return result
    finally:
        try:
            col.close()
        except Exception:
            pass
        if not args.keep:
            shutil.rmtree(work_dir, ignore_errors=True)
        elif args.keep:
            result["notes_list"].append(f"临时目录保留：{collection_dir}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    ensure_anki_runtime()

    parser = argparse.ArgumentParser(description="Anki Studio 真实 .apkg 显示兼容性测试")
    parser.add_argument("--dir", default=None, help="apkg 目录（默认 $ANKI_STUDIO_APKG_DIR 或 ~/Downloads）")
    parser.add_argument("--only", default=None, help="只跑文件名包含该子串的卡组")
    parser.add_argument("--all", action="store_true", help="跑目录下全部 .apkg（忽略 decks.json 清单）")
    parser.add_argument("--list", action="store_true", help="只列出将要测试的卡组")
    parser.add_argument("--samples-per-notetype", type=int, default=DEFAULT_SAMPLES_PER_NOTETYPE)
    parser.add_argument("--max-cards", type=int, default=DEFAULT_MAX_CARDS_PER_DECK)
    parser.add_argument("--no-frontend", action="store_true", help="跳过 Node 前端渲染检查")
    parser.add_argument("--keep", action="store_true", help="保留临时 collection")
    parser.add_argument("--json", default=None, help="把完整报告写到该 JSON 文件")
    args = parser.parse_args()

    apkg_dir = Path(args.dir).expanduser().resolve() if args.dir else _default_apkg_dir()
    manifest = load_manifest()
    files, missing = discover(apkg_dir, manifest, args.all, args.only)

    print(f"{PROGRESS_PREFIX} 卡组目录：{apkg_dir}")
    print(f"{PROGRESS_PREFIX} 待测卡组：{len(files)} 个")
    for name in missing:
        print(f"{PROGRESS_PREFIX} SKIP 清单里的卡组未找到：{name}")

    if args.list:
        for path in files:
            print(f"  - {path.name} ({path.stat().st_size / 1e6:.1f} MB)")
        return 0

    if not files:
        print(f"{PROGRESS_PREFIX} 没有找到可测试的 .apkg（用 --dir 指定目录）")
        return 0

    reports: list[dict] = []
    failures = 0
    started = time.time()
    for index, path in enumerate(files, 1):
        print(f"\n{PROGRESS_PREFIX} [{index}/{len(files)}] {path.name} ...", flush=True)
        report = test_deck(path, args)
        reports.append(report)
        fails = [i for i in report["issues"] if i["severity"] == "fail"]
        warns = [i for i in report["issues"] if i["severity"] == "warn"]
        if report["status"] == "FAIL":
            failures += 1
        print(
            f"  {report['status']} | notes={report['notes']} cards={report['cards']} "
            f"notetypes={report['notetypes']} sampled={report['sampled_cards']} "
            f"import={report['import_seconds']}s"
        )
        for issue in fails[:10]:
            print(f"    [FAIL] {issue['check']}: {issue['detail']}")
        if len(fails) > 10:
            print(f"    ... 另有 {len(fails) - 10} 条失败")
        for issue in warns[:5]:
            print(f"    [WARN] {issue['check']}: {issue['detail']}")

    elapsed = time.time() - started
    print(f"\n{PROGRESS_PREFIX} ===== 汇总 =====")
    print(f"{PROGRESS_PREFIX} {len(reports)} 个卡组，{failures} 个失败，用时 {elapsed:.1f}s")
    if failures:
        print(f"{PROGRESS_PREFIX} 失败卡组：{', '.join(r['deck'] for r in reports if r['status'] == 'FAIL')}")

    if args.json:
        Path(args.json).write_text(
            json.dumps(
                {
                    "apkg_dir": str(apkg_dir),
                    "elapsed_seconds": round(elapsed, 1),
                    "reports": reports,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"{PROGRESS_PREFIX} 报告已写入 {args.json}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
