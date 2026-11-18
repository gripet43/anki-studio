// ============================================================================
// Anki Studio — Vacation & Streak Protection Modal
// Redesigned with Modern Web Guidance: semantic <details>/<summary> progressive
// disclosure, non-blocking inline confirmations, crisp SVG iconography, and
// a calm, 3-tier studio information hierarchy.
// ============================================================================

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePresence } from '../../hooks/usePresence';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { Tooltip } from '../common/Tooltip';
import { translate } from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { getAccentScale, resolveThemeMode } from '../../utils/themeTokens';
import { CheckGlyph, StudioDurationControl } from './StudioDurationControl';

export const VacationModal: React.FC = () => {
  const store = useAppStore();
  const t = (key: any, params?: any) => translate(store.resolvedLang, key, params);
  const resolvedTheme = resolveThemeMode(store.theme, store.systemDark);
  const brandHex = getAccentScale(store.accentColor, resolvedTheme).brand;
  const supportsNativeSwitch =
    typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;

  const vacation = store.dashboard.vacation;
  const isAlreadyActive = Boolean(vacation?.isActive);
  const vacationHistory = store.dashboard.vacationHistory || [];

  const [activeTab, setActiveTab] = useState<'status' | 'history'>(
    store.vacationModalTab || 'status'
  );
  const [days, setDays] = useState<number>(3);
  const modalTitleId = useId();
  const statusTabId = useId();
  const historyTabId = useId();
  const freezeNewSwitchId = useId();
  const shiftReviewSwitchId = useId();
  const freezeStreakSwitchId = useId();
  const statusTabRef = useRef<HTMLButtonElement>(null);
  const historyTabRef = useRef<HTMLButtonElement>(null);
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

  const panelRef = useDialogFocus({
    open: store.vacationModalOpen,
    confirmPending: Boolean(confirmAction),
    onDismissConfirm: () => setConfirmAction(null),
    onClose: () => appActions.closeVacationModal(),
  });

  const dateRangePreview = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + Math.max(1, days) - 1);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${fmt(start)} – ${fmt(end)}`;
  }, [days]);

  const presence = usePresence(store.vacationModalOpen, 120);
  if (!presence.mounted) return null;

  const selectTab = (tab: 'status' | 'history') => {
    setActiveTab(tab);
    appActions.setVacationTab(tab);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, tab: 'status' | 'history') => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = tab === 'status' ? 'history' : 'status';
      selectTab(next);
      (next === 'status' ? statusTabRef.current : historyTabRef.current)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectTab('status');
      statusTabRef.current?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      selectTab('history');
      historyTabRef.current?.focus();
    }
  };

  const safeguardItems = [
    {
      id: freezeNewSwitchId,
      checked: freezeNewCards,
      label: t('freezeNewCardsLabel'),
      onToggle: () => setFreezeNewCards((v) => !v),
    },
    {
      id: shiftReviewSwitchId,
      checked: shiftReviewCards,
      label: t('shiftReviewCardsLabel'),
      onToggle: () => setShiftReviewCards((v) => !v),
    },
    {
      id: freezeStreakSwitchId,
      checked: freezeStreak,
      label: t('freezeStreakLabel'),
      onToggle: () => setFreezeStreak((v) => !v),
    },
  ];

  const durationPresets = [1, 3, 7, 14];
  const reasonPresets: Array<{ raw: string; labelKey: string }> = [
    { raw: '身心休整', labelKey: 'vacationReasonRest' },
    { raw: '临时值班', labelKey: 'vacationReasonShift' },
    { raw: '差旅出行', labelKey: 'vacationReasonTrip' },
    { raw: '备考冲刺', labelKey: 'vacationReasonExam' },
  ];

  const localizeReason = (rawReason?: string) => {
    const matched = reasonPresets.find((r) => r.raw === rawReason);
    if (matched) return t(matched.labelKey);
    return rawReason || t('vacationReasonRest');
  };

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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="10" y1="14" x2="10" y2="18" />
                <line x1="14" y1="14" x2="14" y2="18" />
              </svg>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2
                id={modalTitleId}
                className="text-[15px] font-bold tracking-tight text-balance truncate"
              >
                {t('vacationModalTitle')}
              </h2>
              {isAlreadyActive && (
                <span className="text-[10.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-[var(--status-success-soft)] text-[var(--status-success-text)]">
                  {t('vacationRemainingDays', { n: vacation?.remainingDays ?? 0 })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ms-auto">
            {/* Accessible 2-Tab Segmented Switcher */}
            <div
              role="tablist"
              aria-label={t('vacationModalTitle')}
              {...({ focusgroup: 'tablist nomemory' } as any)}
              className="vacation-tablist"
            >
              <button
                ref={statusTabRef}
                id={statusTabId}
                type="button"
                role="tab"
                aria-selected={activeTab === 'status'}
                tabIndex={activeTab === 'status' ? 0 : -1}
                {...(activeTab === 'status' ? ({ focusgroupstart: '' } as any) : {})}
                onClick={() => selectTab('status')}
                onKeyDown={(e) => handleTabKeyDown(e, 'status')}
                className="vacation-tab"
              >
                {isAlreadyActive ? t('vacationTabStatus') : t('vacationTabSetup')}
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
                <span>{t('vacationTabHistory')}</span>
                {vacationHistory.length > 0 && (
                  <span className="text-[10px] opacity-80 font-mono tabular-nums">
                    {vacationHistory.length}
                  </span>
                )}
              </button>
            </div>

            <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
              <button
                type="button"
                onClick={() => appActions.closeVacationModal()}
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

        {/* Body */}
        <div
          role="tabpanel"
          aria-labelledby={activeTab === 'status' ? statusTabId : historyTabId}
          className="p-5 space-y-3.5 vacation-modal-body flex-1"
        >
          {activeTab === 'status' ? (
            isAlreadyActive ? (
              /* ACTIVE VACATION VIEW — Serene, Clear & Reversible */
              <div className="space-y-3.5">
                <div className="p-4 vacation-section-card space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[var(--status-success-text)] font-semibold text-[13px]">
                      <span className="w-2 h-2 rounded-full bg-[var(--status-success)] shrink-0" aria-hidden="true" />
                      <span>
                        {t('vacationActiveStatusBanner', {
                          reason: localizeReason(vacation?.reason),
                        })}
                      </span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--status-success-soft)] text-[var(--status-success-text)] font-semibold font-mono tabular-nums">
                      {t('vacationRemainingDays', { n: vacation?.remainingDays ?? 0 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12px]">
                    <div className="p-3 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] space-y-0.5">
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {t('vacationDateRangeLabel')}
                      </span>
                      <div className="font-semibold font-mono tabular-nums text-[12px]">
                        {vacation?.startDate} → {vacation?.endDate}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] space-y-0.5">
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {t('vacationSafeguardsLabel')}
                      </span>
                      <div className="font-semibold text-[12px]">
                        {t('vacationSafeguardsSummary')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Non-blocking Inline Confirmation or Action Cards */}
                {confirmAction ? (
                  <div
                    role="region"
                    aria-live="polite"
                    className={`p-4 rounded-xl border space-y-3 ${
                      confirmAction === 'cancel'
                        ? 'bg-[var(--status-danger-soft)] border-[var(--status-danger)]/35'
                        : 'bg-[var(--brand-soft)] border-[var(--brand-border)]'
                    }`}
                  >
                    <div className="text-[13px] font-semibold">
                      {confirmAction === 'end'
                        ? t('vacationConfirmEndTitle')
                        : t('vacationConfirmCancelTitle')}
                    </div>
                    <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed text-pretty">
                      {confirmAction === 'end'
                        ? t('vacationConfirmEndSub')
                        : t('vacationConfirmCancelSub')}
                    </p>
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setConfirmAction(null)}
                        disabled={isSubmitting}
                        className="btn-secondary vacation-action-btn !px-3.5 !text-[12px]"
                      >
                        {t('backBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={
                          confirmAction === 'end'
                            ? handleConfirmEndVacation
                            : handleConfirmCancelVacation
                        }
                        disabled={isSubmitting}
                        className={`vacation-action-btn px-4 rounded-xl text-white text-[12px] font-semibold cursor-pointer transition-opacity ${
                          confirmAction === 'cancel'
                            ? 'bg-[var(--status-danger)]'
                            : 'bg-[var(--brand)]'
                        }`}
                      >
                        {isSubmitting ? t('processingText') : t('confirm')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setConfirmAction('end')}
                      className="p-3.5 vacation-section-card vacation-action-btn whitespace-normal! text-start cursor-pointer hover:border-[var(--brand-border)]"
                    >
                      <div className="text-[12px] font-semibold text-[var(--brand-text)]">
                        {t('endVacationBtn')}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-snug text-pretty">
                        {t('vacationEndEarlySub')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmAction('cancel')}
                      className="p-3.5 vacation-section-card vacation-action-btn whitespace-normal! text-start cursor-pointer hover:border-[var(--status-danger)]/45"
                    >
                      <div className="text-[12px] font-semibold text-[var(--status-danger-text)]">
                        {t('vacationRevertBtn')}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-snug text-pretty">
                        {t('vacationRevertSub')}
                      </p>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* SETUP NEW VACATION — 3-Tier Clean Studio Hierarchy */
              <div className="space-y-3.5">
                {/* Tier 1: Duration Selector (Presets + Studio Range Slider) */}
                <StudioDurationControl
                  heading={t('vacationDurationLabel')}
                  badgeText={`${days} ${days === 1 ? t('dayUnitSingular') : t('daysUnit')} · ${dateRangePreview}`}
                  presetLegend={t('vacationPresetDaysLegend')}
                  presets={durationPresets}
                  presetsGridClassName="grid grid-cols-2 sm:grid-cols-4 gap-2"
                  min={1}
                  max={30}
                  value={days}
                  daysUnit={t('daysUnit')}
                  singleDayUnit={t('dayUnitSingular')}
                  onChange={setDays}
                />

                {/* Tier 2: Note / Reason Tags — Unified Fieldset & Keycap Contrast */}
                <div className="p-4 vacation-section-card flex flex-col gap-2.5">
                  <div className="text-[12.5px] font-semibold">{t('vacationReasonLabel')}</div>
                  <fieldset className="vacation-duration-fieldset">
                    <legend className="sr-only">{t('vacationReasonLabel')}</legend>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {reasonPresets.map((r) => {
                        const active = reason === r.raw;
                        return (
                          <button
                            key={r.raw}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setReason(r.raw)}
                            className="vacation-preset-btn"
                          >
                            {active && <CheckGlyph />}
                            <span>{t(r.labelKey)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>

                {/* Tier 3: Progressive Disclosure (<details>/<summary>) with Accessible Switches */}
                <details className="vacation-section-card vacation-safeguards-details text-[12px]">
                  <summary className="vacation-safeguards-summary">
                    <span className="flex items-center gap-2 min-w-0">
                      <svg
                        className="w-4 h-4 text-[var(--status-success-text)] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {t('vacationSafeguardsCountSummary', { n: enabledRulesCount })}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-text)] shrink-0">
                      <span>{t('customizeLabel')}</span>
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

                  <div className="vacation-safeguards-list">
                    {safeguardItems.map((item) => (
                      <div key={item.id} className="vacation-safeguard-row">
                        <label htmlFor={item.id} className="min-w-0 flex-1 cursor-pointer">
                          {item.label}
                        </label>
                        <input
                          id={item.id}
                          type="checkbox"
                          checked={item.checked}
                          onChange={item.onToggle}
                          {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                          {...(supportsNativeSwitch
                            ? {}
                            : { role: 'switch', 'aria-checked': item.checked })}
                          data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                          className="anki-switch anki-switch-sm shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )
          ) : (
            /* HISTORY TAB — Semantic List & High-Contrast Metadata */
            <div>
              {vacationHistory.length === 0 ? (
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
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div className="text-[13px] font-semibold">
                    {t('vacationNoHistoryTitle')}
                  </div>
                  <p className="text-[11.5px] text-[var(--text-secondary)] text-pretty">
                    {t('vacationNoHistorySub')}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5 m-0 p-0 list-none">
                  {vacationHistory.map((item) => {
                    const statusStyle =
                      item.status === 'active'
                        ? 'bg-[var(--status-success-soft)] text-[var(--status-success-text)]'
                        : item.status === 'cancelled'
                        ? 'bg-[var(--status-danger-soft)] text-[var(--status-danger-text)]'
                        : item.status === 'ended_early'
                        ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                        : 'bg-black/[0.06] dark:bg-white/10 text-[var(--text-secondary)]';

                    const dotColor =
                      item.status === 'active'
                        ? 'bg-[var(--status-success)]'
                        : item.status === 'cancelled'
                        ? 'bg-[var(--status-danger)]'
                        : item.status === 'ended_early'
                        ? 'bg-[var(--brand)]'
                        : 'bg-current opacity-60';

                    const statusLabel =
                      item.status === 'active'
                        ? t('statusActive')
                        : item.status === 'cancelled'
                        ? t('statusReverted')
                        : item.status === 'ended_early'
                        ? t('statusEndedEarly')
                        : t('statusCompleted');

                    return (
                      <li
                        key={item.id}
                        className="p-3.5 vacation-section-card flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[12.5px] truncate tabular-nums">
                              {localizeReason(item.reason)} · {item.days} {t('daysUnit')}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${statusStyle}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                                aria-hidden="true"
                              />
                              <span>{statusLabel}</span>
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] font-mono tabular-nums">
                            {item.startDate} → {item.endDate}
                          </div>
                        </div>

                        <div className="text-end shrink-0 ms-auto">
                          {item.shiftedCardCount !== undefined && item.shiftedCardCount > 0 && (
                            <div className="text-[11px] font-semibold text-[var(--brand-text)] tabular-nums">
                              {t('vacationShiftedCountBadge', { n: item.shiftedCardCount })}
                            </div>
                          )}
                          <div className="text-[10.5px] text-[var(--text-secondary)] font-mono tabular-nums mt-0.5">
                            {item.createdAt}
                          </div>
                        </div>
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
            {isAlreadyActive ? t('vacationFooterActiveHint') : t('vacationFooterSetupHint')}
          </span>

          <div className="flex items-center justify-end gap-2 shrink-0 ms-auto">
            <button
              type="button"
              onClick={() => appActions.closeVacationModal()}
              className="btn-secondary vacation-action-btn !px-3.5 !text-[12px]"
              disabled={isSubmitting}
            >
              {isAlreadyActive ? t('close') : t('cancel')}
            </button>

            {!isAlreadyActive && activeTab === 'status' && (
              <button
                type="button"
                onClick={handleStartVacation}
                disabled={isSubmitting}
                style={{ backgroundColor: brandHex }}
                className="btn-primary vacation-action-btn !px-4 !text-[12px]"
              >
                {isSubmitting
                  ? t('processingText')
                  : `${t('startVacationBtn')} (${days} ${days === 1 ? t('dayUnitSingular') : t('daysUnit')})`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
