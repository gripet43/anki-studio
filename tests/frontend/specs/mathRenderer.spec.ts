// ============================================================================
// Math rendering in card HTML
// 卡包常把 LaTeX 直接写进字段（PCSI 法语数学卡组用 `[$]&nbsp;sin(\frac{\pi}{2}-t)[/$]`）。
// 这里守住三件事：HTML 实体不能在公式里变字面量、函数名是正体、原始 < > 不被当标签。
// ============================================================================

import { section, test, ok, doesNotMatch } from '../harness';
import { renderMathAndRichHtml } from '../../../frontend/src/utils/mathRenderer';

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
