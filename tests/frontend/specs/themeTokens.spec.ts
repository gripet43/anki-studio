// ============================================================================
// Theme token matrix — 3 themes × 8 accent colours
// Guards the single source of truth every component reads via CSS variables.
// ============================================================================

import { section, test, eq, equal, ok } from '../harness';
import {
  ACCENT_THEMES,
  ACCENT_COLOR_LIST,
  isValidAccentColor,
  getAccentScale,
  buildThemeCssVars,
} from '../../../frontend/src/utils/themeTokens';

const THEMES = ['light', 'dark', 'oled'] as const;
const ACCENT_IDS = ['indigo', 'emerald', 'cyan', 'rose', 'amber', 'teal', 'violet', 'slate'] as const;

const REQUIRED_SCALE_KEYS = [
  'brand',
  'brandHover',
  'brandRgb',
  'brandText',
  'brandSoft',
  'brandSoftStrong',
  'brandSurface',
  'brandBorder',
  'brandMutedBar',
] as const;

const REQUIRED_CSS_VARS = [
  '--brand',
  '--brand-hover',
  '--brand-rgb',
  '--brand-text',
  '--brand-soft',
  '--brand-soft-strong',
  '--brand-surface',
  '--brand-border',
  '--brand-muted-bar',
  '--heatmap-0',
  '--heatmap-1',
  '--heatmap-2',
  '--heatmap-3',
  '--heatmap-4',
  '--status-danger',
  '--status-danger-soft',
  '--status-warning',
  '--status-warning-soft',
  '--status-success',
  '--status-success-soft',
  '--status-info',
  '--status-info-soft',
];

/** No token may ever leak the string form of a JS bug into the stylesheet. */
function assertCleanColor(value: unknown, label: string): void {
  ok(typeof value === 'string', `${label} must be a string, got ${typeof value}`);
  const token = String(value).trim();
  ok(token.length > 0, `${label} must not be empty`);
  ok(
    !/undefined|NaN|null|\[object/i.test(token),
    `${label} looks like a serialized JS bug: ${token}`
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const full = hex.replace('#', '');
  const expanded =
    full.length === 3
      ? full
          .split('')
          .map((c) => c + c)
          .join('')
      : full;
  const num = Number.parseInt(expanded, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const channel = v / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

section('theme tokens · accent matrix');

test('8 accent colours are defined, ordered and unique', () => {
  equal(ACCENT_COLOR_LIST.length, 8, 'design system promises 8 accent colours');
  eq(
    ACCENT_COLOR_LIST.map((accent) => accent.id),
    [...ACCENT_IDS],
    'ACCENT_COLOR_LIST order is part of the settings UI contract'
  );
  equal(new Set(ACCENT_IDS).size, 8, 'accent ids must be unique');
});

test('every accent declares all 9 scale tokens for light and dark', () => {
  for (const id of ACCENT_IDS) {
    const meta = ACCENT_THEMES[id];
    ok(meta, `ACCENT_THEMES.${id} is missing`);
    for (const mode of ['light', 'dark'] as const) {
      const scale = meta[mode];
      ok(scale, `ACCENT_THEMES.${id}.${mode} is missing`);
      for (const key of REQUIRED_SCALE_KEYS) {
        assertCleanColor(scale[key], `ACCENT_THEMES.${id}.${mode}.${key}`);
      }
      ok(Array.isArray(scale.heatmap), `ACCENT_THEMES.${id}.${mode}.heatmap must be an array`);
      equal(scale.heatmap.length, 4, `ACCENT_THEMES.${id}.${mode}.heatmap must have 4 steps`);
      scale.heatmap.forEach((step, index) =>
        assertCleanColor(step, `ACCENT_THEMES.${id}.${mode}.heatmap[${index}]`)
      );
    }
  }
});

test('isValidAccentColor accepts exactly the 8 ids and rejects junk', () => {
  for (const id of ACCENT_IDS) {
    ok(isValidAccentColor(id), `${id} must be accepted`);
  }
  for (const junk of ['rainbow', '', 'Indigo', 'indigo ', null, undefined, 42, {}, []]) {
    equal(isValidAccentColor(junk), false, `${JSON.stringify(junk)} must be rejected`);
  }
});

test('getAccentScale collapses dark and oled onto the same dark scale', () => {
  for (const id of ACCENT_IDS) {
    eq(getAccentScale(id, 'dark'), ACCENT_THEMES[id].dark, `${id}: dark scale mismatch`);
    eq(getAccentScale(id, 'oled'), ACCENT_THEMES[id].dark, `${id}: oled must reuse dark scale`);
  }
});

test('getAccentScale falls back to indigo for an unknown accent', () => {
  const fallback = getAccentScale('not-a-colour' as never, 'light');
  eq(fallback, ACCENT_THEMES.indigo.light);
});

section('theme tokens · CSS variables');

test('buildThemeCssVars emits the complete 22-variable contract for 8×3 combos', () => {
  for (const id of ACCENT_IDS) {
    for (const theme of THEMES) {
      const vars = buildThemeCssVars(id, theme);
      const keys = Object.keys(vars).sort();
      eq(keys, [...REQUIRED_CSS_VARS].sort(), `${id}/${theme}: CSS variable set drifted`);
      for (const key of REQUIRED_CSS_VARS) {
        assertCleanColor(vars[key], `${id}/${theme} ${key}`);
      }
    }
  }
});

test('the --brand variable always mirrors the resolved scale', () => {
  for (const theme of THEMES) {
    for (const id of ACCENT_IDS) {
      const vars = buildThemeCssVars(id, theme);
      equal(vars['--brand'], getAccentScale(id, theme).brand, `${id}/${theme}: --brand mismatch`);
    }
  }
});

test('heatmap step 0 is a theme canvas tone, ordered light > dark > oled', () => {
  const light = buildThemeCssVars('indigo', 'light')['--heatmap-0'];
  const dark = buildThemeCssVars('indigo', 'dark')['--heatmap-0'];
  const oled = buildThemeCssVars('indigo', 'oled')['--heatmap-0'];
  ok(relativeLuminance(light) > relativeLuminance(dark), 'light canvas must be lighter than dark');
  ok(relativeLuminance(dark) > relativeLuminance(oled), 'dark canvas must be lighter than oled');
  ok(relativeLuminance(light) > 0.6, 'light heatmap empty cell should read as near-white');
});

test('buildThemeCssVars is pure and deterministic', () => {
  for (const theme of THEMES) {
    eq(
      buildThemeCssVars('emerald', theme),
      buildThemeCssVars('emerald', theme),
      `${theme}: repeated calls must be identical`
    );
  }
});
