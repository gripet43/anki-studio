import {
  callAnki,
  isAnkiNativeEnv,
  type SupportPromptState,
  type SupportPromptStatus,
} from '../bridge/pycmd';
import type { ResolvedLanguage } from '../i18n/translations';

export const XIAOHONGSHU_PROFILE_URL =
  'https://www.xiaohongshu.com/user/profile/6496d6f8000000001001ff0f';
export const GITHUB_REPO_URL = 'https://github.com/gripet43/anki-studio';
export const GITHUB_ISSUES_URL = 'https://github.com/gripet43/anki-studio/issues';
export const ANKIWEB_ADDON_URL = 'https://ankiweb.net/shared/info/1071937836';

export const SUPPORT_PROMPT_MIN_STREAK_DAYS = 3;
export const SUPPORT_PROMPT_MAX_ATTEMPTS = 3;
export const SUPPORT_PROMPT_MIN_SESSION_ACCURACY = 60;
export const SUPPORT_PROMPT_COOLDOWN_SECOND_SEC = 14 * 86400;
export const SUPPORT_PROMPT_COOLDOWN_FINAL_SEC = 30 * 86400;
export const SUPPORT_PROMPT_COOLDOWN_VERSION_BUMP_SEC = 14 * 86400;
export const SUPPORT_PROMPT_COOLDOWN_FEEDBACK_SEC = 21 * 86400;

export const DEFAULT_SUPPORT_PROMPT_STATE: SupportPromptState = {
  status: 'idle',
  promptCount: 0,
  lastPromptedAt: 0,
  lastVersion: '',
};

export type FeedbackChannel = 'xiaohongshu' | 'github';
export type SupportPromptOutcome =
  | 'liked'
  | 'opted_out'
  | 'feedback'
  | 'opened_unconfirmed'
  | 'snoozed';

const VALID_STATUSES: ReadonlySet<SupportPromptStatus> = new Set([
  'idle',
  'snoozed',
  'opened_unconfirmed',
  'feedback',
  'liked',
  'opted_out',
  'exhausted',
]);

function clampInt(raw: unknown, min: number, max: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, Math.trunc(num)));
}

export function normalizeSupportPromptState(raw: unknown): SupportPromptState {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const rawStatus = String(obj.status ?? 'idle').trim().toLowerCase() as SupportPromptStatus;
    const status = VALID_STATUSES.has(rawStatus) ? rawStatus : 'idle';
    const rawCount = obj.promptCount ?? obj.prompt_count ?? 0;
    const rawTs = obj.lastPromptedAt ?? obj.last_prompted_at ?? 0;
    const rawVer = obj.lastVersion ?? obj.last_version ?? '';
    return {
      status,
      promptCount: clampInt(rawCount, 0, SUPPORT_PROMPT_MAX_ATTEMPTS),
      lastPromptedAt: Math.max(0, clampInt(rawTs, 0, Number.MAX_SAFE_INTEGER)),
      lastVersion: String(rawVer ?? '').trim().slice(0, 32),
    };
  }

  if (typeof raw === 'string') {
    const legacy = raw.trim().toLowerCase();
    if (legacy === 'liked') {
      return { status: 'liked', promptCount: 1, lastPromptedAt: 0, lastVersion: '' };
    }
    if (legacy === 'feedback') {
      return { status: 'feedback', promptCount: 1, lastPromptedAt: 0, lastVersion: '' };
    }
    if (legacy === 'dismissed') {
      return { status: 'snoozed', promptCount: 1, lastPromptedAt: 0, lastVersion: '' };
    }
  }

  return { ...DEFAULT_SUPPORT_PROMPT_STATE };
}

