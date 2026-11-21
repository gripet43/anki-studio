# -*- coding: utf-8 -*-
"""Enhanced Cloze 2.1 v2 自动沙盒识别与沙盒相对脚本路径解析单元测试。"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from _addon_bootstrap import ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os.bridge.media_utils import (  # noqa: E402
    find_sandbox_preload_scripts,
    resolve_media_for_sandbox,
)
from anki_modern_os.bridge.review_service import ReviewService  # noqa: E402


class TestEnhancedClozeSandboxSupport(unittest.TestCase):
    def _service(self):
        return ReviewService(
            col_getter=lambda: None, mw_getter=lambda: None, lang_getter=lambda: "zh-CN"
        )

    @staticmethod
    def _model(name: str, qfmt: str, afmt: str = ""):
        return {"name": name, "tmpls": [{"qfmt": qfmt, "afmt": afmt}]}

    def test_enhanced_cloze_detected_by_dom_markers_and_model_name(self):
        model_by_dom = self._model(
            "Custom Cloze",
            '<span id="enhanced-clozes"></span>'
            '<span id="enhanced-cloze-content" style="display:none">{{Content}}</span>'
            "<script>enhancedClozesMain()</script>",
        )
        self.assertTrue(self._service()._template_needs_script_shim(model_by_dom))

        model_by_name = self._model(
            "Enhanced Cloze 2.1 v2",
            '<div id="card-body"></div><script>$(function(){})</script>',
        )
        self.assertTrue(self._service()._template_needs_script_shim(model_by_name))

        plain_cloze = self._model("Cloze", "{{cloze:Text}}")
        self.assertFalse(self._service()._template_needs_script_shim(plain_cloze))

    def test_cloze_overlapping_and_generic_hidden_script_templates_detected(self):
        svc = self._service()
        co_by_dom = self._model(
            "My Custom Anatomy Cloze",
            '<div id="cloze-original" hidden="">{{Text}}</div>'
            '<div id="cloze-js-rendered"></div><script>render()</script>',
        )
        self.assertTrue(svc._template_needs_script_shim(co_by_dom))

        co_by_name = self._model(
            "Cloze Overlapping",
            '<div id="body"></div><script>render()</script>',
        )
        self.assertTrue(svc._template_needs_script_shim(co_by_name))

        # 通用结构检测：任意未知命名模板，若正文藏在 hidden / display:none 中且仅靠脚本渲染，应自动判 True
        unknown_hidden_q = (
            '<div class="slidecontainer"><input type="range" id="myRange"></div>'
            '<div id="raw-src" hidden="">Organization Hierarchy of Anatomy</div>'
            '<div id="target"></div><script>fill()</script>'
        )
        self.assertTrue(svc._question_hides_body_without_script(unknown_hidden_q))

        unknown_display_none_q = (
            '<span style="color:red; display: none;">Hidden prompt</span>'
            '<div id="mount"></div><script>mount()</script>'
        )
        self.assertTrue(svc._question_hides_body_without_script(unknown_display_none_q))

        # 有可见文字或可见图片的普通脚本模板不可误判
        normal_with_script_q = (
            '<div>Visible question text</div>'
            '<div hidden="">Metadata</div><script>console.log(1)</script>'
        )
        self.assertFalse(svc._question_hides_body_without_script(normal_with_script_q))

        visible_img_with_script_q = (
            '<img src="diagram.png"><div hidden="">meta</div><script>init()</script>'
        )
        self.assertFalse(svc._question_hides_body_without_script(visible_img_with_script_q))

        # 无脚本或隐藏容器也为空的空卡不可误判
        no_script_q = '<div hidden="">Only hidden</div>'
        self.assertFalse(svc._question_hides_body_without_script(no_script_q))

        truly_blank_q = '<div hidden=""></div><script>noop()</script>'
        self.assertFalse(svc._question_hides_body_without_script(truly_blank_q))

    def test_resolve_media_for_sandbox_rewrites_relative_script_src(self):
        base = "http://localhost:8765/"
        html_in = (
            '<script src="_jquery.min.js"></script>'
            '<script src="./_vendor.js"></script>'
            '<script src="https://localhost:9443/lib.js"></script>'
            '<script src="/abs.js"></script>'
            "<script>var a = 1;</script>"
        )
        out = resolve_media_for_sandbox(html_in, media_dir="", http_base_url=base)
        self.assertIn(f'src="{base}_jquery.min.js"', out)
        self.assertIn(f'src="{base}_vendor.js"', out)
        self.assertIn('src="https://localhost:9443/lib.js"', out)
        self.assertIn('src="/abs.js"', out)
        self.assertIn("<script>var a = 1;</script>", out)

    def test_find_sandbox_preload_scripts_is_strictly_on_demand(self):
        base = "http://localhost:8765/"
        with tempfile.TemporaryDirectory() as tmpdir:
            jquery_file = Path(tmpdir) / "_jquery.min.js"
            enhanced_model = self._model(
                "Enhanced Cloze 2.1 v2",
                '<span id="enhanced-clozes"></span><script>$(function(){})</script>',
            )
            gdata_model = self._model(
                "选择题模板",
                '<ol id="optionList"></ol><script>gData.options = [];</script>',
            )

            self.assertEqual(find_sandbox_preload_scripts(enhanced_model, tmpdir, base), [])

            jquery_file.write_text("/* jquery */", encoding="utf-8")
            self.assertEqual(
                find_sandbox_preload_scripts(enhanced_model, tmpdir, base),
                [f"{base}_jquery.min.js"],
            )
            self.assertEqual(find_sandbox_preload_scripts(gdata_model, tmpdir, base), [])


if __name__ == "__main__":
    unittest.main()
