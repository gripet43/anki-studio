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
  /** Anki Studio 自身版本（来自 manifest.json 的 human_version）。 */
  studioVersion?: string;
  mediaBaseUrl?: string;
  mediaHttpBaseUrl?: string;
}

export type ReviewStageWidth = 'standard' | 'auto' | 'wide' | 'full';
export type ReviewDockPosition = 'bottom' | 'side';
export type SupportPromptStatus =
  | 'idle'
  | 'snoozed'
  | 'opened_unconfirmed'
  | 'feedback'
  | 'liked'
  | 'opted_out'
  | 'exhausted';

export interface SupportPromptState {
  status: SupportPromptStatus;
  promptCount: number;
  lastPromptedAt: number;
  lastVersion: string;
}
export type ReviewContentScale = 90 | 100 | 115 | 130 | 150;
export const REVIEW_CONTENT_SCALES: readonly ReviewContentScale[] = [90, 100, 115, 130, 150] as const;

export const AVATAR_PRESET_IDS = [
  'book',
  'owl',
  'leaf',
  'spark',
  'cat',
  'mountain',
  'compass',
  'flame',
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];

export type CustomAvatarConfig =
  | { kind: 'initial' }
  | { kind: 'preset'; presetId: AvatarPresetId }
  | { kind: 'image'; dataUrl: string };

export interface PickAvatarImageResult {
  picked: boolean;
  dataUrl?: string;
  canceled?: boolean;
  unsupported?: boolean;
  error?: string;
  errorCode?: 'invalid_type' | 'too_large' | 'decode_failed' | 'read_failed';
}

export interface UserPreferences {
  theme: 'auto' | 'light' | 'dark';
  accentColor: 'indigo' | 'emerald' | 'cyan' | 'rose' | 'amber' | 'teal' | 'violet' | 'slate';
  language: string;
  customNickname: string;
  /** 本地个人头像配置（不随 AnkiWeb 同步）。 */
  customAvatar?: CustomAvatarConfig;
  collapsedDeckIds: string[];
  /** 左侧主导航栏是否收起为紧凑图标栏（全局界面偏好）。 */
  sidebarCollapsed?: boolean;
  /** 全局原生沙盒兼容模式开关（开启后所有复习卡片统一走沙盒兼容渲染）。 */
  compatMode?: boolean;
  sandboxNoteTypeIds?: string[];
  debugMode?: boolean;
  showShortcutHints?: boolean;
  /** 是否展示主题配套插画与首页问候水印（默认开启）。 */
  showIllustrations?: boolean;
  /** 是否在首页显示学习小贴士（默认开启；设置中关闭后永久隐藏）。 */
  showDashboardTips?: boolean;
  /** 首页学习小贴士「今天不再显示」的日期（YYYY-MM-DD，持久化到 config）。 */
  tipsHiddenOn?: string;
  /** 匿名使用统计开关（默认开启，可关闭）。 */
  analyticsEnabled?: boolean;
  /** 答题按钮布局：'binary'（简洁双按钮，默认）或 'four'（原生四按钮）。 */
  answerButtonMode?: 'binary' | 'four';
  /** 连续制卡：添加后保留窗口、清空正文，保留牌组/卡型/标签。 */
  continuousCardCreation?: boolean;
  /** 学习模式卡片显示正面时是否自动播放正面音频（默认关闭）。 */
  autoPlayFrontAudio?: boolean;
  /** 学习模式翻面显示答案时是否自动播放背面音频；无背面音频时回退播放正面音频（默认开启）。 */
  autoPlayBackAudio?: boolean;
  /** 学习模式卡片舞台宽度档位。 */
  reviewStageWidth?: ReviewStageWidth;
  /** 学习模式卡片内容流式缩放比例（%）。 */
  reviewContentScale?: ReviewContentScale;
  /** 学习模式操作栏位置：'bottom'（底部，默认）或 'side'（右侧栏）。 */
  reviewDockPosition?: ReviewDockPosition;
  /** 学习页面双指滑动手势（左滑遗忘 / 右滑记得 / 下拉翻面），默认开启。 */
  reviewSwipeGestures?: boolean;
  /** 禅模式音效开关（默认开启）。 */
  zenSoundEnabled?: boolean;
  /** 禅模式音效音量（0–1，默认 0.5）。 */
  zenSfxVolume?: number;
  /** 禅模式背景声景音量（0–1，默认 0.5）。 */
  zenAmbienceVolume?: number;
  /** 禅模式背景声景（silent / rain / wind / warmth）。 */
  zenAmbience?: 'silent' | 'rain' | 'wind' | 'warmth';
  /** AnkiWeb 支持引导弹窗全局持久化状态。 */
  supportPrompt?: SupportPromptState;
}

