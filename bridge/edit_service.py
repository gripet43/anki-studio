# -*- coding: utf-8 -*-
"""
Anki Studio — Inline Edit, Card Inspector, Media Paste & Quick Add Service
Supports zero-popup WYSIWYG inline field updates across arbitrary multi-field
and Cloze note templates, tag management, deck relocation, card suspension/deletion,
7-color user flags, clipboard screenshot pasting into `collection.media`, and Quick Add card creation.
"""

from __future__ import annotations

import base64
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List

from .media_utils import get_media_dir, normalize_media_html_for_storage


class EditService:
    """Service for updating notes/cards in-place, saving pasted media, and adding new notes."""

    def __init__(self, col_getter):
        self._get_col = col_getter

    @property
    def col(self):
        return self._get_col()

    def update_card_inline(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Saves inline edits directly to the SQLite database via Anki's native note update API.
        Bug #2 Fix: Also handles `suspended` state changes via `col.sched.suspend_cards / unsuspend_cards`.
        """
        col = self.col
        if col is None:
            return {"saved": False, "error": "Collection unavailable"}

        note_id = data.get("noteId")
        card_id = data.get("cardId")

        if note_id and str(note_id).isdigit():
            note = col.get_note(int(note_id))
        elif card_id and str(card_id).isdigit():
            card = col.get_card(int(card_id))
            note = card.note()
        else:
            raise ValueError("Valid cardId or noteId is required")

        field_names = list(note.keys())
        media_dir = get_media_dir(col)
        model = note.note_type() if hasattr(note, "note_type") else {"type": 0}
        is_cloze = bool(model.get("type") == 1)

        explicit_fields = data.get("fields")
        updated_keys = set()
        if isinstance(explicit_fields, dict) and explicit_fields:
            for k, v in explicit_fields.items():
                if k in note:
                    note[k] = normalize_media_html_for_storage(str(v), media_dir)
                    updated_keys.add(k)

        front_alias = ("正面", "Front", "Text", "文字", "问题", "Question", "Word", "Expression")
        meaning_alias = ("释义", "背面", "Back", "Meaning", "Answer", "答案", "Back Extra", "背面额外")
        example_alias = ("例句", "Example", "Sentence", "Examples")
        etymology_alias = ("词源", "Etymology", "Root", "Origin")

        has_updated_front = any(k in front_alias for k in updated_keys)
        if "front" in data and not has_updated_front:
            matched_front = next((f for f in field_names if f in front_alias), None)
            target_front_key = matched_front or (field_names[0] if field_names else None)
            if target_front_key:
                note[target_front_key] = normalize_media_html_for_storage(str(data["front"]), media_dir)
                updated_keys.add(target_front_key)

        has_updated_meaning = any(k in meaning_alias for k in updated_keys)
        if ("meaning" in data or "back" in data) and not has_updated_meaning:
            meaning_val = normalize_media_html_for_storage(
                str(data.get("meaning") if "meaning" in data else data.get("back", "")),
                media_dir,
            )
            if is_cloze and len(field_names) == 1:
                if field_names[0] not in updated_keys and "front" not in data:
                    note[field_names[0]] = meaning_val
            else:
                matched_meaning = next((f for f in field_names if f in meaning_alias), None)
                target_meaning_key = matched_meaning or (field_names[1] if len(field_names) > 1 else None)
                if target_meaning_key and target_meaning_key not in updated_keys:
                    note[target_meaning_key] = meaning_val
                    updated_keys.add(target_meaning_key)

        has_updated_example = any(k in example_alias for k in updated_keys)
        if "example" in data and not has_updated_example:
            example_val = normalize_media_html_for_storage(str(data.get("example", "")).strip(), media_dir)
            matched_example = next((f for f in field_names if f in example_alias), None)
            if matched_example and matched_example not in updated_keys:
                note[matched_example] = example_val
            elif len(field_names) >= 3 and field_names[2] not in front_alias and field_names[2] not in meaning_alias:
                note[field_names[2]] = example_val

        has_updated_etym = any(k in etymology_alias for k in updated_keys)
        if "etymology" in data and not has_updated_etym:
            etym_val = normalize_media_html_for_storage(str(data.get("etymology", "")).strip(), media_dir)
            matched_etym = next((f for f in field_names if f in etymology_alias), None)
            if matched_etym and matched_etym not in updated_keys:
                note[matched_etym] = etym_val

        if "tags" in data and isinstance(data["tags"], list):
            note.tags = [str(t).strip() for t in data["tags"] if str(t).strip()]

        col.update_note(note)

        # Resolve target card IDs for deck relocation or suspension
        target_cids: List[int] = []
        if card_id and str(card_id).isdigit():
            target_cids.append(int(card_id))
        elif hasattr(note, "card_ids"):
            target_cids.extend(int(cid) for cid in note.card_ids())

        # Deck relocation
        target_did = None
        if "deckId" in data and str(data["deckId"]).isdigit():
            target_did = int(data["deckId"])
        elif "deckName" in data and str(data["deckName"]).strip():
            out = col.decks.add_normal_deck_with_name(str(data["deckName"]).strip())
            target_did = int(out.id)

        if target_did is not None and target_cids:
            col.set_deck(target_cids, target_did)

        # Bug #2 Fix: Persist `suspended` status to Anki's scheduler database
        if "suspended" in data and target_cids:
            should_suspend = bool(data["suspended"])
            if should_suspend:
                col.sched.suspend_cards(target_cids)
            else:
                col.sched.unsuspend_cards(target_cids)

        if "flags" in data and target_cids:
            try:
                f_val = max(0, min(7, int(data["flags"] or 0)))
                self.set_card_flag({"cardIds": [str(c) for c in target_cids], "flag": f_val})
            except Exception:
                pass

        return {
            "saved": True,
            "noteId": str(note.id),
            "cardId": str(card_id or ""),
            "fields": dict(note.items()),
            "tags": list(note.tags),
            "suspended": bool(data.get("suspended", False)),
            "savedAt": int(time.time() * 1000),
        }

    def save_pasted_image(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Bug #11 Fix: Writes a base64 image from clipboard paste directly into `collection.media`
        and returns both the stored filename and its `file://` URI for instant preview.
        """
        raw_b64 = str(data.get("base64Data", "")).strip()
        if not raw_b64:
            raise ValueError("No image data provided")

        if "," in raw_b64 and raw_b64.startswith("data:"):
            raw_b64 = raw_b64.split(",", 1)[1]

        img_bytes = base64.b64decode(raw_b64)
        ext = str(data.get("ext", "png")).strip().lstrip(".") or "png"
        safe_ext = re.sub(r"[^a-zA-Z0-9]", "", ext) or "png"
        requested_name = str(data.get("filename", "")).strip()
        filename = requested_name or f"paste_{int(time.time() * 1000)}.{safe_ext}"

        col = self.col
        if col is None:
            return {
                "saved": False,
                "filename": filename,
                "error": "Collection unavailable: image was not written to media",
            }

        actual_name = filename
        media_dir = ""
        try:
            if hasattr(col, "media"):
                if hasattr(col.media, "write_data"):
                    actual_name = col.media.write_data(filename, img_bytes)
                elif hasattr(col.media, "dir"):
                    media_dir = str(col.media.dir() or "")
                    if media_dir:
                        target_path = Path(media_dir) / filename
                        target_path.write_bytes(img_bytes)
                if not media_dir and hasattr(col.media, "dir"):
                    media_dir = str(col.media.dir() or "")
        except Exception:
            pass

        file_url = actual_name
        if media_dir:
            try:
                file_url = (Path(media_dir) / actual_name).resolve().as_uri()
            except Exception:
                file_url = f"file://{os.path.join(media_dir, actual_name)}"

        return {
            "saved": True,
            "filename": actual_name,
            "fileUrl": file_url,
            "htmlTag": f'<img src="{actual_name}" />',
        }

    def get_note_types(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Returns all note types (models) in the user's collection with field names and flags."""
        col = self.col
        if col is None or not hasattr(col, "models"):
            return {
                "success": True,
                "noteTypes": [
                    {"id": "basic", "name": "Basic", "isCloze": False, "fields": ["正面", "背面"], "isReversed": False, "isTypeAnswer": False},
                    {"id": "Cloze", "name": "Cloze", "isCloze": True, "fields": ["Text", "Back Extra"], "isReversed": False, "isTypeAnswer": False},
                ],
            }

        out: List[Dict[str, Any]] = []
        try:
            models = col.models.all() if hasattr(col.models, "all") else []
            for m in models:
                m_id = str(m.get("id", ""))
                m_name = str(m.get("name", "Basic"))
                is_cloze = bool(m.get("type") == 1)
                flds = [str(f.get("name", "")) for f in m.get("flds", []) if isinstance(f, dict) and f.get("name")]
                if not flds:
                    flds = ["Text", "Back Extra"] if is_cloze else ["正面", "背面"]
                tmpls = m.get("tmpls", []) if isinstance(m.get("tmpls"), list) else []
                is_reversed = (not is_cloze) and len(tmpls) >= 2
                is_type_ans = any(
                    "{{type:" in (str(t.get("qfmt", "")) + str(t.get("afmt", "")))
                    for t in tmpls
                    if isinstance(t, dict)
                ) or ("type" in m_name.lower() or "输入" in m_name or "默写" in m_name)
                out.append({
                    "id": m_id,
                    "name": m_name,
                    "isCloze": is_cloze,
                    "fields": flds,
                    "isReversed": is_reversed,
                    "isTypeAnswer": is_type_ans,
                })
        except Exception:
            pass

        return {"success": True, "noteTypes": out}

    @staticmethod
    def _normalize_for_dup_check(raw_html: str) -> str:
        if not raw_html:
            return ""
        import html
        s = re.sub(r"\[sound:[^\]]+\]", "", str(raw_html))
        s = re.sub(r"\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}", r"\1", s)
        s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
        s = re.sub(r"<[^>]+>", "", s)
        s = html.unescape(s)
        return re.sub(r"\s+", " ", s).strip().lower()

    def check_duplicate_note(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Checks whether a note with the same normalized front field already exists."""
        data = data or {}
        raw_front = str(data.get("front", "") or "").strip()
        exclude_nid = str(data.get("excludeNoteId", "") or "").strip()
        norm_target = self._normalize_for_dup_check(raw_front)

        if not norm_target:
            return {"isDuplicate": False, "count": 0, "duplicateCount": 0, "matchedNoteIds": [], "matchedPreview": ""}

        col = self.col
        if col is None or not hasattr(col, "db") or not hasattr(col.db, "all"):
            return {"isDuplicate": False, "count": 0, "duplicateCount": 0, "matchedNoteIds": [], "matchedPreview": ""}

        matched_nids: List[str] = []
        matched_preview = ""
        try:
            rows = col.db.all("SELECT id, flds FROM notes")
            for r in rows:
                nid_str = str(r[0])
                if exclude_nid and nid_str == exclude_nid:
                    continue
                flds_raw = str(r[1] or "")
                first_field = flds_raw.split("\x1f", 1)[0]
                if self._normalize_for_dup_check(first_field) == norm_target:
                    matched_nids.append(nid_str)
                    if not matched_preview:
                        matched_preview = re.sub(r"<[^>]+>", "", first_field).strip()[:80]
        except Exception:
            pass

        return {
            "isDuplicate": len(matched_nids) > 0,
            "count": len(matched_nids),
            "duplicateCount": len(matched_nids),
            "matchedNoteIds": matched_nids[:10],
            "matchedPreview": matched_preview,
        }

    def quick_add_card(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a new note & card from the Quick Add Drawer (supports model selection, reverse cards, and type-answer)."""
        front = str(data.get("front", "")).strip()
        back = str(data.get("back", "")).strip()
        tags: List[str] = [str(t).strip() for t in data.get("tags", []) if str(t).strip()]
        deck_id_raw = data.get("deckId")
        deck_name = str(data.get("deckName", "")).strip()
        requested_model_id = str(data.get("modelId", "") or "").strip()
        requested_model_name = str(data.get("modelName", "") or "").strip()
        create_reverse = bool(data.get("createReverseCard", False))

        if not front:
            raise ValueError("Card front content cannot be empty")

        col = self.col
        if col is None:
            # Never mint a fake timestamp ID: the note does not exist in Anki and
            # would disappear (or collide) on the next refresh.
            return {"created": False, "error": "Collection unavailable"}

        media_dir = get_media_dir(col)
        front = normalize_media_html_for_storage(front, media_dir)
        back = normalize_media_html_for_storage(back, media_dir)

        target_did = 1
        if deck_id_raw and str(deck_id_raw).isdigit():
            deck_obj = col.decks.get(int(deck_id_raw), default=False)
            if deck_obj:
                target_did = int(deck_obj["id"])
        if target_did == 1 and deck_name:
            out = col.decks.add_normal_deck_with_name(deck_name)
            target_did = int(out.id)

        is_cloze = bool(re.search(r"\{\{c\d+::", front) or re.search(r"\{\{c\d+::", back))
        all_models = col.models.all() if hasattr(col.models, "all") else []
        model = None

        # 1. Explicit model selection if not overridden by Cloze syntax
        if not is_cloze and (requested_model_id or requested_model_name):
            for m in all_models:
                if requested_model_id and str(m.get("id", "")) == requested_model_id:
                    model = m
                    break
                if requested_model_name and str(m.get("name", "")).lower() == requested_model_name.lower():
                    model = m
                    break

        # 2. Fallback automatic model selection
        if model is None:
            for m in all_models:
                if is_cloze and m.get("type") == 1:
                    model = m
                    break
                if not is_cloze and m.get("type") == 0 and len(m.get("flds", [])) >= 2:
                    model = m
                    break
        if model is None:
            model = col.models.current()

        note = col.new_note(model)
        flds = list(note.keys())
        if flds:
            note[flds[0]] = front
        if len(flds) > 1:
            note[flds[1]] = back
        if isinstance(data.get("fields"), dict):
            for k, v in data["fields"].items():
                if k in note:
                    note[k] = normalize_media_html_for_storage(str(v), media_dir)
        note.tags = list(tags)

        col.add_note(note, target_did)
        cids = [str(cid) for cid in note.card_ids()]

        # 3. If user requested a bidirectional (Basic + Reversed) card and the model only produced 1 card
        #    and back is non-empty, create the reverse direction note so both directions are scheduled!
        reverse_note_id = None
        if create_reverse and not is_cloze and back and len(cids) <= 1:
            try:
                rev_note = col.new_note(model)
                rev_flds = list(rev_note.keys())
                if rev_flds:
                    rev_note[rev_flds[0]] = back
                if len(rev_flds) > 1:
                    rev_note[rev_flds[1]] = front
                rev_note.tags = list(tags)
                col.add_note(rev_note, target_did)
                reverse_note_id = str(rev_note.id)
                for r_cid in rev_note.card_ids():
                    cids.append(str(r_cid))
            except Exception:
                pass

        return {
            "created": True,
            "createdCount": len(cids),
            "noteId": str(note.id),
            "reverseNoteId": reverse_note_id,
            "cardIds": cids,
            "cardId": cids[0] if cids else str(note.id),
            "deckId": str(target_did),
        }

    def toggle_suspend_card(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Suspends or unsuspends one or more cards."""
        col = self.col
        card_ids = [int(cid) for cid in data.get("cardIds", []) if str(cid).isdigit()]
        if "cardId" in data and str(data["cardId"]).isdigit():
            card_ids.append(int(data["cardId"]))

        suspend = bool(data.get("suspend", True))
        if col and card_ids:
            if suspend:
                col.sched.suspend_cards(card_ids)
            else:
                col.sched.unsuspend_cards(card_ids)

        return {"changed": True, "cardIds": [str(c) for c in card_ids], "suspended": suspend}

    def toggle_bury_card(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Buries (postpones until tomorrow) or unburies one or more cards."""
        col = self.col
        card_ids = [int(cid) for cid in data.get("cardIds", []) if str(cid).isdigit()]
        if "cardId" in data and str(data["cardId"]).isdigit():
            card_ids.append(int(data["cardId"]))

        bury = bool(data.get("bury", True))
        if col and card_ids:
            if bury:
                col.sched.bury_cards(card_ids, manual=True)
            else:
                col.sched.unbury_cards(card_ids)

        return {"changed": True, "cardIds": [str(c) for c in card_ids], "buried": bury}

    def set_card_flag(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sets or clears the 7-color user flag (0..7) on one or more cards."""
        col = self.col
        card_ids = [int(cid) for cid in data.get("cardIds", []) if str(cid).isdigit()]
        if "cardId" in data and str(data["cardId"]).isdigit():
            cid_single = int(data["cardId"])
            if cid_single not in card_ids:
                card_ids.append(cid_single)

        try:
            raw_flag = int(data.get("flag", 0) or 0)
        except Exception:
            raw_flag = 0
        flag = max(0, min(7, raw_flag))

        if col is None or not card_ids:
            return {
                "changed": False,
                "cardIds": [str(c) for c in card_ids],
                "flag": flag,
                "error": "Collection unavailable or no valid card IDs",
            }

        try:
            if hasattr(col, "set_user_flag_for_cards"):
                col.set_user_flag_for_cards(flag, card_ids)
        except Exception:
            pass

        for cid in card_ids:
            try:
                card = col.get_card(int(cid))
                if card is not None:
                    prev_flags = int(getattr(card, "flags", 0) or 0)
                    card.flags = (prev_flags & ~7) | (flag & 7)
                    if hasattr(col, "update_card"):
                        col.update_card(card)
            except Exception:
                pass
            try:
                if hasattr(col, "db") and hasattr(col.db, "conn"):
                    col.db.conn.execute(
                        "UPDATE cards SET flags = (coalesce(flags, 0) & ~7) | ? WHERE id = ?",
                        (flag & 7, int(cid)),
                    )
                    col.db.conn.commit()
            except Exception:
                pass

        return {
            "changed": True,
            "cardIds": [str(c) for c in card_ids],
            "flag": flag,
        }

    def delete_cards(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Deletes notes corresponding to given cardIds or noteIds."""
        col = self.col
        note_ids = [int(nid) for nid in data.get("noteIds", []) if str(nid).isdigit()]
        card_ids = [int(cid) for cid in data.get("cardIds", []) if str(cid).isdigit()]
        if "cardId" in data and str(data["cardId"]).isdigit():
            card_ids.append(int(data["cardId"]))
        if "noteId" in data and str(data["noteId"]).isdigit():
            nid_val = int(data["noteId"])
            if nid_val not in note_ids:
                note_ids.append(nid_val)

        if col:
            for cid in card_ids:
                try:
                    c = col.get_card(cid)
                    if c.nid not in note_ids:
                        note_ids.append(c.nid)
                except Exception:
                    pass
            if note_ids:
                col.remove_notes(note_ids)

        return {
            "deleted": True,
            "noteIds": [str(n) for n in note_ids],
            "cardIds": [str(c) for c in card_ids],
        }
