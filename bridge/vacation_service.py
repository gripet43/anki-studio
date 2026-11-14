# -*- coding: utf-8 -*-
"""
Anki Studio — Vacation & Anti-Burnout / Avalanche Rescue Service
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

from .safety import (
    begin_ticket,
    begin_undo_group,
    capture_schedule,
    end_undo_group,
    finish_ticket,
    quick_integrity_check,
    reconcile_pending_ticket,
    restore_schedule,
    try_native_backup,
    verify_restoration,
)

# Cumulative streak-freeze dates live at the top level of the add-on config so they
# survive repeated vacations instead of being overwritten with each new vacation_state.
FROZEN_DATES_KEY = "vacation_frozen_dates"


def _save_col_if_legacy(col: Any) -> None:
    """Calls `col.save()` only on legacy/mock collections without Anki 26's Rust `_backend`."""
    if col is not None and hasattr(col, "save") and not hasattr(col, "_backend"):
        try:
            col.save()
        except Exception:
            pass


def effective_frozen_dates(cfg: Dict[str, Any]) -> List[str]:
    """Returns all streak-freeze dates ever granted, with a legacy config fallback.

    Configs written before the freeze-lifecycle fix kept `frozen_dates` on
    vacation_state even after the user cancelled the vacation. A cancelled
    vacation grants no streak protection, so those stale dates must be ignored.
    """
    if FROZEN_DATES_KEY in cfg:
        raw = cfg.get(FROZEN_DATES_KEY) or []
    else:
        state = cfg.get("vacation_state") or {}
        if state.get("cancelled_at"):
            return []
        raw = state.get("frozen_dates") or []
    return sorted({str(d) for d in raw})


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
        self.last_recovery: Optional[Dict[str, Any]] = None
        self._warning_consumed = False

    @property
    def col(self):
        return self._get_col()

    @property
    def mw(self):
        return self._get_mw()

    # ---- Vacation Status & Inspection ----

    def get_vacation_status(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Returns the current vacation state, cumulative streak-freeze dates, and backlog metrics."""
        # The router reconciles expiry before every action, but keep this path safe when
        # the service is invoked directly (e.g. from unit tests or another add-on).
        self.reconcile_expired_vacation()
        cfg = self._get_config()
        vacation_cfg = cfg.get("vacation_state", {})

        is_active = bool(vacation_cfg.get("active", False))
        start_date_str = vacation_cfg.get("start_date", "")
        end_date_str = vacation_cfg.get("end_date", "")
        days = int(vacation_cfg.get("days", 0))
        reason = vacation_cfg.get("reason", "休整与备考")
        freeze_new = bool(vacation_cfg.get("freeze_new_cards", True))
        frozen_dates = effective_frozen_dates(cfg)

        remaining_days = 0
        if is_active and end_date_str:
            try:
                delta = (datetime.date.fromisoformat(end_date_str) - datetime.date.today()).days
                remaining_days = max(1, delta + 1) if delta >= 0 else 0
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

    def reconcile_expired_vacation(self) -> Optional[Dict[str, Any]]:
        """Finalizes an active vacation once its end_date has passed.

        Called by BridgeRouter before dispatching *any* action, so expiry no longer
        depends on the frontend ever calling `get_vacation_status` (which it does not).
        Returns the end_vacation result on the day it fires, otherwise None.
        """
        cfg = self._get_config()
        state = cfg.get("vacation_state") or {}
        if not state.get("active"):
            return None
        end_str = state.get("end_date") or ""
        try:
            end_date = datetime.date.fromisoformat(end_str)
        except (ValueError, TypeError):
            return None
        if (end_date - datetime.date.today()).days >= 0:
            return None
        return self.end_vacation({"reason": "auto_expired"})

    def reconcile_safety_ticket(self) -> Optional[Dict[str, Any]]:
        """Restores a half-finished bulk operation left behind by a crash."""
        recovery = reconcile_pending_ticket(
            self._get_config, self._write_config, self.col
        )
        if recovery is not None:
            self.last_recovery = recovery
            self._warning_consumed = False
        return recovery

    def safety_warning(self) -> Optional[Dict[str, Any]]:
        """Exposes one crash-recovery notice to the UI (consumed once)."""
        if self._warning_consumed or not self.last_recovery:
            return None
        self._warning_consumed = True
        return self.last_recovery

    def get_or_reconstruct_receipt(self) -> Optional[Dict[str, Any]]:
        """Returns the stored rescue receipt only; never invents one on a read path."""
        receipt = self._get_config().get("last_rescue_receipt")
        if isinstance(receipt, dict) and receipt.get("rescheduledCids"):
            return receipt
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
            return 'deck:"__anki_studio_unknown_deck__" '
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
            deck_filter = self._build_deck_search_clause(col, deck_id)
            query = f"{deck_filter}is:due"
            all_due_cids = col.find_cards(query) if hasattr(col, "find_cards") else []
            total_due = len(all_due_cids)

            overdue_query = f"{deck_filter}is:due is:review prop:due<0"
            try:
                overdue_cids = col.find_cards(overdue_query) if hasattr(col, "find_cards") else []
            except Exception:
                overdue_cids = all_due_cids

            overdue_count = len(overdue_cids)
            has_avalanche = overdue_count >= 30 or total_due >= 60

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
        self.reconcile_expired_vacation()
        existing = (self._get_config().get("vacation_state") or {}).get("active")
        if existing:
            return {
                "success": False,
                "message": "已有生效中的休假，请先结束或撤销后再开启。",
            }
        data = data or {}
        days = self._safe_int(data.get("days"), 3, 1, 60)
        reason = str(data.get("reason") or "休整与备考").strip() or "休整与备考"
        freeze_new = bool(data.get("freezeNewCards", True))
        shift_reviews = bool(data.get("shiftReviewCards", True))
        freeze_streak = bool(data.get("freezeStreak", True))

        today = datetime.date.today()
        start_date = today.isoformat()
        end_date = (today + datetime.timedelta(days=days - 1)).isoformat()

        frozen_dates = []
        if freeze_streak:
            for offset in range(days):
                cur = today + datetime.timedelta(days=offset)
                frozen_dates.append(cur.isoformat())

        col = self.col
        shifted_card_count = 0
        shifted_cids: List[int] = []
        shifted_snapshot: Dict[str, Dict[str, int]] = {}
        frozen_deck_limits: Dict[str, int] = {}

        if col is not None:
            undo_target = begin_undo_group(col, "Anki Studio · 开启休假")
            try_native_backup(self.mw, col)

            if freeze_new:
                frozen_deck_limits = self._freeze_new_card_limits(col)

            if shift_reviews:
                shifted_card_count, shifted_cids, shifted_snapshot = self._shift_due_cards(col, days)

            _save_col_if_legacy(col)
            end_undo_group(col, undo_target)

        vacation_id = f"vac-{int(datetime.datetime.now().timestamp())}"
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

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
            "shifted_card_snapshot": shifted_snapshot,
            "created_at": now_str,
        }

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

        cumulative = set(effective_frozen_dates(cfg))
        if freeze_streak:
            cumulative.update(frozen_dates)
        cfg_patch = {
            "vacation_state": vacation_state,
            "vacation_history": vacation_history,
            FROZEN_DATES_KEY: sorted(cumulative),
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
            _save_col_if_legacy(col)

        updated_state = dict(vacation_cfg)
        updated_state["active"] = False
        ended_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        updated_state["ended_at"] = ended_at

        reason = str((data or {}).get("reason") or "")
        final_status = "completed" if reason == "auto_expired" else "ended_early"
        vacation_history = list(cfg.get("vacation_history", []))
        for item in vacation_history:
            if item.get("status") == "active":
                item["status"] = final_status
                item["endedAt"] = ended_at
                break

        write_payload: Dict[str, Any] = {
            "vacation_state": updated_state,
            "vacation_history": vacation_history,
        }
        if is_active and reason != "auto_expired":
            today_iso = datetime.date.today().isoformat()
            own_frozen = [str(d) for d in (vacation_cfg.get("frozen_dates") or [])]
            unconsumed = {d for d in own_frozen if d >= today_iso}
            updated_state["frozen_dates"] = [d for d in own_frozen if d < today_iso]
            if unconsumed:
                write_payload[FROZEN_DATES_KEY] = sorted(
                    set(effective_frozen_dates(cfg)) - unconsumed
                )

        self._write_config(write_payload)

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
        undo_target = begin_undo_group(col, "Anki Studio · 撤销休假") if col is not None else None
        shifted_cids = vacation_cfg.get("shifted_cids", [])
        snapshot = vacation_cfg.get("shifted_card_snapshot") or {}
        restored_card_count = 0
        if col is not None and shifted_cids:
            try:
                cids = [int(c) for c in shifted_cids if str(c).isdigit()]
                if cids:
                    restored_card_count = self._restore_card_schedule(col, snapshot)
                    if not restored_card_count:
                        # 只走官方 API。这里原本有一条
                        # `col.db.execute("UPDATE cards SET due = ...")` 的兜底，
                        # 已删除：裸写 cards.due 不会把 usn 置为 -1、也不更新 mod，
                        # Anki 会认为该行「已同步」，多设备用户会静默丢失这次改期。
                        # 该兜底只在没有 sched.set_due_date 的旧版 Anki 上才会走到，
                        # 而插件已声明 min_point_version，那类版本本就不受支持。
                        if hasattr(col, "sched") and hasattr(col.sched, "set_due_date"):
                            col.sched.set_due_date(cids, "0")
                        restored_card_count = len(cids)
                _save_col_if_legacy(col)
            except Exception as e:
                print(f"[VacationService] cancel vacation card error: {e}")

        frozen_deck_limits = vacation_cfg.get("frozen_deck_limits", {})
        if col is not None and frozen_deck_limits:
            self._restore_new_card_limits(col, frozen_deck_limits)
        end_undo_group(col, undo_target)

        cancelled_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        updated_state = dict(vacation_cfg)
        updated_state["active"] = False
        updated_state["cancelled_at"] = cancelled_at
        own_frozen = [str(d) for d in vacation_cfg.get("frozen_dates", [])]
        cumulative = set(effective_frozen_dates(cfg)) - set(own_frozen)
        updated_state["frozen_dates"] = []

        vacation_history = list(cfg.get("vacation_history", []))
        for item in vacation_history:
            if item.get("status") == "active":
                item["status"] = "cancelled"
                item["cancelledAt"] = cancelled_at
                break

        self._write_config({
            "vacation_state": updated_state,
            "vacation_history": vacation_history,
            FROZEN_DATES_KEY: sorted(cumulative),
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
            "message": f"已成功撤销本次休假，{restored_card_count} 张卡片已恢复原排期，学习限额已还原。",
            "vacationHistory": vacation_history,
        }

    def get_vacation_history(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Returns past vacation history records."""
        cfg = self._get_config()
        return {"success": True, "history": cfg.get("vacation_history", [])}

    # ---- Anti-Avalanche Rescue (事后雪崩平摊与顺延) ----

    @staticmethod
    def _filter_schedulable_cids(col, cids: List[int]) -> Tuple[List[int], List[int]]:
        """把调度器读不出来的坏卡摘出来，返回 ``(可改期 cids, 跳过 cids)``。

        Anki 26 的 Rust 后端从数据库读取卡片时会校验字段范围：测试 ``edge`` 场景里
        ``ivl``/``due`` 越界的卡会让 ``col.get_card()`` 直接抛
        ``IntegralValueOutOfRange``。而 ``set_due_date(cids, ...)`` 内部也会重新读卡，
        于是**一张坏卡就能让整批减负抛错**，用户看到的是「减负失败」，几十张正常卡
        一张都没动。这里先把读不出来的卡摘掉；批量改期本身仍然走单次后端调用，
        真出现 I/O 错误时依旧整体回滚并如实报失败（不能降级重试，否则部分已提交的
        改期会被当成成功）。
        """
        ids = [int(cid) for cid in cids]
        if not ids or not hasattr(col, "get_card"):
            return ids, []
        good: List[int] = []
        skipped: List[int] = []
        for cid in ids:
            try:
                card = col.get_card(cid)
            except Exception:
                skipped.append(cid)
                continue
            if card is None:
                skipped.append(cid)
                continue
            good.append(cid)
        return good, skipped

    def rescue_backlog(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rescues overdue card backlogs:
        - mode 'amortize' (削峰平摊): spreads overdue cards uniformly over 1 to N days using `set_due_date("1-{days}")`.
        - mode 'shift' (整体顺延): shifts overdue cards forward by N days using `set_due_date("{days}")`.
        """
        data = data or {}
        mode = data.get("mode", "amortize") if data.get("mode") in ("amortize", "shift") else "amortize"
        days = self._safe_int(data.get("days"), 7, 1, 30)
        deck_id = data.get("deckId")

        col = self.col
        if col is None:
            return {"success": False, "count": 0, "error": "Collection unavailable"}

        schedule_snapshot: Dict[str, Dict[str, Any]] = {}
        ticket: Optional[Dict[str, Any]] = None
        undo_target: Optional[int] = None
        try:
            deck_filter = self._build_deck_search_clause(col, deck_id)
            query = f"{deck_filter}is:due is:review"
            cids = col.find_cards(query) if hasattr(col, "find_cards") else []

            if not cids:
                return {
                    "success": True,
                    "count": 0,
                    "mode": mode,
                    "days": days,
                    "message": "当前队列中没有积压的到期卡片，无需急救。",
                }

            # 先摘掉调度器读不出来的坏卡，避免一张坏卡让整批减负失败。
            schedulable_cids, skipped_cids = self._filter_schedulable_cids(col, list(cids))
            if not schedulable_cids:
                return {
                    "success": False,
                    "count": 0,
                    "error": "所有积压卡片都无法被调度器读取（数据损坏或极端值），未写入任何变更。",
                }
            cids = schedulable_cids

            # --- Card safety guard: capture before any write -----------------
            schedule_snapshot = capture_schedule(col, list(cids))
            receipt_id = f"rescue_{int(time.time())}"
            ticket = begin_ticket(
                self._write_config, "rescue_backlog", receipt_id, schedule_snapshot
            )
            undo_target = begin_undo_group(col, "Anki Studio · 进度减负")
            backup_created = try_native_backup(self.mw, col)
            # -----------------------------------------------------------------

            total_before = 0
            if hasattr(col, "card_count"):
                try:
                    total_before = col.card_count()
                except Exception:
                    pass
            if not total_before and hasattr(col, "db"):
                r = col.db.first("SELECT count(*) FROM cards")
                total_before = int(r[0]) if r else 0

            sched = getattr(col, "sched", None)
            if sched is None or not hasattr(sched, "set_due_date"):
                raise RuntimeError("当前 Anki 版本缺少 set_due_date 调度接口")
            if mode == "amortize":
                range_expr = f"1-{days}" if days > 1 else "1"
                # 原本此处还有一条裸 SQL 兜底（逐张 UPDATE cards SET due），已删除：
                # 它不维护 usn/mod，会让改期结果无法同步到其他设备。详见本函数上方说明。
                sched.set_due_date(list(cids), range_expr)
            else:
                sched.set_due_date(list(cids), str(days))
            rescheduled_cids = list(cids)

            _save_col_if_legacy(col)

            mw = self.mw
            if mw is not None and hasattr(mw, "reset"):
                try:
                    mw.reset()
                except Exception:
                    pass

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

            today_date = datetime.date.today()
            day_counts = {d: 0 for d in range(1, days + 1)}
            card_samples = []
            weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

            for idx, cid in enumerate(rescheduled_cids):
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
                        if len(card_samples) < 30:
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
                            if len(card_samples) < 30:
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

            per_day = math.ceil(len(rescheduled_cids) / days) if days > 0 else len(rescheduled_cids)
            msg = (
                f"已成功将 {len(rescheduled_cids)} 张积压卡片削峰平摊至未来 {days} 天，平均每天仅需复习约 {per_day} 张。"
                if mode == "amortize"
                else f"已成功将 {len(rescheduled_cids)} 张卡片整体顺延 {days} 天。"
            )
            if skipped_cids:
                msg += f"（另有 {len(skipped_cids)} 张卡片因极端调度值被跳过。）"

            undo_merged = end_undo_group(col, undo_target)
            physical_ok, physical_note = quick_integrity_check(col)

            receipt = {
                "id": receipt_id,
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                "totalCardsBefore": total_before,
                "totalCardsAfter": total_after,
                "lostCards": max(0, total_before - total_after),
                "rescheduledCount": len(rescheduled_cids),
                "skippedCount": len(skipped_cids),
                "mode": mode,
                "days": days,
                "dayDistribution": day_distribution,
                "cardSamples": card_samples,
                "rescheduledCids": [str(c) for c in rescheduled_cids],
                "scheduleSnapshot": schedule_snapshot,
                "safety": {
                    "ticketId": ticket["id"],
                    "snapshotChecksum": ticket["checksum"],
                    "backupCreated": backup_created,
                    "undoMerged": undo_merged,
                    "integrityOk": physical_ok,
                    "integrityNote": physical_note,
                },
                "state": "done",
                "canUndo": True,
                "status": "active",
            }

            rescue_history = list(self._get_config().get("rescue_history", []))
            for prev_item in rescue_history:
                prev_item["canUndo"] = False

            rescue_history.insert(0, receipt)
            if len(rescue_history) > 30:
                rescue_history = rescue_history[:30]

            self._write_config({
                "last_rescue_receipt": receipt,
                "rescue_history": rescue_history,
            })
            finish_ticket(self._write_config, ticket, "done")

            return {
                "success": True,
                "count": len(rescheduled_cids),
                "mode": mode,
                "days": days,
                "perDayEstimate": per_day,
                "message": msg,
                "receipt": receipt,
                "rescueHistory": rescue_history,
            }
        except Exception as e:
            if schedule_snapshot:
                try:
                    restore_schedule(col, schedule_snapshot)
                    _save_col_if_legacy(col)
                except Exception:
                    pass
            if ticket is not None:
                try:
                    finish_ticket(self._write_config, ticket, "rolled_back")
                except Exception:
                    pass
            end_undo_group(col, undo_target)
            return {"success": False, "count": 0, "error": str(e)}

    # ---- Undo Backlog Rescue (一键撤销急救·原样复原) ----

    def undo_last_rescue(self, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Restores cards from the last rescue operation back into today's due queue."""
        cfg = self._get_config()
        receipt = cfg.get("last_rescue_receipt")
        if (
            not isinstance(receipt, dict)
            or not receipt.get("canUndo")
            or not receipt.get("rescheduledCids")
            or not str(receipt.get("id", "")).startswith("rescue_")
            or receipt.get("id") == "rescue_active"
        ):
            return {"success": False, "message": "当前没有可撤销的急救记录，或已撤销。"}

        raw_cids = receipt.get("rescheduledCids", [])
        cids = [int(c) for c in raw_cids if str(c).isdigit()]
        col = self.col
        if col is None or not cids:
            return {"success": False, "message": "无可操作的卡片数据。"}

        snapshot = receipt.get("scheduleSnapshot") or {}
        try:
            undo_target = begin_undo_group(col, "Anki Studio · 撤销减负")
            restored, failed, mismatches = 0, [], []
            if snapshot:
                restored, failed = restore_schedule(col, snapshot)
                mismatches = verify_restoration(col, snapshot)
                if failed or mismatches:
                    end_undo_group(col, undo_target)
                    return {
                        "success": False,
                        "message": (
                            f"撤销未通过逐卡校验：{len(failed)} 张回写失败、"
                            f"{len(mismatches)} 张字段不一致，已停止操作以保护卡片。"
                        ),
                        "verification": {
                            "restored": restored,
                            "failed": failed,
                            "mismatches": mismatches,
                        },
                    }
                restored_count = restored
            else:
                # 裸 SQL 兜底已删除，理由同 _cancel_vacation：不维护 usn/mod 会破坏同步。
                if hasattr(col, "sched") and hasattr(col.sched, "set_due_date"):
                    col.sched.set_due_date(list(cids), "0")
                restored_count = len(cids)
            end_undo_group(col, undo_target)
            physical_ok, physical_note = quick_integrity_check(col)

            # Anki 26 Rust backend deprecates both col.sched.reset() and col.save()
            if hasattr(col, "sched") and hasattr(col.sched, "reset") and not hasattr(col, "_backend"):
                try:
                    col.sched.reset()
                except Exception:
                    pass

            _save_col_if_legacy(col)

            mw = self.mw
            if mw is not None and hasattr(mw, "reset"):
                try:
                    mw.reset()
                except Exception:
                    pass

            receipt["canUndo"] = False
            receipt["status"] = "undone"
            receipt["state"] = "undone"
            receipt["undoneAt"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
            receipt["safety"] = {
                **(receipt.get("safety") or {}),
                "undoVerified": bool(snapshot) and not failed and not mismatches,
                "restoredCount": restored_count,
                "integrityOk": physical_ok,
                "integrityNote": physical_note,
            }

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
                "count": restored_count,
                "message": f"已成功撤销削峰急救，{restored_count} 张卡片已逐卡恢复原排期。",
                "verification": {
                    "restored": restored,
                    "failed": failed,
                    "mismatches": mismatches,
                    "exact": bool(snapshot),
                },
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
        """
        data = data or {}
        limit = self._safe_int(data.get("limit"), 15, 5, 30)
        deck_id = data.get("deckId")

        col = self.col
        if col is None:
            return {"success": False, "cards": [], "count": 0}

        try:
            deck_filter = self._build_deck_search_clause(col, deck_id)
            query = f"{deck_filter}is:due is:review"
            cids = list(col.find_cards(query)) if hasattr(col, "find_cards") else []

            if not cids:
                cids = list(col.find_cards(f"{deck_filter}is:due")) if hasattr(col, "find_cards") else []

            if cids and hasattr(col, "get_card"):
                try:
                    cids.sort(key=lambda cid: int(getattr(col.get_card(int(cid)), "ivl", 0) or 0), reverse=True)
                except Exception:
                    pass

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

    def _shift_due_cards(self, col, days: int) -> Tuple[int, List[int], Dict[str, Dict[str, int]]]:
        """Shifts due review cards forward by `days`; also returns their original schedule."""
        try:
            due_cids = col.find_cards("is:due is:review") if hasattr(col, "find_cards") else []
            if not due_cids:
                return 0, [], {}

            cids_list, _skipped = self._filter_schedulable_cids(col, list(due_cids))
            if not cids_list:
                return 0, [], {}
            snapshot = self._snapshot_card_schedule(col, cids_list)
            # 裸 SQL 兜底已删除，理由同 _cancel_vacation：不维护 usn/mod 会破坏同步。
            if hasattr(col, "sched") and hasattr(col.sched, "set_due_date"):
                col.sched.set_due_date(cids_list, str(days))

            mw = self.mw
            if mw is not None and hasattr(mw, "reset"):
                try:
                    mw.reset()
                except Exception:
                    pass

            return len(cids_list), cids_list, snapshot
        except Exception:
            return 0, [], {}

    @staticmethod
    def _snapshot_card_schedule(col, cids: List[int]) -> Dict[str, Dict[str, int]]:
        """Records due/interval/queue before rescheduling so a revert can be lossless."""
        snapshot: Dict[str, Dict[str, int]] = {}
        for cid in cids:
            try:
                card = col.get_card(int(cid))
                snapshot[str(cid)] = {
                    "due": int(card.due),
                    "ivl": int(getattr(card, "ivl", 0) or 0),
                    "queue": int(getattr(card, "queue", 2)),
                }
            except Exception:
                continue
        return snapshot

    @staticmethod
    def _restore_card_schedule(col, snapshot: Dict[str, Dict[str, int]]) -> int:
        """Restores each card via Anki's update_card so mod/usn stay sync-safe."""
        if not snapshot or not hasattr(col, "get_card") or not hasattr(col, "update_card"):
            return 0
        restored = 0
        for cid_str, sched in snapshot.items():
            try:
                card = col.get_card(int(cid_str))
                card.due = int(sched["due"])
                card.ivl = int(sched["ivl"])
                card.queue = int(sched["queue"])
                col.update_card(card)
                restored += 1
            except Exception:
                continue
        return restored

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
