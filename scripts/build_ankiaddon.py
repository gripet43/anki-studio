#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anki Modern OS — Standard .ankiaddon Packaging Script (Part 3 Task 6)
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


def create_ankiaddon_package() -> Path:
    if OUTPUT_ARCHIVE.exists():
        OUTPUT_ARCHIVE.unlink()

    included_files = []

    with zipfile.ZipFile(OUTPUT_ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. Top-level files (must sit directly at root of the .ankiaddon zip)
        for filename in TOP_LEVEL_FILES:
            filepath = ADDON_ROOT / filename
            if not filepath.exists():
                raise FileNotFoundError(f"Required top-level file missing: {filepath}")
            if filename == "config.json":
                # config.json doubles as the add-on's default/schema template.
                # Ship a sanitized copy so private study data never leaks.
                raw = json.loads(filepath.read_text(encoding="utf-8"))
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
