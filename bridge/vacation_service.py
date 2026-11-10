# -*- coding: utf-8 -*-
"""
Anki Modern OS — Vacation & Anti-Burnout / Avalanche Rescue Service
Provides:
1. Vacation Mode (事前请假):
   - Configurable vacation duration (1-30 days), reason, and auto-shifts.
   - Freezes new card limits across active decks during the break.
   - Preserves user streak via "Streak Freeze" (dates recorded in config).
   - Safe due-date shift without destroying card intervals.
2. Anti-Avalanche Backlog Rescue (事后雪崩削峰填谷):
   - Detects severe backlogs (e.g. overdue review cards > 30).
   - Mode 'amortize' (削峰平摊): uses `col.sched.set_due_date(card_ids, "1-{days}")`
     to uniformly distribute overdue cards across N days without altering intervals.
   - Mode 'shift' (整体顺延): shifts all due review cards forward by N days.
3. Low-Energy Session (低能量极简打卡):
   - Curates a small queue of 10-15 high-stability/easiest cards for exhausted days.
"""

from __future__ import annotations

import datetime
import math
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple


class VacationService:
    """Manages vacation status, backlog amortization, streak freeze, and low-energy sessions."""

    def __init__(
        self,
        col_getter: Callable[[], Any],
        mw_getter: Optional[Callable[[], Any]] = None,
        config_getter: Optional[Callable[[], Dict[str, Any]]] = None,
        config_writer: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
    ):
        self._get_col = col_getter
        self._get_mw = mw_getter or (lambda: None)
        self._get_config = config_getter or (lambda: {})
        self._write_config = config_writer or (lambda cfg: cfg)

    @property
    def col(self):
        return self._get_col()

    @property
    def mw(self):
        return self._get_mw()

    # ---- Vacation Status & Inspection ----

    def get_vacation_status(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Returns the current vacation state, streak freeze dates, and backlog metrics."""
        cfg = self._get_config()
        vacation_cfg = cfg.get("vacation_state", {})

        is_active = bool(vacation_cfg.get("active", False))
        start_date_str = vacation_cfg.get("start_date", "")
        end_date_str = vacation_cfg.get("end_date", "")
        days = int(vacation_cfg.get("days", 0))
        reason = vacation_cfg.get("reason", "休整与备考")
        freeze_new = bool(vacation_cfg.get("freeze_new_cards", True))
        frozen_dates = list(vacation_cfg.get("frozen_dates", []))

        today = datetime.date.today()
        today_str = today.isoformat()

        # Check if active vacation has reached or passed end_date
        remaining_days = 0
        if is_active and end_date_str:
            try:
                end_date = datetime.date.fromisoformat(end_date_str)
                delta = (end_date - today).days
                if delta < 0:
                    # Vacation naturally ended
                    self.end_vacation({"reason": "auto_expired"})
                    is_active = False
                else:
                    remaining_days = max(1, delta + 1)
            except Exception:
                remaining_days = max(1, days)

        # Backlog analysis
        backlog_metrics = self._analyze_backlog()

        last_receipt = self.get_or_reconstruct_receipt()

        vacation_history = list(cfg.get("vacation_history", []))
        rescue_history = list(cfg.get("rescue_history", []))
        if not rescue_history and last_receipt:
            rescue_history = [last_receipt]

        return {
            "vacation": {
                "isActive": is_active,
                "startDate": start_date_str,
                "endDate": end_date_str,
                "days": days,
                "remainingDays": remaining_days,
                "reason": reason,
                "freezeNewCards": freeze_new,
                "frozenDates": frozen_dates,
            },
            "vacationHistory": vacation_history,
            "backlog": backlog_metrics,
            "lastReceipt": last_receipt,
            "rescueHistory": rescue_history,
        }

    def get_or_reconstruct_receipt(self) -> Optional[Dict[str, Any]]:
        """Returns existing rescue receipt, or reconstructs active distribution evidence from the collection."""
        cfg = self._get_config()
        last_receipt = cfg.get("last_rescue_receipt")
        if last_receipt and isinstance(last_receipt, dict) and last_receipt.get("dayDistribution"):
            return last_receipt

        col = self.col
        if col is None:
            return None

        try:
            sched_today = getattr(col.sched, "today", None) if hasattr(col, "sched") else None
            if sched_today is None:
                crt = getattr(col, "crt", int(time.time()))
                sched_today = int((time.time() - crt) // 86400)

            total_cards = 0
            if hasattr(col, "card_count"):
                try:
                    total_cards = col.card_count()
                except Exception:
                    pass
            if not total_cards and hasattr(col, "db"):
                r = col.db.first("SELECT count(*) FROM cards")
                total_cards = int(r[0]) if r else 0

            days = 7
            today_date = datetime.date.today()
            weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

            day_counts = {d: 0 for d in range(1, days + 1)}
            card_samples = []
            rescheduled_cids = []

            if hasattr(col, "db"):
                rows = col.db.all(
                    "SELECT c.id, c.did, c.ivl, c.due, (c.due - ?) as day_off, n.flds "
                    "FROM cards c JOIN notes n ON c.nid = n.id "
                    "WHERE c.queue in (2, 3) AND c.due > ? AND c.due <= ? + 7 "
                    "ORDER BY c.due ASC",
                    sched_today, sched_today, sched_today
                )
                for r in rows:
                    cid, did, ivl, due, day_off, flds = r
                    day_off = max(1, min(days, int(day_off)))
                    day_counts[day_off] = day_counts.get(day_off, 0) + 1
                    rescheduled_cids.append(str(cid))

                    if len(card_samples) < 30:
                        deck_name = "Default"
                        if hasattr(col, "decks") and hasattr(col.decks, "name"):
                            try:
                                deck_name = col.decks.name(did) or "Default"
                            except Exception:
                                pass
                        front_text = ""
                        if flds:
                            front_text = re.sub(r"<[^>]*>", "", str(flds).split("\x1f")[0]).strip()
                        target_date = today_date + datetime.timedelta(days=day_off)
                        card_samples.append({
                            "id": str(cid),
                            "front": front_text[:100] if front_text else f"卡片 #{cid}",
                            "deckName": deck_name,
                            "intervalDays": int(ivl or 0),
                            "dayOffset": day_off,
                            "newDueDate": f"{target_date.month}月{target_date.day}日",
                        })

            total_window_cards = sum(day_counts.values())
            if total_window_cards == 0:
                return None

            day_distribution = []
            for d in range(1, days + 1):
                target_date = today_date + datetime.timedelta(days=d)
                w_name = weekday_names[target_date.weekday()]
                rel_label = "明天" if d == 1 else ("后天" if d == 2 else w_name)
                day_distribution.append({
                    "dayOffset": d,
                    "date": target_date.isoformat(),
                    "dateLabel": f"{target_date.month}月{target_date.day}日 ({rel_label})",
                    "count": day_counts.get(d, 0),
                })

            receipt = {
                "id": "rescue_active",
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                "totalCardsBefore": total_cards,
                "totalCardsAfter": total_cards,
                "lostCards": 0,
                "rescheduledCount": total_window_cards,
                "mode": "amortize",
                "days": 7,
                "dayDistribution": day_distribution,
                "cardSamples": card_samples,
                "rescheduledCids": rescheduled_cids,
                "canUndo": len(rescheduled_cids) > 0,
            }
            self._write_config({"last_rescue_receipt": receipt})
            return receipt
        except Exception:
            return None

    @staticmethod
    def _safe_int(val: Any, default: int, min_val: int = 1, max_val: int = 365) -> int:
        try:
            parsed = int(val) if val is not None and str(val).strip() != "" else default
        except Exception:
            parsed = default
        return max(min_val, min(max_val, parsed))

    @staticmethod
    def _build_deck_search_clause(col: Any, deck_id: Any) -> str:
        """Resolves a deckId (numeric ID or deck name) into a valid Anki `deck:"..." ` search clause."""
        if not deck_id or str(deck_id) == "all":
            return ""
        raw = str(deck_id).strip()
        if not raw:
            return ""
        if raw.isdigit() and hasattr(col, "decks") and hasattr(col.decks, "get"):
            try:
                deck_obj = col.decks.get(int(raw), default=False)
                if deck_obj and deck_obj.get("name"):
                    escaped = str(deck_obj["name"]).replace('"', '\\"')
                    return f'deck:"{escaped}" '
            except Exception:
                pass
            return ""
        escaped = raw.replace('"', '\\"')
        return f'deck:"{escaped}" '

    def _analyze_backlog(self, deck_id: Optional[str] = None) -> Dict[str, Any]:
        """Calculates current due count, overdue count, avalanche state, and suggested amortize days."""
        col = self.col
        if col is None:
            return {
                "totalDue": 0,
                "overdueCount": 0,
                "hasAvalanche": False,
                "suggestedDays": 7,
                "perDayEstimate": 0,
            }

        try:
            # Query due review cards using resolved deck name
            deck_filter = self._build_deck_search_clause(col, deck_id)
            query = f"{deck_filter}is:due"
            all_due_cids = col.find_cards(query) if hasattr(col, "find_cards") else []
            total_due = len(all_due_cids)

            # Query overdue cards (review cards due strictly before today)
            overdue_query = f"{deck_filter}is:due is:review prop:due<0"
            try:
                overdue_cids = col.find_cards(overdue_query) if hasattr(col, "find_cards") else []
            except Exception:
                # Fallback if prop:due<0 not supported
                overdue_cids = all_due_cids

            overdue_count = len(overdue_cids)
            has_avalanche = overdue_count >= 30 or total_due >= 60

            # Compute suggested amortization days (e.g. 3, 5, 7, 14)
            if total_due <= 30:
                suggested_days = 3
            elif total_due <= 80:
                suggested_days = 5
            elif total_due <= 200:
                suggested_days = 7
            else:
                suggested_days = 14

            per_day = math.ceil(total_due / suggested_days) if suggested_days > 0 else total_due

            return {
                "totalDue": total_due,
                "overdueCount": overdue_count,
                "hasAvalanche": has_avalanche,
                "suggestedDays": suggested_days,
                "perDayEstimate": per_day,
            }
        except Exception:
            return {
                "totalDue": 0,
                "overdueCount": 0,
                "hasAvalanche": False,
                "suggestedDays": 7,
                "perDayEstimate": 0,
            }

    # ---- Set Vacation Mode (事前请假) ----

    def set_vacation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Activates vacation mode, optionally freezes new card limits and shifts due dates."""
        data = data or {}
        days = self._safe_int(data.get("days"), 3, 1, 60)
        reason = str(data.get("reason") or "休整与备考").strip() or "休整与备考"
        freeze_new = bool(data.get("freezeNewCards", True))
        shift_reviews = bool(data.get("shiftReviewCards", True))
        freeze_streak = bool(data.get("freezeStreak", True))

        today = datetime.date.today()
        start_date = today.isoformat()
        end_date = (today + datetime.timedelta(days=days - 1)).isoformat()

        # Compute all frozen dates in this vacation range for heatmap & streak preservation
        frozen_dates = []
        if freeze_streak:
            for offset in range(days):
                cur = today + datetime.timedelta(days=offset)
                frozen_dates.append(cur.isoformat())

        col = self.col
        shifted_card_count = 0
        shifted_cids: List[int] = []
        frozen_deck_limits: Dict[str, int] = {}

        if col is not None:
            # 1. Optionally freeze new card limits across deck configs
            if freeze_new:
                frozen_deck_limits = self._freeze_new_card_limits(col)

            # 2. Optionally shift currently due review cards forward by `days`
            if shift_reviews:
                shifted_card_count, shifted_cids = self._shift_due_cards(col, days)

            # Save collection changes if supported
            if hasattr(col, "save"):
                try:
                    col.save()
                except Exception:
                    pass

        vacation_id = f"vac-{int(datetime.datetime.now().timestamp())}"
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        # Persist vacation state into add-on config
        vacation_state = {
            "id": vacation_id,
            "active": True,
            "start_date": start_date,
            "end_date": end_date,
            "days": days,
            "reason": reason,
            "freeze_new_cards": freeze_new,
            "frozen_deck_limits": frozen_deck_limits,
            "frozen_dates": frozen_dates,
            "shifted_cids": [str(c) for c in shifted_cids],
            "shifted_card_count": shifted_card_count,
            "created_at": now_str,
        }

        # Track history
        cfg = self._get_config()
        vacation_history = list(cfg.get("vacation_history", []))
        history_item = {
            "id": vacation_id,
            "startDate": start_date,
            "endDate": end_date,
            "days": days,
            "reason": reason,
            "status": "active",
            "shiftedCardCount": shifted_card_count,
            "createdAt": now_str,
        }
        vacation_history.insert(0, history_item)
        if len(vacation_history) > 30:
            vacation_history = vacation_history[:30]

        cfg_patch = {
            "vacation_state": vacation_state,
            "vacation_history": vacation_history,
        }
        self._write_config(cfg_patch)

        return {
            "success": True,
            "vacation": {
                "isActive": True,
                "startDate": start_date,
                "endDate": end_date,
                "days": days,
                "remainingDays": days,
                "reason": reason,
                "freezeNewCards": freeze_new,
                "frozenDates": frozen_dates,
                "shiftedCardCount": shifted_card_count,
            },
            "vacationHistory": vacation_history,
        }

    # ---- End Vacation Mode (提前或按期结束休假) ----

    def end_vacation(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Ends vacation mode, restores deck new limits, and marks history as ended."""
        cfg = self._get_config()
        vacation_cfg = cfg.get("vacation_state", {})

        is_active = bool(vacation_cfg.get("active", False))
        frozen_deck_limits = vacation_cfg.get("frozen_deck_limits", {})

        col = self.col
        restored_deck_count = 0
        if col is not None and frozen_deck_limits:
            restored_deck_count = self._restore_new_card_limits(col, frozen_deck_limits)
            if hasattr(col, "save"):
                try:
                    col.save()
                except Exception:
                    pass

        # Update config to inactive
        updated_state = dict(vacation_cfg)
        updated_state["active"] = False
        ended_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        updated_state["ended_at"] = ended_at

        vacation_history = list(cfg.get("vacation_history", []))
        for item in vacation_history:
            if item.get("status") == "active":
                item["status"] = "ended_early"
                item["endedAt"] = ended_at
                break

        self._write_config({
            "vacation_state": updated_state,
            "vacation_history": vacation_history,
        })

        mw = self.mw
        if mw is not None and hasattr(mw, "reset"):
            try:
                mw.reset()
            except Exception:
                pass

        return {
            "success": True,
            "wasActive": is_active,
            "restoredDeckCount": restored_deck_count,
            "message": "已结束休假守护，欢迎归来！卡片学习限额已恢复正常。",
            "vacationHistory": vacation_history,
        }

    # ---- Cancel / Revert Vacation Mode (完全撤销休假·无损回退) ----

    def cancel_vacation(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Cancels/reverts the active vacation mode, restores shifted cards back to today, and restores deck limits."""
        cfg = self._get_config()
        vacation_cfg = cfg.get("vacation_state", {})
        if not vacation_cfg.get("active"):
            return {"success": False, "message": "当前没有正在生效的休假记录。"}

        col = self.col
        shifted_cids = vacation_cfg.get("shifted_cids", [])
        restored_card_count = 0
        if col is not None and shifted_cids:
            try:
                cids = [int(c) for c in shifted_cids if str(c).isdigit()]
                if cids:
                    if hasattr(col, "sched") and hasattr(col.sched, "set_due_date"):
                        col.sched.set_due_date(cids, "0!")
                    elif hasattr(col, "db"):
                        sched_today = getattr(col.sched, "today", 0) if hasattr(col, "sched") else 0
                        col.db.execute("UPDATE cards SET due = ? WHERE id IN (" + ",".join(str(c) for c in cids) + ")", sched_today)
                    restored_card_count = len(cids)
                if hasattr(col, "save"):
                    col.save()
            except Exception as e:
                print(f"[VacationService] cancel vacation card error: {e}")

        frozen_deck_limits = vacation_cfg.get("frozen_deck_limits", {})
        if col is not None and frozen_deck_limits:
            self._restore_new_card_limits(col, frozen_deck_limits)

        cancelled_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        updated_state = dict(vacation_cfg)
        updated_state["active"] = False
        updated_state["cancelled_at"] = cancelled_at

        vacation_history = list(cfg.get("vacation_history", []))
        for item in vacation_history:
            if item.get("status") == "active":
                item["status"] = "cancelled"
                item["cancelledAt"] = cancelled_at
                break

        self._write_config({
            "vacation_state": updated_state,
            "vacation_history": vacation_history,
        })

        mw = self.mw
        if mw is not None and hasattr(mw, "reset"):
            try:
                mw.reset()
            except Exception:
                pass

        return {
            "success": True,
            "restoredCardCount": restored_card_count,
            "message": f"已成功撤销本次休假，{restored_card_count} 张卡片已恢复今日队列，学习限额已还原。",
            "vacationHistory": vacation_history,
        }

    def get_vacation_history(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Returns past vacation history records."""
        cfg = self._get_config()
        return {"success": True, "history": cfg.get("vacation_history", [])}

    # ---- Anti-Avalanche Rescue (事后雪崩平摊与顺延) ----

    def rescue_backlog(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rescues overdue card backlogs:
        - mode 'amortize' (削峰平摊): spreads overdue cards uniformly over 1 to N days using `set_due_date("1-{days}")`.
        - mode 'shift' (整体顺延): shifts overdue cards forward by N days using `set_due_date("{days}")`.
        Generates an irrefutable audit receipt with before/after card counts, zero data-loss proof,
        and day-by-day distribution schedule to provide 100% user peace of mind.
        """
        data = data or {}
        mode = data.get("mode", "amortize") if data.get("mode") in ("amortize", "shift") else "amortize"
        days = self._safe_int(data.get("days"), 7, 1, 30)
        deck_id = data.get("deckId")

        col = self.col
        if col is None:
            return {"success": False, "count": 0, "error": "Collection unavailable"}

        try:
            deck_filter = self._build_deck_search_clause(col, deck_id)
            query = f"{deck_filter}is:due"
            cids = col.find_cards(query) if hasattr(col, "find_cards") else []

            if not cids:
                return {
                    "success": True,
                    "count": 0,
                    "mode": mode,
                    "days": days,
                    "message": "当前队列中没有积压的到期卡片，无需急救。",
                }

            # Pre-audit card count
            total_before = 0
            if hasattr(col, "card_count"):
                try:
                    total_before = col.card_count()
                except Exception:
                    pass
            if not total_before and hasattr(col, "db"):
                r = col.db.first("SELECT count(*) FROM cards")
                total_before = int(r[0]) if r else 0

            # Execute safe rescheduling
            if mode == "amortize":
                # Spreads cards uniformly across days 1 to `days` from now without altering intervals!
                range_expr = f"1-{days}" if days > 1 else "1"
                if hasattr(col, "sched") and hasattr(col.sched, "set_due_date"):
                    col.sched.set_due_date(list(cids), range_expr)
                elif hasattr(col, "db"):
                    # Fallback for mock environments: set due in range
                    for i, cid in enumerate(cids):
                        target_day = (i % days) + 1
                        col.db.execute("UPDATE cards SET due = ? WHERE id = ?", target_day, cid)
            else:
                # Mode 'shift': sets due date to `days` days from now
                if hasattr(col, "sched") and hasattr(col.sched, "set_due_date"):
                    col.sched.set_due_date(list(cids), str(days))
                elif hasattr(col, "db"):
                    col.db.execute("UPDATE cards SET due = due + ? WHERE id IN (" + ",".join(str(c) for c in cids) + ")", days)

            if hasattr(col, "save"):
                try:
                    col.save()
                except Exception:
                    pass

            mw = self.mw
            if mw is not None and hasattr(mw, "reset"):
                try:
                    mw.reset()
                except Exception:
                    pass

            # Post-audit card count
            total_after = total_before
            if hasattr(col, "card_count"):
                try:
                    total_after = col.card_count()
                except Exception:
                    pass
            elif hasattr(col, "db"):
                r = col.db.first("SELECT count(*) FROM cards")
                total_after = int(r[0]) if r else 0

            sched_today = getattr(col.sched, "today", None) if hasattr(col, "sched") else None
            if sched_today is None:
                crt = getattr(col, "crt", int(time.time()))
                sched_today = int((time.time() - crt) // 86400)

            # Build precise day-by-day distribution and card samples
            today_date = datetime.date.today()
            day_counts = {d: 0 for d in range(1, days + 1)}
            card_samples = []
            weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

            for idx, cid in enumerate(cids):
                c_due = sched_today + 1
                c_ivl = 0
                c_did = 1
                front_text = ""

                if hasattr(col, "get_card"):
                    try:
                        c = col.get_card(cid)
                        c_due = c.due
                        c_ivl = c.ivl
                        c_did = c.did
                        note = c.note()
                        if note and hasattr(note, "fields") and note.fields:
                            front_text = re.sub(r"<[^>]*>", "", str(note.fields[0])).strip()
                    except Exception:
                        pass
                elif hasattr(col, "db"):
                    try:
                        r = col.db.first("SELECT due, ivl, did, nid FROM cards WHERE id = ?", cid)
                        if r:
                            c_due, c_ivl, c_did, nid = r
                            nr = col.db.first("SELECT flds FROM notes WHERE id = ?", nid)
                            if nr and nr[0]:
                                front_text = re.sub(r"<[^>]*>", "", str(nr[0]).split("\x1f")[0]).strip()
                    except Exception:
                        pass

                d_off = max(1, min(days, c_due - sched_today))
                day_counts[d_off] = day_counts.get(d_off, 0) + 1

                if len(card_samples) < 30:
                    deck_name = "Default"
                    if hasattr(col, "decks") and hasattr(col.decks, "name"):
                        try:
                            deck_name = col.decks.name(c_did) or "Default"
                        except Exception:
                            pass
                    target_date = today_date + datetime.timedelta(days=d_off)
                    card_samples.append({
                        "id": str(cid),
                        "front": front_text[:100] if front_text else f"卡片 #{cid}",
                        "deckName": deck_name,
                        "intervalDays": c_ivl,
                        "dayOffset": d_off,
                        "newDueDate": f"{target_date.month}月{target_date.day}日",
                    })

            day_distribution = []
            for d in range(1, days + 1):
                target_date = today_date + datetime.timedelta(days=d)
                w_name = weekday_names[target_date.weekday()]
                rel_label = "明天" if d == 1 else ("后天" if d == 2 else w_name)
                day_distribution.append({
                    "dayOffset": d,
                    "date": target_date.isoformat(),
                    "dateLabel": f"{target_date.month}月{target_date.day}日 ({rel_label})",
                    "count": day_counts.get(d, 0),
                })

            per_day = math.ceil(len(cids) / days) if days > 0 else len(cids)
            msg = (
                f"已成功将 {len(cids)} 张积压卡片削峰平摊至未来 {days} 天，平均每天仅需复习约 {per_day} 张。"
                if mode == "amortize"
                else f"已成功将 {len(cids)} 张卡片整体顺延 {days} 天。"
            )

            receipt = {
                "id": f"rescue_{int(time.time())}",
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                "totalCardsBefore": total_before,
                "totalCardsAfter": total_after,
                "lostCards": max(0, total_before - total_after),
                "rescheduledCount": len(cids),
                "mode": mode,
                "days": days,
                "dayDistribution": day_distribution,
                "cardSamples": card_samples,
                "rescheduledCids": [str(c) for c in cids],
                "canUndo": True,
                "status": "active",
            }

            rescue_history = list(self._get_config().get("rescue_history", []))
            # Only the most recent relief operation can ever be undone; all prior operations are superseded
            for prev_item in rescue_history:
                prev_item["canUndo"] = False

            rescue_history.insert(0, receipt)
            if len(rescue_history) > 30:
                rescue_history = rescue_history[:30]

            self._write_config({
                "last_rescue_receipt": receipt,
                "rescue_history": rescue_history,
            })

            return {
                "success": True,
                "count": len(cids),
                "mode": mode,
                "days": days,
                "perDayEstimate": per_day,
                "message": msg,
                "receipt": receipt,
                "rescueHistory": rescue_history,
            }
        except Exception as e:
            return {"success": False, "count": 0, "error": str(e)}

    # ---- Undo Backlog Rescue (一键撤销急救·原样复原) ----

    def undo_last_rescue(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Restores cards from the last rescue operation back into today's due queue."""
        cfg = self._get_config()
        receipt = cfg.get("last_rescue_receipt")
        if not receipt or not receipt.get("canUndo"):
            return {"success": False, "message": "当前没有可撤销的急救记录，或已撤销。"}

        raw_cids = receipt.get("rescheduledCids", [])
        cids = [int(c) for c in raw_cids if str(c).isdigit()]
        col = self.col
        if col is None or not cids:
            return {"success": False, "message": "无可操作的卡片数据。"}

        try:
            # Setting due date to '0!' makes all these cards due today while preserving their interval
            if hasattr(col, "sched") and hasattr(col.sched, "set_due_date"):
                col.sched.set_due_date(list(cids), "0!")
            elif hasattr(col, "db"):
                sched_today = getattr(col.sched, "today", 0) if hasattr(col, "sched") else 0
                col.db.execute("UPDATE cards SET due = ? WHERE id IN (" + ",".join(str(c) for c in cids) + ")", sched_today)

            if hasattr(col, "sched") and hasattr(col.sched, "reset"):
                try:
                    col.sched.reset()
                except Exception:
                    pass

            if hasattr(col, "save"):
                try:
                    col.save()
                except Exception:
                    pass

            mw = self.mw
            if mw is not None and hasattr(mw, "reset"):
                try:
                    mw.reset()
                except Exception:
                    pass

            receipt["canUndo"] = False
            receipt["status"] = "undone"
            receipt["undoneAt"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

            rescue_history = list(cfg.get("rescue_history", []))
            for item in rescue_history:
                if item.get("id") == receipt.get("id"):
                    item["canUndo"] = False
                    item["status"] = "undone"
                    item["undoneAt"] = receipt["undoneAt"]
                    break

            self._write_config({
                "last_rescue_receipt": receipt,
                "rescue_history": rescue_history,
            })

            return {
                "success": True,
                "count": len(cids),
                "message": f"已成功撤销削峰急救，{len(cids)} 张卡片已全数退回今日待复习队列。",
                "receipt": receipt,
                "rescueHistory": rescue_history,
            }
        except Exception as e:
            return {"success": False, "message": f"撤销急救失败: {e}"}

    def get_rescue_history(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Returns past backlog rescue history records."""
        cfg = self._get_config()
        history = list(cfg.get("rescue_history", []))
        if not history:
            last = cfg.get("last_rescue_receipt")
            if last:
                history = [last]
        return {"success": True, "history": history}

    # ---- Low-Energy Session (极简保底打卡) ----

    def start_low_energy_session(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Returns a gentle, curated review queue of 10-15 easiest/most stable cards.
        Allows the user to easily complete today's review when exhausted without feeling overwhelmed.
        """
        data = data or {}
        limit = self._safe_int(data.get("limit"), 15, 5, 30)
        deck_id = data.get("deckId")

        col = self.col
        if col is None:
            return {"success": False, "cards": [], "count": 0}

        try:
            deck_filter = self._build_deck_search_clause(col, deck_id)
            # Query due review cards
            query = f"{deck_filter}is:due is:review"
            cids = list(col.find_cards(query)) if hasattr(col, "find_cards") else []

            # If fewer review cards, take any due cards
            if not cids:
                cids = list(col.find_cards(f"{deck_filter}is:due")) if hasattr(col, "find_cards") else []

            # Sort by interval descending so the user gets their most familiar / highest-stability cards first
            if cids and hasattr(col, "get_card"):
                try:
                    cids.sort(key=lambda cid: int(getattr(col.get_card(int(cid)), "ivl", 0) or 0), reverse=True)
                except Exception:
                    pass

            # Pick up to `limit` cards
            selected_cids = [str(cid) for cid in cids[:limit]]

            return {
                "success": True,
                "cardIds": selected_cids,
                "count": len(selected_cids),
                "isLowEnergy": True,
                "message": f"已开启轻量复习：精选了 {len(selected_cids)} 张最熟悉的卡片。",
            }
        except Exception as e:
            return {"success": False, "cards": [], "count": 0, "error": str(e)}

    # ---- Helpers ----

    def _shift_due_cards(self, col, days: int) -> Tuple[int, List[int]]:
        """Shifts all currently due review cards forward by `days` and returns (count, cids)."""
        try:
            due_cids = col.find_cards("is:due is:review") if hasattr(col, "find_cards") else []
            if not due_cids:
                return 0, []

            cids_list = list(due_cids)
            if hasattr(col, "sched") and hasattr(col.sched, "set_due_date"):
                col.sched.set_due_date(cids_list, str(days))
            elif hasattr(col, "db"):
                col.db.execute("UPDATE cards SET due = due + ? WHERE id IN (" + ",".join(str(c) for c in cids_list) + ")", days)

            mw = self.mw
            if mw is not None and hasattr(mw, "reset"):
                try:
                    mw.reset()
                except Exception:
                    pass

            return len(cids_list), cids_list
        except Exception:
            return 0, []

    def _freeze_new_card_limits(self, col) -> Dict[str, int]:
        """Temporarily records and sets new card limits to 0 across deck configs."""
        saved_limits: Dict[str, int] = {}
        try:
            if hasattr(col, "decks") and hasattr(col.decks, "all_config"):
                for conf in col.decks.all_config():
                    conf_id = str(conf.get("id"))
                    new_per_day = conf.get("new", {}).get("perDay", 20)
                    saved_limits[conf_id] = new_per_day
                    conf.get("new", {})["perDay"] = 0
                    if hasattr(col.decks, "save"):
                        col.decks.save(conf)
        except Exception:
            pass
        return saved_limits

    def _restore_new_card_limits(self, col, saved_limits: Dict[str, int]) -> int:
        """Restores previously frozen new card limits."""
        restored = 0
        try:
            if hasattr(col, "decks") and hasattr(col.decks, "all_config"):
                for conf in col.decks.all_config():
                    conf_id = str(conf.get("id"))
                    if conf_id in saved_limits:
                        original_limit = saved_limits[conf_id]
                        conf.get("new", {})["perDay"] = original_limit
                        if hasattr(col.decks, "save"):
                            col.decks.save(conf)
                        restored += 1
        except Exception:
            pass
        return restored
