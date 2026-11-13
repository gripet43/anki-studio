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


class FakeQueuedEntry:
    def __init__(self, cid):
        self.card = type("Card", (), {"id": cid})()


class FakeQueuedCards:
    def __init__(self, cids):
        self.cards = [FakeQueuedEntry(cid) for cid in cids]


class FakeNativeSched:
    def __init__(self, cids):
        self._cids = list(cids)

    def get_queued_cards(self, fetch_limit: int = 1):
        return FakeQueuedCards(self._cids[: max(1, fetch_limit)])


class FakeDecksForQueue:
    def __init__(self):
        self.selected = None

    def select(self, did):
        self.selected = did

    def get(self, did, default=False):
        return {"id": did, "name": "Deck %s" % did}


class FakeColForQueue:
    def __init__(self, native_cids=None, fallback_cids=None, native_supported=True):
        self.decks = FakeDecksForQueue()
        self._fallback = list(fallback_cids or [])
        self.find_cards_calls = 0
        sched = type("Sched", (), {"today": 100})()
        if native_supported:
            sched.get_queued_cards = FakeNativeSched(native_cids or []).get_queued_cards
        self.sched = sched

    def find_cards(self, query):
        self.find_cards_calls += 1
        return list(self._fallback)


class TestNativeSchedulerQueue(unittest.TestCase):
    """复习队列必须跟随 Anki 原生 v3 调度器顺序（同一笔记多张卡时尤其重要）。"""

    def _service(self, col):
        from anki_modern_os.bridge.review_service import ReviewService

        svc = ReviewService(
            col_getter=lambda: col, mw_getter=lambda: None, lang_getter=lambda: "zh-CN"
        )
        svc._serialize_review_card = lambda col, cid, lang, preview: {"id": str(cid)}
        return svc

    def test_native_queue_returns_none_when_scheduler_api_missing(self):
        col = FakeColForQueue(native_supported=False)
        self.assertIsNone(self._service(col)._native_queued_cids(col, "1", 10))

    def test_no_deck_id_keeps_legacy_all_decks_semantics(self):
        col = FakeColForQueue(native_cids=[30], fallback_cids=["10"])
        svc = self._service(col)
        self.assertIsNone(
            svc._native_queued_cids(col, None, 10),
            "无 deckId 的旧调用语义是整库，不能套用当前选中牌组的原生队列",
        )

    def test_native_queue_respects_empty_queue(self):
        col = FakeColForQueue(native_cids=[], fallback_cids=["9"])
        svc = self._service(col)
        # 支持 API 且队列为空 → 必须返回 []（尊重每日配额），而不是 None 回落。
        self.assertEqual(svc._native_queued_cids(col, "1", 10), [])

    def test_native_queue_keeps_scheduler_order(self):
        col = FakeColForQueue(native_cids=[30, 10, 20], fallback_cids=["10", "20", "30"])
        svc = self._service(col)
        self.assertEqual(svc._native_queued_cids(col, "1", 10), [30, 10, 20])

    def test_review_queue_follows_native_order(self):
        # find_cards 的旧顺序是 [10, 20, 30]；原生顺序是 [30, 10, 20]。
        col = FakeColForQueue(native_cids=[30, 10, 20], fallback_cids=["10", "20", "30"])
        svc = self._service(col)
        result = svc.get_review_queue({"deckId": "1", "language": "zh-CN", "limit": 10})
        self.assertEqual([c["id"] for c in result["cards"]], ["30", "10", "20"])
        self.assertEqual(result["totalDue"], 3)
        self.assertEqual(col.find_cards_calls, 0, "有原生队列时不应再走 find_cards")

    def test_exhausted_native_queue_does_not_fall_back(self):
        col = FakeColForQueue(native_cids=[], fallback_cids=["10", "20"])
        svc = self._service(col)
        result = svc.get_review_queue({"deckId": "1", "language": "zh-CN", "limit": 10})
        self.assertEqual(result["cards"], [])
        self.assertEqual(result["totalDue"], 0)
        self.assertEqual(col.find_cards_calls, 0, "配额用尽时不得回落成无限新卡")

    def test_falls_back_to_find_cards_when_api_unavailable(self):
        col = FakeColForQueue(fallback_cids=["10", "20"], native_supported=False)
        svc = self._service(col)
        result = svc.get_review_queue({"deckId": "1", "language": "zh-CN", "limit": 10})
        self.assertEqual([c["id"] for c in result["cards"]], ["10", "20"])
        self.assertEqual(col.find_cards_calls, 2, "旧路径应分别查 due/learn 与 new")


