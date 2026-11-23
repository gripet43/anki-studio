// ============================================================================
// Celebratory Support Modal, Scientific Cadence & About AnkiWeb Guide Tests
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { eq, equal, ok, section, test } from '../harness';
import { SupportPromptModal } from '../../../frontend/src/components/common/SupportPromptModal';
import { DashboardView } from '../../../frontend/src/components/dashboard/DashboardView';
import type { ReviewCardItem, SupportPromptState } from '../../../frontend/src/bridge/pycmd';
import { translate } from '../../../frontend/src/i18n/translations';
import { appActions, getAppState, setAppState } from '../../../frontend/src/stores/useAppStore';
import {
  ANKIWEB_ADDON_URL,
  applySupportPromptOutcome,
  DEFAULT_SUPPORT_PROMPT_STATE,
  GITHUB_ISSUES_URL,
  normalizeSupportPromptState,
  resolveFeedbackChannel,
  shouldTriggerSupportPromptModal,
  SUPPORT_PROMPT_COOLDOWN_FEEDBACK_SEC,
  SUPPORT_PROMPT_COOLDOWN_FINAL_SEC,
  SUPPORT_PROMPT_COOLDOWN_SECOND_SEC,
  SUPPORT_PROMPT_COOLDOWN_VERSION_BUMP_SEC,
  SUPPORT_PROMPT_MIN_SESSION_ACCURACY,
  SUPPORT_PROMPT_MIN_STREAK_DAYS,
  XIAOHONGSHU_PROFILE_URL,
} from '../../../frontend/src/utils/supportPrompt';

section('support prompt · scientific reminder cadence, transitions & SSR');

const NOW = 1_795_400_000;

test('normalizeSupportPromptState handles structured dicts, invalid values, and legacy strings', () => {
  eq(normalizeSupportPromptState(undefined), DEFAULT_SUPPORT_PROMPT_STATE);
  eq(normalizeSupportPromptState('liked'), {
    status: 'liked',
    promptCount: 1,
    lastPromptedAt: 0,
    lastVersion: '',
  });
  eq(normalizeSupportPromptState('dismissed'), {
    status: 'snoozed',
    promptCount: 1,
    lastPromptedAt: 0,
    lastVersion: '',
  });
  eq(
    normalizeSupportPromptState({
      status: 'INVALID',
      prompt_count: 10,
      last_prompted_at: -10,
      last_version: ' 1.7.3 ',
    }),
    { status: 'idle', promptCount: 3, lastPromptedAt: 0, lastVersion: '1.7.3' }
  );
});

