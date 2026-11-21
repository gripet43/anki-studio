import React, { useEffect, useRef, useState } from 'react';
import { translate } from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { resolveThemeMode } from '../../utils/themeTokens';
import { playZenEnterBell, playZenIncenseIgnite, prewarmZenAudio } from '../../utils/zenAudio';
import { resolveZenTimePeriod } from '../../utils/zenMode';
import { ZenEnsoGlyph } from './ZenEnsoGlyph';
import {
  INCENSE_RING_COMPLETE_MS,
  ZenIncenseCanvas,
} from './ZenIncenseCanvas';

// 4-Act Continuous Smoke-to-Ensō Morphogenesis Ceremony (6.05s total, zero flash):
// Act 1 ('awaiting'): Prompt sits intimately right above the bottom incense tip (bottom: 132px).
// Act 2 ('lit', 0 -> 2.72s): Ember warms; silk smoke rises in hushed anticipation and condenses
//       clockwise into the sumi-e Ensō brushstroke.
// Act 3 ('lit' + bellStruck, 2.72s -> 5.27s): Exact climax at circle completion — bronze singing
//       bowl strikes on the final brushstroke, twin acoustic halos bloom outward, and "焚香入静"
//       settles and lingers calmly (~1.8s after subtitle settles) in the resonance.
// Act 4 ('exiting', 5.27s -> 6.05s): Continuous single-breath handoff while bowl resonance lingers:
//       (1) 0-220ms: "焚香入静" exhales gently upward.
//       (2) 60-420ms: Overlay veil dissolves cleanly over the pixel-locked ZenHomeView Ensō.
//       (3) 120-640ms: "开卷" inhales into center as caption clears, then period/deck/header settle.
const BELL_STRIKE_MS = INCENSE_RING_COMPLETE_MS - 30; // 2720ms — exact Ensō completion climax
const CEREMONY_HOLD_MS = BELL_STRIKE_MS + 2550; // 5270ms (~1.8s full caption hold)
const CEREMONY_FADE_MS = 1350; // Allows ink-bloom stagger (开卷 -> 时段 -> 全部 -> 顶栏) to settle cleanly before unmount
const FAST_FORWARD_GUARD_MS = 300; // Debounce accidental double-tap immediately after lighting
const FAST_FORWARD_FADE_MS = 480; // Calm veil dissolve when deliberately fast-forwarding

type ThresholdPhase = 'awaiting' | 'lit' | 'exiting';

/**
 * Interactive Song-style scholar's incense ceremony (焚香入静 -> 烟凝成相).
 * Strictly preserves light/dark theme polarity and keeps the incense stick & Ensō at fixed
 * viewport coordinates from start to finish.
 */
