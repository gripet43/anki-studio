# -*- coding: utf-8 -*-
"""
Anki Studio - Card Safety, Round 1

Commercial-grade data-safety test layer. Runs the *real* BridgeRouter and its
services against a fully isolated synthetic collection, then compares the
entire card/note state field by field before and after an operation pair.

Coverage after Round 2 (L0 invariants + L4 golden-master round trip + safety shell):
  1. harness never touches the user's real collection
  2. the snapshot/diff engine itself is verified (meta-test)
  3. set_vacation -> cancel_vacation must be a zero-diff round trip
  4. rescue_backlog -> undo_rescue must now also be a zero-diff round trip
  5. random operation sequences preserve card/note/revlog invariants
  6. revlog history is append-only across every mutating action
  7. native undo merge / throttled backup / integrity check are wired in
  8. an orphaned operation ticket is reconciled after a simulated crash

Deliberately deferred to later rounds: Hypothesis stateful testing, fault
injection, kill -9 crash consistency, branch-coverage gating.
"""
from __future__ import annotations

import random
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import safety_harness  # noqa: E402
from safety_harness import (  # noqa: E402
    SafetyEnv,
    card_safety_diff,
    compare,
    notes_fingerprint,
)

SEEDS = range(12)
CARDS_PER_ENV = 60


def tearDownModule():
    safety_harness.close_all()


