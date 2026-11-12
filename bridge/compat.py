# -*- coding: utf-8 -*-
"""
Anki Studio — Runtime compatibility & monkey-patch self-check.

Why this module exists
-----------------------
Anki Studio makes the native UI feel seamless by patching a handful of Anki/Qt
internals at startup (progress dialogs, tooltip popups, the Preferences action,
sync error handling). Every one of those patches is wrapped in ``try/except`` so
a changed private signature can never crash the add-on — but that also means a
silently failed patch degrades the experience with *zero* diagnostics: the user
just starts seeing native yellow tooltips and Qt progress modals again while
everything "works".

``collect_health()`` turns "we think it worked" into a checkable fact. Each
patch sets a marker flag, each hook is registered through ``gui_hooks``, and
this module reports per-patch / per-hook status plus the resolved Anki version
against ``manifest.json``'s ``min_point_version``.

Everything here is pure and dependency-injected on purpose: unit tests can pass
fake modules without importing ``aqt``.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional

# Must stay in sync with manifest.json's `min_point_version`.
# Anki's int_version() is YYMMDD-ish: 26.09.4 -> 260904, 2.1.66 -> 20166.
MIN_POINT_VERSION = 260904
MIN_HUMAN_VERSION = "26.09.4"

_VERSION_RE = re.compile(r"(\d+)\.(\d+)(?:\.(\d+))?")

# Patched native surfaces. `owner` selects one of the four injected objects;
# `flag` is what each patch sets only after it succeeded (see __init__.py).
PATCH_SPECS = (
    {
        "id": "preferences",
        "label": "偏好设置接管（Ctrl+P / Cmd+,）",
        "owner": "mw",
        "flag": "_anki_modern_prefs_patched",
        "required": True,
    },
    {
        "id": "progress",
        "label": "原生进度弹窗与漏斗光标静默",
        "owner": "progress",
        "flag": "_anki_modern_patched",
        "required": True,
    },
    {
        "id": "tooltip",
        "label": "原生 Tooltip 拦截转 Toast",
        "owner": "utils",
        "flag": "_anki_modern_patched",
        "required": True,
    },
    {
        "id": "sync-error",
        "label": "同步错误捕获与回传",
        "owner": "sync",
        "flag": "_anki_modern_sync_err_patched",
        "required": True,
    },
)

# Lifecycle hooks the add-on must be wired into. `required: False` means the hook
# is optional across supported Anki versions (guarded with hasattr at register
# time), so its absence is reported but does not degrade the health state.
HOOK_SPECS = (
    {
        "id": "js-message",
        "label": "JS → Python IPC 通道",
        "attr": "webview_did_receive_js_message",
        "method": "_on_js_message",
        "required": True,
    },
    {
        "id": "main-window",
        "label": "主窗口挂载",
        "attr": "main_window_did_init",
        "method": "_on_main_window_init",
        "required": True,
    },
    {
        "id": "profile-open",
        "label": "换档案后重新挂载",
        "attr": "profile_did_open",
        "method": "_on_profile_did_open",
        "required": False,
    },
    {
        "id": "sync-start",
        "label": "同步开始事件",
        "attr": "sync_will_start",
        "method": "_on_sync_will_start",
        "required": False,
    },
    {
        "id": "sync-finish",
        "label": "同步完成事件",
        "attr": "sync_did_finish",
        "method": "_on_sync_did_finish",
        "required": True,
    },
    {
        "id": "operation",
        "label": "后台操作后刷新",
        "attr": "operation_did_execute",
        "method": "_on_operation_did_execute",
        "required": True,
    },
    {
        "id": "state-reset",
        "label": "mw.reset 后重新置顶",
        "attr": "state_did_reset",
        "method": "_on_state_did_reset",
        "required": True,
    },
    {
        "id": "toolbar-link",
        "label": "原生工具栏返回胶囊",
        "attr": "top_toolbar_did_init_links",
        "method": "_on_top_toolbar_init_links",
        "required": False,
    },
)


def parse_point_version(raw: Any) -> Optional[int]:
    """Convert an Anki version string into Anki's integer point version.

    ``"26.09.4"`` -> ``260904``, ``"2.1.66"`` -> ``20166``. Returns ``None`` for
    anything that does not contain a ``major.minor[.patch]`` triple.
    """
    if raw is None:
        return None
    match = _VERSION_RE.search(str(raw).strip())
    if not match:
        return None
    major = int(match.group(1))
    minor = int(match.group(2))
    patch = int(match.group(3) or 0)
    return major * 10000 + minor * 100 + patch


def is_version_supported(raw: Any, minimum: int = MIN_POINT_VERSION) -> Optional[bool]:
    """``True`` / ``False`` when the version is parseable, ``None`` when it is not."""
    point = parse_point_version(raw)
    if point is None:
        return None
    return point >= minimum


def resolve_anki_version(mw: Any = None) -> str:
    """Best-effort runtime Anki version, without ever raising."""
    candidates: List[str] = []
    try:
        from anki import buildinfo  # type: ignore

        candidates.append(str(getattr(buildinfo, "version", "") or ""))
    except Exception:
        pass

    if mw is not None:
        try:
            candidates.append(str(mw.app.applicationVersion() or ""))
        except Exception:
            pass

    for candidate in candidates:
        if candidate.strip():
            return candidate.strip()
    return ""


def _patch_status(owner: Any, flag: str) -> Dict[str, Any]:
    if owner is None:
        return {"ok": False, "detail": "模块不可用，补丁未执行"}
    try:
        applied = bool(getattr(owner, flag, False))
    except Exception as exc:  # pragma: no cover - defensive
        return {"ok": False, "detail": "读取补丁标记失败：%s" % (exc,)}
    if applied:
        return {"ok": True, "detail": "已生效"}
    return {"ok": False, "detail": "未生效（Anki/Qt 内部签名可能已变化）"}


def _hook_status(gui_hooks: Any, attr: str, callback: Any) -> Dict[str, Any]:
    if gui_hooks is None:
        return {"ok": False, "detail": "gui_hooks 不可用"}
    if callback is None:
        return {"ok": False, "detail": "宿主回调缺失"}
    try:
        registered = getattr(gui_hooks, attr, None)
    except Exception as exc:  # pragma: no cover - defensive
        return {"ok": False, "detail": "读取钩子失败：%s" % (exc,)}
    if registered is None:
        return {"ok": False, "detail": "Anki 未提供 %s" % attr}
    try:
        present = callback in list(registered)
    except Exception:  # pragma: no cover - defensive
        return {"ok": False, "detail": "检查钩子注册失败"}
    if present:
        return {"ok": True, "detail": "已注册"}
    return {"ok": False, "detail": "未注册"}


def collect_health(
    *,
    mw: Any = None,
    progress_manager: Any = None,
    utils_module: Any = None,
    sync_module: Any = None,
    gui_hooks: Any = None,
    host: Any = None,
    version_raw: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the runtime compatibility report consumed by ``get_patch_health``.

    Pass ``version_raw=""`` to explicitly model "version unknown"; leave it
    ``None`` to resolve the version from the Anki runtime.
    """
    owners = {
        "mw": mw,
        "progress": progress_manager,
        "utils": utils_module,
        "sync": sync_module,
    }

    warnings: List[str] = []

    patches: List[Dict[str, Any]] = []
    for spec in PATCH_SPECS:
        status = _patch_status(owners.get(spec["owner"]), spec["flag"])
        patches.append(
            {
                "id": spec["id"],
                "label": spec["label"],
                "required": spec["required"],
                "ok": status["ok"],
                "detail": status["detail"],
            }
        )
        if spec["required"] and not status["ok"]:
            warnings.append("补丁「%s」未生效：%s" % (spec["label"], status["detail"]))

    hooks: List[Dict[str, Any]] = []
    if host is not None and gui_hooks is not None:
        for spec in HOOK_SPECS:
            callback = getattr(host, spec["method"], None)
            status = _hook_status(gui_hooks, spec["attr"], callback)
            hooks.append(
                {
                    "id": spec["id"],
                    "label": spec["label"],
                    "required": spec["required"],
                    "ok": status["ok"],
                    "detail": status["detail"],
                }
            )
            if spec["required"] and not status["ok"]:
                warnings.append("钩子「%s」未注册：%s" % (spec["label"], status["detail"]))

    raw = resolve_anki_version(mw) if version_raw is None else str(version_raw).strip()
    point = parse_point_version(raw) if raw else None
    supported = point is not None and point >= MIN_POINT_VERSION
    if point is None:
        warnings.append("无法识别 Anki 版本（预期 %s+）" % MIN_HUMAN_VERSION)
    elif not supported:
        warnings.append(
            "Anki 版本 %s（point %d）低于最低要求 %s（%d）"
            % (raw, point, MIN_HUMAN_VERSION, MIN_POINT_VERSION)
        )

    mounted = bool(getattr(host, "webview", None)) if host is not None else False
    visible = bool(getattr(host, "is_modern_visible", False)) if host is not None else False

    ok_patches = sum(1 for item in patches if item["ok"])
    ok_hooks = sum(1 for item in hooks if item["ok"])

    return {
        "state": "degraded" if warnings else "ok",
        "generatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        "ankiVersion": {
            "raw": raw,
            "point": point,
            "minimum": MIN_POINT_VERSION,
            "minimumHuman": MIN_HUMAN_VERSION,
            "known": point is not None,
            "supported": supported,
        },
        "patches": patches,
        "hooks": hooks,
        "summary": {"patches": [ok_patches, len(patches)], "hooks": [ok_hooks, len(hooks)]},
        "webview": {"mounted": mounted, "visible": visible},
        "warnings": warnings,
    }


def format_health_summary(report: Dict[str, Any]) -> str:
    """One-block log line (plus warnings) for the Anki console."""
    version = report.get("ankiVersion") or {}
    summary = report.get("summary") or {}
    patch_pair = summary.get("patches") or [0, 0]
    hook_pair = summary.get("hooks") or [0, 0]
    raw = version.get("raw") or "unknown"
    point = version.get("point")
    point_text = str(point) if point is not None else "?"

    lines = [
        "[Anki Studio] patch health: %s/%s patches, %s/%s hooks, "
        "Anki %s (point %s, min %s)"
        % (
            patch_pair[0],
            patch_pair[1],
            hook_pair[0],
            hook_pair[1],
            raw,
            point_text,
            MIN_POINT_VERSION,
        )
    ]
    for warning in report.get("warnings") or []:
        lines.append("  ! %s" % warning)
    return "\n".join(lines)
