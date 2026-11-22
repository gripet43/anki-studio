# -*- coding: utf-8 -*-
"""匿名统计服务：默认关闭（端点为空）、字段白名单、按天去重与队列行为。"""

import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from _addon_bootstrap import ADDON_ROOT, ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os import AnkiModernHost, _atomic_write_json  # noqa: E402
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
        self.assertEqual(svc.endpoint(), "https://anki.63096039.xyz/v1/events")

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

    def test_start_batches_writes_and_flushes_once(self):
        write_calls = []
        cfg = {"analytics_endpoint": "https://stats.example.com/v1/events", "language": "zh-CN"}

        def get():
            return dict(cfg)

        def write(patch):
            write_calls.append(dict(patch))
            cfg.update(patch)
            return dict(cfg)

        svc = AnalyticsService(get, write, lambda: None)
        flush_calls = []
        svc.flush_async = lambda _round=0: flush_calls.append(_round)

        svc.start()
        # One atomic write per event (app_open, daily_active), and exactly one flush after both finish.
        self.assertEqual(len(write_calls), 2)
        self.assertEqual(len(flush_calls), 1)
        self.assertEqual([e["event"] for e in cfg["analytics_queue"]], ["app_open", "daily_active"])

    def test_flush_async_never_touches_config_from_background_thread(self):
        main_tid = threading.get_ident()
        worker_cfg_touches = []
        scheduled_on_main = []
        done = threading.Event()

        cfg = {
            "analytics_endpoint": "https://stats.example.com/v1/events",
            "analytics_queue": [{"event": "app_open", "ts": 1}],
        }

        def get():
            if threading.get_ident() != main_tid:
                worker_cfg_touches.append("get")
            return dict(cfg)

        def write(patch):
            if threading.get_ident() != main_tid:
                worker_cfg_touches.append("write")
            cfg.update(patch)
            return dict(cfg)

        class _FakeTaskman:
            def run_on_main(self, fn):
                scheduled_on_main.append(fn)
                done.set()

        fake_mw = SimpleNamespace(taskman=_FakeTaskman())

        class _FakeResp:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        svc = AnalyticsService(get, write, lambda: fake_mw)
        with mock.patch("urllib.request.urlopen", return_value=_FakeResp()):
            svc.flush_async()
            self.assertTrue(done.wait(timeout=3.0), "HTTP worker should schedule main-thread completion")

        self.assertEqual(worker_cfg_touches, [], "Background HTTP thread must never read/write meta.json")
        self.assertEqual(len(scheduled_on_main), 1)
        # Execute scheduled callback on main thread -> safely empties queue
        scheduled_on_main[0]()
        self.assertEqual(cfg["analytics_queue"], [])

    def test_atomic_meta_json_concurrent_stress_preserves_theme_and_avatar(self):
        with tempfile.TemporaryDirectory() as tmp:
            meta_path = Path(tmp) / "meta.json"
            _atomic_write_json(
                meta_path,
                {
                    "name": "Anki Studio",
                    "config": {
                        "theme": "light",
                        "accent_color": "emerald",
                        "profile_states": {
                            "11": {
                                "custom_avatar": {
                                    "kind": "image",
                                    "file": "avatar_test.webp",
                                    "mime": "image/webp",
                                }
                            }
                        },
                    },
                },
            )

            class _FileAddonManager:
                def addonFromModule(self, module):
                    return "anki_modern_os"

                def _addonMetaPath(self, addon_id):
                    return str(meta_path)

                def addonMeta(self, addon_id):
                    return json.loads(meta_path.read_text(encoding="utf-8"))

                def getConfig(self, module):
                    return dict(self.addonMeta("anki_modern_os").get("config") or {})

                def writeConfig(self, module, conf):
                    raise AssertionError("Should use atomic meta.json write path when _addonMetaPath exists")

            fake_mw = SimpleNamespace(
                addonManager=_FileAddonManager(),
                pm=SimpleNamespace(name="11", profiles=lambda: ["11"]),
                col=None,
            )

            host = AnkiModernHost.__new__(AnkiModernHost)
            host._config_lock = threading.RLock()
            host._get_active_mw = lambda: fake_mw

            errors = []

            def writer_loop(tag):
                try:
                    for i in range(40):
                        host.write_config({f"analytics_test_{tag}": i})
                except Exception as exc:
                    errors.append(exc)

            def reader_loop():
                try:
                    for _ in range(80):
                        snap = host.get_config()
                        assert snap.get("accent_color") == "emerald"
                        assert snap.get("custom_avatar", {}).get("file") == "avatar_test.webp"
                except Exception as exc:
                    errors.append(exc)

            threads = [
                threading.Thread(target=writer_loop, args=("a",)),
                threading.Thread(target=writer_loop, args=("b",)),
                threading.Thread(target=reader_loop),
                threading.Thread(target=reader_loop),
            ]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=5.0)

            self.assertEqual(errors, [])
            final_meta = json.loads(meta_path.read_text(encoding="utf-8"))
            self.assertEqual(final_meta["name"], "Anki Studio")
            self.assertEqual(final_meta["config"]["accent_color"], "emerald")
            self.assertEqual(
                final_meta["config"]["profile_states"]["11"]["custom_avatar"]["file"],
                "avatar_test.webp",
            )
