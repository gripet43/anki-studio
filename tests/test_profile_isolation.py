"""Tests for per-profile config isolation, legacy migration, and profile switch reset."""

from __future__ import annotations

import copy
import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace

ADDON_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ADDON_ROOT))
sys.path.insert(0, str(ADDON_ROOT / "tests"))

from _addon_bootstrap import ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os import AnkiModernHost  # noqa: E402
from anki_modern_os.bridge.profile_config import (  # noqa: E402
    LEGACY_UNSCOPED_KEY,
    PROFILE_SCOPED_KEYS,
    PROFILE_STATES_KEY,
    read_profile_scoped_config,
    resolve_profile_key,
    write_profile_scoped_config,
)
from anki_modern_os.bridge.router import BridgeRouter  # noqa: E402
from safety_harness import SafetyEnv  # noqa: E402


class _FakeAddonManager:
    def __init__(self, initial: dict | None = None, defaults: dict | None = None):
        self.meta_cfg = copy.deepcopy(initial or {})
        self.defaults = copy.deepcopy(defaults if defaults is not None else {"collapsed_deck_ids": []})
        self.write_count = 0

    def getConfig(self, _name: str) -> dict:
        merged = copy.deepcopy(self.defaults)
        merged.update(copy.deepcopy(self.meta_cfg))
        return merged

    def writeConfig(self, _name: str, cfg: dict) -> None:
        self.meta_cfg = copy.deepcopy(cfg)
        self.write_count += 1


class _FakePM:
    def __init__(self, name: str | None, all_profiles: list[str]):
        self.name = name
        self._profiles = list(all_profiles)

    def profiles(self) -> list[str]:
        return list(self._profiles)


class _FakeCardDB:
    def __init__(self, cids: set[int]):
        self._cids = set(cids)

    def scalar(self, _query: str, *args: int):
        for cid in args:
            if int(cid) in self._cids:
                return 1
        return None


class _FakeColWithIDs:
    def __init__(self, *, cids: set[int] | None = None, deck_ids: set[int] | None = None, model_ids: set[int] | None = None):
        self.db = _FakeCardDB(cids or set())
        self._deck_ids = set(deck_ids or {1})
        self._model_ids = set(model_ids or set())
        self.decks = SimpleNamespace(
            all_names_and_ids=lambda: [SimpleNamespace(id=d) for d in self._deck_ids]
        )
        self.models = SimpleNamespace(
            all_names_and_ids=lambda: [SimpleNamespace(id=m) for m in self._model_ids]
        )


