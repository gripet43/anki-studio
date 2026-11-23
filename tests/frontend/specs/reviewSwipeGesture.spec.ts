import assert from 'node:assert/strict';
import { section, test } from '../harness';
import {
  cancelActiveSwipeDrag,
  computeDragVisuals,
  computeSwipeFlyDurationMs,
  createSwipeGestureState,
  detectDefaultNaturalScrolling,
  HORIZONTAL_LOCK_MIN_PX,
  HORIZONTAL_LOCK_SLOPE_RATIO,
  PULL_FLIP_THRESHOLD_PX,
  resetSwipeForCardChange,
  stepNativeWheelPhase,
  stepSwipeRelease,
  stepSwipeWheel,
  SWIPE_COMMIT_THRESHOLD_PX,
  TOP_ARRIVAL_SETTLE_MS,
  UNFLIPPED_MAX_WOBBLE_DEG,
  UNFLIPPED_MAX_WOBBLE_PX,
  VERTICAL_LOCK_MIN_PX,
} from '../../../frontend/src/utils/reviewSwipeGesture';

section('ReviewSwipeGesture — macOS trackpad state machine & physics');

test('unflipped horizontal swipe only wobbles with high damping and always springs back', () => {
  const state = createSwipeGestureState(true); // Natural scrolling ON: push fingers right -> deltaX < 0
  let hapticSeen = false;

  for (let i = 1; i <= 14; i++) {
    const res = stepSwipeWheel(state, {
      deltaX: -18,
      deltaY: 0,
      deltaMode: 0,
      timestampMs: 1000 + i * 16,
      isCardFlipped: false,
      atScrollTop: true,
    });
    assert.equal(res.handled, true);
    if (res.hapticPattern) hapticSeen = true;
    assert.ok(Math.abs(res.pose.visualX) <= UNFLIPPED_MAX_WOBBLE_PX + 0.01);
    assert.ok(Math.abs(res.pose.rotationDeg) <= UNFLIPPED_MAX_WOBBLE_DEG + 0.01);
    assert.equal(res.pose.progress, 0);
    assert.equal(res.pose.overThreshold, false);
  }

  assert.equal(hapticSeen, false, 'unflipped horizontal swipe must not fire haptic');
  assert.ok(state.rawX > 200, 'rawX should reflect full physical finger displacement');
  const pose = computeDragVisuals(state, false);
  assert.ok(pose.visualX > 20 && pose.visualX <= UNFLIPPED_MAX_WOBBLE_PX);

  const decision = stepSwipeRelease(state, false, 1300, true);
  assert.equal(decision.kind, 'spring', 'unflipped horizontal swipe never rates card');
});

test('unflipped two-finger pull-down flips at threshold when at top of card', () => {
  const state = createSwipeGestureState(true); // Natural scrolling ON: fingers push down -> deltaY < 0
  let hapticCount = 0;

  for (let i = 1; i <= 6; i++) {
    const res = stepSwipeWheel(state, {
      deltaX: 0,
      deltaY: -18,
      deltaMode: 0,
      timestampMs: 2000 + i * 16,
      isCardFlipped: false,
      atScrollTop: true,
    });
    assert.equal(res.handled, true);
    assert.equal(res.pose.axis, 'pull_flip');
    if (res.hapticPattern === 'generic') hapticCount += 1;
  }

  assert.ok(state.rawY >= PULL_FLIP_THRESHOLD_PX);
  assert.equal(hapticCount, 1, 'should fire firm generic haptic once at pull-flip threshold');

  const flipDecision = stepSwipeRelease(state, false, 2120, true);
  assert.equal(flipDecision.kind, 'flip');
  if (flipDecision.kind === 'flip') {
    assert.equal(flipDecision.hapticPattern, null, 'must not double-fire on release after threshold haptic');
  }
  assert.equal(state.momentumLocked, true, 'must latch momentum lock across flip');

  // If pulled down while already scrolled mid-card, leave normal vertical scroll untouched
  const midCardState = createSwipeGestureState(true);
  const scrollStep = stepSwipeWheel(midCardState, {
    deltaX: 0,
    deltaY: -22,
    deltaMode: 0,
    timestampMs: 3000,
    isCardFlipped: false,
    atScrollTop: false,
  });
  assert.equal(scrollStep.handled, false);
  assert.equal(midCardState.verticalScrollLocked, true);
});

