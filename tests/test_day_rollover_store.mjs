#!/usr/bin/env node
// ============================================================================
// Anki Studio — Async Day Rollover Store Scenarios (mocked window.pycmd bridge)
// Exercises:
//   1. Dashboard idle rollover -> silent refresh + single toast
//   2. Session-complete celebration rollover -> preserves celebration + sets pendingDayRollover
//   3. Active reviewer mid-card rollover -> keeps current card intact, sets pendingDayRollover,
//      then auto-merges today's new queue cleanly after answerCurrentCard()
//   4. Manual syncPendingDayRolloverQueue() from banner -> loads today queue immediately
//   5. Cross-day undoLastReview() -> avoids restoring yesterday's todayStats
// ============================================================================

import assert from 'node:assert/strict';
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

function makeCard(id: string, front: string, deckId = '1') {
  return {
    id,
    noteId: 'n-' + id,
    noteTypeName: 'Basic',
    isCloze: false,
    cardType: 'review' as const,
    deckId,
    deckName: 'Test',
    fullDeckName: 'Test',
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
    tags: [],
    mastery: 50,
    stability: 1,
    difficulty: 5,
    difficultyLevel: 'medium' as const,
    reps: 1,
    lapses: 0,
    predictions: { again: '1m', hard: '1d', good: '3d', easy: '7d' },
    history: [],
  };
}

function makeDashboard(schedToday: number, dueReview: number, completed = 0) {
  return {
    userName: 'Tester',
    greeting: 'Hi',
    dateDisplay: '2026-11-15',
    synced: true,
    syncedAt: Date.now(),
    language: 'zh-CN',
    dayBoundary: {
      available: true,
      schedToday,
      dayCutoff: 1_900_000_000 + schedToday * 86400,
      dayStartSec: 1_900_000_000 + (schedToday - 1) * 86400,
      logicalDate: schedToday === 100 ? '2026-11-14' : '2026-11-15',
      rolloverHour: 0,
      serverNow: 1_900_000_000 + schedToday * 86400 - 1000,
    },
    streak: { currentStreak: 3, streakTarget: 7, isActiveToday: completed > 0, activeDaysLast7: [true, true, true] },
    todayStats: {
      dailyGoal: completed + dueReview,
      completed,
      totalTodayWorkload: completed + dueReview,
      remainingForGoal: dueReview,
      dueNew: 0,
      dueReview,
      totalPending: dueReview,
      retentionRate: 95,
      reviewMinutes: 5,
    },
    decks: [
      {
        id: '1',
        name: 'Test',
        fullName: 'Test',
        depth: 0,
        dueNew: 0,
        dueReview,
        totalCards: dueReview,
        progress: 0,
        lastStudied: '',
        masteryScore: 80,
        color: '#3B82F6',
      },
    ],
    heatmap: { totalYearReviews: 1, weekTotalCards: 1, dailyAverage: 1, retentionRate: 95, wowChange: '0%', cells: [] },
    weeklyRhythm: { days: [], avgSecondsPerCard: 3, longestSessionMinutes: 1 },
  };
}

