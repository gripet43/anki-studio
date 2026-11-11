#!/usr/bin/env python3
"""启动隔离沙盒（跨平台）。

    python3 run.py --list        列出可用场景
    python3 run.py exam          同步插件 → 备份现场 → 切换 → 启动
    python3 run.py --sync        只同步插件，不启动
    python3 run.py --status      查看沙盒状态

这个脚本永远不会在缺少 ``-b`` 的情况下启动 Anki。真实数据目录只作为插件
源码的读取来源，不作为写入目标。Windows 上直接 ``python run.py exam``；
macOS / Linux 用 ``./run.sh exam``（薄包装，内部调本文件）。
"""

from __future__ import annotations

import json
import pickle
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from guard import REAL_ANKI_ROOT, SANDBOX_ROOT, ensure_dir  # noqa: E402
from paths import require_executable  # noqa: E402

PROFILE = "测试账户"
SCRIPT_DIR = Path(__file__).resolve().parent
DEV_DIR = SCRIPT_DIR.parent.parent

BASE = SANDBOX_ROOT / "base"
LIB = SANDBOX_ROOT / "lib"
STATE = SANDBOX_ROOT / "state"
ADDON_DST = BASE / "addons21" / "anki_modern_os"

#: 运行时私有配置字段，绝不带进沙盒
PRIVATE_CONFIG_KEYS = (
    "last_rescue_receipt",
    "rescue_history",
    "vacation_state",
    "vacation_history",
    "vacation_frozen_dates",
    "custom_nickname",
)


def die(message: str) -> "NoReturn":
    print(f"错误：{message}", file=sys.stderr)
    raise SystemExit(1)


def info(message: str = "") -> None:
    print(message)


def human_size(path: Path) -> str:
    try:
        size = path.stat().st_size if path.is_file() else sum(
            f.stat().st_size for f in path.rglob("*") if f.is_file()
        )
    except OSError:
        return "?"
    for unit in ("B", "K", "M", "G"):
        if size < 1024 or unit == "G":
            return f"{size:.0f}{unit}" if unit == "B" else f"{size:.1f}{unit}"
        size /= 1024
    return "?"


# ---------------------------------------------------------------------------
# 前置校验
# ---------------------------------------------------------------------------

def preflight() -> Path:
    anki = require_executable()
    if REAL_ANKI_ROOT in SANDBOX_ROOT.parents or SANDBOX_ROOT == REAL_ANKI_ROOT:
        die("沙盒路径落在真实数据目录内，拒绝启动")
    if not DEV_DIR.is_dir():
        die(f"找不到插件源码目录：{DEV_DIR}")
    for path in (BASE / "addons21", LIB, STATE):
        ensure_dir(path)
    return anki


# ---------------------------------------------------------------------------
# 同步插件副本
# ---------------------------------------------------------------------------

def _ignore_factory(root: Path):
    """按相对路径精确排除，避免误伤 web/ 等构建产物。"""
    excluded = {
        "config.json",
        "meta.json",
        ".git",
        "tests",
        "node_modules",
        "frontend/node_modules",
        "frontend/dist",
    }

    def inner(current: str, names: list[str]) -> set[str]:
        rel = Path(current).relative_to(root)
        skipped = set()
        for name in names:
            if name == "__pycache__" or name.endswith((".pyc", ".ankiaddon")):
                skipped.add(name)
                continue
            if (rel / name).as_posix() in excluded:
                skipped.add(name)
        return skipped

    return inner


