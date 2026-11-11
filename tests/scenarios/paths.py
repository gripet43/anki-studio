"""跨平台路径探测。

测试系统原先写死了 macOS 的两个路径：Anki 安装目录与真实数据目录。换到
Windows / Linux 就完全跑不起来。这里统一收口，优先读环境变量，其次按平台
探测，最后给出可操作的报错。

可覆盖的环境变量：

- ``ANKI_APP_PACKAGES``：Anki 自带 Python 包目录（必须含 ``anki/`` 子包）
- ``ANKI_BIN``：Anki 可执行文件
- ``ANKI_REAL_BASE``：真实 Anki 数据根目录（默认按平台推断）
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

HOME = Path.home()

IS_MAC = sys.platform == "darwin"
IS_WIN = sys.platform.startswith("win")


def _pick(candidates: list[Path | None], *, check) -> Path | None:
    for candidate in candidates:
        if not candidate:
            continue
        try:
            if check(candidate):
                return candidate
        except OSError:
            continue
    return None


def anki_app_packages() -> Path | None:
    """定位 Anki 自带的 ``app_packages``（里面有 ``anki`` 包）。"""
    env = os.environ.get("ANKI_APP_PACKAGES")
    candidates: list[Path | None] = [Path(env) if env else None]

    if IS_MAC:
        candidates.append(Path("/Applications/Anki.app/Contents/Resources/app_packages"))
    elif IS_WIN:
        local = os.environ.get("LOCALAPPDATA")
        roots = []
        if local:
            roots.append(Path(local) / "Programs" / "Anki")
        for key in ("PROGRAMFILES", "PROGRAMFILES(X86)"):
            value = os.environ.get(key)
            if value:
                roots.append(Path(value) / "Anki")
        for root in roots:
            # PyInstaller 打包版可能把依赖放在 _internal 下
            candidates.append(root / "app_packages")
            candidates.append(root / "_internal" / "app_packages")
            candidates.append(root)
    else:
        candidates.extend(
            [
                Path("/usr/share/anki/app_packages"),
                Path("/usr/lib/anki/app_packages"),
                Path("/opt/anki/app_packages"),
            ]
        )

    return _pick(candidates, check=lambda p: (p / "anki").is_dir())


def anki_executable() -> Path | None:
    """定位 Anki 可执行文件。"""
    env = os.environ.get("ANKI_BIN")
    candidates: list[Path | None] = [Path(env) if env else None]

    if IS_MAC:
        candidates.append(Path("/Applications/Anki.app/Contents/MacOS/Anki"))
    elif IS_WIN:
        local = os.environ.get("LOCALAPPDATA")
        if local:
            candidates.append(Path(local) / "Programs" / "Anki" / "anki.exe")
        for key in ("PROGRAMFILES", "PROGRAMFILES(X86)"):
            value = os.environ.get(key)
            if value:
                candidates.append(Path(value) / "Anki" / "anki.exe")
    else:
        found = shutil.which("anki")
        candidates.append(Path(found) if found else None)

    return _pick(candidates, check=lambda p: p.exists())


def real_anki_base() -> Path:
    """真实 Anki 数据根目录（只读参考，永不写入）。"""
    env = os.environ.get("ANKI_REAL_BASE")
    if env:
        return Path(env).expanduser().resolve()
    if IS_MAC:
        return (HOME / "Library" / "Application Support" / "Anki2").resolve()
    if IS_WIN:
        appdata = os.environ.get("APPDATA")
        base = Path(appdata) if appdata else HOME / "AppData" / "Roaming"
        return (base / "Anki2").resolve()
    return (HOME / ".local" / "share" / "Anki2").resolve()


def require_app_packages() -> Path:
    """拿不到 Anki 包目录时，抛出带解决建议的错误。"""
    found = anki_app_packages()
    if found:
        return found
    raise RuntimeError(
        "找不到 Anki 自带的 Python 包目录。\n"
        "  macOS  : 默认 /Applications/Anki.app/Contents/Resources/app_packages\n"
        "  Windows: 默认 %LOCALAPPDATA%\\Programs\\Anki\\app_packages\n"
        "  其他   : 请设置环境变量 ANKI_APP_PACKAGES 指向含 anki/ 子包的目录。"
    )


def require_executable() -> Path:
    found = anki_executable()
    if found:
        return found
    raise RuntimeError(
        "找不到 Anki 可执行文件。请设置环境变量 ANKI_BIN 指向 Anki 主程序。"
    )
