// ============================================================================
// Anki Studio — Strongly-Typed IPC Client (`window.pycmd` Bridge)
// Supports <2ms native Python communication in Anki 26.x
// ============================================================================

export interface BridgeResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

export interface DeckOptionsData {
  deckId: string;
  deckName: string;
  presetId: string;
  presetName: string;
  newPerDay: number;
  revPerDay: number;
  learningSteps: string;
  relearningSteps: string;
  leechThreshold: number;
  desiredRetention: number;
}

export type CardFlagColor = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface FlagColorSpec {
  flag: Exclude<CardFlagColor, 0>;
  hex: string;
  bgSoft: string;
  borderHex: string;
  shortZh: string;
  labelZh: string;
  shortEn: string;
  labelEn: string;
}

export const ANKI_FLAG_PALETTE: Record<Exclude<CardFlagColor, 0>, FlagColorSpec> = {
  1: {
    flag: 1,
    hex: '#EF4444',
    bgSoft: 'rgba(239, 68, 68, 0.14)',
    borderHex: 'rgba(239, 68, 68, 0.38)',
    shortZh: '红旗',
    labelZh: '红旗 · 重点错题',
    shortEn: 'Red',
    labelEn: 'Red · Key Mistake',
  },
  2: {
    flag: 2,
    hex: '#F97316',
    bgSoft: 'rgba(249, 115, 22, 0.14)',
    borderHex: 'rgba(249, 115, 22, 0.38)',
    shortZh: '橙旗',
    labelZh: '橙旗 · 易混待查',
    shortEn: 'Orange',
    labelEn: 'Orange · Confusing',
  },
  3: {
    flag: 3,
    hex: '#10B981',
    bgSoft: 'rgba(16, 185, 129, 0.14)',
    borderHex: 'rgba(16, 185, 129, 0.38)',
    shortZh: '绿旗',
    labelZh: '绿旗 · 进阶巩固',
    shortEn: 'Green',
    labelEn: 'Green · Consolidate',
  },
  4: {
    flag: 4,
    hex: '#3B82F6',
    bgSoft: 'rgba(59, 130, 246, 0.14)',
    borderHex: 'rgba(59, 130, 246, 0.38)',
    shortZh: '蓝旗',
    labelZh: '蓝旗 · 核心考点',
    shortEn: 'Blue',
    labelEn: 'Blue · Core Point',
  },
  5: {
    flag: 5,
    hex: '#EC4899',
    bgSoft: 'rgba(236, 72, 153, 0.14)',
    borderHex: 'rgba(236, 72, 153, 0.38)',
    shortZh: '粉旗',
    labelZh: '粉旗 · 灵感拓展',
    shortEn: 'Pink',
    labelEn: 'Pink · Insight',
  },
  6: {
    flag: 6,
    hex: '#06B6D4',
    bgSoft: 'rgba(6, 182, 212, 0.14)',
    borderHex: 'rgba(6, 182, 212, 0.38)',
    shortZh: '青旗',
    labelZh: '青旗 · 背诵金句',
    shortEn: 'Cyan',
    labelEn: 'Cyan · Key Quote',
  },
  7: {
    flag: 7,
    hex: '#8B5CF6',
    bgSoft: 'rgba(139, 92, 246, 0.14)',
    borderHex: 'rgba(139, 92, 246, 0.38)',
    shortZh: '紫旗',
    labelZh: '紫旗 · 考前必看',
    shortEn: 'Purple',
    labelEn: 'Purple · Must Review',
  },
};

export interface CustomStudyParams {
  preset: 'mistakes' | 'flagged' | 'ahead' | 'extra_new' | 'custom';
  deckId?: string;
  days?: number;
  flag?: string;
  tag?: string;
  cardScope?: 'all' | 'due' | 'review' | 'new';
  sortOrder?: 'lapses_desc' | 'ivl_asc' | 'random' | 'due_asc';
  limit?: number;
  isPreviewOnly?: boolean;
}

export type MaintenanceToolType =
  | 'check_db'
  | 'check_empty_cards'
  | 'clean_empty_cards'
  | 'check_media'
  | 'clean_unused_media'
  | 'open_native_tool';

export interface MaintenanceReportData {
  success: boolean;
  toolType: MaintenanceToolType;
  status?: 'ok' | 'warning';
  integrityResult?: string;
  cardCount?: number;
  noteCount?: number;
  revlogCount?: number;
  emptyCount?: number;
  removedCount?: number;
  totalFiles?: number;
  referencedCount?: number;
  unusedCount?: number;
  missingCount?: number;
  unusedFiles?: string[];
  missingFiles?: string[];
  message?: string;
  error?: string;
}

