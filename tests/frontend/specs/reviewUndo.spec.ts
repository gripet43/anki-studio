// ============================================================================
// Reviewer active-session Undo button render & state reset tests
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, equal, ok, doesNotMatch } from '../harness';
import { ReviewerView } from '../../../frontend/src/components/reviewer/ReviewerView';
import { ReviewCardItem } from '../../../frontend/src/bridge/pycmd';
import { appActions, getAppState, setAppState, UndoSnapshot } from '../../../frontend/src/stores/useAppStore';

function makeReviewCard(id = '101', front = 'Question Alpha'): ReviewCardItem {
  return {
    id,
    noteId: `n-${id}`,
    noteTypeName: 'Basic',
    isCloze: false,
    cardType: 'review',
    deckId: '1',
    deckName: 'Default',
    fullDeckName: 'Default',
    front,
    reading: '',
    meaning: 'Answer Alpha',
    etymology: '',
    example: '',
    extraHint: '',
    frontHtml: front,
    frontAnswerHtml: front,
    backHtml: 'Answer Alpha',
    audioFiles: [],
    fields: { Front: front, Back: 'Answer Alpha' },
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
  };
}

function makeUndoSnapshot(card: ReviewCardItem): UndoSnapshot {
  const s = getAppState();
  return {
    cardIndex: 0,
    card,
    previousQueue: [card, makeReviewCard('102', 'Question Beta')],
    previousDecks: s.decks,
    previousTodayStats: s.dashboard.todayStats,
    sessionStudied: 0,
    sessionCorrect: 0,
    sessionTotalTimeMs: 0,
    wasSessionComplete: false,
    wasFlipped: true,
  };
}

section('Reviewer active session · Undo inside ··· inspector drawer');

test('omits Undo from active top toolbar and renders disabled Undo inside ··· drawer when undoStack is empty', () => {
  const prev = getAppState();
  const c1 = makeReviewCard('101', 'Front 1');
  setAppState({
    inReviewMode: true,
    isSessionComplete: false,
    inlineEditing: false,
    inspectorOpen: false,
    resolvedLang: 'zh-CN',
    reviewQueue: [c1],
    currentCardIndex: 0,
    undoStack: [],
  });
  try {
    const closedHtml = renderToStaticMarkup(React.createElement(ReviewerView));
    doesNotMatch(closedHtml, /aria-label="撤销"/, 'Undo button must stay tucked inside ··· drawer, not top toolbar');

    setAppState({ inspectorOpen: true });
    const openHtml = renderToStaticMarkup(React.createElement(ReviewerView));
    const btnMatch = openHtml.match(/<button\b[^>]*aria-label="撤销"[^>]*>[\s\S]*?<\/button>/);
    ok(btnMatch, 'expected Undo button inside ··· inspector drawer with aria-label="撤销"');
    ok(/\bdisabled(?:="")?/.test(btnMatch[0]), 'Undo button should be disabled when undoStack is empty');
    ok(btnMatch[0].includes('>撤销<'), 'Undo button should display visible 撤销 label');
  } finally {
    setAppState({
      inReviewMode: prev.inReviewMode,
      isSessionComplete: prev.isSessionComplete,
      inlineEditing: prev.inlineEditing,
      inspectorOpen: prev.inspectorOpen,
      resolvedLang: prev.resolvedLang,
      reviewQueue: prev.reviewQueue,
      currentCardIndex: prev.currentCardIndex,
      undoStack: prev.undoStack,
    });
  }
});

test('enables Undo button inside ··· drawer once undoStack has a snapshot', () => {
  const prev = getAppState();
  const c1 = makeReviewCard('101', 'Front 1');
  const c2 = makeReviewCard('102', 'Front 2');
  setAppState({
    inReviewMode: true,
    isSessionComplete: false,
    inlineEditing: false,
    inspectorOpen: true,
    resolvedLang: 'zh-CN',
    reviewQueue: [c2],
    currentCardIndex: 0,
    undoStack: [makeUndoSnapshot(c1)],
  });
  try {
    const html = renderToStaticMarkup(React.createElement(ReviewerView));
    const btnMatch = html.match(/<button\b[^>]*aria-label="撤销"[^>]*>[\s\S]*?<\/button>/);
    ok(btnMatch, 'expected Undo button inside ··· inspector drawer');
    doesNotMatch(
      btnMatch[0],
      /\bdisabled\b/,
      'Undo button should be enabled when undoStack is non-empty'
    );
  } finally {
    setAppState({
      inReviewMode: prev.inReviewMode,
      isSessionComplete: prev.isSessionComplete,
      inlineEditing: prev.inlineEditing,
      inspectorOpen: prev.inspectorOpen,
      resolvedLang: prev.resolvedLang,
      reviewQueue: prev.reviewQueue,
      currentCardIndex: prev.currentCardIndex,
      undoStack: prev.undoStack,
    });
  }
});

