# -*- coding: utf-8 -*-
"""
Anki Studio — Inline Edit, Card Inspector, Media Paste & Quick Add Service
Supports zero-popup WYSIWYG inline field updates across arbitrary multi-field
and Cloze note templates, tag management, deck relocation, card suspension/deletion,
7-color user flags, clipboard screenshot pasting into `collection.media`, and Quick Add card creation.
"""

from __future__ import annotations

import base64
import copy
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .media_utils import (
    CLOZE_RE,
    HR_ANSWER_RE,
    IO_SHAPE_RE,
    get_media_dir,
    normalize_media_html_for_storage,
)

_TEMPLATE_TOKEN_RE = re.compile(r"\{\{([^{}]+)\}\}")
_KNOWN_CLOZE_FILTER_PREFIXES = {"text", "type", "cloze", "hint", "furigana", "kanji", "kana"}
_SPECIAL_TEMPLATE_TAGS = {"frontside", "tags", "type", "deck", "subdeck", "card", "cardflag", "notetype"}
_FRONTSIDE_RE = re.compile(r"\{\{\s*FrontSide\s*\}\}", flags=re.I)
_CLOZE_TOKEN_CHECK_RE = re.compile(r"\{\{[^}]*\bcloze:", flags=re.I)
_EXISTING_CLOZE_FIELD_RE = re.compile(r"\{\{\s*(?:[^}]*:)?cloze:([^:}]+)\}\}", flags=re.I)
_STOCK_BASIC_NAMES = {"basic", "问答题", "基础"}
_IO_RECT_SPAN_STRIP_RE = re.compile(
    r'<span\b[^>]*\bclass\s*=\s*["\'][^"\']*\banki-io-rect\b[^"\']*["\'][^>]*>[\s\S]*?</span\s*>',
    flags=re.I,
)


def _find_cloze_field_names(field_items: Any) -> List[str]:
    """返回包含合法文本挖空 ``{{cN::...}}`` 的字段名（跳过 Image Occlusion 结构指令/遮罩）。"""
    cloze_fields: List[str] = []
    for k, v in field_items:
        text = str(v or "")
        if not text or IO_SHAPE_RE.search(text):
            continue
        cleaned = _IO_RECT_SPAN_STRIP_RE.sub("", text)
        if CLOZE_RE.search(cleaned):
            cloze_fields.append(str(k))
    return cloze_fields


def _is_image_occlusion_model(model: Optional[Dict[str, Any]]) -> bool:
    if not isinstance(model, dict):
        return False
    name = str(model.get("name", "") or "").strip().lower()
    if "image occlusion" in name:
        return True
    fld_names = {
        str(f.get("name", "") or "").strip().lower()
        for f in (model.get("flds") or [])
        if isinstance(f, dict)
    }
    return "occlusion" in fld_names and "image" in fld_names


def _convert_field_tokens_to_cloze(tmpl_str: str, target_fields: List[str]) -> str:
    """将模板中的普通字段占位符 ``{{Field}}`` / ``{{filter:Field}}`` 转为 ``{{cloze:Field}}``，保留条件标记。"""
    target_set = {f for f in target_fields if f}
    if not tmpl_str or not target_set:
        return tmpl_str or ""

    def _repl(match: re.Match) -> str:
        raw_inner = match.group(1).strip()
        if not raw_inner or raw_inner[0] in ("#", "/", "^", "!"):
            return match.group(0)
        if raw_inner.lower() in _SPECIAL_TEMPLATE_TAGS:
            return match.group(0)
        if raw_inner in target_set:
            return f"{{{{cloze:{raw_inner}}}}}"
        parts = raw_inner.split(":")
        bare_name = parts[-1].strip()
        prefixes = [p.strip().lower() for p in parts[:-1]]
        if (
            bare_name in target_set
            and prefixes
            and all(p in _KNOWN_CLOZE_FILTER_PREFIXES for p in prefixes)
        ):
            if "cloze" in prefixes:
                return match.group(0)
            return f"{{{{cloze:{bare_name}}}}}"
        return match.group(0)

    return _TEMPLATE_TOKEN_RE.sub(_repl, tmpl_str)


