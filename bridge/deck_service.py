# -*- coding: utf-8 -*-
"""
Anki Modern OS — Deck, Dashboard & Statistics Service
Provides deck lists (including hierarchical Parent::Child trees), mastery scores,
dynamic daily workload progress (`completed + dueReview + dueNew`), streak calculation,
365-day review heatmap (with per-day accuracy), 7-day weekly rhythm (with per-day minutes),
comprehensive Statistics, and Anki client environment detection.
"""

from __future__ import annotations

import datetime
import sys
import time
from typing import Any, Callable, Dict, List, Optional


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
        """Resolves effective UI language: 'zh-CN' or 'en' (defaulting to English for global fallback)."""
        cfg = self._get_config()
        pref = override_lang or cfg.get("language", "auto")
        if pref in ("zh-CN", "zh_CN", "zh-TW", "zh_TW", "zh"):
            return "zh-CN"
        if pref in ("en", "en-US", "en_US", "en_GB"):
            return "en"

        try:
            import anki.lang
            anki_lang = getattr(anki.lang, "current_lang", "") or ""
            if anki_lang.lower().startswith("zh"):
                return "zh-CN"
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
        }

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

            row = col.db.first(
                "SELECT count(*), coalesce(sum(time), 0), coalesce(sum(case when ease > 1 then 1 else 0 end), 0) "
                "FROM revlog WHERE id >= ?",
                today_start_ms,
            )
            completed_today = int(row[0] or 0) if row else 0
            correct_today = int(row[2] or 0) if row else 0

            recent_speed_row = col.db.first(
                "SELECT avg(time) FROM (SELECT time FROM revlog WHERE time > 0 AND time < 60000 ORDER BY id DESC LIMIT 200)"
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
            advanced_stats = self.get_statistics({"language": lang})

            # Vacation & Backlog state resolution
            vacation_cfg = cfg.get("vacation_state", {})
            is_vacation_active = bool(vacation_cfg.get("active", False))
            vacation_remaining_days = 0
            if is_vacation_active and vacation_cfg.get("end_date"):
                try:
                    v_end = datetime.date.fromisoformat(vacation_cfg["end_date"])
                    v_delta = (v_end - datetime.date.today()).days
                    vacation_remaining_days = max(1, v_delta + 1) if v_delta >= 0 else 0
                except Exception:
                    vacation_remaining_days = int(vacation_cfg.get("days", 0))

            overdue_count = 0
            try:
                # Query overdue cards if supported
                overdue_cids = col.find_cards("is:due is:review prop:due<0") if hasattr(col, "find_cards") else []
                overdue_count = len(overdue_cids)
            except Exception:
                overdue_count = total_due_review

            has_avalanche = overdue_count >= 30 or (total_due_review + total_due_new) >= 60

            return {
                "userName": profile_name,
                "greeting": self._get_greeting(now.hour, lang),
                "dateDisplay": self._format_date_display(now, lang),
                "synced": True,
                "syncedAt": int(time.time() * 1000),
                "language": lang,
                "envInfo": env_info,
                "preferences": {
                    "theme": cfg.get("theme", "light"),
                    "accentColor": cfg.get("accent_color", "indigo"),
                    "language": cfg.get("language", "auto"),
                    "customNickname": cfg.get("custom_nickname", ""),
                    "collapsedDeckIds": cfg.get("collapsed_deck_ids", []),
                    "showShortcutHints": bool(cfg.get("show_shortcut_hints", False)),
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
                    "frozenDates": list(vacation_cfg.get("frozen_dates", [])),
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

            # 1. Card Maturity Breakdown
            m_row = col.db.first(
                "SELECT "
                "coalesce(sum(case when queue = -1 then 1 else 0 end), 0), "
                "coalesce(sum(case when queue >= 0 and type = 0 then 1 else 0 end), 0), "
                "coalesce(sum(case when queue >= 0 and type in (1, 3) then 1 else 0 end), 0), "
                "coalesce(sum(case when queue >= 0 and type = 2 and ivl < 21 then 1 else 0 end), 0), "
                "coalesce(sum(case when queue >= 0 and type = 2 and ivl >= 21 then 1 else 0 end), 0) "
                "FROM cards"
            )
            suspended_cnt = int(m_row[0] or 0) if m_row else 0
            new_cnt = int(m_row[1] or 0) if m_row else 0
            learning_cnt = int(m_row[2] or 0) if m_row else 0
            young_cnt = int(m_row[3] or 0) if m_row else 0
            mature_cnt = int(m_row[4] or 0) if m_row else 0

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

            # 3. 12-Week Historical Retention & Lapse Rate Curve
            retention_curve = []
            for w in range(11, -1, -1):
                w_end_sec = cutoff - (w * 7 * 86400)
                w_start_sec = w_end_sec - (7 * 86400)
                r_row = col.db.first(
                    "SELECT count(*), sum(case when ease > 1 then 1 else 0 end) "
                    "FROM revlog WHERE id >= ? AND id < ?",
                    w_start_sec * 1000,
                    w_end_sec * 1000,
                )
                w_total = int(r_row[0] or 0) if r_row else 0
                w_pass = int(r_row[1] or 0) if r_row else 0
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

            # 4. 24-Hour Study Time Distribution
            hour_rows = col.db.all(
                "SELECT CAST(strftime('%H', id / 1000, 'unixepoch', 'localtime') AS INT) as hr, "
                "count(*), sum(case when ease > 1 then 1 else 0 end) "
                "FROM revlog GROUP BY hr"
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

            return {
                "maturityBreakdown": {
                    "newCards": new_cnt,
                    "learning": learning_cnt,
                    "young": young_cnt,
                    "mature": mature_cnt,
                    "suspended": suspended_cnt,
                    "total": new_cnt + learning_cnt + young_cnt + mature_cnt + suspended_cnt,
                },
                "forecast30d": forecast_30d,
                "retentionCurve": retention_curve,
                "hourlyDistribution": hourly_dist,
            }
        except Exception:
            return self._empty_advanced_stats(lang)

    def _build_decks_list(self, col) -> List[Dict[str, Any]]:
        """Collects all decks with due counts, total cards, parentId, and mastery percentage."""
        tree = col.sched.deck_due_tree()
        decks_out: List[Dict[str, Any]] = []

        icons = ["book", "code", "heart", "folder", "layers", "sparkles"]
        accents = ["indigo", "blue", "emerald", "amber", "rose", "purple"]

        def traverse(node, depth=0, parent_name="", parent_id=None):
            for child in getattr(node, "children", []):
                did = int(child.deck_id)
                name = child.name
                full_name = f"{parent_name}::{name}" if parent_name else name

                new_count = int(getattr(child, "new_count", 0))
                learn_count = int(getattr(child, "learn_count", 0))
                review_count = int(getattr(child, "review_count", 0))
                due_review = learn_count + review_count

                dids = [did] + [int(cid) for _, cid in col.decks.children(did)]
                placeholders = ",".join("?" for _ in dids)
                stats_row = col.db.first(
                    f"SELECT count(*), "
                    f"coalesce(sum(case when ivl >= 21 then 1.0 when type = 2 then 0.6 when type in (1,3) then 0.3 else 0.0 end), 0) "
                    f"FROM cards WHERE did IN ({placeholders})",
                    *dids,
                )
                total_cards = int(stats_row[0] or 0) if stats_row else 0
                weighted_mastered = float(stats_row[1] or 0.0) if stats_row else 0.0
                mastery = (
                    min(100, max(0, round((weighted_mastered / total_cards) * 100)))
                    if total_cards > 0
                    else 0
                )

                color_idx = len(decks_out) % len(accents)
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
                    "icon": icons[color_idx],
                    "accent": accents[color_idx],
                    "childrenCount": len(getattr(child, "children", [])),
                }
                decks_out.append(deck_item)
                if getattr(child, "children", None):
                    traverse(child, depth + 1, full_name, did)

        traverse(tree, 0, "", None)
        return decks_out

    def _build_heatmap_and_streak(self, col, cutoff: int, lang: str = "zh-CN") -> Dict[str, Any]:
        """Calculates 365-day review matrix, per-day accuracy, streak, and 7-day summary metrics."""
        cfg = self._get_config()
        vacation_cfg = cfg.get("vacation_state", {})
        frozen_dates = set(vacation_cfg.get("frozen_dates", []))

        today_start_sec = cutoff - 86400
        start_365_sec = today_start_sec - (364 * 86400)
        rows = col.db.all(
            "SELECT CAST((id / 1000 - ?) / 86400 AS INT) as day_idx, count(*), "
            "sum(case when ease > 1 then 1 else 0 end) "
            "FROM revlog WHERE id >= ? GROUP BY day_idx",
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

        all_days_rows = col.db.all(
            "SELECT DISTINCT CAST((id / 1000 - ?) / 86400 AS INT) as d FROM revlog ORDER BY d ASC",
            today_start_sec,
        )
        day_offsets = sorted({int(r[0]) for r in all_days_rows if r[0] is not None})
        day_set = set(day_offsets)

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
        week_active_days = sum(1 for i in range(7) if day_map.get(364 - i, {"count": 0})["count"] > 0)

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
        """Builds the 7-day bar chart data (Monday..Sunday of current week, with per-day minutes)."""
        today_start_sec = cutoff - 86400
        today_date = datetime.date.fromtimestamp(today_start_sec)
        weekday_idx = today_date.weekday()
        monday_sec = today_start_sec - (weekday_idx * 86400)

        labels = (
            ["一", "二", "三", "四", "五", "六", "日"]
            if lang == "zh-CN"
            else ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        )
        days_list = []
        max_session_minutes = 0

        for i in range(7):
            d_start_ms = (monday_sec + i * 86400) * 1000
            d_end_ms = d_start_ms + 86400 * 1000
            row = col.db.first(
                "SELECT count(*), coalesce(sum(time), 0) FROM revlog WHERE id >= ? AND id < ?",
                d_start_ms,
                d_end_ms,
            )
            cnt = int(row[0] or 0) if row else 0
            t_ms = int(row[1] or 0) if row else 0
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

    @staticmethod
    def _get_greeting(hour: int, lang: str = "zh-CN") -> str:
        if lang == "en":
            if 5 <= hour < 12:
                return "Good morning"
            elif 12 <= hour < 18:
                return "Good afternoon"
            else:
                return "Good evening"
        if 5 <= hour < 12:
            return "上午好"
        elif 12 <= hour < 18:
            return "下午好"
        else:
            return "晚上好"

    @staticmethod
    def _format_date_display(dt: datetime.datetime, lang: str = "zh-CN") -> str:
        if lang == "en":
            return dt.strftime("%b %d, %A")
        weekdays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
        return f"{dt.month}月{dt.day}日 {weekdays[dt.weekday()]}"

    @staticmethod
    def _empty_advanced_stats(lang: str = "zh-CN") -> Dict[str, Any]:
        today_label = "今天" if lang == "zh-CN" else "Today"
        return {
            "maturityBreakdown": {
                "newCards": 0,
                "learning": 0,
                "young": 0,
                "mature": 0,
                "suspended": 0,
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
        }

    @classmethod
    def _empty_dashboard(
        cls, lang: str, profile_name: str, env_info: Dict[str, str], cfg: Dict[str, Any]
    ) -> Dict[str, Any]:
        now = datetime.datetime.now()
        labels = (
            ["一", "二", "三", "四", "五", "六", "日"]
            if lang == "zh-CN"
            else ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        )
        return {
            "userName": profile_name,
            "greeting": cls._get_greeting(now.hour, lang),
            "dateDisplay": cls._format_date_display(now, lang),
            "synced": True,
            "syncedAt": int(time.time() * 1000),
            "language": lang,
            "envInfo": env_info,
            "preferences": {
                "theme": cfg.get("theme", "light"),
                "accentColor": cfg.get("accent_color", "indigo"),
                "language": cfg.get("language", "auto"),
                "customNickname": cfg.get("custom_nickname", ""),
                "collapsedDeckIds": cfg.get("collapsed_deck_ids", []),
                "showShortcutHints": bool(cfg.get("show_shortcut_hints", False)),
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
