import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ANKI_FLAG_PALETTE,
  CardFlagColor,
  REVIEW_CONTENT_SCALES,
  ReviewContentScale,
  ReviewDockPosition,
  ReviewStageWidth,
  triggerNativeHaptic,
} from '../../bridge/pycmd';
import { formatShortcut, translate } from '../../i18n/translations';
import { usePresence } from '../../hooks/usePresence';
import {
  appActions,
  getAppState,
  setAppState,
  showToast,
  useAppStore,
} from '../../stores/useAppStore';
import { renderMathAndRichHtml } from '../../utils/mathRenderer';
import {
  cardDebugSnapshotFromReviewCard,
  collectAndCopyCardDebugInfo,
} from '../../utils/cardDebugInfo';
import { getClosestFromTarget, isTypingTarget } from '../../utils/domTarget';
import { shouldTriggerSupportPromptModal } from '../../utils/supportPrompt';
import {
  resolveManualPlayAudioFiles,
  resolveVisibleAudioFiles,
} from '../../utils/reviewAudio';
import {
  cancelActiveSwipeDrag,
  computeSwipeFlyDurationMs,
  createSwipeGestureState,
  hasScrollableHorizontalAncestor,
  type NativeWheelPhase,
  resetSwipeForCardChange,
  SPRING_BACK_DURATION_MS,
  stepNativeWheelPhase,
  stepSwipeRelease,
  stepSwipeWheel,
  type SwipeReleaseDecision,
  type SwipeVisualPose,
  UNFLIPPED_WOBBLE_WATCHDOG_MS,
  WHEEL_NATIVE_WATCHDOG_MS,
  WHEEL_SILENCE_RELEASE_MS,
} from '../../utils/reviewSwipeGesture';
import { getAccentScale, resolveThemeMode } from '../../utils/themeTokens';
import { CopyDebugInfoButton } from '../common/CopyDebugInfoButton';
import { StudioSelect } from '../common/StudioSelect';
import {
  CelebrationIllustration,
  hasIllustrationPack,
  ReviewerCornerDecor,
} from '../common/ThemeIllustrations';
import { Tooltip } from '../common/Tooltip';
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, CloseIcon } from '../common/Icons';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';
import { LightboxTarget, ReviewerImageLightbox } from './ReviewerImageLightbox';
import { SandboxCardFrame } from './SandboxCardFrame';

export const ReviewerWidthGlyph: React.FC<{ mode: ReviewStageWidth; active: boolean }> = ({
  mode,
  active,
}) => {
  const innerRect =
    mode === 'standard'
      ? { x: 6, width: 6 }
      : mode === 'wide'
      ? { x: 4, width: 10 }
      : mode === 'full'
      ? { x: 2.5, width: 13 }
      : { x: 5, width: 8 };

  return (
    <svg
      className={`w-[18px] h-[14px] shrink-0 ${
        active ? 'text-[var(--brand-text)]' : 'text-[var(--text-secondary)]'
      }`}
      viewBox="0 0 18 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1.5"
        width="16"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity={active ? 0.6 : 0.45}
      />
      <rect
        x={innerRect.x}
        y="3.75"
        width={innerRect.width}
        height="6.5"
        rx="1"
        fill="currentColor"
        fillOpacity={active ? 0.28 : 0.12}
        stroke="currentColor"
        strokeWidth={active ? 1.25 : 1.1}
        strokeOpacity={active ? 0.95 : 0.78}
      />
      {mode === 'auto' && (
        <>
          <path
            d="M3.8 5.5 2.5 7l1.3 1.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={active ? 0.95 : 0.78}
          />
          <path
            d="M14.2 5.5 15.5 7l-1.3 1.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={active ? 0.95 : 0.78}
          />
        </>
      )}
    </svg>
  );
};

export const ReviewerDockPositionGlyph: React.FC<{
  mode: ReviewDockPosition;
  active: boolean;
}> = ({ mode, active }) => {
  const isSide = mode === 'side';
  return (
    <svg
      className={`w-[18px] h-[14px] shrink-0 ${isSide ? 'rtl:-scale-x-100' : ''} ${
        active ? 'text-[var(--brand-text)]' : 'text-[var(--text-secondary)]'
      }`}
      viewBox="0 0 18 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1.5"
        width="16"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity={active ? 0.6 : 0.45}
      />
      {isSide ? (
        <>
          <rect
            x="2.75"
            y="3.25"
            width="8.5"
            height="7.5"
            rx="0.9"
            fill="currentColor"
            fillOpacity={active ? 0.14 : 0.08}
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity={active ? 0.45 : 0.35}
          />
          <rect
            x="12.5"
            y="3.25"
            width="2.75"
            height="7.5"
            rx="0.7"
            fill="currentColor"
            fillOpacity={active ? 0.42 : 0.24}
            stroke="currentColor"
            strokeWidth={active ? 1.25 : 1.1}
            strokeOpacity={active ? 0.95 : 0.8}
          />
        </>
      ) : (
        <>
          <rect
            x="2.75"
            y="3.25"
            width="12.5"
            height="4.75"
            rx="0.9"
            fill="currentColor"
            fillOpacity={active ? 0.14 : 0.08}
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity={active ? 0.45 : 0.35}
          />
          <rect
            x="2.75"
            y="9.1"
            width="12.5"
            height="1.75"
            rx="0.7"
            fill="currentColor"
            fillOpacity={active ? 0.42 : 0.24}
            stroke="currentColor"
            strokeWidth={active ? 1.25 : 1.1}
            strokeOpacity={active ? 0.95 : 0.8}
          />
        </>
      )}
    </svg>
  );
};

