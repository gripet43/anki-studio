# -*- coding: utf-8 -*-
"""进度减负（rescue）对「坏卡」的健壮性回归。

真实反例来自 ``tests/scenarios`` 的 ``edge`` 场景：库里存在 ``ivl``/``due`` 越界的
卡片，Anki 26 的 Rust 后端连 ``col.get_card()`` 都会直接抛
``IntegralValueOutOfRange``。而 ``set_due_date(cids, ...)`` 内部同样要读卡，于是
**一张坏卡会让整批减负失败**，用户看到「减负失败」，几十张正常卡一张都没动。

修复约束（不能踩的两条红线）：
1. 坏卡只能**事前摘除**，不能「批量失败后逐张重试」——那会把已经部分提交的改期
   当成成功，破坏 ``test_card_safety_round3`` 的崩溃一致性不变量。
2. 全部卡都不可调度时必须返回失败，不能写回执、不能假装成功。
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

from _addon_bootstrap import ADDON_ROOT, ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os.bridge.vacation_service import VacationService  # noqa: E402


class FakeSched:
    def __init__(self, fail: bool = False):
        self.fail = fail
        self.calls = []

    def set_due_date(self, cids, expr):
        self.calls.append((list(cids), expr))
        if self.fail:
            raise RuntimeError("injected scheduler failure")


class FakeCol:
    def __init__(self, cids, unreadable=(), cards=None):
        self._cids = list(cids)
        self._unreadable = set(unreadable)
        self._cards = cards or {}
        self.sched = FakeSched()

    def find_cards(self, query):
        return list(self._cids)

    def get_card(self, cid):
        if cid in self._unreadable:
            raise RuntimeError("IntegralValueOutOfRange(9, -1)")
        if cid not in self._cards:
            return None
        return self._cards[cid]


class FakeCard:
    def __init__(self, cid):
        self.id = cid
        self.due = -4
        self.ivl = 30
        self.did = 1

    def note(self):
        return None


def make_service(col):
    return VacationService(
        col_getter=lambda: col,
        mw_getter=lambda: None,
        config_getter=lambda: {},
        config_writer=lambda cfg: cfg,
    )


class TestFilterSchedulableCids(unittest.TestCase):
    def test_unreadable_and_missing_cards_are_skipped(self):
        col = FakeCol(
            [1, 2, 3, 4],
            unreadable=(2,),
            cards={1: FakeCard(1), 3: FakeCard(3)},
        )
        good, skipped = VacationService._filter_schedulable_cids(col, [1, 2, 3, 4])
        self.assertEqual(good, [1, 3])
        self.assertEqual(skipped, [2, 4], "get_card 抛错或返回 None 的卡都要摘出来")

    def test_filter_preserves_order(self):
        col = FakeCol([9, 3, 7], cards={9: FakeCard(9), 3: FakeCard(3), 7: FakeCard(7)})
        good, skipped = VacationService._filter_schedulable_cids(col, [9, 3, 7])
        self.assertEqual(good, [9, 3, 7])
        self.assertEqual(skipped, [])


class TestRescueWithBadCards(unittest.TestCase):
    def test_rescue_reschedules_only_schedulable_cards(self):
        col = FakeCol(
            [1, 2, 3],
            unreadable=(2,),
            cards={1: FakeCard(1), 3: FakeCard(3)},
        )
        service = make_service(col)
        # 绕过真实写配置的副作用：只验证调度调用本身。
        result = service.rescue_backlog({"mode": "amortize", "days": 3})
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 2)
        self.assertEqual(len(col.sched.calls), 1, "批量改期仍应是一次后端调用")
        self.assertEqual(col.sched.calls[0][0], [1, 3])
        self.assertEqual(col.sched.calls[0][1], "1-3")

    def test_rescue_fails_loudly_when_every_card_is_unreadable(self):
        col = FakeCol([1, 2], unreadable=(1, 2))
        service = make_service(col)
        result = service.rescue_backlog({"mode": "shift", "days": 3})
        self.assertFalse(result["success"])
        self.assertEqual(result["count"], 0)
        self.assertEqual(col.sched.calls, [], "没有任何可调度卡时不得调用调度器")


if __name__ == "__main__":
    unittest.main()
