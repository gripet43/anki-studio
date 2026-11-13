# -*- coding: utf-8 -*-
"""
Anki Studio — Review & FSRS Scheduling Service
Handles review queue retrieval (strictly due & new cards by default to protect FSRS!),
rich HTML & media path resolution (`collection.media`), `[sound:xxx.mp3]` audio extraction & playback,
Cloze (`{{c1::...}}`) rendering, FSRS 4-level interval predictions, binary/quaternary card grading,
and instant undo.
"""

from __future__ import annotations

import html
import os
import re
import time
import urllib.parse
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .media_utils import (
    NativeRender,
    SandboxRender,
    convert_furigana_to_ruby,
    get_media_dir,
    get_media_http_base_url,
    plain_text_of,
    render_native_card_sides,
    render_native_image_occlusion,
    render_sandbox_card_sides,
    resolve_front_field_name,
    resolve_media_img_src_for_webview,
    resolve_replace_front_on_flip,
    wrap_card_with_styles,
)


SOUND_TAG_RE = re.compile(r"\[sound:([^\]]+)\]")
CLOZE_RE = re.compile(r"\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}")
IO_RECT_SPAN_RE = re.compile(
    r'<span\b([^>]*?\bclass\s*=\s*["\'][^"\']*\banki-io-rect\b[^"\']*["\'][^>]*)>\s*\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}\s*</span>',
    flags=re.I,
)
STYLE_ATTR_RE = re.compile(r'\bstyle\s*=\s*(["\'])(.*?)\1', flags=re.I)


