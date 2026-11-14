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
    CLOZE_RE,
    convert_furigana_to_ruby,
    get_media_dir,
    is_custom_styled_cloze_model,
    plain_text_of,
    render_native_card_sides,
    render_native_image_occlusion,
    resolve_front_field_name,
    resolve_media_img_src_for_webview,
    resolve_replace_front_on_flip,
    restore_rendered_io_rects,
    split_card_side_audio,
    style_native_cloze_spans,
)


SOUND_TAG_RE = re.compile(r"\[sound:([^\]]+)\]")
CLOZE_RE = re.compile(r"\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}")

_STATUS_PRIORITY = {
    "due": 0,
    "completed": 1,
    "new": 2,
    "review": 3,
    "buried": 4,
    "suspended": 5,
}
_DIFF_RANK = {"high": 2, "medium": 1, "low": 0}


def _notetype_id(note) -> str:
    """稳妥地取卡型 id。

    真 Anki 的 Note 一定有 ``mid``；单元测试的桩只实现了 ``note_type()``，
    这里兜一层，免得为了一个展示用的 id 把整张卡的序列化搞崩。
    """
    mid = getattr(note, "mid", None)
    if mid is None:
        try:
            mid = (note.note_type() or {}).get("id")
        except Exception:
            mid = None
    return str(mid or 0)


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
        group_by_note = bool(data.get("groupByNote", True))

        collection_total = self._get_collection_total(col, group_by_note=group_by_note)
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
        # 每个卡型只留一份作用域化模板 CSS（Cmd+K 右侧预览要拿它还原卡包样式）。
        # 按卡带会把 200 条的搜索响应撑到几百 KB，而同一副牌里卡型通常只有一两种。
        card_styles: Dict[str, str] = {}
        # 正面与背面各一份模板 CSS：正面保留 display:none（隐藏详解/提示），
        # 背面揭开。Cmd+K 同时预览两面，因此必须按卡型各下发一份。
        card_front_styles: Dict[str, str] = {}
        matched_index = 0
        has_more = False
        is_completed_query = (status == "completed")
        has_python_post_filter = (
            difficulty_filter in ("high", "medium", "low")
            or flag_filter_raw != "all"
            or sort_by != "default"
        )

        # Compute facets cleanly with note-level deduplication when group_by_note=True
        # and reuse its SQL card index scan so zero redundant queries run.
        meta_index: Optional[Dict[str, Dict[int, Any]]] = None
        if include_facets:
            facet_counts, meta_index = self._compute_facet_counts(
                col=col,
                cids=cids,
                raw_q=raw_q,
                status=status,
                difficulty_filter=difficulty_filter,
                flag_filter_raw=flag_filter_raw,
                tag=tag,
                deck_id=deck_id,
                group_by_note=group_by_note,
                return_index=True,
            )
        else:
            facet_counts = None

        if group_by_note:
            if meta_index is None:
                meta_index = self._load_card_index_meta(col, cids)
            candidate_groups = self._group_cids_by_note(cids, meta_index)
            candidate_entries = [
                (self._pick_representative_cid(grp, meta_index), grp)
                for _, grp in candidate_groups
            ]
        else:
            candidate_entries = [(int(cid), [int(cid)]) for cid in cids]

        all_matched_items: List[Dict[str, Any]] = []

        if not has_python_post_filter:
            total_filtered = len(candidate_entries)
            page_entries = candidate_entries[offset : offset + limit]
            has_more = (offset + len(page_entries)) < total_filtered
            for rep_cid, matched_grp in page_entries:
                item = self._serialize_library_card(
                    col,
                    rep_cid,
                    media_dir,
                    lang,
                    card_styles,
                    card_front_styles,
                    matched_cids=matched_grp if group_by_note else None,
                )
                if item is None:
                    continue
                if is_completed_query:
                    item["status"] = "completed"
                    item["ratedToday"] = True
                    item["dueText"] = "今日已完成" if lang == "zh-CN" else "Completed Today"
                cards_out.append(item)
        else:
            for rep_cid, matched_grp in candidate_entries:
                item = self._serialize_library_card(
                    col,
                    rep_cid,
                    media_dir,
                    lang,
                    card_styles,
                    card_front_styles,
                    matched_cids=matched_grp if group_by_note else None,
                )
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

            total_filtered = matched_index

        all_tags = list(col.tags.all()) if hasattr(col, "tags") else []

        return {
            "total": len(cids),
            "collectionTotal": collection_total,
            "filteredCount": total_filtered,
            "facetCounts": facet_counts,
            "offset": offset,
            "limit": limit,
            "hasMore": has_more or (offset + len(cards_out) < total_filtered),
            "cards": cards_out,
            "cardStyles": card_styles,
            "cardFrontStyles": card_front_styles,
            "allTags": all_tags[:150],
        }

    @staticmethod
    def _get_collection_total(col, group_by_note: bool = True) -> int:
        try:
            if group_by_note:
                if not hasattr(col, "_cards") and hasattr(col, "db"):
                    if hasattr(col.db, "scalar"):
                        val = col.db.scalar("SELECT count(DISTINCT nid) FROM cards")
                        if val is not None:
                            return int(val)
                    if hasattr(col.db, "first"):
                        row = col.db.first("SELECT count(DISTINCT nid) FROM cards")
                        if row is not None:
                            return int(row[0] or 0)
                if hasattr(col, "_cards"):
                    return len(
                        {
                            int(getattr(c, "nid", c.id) or c.id)
                            for c in col._cards.values()
                        }
                    )
                if hasattr(col, "note_count"):
                    return int(col.note_count())
                if hasattr(col, "find_notes"):
                    return len(list(col.find_notes("")))
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

    def _load_card_index_meta(
        self, col, fallback_cids: List[int]
    ) -> Dict[str, Dict[int, Any]]:
        """Loads per-card (nid, ord, due, status, difficultyLevel, flags, tags) in one SQL scan."""
        nid_by_cid: Dict[int, int] = {}
        ord_by_cid: Dict[int, int] = {}
        due_by_cid: Dict[int, int] = {}
        status_by_cid: Dict[int, str] = {}
        diff_by_cid: Dict[int, str] = {}
        flags_by_cid: Dict[int, int] = {}
        tags_by_cid: Dict[int, List[str]] = {}
        today = int(getattr(getattr(col, "sched", None), "today", 0) or 0)

        if not hasattr(col, "_cards") and hasattr(col, "db") and hasattr(col.db, "all"):
            try:
                rows = col.db.all(
                    "SELECT c.id, c.nid, c.ord, c.type, c.queue, c.due, c.lapses, c.flags, c.data, n.tags "
                    "FROM cards c LEFT JOIN notes n ON c.nid = n.id"
                )
                for row in rows:
                    cid = int(row[0])
                    nid = int(row[1] or cid)
                    ord_val = int(row[2] or 0)
                    ctype_val = int(row[3] or 0)
                    queue_val = int(row[4] or 0)
                    due_val = int(row[5] or 0)
                    lapses_val = int(row[6] or 0)
                    flags_val = int(row[7] or 0) & 7
                    data_raw = row[8] or ""
                    tags_raw = row[9] or ""

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

                    nid_by_cid[cid] = nid
                    ord_by_cid[cid] = ord_val
                    due_by_cid[cid] = due_val
                    status_by_cid[cid] = self._determine_card_status_raw(
                        today, ctype_val, queue_val, due_val
                    )
                    diff_by_cid[cid] = self._resolve_difficulty_level(diff_val, lapses_val)
                    flags_by_cid[cid] = flags_val
                    tags_by_cid[cid] = [t for t in str(tags_raw).split() if t]
                return {
                    "nid": nid_by_cid,
                    "ord": ord_by_cid,
                    "due": due_by_cid,
                    "status": status_by_cid,
                    "diff": diff_by_cid,
                    "flags": flags_by_cid,
                    "tags": tags_by_cid,
                }
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
                cid_int = int(cid)
                nid_by_cid[cid_int] = int(getattr(card, "nid", None) or getattr(note, "id", cid_int) or cid_int)
                ord_by_cid[cid_int] = int(getattr(card, "ord", 0) or 0)
                due_by_cid[cid_int] = int(getattr(card, "due", 0) or 0)
                status_by_cid[cid_int] = self._determine_card_status(col, card)
                diff_by_cid[cid_int] = self._resolve_difficulty_level(diff_val, lapses_val)
                flags_by_cid[cid_int] = int(getattr(card, "flags", 0) or 0) & 7
                tags_by_cid[cid_int] = list(getattr(note, "tags", []) or [])
            except Exception:
                continue

        return {
            "nid": nid_by_cid,
            "ord": ord_by_cid,
            "due": due_by_cid,
            "status": status_by_cid,
            "diff": diff_by_cid,
            "flags": flags_by_cid,
            "tags": tags_by_cid,
        }

    def _load_card_facet_meta(
        self, col, fallback_cids: List[int]
    ) -> Tuple[Dict[int, str], Dict[int, int], Dict[int, List[str]]]:
        """Compatibility wrapper returning (diff_by_cid, flags_by_cid, tags_by_cid)."""
        meta = self._load_card_index_meta(col, fallback_cids)
        return meta["diff"], meta["flags"], meta["tags"]

    @staticmethod
    def _group_cids_by_note(
        cids: List[int], meta: Dict[str, Dict[int, Any]]
    ) -> List[Tuple[int, List[int]]]:
        """Group matching card IDs by note ID while preserving first-seen search order."""
        nid_map = meta["nid"]
        grouped: Dict[int, List[int]] = {}
        for raw_cid in cids:
            cid = int(raw_cid)
            nid = int(nid_map.get(cid, cid))
            bucket = grouped.get(nid)
            if bucket is None:
                grouped[nid] = [cid]
            else:
                bucket.append(cid)
        return list(grouped.items())

    @staticmethod
    def _pick_representative_cid(
        group_cids: List[int], meta: Dict[str, Dict[int, Any]]
    ) -> int:
        """Pick the most actionable sibling card in a note group (due > completed > new > review > buried > suspended)."""
        if len(group_cids) <= 1:
            return int(group_cids[0])
        status_map = meta["status"]
        due_map = meta["due"]
        ord_map = meta["ord"]
        return min(
            group_cids,
            key=lambda cid: (
                _STATUS_PRIORITY.get(status_map.get(int(cid), "review"), 3),
                int(due_map.get(int(cid), 0)),
                int(ord_map.get(int(cid), 0)),
                int(cid),
            ),
        )

    @staticmethod
    def _note_group_facets(
        group_cids: List[int], meta: Dict[str, Dict[int, Any]]
    ) -> Tuple[str, int, List[str]]:
        """Aggregate (difficultyLevel, flag, tags) for a note group consistently with serialized rows."""
        diff_map = meta["diff"]
        flags_map = meta["flags"]
        tags_map = meta["tags"]
        note_diff = max(
            (diff_map.get(int(c), "medium") for c in group_cids),
            key=lambda d: _DIFF_RANK.get(d, 1),
            default="medium",
        )
        note_flag = next(
            (flags_map.get(int(c), 0) & 7 for c in group_cids if (flags_map.get(int(c), 0) & 7) > 0),
            0,
        )
        note_tags = list(tags_map.get(int(group_cids[0]), ()))
        return note_diff, note_flag, note_tags

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
        group_by_note: bool = True,
        return_index: bool = False,
    ) -> Any:
        """
        Computes cross-faceted dropdown counts across the entire matching Anki collection
        (note-deduplicated when group_by_note=True so counts match grouped Library rows 1:1).
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
        if difficulty_filter in ("high", "medium", "low") or group_by_note:
            for st_cids in status_cids_by_key.values():
                fallback_pool.extend(st_cids)

        meta = self._load_card_index_meta(col, fallback_pool)
        diff_by_cid = meta["diff"]
        flags_by_cid = meta["flags"]
        tags_by_cid = meta["tags"]
        has_diff = difficulty_filter in ("high", "medium", "low")

        def iter_facet_units(unit_cids: List[int]):
            if not group_by_note:
                for raw_c in unit_cids:
                    c_int = int(raw_c)
                    yield (
                        diff_by_cid.get(c_int, "medium"),
                        flags_by_cid.get(c_int, 0) & 7,
                        tags_by_cid.get(c_int, ()),
                    )
                return
            for _, grp in self._group_cids_by_note(unit_cids, meta):
                yield self._note_group_facets(grp, meta)

        status_counts: Dict[str, int] = {}
        for st_key, st_cids in status_cids_by_key.items():
            if has_diff:
                status_counts[st_key] = sum(
                    1 for u_diff, _, _ in iter_facet_units(st_cids) if u_diff == difficulty_filter
                )
            else:
                status_counts[st_key] = (
                    len(self._group_cids_by_note(st_cids, meta)) if group_by_note else len(st_cids)
                )

        current_units = list(iter_facet_units(cids))
        difficulty_counts: Dict[str, int] = {"all": len(current_units), "high": 0, "medium": 0, "low": 0}
        for u_diff, _, _ in current_units:
            difficulty_counts[u_diff] = difficulty_counts.get(u_diff, 0) + 1

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
        for u_diff, u_flag, _ in iter_facet_units(no_flag_cids):
            if has_diff and u_diff != difficulty_filter:
                continue
            flag_counts["all"] += 1
            if u_flag > 0:
                flag_counts["flagged"] += 1
                f_key = str(u_flag)
                flag_counts[f_key] = flag_counts.get(f_key, 0) + 1

        tag_counts: Dict[str, int] = {}
        tag_all_count = 0
        for u_diff, _, u_tags in iter_facet_units(no_tag_cids):
            if has_diff and u_diff != difficulty_filter:
                continue
            tag_all_count += 1
            for tg in set(u_tags):
                tag_counts[tg] = tag_counts.get(tg, 0) + 1

        out = {
            "statusCounts": status_counts,
            "difficultyCounts": difficulty_counts,
            "flagCounts": flag_counts,
            "tagCounts": tag_counts,
            "tagAllCount": tag_all_count,
        }
        return (out, meta) if return_index else out

    @staticmethod
    def _expand_note_card_ids(col, card_ids: List[int]) -> List[int]:
        """Expand representative card IDs to all sibling card IDs on their notes, preserving order."""
        seen = set()
        expanded: List[int] = []
        for raw_cid in card_ids:
            cid = int(raw_cid)
            siblings: List[int] = [cid]
            try:
                card = col.get_card(cid)
                note = col.get_note(card.nid) if hasattr(col, "get_note") else card.note()
                if note is not None and hasattr(note, "card_ids"):
                    raw_sibs = [int(x) for x in note.card_ids()]
                    if raw_sibs:
                        siblings = []
                        for scid in raw_sibs:
                            try:
                                sc = col.get_card(scid)
                                if int(getattr(sc, "nid", note.id) or note.id) == int(note.id):
                                    siblings.append(scid)
                            except Exception:
                                continue
                        if cid not in siblings:
                            siblings.insert(0, cid)
            except Exception:
                pass
            for scid in siblings:
                if scid not in seen:
                    seen.add(scid)
                    expanded.append(scid)
        return expanded

    def batch_action(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes batch actions from the Library Floating Bar (Page 5 & Bug #10):
        - actionType: 'suspend' | 'unsuspend' | 'bury' | 'unbury' | 'setFlag' | 'addTag' | 'removeTag' | 'findReplace' | 'resetProgress' | 'moveDeck' | 'delete'
        - cardIds: list of card IDs
        - applyToNote: default True — expand card-level actions to all siblings of selected notes
        """
        col = self.col
        action_type = data.get("actionType")
        raw_card_ids = [int(cid) for cid in data.get("cardIds", []) if str(cid).isdigit()]

        if not col or not raw_card_ids:
            return {
                "success": False,
                "affected": 0,
                "actionType": action_type,
                "error": "Collection unavailable or no valid card IDs",
            }

        apply_to_note = bool(data.get("applyToNote", True))
        card_ids = (
            self._expand_note_card_ids(col, raw_card_ids)
            if apply_to_note
            else raw_card_ids
        )

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

    @classmethod
    def _compute_card_memory_metrics(cls, card) -> Tuple[float, str, int]:
        """Return (stability, difficultyLevel, mastery) for any Anki Card or MockCard."""
        memory = getattr(card, "memory_state", None)
        ivl = int(getattr(card, "ivl", 0) or 0)
        lapses = int(getattr(card, "lapses", 0) or 0)
        reps = int(getattr(card, "reps", 0) or 0)
        stability = (
            round(float(memory.stability), 1)
            if memory and hasattr(memory, "stability")
            else float(max(1, ivl or 3))
        )
        difficulty_val = (
            float(memory.difficulty)
            if memory and hasattr(memory, "difficulty")
            else (7.5 if lapses > 1 else 4.8)
        )
        diff_level = cls._resolve_difficulty_level(difficulty_val, lapses)
        mastery = min(98, max(0, round(min(stability / 25.0, 1.0) * 85 + (15 if reps > 0 else 0))))
        return stability, diff_level, mastery

    def _serialize_library_card(
        self,
        col,
        cid: int,
        media_dir: str = "",
        lang: str = "zh-CN",
        style_sink: Optional[Dict[str, str]] = None,
        front_style_sink: Optional[Dict[str, str]] = None,
        matched_cids: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        try:
            card = col.get_card(int(cid))
            note = col.get_note(card.nid) if hasattr(col, "get_note") else card.note()
            deck = col.decks.get(card.did, default=False) or {"id": card.did, "name": "Default"}

            fields_dict = dict(note.items())
            flds = list(fields_dict.values())
            model_id = _notetype_id(note)
            model = None
            try:
                model = note.note_type() if hasattr(note, "note_type") else None
            except Exception:
                model = None
            is_cloze = bool(
                isinstance(model, dict) and int(model.get("type", 0) or 0) == 1
            )
            empty_title = "未命名" if lang == "zh-CN" else "Untitled"

            # Anki 原生 Image Occlusion 的第一个字段是 Occlusion（SVG 覆盖层），
            # 底图在 Image 字段里。若按 flds[0] 直出，用户只会看到几个黑矩形。
            io_front, io_back, io_title = self._render_native_image_occlusion(note)
            native = None
            if io_front:
                front_raw, back_raw = io_front, io_back
                front_clean = io_title or ("图片遮挡" if lang == "zh-CN" else "Image Occlusion")
                back_clean = ""
            else:
                # 与复习界面同源：背面走 Anki 模板引擎，取 flds[1] 会丢掉拓展字段。
                # 列表本身不塞 <style>——几十张卡各带一份既浪费也会互相串味；
                # 样式统一收进 cardStyles，由真正需要还原卡包外观的地方（Cmd+K 预览）注入。
                try:
                    _note_obj = card.note() if hasattr(card, "note") else None
                    _lib_model = (
                        _note_obj.note_type()
                        if _note_obj is not None and hasattr(_note_obj, "note_type")
                        else None
                    ) or {}
                except Exception:
                    _lib_model = {}
                _lib_is_cloze = int(_lib_model.get("type", 0) or 0) == 1
                _use_custom_cloze = bool(
                    _lib_is_cloze and is_custom_styled_cloze_model(_lib_model)
                )

                native = render_native_card_sides(card, media_dir)
                if native.css and style_sink is not None:
                    style_sink.setdefault(model_id, native.css)
                if native.question_css and front_style_sink is not None:
                    front_style_sink.setdefault(model_id, native.question_css)
                # 正面也不能盲取 flds[0]：eggrolls-JLPT10k 把它排在 NoteID 上，
                # 列表里就成了一串 uuid。挑“模板正面真正显示的那个字段”。
                front_key = (
                    resolve_front_field_name(fields_dict, native.question, card)
                    if native.question
                    else (next(iter(fields_dict), "") if fields_dict else "")
                )
                if (
                    _lib_is_cloze
                    and fields_dict
                    and not CLOZE_RE.search(fields_dict.get(front_key, "") or "")
                ):
                    cloze_key = next(
                        (
                            k
                            for k, v in fields_dict.items()
                            if CLOZE_RE.search(str(v or ""))
                        ),
                        "",
                    )
                    if cloze_key:
                        front_key = cloze_key
                front_raw = fields_dict.get(front_key) or empty_title
                back_raw = native.answer or (flds[1] if len(flds) > 1 else "")
                if _use_custom_cloze and native and native.question and back_raw:
                    back_raw = style_native_cloze_spans(
                        back_raw, is_question_side=False
                    )
                if "Tiếng Việt" in fields_dict and fields_dict["Tiếng Việt"].strip():
                    tv_val = fields_dict["Tiếng Việt"].strip()
                    pa_val = fields_dict.get("Phiên âm", "").strip()
                    if 'class="Tiếng Việt"' not in (back_raw or "") and "class='Tiếng Việt'" not in (back_raw or ""):
                        header_parts = []
                        if pa_val:
                            header_parts.append(f'<div class="Phiên âm">{pa_val}</div>')
                        header_parts.append(f'<div class="Tiếng Việt"><b>{tv_val}</b></div>')
                        back_raw = "".join(header_parts) + (back_raw or "")
                picked_clean = self._strip_html_for_summary(fields_dict.get(front_key, "")) if front_key else ""
                rendered_q_body = re.sub(
                    r'<div\b[^>]*\bclass\s*=\s*["\']?header["\']?[^>]*>[\s\S]*?</div\s*>',
                    "",
                    native.question or "",
                    flags=re.I,
                )
                rendered_q_clean = self._strip_html_for_summary(rendered_q_body)
                sfld_clean = self._strip_html_for_summary(str(getattr(note, "sfld", "") or ""))
                # 优先使用模板正面匹配出的非元数据字段文本或渲染正面文本，sfld 仅在两者均为空时作兜底
                if picked_clean and front_key.strip().lower() not in {"noteid", "note id", "id", "guid", "uuid", "link", "level"}:
                    front_clean = picked_clean
                elif rendered_q_clean:
                    front_clean = rendered_q_clean
                elif sfld_clean:
                    front_clean = sfld_clean
                else:
                    front_clean = empty_title
                back_clean = self._strip_html_for_summary(back_raw)

            show_front_ruby = "<ruby" in (native.question if native else "").lower()
            use_native_q_in_search = bool(
                not io_front
                and native
                and native.question
                and front_clean
                and (
                    front_clean in plain_text_of(native.question)
                    or front_clean.lstrip("～〜~- ").strip() in plain_text_of(native.question)
                )
                and "<" in native.question
            )
            _use_custom_cloze_q = False
            if not io_front and native and native.question:
                try:
                    _q_note = card.note() if hasattr(card, "note") else None
                    _q_model = (
                        _q_note.note_type()
                        if _q_note is not None and hasattr(_q_note, "note_type")
                        else None
                    ) or {}
                    _use_custom_cloze_q = bool(is_custom_styled_cloze_model(_q_model))
                except Exception:
                    _use_custom_cloze_q = False

            front_html_source = (
                style_native_cloze_spans(native.question, is_question_side=True)
                if _use_custom_cloze_q
                else (native.question if use_native_q_in_search else front_raw)
            )
            front_html, front_audio = self._rewrite_media_and_audio(
                front_html_source,
                media_dir,
                strip_furigana_reading=(not show_front_ruby and bool(native and native.question)),
            )
            if native and native.question and not io_front and not use_native_q_in_search:
                hdr_m = re.search(
                    r'<div\b[^>]*\bclass\s*=\s*["\']?header["\']?[^>]*>([\s\S]*?)</div\s*>',
                    native.question,
                    flags=re.I,
                )
                if hdr_m:
                    hdr_plain = plain_text_of(hdr_m.group(1))
                    if hdr_plain and hdr_plain != front_clean and hdr_plain not in front_clean:
                        front_html = (
                            f'<div class="text-[12px] font-medium text-[#8E8E93] mb-1">'
                            f"{html.escape(hdr_plain)}</div>{front_html}"
                        )
            back_html, back_audio = self._rewrite_media_and_audio(
                back_raw, media_dir, reveal_io_masks=True
            )
            # 模板渲染已经把 [sound:] 剥进 answer_av_tags，这里补回来并区分正反两面
            answer_audio = native.answer_audio if native else []
            question_audio = native.question_audio if native else []
            front_audio_out, back_audio_out, merged_audio = split_card_side_audio(
                question_audio,
                front_audio,
                answer_audio,
                back_audio,
            )

            stability, diff_level, mastery = self._compute_card_memory_metrics(card)
            due_text = self._format_due_text(col, card, lang)

            # Bug #9 Fix: Accurately distinguish 'due' vs 'review' (future undue cards)
            card_status = self._determine_card_status(col, card)
            reps_total = int(card.reps or 0)
            lapses_total = int(getattr(card, "lapses", 0) or 0)
            interval_days = int(card.ivl or 0)
            flags_val = int(getattr(card, "flags", 0) or 0) & 7

            # Sibling card aggregation across the note (for multi-cloze / reversed notes)
            raw_note_cids = (
                [int(x) for x in note.card_ids()]
                if hasattr(note, "card_ids")
                else [int(card.id)]
            )
            if int(card.id) not in raw_note_cids:
                raw_note_cids.insert(0, int(card.id))

            real_siblings = []
            for scid in raw_note_cids:
                if int(scid) == int(card.id):
                    real_siblings.append(card)
                    continue
                try:
                    sc = col.get_card(int(scid))
                    if sc is not None and int(getattr(sc, "nid", note.id) or note.id) == int(note.id):
                        real_siblings.append(sc)
                except Exception:
                    continue

            sibling_card_ids = [str(card.id)]
            sibling_count = 1
            sibling_cards_meta: Optional[List[Dict[str, Any]]] = None

            if len(real_siblings) > 1:
                real_siblings.sort(key=lambda sc: (int(getattr(sc, "ord", 0) or 0), int(sc.id)))
                tmpls = model.get("tmpls") if isinstance(model, dict) else None
                sibling_cards_meta = []
                for idx, sc in enumerate(real_siblings):
                    sc_ord = int(getattr(sc, "ord", 0) or 0)
                    if is_cloze and not io_front:
                        sc_label = f"c{sc_ord + 1}"
                    elif isinstance(tmpls, list) and 0 <= sc_ord < len(tmpls) and isinstance(tmpls[sc_ord], dict):
                        sc_label = str(tmpls[sc_ord].get("name") or f"#{idx + 1}")
                    else:
                        sc_label = f"#{idx + 1}"
                    _, sc_diff, sc_mastery = self._compute_card_memory_metrics(sc)
                    sibling_cards_meta.append(
                        {
                            "id": str(sc.id),
                            "ord": sc_ord,
                            "label": sc_label,
                            "status": self._determine_card_status(col, sc),
                            "suspended": int(getattr(sc, "queue", 0) or 0) == -1,
                            "buried": int(getattr(sc, "queue", 0) or 0) in (-2, -3),
                            "dueText": self._format_due_text(col, sc, lang),
                            "mastery": sc_mastery,
                            "difficultyLevel": sc_diff,
                            "flags": int(getattr(sc, "flags", 0) or 0) & 7,
                            "reps": int(getattr(sc, "reps", 0) or 0),
                            "lapses": int(getattr(sc, "lapses", 0) or 0),
                            "intervalDays": int(getattr(sc, "ivl", 0) or 0),
                            "isCloze": bool(is_cloze and not io_front),
                        }
                    )

                sibling_card_ids = [s["id"] for s in sibling_cards_meta]
                sibling_count = len(sibling_cards_meta)
                reps_total = sum(int(s["reps"]) for s in sibling_cards_meta)
                lapses_total = sum(int(s["lapses"]) for s in sibling_cards_meta)
                active_sibs = [s for s in sibling_cards_meta if not s["suspended"]] or sibling_cards_meta
                mastery = round(sum(int(s["mastery"]) for s in active_sibs) / len(active_sibs))
                interval_days = min(int(s["intervalDays"]) for s in active_sibs)
                diff_level = max(
                    (s["difficultyLevel"] for s in sibling_cards_meta),
                    key=lambda d: _DIFF_RANK.get(d, 1),
                )
                matched_id_set = {str(x) for x in matched_cids} if matched_cids else set(sibling_card_ids)
                matched_meta = [s for s in sibling_cards_meta if s["id"] in matched_id_set] or sibling_cards_meta
                first_flagged = next((int(s["flags"]) for s in matched_meta if int(s["flags"]) > 0), 0)
                if first_flagged > 0:
                    flags_val = first_flagged

            # 与复习界面同源：编辑器/预览拿不到这个标志就只能按普通卡处理，
            # 翻面时会在下方重复展示一次正面。Cloze / IO 卡由 helper 统一排除。
            replace_front_on_flip = resolve_replace_front_on_flip(
                card,
                front_clean,
                native.answer if native else "",
                is_cloze=is_cloze,
                is_image_occlusion=bool(io_front),
            )

            out: Dict[str, Any] = {
                "id": str(card.id),
                "noteId": str(note.id),
                "notetypeId": model_id,
                "noteTypeName": str(model.get("name", "Basic") or "Basic") if isinstance(model, dict) else "Basic",
                "isCloze": is_cloze,
                "siblingCardIds": sibling_card_ids,
                "siblingCount": sibling_count,
                "deckId": str(deck["id"]),
                "deckName": deck["name"].split("::")[-1],
                "fullDeckName": deck["name"],
                "front": front_clean,
                "back": back_clean,
                "frontHtml": front_html,
                "backHtml": back_html,
                "replaceFrontOnFlip": replace_front_on_flip,
                "audioFiles": merged_audio,
                "frontAudioFiles": front_audio_out,
                "backAudioFiles": back_audio_out,
                "fields": fields_dict,
                "fieldOrder": list(fields_dict.keys()),
                "tags": list(note.tags),
                "mastery": mastery,
                "stability": stability,
                "difficultyLevel": diff_level,
                "dueText": due_text,
                "dueRaw": int(getattr(card, "due", 0) or 0),
                "status": card_status,
                "suspended": card.queue == -1,
                "buried": card.queue in (-2, -3),
                "flags": flags_val,
                "reps": reps_total,
                "lapses": lapses_total,
                "intervalDays": interval_days,
            }
            if sibling_cards_meta is not None:
                out["siblingCards"] = sibling_cards_meta
            return out
        except Exception:
            return None

    @staticmethod
    def _determine_card_status_raw(today: int, ctype: int, queue: int, due: int) -> str:
        """Classify raw SQLite card fields into Library status."""
        if queue == -1:
            return "suspended"
        if queue in (-2, -3):
            return "buried"
        if ctype == 0 or queue == 0:
            return "new"
        if queue in (1, 3):
            return "due"
        if queue == 2 and due <= today:
            return "due"
        return "review"

    @classmethod
    def _determine_card_status(cls, col, card) -> str:
        """
        Status classification:
        - queue == -1 -> 'suspended' (已暂停)
        - queue in (-2, -3) -> 'buried' (已搁置)
        - type == 0 or queue == 0 -> 'new'
        - queue in (1, 3) (learning / day-learning) -> 'due'
        - queue == 2 and due <= col.sched.today -> 'due'
        - otherwise (already studied review card due in the future) -> 'review'
        """
        today = int(getattr(getattr(col, "sched", None), "today", 0) or 0)
        return cls._determine_card_status_raw(
            today,
            int(getattr(card, "type", 0) or 0),
            int(getattr(card, "queue", 0) or 0),
            int(getattr(card, "due", 0) or 0),
        )

    @staticmethod
    def _render_native_image_occlusion(note):
        """薄委托：具体实现在 media_utils，供 search / review 两个服务共用。"""
        return render_native_image_occlusion(note)

    @staticmethod
    def _rewrite_media_and_audio(
        raw: str,
        media_dir: str,
        strip_furigana_reading: bool = False,
        reveal_io_masks: bool = False,
    ):
        if not raw:
            return "", []
        audios: List[str] = []

        def _snd(m):
            fn = m.group(1).strip()
            if fn and fn not in audios:
                audios.append(fn)
            return ""

        s = SOUND_TAG_RE.sub(_snd, raw)
        s = convert_furigana_to_ruby(s, strip_reading=strip_furigana_reading)
        if media_dir:
            s = resolve_media_img_src_for_webview(s, media_dir)
        if "anki-io-rect" in s:
            s = restore_rendered_io_rects(s)
            io_rect_re = re.compile(
                r'<span\b([^>]*?\bclass\s*=\s*["\'][^"\']*\banki-io-rect\b[^"\']*["\'][^>]*)>\s*'
                r"\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}\s*</span>",
                flags=re.I,
            )
            if reveal_io_masks:
                # 背面是答案面：原生遮挡卡的答案就是「图去掉遮罩」，再盖一层琥珀色
                # 反而把用户想看的图挡住了。这里直接摘掉遮罩框，露出底图。
                s = io_rect_re.sub("", s)
            else:
                s = io_rect_re.sub(
                    lambda m: (
                        f'<span{m.group(1).rstrip()[:-1]};background:rgba(245,158,11,0.78);border:1.5px solid #FFFFFF;'
                        f'border-radius:4px;display:flex;align-items:center;justify-content:center;color:#FFFFFF;'
                        f'font-size:9px;font-weight:700;line-height:1;">#{m.group(2)}</span>'
                        if m.group(1).rstrip().endswith(('"', "'"))
                        else f'<span{m.group(1)}>#{m.group(2)}</span>'
                    ),
                    s,
                )
        s = CLOZE_RE.sub(lambda m: f'<span class="anki-cloze-lib">{m.group(2)}</span>', s)
        return s.strip(), audios

    @staticmethod
    def _strip_html_for_summary(raw: str) -> str:
        return plain_text_of(raw)

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
