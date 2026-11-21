import assert from 'node:assert/strict';
import { section, test } from '../harness';
import {
  computeDragVisuals,
  createSwipeGestureState,
  PULL_FLIP_THRESHOLD_PX,
  resetSwipeForCardChange,
  stepNativeWheelPhase,
  stepSwipeRelease,
  stepSwipeWheel,
  SWIPE_COMMIT_THRESHOLD_PX,
  UNFLIPPED_MAX_WOBBLE_DEG,
  UNFLIPPED_MAX_WOBBLE_PX,
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
    if (res.hapticPattern === 'alignment') hapticCount += 1;
  }

  assert.ok(state.rawY >= PULL_FLIP_THRESHOLD_PX);
  assert.equal(hapticCount, 1, 'should fire alignment haptic once at threshold');

  const flipDecision = stepSwipeRelease(state, false, 2120, true);
  assert.equal(flipDecision.kind, 'flip');
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
    if (res.hapticPattern === 'alignment') rightHaptics += 1;
  }
  assert.equal(rightHaptics, 1, 'haptic should fire once on threshold cross');

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
  assert.equal(reCrossAfterReset.hapticPattern, 'alignment');

  const rateRight = stepSwipeRelease(rightState, true, 4300, true);
  assert.equal(rateRight.kind, 'rate');
  if (rateRight.kind === 'rate') {
    assert.equal(rateRight.ease, 3);
    assert.equal(rateRight.dir, 'right');
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
