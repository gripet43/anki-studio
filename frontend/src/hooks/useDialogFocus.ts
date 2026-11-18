import { useEffect, useRef } from 'react';
import { getClosestFromTarget } from '../utils/domTarget';

interface UseDialogFocusOptions {
  open: boolean;
  confirmPending: boolean;
  onDismissConfirm: () => void;
  onClose: () => void;
}

/**
 * 统一的模态窗无障碍焦点管理：
 * - 打开时记住触发元素并将焦点迁入弹窗面板，关闭后还原焦点；
 * - Tab / Shift+Tab 在可见可交互控件内闭环循环，并跳过已折叠的 `<details>` 内容；
 * - Esc 优先收起内部二次确认区，否则关闭弹窗。
 */
export function useDialogFocus({
  open,
  confirmPending,
  onDismissConfirm,
  onClose,
}: UseDialogFocusOptions) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rafId = window.requestAnimationFrame(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
        panelRef.current.focus();
      }
    });
    return () => {
      window.cancelAnimationFrame(rafId);
      const opener = previousFocusRef.current;
      previousFocusRef.current = null;
      if (opener && opener.isConnected) {
        opener.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmPending) {
          onDismissConfirm();
        } else {
          onClose();
        }
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])'
          )
        ).filter(
          (el) =>
            (el.offsetParent !== null || el === document.activeElement) &&
            (!getClosestFromTarget(el, 'details:not([open])') || el.tagName === 'SUMMARY')
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !panelRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            last.focus();
          }
        } else if (
          document.activeElement === last ||
          !panelRef.current.contains(document.activeElement)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, confirmPending, onDismissConfirm, onClose]);

  return panelRef;
}