test('flipped swipe maps Left -> Again (1) and Right -> Good (3) with hysteresis', () => {
  // Right swipe -> Good (ease 3)
  const rightState = createSwipeGestureState(false); // non-inverted: +deltaX -> +rawX
  let rightHaptics = 0;
  for (let i = 1; i <= 7; i++) {
    const res = stepSwipeWheel(rightState, {
      deltaX: 20,
      deltaY: 0,
      deltaMode: 0,
      timestampMs: 4000 + i * 20,
      isCardFlipped: true,
      atScrollTop: true,
    });
    if (res.hapticPattern === 'strong') rightHaptics += 1;
  }
  assert.equal(rightHaptics, 1, 'strong haptic should fire once on rating threshold cross');

  // Slight wobble back still inside hysteresis (> 0.78 * 110 = 85.8px), then back past 110px: still 0 extra haptics
  stepSwipeWheel(rightState, {
    deltaX: -45,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 4200,
    isCardFlipped: true,
    atScrollTop: true,
  }); // rawX = 95 (> 85.8)
  const reCrossNoReset = stepSwipeWheel(rightState, {
    deltaX: 25,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 4220,
    isCardFlipped: true,
    atScrollTop: true,
  });
  assert.equal(reCrossNoReset.hapticPattern, null, 'must not double-fire within hysteresis band');

  // Pull well inside hysteresis band (< 85.8px), then push back >= 110px: fires again
  stepSwipeWheel(rightState, {
    deltaX: -50,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 4240,
    isCardFlipped: true,
    atScrollTop: true,
  }); // rawX = 70
  const reCrossAfterReset = stepSwipeWheel(rightState, {
    deltaX: 50,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 4260,
    isCardFlipped: true,
    atScrollTop: true,
  });
  assert.equal(reCrossAfterReset.hapticPattern, 'strong');

  const rateRight = stepSwipeRelease(rightState, true, 4300, true);
  assert.equal(rateRight.kind, 'rate');
  if (rateRight.kind === 'rate') {
    assert.equal(rateRight.ease, 3);
    assert.equal(rateRight.dir, 'right');
    assert.equal(rateRight.hapticPattern, null, 'must not re-fire haptic on release after threshold cross');
    assert.ok(rateRight.pose.visualX >= SWIPE_COMMIT_THRESHOLD_PX);
  }

  // Left swipe -> Again (ease 1)
  const leftState = createSwipeGestureState(false);
  for (let i = 1; i <= 7; i++) {
    stepSwipeWheel(leftState, {
      deltaX: -20,
      deltaY: 0,
      deltaMode: 0,
      timestampMs: 5000 + i * 20,
      isCardFlipped: true,
      atScrollTop: true,
    });
  }
  const rateLeft = stepSwipeRelease(leftState, true, 5200, true);
  assert.equal(rateLeft.kind, 'rate');
  if (rateLeft.kind === 'rate') {
    assert.equal(rateLeft.ease, 1);
    assert.equal(rateLeft.dir, 'left');
  }
});

test('flipped fast flick commits below 110px while slow partial drag springs back', () => {
  // Fast flick (70px total across rapid 12ms frames -> > 1.7 px/ms)
  const flickState = createSwipeGestureState(false);
  stepSwipeWheel(flickState, {
    deltaX: 20,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 6000,
    isCardFlipped: true,
    atScrollTop: true,
  });
  stepSwipeWheel(flickState, {
    deltaX: 25,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 6012,
    isCardFlipped: true,
    atScrollTop: true,
  });
  stepSwipeWheel(flickState, {
    deltaX: 25,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 6024,
    isCardFlipped: true,
    atScrollTop: true,
  });
  const flickDecision = stepSwipeRelease(flickState, true, 6030, true);
  assert.equal(flickDecision.kind, 'rate');
  if (flickDecision.kind === 'rate') {
    assert.equal(
      flickDecision.hapticPattern,
      'strong',
      'fast flick commit below 110px threshold should still trigger strong haptic'
    );
  }

  // Slow drag (75px total spaced 50ms apart -> ~0.30 px/ms, below 110px threshold)
  const slowState = createSwipeGestureState(false);
  for (let i = 0; i < 5; i++) {
    stepSwipeWheel(slowState, {
      deltaX: 15,
      deltaY: 0,
      deltaMode: 0,
      timestampMs: 7000 + i * 50,
      isCardFlipped: true,
      atScrollTop: true,
    });
  }
  const slowDecision = stepSwipeRelease(slowState, true, 7260, true);
  assert.equal(slowDecision.kind, 'spring');
});

