// ============================================================================
// Math rendering in card HTML
// 卡包常把 LaTeX 直接写进字段（PCSI 法语数学卡组用 `[$]&nbsp;sin(\frac{\pi}{2}-t)[/$]`）。
// 这里守住三件事：HTML 实体不能在公式里变字面量、函数名是正体、原始 < > 不被当标签。
// ============================================================================

import { section, test, ok, equal, doesNotMatch } from '../harness';
import {
  renderMathAndRichHtml,
  hasSubstantiveMediaPreview,
} from '../../../frontend/src/utils/mathRenderer';

section('math renderer · entities');

test('&nbsp; inside a math expression never leaks as literal text', () => {
  const out = renderMathAndRichHtml('[$]&nbsp;sin(\\frac{\\pi}{2} - t )[/$]');
  doesNotMatch(out, /&nbsp;/i, '公式里不应出现字面量 &nbsp;');
  doesNotMatch(out, /&amp;nbsp;/i, '公式里不应出现被转义两次的 &amp;nbsp;');
  ok(out.includes('π'), '\\pi 应转成 π');
  ok(out.includes('sin'), '函数名应保留');
  ok(out.includes('inline-flex flex-col'), '\\frac 应渲染成分数结构');
});

test('&amp; is decoded once and re-escaped safely', () => {
  const out = renderMathAndRichHtml('[$]A &amp; B[/$]');
  ok(out.includes('A &amp; B'), '输出应保留安全的 &amp; 实体');
  doesNotMatch(out, /&amp;amp;/i);
});

section('math renderer · operators');

test('LaTeX function names render upright, not italic', () => {
  const out = renderMathAndRichHtml('[$]\\sin(x) + \\cos(y)[/$]');
  ok(
    out.includes('<span class="not-italic">sin</span>'),
    '\\sin 应渲染为正体（not-italic）'
  );
  ok(out.includes('<span class="not-italic">cos</span>'));
});

test('\\left / \\right sizing commands are removed', () => {
  const out = renderMathAndRichHtml('[$]\\left( x \\right)[/$]');
  doesNotMatch(out, /\\left|\\right/);
  ok(out.includes('x'));
});

section('math renderer · raw angle brackets');

test('raw < and > inside math are escaped instead of becoming tags', () => {
  const out = renderMathAndRichHtml('[$]a < b > c[/$]');
  ok(out.includes('&lt;') && out.includes('&gt;'));
  doesNotMatch(out, /<b>/);
});

section('math renderer · cloze ordinal pills');

test('multi-cloze question and answer render active pills and plain inactive clozes', () => {
  const src = '54353453453哈哈哈哈哈哈 {{c1::哈哈}} 哈哈低调{{c2::低调}}';
  const q1 = renderMathAndRichHtml(src, true, 1);
  ok(q1.includes('class="anki-cloze-question">[...]</span>'));
  ok(q1.includes('class="cloze-inactive" data-ordinal="2">低调</span>'));
  doesNotMatch(q1, /\{\{c\d+::/);

  const a1 = renderMathAndRichHtml(src, false, 1);
  ok(a1.includes('class="anki-cloze-answer">哈哈</span>'));
  ok(a1.includes('class="cloze-inactive" data-ordinal="2">低调</span>'));

  const q2 = renderMathAndRichHtml(src, true, 2);
  ok(q2.includes('class="cloze-inactive" data-ordinal="1">哈哈</span>'));
  ok(q2.includes('class="anki-cloze-question">[...]</span>'));
});

section('math renderer · substantive media preview');

test('tiny attribute-sized icons and inline UI badges do not classify text cards as media cards', () => {
  equal(
    hasSubstantiveMediaPreview(
      '<table width="100%"><tr><td>Word List 1</td><td><img src="0-books.png" width="15px"><a href="eudic://dict//sweat">Eudic</a></td></tr></table><div>sweat</div>'
    ),
    false,
    'TOEFL 绿宝书 15px 词典图标不应被判为大图媒体卡'
  );
  equal(
    hasSubstantiveMediaPreview('<img src="badge.png" style="width:16px;height:16px"> <span>note</span>'),
    false,
    '内联样式小于等于 36px 的图标不应被判为媒体卡'
  );
  equal(
    hasSubstantiveMediaPreview('<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg><span>ok</span>'),
    false,
    '小型内联 SVG 图标不应被判为媒体卡'
  );
});

test('real images, image occlusion, and mixed icon + photo cards still detect substantive media', () => {
  equal(
    hasSubstantiveMediaPreview('<div>Anatomy <img src="diagram.png"></div>'),
    true,
    '未限定小尺寸的图片应保留媒体卡识别'
  );
  equal(
    hasSubstantiveMediaPreview('<div>Chart <img src="chart.png" width="240"></div>'),
    true,
    '显式大尺寸图片（width="240"）应识别为媒体卡'
  );
  equal(
    hasSubstantiveMediaPreview('<div class="anki-io-wrap"><img src="io.png" width="18"></div>'),
    true,
    'Image Occlusion 容器应始终识别为媒体卡'
  );
  equal(
    hasSubstantiveMediaPreview('<div><img src="0-books.png" width="15px"> Eudic <img src="photo.jpg"></div>'),
    true,
    '同时包含小图标与正文配图时仍应识别为媒体卡'
  );
});
