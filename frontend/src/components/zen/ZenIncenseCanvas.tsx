import React, { useEffect, useRef } from 'react';

export interface ZenIncenseHoverInfo {
  hovered: boolean;
  x: number;
  y: number;
  remainingMs: number;
  paused: boolean;
}

export interface ZenIncenseCanvasProps {
  /** 'ritual' = interactive incense ceremony; 'ambient' = courtyard stick on Zen Home; 'review' = 15-min desk timekeeper. */
  mode: 'ritual' | 'ambient' | 'review';
  /** Whether the incense ember is currently lit. */
  lit: boolean;
  /** Light vs dark surface polarity ('白的就是白的，黑的就是黑的'). */
  isDark?: boolean;
  /** Fixed burn-down duration in ms for 'review' mode (defaults to 15 minutes). */
  burnDurationMs?: number;
  /** In 'ambient' mode, smoothly glides the stick from bottom-center to bottom-right as review begins. */
  glideToReview?: boolean;
  /** Incremented on rapid clicking / card skipping to trigger a subtle "心静则烟直" smoke sway. */
  agitationSignal?: number;
  /** In 'review' mode, set true once the user finishes their final card after burn-out so ember cools & last wisp fades. */
  extinguished?: boolean;
  /** Fires once when the 15-minute burn reaches 0 in 'review' mode. */
  onBurnComplete?: () => void;
  /** Reports hover state & remaining time for the subtle calligraphic whisper label in 'review' mode. */
  onHoverInfoChange?: (info: ZenIncenseHoverInfo | null) => void;
  /** Optional key that changes when review stage width or active card changes, triggering desk-clearance re-measure without resetting burn progress. */
  stageClearanceKey?: string;
  className?: string;
}

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  radiusStart: number;
  radiusEnd: number;
  alphaPeak: number;
  seed: number;
  driftAmp: number;
  kind: 'wisp' | 'curl';
}

interface EmberSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  size: number;
}

interface SpineNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  disturbance: number;
}

interface FallingAshFlake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  len: number;
  seed: number;
}

interface SmokeHandoffSnapshot {
  spine: SpineNode[];
  puffs: SmokePuff[];
  cx: number;
  tipY: number;
  timestamp: number;
}

// Preserves the live smoke ribbon & upper curls seamlessly across Ritual -> Home -> Review mounts
let handoffSmokeSnapshot: SmokeHandoffSnapshot | null = null;

// Deterministic fallen ash segments & grains nested inside the dish arc as burnProgress advances 0 -> 1
const FALLEN_ASH_PIECES: ReadonlyArray<{
  threshold: number;
  ox: number;
  oy: number;
  len: number;
  angle: number;
  width: number;
  segment: boolean;
}> = [
  { threshold: 0.05, ox: -4.2, oy: 1.5, len: 3.0, angle: 0.24, width: 1.35, segment: true },
  { threshold: 0.11, ox: 3.6, oy: 1.9, len: 1.0, angle: 0, width: 1.0, segment: false },
  { threshold: 0.18, ox: 6.4, oy: 1.2, len: 3.4, angle: -0.32, width: 1.4, segment: true },
  { threshold: 0.25, ox: -7.8, oy: 0.9, len: 1.1, angle: 0, width: 1.0, segment: false },
  { threshold: 0.32, ox: -1.8, oy: 2.3, len: 3.8, angle: 0.12, width: 1.5, segment: true },
  { threshold: 0.39, ox: 8.8, oy: 0.7, len: 0.95, angle: 0, width: 0.95, segment: false },
  { threshold: 0.46, ox: 2.4, oy: 0.6, len: 3.6, angle: -0.18, width: 1.45, segment: true },
  { threshold: 0.53, ox: -5.6, oy: 0.3, len: 3.2, angle: 0.38, width: 1.4, segment: true },
  { threshold: 0.6, ox: 5.2, oy: 2.1, len: 1.15, angle: 0, width: 1.15, segment: false },
  { threshold: 0.67, ox: -9.8, oy: 0.6, len: 2.8, angle: 0.46, width: 1.3, segment: true },
  { threshold: 0.74, ox: 0.8, oy: -0.4, len: 4.0, angle: -0.08, width: 1.55, segment: true },
  { threshold: 0.81, ox: 10.6, oy: 0.4, len: 2.9, angle: -0.42, width: 1.3, segment: true },
  { threshold: 0.88, ox: -3.2, oy: -0.7, len: 3.5, angle: 0.2, width: 1.5, segment: true },
  { threshold: 0.94, ox: 4.0, oy: -0.5, len: 3.3, angle: -0.22, width: 1.45, segment: true },
];

export const INCENSE_ASCENT_MS = 1050;
export const INCENSE_RING_FORM_MS = 1800;
export const INK_START_MS = 950;
export const INCENSE_RING_COMPLETE_MS = INK_START_MS + INCENSE_RING_FORM_MS;
export const ZEN_INCENSE_BURN_DURATION_MS = 15 * 60 * 1000;

const BELL_WAVE_START_MS = INCENSE_RING_COMPLETE_MS - 30; // 2720ms — locked to exact singing-bowl strike frame
// Three harmonic bronze-bowl acoustic waves (all complete within 2480ms < 2550ms Act-3 hold so nothing is clipped)
const BELL_ACOUSTIC_WAVES: ReadonlyArray<{
  delayMs: number;
  durationMs: number;
  rStart: number;
  rEnd: number;
  widthStart: number;
  widthEnd: number;
  peakAlpha: number;
  bandWidth: number;
}> = [
  { delayMs: 0, durationMs: 1850, rStart: 62, rEnd: 235, widthStart: 1.55, widthEnd: 0.45, peakAlpha: 0.34, bandWidth: 16 },
  { delayMs: 250, durationMs: 2000, rStart: 64, rEnd: 280, widthStart: 1.25, widthEnd: 0.38, peakAlpha: 0.24, bandWidth: 18 },
  { delayMs: 520, durationMs: 1960, rStart: 66, rEnd: 325, widthStart: 1.0, widthEnd: 0.32, peakAlpha: 0.16, bandWidth: 20 },
];

const SMOKE_TOTAL_JOURNEY_MS = 2650;
const ASCENT_JOURNEY_SPLIT = 0.4;
const IDLE_PAUSE_MS = 90_000; // Pause burn after 90s of no interaction
const FINAL_MINUTE_MS = 60_000;
const GLIDE_DURATION_MS = 1080;

const START_THETA = (-92 * Math.PI) / 180;
const FULL_SWEEP_RAD = (346 * Math.PI) / 180;
const TWO_PI = Math.PI * 2;
const ENSO_BOX_SIZE = 156;

const WIND_RADIUS = 112;
const HOVER_EDDY_RADIUS = 64;

const radialMistSpriteCache = new Map<string, HTMLCanvasElement>();

function createRadialMistSprite(
  r: number,
  g: number,
  b: number,
  coreOpacity = 0.85
): HTMLCanvasElement {
  const key = `${r},${g},${b},${coreOpacity}`;
  const cached = radialMistSpriteCache.get(key);
  if (cached) return cached;
  const size = 96;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const sctx = sprite.getContext('2d');
  if (sctx) {
    const grad = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${coreOpacity})`);
    grad.addColorStop(0.32, `rgba(${r}, ${g}, ${b}, ${coreOpacity * 0.46})`);
    grad.addColorStop(0.68, `rgba(${r}, ${g}, ${b}, ${coreOpacity * 0.14})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);
  }
  radialMistSpriteCache.set(key, sprite);
  return sprite;
}

function easeCalligraphicOrbit(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const sineEase = -(Math.cos(Math.PI * clamped) - 1) * 0.5;
  const cubicOut = 1 - Math.pow(1 - clamped, 2.2);
  return sineEase * 0.62 + cubicOut * 0.38;
}

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function evaluateAscentCurve(
  u: number,
  cx: number,
  tipY: number,
  ensoCy: number,
  ensoRadius: number
): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, u));
  const inv = 1 - t;
  const inv2 = inv * inv;
  const inv3 = inv2 * inv;
  const inv4 = inv3 * inv;
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;

  const endX = cx + Math.cos(START_THETA) * ensoRadius;
  const endY = ensoCy + Math.sin(START_THETA) * ensoRadius;
  const tanX = -Math.sin(START_THETA);
  const tanY = Math.cos(START_THETA);

  const q0x = cx;
  const q0y = tipY;
  const q1x = cx - ensoRadius * 0.12;
  const q1y = tipY - (tipY - ensoCy) * 0.38;
  const q2x = cx - ensoRadius * 2.08;
  const q2y = ensoCy + ensoRadius * 0.36;
  const q3x = endX - tanX * ensoRadius * 1.48;
  const q3y = endY - tanY * ensoRadius * 1.48;
  const q4x = endX;
  const q4y = endY;

  return {
    x: inv4 * q0x + 4 * inv3 * t * q1x + 6 * inv2 * t2 * q2x + 4 * inv * t3 * q3x + t4 * q4x,
    y: inv4 * q0y + 4 * inv3 * t * q1y + 6 * inv2 * t2 * q2y + 4 * inv * t3 * q3y + t4 * q4y,
  };
}

/**
 * Computes smooth visibility (0..1) for the review desk incense stick based on free horizontal
 * margin beside `.zen-card-paper`. When windows are narrow (half-screen) or cards widen to
 * 840px/1120px, the stick softly fades out instead of overlapping card text or images.
 */
