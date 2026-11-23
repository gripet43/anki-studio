// Pure SSR-safe state machine and physics helpers for macOS trackpad Tinder-style review gestures.

export const SWIPE_COMMIT_THRESHOLD_PX = 110;
export const SWIPE_FLICK_MIN_DISTANCE_PX = 55;
export const SWIPE_FLICK_MIN_VELOCITY_PX_MS = 0.85;
export const SWIPE_HAPTIC_HYSTERESIS_RATIO = 0.78;
export const SWIPE_MAX_VISUAL_X_PX = 230;
export const SWIPE_MAX_ROTATION_DEG = 9.5;
export const SWIPE_MAX_ARC_LIFT_PX = 12;

export const UNFLIPPED_MAX_WOBBLE_PX = 34;
export const UNFLIPPED_MAX_WOBBLE_DEG = 2.2;

export const PULL_FLIP_THRESHOLD_PX = 72;
export const PULL_FLIP_FLICK_MIN_DISTANCE_PX = 40;
export const PULL_FLIP_FLICK_MIN_VELOCITY_PX_MS = 0.75;
export const PULL_FLIP_MAX_VISUAL_PX = 58;

export const WHEEL_SILENCE_RELEASE_MS = 95;
export const WHEEL_NATIVE_WATCHDOG_MS = 1400;
export const UNFLIPPED_WOBBLE_WATCHDOG_MS = 180;
export const POST_COMMIT_COOLDOWN_MS = 380;
export const POST_COMMIT_INERTIA_GUARD_MS = 260;
export const CARD_MOUNT_GESTURE_GUARD_MS = 160;
export const SPRING_BACK_DURATION_MS = 280;
export const HORIZONTAL_LOCK_MIN_PX = 9;
export const HORIZONTAL_LOCK_SLOPE_RATIO = 1.5;
export const VERTICAL_LOCK_MIN_PX = 10;
export const TOP_ARRIVAL_SETTLE_MS = 220;

export type SwipeGestureAxis = 'idle' | 'horizontal' | 'pull_flip';
export type SwipeDirection = 'left' | 'right' | 'down' | null;
export type NativeWheelPhase = 'begin' | 'update' | 'end' | 'momentum' | 'mouse';

export interface SwipeVisualPose {
  visualX: number;
  visualY: number;
  rotationDeg: number;
  progress: number;
  direction: SwipeDirection;
  overThreshold: boolean;
  pullFlipReady: boolean;
  axis: SwipeGestureAxis;
  isDragging: boolean;
}

export interface SwipeGestureState {
  axis: SwipeGestureAxis;
  rawX: number;
  rawY: number;
  velocityX: number;
  velocityY: number;
  lastEventTs: number;
  lastWheelSeenTs: number;
  lastScrolledDownTs: number;
  hapticFiredForSide: 'left' | 'right' | 'pull' | null;
  momentumLocked: boolean;
  verticalScrollLocked: boolean;
  nativeWheelActive: boolean;
  nativePhaseInFlight: boolean;
  nativeDeviceIsMouse: boolean;
  gestureEpoch: number;
  committedEpoch: number;
  cooldownUntilTs: number;
  commitGuardUntilTs: number;
  inverted: boolean;
}

export interface SwipeWheelStepInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  timestampMs: number;
  isCardFlipped: boolean;
  atScrollTop: boolean;
  hasHorizontalScrollableAncestor?: boolean;
}

export type SwipeHapticPattern = 'generic' | 'strong' | 'alignment';

export interface SwipeWheelStepResult {
  handled: boolean;
  pose: SwipeVisualPose;
  hapticPattern: SwipeHapticPattern | null;
}

export type SwipeReleaseDecision =
  | {
      kind: 'rate';
      ease: 1 | 3;
      dir: 'left' | 'right';
      pose: SwipeVisualPose;
      velocityX: number;
      hapticPattern?: SwipeHapticPattern | null;
    }
  | { kind: 'flip'; pose: SwipeVisualPose; hapticPattern?: SwipeHapticPattern | null }
  | { kind: 'spring'; pose: SwipeVisualPose }
  | { kind: 'none'; pose: SwipeVisualPose };

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function rubberBand(absDist: number, linearCap: number, maxCap: number): number {
  if (absDist <= linearCap) return absDist;
  const headroom = Math.max(1, maxCap - linearCap);
  const extra = absDist - linearCap;
  return linearCap + headroom * (1 - Math.exp(-extra / headroom));
}