export interface SafetyWarning {
  ticketId: string;
  state: 'recovered' | 'partial' | 'orphaned';
  restored: number;
  failed: string[];
  mismatches: string[];
}

export interface DayBoundaryInfo {
  available: boolean;
  schedToday: number;
  dayCutoff: number;
  dayStartSec: number;
  logicalDate: string;
  rolloverHour: number;
  serverNow: number;
}

export interface DayRolloverCheckResult {
  changed: boolean;
  reason: 'rollover' | 'schedule_adjusted' | 'unchanged' | 'unavailable' | string;
  source?: string;
  dayBoundary: DayBoundaryInfo;
  previousSchedToday?: number | null;
  previousDayCutoff?: number | null;
}

export interface DashboardData {
  userName: string;
  greeting: string;
  dateDisplay: string;
  dayBoundary?: DayBoundaryInfo;
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
  allTags?: string[];
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
  notetypeId?: string;
  noteTypeName?: string;
  isCloze?: boolean;
  /** 1-based 原生 Anki 卡序（card.ord + 1），供沙盒挂到 body 的 cardN 类名使用。 */
  cardOrd?: number;
  clozeCardIndex?: number;
  clozeSiblingCount?: number;
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
  replaceFrontOnFlip?: boolean;
  sandboxFrontHtml?: string;
  sandboxBackHtml?: string;
  sandboxCss?: string;
  /** 本地 HTTP 媒体服务根地址（用于沙盒内动态相对脚本路径改写）。 */
  sandboxMediaBaseUrl?: string;
  /** 按需预载的本地媒体脚本 URL 列表（如 jQuery 模板使用的 _jquery.min.js）。 */
  sandboxPreloadScripts?: string[];
  /** 模板脚本依赖配套全局或纯脚本渲染（如 gData / Image Occlusion / Enhanced Cloze）：后端自动标记，前端无需手动开兼容模式。 */
  needsSandbox?: boolean;
  audioFiles?: string[];
  frontAudioFiles?: string[];
  backAudioFiles?: string[];
  sandboxQuestionAudioFiles?: string[];
  sandboxAnswerAudioFiles?: string[];
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
  deckCounts?: Record<string, number>;
  deckAllCount?: number;
}

export interface LibraryCardSibling {
  id: string;
  ord: number;
  label: string;
  status: 'due' | 'new' | 'suspended' | 'review' | 'buried' | 'completed';
  suspended: boolean;
  buried?: boolean;
  dueText: string;
  mastery: number;
  reps: number;
  lapses?: number;
  intervalDays: number;
  isCloze?: boolean;
}

