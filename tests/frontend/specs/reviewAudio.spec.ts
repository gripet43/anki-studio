// ============================================================================
// Card Audio Auto-Play & Side Separation Pure Logic Tests
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, eq, equal, ok } from '../harness';
import { ReviewerView } from '../../../frontend/src/components/reviewer/ReviewerView';
import { getAppState, setAppState } from '../../../frontend/src/stores/useAppStore';
import {
  getSandboxPlayAudioFile,
  normalizeAudioList,
  resolveAudioFilesToPlay,
  resolveAutoPlayAudioFiles,
  resolveManualPlayAudioFiles,
  resolveVisibleAudioFiles,
} from '../../../frontend/src/utils/reviewAudio';

section('reviewAudio · auto-play & side separation');

test('resolveAutoPlayAudioFiles respects independent front/back switches', () => {
  const card = {
    audioFiles: ['q1.mp3', 'q2.mp3', 'a1.mp3'],
    frontAudioFiles: ['q1.mp3', 'q2.mp3'],
    backAudioFiles: ['a1.mp3'],
  };

  eq(
    resolveAutoPlayAudioFiles(card, 'front', { autoPlayFrontAudio: false, autoPlayBackAudio: true }),
    []
  );
  eq(
    resolveAutoPlayAudioFiles(card, 'front', { autoPlayFrontAudio: true, autoPlayBackAudio: false }),
    ['q1.mp3', 'q2.mp3']
  );
  eq(
    resolveAutoPlayAudioFiles(card, 'back', { autoPlayFrontAudio: true, autoPlayBackAudio: true }),
    ['a1.mp3']
  );
  eq(
    resolveAutoPlayAudioFiles(card, 'back', { autoPlayFrontAudio: true, autoPlayBackAudio: false }),
    []
  );
});

test('resolveAutoPlayAudioFiles falls back to front audio on flip when back has no independent audio', () => {
  const frontOnlyCard = {
    audioFiles: ['front.mp3', 'front2.mp3'],
    frontAudioFiles: ['front.mp3', 'front2.mp3'],
    backAudioFiles: [],
  };

  eq(
    resolveAutoPlayAudioFiles(frontOnlyCard, 'back', {
      autoPlayFrontAudio: false,
      autoPlayBackAudio: true,
    }),
    ['front.mp3', 'front2.mp3']
  );

  eq(
    resolveAutoPlayAudioFiles(frontOnlyCard, 'back', {
      autoPlayFrontAudio: true,
      autoPlayBackAudio: false,
    }),
    []
  );
});

test('resolveAutoPlayAudioFiles never leaks back-only audio onto front', () => {
  const backOnlyCard = {
    audioFiles: ['answer.mp3'],
    frontAudioFiles: [],
    backAudioFiles: ['answer.mp3'],
  };

  eq(
    resolveAutoPlayAudioFiles(backOnlyCard, 'front', {
      autoPlayFrontAudio: true,
      autoPlayBackAudio: true,
    }),
    []
  );
  eq(
    resolveAutoPlayAudioFiles(backOnlyCard, 'back', {
      autoPlayFrontAudio: false,
      autoPlayBackAudio: true,
    }),
    ['answer.mp3']
  );
});

test('manual play and visible audio chips stay scoped per card side', () => {
  const splitCard = {
    audioFiles: ['q.mp3', 'a.mp3'],
    frontAudioFiles: ['q.mp3'],
    backAudioFiles: ['a.mp3'],
  };
  eq(resolveManualPlayAudioFiles(splitCard, false), ['q.mp3']);
  eq(resolveManualPlayAudioFiles(splitCard, true), ['a.mp3']);
  eq(resolveVisibleAudioFiles(splitCard, false), ['q.mp3']);
  eq(resolveVisibleAudioFiles(splitCard, true), ['q.mp3', 'a.mp3']);

  const frontOnly = {
    audioFiles: ['only_q.mp3'],
    frontAudioFiles: ['only_q.mp3'],
    backAudioFiles: [],
  };
  eq(resolveManualPlayAudioFiles(frontOnly, false), ['only_q.mp3']);
  eq(resolveManualPlayAudioFiles(frontOnly, true), ['only_q.mp3']);

  const backOnly = {
    audioFiles: ['only_a.mp3'],
    frontAudioFiles: [],
    backAudioFiles: ['only_a.mp3'],
  };
  eq(resolveManualPlayAudioFiles(backOnly, false), []);
  eq(resolveVisibleAudioFiles(backOnly, false), []);
  eq(resolveManualPlayAudioFiles(backOnly, true), ['only_a.mp3']);

  const extraOnly = {
    audioFiles: ['extra.mp3'],
    frontAudioFiles: [],
    backAudioFiles: [],
  };
  eq(resolveManualPlayAudioFiles(extraOnly, true), ['extra.mp3']);
});

