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
  type FloatingAnchor,
  type FloatingSide,
  hasRenderableContent,
  isElementFocusVisible,
  isElementOrChildTruncated,
  renderAnchoredTrigger,
  useFloatingPosition,
} from '../../hooks/useFloatingPosition';
import { usePresence } from '../../hooks/usePresence';
import { formatShortcut } from '../../i18n/translations';
import { useAppStore } from '../../stores/useAppStore';

export type TooltipVariant = 'compact' | 'chart';
export type TooltipAriaLabelMode = 'auto' | 'describe' | 'decorative';

export const TOOLTIP_VARIANT_CLASSES: Record<TooltipVariant, string> = {
  compact: 'rounded-[10px] px-2.5 py-1.5 text-[11px] font-medium leading-[1.35] max-w-[260px]',
  chart: 'rounded-xl px-3 py-2 text-[11px] leading-[1.45] tabular-nums',
};

const COMPACT_OPEN_DELAY_MS = 350;
const COMPACT_WARM_OPEN_DELAY_MS = 80;
const COMPACT_WARM_WINDOW_MS = 300;
const COMPACT_CLOSE_DELAY_MS = 80;
const CHART_OPEN_DELAY_MS = 0;
const CHART_CLOSE_DELAY_MS = 60;
const TOOLTIP_EXIT_MS = 80;

let lastCompactCloseAt = 0;
let activeCompactDismiss: (() => void) | null = null;

function isWarmCompactWindow(): boolean {
  return lastCompactCloseAt > 0 && Date.now() - lastCompactCloseAt <= COMPACT_WARM_WINDOW_MS;
}

