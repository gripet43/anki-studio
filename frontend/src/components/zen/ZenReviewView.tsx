import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translate } from '../../i18n/translations';
import { appActions, setAppState, useAppStore } from '../../stores/useAppStore';
import { getClosestFromTarget, isTypingTarget } from '../../utils/domTarget';
import { renderMathAndRichHtml } from '../../utils/mathRenderer';
import {
  resolveAutoPlayAudioFiles,
  resolveManualPlayAudioFiles,
  resolveVisibleAudioFiles,
} from '../../utils/reviewAudio';
import { resolveThemeMode } from '../../utils/themeTokens';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';
import {
  playZenIncenseIgnite,
  playZenPaperTouch,
  prewarmZenAudio,
} from '../../utils/zenAudio';
import {
  formatZenIncenseRemaining,
  resolveZenCompleteSubKey,
  resolveZenIncenseCopy,
  resolveZenTimePeriod,
} from '../../utils/zenMode';
import { Tooltip } from '../common/Tooltip';
import { LightboxTarget, ReviewerImageLightbox } from '../reviewer/ReviewerImageLightbox';
import { SandboxCardFrame } from '../reviewer/SandboxCardFrame';
import { ZenEnsoGlyph } from './ZenEnsoGlyph';
import {
  ZEN_INCENSE_BURN_DURATION_MS,
  ZenIncenseCanvas,
  ZenIncenseHoverInfo,
} from './ZenIncenseCanvas';
import { ZenSoundControl } from './ZenSoundControl';

/**
 * Zero-based Zen Review (Seijaku Pure Paper Stage).
 * Wraps the study card in Shoji light & Washi texture, humanist serif typography,
 * muted ink/vermilion/celadon rating controls with zero FSRS intervals, an invisible-until-needed
 * top exit & sound bar, and an Ensō-sealed completion ceremony with bronze singing-bowl resonance.
 */
