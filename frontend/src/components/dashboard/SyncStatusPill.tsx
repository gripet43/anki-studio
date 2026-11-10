import React, { useEffect, useRef, useState } from 'react';
import {
  formatDetailedSyncTimestamp,
  formatRelativeTimeString,
  translate,
} from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const SyncStatusPill: React.FC = () => {
  const {
    syncing,
    isInitialSyncing,
    syncJustFinished,
    lastSyncedTimestamp,
    theme,
    accentColor,
    resolvedLang,
    showShortcutHints,
  } = useAppStore();

  const isZh = resolvedLang === 'zh-CN';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);

  const hasSynced = Boolean(lastSyncedTimestamp && lastSyncedTimestamp > 0);

  // Transition from syncing / initial check to ready state
  const isSyncActive = syncing || isInitialSyncing;
  const hoverTimeoutRef = useRef<any>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Periodic tick so relative time ("刚刚" -> "1分钟前") updates live
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Click outside to close flyout
  useEffect(() => {
    if (!isFlyoutOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setIsFlyoutOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isFlyoutOpen]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(false);
    }, 250);
  };

  const handleTriggerSync = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (syncing) return;
    appActions.syncCollection();
  };

  const brandHex = getAccentScale(accentColor, theme).brand;
  const isDark = theme === 'dark' || theme === 'oled';

  // Apple-grade frosted glass materials
  const pillSurface =
    theme === 'oled'
      ? 'bg-[#121216]/90 border-[#262632] hover:border-[#383848] text-white shadow-xs'
      : theme === 'dark'
      ? 'bg-[#1C1C24]/80 border-white/[0.08] hover:border-white/[0.16] text-[#F4F4F6] shadow-xs'
      : 'bg-white/80 border-black/[0.08] hover:border-black/[0.16] text-[#1D1D1F] shadow-xs';

  const popoverSurface =
    theme === 'oled'
      ? 'bg-[#121216]/98 border-[#262632] text-white shadow-[0_16px_36px_rgba(0,0,0,0.7)]'
      : theme === 'dark'
      ? 'bg-[#1E1E26]/95 border-[#2F2F3D] text-[#F4F4F6] shadow-[0_16px_36px_rgba(0,0,0,0.45)]'
      : 'bg-white/95 border-[#E5E5EA] text-[#1D1D1F] shadow-[0_16px_36px_rgba(0,0,0,0.14)]';

  const relativeTimeStr = formatRelativeTimeString(lastSyncedTimestamp, resolvedLang, nowTick);
  const detailedTimeStr = formatDetailedSyncTimestamp(lastSyncedTimestamp);

  return (
    <div
      ref={flyoutRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative select-none"
    >
      {/* Outer Pill Button (Clicking anywhere triggers sync!) */}
      <button
        type="button"
        onClick={() => handleTriggerSync()}
        disabled={isSyncActive}
        title={
          hasSynced
            ? isZh
              ? `上次云端同步：${detailedTimeStr || relativeTimeStr} (点击立即同步 · 快捷键 Y)`
              : `Last synced: ${detailedTimeStr || relativeTimeStr} (Click to sync · Hotkey Y)`
            : isZh
            ? '尚未与 AnkiWeb 云端同步 (点击立即同步 · 快捷键 Y)'
            : 'Not synced with AnkiWeb yet (Click to sync · Hotkey Y)'
        }
        className={`group relative h-9 pl-3.5 pr-2.5 rounded-full border text-[12px] flex items-center gap-2 transition-all duration-300 backdrop-blur-md active:scale-[0.98] ${pillSurface} ${
          isSyncActive
            ? 'animate-sync-glow ring-1 ring-[var(--status-warning)]/30 cursor-default'
            : syncJustFinished
            ? 'animate-sync-success border-[var(--status-success)]/70 ring-1 ring-[var(--status-success)]/40 cursor-default'
            : 'cursor-pointer hover:shadow-md hover:border-[var(--brand-border)]'
        }`}
      >
        {/* Status Breathing Light / Animated State Icon */}
        <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
          {isSyncActive ? (
            /* Apple-style dual-arc orbiting spinner */
            <div className="w-3 h-3 rounded-full border-[1.8px] border-[var(--status-warning)]/20 border-t-[var(--status-warning)] animate-spin" />
          ) : syncJustFinished ? (
            /* Apple-style animated draw checkmark */
            <svg
              className="w-3.5 h-3.5 text-[var(--status-success)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline
                points="20 6 9 17 4 12"
                className="animate-draw-check"
              />
            </svg>
          ) : hasSynced ? (
            /* Calm steady emerald dot */
            <span className="w-2 h-2 rounded-full bg-[var(--status-success)] shadow-[0_0_6px_rgba(47,148,97,0.4)] transition-all duration-300" />
          ) : (
            /* Neutral gray dot for un-synced account */
            <span className="w-2 h-2 rounded-full bg-[#8E8E93]/60 shadow-xs transition-all duration-300" />
          )}
        </div>

        {/* Sync Text & Relative Duration */}
        <div className="flex items-center min-w-0 overflow-hidden">
          {isSyncActive ? (
            <span className="text-[12px] font-semibold text-[var(--status-warning)] tracking-tight animate-pulse truncate">
              {isInitialSyncing && !syncing
                ? (isZh ? '本地卡库就绪中...' : 'Loading local...')
                : t('syncing')}
            </span>
          ) : syncJustFinished ? (
            <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight flex items-center gap-1 animate-sync-reveal">
              <span>{isZh ? '同步完成' : t('syncCompleted')}</span>
            </span>
          ) : hasSynced ? (
            <div className="flex items-center gap-1 transition-opacity duration-300">
              <span className="font-medium text-[12px] leading-none group-hover:text-[var(--brand-text)] transition-colors">
                {t('synced')}
              </span>
              <span className="text-[11px] text-[#8E8E93] font-normal tracking-tight">
                ({relativeTimeStr})
              </span>
            </div>
          ) : (
            <span className="font-medium text-[12px] text-[#8E8E93] group-hover:text-[var(--brand-text)] leading-none transition-colors">
              {isZh ? '尚未同步' : 'Not synced'}
            </span>
          )}
        </div>

        {/* Hairline Divider */}
        <div className="w-px h-3.5 bg-black/[0.08] dark:bg-white/[0.1] mx-0.5 shrink-0" />

        {/* Action Trigger Area (Vector Curved Refresh Icon + Hotkey Y) */}
        <div className="flex items-center gap-1.5 px-1 py-0.5 rounded-full transition-colors">
          {/* Custom Vector Double-Arrow SVG (SF Symbols style) */}
          <svg
            style={isSyncActive ? { willChange: 'transform' } : undefined}
            className={`w-3.5 h-3.5 transition-all duration-500 ${
              isSyncActive
                ? 'animate-spin text-[var(--status-warning)]'
                : syncJustFinished
                ? 'text-[var(--status-success)] scale-110'
                : 'text-[#8E8E93] group-hover:text-[var(--brand-text)] group-hover:rotate-180'
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

          {/* Hotkey Tag (Y) */}
          {showShortcutHints && (
            <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#8E8E93] group-hover:text-[var(--brand-text)] font-mono leading-none font-semibold transition-colors">
              Y
            </kbd>
          )}
        </div>

        {/* Bottom Shimmer Line during active sync */}
        {isSyncActive && (
          <div className="absolute inset-x-3 bottom-0 h-[2px] rounded-full overflow-hidden bg-black/5 dark:bg-white/5">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-[var(--status-warning)] to-transparent animate-shimmer-sweep" />
          </div>
        )}
      </button>

      {/* Sleek, Apple-Grade Status Popover */}
      {isFlyoutOpen && (
        <div
          className={`absolute right-0 top-11 z-50 w-[270px] rounded-2xl border p-3.5 backdrop-blur-xl transition-all duration-150 animate-in fade-in-50 zoom-in-95 shadow-[0_16px_36px_rgba(0,0,0,0.18)] ${popoverSurface}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--brand-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              </svg>
              <span className="text-[13px] font-semibold tracking-tight">
                {isZh ? 'AnkiWeb 云端同步' : 'AnkiWeb Sync'}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1.5 ${
                syncing
                  ? 'bg-[var(--status-warning-soft)] text-[var(--status-warning)]'
                  : hasSynced
                  ? 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                  : 'bg-black/5 dark:bg-white/10 text-[#8E8E93]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncing
                    ? 'bg-[var(--status-warning)] animate-ping'
                    : hasSynced
                    ? 'bg-[var(--status-success)]'
                    : 'bg-[#8E8E93]'
                }`}
              />
              <span>
                {syncing
                  ? (isZh ? '同步中' : 'Syncing')
                  : hasSynced
                  ? (isZh ? '已同步' : 'Synced')
                  : (isZh ? '未同步' : 'Not synced')}
              </span>
            </span>
          </div>

          {/* Time & Info */}
          <div className="py-2.5 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-[#8E8E93]">
              <span>{isZh ? '上次同步' : 'Last sync'}</span>
              <span className="font-mono text-[#1D1D1F] dark:text-[#E5E5EA]">
                {hasSynced ? relativeTimeStr : (isZh ? '从未同步' : 'Never')}
              </span>
            </div>
            {hasSynced && detailedTimeStr && (
              <div className="text-[10px] text-[#8E8E93] text-right font-mono">
                {detailedTimeStr}
              </div>
            )}
            {!hasSynced && (
              <div className="text-[10px] text-[#8E8E93] text-right">
                {isZh ? '暂无云端同步记录' : 'No cloud sync record'}
              </div>
            )}
          </div>

          {/* Transparent Truth Explanatory Footnote */}
          <div className="py-2 text-[10.5px] leading-relaxed text-[#8E8E93] border-t border-black/[0.04] dark:border-white/[0.04]">
            {isZh
              ? '💡 本地修改已实时自动保存至 SQLite。点击立即同步即可与 AnkiWeb 云端双向对齐。'
              : '💡 Local edits auto-save to SQLite. Click Sync to exchange with AnkiWeb.'}
          </div>

          {/* Action Row */}
          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTriggerSync()}
              disabled={syncing}
              style={{ backgroundColor: brandHex }}
              className={`flex-1 h-8 px-3 rounded-xl text-white font-medium text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                syncing ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-95 active:scale-[0.98]'
              }`}
            >
              <svg
                className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              <span>{syncing ? (isZh ? '同步中...' : 'Syncing...') : (isZh ? '立即同步' : 'Sync Now')}</span>
              {showShortcutHints && !syncing && (
                <kbd className="px-1 py-0.2 rounded bg-white/20 text-[9px] font-mono leading-none">
                  Y
                </kbd>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFlyoutOpen(false);
                appActions.openSettings('sync');
              }}
              title={isZh ? '同步设置' : 'Sync Settings'}
              className={`h-8 px-2.5 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center ${
                isDark
                  ? 'border-[#2F2F3D] text-[#8E8E93] hover:text-white hover:bg-white/5'
                  : 'border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5'
              }`}
            >
              {isZh ? '设置' : 'Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