class TestFrontSideHiddenContent(unittest.TestCase):
    """词库卡（柯林斯等）正面不能把模板默认隐藏的内容摊开。

    真凶：`scope_card_css(reveal_hidden=True)` 会删掉模板里的 `display:none`，那是给
    **背面**揭底用的；正面若也用同一份样式表，`{{hint::…}}` 与 `#ext_collins` 这类
    「点击才展开」的内容会直接在正面全部显示（用户看到的「正面多出一大段例句/详解」）。
    """

    CSS_WITH_HIDDEN = (
        ".card { color: #333; }"
        "#ext_collins { display:none; }"
        ".extension { display:block; }"
    )
    HINT_HTML = (
        '<a class=hint href="#">提示</a>'
        '<div id="hintabc" class=hint style="display: none">隐藏的提示内容</div>'
    )

    def test_hints_stay_hidden_on_front(self):
        from anki_modern_os.bridge.media_utils import sanitize_rendered_card_html

        front = sanitize_rendered_card_html(self.HINT_HTML, reveal_hints=False)
        self.assertIn("隐藏的提示内容", front)
        self.assertIn("display: none", front, "正面必须保留 hint 的 display:none")
        self.assertNotIn("<a class=hint", front, "无脚本环境下入口链接没有意义，应移除")

    def test_hints_are_revealed_on_answer(self):
        from anki_modern_os.bridge.media_utils import sanitize_rendered_card_html

        answer = sanitize_rendered_card_html(self.HINT_HTML, reveal_hints=True)
        self.assertIn("隐藏的提示内容", answer)
        self.assertNotIn("display: none", answer, "背面必须揭开 hint 内容，否则永远不可达")

    def test_front_css_keeps_display_none(self):
        from anki_modern_os.bridge.media_utils import build_card_css

        front_css = build_card_css(self.CSS_WITH_HIDDEN, "", reveal_hidden=False)
        self.assertIn("#ext_collins", front_css)
        self.assertIn("display:none", front_css.replace(" ", ""))

    def test_back_css_reveals_hidden_sections(self):
        from anki_modern_os.bridge.media_utils import build_card_css

        back_css = build_card_css(self.CSS_WITH_HIDDEN, "", reveal_hidden=True)
        self.assertNotIn("display:none", back_css.replace(" ", ""))

    def test_render_native_card_sides_emits_both_css_variants(self):
        from anki_modern_os.bridge.media_utils import render_native_card_sides

        class FakeOutput:
            question_text = '<div id="ext_collins" class="extension">详解</div>' + self.HINT_HTML
            answer_text = '<div id="ext_collins" class="extension">详解</div>' + self.HINT_HTML
            css = self.CSS_WITH_HIDDEN
            question_av_tags = []
            answer_av_tags = []

        render = render_native_card_sides(None, "", raw_output=FakeOutput())
        self.assertIn("display:none", render.question_css.replace(" ", ""))
        self.assertIn(
            ".anki-native-card-front",
            render.question_css,
            "正面样式表必须挂在独立作用域根上，才能和背面同时出现时互不覆盖",
        )
        self.assertNotIn(".anki-native-card-front", render.css)
        self.assertNotIn("display:none", render.css.replace(" ", ""))
        self.assertIn("display: none", render.question, "正面 hint 内容必须保持隐藏")
        self.assertNotIn("display: none", render.answer, "背面 hint 内容必须揭开")


