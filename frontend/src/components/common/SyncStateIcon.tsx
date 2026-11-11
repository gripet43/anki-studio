import React from 'react';

export type SyncVisualState = 'syncing' | 'justFinished' | 'snapshot' | 'unsynced';

interface SyncStateIconProps {
  state: SyncVisualState;
  size?: 'xs' | 'sm' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<SyncStateIconProps['size']>, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

/**
 * Shape-distinct icon representing actual AnkiWeb sync state without relying
 * on misleading "live green dot" semantics for historical snapshots.
 */
export const SyncStateIcon: React.FC<SyncStateIconProps> = ({ state, size = 'sm' }) => {
  const cls = SIZE_CLASSES[size];

  if (state === 'syncing') {
    const spinnerSize = size === 'xs' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
    return (
      <span
        aria-hidden="true"
        className={`${spinnerSize} inline-block rounded-full border-[1.8px] border-[var(--status-warning)]/25 border-t-[var(--status-warning)] motion-safe:animate-spin shrink-0`}
      />
    );
  }

  if (state === 'justFinished') {
    return (
      <svg
        aria-hidden="true"
        className={`${cls} text-[var(--status-success)] shrink-0`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
      </svg>
    );
  }

  if (state === 'unsynced') {
    return (
      <svg
        aria-hidden="true"
        className={`${cls} text-[var(--text-muted)] shrink-0`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 2l20 20" />
        <path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" />
        <path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
      </svg>
    );
  }

  // Neutral static cloud for past sync snapshots ("quiet success, honest snapshot")
  return (
    <svg
      aria-hidden="true"
      className={`${cls} text-[var(--text-secondary)] shrink-0 transition-colors`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
};
