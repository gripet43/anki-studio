# -*- coding: utf-8 -*-
"""Tests for Anki day-boundary detection, scheduler refresh, and rollover host events."""

from __future__ import annotations

import datetime
import json
import sys
import time
import types
import unittest
from pathlib import Path
from types import SimpleNamespace

from _addon_bootstrap import ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os import AnkiModernHost  # noqa: E402
from anki_modern_os.bridge.day_rollover import (  # noqa: E402
    DayRolloverTracker,
    read_day_timing,
    refresh_scheduler_if_needed,
)
from anki_modern_os.bridge.router import BridgeRouter  # noqa: E402


class _FakeTimer:
    """Minimal Qt QTimer test double tracking single-shot/repeating intervals."""

    def __init__(self, parent=None):
        self.parent = parent
        self.single_shot = False
        self.started_ms = []
        self.stopped_count = 0
        self.callbacks = []
        self.timeout = SimpleNamespace(connect=self.callbacks.append)

    def setSingleShot(self, val: bool) -> None:
        self.single_shot = bool(val)

    def start(self, ms: int) -> None:
        self.started_ms.append(int(ms))

    def stop(self) -> None:
        self.stopped_count += 1


class _FakeSched:
    """Fake Anki scheduler that advances `today` and `day_cutoff` on `_update_cutoff()`."""

    def __init__(self, today: int, day_cutoff: int, auto_advance: bool = True):
        self.today = today
        self.day_cutoff = day_cutoff
        self.auto_advance = auto_advance
        self.update_calls = 0

    def _update_cutoff(self) -> None:
        self.update_calls += 1
        if self.auto_advance:
            self.today += 1
            self.day_cutoff += 86400

    def deck_due_tree(self):
        return SimpleNamespace(children=[])