class ProfileConfigUnitTests(unittest.TestCase):
    def test_resolve_profile_key(self):
        self.assertIsNone(resolve_profile_key(None))
        self.assertIsNone(resolve_profile_key(SimpleNamespace(pm=None)))
        self.assertIsNone(resolve_profile_key(SimpleNamespace(pm=_FakePM("  ", []))))
        self.assertEqual(resolve_profile_key(SimpleNamespace(pm=_FakePM("11", ["11"]))), "11")
        self.assertEqual(resolve_profile_key(SimpleNamespace(pm=_FakePM("测试账户", ["11", "测试账户"]))), "测试账户")

    def test_no_repeat_write_from_default_collapsed_deck_ids(self):
        mgr = _FakeAddonManager(initial={"theme": "dark"})
        mw = SimpleNamespace(addonManager=mgr, pm=_FakePM("11", ["11", "测试账户"]), col=None)

        def writer(cfg):
            mgr.writeConfig("anki_modern_os", cfg)

        eff1 = read_profile_scoped_config(mgr.getConfig("anki_modern_os"), mw=mw, raw_writer=writer)
        eff2 = read_profile_scoped_config(mgr.getConfig("anki_modern_os"), mw=mw, raw_writer=writer)
        self.assertEqual(eff1["theme"], "dark")
        self.assertEqual(eff1["collapsed_deck_ids"], [])
        self.assertEqual(eff2["collapsed_deck_ids"], [])
        self.assertEqual(mgr.write_count, 0)

    def test_profile_isolation_and_global_sharing(self):
        mgr = _FakeAddonManager(initial={"theme": "auto", "language": "auto"})

        def writer(cfg):
            mgr.writeConfig("anki_modern_os", cfg)

        mw_11 = SimpleNamespace(addonManager=mgr, pm=_FakePM("11", ["11", "测试账户"]), col=None)
        mw_test = SimpleNamespace(addonManager=mgr, pm=_FakePM("测试账户", ["11", "测试账户"]), col=None)

        # Write profile-specific + global keys in profile "11"
        write_profile_scoped_config(
            mgr.getConfig("anki_modern_os"),
            {
                "theme": "dark",
                "custom_nickname": "耀哥",
                "collapsed_deck_ids": ["123456"],
                "sandbox_notetype_ids": ["7890"],
                "vacation_state": {"active": True, "days": 3, "start_date": "2026-11-15", "end_date": "2026-11-17"},
                "vacation_history": [{"id": "vac-1", "status": "active"}],
                "vacation_frozen_dates": ["2026-11-15"],
                "last_rescue_receipt": {"id": "rescue_1"},
                "rescue_history": [{"id": "rescue_1"}],
                "safety_ticket": {"state": "done"},
                "last_sync_checked_map": {"11": 1700000111000},
            },
            mw=mw_11,
            raw_writer=writer,
        )

        # None of the profile-scoped keys should be written at top level of meta.json
        for k in PROFILE_SCOPED_KEYS:
            self.assertNotIn(k, mgr.meta_cfg)
        self.assertEqual(mgr.meta_cfg["theme"], "dark")

        # Profile "测试账户" must NOT see "11"'s vacation or profile data, but DOES see global theme
        test_cfg = read_profile_scoped_config(mgr.getConfig("anki_modern_os"), mw=mw_test, raw_writer=writer)
        self.assertEqual(test_cfg["theme"], "dark")
        self.assertIsNone(test_cfg.get("vacation_state"))
        self.assertIsNone(test_cfg.get("vacation_history"))
        self.assertIsNone(test_cfg.get("vacation_frozen_dates"))
        self.assertIsNone(test_cfg.get("last_rescue_receipt"))
        self.assertIsNone(test_cfg.get("rescue_history"))
        self.assertIsNone(test_cfg.get("safety_ticket"))
        self.assertIsNone(test_cfg.get("custom_nickname"))
        self.assertEqual(test_cfg["collapsed_deck_ids"], [])
        self.assertIsNone(test_cfg.get("sandbox_notetype_ids"))
        self.assertIsNone(test_cfg.get("last_sync_checked_map"))

        # Profile Chooser (no profile loaded) must also stay isolated
        mw_none = SimpleNamespace(addonManager=mgr, pm=None, col=None)
        none_cfg = read_profile_scoped_config(mgr.getConfig("anki_modern_os"), mw=mw_none, raw_writer=writer)
        self.assertEqual(none_cfg["theme"], "dark")
        self.assertIsNone(none_cfg.get("vacation_state"))

        # Switching back to "11" keeps all of "11"'s state intact
        cfg_11 = read_profile_scoped_config(mgr.getConfig("anki_modern_os"), mw=mw_11, raw_writer=writer)
        self.assertTrue(cfg_11["vacation_state"]["active"])
        self.assertEqual(cfg_11["custom_nickname"], "耀哥")
        self.assertEqual(cfg_11["collapsed_deck_ids"], ["123456"])
        self.assertEqual(cfg_11["sandbox_notetype_ids"], ["7890"])
        self.assertEqual(cfg_11["last_sync_checked_map"], {"11": 1700000111000})

    def test_legacy_flat_migration_quarantines_from_other_profile_and_claims_on_owner(self):
        legacy_meta = {
            "theme": "light",
            "vacation_state": {
                "active": True,
                "days": 2,
                "shifted_cids": [9001, 9002],
                "frozen_deck_limits": {"2001": {"orig_new": 20, "orig_rev": 100}},
            },
            "vacation_frozen_dates": ["2026-11-15"],
            "vacation_history": [{"id": "vac-legacy", "status": "active"}],
            "last_sync_checked_map": {"11": 111000, "测试账户": 222000},
        }
        mgr = _FakeAddonManager(initial=legacy_meta)

        def writer(cfg):
            mgr.writeConfig("anki_modern_os", cfg)

        # User happens to have "测试账户" open right after upgrade (does NOT own cards 9001/9002)
        mw_test = SimpleNamespace(
            addonManager=mgr,
            pm=_FakePM("测试账户", ["11", "测试账户"]),
            col=_FakeColWithIDs(cids={101, 102}, deck_ids={1}),
        )
        cfg_test = read_profile_scoped_config(mgr.getConfig("anki_modern_os"), mw=mw_test, raw_writer=writer)
        self.assertIsNone(cfg_test.get("vacation_state"))
        self.assertEqual(cfg_test.get("last_sync_checked_map"), {"测试账户": 222000})
        # Top-level legacy keys must be evacuated immediately
        self.assertNotIn("vacation_state", mgr.meta_cfg)
        self.assertIn(LEGACY_UNSCOPED_KEY, mgr.meta_cfg)

        # Now user switches to "11" (which DOES own card 9001)
        mw_11 = SimpleNamespace(
            addonManager=mgr,
            pm=_FakePM("11", ["11", "测试账户"]),
            col=_FakeColWithIDs(cids={9001, 9002}, deck_ids={1, 2001}),
        )
        cfg_11 = read_profile_scoped_config(mgr.getConfig("anki_modern_os"), mw=mw_11, raw_writer=writer)
        self.assertTrue(cfg_11["vacation_state"]["active"])
        self.assertEqual(cfg_11["vacation_frozen_dates"], ["2026-11-15"])
        self.assertEqual(cfg_11["last_sync_checked_map"], {"11": 111000})
        # Quarantine cleared once owner claimed it
        self.assertNotIn(LEGACY_UNSCOPED_KEY, mgr.meta_cfg)
        self.assertTrue(mgr.meta_cfg[PROFILE_STATES_KEY]["11"]["vacation_state"]["active"])

    def test_legacy_flat_migration_single_profile_claims_even_without_cids(self):
        legacy_meta = {
            "vacation_state": {"active": True, "days": 1, "shifted_cids": []},
            "custom_nickname": "SoloUser",
        }
        mgr = _FakeAddonManager(initial=legacy_meta)

        def writer(cfg):
            mgr.writeConfig("anki_modern_os", cfg)

        mw_solo = SimpleNamespace(
            addonManager=mgr,
            pm=_FakePM("11", ["11"]),
            col=_FakeColWithIDs(),
        )
        cfg_solo = read_profile_scoped_config(mgr.getConfig("anki_modern_os"), mw=mw_solo, raw_writer=writer)
        self.assertTrue(cfg_solo["vacation_state"]["active"])
        self.assertEqual(cfg_solo["custom_nickname"], "SoloUser")
        self.assertNotIn(LEGACY_UNSCOPED_KEY, mgr.meta_cfg)