export const ReviewerView: React.FC = () => {
  const {
    reviewQueue,
    currentCardIndex,
    isSessionComplete,
    isPreviewSession,
    isCardFlipped,
    sessionTotalTimeMs,
    revealedHintsCount,
    optionKeyHeld,
    answerButtonMode,
    sessionStudiedCount,
    sessionCorrectCount,
    inlineEditing,
    editingField,
    inspectorOpen,
    slashMenuOpen,
    playingAudioFile,
    decks,
    theme,
    systemDark,
    accentColor,
    resolvedLang,
    envInfo,
    showShortcutHints,
    showIllustrations,
    activeDeckId,
    reviewScopeDeckId,
    compatMode,
    sandboxNoteTypeIds,
    autoPlayFrontAudio,
    autoPlayBackAudio,
    reviewStageWidth,
    reviewContentScale,
    reviewDockPosition,
    reviewSwipeGestures,
    supportPrompt,
    zenMode,
    dashboard,
    undoStack,
    dayBoundary,
    pendingDayRollover,
    reviewSessionDayKey,
  } = useAppStore();

  const resolvedTheme = resolveThemeMode(theme, systemDark);
  const isDark = resolvedTheme === 'dark';
  const brandHex = getAccentScale(accentColor, resolvedTheme).brand;
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  const platform = envInfo.platform;
  const isMac = platform === 'mac' || envInfo.platform === 'mac';
  const isSideDock = reviewDockPosition === 'side';

  const currentCard = reviewQueue[currentCardIndex] || reviewQueue[0];
  const canUndo = undoStack.length > 0;

  const [fieldsDraft, setFieldsDraft] = useState<Record<string, string>>(currentCard?.fields || {});
  const [originalFieldsDraft, setOriginalFieldsDraft] = useState<Record<string, string>>(
    currentCard?.fields || {}
  );
  const [activeFieldKey, setActiveFieldKey] = useState<string>(editingField || '释义');
  const [newTagInput, setNewTagInput] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingForget, setConfirmingForget] = useState(false);
  const [flagPopoverOpen, setFlagPopoverOpen] = useState(false);
  const [displayPopoverOpen, setDisplayPopoverOpen] = useState(false);
  const [audioPopoverOpen, setAudioPopoverOpen] = useState(false);
  const [lightboxTarget, setLightboxTarget] = useState<LightboxTarget | null>(null);
  const [swipingDir, setSwipingDir] = useState<'left' | 'right' | null>(null);
  const [swipeFromGesture, setSwipeFromGesture] = useState(false);
  const [gestureFlyPose, setGestureFlyPose] = useState<SwipeVisualPose | null>(null);
  const [gestureFlyDurMs, setGestureFlyDurMs] = useState<number>(175);
  const swipeMachineRef = useRef(createSwipeGestureState());
  const swipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const springTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeWatchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingPoseRef = useRef<SwipeVisualPose | null>(null);
  const reducedMotionRef = useRef<boolean>(false);
  const lastPinchTsRef = useRef<number>(0);
  const prevLightboxOpenRef = useRef<boolean>(false);
  const stageScrollRef = useRef<HTMLDivElement>(null);
  const cardShellRef = useRef<HTMLDivElement>(null);
  const cardGlowGoodRef = useRef<HTMLDivElement>(null);
  const cardGlowAgainRef = useRef<HTMLDivElement>(null);
  const stampGoodRef = useRef<HTMLDivElement>(null);
  const stampAgainRef = useRef<HTMLDivElement>(null);
  const cardHeaderMetaRef = useRef<HTMLDivElement>(null);
  const pullPillRef = useRef<HTMLDivElement>(null);
  const dockFooterRef = useRef<HTMLElement>(null);
  const lastCardChangeReasonRef = useRef<'gesture' | 'already_reset' | 'other'>('other');
  const supportModalTriggeredRef = useRef(false);
  const inspectorPresence = usePresence(inspectorOpen, 180);
  const lastLightboxTargetRef = useRef<LightboxTarget | null>(null);
  if (lightboxTarget) {
    lastLightboxTargetRef.current = lightboxTarget;
  }
  const lightboxPresence = usePresence(Boolean(lightboxTarget), 140);

  const audioPopoverId = useId();
  const autoFrontSwitchId = useId();
  const autoBackSwitchId = useId();
  const flagPopoverId = useId();
  const displayPopoverId = useId();
  const compatSwitchId = useId();
  const supportsNativeSwitch =
    typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
  const [toolbarActiveIdx, setToolbarActiveIdx] = useState(0);

  const activeInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const audioAnchorRef = useRef<HTMLButtonElement>(null);
  const flagAnchorRef = useRef<HTMLButtonElement>(null);
  const displayAnchorRef = useRef<HTMLButtonElement>(null);
  const audioPopoverRef = useRef<HTMLDivElement>(null);
  const flagPopoverRef = useRef<HTMLDivElement>(null);
  const displayPopoverRef = useRef<HTMLDivElement>(null);

  const closePopoverEl = useCallback((el: HTMLDivElement | null) => {
    if (!el || typeof el.hidePopover !== 'function') return;
    try {
      if (el.matches?.(':popover-open')) {
        el.hidePopover();
      }
    } catch {
      // Ignore environments without Popover API
    }
  }, []);

  const syncPopoverFallbackPosition = useCallback(
    (popoverEl: HTMLDivElement | null, anchorEl: HTMLButtonElement | null) => {
      if (!popoverEl || !anchorEl || typeof window === 'undefined') return;
      const supportsAnchor =
        typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' &&
        CSS.supports('position-area', 'block-end') &&
        CSS.supports('anchor-name', '--rev-anchor');
      if (supportsAnchor) {
        popoverEl.style.removeProperty('top');
        popoverEl.style.removeProperty('left');
        return;
      }
      const rect = anchorEl.getBoundingClientRect();
      const popRect = popoverEl.getBoundingClientRect();
      const popWidth = popRect.width || 300;
      const popHeight = popRect.height || 260;
      const margin = 8;
      const isRtlDir =
        typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
      let left = isRtlDir ? rect.left : rect.right - popWidth;
      left = Math.max(margin, Math.min(left, window.innerWidth - popWidth - margin));
      let top = rect.bottom + 8;
      if (top + popHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - popHeight - 8);
      }
      popoverEl.style.left = `${left}px`;
      popoverEl.style.top = `${top}px`;
    },
    []
  );

  useEffect(() => {
    if (!audioPopoverOpen && !flagPopoverOpen && !displayPopoverOpen) return;
    if (typeof window === 'undefined') return;
    const onResize = () => {
      if (audioPopoverOpen) syncPopoverFallbackPosition(audioPopoverRef.current, audioAnchorRef.current);
      if (flagPopoverOpen) syncPopoverFallbackPosition(flagPopoverRef.current, flagAnchorRef.current);
      if (displayPopoverOpen) syncPopoverFallbackPosition(displayPopoverRef.current, displayAnchorRef.current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [audioPopoverOpen, flagPopoverOpen, displayPopoverOpen, syncPopoverFallbackPosition]);

  useEffect(() => {
    closePopoverEl(audioPopoverRef.current);
    closePopoverEl(flagPopoverRef.current);
    closePopoverEl(displayPopoverRef.current);
    setAudioPopoverOpen(false);
    setFlagPopoverOpen(false);
    setDisplayPopoverOpen(false);
  }, [isSideDock, closePopoverEl]);

  const hasDraftChanges = useMemo(() => {
    const allKeys = Array.from(
      new Set([...Object.keys(fieldsDraft), ...Object.keys(originalFieldsDraft)])
    );
    for (const k of allKeys) {
      if ((fieldsDraft[k] || '') !== (originalFieldsDraft[k] || '')) return true;
    }
    return false;
  }, [fieldsDraft, originalFieldsDraft]);

  useEffect(() => {
    setConfirmingDelete(false);
    setConfirmingForget(false);
    closePopoverEl(audioPopoverRef.current);
    closePopoverEl(flagPopoverRef.current);
    closePopoverEl(displayPopoverRef.current);
    setFlagPopoverOpen(false);
    setDisplayPopoverOpen(false);
    setAudioPopoverOpen(false);
    setLightboxTarget(null);
    if (swipeTimerRef.current) {
      clearTimeout(swipeTimerRef.current);
      swipeTimerRef.current = null;
    }
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    if (wheelSilenceTimerRef.current) {
      clearTimeout(wheelSilenceTimerRef.current);
      wheelSilenceTimerRef.current = null;
    }
    if (nativeWatchdogTimerRef.current) {
      clearTimeout(nativeWatchdogTimerRef.current);
      nativeWatchdogTimerRef.current = null;
    }
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    pendingPoseRef.current = null;
    setSwipingDir(null);
    setSwipeFromGesture(false);
    setGestureFlyPose(null);
    setGestureFlyDurMs(175);
    if (lastCardChangeReasonRef.current !== 'already_reset') {
      resetSwipeForCardChange(swipeMachineRef.current, performance.now(), {
        preserveCooldown: lastCardChangeReasonRef.current === 'gesture',
      });
    }
    lastCardChangeReasonRef.current = 'other';
    if (dockFooterRef.current) {
      dockFooterRef.current.dataset.gestureActiveSide = 'none';
    }
    if (pullPillRef.current) {
      pullPillRef.current.style.opacity = '0';
      pullPillRef.current.style.visibility = 'hidden';
      pullPillRef.current.dataset.visible = 'false';
      pullPillRef.current.dataset.ready = 'false';
    }
    if (stageScrollRef.current) {
      stageScrollRef.current.scrollTop = 0;
    }
    if (currentCard) {
      const fMap: Record<string, string> =
        currentCard.fields && Object.keys(currentCard.fields).length > 0
          ? { ...currentCard.fields }
          : {
              正面: currentCard.front,
              释义: currentCard.meaning,
              ...(currentCard.example ? { 例句: currentCard.example } : {}),
            };
      setFieldsDraft(fMap);
      setOriginalFieldsDraft(fMap);
      const keys = currentCard.fieldOrder || Object.keys(fMap);
      const meaningAliases = [
        '释义',
        '解释',
        '背面',
        'Back',
        'Meaning',
        'VocabDefSC',
        'Tiếng Việt',
        'English',
        'Explain1',
        'Back Extra',
      ];
      const preferredMeaningKey = keys.find(
        (k) => meaningAliases.includes(k) && (fMap[k] || '').trim()
      );
      if (editingField && editingField in fMap) {
        setActiveFieldKey(editingField);
      } else if (preferredMeaningKey) {
        setActiveFieldKey(preferredMeaningKey);
      } else if (keys.length > 1) {
        setActiveFieldKey(keys[1]);
      } else if (keys.length > 0) {
        setActiveFieldKey(keys[0]);
      }
    }
  }, [currentCard, editingField]);

  useEffect(() => {
    if (inlineEditing) {
      if (swipeTimerRef.current) {
        clearTimeout(swipeTimerRef.current);
        swipeTimerRef.current = null;
      }
      setSwipingDir(null);
      if (activeInputRef.current) {
        activeInputRef.current.focus();
      }
    }
  }, [inlineEditing, activeFieldKey]);

  const clearDragOverlaysDom = useCallback((keepStampsAndGlow: boolean) => {
    if (dockFooterRef.current) {
      dockFooterRef.current.dataset.gestureActiveSide = 'none';
    }
    const pill = pullPillRef.current;
    if (pill) {
      pill.style.opacity = '0';
      pill.style.visibility = 'hidden';
      pill.dataset.visible = 'false';
      pill.dataset.ready = 'false';
    }
    if (!keepStampsAndGlow) {
      if (cardGlowGoodRef.current) cardGlowGoodRef.current.style.opacity = '0';
      if (cardGlowAgainRef.current) cardGlowAgainRef.current.style.opacity = '0';
      const sg = stampGoodRef.current;
      if (sg) {
        sg.style.opacity = '0';
        sg.style.visibility = 'hidden';
        sg.dataset.visible = 'false';
      }
      const sa = stampAgainRef.current;
      if (sa) {
        sa.style.opacity = '0';
        sa.style.visibility = 'hidden';
        sa.dataset.visible = 'false';
      }
      if (cardHeaderMetaRef.current) {
        cardHeaderMetaRef.current.style.opacity = '';
      }
    }
  }, []);

  const resetDragDomImmediate = useCallback(() => {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    pendingPoseRef.current = null;
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    const shell = cardShellRef.current;
    if (shell) {
      shell.classList.remove('reviewer-card-dragging', 'reviewer-card-spring-back');
      shell.style.transform = '';
      shell.dataset.swipeAxis = 'idle';
      shell.dataset.swipeDir = 'none';
      shell.dataset.swipeThreshold = 'false';
    }
    clearDragOverlaysDom(false);
  }, [clearDragOverlaysDom]);

  const applyPoseToDom = useCallback(
    (pose: SwipeVisualPose, flipped: boolean) => {
      const shell = cardShellRef.current;
      if (!shell) return;
      if (!pose.isDragging) {
        resetDragDomImmediate();
        return;
      }

      shell.classList.remove('ui-card-enter', 'reviewer-card-spring-back');
      shell.classList.add('reviewer-card-dragging');
      shell.dataset.swipeAxis = pose.axis;
      shell.dataset.swipeDir = pose.direction || 'none';
      shell.dataset.swipeThreshold = pose.overThreshold ? 'true' : 'false';

      if (!reducedMotionRef.current) {
        shell.style.transform = `translate3d(${pose.visualX.toFixed(1)}px, ${pose.visualY.toFixed(1)}px, 0) rotate(${pose.rotationDeg.toFixed(2)}deg)`;
      }

      if (flipped && pose.axis === 'horizontal') {
        const isRight = pose.direction === 'right';
        const isLeft = pose.direction === 'left';
        const stampAlpha = pose.progress > 0.08 ? Math.min(1, pose.progress * 1.15) : 0;
        const stampScale = pose.overThreshold
          ? 1.05
          : Number((0.86 + pose.progress * 0.14).toFixed(3));
        const reduceMotion = reducedMotionRef.current;

        if (cardGlowGoodRef.current) {
          cardGlowGoodRef.current.style.opacity = isRight ? pose.progress.toFixed(3) : '0';
        }
        if (cardGlowAgainRef.current) {
          cardGlowAgainRef.current.style.opacity = isLeft ? pose.progress.toFixed(3) : '0';
        }

        const sg = stampGoodRef.current;
        if (sg) {
          const showGood = isRight && stampAlpha > 0;
          sg.style.opacity = showGood ? stampAlpha.toFixed(3) : '0';
          sg.style.visibility = showGood ? 'visible' : 'hidden';
          sg.dataset.visible = showGood ? 'true' : 'false';
          if (showGood) {
            sg.style.transform = reduceMotion ? 'rotate(-10deg)' : `rotate(-10deg) scale(${stampScale})`;
          }
        }

        const sa = stampAgainRef.current;
        if (sa) {
          const showAgain = isLeft && stampAlpha > 0;
          sa.style.opacity = showAgain ? stampAlpha.toFixed(3) : '0';
          sa.style.visibility = showAgain ? 'visible' : 'hidden';
          sa.dataset.visible = showAgain ? 'true' : 'false';
          if (showAgain) {
            sa.style.transform = reduceMotion ? 'rotate(10deg)' : `rotate(10deg) scale(${stampScale})`;
          }
        }

        if (cardHeaderMetaRef.current) {
          cardHeaderMetaRef.current.style.opacity =
            pose.progress > 0.05 ? Math.max(0.06, 1 - pose.progress * 1.45).toFixed(3) : '';
        }

        if (dockFooterRef.current) {
          dockFooterRef.current.dataset.gestureActiveSide =
            pose.overThreshold && (isLeft || isRight) ? (pose.direction as string) : 'none';
        }

        const pill = pullPillRef.current;
        if (pill && pill.dataset.visible === 'true') {
          pill.style.opacity = '0';
          pill.style.visibility = 'hidden';
          pill.dataset.visible = 'false';
          pill.dataset.ready = 'false';
        }
      } else if (!flipped && pose.axis === 'pull_flip') {
        if (cardGlowGoodRef.current) cardGlowGoodRef.current.style.opacity = '0';
        if (cardGlowAgainRef.current) cardGlowAgainRef.current.style.opacity = '0';
        if (dockFooterRef.current) dockFooterRef.current.dataset.gestureActiveSide = 'none';
        const pill = pullPillRef.current;
        if (pill) {
          const showPill = pose.progress > 0.08;
          pill.style.opacity = showPill ? Math.min(1, pose.progress * 1.15).toFixed(3) : '0';
          pill.style.visibility = showPill ? 'visible' : 'hidden';
          pill.dataset.visible = showPill ? 'true' : 'false';
          pill.dataset.ready = pose.pullFlipReady ? 'true' : 'false';
          if (showPill) {
            pill.style.transform = reducedMotionRef.current
              ? 'translate3d(-50%, 0px, 0)'
              : `translate3d(-50%, ${Math.round(
                  pose.visualY * 0.42
                )}px, 0) scale(${pose.pullFlipReady ? 1.04 : 0.96})`;
          }
        }
      } else {
        // Unflipped horizontal rubber-band wobble: pure transform, zero overlays.
        clearDragOverlaysDom(false);
      }
    },
    [clearDragOverlaysDom, resetDragDomImmediate]
  );

  const startSpringBackDom = useCallback(() => {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    pendingPoseRef.current = null;
    const shell = cardShellRef.current;
    if (shell) {
      shell.classList.remove('reviewer-card-dragging', 'ui-card-enter');
      shell.classList.add('reviewer-card-spring-back');
      shell.dataset.swipeAxis = 'idle';
      shell.dataset.swipeDir = 'none';
      shell.dataset.swipeThreshold = 'false';
      if (!reducedMotionRef.current) {
        shell.style.transform = 'translate3d(0px, 0px, 0) rotate(0deg)';
      } else {
        shell.style.transform = '';
      }
    }
    if (cardGlowGoodRef.current) cardGlowGoodRef.current.style.opacity = '0';
    if (cardGlowAgainRef.current) cardGlowAgainRef.current.style.opacity = '0';
    if (stampGoodRef.current) stampGoodRef.current.style.opacity = '0';
    if (stampAgainRef.current) stampAgainRef.current.style.opacity = '0';
    if (cardHeaderMetaRef.current) cardHeaderMetaRef.current.style.opacity = '';
    if (dockFooterRef.current) dockFooterRef.current.dataset.gestureActiveSide = 'none';
    const pill = pullPillRef.current;
    if (pill) {
      pill.style.opacity = '0';
      pill.style.visibility = 'hidden';
      pill.dataset.visible = 'false';
      pill.dataset.ready = 'false';
    }
    if (springTimerRef.current) clearTimeout(springTimerRef.current);
    springTimerRef.current = setTimeout(() => {
      springTimerRef.current = null;
      const s = cardShellRef.current;
      if (s) {
        s.classList.remove('reviewer-card-spring-back');
        s.style.transform = '';
      }
      if (stampGoodRef.current) {
        stampGoodRef.current.style.visibility = 'hidden';
        stampGoodRef.current.dataset.visible = 'false';
      }
      if (stampAgainRef.current) {
        stampAgainRef.current.style.visibility = 'hidden';
        stampAgainRef.current.dataset.visible = 'false';
      }
    }, SPRING_BACK_DURATION_MS);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const onChange = (ev: MediaQueryListEvent) => {
      reducedMotionRef.current = ev.matches;
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  useLayoutEffect(() => {
    if (!swipingDir) return;
    const shell = cardShellRef.current;
    if (shell) {
      shell.classList.remove('reviewer-card-dragging', 'reviewer-card-spring-back');
      shell.style.transform = '';
      shell.dataset.swipeAxis = 'idle';
      shell.dataset.swipeDir = 'none';
      shell.dataset.swipeThreshold = 'false';
    }
  }, [swipingDir]);

  useLayoutEffect(() => {
    resetDragDomImmediate();
  }, [currentCard?.id, resetDragDomImmediate]);

  const gestureGuardRef = useRef({
    isSessionComplete,
    currentCardId: currentCard?.id || '',
    isCardFlipped,
    inlineEditing,
    lightboxOpen: Boolean(lightboxTarget),
    popoverOpen: flagPopoverOpen || displayPopoverOpen || audioPopoverOpen,
    swipingDir,
    reviewSwipeGestures,
  });
  gestureGuardRef.current = {
    isSessionComplete,
    currentCardId: currentCard?.id || '',
    isCardFlipped,
    inlineEditing,
    lightboxOpen: Boolean(lightboxTarget),
    popoverOpen: flagPopoverOpen || displayPopoverOpen || audioPopoverOpen,
    swipingDir,
    reviewSwipeGestures,
  };

  const triggerRateWithSwipe = useCallback(
    (ease: 1 | 2 | 3 | 4, gesturePose?: SwipeVisualPose | null, velocityX?: number) => {
      if (swipingDir || gestureGuardRef.current.swipingDir) return;
      const fromGesture = Boolean(gesturePose);
      if (fromGesture) {
        appActions.trackFeature('swipe_gesture');
      }
      if (reducedMotionRef.current) {
        resetDragDomImmediate();
        if (fromGesture) {
          lastCardChangeReasonRef.current = 'gesture';
        }
        appActions.answerCurrentCard(ease);
        return;
      }
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
      }
      if (!fromGesture) {
        resetDragDomImmediate();
      } else if (dockFooterRef.current) {
        dockFooterRef.current.dataset.gestureActiveSide = 'none';
      }
      lastCardChangeReasonRef.current = fromGesture ? 'gesture' : 'other';
      setSwipeFromGesture(fromGesture);
      setGestureFlyPose(fromGesture && gesturePose ? gesturePose : null);
      const dir: 'left' | 'right' =
        gesturePose?.direction === 'left' || gesturePose?.direction === 'right'
          ? gesturePose.direction
          : ease <= 2
          ? 'left'
          : 'right';
      const flyDurationMs = fromGesture ? computeSwipeFlyDurationMs(velocityX ?? 0) : 260;
      setGestureFlyDurMs(flyDurationMs);
      gestureGuardRef.current.swipingDir = dir;
      setSwipingDir(dir);
      swipeTimerRef.current = setTimeout(() => {
        swipeTimerRef.current = null;
        if (dragRafRef.current !== null) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        pendingPoseRef.current = null;
        if (wheelSilenceTimerRef.current) {
          clearTimeout(wheelSilenceTimerRef.current);
          wheelSilenceTimerRef.current = null;
        }
        if (nativeWatchdogTimerRef.current) {
          clearTimeout(nativeWatchdogTimerRef.current);
          nativeWatchdogTimerRef.current = null;
        }
        resetSwipeForCardChange(swipeMachineRef.current, performance.now(), {
          preserveCooldown: fromGesture,
        });
        lastCardChangeReasonRef.current = 'already_reset';
        setSwipingDir(null);
        setSwipeFromGesture(false);
        setGestureFlyPose(null);
        setGestureFlyDurMs(175);
        appActions.answerCurrentCard(ease);
      }, flyDurationMs);
    },
    [swipingDir, resetDragDomImmediate]
  );

  const applySwipeReleaseDecision = useCallback(
    (decision: SwipeReleaseDecision) => {
      if (wheelSilenceTimerRef.current) {
        clearTimeout(wheelSilenceTimerRef.current);
        wheelSilenceTimerRef.current = null;
      }
      if (nativeWatchdogTimerRef.current) {
        clearTimeout(nativeWatchdogTimerRef.current);
        nativeWatchdogTimerRef.current = null;
      }
      if (decision.kind === 'rate') {
        if (dragRafRef.current !== null) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        pendingPoseRef.current = null;
        // Flush final pose stamps/glows cleanly so they stay visible during fly-off.
        applyPoseToDom(decision.pose, true);
        if (decision.hapticPattern) {
          triggerNativeHaptic(decision.hapticPattern);
        }
        triggerRateWithSwipe(decision.ease, decision.pose, decision.velocityX);
        return;
      }
      if (decision.kind === 'flip') {
        if (decision.hapticPattern) {
          triggerNativeHaptic(decision.hapticPattern);
        }
        resetDragDomImmediate();
        appActions.trackFeature('swipe_gesture');
        appActions.flipCard();
        return;
      }
      if (decision.kind === 'spring') {
        startSpringBackDom();
      }
    },
    [applyPoseToDom, resetDragDomImmediate, startSpringBackDom, triggerRateWithSwipe]
  );

  const applySwipeReleaseRef = useRef(applySwipeReleaseDecision);
  applySwipeReleaseRef.current = applySwipeReleaseDecision;
  const applyPoseToDomRef = useRef(applyPoseToDom);
  applyPoseToDomRef.current = applyPoseToDom;
  const startSpringBackRef = useRef(startSpringBackDom);
  startSpringBackRef.current = startSpringBackDom;

  useEffect(() => {
    if (wheelSilenceTimerRef.current) {
      clearTimeout(wheelSilenceTimerRef.current);
      wheelSilenceTimerRef.current = null;
    }
    if (nativeWatchdogTimerRef.current) {
      clearTimeout(nativeWatchdogTimerRef.current);
      nativeWatchdogTimerRef.current = null;
    }
    cancelActiveSwipeDrag(swipeMachineRef.current);
    resetDragDomImmediate();
  }, [isCardFlipped, resetDragDomImmediate]);

  useEffect(() => {
    if (reviewSwipeGestures) return;
    if (wheelSilenceTimerRef.current) {
      clearTimeout(wheelSilenceTimerRef.current);
      wheelSilenceTimerRef.current = null;
    }
    if (nativeWatchdogTimerRef.current) {
      clearTimeout(nativeWatchdogTimerRef.current);
      nativeWatchdogTimerRef.current = null;
    }
    const machine = swipeMachineRef.current;
    cancelActiveSwipeDrag(machine);
    machine.nativePhaseInFlight = false;
    machine.momentumLocked = false;
    resetDragDomImmediate();
  }, [reviewSwipeGestures, resetDragDomImmediate]);

  useEffect(() => {
    const isOpen = Boolean(lightboxTarget);
    if (!prevLightboxOpenRef.current && isOpen) {
      appActions.trackFeature('image_lightbox');
    } else if (prevLightboxOpenRef.current && !isOpen) {
      // Closing image lightbox: latch brief cooldown so residual zoom/pan inertia never leaks to card.
      resetSwipeForCardChange(swipeMachineRef.current, performance.now(), {
        preserveCooldown: true,
      });
      resetDragDomImmediate();
    }
    prevLightboxOpenRef.current = isOpen;
  }, [lightboxTarget, resetDragDomImmediate]);

  useEffect(() => {
    const isBlocked = (eventTarget?: EventTarget | null): boolean => {
      const g = gestureGuardRef.current;
      if (
        !g.reviewSwipeGestures ||
        g.isSessionComplete ||
        !g.currentCardId ||
        g.inlineEditing ||
        g.lightboxOpen ||
        g.popoverOpen ||
        g.swipingDir !== null
      ) {
        return true;
      }
      // Suspend trackpad swipe/flip whenever the viewport is pinch-zoomed so two-finger panning works naturally.
      if (
        typeof window !== 'undefined' &&
        window.visualViewport &&
        window.visualViewport.scale > 1.01
      ) {
        return true;
      }
      if (performance.now() - lastPinchTsRef.current < 280) {
        return true;
      }
      const appState = getAppState();
      if (
        !appState.inReviewMode ||
        appState.zenMode ||
        Boolean(appState.editingCardData) ||
        appState.cmdKOpen ||
        appState.quickAddOpen ||
        appState.settingsOpen ||
        appState.vacationModalOpen ||
        appState.icuModalOpen ||
        appState.rescueModalOpen ||
        appState.receiptModalOpen ||
        appState.customStudyModalOpen ||
        appState.slashMenuOpen
      ) {
        return true;
      }
      if (eventTarget && isTypingTarget(eventTarget)) return true;
      if (
        eventTarget &&
        getClosestFromTarget(
          eventTarget,
          '[role="dialog"], [role="alertdialog"], [popover], .studio-popover'
        )
      ) {
        return true;
      }
      return false;
    };

    const scheduleSilenceRelease = () => {
      if (wheelSilenceTimerRef.current) {
        clearTimeout(wheelSilenceTimerRef.current);
        wheelSilenceTimerRef.current = null;
      }
      if (nativeWatchdogTimerRef.current) {
        clearTimeout(nativeWatchdogTimerRef.current);
        nativeWatchdogTimerRef.current = null;
      }
      const machine = swipeMachineRef.current;
      if (machine.nativePhaseInFlight) {
        // Watchdog recovery if Qt6 ScrollEnd is dropped. Unflipped horizontal wobble
        // cannot commit, so snap it back crisply in 180ms; flipped/pull-flip allow 1400ms hold.
        const watchdogMs =
          !gestureGuardRef.current.isCardFlipped && machine.axis === 'horizontal'
            ? UNFLIPPED_WOBBLE_WATCHDOG_MS
            : WHEEL_NATIVE_WATCHDOG_MS;
        nativeWatchdogTimerRef.current = setTimeout(() => {
          nativeWatchdogTimerRef.current = null;
          const m = swipeMachineRef.current;
          if (!m.nativePhaseInFlight) return;
          m.nativePhaseInFlight = false;
          const decision = stepSwipeRelease(
            m,
            gestureGuardRef.current.isCardFlipped,
            performance.now(),
            false
          );
          applySwipeReleaseRef.current(decision);
        }, watchdogMs);
        return;
      }
      wheelSilenceTimerRef.current = setTimeout(() => {
        wheelSilenceTimerRef.current = null;
        const g = gestureGuardRef.current;
        const decision = stepSwipeRelease(
          swipeMachineRef.current,
          g.isCardFlipped,
          performance.now(),
          !swipeMachineRef.current.nativeWheelActive
        );
        applySwipeReleaseRef.current(decision);
      }, WHEEL_SILENCE_RELEASE_MS);
    };

    const flushDragFrame = () => {
      dragRafRef.current = null;
      const pose = pendingPoseRef.current;
      pendingPoseRef.current = null;
      if (!pose) return;
      applyPoseToDomRef.current(pose, gestureGuardRef.current.isCardFlipped);
    };

    const processWheelDelta = (
      params: {
        deltaX: number;
        deltaY: number;
        deltaMode: number;
        hasHorizontalScrollableAncestor: boolean;
        hasVerticalScrollableAncestor?: boolean;
      },
      preventDefault?: () => void
    ) => {
      const g = gestureGuardRef.current;
      const machine = swipeMachineRef.current;
      const stageEl = stageScrollRef.current;
      // Only read scrollTop before axis locks to avoid synchronous layout thrashing during drag.
      const stageAtTop = stageEl ? stageEl.scrollTop <= 1 : true;
      const atScrollTop =
        machine.axis === 'idle'
          ? stageAtTop && !params.hasVerticalScrollableAncestor
          : true;
      const res = stepSwipeWheel(machine, {
        deltaX: params.deltaX,
        deltaY: params.deltaY,
        deltaMode: params.deltaMode,
        timestampMs: performance.now(),
        isCardFlipped: g.isCardFlipped,
        atScrollTop,
        hasHorizontalScrollableAncestor: params.hasHorizontalScrollableAncestor,
      });
      if (!res.handled) return;
      preventDefault?.();
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
      }
      pendingPoseRef.current = res.pose;
      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(flushDragFrame);
      }
      if (res.hapticPattern) {
        triggerNativeHaptic(res.hapticPattern);
      }
      scheduleSilenceRelease();
    };

    const notePinchActivity = () => {
      lastPinchTsRef.current = performance.now();
      const machine = swipeMachineRef.current;
      if (cancelActiveSwipeDrag(machine)) {
        applySwipeReleaseRef.current({
          kind: 'spring',
          pose: {
            visualX: 0,
            visualY: 0,
            rotationDeg: 0,
            progress: 0,
            direction: null,
            overThreshold: false,
            pullFlipReady: false,
            axis: 'idle',
            isDragging: false,
          },
        });
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        notePinchActivity();
        return;
      }
      const machine = swipeMachineRef.current;
      const alreadyLocked = machine.axis !== 'idle';
      const targetEl =
        e.target instanceof Element
          ? e.target
          : e.target instanceof Node
          ? e.target.parentElement
          : null;
      if (isBlocked(alreadyLocked ? undefined : targetEl)) return;
      const stageEl = stageScrollRef.current;
      if (!stageEl) return;
      if (!alreadyLocked && (!targetEl || !stageEl.contains(targetEl))) {
        return;
      }
      // Measure horizontal scrollable ancestors only before gesture locks onto an axis.
      const hasHScroll = alreadyLocked
        ? false
        : hasScrollableHorizontalAncestor(targetEl, stageEl, e.deltaX);
      processWheelDelta(
        {
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaMode: e.deltaMode,
          hasHorizontalScrollableAncestor: hasHScroll,
        },
        () => e.preventDefault()
      );
    };

    const onSandboxPinch = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as { cardId?: string } | undefined;
      if (!detail || detail.cardId !== gestureGuardRef.current.currentCardId) return;
      notePinchActivity();
    };

    const onSandboxWheel = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as
        | {
            cardId?: string;
            deltaX?: number;
            deltaY?: number;
            deltaMode?: number;
            hasInnerHScroll?: boolean;
            hasInnerVScroll?: boolean;
          }
        | undefined;
      if (!detail || detail.cardId !== gestureGuardRef.current.currentCardId) return;
      if (isBlocked()) return;
      processWheelDelta({
        deltaX: Number(detail.deltaX || 0),
        deltaY: Number(detail.deltaY || 0),
        deltaMode: Number(detail.deltaMode || 0),
        hasHorizontalScrollableAncestor: Boolean(detail.hasInnerHScroll),
        hasVerticalScrollableAncestor: Boolean(detail.hasInnerVScroll),
      });
    };

    const onNativeWheelPhase = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as
        | { phase?: NativeWheelPhase; inverted?: boolean }
        | undefined;
      if (!detail || !detail.phase) return;
      if (
        detail.phase === 'momentum' ||
        detail.phase === 'end' ||
        detail.phase === 'mouse' ||
        detail.phase === 'touchpad'
      ) {
        if (nativeWatchdogTimerRef.current) {
          clearTimeout(nativeWatchdogTimerRef.current);
          nativeWatchdogTimerRef.current = null;
        }
      }
      const g = gestureGuardRef.current;
      // While the outgoing card is mid-fly-off, ignore begin/momentum/end so stray trailing
      // touches or finger-lift End phases never clear momentum lock before the next card mounts.
      if (g.swipingDir !== null && detail.phase !== 'mouse') {
        return;
      }
      if (
        isBlocked() &&
        detail.phase !== 'begin' &&
        detail.phase !== 'end' &&
        detail.phase !== 'mouse'
      ) {
        return;
      }
      const decision = stepNativeWheelPhase(
        swipeMachineRef.current,
        detail.phase,
        Boolean(detail.inverted),
        g.isCardFlipped,
        performance.now()
      );
      applySwipeReleaseRef.current(decision);
    };

    const abortInFlightGesture = () => {
      if (wheelSilenceTimerRef.current) {
        clearTimeout(wheelSilenceTimerRef.current);
        wheelSilenceTimerRef.current = null;
      }
      if (nativeWatchdogTimerRef.current) {
        clearTimeout(nativeWatchdogTimerRef.current);
        nativeWatchdogTimerRef.current = null;
      }
      if (gestureGuardRef.current.swipingDir) return;
      const machine = swipeMachineRef.current;
      machine.nativePhaseInFlight = false;
      machine.momentumLocked = false;
      if (cancelActiveSwipeDrag(machine)) {
        startSpringBackRef.current();
      }
    };

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        abortInFlightGesture();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('blur', abortInFlightGesture);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('anki:sandbox-wheel', onSandboxWheel as EventListener);
    window.addEventListener('anki:sandbox-pinch', onSandboxPinch as EventListener);
    window.addEventListener('anki:wheel-phase', onNativeWheelPhase as EventListener);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('blur', abortInFlightGesture);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('anki:sandbox-wheel', onSandboxWheel as EventListener);
      window.removeEventListener('anki:sandbox-pinch', onSandboxPinch as EventListener);
      window.removeEventListener('anki:wheel-phase', onNativeWheelPhase as EventListener);
      if (wheelSilenceTimerRef.current) {
        clearTimeout(wheelSilenceTimerRef.current);
        wheelSilenceTimerRef.current = null;
      }
      if (nativeWatchdogTimerRef.current) {
        clearTimeout(nativeWatchdogTimerRef.current);
        nativeWatchdogTimerRef.current = null;
      }
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
      }
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, []);

  const commitInlineChanges = (nextFields?: Record<string, string>) => {
    if (!currentCard) return;
    const finalFields = nextFields || fieldsDraft;
    const keys = currentCard.fieldOrder || Object.keys(finalFields);
    const frontAliases = [
      '正面',
      'Front',
      'Text',
      'Word',
      'Expression',
      '单词',
      'VocabKanji',
      'Mặt trước',
      '中文',
    ];
    const meaningAliases = [
      '释义',
      '解释',
      '背面',
      'Back',
      'Meaning',
      'VocabDefSC',
      'Tiếng Việt',
      'English',
      'Explain1',
      'Back Extra',
    ];
    const frontKey =
      keys.find((k) => frontAliases.includes(k) && (finalFields[k] || '').trim()) ||
      keys.find((k) => frontAliases.includes(k)) ||
      keys[0] ||
      '正面';
    const meaningKey =
      keys.find(
        (k) => k !== frontKey && meaningAliases.includes(k) && (finalFields[k] || '').trim()
      ) ||
      keys.find((k) => k !== frontKey && meaningAliases.includes(k)) ||
      keys.find((k) => k !== frontKey) ||
      frontKey;
    const exampleKey = keys.find(
      (k) => k === '例句' || k === 'Example' || k === 'Example1' || k === 'SentKanji1'
    );
    const etymKey = keys.find((k) => k === '词源' || k === '字源' || k === 'Etymology');
    const readingKey = keys.find(
      (k) =>
        k === '读音' ||
        k === '音标' ||
        k === 'Reading' ||
        k === 'Pinyin' ||
        k === 'Phiên âm' ||
        k === 'VocabFurigana'
    );

    appActions.saveInlineCardUpdate({
      fields: finalFields,
      front: finalFields[frontKey] ?? currentCard.front,
      meaning: finalFields[meaningKey] ?? currentCard.meaning,
      example: exampleKey ? finalFields[exampleKey] : currentCard.example,
      etymology: etymKey ? finalFields[etymKey] : currentCard.etymology,
      reading: readingKey ? finalFields[readingKey] : currentCard.reading,
      frontHtml: finalFields[frontKey] ?? currentCard.frontHtml,
      frontAnswerHtml: finalFields[frontKey] ?? currentCard.frontAnswerHtml,
      backHtml: finalFields[meaningKey] ?? currentCard.backHtml,
    });
  };

  const manualAudioFiles = resolveManualPlayAudioFiles(currentCard, isCardFlipped);
  const visibleAudioFiles = resolveVisibleAudioFiles(currentCard, isCardFlipped);

  const supportsNativeFocusGroup =
    typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype;

  const syncToolbarTabStops = useCallback(() => {
    if (supportsNativeFocusGroup) return;
    const container = toolbarRef.current;
    if (!container) return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-toolbar-item]:not(:disabled)')
    );
    if (items.length === 0) return;
    const clampedIdx = Math.min(toolbarActiveIdx, items.length - 1);
    items.forEach((el, idx) => {
      el.tabIndex = idx === clampedIdx ? 0 : -1;
    });
  }, [supportsNativeFocusGroup, toolbarActiveIdx]);

  useEffect(() => {
    syncToolbarTabStops();
  }, [syncToolbarTabStops, inlineEditing, isSessionComplete, manualAudioFiles.length, currentCard?.id, isSideDock]);

  const handleToolbarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (supportsNativeFocusGroup) return;
    const container = toolbarRef.current;
    if (!container) return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-toolbar-item]:not(:disabled)')
    );
    if (items.length === 0) return;
    const activeEl = document.activeElement as HTMLElement | null;
    const currentIndex = Math.max(0, items.indexOf(activeEl as HTMLElement));
    const isRtlDir =
      typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIndex = isRtlDir
        ? (currentIndex - 1 + items.length) % items.length
        : (currentIndex + 1) % items.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = isRtlDir
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      setToolbarActiveIdx(nextIndex);
      items.forEach((el, idx) => {
        el.tabIndex = idx === nextIndex ? 0 : -1;
      });
      items[nextIndex]?.focus();
    }
  };

  const handleToolbarFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (supportsNativeFocusGroup) return;
    const container = toolbarRef.current;
    const target = e.target as HTMLElement | null;
    if (!container || !target || !target.hasAttribute('data-toolbar-item')) return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-toolbar-item]:not(:disabled)')
    );
    const idx = items.indexOf(target);
    if (idx >= 0 && idx !== toolbarActiveIdx) {
      setToolbarActiveIdx(idx);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAppState({ optionKeyHeld: true });
      }

      const { settingsOpen, cmdKOpen, quickAddOpen, supportPromptModalOpen } = getAppState();
      if (settingsOpen || cmdKOpen || quickAddOpen || supportPromptModalOpen) {
        return;
      }

      if (isSessionComplete || !currentCard) {
        if (e.key === 'Escape') {
          e.preventDefault();
          appActions.exitReview();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          appActions.undoLastReview();
        }
        return;
      }

      if (inlineEditing) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          commitInlineChanges();
          appActions.exitInlineEdit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (slashMenuOpen) {
            setAppState({ slashMenuOpen: false });
          } else {
            setFieldsDraft({ ...originalFieldsDraft });
            appActions.exitInlineEdit();
          }
        } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setFieldsDraft((prev) => ({
            ...prev,
            [activeFieldKey]: `${prev[activeFieldKey] || ''} {{c1::...}}`,
          }));
          showToast(t('clozeBadge'));
        }
        return;
      }

      // CardEditorModal uses a contentEditable DIV, which is not in the tag
      // whitelist: typing a space or digit used to flip/grade the card instead.
      // event.target can be document on some Windows/WebView setups (no closest),
      // so the check lives in a defensive, unit-tested helper.
      if (isTypingTarget(e.target)) {
        return;
      }

      // 7-Color Flag Shortcuts: Cmd+1..7 (or Ctrl+1..7) toggles flag 1..7, Cmd+0 clears flag
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && /^[0-7]$/.test(e.key)) {
        e.preventDefault();
        const flagVal = parseInt(e.key, 10) as CardFlagColor;
        appActions.setCurrentReviewCardFlag(flagVal, true);
        return;
      }

      // Scoped Card Content Scale Shortcuts: Cmd/Ctrl + =/+ (zoom in), -/_ (zoom out), Shift+0 (reset 100%)
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const curIdx = REVIEW_CONTENT_SCALES.indexOf(reviewContentScale);
        const nextScale =
          REVIEW_CONTENT_SCALES[Math.min(REVIEW_CONTENT_SCALES.length - 1, Math.max(0, (curIdx >= 0 ? curIdx : 1) + 1))];
        if (nextScale !== reviewContentScale) {
          appActions.updatePreferences({ reviewContentScale: nextScale });
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const curIdx = REVIEW_CONTENT_SCALES.indexOf(reviewContentScale);
        const nextScale =
          REVIEW_CONTENT_SCALES[Math.min(REVIEW_CONTENT_SCALES.length - 1, Math.max(0, (curIdx >= 0 ? curIdx : 1) - 1))];
        if (nextScale !== reviewContentScale) {
          appActions.updatePreferences({ reviewContentScale: nextScale });
        }
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === '0' || e.key === ')' || e.code === 'Digit0')
      ) {
        e.preventDefault();
        if (reviewContentScale !== 100 || reviewStageWidth !== 'auto') {
          appActions.updatePreferences({ reviewContentScale: 100, reviewStageWidth: 'auto' });
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        const audioNativeOpen = Boolean(audioPopoverRef.current?.matches?.(':popover-open'));
        const displayNativeOpen = Boolean(displayPopoverRef.current?.matches?.(':popover-open'));
        const flagNativeOpen = Boolean(flagPopoverRef.current?.matches?.(':popover-open'));
        if (lightboxTarget) {
          setLightboxTarget(null);
        } else if (audioPopoverOpen || audioNativeOpen) {
          closePopoverEl(audioPopoverRef.current);
          setAudioPopoverOpen(false);
        } else if (displayPopoverOpen || displayNativeOpen) {
          closePopoverEl(displayPopoverRef.current);
          setDisplayPopoverOpen(false);
        } else if (flagPopoverOpen || flagNativeOpen) {
          closePopoverEl(flagPopoverRef.current);
          setFlagPopoverOpen(false);
        } else if (confirmingForget || confirmingDelete) {
          setConfirmingForget(false);
          setConfirmingDelete(false);
        } else {
          appActions.exitReview();
        }
        return;
      }

      if (
        audioPopoverOpen ||
        displayPopoverOpen ||
        flagPopoverOpen ||
        getClosestFromTarget(e.target, '.reviewer-popover')
      ) {
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        // 原生 Anki：空格在正面显示答案，在背面等于「良好」。
        if (isCardFlipped) {
          triggerRateWithSwipe(3);
        } else {
          appActions.flipCard();
        }
        return;
      }

      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        appActions.playAudio(manualAudioFiles);
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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setAppState((prev) => ({ inspectorOpen: !prev.inspectorOpen }));
        return;
      }

      if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (currentCard) {
          appActions.openCardEditor(currentCard);
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (!isCardFlipped) {
          appActions.flipCard();
        } else {
          appActions.revealNextHint();
        }
        return;
      }

      if (!isCardFlipped) {
        if (e.key === 'Enter') {
          e.preventDefault();
          appActions.flipCard();
        }
        return;
      }

      if (answerButtonMode === 'four' || optionKeyHeld || e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          triggerRateWithSwipe(1);
        } else if (e.key === '2') {
          e.preventDefault();
          triggerRateWithSwipe(2);
        } else if (e.key === '3' || e.key === 'Enter') {
          e.preventDefault();
          triggerRateWithSwipe(3);
        } else if (e.key === '4') {
          e.preventDefault();
          triggerRateWithSwipe(4);
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          triggerRateWithSwipe(1);
        } else if (e.key === '2' || e.key === '3' || e.key === 'Enter') {
          e.preventDefault();
          triggerRateWithSwipe(3);
        } else if (e.key === '4') {
          e.preventDefault();
          triggerRateWithSwipe(4);
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
    inlineEditing,
    slashMenuOpen,
    fieldsDraft,
    activeFieldKey,
    optionKeyHeld,
    answerButtonMode,
    isCardFlipped,
    isSessionComplete,
    currentCard,
    resolvedLang,
    lightboxTarget,
    audioPopoverOpen,
    displayPopoverOpen,
    flagPopoverOpen,
    confirmingForget,
    confirmingDelete,
    closePopoverEl,
    manualAudioFiles,
    reviewContentScale,
    reviewStageWidth,
    triggerRateWithSwipe,
  ]);

  useEffect(() => {
    if (!inspectorOpen) {
      setConfirmingDelete(false);
      setConfirmingForget(false);
    }
  }, [inspectorOpen]);

  // 会话按 100 张一批从调度器取；续批时 currentCardIndex 会归零，直接用它算进度
  // 会跳回 1/100。这里用「已学张数」跨批累计：batchStartStudied 是当前批之前已学的数量。
  const batchStartStudied = Math.max(0, sessionStudiedCount - currentCardIndex);
  const totalSessionCards = Math.max(1, batchStartStudied + reviewQueue.length);
  const currentNumber = Math.min(totalSessionCards, sessionStudiedCount + 1);
  const progressPct = isSessionComplete ? 100 : Math.round((currentNumber / totalSessionCards) * 100);

  const accuracyPct =
    sessionStudiedCount > 0 ? Math.round((sessionCorrectCount / sessionStudiedCount) * 100) : 0;
  const avgSecDisplay =
    sessionStudiedCount > 0 ? (sessionTotalTimeMs / sessionStudiedCount / 1000).toFixed(1) : '0.0';

  // Item #6: Strict Light / Dark Surface Tokens
  const screenBg = isDark
    ? 'bg-[#131418] text-[#F2F3F7]'
    : 'bg-[var(--bg-canvas)] text-[#1D1D1F]';

  const headerBtnSurface = isDark
    ? 'bg-[#17181E] border-white/[0.08] text-[var(--text-secondary)] hover:text-white'
    : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[#1D1D1F] shadow-2xs';

  const cardContainerSurface = isDark
    ? 'bg-[#16171D] border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.65)] text-white'
    : 'bg-[var(--bg-card)] border-[var(--border-subtle)] shadow-[0_20px_50px_rgba(0,0,0,0.07)] text-[#1D1D1F]';

  const inspectorSurface = isDark
    ? 'bg-[#121318]/96 border-white/[0.07] text-[var(--text-primary)]'
    : 'bg-[var(--bg-card)]/96 border-[var(--border-subtle)] text-[var(--text-primary)] shadow-[-12px_0_36px_rgba(0,0,0,0.06)]';

  const inspectorActionIdle = isDark
    ? 'bg-white/[0.03] border-white/[0.09] text-[var(--text-primary)] hover:bg-white/[0.08] hover:border-white/[0.16] cursor-pointer'
    : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)] shadow-[0_1px_1.5px_rgba(20,24,32,0.03)] hover:bg-[var(--bg-subtle)] hover:border-[var(--brand-border)]/70 cursor-pointer';

  const inspectorActionDisabled = isDark
    ? 'bg-transparent border-white/[0.05] text-[var(--text-muted)] opacity-45 cursor-not-allowed'
    : 'bg-transparent border-[var(--border-subtle)]/55 text-[var(--text-muted)] opacity-45 cursor-not-allowed';

  const inspectorDangerIdle = isDark
    ? 'bg-white/[0.03] border-white/[0.09] text-[var(--status-danger-text)] hover:bg-[var(--status-danger-soft)] hover:border-[var(--status-danger)]/40 cursor-pointer'
    : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--status-danger-text)] shadow-[0_1px_1.5px_rgba(20,24,32,0.03)] hover:bg-[var(--status-danger-soft)] hover:border-[var(--status-danger)]/35 cursor-pointer';

  // 组件卸载（返回首页 / 切页签 / 完成复习）时兜底停掉原生音频：
  // 音频由 Anki 的 AVPlayer 播放，不随 React 组件销毁而停止。
  useEffect(() => {
    return () => {
      if (swipeTimerRef.current) clearTimeout(swipeTimerRef.current);
      appActions.stopAudio();
    };
  }, []);

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
  const streakDaysForPrompt = dashboard.streak?.current ?? 0;

  // Option B: After lingering on Session Complete for 800ms, smoothly open the celebratory
  // support modal when the scientific cadence & peak-end quality gates pass.
  useEffect(() => {
    if (!isSessionComplete) {
      supportModalTriggeredRef.current = false;
      return;
    }
    if (supportModalTriggeredRef.current) {
      return;
    }
    const eligible = shouldTriggerSupportPromptModal({
      state: supportPrompt,
      streakDays: streakDaysForPrompt,
      sessionStudiedCount,
      sessionAccuracyPct: accuracyPct,
      isPreviewSession,
      isNewDayReady,
      zenMode,
      studioVersion: envInfo.studioVersion || '',
    });
    if (!eligible) {
      return;
    }
    const timer = window.setTimeout(() => {
      const { settingsOpen, cmdKOpen, quickAddOpen, zenMode: liveZen } = getAppState();
      if (settingsOpen || cmdKOpen || quickAddOpen || liveZen) {
        return;
      }
      supportModalTriggeredRef.current = true;
      appActions.openSupportPromptModal(false);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    isSessionComplete,
    supportPrompt,
    streakDaysForPrompt,
    sessionStudiedCount,
    accuracyPct,
    isPreviewSession,
    isNewDayReady,
    zenMode,
    envInfo.studioVersion,
  ]);

  // ============== SESSION COMPLETE CELEBRATION SCREEN (Light & Dark Adapted) ==============
  if (isSessionComplete || !currentCard) {
    return (
      <div className={`fixed inset-0 z-30 flex flex-col justify-between select-none overflow-hidden ui-view-enter ${screenBg}`}>
        <header
          className={`reviewer-header relative ${
            isMac ? 'ps-[82px] pe-7' : 'px-7'
          } flex items-center justify-between gap-4 border-b ${
            isDark ? 'border-white/[0.05]' : 'border-[var(--border-subtle)]'
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => appActions.exitReview()}
              aria-label={t('backBtn')}
              className={`reviewer-toolbar-btn w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer ${headerBtnSurface}`}
            >
              <ChevronLeftIcon className="w-4 h-4 rtl:rotate-180" strokeWidth={2.1} />
            </button>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold truncate">
                {isNewDayReady ? t('newDayReadyBadge') : t('reviewCompletedTitle')}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
                {isNewDayReady ? t('newDayReadySub', { n: newDayPendingCount }) : t('reviewCompletedSub')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => appActions.undoLastReview()}
            className={`reviewer-toolbar-btn h-8 px-3 rounded-lg border text-[12px] cursor-pointer shrink-0 ${headerBtnSurface}`}
          >
            {t('undoLastBtn', { key: formatShortcut('Cmd Z', platform) })}
          </button>

          <progress
            className="reviewer-progress"
            value={totalSessionCards}
            max={totalSessionCards}
            aria-label={t('todayProgressTitle')}
            style={{
              ['--reviewer-progress-color' as string]: isNewDayReady
                ? brandHex
                : 'var(--status-success)',
            }}
          />
        </header>

        <main className="reviewer-complete-main">
          <article className={`reviewer-card-shell reviewer-complete-card rounded-[24px] border ${cardContainerSurface}`}>
            {hasIllustrationPack(accentColor, showIllustrations) ? (
              <CelebrationIllustration accentColor={accentColor} isDark={isDark} />
            ) : (
              <div
                aria-hidden="true"
                className="w-16 h-16 rounded-2xl bg-[var(--status-success-soft)] border border-[var(--status-success)]/30 text-[var(--status-success)] flex items-center justify-center"
              >
                <CheckIcon className="w-7 h-7" strokeWidth={2.5} />
              </div>
            )}

            <header className="reviewer-complete-header">
              {isNewDayReady && (
                <div className="mb-1 flex justify-center">
                  <span
                    style={{ color: 'var(--brand-text)', borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-soft)' }}
                    className="reviewer-badge-trim inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border"
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandHex }} />
                    {t('newDayReadyBadge')}
                  </span>
                </div>
              )}
              <h2 className="reviewer-complete-title">
                {isNewDayReady
                  ? t('newDayReadyTitle')
                  : reviewScopeDeckId === 'all'
                  ? t('congratsTitle')
                  : t('congratsDeckTitle')}
              </h2>
              <p className="reviewer-complete-sub">
                {isNewDayReady
                  ? t('newDayReadySub', { n: newDayPendingCount })
                  : reviewScopeDeckId === 'all'
                  ? t('congratsSub')
                  : t('congratsDeckSub')}
              </p>
            </header>

            <div className="reviewer-complete-stats">
              <div className="reviewer-complete-stat">
                <div className="reviewer-complete-stat-value">
                  <span>{sessionStudiedCount}</span>
                  <span className="reviewer-complete-stat-unit">{t('cardsUnit')}</span>
                </div>
                <div className="reviewer-complete-stat-label">{t('sessionStudiedLabel')}</div>
              </div>
              <div className="reviewer-complete-stat">
                <div className="reviewer-complete-stat-value reviewer-complete-stat-value--success">
                  <span>{accuracyPct}</span>
                  <span className="reviewer-complete-stat-unit">%</span>
                </div>
                <div className="reviewer-complete-stat-label">{t('sessionAccuracyLabel')}</div>
              </div>
              <div className="reviewer-complete-stat">
                <div className="reviewer-complete-stat-value">
                  <span>{avgSecDisplay}</span>
                  <span className="reviewer-complete-stat-unit">{t('secondsUnitShort')}</span>
                </div>
                <div className="reviewer-complete-stat-label">{t('sessionAvgTimeLabel')}</div>
              </div>
            </div>

            <footer className="reviewer-complete-actions">
              {isNewDayReady ? (
                <>
                  <button
                    type="button"
                    onClick={() => appActions.startReview(reviewScopeDeckId || activeDeckId || 'all')}
                    style={{ backgroundColor: brandHex }}
                    className="reviewer-complete-btn reviewer-complete-btn--primary"
                  >
                    {t('startTodayStudyBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => appActions.exitReview()}
                    className="reviewer-complete-btn reviewer-complete-btn--secondary"
                  >
                    {t('backToDashboard')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => appActions.exitReview()}
                    style={{ backgroundColor: brandHex }}
                    className="reviewer-complete-btn reviewer-complete-btn--primary"
                  >
                    {t('backToDashboard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => appActions.startReview(activeDeckId || undefined, false, true)}
                    className="reviewer-complete-btn reviewer-complete-btn--secondary"
                  >
                    {t('enterPreviewMode')}
                  </button>
                </>
              )}
            </footer>
          </article>
        </main>

        <footer
          className={`reviewer-bottom-dock min-h-11 py-2 px-7 border-t backdrop-blur-md flex items-center justify-between gap-4 text-[11px] text-[var(--text-secondary)] ${
            isDark ? 'border-white/[0.06]' : 'border-[var(--border-subtle)]'
          }`}
        >
          <span>{isNewDayReady ? t('newDayReadySub', { n: newDayPendingCount }) : t('reviewCompletedSub')}</span>
          {showShortcutHints && (
            <span>
              {`Esc · ${formatShortcut('Cmd Z', platform)}`}
            </span>
          )}
        </footer>
      </div>
    );
  }

  const appendToActiveField = (snippet: string) => {
    setFieldsDraft((prev) => {
      const curr = (prev[activeFieldKey] || '').replace(/\/$/, '');
      return {
        ...prev,
        [activeFieldKey]: `${curr}${curr ? ' ' : ''}${snippet}`,
      };
    });
    setAppState({ slashMenuOpen: false });
  };

  const slashItems = [
    {
      id: 'bold',
      icon: 'B',
      label: 'Bold',
      action: () => appendToActiveField('<b>...</b>'),
    },
    {
      id: 'code',
      icon: '<>',
      label: 'Code',
      action: () => appendToActiveField('<code>code</code>'),
    },
    {
      id: 'latex',
      icon: '∑',
      label: 'LaTeX',
      action: () => appendToActiveField('\\( E = mc^2 \\)'),
    },
    {
      id: 'cloze',
      icon: '[]',
      label: t('clozeBadge'),
      action: () => appendToActiveField('{{c1::...}}'),
    },
  ];

  const orderedFieldKeys =
    currentCard.fieldOrder && currentCard.fieldOrder.length > 0
      ? currentCard.fieldOrder
      : Object.keys(fieldsDraft);

  const activeFlagNum = ((currentCard.flags || 0) & 7) as CardFlagColor;
  const activeFlagSpec = activeFlagNum !== 0 ? ANKI_FLAG_PALETTE[activeFlagNum] : null;

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
      : 'max-w-[580px]';

  const scaleFactor = reviewContentScale / 100;
  const scaleIdx = REVIEW_CONTENT_SCALES.indexOf(reviewContentScale);
  const resolvedScaleIdx = scaleIdx >= 0 ? scaleIdx : 1;
  const stepReviewScale = (delta: 1 | -1) => {
    const nextIdx = Math.min(REVIEW_CONTENT_SCALES.length - 1, Math.max(0, resolvedScaleIdx + delta));
    const nextScale = REVIEW_CONTENT_SCALES[nextIdx];
    if (nextScale !== reviewContentScale) {
      appActions.updatePreferences({ reviewContentScale: nextScale });
    }
  };

  const inlineImgMaxHeightPx = Math.round((isStageWidened ? 500 : 380) * scaleFactor);
  const inlineIoMaxHeightPx = Math.round((isStageWidened ? 560 : 420) * scaleFactor);

  const handleCardMediaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (inlineEditing) return;
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

  const fourRatingSpecs = [
    {
      grade: 1 as const,
      labelKey: 'rateAgain' as const,
      prediction: currentCard.predictions.again,
      extraClass: 'reviewer-cta-again',
      toneClass:
        'bg-[var(--status-danger-soft)] border-[var(--status-danger)]/35 hover:border-[var(--status-danger)] text-[var(--status-danger-text)]',
      shortcut: '1',
    },
    {
      grade: 2 as const,
      labelKey: 'rateHard' as const,
      prediction: currentCard.predictions.hard,
      extraClass: '',
      toneClass:
        'bg-[var(--status-warning-soft)] border-[var(--status-warning)]/35 hover:border-[var(--status-warning)] text-[var(--status-warning-text)]',
      shortcut: '2',
    },
    {
      grade: 3 as const,
      labelKey: 'rateGood' as const,
      prediction: currentCard.predictions.good,
      extraClass: 'reviewer-cta-good',
      toneClass:
        'bg-[var(--status-success-soft)] border-[var(--status-success)]/35 hover:border-[var(--status-success)] text-[var(--status-success-text)]',
      shortcut: '3',
    },
    {
      grade: 4 as const,
      labelKey: 'rateEasy' as const,
      prediction: currentCard.predictions.easy,
      extraClass: '',
      toneClass:
        'bg-[var(--status-info-soft)] border-[var(--status-info)]/35 hover:border-[var(--status-info)] text-[var(--status-info-text)]',
      shortcut: '4',
    },
  ];

  const renderBackButton = (stopDrag = false) => (
    <Tooltip variant="compact" content={t('backBtn')} side="bottom">
      <button
        type="button"
        onMouseDown={stopDrag ? (e) => e.stopPropagation() : undefined}
        onClick={() => {
          if (inlineEditing) {
            setFieldsDraft({ ...originalFieldsDraft });
            appActions.exitInlineEdit();
          } else {
            appActions.exitReview();
          }
        }}
        aria-label={t('backBtn')}
        className={`reviewer-toolbar-btn ${
          stopDrag ? 'w-7 h-7 rounded-lg' : 'w-8 h-8 rounded-xl'
        } border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${headerBtnSurface}`}
      >
        <ChevronLeftIcon className="w-4 h-4 rtl:rotate-180" strokeWidth={2.1} />
      </button>
    </Tooltip>
  );

  const renderSessionBadges = () => (
    <>
      {currentCard.isCloze && (
        <span className="reviewer-badge-trim px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[10px] font-medium shrink-0">
          {(currentCard.clozeSiblingCount || 1) > 1
            ? t('clozeStepBadge', {
                index: currentCard.clozeCardIndex || 1,
                total: currentCard.clozeSiblingCount || 1,
              })
            : t('clozeBadge')}
        </span>
      )}
      {isPreviewSession && (
        <span className="reviewer-badge-trim px-2 py-0.5 rounded bg-[var(--status-warning-soft)] text-[var(--status-warning-text)] text-[10px] font-medium shrink-0">
          {t('previewModeBadge')}
        </span>
      )}
    </>
  );

  const renderRatingControls = (vertical: boolean) => {
    if (!isCardFlipped) {
      /* Unflipped: Full width so clicking lands cleanly in the primary action zone */
      return (
        <button
          type="button"
          onClick={() => appActions.flipCard()}
          style={{ backgroundColor: brandHex }}
          className={`reviewer-cta-btn reviewer-cta-btn--solid ${
            vertical ? 'reviewer-side-cta-flip px-4' : 'h-[48px] px-5'
          } w-full rounded-xl text-white font-semibold text-[14px] shadow-md flex items-center ${
            showShortcutHints ? 'justify-between' : 'justify-center'
          } cursor-pointer transition-[transform,opacity,filter] duration-[var(--dur-fast)]`}
        >
          {showShortcutHints ? (
            <>
              <span>{t('showAnswerBtn')}</span>
              <kbd className="reviewer-badge-trim px-2 py-0.5 rounded-md bg-white/20 text-[11px] font-mono shrink-0">
                {vertical ? 'Space' : 'Space / Enter'}
              </kbd>
            </>
          ) : (
            <span>{t('showAnswerBtn')}</span>
          )}
        </button>
      );
    }

    if (optionKeyHeld || answerButtonMode === 'four') {
      /* 4-Level FSRS Mode: horizontal 4-col bar or vertical two-line spacious stack */
      return (
        <div
          className={
            vertical
              ? 'flex flex-col gap-2.5 w-full'
              : 'reviewer-cta-shell grid grid-cols-4 gap-2.5 w-full h-[48px]'
          }
        >
          {fourRatingSpecs.map((item) => (
            <button
              key={item.grade}
              type="button"
              onClick={() => triggerRateWithSwipe(item.grade)}
              className={`reviewer-cta-btn ${item.extraClass} ${
                vertical ? 'reviewer-side-cta-btn w-full px-4' : 'h-[48px] px-3'
              } rounded-xl border flex items-center ${
                showShortcutHints ? 'justify-between' : 'justify-center text-center'
              } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] ${item.toneClass}`}
            >
              <div className={showShortcutHints ? 'text-start min-w-0' : 'text-center min-w-0'}>
                <div
                  className={`${
                    vertical ? 'text-[13.5px]' : 'text-[13px]'
                  } font-semibold leading-tight`}
                >
                  {t(item.labelKey)}
                </div>
                <div
                  className={`${
                    vertical ? 'text-[11px] mt-1' : 'text-[10.5px] mt-0.5'
                  } leading-tight opacity-80 tabular-nums`}
                >
                  {item.prediction}
                </div>
              </div>
              {showShortcutHints && (
                <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-black/30 text-[10.5px] font-mono shrink-0">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      );
    }

    /* Binary Mode: horizontal asymmetric 520px bar or vertical two-line spacious stack */
    return (
      <div
        className={
          vertical
            ? 'flex flex-col gap-2.5 w-full'
            : 'reviewer-cta-shell w-full h-[48px] flex items-center gap-3'
        }
      >
        <button
          type="button"
          onClick={() => triggerRateWithSwipe(1)}
          className={`reviewer-cta-btn reviewer-cta-again reviewer-cta-binary-again h-[48px] px-4 rounded-xl border flex items-center ${
            showShortcutHints ? 'justify-between' : 'justify-center text-center'
          } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] bg-[var(--status-danger-soft)] border-[var(--status-danger)]/35 hover:border-[var(--status-danger)] text-[var(--status-danger-text)]`}
        >
          <div className={showShortcutHints ? 'text-start min-w-0' : 'text-center min-w-0'}>
            <div className="text-[13.5px] font-semibold leading-tight">{t('rateAgain')}</div>
            <div
              className={`${
                vertical ? 'text-[11px] mt-1' : 'text-[10.5px] mt-0.5'
              } leading-tight opacity-80 tabular-nums`}
            >
              {currentCard.predictions.again}
            </div>
          </div>
          {showShortcutHints && (
            <kbd className="w-5 h-5 rounded-md bg-black/10 dark:bg-white/[0.06] flex items-center justify-center text-[10.5px] font-mono shrink-0">
              1
            </kbd>
          )}
        </button>

        <button
          type="button"
          onClick={() => triggerRateWithSwipe(3)}
          className={`reviewer-cta-btn reviewer-cta-good reviewer-cta-binary-good h-[48px] ${
            vertical ? 'px-4' : 'px-5'
          } rounded-xl border flex items-center ${
            showShortcutHints ? 'justify-between' : 'justify-center text-center'
          } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] bg-[var(--status-success-soft)] border-[var(--status-success)]/35 hover:border-[var(--status-success)] text-[var(--status-success)]`}
        >
          <div className={showShortcutHints ? 'text-start min-w-0' : 'text-center min-w-0'}>
            <div className={`${vertical ? 'text-[14.5px]' : 'text-[14px]'} font-bold leading-tight`}>{t('rateGood')}</div>
            <div
              className={`${
                vertical ? 'text-[11px] mt-1' : 'text-[10.5px] mt-0.5'
              } leading-tight opacity-85 tabular-nums`}
            >
              {currentCard.predictions.good}
            </div>
          </div>
          {showShortcutHints && (
            <kbd className="px-2 h-5 rounded-md bg-black/10 dark:bg-white/[0.08] flex items-center justify-center text-[10.5px] font-mono shrink-0">
              2 / Enter
            </kbd>
          )}
        </button>
      </div>
    );
  };

  /* Native Popover Top-Layer Overlays (shared across bottom & side dock layouts) */
  const popoversNode = (
    <>
              <div
                id={audioPopoverId}
                ref={audioPopoverRef}
                popover="auto"
                onToggle={(e) => {
                  const el = e.currentTarget;
                  const open =
                    (e.nativeEvent as unknown as { newState?: string }).newState === 'open' ||
                    Boolean(el.matches?.(':popover-open'));
                  setAudioPopoverOpen(open);
                  if (open) {
                    requestAnimationFrame(() => syncPopoverFallbackPosition(el, audioAnchorRef.current));
                  }
                }}
                style={{ ['positionAnchor' as string]: '--reviewer-audio-anchor' }}
                className={`reviewer-popover z-50 w-[300px] rounded-2xl border p-3.5 backdrop-blur-xl ${
                  isDark
                    ? 'bg-[#181922]/96 border-[#2E303E] text-[#F2F3F7] shadow-2xl'
                    : 'bg-[var(--bg-card)]/96 border-[var(--border-subtle)] text-[var(--text-primary)] shadow-[0_18px_42px_-10px_rgba(20,24,32,0.16),0_4px_12px_-2px_rgba(20,24,32,0.06)]'
                }`}
              >
                <div className="flex flex-col gap-3">
                <div
                  className={`flex items-center justify-between gap-2 h-9 pb-3 border-b ${
                    isDark ? 'border-white/[0.08]' : 'border-[var(--border-subtle)]'
                  }`}
                >
                  <span className="text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">
                    {t('reviewAudioQuickTitle')}
                  </span>
                  <span
                    className={`inline-flex items-center h-6 px-2 rounded-lg font-mono tabular-nums text-[11px] font-medium ${
                      autoPlayFrontAudio || autoPlayBackAudio
                        ? 'text-[var(--brand-text)] bg-[var(--brand-soft)]'
                        : isDark
                        ? 'text-[var(--text-secondary)] bg-white/[0.06]'
                        : 'text-[var(--text-secondary)] bg-[var(--bg-subtle)]'
                    }`}
                  >
                    {autoPlayFrontAudio && autoPlayBackAudio
                      ? 'Q + A'
                      : autoPlayFrontAudio
                      ? 'Q'
                      : autoPlayBackAudio
                      ? 'A'
                      : 'OFF'}
                  </span>
                </div>

                {isSideDock && manualAudioFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => appActions.playAudio(manualAudioFiles)}
                    className={`reviewer-popover-item w-full h-9 px-3 rounded-xl border text-[12px] font-medium flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      playingAudioFile
                        ? 'bg-[var(--brand-soft)] border-[var(--brand-border)] text-[var(--brand-text)]'
                        : isDark
                        ? 'bg-white/[0.04] border-white/[0.08] text-[var(--text-primary)] hover:bg-white/[0.08]'
                        : 'bg-[var(--bg-subtle)]/70 border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <svg
                        className="w-3.5 h-3.5 opacity-85 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                      <span className="truncate">{t('readAloud')}</span>
                    </span>
                    {showShortcutHints && <kbd className="text-[10px] opacity-70 font-mono shrink-0">R</kbd>}
                  </button>
                )}

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={autoFrontSwitchId}
                      className="min-w-0 flex-1 cursor-pointer select-none"
                    >
                      <span className="block text-[12px] font-medium text-[var(--text-primary)] leading-snug">
                        {t('autoPlayFrontAudioTitle')}
                      </span>
                    </label>
                    <input
                      id={autoFrontSwitchId}
                      type="checkbox"
                      checked={autoPlayFrontAudio}
                      onChange={() => {
                        const next = !autoPlayFrontAudio;
                        appActions.updatePreferences({ autoPlayFrontAudio: next });
                        if (!next && !isCardFlipped) {
                          appActions.stopAudio();
                        }
                      }}
                      {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                      {...(supportsNativeSwitch
                        ? {}
                        : { role: 'switch', 'aria-checked': autoPlayFrontAudio })}
                      data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                      className="anki-switch anki-switch-sm shrink-0"
                    />
                  </div>

                  <div
                    className={`pt-3 border-t flex flex-col gap-1.5 ${
                      isDark ? 'border-white/[0.08]' : 'border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor={autoBackSwitchId}
                        className="min-w-0 flex-1 cursor-pointer select-none"
                      >
                        <span className="block text-[12px] font-medium text-[var(--text-primary)] leading-snug">
                          {t('autoPlayBackAudioTitle')}
                        </span>
                      </label>
                      <input
                        id={autoBackSwitchId}
                        type="checkbox"
                        checked={autoPlayBackAudio}
                        onChange={() => {
                          const next = !autoPlayBackAudio;
                          appActions.updatePreferences({ autoPlayBackAudio: next });
                          if (!next && isCardFlipped) {
                            appActions.stopAudio();
                          }
                        }}
                        {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                        {...(supportsNativeSwitch
                          ? {}
                          : { role: 'switch', 'aria-checked': autoPlayBackAudio })}
                        data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                        className="anki-switch anki-switch-sm shrink-0"
                      />
                    </div>
                    <p className="m-0 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                      {t('autoPlayBackFallbackNote')}
                    </p>
                  </div>
                </div>

                <div
                  className={`pt-3 border-t ${
                    isDark ? 'border-white/[0.08]' : 'border-[var(--border-subtle)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      closePopoverEl(audioPopoverRef.current);
                      setAudioPopoverOpen(false);
                      setAppState({ settingsInitialTab: 'answer', settingsOpen: true });
                    }}
                    className="reviewer-popover-item reviewer-popover-link w-full px-3 py-2 rounded-xl border text-[11.5px] font-medium flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate">{t('openAnswerSettingsLink')}</span>
                    <svg
                      className="w-3.5 h-3.5 shrink-0 text-[var(--text-secondary)] rtl:rotate-180"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
                </div>
              </div>

              <div
                id={flagPopoverId}
                ref={flagPopoverRef}
                popover="auto"
                onToggle={(e) => {
                  const el = e.currentTarget;
                  const open =
                    (e.nativeEvent as unknown as { newState?: string }).newState === 'open' ||
                    Boolean(el.matches?.(':popover-open'));
                  setFlagPopoverOpen(open);
                  if (open) {
                    requestAnimationFrame(() => syncPopoverFallbackPosition(el, flagAnchorRef.current));
                  }
                }}
                style={{ ['positionAnchor' as string]: '--reviewer-flag-anchor' }}
                className={`reviewer-popover z-50 w-[210px] rounded-2xl border shadow-2xl p-2 space-y-0.5 backdrop-blur-xl ${
                  isDark
                    ? 'bg-[#181922]/96 border-[#2E303E] text-white'
                    : 'bg-white/96 border-[var(--border-subtle)] text-[#1D1D1F]'
                }`}
              >
                <div className="px-2.5 py-1 text-[10px] text-[var(--text-secondary)] flex items-center justify-between">
                  <span>{t('flagFilterLabel')}</span>
                  {showShortcutHints && (
                    <span className="font-mono">{formatShortcut('Cmd 1-7', platform)}</span>
                  )}
                </div>
                {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
                  const spec = ANKI_FLAG_PALETTE[fNum];
                  const isSel = activeFlagNum === fNum;
                  return (
                    <button
                      key={fNum}
                      type="button"
                      onClick={() => {
                        appActions.setCurrentReviewCardFlag(fNum, true);
                        closePopoverEl(flagPopoverRef.current);
                        setFlagPopoverOpen(false);
                      }}
                      className={`reviewer-popover-item w-full px-2.5 py-1.5 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-black/5 dark:bg-white/10 font-semibold'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: spec.hex }}
                        />
                        <span>{t(`flagLabel_${fNum}` as any)}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-secondary)] inline-flex items-center">
                        {isSel ? <CheckIcon className="w-3 h-3 text-[var(--brand-text)]" strokeWidth={2.6} /> : fNum}
                      </span>
                    </button>
                  );
                })}
                {activeFlagNum > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      appActions.setCurrentReviewCardFlag(0, false);
                      closePopoverEl(flagPopoverRef.current);
                      setFlagPopoverOpen(false);
                    }}
                    className="reviewer-popover-item w-full px-2.5 py-1.5 rounded-xl text-[11px] text-[var(--text-secondary)] hover:text-[var(--status-danger-text)] flex items-center justify-between cursor-pointer border-t border-black/5 dark:border-white/5 mt-1 pt-1.5"
                  >
                    <span>{t('flagNone')}</span>
                    <span className="font-mono text-[10px]">0</span>
                  </button>
                )}
              </div>

              <div
                id={displayPopoverId}
                ref={displayPopoverRef}
                popover="auto"
                onToggle={(e) => {
                  const el = e.currentTarget;
                  const open =
                    (e.nativeEvent as unknown as { newState?: string }).newState === 'open' ||
                    Boolean(el.matches?.(':popover-open'));
                  setDisplayPopoverOpen(open);
                  if (open) {
                    requestAnimationFrame(() => syncPopoverFallbackPosition(el, displayAnchorRef.current));
                  }
                }}
                style={{ ['positionAnchor' as string]: '--reviewer-display-anchor' }}
                className={`reviewer-popover z-50 w-[300px] rounded-2xl border p-3.5 backdrop-blur-xl ${
                  isDark
                    ? 'bg-[#181922]/96 border-[#2E303E] text-[#F2F3F7] shadow-2xl'
                    : 'bg-[var(--bg-card)]/96 border-[var(--border-subtle)] text-[var(--text-primary)] shadow-[0_18px_42px_-10px_rgba(20,24,32,0.16),0_4px_12px_-2px_rgba(20,24,32,0.06)]'
                }`}
              >
                <div className="flex flex-col gap-3">
                {(() => {
                  const isCustomDisplay =
                    reviewContentScale !== 100 || reviewStageWidth !== 'auto';
                  const isCompatEnabled = compatMode;
                  const stageWidthOptions: Array<{
                    value: ReviewStageWidth;
                    labelKey: any;
                  }> = [
                    { value: 'auto', labelKey: 'reviewWidthAuto' },
                    { value: 'standard', labelKey: 'reviewWidthStandard' },
                    { value: 'wide', labelKey: 'reviewWidthWide' },
                    { value: 'full', labelKey: 'reviewWidthFull' },
                  ];
                  const dockPositionOptions: Array<{
                    value: ReviewDockPosition;
                    labelKey: any;
                  }> = [
                    { value: 'bottom', labelKey: 'reviewDockPositionBottom' },
                    { value: 'side', labelKey: 'reviewDockPositionSide' },
                  ];

                  return (
                    <>
                      {/* Compact Header + Contextual Reset (Fixed h-9 box prevents shift) */}
                      <div
                        className={`flex items-center justify-between gap-2 h-9 pb-3 border-b ${
                          isDark ? 'border-white/[0.08]' : 'border-[var(--border-subtle)]'
                        }`}
                      >
                        <span className="text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">
                          {t('reviewDisplayBtn')}
                        </span>
                        {isCustomDisplay && (
                          <Tooltip
                            variant="compact"
                            content={t('reviewResetDefaultBtn')}
                            shortcut="Cmd Shift 0"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                appActions.updatePreferences({
                                  reviewContentScale: 100,
                                  reviewStageWidth: 'auto',
                                })
                              }
                              aria-label={t('reviewResetDefaultBtn')}
                              className="reviewer-popover-item inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] font-medium text-[var(--brand-text)] bg-[var(--brand-soft)] hover:brightness-95 dark:hover:brightness-110 cursor-pointer transition-colors"
                            >
                              <svg
                                className="w-3 h-3 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                              </svg>
                              <span>{t('reviewResetDefaultBtn')}</span>
                            </button>
                          </Tooltip>
                        )}
                      </div>

                      {/* Content Scale Unified Segmented Stepper */}
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[11px] font-medium text-[var(--text-secondary)]">
                          {t('reviewScaleTitle')}
                        </div>
                        <div
                          role="group"
                          aria-label={t('reviewScaleTitle')}
                          className="reviewer-scale-stepper grid grid-cols-3 h-9 rounded-xl border overflow-hidden"
                        >
                          <Tooltip
                            variant="compact"
                            content={t('decreaseFontSizeBtn')}
                            shortcut="Cmd -"
                            triggerClassName="flex w-full h-full"
                          >
                            <button
                              type="button"
                              onClick={() => stepReviewScale(-1)}
                              disabled={resolvedScaleIdx <= 0}
                              aria-label={t('decreaseFontSizeBtn')}
                              className="reviewer-popover-item reviewer-scale-segment w-full h-full text-[13px] font-semibold flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                            >
                              <span aria-hidden="true">A−</span>
                            </button>
                          </Tooltip>
                          <Tooltip
                            variant="compact"
                            content={t('reviewResetDefaultBtn')}
                            shortcut="Cmd Shift 0"
                            disabled={reviewContentScale === 100}
                            triggerClassName="flex w-full h-full"
                          >
                            <button
                              type="button"
                              disabled={reviewContentScale === 100}
                              data-customized={reviewContentScale !== 100 ? 'true' : 'false'}
                              onClick={() => appActions.updatePreferences({ reviewContentScale: 100 })}
                              aria-label={
                                reviewContentScale === 100
                                  ? `${t('reviewScaleTitle')}: ${reviewContentScale}%`
                                  : `${t('reviewResetDefaultBtn')} (${reviewContentScale}%)`
                              }
                              className={`reviewer-popover-item reviewer-scale-segment w-full h-full font-mono tabular-nums text-[12.5px] font-semibold flex items-center justify-center ${
                                reviewContentScale === 100
                                  ? 'cursor-default'
                                  : 'cursor-pointer'
                              }`}
                            >
                              {reviewContentScale}%
                            </button>
                          </Tooltip>
                          <Tooltip
                            variant="compact"
                            content={t('increaseFontSizeBtn')}
                            shortcut="Cmd +"
                            triggerClassName="flex w-full h-full"
                          >
                            <button
                              type="button"
                              onClick={() => stepReviewScale(1)}
                              disabled={resolvedScaleIdx >= REVIEW_CONTENT_SCALES.length - 1}
                              aria-label={t('increaseFontSizeBtn')}
                              className="reviewer-popover-item reviewer-scale-segment w-full h-full text-[13px] font-semibold flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                            >
                              <span aria-hidden="true">A+</span>
                            </button>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Card Stage Width Semantic Radio Tiles */}
                      <fieldset className="reviewer-width-fieldset">
                        <legend className="text-[11px] font-medium text-[var(--text-secondary)] p-0 mb-1.5">
                          {t('reviewWidthTitle')}
                        </legend>
                        <div className="grid grid-cols-2 gap-1.5">
                          {stageWidthOptions.map((opt) => {
                            const active = reviewStageWidth === opt.value;
                            return (
                              <label
                                key={opt.value}
                                data-selected={active ? 'true' : 'false'}
                                className="reviewer-width-card px-2.5 py-2 rounded-xl border text-start cursor-pointer flex items-center gap-2 select-none"
                              >
                                <input
                                  type="radio"
                                  name="reviewer-stage-width"
                                  value={opt.value}
                                  checked={active}
                                  onChange={() =>
                                    appActions.updatePreferences({ reviewStageWidth: opt.value })
                                  }
                                  className="sr-only"
                                />
                                <ReviewerWidthGlyph mode={opt.value} active={active} />
                                <span className="text-[11.5px] leading-tight truncate min-w-0 flex-1">
                                  {t(opt.labelKey)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>

                      {/* Control Bar Position Semantic Radio Tiles */}
                      <fieldset className="reviewer-width-fieldset">
                        <legend className="text-[11px] font-medium text-[var(--text-secondary)] p-0 mb-1.5">
                          {t('reviewDockPositionTitle')}
                        </legend>
                        <div className="grid grid-cols-2 gap-1.5">
                          {dockPositionOptions.map((opt) => {
                            const active = reviewDockPosition === opt.value;
                            return (
                              <label
                                key={opt.value}
                                data-selected={active ? 'true' : 'false'}
                                className="reviewer-width-card px-2.5 py-2 rounded-xl border text-start cursor-pointer flex items-center gap-2 select-none"
                              >
                                <input
                                  type="radio"
                                  name="reviewer-dock-position"
                                  value={opt.value}
                                  checked={active}
                                  onChange={() => {
                                    closePopoverEl(displayPopoverRef.current);
                                    setDisplayPopoverOpen(false);
                                    appActions.updatePreferences({ reviewDockPosition: opt.value });
                                  }}
                                  className="sr-only"
                                />
                                <ReviewerDockPositionGlyph mode={opt.value} active={active} />
                                <span className="text-[11.5px] leading-tight truncate min-w-0 flex-1">
                                  {t(opt.labelKey)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>

                      {/* Global Compat Mode (Sandboxed Native Rendering) — Native/Accessible Switch */}
                      {(currentCard.sandboxFrontHtml ||
                        currentCard.sandboxBackHtml ||
                        currentCard.notetypeId) && (
                        <div
                          className={`pt-3 border-t flex items-center justify-between gap-3 ${
                            isDark ? 'border-white/[0.08]' : 'border-[var(--border-subtle)]'
                          }`}
                        >
                          <label
                            htmlFor={compatSwitchId}
                            className="min-w-0 flex-1 cursor-pointer select-none"
                          >
                            <span className="block text-[12px] font-medium text-[var(--text-primary)] leading-snug truncate">
                              {t('compatMode')}
                            </span>
                          </label>
                          <input
                            id={compatSwitchId}
                            type="checkbox"
                            checked={isCompatEnabled}
                            onChange={() => appActions.toggleCompatMode()}
                            {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                            {...(supportsNativeSwitch
                              ? {}
                              : { role: 'switch', 'aria-checked': isCompatEnabled })}
                            data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                            className="anki-switch anki-switch-sm shrink-0"
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
                </div>
              </div>
    </>
  );

  const renderProgressBar = () => (
    <progress
      className="reviewer-progress"
      value={currentNumber}
      max={totalSessionCards}
      aria-label={t('todayProgressTitle')}
      aria-valuetext={`${currentNumber} / ${totalSessionCards} (${progressPct}%)`}
      style={{ ['--reviewer-progress-color' as string]: brandHex }}
    />
  );

  const bottomHeaderNode = (
      <header
        className={`reviewer-header relative ${
          isMac ? 'ps-[82px] pe-7' : 'px-7'
        } flex items-center justify-between gap-4 border-b ${
          isDark ? 'border-white/[0.05]' : 'border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {renderBackButton(false)}
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-tight flex items-center gap-2 flex-wrap">
              <span className="truncate">{inlineEditing ? t('editCardTitle') : currentCard.deckName}</span>
              {renderSessionBadges()}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 tabular-nums truncate">
              {inlineEditing
                ? `${currentCard.deckName} · ${currentCard.noteTypeName || 'Basic'}`
                : `${currentNumber} / ${totalSessionCards}`}
            </div>
          </div>
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {inlineEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFieldsDraft({ ...originalFieldsDraft });
                  appActions.exitInlineEdit();
                }}
                className={`reviewer-toolbar-btn h-8 px-3.5 rounded-xl border text-[12px] font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'border-[#3A3A46] text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-black hover:bg-black/5'
                }`}
              >
                {t('cancel')}
              </button>

              <button
                type="button"
                onClick={() => {
                  commitInlineChanges();
                  appActions.exitInlineEdit();
                }}
                style={{ backgroundColor: brandHex }}
                className={`reviewer-toolbar-btn reviewer-cta-btn--solid h-8 px-4 rounded-xl text-[12px] font-semibold text-white shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                  hasDraftChanges
                    ? 'hover:opacity-95 motion-safe:active:scale-[0.975]'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                {t('saveChangesBtn')}
              </button>
            </div>
          ) : (
            <>
              <div
                ref={toolbarRef}
                role="toolbar"
                aria-label={t('moreCardActions')}
                onKeyDown={handleToolbarKeyDown}
                onFocus={handleToolbarFocus}
                className="reviewer-toolbar"
                {...({ focusgroup: 'toolbar wrap' } as Record<string, unknown>)}
              >
                {/* Group 1: Card Audio & Flag Actions */}
                <div role="group" aria-label={t('reviewAudioQuickBtn')} className="reviewer-toolbar-group">
                  {manualAudioFiles.length > 0 ? (
                    <div
                      className={`reviewer-toolbar-split h-8 rounded-lg border inline-flex items-stretch overflow-hidden transition-colors ${
                        playingAudioFile || audioPopoverOpen
                          ? isDark
                            ? 'bg-[#17181E] border-[var(--brand-border)]'
                            : 'bg-white border-[var(--brand-border)] shadow-2xs'
                          : isDark
                          ? 'bg-[#17181E] border-white/[0.08]'
                          : 'bg-[var(--bg-card)] border-[var(--border-subtle)] shadow-2xs'
                      }`}
                    >
                      <Tooltip variant="compact" content={t('readAloud')} shortcut="R" side="bottom">
                        <button
                          type="button"
                          data-toolbar-item="true"
                          onClick={() => appActions.playAudio(manualAudioFiles)}
                          className={`reviewer-toolbar-btn h-full px-2.5 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                            playingAudioFile
                              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                              : isDark
                              ? 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.05]'
                              : 'text-[var(--text-secondary)] hover:text-[#1D1D1F] hover:bg-black/[0.03]'
                          }`}
                        >
                          <svg
                            className="w-3.5 h-3.5 opacity-85 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          <span>{t('readAloud')}</span>
                          {showShortcutHints && <kbd className="text-[10px] opacity-70 font-mono">R</kbd>}
                        </button>
                      </Tooltip>

                      <span
                        aria-hidden="true"
                        className={`w-px self-stretch shrink-0 transition-colors ${
                          playingAudioFile || audioPopoverOpen
                            ? 'bg-[var(--brand-border)]'
                            : isDark
                            ? 'bg-white/[0.08]'
                            : 'bg-[var(--border-subtle)]'
                        }`}
                      />

                      <Tooltip
                        variant="compact"
                        content={t('reviewAudioQuickBtn')}
                        side="bottom"
                        disabled={audioPopoverOpen}
                      >
                        <button
                          ref={audioAnchorRef}
                          type="button"
                          data-toolbar-item="true"
                          popoverTarget={audioPopoverId}
                          aria-label={t('reviewAudioQuickBtn')}
                          aria-expanded={audioPopoverOpen}
                          style={{ ['anchorName' as string]: '--reviewer-audio-anchor' }}
                          className={`reviewer-toolbar-btn h-full px-2 flex items-center justify-center cursor-pointer transition-colors ${
                            audioPopoverOpen
                              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                              : isDark
                              ? 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.05]'
                              : 'text-[var(--text-secondary)] hover:text-[#1D1D1F] hover:bg-black/[0.03]'
                          }`}
                        >
                          <svg
                            className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                              autoPlayFrontAudio || autoPlayBackAudio || audioPopoverOpen
                                ? 'opacity-90'
                                : 'opacity-55'
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          </svg>
                        </button>
                      </Tooltip>
                    </div>
                  ) : (
                    <Tooltip
                      variant="compact"
                      content={t('reviewAudioQuickBtn')}
                      side="bottom"
                      disabled={audioPopoverOpen}
                    >
                      <button
                        ref={audioAnchorRef}
                        type="button"
                        data-toolbar-item="true"
                        popoverTarget={audioPopoverId}
                        aria-label={t('reviewAudioQuickBtn')}
                        aria-expanded={audioPopoverOpen}
                        style={{ ['anchorName' as string]: '--reviewer-audio-anchor' }}
                        className={`reviewer-toolbar-btn h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                          audioPopoverOpen
                            ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                            : headerBtnSurface
                        }`}
                      >
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
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          {autoPlayFrontAudio || autoPlayBackAudio ? (
                            <>
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                            </>
                          ) : (
                            <path
                              d="M15.54 8.46a5 5 0 0 1 0 7.07"
                              className="opacity-40"
                              strokeDasharray="2 2"
                            />
                          )}
                        </svg>
                      </button>
                    </Tooltip>
                  )}

                  {/* 7-Color Flag Quick Picker Trigger */}
                  <Tooltip
                    variant="compact"
                    content={t('flagFilterLabel')}
                    shortcut="Cmd 1-7"
                    side="bottom"
                    disabled={flagPopoverOpen}
                  >
                    <button
                      ref={flagAnchorRef}
                      type="button"
                      data-toolbar-item="true"
                      popoverTarget={flagPopoverId}
                      aria-label={
                        activeFlagSpec
                          ? `${t('flagFilterLabel')}: ${t(`flagLabel_${activeFlagNum}` as any)}`
                          : t('flagFilterLabel')
                      }
                      aria-expanded={flagPopoverOpen}
                      style={{
                        ...(activeFlagSpec
                          ? {
                              backgroundColor: activeFlagSpec.bgSoft,
                              borderColor: activeFlagSpec.borderHex,
                              color: activeFlagSpec.hex,
                            }
                          : undefined),
                        ['anchorName' as string]: '--reviewer-flag-anchor',
                      }}
                      className={`reviewer-toolbar-btn h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                        activeFlagSpec ? '' : headerBtnSurface
                      }`}
                    >
                      <svg
                        className="w-3.5 h-3.5 shrink-0"
                        viewBox="0 0 24 24"
                        fill={activeFlagSpec ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" />
                      </svg>
                      {activeFlagSpec && (
                        <span>{t(`flagShort_${activeFlagNum}` as any)}</span>
                      )}
                    </button>
                  </Tooltip>
                </div>

                <span
                  role="separator"
                  aria-orientation="vertical"
                  className={`h-4 w-0 border-s mx-0.5 shrink-0 ${
                    isDark ? 'border-white/[0.12]' : 'border-[var(--border-subtle)]'
                  }`}
                />

                {/* Group 2: Display (Aa + Compat Switch), Edit, Card Info */}
                <div role="group" aria-label={t('reviewDisplayBtn')} className="reviewer-toolbar-group">
                  <Tooltip
                    variant="compact"
                    content={t('reviewDisplayBtn')}
                    side="bottom"
                    disabled={displayPopoverOpen}
                  >
                    <button
                      ref={displayAnchorRef}
                      type="button"
                      data-toolbar-item="true"
                      popoverTarget={displayPopoverId}
                      aria-label={t('reviewDisplayBtn')}
                      aria-expanded={displayPopoverOpen}
                      style={{ ['anchorName' as string]: '--reviewer-display-anchor' }}
                      className={`reviewer-toolbar-btn h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                        displayPopoverOpen ||
                        reviewContentScale !== 100 ||
                        reviewStageWidth !== 'auto' ||
                        compatMode
                          ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                          : headerBtnSurface
                      }`}
                    >
                      <span className="font-bold tracking-tight text-[12px]">Aa</span>
                      {reviewContentScale !== 100 && (
                        <span className="font-mono text-[10px] opacity-90">{reviewContentScale}%</span>
                      )}
                    </button>
                  </Tooltip>

                  <Tooltip variant="compact" content={t('editCardTitle')} shortcut="E" side="bottom">
                    <button
                      type="button"
                      data-toolbar-item="true"
                      onClick={() => {
                        if (currentCard) appActions.openCardEditor(currentCard);
                      }}
                      aria-label={t('editCardTitle')}
                      className={`reviewer-toolbar-btn w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${headerBtnSurface}`}
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                  </Tooltip>

                  <Tooltip variant="compact" content={t('cardInfoTitle')} shortcut="Cmd I" side="bottom">
                    <button
                      type="button"
                      data-toolbar-item="true"
                      onClick={() => setAppState((prev) => ({ inspectorOpen: !prev.inspectorOpen }))}
                      aria-label={t('cardInfoTitle')}
                      aria-expanded={inspectorOpen}
                      className={`reviewer-toolbar-btn w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                        inspectorOpen
                          ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                          : headerBtnSurface
                      }`}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="5" cy="12" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="19" cy="12" r="1.6" />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
              </div>

              {popoversNode}
            </>
          )}
        </div>

        {renderProgressBar()}
      </header>
  );

  const cardStageMainNode = (
        <main className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          {sessionCrossedDay && (
            <div
              role="status"
              className={`relative z-20 mx-auto mt-2.5 px-3.5 py-1.5 rounded-full border backdrop-blur-md flex items-center gap-3 text-[12px] shadow-sm ${
                isDark
                  ? 'bg-[#1D1F28]/85 border-white/10 text-[#EAEAF0]'
                  : 'bg-white/85 border-[var(--border-subtle)] text-[#2C2C2E]'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: brandHex }}
              />
              <span className="leading-snug">{t('reviewerDayRolloverBanner')}</span>
              <button
                type="button"
                onClick={() => appActions.syncPendingDayRolloverQueue()}
                style={{ color: 'var(--brand-text)' }}
                className="font-semibold hover:underline cursor-pointer shrink-0"
              >
                {t('reviewerDayRolloverSyncNow')}
              </button>
            </div>
          )}
          <ReviewerCornerDecor
            accentColor={accentColor}
            isDark={isDark}
            inspectorOpen={inspectorOpen}
          />
          <div
            ref={pullPillRef}
            role="status"
            aria-hidden="true"
            data-visible="false"
            data-ready="false"
            className="reviewer-pull-flip-pill"
          >
            <ChevronDownIcon className="w-3.5 h-3.5 reviewer-pull-flip-icon" />
            <span>{t('showAnswerBtn')}</span>
          </div>
          {/* Scrollable Center Pane for Flashcard */}
          <div
            ref={stageScrollRef}
            data-shifted={isSideDock ? 'false' : inspectorOpen ? 'true' : 'false'}
            data-mac={isSideDock ? (isMac ? 'true' : 'false') : undefined}
            data-stage-width={isSideDock ? reviewStageWidth : undefined}
            className={`reviewer-stage-shift reviewer-gesture-stage relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-6 ${
              isSideDock
                ? 'reviewer-side-stage'
                : isSandboxCard || isStageWidened
                ? 'py-3'
                : 'py-4'
            } flex flex-col items-center ${
              !isSideDock && inspectorOpen ? 'ltr:-translate-x-28 rtl:translate-x-28' : ''
            }`}
          >
            <div
              style={
                {
                  '--reviewer-img-max-h': `${inlineImgMaxHeightPx}px`,
                  '--reviewer-io-max-h': `${inlineIoMaxHeightPx}px`,
                } as React.CSSProperties
              }
              className={`my-auto flex flex-col items-center w-full relative transition-[max-width] duration-200 ${stageMaxWidthClass}`}
            >
              {/* Floating Flashcard — Strict Light/Dark Adaptation + Trackpad Drag & Directional Swipe-Out */}
              <div
                ref={cardShellRef}
                key={currentCard.id}
                data-reviewer-swipe={swipingDir || 'none'}
                data-swipe-from-gesture={swipeFromGesture ? 'true' : 'false'}
                data-swipe-axis="idle"
                data-swipe-dir="none"
                data-swipe-threshold="false"
                onClick={handleCardMediaClick}
                onDoubleClick={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (
                    (target && target.tagName === 'IMG') ||
                    getClosestFromTarget(e.target, '.anki-io-wrap')
                  ) {
                    return;
                  }
                  if (currentCard) appActions.openCardEditor(currentCard);
                }}
                style={
                  swipingDir && swipeFromGesture && gestureFlyPose
                    ? ({
                        ['--swipe-from-x' as string]: `${gestureFlyPose.visualX.toFixed(1)}px`,
                        ['--swipe-from-y' as string]: `${gestureFlyPose.visualY.toFixed(1)}px`,
                        ['--swipe-from-rot' as string]: `${gestureFlyPose.rotationDeg.toFixed(2)}deg`,
                        ['--swipe-fly-dur' as string]: `${gestureFlyDurMs}ms`,
                      } as React.CSSProperties)
                    : undefined
                }
                className={`reviewer-card-shell w-full rounded-[22px] border ${
                  isSandboxCard
                    ? 'px-5 py-4 sm:px-6 sm:py-4'
                    : isStageWidened
                    ? 'px-6 py-5 sm:px-7 sm:py-5'
                    : 'px-6 py-5 sm:px-7 sm:py-6'
                } relative transition-[background-color,border-color,box-shadow] duration-[var(--dur-base)] shadow-sm ${
                  swipingDir === 'left'
                    ? 'reviewer-card-swipe-left'
                    : swipingDir === 'right'
                    ? 'reviewer-card-swipe-right'
                    : 'ui-card-enter'
                } ${cardContainerSurface}`}
              >
                <div
                  ref={cardGlowGoodRef}
                  aria-hidden="true"
                  className="reviewer-swipe-glow reviewer-swipe-glow--good"
                />
                <div
                  ref={cardGlowAgainRef}
                  aria-hidden="true"
                  className="reviewer-swipe-glow reviewer-swipe-glow--again"
                />
                <div
                  ref={stampGoodRef}
                  aria-hidden="true"
                  data-stamp-side="left"
                  data-visible="false"
                  className="reviewer-swipe-stamp reviewer-swipe-stamp--good"
                >
                  <span>{t('rateGood')}</span>
                  {currentCard.predictions?.good ? (
                    <span className="reviewer-swipe-stamp-ivl">{currentCard.predictions.good}</span>
                  ) : null}
                </div>
                <div
                  ref={stampAgainRef}
                  aria-hidden="true"
                  data-stamp-side="right"
                  data-visible="false"
                  className="reviewer-swipe-stamp reviewer-swipe-stamp--again"
                >
                  <span>{t('rateAgain')}</span>
                  {currentCard.predictions?.again ? (
                    <span className="reviewer-swipe-stamp-ivl">{currentCard.predictions.again}</span>
                  ) : null}
                </div>
            {inlineEditing ? (
              <div className="space-y-4">
                {orderedFieldKeys.map((fieldKey, idx) => {
                  const isFocused = fieldKey === activeFieldKey;
                  const val = fieldsDraft[fieldKey] ?? '';
                  const isPrimaryFront = idx === 0 && !isFocused;

                  if (isFocused) {
                    return (
                      <div
                        key={fieldKey}
                        className="rounded-xl border-2 border-[var(--brand)] bg-[var(--brand-surface)] p-4 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-[var(--brand-text)]">
                            {t('editingFieldTag', { field: fieldKey })}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => appendToActiveField('{{c1::...}}')}
                              className="text-[11px] text-[var(--brand-text)] hover:underline cursor-pointer"
                            >
                              {t('clozeShortcutBtn', {
                                key: formatShortcut('Cmd+Shift+C', platform),
                              })}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAppState((prev) => ({ slashMenuOpen: !prev.slashMenuOpen }))
                              }
                              className="text-[11px] text-[var(--brand-text)] hover:underline cursor-pointer"
                            >
                              {t('slashInsertBtn')}
                            </button>
                          </div>
                        </div>
                        <input
                          ref={activeInputRef}
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            setFieldsDraft((prev) => ({ ...prev, [fieldKey]: nextVal }));
                            if (nextVal.endsWith('/')) {
                              setAppState({ slashMenuOpen: true });
                            }
                          }}
                          className="w-full bg-transparent text-[16px] font-medium focus:outline-none"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={fieldKey}
                      role="button"
                      tabIndex={0}
                      aria-label={`${fieldKey}: ${t('clickToEdit')}`}
                      onClick={() => setActiveFieldKey(fieldKey)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setActiveFieldKey(fieldKey);
                        }
                      }}
                      className="cursor-text group rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                    >
                      <div className="text-[11px] text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                        <span>{fieldKey}</span>
                        <span className="text-[10px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-[var(--dur-fast)] text-[var(--brand-text)]">
                          {t('clickToEdit')}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={val}
                        onFocus={() => setActiveFieldKey(fieldKey)}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setFieldsDraft((prev) => ({ ...prev, [fieldKey]: nextVal }));
                        }}
                        className={
                          isPrimaryFront
                            ? 'w-full bg-transparent text-[26px] font-bold tracking-tight focus:outline-none'
                            : 'w-full bg-transparent text-[13px] opacity-85 focus:outline-none border-b border-transparent hover:border-[#8E8E93]/30 pb-1'
                        }
                      />
                    </div>
                  );
                })}

                <div
                  className={`pt-3 border-t flex items-center justify-between text-[11px] text-[var(--text-secondary)] ${
                    isDark ? 'border-white/[0.06]' : 'border-[#ECECF2]'
                  }`}
                >
                  <span className={hasDraftChanges ? 'text-[var(--status-warning-text)] font-medium' : ''}>
                    {hasDraftChanges ? `● ${t('unsavedChangesBadge')}` : t('autoSaved')}
                  </span>
                  <span>
                    {formatShortcut('Cmd Enter', platform)} {t('saveChangesBtn')} · Esc {t('cancel')}
                  </span>
                </div>

                {slashMenuOpen && (
                  <div
                    className={`absolute start-20 -bottom-44 w-[240px] rounded-2xl border shadow-2xl p-2 z-40 ${
                      isDark
                        ? 'bg-[#1C1D24] border-white/[0.1] text-white'
                        : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'
                    }`}
                  >
                    <div className="space-y-0.5 mt-0.5">
                      {slashItems.map((item, idx) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setSelectedSlashIdx(idx)}
                          onClick={item.action}
                          className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center gap-3 cursor-pointer transition-colors ${
                            idx === selectedSlashIdx
                              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-medium'
                              : 'hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <span className="w-5 text-center font-mono text-[11px] text-[var(--brand-text)]">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Top Card Meta */}
                <div
                  ref={cardHeaderMetaRef}
                  className={`flex items-center justify-between ${
                    isSandboxCard ? 'mb-2.5' : isStageWidened ? 'mb-3.5' : 'mb-4'
                  } will-change-[opacity]`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`reviewer-badge-trim px-2.5 py-0.5 rounded-md text-[11px] font-medium ${
                        isCardFlipped
                          ? 'bg-[var(--status-success-soft)] text-[var(--status-success-text)]'
                          : 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                      }`}
                    >
                      {isCardFlipped ? t('answerSideBadge') : t('questionSideBadge')}
                    </span>

                    {activeFlagSpec && (
                      <Tooltip variant="compact" content={t('clearFlagBtn')} shortcut="Cmd+0">
                        <button
                          type="button"
                          onClick={() => appActions.setCurrentReviewCardFlag(0, false)}
                          aria-label={t('clearFlagBtn')}
                          style={{
                            backgroundColor: activeFlagSpec.bgSoft,
                            borderColor: activeFlagSpec.borderHex,
                            color: activeFlagSpec.hex,
                          }}
                          className="reviewer-badge-trim px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: activeFlagSpec.hex }}
                          />
                          <span>{t(`flagShort_${activeFlagNum}` as any)}</span>
                        </button>
                      </Tooltip>
                    )}

                    {visibleAudioFiles.map((audioFile) => (
                        <button
                          key={audioFile}
                          onClick={(e) => {
                            e.stopPropagation();
                            appActions.playAudio(audioFile);
                          }}
                          className={`reviewer-badge-trim px-2.5 py-0.5 rounded-md text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors ${
                            playingAudioFile === audioFile
                              ? 'bg-[var(--brand)] text-white'
                              : isDark
                              ? 'bg-white/[0.06] text-[#C8C8D2] hover:bg-white/[0.12]'
                              : 'bg-[#F2F2F7] text-[#3A3A3C] hover:bg-[#E5E5EA]'
                          }`}
                        >
                          <svg className="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          <span>{t('pronounceBtn')}</span>
                        </button>
                      ))}
                  </div>

                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {t('fsrsPredictHeader', {
                      ivl: (currentCard.predictions?.good || '').replace('后', ''),
                    })}
                  </span>
                </div>

                {isSandboxCard ? (
                  <div className="my-1">
                    <SandboxCardFrame
                      cardId={currentCard.id}
                      cardOrd={currentCard.cardOrd}
                      frontHtml={currentCard.sandboxFrontHtml || currentCard.frontHtml}
                      backHtml={currentCard.sandboxBackHtml || currentCard.backHtml}
                      cssText={currentCard.sandboxCss || ''}
                      mediaHttpBaseUrl={currentCard.sandboxMediaBaseUrl || envInfo.mediaHttpBaseUrl}
                      preloadScripts={currentCard.sandboxPreloadScripts}
                      isFlipped={isCardFlipped}
                      isDark={isDark}
                      audioFiles={currentCard.audioFiles}
                      frontAudioFiles={currentCard.frontAudioFiles}
                      backAudioFiles={currentCard.backAudioFiles}
                      sandboxQuestionAudioFiles={currentCard.sandboxQuestionAudioFiles}
                      sandboxAnswerAudioFiles={currentCard.sandboxAnswerAudioFiles}
                      contentScale={scaleFactor}
                      onImageZoom={(target) => setLightboxTarget({ mode: 'img', src: target.src, alt: target.alt })}
                    />
                  </div>
                ) : (
                  <>
                    {/* Headword & Reading (hidden on flip when replaceFrontOnFlip is true so afmt replaces the whole card cleanly) */}
                    {!(isCardFlipped && currentCard.replaceFrontOnFlip) && (() => {
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
                        ? 'font-semibold leading-relaxed tracking-normal whitespace-pre-wrap'
                        : frontTextLen > 35
                        ? 'font-bold leading-snug tracking-tight whitespace-pre-wrap'
                        : 'font-bold leading-tight tracking-tight whitespace-pre-wrap';

                      return (
                        <div className="mb-6 select-text cursor-text">
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
                              __html: renderMathAndRichHtml(frontHtmlContent, !isCardFlipped),
                            }}
                          />
                          {currentCard.reading && !isNativeStyledFront && (
                            <p
                              style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                              className="text-[var(--text-secondary)] mt-1.5"
                            >
                              {currentCard.reading}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {isCardFlipped ? (() => {
                      const backHtmlContent = currentCard.backHtml || currentCard.meaning || '';
                      const hasBackBody = backHtmlContent.trim().length > 0;
                      const hasExtraHints = Boolean(
                        currentCard.etymology || currentCard.example || currentCard.extraHint
                      );
                      if (!hasBackBody && !hasExtraHints) {
                        return null;
                      }
                      const isNativeStyledBack = Boolean(
                        (currentCard.backHtml || '').includes('anki-native-card')
                      );
                      return (
                      <div className="ui-answer-reveal">
                        {!currentCard.replaceFrontOnFlip && (
                          <div
                            className={`h-[1px] my-5 ui-divider-reveal ${
                              isDark ? 'bg-white/[0.07]' : 'bg-[#ECECF2]'
                            }`}
                          />
                        )}

                        {/* Meaning */}
                        {hasBackBody && (
                            <div
                              style={
                                isNativeStyledBack
                                  ? scaleFactor !== 1
                                    ? { zoom: scaleFactor }
                                    : undefined
                                  : { fontSize: `${Math.round(17 * scaleFactor * 10) / 10}px` }
                              }
                              className={`select-text cursor-text break-words ${
                                isNativeStyledBack
                                  ? 'w-full text-[16px] leading-relaxed [&_img]:max-h-[var(--reviewer-img-max-h)] [&_img:not([width])]:w-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer'
                                  : 'font-medium leading-relaxed whitespace-pre-wrap [&_img]:max-h-[var(--reviewer-img-max-h)] [&_img:not([width])]:w-auto [&_img]:max-w-full [&_img:not([width]):not([height])]:rounded-xl [&_img:not([width]):not([height])]:my-3 [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer [&_.anki-io-wrap]:cursor-zoom-in [&_.anki-io-wrap_img]:!my-0 [&_.anki-io-wrap_img]:!max-h-[var(--reviewer-io-max-h)]'
                              } [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[0.85em] ${
                                isDark
                                  ? 'text-[#EFEFF5] [&_code]:bg-white/10'
                                  : 'text-[#1D1D1F] [&_code]:bg-[#F2F2F7]'
                              }`}
                              dangerouslySetInnerHTML={{
                                __html: renderMathAndRichHtml(backHtmlContent),
                              }}
                            />
                        )}

                        {/* Progressive Hints */}
                        {hasExtraHints && (
                        <div className={hasBackBody ? 'mt-5 space-y-2.5' : 'space-y-2.5'}>
                          {currentCard.etymology && (
                            <div
                              style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                              className="flex items-center gap-2.5"
                            >
                              <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-medium shrink-0">
                                {t('etymologyBadge')}
                              </span>
                              <span
                                className={isDark ? 'text-[#C8C8D2]' : 'text-[#4A4A52]'}
                                dangerouslySetInnerHTML={{
                                  __html: renderMathAndRichHtml(currentCard.etymology),
                                }}
                              />
                            </div>
                          )}

                          {revealedHintsCount >= 2 && currentCard.example && (
                            <div
                              style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                              className="flex items-center gap-2.5"
                            >
                              <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-medium shrink-0">
                                {t('exampleBadge')}
                              </span>
                              <span
                                className={isDark ? 'text-[#C8C8D2]' : 'text-[#4A4A52]'}
                                dangerouslySetInnerHTML={{
                                  __html: renderMathAndRichHtml(currentCard.example),
                                }}
                              />
                            </div>
                          )}

                          {revealedHintsCount >= 3 && currentCard.extraHint ? (
                            <div
                              style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                              className="flex items-center gap-2.5"
                            >
                              <span className="px-2 py-0.5 rounded bg-[var(--status-success-soft)] text-[var(--status-success)] text-[11px] font-medium shrink-0">
                                {t('collocationBadge')}
                              </span>
                              <span
                                className={isDark ? 'text-[#C8C8D2]' : 'text-[#4A4A52]'}
                                dangerouslySetInnerHTML={{
                                  __html: renderMathAndRichHtml(currentCard.extraHint),
                                }}
                              />
                            </div>
                          ) : currentCard.extraHint ? (
                            <button
                              type="button"
                              onClick={() => appActions.revealNextHint()}
                              className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--brand-text)] transition-colors cursor-pointer pt-1 block"
                            >
                              {t('tabRevealHint')}
                            </button>
                          ) : null}
                        </div>
                        )}
                      </div>
                      );
                    })() : (
                      <div
                        className={`py-3 flex flex-col items-center justify-center border-t border-dashed mt-3.5 ${
                          isDark ? 'border-white/[0.06]' : 'border-black/[0.07]'
                        }`}
                      >
                        <p className="text-[12.5px] text-[var(--text-secondary)]">{t('recallPrompt')}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Bottom Card Tags & Review Count — Smart Collapsed */}
                {(currentCard.tags.length > 0 || currentCard.reps > 0) && (
                  <div className="mt-2.5 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {currentCard.tags.slice(0, 2).map((tag) => (
                        <Tooltip key={tag} variant="compact" content={`#${tag}`} onlyWhenTruncated>
                          <span
                            className={`reviewer-badge-trim inline-block align-middle px-2 py-0.5 rounded-md text-[10px] truncate max-w-[120px] ${
                              isDark
                                ? 'bg-white/[0.07] text-[#C8C8D2]'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-primary)]/80'
                            }`}
                          >
                            #{tag}
                          </span>
                        </Tooltip>
                      ))}
                      {currentCard.tags.length > 2 && (
                        <Tooltip
                          variant="compact"
                          content={currentCard.tags.slice(2).map((tItem) => `#${tItem}`).join(', ')}
                        >
                          <span
                            className={`reviewer-badge-trim px-1.5 py-0.5 rounded-md text-[10px] cursor-default ${
                              isDark
                                ? 'bg-white/[0.06] text-[var(--text-secondary)]'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-primary)]/80'
                            }`}
                          >
                            +{currentCard.tags.length - 2}
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    {currentCard.reps > 0 && (
                      <span className="text-[11px] text-[var(--text-secondary)] shrink-0 ms-auto font-mono tabular-nums">
                        {t('reviewedCountText', {
                          reps: currentCard.reps,
                          last: currentCard.lastReviewText,
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
        </main>
  );

  /* Unified Single-Row Decision Dock — Theme-Harmonized */
  const bottomFooterNode = !inlineEditing && (
        <footer
          ref={dockFooterRef}
          data-gesture-active-side="none"
          data-shifted={inspectorOpen ? 'true' : 'false'}
          className={`reviewer-bottom-dock reviewer-stage-shift shrink-0 px-6 py-2.5 flex items-center justify-center border-t backdrop-blur-md z-10 ${
            isDark ? 'border-white/[0.06]' : 'border-[var(--border-subtle)]'
          } ${inspectorOpen ? 'ltr:-translate-x-28 rtl:translate-x-28' : ''}`}
        >
          <div className="reviewer-dock-grid w-full max-w-[960px] mx-auto grid items-center gap-4">
            {/* Start Wing: Session Studied */}
            <div className="reviewer-dock-wing reviewer-dock-wing--start flex items-center justify-start min-w-0">
              <Tooltip
                variant="compact"
                content={`${t('sessionStudiedLabel')}: ${sessionStudiedCount}`}
                side="top"
              >
                <div
                  aria-label={`${t('sessionStudiedLabel')}: ${sessionStudiedCount}`}
                  className="reviewer-dock-stat inline-flex items-center gap-1.5 min-w-0 text-[11.5px] text-[var(--text-secondary)] tabular-nums"
                >
                  <span className="reviewer-dock-stat-label truncate">
                    {t('sessionStudiedLabel')}
                  </span>
                  <span className="reviewer-dock-stat-value font-medium text-[var(--text-primary)]/85 shrink-0">
                    {sessionStudiedCount}
                  </span>
                </div>
              </Tooltip>
            </div>

            {/* Center: Primary Flip / Rating Controls (48px tall) */}
            <div className="reviewer-cta-shell w-full h-[48px]">
              {renderRatingControls(false)}
            </div>

            {/* End Wing: Session Accuracy (softly fades when right inspector drawer opens) */}
            <div
              data-hidden-by-inspector={inspectorOpen ? 'true' : 'false'}
              aria-hidden={inspectorOpen || undefined}
              className="reviewer-dock-wing reviewer-dock-wing--end flex items-center justify-end min-w-0"
            >
              <Tooltip
                variant="compact"
                content={`${t('sessionAccuracyLabel')}: ${accuracyPct}%`}
                side="top"
              >
                <div
                  aria-label={`${t('sessionAccuracyLabel')}: ${accuracyPct}%`}
                  className="reviewer-dock-stat inline-flex items-center gap-1.5 min-w-0 text-[11.5px] text-[var(--text-secondary)] tabular-nums"
                >
                  <span className="reviewer-dock-stat-label truncate">
                    {t('sessionAccuracyLabel')}
                  </span>
                  <span className="reviewer-dock-stat-value font-medium text-[var(--text-primary)]/85 shrink-0">
                    {accuracyPct}%
                  </span>
                </div>
              </Tooltip>
            </div>
          </div>
        </footer>
  );

  /* Right-Side Full-Height Control Rail (for tall / medical / heavy-reading cards) */
  const sideControlRailNode = (
    <aside
      ref={dockFooterRef}
      data-gesture-active-side="none"
      aria-label={t('moreCardActions')}
      className={`reviewer-side-rail shrink-0 h-full relative flex flex-col border-s backdrop-blur-md z-20 ${
        isDark ? 'border-white/[0.07]' : 'border-[var(--border-subtle)]'
      }`}
    >
      {/* Top Rail Header: Window Drag + Back + Deck Meta + 5-Icon Toolbar + Progress */}
      <div
        onMouseDown={startWindowDrag}
        onDoubleClick={handleWindowDoubleClick}
        className={`relative px-3.5 pt-3.5 pb-3.5 flex flex-col gap-2.5 border-b ${
          isDark ? 'border-white/[0.06]' : 'border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {renderBackButton(true)}
          <Tooltip
            variant="compact"
            content={inlineEditing ? t('editCardTitle') : currentCard.deckName}
            onlyWhenTruncated
            side="bottom"
            triggerClassName="min-w-0 flex-1"
          >
            <div className="text-[13px] font-semibold tracking-tight truncate min-w-0">
              {inlineEditing ? t('editCardTitle') : currentCard.deckName}
            </div>
          </Tooltip>
        </div>

        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-[11px] text-[var(--text-secondary)] tabular-nums truncate">
            {inlineEditing
              ? `${currentCard.deckName} · ${currentCard.noteTypeName || 'Basic'}`
              : `${currentNumber} / ${totalSessionCards}`}
          </span>
          {(currentCard.isCloze || isPreviewSession) && (
            <div className="flex items-center gap-1 shrink-0">{renderSessionBadges()}</div>
          )}
        </div>

        {!inlineEditing && (
          <>
            <div
              ref={toolbarRef}
              role="toolbar"
              aria-label={t('moreCardActions')}
              onKeyDown={handleToolbarKeyDown}
              onFocus={handleToolbarFocus}
              className="reviewer-toolbar reviewer-side-toolbar"
              {...({ focusgroup: 'toolbar wrap' } as Record<string, unknown>)}
            >
              <Tooltip
                variant="compact"
                content={t('reviewAudioQuickBtn')}
                shortcut={manualAudioFiles.length > 0 ? 'R' : undefined}
                side="bottom"
                disabled={audioPopoverOpen}
              >
                <button
                  ref={audioAnchorRef}
                  type="button"
                  data-toolbar-item="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  popoverTarget={audioPopoverId}
                  aria-label={t('reviewAudioQuickBtn')}
                  aria-expanded={audioPopoverOpen}
                  style={{ ['anchorName' as string]: '--reviewer-audio-anchor' }}
                  className={`reviewer-toolbar-btn h-8 w-full rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                    playingAudioFile || audioPopoverOpen
                      ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                      : headerBtnSurface
                  }`}
                >
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
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    {autoPlayFrontAudio || autoPlayBackAudio || manualAudioFiles.length > 0 ? (
                      <>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      </>
                    ) : (
                      <path
                        d="M15.54 8.46a5 5 0 0 1 0 7.07"
                        className="opacity-40"
                        strokeDasharray="2 2"
                      />
                    )}
                  </svg>
                </button>
              </Tooltip>

              <Tooltip
                variant="compact"
                content={
                  activeFlagSpec
                    ? `${t('flagFilterLabel')}: ${t(`flagLabel_${activeFlagNum}` as any)}`
                    : t('flagFilterLabel')
                }
                shortcut="Cmd 1-7"
                side="bottom"
                disabled={flagPopoverOpen}
              >
                <button
                  ref={flagAnchorRef}
                  type="button"
                  data-toolbar-item="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  popoverTarget={flagPopoverId}
                  aria-label={
                    activeFlagSpec
                      ? `${t('flagFilterLabel')}: ${t(`flagLabel_${activeFlagNum}` as any)}`
                      : t('flagFilterLabel')
                  }
                  aria-expanded={flagPopoverOpen}
                  style={{
                    ...(activeFlagSpec
                      ? {
                          backgroundColor: activeFlagSpec.bgSoft,
                          borderColor: activeFlagSpec.borderHex,
                          color: activeFlagSpec.hex,
                        }
                      : undefined),
                    ['anchorName' as string]: '--reviewer-flag-anchor',
                  }}
                  className={`reviewer-toolbar-btn h-8 w-full rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                    activeFlagSpec ? '' : headerBtnSurface
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill={activeFlagSpec ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </button>
              </Tooltip>

              <Tooltip
                variant="compact"
                content={t('reviewDisplayBtn')}
                side="bottom"
                disabled={displayPopoverOpen}
              >
                <button
                  ref={displayAnchorRef}
                  type="button"
                  data-toolbar-item="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  popoverTarget={displayPopoverId}
                  aria-label={t('reviewDisplayBtn')}
                  aria-expanded={displayPopoverOpen}
                  style={{ ['anchorName' as string]: '--reviewer-display-anchor' }}
                  className={`reviewer-toolbar-btn h-8 w-full rounded-lg border text-[11px] font-medium flex items-center justify-center cursor-pointer transition-colors ${
                    displayPopoverOpen ||
                    reviewContentScale !== 100 ||
                    reviewStageWidth !== 'auto' ||
                    compatMode
                      ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                      : headerBtnSurface
                  }`}
                >
                  <span className="font-bold tracking-tight text-[12px]">Aa</span>
                </button>
              </Tooltip>

              <Tooltip variant="compact" content={t('editCardTitle')} shortcut="E" side="bottom">
                <button
                  type="button"
                  data-toolbar-item="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (currentCard) appActions.openCardEditor(currentCard);
                  }}
                  aria-label={t('editCardTitle')}
                  className={`reviewer-toolbar-btn h-8 w-full rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${headerBtnSurface}`}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              </Tooltip>

              <Tooltip variant="compact" content={t('cardInfoTitle')} shortcut="Cmd I" side="bottom">
                <button
                  type="button"
                  data-toolbar-item="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setAppState((prev) => ({ inspectorOpen: !prev.inspectorOpen }))}
                  aria-label={t('cardInfoTitle')}
                  aria-expanded={inspectorOpen}
                  className={`reviewer-toolbar-btn h-8 w-full rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                    inspectorOpen
                      ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                      : headerBtnSurface
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>
              </Tooltip>
            </div>

            {popoversNode}
          </>
        )}

        {renderProgressBar()}
      </div>

      {/* Middle Action Zone: Two-Line Spacious Rating Buttons or Inline Edit Save/Cancel */}
      <div className="flex-1 min-h-0 px-3.5 py-4 flex flex-col justify-center overflow-y-auto">
        {inlineEditing ? (
          <div className="flex flex-col gap-2.5 w-full">
            <div
              className={`text-[11.5px] text-center mb-1 ${
                hasDraftChanges
                  ? 'text-[var(--status-warning-text)] font-medium'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {hasDraftChanges ? `● ${t('unsavedChangesBadge')}` : t('autoSaved')}
            </div>
            <button
              type="button"
              onClick={() => {
                commitInlineChanges();
                appActions.exitInlineEdit();
              }}
              style={{ backgroundColor: brandHex }}
              className={`reviewer-cta-btn reviewer-cta-btn--solid w-full h-[44px] px-4 rounded-xl text-[13px] font-semibold text-white shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                hasDraftChanges
                  ? 'hover:opacity-95 motion-safe:active:scale-[0.975]'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              {t('saveChangesBtn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setFieldsDraft({ ...originalFieldsDraft });
                appActions.exitInlineEdit();
              }}
              className={`reviewer-toolbar-btn w-full h-[40px] px-4 rounded-xl border text-[12.5px] font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#3A3A46] text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-black hover:bg-black/5'
              }`}
            >
              {t('cancel')}
            </button>
          </div>
        ) : (
          renderRatingControls(true)
        )}
      </div>

      {/* Bottom Session Stats Footer */}
      {!inlineEditing && (
        <div
          className={`shrink-0 px-3.5 py-3 border-t grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-center gap-2.5 ${
            isDark ? 'border-white/[0.06]' : 'border-[var(--border-subtle)]'
          }`}
        >
          <Tooltip
            variant="compact"
            content={`${t('sessionStudiedLabel')}: ${sessionStudiedCount}`}
            side="top"
          >
            <div
              aria-label={`${t('sessionStudiedLabel')}: ${sessionStudiedCount}`}
              className="flex flex-col items-start min-w-0 tabular-nums"
            >
              <span className="text-[10.5px] text-[var(--text-secondary)] truncate max-w-full">
                {t('sessionStudiedLabel')}
              </span>
              <span className="text-[13px] font-semibold text-[var(--text-primary)]/90 leading-tight mt-0.5">
                {sessionStudiedCount}
              </span>
            </div>
          </Tooltip>

          <span
            aria-hidden="true"
            className={`h-6 w-px ${isDark ? 'bg-white/[0.08]' : 'bg-[var(--border-subtle)]'}`}
          />

          <Tooltip
            variant="compact"
            content={`${t('sessionAccuracyLabel')}: ${accuracyPct}%`}
            side="top"
          >
            <div
              aria-label={`${t('sessionAccuracyLabel')}: ${accuracyPct}%`}
              className="flex flex-col items-end min-w-0 tabular-nums"
            >
              <span className="text-[10.5px] text-[var(--text-secondary)] truncate max-w-full">
                {t('sessionAccuracyLabel')}
              </span>
              <span className="text-[13px] font-semibold text-[var(--text-primary)]/90 leading-tight mt-0.5">
                {accuracyPct}%
              </span>
            </div>
          </Tooltip>
        </div>
      )}
    </aside>
  );

        {/* RIGHT INSPECTOR DRAWER (Light & Dark Adapted) */}
  const inspectorDrawerNode = (
    <>
      {inspectorPresence.mounted && (
          <aside
            data-state={inspectorPresence.state}
            className={`reviewer-inspector absolute end-0 top-0 bottom-0 w-[300px] backdrop-blur-xl border-s p-6 flex flex-col justify-between z-40 ${inspectorSurface}`}
          >
            <div className="space-y-5 overflow-y-auto pe-0.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold">{t('cardInfoTitle')}</h3>
                <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
                  <button
                    type="button"
                    aria-label={t('close')}
                    onClick={() => setAppState({ inspectorOpen: false })}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--brand-text)] hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </div>

              {/* 7-Color Flag Picker inside Inspector */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] mb-2">
                  <span>{t('flagFilterLabel')}</span>
                  {(activeFlagSpec || showShortcutHints) && (
                    <span className="font-mono text-[10px]">
                      {activeFlagSpec
                        ? t(`flagLabel_${activeFlagNum}` as any)
                        : formatShortcut('Cmd 1-7', platform)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
                    const spec = ANKI_FLAG_PALETTE[fNum];
                    const isSel = activeFlagNum === fNum;
                    return (
                      <Tooltip
                        key={fNum}
                        variant="compact"
                        content={t(`flagLabel_${fNum}` as any)}
                        shortcut={`Cmd+${fNum}`}
                      >
                        <button
                          type="button"
                          onClick={() => appActions.setCurrentReviewCardFlag(fNum, true)}
                          aria-label={t(`flagLabel_${fNum}` as any)}
                          className={`w-7 h-7 rounded-xl border flex items-center justify-center cursor-pointer transition-[background-color,border-color,color,transform,opacity] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                            isSel
                              ? 'scale-110 ring-2 ring-offset-1 dark:ring-offset-[#121318]'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: spec.bgSoft,
                            borderColor: isSel ? spec.hex : spec.borderHex,
                          }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: spec.hex }}
                          />
                        </button>
                      </Tooltip>
                    );
                  })}
                  <Tooltip variant="compact" content={t('clearFlagBtn')} shortcut="Cmd+0">
                    <button
                      type="button"
                      onClick={() => appActions.setCurrentReviewCardFlag(0, false)}
                      aria-label={t('clearFlagBtn')}
                      className={`w-7 h-7 rounded-xl border text-[11px] flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                        activeFlagNum === 0
                          ? 'opacity-40'
                          : 'text-[var(--text-secondary)] hover:text-[var(--status-danger-text)] border-black/10 dark:border-white/10'
                      }`}
                    >
                      <CloseIcon className="w-3 h-3" strokeWidth={2.2} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Deck Selector */}
              <div>
                <label
                  id="reviewer-inspector-deck-label"
                  htmlFor="reviewer-inspector-deck-select"
                  className="block text-[11px] text-[var(--text-secondary)] mb-2"
                >
                  {t('deckLabel')}
                </label>
                <StudioSelect
                  id="reviewer-inspector-deck-select"
                  ariaLabelledBy="reviewer-inspector-deck-label"
                  size="md"
                  value={currentCard.deckId}
                  options={decks.map((d) => ({
                    value: d.id,
                    label: d.fullName || d.name,
                  }))}
                  onChange={(nextDeckId) => {
                    const found = decks.find((d) => d.id === nextDeckId);
                    appActions.saveInlineCardUpdate({
                      deckId: nextDeckId,
                      deckName: found ? found.name : currentCard.deckName,
                    });
                  }}
                  searchable="auto"
                  className="w-full"
                />
              </div>

              {/* Tags Manager */}
              <div>
                <div className="text-[11px] text-[var(--text-secondary)] mb-2">{t('tagsLabel')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {currentCard.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        appActions.saveInlineCardUpdate({
                          tags: currentCard.tags.filter((tItem) => tItem !== tag),
                        })
                      }
                      aria-label={`${t('delete') || '×'} ${tag}`}
                      className={`px-2.5 py-1 rounded-lg text-[11px] hover:bg-[var(--status-danger-soft)] hover:text-[var(--status-danger-text)] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1 ${
                        isDark ? 'bg-[#1C1D26] text-[#C8C8D2]' : 'bg-[#F2F2F7] text-[#3A3A3C]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}

                  {addingTag ? (
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTagInput.trim()) {
                          appActions.saveInlineCardUpdate({
                            tags: [...currentCard.tags, newTagInput.trim()],
                          });
                          setNewTagInput('');
                          setAddingTag(false);
                        } else if (e.key === 'Escape') {
                          setAddingTag(false);
                        }
                      }}
                      placeholder="..."
                      autoFocus
                      className="w-20 px-2 py-0.5 rounded-lg border border-[var(--brand)] text-[11px] bg-transparent focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingTag(true)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-medium hover:bg-[var(--brand-soft-strong)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1"
                    >
                      {t('addTagBtn')}
                    </button>
                  )}
                </div>
              </div>

              {/* Review History Log */}
              <div>
                <div className="text-[11px] text-[var(--text-secondary)] mb-2.5">{t('reviewHistoryLabel')}</div>
                <div className="space-y-2.5">
                  {currentCard.history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--text-secondary)]">{h.date}</span>
                      <span className={h.remembered ? 'text-[var(--status-success-text)]' : 'text-[var(--status-danger-text)]'}>
                        {h.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`pt-3.5 border-t ${
                isDark ? 'border-white/[0.07]' : 'border-[var(--border-subtle)]'
              }`}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {/* 1. Undo */}
                <Tooltip
                  variant="compact"
                  content={t('undoBtnShort')}
                  shortcut="Cmd Z"
                  triggerClassName="w-full"
                >
                  <button
                    type="button"
                    disabled={!canUndo}
                    onClick={() => {
                      setConfirmingForget(false);
                      setConfirmingDelete(false);
                      appActions.undoLastReview();
                    }}
                    aria-label={t('undoBtnShort')}
                    className={`w-full h-8 px-2.5 rounded-lg border text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 min-w-0 transition-[background-color,border-color,color,opacity] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                      canUndo ? inspectorActionIdle : inspectorActionDisabled
                    }`}
                  >
                    <svg
                      className={`w-3.5 h-3.5 shrink-0 ${
                        canUndo ? 'text-[var(--text-secondary)]' : 'opacity-80'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 14 4 9l5-5" />
                      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
                    </svg>
                    <span className="truncate">{t('undoBtnShort')}</span>
                    {showShortcutHints && (
                      <span className="font-mono text-[9.5px] opacity-60 shrink-0">
                        {formatShortcut('Cmd Z', platform)}
                      </span>
                    )}
                  </button>
                </Tooltip>

                {/* 2. Reset Progress (Forget Card) */}
                {confirmingForget ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingForget(false);
                      appActions.forgetCurrentReviewCard();
                    }}
                    aria-label={t('forgetCardBtn')}
                    className="w-full h-8 px-2.5 rounded-lg border border-[var(--status-warning)] bg-[var(--status-warning)] text-white text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 min-w-0 cursor-pointer transition-[background-color,border-color,opacity] hover:opacity-92 focus-visible:outline-2 focus-visible:outline-[var(--status-warning)] focus-visible:outline-offset-2"
                  >
                    <span className="truncate">{t('confirm')}</span>
                  </button>
                ) : (
                  <Tooltip
                    variant="compact"
                    content={t('forgetCardTooltip')}
                    triggerClassName="w-full"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDelete(false);
                        setConfirmingForget(true);
                      }}
                      aria-label={t('forgetCardBtn')}
                      className={`w-full h-8 px-2.5 rounded-lg border text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 min-w-0 transition-[background-color,border-color,color,opacity] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${inspectorActionIdle}`}
                    >
                      <svg
                        className="w-3.5 h-3.5 shrink-0 text-[var(--text-secondary)]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      <span className="truncate">{t('forgetCardBtn')}</span>
                    </button>
                  </Tooltip>
                )}

                {/* 3. Bury Card */}
                <Tooltip
                  variant="compact"
                  content={t('buryCardBtn')}
                  triggerClassName="w-full"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingForget(false);
                      setConfirmingDelete(false);
                      appActions.buryCurrentReviewCard();
                    }}
                    className={`w-full h-8 px-2.5 rounded-lg border text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 min-w-0 transition-[background-color,border-color,color,opacity] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${inspectorActionIdle}`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0 text-[var(--text-secondary)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                    </svg>
                    <span className="truncate">{t('batchBury')}</span>
                  </button>
                </Tooltip>

                {/* 4. Suspend / Unsuspend Card */}
                <Tooltip
                  variant="compact"
                  content={currentCard.suspended ? t('unsuspendCardBtn') : t('suspendCardBtn')}
                  triggerClassName="w-full"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingForget(false);
                      setConfirmingDelete(false);
                      appActions.toggleSuspendCurrentReviewCard();
                    }}
                    className={`w-full h-8 px-2.5 rounded-lg border text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 min-w-0 cursor-pointer transition-[background-color,border-color,color,opacity] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                      currentCard.suspended
                        ? 'bg-[var(--brand-soft)] border-[var(--brand-border)] text-[var(--brand-text)]'
                        : inspectorActionIdle
                    }`}
                  >
                    <svg
                      className={`w-3.5 h-3.5 shrink-0 ${
                        currentCard.suspended ? '' : 'text-[var(--text-secondary)]'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {currentCard.suspended ? (
                        <polygon points="6 4 20 12 6 20 6 4" />
                      ) : (
                        <>
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </>
                      )}
                    </svg>
                    <span className="truncate">
                      {currentCard.suspended ? t('unsuspendCardBtn') : t('suspendCardBtn')}
                    </span>
                  </button>
                </Tooltip>

                {/* 5. Copy Debug Info */}
                <CopyDebugInfoButton
                  key={currentCard.id}
                  label={t('copyDebugInfoShort')}
                  copiedLabel={t('copiedBadge')}
                  tooltipText={t('copyDebugInfoTooltip')}
                  ariaLabel={t('copyDebugInfoBtn')}
                  copiedToast={t('debugInfoCopiedToast')}
                  failedToast={t('copyFailedToast')}
                  triggerClassName="w-full"
                  className="w-full h-8 px-2.5 rounded-lg border text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 min-w-0 transition-[background-color,border-color,color,opacity] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                  idleClassName={inspectorActionIdle}
                  onCopyDebugInfo={() =>
                    collectAndCopyCardDebugInfo({
                      client: {
                        sourceView: 'reviewer',
                        envInfo,
                        theme,
                        accentColor,
                        resolvedLang,
                        compatMode,
                        sandboxNoteTypeIds,
                        autoPlayFrontAudio,
                        autoPlayBackAudio,
                        reviewStageWidth,
                        reviewContentScale,
                        reviewDockPosition,
                        isPreviewSession,
                        isCardFlipped,
                        isSandboxCard,
                      },
                      card: cardDebugSnapshotFromReviewCard(currentCard),
                    })
                  }
                />

                {/* 6. Delete Card */}
                {confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                      appActions.deleteCurrentReviewCard();
                    }}
                    className="w-full h-8 px-2.5 rounded-lg border border-[var(--status-danger)] bg-[var(--status-danger)] text-white text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 min-w-0 cursor-pointer transition-[background-color,border-color,opacity] hover:opacity-92 focus-visible:outline-2 focus-visible:outline-[var(--status-danger)] focus-visible:outline-offset-2"
                    aria-label={t('deleteCardBtn')}
                  >
                    <span className="truncate">{t('confirm')}</span>
                  </button>
                ) : (
                  <Tooltip
                    variant="compact"
                    content={t('deleteCardBtn')}
                    triggerClassName="w-full"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingForget(false);
                        setConfirmingDelete(true);
                      }}
                      aria-label={t('deleteCardBtn')}
                      className={`w-full h-8 px-2.5 rounded-lg border text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 min-w-0 transition-[background-color,border-color,color,opacity] focus-visible:outline-2 focus-visible:outline-[var(--status-danger)] focus-visible:outline-offset-2 ${inspectorDangerIdle}`}
                    >
                      <svg
                        className="w-3.5 h-3.5 shrink-0 opacity-85"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                      <span className="truncate">{t('deleteCardBtn')}</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          </aside>
      )}
    </>
  );

  return (
    <div
      data-dock-position={reviewDockPosition}
      className={`fixed inset-0 z-30 flex ${
        isSideDock ? 'flex-row' : 'flex-col'
      } select-none overflow-hidden transition-colors ${screenBg}`}
    >
      {!isSideDock && bottomHeaderNode}

      <div className="flex-1 min-h-0 min-w-0 relative flex flex-col overflow-hidden">
        {cardStageMainNode}
        {!isSideDock && bottomFooterNode}
        {!isSideDock && inspectorDrawerNode}
      </div>

      {isSideDock && sideControlRailNode}
      {isSideDock && inspectorDrawerNode}

      {lightboxPresence.mounted && (lightboxTarget ?? lastLightboxTargetRef.current) && (
        <ReviewerImageLightbox
          target={(lightboxTarget ?? lastLightboxTargetRef.current)!}
          presenceState={lightboxPresence.state}
          onClose={() => setLightboxTarget(null)}
        />
      )}
    </div>
  );
};