function getTextLabel(content: React.ReactNode): string | null {
  if (typeof content === 'string' || typeof content === 'number') {
    const trimmed = String(content).trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export interface ChartTooltipRow {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
}

export interface ChartTooltipContentProps {
  eyebrow?: React.ReactNode;
  heading?: React.ReactNode;
  rows?: ChartTooltipRow[];
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const ROW_TONE_CLASSES: Record<NonNullable<ChartTooltipRow['tone']>, string> = {
  default: 'text-[var(--text-primary)]',
  brand: 'text-[var(--brand-text)]',
  success: 'text-[var(--status-success-text)]',
  warning: 'text-[var(--status-warning-text)]',
  danger: 'text-[var(--status-danger-text)]',
  info: 'text-[var(--status-info-text)]',
  muted: 'text-[var(--text-secondary)]',
};

/**
 * Shared layout primitive for Heatmap, Weekly Rhythm, Forecast, Maturity, Retention, and Hourly chart tooltips.
 */
export function ChartTooltipContent({
  eyebrow,
  heading,
  rows,
  footer,
  children,
  className = '',
}: ChartTooltipContentProps): React.JSX.Element {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {eyebrow != null && eyebrow !== false && (
        <div className="text-[10px] font-medium leading-[1.3] text-[var(--text-secondary)]">
          {eyebrow}
        </div>
      )}
      {heading != null && heading !== false && (
        <div className="text-[11px] font-semibold leading-[1.35] text-[var(--text-primary)]">
          {heading}
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="flex flex-col gap-0.5 tabular-nums">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="text-[var(--text-secondary)]">{row.label}</span>
              <span className={`font-semibold ${ROW_TONE_CLASSES[row.tone ?? 'default']}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
      {children}
      {footer != null && footer !== false && (
        <div className="border-t border-[var(--border-subtle)] pt-1 text-[10px] leading-[1.35] text-[var(--text-secondary)]">
          {footer}
        </div>
      )}
    </div>
  );
}

export interface ChartTooltipPortalProps {
  open: boolean;
  anchorEl: FloatingAnchor | null | undefined;
  content: React.ReactNode;
  side?: FloatingSide;
  align?: FloatingAlign;
  offset?: number;
  viewportPadding?: number;
  className?: string;
  id?: string;
  repositionKey?: unknown;
  closeOnScroll?: boolean;
  onClose?: () => void;
}

/**
 * Single shared chart tooltip surface for high-density visualizations (such as the 182-cell Heatmap)
 * so only one portal mounts for the active hovered cell.
 */
export function ChartTooltipPortal({
  open,
  anchorEl,
  content,
  side = 'top',
  align = 'center',
  offset = 8,
  viewportPadding = 8,
  className = '',
  id,
  repositionKey,
  closeOnScroll = true,
  onClose,
}: ChartTooltipPortalProps): React.JSX.Element | null {
  const [floatingEl, setFloatingEl] = useState<HTMLDivElement | null>(null);
  const cachedAnchorRef = useRef<FloatingAnchor | null>(null);
  const cachedContentRef = useRef<React.ReactNode>(null);

  const canRender = open && Boolean(anchorEl) && hasRenderableContent(content);
  if (canRender) {
    cachedAnchorRef.current = anchorEl ?? null;
    cachedContentRef.current = content;
  }

  const { mounted, state } = usePresence(canRender, TOOLTIP_EXIT_MS);

  useEffect(() => {
    if (!mounted) {
      cachedAnchorRef.current = null;
      cachedContentRef.current = null;
    }
  }, [mounted]);

  const effectiveAnchor = canRender ? anchorEl : cachedAnchorRef.current;
  const effectiveContent = canRender ? content : cachedContentRef.current;

  const { top, left, side: physicalSide, positioned } = useFloatingPosition({
    anchor: effectiveAnchor,
    floatingEl,
    open: canRender,
    side,
    align,
    offset,
    viewportPadding,
    closeOnScroll,
    onExternalScroll: onClose,
    onAnchorLost: onClose,
    repositionKey,
  });

  useEffect(() => {
    if (!canRender || !onClose || typeof document === 'undefined') {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [canRender, onClose]);

  if (!mounted || typeof document === 'undefined' || !hasRenderableContent(effectiveContent)) {
    return null;
  }

  return createPortal(
    <div
      ref={setFloatingEl}
      id={id}
      role={id ? 'tooltip' : undefined}
      aria-hidden={id ? undefined : 'true'}
      data-state={state}
      data-side={physicalSide}
      className={`ui-tooltip dashboard-tooltip pointer-events-none select-none ${TOOLTIP_VARIANT_CLASSES.chart} ${className}`}
      style={{
        top,
        left,
        visibility: canRender && !positioned ? 'hidden' : 'visible',
      }}
    >
      {effectiveContent}
    </div>,
    document.body,
  );
}

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  variant?: TooltipVariant;
  shortcut?: string;
  side?: FloatingSide;
  align?: FloatingAlign;
  offset?: number;
  viewportPadding?: number;
  openDelay?: number;
  closeDelay?: number;
  closeOnClick?: boolean;
  closeOnScroll?: boolean;
  onlyWhenTruncated?: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchorEl?: FloatingAnchor | null;
  ariaLabelMode?: TooltipAriaLabelMode;
  className?: string;
  triggerClassName?: string;
  repositionKey?: unknown;
}

/**
 * Unified Tooltip primitive supporting `compact` (labels, shortcuts, truncated deck/nav items)
 * and `chart` (data visualization popups) variants, portaled to `document.body`.
 */
export function Tooltip({
  children,
  content,
  variant = 'compact',
  shortcut,
  side = 'top',
  align = 'center',
  offset = 8,
  viewportPadding = 8,
  openDelay,
  closeDelay,
  closeOnClick,
  closeOnScroll = true,
  onlyWhenTruncated = false,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  anchorEl,
  ariaLabelMode = 'auto',
  className = '',
  triggerClassName,
  repositionKey,
}: TooltipProps): React.JSX.Element {
  const tooltipId = useId();
  const { showShortcutHints, envInfo } = useAppStore();

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [triggerEl, setTriggerEl] = useState<Element | null>(null);
  const [floatingEl, setFloatingEl] = useState<HTMLDivElement | null>(null);

  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const cachedContentRef = useRef<React.ReactNode>(null);

  const isControlled = controlledOpen !== undefined;
  const resolvedOpen = isControlled ? Boolean(controlledOpen) : uncontrolledOpen;
  const tooltipAvailable = !disabled && hasRenderableContent(content);
  const isOpen = resolvedOpen && tooltipAvailable;

  const formattedShortcut =
    variant === 'compact' && shortcut && showShortcutHints
      ? formatShortcut(shortcut, envInfo.platform)
      : '';
  const hasVisibleShortcut = formattedShortcut.length > 0;

  if (isOpen) {
    cachedContentRef.current = content;
  }

  const exitDuration = variant === 'chart' ? 60 : TOOLTIP_EXIT_MS;
  const { mounted, state } = usePresence(isOpen, exitDuration);

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

  const setOpenState = useCallback(
    (next: boolean, recordWarmClose = false) => {
      if (variant === 'compact' && !next && recordWarmClose) {
        lastCompactCloseAt = Date.now();
      }
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange, variant],
  );

  const dismissNow = useCallback(
    (recordWarmClose = false) => {
      clearTimers();
      setOpenState(false, recordWarmClose);
    },
    [clearTimers, setOpenState],
  );

  const dismissImmediatelyRef = useRef<() => void>(() => {});
  dismissImmediatelyRef.current = () => {
    dismissNow(false);
  };

  useEffect(() => {
    if (variant !== 'compact') {
      return;
    }
    const selfDismiss = () => dismissImmediatelyRef.current();
    if (isOpen) {
      if (activeCompactDismiss && activeCompactDismiss !== selfDismiss) {
        activeCompactDismiss();
      }
      activeCompactDismiss = selfDismiss;
    }
    return () => {
      if (activeCompactDismiss === selfDismiss) {
        activeCompactDismiss = null;
      }
    };
  }, [isOpen, variant]);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!tooltipAvailable && isOpen) {
      dismissNow(false);
    }
  }, [tooltipAvailable, isOpen, dismissNow]);

  const scheduleOpen = useCallback(
    (delayMs?: number) => {
      if (!tooltipAvailable || typeof window === 'undefined') {
        return;
      }
      if (onlyWhenTruncated && !isElementOrChildTruncated(triggerEl)) {
        return;
      }
      clearTimers();
      const targetDelay =
        delayMs ??
        openDelay ??
        (variant === 'chart'
          ? CHART_OPEN_DELAY_MS
          : isWarmCompactWindow()
            ? COMPACT_WARM_OPEN_DELAY_MS
            : COMPACT_OPEN_DELAY_MS);

      if (targetDelay <= 0) {
        setOpenState(true);
        return;
      }
      openTimerRef.current = window.setTimeout(() => {
        openTimerRef.current = null;
        if (onlyWhenTruncated && !isElementOrChildTruncated(triggerEl)) {
          return;
        }
        setOpenState(true);
      }, targetDelay);
    },
    [tooltipAvailable, onlyWhenTruncated, triggerEl, clearTimers, openDelay, variant, setOpenState],
  );

  const scheduleClose = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    clearTimers();
    const targetDelay =
      closeDelay ?? (variant === 'chart' ? CHART_CLOSE_DELAY_MS : COMPACT_CLOSE_DELAY_MS);
    if (targetDelay <= 0) {
      setOpenState(false, variant === 'compact');
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpenState(false, variant === 'compact');
    }, targetDelay);
  }, [clearTimers, closeDelay, variant, setOpenState]);

  const effectiveAnchor = anchorEl ?? triggerEl;
  const handleExternalDismiss = useCallback(() => {
    dismissNow(false);
  }, [dismissNow]);

  const { top, left, side: physicalSide, positioned } = useFloatingPosition({
    anchor: effectiveAnchor,
    floatingEl,
    open: isOpen,
    side,
    align,
    offset,
    viewportPadding,
    closeOnScroll,
    onExternalScroll: handleExternalDismiss,
    onAnchorLost: handleExternalDismiss,
    repositionKey,
  });

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissNow(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, dismissNow]);

  const shouldCloseOnClick = closeOnClick ?? variant === 'compact';

  const handleMouseEnter = useCallback(() => {
    scheduleOpen();
  }, [scheduleOpen]);

  const handleMouseLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleFocus = useCallback(
    (event: React.FocusEvent<Element>) => {
      const focusTarget = event.target instanceof Element ? event.target : event.currentTarget;
      if (!isElementFocusVisible(focusTarget)) {
        return;
      }
      const focusDelay =
        openDelay !== undefined ? openDelay : variant === 'chart' ? 0 : COMPACT_WARM_OPEN_DELAY_MS;
      scheduleOpen(focusDelay);
    },
    [openDelay, variant, scheduleOpen],
  );

  const handleBlur = useCallback(() => {
    dismissNow(false);
  }, [dismissNow]);

  const handleClickOrPointerDown = useCallback(() => {
    if (shouldCloseOnClick) {
      dismissNow(false);
    }
  }, [shouldCloseOnClick, dismissNow]);

  const isValidChild = isValidElement<Record<string, unknown>>(children);
  const childProps = isValidChild ? children.props : {};
  const childAriaLabel =
    typeof childProps['aria-label'] === 'string'
      ? childProps['aria-label'].trim().toLowerCase()
      : null;
  const plainContent = getTextLabel(content);

  const isDuplicateAriaLabel =
    ariaLabelMode === 'decorative' ||
    (ariaLabelMode === 'auto' &&
      !hasVisibleShortcut &&
      childAriaLabel !== null &&
      plainContent !== null &&
      childAriaLabel === plainContent);

  const attachAriaDescribedBy = !isDuplicateAriaLabel && tooltipAvailable && mounted;

  const renderedTrigger = renderAnchoredTrigger({
    children,
    triggerRef: setTriggerEl,
    triggerClassName,
    ariaDescribedBy: attachAriaDescribedBy ? tooltipId : undefined,
    handlers: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onPointerDown: handleClickOrPointerDown,
      onClick: handleClickOrPointerDown,
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
              id={isDuplicateAriaLabel ? undefined : tooltipId}
              role={isDuplicateAriaLabel ? undefined : 'tooltip'}
              aria-hidden={isDuplicateAriaLabel ? 'true' : undefined}
              data-state={state}
              data-side={physicalSide}
              data-variant={variant}
              className={`ui-tooltip dashboard-tooltip pointer-events-none select-none ${TOOLTIP_VARIANT_CLASSES[variant]} ${className}`}
              style={{
                top,
                left,
                visibility: isOpen && !positioned ? 'hidden' : 'visible',
              }}
            >
              {hasVisibleShortcut ? (
                <span className="inline-flex items-center gap-1.5">
                  <span>{displayContent}</span>
                  <kbd className="ui-tooltip-kbd">{formattedShortcut}</kbd>
                </span>
              ) : (
                displayContent
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
