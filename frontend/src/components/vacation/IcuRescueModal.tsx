// ============================================================================
// Anki Modern OS — 进度减负 (Schedule Relief & Backlog Smoothing)
// Design Spec:
// 1. Clean Title: "进度减负" without subtitle explanation.
// 2. 2-Tab Hierarchy: [减负方案] and [历史记录].
// 3. Complete audit receipts and evidence details are contained inside History.
// 4. Strict Undo Invariant: Only the most recent relief (index 0) can be undone.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { translate } from '../../i18n/translations';
import { appActions, RescueReceipt, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const IcuRescueModal: React.FC = () => {
  const store = useAppStore();
  const isZh = store.resolvedLang === 'zh-CN';
  const t = (key: any, params?: any) => translate(store.resolvedLang, key, params);
  const brandHex = getAccentScale(store.accentColor, store.theme).brand;

  const backlog = store.dashboard.backlog;
  const totalDue = backlog?.totalDue || store.dashboard.todayStats.totalPending || 0;
  const rescueHistory: RescueReceipt[] = store.dashboard.rescueHistory || [];
  const latestReceipt: RescueReceipt | null =
    rescueHistory.length > 0
      ? rescueHistory[0]
      : store.currentRescueReceipt || store.dashboard.lastRescueReceipt || null;

  // Tabs: only 2 tabs now ("rescue" = 减负方案, "history" = 历史记录)
  const [activeTab, setActiveTab] = useState<'rescue' | 'history'>(
    store.icuModalTab === 'history' || (totalDue === 0 && rescueHistory.length > 0)
      ? 'history'
      : 'rescue'
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

  if (!store.icuModalOpen && !store.rescueModalOpen && !store.receiptModalOpen) {
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
      const res = await appActions.rescueBacklog({
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

  // Whether the latest relief can be undone
  const canUndoLatest = Boolean(
    rescueHistory.length > 0 &&
      rescueHistory[0].canUndo &&
      rescueHistory[0].status !== 'undone'
  );

  return (
    <div
      onClick={() => appActions.closeIcuModal()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[5px] select-none modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-labelledby="icu-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[560px] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.32)] overflow-hidden transition-all duration-200 flex flex-col max-h-[86vh] ${modalBg}`}
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
                {isZh ? '减负方案' : 'Plan'}
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
                <span>{isZh ? '历史记录' : 'History'}</span>
                {rescueHistory.length > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">
                    {rescueHistory.length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => appActions.closeIcuModal()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-current hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer transition-colors"
              aria-label="关闭"
            >
              ✕
            </button>
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
                    {isZh ? '当前待复习卡片' : 'Current Due Cards'}
                  </div>
                  <div className="text-[20px] font-bold tracking-tight mt-0.5">
                    {totalDue}{' '}
                    <span className="text-[12px] font-normal text-[#8E8E93]">
                      {isZh ? '张' : 'cards'}
                    </span>
                  </div>
                </div>

                <div className="text-[#8E8E93] opacity-50 text-base">→</div>

                <div className="text-right">
                  <div className="text-[11px] text-[#8E8E93]">
                    {mode === 'amortize'
                      ? isZh
                        ? `平摊至未来 ${days} 天后`
                        : `Spread over ${days} days`
                      : isZh
                      ? `整体推迟 ${days} 天后`
                      : `Postponed by ${days} days`}
                  </div>
                  <div className="text-[18px] font-bold text-[var(--brand-text)] mt-0.5">
                    {mode === 'amortize'
                      ? isZh
                        ? `日均 +${perDayEstimate} 张`
                        : `~${perDayEstimate} / day`
                      : isZh
                      ? '今日待办清零'
                      : '0 due today'}
                  </div>
                </div>
              </div>

              {/* Tier 2: Strategy Selection */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode('amortize')}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    mode === 'amortize'
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-2xs ring-1 ring-[var(--brand)]'
                      : `${cardSurface} hover:border-[var(--brand-border)]`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[13px]">{t('amortizeOptionTitle')}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-soft-strong)] text-[var(--brand-text)] font-semibold">
                      {isZh ? '推荐' : 'Best'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8E8E93] mt-1.5 leading-relaxed">
                    {t('amortizeOptionSub')}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('shift')}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
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
                    {mode === 'amortize'
                      ? t('amortizeDaysLabel')
                      : isZh
                      ? '顺延天数'
                      : 'Shift Days'}
                  </span>
                  <span className="font-mono font-semibold text-[var(--brand-text)]">
                    {days} {isZh ? '天' : 'days'}
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
                      {d} {isZh ? '天' : 'd'}
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
                    {isZh ? '暂无历史减负记录' : 'No history records'}
                  </div>
                  <p className="text-[11px] text-[#8E8E93]">
                    {isZh
                      ? '执行积压平摊后，所有存证排布明细与撤销入口将保存在此处。'
                      : 'Past schedule smoothing operations and verification receipts will be listed here.'}
                  </p>
                </div>
              ) : (
                rescueHistory.map((item, index) => {
                  const isLatest = index === 0;
                  const isUndone = item.status === 'undone' || item.canUndo === false;
                  // Only the latest entry (index 0) is permitted to undo!
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
                                ? isZh
                                  ? `已平摊 ${item.rescheduledCount} 张卡片至未来 ${item.days} 天`
                                  : `Distributed ${item.rescheduledCount} cards over ${item.days} days`
                                : isZh
                                ? `已顺延 ${item.rescheduledCount} 张卡片 ${item.days} 天`
                                : `Shifted ${item.rescheduledCount} cards by ${item.days} days`}
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
                                  title={isZh ? '撤销最近一次减负操作' : 'Undo recent relief'}
                                >
                                  {isZh ? (item.mode === 'shift' ? '撤销顺延' : '撤销平摊') : 'Undo'}
                                </button>
                              ) : null
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#8E8E93]">
                                {item.status === 'undone'
                                  ? isZh
                                    ? '已撤销'
                                    : 'Reverted'
                                  : isZh
                                  ? '已归档'
                                  : 'Archived'}
                              </span>
                            )}

                            {/* Expand/Collapse Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleExpand(item.id)}
                              className="text-[11px] text-[var(--brand-text)] hover:underline font-medium cursor-pointer shrink-0 ml-1"
                            >
                              {isExpanded ? (isZh ? '收起 ▴' : 'Collapse ▴') : isZh ? '详情 ▾' : 'Inspect ▾'}
                            </button>
                          </div>
                        </div>

                        {/* Inline Undo Confirmation (Only on latest item) */}
                        {confirmUndoId === item.id && canUndoThisItem && (
                          <div className="p-3 rounded-lg bg-[var(--status-danger-soft)] border border-[var(--status-danger)]/25 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                            <span className="text-[11px] text-[var(--status-danger)] font-medium">
                              {isZh
                                ? '确认撤销最近一次减负？所有卡片将原样退回今日待复习队列。'
                                : 'Restore all rescheduled cards back to today?'}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setConfirmUndoId(null)}
                                disabled={isUndoing}
                                className="px-2.5 py-1 rounded-md text-[11px] border border-black/10 dark:border-white/10 cursor-pointer"
                              >
                                {isZh ? '取消' : 'Cancel'}
                              </button>
                              <button
                                type="button"
                                onClick={handleConfirmUndo}
                                disabled={isUndoing}
                                className="px-2.5 py-1 rounded-md text-[11px] bg-[var(--status-danger)] text-white font-semibold cursor-pointer"
                              >
                                {isUndoing
                                  ? isZh
                                    ? '撤销中...'
                                    : 'Undoing...'
                                  : isZh
                                  ? '确认撤销'
                                  : 'Confirm'}
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
                              <span className="text-[#8E8E93]">{isZh ? '卡片总数' : 'Total'}</span>
                              <span className="font-mono font-semibold text-[var(--status-success)]">
                                {item.totalCardsAfter.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.03]">
                              <span className="text-[#8E8E93]">{isZh ? '丢失校验' : 'Lost'}</span>
                              <span className="font-mono font-semibold text-[var(--status-success)]">
                                0
                              </span>
                            </div>
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.03]">
                              <span className="text-[#8E8E93]">
                                {isZh ? '记忆间隔' : 'Intervals'}
                              </span>
                              <span className="font-mono font-semibold text-[var(--brand-text)]">
                                100%
                              </span>
                            </div>
                          </div>

                          {/* Future Day-by-Day Distribution Bars */}
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between text-[12px]">
                              <span className="font-semibold">
                                {isZh
                                  ? `未来 ${item.days} 天每日排布`
                                  : `${item.days}-Day Distribution`}
                              </span>
                              <span className="text-[11px] text-[#8E8E93] font-mono">
                                ~{Math.ceil(item.rescheduledCount / Math.max(1, item.days))}{' '}
                                {isZh ? '张/天' : '/ day'}
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {item.dayDistribution.map((day) => {
                                const maxCount = Math.max(
                                  ...item.dayDistribution.map((d) => d.count),
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
                                    <span className="w-12 shrink-0 text-right font-mono font-semibold">
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
                                {isZh
                                  ? `查看顺延卡片抽检明细 (${(item.cardSamples || []).length} 张样本)`
                                  : `Inspect card samples (${(item.cardSamples || []).length})`}
                              </span>
                              <span className="text-[11px] text-[var(--brand-text)] font-medium">
                                {isZh ? '展开 ▾' : 'Expand ▾'}
                              </span>
                            </summary>

                            <div className="pt-2.5 mt-2.5 border-t border-black/5 dark:border-white/6 space-y-2">
                              <input
                                type="text"
                                placeholder={isZh ? '筛选抽检卡片或牌组...' : 'Filter samples...'}
                                value={sampleSearch}
                                onChange={(e) => setSampleSearch(e.target.value)}
                                className="w-full h-7 text-[11px] px-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent focus:outline-none focus:border-[var(--brand)]"
                              />

                              <div className="max-h-32 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 text-[11px]">
                                {filteredSamples.length === 0 ? (
                                  <div className="py-2.5 text-center text-[#8E8E93]">
                                    {isZh ? '无匹配样本' : 'No matching samples'}
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
                                          {card.deckName} ·{' '}
                                          {isZh
                                            ? `原间隔 ${card.intervalDays}天`
                                            : `ivl ${card.intervalDays}d`}
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
                              {isZh
                                ? 'ℹ️ 此记录为历史减负存证（根据状态依赖原则，仅最近一次减负支持撤销回退）。'
                                : 'ℹ️ Historical record (only the most recent relief can be undone).'}
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
        <footer className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-black/5 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.015] shrink-0">
          <span className="text-[11px] text-[#8E8E93]">
            {activeTab === 'rescue'
              ? isZh
                ? '执行后将自动生成可逆存证并归档'
                : 'Creates a reversible receipt upon execution'
              : isZh
              ? '所有操作均保留 100% 原始卡片与间隔数据'
              : '100% of card data and intervals are preserved'}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => appActions.closeIcuModal()}
              className="btn-secondary !h-9 !px-4 !text-[12px]"
            >
              {isZh ? '关闭' : 'Close'}
            </button>

            {activeTab === 'rescue' && (
              <button
                type="button"
                onClick={handleExecuteRescue}
                disabled={isSubmitting || totalDue === 0}
                style={{ backgroundColor: brandHex }}
                className="btn-primary !h-9 !px-5 !text-[12px]"
              >
                {isSubmitting
                  ? isZh
                    ? '正在重排...'
                    : 'Applying...'
                  : mode === 'amortize'
                  ? isZh
                    ? `平摊至 ${days} 天`
                    : `Distribute (${days}d)`
                  : isZh
                  ? `顺延 ${days} 天`
                  : `Postpone (${days}d)`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
