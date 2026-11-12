# -*- coding: utf-8 -*-
"""
Anki Studio — Bridge Router
Dispatches `modern_anki:<json_payload>` commands from the React Webview to domain services.
Supports preferences persistence (`get_preferences`, `save_preferences`), image paste
(`save_pasted_image`), audio playback (`play_audio`), and real AnkiWeb cloud sync (`sync`).
"""

from __future__ import annotations

import json
import time
import traceback
from typing import Any, Callable, Dict, Optional

from .deck_service import DeckService
from .edit_service import EditService
from .review_service import ReviewService
from .search_service import SearchService
from .vacation_service import VacationService


class BridgeRouter:
    """Central IPC router handling all `modern_anki:` pycmd calls."""

    PREFIX = "modern_anki:"

    def __init__(
        self,
        col_getter: Optional[Callable[[], Any]] = None,
        mw_getter: Optional[Callable[[], Any]] = None,
        toggle_native_callback: Optional[Callable[[], Any]] = None,
        config_getter: Optional[Callable[[], Dict[str, Any]]] = None,
        config_writer: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
        health_getter: Optional[Callable[[], Dict[str, Any]]] = None,
    ):
        if col_getter is None:
            def default_col_getter():
                try:
                    from aqt import mw
                    return mw.col if mw else None
                except Exception:
                    return None
            col_getter = default_col_getter

        if mw_getter is None:
            def default_mw_getter():
                try:
                    from aqt import mw
                    return mw
                except Exception:
                    return None
            mw_getter = default_mw_getter

        self._get_col = col_getter
        self._get_mw = mw_getter
        self._toggle_native = toggle_native_callback
        self._get_config = config_getter or (lambda: {})
        self._write_config = config_writer or (lambda cfg: cfg)
        # Runtime compatibility report (Anki version + monkey-patch/hook status),
        # produced by `bridge/compat.py` and refreshed once at startup.
        self._get_health = health_getter or (lambda: {})

        self.deck_service = DeckService(self._get_col, self._get_mw, self._get_config)
        self.review_service = ReviewService(
            self._get_col, self._get_mw, lambda: self.deck_service._resolve_language()
        )
        self.edit_service = EditService(self._get_col)
        self.search_service = SearchService(
            self._get_col, lambda: self.deck_service._resolve_language()
        )
        self.vacation_service = VacationService(
            self._get_col, self._get_mw, self._get_config, self._write_config
        )
        self.deck_service.vacation_service = self.vacation_service

    def handle_pycmd(self, command: str) -> Optional[str]:
        """
        Entry point invoked by Anki's webview_did_receive_js_message hook.
        Returns None if the message does not start with `modern_anki:`.
        Returns a JSON string `{"status": "success"|"error", "data": ..., "message": ...}`.
        """
        if not isinstance(command, str) or not command.startswith(self.PREFIX):
            return None

        raw_payload = command[len(self.PREFIX):]
        try:
            # Single point of truth for vacation expiry and crash recovery: the
            # frontend never calls get_vacation_status, so reconcile before
            # dispatching any action.
            try:
                self.vacation_service.reconcile_expired_vacation()
                self.vacation_service.reconcile_safety_ticket()
            except Exception:
                pass

            req = json.loads(raw_payload) if raw_payload else {}
            action = req.get("action", "")
            data = req.get("data") or {}

            handler = getattr(self, f"action_{action}", None)
            if handler is None:
                return json.dumps(
                    {"status": "error", "message": f"Unknown action: {action}"},
                    ensure_ascii=False,
                )

            result = handler(data)
            return json.dumps(
                {"status": "success", "data": result},
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps(
                {
                    "status": "error",
                    "message": str(e),
                    "trace": traceback.format_exc(),
                },
                ensure_ascii=False,
            )

    # ---- Dashboard, Statistics & Deck Actions ----

    def action_get_dashboard(self, data: Dict[str, Any]) -> Dict[str, Any]:
        result = self.deck_service.get_dashboard(data)
        warning = self.vacation_service.safety_warning()
        if warning:
            result["safetyWarning"] = warning
        return result

    def action_get_statistics(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.get_statistics(data)

    def action_create_deck(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.create_deck(data)

    def action_rename_deck(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.rename_deck(data)

    def action_delete_deck(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.delete_deck(data)

    def action_get_deck_options(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.get_deck_options(data)

    def action_save_deck_options(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.save_deck_options(data)

    def action_trigger_native_import(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.trigger_native_import(data)

    def action_trigger_native_export(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.trigger_native_export(data)

    def action_run_maintenance(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.deck_service.run_maintenance_action(data)

    # ---- Runtime Compatibility / Diagnostics ----

    def action_get_patch_health(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Returns the startup patch/hook/version report (see bridge/compat.py).

        Surfaced for diagnostics: a failed monkey-patch is intentionally
        non-fatal, so this is the only way to tell whether the immersive shell
        actually took over Anki's native dialogs on this Anki/Qt build.
        """
        try:
            report = self._get_health()
        except Exception as exc:
            return {"state": "unknown", "error": str(exc), "warnings": []}
        return report if isinstance(report, dict) else {}

    # ---- User Preferences Persistence Actions (Part 3 #4) ----

    def action_get_preferences(self, data: Dict[str, Any]) -> Dict[str, Any]:
        cfg = self._get_config()
        return {
            "theme": cfg.get("theme", "light"),
            "accentColor": cfg.get("accent_color", "indigo"),
            "language": cfg.get("language", "auto"),
            "resolvedLanguage": self.deck_service._resolve_language(cfg.get("language")),
            "customNickname": cfg.get("custom_nickname", ""),
            "collapsedDeckIds": cfg.get("collapsed_deck_ids", []),
            "sandboxNoteTypeIds": [str(x) for x in (cfg.get("sandbox_notetype_ids") or [])],
            "showShortcutHints": bool(cfg.get("show_shortcut_hints", False)),
            "envInfo": self.deck_service._resolve_platform_and_version(),
        }

    def action_save_preferences(self, data: Dict[str, Any]) -> Dict[str, Any]:
        patch: Dict[str, Any] = {}
        if "theme" in data:
            patch["theme"] = data["theme"]
        if "accentColor" in data:
            patch["accent_color"] = data["accentColor"]
        if "language" in data:
            patch["language"] = data["language"]
        if "customNickname" in data:
            patch["custom_nickname"] = str(data["customNickname"]).strip()
        if "collapsedDeckIds" in data and isinstance(data["collapsedDeckIds"], list):
            patch["collapsed_deck_ids"] = [str(x) for x in data["collapsedDeckIds"]]
        if "sandboxNoteTypeIds" in data and isinstance(data["sandboxNoteTypeIds"], list):
            patch["sandbox_notetype_ids"] = [str(x) for x in data["sandboxNoteTypeIds"] if str(x).strip()]
        if "showShortcutHints" in data:
            patch["show_shortcut_hints"] = bool(data["showShortcutHints"])

        saved = self._write_config(patch)
        return {
            "saved": True,
            "preferences": {
                "theme": saved.get("theme", "light"),
                "accentColor": saved.get("accent_color", "indigo"),
                "language": saved.get("language", "auto"),
                "resolvedLanguage": self.deck_service._resolve_language(saved.get("language")),
                "customNickname": saved.get("custom_nickname", ""),
                "collapsedDeckIds": saved.get("collapsed_deck_ids", []),
                "sandboxNoteTypeIds": [str(x) for x in (saved.get("sandbox_notetype_ids") or [])],
                "showShortcutHints": bool(saved.get("show_shortcut_hints", False)),
            },
        }

    def action_toggle_notetype_sandbox(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Toggles per-NoteType Track B Sandbox Compatibility Mode and persists in config."""
        notetype_id = str((data or {}).get("notetypeId", "") or "").strip()
        if not notetype_id:
            return {"saved": False, "sandboxNoteTypeIds": []}
        cfg = self._get_config()
        current_ids = [str(x) for x in (cfg.get("sandbox_notetype_ids") or []) if str(x).strip()]
        enabled_override = (data or {}).get("enabled")
        if isinstance(enabled_override, bool):
            should_enable = enabled_override
        else:
            should_enable = notetype_id not in current_ids

        if should_enable and notetype_id not in current_ids:
            current_ids.append(notetype_id)
        elif not should_enable and notetype_id in current_ids:
            current_ids = [x for x in current_ids if x != notetype_id]

        saved = self._write_config({"sandbox_notetype_ids": current_ids})
        final_ids = [str(x) for x in (saved.get("sandbox_notetype_ids") or current_ids)]
        return {
            "saved": True,
            "notetypeId": notetype_id,
            "enabled": notetype_id in final_ids,
            "sandboxNoteTypeIds": final_ids,
        }

    # ---- Review, Audio & FSRS Actions ----

    def action_start_review(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.review_service.start_review_session(data)

    def action_get_review_queue(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.review_service.get_review_queue(data)

    def action_preview_custom_study(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.review_service.preview_custom_study(data)

    def action_start_custom_study(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.review_service.start_custom_study(data)

    def action_answer_card(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.review_service.answer_card(data)

    def action_play_audio(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.review_service.play_audio(data)

    def action_undo(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.review_service.undo_last_action(data)

    # ---- Inline Edit, Media Paste & Quick Add Actions ----

    def action_get_note_types(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.get_note_types(data)

    def action_check_duplicate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.check_duplicate_note(data)

    def action_update_card_inline(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.update_card_inline(data)

    def action_save_pasted_image(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.save_pasted_image(data)

    def action_quick_add(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.quick_add_card(data)

    def action_toggle_suspend(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.toggle_suspend_card(data)

    def action_toggle_bury(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.toggle_bury_card(data)

    def action_set_card_flag(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.set_card_flag(data)

    def action_delete_cards(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.edit_service.delete_cards(data)

    # ---- Search & Faceted Library Actions ----

    def action_search_cards(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.search_service.search_cards(data)

    def action_batch_action(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.search_service.batch_action(data)

    # ---- Native Host Escape & Cloud Sync Actions (#14 & Part 3 #5) ----

    def action_toggle_native_ui(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if self._toggle_native:
            self._toggle_native()
        return {"switched": True}

    def action_sync(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Invokes Anki's native AnkiWeb cloud sync (`mw.on_sync_button_clicked` / `mw.onSync`)."""
        mw = self._get_mw()
        triggered_native = False
        requires_login = False
        media_sync_in_progress = False
        if mw is not None:
            try:
                pm = getattr(mw, "pm", None)
                sync_auth_fn = getattr(pm, "sync_auth", None) if pm is not None else None
                if callable(sync_auth_fn):
                    try:
                        if not sync_auth_fn():
                            requires_login = True
                    except Exception:
                        pass

                media_syncer = getattr(mw, "media_syncer", None)
                is_media_syncing = getattr(media_syncer, "is_syncing", None) if media_syncer is not None else None
                if callable(is_media_syncing):
                    try:
                        if is_media_syncing() is True:
                            media_sync_in_progress = True
                    except Exception:
                        pass

                if hasattr(mw, "on_sync_button_clicked"):
                    mw.on_sync_button_clicked()
                    triggered_native = True
                elif hasattr(mw, "onSync"):
                    mw.onSync()
                    triggered_native = True
                elif hasattr(mw, "on_sync"):
                    mw.on_sync()
                    triggered_native = True
            except Exception as e:
                print(f"[Anki Studio] Error triggering native sync: {e}")

        if requires_login:
            return {
                "synced": False,
                "triggeredNativeSync": triggered_native,
                "requiresLogin": True,
                "syncedAt": 0,
            }

        # Do not return a synthetic pre-completion `syncedAt` while Anki's async
        # sync job is still running; `anki:sync-finished` carries the verified timestamp.
        return {
            "synced": triggered_native,
            "triggeredNativeSync": triggered_native,
            "asyncPending": triggered_native,
            "mediaSyncInProgress": media_sync_in_progress,
            "requiresLogin": False,
        }

    def action_sync_collection(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.action_sync(data)

    def action_copy_to_clipboard(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Copies text natively to the host OS clipboard via Qt."""
        text = str(data.get("text", "") or "")
        try:
            from aqt.qt import QGuiApplication
            clip = QGuiApplication.clipboard()
            if clip is not None:
                clip.setText(text)
                return {"copied": True, "length": len(text)}
        except Exception as e:
            print(f"[Anki Studio] Error writing to native clipboard: {e}")
        return {"copied": False}

    def action_move_window(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Moves the Anki window by the given delta (dx, dy)."""
        mw = self._get_mw()
        if mw is None:
            return {"moved": False}
        try:
            dx = int(data.get("dx", 0))
            dy = int(data.get("dy", 0))
            if dx != 0 or dy != 0:
                mw.move(mw.x() + dx, mw.y() + dy)
            return {"moved": True, "x": mw.x(), "y": mw.y()}
        except Exception as e:
            return {"moved": False, "error": str(e)}

    def action_start_system_move(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Attempts native OS window drag (Qt 6.5+ startSystemMove on QWindow)."""
        mw = self._get_mw()
        if mw is None:
            return {"started": False}
        try:
            wh = mw.window().windowHandle() if hasattr(mw, "window") else None
            if wh and hasattr(wh, "startSystemMove"):
                res = wh.startSystemMove()
                return {"started": bool(res)}
        except Exception:
            pass
        return {"started": False}

    def action_toggle_maximize(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Toggles window maximize/restore on double-click (standard macOS behavior)."""
        mw = self._get_mw()
        if mw is None:
            return {"maximized": False}
        try:
            if hasattr(mw, "isMaximized") and mw.isMaximized():
                mw.showNormal()
            elif hasattr(mw, "showMaximized"):
                mw.showMaximized()
            return {"maximized": getattr(mw, "isMaximized", lambda: False)()}
        except Exception as e:
            return {"maximized": False, "error": str(e)}

    # ---- Vacation Mode & Anti-Avalanche Rescue Actions ----

    def action_get_vacation_status(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.get_vacation_status(data)

    def action_set_vacation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.set_vacation(data)

    def action_end_vacation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.end_vacation(data)

    def action_cancel_vacation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.cancel_vacation(data)

    def action_get_vacation_history(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.get_vacation_history(data)

    def action_rescue_backlog(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.rescue_backlog(data)

    def action_undo_rescue(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.undo_last_rescue(data)

    def action_get_rescue_history(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.get_rescue_history(data)

    def action_start_low_energy(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.vacation_service.start_low_energy_session(data)