def sync_addon() -> None:
    info(f"同步插件副本 → {ADDON_DST}")

    # 沙盒自己的配置要保留，不能被源码副本覆盖
    existing_config = None
    config_path = ADDON_DST / "config.json"
    if config_path.exists():
        existing_config = config_path.read_bytes()

    ensure_dir(ADDON_DST)
    # 增量覆盖复制而非整目录 rmtree，避免在 Windows 上一次性删除数十个文件触发批量删除拦截或文件句柄锁
    shutil.copytree(DEV_DIR, ADDON_DST, ignore=_ignore_factory(DEV_DIR), dirs_exist_ok=True)

    if existing_config is not None:
        config_path.write_bytes(existing_config)
    else:
        # 首次同步写一份洁净模板：优先用仓库里的 config.default.json
        template = DEV_DIR / "config.default.json"
        source = template if template.exists() else DEV_DIR / "config.json"
        data: dict = {}
        if source.exists():
            try:
                data = json.loads(source.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                data = {}
        for key in PRIVATE_CONFIG_KEYS:
            data.pop(key, None)
        config_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        info("  已写入洁净的 config.json 模板（已剥离运行时私有字段）")

    info(f"  完成（{human_size(ADDON_DST)}）")


# ---------------------------------------------------------------------------
# 子命令
# ---------------------------------------------------------------------------

def cmd_list() -> None:
    info(f"沙盒：{SANDBOX_ROOT}")
    info()
    scenarios = sorted(LIB.glob("*.anki2"))
    if not scenarios:
        info("  还没有场景，先运行：python3 tests/scenarios/build.py --core")
        return
    active = ""
    marker_file = SANDBOX_ROOT / "active"
    if marker_file.exists():
        active = marker_file.read_text(encoding="utf-8").strip()
    for path in scenarios:
        key = path.stem
        prefix = "→ " if key == active else "  "
        info(f"{prefix}{key:<10} {human_size(path)}")


def cmd_status() -> None:
    anki = require_executable()
    info(f"沙盒根 : {SANDBOX_ROOT}")
    info(f"base   : {BASE}")
    info(f"profile: {PROFILE}")
    marker = SANDBOX_ROOT / "active"
    info(f"当前场景: {marker.read_text(encoding='utf-8').strip() if marker.exists() else '（未激活）'}")
    collection = BASE / PROFILE / "collection.anki2"
    if collection.exists():
        info(f"库大小 : {human_size(collection)}")
    if ADDON_DST.exists():
        info(f"插件副本: {human_size(ADDON_DST)}  最近同步 {time.strftime('%H:%M:%S', time.localtime(ADDON_DST.stat().st_mtime))}")
    else:
        info("插件副本: 尚未同步")
    info(f"Anki   : {anki}")
    info()
    info(f"真实数据目录（只读，永不写入）：{REAL_ANKI_ROOT}")


def ensure_profile() -> None:
    profile_dir = BASE / PROFILE
    ensure_dir(profile_dir / "collection.media")
    prefs = BASE / "prefs21.db"
    now_sec = int(time.time())

    # Anki 26 ProfileManager.loadMeta() 强依赖 profiles 表中同时存在 `_global` 与目标 profile。
    # 若缺失 `_global` 行（或缺少 ver / firstRun / defaultLang 等关键键），Anki 会将 prefs21.db
    # 判定为损坏并弹窗重建，随后弹出首次启动语言选择框。
    global_meta = {
        "ver": 0,
        "updates": False,
        "created": now_sec,
        "id": 450351942741429716,
        "lastMsg": 0,
        "suppressUpdate": True,
        "firstRun": False,
        "defaultLang": "zh_CN",
        "last_run_version": 260904,
        "last_loaded_profile_name": PROFILE,
        "last_addon_update_check": now_sec,
        "answer_keys": {1: "1", 2: "2", 3: "3", 4: "4"},
        "browser_layout": "auto",
        "addTagsCollapsed": False,
        "browserTagsCollapsed": True,
        "reduce_motion": 0,
        "theme": 1,
    }
    profile_meta = {
        "numBackups": 0,
        "lastOptimize": now_sec,
        "syncMedia": False,
        "autoSync": False,
        "allowHTML": False,
        "importMode": 1,
        "lastColour": "#00f",
        "stripHTML": True,
        "deleteMedia": False,
        "autoSyncMediaMinutes": 0,
        "currentSyncUrl": None,
        "customSyncUrl": "",
        "networkTimeout": 30,
        "hostNum": None,
        "lastTextColor": "#000000",
        "allowedUrlSchemes": ["file"],
        "syncKey": None,
        "syncUser": None,
    }

    is_new = not prefs.exists()
    conn = sqlite3.connect(prefs)
    try:
        conn.execute("create table if not exists profiles (name text primary key, data blob)")
        has_global = conn.execute(
            "select 1 from profiles where name = '_global'"
        ).fetchone()
        has_profile = conn.execute(
            "select 1 from profiles where name = ?", (PROFILE,)
        ).fetchone()
        if not has_global:
            conn.execute(
                "insert or replace into profiles (name, data) values ('_global', ?)",
                (pickle.dumps(global_meta, protocol=4),),
            )
        if not has_profile:
            conn.execute(
                "insert or replace into profiles (name, data) values (?, ?)",
                (PROFILE, pickle.dumps(profile_meta, protocol=4)),
            )
        conn.commit()
        if is_new or not has_global or not has_profile:
            info("初始化沙盒 profile 元数据（含 _global 与完整 Anki 26 配置结构）")
    finally:
        conn.close()


def cmd_run(key: str) -> None:
    src = LIB / f"{key}.anki2"
    if not src.exists():
        die(f"场景不存在：{key}（先运行 python3 run.py --list 查看）")

    anki = preflight()
    sync_addon()
    ensure_profile()

    dst = BASE / PROFILE / "collection.anki2"
    if dst.exists():
        marker = SANDBOX_ROOT / "active"
        prev = marker.read_text(encoding="utf-8").strip() if marker.exists() else "unknown"
        backup = STATE / f"{prev}-{time.strftime('%Y%m%d-%H%M%S')}.anki2"
        shutil.copy2(dst, backup)
        info(f"已备份上一现场 → {backup.name}")

    shutil.copy2(src, dst)
    for suffix in ("-wal", "-shm"):
        stale = Path(str(dst) + suffix)
        if stale.exists():
            stale.unlink()

    media_dst = BASE / PROFILE / "collection.media"
    ensure_dir(media_dst)
    for stale_media in list(media_dst.iterdir()):
        if stale_media.is_file() or stale_media.is_symlink():
            stale_media.unlink()
        elif stale_media.is_dir():
            shutil.rmtree(stale_media)
    media_src = LIB / f"{key}.media"
    if media_src.is_dir():
        for item in media_src.iterdir():
            target = media_dst / item.name
            if item.is_dir():
                shutil.copytree(item, target, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)

    (SANDBOX_ROOT / "active").write_text(key, encoding="utf-8")

    info(f"已切换到场景：{key}")
    info(f"启动：{anki.name} -b <沙盒> -p {PROFILE}")
    info()
    # 唯一允许的启动方式：显式 -b 指向沙盒。前台运行，关掉窗口即结束。
    raise SystemExit(subprocess.call([str(anki), "-b", str(BASE), "-p", PROFILE]))


def main() -> None:
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg in ("", "-h", "--help"):
        print(__doc__)
        return
    if arg == "--list":
        cmd_list()
    elif arg == "--sync":
        preflight()
        sync_addon()
        info("插件已同步（未启动）")
    elif arg == "--status":
        cmd_status()
    else:
        cmd_run(arg)


if __name__ == "__main__":
    main()
