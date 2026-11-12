# -*- coding: utf-8 -*-
"""
Anki Studio — Global Search (Cmd+K) & Faceted Library Service
Provides fast fuzzy search, rich HTML & media preservation, accurate due/review status classification,
offset/limit pagination (breaking the 500-card ceiling), and batch floating bar operations
(suspend, unsuspend, custom tags, reset progress, move deck, batch delete).
"""

from __future__ import annotations

import html
import json
import re
import time
import urllib.parse
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .media_utils import (
    get_media_dir,
    render_native_card_html,
    render_native_image_occlusion,
    resolve_media_img_src_for_webview,
)


SOUND_TAG_RE = re.compile(r"\[sound:([^\]]+)\]")
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
            return {
                "cards": [],
                "total": 0,
                "collectionTotal": 0,
                "filteredCount": 0,
                "facetCounts": None,
                "hasMore": False,
                "allTags": [],
            }

        raw_q = str(data.get("query", "")).strip()
        status = data.get("status", "all")
        tag = data.get("tag")
        deck_id = data.get("deckId")
        flag_filter_raw = str(data.get("flag", "all") or "all").strip()
        difficulty_filter = data.get("difficulty", "all")
        sort_by = str(data.get("sortBy", "default") or "default").strip()
        include_facets = bool(data.get("includeFacets", True))

        collection_total = self._get_collection_total(col)
        anki_query = self._build_anki_search_query(
            col,
            raw_q=raw_q,
            status=status,
            tag=tag,
            deck_id=deck_id,
            flag=flag_filter_raw,
        )
        offset = max(0, int(data.get("offset") or 0))
        limit = max(1, int(data.get("limit") or 200))

        try:
            cids = list(col.find_cards(anki_query))
        except Exception as e:
            # A malformed query must never silently return the whole collection
            # as if it were a filtered result set.
            return {
                "total": 0,
                "collectionTotal": collection_total,
                "filteredCount": 0,
                "facetCounts": None,
                "offset": offset,
                "limit": limit,
                "hasMore": False,
                "cards": [],
                "allTags": [],
                "error": str(e),
            }

        media_dir = get_media_dir(col)

        cards_out: List[Dict[str, Any]] = []
        matched_index = 0
        has_more = False
        is_completed_query = (status == "completed")
        has_python_post_filter = (
            difficulty_filter in ("high", "medium", "low")
            or flag_filter_raw != "all"
            or sort_by != "default"
        )

        all_matched_items: List[Dict[str, Any]] = []

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
            if flag_filter_raw == "flagged" and int(item.get("flags", 0)) <= 0:
                continue
            if flag_filter_raw in ("0", "1", "2", "3", "4", "5", "6", "7") and int(item.get("flags", 0)) != int(flag_filter_raw):
                continue

            if sort_by != "default":
                all_matched_items.append(item)
            else:
                if matched_index >= offset:
                    if len(cards_out) < limit:
                        cards_out.append(item)
                    else:
                        has_more = True
                        if not has_python_post_filter:
                            break
            matched_index += 1

        if sort_by != "default":
            if sort_by == "lapses_desc":
                all_matched_items.sort(
                    key=lambda x: (-int(x.get("lapses", 0)), int(x.get("intervalDays", 0)), int(x.get("id", 0)))
                )
            elif sort_by == "ivl_asc":
                all_matched_items.sort(
                    key=lambda x: (int(x.get("intervalDays", 0)), -int(x.get("lapses", 0)), int(x.get("id", 0)))
                )
            elif sort_by == "ivl_desc":
                all_matched_items.sort(
                    key=lambda x: (-int(x.get("intervalDays", 0)), int(x.get("id", 0)))
                )
            elif sort_by == "due_asc":
                all_matched_items.sort(
                    key=lambda x: (
                        0 if x.get("status") == "due" else (1 if x.get("status") == "review" else 2),
                        int(x.get("dueRaw", 999999)),
                        int(x.get("id", 0)),
                    )
                )
            elif sort_by == "stability_asc":
                all_matched_items.sort(
                    key=lambda x: (int(x.get("mastery", 0)), float(x.get("stability", 0.0)), int(x.get("id", 0)))
                )
            elif sort_by == "front_asc":
                all_matched_items.sort(
                    key=lambda x: (str(x.get("front", "")).lower(), int(x.get("id", 0)))
                )
            elif sort_by == "newest":
                all_matched_items.sort(key=lambda x: -int(x.get("id", 0)))

            cards_out = all_matched_items[offset : offset + limit]
            has_more = (offset + len(cards_out)) < len(all_matched_items)

        total_filtered = len(cids) if not has_python_post_filter else matched_index
        all_tags = list(col.tags.all()) if hasattr(col, "tags") else []
        facet_counts = (
            self._compute_facet_counts(
                col=col,
                cids=cids,
                raw_q=raw_q,
                status=status,
                difficulty_filter=difficulty_filter,
                flag_filter_raw=flag_filter_raw,
                tag=tag,
                deck_id=deck_id,
            )
            if include_facets
            else None
        )

        return {
            "total": len(cids),
            "collectionTotal": collection_total,
            "filteredCount": total_filtered,
            "facetCounts": facet_counts,
            "offset": offset,
            "limit": limit,
            "hasMore": has_more or (offset + len(cards_out) < total_filtered),
            "cards": cards_out,
            "allTags": all_tags[:150],
        }

    @staticmethod
    def _get_collection_total(col) -> int:
        try:
            if hasattr(col, "card_count"):
                return int(col.card_count())
            if hasattr(col, "find_cards"):
                return len(list(col.find_cards("")))
        except Exception:
            pass
        return 0

    @staticmethod
    def _safe_find_cards(col, query: str) -> List[int]:
        try:
            return list(col.find_cards(query))
        except Exception:
            return []

    @staticmethod
    def _build_anki_search_query(
        col,
        raw_q: str = "",
        status: str = "all",
        tag: Any = "all",
        deck_id: Any = "all",
        flag: str = "all",
    ) -> str:
        query_parts: List[str] = []
        if raw_q:
            query_parts.append(raw_q)

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

        if tag and tag != "all":
            escaped_tag = str(tag).replace('"', '\\"')
            query_parts.append(f'tag:"{escaped_tag}"')

        if deck_id and deck_id != "all" and str(deck_id).isdigit():
            deck_obj = col.decks.get(int(deck_id), default=False)
            if deck_obj:
                escaped_deck = deck_obj["name"].replace('"', '\\"')
                query_parts.append(f'deck:"{escaped_deck}"')

        flag_str = str(flag or "all").strip()
        if flag_str == "flagged":
            query_parts.append("-flag:0")
        elif flag_str in ("0", "1", "2", "3", "4", "5", "6", "7"):
            query_parts.append(f"flag:{flag_str}")

        return " ".join(query_parts).strip()

    @staticmethod
    def _resolve_difficulty_level(difficulty_val: float, lapses: int) -> str:
        if difficulty_val >= 6.5 or lapses >= 2:
            return "high"
        if difficulty_val >= 4.0:
            return "medium"
        return "low"

    def _load_card_facet_meta(
        self, col, fallback_cids: List[int]
    ) -> Tuple[Dict[int, str], Dict[int, int], Dict[int, List[str]]]:
        """
        Loads per-card (difficultyLevel, flags, tags) in a single SQL scan for fast
        facet counting across the whole collection, falling back to col.get_card()
        for in-memory mock collections used in unit tests.
        """
        diff_by_cid: Dict[int, str] = {}
        flags_by_cid: Dict[int, int] = {}
        tags_by_cid: Dict[int, List[str]] = {}

        if not hasattr(col, "_cards") and hasattr(col, "db") and hasattr(col.db, "all"):
            try:
                rows = col.db.all(
                    "SELECT c.id, c.flags, c.lapses, c.data, n.tags "
                    "FROM cards c LEFT JOIN notes n ON c.nid = n.id"
                )
                for row in rows:
                    cid = int(row[0])
                    flags_val = int(row[1] or 0) & 7
                    lapses_val = int(row[2] or 0)
                    data_raw = row[3] or ""
                    tags_raw = row[4] or ""

                    diff_val: Optional[float] = None
                    if data_raw and isinstance(data_raw, str) and data_raw.lstrip().startswith("{"):
                        try:
                            parsed = json.loads(data_raw)
                            d_raw = parsed.get("d") if isinstance(parsed, dict) else None
                            if isinstance(d_raw, (int, float)) and float(d_raw) > 0:
                                diff_val = float(d_raw)
                        except Exception:
                            diff_val = None
                    if diff_val is None:
                        diff_val = 7.5 if lapses_val > 1 else 4.8

                    diff_by_cid[cid] = self._resolve_difficulty_level(diff_val, lapses_val)
                    flags_by_cid[cid] = flags_val
                    tags_by_cid[cid] = [t for t in str(tags_raw).split() if t]
                return diff_by_cid, flags_by_cid, tags_by_cid
            except Exception:
                pass

        for cid in set(fallback_cids):
            try:
                card = col.get_card(int(cid))
                note = col.get_note(card.nid) if hasattr(col, "get_note") else card.note()
                memory = getattr(card, "memory_state", None)
                lapses_val = int(getattr(card, "lapses", 0) or 0)
                diff_val = (
                    float(memory.difficulty)
                    if memory and hasattr(memory, "difficulty")
                    else (7.5 if lapses_val > 1 else 4.8)
                )
                diff_by_cid[int(cid)] = self._resolve_difficulty_level(diff_val, lapses_val)
                flags_by_cid[int(cid)] = int(getattr(card, "flags", 0) or 0) & 7
                tags_by_cid[int(cid)] = list(getattr(note, "tags", []) or [])
            except Exception:
                continue

        return diff_by_cid, flags_by_cid, tags_by_cid

    def _compute_facet_counts(
        self,
        col,
        cids: List[int],
        raw_q: str,
        status: str,
        difficulty_filter: str,
        flag_filter_raw: str,
        tag: Any,
        deck_id: Any,
    ) -> Dict[str, Any]:
        """
        Computes cross-faceted dropdown counts across the entire matching Anki collection
        (not capped at pagination limit) so every dropdown count matches the exact result count.
        """
        status_cids_by_key: Dict[str, List[int]] = {}
        for st_key in ("all", "due", "new", "completed", "review", "suspended", "buried"):
            if st_key == status:
                status_cids_by_key[st_key] = cids
            else:
                st_query = self._build_anki_search_query(
                    col, raw_q=raw_q, status=st_key, tag=tag, deck_id=deck_id, flag=flag_filter_raw
                )
                status_cids_by_key[st_key] = self._safe_find_cards(col, st_query)

        no_flag_cids = (
            cids
            if flag_filter_raw == "all"
            else self._safe_find_cards(
                col,
                self._build_anki_search_query(
                    col, raw_q=raw_q, status=status, tag=tag, deck_id=deck_id, flag="all"
                ),
            )
        )
        no_tag_cids = (
            cids
            if (not tag or tag == "all")
            else self._safe_find_cards(
                col,
                self._build_anki_search_query(
                    col, raw_q=raw_q, status=status, tag="all", deck_id=deck_id, flag=flag_filter_raw
                ),
            )
        )

        fallback_pool = list(cids) + list(no_flag_cids) + list(no_tag_cids)
        if difficulty_filter in ("high", "medium", "low"):
            for st_cids in status_cids_by_key.values():
                fallback_pool.extend(st_cids)

        diff_by_cid, flags_by_cid, tags_by_cid = self._load_card_facet_meta(col, fallback_pool)

        has_diff = difficulty_filter in ("high", "medium", "low")

        status_counts: Dict[str, int] = {}
        for st_key, st_cids in status_cids_by_key.items():
            if has_diff:
                status_counts[st_key] = sum(
                    1 for cid in st_cids if diff_by_cid.get(int(cid)) == difficulty_filter
                )
            else:
                status_counts[st_key] = len(st_cids)

        difficulty_counts: Dict[str, int] = {"all": len(cids), "high": 0, "medium": 0, "low": 0}
        for cid in cids:
            lvl = diff_by_cid.get(int(cid), "medium")
            difficulty_counts[lvl] = difficulty_counts.get(lvl, 0) + 1

        flag_counts: Dict[str, int] = {
            "all": 0,
            "flagged": 0,
            "1": 0,
            "2": 0,
            "3": 0,
            "4": 0,
            "5": 0,
            "6": 0,
            "7": 0,
        }
        for cid in no_flag_cids:
            cid_int = int(cid)
            if has_diff and diff_by_cid.get(cid_int) != difficulty_filter:
                continue
            flag_counts["all"] += 1
            f_val = flags_by_cid.get(cid_int, 0) & 7
            if f_val > 0:
                flag_counts["flagged"] += 1
                f_key = str(f_val)
                flag_counts[f_key] = flag_counts.get(f_key, 0) + 1

        tag_counts: Dict[str, int] = {}
        tag_all_count = 0
        for cid in no_tag_cids:
            cid_int = int(cid)
            if has_diff and diff_by_cid.get(cid_int) != difficulty_filter:
                continue
            tag_all_count += 1
            for tg in set(tags_by_cid.get(cid_int, ())):
                tag_counts[tg] = tag_counts.get(tg, 0) + 1

        return {
            "statusCounts": status_counts,
            "difficultyCounts": difficulty_counts,
            "flagCounts": flag_counts,
            "tagCounts": tag_counts,
            "tagAllCount": tag_all_count,
        }

    def batch_action(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes batch actions from the Library Floating Bar (Page 5 & Bug #10):
        - actionType: 'suspend' | 'unsuspend' | 'bury' | 'unbury' | 'setFlag' | 'addTag' | 'removeTag' | 'findReplace' | 'resetProgress' | 'moveDeck' | 'delete'
        - cardIds: list of card IDs
        """
        col = self.col
        action_type = data.get("actionType")
        card_ids = [int(cid) for cid in data.get("cardIds", []) if str(cid).isdigit()]

        if not col or not card_ids:
            return {
                "success": False,
                "affected": 0,
                "actionType": action_type,
                "error": "Collection unavailable or no valid card IDs",
            }

        if action_type == "suspend":
            col.sched.suspend_cards(card_ids)
        elif action_type == "unsuspend":
            col.sched.unsuspend_cards(card_ids)
        elif action_type == "bury":
            col.sched.bury_cards(card_ids, manual=True)
        elif action_type == "unbury":
            col.sched.unbury_cards(card_ids)
        elif action_type == "setFlag":
            try:
                flag_val = max(0, min(7, int(data.get("flag", 0) or 0)))
            except Exception:
                flag_val = 0
            try:
                if hasattr(col, "set_user_flag_for_cards"):
                    col.set_user_flag_for_cards(flag_val, card_ids)
            except Exception:
                pass
            for cid in card_ids:
                try:
                    c = col.get_card(int(cid))
                    if c is not None:
                        prev_f = int(getattr(c, "flags", 0) or 0)
                        c.flags = (prev_f & ~7) | (flag_val & 7)
                        if hasattr(col, "update_card"):
                            col.update_card(c)
                except Exception:
                    pass
                try:
                    if hasattr(col, "db") and hasattr(col.db, "conn"):
                        col.db.conn.execute(
                            "UPDATE cards SET flags = (coalesce(flags, 0) & ~7) | ? WHERE id = ?",
                            (flag_val & 7, int(cid)),
                        )
                        col.db.conn.commit()
                except Exception:
                    pass
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
        elif action_type == "removeTag":
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
                            if hasattr(n, "remove_tag"):
                                n.remove_tag(t)
                            if hasattr(n, "tags") and isinstance(n.tags, list):
                                n.tags = [x for x in n.tags if x != t]
                        notes.append(n)
                    except Exception:
                        pass
                if notes:
                    col.update_notes(notes)
        elif action_type == "findReplace":
            find_text = str(data.get("findText", "") or "")
            replace_text = str(data.get("replaceText", "") or "")
            field_scope = str(data.get("fieldScope", "all") or "all").strip()
            ignore_case = bool(data.get("ignoreCase", False))

            if not find_text:
                return {
                    "success": False,
                    "affected": 0,
                    "actionType": action_type,
                    "error": "Find text cannot be empty",
                }

            pattern = re.compile(re.escape(find_text), re.I if ignore_case else 0)
            nids = set()
            for cid in card_ids:
                try:
                    c = col.get_card(cid)
                    if c and getattr(c, "nid", None):
                        nids.add(int(c.nid))
                except Exception:
                    pass

            modified_notes = 0
            notes_to_update = []
            for nid in nids:
                try:
                    n = col.get_note(nid)
                    f_keys = list(n.keys())
                    if field_scope == "front" and f_keys:
                        target_keys = [f_keys[0]]
                    elif field_scope == "back" and len(f_keys) > 1:
                        target_keys = [f_keys[1]]
                    else:
                        target_keys = f_keys

                    changed = False
                    for fk in target_keys:
                        orig_val = str(n[fk] or "")
                        new_val = pattern.sub(replace_text, orig_val)
                        if new_val != orig_val:
                            n[fk] = new_val
                            changed = True
                    if changed:
                        modified_notes += 1
                        notes_to_update.append(n)
                        if hasattr(col, "update_note"):
                            col.update_note(n)
                except Exception:
                    pass
            if notes_to_update and hasattr(col, "update_notes"):
                try:
                    col.update_notes(notes_to_update)
                except Exception:
                    pass
            return {
                "success": True,
                "affected": len(card_ids),
                "modifiedNotes": modified_notes,
                "replacedCount": modified_notes,
                "actionType": action_type,
            }
        elif action_type == "resetProgress":
            try:
                from anki.scheduler.base import ScheduleCardsAsNew
                col._backend.schedule_cards_as_new(
                    ScheduleCardsAsNew(card_ids=card_ids, restore_position=True, reset_counts=True, log=True)
                )
            except Exception as e:
                return {
                    "success": False,
                    "affected": 0,
                    "actionType": action_type,
                    "error": str(e),
                }
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
        else:
            return {
                "success": False,
                "affected": 0,
                "actionType": action_type,
                "error": f"Unknown actionType: {action_type}",
            }

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

            # Anki 原生 Image Occlusion 的第一个字段是 Occlusion（SVG 覆盖层），
            # 底图在 Image 字段里。若按 flds[0] 直出，用户只会看到几个黑矩形。
            io_front, io_back, io_title = self._render_native_image_occlusion(note)
            native_audio: List[str] = []
            if io_front:
                front_raw, back_raw = io_front, io_back
                front_clean = io_title or ("图片遮挡" if lang == "zh-CN" else "Image Occlusion")
                back_clean = ""
            else:
                front_raw = flds[0] if flds else empty_title
                # 与复习界面同源：背面走 Anki 模板引擎，取 flds[1] 会丢掉拓展字段
                native_back, native_audio = render_native_card_html(card)
                back_raw = native_back or (flds[1] if len(flds) > 1 else "")
                front_clean = self._strip_html_for_summary(front_raw) or empty_title
                back_clean = self._strip_html_for_summary(back_raw)

            front_html, front_audio = self._rewrite_media_and_audio(front_raw, media_dir)
            back_html, back_audio = self._rewrite_media_and_audio(back_raw, media_dir)
            back_audio = native_audio + [a for a in back_audio if a not in native_audio]

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
            diff_level = self._resolve_difficulty_level(difficulty_val, int(card.lapses or 0))

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
                "dueRaw": int(getattr(card, "due", 0) or 0),
                "status": card_status,
                "suspended": card.queue == -1,
                "buried": card.queue in (-2, -3),
                "flags": int(getattr(card, "flags", 0) or 0) & 7,
                "reps": int(card.reps or 0),
                "lapses": int(getattr(card, "lapses", 0) or 0),
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
    def _render_native_image_occlusion(note):
        """薄委托：具体实现在 media_utils，供 search / review 两个服务共用。"""
        return render_native_image_occlusion(note)

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
            s = resolve_media_img_src_for_webview(s, media_dir)
        if "anki-io-rect" in s:
            s = re.sub(
                r'<span\b([^>]*?\bclass\s*=\s*["\'][^"\']*\banki-io-rect\b[^"\']*["\'][^>]*)>\s*\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}\s*</span>',
                lambda m: (
                    f'<span{m.group(1).rstrip()[:-1]};background:rgba(245,158,11,0.78);border:1.5px solid #FFFFFF;'
                    f'border-radius:4px;display:flex;align-items:center;justify-content:center;color:#FFFFFF;'
                    f'font-size:9px;font-weight:700;line-height:1;">#{m.group(2)}</span>'
                    if m.group(1).rstrip().endswith(('"', "'"))
                    else f'<span{m.group(1)}>#{m.group(2)}</span>'
                ),
                s,
                flags=re.I,
            )
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
