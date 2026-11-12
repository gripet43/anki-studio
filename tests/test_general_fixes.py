# -*- coding: utf-8 -*-
"""三处通用修复的回归测试。

这三条都是「静默降级」型 bug —— 界面不报错，只是悄悄变得不对，所以必须用
行为断言钉住，而不是靠字符串审计：

1. ``convert_furigana_to_ruby`` 在沙盒路径上把模板 ``<style>`` / ``<script>`` 整段删掉：
   沙盒 iframe 里只剩无样式裸文本，测试若只比对正文根本发现不了。
   修法是先把这两类块提取成占位符，转换完再原样拼回。
2. 搜索接口漏发 ``replaceFrontOnFlip``，编辑器翻面预览会重复展示正面；
   多模板卡型的正面字段只按内容猜，两条模板共用的字段会互相命中。
   修法是模板 ``qfmt`` 优先、内容比对兜底，并让搜索与复习共用同一判定。
3. 卡片库 / Cmd+K 打开的词库卡不带模板 CSS，编辑器预览掉样式。
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ADDON_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ADDON_ROOT.parent))

from anki_modern_os.bridge.media_utils import (  # noqa: E402
    card_template_dict,
    convert_furigana_to_ruby,
    pick_display_field,
    resolve_front_field_name,
    resolve_media_for_sandbox,
    resolve_replace_front_on_flip,
    template_field_references,
)
from anki_modern_os.bridge.search_service import SearchService  # noqa: E402

FURIGANA_RUBY = "<ruby>山田<rt>やまだ</rt></ruby>"


class FakeTemplateCard:
    """只暴露 card.template() / card.ord，用于多模板正面判定。"""

    def __init__(self, qfmt: str = "", ord_index: int = 0):
        self._qfmt = qfmt
        self.ord = ord_index

    def template(self):
        return {"qfmt": self._qfmt, "afmt": "{{FrontSide}}<hr id=answer>{{Back}}"}


class FakeTemplateCardWithoutTemplate:
    """card.template() 返回 None，逼出 note.note_type()['tmpls'][ord] 兜底路径。"""

    def __init__(self, qfmt: str = "", ord_index: int = 1):
        self.ord = ord_index
        self._tmpls = [
            {"qfmt": "{{FirstTemplateField}}", "afmt": "{{FrontSide}}"},
            {"qfmt": qfmt, "afmt": "{{FrontSide}}"},
        ]

    def template(self):
        return None

    def note(self):
        return FakeNote(note_type={"id": 1, "name": "Multi", "type": 0, "tmpls": self._tmpls})


class TestFuriganaStyleProtection(unittest.TestCase):
    """修复 1：沙盒路径不得删掉模板 <style> / <script>。"""

    def test_display_path_still_strips_style_and_script(self):
        out = convert_furigana_to_ruby(
            "<style>.a{color:red}</style>山田[やまだ]<script>var x=1;</script>"
        )
        self.assertNotIn("<style", out)
        self.assertNotIn("<script", out)
        self.assertIn(FURIGANA_RUBY, out)

    def test_preserve_mode_keeps_blocks_byte_for_byte(self):
        style_block = '<style>.card .word{content:"山田[やまだ]";color:#123}</style>'
        script_block = '<script>function f(){return "私[わたし]";}</script>'
        out = convert_furigana_to_ruby(
            style_block + script_block + "<p>山田[やまだ]</p>",
            preserve_style_blocks=True,
        )
        self.assertIn(style_block, out, "样式表必须原样保留（含块内的方括号文本）")
        self.assertIn(script_block, out, "脚本必须原样保留")
        self.assertIn(FURIGANA_RUBY, out, "正文里的振假名仍应转换")

    def test_preserve_mode_restores_blocks_in_original_order(self):
        html = "<style>A{}</style><p>山田[やまだ]</p><script>B</script><style>C{}</style>"
        out = convert_furigana_to_ruby(html, preserve_style_blocks=True)
        self.assertLess(out.index("<style>A{}"), out.index("<script>B</script>"))
        self.assertLess(out.index("<script>B</script>"), out.index("<style>C{}"))

    def test_sandbox_render_keeps_template_css_and_scripts(self):
        html = (
            '<div class="card">'
            '<style>.word{font-size:32px}</style>'
            '<script>var label="山田[やまだ]";</script>'
            "<p>山田[やまだ]</p>"
            "</div>"
        )
        out = resolve_media_for_sandbox(html)
        self.assertIn('<style>.word{font-size:32px}</style>', out)
        self.assertIn('<script>var label="山田[やまだ]";</script>', out)
        self.assertIn(FURIGANA_RUBY, out)

    def test_mdx_markers_still_cleaned_outside_protected_blocks(self):
        out = convert_furigana_to_ruby(
            "<style>.x{}</style>`1`词汇`2`",
            preserve_style_blocks=True,
        )
        self.assertNotIn("`1`", out)
        self.assertNotIn("`2`", out)
        self.assertIn("<style>.x{}</style>", out)


class TestMultiTemplateFrontField(unittest.TestCase):
    """修复 2：多模板卡型的正面字段按当前卡自己的模板判定。"""

    FIELDS = {
        "NoteID": "469b5ba2-a0bb-11ef",
        "VocabKanji": "山田",
        "VocabDefSC": "やまだ",
        "Example1": "山田[やまだ]は恩人[おんじん]です。",
    }

    def test_template_references_ignore_special_tokens(self):
        refs = template_field_references(
            "{{FrontSide}}{{Tags}}{{text:VocabKanji}}{{#Example1}}{{Example1}}{{/Example1}}"
        )
        self.assertEqual(refs, ["VocabKanji", "Example1"])

    def test_front_follows_the_cards_own_template(self):
        kanji_card = FakeTemplateCard("{{VocabKanji}}", 0)
        def_card = FakeTemplateCard("{{VocabDefSC}}", 1)
        self.assertEqual(
            resolve_front_field_name(self.FIELDS, "<div>山田</div>", kanji_card),
            "VocabKanji",
        )
        self.assertEqual(
            resolve_front_field_name(self.FIELDS, "<div>やまだ</div>", def_card),
            "VocabDefSC",
            "同一条笔记的第二条模板必须取自己的正面字段，而不是第一条模板的",
        )

    def test_metadata_reference_is_skipped_when_a_real_field_follows(self):
        # 模板同时引用了元数据字段与业务字段时，元数据必须被跳过。
        card = FakeTemplateCard("{{NoteID}}{{VocabKanji}}")
        self.assertEqual(
            resolve_front_field_name(self.FIELDS, "<div>山田</div>", card),
            "VocabKanji",
        )

    def test_falls_back_to_note_type_template_when_card_template_missing(self):
        card = FakeTemplateCardWithoutTemplate("{{VocabDefSC}}", 1)
        self.assertEqual(
            resolve_front_field_name(self.FIELDS, "<div>やまだ</div>", card),
            "VocabDefSC",
        )

    def test_falls_back_to_content_matching_without_template(self):
        self.assertEqual(
            resolve_front_field_name(self.FIELDS, "<div>山田</div>", None),
            pick_display_field(self.FIELDS, "<div>山田</div>"),
        )

    def test_card_template_dict_handles_broken_cards(self):
        self.assertEqual(card_template_dict(None), {})
        self.assertEqual(card_template_dict(object()), {})


class TestReplaceFrontOnFlip(unittest.TestCase):
    """修复 2：Cloze / IO 一律不整页替换，普通卡按模板与正文判定。"""

    def test_front_side_marker_means_replace(self):
        card = FakeTemplateCard("{{VocabKanji}}")
        self.assertTrue(
            resolve_replace_front_on_flip(card, "山田", "<div>山田</div>")
        )

    def test_cloze_and_io_never_replace(self):
        card = FakeTemplateCard("{{VocabKanji}}")
        self.assertFalse(
            resolve_replace_front_on_flip(card, "山田", "<div>山田</div>", is_cloze=True)
        )
        self.assertFalse(
            resolve_replace_front_on_flip(
                card, "山田", "<div>山田</div>", is_image_occlusion=True
            )
        )

    def test_plain_card_without_front_side_does_not_replace(self):
        class PlainCard:
            def template(self):
                return {"qfmt": "{{Q}}", "afmt": "<hr id=answer>{{A}}"}

        self.assertFalse(
            resolve_replace_front_on_flip(PlainCard(), "问题", "<div>完全不同的答案</div>")
        )


class FakeRenderOutput:
    def __init__(self, question: str, answer: str, css: str = ""):
        self.question_text = question
        self.answer_text = answer
        self.css = css
        self.question_av_tags = []
        self.answer_av_tags = []


class FakeNoteModel(dict):
    pass


class FakeNote:
    def __init__(self, note_type, items=None):
        self._note_type = note_type
        self._items = items or {}
        self.id = 9001
        self.mid = note_type.get("id", 1)
        self.tags = ["词库"]
        self.sfld = ""

    def items(self):
        return list(self._items.items())

    def note_type(self):
        return self._note_type

    @property
    def fields(self):
        return self._items


class FakeCardForSearch:
    def __init__(self, note, template, output):
        self.id = 8001
        self.nid = 9001
        self.did = 1
        self.note_ = note
        self.ord = 1
        self.queue = 2
        self.type = 2
        self.due = 5
        self.ivl = 4
        self.reps = 3
        self.lapses = 0
        self.flags = 0
        self.memory_state = None
        self._template = template
        self._output = output

    def note(self):
        return self.note_

    def template(self):
        return self._template

    def render_output(self):
        return self._output


class FakeDecks:
    def __init__(self, deck):
        self._deck = deck

    def get(self, did, default=False):
        return self._deck


class FakeSched:
    today = 100


class FakeCol:
    def __init__(self, card, note, deck):
        self._card = card
        self._note = note
        self.decks = FakeDecks(deck)
        self.sched = FakeSched()

    def get_card(self, cid):
        return self._card

    def get_note(self, nid):
        return self._note


class TestSearchServiceExposesReplaceFrontOnFlip(unittest.TestCase):
    """修复 2：搜索接口必须下发 replaceFrontOnFlip，且正面字段按卡自己的模板判定。"""

    def _serialize(self, qfmt: str, fields: dict, question: str, answer: str):
        note_type = {
            "id": 1,
            "name": "Multi",
            "type": 0,
            "tmpls": [
                {"qfmt": "{{VocabKanji}}", "afmt": "{{FrontSide}}"},
                {"qfmt": qfmt, "afmt": "{{FrontSide}}<hr id=answer>{{Answer}}"},
            ],
        }
        note = FakeNote(note_type, fields)
        template = {"qfmt": qfmt, "afmt": "{{FrontSide}}<hr id=answer>{{Answer}}"}
        output = FakeRenderOutput(question, answer)
        card = FakeCardForSearch(note, template, output)
        col = FakeCol(card, note, {"id": 1, "name": "词库"})
        service = SearchService(col_getter=lambda: col)
        return service._serialize_library_card(col, 8001)

    def test_replace_front_on_flip_is_serialized(self):
        item = self._serialize(
            "{{VocabDefSC}}",
            {"NoteID": "uuid-1", "VocabKanji": "山田", "VocabDefSC": "やまだ", "Answer": "释义"},
            "<div>やまだ</div>",
            "<div>やまだ</div><hr id=answer><div>释义</div>",
        )
        self.assertIsNotNone(item)
        assert item is not None
        self.assertTrue(item["replaceFrontOnFlip"])

    def test_front_uses_the_cards_template_not_the_first_field(self):
        item = self._serialize(
            "{{VocabDefSC}}",
            {"NoteID": "uuid-1", "VocabKanji": "山田", "VocabDefSC": "やまだ", "Answer": "释义"},
            "<div>やまだ</div>",
            "<div>やまだ</div><hr id=answer><div>释义</div>",
        )
        self.assertIsNotNone(item)
        assert item is not None
        self.assertEqual(item["front"], "やまだ", "多模板卡必须按当前卡模板取正面字段")
        self.assertNotEqual(item["front"], "uuid-1")


if __name__ == "__main__":
    unittest.main()