def _rewrite_template_for_cloze(
    qfmt: str, afmt: str, cloze_fields: List[str], primary_cloze_field: str
) -> Tuple[str, str]:
    """将标准卡型模板重写为合法的 Anki ``MODEL_CLOZE`` 正反面模板（保留所有 HTML 包装与 CSS 类名）。"""
    target_fields = list(dict.fromkeys(f for f in cloze_fields if f))
    if not target_fields and primary_cloze_field:
        target_fields = [primary_cloze_field]

    new_qfmt = _convert_field_tokens_to_cloze(qfmt or "", target_fields)
    if not _CLOZE_TOKEN_CHECK_RE.search(new_qfmt) and primary_cloze_field:
        cloze_tag = f"{{{{cloze:{primary_cloze_field}}}}}"
        new_qfmt = f"{new_qfmt}\n{cloze_tag}" if new_qfmt.strip() else cloze_tag

    new_afmt = _convert_field_tokens_to_cloze(afmt or "", target_fields)
    if _FRONTSIDE_RE.search(new_afmt):
        replacement = new_qfmt if HR_ANSWER_RE.search(new_afmt) else f"{new_qfmt}\n<hr id=answer>\n"
        new_afmt = _FRONTSIDE_RE.sub(lambda _m: replacement, new_afmt)

    if not _CLOZE_TOKEN_CHECK_RE.search(new_afmt):
        new_afmt = f"{new_qfmt}\n<hr id=answer>\n{new_afmt}" if new_afmt.strip() else new_qfmt

    return new_qfmt, new_afmt


