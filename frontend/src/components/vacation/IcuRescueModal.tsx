// ============================================================================
// Anki Studio — 进度减负 (Schedule Relief & Backlog Smoothing)
// Design Spec:
// 1. Clean Title: "进度减负" without subtitle explanation.
// 2. 2-Tab Hierarchy: [减负方案] and [历史记录].
// 3. Complete audit receipts and evidence details are contained inside History.
// 4. Strict Undo Invariant: Only the most recent relief (index 0) can be undone.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { usePresence } from '../../hooks/usePresence';
import { Tooltip } from '../common/Tooltip';
import { translate } from '../../i18n/translations';
import { appActions, RescueReceipt, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const IcuRescueModal: React.FC = () => {
  const store = useAppStore();
  const t = (key: any, params?: any) => translate(store.resolvedLang, key, params);
  const brandHex = getAccentScale(store.accentColor, store.theme).brand;

  const backlog = store.dashboard.backlog;
  const totalDue = backlog?.totalDue || store.dashboard.todayStats.totalPending || 0;
  const rescueHistory: RescueReceipt[] = store.dashboard.rescueHistory || [];

  // Tabs: only 2 tabs now ("rescue" = 减负方案, "history" = 历史记录)
  const [activeTab, setActiveTab] = useState<'rescue' | 'history'>(
    store.icuModalTab === 'history' ? 'history' : 'rescue'
  );

  const [mode, setMode] = useState<'amortize' | 'shift'>('amortize');
  const [days, setDays] = useState<number>(backlog?.suggestedDays || 7);
  const [sampleSearch, setSampleSearch] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);

  // Expanded receipt ID in History tab (defaults to null - collapsed by default)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (store.icuModalTab === 'history') {
      setActiveTab('history');
    } else if (store.icuModalTab === 'rescue') {
      setActiveTab('rescue');
    }
    setConfirmUndoId(null);
  }, [store.icuModalTab, store.icuModalOpen]);

  useEffect(() => {
    if (!store.icuModalOpen && !store.rescueModalOpen && !store.receiptModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmUndoId) {
          setConfirmUndoId(null);
        } else {
          appActions.closeIcuModal();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store.icuModalOpen, store.rescueModalOpen, store.receiptModalOpen, confirmUndoId]);

  const isAnyIcuOpen = Boolean(
    store.icuModalOpen || store.rescueModalOpen || store.receiptModalOpen
  );
  const presence = usePresence(isAnyIcuOpen, 120);
  if (!presence.mounted) {
    return null;
  }

  const isDark = store.theme === 'dark' || store.theme === 'oled';
  const modalBg =
    store.theme === 'oled'
      ? 'bg-[#101115] border-[#242630] text-[#F4F4F6]'
      : isDark
      ? 'bg-[#181920] border-[#2C2E3A] text-[#F2F3F7]'
      : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#1D1D1F]';

  const cardSurface =
    store.theme === 'oled'
      ? 'bg-[#15161C] border-[#242630]'
      : isDark
      ? 'bg-[#1F212A] border-[#2E303D]'
      : 'bg-[#F9F9FB] border-[#ECECF2]';

  const perDayEstimate = Math.ceil(totalDue / Math.max(1, days));

  const handleExecuteRescue = async () => {
    setIsSubmitting(true);
    try {
      await appActions.rescueBacklog({
        mode,
        days,
      });
      // After relief execution, automatically switch to History (collapsed by default)
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
      aria-labelledby="icu-modal-title"
    >
      <div
        data-state={presence.state}
        className={`w-full max-w-[560px] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.32)] overflow-hidden ui-modal-panel flex flex-col max-h-[86vh] ${modalBg}`}
      >
        {/* Header Bar — Clean Title without Subtitle */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/8 shrink-0 gap-3">
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
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="icu-modal-title" className="text-[15px] font-bold tracking-tight truncate">
                {t('backlogModalTitle')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 2-Segment Control: [减负方案] and [历史记录] */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/6 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('rescue');
                  appActions.setIcuTab('rescue');
                }}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'rescue'
                    ? 'bg-white dark:bg-[#2A2C38] text-current shadow-2xs font-semibold'
                    : 'text-[#8E8E93] hover:text-current'
                }`}
              >
                {t('icuTabPlan')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  appActions.setIcuTab('history');
                }}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-[#2A2C38] text-current shadow-2xs font-semibold'
                    : 'text-[#8E8E93] hover:text-current'
                }`}
              >
                <span>{t('vacationTabHistory')}</span>
                {rescueHistory.length > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">
                    {rescueHistory.length}
                  </span>
                )}
              </button>
            </div>

            <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
              <button
                type="button"
                onClick={() => appActions.closeIcuModal()}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-current hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer transition-colors"
                aria-label={t('close')}
              >
                ✕
              </button>
            </Tooltip>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'rescue' ? (
            /* TAB 1: 减负方案 (SCHEDULE RELIEF PLAN) */
            <div className="space-y-4">
              {/* Tier 1: Before -> After Workload Impact Bar */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${cardSurface}`}
              >
                <div>
                  <div className="text-[11px] text-[#8E8E93]">
                    {t('icuCurrentDueCardsLabel')}
                  </div>
                  <div className="text-[20px] font-bold tracking-tight mt-0.5">
                    {totalDue}{' '}
                    <span className="text-[12px] font-normal text-[#8E8E93]">
                      {t('cardsUnit')}
                    </span>
                  </div>
                </div>

                <div className="text-[#8E8E93] opacity-50 text-base">→</div>

                <div className="text-end">
                  <div className="text-[11px] text-[#8E8E93]">
                    {mode === 'amortize'
                      ? t('icuSpreadOverDaysSub', { n: days })
                      : t('icuPostponedByDaysSub', { n: days })}
                  </div>
                  <div className="text-[18px] font-bold text-[var(--brand-text)] mt-0.5">
                    {mode === 'amortize'
                      ? t('icuPerDayAddEstimate', { n: perDayEstimate })
                      : t('icuZeroDueToday')}
                  </div>
                </div>
              </div>

              {/* Tier 2: Strategy Selection */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode('amortize')}
                  className={`p-3.5 rounded-xl border text-start cursor-pointer transition-all ${
                    mode === 'amortize'
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-2xs ring-1 ring-[var(--brand)]'
                      : `${cardSurface} hover:border-[var(--brand-border)]`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[13px]">{t('amortizeOptionTitle')}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-soft-strong)] text-[var(--brand-text)] font-semibold">
                      {t('recommendedBadge')}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8E8E93] mt-1.5 leading-relaxed">
                    {t('amortizeOptionSub')}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('shift')}
                  className={`p-3.5 rounded-xl border text-start cursor-pointer transition-all ${
                    mode === 'shift'
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-2xs ring-1 ring-[var(--brand)]'
                      : `${cardSurface} hover:border-[var(--brand-border)]`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[13px]">{t('shiftOptionTitle')}</span>
                  </div>
                  <p className="text-[11px] text-[#8E8E93] mt-1.5 leading-relaxed">
                    {t('shiftOptionSub')}
                  </p>
                </button>
              </div>

              {/* Tier 3: Distribution Window Controls */}
              <div className={`p-4 rounded-xl border space-y-3 ${cardSurface}`}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold">
                    {mode === 'amortize' ? t('amortizeDaysLabel') : t('shiftDaysLabel')}
                  </span>
                  <span className="font-mono font-semibold text-[var(--brand-text)]">
                    {days} {t('daysUnit')}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[3, 5, 7, 14, 21].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`py-1.5 text-[12px] font-medium rounded-lg border transition-all cursor-pointer ${
                        days === d
                          ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                          : 'border-black/8 dark:border-white/10 hover:border-[var(--brand-border)]'
                      }`}
                    >
                      {d} {t('daysUnit')}
                    </button>
                  ))}
                </div>

                <div className="pt-1 flex items-center gap-3">
                  <span className="text-[10px] text-[#8E8E93] font-mono">2d</span>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value, 10))}
                    className="flex-1 cursor-pointer"
                  />
                  <span className="text-[10px] text-[#8E8E93] font-mono">30d</span>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: 历史记录与存证详情 (HISTORY & AUDIT RECEIPTS) */
            <div className="space-y-3">
              {rescueHistory.length === 0 ? (
                <div className={`p-8 rounded-xl border text-center space-y-1.5 ${cardSurface}`}>
                  <div className="text-[13px] font-semibold">
                    {t('icuNoHistoryTitle')}
                  </div>
                  <p className="text-[11px] text-[#8E8E93]">
                    {t('icuNoHistorySub')}
                  </p>
                </div>
              ) : (
                rescueHistory.map((item, index) => {
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
                    <div
                      key={item.id}
                      className={`rounded-xl border transition-all ${cardSurface} overflow-hidden`}
                    >
                      {/* Record Header Summary */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="text-[13px] font-bold font-mono text-current">
                              {item.timestamp}
                            </div>
                            <div className="text-[11px] text-[#8E8E93]">
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
                              <span className="font-mono opacity-80">ID: {item.id}</span>
                            </div>
                          </div>

                          {/* Right Status Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {canUndoThisItem ? (
                              confirmUndoId !== item.id ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirmUndoId(item.id)}
                                  className="h-7 px-2.5 rounded-lg border border-[var(--status-danger)]/35 text-[var(--status-danger)] hover:bg-[var(--status-danger-soft)] text-[11px] font-medium cursor-pointer transition-colors shrink-0"
                                >
                                  {t('icuUndoReliefBtn')}
                                </button>
                              ) : null
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#8E8E93]">
                                {item.status === 'undone'
                                  ? t('statusReverted')
                                  : t('statusArchived')}
                              </span>
                            )}

                            {/* Expand/Collapse Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleExpand(item.id)}
                              className="text-[11px] text-[var(--brand-text)] hover:underline font-medium cursor-pointer shrink-0 ms-1"
                            >
                              {isExpanded ? `${t('collapseLabel')} ▴` : `${t('inspectLabel')} ▾`}
                            </button>
                          </div>
                        </div>

                        {/* Inline Undo Confirmation (Only on latest item) */}
                        {confirmUndoId === item.id && canUndoThisItem && (
                          <div className="p-3 rounded-lg bg-[var(--status-danger-soft)] border border-[var(--status-danger)]/25 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                            <span className="text-[11px] text-[var(--status-danger)] font-medium">
                              {t('icuConfirmUndoPrompt')}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setConfirmUndoId(null)}
                                disabled={isUndoing}
                                className="px-2.5 py-1 rounded-md text-[11px] border border-black/10 dark:border-white/10 cursor-pointer"
                              >
                                {t('cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={handleConfirmUndo}
                                disabled={isUndoing}
                                className="px-2.5 py-1 rounded-md text-[11px] bg-[var(--status-danger)] text-white font-semibold cursor-pointer"
                              >
                                {isUndoing ? t('processingText') : t('confirm')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expandable Audit Receipt Body */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 space-y-3.5 border-t border-black/5 dark:border-white/6">
                          {/* 3-Metric Integrity Strip */}
                          <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.03]">
                              <span className="text-[#8E8E93]">{t('icuTotalCardsLabel')}</span>
                              <span className="font-mono font-semibold text-[var(--status-success)]">
                                {item.totalCardsAfter.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.03]">
                              <span className="text-[#8E8E93]">{t('icuLostCheckLabel')}</span>
                              <span
                                className={`font-mono font-semibold ${
                                  (item.lostCards ?? 0) > 0
                                    ? 'text-[var(--status-danger)]'
                                    : 'text-[var(--status-success)]'
                                }`}
                              >
                                {(item.lostCards ?? 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.03]">
                              <span className="text-[#8E8E93]">
                                {t('icuRescheduledCountLabel')}
                              </span>
                              <span className="font-mono font-semibold text-[var(--brand-text)]">
                                {(item.rescheduledCount ?? 0).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Future Day-by-Day Distribution Bars */}
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between text-[12px]">
                              <span className="font-semibold">
                                {t('icuDayDistributionTitle', { days: item.days })}
                              </span>
                              <span className="text-[11px] text-[#8E8E93] font-mono">
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
                                    <span className="w-24 shrink-0 text-[#8E8E93] truncate">
                                      {day.dateLabel}
                                    </span>
                                    <div className="flex-1 h-2 rounded-full bg-black/5 dark:bg-white/8 overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                          width: `${pct}%`,
                                          backgroundColor: brandHex,
                                        }}
                                      />
                                    </div>
                                    <span className="w-12 shrink-0 text-end font-mono font-semibold">
                                      +{day.count}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Progressive Disclosure (<details>/<summary>) for Sample Cards */}
                          <details className="rounded-xl border border-black/8 dark:border-white/8 px-3.5 py-2.5 text-[12px] group">
                            <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                              <span className="font-medium text-[#8E8E93] group-hover:text-current transition-colors">
                                {t('icuInspectCardSamplesSummary', {
                                  n: (item.cardSamples || []).length,
                                })}
                              </span>
                              <span className="text-[11px] text-[var(--brand-text)] font-medium">
                                {t('inspectLabel')} ▾
                              </span>
                            </summary>

                            <div className="pt-2.5 mt-2.5 border-t border-black/5 dark:border-white/6 space-y-2">
                              <input
                                type="text"
                                placeholder={t('icuFilterSamplesPlaceholder')}
                                value={sampleSearch}
                                onChange={(e) => setSampleSearch(e.target.value)}
                                className="w-full h-7 text-[11px] px-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent focus:outline-none focus:border-[var(--brand)]"
                              />

                              <div className="max-h-32 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 text-[11px]">
                                {filteredSamples.length === 0 ? (
                                  <div className="py-2.5 text-center text-[#8E8E93]">
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
                                        <div className="text-[10px] text-[#8E8E93] truncate">
                                          {card.deckName} · ivl {card.intervalDays}d
                                        </div>
                                      </div>
                                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] font-mono text-[10px]">
                                        {card.newDueDate} (+{card.dayOffset}d)
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </details>

                          {/* Historical notice for superseded records */}
                          {!isLatest && (
                            <div className="text-[10px] text-[#8E8E93] pt-1">
                              {t('icuHistoricalRecordNote')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-black/5 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.015] shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => appActions.closeIcuModal()}
              className="btn-secondary !h-9 !px-4 !text-[12px] whitespace-nowrap shrink-0"
            >
              {t('close')}
            </button>

            {activeTab === 'rescue' && (
              <button
                type="button"
                onClick={handleExecuteRescue}
                disabled={isSubmitting || totalDue === 0}
                style={{ backgroundColor: brandHex }}
                className="btn-primary !h-9 !px-5 !text-[12px] whitespace-nowrap shrink-0"
              >
                {isSubmitting ? t('processingText') : `${t('executeRescueBtn')} (${days}d)`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
