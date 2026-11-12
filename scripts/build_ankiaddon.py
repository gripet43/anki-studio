#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anki Studio — Standard .ankiaddon Packaging Script (Part 3 Task 6)
1. Optionally builds the React/Vite frontend into `web/`
2. Packages strictly the runtime whitelist into `anki_modern_os.ankiaddon` (ZIP archive):
   - `__init__.py`
   - `manifest.json`
   - `config.json`
   - `config.md`
   - `bridge/*.py`
   - `web/**`
3. Strictly excludes `node_modules/`, `frontend/`, `tests/`, `scripts/`, `__pycache__/`, `.git/`, `.DS_Store`, `meta.json`.
"""

import json
import os
import subprocess
import sys
import time
import zipfile
from pathlib import Path

ADDON_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ADDON_ROOT / "frontend"
OUTPUT_ARCHIVE = ADDON_ROOT / "anki_modern_os.ankiaddon"

TOP_LEVEL_FILES = [
    "__init__.py",
    "manifest.json",
    "config.json",
    "config.md",
]

# Runtime state that must never ship inside a published .ankiaddon: these keys
# carry real card text, card IDs and the user's study history.
PRIVATE_CONFIG_KEYS = {
    "last_rescue_receipt",
    "rescue_history",
    "vacation_state",
    "vacation_history",
    "vacation_frozen_dates",
    "custom_nickname",
    "safety_ticket",
    "last_sync_checked_map",
}

EXCLUDED_NAMES = {
    "__pycache__",
    ".DS_Store",
    ".git",
    "node_modules",
    "frontend",
    "tests",
    "scripts",
    "meta.json",
}


def run_frontend_build() -> None:
    if not (FRONTEND_DIR / "package.json").exists():
        return
    env = os.environ.copy()
    extra_paths = ["/opt/homebrew/bin", "/usr/local/bin"]
    env["PATH"] = ":".join(extra_paths) + ":" + env.get("PATH", "")
    print("[build_ankiaddon] Running Vite production build...")
    subprocess.run(
        ["npm", "run", "build"],
        cwd=str(FRONTEND_DIR),
        env=env,
        check=True,
    )


def build_manifest_payload() -> dict:
    """Load manifest.json and stamp the fields that must be fresh per build.

    两个曾经真实踩过的坑，在这里堵死：

    1. ``mod`` 忘记刷新 —— AnkiWeb 靠 ``mod`` 判断「有没有新版本」，停在旧值
       等于推不动更新。所以打包时无条件覆盖成当前时间戳，源码里的值只作占位。
    2. ``min_point_version`` 写小 —— Anki 的兼容判断是
       ``if int_version() < min_point_version: 不兼容``，而 ``int_version()``
       是 YYMMDD 形式的整数（Anki 26.9.4 → 260904）。历史上这里写过 ``26``，
       等价于宣称「兼容一切版本包括 2.1.x」，老版本用户装上必崩。低于 200000
       的一律视为笔误直接拒绝打包。
    """
    manifest_path = ADDON_ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    min_ver = manifest.get("min_point_version") or 0
    if not isinstance(min_ver, int) or min_ver < 200000:
        raise ValueError(
            f"manifest.json 的 min_point_version={min_ver!r} 不合法。"
            "该字段要与 aqt.addons 的 int_version() 同口径（YYMMDD 整数，"
            "例如 Anki 26.9.4 -> 260904），不是 '26' 这种大版本号。"
        )
    if not str(manifest.get("human_version") or "").strip():
        raise ValueError(
            "manifest.json 缺少 human_version。Anki 读的是这个字段，"
            "它没写的话插件列表里不显示版本号（'version' 字段 Anki 并不读）。"
        )

    manifest["mod"] = int(time.time())
    return manifest


def create_ankiaddon_package() -> Path:
    if OUTPUT_ARCHIVE.exists():
        OUTPUT_ARCHIVE.unlink()

    manifest = build_manifest_payload()
    print(
        f"[build_ankiaddon] manifest: v{manifest.get('human_version')} "
        f"mod={manifest['mod']} min_point_version={manifest['min_point_version']}"
    )

    included_files = []

    with zipfile.ZipFile(OUTPUT_ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. Top-level files (must sit directly at root of the .ankiaddon zip)
        for filename in TOP_LEVEL_FILES:
            filepath = ADDON_ROOT / filename
            if not filepath.exists():
                raise FileNotFoundError(f"Required top-level file missing: {filepath}")
            if filename == "manifest.json":
                zf.writestr(
                    filename,
                    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                )
            elif filename == "config.json":
                # config.json doubles as the add-on's default/schema template.
                # Ship a sanitized copy so private study data never leaks.
                # 源码仓库里的 config.json 已不入库（含真实昵称/回执/休假记录），
                # 优先读 config.default.json 这份干净模板。
                template = ADDON_ROOT / "config.default.json"
                source = template if template.exists() else filepath
                raw = json.loads(source.read_text(encoding="utf-8"))
                for key in PRIVATE_CONFIG_KEYS:
                    raw.pop(key, None)
                zf.writestr(filename, json.dumps(raw, ensure_ascii=False, indent=2))
            else:
                zf.write(filepath, arcname=filename)
            included_files.append(filename)

        # 2. bridge/*.py
        bridge_dir = ADDON_ROOT / "bridge"
        for py_file in sorted(bridge_dir.glob("*.py")):
            if py_file.name in EXCLUDED_NAMES:
                continue
            arcname = f"bridge/{py_file.name}"
            zf.write(py_file, arcname=arcname)
            included_files.append(arcname)

        # 3. web/**
        web_dir = ADDON_ROOT / "web"
        if not (web_dir / "index.html").exists():
            raise FileNotFoundError("web/index.html is missing. Run frontend build first.")
        for file_path in sorted(web_dir.rglob("*")):
            if file_path.is_dir():
                continue
            rel = file_path.relative_to(ADDON_ROOT)
            # Exclude on the *relative* path: absolute .parts made any parent
            # folder named "frontend"/"tests"/"scripts" silently drop every
            # web asset and produce a package with no UI at all.
            if any(part in EXCLUDED_NAMES or part.endswith(".pyc") for part in rel.parts):
                continue
            rel_path = rel.as_posix()
            zf.write(file_path, arcname=rel_path)
            included_files.append(rel_path)

    if "web/index.html" not in included_files:
        raise RuntimeError("Packaged bundle is missing web/index.html; refusing to emit a broken add-on")

    print(f"[build_ankiaddon] Packaged {len(included_files)} runtime files -> {OUTPUT_ARCHIVE}")
    return OUTPUT_ARCHIVE


if __name__ == "__main__":
    if "--skip-build" not in sys.argv:
        run_frontend_build()
    create_ankiaddon_package()
