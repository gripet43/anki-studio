// ============================================================================
// Theme token matrix — Auto / Light / Dark × 8 accent colours
// Guards the single source of truth every component reads via CSS variables.
// ============================================================================

import { section, test, eq, equal, ok } from '../harness';
import {
  ACCENT_THEMES,
  ACCENT_COLOR_LIST,
  ACCENT_ATMOSPHERE,
  isValidAccentColor,
  normalizeThemeMode,
  resolveThemeMode,
  getAccentScale,
  getAccentAtmosphere,
  buildThemeCssVars,
} from '../../../frontend/src/utils/themeTokens';

const THEMES = ['light', 'dark'] as const;
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

test('normalizeThemeMode migrates legacy oled -> dark and defaults unknown values to auto', () => {
  equal(normalizeThemeMode('auto'), 'auto');
  equal(normalizeThemeMode('light'), 'light');
  equal(normalizeThemeMode('dark'), 'dark');
  equal(normalizeThemeMode('oled'), 'dark');
  equal(normalizeThemeMode('OLED'), 'dark');
  equal(normalizeThemeMode(''), 'auto');
  equal(normalizeThemeMode('invalid'), 'auto');
  equal(normalizeThemeMode(null), 'auto');
});

test('resolveThemeMode & getAccentScale resolve auto cleanly from systemDark', () => {
  equal(resolveThemeMode('light', true), 'light');
  equal(resolveThemeMode('dark', false), 'dark');
  equal(resolveThemeMode('auto', false), 'light');
  equal(resolveThemeMode('auto', true), 'dark');
  for (const id of ACCENT_IDS) {
    eq(getAccentScale(id, 'light'), ACCENT_THEMES[id].light, `${id}: light scale mismatch`);
    eq(getAccentScale(id, 'dark'), ACCENT_THEMES[id].dark, `${id}: dark scale mismatch`);
    eq(getAccentScale(id, 'auto', false), ACCENT_THEMES[id].light, `${id}: auto(light) mismatch`);
    eq(getAccentScale(id, 'auto', true), ACCENT_THEMES[id].dark, `${id}: auto(dark) mismatch`);
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

test('heatmap step 0 is a theme canvas tone, ordered light > dark, with auto matching resolved mode', () => {
  const light = buildThemeCssVars('indigo', 'light')['--heatmap-0'];
  const dark = buildThemeCssVars('indigo', 'dark')['--heatmap-0'];
  const autoLight = buildThemeCssVars('indigo', 'auto', false)['--heatmap-0'];
  const autoDark = buildThemeCssVars('indigo', 'auto', true)['--heatmap-0'];
  ok(relativeLuminance(light) > relativeLuminance(dark), 'light canvas must be lighter than dark');
  ok(relativeLuminance(light) > 0.6, 'light heatmap empty cell should read as near-white');
  equal(autoLight, light, 'auto(false) must match light heatmap canvas');
  equal(autoDark, dark, 'auto(true) must match dark heatmap canvas');
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

section('theme tokens · bound illustration atmospheres');

test('indigo binds clean zero-illustration default; the 7 other accents bind distinct packs', () => {
  equal(getAccentAtmosphere('indigo').pack, 'none', 'default indigo must remain pure minimal');
  const nonDefault = ACCENT_IDS.filter((id) => id !== 'indigo');
  const packs = nonDefault.map((id) => getAccentAtmosphere(id).pack);
  ok(packs.every((p) => p !== 'none'), 'every non-default accent must bind a curated illustration pack');
  equal(new Set(packs).size, nonDefault.length, 'each non-default accent binds a unique pack');
  for (const id of ACCENT_IDS) {
    const meta = ACCENT_ATMOSPHERE[id];
    ok(meta.nameZh.length > 0 && meta.nameEn.length > 0, `${id}: localized atmosphere name required`);
    ok(meta.descZh.length > 0 && meta.descEn.length > 0, `${id}: localized atmosphere desc required`);
  }
  equal(getAccentAtmosphere('unknown' as never).pack, 'none', 'unknown accent falls back to indigo clean');
});
