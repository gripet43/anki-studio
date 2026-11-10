// ============================================================================
// Anki Modern OS — Strongly-Typed IPC Client (`window.pycmd` Bridge)
// Supports <2ms native Python communication in Anki 26.x
// ============================================================================

export interface BridgeResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
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
  icon: 'book' | 'code' | 'heart' | 'folder' | 'layers' | 'sparkles';
  accent: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  childrenCount: number;
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

export interface AdvancedStatsData {
  maturityBreakdown: {
    newCards: number;
    learning: number;
    young: number;
    mature: number;
    suspended: number;
    total: number;
  };
  forecast30d: ForecastDayItem[];
  retentionCurve: RetentionPoint[];
  hourlyDistribution: HourlyDistributionItem[];
}

export interface EnvInfo {
  platform: 'mac' | 'win' | 'linux';
  osName: string;
  ankiVersion: string;
  platformBadge: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'oled';
  accentColor: 'indigo' | 'emerald' | 'cyan' | 'rose' | 'amber' | 'teal' | 'violet' | 'slate';
  language: 'auto' | 'zh-CN' | 'en';
  customNickname: string;
  collapsedDeckIds: string[];
  debugMode?: boolean;
  showShortcutHints?: boolean;
}

export interface DashboardData {
  userName: string;
  greeting: string;
  dateDisplay: string;
  synced: boolean;
  syncedAt?: number;
  language?: 'zh-CN' | 'en';
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
  flags: number;
  predictions: {
    again: string;
    hard: string;
    good: string;
    easy: string;
  };
  history: ReviewHistoryEntry[];
}

export interface LibraryCardItem {
  id: string;
  noteId: string;
  deckId: string;
  deckName: string;
  fullDeckName?: string;
  front: string;
  back: string;
  frontHtml?: string;
  backHtml?: string;
  audioFiles?: string[];
  fields?: Record<string, string>;
  reading?: string;
  etymology?: string;
  example?: string;
  extraHint?: string;
  tags: string[];
  mastery: number;
  stability: number;
  difficultyLevel: 'high' | 'medium' | 'low';
  dueText: string;
  status: 'due' | 'new' | 'suspended' | 'review' | 'buried';
  suspended: boolean;
  buried?: boolean;
  reps: number;
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
          console.warn(`[Anki Bridge] Call to '${action}' timed out after ${timeoutMs}ms`);
          resolve({} as T);
        }
      }, timeoutMs);

      (window as any).pycmd(command, (rawRes: string) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);
        try {
          if (!rawRes) {
            resolve({} as T);
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
