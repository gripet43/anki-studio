// ============================================================================
// Dashboard hero progress ring percentage & ARIA contract tests
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, equal, ok, doesNotMatch } from '../harness';
import {
  computeHeroProgressRing,
  DashboardView,
  HERO_RING_CIRCUMFERENCE,
  HERO_RING_RADIUS,
} from '../../../frontend/src/components/dashboard/DashboardView';
import { DeckItem } from '../../../frontend/src/bridge/pycmd';
import { getAppState, setAppState } from '../../../frontend/src/stores/useAppStore';

function approxEqual(actual: number, expected: number, label: string): void {
  ok(
    Math.abs(actual - expected) < 1e-6,
    `${label}: expected ${expected}, got ${actual}`
  );
}

function renderDashboardWithStats(overrides: {
  completed: number;
  totalTodayWorkload: number;
  totalPending: number;
  dueReview?: number;
  dueNew?: number;
  syncing?: boolean;
  isInitialSyncing?: boolean;
  resolvedLang?: 'zh-CN' | 'en';
  decks?: DeckItem[];
}): string {
  const prev = getAppState();
  try {
    setAppState({
      resolvedLang: overrides.resolvedLang ?? 'zh-CN',
      syncing: overrides.syncing ?? false,
      isInitialSyncing: overrides.isInitialSyncing ?? false,
      syncJustFinished: false,
      decks: overrides.decks ?? prev.decks,
      dashboard: {
        ...prev.dashboard,
        vacation: {
          ...prev.dashboard.vacation,
          isActive: false,
        },
        todayStats: {
          ...prev.dashboard.todayStats,
          completed: overrides.completed,
          totalTodayWorkload: overrides.totalTodayWorkload,
          dailyGoal: overrides.totalTodayWorkload,
          remainingForGoal: overrides.totalPending,
          totalPending: overrides.totalPending,
          dueReview: overrides.dueReview ?? overrides.totalPending,
          dueNew: overrides.dueNew ?? 0,
        },
      },
    });
    const html = renderToStaticMarkup(React.createElement(DashboardView));
    ok(html.length > 0, 'DashboardView rendered empty markup');
    doesNotMatch(html, /undefined|NaN/, 'DashboardView markup leaked undefined or NaN');
    return html;
  } finally {
    setAppState({
      resolvedLang: prev.resolvedLang,
      syncing: prev.syncing,
      isInitialSyncing: prev.isInitialSyncing,
      syncJustFinished: prev.syncJustFinished,
      decks: prev.decks,
      dashboard: prev.dashboard,
    });
  }
}

section('dashboard · hero progress ring math & edge cases');

test('empty totalWorkload === 0 with 0 completed yields 0% and full dashoffset', () => {
  const m = computeHeroProgressRing(0, 0);
  equal(HERO_RING_RADIUS, 48);
  equal(m.pct, 0);
  equal(m.progressPct, 0);
  approxEqual(m.strokeDashoffset, HERO_RING_CIRCUMFERENCE, 'empty strokeDashoffset');
});

test('partial workload computes rounded integer percentage and proportional strokeDashoffset', () => {
  const half = computeHeroProgressRing(14, 28);
  equal(half.pct, 0.5);
  equal(half.progressPct, 50);
  approxEqual(half.strokeDashoffset, HERO_RING_CIRCUMFERENCE * 0.5, '50% strokeDashoffset');

  const third = computeHeroProgressRing(1, 3);
  equal(third.progressPct, 33);

  const twoThirds = computeHeroProgressRing(2, 3);
  equal(twoThirds.progressPct, 67);

  const twelveOfTwentyEight = computeHeroProgressRing(12, 28);
  equal(twelveOfTwentyEight.progressPct, 43);
});