class ReviewService:
    """Service managing active review sessions, rich HTML/media/audio, FSRS predictions, and undo stack."""

    def __init__(self, col_getter, mw_getter=None, lang_getter: Optional[Callable[[], str]] = None):
        self._get_col = col_getter
        self._get_mw = mw_getter or (lambda: None)
        self._get_lang = lang_getter or (lambda: "zh-CN")

    @property
    def col(self):
        return self._get_col()

    @property
    def mw(self):
        return self._get_mw()

    def start_review_session(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Selects a deck (if deckId provided) and returns the current due queue & first card."""
        data = data or {}
        col = self.col
        if col is None:
            return {"cards": [], "totalDue": 0, "isPreviewOnly": False}

        deck_id = data.get("deckId")
        if deck_id and str(deck_id).isdigit():
            try:
                col.decks.select(int(deck_id))
            except Exception:
                pass

        return self.get_review_queue(data)

    def get_review_queue(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Fetches due/new cards for the target deck or collection, with FSRS predictions.
        Bug #3 Fix: `includePreviewWhenEmpty` defaults to `False` so we NEVER pull future
        undue cards into a real FSRS grading session!
        """
        data = data or {}
        col = self.col
        lang = data.get("language") or self._get_lang()
        if col is None:
            return {"cards": [], "totalDue": 0, "isPreviewOnly": False}

        deck_id = data.get("deckId")
        limit = max(1, int(data.get("limit") or 100))
        include_preview = bool(data.get("includePreviewWhenEmpty", False))
        explicit_cids = data.get("cardIds")

        if isinstance(explicit_cids, list) and len(explicit_cids) > 0:
            selected_cids = [int(c) for c in explicit_cids if str(c).isdigit()][:limit]
            cards_out = [self._serialize_review_card(col, cid, lang, False) for cid in selected_cids]
            return {
                "deckId": str(deck_id) if deck_id else "all",
                "totalDue": len(selected_cids),
                "isPreviewOnly": False,
                "cards": [c for c in cards_out if c is not None],
            }

        # Anki 原生 v3 调度器才是「下一张卡是哪张」的唯一真实源：它决定 gather /
        # sort order、每日新卡与复习上限、相邻卡埋没与筛选牌组顺序。过去这里用
        # find_cards() 自己拼队列，顺序是 card id 升序——同一个「蓝宝书」牌组下，
        # Studio 会先打开 Card 01（文法卡，正面 3 条例句），而原生先打开 Card 02
        #（例文卡，正面 1 条例句）。用户看到的就是「同一张卡，我们的正面多出例句」。
        native_cids = self._native_queued_cids(col, deck_id, limit)
        if native_cids is not None and (native_cids or not include_preview):
            native_cards = [
                self._serialize_review_card(col, cid, lang, False) for cid in native_cids
            ]
            return {
                "deckId": str(deck_id) if deck_id else "all",
                "totalDue": len(native_cids),
                "isPreviewOnly": False,
                "cards": [c for c in native_cards if c is not None],
            }

        deck_clause = ""
        if deck_id and str(deck_id).isdigit():
            deck_obj = col.decks.get(int(deck_id), default=False)
            if deck_obj:
                escaped_name = deck_obj["name"].replace('"', '\\"')
                deck_clause = f'deck:"{escaped_name}" '

        due_cids = list(col.find_cards(f"{deck_clause}(is:due OR is:learn) -is:suspended -is:buried"))
        new_cids = list(col.find_cards(f"{deck_clause}is:new -is:suspended -is:buried"))
        combined_cids = []
        seen = set()
        for cid in due_cids + new_cids:
            if cid not in seen:
                seen.add(cid)
                combined_cids.append(cid)

        is_preview_only = False
        if not combined_cids and include_preview:
            all_cids = list(col.find_cards(f"{deck_clause}-is:suspended -is:buried"))
            combined_cids = all_cids[:limit]
            is_preview_only = True

        total_in_session = len(combined_cids)
        selected_cids = combined_cids[:limit]
        cards_out = [self._serialize_review_card(col, cid, lang, is_preview_only) for cid in selected_cids]

        return {
            "deckId": str(deck_id) if deck_id else "all",
            "totalDue": total_in_session,
            "isPreviewOnly": is_preview_only,
            "cards": [c for c in cards_out if c is not None],
        }

    def _native_queued_cids_all_decks(self, col, limit: int) -> Optional[List[int]]:
        """跨顶层牌组合并 Anki 原生队列（首页「开始今日学习」使用）。

        每个顶层牌组单独调用 ``get_queued_cards()``：每日新卡/复习上限、学习步
        （learn ahead）、兄弟卡埋没都由 Anki 自己判定；合并时按牌组树顺序并去重。
        队列为空是有效结果（今日学完），API 不可用才返回 ``None``。
        """
        try:
            tree = col.sched.deck_due_tree()
        except Exception:
            return None
        if getattr(col.sched, "get_queued_cards", None) is None:
            return None

        def subtree_pending(node) -> int:
            total = (
                int(getattr(node, "new_count", 0) or 0)
                + int(getattr(node, "learn_count", 0) or 0)
                + int(getattr(node, "review_count", 0) or 0)
            )
            for child in getattr(node, "children", []) or []:
                total += subtree_pending(child)
            return total

        try:
            original_deck = int((col.decks.current() or {}).get("id") or 0)
        except Exception:
            original_deck = 0

        cids: List[int] = []
        seen = set()
        try:
            for node in getattr(tree, "children", []) or []:
                if len(cids) >= limit:
                    break
                did = int(getattr(node, "deck_id", 0) or 0)
                if not did or subtree_pending(node) <= 0:
                    continue
                try:
                    col.decks.select(did)
                    queued = col.sched.get_queued_cards(
                        fetch_limit=max(1, limit - len(cids))
                    )
                except Exception:
                    continue
                for entry in list(getattr(queued, "cards", []) or []):
                    card = getattr(entry, "card", None)
                    cid = getattr(card, "id", None) if card is not None else None
                    if cid is None or int(cid) in seen:
                        continue
                    seen.add(int(cid))
                    cids.append(int(cid))
                    if len(cids) >= limit:
                        break
        finally:
            if original_deck:
                try:
                    col.decks.select(original_deck)
                except Exception:
                    pass
        return cids

    def _native_queued_cids(
        self, col, deck_id, limit: int
    ) -> Optional[List[int]]:
        """取 Anki 原生 v3 调度器的真实队列顺序。

        - 返回 ``None``：当前 Anki／测试桩没有 ``get_queued_cards``（或调用抛错），
          调用方应回落到旧的 ``find_cards`` 逻辑。
        - 返回 ``[]``：调度器可用且队列确实为空（例如今日新卡配额已用完）。
          **必须尊重它，不能回落**，否则会重新无视每日上限。
        """
        # deckId == "all"：首页「开始今日学习」的全局会话。Anki 的
        # get_queued_cards() 只针对「当前选中牌组」，所以按顶层牌组逐个取原生队列再
        # 合并——这样每日限额、学习步（learn ahead）、兄弟卡埋没全都由调度器决定，
        # 首页显示的总数与实际能学的张数才一致（否则会出现「首页 360、会话 20」）。
        if deck_id is not None and str(deck_id) == "all":
            return self._native_queued_cids_all_decks(col, limit)

        # 只有显式指定了数字 deckId 才走原生队列：Anki 的 get_queued_cards()
        # 永远针对「当前选中牌组」，而不带 deckId 的旧调用语义是「整个集合」。
        # 两者混用会让无 deckId 的调用悄悄丢掉其他牌组的卡，故直接回落旧逻辑。
        if not deck_id or not str(deck_id).isdigit():
            return None
        try:
            try:
                col.decks.select(int(deck_id))
            except Exception:
                pass
            sched = getattr(col, "sched", None)
            get_queued_cards = getattr(sched, "get_queued_cards", None)
            if not callable(get_queued_cards):
                return None
            queued = get_queued_cards(fetch_limit=max(1, int(limit)))
            entries = getattr(queued, "cards", None)
            if entries is None:
                return None
            cids: List[int] = []
            for entry in list(entries):
                card = getattr(entry, "card", None)
                cid = getattr(card, "id", None) if card is not None else None
                if cid is None:
                    continue
                cids.append(int(cid))
            return cids
        except Exception:
            return None

    def _collect_custom_study_cids(self, col, data: Dict[str, Any]) -> Tuple[List[int], bool]:
        """
        Collects and sorts candidate card IDs for Custom Study / Mistake Drills / Flag & Tag Cram:
        - preset: 'mistakes' | 'flagged' | 'ahead' | 'extra_new' | 'custom'
        - deckId: 'all' or numeric deck ID
        - days: lookback days for 'mistakes' (default 7) or lookahead days for 'ahead' (default 3)
        - flag: 'all' | 'flagged' | '1'..'7'
        - tag: 'all' or specific tag
        - cardScope: 'all' | 'due' | 'review' | 'new'
        - sortOrder: 'lapses_desc' | 'ivl_asc' | 'random' | 'due_asc'
        - isPreviewOnly: bool (default True for cram/drills)
        """
        preset = str(data.get("preset", "mistakes") or "mistakes").strip()
        deck_id = data.get("deckId")
        try:
            days = max(1, min(90, int(data.get("days") or (7 if preset == "mistakes" else 3))))
        except Exception:
            days = 7 if preset == "mistakes" else 3

        flag_filter = str(data.get("flag", "all") or "all").strip()
        tag_filter = str(data.get("tag", "all") or "all").strip()
        card_scope = str(data.get("cardScope", "all") or "all").strip()
        sort_order = str(data.get("sortOrder", "") or "").strip()
        if not sort_order:
            sort_order = (
                "lapses_desc"
                if preset == "mistakes"
                else ("due_asc" if preset in ("ahead", "extra_new") else "ivl_asc")
            )

        is_preview_only = bool(data.get("isPreviewOnly", True))

        deck_clause = ""
        target_dids: Optional[set] = None
        if deck_id and str(deck_id) != "all" and str(deck_id).isdigit():
            did_int = int(deck_id)
            deck_obj = col.decks.get(did_int, default=False) if hasattr(col, "decks") else None
            if deck_obj and deck_obj.get("name"):
                escaped_name = str(deck_obj["name"]).replace('"', '\\"')
                deck_clause = f'deck:"{escaped_name}" '
            target_dids = {did_int}
            if hasattr(col, "decks") and hasattr(col.decks, "children"):
                try:
                    for _, child_did in col.decks.children(did_int):
                        target_dids.add(int(child_did))
                except Exception:
                    pass

        base_cids = list(col.find_cards(deck_clause.strip())) if hasattr(col, "find_cards") else []
        if not base_cids:
            return [], is_preview_only

        cutoff = getattr(col.sched, "day_cutoff", int(time.time()) + 86400) if hasattr(col, "sched") else int(time.time()) + 86400
        today_sched = int(getattr(col.sched, "today", 0) or 0) if hasattr(col, "sched") else 0

        mistake_cid_set: Optional[set] = None
        if preset == "mistakes":
            lookback_start_ms = (cutoff - days * 86400) * 1000
            mistake_cid_set = set()
            if hasattr(col, "db") and hasattr(col.db, "all"):
                try:
                    rows = col.db.all(
                        "SELECT DISTINCT cid FROM revlog WHERE id >= ? AND type < 4 AND ease = 1",
                        lookback_start_ms,
                    )
                    for r in rows:
                        if r and r[0] is not None:
                            mistake_cid_set.add(int(r[0]))
                except Exception:
                    pass

        matched_cards: List[Tuple[int, Any]] = []
        fallback_lapsed_cards: List[Tuple[int, Any]] = []

        for cid in base_cids:
            try:
                card = col.get_card(int(cid))
                if card is None:
                    continue
                if int(getattr(card, "queue", 0)) == -1:
                    continue
                if target_dids is not None and int(getattr(card, "did", 1)) not in target_dids:
                    continue

                c_flags = int(getattr(card, "flags", 0) or 0) & 7
                if flag_filter == "flagged" and c_flags <= 0:
                    continue
                if flag_filter in ("0", "1", "2", "3", "4", "5", "6", "7") and c_flags != int(flag_filter):
                    continue

                if tag_filter and tag_filter != "all":
                    note = card.note() if hasattr(card, "note") else None
                    n_tags = list(getattr(note, "tags", []) or []) if note else []
                    if tag_filter not in n_tags:
                        continue

                c_type = int(getattr(card, "type", 0) or 0)
                c_queue = int(getattr(card, "queue", 0) or 0)
                c_due = int(getattr(card, "due", 0) or 0)
                c_lapses = int(getattr(card, "lapses", 0) or 0)

                if preset == "mistakes":
                    if mistake_cid_set is not None and int(cid) in mistake_cid_set:
                        matched_cards.append((int(cid), card))
                    elif c_lapses > 0:
                        fallback_lapsed_cards.append((int(cid), card))
                    else:
                        note = card.note() if hasattr(card, "note") else None
                        n_tags = list(getattr(note, "tags", []) or []) if note else []
                        if any(k in t for t in n_tags for k in ("错题", "易错", "易忘", "leech")):
                            fallback_lapsed_cards.append((int(cid), card))
                elif preset == "flagged":
                    # If user left both flag and tag as 'all' in flagged preset, default to any flagged OR tagged card
                    if flag_filter == "all" and tag_filter == "all":
                        if c_flags > 0:
                            matched_cards.append((int(cid), card))
                    else:
                        matched_cards.append((int(cid), card))
                elif preset == "ahead":
                    if c_queue in (2, 3) or c_type == 2:
                        if c_due <= today_sched + days:
                            matched_cards.append((int(cid), card))
                elif preset == "extra_new":
                    if c_type == 0 or c_queue == 0:
                        matched_cards.append((int(cid), card))
                else:
                    if card_scope == "due":
                        if c_queue in (1, 3) or (c_queue == 2 and c_due <= today_sched):
                            matched_cards.append((int(cid), card))
                    elif card_scope == "new":
                        if c_type == 0 or c_queue == 0:
                            matched_cards.append((int(cid), card))
                    elif card_scope == "review":
                        if c_type == 2 or c_queue == 2:
                            matched_cards.append((int(cid), card))
                    else:
                        matched_cards.append((int(cid), card))
            except Exception:
                continue

        if preset == "mistakes" and not matched_cards and fallback_lapsed_cards:
            matched_cards = fallback_lapsed_cards

        if sort_order == "lapses_desc":
            matched_cards.sort(
                key=lambda item: (
                    -int(getattr(item[1], "lapses", 0) or 0),
                    int(getattr(item[1], "ivl", 0) or 0),
                    item[0],
                )
            )
        elif sort_order == "ivl_asc":
            matched_cards.sort(
                key=lambda item: (
                    int(getattr(item[1], "ivl", 0) or 0),
                    -int(getattr(item[1], "lapses", 0) or 0),
                    item[0],
                )
            )
        elif sort_order == "due_asc":
            matched_cards.sort(
                key=lambda item: (
                    int(getattr(item[1], "due", 0) or 0),
                    item[0],
                )
            )
        elif sort_order == "random":
            import random
            rng = random.Random(int(time.time() * 1000) & 0xFFFFFFFF)
            rng.shuffle(matched_cards)

        return [cid for cid, _ in matched_cards], is_preview_only

    def preview_custom_study(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Returns the live count of cards matching the custom study criteria before starting."""
        data = data or {}
        col = self.col
        if col is None:
            return {"success": False, "totalMatched": 0, "count": 0}
        limit = max(1, min(200, int(data.get("limit") or 30)))
        cids, is_preview = self._collect_custom_study_cids(col, data)
        return {
            "success": True,
            "totalMatched": len(cids),
            "count": min(limit, len(cids)),
            "isPreviewOnly": is_preview,
        }

    def start_custom_study(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Builds and returns a curated review queue for Custom Study / Mistake Drills / Cramming."""
        data = data or {}
        col = self.col
        lang = data.get("language") or self._get_lang()
        if col is None:
            return {
                "success": False,
                "cards": [],
                "cardIds": [],
                "totalMatched": 0,
                "count": 0,
                "isPreviewOnly": True,
                "error": "Collection unavailable",
            }

        limit = max(1, min(200, int(data.get("limit") or 30)))
        cids, is_preview_only = self._collect_custom_study_cids(col, data)
        selected_cids = cids[:limit]
        cards_out = [
            c
            for c in (
                self._serialize_review_card(col, cid, lang, is_preview_only)
                for cid in selected_cids
            )
            if c is not None
        ]
        return {
            "success": True,
            "preset": str(data.get("preset", "mistakes") or "mistakes"),
            "deckId": str(data.get("deckId") or "all"),
            "totalMatched": len(cids),
            "count": len(cards_out),
            "isPreviewOnly": is_preview_only,
            "cardIds": [str(c["id"]) for c in cards_out],
            "cards": cards_out,
        }

    def play_audio(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Plays an audio file from Anki's collection.media using aqt.sound."""
        filename = str((data or {}).get("filename", "")).strip()
        if not filename:
            return {"played": False, "message": "No audio filename provided"}

        col = self.col
        media_dir = self._get_media_dir(col)
        full_path = os.path.join(media_dir, filename) if media_dir else filename

        played = False
        try:
            import aqt.sound
            if hasattr(aqt.sound, "av_player") and aqt.sound.av_player:
                aqt.sound.av_player.play_file(filename)
                played = True
            elif hasattr(aqt.sound, "play"):
                aqt.sound.play(filename)
                played = True
        except Exception:
            pass

        return {
            "played": played,
            "filename": filename,
            "fileUrl": Path(full_path).as_uri() if os.path.isabs(full_path) else filename,
        }

    def stop_audio(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Stops whatever ``aqt.sound`` is currently playing.

        离开复习界面（或复习组件卸载）时必须调用：音频由 Anki 的 AVPlayer
        播放，与前端界面生命周期无关，不显式停就会在首页继续响。
        """
        stopped = False
        try:
            import aqt.sound as sound

            player = getattr(sound, "av_player", None)
            if player is not None:
                for method_name in ("stop_and_clear_queue", "stop"):
                    method = getattr(player, method_name, None)
                    if callable(method):
                        method()
                        stopped = True
                        break
            if not stopped:
                fallback = getattr(sound, "stop", None)
                if callable(fallback):
                    fallback()
                    stopped = True
        except Exception:
            pass
        return {"stopped": stopped}

    def _get_media_dir(self, col) -> str:
        return get_media_dir(col)

    def _resolve_rich_html_and_audio(
        self,
        raw_html: str,
        media_dir: str,
        cloze_ord: int = 1,
        is_question_side: bool = False,
        strip_furigana_reading: bool = False,
    ) -> Tuple[str, List[str]]:
        """
        Preserves rich HTML (`<b>`, `<span style>`, `<table>`, `<img>`, etc.),
        extracts `[sound:xxx.mp3]` into an audio file list, rewrites relative `<img src="...">`
        to `file:///.../collection.media/...`, converts Japanese furigana brackets,
        and formats Cloze deletions (`{{c1::...}}`).
        """
        if not raw_html:
            return "", []

        audio_files: List[str] = []

        def _sound_replacer(match):
            fname = match.group(1).strip()
            if fname and fname not in audio_files:
                audio_files.append(fname)
            return ""

        processed = SOUND_TAG_RE.sub(_sound_replacer, raw_html)
        processed = convert_furigana_to_ruby(processed, strip_reading=strip_furigana_reading)

        if media_dir:
            processed = resolve_media_img_src_for_webview(processed, media_dir)

        if "anki-io-rect" in processed and IO_RECT_SPAN_RE.search(processed):
            target_idx = str(max(1, cloze_ord))
            io_mode = "hide-one" if 'data-io-mode="hide-one"' in processed else "hide-all"

            def _io_rect_replacer(match):
                attrs_str, c_num, _c_ans, _c_hint = (
                    match.group(1),
                    match.group(2),
                    match.group(3),
                    match.group(4),
                )
                style_m = STYLE_ATTR_RE.search(attrs_str or "")
                pos_style = style_m.group(2).strip().rstrip(";") if style_m else "position:absolute"
                if is_question_side:
                    if c_num == target_idx:
                        return (
                            f'<span class="anki-io-rect-resolved anki-io-target" data-io-rect="{c_num}" '
                            f'style="{pos_style};background:#F59E0B;border:2px solid #FFFFFF;'
                            f'box-shadow:0 4px 14px rgba(245,158,11,0.45);border-radius:6px;'
                            f'display:flex;align-items:center;justify-content:center;color:#FFFFFF;'
                            f'font-size:11px;font-weight:800;line-height:1;user-select:none;z-index:3;">'
                            f'? #{c_num}</span>'
                        )
                    if io_mode == "hide-all":
                        return (
                            f'<span class="anki-io-rect-resolved anki-io-masked" data-io-rect="{c_num}" '
                            f'style="{pos_style};background:#334155;border:1.5px solid rgba(255,255,255,0.65);'
                            f'border-radius:6px;display:flex;align-items:center;justify-content:center;'
                            f'color:rgba(255,255,255,0.78);font-size:10px;font-weight:700;line-height:1;'
                            f'user-select:none;z-index:2;">#{c_num}</span>'
                        )
                    return (
                        f'<span class="anki-io-rect-resolved anki-io-hidden" data-io-rect="{c_num}" '
                        f'style="{pos_style};opacity:0;pointer-events:none;"></span>'
                    )
                else:
                    if c_num == target_idx:
                        return (
                            f'<span class="anki-io-rect-resolved anki-io-revealed" data-io-rect="{c_num}" '
                            f'style="{pos_style};background:rgba(16,185,129,0.16);border:2px solid #10B981;'
                            f'box-shadow:0 0 0 2px rgba(16,185,129,0.22);border-radius:6px;pointer-events:none;z-index:3;">'
                            f'<span style="position:absolute;top:-1px;left:-1px;background:#10B981;color:#FFFFFF;'
                            f'font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px 0 4px 0;line-height:1.1;">'
                            f'#{c_num}</span></span>'
                        )
                    return (
                        f'<span class="anki-io-rect-resolved anki-io-other" data-io-rect="{c_num}" '
                        f'style="{pos_style};background:transparent;border:1px dashed rgba(148,163,184,0.55);'
                        f'border-radius:6px;pointer-events:none;z-index:1;"></span>'
                    )

            processed = IO_RECT_SPAN_RE.sub(_io_rect_replacer, processed)

        if CLOZE_RE.search(processed):
            target_idx = str(max(1, cloze_ord))

            def _cloze_replacer(match):
                c_num, c_ans, c_hint = match.group(1), match.group(2), match.group(3)
                if is_question_side and c_num == target_idx:
                    hint_label = c_hint if c_hint else "..."
                    return f'<span class="px-2 py-0.5 rounded bg-[#5E5CE6]/25 text-[#8684FF] font-semibold border border-[#5E5CE6]/50">[{hint_label}]</span>'
                else:
                    return f'<span class="px-1.5 py-0.5 rounded bg-[#28CD41]/20 text-[#32D74B] font-semibold">{c_ans}</span>'

            processed = CLOZE_RE.sub(_cloze_replacer, processed)

        return processed.strip(), audio_files

    @staticmethod
    def _plain_text_summary(raw_html: str) -> str:
        return plain_text_of(raw_html)

    def _serialize_review_card(
        self, col, cid: int, lang: str = "zh-CN", is_preview_only: bool = False
    ) -> Optional[Dict[str, Any]]:
        try:
            card = col.get_card(int(cid))
            note = card.note()
            deck = col.decks.get(card.did, default=False) or {"id": card.did, "name": "Default"}
            media_dir = self._get_media_dir(col)

            model = note.note_type() if hasattr(note, "note_type") else {"id": 1, "name": "Basic", "type": 0}
            notetype_id = str(model.get("id") or getattr(note, "mid", 1) or 1)
            is_cloze = bool(model.get("type") == 1)
            cloze_ord = int(getattr(card, "ord", 0)) + 1
            http_base_url = get_media_http_base_url(self.mw)

            # Bug #5: Expose cardType ('new' | 'learning' | 'review') so frontend decrements dueNew vs dueReview accurately
            card_type_code = int(getattr(card, "type", 0))
            card_type_str = "new" if card_type_code == 0 else ("learning" if card_type_code in (1, 3) else "review")

            fields_dict = dict(note.items())
            field_keys = list(fields_dict.keys())
            # 原生 Image Occlusion 的第一个字段是 Occlusion（SVG 覆盖层），
            # 底图在 Image 字段。按 field_keys[0] 直出只会显示几个黑矩形。
            io_front, io_back, io_title = render_native_image_occlusion(note)
            # 背面正文一律交给 Anki 模板引擎，取 fields[1] 会让多字段卡包的
            # 拓展字段（释义 / 例句 / 词源 / 柯林斯…）在背诵界面整段消失。
            # Cloze 与原生遮挡卡例外：它们的 frontAnswerHtml 已经负责补全/揭底，
            # 再叠一份完整答案会让同一句话在翻转时出现两次。
            raw_output = None
            if not io_front and not is_cloze:
                try:
                    raw_output = card.render_output()
                except Exception:
                    raw_output = None

            native = (
                NativeRender("", "", [], [], "")
                if (io_front or is_cloze or raw_output is None)
                else render_native_card_sides(
                    card, media_dir, strip_front_side=False, raw_output=raw_output
                )
            )
            native_back, native_back_audio, native_back_css = (
                native.answer,
                native.answer_audio,
                native.css,
            )
            # 正面用「保留 display:none」的样式表：柯林斯这类词库模板把详解、扩展例句
            # 和 {{hint}} 内容默认藏起来，原生正面只显示入口；背面才需要揭开它们。
            native_front_css = native.question_css or native_back_css
            if io_front:
                front_raw, back_raw = io_front, io_back
            else:
                # 正面取“模板真正显示的那个字段”——第一个字段未必是它。
                # eggrolls-JLPT10k 把 NoteID 排在第一位，按 fields[0] 直出就是一串 uuid。
                front_key = (
                    resolve_front_field_name(fields_dict, native.question, card)
                    if native.question
                    else (field_keys[0] if field_keys else "")
                )
                front_raw = fields_dict.get(front_key, "") if front_key else ""
                back_raw = native.answer or (
                    fields_dict.get(field_keys[1], "") if len(field_keys) > 1 else ""
                )
                # HSK1-6 等卡包在字段中存了 Phiên âm / Tiếng Việt，但背面模板只写了图片与词典表；
                # 若背面未出现越南语释义，将其补在背面顶部，保证翻面即可看到核心拼音与释义。
                if "Tiếng Việt" in fields_dict and fields_dict["Tiếng Việt"].strip():
                    tv_val = fields_dict["Tiếng Việt"].strip()
                    pa_val = fields_dict.get("Phiên âm", "").strip()
                    if 'class="Tiếng Việt"' not in (back_raw or "") and "class='Tiếng Việt'" not in (back_raw or ""):
                        header_parts = []
                        if pa_val:
                            header_parts.append(f'<div class="Phiên âm">{pa_val}</div>')
                        header_parts.append(f'<div class="Tiếng Việt"><b>{tv_val}</b></div>')
                        back_raw = "".join(header_parts) + (back_raw or "")

            front_plain_probe = plain_text_of(front_raw)
            native_q_plain = plain_text_of(native.question) if native.question else ""
            # 当正面模板本身包含结构化排版或样式（如蓝宝书正面的连接方式与例句、CGW 题干、蛋卷词条等），
            # 且与当前卡片正面字段对应时，正面 HTML 同样走 Anki 模板渲染并挂载作用域样式表，
            # 保证学习模式未翻面与已翻面都与编辑器预览、原生 Anki 完全一致。
            use_native_question_html = bool(
                not io_front
                and not is_cloze
                and native.question
                and front_plain_probe
                and (
                    front_plain_probe in native_q_plain
                    or front_plain_probe.lstrip("～〜~- ").strip() in native_q_plain
                )
                and (native_back_css or "<" in native.question)
            )

            show_front_ruby = "<ruby" in (native.question or "").lower()
            front_source_html = native.question if use_native_question_html else front_raw
            front_rich_q, front_audio = self._resolve_rich_html_and_audio(
                front_source_html,
                media_dir,
                cloze_ord=cloze_ord,
                is_question_side=True,
                strip_furigana_reading=(not show_front_ruby and bool(native.question)),
            )
            front_rich_a, _ = self._resolve_rich_html_and_audio(
                front_source_html,
                media_dir,
                cloze_ord=cloze_ord,
                is_question_side=False,
                strip_furigana_reading=False,
            )
            if use_native_question_html and native_back_css:
                front_rich_q = wrap_card_with_styles(front_rich_q, native_front_css, front=True)
                front_rich_a = wrap_card_with_styles(front_rich_a, native_front_css, front=True)

            replace_front_on_flip = resolve_replace_front_on_flip(
                card,
                front_plain_probe,
                native.answer,
                is_cloze=bool(is_cloze),
                is_image_occlusion=bool(io_front),
            )

            # Chinese Grammar Wiki (CGW-ValidExample / CGW-InvalidExample) 在正面模板顶部有
            # `<div class="header">Is this sentence grammatically correct?</div>` 提问提示语，
            # 仅取 `中文` 字段会丢失题目要求；将其提取并挂在正面题干上方。
            if native.question and not io_front and not is_cloze and not use_native_question_html:
                hdr_m = re.search(
                    r'<div\b[^>]*\bclass\s*=\s*["\']?header["\']?[^>]*>([\s\S]*?)</div\s*>',
                    native.question,
                    flags=re.I,
                )
                if hdr_m:
                    hdr_plain = plain_text_of(hdr_m.group(1))
                    if hdr_plain and hdr_plain != front_plain_probe and hdr_plain not in front_plain_probe:
                        hdr_badge = (
                            f'<div class="text-[13px] font-medium text-[#8E8E93] mb-1.5">'
                            f"{html.escape(hdr_plain)}</div>"
                        )
                        front_rich_q = hdr_badge + front_rich_q
                        front_rich_a = hdr_badge + front_rich_a

            back_rich, back_audio = self._resolve_rich_html_and_audio(
                back_raw, media_dir, cloze_ord=cloze_ord, is_question_side=False
            )
            # 原生渲染已经把 [sound:] 剥进 answer_av_tags，这里补回来
            back_audio = (
                native.question_audio
                + [f for f in front_audio if f not in native.question_audio]
                + [f for f in native_back_audio if f not in native.question_audio and f not in front_audio]
                + [f for f in back_audio if f not in native.question_audio and f not in front_audio and f not in native_back_audio]
            )
            # 模板 HTML 与模板 CSS 必须成对出现：只搬 HTML 会让卡包背面变成无样式纯文本
            back_rich = wrap_card_with_styles(back_rich, native_back_css)

            all_audio: List[str] = []
            for f in back_audio:
                if f not in all_audio:
                    all_audio.append(f)

            for fk in field_keys[2:]:
                _, extra_aud = self._resolve_rich_html_and_audio(fields_dict.get(fk, ""), media_dir)
                for f in extra_aud:
                    if f not in all_audio:
                        all_audio.append(f)

            parsed = self._extract_structured_fields(
                front_raw,
                back_raw,
                front_rich_q,
                front_rich_a,
                back_rich,
                fields_dict,
                media_dir,
                is_cloze,
                lang,
                plain_override=io_title,
                native_question=native.question,
                has_native_answer=bool(native.answer),
            )

            predictions = self._predict_intervals(col, card, lang)

            rev_row = col.db.first(
                "SELECT count(*), max(id) FROM revlog WHERE cid = ? AND type < 4 AND ease > 0", card.id
            )
            reps_count = int(rev_row[0] or card.reps or 0) if rev_row else int(card.reps or 0)
            last_rev_ms = int(rev_row[1] or 0) if rev_row else 0
            last_review_text = self._format_relative_days(last_rev_ms, lang)

            history_rows = col.db.all(
                "SELECT id, ease, ivl FROM revlog WHERE cid = ? AND type < 4 AND ease > 0 ORDER BY id DESC LIMIT 8",
                card.id,
            )
            history = []
            for h_id, h_ease, h_ivl in history_rows:
                dt = time.localtime(h_id / 1000.0)
                date_str = f"{dt.tm_mon}月{dt.tm_mday}日" if lang == "zh-CN" else f"{dt.tm_mon}/{dt.tm_mday}"
                is_remembered = (h_ease or 0) > 1
                ivl_str = self._format_ivl(h_ivl, lang)
                status_word = ("记得" if is_remembered else "遗忘") if lang == "zh-CN" else ("Good" if is_remembered else "Again")
                history.append({
                    "id": str(h_id),
                    "date": date_str,
                    "remembered": is_remembered,
                    "label": f"{status_word} · {ivl_str}",
                })

            memory = getattr(card, "memory_state", None)
            stability = (
                round(float(memory.stability), 1)
                if memory and hasattr(memory, "stability")
                else float(max(1, card.ivl or 4))
            )
            difficulty = (
                round(float(memory.difficulty), 1)
                if memory and hasattr(memory, "difficulty")
                else 5.0
            )

            sandbox_render = (
                SandboxRender("", "", "")
                if (io_front or raw_output is None)
                else render_sandbox_card_sides(
                    card, media_dir, http_base_url=http_base_url, raw_output=raw_output
                )
            )

            return {
                "id": str(card.id),
                "noteId": str(note.id),
                "notetypeId": notetype_id,
                "noteTypeName": str(model.get("name", "Basic")),
                "isCloze": is_cloze,
                "cardType": card_type_str,
                "isPreviewOnly": is_preview_only,
                "deckId": str(deck["id"]),
                "deckName": deck["name"].split("::")[-1],
                "fullDeckName": deck["name"],
                "front": parsed["frontPlain"],
                "reading": parsed["reading"],
                "meaning": parsed["meaningPlain"],
                "etymology": parsed["etymology"],
                "example": parsed["example"],
                "extraHint": parsed["extraHint"],
                "frontHtml": parsed["frontHtml"],
                "frontAnswerHtml": parsed["frontAnswerHtml"],
                "backHtml": parsed["backHtml"],
                "replaceFrontOnFlip": replace_front_on_flip,
                "sandboxFrontHtml": sandbox_render.question,
                "sandboxBackHtml": sandbox_render.answer,
                "sandboxCss": sandbox_render.css,
                "audioFiles": all_audio,
                "fields": fields_dict,
                "fieldOrder": field_keys,
                "tags": list(note.tags),
                "reps": reps_count,
                "lapses": int(card.lapses or 0),
                "intervalDays": int(card.ivl or 0),
                "stability": stability,
                "difficulty": difficulty,
                "lastReviewText": last_review_text,
                "suspended": card.queue == -1,
                "buried": card.queue in (-2, -3),
                "flags": int(card.flags & 7),
                "predictions": predictions,
                "history": history,
            }
        except Exception:
            return None

    def _extract_structured_fields(
        self,
        front_raw: str,
        back_raw: str,
        front_rich_q: str,
        front_rich_a: str,
        back_rich: str,
        fields_dict: Dict[str, str],
        media_dir: str,
        is_cloze: bool,
        lang: str = "zh-CN",
        plain_override: str = "",
        native_question: str = "",
        has_native_answer: bool = False,
    ) -> Dict[str, str]:
        empty_front = "未命名卡片" if lang == "zh-CN" else "Untitled Card"
        empty_back = "（点击编辑补充背面释义）" if lang == "zh-CN" else "(Click to add back content)"
        front_plain = plain_override or self._plain_text_summary(front_raw) or empty_front
        back_plain = self._plain_text_summary(back_raw)

        etymology_raw = (
            fields_dict.get("词源")
            or fields_dict.get("字源")
            or fields_dict.get("Etymology")
            or ""
        )
        example_raw = fields_dict.get("例句") or fields_dict.get("Example") or ""
        hint_raw = (
            fields_dict.get("提示")
            or fields_dict.get("Hint")
            or fields_dict.get("Back Extra")
            or ""
        )
        reading_raw = (
            fields_dict.get("读音")
            or fields_dict.get("音标")
            or fields_dict.get("Reading")
            or fields_dict.get("Phonetic")
            or ""
        )

        reading_plain = self._plain_text_summary(reading_raw)
        # 若模板正面存在，仅当音标/读音原本就出现在正面模板中（如 GRE 红宝书正面含 {{音标}}）才在正面展示，
        # 避免未翻面时提前剧透背面读音，或重复展示正文中已有的读音。
        if reading_plain:
            if reading_plain == front_plain or reading_plain in front_plain:
                reading_plain = ""
            elif native_question and reading_plain not in plain_text_of(native_question):
                reading_plain = ""

        # 若背面已由 Anki 原生模板引擎完整渲染（has_native_answer=True），
        # 已被模板包含在 back_raw 里的词源/例句/提示不再重复追加到卡片底部徽标区。
        if has_native_answer and back_plain:
            if etymology_raw and self._plain_text_summary(etymology_raw) in back_plain:
                etymology_raw = ""
            if example_raw and self._plain_text_summary(example_raw) in back_plain:
                example_raw = ""
            if hint_raw and self._plain_text_summary(hint_raw) in back_plain:
                hint_raw = ""

        etymology_html, _ = self._resolve_rich_html_and_audio(etymology_raw, media_dir)
        example_html, _ = self._resolve_rich_html_and_audio(example_raw, media_dir)
        hint_html, _ = self._resolve_rich_html_and_audio(hint_raw, media_dir)

        return {
            "frontPlain": front_plain,
            "meaningPlain": back_plain if back_plain else (front_plain if is_cloze else empty_back),
            "frontHtml": front_rich_q or front_plain,
            "frontAnswerHtml": front_rich_a or front_rich_q or front_plain,
            "backHtml": back_rich if back_rich else (front_rich_a if is_cloze else ""),
            "reading": reading_plain,
            "etymology": etymology_html,
            "example": example_html,
            "extraHint": hint_html,
        }

    def _predict_intervals(self, col, card, lang: str = "zh-CN") -> Dict[str, str]:
        """Queries Anki 26.x backend for exact FSRS next state labels."""
        default_preds = (
            {"again": "10分钟后", "hard": "2天后", "good": "4天后", "easy": "9天后"}
            if lang == "zh-CN"
            else {"again": "in 10m", "hard": "in 2d", "good": "in 4d", "easy": "in 9d"}
        )
        try:
            states = col._backend.get_scheduling_states(card.id)
            labels = list(col._backend.describe_next_states(states))
            if len(labels) >= 4:
                return {
                    "again": self._localize_interval_label(labels[0], lang),
                    "hard": self._localize_interval_label(labels[1], lang),
                    "good": self._localize_interval_label(labels[2], lang),
                    "easy": self._localize_interval_label(labels[3], lang),
                }
        except Exception:
            pass
        return default_preds

    def answer_card(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Submits an FSRS rating (1=Again/Forgot, 2=Hard, 3=Good/Remembered, 4=Easy) to mw.col.sched."""
        col = self.col
        if col is None or data.get("isPreviewOnly"):
            return {"answered": True, "cardId": data.get("cardId"), "rating": data.get("ease", 3), "previewOnly": True}

        card_id = int(data["cardId"])
        ease = int(data.get("ease", 3))
        elapsed_ms = int(data.get("elapsedMs", 4000))

        card = col.get_card(card_id)
        try:
            from anki.scheduler.v3 import CardAnswer
            # Anki 26 的 build_answer 会读 card.timer_started 计算答题耗时；
            # 没启动计时器时该值为 None，cards.py 的 time_taken 会直接抛
            # TypeError: unsupported operand type(s) for -: 'float' and 'NoneType'，
            # 结果是每次答题都静默失败、卡片从队列消失却没有 revlog。
            if hasattr(card, "start_timer"):
                card.start_timer()
            states = col._backend.get_scheduling_states(card.id)
            rating_map = {
                1: CardAnswer.AGAIN,
                2: CardAnswer.HARD,
                3: CardAnswer.GOOD,
                4: CardAnswer.EASY,
            }
            native_rating = rating_map.get(ease, CardAnswer.GOOD)
            answer = col.sched.build_answer(card=card, states=states, rating=native_rating)
            answer.milliseconds_taken = min(max(elapsed_ms, 500), 60000)
            col.sched.answer_card(answer)
        except Exception as e:
            # Never report a rating as recorded when the native scheduler failed:
            # the card would silently vanish from the queue without a revlog row.
            return {
                "answered": False,
                "cardId": str(card_id),
                "ease": ease,
                "error": str(e),
            }

        return {
            "answered": True,
            "cardId": str(card_id),
            "ease": ease,
            "elapsedMs": elapsed_ms,
        }

    def undo_last_action(self, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Executes instant native undo via mw.col.undo()."""
        lang = (data or {}).get("language") or self._get_lang()
        col = self.col
        if col is None:
            return {"undone": True, "label": "已撤销上一次评分" if lang == "zh-CN" else "Undid last rating"}

        status = col.undo_status()
        if not status.undo:
            return {"undone": False, "label": "当前没有可撤销的操作" if lang == "zh-CN" else "Nothing to undo"}

        col.undo()
        return {
            "undone": True,
            "label": f"已撤销：{status.undo}" if lang == "zh-CN" else f"Undone: {status.undo}",
        }

    @staticmethod
    def _localize_interval_label(label: str, lang: str = "zh-CN") -> str:
        s = label.strip()
        if lang == "en":
            return f"in {s}" if not s.startswith("in ") else s
        s = re.sub(r"^<(\d+)m$", r"\1分钟后", s)
        s = re.sub(r"^(\d+)m$", r"\1分钟后", s)
        s = re.sub(r"^(\d+)h$", r"\1小时后", s)
        s = re.sub(r"^(\d+)d$", r"\1天后", s)
        s = re.sub(r"^(\d+(?:\.\d+)?)mo$", r"\1个月后", s)
        s = re.sub(r"^(\d+(?:\.\d+)?)y$", r"\1年后", s)
        if not s.endswith("后"):
            s = f"{s}后"
        return s

    @staticmethod
    def _format_relative_days(last_rev_ms: int, lang: str = "zh-CN") -> str:
        if not last_rev_ms:
            return "新卡片" if lang == "zh-CN" else "New card"
        diff_days = max(0, int((time.time() * 1000 - last_rev_ms) / 86400000))
        if diff_days == 0:
            return "上次今天" if lang == "zh-CN" else "Reviewed today"
        return f"上次 {diff_days} 天前" if lang == "zh-CN" else f"{diff_days}d ago"

    @staticmethod
    def _format_ivl(ivl: int, lang: str = "zh-CN") -> str:
        if ivl is None:
            return "10分钟" if lang == "zh-CN" else "10m"
        if ivl < 0:
            mins = max(1, round(abs(ivl) / 60))
            return f"{mins}分钟" if lang == "zh-CN" else f"{mins}m"
        if ivl == 0:
            return "当天" if lang == "zh-CN" else "Same day"
        return f"{ivl}天" if lang == "zh-CN" else f"{ivl}d"
