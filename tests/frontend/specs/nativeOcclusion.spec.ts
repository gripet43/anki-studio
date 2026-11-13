// ============================================================================
// 遮挡编辑器 → 原生 IO 字段（写的那一侧）
//
// 关键事实：`oi=1` 是 Anki 用来区分两种模式的**唯一**开关。原生编辑器里就是
// `hideAllGuessOne` 这个 store 直接决定写不写它：
//     oi=1     → 隐藏全部、猜一个（别组的遮罩也一起盖住）
//     没有 oi  → 隐藏一个、猜一个（只盖当前这张卡那组）
//
// 曾经把 `:oi=1` 写死在每条指令里，于是「仅隐藏当前提问框」这个选项在原生 Anki
// 里完全无效——建出来的卡永远是隐藏全部。
// ============================================================================

import { section, test, ok, equal, doesNotMatch } from '../harness';
import { buildNativeOcclusion } from '../../../frontend/src/components/quick-add/ImageOcclusionEditorModal';

const rects = [
  { id: 'a', clozeIndex: 1, leftPct: 10, topPct: 20, widthPct: 30, heightPct: 15 },
  { id: 'b', clozeIndex: 1, leftPct: 50, topPct: 60, widthPct: 10, heightPct: 10 },
];

const base = {
  titleText: '  心脏解剖  ',
  imgSrc: 'paste_1.jpg',
  mediaFilename: 'paste_1.jpg',
  rects,
};

section('native occlusion payload · mode');

test('hide-all writes oi=1 on every shape', () => {
  const out = buildNativeOcclusion({ ...base, mode: 'hide-all' });
  equal((out.occlusions.match(/:oi=1\}\}/g) || []).length, 2, '两个遮罩都要带 oi=1');
  ok(out.occlusions.includes('image-occlusion:rect:'), '仍是原生指令格式');
});

test('hide-one writes no oi at all', () => {
  const out = buildNativeOcclusion({ ...base, mode: 'hide-one' });
  doesNotMatch(out.occlusions, /:oi=/, 'hide-one 不能带 oi');
  doesNotMatch(out.occlusions, /oi=/, '连空 oi 都不要出现');
  equal((out.occlusions.match(/image-occlusion:rect:/g) || []).length, 2);
});

section('native occlusion payload · shape');

test('coordinates stay 0–1 decimals, not percentages', () => {
  const out = buildNativeOcclusion({ ...base, mode: 'hide-all' });
  ok(out.occlusions.includes('left=0.1000'), 'left 应是 0.1 而不是 10');
  ok(out.occlusions.includes('top=0.2000'));
  ok(out.occlusions.includes('width=0.3000'));
  ok(out.occlusions.includes('height=0.1500'));
});

test('all masks share c1 so one note makes exactly one card', () => {
  const out = buildNativeOcclusion({ ...base, mode: 'hide-all' });
  equal(new Set(out.occlusions.match(/\{\{c(\d+)::/g) || []).size, 1);
  ok(out.occlusions.startsWith('{{c1::'), 'ordinal 是 1');
});

test('image field is a bare filename and header is trimmed', () => {
  const out = buildNativeOcclusion({ ...base, mode: 'hide-all' });
  equal(out.image, '<img src="paste_1.jpg">');
  equal(out.header, '心脏解剖');
});

test('mode is carried on the payload for the preview HTML', () => {
  ok(buildNativeOcclusion({ ...base, mode: 'hide-one' }).mode === 'hide-one');
  ok(buildNativeOcclusion({ ...base, mode: 'hide-one' }).previewHtml.includes('data-io-mode="hide-one"'));
});