export function detectDefaultNaturalScrolling(): boolean {
  if (typeof navigator === 'undefined') return true;
  const plat = `${navigator.platform || ''} ${navigator.userAgent || ''}`;
  // Default true on macOS and Windows Precision Touchpads; falls back to false elsewhere until native QWheelEvent reports exact flag.
  return /Mac|Darwin|Win/i.test(plat);
}

export function createSwipeGestureState(inverted?: boolean): SwipeGestureState {
  return {
    axis: 'idle',
    rawX: 0,
    rawY: 0,
    velocityX: 0,
    velocityY: 0,
    lastEventTs: 0,
    lastWheelSeenTs: 0,
    lastScrolledDownTs: 0,
    hapticFiredForSide: null,
    momentumLocked: false,
    verticalScrollLocked: false,
    nativeWheelActive: false,
    nativePhaseInFlight: false,
    nativeDeviceIsMouse: false,
    gestureEpoch: 0,
    committedEpoch: -1,
    cooldownUntilTs: 0,
    commitGuardUntilTs: 0,
    inverted: typeof inverted === 'boolean' ? inverted : detectDefaultNaturalScrolling(),
  };
}

export function computeSwipeFlyDurationMs(velocityX: number): number {
  const absV = Number.isFinite(velocityX) ? Math.abs(velocityX) : 0;
  // Map release speed (px/ms, clamped 0..1.8) smoothly from 205ms down to 115ms.
  const t = clamp(absV / 1.8, 0, 1);
  return Math.round(205 - t * (205 - 115));
}

export function computeDragVisuals(
  state: SwipeGestureState,
  isCardFlipped: boolean
): SwipeVisualPose {
  if (state.axis === 'horizontal') {
    const sign = Math.sign(state.rawX);
    const absRaw = Math.abs(state.rawX);

    if (!isCardFlipped) {
      // Unflipped front side: high-damping rubber-band wobble only, zero rating/stamp progress.
      const mag = UNFLIPPED_MAX_WOBBLE_PX * (1 - Math.exp(-absRaw / 140));
      const visualX = sign * mag;
      const rotationDeg = (visualX / UNFLIPPED_MAX_WOBBLE_PX) * UNFLIPPED_MAX_WOBBLE_DEG;
      return {
        visualX,
        visualY: 0,
        rotationDeg,
        progress: 0,
        direction: absRaw >= 3 ? (sign < 0 ? 'left' : 'right') : null,
        overThreshold: false,
        pullFlipReady: false,
        axis: 'horizontal',
        isDragging: true,
      };
    }

    const visualX = sign * rubberBand(absRaw, SWIPE_COMMIT_THRESHOLD_PX, SWIPE_MAX_VISUAL_X_PX);
    const progress = clamp(absRaw / SWIPE_COMMIT_THRESHOLD_PX, 0, 1);
    const rotationDeg =
      sign * Math.min(SWIPE_MAX_ROTATION_DEG, (Math.abs(visualX) / SWIPE_COMMIT_THRESHOLD_PX) * 7.2);
    const visualY = -Math.min(SWIPE_MAX_ARC_LIFT_PX, Math.abs(visualX) * 0.045);

    return {
      visualX,
      visualY,
      rotationDeg,
      progress,
      direction: Math.abs(visualX) >= 4 ? (sign < 0 ? 'left' : 'right') : null,
      overThreshold: absRaw >= SWIPE_COMMIT_THRESHOLD_PX,
      pullFlipReady: false,
      axis: 'horizontal',
      isDragging: true,
    };
  }

  if (state.axis === 'pull_flip' && !isCardFlipped) {
    const clampedRaw = Math.max(0, state.rawY);
    const visualY = PULL_FLIP_MAX_VISUAL_PX * (1 - Math.exp(-clampedRaw / 76));
    const progress = clamp(clampedRaw / PULL_FLIP_THRESHOLD_PX, 0, 1);
    return {
      visualX: 0,
      visualY,
      rotationDeg: 0,
      progress,
      direction: clampedRaw >= 4 ? 'down' : null,
      overThreshold: clampedRaw >= PULL_FLIP_THRESHOLD_PX,
      pullFlipReady: clampedRaw >= PULL_FLIP_THRESHOLD_PX,
      axis: 'pull_flip',
      isDragging: true,
    };
  }

  return {
    visualX: 0,
    visualY: 0,
    rotationDeg: 0,
    progress: 0,
    direction: null,
    overThreshold: false,
    pullFlipReady: false,
    axis: 'idle',
    isDragging: false,
  };
}

