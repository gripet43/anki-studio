import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  type FloatingAlign,
  type FloatingSide,
  useFloatingPosition,
} from '../../hooks/useFloatingPosition';
import { usePresence } from '../../hooks/usePresence';
import { translate } from '../../i18n/translations';
import { useAppStore } from '../../stores/useAppStore';
import { getClosestFromTarget } from '../../utils/domTarget';
import { CheckIcon, ChevronDownIcon } from './Icons';

export interface StudioSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type StudioSelectSize = 'sm' | 'md' | 'lg';

export const STUDIO_SELECT_SIZE_CLASSES: Record<StudioSelectSize, string> = {
  sm: 'h-8 px-2.5 rounded-xl text-[12px] gap-1.5',
  md: 'h-9 px-3 rounded-xl text-[12.5px] gap-2',
  lg: 'h-10 px-3 rounded-xl text-[13px] gap-2',
};

const STUDIO_SELECT_OPTION_CLASSES: Record<StudioSelectSize, string> = {
  sm: 'px-2.5 py-1.5 rounded-[10px] text-[12px]',
  md: 'px-2.5 py-2 rounded-[10px] text-[12.5px]',
  lg: 'px-3 py-2 rounded-[10px] text-[13px]',
};

const SELECT_EXIT_MS = 90;
const AUTO_SEARCH_THRESHOLD = 10;
const TYPEAHEAD_RESET_MS = 500;

export interface StudioSelectProps {
  id?: string;
  value: string;
  options: StudioSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  disabled?: boolean;
  size?: StudioSelectSize;
  side?: FloatingSide;
  align?: FloatingAlign;
  offset?: number;
  className?: string;
  menuClassName?: string;
  searchable?: boolean | 'auto';
  searchPlaceholder?: string;
  emptyText?: string;
}

function findNextEnabledIndex(
  list: StudioSelectOption[],
  startIndex: number,
  step: 1 | -1,
): number {
  const len = list.length;
  if (len === 0) return -1;
  for (let i = 0; i < len; i += 1) {
    const idx = (startIndex + step * (i + 1) + len * 2) % len;
    if (!list[idx]?.disabled) return idx;
  }
  return -1;
}

function findEdgeEnabledIndex(list: StudioSelectOption[], fromEnd: boolean): number {
  if (list.length === 0) return -1;
  if (!fromEnd) {
    return list.findIndex((opt) => !opt.disabled);
  }
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (!list[i]?.disabled) return i;
  }
  return -1;
}

/**
 * Unified Anki Studio select primitive (`role="combobox"` + portaled `role="listbox"`).
 * Renders identically across Anki QtWebEngine (Chromium < 135) and modern browsers,
 * with viewport-aware flip/clamping, full keyboard navigation, IME-safe search filtering
 * for large option sets, RTL logical alignment, and multi-cue selected states.
 */
