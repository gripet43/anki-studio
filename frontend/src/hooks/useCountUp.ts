import { useEffect, useRef, useState } from 'react';

function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Smoothly interpolates an integer metric toward `value` over `durationMs`
 * using `requestAnimationFrame` + cubic ease-out (`1 - (1 - t)^3`).
 * Immediately returns `value` when `prefers-reduced-motion: reduce` is active.
 */
export function useCountUp(value: number, durationMs = 400): number {
  const target = Number.isFinite(value) ? Math.round(value) : 0;
  const [displayValue, setDisplayValue] = useState<number>(() =>
    isReducedMotionPreferred() ? target : 0
  );
  const currentRef = useRef<number>(isReducedMotionPreferred() ? target : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (isReducedMotionPreferred() || durationMs <= 0) {
      currentRef.current = target;
      setDisplayValue(target);
      return;
    }

    const startVal = currentRef.current;
    const delta = target - startVal;
    if (delta === 0) {
      setDisplayValue(target);
      return;
    }

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / durationMs));
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startVal + delta * eased);
      currentRef.current = nextVal;
      setDisplayValue(nextVal);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
        setDisplayValue(target);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, durationMs]);

  return isReducedMotionPreferred() ? target : displayValue;
}