class TestSearchShipsFrontAndBackStyles(unittest.TestCase):
    """搜索接口必须同时下发「正面样式（保留隐藏）」与「背面样式（揭开隐藏）」。"""

    CSS_WITH_HIDDEN = TestFrontSideHiddenContent.CSS_WITH_HIDDEN

    def test_serialize_library_card_fills_both_style_sinks(self):
        from anki_modern_os.bridge.search_service import SearchService

        note_type = {
            "id": 1,
            "name": "Collins",
            "type": 0,
            "tmpls": [{"qfmt": "{{Word}}", "afmt": "{{FrontSide}}<hr id=answer>{{Back}}"}],
        }
        note = FakeNote(note_type, {"Word": "perceive", "Back": "释义"})
        template = note_type["tmpls"][0]
        output = FakeRenderOutput(
            "<div>perceive</div>", "<div>释义</div>", css=self.CSS_WITH_HIDDEN
        )
        card = FakeCardForSearch(note, template, output)
        col = FakeCol(card, note, {"id": 1, "name": "考研英语真题生词"})
        service = SearchService(col_getter=lambda: col)

        back_sink, front_sink = {}, {}
        item = service._serialize_library_card(
            col, 8001, "", "zh-CN", back_sink, front_sink
        )
        self.assertIsNotNone(item)
        self.assertIn("1", back_sink, "背面样式必须按卡型下发")
        self.assertIn("1", front_sink, "正面样式必须按卡型下发")
        self.assertIn(".anki-native-card-front", front_sink["1"])
        self.assertNotIn(".anki-native-card-front", back_sink["1"])
        self.assertIn("display:none", front_sink["1"].replace(" ", ""))
        self.assertNotIn("display:none", back_sink["1"].replace(" ", ""))


class TestScopeCardCssAtStatements(unittest.TestCase):
    """模板 CSS 以 @charset / @namespace 开头时，后面的选择器不能被当成 at-rule。

    真实反例：eggrolls-JLPT10k 的模板 CSS 第一行是 ``@charset "UTF-8";``，
    紧跟的 ``.\\!hidden{display:none!important}`` 曾因此既没作用域化、也没被
    「背面揭开隐藏」逻辑处理。
    """

    CHARSET_CSS = '@charset "UTF-8";\n.\\!hidden{display:none!important}\n.x{color:red}'

    def test_back_css_scopes_and_reveals_after_charset(self):
        from anki_modern_os.bridge.media_utils import build_card_css

        back = build_card_css(self.CHARSET_CSS, "", reveal_hidden=True)
        self.assertIn(".anki-native-card .x", back, "选择器必须正常作用域化")
        self.assertNotIn("display:none", back.replace(" ", ""), "背面必须揭开隐藏")
        self.assertIn('@charset "UTF-8";', back, "@charset 语句本身应保留")

    def test_front_css_scopes_and_keeps_hidden_after_charset(self):
        from anki_modern_os.bridge.media_utils import build_card_css

        front = build_card_css(self.CHARSET_CSS, "", reveal_hidden=False)
        self.assertIn(".anki-native-card .\\!hidden", front, "隐藏类规则必须正常作用域化")
        self.assertIn("display:none", front.replace(" ", ""), "正面必须保留隐藏")


class TestSandboxMediaSettings(unittest.TestCase):
    """兼容模式图片依赖 WebView 能加载本地媒体服务的 http 资源。

    回归背景：SPA 用 file:// 加载，QtWebEngine 默认 LocalContentCanAccessRemoteUrls
    = False，沙盒 iframe 里的 http://127.0.0.1:<port> 图片会被引擎层拦截，
    表现为「默认模式正常、兼容模式全是破图」。
    """

    def test_webview_enables_local_content_remote_urls(self):
        source = (ADDON_ROOT / "__init__.py").read_text(encoding="utf-8")
        self.assertIn("QWebEngineSettings", source)
        self.assertIn("LocalContentCanAccessRemoteUrls", source)
        self.assertIn("LocalContentCanAccessFileUrls", source)