test('native Qt6 momentum phase commits gesture and locks inertia across card changes until begin', () => {
  const state = createSwipeGestureState(true);
  stepNativeWheelPhase(state, 'begin', true, true, 8000);
  for (let i = 1; i <= 7; i++) {
    stepSwipeWheel(state, {
      deltaX: -20, // inverted=true -> physical right (+rawX)
      deltaY: 0,
      deltaMode: 0,
      timestampMs: 8000 + i * 16,
      isCardFlipped: true,
      atScrollTop: true,
    });
  }

  const releaseOnMomentum = stepNativeWheelPhase(state, 'momentum', true, true, 8130);
  assert.equal(releaseOnMomentum.kind, 'rate');
  assert.equal(state.momentumLocked, true);

  resetSwipeForCardChange(state, 8150, { preserveCooldown: true });

  // Lingering inertia ticks must NOT drag the next card!
  const inertiaBlocked = stepSwipeWheel(state, {
    deltaX: -50,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 8200,
    isCardFlipped: true,
    atScrollTop: true,
  });
  assert.equal(inertiaBlocked.handled, false);

  // New finger touch ('begin') clears lock cleanly once past cooldown
  stepNativeWheelPhase(state, 'begin', true, true, 8600);
  const nextTouch = stepSwipeWheel(state, {
    deltaX: -24,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 8616,
    isCardFlipped: true,
    atScrollTop: true,
  });
  assert.equal(nextTouch.handled, true);
  assert.equal(nextTouch.pose.direction, 'right');

  // Mouse wheel ticks & inner horizontal scrollers are ignored
  const mouseRes = stepSwipeWheel(state, {
    deltaX: 40,
    deltaY: 0,
    deltaMode: 1,
    timestampMs: 8640,
    isCardFlipped: true,
    atScrollTop: true,
  });
  assert.equal(mouseRes.handled, false);

  const tableRes = stepSwipeWheel(state, {
    deltaX: -40,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 8660,
    isCardFlipped: true,
    atScrollTop: true,
    hasHorizontalScrollableAncestor: true,
  });
  assert.equal(tableRes.handled, false);
});

test('external physical mouse wheels (macOS NoScrollPhase or discrete Windows/Web notches) never trigger swipe or pull-flip', () => {
  // 1. macOS Qt6 native NoScrollPhase -> 'mouse' phase blocks both vertical pull-down and horizontal tilt wheel
  const macState = createSwipeGestureState(true);
  stepNativeWheelPhase(macState, 'mouse', true, false, 9000);
  const mousePull = stepSwipeWheel(macState, {
    deltaX: 0,
    deltaY: -40,
    deltaMode: 0,
    timestampMs: 9016,
    isCardFlipped: false,
    atScrollTop: true,
  });
  assert.equal(mousePull.handled, false, 'macOS mouse wheel at scrollTop=0 must never trigger pull-to-flip');

  const mouseTilt = stepSwipeWheel(macState, {
    deltaX: -80,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 9032,
    isCardFlipped: true,
    atScrollTop: true,
  });
  assert.equal(mouseTilt.handled, false, 'macOS mouse horizontal wheel must never swipe card');

  // Switching back to trackpad ('begin') re-enables smoothly
  stepNativeWheelPhase(macState, 'begin', true, true, 9100);
  const backToTrackpad = stepSwipeWheel(macState, {
    deltaX: -24,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 9116,
    isCardFlipped: true,
    atScrollTop: true,
  });
  assert.equal(backToTrackpad.handled, true);

  // 2. Non-macOS / Web fallback: discrete ±100 / ±120 mouse wheel ticks never trigger pull-flip or horizontal swipe
  const winState = createSwipeGestureState(false);
  for (let i = 0; i < 4; i++) {
    const notchPull = stepSwipeWheel(winState, {
      deltaX: 0,
      deltaY: 100,
      deltaMode: 0,
      timestampMs: 9200 + i * 30,
      isCardFlipped: false,
      atScrollTop: true,
    });
    assert.equal(notchPull.handled, false, 'Discrete 100px vertical mouse notch must not pull-flip');
  }
  const notchTilt = stepSwipeWheel(winState, {
    deltaX: 120,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 9350,
    isCardFlipped: true,
    atScrollTop: true,
  });
  assert.equal(notchTilt.handled, false, 'Discrete 120px horizontal tilt-wheel notch must not swipe');
});

