import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePresence } from '../../hooks/usePresence';
import { translate, type TranslationKey } from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import {
  ANKIWEB_ADDON_URL,
  openExternalUrl,
  resolveFeedbackChannel,
} from '../../utils/supportPrompt';
import { CheckIcon, CloseIcon } from './Icons';

type PromptStage = 'ask' | 'like' | 'confirming' | 'feedback' | 'thanks';
type PromptVariant = 'default' | 'return_ask' | 'feedback_return';
type DialogCloseReason = '' | 'snoozed' | 'opted_out' | 'opened_unconfirmed' | 'feedback' | 'done';

let supportsDisplayTransitionCache: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (supportsDisplayTransitionCache !== undefined) {
    return supportsDisplayTransitionCache;
  }
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  // Intentional shorthand: browsers without allow-discrete drop the rule so display:none applies immediately.
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  window.getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransitionCache = window.getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransitionCache;
}

function supportsTopLayerExit(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
    canTransitionDisplay()
  );
}

const BackArrowIcon: React.FC = () => (
  <svg
    className="w-4 h-4 shrink-0 rtl:scale-x-[-1]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ExternalArrowIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    className={`shrink-0 opacity-85 rtl:scale-x-[-1] ${className}`.trim()}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </svg>
);

const renderWithRateBadge = (template: string): React.ReactNode => {
  const marker = '{btn}';
  const idx = template.indexOf(marker);
  if (idx === -1) return template;
  const before = template.slice(0, idx);
  const after = template.slice(idx + marker.length);
  return (
    <>
      {before}
      <span dir="ltr" className="support-rate-inline-badge">
        Rate This
      </span>
      {after}
    </>
  );
};

