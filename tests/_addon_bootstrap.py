# -*- coding: utf-8 -*-
"""把插件目录登记成固定包名 ``anki_modern_os``，不依赖仓库目录叫什么。

**为什么需要这个文件**

所有测试都写 ``from anki_modern_os.bridge.router import BridgeRouter``，但插件
目录名取决于它是怎么来的：

* 装进 ``addons21/`` 时，目录名就是 Anki 分配的包名 ``anki_modern_os``；
* ``git clone git@github.com:gripet43/anki-studio.git`` 时，目录叫 ``anki-studio``。

旧做法是 ``sys.path.insert(0, ADDON_ROOT.parent)`` 然后直接 import，**等于要求
仓库目录名恰好等于包名**。在干净 clone 上必然是
``ModuleNotFoundError: No module named 'anki_modern_os'``（2026-11-13 Windows
验版第 5 轮实测，报告见 ``tests/reports/windows-20261113-r5.md``）。

**做法**

用 ``importlib`` 从**真实路径**加载 ``__init__.py``，并把包名硬指定成
``anki_modern_os``。这样既与目录名解耦，又和「目录名恰好正确」时的行为完全一致
——``__init__.py`` 里的相对导入（``from .bridge.router import ...``）照常工作，
``from anki_modern_os import AnkiModernHost`` 也照常取得到类。

加载失败时（比如未来 ``__init__.py`` 真的硬依赖 ``aqt``）退回一个只带
``__path__`` 的命名空间替身：子包照样能导入，只有依赖入口符号的用例会红，
而不是整套测试在 collection 阶段就崩掉。
"""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path

#: 插件根目录（``tests/`` 的上一级），与仓库目录名无关。
ADDON_ROOT = Path(__file__).resolve().parent.parent

#: 插件在 Anki 里的固定包名，``addons21/`` 目录名与相对导入都以它为准。
PACKAGE_ALIAS = "anki_modern_os"


def _namespace_shim(root: str) -> types.ModuleType:
    """只提供 ``__path__`` 的空壳包，不执行 ``__init__.py``。"""
    shim = types.ModuleType(PACKAGE_ALIAS)
    shim.__path__ = [root]  # type: ignore[attr-defined]
    shim.__file__ = str(ADDON_ROOT / "__init__.py")
    shim.__doc__ = (
        "anki_modern_os 的测试期命名空间替身（真实 __init__.py 加载失败时使用）。"
    )
    return shim


def ensure_importable() -> Path:
    """让 ``import anki_modern_os.bridge...`` 在任何目录名下都成立。

    幂等：重复调用不会覆盖已注册的模块，因此被多个测试模块先后导入是安全的。
    返回 :data:`ADDON_ROOT`，方便调用方一行拿到路径。
    """
    root = str(ADDON_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)

    if PACKAGE_ALIAS in sys.modules:
        return ADDON_ROOT

    init_file = ADDON_ROOT / "__init__.py"
    if init_file.exists():
        try:
            spec = importlib.util.spec_from_file_location(
                PACKAGE_ALIAS,
                init_file,
                submodule_search_locations=[root],
            )
            if spec is not None and spec.loader is not None:
                module = importlib.util.module_from_spec(spec)
                # 先登记再执行：__init__.py 里的相对导入要靠 sys.modules 找到自己。
                sys.modules[PACKAGE_ALIAS] = module
                try:
                    spec.loader.exec_module(module)
                except BaseException:
                    sys.modules.pop(PACKAGE_ALIAS, None)
                    raise
                return ADDON_ROOT
        except BaseException:
            # 入口文件依赖 aqt / GUI，非 Anki 进程里加载不了 —— 退回命名空间替身。
            pass

    sys.modules[PACKAGE_ALIAS] = _namespace_shim(root)
    return ADDON_ROOT
