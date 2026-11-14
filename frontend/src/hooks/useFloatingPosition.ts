import {
  cloneElement,
  createElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import type * as React from 'react';

export type FloatingSide = 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end';
export type FloatingAlign = 'start' | 'center' | 'end';
export type PhysicalSide = 'top' | 'bottom' | 'left' | 'right';

export interface RectLike {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface VirtualAnchor {
  getBoundingClientRect: () => RectLike;
}

export type FloatingAnchor = Element | VirtualAnchor;

export interface UseFloatingPositionOptions {
  anchor: FloatingAnchor | null | undefined;
  floatingEl: HTMLElement | null | undefined;
  open: boolean;
  side?: FloatingSide;
  align?: FloatingAlign;
  offset?: number;
  viewportPadding?: number;
  closeOnScroll?: boolean;
  onExternalScroll?: () => void;
  onAnchorLost?: () => void;
  repositionKey?: unknown;
}

export interface FloatingPositionResult {
  top: number;
  left: number;
  side: PhysicalSide;
  positioned: boolean;
  updatePosition: () => void;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const DEFAULT_SIDE: FloatingSide = 'top';
const DEFAULT_ALIGN: FloatingAlign = 'center';
const DEFAULT_OFFSET = 8;
const DEFAULT_VIEWPORT_PADDING = 8;

const MODIFIER_ONLY_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);
let lastInputModality: 'keyboard' | 'pointer' = 'keyboard';
let modalityListenersBound = false;

function handleModalityKeyDown(event: KeyboardEvent): void {
  if (!MODIFIER_ONLY_KEYS.has(event.key) || event.key === 'Tab') {
    lastInputModality = 'keyboard';
  }
}

function handleModalityPointer(): void {
  lastInputModality = 'pointer';
}

/**
 * Bind document-level capture listeners once to track keyboard vs pointer modality
 * so mouse clicks never leave sticky focus tooltips on controls.
 */
export function ensureInputModalityListener(): void {
  if (modalityListenersBound || typeof document === 'undefined') {
    return;
  }
  modalityListenersBound = true;
  document.addEventListener('keydown', handleModalityKeyDown, true);
  document.addEventListener('pointerdown', handleModalityPointer, true);
  document.addEventListener('mousedown', handleModalityPointer, true);
  document.addEventListener('touchstart', handleModalityPointer, true);
}

/**
 * Check whether an element received focus via keyboard navigation (`:focus-visible`
 * combined with recent keyboard modality so mouse-clicked text inputs do not trigger tooltips).
 */
export function isElementFocusVisible(el: Element | null | undefined): boolean {
  if (!el) {
    return false;
  }
  ensureInputModalityListener();
  if (lastInputModality !== 'keyboard') {
    return false;
  }
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * Compose multiple React refs cleanly without mutating ref objects directly.
 */
export function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined | null>): React.RefCallback<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) {
        continue;
      }
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

/**
 * Chain an existing element event handler with an internal handler while respecting `defaultPrevented`.
 */
export function composeEventHandlers<E>(
  theirHandler: ((event: E) => void) | undefined,
  ourHandler: (event: E) => void,
): (event: E) => void {
  return (event: E) => {
    theirHandler?.(event);
    if (
      event &&
      typeof event === 'object' &&
      'defaultPrevented' in event &&
      (event as { defaultPrevented?: boolean }).defaultPrevented
    ) {
      return;
    }
    ourHandler(event);
  };
}

function isTruncatedNode(node: Element): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  if (node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1) {
    return false;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  const style = window.getComputedStyle(node);
  const clippedX =
    style.overflowX === 'hidden' || style.overflowX === 'clip' || style.textOverflow === 'ellipsis';
  const clippedY = style.overflowY === 'hidden' || style.overflowY === 'clip';
  return (
    (clippedX && node.scrollWidth > node.clientWidth + 1) ||
    (clippedY && node.scrollHeight > node.clientHeight + 1)
  );
}

/**
 * Detect whether a trigger element or any truncated text child overflows its box.
 */
export function isElementOrChildTruncated(el: Element | null | undefined): boolean {
  if (!el || typeof window === 'undefined') {
    return false;
  }
  if (isTruncatedNode(el)) {
    return true;
  }
  const candidates = el.querySelectorAll('.truncate, [data-truncate-target], span, p, div');
  for (let i = 0; i < candidates.length; i += 1) {
    if (isTruncatedNode(candidates[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Determine whether a React node holds meaningful renderable content (allowing `0`).
 */
export function hasRenderableContent(content: React.ReactNode): boolean {
  return content !== null && content !== undefined && content !== false && content !== '';
}

/**
 * Derive an inline anchor wrapper class string that preserves key layout utilities
 * (`w-full`, `flex-1`, `min-w-0`) when wrapping disabled or custom components.
 */
export function deriveTriggerWrapperClassName(
  childClassName?: unknown,
  extraClassName?: string,
): string {
  const raw = typeof childClassName === 'string' ? childClassName : '';
  const layoutTokens: string[] = ['inline-flex', 'items-center'];
  if (raw.includes('w-full')) {
    layoutTokens.push('w-full');
  }
  if (raw.includes('flex-1')) {
    layoutTokens.push('flex-1');
  }
  if (raw.includes('min-w-0')) {
    layoutTokens.push('min-w-0');
  }
  if (extraClassName) {
    layoutTokens.push(extraClassName);
  }
  return layoutTokens.join(' ');
}

/**
 * Check whether an intrinsic element carries native `disabled` or `aria-disabled` state.
 */
export function isDisabledTriggerProps(childProps: Record<string, unknown>): boolean {
  return (
    Boolean(childProps.disabled) ||
    childProps['aria-disabled'] === true ||
    childProps['aria-disabled'] === 'true'
  );
}

export interface RenderAnchoredTriggerOptions {
  children: React.ReactNode;
  triggerRef: React.Ref<Element>;
  triggerClassName?: string;
  handlers: Record<string, ((event: never) => void) | undefined>;
  triggerAttributes?: Record<string, unknown>;
  ariaDescribedBy?: string;
}

/**
 * Attach floating trigger refs, event handlers, and ARIA attributes directly to intrinsic
 * enabled elements, or wrap disabled / custom components in an anchor `<span>` so hover and
 * rect measurements continue working cleanly in QtWebEngine Chrome/140.
 */
export function renderAnchoredTrigger({
  children,
  triggerRef,
  triggerClassName,
  handlers,
  triggerAttributes,
  ariaDescribedBy,
}: RenderAnchoredTriggerOptions): React.ReactNode {
  const isValidChild = isValidElement<Record<string, unknown>>(children);
  const childProps = isValidChild ? children.props : {};
  const isDisabledNative =
    isValidChild && typeof children.type === 'string' && isDisabledTriggerProps(childProps);

  const needsWrapper =
    !isValidChild ||
    typeof children.type !== 'string' ||
    isDisabledNative ||
    Boolean(triggerClassName);

  const existingDescribedBy =
    typeof childProps['aria-describedby'] === 'string' ? childProps['aria-describedby'] : undefined;
  const mergedDescribedBy = ariaDescribedBy
    ? existingDescribedBy
      ? `${existingDescribedBy} ${ariaDescribedBy}`
      : ariaDescribedBy
    : existingDescribedBy;

  if (!needsWrapper && isValidChild) {
    // React 19 exposes `ref` on `element.props.ref` without triggering element.ref warnings.
    const existingRef = childProps.ref as React.Ref<Element> | undefined;
    const clonedProps: Record<string, unknown> = {
      ref: mergeRefs(existingRef, triggerRef),
      ...(triggerAttributes ?? {}),
      ...(mergedDescribedBy ? { 'aria-describedby': mergedDescribedBy } : {}),
    };

    for (const [eventKey, handler] of Object.entries(handlers)) {
      if (handler) {
        clonedProps[eventKey] = composeEventHandlers(
          childProps[eventKey] as ((event: never) => void) | undefined,
          handler,
        );
      }
    }

    return cloneElement(children, clonedProps);
  }

  // Disabled native elements suppress pointerenter/mouseenter in Chrome/140, so isolate pointer
  // events onto an outer inline wrapper while leaving child layout utilities intact.
  const wrappedChild =
    isDisabledNative && isValidChild
      ? cloneElement(children, {
          style: {
            ...((childProps.style as React.CSSProperties | undefined) ?? {}),
            pointerEvents: 'none',
          },
        })
      : children;

  return createElement(
    'span',
    {
      ref: triggerRef,
      className: deriveTriggerWrapperClassName(childProps.className, triggerClassName),
      ...handlers,
      ...(triggerAttributes ?? {}),
      ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
    },
    wrappedChild,
  );
}

function isDomElement(anchor: FloatingAnchor): anchor is Element {
  return typeof Element !== 'undefined' && anchor instanceof Element;
}

function isAnchorRtl(anchor: FloatingAnchor): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  if (isDomElement(anchor)) {
    // Walk parentElement explicitly instead of ancestor selector lookup to comply with DOM audit rules.
    let current: Element | null = anchor;
    while (current) {
      const dir = current.getAttribute('dir');
      if (dir === 'rtl') {
        return true;
      }
      if (dir === 'ltr') {
        return false;
      }
      current = current.parentElement;
    }
  }
  const rootDir = document.documentElement?.getAttribute('dir') || document.documentElement?.dir;
  if (rootDir === 'rtl') {
    return true;
  }
  if (rootDir === 'ltr') {
    return false;
  }
  if (typeof window !== 'undefined' && document.documentElement) {
    return window.getComputedStyle(document.documentElement).direction === 'rtl';
  }
  return false;
}

function resolvePhysicalSide(side: FloatingSide, rtl: boolean): PhysicalSide {
  if (side === 'start') {
    return rtl ? 'right' : 'left';
  }
  if (side === 'end') {
    return rtl ? 'left' : 'right';
  }
  return side;
}

function resolvePhysicalAlign(align: FloatingAlign, rtl: boolean): FloatingAlign {
  if (!rtl || align === 'center') {
    return align;
  }
  return align === 'start' ? 'end' : 'start';
}

function getOppositeSide(side: PhysicalSide): PhysicalSide {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

function getAvailableSpace(
  side: PhysicalSide,
  anchorRect: RectLike,
  vw: number,
  vh: number,
  padding: number,
): number {
  switch (side) {
    case 'top':
      return anchorRect.top - padding;
    case 'bottom':
      return vh - padding - anchorRect.bottom;
    case 'left':
      return anchorRect.left - padding;
    case 'right':
      return vw - padding - anchorRect.right;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function computeCoordinates(
  anchorRect: RectLike,
  floatingWidth: number,
  floatingHeight: number,
  preferredSide: PhysicalSide,
  align: FloatingAlign,
  rtl: boolean,
  offset: number,
  padding: number,
  vw: number,
  vh: number,
): { top: number; left: number; side: PhysicalSide } {
  const neededPrimary =
    preferredSide === 'top' || preferredSide === 'bottom'
      ? floatingHeight + offset
      : floatingWidth + offset;

  const preferredSpace = getAvailableSpace(preferredSide, anchorRect, vw, vh, padding);
  const oppositeSide = getOppositeSide(preferredSide);
  const oppositeSpace = getAvailableSpace(oppositeSide, anchorRect, vw, vh, padding);

  let resolvedSide: PhysicalSide = preferredSide;
  if (preferredSpace < neededPrimary && oppositeSpace > preferredSpace) {
    if (oppositeSpace >= neededPrimary || oppositeSpace > preferredSpace) {
      resolvedSide = oppositeSide;
    }
  }

  let rawTop = 0;
  let rawLeft = 0;

  if (resolvedSide === 'top' || resolvedSide === 'bottom') {
    rawTop =
      resolvedSide === 'top'
        ? anchorRect.top - offset - floatingHeight
        : anchorRect.bottom + offset;

    const horizontalAlign = resolvePhysicalAlign(align, rtl);
    if (horizontalAlign === 'start') {
      rawLeft = anchorRect.left;
    } else if (horizontalAlign === 'end') {
      rawLeft = anchorRect.right - floatingWidth;
    } else {
      rawLeft = anchorRect.left + (anchorRect.width - floatingWidth) / 2;
    }
  } else {
    rawLeft =
      resolvedSide === 'left'
        ? anchorRect.left - offset - floatingWidth
        : anchorRect.right + offset;

    if (align === 'start') {
      rawTop = anchorRect.top;
    } else if (align === 'end') {
      rawTop = anchorRect.bottom - floatingHeight;
    } else {
      rawTop = anchorRect.top + (anchorRect.height - floatingHeight) / 2;
    }
  }

  const maxLeft = Math.max(padding, vw - padding - floatingWidth);
  const maxTop = Math.max(padding, vh - padding - floatingHeight);

  return {
    top: Math.round(clamp(rawTop, padding, maxTop)),
    left: Math.round(clamp(rawLeft, padding, maxLeft)),
    side: resolvedSide,
  };
}

/**
 * Computes fixed viewport coordinates for a portaled Tooltip or HoverCard relative to a
 * DOM or virtual anchor, supporting logical RTL sides, viewport flip, and edge clamping.
 */
export function useFloatingPosition({
  anchor,
  floatingEl,
  open,
  side = DEFAULT_SIDE,
  align = DEFAULT_ALIGN,
  offset = DEFAULT_OFFSET,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  closeOnScroll = false,
  onExternalScroll,
  onAnchorLost,
  repositionKey,
}: UseFloatingPositionOptions): FloatingPositionResult {
  const rtl = anchor ? isAnchorRtl(anchor) : false;
  const fallbackSide = resolvePhysicalSide(side, rtl);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    side: PhysicalSide;
    positioned: boolean;
  }>({
    top: 0,
    left: 0,
    side: fallbackSide,
    positioned: false,
  });

  const updatePosition = useCallback(() => {
    if (!open || typeof window === 'undefined' || !anchor || !floatingEl) {
      return;
    }

    if (isDomElement(anchor) && !anchor.isConnected) {
      onAnchorLost?.();
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const floatingRect = floatingEl.getBoundingClientRect();
    const floatingWidth = floatingEl.offsetWidth || Math.ceil(floatingRect.width);
    const floatingHeight = floatingEl.offsetHeight || Math.ceil(floatingRect.height);

    if (floatingWidth === 0 && floatingHeight === 0) {
      return;
    }

    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (vw === 0 || vh === 0) {
      return;
    }

    const anchorRtl = isAnchorRtl(anchor);
    const preferredPhysical = resolvePhysicalSide(side, anchorRtl);
    const next = computeCoordinates(
      anchorRect,
      floatingWidth,
      floatingHeight,
      preferredPhysical,
      align,
      anchorRtl,
      offset,
      viewportPadding,
      vw,
      vh,
    );

    setCoords((prev) => {
      if (
        prev.positioned &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.side === next.side
      ) {
        return prev;
      }
      return {
        top: next.top,
        left: next.left,
        side: next.side,
        positioned: true,
      };
    });
  }, [anchor, floatingEl, open, side, align, offset, viewportPadding, onAnchorLost]);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setCoords((prev) => (prev.positioned ? { ...prev, positioned: false } : prev));
      return;
    }
    updatePosition();
  }, [open, updatePosition, repositionKey]);

  useEffect(() => {
    if (!open || typeof window === 'undefined' || !anchor || !floatingEl) {
      return;
    }

    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        updatePosition();
      });
    };

    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && floatingEl.contains(event.target)) {
        return;
      }
      if (closeOnScroll) {
        onExternalScroll?.();
        return;
      }
      scheduleUpdate();
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(floatingEl);
      if (isDomElement(anchor)) {
        resizeObserver.observe(anchor);
      }
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [open, anchor, floatingEl, closeOnScroll, onExternalScroll, updatePosition]);

  return {
    top: coords.top,
    left: coords.left,
    side: coords.side,
    positioned: coords.positioned,
    updatePosition,
  };
}