export function shouldTriggerSupportPromptModal(input: {
  state: SupportPromptState;
  streakDays: number;
  sessionStudiedCount: number;
  sessionAccuracyPct: number;
  isPreviewSession: boolean;
  isNewDayReady: boolean;
  zenMode: boolean;
  studioVersion: string;
  nowSec?: number;
}): boolean {
  if (input.zenMode || input.isPreviewSession || input.isNewDayReady) return false;
  if (!Number.isFinite(input.sessionStudiedCount) || input.sessionStudiedCount <= 0) {
    return false;
  }
  if (
    !Number.isFinite(input.sessionAccuracyPct) ||
    input.sessionAccuracyPct < SUPPORT_PROMPT_MIN_SESSION_ACCURACY
  ) {
    return false;
  }
  if (!Number.isFinite(input.streakDays) || input.streakDays < SUPPORT_PROMPT_MIN_STREAK_DAYS) {
    return false;
  }

  const st = normalizeSupportPromptState(input.state);
  if (st.status === 'liked' || st.status === 'opted_out' || st.status === 'exhausted') {
    return false;
  }
  if (st.promptCount >= SUPPORT_PROMPT_MAX_ATTEMPTS) {
    return false;
  }
  if (st.status === 'idle' && st.promptCount === 0) {
    return true;
  }

  const now =
    input.nowSec !== undefined && Number.isFinite(input.nowSec)
      ? Math.max(0, Math.floor(input.nowSec))
      : Math.floor(Date.now() / 1000);
  const elapsed =
    st.lastPromptedAt > 0 ? Math.max(0, now - st.lastPromptedAt) : Number.POSITIVE_INFINITY;
  const currentVer = String(input.studioVersion || '').trim();
  const prevVer = st.lastVersion.trim();
  const versionChanged = Boolean(currentVer && prevVer && currentVer !== prevVer);

  if (st.status === 'snoozed' || st.status === 'opened_unconfirmed') {
    if (st.promptCount <= 1) {
      return elapsed >= SUPPORT_PROMPT_COOLDOWN_SECOND_SEC;
    }
    if (st.promptCount === 2) {
      return (
        elapsed >= SUPPORT_PROMPT_COOLDOWN_FINAL_SEC ||
        (versionChanged && elapsed >= SUPPORT_PROMPT_COOLDOWN_VERSION_BUMP_SEC)
      );
    }
    return false;
  }

  if (st.status === 'feedback') {
    return versionChanged && elapsed >= SUPPORT_PROMPT_COOLDOWN_FEEDBACK_SEC;
  }

  return false;
}

export function applySupportPromptOutcome(
  prev: SupportPromptState,
  outcome: SupportPromptOutcome,
  studioVersion: string,
  nowSec?: number
): SupportPromptState {
  const safePrev = normalizeSupportPromptState(prev);
  const now =
    nowSec !== undefined && Number.isFinite(nowSec)
      ? Math.max(0, Math.floor(nowSec))
      : Math.floor(Date.now() / 1000);
  const ver = String(studioVersion || '').trim().slice(0, 32);

  if (outcome === 'liked') {
    return {
      status: 'liked',
      promptCount: Math.max(1, safePrev.promptCount),
      lastPromptedAt: now,
      lastVersion: ver,
    };
  }
  if (outcome === 'opted_out') {
    return {
      status: 'opted_out',
      promptCount: Math.max(1, safePrev.promptCount),
      lastPromptedAt: now,
      lastVersion: ver,
    };
  }
  if (outcome === 'feedback') {
    return {
      status: 'feedback',
      promptCount: Math.min(SUPPORT_PROMPT_MAX_ATTEMPTS, safePrev.promptCount + 1),
      lastPromptedAt: now,
      lastVersion: ver,
    };
  }

  const nextCount = Math.min(SUPPORT_PROMPT_MAX_ATTEMPTS, safePrev.promptCount + 1);
  return {
    status: nextCount >= SUPPORT_PROMPT_MAX_ATTEMPTS ? 'exhausted' : outcome,
    promptCount: nextCount,
    lastPromptedAt: now,
    lastVersion: ver,
  };
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
