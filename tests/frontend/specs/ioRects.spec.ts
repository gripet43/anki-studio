// ============================================================================
// Image Occlusion · rendered-mask restoration
//
// Anki 的渲染器会把 Occlusion 字段里的 `{{c1::label}}` 就地换成
// `<span class="cloze" data-ordinal="1">label</span>`。Studio 的遮罩正则只认原始
// `{{cN::}}` 写法，于是挖空框变成了一个「有定位、没背景」的 span，标签文字裸露在
// 图片上方 —— 用户看到的就是图上飘着 c1 / c2 / c3 三个灰字。
//
// 这里守住 restoreRenderedIoRects 的逆向还原：只动 anki-io-rect 里面的那一层，
// 别处的 cloze 一律不碰，对普通挖空卡是彻底的 no-op。
// ============================================================================

import { section, test, ok, equal, doesNotMatch } from '../harness';
import { restoreRenderedIoRects } from '../../../frontend/src/utils/mathRenderer';

const RENDERED = [
  '<div class="anki-io-wrap">',
  '<img src="paste_1.jpg">',
  '<span class="anki-io-rect" style="left:10%;top:20%;width:30%;height:15%" data-io-rect="1">',
  '<span class="cloze" data-ordinal="1">c1</span>',
  '</span>',
  '<span class="anki-io-rect" style="left:50%;top:60%;width:10%;height:10%" data-io-rect="2">',
  '<span class="cloze-inactive" data-ordinal="2">c2</span>',
  '</span>',
  '</div>',
].join('');

section('image occlusion · restore rendered masks');

test('rendered cloze inside a mask box is turned back into {{cN::}}', () => {
  const out = restoreRenderedIoRects(RENDERED);
  ok(out.includes('{{c1::c1}}'), '第一个遮罩应还原成 {{c1::c1}}');
  ok(out.includes('{{c2::c2}}'), '第二个遮罩应还原成 {{c2::c2}}');
  doesNotMatch(out, /class="cloze/, '遮罩内不应再留下 cloze span');
  ok(
    out.includes('class="anki-io-rect"'),
    '遮罩框本身必须保留（定位靠它）'
  );
  ok(out.includes('left:10%;top:20%'), '遮罩定位不能被改动');
});

test('restoration is idempotent', () => {
  const once = restoreRenderedIoRects(RENDERED);
  equal(restoreRenderedIoRects(once), once, '已经还原过的输入应原样返回');
});

test('ordinal falls back to data-io-rect when the inner span lost data-ordinal', () => {
  const noOrdinal = RENDERED.replace('<span class="cloze" data-ordinal="1">', '<span class="cloze">');
  const out = restoreRenderedIoRects(noOrdinal);
  ok(out.includes('{{c1::c1}}'), '应退回到外层 data-io-rect="1"');
});

test('cloze outside a mask box is never touched (plain cloze cards are a no-op)', () => {
  const plain = '<div>欧几里得求 <span class="cloze" data-ordinal="1">最大公约数</span></div>';
  equal(restoreRenderedIoRects(plain), plain, '普通挖空卡必须原样返回');

  // 同一个 HTML 里既有挖空卡又有遮挡卡时，也只能改遮挡框里面那个
  const mixed = `${plain}${RENDERED}`;
  const out = restoreRenderedIoRects(mixed);
  ok(
    out.includes('<span class="cloze" data-ordinal="1">最大公约数</span>'),
    '框外的 cloze 必须保持渲染态'
  );
  ok(out.includes('{{c1::c1}}'), '框内的 cloze 必须还原');
});

test('empty / null input is safe', () => {
  equal(restoreRenderedIoRects(''), '');
  equal(restoreRenderedIoRects(null), '');
  equal(restoreRenderedIoRects(undefined), '');
});