test('100% completion and overflow clamp cleanly to 100% and 0 strokeDashoffset', () => {
  const exact = computeHeroProgressRing(28, 28);
  equal(exact.pct, 1);
  equal(exact.progressPct, 100);
  equal(exact.strokeDashoffset, 0);

  const overflow = computeHeroProgressRing(35, 28);
  equal(overflow.pct, 1);
  equal(overflow.progressPct, 100);
  equal(overflow.strokeDashoffset, 0);

  const completedWithZeroWorkload = computeHeroProgressRing(5, 0);
  equal(completedWithZeroWorkload.pct, 1);
  equal(completedWithZeroWorkload.progressPct, 100);
  equal(completedWithZeroWorkload.strokeDashoffset, 0);
});

test('negative or non-finite inputs are clamped safely to zero', () => {
  const negative = computeHeroProgressRing(-4, 10);
  equal(negative.completed, 0);
  equal(negative.progressPct, 0);

  const nonFinite = computeHeroProgressRing(Number.NaN, Number.POSITIVE_INFINITY);
  equal(nonFinite.completed, 0);
  equal(nonFinite.totalWorkload, 0);
  equal(nonFinite.progressPct, 0);
});

section('dashboard · hero progress ring SSR markup & ARIA');

test('normal progress renders 0-100 percentage progressbar ARIA without completed/total subtext', () => {
  const html = renderDashboardWithStats({
    completed: 14,
    totalTodayWorkload: 28,
    totalPending: 14,
    resolvedLang: 'en',
  });
  ok(html.includes('role="progressbar"'), 'missing progressbar role');
  ok(html.includes('aria-valuenow="50"'), 'aria-valuenow should reflect 0-100 percentage (50)');
  ok(html.includes('aria-valuemin="0"'), 'aria-valuemin should be 0');
  ok(html.includes('aria-valuemax="100"'), 'aria-valuemax should be 100 for percentage mode');
  ok(
    html.includes('aria-valuetext="50% · Completed 14 of 28 cards today"'),
    'aria-valuetext should pair percentage with localized tooltip text'
  );
  doesNotMatch(html, /14 \/ 28/, 'ring center should omit completed / totalWorkload subtext');
  ok(html.includes('>%<'), 'ring centerpiece must include % unit');
  ok(html.includes('tabular-nums'), 'ring metrics must use tabular-nums');
  ok(html.includes('dashboard-progress-ring-center'), 'ring center overlay class should be present');
  ok(html.includes('dashboard-progress-ring-value'), 'ring value class should be present for text-box trim');
  ok(html.includes('dashboard-progress-ring-unit'), 'ring unit class should be present for text-box trim');
});

test('0% empty day and 100% done render expected progressbar bounds', () => {
  const emptyHtml = renderDashboardWithStats({
    completed: 0,
    totalTodayWorkload: 0,
    totalPending: 0,
  });
  ok(emptyHtml.includes('aria-valuenow="0"'));
  ok(emptyHtml.includes('aria-valuemax="100"'));
  doesNotMatch(emptyHtml, /0 \/ 0/);

  const doneHtml = renderDashboardWithStats({
    completed: 28,
    totalTodayWorkload: 28,
    totalPending: 0,
  });
  ok(doneHtml.includes('aria-valuenow="100"'));
  ok(doneHtml.includes('aria-valuemax="100"'));
  ok(doneHtml.includes('var(--status-success)'), '100% completion should highlight ring in status-success');
  doesNotMatch(doneHtml, /28 \/ 28/);
});

test('sync-pending state switches progressbar to indeterminate busy mode', () => {
  const syncingHtml = renderDashboardWithStats({
    completed: 14,
    totalTodayWorkload: 28,
    totalPending: 14,
    syncing: true,
  });
  ok(syncingHtml.includes('aria-busy="true"'), 'syncing progressbar should set aria-busy');
  ok(!syncingHtml.includes('aria-valuenow='), 'indeterminate syncing progressbar should omit aria-valuenow');
  ok(syncingHtml.includes('animate-spin'), 'syncing state must keep spinning indicator');
});

