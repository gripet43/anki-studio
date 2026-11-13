# -*- coding: utf-8 -*-
"""``bridge/compat.py`` 的运行时兼容性自检测试。

这些用例锁的是「补丁静默失效」这条最容易骗过所有人的失败路径：

1. 版本号必须按 Anki 的 ``int_version()`` 口径换算（``26.09.4 -> 260904``），
   写小一个数量级就等于宣称兼容 2.1.x，旧版用户装上必崩。
2. 任一必需补丁/钩子没生效，健康报告必须是 ``degraded`` 且点名是哪一条，
   不能只留一个 ``ok``。
3. ``get_patch_health`` IPC action 必须能在没有 Anki 运行时的情况下返回
   结构化结果，而不是把 exception 抛给前端。

这里全部使用注入的假对象，不导入 ``aqt``。
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from _addon_bootstrap import ADDON_ROOT, ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os.bridge.compat import (  # noqa: E402
    HOOK_SPECS,
    MIN_POINT_VERSION,
    PATCH_SPECS,
    collect_health,
    format_health_summary,
    is_version_supported,
    parse_point_version,
    resolve_anki_version,
)
from anki_modern_os.bridge.router import BridgeRouter  # noqa: E402


class FakeOwner:
    """Stands in for mw / ProgressManager / aqt.utils / aqt.sync."""

    def __init__(self, **flags):
        for name, value in flags.items():
            setattr(self, name, value)


class FakeHost:
    """All lifecycle callbacks referenced by HOOK_SPECS must exist."""

    def __init__(self, webview=None, visible=False):
        self.webview = webview
        self.is_modern_visible = visible

    def _on_js_message(self, *args):
        pass

    def _on_main_window_init(self):
        pass

    def _on_profile_did_open(self):
        pass

    def _on_sync_will_start(self):
        pass

    def _on_sync_did_finish(self):
        pass

    def _on_operation_did_execute(self, *args):
        pass

    def _on_state_did_reset(self, *args):
        pass

    def _on_top_toolbar_init_links(self, *args):
        pass


def make_hooks(host: FakeHost, *, skip=()):
    """Build a gui_hooks double with every HOOK_SPECS callback registered."""

    class FakeHooks:
        pass

    hooks = FakeHooks()
    for spec in HOOK_SPECS:
        if spec["attr"] in skip:
            setattr(hooks, spec["attr"], [])
        else:
            setattr(hooks, spec["attr"], [getattr(host, spec["method"])])
    return hooks


def make_owners(*, patch_ok=True, skip=()):
    """Build the four patch owners; `skip` drops specific flag names."""

    def owner_for(owner_key):
        selected = {}
        for spec in PATCH_SPECS:
            if spec["owner"] != owner_key:
                continue
            selected[spec["flag"]] = patch_ok and spec["flag"] not in skip
        return FakeOwner(**selected)

    return {
        "mw": owner_for("mw"),
        "progress": owner_for("progress"),
        "utils": owner_for("utils"),
        "sync": owner_for("sync"),
    }


def healthy_health(**overrides):
    host = overrides.pop("host", None) or FakeHost(webview=object(), visible=True)
    hooks = overrides.pop("hooks", None) or make_hooks(host)
    owners = overrides.pop("owners", None) or make_owners()
    return collect_health(
        mw=owners["mw"],
        progress_manager=owners["progress"],
        utils_module=owners["utils"],
        sync_module=owners["sync"],
        gui_hooks=hooks,
        host=host,
        **overrides,
    )


class TestVersionParsing(unittest.TestCase):
    def test_point_version_matches_anki_int_version(self):
        cases = {
            "26.09.4": 260904,
            "26.9.4": 260904,
            "2.1.66": 20166,
            "26.10.0": 261000,
            "26.9": 260900,
            "Anki 26.09.4 (c06370ff)": 260904,
        }
        for raw, expected in cases.items():
            self.assertEqual(parse_point_version(raw), expected, raw)

    def test_unparseable_versions_return_none(self):
        for raw in (None, "", "   ", "abc", "v", "26", "x.y.z"):
            self.assertIsNone(parse_point_version(raw), repr(raw))

    def test_support_boundary(self):
        self.assertIs(True, is_version_supported("26.09.4"))
        self.assertIs(True, is_version_supported("26.10.0"))
        self.assertIs(False, is_version_supported("26.09.3"))
        self.assertIs(False, is_version_supported("2.1.66"))
        self.assertIsNone(is_version_supported("unknown"))
        self.assertIs(True, is_version_supported("26.9.4", minimum=260000))

    def test_min_point_version_matches_manifest(self):
        manifest = json.loads((ADDON_ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(
            manifest["min_point_version"],
            MIN_POINT_VERSION,
            "bridge/compat.py 的 MIN_POINT_VERSION 必须与 manifest.json 同步",
        )


class TestRegistryShape(unittest.TestCase):
    def test_patch_and_hook_specs_are_well_formed(self):
        self.assertEqual(len(PATCH_SPECS), 4)
        self.assertEqual(len(HOOK_SPECS), 8)
        self.assertEqual(len({s["id"] for s in PATCH_SPECS}), len(PATCH_SPECS))
        self.assertEqual(len({s["id"] for s in HOOK_SPECS}), len(HOOK_SPECS))
        for spec in PATCH_SPECS:
            self.assertIn(spec["owner"], {"mw", "progress", "utils", "sync"})
            self.assertTrue(spec["flag"].startswith("_anki_modern"))
            self.assertTrue(spec["label"])
            self.assertIn("required", spec)
        for spec in HOOK_SPECS:
            self.assertTrue(spec["attr"])
            self.assertTrue(spec["method"].startswith("_on_"))
            self.assertIn("required", spec)

    def test_every_hook_method_exists_on_the_host(self):
        host = FakeHost()
        for spec in HOOK_SPECS:
            self.assertTrue(
                callable(getattr(host, spec["method"], None)),
                "HOOK_SPECS 引用了宿主上不存在的方法 %s" % spec["method"],
            )


class TestVersionResolution(unittest.TestCase):
    def test_resolve_never_raises_and_always_returns_a_string(self):
        # `anki.buildinfo` is the primary source when running inside Anki, so the
        # exact value is environment-dependent; the contract under test is only
        # "never raises, always returns a string".
        self.assertIsInstance(resolve_anki_version(None), str)

        class FakeApp:
            def applicationVersion(self):
                return "26.09.4"

        class FakeMw:
            app = FakeApp()

        self.assertTrue(resolve_anki_version(FakeMw()).strip())

        class ExplodingApp:
            def applicationVersion(self):
                raise RuntimeError("qt gone")

        class ExplodingMw:
            app = ExplodingApp()

        self.assertIsInstance(resolve_anki_version(ExplodingMw()), str)


class TestHealthAggregation(unittest.TestCase):
    def test_healthy_runtime_reports_ok_with_full_counts(self):
        report = healthy_health(version_raw="26.09.4")
        self.assertEqual(report["state"], "ok")
        self.assertEqual(report["warnings"], [])
        self.assertEqual(report["summary"]["patches"], [4, 4])
        self.assertEqual(report["summary"]["hooks"], [8, 8])
        self.assertEqual(report["ankiVersion"]["point"], 260904)
        self.assertIs(report["ankiVersion"]["supported"], True)
        self.assertIs(report["ankiVersion"]["known"], True)
        self.assertTrue(report["webview"]["mounted"])
        self.assertTrue(report["webview"]["visible"])

    def test_every_patch_entry_is_explained(self):
        report = healthy_health(version_raw="26.09.4")
        for entry in report["patches"]:
            self.assertTrue(entry["detail"])
            self.assertTrue(entry["label"])
        for entry in report["hooks"]:
            self.assertTrue(entry["detail"])

    def test_failed_patch_degrades_and_names_the_patch(self):
        owners = make_owners(skip={"_anki_modern_prefs_patched"})
        report = healthy_health(owners=owners, version_raw="26.09.4")
        self.assertEqual(report["state"], "degraded")
        failed = [p for p in report["patches"] if not p["ok"]]
        self.assertEqual([p["id"] for p in failed], ["preferences"])
        self.assertTrue(any("偏好设置接管" in w for w in report["warnings"]))

    def test_unregistered_required_hook_degrades(self):
        host = FakeHost(webview=object(), visible=True)
        hooks = make_hooks(host, skip={"sync_did_finish"})
        report = healthy_health(host=host, hooks=hooks, version_raw="26.09.4")
        self.assertEqual(report["state"], "degraded")
        failed = [h for h in report["hooks"] if not h["ok"]]
        self.assertEqual([h["id"] for h in failed], ["sync-finish"])
        self.assertTrue(any("同步完成事件" in w for w in report["warnings"]))

    def test_missing_optional_hook_is_reported_but_not_degrading(self):
        host = FakeHost(webview=object(), visible=True)
        hooks = make_hooks(host, skip={"top_toolbar_did_init_links"})
        report = healthy_health(host=host, hooks=hooks, version_raw="26.09.4")
        self.assertEqual(report["state"], "ok")
        toolbar = [h for h in report["hooks"] if h["id"] == "toolbar-link"][0]
        self.assertFalse(toolbar["ok"])
        self.assertFalse(toolbar["required"])

    def test_unknown_version_degrades(self):
        report = healthy_health(version_raw="")
        self.assertEqual(report["state"], "degraded")
        self.assertIsNone(report["ankiVersion"]["point"])
        self.assertIs(report["ankiVersion"]["known"], False)
        self.assertTrue(any("无法识别 Anki 版本" in w for w in report["warnings"]))

    def test_too_old_version_degrades(self):
        report = healthy_health(version_raw="26.09.3")
        self.assertEqual(report["state"], "degraded")
        self.assertIs(report["ankiVersion"]["supported"], False)
        self.assertTrue(any("低于最低要求" in w for w in report["warnings"]))

    def test_no_gui_hooks_yields_no_hook_section_but_no_crash(self):
        # Outside the Anki runtime none of the patched modules are reachable, so
        # the report must degrade (not pretend "ok") while staying structured.
        report = collect_health(version_raw="26.09.4")
        self.assertEqual(report["hooks"], [])
        self.assertEqual(report["state"], "degraded")
        self.assertEqual(len(report["warnings"]), len(PATCH_SPECS))

    def test_summary_mentions_counts_version_and_warnings(self):
        text = format_health_summary(healthy_health(version_raw="26.09.4"))
        self.assertIn("patch health: 4/4 patches, 8/8 hooks", text)
        self.assertIn("260904", text)

        degraded = format_health_summary(
            healthy_health(owners=make_owners(patch_ok=False), version_raw="26.09.4")
        )
        self.assertIn("!", degraded)
        self.assertIn("未生效", degraded)


class TestRouterAction(unittest.TestCase):
    def _call(self, router, action="get_patch_health"):
        raw = router.handle_pycmd(
            "modern_anki:" + json.dumps({"action": action, "data": {}})
        )
        self.assertIsNotNone(raw)
        return json.loads(raw)

    def _router(self, **kwargs):
        return BridgeRouter(
            col_getter=lambda: None,
            mw_getter=lambda: None,
            **kwargs,
        )

    def test_action_returns_injected_health_report(self):
        payload = {"state": "degraded", "warnings": ["boom"], "patches": []}
        router = self._router(health_getter=lambda: payload)
        reply = self._call(router)
        self.assertEqual(reply["status"], "success")
        self.assertEqual(reply["data"], payload)

    def test_default_router_returns_empty_dict(self):
        reply = self._call(self._router())
        self.assertEqual(reply["status"], "success")
        self.assertEqual(reply["data"], {})

    def test_failing_health_getter_does_not_break_the_ipc_response(self):
        def boom():
            raise RuntimeError("nope")

        router = self._router(health_getter=boom)
        reply = self._call(router)
        self.assertEqual(reply["status"], "success")
        self.assertEqual(reply["data"]["state"], "unknown")
        self.assertIn("nope", reply["data"]["error"])


class TestHostIntegrationOutsideAnki(unittest.TestCase):
    def test_refresh_patch_health_never_raises_without_aqt(self):
        from anki_modern_os import AnkiModernHost

        host = AnkiModernHost()
        report = host.refresh_patch_health(log=False)
        self.assertIsInstance(report, dict)
        self.assertIn("state", report)
        # Outside the Anki runtime nothing can be patched, so a healthy report
        # would be a lie; it must degrade instead of silently claiming success.
        self.assertIn(report["state"], {"degraded", "unknown"})
        self.assertEqual(host.patch_health, report)


if __name__ == "__main__":
    unittest.main()