export const SupportPromptModal: React.FC = () => {
  const {
    supportPromptModalOpen,
    supportPromptModalTestMode,
    supportPrompt,
    resolvedLang,
    customNickname,
    dashboard,
  } = useAppStore();

  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const resolveInitialVariant = useCallback((): PromptVariant => {
    if (!supportPromptModalTestMode && supportPrompt.status === 'opened_unconfirmed') {
      return 'return_ask';
    }
    if (!supportPromptModalTestMode && supportPrompt.status === 'feedback') {
      return 'feedback_return';
    }
    return 'default';
  }, [supportPromptModalTestMode, supportPrompt.status]);

  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const [stage, setStage] = useState<PromptStage>('ask');
  const [promptVariant, setPromptVariant] = useState<PromptVariant>(resolveInitialVariant);
  const stageRef = useRef<PromptStage>(stage);
  const wasOpenRef = useRef(false);
  const prevStageRef = useRef<PromptStage>('ask');
  const recordedOpenedRef = useRef(false);

  stageRef.current = stage;

  const presence = usePresence(supportPromptModalOpen, 220);

  const closeDialogTopLayer = useCallback(
    (dialog: HTMLDialogElement | null, returnValue: DialogCloseReason = '') => {
      if (!dialog || !dialog.open) {
        if (returnValue === 'opted_out') {
          appActions.recordSupportPromptOutcome('opted_out');
        } else if (returnValue === 'feedback') {
          appActions.recordSupportPromptOutcome('feedback');
        } else if (returnValue === 'opened_unconfirmed') {
          appActions.recordSupportPromptOutcome('opened_unconfirmed');
        } else if (returnValue === 'snoozed') {
          appActions.recordSupportPromptOutcome('snoozed');
        }
        appActions.closeSupportPromptModal();
        return;
      }

      if (supportsTopLayerExit()) {
        dialog.close(returnValue);
        return;
      }

      if ('closing' in dialog.dataset) return;
      dialog.dataset.closing = '';
      const animations =
        typeof dialog.getAnimations === 'function'
          ? dialog.getAnimations({ subtree: true }).map((anim) => anim.finished)
          : [];
      Promise.allSettled(animations).then(() => {
        delete dialog.dataset.closing;
        if (dialog.open) {
          dialog.close(returnValue);
        }
      });
    },
    []
  );

  // Sync store open state with native <dialog>.showModal() / close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (supportPromptModalOpen) {
      if (!wasOpenRef.current) {
        setStage('ask');
        prevStageRef.current = 'ask';
        recordedOpenedRef.current = false;
        setPromptVariant(resolveInitialVariant());
      }
      wasOpenRef.current = true;
      if (dialog) {
        delete dialog.dataset.closing;
        dialog.returnValue = '';
        // React strips the HTML autofocus attribute from JSX; set it before showModal()
        // so the browser's native dialog focus algorithm targets the primary control, not the Close button.
        primaryActionRef.current?.setAttribute('autofocus', '');
        if (!dialog.open && typeof dialog.showModal === 'function') {
          try {
            dialog.showModal();
          } catch {
            // Ignore edge HMR / already-open modal errors
          }
        }
      }
      return;
    }

    wasOpenRef.current = false;
    if (dialog && dialog.open) {
      closeDialogTopLayer(dialog, 'done');
    }
  }, [supportPromptModalOpen, presence.mounted, resolveInitialVariant, closeDialogTopLayer]);

  // Move focus cleanly to the new stage heading after in-dialog step transitions
  useEffect(() => {
    if (!supportPromptModalOpen) {
      prevStageRef.current = stage;
      return;
    }
    if (prevStageRef.current !== stage) {
      prevStageRef.current = stage;
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [supportPromptModalOpen, stage]);

  // Native <dialog> close / cancel listeners (Esc & Close button only; no backdrop light-dismiss)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!presence.mounted || !dialog) return;

    const handleNativeClose = () => {
      const rv = dialog.returnValue as DialogCloseReason;
      dialog.returnValue = '';

      if (rv === 'opted_out') {
        appActions.recordSupportPromptOutcome('opted_out');
      } else if (rv === 'feedback') {
        appActions.recordSupportPromptOutcome('feedback');
      } else if (rv === 'opened_unconfirmed') {
        if (!recordedOpenedRef.current) {
          recordedOpenedRef.current = true;
          appActions.recordSupportPromptOutcome('opened_unconfirmed');
        }
      } else if (rv === 'snoozed') {
        if (!recordedOpenedRef.current) {
          appActions.recordSupportPromptOutcome('snoozed');
        }
      } else if (rv === '') {
        if (stageRef.current === 'confirming') {
          if (!recordedOpenedRef.current) {
            recordedOpenedRef.current = true;
            appActions.recordSupportPromptOutcome('opened_unconfirmed');
          }
        } else if (stageRef.current !== 'thanks' && !recordedOpenedRef.current) {
          appActions.recordSupportPromptOutcome('snoozed');
        }
      }
      appActions.closeSupportPromptModal();
    };

    const handleNativeCancel = (e: Event) => {
      if (!supportsTopLayerExit() && !('closing' in dialog.dataset)) {
        e.preventDefault();
        closeDialogTopLayer(dialog, '');
      }
    };

    dialog.addEventListener('close', handleNativeClose);
    dialog.addEventListener('cancel', handleNativeCancel);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('cancel', handleNativeCancel);
    };
  }, [presence.mounted, closeDialogTopLayer]);

  // Auto-close after showing the brief thank-you state
  useEffect(() => {
    if (!supportPromptModalOpen || stage !== 'thanks') return;
    const timer = window.setTimeout(() => {
      closeDialogTopLayer(dialogRef.current, 'done');
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [supportPromptModalOpen, stage, closeDialogTopLayer]);

  if (!presence.mounted) return null;

  const feedbackTarget = resolveFeedbackChannel(resolvedLang);
  const rawStreakDays = dashboard.streak?.current ?? 0;
  const displayStreakDays = supportPromptModalTestMode
    ? Math.max(rawStreakDays, 3)
    : rawStreakDays;
  const userDisplayName = (customNickname || dashboard.userName || '').trim();
  const streakGreetingText = userDisplayName
    ? t('supportPromptStreakGreeting', { name: userDisplayName, days: displayStreakDays })
    : t('supportPromptStreakBadge', { days: displayStreakDays });
  const showOptOut = !supportPromptModalTestMode && supportPrompt.promptCount >= 1;
  const showFinalNote =
    !supportPromptModalTestMode &&
    supportPrompt.promptCount === 2 &&
    stage === 'ask';

  const canGoBack = stage === 'like' || stage === 'feedback' || stage === 'confirming';
  const showStepDots = stage === 'like' || stage === 'confirming';
  const handleBack = () => {
    if (stage === 'confirming') {
      setStage('like');
    } else {
      setStage('ask');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'closerequest' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      aria-labelledby={titleId}
      className="support-dialog"
    >
      <div className="support-dialog-surface">
        <div className="support-dialog-topbar">
          {canGoBack ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label={t('backBtn')}
              className="support-dialog-icon-btn"
            >
              <BackArrowIcon />
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <div className="flex items-center justify-center" aria-hidden="true">
            {showStepDots && (
              <div className="support-step-dots">
                <span
                  className={`support-step-dot ${stage === 'like' ? 'is-active' : ''}`}
                />
                <span
                  className={`support-step-dot ${stage === 'confirming' ? 'is-active' : ''}`}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => closeDialogTopLayer(dialogRef.current, '')}
            aria-label={t('close')}
            className="support-dialog-icon-btn"
          >
            <CloseIcon className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="support-dialog-body">
          {stage === 'ask' && promptVariant === 'return_ask' && (
            <div className="support-stage-stack">
              <div className="support-ask-intro">
                <img
                  src="./creator-avatar.jpg"
                  width={44}
                  height={44}
                  alt=""
                  decoding="async"
                  className="support-creator-avatar"
                />
                {displayStreakDays > 0 && (
                  <p className="support-streak-eyebrow">{streakGreetingText}</p>
                )}
                {showFinalNote && (
                  <p className="support-final-note">{t('supportPromptFinalNote')}</p>
                )}
              </div>

              <div className="support-copy-block">
                <h2
                  ref={headingRef}
                  id={titleId}
                  tabIndex={-1}
                  className="support-dialog-title"
                >
                  {t('supportPromptReturnAskTitle')}
                </h2>
                <p className="support-dialog-sub">{t('supportPromptReturnAskSub')}</p>
              </div>

              <div className="support-actions-stack">
                <button
                  ref={primaryActionRef}
                  type="button"
                  onClick={() => {
                    appActions.recordSupportPromptOutcome('liked');
                    setStage('thanks');
                  }}
                  className="support-modal-btn support-modal-btn--primary w-full"
                >
                  <CheckIcon className="w-4 h-4" strokeWidth={2.4} />
                  <span>{t('supportPromptConfirmLikedBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStage('like')}
                  className="support-modal-btn support-modal-btn--tinted w-full"
                >
                  <span>{t('supportPromptGoRateNowBtn')}</span>
                </button>
              </div>

              {!supportPromptModalTestMode && (
                <div className="support-footer-links">
                  <button
                    type="button"
                    onClick={() => closeDialogTopLayer(dialogRef.current, 'opted_out')}
                    className="support-modal-link"
                  >
                    {t('supportPromptOptOutBtn')}
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === 'ask' && promptVariant !== 'return_ask' && (
            <div className="support-stage-stack">
              <div className="support-ask-intro">
                <img
                  src="./creator-avatar.jpg"
                  width={44}
                  height={44}
                  alt=""
                  decoding="async"
                  className="support-creator-avatar"
                />
                {displayStreakDays > 0 && (
                  <p className="support-streak-eyebrow">{streakGreetingText}</p>
                )}
                {showFinalNote && (
                  <p className="support-final-note">{t('supportPromptFinalNote')}</p>
                )}
              </div>

              <div className="support-copy-block">
                <h2
                  ref={headingRef}
                  id={titleId}
                  tabIndex={-1}
                  className="support-dialog-title"
                >
                  {promptVariant === 'feedback_return'
                    ? t('supportPromptFeedbackReturnTitle')
                    : t('supportPromptModalAskTitle')}
                </h2>
                <p className="support-dialog-sub">
                  {promptVariant === 'feedback_return'
                    ? t('supportPromptFeedbackReturnSub')
                    : t('supportPromptModalAskSub')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  ref={primaryActionRef}
                  type="button"
                  onClick={() => setStage('like')}
                  className="support-choice-card support-choice-card--brand"
                >
                  <span className="support-choice-icon support-choice-icon--brand" aria-hidden="true">
                    <svg
                      className="support-heart-svg w-4 h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                  </span>
                  <span className="support-choice-label">{t('supportPromptPositiveBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStage('feedback')}
                  className="support-choice-card support-choice-card--neutral"
                >
                  <span className="support-choice-icon support-choice-icon--neutral" aria-hidden="true">
                    <svg
                      className="w-4 h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                    </svg>
                  </span>
                  <span className="support-choice-label">{t('supportPromptNegativeBtn')}</span>
                </button>
              </div>

              {showOptOut && (
                <div className="support-footer-links">
                  <button
                    type="button"
                    onClick={() => closeDialogTopLayer(dialogRef.current, 'opted_out')}
                    className="support-modal-link"
                  >
                    {t('supportPromptOptOutBtn')}
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === 'like' && (
            <div className="support-stage-stack">
              <div className="support-like-hero-badge" aria-hidden="true">
                <span className="support-like-hero-emoji">👍</span>
              </div>

              <div className="support-copy-block">
                <h2
                  ref={headingRef}
                  id={titleId}
                  tabIndex={-1}
                  className="support-dialog-title"
                >
                  {t('supportPromptLikeTitle')}
                </h2>
                <p className="support-dialog-sub">{t('supportPromptLikeBody')}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  openExternalUrl(ANKIWEB_ADDON_URL);
                  if (!recordedOpenedRef.current) {
                    recordedOpenedRef.current = true;
                    appActions.recordSupportPromptOutcome('opened_unconfirmed');
                  }
                  setStage('confirming');
                }}
                className="support-modal-btn support-modal-btn--primary w-full"
              >
                <span className="support-modal-btn-label">
                  {renderWithRateBadge(t('supportPromptLikeBtn'))}
                </span>
                <ExternalArrowIcon />
              </button>

              <div className="support-footer-links">
                <button
                  type="button"
                  onClick={() => {
                    appActions.recordSupportPromptOutcome('liked');
                    setStage('thanks');
                  }}
                  className="support-modal-link"
                >
                  {t('supportPromptAlreadyLikedBtn')}
                </button>
                {showOptOut && (
                  <button
                    type="button"
                    onClick={() => closeDialogTopLayer(dialogRef.current, 'opted_out')}
                    className="support-modal-link"
                  >
                    {t('supportPromptOptOutBtn')}
                  </button>
                )}
              </div>
            </div>
          )}

          {stage === 'confirming' && (
            <div className="support-stage-stack">
              <div className="support-stage-emblem support-stage-emblem--brand" aria-hidden="true">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8.75 12.25 2.25 2.25 4.5-4.75" />
                </svg>
              </div>

              <div className="support-copy-block">
                <h2
                  ref={headingRef}
                  id={titleId}
                  tabIndex={-1}
                  className="support-dialog-title"
                >
                  {t('supportPromptConfirmingTitle')}
                </h2>
                <p className="support-dialog-sub">{t('supportPromptConfirmingSub')}</p>
              </div>

              <div className="support-actions-stack">
                <button
                  type="button"
                  onClick={() => {
                    appActions.recordSupportPromptOutcome('liked');
                    setStage('thanks');
                  }}
                  className="support-modal-btn support-modal-btn--primary w-full"
                >
                  <CheckIcon className="w-4 h-4" strokeWidth={2.4} />
                  <span>{t('supportPromptConfirmLikedBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => closeDialogTopLayer(dialogRef.current, 'opened_unconfirmed')}
                  className="support-modal-btn support-modal-btn--secondary w-full"
                >
                  <span>{t('supportPromptNotYetBtn')}</span>
                </button>
              </div>

              <div className="support-footer-links">
                <button
                  type="button"
                  onClick={() => openExternalUrl(ANKIWEB_ADDON_URL)}
                  className="support-modal-link"
                >
                  <span>{t('supportPromptReopenBtn')}</span>
                  <ExternalArrowIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {stage === 'feedback' && (
            <div className="support-stage-stack">
              <div className="support-stage-emblem support-stage-emblem--neutral" aria-hidden="true">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
              </div>

              <div className="support-copy-block">
                <h2
                  ref={headingRef}
                  id={titleId}
                  tabIndex={-1}
                  className="support-dialog-title"
                >
                  {t('supportPromptFeedbackTitle')}
                </h2>
                <p className="support-dialog-sub">
                  {feedbackTarget.channel === 'xiaohongshu'
                    ? t('supportPromptFeedbackBodyXhs')
                    : t('supportPromptFeedbackBodyGithub')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  openExternalUrl(feedbackTarget.url);
                  closeDialogTopLayer(dialogRef.current, 'feedback');
                }}
                className="support-modal-btn support-modal-btn--tinted w-full"
              >
                <span>
                  {feedbackTarget.channel === 'xiaohongshu'
                    ? t('supportPromptFeedbackBtnXhs')
                    : t('supportPromptFeedbackBtnGithub')}
                </span>
                <ExternalArrowIcon />
              </button>
            </div>
          )}

          {stage === 'thanks' && (
            <div className="support-stage-stack">
              <div className="support-stage-emblem support-stage-emblem--success" aria-hidden="true">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
                </svg>
              </div>

              <div className="support-copy-block">
                <h2
                  ref={headingRef}
                  id={titleId}
                  tabIndex={-1}
                  className="support-dialog-title"
                >
                  {t('supportPromptThanksToast')}
                </h2>
                <p className="support-dialog-sub">
                  {supportPromptModalTestMode
                    ? t('supportPromptTestDoneSub')
                    : t('supportPromptThanksSub')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeDialogTopLayer(dialogRef.current, 'done')}
                className="support-modal-btn support-modal-btn--tinted w-full"
              >
                {t('supportPromptDoneBtn')}
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