test('renders localized Undo button label in English inside ··· drawer and clears undoStack on exitReview', () => {
  const prev = getAppState();
  const c1 = makeReviewCard('101', 'Front 1');
  setAppState({
    inReviewMode: true,
    isSessionComplete: false,
    inlineEditing: false,
    inspectorOpen: true,
    resolvedLang: 'en',
    reviewQueue: [c1],
    currentCardIndex: 0,
    undoStack: [makeUndoSnapshot(c1)],
  });
  try {
    const html = renderToStaticMarkup(React.createElement(ReviewerView));
    ok(html.includes('aria-label="Undo"') && html.includes('>Undo<'), 'expected English Undo label inside ··· drawer');
    appActions.exitReview();
    equal(getAppState().undoStack.length, 0, 'exitReview should clear session undoStack');
  } finally {
    setAppState({
      inReviewMode: prev.inReviewMode,
      isSessionComplete: prev.isSessionComplete,
      inlineEditing: prev.inlineEditing,
      inspectorOpen: prev.inspectorOpen,
      resolvedLang: prev.resolvedLang,
      reviewQueue: prev.reviewQueue,
      currentCardIndex: prev.currentCardIndex,
      undoStack: prev.undoStack,
    });
  }
});

test('renders unified 2x3 six-button action grid inside ··· drawer and wires forgetCurrentReviewCard to undoStack', () => {
  const prev = getAppState();
  const c1 = makeReviewCard('101', 'Front 1');
  const c2 = makeReviewCard('102', 'Front 2');
  setAppState({
    inReviewMode: true,
    isSessionComplete: false,
    inlineEditing: false,
    inspectorOpen: true,
    resolvedLang: 'zh-CN',
    reviewQueue: [c1, c2],
    currentCardIndex: 0,
    undoStack: [],
    libraryCards: [
      {
        id: '101',
        noteId: 'n-101',
        deckId: '1',
        deckName: 'Default',
        fullDeckName: 'Default',
        noteTypeName: 'Basic',
        isCloze: false,
        front: 'Front 1',
        back: 'Answer Alpha',
        frontHtml: 'Front 1',
        backHtml: 'Answer Alpha',
        fields: { Front: 'Front 1', Back: 'Answer Alpha' },
        fieldOrder: ['Front', 'Back'],
        tags: [],
        status: 'review',
        dueText: '5d',
        intervalDays: 5,
        difficulty: 5,
        stability: 5,
        reps: 3,
        lapses: 0,
        suspended: false,
        buried: false,
        flags: 0,
      },
    ],
  });
  try {
    const html = renderToStaticMarkup(React.createElement(ReviewerView));
    ok(html.includes('grid grid-cols-2 gap-1.5'), 'Inspector footer should use symmetric 2x3 action grid');
    ok(html.includes('aria-label="撤销"'), 'Grid slot 1: Undo');
    ok(html.includes('aria-label="重置进度"') && html.includes('>重置进度<'), 'Grid slot 2: Reset Card');
    ok(html.includes('>搁置至明日<'), 'Grid slot 3: Bury');
    ok(html.includes('>暂停卡片<'), 'Grid slot 4: Suspend');
    ok(html.includes('aria-label="复制调试信息"') && html.includes('>调试信息<'), 'Grid slot 5: Copy Debug Info');
    ok(html.includes('aria-label="删除卡片"') && html.includes('>删除卡片<'), 'Grid slot 6: Delete Card');
    ok(html.includes('bg-[var(--bg-card)]/96'), 'Inspector drawer surface must follow active paper theme via --bg-card');
    const resetBtnMatch = html.match(/<button\b[^>]*aria-label="重置进度"[^>]*>/);
    ok(
      resetBtnMatch &&
        resetBtnMatch[0].includes('bg-[var(--bg-card)]') &&
        resetBtnMatch[0].includes('justify-center'),
      'Enabled boxed inspector actions must use crisp --bg-card fill and centered alignment'
    );
    const deleteBtnMatch = html.match(/<button\b[^>]*aria-label="删除卡片"[^>]*>/);
    ok(
      deleteBtnMatch &&
        deleteBtnMatch[0].includes('bg-[var(--bg-card)]') &&
        deleteBtnMatch[0].includes('hover:bg-[var(--status-danger-soft)]'),
      'Delete action stays calm at rest and reveals danger fill only on hover or confirmation'
    );
    doesNotMatch(html, /\btitle="/, 'Inspector action grid must never emit raw HTML title= attributes');

    // Offline forget advances queue, marks library card as New, and pushes reversible undo snapshot
    void appActions.forgetCurrentReviewCard();
    equal(getAppState().reviewQueue.length, 1);
    equal(getAppState().reviewQueue[0].id, '102');
    equal(getAppState().undoStack.length, 1);
    equal(getAppState().libraryCards[0].status, 'new');
    equal(getAppState().libraryCards[0].intervalDays, 0);

    // Undo restores previous card & library snapshot cleanly
    void appActions.undoLastReview();
    equal(getAppState().reviewQueue.length, 2);
    equal(getAppState().reviewQueue[0].id, '101');
    equal(getAppState().undoStack.length, 0);
    equal(getAppState().libraryCards[0].status, 'review');
    equal(getAppState().libraryCards[0].intervalDays, 5);
  } finally {
    setAppState({
      inReviewMode: prev.inReviewMode,
      isSessionComplete: prev.isSessionComplete,
      inlineEditing: prev.inlineEditing,
      inspectorOpen: prev.inspectorOpen,
      resolvedLang: prev.resolvedLang,
      reviewQueue: prev.reviewQueue,
      currentCardIndex: prev.currentCardIndex,
      undoStack: prev.undoStack,
      libraryCards: prev.libraryCards,
      toastMessage: prev.toastMessage,
    });
  }
});
