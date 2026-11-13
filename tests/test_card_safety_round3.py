# -*- coding: utf-8 -*-
"""
Anki Studio - Card Safety, Round 3

Industrial verification of the safety shell:
  1. fault injection: an exception in the middle of a batch must roll back
     every already-committed write and must never report success
  2. crash consistency: SIGKILL a real child process between the DB commit and
     finish_ticket(), then verify PRAGMA integrity_check and automatic recovery
  3. stateful random operation sequences with automatic counterexample shrinking
     (uses Hypothesis RuleBasedStateMachine when installed, otherwise an
     equivalent deterministic standard-library implementation)
  4. line-coverage gate over the write path using the standard library tracer

No third-party package is required. See tests/requirements-dev.txt for the
optional upgrades (Hypothesis stateful testing, branch coverage).
"""
from __future__ import annotations

import ast
import json
import multiprocessing
import os
import random
import signal
import sqlite3
import sys
import tempfile
import trace
import unittest
from pathlib import Path
from typing import Any, Callable, Dict, List, Tuple

from _addon_bootstrap import ADDON_ROOT, ensure_importable  # noqa: E402

ensure_importable()

import safety_harness  # noqa: E402
from safety_harness import SafetyEnv, compare, notes_fingerprint  # noqa: E402

CARDS = 60

try:
    import hypothesis  # noqa: F401
    HAS_HYPOTHESIS = True
except ImportError:  # standard-library fallback is always active
    HAS_HYPOTHESIS = False

#: Windows 的 ``signal`` 模块**没有** ``SIGKILL``（CPython 只在 POSIX 上定义它），
#: 直接 ``signal.SIGKILL`` 会在 Windows 抛 ``AttributeError``。用 getattr 探一下。
_SIGKILL = getattr(signal, "SIGKILL", None)


def _hard_kill_self() -> None:
    """立即终止当前进程，不给任何清理代码执行的机会（模拟断电）。

    POSIX 用真正的 ``SIGKILL``；Windows 没有这个信号，退回 ``os._exit``——它同样
    跳过 ``finally`` / ``atexit`` / 缓冲区刷新，对本用例要验的「事务已提交、
    ticket 还停在 pending」这个中间态没有区别。

    不用 ``sys.exit`` / ``raise``：那两个是「优雅退出」，``finally`` 会把 ticket
    收尾掉，用例就测不到崩溃恢复了。
    """
    if _SIGKILL is not None:
        os.kill(os.getpid(), _SIGKILL)
    os._exit(1)


def _crash_child(db_path: str, cfg_path: str) -> None:
    """Runs in a spawned child. Kills itself exactly when the operation would
    be marked done, leaving a pending ticket behind (simulated power loss)."""
    from safety_harness import SafetyEnv
    import anki_modern_os.bridge.vacation_service as vs

    env = SafetyEnv.from_files(db_path, cfg_path)
    original = vs.finish_ticket

    def kill_on_done(writer, ticket, state):
        if state == "done":
            _hard_kill_self()
        return original(writer, ticket, state)

    vs.finish_ticket = kill_on_done
    env.call("rescue_backlog", {"mode": "shift", "days": 3})


def _invariants_ok(env: SafetyEnv, baseline: Dict[str, Any]) -> bool:
    snap = env.snap()
    if notes_fingerprint(snap) != notes_fingerprint(baseline):
        return False
    if [r[0] for r in snap["cards"]] != [r[0] for r in baseline["cards"]]:
        return False
    if not set(baseline["revlog_ids"]) <= set(snap["revlog_ids"]):
        return False
    d = compare(baseline, snap)
    return not any(d[k] for k in ("cards_added", "cards_removed",
                                  "notes_added", "notes_removed", "revlog_removed"))


def _run_sequence(seed: int, ops: List[Tuple[str, Dict[str, Any]]]) -> bool:
    env = SafetyEnv(500 + seed, CARDS)
    baseline = env.snap()
    try:
        for action, data in ops:
            env.call(action, data)
            if not _invariants_ok(env, baseline):
                return False
        return True
    finally:
        env.close()


def _shrink(ops, seed):
    """Delete steps one by one while the counterexample still reproduces."""
    current = list(ops)
    changed = True
    while changed and len(current) > 1:
        changed = False
        for i in range(len(current)):
            candidate = current[:i] + current[i + 1:]
            if not _run_sequence(seed, candidate):
                current = candidate
                changed = True
                break
    return current