export const ZenThresholdOverlay: React.FC = () => {
  const { zenThresholdVisible, zenSoundEnabled, theme, systemDark, resolvedLang } = useAppStore();
  const [phase, setPhase] = useState<ThresholdPhase>('awaiting');
  const [bellStruck, setBellStruck] = useState(false);

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const litAtRef = useRef<number>(0);
  const bellStruckRef = useRef<boolean>(false);
  const soundEnabledRef = useRef(zenSoundEnabled);
  soundEnabledRef.current = zenSoundEnabled;

  const t = (key: any) => translate(resolvedLang, key);
  const isDark = resolveThemeMode(theme, systemDark) === 'dark';
  const timePeriod = resolveZenTimePeriod(new Date().getHours());

  const clearAllTimers = () => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  };

  const igniteIncense = () => {
    if (phase !== 'awaiting') return;
    clearAllTimers();
    litAtRef.current = Date.now();
    bellStruckRef.current = false;
    setPhase('lit');
    setBellStruck(false);
    playZenIncenseIgnite(soundEnabledRef.current);

    // Strike the bronze bowl on the exact frame the sumi-e Ensō circle completes
    const bellTimer = window.setTimeout(() => {
      bellStruckRef.current = true;
      setBellStruck(true);
      playZenEnterBell(soundEnabledRef.current);
    }, BELL_STRIKE_MS);

    const fadeTimer = window.setTimeout(() => {
      setPhase('exiting');
    }, CEREMONY_HOLD_MS);

    const doneTimer = window.setTimeout(() => {
      appActions.dismissZenThreshold();
    }, CEREMONY_HOLD_MS + CEREMONY_FADE_MS);

    timersRef.current = [bellTimer, fadeTimer, doneTimer];
  };

  const fastForwardCeremony = () => {
    if (phase !== 'lit') return;
    if (Date.now() - litAtRef.current < FAST_FORWARD_GUARD_MS) return;
    clearAllTimers();
    if (!bellStruckRef.current) {
      bellStruckRef.current = true;
      setBellStruck(true);
      playZenEnterBell(soundEnabledRef.current);
    }
    setPhase('exiting');
    const doneTimer = window.setTimeout(() => {
      appActions.dismissZenThreshold();
    }, FAST_FORWARD_FADE_MS);
    timersRef.current = [doneTimer];
  };

  useEffect(() => {
    if (!zenThresholdVisible) {
      clearAllTimers();
      litAtRef.current = 0;
      bellStruckRef.current = false;
      setPhase('awaiting');
      setBellStruck(false);
    } else {
      prewarmZenAudio(soundEnabledRef.current);
    }
    return () => {
      clearAllTimers();
    };
  }, [zenThresholdVisible]);

  useEffect(() => {
    if (!zenThresholdVisible) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === 'awaiting') {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          appActions.exitZenMode();
          return;
        }
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          igniteIncense();
        }
        return;
      }
      if (phase === 'lit' && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        fastForwardCeremony();
        return;
      }
      // Gently absorb stray keys while dissolving into Zen Home
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [zenThresholdVisible, phase]);

  if (!zenThresholdVisible) return null;

  const isLit = phase === 'lit' || phase === 'exiting';

  return (
    <div
      data-zen-threshold={phase}
      data-zen-bell-struck={bellStruck ? 'true' : 'false'}
      data-zen-period={timePeriod}
      role="presentation"
      onPointerDown={() => {
        if (phase === 'awaiting') {
          prewarmZenAudio(soundEnabledRef.current);
        }
      }}
      onClick={() => {
        if (phase === 'awaiting') {
          igniteIncense();
        } else if (phase === 'lit') {
          fastForwardCeremony();
        }
      }}
      className={`zen-sanctuary-bg zen-threshold-overlay zen-threshold-overlay--chamber fixed inset-0 z-40 flex flex-col items-center justify-center select-none overflow-hidden ${
        phase === 'awaiting' || phase === 'lit' ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {/* Real-time Canvas 2D fluid incense smoke & glowing ember (fixed at bottom: 88px) */}
      <ZenIncenseCanvas
        mode="ritual"
        lit={isLit}
        isDark={isDark}
        className="fixed inset-0 w-full h-full pointer-events-none z-[3]"
      />

      {/* Intimate prompt positioned directly above the unlit incense tip (baseY = height - 28, stickH = 18vh) */}
      <div
        className={`zen-threshold-invite fixed inset-x-0 bottom-[clamp(160px,calc(18vh+70px),202px)] z-10 flex justify-center pointer-events-none transition-[opacity,transform] duration-150 ease-out ${
          isLit ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="zen-threshold-invite-inner">
          <p className="zen-serif zen-threshold-prompt">{t('zenIncensePrompt')}</p>
        </div>
      </div>

      {/* Center Ensō stage: emerges as smoke condenses clockwise into the ring */}
      {bellStruck && (
        <div className="zen-threshold-core fixed left-1/2 top-[calc(50%-38px)] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none">
          <div className="relative flex items-center justify-center w-[156px] h-[156px]">
            <ZenEnsoGlyph
              variant="open"
              className="zen-enso-svg zen-threshold-enso w-[156px] h-[156px] relative z-10 opacity-0 motion-reduce:opacity-100"
            />
          </div>
          <div className="zen-threshold-caption absolute top-full left-1/2 -translate-x-1/2 pt-7 flex flex-col items-center whitespace-nowrap">
            <span className="zen-serif zen-threshold-cue">{t('zenThresholdCue')}</span>
            <span className="zen-serif zen-threshold-sub mt-2.5">{t('zenThresholdSub')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
