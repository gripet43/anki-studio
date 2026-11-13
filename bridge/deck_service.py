# -*- coding: utf-8 -*-
"""
Anki Studio — Deck, Dashboard & Statistics Service
Provides deck lists (including hierarchical Parent::Child trees), mastery scores,
dynamic daily workload progress (`completed + dueReview + dueNew`), streak calculation,
365-day review heatmap (with per-day accuracy), 7-day weekly rhythm (with per-day minutes),
comprehensive Statistics, and Anki client environment detection.
"""

from __future__ import annotations

import datetime
import json
import sys
from pathlib import Path
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from .media_utils import get_media_base_url, get_media_dir, get_media_http_base_url
from .vacation_service import effective_frozen_dates


SUPPORTED_LANG_CODES = (
    "zh-CN",
    "zh-TW",
    "en",
    "ja",
    "ko",
    "es",
    "fr",
    "de",
    "ru",
    "pt-BR",
    "it",
    "ar",
    "vi",
    "tr",
    "pl",
    "nl",
)

ANKI_LANG_ALIAS_MAP: Dict[str, str] = {
    "zh-cn": "zh-CN",
    "zh_cn": "zh-CN",
    "zh-hans": "zh-CN",
    "zh": "zh-CN",
    "zh-tw": "zh-TW",
    "zh_tw": "zh-TW",
    "zh-hk": "zh-TW",
    "zh_hk": "zh-TW",
    "zh-hant": "zh-TW",
    "en": "en",
    "en-us": "en",
    "en_us": "en",
    "en-gb": "en",
    "en_gb": "en",
    "ja": "ja",
    "ja-jp": "ja",
    "ja_jp": "ja",
    "ko": "ko",
    "ko-kr": "ko",
    "ko_kr": "ko",
    "es": "es",
    "es-es": "es",
    "es_es": "es",
    "es-mx": "es",
    "es_mx": "es",
    "es-ar": "es",
    "es_ar": "es",
    "fr": "fr",
    "fr-fr": "fr",
    "fr_fr": "fr",
    "fr-ca": "fr",
    "fr_ca": "fr",
    "de": "de",
    "de-de": "de",
    "de_de": "de",
    "de-at": "de",
    "de_at": "de",
    "ru": "ru",
    "ru-ru": "ru",
    "ru_ru": "ru",
    "pt": "pt-BR",
    "pt-br": "pt-BR",
    "pt_br": "pt-BR",
    "pt-pt": "pt-BR",
    "pt_pt": "pt-BR",
    "it": "it",
    "it-it": "it",
    "it_it": "it",
    "ar": "ar",
    "ar-sa": "ar",
    "ar_sa": "ar",
    "vi": "vi",
    "vi-vn": "vi",
    "vi_vn": "vi",
    "tr": "tr",
    "tr-tr": "tr",
    "tr_tr": "tr",
    "pl": "pl",
    "pl-pl": "pl",
    "pl_pl": "pl",
    "nl": "nl",
    "nl-nl": "nl",
    "nl_nl": "nl",
}


def normalize_language_code(raw_code: Optional[str], default: str = "zh-CN") -> str:
    """Normalizes any Anki or browser locale string to one of our 16 canonical language codes."""
    if not raw_code:
        return default
    cleaned = str(raw_code).strip()
    if cleaned in SUPPORTED_LANG_CODES:
        return cleaned
    lower = cleaned.lower()
    if lower in ANKI_LANG_ALIAS_MAP:
        return ANKI_LANG_ALIAS_MAP[lower]
    prefix = lower.split("-")[0].split("_")[0]
    if prefix in ANKI_LANG_ALIAS_MAP:
        return ANKI_LANG_ALIAS_MAP[prefix]
    return default