export function stepSwipeWheel(
  state: SwipeGestureState,
  input: SwipeWheelStepInput
): SwipeWheelStepResult {
  const noOp = (): SwipeWheelStepResult => ({
    handled: false,
    pose: computeDragVisuals(state, input.isCardFlipped),
    hapticPattern: null,
  });

  // Discrete mouse-wheel ticks (line/page deltaMode) or native macOS mouse wheel never drive trackpad gestures.
  if (input.deltaMode !== 0) return noOp();
  if (state.nativeDeviceIsMouse) return noOp();

  if (!input.atScrollTop) {
    state.lastScrolledDownTs = input.timestampMs;
  }

  const gapMs =
    state.lastWheelSeenTs > 0 ? input.timestampMs - state.lastWheelSeenTs : Number.POSITIVE_INFINITY;
  const scrollLockRecoveryMs = state.nativePhaseInFlight ? 500 : 120;
  const momentumRecoveryMs = state.nativeWheelActive ? 500 : 120;
  if (gapMs >= scrollLockRecoveryMs) {
    state.verticalScrollLocked = false;
    if (state.axis === 'idle') {
      state.rawX = 0;
      state.rawY = 0;
    }
  }
  if (gapMs >= momentumRecoveryMs && state.momentumLocked && input.timestampMs >= state.cooldownUntilTs) {
    state.momentumLocked = false;
  }
  state.lastWheelSeenTs = input.timestampMs;

  if (input.hasHorizontalScrollableAncestor) return noOp();
  if (state.momentumLocked || state.verticalScrollLocked) return noOp();
  if (input.timestampMs < state.cooldownUntilTs) return noOp();

  const sign = state.inverted ? -1 : 1;
  const dx = Number(input.deltaX || 0) * sign;
  const dy = Number(input.deltaY || 0) * sign;

  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return noOp();
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return noOp();

  // Cross-platform fallback guard (Windows/Linux/Web without Qt6 ScrollPhase):
  // Ignore exact quantized mechanical mouse-wheel notches (±100 / ±120 / ±200 / ±240px).
  if (!state.nativeWheelActive && state.axis === 'idle') {
    const absRawX = Math.abs(Number(input.deltaX || 0));
    const absRawY = Math.abs(Number(input.deltaY || 0));
    if (
      absRawX === 0 &&
      (absRawY === 100 || absRawY === 120 || absRawY === 200 || absRawY === 240)
    ) {
      return noOp();
    }
    if (absRawY === 0 && (absRawX === 100 || absRawX === 120)) {
      return noOp();
    }
  }

  if (state.axis === 'idle') {
    const candX = state.rawX + dx;
    const candY = state.rawY + dy;
    const topSettled =
      state.lastScrolledDownTs <= 0 ||
      input.timestampMs - state.lastScrolledDownTs >= TOP_ARRIVAL_SETTLE_MS;

    if (!input.isCardFlipped && input.atScrollTop && topSettled) {
      // On unflipped front side after settling at top: prioritize downward pull-to-flip.
      if (candY >= 6 && candY > Math.abs(candX) * 1.15) {
        state.axis = 'pull_flip';
        state.rawX = 0;
        state.rawY = candY;
      } else if (
        Math.abs(candX) >= HORIZONTAL_LOCK_MIN_PX &&
        Math.abs(candX) > Math.abs(candY) * HORIZONTAL_LOCK_SLOPE_RATIO
      ) {
        state.axis = 'horizontal';
        state.rawX = candX;
        state.rawY = 0;
      } else if (Math.abs(candY) >= VERTICAL_LOCK_MIN_PX || Math.hypot(candX, candY) >= 14) {
        state.verticalScrollLocked = true;
        state.rawX = 0;
        state.rawY = 0;
        return noOp();
      } else {
        state.rawX = candX;
        state.rawY = candY;
        return {
          handled: false,
          pose: computeDragVisuals(state, input.isCardFlipped),
          hapticPattern: null,
        };
      }
    } else if (
      Math.abs(candX) > Math.abs(candY) * HORIZONTAL_LOCK_SLOPE_RATIO &&
      Math.abs(candX) >= HORIZONTAL_LOCK_MIN_PX
    ) {
      state.axis = 'horizontal';
      state.rawX = candX;
      state.rawY = 0;
    } else if (Math.abs(candY) >= VERTICAL_LOCK_MIN_PX || Math.hypot(candX, candY) >= 14) {
      // Committed to normal vertical scrolling for this gesture; lock horizontal until next gesture.
      state.verticalScrollLocked = true;
      state.rawX = 0;
      state.rawY = 0;
      return noOp();
    } else {
      state.rawX = candX;
      // Do not accumulate downward pull deltas until scrolled-up settle window has elapsed.
      state.rawY = !input.isCardFlipped && input.atScrollTop && !topSettled ? 0 : candY;
      return {
        handled: false,
        pose: computeDragVisuals(state, input.isCardFlipped),
        hapticPattern: null,
      };
    }
  } else if (state.axis === 'horizontal') {
    state.rawX += dx;
  } else if (state.axis === 'pull_flip') {
    if (input.isCardFlipped) {
      state.axis = 'idle';
      state.rawX = 0;
      state.rawY = 0;
      return noOp();
    }
    state.rawY = Math.max(0, state.rawY + dy);
  }

  let hapticPattern: SwipeHapticPattern | null = null;

  if (state.axis === 'horizontal') {
    if (state.lastEventTs > 0) {
      const dt = clamp(input.timestampMs - state.lastEventTs, 4, 64);
      const instVx = dx / dt;
      state.velocityX = state.velocityX === 0 ? instVx : state.velocityX * 0.6 + instVx * 0.4;
    } else {
      state.velocityX = 0;
    }
    state.lastEventTs = input.timestampMs;

    if (input.isCardFlipped) {
      const side: 'left' | 'right' = state.rawX < 0 ? 'left' : 'right';
      const absRaw = Math.abs(state.rawX);
      if (absRaw >= SWIPE_COMMIT_THRESHOLD_PX) {
        if (state.hapticFiredForSide !== side) {
          state.hapticFiredForSide = side;
          hapticPattern = 'strong';
        }
      } else if (absRaw < SWIPE_COMMIT_THRESHOLD_PX * SWIPE_HAPTIC_HYSTERESIS_RATIO) {
        state.hapticFiredForSide = null;
      }
    }
  } else if (state.axis === 'pull_flip') {
    if (state.lastEventTs > 0) {
      const dt = clamp(input.timestampMs - state.lastEventTs, 4, 64);
      const instVy = dy / dt;
      state.velocityY = state.velocityY === 0 ? instVy : state.velocityY * 0.6 + instVy * 0.4;
    } else {
      state.velocityY = 0;
    }
    state.lastEventTs = input.timestampMs;
    if (state.rawY >= PULL_FLIP_THRESHOLD_PX) {
      if (state.hapticFiredForSide !== 'pull') {
        state.hapticFiredForSide = 'pull';
        hapticPattern = 'generic';
      }
    } else if (state.rawY < PULL_FLIP_THRESHOLD_PX * SWIPE_HAPTIC_HYSTERESIS_RATIO) {
      state.hapticFiredForSide = null;
    }
  }

  return {
    handled: true,
    pose: computeDragVisuals(state, input.isCardFlipped),
    hapticPattern,
  };
}

