import React, { useEffect, useState } from 'react';
import {
  formatDetailedSyncTimestamp,
  formatRelativeTimeString,
  translate,
} from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { HoverCard } from '../common/HoverCard';
import { SyncStateIcon, SyncVisualState } from '../common/SyncStateIcon';

export const SyncStatusPill: React.FC = () => {
  const {
    syncing,
    isInitialSyncing,
    syncJustFinished,
    lastSyncedTimestamp,
    resolvedLang,
    showShortcutHints,
  } = useAppStore();

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

  // Periodic tick so relative snapshot duration updates live ("刚刚" -> "1分钟前")
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Escape key dismissal (WCAG 1.4.13 Dismissible)
  useEffect(() => {
    if (!isFlyoutOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFlyoutOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlyoutOpen]);

  const handleTriggerSync = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isSyncActive) return;
    appActions.syncCollection();
  };

  const effectiveNow = Math.max(nowTick, lastSyncedTimestamp || 0);
  const relativeTimeStr = formatRelativeTimeString(lastSyncedTimestamp, resolvedLang, effectiveNow);
  const detailedTimeStr = formatDetailedSyncTimestamp(lastSyncedTimestamp);
  const isoTimestamp = hasSynced ? new Date(lastSyncedTimestamp).toISOString() : undefined;

  const triggerAriaLabel = isSyncActive
    ? t('syncingAnkiWebAria')
    : hasSynced
    ? t('syncNowWithSnapshotAria', { rel: relativeTimeStr, abs: detailedTimeStr })
    : t('syncNotYetAria');

  const flyoutContent = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 pb-2.5 border-b border-[var(--border-subtle)]">
        <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
          <SyncStateIcon state={syncVisualState} size="sm" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight">
          {t('syncCloudTitle')}
        </span>
      </div>

      {/* Time & Snapshot Fact */}
      <div className="pt-2.5 text-[11px] flex items-center justify-between gap-3 text-[var(--text-secondary)]">
        <span>{t('synced')}</span>
        {hasSynced && detailedTimeStr ? (
          <time
            dateTime={isoTimestamp}
            className="font-mono text-[var(--text-primary)] tabular-nums"
          >
            {detailedTimeStr}
          </time>
        ) : (
          <span className="font-mono text-[var(--text-primary)]">
            {t('neverSyncedShort')}
          </span>
        )}
      </div>
    </>
  );

  return (
    <HoverCard
      size="md"
      side="bottom"
      align="end"
      offset={8}
      openDelay={200}
      closeDelay={250}
      toggleOnClick={false}
      open={isFlyoutOpen}
      onOpenChange={setIsFlyoutOpen}
      ariaLabel={t('syncCloudTitle')}
      repositionKey={`${syncVisualState}-${hasSynced}`}
      className="sync-pill-forced-border"
      content={flyoutContent}
    >
      {/* Single-Slot Lightweight Inline Sync Trigger */}
      <button
        type="button"
        onClick={(e) => handleTriggerSync(e)}
        aria-disabled={isSyncActive || undefined}
        aria-label={triggerAriaLabel}
        className={`group relative select-none h-9 px-2.5 rounded-xl text-[12.5px] flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
          isSyncActive
            ? 'cursor-default bg-[var(--status-warning)]/[0.08]'
            : syncJustFinished
            ? 'cursor-pointer bg-[var(--status-success)]/[0.08]'
            : 'cursor-pointer motion-safe:active:scale-[0.98] hover:bg-black/[0.035] dark:hover:bg-white/[0.05]'
        }`}
      >
        {/* Single Leading Icon Slot: 常态/同步中为刷新箭头，刚完成瞬态切换为绿色对勾 */}
        <span
          aria-hidden="true"
          className="w-3.5 h-3.5 shrink-0 flex items-center justify-center"
        >
          {syncJustFinished && !isSyncActive ? (
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              style={isSyncActive ? { willChange: 'transform' } : undefined}
              className={`w-3.5 h-3.5 shrink-0 transition-colors motion-safe:transition-[transform,rotate,color] motion-safe:duration-500 ${
                isSyncActive
                  ? 'motion-safe:animate-spin text-[var(--status-warning)]'
                  : hasSynced
                  ? 'text-[var(--text-secondary)] group-hover:text-[var(--brand-text)] motion-safe:group-hover:rotate-180'
                  : 'text-[var(--text-muted)] group-hover:text-[var(--brand-text)] motion-safe:group-hover:rotate-180'
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          )}
        </span>

        {/* Sync Label & Relative Time */}
        <div className="flex items-center shrink-0 whitespace-nowrap py-0.5">
          {isSyncActive ? (
            <span className="text-[12.5px] font-medium text-[var(--status-warning)] tracking-tight leading-[1.4] whitespace-nowrap motion-safe:animate-pulse">
              {isInitialSyncing && !syncing
                ? t('loadingLocalCollection')
                : t('syncing')}
            </span>
          ) : syncJustFinished ? (
            <span className="text-[12.5px] font-semibold text-[var(--status-success)] tracking-tight leading-[1.4] whitespace-nowrap flex items-center gap-1 animate-sync-reveal">
              <span>{t('syncCompleted')}</span>
            </span>
          ) : hasSynced ? (
            <time
              dateTime={isoTimestamp}
              className="text-[12.5px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors tracking-tight tabular-nums leading-[1.4] whitespace-nowrap"
            >
              {relativeTimeStr}
            </time>
          ) : (
            <span className="font-medium text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors leading-[1.4] whitespace-nowrap">
              {t('notSyncedShort')}
            </span>
          )}
        </div>

        {/* Optional Shortcut Hint */}
        {showShortcutHints && (
          <kbd className="hidden sm:inline-block ms-0.5 text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[var(--text-secondary)] font-mono leading-[1.2] font-semibold">
            Y
          </kbd>
        )}

        {/* Bottom Progress Sweep during active sync */}
        {isSyncActive && (
          <div aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[2px] rounded-full overflow-hidden bg-black/5 dark:bg-white/5">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-[var(--status-warning)] to-transparent animate-shimmer-sweep" />
          </div>
        )}
      </button>
    </HoverCard>
  );
};
