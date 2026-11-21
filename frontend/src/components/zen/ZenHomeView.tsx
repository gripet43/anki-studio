import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translate } from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { getClosestFromTarget, isTypingTarget } from '../../utils/domTarget';
import { resolveThemeMode } from '../../utils/themeTokens';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';
import { playZenStartDrum } from '../../utils/zenAudio';
import {
  resolveZenCompleteSubKey,
  resolveZenHomeState,
  resolveZenPeriodLabel,
  resolveZenTimePeriod,
  selectZenPendingDecks,
} from '../../utils/zenMode';

import { Tooltip } from '../common/Tooltip';
import { ZenEnsoGlyph } from './ZenEnsoGlyph';
import { ZenIncenseCanvas } from './ZenIncenseCanvas';
import { ZenSoundControl } from './ZenSoundControl';

const START_DRUM_ENTER_DELAY_MS = 1150;

/**
 * Zero-based Zen Home (Sanctuary Courtyard).
 * Built on Ma (negative space), circadian In'ei (shoji light & washi grain), and calligraphic
 * Kasure Ensō (円相): the asymmetric 4-6 breathing ink ring itself is the ceremonial trigger
 * to begin studying, anchored at the exact same (cx, 50% - 38px) coordinates as the incense
 * smoke-condensation ring. Beneath it sits a single calligraphic book-slip (一签择卷) that
 * unfurls a compact Washi scroll popover on demand so even 50+ decks never disturb the courtyard.
 */
