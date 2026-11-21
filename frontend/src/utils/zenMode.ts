import type { DeckItem } from '../bridge/pycmd';
import { translate, type ResolvedLanguage } from '../i18n/translations';

/** Minimal deck descriptor exposed to Zen Home — intentionally strips all counts and stats. */
export interface ZenDeckEntry {
  id: string;
  name: string;
}

export type ZenHomeState = 'syncing' | 'vacation' | 'ready' | 'all-done' | 'empty';
export type ZenTimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';
export type ZenAmbienceScene = 'silent' | 'rain' | 'wind' | 'warmth';

export const ZEN_AMBIENCE_SCENES: readonly ZenAmbienceScene[] = [
  'silent',
  'rain',
  'wind',
  'warmth',
] as const;

const ZH_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

/** Formats a positive integer (1..99) into natural Chinese numerals (一..十五..二十). */
export function formatChineseNumeral(n: number): string {
  const safe = Math.max(0, Math.min(99, Math.floor(n)));
  if (safe < 10) return ZH_DIGITS[safe];
  const tens = Math.floor(safe / 10);
  const ones = safe % 10;
  const tensPart = tens === 1 ? '十' : `${ZH_DIGITS[tens]}十`;
  return ones === 0 ? tensPart : `${tensPart}${ZH_DIGITS[ones]}`;
}

/**
 * Formats remaining incense burn time in a poetic, low-pressure style across all 16 languages.
 * Chinese uses literary numerals ("余九分", "将尽"), matching the Song-dynasty incense motif.
 */
export function formatZenIncenseRemaining(remainingMs: number, lang: ResolvedLanguage): string {
  const clamped = Math.max(0, remainingMs);
  if (clamped <= 0) return translate(lang, 'zenIncenseFinished');
  if (clamped < 60_000) return translate(lang, 'zenIncenseUnderMin');
  const mins = Math.ceil(clamped / 60_000);
  const formattedMins =
    lang === 'zh-CN' || lang === 'zh-TW' ? formatChineseNumeral(mins) : String(mins);
  return translate(lang, 'zenIncenseMinsLeft', { n: formattedMins });
}

export interface ZenIncenseCopy {
  doneTitle: string;
  doneSub: string;
  relightBtn: string;
  restBtn: string;
  pausedLabel: string;
}

export function resolveZenIncenseCopy(lang: ResolvedLanguage): ZenIncenseCopy {
  return {
    doneTitle: translate(lang, 'zenIncenseDoneTitle'),
    doneSub: translate(lang, 'zenIncenseDoneSub'),
    relightBtn: translate(lang, 'zenIncenseRelightBtn'),
    restBtn: translate(lang, 'zenIncenseRestBtn'),
    pausedLabel: translate(lang, 'zenIncensePaused'),
  };
}