function clearActiveDragFields(state: SwipeGestureState): void {
  state.axis = 'idle';
  state.rawX = 0;
  state.rawY = 0;
  state.velocityX = 0;
  state.velocityY = 0;
  state.lastEventTs = 0;
  state.hapticFiredForSide = null;
  state.verticalScrollLocked = false;
}

export function cancelActiveSwipeDrag(state: SwipeGestureState): boolean {
  const wasActive =
    state.axis !== 'idle' ||
    state.rawX !== 0 ||
    state.rawY !== 0 ||
    state.hapticFiredForSide !== null;
  clearActiveDragFields(state);
  return wasActive;
}

export function stepSwipeRelease(
  state: SwipeGestureState,
  isCardFlipped: boolean,
  timestampMs: number,
  lockMomentum = true
): SwipeReleaseDecision {
  const pose = computeDragVisuals(state, isCardFlipped);
  const activeAxis = state.axis;
  const rawX = state.rawX;
  const rawY = state.rawY;
  const vx = state.velocityX;
  const vy = state.velocityY;
  const prevHapticSide = state.hapticFiredForSide;

  if (activeAxis === 'idle') {
    clearActiveDragFields(state);
    if (!lockMomentum) {
      state.momentumLocked = false;
    }
    return { kind: 'none', pose };
  }

  clearActiveDragFields(state);
  if (lockMomentum) {
    state.momentumLocked = true;
  }

  if (activeAxis === 'pull_flip') {
    const distanceFlip = rawY >= PULL_FLIP_THRESHOLD_PX;
    const flickFlip =
      rawY >= PULL_FLIP_FLICK_MIN_DISTANCE_PX && vy >= PULL_FLIP_FLICK_MIN_VELOCITY_PX_MS;
    if (!isCardFlipped && (distanceFlip || flickFlip)) {
      state.momentumLocked = true;
      state.nativePhaseInFlight = false;
      if (!state.nativeWheelActive) {
        state.cooldownUntilTs = timestampMs + 180;
      }
      state.commitGuardUntilTs = Math.max(state.commitGuardUntilTs, timestampMs + 140);
      return { kind: 'flip', pose, hapticPattern: prevHapticSide === 'pull' ? null : 'generic' };
    }
    return { kind: 'spring', pose };
  }

  if (!isCardFlipped) {
    // Unflipped horizontal drag never scores; always spring back cleanly.
    return { kind: 'spring', pose };
  }

  const absX = Math.abs(rawX);
  const absVx = Math.abs(vx);
  const sameDirectionFlick = Math.sign(rawX) !== 0 && Math.sign(rawX) === Math.sign(vx);
  const distanceCommit = absX >= SWIPE_COMMIT_THRESHOLD_PX;
  const flickCommit =
    absX >= SWIPE_FLICK_MIN_DISTANCE_PX &&
    sameDirectionFlick &&
    absVx >= SWIPE_FLICK_MIN_VELOCITY_PX_MS;

  if (distanceCommit || flickCommit) {
    const dir: 'left' | 'right' = rawX < 0 ? 'left' : 'right';
    // Mode A fixed directional mapping: Left = Again (1), Right = Good (3).
    const ease: 1 | 3 = dir === 'left' ? 1 : 3;
    state.momentumLocked = true;
    state.nativePhaseInFlight = false;
    state.committedEpoch = state.gestureEpoch;
    state.cooldownUntilTs = timestampMs + POST_COMMIT_COOLDOWN_MS;
    state.commitGuardUntilTs = timestampMs + POST_COMMIT_INERTIA_GUARD_MS;
    return {
      kind: 'rate',
      ease,
      dir,
      pose,
      velocityX: vx,
      hapticPattern: prevHapticSide === dir ? null : 'strong',
    };
  }

  return { kind: 'spring', pose };
}

