# -*- coding: utf-8 -*-
"""
Anki Studio — Native Add-on Entry Point (Anki 26.x / Qt6)
Non-intrusively mounts the full-screen Modern Web UI over Anki's `mw.centralWidget()`,
connects the <2ms pycmd IPC bridge, listens to Anki native lifecycle hooks
(sync_did_finish, operation_did_execute, state_did_reset) for two-way live sync,
and provides a 3-Layer Anti-Lost Safety Net to switch seamlessly between Anki Studio and native Anki:
  1. Global Hotkey: `Ctrl+Opt+M` (macOS) / `Ctrl+Alt+M` (Windows/Linux) with ApplicationShortcut context
  2. Native Menu Bar & Tools Menu Actions: Top-level `🌟 Anki Studio` menu bar action + `切换 Anki Studio / 原生界面`
  3. Native Top Toolbar Permanent Button: `[ 🌟 进入 Anki Studio (Ctrl+Opt+M) ]` injected via `top_toolbar_did_init_links`
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .bridge.router import BridgeRouter

ADDON_DIR = Path(__file__).resolve().parent
WEB_DIST_DIR = ADDON_DIR / "web"
CONFIG_FILE = ADDON_DIR / "config.json"

# Comfortable default & minimum workspace dimensions so Windows first-run (683x609)
# never crushes the multi-column modern dashboard into vertical single-character lines.
MODERN_DEFAULT_WIDTH = 1180
MODERN_DEFAULT_HEIGHT = 760
MODERN_MIN_WIDTH = 860
MODERN_MIN_HEIGHT = 600


class AnkiModernHost:
    """Manages the full-screen modern Anki WebEngine overlay, preferences persistence, and 3-layer native switch."""

    def __init__(self):
        self.webview: Optional[Any] = None
        self.is_modern_visible: bool = False
        self._sync_error_in_flight: Optional[str] = None
        self._orig_min_size: Optional[Any] = None
        self._did_initial_expand: bool = bool(
            self.get_config().get("windowInitialExpandDone", False)
        )
        self.router = BridgeRouter(
            toggle_native_callback=self.toggle_modern_ui,
            config_getter=self.get_config,
            config_writer=self.write_config,
        )

    def get_config(self) -> Dict[str, Any]:
        try:
            from aqt import mw
            if mw and getattr(mw, "addonManager", None):
                cfg = mw.addonManager.getConfig(__name__)
                if isinstance(cfg, dict):
                    return cfg
        except Exception:
            pass
        if CONFIG_FILE.exists():
            try:
                return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {}

    def write_config(self, new_cfg: Dict[str, Any]) -> Dict[str, Any]:
        merged = {**self.get_config(), **(new_cfg or {})}
        try:
            from aqt import mw
            if mw and getattr(mw, "addonManager", None):
                mw.addonManager.writeConfig(__name__, merged)
                # config.json is the add-on's default/schema template. Runtime
                # state (receipts, real card text, vacation snapshots) belongs in
                # meta.json only, otherwise it ships inside the .ankiaddon.
                return merged
        except Exception as e:
            print(f"[Anki Studio] writeConfig failed: {e}")
        # Outside the Anki runtime (unit tests / tooling) there is no
        # addonManager, so keep a local fallback for preferences round-tripping.
        try:
            CONFIG_FILE.write_text(
                json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception:
            pass
        return merged

    def initialize(self) -> None:
        try:
            from aqt import gui_hooks, mw
            from aqt.qt import QAction, QKeySequence, Qt
        except ImportError:
            # Outside Anki runtime (e.g., automated unit tests)
            return

        if mw is None:
            return

        # 1. Register pycmd IPC bridge listener (handles both modern_anki: and native toolbar return link)
        gui_hooks.webview_did_receive_js_message.append(self._on_js_message)

        # 2. Register profile loaded hook to mount Modern UI
        gui_hooks.main_window_did_init.append(self._on_main_window_init)
        # `main_window_did_init` 每次启动只触发一次；换用户档案（File → Switch Profile）
        # 会卸载并重新打开合集、重建主窗口的中央控件，之前挂上去的 webview 会随之被销毁。
        # 没有这个钩子的话，用户切一次档案就永久掉回原生界面，且再也切不回来。
        if hasattr(gui_hooks, "profile_did_open"):
            gui_hooks.profile_did_open.append(self._on_profile_did_open)

        # 3. Register two-way lifecycle & ecosystem hooks
        if hasattr(gui_hooks, "sync_will_start"):
            gui_hooks.sync_will_start.append(self._on_sync_will_start)
        if hasattr(gui_hooks, "sync_did_finish"):
            gui_hooks.sync_did_finish.append(self._on_sync_did_finish)
        if hasattr(gui_hooks, "operation_did_execute"):
            gui_hooks.operation_did_execute.append(self._on_operation_did_execute)
        if hasattr(gui_hooks, "state_did_reset"):
            gui_hooks.state_did_reset.append(self._on_state_did_reset)

        # 4. Layer 3 Safety Net: Inject prominent "[ 🌟 进入 Anki Studio (Ctrl+Opt+M) ]" button into Anki native top toolbar
        if hasattr(gui_hooks, "top_toolbar_did_init_links"):
            gui_hooks.top_toolbar_did_init_links.append(self._on_top_toolbar_init_links)

        # 5. Layer 1 & Layer 2 Safety Net: Tools menu action, Top Menu Bar action & Application-wide Hotkeys
        shortcut_hint = "Ctrl+Opt+M" if sys.platform.startswith("darwin") else "Ctrl+Alt+M"
        # Qt swaps Ctrl/Meta on macOS: "Meta+Alt+M" is the documented ⌃⌥M there,
        # while other platforms need a literal "Ctrl+Alt+M". Using ApplicationShortcut
        # guarantees the shortcut works even when a child QWebEngineView holds or loses focus.
        shortcut_seq = QKeySequence(
            "Meta+Alt+M" if sys.platform.startswith("darwin") else "Ctrl+Alt+M"
        )
        action = QAction(f"切换 Anki Studio / 原生界面 ({shortcut_hint})", mw)
        action.setShortcut(shortcut_seq)
        try:
            action.setShortcutContext(Qt.ShortcutContext.ApplicationShortcut)
        except Exception:
            pass
        action.triggered.connect(self.toggle_modern_ui)
        mw.form.menuTools.addAction(action)
        self._modern_toggle_action = action

        # Also mount a one-click top-level "Anki Studio" entry on the native menu bar
        # so users in Native UI on Windows/Linux can switch back with a single native menu click
        # even if QtWebEngine mouse input inside mw.toolbar.web is unavailable (e.g. QEMU VM).
        try:
            if hasattr(mw.form, "menubar") and mw.form.menubar is not None:
                menubar_action = QAction("🌟 Anki Studio", mw)
                menubar_action.setToolTip(f"切换 Anki Studio / 原生界面 ({shortcut_hint})")
                menubar_action.triggered.connect(self.toggle_modern_ui)
                mw.form.menubar.addAction(menubar_action)
                self._menubar_toggle_action = menubar_action
        except Exception:
            pass

        # 6. Bridge native Tools -> Preferences (Ctrl+P / Cmd+,) to Modern Settings Modal when Modern UI is active
        self._patch_preferences_action()

        # 7. Suppress duplicate native Qt sync progress modal dialogs & tooltips while Modern UI is active
        self._patch_anki_dialogs()

    def _patch_preferences_action(self) -> None:
        """
        Ensures triggering Tools -> Preferences (`Ctrl+P` on Windows/Linux, `Cmd+,` on macOS)
        while Modern UI is visible opens Anki Studio's Settings Modal instead of doing nothing
        or opening an orphaned background dialog; preserves native Preferences when in Native UI.
        """
        host = self
        try:
            from aqt import mw
            from aqt.qt import Qt
            if mw is None:
                return
            pref_action = getattr(mw.form, "actionPreferences", None)
            if pref_action is not None:
                try:
                    pref_action.setShortcutContext(Qt.ShortcutContext.ApplicationShortcut)
                except Exception:
                    pass
            if hasattr(mw, "onPrefs") and not getattr(mw, "_anki_modern_prefs_patched", False):
                orig_on_prefs = mw.onPrefs

                def modern_on_prefs(*args, **kwargs):
                    if host.is_modern_visible:
                        host._emit_js_event("anki:open-settings", {})
                        return None
                    return orig_on_prefs(*args, **kwargs)

                mw.onPrefs = modern_on_prefs
                if pref_action is not None:
                    try:
                        pref_action.triggered.disconnect()
                    except Exception:
                        pass
                    pref_action.triggered.connect(modern_on_prefs)
                mw._anki_modern_prefs_patched = True
        except Exception:
            pass

    def _patch_anki_dialogs(self) -> None:
        """
        Non-intrusively silences Anki's duplicate native modal Qt progress dialogs
        and native tooltip popups when Modern UI is active, avoiding overwhelming dialog clutter.
        Standard native behavior resumes instantly when switching back to native Anki.
        """
        host = self
        try:
            from aqt.progress import ProgressManager
            if not getattr(ProgressManager, "_anki_modern_patched", False):
                orig_show_win = ProgressManager._showWin
                orig_set_busy = getattr(ProgressManager, "_set_busy_cursor", None)
                orig_restore = getattr(ProgressManager, "_restore_cursor", None)

                def silent_show_win(pm_self):
                    if host.is_modern_visible:
                        import time
                        pm_self._shown = time.monotonic()
                        return None
                    return orig_show_win(pm_self)

                def modern_set_busy_cursor(pm_self):
                    if host.is_modern_visible:
                        return None
                    if orig_set_busy:
                        return orig_set_busy(pm_self)

                def modern_restore_cursor(pm_self):
                    if host.is_modern_visible:
                        try:
                            from aqt import mw
                            if mw and hasattr(mw, "app") and mw.app:
                                while mw.app.overrideCursor():
                                    mw.app.restoreOverrideCursor()
                        except Exception:
                            pass
                        return None
                    if orig_restore:
                        return orig_restore(pm_self)

                ProgressManager._showWin = silent_show_win
                ProgressManager._set_busy_cursor = modern_set_busy_cursor
                ProgressManager._restore_cursor = modern_restore_cursor
                ProgressManager._anki_modern_patched = True
        except Exception:
            pass

        try:
            import aqt.utils
            import re

            if not getattr(aqt.utils, "_anki_modern_patched", False):
                orig_tooltip = aqt.utils.tooltip

                def modern_tooltip_interceptor(msg, *args, **kwargs):
                    if host.is_modern_visible:
                        try:
                            if hasattr(aqt.utils, "closeTooltip"):
                                aqt.utils.closeTooltip()
                            clean_text = re.sub(r"<[^>]*>", "", str(msg or "")).strip()
                            sync_ignore_terms = ("集合同步完成", "Collection synced", "同步已完成", "同步完成")
                            if clean_text in sync_ignore_terms:
                                return None
                            if clean_text:
                                host._emit_js_event("anki:toast", {"message": clean_text})
                        except Exception:
                            pass
                        return None
                    return orig_tooltip(msg, *args, **kwargs)

                aqt.utils.tooltip = modern_tooltip_interceptor
                self._modern_tooltip_interceptor = modern_tooltip_interceptor
                self._orig_tooltip = orig_tooltip

                for mod_name, mod in list(sys.modules.items()):
                    if mod:
                        if getattr(mod, "tooltip", None) is orig_tooltip:
                            try:
                                setattr(mod, "tooltip", modern_tooltip_interceptor)
                            except Exception:
                                pass
                aqt.utils._anki_modern_patched = True
        except Exception:
            pass

        try:
            import aqt.sync
            if not getattr(aqt.sync, "_anki_modern_sync_err_patched", False):
                orig_handle_sync_error = getattr(aqt.sync, "handle_sync_error", None)
                if callable(orig_handle_sync_error):
                    host = self

                    def modern_handle_sync_error(mw_arg, err, *args, **kwargs):
                        try:
                            host._sync_error_in_flight = str(err) if err is not None else "Sync error"
                        except Exception:
                            pass
                        return orig_handle_sync_error(mw_arg, err, *args, **kwargs)

                    aqt.sync.handle_sync_error = modern_handle_sync_error
                    for mod_name, mod in list(sys.modules.items()):
                        if mod and getattr(mod, "handle_sync_error", None) is orig_handle_sync_error:
                            try:
                                setattr(mod, "handle_sync_error", modern_handle_sync_error)
                            except Exception:
                                pass
                aqt.sync._anki_modern_sync_err_patched = True
        except Exception:
            pass

    def _on_top_toolbar_init_links(self, links: List[str], toolbar: Any) -> None:
        """
        Layer 3 Anti-Lost Safety Net:
        Injects a prominent pill button into Anki's native top toolbar (`mw.toolbar`)
        so users who switched to native Anki can always return to Anki Studio in a single click.
        """
        try:
            shortcut_hint = "Ctrl+Opt+M" if sys.platform.startswith("darwin") else "Ctrl+Alt+M"
            label_html = (
                "<span style='"
                "background:linear-gradient(135deg,#3076C3,#4D92DE);"
                "color:#FFFFFF;"
                "padding:4px 12px;"
                "border-radius:999px;"
                "font-weight:600;"
                "font-size:12px;"
                "box-shadow:0 2px 8px rgba(48,118,195,0.35);"
                "display:inline-flex;"
                "align-items:center;"
                "gap:4px;"
                "'>"
                f"🌟 进入 Anki Studio ({shortcut_hint})"
                "</span>"
            )
            link = toolbar.create_link(
                cmd="anki_modern_os_return",
                label=label_html,
                func=self.show_modern_ui,
                tip=f"点击立即返回 Anki Studio 现代工作区 ({shortcut_hint})",
                id="anki-studio-return-btn",
            )
            links.append(link)
        except Exception:
            pass

    def _emit_js_event(self, event_name: str, detail: Optional[Dict[str, Any]] = None) -> None:
        if self.webview is None or not self.is_modern_visible:
            return
        try:
            payload = json.dumps(detail or {}, ensure_ascii=False)
            script = (
                f"(function() {{"
                f"  try {{"
                f"    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {{"
                f"      window.dispatchEvent(new CustomEvent({json.dumps(event_name)}, {{ detail: {payload} }}));"
                f"    }}"
                f"  }} catch (e) {{}}"
                f"}})();"
            )
            self.webview.eval(script)
        except Exception:
            pass

    def _on_sync_will_start(self) -> None:
        """Triggered when AnkiWeb cloud sync initiates (including auto-sync on startup)."""
        self._sync_error_in_flight = None
        self._emit_js_event("anki:sync-started", {"syncing": True})

    def _on_sync_did_finish(self) -> None:
        """Triggered when AnkiWeb cloud sync genuinely finishes."""
        mw = None
        try:
            from aqt import mw
            if mw and hasattr(mw, "app") and mw.app:
                while mw.app.overrideCursor():
                    mw.app.restoreOverrideCursor()
        except Exception:
            pass

        sync_err = self._sync_error_in_flight
        self._sync_error_in_flight = None
        if sync_err:
            self._emit_js_event("anki:sync-finished", {"synced": False, "error": sync_err})
            return

        import time as _time
        from .bridge.deck_service import DeckService

        col = getattr(mw, "col", None) if mw is not None else None
        ls_ts = DeckService._get_last_sync_timestamp(col) if col is not None else None
        if ls_ts is not None and ls_ts <= 0:
            self._emit_js_event("anki:sync-finished", {"synced": False, "syncedAt": 0})
            return

        synced_at_ms = int(_time.time() * 1000)
        if ls_ts is not None and ls_ts > 0:
            try:
                profile_key = DeckService.resolve_profile_sync_key(mw)
                cfg = self.get_config() or {}
                checked_map = cfg.get("last_sync_checked_map")
                next_map = dict(checked_map) if isinstance(checked_map, dict) else {}
                prev_ts = int(next_map.get(profile_key, 0) or 0)
                next_map[profile_key] = max(prev_ts, synced_at_ms)
                cfg["last_sync_checked_map"] = next_map
                self.write_config(cfg)
            except Exception as e:
                print(f"[Anki Studio] Failed to persist last_sync_checked_map: {e}")

        self._emit_js_event("anki:sync-finished", {"synced": True, "syncedAt": synced_at_ms})
        self._emit_js_event("anki:collection-updated", {"source": "sync"})

    def _on_operation_did_execute(self, changes: Any, handler: Any) -> None:
        """Triggered when background operations mutate collection."""
        if handler is self.webview:
            return
        self._emit_js_event("anki:collection-updated", {"source": "operation"})

    def _hide_native_webviews(self, mw: Any) -> None:
        """Hides Anki's native toolbar, main webview, and bottom webview so they never overlap or steal input."""
        if mw is None:
            return
        toolbar = getattr(mw, "toolbar", None)
        if toolbar and getattr(toolbar, "web", None):
            try:
                toolbar.web.hide()
            except Exception:
                pass

        bottom_web = getattr(mw, "bottomWeb", None)
        if bottom_web is not None:
            try:
                bottom_web.hide()
            except Exception:
                pass

        main_web = getattr(mw, "web", None)
        if main_web is not None:
            try:
                main_web.hide()
            except Exception:
                pass

    def _sync_webview_geometry_and_focus(self, grab_focus: bool = False) -> None:
        """Synchronizes Modern WebView bounds to its parent container and keeps it stacked on top."""
        if self.webview is None or not self.is_modern_visible:
            return
        try:
            from aqt import mw
            target = self.webview.parentWidget() if hasattr(self.webview, "parentWidget") else None
            if target is None:
                target = self.webview.parent() or mw
            if target is not None:
                w, h = int(target.width()), int(target.height())
                if w > 0 and h > 0:
                    self.webview.setGeometry(0, 0, w, h)
            self.webview.show()
            self.webview.raise_()
            if grab_focus:
                self.webview.setFocus()
        except Exception:
            pass

    def _on_state_did_reset(self, *args: Any) -> None:
        """
        When Anki runs `mw.reset()`, native Anki re-shows `mw.toolbar.web` and `mw.web`.
        On Windows/Linux where `self.webview` lives inside `mw.centralWidget()`, we must
        immediately re-hide the native webviews and raise `self.webview` so native widgets
        never cover or steal mouse/keyboard input from Anki Studio.
        """
        if self.is_modern_visible:
            try:
                from aqt import mw
                self._hide_native_webviews(mw)
                self._sync_webview_geometry_and_focus(grab_focus=True)
            except Exception:
                pass
            self._emit_js_event("anki:collection-updated", {"source": "reset"})

    def _on_main_window_init(self) -> None:
        cfg = self.get_config()
        if cfg.get("auto_launch_modern_ui", True):
            self.show_modern_ui()

    def _on_profile_did_open(self) -> None:
        """换用户档案后把现代界面重新挂回去。

        档案切换会卸载旧合集并重建主窗口的中央控件，挂在旧父控件下的 webview
        已被 Qt 销毁。只在用户本来就处于现代界面时才重挂：切回原生是用户的显式
        选择，不该因为换了档案就被覆盖。启动时这个钩子会早于 main_window_did_init
        触发，那一次 is_modern_visible 还是 False，因此天然不会重复挂载。
        """
        if not self.is_modern_visible:
            return
        try:
            self.show_modern_ui()
        except Exception as e:
            print(f"[Anki Studio] re-mount after profile switch failed: {e}")

    @staticmethod
    def _apply_cocoa_immersive_titlebar(win_id: int, immersive: bool = True) -> bool:
        """
        Cross-platform safe macOS Cocoa titlebar styling:
        Applies NSWindowStyleMaskFullSizeContentView (1 << 15), transparent titlebar, and hidden title
        so the Modern UI seamlessly extends behind the native macOS traffic lights (🔴 🟡 🟢).
        Reverts safely back to standard window styling when returning to native Anki.
        """
        if not sys.platform.startswith("darwin"):
            return False
        try:
            import ctypes
            import ctypes.util

            objc = ctypes.cdll.LoadLibrary(ctypes.util.find_library("objc"))
            msg_id = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p)(("objc_msgSend", objc))
            sel = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_char_p)(("sel_registerName", objc))

            sel_window = sel(b"window")
            ns_window = msg_id(win_id, sel_window)
            if not ns_window:
                return False

            msg_ulong = ctypes.CFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p, ctypes.c_void_p)(("objc_msgSend", objc))
            msg_set_ulong = ctypes.CFUNCTYPE(None, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong)(("objc_msgSend", objc))
            msg_set_bool = ctypes.CFUNCTYPE(None, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_bool)(("objc_msgSend", objc))
            msg_set_long = ctypes.CFUNCTYPE(None, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_long)(("objc_msgSend", objc))

            sel_styleMask = sel(b"styleMask")
            sel_setStyleMask = sel(b"setStyleMask:")
            sel_setTransparent = sel(b"setTitlebarAppearsTransparent:")
            sel_setTitleVis = sel(b"setTitleVisibility:")
            sel_setMovable = sel(b"setMovableByWindowBackground:")

            curr_mask = msg_ulong(ns_window, sel_styleMask)
            full_size_mask = 1 << 15

            if immersive:
                msg_set_ulong(ns_window, sel_setStyleMask, curr_mask | full_size_mask)
                msg_set_bool(ns_window, sel_setTransparent, True)
                msg_set_long(ns_window, sel_setTitleVis, 1)  # NSWindowTitleHidden
                try:
                    msg_set_bool(ns_window, sel_setMovable, True)
                except Exception:
                    pass
            else:
                msg_set_ulong(ns_window, sel_setStyleMask, curr_mask & ~full_size_mask)
                msg_set_bool(ns_window, sel_setTransparent, False)
                msg_set_long(ns_window, sel_setTitleVis, 0)  # NSWindowTitleVisible
                try:
                    msg_set_bool(ns_window, sel_setMovable, False)
                except Exception:
                    pass
            return True
        except Exception:
            return False

    def _ensure_comfortable_window_size(self, mw: Any) -> None:
        """
        Ensures the host Anki window meets Modern UI minimum dimensions and expands
        tiny first-run windows (such as Windows default 683x609) to a comfortable desktop size.
        """
        if mw is None:
            return
        try:
            if self._orig_min_size is None and hasattr(mw, "minimumSize"):
                self._orig_min_size = mw.minimumSize()
            if hasattr(mw, "setMinimumSize"):
                mw.setMinimumSize(MODERN_MIN_WIDTH, MODERN_MIN_HEIGHT)

            is_max_or_full = (
                (hasattr(mw, "isMaximized") and mw.isMaximized())
                or (hasattr(mw, "isFullScreen") and mw.isFullScreen())
            )
            if not is_max_or_full and not self._did_initial_expand:
                curr_w = int(mw.width()) if hasattr(mw, "width") else MODERN_DEFAULT_WIDTH
                curr_h = int(mw.height()) if hasattr(mw, "height") else MODERN_DEFAULT_HEIGHT
                if curr_w < 1040 or curr_h < 680:
                    target_w = max(curr_w, MODERN_DEFAULT_WIDTH)
                    target_h = max(curr_h, MODERN_DEFAULT_HEIGHT)
                    # Clamp to available screen geometry so we never overflow small displays (e.g. 1280x800)
                    try:
                        screen = mw.screen() if hasattr(mw, "screen") else None
                        if screen is not None and hasattr(screen, "availableGeometry"):
                            avail = screen.availableGeometry()
                            avail_w, avail_h = int(avail.width()), int(avail.height())
                            if avail_w > 0 and avail_h > 0:
                                target_w = min(target_w, max(MODERN_MIN_WIDTH, avail_w - 40))
                                target_h = min(target_h, max(MODERN_MIN_HEIGHT, avail_h - 40))
                    except Exception:
                        pass
                    mw.resize(target_w, target_h)
                    # 只在真正改过窗口时落持久化标记：之后用户手动调小的尺寸不再被启动流程覆盖。
                    # 窗口本来就够大的用户不写标记，每次启动检查一次但不做任何 resize。
                    self._did_initial_expand = True
                    try:
                        self.write_config({"windowInitialExpandDone": True})
                    except Exception:
                        pass
        except Exception:
            pass

    def _ensure_webview(self) -> Any:
        from aqt import mw
        from aqt.qt import Qt, QUrl
        from aqt.webview import AnkiWebView

        # Mount directly to mw on macOS for full-height titlebar immersion, or centralWidget on other platforms
        target_parent = mw if (mw and sys.platform.startswith("darwin")) else (
            mw.centralWidget()
            if mw and hasattr(mw, "centralWidget") and mw.centralWidget()
            else mw
        )

        if self.webview is not None:
            # 换用户档案（File → Switch Profile）时 Anki 会重建主窗口的中央控件，
            # 挂在旧父控件下的 webview 会被 Qt 一并销毁。此后 self.webview 只是个
            # 悬空的 Python 壳，碰任何方法都会抛 RuntimeError("wrapped C/C++ object
            # ... has been deleted")。所以每次进来先探活，再对齐父控件。
            try:
                current_parent = self.webview.parent()
            except RuntimeError:
                self.webview = None
            else:
                if target_parent is not None and current_parent is not target_parent:
                    try:
                        self.webview.setParent(target_parent)
                    except RuntimeError:
                        self.webview = None
                if self.webview is not None:
                    return self.webview

        self.webview = AnkiWebView(parent=target_parent)
        self.webview.setObjectName("ankiModernOSWebView")
        try:
            self.webview.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
            self.webview.setAttribute(Qt.WidgetAttribute.WA_InputMethodEnabled, True)
        except Exception:
            pass

        # Guardrail #2: Immediately set `page.open_links_externally = False` so `file://` URLs
        # never launch in the external browser
        page = self.webview.page()
        if page is not None:
            page.open_links_externally = False
            try:
                from aqt.qt import QColor
                cfg = self.get_config()
                bg_hex = "#16161A" if cfg.get("theme") in ("dark", "oled") else "#F4F4F6"
                if hasattr(page, "setBackgroundColor"):
                    page.setBackgroundColor(QColor(bg_hex))
            except Exception:
                pass

        try:
            self.webview.set_bridge_command(self._on_bridge_direct_cmd, self)
        except Exception:
            pass

        cfg = self.get_config()
        debug_mode = bool(cfg.get("debug_mode", False)) or os.environ.get("ANKI_MODERN_DEBUG") == "1"
        dev_url = cfg.get("dev_server_url", "http://localhost:5173")
        index_file = WEB_DIST_DIR / "index.html"

        if debug_mode and os.environ.get("ANKI_MODERN_DEV_SERVER") == "1":
            self.webview.load_url(QUrl(dev_url))
        elif index_file.exists():
            self.webview.load_url(QUrl.fromLocalFile(str(index_file)))
        else:
            self.webview.setHtml(
                "<html><body style='background:#0A0A0D;color:#fff;font-family:sans-serif;padding:40px'>"
                "<h2>Anki Studio</h2><p>Web bundle not found. Run <code>npm run build</code> in frontend/.</p>"
                "</body></html>"
            )

        resize_filter = self._create_resize_filter(mw)
        mw.installEventFilter(resize_filter)
        if target_parent is not None and target_parent is not mw:
            try:
                target_parent.installEventFilter(resize_filter)
            except Exception:
                pass
        return self.webview

    def _create_resize_filter(self, mw_obj):
        from aqt.qt import QEvent, QObject

        host = self

        class ResizeFilter(QObject):
            def eventFilter(self, obj, event):
                ev_type = event.type()
                if (
                    ev_type in (QEvent.Type.Resize, QEvent.Type.Show, QEvent.Type.LayoutRequest)
                    and host.webview
                    and host.is_modern_visible
                ):
                    target = host.webview.parent() or mw_obj
                    w, h = int(target.width()), int(target.height())
                    if w > 0 and h > 0:
                        host.webview.setGeometry(0, 0, w, h)
                return False

        self._resize_filter = ResizeFilter(mw_obj)
        return self._resize_filter

    def show_modern_ui(self) -> None:
        from aqt import mw
        if mw is None:
            return

        self._ensure_comfortable_window_size(mw)
        web = self._ensure_webview()
        try:
            self._apply_cocoa_immersive_titlebar(int(mw.winId()), True)
        except Exception:
            pass

        self._hide_native_webviews(mw)

        try:
            self.is_modern_visible = True
            self._sync_webview_geometry_and_focus(grab_focus=True)

            # Dismiss any stray native tooltip and ensure late-imported modules are patched
            try:
                import aqt.utils
                if hasattr(aqt.utils, "closeTooltip"):
                    aqt.utils.closeTooltip()
                if mw and hasattr(mw, "app") and mw.app:
                    while mw.app.overrideCursor():
                        mw.app.restoreOverrideCursor()
                if hasattr(self, "_modern_tooltip_interceptor") and hasattr(self, "_orig_tooltip"):
                    for mod_name, mod in list(sys.modules.items()):
                        if mod and getattr(mod, "tooltip", None) is self._orig_tooltip:
                            try:
                                setattr(mod, "tooltip", self._modern_tooltip_interceptor)
                            except Exception:
                                pass
            except Exception:
                pass

            self._emit_js_event("anki:collection-updated", {"source": "show_modern_ui"})
        except Exception as e:
            print(f"[Anki Studio] Error presenting Modern UI: {e}")

    def hide_modern_ui(self) -> None:
        from aqt import mw
        if mw is None:
            return

        try:
            self._apply_cocoa_immersive_titlebar(int(mw.winId()), False)
        except Exception:
            pass

        if self._orig_min_size is not None and hasattr(mw, "setMinimumSize"):
            try:
                mw.setMinimumSize(self._orig_min_size)
            except Exception:
                pass

        if self.webview is not None:
            try:
                self.webview.hide()
            except Exception:
                pass

        toolbar = getattr(mw, "toolbar", None)
        if toolbar:
            if getattr(toolbar, "web", None):
                try:
                    toolbar.web.show()
                except Exception:
                    pass
            # Redraw native toolbar so the injected `[ 🌟 进入 Anki Studio (Ctrl+Opt+M) ]` button is immediately visible
            if hasattr(toolbar, "draw"):
                try:
                    toolbar.draw()
                except Exception:
                    pass

        # Guardrail #1: Version-safe access to `bottomWeb`
        bottom_web = getattr(mw, "bottomWeb", None)
        if bottom_web is not None:
            try:
                bottom_web.show()
            except Exception:
                pass

        main_web = getattr(mw, "web", None)
        if main_web is not None:
            try:
                main_web.show()
                main_web.setFocus()
            except Exception:
                pass

        self.is_modern_visible = False
        try:
            mw.reset()
        except Exception:
            pass

    def toggle_modern_ui(self) -> None:
        if self.is_modern_visible:
            self.hide_modern_ui()
        else:
            self.show_modern_ui()

    def _on_bridge_direct_cmd(self, cmd: str) -> Any:
        if cmd == "anki_modern_os_return":
            self.show_modern_ui()
            return None
        if isinstance(cmd, str) and cmd.startswith(BridgeRouter.PREFIX):
            return self.router.handle_pycmd(cmd)
        return None

    def _on_js_message(
        self, handled: Tuple[bool, Any], message: str, context: Any
    ) -> Tuple[bool, Any]:
        if message == "anki_modern_os_return":
            self.show_modern_ui()
            return (True, None)
        if isinstance(message, str) and message.startswith(BridgeRouter.PREFIX):
            reply = self.router.handle_pycmd(message)
            return (True, reply)
        return handled


# Initialize singleton host when loaded by Anki
host = AnkiModernHost()
host.initialize()
