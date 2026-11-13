import React from 'react';
import { appActions } from '../stores/useAppStore';

/**
 * Handles window dragging from custom web titlebars / drag regions across macOS / desktop.
 * Uses high-performance requestAnimationFrame delta aggregation and calls native Qt mw.move.
 */
export function startWindowDrag(e: React.MouseEvent) {
  // Only respond to primary left-click
  if (e.button !== 0) return;

  // Do not initiate drag if user interacted with a button, link, input, or explicit no-drag area
  const target = e.target as HTMLElement | null;
  // 某些 Windows / WebView 场景下 event.target 可能是 document（没有 closest）
  if (
    target &&
    typeof target.closest === 'function' &&
    target.closest('button, input, textarea, select, a, [data-no-drag]')
  ) {
    return;
  }

  // Prevent default browser text selection or image drag behavior
  e.preventDefault();

  // 1. Attempt native system move if platform supports it
  appActions.startSystemMove();

  // 2. Smooth, real-time RAF tracking for silky 60fps / 120fps window positioning
  let lastScreenX = e.screenX;
  let lastScreenY = e.screenY;
  let pendingDx = 0;
  let pendingDy = 0;
  let rafId: number | null = null;

  const flushMove = () => {
    if (pendingDx !== 0 || pendingDy !== 0) {
      appActions.moveWindow(pendingDx, pendingDy);
      pendingDx = 0;
      pendingDy = 0;
    }
  };

  const onMouseMove = (moveEvent: MouseEvent) => {
    // If the left mouse button was released outside the window
    if (moveEvent.buttons !== 1) {
      cleanup();
      return;
    }

    const dx = moveEvent.screenX - lastScreenX;
    const dy = moveEvent.screenY - lastScreenY;
    lastScreenX = moveEvent.screenX;
    lastScreenY = moveEvent.screenY;

    pendingDx += dx;
    pendingDy += dy;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        flushMove();
        rafId = null;
      });
    }
  };

  const cleanup = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    flushMove();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  const onMouseUp = () => {
    cleanup();
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

/**
 * Double-click on window titlebar / drag area to maximize or restore (standard macOS behavior)
 */
export function handleWindowDoubleClick(e: React.MouseEvent) {
  const target = e.target as HTMLElement | null;
  // 某些 Windows / WebView 场景下 event.target 可能是 document（没有 closest）
  if (
    target &&
    typeof target.closest === 'function' &&
    target.closest('button, input, textarea, select, a, [data-no-drag]')
  ) {
    return;
  }
  appActions.toggleMaximize();
}