export function stepNativeWheelPhase(
  state: SwipeGestureState,
  phase: NativeWheelPhase,
  inverted: boolean,
  isCardFlipped: boolean,
  timestampMs: number
): SwipeReleaseDecision {
  state.nativeWheelActive = true;
  state.inverted = Boolean(inverted);

  if (phase === 'mouse') {
    state.nativeDeviceIsMouse = true;
    state.nativePhaseInFlight = false;
    if (state.axis !== 'idle') {
      clearActiveDragFields(state);
      return { kind: 'spring', pose: computeDragVisuals(state, isCardFlipped) };
    }
    return { kind: 'none', pose: computeDragVisuals(state, isCardFlipped) };
  }

  if (phase === 'begin') {
    state.nativeDeviceIsMouse = false;
    if (timestampMs < state.commitGuardUntilTs) {
      // Ignore stray MayBegin / trailing-finger ScrollBegin during the post-commit guard
      // window so the incoming card never absorbs the outgoing card's kinetic inertia.
      return { kind: 'none', pose: computeDragVisuals(state, isCardFlipped) };
    }
    clearActiveDragFields(state);
    state.nativePhaseInFlight = true;
    state.gestureEpoch += 1;
    state.momentumLocked = false;
    state.cooldownUntilTs = 0;
    return { kind: 'none', pose: computeDragVisuals(state, isCardFlipped) };
  }

  if (phase === 'momentum') {
    state.nativePhaseInFlight = false;
    // Finger lifted into kinetic coasting: evaluate release immediately and ALWAYS lock inertia
    // (even when axis was already idle, e.g. if ScrollEnd preceded ScrollMomentum).
    const decision = stepSwipeRelease(state, isCardFlipped, timestampMs, true);
    state.momentumLocked = true;
    state.lastWheelSeenTs = Math.max(state.lastWheelSeenTs, timestampMs);
    return decision;
  }

  if (phase === 'end') {
    state.nativePhaseInFlight = false;
    if (state.axis === 'idle') {
      if (timestampMs >= state.commitGuardUntilTs) {
        state.momentumLocked = false;
      }
      state.verticalScrollLocked = false;
      return { kind: 'none', pose: computeDragVisuals(state, isCardFlipped) };
    }
    // Non-kinetic finger release directly to end.
    return stepSwipeRelease(state, isCardFlipped, timestampMs, false);
  }

  return { kind: 'none', pose: computeDragVisuals(state, isCardFlipped) };
}