test('getSandboxPlayAudioFile resolves play:q:N and play:a:N accurately for Cloze and fallback', () => {
  const clozeSandboxCard = {
    audioFiles: ['prompt.mp3', 'cloze_ans.mp3'],
    frontAudioFiles: ['prompt.mp3'],
    backAudioFiles: ['cloze_ans.mp3'],
    sandboxQuestionAudioFiles: ['prompt.mp3'],
    sandboxAnswerAudioFiles: ['prompt.mp3', 'cloze_ans.mp3'],
  };

  equal(getSandboxPlayAudioFile(clozeSandboxCard, 'q', 0), 'prompt.mp3');
  equal(getSandboxPlayAudioFile(clozeSandboxCard, 'a', 0), 'prompt.mp3');
  equal(getSandboxPlayAudioFile(clozeSandboxCard, 'a', 1), 'cloze_ans.mp3');

  const basicFallback = {
    audioFiles: ['f.mp3', 'b.mp3'],
    frontAudioFiles: ['f.mp3'],
    backAudioFiles: ['b.mp3'],
  };
  equal(getSandboxPlayAudioFile(basicFallback, 'q', 0), 'f.mp3');
  equal(getSandboxPlayAudioFile(basicFallback, 'a', 0), 'b.mp3');
  equal(getSandboxPlayAudioFile(undefined, 'a', 0), undefined);
});

test('normalizeAudioList and resolveAudioFilesToPlay deduplicate and trim', () => {
  eq(normalizeAudioList([' a.mp3 ', '', 'a.mp3', 'b.mp3']), ['a.mp3', 'b.mp3']);
  eq(resolveAudioFilesToPlay(' word.mp3 '), ['word.mp3']);
  eq(resolveAudioFilesToPlay([' 1.mp3 ', '2.mp3', '1.mp3']), ['1.mp3', '2.mp3']);
  eq(resolveAudioFilesToPlay('   '), []);
});

function extractAudioPopoverHtml(fullHtml: string): string {
  const start = fullHtml.indexOf('popover="auto"');
  const audioIdx = start !== -1 ? fullHtml.indexOf('--reviewer-audio-anchor', start) : -1;
  ok(start !== -1 && audioIdx !== -1, 'expected ReviewerView to render audio popover anchor');
  const openTagStart = fullHtml.lastIndexOf('<div', audioIdx);
  const flagIdx = fullHtml.indexOf('--reviewer-flag-anchor', audioIdx);
  const flagTagStart = flagIdx !== -1 ? fullHtml.lastIndexOf('<div', flagIdx) : -1;
  ok(openTagStart !== -1 && flagTagStart !== -1, 'expected bounded audio popover slice');
  return fullHtml.slice(openTagStart, flagTagStart);
}

test('audio popover matches Display popover surface, bordered header, .anki-switch-sm checkboxes, and card-tile action link', () => {
  const prev = getAppState();
  setAppState({
    inReviewMode: true,
    isSessionComplete: false,
    inlineEditing: false,
    resolvedLang: 'zh-CN',
    theme: 'light',
    systemDark: false,
    autoPlayFrontAudio: true,
    autoPlayBackAudio: true,
    reviewQueue: [
      {
        id: '301',
        noteId: 'n-301',
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
      },
    ],
    currentCardIndex: 0,
  });
  try {
    const html = renderToStaticMarkup(React.createElement(ReviewerView));
    const pop = extractAudioPopoverHtml(html);

    ok(pop.includes('w-[300px]'), 'expected uniform 300px popover width matching Display popover');
    ok(pop.includes('bg-[var(--bg-card)]/96'), 'expected warm card surface matching Display popover');
    ok(pop.includes('flex flex-col gap-3'), 'expected flex gap-3 container matching Display popover');
    ok(pop.includes('h-9 pb-3 border-b'), 'expected bordered header bar matching Display popover');
    ok(pop.includes('>音频自动播放<'), 'expected Audio Auto-Play header title');
    ok(pop.includes('>Q + A<'), 'expected Q + A status badge when both switches enabled');

    const switchInputs = Array.from(
      pop.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*class="anki-switch anki-switch-sm[^"]*"[^>]*>/g)
    );
    equal(switchInputs.length, 2, 'expected two .anki-switch.anki-switch-sm toggles');
    for (const m of switchInputs) {
      ok(pop.includes(`<label for="${m[1]}"`), `expected explicit <label for="${m[1]}"> linked to switch`);
    }
    ok(pop.includes('reviewer-popover-link'), 'expected light-bordered footer button matching Display tiles');
  } finally {
    setAppState({
      inReviewMode: prev.inReviewMode,
      isSessionComplete: prev.isSessionComplete,
      inlineEditing: prev.inlineEditing,
      resolvedLang: prev.resolvedLang,
      theme: prev.theme,
      systemDark: prev.systemDark,
      autoPlayFrontAudio: prev.autoPlayFrontAudio,
      autoPlayBackAudio: prev.autoPlayBackAudio,
      reviewQueue: prev.reviewQueue,
      currentCardIndex: prev.currentCardIndex,
    });
  }
});