export interface DeckItem {
  id: string;
  parentId?: string | null;
  name: string;
  fullName: string;
  depth: number;
  isChild: boolean;
  totalCards: number;
  dueReview: number;
  dueNew: number;
  learnCount: number;
  reviewCount: number;
  mastery: number;
  masteryBreakdown?: MasteryBreakdown;
  icon: 'book' | 'code' | 'heart' | 'folder' | 'layers' | 'sparkles';
  accent: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  childrenCount: number;
  options?: DeckOptionsData;
}

/** 熟记度构成：四个互斥阶段的占比，取值 0–1，四段之和为 1。 */
export interface MasteryBreakdown {
  mature: number;
  review: number;
  learning: number;
  new: number;
}

export interface HeatmapCell {
  date: string;
  count: number;
  accuracy?: number;
  level: 0 | 1 | 2 | 3 | 4;
  isStreakFrozen?: boolean;
}

export interface VacationState {
  isActive: boolean;
  startDate: string;
  endDate: string;
  days: number;
  remainingDays: number;
  reason: string;
  freezeNewCards: boolean;
  frozenDates: string[];
  shiftedCardCount?: number;
  createdAt?: string;
}

export interface BacklogStatus {
  totalDue: number;
  overdueCount: number;
  hasAvalanche: boolean;
  suggestedDays: number;
  perDayEstimate?: number;
}

export interface RescueCardSample {
  id: string;
  front: string;
  deckName: string;
  intervalDays: number;
  dayOffset: number;
  newDueDate: string;
}

export interface RescueDayDistribution {
  dayOffset: number;
  date: string;
  dateLabel: string;
  count: number;
}

export interface VacationHistoryItem {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'active' | 'completed' | 'ended_early' | 'cancelled';
  shiftedCardCount?: number;
  createdAt?: string;
  endedAt?: string;
  cancelledAt?: string;
}

export interface RescueReceipt {
  id: string;
  timestamp: string;
  totalCardsBefore: number;
  totalCardsAfter: number;
  lostCards: number;
  rescheduledCount: number;
  mode: 'amortize' | 'shift';
  days: number;
  dayDistribution: RescueDayDistribution[];
  cardSamples: RescueCardSample[];
  canUndo: boolean;
  status?: 'active' | 'undone';
  undoneAt?: string;
}

export interface ForecastDayItem {
  dayOffset: number;
  label: string;
  total: number;
  mature: number;
  young: number;
}

export interface RetentionPoint {
  period: string;
  retentionRate: number;
  lapseRate: number;
  reviews: number;
}

export interface HourlyDistributionItem {
  hour: string;
  count: number;
  accuracy: number;
}

export interface RetentionBucket {
  pass: number;
  total: number;
  rate: number;
}

export interface AnswerButtonsData {
  again: number;
  hard: number;
  good: number;
  easy: number;
  total: number;
  young: RetentionBucket;
  mature: RetentionBucket;
}

export interface TrueRetentionPeriod {
  young: RetentionBucket;
  mature: RetentionBucket;
  overall: RetentionBucket;
}

export interface TrueRetentionData {
  last30d: TrueRetentionPeriod;
  allTime: TrueRetentionPeriod;
}

export interface AdvancedStatsData {
  maturityBreakdown: {
    newCards: number;
    learning: number;
    young: number;
    mature: number;
    suspended: number;
    buried: number;
    total: number;
  };
  forecast30d: ForecastDayItem[];
  retentionCurve: RetentionPoint[];
  hourlyDistribution: HourlyDistributionItem[];
  answerButtons: AnswerButtonsData;
  trueRetention: TrueRetentionData;
  dailyLoad: number;
}

export interface EnvInfo {
  platform: 'mac' | 'win' | 'linux';
  osName: string;
  ankiVersion: string;
  platformBadge: string;
  mediaBaseUrl?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'oled';
  accentColor: 'indigo' | 'emerald' | 'cyan' | 'rose' | 'amber' | 'teal' | 'violet' | 'slate';
  language: string;
  customNickname: string;
  collapsedDeckIds: string[];
  debugMode?: boolean;
  showShortcutHints?: boolean;
}

export interface SafetyWarning {
  ticketId: string;
  state: 'recovered' | 'partial' | 'orphaned';
  restored: number;
  failed: string[];
  mismatches: string[];
}

