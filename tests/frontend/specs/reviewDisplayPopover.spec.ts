// ============================================================================
// Reviewer Display Popover UI / Accessibility & Cleanup Specs
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, ok, doesNotMatch } from '../harness';
import { ReviewerView } from '../../../frontend/src/components/reviewer/ReviewerView';
import { ReviewCardItem } from '../../../frontend/src/bridge/pycmd';
import { getAppState, setAppState } from '../../../frontend/src/stores/useAppStore';

function makeReviewCard(overrides: Partial<ReviewCardItem> = {}): ReviewCardItem {
  return {
    id: '201',
    noteId: 'n-201',
    notetypeId: 'nt-basic',
    noteTypeName: 'Basic',
    isCloze: false,
    cardType: 'review',
    deckId: '1',
    deckName: 'Default',
    fullDeckName: 'Default',
    front: 'Prompt',
    reading: '',
    meaning: 'Answer',
    etymology: '',
    example: '',
    extraHint: '',
    frontHtml: 'Prompt',
    frontAnswerHtml: 'Prompt',
    backHtml: 'Answer',
    audioFiles: [],
    fields: { Front: 'Prompt', Back: 'Answer' },
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
    ...overrides,
  };
}

function extractDisplayPopoverHtml(fullHtml: string): string {
  const start = fullHtml.indexOf('popover="auto"');
  const displayIdx = start !== -1 ? fullHtml.indexOf('--reviewer-display-anchor', start) : -1;
  ok(start !== -1 && displayIdx !== -1, 'expected ReviewerView to render display popover anchor');
  const openTagStart = fullHtml.lastIndexOf('<div', displayIdx);
  const progressIdx = fullHtml.indexOf('<progress class="reviewer-progress"', displayIdx);
  ok(openTagStart !== -1 && progressIdx !== -1, 'expected bounded display popover slice');
  return fullHtml.slice(openTagStart, progressIdx);
}

section('Reviewer Display Popover · Semantic Controls & Noise Reduction');

test('renders semantic width fieldset radio cards, keycap scale stepper, anki-switch-sm, and zero pixel/hint clutter at default', () => {
  const prev = getAppState();
  setAppState({
    inReviewMode: true,
    isSessionComplete: false,
    inlineEditing: false,
    resolvedLang: 'zh-CN',
    theme: 'light',
    systemDark: false,
    reviewContentScale: 100,
    reviewStageWidth: 'auto',
    sandboxNoteTypeIds: ['nt-basic'],
    reviewQueue: [makeReviewCard()],
    currentCardIndex: 0,
  });
  try {
    const html = renderToStaticMarkup(React.createElement(ReviewerView));
    const pop = extractDisplayPopoverHtml(html);

    // Compact header omits disabled reset clutter when already at default state
    ok(pop.includes('>视图与字号<'), 'expected header title 视图与字号');
    const resetBtn = pop.match(/<button\b[^>]*aria-label="恢复默认"[^>]*>[\s\S]*?<\/button>/);
    ok(!resetBtn, 'reset button should stay hidden when already at default 100% + auto');
    const outerPopoverOpenTag = pop.match(/^<div\b[^>]*>/)?.[0] || '';
    doesNotMatch(
      outerPopoverOpenTag,
      /\b(?:flex|inline-flex|grid|inline-grid|block|inline-block)\b/,
      'outer [popover] root must never set unconditional display utility classes (would override UA display:none and create invisible clickable ghost overlays)',
    );
    ok(pop.includes('flex flex-col gap-3'), 'expected flex gap-3 container layout instead of fragile space-y');

    // Scale stepper uses unified segmented control & neutral calm 100% readout
    ok(pop.includes('reviewer-scale-stepper'), 'expected unified segmented stepper container');
    ok(pop.includes('reviewer-scale-segment'), 'expected segmented cell buttons');
    const scaleReadoutBtn = pop.match(/<button\b[^>]*aria-label="学习卡片内容缩放: 100%"[^>]*>[\s\S]*?<\/button>/);
    ok(scaleReadoutBtn, 'expected scale readout button at 100%');
    ok(/\bdisabled(?:="")?/.test(scaleReadoutBtn[0]), '100% readout should not pose as active action');

    // Width selector uses native <fieldset><legend> + <input type="radio" name="reviewer-stage-width">
    ok(pop.includes('<fieldset class="reviewer-width-fieldset">'), 'expected <fieldset> without overriding margin-0 utility');
    ok(pop.includes('<legend'), 'expected <legend> inside width <fieldset>');
    for (const widthVal of ['auto', 'standard', 'wide', 'full']) {
      ok(
        pop.includes(`name="reviewer-stage-width"`) && pop.includes(`value="${widthVal}"`),
        `expected native radio option for ${widthVal}`
      );
    }
    ok(pop.includes('reviewer-width-card'), 'expected choice card styling');

    // Pixel developer strings and bottom image-zoom wall of text removed
    doesNotMatch(pop, /580\/840|580px|840px|1120px/, 'developer pixel numbers must be omitted');
    doesNotMatch(pop, /点击卡片内任意图片或思维导图/, 'unrelated image-zoom hint must be omitted');

    // Compat mode uses accessible <label for> + <input type="checkbox" class="anki-switch anki-switch-sm"> without Basic note-type subtitle
    const compatInputMatch = pop.match(/<input\b[^>]*id="([^"]+)"[^>]*class="anki-switch anki-switch-sm[^"]*"[^>]*>/);
    ok(compatInputMatch, 'expected .anki-switch.anki-switch-sm input for compat mode');
    const switchId = compatInputMatch[1];
    ok(pop.includes(`<label for="${switchId}"`), 'expected explicit label[for] linked to compat switch');
    ok(pop.includes('checked=""') || pop.includes('checked'), 'expected compat switch checked when notetype is sandboxed');
    doesNotMatch(pop, />Basic</, 'note type subtitle (Basic) must be omitted from compat toggle');
  } finally {
    setAppState({
      inReviewMode: prev.inReviewMode,
      isSessionComplete: prev.isSessionComplete,
      inlineEditing: prev.inlineEditing,
      resolvedLang: prev.resolvedLang,
      theme: prev.theme,
      systemDark: prev.systemDark,
      reviewContentScale: prev.reviewContentScale,
      reviewStageWidth: prev.reviewStageWidth,
      sandboxNoteTypeIds: prev.sandboxNoteTypeIds,
      reviewQueue: prev.reviewQueue,
      currentCardIndex: prev.currentCardIndex,
    });
  }
});

