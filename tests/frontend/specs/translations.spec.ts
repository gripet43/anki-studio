// ============================================================================
// i18n resolution & formatting
// 16 languages ship with the add-on; the fallback chain (pref → Anki → browser)
// and the RTL/OS detection decide what every user actually reads.
// ============================================================================

import { section, test, eq, equal, ok } from '../harness';
import {
  SUPPORTED_LANGUAGES,
  normalizeLanguageCode,
  isChineseLanguage,
  isRtlLanguage,
  getLanguageMeta,
  detectBrowserLanguage,
  detectOSPlatform,
  resolveLanguage,
  formatShortcut,
  formatRelativeSyncLabel,
  formatRelativeTimeString,
  formatDetailedSyncTimestamp,
} from '../../../frontend/src/i18n/translations';

function withNavigator<T>(stub: { language?: string; userAgent?: string; platform?: string }, fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...stub },
      configurable: true,
      writable: true,
    });
    return fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'navigator', descriptor);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  }
}

section('i18n · language registry');

test('16 languages are registered with unique ids and complete metadata', () => {
  equal(SUPPORTED_LANGUAGES.length, 16, 'README promises 16 interface languages');
  const ids = SUPPORTED_LANGUAGES.map((lang) => lang.id);
  equal(new Set(ids).size, 16, 'language ids must be unique');
  for (const lang of SUPPORTED_LANGUAGES) {
    ok(lang.nativeName && lang.nativeName.trim().length > 0, `${lang.id}: nativeName missing`);
    ok(lang.englishName && lang.englishName.trim().length > 0, `${lang.id}: englishName missing`);
    ok(/^[a-z]{2,3}_[A-Z]{2}$/.test(lang.ankiCode), `${lang.id}: ankiCode format`);
  }
});

test('only Arabic is RTL', () => {
  const rtl = SUPPORTED_LANGUAGES.filter((lang) => isRtlLanguage(lang.id)).map((lang) => lang.id);
  eq(rtl, ['ar']);
  equal(isRtlLanguage('zh-CN'), false);
  equal(isChineseLanguage('zh-CN'), true);
  equal(isChineseLanguage('zh-TW'), true);
  equal(isChineseLanguage('ja'), false);
});

test('getLanguageMeta never returns undefined for a supported id', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    equal(getLanguageMeta(lang.id), lang);
  }
});

section('i18n · language code normalisation');

test('Anki / browser locale aliases collapse onto the 16 supported ids', () => {
  const cases: Array<[string, string]> = [
    ['zh-cn', 'zh-CN'],
    ['zh_CN', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh', 'zh-CN'],
    ['zh-tw', 'zh-TW'],
    ['zh_HK', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['en-US', 'en'],
    ['en_GB', 'en'],
    ['ja-JP', 'ja'],
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['es-419', 'es'],
    ['de-AT', 'de'],
    ['ar-SA', 'ar'],
    ['vi-VN', 'vi'],
  ];
  for (const [input, expected] of cases) {
    equal(normalizeLanguageCode(input), expected, `${input} should map to ${expected}`);
  }
});

test('unknown and empty locale strings are rejected instead of guessing', () => {
  for (const junk of ['', '   ', 'auto', 'xx', 'klingon', null, undefined]) {
    equal(normalizeLanguageCode(junk), null, `${JSON.stringify(junk)} must not resolve`);
  }
});

section('i18n · resolution fallback chain');

test('explicit preference wins over the Anki locale', () => {
  equal(resolveLanguage('ja', 'de_DE'), 'ja');
});

test('auto / invalid preference falls back to the Anki locale', () => {
  equal(resolveLanguage('auto', 'de_DE'), 'de');
  equal(resolveLanguage('not-a-lang', 'zh_CN'), 'zh-CN');
});

test('with no usable preference it falls back to the browser language', () => {
  const resolved = withNavigator({ language: 'fr-FR' }, () =>
    resolveLanguage('auto', undefined)
  );
  equal(resolved, 'fr');
});

test('detectBrowserLanguage defaults to English when navigator is silent', () => {
  const resolved = withNavigator({}, () => detectBrowserLanguage());
  equal(resolved, 'en');
});

section('i18n · OS shortcuts');

test('mac keeps its symbols, Windows/Linux gets literal keys', () => {
  equal(formatShortcut('⌘K', 'mac'), '⌘K');
  equal(formatShortcut('Cmd+K', 'win'), 'Ctrl+K');
  equal(formatShortcut('Opt+M', 'linux'), 'Alt+M');
  equal(formatShortcut('Option+M', 'win'), 'Alt+M');
});

test('detectOSPlatform maps each user agent family', () => {
  equal(withNavigator({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64)' }, detectOSPlatform), 'win');
  equal(withNavigator({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }, detectOSPlatform), 'linux');
  equal(withNavigator({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' }, detectOSPlatform), 'mac');
  equal(withNavigator({}, detectOSPlatform), 'mac');
});

section('i18n · sync labels & timestamps');

test('every language has a non-empty "never synced" and "just now" label', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    const never = formatRelativeTimeString(0, lang.id);
    ok(never && never.trim().length > 0, `${lang.id}: never-synced label missing`);
    const justNow = formatRelativeTimeString(Date.now(), lang.id, Date.now());
    ok(justNow && justNow.trim().length > 0, `${lang.id}: just-now label missing`);
  }
});

test('relative labels escalate minutes → hours → days in zh-CN', () => {
  const now = Date.now();
  ok(formatRelativeTimeString(now - 5 * 60_000, 'zh-CN', now).includes('分钟'));
  ok(formatRelativeTimeString(now - 3 * 3_600_000, 'zh-CN', now).includes('小时'));
  ok(formatRelativeTimeString(now - 2 * 86_400_000, 'zh-CN', now).includes('天'));
});

test('formatRelativeSyncLabel prefixes the synced state and handles never-synced', () => {
  const now = Date.now();
  const synced = formatRelativeSyncLabel(now - 60_000, 'zh-CN', now);
  ok(synced.includes('·'), `expected "prefix · relative", got ${synced}`);
  equal(formatRelativeSyncLabel(0, 'zh-CN'), '尚未云端同步');
  equal(formatRelativeSyncLabel(-1, 'en'), 'Not synced');
});

test('formatDetailedSyncTimestamp pads every field', () => {
  const localDate = new Date(2026, 0, 2, 3, 4, 5);
  equal(formatDetailedSyncTimestamp(localDate.getTime()), '2026-01-02 03:04:05');
  equal(formatDetailedSyncTimestamp(0), '');
});
