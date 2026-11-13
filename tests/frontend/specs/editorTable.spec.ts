// ============================================================================
// 编辑器插入表格的样式常量
//
// 这些内联样式会被原样存进笔记字段，随后在 Anki 原生界面（白底黑字）里渲染，
// 和插件主题无关。踩过的坑：按当前深色主题烘了 `background:#21222E`，
// 进了原生卡片就是「黑底 + 继承来的黑字」，整行表头看不见。
//
// 这里用对比度算一遍，而不是靠肉眼看：表头底色/文字色必须自己成对构成 ≥ 4.5:1。
// ============================================================================

import { section, test, ok, doesNotMatch } from '../harness';
import {
  TABLE_BORDER_COLOR,
  TABLE_HEADER_BG,
  TABLE_HEADER_FG,
  tableBodyCellStyle,
  tableHeaderCellStyle,
  tableWrapperStyle,
} from '../../../frontend/src/utils/editorTable';

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG 相对亮度 */
function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

section('editor table · native-safe inline styles');

test('header cell declares its own text color instead of inheriting one', () => {
  const style = tableHeaderCellStyle();
  ok(new RegExp(`color:\\s*${TABLE_HEADER_FG}`, 'i').test(style), 'th 必须显式写 color');
  ok(new RegExp(`background:\\s*${TABLE_HEADER_BG}`, 'i').test(style), 'th 必须有底色');
});

test('header text is readable on its own background (≥4.5:1)', () => {
  const ratio = contrast(TABLE_HEADER_FG, TABLE_HEADER_BG);
  ok(ratio >= 4.5, `表头对比度只有 ${ratio.toFixed(2)}:1，白底卡片上会看不清`);
});

test('header background is light so a dark inherited text color still reads', () => {
  // 万一某个模板强刷了深色文字，浅底仍然可读；深底则彻底看不见。
  ok(luminance(TABLE_HEADER_BG) > 0.8, `表头底色太深：${TABLE_HEADER_BG}`);
});

test('body cells leave background/color unset so they follow the host theme', () => {
  const style = tableBodyCellStyle();
  doesNotMatch(style, /background/i, 'td 不应写死底色，否则深色主题下会花');
  doesNotMatch(style, /(^|;)\s*color\s*:/i, 'td 不应写死文字色');
  ok(style.includes(TABLE_BORDER_COLOR), 'td 仍需描边');
});

test('no cell hardcodes a font-size (native should match what the editor showed)', () => {
  doesNotMatch(tableHeaderCellStyle(), /font-size/i);
  doesNotMatch(tableBodyCellStyle(), /font-size/i);
  // 表格本身也不需要
  doesNotMatch(tableWrapperStyle(), /font-size/i);
});

test('table wrapper keeps borders collapsible and full width', () => {
  const style = tableWrapperStyle();
  ok(/border-collapse:\s*collapse/i.test(style));
  ok(/width:\s*100%/i.test(style));
});