/** Maps local clock hour (0-23) to a contemplative circadian light period. */
export function resolveZenTimePeriod(hour: number): ZenTimePeriod {
  const h = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

/**
 * Fine-grained 8-slot time-of-day poetic label so late afternoon (14–16h) and dusk (17–18h)
 * are clearly distinguished from midday noon ("午 静", 12–13h).
 */
export function resolveZenPeriodLabel(
  hour: number,
  lang: ResolvedLanguage,
  fallback: string
): string {
  const h = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  const slot:
    | 'earlyMorning'
    | 'forenoon'
    | 'midday'
    | 'afternoon'
    | 'dusk'
    | 'evening'
    | 'night'
    | 'deepNight' =
    h >= 5 && h < 9
      ? 'earlyMorning'
      : h >= 9 && h < 12
      ? 'forenoon'
      : h >= 12 && h < 14
      ? 'midday'
      : h >= 14 && h < 17
      ? 'afternoon'
      : h >= 17 && h < 19
      ? 'dusk'
      : h >= 19 && h < 22
      ? 'evening'
      : h >= 22 || h === 0
      ? 'night'
      : 'deepNight';

  if (lang === 'zh-CN') {
    const map = {
      earlyMorning: '晨 读',
      forenoon: '清 昼',
      midday: '午 静',
      afternoon: '午 后',
      dusk: '暮 沉',
      evening: '灯 影',
      night: '夜 禅',
      deepNight: '深 宵',
    };
    return map[slot];
  }
  if (lang === 'zh-TW') {
    const map = {
      earlyMorning: '晨 讀',
      forenoon: '清 晝',
      midday: '午 靜',
      afternoon: '午 後',
      dusk: '暮 沉',
      evening: '燈 影',
      night: '夜 禪',
      deepNight: '深 宵',
    };
    return map[slot];
  }
  if (lang === 'ja') {
    const map = {
      earlyMorning: '朝 読',
      forenoon: '清 昼',
      midday: '午 静',
      afternoon: '午 後',
      dusk: '夕 暮',
      evening: '灯 影',
      night: '夜 禅',
      deepNight: '深 夜',
    };
    return map[slot];
  }
  if (lang === 'en') {
    const map = {
      earlyMorning: 'Morning stillness',
      forenoon: 'Bright forenoon',
      midday: 'Midday quiet',
      afternoon: 'Quiet afternoon',
      dusk: 'Dusk settling',
      evening: 'Evening lamplight',
      night: 'Night stillness',
      deepNight: 'Deep midnight',
    };
    return map[slot];
  }
  return fallback;
}

/** Resolves the time-of-day contemplative closure subtitle i18n key. */
export function resolveZenCompleteSubKey(
  period: ZenTimePeriod
):
  | 'zenAllDoneSubMorning'
  | 'zenAllDoneSubAfternoon'
  | 'zenAllDoneSubEvening'
  | 'zenAllDoneSubNight' {
  if (period === 'morning') return 'zenAllDoneSubMorning';
  if (period === 'afternoon') return 'zenAllDoneSubAfternoon';
  if (period === 'evening') return 'zenAllDoneSubEvening';
  return 'zenAllDoneSubNight';
}

export interface ZenHomeStateInput {
  isSyncPending: boolean;
  isVacationActive: boolean;
  totalPending: number;
  pendingDecksCount: number;
  hasAnyDecks: boolean;
}

export interface GlobalShortcutModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Selects only decks that have work waiting today, stripping every numeric count
 * or mastery field so Zen Home cannot display card counts.
 * Prefers top-level decks; falls back to pending child decks if top-level rows report 0.
 */
export function selectZenPendingDecks(decks: DeckItem[]): ZenDeckEntry[] {
  if (!Array.isArray(decks) || decks.length === 0) return [];
  const hasDue = (d: DeckItem) => (d.dueNew || 0) + (d.dueReview || 0) > 0;
  const topPending = decks.filter((d) => !d.isChild && hasDue(d));
  const source = topPending.length > 0 ? topPending : decks.filter(hasDue);
  return source.map((d) => ({ id: d.id, name: d.name }));
}

/** Resolves the single deterministic state rendered by ZenHomeView. */
export function resolveZenHomeState({
  isSyncPending,
  isVacationActive,
  totalPending,
  pendingDecksCount,
  hasAnyDecks,
}: ZenHomeStateInput): ZenHomeState {
  if (isSyncPending) return 'syncing';
  if (isVacationActive) return 'vacation';
  if (totalPending > 0 || pendingDecksCount > 0) return 'ready';
  if (!hasAnyDecks) return 'empty';
  return 'all-done';
}

/**
 * Returns true when a global workspace shortcut must be suppressed in Zen Mode
 * (Cmd/Ctrl+K search, Cmd/Ctrl+, or Cmd/Ctrl+P settings, N quick add, Ctrl+Shift+D design system).
 * Never blocks Ctrl+Alt+M (native escape), Cmd/Ctrl+Shift+Z (toggle Zen), or Y (silent sync).
 */
export function isZenBlockedGlobalShortcut(
  key: string,
  mods: GlobalShortcutModifiers
): boolean {
  const lower = (key || '').toLowerCase();
  const cmdOrCtrl = mods.metaKey || mods.ctrlKey;

  if (mods.ctrlKey && mods.altKey && lower === 'm') return false;
  if (cmdOrCtrl && !mods.altKey && mods.shiftKey && lower === 'z') return false;

  if (mods.ctrlKey && mods.shiftKey && lower === 'd') return true;
  if (cmdOrCtrl && !mods.altKey && !mods.shiftKey && lower === 'k') return true;
  if (cmdOrCtrl && !mods.altKey && !mods.shiftKey && (lower === 'p' || key === ',')) return true;
  if (!cmdOrCtrl && !mods.altKey && !mods.shiftKey && lower === 'n') return true;

  return false;
}
