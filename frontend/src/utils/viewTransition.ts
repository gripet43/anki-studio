import { flushSync } from 'react-dom';

type ViewTransitionLike = {
  finished?: Promise<unknown>;
};

let activeThemeViewTransition = false;

export function isThemeViewTransitionActive(): boolean {
  return activeThemeViewTransition;
}

/**
 * Progressive theme / accent cross-fade via `document.startViewTransition`.
 * Safely falls back to a synchronous state update in SSR, reduced-motion,
 * hidden documents, or runtimes without `startViewTransition`.
 */
export function runThemeViewTransition(apply: () => void): boolean {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    document.visibilityState === 'hidden'
  ) {
    apply();
    return false;
  }

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const docWithVT = document as Document & {
    startViewTransition?: (cb: () => void) => ViewTransitionLike;
  };
  if (reduced || typeof docWithVT.startViewTransition !== 'function') {
    apply();
    return false;
  }

  try {
    activeThemeViewTransition = true;
    const transition = docWithVT.startViewTransition(() => {
      flushSync(apply);
    });
    const finish = transition?.finished;
    if (finish && typeof finish.finally === 'function') {
      void finish
        .catch(() => {})
        .finally(() => {
          activeThemeViewTransition = false;
        });
    } else {
      activeThemeViewTransition = false;
    }
    return true;
  } catch {
    activeThemeViewTransition = false;
    apply();
    return false;
  }
}

/**
 * Serene workspace <-> Zen sanctuary cross-dissolve via `document.startViewTransition`.
 * Safely falls back to a synchronous state update in SSR, reduced-motion,
 * hidden documents, or runtimes without `startViewTransition`.
 */
export function runZenViewTransition(
  direction: 'enter' | 'exit',
  apply: () => void
): boolean {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    document.visibilityState === 'hidden'
  ) {
    apply();
    return false;
  }

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const docWithVT = document as Document & {
    startViewTransition?: (cb: () => void) => ViewTransitionLike;
  };
  const root = document.documentElement;
  if (reduced || typeof docWithVT.startViewTransition !== 'function') {
    if (!reduced && direction === 'enter') {
      root.classList.add('zen-vt-fallback');
      window.setTimeout(() => {
        root.classList.remove('zen-vt-fallback');
      }, 460);
    }
    apply();
    return false;
  }

  const cls = direction === 'enter' ? 'zen-vt-entering' : 'zen-vt-exiting';
  root.classList.remove('zen-vt-entering', 'zen-vt-exiting', 'zen-vt-fallback');
  root.classList.add(cls);

  const cleanup = () => {
    root.classList.remove(cls);
  };

  try {
    const transition = docWithVT.startViewTransition(() => {
      flushSync(apply);
    });
    const finish = transition?.finished;
    if (finish && typeof finish.finally === 'function') {
      void finish.catch(() => {}).finally(cleanup);
    } else {
      cleanup();
    }
    return true;
  } catch {
    cleanup();
    apply();
    return false;
  }
}
