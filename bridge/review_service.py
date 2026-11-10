# -*- coding: utf-8 -*-
"""
Anki Modern OS — Review & FSRS Scheduling Service
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


SOUND_TAG_RE = re.compile(r"\[sound:([^\]]+)\]")
IMG_SRC_RE = re.compile(r'(<img\b[^>]*?\bsrc\s*=\s*)(["\'])([^"\']+)(\2)', flags=re.I)
CLOZE_RE = re.compile(r"\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}")


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

        deck_clause = ""
        if deck_id and str(deck_id).isdigit():
            deck_obj = col.decks.get(int(deck_id), default=False)
            if deck_obj:
                escaped_name = deck_obj["name"].replace('"', '\\"')
                deck_clause = f'deck:"{escaped_name}" '

        due_cids = list(col.find_cards(f"{deck_clause}(is:due OR is:learn)"))
        new_cids = list(col.find_cards(f"{deck_clause}is:new"))
        combined_cids = []
        seen = set()
        for cid in due_cids + new_cids:
            if cid not in seen:
                seen.add(cid)
                combined_cids.append(cid)

        is_preview_only = False
        if not combined_cids and include_preview:
            all_cids = list(col.find_cards(f"{deck_clause}-is:suspended"))
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

    def _get_media_dir(self, col) -> str:
        if col is None:
            return ""
        try:
            if hasattr(col, "media") and hasattr(col.media, "dir"):
                return str(col.media.dir() or "")
        except Exception:
            pass
        return ""

    def _resolve_rich_html_and_audio(
        self, raw_html: str, media_dir: str, cloze_ord: int = 1, is_question_side: bool = False
    ) -> Tuple[str, List[str]]:
        """
        Preserves rich HTML (`<b>`, `<span style>`, `<table>`, `<img>`, etc.),
        extracts `[sound:xxx.mp3]` into an audio file list, rewrites relative `<img src="...">`
        to `file:///.../collection.media/...`, and formats Cloze deletions (`{{c1::...}}`).
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

        if media_dir:
            def _img_replacer(match):
                prefix, quote, src, suffix = match.groups()
                src_clean = src.strip()
                if src_clean.startswith(("http://", "https://", "data:", "file://", "/")):
                    return match.group(0)
                decoded_name = urllib.parse.unquote(src_clean)
                abs_img_path = Path(media_dir) / decoded_name
                try:
                    file_uri = abs_img_path.resolve().as_uri()
                except Exception:
                    file_uri = f"file://{abs_img_path}"
                return f"{prefix}{quote}{file_uri}{suffix}"

            processed = IMG_SRC_RE.sub(_img_replacer, processed)

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
        if not raw_html:
            return ""
        text = SOUND_TAG_RE.sub("", raw_html)
        text = CLOZE_RE.sub(lambda m: m.group(2) or "", text)
        text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
        text = re.sub(r"</li>", " ", text, flags=re.I)
        text = re.sub(r"<[^>]+>", "", text)
        return re.sub(r"\s+", " ", html.unescape(text)).strip()

    def _serialize_review_card(
        self, col, cid: int, lang: str = "zh-CN", is_preview_only: bool = False
    ) -> Optional[Dict[str, Any]]:
        try:
            card = col.get_card(int(cid))
            note = card.note()
            deck = col.decks.get(card.did, default=False) or {"id": card.did, "name": "Default"}
            media_dir = self._get_media_dir(col)

            model = note.note_type() if hasattr(note, "note_type") else {"name": "Basic", "type": 0}
            is_cloze = bool(model.get("type") == 1)
            cloze_ord = int(getattr(card, "ord", 0)) + 1

            # Bug #5: Expose cardType ('new' | 'learning' | 'review') so frontend decrements dueNew vs dueReview accurately
            card_type_code = int(getattr(card, "type", 0))
            card_type_str = "new" if card_type_code == 0 else ("learning" if card_type_code in (1, 3) else "review")

            fields_dict = dict(note.items())
            field_keys = list(fields_dict.keys())
            front_raw = fields_dict.get(field_keys[0], "") if field_keys else ""
            back_raw = fields_dict.get(field_keys[1], "") if len(field_keys) > 1 else ""

            front_rich_q, front_audio = self._resolve_rich_html_and_audio(
                front_raw, media_dir, cloze_ord=cloze_ord, is_question_side=True
            )
            front_rich_a, _ = self._resolve_rich_html_and_audio(
                front_raw, media_dir, cloze_ord=cloze_ord, is_question_side=False
            )
            back_rich, back_audio = self._resolve_rich_html_and_audio(
                back_raw, media_dir, cloze_ord=cloze_ord, is_question_side=False
            )

            all_audio: List[str] = []
            for f in front_audio + back_audio:
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
            )

            predictions = self._predict_intervals(col, card, lang)

            rev_row = col.db.first(
                "SELECT count(*), max(id) FROM revlog WHERE cid = ?", card.id
            )
            reps_count = int(rev_row[0] or card.reps or 0) if rev_row else int(card.reps or 0)
            last_rev_ms = int(rev_row[1] or 0) if rev_row else 0
            last_review_text = self._format_relative_days(last_rev_ms, lang)

            history_rows = col.db.all(
                "SELECT id, ease, ivl FROM revlog WHERE cid = ? ORDER BY id DESC LIMIT 8",
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

            return {
                "id": str(card.id),
                "noteId": str(note.id),
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
    ) -> Dict[str, str]:
        empty_front = "未命名卡片" if lang == "zh-CN" else "Untitled Card"
        empty_back = "（点击编辑补充背面释义）" if lang == "zh-CN" else "(Click to add back content)"
        front_plain = self._plain_text_summary(front_raw) or empty_front
        back_plain = self._plain_text_summary(back_raw)

        etymology_raw = fields_dict.get("词源") or fields_dict.get("Etymology") or ""
        example_raw = fields_dict.get("例句") or fields_dict.get("Example") or ""
        hint_raw = fields_dict.get("提示") or fields_dict.get("Hint") or fields_dict.get("Back Extra") or ""
        reading_raw = fields_dict.get("读音") or fields_dict.get("Reading") or ""

        etymology_html, _ = self._resolve_rich_html_and_audio(etymology_raw, media_dir)
        example_html, _ = self._resolve_rich_html_and_audio(example_raw, media_dir)
        hint_html, _ = self._resolve_rich_html_and_audio(hint_raw, media_dir)

        return {
            "frontPlain": front_plain,
            "meaningPlain": back_plain if back_plain else (front_plain if is_cloze else empty_back),
            "frontHtml": front_rich_q or front_plain,
            "frontAnswerHtml": front_rich_a or front_rich_q or front_plain,
            "backHtml": back_rich if back_rich else (front_rich_a if is_cloze else ""),
            "reading": self._plain_text_summary(reading_raw),
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
        except Exception:
            pass

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
