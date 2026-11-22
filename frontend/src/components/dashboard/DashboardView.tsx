import React, { useMemo, useState } from 'react';
import { DashboardTipLine } from './DashboardTipLine';
import { HoverCard } from '../common/HoverCard';
import { ZenModeIcon } from '../common/Icons';
import {
  ChartTooltipContent,
  ChartTooltipPortal,
  Tooltip,
} from '../common/Tooltip';
import { useCountUp } from '../../hooks/useCountUp';
import {
  formatFullDateWithWeekday,
  formatMonthDayWithWeekday,
  formatStudyMinutes,
  translate,
} from '../../i18n/translations';
import { appActions, setAppState, useAppStore } from '../../stores/useAppStore';
import { buildDeckScales } from '../../utils/deckPalette';
import { getAccentScale, resolveThemeMode } from '../../utils/themeTokens';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';
import {
  EmptyStateIllustration,
  GreetingVignette,
  hasIllustrationPack,
  ThemedDeckEmblem,
} from '../common/ThemeIllustrations';
import { StreakFlameBackdrop } from './StreakFlameBackdrop';
import { SyncStatusPill } from './SyncStatusPill';

export const HERO_RING_RADIUS = 48;
export const HERO_RING_CIRCUMFERENCE = 2 * Math.PI * HERO_RING_RADIUS;

export interface HeroProgressRingMetrics {
  completed: number;
  totalWorkload: number;
  pct: number;
  progressPct: number;
  strokeDashoffset: number;
}

/**
 * Computes normalized completion ratio, rounded 0-100 percentage, and SVG stroke
 * offset for the Dashboard hero progress ring across empty, partial, and 100% states.
 */
export function computeHeroProgressRing(
  completedRaw: number,
  totalWorkloadRaw: number,
  circumference = HERO_RING_CIRCUMFERENCE
): HeroProgressRingMetrics {
  const completed = Number.isFinite(completedRaw) ? Math.max(0, completedRaw) : 0;
  const totalWorkload = Number.isFinite(totalWorkloadRaw) ? Math.max(0, totalWorkloadRaw) : 0;
  const pct =
    totalWorkload > 0
      ? Math.min(1, Math.max(0, completed / totalWorkload))
      : completed > 0
      ? 1
      : 0;
  const progressPct = Math.round(pct * 100);
  const strokeDashoffset = circumference * (1 - pct);
  return {
    completed,
    totalWorkload,
    pct,
    progressPct,
    strokeDashoffset,
  };
}

