# -*- coding: utf-8 -*-
"""
Anki Studio — Native Add-on Entry Point (Anki 26.x / Qt6)
Non-intrusively mounts the full-screen Modern Web UI over Anki's `mw.centralWidget()`,
connects the <2ms pycmd IPC bridge, listens to Anki native lifecycle hooks
(sync_did_finish, operation_did_execute, state_did_reset) for two-way live sync,
and provides a 3-Layer Anti-Lost Safety Net to switch seamlessly between Anki Studio and native Anki:
  1. Global Hotkey: `Ctrl+Opt+M` (macOS) / `Ctrl+Alt+M` (Windows/Linux)
  2. Tools Menu Action: `切换 Anki Studio / 原生界面 (Ctrl+Opt+M)`
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


class AnkiModernHost:
    """Manages the full-screen modern Anki WebEngine overlay, preferences persistence, and 3-layer native switch."""

    def __init__(self):
        self.webview: Optional[Any] = None
        self.is_modern_visible: bool = False
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
        except Exception:
            pass
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
            from aqt.qt import QAction, QKeySequence, QShortcut
        except ImportError:
            # Outside Anki runtime (e.g., automated unit tests)
            return

        if mw is None:
            return

        # 1. Register pycmd IPC bridge listener (handles both modern_anki: and native toolbar return link)
        gui_hooks.webview_did_receive_js_message.append(self._on_js_message)

        # 2. Register profile loaded hook to mount Modern UI
        gui_hooks.main_window_did_init.append(self._on_main_window_init)

        # 3. Register two-way lifecycle & ecosystem hooks
        if hasattr(gui_hooks, "sync_did_finish"):
            gui_hooks.sync_did_finish.append(self._on_sync_did_finish)
        if hasattr(gui_hooks, "operation_did_execute"):
            gui_hooks.operation_did_execute.append(self._on_operation_did_execute)
        if hasattr(gui_hooks, "state_did_reset"):
            gui_hooks.state_did_reset.append(self._on_state_did_reset)

        # 4. Layer 3 Safety Net: Inject prominent "[ 🌟 进入 Modern OS (Ctrl+Opt+M) ]" button into Anki native top toolbar
        if hasattr(gui_hooks, "top_toolbar_did_init_links"):
            gui_hooks.top_toolbar_did_init_links.append(self._on_top_toolbar_init_links)

        # 5. Layer 1 & Layer 2 Safety Net: Tools menu action & Fail-safe hotkeys (Ctrl+Opt+M / Ctrl+Alt+M)
        shortcut_hint = "Ctrl+Opt+M" if sys.platform.startswith("darwin") else "Ctrl+Alt+M"
        action = QAction(f"切换 Anki Studio / 原生界面 ({shortcut_hint})", mw)
        action.setShortcut(QKeySequence("Ctrl+Alt+M"))
        action.triggered.connect(self.toggle_modern_ui)
        mw.form.menuTools.addAction(action)

        self._shortcut_ctrl_opt = QShortcut(QKeySequence("Meta+Alt+M"), mw)
        self._shortcut_ctrl_opt.activated.connect(self.toggle_modern_ui)

        # 6. Suppress duplicate native Qt sync progress modal dialogs & tooltips while Modern UI is active
        self._patch_anki_dialogs()

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
                        # Modern UI handles loading states with smooth vector SVG spinners.
                        # Silently prevent setting Qt.CursorShape.WaitCursor (retro 4-quadrant checkered circle cursor).
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
            import sys
            import re

            if not getattr(aqt.utils, "_anki_modern_patched", False):
                orig_tooltip = aqt.utils.tooltip

                def modern_tooltip_interceptor(msg, *args, **kwargs):
                    if host.is_modern_visible:
                        try:
                            # 1. Immediately dismiss any stray native Qt yellow tooltip label
                            if hasattr(aqt.utils, "closeTooltip"):
                                aqt.utils.closeTooltip()
                            # 2. Extract clean text without HTML tags
                            clean_text = re.sub(r"<[^>]*>", "", str(msg or "")).strip()
                            # Modern UI provides rich, integrated header capsule and waterfall reveals for sync,
                            # so silence redundant sync notification toasts to prevent visual clutter
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

                # Patch all existing modules that imported `tooltip` directly
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

    def _on_top_toolbar_init_links(self, links: List[str], toolbar: Any) -> None:
        """
        Layer 3 Anti-Lost Safety Net:
        Injects a prominent purple/gold pill button into Anki's native top toolbar (`mw.toolbar`)
        so users who switched to native Anki can always return to Modern OS in a single click.
        """
        try:
            shortcut_hint = "Ctrl+Opt+M" if sys.platform.startswith("darwin") else "Ctrl+Alt+M"
            label_html = (
                "<span style='"
                "background:linear-gradient(135deg,#5E5CE6,#7D7AFF);"
                "color:#FFFFFF;"
                "padding:4px 12px;"
                "border-radius:999px;"
                "font-weight:600;"
                "font-size:12px;"
                "box-shadow:0 2px 8px rgba(94,92,230,0.35);"
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
        self._emit_js_event("anki:sync-started", {"syncing": True})

    def _on_sync_did_finish(self) -> None:
        """Triggered when AnkiWeb cloud sync genuinely finishes."""
        try:
            from aqt import mw
            if mw and hasattr(mw, "app") and mw.app:
                while mw.app.overrideCursor():
                    mw.app.restoreOverrideCursor()
        except Exception:
            pass
        self._emit_js_event("anki:sync-finished", {"synced": True})
        self._emit_js_event("anki:collection-updated", {"source": "sync"})

    def _on_operation_did_execute(self, changes: Any, handler: Any) -> None:
        """Triggered when background operations mutate collection."""
        if handler is self.webview:
            return
        self._emit_js_event("anki:collection-updated", {"source": "operation"})

    def _on_state_did_reset(self, *args: Any) -> None:
        if self.is_modern_visible:
            self._emit_js_event("anki:collection-updated", {"source": "reset"})

    def _on_main_window_init(self) -> None:
        cfg = self.get_config()
        if cfg.get("auto_launch_modern_ui", True):
            self.show_modern_ui()

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
        except Exception as e:
            return False

    def _ensure_webview(self) -> Any:
        from aqt import mw
        from aqt.qt import QUrl
        from aqt.webview import AnkiWebView

        if self.webview is not None:
            return self.webview

        # Mount directly to mw on macOS for full-height titlebar immersion, or centralWidget on other platforms
        target_parent = mw if (mw and sys.platform.startswith("darwin")) else (
            mw.centralWidget()
            if mw and hasattr(mw, "centralWidget") and mw.centralWidget()
            else mw
        )
        self.webview = AnkiWebView(parent=target_parent)
        self.webview.setObjectName("ankiModernOSWebView")

        # Guardrail #2: Immediately set `page.open_links_externally = False` so `file://` URLs
        # never launch in the macOS external browser
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
                "<h2>Anki Modern OS</h2><p>Web bundle not found. Run <code>npm run build</code> in frontend/.</p>"
                "</body></html>"
            )

        mw.installEventFilter(self._create_resize_filter(mw))
        return self.webview

    def _create_resize_filter(self, mw_obj):
        from aqt.qt import QEvent, QObject

        host = self

        class ResizeFilter(QObject):
            def eventFilter(self, obj, event):
                if event.type() == QEvent.Type.Resize and host.webview and host.is_modern_visible:
                    target = host.webview.parent() or mw_obj
                    host.webview.setGeometry(0, 0, target.width(), target.height())
                return False

        self._resize_filter = ResizeFilter(mw_obj)
        return self._resize_filter

    def show_modern_ui(self) -> None:
        from aqt import mw
        if mw is None:
            return

        web = self._ensure_webview()
        try:
            self._apply_cocoa_immersive_titlebar(int(mw.winId()), True)
        except Exception:
            pass

        toolbar = getattr(mw, "toolbar", None)
        if toolbar and getattr(toolbar, "web", None):
            try:
                toolbar.web.hide()
            except Exception:
                pass

        # Guardrail #1: Version-safe access to `bottomWeb` via getattr
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

        try:
            target = web.parent() or mw
            web.setGeometry(0, 0, target.width(), target.height())
            web.show()
            web.raise_()
            web.setFocus()
            self.is_modern_visible = True

            # Dismiss any stray native tooltip and ensure late-imported modules are patched
            try:
                import aqt.utils
                if hasattr(aqt.utils, "closeTooltip"):
                    aqt.utils.closeTooltip()
                from aqt import mw
                if mw and hasattr(mw, "app") and mw.app:
                    while mw.app.overrideCursor():
                        mw.app.restoreOverrideCursor()
                if hasattr(self, "_modern_tooltip_interceptor") and hasattr(self, "_orig_tooltip"):
                    import sys
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
            print(f"[Anki Modern OS] Error presenting Modern UI: {e}")

    def hide_modern_ui(self) -> None:
        from aqt import mw
        if mw is None:
            return

        try:
            self._apply_cocoa_immersive_titlebar(int(mw.winId()), False)
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
            # Redraw native toolbar so the injected `[ 🌟 进入 Modern OS (Ctrl+Opt+M) ]` button is immediately visible
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
