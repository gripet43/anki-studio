// ============================================================================
// Card Audio Auto-Play & Side Separation Pure Logic Tests
// ============================================================================

import { section, test, eq, equal } from '../harness';
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
