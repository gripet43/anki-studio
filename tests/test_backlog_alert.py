# -*- coding: utf-8 -*-
"""进度减负提示的相对标准：按用户自己的历史复习量判断，而不是固定张数。"""

import sys
import unittest
from pathlib import Path

ADDON_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ADDON_ROOT.parent))

from anki_modern_os.bridge.deck_service import compute_backlog_alert  # noqa: E402


class TestBacklogAlert(unittest.TestCase):
    def test_no_history_never_alerts(self):
        alert = compute_backlog_alert([0, 0, 0, 0], 500, 500)
        self.assertFalse(alert["hasAvalanche"])
        self.assertEqual(alert["typicalDaily"], 0)
        self.assertEqual(alert["suggestedDays"], 7)

    def test_two_days_of_backlog_alerts(self):
        # 每天 100 张左右 → 200 张逾期 = 2 天
        alert = compute_backlog_alert([80, 90, 100, 100, 100], 200, 0)
        self.assertGreaterEqual(alert["backlogDays"], 2.0)
        self.assertTrue(alert["hasAvalanche"])

    def test_heavy_user_with_same_backlog_does_not_alert(self):
        # 平时每天 300+ 张，200 张逾期不到一天
        alert = compute_backlog_alert([280, 290, 300, 310, 320], 200, 250)
        self.assertLess(alert["backlogDays"], 1.0)
        self.assertFalse(alert["hasAvalanche"])

    def test_today_load_double_usual_alerts(self):
        alert = compute_backlog_alert([90, 95, 100, 105, 110], 0, 220)
        self.assertGreaterEqual(alert["loadRatio"], 2.0)
        self.assertTrue(alert["hasAvalanche"])

    def test_vacation_suppresses_alert(self):
        alert = compute_backlog_alert([90, 95, 100, 105, 110], 300, 300, vacation_active=True)
        self.assertFalse(alert["hasAvalanche"])

    def test_recent_relief_cooldown_suppresses_alert(self):
        alert = compute_backlog_alert([90, 95, 100, 105, 110], 300, 300, cooldown_active=True)
        self.assertFalse(alert["hasAvalanche"])

    def test_suggested_days_is_relative_and_bounded(self):
        light = compute_backlog_alert([50, 60, 70, 80, 90], 140, 0)  # 2 天
        heavy = compute_backlog_alert([50, 60, 70, 80, 90], 900, 0)  # 12.8 天
        self.assertTrue(5 <= light["suggestedDays"] <= 14)
        self.assertEqual(heavy["suggestedDays"], 14)
        self.assertGreater(heavy["suggestedDays"], light["suggestedDays"])

    def test_five_active_days_still_works(self):
        # 最近 7 天里活跃 5 天：容量取 4/5 位置，能正常判断
        alert = compute_backlog_alert([40, 60, 70, 80, 90], 160, 0)
        self.assertEqual(alert["typicalDaily"], 80)
        self.assertAlmostEqual(alert["backlogDays"], 2.0)
        self.assertTrue(alert["hasAvalanche"])

    def test_seven_active_days_use_interpolated_75th_percentile(self):
        # 5 天是 80，7 天线性插值后应为 95（而不是原来的 90）
        alert = compute_backlog_alert([50, 60, 70, 80, 90, 100, 110], 0, 0)
        self.assertEqual(alert["typicalDaily"], 95)

    def test_percentile_uses_active_days_only_and_handles_zeros(self):
        alert = compute_backlog_alert([0, 0, 100, 0, 100, 100, 0, 100, 100], 200, 0)
        self.assertEqual(alert["typicalDaily"], 100)
        self.assertAlmostEqual(alert["backlogDays"], 2.0)
