// ============================================================================
// One-Time Earned Support Prompt & About AnkiWeb Guide Tests
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { eq, equal, ok, section, test } from '../harness';
import { ReviewerView } from '../../../frontend/src/components/reviewer/ReviewerView';
import type { ReviewCardItem } from '../../../frontend/src/bridge/pycmd';
import { translate } from '../../../frontend/src/i18n/translations';
import { appActions, getAppState, setAppState } from '../../../frontend/src/stores/useAppStore';
import {
  ANKIWEB_ADDON_URL,
  GITHUB_ISSUES_URL,
  normalizeSupportPromptStatus,
  resolveFeedbackChannel,
  shouldShowSupportPrompt,
  SUPPORT_PROMPT_MIN_STREAK_DAYS,
  XIAOHONGSHU_PROFILE_URL,
} from '../../../frontend/src/utils/supportPrompt';

section('support prompt · eligibility, feedback routing & SSR');

test('shouldShowSupportPrompt enforces streak >= 3, idle status, studied > 0, and non-preview/non-rollover', () => {
  equal(SUPPORT_PROMPT_MIN_STREAK_DAYS, 3);
  equal(normalizeSupportPromptStatus('LIKED'), 'liked');
  equal(normalizeSupportPromptStatus('invalid-junk'), 'idle');

  equal(
    shouldShowSupportPrompt({
      status: 'idle',
      streakDays: 2,
      sessionStudiedCount: 15,
      isPreviewSession: false,
      isNewDayReady: false,
    }),
    false,
    'streak < 3 must not show support prompt'
  );

  equal(
    shouldShowSupportPrompt({
      status: 'idle',
      streakDays: 3,
      sessionStudiedCount: 15,
      isPreviewSession: false,
      isNewDayReady: false,
    }),
    true,
    'streak >= 3 with idle status and studied cards must show support prompt'
  );

  for (const status of ['liked', 'feedback', 'dismissed'] as const) {
    equal(
      shouldShowSupportPrompt({
        status,
        streakDays: 10,
        sessionStudiedCount: 20,
        isPreviewSession: false,
        isNewDayReady: false,
      }),
      false,
      `non-idle status ${status} must permanently suppress prompt`
    );
  }

  equal(
    shouldShowSupportPrompt({
      status: 'idle',
      streakDays: 5,
      sessionStudiedCount: 5,
      isPreviewSession: true,
      isNewDayReady: false,
    }),
    false,
    'preview sessions must not show support prompt'
  );

  equal(
    shouldShowSupportPrompt({
      status: 'idle',
      streakDays: 5,
      sessionStudiedCount: 5,
      isPreviewSession: false,
      isNewDayReady: true,
    }),
    false,
    'new-day rollover screen must not show support prompt'
  );

  equal(
    shouldShowSupportPrompt({
      status: 'idle',
      streakDays: 5,
      sessionStudiedCount: 0,
      isPreviewSession: false,
      isNewDayReady: false,
    }),
    false,
    'zero studied cards in session must not show support prompt'
  );
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

test('ReviewerView session-complete renders .reviewer-support-note only when eligible', () => {
  const prev = getAppState();
  const snapshot = {
    inReviewMode: prev.inReviewMode,
    isSessionComplete: prev.isSessionComplete,
    isPreviewSession: prev.isPreviewSession,
    resolvedLang: prev.resolvedLang,
    sessionStudiedCount: prev.sessionStudiedCount,
    sessionCorrectCount: prev.sessionCorrectCount,
    sessionTotalTimeMs: prev.sessionTotalTimeMs,
    reviewScopeDeckId: prev.reviewScopeDeckId,
    pendingDayRollover: prev.pendingDayRollover,
    supportPromptStatus: prev.supportPromptStatus,
    dashboard: prev.dashboard,
  };

  try {
    setAppState({
      inReviewMode: true,
      isSessionComplete: true,
      isPreviewSession: false,
      resolvedLang: 'zh-CN',
      sessionStudiedCount: 12,
      sessionCorrectCount: 11,
      sessionTotalTimeMs: 120000,
      reviewScopeDeckId: 'all',
      pendingDayRollover: null,
      supportPromptStatus: 'idle',
      dashboard: {
        ...prev.dashboard,
        streak: { ...prev.dashboard.streak, current: 3 },
      },
    });

    const eligibleHtml = renderToStaticMarkup(React.createElement(ReviewerView));
    ok(eligibleHtml.includes('reviewer-support-note'), 'streak === 3 & idle must render support note');
    ok(
      eligibleHtml.includes(translate('zh-CN', 'supportPromptAskTitle', { days: 3 })),
      'ask headline renders dynamic streak count'
    );
    const completeBtns = Array.from(
      eligibleHtml.matchAll(/class="reviewer-complete-btn reviewer-complete-btn--(primary|secondary)"/g)
    );
    equal(completeBtns.length, 2, 'celebration card still has exactly 2 .reviewer-complete-btn buttons');

    setAppState({
      dashboard: {
        ...prev.dashboard,
        streak: { ...prev.dashboard.streak, current: 2 },
      },
    });
    const belowStreakHtml = renderToStaticMarkup(React.createElement(ReviewerView));
    ok(
      !belowStreakHtml.includes('reviewer-support-note'),
      'streak === 2 must not render support note'
    );

    setAppState({
      supportPromptStatus: 'dismissed',
      dashboard: {
        ...prev.dashboard,
        streak: { ...prev.dashboard.streak, current: 7 },
      },
    });
    const dismissedHtml = renderToStaticMarkup(React.createElement(ReviewerView));
    ok(
      !dismissedHtml.includes('reviewer-support-note'),
      'dismissed status must not render support note even with high streak'
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
    // Non-last cards keep answerCurrentCard & undoLastReview completely synchronous.
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
