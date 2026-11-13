import React, { useEffect, useRef, useState } from 'react';
import { usePresence } from '../../hooks/usePresence';
import { formatShortcut, translate } from '../../i18n/translations';
import { useAppStore } from '../../stores/useAppStore';
import { resolveMediaSrcValue } from '../../utils/mediaUrl';

export interface OcclusionRect {
  id: string;
  clozeIndex: number;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  label?: string;
}

export type OcclusionMode = 'hide-all' | 'hide-one';

/**
 * 原生 Image Occlusion 笔记的载荷。
 *
 * `occlusions` 是 Anki 的 Occlusion 字段原文。原生遮挡卡型仍是 Cloze 基数的卡型，
 * 一个 ordinal 出一张卡；把全部遮罩都写成 `{{c1::…}}`，Anki 会把它们合并成一个
 * shapes 组，于是「一张图 = 一张卡」，不会因为多画几个遮罩就多冒出几张卡。
 */
export interface NativeOcclusionPayload {
  occlusions: string;
  image: string;
  header: string;
  mode: OcclusionMode;
  /** 同一批遮罩的 `.anki-io-wrap` 预览 HTML，用于「重新编辑」时无损还原矩形。 */
  previewHtml: string;
}

interface ImageOcclusionEditorModalProps {
  open: boolean;
  initialFrontHtml: string;
  isDark: boolean;
  brandHex: string;
  mediaBaseUrl?: string;
  onSaveImageFile: (file: File) => Promise<string | null>;
  onClose: () => void;
  onApply: (payload: NativeOcclusionPayload, cardCount: number) => void;
}

/**
 * Parses an existing `.anki-io-wrap` or `<img ...>` from the front HTML so the user
 * can re-open and non-destructively edit existing Image Occlusion rectangles.
 */
