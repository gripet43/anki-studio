// ============================================================================
// Deck card palette derivation
// Invariant under test: deck cards are derived from the active accent colour and
// stay inside its hue family (no rainbow deck wall), while remaining a pure,
// memo-safe function of (base scale, index).
// ============================================================================

import { section, test, eq, equal, ok } from '../harness';
import {
  DECK_TINT_CYCLE,
  buildDeckScales,
  deriveDeckScale,
} from '../../../frontend/src/utils/deckPalette';
import {
  ACCENT_COLOR_LIST,
  buildThemeCssVars,
  getAccentScale,
} from '../../../frontend/src/utils/themeTokens';

const ACCENT_IDS = ACCENT_COLOR_LIST.map((accent) => accent.id);

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const full = hex.replace('#', '');
  const expanded =
    full.length === 3
      ? full
          .split('')
          .map((c) => c + c)
          .join('')
      : full;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  const num = Number.parseInt(expanded, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

function hueDistance(a: number, b: number): number {
  const delta = Math.abs(((a - b) % 360) + 360) % 360;
  return Math.min(delta, 360 - delta);
}

function assertColorToken(value: unknown, label: string): void {
  ok(typeof value === 'string', `${label} must be a string`);
  ok(String(value).trim().length > 0, `${label} must not be empty`);
  ok(!/undefined|NaN|null/i.test(String(value)), `${label} leaked a JS sentinel: ${value}`);
}

section('deck palette · cycle & purity');

test('the tint cycle is 5 cards long and buildDeckScales covers one full cycle', () => {
  equal(DECK_TINT_CYCLE, 5, 'documented cycle length');
  const base = getAccentScale('indigo', 'light');
  equal(buildDeckScales(base).length, DECK_TINT_CYCLE);
});

test('the first deck card is exactly the accent colour itself', () => {
  for (const id of ACCENT_IDS) {
    const base = getAccentScale(id, 'light');
    equal(deriveDeckScale(base, 0), base, `${id}: first card must not drift from the brand`);
  }
});

test('indices wrap in both directions', () => {
  const base = getAccentScale('cyan', 'dark');
  eq(deriveDeckScale(base, DECK_TINT_CYCLE), deriveDeckScale(base, 0));
  eq(deriveDeckScale(base, DECK_TINT_CYCLE + 3), deriveDeckScale(base, 3));
  eq(deriveDeckScale(base, -1), deriveDeckScale(base, DECK_TINT_CYCLE - 1), 'negative index should wrap');
  eq(deriveDeckScale(base, -DECK_TINT_CYCLE), deriveDeckScale(base, 0));
});

test('derivation is deterministic and never mutates the base scale', () => {
  const base = getAccentScale('amber', 'dark');
  const snapshot = JSON.stringify(base);
  const first = deriveDeckScale(base, 3);
  const second = deriveDeckScale(base, 3);
  eq(first, second, 'same input must produce the same palette');
  equal(JSON.stringify(base), snapshot, 'base accent scale must stay untouched');
});

test('every derived token stays a valid colour string', () => {
  for (const id of ACCENT_IDS) {
    for (const theme of ['light', 'dark', 'oled'] as const) {
      const scales = buildDeckScales(getAccentScale(id, theme));
      scales.forEach((scale, index) => {
        for (const key of ['brand', 'brandHover', 'brandText', 'brandSoft', 'brandSurface', 'brandBorder', 'brandMutedBar'] as const) {
          assertColorToken(scale[key], `${id}/${theme}/card${index}.${key}`);
        }
        ok(/^\d{1,3},\s?\d{1,3},\s?\d{1,3}$/.test(scale.brandRgb), `${id}/${theme}/card${index}.brandRgb format`);
        equal(scale.heatmap.length, 4);
        scale.heatmap.forEach((step, heatIndex) =>
          assertColorToken(step, `${id}/${theme}/card${index}.heatmap[${heatIndex}]`)
        );
      });
    }
  }
});

section('deck palette · stays in the accent hue family');

test('derived brand hue stays within ±15° of the accent hue (no rainbow decks)', () => {
  for (const id of ACCENT_IDS) {
    const base = getAccentScale(id, 'light');
    const baseHsl = hexToHsl(base.brand);
    ok(baseHsl, `${id}: brand must be a hex colour to run the hue check`);
    if (baseHsl && baseHsl.s < 0.1) continue; // near-grey accents have no meaningful hue
    for (let index = 0; index < DECK_TINT_CYCLE; index += 1) {
      const derived = deriveDeckScale(base, index).brand;
      const derivedHsl = hexToHsl(derived);
      ok(derivedHsl, `${id}/card${index}: brand must stay a hex colour`);
      if (!derivedHsl) continue;
      const distance = hueDistance(baseHsl!.h, derivedHsl.h);
      ok(
        distance <= 15,
        `${id}/card${index}: hue drifted ${distance.toFixed(1)}° away from the accent`
      );
    }
  }
});

test('the brand token actually changes after the first card', () => {
  const base = getAccentScale('indigo', 'light');
  ok(deriveDeckScale(base, 1).brand !== base.brand, 'card 2 must be visually distinguishable');
});

test('buildThemeCssVars and deck palettes stay on the same contract', () => {
  // A palette entry must be directly usable as CSS variables too — this is what
  // the dashboard does when it spreads a derived scale onto a deck card style.
  const scale = deriveDeckScale(getAccentScale('rose', 'dark'), 2);
  const vars = buildThemeCssVars('rose', 'dark');
  for (const key of Object.keys(vars)) {
    ok(typeof vars[key] === 'string', `${key} must be a string`);
  }
  ok(typeof scale.brand === 'string' && scale.brand.length > 0);
});
