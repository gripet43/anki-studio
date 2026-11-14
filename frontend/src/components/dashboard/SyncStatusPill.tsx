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
      <div className="py-2.5 space-y-1 text-[11px]">
        <div className="flex items-center justify-between text-[var(--text-secondary)]">
          <span>{t('synced')}</span>
          {hasSynced ? (
            <time
              dateTime={isoTimestamp}
              className="font-mono text-[var(--text-primary)] tabular-nums"
            >
              {relativeTimeStr}
            </time>
          ) : (
            <span className="font-mono text-[var(--text-primary)]">
              {t('neverSyncedShort')}
            </span>
          )}
        </div>
        {hasSynced && detailedTimeStr && (
          <div className="text-[10px] text-[var(--text-secondary)] text-end font-mono tabular-nums">
            <time dateTime={isoTimestamp}>{detailedTimeStr}</time>
          </div>
        )}
        {!hasSynced && (
          <div className="text-[10px] text-[var(--text-secondary)] text-end">
            {t('noCloudSyncRecord')}
          </div>
        )}
      </div>

      {/* Sync Guidance Footnote (此时间代表上次同步云端时间。如有新的修改，请点击按钮完成同步。) */}
      <div className="pt-2.5 text-[10.5px] leading-relaxed text-[var(--text-secondary)] border-t border-[var(--border-subtle)]">
        {hasSynced
          ? t('syncSnapshotFootnote')
          : t('syncNoRecordFootnote')}
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
      {/* Lightweight Inline Status Trigger matching reference visual */}
      <button
        type="button"
        onClick={(e) => handleTriggerSync(e)}
        aria-disabled={isSyncActive || undefined}
        aria-label={triggerAriaLabel}
        className={`group relative select-none h-9 px-2.5 rounded-xl text-[12.5px] flex items-center gap-2 shrink-0 whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
          isSyncActive
            ? 'cursor-default'
            : 'cursor-pointer motion-safe:active:scale-[0.98] hover:bg-black/[0.035] dark:hover:bg-white/[0.05]'
        }`}
      >
        {/* Status Icon：同步中为脉冲点，其余按快照真实状态显示云图标（已同步 = 绿色云） */}
        <span
          aria-hidden="true"
          className="w-3.5 h-3.5 shrink-0 flex items-center justify-center"
        >
          {isSyncActive ? (
            <span className="w-2 h-2 rounded-full bg-[var(--status-warning)] motion-safe:animate-ping" />
          ) : (
            <SyncStateIcon state={syncVisualState} size="sm" />
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
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] whitespace-nowrap">
              <span className="font-medium text-[12.5px] leading-[1.4] whitespace-nowrap">
                {t('synced')}
              </span>
              <span aria-hidden="true" className="text-[var(--text-muted)] text-[12px] leading-[1.4] shrink-0">
                ·
              </span>
              <time
                dateTime={isoTimestamp}
                className="text-[12.5px] font-medium tracking-tight tabular-nums leading-[1.4] whitespace-nowrap"
              >
                {relativeTimeStr}
              </time>
            </div>
          ) : (
            <span className="font-medium text-[12.5px] text-[var(--text-secondary)] leading-[1.4] whitespace-nowrap">
              {t('notSyncedShort')}
            </span>
          )}
        </div>

        {/* Refresh Action Icon + Optional Shortcut Hint */}
        <div className="flex items-center gap-1.5 ms-1 shrink-0">
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
            strokeWidth="2"
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
          <div aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[2px] rounded-full overflow-hidden bg-black/5 dark:bg-white/5">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-[var(--status-warning)] to-transparent animate-shimmer-sweep" />
          </div>
        )}
      </button>
    </HoverCard>
  );
};
