import React, { useEffect, useRef, useState } from 'react';
import {
  formatDetailedSyncTimestamp,
  formatRelativeTimeString,
  translate,
} from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { SyncStateIcon, SyncVisualState } from '../common/SyncStateIcon';

export const SyncStatusPill: React.FC = () => {
  const {
    syncing,
    isInitialSyncing,
    syncJustFinished,
    lastSyncedTimestamp,
    theme,
    resolvedLang,
    showShortcutHints,
  } = useAppStore();

  const isZh = resolvedLang === 'zh-CN';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);

  const hasSynced = Boolean(lastSyncedTimestamp && lastSyncedTimestamp > 0);
  const isSyncActive = syncing || isInitialSyncing;
  const syncVisualState: SyncVisualState = isSyncActive
    ? 'syncing'
    : syncJustFinished
    ? 'justFinished'
    : hasSynced
    ? 'snapshot'
    : 'unsynced';

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const escDismissedRef = useRef(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Periodic tick so relative snapshot duration updates live ("刚刚" -> "1分钟前")
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup pending hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Click outside & Escape key dismissal (WCAG 1.4.13 Dismissible)
  useEffect(() => {
    if (!isFlyoutOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setIsFlyoutOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        escDismissedRef.current = true;
        setIsFlyoutOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFlyoutOpen]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (escDismissedRef.current) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    escDismissedRef.current = false;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(false);
    }, 250);
  };

  const handleFocusCapture = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (!escDismissedRef.current) {
      setIsFlyoutOpen(true);
    }
  };

  const handleBlurCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = e.relatedTarget as Node | null;
    if (!nextTarget || !flyoutRef.current?.contains(nextTarget)) {
      escDismissedRef.current = false;
      setIsFlyoutOpen(false);
    }
  };

  const handleTriggerSync = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (syncing) return;
    appActions.syncCollection();
  };

  const pillSurface =
    theme === 'oled'
      ? 'bg-[#121216]/90 border-[#262632] hover:border-[#383848] text-white shadow-xs'
      : theme === 'dark'
      ? 'bg-[#1C1C24]/80 border-white/[0.08] hover:border-white/[0.16] text-[#F4F4F6] shadow-xs'
      : 'bg-white/85 border-black/[0.08] hover:border-black/[0.16] text-[#1D1D1F] shadow-xs';

  const popoverSurface =
    theme === 'oled'
      ? 'bg-[#121216]/98 border-[#262632] text-white shadow-[0_16px_36px_rgba(0,0,0,0.7)]'
      : theme === 'dark'
      ? 'bg-[#1E1E26]/95 border-[#2F2F3D] text-[#F4F4F6] shadow-[0_16px_36px_rgba(0,0,0,0.45)]'
      : 'bg-white/95 border-[#E5E5EA] text-[#1D1D1F] shadow-[0_16px_36px_rgba(0,0,0,0.14)]';

  const effectiveNow = Math.max(nowTick, lastSyncedTimestamp || 0);
  const relativeTimeStr = formatRelativeTimeString(lastSyncedTimestamp, resolvedLang, effectiveNow);
  const detailedTimeStr = formatDetailedSyncTimestamp(lastSyncedTimestamp);
  const isoTimestamp = hasSynced ? new Date(lastSyncedTimestamp).toISOString() : undefined;

  const triggerAriaLabel = isSyncActive
    ? isZh
      ? '正在与 AnkiWeb 同步'
      : 'Syncing with AnkiWeb'
    : hasSynced
    ? isZh
      ? `立即与 AnkiWeb 同步，上次同步：${relativeTimeStr}（${detailedTimeStr}），快捷键 Y`
      : `Sync with AnkiWeb now, last synced ${relativeTimeStr} (${detailedTimeStr}), shortcut Y`
    : isZh
    ? '尚未与 AnkiWeb 同步，点击立即同步，快捷键 Y'
    : 'Not synced with AnkiWeb yet, click to sync now, shortcut Y';

  return (
    <div
      ref={flyoutRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
      className="relative select-none"
    >
      {/* Outer Pill Trigger: clicks trigger sync; hover/focus discloses snapshot details */}
      <button
        type="button"
        onClick={() => handleTriggerSync()}
        disabled={isSyncActive}
        aria-label={triggerAriaLabel}
        className={`group relative h-9 pl-3.5 pr-2.5 rounded-full border text-[12px] flex items-center gap-2 transition-colors duration-200 backdrop-blur-md motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sync-pill-forced-border ${pillSurface} ${
          isSyncActive
            ? 'ring-1 ring-[var(--status-warning)]/30 cursor-default'
            : syncJustFinished
            ? 'border-[var(--status-success)]/60 ring-1 ring-[var(--status-success)]/35 cursor-default'
            : 'cursor-pointer hover:shadow-md hover:border-[var(--brand-border)]'
        }`}
      >
        {/* Left Semantic Icon (Neutral Cloud for past snapshot; green check ONLY transiently on sync finish) */}
        <div className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0">
          <SyncStateIcon state={syncVisualState} size="sm" />
        </div>

        {/* Sync Label & Factual Relative Time */}
        <div className="flex items-center min-w-0 overflow-hidden">
          {isSyncActive ? (
            <span className="text-[12px] font-semibold text-[var(--status-warning)] tracking-tight motion-safe:animate-pulse truncate">
              {isInitialSyncing && !syncing
                ? isZh
                  ? '本地卡库就绪中...'
                  : 'Loading local...'
                : t('syncing')}
            </span>
          ) : syncJustFinished ? (
            <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight flex items-center gap-1 animate-sync-reveal">
              <span>{t('syncCompleted')}</span>
            </span>
          ) : hasSynced ? (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[12px] leading-none text-[var(--text-primary)]">
                {t('synced')}
              </span>
              <span aria-hidden="true" className="text-[var(--text-muted)] text-[11px] leading-none">
                ·
              </span>
              <time
                dateTime={isoTimestamp}
                className="text-[11px] text-[var(--text-secondary)] font-normal tracking-tight tabular-nums leading-none"
              >
                {relativeTimeStr}
              </time>
            </div>
          ) : (
            <span className="font-medium text-[12px] text-[var(--text-secondary)] leading-none">
              {isZh ? '尚未同步' : 'Not synced'}
            </span>
          )}
        </div>

        {/* Hairline Divider */}
        <div aria-hidden="true" className="w-px h-3.5 bg-black/[0.08] dark:bg-white/[0.1] mx-0.5 shrink-0" />

        {/* Action Trigger Icon + Optional Shortcut Hint */}
        <div className="flex items-center gap-1.5 px-1 py-0.5 rounded-full">
          <svg
            aria-hidden="true"
            style={isSyncActive ? { willChange: 'transform' } : undefined}
            className={`w-3.5 h-3.5 transition-colors motion-safe:transition-[transform,rotate,color] motion-safe:duration-500 ${
              isSyncActive
                ? 'motion-safe:animate-spin text-[var(--status-warning)]'
                : syncJustFinished
                ? 'text-[var(--status-success)]'
                : 'text-[var(--text-secondary)] group-hover:text-[var(--brand-text)] motion-safe:group-hover:rotate-180'
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>

          {showShortcutHints && (
            <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[var(--text-secondary)] font-mono leading-none font-semibold">
              Y
            </kbd>
          )}
        </div>

        {/* Bottom Progress Sweep during active sync */}
        {isSyncActive && (
          <div aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[2px] rounded-full overflow-hidden bg-black/5 dark:bg-white/5">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-[var(--status-warning)] to-transparent animate-shimmer-sweep" />
          </div>
        )}
      </button>

      {/* Honest Snapshot Details Hovercard */}
      {isFlyoutOpen && (
        <div
          className={`absolute right-0 top-11 z-50 w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl border p-3.5 backdrop-blur-xl animate-flyout-enter sync-pill-forced-border ${popoverSurface}`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-[var(--brand-text)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
            <span className="text-[13px] font-semibold tracking-tight">
              {t('syncCloudTitle')}
            </span>
          </div>

          {/* Time & Snapshot Fact */}
          <div className="py-2.5 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>{isZh ? '上次同步' : 'Last sync'}</span>
              {hasSynced ? (
                <time
                  dateTime={isoTimestamp}
                  className="font-mono text-[#1D1D1F] dark:text-[#E5E5EA] tabular-nums"
                >
                  {relativeTimeStr}
                </time>
              ) : (
                <span className="font-mono text-[#1D1D1F] dark:text-[#E5E5EA]">
                  {isZh ? '从未同步' : 'Never'}
                </span>
              )}
            </div>
            {hasSynced && detailedTimeStr && (
              <div className="text-[10px] text-[var(--text-secondary)] text-right font-mono tabular-nums">
                <time dateTime={isoTimestamp}>{detailedTimeStr}</time>
              </div>
            )}
            {!hasSynced && (
              <div className="text-[10px] text-[var(--text-secondary)] text-right">
                {isZh ? '暂无云端同步记录' : 'No cloud sync record'}
              </div>
            )}
          </div>

          {/* Sync Guidance Footnote */}
          <div className="pt-2.5 text-[10.5px] leading-relaxed text-[var(--text-secondary)] border-t border-black/[0.04] dark:border-white/[0.04]">
            {hasSynced
              ? isZh
                ? '此时间代表上次同步云端时间。如有新的修改，请点击按钮完成同步。'
                : 'This timestamp reflects the last cloud sync. If you have new edits, click the button to sync.'
              : isZh
              ? '暂无云端同步记录。如有需要，请点击按钮完成同步。'
              : 'No cloud sync record yet. Click the button to sync.'}
          </div>
        </div>
      )}
    </div>
  );
};
