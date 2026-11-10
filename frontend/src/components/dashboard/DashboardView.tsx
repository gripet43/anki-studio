import React, { useMemo, useState } from 'react';
import {
  formatFullDateWithWeekday,
  formatShortcut,
  translate,
} from '../../i18n/translations';
import { appActions, setAppState, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';
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

  const isZh = resolvedLang === 'zh-CN';
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

  const subText = 'text-[#8E8E93]';

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
    const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let colIdx = 0; colIdx < 26; colIdx++) {
      const cell = recent182Cells[colIdx * 7];
      if (cell && cell.date) {
        const parts = cell.date.split('-');
        const mNum = parseInt(parts[1], 10);
        if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
          const label = resolvedLang === 'zh-CN' ? `${mNum}月` : enMonths[mNum - 1];
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
  const displayName = dashboard.userName
    ? `${resolvedLang === 'zh-CN' ? '，' : ', '}${dashboard.userName}`
    : '';

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
      return isZh ? `${parts[1]}月${parts[2]}日` : `${parts[1]}/${parts[2]}`;
    };
    let returnDateStr = '';
    if (endRaw) {
      const parts = endRaw.split('-').map((x) => parseInt(x, 10));
      if (parts.length === 3 && !parts.some(isNaN)) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        dt.setDate(dt.getDate() + 1);
        returnDateStr = isZh
          ? `${dt.getMonth() + 1}月${dt.getDate()}日`
          : `${dt.getMonth() + 1}/${dt.getDate()}`;
      }
    }
    return {
      startLabel: startRaw ? fmtIso(startRaw) : isZh ? '今日' : 'Today',
      endLabel: endRaw ? fmtIso(endRaw) : '',
      returnLabel: returnDateStr,
    };
  }, [dashboard.vacation?.startDate, dashboard.vacation?.endDate, isZh]);

  return (
    <div className="flex-1 h-screen overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Header Row — Synced Status Capsule & Cmd+K Search */}
      <header
        onMouseDown={startWindowDrag}
        onDoubleClick={handleWindowDoubleClick}
        className="flex items-center justify-between select-none cursor-default"
      >
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">
            {dashboard.greeting}
            {displayName}
          </h1>
          {isSyncPending ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--status-warning)] animate-ping" />
              <span className="text-[12px] font-medium text-[var(--status-warning)] tracking-tight">
                {isZh ? '正在从云端同步最新复习队列与 FSRS 记忆调度...' : 'Syncing collection & FSRS memory matrix from cloud...'}
              </span>
            </div>
          ) : syncJustFinished ? (
            <div className="flex items-center gap-1.5 mt-1 animate-sync-reveal">
              <svg className="w-3.5 h-3.5 text-[var(--status-success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
              </svg>
              <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight">
                {isZh ? '数据就绪 · 集合与云端已完全同步' : 'Data Ready · Collection synchronized'}
              </span>
            </div>
          ) : (
            <p className={`text-[13px] ${subText} mt-0.5 font-medium`}>
              {dashboard.dateDisplay}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Apple Inset Translucent Synced Status Capsule with Rich Flyout */}
          <SyncStatusPill />

          {/* Cmd+K Global Search Box */}
          <button
            onClick={() => setAppState({ cmdKOpen: true })}
            className={`h-9 ${
              showShortcutHints ? 'w-[220px]' : 'w-[180px]'
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

      {/* Active Vacation Sanctuary Full-Canvas View (Replaces the entire Dashboard content area by default during Vacation) */}
      {isVacationActive && !peekNormalDashboard && !isSyncPending ? (
        <article
          className={`relative rounded-3xl border px-10 py-12 min-h-[540px] flex flex-col items-center justify-center text-center overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.025)] transition-all duration-500 ${cardSurface}`}
          aria-label={isZh ? '休假保护状态画布' : 'Vacation Sanctuary View'}
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

          {/* Bespoke Minimalist Zen Sanctuary Illustration (Explicit width & height to prevent CLS) */}
          <div className="relative mb-6 select-none">
            <svg
              width="240"
              height="152"
              viewBox="0 0 240 152"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto overflow-visible"
              role="img"
              aria-label={isZh ? '休假放松插画' : 'Vacation relaxation illustration'}
            >
              {/* Soft Arched Sanctuary Backdrop */}
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

              {/* Warm Sun / Crescent Orb */}
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

              {/* Gentle Floating Clouds */}
              <path
                d="M66 56H92C95.3 56 98 53.3 98 50C98 46.9 95.6 44.3 92.6 44C91.5 39.4 87.4 36 82.5 36C76.7 36 72 40.7 72 46.5C72 46.8 72 47.1 72.1 47.4C68.6 48.1 66 51.2 66 55"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#8E8E93] opacity-55"
              />

              {/* Serene Distant Rolling Hills */}
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

              {/* Resting Closed Book & Bookmark on Sill */}
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

              {/* Steaming Porcelain Teacup */}
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
              {/* Gentle Steam Wisps */}
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

              {/* Subtle Sparkles */}
              <circle cx="56" cy="76" r="2" fill="currentColor" className="text-[var(--status-success)] opacity-45" />
              <circle cx="184" cy="70" r="2" fill="currentColor" className="text-[var(--brand)] opacity-45" />
              <circle cx="116" cy="34" r="1.5" fill="currentColor" className="text-[var(--status-warning)] opacity-55" />
            </svg>
          </div>

          {/* Serene Headline & Single-Line Whisper Status */}
          <h2 className="text-[26px] font-bold tracking-tight mt-2">
            {isZh ? '享受你的假期 ^_^' : 'Enjoy your vacation ^_^'}
          </h2>

          <p className={`text-[13px] ${subText} mt-2.5 flex items-center justify-center gap-2 flex-wrap`}>
            <span className="inline-flex items-center gap-1.5 text-[var(--status-success)] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)]" />
              <span>
                {isZh
                  ? `休假中（剩 ${vacRemaining} 天）`
                  : `On vacation (${vacRemaining}d left)`}
              </span>
            </span>
            <span className="opacity-40">·</span>
            <span>
              {vacationTimelineInfo.returnLabel
                ? isZh
                  ? `${vacationTimelineInfo.returnLabel} 恢复`
                  : `Resumes ${vacationTimelineInfo.returnLabel}`
                : `${vacationTimelineInfo.startLabel} – ${vacationTimelineInfo.endLabel}`}
            </span>
            <span className="opacity-40">·</span>
            <span>
              {isZh
                ? `${dashboard.streak.current} 天连胜已保护`
                : `${dashboard.streak.current}d streak protected`}
            </span>
          </p>

          {/* Minimal Action Buttons */}
          <div className="flex items-center justify-center gap-2.5 mt-7">
            <button
              type="button"
              onClick={() => appActions.openVacationModal('status')}
              className="btn-secondary !h-9 !px-4 !text-[12px] font-medium"
            >
              {isZh ? '休假设置 / 结束' : 'Vacation Settings'}
            </button>

            <button
              type="button"
              onClick={() => setPeekNormalDashboard(true)}
              className="btn-ghost !h-9 !px-3 !text-[12px] text-[#8E8E93] hover:text-current"
            >
              {isZh ? '查看看板' : 'View Dashboard'}
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
                  {isZh
                    ? `休假模式生效中（剩余 ${vacRemaining} 天 · 预计 ${vacationTimelineInfo.returnLabel || vacationTimelineInfo.endLabel} 恢复）`
                    : `Vacation Active (${vacRemaining}d left)`}
                </span>
                <span className={`text-[11px] ${subText}`}>
                  {isZh ? '· 当前为临时预览日常看板' : '· Peeking normal dashboard'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => appActions.openVacationModal('status')}
                  className="text-[11px] font-medium text-[#8E8E93] hover:text-current cursor-pointer px-2 py-1"
                >
                  {isZh ? '休假设置' : 'Settings'}
                </button>
                <button
                  type="button"
                  onClick={() => setPeekNormalDashboard(false)}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-[var(--status-success)] text-white cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {isZh ? '返回休假画面' : 'Back to Vacation View'}
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Today's Study Progress Board / Active Vacation Protection Hero */}
          <section
        className={`rounded-2xl border p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between gap-8 transition-all duration-500 ${cardSurface} ${
          isSyncPending
            ? 'border-[var(--brand-border)] shadow-md ring-1 ring-[var(--brand)]/20'
            : isVacationActive
            ? 'border-[var(--status-success)]/25 ring-1 ring-[var(--status-success)]/15'
            : syncJustFinished
            ? 'animate-sync-border-flash ring-1 ring-[var(--status-success)]/30'
            : ''
        }`}
      >
        <div className="flex items-center gap-7 flex-1 min-w-0">
          {/* Left Ring: Vacation Countdown Dial when on Vacation, otherwise Study Progress Ring */}
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
                  <span className="text-[10px] text-[var(--status-warning)] font-semibold mt-1">同步中</span>
                </>
              ) : isVacationActive ? (
                <>
                  <span className="text-[10px] font-semibold text-[var(--status-success)] tracking-tight mb-0.5">
                    {isZh ? '剩余' : 'Left'}
                  </span>
                  <span className="text-[25px] font-bold leading-none text-[var(--status-success)]">
                    {vacRemaining}
                    <span className="text-[12px] font-semibold ml-0.5">
                      {isZh ? '天' : 'd'}
                    </span>
                  </span>
                  <span className={`text-[10px] ${subText} mt-1 font-mono`}>
                    {isZh ? `/ 共 ${vacDays} 天` : `/ ${vacDays}d`}
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

          {/* Central Overview: Active Vacation Status Hierarchy vs Daily Progress */}
          {isVacationActive && !isSyncPending ? (
            <div className="space-y-3 flex-1 min-w-0">
              {/* Tier 1: Calm Status Badge & Reason */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--status-success-soft)] text-[var(--status-success)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] animate-pulse" />
                  <span>{isZh ? '休假保护生效中' : 'Vacation Protection Active'}</span>
                </span>
                {dashboard.vacation?.reason && (
                  <span className={`text-[12px] font-medium ${subText}`}>
                    · {dashboard.vacation.reason}
                  </span>
                )}
              </div>

              {/* Tier 2: Clear Schedule Window & Expected Return Date */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-[22px] font-bold tracking-tight">
                    {isZh
                      ? `当前处于休假模式，将于 ${vacationTimelineInfo.endLabel || dashboard.vacation?.endDate} 结束`
                      : `On vacation until ${vacationTimelineInfo.endLabel || dashboard.vacation?.endDate}`}
                  </span>
                </div>
                <p className={`text-[12px] ${subText} font-medium`}>
                  {isZh
                    ? `休假周期：${vacationTimelineInfo.startLabel} – ${vacationTimelineInfo.endLabel}（共 ${vacDays} 天）${
                        vacationTimelineInfo.returnLabel
                          ? ` · 预计 ${vacationTimelineInfo.returnLabel} 恢复日常学习队列`
                          : ' · 假期结束后自动恢复日常学习队列'
                      }`
                    : `Schedule: ${vacationTimelineInfo.startLabel} – ${vacationTimelineInfo.endLabel} (${vacDays}d)${
                        vacationTimelineInfo.returnLabel
                          ? ` · Daily reviews resume on ${vacationTimelineInfo.returnLabel}`
                          : ''
                      }`}
                </p>
              </div>

              {/* Tier 3: Quick Management Actions & Active Safeguard Pills */}
              <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                <button
                  type="button"
                  onClick={() => appActions.openVacationModal('status')}
                  style={{ backgroundColor: brandHex }}
                  className="btn-primary !h-9 !px-4 !text-[12px] flex items-center gap-1.5"
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{isZh ? '管理休假 / 提前结束' : 'Manage / End Early'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAppState({ activeTab: 'library' })}
                  className="btn-secondary !h-9 !px-3.5 !text-[12px]"
                >
                  {isZh ? '自由浏览卡片库' : 'Browse Library'}
                </button>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {dashboard.vacation?.freezeNewCards !== false && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 bg-[var(--status-success-soft)] text-[var(--status-success)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)]" />
                      {isZh ? '每日新卡已暂停' : 'New cards paused'}
                    </span>
                  )}

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 bg-[var(--brand-soft)] text-[var(--brand-text)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
                    {dashboard.vacation?.shiftedCardCount && dashboard.vacation.shiftedCardCount > 0
                      ? isZh
                        ? `已顺延 ${dashboard.vacation.shiftedCardCount} 张到期卡`
                        : `${dashboard.vacation.shiftedCardCount} due cards shifted`
                      : isZh
                      ? '到期复习已顺延'
                      : 'Due reviews postponed'}
                  </span>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    {isZh ? '连胜记录已冻结' : 'Streak frozen'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 flex-1 min-w-0">
              {/* Header Kicker */}
              <div>
                <span className={`text-[12px] font-medium ${subText}`}>
                  {t('todayProgressTitle')}
                </span>
              </div>

              {/* Focal Remaining Metric */}
              {isSyncPending ? (
                <div className="h-8 w-56 rounded-lg animate-skeleton-shimmer" />
              ) : totalPending > 0 ? (
                <div className={`flex items-baseline gap-2.5 ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                  <span className="text-[26px] font-bold tracking-tight">
                    {t('remainingCards', { n: totalPending })}
                  </span>
                  <span className={`text-[13px] ${subText}`}>
                    {t('estimatedMinutes', { n: dashboard.todayStats.estimatedMinutes })}
                  </span>
                </div>
              ) : completed > 0 ? (
                <div className={`flex items-baseline gap-2.5 ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                  <span className="text-[20px] font-bold tracking-tight text-[var(--status-success)] flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--status-success)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="16 10 11 15 8 12" />
                    </svg>
                    <span>{t('allClearedTitle')}</span>
                  </span>
                  <span className={`text-[13px] ${subText}`}>
                    {t('allClearedSub', { n: completed })}
                  </span>
                </div>
              ) : (
                <div className={`flex items-baseline gap-2.5 ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}>
                  <span className="text-[20px] font-bold tracking-tight">
                    {t('noDueTodayTitle')}
                  </span>
                  <span className={`text-[13px] ${subText}`}>{t('noDueTodaySub')}</span>
                </div>
              )}

              {/* Primary Action Button & Breakdown Pills — Unified Inline Action Flow */}
              <div className="flex items-center gap-3 flex-wrap pt-0.5">
                {isSyncPending ? (
                  <button
                    type="button"
                    disabled
                    className={`h-10 px-5 rounded-xl border font-medium text-[13px] flex items-center gap-2 cursor-wait ${
                      isDark ? 'bg-white/5 border-white/10 text-[#8E8E93]' : 'bg-black/5 border-black/10 text-[#8E8E93]'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--status-warning)]/30 border-t-[var(--status-warning)] animate-spin" />
                    <span>{isZh ? '云端对齐中...' : 'Syncing...'}</span>
                  </button>
                ) : totalPending > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => appActions.startReview(decks[0]?.id)}
                      style={{ backgroundColor: brandHex }}
                      className={`btn-primary !h-10 !px-6 ${
                        syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''
                      }`}
                    >
                      <span className="text-xs">▶</span>
                      <span>{t('startTodayStudy')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => appActions.startLowEnergySession(decks[0]?.id)}
                      className="btn-secondary !h-10 !px-3.5 text-[#8E8E93] hover:text-current flex items-center gap-1.5"
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
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAppState({ activeTab: 'library' })}
                    className={`btn-secondary !h-10 !px-5 ${
                      syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''
                    }`}
                  >
                    {resolvedLang === 'zh-CN' ? '浏览卡片库' : 'Browse Library'}
                  </button>
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
                      title={isZh ? '点击进入卡库查看待复习卡片' : 'View due cards in Library'}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 bg-[var(--brand-soft)] text-[var(--brand-text)] hover:opacity-85 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
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
                      title={isZh ? '点击进入卡库查看新卡片' : 'View new cards in Library'}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 bg-[var(--status-warning-soft)] text-[var(--status-warning)] hover:opacity-85 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--status-warning)]" />
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
                      title={isZh ? '点击进入卡库查看今日已完成卡片' : 'View cards completed today in Library'}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 bg-[var(--status-success-soft)] text-[var(--status-success)] hover:opacity-85 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--status-success)]" />
                      <span>{t('completedPill', { n: completed })}</span>
                    </button>

                    {dashboard.todayStats.dueReview >= 60 && (
                      <button
                        type="button"
                        onClick={() => appActions.openIcuModal('rescue')}
                        className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)] hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 17l6-6 4 4 8-8" />
                          <path d="M17 7h4v4" />
                        </svg>
                        <span>{isZh ? '进度减负' : 'Backlog Relief'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Clean, un-crammed Streak Details Card */}
        <div
          className={`shrink-0 pl-8 border-l ${
            isDark ? 'border-[#2A2C36]' : 'border-[#F0F0F5]'
          } flex flex-col justify-center text-right min-w-[140px] ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}
        >
          <div className="flex items-center justify-end gap-1.5">
            <span className={`text-[12px] ${subText}`}>{t('streakTitle')}</span>
            {isVacationActive && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                {isZh ? '已保护' : 'Frozen'}
              </span>
            )}
          </div>
          {isSyncPending ? (
            <div className="h-8 w-20 rounded-lg animate-skeleton-shimmer mt-1 self-end" />
          ) : (
            <div className="mt-1 flex items-baseline justify-end gap-1.5">
              <svg className="w-4.5 h-4.5 text-[var(--status-warning)] shrink-0 self-center" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 23c-4.97 0-9-3.8-9-8.5 0-3.35 2.1-6.7 4.54-9.37a1 1 0 0 1 1.48.06c.64.79 1.4 1.77 2.06 2.68.74-1.63 1.63-3.6 2.37-5.18a1 1 0 0 1 1.64-.22C17.7 5.07 21 9.9 21 14.5c0 4.7-4.03 8.5-9 8.5zm0-2c3.87 0 7-2.91 7-6.5 0-3.18-2.34-6.99-4.32-9.42-.48 1.15-1.09 2.53-1.68 3.75a1 1 0 0 1-1.68.22c-.88-1.2-1.74-2.35-2.43-3.23C7.2 7.74 5 10.87 5 14.5c0 3.59 3.13 6.5 7 6.5z" />
              </svg>
              <span className="text-[28px] font-bold leading-none">{dashboard.streak.current}</span>
              <span className={`text-[13px] ${subText}`}>{t('daysUnit')}</span>
            </div>
          )}
          <div className={`text-[11px] ${subText} mt-1.5`}>
            {t('streakSub', {
              longest: dashboard.streak.longest,
              active: dashboard.streak.weekActiveDays,
              total: dashboard.streak.weekTotalDays,
            })}
          </div>
        </div>
      </section>

      {/* Deck Cards Grid */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h2 className="text-[15px] font-bold">{t('myDecksTitle')}</h2>
            <span className={`text-[12px] ${subText}`}>
              {t('decksSummarySub', { top: topLevelDecks.length, total: decks.length })}
            </span>
            {isVacationActive && (
              <span className="text-[12px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--status-success-soft)] text-[var(--status-success)]">
                {isZh ? '享受你的假期 ^_^' : 'Enjoy your vacation ^_^'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {decks.length > topLevelDecks.length && (
              <button
                onClick={() =>
                  setAppState((prev) => ({ showAllDashboardDecks: !prev.showAllDashboardDecks }))
                }
                className="btn-ghost !text-[var(--brand-text)]"
              >
                {showAllDashboardDecks
                  ? t('showTopDecksOnly')
                  : t('expandAllDecks', { n: decks.length })}
              </button>
            )}
            <button
              onClick={() => appActions.setActiveTab('decks')}
              className="btn-ghost flex items-center gap-1"
            >
              <span>{t('allDecksManage')}</span>
              <span className="text-[10px] opacity-70">›</span>
            </button>
          </div>
        </div>

        {isSyncPending ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border p-5 h-[168px] flex flex-col justify-between ${cardSurface}`}
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl animate-skeleton-shimmer" />
                    <div className="space-y-2 flex-1">
                      <div className="w-24 h-4 rounded animate-skeleton-shimmer" />
                      <div className="w-16 h-3 rounded animate-skeleton-shimmer" />
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full animate-skeleton-shimmer mt-4" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
                  <div className="w-24 h-3 rounded animate-skeleton-shimmer" />
                  <div className="w-7 h-7 rounded-full animate-skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedDecks.length === 0 ? (
          <div className={`rounded-2xl border p-10 text-center space-y-3 ${cardSurface}`}>
            <div className="text-[15px] font-semibold">{t('noDecksTitle')}</div>
            <p className={`text-[12px] ${subText}`}>{t('noDecksSub')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedDecks.map((deck) => {
              const iconNode = deckIconMap[deck.accent] || deckIconMap.indigo;
              return (
                <div
                  key={deck.id}
                  onClick={() => appActions.startReview(deck.id)}
                  className={`group rounded-2xl border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-[var(--brand-border)] hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between ${cardSurface} ${
                    syncJustFinished ? 'animate-sync-reveal delay-stagger-2' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--brand-soft)] text-[var(--brand-text)] transition-colors">
                      {iconNode}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] truncate">{deck.name}</div>
                      <div className={`text-[11px] ${subText} mt-0.5 truncate`}>
                        {deck.totalCards.toLocaleString()} {t('cardsUnit')}
                        {deck.childrenCount > 0
                          ? t('subDecksCount', { n: deck.childrenCount })
                          : ''}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className={subText}>{t('masteryLabel')}</span>
                      <span className="font-semibold">{deck.mastery}%</span>
                    </div>
                    <div
                      className={`w-full h-1.5 rounded-full overflow-hidden ${
                        isDark ? 'bg-[#2A2C36]' : 'bg-[#ECECF2]'
                      }`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${deck.mastery}%`, backgroundColor: brandHex }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-between">
                    <span className={`text-[11px] ${subText}`}>
                      {t('dueReviewPill', { n: deck.dueReview })} ·{' '}
                      {deck.dueNew > 0 ? t('dueNewPill', { n: deck.dueNew }) : t('noNewCards')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        appActions.startReview(deck.id);
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--brand-soft)] text-[var(--brand-text)] group-hover:bg-[var(--brand)] group-hover:text-white transition-colors"
                    >
                      <svg className="w-3 h-3 fill-current ml-0.5" viewBox="0 0 24 24">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom Analytics Row: Activity Heatmap & Weekly Rhythm with Instant Floating Tooltips (Item #3) */}
      <section className="grid grid-cols-12 gap-4 pb-4">
        {/* Left: Heatmap */}
        <div
          className={`col-span-7 rounded-2xl border p-5 flex flex-col justify-between relative ${cardSurface} ${
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
                <div className="w-16 h-6 rounded-lg animate-skeleton-shimmer ml-auto" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[14px] font-bold">{t('heatmapTitle')}</h3>
                  <p className={`text-[11px] ${subText} mt-0.5`}>
                    {t('heatmapSub', { n: dashboard.heatmap.totalYearReviews.toLocaleString() })}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-[11px] ${subText}`}>
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
                {/* Item #3: Instant Frosted Floating Tooltip for Heatmap Cell */}
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
                          <span>{isZh ? '休假连胜冰冻保护中' : 'Streak Frozen (Vacation)'}</span>
                        </span>
                      ) : (
                        <>
                          <span style={{ color: accentScale.heatmap[1] }}>
                            {isZh
                              ? `共复习 ${hoveredHeatmapCell.count} 张卡片`
                              : `${hoveredHeatmapCell.count} cards reviewed`}
                          </span>
                          <span>·</span>
                          <span className="text-[var(--status-success)]">
                            {isZh
                              ? `正确率 ${hoveredHeatmapCell.accuracy}%`
                              : `${hoveredHeatmapCell.accuracy}% accuracy`}
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
                } flex items-center gap-8`}
              >
                <div>
                  <div className="text-[15px] font-bold">
                    {dashboard.heatmap.weekTotalCards} {t('cardsUnit')}
                  </div>
                  <div className={`text-[11px] ${subText}`}>{t('weekStudied')}</div>
                </div>
                <div>
                  <div className="text-[15px] font-bold">
                    {dashboard.heatmap.dailyAverage} {t('cardsUnit')}
                  </div>
                  <div className={`text-[11px] ${subText}`}>{t('dailyAvg')}</div>
                </div>
                <div>
                  <div className="text-[15px] font-bold">{dashboard.heatmap.retentionRate}%</div>
                  <div className={`text-[11px] ${subText}`}>{t('retentionRate')}</div>
                </div>
                <div className="ml-auto">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--brand-soft)] text-[var(--brand-text)]">
                    {dashboard.heatmap.wowChange}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Weekly Rhythm Bar Chart with Instant Floating Tooltip (Item #3) */}
        <div
          className={`col-span-5 rounded-2xl border p-5 flex flex-col justify-between relative ${cardSurface} ${
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
                  const dayPrefix = isZh ? `周${day.label}` : day.label;
                  const tooltipText = isZh
                    ? `${dayPrefix} · ${day.count} 张 (耗时 ${mins} 分钟)`
                    : `${dayPrefix} · ${day.count} cards (${mins}m)`;

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