test('activates header reset & scale reset affordances when scale/width customized and renders cleanly in Dark Mode', () => {
  const prev = getAppState();
  setAppState({
    inReviewMode: true,
    isSessionComplete: false,
    inlineEditing: false,
    resolvedLang: 'en',
    theme: 'dark',
    systemDark: true,
    reviewContentScale: 115,
    reviewStageWidth: 'wide',
    sandboxNoteTypeIds: [],
    reviewQueue: [makeReviewCard({ notetypeId: undefined })],
    currentCardIndex: 0,
  });
  try {
    const html = renderToStaticMarkup(React.createElement(ReviewerView));
    const pop = extractDisplayPopoverHtml(html);

    ok(pop.includes('>Display<'), 'expected localized English header');
    const resetBtn = pop.match(/<button\b[^>]*aria-label="Reset to default"[^>]*>[\s\S]*?<\/button>/);
    ok(resetBtn, 'expected reset button in English header');
    ok(!/\bdisabled(?:="")?/.test(resetBtn[0]), 'reset button should be enabled when customized');

    const scaleReadoutBtn = pop.match(/<button\b[^>]*aria-label="Reset to default \(115%\)"[^>]*>[\s\S]*?<\/button>/);
    ok(scaleReadoutBtn && !/\bdisabled(?:="")?/.test(scaleReadoutBtn[0]), '115% pill should allow single-click reset');

    ok(pop.includes('bg-[#181922]/96'), 'expected dark popover surface class');
    doesNotMatch(pop, /anki-switch-sm/, 'compat row should be hidden when card has no notetypeId');
  } finally {
    setAppState({
      inReviewMode: prev.inReviewMode,
      isSessionComplete: prev.isSessionComplete,
      inlineEditing: prev.inlineEditing,
      resolvedLang: prev.resolvedLang,
      theme: prev.theme,
      systemDark: prev.systemDark,
      reviewContentScale: prev.reviewContentScale,
      reviewStageWidth: prev.reviewStageWidth,
      sandboxNoteTypeIds: prev.sandboxNoteTypeIds,
      reviewQueue: prev.reviewQueue,
      currentCardIndex: prev.currentCardIndex,
    });
  }
});