test('shouldTriggerSupportPromptModal enforces streak, Peak-End quality, cooldowns, and hard cap', () => {
  equal(SUPPORT_PROMPT_MIN_STREAK_DAYS, 3);
  equal(SUPPORT_PROMPT_MIN_SESSION_ACCURACY, 60);

  const base = {
    state: { ...DEFAULT_SUPPORT_PROMPT_STATE },
    streakDays: 3,
    sessionStudiedCount: 12,
    sessionAccuracyPct: 85,
    isPreviewSession: false,
    isNewDayReady: false,
    zenMode: false,
    studioVersion: '1.7.3',
    nowSec: NOW,
  };

  equal(shouldTriggerSupportPromptModal(base), true, 'Day 3 smooth session must trigger prompt #1');
  equal(
    shouldTriggerSupportPromptModal({ ...base, streakDays: 2 }),
    false,
    'streak < 3 must not trigger prompt'
  );
  equal(
    shouldTriggerSupportPromptModal({ ...base, sessionAccuracyPct: 59 }),
    false,
    'frustrated session (< 60% accuracy) must suppress prompt under Peak-End rule'
  );
  equal(
    shouldTriggerSupportPromptModal({ ...base, zenMode: true }),
    false,
    'Zen Mode must never show support modal'
  );
  equal(
    shouldTriggerSupportPromptModal({ ...base, isPreviewSession: true }),
    false,
    'preview session must suppress modal'
  );
  equal(
    shouldTriggerSupportPromptModal({ ...base, isNewDayReady: true }),
    false,
    'new-day rollover screen must suppress modal'
  );
  equal(
    shouldTriggerSupportPromptModal({ ...base, sessionStudiedCount: 0 }),
    false,
    'zero studied cards must suppress modal'
  );

  for (const terminal of ['liked', 'opted_out', 'exhausted'] as const) {
    equal(
      shouldTriggerSupportPromptModal({
        ...base,
        streakDays: 30,
        state: { status: terminal, promptCount: 1, lastPromptedAt: 1, lastVersion: '1.7.0' },
      }),
      false,
      `terminal status ${terminal} must stay permanently silent`
    );
  }

  // Attempt #2 cooldown: 14 days for snoozed / opened_unconfirmed
  for (const pendingStatus of ['snoozed', 'opened_unconfirmed'] as const) {
    const attempt1: SupportPromptState = {
      status: pendingStatus,
      promptCount: 1,
      lastPromptedAt: NOW - SUPPORT_PROMPT_COOLDOWN_SECOND_SEC + 60,
      lastVersion: '1.7.3',
    };
    equal(
      shouldTriggerSupportPromptModal({ ...base, state: attempt1 }),
      false,
      `${pendingStatus} count=1 must wait full 14 days`
    );
    equal(
      shouldTriggerSupportPromptModal({
        ...base,
        state: { ...attempt1, lastPromptedAt: NOW - SUPPORT_PROMPT_COOLDOWN_SECOND_SEC },
      }),
      true,
      `${pendingStatus} count=1 triggers at 14 days`
    );
  }

  // Attempt #3 cooldown: 30 days same version OR 14 days after version upgrade
  const attempt2SameVer: SupportPromptState = {
    status: 'snoozed',
    promptCount: 2,
    lastPromptedAt: NOW - SUPPORT_PROMPT_COOLDOWN_VERSION_BUMP_SEC,
    lastVersion: '1.7.3',
  };
  equal(
    shouldTriggerSupportPromptModal({ ...base, state: attempt2SameVer, studioVersion: '1.7.3' }),
    false,
    'count=2 on same version must wait full 30 days'
  );
  equal(
    shouldTriggerSupportPromptModal({ ...base, state: attempt2SameVer, studioVersion: '1.7.4' }),
    true,
    'count=2 triggers after 14 days when studioVersion bumped'
  );
  equal(
    shouldTriggerSupportPromptModal({
      ...base,
      state: { ...attempt2SameVer, lastPromptedAt: NOW - SUPPORT_PROMPT_COOLDOWN_FINAL_SEC },
      studioVersion: '1.7.3',
    }),
    true,
    'count=2 triggers at 30 days even without version bump'
  );

  // Hard cap: promptCount >= 3 never triggers again
  equal(
    shouldTriggerSupportPromptModal({
      ...base,
      state: { status: 'snoozed', promptCount: 3, lastPromptedAt: 0, lastVersion: '1.0.0' },
    }),
    false,
    'promptCount >= 3 must hit hard cap'
  );

  // Feedback recovery gate: 21+ days AND version bump required
  const fbState: SupportPromptState = {
    status: 'feedback',
    promptCount: 1,
    lastPromptedAt: NOW - SUPPORT_PROMPT_COOLDOWN_FEEDBACK_SEC,
    lastVersion: '1.7.3',
  };
  equal(
    shouldTriggerSupportPromptModal({ ...base, state: fbState, studioVersion: '1.7.3' }),
    false,
    'feedback state must not re-prompt until user upgrades version'
  );
  equal(
    shouldTriggerSupportPromptModal({
      ...base,
      state: { ...fbState, lastPromptedAt: NOW - SUPPORT_PROMPT_COOLDOWN_FEEDBACK_SEC + 10 },
      studioVersion: '1.8.0',
    }),
    false,
    'feedback state with version bump must still wait 21 days'
  );
  equal(
    shouldTriggerSupportPromptModal({ ...base, state: fbState, studioVersion: '1.8.0' }),
    true,
    'feedback state triggers gentle check-in after 21 days + version bump'
  );
});

test('applySupportPromptOutcome transitions counts and promotes 3rd defer to exhausted', () => {
  const s1 = applySupportPromptOutcome(DEFAULT_SUPPORT_PROMPT_STATE, 'opened_unconfirmed', '1.7.3', NOW);
  eq(s1, { status: 'opened_unconfirmed', promptCount: 1, lastPromptedAt: NOW, lastVersion: '1.7.3' });

  const s2 = applySupportPromptOutcome(s1, 'snoozed', '1.7.3', NOW + 100);
  eq(s2, { status: 'snoozed', promptCount: 2, lastPromptedAt: NOW + 100, lastVersion: '1.7.3' });

  const s3 = applySupportPromptOutcome(s2, 'opened_unconfirmed', '1.7.4', NOW + 200);
  eq(s3, { status: 'exhausted', promptCount: 3, lastPromptedAt: NOW + 200, lastVersion: '1.7.4' });

  const liked = applySupportPromptOutcome(s2, 'liked', '1.7.3', NOW + 300);
  eq(liked, { status: 'liked', promptCount: 2, lastPromptedAt: NOW + 300, lastVersion: '1.7.3' });

  const optedOut = applySupportPromptOutcome(s1, 'opted_out', '1.7.3', NOW + 400);
  eq(optedOut, { status: 'opted_out', promptCount: 1, lastPromptedAt: NOW + 400, lastVersion: '1.7.3' });

  const fb = applySupportPromptOutcome(DEFAULT_SUPPORT_PROMPT_STATE, 'feedback', '1.7.3', NOW + 500);
  eq(fb, { status: 'feedback', promptCount: 1, lastPromptedAt: NOW + 500, lastVersion: '1.7.3' });
});

