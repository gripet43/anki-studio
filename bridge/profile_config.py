"""Per-profile add-on config isolation & safe legacy migration.

Anki stores add-on settings via ``mw.addonManager.getConfig / writeConfig`` in a
single add-on-global ``meta.json`` shared across all user profiles. Keeping
profile-bound state (Vacation Mode, frozen dates, rescue receipts/history,
safety tickets, collapsed deck IDs, sandbox note-type IDs, custom nickname, and
per-profile sync watermarks) at the top level causes one profile's vacation or
collection metadata to bleed into every other profile on profile switch.

This module partitions runtime config cleanly into:
- Global preferences stored at top level (`theme`, `language`, `accent_color`, ...)
- Per-profile state stored under ``profile_states[profile_key]`` keyed by the
  active Anki profile name (`mw.pm.name`).
- One-time safe evacuation of legacy flat keys from pre-isolation ``meta.json``.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import os
import re
import secrets
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple, Union

PROFILE_STATES_KEY = "profile_states"
LEGACY_UNSCOPED_KEY = "_legacy_unscoped_profile_state"

PROFILE_SCOPED_KEYS: frozenset[str] = frozenset({
    "vacation_state",
    "vacation_history",
    "vacation_frozen_dates",
    "last_rescue_receipt",
    "rescue_history",
    "safety_ticket",
    "collapsed_deck_ids",
    "sandbox_notetype_ids",
    "custom_nickname",
    "custom_avatar",
    "last_sync_checked_map",
})

ADDON_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_AVATARS_DIR = ADDON_ROOT / "user_files" / "avatars"

AVATAR_PRESET_IDS: frozenset[str] = frozenset({
    "book",
    "owl",
    "leaf",
    "spark",
    "cat",
    "mountain",
    "compass",
    "flame",
})

ALLOWED_AVATAR_MIME_TO_EXT: Dict[str, str] = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}

MAX_AVATAR_BYTES = 512 * 1024
MAX_AVATAR_PICK_BYTES = 16 * 1024 * 1024
AVATAR_PICK_MAX_DIMENSION = 1024

_AVATAR_DATA_URL_RE = re.compile(
    r"^data:([a-zA-Z0-9.+_-]+/[a-zA-Z0-9.+_-]+);base64,([A-Za-z0-9+/=\s]+)$",
    re.IGNORECASE,
)

_NON_PROFILE_WRAPPER_KEYS: frozenset[str] = (
    PROFILE_SCOPED_KEYS | {PROFILE_STATES_KEY, LEGACY_UNSCOPED_KEY}
)

# `last_sync_checked_map` was already keyed by profile name, so it can always be
# split deterministically per profile without ambiguity.
_LEGACY_CLAIMABLE_KEYS: tuple[str, ...] = tuple(
    k for k in sorted(PROFILE_SCOPED_KEYS) if k != "last_sync_checked_map"
)


def resolve_profile_key(mw: Any = None) -> Optional[str]:
    """Returns the active Anki profile name, or None if no profile is loaded."""
    if mw is None:
        return None
    try:
        pm = getattr(mw, "pm", None)
        name = getattr(pm, "name", None) if pm is not None else None
        if isinstance(name, str) and name.strip():
            return name.strip()
    except Exception:
        pass
    return None


def _count_profiles(mw: Any) -> Optional[int]:
    """Returns total number of configured Anki profiles, or None if unknown."""
    if mw is None:
        return None
    try:
        pm = getattr(mw, "pm", None)
        profiles_fn = getattr(pm, "profiles", None) if pm is not None else None
        if callable(profiles_fn):
            names = [p for p in profiles_fn() if isinstance(p, str) and p.strip()]
            return len(names)
    except Exception:
        pass
    return None


def _is_nonempty_legacy_value(key: str, val: Any) -> bool:
    if key == "custom_avatar":
        if not isinstance(val, dict):
            return False
        kind = str(val.get("kind") or "").strip().lower()
        if kind == "preset":
            return str(val.get("presetId") or "").strip() in AVATAR_PRESET_IDS
        if kind == "image":
            return bool(str(val.get("file") or "").strip())
        return False
    if isinstance(val, dict):
        return len(val) > 0
    if isinstance(val, list):
        return len(val) > 0
    if isinstance(val, str):
        return bool(val.strip())
    return val is not None and bool(val)


def _collect_positive_ints(items: Iterable[Any], out: Set[int]) -> None:
    for item in items:
        try:
            iv = int(item)
            if iv > 0:
                out.add(iv)
        except (TypeError, ValueError):
            continue


def _extract_verifiable_ids(bundle: Dict[str, Any]) -> Tuple[Set[int], Set[int], Set[int], Dict[int, Dict[str, Any]]]:
    """Collects card IDs, non-default deck IDs, model IDs, and frozen deck limits."""
    card_ids: Set[int] = set()
    deck_ids: Set[int] = set()
    model_ids: Set[int] = set()
    frozen_limits: Dict[int, Dict[str, Any]] = {}

    vac = bundle.get("vacation_state")
    if isinstance(vac, dict):
        _collect_positive_ints(vac.get("shifted_cids") or [], card_ids)
        snap = vac.get("shifted_card_snapshot")
        if isinstance(snap, dict):
            _collect_positive_ints(snap.keys(), card_ids)
        limits = vac.get("frozen_deck_limits")
        if isinstance(limits, dict):
            for k, v in limits.items():
                try:
                    did = int(k)
                except (TypeError, ValueError):
                    continue
                if did != 1 and did > 0:
                    deck_ids.add(did)
                if isinstance(v, dict):
                    frozen_limits[did] = v

    for receipt_key in ("last_rescue_receipt",):
        rec = bundle.get(receipt_key)
        if isinstance(rec, dict):
            _collect_receipt_cids(rec, card_ids)

    rescue_hist = bundle.get("rescue_history")
    if isinstance(rescue_hist, list):
        for rec in rescue_hist:
            if isinstance(rec, dict):
                _collect_receipt_cids(rec, card_ids)

    _collect_positive_ints(
        [d for d in (bundle.get("collapsed_deck_ids") or []) if str(d).strip() != "1"],
        deck_ids,
    )
    _collect_positive_ints(bundle.get("sandbox_notetype_ids") or [], model_ids)
    return card_ids, deck_ids, model_ids, frozen_limits


def _collect_receipt_cids(rec: Dict[str, Any], card_ids: Set[int]) -> None:
    _collect_positive_ints(rec.get("rescheduledCids") or [], card_ids)
    for list_key in ("items", "cardSamples"):
        for item in rec.get(list_key) or []:
            if isinstance(item, dict) and item.get("cid") is not None:
                _collect_positive_ints([item.get("cid")], card_ids)
    sched = rec.get("scheduleSnapshot")
    if isinstance(sched, dict):
        _collect_positive_ints(sched.keys(), card_ids)


def _col_has_any_card(col: Any, card_ids: Set[int]) -> bool:
    if not card_ids:
        return False
    id_list = sorted(card_ids)
    db = getattr(col, "db", None)
    if db is not None:
        for idx in range(0, len(id_list), 200):
            batch = id_list[idx:idx + 200]
            placeholders = ",".join("?" for _ in batch)
            query = f"SELECT 1 FROM cards WHERE id IN ({placeholders}) LIMIT 1"
            try:
                if hasattr(db, "scalar"):
                    if db.scalar(query, *batch):
                        return True
                elif hasattr(db, "first"):
                    if db.first(query, *batch):
                        return True
                elif hasattr(db, "all"):
                    if db.all(query, *batch):
                        return True
            except Exception:
                break
    get_card = getattr(col, "get_card", None)
    if callable(get_card):
        for cid in id_list[:50]:
            try:
                if get_card(cid) is not None:
                    return True
            except Exception:
                continue
    return False


def _col_has_any_deck(col: Any, deck_ids: Set[int]) -> bool:
    decks = getattr(col, "decks", None)
    if decks is None or not deck_ids:
        return False
    try:
        if hasattr(decks, "all_names_and_ids"):
            existing = {int(getattr(d, "id", 0) or 0) for d in decks.all_names_and_ids()}
            if existing & deck_ids:
                return True
            return False
    except Exception:
        pass
    for did in deck_ids:
        try:
            if hasattr(decks, "get") and decks.get(did, default=False):
                return True
        except Exception:
            continue
    return False


def _col_has_any_model(col: Any, model_ids: Set[int]) -> bool:
    models = getattr(col, "models", None)
    if models is None or not model_ids:
        return False
    try:
        if hasattr(models, "all_names_and_ids"):
            existing = {int(getattr(m, "id", 0) or 0) for m in models.all_names_and_ids()}
            if existing & model_ids:
                return True
            return False
    except Exception:
        pass
    for mid in model_ids:
        try:
            if hasattr(models, "get") and models.get(mid):
                return True
        except Exception:
            continue
    return False


def _col_matches_frozen_default_deck(col: Any, frozen_limits: Dict[int, Dict[str, Any]]) -> bool:
    """Checks whether an active legacy vacation froze daily limits on deck 1."""
    if not frozen_limits or 1 not in frozen_limits:
        return False
    orig = frozen_limits.get(1) or {}
    orig_new = int(orig.get("orig_new", 0) or 0)
    orig_rev = int(orig.get("orig_rev", 0) or 0)
    if orig_new <= 0 and orig_rev <= 0:
        return False
    decks = getattr(col, "decks", None)
    if decks is None:
        return False
    try:
        d_obj = decks.get(1) if hasattr(decks, "get") else None
        conf_id = d_obj.get("conf") if isinstance(d_obj, dict) else getattr(d_obj, "conf", None)
        conf = None
        if conf_id is not None and hasattr(decks, "get_config"):
            conf = decks.get_config(conf_id)
        elif hasattr(decks, "config_dict_for_deck_id"):
            conf = decks.config_dict_for_deck_id(1)
        if not isinstance(conf, dict):
            return False
        curr_new = int((conf.get("new") or {}).get("perDay", -1))
        curr_rev = int((conf.get("rev") or {}).get("perDay", -1))
        return (orig_new > 0 and curr_new == 0) and (orig_rev <= 0 or curr_rev == 0)
    except Exception:
        return False


def _collection_owns_legacy(col: Any, bundle: Dict[str, Any]) -> bool:
    """Determines whether the currently open collection matches quarantined legacy IDs."""
    if col is None or not bundle:
        return False
    card_ids, deck_ids, model_ids, frozen_limits = _extract_verifiable_ids(bundle)
    if card_ids:
        return _col_has_any_card(col, card_ids)
    if deck_ids:
        return _col_has_any_deck(col, deck_ids)
    if model_ids:
        return _col_has_any_model(col, model_ids)
    vac = bundle.get("vacation_state")
    if isinstance(vac, dict) and vac.get("active") and _col_matches_frozen_default_deck(col, frozen_limits):
        return True
    return False


def _sanitize_custom_avatar_metadata(val: Any) -> Dict[str, Any]:
    """Ensures persisted `custom_avatar` metadata stays lightweight and never carries Base64."""
    if not isinstance(val, dict):
        return {"kind": "initial"}
    kind = str(val.get("kind") or "").strip().lower()
    if kind == "preset":
        preset_id = str(val.get("presetId") or "").strip()
        if preset_id in AVATAR_PRESET_IDS:
            return {"kind": "preset", "presetId": preset_id}
        return {"kind": "initial"}
    if kind == "image":
        rel_file = val.get("file")
        mime = str(val.get("mime") or "").strip().lower()
        if (
            isinstance(rel_file, str)
            and rel_file
            and "/" not in rel_file
            and "\\" not in rel_file
            and "\x00" not in rel_file
            and not rel_file.startswith(".")
            and mime in ALLOWED_AVATAR_MIME_TO_EXT
        ):
            return {"kind": "image", "file": rel_file, "mime": mime}
        return {"kind": "initial"}
    return {"kind": "initial"}


def _sanitize_profile_bucket(raw_bucket: Any) -> Dict[str, Any]:
    if not isinstance(raw_bucket, dict):
        return {}
    sanitized: Dict[str, Any] = {}
    for k, v in raw_bucket.items():
        if k not in PROFILE_SCOPED_KEYS:
            continue
        if k == "custom_avatar":
            sanitized[k] = _sanitize_custom_avatar_metadata(v)
        else:
            sanitized[k] = v
    return sanitized


def migrate_legacy_raw_config(
    raw_cfg: Dict[str, Any],
    *,
    mw: Any = None,
) -> Tuple[Dict[str, Any], bool]:
    """Migrates legacy top-level profile keys out of top-level raw config.

    Returns ``(next_raw, changed)``. Even when legacy state cannot yet be matched
    to the currently open profile (e.g., user switched to another profile first),
    top-level profile keys are moved into ``_legacy_unscoped_profile_state`` so
    they immediately stop leaking across profiles, and will be claimed once the
    matching profile opens.
    """
    next_raw: Dict[str, Any] = dict(raw_cfg or {})
    raw_states = next_raw.get(PROFILE_STATES_KEY)
    profile_states: Dict[str, Dict[str, Any]] = {}
    if isinstance(raw_states, dict):
        for pname, bucket in raw_states.items():
            if isinstance(pname, str) and pname.strip():
                profile_states[pname.strip()] = _sanitize_profile_bucket(bucket)

    changed = False

    # 1. `last_sync_checked_map` already stores `{profile_name: ts_ms}` per entry.
    if "last_sync_checked_map" in next_raw:
        legacy_sync_map = next_raw.pop("last_sync_checked_map")
        changed = True
        if isinstance(legacy_sync_map, dict):
            for pname, ts in legacy_sync_map.items():
                if not isinstance(pname, str) or not pname.strip():
                    continue
                p_clean = pname.strip()
                try:
                    ts_int = int(ts or 0)
                except (TypeError, ValueError):
                    ts_int = 0
                if ts_int <= 0:
                    continue
                bucket = dict(profile_states.get(p_clean) or {})
                cur_map = dict(bucket.get("last_sync_checked_map") or {})
                cur_map[p_clean] = max(int(cur_map.get(p_clean, 0) or 0), ts_int)
                bucket["last_sync_checked_map"] = cur_map
                profile_states[p_clean] = bucket

    # 2. Extract any other top-level profile-scoped keys into quarantine bundle.
    legacy_bundle: Dict[str, Any] = {}
    existing_quarantine = next_raw.get(LEGACY_UNSCOPED_KEY)
    if isinstance(existing_quarantine, dict):
        legacy_bundle.update(
            {k: v for k, v in existing_quarantine.items() if k in _LEGACY_CLAIMABLE_KEYS and _is_nonempty_legacy_value(k, v)}
        )

    for key in _LEGACY_CLAIMABLE_KEYS:
        if key not in next_raw:
            continue
        val = next_raw[key]
        if _is_nonempty_legacy_value(key, val):
            legacy_bundle[key] = val
            next_raw.pop(key, None)
            changed = True
        elif key != "collapsed_deck_ids":
            # Strip leftover null/empty non-default top-level keys cleanly.
            next_raw.pop(key, None)
            changed = True

    # 3. Try claiming quarantined legacy state for the active profile if safe.
    profile_key = resolve_profile_key(mw)
    if legacy_bundle and profile_key:
        profile_count = _count_profiles(mw)
        col = getattr(mw, "col", None) if mw is not None else None
        can_claim = (
            (profile_count is not None and profile_count <= 1)
            or _collection_owns_legacy(col, legacy_bundle)
        )
        if can_claim:
            bucket = dict(profile_states.get(profile_key) or {})
            for k, v in legacy_bundle.items():
                if k not in bucket or not _is_nonempty_legacy_value(k, bucket[k]):
                    bucket[k] = v
            profile_states[profile_key] = bucket
            next_raw.pop(LEGACY_UNSCOPED_KEY, None)
            legacy_bundle = {}
            changed = True

    if legacy_bundle:
        if next_raw.get(LEGACY_UNSCOPED_KEY) != legacy_bundle:
            next_raw[LEGACY_UNSCOPED_KEY] = legacy_bundle
            changed = True
    elif LEGACY_UNSCOPED_KEY in next_raw:
        next_raw.pop(LEGACY_UNSCOPED_KEY, None)
        changed = True

    if profile_states:
        next_raw[PROFILE_STATES_KEY] = profile_states

    return next_raw, changed


def build_effective_config(raw_cfg: Dict[str, Any], profile_key: Optional[str]) -> Dict[str, Any]:
    """Builds the merged flat config dict visible to bridge services for one profile."""
    effective: Dict[str, Any] = {
        k: v for k, v in (raw_cfg or {}).items() if k not in _NON_PROFILE_WRAPPER_KEYS
    }
    effective["collapsed_deck_ids"] = []

    if profile_key:
        raw_states = (raw_cfg or {}).get(PROFILE_STATES_KEY)
        if isinstance(raw_states, dict):
            bucket = _sanitize_profile_bucket(raw_states.get(profile_key))
            effective.update(bucket)

    return effective


def read_profile_scoped_config(
    raw_cfg: Dict[str, Any],
    *,
    mw: Any = None,
    raw_writer: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """Reads effective config for the active profile, migrating legacy flat state once."""
    migrated, changed = migrate_legacy_raw_config(raw_cfg or {}, mw=mw)
    if changed and raw_writer is not None:
        try:
            raw_writer(migrated)
        except Exception:
            pass
    return build_effective_config(migrated, resolve_profile_key(mw))


def write_profile_scoped_config(
    raw_cfg: Dict[str, Any],
    new_cfg: Dict[str, Any],
    *,
    mw: Any = None,
    raw_writer: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """Splits ``new_cfg`` updates into global vs active profile bucket and persists."""
    migrated, _ = migrate_legacy_raw_config(raw_cfg or {}, mw=mw)
    profile_key = resolve_profile_key(mw)

    next_raw: Dict[str, Any] = dict(migrated)
    # Remove any top-level default placeholder like `collapsed_deck_ids: []` before saving
    # so only clean global keys remain at top level.
    for key in PROFILE_SCOPED_KEYS:
        next_raw.pop(key, None)

    updates = new_cfg or {}
    profile_updates: Dict[str, Any] = {}
    for k, v in updates.items():
        if k in (PROFILE_STATES_KEY, LEGACY_UNSCOPED_KEY):
            continue
        if k in PROFILE_SCOPED_KEYS:
            profile_updates[k] = v
        else:
            next_raw[k] = v

    if profile_key and profile_updates:
        states = dict(next_raw.get(PROFILE_STATES_KEY) or {})
        bucket = _sanitize_profile_bucket(states.get(profile_key))
        bucket.update(profile_updates)
        states[profile_key] = _sanitize_profile_bucket(bucket)
        next_raw[PROFILE_STATES_KEY] = states

    if raw_writer is not None:
        raw_writer(next_raw)

    return build_effective_config(next_raw, profile_key)


# ---------------------------------------------------------------------------
# Local Avatar Storage, Magic-Header Validation & Safe Path Resolution
# ---------------------------------------------------------------------------


def resolve_avatars_dir(avatars_dir: Optional[Union[str, Path]] = None) -> Path:
    """Resolves the local directory storing profile avatars outside `collection.media`."""
    return Path(avatars_dir) if avatars_dir is not None else DEFAULT_AVATARS_DIR


def avatar_profile_prefix(profile_key: Optional[str]) -> str:
    """Returns a collision-free, filesystem-safe filename prefix per Anki profile."""
    cleaned = (profile_key or "").strip() or "_default"
    digest = hashlib.sha256(cleaned.encode("utf-8")).hexdigest()[:16]
    return f"avatar_{digest}"


def looks_like_svg_bytes(raw: bytes) -> bool:
    """Detects raw SVG/XML+SVG payloads so vector images never reach Qt decoders."""
    if not isinstance(raw, (bytes, bytearray)) or not raw:
        return False
    head = bytes(raw).lstrip(b"\xef\xbb\xbf\r\n\t ")[:512].lower()
    return head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in head)


def detect_image_mime_from_bytes(raw: bytes, *, allow_bmp: bool = False) -> Optional[str]:
    """Identifies raster image format strictly from magic bytes (never trusts extensions or SVG)."""
    if not isinstance(raw, (bytes, bytearray)) or not raw:
        return None
    buf = bytes(raw)
    if buf.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if buf.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if buf.startswith(b"GIF87a") or buf.startswith(b"GIF89a"):
        return "image/gif"
    if len(buf) >= 12 and buf[:4] == b"RIFF" and buf[8:12] == b"WEBP":
        return "image/webp"
    if allow_bmp and len(buf) >= 6 and buf.startswith(b"BM"):
        return "image/bmp"
    return None


def parse_and_validate_avatar_data_url(
    data_url: Any,
    *,
    max_bytes: int = MAX_AVATAR_BYTES,
) -> Tuple[str, bytes]:
    """Validates a base64 raster data URL (MIME whitelist, magic bytes, decoded size)."""
    if not isinstance(data_url, str):
        raise ValueError("Avatar dataUrl must be a string")
    cleaned = data_url.strip()
    match = _AVATAR_DATA_URL_RE.match(cleaned)
    if not match:
        raise ValueError("Invalid avatar dataUrl format")

    declared_mime = match.group(1).strip().lower()
    if declared_mime not in ALLOWED_AVATAR_MIME_TO_EXT:
        raise ValueError(f"Unsupported avatar image MIME type: {declared_mime}")

    b64_payload = re.sub(r"\s+", "", match.group(2))
    if not b64_payload:
        raise ValueError("Empty avatar image payload")

    max_b64_len = ((max_bytes + 2) // 3) * 4 + 16
    if len(b64_payload) > max_b64_len:
        raise ValueError(f"Avatar image exceeds {max_bytes // 1024} KB limit")

    try:
        raw_bytes = base64.b64decode(b64_payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Malformed base64 avatar image data") from exc

    if not raw_bytes:
        raise ValueError("Empty avatar image payload")
    if len(raw_bytes) > max_bytes:
        raise ValueError(f"Avatar image exceeds {max_bytes // 1024} KB limit")

    detected_mime = detect_image_mime_from_bytes(raw_bytes, allow_bmp=False)
    if detected_mime is None or detected_mime != declared_mime:
        raise ValueError("Avatar image magic header does not match allowed raster format")

    return declared_mime, raw_bytes


def resolve_safe_avatar_path(
    avatars_dir: Union[str, Path],
    filename: Any,
) -> Optional[Path]:
    """Resolves `filename` strictly inside `avatars_dir`, blocking traversal and symlinks."""
    if not isinstance(filename, str) or not filename:
        return None
    if "\x00" in filename or "/" in filename or "\\" in filename:
        return None
    if filename in (".", "..") or filename.startswith("."):
        return None
    if os.path.basename(filename) != filename:
        return None

    try:
        base = Path(avatars_dir).resolve()
        candidate_raw = base / filename
        if candidate_raw.is_symlink():
            return None
        candidate = candidate_raw.resolve()
        rel = candidate.relative_to(base)
    except Exception:
        return None

    if len(rel.parts) != 1 or rel.parts[0] != filename:
        return None
    return candidate


def cleanup_profile_avatar_files(
    avatars_dir: Optional[Union[str, Path]],
    profile_key: Optional[str],
    *,
    old_meta: Any = None,
    keep_filename: Optional[str] = None,
) -> None:
    """Safely removes previous local avatar file(s) belonging to `profile_key` only."""
    base_dir = resolve_avatars_dir(avatars_dir)
    if not base_dir.is_dir():
        return

    targets: List[Path] = []
    if isinstance(old_meta, dict):
        old_file = old_meta.get("file")
        if old_file and old_file != keep_filename:
            safe_old = resolve_safe_avatar_path(base_dir, old_file)
            if safe_old is not None and safe_old.is_file() and not safe_old.is_symlink():
                targets.append(safe_old)

    prefix = avatar_profile_prefix(profile_key) + "_"
    try:
        for entry in base_dir.iterdir():
            if entry.name == keep_filename or not entry.name.startswith(prefix):
                continue
            safe_entry = resolve_safe_avatar_path(base_dir, entry.name)
            if safe_entry is not None and safe_entry.is_file() and not safe_entry.is_symlink():
                targets.append(safe_entry)
    except OSError:
        pass

    seen: Set[Path] = set()
    for path in targets:
        if path in seen:
            continue
        seen.add(path)
        try:
            path.unlink()
        except OSError:
            pass


def prepare_custom_avatar_storage(
    raw_avatar: Any,
    *,
    profile_key: Optional[str],
    avatars_dir: Optional[Union[str, Path]] = None,
) -> Tuple[Dict[str, Any], Optional[Path]]:
    """Validates `customAvatar` input and persists image bytes outside `collection.media`."""
    if raw_avatar is None or raw_avatar == {}:
        return {"kind": "initial"}, None
    if not isinstance(raw_avatar, dict):
        raise ValueError("Invalid customAvatar payload")

    kind = str(raw_avatar.get("kind") or "").strip().lower()
    if kind in ("", "initial"):
        return {"kind": "initial"}, None

    if kind == "preset":
        preset_id = str(raw_avatar.get("presetId") or "").strip()
        if preset_id not in AVATAR_PRESET_IDS:
            raise ValueError(f"Invalid avatar presetId: {preset_id}")
        return {"kind": "preset", "presetId": preset_id}, None

    if kind == "image":
        mime, img_bytes = parse_and_validate_avatar_data_url(raw_avatar.get("dataUrl"))
        ext = ALLOWED_AVATAR_MIME_TO_EXT[mime]
        prefix = avatar_profile_prefix(profile_key)
        filename = f"{prefix}_{secrets.token_hex(6)}.{ext}"
        base_dir = resolve_avatars_dir(avatars_dir)
        base_dir.mkdir(parents=True, exist_ok=True)
        target_path = resolve_safe_avatar_path(base_dir, filename)
        if target_path is None:
            raise ValueError("Unsafe avatar storage path")

        tmp_path = base_dir / f".{filename}.{secrets.token_hex(4)}.tmp"
        try:
            tmp_path.write_bytes(img_bytes)
            os.replace(tmp_path, target_path)
        except Exception:
            try:
                if tmp_path.exists():
                    tmp_path.unlink()
            except OSError:
                pass
            raise
        return {"kind": "image", "file": filename, "mime": mime}, target_path

    raise ValueError(f"Unsupported customAvatar kind: {kind}")


def resolve_custom_avatar(
    cfg: Optional[Dict[str, Any]],
    *,
    avatars_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Resolves persisted `custom_avatar` metadata into frontend-ready `customAvatar`."""
    raw_avatar = (cfg or {}).get("custom_avatar")
    if not isinstance(raw_avatar, dict):
        return {"kind": "initial"}

    kind = str(raw_avatar.get("kind") or "").strip().lower()
    if kind == "preset":
        preset_id = str(raw_avatar.get("presetId") or "").strip()
        if preset_id in AVATAR_PRESET_IDS:
            return {"kind": "preset", "presetId": preset_id}
        return {"kind": "initial"}

    if kind == "image":
        rel_file = raw_avatar.get("file")
        stored_mime = str(raw_avatar.get("mime") or "").strip().lower()
        if stored_mime not in ALLOWED_AVATAR_MIME_TO_EXT:
            return {"kind": "initial"}
        base_dir = resolve_avatars_dir(avatars_dir)
        if not base_dir.is_dir():
            return {"kind": "initial"}
        safe_path = resolve_safe_avatar_path(base_dir, rel_file)
        if safe_path is None or not safe_path.is_file():
            return {"kind": "initial"}
        try:
            if safe_path.stat().st_size > MAX_AVATAR_BYTES:
                return {"kind": "initial"}
            raw_bytes = safe_path.read_bytes()
        except OSError:
            return {"kind": "initial"}
        if not raw_bytes or len(raw_bytes) > MAX_AVATAR_BYTES:
            return {"kind": "initial"}
        detected_mime = detect_image_mime_from_bytes(raw_bytes, allow_bmp=False)
        if detected_mime is None or detected_mime != stored_mime:
            return {"kind": "initial"}
        b64 = base64.b64encode(raw_bytes).decode("ascii")
        return {"kind": "image", "dataUrl": f"data:{detected_mime};base64,{b64}"}

    return {"kind": "initial"}