export function resolveReviewIncenseVisibility(sideSpacePx: number): number {
  if (!Number.isFinite(sideSpacePx)) return 1;
  if (sideSpacePx >= 116) return 1;
  if (sideSpacePx <= 88) return 0;
  return (sideSpacePx - 88) / 28;
}

/**
 * Computes the horizontal anchor for the review incense stick so it sits centered in the open
 * desk margin and never crowds or clips against `.zen-card-paper`.
 */
export function resolveReviewIncenseX(
  width: number,
  sideSpacePx: number | null,
  isRtl: boolean
): number {
  const defaultMarginX = Math.max(76, Math.min(136, Math.round(width * 0.09)));
  const marginX =
    sideSpacePx !== null && Number.isFinite(sideSpacePx)
      ? Math.max(44, Math.min(defaultMarginX, Math.round(sideSpacePx * 0.48)))
      : defaultMarginX;
  return isRtl ? marginX : width - marginX;
}

export interface IncenseFrameBudgetInput {
  mode: 'ritual' | 'ambient' | 'review';
  hidden: boolean;
  windowFocused: boolean;
  isIdle: boolean;
  isGliding: boolean;
  isFullyExtinguished: boolean;
}

/**
 * Laptop power-saving frame budget for ZenIncenseCanvas:
 * - `null`: completely suspend RAF (0% CPU/GPU when hidden or fully extinguished).
 * - `0`: full native refresh rate (interactive ritual, Home->Review glide, or active study).
 * - `66`: ~15fps gentle smolder when blurred or idle >= 90s (~75% fewer Canvas 2D draws).
 */
export function resolveIncenseFrameIntervalMs({
  mode,
  hidden,
  windowFocused,
  isIdle,
  isGliding,
  isFullyExtinguished,
}: IncenseFrameBudgetInput): number | null {
  if (hidden) return null;
  if (mode === 'review' && isFullyExtinguished) return null;
  if (mode === 'ritual' || isGliding) return 0;
  if (!windowFocused || isIdle) return 66;
  return 0;
}

/** Computes consistent review-desk coordinates shared by both ZenReviewView and the Home→Review glide. */
function computeReviewGeometry(width: number, height: number, sideSpacePx: number | null = null) {
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const cx = resolveReviewIncenseX(width, sideSpacePx, isRtl);
  // Aligns the dish bottom rim (baseY + 3.5) with footer.zen-review-dock (pb-10 = 40px from bottom)
  const baseY = height - 43.5;
  const totalStickH = Math.min(168, Math.max(114, Math.round(height * 0.21)));
  return { cx, baseY, totalStickH };
}

function computeHomeGeometry(width: number, height: number) {
  const cx = width * 0.5;
  const baseY = height - 28;
  const totalStickH = Math.min(132, Math.max(92, Math.round(height * 0.18)));
  return { cx, baseY, totalStickH };
}

/**
 * Song-dynasty scholar's incense object & slender fluid smoke engine.
 * - Ceramic holder base hint & fallen ash mound so the stick is anchored as a real object.
 * - Two-segment stick: exposed pale bamboo core (bottom 22%, constant) + dark sandalwood body (top 78%, burns down).
 * - Three-layer breathing ember: pale ash cap (top) + incandescent-to-tangerine coal (middle) + 5s breathing halo (outer).
 * - Single slender laminar-to-curling silk smoke thread ("一缕细烟") with mouse-breeze disturbance & "心静则烟直" agitation sway.
 * - Auto-pause on background/blur/idle, final-minute taper, graceful hover readout, and Home→Review spatial handoff.
 */