export interface DashboardData {
  userName: string;
  greeting: string;
  dateDisplay: string;
  synced: boolean;
  syncedAt?: number;
  language?: string;
  envInfo?: EnvInfo;
  preferences?: UserPreferences;
  vacation?: VacationState;
  backlog?: BacklogStatus;
  todayStats: {
    completed: number;
    totalTodayWorkload?: number;
    dailyGoal: number;
    remainingForGoal: number;
    estimatedMinutes: number;
    dueReview: number;
    dueNew: number;
    totalPending: number;
    correctRateToday: number;
  };
  streak: {
    current: number;
    longest: number;
    weekActiveDays: number;
    weekTotalDays: number;
  };
  decks: DeckItem[];
  heatmap: {
    totalYearReviews: number;
    weekTotalCards: number;
    dailyAverage: number;
    retentionRate: number;
    wowChange: string;
    cells: HeatmapCell[];
  };
  weeklyRhythm: {
    days: Array<{
      label: string;
      count: number;
      minutes?: number;
      isToday: boolean;
      date: string;
    }>;
    avgSecondsPerCard: number;
    longestSessionMinutes: number;
  };
  advancedStats?: AdvancedStatsData;
  safetyWarning?: SafetyWarning | null;
  lastRescueReceipt?: RescueReceipt | null;
  vacationHistory?: VacationHistoryItem[];
  rescueHistory?: RescueReceipt[];
}

export interface ReviewHistoryEntry {
  id: string;
  date: string;
  remembered: boolean;
  label: string;
}

export interface ReviewCardItem {
  id: string;
  noteId: string;
  noteTypeName?: string;
  isCloze?: boolean;
  cardType?: 'new' | 'learning' | 'review';
  isPreviewOnly?: boolean;
  deckId: string;
  deckName: string;
  fullDeckName: string;
  front: string;
  reading: string;
  meaning: string;
  etymology: string;
  example: string;
  extraHint: string;
  frontHtml: string;
  frontAnswerHtml?: string;
  backHtml: string;
  audioFiles?: string[];
  fields: Record<string, string>;
  fieldOrder?: string[];
  tags: string[];
  reps: number;
  lapses: number;
  intervalDays: number;
  stability: number;
  difficulty: number;
  lastReviewText: string;
  suspended: boolean;
  buried?: boolean;
  flags: number;
  predictions: {
    again: string;
    hard: string;
    good: string;
    easy: string;
  };
  history: ReviewHistoryEntry[];
}

export type LibrarySortOption =
  | 'default'
  | 'due_asc'
  | 'lapses_desc'
  | 'ivl_asc'
  | 'ivl_desc'
  | 'stability_asc'
  | 'front_asc'
  | 'newest';

export interface LibraryFacetCounts {
  statusCounts: Record<string, number>;
  difficultyCounts: Record<string, number>;
  flagCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  tagAllCount: number;
}

export interface LibraryCardItem {
  id: string;
  noteId: string;
  /** 卡型 id：用来在 cardStyles 里挑对应的模板样式表（旧后端可能缺省）。 */
  notetypeId?: string;
  deckId: string;
  deckName: string;
  fullDeckName?: string;
  front: string;
  back: string;
  frontHtml?: string;
  backHtml?: string;
  audioFiles?: string[];
  fields?: Record<string, string>;
  fieldOrder?: string[];
  reading?: string;
  etymology?: string;
  example?: string;
  extraHint?: string;
  tags: string[];
  mastery: number;
  stability: number;
  difficultyLevel: 'high' | 'medium' | 'low';
  dueText: string;
  dueRaw?: number;
  status: 'due' | 'new' | 'suspended' | 'review' | 'buried' | 'completed';
  ratedToday?: boolean;
  suspended: boolean;
  buried?: boolean;
  flags?: number;
  reps: number;
  lapses?: number;
  intervalDays: number;
  lastReviewText?: string;
  nextReviewText?: string;
}

export function isAnkiNativeEnv(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).pycmd === 'function';
}

export async function callAnki<T = any>(
  action: string,
  data: Record<string, any> = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ action, data });
    const command = `modern_anki:${payload}`;

    if (typeof window !== 'undefined' && typeof (window as any).pycmd === 'function') {
      let isSettled = false;
      const timeoutMs = 8000;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          // Resolving with {} made every caller treat a dead bridge as a valid
          // response; reject instead so catch blocks and success checks work.
          reject(new Error(`Anki bridge '${action}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      (window as any).pycmd(command, (rawRes: string) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);
        try {
          if (!rawRes) {
            reject(new Error(`Anki bridge '${action}' returned an empty response`));
            return;
          }
          const res: BridgeResponse<T> = JSON.parse(rawRes);
          if (res.status === 'success') {
            resolve(res.data as T);
          } else {
            reject(new Error(res.message || 'Anki bridge error'));
          }
        } catch (err) {
          reject(err);
        }
      });
    } else {
      resolve(null as unknown as T);
    }
  });
}
