# -*- coding: utf-8 -*-
"""Minimal, privacy-conscious anonymous usage analytics for Anki Studio.

Status: LIVE and ON BY DEFAULT since v1.4.33. `DEFAULT_ENDPOINT` points at the
production Cloudflare Worker, so a fresh install reports as soon as it starts.
Users turn it off with `analytics_enabled: false` (Settings → 隐私与统计), or by
setting `analytics_endpoint` to an empty string to keep the local queue but stop
all outbound requests. AnkiWeb's add-on description discloses this.

What is sent (and nothing else):
  * a random per-install id, hashed with SHA-256 (no account, no email)
  * event name (app_open / daily_active / review_session / feature_use)
  * add-on version, OS, Anki version, UI language, UTC offset in whole hours
  * a tiny props object from a fixed allowlist (feature, cards_bucket, ...)

Country is NOT sent by the client: the Worker derives it from Cloudflare's
`cf.country` on the request itself.

Never sent: card contents, deck names, tags, search queries, notes, file paths,
screenshots or any user identifier from AnkiWeb.

Networking happens on a daemon thread and failures are swallowed, so analytics
can never block or break the UI.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import platform
import threading
import time
import urllib.request
import uuid
from typing import Any, Callable, Dict, List, Optional

# 线上正式端点（Cloudflare Worker 自定义域，见 scripts/analytics-worker/）。
# 用户可在配置里把 analytics_endpoint 改成自建地址，或设为空串彻底停发。
DEFAULT_ENDPOINT = "https://anki.63096039.xyz/v1/events"

MAX_QUEUE = 100
REQUEST_TIMEOUT = 6
ALLOWED_EVENTS = {"app_open", "daily_active", "review_session", "feature_use"}
ALLOWED_PROP_KEYS = {"feature", "cards_bucket", "duration_bucket", "source"}
CARD_BUCKETS = ((1, 20, "1-20"), (21, 50, "21-50"), (51, 100, "51-100"))


def cards_bucket(count: int) -> str:
    for lo, hi, label in CARD_BUCKETS:
        if lo <= count <= hi:
            return label
    return "100+"


class AnalyticsService:
    def __init__(
        self,
        config_getter: Callable[[], Dict[str, Any]],
        config_writer: Callable[[Dict[str, Any]], Dict[str, Any]],
        mw_getter: Optional[Callable[[], Any]] = None,
    ):
        self._get_config = config_getter
        self._write_config = config_writer
        self._get_mw = mw_getter or (lambda: None)
        self._lock = threading.Lock()
        self._flushing = False
        self._started = False
        self._client_locale = ""

    # ---- config helpers -------------------------------------------------

    def _cfg(self) -> Dict[str, Any]:
        try:
            cfg = self._get_config()
            return cfg if isinstance(cfg, dict) else {}
        except Exception:
            return {}

    def set_client_locale(self, locale: str) -> None:
        """前端传入的已解析界面语言（config 里的 language 常为 auto）。"""
        self._client_locale = str(locale or "").strip()[:16]

    def endpoint(self) -> str:
        cfg = self._cfg()
        raw = cfg.get("analytics_endpoint")
        # 未配置时用内置官方端点；显式设为空字符串表示「完全停止上报」。
        if raw is None:
            return DEFAULT_ENDPOINT
        return str(raw).strip()

    def enabled(self) -> bool:
        cfg = self._cfg()
        return bool(cfg.get("analytics_enabled", True)) and bool(self.endpoint())

    def _install_id_hash(self) -> str:
        install_id = str(self._cfg().get("analytics_install_id") or "").strip()
        if not install_id:
            install_id = uuid.uuid4().hex
            try:
                self._write_config({"analytics_install_id": install_id})
            except Exception:
                pass
        return hashlib.sha256(install_id.encode("utf-8")).hexdigest()[:32]

    def _context(self) -> Dict[str, str]:
        version = ""
        try:
            from pathlib import Path

            manifest = Path(__file__).resolve().parent.parent / "manifest.json"
            data = json.loads(manifest.read_text(encoding="utf-8"))
            version = str(data.get("human_version") or data.get("version") or "")
        except Exception:
            pass
        anki_version = ""
        try:
            mw = self._get_mw()
            import aqt

            anki_version = str(getattr(aqt, "appVersion", "") or "")
            if not anki_version and mw is not None:
                anki_version = ""
        except Exception:
            pass
        try:
            offset = datetime.datetime.now().astimezone().utcoffset()
            tz_offset = int(round(offset.total_seconds() / 3600)) if offset else 0
        except Exception:
            tz_offset = 0
        return {
            "version": version,
            "os": platform.system().lower(),
            "anki_version": anki_version,
            "locale": self._client_locale or str(self._cfg().get("language") or "auto"),
            "tz_offset": tz_offset,
        }

    @staticmethod
    def _sanitize_props(props: Any) -> Dict[str, Any]:
        if not isinstance(props, dict):
            return {}
        clean: Dict[str, Any] = {}
        for key, value in props.items():
            if key not in ALLOWED_PROP_KEYS:
                continue
            if isinstance(value, bool):
                clean[key] = value
            elif isinstance(value, (int, float)):
                clean[key] = value
            elif isinstance(value, str):
                clean[key] = value[:64]
        return clean

    # ---- event tracking -------------------------------------------------

    def track(
        self,
        event: str,
        props: Optional[Dict[str, Any]] = None,
        dedupe_key: Optional[str] = None,
    ) -> bool:
        """Queues one event. Returns True when it was enqueued."""
        if event not in ALLOWED_EVENTS or not self.enabled():
            return False
        cfg = self._cfg()
        today = time.strftime("%Y-%m-%d")
        if dedupe_key:
            marks = cfg.get("analytics_marks")
            marks = marks if isinstance(marks, dict) else {}
            day_marks = marks.get(today)
            day_marks = day_marks if isinstance(day_marks, list) else []
            if dedupe_key in day_marks:
                return False
            day_marks = (day_marks + [dedupe_key])[-50:]
            marks = {today: day_marks}  # 只保留当天，避免配置膨胀
            try:
                self._write_config({"analytics_marks": marks})
            except Exception:
                pass

        payload = {
            "event": event,
            "ts": int(time.time()),
            "install_id": self._install_id_hash(),
            **self._context(),
        }
        props = self._sanitize_props(props)
        if props:
            payload["props"] = props

        queue = cfg.get("analytics_queue")
        queue = queue if isinstance(queue, list) else []
        queue = (queue + [payload])[-MAX_QUEUE:]
        try:
            self._write_config({"analytics_queue": queue})
        except Exception:
            return False
        self.flush_async()
        return True

    def start(self) -> Dict[str, Any]:
        """Called once after the UI finished bootstrapping."""
        if self._started:
            return {"started": False}
        self._started = True
        self.track("app_open", dedupe_key="app_open")
        self.track("daily_active", dedupe_key="daily_active")
        return {"started": True}

    def track_review_session(self, cards_reviewed: int) -> bool:
        count = max(0, int(cards_reviewed or 0))
        if count <= 0:
            return False
        return self.track(
            "review_session", {"cards_bucket": cards_bucket(count)}, dedupe_key=None
        )

    def track_feature(self, feature: str) -> bool:
        feature = str(feature or "").strip()[:32]
        if not feature:
            return False
        return self.track(
            "feature_use", {"feature": feature}, dedupe_key=f"feature:{feature}"
        )

    # ---- delivery -------------------------------------------------------

    def flush_async(self) -> None:
        if not self.enabled():
            return
        with self._lock:
            if self._flushing:
                return
            self._flushing = True
        try:
            thread = threading.Thread(target=self._flush_worker, daemon=True)
            thread.start()
        except Exception:
            with self._lock:
                self._flushing = False

    def _flush_worker(self) -> None:
        try:
            # 两三个事件可能在第一次 flush 期间入队，循环几轮发完再退出。
            for _ in range(3):
                if not self._flush_sync():
                    break
        finally:
            with self._lock:
                self._flushing = False

    def _flush_sync(self) -> bool:
        cfg = self._cfg()
        queue = cfg.get("analytics_queue")
        if not isinstance(queue, list) or not queue:
            return False
        endpoint = self.endpoint()
        if not endpoint:
            return False
        body = json.dumps({"schema": 1, "events": queue[:MAX_QUEUE]}).encode("utf-8")
        request = urllib.request.Request(
            endpoint,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "User-Agent": f"AnkiStudio/{self._context().get('version') or '0'}",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                if not (200 <= int(getattr(response, "status", 200)) < 300):
                    return False
        except Exception:
            return False
        # 成功后按内容移除已发送的事件，保留 flush 期间新入队的。
        latest = self._cfg()
        current = latest.get("analytics_queue")
        current = current if isinstance(current, list) else []
        remaining = [event for event in current if event not in queue]
        try:
            self._write_config({"analytics_queue": remaining[-MAX_QUEUE:]})
        except Exception:
            pass
        return bool(remaining)