export function StudioSelect({
  id,
  value,
  options,
  onChange,
  placeholder = '',
  ariaLabel,
  ariaLabelledBy,
  disabled = false,
  size = 'md',
  side = 'bottom',
  align = 'start',
  offset = 6,
  className = '',
  menuClassName = '',
  searchable = 'auto',
  searchPlaceholder,
  emptyText,
}: StudioSelectProps): React.JSX.Element {
  const { resolvedLang } = useAppStore();
  const autoId = useId();
  const rootId = `studio-select-${autoId}`;
  const listboxId = `${rootId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);
  const [floatingEl, setFloatingEl] = useState<HTMLDivElement | null>(null);
  const [triggerWidth, setTriggerWidth] = useState<number>(0);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeaheadRef = useRef<{ buffer: string; timer: number | null }>({
    buffer: '',
    timer: null,
  });

  const setTriggerNode = useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    setTriggerEl(node);
  }, []);

  const showSearch =
    searchable === true ||
    (searchable === 'auto' && options.length >= AUTO_SEARCH_THRESHOLD);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!showSearch || !q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query, showSearch]);

  const { mounted, state } = usePresence(isOpen, SELECT_EXIT_MS);

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setQuery('');
    if (restoreFocus && triggerRef.current) {
      triggerRef.current.focus({ preventScroll: true });
    }
  }, []);

  const openMenu = useCallback(
    (initialMode: 'selected' | 'first' | 'last' = 'selected') => {
      if (disabled || options.length === 0) return;
      if (triggerRef.current) {
        setTriggerWidth(triggerRef.current.getBoundingClientRect().width);
      }
      setQuery('');
      let targetIdx = -1;
      if (initialMode === 'first') {
        targetIdx = findEdgeEnabledIndex(options, false);
      } else if (initialMode === 'last') {
        targetIdx = findEdgeEnabledIndex(options, true);
      } else {
        const selectedIdx = options.findIndex(
          (opt) => opt.value === value && !opt.disabled,
        );
        targetIdx = selectedIdx >= 0 ? selectedIdx : findEdgeEnabledIndex(options, false);
      }
      setActiveIndex(targetIdx);
      setIsOpen(true);
    },
    [disabled, options, value],
  );

  const commitOption = useCallback(
    (opt: StudioSelectOption | undefined) => {
      if (!opt || opt.disabled) return;
      if (opt.value !== value) {
        onChange(opt.value);
      }
      closeMenu(true);
    },
    [value, onChange, closeMenu],
  );

  const { top, left, side: physicalSide, positioned } = useFloatingPosition({
    anchor: triggerEl,
    floatingEl,
    open: isOpen,
    side,
    align,
    offset,
    viewportPadding: 8,
    closeOnScroll: false,
    onAnchorLost: () => closeMenu(false),
    repositionKey: `${filteredOptions.length}-${query}-${triggerWidth}`,
  });

  // Close if control becomes disabled while open
  useEffect(() => {
    if (disabled && isOpen) {
      closeMenu(false);
    }
  }, [disabled, isOpen, closeMenu]);

  // Sync trigger width when open or resized
  useEffect(() => {
    if (!isOpen || !triggerEl || typeof window === 'undefined') return;
    const syncWidth = () => {
      const nextWidth = triggerEl.getBoundingClientRect().width;
      setTriggerWidth((prev) => (Math.abs(prev - nextWidth) > 0.5 ? nextWidth : prev));
    };
    syncWidth();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncWidth);
      ro.observe(triggerEl);
    }
    window.addEventListener('resize', syncWidth, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncWidth);
    };
  }, [isOpen, triggerEl]);

  // Focus search input when opening a searchable dropdown
  useEffect(() => {
    if (!isOpen || !showSearch || typeof window === 'undefined') return;
    const raf = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, showSearch]);

  // Keep activeIndex valid when filteredOptions changes
  useEffect(() => {
    if (!isOpen) return;
    if (filteredOptions.length === 0) {
      setActiveIndex(-1);
      return;
    }
    const selectedIdx = filteredOptions.findIndex(
      (opt) => opt.value === value && !opt.disabled,
    );
    if (query.trim().length > 0) {
      setActiveIndex(findEdgeEnabledIndex(filteredOptions, false));
    } else if (selectedIdx >= 0) {
      setActiveIndex(selectedIdx);
    } else {
      setActiveIndex(findEdgeEnabledIndex(filteredOptions, false));
    }
  }, [isOpen, query, filteredOptions, value]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const el = optionRefs.current[activeIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, activeIndex]);

  // Outside click, outside focus (Tab), and capture-phase Escape handling
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handlePointerDown = (event: PointerEvent) => {
      if (getClosestFromTarget(event.target, `[data-studio-select-root="${rootId}"]`)) {
        return;
      }
      closeMenu(false);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (getClosestFromTarget(event.target, `[data-studio-select-root="${rootId}"]`)) {
        return;
      }
      closeMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, rootId, closeMenu]);

  // Clear typeahead timer on unmount
  useEffect(() => {
    return () => {
      if (typeaheadRef.current.timer !== null) {
        window.clearTimeout(typeaheadRef.current.timer);
      }
    };
  }, []);

  const handleTypeahead = useCallback(
    (char: string) => {
      const stateRef = typeaheadRef.current;
      if (stateRef.timer !== null) {
        window.clearTimeout(stateRef.timer);
      }
      stateRef.buffer = (stateRef.buffer + char.toLowerCase()).slice(0, 24);
      stateRef.timer = window.setTimeout(() => {
        stateRef.buffer = '';
        stateRef.timer = null;
      }, TYPEAHEAD_RESET_MS);

      const list = isOpen ? filteredOptions : options;
      const startFrom = isOpen
        ? activeIndex
        : list.findIndex((opt) => opt.value === value);
      const len = list.length;
      if (len === 0) return;

      const matchBy = (prefix: string): number => {
        for (let i = 1; i <= len; i += 1) {
          const idx = (Math.max(-1, startFrom) + i) % len;
          const opt = list[idx];
          if (opt && !opt.disabled && opt.label.toLowerCase().startsWith(prefix)) {
            return idx;
          }
        }
        return -1;
      };

      let matchIdx = matchBy(stateRef.buffer);
      if (matchIdx < 0 && stateRef.buffer.length > 1) {
        stateRef.buffer = char.toLowerCase();
        matchIdx = matchBy(stateRef.buffer);
      }
      if (matchIdx >= 0) {
        if (isOpen) {
          setActiveIndex(matchIdx);
        } else {
          const matched = list[matchIdx];
          if (matched && matched.value !== value) {
            onChange(matched.value);
          }
        }
      }
    },
    [isOpen, filteredOptions, options, activeIndex, value, onChange],
  );

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      if (!isOpen) {
        openMenu('selected');
      } else {
        setActiveIndex((prev) => findNextEnabledIndex(filteredOptions, prev, 1));
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (!isOpen) {
        openMenu('last');
      } else {
        setActiveIndex((prev) => findNextEnabledIndex(filteredOptions, prev, -1));
      }
      return;
    }

    if (event.key === 'Home' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(findEdgeEnabledIndex(filteredOptions, false));
      return;
    }

    if (event.key === 'End' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(findEdgeEnabledIndex(filteredOptions, true));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (!isOpen) {
        openMenu('selected');
      } else if (activeIndex >= 0 && filteredOptions[activeIndex]) {
        commitOption(filteredOptions[activeIndex]);
      } else {
        closeMenu(true);
      }
      return;
    }

    if (event.key === 'Tab' && isOpen) {
      closeMenu(false);
      return;
    }

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      handleTypeahead(event.key);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex((prev) => findNextEnabledIndex(filteredOptions, prev, 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex((prev) => findNextEnabledIndex(filteredOptions, prev, -1));
      return;
    }
    if (event.key === 'Enter') {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      if (activeIndex >= 0 && filteredOptions[activeIndex]) {
        commitOption(filteredOptions[activeIndex]);
      }
      return;
    }
    if (event.key === 'Tab') {
      closeMenu(false);
    }
  };

  const activeOptionId =
    isOpen && activeIndex >= 0 && filteredOptions[activeIndex]
      ? `${rootId}-opt-${activeIndex}`
      : undefined;

  const hostDialog =
    typeof document !== 'undefined' && triggerEl
      ? getClosestFromTarget(triggerEl, 'dialog[open]')
      : null;

  const resolvedSearchPlaceholder =
    searchPlaceholder ?? translate(resolvedLang, 'searchPlaceholder');
  const resolvedEmptyText = emptyText ?? '—';
  optionRefs.current.length = filteredOptions.length;

  return (
    <>
      <button
        ref={setTriggerNode}
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-studio-select-root={rootId}
        data-open={isOpen ? 'true' : 'false'}
        onClick={() => {
          if (isOpen) {
            closeMenu(false);
          } else {
            openMenu('selected');
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`ui-select-trigger inline-flex items-center justify-between text-start cursor-pointer select-none min-w-0 ${STUDIO_SELECT_SIZE_CLASSES[size]} ${className}`}
      >
        <span
          className={`truncate ${
            selectedOption ? '' : 'text-[var(--text-secondary)]'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon
          className="ui-select-chevron w-3.5 h-3.5 shrink-0"
          strokeWidth={2.2}
        />
      </button>

      {mounted && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={setFloatingEl}
              data-studio-select-root={rootId}
              data-state={state}
              data-side={physicalSide}
              className={`ui-select-menu ${menuClassName}`}
              style={{
                top,
                left,
                minWidth: triggerWidth > 0 ? Math.round(triggerWidth) : undefined,
                maxWidth: 'min(320px, calc(100vw - 16px))',
                visibility: isOpen && !positioned ? 'hidden' : 'visible',
              }}
            >
              {showSearch && (
                <div className="p-1 pb-1.5">
                  <div className="ui-select-search h-7.5 px-2 rounded-lg flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={resolvedSearchPlaceholder}
                      aria-label={resolvedSearchPlaceholder}
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="w-full bg-transparent text-[12px] leading-tight focus:outline-none placeholder:text-[var(--text-secondary)]/70"
                    />
                  </div>
                </div>
              )}

              <div
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                className="max-h-[232px] overflow-y-auto modal-contain-scroll space-y-0.5"
              >
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = opt.value === value;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={opt.value}
                        ref={(el) => {
                          optionRefs.current[idx] = el;
                        }}
                        id={`${rootId}-opt-${idx}`}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={isSelected}
                        aria-disabled={opt.disabled || undefined}
                        data-active={isActive ? 'true' : 'false'}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => {
                          if (!opt.disabled) setActiveIndex(idx);
                        }}
                        onClick={() => commitOption(opt)}
                        className={`ui-select-option w-full flex items-center justify-between gap-2 text-start cursor-pointer select-none ${STUDIO_SELECT_OPTION_CLASSES[size]}`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && (
                          <CheckIcon
                            className="w-3.5 h-3.5 shrink-0 text-[var(--brand-text)]"
                            strokeWidth={2.4}
                          />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-4 px-3 text-center text-[11.5px] text-[var(--text-secondary)]">
                    {resolvedEmptyText}
                  </div>
                )}
              </div>
            </div>,
            hostDialog ?? document.body,
          )
        : null}
    </>
  );
}
