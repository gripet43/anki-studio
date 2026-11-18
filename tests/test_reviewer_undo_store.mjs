#!/usr/bin/env node
// ============================================================================
// Anki Studio — Active Reviewer Undo Store Scenarios (rating, bury, suspend, delete)
// ============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADDON_ROOT = path.resolve(HERE, '..');
const FRONTEND_MODULES = path.join(ADDON_ROOT, 'frontend', 'node_modules');
const esbuild = createRequire(import.meta.url)(path.join(FRONTEND_MODULES, 'esbuild', 'lib', 'main.js'));

const entrySource = `
import assert from 'node:assert/strict';
import { appActions, getAppState, setAppState } from ${JSON.stringify(
  path.join(ADDON_ROOT, 'frontend', 'src', 'stores', 'useAppStore.ts')
)};

function makeCard(id: string, front: string) {
  return {
    id,
    noteId: 'n-' + id,
    noteTypeName: 'Basic',
    isCloze: false,
    cardType: 'review' as const,
    deckId: '1',
    deckName: 'Default',
    fullDeckName: 'Default',
    front,
    reading: '',
    meaning: 'Back ' + id,
    etymology: '',
    example: '',
    extraHint: '',
    frontHtml: front,
    frontAnswerHtml: front,
    backHtml: 'Back ' + id,
    audioFiles: [],
    fields: { Front: front, Back: 'Back ' + id },
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

function makeLibCard(id: string, front: string) {
  return {
    id,
    noteId: 'n-' + id,
    deckId: '1',
    deckName: 'Default',
    front,
    back: 'Back ' + id,
    tags: [],
    status: 'due' as const,
    intervalDays: 1,
    stability: 1,
    reps: 1,
    difficultyLevel: 'medium' as const,
    lastReviewText: '1d',
    dueText: 'Today',
    suspended: false,
    flags: 0,
  };
}

export async function main() {
  const c1 = makeCard('1', 'Card One');
  const c2 = makeCard('2', 'Card Two');
  const lib1 = makeLibCard('1', 'Card One');
  const lib2 = makeLibCard('2', 'Card Two');

  // 1. Rating a card -> undoLastReview restores queue, index, and answer side
  setAppState({
    inReviewMode: true,
    isSessionComplete: false,
    isCardFlipped: true,
    reviewQueue: [c1, c2],
    currentCardIndex: 0,
    undoStack: [],
    libraryCards: [lib1, lib2],
    libraryTotalCount: 2,
    libraryFilteredCount: 2,
  });
  await appActions.answerCurrentCard(3);
  assert.equal(getAppState().currentCardIndex, 1);
  assert.equal(getAppState().undoStack.length, 1);
  await appActions.undoLastReview();
  assert.equal(getAppState().currentCardIndex, 0);
  assert.equal(getAppState().isCardFlipped, true);
  assert.equal(getAppState().undoStack.length, 0);

  // 2. Burying from front -> undoLastReview restores card onto front side
  setAppState({ isCardFlipped: false });
  await appActions.buryCurrentReviewCard();
  assert.equal(getAppState().reviewQueue.length, 1);
  assert.equal(getAppState().reviewQueue[0].id, '2');
  assert.equal(getAppState().undoStack.length, 1);
  await appActions.undoLastReview();
  assert.equal(getAppState().reviewQueue.length, 2);
  assert.equal(getAppState().reviewQueue[0].id, '1');
  assert.equal(getAppState().isCardFlipped, false);
  assert.equal(getAppState().libraryCards[0].status, 'due');

  // 3. Suspending from back -> undoLastReview restores card and library state
  setAppState({ isCardFlipped: true });
  await appActions.toggleSuspendCurrentReviewCard();
  assert.equal(getAppState().reviewQueue.length, 1);
  assert.equal(getAppState().undoStack.length, 1);
  await appActions.undoLastReview();
  assert.equal(getAppState().reviewQueue.length, 2);
  assert.equal(getAppState().isCardFlipped, true);
  assert.equal(getAppState().libraryCards[0].suspended, false);

  // 4. Deleting -> undoLastReview restores card and counts
  setAppState({ isCardFlipped: false });
  await appActions.deleteCurrentReviewCard();
  assert.equal(getAppState().reviewQueue.length, 1);
  assert.equal(getAppState().libraryTotalCount, 1);
  await appActions.undoLastReview();
  assert.equal(getAppState().reviewQueue.length, 2);
  assert.equal(getAppState().libraryTotalCount, 2);
  assert.equal(getAppState().isCardFlipped, false);

  // 5. Starting a new review session resets prior undoStack
  setAppState({ undoStack: [{} as any] });
  await appActions.startReview('1');
  assert.equal(getAppState().undoStack.length, 0);

  console.log('[Anki Studio Reviewer Undo Store Suite] ALL 5 SCENARIOS PASSED!');
}
`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-studio-undo-store-'));
const tmpTs = path.join(tmpDir, 'entry.ts');
const tmpCjs = path.join(tmpDir, 'entry.cjs');
fs.writeFileSync(tmpTs, entrySource, 'utf8');

try {
  esbuild.buildSync({
    entryPoints: [tmpTs],
    outfile: tmpCjs,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    nodePaths: [FRONTEND_MODULES],
  });
  const mod = await import(pathToFileURL(tmpCjs).href);
  await mod.main();
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
