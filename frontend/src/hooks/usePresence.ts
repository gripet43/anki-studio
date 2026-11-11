import { useEffect, useRef, useState } from 'react';

export type PresenceState = 'entering' | 'entered' | 'leaving';

/**
 * Coordinates mount/unmount lifecycle with CSS entry & exit transitions.
 * - `open = true`: mounts immediately in `'entering'` state, then switches to `'entered'` on the next rAF.
 * - `open = false`: switches to `'leaving'` state, then unmounts (`mounted = false`) after `exitMs`.
 * - Re-opening while `'leaving'` cancels the pending unmount timer and re-enters smoothly.
 * - Optional `resetKey` re-triggers `'entering' -> 'entered'` when content changes while already open (e.g. Toast text replacement).
 */
export function usePresence(
  open: boolean,
  exitMs = 120,
  resetKey?: unknown
): { mounted: boolean; state: PresenceState } {
  const [mounted, setMounted] = useState<boolean>(open);
  const [state, setState] = useState<PresenceState>(open ? 'entering' : 'leaving');
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf1Ref = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);

  useEffect(() => {
    if (exitTimerRef.current !== null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (raf1Ref.current !== null) {
      cancelAnimationFrame(raf1Ref.current);
      raf1Ref.current = null;
    }
    if (raf2Ref.current !== null) {
      cancelAnimationFrame(raf2Ref.current);
      raf2Ref.current = null;
    }

    if (open) {
      setMounted(true);
      setState('entering');
      raf1Ref.current = requestAnimationFrame(() => {
        raf2Ref.current = requestAnimationFrame(() => {
          setState('entered');
        });
      });
    } else if (mounted) {
      setState('leaving');
      exitTimerRef.current = setTimeout(() => {
        setMounted(false);
        exitTimerRef.current = null;
      }, exitMs);
    }

    return () => {
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (raf1Ref.current !== null) {
        cancelAnimationFrame(raf1Ref.current);
        raf1Ref.current = null;
      }
      if (raf2Ref.current !== null) {
        cancelAnimationFrame(raf2Ref.current);
        raf2Ref.current = null;
      }
    };
  }, [open, exitMs, resetKey]);

  return {
    mounted: open || mounted,
    state: open && !mounted ? 'entering' : state,
  };
}