test('resolveFeedbackChannel routes zh-CN/zh-TW to Xiaohongshu and all other locales to GitHub', () => {
  eq(resolveFeedbackChannel('zh-CN'), { channel: 'xiaohongshu', url: XIAOHONGSHU_PROFILE_URL });
  eq(resolveFeedbackChannel('zh-TW'), { channel: 'xiaohongshu', url: XIAOHONGSHU_PROFILE_URL });
  for (const lang of ['en', 'ja', 'ko', 'de', 'fr', 'es', 'ar', 'ru'] as const) {
    eq(
      resolveFeedbackChannel(lang),
      { channel: 'github', url: GITHUB_ISSUES_URL },
      `${lang} should route feedback to GitHub Issues`
    );
  }
  ok(!ANKIWEB_ADDON_URL.includes('?cb='), 'ANKIWEB_ADDON_URL should be canonical without cb query');
});

test('SupportPromptModal renders cleanly via SSR and Dashboard omits dev test trigger', () => {
  const prev = getAppState();
  const snapshot = {
    supportPromptModalOpen: prev.supportPromptModalOpen,
    supportPromptModalTestMode: prev.supportPromptModalTestMode,
    supportPrompt: prev.supportPrompt,
    customNickname: prev.customNickname,
    resolvedLang: prev.resolvedLang,
    dashboard: prev.dashboard,
    decks: prev.decks,
    isInitialSyncing: prev.isInitialSyncing,
    syncing: prev.syncing,
  };

  try {
    setAppState({
      resolvedLang: 'zh-CN',
      isInitialSyncing: false,
      syncing: false,
      supportPromptModalOpen: false,
      customNickname: '耀',
      supportPrompt: { status: 'idle', promptCount: 0, lastPromptedAt: 0, lastVersion: '1.7.3' },
      dashboard: {
        ...prev.dashboard,
        userName: '测试账号',
        streak: { ...prev.dashboard.streak, current: 5 },
      },
    });

    const dashHtml = renderToStaticMarkup(React.createElement(DashboardView));
    ok(
      !dashHtml.includes('data-support-prompt-test="dashboard"'),
      'production DashboardView must NOT expose temporary support-prompt test button'
    );

    const closedModalHtml = renderToStaticMarkup(React.createElement(SupportPromptModal));
    equal(closedModalHtml, '', 'closed SupportPromptModal must render nothing');

    setAppState({ supportPromptModalOpen: true, supportPromptModalTestMode: false });
    const askHtml = renderToStaticMarkup(React.createElement(SupportPromptModal));
    ok(
      askHtml.includes('<dialog') &&
        askHtml.includes('class="support-dialog"') &&
        askHtml.includes('closedby="closerequest"') &&
        !askHtml.includes('role="dialog"') &&
        !askHtml.includes('aria-modal'),
      'open modal renders native <dialog class="support-dialog" closedby="closerequest"> without backdrop light-dismiss or redundant ARIA'
    );
    ok(askHtml.includes('./creator-avatar.jpg'), 'ask stage renders creator avatar');
    ok(
      askHtml.includes(translate('zh-CN', 'supportPromptStreakGreeting', { name: '耀', days: 5 })),
      'streak eyebrow renders personalized greeting with active streak days'
    );
    ok(
      askHtml.includes('support-heart-svg'),
      'Positive choice card includes hover-illuminated heart icon'
    );
    ok(
      askHtml.includes(translate('zh-CN', 'supportPromptPositiveBtn')) &&
        askHtml.includes(translate('zh-CN', 'supportPromptNegativeBtn')),
      'default ask stage renders two-step Positive/Negative choice cards'
    );
    ok(
      !askHtml.includes(translate('zh-CN', 'supportPromptAlreadyLikedBtn')) &&
        !askHtml.includes(translate('zh-CN', 'supportPromptLaterBtn')),
      'Step 1 default ask stage omits premature "already liked" and redundant "maybe later" links'
    );

    setAppState({
      supportPrompt: {
        status: 'opened_unconfirmed',
        promptCount: 1,
        lastPromptedAt: NOW - SUPPORT_PROMPT_COOLDOWN_SECOND_SEC,
        lastVersion: '1.7.3',
      },
    });
    const returnAskHtml = renderToStaticMarkup(React.createElement(SupportPromptModal));
    ok(
      returnAskHtml.includes(translate('zh-CN', 'supportPromptReturnAskTitle')) &&
        returnAskHtml.includes(translate('zh-CN', 'supportPromptConfirmLikedBtn')) &&
        returnAskHtml.includes(translate('zh-CN', 'supportPromptOptOutBtn')),
      'opened_unconfirmed re-prompt renders return-check question and explicit Opt-Out link'
    );
  } finally {
    setAppState(snapshot);
  }
});