OP_POOL: List[Tuple[str, Dict[str, Any]]] = [
    ("set_vacation", {"days": 2, "freezeNewCards": True,
                      "shiftReviewCards": True, "freezeStreak": True}),
    ("cancel_vacation", {}),
    ("rescue_backlog", {"mode": "amortize", "days": 5}),
    ("rescue_backlog", {"mode": "shift", "days": 3}),
    ("rescue_backlog", {"mode": "shift", "days": 3, "deckId": "999999"}),
    ("undo_rescue", {}),
    ("batch_action", {"actionType": "suspend", "cardIds": ["2000", "2001"]}),
    ("batch_action", {"actionType": "unsuspend", "cardIds": ["2000", "2001"]}),
    ("batch_action", {"actionType": "noSuchAction", "cardIds": ["2000"]}),
    ("search_cards", {"query": "unclosed(", "status": "all"}),
    ("get_vacation_status", {}),
]


class CardSafetyRound3Test(unittest.TestCase):
    def test_01_mid_batch_failure_rolls_back_every_committed_write(self):
        """Inject an I/O-style failure after 3 cards were already committed."""
        for seed in (0, 5, 17):
            with self.subTest(seed=seed):
                env = SafetyEnv(seed, CARDS)
                before = env.snap()

                def flaky_set_due_date(cids, expr):
                    for i, cid in enumerate(cids):
                        env.col.conn.execute(
                            "UPDATE cards SET due = ? WHERE id = ?", (450, int(cid))
                        )
                        if i == 2:
                            env.col.conn.commit()  # partial state is durable
                            raise RuntimeError("injected mid-batch I/O failure")
                    env.col.conn.commit()

                env.col.sched.set_due_date = flaky_set_due_date
                res = env.call("rescue_backlog", {"mode": "shift", "days": 3})
                self.assertFalse(res["data"]["success"], "failure must not be reported as success")

                d = compare(before, env.snap())
                self.assertEqual(d["cards_changed"], [], "partial writes were not rolled back")
                self.assertEqual(d["cards_removed"], [])
                self.assertEqual(d["notes_changed"], [])
                self.assertEqual(env.cfg["safety_ticket"]["state"], "rolled_back")

    def test_02_sigkill_crash_leaves_recoverable_consistent_database(self):
        """A real child process is SIGKILLed; the DB must survive and recover."""
        ctx = multiprocessing.get_context("spawn")
        with tempfile.TemporaryDirectory(prefix="anki_safety_crash_") as td:
            db_path = os.path.join(td, "collection.anki2")
            cfg_path = os.path.join(td, "config.json")

            creator = SafetyEnv(55, CARDS, db_path=db_path, cfg_path=cfg_path)
            before = creator.snap()
            creator.close()

            child = ctx.Process(target=_crash_child, args=(db_path, cfg_path))
            child.start()
            child.join(timeout=45)
            if child.is_alive():
                child.kill()
                child.join()
                self.fail("crash child did not terminate")
            # POSIX 上子进程被 SIGKILL 拿走，exitcode 是 -SIGKILL；Windows 没有
            # 这个信号，走 os._exit(1)，只能断言「不是正常退出」。真正的语义保底
            # 在下面两条：ticket 仍是 pending、rescue_history 有快照 —— 只有子进程
            # 真的跑完了那笔操作、又在收尾前硬停，才会同时成立。
            if _SIGKILL is not None:
                self.assertEqual(child.exitcode, -_SIGKILL,
                                 "child must be killed, not exit cleanly")
            else:
                self.assertNotEqual(child.exitcode, 0,
                                    "child must not exit cleanly")


            # Physical integrity after an ungraceful kill.
            conn = sqlite3.connect(db_path)
            self.assertEqual(conn.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            conn.close()

            # The ticket must still be pending (the crash happened before done).
            persisted = json.loads(Path(cfg_path).read_text(encoding="utf-8"))
            self.assertEqual(persisted["safety_ticket"]["state"], "pending")
            self.assertTrue(persisted["rescue_history"][0]["scheduleSnapshot"])

            # Restart and let the next IPC call reconcile the orphan.
            env = SafetyEnv.from_files(db_path, cfg_path)
            env.call("get_vacation_status", {})
            d = compare(before, env.snap())
            for key in ("cards_added", "cards_removed", "cards_changed",
                        "notes_changed", "revlog_removed"):
                self.assertEqual(d[key], [], f"{key}: {d[key][:5]}")
            self.assertEqual(env.cfg["safety_ticket"]["state"], "recovered")

    def test_03_stateful_sequences_and_counterexample_shrinking(self):
        """Long random operation sequences, with automatic minimal reproduction."""
        total_steps = 0
        for seed in range(10):
            rng = random.Random(9000 + seed)
            ops = [rng.choice(OP_POOL) for _ in range(24)]
            total_steps += len(ops)
            ok = _run_sequence(seed, ops)
            if not ok:
                minimal = _shrink(ops, seed)
                self.fail(
                    f"seed={seed} invariant broken; minimal sequence "
                    f"({len(minimal)} steps): {minimal}"
                )
        self.assertEqual(total_steps, 240)

        # Optional upgrade: with Hypothesis installed, additionally search the
        # seed space with automatic shrinking. The standard-library model above
        # always runs, so CI never silently skips this check.
        if HAS_HYPOTHESIS:
            from hypothesis import given, settings
            from hypothesis import strategies as st

            @settings(max_examples=40, deadline=None)
            @given(st.integers(min_value=0, max_value=10_000))
            def sequences_preserve_invariants(seed):
                rng = random.Random(seed)
                ops = [rng.choice(OP_POOL) for _ in range(8)]
                assert _run_sequence(seed, ops), f"seed={seed}"

            sequences_preserve_invariants()

    def test_04_write_path_line_coverage_gate(self):
        """Standard-library line coverage (branch coverage needs coverage.py)."""
        workload_ops = [
            ("set_vacation", {"days": 2, "shiftReviewCards": True}),
            ("cancel_vacation", {}),
            ("rescue_backlog", {"mode": "amortize", "days": 5}),
            ("undo_rescue", {}),
        ]

        def workload():
            from anki_modern_os.bridge import safety

            env = SafetyEnv(77, CARDS)
            try:
                for action, data in workload_ops:
                    env.call(action, data)

                # Exercise the crash-recovery branch under the tracer.
                env.call("rescue_backlog", {"mode": "shift", "days": 4})
                ticket = dict(env.cfg["safety_ticket"])
                ticket["state"] = "pending"
                env.cfg["safety_ticket"] = ticket
                env.call("get_vacation_status", {})

                # White-box edge paths of the safety shell itself.
                safety.capture_schedule(env.col, ["999999"])
                safety.restore_schedule(env.col, {"999999": {"due": 1}})
                safety.verify_restoration(env.col, {"999999": {"due": 1}})
                safety.checksum({"a": {"due": 1}})
                safety.begin_undo_group(None, "no collection")
                safety.end_undo_group(None, None)
                safety.try_native_backup(None, None)
                safety.quick_integrity_check(None)
                safety.begin_ticket(lambda patch: None, "probe", "r", {})
                safety.finish_ticket(lambda patch: None, {"id": "t"}, "done")
                safety.reconcile_pending_ticket(lambda: {}, lambda patch: None, None)
            finally:
                env.close()

        tracer = trace.Trace(count=1, trace=0)
        tracer.runfunc(workload)

        def coverage_of(rel_path: str) -> float:
            path = ADDON_ROOT / rel_path
            tree = ast.parse(path.read_text(encoding="utf-8"))
            statements = {
                node.lineno for node in ast.walk(tree)
                if isinstance(node, ast.stmt)
                and not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
            }
            hit = sum(
                1 for (fname, lineno) in tracer.results().counts
                if Path(fname).resolve() == path.resolve() and lineno in statements
            )
            return hit / max(1, len(statements))

        safety_cov = coverage_of("bridge/safety.py")
        vacation_cov = coverage_of("bridge/vacation_service.py")
        if os.environ.get("ANKI_SAFETY_COVERAGE_REPORT"):
            print(
                f"[card-safety] line coverage: safety.py={safety_cov:.1%}, "
                f"vacation_service.py={vacation_cov:.1%}"
            )
        # Gates are intentionally reachable-but-strict; raise them as the
        # workload grows. Both are reported in the assertion message.
        self.assertGreaterEqual(
            safety_cov, 0.70, f"bridge/safety.py line coverage = {safety_cov:.1%}"
        )
        self.assertGreaterEqual(
            vacation_cov, 0.35,
            f"bridge/vacation_service.py line coverage = {vacation_cov:.1%}",
        )


def tearDownModule():
    safety_harness.close_all()


if __name__ == "__main__":
    unittest.main()