export interface LibraryCardItem {
  id: string;
  noteId: string;
  /** 卡型 id：用来在 cardStyles 里挑对应的模板样式表（旧后端可能缺省）。 */
  notetypeId?: string;
  noteTypeName?: string;
  isCloze?: boolean;
  siblingCardIds?: string[];
  siblingCount?: number;
  siblingCards?: LibraryCardSibling[];
  deckId: string;
  deckName: string;
  fullDeckName?: string;
  front: string;
  back: string;
  frontHtml?: string;
  backHtml?: string;
  /** 翻面时是否整页替换正面（与复习界面同源；Cloze / IO 恒为 false）。 */
  replaceFrontOnFlip?: boolean;
  audioFiles?: string[];
  frontAudioFiles?: string[];
  backAudioFiles?: string[];
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

export interface CardDebugAnomaly {
  code: string;
  message: string;
}

export interface CardDebugInfoResponse {
  available: boolean;
  reason?: string;
  error?: string;
  cardId?: string;
  cardInfo?: {
    id: string;
    nid: string;
    did: string;
    ord: number;
    type: number;
    queue: number;
    ivl: number;
    due: number;
    reps: number;
    lapses: number;
    flags: number;
    data?: string;
  };
  noteInfo?: {
    id: string;
    mid: string;
    tags: string[];
    rawFields: Record<string, string>;
  };
  noteTypeInfo?: {
    id: string;
    name: string;
    modelType: number | null;
    modelTypeLabel: string;
    css: string;
    fieldNames: string[];
    templateCount: number;
    activeOrd: number;
    activeTemplate: {
      name: string;
      qfmt: string;
      afmt: string;
    };
    allTemplateNames: string[];
    templateDetectionFlags?: {
      needsScriptShim: boolean;
      hasScriptTag: boolean;
      hasGData: boolean;
      hasImageOcclusionKeyword: boolean;
    };
  };
  nativeRender?: {
    questionHtml: string;
    answerHtml: string;
    error?: string | null;
  };
  clozeAndCharDiagnostics?: {
    anomalies: CardDebugAnomaly[];
    validClozeFields: string[];
    brokenClozeCandidates: Array<{ field: string; index: number; snippet: string }>;
    htmlInsideClozeFields: string[];
    invisibleChars: Array<{ field: string; index: number; codepoint: string; context: string }>;
    qfmtHasClozeFilter: boolean;
    afmtHasClozeFilter: boolean;
  };
  runtime?: {
    envInfo?: EnvInfo;
    pythonVersion?: string;
    osDetail?: string;
    qtVersion?: string;
    patchHealth?: Record<string, unknown>;
    configSnapshot?: Record<string, unknown>;
  };
}

export interface CallAnkiOptions {
  /** Override bridge IPC timeout in ms; pass `0` or `null` to disable timeout for interactive dialogs. */
  timeoutMs?: number | null;
}

/** Actions that open modal native OS dialogs where user interaction can exceed 8s. */
const NO_TIMEOUT_ACTIONS = new Set([
  'pick_avatar_image',
  'trigger_native_import',
  'trigger_native_export',
]);

export function isAnkiNativeEnv(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).pycmd === 'function';
}

export async function callAnki<T = any>(
  action: string,
  data: Record<string, any> = {},
  options: CallAnkiOptions = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ action, data });
    const command = `modern_anki:${payload}`;

    if (typeof window !== 'undefined' && typeof (window as any).pycmd === 'function') {
      let isSettled = false;
      const disableTimeout =
        options.timeoutMs === 0 ||
        options.timeoutMs === null ||
        (options.timeoutMs === undefined && NO_TIMEOUT_ACTIONS.has(action));
      const timeoutMs = disableTimeout ? null : (options.timeoutMs ?? 8000);
      const timer =
        timeoutMs !== null
          ? setTimeout(() => {
              if (!isSettled) {
                isSettled = true;
                // Resolving with {} made every caller treat a dead bridge as a valid
                // response; reject instead so catch blocks and success checks work.
                reject(new Error(`Anki bridge '${action}' timed out after ${timeoutMs}ms`));
              }
            }, timeoutMs)
          : null;

      (window as any).pycmd(command, (rawRes: string) => {
        if (isSettled) return;
        isSettled = true;
        if (timer !== null) clearTimeout(timer);
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

export type NativeHapticPattern = 'alignment' | 'generic' | 'level_change' | 'strong';

/**
 * Fires a subtle native macOS Taptic Engine pulse (no-op on Web / Linux / Windows).
 * Silently swallows bridge errors so gesture responsiveness is never impacted.
 */
export function triggerNativeHaptic(pattern: NativeHapticPattern = 'alignment'): void {
  if (!isAnkiNativeEnv()) return;
  callAnki('trigger_haptic', { pattern }).catch(() => {
    // Graceful no-op when host bridge lacks haptic support
  });
}