class _FakeQueueEntry:
    def __init__(self, cid):
        self.card = type("Card", (), {"id": cid})()


class _FakeQueuedCards:
    def __init__(self, cids):
        self.cards = [_FakeQueueEntry(cid) for cid in cids]


class _FakeDeckNode:
    def __init__(self, deck_id, pending, children=()):
        self.deck_id = deck_id
        self.name = "deck-%s" % deck_id
        self.new_count = 0
        self.learn_count = 0
        self.review_count = pending
        self.children = list(children)


class _FakeAllDecksCol:
    """模拟跨顶层牌组取原生队列所需的 col.sched / col.decks 接口。"""

    def __init__(self, nodes, queues):
        self._queues = {int(k): list(v) for k, v in queues.items()}
        self._current = 1
        self.selected = []
        self.sched = type("Sched", (), {})()
        self.sched.deck_due_tree = lambda: type("Tree", (), {"children": list(nodes)})()
        self.sched.get_queued_cards = self._get_queued
        self.decks = type("Decks", (), {})()
        self.decks.select = self._select
        self.decks.current = lambda: {"id": self._current}

    def _select(self, did):
        self._current = int(did)
        self.selected.append(self._current)

    def _get_queued(self, fetch_limit=1):
        return _FakeQueuedCards(self._queues.get(self._current, [])[: max(1, fetch_limit)])


class TestAllDecksNativeQueue(unittest.TestCase):
    """首页「开始今日学习」必须跨全部顶层牌组取原生队列，与首页数字同口径。"""

    def _service(self, col=None):
        from anki_modern_os.bridge.review_service import ReviewService

        return ReviewService(
            col_getter=lambda: col, mw_getter=lambda: None, lang_getter=lambda: "zh-CN"
        )

    def test_merges_top_level_decks_in_order(self):
        col = _FakeAllDecksCol(
            [_FakeDeckNode(10, 3), _FakeDeckNode(20, 2)],
            {10: [101, 102, 103], 20: [201, 202]},
        )
        svc = self._service()
        self.assertEqual(svc._native_queued_cids(col, "all", 100), [101, 102, 103, 201, 202])
        self.assertEqual(col.selected[-1], 1, "取完队列后必须恢复原来的当前牌组")
        self.assertEqual(col._current, 1)

    def test_respects_limit_and_dedupes(self):
        col = _FakeAllDecksCol(
            [_FakeDeckNode(10, 3), _FakeDeckNode(20, 2)],
            {10: [101, 102, 103], 20: [102, 201]},
        )
        svc = self._service()
        self.assertEqual(svc._native_queued_cids(col, "all", 3), [101, 102, 103])
        self.assertEqual(svc._native_queued_cids(col, "all", 100), [101, 102, 103, 201])

    def test_skips_decks_without_pending_cards(self):
        col = _FakeAllDecksCol(
            [_FakeDeckNode(10, 0), _FakeDeckNode(20, 1)],
            {10: [101], 20: [201]},
        )
        svc = self._service()
        self.assertEqual(svc._native_queued_cids(col, "all", 100), [201])
        self.assertNotIn(10, col.selected)

    def test_returns_none_when_queue_api_missing(self):
        col = _FakeAllDecksCol([_FakeDeckNode(10, 1)], {10: [101]})
        del col.sched.get_queued_cards
        svc = self._service()
        self.assertIsNone(svc._native_queued_cids(col, "all", 100))

    def test_get_review_queue_all_uses_aggregated_native_order(self):
        col = _FakeAllDecksCol(
            [_FakeDeckNode(10, 2), _FakeDeckNode(20, 1)],
            {10: [101, 102], 20: [201]},
        )
        svc = self._service(col)
        svc._serialize_review_card = lambda col, cid, lang, preview: {"id": str(cid)}
        result = svc.get_review_queue({"deckId": "all", "language": "zh-CN", "limit": 10})
        self.assertEqual([c["id"] for c in result["cards"]], ["101", "102", "201"])
        self.assertEqual(result["totalDue"], 3)