test('brisk macOS pull-down (e.g. -56px tick), slight diagonal pull, and post-pause recovery work effortlessly', () => {
  // Brisk downward trackpad pull without native phase active (e.g. deltaY = -56px, deltaX = 0)
  const briskState = createSwipeGestureState(true);
  const briskStep = stepSwipeWheel(briskState, {
    deltaX: 0,
    deltaY: -56,
    deltaMode: 0,
    timestampMs: 10000,
    isCardFlipped: false,
    atScrollTop: true,
  });
  assert.equal(briskStep.handled, true, 'Brisk trackpad pull-down (-56px) must NOT be misclassified as mouse wheel');
  assert.equal(briskStep.pose.axis, 'pull_flip');

  // Fast downward flick (>= 40px & >= 0.75 px/ms) flips without needing full 72px drag
  const flickPull = createSwipeGestureState(true);
  stepSwipeWheel(flickPull, { deltaX: 2, deltaY: -18, deltaMode: 0, timestampMs: 11000, isCardFlipped: false, atScrollTop: true });
  stepSwipeWheel(flickPull, { deltaX: 1, deltaY: -26, deltaMode: 0, timestampMs: 11014, isCardFlipped: false, atScrollTop: true });
  const flickDecision = stepSwipeRelease(flickPull, false, 11020, true);
  assert.equal(flickDecision.kind, 'flip');

  // Web fallback recovery: after silence + cooldown, verticalScrollLocked and momentumLocked auto-clear on next stroke
  const recoveryState = createSwipeGestureState(true);
  stepSwipeWheel(recoveryState, { deltaX: 0, deltaY: 20, deltaMode: 0, timestampMs: 12000, isCardFlipped: false, atScrollTop: true });
  assert.equal(recoveryState.verticalScrollLocked, true);
  // 200ms later user pulls down -> must recover cleanly and lock pull_flip!
  const recovered = stepSwipeWheel(recoveryState, { deltaX: 0, deltaY: -24, deltaMode: 0, timestampMs: 12200, isCardFlipped: false, atScrollTop: true });
  assert.equal(recovered.handled, true);
  assert.equal(recovered.pose.axis, 'pull_flip');
});

