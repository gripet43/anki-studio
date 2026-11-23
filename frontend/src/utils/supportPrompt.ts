import { callAnki, isAnkiNativeEnv, type SupportPromptStatus } from '../bridge/pycmd';
import type { ResolvedLanguage } from '../i18n/translations';

export const XIAOHONGSHU_PROFILE_URL =
  'https://www.xiaohongshu.com/user/profile/6496d6f8000000001001ff0f';
export const GITHUB_REPO_URL = 'https://github.com/gripet43/anki-studio';
export const GITHUB_ISSUES_URL = 'https://github.com/gripet43/anki-studio/issues';
export const ANKIWEB_ADDON_URL = 'https://ankiweb.net/shared/info/1071937836';

export const SUPPORT_PROMPT_MIN_STREAK_DAYS = 3;

export type FeedbackChannel = 'xiaohongshu' | 'github';

const VALID_STATUSES: ReadonlySet<SupportPromptStatus> = new Set([
  'idle',
  'liked',
  'feedback',
  'dismissed',
]);

export function normalizeSupportPromptStatus(raw: unknown): SupportPromptStatus {
  const normalized = String(raw ?? 'idle').trim().toLowerCase() as SupportPromptStatus;
  return VALID_STATUSES.has(normalized) ? normalized : 'idle';
}

export function shouldShowSupportPrompt(input: {
  status: SupportPromptStatus;
  streakDays: number;
  sessionStudiedCount: number;
  isPreviewSession: boolean;
  isNewDayReady: boolean;
}): boolean {
  if (input.status !== 'idle') return false;
  if (input.isPreviewSession || input.isNewDayReady) return false;
  if (!Number.isFinite(input.sessionStudiedCount) || input.sessionStudiedCount <= 0) {
    return false;
  }
  return Number.isFinite(input.streakDays) && input.streakDays >= SUPPORT_PROMPT_MIN_STREAK_DAYS;
}

export function resolveFeedbackChannel(lang: ResolvedLanguage | string): {
  channel: FeedbackChannel;
  url: string;
} {
  if (lang === 'zh-CN' || lang === 'zh-TW') {
    return { channel: 'xiaohongshu', url: XIAOHONGSHU_PROFILE_URL };
  }
  return { channel: 'github', url: GITHUB_ISSUES_URL };
}

/**
 * Open external URLs in the system browser because Qt WebView loads from file://.
 */
export function openExternalUrl(url: string): void {
  if (isAnkiNativeEnv()) {
    callAnki('open_external_url', { url }).catch(() => {});
  } else if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
