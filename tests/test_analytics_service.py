# -*- coding: utf-8 -*-
"""匿名统计服务：默认关闭（端点为空）、字段白名单、按天去重与队列行为。"""

import sys
import unittest
from pathlib import Path

from _addon_bootstrap import ADDON_ROOT, ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os.bridge.analytics_service import AnalyticsService, cards_bucket  # noqa: E402


class TestAnalyticsService(unittest.TestCase):
    def _service(self, config=None):
        cfg = dict(config or {})

        def get():
            return cfg

        def write(patch):
            cfg.update(patch)
            return cfg

        svc = AnalyticsService(get, write, lambda: None)
        svc.flush_async = lambda: None  # 单元测试不发起网络请求
        return svc, cfg

    def test_endpoint_empty_is_noop(self):
        # 显式把端点设为空字符串 = 完全停止上报（默认内置官方端点）
        svc, cfg = self._service({"analytics_endpoint": ""})
        self.assertFalse(svc.enabled())
        self.assertFalse(svc.track("app_open"))
        self.assertNotIn("analytics_queue", cfg)

    def test_builtin_endpoint_is_configured(self):
        svc, _cfg = self._service()
        self.assertTrue(svc.enabled())
        self.assertTrue(svc.endpoint().startswith("https://"))

    def test_track_app_open_queues_anonymous_event(self):
        svc, cfg = self._service(
            {"analytics_endpoint": "https://stats.example.com/v1/events", "language": "zh-CN"}
        )
        self.assertTrue(svc.start()["started"])
        queue = cfg.get("analytics_queue") or []
        self.assertEqual([e["event"] for e in queue], ["app_open", "daily_active"])
        event = queue[0]
        self.assertEqual(len(event["install_id"]), 32)
        self.assertEqual(event["locale"], "zh-CN")
        self.assertIn("version", event)
        self.assertNotIn("card", event)

    def test_event_allowlist(self):
        svc, cfg = self._service({"analytics_endpoint": "https://stats.example.com/v1/events"})
        self.assertFalse(svc.track("card_content"))
        self.assertNotIn("analytics_queue", cfg)

    def test_props_allowlist_drops_sensitive_keys(self):
        svc, cfg = self._service({"analytics_endpoint": "https://stats.example.com/v1/events"})
        self.assertTrue(
            svc.track(
                "feature_use",
                {"feature": "library_search", "cardContent": "secret", "deckName": "x"},
            )
        )
        event = (cfg.get("analytics_queue") or [])[0]
        self.assertEqual(event["props"], {"feature": "library_search"})

    def test_feature_deduped_per_day(self):
        svc, cfg = self._service({"analytics_endpoint": "https://stats.example.com/v1/events"})
        self.assertTrue(svc.track_feature("vacation"))
        self.assertFalse(svc.track_feature("vacation"))
        self.assertEqual(len([e for e in cfg.get("analytics_queue") or [] if e["event"] == "feature_use"]), 1)

    def test_review_session_buckets(self):
        svc, cfg = self._service({"analytics_endpoint": "https://stats.example.com/v1/events"})
        self.assertTrue(svc.track_review_session(20))
        self.assertTrue(svc.track_review_session(55))
        self.assertTrue(svc.track_review_session(151))
        buckets = [e["props"]["cards_bucket"] for e in cfg.get("analytics_queue") or []]
        self.assertEqual(buckets, ["1-20", "51-100", "100+"])

    def test_cards_bucket_boundaries(self):
        self.assertEqual(cards_bucket(1), "1-20")
        self.assertEqual(cards_bucket(21), "21-50")
        self.assertEqual(cards_bucket(100), "51-100")
        self.assertEqual(cards_bucket(101), "100+")