test('P0 reliability: nativePhaseInFlight tracking, rapid-fire gestureEpoch, lightbox cooldown, and Windows natural scroll', () => {
  // 1. nativePhaseInFlight tracks begin -> end/momentum/mouse accurately
  const state = createSwipeGestureState(true);
  assert.equal(state.nativePhaseInFlight, false);
  stepNativeWheelPhase(state, 'begin', true, true, 100);
  assert.equal(state.nativePhaseInFlight, true);
  stepNativeWheelPhase(state, 'end', true, true, 120);
  assert.equal(state.nativePhaseInFlight, false);

  stepNativeWheelPhase(state, 'begin', true, true, 200);
  assert.equal(state.nativePhaseInFlight, true);
  stepNativeWheelPhase(state, 'mouse', true, true, 210);
  assert.equal(state.nativePhaseInFlight, false);
  assert.equal(state.nativeDeviceIsMouse, true);

  // 2. Post-commit inertia guard: stray begin/end during fly-off or right after Card 2 mount
  //    must NOT leak kinetic inertia onto the incoming card, while a real begin after guard unlocks cleanly.
  const rapid = createSwipeGestureState(true);
  stepNativeWheelPhase(rapid, 'begin', true, true, 1000);
  stepSwipeWheel(rapid, { deltaX: -75, deltaY: 0, deltaMode: 0, timestampMs: 1016, isCardFlipped: true, atScrollTop: true });
  stepSwipeWheel(rapid, { deltaX: -75, deltaY: 0, deltaMode: 0, timestampMs: 1032, isCardFlipped: true, atScrollTop: true });
  const commit = stepNativeWheelPhase(rapid, 'momentum', true, true, 1040);
  assert.equal(commit.kind, 'rate');
  assert.ok(commit.velocityX > 0, 'rate release carries horizontal release velocityX');

  // Stray ScrollBegin / finger-lift ScrollEnd during fly-off must NOT clear momentumLocked
  stepNativeWheelPhase(rapid, 'begin', true, true, 1100);
  stepNativeWheelPhase(rapid, 'end', true, true, 1110);
  assert.equal(rapid.momentumLocked, true, 'stray begin/end during post-commit guard must keep inertia locked');
  assert.equal(rapid.nativePhaseInFlight, false);

  // Card 2 mounts after 115ms fly-off; lingering macOS kinetic inertia ticks must NEVER tilt Card 2
  resetSwipeForCardChange(rapid, 1155, { preserveCooldown: true });
  stepNativeWheelPhase(rapid, 'begin', true, false, 1180); // still within 160ms mount guard
  const leakedInertia = stepSwipeWheel(rapid, {
    deltaX: -65,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 1200,
    isCardFlipped: false,
    atScrollTop: true,
  });
  assert.equal(leakedInertia.handled, false, 'incoming unflipped card must never tilt from previous card inertia');
  assert.equal(rapid.axis, 'idle');

  // Genuine new user gesture after 160ms mount guard (1155 + 160 = 1315) unlocks immediately without waiting 555ms
  stepNativeWheelPhase(rapid, 'begin', true, false, 1340);
  assert.equal(rapid.momentumLocked, false);
  assert.equal(rapid.cooldownUntilTs, 0);
  const card2Pull = stepSwipeWheel(rapid, {
    deltaX: 0,
    deltaY: -24,
    deltaMode: 0,
    timestampMs: 1356,
    isCardFlipped: false,
    atScrollTop: true,
  });
  assert.equal(card2Pull.handled, true);
  assert.equal(card2Pull.pose.axis, 'pull_flip');

  // Idle momentum phase (e.g. ScrollEnd preceded ScrollMomentum) must still latch momentumLocked
  const idleMom = createSwipeGestureState(true);
  stepNativeWheelPhase(idleMom, 'momentum', true, false, 1500);
  assert.equal(idleMom.momentumLocked, true);
  const blockedIdleMom = stepSwipeWheel(idleMom, {
    deltaX: -40,
    deltaY: 0,
    deltaMode: 0,
    timestampMs: 1516,
    isCardFlipped: false,
    atScrollTop: true,
  });
  assert.equal(blockedIdleMom.handled, false);

  // 3. Non-commit lightbox close with preserveCooldown still latches momentumLocked + cooldown
  const lightbox = createSwipeGestureState(true);
  stepNativeWheelPhase(lightbox, 'begin', true, true, 2000);
  stepNativeWheelPhase(lightbox, 'end', true, true, 2020);
  assert.equal(lightbox.committedEpoch, -1);
  resetSwipeForCardChange(lightbox, 2100, { preserveCooldown: true });
  assert.equal(lightbox.momentumLocked, true);
  assert.ok(lightbox.cooldownUntilTs >= 2240);

  // 4. Windows Precision Touchpad defaults natural scrolling to true
  const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        platform: 'Win32',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    assert.equal(detectDefaultNaturalScrolling(), true);
  } finally {
    if (origNavDesc) {
      Object.defineProperty(globalThis, 'navigator', origNavDesc);
    } else {
      delete (globalThis as Record<string, unknown>).navigator;
    }
  }
});