export const DashboardView: React.FC = () => {
  const {
    isInitialSyncing,
    syncJustFinished,
    dashboard,
    decks,
    showAllDashboardDecks,
    syncing,
    theme,
    systemDark,
    accentColor,
    resolvedLang,
    showShortcutHints,
    showIllustrations,
  } = useAppStore();

  const isSyncPending = isInitialSyncing || syncing;

  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  // Item #3: Interactive Floating Tooltips for Heatmap & Weekly Rhythm
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{
    date: string;
    count: number;
    accuracy: number;
    isFrozen?: boolean;
    colIdx: number;
    rowIdx: number;
  } | null>(null);
  const [heatmapAnchorEl, setHeatmapAnchorEl] = useState<HTMLElement | null>(null);

  const [hoveredRhythmIdx, setHoveredRhythmIdx] = useState<number | null>(null);
  const [rhythmAnchorEl, setRhythmAnchorEl] = useState<HTMLElement | null>(null);
  const [peekNormalDashboard, setPeekNormalDashboard] = useState<boolean>(false);

  const resolvedTheme = resolveThemeMode(theme, systemDark);
  const accentScale = getAccentScale(accentColor, resolvedTheme);
  const brandHex = accentScale.brand;
  const isDark = resolvedTheme === 'dark';

  // Dashboard surfaces are semantic so theme tokens stay in one place.
  const cardSurface = 'dashboard-surface';
  const subText = 'dashboard-subtext';

  const totalPending = dashboard.todayStats.totalPending;
  const rawTotalWorkload =
    dashboard.todayStats.totalTodayWorkload !== undefined
      ? dashboard.todayStats.totalTodayWorkload
      : dashboard.todayStats.completed + totalPending;

  const radius = HERO_RING_RADIUS;
  const circumference = HERO_RING_CIRCUMFERENCE;
  const {
    completed,
    totalWorkload,
    progressPct,
    strokeDashoffset,
  } = computeHeroProgressRing(dashboard.todayStats.completed, rawTotalWorkload, circumference);

  // Number count-up strictly for the two hero metrics: today's progress (%) & current streak days (G)
  const animatedProgressPct = useCountUp(progressPct, 400);
  const animatedStreakDays = useCountUp(dashboard.streak.current, 400);

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

  // 图标按后端下发的 `accent` 槽位取形状（book/code/heart/folder/sparkles/layers 六选一）。
  // 注意：`accent` 现在**只**决定图标形状，不再决定颜色 —— 卡片配色一律由主题色派生。
  const deckIconByAccent: Record<string, React.ReactNode> = {
    indigo: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    blue: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    emerald: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    amber: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    rose: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      </svg>
    ),
    purple: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  };

  // 牌组卡配色：以当前主题色为唯一色源，按列表次序叠一点色相偏移与浅底浓淡。
  // 第 1 张即主题色本身，第 6 张开始回绕（详见 utils/deckPalette.ts）
  const deckScales = useMemo(() => buildDeckScales(accentScale), [accentScale]);

  const maxWeeklyCount = Math.max(1, ...dashboard.weeklyRhythm.days.map((d) => d.count));
  const todayRhythmIdx = dashboard.weeklyRhythm.days.findIndex((d) => d.isToday);
  const todayRhythmDay = todayRhythmIdx >= 0 ? dashboard.weeklyRhythm.days[todayRhythmIdx] : null;
  const elapsedRhythmDays =
    todayRhythmIdx >= 0
      ? dashboard.weeklyRhythm.days.slice(0, todayRhythmIdx + 1)
      : dashboard.weeklyRhythm.days;
  const elapsedRhythmTotal = elapsedRhythmDays.reduce((sum, d) => sum + d.count, 0);
  const weeklyRhythmAvg =
    elapsedRhythmDays.length > 0 ? elapsedRhythmTotal / elapsedRhythmDays.length : 0;
  const weeklyAvgLinePct =
    weeklyRhythmAvg > 0 && maxWeeklyCount > 0
      ? Math.min(92, Math.max(10, (weeklyRhythmAvg / maxWeeklyCount) * 100))
      : 0;

  const formatSecondsUnit = (sec: number): string => {
    const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
    try {
      return new Intl.NumberFormat(resolvedLang, {
        style: 'unit',
        unit: 'second',
        unitDisplay: 'short',
        maximumFractionDigits: 1,
      }).format(safe);
    } catch {
      return `${safe}s`;
    }
  };

  const wowChangeStr = String(dashboard.heatmap.wowChange || '');
  const wowToneClass =
    wowChangeStr.includes('+') && !/\+0(?:\.0+)?%/.test(wowChangeStr)
      ? 'bg-[var(--status-success-soft)] text-[var(--status-success-text)]'
      : wowChangeStr.includes('-')
      ? 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
      : 'bg-[var(--brand-soft)] text-[var(--brand-text)]';
  const displayName = dashboard.userName
    ? /[\u4e00-\u9fff]/.test(dashboard.greeting)
      ? `，${dashboard.userName}`
      : `, ${dashboard.userName}`
    : '';
  const formattedDateDisplay = useMemo(
    () => dashboard.dateDisplay.replace(/(\d+)\s*月\s*(\d+)\s*日\s+/, '$1 月 $2 日 · '),
    [dashboard.dateDisplay]
  );
  const dueReviewParts = useMemo(
    () => t('dueReviewPill', { n: '__N__' }).split('__N__'),
    [resolvedLang]
  );
  const dueNewParts = useMemo(
    () => t('dueNewPill', { n: '__N__' }).split('__N__'),
    [resolvedLang]
  );

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

  const renderZenModeIconBtn = (extraClass = '') => (
    <Tooltip variant="compact" content={t('zenModeTooltip')} shortcut="Cmd Shift Z">
      <button
        type="button"
        aria-label={t('zenModeBtn')}
        data-zen-trigger="dashboard"
        onClick={() => appActions.enterZenMode()}
        className={`btn-secondary hero-icon-btn bg-[var(--bg-card)]/90 text-[var(--text-secondary)] hover:text-[var(--brand-text)] shadow-2xs ${extraClass}`}
      >
        <ZenModeIcon className="w-[19px] h-[19px] shrink-0" />
      </button>
    </Tooltip>
  );

  const renderCustomStudyIconBtn = (extraClass = '') => (
    <Tooltip variant="compact" content={t('customStudyEntryBtn')}>
      <button
        type="button"
        aria-label={t('customStudyEntryBtn')}
        onClick={() => appActions.openCustomStudyModal('mistakes')}
        className={`btn-secondary hero-icon-btn bg-[var(--bg-card)]/90 text-[var(--text-secondary)] hover:text-[var(--brand-text)] shadow-2xs ${extraClass}`}
      >
        <svg
          className="w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <circle cx="9" cy="6" r="2" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="15" cy="12" r="2" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="10" cy="18" r="2" />
        </svg>
      </button>
    </Tooltip>
  );

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="dashboard-shell px-6 sm:px-8 lg:px-10 py-6 sm:py-8 space-y-7 sm:space-y-8">
      {/* Top Header Row — Synced Status Capsule & Cmd+K Search */}
      <header
        onMouseDown={startWindowDrag}
        onDoubleClick={handleWindowDoubleClick}
        className="dashboard-header flex flex-wrap items-center justify-between gap-4 select-none cursor-default"
      >
        <div className="min-w-[180px] flex-1 flex items-center gap-2">
          <div className="shrink-0 max-w-full">
            <h1 className="text-[22px] sm:text-[24px] font-bold tracking-tight max-w-full text-balance leading-tight">
              {dashboard.greeting}
              {displayName}
            </h1>
            {isSyncPending ? (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--status-warning)] motion-safe:animate-ping shrink-0" />
                <span className="text-[12px] font-medium text-[var(--status-warning)] tracking-tight">
                  {syncing ? t('syncingAnkiWebAria') : t('loadingLocalCollection')}
                </span>
              </div>
            ) : syncJustFinished ? (
              <div className="flex items-center gap-1.5 mt-1.5 animate-sync-reveal">
                <svg className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
                </svg>
                <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight">
                  {t('syncCompleted')}
                </span>
              </div>
            ) : (
              <p className={`text-[13px] ${subText} mt-1.5 font-medium`}>
                {formattedDateDisplay}
              </p>
            )}
          </div>
          <GreetingVignette accentColor={accentColor} isDark={isDark} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ms-auto">
          {/* Inline Sync Status Indicator with Rich Flyout */}
          <SyncStatusPill />

          {/* Cmd+K Global Search Box */}
          <button
            type="button"
            onClick={() => setAppState({ cmdKOpen: true })}
            className={`h-9 w-auto min-w-[144px] sm:min-w-[152px] max-w-[208px] px-3.5 pe-4 rounded-xl border text-[12.5px] flex items-center gap-2 cursor-pointer transition-[background-color,border-color,color,box-shadow] hover:border-[var(--brand-border)] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${cardSurface}`}
          >
            <span className={`flex items-center gap-2 ${subText} min-w-0`}>
              <svg
                className="w-3.5 h-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="truncate">{t('cmdPaletteAriaLabel').replace(/^全局/, '')}</span>
            </span>
          </button>
        </div>
      </header>

      {/* Active Vacation Sanctuary Full-Canvas View (享受你的假期 ^_^) */}
      {isVacationActive && !peekNormalDashboard && !isSyncPending ? (
        <article
          className={`relative rounded-3xl border px-10 py-12 min-h-[540px] flex flex-col items-center justify-center text-center overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.025)] transition-[background-color,border-color,box-shadow] duration-500 ${cardSurface}`}
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
                className="text-[var(--text-secondary)] opacity-55"
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
                className="text-[var(--text-secondary)] opacity-30"
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
            {dashboard.streak.current > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span>
                  {t(
                    (dashboard.vacation?.frozenDates?.length ?? 0) > 0
                      ? 'vacationStreakFrozen'
                      : 'streakDays',
                    { n: dashboard.streak.current },
                  )}
                </span>
              </>
            )}
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
              className="btn-ghost !h-9 !px-3 !text-[12px] text-[var(--text-secondary)] hover:text-current"
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
                <span className="w-2 h-2 rounded-full bg-[var(--status-success)] motion-safe:animate-pulse" />
                <span className="font-semibold text-[var(--status-success)]">
                  {t('vacationActiveBadge')} · {t('vacationRemainingDays', { n: vacRemaining })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => appActions.openVacationModal('status')}
                  className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-current cursor-pointer px-2 py-1"
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
            className={`dashboard-hero relative rounded-[24px] border px-7 sm:px-9 py-6 sm:py-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8 transition-[background-color,border-color,box-shadow] duration-500 ${cardSurface} ${
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
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]"
              aria-hidden="true"
            >
              <StreakFlameBackdrop isDark={isDark} />
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8 flex-1 min-w-0">
              {/* Left + Center-Left: Ring & 3-Line Progress Stack */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-7 min-w-0">
                {/* Zone 1: Left Circular Ring */}
                <Tooltip
                  variant="compact"
                  side="bottom"
                  align="center"
                  offset={8}
                  openDelay={180}
                  className="w-max tabular-nums"
                  repositionKey={`${isSyncPending}-${isVacationActive}-${completed}-${totalWorkload}-${vacRemaining}`}
                  content={
                    isSyncPending
                      ? syncing
                        ? t('syncingAnkiWebAria')
                        : t('loadingLocalCollection')
                      : isVacationActive
                      ? `${t('vacationActiveBadge')} · ${vacRemaining}/${vacDays} ${t('daysUnit')}`
                      : t('todayProgressTooltip', {
                          done: completed,
                          total: totalWorkload,
                        })
                  }
                >
                  <div
                    tabIndex={0}
                    className="dashboard-progress-ring relative w-[104px] h-[104px] shrink-0 flex items-center justify-center rounded-full outline-none"
                    role="progressbar"
                    aria-valuenow={
                      isSyncPending
                        ? undefined
                        : isVacationActive
                        ? vacRemaining
                        : progressPct
                    }
                    aria-valuemin={isSyncPending ? undefined : 0}
                    aria-valuemax={
                      isSyncPending
                        ? undefined
                        : isVacationActive
                        ? vacDays
                        : 100
                    }
                    aria-valuetext={
                      isSyncPending
                        ? t('syncing')
                        : isVacationActive
                        ? `${vacRemaining}/${vacDays} ${t('daysUnit')}`
                        : `${progressPct}% · ${t('todayProgressTooltip', {
                            done: completed,
                            total: totalWorkload,
                          })}`
                    }
                    aria-busy={isSyncPending || undefined}
                    aria-label={isVacationActive ? t('vacationModalTitle') : t('todayProgressTitle')}
                  >
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
                    <circle
                      cx="56"
                      cy="56"
                      r="37.5"
                      stroke="var(--border-subtle)"
                      strokeOpacity={isDark ? '0.45' : '0.7'}
                      strokeWidth="1"
                      fill="none"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      stroke="var(--dashboard-track)"
                      strokeWidth="8"
                      fill="none"
                      className="dashboard-progress-ring-track"
                    />
                    {!isSyncPending && !isVacationActive && progressPct === 0 && totalWorkload > 0 && (
                      <circle
                        cx={56 + radius}
                        cy="56"
                        r="2.25"
                        fill={brandHex}
                        opacity="0.55"
                      />
                    )}
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      stroke={
                        isSyncPending
                          ? 'var(--status-warning)'
                          : isVacationActive || progressPct >= 100
                          ? 'var(--status-success)'
                          : brandHex
                      }
                      strokeWidth="8"
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
                      className={`dashboard-progress-ring-arc ${isSyncPending ? 'motion-safe:animate-spin origin-center' : ''}`}
                    />
                  </svg>
                  <div
                    aria-hidden="true"
                    className="dashboard-progress-ring-center absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  >
                    {isSyncPending ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-[var(--status-warning)]/20 border-t-[var(--status-warning)] motion-safe:animate-spin" />
                        <span className="text-[10px] text-[var(--status-warning)] font-semibold mt-1">
                          {t('syncing')}
                        </span>
                      </>
                    ) : isVacationActive ? (
                      <>
                        <span className="inline-flex items-baseline justify-center tabular-nums text-[var(--status-success)]">
                          <span className="dashboard-progress-ring-value text-[25px] font-bold leading-none">
                            {vacRemaining}
                          </span>
                          <span className="dashboard-progress-ring-unit text-[12px] font-semibold leading-none ms-0.5">
                            {t('daysUnit')}
                          </span>
                        </span>
                        <span className={`text-[10px] ${subText} mt-1 font-mono tabular-nums`}>
                          / {vacDays} {t('daysUnit')}
                        </span>
                      </>
                    ) : (
                      <span
                        dir="ltr"
                        className={`inline-flex items-baseline justify-center tabular-nums translate-x-[2px] ${
                          progressPct >= 100 ? 'text-[var(--status-success)]' : 'text-[var(--text-primary)]'
                        } ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}
                      >
                        <span className="dashboard-progress-ring-value text-[26px] font-extrabold leading-none tracking-[-0.03em]">
                          {animatedProgressPct}
                        </span>
                        <span
                          className={`dashboard-progress-ring-unit text-[13px] font-bold leading-none ms-[2px] ${
                            progressPct >= 100 ? 'text-[var(--status-success)] opacity-85' : subText
                          }`}
                        >
                          %
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                </Tooltip>

                {/* Zone 2: 3-Line Progress Stack */}
                {isVacationActive && !isSyncPending ? (
                  <div className="space-y-2.5 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--status-success-soft)] text-[var(--status-success)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] motion-safe:animate-pulse" />
                        <span>{t('vacationActiveBadge')}</span>
                      </span>
                      {dashboard.vacation?.reason && (
                        <span className={`text-[12px] font-medium ${subText}`}>
                          · {dashboard.vacation.reason}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[22px] font-bold tracking-tight whitespace-nowrap block">
                        {vacationTimelineInfo.startLabel} – {vacationTimelineInfo.endLabel}
                      </span>
                      <p className={`text-[12px] ${subText} font-medium`}>
                        {t('vacationSafeguardsSummary')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-center min-w-[200px]">
                    <div>
                      {isSyncPending ? (
                        <div className="h-8 w-52 rounded-lg animate-skeleton-shimmer" />
                      ) : totalPending > 0 ? (
                        <div className={`flex items-baseline gap-2.5 flex-wrap ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                          <span className="text-[27px] sm:text-[29px] font-extrabold tracking-tight leading-none whitespace-nowrap">
                            {t('remainingCards', { n: totalPending })}
                          </span>
                          <span className={`text-[13.5px] font-medium whitespace-nowrap ${subText}`}>
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
                    </div>

                    {/* Inline Typographic Breakdown: 待复习 14 · 新卡 2 */}
                    {isSyncPending ? (
                      <div className="flex items-center gap-2 mt-3">
                        <div className="h-5 w-20 rounded animate-skeleton-shimmer" />
                        <div className="h-5 w-16 rounded animate-skeleton-shimmer" />
                      </div>
                    ) : (
                      <div className={`flex items-center gap-2.5 flex-wrap mt-3 text-[13px] ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
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
                          className={`dashboard-stat-pill -mx-1.5 px-1.5 py-0.5 rounded-lg inline-flex items-baseline gap-1 whitespace-nowrap hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer ${subText}`}
                        >
                          <span>{dueReviewParts[0]}</span>
                          <strong className="font-bold text-[13.5px] text-[var(--text-primary)] tabular-nums">
                            {dashboard.todayStats.dueReview}
                          </strong>
                          {dueReviewParts[1] && <span>{dueReviewParts[1]}</span>}
                        </button>

                        <span aria-hidden="true" className="text-[var(--text-muted)] opacity-55 select-none">
                          •
                        </span>

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
                          className={`dashboard-stat-pill -mx-1.5 px-1.5 py-0.5 rounded-lg inline-flex items-baseline gap-1 whitespace-nowrap hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer ${subText}`}
                        >
                          <span>{dueNewParts[0]}</span>
                          <strong className="font-bold text-[13.5px] text-[var(--text-primary)] tabular-nums">
                            {dashboard.todayStats.dueNew}
                          </strong>
                          {dueNewParts[1] && <span>{dueNewParts[1]}</span>}
                        </button>

                        {dashboard.backlog?.hasAvalanche && (
                          <>
                            <span aria-hidden="true" className="text-[var(--text-muted)] opacity-55 select-none">
                              •
                            </span>
                            <button
                              type="button"
                              onClick={() => appActions.openIcuModal('rescue')}
                              className="dashboard-stat-pill px-2 py-0.5 rounded-full text-[11.5px] font-medium inline-flex items-center gap-1 whitespace-nowrap bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)] hover:opacity-90 cursor-pointer"
                            >
                              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 17l6-6 4 4 8-8" />
                                <path d="M17 7h4v4" />
                              </svg>
                              <span>{t('backlogRescueBtn')}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Zone 3: Horizontally Centered Action Buttons (Right of Progress Text) */}
              <div className="flex items-center gap-3 flex-wrap lg:ms-auto lg:me-6">
                {isSyncPending ? (
                  <button
                    type="button"
                    disabled
                    className="h-10 px-5 rounded-xl border font-medium text-[13px] flex items-center gap-2 cursor-wait whitespace-nowrap bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  >
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--status-warning)]/30 border-t-[var(--status-warning)] motion-safe:animate-spin" />
                    <span>{t('syncing')}</span>
                  </button>
                ) : isVacationActive ? (
                  <>
                    <button
                      type="button"
                      onClick={() => appActions.openVacationModal('status')}
                      className="btn-primary hero-study-cta !h-10 !px-5 !rounded-xl !text-[13px] flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>{t('endVacationBtn')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppState({ activeTab: 'library' })}
                      className="btn-secondary !h-10 !px-4 !rounded-xl !text-[13px] bg-[var(--bg-card)]/90 whitespace-nowrap"
                    >
                      {t('navLibrary')}
                    </button>
                  </>
                ) : totalPending > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => appActions.startReview('all')}
                      className={`btn-primary hero-study-cta !h-10 !px-5 !rounded-xl !text-[13px] font-semibold flex items-center gap-2 whitespace-nowrap ${
                        syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''
                      }`}
                    >
                      <svg className="hero-study-cta-icon w-3 h-3 fill-current shrink-0 rtl:scale-x-[-1]" viewBox="0 0 24 24" aria-hidden="true">
                        <polygon points="6 4 20 12 6 20 6 4" />
                      </svg>
                      <span>{t('startTodayStudy')}</span>
                    </button>
                    {renderZenModeIconBtn()}
                    {renderCustomStudyIconBtn()}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      className="btn-primary !h-10 !px-5 !rounded-xl !text-[13px] flex items-center gap-1.5 whitespace-nowrap disabled:cursor-not-allowed disabled:!bg-black/[0.05] disabled:!text-[#8E8E93] disabled:shadow-none dark:disabled:!bg-white/[0.08] dark:disabled:!text-[#A1A1A6]"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="m8 12 2.5 2.5L16 9" />
                      </svg>
                      <span>{t('studyTomorrow')}</span>
                    </button>
                    {renderZenModeIconBtn(syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : '')}
                    {renderCustomStudyIconBtn(syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : '')}
                    <button
                      type="button"
                      onClick={() => setAppState({ activeTab: 'library' })}
                      className={`btn-secondary !h-10 !px-5 !rounded-xl !text-[13px] bg-[var(--bg-card)]/90 whitespace-nowrap ${
                        syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''
                      }`}
                    >
                      {t('browseAllLibraryBtn')}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Zone 4: Right Streak Details over Flame Backdrop (Hover/focus whole block for streak rules) */}
            <div
              className={`relative shrink-0 pt-4 lg:pt-0 lg:ps-4 border-t lg:border-t-0 dashboard-divider flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center text-start lg:text-end min-w-[116px] ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}
            >
              <HoverCard
                size="md"
                side="bottom"
                align="end"
                offset={8}
                openDelay={180}
                closeDelay={150}
                ariaLabel={t('streakRulesTooltipTitle')}
                repositionKey={`${dashboard.streak.longest}-${resolvedLang}`}
                content={
                  <div className="space-y-1 text-[11px] leading-[1.6]">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {t('streakRulesTooltipTitle')} · {t('streakSub', { longest: dashboard.streak.longest })}
                    </div>
                    <p className="text-[var(--text-secondary)]">
                      {t('streakRulesTooltipBody')}
                    </p>
                  </div>
                }
              >
                <button
                  type="button"
                  aria-label={`${t('streakTitle')} ${animatedStreakDays} ${t('daysUnit')} · ${t('streakRulesTooltipTitle')}`}
                  className="relative z-10 flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center w-full gap-3 lg:gap-2 p-1.5 -m-1.5 rounded-xl cursor-pointer text-start lg:text-end outline-none transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                >
                  <div className="flex items-center lg:justify-end gap-1.5 whitespace-nowrap">
                    <span className={`text-[13px] font-medium ${subText}`}>{t('streakTitle')}</span>
                    {isVacationActive && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                        ❄️
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline lg:justify-end gap-1 whitespace-nowrap">
                    {isSyncPending ? (
                      <div className="h-8 w-16 rounded-lg animate-skeleton-shimmer lg:mt-1 self-end" />
                    ) : (
                      <>
                        <span className="text-[32px] sm:text-[35px] font-extrabold leading-none tracking-tight tabular-nums text-[#EA580C] dark:text-[#FB923C]">
                          {animatedStreakDays}
                        </span>
                        <span className={`text-[13px] font-medium ${subText}`}>{t('daysUnit')}</span>
                      </>
                    )}
                  </div>
                </button>
              </HoverCard>
            </div>
          </section>

          {/* Deck Cards Grid */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h2 className="text-[15.5px] font-bold whitespace-nowrap">{t('myDecksTitle')}</h2>
                {topLevelDecks.length !== decks.length && (
                  <span className={`text-[12.5px] whitespace-nowrap ${subText}`}>
                    {t('decksSummarySub', { top: topLevelDecks.length, total: decks.length })}
                  </span>
                )}
                <DashboardTipLine />
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
              <div className="dashboard-deck-grid grid gap-5">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border px-6 py-5.5 flex flex-col ${cardSurface}`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl animate-skeleton-shimmer shrink-0" />
                      <div className="space-y-2 flex-1 pt-0.5">
                        <div className="w-24 h-4 rounded animate-skeleton-shimmer" />
                        <div className="w-16 h-3 rounded animate-skeleton-shimmer" />
                      </div>
                      <div className="space-y-2 flex flex-col items-end">
                        <div className="w-12 h-5 rounded animate-skeleton-shimmer" />
                        <div className="w-10 h-2.5 rounded animate-skeleton-shimmer" />
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full animate-skeleton-shimmer mt-5" />
                    <div className="flex items-center justify-between mt-4.5">
                      <div className="w-28 h-3 rounded animate-skeleton-shimmer" />
                      <div className="w-16 h-7 rounded-lg animate-skeleton-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedDecks.length === 0 ? (
              <div className={`rounded-2xl border p-10 text-center space-y-3 ${cardSurface}`}>
                <EmptyStateIllustration accentColor={accentColor} isDark={isDark} />
                <div className="text-[15px] font-semibold">{t('noDecksTitle')}</div>
                <p className={`text-[12px] ${subText}`}>{t('noDecksSub')}</p>
              </div>
            ) : (
              <div className="dashboard-deck-grid grid gap-5">
                {displayedDecks.map((deck, deckIndex) => {
                  const iconNode = hasIllustrationPack(accentColor, showIllustrations) ? (
                    <ThemedDeckEmblem
                      accentColor={accentColor}
                      deckAccent={deck.accent}
                      isDark={isDark}
                    />
                  ) : (
                    deckIconByAccent[deck.accent] || deckIconByAccent.indigo
                  );
                  const deckScale = deckScales[deckIndex % deckScales.length];
                  const breakdown = deck.masteryBreakdown ?? {
                    mature: deck.mastery / 100,
                    review: 0,
                    learning: 0,
                    new: 0,
                  };
                  const trackColor = 'var(--dashboard-track)';
                  const newColor = 'var(--dashboard-track-new)';
                  const stageLabels = t('masteryStageLabels').split('|');
                  const masteryStages = [
                    { label: stageLabels[0] || '', value: breakdown.mature, color: deckScale.brand },
                    { label: stageLabels[1] || '', value: breakdown.review, color: deckScale.heatmap[2] },
                    { label: stageLabels[2] || '', value: breakdown.learning + breakdown.new, color: deckScale.heatmap[1] },
                  ];
                  const deckHasWork = (deck.dueNew || 0) + (deck.dueReview || 0) > 0;
                  return (
                    <article
                      key={deck.id}
                      onClick={() => {
                        if (deckHasWork) appActions.startReview(deck.id);
                      }}
                      style={{
                        '--deck-brand': deckScale.brand,
                        '--deck-brand-hover': deckScale.brandHover,
                        '--deck-brand-soft': deckScale.brandSoft,
                        '--deck-brand-soft-strong': deckScale.brandSoftStrong,
                        '--deck-brand-text': deckScale.brandText,
                        '--deck-border': deckScale.brandBorder,
                      } as React.CSSProperties}
                      className={`deck-card group relative flex flex-col rounded-2xl border px-6 py-5.5 transition-[transform,border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)] focus-within:border-[var(--deck-border)] ${deckHasWork ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--deck-border)]' : 'cursor-default'} ${cardSurface} ${
                        syncJustFinished ? 'animate-sync-reveal delay-stagger-2' : ''
                      }`}
                    >
                      {/* Identity + mastery hero stat */}
                      <div className="flex items-start gap-3.5">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:scale-105"
                          style={{ backgroundColor: deckScale.brandSoft, color: deckScale.brandText }}
                        >
                          {iconNode}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <Tooltip variant="compact" content={deck.name} onlyWhenTruncated>
                            <h3 className="truncate text-[14.5px] font-semibold leading-tight">{deck.name}</h3>
                          </Tooltip>
                          <div className={`mt-1.5 truncate text-[11.5px] ${subText}`}>
                            {deck.totalCards.toLocaleString()} {t('cardsUnit')}
                            {deck.childrenCount > 0
                              ? t('subDecksCount', { n: deck.childrenCount })
                              : ''}
                          </div>
                        </div>
                        <HoverCard
                          size="sm"
                          side="bottom"
                          align="end"
                          offset={8}
                          openDelay={180}
                          closeDelay={150}
                          ariaLabel={t('masteryHintTitle', { n: deck.mastery })}
                          repositionKey={`${deck.id}-${deck.mastery}`}
                          content={
                            <div onClick={(e) => e.stopPropagation()}>
                              <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                                {t('masteryHintTitle', { n: deck.mastery })}
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                {t('masteryHintBody')}
                              </p>
                              <div className="mt-2.5 space-y-1.5">
                                {masteryStages.map((stage, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: stage.color }} />
                                    <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">{stage.label}</span>
                                    <span className="text-[11px] font-medium tabular-nums text-[var(--text-primary)]">{Math.round(stage.value * 100)}%</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2.5 border-t border-[var(--border-subtle)] pt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                                {t('masteryHintFootnote')}
                              </div>
                            </div>
                          }
                        >
                          <button
                            type="button"
                            aria-label={`${deck.name} · ${deck.mastery}% ${t('masteryLabel')}`}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="group/mastery -m-1 shrink-0 cursor-pointer rounded-lg p-1 pt-1.5 text-right outline-none focus-visible:ring-2 focus-visible:ring-[var(--deck-border)]"
                          >
                            <div className="text-[19px] font-bold leading-none tabular-nums tracking-tight transition-colors duration-[var(--dur-fast)] group-hover/mastery:text-[var(--deck-brand)]">
                              {deck.mastery}
                              <span className={`text-[12px] font-semibold ${subText}`}>%</span>
                            </div>
                          </button>
                        </HoverCard>
                      </div>

                      {/* Full-width segmented mastery bar */}
                      <div
                        className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: trackColor }}
                        role="img"
                        aria-label={`${deck.name} ${t('masteryLabel')} ${deck.mastery}%`}
                      >
                        <span className="h-full transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${breakdown.mature * 100}%`, backgroundColor: deckScale.brand }} />
                        <span className="h-full transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${breakdown.review * 100}%`, backgroundColor: deckScale.heatmap[2] }} />
                        <span className="h-full transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${breakdown.learning * 100}%`, backgroundColor: deckScale.heatmap[1] }} />
                        <span className="h-full transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${breakdown.new * 100}%`, backgroundColor: newColor }} />
                      </div>

                      {/* Due indicators + persistent actions */}
                      <div className="mt-4.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3.5 text-[11.5px]">
                          {!deckHasWork ? (
                            <span className={`flex min-w-0 items-center gap-1.5 truncate ${subText}`}>
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--status-success)] opacity-75" />
                              <span className="truncate">{t('noDueTodayTitle')}</span>
                            </span>
                          ) : (
                            <>
                              {deck.dueReview > 0 && (
                                <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold tabular-nums" style={{ color: deckScale.brandText }}>
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: deckScale.brand }} />
                                  {t('dueReviewPill', { n: deck.dueReview })}
                                </span>
                              )}
                              {deck.dueNew > 0 && (
                                <span className={`deck-due-new flex min-w-0 items-center gap-1.5 truncate tabular-nums ${subText}`}>
                                  <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: 'var(--status-warning)' }}
                                  />
                                  <span className="truncate">{t('dueNewPill', { n: deck.dueNew })}</span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Tooltip variant="compact" content={t('viewInLibraryBtn')}>
                            <button
                              type="button"
                              aria-label={`${deck.name} · ${t('viewInLibraryBtn')}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAppState({ activeTab: 'library' });
                                appActions.searchLibraryDebounced({ deckId: deck.id });
                              }}
                              className="btn-secondary deck-view-btn"
                            >
                              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="16" rx="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                              </svg>
                            </button>
                          </Tooltip>
                          <Tooltip variant="compact" content={deckHasWork ? t('startTodayStudy') : t('studyTomorrow')}>
                            <button
                              type="button"
                              aria-label={`${deck.name} · ${deckHasWork ? t('startTodayStudy') : t('studyTomorrow')}`}
                              aria-disabled={!deckHasWork || undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (deckHasWork) appActions.startReview(deck.id);
                              }}
                              className="btn-primary deck-study-btn"
                            >
                              {deckHasWork ? (
                                <svg className="h-3 w-3 shrink-0 fill-current ms-[1px]" viewBox="0 0 24 24" aria-hidden="true">
                                  <polygon points="6 4 20 12 6 20 6 4" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="m8 12 2.5 2.5L16 9" />
                                </svg>
                              )}
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Bottom Analytics Row: Activity Heatmap & Weekly Rhythm */}
          <section className="dashboard-analytics-grid grid grid-cols-12 gap-5 pb-4">
            {/* Left: Heatmap */}
            <div
              className={`col-span-12 xl:col-span-7 rounded-2xl border p-6 sm:p-7 flex flex-col justify-between relative ${cardSurface} ${
                syncJustFinished ? 'animate-sync-reveal delay-stagger-3' : ''
              }`}
            >
              {isSyncPending ? (
                <div className="flex flex-col justify-between h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-[14.5px] font-bold">{t('heatmapTitle')}</h3>
                      <div className="w-36 h-3 rounded animate-skeleton-shimmer mt-1.5" />
                    </div>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 3, 4].map((lv) => (
                        <span key={lv} className="w-2.5 h-2.5 rounded-[3px] animate-skeleton-shimmer" />
                      ))}
                    </div>
                  </div>
                  <div className="dashboard-heatmap-viewport my-3">
                    <div className="dashboard-heatmap-content">
                      <div dir="ltr" className="flex items-center justify-between gap-1.5">
                        {Array.from({ length: 26 }).map((_, colIdx) => (
                          <div key={colIdx} className="flex flex-col gap-[7px]">
                            {Array.from({ length: 7 }).map((__, rowIdx) => (
                              <div
                                key={rowIdx}
                                className="dashboard-heatmap-cell w-[11px] h-[11px] sm:w-[12px] sm:h-[12px] animate-skeleton-shimmer opacity-40"
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div
                    className="dashboard-divider pt-4 border-t flex items-center gap-8"
                  >
                    <div className="w-20 h-7 rounded animate-skeleton-shimmer" />
                    <div className="w-20 h-7 rounded animate-skeleton-shimmer" />
                    <div className="w-20 h-7 rounded animate-skeleton-shimmer" />
                    <div className="w-16 h-6 rounded-lg animate-skeleton-shimmer ms-auto" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-baseline gap-2.5 flex-wrap min-w-0">
                      <h3 className="text-[14.5px] font-semibold tracking-tight">{t('heatmapTitle')}</h3>
                      <span className="text-[11.5px] text-[var(--text-muted)] tabular-nums">
                        {t('heatmapSub', { n: dashboard.heatmap.totalYearReviews.toLocaleString() })}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] shrink-0 ${subText}`}>
                      <span>{t('less')}</span>
                      {[0, 1, 2, 3, 4].map((lv) => (
                        <span
                          key={lv}
                          data-level={lv}
                          className="dashboard-heatmap-cell w-2.5 h-2.5"
                        />
                      ))}
                      <span>{t('more')}</span>
                    </div>
                  </div>

                  <div
                    className="my-4 relative"
                    onMouseLeave={() => {
                      setHoveredHeatmapCell(null);
                      setHeatmapAnchorEl(null);
                    }}
                  >
                    <ChartTooltipPortal
                      open={Boolean(hoveredHeatmapCell && heatmapAnchorEl)}
                      anchorEl={heatmapAnchorEl}
                      repositionKey={
                        hoveredHeatmapCell
                          ? `${hoveredHeatmapCell.colIdx}-${hoveredHeatmapCell.rowIdx}`
                          : null
                      }
                      onClose={() => {
                        setHoveredHeatmapCell(null);
                        setHeatmapAnchorEl(null);
                      }}
                      content={
                        hoveredHeatmapCell ? (
                          <ChartTooltipContent
                            eyebrow={formatFullDateWithWeekday(hoveredHeatmapCell.date, resolvedLang)}
                          >
                            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold tabular-nums whitespace-nowrap">
                              {hoveredHeatmapCell.isFrozen ? (
                                <span className="text-[var(--status-info-text)] flex items-center gap-1">
                                  <span aria-hidden="true">❄️</span>
                                  <span>{t('freezeStreakLabel')}</span>
                                </span>
                              ) : hoveredHeatmapCell.count > 0 ? (
                                <>
                                  <span className="text-[var(--brand-text)]">
                                    {hoveredHeatmapCell.count.toLocaleString()} {t('cardsUnit')}
                                  </span>
                                  <span aria-hidden="true" className="text-[var(--text-muted)]">
                                    ·
                                  </span>
                                  <span className="text-[var(--status-success-text)]">
                                    {hoveredHeatmapCell.accuracy}%
                                  </span>
                                </>
                              ) : (
                                <span className="font-normal text-[var(--text-muted)]">
                                  {t('weeklyRhythmEmptyDay')}
                                </span>
                              )}
                            </div>
                          </ChartTooltipContent>
                        ) : null
                      }
                    />

                    <div className="dashboard-heatmap-viewport p-1 -m-1">
                      <div className="dashboard-heatmap-content">
                        <div dir="ltr" className="flex items-center justify-between gap-1.5 py-1">
                          {Array.from({ length: 26 }).map((_, colIdx) => (
                            <div key={colIdx} className="flex flex-col gap-[7px]">
                              {Array.from({ length: 7 }).map((__, rowIdx) => {
                                const flatIdx = colIdx * 7 + rowIdx;
                                const cell = recent182Cells[flatIdx] || {
                                  date: '',
                                  count: 0,
                                  accuracy: 0,
                                  level: 0,
                                };
                                const isFrozen = Boolean(cell.isStreakFrozen);
                                const isTodayCell =
                                  recent182Cells.length > 0 &&
                                  flatIdx === recent182Cells.length - 1 &&
                                  Boolean(cell.date);
                                const isHovered =
                                  hoveredHeatmapCell?.colIdx === colIdx &&
                                  hoveredHeatmapCell?.rowIdx === rowIdx;
                                const cellAccuracy =
                                  cell.accuracy ?? (cell.count > 0 ? dashboard.heatmap.retentionRate : 0);
                                const cellPayload = {
                                  date: cell.date,
                                  count: cell.count,
                                  accuracy: cellAccuracy,
                                  isFrozen,
                                  colIdx,
                                  rowIdx,
                                };
                                const formattedCellDate = cell.date
                                  ? formatFullDateWithWeekday(cell.date, resolvedLang)
                                  : '';
                                const cellAriaLabel = `${formattedCellDate ? `${formattedCellDate}: ` : ''}${
                                  isFrozen
                                    ? t('freezeStreakLabel')
                                    : cell.count > 0
                                    ? `${cell.count.toLocaleString()} ${t('cardsUnit')} · ${cellAccuracy}%`
                                    : t('weeklyRhythmEmptyDay')
                                }`;
                                return (
                                  <div
                                    key={rowIdx}
                                    tabIndex={0}
                                    role="img"
                                    aria-label={cellAriaLabel}
                                    data-level={isFrozen ? undefined : Math.max(0, Math.min(4, cell.level || 0))}
                                    onMouseEnter={(e) => {
                                      setHoveredHeatmapCell(cellPayload);
                                      setHeatmapAnchorEl(e.currentTarget);
                                    }}
                                    onFocus={(e) => {
                                      setHoveredHeatmapCell(cellPayload);
                                      setHeatmapAnchorEl(e.currentTarget);
                                    }}
                                    onBlur={() => {
                                      setHoveredHeatmapCell(null);
                                      setHeatmapAnchorEl(null);
                                    }}
                                    className={`dashboard-heatmap-cell w-[11px] h-[11px] sm:w-[12px] sm:h-[12px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:scale-125 ${
                                      isHovered
                                        ? 'scale-125 ring-2 ring-[var(--brand)] relative z-10'
                                        : isTodayCell
                                        ? 'ring-1 ring-[var(--brand)]/80 ring-offset-1 ring-offset-[var(--bg-card)]'
                                        : ''
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

                        <div dir="ltr" className={`mt-3 flex items-center justify-between text-[10.5px] tabular-nums ${subText} px-0.5`}>
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
                    </div>
                  </div>

                  <div
                    className="dashboard-divider pt-4 border-t flex items-center gap-7 sm:gap-9 flex-wrap"
                  >
                    <div>
                      <div className="text-[15.5px] font-bold tabular-nums whitespace-nowrap">
                        {dashboard.heatmap.weekTotalCards.toLocaleString()} {t('cardsUnit')}
                      </div>
                      <div className={`text-[11px] mt-0.5 whitespace-nowrap ${subText}`}>{t('weekStudied')}</div>
                    </div>
                    <div>
                      <div className="text-[15.5px] font-bold tabular-nums whitespace-nowrap">
                        {dashboard.heatmap.dailyAverage.toLocaleString()} {t('cardsUnit')}
                      </div>
                      <div className={`text-[11px] mt-0.5 whitespace-nowrap ${subText}`}>{t('dailyAvg')}</div>
                    </div>
                    <div>
                      <div className="text-[15.5px] font-bold tabular-nums whitespace-nowrap">{dashboard.heatmap.retentionRate}%</div>
                      <div className={`text-[11px] mt-0.5 whitespace-nowrap ${subText}`}>{t('retentionRate')}</div>
                    </div>
                    <div className="ms-auto">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums whitespace-nowrap ${wowToneClass}`}>
                        {dashboard.heatmap.wowChange}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: Weekly Rhythm Bar Chart */}
            <div
              className={`col-span-12 xl:col-span-5 rounded-2xl border p-6 sm:p-7 flex flex-col justify-between relative ${cardSurface} ${
                syncJustFinished ? 'animate-sync-reveal delay-stagger-3' : ''
              }`}
            >
              {isSyncPending ? (
                <div className="flex flex-col justify-between h-full gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14.5px] font-semibold tracking-tight">{t('weeklyRhythmTitle')}</h3>
                    <div className="w-16 h-5 rounded-md animate-skeleton-shimmer" />
                  </div>
                  <div className="my-3 h-[144px] flex items-end justify-between gap-3 pt-4 px-1">
                    {[65, 25, 45, 18, 35, 15, 28].map((h, idx) => (
                      <div
                        key={idx}
                        style={{ height: `${h}%` }}
                        className="flex-1 max-w-[30px] rounded-t-lg animate-skeleton-shimmer opacity-50"
                      />
                    ))}
                  </div>
                  <div
                    className="dashboard-divider pt-4 border-t flex items-center gap-8"
                  >
                    <div className="w-20 h-7 rounded animate-skeleton-shimmer" />
                    <div className="w-20 h-7 rounded animate-skeleton-shimmer" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14.5px] font-semibold tracking-tight">{t('weeklyRhythmTitle')}</h3>
                    {todayRhythmDay && (
                      <span className="px-2 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-semibold tabular-nums shrink-0">
                        {t('todayLabel')} {todayRhythmDay.count.toLocaleString()} {t('cardsUnit')}
                      </span>
                    )}
                  </div>

                  <div
                    className="my-4 relative"
                    onMouseLeave={() => {
                      setHoveredRhythmIdx(null);
                      setRhythmAnchorEl(null);
                    }}
                  >
                    <ChartTooltipPortal
                      open={Boolean(
                        hoveredRhythmIdx !== null &&
                          dashboard.weeklyRhythm.days[hoveredRhythmIdx] &&
                          rhythmAnchorEl
                      )}
                      anchorEl={rhythmAnchorEl}
                      repositionKey={hoveredRhythmIdx}
                      onClose={() => {
                        setHoveredRhythmIdx(null);
                        setRhythmAnchorEl(null);
                      }}
                      content={(() => {
                        const day =
                          hoveredRhythmIdx !== null
                            ? dashboard.weeklyRhythm.days[hoveredRhythmIdx]
                            : undefined;
                        if (!day || hoveredRhythmIdx === null) return null;
                        const mins =
                          day.minutes !== undefined
                            ? day.minutes
                            : day.count > 0
                            ? Math.max(
                                1,
                                Math.round(
                                  (day.count * (dashboard.weeklyRhythm.avgSecondsPerCard || 6)) / 60
                                )
                              )
                            : 0;
                        const dayHeader =
                          formatMonthDayWithWeekday(day.date, resolvedLang, hoveredRhythmIdx) ||
                          day.label;
                        return (
                          <ChartTooltipContent
                            className="min-w-[144px] gap-1.5"
                            eyebrow={
                              <div className="flex items-center justify-between gap-2.5 pb-1 border-b border-[var(--border-subtle)]/80">
                                <span className="text-[11px] font-semibold text-[var(--text-primary)] whitespace-nowrap">
                                  {dayHeader}
                                </span>
                                {day.isToday && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold leading-none bg-[var(--brand-soft)] text-[var(--brand-text)] shrink-0">
                                    {t('todayLabel')}
                                  </span>
                                )}
                              </div>
                            }
                            rows={
                              day.count > 0
                                ? [
                                    {
                                      label: t('weeklyRhythmCardsLabel'),
                                      value: `${day.count.toLocaleString()} ${t('cardsUnit')}`,
                                      tone: 'brand',
                                    },
                                    {
                                      label: t('weeklyRhythmDurationLabel'),
                                      value: formatStudyMinutes(mins, resolvedLang),
                                      tone: 'default',
                                    },
                                  ]
                                : undefined
                            }
                          >
                            {day.count === 0 && (
                              <div className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                                {t('weeklyRhythmEmptyDay')}
                              </div>
                            )}
                          </ChartTooltipContent>
                        );
                      })()}
                    />

                    {/* Plot area with subtle horizontal gridlines, weekly avg dashed line, and flush baseline */}
                    <div
                      dir="ltr"
                      className="h-[144px] flex items-end justify-between gap-2.5 sm:gap-3 px-1 relative border-b border-[var(--border-subtle)]/75"
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex flex-col justify-between"
                      >
                        <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                        <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                        <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                        <div />
                      </div>

                      {weeklyAvgLinePct > 0 && (
                        <div
                          aria-hidden="true"
                          style={{ bottom: `${weeklyAvgLinePct}%` }}
                          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--brand)]/35 z-10"
                        />
                      )}

                      {dashboard.weeklyRhythm.days.map((day, idx) => {
                        const isFutureDay =
                          todayRhythmIdx >= 0 && idx > todayRhythmIdx && day.count === 0;
                        const heightPct =
                          day.count > 0
                            ? Math.max(12, Math.round((day.count / maxWeeklyCount) * 100))
                            : 0;
                        const isHovered = hoveredRhythmIdx === idx;
                        const mins =
                          day.minutes !== undefined
                            ? day.minutes
                            : day.count > 0
                            ? Math.max(
                                1,
                                Math.round(
                                  (day.count * (dashboard.weeklyRhythm.avgSecondsPerCard || 6)) / 60
                                )
                              )
                            : 0;
                        const dayAriaHeading =
                          formatMonthDayWithWeekday(day.date, resolvedLang, idx) || day.label;
                        const dayAriaDetail =
                          day.count > 0
                            ? `${day.count.toLocaleString()} ${t('cardsUnit')} · ${formatStudyMinutes(mins, resolvedLang)}`
                            : t('weeklyRhythmEmptyDay');

                        return (
                          <div
                            key={day.date || `${day.label}-${idx}`}
                            tabIndex={0}
                            role="img"
                            aria-label={`${dayAriaHeading}: ${dayAriaDetail}`}
                            onMouseEnter={(e) => {
                              setHoveredRhythmIdx(idx);
                              setRhythmAnchorEl(e.currentTarget);
                            }}
                            onFocus={(e) => {
                              setHoveredRhythmIdx(idx);
                              setRhythmAnchorEl(e.currentTarget);
                            }}
                            onBlur={() => {
                              setHoveredRhythmIdx(null);
                              setRhythmAnchorEl(null);
                            }}
                            className="relative z-10 flex-1 h-full flex flex-col items-center justify-end cursor-pointer rounded-t-lg focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                          >
                            {day.count > 0 ? (
                              <div
                                style={{
                                  height: `${heightPct}%`,
                                  backgroundColor:
                                    day.isToday || isHovered
                                      ? brandHex
                                      : accentScale.brandMutedBar,
                                }}
                                className={`w-full max-w-[30px] rounded-t-[8px] transition-[height,background-color,opacity,transform,filter] duration-200 ${
                                  isHovered ? 'scale-x-105 brightness-105' : ''
                                }`}
                              />
                            ) : isFutureDay ? (
                              <div className="w-full max-w-[20px] h-[2px] rounded-full bg-[var(--dashboard-track)] opacity-60" />
                            ) : (
                              <div className="w-full max-w-[26px] h-[4px] rounded-t-sm bg-[var(--dashboard-track-new)]/80" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Weekday ticks directly below baseline */}
                    <div
                      dir="ltr"
                      className="pt-2.5 px-1 flex items-center justify-between gap-2.5 sm:gap-3"
                    >
                      {dashboard.weeklyRhythm.days.map((day, idx) => {
                        const isFutureDay =
                          todayRhythmIdx >= 0 && idx > todayRhythmIdx && day.count === 0;
                        const isHovered = hoveredRhythmIdx === idx;
                        return (
                          <span
                            key={day.date || `lbl-${day.label}-${idx}`}
                            className={`flex-1 text-center text-[11px] transition-colors ${
                              day.isToday || isHovered
                                ? 'font-semibold text-[var(--brand-text)]'
                                : isFutureDay
                                ? 'text-[var(--text-muted)] opacity-45'
                                : subText
                            }`}
                          >
                            {day.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Balanced 2-row metric footer matching Left Heatmap card height */}
                  <div className="dashboard-divider pt-4 border-t flex items-center gap-7 sm:gap-9 flex-wrap">
                    <div>
                      <div className="text-[15.5px] font-bold tabular-nums whitespace-nowrap">
                        {formatSecondsUnit(dashboard.weeklyRhythm.avgSecondsPerCard)}
                      </div>
                      <div className={`text-[11px] mt-0.5 whitespace-nowrap ${subText}`}>
                        {t('weeklyRhythmAvgPaceLabel')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[15.5px] font-bold tabular-nums whitespace-nowrap">
                        {formatStudyMinutes(dashboard.weeklyRhythm.longestSessionMinutes, resolvedLang)}
                      </div>
                      <div className={`text-[11px] mt-0.5 whitespace-nowrap ${subText}`}>
                        {t('weeklyRhythmLongestLabel')}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}
      </div>
    </div>
  );
};
