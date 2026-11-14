import React, { useCallback, useEffect, useRef, useState } from 'react';
import { translate } from '../../i18n/translations';
import { useAppStore } from '../../stores/useAppStore';
import { Tooltip } from '../common/Tooltip';

export type LightboxTarget =
  | { mode: 'img'; src: string; alt?: string }
  | { mode: 'io-html'; html: string };

interface ReviewerImageLightboxProps {
  target: LightboxTarget;
  onClose: () => void;
}

const MIN_SCALE = 0.75;
const MAX_SCALE = 5.0;

/**
 * Full-viewport Pan-and-Zoom Lightbox for mind maps, diagrams, and Image Occlusion cards.
 */
export const ReviewerImageLightbox: React.FC<ReviewerImageLightboxProps> = ({
  target,
  onClose,
}) => {
  const { resolvedLang } = useAppStore();
  const t = (key: any) => translate(resolvedLang, key);

  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const movedDuringDragRef = useRef(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [target]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        movedDuringDragRef.current = true;
      }
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    };

    const onMouseUp = () => {
      dragStartRef.current = null;
      setIsDragging(false);
      // Reset drag flag slightly later so click handlers on the same tick can inspect it.
      window.setTimeout(() => {
        movedDuringDragRef.current = false;
      }, 40);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const stepZoom = useCallback((delta: number) => {
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((prev + delta).toFixed(2))));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = backdropRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const cursorDx = e.clientX - cx;
    const cursorDy = e.clientY - cy;

    const factor = e.deltaY < 0 ? 1.16 : 1 / 1.16;
    setScale((prevScale) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((prevScale * factor).toFixed(3))));
      if (nextScale === prevScale) return prevScale;
      const ratio = nextScale / prevScale;
      setPan((prevPan) => ({
        x: cursorDx - (cursorDx - prevPan.x) * ratio,
        y: cursorDy - (cursorDy - prevPan.y) * ratio,
      }));
      return nextScale;
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    movedDuringDragRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsDragging(true);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (Math.abs(scale - 1) > 0.05) {
      resetView();
      return;
    }
    const nextScale = 2.25;
    const rect = backdropRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const cursorDx = e.clientX - cx;
    const cursorDy = e.clientY - cy;
    setScale(nextScale);
    setPan({
      x: cursorDx * (1 - nextScale),
      y: cursorDy * (1 - nextScale),
    });
  };

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('reviewImageZoomHint')}
      onWheel={handleWheel}
      onClick={(e) => {
        if (movedDuringDragRef.current) return;
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[120] bg-black/82 backdrop-blur-md flex items-center justify-center overflow-hidden select-none"
    >
      {/* Top-Right Close Button */}
      <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="fixed top-5 end-5 z-[130] w-10 h-10 rounded-full bg-white/12 hover:bg-white/22 border border-white/15 text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </Tooltip>

      {/* Interactive Pan/Zoom Media Stage */}
      <div
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleCanvasDoubleClick}
        onDragStart={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 120ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`max-w-[90vw] max-h-[84vh] flex items-center justify-center origin-center ${
          isDragging ? 'cursor-grabbing' : scale > 1.02 ? 'cursor-grab' : 'cursor-zoom-in'
        }`}
      >
        {target.mode === 'img' ? (
          <img
            src={target.src}
            alt={target.alt || ''}
            draggable={false}
            className="max-w-[88vw] max-h-[82vh] w-auto h-auto object-contain rounded-xl shadow-2xl bg-white/5"
          />
        ) : (
          <div
            className="rounded-xl shadow-2xl overflow-hidden [&_.anki-io-wrap]:!m-0 [&_.anki-io-wrap_img]:!max-h-[82vh] [&_.anki-io-wrap_img]:!max-w-[88vw] [&_.anki-io-wrap_img]:!w-auto [&_.anki-io-wrap_img]:!h-auto"
            dangerouslySetInnerHTML={{ __html: target.html }}
          />
        )}
      </div>

      {/* Bottom Control Dock */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] flex flex-col items-center gap-2"
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181922]/90 border border-white/15 text-white shadow-2xl backdrop-blur-xl">
          <Tooltip variant="compact" content={t('zoomOutBtn')} shortcut="-">
            <button
              type="button"
              onClick={() => stepZoom(-0.25)}
              disabled={scale <= MIN_SCALE}
              aria-label={t('zoomOutBtn')}
              className="w-7 h-7 rounded-full hover:bg-white/15 disabled:opacity-35 flex items-center justify-center text-[15px] font-semibold cursor-pointer transition-colors"
            >
              −
            </button>
          </Tooltip>
          <span className="min-w-[52px] text-center text-[12px] font-mono tabular-nums text-white/90">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip variant="compact" content={t('zoomInBtn')} shortcut="+">
            <button
              type="button"
              onClick={() => stepZoom(0.25)}
              disabled={scale >= MAX_SCALE}
              aria-label={t('zoomInBtn')}
              className="w-7 h-7 rounded-full hover:bg-white/15 disabled:opacity-35 flex items-center justify-center text-[15px] font-semibold cursor-pointer transition-colors"
            >
              +
            </button>
          </Tooltip>
          <div className="w-[1px] h-4 bg-white/15 mx-0.5" />
          <button
            type="button"
            onClick={resetView}
            className="px-2.5 py-1 rounded-full hover:bg-white/15 text-[11px] font-medium text-white/90 cursor-pointer transition-colors whitespace-nowrap"
          >
            {t('lightboxResetBtn')}
          </button>
        </div>
        <span className="text-[11px] text-white/70 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm whitespace-nowrap">
          {t('lightboxCloseHint')}
        </span>
      </div>
    </div>
  );
};