test('dashboard hero secondary actions and deck card actions render icon-only with accessible names', () => {
  const sampleDecks: DeckItem[] = [
    {
      id: 'deck-1',
      name: 'Default',
      fullName: 'Default',
      depth: 0,
      isChild: false,
      totalCards: 100,
      dueReview: 10,
      dueNew: 5,
      learnCount: 0,
      reviewCount: 10,
      mastery: 90,
      icon: 'book',
      accent: 'emerald',
      childrenCount: 0,
    },
    {
      id: 'deck-2',
      name: 'DoneDeck',
      fullName: 'DoneDeck',
      depth: 0,
      isChild: false,
      totalCards: 50,
      dueReview: 0,
      dueNew: 0,
      learnCount: 0,
      reviewCount: 0,
      mastery: 100,
      icon: 'code',
      accent: 'indigo',
      childrenCount: 0,
    },
  ];
  const html = renderDashboardWithStats({
    completed: 5,
    totalTodayWorkload: 20,
    totalPending: 15,
    resolvedLang: 'zh-CN',
    decks: sampleDecks,
  });
  ok(html.includes('<span>开始今日学习</span>'), 'primary CTA keeps visible text label');
  ok(html.includes('aria-label="轻量复习"'), 'light session icon button must have aria-label');
  ok(html.includes('aria-label="自定义学习"'), 'custom study icon button must have aria-label');
  ok(!html.includes('<span>轻量复习</span>'), 'light session button must omit visible text label');
  ok(!html.includes('<span>自定义学习</span>'), 'custom study button must omit visible text label');
  ok(!html.includes('deck-view-label'), 'deck view button must omit visible text label');
  ok(!html.includes('<span>学习</span>'), 'deck study button must omit visible text label');
  ok(html.includes('aria-label="Default · 去卡片库查看"'), 'deck view button should expose deck-scoped aria-label');
  ok(html.includes('aria-label="Default · 开始今日学习"'), 'deck study button should expose deck-scoped aria-label');
  ok(html.includes('aria-label="DoneDeck · 明日再来"'), 'completed deck study button should expose completion aria-label');
  ok(html.includes('aria-disabled="true"'), 'completed deck study button should use aria-disabled for tooltip/focus access');
});

test('simplified dashboard omits redundant chrome labels and zero-card placeholders', () => {
  const decks: DeckItem[] = [
    {
      id: 'deck-a',
      name: 'Alpha',
      fullName: 'Alpha',
      depth: 0,
      isChild: false,
      totalCards: 40,
      dueReview: 6,
      dueNew: 0,
      learnCount: 0,
      reviewCount: 6,
      mastery: 88,
      icon: 'book',
      accent: 'emerald',
      childrenCount: 0,
    },
    {
      id: 'deck-b',
      name: 'Beta',
      fullName: 'Beta',
      depth: 0,
      isChild: false,
      totalCards: 20,
      dueReview: 0,
      dueNew: 0,
      learnCount: 0,
      reviewCount: 0,
      mastery: 97,
      icon: 'code',
      accent: 'indigo',
      childrenCount: 0,
    },
  ];
  const html = renderDashboardWithStats({
    completed: 2,
    totalTodayWorkload: 8,
    totalPending: 6,
    resolvedLang: 'zh-CN',
    decks,
  });
  ok(!html.includes('>今日学习进度<'), 'Hero Zone 2 should omit redundant 今日学习进度 eyebrow');
  ok(!html.includes('<circle cx="8" cy="8" r="6.5"'), 'Streak area should omit standalone info circle icon');
  ok(!html.includes('共 2 个牌组'), 'Section header should omit redundant deck total when no subdecks are collapsed');
  ok(html.includes('group/tip'), 'Dashboard header should keep inline learning tips line');
  ok(!html.includes('>熟记度<'), 'Deck card should omit visible 熟记度 label under percentage');
  ok(!html.includes('无新卡'), 'Deck card should omit zero-value 无新卡 indicator');
  ok(html.includes('待复习 6'), 'Deck card with due reviews keeps due review count');
  ok(html.includes('今日暂无到期卡片'), 'Completed 0/0 deck card displays single caught-up indicator');
  ok(!html.includes('最近 7 天 · 单位：张'), 'Weekly rhythm card should omit redundant subtitle');
});
