"""Monotonic day-boundary timing helpers and rollover state tracking."""

from __future__ import annotations

import datetime
import threading
import time
from typing import Any, Dict, Optional


def _as_int(value: Any) -> Optional[int]:
    """Return int(value) if value is a real number (not bool), else None."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    return None


def _read_rollover_hour(col: Any, day_cutoff: int) -> int:
    """Resolve Anki's configured day-start hour (0-23) with safe fallbacks."""
    raw_hour: Any = None
    get_prefs = getattr(col, "get_preferences", None)
    if callable(get_prefs):
        try:
            prefs = get_prefs()
            if isinstance(prefs, dict):
                raw_hour = prefs.get("rollover")
            else:
                raw_hour = getattr(prefs, "rollover", None)
        except Exception:
            raw_hour = None

    if raw_hour is None:
        conf = getattr(col, "conf", None)
        if isinstance(conf, dict):
            raw_hour = conf.get("rollover")

    parsed = _as_int(raw_hour)
    if parsed is not None:
        return parsed % 24

    if day_cutoff > 0:
        try:
            return datetime.datetime.fromtimestamp(day_cutoff).hour % 24
        except Exception:
            pass
    return 0


def _compute_logical_date(day_cutoff: int, server_now: int) -> str:
    """Return YYYY-MM-DD of the active study day, immune to DST 23h/25h days."""
    if day_cutoff > 0:
        try:
            cutoff_date = datetime.datetime.fromtimestamp(day_cutoff).date()
            return (cutoff_date - datetime.timedelta(days=1)).isoformat()
        except Exception:
            pass
    return datetime.datetime.fromtimestamp(server_now).date().isoformat()


def read_day_timing(col: Any, now_ts: Optional[float] = None) -> Dict[str, Any]:
    """Read scheduler day boundary metadata (`col.sched.today` & `day_cutoff`)."""
    server_now = int(now_ts if now_ts is not None else time.time())
    sched = getattr(col, "sched", None) if col is not None else None
    sched_today = _as_int(getattr(sched, "today", None)) if sched is not None else None
    day_cutoff = _as_int(getattr(sched, "day_cutoff", None)) if sched is not None else None

    if sched is None or sched_today is None or day_cutoff is None:
        return {
            "available": False,
            "schedToday": 0,
            "dayCutoff": 0,
            "dayStartSec": 0,
            "logicalDate": datetime.datetime.fromtimestamp(server_now).date().isoformat(),
            "rolloverHour": 0,
            "serverNow": server_now,
        }

    return {
        "available": True,
        "schedToday": sched_today,
        "dayCutoff": day_cutoff,
        "dayStartSec": day_cutoff - 86400 if day_cutoff > 0 else 0,
        "logicalDate": _compute_logical_date(day_cutoff, server_now),
        "rolloverHour": _read_rollover_hour(col, day_cutoff),
        "serverNow": server_now,
    }


def refresh_scheduler_if_needed(col: Any, now_ts: Optional[float] = None) -> bool:
    """Advance Anki's scheduler day counters when wall-clock time passes `day_cutoff`."""
    sched = getattr(col, "sched", None) if col is not None else None
    if sched is None:
        return False

    old_cutoff = _as_int(getattr(sched, "day_cutoff", None))
    old_today = _as_int(getattr(sched, "today", None))
    if old_cutoff is None or old_cutoff <= 0:
        return False

    now_val = float(now_ts if now_ts is not None else time.time())
    if now_val < float(old_cutoff):
        return False

    update_cutoff = getattr(sched, "_update_cutoff", None)
    if callable(update_cutoff):
        try:
            update_cutoff()
        except Exception:
            pass

    cur_cutoff = _as_int(getattr(sched, "day_cutoff", None))
    if cur_cutoff is None or cur_cutoff <= now_val:
        col_reset = getattr(col, "reset", None)
        if callable(col_reset):
            try:
                col_reset()
            except Exception:
                pass

    new_cutoff = _as_int(getattr(sched, "day_cutoff", None))
    new_today = _as_int(getattr(sched, "today", None))
    return new_cutoff != old_cutoff or new_today != old_today


class DayRolloverTracker:
    """Tracks monotonic transitions of Anki's scheduler day (`today` / `day_cutoff`)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last_sched_today: Optional[int] = None
        self._last_day_cutoff: Optional[int] = None

    def reset(self) -> None:
        """Clear tracked baseline (e.g., on profile close or profile switch)."""
        with self._lock:
            self._last_sched_today = None
            self._last_day_cutoff = None

    def observe(self, timing: Dict[str, Any]) -> None:
        """Record the latest available timing snapshot as the current baseline."""
        if not timing.get("available"):
            return
        sched_today = _as_int(timing.get("schedToday"))
        day_cutoff = _as_int(timing.get("dayCutoff"))
        if sched_today is None or day_cutoff is None:
            return
        with self._lock:
            self._last_sched_today = sched_today
            self._last_day_cutoff = day_cutoff

    def evaluate(
        self,
        timing: Dict[str, Any],
        client_sched_today: Optional[int] = None,
        client_day_cutoff: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Compare `timing` against server baseline and optional client snapshot."""
        with self._lock:
            prev_today = self._last_sched_today
            prev_cutoff = self._last_day_cutoff

            if not timing.get("available"):
                return {
                    "changed": False,
                    "reason": "unavailable",
                    "dayBoundary": timing,
                    "previousSchedToday": prev_today,
                    "previousDayCutoff": prev_cutoff,
                }

            curr_today = _as_int(timing.get("schedToday")) or 0
            curr_cutoff = _as_int(timing.get("dayCutoff")) or 0
            c_today = _as_int(client_sched_today)
            c_cutoff = _as_int(client_day_cutoff)

            changed = False
            reason = "unchanged"

            if c_today is not None and c_today != curr_today:
                changed = True
                reason = "rollover"
            elif prev_today is not None and prev_today != curr_today:
                changed = True
                reason = "rollover"
            elif c_cutoff is not None and c_cutoff > 0 and c_cutoff != curr_cutoff:
                changed = True
                reason = "schedule_adjusted"
            elif prev_cutoff is not None and prev_cutoff > 0 and prev_cutoff != curr_cutoff:
                changed = True
                reason = "schedule_adjusted"

            self._last_sched_today = curr_today
            self._last_day_cutoff = curr_cutoff

            return {
                "changed": changed,
                "reason": reason,
                "dayBoundary": timing,
                "previousSchedToday": prev_today if prev_today is not None else c_today,
                "previousDayCutoff": prev_cutoff if prev_cutoff is not None else c_cutoff,
            }