export const ZenReviewView: React.FC = () => {
  const {
    reviewQueue,
    currentCardIndex,
    isCardFlipped,
    isSessionComplete,
    isPreviewSession,
    reviewScopeDeckId,
    activeDeckId,
    revealedHintsCount,
    optionKeyHeld,
    undoStack,
    playingAudioFile,
    theme,
    systemDark,
    resolvedLang,
    zenSoundEnabled,
    envInfo,
    answerButtonMode,
    autoPlayFrontAudio,
    autoPlayBackAudio,
    reviewStageWidth,
    reviewContentScale,
    compatMode,
    dashboard,
    decks,
    dayBoundary,
    pendingDayRollover,
    reviewSessionDayKey,
  } = useAppStore();

  const [lightboxTarget, setLightboxTarget] = useState<LightboxTarget | null>(null);
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [introBarVisible, setIntroBarVisible] = useState(true);
  const [cursorIdle, setCursorIdle] = useState(false);
  const [pulsingEase, setPulsingEase] = useState<1 | 2 | 3 | 4 | null>(null);
  const [isDissolvingCard, setIsDissolvingCard] = useState(false);
  const [incenseKey, setIncenseKey] = useState(0);
  const [agitationSignal, setAgitationSignal] = useState(0);
  const [incenseExtinguished, setIncenseExtinguished] = useState(false);
  const [showIncenseSheet, setShowIncenseSheet] = useState(false);
  const [incenseHoverInfo, setIncenseHoverInfo] = useState<ZenIncenseHoverInfo | null>(null);
  const [lastIncenseHover, setLastIncenseHover] = useState<ZenIncenseHoverInfo | null>(null);
  const handleIncenseHoverChange = useCallback((info: ZenIncenseHoverInfo | null) => {
    setIncenseHoverInfo(info);
    if (info) setLastIncenseHover(info);
  }, []);
  const idleCursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dissolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incenseSheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRateTimestampRef = useRef<number>(0);
  const burnCompletedPendingRef = useRef(false);

  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const resolvedTheme = resolveThemeMode(theme, systemDark);
  const isDark = resolvedTheme === 'dark';
  const timePeriod = resolveZenTimePeriod(new Date().getHours());
  const completeSubKey = resolveZenCompleteSubKey(timePeriod);

  const currentCard = reviewQueue[currentCardIndex] || null;
  const canUndo = undoStack.length > 0;

  const visibleAudioFiles = useMemo(
    () => resolveVisibleAudioFiles(currentCard, isCardFlipped),
    [currentCard, isCardFlipped]
  );
  const manualAudioFiles = useMemo(
    () => resolveManualPlayAudioFiles(currentCard, isCardFlipped),
    [currentCard, isCardFlipped]
  );
  const frontHtmlForMemo = currentCard
    ? isCardFlipped
      ? currentCard.frontAnswerHtml || currentCard.frontHtml || currentCard.front
      : currentCard.frontHtml || currentCard.front
    : '';
  const backHtmlForMemo = currentCard ? currentCard.backHtml || currentCard.meaning : '';
  const renderedFrontHtml = useMemo(
    () => (frontHtmlForMemo ? renderMathAndRichHtml(frontHtmlForMemo, !isCardFlipped) : ''),
    [frontHtmlForMemo, isCardFlipped]
  );
  const renderedBackHtml = useMemo(
    () => (isCardFlipped && backHtmlForMemo ? renderMathAndRichHtml(backHtmlForMemo) : ''),
    [backHtmlForMemo, isCardFlipped]
  );

  const scheduleCursorIdle = () => {
    // If keyboard focus was parked on the top hoverbar (e.g. after closing sound popover via Esc),
    // release it when the user resumes reviewing cards so the hoverbar retreats cleanly into silence.
    if (
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement &&
      getClosestFromTarget(document.activeElement, '.zen-review-hoverbar')
    ) {
      document.activeElement.blur();
    }
    if (idleCursorTimerRef.current) clearTimeout(idleCursorTimerRef.current);
    idleCursorTimerRef.current = setTimeout(() => {
      idleCursorTimerRef.current = null;
      setCursorIdle(true);
    }, 2500);
  };

  const triggerRateWithInkPulse = (ease: 1 | 2 | 3 | 4) => {
    if (showIncenseSheet || isDissolvingCard) return;
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    setPulsingEase(ease);
    pulseTimerRef.current = setTimeout(() => {
      pulseTimerRef.current = null;
      setPulsingEase(null);
    }, 220);

    // 点击当下立即播放微纸木落声，避免等待 250ms 化墨动效造成声画延迟
    const isLikelyLastCard = ease > 1 && currentCardIndex + 1 >= reviewQueue.length;
    let playedTouchNow = false;
    if (!isLikelyLastCard) {
      const nextCard = reviewQueue[currentCardIndex + 1] ?? (ease === 1 ? currentCard : null);
      const nextWillAutoPlay =
        resolveAutoPlayAudioFiles(nextCard, 'front', {
          autoPlayFrontAudio,
          autoPlayBackAudio,
        }).length > 0;
      if (!nextWillAutoPlay) {
        playZenPaperTouch(zenSoundEnabled, 'settle');
        playedTouchNow = true;
      }
    }

    // 心静则烟直：平稳作答时烟保持笔直，连续快速点击/跳卡时轻轻晃一下
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (lastRateTimestampRef.current > 0 && now - lastRateTimestampRef.current < 1800) {
      setAgitationSignal((prev) => prev + 1);
    }
    lastRateTimestampRef.current = now;

    const commitAnswer = () => {
      setIsDissolvingCard(false);
      appActions.answerCurrentCard(ease, { skipZenTouchSound: playedTouchNow });

      // 燃尽时不打断正在做的那张卡，等答完后熄火、余烟散开再浮出「一炷香尽」
      if (burnCompletedPendingRef.current) {
        burnCompletedPendingRef.current = false;
        setIncenseExtinguished(true);
        setIncenseHoverInfo(null);
        if (incenseSheetTimerRef.current) clearTimeout(incenseSheetTimerRef.current);
        incenseSheetTimerRef.current = setTimeout(() => {
          incenseSheetTimerRef.current = null;
          setShowIncenseSheet(true);
        }, 1150);
      }
    };

    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      commitAnswer();
      return;
    }

    setIsDissolvingCard(true);
    if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current);
    dissolveTimerRef.current = setTimeout(() => {
      dissolveTimerRef.current = null;
      commitAnswer();
    }, 250);
  };

  const handleRelightIncense = () => {
    if (incenseSheetTimerRef.current) {
      clearTimeout(incenseSheetTimerRef.current);
      incenseSheetTimerRef.current = null;
    }
    burnCompletedPendingRef.current = false;
    setShowIncenseSheet(false);
    setIncenseExtinguished(false);
    setIncenseHoverInfo(null);
    setLastIncenseHover(null);
    setIncenseKey((k) => k + 1);
    playZenIncenseIgnite(zenSoundEnabled);
  };

  useEffect(() => {
    prewarmZenAudio(zenSoundEnabled);
    return () => {
      if (idleCursorTimerRef.current) clearTimeout(idleCursorTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current);
      if (incenseSheetTimerRef.current) clearTimeout(incenseSheetTimerRef.current);
      appActions.stopAudio();
    };
  }, []);

  // Onboarding guide: reveal top controls (back, sound/ambience, exit) for 3 seconds on entering Zen Review,
  // then let them dissolve gently unless hovered, focused, or the sound popover is open.
  useEffect(() => {
    if (isSessionComplete) {
      setIntroBarVisible(false);
      return;
    }
    setIntroBarVisible(true);
    const timer = window.setTimeout(() => {
      setIntroBarVisible(false);
    }, 3000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isSessionComplete]);

  // Wake mouse cursor immediately on pointer movement; keep visible during overlays or completion
  useEffect(() => {
    if (isSessionComplete || lightboxTarget || soundMenuOpen || showIncenseSheet) {
      if (idleCursorTimerRef.current) {
        clearTimeout(idleCursorTimerRef.current);
        idleCursorTimerRef.current = null;
      }
      setCursorIdle(false);
      return;
    }
    const onPointerWake = () => {
      if (idleCursorTimerRef.current) {
        clearTimeout(idleCursorTimerRef.current);
        idleCursorTimerRef.current = null;
      }
      setCursorIdle(false);
    };
    window.addEventListener('pointermove', onPointerWake, { passive: true });
    window.addEventListener('pointerdown', onPointerWake, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerWake);
      window.removeEventListener('pointerdown', onPointerWake);
    };
  }, [isSessionComplete, lightboxTarget, soundMenuOpen, showIncenseSheet]);

  useEffect(() => {
    setLightboxTarget(null);
    setIsDissolvingCard(false);
    if (dissolveTimerRef.current) {
      clearTimeout(dissolveTimerRef.current);
      dissolveTimerRef.current = null;
    }
  }, [currentCard?.id]);

  // Irreducible keyboard loop for Zen Review — excludes Edit, Inspector, Flags, Search, Settings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAppState({ optionKeyHeld: true });
        return;
      }

      if (isTypingTarget(e.target)) return;

      // Lock all review shortcuts while the 15-minute incense closure sheet is open
      if (showIncenseSheet) {
        if (soundMenuOpen) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          appActions.exitReview();
          return;
        }
        if ((e.key === ' ' || e.key === 'Enter') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          if (!getClosestFromTarget(e.target, '[data-zen-incense-sheet="open"] button')) {
            e.preventDefault();
            handleRelightIncense();
          }
          return;
        }
        if (e.key !== 'Tab') {
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (soundMenuOpen) {
          return;
        }
        e.preventDefault();
        if (lightboxTarget) {
          setLightboxTarget(null);
        } else {
          appActions.exitReview();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        appActions.undoLastReview();
        return;
      }

      if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        appActions.undoLastReview();
        return;
      }

      if (isSessionComplete || !currentCard) return;

      if (e.key === ' ') {
        e.preventDefault();
        scheduleCursorIdle();
        if (isCardFlipped) {
          triggerRateWithInkPulse(3);
        } else {
          appActions.flipCard();
        }
        return;
      }

      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        scheduleCursorIdle();
        appActions.playAudio(manualAudioFiles);
        return;
      }

      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!getClosestFromTarget(e.target, '.zen-review-hoverbar')) {
          e.preventDefault();
          scheduleCursorIdle();
          if (!isCardFlipped) {
            appActions.flipCard();
          } else {
            appActions.revealNextHint();
          }
        }
        return;
      }

      if (!isCardFlipped) {
        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          scheduleCursorIdle();
          appActions.flipCard();
        }
        return;
      }

      if (e.metaKey || e.ctrlKey) return;

      if (answerButtonMode === 'four' || optionKeyHeld || e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          scheduleCursorIdle();
          triggerRateWithInkPulse(1);
        } else if (e.key === '2') {
          e.preventDefault();
          scheduleCursorIdle();
          triggerRateWithInkPulse(2);
        } else if (e.key === '3' || e.key === 'Enter') {
          e.preventDefault();
          scheduleCursorIdle();
          triggerRateWithInkPulse(3);
        } else if (e.key === '4') {
          e.preventDefault();
          scheduleCursorIdle();
          triggerRateWithInkPulse(4);
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          scheduleCursorIdle();
          triggerRateWithInkPulse(1);
        } else if (e.key === '2' || e.key === '3' || e.key === 'Enter') {
          e.preventDefault();
          scheduleCursorIdle();
          triggerRateWithInkPulse(3);
        } else if (e.key === '4') {
          e.preventDefault();
          scheduleCursorIdle();
          triggerRateWithInkPulse(4);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAppState({ optionKeyHeld: false });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    isSessionComplete,
    currentCard,
    isCardFlipped,
    answerButtonMode,
    optionKeyHeld,
    lightboxTarget,
    soundMenuOpen,
    manualAudioFiles,
    isDissolvingCard,
    showIncenseSheet,
    zenSoundEnabled,
  ]);

  const sessionCrossedDay = Boolean(
    !isPreviewSession &&
      (pendingDayRollover ||
        (dayBoundary?.available &&
          reviewSessionDayKey !== null &&
          dayBoundary.schedToday !== reviewSessionDayKey))
  );
  const effectiveTargetDeck =
    reviewScopeDeckId && reviewScopeDeckId !== 'all'
      ? decks.find((d) => d.id === reviewScopeDeckId)
      : null;
  const newDayPendingCount = effectiveTargetDeck
    ? effectiveTargetDeck.dueNew + effectiveTargetDeck.dueReview
    : dashboard?.todayStats?.totalPending ?? 0;
  const isNewDayReady = sessionCrossedDay && newDayPendingCount > 0;
  const hasOtherPendingToday =
    (dashboard?.todayStats?.totalPending ?? 0) > 0 && reviewScopeDeckId !== 'all';

  // ============== ZEN CLOSURE CEREMONY (Ensō Sealed + Carved Vermilion Stamp) ==============
  if (isSessionComplete || !currentCard) {
    const isAllDoneToday = !isNewDayReady && !hasOtherPendingToday;
    return (
      <div
        data-zen-view="complete"
        data-zen-period={timePeriod}
        className="zen-sanctuary-bg zen-review-shell fixed inset-0 z-30 flex flex-col select-none overflow-hidden ui-view-enter"
      >
        <nav
          aria-label={t('zenHoverBarAria')}
          data-popover-open={soundMenuOpen ? 'true' : 'false'}
          onMouseDown={startWindowDrag}
          onDoubleClick={handleWindowDoubleClick}
          className="zen-review-hoverbar relative z-20 shrink-0 h-14 px-7 flex items-center justify-between gap-4"
        >
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => appActions.exitReview()}
            className="zen-edge-btn"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0 rtl:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>{t('zenReturnHomeBtn')}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <ZenSoundControl onOpenChange={setSoundMenuOpen} />
            {canUndo && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => appActions.undoLastReview()}
                className="zen-edge-btn"
              >
                {t('undoBtnShort')}
              </button>
            )}
          </div>
        </nav>

        <main className="relative z-10 flex-1 min-h-0 overflow-y-auto px-6 pb-16 flex flex-col items-center">
          <div
            role="status"
            aria-live="polite"
            className="zen-complete-stage my-auto w-full max-w-[420px] flex flex-col items-center text-center"
          >
            <ZenEnsoGlyph
              variant={isNewDayReady ? 'open' : 'closed'}
              animateDraw
              showSeal={!isNewDayReady}
              className="zen-enso-svg zen-enso-complete w-28 h-28 mb-7"
            />

            <h1 className="zen-home-title zen-serif settings-heading">
              {isNewDayReady
                ? t('zenNewDayTitle')
                : isAllDoneToday
                ? t('zenAllDoneTitle')
                : t('zenDeckDoneTitle')}
            </h1>

            <p className="mt-3.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)] settings-helper-copy max-w-[330px]">
              {isNewDayReady
                ? t('zenNewDaySub')
                : isAllDoneToday
                ? t(completeSubKey)
                : t('zenDeckDoneSub')}
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              {isNewDayReady ? (
                <>
                  <button
                    type="button"
                    onClick={() => appActions.startReview(reviewScopeDeckId || activeDeckId || 'all')}
                    className="zen-start-btn zen-ink-btn"
                  >
                    {t('zenNewDayStartBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => appActions.exitZenModeAndReview()}
                    className="zen-secondary-btn zen-ink-ghost-btn"
                  >
                    {t('zenExitBtn')}
                  </button>
                </>
              ) : isAllDoneToday ? (
                <>
                  <button
                    type="button"
                    onClick={() => appActions.exitZenModeAndReview()}
                    className="zen-start-btn zen-ink-btn"
                  >
                    {t('zenExitBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => appActions.exitReview()}
                    className="zen-secondary-btn zen-ink-ghost-btn"
                  >
                    {t('zenReturnHomeBtn')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => appActions.exitReview()}
                    className="zen-start-btn zen-ink-btn"
                  >
                    {t('zenReturnHomeBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => appActions.exitZenModeAndReview()}
                    className="zen-secondary-btn zen-ink-ghost-btn"
                  >
                    {t('zenExitBtn')}
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ============== PURE PAPER ACTIVE REVIEW ==============
  const isSandboxCard = Boolean(
    (compatMode || currentCard.needsSandbox) &&
      (currentCard.sandboxFrontHtml || currentCard.sandboxBackHtml)
  );
  const combinedCardMarkup = [
    currentCard.frontHtml,
    currentCard.frontAnswerHtml,
    currentCard.backHtml,
    currentCard.front,
    currentCard.meaning,
  ]
    .filter(Boolean)
    .join(' ');
  const combinedCardTextLen = combinedCardMarkup.replace(/<[^>]*>/g, '').trim().length;
  const isComplexCard =
    isSandboxCard ||
    /<(img|table|svg|pre|canvas|video)\b|anki-io-wrap/i.test(combinedCardMarkup) ||
    combinedCardTextLen > 200;

  const isStageWidened =
    reviewStageWidth === 'full' ||
    reviewStageWidth === 'wide' ||
    (reviewStageWidth === 'auto' && isComplexCard);

  const stageMaxWidthClass =
    reviewStageWidth === 'full'
      ? 'max-w-[1120px]'
      : isStageWidened
      ? 'max-w-[840px]'
      : 'max-w-[600px]';

  const scaleFactor = reviewContentScale / 100;
  const inlineImgMaxHeightPx = Math.round((isStageWidened ? 500 : 380) * scaleFactor);
  const inlineIoMaxHeightPx = Math.round((isStageWidened ? 560 : 420) * scaleFactor);

  const handleCardMediaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const ioWrap = getClosestFromTarget(e.target, '.anki-io-wrap') as HTMLElement | null;
    if (ioWrap && !getClosestFromTarget(e.target, 'a, button')) {
      e.preventDefault();
      e.stopPropagation();
      setLightboxTarget({ mode: 'io-html', html: ioWrap.outerHTML });
      return;
    }
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.tagName === 'IMG' &&
      !getClosestFromTarget(e.target, 'a, button, [onclick]')
    ) {
      const img = target as HTMLImageElement;
      const src = img.currentSrc || img.src;
      if (src) {
        e.preventDefault();
        e.stopPropagation();
        setLightboxTarget({ mode: 'img', src, alt: img.alt || undefined });
      }
    }
  };

  const frontHtmlContent = isCardFlipped
    ? currentCard.frontAnswerHtml || currentCard.frontHtml || currentCard.front
    : currentCard.frontHtml || currentCard.front;
  const isNativeStyledFront = Boolean(
    frontHtmlContent && frontHtmlContent.includes('anki-native-card')
  );
  const frontCleanText = (frontHtmlContent || '').replace(/<[^>]*>/g, '').trim();
  const frontTextLen = frontCleanText.length;
  const frontBaseFontPx =
    isNativeStyledFront || frontTextLen > 80 ? 17 : frontTextLen > 35 ? 22 : 30;
  const frontTypographyClass = isNativeStyledFront
    ? 'w-full select-text break-words text-[17px] leading-relaxed'
    : frontTextLen > 80
    ? 'zen-serif font-medium leading-relaxed tracking-normal whitespace-pre-wrap'
    : frontTextLen > 35
    ? 'zen-serif font-semibold leading-snug tracking-tight whitespace-pre-wrap'
    : 'zen-serif font-semibold leading-tight tracking-tight whitespace-pre-wrap';

  const backHtmlContent = currentCard.backHtml || currentCard.meaning;
  const isNativeStyledBack = Boolean(
    (currentCard.backHtml || '').includes('anki-native-card')
  );
  const showFourButtons = optionKeyHeld || answerButtonMode === 'four';

  return (
    <div
      data-zen-view="review"
      data-zen-period={timePeriod}
      data-zen-idle-cursor={cursorIdle ? 'true' : 'false'}
      className={`zen-sanctuary-bg zen-review-shell fixed inset-0 z-30 flex flex-col select-none overflow-hidden ${
        cursorIdle ? 'zen-cursor-idle' : ''
      }`}
    >
      {/* 15-minute organic incense timekeeper standing quietly in the side margin */}
      <ZenIncenseCanvas
        key={incenseKey}
        mode="review"
        lit
        isDark={isDark}
        burnDurationMs={ZEN_INCENSE_BURN_DURATION_MS}
        agitationSignal={agitationSignal}
        extinguished={incenseExtinguished}
        onBurnComplete={() => {
          burnCompletedPendingRef.current = true;
        }}
        onHoverInfoChange={handleIncenseHoverChange}
        stageClearanceKey={`${reviewStageWidth}:${isStageWidened ? 'w' : 'n'}:${currentCard.id}`}
        className="fixed inset-0 w-full h-full pointer-events-none z-[3]"
      />

      {/* Song-dynasty vertical marginalia (CJK) / editorial whisper beside the incense stick */}
      {lastIncenseHover && (() => {
        const isHoverVisible =
          Boolean(incenseHoverInfo) && !showIncenseSheet && !incenseExtinguished;
        const copy = resolveZenIncenseCopy(resolvedLang);
        const timeText = formatZenIncenseRemaining(lastIncenseHover.remainingMs, resolvedLang);
        const isVerticalCjk =
          resolvedLang === 'zh-CN' || resolvedLang === 'zh-TW' || resolvedLang === 'ja';
        const isRtl =
          typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
        const renderedTimeText = isVerticalCjk
          ? timeText.split(/(\d{1,2})/g).map((part, idx) =>
              /^\d{1,2}$/.test(part) ? (
                <span key={idx} className="zen-incense-tcy">
                  {part}
                </span>
              ) : (
                <React.Fragment key={idx}>{part}</React.Fragment>
              )
            )
          : timeText;

        return (
          <div
            aria-hidden={!isHoverVisible}
            style={{
              left: isRtl ? `${lastIncenseHover.x + 22}px` : `${lastIncenseHover.x - 22}px`,
              top: `${lastIncenseHover.y}px`,
              transform: isRtl ? 'translate3d(0, -50%, 0)' : 'translate3d(-100%, -50%, 0)',
            }}
            className="zen-incense-hover-anchor"
          >
            <div
              aria-live={isHoverVisible ? 'polite' : 'off'}
              data-visible={isHoverVisible ? 'true' : 'false'}
              data-orientation={isVerticalCjk ? 'vertical' : 'horizontal'}
              data-paused={lastIncenseHover.paused ? 'true' : 'false'}
              className="zen-incense-hover-label zen-serif"
            >
              <span className="zen-incense-hover-primary">
                <span className="zen-incense-hover-dot" aria-hidden="true" />
                <span className="zen-incense-hover-text">{renderedTimeText}</span>
              </span>
              {lastIncenseHover.paused && (
                <>
                  {!isVerticalCjk && (
                    <span className="zen-incense-hover-sep" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <span className="zen-incense-hover-paused">{copy.pausedLabel}</span>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Top control edge — shown for 3s on entry as a gentle guide, then fades until hover/focus/popover/touch */}
      <nav
        aria-label={t('zenHoverBarAria')}
        data-popover-open={soundMenuOpen ? 'true' : 'false'}
        data-intro-visible={introBarVisible ? 'true' : 'false'}
        onMouseDown={startWindowDrag}
        onDoubleClick={handleWindowDoubleClick}
        className="zen-review-hoverbar relative z-20 shrink-0 h-14 px-7 flex items-center justify-between gap-4"
      >
        <Tooltip variant="compact" content={t('zenReturnHomeBtn')} shortcut="Esc" side="bottom">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => appActions.exitReview()}
            aria-label={t('zenReturnHomeBtn')}
            className="zen-edge-btn"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0 rtl:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>{t('zenReturnHomeBtn')}</span>
          </button>
        </Tooltip>

        <div className="flex items-center gap-1.5">
          {canUndo && (
            <Tooltip variant="compact" content={t('undoBtnShort')} shortcut="Cmd Z" side="bottom">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => appActions.undoLastReview()}
                aria-label={t('undoBtnShort')}
                className="zen-edge-btn"
              >
                {t('undoBtnShort')}
              </button>
            </Tooltip>
          )}
          <ZenSoundControl onOpenChange={setSoundMenuOpen} />
          <Tooltip variant="compact" content={t('zenExitBtn')} shortcut="Cmd Shift Z" side="bottom">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => appActions.exitZenMode()}
              aria-label={t('zenExitBtn')}
              className="zen-edge-btn"
            >
              {t('zenExitShort')}
            </button>
          </Tooltip>
        </div>
      </nav>

      {/* Pure Centered Washi Card Stage */}
      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col items-center">
        <div
          style={
            {
              '--reviewer-img-max-h': `${inlineImgMaxHeightPx}px`,
              '--reviewer-io-max-h': `${inlineIoMaxHeightPx}px`,
            } as React.CSSProperties
          }
          className={`my-auto flex flex-col items-center w-full transition-[max-width] duration-200 ${stageMaxWidthClass}`}
        >
          <article
            key={currentCard.id}
            onClick={handleCardMediaClick}
            className={`zen-card-paper w-full rounded-[20px] p-9 sm:p-12 relative ${
              isDissolvingCard ? 'zen-paper-dissolve' : 'zen-paper-enter'
            }`}
          >
            {visibleAudioFiles.length > 0 && (
              <div className="absolute top-4 end-4 z-10">
                <Tooltip variant="compact" content={t('readAloud')} shortcut="R" side="bottom">
                  <button
                    type="button"
                    aria-label={t('readAloud')}
                    onClick={(e) => {
                      e.stopPropagation();
                      appActions.playAudio(manualAudioFiles);
                    }}
                    className={`zen-audio-btn w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                      playingAudioFile
                        ? 'text-[var(--text-primary)] bg-[var(--bg-subtle)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            )}

            {isSandboxCard ? (
              <div className="my-1">
                <SandboxCardFrame
                  cardId={currentCard.id}
                  cardOrd={currentCard.cardOrd}
                  frontHtml={currentCard.sandboxFrontHtml || currentCard.frontHtml}
                  backHtml={currentCard.sandboxBackHtml || currentCard.backHtml}
                  cssText={currentCard.sandboxCss || ''}
                  mediaHttpBaseUrl={currentCard.sandboxMediaBaseUrl || envInfo?.mediaHttpBaseUrl}
                  preloadScripts={currentCard.sandboxPreloadScripts}
                  isFlipped={isCardFlipped}
                  isDark={isDark}
                  audioFiles={currentCard.audioFiles}
                  frontAudioFiles={currentCard.frontAudioFiles}
                  backAudioFiles={currentCard.backAudioFiles}
                  sandboxQuestionAudioFiles={currentCard.sandboxQuestionAudioFiles}
                  sandboxAnswerAudioFiles={currentCard.sandboxAnswerAudioFiles}
                  contentScale={scaleFactor}
                  onImageZoom={(target) =>
                    setLightboxTarget({ mode: 'img', src: target.src, alt: target.alt })
                  }
                />
              </div>
            ) : (
              <>
                {!(isCardFlipped && currentCard.replaceFrontOnFlip) && (
                  <div className={`${isCardFlipped ? 'mb-7' : ''} select-text cursor-text selectable-text`}>
                    <div
                      style={
                        isNativeStyledFront
                          ? scaleFactor !== 1
                            ? { zoom: scaleFactor }
                            : undefined
                          : { fontSize: `${Math.round(frontBaseFontPx * scaleFactor * 10) / 10}px` }
                      }
                      className={`${frontTypographyClass} break-words ${
                        isNativeStyledFront
                          ? '[&_img]:max-h-[var(--reviewer-img-max-h)] [&_img:not([width])]:w-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer [&_.anki-io-wrap]:cursor-zoom-in [&_.anki-io-wrap_img]:!my-0 [&_.anki-io-wrap_img]:!max-h-[var(--reviewer-io-max-h)]'
                          : '[&_img]:max-h-[var(--reviewer-img-max-h)] [&_img:not([width])]:w-auto [&_img]:max-w-full [&_img:not([width]):not([height])]:rounded-xl [&_img:not([width]):not([height])]:my-2 [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer [&_.anki-io-wrap]:cursor-zoom-in [&_.anki-io-wrap_img]:!my-0 [&_.anki-io-wrap_img]:!max-h-[var(--reviewer-io-max-h)]'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: renderedFrontHtml,
                      }}
                    />
                    {currentCard.reading && !isNativeStyledFront && (
                      <p
                        style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                        className="text-[var(--text-muted)] mt-2.5 tracking-wide"
                      >
                        {currentCard.reading}
                      </p>
                    )}
                  </div>
                )}

                {isCardFlipped && (() => {
                  const hasZenBackBody = Boolean(renderedBackHtml && renderedBackHtml.trim());
                  const hasZenHints = Boolean(
                    currentCard.etymology || currentCard.example || currentCard.extraHint
                  );
                  if (!hasZenBackBody && !hasZenHints) {
                    return null;
                  }
                  return (
                  <div className="zen-ink-reveal">
                    {!currentCard.replaceFrontOnFlip && (
                      <div className="zen-paper-divider my-7" />
                    )}

                    {hasZenBackBody && (
                    <div
                      style={
                        isNativeStyledBack
                          ? scaleFactor !== 1
                            ? { zoom: scaleFactor }
                            : undefined
                          : { fontSize: `${Math.round(16.5 * scaleFactor * 10) / 10}px` }
                      }
                      className={`select-text cursor-text selectable-text break-words ${
                        isNativeStyledBack
                          ? 'w-full text-[16px] leading-relaxed [&_img]:max-h-[var(--reviewer-img-max-h)] [&_img:not([width])]:w-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer'
                          : 'font-normal leading-[1.8] whitespace-pre-wrap [&_img]:max-h-[var(--reviewer-img-max-h)] [&_img:not([width])]:w-auto [&_img]:max-w-full [&_img:not([width]):not([height])]:rounded-xl [&_img:not([width]):not([height])]:my-3 [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer [&_.anki-io-wrap]:cursor-zoom-in [&_.anki-io-wrap_img]:!my-0 [&_.anki-io-wrap_img]:!max-h-[var(--reviewer-io-max-h)]'
                      } [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[0.85em] ${
                        isDark
                          ? 'text-[#E5E4DE] [&_code]:bg-white/10'
                          : 'text-[var(--text-primary)] [&_code]:bg-[var(--bg-subtle)]'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: renderedBackHtml,
                      }}
                    />
                    )}

                    {(currentCard.etymology || currentCard.example || currentCard.extraHint) && (
                      <div className="mt-6 space-y-2.5 text-[var(--text-secondary)]">
                        {currentCard.etymology && (
                          <div
                            style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                            className="selectable-text"
                            dangerouslySetInnerHTML={{
                              __html: renderMathAndRichHtml(currentCard.etymology),
                            }}
                          />
                        )}
                        {revealedHintsCount >= 2 && currentCard.example && (
                          <div
                            style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                            className="selectable-text"
                            dangerouslySetInnerHTML={{
                              __html: renderMathAndRichHtml(currentCard.example),
                            }}
                          />
                        )}
                        {revealedHintsCount >= 3 && currentCard.extraHint && (
                          <div
                            style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                            className="selectable-text"
                            dangerouslySetInnerHTML={{
                              __html: renderMathAndRichHtml(currentCard.extraHint),
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                  );
                })()}
              </>
            )}
          </article>
        </div>
      </main>

      {/* Borderless Wabi-Sabi Floating Decision Area — Zero Intervals, Zero SaaS Chrome */}
      <footer className="zen-review-dock relative z-10 shrink-0 px-6 pt-2 pb-10 flex items-center justify-center">
        <div className="w-[440px] max-w-full">
          {!isCardFlipped ? (
            <button
              type="button"
              onClick={() => appActions.flipCard()}
              className="zen-reveal-btn zen-serif w-full"
            >
              {t('showAnswerBtn')}
            </button>
          ) : showFourButtons ? (
            <div className="grid grid-cols-4 gap-2.5 w-full">
              <button
                type="button"
                onClick={() => triggerRateWithInkPulse(1)}
                className={`zen-rate-btn zen-rate-btn--danger ${pulsingEase === 1 ? 'zen-rate-btn--pulsing' : ''}`}
              >
                {t('rateAgain')}
              </button>
              <button
                type="button"
                onClick={() => triggerRateWithInkPulse(2)}
                className={`zen-rate-btn zen-rate-btn--warning ${pulsingEase === 2 ? 'zen-rate-btn--pulsing' : ''}`}
              >
                {t('rateHard')}
              </button>
              <button
                type="button"
                onClick={() => triggerRateWithInkPulse(3)}
                className={`zen-rate-btn zen-rate-btn--success ${pulsingEase === 3 ? 'zen-rate-btn--pulsing' : ''}`}
              >
                {t('rateGood')}
              </button>
              <button
                type="button"
                onClick={() => triggerRateWithInkPulse(4)}
                className={`zen-rate-btn zen-rate-btn--info ${pulsingEase === 4 ? 'zen-rate-btn--pulsing' : ''}`}
              >
                {t('rateEasy')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_1.85fr] gap-3 w-full">
              <button
                type="button"
                onClick={() => triggerRateWithInkPulse(1)}
                className={`zen-rate-btn zen-rate-btn--danger ${pulsingEase === 1 ? 'zen-rate-btn--pulsing' : ''}`}
              >
                {t('rateAgain')}
              </button>
              <button
                type="button"
                onClick={() => triggerRateWithInkPulse(3)}
                className={`zen-rate-btn zen-rate-btn--success ${pulsingEase === 3 ? 'zen-rate-btn--pulsing' : ''}`}
              >
                {t('rateGood')}
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Gentle closure sheet after the 15-minute incense burns out & current card is finished */}
      {showIncenseSheet && (() => {
        const copy = resolveZenIncenseCopy(resolvedLang);
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="zen-incense-sheet-title"
            aria-describedby="zen-incense-sheet-desc"
            data-zen-incense-sheet="open"
            className="zen-incense-complete-veil fixed inset-0 z-40 flex items-center justify-center px-6 modal-contain-scroll"
          >
            <div className="zen-incense-complete-card flex flex-col items-center text-center max-w-[360px]">
              <h2 id="zen-incense-sheet-title" className="zen-home-title zen-serif">
                {copy.doneTitle}
              </h2>
              <p
                id="zen-incense-sheet-desc"
                className="mt-3.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)] max-w-[300px]"
              >
                {copy.doneSub}
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={handleRelightIncense}
                  className="zen-ink-btn"
                >
                  {copy.relightBtn}
                </button>
                <button
                  type="button"
                  onClick={() => appActions.exitReview()}
                  className="zen-ink-ghost-btn"
                >
                  {copy.restBtn}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {lightboxTarget && (
        <ReviewerImageLightbox
          target={lightboxTarget}
          onClose={() => setLightboxTarget(null)}
        />
      )}
    </div>
  );
};