class HostAndBridgeProfileSwitchTests(unittest.TestCase):
    def test_end_to_end_vacation_and_dashboard_isolated_between_profiles(self):
        mgr = _FakeAddonManager(initial={"theme": "light", "language": "zh-CN"})
        pm = _FakePM("11", ["11", "测试账户"])
        env_11 = SafetyEnv(seed=11, n_cards=10)
        env_test = SafetyEnv(seed=22, n_cards=10)
        for env in (env_11, env_test):
            root_tree = SimpleNamespace(
                deck_id=0,
                name="root",
                new_count=0,
                learn_count=0,
                review_count=0,
                children=[
                    SimpleNamespace(
                        deck_id=1,
                        name="Default",
                        new_count=2,
                        learn_count=0,
                        review_count=3,
                        children=[],
                    )
                ],
            )
            env.col.sched.deck_due_tree = lambda rt=root_tree: rt

        fake_mw = SimpleNamespace(addonManager=mgr, pm=pm, col=env_11.col)
        orig_aqt = sys.modules.get("aqt")
        fake_aqt = types.ModuleType("aqt")
        fake_aqt.mw = fake_mw
        sys.modules["aqt"] = fake_aqt
        try:
            host = AnkiModernHost()
            router = BridgeRouter(
                col_getter=lambda: fake_mw.col,
                mw_getter=lambda: fake_mw,
                config_getter=host.get_config,
                config_writer=host.write_config,
            )

            # 1. User enables vacation + sets custom nickname in profile "11"
            vac_res = router.vacation_service.set_vacation({"days": 2, "reason": "出差"})
            self.assertTrue(vac_res["success"])
            router.action_save_preferences({"customNickname": "ElevenNick"})

            dash_11 = router.deck_service.get_dashboard({})
            self.assertTrue(dash_11["vacation"]["isActive"])
            self.assertEqual(dash_11["userName"], "ElevenNick")

            # 2. Switch to "测试账户"
            pm.name = "测试账户"
            fake_mw.col = env_test.col

            dash_test = router.deck_service.get_dashboard({})
            vac_test = router.vacation_service.get_vacation_status({})
            self.assertFalse(dash_test["vacation"]["isActive"])
            self.assertFalse(vac_test["vacation"]["isActive"])
            self.assertEqual(vac_test["vacationHistory"], [])
            self.assertEqual(dash_test["userName"], "测试账户")

            # 3. Switch back to "11" — vacation & nickname remain active
            pm.name = "11"
            fake_mw.col = env_11.col
            dash_11_again = router.deck_service.get_dashboard({})
            self.assertTrue(dash_11_again["vacation"]["isActive"])
            self.assertEqual(dash_11_again["userName"], "ElevenNick")
        finally:
            env_11.close()
            env_test.close()
            if orig_aqt is None:
                sys.modules.pop("aqt", None)
            else:
                sys.modules["aqt"] = orig_aqt

    def test_surviving_webview_emits_profile_changed_only_when_profile_switched(self):
        mgr = _FakeAddonManager()
        pm = _FakePM("11", ["11", "测试账户"])
        fake_mw = SimpleNamespace(
            addonManager=mgr,
            pm=pm,
            col=None,
            winId=lambda: 0,
            isMaximized=lambda: True,
            toolbar=None,
            bottomWeb=None,
            web=None,
        )
        orig_aqt = sys.modules.get("aqt")
        fake_aqt = types.ModuleType("aqt")
        fake_aqt.mw = fake_mw
        sys.modules["aqt"] = fake_aqt
        try:
            host = AnkiModernHost()
            sentinel_web = object()
            host.webview = sentinel_web
            host._webview_profile_key = "11"
            host.is_modern_visible = True

            emitted: list[tuple[str, dict]] = []
            host._ensure_comfortable_window_size = lambda _mw: None
            host._ensure_webview = lambda: sentinel_web
            host._hide_native_webviews = lambda _mw: None
            host._sync_webview_geometry_and_focus = lambda grab_focus=False: None
            host._ensure_rollover_watchers = lambda: None
            host._check_day_rollover = lambda source="x", force_reschedule=False: False
            host._schedule_next_rollover_shot = lambda: None
            host._emit_js_event = lambda name, detail=None: emitted.append((name, detail or {}))

            # Case 1: Normal native <-> modern toggle on same profile -> collection-updated
            host.show_modern_ui()
            self.assertEqual(emitted[-1][0], "anki:collection-updated")

            # Case 2: Profile switch (profile_will_close -> pm switches -> show_modern_ui / profile_did_open)
            emitted.clear()
            host._on_profile_will_close()
            # Intermediate state_did_reset while switching must not push stale collection-updated
            host._on_state_did_reset()
            self.assertEqual(emitted, [])

            pm.name = "测试账户"
            host._on_profile_did_open()
            self.assertEqual(len(emitted), 1)
            self.assertEqual(emitted[0][0], "anki:profile-changed")
            self.assertEqual(emitted[0][1]["profileKey"], "测试账户")

            # Case 3: Subsequent toggle on "测试账户" goes back to normal collection-updated
            emitted.clear()
            host.show_modern_ui()
            self.assertEqual(emitted[0][0], "anki:collection-updated")
        finally:
            if orig_aqt is None:
                sys.modules.pop("aqt", None)
            else:
                sys.modules["aqt"] = orig_aqt


if __name__ == "__main__":
    unittest.main()