test('answerCurrentCard advances Day-2 streak to Day-3 on first review without double-increment and undo restores it', () => {
  const makeCard = (id: string): ReviewCardItem => ({
    id,
    noteId: `n-${id}`,
    noteTypeName: 'Basic',
    isCloze: false,
    cardType: 'review',
    deckId: '1',
    deckName: 'Default',
    fullDeckName: 'Default',
    front: `Q-${id}`,
    reading: '',
    meaning: `A-${id}`,
    etymology: '',
    example: '',
    extraHint: '',
    frontHtml: `Q-${id}`,
    frontAnswerHtml: `Q-${id}`,
    backHtml: `A-${id}`,
    audioFiles: [],
    fields: { Front: `Q-${id}`, Back: `A-${id}` },
    fieldOrder: ['Front', 'Back'],
    tags: [],
    reps: 1,
    lapses: 0,
    intervalDays: 1,
    stability: 1,
    difficulty: 5,
    lastReviewText: '1d',
    suspended: false,
    flags: 0,
    predictions: { again: '10m', hard: '2d', good: '4d', easy: '9d' },
    history: [],
  });

  const prev = getAppState();
  const snapshot = {
    inReviewMode: prev.inReviewMode,
    isSessionComplete: prev.isSessionComplete,
    isPreviewSession: prev.isPreviewSession,
    isCardFlipped: prev.isCardFlipped,
    reviewQueue: prev.reviewQueue,
    currentCardIndex: prev.currentCardIndex,
    undoStack: prev.undoStack,
    sessionStudiedCount: prev.sessionStudiedCount,
    sessionCorrectCount: prev.sessionCorrectCount,
    sessionTotalTimeMs: prev.sessionTotalTimeMs,
    pendingDayRollover: prev.pendingDayRollover,
    dayBoundary: prev.dayBoundary,
    toastMessage: prev.toastMessage,
    zenMode: prev.zenMode,
    dashboard: prev.dashboard,
  };

  try {
    setAppState({
      inReviewMode: true,
      isSessionComplete: false,
      isPreviewSession: false,
      isCardFlipped: true,
      zenMode: false,
      reviewQueue: [makeCard('301'), makeCard('302'), makeCard('303')],
      currentCardIndex: 0,
      undoStack: [],
      sessionStudiedCount: 0,
      sessionCorrectCount: 0,
      sessionTotalTimeMs: 0,
      pendingDayRollover: null,
      dayBoundary: null,
      dashboard: {
        ...prev.dashboard,
        todayStats: {
          ...prev.dashboard.todayStats,
          completed: 0,
          dueReview: 3,
          dueNew: 0,
          totalPending: 3,
        },
        streak: { ...prev.dashboard.streak, current: 2, longest: 2 },
      },
    });

    void appActions.answerCurrentCard(3);
    equal(getAppState().dashboard.todayStats.completed, 1);
    equal(
      getAppState().dashboard.streak.current,
      3,
      'first review of the day must optimistically advance Day-2 streak to Day-3'
    );
    equal(getAppState().dashboard.streak.longest, 3, 'longest streak updates alongside current streak');

    void appActions.answerCurrentCard(3);
    equal(getAppState().dashboard.todayStats.completed, 2);
    equal(
      getAppState().dashboard.streak.current,
      3,
      'subsequent reviews on the same day must not double-increment streak'
    );

    void appActions.undoLastReview();
    equal(getAppState().dashboard.todayStats.completed, 1);
    equal(getAppState().dashboard.streak.current, 3, 'undoing second card keeps today streak at 3');

    void appActions.undoLastReview();
    equal(getAppState().dashboard.todayStats.completed, 0);
    equal(getAppState().dashboard.streak.current, 2, 'undoing first card of the day restores Day-2 streak');
    equal(getAppState().dashboard.streak.longest, 2, 'undoing first card restores previous longest streak');
  } finally {
    setAppState(snapshot);
  }
});
