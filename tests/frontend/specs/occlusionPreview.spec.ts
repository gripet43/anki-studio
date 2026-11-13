// ============================================================================
// Image Occlusion · 预览态的遮罩渲染
//
// 背景（2026-11-13 用户报障）：在「新建卡片」里应用遮挡后点预览，整块卡片是空白的。
// 原因不在渲染，而在取数：遮挡卡的正/背文本并不在 front/back 输入框里（用户什么都
// 没写），图片与遮罩全挂在 ioPayload 上。预览只读 front/back，于是正面只剩
// placeholder、背面空白。
//
// 修法是把 ioPayload.previewHtml 当作正面内容源，交给 renderMathAndRichHtml。
// 这个用例守住后半段：`{{c1::label}}` 必须真的被换成**有背景色**的色块，
// 而不是留下一个「有定位、没背景」的透明 span（那正是 v1.5.0 之前翻面后
// 图上飘灰字的老毛病）。
//
// 两种状态的语义（与 Anki 原生一致）：
//   问题态 → 被问的那组遮罩盖住；答案态 → 揭晓。
// ============================================================================

import { section, test, ok, equal, matches, doesNotMatch } from '../harness';
import { renderMathAndRichHtml } from '../../../frontend/src/utils/mathRenderer';
import { buildNativeOcclusion } from '../../../frontend/src/components/quick-add/ImageOcclusionEditorModal';

const RECTS = [
  { id: 'a', clozeIndex: 1, leftPct: 10, topPct: 20, widthPct: 30, heightPct: 15, label: 'Area 1' },
  { id: 'b', clozeIndex: 1, leftPct: 55, topPct: 60, widthPct: 12, heightPct: 10, label: 'Area 2' },
];

function payload(mode: 'hide-all' | 'hide-one') {
  return buildNativeOcclusion({
    titleText: '胸廓解剖',
    imgSrc: 'paste_1.jpg',
    mode,
    rects: RECTS as any,
  });
}

section('image occlusion · preview html is renderable');

test('previewHtml 带着图片、标题与两个遮罩框', () => {
  const { previewHtml } = payload('hide-all');
  ok(previewHtml.includes('anki-io-wrap'), 'must build an io wrapper');
  ok(previewHtml.includes('<img src="paste_1.jpg"'), 'must keep the image');
  ok(previewHtml.includes('胸廓解剖'), 'must keep the header text');
  equal((previewHtml.match(/anki-io-rect\b/g) || []).length, 2, 'both masks present');
});

test('问题态：遮罩被换成有背景的色块，不留裸 {{c1::}}', () => {
  const html = renderMathAndRichHtml(payload('hide-all').previewHtml, true, 1);
  doesNotMatch(html, /\{\{c\d+::/, 'raw cloze syntax must not survive');
  equal((html.match(/anki-io-rect-resolved/g) || []).length, 2, 'both masks resolved');
  // 单组遮挡卡：每个框都是「本题要猜的那块」，走 target 样式（琥珀底 + ? #1）。
  equal((html.match(/anki-io-target/g) || []).length, 2, 'all masks are the asked one');
  matches(html, /background:#F59E0B/, 'target mask must be opaque, not a bare span');
  ok(html.includes('? #1'), 'target mask carries the ordinal hint');
  ok(html.includes('<img src="paste_1.jpg"'), 'image survives rendering');
});

test('答案态：同一份 HTML 换成揭晓样式（绿框）', () => {
  const html = renderMathAndRichHtml(payload('hide-all').previewHtml, false, 1);
  equal((html.match(/anki-io-revealed/g) || []).length, 2, 'both masks revealed');
  matches(html, /background:rgba\(16,185,129/, 'revealed uses the success tint');
  doesNotMatch(html, /anki-io-target/, 'no target marker on the answer side');
});

test('hide-one 模式下非本题的遮罩必须彻底让开（opacity:0），不能挡住答案', () => {
  const html = renderMathAndRichHtml(payload('hide-one').previewHtml, true, 2);
  ok(html.includes('anki-io-hidden'), 'other groups are hidden, not masked');
  matches(html, /opacity:0/, 'hidden mask must be fully transparent');
});

test('普通卡片（无 anki-io-wrap）不受影响', () => {
  const html = renderMathAndRichHtml('<p>hello</p>', true, 1);
  equal(html, '<p>hello</p>', 'non-occlusion html must pass through untouched');
});