export function parseExistingImageOcclusion(rawHtml: string): {
  titleText: string;
  imgSrc: string;
  mediaFilename: string;
  mode: OcclusionMode;
  rects: OcclusionRect[];
} {
  if (!rawHtml) {
    return {
      titleText: '',
      imgSrc: '',
      mediaFilename: '',
      mode: 'hide-all',
      rects: [],
    };
  }

  const mode: OcclusionMode = rawHtml.includes('data-io-mode="hide-one"')
    ? 'hide-one'
    : 'hide-all';

  const imgTagMatch = /<img\b[^>]*>/i.exec(rawHtml);
  let imgSrc = '';
  let mediaFilename = '';
  if (imgTagMatch) {
    const tagStr = imgTagMatch[0];
    const srcM = /\bsrc\s*=\s*(["'])([^"']+)\1/i.exec(tagStr);
    const mediaM = /\bdata-anki-media\s*=\s*(["'])([^"']+)\1/i.exec(tagStr);
    if (srcM) imgSrc = srcM[2];
    if (mediaM) mediaFilename = mediaM[2];
  }

  const rects: OcclusionRect[] = [];
  const rectRegex =
    /<span\b([^>]*?\bclass\s*=\s*["'][^"']*\banki-io-rect\b[^"']*["'][^>]*)>\s*\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}\s*<\/span>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = rectRegex.exec(rawHtml)) !== null) {
    const attrs = match[1] || '';
    const cNum = parseInt(match[2] || '1', 10) || 1;
    const ansLabel = (match[3] || '').trim();
    const leftM = /left\s*:\s*([\d.]+)%/i.exec(attrs);
    const topM = /top\s*:\s*([\d.]+)%/i.exec(attrs);
    const widthM = /width\s*:\s*([\d.]+)%/i.exec(attrs);
    const heightM = /height\s*:\s*([\d.]+)%/i.exec(attrs);
    if (leftM && topM && widthM && heightM) {
      idx += 1;
      rects.push({
        id: `rect-${idx}-${Date.now()}`,
        clozeIndex: cNum,
        leftPct: parseFloat(leftM[1]),
        topPct: parseFloat(topM[1]),
        widthPct: parseFloat(widthM[1]),
        heightPct: parseFloat(heightM[1]),
        label: ansLabel,
      });
    }
  }

  const stripped = rawHtml
    .replace(/<div\b[^>]*?\bclass\s*=\s*["'][^"']*\banki-io-wrap\b[\s\S]*?<\/div>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();

  return {
    titleText: stripped,
    imgSrc,
    mediaFilename,
    mode,
    rects,
  };
}

export function buildImageOcclusionHtml(params: {
  titleText: string;
  imgSrc: string;
  mediaFilename?: string;
  mode: OcclusionMode;
  rects: OcclusionRect[];
  defaultMaskPrefix?: string;
}): string {
  const { titleText, imgSrc, mediaFilename, mode, rects, defaultMaskPrefix = 'Area' } = params;
  const effectiveSrc = mediaFilename || imgSrc;
  const mediaAttr = mediaFilename ? ` data-anki-media="${mediaFilename}"` : '';

  const rectSpans = rects
    .map((r, i) => {
      const l = Math.max(0, Math.min(99, r.leftPct)).toFixed(2);
      const t = Math.max(0, Math.min(99, r.topPct)).toFixed(2);
      const w = Math.max(1, Math.min(100 - r.leftPct, r.widthPct)).toFixed(2);
      const h = Math.max(1, Math.min(100 - r.topPct, r.heightPct)).toFixed(2);
      const labelText = (r.label || `${defaultMaskPrefix} ${i + 1}`).replace(/\}\}/g, '');
      return `<span class="anki-io-rect" data-io-rect="${r.clozeIndex}" style="position:absolute;left:${l}%;top:${t}%;width:${w}%;height:${h}%;">{{c${r.clozeIndex}::${labelText}}}</span>`;
    })
    .join('');

  const ioBlock = `<div class="anki-io-wrap" data-io-mode="${mode}" style="position:relative;display:inline-block;max-width:100%;line-height:0;border-radius:12px;overflow:hidden;"><img src="${effectiveSrc}"${mediaAttr} style="display:block;max-width:100%;height:auto;margin:0;border-radius:12px;" />${rectSpans}</div>`;

  const cleanTitle = titleText.trim();
  if (cleanTitle) {
    return `<div>${cleanTitle}</div><div style="margin-top:8px;">${ioBlock}</div>`;
  }
  return ioBlock;
}

/** 把 imgSrc 收敛成 collection.media 里的裸文件名，Anki 的 <img src> 只认这个。 */
function resolveMediaName(imgSrc: string, mediaFilename?: string): string {
  const direct = (mediaFilename || '').trim();
  if (direct) return direct;
  const raw = (imgSrc || '').trim();
  if (!raw) return '';
  const noQuery = raw.split(/[?#]/)[0];
  const seg = noQuery.split('/').pop() || '';
  return /^[^\\]+\.\w{1,8}$/.test(seg) ? seg : '';
}

/**
 * 生成 Anki 原生 Image Occlusion 的字段内容。
 *
 * 形状与 Anki 自己写出来的一致：
 * `{{c1::image-occlusion:rect:left=.1:top=.2:width=.08:height=.06:oi=1}}`，
 * 坐标是相对底图的 0–1 小数（见 AnkiWeb 上的原生遮挡卡包），Image 字段是一张
 * `<img src="文件名">`。全部遮罩共用 ordinal 1，因此恒定只出 1 张卡。
 */
export function buildNativeOcclusion(params: {
  titleText: string;
  imgSrc: string;
  mediaFilename?: string;
  mode: OcclusionMode;
  rects: OcclusionRect[];
}): NativeOcclusionPayload {
  const { titleText, imgSrc, mediaFilename, mode, rects } = params;

  const mediaName = resolveMediaName(imgSrc, mediaFilename);

  // Anki 原生的 Occlusion 指令，坐标是 0–1 小数（不是 0–100）。
  // 全部遮罩共用 c1：实测同 ordinal 重复 N 次会被 Anki 合并成「1 个组 N 个 shape」，
  // 于是 1 张笔记 = 1 张卡，同时每个遮罩都还在。
  const occlusions = rects
    .map((r) => {
      const l = Math.max(0, Math.min(0.99, r.leftPct / 100));
      const t = Math.max(0, Math.min(0.99, r.topPct / 100));
      const w = Math.max(0.005, Math.min(1 - l, r.widthPct / 100));
      const h = Math.max(0.005, Math.min(1 - t, r.heightPct / 100));
      return (
        `{{c1::image-occlusion:rect:left=${l.toFixed(4)}:top=${t.toFixed(4)}` +
        `:width=${w.toFixed(4)}:height=${h.toFixed(4)}:oi=1}}`
      );
    })
    .join('');

  return {
    occlusions,
    image: mediaName ? `<img src="${mediaName}">` : '',
    header: titleText.trim(),
    mode,
    previewHtml: buildImageOcclusionHtml({ titleText, imgSrc, mediaFilename, mode, rects }),
  };
}

export const ImageOcclusionEditorModal: React.FC<ImageOcclusionEditorModalProps> = ({
  open,
  initialFrontHtml,
  isDark,
  brandHex,
  mediaBaseUrl,
  onSaveImageFile,
  onClose,
  onApply,
}) => {
  const { resolvedLang, envInfo } = useAppStore();
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  // 粘贴快捷键随平台变化：macOS 是 Cmd+V，Windows/Linux 是 Ctrl+V。
  // 文案里写死 Cmd 会让 Windows 用户照着按却没反应（r4 Windows 验版 A8 项）。
  const pasteShortcutStr = formatShortcut('Cmd+V', envInfo.platform);

  const [titleText, setTitleText] = useState('');
  const [imgSrc, setImgSrc] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');
  const [mode, setMode] = useState<OcclusionMode>('hide-all');
  const [rects, setRects] = useState<OcclusionRect[]>([]);
  const [selectedRectId, setSelectedRectId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [interaction, setInteraction] = useState<
    | null
    | {
        type: 'draw';
        startX: number;
        startY: number;
        currX: number;
        currY: number;
      }
    | {
        type: 'move';
        rectId: string;
        startX: number;
        startY: number;
        origLeft: number;
        origTop: number;
      }
  >(null);

  useEffect(() => {
    if (!open) return;
    const parsed = parseExistingImageOcclusion(initialFrontHtml);
    setTitleText(parsed.titleText);
    setImgSrc(resolveMediaSrcValue(parsed.imgSrc, mediaBaseUrl, parsed.mediaFilename));
    setMediaFilename(parsed.mediaFilename);
    setMode(parsed.mode);
    setRects(parsed.rects);
    setSelectedRectId(parsed.rects[0]?.id || null);
    setInteraction(null);
  }, [open, initialFrontHtml, mediaBaseUrl]);

  const handleImageFile = async (file: File) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const htmlTag = await onSaveImageFile(file);
      if (htmlTag) {
        const srcM = /\bsrc\s*=\s*(["'])([^"']+)\1/i.exec(htmlTag);
        const mediaM = /\bdata-anki-media\s*=\s*(["'])([^"']+)\1/i.exec(htmlTag);
        if (srcM) setImgSrc(srcM[2]);
        if (mediaM) setMediaFilename(mediaM[2]);
      }
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const f = item.getAsFile();
          if (f) handleImageFile(f);
          return;
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedRectId) {
        e.preventDefault();
        setRects((prev) => prev.filter((r) => r.id !== selectedRectId));
        setSelectedRectId(null);
      }
    };

    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, selectedRectId]);

  const presence = usePresence(open, 120);
  if (!presence.mounted) return null;

  const getRelativePercent = (clientX: number, clientY: number): { x: number; y: number } => {
    const el = canvasWrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const bounds = el.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
    const x = Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - bounds.top) / bounds.height) * 100));
    return { x, y };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgSrc || e.button !== 0) return;
    e.preventDefault();
    const pt = getRelativePercent(e.clientX, e.clientY);
    setSelectedRectId(null);
    setInteraction({
      type: 'draw',
      startX: pt.x,
      startY: pt.y,
      currX: pt.x,
      currY: pt.y,
    });
  };

  const handleRectMouseDown = (e: React.MouseEvent<HTMLDivElement>, rect: OcclusionRect) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedRectId(rect.id);
    const pt = getRelativePercent(e.clientX, e.clientY);
    setInteraction({
      type: 'move',
      rectId: rect.id,
      startX: pt.x,
      startY: pt.y,
      origLeft: rect.leftPct,
      origTop: rect.topPct,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interaction) return;
    const pt = getRelativePercent(e.clientX, e.clientY);
    if (interaction.type === 'draw') {
      setInteraction({
        ...interaction,
        currX: pt.x,
        currY: pt.y,
      });
    } else if (interaction.type === 'move') {
      const dx = pt.x - interaction.startX;
      const dy = pt.y - interaction.startY;
      setRects((prev) =>
        prev.map((r) => {
          if (r.id !== interaction.rectId) return r;
          const nextLeft = Math.max(0, Math.min(100 - r.widthPct, interaction.origLeft + dx));
          const nextTop = Math.max(0, Math.min(100 - r.heightPct, interaction.origTop + dy));
          return {
            ...r,
            leftPct: nextLeft,
            topPct: nextTop,
          };
        })
      );
    }
  };

  const handleMouseUp = () => {
    if (!interaction) return;
    if (interaction.type === 'draw') {
      const left = Math.min(interaction.startX, interaction.currX);
      const top = Math.min(interaction.startY, interaction.currY);
      const width = Math.abs(interaction.currX - interaction.startX);
      const height = Math.abs(interaction.currY - interaction.startY);

      if (width >= 2.0 && height >= 2.0) {
        const maxCloze = rects.reduce((acc, r) => Math.max(acc, r.clozeIndex), 0);
        const nextIdx = maxCloze + 1;
        const newRect: OcclusionRect = {
          id: `rect-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          clozeIndex: nextIdx,
          leftPct: left,
          topPct: top,
          widthPct: width,
          heightPct: height,
          label: `c${nextIdx}`,
        };
        setRects((prev) => [...prev, newRect]);
        setSelectedRectId(newRect.id);
      }
    }
    setInteraction(null);
  };

  const selectedRect = rects.find((r) => r.id === selectedRectId) || null;
  // 原生遮挡卡型：整张图不管画多少遮罩，都只出 1 张卡（全部遮罩放在同一个挖空组里）。
  const nativeCardCount = rects.length > 0 ? 1 : 0;

  const updateSelectedRectCloze = (newClozeIdx: number) => {
    if (!selectedRectId) return;
    const clamped = Math.max(1, Math.min(20, newClozeIdx));
    setRects((prev) =>
      prev.map((r) => (r.id === selectedRectId ? { ...r, clozeIndex: clamped } : r))
    );
  };

  const handleConfirmApply = () => {
    if (!imgSrc || rects.length === 0) return;
    const payload = buildNativeOcclusion({
      titleText,
      imgSrc,
      mediaFilename,
      mode,
      rects,
    });
    onApply(payload, nativeCardCount);
  };

  const surfaceClass = isDark
    ? 'bg-[#171822] border-[#2C2E3E] text-white'
    : 'bg-white border-[#E5E5EA] text-[#1D1D1F]';

  const subSurface = isDark
    ? 'bg-[#12131B] border-[#282A38]'
    : 'bg-[#F7F7FA] border-[#EAECEF]';

  return (
    <div
      data-state={presence.state}
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none ui-modal-backdrop"
    >
      <div
        data-state={presence.state}
        role="dialog"
        aria-modal="true"
        aria-label={t('ioStudioTitle')}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`w-[780px] max-w-full max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ui-modal-panel ${surfaceClass}`}
      >
        {/* Header */}
        <header
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-[#2A2C3A]' : 'border-[#ECECF2]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">
                {t('ioStudioTitle')}
              </h2>
              <p className="text-[11px] text-[#8E8E93]">
                {t('ioStudioSub')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-current cursor-pointer"
          >
            ✕
          </button>
        </header>

        {/* Toolbar & Mode Controls */}
        <div
          className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-[#13141C] border-[#262836]' : 'bg-[#FAFAFC] border-[#ECECF2]'
          }`}
        >
          {/* Left: Title & Upload */}
          <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
            <input
              type="text"
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              placeholder={t('ioTitlePlaceholder')}
              className={`h-8 px-3 rounded-xl border text-[12px] flex-1 focus:outline-none focus:border-[var(--brand)] ${
                isDark ? 'bg-[#1B1C26] border-[#323444]' : 'bg-white border-[#E2E2EA]'
              }`}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`h-8 px-3 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                isDark
                  ? 'bg-[#1E202C] border-[#343646] hover:border-[var(--brand)] text-[#D8D8E2]'
                  : 'bg-white border-[#E0E0E8] hover:border-[var(--brand)] text-[#3A3A3C]'
              }`}
            >
              <span>{imgSrc ? t('ioChangeImageBtn') : t('ioUploadImageBtn')}</span>
            </button>
          </div>

          {/* Right: Occlusion Mode Selector */}
          <div className="flex items-center gap-1.5">
            <div
              className={`p-0.5 rounded-xl border flex items-center ${
                isDark ? 'bg-[#191A23] border-[#2E303E]' : 'bg-[#EFEFF4] border-[#E2E2EA]'
              }`}
            >
              <button
                type="button"
                onClick={() => setMode('hide-all')}
                title={t('ioModeHideAllBtn')}
                className={`h-7 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all ${
                  mode === 'hide-all'
                    ? 'bg-[var(--brand)] text-white shadow-2xs'
                    : 'text-[#8E8E93] hover:text-current'
                }`}
              >
                {t('ioModeHideAllBtn')}
              </button>
              <button
                type="button"
                onClick={() => setMode('hide-one')}
                title={t('ioModeHideOneBtn')}
                className={`h-7 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all ${
                  mode === 'hide-one'
                    ? 'bg-[var(--brand)] text-white shadow-2xs'
                    : 'text-[#8E8E93] hover:text-current'
                }`}
              >
                {t('ioModeHideOneBtn')}
              </button>
            </div>
          </div>
        </div>

        {/* Main Interactive Canvas Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center min-h-[340px]">
          {!imgSrc ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-[540px] h-[280px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors ${
                isDark
                  ? 'border-[#343648] bg-[#13141C] hover:border-[var(--brand)]'
                  : 'border-[#D8D8E2] bg-[#FAFAFC] hover:border-[var(--brand)]'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center mb-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="text-[14px] font-bold">
                {uploadingImage ? t('processingText') : t('ioEmptyCanvasTitle', { shortcut: pasteShortcutStr })}
              </div>
              <p className="text-[11px] text-[#8E8E93] mt-1.5 max-w-[380px]">
                {t('ioEmptyCanvasSub')}
              </p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center space-y-3">
              {/* Drawing Canvas Container */}
              <div
                ref={canvasWrapRef}
                onMouseDown={handleCanvasMouseDown}
                className="relative inline-block max-w-full rounded-xl overflow-hidden shadow-lg border border-black/10 dark:border-white/10 cursor-crosshair select-none"
              >
                <img
                  src={imgSrc}
                  alt="Occlusion target"
                  draggable={false}
                  className="block max-w-full max-h-[420px] w-auto h-auto pointer-events-none select-none"
                />

                {/* Existing Occlusion Rectangles */}
                {rects.map((r) => {
                  const isSelected = r.id === selectedRectId;
                  return (
                    <div
                      key={r.id}
                      onMouseDown={(e) => handleRectMouseDown(e, r)}
                      style={{
                        left: `${r.leftPct}%`,
                        top: `${r.topPct}%`,
                        width: `${r.widthPct}%`,
                        height: `${r.heightPct}%`,
                      }}
                      className={`absolute rounded-md flex items-center justify-center cursor-move transition-shadow ${
                        isSelected
                          ? 'bg-[#F59E0B]/85 border-2 border-white shadow-[0_0_0_2px_#F59E0B,0_6px_16px_rgba(245,158,11,0.5)] z-20'
                          : 'bg-[#F59E0B]/68 hover:bg-[#F59E0B]/80 border-[1.5px] border-white/90 shadow-xs z-10'
                      }`}
                    >
                      <span className="px-1.5 py-0.5 rounded bg-black/45 text-white font-mono text-[11px] font-bold leading-none pointer-events-none">
                        c{r.clozeIndex}
                      </span>

                      {isSelected && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setRects((prev) => prev.filter((item) => item.id !== r.id));
                            setSelectedRectId(null);
                          }}
                          title={t('batchDelete')}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#EF4444] text-white text-[11px] font-bold flex items-center justify-center shadow-md cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Active Drawing Rubberband Preview */}
                {interaction?.type === 'draw' && (
                  <div
                    style={{
                      left: `${Math.min(interaction.startX, interaction.currX)}%`,
                      top: `${Math.min(interaction.startY, interaction.currY)}%`,
                      width: `${Math.abs(interaction.currX - interaction.startX)}%`,
                      height: `${Math.abs(interaction.currY - interaction.startY)}%`,
                    }}
                    className="absolute rounded-md bg-[var(--brand)]/40 border-2 border-dashed border-white pointer-events-none z-30"
                  />
                )}
              </div>

              {/* Selected Rectangle Quick Inspector & Batch Controls */}
              <div
                className={`w-full rounded-2xl border px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[12px] ${subSurface}`}
              >
                {selectedRect ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-[var(--brand-text)]">
                      {t('ioSelectedMaskLabel')}
                    </span>

                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5, 6].map((cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => updateSelectedRectCloze(cIdx)}
                          className={`h-6 px-2 rounded-lg font-mono text-[11px] cursor-pointer transition-colors ${
                            selectedRect.clozeIndex === cIdx
                              ? 'bg-[var(--brand)] text-white font-bold'
                              : 'bg-black/5 dark:bg-white/5 text-[#8E8E93] hover:text-current'
                          }`}
                        >
                          c{cIdx}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={selectedRect.label || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRects((prev) =>
                          prev.map((r) => (r.id === selectedRect.id ? { ...r, label: val } : r))
                        );
                      }}
                      placeholder="..."
                      className={`h-7 px-2.5 rounded-lg border text-[11px] w-36 focus:outline-none focus:border-[var(--brand)] ${
                        isDark ? 'bg-[#1A1B24] border-[#323444]' : 'bg-white border-[#E2E2EA]'
                      }`}
                    />
                  </div>
                ) : (
                  <span className="text-[11px] text-[#8E8E93]">
                    {t('ioCanvasHintText')}
                  </span>
                )}

                <div className="flex items-center gap-2 ms-auto">
                  <button
                    type="button"
                    disabled={rects.length === 0}
                    onClick={() => {
                      setRects((prev) => prev.slice(0, -1));
                      setSelectedRectId(null);
                    }}
                    className="h-7 px-2.5 rounded-lg border border-black/10 dark:border-white/10 text-[11px] text-[#8E8E93] hover:text-current disabled:opacity-40 cursor-pointer"
                  >
                    {t('undoBtnShort')}
                  </button>
                  <button
                    type="button"
                    disabled={rects.length === 0}
                    onClick={() => {
                      setRects([]);
                      setSelectedRectId(null);
                    }}
                    className="h-7 px-2.5 rounded-lg border border-black/10 dark:border-white/10 text-[11px] text-[var(--status-danger)] hover:bg-[var(--status-danger-soft)] disabled:opacity-40 cursor-pointer"
                  >
                    {t('clearSearchBtn')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer
          className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${
            isDark ? 'bg-[#13141C] border-[#262836]' : 'bg-[#FAFAFC] border-[#ECECF2]'
          }`}
        >
          <div className="text-[12px] text-[#8E8E93]">
            {rects.length > 0 ? (
              <span>
                {t('ioMasksCountSummary', { rects: rects.length, cards: nativeCardCount })}
              </span>
            ) : (
              <span>{t('ioDrawAtLeastOneHint')}</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary !h-9 !px-4 !text-[12px]"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={!imgSrc || rects.length === 0}
              onClick={handleConfirmApply}
              style={{ backgroundColor: brandHex }}
              className="btn-primary !h-9 !px-5 !text-[12px] disabled:opacity-45"
            >
              {t('ioApplyBtn', { cards: nativeCardCount })}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