export async function run() {
  let simDay = 100;
  let simDue = 2;
  let simCompleted = 5;
  let startReviewScopes: string[] = [];
  let answerCalls: any[] = [];
  let rpcLog: string[] = [];
  let undoCalls = 0;

  (globalThis as any).window = globalThis;
  (globalThis as any).pycmd = (cmd: string, cb: (raw: string) => void) => {
    const payload = JSON.parse(cmd.replace(/^modern_anki:/, ''));
    const { action, data } = payload;
    rpcLog.push(action);
    let result: any = {};
    if (action === 'get_dashboard') {
      result = makeDashboard(simDay, simDue, simCompleted);
    } else if (action === 'search_cards') {
      result = { total: 0, collectionTotal: 0, filteredCount: 0, hasMore: false, cards: [], allTags: [] };
    } else if (action === 'get_statistics') {
      result = { maturityBreakdown: [] };
    } else if (action === 'start_review') {
      startReviewScopes.push(String(data?.deckId ?? ''));
      const cards = simDay === 100
        ? [makeCard('1001', 'Yesterday 1'), makeCard('1002', 'Yesterday 2')]
        : [makeCard('2001', 'Today 1'), makeCard('2002', 'Today 2'), makeCard('2003', 'Today 3')];
      result = { deckId: data?.deckId || 'all', totalDue: cards.length, isPreviewOnly: false, cards };
    } else if (action === 'answer_card') {
      answerCalls.push(data);
    } else if (action === 'undo') {
      undoCalls += 1;
      result = { undone: true, label: 'Undone' };
    }
    queueMicrotask(() => cb(JSON.stringify({ status: 'success', data: result })));
  };

  // 1. Initial load on day 100
  await appActions.initFromAnki(true);
  assert.equal(getAppState().dayBoundary?.schedToday, 100);
  assert.equal(getAppState().inReviewMode, false);

  // 2. Non-review day rollover -> updates dashboard silently + sets toast
  simDay = 101;
  simDue = 12;
  simCompleted = 0;
  await appActions.handleDayChanged({
    source: 'cutoff_timer',
    reason: 'rollover',
    dayBoundary: makeDashboard(101, 12, 0).dayBoundary,
  });
  assert.equal(getAppState().dayBoundary?.schedToday, 101);
  assert.equal(getAppState().dashboard.todayStats.dueReview, 12);
  assert.equal(getAppState().pendingDayRollover, null);
  assert.ok(getAppState().toastMessage);

  // 3. Start review on day 101, enter active card, then rollover to day 102
  simDay = 101;
  setAppState({ dayBoundary: makeDashboard(101, 2, 0).dayBoundary });
  await appActions.startReview('all');
  assert.equal(getAppState().inReviewMode, true);
  assert.equal(getAppState().reviewQueue[0].id, '2001');
  assert.equal(getAppState().reviewSessionDayKey, 101);

  // Rollover arrives mid-card -> current card MUST remain '2001' and NOT jump!
  simDay = 102;
  simDue = 9;
  await appActions.handleDayChanged({
    source: 'cutoff_timer',
    reason: 'rollover',
    dayBoundary: makeDashboard(102, 9, 0).dayBoundary,
  });
  assert.equal(getAppState().reviewQueue[getAppState().currentCardIndex].id, '2001');
  assert.equal(getAppState().pendingDayRollover?.toSchedToday, 102);

  // Grading current card triggers answer_card BEFORE start_review('all') and replaces queue cleanly
  startReviewScopes = [];
  rpcLog = [];
  await appActions.answerCurrentCard(3);
  assert.equal(answerCalls.length, 1);
  assert.equal(answerCalls[0].cardId, '2001');
  assert.ok(rpcLog.includes('answer_card'));
  assert.ok(rpcLog.indexOf('start_review') > rpcLog.indexOf('answer_card'));
  assert.ok(startReviewScopes.includes('all'));
  assert.equal(getAppState().pendingDayRollover, null);
  assert.equal(getAppState().reviewSessionDayKey, 102);
  assert.equal(getAppState().reviewQueue.length, 3);
  assert.equal(getAppState().currentCardIndex, 0);

  // 4. Celebration screen rollover keeps isSessionComplete=true and marks pendingDayRollover
  setAppState({ isSessionComplete: true, pendingDayRollover: null });
  simDay = 103;
  await appActions.handleDayChanged({
    source: 'cutoff_timer',
    reason: 'rollover',
    dayBoundary: makeDashboard(103, 5, 0).dayBoundary,
  });
  assert.equal(getAppState().isSessionComplete, true);
  assert.equal(getAppState().pendingDayRollover?.toSchedToday, 103);

  // Manual sync from banner switches immediately
  await appActions.syncPendingDayRolloverQueue();
  assert.equal(getAppState().isSessionComplete, false);
  assert.equal(getAppState().pendingDayRollover, null);
  assert.equal(getAppState().reviewSessionDayKey, 103);

  // 5. Cross-day undo preserves new day's dashboard stats instead of overwriting with snapshot's old day stats
  setAppState((prev) => ({
    undoStack: [
      {
        cardIndex: 0,
        card: makeCard('old', 'Old'),
        previousQueue: [makeCard('old', 'Old')],
        previousDecks: prev.decks,
        previousTodayStats: {
          dailyGoal: 99,
          completed: 99,
          totalTodayWorkload: 99,
          remainingForGoal: 0,
          dueNew: 0,
          dueReview: 0,
          totalPending: 0,
          retentionRate: 99,
          reviewMinutes: 10,
        },
        sessionStudied: 1,
        sessionCorrect: 1,
        sessionTotalTimeMs: 1000,
        wasSessionComplete: false,
        dayKey: 101,
      },
    ],
    dashboard: {
      ...prev.dashboard,
      todayStats: { ...prev.dashboard.todayStats, completed: 1, dueReview: 4, totalPending: 4 },
    },
  }));
  await appActions.undoLastReview();
  assert.equal(undoCalls, 1);
  assert.notEqual(getAppState().dashboard.todayStats.completed, 99);

  console.log('[Anki Studio Day Rollover Store Suite] ALL 5 SCENARIOS PASSED!');
}
`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-studio-rollover-store-'));
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
    logLevel: 'warning',
  });
  const mod = await import(pathToFileURL(tmpCjs).href);
  await mod.run();
} catch (err) {
  console.error('[Anki Studio Day Rollover Store Suite] FAILED:', err);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
