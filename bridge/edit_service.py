# -*- coding: utf-8 -*-
"""
Anki Modern OS — Inline Edit, Card Inspector, Media Paste & Quick Add Service
Supports zero-popup WYSIWYG inline field updates across arbitrary multi-field
and Cloze note templates, tag management, deck relocation, card suspension/deletion,
clipboard screenshot pasting into `collection.media`, and Quick Add card creation.
"""

from __future__ import annotations

import base64
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List


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
            return {"saved": True, "savedAt": int(time.time() * 1000)}

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
        model = note.note_type() if hasattr(note, "note_type") else {"type": 0}
        is_cloze = bool(model.get("type") == 1)

        explicit_fields = data.get("fields")
        updated_keys = set()
        if isinstance(explicit_fields, dict) and explicit_fields:
            for k, v in explicit_fields.items():
                if k in note:
                    note[k] = str(v)
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
                note[target_front_key] = str(data["front"])
                updated_keys.add(target_front_key)

        has_updated_meaning = any(k in meaning_alias for k in updated_keys)
        if ("meaning" in data or "back" in data) and not has_updated_meaning:
            meaning_val = str(data.get("meaning") if "meaning" in data else data.get("back", ""))
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
            example_val = str(data.get("example", "")).strip()
            matched_example = next((f for f in field_names if f in example_alias), None)
            if matched_example and matched_example not in updated_keys:
                note[matched_example] = example_val
            elif len(field_names) >= 3 and field_names[2] not in front_alias and field_names[2] not in meaning_alias:
                note[field_names[2]] = example_val

        has_updated_etym = any(k in etymology_alias for k in updated_keys)
        if "etymology" in data and not has_updated_etym:
            etym_val = str(data.get("etymology", "")).strip()
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
                "saved": True,
                "filename": filename,
                "fileUrl": f"data:image/{safe_ext};base64,{raw_b64}",
                "htmlTag": f'<img src="{filename}" />',
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

    def quick_add_card(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a new note & card from the Quick Add Drawer (Page 6)."""
        front = str(data.get("front", "")).strip()
        back = str(data.get("back", "")).strip()
        tags: List[str] = [str(t).strip() for t in data.get("tags", []) if str(t).strip()]
        deck_id_raw = data.get("deckId")
        deck_name = str(data.get("deckName", "")).strip()

        if not front:
            raise ValueError("Card front content cannot be empty")

        col = self.col
        if col is None:
            new_id = str(int(time.time() * 1000))
            return {"created": True, "noteId": new_id, "cardId": new_id}

        target_did = 1
        if deck_id_raw and str(deck_id_raw).isdigit():
            deck_obj = col.decks.get(int(deck_id_raw), default=False)
            if deck_obj:
                target_did = int(deck_obj["id"])
        if target_did == 1 and deck_name:
            out = col.decks.add_normal_deck_with_name(deck_name)
            target_did = int(out.id)

        is_cloze = bool(re.search(r"\{\{c\d+::", front) or re.search(r"\{\{c\d+::", back))
        model = None
        for m in col.models.all():
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
                    note[k] = str(v)
        note.tags = tags

        col.add_note(note, target_did)
        cids = [str(cid) for cid in note.card_ids()]

        return {
            "created": True,
            "noteId": str(note.id),
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
