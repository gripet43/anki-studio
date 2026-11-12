/**
 * 牌组卡色彩派生 —— 全部落在当前主题色的色相家族里，只做轻微偏移。
 *
 * 背景：牌组卡原先后端按 `len(decks) % 6` 轮流派发 indigo / blue / emerald /
 * amber / rose / purple 六个色系，卡片颜色与用户选定的主题色**毫无关系**：
 * 选了「经典蓝」，第二张牌组仍然是青的、第三张仍然是绿的、第四张是橙的。
 *
 * 现在改为单色源派生：以 `getAccentScale(accentColor, theme)` 为唯一色源，
 * 按牌组在列表里的次序叠加两个很轻的偏移维度 ——
 *
 * - **色相**：整族一起偏转 ±13° 以内。再大就不再读作「同一个主题色」了：
 *   实测「经典蓝」(h≈212°) 偏 +20° 就已经发紫、偏 −20° 已经发青，退回彩虹牌组。
 * - **浅底深度**：只作用于浅色填充（图标底、柔和按钮底、浅段进度条）。这些颜色
 *   明度在 95% 上下，只转色相几乎看不出差别，必须靠「同一色相的不同浓淡」来分离；
 *   深色主题里这些填充是 `rgba()` 半透明，深度改为调 alpha。
 *
 * 色阶里其余令牌（brand / brandText / brandBorder / heatmap）逐一套用同一组偏移，
 * 因此一张卡内部的图标底、描边、进度条、按钮永远自洽。
 *
 * 第 1 张牌组偏移量为 0，即完全等于主题色本身：绝大多数用户只有一两个牌组，
 * 主牌组始终穿品牌色，只有第二张起才逐渐分化。
 */

import type { AccentScale } from './themeTokens';

interface DeckTintStep {
  /** 色相偏转（度） */
  hue: number;
  /** 浅底深度（百分点；负向，越大越浓） */
  depth: number;
}

/**
 * 色阶轮转表：长度即轮转周期，第 6 张牌组与第 1 张同色。
 *
 * 顺序刻意做成 0 / 偏暖 / 偏冷 / 更暖 / 更冷，让相邻两张卡在两个维度上都错开；
 * 色相量级分 9° 与 13° 两档，越靠后差异越大，但始终没有出族。
 */
const DECK_TINT_STEPS: readonly DeckTintStep[] = [
  { hue: 0, depth: 0 },
  { hue: 9, depth: 3 },
  { hue: -9, depth: 3 },
  { hue: 13, depth: 6 },
  { hue: -13, depth: 6 },
];

/** 色阶轮转周期。 */
export const DECK_TINT_CYCLE = DECK_TINT_STEPS.length;

/** 明度高于此值的令牌视为「浅底」，用深度调节浓淡；否则只转色相。 */
const TINT_CEILING = 0.62;

/** 深色主题下 `rgba()` 浅底每 1 个深度点换多少 alpha。 */
const ALPHA_PER_DEPTH = 0.012;

/**
 * 实色令牌（品牌色、描边文字色）的深度系数。
 *
 * 浅底变浓会把压在上面的 `brandText` 对比度吃掉：只加深底色时有 3 组掉到
 * 3.7:1（琥珀色第 4 张、经典蓝与雾海蓝的第 5 张），低于小字号 4.5:1 的门槛。
 * 让实色令牌按 0.8 的系数跟着一起加深，最低回到 4.66:1，同时「第 5 张更浓」
 * 这个视觉语义反而更统一。
 */
const SOLID_DEPTH_RATIO = 0.8;

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 解析 `#rgb` / `#rrggbb` / `rgb(...)` / `rgba(...)`，认不出来就返回 null。 */
function parseColor(input: string): Rgba | null {
  const value = input.trim();

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (full.length !== 6) return null;
    const num = Number.parseInt(full, 16);
    if (Number.isNaN(num)) return null;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 1 };
  }

  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(',').map((p) => Number.parseFloat(p.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((n) => Number.isNaN(n))) return null;
  const alpha = parts.length > 3 && !Number.isNaN(parts[3]) ? parts[3] : 1;
  return { r: parts[0], g: parts[1], b: parts[2], a: alpha };
}

/** RGB(0–255) → HSL（h 0–360，s/l 0–1）。 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) * 60;
  } else {
    h = ((rn - gn) / d + 4) * 60;
  }
  return [h, s, l];
}

/** HSL(h 0–360, s/l 0–1) → RGB(0–255)。 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;

  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgb.map((v) => Math.round((v + m) * 255)) as [number, number, number];
}

const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();

/** 按给定偏移量旋转一个颜色令牌。认不出的格式（如 `color-mix(...)`）原样返回。 */
function shift(token: string, step: DeckTintStep): string {
  if (step.hue === 0 && step.depth === 0) return token;

  const color = parseColor(token);
  if (!color) return token;

  const [h, s, l] = rgbToHsl(color.r, color.g, color.b);
  const hue = h + step.hue;

  if (color.a < 1) {
    // 深色主题的浅底是半透明色，浓淡由 alpha 表达
    const [r, g, b] = hslToRgb(hue, s, l);
    const a = Math.round(clamp01(color.a + step.depth * ALPHA_PER_DEPTH) * 1000) / 1000;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // 浅底压明度换取更浓的一层同色洗濯；实色令牌按更小的系数跟着加深，
  // 补回被底色吃掉的对比度（见 SOLID_DEPTH_RATIO）
  const ratio = l > TINT_CEILING ? 1 : SOLID_DEPTH_RATIO;
  const [r, g, b] = hslToRgb(hue, s, clamp01(l - (step.depth * ratio) / 100));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** `brandRgb` 是 `"48, 118, 195"` 这样的裸三元组，只转色相（它与 `brand` 同源）。 */
function shiftTriplet(token: string, hue: number): string {
  if (hue === 0) return token;

  const parts = token.split(',').map((p) => Number.parseFloat(p.trim()));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return token;

  const [h, s, l] = rgbToHsl(parts[0], parts[1], parts[2]);
  const [r, g, b] = hslToRgb(h + hue, s, l);
  return `${r}, ${g}, ${b}`;
}

/**
 * 把主题色阶派生成第 `index` 张牌组卡的色阶。
 *
 * `index` 取牌组在首页列表里的位置，超过 `DECK_TINT_CYCLE` 自动回绕；
 * 同一个 `base` 下是纯函数，可安全 memo。
 */
export function deriveDeckScale(base: AccentScale, index: number): AccentScale {
  const step =
    DECK_TINT_STEPS[((index % DECK_TINT_CYCLE) + DECK_TINT_CYCLE) % DECK_TINT_CYCLE];

  if (step.hue === 0 && step.depth === 0) return base;

  const s = (token: string) => shift(token, step);

  return {
    brand: s(base.brand),
    brandHover: s(base.brandHover),
    brandRgb: shiftTriplet(base.brandRgb, step.hue),
    brandText: s(base.brandText),
    brandSoft: s(base.brandSoft),
    brandSoftStrong: s(base.brandSoftStrong),
    brandSurface: s(base.brandSurface),
    brandBorder: s(base.brandBorder),
    brandMutedBar: s(base.brandMutedBar),
    heatmap: [
      s(base.heatmap[0]),
      s(base.heatmap[1]),
      s(base.heatmap[2]),
      s(base.heatmap[3]),
    ],
  };
}

/** 一次性算出整个色阶轮转，首页用 useMemo 缓存这一份即可。 */
export function buildDeckScales(base: AccentScale): AccentScale[] {
  return Array.from({ length: DECK_TINT_CYCLE }, (_, i) => deriveDeckScale(base, i));
}