class DeckService:
    """Service interacting with mw.col.decks, mw.col.sched, and revlog statistics."""

    def __init__(self, col_getter, mw_getter=None, config_getter: Optional[Callable[[], Dict[str, Any]]] = None):
        self._get_col = col_getter
        self._get_mw = mw_getter or (lambda: None)
        self._get_config = config_getter or (lambda: {})

    @property
    def col(self):
        return self._get_col()

    @property
    def mw(self):
        return self._get_mw()

    def _resolve_language(self, override_lang: Optional[str] = None) -> str:
        """Resolves effective UI language across Anki's 16 supported languages."""
        cfg = self._get_config()
        pref = str(override_lang or cfg.get("language", "auto") or "auto").strip()
        if pref and pref.lower() != "auto":
            return normalize_language_code(pref, default="en")

        try:
            import anki.lang
            anki_lang = getattr(anki.lang, "current_lang", "") or ""
            if anki_lang:
                return normalize_language_code(anki_lang, default="en")
            return "en"
        except Exception:
            return "zh-CN"

    def _resolve_profile_name(self, data: Dict[str, Any]) -> str:
        """Reads custom nickname from config or active Anki Profile name (`mw.pm.name`)."""
        cfg = self._get_config()
        custom = str(data.get("customNickname") or cfg.get("custom_nickname") or "").strip()
        if custom:
            return custom
        mw = self.mw
        if mw is not None:
            try:
                pm = getattr(mw, "pm", None)
                if pm and getattr(pm, "name", None):
                    return str(pm.name)
            except Exception:
                pass
        if data.get("userName"):
            return str(data["userName"])
        return ""

    def _resolve_platform_and_version(self) -> Dict[str, str]:
        """Detects current OS platform ('mac' | 'win' | 'linux') and real Anki version string."""
        plat = sys.platform
        if plat.startswith("darwin"):
            os_name = "macOS"
            os_code = "mac"
        elif plat.startswith("win"):
            os_name = "Windows"
            os_code = "win"
        else:
            os_name = "Linux"
            os_code = "linux"

        anki_ver = "26.9"
        try:
            import aqt
            if getattr(aqt, "appVersion", None):
                anki_ver = str(aqt.appVersion)
        except Exception:
            try:
                import anki
                if getattr(anki, "version", None):
                    anki_ver = str(anki.version)
            except Exception:
                pass

        return {
            "platform": os_code,
            "osName": os_name,
            "ankiVersion": anki_ver,
            "platformBadge": f"{os_name} · {anki_ver}",
            "studioVersion": self._studio_version(),
            "mediaBaseUrl": get_media_base_url(get_media_dir(self.col)),
            "mediaHttpBaseUrl": get_media_http_base_url(self.mw),
        }

    @staticmethod
    def _studio_version() -> str:
        """Reads the add-on version from manifest.json (single source of truth)."""
        try:
            manifest_path = Path(__file__).resolve().parent.parent / "manifest.json"
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            return str(data.get("human_version") or data.get("version") or "").strip()
        except Exception:
            return ""

    @staticmethod
    def resolve_profile_sync_key(mw: Any = None) -> str:
        """Stable profile identifier for per-profile sync verification timestamps."""
        try:
            pm = getattr(mw, "pm", None) if mw is not None else None
            name = getattr(pm, "name", None) if pm is not None else None
            if isinstance(name, str) and name.strip():
                return name.strip()
        except Exception:
            pass
        return "default"

    @classmethod
    def _get_last_sync_timestamp(cls, col) -> int:
        """
        Reads genuine AnkiWeb cloud sync timestamp directly from Anki's database (`col.ls`).
        Returns milliseconds since epoch, or 0 if never synced / no account configured.
        """
        if col is None:
            return 0
        try:
            ls_val = None
            if hasattr(col, "ls"):
                ls_val = getattr(col, "ls")
            elif hasattr(col, "db") and hasattr(col.db, "first"):
                row = col.db.first("SELECT ls FROM col")
                if row and row[0] is not None:
                    ls_val = row[0]
            elif hasattr(col, "db") and hasattr(col.db, "scalar"):
                ls_val = col.db.scalar("SELECT ls FROM col")

            if ls_val is None:
                return 0

            ls_int = int(ls_val)
            if ls_int <= 0:
                return 0
            if ls_int < 100_000_000_000:
                ls_int *= 1000
            return ls_int
        except Exception:
            return 0

    def get_dashboard(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Returns comprehensive dashboard state for Page 1 (Dashboard) & Stats."""
        data = data or {}
        lang = self._resolve_language(data.get("language"))
        profile_name = self._resolve_profile_name(data)
        env_info = self._resolve_platform_and_version()
        cfg = self._get_config()

        col = self.col
        if col is None:
            return self._empty_dashboard(lang, profile_name, env_info, cfg)

        try:
            now = datetime.datetime.now()
            cutoff = getattr(col.sched, "day_cutoff", int(time.time()) + 86400)
            today_start_sec = cutoff - 86400
            today_start_ms = today_start_sec * 1000

            # Exclude manual reschedule / due-date shift entries (type = 4, ease = 0) written by set_due_date
            row = col.db.first(
                "SELECT count(*), coalesce(sum(time), 0), coalesce(sum(case when ease > 1 then 1 else 0 end), 0) "
                "FROM revlog WHERE id >= ? AND type < 4 AND ease > 0",
                today_start_ms,
            )
            completed_today = int(row[0] or 0) if row else 0
            correct_today = int(row[2] or 0) if row else 0

            recent_speed_row = col.db.first(
                "SELECT avg(time) FROM (SELECT time FROM revlog WHERE type < 4 AND ease > 0 AND time > 0 AND time < 60000 ORDER BY id DESC LIMIT 200)"
            )
            avg_sec_per_card = (
                round((recent_speed_row[0] / 1000.0), 1)
                if (recent_speed_row and recent_speed_row[0])
                else 0.0
            )

            decks_list = self._build_decks_list(col)
            total_due_review = sum(d["dueReview"] for d in decks_list if not d.get("isChild"))
            total_due_new = sum(d["dueNew"] for d in decks_list if not d.get("isChild"))
            total_pending = total_due_review + total_due_new

            total_today_workload = completed_today + total_pending
            remaining_for_goal = total_pending
            effective_speed = avg_sec_per_card if avg_sec_per_card > 0 else 6.0
            estimated_minutes = (
                max(1, round((total_pending * effective_speed) / 60.0))
                if total_pending > 0
                else 0
            )

            heatmap_data = self._build_heatmap_and_streak(col, cutoff, lang)
            weekly_rhythm = self._build_weekly_rhythm(col, cutoff, avg_sec_per_card, lang)
            include_stats = bool(data.get("includeStats", False))
            advanced_stats = (
                self.get_statistics({"language": lang})
                if include_stats
                else self._empty_advanced_stats(lang)
            )

            # Vacation & Backlog state resolution
            vacation_cfg = cfg.get("vacation_state", {})
            is_vacation_active = bool(vacation_cfg.get("active", False))
            vacation_remaining_days = 0
            if is_vacation_active and vacation_cfg.get("end_date"):
                try:
                    v_end = datetime.date.fromisoformat(vacation_cfg["end_date"])
                    v_delta = (v_end - datetime.date.today()).days
                    if v_delta < 0:
                        is_vacation_active = False
                        vacation_remaining_days = 0
                    else:
                        vacation_remaining_days = max(1, v_delta + 1)
                except Exception:
                    vacation_remaining_days = int(vacation_cfg.get("days", 0))

            overdue_count = getattr(self, "_last_overdue_count", None)
            if overdue_count is None:
                try:
                    today_sched = getattr(col.sched, "today", None)
                    if today_sched is not None and hasattr(col, "db"):
                        ov_row = col.db.first(
                            "SELECT count(*) FROM cards WHERE queue = 2 AND due < ?",
                            int(today_sched),
                        )
                        overdue_count = int(ov_row[0] or 0) if ov_row else 0
                    else:
                        overdue_cids = col.find_cards("is:due is:review prop:due<0") if hasattr(col, "find_cards") else []
                        overdue_count = len(overdue_cids)
                except Exception:
                    overdue_count = total_due_review

            has_avalanche = overdue_count >= 30 or (total_due_review + total_due_new) >= 60

            ls_ts = self._get_last_sync_timestamp(col)
            last_sync_ts = ls_ts
            if ls_ts > 0:
                checked_map = cfg.get("last_sync_checked_map")
                if isinstance(checked_map, dict):
                    profile_key = self.resolve_profile_sync_key(self.mw)
                    try:
                        checked_ts = int(checked_map.get(profile_key, 0) or 0)
                        if 0 < checked_ts < 100_000_000_000:
                            checked_ts *= 1000
                        if checked_ts > last_sync_ts:
                            last_sync_ts = checked_ts
                    except Exception:
                        pass
            return {
                "userName": profile_name,
                "greeting": self._get_greeting(now.hour, lang),
                "dateDisplay": self._format_date_display(now, lang),
                "synced": last_sync_ts > 0,
                "syncedAt": last_sync_ts,
                "language": lang,
                "envInfo": env_info,
                "preferences": {
                    "theme": cfg.get("theme", "light"),
                    "accentColor": cfg.get("accent_color", "indigo"),
                    "language": cfg.get("language", "auto"),
                    "customNickname": cfg.get("custom_nickname", ""),
                    "collapsedDeckIds": cfg.get("collapsed_deck_ids", []),
                    "sandboxNoteTypeIds": [str(x) for x in (cfg.get("sandbox_notetype_ids") or [])],
                    "showShortcutHints": bool(cfg.get("show_shortcut_hints", False)),
                    "tipsDismissed": bool(cfg.get("dashboard_tips_dismissed", False)),
                    "debugMode": bool(cfg.get("debug_mode", False)),
                },
                "vacation": {
                    "isActive": is_vacation_active,
                    "startDate": vacation_cfg.get("start_date", ""),
                    "endDate": vacation_cfg.get("end_date", ""),
                    "days": int(vacation_cfg.get("days", 0)),
                    "remainingDays": vacation_remaining_days,
                    "reason": vacation_cfg.get("reason", "休整与备考"),
                    "freezeNewCards": bool(vacation_cfg.get("freeze_new_cards", True)),
                    "frozenDates": effective_frozen_dates(cfg),
                    "shiftedCardCount": int(vacation_cfg.get("shifted_card_count", 0)),
                    "createdAt": vacation_cfg.get("created_at", ""),
                },
                "backlog": {
                    "totalDue": total_due_review + total_due_new,
                    "overdueCount": overdue_count,
                    "hasAvalanche": has_avalanche,
                    "suggestedDays": 14 if (total_due_review + total_due_new) > 200 else (7 if (total_due_review + total_due_new) > 80 else 5),
                },
                "todayStats": {
                    "completed": completed_today,
                    "totalTodayWorkload": total_today_workload,
                    "dailyGoal": total_today_workload,
                    "remainingForGoal": remaining_for_goal,
                    "estimatedMinutes": estimated_minutes,
                    "dueReview": total_due_review,
                    "dueNew": total_due_new,
                    "totalPending": total_pending,
                    "correctRateToday": round((correct_today / completed_today) * 100)
                    if completed_today > 0
                    else 0,
                },
                "streak": heatmap_data["streak"],
                "decks": decks_list,
                "heatmap": heatmap_data["heatmap"],
                "weeklyRhythm": weekly_rhythm,
                "advancedStats": advanced_stats,
                "vacationHistory": cfg.get("vacation_history", []),
                "rescueHistory": cfg.get("rescue_history", []) or ([cfg.get("last_rescue_receipt")] if cfg.get("last_rescue_receipt") else []),
                "lastRescueReceipt": (
                    cfg.get("last_rescue_receipt")
                    or (
                        getattr(self, "vacation_service", None)
                        and self.vacation_service.get_or_reconstruct_receipt()
                    )
                ),
            }
        except Exception as e:
            fallback = self._empty_dashboard(lang, profile_name, env_info, cfg)
            fallback["bridgeWarning"] = str(e)
            return fallback

    def get_statistics(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Computes comprehensive analytics for the standalone Stats View."""
        data = data or {}
        lang = self._resolve_language(data.get("language"))
        col = self.col
        if col is None:
            return self._empty_advanced_stats(lang)

        try:
            today_sched = getattr(col.sched, "today", 0)
            cutoff = getattr(col.sched, "day_cutoff", int(time.time()) + 86400)
            today_start_sec = cutoff - 86400

            # 1. Card Maturity Breakdown + 7. Daily Load in a SINGLE `cards` table scan!
            m_row = col.db.first(
                "SELECT "
                "coalesce(sum(case when queue = -1 then 1 else 0 end), 0), "
                "coalesce(sum(case when queue in (-2, -3) then 1 else 0 end), 0), "
                "coalesce(sum(case when queue >= 0 and type = 0 then 1 else 0 end), 0), "
                "coalesce(sum(case when queue >= 0 and type in (1, 3) then 1 else 0 end), 0), "
                "coalesce(sum(case when queue >= 0 and type = 2 and ivl < 21 then 1 else 0 end), 0), "
                "coalesce(sum(case when queue >= 0 and type = 2 and ivl >= 21 then 1 else 0 end), 0), "
                "coalesce(sum(case when queue = 2 then (case when ivl >= 1 then 1.0 / ivl else 1.0 end) else 0 end), 0) "
                "FROM cards"
            )
            suspended_cnt = int(m_row[0] or 0) if m_row else 0
            buried_cnt = int(m_row[1] or 0) if m_row else 0
            new_cnt = int(m_row[2] or 0) if m_row else 0
            learning_cnt = int(m_row[3] or 0) if m_row else 0
            young_cnt = int(m_row[4] or 0) if m_row else 0
            mature_cnt = int(m_row[5] or 0) if m_row else 0
            daily_load = round(float(m_row[6] or 0), 1) if m_row else 0.0

            # 2. Next 30 Days Forecast
            due_rows = col.db.all(
                "SELECT (due - ?) as day_offset, count(*), "
                "sum(case when ivl >= 21 then 1 else 0 end) "
                "FROM cards WHERE queue in (2, 3) AND due >= ? AND due < ? "
                "GROUP BY day_offset ORDER BY day_offset ASC",
                today_sched,
                today_sched,
                today_sched + 30,
            )
            due_map = {int(r[0]): (int(r[1] or 0), int(r[2] or 0)) for r in due_rows if r[0] is not None}
            forecast_30d = []
            base_date = datetime.date.fromtimestamp(today_start_sec)
            today_label = "今天" if lang == "zh-CN" else "Today"
            for d_off in range(30):
                dt = base_date + datetime.timedelta(days=d_off)
                total_d, mature_d = due_map.get(d_off, (0, 0))
                young_d = max(0, total_d - mature_d)
                forecast_30d.append({
                    "dayOffset": d_off,
                    "label": today_label if d_off == 0 else (f"{dt.month}/{dt.day}" if d_off % 3 == 0 else f"+{d_off}d"),
                    "total": total_d,
                    "mature": mature_d,
                    "young": young_d,
                })

            # 3. 12-Week Historical Retention & Lapse Rate Curve (SINGLE GROUP BY query instead of 12 scans)
            start_12w_sec = cutoff - (12 * 7 * 86400)
            start_12w_ms = start_12w_sec * 1000
            cutoff_ms = cutoff * 1000
            week_ms = 7 * 86400 * 1000
            w_rows = col.db.all(
                "SELECT CAST((id - ?) / ? AS INT) as w_idx, "
                "count(*), sum(case when ease > 1 then 1 else 0 end) "
                "FROM revlog WHERE id >= ? AND id < ? AND type < 4 AND ease > 0 "
                "GROUP BY w_idx",
                start_12w_ms,
                week_ms,
                start_12w_ms,
                cutoff_ms,
            )
            w_map = {int(r[0]): (int(r[1] or 0), int(r[2] or 0)) for r in w_rows if r[0] is not None}
            retention_curve = []
            for idx_w in range(12):
                w = 11 - idx_w
                w_total, w_pass = w_map.get(idx_w, (0, 0))
                ret_pct = round((w_pass / w_total) * 100, 1) if w_total > 0 else 0.0
                lapse_pct = round(100.0 - ret_pct, 1) if w_total > 0 else 0.0
                if lang == "zh-CN":
                    period_label = "本周" if w == 0 else f"{w}周前"
                else:
                    period_label = "Now" if w == 0 else f"-{w}w"
                retention_curve.append({
                    "period": period_label,
                    "retentionRate": ret_pct,
                    "lapseRate": lapse_pct,
                    "reviews": w_total,
                })

            # 4. 24-Hour Study Time Distribution (pure integer math with local UTC offset instead of per-row strftime('localtime'))
            try:
                local_offset_sec = int(datetime.datetime.now().astimezone().utcoffset().total_seconds())
            except Exception:
                local_offset_sec = 0
            hour_rows = col.db.all(
                "SELECT CAST((((CAST(id / 1000 AS INT) + ?) % 86400 + 86400) % 86400) / 3600 AS INT) as hr, "
                "count(*), sum(case when ease > 1 then 1 else 0 end) "
                "FROM revlog WHERE type < 4 AND ease > 0 GROUP BY hr",
                local_offset_sec,
            )
            hour_map = {int(r[0]): (int(r[1] or 0), int(r[2] or 0)) for r in hour_rows if r[0] is not None}
            hourly_dist = []
            for h in range(24):
                cnt, corr = hour_map.get(h, (0, 0))
                hourly_dist.append({
                    "hour": f"{h:02d}:00",
                    "count": cnt,
                    "accuracy": round((corr / cnt) * 100) if cnt > 0 else 0,
                })

            def _pct(passed: int, total: int) -> float:
                return round((passed / total) * 100, 1) if total > 0 else 0.0

            # 5. Anki "Answer Buttons" graph, last 365 days.
            year_start_ms = (cutoff - 365 * 86400) * 1000
            btn_row = col.db.first(
                "SELECT "
                "coalesce(sum(case when ease = 1 then 1 else 0 end), 0), "
                "coalesce(sum(case when ease = 2 then 1 else 0 end), 0), "
                "coalesce(sum(case when ease = 3 then 1 else 0 end), 0), "
                "coalesce(sum(case when ease = 4 then 1 else 0 end), 0), "
                "coalesce(sum(case when lastIvl < 21 and ease > 1 then 1 else 0 end), 0), "
                "coalesce(sum(case when lastIvl < 21 then 1 else 0 end), 0), "
                "coalesce(sum(case when lastIvl >= 21 and ease > 1 then 1 else 0 end), 0), "
                "coalesce(sum(case when lastIvl >= 21 then 1 else 0 end), 0) "
                "FROM revlog WHERE type < 4 AND ease > 0 AND id >= ?",
                year_start_ms,
            )
            b = [int(x or 0) for x in (btn_row or (0,) * 8)]
            answer_buttons = {
                "again": b[0],
                "hard": b[1],
                "good": b[2],
                "easy": b[3],
                "total": b[0] + b[1] + b[2] + b[3],
                "young": {"pass": b[4], "total": b[5], "rate": _pct(b[4], b[5])},
                "mature": {"pass": b[6], "total": b[7], "rate": _pct(b[6], b[7])},
            }

            # 6. Anki "True Retention": only the first review of each card per day (MIN(id) per cid+day).
            #    Using GROUP BY cid, day_bucket with MIN(id) avoids sorting the entire revlog table via ROW_NUMBER() OVER.
            last30_ms = (cutoff - 30 * 86400) * 1000
            try:
                tr_row = col.db.first(
                    "WITH first_daily AS ("
                    " SELECT cid, ease, lastIvl, MIN(id) AS id"
                    " FROM revlog WHERE type < 4 AND ease > 0"
                    " GROUP BY cid, CAST((id / 1000 - ?) / 86400 AS INT)"
                    ") SELECT "
                    " coalesce(sum(case when lastIvl >= 21 then 1 else 0 end), 0), "
                    " coalesce(sum(case when lastIvl >= 21 and ease > 1 then 1 else 0 end), 0), "
                    " coalesce(sum(case when lastIvl < 21 then 1 else 0 end), 0), "
                    " coalesce(sum(case when lastIvl < 21 and ease > 1 then 1 else 0 end), 0), "
                    " coalesce(sum(case when id >= ? and lastIvl >= 21 then 1 else 0 end), 0), "
                    " coalesce(sum(case when id >= ? and lastIvl >= 21 and ease > 1 then 1 else 0 end), 0), "
                    " coalesce(sum(case when id >= ? and lastIvl < 21 then 1 else 0 end), 0), "
                    " coalesce(sum(case when id >= ? and lastIvl < 21 and ease > 1 then 1 else 0 end), 0) "
                    "FROM first_daily",
                    today_start_sec,
                    last30_ms, last30_ms, last30_ms, last30_ms,
                )
                t = [int(x or 0) for x in (tr_row or (0,) * 8)]
            except Exception:
                t = [0] * 8

            def _tr_block(m_total: int, m_pass: int, y_total: int, y_pass: int) -> Dict[str, Any]:
                total = m_total + y_total
                passed = m_pass + y_pass
                return {
                    "young": {"pass": y_pass, "total": y_total, "rate": _pct(y_pass, y_total)},
                    "mature": {"pass": m_pass, "total": m_total, "rate": _pct(m_pass, m_total)},
                    "overall": {"pass": passed, "total": total, "rate": _pct(passed, total)},
                }

            true_retention = {
                "allTime": _tr_block(t[0], t[1], t[2], t[3]),
                "last30d": _tr_block(t[4], t[5], t[6], t[7]),
            }

            return {
                "maturityBreakdown": {
                    "newCards": new_cnt,
                    "learning": learning_cnt,
                    "young": young_cnt,
                    "mature": mature_cnt,
                    "suspended": suspended_cnt,
                    "buried": buried_cnt,
                    "total": new_cnt + learning_cnt + young_cnt + mature_cnt + suspended_cnt + buried_cnt,
                },
                "forecast30d": forecast_30d,
                "retentionCurve": retention_curve,
                "hourlyDistribution": hourly_dist,
                "answerButtons": answer_buttons,
                "trueRetention": true_retention,
                "dailyLoad": daily_load,
            }
        except Exception:
            return self._empty_advanced_stats(lang)

    def _build_decks_list(self, col) -> List[Dict[str, Any]]:
        """Collects all decks with due counts, total cards, parentId, and mastery percentage in O(1) SQL queries."""
        tree = col.sched.deck_due_tree()
        decks_out: List[Dict[str, Any]] = []

        icons = ["book", "code", "heart", "folder", "layers", "sparkles"]
        accents = ["indigo", "blue", "emerald", "amber", "rose", "purple"]

        # 一次整数聚合：卡片总数、三段互斥整数计数（ivl>=21 / ivl<21&type=2 / ivl<21&type in (1,3)）及超期卡数。
        # 新卡数与加权熟记度在 Python 端由 3 个整数直接算得，避免 SQL 重复求值 5 条 CASE 与浮点累加，同时省去单独的超期扫描。
        direct_stats: Dict[int, Tuple[int, float, int, int, int, int]] = {}
        self._last_overdue_count = None
        today_sched = getattr(col.sched, "today", None)
        if hasattr(col, "db") and hasattr(col.db, "all"):
            try:
                if today_sched is not None:
                    rows = col.db.all(
                        "SELECT did, count(*), "
                        "coalesce(sum(case when ivl >= 21 then 1 else 0 end), 0), "
                        "coalesce(sum(case when ivl < 21 and type = 2 then 1 else 0 end), 0), "
                        "coalesce(sum(case when ivl < 21 and type in (1,3) then 1 else 0 end), 0), "
                        "coalesce(sum(case when queue = 2 and due < ? then 1 else 0 end), 0) "
                        "FROM cards GROUP BY did",
                        int(today_sched),
                    )
                    overdue_sum = 0
                else:
                    rows = col.db.all(
                        "SELECT did, count(*), "
                        "coalesce(sum(case when ivl >= 21 then 1 else 0 end), 0), "
                        "coalesce(sum(case when ivl < 21 and type = 2 then 1 else 0 end), 0), "
                        "coalesce(sum(case when ivl < 21 and type in (1,3) then 1 else 0 end), 0), "
                        "0 "
                        "FROM cards GROUP BY did"
                    )
                    overdue_sum = None
                for r in rows:
                    if r[0] is not None:
                        tot = int(r[1] or 0)
                        n_mat = int(r[2] or 0)
                        n_rev = int(r[3] or 0)
                        n_lrn = int(r[4] or 0)
                        n_nw = max(0, tot - n_mat - n_rev - n_lrn)
                        w_mast = n_mat * 1.0 + n_rev * 0.6 + n_lrn * 0.3
                        direct_stats[int(r[0])] = (tot, w_mast, n_mat, n_rev, n_lrn, n_nw)
                        if overdue_sum is not None:
                            overdue_sum += int(r[5] or 0)
                if overdue_sum is not None:
                    self._last_overdue_count = overdue_sum
            except Exception:
                self._last_overdue_count = None

        # 自底向上缓存 (总数, 加权值, 已熟记, 复习中, 学习中, 新卡)
        subtree_stats: Dict[int, Tuple[int, float, int, int, int, int]] = {}
        _EMPTY_STATS: Tuple[int, float, int, int, int, int] = (0, 0.0, 0, 0, 0, 0)

        def compute_subtree_stats(node) -> Tuple[int, float, int, int, int, int]:
            did = int(getattr(node, "deck_id", 0) or 0)
            own = list(direct_stats.get(did, _EMPTY_STATS))
            for child in getattr(node, "children", []):
                child_stats = compute_subtree_stats(child)
                for i in range(6):
                    own[i] += child_stats[i]
            result = (
                int(own[0]), float(own[1]),
                int(own[2]), int(own[3]), int(own[4]), int(own[5]),
            )
            if did:
                subtree_stats[did] = result
            return result

        compute_subtree_stats(tree)

        def traverse(node, depth=0, parent_name="", parent_id=None):
            for child in getattr(node, "children", []):
                did = int(child.deck_id)
                name = child.name
                full_name = f"{parent_name}::{name}" if parent_name else name

                new_count = int(getattr(child, "new_count", 0))
                learn_count = int(getattr(child, "learn_count", 0))
                review_count = int(getattr(child, "review_count", 0))
                due_review = learn_count + review_count

                if did in subtree_stats:
                    (
                        total_cards, weighted_mastered,
                        n_mature, n_review, n_learning, n_new,
                    ) = subtree_stats[did]
                else:
                    dids = [did] + [int(cid) for _, cid in col.decks.children(did)]
                    placeholders = ",".join("?" for _ in dids)
                    stats_row = col.db.first(
                        f"SELECT count(*), "
                        f"coalesce(sum(case when ivl >= 21 then 1 else 0 end), 0), "
                        f"coalesce(sum(case when ivl < 21 and type = 2 then 1 else 0 end), 0), "
                        f"coalesce(sum(case when ivl < 21 and type in (1,3) then 1 else 0 end), 0) "
                        f"FROM cards WHERE did IN ({placeholders})",
                        *dids,
                    )
                    total_cards = int(stats_row[0] or 0) if stats_row else 0
                    n_mature = int(stats_row[1] or 0) if stats_row else 0
                    n_review = int(stats_row[2] or 0) if stats_row else 0
                    n_learning = int(stats_row[3] or 0) if stats_row else 0
                    n_new = max(0, total_cards - n_mature - n_review - n_learning)
                    weighted_mastered = n_mature * 1.0 + n_review * 0.6 + n_learning * 0.3

                mastery = (
                    min(100, max(0, round((weighted_mastered / total_cards) * 100)))
                    if total_cards > 0
                    else 0
                )
                # 返回 0–1 的比例而非百分比，避免四舍五入后四段之和不等于 100。
                mastery_breakdown = {
                    "mature": round(n_mature / total_cards, 4),
                    "review": round(n_review / total_cards, 4),
                    "learning": round(n_learning / total_cards, 4),
                    "new": round(n_new / total_cards, 4),
                } if total_cards > 0 else {
                    "mature": 0.0, "review": 0.0, "learning": 0.0, "new": 0.0,
                }

                color_idx = len(decks_out) % len(accents)
                deck_options = self._serialize_deck_options(col, did, full_name)
                deck_item = {
                    "id": str(did),
                    "parentId": str(parent_id) if parent_id is not None else None,
                    "name": name,
                    "fullName": full_name,
                    "depth": depth,
                    "isChild": depth > 0,
                    "totalCards": total_cards,
                    "dueReview": due_review,
                    "dueNew": new_count,
                    "learnCount": learn_count,
                    "reviewCount": review_count,
                    "mastery": mastery,
                    "masteryBreakdown": mastery_breakdown,
                    "icon": icons[color_idx],
                    "accent": accents[color_idx],
                    "childrenCount": len(getattr(child, "children", [])),
                    "options": deck_options,
                }
                decks_out.append(deck_item)
                if getattr(child, "children", None):
                    traverse(child, depth + 1, full_name, did)

        traverse(tree, 0, "", None)
        return decks_out

    @staticmethod
    def _format_delays_str(delays: Any, default_str: str = "1m 10m") -> str:
        if not isinstance(delays, (list, tuple)) or not delays:
            return default_str
        parts: List[str] = []
        for raw_val in delays:
            try:
                mins = float(raw_val)
            except Exception:
                continue
            if mins <= 0:
                continue
            if mins < 1.0:
                secs = max(1, round(mins * 60))
                parts.append(f"{secs}s")
            elif mins >= 1440.0 and mins % 1440.0 == 0:
                days = int(mins // 1440)
                parts.append(f"{days}d")
            elif mins >= 60.0 and mins % 60.0 == 0:
                hrs = int(mins // 60)
                parts.append(f"{hrs}h")
            elif mins.is_integer():
                parts.append(f"{int(mins)}m")
            else:
                parts.append(f"{round(mins, 1)}m")
        return " ".join(parts) if parts else default_str

    @staticmethod
    def _parse_delays_str(raw: Any, default_list: List[float]) -> List[float]:
        if isinstance(raw, (list, tuple)):
            out = []
            for x in raw:
                try:
                    v = float(x)
                    if v > 0:
                        out.append(v)
                except Exception:
                    pass
            return out if out else list(default_list)

        s = str(raw or "").strip()
        if not s:
            return list(default_list)
        import re
        tokens = [t.strip() for t in re.split(r"[\s,，]+", s) if t.strip()]
        parsed: List[float] = []
        for tok in tokens:
            m = re.match(r"^(\d+(?:\.\d+)?)\s*([smhdSMHD]?)$", tok)
            if not m:
                continue
            val = float(m.group(1))
            unit = (m.group(2) or "m").lower()
            if val <= 0:
                continue
            if unit == "s":
                mins = round(val / 60.0, 2)
            elif unit == "h":
                mins = val * 60.0
            elif unit == "d":
                mins = val * 1440.0
            else:
                mins = val
            parsed.append(max(0.1, min(43200.0, mins)))
        return parsed if parsed else list(default_list)

    def _resolve_deck_config(self, col, did: int) -> Dict[str, Any]:
        """Resolves the mutable config/preset dictionary for the given deck ID."""
        if col is None or not hasattr(col, "decks"):
            return {
                "id": 1,
                "name": "Default",
                "new": {"perDay": 20, "delays": [1.0, 10.0]},
                "rev": {"perDay": 200},
                "lapse": {"delays": [10.0], "leechFails": 8},
                "desiredRetention": 0.90,
            }

        decks_mgr = col.decks
        if hasattr(decks_mgr, "config_dict_for_deck_id"):
            try:
                conf = decks_mgr.config_dict_for_deck_id(int(did))
                if isinstance(conf, dict):
                    return conf
            except Exception:
                pass

        deck_obj = None
        try:
            deck_obj = decks_mgr.get(int(did), default=False)
        except Exception:
            pass
        conf_id = int(deck_obj.get("conf", did)) if isinstance(deck_obj, dict) else int(did)

        if hasattr(decks_mgr, "get_config"):
            try:
                conf = decks_mgr.get_config(conf_id)
                if isinstance(conf, dict):
                    return conf
            except Exception:
                pass

        if hasattr(decks_mgr, "all_config"):
            try:
                all_cfgs = decks_mgr.all_config()
                if isinstance(all_cfgs, list) and all_cfgs:
                    for c in all_cfgs:
                        if int(c.get("id", 0)) in (conf_id, int(did)):
                            return c
                    return all_cfgs[0]
            except Exception:
                pass

        store = getattr(decks_mgr, "_custom_configs", None)
        if not isinstance(store, dict):
            store = {}
            try:
                setattr(decks_mgr, "_custom_configs", store)
            except Exception:
                pass
        if int(did) not in store:
            store[int(did)] = {
                "id": int(did),
                "name": deck_obj.get("name", "Default") if isinstance(deck_obj, dict) else "Default",
                "new": {"perDay": 20, "delays": [1.0, 10.0]},
                "rev": {"perDay": 200},
                "lapse": {"delays": [10.0], "leechFails": 8},
                "desiredRetention": 0.90,
            }
        return store[int(did)]

    def _serialize_deck_options(self, col, did: int, fallback_name: str = "Default") -> Dict[str, Any]:
        deck_name = fallback_name
        if not fallback_name or fallback_name == "Default":
            if col is not None and hasattr(col, "decks") and hasattr(col.decks, "get"):
                try:
                    d_obj = col.decks.get(int(did), default=False)
                    if isinstance(d_obj, dict) and d_obj.get("name"):
                        deck_name = str(d_obj["name"])
                except Exception:
                    pass

        conf = self._resolve_deck_config(col, int(did))
        new_cfg = conf.get("new") if isinstance(conf.get("new"), dict) else {}
        rev_cfg = conf.get("rev") if isinstance(conf.get("rev"), dict) else {}
        lapse_cfg = conf.get("lapse") if isinstance(conf.get("lapse"), dict) else {}

        new_per_day = int(new_cfg.get("perDay", 20) if new_cfg.get("perDay") is not None else 20)
        rev_per_day = int(rev_cfg.get("perDay", 200) if rev_cfg.get("perDay") is not None else 200)
        learn_steps = self._format_delays_str(new_cfg.get("delays"), "1m 10m")
        relearn_steps = self._format_delays_str(lapse_cfg.get("delays"), "10m")
        leech_fails = int(lapse_cfg.get("leechFails", 8) or 8)

        raw_ret = conf.get("desiredRetention", conf.get("sm2Retention", 0.90))
        try:
            desired_ret = round(max(0.70, min(0.97, float(raw_ret or 0.90))), 2)
        except Exception:
            desired_ret = 0.90

        return {
            "deckId": str(did),
            "deckName": deck_name,
            "presetId": str(conf.get("id", 1)),
            "presetName": str(conf.get("name", "Default")),
            "newPerDay": max(0, min(9999, new_per_day)),
            "revPerDay": max(0, min(9999, rev_per_day)),
            "learningSteps": learn_steps,
            "relearningSteps": relearn_steps,
            "leechThreshold": max(1, min(99, leech_fails)),
            "desiredRetention": desired_ret,
        }

    def get_deck_options(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Returns scheduling preset & FSRS options for a given deck."""
        data = data or {}
        deck_id_raw = str(data.get("deckId", "1") or "1").strip()
        did = int(deck_id_raw) if deck_id_raw.isdigit() else 1
        col = self.col
        if col is None:
            return {
                "success": False,
                "error": "Collection unavailable",
                "options": self._serialize_deck_options(None, did),
            }
        return {
            "success": True,
            "options": self._serialize_deck_options(col, did),
        }

    def save_deck_options(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Persists deck daily limits, learning steps, leech threshold, and FSRS desired retention."""
        data = data or {}
        deck_id_raw = str(data.get("deckId", "") or "").strip()
        if not deck_id_raw.isdigit():
            return {"saved": False, "error": "Valid numeric deckId is required"}

        did = int(deck_id_raw)
        col = self.col
        if col is None:
            return {"saved": False, "error": "Collection unavailable"}

        conf = self._resolve_deck_config(col, did)
        if not isinstance(conf.get("new"), dict):
            conf["new"] = {"perDay": 20, "delays": [1.0, 10.0]}
        if not isinstance(conf.get("rev"), dict):
            conf["rev"] = {"perDay": 200}
        if not isinstance(conf.get("lapse"), dict):
            conf["lapse"] = {"delays": [10.0], "leechFails": 8}

        if "newPerDay" in data and data["newPerDay"] is not None:
            try:
                conf["new"]["perDay"] = max(0, min(9999, int(data["newPerDay"])))
            except Exception:
                pass

        if "revPerDay" in data and data["revPerDay"] is not None:
            try:
                conf["rev"]["perDay"] = max(0, min(9999, int(data["revPerDay"])))
            except Exception:
                pass

        if "learningSteps" in data and data["learningSteps"] is not None:
            conf["new"]["delays"] = self._parse_delays_str(data["learningSteps"], [1.0, 10.0])

        if "relearningSteps" in data and data["relearningSteps"] is not None:
            conf["lapse"]["delays"] = self._parse_delays_str(data["relearningSteps"], [10.0])

        if "leechThreshold" in data and data["leechThreshold"] is not None:
            try:
                conf["lapse"]["leechFails"] = max(1, min(99, int(data["leechThreshold"])))
            except Exception:
                pass

        if "desiredRetention" in data and data["desiredRetention"] is not None:
            try:
                ret_val = float(data["desiredRetention"])
                if ret_val > 1.0:
                    ret_val = ret_val / 100.0
                ret_clamped = round(max(0.70, min(0.97, ret_val)), 2)
                conf["desiredRetention"] = ret_clamped
                conf["sm2Retention"] = ret_clamped
            except Exception:
                pass

        try:
            if hasattr(col.decks, "update_config"):
                col.decks.update_config(conf)
            elif hasattr(col.decks, "save"):
                col.decks.save(conf)
            if hasattr(col, "save") and not hasattr(col, "_backend"):
                col.save()
        except Exception:
            pass

        return {
            "saved": True,
            "deckId": str(did),
            "options": self._serialize_deck_options(col, did),
        }

    def _build_heatmap_and_streak(self, col, cutoff: int, lang: str = "zh-CN") -> Dict[str, Any]:
        """Calculates 365-day review matrix, per-day accuracy, streak, and 7-day summary metrics."""
        cfg = self._get_config()
        frozen_dates = set(effective_frozen_dates(cfg))

        today_start_sec = cutoff - 86400
        start_365_sec = today_start_sec - (364 * 86400)
        rows = col.db.all(
            "SELECT CAST((id / 1000 - ?) / 86400 AS INT) as day_idx, count(*), "
            "sum(case when ease > 1 then 1 else 0 end) "
            "FROM revlog WHERE id >= ? AND type < 4 AND ease > 0 GROUP BY day_idx",
            start_365_sec,
            start_365_sec * 1000,
        )
        day_map: Dict[int, Dict[str, int]] = {}
        total_year_reviews = 0
        for r in rows:
            d_idx = int(r[0])
            cnt = int(r[1] or 0)
            corr = int(r[2] or 0)
            if 0 <= d_idx <= 365:
                day_map[d_idx] = {"count": cnt, "correct": corr}
                total_year_reviews += cnt

        today_date = datetime.date.fromtimestamp(today_start_sec)
        cells = []
        for i in range(365):
            d = today_date - datetime.timedelta(days=(364 - i))
            d_str = d.isoformat()
            is_frozen = d_str in frozen_dates
            info = day_map.get(i, {"count": 0, "correct": 0})
            cnt = info["count"]
            corr = info["correct"]
            acc = round((corr / cnt) * 100) if cnt > 0 else 0
            level = 0 if cnt == 0 else (1 if cnt < 15 else (2 if cnt < 35 else (3 if cnt < 65 else 4)))
            cells.append({
                "date": d_str,
                "count": cnt,
                "accuracy": acc,
                "level": level,
                "isStreakFrozen": is_frozen,
            })

        recent_day_offsets = {
            d_idx - 364
            for d_idx, info in day_map.items()
            if info.get("count", 0) > 0
        }
        older_days_rows = col.db.all(
            "SELECT DISTINCT CAST((id / 1000 - ?) / 86400 AS INT) as d "
            "FROM revlog WHERE id < ? AND type < 4 AND ease > 0",
            today_start_sec,
            start_365_sec * 1000,
        )
        older_day_offsets = {int(r[0]) for r in older_days_rows if r[0] is not None}
        day_set = recent_day_offsets | older_day_offsets
        day_offsets = sorted(day_set)

        def is_day_active(d_off: int) -> bool:
            if d_off in day_set:
                return True
            d_iso = (today_date + datetime.timedelta(days=d_off)).isoformat()
            return d_iso in frozen_dates

        current_streak = 0
        cursor = 0 if is_day_active(0) else (-1 if is_day_active(-1) else None)
        if cursor is not None:
            while is_day_active(cursor):
                current_streak += 1
                cursor -= 1

        longest_streak = 0
        run = 0
        prev = None
        for d in day_offsets:
            if prev is None or d == prev + 1:
                run += 1
            else:
                run = 1
            if run > longest_streak:
                longest_streak = run
            prev = d

        week_reviews = sum(day_map.get(364 - i, {"count": 0})["count"] for i in range(7))
        week_correct = sum(day_map.get(364 - i, {"correct": 0})["correct"] for i in range(7))
        prev_week_reviews = sum(day_map.get(364 - i, {"count": 0})["count"] for i in range(7, 14))

        weekday_idx = today_date.weekday()
        week_active_days = sum(
            1
            for i in range(weekday_idx + 1)
            if (
                day_map.get(364 - i, {"count": 0})["count"] > 0
                or (today_date - datetime.timedelta(days=i)).isoformat() in frozen_dates
            )
        )

        retention_rate = round((week_correct / week_reviews) * 100) if week_reviews > 0 else 0
        if prev_week_reviews > 0:
            wow_growth = round(((week_reviews - prev_week_reviews) / prev_week_reviews) * 100)
            prefix = "较上周 " if lang == "zh-CN" else "vs last wk "
            wow_change_str = f"{prefix}+{wow_growth}%" if wow_growth >= 0 else f"{prefix}{wow_growth}%"
        elif week_reviews > 0:
            wow_change_str = "+100%"
        else:
            wow_change_str = "--"

        return {
            "streak": {
                "current": current_streak,
                "longest": max(longest_streak, current_streak),
                "weekActiveDays": week_active_days,
                "weekTotalDays": 7,
            },
            "heatmap": {
                "totalYearReviews": total_year_reviews,
                "weekTotalCards": week_reviews,
                "dailyAverage": round(week_reviews / 7),
                "retentionRate": retention_rate,
                "wowChange": wow_change_str,
                "cells": cells,
            },
        }

    def _build_weekly_rhythm(
        self, col, cutoff: int, avg_sec_per_card: float, lang: str = "zh-CN"
    ) -> Dict[str, Any]:
        """Builds the 7-day bar chart data (Monday..Sunday of current week) in a single SQL query."""
        today_start_sec = cutoff - 86400
        today_date = datetime.date.fromtimestamp(today_start_sec)
        weekday_idx = today_date.weekday()
        monday_sec = today_start_sec - (weekday_idx * 86400)
        monday_ms = monday_sec * 1000
        next_monday_ms = (monday_sec + 7 * 86400) * 1000

        week_rows = col.db.all(
            "SELECT CAST((id - ?) / 86400000 AS INT) as d_idx, count(*), coalesce(sum(time), 0) "
            "FROM revlog WHERE id >= ? AND id < ? AND type < 4 AND ease > 0 GROUP BY d_idx",
            monday_ms,
            monday_ms,
            next_monday_ms,
        )
        w_map = {int(r[0]): (int(r[1] or 0), int(r[2] or 0)) for r in week_rows if r[0] is not None}

        labels = self._get_weekday_short_labels(lang)
        days_list = []
        max_session_minutes = 0

        for i in range(7):
            cnt, t_ms = w_map.get(i, (0, 0))
            mins = round(t_ms / 60000.0) if t_ms > 0 else 0
            if cnt > 0 and mins == 0:
                mins = 1
            if mins > max_session_minutes:
                max_session_minutes = mins
            days_list.append({
                "label": labels[i],
                "count": cnt,
                "minutes": mins,
                "isToday": i == weekday_idx,
                "date": (today_date - datetime.timedelta(days=(weekday_idx - i))).isoformat(),
            })

        return {
            "days": days_list,
            "avgSecondsPerCard": avg_sec_per_card,
            "longestSessionMinutes": max_session_minutes,
        }

    def create_deck(self, data: Dict[str, Any]) -> Dict[str, Any]:
        name = (data or {}).get("name", "").strip()
        if not name:
            raise ValueError("Deck name cannot be empty")
        col = self.col
        if col is None:
            return {"id": str(int(time.time() * 1000)), "name": name}
        out = col.decks.add_normal_deck_with_name(name)
        return {"id": str(out.id), "name": name}

    def rename_deck(self, data: Dict[str, Any]) -> Dict[str, Any]:
        deck_id_raw = str(data.get("deckId", ""))
        new_name = str(data.get("name", "")).strip()
        if not new_name:
            raise ValueError("New deck name cannot be empty")
        col = self.col
        if col and deck_id_raw.isdigit():
            did = int(deck_id_raw)
            if "::" not in new_name:
                existing = col.decks.get(did, default=False)
                if existing and "::" in existing.get("name", ""):
                    parent_prefix = existing["name"].rsplit("::", 1)[0]
                    new_name = f"{parent_prefix}::{new_name}"
            col.decks.rename(did, new_name)
        return {"id": deck_id_raw, "name": new_name}

    def delete_deck(self, data: Dict[str, Any]) -> Dict[str, Any]:
        deck_id_raw = str(data.get("deckId", ""))
        col = self.col
        if col and deck_id_raw.isdigit():
            col.decks.remove([int(deck_id_raw)])
        return {"deleted": True, "deckId": deck_id_raw}

    # ---- Import / Export & System Maintenance Tools ----

    def trigger_native_import(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Invokes Anki's native file import dialog (.apkg / .colpkg / .txt / .csv)."""
        lang = self._resolve_language((data or {}).get("language"))
        mw = self.mw
        triggered = False
        if mw is not None:
            try:
                if hasattr(mw, "onImport"):
                    mw.onImport()
                    triggered = True
                elif hasattr(mw, "on_import"):
                    mw.on_import()
                    triggered = True
                else:
                    try:
                        import aqt.importing
                        if hasattr(aqt.importing, "on_import"):
                            aqt.importing.on_import(mw)
                            triggered = True
                    except ImportError:
                        pass
            except Exception as e:
                return {
                    "success": False,
                    "triggered": False,
                    "error": str(e),
                }
        return {
            "success": True,
            "triggered": triggered,
            "message": (
                "已唤起 Anki 原生导入向导（支持 .apkg / .colpkg / 文本卡片包）"
                if lang == "zh-CN"
                else "Opened native Anki Import dialog (.apkg / .colpkg / text)"
            ),
        }

    def trigger_native_export(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Invokes Anki's native export dialog (.apkg / .colpkg / notes)."""
        lang = self._resolve_language((data or {}).get("language"))
        mw = self.mw
        triggered = False
        if mw is not None:
            try:
                if hasattr(mw, "onExport"):
                    mw.onExport()
                    triggered = True
                elif hasattr(mw, "on_export"):
                    mw.on_export()
                    triggered = True
                else:
                    try:
                        import aqt.exporting
                        if hasattr(aqt.exporting, "on_export"):
                            aqt.exporting.on_export(mw)
                            triggered = True
                    except ImportError:
                        pass
            except Exception as e:
                return {
                    "success": False,
                    "triggered": False,
                    "error": str(e),
                }
        return {
            "success": True,
            "triggered": triggered,
            "message": (
                "已唤起 Anki 原生导出向导（支持导出 .apkg 牌组包或 .colpkg 集合备份）"
                if lang == "zh-CN"
                else "Opened native Anki Export dialog (.apkg / .colpkg)"
            ),
        }

    def _scan_empty_cards(self, col) -> List[Dict[str, Any]]:
        """Scans the collection for empty cards (blank front or missing Cloze ordinal)."""
        if col is None:
            return []

        import re
        empty_items: List[Dict[str, Any]] = []
        seen_cids = set()

        if hasattr(col, "empty_cards"):
            try:
                rep = col.empty_cards()
                native_cids = getattr(rep, "cids", None) or (rep if isinstance(rep, (list, tuple)) else [])
                for cid in native_cids:
                    c_int = int(cid)
                    if c_int not in seen_cids:
                        seen_cids.add(c_int)
                        empty_items.append({"cardId": str(c_int), "noteId": "", "reason": "native_empty"})
            except Exception:
                pass

        all_cids = list(col.find_cards("")) if hasattr(col, "find_cards") else []
        for cid in all_cids:
            c_int = int(cid)
            if c_int in seen_cids:
                continue
            try:
                card = col.get_card(c_int)
                if card is None:
                    continue
                note = col.get_note(card.nid) if hasattr(col, "get_note") else card.note()
                if note is None:
                    seen_cids.add(c_int)
                    empty_items.append({"cardId": str(c_int), "noteId": "", "reason": "orphaned_note"})
                    continue

                flds_dict = dict(note.items())
                flds_vals = list(flds_dict.values())
                front_raw = (flds_vals[0] if flds_vals else "").strip()
                front_plain = re.sub(r"<[^>]+>", "", front_raw).strip()
                has_img_or_sound = bool(re.search(r"<img\b|\[sound:", front_raw, flags=re.I))

                model = note.note_type() if hasattr(note, "note_type") else {"type": 0}
                is_cloze = bool(model and model.get("type") == 1)

                if not front_plain and not has_img_or_sound:
                    seen_cids.add(c_int)
                    empty_items.append({
                        "cardId": str(c_int),
                        "noteId": str(note.id),
                        "reason": "empty_front",
                    })
                elif is_cloze:
                    target_ord = int(getattr(card, "ord", 0) or 0) + 1
                    all_text = "\n".join(flds_vals)
                    if not re.search(rf"\{{\{{c{target_ord}::", all_text):
                        seen_cids.add(c_int)
                        empty_items.append({
                            "cardId": str(c_int),
                            "noteId": str(note.id),
                            "reason": f"missing_c{target_ord}",
                        })
            except Exception:
                continue

        return empty_items

    def _scan_media_health(self, col) -> Dict[str, Any]:
        """Scans collection.media directory vs. note field references (<img src> and [sound:])."""
        import os
        import re
        import urllib.parse

        media_dir = ""
        if col is not None and hasattr(col, "media") and hasattr(col.media, "dir"):
            try:
                media_dir = str(col.media.dir() or "")
            except Exception:
                media_dir = ""

        disk_files = set()
        if media_dir and os.path.isdir(media_dir):
            try:
                for fname in os.listdir(media_dir):
                    if fname.startswith("."):
                        continue
                    full_p = os.path.join(media_dir, fname)
                    if os.path.isfile(full_p):
                        disk_files.add(fname)
            except Exception:
                pass

        referenced_files = set()
        if col is not None and hasattr(col, "db") and hasattr(col.db, "all"):
            try:
                rows = col.db.all("SELECT flds FROM notes")
                img_re = re.compile(r'<img\b[^>]*?\bsrc\s*=\s*(["\'])([^"\']+)\1', flags=re.I)
                data_media_re = re.compile(r'\bdata-anki-media\s*=\s*(["\'])([^"\']+)\1', flags=re.I)
                snd_re = re.compile(r"\[sound:([^\]]+)\]")

                for r in rows:
                    flds_str = str(r[0] or "")
                    for m in img_re.finditer(flds_str):
                        raw_src = m.group(2).strip()
                        if raw_src.startswith(("http://", "https://", "data:")):
                            continue
                        clean_name = os.path.basename(urllib.parse.unquote(raw_src))
                        if clean_name:
                            referenced_files.add(clean_name)
                    for m in data_media_re.finditer(flds_str):
                        clean_name = os.path.basename(urllib.parse.unquote(m.group(2).strip()))
                        if clean_name:
                            referenced_files.add(clean_name)
                    for m in snd_re.finditer(flds_str):
                        clean_name = m.group(1).strip()
                        if clean_name:
                            referenced_files.add(clean_name)
            except Exception:
                pass

        unused_list = sorted(disk_files - referenced_files)
        missing_list = sorted(referenced_files - disk_files)

        return {
            "mediaDir": media_dir,
            "totalFiles": len(disk_files),
            "referencedCount": len(referenced_files),
            "unusedCount": len(unused_list),
            "missingCount": len(missing_list),
            "unusedFiles": unused_list[:25],
            "missingFiles": missing_list[:25],
            "_allUnusedFiles": unused_list,
        }

    def run_maintenance_action(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Executes in-app system maintenance diagnostics and cleanup."""
        data = data or {}
        tool_type = str(data.get("toolType", "check_db") or "check_db").strip()
        lang = self._resolve_language(data.get("language"))
        col = self.col
        mw = self.mw

        if tool_type == "open_native_tool":
            target = str(data.get("target", "") or "").strip()
            triggered = False
            if mw is not None:
                try:
                    if target == "check_db" and hasattr(mw, "onCheckDB"):
                        mw.onCheckDB()
                        triggered = True
                    elif target == "empty_cards" and hasattr(mw, "onEmptyCards"):
                        mw.onEmptyCards()
                        triggered = True
                    elif target == "check_media" and hasattr(mw, "onMediaCheck"):
                        mw.onMediaCheck()
                        triggered = True
                except Exception:
                    pass
            return {"success": True, "toolType": tool_type, "target": target, "triggered": triggered}

        if col is None:
            return {
                "success": False,
                "toolType": tool_type,
                "error": "Collection unavailable",
            }

        if tool_type == "check_db":
            integrity_str = "ok"
            try:
                if hasattr(col, "db") and hasattr(col.db, "scalar"):
                    integrity_str = str(col.db.scalar("PRAGMA quick_check") or "ok")
                elif hasattr(col, "db") and hasattr(col.db, "first"):
                    r = col.db.first("PRAGMA quick_check")
                    integrity_str = str(r[0] if r else "ok")
                if hasattr(col, "db") and hasattr(col.db, "execute"):
                    col.db.execute("ANALYZE")
            except Exception as e:
                integrity_str = f"checked ({e})"

            c_row = col.db.first("SELECT count(*) FROM cards") if hasattr(col, "db") else (0,)
            n_row = col.db.first("SELECT count(*) FROM notes") if hasattr(col, "db") else (0,)
            r_row = col.db.first("SELECT count(*) FROM revlog WHERE type < 4 AND ease > 0") if hasattr(col, "db") else (0,)

            card_cnt = int(c_row[0] or 0) if c_row else 0
            note_cnt = int(n_row[0] or 0) if n_row else 0
            rev_cnt = int(r_row[0] or 0) if r_row else 0
            is_healthy = integrity_str.lower() == "ok"

            return {
                "success": True,
                "toolType": "check_db",
                "status": "ok" if is_healthy else "warning",
                "integrityResult": integrity_str,
                "cardCount": card_cnt,
                "noteCount": note_cnt,
                "revlogCount": rev_cnt,
                "message": (
                    f"数据库完整性校验通过（OK）：共 {card_cnt} 张卡片、{note_cnt} 条笔记、{rev_cnt} 条有效复习记录，已完成索引优化"
                    if lang == "zh-CN"
                    else f"Database check passed ({integrity_str}): {card_cnt} cards, {note_cnt} notes, {rev_cnt} reviews optimized."
                ),
            }

        if tool_type == "check_empty_cards":
            empty_items = self._scan_empty_cards(col)
            cnt = len(empty_items)
            return {
                "success": True,
                "toolType": "check_empty_cards",
                "emptyCount": cnt,
                "emptyCards": empty_items[:30],
                "message": (
                    (f"扫描完成：发现 {cnt} 张空白或缺失挖空序号的卡片，可一键清理" if cnt > 0 else "扫描完成：当前集合没有空白卡片或失效挖空卡")
                    if lang == "zh-CN"
                    else (f"Found {cnt} empty cards ready to clean." if cnt > 0 else "No empty cards found.")
                ),
            }

        if tool_type == "clean_empty_cards":
            empty_items = self._scan_empty_cards(col)
            cids_to_remove = [int(item["cardId"]) for item in empty_items if str(item.get("cardId", "")).isdigit()]
            removed_cnt = 0
            if cids_to_remove:
                if hasattr(col, "rem_cards"):
                    try:
                        col.rem_cards(cids_to_remove)
                        removed_cnt = len(cids_to_remove)
                    except Exception:
                        pass
                if removed_cnt == 0:
                    try:
                        if hasattr(col, "db") and hasattr(col.db, "conn"):
                            placeholders = ",".join("?" for _ in cids_to_remove)
                            col.db.conn.execute(
                                f"DELETE FROM cards WHERE id IN ({placeholders})",
                                tuple(cids_to_remove),
                            )
                            col.db.conn.execute(
                                "DELETE FROM notes WHERE id NOT IN (SELECT DISTINCT nid FROM cards)"
                            )
                            col.db.conn.commit()
                            removed_cnt = len(cids_to_remove)
                    except Exception:
                        pass
            return {
                "success": True,
                "toolType": "clean_empty_cards",
                "removedCount": removed_cnt,
                "emptyCount": 0,
                "message": (
                    f"已成功清理 {removed_cnt} 张空白/失效卡片"
                    if lang == "zh-CN"
                    else f"Cleaned {removed_cnt} empty cards."
                ),
            }

        if tool_type == "check_media":
            report = self._scan_media_health(col)
            unused_cnt = report["unusedCount"]
            missing_cnt = report["missingCount"]
            total_f = report["totalFiles"]
            return {
                "success": True,
                "toolType": "check_media",
                "totalFiles": total_f,
                "referencedCount": report["referencedCount"],
                "unusedCount": unused_cnt,
                "missingCount": missing_cnt,
                "unusedFiles": report["unusedFiles"],
                "missingFiles": report["missingFiles"],
                "message": (
                    f"媒体库扫描完成：共 {total_f} 个文件，未引用冗余文件 {unused_cnt} 个，缺失引用 {missing_cnt} 个"
                    if lang == "zh-CN"
                    else f"Media check complete: {total_f} files, {unused_cnt} unused, {missing_cnt} missing."
                ),
            }

        if tool_type == "clean_unused_media":
            import os
            report = self._scan_media_health(col)
            unused_all = report.get("_allUnusedFiles", [])
            media_dir = report.get("mediaDir", "")
            removed_cnt = 0
            if unused_all and col is not None and hasattr(col, "media") and hasattr(col.media, "trash_files"):
                try:
                    col.media.trash_files(unused_all)
                    removed_cnt = len(unused_all)
                except Exception:
                    pass
            if removed_cnt == 0 and unused_all and media_dir and os.path.isdir(media_dir):
                for fname in unused_all:
                    try:
                        os.remove(os.path.join(media_dir, fname))
                        removed_cnt += 1
                    except Exception:
                        pass
            return {
                "success": True,
                "toolType": "clean_unused_media",
                "removedCount": removed_cnt,
                "unusedCount": 0,
                "message": (
                    f"已清理 {removed_cnt} 个未引用的冗余媒体文件"
                    if lang == "zh-CN"
                    else f"Cleaned {removed_cnt} unused media files."
                ),
            }

        return {
            "success": False,
            "toolType": tool_type,
            "error": f"Unknown maintenance toolType: {tool_type}",
        }

    @staticmethod
    def _get_greeting(hour: int, lang: str = "zh-CN") -> str:
        slot = 0 if 5 <= hour < 12 else (1 if 12 <= hour < 18 else 2)
        greetings = {
            "zh-CN": ("上午好", "下午好", "晚上好"),
            "zh-TW": ("早安", "午安", "晚安"),
            "en": ("Good morning", "Good afternoon", "Good evening"),
            "ja": ("おはようございます", "こんにちは", "こんばんは"),
            "ko": ("좋은 아침입니다", "안녕하세요", "좋은 저녁입니다"),
            "es": ("Buenos días", "Buenas tardes", "Buenas noches"),
            "fr": ("Bonjour", "Bon après-midi", "Bonsoir"),
            "de": ("Guten Morgen", "Guten Tag", "Guten Abend"),
            "ru": ("Доброе утро", "Добрый день", "Добрый вечер"),
            "pt-BR": ("Bom dia", "Boa tarde", "Boa noite"),
            "it": ("Buongiorno", "Buon pomeriggio", "Buonasera"),
            "ar": ("صباح الخير", "مساء الخير", "مساء الخير"),
            "vi": ("Chào buổi sáng", "Chào buổi chiều", "Chào buổi tối"),
            "tr": ("Günaydın", "İyi günler", "İyi akşamlar"),
            "pl": ("Dzień dobry", "Dzień dobry", "Dobry wieczór"),
            "nl": ("Goedemorgen", "Goedemiddag", "Goedenavond"),
        }
        return greetings.get(lang, greetings["en"])[slot]

    @staticmethod
    def _get_weekday_short_labels(lang: str = "zh-CN") -> List[str]:
        table = {
            "zh-CN": ["一", "二", "三", "四", "五", "六", "日"],
            "zh-TW": ["一", "二", "三", "四", "五", "六", "日"],
            "ja": ["月", "火", "水", "木", "金", "土", "日"],
            "ko": ["월", "화", "수", "목", "금", "토", "일"],
            "es": ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
            "fr": ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
            "de": ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
            "ru": ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
            "pt-BR": ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
            "it": ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"],
            "ar": ["إثن", "ثلا", "أرب", "خمي", "جمع", "سبت", "أحد"],
            "vi": ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
            "tr": ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"],
            "pl": ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"],
            "nl": ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
        }
        return table.get(lang, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])

    @staticmethod
    def _format_date_display(dt: datetime.datetime, lang: str = "zh-CN") -> str:
        if lang == "zh-CN":
            weekdays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
            return f"{dt.month}月{dt.day}日 {weekdays[dt.weekday()]}"
        if lang == "zh-TW":
            weekdays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
            return f"{dt.month}月{dt.day}日 {weekdays[dt.weekday()]}"
        if lang == "ja":
            weekdays = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"]
            return f"{dt.month}月{dt.day}日 ({weekdays[dt.weekday()]})"
        if lang == "ko":
            weekdays = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]
            return f"{dt.month}월 {dt.day}일 {weekdays[dt.weekday()]}"
        short_wd = DeckService._get_weekday_short_labels(lang)[dt.weekday()]
        if lang == "en":
            return dt.strftime("%b %d, %A")
        return f"{dt.day:02d}/{dt.month:02d} · {short_wd}"

    @staticmethod
    def _empty_advanced_stats(lang: str = "zh-CN") -> Dict[str, Any]:
        today_label = "今天" if lang == "zh-CN" else "Today"

        def empty_tr():
            return {
                "young": {"pass": 0, "total": 0, "rate": 0.0},
                "mature": {"pass": 0, "total": 0, "rate": 0.0},
                "overall": {"pass": 0, "total": 0, "rate": 0.0},
            }

        return {
            "maturityBreakdown": {
                "newCards": 0,
                "learning": 0,
                "young": 0,
                "mature": 0,
                "suspended": 0,
                "buried": 0,
                "total": 0,
            },
            "forecast30d": [
                {
                    "dayOffset": i,
                    "label": today_label if i == 0 else f"+{i}d",
                    "total": 0,
                    "mature": 0,
                    "young": 0,
                }
                for i in range(30)
            ],
            "retentionCurve": [
                {
                    "period": ("本周" if i == 11 else f"{11 - i}周前") if lang == "zh-CN" else ("Now" if i == 11 else f"-{11 - i}w"),
                    "retentionRate": 0.0,
                    "lapseRate": 0.0,
                    "reviews": 0,
                }
                for i in range(12)
            ],
            "hourlyDistribution": [
                {"hour": f"{h:02d}:00", "count": 0, "accuracy": 0}
                for h in range(24)
            ],
            "answerButtons": {
                "again": 0,
                "hard": 0,
                "good": 0,
                "easy": 0,
                "total": 0,
                "young": {"pass": 0, "total": 0, "rate": 0.0},
                "mature": {"pass": 0, "total": 0, "rate": 0.0},
            },
            "trueRetention": {"last30d": empty_tr(), "allTime": empty_tr()},
            "dailyLoad": 0.0,
        }

    @classmethod
    def _empty_dashboard(
        cls, lang: str, profile_name: str, env_info: Dict[str, str], cfg: Dict[str, Any]
    ) -> Dict[str, Any]:
        now = datetime.datetime.now()
        labels = cls._get_weekday_short_labels(lang)
        return {
            "userName": profile_name,
            "greeting": cls._get_greeting(now.hour, lang),
            "dateDisplay": cls._format_date_display(now, lang),
            "synced": False,
            "syncedAt": 0,
            "language": lang,
            "envInfo": env_info,
            "preferences": {
                "theme": cfg.get("theme", "light"),
                "accentColor": cfg.get("accent_color", "indigo"),
                "language": cfg.get("language", "auto"),
                "customNickname": cfg.get("custom_nickname", ""),
                "collapsedDeckIds": cfg.get("collapsed_deck_ids", []),
                "sandboxNoteTypeIds": [str(x) for x in (cfg.get("sandbox_notetype_ids") or [])],
                "showShortcutHints": bool(cfg.get("show_shortcut_hints", False)),
                "tipsDismissed": bool(cfg.get("dashboard_tips_dismissed", False)),
                "debugMode": bool(cfg.get("debug_mode", False)),
            },
            "vacation": {
                "isActive": False,
                "startDate": "",
                "endDate": "",
                "days": 0,
                "remainingDays": 0,
                "reason": "",
                "freezeNewCards": True,
                "frozenDates": [],
                "shiftedCardCount": 0,
                "createdAt": "",
            },
            "backlog": {
                "totalDue": 0,
                "overdueCount": 0,
                "hasAvalanche": False,
                "suggestedDays": 7,
            },
            "lastRescueReceipt": cfg.get("last_rescue_receipt"),
            "todayStats": {
                "completed": 0,
                "totalTodayWorkload": 0,
                "dailyGoal": 0,
                "remainingForGoal": 0,
                "estimatedMinutes": 0,
                "dueReview": 0,
                "dueNew": 0,
                "totalPending": 0,
                "correctRateToday": 0,
            },
            "streak": {
                "current": 0,
                "longest": 0,
                "weekActiveDays": 0,
                "weekTotalDays": 7,
            },
            "decks": [],
            "heatmap": {
                "totalYearReviews": 0,
                "weekTotalCards": 0,
                "dailyAverage": 0,
                "retentionRate": 0,
                "wowChange": "--",
                "cells": [
                    {
                        "date": (now.date() - datetime.timedelta(days=(364 - i))).isoformat(),
                        "count": 0,
                        "accuracy": 0,
                        "level": 0,
                    }
                    for i in range(365)
                ],
            },
            "weeklyRhythm": {
                "days": [
                    {"label": labels[i], "count": 0, "minutes": 0, "isToday": i == now.weekday(), "date": ""}
                    for i in range(7)
                ],
                "avgSecondsPerCard": 0.0,
                "longestSessionMinutes": 0,
            },
            "advancedStats": cls._empty_advanced_stats(lang),
        }
