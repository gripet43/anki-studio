import React from 'react';
import { appActions, getAppState } from '../stores/useAppStore';
import { getClosestFromTarget } from './domTarget';

/**
 * Handles window dragging from custom web titlebars / drag regions across desktop platforms.
 * Prefers Qt 6 native `QWindow.startSystemMove()` (required on Wayland, smooth on macOS/Win/X11)
 * and falls back to RAF-batched `mw.move(dx, dy)` only when native system move is unavailable
 * on non-Linux platforms (Linux Wayland forbids `mw.move` and X11 jitters if both run).
 */
export function startWindowDrag(e: React.MouseEvent) {
  // Only respond to primary left-click
  if (e.button !== 0) return;

  // Do not initiate drag if user interacted with a button, link, input, or explicit no-drag area
  if (getClosestFromTarget(e.target, 'button, input, textarea, select, a, [data-no-drag]')) {
    return;
  }

  // Prevent default browser text selection or image drag behavior
  e.preventDefault();

  const isLinux = getAppState().envInfo.platform === 'linux';
  const initialScreenX = e.screenX;
  const initialScreenY = e.screenY;

  let released = false;
  const onEarlyMouseUp = () => {
    released = true;
  };
  window.addEventListener('mouseup', onEarlyMouseUp, { once: true });

  // 1. Prefer native OS window move (xdg_toplevel.move on Wayland, _NET_WM_MOVERESIZE on X11, Cocoa/Win32)
  void appActions.startSystemMove().then((started) => {
    window.removeEventListener('mouseup', onEarlyMouseUp);
    if (started || released || isLinux) {
      return;
    }

    // 2. Fallback RAF delta tracking when native system move is unsupported (e.g. older macOS/Windows Qt)
    let lastScreenX = initialScreenX;
    let lastScreenY = initialScreenY;
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

    const cleanup = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      flushMove();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
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

    const onMouseUp = () => {
      cleanup();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

/**
 * Double-click on window titlebar / drag area to maximize or restore (standard macOS behavior)
 */
export function handleWindowDoubleClick(e: React.MouseEvent) {
  if (getClosestFromTarget(e.target, 'button, input, textarea, select, a, [data-no-drag]')) {
    return;
  }
  appActions.toggleMaximize();
}