class EditService:
    """Service for updating notes/cards in-place, saving pasted media, and adding new notes."""

    def __init__(self, col_getter):
        self._get_col = col_getter

    @property
    def col(self):
        return self._get_col()

    @staticmethod
    def _all_models_with_companions(col) -> List[Dict[str, Any]]:
        base = list(col.models.all()) if (col and hasattr(col, "models") and hasattr(col.models, "all")) else []
        extra = list(getattr(col, "_companion_models", []) or [])
        seen_ids = {str(m.get("id")) for m in base if isinstance(m, dict) and m.get("id") is not None}
        merged = list(base)
        for m in extra:
            if isinstance(m, dict) and str(m.get("id")) not in seen_ids:
                merged.append(m)
        return merged

    def _find_model_by_id_or_name(
        self, col, requested_model_id: str = "", requested_model_name: str = ""
    ) -> Optional[Dict[str, Any]]:
        if not requested_model_id and not requested_model_name:
            return None
        for m in self._all_models_with_companions(col):
            if requested_model_id and str(m.get("id", "")) == requested_model_id:
                return m
            if requested_model_name and str(m.get("name", "")).lower() == requested_model_name.lower():
                return m
        return None

    def _save_model_dict(self, col, model_dict: Dict[str, Any]) -> None:
        if not hasattr(col, "models"):
            return
        if hasattr(col.models, "update_dict"):
            col.models.update_dict(model_dict)
        elif hasattr(col.models, "save"):
            col.models.save(model_dict)

    def _ensure_companion_cloze_model(
        self,
        col,
        std_model: Dict[str, Any],
        cloze_fields: List[str],
        card_ord: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """为自定义标准卡型创建（或复用）同构的 ``(Cloze)`` 伴生挖空卡型，完整保留字段与 CSS 样式。"""
        if not isinstance(std_model, dict) or _is_image_occlusion_model(std_model):
            return None

        std_flds = [str(f.get("name", "")) for f in (std_model.get("flds") or []) if isinstance(f, dict)]
        std_id_str = str(std_model.get("id") or "")
        std_name = str(std_model.get("name") or "Basic").strip() or "Basic"
        companion_name = f"{std_name} (Cloze)"

        candidates = self._all_models_with_companions(col)
        existing: Optional[Dict[str, Any]] = None
        for m in candidates:
            if int(m.get("type", 0) or 0) != 1:
                continue
            m_flds = [str(f.get("name", "")) for f in (m.get("flds") or []) if isinstance(f, dict)]
            same_fields = (m_flds == std_flds) if std_flds else (not m_flds)
            if not same_fields:
                continue
            if std_id_str and str(m.get("anki_studio_companion_of", "")) == std_id_str:
                existing = m
                break
            if str(m.get("name", "")) == companion_name:
                existing = m
                break

        primary_field = cloze_fields[0] if cloze_fields else (std_flds[0] if std_flds else "Text")

        if existing is not None:
            tmpls = existing.get("tmpls")
            if isinstance(tmpls, list) and tmpls and isinstance(tmpls[0], dict):
                t0 = tmpls[0]
                old_q = str(t0.get("qfmt", "") or "")
                old_a = str(t0.get("afmt", "") or "")
                existing_cloze_fields = [m.strip() for m in _EXISTING_CLOZE_FIELD_RE.findall(old_q)]
                merged_fields = list(dict.fromkeys([f for f in (existing_cloze_fields + cloze_fields) if f]))
                new_q, new_a = _rewrite_template_for_cloze(old_q, old_a, merged_fields, primary_field)
                std_css = str(std_model.get("css", "") or "")
                changed = (
                    new_q != old_q
                    or new_a != old_a
                    or (std_css and std_css != str(existing.get("css", "") or ""))
                    or (std_id_str and str(existing.get("anki_studio_companion_of", "")) != std_id_str)
                )
                if changed:
                    t0["qfmt"] = new_q
                    t0["afmt"] = new_a
                    if std_css:
                        existing["css"] = std_css
                    if std_id_str:
                        existing["anki_studio_companion_of"] = std_id_str
                    self._save_model_dict(col, existing)
            return existing

        used_names = {str(m.get("name", "")) for m in candidates if isinstance(m, dict)}
        target_name = companion_name
        suffix_idx = 2
        while target_name in used_names:
            target_name = f"{std_name} (Cloze {suffix_idx})"
            suffix_idx += 1

        cloze_m = copy.deepcopy(std_model)
        cloze_m["id"] = 0
        cloze_m["name"] = target_name
        cloze_m["type"] = 1
        if std_id_str:
            cloze_m["anki_studio_companion_of"] = std_id_str

        src_tmpls = std_model.get("tmpls") or []
        if 0 <= card_ord < len(src_tmpls) and isinstance(src_tmpls[card_ord], dict):
            tmpl0 = copy.deepcopy(src_tmpls[card_ord])
        elif src_tmpls and isinstance(src_tmpls[0], dict):
            tmpl0 = copy.deepcopy(src_tmpls[0])
        else:
            default_back = std_flds[1] if len(std_flds) > 1 else ""
            tmpl0 = {
                "name": "Cloze",
                "qfmt": f"{{{{{primary_field}}}}}",
                "afmt": f"{{{{FrontSide}}}}<hr id=answer>{f'{{{{{default_back}}}}}' if default_back else ''}",
            }

        tmpl0["name"] = "Cloze"
        tmpl0["ord"] = 0
        new_q, new_a = _rewrite_template_for_cloze(
            str(tmpl0.get("qfmt", "") or ""),
            str(tmpl0.get("afmt", "") or ""),
            cloze_fields,
            primary_field,
        )
        tmpl0["qfmt"] = new_q
        tmpl0["afmt"] = new_a
        cloze_m["tmpls"] = [tmpl0]

        if hasattr(col, "models") and hasattr(col.models, "add_dict"):
            col.models.add_dict(cloze_m)
        elif hasattr(col, "models") and hasattr(col.models, "add"):
            col.models.add(cloze_m)
        else:
            companions = getattr(col, "_companion_models", None)
            if companions is None:
                companions = []
                setattr(col, "_companion_models", companions)
            used_ids = {
                int(m.get("id"))
                for m in self._all_models_with_companions(col)
                if isinstance(m, dict) and str(m.get("id", "")).lstrip("-").isdigit()
            }
            new_id = 900
            while new_id in used_ids:
                new_id += 1
            cloze_m["id"] = new_id
            companions.append(cloze_m)
            return cloze_m

        if hasattr(col, "models") and hasattr(col.models, "by_name"):
            fetched = col.models.by_name(target_name)
            if isinstance(fetched, dict):
                return fetched
        for m in self._all_models_with_companions(col):
            if str(m.get("name", "")) == target_name:
                return m
        return cloze_m

    def _prune_orphan_cloze_cards(
        self, col, note, model: Dict[str, Any], active_card=None
    ) -> List[str]:
        """Remove orphan cloze cards whose ordinals no longer exist on the note.

        Reassigns a card's ``ord`` before pruning if every existing card became an
        orphan, so a single surviving card is preserved cleanly.
        """
        if not model or int(model.get("type") or 0) != 1 or _is_image_occlusion_model(model):
            return []
        if not hasattr(note, "card_ids"):
            return []

        valid_ords = {
            int(m.group(1)) - 1
            for _, val in note.items()
            for m in CLOZE_RE.finditer(str(val or ""))
            if int(m.group(1)) >= 1
        }
        if not valid_ords:
            return []

        cards_on_note = []
        for cid_item in note.card_ids():
            try:
                cards_on_note.append(col.get_card(int(cid_item)))
            except Exception:
                pass
        if not cards_on_note:
            return []

        valid_cards = [c for c in cards_on_note if int(getattr(c, "ord", 0)) in valid_ords]
        orphan_cards = [c for c in cards_on_note if int(getattr(c, "ord", 0)) not in valid_ords]
        if not valid_cards and orphan_cards and hasattr(col, "update_card"):
            target_card = next(
                (c for c in orphan_cards if active_card is not None and int(c.id) == int(active_card.id)),
                orphan_cards[0],
            )
            target_card.ord = min(valid_ords)
            col.update_card(target_card)
            orphan_cards = [c for c in orphan_cards if int(c.id) != int(target_card.id)]

        if not orphan_cards or (not valid_cards and len(orphan_cards) == len(cards_on_note)):
            return []

        orphan_cids = [int(c.id) for c in orphan_cards]
        if hasattr(col, "remove_cards_and_orphaned_notes"):
            col.remove_cards_and_orphaned_notes(orphan_cids)
            return [str(cid) for cid in orphan_cids]
        if hasattr(col, "remove_cards"):
            col.remove_cards(orphan_cids)
            return [str(cid) for cid in orphan_cids]
        return []

    def _convert_note_to_companion_cloze_if_needed(
        self,
        col,
        note,
        model: Dict[str, Any],
        card=None,
        pruned_sink: Optional[List[str]] = None,
    ) -> Tuple[Dict[str, Any], bool]:
        """当笔记内容含 ``{{cN::...}}`` 但当前模板为标准模板 ``type==0`` 时，仅将本条笔记迁移至伴生挖空模板。"""
        cloze_fields = _find_cloze_field_names(note.items())
        if not cloze_fields or _is_image_occlusion_model(model):
            return model, False

        model_type = int(model.get("type", 0) or 0)
        if model_type == 1:
            tmpls = model.get("tmpls")
            if isinstance(tmpls, list) and tmpls and isinstance(tmpls[0], dict):
                t0 = tmpls[0]
                old_q = str(t0.get("qfmt", "") or "")
                old_a = str(t0.get("afmt", "") or "")
                existing_cloze_fields = [m.strip() for m in _EXISTING_CLOZE_FIELD_RE.findall(old_q)]
                merged = list(dict.fromkeys([f for f in (existing_cloze_fields + cloze_fields) if f]))
                new_q, new_a = _rewrite_template_for_cloze(old_q, old_a, merged, cloze_fields[0])
                if new_q != old_q or new_a != old_a:
                    t0["qfmt"] = new_q
                    t0["afmt"] = new_a
                    self._save_model_dict(col, model)
            return model, False

        card_ord = int(getattr(card, "ord", 0) or 0)
        cloze_model = self._ensure_companion_cloze_model(col, model, cloze_fields, card_ord=card_ord)
        if cloze_model is None:
            return model, False

        old_mid = int(model.get("id") or getattr(note, "mid", 1) or 1)
        new_mid = int(cloze_model.get("id") or 0)

        if (
            hasattr(col, "models")
            and hasattr(col.models, "change_notetype_info")
            and hasattr(col.models, "change_notetype_of_notes")
            and new_mid
        ):
            info = col.models.change_notetype_info(old_notetype_id=old_mid, new_notetype_id=new_mid)
            req = info.input
            req.note_ids.extend([int(note.id)])
            col.models.change_notetype_of_notes(req)

            reloaded_note = col.get_note(int(note.id)) if hasattr(col, "get_note") else note
            if hasattr(col, "update_note"):
                col.update_note(reloaded_note)

            pruned = self._prune_orphan_cloze_cards(
                col, reloaded_note, cloze_model, active_card=card
            )
            if pruned_sink is not None and pruned:
                pruned_sink.extend(pruned)
        else:
            note._is_cloze = True
            note._type_name = str(cloze_model.get("name") or "Cloze")
            note._model = cloze_model
            note.mid = new_mid

        return cloze_model, True

    @staticmethod
    def _is_stock_basic_model(model: Dict[str, Any]) -> bool:
        name = str(model.get("name", "") or "").strip().lower()
        flds = [f.get("name", "") for f in (model.get("flds") or []) if isinstance(f, dict)]
        css = str(model.get("css", "") or "").strip()
        if name not in _STOCK_BASIC_NAMES or len(flds) > 2:
            return False
        tmpls = model.get("tmpls") or []
        tmpl_blob = "".join(
            str(t.get("qfmt", "")) + str(t.get("afmt", ""))
            for t in tmpls
            if isinstance(t, dict)
        )
        has_custom_markup = bool(re.search(r"<(?!/?(?:br|hr)\b)[a-z]", tmpl_blob, flags=re.I))
        has_custom_css = bool(css and ("class" in tmpl_blob or ".card" not in css or len(css) > 240))
        return not (has_custom_markup or has_custom_css)

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
        card = None

        if note_id and str(note_id).isdigit():
            note = col.get_note(int(note_id))
            if card_id and str(card_id).isdigit():
                try:
                    card = col.get_card(int(card_id))
                except Exception:
                    card = None
        elif card_id and str(card_id).isdigit():
            card = col.get_card(int(card_id))
            note = card.note()
        else:
            raise ValueError("Valid cardId or noteId is required")

        field_names = list(note.keys())
        media_dir = get_media_dir(col)
        model = note.note_type() if hasattr(note, "note_type") else {"type": 0}
        old_model_id = str(model.get("id") or getattr(note, "mid", "") or "")
        is_cloze = bool(model.get("type") == 1)

        explicit_fields = data.get("fields")
        updated_keys = set()
        if isinstance(explicit_fields, dict) and explicit_fields:
            for k, v in explicit_fields.items():
                if k in note:
                    note[k] = normalize_media_html_for_storage(str(v), media_dir)
                    updated_keys.add(k)

        front_alias = (
            "正面",
            "Front",
            "Text",
            "文字",
            "问题",
            "Question",
            "Word",
            "Expression",
            "单词",
            "VocabKanji",
            "Mặt trước",
            "中文",
        )
        meaning_alias = (
            "释义",
            "背面",
            "Back",
            "Meaning",
            "Answer",
            "答案",
            "Back Extra",
            "背面额外",
            "解释",
            "VocabDefSC",
            "Tiếng Việt",
            "English",
            "Explain1",
        )
        example_alias = ("例句", "Example", "Sentence", "Examples", "Example1", "SentKanji1")
        etymology_alias = ("词源", "字源", "Etymology", "Root", "Origin")
        meta_skip = {"noteid", "note id", "id", "guid", "uuid", "link", "level", "suborder", "audio", "音标", "pinyin", "phiên âm"}

        has_updated_front = any(k in front_alias for k in updated_keys)
        if "front" in data and not has_updated_front:
            matched_front = next((f for f in field_names if f in front_alias), None)
            non_meta_fields = [f for f in field_names if f.strip().lower() not in meta_skip]
            target_front_key = matched_front or (non_meta_fields[0] if non_meta_fields else (field_names[0] if field_names else None))
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
                matched_meaning = next((f for f in field_names if f in meaning_alias and f not in updated_keys), None)
                non_meta_rest = [f for f in field_names if f not in updated_keys and f.strip().lower() not in meta_skip]
                target_meaning_key = matched_meaning or (non_meta_rest[0] if non_meta_rest else (field_names[1] if len(field_names) > 1 else None))
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

        pruned_card_ids: List[str] = []
        new_model, converted_to_cloze = self._convert_note_to_companion_cloze_if_needed(
            col, note, model, card=card, pruned_sink=pruned_card_ids
        )
        if converted_to_cloze and hasattr(col, "get_note"):
            try:
                note = col.get_note(int(note.id))
            except Exception:
                pass
        elif not converted_to_cloze:
            pruned_more = self._prune_orphan_cloze_cards(
                col, note, new_model or model, active_card=card
            )
            if pruned_more:
                pruned_card_ids.extend(pruned_more)
                if hasattr(col, "get_note"):
                    try:
                        note = col.get_note(int(note.id))
                    except Exception:
                        pass

        # Resolve target card IDs for deck relocation or suspension
        note_cids = [int(cid) for cid in (note.card_ids() if hasattr(note, "card_ids") else [])]
        target_cids: List[int] = []
        if card_id and str(card_id).isdigit() and (not note_cids or int(card_id) in note_cids):
            target_cids.append(int(card_id))
        elif note_cids:
            target_cids.extend(note_cids)

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

        active_model = new_model or model
        resolved_card_id = str(target_cids[0]) if target_cids else str(card_id or "")
        return {
            "saved": True,
            "noteId": str(note.id),
            "cardId": resolved_card_id,
            "notetypeId": str(active_model.get("id") or getattr(note, "mid", "") or ""),
            "noteTypeName": str(active_model.get("name") or ""),
            "isCloze": bool(active_model.get("type") == 1),
            "convertedToCloze": converted_to_cloze,
            "prunedCardIds": pruned_card_ids,
            "previousNotetypeId": old_model_id,
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

    @staticmethod
    def _resolve_target_deck(col, deck_id_raw, deck_name: str) -> int:
        target_did = 1
        if deck_id_raw and str(deck_id_raw).isdigit():
            deck_obj = col.decks.get(int(deck_id_raw), default=False)
            if deck_obj:
                target_did = int(deck_obj["id"])
        if target_did == 1 and deck_name:
            out = col.decks.add_normal_deck_with_name(deck_name)
            target_did = int(out.id)
        return target_did

    @staticmethod
    def _resolve_image_occlusion_model(col):
        """找到（必要时创建）Anki 原生 Image Occlusion 卡型。"""
        def _find():
            for m in col.models.all() or []:
                if str(m.get("name", "")).strip().lower() == "image occlusion":
                    return m
            return None

        model = _find()
        if model is not None:
            return model
        try:
            col.add_image_occlusion_notetype()
        except Exception:
            pass
        return _find()

    def _quick_add_image_occlusion(
        self,
        col,
        payload: Dict[str, Any],
        tags: List[str],
        deck_id_raw,
        deck_name: str,
        media_dir: str,
    ) -> Dict[str, Any]:
        """把遮挡编辑器的结果写成 Anki 原生 Image Occlusion 笔记。

        Occlusion 字段是 Anki 自己的文本指令，坐标取 0–1 小数：

            {{c1::image-occlusion:rect:left=.1:top=.2:width=.08:height=.06:oi=1}}

        同一个 ordinal 重复出现时，Anki 会把它们合并成一个 shapes 组。所以全部遮罩都写
        ``c1``：一张笔记 = 一个遮罩组 = **1 张卡**，画多少遮罩都不会多冒出卡来；若按遮罩
        递增写 ``c1``/``c2``/``c3``，一个 ordinal 一张卡，就又变回三张（Anki 实测）。
        """
        occlusions = str(payload.get("occlusions", "") or "").strip()
        image_html = str(payload.get("image", "") or "").strip()
        if not occlusions or not image_html:
            raise ValueError("Image occlusion payload requires both occlusions and image")

        header = str(payload.get("header", "") or "").strip()
        back_extra = str(payload.get("backExtra", "") or "").strip()

        model = self._resolve_image_occlusion_model(col)
        if model is None:
            raise ValueError("Image Occlusion notetype is unavailable in this collection")

        target_did = self._resolve_target_deck(col, deck_id_raw, deck_name)

        note = col.new_note(model)
        names = list(note.keys())
        try:
            idx = col.get_image_occlusion_fields(int(model["id"]))
            field_map = {
                int(idx.occlusions): occlusions,
                int(idx.image): image_html,
                int(idx.header): header,
                int(idx.back_extra): back_extra,
            }
        except Exception:
            # 老版本 Anki 没有这个查询接口时按原生卡型的固定字段顺序兜底。
            field_map = {0: occlusions, 1: image_html, 2: header, 3: back_extra}

        for field_idx, value in field_map.items():
            if 0 <= field_idx < len(names):
                note[names[field_idx]] = normalize_media_html_for_storage(value, media_dir)
        note.tags = list(tags)

        col.add_note(note, target_did)
        cids = [str(cid) for cid in note.card_ids()]
        return {
            "created": True,
            "createdCount": len(cids),
            "noteId": str(note.id),
            "reverseNoteId": None,
            "cardIds": cids,
            "cardId": cids[0] if cids else str(note.id),
            "deckId": str(target_did),
            "imageOcclusion": True,
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

        col = self.col
        if col is None:
            # Never mint a fake timestamp ID: the note does not exist in Anki and
            # would disappear (or collide) on the next refresh.
            return {"created": False, "error": "Collection unavailable"}

        media_dir = get_media_dir(col)

        # 图片遮挡走原生 IO 卡型，不经过 Cloze 分支（否则一个遮罩出一张卡）。
        io_payload = data.get("imageOcclusion")
        if isinstance(io_payload, dict):
            return self._quick_add_image_occlusion(
                col, io_payload, tags, deck_id_raw, deck_name, media_dir
            )

        if not front:
            raise ValueError("Card front content cannot be empty")

        front = normalize_media_html_for_storage(front, media_dir)
        back = normalize_media_html_for_storage(back, media_dir)

        target_did = self._resolve_target_deck(col, deck_id_raw, deck_name)

        fields_payload = data.get("fields") if isinstance(data.get("fields"), dict) else {}
        cloze_in_payload = _find_cloze_field_names(
            [("front", front), ("back", back)] + [(str(k), v) for k, v in fields_payload.items()]
        )
        is_cloze = bool(cloze_in_payload)
        all_models = self._all_models_with_companions(col)
        req_model = self._find_model_by_id_or_name(col, requested_model_id, requested_model_name)
        model = None

        # 1. Explicit model selection:
        #    - Standard card: honor requested model directly.
        #    - Cloze card on a type==1 model: honor it directly.
        #    - Cloze card on a custom type==0 model: resolve/create companion "(Cloze)" model preserving fields & CSS.
        if req_model is not None:
            if not is_cloze:
                model = req_model
            elif not _is_image_occlusion_model(req_model):
                if int(req_model.get("type", 0) or 0) == 1:
                    model = req_model
                elif not self._is_stock_basic_model(req_model):
                    req_flds = [
                        str(f.get("name", ""))
                        for f in (req_model.get("flds") or [])
                        if isinstance(f, dict)
                    ]
                    mapped_fields: Dict[str, Any] = {}
                    if req_flds:
                        mapped_fields[req_flds[0]] = front
                    if len(req_flds) > 1:
                        mapped_fields[req_flds[1]] = back
                    for fk, fv in fields_payload.items():
                        mapped_fields[str(fk)] = fv
                    req_cloze_fields = _find_cloze_field_names(mapped_fields.items()) or (
                        [req_flds[0]] if req_flds else []
                    )
                    companion = self._ensure_companion_cloze_model(col, req_model, req_cloze_fields)
                    if companion is not None:
                        model = companion

        # 2. Fallback automatic model selection
        if model is None and is_cloze and req_model is None:
            current_m = (
                col.models.current()
                if (hasattr(col, "models") and hasattr(col.models, "current"))
                else None
            )
            if (
                isinstance(current_m, dict)
                and int(current_m.get("type", 0) or 0) == 0
                and not _is_image_occlusion_model(current_m)
                and not self._is_stock_basic_model(current_m)
                and fields_payload
            ):
                cur_flds = [
                    str(f.get("name", ""))
                    for f in (current_m.get("flds") or [])
                    if isinstance(f, dict)
                ]
                if any(k in cur_flds for k in fields_payload):
                    mapped_fields = {}
                    if cur_flds:
                        mapped_fields[cur_flds[0]] = front
                    if len(cur_flds) > 1:
                        mapped_fields[cur_flds[1]] = back
                    for fk, fv in fields_payload.items():
                        mapped_fields[str(fk)] = fv
                    cur_cloze_fields = _find_cloze_field_names(mapped_fields.items()) or (
                        [cur_flds[0]] if cur_flds else []
                    )
                    model = self._ensure_companion_cloze_model(col, current_m, cur_cloze_fields)

        if model is None:
            prioritized_models = [
                m for m in all_models if not m.get("anki_studio_companion_of")
            ] + [m for m in all_models if m.get("anki_studio_companion_of")]
            for m in prioritized_models:
                if is_cloze and m.get("type") == 1 and not _is_image_occlusion_model(m):
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
        if fields_payload:
            for k, v in fields_payload.items():
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
            "notetypeId": str((model or {}).get("id") or getattr(note, "mid", "") or ""),
            "noteTypeName": str((model or {}).get("name") or ""),
            "isCloze": bool((model or {}).get("type") == 1),
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
