// ============================================================================
// Anki Studio — Clean Initial State Skeletons (Zero Hardcoded Demo Cards)
// Part 2 & Part 3 #2 Fix: dailyGoal = 0, remainingForGoal = 0, userName = ''
// ============================================================================

import {
  AdvancedStatsData,
  DashboardData,
  DeckItem,
  HeatmapCell,
  LibraryCardItem,
  ReviewCardItem,
} from '../bridge/pycmd';

export const SEED_DECKS: DeckItem[] = [];
export const SEED_REVIEW_CARDS: ReviewCardItem[] = [];
export const SEED_LIBRARY_CARDS: LibraryCardItem[] = [];

function generateEmptyHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const totalDays = 365;
  const baseDate = new Date();
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - (totalDays - 1 - i));
    cells.push({
      date: d.toISOString().slice(0, 10),
      count: 0,
      level: 0,
    });
  }
  return cells;
}

export const EMPTY_ADVANCED_STATS: AdvancedStatsData = {
  maturityBreakdown: {
    newCards: 0,
    learning: 0,
    young: 0,
    mature: 0,
    suspended: 0,
    buried: 0,
    total: 0,
  },
  forecast30d: Array.from({ length: 30 }).map((_, i) => ({
    dayOffset: i,
    label: i === 0 ? '今天' : `+${i}d`,
    total: 0,
    mature: 0,
    young: 0,
  })),
  retentionCurve: Array.from({ length: 12 }).map((_, i) => ({
    period: i === 11 ? '本周' : `${11 - i}周前`,
    retentionRate: 0,
    lapseRate: 0,
    reviews: 0,
  })),
  hourlyDistribution: Array.from({ length: 24 }).map((_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    count: 0,
    accuracy: 0,
  })),
  answerButtons: {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    total: 0,
    young: { pass: 0, total: 0, rate: 0 },
    mature: { pass: 0, total: 0, rate: 0 },
  },
  trueRetention: {
    last30d: {
      young: { pass: 0, total: 0, rate: 0 },
      mature: { pass: 0, total: 0, rate: 0 },
      overall: { pass: 0, total: 0, rate: 0 },
    },
    allTime: {
      young: { pass: 0, total: 0, rate: 0 },
      mature: { pass: 0, total: 0, rate: 0 },
      overall: { pass: 0, total: 0, rate: 0 },
    },
  },
  dailyLoad: 0,
};

export const EMPTY_DASHBOARD: DashboardData = {
  userName: '',
  greeting: '你好',
  dateDisplay: '',
  synced: true,
  vacation: {
    isActive: false,
    startDate: '',
    endDate: '',
    days: 0,
    remainingDays: 0,
    reason: '',
    freezeNewCards: true,
    frozenDates: [],
  },
  backlog: {
    totalDue: 0,
    overdueCount: 0,
    hasAvalanche: false,
    suggestedDays: 7,
  },
  todayStats: {
    completed: 0,
    totalTodayWorkload: 0,
    dailyGoal: 0,
    remainingForGoal: 0,
    estimatedMinutes: 0,
    dueReview: 0,
    dueNew: 0,
    totalPending: 0,
    correctRateToday: 0,
  },
  streak: {
    current: 0,
    longest: 0,
    weekActiveDays: 0,
    weekTotalDays: 7,
  },
  decks: [],
  heatmap: {
    totalYearReviews: 0,
    weekTotalCards: 0,
    dailyAverage: 0,
    retentionRate: 0,
    wowChange: '--',
    cells: generateEmptyHeatmap(),
  },
  weeklyRhythm: {
    days: [
      { label: '一', count: 0, isToday: false, date: '' },
      { label: '二', count: 0, isToday: false, date: '' },
      { label: '三', count: 0, isToday: false, date: '' },
      { label: '四', count: 0, isToday: false, date: '' },
      { label: '五', count: 0, isToday: false, date: '' },
      { label: '六', count: 0, isToday: false, date: '' },
      { label: '日', count: 0, isToday: false, date: '' },
    ],
    avgSecondsPerCard: 0,
    longestSessionMinutes: 0,
  },
  advancedStats: EMPTY_ADVANCED_STATS,
  lastRescueReceipt: null,
};

export const SEED_ADVANCED_STATS = EMPTY_ADVANCED_STATS;
export const SEED_DASHBOARD = EMPTY_DASHBOARD;
