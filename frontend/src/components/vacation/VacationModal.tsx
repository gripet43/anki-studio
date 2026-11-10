// ============================================================================
// Anki Modern OS — Vacation & Streak Protection Modal
// Redesigned with Modern Web Guidance: semantic <details>/<summary> progressive
// disclosure, non-blocking inline confirmations, crisp SVG iconography, and
// a calm, 3-tier studio information hierarchy.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { translate } from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const VacationModal: React.FC = () => {
  const store = useAppStore();
  const isZh = store.resolvedLang === 'zh-CN';
  const t = (key: any, params?: any) => translate(store.resolvedLang, key, params);
  const brandHex = getAccentScale(store.accentColor, store.theme).brand;

  const vacation = store.dashboard.vacation;
  const isAlreadyActive = Boolean(vacation?.isActive);
  const vacationHistory = store.dashboard.vacationHistory || [];

  const [activeTab, setActiveTab] = useState<'status' | 'history'>(
    store.vacationModalTab || 'status'
  );
  const [days, setDays] = useState<number>(3);
  const [reason, setReason] = useState<string>('身心休整');
  const [freezeNewCards, setFreezeNewCards] = useState<boolean>(true);
  const [shiftReviewCards, setShiftReviewCards] = useState<boolean>(true);
  const [freezeStreak, setFreezeStreak] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<'end' | 'cancel' | null>(null);

  useEffect(() => {
    if (store.vacationModalTab) {
      setActiveTab(store.vacationModalTab);
    }
    setConfirmAction(null);
  }, [store.vacationModalTab, store.vacationModalOpen]);

  useEffect(() => {
    if (!store.vacationModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmAction) {
          setConfirmAction(null);
        } else {
          appActions.closeVacationModal();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store.vacationModalOpen, confirmAction]);

  const dateRangePreview = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + Math.max(1, days) - 1);
    const fmt = (d: Date) =>
      isZh ? `${d.getMonth() + 1}月${d.getDate()}日` : `${d.getMonth() + 1}/${d.getDate()}`;
    return `${fmt(start)} – ${fmt(end)}`;
  }, [days, isZh]);

  if (!store.vacationModalOpen) return null;

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

  const durationPresets = [1, 3, 7, 14];
  const reasonPresets = ['身心休整', '临时值班', '差旅出行', '备考冲刺'];

  const enabledRulesCount =
    (freezeNewCards ? 1 : 0) + (shiftReviewCards ? 1 : 0) + (freezeStreak ? 1 : 0);

  const handleStartVacation = async () => {
    setIsSubmitting(true);
    try {
      await appActions.setVacation({
        days,
        reason,
        freezeNewCards,
        shiftReviewCards,
        freezeStreak,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmEndVacation = async () => {
    setIsSubmitting(true);
    try {
      await appActions.endVacation();
      setConfirmAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancelVacation = async () => {
    setIsSubmitting(true);
    try {
      await appActions.cancelVacation();
      setConfirmAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={() => appActions.closeVacationModal()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[5px] select-none modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vacation-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[500px] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.32)] overflow-hidden transition-all duration-200 flex flex-col max-h-[85vh] ${modalBg}`}
      >
        {/* Header Bar with Integrated Segmented Switcher */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/8 shrink-0">
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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="10" y1="14" x2="10" y2="18" />
                <line x1="14" y1="14" x2="14" y2="18" />
              </svg>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2 id="vacation-modal-title" className="text-[15px] font-bold tracking-tight truncate">
                {t('vacationModalTitle')}
              </h2>
              {isAlreadyActive && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--status-success-soft)] text-[var(--status-success)]">
                  {isZh ? `剩 ${vacation?.remainingDays} 天` : `${vacation?.remainingDays}d left`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Compact 2-Tab Segmented Pill */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/6 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('status');
                  appActions.setVacationTab('status');
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'status'
                    ? 'bg-white dark:bg-[#2A2C38] text-current shadow-2xs font-semibold'
                    : 'text-[#8E8E93] hover:text-current'
                }`}
              >
                {isAlreadyActive ? (isZh ? '当前状态' : 'Status') : isZh ? '休假设置' : 'Setup'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  appActions.setVacationTab('history');
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-[#2A2C38] text-current shadow-2xs font-semibold'
                    : 'text-[#8E8E93] hover:text-current'
                }`}
              >
                <span>{isZh ? '历史' : 'History'}</span>
                {vacationHistory.length > 0 && (
                  <span className="text-[10px] opacity-70 font-mono">
                    {vacationHistory.length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => appActions.closeVacationModal()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-current hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer transition-colors"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'status' ? (
            isAlreadyActive ? (
              /* ACTIVE VACATION VIEW — Serene, Clear & Reversible */
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border ${cardSurface} space-y-3.5`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[var(--status-success)] font-semibold text-[13px]">
                      <span className="w-2 h-2 rounded-full bg-[var(--status-success)]" />
                      <span>
                        {isZh
                          ? `休假保护生效中 · ${vacation?.reason || '身心休整'}`
                          : `Vacation Active · ${vacation?.reason || 'Rest'}`}
                      </span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--status-success-soft)] text-[var(--status-success)] font-semibold font-mono">
                      {isZh ? `剩余 ${vacation?.remainingDays} 天` : `${vacation?.remainingDays}d left`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                    <div className="p-3 rounded-lg bg-black/[0.03] dark:bg-white/[0.03] space-y-0.5">
                      <span className="text-[11px] text-[#8E8E93]">
                        {isZh ? '起止日期' : 'Date Range'}
                      </span>
                      <div className="font-semibold font-mono text-[12px]">
                        {vacation?.startDate} → {vacation?.endDate}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/[0.03] dark:bg-white/[0.03] space-y-0.5">
                      <span className="text-[11px] text-[#8E8E93]">
                        {isZh ? '生效规则' : 'Active Safeguards'}
                      </span>
                      <div className="font-semibold text-[12px]">
                        {isZh ? '新卡暂停 · 连胜已冻结' : 'New Paused · Streak Frozen'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Non-blocking Inline Confirmation or Action Cards */}
                {confirmAction ? (
                  <div
                    className={`p-4 rounded-xl border space-y-3 animate-in fade-in duration-150 ${
                      confirmAction === 'cancel'
                        ? 'bg-[var(--status-danger-soft)] border-[var(--status-danger)]/30'
                        : 'bg-[var(--brand-soft)] border-[var(--brand-border)]'
                    }`}
                  >
                    <div className="text-[13px] font-semibold">
                      {confirmAction === 'end'
                        ? isZh
                          ? '确认提前结束休假并恢复每日学习限额？'
                          : 'End vacation early and resume daily limits?'
                        : isZh
                        ? '确认撤销本次休假并将顺延卡片退回今日队列？'
                        : 'Cancel vacation and return postponed cards to today?'}
                    </div>
                    <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                      {confirmAction === 'end'
                        ? isZh
                          ? '已顺延的卡片日程保持不变，从今天起恢复正常每日新卡投放。'
                          : 'Postponed cards remain on their new schedule, and daily new cards resume.'
                        : isZh
                        ? '适合误触开启休假时使用：所有被推迟的卡片将立即原样恢复至今日待复习。'
                        : 'All postponed cards will be immediately restored back to today.'}
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setConfirmAction(null)}
                        disabled={isSubmitting}
                        className="btn-secondary !h-8 !px-3 !text-[12px]"
                      >
                        {isZh ? '返回' : 'Back'}
                      </button>
                      <button
                        type="button"
                        onClick={
                          confirmAction === 'end'
                            ? handleConfirmEndVacation
                            : handleConfirmCancelVacation
                        }
                        disabled={isSubmitting}
                        className={`h-8 px-3.5 rounded-xl text-white text-[12px] font-semibold cursor-pointer transition-opacity ${
                          confirmAction === 'cancel'
                            ? 'bg-[var(--status-danger)]'
                            : 'bg-[var(--brand)]'
                        }`}
                      >
                        {isSubmitting
                          ? isZh
                            ? '处理中...'
                            : 'Processing...'
                          : isZh
                          ? '确认执行'
                          : 'Confirm'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setConfirmAction('end')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer hover:border-[var(--brand-border)] ${cardSurface}`}
                    >
                      <div className="text-[12px] font-semibold text-[var(--brand-text)]">
                        {isZh ? '提前结束休假 (销假)' : 'End Vacation Early'}
                      </div>
                      <p className="text-[11px] text-[#8E8E93] mt-1 leading-snug">
                        {isZh ? '恢复正常新卡限额，保留顺延排期' : 'Resume daily limits'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmAction('cancel')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer hover:border-[var(--status-danger)]/40 ${cardSurface}`}
                    >
                      <div className="text-[12px] font-semibold text-[var(--status-danger)]">
                        {isZh ? '撤销本次休假 (回退)' : 'Revert Vacation'}
                      </div>
                      <p className="text-[11px] text-[#8E8E93] mt-1 leading-snug">
                        {isZh ? '误触一键撤回，卡片退回今日队列' : 'Restore shifted cards to today'}
                      </p>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* SETUP NEW VACATION — 3-Tier Clean Studio Hierarchy */
              <div className="space-y-4">
                {/* Tier 1: Duration Selector & Live Date Span */}
                <div className={`p-4 rounded-xl border space-y-3 ${cardSurface}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">
                      {t('vacationDurationLabel')}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)] font-medium">
                      {dateRangePreview}
                    </span>
                  </div>

                  {/* 4 Preset Pills + Stepper */}
                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-4 gap-1.5 flex-1">
                      {durationPresets.map((d) => {
                        const active = days === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDays(d)}
                            className={`h-8 rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${
                              active
                                ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                                : 'border-black/8 dark:border-white/10 hover:border-[var(--brand-border)]'
                            }`}
                          >
                            {d} {isZh ? '天' : 'd'}
                          </button>
                        );
                      })}
                    </div>

                    {/* Fine-tune Stepper (- / N / +) */}
                    <div className="flex items-center h-8 rounded-lg border border-black/10 dark:border-white/10 px-1 bg-black/[0.02] dark:bg-white/[0.02]">
                      <button
                        type="button"
                        onClick={() => setDays((prev) => Math.max(1, prev - 1))}
                        className="w-6 h-6 rounded text-xs text-[#8E8E93] hover:text-current cursor-pointer"
                        title="-1"
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-[12px] font-mono font-semibold">
                        {days}d
                      </span>
                      <button
                        type="button"
                        onClick={() => setDays((prev) => Math.min(30, prev + 1))}
                        className="w-6 h-6 rounded text-xs text-[#8E8E93] hover:text-current cursor-pointer"
                        title="+1"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tier 2: Compact Note / Reason Tags */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${cardSurface}`}>
                  <div className="text-[12px] font-semibold">{t('vacationReasonLabel')}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {reasonPresets.map((r) => {
                      const active = reason === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={`py-1.5 px-2 text-[11px] rounded-lg border transition-all cursor-pointer truncate ${
                            active
                              ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                              : 'border-black/8 dark:border-white/10 text-[#8E8E93] hover:text-current'
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tier 3: Progressive Disclosure (<details>/<summary>) for Safeguard Rules */}
                <details className={`rounded-xl border px-4 py-3 text-[12px] group ${cardSurface}`}>
                  <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[var(--status-success)] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span className="font-medium">
                        {isZh
                          ? `已启用 ${enabledRulesCount} 项保护：暂停新卡 · 顺延复习 · 冻结连胜`
                          : `${enabledRulesCount} safeguards active: Pause new · Shift due · Freeze streak`}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--brand-text)] font-medium group-open:underline">
                      {isZh ? '调整' : 'Customize'}
                    </span>
                  </summary>

                  <div className="pt-3 mt-3 border-t border-black/5 dark:border-white/6 space-y-2 text-[12px] text-[#8E8E93]">
                    <label className="flex items-center justify-between cursor-pointer py-0.5 hover:text-current">
                      <span>{t('freezeNewCardsLabel')}（假期新卡上限设为 0）</span>
                      <input
                        type="checkbox"
                        checked={freezeNewCards}
                        onChange={(e) => setFreezeNewCards(e.target.checked)}
                        className="rounded w-4 h-4 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer py-0.5 hover:text-current">
                      <span>{t('shiftReviewCardsLabel')}（避免归来首日卡片堆积）</span>
                      <input
                        type="checkbox"
                        checked={shiftReviewCards}
                        onChange={(e) => setShiftReviewCards(e.target.checked)}
                        className="rounded w-4 h-4 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer py-0.5 hover:text-current">
                      <span>{t('freezeStreakLabel')}（热力图标记冰冻不断签）</span>
                      <input
                        type="checkbox"
                        checked={freezeStreak}
                        onChange={(e) => setFreezeStreak(e.target.checked)}
                        className="rounded w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </details>
              </div>
            )
          ) : (
            /* HISTORY TAB — Clean & Scannable */
            <div className="space-y-2.5">
              {vacationHistory.length === 0 ? (
                <div className={`p-8 rounded-xl border text-center space-y-1.5 ${cardSurface}`}>
                  <div className="text-[13px] font-semibold">
                    {isZh ? '暂无历史休假记录' : 'No vacation history yet'}
                  </div>
                  <p className="text-[11px] text-[#8E8E93]">
                    {isZh
                      ? '开启休假后，系统会自动记录每次休假区间与顺延卡片数量。'
                      : 'Past vacation periods and shifted card counts will appear here.'}
                  </p>
                </div>
              ) : (
                vacationHistory.map((item) => {
                  const statusStyle =
                    item.status === 'active'
                      ? 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                      : item.status === 'cancelled'
                      ? 'bg-[var(--status-danger-soft)] text-[var(--status-danger)]'
                      : item.status === 'ended_early'
                      ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                      : 'bg-black/5 dark:bg-white/10 text-[#8E8E93]';

                  const statusLabel =
                    item.status === 'active'
                      ? isZh
                        ? '进行中'
                        : 'Active'
                      : item.status === 'cancelled'
                      ? isZh
                        ? '已撤销'
                        : 'Reverted'
                      : item.status === 'ended_early'
                      ? isZh
                        ? '提前结束'
                        : 'Ended Early'
                      : isZh
                      ? '已完成'
                      : 'Completed';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${cardSurface}`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[12px] truncate">
                            {item.reason} · {item.days} {isZh ? '天' : 'd'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyle}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#8E8E93] font-mono">
                          {item.startDate} → {item.endDate}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {item.shiftedCardCount !== undefined && item.shiftedCardCount > 0 && (
                          <div className="text-[11px] font-medium text-[var(--brand-text)]">
                            {isZh ? `顺延 ${item.shiftedCardCount} 张` : `${item.shiftedCardCount} shifted`}
                          </div>
                        )}
                        <div className="text-[10px] text-[#8E8E93] font-mono mt-0.5">
                          {item.createdAt}
                        </div>
                      </div>
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
            {isAlreadyActive
              ? isZh
                ? '随时可提前结束或一键撤销回退'
                : 'End early or revert anytime'
              : isZh
              ? '自动同步至 AnkiWeb，不损伤 FSRS 记忆间隔'
              : 'Preserves 100% of FSRS memory intervals'}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => appActions.closeVacationModal()}
              className="btn-secondary !h-9 !px-4 !text-[12px]"
              disabled={isSubmitting}
            >
              {isAlreadyActive ? (isZh ? '关闭' : 'Close') : isZh ? '取消' : 'Cancel'}
            </button>

            {!isAlreadyActive && activeTab === 'status' && (
              <button
                type="button"
                onClick={handleStartVacation}
                disabled={isSubmitting}
                style={{ backgroundColor: brandHex }}
                className="btn-primary !h-9 !px-5 !text-[12px]"
              >
                {isSubmitting
                  ? isZh
                    ? '开启中...'
                    : 'Starting...'
                  : isZh
                  ? `开启休假 (${days} 天)`
                  : `Start Vacation (${days}d)`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
