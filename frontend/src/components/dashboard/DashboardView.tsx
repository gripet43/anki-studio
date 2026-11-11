import React, { useMemo, useState } from 'react';
import {
  formatFullDateWithWeekday,
  formatShortcut,
  translate,
} from '../../i18n/translations';
import { appActions, setAppState, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';
import { StreakFlameBackdrop } from './StreakFlameBackdrop';
import { SyncStatusPill } from './SyncStatusPill';

export const DashboardView: React.FC = () => {
  const {
    isInitialSyncing,
    syncJustFinished,
    dashboard,
    decks,
    showAllDashboardDecks,
    syncing,
    theme,
    accentColor,
    resolvedLang,
    showShortcutHints,
    envInfo,
  } = useAppStore();

  const isSyncPending = isInitialSyncing || syncing;

  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  const platform = envInfo.platform;

  // Item #3: Interactive Floating Tooltips for Heatmap & Weekly Rhythm
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{
    date: string;
    count: number;
    accuracy: number;
    isFrozen?: boolean;
    colIdx: number;
    rowIdx: number;
  } | null>(null);

  const [hoveredRhythmIdx, setHoveredRhythmIdx] = useState<number | null>(null);
  const [masteryHintId, setMasteryHintId] = useState<string | null>(null);
  const [peekNormalDashboard, setPeekNormalDashboard] = useState<boolean>(false);

  const accentScale = getAccentScale(accentColor, theme);
  const brandHex = accentScale.brand;
  const isDark = theme === 'dark' || theme === 'oled';

  const cardSurface =
    theme === 'oled'
      ? 'bg-[#111216] border-[#22232B] text-[#F4F4F6]'
      : theme === 'dark'
      ? 'bg-[#1A1B21] border-[#2A2C36] text-[#F2F3F7]'
      : 'bg-white border-[#EAECEF] text-[#1D1D1F]';

  const subText = 'text-[#636366] dark:text-[#8E8E93]';

  const completed = dashboard.todayStats.completed;
  const totalPending = dashboard.todayStats.totalPending;
  const totalWorkload =
    dashboard.todayStats.totalTodayWorkload !== undefined
      ? dashboard.todayStats.totalTodayWorkload
      : completed + totalPending;

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const pct =
    totalWorkload > 0
      ? Math.min(1, completed / totalWorkload)
      : completed > 0
      ? 1
      : 0;
  const strokeDashoffset = circumference * (1 - pct);

  const topLevelDecks = decks.filter((d) => !d.isChild);
  const displayedDecks = showAllDashboardDecks ? decks : topLevelDecks;

  const recent182Cells = useMemo(() => {
    const allCells = dashboard.heatmap.cells || [];
    if (allCells.length >= 182) {
      return allCells.slice(allCells.length - 182);
    }
    return allCells;
  }, [dashboard.heatmap.cells]);

  const dynamicMonthLabels = useMemo(() => {
    if (!recent182Cells.length) return [];
    const seenMonths: string[] = [];
    for (let colIdx = 0; colIdx < 26; colIdx++) {
      const cell = recent182Cells[colIdx * 7];
      if (cell && cell.date) {
        const parts = cell.date.split('-');
        const mNum = parseInt(parts[1], 10);
        if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
          let label = `${mNum}`;
          try {
            label = new Intl.DateTimeFormat(resolvedLang, { month: 'short' }).format(
              new Date(2026, mNum - 1, 1)
            );
          } catch {}
          if (seenMonths[seenMonths.length - 1] !== label) {
            seenMonths.push(label);
          }
        }
      }
    }
    return seenMonths;
  }, [recent182Cells, resolvedLang]);

  const deckIconMap: Record<string, React.ReactNode> = {
    indigo: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    blue: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    emerald: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    amber: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  };

  const heatmapLevelStyle = (level: number): React.CSSProperties => {
    switch (level) {
      case 1:
        return { backgroundColor: accentScale.heatmap[0] };
      case 2:
        return { backgroundColor: accentScale.heatmap[1] };
      case 3:
        return { backgroundColor: accentScale.heatmap[2] };
      case 4:
        return { backgroundColor: accentScale.heatmap[3] };
      default:
        return {
          backgroundColor: isDark ? (theme === 'oled' ? '#191920' : '#252630') : '#ECECEF',
        };
    }
  };

  const maxWeeklyCount = Math.max(1, ...dashboard.weeklyRhythm.days.map((d) => d.count));
  const displayName = dashboard.userName ? `, ${dashboard.userName}` : '';

  const isVacationActive = Boolean(dashboard.vacation?.isActive);
  const vacDays = Math.max(1, dashboard.vacation?.days || 1);
  const vacRemaining = Math.max(1, dashboard.vacation?.remainingDays || 1);
  const vacPct = Math.min(1, Math.max(0.12, vacRemaining / vacDays));
  const vacDashoffset = circumference * (1 - vacPct);

  const vacationTimelineInfo = useMemo(() => {
    const startRaw = dashboard.vacation?.startDate || '';
    const endRaw = dashboard.vacation?.endDate || '';
    const fmtIso = (iso: string) => {
      const parts = iso.split('-').map((x) => parseInt(x, 10));
      if (parts.length < 3 || parts.some(isNaN)) return iso;
      return `${parts[1]}/${parts[2]}`;
    };
    let returnDateStr = '';
    if (endRaw) {
      const parts = endRaw.split('-').map((x) => parseInt(x, 10));
      if (parts.length === 3 && !parts.some(isNaN)) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        dt.setDate(dt.getDate() + 1);
        returnDateStr = `${dt.getMonth() + 1}/${dt.getDate()}`;
      }
    }
    return {
      startLabel: startRaw ? fmtIso(startRaw) : t('todayLabel'),
      endLabel: endRaw ? fmtIso(endRaw) : '',
      returnLabel: returnDateStr,
    };
  }, [dashboard.vacation?.startDate, dashboard.vacation?.endDate, resolvedLang]);

  return (
    <div className="flex-1 h-screen overflow-y-auto px-5 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
      {/* Top Header Row — Synced Status Capsule & Cmd+K Search */}
      <header
        onMouseDown={startWindowDrag}
        onDoubleClick={handleWindowDoubleClick}
        className="flex flex-wrap items-center justify-between gap-3 select-none cursor-default"
      >
        <div className="min-w-[180px]">
          <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight whitespace-nowrap">
            {dashboard.greeting}
            {displayName}
          </h1>
          {isSyncPending ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--status-warning)] animate-ping shrink-0" />
              <span className="text-[12px] font-medium text-[var(--status-warning)] tracking-tight whitespace-nowrap">
                {syncing ? t('syncingAnkiWebAria') : t('loadingLocalCollection')}
              </span>
            </div>
          ) : syncJustFinished ? (
            <div className="flex items-center gap-1.5 mt-1 animate-sync-reveal">
              <svg className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
              </svg>
              <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight whitespace-nowrap">
                {t('syncCompleted')}
              </span>
            </div>
          ) : (
            <p className={`text-[13px] ${subText} mt-0.5 font-medium whitespace-nowrap`}>
              {dashboard.dateDisplay}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ms-auto">
          {/* Apple Inset Translucent Synced Status Capsule with Rich Flyout */}
          <SyncStatusPill />

          {/* Cmd+K Global Search Box */}
          <button
            onClick={() => setAppState({ cmdKOpen: true })}
            className={`h-9 ${
              showShortcutHints ? 'w-[190px] sm:w-[220px]' : 'w-[156px] sm:w-[180px]'
            } px-3.5 rounded-xl border text-[12px] flex items-center justify-between cursor-pointer transition-all hover:border-[var(--brand-border)] ${cardSurface}`}
          >
            <span className={`flex items-center gap-2 ${subText} truncate`}>
              <svg
                className="w-3.5 h-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="truncate">{t('searchPlaceholder')}</span>
            </span>
            {showShortcutHints && (
              <kbd
                className={`px-1.5 py-0.5 text-[10px] rounded border shrink-0 ${
                  isDark
                    ? 'bg-[#262630] border-[#3A3A44] text-[#98989F]'
                    : 'bg-[#F4F4F6] border-[#E5E5EA] text-[#8E8E93]'
                }`}
              >
                {formatShortcut('Cmd K', platform)}
              </kbd>
            )}
          </button>
        </div>
      </header>

      {/* Active Vacation Sanctuary Full-Canvas View (享受你的假期 ^_^) */}
      {isVacationActive && !peekNormalDashboard && !isSyncPending ? (
        <article
          className={`relative rounded-3xl border px-10 py-12 min-h-[540px] flex flex-col items-center justify-center text-center overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.025)] transition-all duration-500 ${cardSurface}`}
          aria-label={t('vacationModalTitle')}
        >
          {/* Ambient Soft Studio Glows */}
          <div
            className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[520px] h-[220px] rounded-full blur-3xl opacity-25"
            style={{
              background:
                'radial-gradient(circle, var(--status-success) 0%, var(--brand) 65%, transparent 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-28 right-12 w-[320px] h-[180px] rounded-full blur-3xl opacity-15"
            style={{
              background: 'radial-gradient(circle, var(--brand) 0%, transparent 75%)',
            }}
          />

          {/* Bespoke Minimalist Zen Sanctuary Illustration */}
          <div className="relative mb-6 select-none">
            <svg
              width="240"
              height="152"
              viewBox="0 0 240 152"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto overflow-visible"
              role="img"
              aria-label={t('vacationModalTitle')}
            >
              <rect
                x="36"
                y="12"
                width="168"
                height="124"
                rx="62"
                fill="currentColor"
                className="text-[var(--status-success)] opacity-[0.06] dark:opacity-[0.09]"
              />
              <rect
                x="48"
                y="22"
                width="144"
                height="104"
                rx="52"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                className="text-[var(--status-success)] opacity-25"
              />
              <circle
                cx="148"
                cy="52"
                r="16"
                fill="currentColor"
                className="text-[var(--status-warning)] opacity-20"
              />
              <circle
                cx="148"
                cy="52"
                r="10"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-[var(--status-warning)] opacity-75"
              />
              <path
                d="M66 56H92C95.3 56 98 53.3 98 50C98 46.9 95.6 44.3 92.6 44C91.5 39.4 87.4 36 82.5 36C76.7 36 72 40.7 72 46.5C72 46.8 72 47.1 72.1 47.4C68.6 48.1 66 51.2 66 55"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#8E8E93] opacity-55"
              />
              <path
                d="M44 112C68 92 98 92 124 108C146 95 172 95 196 112"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="text-[var(--status-success)] opacity-55"
              />
              <path
                d="M32 122H208"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="text-[#8E8E93] opacity-30"
              />
              <rect
                x="74"
                y="108"
                width="48"
                height="12"
                rx="3.5"
                fill="currentColor"
                className="text-[var(--brand)] opacity-15"
              />
              <rect
                x="74"
                y="108"
                width="48"
                height="12"
                rx="3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-[var(--brand-text)]"
              />
              <path
                d="M84 114H112"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                className="text-[var(--brand-text)] opacity-60"
              />
              <path
                d="M96 120V127L100 124.5L104 127V120"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--status-warning)]"
              />
              <path
                d="M136 104H158V113C158 117.97 153.97 122 149 122H145C140.03 122 136 117.97 136 113V104Z"
                fill="currentColor"
                className="text-[var(--status-success)] opacity-15"
              />
              <path
                d="M136 104H158V113C158 117.97 153.97 122 149 122H145C140.03 122 136 117.97 136 113V104Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--status-success)]"
              />
              <path
                d="M158 107H161.5C163.98 107 166 109.02 166 111.5C166 113.98 163.98 116 161.5 116H158"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="text-[var(--status-success)]"
              />
              <path
                d="M143 97C143 94.5 145 93.5 145 91C145 88.5 143 87.5 143 85"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="text-[var(--status-success)] opacity-65"
              />
              <path
                d="M151 98C151 95.5 153 94.5 153 92C153 89.5 151 88.5 151 86"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="text-[var(--status-success)] opacity-65"
              />
              <circle cx="56" cy="76" r="2" fill="currentColor" className="text-[var(--status-success)] opacity-45" />
              <circle cx="184" cy="70" r="2" fill="currentColor" className="text-[var(--brand)] opacity-45" />
              <circle cx="116" cy="34" r="1.5" fill="currentColor" className="text-[var(--status-warning)] opacity-55" />
            </svg>
          </div>

          {/* Serene Headline & Single-Line Whisper Status */}
          <h2 className="text-[26px] font-bold tracking-tight mt-2">
            {t('vacationEnjoyHeadline')}
          </h2>

          <p className={`text-[13px] ${subText} mt-2.5 flex items-center justify-center gap-2 flex-wrap`}>
            <span className="inline-flex items-center gap-1.5 text-[var(--status-success)] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)]" />
              <span>{t('vacationRemainingDays', { n: vacRemaining })}</span>
            </span>
            <span className="opacity-40">·</span>
            <span>
              {vacationTimelineInfo.startLabel} – {vacationTimelineInfo.endLabel}
            </span>
            <span className="opacity-40">·</span>
            <span>{t('streakDays', { n: dashboard.streak.current })}</span>
          </p>

          {/* Minimal Action Buttons */}
          <div className="flex items-center justify-center gap-2.5 mt-7">
            <button
              type="button"
              onClick={() => appActions.openVacationModal('status')}
              className="btn-secondary !h-9 !px-4 !text-[12px] font-medium"
            >
              {t('vacationModalTitle')}
            </button>

            <button
              type="button"
              onClick={() => setPeekNormalDashboard(true)}
              className="btn-ghost !h-9 !px-3 !text-[12px] text-[#8E8E93] hover:text-current"
            >
              {t('navDashboard')}
            </button>
          </div>
        </article>
      ) : (
        <>
          {/* Optional Return Bar when user temporarily peeks at the normal dashboard during Vacation */}
          {isVacationActive && peekNormalDashboard && (
            <div
              className={`rounded-2xl border px-4 py-2.5 flex items-center justify-between gap-3 ${cardSurface} border-[var(--status-success)]/30 bg-[var(--status-success-soft)]/40`}
            >
              <div className="flex items-center gap-2 text-[12px]">
                <span className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse" />
                <span className="font-semibold text-[var(--status-success)]">
                  {t('vacationActiveBadge')} · {t('vacationRemainingDays', { n: vacRemaining })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => appActions.openVacationModal('status')}
                  className="text-[11px] font-medium text-[#8E8E93] hover:text-current cursor-pointer px-2 py-1"
                >
                  {t('vacationModalTitle')}
                </button>
                <button
                  type="button"
                  onClick={() => setPeekNormalDashboard(false)}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-[var(--status-success)] text-white cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {t('vacationBtn')}
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Today's Study Progress Board / Active Vacation Protection Hero */}
          <section
            className={`relative rounded-2xl border p-5 sm:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col lg:flex-row lg:items-center justify-between gap-5 lg:gap-8 transition-all duration-500 ${cardSurface} ${
              isSyncPending
                ? 'border-[var(--brand-border)] shadow-md ring-1 ring-[var(--brand)]/20'
                : isVacationActive
                ? 'border-[var(--status-success)]/25 ring-1 ring-[var(--status-success)]/15'
                : syncJustFinished
                ? 'animate-sync-border-flash ring-1 ring-[var(--status-success)]/30'
                : ''
            }`}
          >
            {/* 背景火焰：裁切只作用在这一层，卡片本身不裁，否则连胜说明浮层会被切掉 */}
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
              aria-hidden="true"
            >
              <StreakFlameBackdrop isDark={isDark} />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-7 flex-1 min-w-0">
              {/* Left Ring */}
              <div
                className="relative w-[112px] h-[112px] shrink-0 flex items-center justify-center"
                role="progressbar"
                aria-valuenow={isVacationActive ? vacRemaining : completed}
                aria-valuemin={0}
                aria-valuemax={isVacationActive ? vacDays : totalWorkload}
                aria-label={isVacationActive ? t('vacationModalTitle') : t('todayProgressTitle')}
              >
                <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    stroke={isDark ? '#2A2C36' : '#ECECF2'}
                    strokeWidth="9"
                    fill="none"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    stroke={
                      isSyncPending
                        ? 'var(--status-warning)'
                        : isVacationActive
                        ? 'var(--status-success)'
                        : brandHex
                    }
                    strokeWidth="9"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={
                      isSyncPending
                        ? circumference * 0.75
                        : isVacationActive
                        ? vacDashoffset
                        : strokeDashoffset
                    }
                    style={{
                      transition: 'stroke-dashoffset 0.85s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease',
                    }}
                    className={isSyncPending ? 'animate-spin origin-center' : ''}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isSyncPending ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--status-warning)]/20 border-t-[var(--status-warning)] animate-spin" />
                      <span className="text-[10px] text-[var(--status-warning)] font-semibold mt-1">
                        {t('syncing')}
                      </span>
                    </>
                  ) : isVacationActive ? (
                    <>
                      <span className="text-[25px] font-bold leading-none text-[var(--status-success)]">
                        {vacRemaining}
                        <span className="text-[12px] font-semibold ms-0.5">
                          {t('daysUnit')}
                        </span>
                      </span>
                      <span className={`text-[10px] ${subText} mt-1 font-mono`}>
                        / {vacDays} {t('daysUnit')}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={`text-[26px] font-bold leading-none ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                        {completed}
                      </span>
                      <span className={`text-[11px] ${subText} mt-1`}>
                        / {totalWorkload} {t('cardsUnit')}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Central Overview */}
              {isVacationActive && !isSyncPending ? (
                <div className="space-y-3 flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--status-success-soft)] text-[var(--status-success)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] animate-pulse" />
                      <span>{t('vacationActiveBadge')}</span>
                    </span>
                    {dashboard.vacation?.reason && (
                      <span className={`text-[12px] font-medium ${subText}`}>
                        · {dashboard.vacation.reason}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="text-[22px] font-bold tracking-tight whitespace-nowrap">
                        {vacationTimelineInfo.startLabel} – {vacationTimelineInfo.endLabel}
                      </span>
                    </div>
                    <p className={`text-[12px] ${subText} font-medium`}>
                      {t('vacationSafeguardsSummary')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                    <button
                      type="button"
                      onClick={() => appActions.openVacationModal('status')}
                      style={{ backgroundColor: brandHex }}
                      className="btn-primary !h-9 !px-4 !text-[12px] flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>{t('endVacationBtn')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAppState({ activeTab: 'library' })}
                      className="btn-secondary !h-9 !px-3.5 !text-[12px] whitespace-nowrap"
                    >
                      {t('navLibrary')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 flex-1 min-w-[200px]">
                  <div>
                    <span className={`text-[12px] font-medium whitespace-nowrap ${subText}`}>
                      {t('todayProgressTitle')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {isSyncPending ? (
                      <div className="h-8 w-56 rounded-lg animate-skeleton-shimmer" />
                    ) : totalPending > 0 ? (
                      <div className={`flex items-baseline gap-2.5 flex-wrap ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                        <span className="text-[24px] sm:text-[26px] font-bold tracking-tight whitespace-nowrap">
                          {t('remainingCards', { n: totalPending })}
                        </span>
                        <span className={`text-[13px] whitespace-nowrap ${subText}`}>
                          {t('estimatedMinutes', { n: dashboard.todayStats.estimatedMinutes })}
                        </span>
                      </div>
                    ) : completed > 0 ? (
                      <div className={`flex items-baseline gap-2.5 flex-wrap ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                        <span className="text-[18px] sm:text-[20px] font-bold tracking-tight text-[var(--status-success)] flex items-center gap-2 whitespace-nowrap">
                          <svg className="w-5 h-5 text-[var(--status-success)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="16 10 11 15 8 12" />
                          </svg>
                          <span>{t('allClearedTitle')}</span>
                        </span>
                        <span className={`text-[13px] whitespace-nowrap ${subText}`}>
                          {t('allClearedSub', { n: completed })}
                        </span>
                      </div>
                    ) : (
                      <div className={`flex items-baseline gap-2.5 flex-wrap ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                        <span className="text-[18px] sm:text-[20px] font-bold tracking-tight whitespace-nowrap">
                          {t('noDueTodayTitle')}
                        </span>
                        <span className={`text-[13px] whitespace-nowrap ${subText}`}>{t('noDueTodaySub')}</span>
                      </div>
                    )}
                    {isSyncPending ? (
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-20 rounded-full animate-skeleton-shimmer" />
                        <div className="h-7 w-16 rounded-full animate-skeleton-shimmer" />
                        <div className="h-7 w-20 rounded-full animate-skeleton-shimmer" />
                      </div>
                    ) : (
                      <div className={`flex items-center gap-2 flex-wrap ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setAppState({ activeTab: 'library' });
                            appActions.searchLibraryDebounced({
                              status: 'due',
                              query: '',
                              difficulty: 'all',
                              tag: 'all',
                              deckId: 'all',
                            });
                          }}
                          title={t('dueReviewPill', { n: dashboard.todayStats.dueReview })}
                          className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 whitespace-nowrap bg-[var(--brand-soft)] text-[var(--brand-text)] hover:opacity-85 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer min-h-[30px] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[var(--brand)]" aria-hidden="true" />
                          <span>{t('dueReviewPill', { n: dashboard.todayStats.dueReview })}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAppState({ activeTab: 'library' });
                            appActions.searchLibraryDebounced({
                              status: 'new',
                              query: '',
                              difficulty: 'all',
                              tag: 'all',
                              deckId: 'all',
                            });
                          }}
                          title={t('dueNewPill', { n: dashboard.todayStats.dueNew })}
                          className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 whitespace-nowrap bg-[var(--status-warning-soft)] text-[var(--status-warning)] hover:opacity-85 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer min-h-[30px] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[var(--status-warning)]" aria-hidden="true" />
                          <span>{t('dueNewPill', { n: dashboard.todayStats.dueNew })}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAppState({ activeTab: 'library' });
                            appActions.searchLibraryDebounced({
                              status: 'completed',
                              query: '',
                              difficulty: 'all',
                              tag: 'all',
                              deckId: 'all',
                            });
                          }}
                          title={t('completedPill', { n: completed })}
                          className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 whitespace-nowrap bg-[var(--status-success-soft)] text-[var(--status-success)] hover:opacity-85 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer min-h-[30px] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[var(--status-success)]" aria-hidden="true" />
                          <span>{t('completedPill', { n: completed })}</span>
                        </button>

                        {dashboard.todayStats.dueReview >= 60 && (
                          <button
                            type="button"
                            onClick={() => appActions.openIcuModal('rescue')}
                            className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 whitespace-nowrap bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)] hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 17l6-6 4 4 8-8" />
                              <path d="M17 7h4v4" />
                            </svg>
                            <span>{t('backlogRescueBtn')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Primary Action Button & Breakdown Pills */}
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap pt-0.5">
                    {isSyncPending ? (
                      <button
                        type="button"
                        disabled
                        className={`h-10 px-5 rounded-xl border font-medium text-[13px] flex items-center gap-2 cursor-wait whitespace-nowrap ${
                          isDark ? 'bg-white/5 border-white/10 text-[#8E8E93]' : 'bg-black/5 border-black/10 text-[#8E8E93]'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--status-warning)]/30 border-t-[var(--status-warning)] animate-spin" />
                        <span>{t('syncing')}</span>
                      </button>
                    ) : totalPending > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => appActions.startReview(decks[0]?.id)}
                          style={{ backgroundColor: brandHex }}
                          className={`btn-primary !h-10 !px-6 whitespace-nowrap ${
                            syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''
                          }`}
                        >
                          <span className="text-xs">▶</span>
                          <span>{t('startTodayStudy')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => appActions.startLowEnergySession(decks[0]?.id)}
                          className="btn-secondary !h-10 !px-3.5 text-[#8E8E93] hover:text-current flex items-center gap-1.5 whitespace-nowrap"
                          title={t('lowEnergySub')}
                        >
                          <svg
                            className="w-3.5 h-3.5 text-[var(--brand-text)] shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                          </svg>
                          <span>{t('lowEnergyBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => appActions.openCustomStudyModal('mistakes')}
                          className="btn-secondary !h-10 !px-3.5 text-[#8E8E93] hover:text-current flex items-center gap-1.5 whitespace-nowrap"
                          title={t('customStudyModalTitle')}
                        >
                          <svg
                            className="w-3.5 h-3.5 text-[var(--brand-text)] shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="4" />
                          </svg>
                          <span>{t('customStudyEntryBtn')}</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => appActions.openCustomStudyModal('mistakes')}
                          style={{ backgroundColor: brandHex }}
                          className={`btn-primary !h-10 !px-5 flex items-center gap-1.5 whitespace-nowrap ${
                            syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="4" />
                          </svg>
                          <span>{t('customStudyEntryBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAppState({ activeTab: 'library' })}
                          className={`btn-secondary !h-10 !px-5 whitespace-nowrap ${
                            syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''
                          }`}
                        >
                          {t('browseAllLibraryBtn')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Clean, un-crammed Streak Details Card (stacks cleanly below on < lg windows) */}
            <div
              className={`relative shrink-0 pt-4 lg:pt-0 lg:ps-8 border-t lg:border-t-0 lg:border-s ${
                isDark ? 'border-[#2A2C36]' : 'border-[#F0F0F5]'
              } flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center text-start lg:text-end min-w-[140px] ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}
            >
              <div className="relative z-10 flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center w-full gap-3 lg:gap-0">
                <div className="flex items-center lg:justify-end gap-1.5 whitespace-nowrap">
                  <span className={`text-[12px] ${subText}`}>{t('streakTitle')}</span>
                  <span className="relative inline-flex group/streak">
                    <button
                      type="button"
                      aria-label={t('streakRulesTooltipTitle')}
                      className={`h-3.5 w-3.5 flex items-center justify-center rounded-full transition-colors cursor-help ${
                        isDark ? 'text-[#63636B] hover:text-[#A1A1AA]' : 'text-[#B4B4BA] hover:text-[#6E6E73]'
                      }`}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        aria-hidden="true"
                      >
                        <circle cx="8" cy="8" r="6.5" />
                        <path d="M8 7.3v4" strokeLinecap="round" />
                        <circle cx="8" cy="4.9" r="0.85" fill="currentColor" stroke="none" />
                      </svg>
                    </button>
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute end-0 top-full z-50 mt-2 w-[248px] rounded-xl border px-3 py-2.5 text-start whitespace-normal text-[11px] leading-[1.6] shadow-lg opacity-0 translate-y-1 transition-[opacity,transform] duration-150 group-hover/streak:opacity-100 group-hover/streak:translate-y-0 group-focus-within/streak:opacity-100 group-focus-within/streak:translate-y-0 ${
                        isDark
                          ? 'bg-[#202127] border-white/10 text-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.55)]'
                          : 'bg-white border-[#E7E7EC] text-[#3A3A3C] shadow-[0_10px_30px_rgba(0,0,0,0.12)]'
                      }`}
                    >
                      <span className="block font-semibold mb-1">
                        {t('streakRulesTooltipTitle')}
                      </span>
                      {t('streakRulesTooltipBody')}
                    </span>
                  </span>
                  {isVacationActive && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      ❄️
                    </span>
                  )}
                </div>
                <div className="flex items-baseline lg:flex-col lg:items-end gap-2 lg:gap-0">
                  {isSyncPending ? (
                    <div className="h-8 w-20 rounded-lg animate-skeleton-shimmer lg:mt-1 self-end" />
                  ) : (
                    <div className="lg:mt-1 flex items-baseline justify-end gap-1.5 whitespace-nowrap">
                      {/* 火苗图标已去掉，改用火焰色数字承载「连胜」语义（#FF8A00 与背景火焰同色系） */}
                      <span className="text-[26px] sm:text-[28px] font-bold leading-none text-[#FF8A00]">
                        {dashboard.streak.current}
                      </span>
                      <span className={`text-[13px] ${subText}`}>{t('daysUnit')}</span>
                    </div>
                  )}
                  <div className={`text-[11px] whitespace-nowrap ${subText} lg:mt-1.5`}>
                    {t('streakSub', {
                      longest: dashboard.streak.longest,
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Deck Cards Grid */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h2 className="text-[15px] font-bold whitespace-nowrap">{t('myDecksTitle')}</h2>
                <span className={`text-[12px] whitespace-nowrap ${subText}`}>
                  {/* 没有子牌组时 top 与 total 相等，再写「N 个主牌组 · 共 N 个牌组」就是同义反复 */}
                  {topLevelDecks.length === decks.length
                    ? t('decksTotalOnly', { n: decks.length })
                    : t('decksSummarySub', { top: topLevelDecks.length, total: decks.length })}
                </span>
                {isVacationActive && (
                  <span className="text-[12px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--status-success-soft)] text-[var(--status-success)]">
                    {t('vacationEnjoyHeadline')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 ms-auto">
                {decks.length > topLevelDecks.length && (
                  <button
                    onClick={() =>
                      setAppState((prev) => ({ showAllDashboardDecks: !prev.showAllDashboardDecks }))
                    }
                    className="btn-ghost !text-[var(--brand-text)] whitespace-nowrap"
                  >
                    {showAllDashboardDecks
                      ? t('showTopDecksOnly')
                      : t('expandAllDecks', { n: decks.length })}
                  </button>
                )}
                <button
                  onClick={() => appActions.setActiveTab('decks')}
                  className="btn-ghost flex items-center gap-1 whitespace-nowrap"
                >
                  <span>{t('allDecksManage')}</span>
                </button>
              </div>
            </div>

            {isSyncPending ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-5 h-[120px] flex flex-col justify-between ${cardSurface}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl animate-skeleton-shimmer" />
                      <div className="space-y-2 flex-1">
                        <div className="w-24 h-4 rounded animate-skeleton-shimmer" />
                        <div className="w-16 h-3 rounded animate-skeleton-shimmer" />
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full animate-skeleton-shimmer mt-4" />
                  </div>
                ))}
              </div>
            ) : displayedDecks.length === 0 ? (
              <div className={`rounded-2xl border p-10 text-center space-y-3 ${cardSurface}`}>
                <div className="text-[15px] font-semibold">{t('noDecksTitle')}</div>
                <p className={`text-[12px] ${subText}`}>{t('noDecksSub')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedDecks.map((deck) => {
                  const iconNode = deckIconMap[deck.accent] || deckIconMap.indigo;
                  const breakdown = deck.masteryBreakdown ?? {
                    mature: deck.mastery / 100,
                    review: 0,
                    learning: 0,
                    new: 0,
                  };
                  const stageLabels = t('masteryStageLabels').split('|');
                  const masteryStages = [
                    { label: stageLabels[0] || '', value: breakdown.mature, color: brandHex },
                    { label: stageLabels[1] || '', value: breakdown.review, color: '#85B7EB' },
                    { label: stageLabels[2] || '', value: breakdown.learning + breakdown.new, color: '#B5D4F4' },
                  ];
                  return (
                    <div
                      key={deck.id}
                      onClick={() => appActions.startReview(deck.id)}
                      className={`group relative flex min-h-[120px] cursor-pointer flex-col rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:-translate-y-0.5 hover:border-[var(--brand-border)] hover:shadow-md ${cardSurface} ${masteryHintId === deck.id ? 'z-30' : ''} ${
                        syncJustFinished ? 'animate-sync-reveal delay-stagger-2' : ''
                      }`}
                    >
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] transition-colors">
                            {iconNode}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-semibold">{deck.name}</div>
                            <div className={`mt-0.5 truncate text-[11px] ${subText}`}>
                              {deck.totalCards.toLocaleString()} {t('cardsUnit')}
                              {deck.childrenCount > 0
                                ? t('subDecksCount', { n: deck.childrenCount })
                                : ''}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className={`text-[11px] ${subText}`}>{t('masteryLabel')}</span>
                              <span className={`text-[13px] font-semibold ${isDark ? 'text-[#D8D8E0]' : 'text-[#1D1D1F]'}`}>
                                {deck.mastery}%
                              </span>
                              <button
                                type="button"
                                title={t('masteryHintTrigger')}
                                aria-label={t('masteryHintTrigger')}
                                aria-expanded={masteryHintId === deck.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMasteryHintId(masteryHintId === deck.id ? null : deck.id);
                                }}
                                className={`flex h-[14px] w-[14px] items-center justify-center rounded-full border text-[10px] leading-none transition-colors cursor-pointer ${
                                  isDark
                                    ? 'border-[#343644] text-[#9A9AA5] hover:text-[var(--brand-text)]'
                                    : 'border-[#E0E0E6] text-[#8A8A8E] hover:text-[var(--brand-text)]'
                                }`}
                              >?</button>
                            </div>
                            <div
                              className={`mt-1.5 ml-auto flex h-1 w-16 overflow-hidden rounded-full ${isDark ? 'bg-[#2A2C36]' : 'bg-[#ECECF2]'}`}
                              role="group"
                              aria-label={`${deck.name} ${t('masteryLabel')} ${deck.mastery}%`}
                            >
                              <span className="h-full transition-all duration-500" style={{ width: `${breakdown.mature * 100}%`, backgroundColor: brandHex }} />
                              <span className="h-full transition-all duration-500" style={{ width: `${breakdown.review * 100}%`, backgroundColor: '#85B7EB' }} />
                              <span className="h-full transition-all duration-500" style={{ width: `${breakdown.learning * 100}%`, backgroundColor: '#B5D4F4' }} />
                              <span className="h-full transition-all duration-500" style={{ width: `${breakdown.new * 100}%`, backgroundColor: isDark ? '#3A3D48' : '#D6D6DE' }} />
                            </div>
                          </div>
                        </div>

                        <div className={`relative mt-auto h-7 border-t pt-2 ${isDark ? 'border-[#2A2C36]' : 'border-[#ECECF2]'}`}>
                          <div className="flex items-center gap-2 truncate text-[11px] transition-opacity duration-150 group-hover:opacity-0">
                            <span className="font-semibold" style={{ color: brandHex }}>
                              {t('dueReviewPill', { n: deck.dueReview })}
                            </span>
                            <span className={`truncate ${subText}`}>
                              {deck.dueNew > 0 ? t('dueNewPill', { n: deck.dueNew }) : t('noNewCards')}
                            </span>
                          </div>

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-1 items-center justify-end gap-1 opacity-0 transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                            <button
                              type="button"
                              title={t('viewInLibraryBtn')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAppState({ activeTab: 'library' });
                                appActions.searchLibraryDebounced({ deckId: deck.id });
                              }}
                              className={`flex h-6 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                isDark
                                  ? 'border-[#343644] text-[#D8D8E0] hover:border-[var(--brand-border)] hover:text-[var(--brand-text)]'
                                  : 'border-[#E0E0E6] text-[#3A3A3C] hover:border-[var(--brand-border)] hover:text-[var(--brand-text)]'
                              }`}
                            >
                              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="16" rx="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                              </svg>
                              <span>{t('viewDeckBtn')}</span>
                            </button>
                            <button
                              type="button"
                              title={t('studyDeckBtn')}
                              onClick={(e) => {
                                e.stopPropagation();
                                appActions.startReview(deck.id);
                              }}
                              style={{ backgroundColor: brandHex }}
                              className="flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-95 cursor-pointer"
                            >
                              <svg className="h-3 w-3 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                                <polygon points="6 4 20 12 6 20 6 4" />
                              </svg>
                              <span>{t('studyDeckBtn')}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {masteryHintId === deck.id && (
                        <div
                          className={`absolute right-3 top-12 z-40 w-56 rounded-xl border p-3 text-left shadow-lg ${cardSurface}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-[12px] font-semibold">{t('masteryHintTitle', { n: deck.mastery })}</div>
                          <p className={`mt-1 text-[11px] leading-relaxed ${subText}`}>{t('masteryHintBody')}</p>
                          <div className="mt-2.5 space-y-1.5">
                            {masteryStages.map((stage, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: stage.color }} />
                                <span className={`flex-1 truncate text-[11px] ${subText}`}>{stage.label}</span>
                                <span className="text-[11px] font-medium">{Math.round(stage.value * 100)}%</span>
                              </div>
                            ))}
                          </div>
                          <div className={`mt-2.5 border-t pt-2 text-[10px] leading-relaxed ${subText} ${isDark ? 'border-[#343644]' : 'border-[#ECECF2]'}`}>
                            {t('masteryHintFootnote')}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Bottom Analytics Row: Activity Heatmap & Weekly Rhythm */}
          <section className="grid grid-cols-12 gap-4 pb-4">
            {/* Left: Heatmap */}
            <div
              className={`col-span-12 xl:col-span-7 rounded-2xl border p-5 flex flex-col justify-between relative ${cardSurface} ${
                syncJustFinished ? 'animate-sync-reveal delay-stagger-3' : ''
              }`}
            >
              {isSyncPending ? (
                <div className="flex flex-col justify-between h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-[14px] font-bold">{t('heatmapTitle')}</h3>
                      <div className="w-36 h-3 rounded animate-skeleton-shimmer mt-1.5" />
                    </div>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 3, 4].map((lv) => (
                        <span key={lv} className="w-2.5 h-2.5 rounded-[3px] animate-skeleton-shimmer" />
                      ))}
                    </div>
                  </div>
                  <div className="my-2">
                    <div className="grid grid-cols-26 gap-1.5">
                      {Array.from({ length: 26 }).map((_, colIdx) => (
                        <div key={colIdx} className="flex flex-col gap-1.5">
                          {Array.from({ length: 7 }).map((__, rowIdx) => (
                            <div
                              key={rowIdx}
                              className="w-2.5 h-2.5 rounded-[3px] animate-skeleton-shimmer opacity-40"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    className={`pt-3.5 border-t ${
                      isDark ? 'border-[#2A2C36]' : 'border-[#F2F2F7]'
                    } flex items-center gap-8`}
                  >
                    <div className="w-20 h-7 rounded animate-skeleton-shimmer" />
                    <div className="w-20 h-7 rounded animate-skeleton-shimmer" />
                    <div className="w-20 h-7 rounded animate-skeleton-shimmer" />
                    <div className="w-16 h-6 rounded-lg animate-skeleton-shimmer ms-auto" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-[14px] font-bold">{t('heatmapTitle')}</h3>
                      <p className={`text-[11px] ${subText} mt-0.5`}>
                        {t('heatmapSub', { n: dashboard.heatmap.totalYearReviews.toLocaleString() })}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] shrink-0 ${subText}`}>
                      <span>{t('less')}</span>
                      {[0, 1, 2, 3, 4].map((lv) => (
                        <span
                          key={lv}
                          style={heatmapLevelStyle(lv)}
                          className="w-2.5 h-2.5 rounded-[3px] transition-colors duration-200"
                        />
                      ))}
                      <span>{t('more')}</span>
                    </div>
                  </div>

                  <div
                    className="my-4 relative"
                    onMouseLeave={() => setHoveredHeatmapCell(null)}
                  >
                    {hoveredHeatmapCell && (
                      <div
                        style={{
                          left: `${Math.min(82, Math.max(8, (hoveredHeatmapCell.colIdx / 25) * 100))}%`,
                        }}
                        className={`absolute -top-13 -translate-x-1/2 z-50 pointer-events-none px-3 py-1.5 rounded-xl border shadow-xl backdrop-blur-md whitespace-nowrap transition-all duration-75 ${
                          isDark
                            ? 'bg-[#1E1F28]/95 border-[#3A3C4C] text-white'
                            : 'bg-[#1D1D1F]/95 border-[#3A3A44] text-white'
                        }`}
                      >
                        <div className="text-[10px] text-[#AEAEB8]">
                          {formatFullDateWithWeekday(hoveredHeatmapCell.date, resolvedLang)}
                        </div>
                        <div className="text-[11px] font-semibold mt-0.5 flex items-center gap-1.5">
                          {hoveredHeatmapCell.isFrozen ? (
                            <span className="text-cyan-400 font-semibold flex items-center gap-1">
                              <span>❄️</span>
                              <span>{t('freezeStreakLabel')}</span>
                            </span>
                          ) : (
                            <>
                              <span style={{ color: accentScale.heatmap[1] }}>
                                {hoveredHeatmapCell.count} {t('cardsUnit')}
                              </span>
                              <span>·</span>
                              <span className="text-[var(--status-success)]">
                                {hoveredHeatmapCell.accuracy}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-26 gap-1.5">
                      {Array.from({ length: 26 }).map((_, colIdx) => (
                        <div key={colIdx} className="flex flex-col gap-1.5">
                          {Array.from({ length: 7 }).map((__, rowIdx) => {
                            const cell = recent182Cells[colIdx * 7 + rowIdx] || {
                              date: '',
                              count: 0,
                              accuracy: 0,
                              level: 0,
                            };
                            const isFrozen = Boolean(cell.isStreakFrozen);
                            const isHovered =
                              hoveredHeatmapCell?.colIdx === colIdx &&
                              hoveredHeatmapCell?.rowIdx === rowIdx;
                            return (
                              <div
                                key={rowIdx}
                                onMouseEnter={() =>
                                  setHoveredHeatmapCell({
                                    date: cell.date,
                                    count: cell.count,
                                    accuracy: cell.accuracy ?? (cell.count > 0 ? dashboard.heatmap.retentionRate : 0),
                                    isFrozen,
                                    colIdx,
                                    rowIdx,
                                  })
                                }
                                style={isFrozen ? undefined : heatmapLevelStyle(cell.level)}
                                className={`w-2.5 h-2.5 rounded-[3px] transition-all duration-200 ${
                                  isHovered ? 'scale-125 ring-2 ring-[var(--brand)]' : ''
                                } ${
                                  isFrozen
                                    ? 'bg-cyan-400/40 ring-1 ring-cyan-400'
                                    : ''
                                }`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    <div className={`mt-2.5 flex items-center justify-between text-[10px] ${subText} px-0.5`}>
                      {dynamicMonthLabels.map((m, idx) => (
                        <span
                          key={`${m}-${idx}`}
                          className={
                            idx === dynamicMonthLabels.length - 1 ? 'font-semibold text-[var(--brand-text)]' : ''
                          }
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`pt-3.5 border-t ${
                      isDark ? 'border-[#2A2C36]' : 'border-[#F2F2F7]'
                    } flex items-center gap-6 sm:gap-8 flex-wrap`}
                  >
                    <div>
                      <div className="text-[15px] font-bold whitespace-nowrap">
                        {dashboard.heatmap.weekTotalCards} {t('cardsUnit')}
                      </div>
                      <div className={`text-[11px] whitespace-nowrap ${subText}`}>{t('weekStudied')}</div>
                    </div>
                    <div>
                      <div className="text-[15px] font-bold whitespace-nowrap">
                        {dashboard.heatmap.dailyAverage} {t('cardsUnit')}
                      </div>
                      <div className={`text-[11px] whitespace-nowrap ${subText}`}>{t('dailyAvg')}</div>
                    </div>
                    <div>
                      <div className="text-[15px] font-bold whitespace-nowrap">{dashboard.heatmap.retentionRate}%</div>
                      <div className={`text-[11px] whitespace-nowrap ${subText}`}>{t('retentionRate')}</div>
                    </div>
                    <div className="ms-auto">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap bg-[var(--brand-soft)] text-[var(--brand-text)]">
                        {dashboard.heatmap.wowChange}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: Weekly Rhythm Bar Chart */}
            <div
              className={`col-span-12 xl:col-span-5 rounded-2xl border p-5 flex flex-col justify-between relative ${cardSurface} ${
                syncJustFinished ? 'animate-sync-reveal delay-stagger-3' : ''
              }`}
            >
              {isSyncPending ? (
                <div className="flex flex-col justify-between h-full gap-4">
                  <div>
                    <h3 className="text-[14px] font-bold">{t('weeklyRhythmTitle')}</h3>
                    <div className="w-28 h-3 rounded animate-skeleton-shimmer mt-1.5" />
                  </div>
                  <div className="my-2 h-[145px] flex items-end justify-between gap-3 pt-6 px-2">
                    {[65, 25, 45, 18, 35, 15, 28].map((h, idx) => (
                      <div
                        key={idx}
                        style={{ height: `${h}%` }}
                        className="flex-1 max-w-[34px] rounded-lg animate-skeleton-shimmer opacity-50"
                      />
                    ))}
                  </div>
                  <div
                    className={`pt-3.5 border-t ${
                      isDark ? 'border-[#2A2C36]' : 'border-[#F2F2F7]'
                    }`}
                  >
                    <div className="w-48 h-3 rounded animate-skeleton-shimmer" />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-[14px] font-bold">{t('weeklyRhythmTitle')}</h3>
                    <p className={`text-[11px] ${subText} mt-0.5`}>{t('weeklyRhythmSub')}</p>
                  </div>

                  <div
                    className="my-4 h-[145px] flex items-end justify-between gap-3 pt-6 px-2 relative"
                    onMouseLeave={() => setHoveredRhythmIdx(null)}
                  >
                    {dashboard.weeklyRhythm.days.map((day, idx) => {
                      const heightPct =
                        day.count > 0 ? Math.max(18, Math.round((day.count / maxWeeklyCount) * 100)) : 8;
                      const isHovered = hoveredRhythmIdx === idx;
                      const mins =
                        day.minutes !== undefined
                          ? day.minutes
                          : day.count > 0
                          ? Math.max(1, Math.round((day.count * (dashboard.weeklyRhythm.avgSecondsPerCard || 6)) / 60))
                          : 0;
                      const tooltipText = `${day.label} · ${day.count} ${t('cardsUnit')} (${mins}m)`;

                      return (
                        <div
                          key={day.label}
                          onMouseEnter={() => setHoveredRhythmIdx(idx)}
                          className="flex-1 flex flex-col items-center gap-2 h-full justify-end relative cursor-pointer"
                        >
                          {isHovered && (
                            <div
                              className={`absolute -top-7 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-2.5 py-1 rounded-lg border shadow-lg text-[11px] font-semibold whitespace-nowrap ${
                                isDark
                                  ? 'bg-[#1E1F28]/95 border-[#3A3C4C] text-white'
                                  : 'bg-[#1D1D1F]/95 border-[#3A3A44] text-white'
                              }`}
                            >
                              {tooltipText}
                            </div>
                          )}

                          <div
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor:
                                day.isToday || isHovered
                                  ? brandHex
                                  : accentScale.brandMutedBar,
                            }}
                            className={`w-full max-w-[34px] rounded-lg transition-all duration-300 ${
                              isHovered ? 'scale-x-105 shadow-md' : ''
                            }`}
                          />
                          <span
                            className={`text-[11px] ${
                              day.isToday || isHovered ? 'font-bold text-[var(--brand-text)]' : subText
                            }`}
                          >
                            {day.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className={`pt-3.5 border-t ${
                      isDark ? 'border-[#2A2C36]' : 'border-[#F2F2F7]'
                    } text-[11px] ${subText}`}
                  >
                    {t('weeklyRhythmFooter', {
                      sec: dashboard.weeklyRhythm.avgSecondsPerCard,
                      min: dashboard.weeklyRhythm.longestSessionMinutes,
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