class TestDayRolloverUnit(unittest.TestCase):
    def test_read_day_timing_unavailable_when_col_or_sched_missing(self):
        res_none = read_day_timing(None, now_ts=1_700_000_000)
        self.assertFalse(res_none["available"])
        self.assertEqual(res_none["schedToday"], 0)
        self.assertEqual(res_none["dayCutoff"], 0)

        res_no_sched = read_day_timing(SimpleNamespace(), now_ts=1_700_000_000)
        self.assertFalse(res_no_sched["available"])

    def test_read_day_timing_respects_rollover_hour_and_logical_date(self):
        # Simulate local 2026-11-16 04:00:00 as next cutoff -> active logical study day is 2026-11-15
        cutoff_dt = datetime.datetime(2026, 11, 16, 4, 0, 0)
        cutoff_ts = int(cutoff_dt.timestamp())
        col = SimpleNamespace(
            sched=SimpleNamespace(today=410, day_cutoff=cutoff_ts),
            get_preferences=lambda: SimpleNamespace(rollover=4),
        )
        timing = read_day_timing(col, now_ts=cutoff_ts - 7200)
        self.assertTrue(timing["available"])
        self.assertEqual(timing["schedToday"], 410)
        self.assertEqual(timing["dayCutoff"], cutoff_ts)
        self.assertEqual(timing["dayStartSec"], cutoff_ts - 86400)
        self.assertEqual(timing["logicalDate"], "2026-11-15")
        self.assertEqual(timing["rolloverHour"], 4)

    def test_refresh_scheduler_if_needed_only_triggers_when_overdue(self):
        now_ts = int(time.time())
        future_sched = _FakeSched(today=100, day_cutoff=now_ts + 3600)
        self.assertFalse(refresh_scheduler_if_needed(SimpleNamespace(sched=future_sched), now_ts=now_ts))
        self.assertEqual(future_sched.update_calls, 0)
        self.assertEqual(future_sched.today, 100)

        overdue_sched = _FakeSched(today=100, day_cutoff=now_ts - 5)
        self.assertTrue(refresh_scheduler_if_needed(SimpleNamespace(sched=overdue_sched), now_ts=now_ts))
        self.assertEqual(overdue_sched.update_calls, 1)
        self.assertEqual(overdue_sched.today, 101)
        self.assertEqual(overdue_sched.day_cutoff, now_ts - 5 + 86400)

    def test_day_rollover_tracker_transitions_and_stale_client_detection(self):
        tracker = DayRolloverTracker()
        t1 = {"available": True, "schedToday": 500, "dayCutoff": 2_000_000}
        first = tracker.evaluate(t1)
        self.assertFalse(first["changed"])
        self.assertEqual(first["reason"], "unchanged")

        # Preferences rolloverHour change on same study day
        t1_pref = {"available": True, "schedToday": 500, "dayCutoff": 2_003_600}
        adj = tracker.evaluate(t1_pref)
        self.assertTrue(adj["changed"])
        self.assertEqual(adj["reason"], "schedule_adjusted")

        # Day rollover
        t2 = {"available": True, "schedToday": 501, "dayCutoff": 2_090_000}
        rolled = tracker.evaluate(t2)
        self.assertTrue(rolled["changed"])
        self.assertEqual(rolled["reason"], "rollover")
        self.assertEqual(rolled["previousSchedToday"], 500)

        # Even after server already observed 501, a stale client still holding 500 gets changed=True
        stale_client = tracker.evaluate(t2, client_sched_today=500, client_day_cutoff=2_000_000)
        self.assertTrue(stale_client["changed"])
        self.assertEqual(stale_client["reason"], "rollover")

        # Up-to-date client gets unchanged
        fresh_client = tracker.evaluate(t2, client_sched_today=501, client_day_cutoff=2_090_000)
        self.assertFalse(fresh_client["changed"])
        self.assertEqual(fresh_client["reason"], "unchanged")

        tracker.reset()
        after_reset = tracker.evaluate(t2)
        self.assertFalse(after_reset["changed"])

    def test_router_check_day_rollover_and_dashboard_day_boundary(self):
        now_ts = int(time.time())
        sched = _FakeSched(today=200, day_cutoff=now_ts + 3600)
        col = SimpleNamespace(
            sched=sched,
            get_preferences=lambda: SimpleNamespace(rollover=0),
            decks=SimpleNamespace(all_names_and_ids=lambda: [], current=lambda: {"id": 1, "name": "Default"}),
            db=SimpleNamespace(scalar=lambda *a, **kw: 0, all=lambda *a, **kw: []),
        )
        router = BridgeRouter(col_getter=lambda: col, mw_getter=lambda: None, config_getter=lambda: {})

        # Empty/unavailable dashboard check still stays non-failing; check direct empty dashboard helper too
        empty_dash = router.deck_service._empty_dashboard("zh-CN", "User", {}, {})
        self.assertIn("dayBoundary", empty_dash)
        self.assertFalse(empty_dash["dayBoundary"]["available"])

        # Seed tracker baseline on day 200
        res1 = router.action_check_day_rollover({"source": "test"})
        self.assertFalse(res1["changed"])
        self.assertEqual(res1["dayBoundary"]["schedToday"], 200)

        # Simulate crossing cutoff -> action_check_day_rollover refreshes scheduler and emits changed=True
        sched.day_cutoff = now_ts - 2
        res2 = router.action_check_day_rollover({"source": "cutoff", "schedToday": 200, "dayCutoff": now_ts + 3600})
        self.assertTrue(res2["changed"])
        self.assertEqual(res2["reason"], "rollover")
        self.assertEqual(res2["dayBoundary"]["schedToday"], 201)

    def test_host_check_day_rollover_emits_js_event_and_reschedules_timer(self):
        now_ts = int(time.time())
        sched = _FakeSched(today=700, day_cutoff=now_ts + 7200)
        col = SimpleNamespace(
            sched=sched,
            get_preferences=lambda: SimpleNamespace(rollover=0),
        )
        fake_mw = SimpleNamespace(col=col)
        emitted = []

        orig_aqt = sys.modules.get("aqt")
        fake_aqt = types.ModuleType("aqt")
        fake_aqt.mw = fake_mw
        sys.modules["aqt"] = fake_aqt
        try:
            host = AnkiModernHost()
            host.is_modern_visible = True
            host._rollover_shot_timer = _FakeTimer()
            host._emit_js_event = lambda name, detail: emitted.append((name, detail))

            # Initial baseline observation: unchanged, force_reschedule arms timer
            changed1 = host._check_day_rollover(source="show_modern_ui", force_reschedule=True)
            self.assertFalse(changed1)
            self.assertEqual(len(emitted), 0)
            self.assertEqual(len(host._rollover_shot_timer.started_ms), 1)
            self.assertGreater(host._rollover_shot_timer.started_ms[0], 7000 * 1000)

            # Now simulate passing day_cutoff -> advances sched, emits `anki:day-changed`, re-arms for tomorrow
            sched.day_cutoff = now_ts - 1
            changed2 = host._check_day_rollover(source="cutoff_timer", force_reschedule=True)
            self.assertTrue(changed2)
            self.assertEqual(len(emitted), 1)
            event_name, detail = emitted[0]
            self.assertEqual(event_name, "anki:day-changed")
            self.assertEqual(detail["source"], "cutoff_timer")
            self.assertEqual(detail["reason"], "rollover")
            self.assertEqual(detail["dayBoundary"]["schedToday"], 701)
            self.assertEqual(len(host._rollover_shot_timer.started_ms), 2)
            # Re-armed for tomorrow (~86400s)
            self.assertGreater(host._rollover_shot_timer.started_ms[1], 80_000 * 1000)

            # Profile close stops timer and resets baseline
            host._on_profile_will_close()
            self.assertEqual(host._rollover_shot_timer.stopped_count, 1)
            self.assertIsNone(host.router.day_tracker._last_sched_today)
        finally:
            if orig_aqt is None:
                sys.modules.pop("aqt", None)
            else:
                sys.modules["aqt"] = orig_aqt


if __name__ == "__main__":
    unittest.main()
