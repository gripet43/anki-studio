// ============================================================================
// Anki Studio — 进度减负 (Schedule Relief & Backlog Smoothing)
// Unified Studio Modal Spec (shared with VacationModal):
// 1. Clean Title + Semantic 2-Tablist [减负方案] / [减负记录]
// 2. Presets + Brand-Consistent Studio Range Slider Duration Control
// 3. Complete audit receipts & non-blocking inline undo inside History
// 4. Strict Undo Invariant: Only the most recent active relief (index 0) can undo
// ============================================================================

import React, { useEffect, useId, useRef, useState } from 'react';
import { usePresence } from '../../hooks/usePresence';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { Tooltip } from '../common/Tooltip';
import { translate } from '../../i18n/translations';
import { appActions, RescueReceipt, useAppStore } from '../../stores/useAppStore';
import { getAccentScale, resolveThemeMode } from '../../utils/themeTokens';
import { CheckGlyph, StudioDurationControl } from './StudioDurationControl';

export const IcuRescueModal: React.FC = () => {
  const store = useAppStore();
  const t = (key: any, params?: any) => translate(store.resolvedLang, key, params);
  const resolvedTheme = resolveThemeMode(store.theme, store.systemDark);
  const brandHex = getAccentScale(store.accentColor, resolvedTheme).brand;

  const backlog = store.dashboard.backlog;
  const totalDue = backlog?.totalDue || store.dashboard.todayStats.totalPending || 0;
  const rescueHistory: RescueReceipt[] = store.dashboard.rescueHistory || [];

  const [activeTab, setActiveTab] = useState<'rescue' | 'history'>(
    store.icuModalTab === 'history' ? 'history' : 'rescue'
  );

  const [mode, setMode] = useState<'amortize' | 'shift'>('amortize');
  const [days, setDays] = useState<number>(backlog?.suggestedDays || 7);
  const [sampleSearch, setSampleSearch] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const modalTitleId = useId();
  const rescueTabId = useId();
  const historyTabId = useId();
  const rescueTabRef = useRef<HTMLButtonElement>(null);
  const historyTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (store.icuModalTab === 'history') {
      setActiveTab('history');
    } else if (store.icuModalTab === 'rescue') {
      setActiveTab('rescue');
    }
    if (store.icuModalOpen && backlog?.suggestedDays) {
      setDays(Math.min(30, Math.max(2, backlog.suggestedDays)));
    }
    setConfirmUndoId(null);
  }, [store.icuModalTab, store.icuModalOpen, backlog?.suggestedDays]);

  const isAnyIcuOpen = Boolean(
    store.icuModalOpen || store.rescueModalOpen || store.receiptModalOpen
  );

  const panelRef = useDialogFocus({
    open: isAnyIcuOpen,
    confirmPending: Boolean(confirmUndoId),
    onDismissConfirm: () => setConfirmUndoId(null),
    onClose: () => appActions.closeIcuModal(),
  });

  const presence = usePresence(isAnyIcuOpen, 120);
  if (!presence.mounted) {
    return null;
  }

  const perDayEstimate = Math.ceil(totalDue / Math.max(1, days));

  const selectTab = (tab: 'rescue' | 'history') => {
    setActiveTab(tab);
    appActions.setIcuTab(tab);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, tab: 'rescue' | 'history') => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = tab === 'rescue' ? 'history' : 'rescue';
      selectTab(next);
      (next === 'rescue' ? rescueTabRef.current : historyTabRef.current)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectTab('rescue');
      rescueTabRef.current?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      selectTab('history');
      historyTabRef.current?.focus();
    }
  };

  const handleExecuteRescue = async () => {
    setIsSubmitting(true);
    try {
      await appActions.rescueBacklog({
        mode,
        days,
      });
      setActiveTab('history');
      setExpandedId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmUndo = async () => {
    setIsUndoing(true);
    try {
      await appActions.undoRescue();
      setConfirmUndoId(null);
    } finally {
      setIsUndoing(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div
      data-state={presence.state}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[5px] select-none ui-modal-backdrop modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        data-state={presence.state}
        className="w-full max-w-[560px] rounded-2xl border overflow-hidden ui-modal-panel vacation-modal-panel flex flex-col max-h-[86vh]"
      >
        {/* Header Bar with Accessible Segmented Tablist */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 vacation-modal-header shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
              <svg
                className="w-4.5 h-4.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2
                id={modalTitleId}
                className="text-[15px] font-bold tracking-tight text-balance truncate"
              >
                {t('backlogModalTitle')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ms-auto">
            {/* Accessible 2-Tab Segmented Switcher */}
            <div
              role="tablist"
              aria-label={t('backlogModalTitle')}
              {...({ focusgroup: 'tablist nomemory' } as any)}
              className="vacation-tablist"
            >
              <button
                ref={rescueTabRef}
                id={rescueTabId}
                type="button"
                role="tab"
                aria-selected={activeTab === 'rescue'}
                tabIndex={activeTab === 'rescue' ? 0 : -1}
                {...(activeTab === 'rescue' ? ({ focusgroupstart: '' } as any) : {})}
                onClick={() => selectTab('rescue')}
                onKeyDown={(e) => handleTabKeyDown(e, 'rescue')}
                className="vacation-tab"
              >
                {t('icuTabPlan')}
              </button>
              <button
                ref={historyTabRef}
                id={historyTabId}
                type="button"
                role="tab"
                aria-selected={activeTab === 'history'}
                tabIndex={activeTab === 'history' ? 0 : -1}
                {...(activeTab === 'history' ? ({ focusgroupstart: '' } as any) : {})}
                onClick={() => selectTab('history')}
                onKeyDown={(e) => handleTabKeyDown(e, 'history')}
                className="vacation-tab"
              >
                <span>{t('icuTabHistory')}</span>
                {rescueHistory.length > 0 && (
                  <span className="text-[10px] opacity-80 font-mono tabular-nums">
                    {rescueHistory.length}
                  </span>
                )}
              </button>
            </div>

            <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
              <button
                type="button"
                onClick={() => appActions.closeIcuModal()}
                className="vacation-close-btn"
                aria-label={t('close')}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <div
          role="tabpanel"
          aria-labelledby={activeTab === 'rescue' ? rescueTabId : historyTabId}
          className="p-5 space-y-3.5 vacation-modal-body flex-1"
        >
          {activeTab === 'rescue' ? (
            /* TAB 1: 减负方案 (SCHEDULE RELIEF PLAN) */
            <div className="space-y-3.5">
              {/* Tier 1: Before -> After Workload Impact Bar */}
              <div className="p-4 vacation-section-card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium text-[var(--text-secondary)]">
                    {t('icuCurrentDueCardsLabel')}
                  </div>
                  <div className="text-[20px] font-bold tracking-tight tabular-nums mt-0.5">
                    {totalDue}{' '}
                    <span className="text-[12px] font-normal text-[var(--text-secondary)]">
                      {t('cardsUnit')}
                    </span>
                  </div>
                </div>

                <svg
                  className="w-4 h-4 text-[var(--text-secondary)] opacity-70 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>

                <div className="text-end ms-auto">
                  <div className="text-[11px] font-medium text-[var(--text-secondary)] tabular-nums">
                    {mode === 'amortize'
                      ? t('icuSpreadOverDaysSub', { n: days })
                      : t('icuPostponedByDaysSub', { n: days })}
                  </div>
                  <div className="text-[17px] font-bold text-[var(--brand-text)] tabular-nums mt-0.5">
                    {mode === 'amortize'
                      ? t('icuPerDayAddEstimate', { n: perDayEstimate })
                      : t('icuZeroDueToday')}
                  </div>
                </div>
              </div>

              {/* Tier 2: Strategy Selection — Unified Choice Cards */}
              <fieldset className="vacation-duration-fieldset">
                <legend className="sr-only">{t('icuTabPlan')}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    aria-pressed={mode === 'amortize'}
                    onClick={() => setMode('amortize')}
                    className="vacation-choice-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[13px]">
                        {mode === 'amortize' && <CheckGlyph />}
                        <span>{t('amortizeOptionTitle')}</span>
                      </span>
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--brand-soft-strong)] text-[var(--brand-text)] font-semibold shrink-0">
                        {t('recommendedBadge')}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[var(--text-secondary)] mt-1.5 leading-relaxed text-pretty">
                      {t('amortizeOptionSub')}
                    </p>
                  </button>

                  <button
                    type="button"
                    aria-pressed={mode === 'shift'}
                    onClick={() => setMode('shift')}
                    className="vacation-choice-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[13px]">
                        {mode === 'shift' && <CheckGlyph />}
                        <span>{t('shiftOptionTitle')}</span>
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[var(--text-secondary)] mt-1.5 leading-relaxed text-pretty">
                      {t('shiftOptionSub')}
                    </p>
                  </button>
                </div>
              </fieldset>

              {/* Tier 3: Unified Studio Duration Control (Presets + Range Slider) */}
              <StudioDurationControl
                heading={mode === 'amortize' ? t('amortizeDaysLabel') : t('shiftDaysLabel')}
                badgeText={`${days} ${days === 1 ? t('dayUnitSingular') : t('daysUnit')}`}
                presetLegend={t('vacationPresetDaysLegend')}
                presets={[3, 5, 7, 14, 21]}
                presetsGridClassName="grid grid-cols-3 sm:grid-cols-5 gap-2"
                min={2}
                max={30}
                value={days}
                daysUnit={t('daysUnit')}
                singleDayUnit={t('dayUnitSingular')}
                onChange={setDays}
              />
            </div>
          ) : (
            /* TAB 2: 历史记录与存证详情 (HISTORY & AUDIT RECEIPTS) */
            <div>
              {rescueHistory.length === 0 ? (
                <div className="p-8 vacation-section-card text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center">
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div className="text-[13px] font-semibold">
                    {t('icuNoHistoryTitle')}
                  </div>
                  <p className="text-[11.5px] text-[var(--text-secondary)] text-pretty">
                    {t('icuNoHistorySub')}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3 m-0 p-0 list-none">
                  {rescueHistory.map((item, index) => {
                    const isLatest = index === 0;
                    const isUndone = item.status === 'undone' || item.canUndo === false;
                    const canUndoThisItem = isLatest && item.canUndo && !isUndone;
                    const isExpanded = expandedId === item.id;

                    const filteredSamples = (item.cardSamples || []).filter((s) =>
                      sampleSearch
                        ? s.front.toLowerCase().includes(sampleSearch.toLowerCase()) ||
                          s.deckName.toLowerCase().includes(sampleSearch.toLowerCase())
                        : true
                    );

                    return (
                      <li
                        key={item.id}
                        className="vacation-section-card overflow-hidden"
                      >
                        {/* Record Header Summary */}
                        <div className="p-4 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="text-[13px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
                                {item.timestamp}
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary)]">
                                {item.mode === 'amortize'
                                  ? t('icuDistributedSummary', {
                                      count: item.rescheduledCount,
                                      days: item.days,
                                    })
                                  : t('icuShiftedSummary', {
                                      count: item.rescheduledCount,
                                      days: item.days,
                                    })}
                                {' · '}
                                <span className="font-mono">ID: {item.id}</span>
                              </div>
                            </div>

                            {/* Right Status Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {canUndoThisItem ? (
                                confirmUndoId !== item.id ? (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmUndoId(item.id)}
                                    className="min-h-8 px-2.5 rounded-lg border border-[var(--status-danger)]/40 text-[var(--status-danger-text)] hover:bg-[var(--status-danger-soft)] text-[11px] font-semibold cursor-pointer transition-colors shrink-0"
                                  >
                                    {t('icuUndoReliefBtn')}
                                  </button>
                                ) : null
                              ) : (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-black/[0.06] dark:bg-white/10 text-[var(--text-secondary)] font-medium">
                                  {item.status === 'undone'
                                    ? t('statusReverted')
                                    : t('statusArchived')}
                                </span>
                              )}

                              {/* Expand/Collapse Toggle */}
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                onClick={() => toggleExpand(item.id)}
                                className="min-h-8 px-2 rounded-lg text-[11px] text-[var(--brand-text)] hover:underline font-semibold cursor-pointer shrink-0 inline-flex items-center gap-1"
                              >
                                <span>{isExpanded ? t('collapseLabel') : t('inspectLabel')}</span>
                                <svg
                                  className={`w-3.5 h-3.5 transition-transform ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Inline Undo Confirmation (Only on latest item) */}
                          {confirmUndoId === item.id && canUndoThisItem && (
                            <div
                              role="region"
                              aria-live="polite"
                              className="p-3 rounded-lg bg-[var(--status-danger-soft)] border border-[var(--status-danger)]/35 flex flex-wrap items-center justify-between gap-3"
                            >
                              <span className="text-[11.5px] text-[var(--status-danger-text)] font-semibold">
                                {t('icuConfirmUndoPrompt')}
                              </span>
                              <div className="flex items-center gap-2 shrink-0 ms-auto">
                                <button
                                  type="button"
                                  onClick={() => setConfirmUndoId(null)}
                                  disabled={isUndoing}
                                  className="min-h-8 px-3 rounded-lg text-[11.5px] font-medium border border-black/15 dark:border-white/15 bg-white dark:bg-white/5 cursor-pointer"
                                >
                                  {t('cancel')}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleConfirmUndo}
                                  disabled={isUndoing}
                                  className="min-h-8 px-3 rounded-lg text-[11.5px] bg-[var(--status-danger)] text-white font-semibold cursor-pointer"
                                >
                                  {isUndoing ? t('processingText') : t('confirm')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Expandable Audit Receipt Body */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 space-y-3.5 border-t border-black/5 dark:border-white/8">
                            {/* 3-Metric Integrity Strip */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                              <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04]">
                                <span className="text-[var(--text-secondary)]">
                                  {t('icuTotalCardsLabel')}
                                </span>
                                <span className="font-mono tabular-nums font-semibold text-[var(--status-success-text)]">
                                  {item.totalCardsAfter.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04]">
                                <span className="text-[var(--text-secondary)]">
                                  {t('icuLostCheckLabel')}
                                </span>
                                <span
                                  className={`font-mono tabular-nums font-semibold ${
                                    (item.lostCards ?? 0) > 0
                                      ? 'text-[var(--status-danger-text)]'
                                      : 'text-[var(--status-success-text)]'
                                  }`}
                                >
                                  {(item.lostCards ?? 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04]">
                                <span className="text-[var(--text-secondary)]">
                                  {t('icuRescheduledCountLabel')}
                                </span>
                                <span className="font-mono tabular-nums font-semibold text-[var(--brand-text)]">
                                  {(item.rescheduledCount ?? 0).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Future Day-by-Day Distribution Bars */}
                            <div className="space-y-2 pt-1">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                                <span className="font-semibold">
                                  {t('icuDayDistributionTitle', { days: item.days })}
                                </span>
                                <span className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                                  {t('icuPerDayAddEstimate', {
                                    n: Math.ceil(item.rescheduledCount / Math.max(1, item.days)),
                                  })}
                                </span>
                              </div>

                              <div className="space-y-1.5 max-h-40 overflow-y-auto pe-1">
                                {(item.dayDistribution || []).map((day) => {
                                  const maxCount = Math.max(
                                    ...(item.dayDistribution || []).map((d) => d.count),
                                    1
                                  );
                                  const pct = Math.min(100, Math.round((day.count / maxCount) * 100));

                                  return (
                                    <div
                                      key={day.dayOffset}
                                      className="flex items-center gap-3 text-[11px]"
                                    >
                                      <span className="w-24 shrink-0 text-[var(--text-secondary)] tabular-nums truncate">
                                        {day.dateLabel}
                                      </span>
                                      <div className="flex-1 h-2 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all duration-300"
                                          style={{
                                            width: `${pct}%`,
                                            backgroundColor: brandHex,
                                          }}
                                        />
                                      </div>
                                      <span className="w-12 shrink-0 text-end font-mono tabular-nums font-semibold">
                                        +{day.count}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Progressive Disclosure (<details>/<summary>) for Sample Cards */}
                            <details className="rounded-xl border border-black/10 dark:border-white/10 vacation-safeguards-details text-[12px]">
                              <summary className="vacation-safeguards-summary !px-3.5 !py-2.5">
                                <span className="font-medium text-[var(--text-primary)] truncate">
                                  {t('icuInspectCardSamplesSummary', {
                                    n: (item.cardSamples || []).length,
                                  })}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--brand-text)] font-semibold shrink-0">
                                  <span>{t('inspectLabel')}</span>
                                  <svg
                                    className="vacation-safeguards-chevron"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </span>
                              </summary>

                              <div className="vacation-safeguards-list !px-3.5 !pb-3 space-y-2">
                                <input
                                  type="text"
                                  aria-label={t('icuFilterSamplesPlaceholder')}
                                  placeholder={t('icuFilterSamplesPlaceholder')}
                                  value={sampleSearch}
                                  onChange={(e) => setSampleSearch(e.target.value)}
                                  className="w-full min-h-8 text-[11.5px] px-2.5 rounded-lg border border-black/12 dark:border-white/12 bg-white dark:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--brand-text)]"
                                />

                                <div className="max-h-32 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 text-[11px]">
                                  {filteredSamples.length === 0 ? (
                                    <div className="py-2.5 text-center text-[var(--text-secondary)]">
                                      {t('icuNoMatchingSamples')}
                                    </div>
                                  ) : (
                                    filteredSamples.map((card) => (
                                      <div
                                        key={card.id}
                                        className="py-1.5 flex items-center justify-between gap-3"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="font-medium truncate">{card.front}</div>
                                          <div className="text-[10.5px] text-[var(--text-secondary)] truncate">
                                            {card.deckName} · {card.intervalDays} {t('daysUnit')}
                                          </div>
                                        </div>
                                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] font-mono tabular-nums text-[10.5px]">
                                          {card.newDueDate} (+{card.dayOffset} {t('daysUnit')})
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </details>

                            {/* Historical notice for superseded records */}
                            {!isLatest && (
                              <div className="text-[11px] text-[var(--text-secondary)] pt-1">
                                {t('icuHistoricalRecordNote')}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 vacation-modal-footer shrink-0">
          <span className="vacation-footer-hint min-w-0 flex-1 basis-[220px]">
            {activeTab === 'rescue' && totalDue === 0
              ? t('icuZeroDueToday')
              : t('icuFooterRescueHint')}
          </span>

          <div className="flex items-center justify-end gap-2 shrink-0 ms-auto">
            <button
              type="button"
              onClick={() => appActions.closeIcuModal()}
              className="btn-secondary vacation-action-btn !px-3.5 !text-[12px]"
            >
              {t('close')}
            </button>

            {activeTab === 'rescue' && (
              <button
                type="button"
                onClick={handleExecuteRescue}
                disabled={isSubmitting || totalDue === 0}
                style={{ backgroundColor: brandHex }}
                className="btn-primary vacation-action-btn !px-4 !text-[12px]"
              >
                {isSubmitting
                  ? t('processingText')
                  : `${t('executeRescueBtn')} (${days} ${t('daysUnit')})`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