class CardSafetyRoundTripTest(unittest.TestCase):
    def test_01_harness_never_touches_real_collection(self):
        """An in-memory database has no file; the harness must not resolve a real profile."""
        env = SafetyEnv(0, 10)
        db_list = env.col.conn.execute("PRAGMA database_list").fetchall()
        self.assertEqual(db_list[0][2] or "", "", "synthetic DB must not be a file")
        src = Path(safety_harness.__file__).read_text(encoding="utf-8")
        self.assertIn(":memory:", src)
        self.assertNotIn("账户", src)
        self.assertNotIn("expanduser", src)
        # Every connect must be in-memory or take a caller-supplied temp path.
        for line in src.splitlines():
            if "sqlite3.connect(" in line:
                self.assertTrue(
                    ":memory:" in line or "db_path" in line or "path" in line,
                    f"unexpected hard-coded database path: {line.strip()}",
                )

    def test_02_snapshot_engine_detects_deliberate_corruption(self):
        """Meta-test: a test suite that cannot detect damage is worthless."""
        env = SafetyEnv(1, 40)
        before = env.snap()
        self.assertEqual(compare(before, env.snap())["cards_changed"], [])

        conn = env.col.conn
        conn.execute("UPDATE notes SET flds = flds || 'CORRUPTED' WHERE id = 1000")
        conn.execute("UPDATE cards SET due = due + 999 WHERE id = 2001")
        conn.execute("DELETE FROM cards WHERE id = 2002")
        conn.execute("DELETE FROM revlog WHERE id = (SELECT min(id) FROM revlog)")
        conn.commit()

        d = compare(before, env.snap())
        self.assertEqual(d["notes_changed"], [1000])
        self.assertIn(2001, d["cards_changed"])
        self.assertEqual(d["cards_removed"], [2002])
        self.assertEqual(len(d["revlog_removed"]), 1)

    def test_03_vacation_round_trip_is_zero_diff(self):
        """set_vacation -> cancel_vacation must restore every card byte for byte."""
        for seed in SEEDS:
            with self.subTest(seed=seed):
                env = SafetyEnv(seed, CARDS_PER_ENV)
                before = env.snap()

                started = env.call("set_vacation", {
                    "days": 3,
                    "freezeNewCards": True,
                    "shiftReviewCards": True,
                    "freezeStreak": True,
                })
                self.assertEqual(started["status"], "success")
                self.assertTrue(started["data"]["success"])
                cancelled = env.call("cancel_vacation", {})
                self.assertTrue(cancelled["data"]["success"])

                d = compare(before, env.snap())
                for key in (
                    "cards_added", "cards_removed", "cards_changed",
                    "notes_added", "notes_removed", "notes_changed",
                    "revlog_removed",
                ):
                    self.assertEqual(d[key], [], f"seed={seed} {key}: {d[key][:5]}")
                self.assertFalse(d["deck_limits_changed"], f"seed={seed} deck limits not restored")
                self.assertFalse(env.cfg["vacation_state"]["active"])

    def test_04_rescue_undo_round_trip_is_zero_diff(self):
        """Round 2: every card must be restored to its exact pre-rescue state."""
        for seed in (0, 3, 7, 11):
            with self.subTest(seed=seed):
                env = SafetyEnv(seed, CARDS_PER_ENV)
                before = env.snap()

                res = env.call("rescue_backlog", {"mode": "amortize", "days": 7})
                self.assertTrue(res["data"]["success"])
                receipt = res["data"]["receipt"]
                self.assertTrue(receipt.get("scheduleSnapshot"))
                self.assertEqual(res["data"]["count"], len(receipt["scheduleSnapshot"]))
                self.assertEqual(receipt["state"], "done")

                undo = env.call("undo_rescue", {})
                self.assertTrue(undo["data"]["success"])
                verification = undo["data"]["verification"]
                self.assertTrue(verification["exact"])
                self.assertEqual(verification["failed"], [])
                self.assertEqual(verification["mismatches"], [])

                d = compare(before, env.snap())
                for key in (
                    "cards_added", "cards_removed", "cards_changed",
                    "notes_added", "notes_removed", "notes_changed",
                    "revlog_removed",
                ):
                    self.assertEqual(d[key], [], f"seed={seed} {key}: {d[key][:5]}")
                self.assertFalse(d["deck_limits_changed"])
                self.assertEqual(env.cfg["safety_ticket"]["state"], "done")

    def test_05_random_operation_sequences_preserve_invariants(self):
        """Lightweight stateful testing with fixed, replayable seeds."""
        operations = [
            ("set_vacation", {"days": 2, "freezeNewCards": True,
                              "shiftReviewCards": True, "freezeStreak": True}),
            ("cancel_vacation", {}),
            ("rescue_backlog", {"mode": "shift", "days": 3}),
            ("undo_rescue", {}),
            ("batch_action", {"actionType": "suspend", "cardIds": ["2000", "2001", "2002"]}),
            ("batch_action", {"actionType": "unsuspend", "cardIds": ["2000", "2001", "2002"]}),
            ("search_cards", {"query": "", "status": "all"}),
        ]
        for seed in range(8):
            with self.subTest(seed=seed):
                env = SafetyEnv(100 + seed, 50)
                baseline = env.snap()
                baseline_notes_fp = notes_fingerprint(baseline)
                baseline_card_ids = [r[0] for r in baseline["cards"]]
                history = set(baseline["revlog_ids"])
                rng = random.Random(seed)

                for step in range(12):
                    action, data = rng.choice(operations)
                    env.call(action, data)
                    snap = env.snap()
                    current_history = set(snap["revlog_ids"])
                    self.assertEqual(notes_fingerprint(snap), baseline_notes_fp,
                                     f"seed={seed} step={step} note content changed")
                    self.assertEqual([r[0] for r in snap["cards"]], baseline_card_ids,
                                     f"seed={seed} step={step} card set changed")
                    self.assertTrue(history <= current_history,
                                    f"seed={seed} step={step} revlog history was deleted")
                    history = current_history

    def test_06_revlog_is_append_only_across_all_mutating_actions(self):
        env = SafetyEnv(9, CARDS_PER_ENV)
        history = set(env.snap()["revlog_ids"])
        for action, data in (
            ("set_vacation", {"days": 4, "shiftReviewCards": True}),
            ("cancel_vacation", {}),
            ("rescue_backlog", {"mode": "amortize", "days": 5}),
            ("undo_rescue", {}),
            ("batch_action", {"actionType": "suspend", "cardIds": ["2000"]}),
        ):
            with self.subTest(action=action):
                env.call(action, data)
                current = set(env.snap()["revlog_ids"])
                self.assertTrue(history <= current, f"{action} removed review history")
                history = current

    def test_07_safety_guard_is_wired_into_bulk_operations(self):
        """Native undo merge, throttled backup and integrity check must be active."""
        env = SafetyEnv(31, 60)
        res = env.call("rescue_backlog", {"mode": "shift", "days": 3})
        self.assertTrue(res["data"]["success"])
        safety = res["data"]["receipt"]["safety"]
        self.assertTrue(safety["undoMerged"])
        self.assertTrue(safety["integrityOk"])
        self.assertTrue(safety["backupCreated"])
        self.assertEqual(safety["ticketId"], env.cfg["safety_ticket"]["id"])
        self.assertEqual(env.col.undo_entries[0], "Anki Studio · 进度减负")
        self.assertEqual(len(env.col.merged_undo_targets), 1)
        self.assertFalse(env.col.backup_calls[0]["force"],
                         "backup must respect Anki's own interval, not force one every time")

        # The vacation path has the same N-undo-entries problem: it must merge too.
        env.call("set_vacation", {"days": 2, "shiftReviewCards": True})
        self.assertGreaterEqual(len(env.col.merged_undo_targets), 2)
        env.call("cancel_vacation", {})
        self.assertGreaterEqual(len(env.col.merged_undo_targets), 3)

    def test_08_pending_ticket_is_reconciled_after_a_crash(self):
        """A ticket left pending by a crashed process must restore its snapshot."""
        env = SafetyEnv(41, 60)
        before = env.snap()
        res = env.call("rescue_backlog", {"mode": "shift", "days": 4})
        self.assertTrue(res["data"]["success"])

        # Simulate a process death between the DB write and finish_ticket().
        ticket = dict(env.cfg["safety_ticket"])
        ticket["state"] = "pending"
        env.cfg["safety_ticket"] = ticket

        # Any subsequent IPC call reconciles the orphaned operation.
        env.call("get_vacation_status", {})

        d = compare(before, env.snap())
        for key in ("cards_added", "cards_removed", "cards_changed",
                    "notes_changed", "revlog_removed"):
            self.assertEqual(d[key], [], f"{key}: {d[key][:5]}")
        self.assertEqual(env.cfg["safety_ticket"]["state"], "recovered")


if __name__ == "__main__":
    unittest.main()