export const ZenHomeView: React.FC = () => {
  const {
    isInitialSyncing,
    syncing,
    dashboard,
    decks,
    theme,
    systemDark,
    resolvedLang,
    zenSoundEnabled,
    zenThresholdVisible,
  } = useAppStore();

  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [deckPickerOpen, setDeckPickerOpen] = useState(false);
  const [isStartingReview, setIsStartingReview] = useState(false);
  const [currentHour, setCurrentHour] = useState<number>(() => new Date().getHours());
  const deckPickerRef = useRef<HTMLDivElement | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const isDark = resolveThemeMode(theme, systemDark) === 'dark';

  const isSyncPending = isInitialSyncing || syncing;
  const isVacationActive = Boolean(dashboard.vacation?.isActive);
  const totalPending = dashboard.todayStats.totalPending;

  const pendingDecks = useMemo(() => selectZenPendingDecks(decks), [decks]);
  const effectiveDeckId = useMemo(() => {
    if (pendingDecks.length === 1) return pendingDecks[0].id;
    if (selectedDeckId === 'all') return 'all';
    return pendingDecks.some((d) => d.id === selectedDeckId) ? selectedDeckId : 'all';
  }, [selectedDeckId, pendingDecks]);

  const activeDeckLabel = useMemo(() => {
    if (effectiveDeckId === 'all') return t('filterAll');
    return pendingDecks.find((d) => d.id === effectiveDeckId)?.name || t('filterAll');
  }, [effectiveDeckId, pendingDecks, resolvedLang]);

  useEffect(() => {
    mountedRef.current = true;
    const clockId = window.setInterval(() => {
      const nextHour = new Date().getHours();
      setCurrentHour((prev) => (prev === nextHour ? prev : nextHour));
    }, 60_000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(clockId);
      if (startTimerRef.current) {
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
    };
  }, []);

  const handleStartReview = () => {
    if (isStartingReview) return;
    setDeckPickerOpen(false);
    const drumPlayed = playZenStartDrum(zenSoundEnabled);
    if (!drumPlayed) {
      appActions.startReview(effectiveDeckId);
      return;
    }
    setIsStartingReview(true);
    // Prefetch the review queue in parallel during the 1150ms drum + incense glide so
    // the first card renders atomically with zero Python IPC stutter or empty-frame flash.
    const prefetchPromise = appActions.prefetchReviewQueue(effectiveDeckId, false);
    startTimerRef.current = window.setTimeout(async () => {
      startTimerRef.current = null;
      const prefetched = await prefetchPromise;
      if (!mountedRef.current) return;
      if (prefetched) {
        await appActions.startReview(effectiveDeckId, false, false, {
          preloadedCards: prefetched.cards,
          preloadedIsPreview: prefetched.isPreviewOnly,
        });
      } else {
        await appActions.startReview(effectiveDeckId);
      }
    }, START_DRUM_ENTER_DELAY_MS);
  };

  const homeState = resolveZenHomeState({
    isSyncPending,
    isVacationActive,
    totalPending,
    pendingDecksCount: pendingDecks.length,
    hasAnyDecks: decks.length > 0,
  });

  useEffect(() => {
    if (zenThresholdVisible || deckPickerOpen || typeof window === 'undefined') return;

    const handleCourtyardKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        appActions.exitZenMode();
        return;
      }

      if (
        (e.key === ' ' || e.key === 'Enter') &&
        homeState === 'ready' &&
        !isStartingReview
      ) {
        // Respect focused header controls (sound/exit) and deck-picker trigger
        if (
          getClosestFromTarget(e.target, '.zen-home-header') ||
          getClosestFromTarget(e.target, '.zen-deck-picker') ||
          getClosestFromTarget(e.target, '.zen-sound-wrap')
        ) {
          return;
        }
        e.preventDefault();
        handleStartReview();
      }
    };

    window.addEventListener('keydown', handleCourtyardKeyDown);
    return () => {
      window.removeEventListener('keydown', handleCourtyardKeyDown);
    };
  }, [zenThresholdVisible, deckPickerOpen, homeState, isStartingReview, effectiveDeckId, zenSoundEnabled]);

  useEffect(() => {
    if (!deckPickerOpen || typeof window === 'undefined') return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target;
      if (
        deckPickerRef.current &&
        target instanceof Node &&
        !deckPickerRef.current.contains(target)
      ) {
        setDeckPickerOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setDeckPickerOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [deckPickerOpen]);

  const timePeriod = resolveZenTimePeriod(currentHour);
  const periodLabelKey =
    timePeriod === 'morning'
      ? 'zenPeriodMorning'
      : timePeriod === 'afternoon'
      ? 'zenPeriodAfternoon'
      : timePeriod === 'evening'
      ? 'zenPeriodEvening'
      : 'zenPeriodNight';
  const periodLabel = resolveZenPeriodLabel(currentHour, resolvedLang, t(periodLabelKey));
  const completeSubKey = resolveZenCompleteSubKey(timePeriod);

  return (
    <div
      data-zen-view="home"
      data-zen-period={timePeriod}
      data-zen-starting={isStartingReview ? 'true' : 'false'}
      className={`zen-sanctuary-bg zen-home-shell flex-1 h-screen flex flex-col overflow-hidden select-none ${
        isStartingReview ? 'zen-home-shell--starting' : ''
      }`}
    >
      {/* Quiet courtyard incense — glides smoothly to bottom-right desk position on 开卷 */}
      <ZenIncenseCanvas
        mode="ambient"
        lit
        isDark={isDark}
        glideToReview={isStartingReview}
        className="fixed inset-0 w-full h-full pointer-events-none z-[3]"
      />

      {/* Top draggable safe area — subtle acoustic popover + quiet exit (traffic lights hidden on macOS) */}
      <header
        onMouseDown={startWindowDrag}
        onDoubleClick={handleWindowDoubleClick}
        className="zen-home-header relative z-20 shrink-0 h-14 px-7 flex items-center justify-end gap-1.5"
      >
        <ZenSoundControl />

        <Tooltip variant="compact" content={t('zenExitBtn')} shortcut="Cmd Shift Z" side="bottom">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => appActions.exitZenMode()}
            aria-label={t('zenExitBtn')}
            className="zen-exit-ghost"
          >
            {t('zenExitShort')}
          </button>
        </Tooltip>
      </header>

      {/* Centered Sanctuary Stage (non-scrolling fixed courtyard to preserve Ma & incense space) */}
      <main className="relative z-10 flex-1 min-h-0 overflow-hidden px-6 pb-16 flex flex-col items-center">
        <div className="zen-home-stage my-auto w-full max-w-[420px] flex flex-col items-center text-center">
          {homeState === 'syncing' && (
            <div role="status" aria-live="polite" className="flex flex-col items-center gap-6">
              <ZenEnsoGlyph variant="open" className="zen-enso-svg zen-enso-breath w-24 h-24 opacity-60" />
              <p className="zen-serif text-[14.5px] tracking-[0.14em] text-[var(--text-secondary)]">
                {t('zenSyncingTitle')}
              </p>
            </div>
          )}

          {homeState === 'ready' && (
            <div className="fixed left-1/2 top-[calc(50%-38px)] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
              <div className="zen-home-chrome-reveal zen-home-period-reveal absolute bottom-full left-1/2 -translate-x-1/2 pb-8 whitespace-nowrap pointer-events-none">
                <p className="zen-period-label zen-serif !mb-0">{periodLabel}</p>
              </div>

              {/* Ensō (円相) Ceremonial Start Trigger — pixel-locked to the smoke-condensed Ensō */}
              <button
                type="button"
                disabled={isStartingReview}
                onClick={handleStartReview}
                aria-label={t('zenStartBtn')}
                className="zen-start-btn zen-enso-trigger group"
              >
                <span aria-hidden="true" className="zen-enso-aura" />
                <ZenEnsoGlyph
                  variant="open"
                  className="zen-enso-svg zen-enso-breath w-full h-full"
                />
                <span
                  className={`zen-home-seal-reveal zen-enso-center-label zen-serif ${
                    resolvedLang === 'zh-CN' ? 'zen-enso-center-label--art' : ''
                  }`}
                >
                  {resolvedLang === 'zh-CN' ? (
                    <>
                      <span aria-hidden="true" className="zen-enso-calligraphy" />
                      <span className="sr-only">{t('zenBeginSeal')}</span>
                    </>
                  ) : (
                    t('zenBeginSeal')
                  )}
                </span>
              </button>

              {/* Single-line calligraphic book-slip (一签择卷) — never crowds the incense below */}
              <div className="zen-home-chrome-reveal zen-home-deck-reveal zen-home-deck-slot absolute top-full left-1/2 -translate-x-1/2 pt-7 flex flex-col items-center">
                {pendingDecks.length === 1 && (
                  <p className="zen-serif text-[13.5px] tracking-[0.06em] text-[var(--text-secondary)] truncate max-w-[280px]">
                    {pendingDecks[0].name}
                  </p>
                )}

                {pendingDecks.length > 1 && (
                  <div ref={deckPickerRef} className="zen-deck-picker relative flex flex-col items-center">
                    <button
                      type="button"
                      disabled={isStartingReview}
                      data-zen-deck-picker-trigger="true"
                      aria-haspopup="listbox"
                      aria-expanded={deckPickerOpen}
                      aria-label={`${t('navDecks')}: ${activeDeckLabel}`}
                      onClick={() => setDeckPickerOpen((prev) => !prev)}
                      className={`zen-deck-picker-trigger zen-serif ${
                        deckPickerOpen ? 'is-open' : ''
                      }`}
                    >
                      {effectiveDeckId !== 'all' && (
                        <span aria-hidden="true" className="zen-deck-slip-dot" />
                      )}
                      <span className="truncate max-w-[220px]">{activeDeckLabel}</span>
                    </button>

                    {/* Floating Washi Scroll Popover — unfurls upward over center stage, leaving incense untouched */}
                    <div
                      data-zen-deck-popover={deckPickerOpen ? 'open' : 'closed'}
                      aria-hidden={!deckPickerOpen}
                      className={`zen-deck-popover ${deckPickerOpen ? 'is-open' : ''}`}
                    >
                      <button
                        type="button"
                        data-zen-deck-option="all"
                        aria-pressed={effectiveDeckId === 'all'}
                        tabIndex={deckPickerOpen ? 0 : -1}
                        onClick={() => {
                          setSelectedDeckId('all');
                          setDeckPickerOpen(false);
                        }}
                        className={`zen-deck-all-row zen-serif ${
                          effectiveDeckId === 'all' ? 'is-selected' : ''
                        }`}
                      >
                        <span className="truncate">{t('filterAll')}</span>
                        {effectiveDeckId === 'all' && (
                          <span aria-hidden="true" className="zen-deck-active-dot" />
                        )}
                      </button>

                      <div aria-hidden="true" className="zen-paper-divider my-1" />

                      <ul aria-label={t('navDecks')} className="zen-deck-list">
                        {pendingDecks.map((deck) => {
                          const isSelected = effectiveDeckId === deck.id;
                          return (
                            <li key={deck.id}>
                              <button
                                type="button"
                                data-zen-deck-option={deck.id}
                                aria-pressed={isSelected}
                                tabIndex={deckPickerOpen ? 0 : -1}
                                onClick={() => {
                                  setSelectedDeckId(deck.id);
                                  setDeckPickerOpen(false);
                                }}
                                className={`zen-deck-row zen-serif ${
                                  isSelected ? 'is-selected' : ''
                                }`}
                              >
                                <span className="truncate">{deck.name}</span>
                                {isSelected && (
                                  <span aria-hidden="true" className="zen-deck-active-dot" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {homeState === 'all-done' && (
            <div role="status" aria-live="polite" className="flex flex-col items-center">
              <ZenEnsoGlyph
                variant="closed"
                animateDraw
                showSeal
                className="zen-enso-svg zen-enso-complete w-28 h-28 mb-7"
              />
              <h1 className="zen-home-title zen-serif settings-heading">{t('zenAllDoneTitle')}</h1>
              <p className="mt-3.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)] settings-helper-copy max-w-[330px]">
                {t(completeSubKey)}
              </p>
              <button
                type="button"
                onClick={() => appActions.exitZenMode()}
                className="zen-start-btn zen-ink-btn mt-9"
              >
                {t('zenExitBtn')}
              </button>
            </div>
          )}

          {homeState === 'vacation' && (
            <div className="flex flex-col items-center">
              <ZenEnsoGlyph variant="open" className="zen-enso-svg w-24 h-24 mb-7 opacity-45" />
              <h1 className="zen-home-title zen-serif settings-heading">{t('zenVacationTitle')}</h1>
              <p className="mt-3.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)] settings-helper-copy max-w-[330px]">
                {t('zenVacationSub')}
              </p>
              <button
                type="button"
                onClick={() => appActions.exitZenMode()}
                className="zen-secondary-btn zen-ink-ghost-btn mt-9"
              >
                {t('zenExitBtn')}
              </button>
            </div>
          )}

          {homeState === 'empty' && (
            <div className="flex flex-col items-center">
              <ZenEnsoGlyph variant="open" className="zen-enso-svg w-24 h-24 mb-7 opacity-35" />
              <h1 className="zen-home-title zen-serif settings-heading">{t('zenEmptyTitle')}</h1>
              <p className="mt-3.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)] settings-helper-copy max-w-[330px]">
                {t('zenEmptySub')}
              </p>
              <button
                type="button"
                onClick={() => appActions.exitZenMode()}
                className="zen-secondary-btn zen-ink-ghost-btn mt-9"
              >
                {t('zenExitBtn')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
