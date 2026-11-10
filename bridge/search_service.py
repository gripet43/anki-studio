# -*- coding: utf-8 -*-
"""
Anki Modern OS — Global Search (Cmd+K) & Faceted Library Service
Provides fast fuzzy search, rich HTML & media preservation, accurate due/review status classification,
offset/limit pagination (breaking the 500-card ceiling), and batch floating bar operations
(suspend, unsuspend, custom tags, reset progress, move deck, batch delete).
"""

from __future__ import annotations

import html
import re
import time
import urllib.parse
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


SOUND_TAG_RE = re.compile(r"\[sound:([^\]]+)\]")
IMG_SRC_RE = re.compile(r'(<img\b[^>]*?\bsrc\s*=\s*)(["\'])([^"\']+)(\2)', flags=re.I)
CLOZE_RE = re.compile(r"\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}")


class SearchService:
    """Service powering Raycast-style Cmd+K search and the multi-dimensional Card Library."""

    def __init__(self, col_getter, lang_getter: Optional[Callable[[], str]] = None):
        self._get_col = col_getter
        self._get_lang = lang_getter or (lambda: "zh-CN")

    @property
    def col(self):
        return self._get_col()

    def search_cards(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Searches cards using text query, structured facet pills, and offset/limit pagination (#14):
        - query: keyword string
        - status: 'all' | 'due' | 'new' | 'suspended' | 'review'
        - difficulty: 'all' | 'high' | 'medium' | 'low'
        - tag: tag name or 'all'
        - deckId: deck id or 'all'
        - offset: pagination start index (default 0)
        - limit: max cards per page (default 200)
        """
        data = data or {}
        col = self.col
        lang = data.get("language") or self._get_lang()
        if col is None:
            return {"cards": [], "total": 0, "filteredCount": 0, "hasMore": False, "allTags": []}

        query_parts: List[str] = []
        raw_q = str(data.get("query", "")).strip()
        if raw_q:
            query_parts.append(raw_q)

        status = data.get("status", "all")
        if status == "due":
            query_parts.append("(is:due OR is:learn) -is:suspended -is:buried")
        elif status == "new":
            query_parts.append("is:new -is:suspended -is:buried")
        elif status == "completed":
            query_parts.append("rated:1")
        elif status == "suspended":
            query_parts.append("is:suspended")
        elif status == "buried":
            query_parts.append("is:buried")
        elif status == "review":
            query_parts.append("is:review -is:due -is:suspended -is:buried")

        tag = data.get("tag")
        if tag and tag != "all":
            escaped_tag = str(tag).replace('"', '\\"')
            query_parts.append(f'tag:"{escaped_tag}"')

        deck_id = data.get("deckId")
        if deck_id and deck_id != "all" and str(deck_id).isdigit():
            deck_obj = col.decks.get(int(deck_id), default=False)
            if deck_obj:
                escaped_deck = deck_obj["name"].replace('"', '\\"')
                query_parts.append(f'deck:"{escaped_deck}"')

        anki_query = " ".join(query_parts).strip()
        offset = max(0, int(data.get("offset") or 0))
        limit = max(1, int(data.get("limit") or 200))

        try:
            cids = list(col.find_cards(anki_query))
        except Exception:
            cids = list(col.find_cards(""))

        difficulty_filter = data.get("difficulty", "all")
        media_dir = ""
        try:
            if hasattr(col, "media") and hasattr(col.media, "dir"):
                media_dir = str(col.media.dir() or "")
        except Exception:
            pass

        cards_out: List[Dict[str, Any]] = []
        matched_index = 0
        has_more = False
        is_completed_query = (status == "completed")

        for cid in cids:
            item = self._serialize_library_card(col, cid, media_dir, lang)
            if item is None:
                continue
            if is_completed_query:
                item["status"] = "completed"
                item["ratedToday"] = True
                item["dueText"] = "今日已完成" if lang == "zh-CN" else "Completed Today"
            if difficulty_filter in ("high", "medium", "low") and item["difficultyLevel"] != difficulty_filter:
                continue
            if matched_index >= offset:
                if len(cards_out) < limit:
                    cards_out.append(item)
                else:
                    has_more = True
                    if difficulty_filter == "all":
                        break
            matched_index += 1

        total_filtered = len(cids) if difficulty_filter == "all" else matched_index
        all_tags = list(col.tags.all()) if hasattr(col, "tags") else []

        return {
            "total": len(cids),
            "filteredCount": total_filtered,
            "offset": offset,
            "limit": limit,
            "hasMore": has_more or (offset + len(cards_out) < total_filtered),
            "cards": cards_out,
            "allTags": all_tags[:150],
        }

    def batch_action(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes batch actions from the Library Floating Bar (Page 5 & Bug #10):
        - actionType: 'suspend' | 'unsuspend' | 'addTag' | 'resetProgress' | 'moveDeck' | 'delete'
        - cardIds: list of card IDs
        """
        col = self.col
        action_type = data.get("actionType")
        card_ids = [int(cid) for cid in data.get("cardIds", []) if str(cid).isdigit()]

        if not col or not card_ids:
            return {"success": True, "affected": len(card_ids), "actionType": action_type}

        if action_type == "suspend":
            col.sched.suspend_cards(card_ids)
        elif action_type == "unsuspend":
            col.sched.unsuspend_cards(card_ids)
        elif action_type == "bury":
            col.sched.bury_cards(card_ids, manual=True)
        elif action_type == "unbury":
            col.sched.unbury_cards(card_ids)
        elif action_type == "delete":
            nids = set()
            for cid in card_ids:
                try:
                    c = col.get_card(cid)
                    if c and getattr(c, "nid", None):
                        nids.add(int(c.nid))
                except Exception:
                    pass
            if nids:
                col.remove_notes(list(nids))
        elif action_type == "addTag":
            raw_tags = str(data.get("tag", "")).strip()
            tag_list = [t.strip() for t in re.split(r"[\s,，]+", raw_tags) if t.strip()]
            if tag_list:
                nids = set()
                for cid in card_ids:
                    try:
                        c = col.get_card(cid)
                        if c and getattr(c, "nid", None):
                            nids.add(int(c.nid))
                    except Exception:
                        pass
                notes = []
                for nid in nids:
                    try:
                        n = col.get_note(nid)
                        for t in tag_list:
                            n.add_tag(t)
                        notes.append(n)
                    except Exception:
                        pass
                if notes:
                    col.update_notes(notes)
        elif action_type == "resetProgress":
            try:
                from anki.scheduler.base import ScheduleCardsAsNew
                col._backend.schedule_cards_as_new(
                    ScheduleCardsAsNew(card_ids=card_ids, restore_position=True, reset_counts=True, log=True)
                )
            except Exception:
                pass
        elif action_type == "moveDeck":
            target_did_raw = data.get("targetDeckId")
            target_deck_name = str(data.get("targetDeckName", "")).strip()
            resolved_did = None
            if target_did_raw and str(target_did_raw).isdigit():
                resolved_did = int(target_did_raw)
            elif target_deck_name:
                out = col.decks.add_normal_deck_with_name(target_deck_name)
                resolved_did = int(out.id)
            elif target_did_raw and str(target_did_raw).strip():
                out = col.decks.add_normal_deck_with_name(str(target_did_raw).strip())
                resolved_did = int(out.id)

            if resolved_did is not None:
                col.set_deck(card_ids, resolved_did)

        return {
            "success": True,
            "affected": len(card_ids),
            "actionType": action_type,
        }

    def _serialize_library_card(
        self, col, cid: int, media_dir: str = "", lang: str = "zh-CN"
    ) -> Optional[Dict[str, Any]]:
        try:
            card = col.get_card(int(cid))
            note = col.get_note(card.nid) if hasattr(col, "get_note") else card.note()
            deck = col.decks.get(card.did, default=False) or {"id": card.did, "name": "Default"}

            fields_dict = dict(note.items())
            flds = list(fields_dict.values())
            empty_title = "未命名" if lang == "zh-CN" else "Untitled"
            front_raw = flds[0] if flds else empty_title
            back_raw = flds[1] if len(flds) > 1 else ""

            front_clean = self._strip_html_for_summary(front_raw) or empty_title
            back_clean = self._strip_html_for_summary(back_raw)
            front_html, front_audio = self._rewrite_media_and_audio(front_raw, media_dir)
            back_html, back_audio = self._rewrite_media_and_audio(back_raw, media_dir)

            memory = getattr(card, "memory_state", None)
            stability = (
                round(float(memory.stability), 1)
                if memory and hasattr(memory, "stability")
                else float(max(1, card.ivl or 3))
            )
            difficulty_val = (
                float(memory.difficulty)
                if memory and hasattr(memory, "difficulty")
                else (7.5 if card.lapses > 1 else 4.8)
            )

            if difficulty_val >= 6.5 or card.lapses >= 2:
                diff_level = "high"
            elif difficulty_val >= 4.0:
                diff_level = "medium"
            else:
                diff_level = "low"

            mastery = min(98, max(0, round(min(stability / 25.0, 1.0) * 85 + (15 if card.reps > 0 else 0))))
            due_text = self._format_due_text(col, card, lang)

            # Bug #9 Fix: Accurately distinguish 'due' vs 'review' (future undue cards)
            card_status = self._determine_card_status(col, card)

            return {
                "id": str(card.id),
                "noteId": str(note.id),
                "deckId": str(deck["id"]),
                "deckName": deck["name"].split("::")[-1],
                "fullDeckName": deck["name"],
                "front": front_clean,
                "back": back_clean,
                "frontHtml": front_html,
                "backHtml": back_html,
                "audioFiles": front_audio + [a for a in back_audio if a not in front_audio],
                "fields": fields_dict,
                "tags": list(note.tags),
                "mastery": mastery,
                "stability": stability,
                "difficultyLevel": diff_level,
                "dueText": due_text,
                "status": card_status,
                "suspended": card.queue == -1,
                "buried": card.queue in (-2, -3),
                "reps": int(card.reps or 0),
                "intervalDays": int(card.ivl or 0),
            }
        except Exception:
            return None

    @staticmethod
    def _determine_card_status(col, card) -> str:
        """
        Status classification:
        - queue == -1 -> 'suspended' (已暂停)
        - queue in (-2, -3) -> 'buried' (已搁置)
        - type == 0 or queue == 0 -> 'new'
        - queue in (1, 3) (learning / day-learning) -> 'due'
        - queue == 2 and due <= col.sched.today -> 'due'
        - otherwise (already studied review card due in the future) -> 'review'
        """
        if card.queue == -1:
            return "suspended"
        if card.queue in (-2, -3):
            return "buried"
        if card.type == 0 or card.queue == 0:
            return "new"
        if card.queue in (1, 3):
            return "due"
        today = getattr(col.sched, "today", 0)
        if card.queue == 2 and int(getattr(card, "due", 0)) <= int(today):
            return "due"
        return "review"

    @staticmethod
    def _rewrite_media_and_audio(raw: str, media_dir: str):
        if not raw:
            return "", []
        audios: List[str] = []

        def _snd(m):
            fn = m.group(1).strip()
            if fn and fn not in audios:
                audios.append(fn)
            return ""

        s = SOUND_TAG_RE.sub(_snd, raw)
        if media_dir:
            def _img(m):
                prefix, quote, src, suffix = m.groups()
                sc = src.strip()
                if sc.startswith(("http://", "https://", "data:", "file://", "/")):
                    return m.group(0)
                p = Path(media_dir) / urllib.parse.unquote(sc)
                try:
                    uri = p.resolve().as_uri()
                except Exception:
                    uri = f"file://{p}"
                return f"{prefix}{quote}{uri}{suffix}"

            s = IMG_SRC_RE.sub(_img, s)
        s = CLOZE_RE.sub(lambda m: f'<span class="text-[#5E5CE6] font-semibold">{m.group(2)}</span>', s)
        return s.strip(), audios

    @staticmethod
    def _strip_html_for_summary(raw: str) -> str:
        if not raw:
            return ""
        text = SOUND_TAG_RE.sub("", raw)
        text = CLOZE_RE.sub(lambda m: m.group(2) or "", text)
        text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
        text = re.sub(r"<[^>]+>", "", text)
        return re.sub(r"\s+", " ", html.unescape(text)).strip()

    @staticmethod
    def _format_due_text(col, card, lang: str = "zh-CN") -> str:
        if card.queue == -1:
            return "已暂停" if lang == "zh-CN" else "Suspended"
        if card.queue in (-2, -3):
            return "已搁置" if lang == "zh-CN" else "Buried"
        if card.type == 0 or card.queue == 0:
            return "新卡片" if lang == "zh-CN" else "New"
        today = getattr(col.sched, "today", None)
        if today is not None and card.queue in (2, 3):
            diff = int(card.due - today)
            if diff <= 0:
                return "到期 今天" if lang == "zh-CN" else "Due Today"
            elif diff == 1:
                return "到期 明天" if lang == "zh-CN" else "Due Tomorrow"
            else:
                return f"到期 {diff} 天后" if lang == "zh-CN" else f"Due in {diff}d"
        ivl = max(1, int(card.ivl or 1))
        return f"到期 {ivl} 天后" if lang == "zh-CN" else f"Due in {ivl}d"
