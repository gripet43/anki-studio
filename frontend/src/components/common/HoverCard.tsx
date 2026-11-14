import React, {
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ensureInputModalityListener,
  type FloatingAlign,
  type FloatingSide,
  hasRenderableContent,
  isDisabledTriggerProps,
  isElementFocusVisible,
  renderAnchoredTrigger,
  useFloatingPosition,
} from '../../hooks/useFloatingPosition';
import { usePresence } from '../../hooks/usePresence';
import { getClosestFromTarget } from '../../utils/domTarget';

export type HoverCardSize = 'sm' | 'md' | 'lg' | 'auto';

export const HOVERCARD_SIZE_CLASSES: Record<HoverCardSize, string> = {
  sm: 'w-[220px]',
  md: 'w-[248px]',
  lg: 'w-[280px]',
  auto: '',
};

const DEFAULT_OPEN_DELAY_MS = 180;
const DEFAULT_CLOSE_DELAY_MS = 150;
const HOVERCARD_EXIT_MS = 80;

const NATIVE_ACTIVATION_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);

export interface HoverCardProps {
  children: React.ReactNode;
  content: React.ReactNode;
  size?: HoverCardSize;
  side?: FloatingSide;
  align?: FloatingAlign;
  offset?: number;
  viewportPadding?: number;
  openDelay?: number;
  closeDelay?: number;
  toggleOnClick?: boolean;
  openOnFocus?: boolean;
  closeOnScroll?: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  role?: 'tooltip' | 'region' | 'dialog';
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  repositionKey?: unknown;
}

/**
 * Rich interactive hovercard / toggletip surface (`pointer-events-auto`) with hover grace delay,
 * optional click/Enter/Space pinning, `:focus-visible` instant open, `Escape` dismiss, and
 * outside-pointer dismiss via `getClosestFromTarget`.
 */