test('P1 physics & polish: 1.5 slope cone, top-arrival settle, velocity fly duration, and cancelActiveSwipeDrag', () => {
  assert.equal(HORIZONTAL_LOCK_MIN_PX, 9);
  assert.equal(HORIZONTAL_LOCK_SLOPE_RATIO, 1.5);
  assert.equal(VERTICAL_LOCK_MIN_PX, 10);
  assert.equal(TOP_ARRIVAL_SETTLE_MS, 220);

  // Diagonal 38-deg stroke on flipped card (ratio 10/8 = 1.25 < 1.5) locks vertically instead of horizontally
  const diag = createSwipeGestureState(true);
  const d1 = stepSwipeWheel(diag, { deltaX: -10, deltaY: 8, deltaMode: 0, timestampMs: 1000, isCardFlipped: true, atScrollTop: true });
  const d2 = stepSwipeWheel(diag, { deltaX: -10, deltaY: 8, deltaMode: 0, timestampMs: 1016, isCardFlipped: true, atScrollTop: true });
  assert.equal(d1.handled, false);
  assert.equal(d2.handled, false);
  assert.equal(diag.verticalScrollLocked, true);

  // Crisp horizontal swipe on flipped card locks horizontal immediately
  const horiz = createSwipeGestureState(true);
  const h1 = stepSwipeWheel(horiz, { deltaX: -10, deltaY: 2, deltaMode: 0, timestampMs: 1000, isCardFlipped: true, atScrollTop: true });
  assert.equal(h1.handled, true);
  assert.equal(horiz.axis, 'horizontal');

  // Top-arrival settle prevents accidental pull_flip immediately after scrolling up to top
  const settle = createSwipeGestureState(true);
  stepSwipeWheel(settle, { deltaX: 0, deltaY: -24, deltaMode: 0, timestampMs: 1000, isCardFlipped: false, atScrollTop: false });
  const prematurePull = stepSwipeWheel(settle, { deltaX: 0, deltaY: -18, deltaMode: 0, timestampMs: 1120, isCardFlipped: false, atScrollTop: true });
  assert.equal(prematurePull.handled, false);
  assert.notEqual(settle.axis, 'pull_flip');
  // After TOP_ARRIVAL_SETTLE_MS + scroll-lock pause recovery, downward pull engages pull_flip cleanly
  const settledPull = stepSwipeWheel(settle, { deltaX: 0, deltaY: -18, deltaMode: 0, timestampMs: 1300, isCardFlipped: false, atScrollTop: true });
  assert.equal(settledPull.handled, true);
  assert.equal(settledPull.pose.axis, 'pull_flip');

  // Velocity-adaptive fly duration: slow -> 205ms, fast -> 115ms, monotonic
  assert.equal(computeSwipeFlyDurationMs(0), 205);
  assert.equal(computeSwipeFlyDurationMs(1.8), 115);
  assert.equal(computeSwipeFlyDurationMs(-3.2), 115);
  assert.ok(computeSwipeFlyDurationMs(0.6) > computeSwipeFlyDurationMs(1.2));

  // cancelActiveSwipeDrag resets every transient field cleanly
  const cancelState = createSwipeGestureState(true);
  assert.equal(cancelActiveSwipeDrag(cancelState), false);
  stepSwipeWheel(cancelState, { deltaX: -30, deltaY: 0, deltaMode: 0, timestampMs: 5000, isCardFlipped: true, atScrollTop: true });
  stepSwipeWheel(cancelState, { deltaX: -30, deltaY: 0, deltaMode: 0, timestampMs: 5016, isCardFlipped: true, atScrollTop: true });
  cancelState.velocityY = 0.75;
  assert.equal(cancelActiveSwipeDrag(cancelState), true);
  assert.equal(cancelState.axis, 'idle');
  assert.equal(cancelState.rawX, 0);
  assert.equal(cancelState.rawY, 0);
  assert.equal(cancelState.velocityX, 0);
  assert.equal(cancelState.velocityY, 0);
  assert.equal(cancelState.lastEventTs, 0);
  assert.equal(cancelState.hapticFiredForSide, null);
  assert.equal(cancelActiveSwipeDrag(cancelState), false);
});

test('Linux X11 touchpad phase unlocks mouse lock, syncs OS inverted flag, and preserves silence-timer release', () => {
  const st = createSwipeGestureState(false);

  // First, a Linux external mouse horizontal wheel locks swipe gestures
  stepNativeWheelPhase(st, 'mouse', false, true, 100);
  assert.equal(st.nativeDeviceIsMouse, true);
  assert.equal(
    stepSwipeWheel(st, {
      deltaX: 60,
      deltaY: 0,
      deltaMode: 0,
      isCardFlipped: true,
      atScrollTop: true,
      timestampMs: 110,
    }).handled,
    false
  );

  // Switching back to a Linux X11 precision trackpad unlocks mouse lock without requiring native ScrollEnd
  stepNativeWheelPhase(st, 'touchpad', true, true, 200);
  assert.equal(st.nativeDeviceIsMouse, false);
  assert.equal(st.nativeWheelActive, false);
  assert.equal(st.nativePhaseInFlight, false);
  assert.equal(st.inverted, true);

  // Subsequent trackpad swipe (progressive precision pixel deltas) moves smoothly with synced inverted=true
  let move = stepSwipeWheel(st, {
    deltaX: -28,
    deltaY: 0,
    deltaMode: 0,
    isCardFlipped: true,
    atScrollTop: true,
    timestampMs: 220,
  });
  for (let i = 1; i <= 3; i++) {
    move = stepSwipeWheel(st, {
      deltaX: -28,
      deltaY: 0,
      deltaMode: 0,
      isCardFlipped: true,
      atScrollTop: true,
      timestampMs: 220 + i * 16,
    });
  }
  assert.equal(move.handled, true);
  assert.equal(move.pose.axis, 'horizontal');
  assert.ok(move.pose.visualX > 0, 'synced natural scrolling moves visualX rightward on negative deltaX');
});
