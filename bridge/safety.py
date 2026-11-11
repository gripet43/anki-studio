# -*- coding: utf-8 -*-
"""
Anki Studio - Card Safety Guard (Round 2)

Application-level safety shell for destructive bulk operations. Anki's
collection lives in SQLite while the add-on's own state lives in JSON, so a
single SQLite transaction cannot make a bulk operation atomic. Instead we:

  1. capture a per-card field snapshot BEFORE any write,
  2. write a pending operation ticket to config (crash marker),
  3. open one native Anki undo entry and merge all writes into it,
  4. optionally ask Anki for a backup (throttled by the user's own interval),
  5. after the write, verify every captured field was restored/committed,
  6. mark the ticket done. On the next IPC call, any still-pending ticket is
     reconciled by restoring its snapshot.

All native Anki APIs are guarded with hasattr + try/except: an older Anki or a
test double must degrade gracefully instead of breaking the operation.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

TICKET_KEY = "safety_ticket"

# Scheduling/content fields that a reschedule must never change implicitly.
# mod/usn are intentionally excluded: Anki rewrites those on every write.
SCHEDULE_FIELDS = (
    "due", "ivl", "queue", "type", "did", "factor", "reps", "lapses",
    "odue", "odid", "data",
)


def capture_schedule(col: Any, cids: List[Any]) -> Dict[str, Dict[str, Any]]:
    snapshot: Dict[str, Dict[str, Any]] = {}
    for cid in cids:
        try:
            card = col.get_card(int(cid))
            if card is None:
                continue
            snapshot[str(cid)] = {
                field: getattr(card, field, None) for field in SCHEDULE_FIELDS
            }
        except Exception:
            continue
    return snapshot


def restore_schedule(col: Any, snapshot: Dict[str, Dict[str, Any]]) -> Tuple[int, List[str]]:
    """Restore each card via col.update_card so Anki keeps mod/usn consistent."""
    restored = 0
    failed: List[str] = []
    for cid_str, fields in (snapshot or {}).items():
        try:
            card = col.get_card(int(cid_str))
            if card is None:
                failed.append(cid_str)
                continue
            for field, value in fields.items():
                if value is not None and hasattr(card, field):
                    setattr(card, field, value)
            col.update_card(card)
            restored += 1
        except Exception:
            failed.append(cid_str)
    return restored, failed


def verify_restoration(col: Any, snapshot: Dict[str, Dict[str, Any]]) -> List[str]:
    """Return card IDs whose captured fields no longer match. Empty = verified."""
    mismatches: List[str] = []
    for cid_str, fields in (snapshot or {}).items():
        try:
            card = col.get_card(int(cid_str))
            if card is None:
                mismatches.append(cid_str)
                continue
            for field, expected in fields.items():
                if expected is not None and getattr(card, field, None) != expected:
                    mismatches.append(cid_str)
                    break
        except Exception:
            mismatches.append(cid_str)
    return mismatches


def checksum(snapshot: Dict[str, Any]) -> str:
    payload = json.dumps(snapshot, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# -- Anki native safety APIs (all optional) ---------------------------------

def begin_undo_group(col: Any, name: str) -> Optional[int]:
    try:
        if col is not None and hasattr(col, "add_custom_undo_entry"):
            return int(col.add_custom_undo_entry(name))
    except Exception:
        pass
    return None


def end_undo_group(col: Any, target: Optional[int]) -> bool:
    if target is None:
        return False
    try:
        if col is not None and hasattr(col, "merge_undo_entries"):
            col.merge_undo_entries(target)
            return True
    except Exception:
        pass
    return False


def try_native_backup(mw: Any, col: Any) -> bool:
    """Throttled by Anki's own backup interval (force=False). Never fatal."""
    try:
        if col is None or not hasattr(col, "create_backup"):
            return False
        pm = getattr(mw, "pm", None)
        folder = None
        if pm is not None and hasattr(pm, "backupFolder"):
            folder = pm.backupFolder()
        if not folder:
            return False
        return bool(col.create_backup(
            backup_folder=folder, force=False, wait_for_completion=True
        ))
    except Exception:
        return False


def quick_integrity_check(col: Any) -> Tuple[bool, str]:
    """Read-only physical check. Unavailable/failed checks never block a write."""
    try:
        if col is None or not hasattr(col, "db"):
            return True, "unavailable"
        rows = col.db.all("PRAGMA quick_check")
        if rows and str(rows[0][0]).lower() == "ok":
            return True, "ok"
        return False, str(rows[0][0]) if rows else "unknown"
    except Exception:
        return True, "unavailable"


# -- Operation tickets -------------------------------------------------------

def begin_ticket(
    writer: Callable[[Dict[str, Any]], Any],
    name: str,
    receipt_id: str,
    snapshot: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    ticket = {
        "id": f"ticket_{int(time.time() * 1000)}",
        "name": name,
        "receiptId": receipt_id,
        "cardCount": len(snapshot),
        "checksum": checksum(snapshot),
        "startedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "state": "pending",
    }
    writer({TICKET_KEY: ticket})
    return ticket


def finish_ticket(
    writer: Callable[[Dict[str, Any]], Any],
    ticket: Dict[str, Any],
    state: str,
) -> Dict[str, Any]:
    updated = dict(ticket)
    updated["state"] = state
    updated["finishedAt"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    writer({TICKET_KEY: updated})
    return updated


def reconcile_pending_ticket(
    reader: Callable[[], Dict[str, Any]],
    writer: Callable[[Dict[str, Any]], Any],
    col: Any,
) -> Optional[Dict[str, Any]]:
    """Called before every IPC action. A pending ticket means the previous
    process died mid-operation; restore its snapshot to reach a consistent state.

    The snapshot is looked up by receipt id and checked against the checksum
    recorded in the ticket, so a stale or mismatched snapshot is never applied.
    """
    cfg = reader() or {}
    ticket = cfg.get(TICKET_KEY)
    if not isinstance(ticket, dict) or ticket.get("state") != "pending":
        return None

    receipt = None
    for item in (cfg.get("rescue_history") or []):
        if item.get("id") == ticket.get("receiptId"):
            receipt = item
            break
    snapshot = (receipt or {}).get("scheduleSnapshot") or {}

    result: Dict[str, Any] = {
        "ticketId": ticket.get("id"),
        "restored": 0,
        "failed": [],
        "mismatches": [],
        "state": "orphaned",
    }
    if snapshot and checksum(snapshot) == ticket.get("checksum"):
        restored, failed = restore_schedule(col, snapshot)
        mismatches = verify_restoration(col, snapshot)
        result.update({
            "restored": restored,
            "failed": failed,
            "mismatches": mismatches,
            "state": "recovered" if not failed and not mismatches else "partial",
        })
        # Anki 2.1.50+ / 26.x with Rust `_backend` saves automatically and deprecates `col.save()`
        if col is not None and hasattr(col, "save") and not hasattr(col, "_backend"):
            try:
                col.save()
            except Exception:
                pass

    finish_ticket(writer, ticket, result["state"])
    return result