export function HoverCard({
  children,
  content,
  size = 'auto',
  side = 'bottom',
  align = 'center',
  offset = 8,
  viewportPadding = 8,
  openDelay = DEFAULT_OPEN_DELAY_MS,
  closeDelay = DEFAULT_CLOSE_DELAY_MS,
  toggleOnClick = true,
  openOnFocus = true,
  closeOnScroll = false,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  role = 'tooltip',
  ariaLabel,
  className = '',
  triggerClassName,
  repositionKey,
}: HoverCardProps): React.JSX.Element {
  const cardId = useId();

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [triggerEl, setTriggerEl] = useState<Element | null>(null);
  const [floatingEl, setFloatingEl] = useState<HTMLDivElement | null>(null);

  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const pinnedRef = useRef(false);
  const cachedContentRef = useRef<React.ReactNode>(null);

  const isControlled = controlledOpen !== undefined;
  const resolvedOpen = isControlled ? Boolean(controlledOpen) : uncontrolledOpen;
  const cardAvailable = !disabled && hasRenderableContent(content);
  const isOpen = resolvedOpen && cardAvailable;

  if (isOpen) {
    cachedContentRef.current = content;
  }

  const { mounted, state } = usePresence(isOpen, HOVERCARD_EXIT_MS);

  useEffect(() => {
    if (!mounted) {
      cachedContentRef.current = null;
    }
  }, [mounted]);

  useEffect(() => {
    ensureInputModalityListener();
  }, []);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const setOpenState = useCallback(
    (nextOpen: boolean, nextPinned: boolean) => {
      pinnedRef.current = nextOpen ? nextPinned : false;
      setPinned(pinnedRef.current);
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const dismissNow = useCallback(() => {
    clearTimers();
    setOpenState(false, false);
  }, [clearTimers, setOpenState]);

  useEffect(() => {
    if (!cardAvailable && isOpen) {
      dismissNow();
    }
  }, [cardAvailable, isOpen, dismissNow]);

  const scheduleOpen = useCallback(
    (delayMs = openDelay, pinOpen = false) => {
      if (!cardAvailable || typeof window === 'undefined') {
        return;
      }
      clearTimers();
      if (delayMs <= 0) {
        setOpenState(true, pinOpen || pinnedRef.current);
        return;
      }
      openTimerRef.current = window.setTimeout(() => {
        openTimerRef.current = null;
        setOpenState(true, pinOpen || pinnedRef.current);
      }, delayMs);
    },
    [cardAvailable, openDelay, clearTimers, setOpenState],
  );

  const scheduleClose = useCallback(() => {
    if (typeof window === 'undefined' || pinnedRef.current) {
      return;
    }
    clearTimers();
    if (closeDelay <= 0) {
      setOpenState(false, false);
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (!pinnedRef.current) {
        setOpenState(false, false);
      }
    }, closeDelay);
  }, [clearTimers, closeDelay, setOpenState]);

  const { top, left, side: physicalSide, positioned } = useFloatingPosition({
    anchor: triggerEl,
    floatingEl,
    open: isOpen,
    side,
    align,
    offset,
    viewportPadding,
    closeOnScroll,
    onExternalScroll: dismissNow,
    onAnchorLost: dismissNow,
    repositionKey,
  });

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const hitInside = getClosestFromTarget(event.target, `[data-hovercard-root="${cardId}"]`);
      if (hitInside) {
        return;
      }
      dismissNow();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const wasPinned = pinnedRef.current;
        dismissNow();
        if (wasPinned) {
          event.stopPropagation();
        }
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, cardId, dismissNow]);

  const isValidChild = isValidElement<Record<string, unknown>>(children);
  const childProps = isValidChild ? children.props : {};
  const isDisabledNativeChild =
    isValidChild && typeof children.type === 'string' && isDisabledTriggerProps(childProps);

  const handleTriggerMouseEnter = useCallback(() => {
    clearTimers();
    if (!isOpen) {
      scheduleOpen(openDelay, false);
    }
  }, [clearTimers, isOpen, scheduleOpen, openDelay]);

  const handleTriggerMouseLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleCardMouseEnter = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const handleCardMouseLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleFocus = useCallback(
    (event: React.FocusEvent<Element>) => {
      const focusTarget = event.target instanceof Element ? event.target : event.currentTarget;
      if (!openOnFocus || !isElementFocusVisible(focusTarget)) {
        return;
      }
      if (!isOpen) {
        scheduleOpen(0, false);
      }
    },
    [openOnFocus, isOpen, scheduleOpen],
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<Element>) => {
      const nextTarget = event.relatedTarget as EventTarget | null;
      if (nextTarget && getClosestFromTarget(nextTarget, `[data-hovercard-root="${cardId}"]`)) {
        return;
      }
      if (!nextTarget && pinnedRef.current) {
        return;
      }
      clearTimers();
      setOpenState(false, false);
    },
    [cardId, clearTimers, setOpenState],
  );

  const togglePinned = useCallback(() => {
    if (!cardAvailable || !toggleOnClick || isDisabledNativeChild) {
      return;
    }
    clearTimers();
    if (isOpen && pinnedRef.current) {
      setOpenState(false, false);
    } else {
      setOpenState(true, true);
    }
  }, [cardAvailable, toggleOnClick, isDisabledNativeChild, clearTimers, isOpen, setOpenState]);

  const handleTriggerClick = useCallback(() => {
    togglePinned();
  }, [togglePinned]);

  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<Element>) => {
      const targetTag = event.target instanceof Element ? event.target.tagName.toLowerCase() : '';
      if (!toggleOnClick || NATIVE_ACTIVATION_TAGS.has(targetTag) || isDisabledNativeChild) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePinned();
      }
    },
    [toggleOnClick, isDisabledNativeChild, togglePinned],
  );

  const attachDescribedBy = role === 'tooltip' && cardAvailable && mounted;

  const disclosureProps: Record<string, unknown> =
    toggleOnClick && !isDisabledNativeChild
      ? {
          'aria-expanded': isOpen,
          ...(mounted ? { 'aria-controls': cardId } : {}),
        }
      : {};

  const renderedTrigger = renderAnchoredTrigger({
    children,
    triggerRef: setTriggerEl,
    triggerClassName,
    ariaDescribedBy: attachDescribedBy ? cardId : undefined,
    triggerAttributes: {
      'data-hovercard-root': cardId,
      ...disclosureProps,
    },
    handlers: {
      onMouseEnter: handleTriggerMouseEnter,
      onMouseLeave: handleTriggerMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onClick: handleTriggerClick,
      onKeyDown: handleTriggerKeyDown,
    },
  });

  const displayContent = isOpen ? content : cachedContentRef.current;

  return (
    <>
      {renderedTrigger}
      {mounted && typeof document !== 'undefined' && hasRenderableContent(displayContent)
        ? createPortal(
            <div
              ref={setFloatingEl}
              id={cardId}
              role={role}
              aria-label={role !== 'tooltip' ? ariaLabel : undefined}
              aria-modal={role === 'dialog' ? false : undefined}
              data-hovercard-root={cardId}
              data-state={state}
              data-side={physicalSide}
              data-pinned={pinned ? 'true' : 'false'}
              onMouseEnter={handleCardMouseEnter}
              onMouseLeave={handleCardMouseLeave}
              onBlur={handleBlur}
              onClick={(event) => event.stopPropagation()}
              className={`ui-hovercard dashboard-tooltip pointer-events-auto rounded-xl p-3 text-[11px] leading-[1.6] ${HOVERCARD_SIZE_CLASSES[size]} ${className}`}
              style={{
                top,
                left,
                visibility: isOpen && !positioned ? 'hidden' : 'visible',
              }}
            >
              {displayContent}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
