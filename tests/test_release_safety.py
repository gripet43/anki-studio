# -*- coding: utf-8 -*-
"""发布前的不变量守卫（Release invariants）。

这些用例锁的不是业务逻辑，而是「上架 AnkiWeb 之前必须为真」的几条硬事实。
每一条都对应一次真实踩过的坑，写在这里是为了让下一位助手在改代码时立刻被拦住，
而不是等用户装上之后才暴露。

1. ``manifest.json`` 的 ``min_point_version`` 必须是 ``YYMMDD`` 整数。
   历史上这里写过 ``26``（想表达 "Anki 26"），而 Anki 的判断是
   ``if int_version() < min_point_version: 不兼容``，``int_version()`` 对
   Anki 26.9.4 返回 ``260904``——写成 26 就等于宣称「兼容所有版本，含 2.1.x」，
   旧版用户装上必然崩溃。
2. ``manifest.json`` 必须有非空 ``human_version``。Anki 读的是这个字段，
   ``version`` 它并不读；缺了插件列表里就不显示版本号。
3. ``bridge/`` 内不得出现绕过官方 API 的写库语句。裸 SQL 改 ``cards.due``
   不会把 ``usn`` 置为 -1、也不更新 ``mod``，Anki 会误判该行「已同步」，
   多设备用户会静默丢失改动。``ANALYZE`` 只刷新统计信息，不在禁止之列。
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ADDON_ROOT = Path(__file__).resolve().parent.parent
BRIDGE_DIR = ADDON_ROOT / "bridge"
MANIFEST_PATH = ADDON_ROOT / "manifest.json"

# 一条语句里出现这些动词，且目标是合集数据表，就说明它在直接改写 Anki 的数据。
MUTATING_SQL = re.compile(r"\b(UPDATE|INSERT|DELETE|REPLACE)\b", re.IGNORECASE)

# 这些写法本身不写行数据，属允许范围。
ALLOWED_SQL_FRAGMENTS = ("ANALYZE",)


class TestManifestForAnkiWeb(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    def test_min_point_version_uses_int_version_scale(self) -> None:
        value = self.manifest.get("min_point_version")
        self.assertIsInstance(value, int, "min_point_version 必须是整数")
        self.assertGreaterEqual(
            value,
            200000,
            f"min_point_version={value} 不像是 int_version() 口径的值。"
            "Anki 26.9.4 对应 260904，不是 26 或 26.09。写成小数字等于宣称兼容所有版本。",
        )

    def test_human_version_present(self) -> None:
        value = str(self.manifest.get("human_version") or "").strip()
        self.assertTrue(
            value,
            "manifest.json 缺少 human_version：Anki 读的是它，缺了插件列表不显示版本号",
        )

    def test_homepage_is_not_placeholder(self) -> None:
        homepage = str(self.manifest.get("homepage") or "")
        self.assertTrue(
            homepage.startswith("http"),
            "homepage 必须是一个真实可访问的地址（AnkiWeb 会把它作为支持链接展示）",
        )
        self.assertNotEqual(
            homepage.rstrip("/"),
            "https://ankiweb.net",
            "homepage 仍是占位值 https://ankiweb.net，用户点进去会回到首页",
        )


class TestNoRawCollectionWrites(unittest.TestCase):
    def test_bridge_does_not_mutate_collection_via_raw_sql(self) -> None:
        offenders = []
        for py_file in sorted(BRIDGE_DIR.glob("*.py")):
            for lineno, line in enumerate(
                py_file.read_text(encoding="utf-8").splitlines(), start=1
            ):
                stripped = line.lstrip()
                # 跳过整行注释：源码里会写明「这里曾有一条 UPDATE ... 已被删除」，
                # 那是解释而不是语句，不能算违规。
                if stripped.startswith("#"):
                    continue
                if "db.execute" not in line and "db.executemany" not in line:
                    continue
                if any(frag in line for frag in ALLOWED_SQL_FRAGMENTS):
                    continue
                if MUTATING_SQL.search(line):
                    offenders.append(f"{py_file.name}:{lineno}: {line.strip()}")

        self.assertEqual(
            offenders,
            [],
            "bridge/ 中出现了绕过官方 API 的写库语句。这类写操作不维护 usn/mod，"
            "会让改动无法同步到其他设备。请改用 col.update_card / col.sched.*。\n"
            + "\n".join(offenders),
        )


class TestProfileSwitchRemount(unittest.TestCase):
    """换用户档案后必须能把界面挂回来。

    `main_window_did_init` 每次启动只触发一次；档案切换会重建主窗口的中央控件，
    原先挂上去的 webview 随之被 Qt 销毁。只订阅前者的后果是：用户切一次档案就
    永久掉回原生界面，而且再也切不回来。这条用例锁住「两个钩子都在」这个事实。
    """

    def test_profile_did_open_hook_is_registered(self) -> None:
        source = (ADDON_ROOT / "__init__.py").read_text(encoding="utf-8")
        self.assertIn(
            "gui_hooks.main_window_did_init.append",
            source,
            "启动挂载钩子 main_window_did_init 不见了",
        )
        self.assertIn(
            "gui_hooks.profile_did_open.append",
            source,
            "缺少 profile_did_open 钩子：换用户档案后现代界面不会重新挂载",
        )


if __name__ == "__main__":
    unittest.main()