export function resetSwipeForCardChange(
  state: SwipeGestureState,
  timestampMs: number,
  options?: { preserveCooldown?: boolean }
): void {
  state.lastScrolledDownTs = 0;
  state.committedEpoch = -1;
  state.nativePhaseInFlight = false;
  clearActiveDragFields(state);
  if (options?.preserveCooldown) {
    state.momentumLocked = true;
    state.lastWheelSeenTs = Math.max(state.lastWheelSeenTs, timestampMs);
    state.cooldownUntilTs = Math.max(
      state.cooldownUntilTs,
      timestampMs + CARD_MOUNT_GESTURE_GUARD_MS
    );
    state.commitGuardUntilTs = Math.max(
      state.commitGuardUntilTs,
      timestampMs + CARD_MOUNT_GESTURE_GUARD_MS
    );
    return;
  }
  state.cooldownUntilTs = Math.max(state.cooldownUntilTs, timestampMs + 140);
}

export function hasScrollableHorizontalAncestor(
  target: EventTarget | null | undefined,
  boundaryEl: Element | null | undefined,
  rawDeltaX: number
): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  let el: Element | null = target;
  while (el && el !== boundaryEl) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const style = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(el)
        : null;
      const overflowX = style?.overflowX || '';
      if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') {
        const maxScrollLeft = el.scrollWidth - el.clientWidth;
        if (rawDeltaX > 0 && el.scrollLeft < maxScrollLeft - 1) return true;
        if (rawDeltaX < 0 && el.scrollLeft > 1) return true;
        if (Math.abs(rawDeltaX) > 0 && (overflowX === 'auto' || overflowX === 'scroll')) {
          // Even at scroll boundary, let explicit scrollable tables/carousels consume tiny jitter first
          // only if currently non-zero scrollLeft.
          if (el.scrollLeft > 1 && el.scrollLeft < maxScrollLeft - 1) return true;
        }
      }
    }
    el = el.parentElement;
  }
  return false;
}
