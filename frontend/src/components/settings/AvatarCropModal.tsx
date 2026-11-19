import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { type ResolvedLanguage, translate, type TranslationKey } from '../../i18n/translations';
import {
  AVATAR_CROP_MAX_ZOOM,
  AVATAR_CROP_MIN_ZOOM,
  AVATAR_CROP_VIEWPORT_PX,
  type AvatarCropTransform,
  clampAvatarCropTransform,
  computeAvatarCropLayout,
  DEFAULT_AVATAR_CROP,
  rotateAvatarCropTransform,
  scaleAvatarCropTransformZoom,
} from '../../utils/avatarImage';
import { Tooltip } from '../common/Tooltip';

export interface AvatarCropModalProps {
  /** Safe preview URL (base64 data URL or object URL) rendered inside the crop frame. */
  imageSrc: string;
  resolvedLang: ResolvedLanguage;
  isDark: boolean;
  saving?: boolean;
  onClose: () => void;
  onChangePhoto?: () => void;
  onImageError?: () => void;
  onConfirm: (crop: AvatarCropTransform, viewportSize: number) => Promise<void> | void;
}

const KEYBOARD_PAN_STEP = 12;
const KEYBOARD_FINE_PAN_STEP = 3;
const ZOOM_BUTTON_STEP = 0.2;

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  imageSrc,
  resolvedLang,
  isDark,
  saving = false,
  onClose,
  onChangePhoto,
  onImageError,
  onConfirm,
}) => {
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(resolvedLang, key, params),
    [resolvedLang]
  );

  const titleId = useId();
  const zoomSliderId = useId();
  const hintId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState<AvatarCropTransform>(DEFAULT_AVATAR_CROP);
  const [dragging, setDragging] = useState(false);
  const [adjustingZoom, setAdjustingZoom] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((msg: string) => {
    setLiveAnnouncement(msg);
    if (liveTimerRef.current !== null) {
      clearTimeout(liveTimerRef.current);
    }
    liveTimerRef.current = setTimeout(() => {
      setLiveAnnouncement('');
      liveTimerRef.current = null;
    }, 1000);
  }, []);

  useEffect(() => {
    setNaturalSize(null);
    setTransform(DEFAULT_AVATAR_CROP);
    setDragging(false);
    dragRef.current = null;
  }, [imageSrc]);

  useEffect(() => {
    return () => {
      if (liveTimerRef.current !== null) {
        clearTimeout(liveTimerRef.current);
      }
    };
  }, []);

  // Open as native modal <dialog> in top layer; handle close/cancel and light-dismiss fallback.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open && typeof dialog.showModal === 'function') {
      try {
        dialog.showModal();
      } catch {
        // Ignore if already open in edge HMR/test scenarios
      }
    }

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    const handleCancel = (e: Event) => {
      if (savingRef.current) {
        e.preventDefault();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    // Progressive fallback for browsers without native <dialog closedby="any">
    let removeOutsideListeners: (() => void) | null = null;
    if (
      typeof HTMLDialogElement !== 'undefined' &&
      !('closedBy' in HTMLDialogElement.prototype)
    ) {
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = !savingRef.current && isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && !savingRef.current && isOutside(e)) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      removeOutsideListeners = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
      removeOutsideListeners?.();
    };
  }, [onClose]);

  const layout = useMemo(() => {
    if (!naturalSize) return null;
    return computeAvatarCropLayout(
      naturalSize.width,
      naturalSize.height,
      transform,
      AVATAR_CROP_VIEWPORT_PX
    );
  }, [naturalSize, transform]);

  const applyZoom = useCallback(
    (nextZoom: number, announceChange = false) => {
      setTransform((prev) => {
        if (!naturalSize) {
          const clamped = Math.min(AVATAR_CROP_MAX_ZOOM, Math.max(AVATAR_CROP_MIN_ZOOM, nextZoom));
          return { ...prev, zoom: clamped };
        }
        const next = scaleAvatarCropTransformZoom(
          naturalSize.width,
          naturalSize.height,
          prev,
          nextZoom,
          AVATAR_CROP_VIEWPORT_PX
        );
        if (announceChange) {
          announce(`${t('avatarCropZoomLabel')} ${Math.round(next.zoom * 100)}%`);
        }
        return next;
      });
    },
    [naturalSize, announce, t]
  );

  // Smooth mouse-wheel / trackpad zoom over the crop stage (non-passive to prevent page scroll)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!naturalSize || savingRef.current) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0022;
      if (Math.abs(delta) < 0.001) return;
      setTransform((prev) =>
        scaleAvatarCropTransformZoom(
          naturalSize.width,
          naturalSize.height,
          prev,
          prev.zoom + delta,
          AVATAR_CROP_VIEWPORT_PX
        )
      );
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [naturalSize]);

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !naturalSize || saving) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events in tests
    }
    const current = layout ?? transform;
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: current.offsetX,
      startOffsetY: current.offsetY,
    };
    setDragging(true);
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId || !naturalSize) return;
    if (
      typeof e.currentTarget.hasPointerCapture === 'function' &&
      !e.currentTarget.hasPointerCapture(e.pointerId)
    ) {
      return;
    }
    const dx = e.clientX - active.startClientX;
    const dy = e.clientY - active.startClientY;
    setTransform((prev) =>
      clampAvatarCropTransform(
        naturalSize.width,
        naturalSize.height,
        {
          zoom: prev.zoom,
          offsetX: active.startOffsetX + dx,
          offsetY: active.startOffsetY + dy,
          rotation: prev.rotation,
        },
        AVATAR_CROP_VIEWPORT_PX
      )
    );
  };

  const endDrag = () => {
    if (dragRef.current) {
      dragRef.current = null;
    }
    setDragging(false);
  };

  const handleReset = useCallback(() => {
    setTransform(DEFAULT_AVATAR_CROP);
    announce(t('avatarCropReset'));
  }, [announce, t]);

  const handleRotate = useCallback(
    (deltaDeg: -90 | 90) => {
      if (!naturalSize || saving) return;
      setTransform((prev) => {
        const next = rotateAvatarCropTransform(
          naturalSize.width,
          naturalSize.height,
          prev,
          deltaDeg,
          AVATAR_CROP_VIEWPORT_PX
        );
        announce(`${next.rotation}°`);
        return next;
      });
    },
    [naturalSize, saving, announce]
  );

  const handleStageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!naturalSize || saving) return;
    const step = e.shiftKey ? KEYBOARD_FINE_PAN_STEP : KEYBOARD_PAN_STEP;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      setTransform((prev) =>
        clampAvatarCropTransform(
          naturalSize.width,
          naturalSize.height,
          {
            zoom: prev.zoom,
            offsetX: prev.offsetX + dx,
            offsetY: prev.offsetY + dy,
            rotation: prev.rotation,
          },
          AVATAR_CROP_VIEWPORT_PX
        )
      );
      return;
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      applyZoom((layout?.zoom ?? transform.zoom) + ZOOM_BUTTON_STEP, true);
      return;
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      applyZoom((layout?.zoom ?? transform.zoom) - ZOOM_BUTTON_STEP, true);
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      handleRotate(e.shiftKey ? -90 : 90);
      return;
    }
    if (e.key === '0') {
      e.preventDefault();
      handleReset();
    }
  };

  const handleCancelClick = () => {
    if (saving) return;
    const dialog = dialogRef.current;
    if (dialog && dialog.open && typeof dialog.close === 'function') {
      dialog.close('cancel');
    } else {
      onClose();
    }
  };

  const handleApplyClick = () => {
    if (saving || !naturalSize) return;
    const finalCrop = clampAvatarCropTransform(
      naturalSize.width,
      naturalSize.height,
      transform,
      AVATAR_CROP_VIEWPORT_PX
    );
    void onConfirm(finalCrop, AVATAR_CROP_VIEWPORT_PX);
  };

  const currentZoom = layout?.zoom ?? transform.zoom;
  const currentRotation = layout?.rotation ?? transform.rotation;
  const zoomPct = Math.round(currentZoom * 100);
  const isDirty =
    Math.abs(currentZoom - AVATAR_CROP_MIN_ZOOM) > 0.005 ||
    Math.abs(layout?.offsetX ?? transform.offsetX) > 0.5 ||
    Math.abs(layout?.offsetY ?? transform.offsetY) > 0.5 ||
    currentRotation !== 0;
  const showGrid = dragging || adjustingZoom;

  const surfaceClass = isDark
    ? 'bg-[#1D1E26] border-white/[0.1] text-[#F2F3F7]'
    : 'bg-white border-black/[0.08] text-[#1D1D1F]';
  const subTextClass = isDark ? 'text-[#989AA6]' : 'text-[#6E6E73]';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={hintId}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className={`avatar-crop-dialog rounded-2xl border shadow-2xl p-0 w-[372px] max-w-[calc(100vw-2rem)] ${surfaceClass}`}
    >
      {/* Header */}
      <header
        className={`flex items-center justify-between px-5 py-3.5 border-b ${
          isDark ? 'border-white/[0.07]' : 'border-black/[0.06]'
        }`}
      >
        <h3 id={titleId} className="text-[14.5px] font-semibold tracking-tight">
          {t('avatarCropTitle')}
        </h3>
        <button
          type="button"
          onClick={handleCancelClick}
          disabled={saving}
          aria-label={t('cancel')}
          className={`w-7 h-7 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${
            isDark
              ? 'text-[#989AA6] hover:text-[#F2F3F7] hover:bg-white/[0.08]'
              : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05]'
          }`}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </header>

      {/* Crop Stage */}
      <div className="px-5 pt-4 pb-3 space-y-3.5">
        <div
          className={`mx-auto rounded-2xl p-3 flex items-center justify-center ${
            isDark ? 'bg-[#121318]' : 'bg-[#181920]'
          }`}
        >
          <div
            ref={stageRef}
            role="button"
            tabIndex={0}
            aria-label={t('avatarCropStageAria')}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onKeyDown={handleStageKeyDown}
            style={{
              width: AVATAR_CROP_VIEWPORT_PX,
              height: AVATAR_CROP_VIEWPORT_PX,
            }}
            className={`avatar-crop-stage relative overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
              dragging ? 'dragging' : ''
            }`}
          >
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                  setTransform(DEFAULT_AVATAR_CROP);
                } else {
                  onImageError?.();
                }
              }}
              onError={() => onImageError?.()}
              style={
                layout
                  ? {
                      width: `${layout.imgWidth}px`,
                      height: `${layout.imgHeight}px`,
                      transformOrigin: 'center center',
                      transform: `translate3d(calc(-50% + ${layout.offsetX}px), calc(-50% + ${layout.offsetY}px), 0)${
                        layout.rotation ? ` rotate(${layout.rotation}deg)` : ''
                      }`,
                    }
                  : {
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'translate3d(-50%, -50%, 0)',
                    }
              }
              className="pointer-events-none select-none absolute left-1/2 top-1/2 max-w-none max-h-none"
            />

            {/* Circular cutout mask & crisp guide ring */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full ring-[1.5px] ring-white/85"
              style={{
                boxShadow: '0 0 0 9999px rgba(10, 12, 18, 0.56)',
              }}
            />

            {/* Subtle rule-of-thirds grid visible while dragging/zooming */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 rounded-full overflow-hidden transition-opacity duration-150 motion-reduce:transition-none ${
                showGrid ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
            </div>
          </div>
        </div>

        <p id={hintId} className={`text-center text-[11.5px] ${subTextClass}`}>
          {t('avatarCropHint')}
        </p>

        {/* Native Range Zoom Controls */}
        <div className="flex items-center gap-2">
          <Tooltip variant="compact" content={t('zoomOutBtn')}>
            <button
              type="button"
              aria-label={t('zoomOutBtn')}
              disabled={saving || currentZoom <= AVATAR_CROP_MIN_ZOOM + 0.001}
              onClick={() => applyZoom(currentZoom - ZOOM_BUTTON_STEP, true)}
              className={`w-7 h-7 rounded-lg shrink-0 inline-flex items-center justify-center cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${
                isDark
                  ? 'text-[#C6C7D2] hover:bg-white/[0.08]'
                  : 'text-[#3A3A3C] hover:bg-black/[0.05]'
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </Tooltip>

          <label htmlFor={zoomSliderId} className="sr-only">
            {t('avatarCropZoomLabel')}
          </label>
          <input
            id={zoomSliderId}
            type="range"
            min={AVATAR_CROP_MIN_ZOOM}
            max={AVATAR_CROP_MAX_ZOOM}
            step={0.01}
            value={currentZoom}
            disabled={saving || !naturalSize}
            aria-valuetext={`${zoomPct}%`}
            onPointerDown={() => setAdjustingZoom(true)}
            onPointerUp={() => setAdjustingZoom(false)}
            onBlur={() => setAdjustingZoom(false)}
            onChange={(e) => applyZoom(Number(e.target.value), false)}
            style={
              {
                '--attr-min': AVATAR_CROP_MIN_ZOOM,
                '--attr-max': AVATAR_CROP_MAX_ZOOM,
                '--control-value': currentZoom,
              } as React.CSSProperties
            }
            className="avatar-crop-slider flex-1 min-w-0"
          />

          <Tooltip variant="compact" content={t('zoomInBtn')}>
            <button
              type="button"
              aria-label={t('zoomInBtn')}
              disabled={saving || currentZoom >= AVATAR_CROP_MAX_ZOOM - 0.001}
              onClick={() => applyZoom(currentZoom + ZOOM_BUTTON_STEP, true)}
              className={`w-7 h-7 rounded-lg shrink-0 inline-flex items-center justify-center cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${
                isDark
                  ? 'text-[#C6C7D2] hover:bg-white/[0.08]'
                  : 'text-[#3A3A3C] hover:bg-black/[0.05]'
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </Tooltip>

          <span className={`w-10 text-end text-[11.5px] font-mono tabular-nums shrink-0 ${subTextClass}`}>
            {zoomPct}%
          </span>
        </div>

        {/* Rotate & Reset Tool Strip */}
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          <Tooltip variant="compact" content={t('avatarCropRotateLeft')}>
            <button
              type="button"
              aria-label={t('avatarCropRotateLeft')}
              disabled={saving || !naturalSize}
              onClick={() => handleRotate(-90)}
              className={`h-7 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[11.5px] font-medium cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${
                isDark
                  ? 'bg-white/[0.05] text-[#D1D1D8] hover:bg-white/[0.1] hover:text-white'
                  : 'bg-black/[0.04] text-[#3A3A3C] hover:bg-black/[0.08] hover:text-[#1D1D1F]'
              }`}
            >
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
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>-90°</span>
            </button>
          </Tooltip>

          <Tooltip variant="compact" content={t('avatarCropRotateRight')}>
            <button
              type="button"
              aria-label={t('avatarCropRotateRight')}
              disabled={saving || !naturalSize}
              onClick={() => handleRotate(90)}
              className={`h-7 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[11.5px] font-medium cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${
                isDark
                  ? 'bg-white/[0.05] text-[#D1D1D8] hover:bg-white/[0.1] hover:text-white'
                  : 'bg-black/[0.04] text-[#3A3A3C] hover:bg-black/[0.08] hover:text-[#1D1D1F]'
              }`}
            >
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
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>+90°</span>
            </button>
          </Tooltip>

          <span
            aria-hidden="true"
            className={`h-4 w-px mx-1 ${isDark ? 'bg-white/[0.1]' : 'bg-black/[0.08]'}`}
          />

          <button
            type="button"
            aria-label={t('avatarCropReset')}
            disabled={saving || !isDirty}
            onClick={handleReset}
            className={`h-7 px-2.5 rounded-lg inline-flex items-center gap-1 text-[11.5px] font-medium cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${
              isDark
                ? 'text-[#989AA6] hover:text-[#F2F3F7] hover:bg-white/[0.08]'
                : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05]'
            }`}
          >
            {t('avatarCropReset')}
          </button>
        </div>
      </div>

      {/* Footer Actions */}
      <footer
        className={`flex items-center justify-between gap-2 px-5 py-3.5 border-t ${
          isDark ? 'border-white/[0.07]' : 'border-black/[0.06]'
        }`}
      >
        <div>
          {onChangePhoto && (
            <button
              type="button"
              disabled={saving}
              onClick={onChangePhoto}
              className="btn-ghost !h-8 !px-2.5 !rounded-lg !text-[12px]"
            >
              {t('avatarCropChangePhoto')}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleCancelClick}
            className="btn-secondary !h-8 !px-3.5 !rounded-lg !text-[12px]"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            autoFocus
            disabled={saving || !naturalSize}
            onClick={handleApplyClick}
            className="btn-primary !h-8 !px-4 !rounded-lg !text-[12px]"
          >
            {t('avatarCropApplyBtn')}
          </button>
        </div>
      </footer>

      {/* Live region for screen reader feedback during keyboard zoom/reset */}
      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>
    </dialog>
  );
};