export const ZenIncenseCanvas: React.FC<ZenIncenseCanvasProps> = ({
  mode,
  lit,
  isDark = false,
  burnDurationMs = ZEN_INCENSE_BURN_DURATION_MS,
  glideToReview = false,
  agitationSignal = 0,
  extinguished = false,
  onBurnComplete,
  onHoverInfoChange,
  stageClearanceKey,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const litRef = useRef(lit);
  const litTimestampRef = useRef<number | null>(
    lit && typeof performance !== 'undefined' ? performance.now() : null
  );
  const glideStartRef = useRef<number | null>(null);
  const agitationEnergyRef = useRef(0);
  const extinguishedRef = useRef(extinguished);
  const extinguishTimestampRef = useRef<number | null>(null);
  const onBurnCompleteRef = useRef(onBurnComplete);
  const onHoverInfoChangeRef = useRef(onHoverInfoChange);
  const remeasureLayoutRef = useRef<(() => void) | null>(null);
  const wakeLoopRef = useRef<(() => void) | null>(null);

  onBurnCompleteRef.current = onBurnComplete;
  onHoverInfoChangeRef.current = onHoverInfoChange;

  useEffect(() => {
    const wasLit = litRef.current;
    litRef.current = lit;
    if (lit && !wasLit && typeof performance !== 'undefined') {
      litTimestampRef.current = performance.now();
      wakeLoopRef.current?.();
    } else if (!lit) {
      litTimestampRef.current = null;
    }
  }, [lit]);

  useEffect(() => {
    if (glideToReview && glideStartRef.current === null && typeof performance !== 'undefined') {
      glideStartRef.current = performance.now();
      wakeLoopRef.current?.();
    } else if (!glideToReview) {
      glideStartRef.current = null;
    }
  }, [glideToReview]);

  useEffect(() => {
    if (agitationSignal > 0) {
      agitationEnergyRef.current = Math.min(1, agitationEnergyRef.current + 0.58);
    }
  }, [agitationSignal]);

  useEffect(() => {
    const wasExtinguished = extinguishedRef.current;
    extinguishedRef.current = extinguished;
    if (extinguished && !wasExtinguished && typeof performance !== 'undefined') {
      extinguishTimestampRef.current = performance.now();
    } else if (!extinguished) {
      extinguishTimestampRef.current = null;
      if (wasExtinguished) {
        wakeLoopRef.current?.();
      }
    }
  }, [extinguished]);

  useEffect(() => {
    if (mode !== 'review' || typeof window === 'undefined') return;
    remeasureLayoutRef.current?.();
    const followUp = window.setTimeout(() => {
      remeasureLayoutRef.current?.();
    }, 220);
    return () => {
      window.clearTimeout(followUp);
    };
  }, [mode, stageClearanceKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced && mode === 'ambient') {
      return;
    }

    const isRitual = mode === 'ritual';
    const isReview = mode === 'review';
    const effectiveBurnMs = Math.max(1000, burnDurationMs);

    const smokeRgb: [number, number, number] = isDark
      ? [226, 232, 242]
      : isRitual
      ? [72, 78, 88]
      : [76, 82, 92];

    const smokeSprite = createRadialMistSprite(smokeRgb[0], smokeRgb[1], smokeRgb[2], 0.85);

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let reviewDockBaseY: number | null = null;
    let reviewSideSpace: number | null = null;
    let deskClearanceVisual = 1;
    let suspendLoopFn: (() => void) | null = null;

    const ensoPixelSize = Math.round(ENSO_BOX_SIZE * 2);
    const ensoSourceCanvas = document.createElement('canvas');
    ensoSourceCanvas.width = ensoPixelSize;
    ensoSourceCanvas.height = ensoPixelSize;
    const ensoSourceCtx = ensoSourceCanvas.getContext('2d');

    const ensoCompositeCanvas = document.createElement('canvas');
    ensoCompositeCanvas.width = ensoPixelSize;
    ensoCompositeCanvas.height = ensoPixelSize;
    const ensoCompositeCtx = ensoCompositeCanvas.getContext('2d');

    let ensoImageReady = false;
    if (isRitual) {
      const ensoImg = new Image();
      ensoImg.onload = () => {
        if (!ensoSourceCtx) return;
        ensoSourceCtx.clearRect(0, 0, ensoPixelSize, ensoPixelSize);
        ensoSourceCtx.drawImage(ensoImg, 0, 0, ensoPixelSize, ensoPixelSize);
        ensoSourceCtx.globalCompositeOperation = 'source-in';
        ensoSourceCtx.fillStyle = isDark
          ? 'rgba(238, 234, 224, 0.84)'
          : 'rgba(30, 29, 27, 0.86)';
        ensoSourceCtx.fillRect(0, 0, ensoPixelSize, ensoPixelSize);
        ensoSourceCtx.globalCompositeOperation = 'source-over';
        ensoImageReady = true;
      };
      ensoImg.src = './assets/zen-enso-open-2x.webp';
    }

    const measureReviewDockBaseY = (canvasRect: DOMRect) => {
      if (!isReview || typeof document === 'undefined') return null;
      const dockBtn = document.querySelector('.zen-review-dock button');
      if (!dockBtn) return null;
      const btnRect = dockBtn.getBoundingClientRect();
      if (btnRect.height <= 0) return null;
      // Dish rim arc bottom edge sits at baseY + 3.5px
      return btnRect.bottom - canvasRect.top - 3.5;
    };

    const measureReviewSideSpace = (canvasRect: DOMRect): number | null => {
      if (!isReview || typeof document === 'undefined') return null;
      const cardEl = document.querySelector('.zen-card-paper');
      if (!cardEl) {
        return Math.max(0, (canvasRect.width - 600) * 0.5);
      }
      const cardRect = cardEl.getBoundingClientRect();
      if (cardRect.width <= 0) return null;
      const isRtl = document.documentElement.dir === 'rtl';
      return Math.max(0, isRtl ? cardRect.left - canvasRect.left : canvasRect.right - cardRect.right);
    };

    const remeasureReviewLayout = () => {
      if (!isReview) return;
      const rect = canvas.getBoundingClientRect();
      reviewDockBaseY = measureReviewDockBaseY(rect);
      reviewSideSpace = measureReviewSideSpace(rect);
    };
    remeasureLayoutRef.current = remeasureReviewLayout;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width || window.innerWidth);
      height = Math.max(1, rect.height || window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      reviewDockBaseY = measureReviewDockBaseY(rect);
      reviewSideSpace = measureReviewSideSpace(rect);
      if (isReview && reviewSideSpace !== null) {
        deskClearanceVisual = resolveReviewIncenseVisibility(reviewSideSpace);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let cardResizeObserver: ResizeObserver | null = null;
    if (isReview && typeof ResizeObserver !== 'undefined') {
      const observedCard = document.querySelector('.zen-card-paper');
      if (observedCard) {
        cardResizeObserver = new ResizeObserver(() => {
          remeasureReviewLayout();
        });
        cardResizeObserver.observe(observedCard);
      }
    }

    // Pause & activity tracking for 'review' mode (pauses burn when backgrounded, blurred, or idle >= 90s)
    let accumulatedBurnMs = 0;
    let burnCompletedFired = false;
    let windowFocused = typeof document !== 'undefined' ? !document.hidden : true;
    let lastActivityTime = performance.now();
    let pauseVisual = 1; // 1 = active burning, 0.2 = paused dim smolder

    const markActivity = () => {
      lastActivityTime = performance.now();
      wakeLoopRef.current?.();
    };

    const pointer = {
      x: -9999,
      y: -9999,
      vx: 0,
      vy: 0,
      active: false,
      lastMoveTime: 0,
    };

    const onPointerMove = (e: PointerEvent) => {
      markActivity();
      const rect = canvas.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      const now = performance.now();
      if (pointer.active) {
        const dtMove = Math.max(0.004, Math.min(0.1, (now - pointer.lastMoveTime) / 1000));
        const instVx = Math.max(-1400, Math.min(1400, (nx - pointer.x) / dtMove));
        const instVy = Math.max(-1400, Math.min(1400, (ny - pointer.y) / dtMove));
        pointer.vx = pointer.vx * 0.42 + instVx * 0.58;
        pointer.vy = pointer.vy * 0.42 + instVy * 0.58;
      }
      pointer.x = nx;
      pointer.y = ny;
      pointer.active = true;
      pointer.lastMoveTime = now;
    };

    const onPointerLeave = () => {
      pointer.active = false;
      pointer.vx = 0;
      pointer.vy = 0;
    };

    const onWindowBlur = () => {
      windowFocused = false;
      onPointerLeave();
    };

    const onWindowFocus = () => {
      windowFocused = true;
      markActivity();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        windowFocused = true;
        markActivity();
      } else {
        windowFocused = false;
        suspendLoopFn?.();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const drawHolderAndStick = (
      cx: number,
      baseY: number,
      totalStickH: number,
      burnProgress: number,
      opacityScale: number
    ) => {
      const bambooH = Math.round(totalStickH * 0.22);
      const incenseFullH = Math.max(20, totalStickH - bambooH);
      const jointY = baseY - bambooH;
      const currentIncenseH = incenseFullH * Math.max(0, 1 - burnProgress);
      const tipY = jointY - currentIncenseH;

      // 1. Minimalist Song-style ceramic incense holder hint + subtle contact shadow
      ctx.save();
      ctx.globalAlpha = opacityScale;

      // Soft contact shadow on the desk
      const shadowGrad = ctx.createRadialGradient(cx, baseY + 3.5, 1, cx, baseY + 3.5, 22);
      shadowGrad.addColorStop(
        0,
        isDark ? 'rgba(0, 0, 0, 0.48)' : 'rgba(42, 34, 26, 0.14)'
      );
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 3.5, 22, 4.5, 0, 0, TWO_PI);
      ctx.fill();

      // Delicate short shallow arc hinting at a celadon/stone incense dish rim
      ctx.beginPath();
      ctx.moveTo(cx - 17, baseY + 0.5);
      ctx.quadraticCurveTo(cx, baseY + 5.2, cx + 17, baseY + 0.5);
      ctx.strokeStyle = isDark
        ? 'rgba(196, 190, 178, 0.28)'
        : 'rgba(116, 102, 86, 0.34)';
      ctx.lineWidth = 1.25;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Growing mound of pale fallen incense ash inside the dish as the stick burns down
      const ashLevel = isReview ? Math.max(0, Math.min(1, burnProgress)) : 0.08;
      const moundRx = 4.6 + ashLevel * 10.8;
      const moundRy = 1.5 + ashLevel * 3.7;
      const moundY = baseY + 1.15 - ashLevel * 1.45;
      const ashCoreAlpha = (isDark ? 0.36 : 0.44) + ashLevel * (isDark ? 0.32 : 0.36);
      const ashMoundGrad = ctx.createRadialGradient(
        cx,
        moundY - moundRy * 0.2,
        0.6,
        cx,
        moundY + 0.4,
        moundRx
      );
      ashMoundGrad.addColorStop(
        0,
        isDark
          ? `rgba(204, 200, 192, ${ashCoreAlpha})`
          : `rgba(174, 168, 158, ${ashCoreAlpha})`
      );
      ashMoundGrad.addColorStop(
        0.62,
        isDark
          ? `rgba(176, 172, 164, ${ashCoreAlpha * 0.58})`
          : `rgba(156, 150, 140, ${ashCoreAlpha * 0.56})`
      );
      ashMoundGrad.addColorStop(1, 'rgba(164, 158, 148, 0)');
      ctx.fillStyle = ashMoundGrad;
      ctx.beginPath();
      ctx.ellipse(cx, moundY, moundRx, moundRy, 0, 0, TWO_PI);
      ctx.fill();

      // Soft pale crest highlight on the accumulating ash pile once enough ash has settled
      if (ashLevel > 0.16) {
        const crestAlpha = Math.min(1, (ashLevel - 0.16) / 0.84) * (isDark ? 0.28 : 0.34);
        ctx.fillStyle = isDark
          ? `rgba(224, 220, 212, ${crestAlpha})`
          : `rgba(216, 211, 202, ${crestAlpha})`;
        ctx.beginPath();
        ctx.ellipse(
          cx,
          moundY - moundRy * 0.22,
          moundRx * 0.52,
          moundRy * 0.48,
          0,
          0,
          TWO_PI
        );
        ctx.fill();
      }

      // Progressive fallen ash segments & grains accumulating inside the ceramic dish
      if (isReview && ashLevel > 0.04) {
        for (const piece of FALLEN_ASH_PIECES) {
          if (ashLevel < piece.threshold) continue;
          const fade = Math.min(1, (ashLevel - piece.threshold) / 0.06);
          const px = cx + piece.ox;
          const py = baseY + piece.oy - ashLevel * 0.45;
          if (piece.segment) {
            const half = piece.len * 0.5;
            const dx = Math.cos(piece.angle) * half;
            const dy = Math.sin(piece.angle) * half;
            ctx.beginPath();
            ctx.moveTo(px - dx, py - dy);
            ctx.lineTo(px + dx, py + dy);
            ctx.strokeStyle = isDark
              ? `rgba(208, 204, 196, ${0.56 * fade})`
              : `rgba(162, 156, 148, ${0.68 * fade})`;
            ctx.lineWidth = piece.width;
            ctx.lineCap = 'round';
            ctx.stroke();
          } else {
            ctx.fillStyle = isDark
              ? `rgba(200, 196, 188, ${0.46 * fade})`
              : `rgba(154, 148, 140, ${0.56 * fade})`;
            ctx.beginPath();
            ctx.arc(px, py, piece.len, 0, TWO_PI);
            ctx.fill();
          }
        }
      }

      // 2. Bottom segment — Exposed natural bamboo core (竹签, thinner, warm pale wood, never shortens)
      const bambooGrad = ctx.createLinearGradient(cx, jointY, cx, baseY);
      if (isDark) {
        bambooGrad.addColorStop(0, 'rgba(166, 145, 114, 0.84)');
        bambooGrad.addColorStop(0.85, 'rgba(136, 116, 88, 0.78)');
        bambooGrad.addColorStop(1, 'rgba(116, 98, 74, 0.55)');
      } else {
        bambooGrad.addColorStop(0, 'rgba(196, 170, 128, 0.94)');
        bambooGrad.addColorStop(0.85, 'rgba(176, 148, 108, 0.9)');
        bambooGrad.addColorStop(1, 'rgba(156, 130, 94, 0.72)');
      }
      ctx.beginPath();
      ctx.moveTo(cx, jointY);
      ctx.lineTo(cx, baseY + 0.5);
      ctx.strokeStyle = bambooGrad;
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 3. Upper segment — Darker sandalwood/agarwood incense body (香身, thicker, burns down to jointY)
      if (currentIncenseH > 0.8) {
        const bodyGrad = ctx.createLinearGradient(cx, tipY, cx, jointY);
        if (isDark) {
          bodyGrad.addColorStop(0, 'rgba(128, 112, 98, 0.92)');
          bodyGrad.addColorStop(0.18, 'rgba(116, 98, 82, 0.9)');
          bodyGrad.addColorStop(1, 'rgba(96, 80, 66, 0.86)');
        } else {
          bodyGrad.addColorStop(0, 'rgba(84, 68, 56, 0.94)');
          bodyGrad.addColorStop(0.18, 'rgba(94, 76, 62, 0.92)');
          bodyGrad.addColorStop(1, 'rgba(108, 88, 70, 0.88)');
        }
        ctx.beginPath();
        ctx.moveTo(cx, tipY + 0.6);
        ctx.lineTo(cx, jointY + 0.5);
        ctx.strokeStyle = bodyGrad;
        ctx.lineWidth = 2.95;
        ctx.lineCap = 'butt';
        ctx.stroke();
      }

      ctx.restore();
      return { tipY, jointY };
    };

    const getStageCoords = (now: number) => {
      if (isReview) {
        const geom = computeReviewGeometry(width, height, reviewSideSpace);
        const cx = geom.cx;
        const baseY = reviewDockBaseY ?? geom.baseY;
        const totalStickH = geom.totalStickH;
        const burnProgress = Math.max(0, Math.min(1, accumulatedBurnMs / effectiveBurnMs));
        const remainingMs = Math.max(0, effectiveBurnMs - accumulatedBurnMs);
        const bambooH = Math.round(totalStickH * 0.22);
        const incenseFullH = Math.max(20, totalStickH - bambooH);
        const tipY = baseY - bambooH - incenseFullH * (1 - burnProgress);
        return {
          cx,
          baseY,
          totalStickH,
          tipY,
          ensoCy: height * 0.5 - 38,
          ensoRadius: 58,
          burnProgress,
          remainingMs,
        };
      }

      const home = computeHomeGeometry(width, height);
      if (mode === 'ambient' && glideStartRef.current !== null) {
        const review = computeReviewGeometry(width, height);
        const u = easeInOutCubic((now - glideStartRef.current) / GLIDE_DURATION_MS);
        const cx = home.cx + (review.cx - home.cx) * u;
        const baseY = home.baseY + (review.baseY - home.baseY) * u;
        const totalStickH = home.totalStickH + (review.totalStickH - home.totalStickH) * u;
        const tipY = baseY - totalStickH;
        return {
          cx,
          baseY,
          totalStickH,
          tipY,
          ensoCy: height * 0.5 - 38,
          ensoRadius: 58,
          burnProgress: 0,
          remainingMs: effectiveBurnMs,
        };
      }

      return {
        cx: home.cx,
        baseY: home.baseY,
        totalStickH: home.totalStickH,
        tipY: home.baseY - home.totalStickH,
        ensoCy: height * 0.5 - 38,
        ensoRadius: 58,
        burnProgress: 0,
        remainingMs: effectiveBurnMs,
      };
    };

    // Reduced-motion fallback for 'review' mode: static two-segment stick updated periodically
    if (prefersReduced && isReview) {
      let lastTick = performance.now();
      const drawStaticReviewStick = () => {
        const now = performance.now();
        const isPausedNow =
          document.hidden || !windowFocused || now - lastActivityTime >= IDLE_PAUSE_MS;
        if (!isPausedNow && !extinguishedRef.current && accumulatedBurnMs < effectiveBurnMs) {
          accumulatedBurnMs = Math.min(effectiveBurnMs, accumulatedBurnMs + (now - lastTick));
        }
        lastTick = now;
        if (accumulatedBurnMs >= effectiveBurnMs && !burnCompletedFired) {
          burnCompletedFired = true;
          onBurnCompleteRef.current?.();
        }
        const { cx, baseY, totalStickH, tipY, burnProgress } = getStageCoords(now);
        ctx.clearRect(0, 0, width, height);
        const staticClearance =
          reviewSideSpace !== null ? resolveReviewIncenseVisibility(reviewSideSpace) : 1;
        if (staticClearance >= 0.3) {
          drawHolderAndStick(cx, baseY, totalStickH, burnProgress, 0.92 * staticClearance);
          if (!extinguishedRef.current) {
            ctx.fillStyle = isDark ? '#e67846' : '#cf4c2a';
            ctx.beginPath();
            ctx.arc(cx, tipY, 2.0, 0, TWO_PI);
            ctx.fill();
          }
        }
      };
      drawStaticReviewStick();
      const staticInterval = window.setInterval(drawStaticReviewStick, 2500);
      return () => {
        remeasureLayoutRef.current = null;
        wakeLoopRef.current = null;
        cardResizeObserver?.disconnect();
        window.clearInterval(staticInterval);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', markActivity);
        window.removeEventListener('keydown', markActivity);
        window.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('blur', onWindowBlur);
        window.removeEventListener('focus', onWindowFocus);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }

    const puffs: SmokePuff[] = [];
    const sparks: EmberSpark[] = [];
    const spine: SpineNode[] = [];
    const fallingAsh: FallingAshFlake[] = [];
    const MAX_PUFFS = 32;

    let prevLitForSparks = litRef.current;
    let lastAshDropMilestone = 0;
    let lastTime = performance.now();
    let curlCarry = 0;
    let wispCarry = 0;
    let spineCarry = 0;
    let prevStageCx: number | null = null;
    let prevStageTipY: number | null = null;
    let lastStageCx = 0;
    let lastStageTipY = 0;
    let rafId = 0;
    let throttleTimerId: ReturnType<typeof setTimeout> | null = null;
    let loopSuspended = false;

    const cancelScheduledFrame = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (throttleTimerId !== null) {
        window.clearTimeout(throttleTimerId);
        throttleTimerId = null;
      }
    };

    const scheduleNextFrame = (intervalMs: number | null) => {
      cancelScheduledFrame();
      if (intervalMs === null) {
        loopSuspended = true;
        return;
      }
      loopSuspended = false;
      if (intervalMs <= 0) {
        rafId = window.requestAnimationFrame(drawFrame);
      } else {
        throttleTimerId = window.setTimeout(() => {
          throttleTimerId = null;
          if (!document.hidden) {
            rafId = window.requestAnimationFrame(drawFrame);
          } else {
            loopSuspended = true;
          }
        }, intervalMs);
      }
    };

    suspendLoopFn = () => {
      cancelScheduledFrame();
      loopSuspended = true;
    };

    wakeLoopRef.current = () => {
      if (document.hidden) return;
      if (loopSuspended || throttleTimerId !== null) {
        lastTime = performance.now();
        scheduleNextFrame(0);
      }
    };

    // Throttle hover label updates so React never re-renders at 60fps
    let lastHoverEmittedKey = '';

    const spawnIgnitionSparks = (cx: number, tipY: number) => {
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.95;
        const speed = 22 + Math.random() * 32;
        sparks.push({
          x: cx + (Math.random() - 0.5) * 2,
          y: tipY - 1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          maxAge: 0.42 + Math.random() * 0.36,
          size: 1.0 + Math.random() * 0.9,
        });
      }
    };

    /** Emits a delicate, small dissipating curl high up where laminar smoke breaks into air (never a muddy blotch). */
    const emitUpperCurl = (x: number, y: number, alphaScale: number) => {
      puffs.push({
        x: x + (Math.random() - 0.5) * 3,
        y,
        vx: (Math.random() - 0.5) * 4.5,
        vy: -(11 + Math.random() * 5),
        age: 0,
        maxAge: 2.6 + Math.random() * 1.1,
        radiusStart: 5.5 + Math.random() * 2.5,
        radiusEnd: 19 + Math.random() * 7,
        alphaPeak: (isDark ? 0.042 : 0.038) * alphaScale,
        seed: Math.random() * TWO_PI,
        driftAmp: 9 + Math.random() * 5,
        kind: 'curl',
      });
    };

    const emitEtherealWisp = (
      x: number,
      y: number,
      vx: number,
      vy: number,
      alphaScale = 1
    ) => {
      puffs.push({
        x: x + (Math.random() - 0.5) * 5,
        y: y + (Math.random() - 0.5) * 5,
        vx,
        vy,
        age: 0,
        maxAge: 1.15 + Math.random() * 0.45,
        radiusStart: 12 + Math.random() * 6,
        radiusEnd: 30 + Math.random() * 10,
        alphaPeak: (isDark ? 0.088 : 0.095) * alphaScale,
        seed: Math.random() * TWO_PI,
        driftAmp: 4,
        kind: 'wisp',
      });
    };

    // Hydrate seamlessly from the previous ZenIncenseCanvas instance if handed off within 2s;
    // otherwise pre-seed a delicate laminar smoke thread in ambient & review modes.
    if (!isRitual && litRef.current) {
      const initNow = performance.now();
      const { cx, tipY } = getStageCoords(initNow);
      lastStageCx = cx;
      lastStageTipY = tipY;
      const snap = handoffSmokeSnapshot;
      if (snap && initNow - snap.timestamp < 2000 && snap.spine.length >= 3) {
        const dxAlign = cx - snap.cx;
        const dyAlign = tipY - snap.tipY;
        const elapsedSec = Math.min(0.25, Math.max(0, (initNow - snap.timestamp) / 1000));
        for (const n of snap.spine) {
          const nextAge = n.age + elapsedSec;
          if (nextAge < n.maxAge) {
            spine.push({
              ...n,
              x: n.x + dxAlign,
              y: n.y + dyAlign - 22 * elapsedSec * 0.85,
              age: nextAge,
            });
          }
        }
        for (const p of snap.puffs) {
          const nextAge = p.age + elapsedSec;
          if (nextAge < p.maxAge && puffs.length < MAX_PUFFS) {
            puffs.push({
              ...p,
              x: p.x + dxAlign,
              y: p.y + dyAlign + p.vy * elapsedSec,
              age: nextAge,
            });
          }
        }
        handoffSmokeSnapshot = null;
      } else {
        const seedNodes = 36;
        for (let i = seedNodes; i >= 0; i--) {
          const age = (i / seedNodes) * 4.2;
          const life = age / 4.8;
          const y = tipY - 3 - age * 22 * (1 - life * 0.12);
          const curveFactor = Math.pow(Math.max(0, life - 0.14) / 0.86, 1.85);
          const x = cx + Math.sin(age * 1.15) * 14 * curveFactor;
          spine.push({ x, y, vx: 0, vy: 0, age, maxAge: 4.8, disturbance: 0 });
        }
      }
    }

    const applyWindToPoint = (
      px: number,
      py: number,
      tSec: number,
      seed: number,
      strengthScale: number,
      dt: number,
      ribbonMode = false
    ): { dvx: number; dvy: number; intensity: number } => {
      if (!pointer.active) return { dvx: 0, dvy: 0, intensity: 0 };
      const dx = px - pointer.x;
      const dy = py - pointer.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= WIND_RADIUS * WIND_RADIUS) return { dvx: 0, dvy: 0, intensity: 0 };

      const dist = Math.sqrt(distSq) || 0.001;
      const falloff = Math.pow(1 - dist / WIND_RADIUS, 2);
      const nx = dx / dist;
      const ny = dy / dist;

      // Soft-saturate pointer velocity so even fast mouse flicks feel like a gentle breeze, never a gale
      const maxWindVx = ribbonMode ? 288 : 340;
      const maxWindVy = ribbonMode ? 144 : 230;
      const softVx = maxWindVx * Math.tanh(pointer.vx / 400);
      const softVy = maxWindVy * Math.tanh(pointer.vy / 420);
      const speed = Math.hypot(softVx, softVy);

      let dvx = softVx * falloff * (ribbonMode ? 0.5 : 0.72) * strengthScale * dt;
      let dvy = ribbonMode
        ? Math.min(0, softVy) * falloff * 0.16 * strengthScale * dt
        : softVy * falloff * 0.5 * strengthScale * dt;

      const wakePush = Math.min(ribbonMode ? 66 : 100, speed * 0.24) * falloff * strengthScale * dt;
      dvx += nx * 0.48 * wakePush;
      if (!ribbonMode) {
        dvy += ny * 0.25 * wakePush;
      }

      if (dist < HOVER_EDDY_RADIUS) {
        const hoverFalloff = Math.pow(1 - dist / HOVER_EDDY_RADIUS, 1.8);
        const eddy = (ribbonMode ? 16 : 22) * hoverFalloff * strengthScale * dt;
        const eddyWave = Math.sin(tSec * 2.4 + seed);
        dvx += (nx * 0.65 + eddyWave * 0.35) * eddy;
        if (!ribbonMode) {
          dvy += (ny * 0.2 - 0.18) * eddy;
        }
      }

      const intensity = Math.min(1, falloff * (0.25 + speed / 260));
      return { dvx, dvy, intensity };
    };

    const drawFrame = (now: number) => {
      rafId = 0;
      if (document.hidden) {
        lastTime = now;
        loopSuspended = true;
        return;
      }

      const rawDtMs = Math.max(1, now - lastTime);
      const dt = Math.min(0.08, rawDtMs / 1000);
      lastTime = now;
      const tSec = now * 0.001;

      const isIdleNow = now - lastActivityTime >= IDLE_PAUSE_MS;

      // Pause logic for 'review' mode (window blur or 90s idle pauses burn without losing progress)
      const isPaused =
        isReview &&
        !extinguishedRef.current &&
        (!windowFocused || isIdleNow);

      const targetPauseVisual = isPaused ? 0.2 : 1;
      pauseVisual += (targetPauseVisual - pauseVisual) * Math.min(1, dt * 3.2);

      // Smooth desk-margin visibility for review mode (softly hides when card crowds the window edge)
      if (isReview) {
        const targetClearance =
          reviewSideSpace !== null ? resolveReviewIncenseVisibility(reviewSideSpace) : 1;
        deskClearanceVisual += (targetClearance - deskClearanceVisual) * Math.min(1, dt * 6.5);
        if (Math.abs(targetClearance - deskClearanceVisual) < 0.004) {
          deskClearanceVisual = targetClearance;
        }
      }

      if (isReview && litRef.current && !isPaused && !extinguishedRef.current) {
        if (accumulatedBurnMs < effectiveBurnMs) {
          accumulatedBurnMs = Math.min(effectiveBurnMs, accumulatedBurnMs + Math.min(rawDtMs, 100));
          if (accumulatedBurnMs >= effectiveBurnMs && !burnCompletedFired) {
            burnCompletedFired = true;
            onBurnCompleteRef.current?.();
          }
        }
      }

      // Decay mouse wind velocity and "心静则烟直" agitation energy smoothly
      const windDecay = Math.pow(0.05, dt);
      pointer.vx *= windDecay;
      pointer.vy *= windDecay;
      agitationEnergyRef.current *= Math.pow(0.24, dt);
      if (agitationEnergyRef.current < 0.004) agitationEnergyRef.current = 0;

      const { cx, baseY, totalStickH, tipY, ensoCy, ensoRadius, burnProgress, remainingMs } =
        getStageCoords(now);
      lastStageCx = cx;
      lastStageTipY = tipY;

      const dxStage = prevStageCx !== null ? cx - prevStageCx : 0;
      const dyStage = prevStageTipY !== null ? tipY - prevStageTipY : 0;
      const isGliding =
        mode === 'ambient' &&
        glideStartRef.current !== null &&
        now - glideStartRef.current < GLIDE_DURATION_MS + 60;
      if (isGliding && (Math.abs(dxStage) > 0.01 || Math.abs(dyStage) > 0.01)) {
        // Carry the smoke plume smoothly with the gliding holder while leaving a natural upper air trail
        for (const n of spine) {
          const life = Math.min(1, n.age / n.maxAge);
          n.x += dxStage * (1 - life * 0.28);
          n.y += dyStage * (1 - life * 0.25);
        }
        for (const p of puffs) {
          p.x += dxStage * 0.48;
          p.y += dyStage * 0.4;
        }
      }
      prevStageCx = cx;
      prevStageTipY = tipY;

      // Final-minute gentle taper (last 60s: smoke thins & ember softens naturally)
      const finalMinFactor =
        isReview && remainingMs < FINAL_MINUTE_MS
          ? Math.max(0.28, remainingMs / FINAL_MINUTE_MS)
          : 1;

      // Extinguish fade once user finishes their card after burn-out
      const extinguishFade =
        isReview && extinguishedRef.current && extinguishTimestampRef.current !== null
          ? Math.max(0, 1 - (now - extinguishTimestampRef.current) / 900)
          : 1;

      const isActivelyLit = litRef.current && (!isReview || !extinguishedRef.current);

      // Hover hit-test for the calligraphic remaining-time whisper ("余 九分")
      if (isReview && onHoverInfoChangeRef.current) {
        const isHoveringStick =
          pointer.active &&
          !extinguishedRef.current &&
          deskClearanceVisual >= 0.3 &&
          Math.abs(pointer.x - cx) <= 28 &&
          pointer.y >= tipY - 26 &&
          pointer.y <= baseY + 14;

        const minBucket = remainingMs <= 0 ? 0 : remainingMs < 60_000 ? -1 : Math.ceil(remainingMs / 60_000);
        const key = isHoveringStick
          ? `1:${minBucket}:${isPaused ? 1 : 0}:${Math.round(cx)}:${Math.round(tipY)}`
          : '0';
        if (key !== lastHoverEmittedKey) {
          lastHoverEmittedKey = key;
          if (isHoveringStick) {
            onHoverInfoChangeRef.current({
              hovered: true,
              x: cx,
              y: Math.max(tipY + 12, Math.min(baseY - 24, (tipY + baseY) * 0.5)),
              remainingMs,
              paused: isPaused,
            });
          } else {
            onHoverInfoChangeRef.current(null);
          }
        }
      }

      if (isActivelyLit && !prevLitForSparks && isRitual) {
        spawnIgnitionSparks(cx, tipY);
      }
      prevLitForSparks = isActivelyLit;

      const litElapsedMs =
        isActivelyLit && litTimestampRef.current !== null ? now - litTimestampRef.current : 0;

      const totalHeadRaw =
        isRitual && isActivelyLit ? Math.min(1, litElapsedMs / SMOKE_TOTAL_JOURNEY_MS) : 0;
      const totalHeadProgress = easeCalligraphicOrbit(totalHeadRaw);

      const ascentProgress = Math.min(1, totalHeadProgress / ASCENT_JOURNEY_SPLIT);
      const smokeOrbitProgress =
        totalHeadProgress > ASCENT_JOURNEY_SPLIT
          ? Math.min(1, (totalHeadProgress - ASCENT_JOURNEY_SPLIT) / (1 - ASCENT_JOURNEY_SPLIT))
          : 0;

      const inkRaw =
        isRitual && isActivelyLit && litElapsedMs >= INK_START_MS
          ? Math.min(1, (litElapsedMs - INK_START_MS) / INCENSE_RING_FORM_MS)
          : 0;
      const inkProgress = easeCalligraphicOrbit(inkRaw);

      const postCompleteElapsed = Math.max(
        0,
        litElapsedMs - (INK_START_MS + INCENSE_RING_FORM_MS)
      );
      const postCompleteRecede = Math.min(1, postCompleteElapsed / 550);

      ctx.clearRect(0, 0, width, height);

      // Skip all Canvas 2D drawing when hidden on narrow/wide-card viewports (timer still ticks above)
      if (isReview && deskClearanceVisual < 0.015) {
        const isFullyExtinguished =
          extinguishedRef.current &&
          extinguishFade <= 0.005 &&
          spine.length === 0 &&
          puffs.length === 0 &&
          fallingAsh.length === 0;
        scheduleNextFrame(
          resolveIncenseFrameIntervalMs({
            mode,
            hidden: document.hidden,
            windowFocused,
            isIdle: isIdleNow,
            isGliding,
            isFullyExtinguished,
          }) ?? null
        );
        return;
      }

      const applyClearanceAlpha = isReview && deskClearanceVisual < 0.995;
      if (applyClearanceAlpha) {
        ctx.save();
        ctx.globalAlpha = deskClearanceVisual;
      }

      // 3. Emit slender silk ribbon nodes & sparse upper dissipating curls
      if (isActivelyLit) {
        const emitFactor = pauseVisual * (0.45 + 0.55 * finalMinFactor);
        spineCarry += dt * (11 * Math.max(0.35, emitFactor));
        while (spineCarry >= 1) {
          spineCarry -= 1;
          spine.push({
            x: cx,
            y: tipY - 4,
            vx: 0,
            vy: 0,
            age: 0,
            maxAge: 4.8,
            disturbance: 0,
          });
        }

        // Detach a delicate falling ash flake periodically as burnProgress crosses 12 milestones
        if (isReview) {
          const ashMilestone = Math.floor(burnProgress * 12);
          if (ashMilestone > lastAshDropMilestone && ashMilestone <= 12) {
            lastAshDropMilestone = ashMilestone;
            fallingAsh.push({
              x: cx + (Math.random() - 0.5) * 1.6,
              y: tipY - 1.5,
              vx: (Math.random() - 0.5) * 6,
              vy: 12 + Math.random() * 6,
              angle: (Math.random() - 0.5) * 0.6,
              spin: (Math.random() - 0.5) * 1.8,
              len: 2.8 + Math.random() * 1.4,
              seed: Math.random() * TWO_PI,
            });
          }
        }

        // Sparse upper curls only released from the upper third of the ribbon so the stem stays razor-clean
        curlCarry += dt * (2.2 * emitFactor);
        while (curlCarry >= 1) {
          curlCarry -= 1;
          if (puffs.length < MAX_PUFFS && spine.length > 10) {
            const upperIdx = Math.max(0, Math.floor(spine.length * 0.25));
            const anchor = spine[upperIdx];
            emitUpperCurl(anchor.x, anchor.y, emitFactor);
          }
        }

        // Ritual ceremony wisps leading the wet ink brush tip
        if (isRitual && totalHeadRaw > 0.05 && inkRaw < 0.96) {
          wispCarry += dt * 18;
          while (wispCarry >= 1) {
            wispCarry -= 1;
            if (puffs.length < MAX_PUFFS) {
              if (smokeOrbitProgress <= 0) {
                const pt = evaluateAscentCurve(ascentProgress, cx, tipY, ensoCy, ensoRadius);
                emitEtherealWisp(
                  pt.x,
                  pt.y,
                  (Math.random() - 0.5) * 5,
                  -(10 + Math.random() * 6),
                  Math.min(1, ascentProgress * 2.2)
                );
              } else {
                const tipFrac = Math.min(1, inkProgress + 0.035);
                const tipTheta = START_THETA + FULL_SWEEP_RAD * tipFrac;
                const tx = cx + Math.cos(tipTheta) * ensoRadius;
                const ty = ensoCy + Math.sin(tipTheta) * ensoRadius;
                const tanVx = -Math.sin(tipTheta) * (10 + Math.random() * 7);
                const tanVy = Math.cos(tipTheta) * (10 + Math.random() * 7) - 6;
                emitEtherealWisp(tx, ty, tanVx, tanVy, 1 - Math.max(0, (inkRaw - 0.78) / 0.22));
              }
            }
          }
        }
      }

      // 4. Update & render sparse upper dissipating curls & ritual wisps
      const puffDrag = Math.pow(0.28, dt);
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.age += dt;
        if (p.age >= p.maxAge) {
          puffs.splice(i, 1);
          continue;
        }
        const life = p.age / p.maxAge;
        const wind = applyWindToPoint(p.x, p.y, tSec, p.seed, 0.72, dt, false);
        p.vx += wind.dvx;
        p.vy += wind.dvy;

        if (p.kind === 'wisp') {
          p.x += (p.vx + Math.sin(tSec * 0.9 + p.seed) * 4) * dt;
          p.y += p.vy * (1 - life * 0.35) * dt;
          p.vx *= puffDrag;
        } else {
          const gentleDrift =
            Math.sin(tSec * 0.3 + p.y * 0.012 + p.seed) * p.driftAmp * Math.pow(life, 0.9);
          p.x += (p.vx + gentleDrift) * dt;
          p.y += p.vy * (1 - life * 0.3) * dt;
          p.vx *= puffDrag;
          if (p.vy > -9) p.vy += (-12 - p.vy) * Math.min(1, dt * 1.5);
        }

        const fadeIn = Math.min(1, life / 0.24);
        const fadeOut = Math.pow(1 - life, 1.65);
        const alpha = p.alphaPeak * fadeIn * fadeOut;
        if (alpha <= 0.001) continue;

        const r = p.radiusStart + (p.radiusEnd - p.radiusStart) * Math.pow(life, 0.75);
        ctx.globalAlpha = alpha;
        ctx.drawImage(smokeSprite, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;

      // 5. Primary slender laminar-to-curling silk smoke thread ("一缕细烟" + "心静则烟直")
      const climbSpeed = 22;
      const spineDrag = Math.pow(0.08, dt);
      const agitation = agitationEnergyRef.current;
      let disturbanceSum = 0;

      for (let i = spine.length - 1; i >= 0; i--) {
        const n = spine[i];
        n.age += dt;
        if (n.age >= n.maxAge) {
          spine.splice(i, 1);
          continue;
        }
        const life = n.age / n.maxAge;
        n.y -= climbSpeed * (1 - life * 0.2) * dt;

        // Straight laminar stem near the ember (life < 0.14), then slow languid S-curve higher up
        const laminarBlend = Math.pow(Math.max(0, life - 0.14) / 0.86, 1.85);
        const calmSway =
          (Math.sin(tSec * 0.34 + n.y * 0.013) * 7.5 +
            Math.cos(tSec * 0.19 - n.y * 0.008) * 3.5) *
          laminarBlend;

        // Subtle "心静则烟直" sway ripple when user rapidly clicks / skips cards
        const agitationSway =
          agitation > 0.005
            ? Math.sin(tSec * 4.4 - life * 9.5) * 12 * agitation * Math.min(1, life * 3.5)
            : 0;

        n.disturbance *= Math.pow(0.22, dt);
        if (n.age > 0.16) {
          // Restrained horizontal breeze so smoke leans gracefully without kinking or knotting
          const wind = applyWindToPoint(n.x, n.y, tSec, i * 0.37, 1.02, dt, true);
          n.vx += wind.dvx;
          n.vy += wind.dvy;
          n.disturbance = Math.max(n.disturbance, wind.intensity);
        }
        n.vx *= spineDrag;
        n.vy *= spineDrag;
        n.x += (calmSway + agitationSway + n.vx) * dt;
        n.y += Math.min(0, n.vy) * dt;

        // Soft height-proportional horizontal envelope so breeze never flings smoke across the screen
        if (!isGliding) {
          const maxOffset = 5 + 52 * Math.pow(life, 0.82);
          const offset = n.x - cx;
          if (Math.abs(offset) > maxOffset * 0.65) {
            const bounded = maxOffset * Math.tanh(offset / maxOffset);
            n.x += (cx + bounded - n.x) * Math.min(1, dt * 8);
          }
        }
        disturbanceSum += n.disturbance;
      }

      // Enforce strict upward vertical ordering & 2-pass fluid viscosity smoothing (eliminates zig-zags & loops)
      if (spine.length >= 3) {
        for (let i = spine.length - 2; i >= 0; i--) {
          const maxAllowedY = spine[i + 1].y - 1.35;
          if (spine[i].y > maxAllowedY) {
            spine[i].y = maxAllowedY;
          }
        }
        for (let pass = 0; pass < 2; pass++) {
          let prevX = spine[0].x;
          for (let i = 1; i < spine.length - 1; i++) {
            const currX = spine[i].x;
            const nextX = spine[i + 1].x;
            spine[i].x = currX * 0.56 + (prevX + nextX) * 0.22;
            prevX = currX;
          }
        }
      }

      if (spine.length >= 3) {
        const baseNode = spine[spine.length - 1];
        const topNode = spine[0];
        const avgDisturbance = Math.min(1, disturbanceSum / spine.length);
        if (baseNode.y > topNode.y + 8) {
          const silkGrad = ctx.createLinearGradient(
            baseNode.x,
            baseNode.y,
            topNode.x,
            topNode.y
          );
          const intensityScale = pauseVisual * (0.42 + 0.58 * finalMinFactor);
          const baseAlpha = (isDark ? 0.34 : 0.32) * intensityScale;
          const coreAlpha = isRitual
            ? (0.38 * (1 - postCompleteRecede) + baseAlpha * postCompleteRecede)
            : baseAlpha;

          silkGrad.addColorStop(0, `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, 0)`);
          silkGrad.addColorStop(
            0.08,
            `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, ${coreAlpha})`
          );
          silkGrad.addColorStop(
            0.48,
            `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, ${coreAlpha * 0.64})`
          );
          silkGrad.addColorStop(
            0.8,
            `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, ${coreAlpha * 0.24})`
          );
          silkGrad.addColorStop(1, `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, 0)`);

          ctx.beginPath();
          ctx.moveTo(spine[0].x, spine[0].y);
          for (let i = 1; i < spine.length - 1; i++) {
            const xc = (spine[i].x + spine[i + 1].x) * 0.5;
            const yc = (spine[i].y + spine[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(spine[i].x, spine[i].y, xc, yc);
          }
          const last = spine[spine.length - 1];
          ctx.lineTo(last.x, last.y);

          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = silkGrad;

          const widthScale = 0.65 + 0.35 * finalMinFactor;
          // Gossamer outer veil — gently widens and softens when a breeze passes through
          ctx.lineWidth = (6.4 + avgDisturbance * 2.4) * widthScale;
          ctx.globalAlpha = 0.14;
          ctx.stroke();

          // Slender silk body
          ctx.lineWidth = (2.5 + avgDisturbance * 0.7) * widthScale;
          ctx.globalAlpha = 0.36;
          ctx.stroke();

          // Delicate inner filament (never harsh/wire-like when bent)
          ctx.lineWidth = 1.0 * widthScale;
          ctx.globalAlpha = Math.max(0.28, 0.54 - avgDisturbance * 0.16);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // 5b. Ritual ceremony ascent plume (3-strand silk rising into 12:12 Ensō)
      if (isRitual && isActivelyLit && ascentProgress > 0.01 && inkRaw < 0.72) {
        const plumeFadeOut = 1 - Math.max(0, (inkRaw - 0.1) / 0.62);
        const tailU = Math.min(ascentProgress * 0.6, Math.max(0, inkRaw * 0.85));
        if (ascentProgress > tailU + 0.02 && plumeFadeOut > 0.01) {
          const startPt = evaluateAscentCurve(tailU, cx, tipY, ensoCy, ensoRadius);
          const endPt = evaluateAscentCurve(ascentProgress, cx, tipY, ensoCy, ensoRadius);
          const grad = ctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
          const peakA = 0.28 * plumeFadeOut;
          grad.addColorStop(0, `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, 0)`);
          grad.addColorStop(
            0.18,
            `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, ${peakA * 0.88})`
          );
          grad.addColorStop(0.68, `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, ${peakA})`);
          grad.addColorStop(1, `rgba(${smokeRgb[0]}, ${smokeRgb[1]}, ${smokeRgb[2]}, 0)`);

          const steps = 22;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = grad;

          for (const layer of [
            { width: 9.0, alpha: 0.2, waveAmp: 5.5, phase: 0 },
            { width: 3.6, alpha: 0.54, waveAmp: 3.5, phase: 1.8 },
            { width: 1.2, alpha: 0.92, waveAmp: 1.8, phase: 3.4 },
          ]) {
            ctx.beginPath();
            for (let s = 0; s <= steps; s++) {
              const u = tailU + (ascentProgress - tailU) * (s / steps);
              const pt = evaluateAscentCurve(u, cx, tipY, ensoCy, ensoRadius);
              const sway =
                Math.sin(u * 7.5 - tSec * 2.1 + layer.phase) *
                layer.waveAmp *
                Math.sin(u * Math.PI);
              let px = pt.x + sway;
              let py = pt.y;
              if (pointer.active) {
                const dx = px - pointer.x;
                const dy = py - pointer.y;
                const d = Math.hypot(dx, dy);
                if (d < WIND_RADIUS && d > 0.01) {
                  const f = Math.pow(1 - d / WIND_RADIUS, 2);
                  px += (dx / d) * f * 18 + pointer.vx * f * 0.025;
                  py += (dy / d) * f * 10 + pointer.vy * f * 0.018;
                }
              }
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.lineWidth = layer.width;
            ctx.globalAlpha = layer.alpha;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // 5c. Singing-Bowl Acoustic Resonance Waves (Retina 2x Canvas 2D — continuous C-infinity expansion,
      //     physically thinning wavefront + subtle trailing pressure sheen, zero CSS scale-upscaling pops)
      if (isRitual && isActivelyLit && litElapsedMs > BELL_WAVE_START_MS) {
        const bellElapsedMs = litElapsedMs - BELL_WAVE_START_MS;
        const waveRgb: [number, number, number] = isDark ? [242, 233, 212] : [44, 42, 38];
        const maxSafeR = Math.max(160, Math.min(width, height) * 0.45);

        // Subtle center mallet-strike resonance bloom (0 -> 1350ms)
        if (bellElapsedMs < 1350) {
          const bp = bellElapsedMs / 1350;
          const bEase = 1 - Math.pow(1 - bp, 2.4);
          const bRadius = 58 + 72 * bEase;
          const bAlpha = (isDark ? 0.085 : 0.062) * Math.sin(Math.PI * Math.min(1, bp / 0.18) * 0.5) * Math.pow(1 - bp, 1.9);
          if (bAlpha > 0.002) {
            const bloomGrad = ctx.createRadialGradient(cx, ensoCy, 42, cx, ensoCy, bRadius);
            bloomGrad.addColorStop(0, `rgba(${waveRgb[0]}, ${waveRgb[1]}, ${waveRgb[2]}, 0)`);
            bloomGrad.addColorStop(0.55, `rgba(${waveRgb[0]}, ${waveRgb[1]}, ${waveRgb[2]}, ${bAlpha})`);
            bloomGrad.addColorStop(1, `rgba(${waveRgb[0]}, ${waveRgb[1]}, ${waveRgb[2]}, 0)`);
            ctx.fillStyle = bloomGrad;
            ctx.beginPath();
            ctx.arc(cx, ensoCy, bRadius, 0, TWO_PI);
            ctx.fill();
          }
        }

        // Three harmonic wavefronts radiating smoothly off the Ensō ink circumference
        for (const w of BELL_ACOUSTIC_WAVES) {
          const elapsed = bellElapsedMs - w.delayMs;
          if (elapsed <= 0 || elapsed >= w.durationMs) continue;
          const p = elapsed / w.durationMs;
          const easeOut = 1 - Math.pow(1 - p, 2.75);
          const rTarget = Math.min(w.rEnd, maxSafeR);
          const radius = w.rStart + (rTarget - w.rStart) * easeOut;

          // Smooth raised-cosine onset (0 -> 8%) × continuous physical exponential acoustic decay
          const attack = p < 0.08 ? 0.5 - 0.5 * Math.cos(Math.PI * (p / 0.08)) : 1;
          const decay = Math.pow(1 - p, 2.25);
          const darkBoost = isDark ? 1.14 : 1.0;
          const alpha = w.peakAlpha * darkBoost * attack * decay;
          if (alpha < 0.002) continue;

          // 1) Whisper-soft acoustic mist band trailing right behind the wavefront
          const innerR = Math.max(1, radius - w.bandWidth * (0.75 + 0.55 * easeOut));
          const outerR = radius + 3.5;
          const bandGrad = ctx.createRadialGradient(cx, ensoCy, innerR, cx, ensoCy, outerR);
          const waveStop = Math.max(0.05, Math.min(0.95, (radius - innerR) / (outerR - innerR)));
          bandGrad.addColorStop(0, `rgba(${waveRgb[0]}, ${waveRgb[1]}, ${waveRgb[2]}, 0)`);
          bandGrad.addColorStop(waveStop, `rgba(${waveRgb[0]}, ${waveRgb[1]}, ${waveRgb[2]}, ${alpha * 0.24})`);
          bandGrad.addColorStop(1, `rgba(${waveRgb[0]}, ${waveRgb[1]}, ${waveRgb[2]}, 0)`);
          ctx.fillStyle = bandGrad;
          ctx.beginPath();
          ctx.arc(cx, ensoCy, outerR, 0, TWO_PI);
          ctx.fill();

          // 2) Delicate wavefront stroke that thins organically as circumference grows
          const strokeWidth = w.widthStart + (w.widthEnd - w.widthStart) * easeOut;
          ctx.beginPath();
          ctx.arc(cx, ensoCy, radius, 0, TWO_PI);
          ctx.strokeStyle = `rgba(${waveRgb[0]}, ${waveRgb[1]}, ${waveRgb[2]}, ${alpha})`;
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
        }
      }

      // 6. Ritual Ensō Conic-Gradient Brushstroke Sweep
      if (isRitual && isActivelyLit && ensoImageReady && ensoCompositeCtx && inkProgress > 0.002) {
        if (inkRaw >= 0.995) {
          ctx.drawImage(
            ensoSourceCanvas,
            cx - ENSO_BOX_SIZE * 0.5,
            ensoCy - ENSO_BOX_SIZE * 0.5,
            ENSO_BOX_SIZE,
            ENSO_BOX_SIZE
          );
        } else {
          ensoCompositeCtx.clearRect(0, 0, ensoPixelSize, ensoPixelSize);
          const centerPx = ensoPixelSize * 0.5;
          const sweepFrac = (FULL_SWEEP_RAD / TWO_PI) * inkProgress;
          const featherFrac = 0.075;

          if (typeof ensoCompositeCtx.createConicGradient === 'function') {
            const conic = ensoCompositeCtx.createConicGradient(START_THETA, centerPx, centerPx);
            const solidStop = Math.max(0, Math.min(1, sweepFrac - featherFrac * 0.45));
            const tipStop = Math.min(1, sweepFrac + featherFrac * 0.55);

            conic.addColorStop(0, 'rgba(0, 0, 0, 1)');
            if (solidStop > 0.001) conic.addColorStop(solidStop, 'rgba(0, 0, 0, 1)');
            conic.addColorStop(tipStop, 'rgba(0, 0, 0, 0)');
            if (tipStop < 1) conic.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ensoCompositeCtx.fillStyle = conic;
            ensoCompositeCtx.fillRect(0, 0, ensoPixelSize, ensoPixelSize);
          } else {
            ensoCompositeCtx.beginPath();
            ensoCompositeCtx.moveTo(centerPx, centerPx);
            ensoCompositeCtx.arc(
              centerPx,
              centerPx,
              ensoPixelSize,
              START_THETA,
              START_THETA + FULL_SWEEP_RAD * inkProgress
            );
            ensoCompositeCtx.closePath();
            ensoCompositeCtx.fillStyle = '#000';
            ensoCompositeCtx.fill();
          }

          ensoCompositeCtx.globalCompositeOperation = 'source-in';
          ensoCompositeCtx.drawImage(ensoSourceCanvas, 0, 0, ensoPixelSize, ensoPixelSize);
          ensoCompositeCtx.globalCompositeOperation = 'source-over';

          ctx.drawImage(
            ensoCompositeCanvas,
            cx - ENSO_BOX_SIZE * 0.5,
            ensoCy - ENSO_BOX_SIZE * 0.5,
            ENSO_BOX_SIZE,
            ENSO_BOX_SIZE
          );
        }
      }

      // 7. Holder base + Two-segment physical incense stick (竹签 + 香身)
      const stickOpacity = isRitual
        ? 1 - postCompleteRecede * 0.18
        : isReview
        ? 0.94
        : 0.82;
      drawHolderAndStick(cx, baseY, totalStickH, burnProgress, stickOpacity);

      // 8. Three-layer breathing ember tip: 灰帽 (ash cap) + 火点 (radial coal) + 余晖 (5s breathing halo)
      if (!litRef.current && isRitual) {
        const invitePulse = 0.5 + 0.5 * Math.sin(tSec * (TWO_PI / 5.0));
        const halo = ctx.createRadialGradient(cx, tipY, 0.5, cx, tipY, 15 + invitePulse * 6);
        halo.addColorStop(
          0,
          isDark
            ? `rgba(232, 152, 114, ${0.2 + invitePulse * 0.14})`
            : `rgba(196, 82, 54, ${0.16 + invitePulse * 0.12})`
        );
        halo.addColorStop(1, 'rgba(196, 82, 54, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, tipY, 22, 0, TWO_PI);
        ctx.fill();

        ctx.fillStyle = isDark
          ? `rgba(236, 198, 168, ${0.46 + invitePulse * 0.3})`
          : `rgba(184, 74, 48, ${0.48 + invitePulse * 0.28})`;
        ctx.beginPath();
        ctx.arc(cx, tipY, 2.0, 0, TWO_PI);
        ctx.fill();
      } else if (litRef.current && extinguishFade > 0.01) {
        const litElapsed =
          litTimestampRef.current !== null ? (now - litTimestampRef.current) / 1000 : 1;
        const flare = isRitual ? Math.max(0, 1 - litElapsed / 0.55) : 0;

        // Calm 5-second breathing cycle (the one gentle living rhythm in Zen Mode)
        const breathWave = 0.5 + 0.5 * Math.sin(tSec * (TWO_PI / 5.0));
        const emberStrength = pauseVisual * (0.45 + 0.55 * finalMinFactor) * extinguishFade;

        // Layer 3 (Outer): 余晖 — soft breathing warm aura (~5s cycle; half-size & crisp in review mode)
        const haloRadius = isReview ? 7.5 + breathWave * 4 : 15 + breathWave * 8 + flare * 8;
        const haloGrad = ctx.createRadialGradient(cx, tipY, 0.6, cx, tipY, haloRadius);
        const haloPeak = (isDark ? 0.32 + breathWave * 0.18 : 0.2 + breathWave * 0.14) * emberStrength;
        haloGrad.addColorStop(0, `rgba(246, 142, 74, ${haloPeak + flare * 0.2})`);
        haloGrad.addColorStop(0.45, `rgba(218, 86, 42, ${haloPeak * 0.36})`);
        haloGrad.addColorStop(1, 'rgba(184, 58, 36, 0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(cx, tipY, haloRadius, 0, TWO_PI);
        ctx.fill();

        // Layer 2 (Middle): 火点 — incandescent center fading outward into warm tangerine-crimson
        const coalR = 2.6 + flare * 0.55;
        const coalGrad = ctx.createRadialGradient(cx, tipY - 0.3, 0.2, cx, tipY, coalR);
        coalGrad.addColorStop(
          0,
          `rgba(255, 240, 198, ${(0.88 + breathWave * 0.12) * emberStrength})`
        );
        coalGrad.addColorStop(
          0.48,
          `rgba(242, 118, 48, ${(0.92 + breathWave * 0.08) * Math.max(0.35, emberStrength)})`
        );
        coalGrad.addColorStop(
          1,
          `rgba(176, 44, 24, ${0.75 * Math.max(0.3, emberStrength)})`
        );
        ctx.fillStyle = coalGrad;
        ctx.beginPath();
        ctx.ellipse(cx, tipY, coalR, coalR * 0.84, 0, 0, TWO_PI);
        ctx.fill();

        // Layer 1 (Top): 灰帽 — delicate pale-gray ash cap resting right atop the glowing coal
        ctx.beginPath();
        ctx.moveTo(cx, tipY - 1.1);
        ctx.quadraticCurveTo(cx + 0.5, tipY - 3.0, cx + 0.2, tipY - 4.4);
        ctx.strokeStyle = isDark
          ? `rgba(212, 208, 200, ${0.72 * extinguishFade})`
          : `rgba(182, 178, 170, ${0.84 * extinguishFade})`;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 9. Delicate ignition micro-sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= s.maxAge) {
          sparks.splice(i, 1);
          continue;
        }
        const life = s.age / s.maxAge;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.96;
        s.vy *= 0.95;

        const alpha = Math.pow(1 - life, 1.4) * 0.82;
        ctx.fillStyle = isDark
          ? `rgba(255, 196, 128, ${alpha})`
          : `rgba(204, 78, 42, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (1 - life * 0.45), 0, TWO_PI);
        ctx.fill();
      }

      // 10. Falling pale ash flakes drifting gently from the tip down into the dish
      for (let i = fallingAsh.length - 1; i >= 0; i--) {
        const f = fallingAsh[i];
        f.vy = Math.min(46, f.vy + 34 * dt);
        f.x += (f.vx + Math.sin(tSec * 3.2 + f.seed) * 5.5) * dt;
        f.y += f.vy * dt;
        f.vx *= Math.pow(0.25, dt);
        f.angle += f.spin * dt;
        // Gently pull falling flake toward the dish rim if drifted wide
        const driftX = f.x - cx;
        if (Math.abs(driftX) > 11) {
          f.x -= Math.sign(driftX) * 14 * dt;
        }
        if (f.y >= baseY + 0.5) {
          fallingAsh.splice(i, 1);
          continue;
        }
        const half = f.len * 0.5;
        const dx = Math.cos(f.angle) * half;
        const dy = Math.sin(f.angle) * half;
        ctx.beginPath();
        ctx.moveTo(f.x - dx, f.y - dy);
        ctx.lineTo(f.x + dx, f.y + dy);
        ctx.strokeStyle = isDark
          ? 'rgba(210, 206, 198, 0.68)'
          : 'rgba(168, 162, 154, 0.78)';
        ctx.lineWidth = 1.55;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      if (applyClearanceAlpha) {
        ctx.restore();
      }

      const isFullyExtinguished =
        isReview &&
        extinguishedRef.current &&
        extinguishFade <= 0.005 &&
        spine.length === 0 &&
        puffs.length === 0 &&
        fallingAsh.length === 0;
      scheduleNextFrame(
        resolveIncenseFrameIntervalMs({
          mode,
          hidden: document.hidden,
          windowFocused,
          isIdle: isIdleNow,
          isGliding,
          isFullyExtinguished,
        })
      );
    };

    if (!document.hidden) {
      scheduleNextFrame(0);
    } else {
      loopSuspended = true;
    }
    return () => {
      if (litRef.current && !extinguishedRef.current && spine.length >= 3) {
        handoffSmokeSnapshot = {
          spine: spine.map((n) => ({ ...n })),
          puffs: puffs.filter((p) => p.kind === 'curl').map((p) => ({ ...p })),
          cx: lastStageCx,
          tipY: lastStageTipY,
          timestamp: performance.now(),
        };
      }
      remeasureLayoutRef.current = null;
      wakeLoopRef.current = null;
      suspendLoopFn = null;
      cardResizeObserver?.disconnect();
      cancelScheduledFrame();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      onHoverInfoChangeRef.current?.(null);
    };
  }, [mode, isDark, burnDurationMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-zen-incense={mode}
      data-zen-incense-lit={lit ? 'true' : 'false'}
      data-zen-incense-duration={mode === 'review' ? String(burnDurationMs) : undefined}
      className={`zen-incense-canvas ${className}`}
    />
  );
};
