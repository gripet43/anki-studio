import React, { useEffect, useId, useRef, useState } from 'react';
import { translate } from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { getClosestFromTarget } from '../../utils/domTarget';
import { ZEN_AMBIENCE_SCENES, type ZenAmbienceScene } from '../../utils/zenMode';
import { Tooltip } from '../common/Tooltip';

export interface ZenSoundControlProps {
  /** Notifies parent (e.g. ZenReviewView hoverbar) to stay pinned while popover is open. */
  onOpenChange?: (open: boolean) => void;
}

const SCENE_LABEL_KEY: Record<
  ZenAmbienceScene,
  'zenAmbienceSilent' | 'zenAmbienceRain' | 'zenAmbienceWind' | 'zenAmbienceWarmth'
> = {
  silent: 'zenAmbienceSilent',
  rain: 'zenAmbienceRain',
  wind: 'zenAmbienceWind',
  warmth: 'zenAmbienceWarmth',
};

/**
 * Quiet Zen acoustic disclosure control.
 * Opens a minimalist Washi-paper popover for toggling Zen ritual acoustics (singing bowl & paper touch)
 * and selecting an optional procedural ambient soundscape bed ('silent' by default).
 *
 * Uses a plain disclosure button + button-group pattern (never role="menu" or aria-haspopup),
 * supports light-dismiss via safe getClosestFromTarget, and consumes Escape in capture phase
 * so closing the popover never accidentally exits Zen Review.
 */
export const ZenSoundControl: React.FC<ZenSoundControlProps> = ({ onOpenChange }) => {
  const { zenSoundEnabled, zenSfxVolume, zenAmbienceVolume, zenAmbience, resolvedLang } =
    useAppStore();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const t = (key: any) => translate(resolvedLang, key);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!getClosestFromTarget(e.target, `[data-zen-sound-wrap="${panelId}"]`)) {
        setOpenState(false);
      }
    };

    // Capture-phase Escape with stopImmediatePropagation ensures layered dismiss:
    // closes this popover first without letting sibling window listeners exit Zen Review
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpenState(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, panelId]);

  useEffect(() => {
    return () => {
      onOpenChange?.(false);
    };
  }, []);

  const isSfxActive = zenSoundEnabled && zenSfxVolume > 0;
  const isAmbienceActive = zenAmbience !== 'silent' && zenAmbienceVolume > 0;
  const isAnyAudioActive = isSfxActive || isAmbienceActive;
  const sfxPct = zenSoundEnabled ? Math.round(zenSfxVolume * 100) : 0;
  const ambiencePct = zenAmbience !== 'silent' ? Math.round(zenAmbienceVolume * 100) : 0;

  return (
    <div
      data-zen-sound-wrap={panelId}
      data-zen-popover-open={open ? 'true' : 'false'}
      onMouseDown={(e) => e.stopPropagation()}
      className="zen-sound-wrap relative"
    >
      <Tooltip
        variant="compact"
        content={
          !isAnyAudioActive
            ? t('zenSoundOffTooltip')
            : isAmbienceActive
            ? `${t('zenAmbienceTitle')} · ${t(SCENE_LABEL_KEY[zenAmbience])}`
            : t('zenSoundOnTooltip')
        }
        side="bottom"
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpenState(!open)}
          aria-label={t('zenSoundAria')}
          aria-expanded={open}
          aria-controls={panelId}
          data-zen-sound={isAnyAudioActive ? 'on' : 'off'}
          data-zen-ambience-active={zenAmbience}
          className={`zen-sound-toggle ${isAmbienceActive ? 'zen-sound-toggle--ambient' : ''}`}
        >
          {isAnyAudioActive ? (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              {isAmbienceActive && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" opacity="0.65" />}
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
          )}
          {isAmbienceActive && <span aria-hidden="true" className="zen-sound-active-dot" />}
        </button>
      </Tooltip>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={t('zenSoundAria')}
          data-zen-sound-popover="open"
          className="zen-sound-popover"
        >
          {/* Row 1: Ceremonial Singing Bowl & Paper Touch toggle */}
          <div className="zen-sound-row">
            <span className="zen-sound-label">{t('zenBellToggleLabel')}</span>
            <button
              type="button"
              onClick={() => appActions.toggleZenSound()}
              aria-pressed={zenSoundEnabled}
              data-zen-sound-switch="true"
              className={`zen-sound-switch ${zenSoundEnabled ? 'is-active' : ''}`}
            >
              <span aria-hidden="true" className="zen-sound-pill-dot" />
              <span>{zenSoundEnabled ? t('zenBellStateOn') : t('zenBellStateOff')}</span>
            </button>
          </div>

          {/* Row 1.5: SFX volume slider (defaults to 50%) */}
          <div className="zen-sound-volume-row">
            <svg
              className="zen-volume-icon w-3.5 h-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {isSfxActive && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
            </svg>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sfxPct}
              aria-label={t('zenBellToggleLabel')}
              aria-valuetext={`${sfxPct}%`}
              data-zen-sfx-volume-slider="true"
              style={{ '--zen-vol-pct': `${sfxPct}%` } as React.CSSProperties}
              onChange={(e) => appActions.setZenSfxVolume(Number(e.target.value) / 100)}
              className="zen-volume-slider"
            />
            <span className="zen-volume-value" aria-hidden="true">
              {sfxPct}%
            </span>
          </div>

          <div className="zen-sound-divider" aria-hidden="true" />

          {/* Row 2: Optional procedural ambient soundscape bed (defaults to 'silent') */}
          <div className="zen-sound-section">
            <span className="zen-sound-section-title">{t('zenAmbienceTitle')}</span>
            <div className="zen-sound-pills">
              {ZEN_AMBIENCE_SCENES.map((scene) => {
                const selected = zenAmbience === scene;
                return (
                  <button
                    key={scene}
                    type="button"
                    onClick={() => appActions.setZenAmbience(scene)}
                    aria-pressed={selected}
                    data-zen-ambience-option={scene}
                    className={`zen-sound-pill ${selected ? 'is-selected' : ''}`}
                  >
                    {selected && <span aria-hidden="true" className="zen-sound-pill-dot" />}
                    <span>{t(SCENE_LABEL_KEY[scene])}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 2.5: Ambience background volume slider (defaults to 50%) */}
            <div className={`zen-sound-volume-row ${zenAmbience === 'silent' ? 'is-dimmed' : ''}`}>
              <svg
                className="zen-volume-icon w-3.5 h-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {isAmbienceActive && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
              </svg>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={ambiencePct}
                disabled={zenAmbience === 'silent'}
                aria-label={t('zenAmbienceTitle')}
                aria-valuetext={`${ambiencePct}%`}
                data-zen-ambience-volume-slider="true"
                style={{ '--zen-vol-pct': `${ambiencePct}%` } as React.CSSProperties}
                onChange={(e) => appActions.setZenAmbienceVolume(Number(e.target.value) / 100)}
                className="zen-volume-slider"
              />
              <span className="zen-volume-value" aria-hidden="true">
                {ambiencePct}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
