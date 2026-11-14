import React, { useEffect, useRef, useState } from 'react';
import { showToast } from '../../stores/useAppStore';
import { Tooltip } from './Tooltip';

export interface CopyDebugInfoButtonProps {
  /** Async callback that collects and copies the formatted debug bundle. */
  onCopyDebugInfo: () => Promise<{ copied: boolean }>;
  tooltipText?: string;
  ariaLabel: string;
  copiedToast: string;
  failedToast: string;
  /** Optional visible button label (used inside the Inspector drawer row). */
  label?: string;
  copiedLabel?: string;
  idleClassName: string;
  className?: string;
}

/**
 * Shared action button that copies complete card diagnostics with inline
 * 2-second checkmark confirmation + toast feedback.
 */
export const CopyDebugInfoButton: React.FC<CopyDebugInfoButtonProps> = ({
  onCopyDebugInfo,
  tooltipText,
  ariaLabel,
  copiedToast,
  failedToast,
  label,
  copiedLabel,
  idleClassName,
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const { copied: ok } = await onCopyDebugInfo();
      if (!ok) {
        showToast(failedToast);
        return;
      }
      setCopied(true);
      showToast(copiedToast);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2000);
    } finally {
      setCopying(false);
    }
  };

  const baseCls =
    className ||
    'w-full h-8 rounded-xl border text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2';

  return (
    <Tooltip variant="compact" content={tooltipText} disabled={!tooltipText}>
      <button
        type="button"
        disabled={copying}
        onClick={handleClick}
        aria-label={ariaLabel}
        className={`${baseCls} ${
          copied
            ? 'bg-[var(--status-success-soft)] border-[var(--status-success)] text-[var(--status-success)]'
            : idleClassName
        }`}
      >
        {copied ? (
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m8 2 1.88 1.88" />
            <path d="M14.12 3.88 16 2" />
            <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
            <path d="M12 20v-9" />
            <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
            <path d="M6 13H2" />
            <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
            <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
            <path d="M22 13h-4" />
            <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
          </svg>
        )}
        {label && <span>{copied ? copiedLabel || label : label}</span>}
      </button>
    </Tooltip>
  );
};