class _StopAudioRecorder:
    def __init__(self, with_stop_and_clear=True):
        self.calls = []
        if with_stop_and_clear:
            self.stop_and_clear_queue = self._record_stop_and_clear

    def _record_stop_and_clear(self):
        self.calls.append("stop_and_clear_queue")

    def stop(self):
        self.calls.append("stop")


class TestStopAudio(unittest.TestCase):
    """离开复习界面必须停掉 Anki AVPlayer，否则音频会在首页继续响。"""

    def _service(self):
        from anki_modern_os.bridge.review_service import ReviewService

        return ReviewService(
            col_getter=lambda: None, mw_getter=lambda: None, lang_getter=lambda: "zh-CN"
        )

    def test_prefers_stop_and_clear_queue(self):
        import types
        from unittest import mock

        recorder = _StopAudioRecorder()
        sound = types.ModuleType("aqt.sound")
        sound.av_player = recorder
        aqt = types.ModuleType("aqt")
        aqt.sound = sound
        with mock.patch.dict(sys.modules, {"aqt": aqt, "aqt.sound": sound}):
            result = self._service().stop_audio({})
        self.assertTrue(result["stopped"])
        self.assertEqual(recorder.calls, ["stop_and_clear_queue"])

    def test_falls_back_to_player_stop(self):
        import types
        from unittest import mock

        recorder = _StopAudioRecorder(with_stop_and_clear=False)
        sound = types.ModuleType("aqt.sound")
        sound.av_player = recorder
        aqt = types.ModuleType("aqt")
        aqt.sound = sound
        with mock.patch.dict(sys.modules, {"aqt": aqt, "aqt.sound": sound}):
            result = self._service().stop_audio({})
        self.assertTrue(result["stopped"])
        self.assertEqual(recorder.calls, ["stop"])

    def test_returns_false_without_anki_runtime(self):
        import types
        from unittest import mock

        empty = types.ModuleType("aqt.sound")
        aqt = types.ModuleType("aqt")
        aqt.sound = empty
        with mock.patch.dict(sys.modules, {"aqt": aqt, "aqt.sound": empty}):
            result = self._service().stop_audio({})
        self.assertFalse(result["stopped"])
        self.assertIsInstance(result, dict)

    def test_router_exposes_stop_audio(self):
        from anki_modern_os.bridge.router import BridgeRouter

        router = BridgeRouter(col_getter=lambda: None, mw_getter=lambda: None)
        self.assertIn("stopped", router.action_stop_audio({}))


class TestAboutPanelBackend(unittest.TestCase):
    """设置-关于：版本号必须读 manifest，外链必须只放行 http(s) 并交给系统浏览器。"""

    def test_studio_version_matches_manifest(self):
        import json

        from anki_modern_os.bridge.deck_service import DeckService

        manifest = json.loads((ADDON_ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(DeckService._studio_version(), manifest["human_version"])

    def test_external_link_opens_via_aqt(self):
        import types
        from unittest import mock

        from anki_modern_os.bridge.router import BridgeRouter

        opened = []
        fake_utils = types.ModuleType("aqt.utils")
        fake_utils.openLink = lambda url: opened.append(url)
        fake_aqt = types.ModuleType("aqt")
        fake_aqt.utils = fake_utils
        router = BridgeRouter(col_getter=lambda: None, mw_getter=lambda: None)
        url = "https://www.xiaohongshu.com/user/profile/6496d6f8000000001001ff0f"
        with mock.patch.dict(sys.modules, {"aqt": fake_aqt, "aqt.utils": fake_utils}):
            result = router.action_open_external_url({"url": url})
        self.assertTrue(result["opened"])
        self.assertEqual(opened, [url])

    def test_external_link_rejects_non_http_schemes(self):
        from anki_modern_os.bridge.router import BridgeRouter

        router = BridgeRouter(col_getter=lambda: None, mw_getter=lambda: None)
        for bad in ("javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "", "not-a-url"):
            result = router.action_open_external_url({"url": bad})
            self.assertFalse(result["opened"], bad)
            self.assertIn("error", result)
