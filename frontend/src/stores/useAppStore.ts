// ============================================================================
// Anki Studio — Global State Store (100% Real Anki Collection Driven)
// Implements all 14 audit bug fixes, 9 UX enhancements (semantic sync timestamp,
// SettingsModal, developer-only DesignSystemView, etc.), dynamic daily workload,
// Deck Options & FSRS Presets, 7-Color Flags, Custom Study / Mistake Drills,
// i18n language & OS platform adaptation, and two-way Anki lifecycle listeners.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  AdvancedStatsData,
  callAnki,
  CardFlagColor,
  CustomStudyParams,
  DashboardData,
  DeckItem,
  DeckOptionsData,
  EnvInfo,
  isAnkiNativeEnv,
  LibraryCardItem,
  LibraryFacetCounts,
  LibrarySortOption,
  RescueReceipt,
  ReviewCardItem,
} from '../bridge/pycmd';

export type {
  CardFlagColor,
  CustomStudyParams,
  DeckOptionsData,
  LibraryCardItem,
  LibraryFacetCounts,
  LibrarySortOption,
  RescueReceipt,
  ReviewCardItem,
};
import { EMPTY_ADVANCED_STATS, EMPTY_DASHBOARD } from '../data/mockData';
import {
  detectBrowserLanguage,
  detectOSPlatform,
  formatRelativeSyncLabel,
  LanguageOption,
  ResolvedLanguage,
  resolveLanguage,
  translate,
} from '../i18n/translations';

export type NavTab = 'dashboard' | 'library' | 'stats' | 'decks' | 'design-system';
export type ThemeMode = 'light' | 'dark' | 'oled';
export type AccentColor =
  | 'indigo'
  | 'emerald'
  | 'cyan'
  | 'rose'
  | 'amber'
  | 'teal'
  | 'violet'
  | 'slate';
export type LibraryViewMode = 'gallery' | 'table';
export type FlagFilterValue = 'all' | 'flagged' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';

export interface UndoSnapshot {
  cardIndex: number;
  card: ReviewCardItem;
  previousQueue: ReviewCardItem[];
  previousDecks: DeckItem[];
  previousTodayStats: DashboardData['todayStats'];
  sessionStudied: number;
  sessionCorrect: number;
  sessionTotalTimeMs: number;
  wasSessionComplete: boolean;
}

export interface AppState {
  isLoading: boolean;

  // Navigation & Overlays
  activeTab: NavTab;
  inReviewMode: boolean;
  isSessionComplete: boolean;
  isPreviewSession: boolean;
  /** 本次复习会话的范围：具体 deckId 或 'all'（首页「开始今日学习」）。 */
  reviewScopeDeckId: string;
  activeDeckId: string | null;
  cmdKOpen: boolean;
  quickAddOpen: boolean;
  editingCardData: ReviewCardItem | LibraryCardItem | null;
  settingsOpen: boolean;
  settingsInitialTab?: 'appearance' | 'shortcuts' | 'sync' | 'maintenance' | 'native' | 'about';
  vacationModalOpen: boolean;
  vacationModalTab: 'status' | 'history';
  icuModalOpen: boolean;
  icuModalTab: 'rescue' | 'history';
  rescueModalOpen: boolean;
  receiptModalOpen: boolean;
  currentRescueReceipt: RescueReceipt | null;
  customStudyModalOpen: boolean;
  customStudyInitialPreset: CustomStudyParams['preset'];
  customStudyInitialDeckId: string | null;
  inspectorOpen: boolean;
  debugModeUnlocked: boolean;

  // Cloud Sync State (Entire Main Interface Scope)
  syncing: boolean;
  isInitialSyncing: boolean;
  syncJustFinished: boolean;
  lastSyncedTimestamp: number;
  lastSyncedText: string;

  // Theme, i18n, Nickname & Platform
  theme: ThemeMode;
  accentColor: AccentColor;
  languagePref: LanguageOption;
  resolvedLang: ResolvedLanguage;
  customNickname: string;
  showShortcutHints: boolean;
  /** 首页牌组标题旁的学习小贴士「今天不再显示」日期（YYYY-MM-DD）。 */
  tipsHiddenOn: string;
  envInfo: EnvInfo;

  // Dashboard, Decks & Statistics
  dashboard: DashboardData;
  decks: DeckItem[];
  advancedStats: AdvancedStatsData;
  showAllDashboardDecks: boolean;
  collapsedDeckIds: string[];
  sandboxNoteTypeIds: string[];

  // Reviewer & Real Timing
  reviewQueue: ReviewCardItem[];
  currentCardIndex: number;
  isCardFlipped: boolean;
  cardShownAtMs: number;
  sessionTotalTimeMs: number;
  revealedHintsCount: number;
  optionKeyHeld: boolean;
  sessionStudiedCount: number;
  sessionCorrectCount: number;
  undoStack: UndoSnapshot[];
  playingAudioFile: string | null;

  // Inline Editor State
  inlineEditing: boolean;
  editingField: string | null;
  slashMenuOpen: boolean;
  lastSavedTimestamp: string;

  // Global Search Cmd+K
  cmdKQuery: string;
  cmdKSelectedIndex: number;
  cmdKResults: LibraryCardItem[];
  /** notetypeId → 作用域化模板 CSS（背面：已揭开模板隐藏内容）。 */
  cmdKCardStyles: Record<string, string>;
  /** notetypeId → 正面专用模板 CSS（保留模板 display:none，不提前揭底）。 */
  cmdKFrontCardStyles: Record<string, string>;
  cmdKSearching: boolean;

  // Card Library & Faceted Filters + Backend Pagination
  libraryCards: LibraryCardItem[];
  /** notetypeId → 作用域化模板 CSS（背面：已揭开模板隐藏内容）。 */
  libraryCardStyles: Record<string, string>;
  /** notetypeId → 正面专用模板 CSS（保留模板 display:none）。 */
  libraryFrontCardStyles: Record<string, string>;
  libraryTotalCount: number;
  libraryFilteredCount: number;
  libraryFacetCounts: LibraryFacetCounts | null;
  libraryHasMoreFromBackend: boolean;
  libraryAllTags: string[];
  librarySearching: boolean;
  libraryViewMode: LibraryViewMode;
  librarySearchQuery: string;
  libraryVisibleCount: number;
  filterStatus: 'all' | 'due' | 'new' | 'suspended' | 'review' | 'buried' | 'completed';
  filterDifficulty: 'all' | 'high' | 'medium' | 'low';
  filterFlag: FlagFilterValue;
  filterTag: string;
  filterDeckId: string;
  librarySortBy: LibrarySortOption;
  selectedCardIds: string[];
  /** 卡片库「多选模式」：开启后才显示勾选框，默认关闭。 */
  librarySelectionMode: boolean;

  // Toast Notification
  toastMessage: string | null;
}

const initialPlatform = detectOSPlatform();
const initialLang = detectBrowserLanguage();

const initialState: AppState = {
  isLoading: true,

  activeTab: 'dashboard',
  inReviewMode: false,
  isSessionComplete: false,
  isPreviewSession: false,
  reviewScopeDeckId: '',
  activeDeckId: null,
  cmdKOpen: false,
  quickAddOpen: false,
  editingCardData: null,
  settingsOpen: false,
  settingsInitialTab: 'appearance',
  vacationModalOpen: false,
  vacationModalTab: 'status',
  icuModalOpen: false,
  icuModalTab: 'rescue',
  rescueModalOpen: false,
  receiptModalOpen: false,
  currentRescueReceipt: null,
  customStudyModalOpen: false,
  customStudyInitialPreset: 'mistakes',
  customStudyInitialDeckId: null,
  inspectorOpen: false,
  debugModeUnlocked: false,

  syncing: false,
  isInitialSyncing: true,
  syncJustFinished: false,
  lastSyncedTimestamp: Date.now(),
  lastSyncedText: translate(initialLang, 'syncing'),

  theme: 'light',
  accentColor: 'indigo',
  languagePref: 'auto',
  resolvedLang: initialLang,
  customNickname: '',
  showShortcutHints: false,
  tipsHiddenOn: '',
  envInfo: {
    platform: initialPlatform,
    osName: initialPlatform === 'mac' ? 'macOS' : initialPlatform === 'win' ? 'Windows' : 'Linux',
    ankiVersion: '26.9',
    platformBadge: `${initialPlatform === 'mac' ? 'macOS' : initialPlatform === 'win' ? 'Windows' : 'Linux'} · 26.9`,
  },

  dashboard: EMPTY_DASHBOARD,
  decks: [],
  advancedStats: EMPTY_ADVANCED_STATS,
  showAllDashboardDecks: false,
  collapsedDeckIds: [],
  sandboxNoteTypeIds: [],

  reviewQueue: [],
  currentCardIndex: 0,
  isCardFlipped: false,
  cardShownAtMs: Date.now(),
  sessionTotalTimeMs: 0,
  revealedHintsCount: 2,
  optionKeyHeld: false,
  sessionStudiedCount: 0,
  sessionCorrectCount: 0,
  undoStack: [],
  playingAudioFile: null,

  inlineEditing: false,
  editingField: null,
  slashMenuOpen: false,
  lastSavedTimestamp: translate(initialLang, 'autoSaved'),

  cmdKQuery: '',
  cmdKSelectedIndex: 0,
  cmdKResults: [],
  cmdKCardStyles: {},
  cmdKFrontCardStyles: {},
  cmdKSearching: false,

  libraryCards: [],
  libraryCardStyles: {},
  libraryFrontCardStyles: {},
  libraryTotalCount: 0,
  libraryFilteredCount: 0,
  libraryFacetCounts: null,
  libraryHasMoreFromBackend: false,
  libraryAllTags: [],
  librarySearching: false,
  libraryViewMode: 'gallery',
  librarySearchQuery: '',
  libraryVisibleCount: 24,
  filterStatus: 'all',
  filterDifficulty: 'all',
  filterFlag: 'all',
  filterTag: 'all',
  filterDeckId: 'all',
  librarySortBy: 'default',
  selectedCardIds: [],
  librarySelectionMode: false,

  toastMessage: null,
};

let state: AppState = { ...initialState };
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function getAppState(): AppState {
  return state;
}

export function setAppState(updater: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) {
  const nextPartial = typeof updater === 'function' ? updater(state) : updater;
  state = { ...state, ...nextPartial };
  emitChange();
}

let toastTimer: any = null;
export function showToast(message: string) {
  if (toastTimer) clearTimeout(toastTimer);
  setAppState({ toastMessage: message });
  toastTimer = setTimeout(() => {
    setAppState({ toastMessage: null });
  }, 2600);
}

const tState = (key: any, params?: Record<string, string | number>) =>
  translate(state.resolvedLang, key, params);

let libraryDebounceTimer: any = null;
let cmdKDebounceTimer: any = null;

const LIBRARY_PAGE_SIZE = 200;

let coldStartInProgress = false;
let coldStartStartTs = 0;

interface NativeSyncFinishResult {
  ok: boolean;
  syncedAt?: number;
  error?: string;
  reason?: string;
}

let sessionVerifiedSyncTs = 0;
let syncJustFinishedTimer: any = null;
let pendingSyncFinishResolver: ((result: NativeSyncFinishResult) => void) | null = null;

function scheduleSyncJustFinishedClear(durationMs = 2600) {
  if (syncJustFinishedTimer) clearTimeout(syncJustFinishedTimer);
  syncJustFinishedTimer = setTimeout(() => {
    syncJustFinishedTimer = null;
    setAppState({ syncJustFinished: false });
  }, durationMs);
}

function resetSyncIndicatorToSnapshot() {
  if (syncJustFinishedTimer) {
    clearTimeout(syncJustFinishedTimer);
    syncJustFinishedTimer = null;
  }
  setAppState({
    syncing: false,
    syncJustFinished: false,
    lastSyncedText:
      state.lastSyncedTimestamp > 0
        ? formatRelativeSyncLabel(state.lastSyncedTimestamp, state.resolvedLang)
        : tState('notSyncedShort'),
  });
}

// ---- Actions ----

export const appActions = {
  async initFromAnki(silent = false) {
    if (!isAnkiNativeEnv()) {
      setAppState({ isLoading: false, isInitialSyncing: false });
      return;
    }

    if (coldStartInProgress && silent) {
      return;
    }

    const isFirstLaunch = !silent && (state.isInitialSyncing || coldStartInProgress);
    if (!silent) {
      coldStartInProgress = true;
      coldStartStartTs = Date.now();
      setAppState({ isLoading: true, isInitialSyncing: true, syncJustFinished: false });
    }

    const startTs = coldStartStartTs || Date.now();
    const MIN_INITIAL_SYNC_ANIMATION_MS = isFirstLaunch ? 1800 : 0;

    try {
      const [dash, searchRes] = await Promise.all([
        callAnki<DashboardData>('get_dashboard', {
          language: state.languagePref === 'auto' ? undefined : state.languagePref,
          customNickname: state.customNickname || undefined,
        }),
        callAnki<{
          total: number;
          collectionTotal?: number;
          filteredCount: number;
          facetCounts?: LibraryFacetCounts | null;
          hasMore: boolean;
          cards: LibraryCardItem[];
          allTags: string[];
        }>('search_cards', {
          query: state.librarySearchQuery,
          status: state.filterStatus,
          difficulty: state.filterDifficulty,
          flag: state.filterFlag,
          tag: state.filterTag,
          deckId: state.filterDeckId,
          sortBy: state.librarySortBy,
          offset: 0,
          limit: LIBRARY_PAGE_SIZE,
          includeFacets: true,
        }),
        new Promise((resolve) => {
          const elapsed = Date.now() - startTs;
          const remaining = Math.max(0, MIN_INITIAL_SYNC_ANIMATION_MS - elapsed);
          setTimeout(resolve, remaining);
        }),
      ]);

      const dashValid = Boolean(dash && dash.todayStats && Array.isArray(dash.decks));
      const realDecks = dash?.decks || [];
      const realCards = searchRes?.cards || [];
      const prefs = dash?.preferences;
      const effectiveLang = resolveLanguage(
        prefs?.language || state.languagePref,
        dash?.language
      );

      coldStartInProgress = false;

      const hasBackendSyncTs = typeof dash?.syncedAt === 'number';
      const backendSyncTs = hasBackendSyncTs ? (dash!.syncedAt as number) : 0;
      if (!silent && hasBackendSyncTs && backendSyncTs <= 0 && sessionVerifiedSyncTs < coldStartStartTs) {
        sessionVerifiedSyncTs = 0;
      }
      const genuineSyncTs = hasBackendSyncTs
        ? (backendSyncTs > 0 || sessionVerifiedSyncTs > 0
            ? Math.max(backendSyncTs, sessionVerifiedSyncTs)
            : 0)
        : (sessionVerifiedSyncTs > 0 ? sessionVerifiedSyncTs : (state.lastSyncedTimestamp || 0));

      const incomingStats = dash?.advancedStats;
      const hasPopulatedStats = Boolean(
        incomingStats && incomingStats.maturityBreakdown && incomingStats.maturityBreakdown.total > 0
      );

      setAppState({
        isLoading: false,
        isInitialSyncing: false,
        syncJustFinished: silent ? state.syncJustFinished : false,
        decks: realDecks,
        activeDeckId: state.activeDeckId || realDecks[0]?.id || null,
        advancedStats: hasPopulatedStats ? incomingStats! : state.advancedStats,
        theme: prefs?.theme || state.theme,
        accentColor: prefs?.accentColor || state.accentColor,
        languagePref: (prefs?.language as LanguageOption) || state.languagePref,
        resolvedLang: effectiveLang,
        customNickname: prefs?.customNickname ?? state.customNickname,
        collapsedDeckIds: prefs?.collapsedDeckIds || state.collapsedDeckIds,
        sandboxNoteTypeIds: Array.isArray(prefs?.sandboxNoteTypeIds)
          ? prefs.sandboxNoteTypeIds.map((id) => String(id))
          : state.sandboxNoteTypeIds,
        showShortcutHints: prefs?.showShortcutHints !== undefined ? prefs.showShortcutHints : state.showShortcutHints,
        tipsHiddenOn: prefs?.tipsHiddenOn !== undefined ? prefs.tipsHiddenOn : state.tipsHiddenOn,
        debugModeUnlocked: Boolean(prefs?.debugMode) || state.debugModeUnlocked,
        envInfo: dash?.envInfo || state.envInfo,
        lastSyncedTimestamp: genuineSyncTs,
        lastSyncedText: genuineSyncTs > 0
          ? formatRelativeSyncLabel(genuineSyncTs, effectiveLang, Math.max(Date.now(), genuineSyncTs))
          : translate(effectiveLang, 'notSyncedShort'),
        dashboard: dashValid
          ? {
              ...dash!,
              synced: genuineSyncTs > 0,
              syncedAt: genuineSyncTs,
              decks: realDecks,
            }
          : EMPTY_DASHBOARD,
        libraryCards: realCards,
        libraryTotalCount: searchRes?.collectionTotal ?? searchRes?.total ?? realCards.length,
        libraryFilteredCount: searchRes?.filteredCount ?? realCards.length,
        libraryFacetCounts: searchRes?.facetCounts ?? state.libraryFacetCounts,
        libraryHasMoreFromBackend: Boolean(searchRes?.hasMore),
        libraryAllTags: searchRes?.allTags || [],
        cmdKResults: state.cmdKQuery.trim() ? state.cmdKResults : [],
      });

      if (state.inReviewMode && state.activeDeckId) {
        try {
          const freshReviewRes = await callAnki<{ cards: ReviewCardItem[]; totalDue: number }>('start_review', {
            deckId: state.activeDeckId,
            includePreviewWhenEmpty: false,
          });
          if (freshReviewRes && Array.isArray(freshReviewRes.cards)) {
            if (freshReviewRes.cards.length === 0) {
              setAppState({
                reviewQueue: [],
                isSessionComplete: true,
              });
            } else {
              setAppState((prev) => {
                const newQueue = freshReviewRes.cards;
                const newIdx = Math.min(prev.currentCardIndex, Math.max(0, newQueue.length - 1));
                return {
                  reviewQueue: newQueue,
                  currentCardIndex: newIdx,
                  isSessionComplete: false,
                };
              });
            }
          }
        } catch {}
      }

      const safetyWarning = dash?.safetyWarning;
      if (safetyWarning) {
        showToast(tState('autoSaved'));
      }

      // Fetch comprehensive statistics asynchronously after first-screen Dashboard paint
      appActions.refreshStatistics(effectiveLang);
    } catch {
      coldStartInProgress = false;
      setAppState({ isLoading: false, isInitialSyncing: false, syncJustFinished: false });
    }
  },

  async refreshStatistics(langOverride?: string) {
    if (!isAnkiNativeEnv()) return;
    try {
      const stats = await callAnki<AdvancedStatsData>('get_statistics', {
        language:
          langOverride ||
          (state.languagePref === 'auto' ? state.resolvedLang : state.languagePref),
      });
      if (stats && stats.maturityBreakdown) {
        setAppState((prev) => ({
          advancedStats: stats,
          dashboard: {
            ...prev.dashboard,
            advancedStats: stats,
          },
        }));
      }
    } catch {}
  },

  async refreshDashboard(silent = true) {
    return this.initFromAnki(silent);
  },

  async updatePreferences(patch: {
    theme?: ThemeMode;
    accentColor?: AccentColor;
    language?: LanguageOption;
    customNickname?: string;
    collapsedDeckIds?: string[];
    showShortcutHints?: boolean;
    tipsHiddenOn?: string;
  }) {
    const nextLangPref = patch.language !== undefined ? patch.language : state.languagePref;
    const nextResolvedLang = resolveLanguage(nextLangPref, state.dashboard.language);

    setAppState({
      ...(patch.theme ? { theme: patch.theme } : {}),
      ...(patch.accentColor ? { accentColor: patch.accentColor } : {}),
      ...(patch.language ? { languagePref: patch.language, resolvedLang: nextResolvedLang } : {}),
      ...(patch.customNickname !== undefined ? { customNickname: patch.customNickname } : {}),
      ...(patch.collapsedDeckIds ? { collapsedDeckIds: patch.collapsedDeckIds } : {}),
      ...(patch.showShortcutHints !== undefined ? { showShortcutHints: patch.showShortcutHints } : {}),
      ...(patch.tipsHiddenOn !== undefined ? { tipsHiddenOn: patch.tipsHiddenOn } : {}),
    });

    if (isAnkiNativeEnv()) {
      try {
        await callAnki('save_preferences', patch);
        if (patch.language !== undefined || patch.customNickname !== undefined) {
          await appActions.initFromAnki(false);
        }
      } catch {}
    }
  },

  searchLibraryDebounced(overrides?: {
    query?: string;
    status?: 'all' | 'due' | 'new' | 'suspended' | 'review' | 'buried' | 'completed';
    difficulty?: 'all' | 'high' | 'medium' | 'low';
    flag?: FlagFilterValue;
    tag?: string;
    deckId?: string;
    sortBy?: LibrarySortOption;
  }) {
    const nextQuery = overrides?.query !== undefined ? overrides.query : state.librarySearchQuery;
    const nextStatus = overrides?.status !== undefined ? overrides.status : state.filterStatus;
    const nextDifficulty =
      overrides?.difficulty !== undefined ? overrides.difficulty : state.filterDifficulty;
    const nextFlag = overrides?.flag !== undefined ? overrides.flag : state.filterFlag;
    const nextTag = overrides?.tag !== undefined ? overrides.tag : state.filterTag;
    const nextDeckId = overrides?.deckId !== undefined ? overrides.deckId : state.filterDeckId;
    const nextSortBy = overrides?.sortBy !== undefined ? overrides.sortBy : state.librarySortBy;

    setAppState({
      librarySearchQuery: nextQuery,
      filterStatus: nextStatus,
      filterDifficulty: nextDifficulty,
      filterFlag: nextFlag,
      filterTag: nextTag,
      filterDeckId: nextDeckId,
      librarySortBy: nextSortBy,
      libraryVisibleCount: 24,
    });

    if (!isAnkiNativeEnv()) return;

    if (libraryDebounceTimer) clearTimeout(libraryDebounceTimer);
    setAppState({ librarySearching: true });

    libraryDebounceTimer = setTimeout(async () => {
      try {
        const res = await callAnki<{
          total: number;
          collectionTotal?: number;
          filteredCount: number;
          facetCounts?: LibraryFacetCounts | null;
          hasMore: boolean;
          cards: LibraryCardItem[];
          allTags: string[];
          cardStyles?: Record<string, string>;
          cardFrontStyles?: Record<string, string>;
        }>('search_cards', {
          query: nextQuery,
          status: nextStatus,
          difficulty: nextDifficulty,
          flag: nextFlag,
          tag: nextTag,
          deckId: nextDeckId,
          sortBy: nextSortBy,
          offset: 0,
          limit: LIBRARY_PAGE_SIZE,
          includeFacets: true,
        });
        if (res && Array.isArray(res.cards)) {
          setAppState((prev) => ({
            libraryCards: res.cards,
            libraryTotalCount: res.collectionTotal ?? prev.libraryTotalCount,
            libraryFilteredCount: res.filteredCount ?? res.cards.length,
            libraryFacetCounts:
              res.facetCounts !== undefined && res.facetCounts !== null
                ? res.facetCounts
                : prev.libraryFacetCounts,
            libraryHasMoreFromBackend: Boolean(res.hasMore),
            libraryAllTags: res.allTags || prev.libraryAllTags,
            libraryCardStyles: { ...prev.libraryCardStyles, ...(res.cardStyles || {}) },
            libraryFrontCardStyles: {
              ...prev.libraryFrontCardStyles,
              ...(res.cardFrontStyles || {}),
            },
            librarySearching: false,
          }));
        } else {
          setAppState({ librarySearching: false });
        }
      } catch {
        setAppState({ librarySearching: false });
      }
    }, 200);
  },

  async loadMoreLibraryCards() {
    const nextVisible = state.libraryVisibleCount + 24;
    setAppState({ libraryVisibleCount: nextVisible });

    if (
      isAnkiNativeEnv() &&
      state.libraryHasMoreFromBackend &&
      nextVisible + 24 >= state.libraryCards.length
    ) {
      setAppState({ librarySearching: true });
      try {
        const res = await callAnki<{
          total: number;
          filteredCount: number;
          hasMore: boolean;
          cards: LibraryCardItem[];
          cardStyles?: Record<string, string>;
          cardFrontStyles?: Record<string, string>;
        }>('search_cards', {
          query: state.librarySearchQuery,
          status: state.filterStatus,
          difficulty: state.filterDifficulty,
          flag: state.filterFlag,
          tag: state.filterTag,
          deckId: state.filterDeckId,
          sortBy: state.librarySortBy,
          offset: state.libraryCards.length,
          limit: LIBRARY_PAGE_SIZE,
          includeFacets: false,
        });
        if (res && Array.isArray(res.cards)) {
          const existingIds = new Set(state.libraryCards.map((c) => c.id));
          const appended = res.cards.filter((c) => !existingIds.has(c.id));
          setAppState((prev) => ({
            libraryCards: [...prev.libraryCards, ...appended],
            libraryFilteredCount: res.filteredCount ?? prev.libraryFilteredCount,
            libraryHasMoreFromBackend: Boolean(res.hasMore),
            libraryCardStyles: { ...prev.libraryCardStyles, ...(res.cardStyles || {}) },
            libraryFrontCardStyles: {
              ...prev.libraryFrontCardStyles,
              ...(res.cardFrontStyles || {}),
            },
            librarySearching: false,
          }));
        } else {
          setAppState({ librarySearching: false });
        }
      } catch {
        setAppState({ librarySearching: false });
      }
    }
  },

  searchCmdKDebounced(query: string) {
    setAppState({ cmdKQuery: query, cmdKSelectedIndex: 0 });

    if (!isAnkiNativeEnv()) {
      const q = query.trim().toLowerCase();
      const matched = !q
        ? state.libraryCards
        : state.libraryCards.filter(
            (c) =>
              c.front.toLowerCase().includes(q) ||
              c.back.toLowerCase().includes(q) ||
              c.deckName.toLowerCase().includes(q) ||
              c.tags.some((t) => t.toLowerCase().includes(q))
          );
      setAppState({ cmdKResults: matched });
      return;
    }

    if (cmdKDebounceTimer) clearTimeout(cmdKDebounceTimer);
    setAppState({ cmdKSearching: true });

    cmdKDebounceTimer = setTimeout(async () => {
      try {
        const res = await callAnki<{
          total: number;
          filteredCount: number;
          cards: LibraryCardItem[];
          cardStyles?: Record<string, string>;
          cardFrontStyles?: Record<string, string>;
        }>('search_cards', {
          query: query.trim(),
          status: 'all',
          difficulty: 'all',
          flag: 'all',
          tag: 'all',
          deckId: 'all',
          offset: 0,
          limit: 200,
          includeFacets: false,
        });
        if (res && Array.isArray(res.cards)) {
          setAppState({
            cmdKResults: res.cards,
            cmdKCardStyles: res.cardStyles || {},
            cmdKFrontCardStyles: res.cardFrontStyles || {},
            cmdKSearching: false,
          });
        } else {
          setAppState({ cmdKSearching: false });
        }
      } catch {
        setAppState({ cmdKSearching: false });
      }
    }, 180);
  },

  handleNativeSyncFinished(detail?: {
    synced?: boolean;
    syncedAt?: number;
    error?: string;
    reason?: string;
  }) {
    const ok = detail?.synced !== false;

    if (ok) {
      const verifiedTs =
        typeof detail?.syncedAt === 'number' && detail.syncedAt > 0
          ? detail.syncedAt
          : Date.now();
      sessionVerifiedSyncTs = Math.max(sessionVerifiedSyncTs, verifiedTs);
    }

    if (pendingSyncFinishResolver) {
      const resolve = pendingSyncFinishResolver;
      pendingSyncFinishResolver = null;
      resolve({
        ok,
        syncedAt: detail?.syncedAt,
        error: detail?.error,
        reason: detail?.reason,
      });
      return;
    }

    setAppState({ syncing: false });
    if (state.isInitialSyncing) return;

    if (!ok) {
      resetSyncIndicatorToSnapshot();
      if (detail?.error) {
        showToast(detail.error);
      }
      return;
    }

    const verifiedTs = sessionVerifiedSyncTs > 0 ? sessionVerifiedSyncTs : Date.now();
    setAppState({
      syncing: false,
      syncJustFinished: true,
      lastSyncedTimestamp: verifiedTs,
      lastSyncedText: formatRelativeSyncLabel(verifiedTs, state.resolvedLang, verifiedTs),
      dashboard: { ...state.dashboard, synced: true, syncedAt: verifiedTs },
    });
    scheduleSyncJustFinishedClear(2600);
    if (isAnkiNativeEnv()) {
      appActions.initFromAnki(true);
    }
  },

  async syncCollection() {
    if (state.syncing) return;
    if (syncJustFinishedTimer) {
      clearTimeout(syncJustFinishedTimer);
      syncJustFinishedTimer = null;
    }
    setAppState({
      syncing: true,
      syncJustFinished: false,
      lastSyncedText: tState('syncing'),
    });

    const startTime = Date.now();
    const MIN_SYNC_VISUAL_MS = 1000;
    let safetyTimer: any = null;

    const finishPromise: Promise<NativeSyncFinishResult> = isAnkiNativeEnv()
      ? new Promise<NativeSyncFinishResult>((resolve) => {
          pendingSyncFinishResolver = resolve;
          safetyTimer = setTimeout(() => {
            if (pendingSyncFinishResolver === resolve) {
              pendingSyncFinishResolver = null;
              resolve({ ok: false, reason: 'timeout' });
            }
          }, 25000);
        })
      : Promise.resolve<NativeSyncFinishResult>({ ok: true, syncedAt: Date.now() });

    try {
      let syncRes: {
        synced?: boolean;
        triggeredNativeSync?: boolean;
        asyncPending?: boolean;
        mediaSyncInProgress?: boolean;
        requiresLogin?: boolean;
        syncedAt?: number;
      } = { synced: true };

      if (isAnkiNativeEnv()) {
        syncRes = await callAnki('sync');
      }

      if (syncRes?.requiresLogin) {
        if (safetyTimer) clearTimeout(safetyTimer);
        pendingSyncFinishResolver = null;
        resetSyncIndicatorToSnapshot();
        showToast(tState('syncCloudTitle'));
        return;
      }

      if (syncRes && syncRes.synced === false) {
        if (safetyTimer) clearTimeout(safetyTimer);
        pendingSyncFinishResolver = null;
        throw new Error(tState('notSyncedShort'));
      }

      if (syncRes?.mediaSyncInProgress) {
        if (safetyTimer) clearTimeout(safetyTimer);
        pendingSyncFinishResolver = null;
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_SYNC_VISUAL_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_SYNC_VISUAL_MS - elapsed));
        }
        resetSyncIndicatorToSnapshot();
        showToast(tState('syncing'));
        return;
      }

      if (isAnkiNativeEnv() && syncRes && syncRes.asyncPending !== true && pendingSyncFinishResolver) {
        if (safetyTimer) clearTimeout(safetyTimer);
        const resolve = pendingSyncFinishResolver;
        pendingSyncFinishResolver = null;
        resolve({ ok: true, syncedAt: syncRes.syncedAt || Date.now() });
      }

      const [nativeResult] = await Promise.all([
        finishPromise,
        new Promise((resolve) => setTimeout(resolve, MIN_SYNC_VISUAL_MS)),
      ]);
      if (safetyTimer) clearTimeout(safetyTimer);

      if (!nativeResult.ok) {
        if (nativeResult.reason === 'timeout') {
          resetSyncIndicatorToSnapshot();
          if (isAnkiNativeEnv()) {
            appActions.initFromAnki(true);
          }
          return;
        }
        throw new Error(nativeResult.error || tState('notSyncedShort'));
      }

      const verifiedTs =
        typeof nativeResult.syncedAt === 'number' && nativeResult.syncedAt > 0
          ? nativeResult.syncedAt
          : sessionVerifiedSyncTs > 0
          ? sessionVerifiedSyncTs
          : Date.now();
      sessionVerifiedSyncTs = Math.max(sessionVerifiedSyncTs, verifiedTs);

      setAppState({
        syncing: false,
        syncJustFinished: true,
        lastSyncedTimestamp: verifiedTs,
        lastSyncedText: formatRelativeSyncLabel(verifiedTs, state.resolvedLang, verifiedTs),
        dashboard: { ...state.dashboard, synced: true, syncedAt: verifiedTs },
      });

      scheduleSyncJustFinishedClear(2600);

      if (isAnkiNativeEnv()) {
        appActions.initFromAnki(true);
      }
    } catch (err: any) {
      if (safetyTimer) clearTimeout(safetyTimer);
      pendingSyncFinishResolver = null;
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_SYNC_VISUAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SYNC_VISUAL_MS - elapsed));
      }
      setAppState({
        syncing: false,
        syncJustFinished: false,
        lastSyncedText: tState('notSyncedShort'),
      });
      showToast(`${err?.message || tState('notSyncedShort')}`);
    }
  },

  openSettings(
    tab: 'appearance' | 'shortcuts' | 'sync' | 'maintenance' | 'native' | 'about' = 'appearance'
  ) {
    setAppState({ settingsOpen: true, settingsInitialTab: tab });
  },

  async triggerNativeImport() {
    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{ success: boolean; message?: string }>('trigger_native_import', {});
        showToast(res?.message || tState('settingsImportApkgTitle'));
        return res;
      } catch (err: any) {
        showToast(err?.message || tState('settingsImportApkgTitle'));
      }
    } else {
      showToast(tState('settingsImportApkgTitle'));
    }
  },

  async triggerNativeExport() {
    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{ success: boolean; message?: string }>('trigger_native_export', {});
        showToast(res?.message || tState('settingsExportApkgTitle'));
        return res;
      } catch (err: any) {
        showToast(err?.message || tState('settingsExportApkgTitle'));
      }
    } else {
      showToast(tState('settingsExportApkgTitle'));
    }
  },

  async runMaintenanceAction(
    toolType:
      | 'check_db'
      | 'check_empty_cards'
      | 'clean_empty_cards'
      | 'check_media'
      | 'clean_unused_media'
      | 'open_native_tool',
    extraData?: Record<string, any>
  ) {
    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<any>('run_maintenance', {
          toolType,
          ...(extraData || {}),
        });
        if (res?.message) {
          showToast(res.message);
        }
        if (toolType === 'clean_empty_cards' || toolType === 'check_db') {
          await appActions.initFromAnki(true);
        }
        return res;
      } catch (err: any) {
        showToast(err?.message || tState('settingsMaintTitle'));
        return { success: false, toolType, error: String(err) };
      }
    }

    if (toolType === 'check_db') {
      const msg = `${tState('settingsCheckDbTitle')} (OK: ${state.libraryTotalCount})`;
      showToast(msg);
      return {
        success: true,
        toolType: 'check_db',
        status: 'ok',
        integrityResult: 'ok',
        cardCount: state.libraryTotalCount,
        noteCount: state.libraryTotalCount,
        revlogCount: state.dashboard.heatmap.totalYearReviews,
        message: msg,
      };
    }
    if (toolType === 'check_empty_cards' || toolType === 'clean_empty_cards') {
      const msg = `${tState('settingsEmptyCardsTitle')}: 0`;
      showToast(msg);
      return {
        success: true,
        toolType,
        emptyCount: 0,
        removedCount: 0,
        message: msg,
      };
    }
    if (toolType === 'check_media' || toolType === 'clean_unused_media') {
      const msg = `${tState('settingsCheckMediaTitle')}: 0`;
      showToast(msg);
      return {
        success: true,
        toolType,
        totalFiles: 0,
        referencedCount: 0,
        unusedCount: 0,
        missingCount: 0,
        unusedFiles: [],
        missingFiles: [],
        message: msg,
      };
    }
    return { success: true, toolType };
  },

  openVacationModal(tab: 'status' | 'history' = 'status') {
    setAppState({ vacationModalOpen: true, vacationModalTab: tab });
  },

  closeVacationModal() {
    setAppState({ vacationModalOpen: false });
  },

  setVacationTab(tab: 'status' | 'history') {
    setAppState({ vacationModalTab: tab });
  },

  openIcuModal(
    tab: 'rescue' | 'history' = 'rescue',
    receipt?: RescueReceipt | null
  ) {
    const target =
      receipt !== undefined
        ? receipt
        : state.currentRescueReceipt || state.dashboard.lastRescueReceipt || null;
    setAppState({
      icuModalOpen: true,
      icuModalTab: tab,
      currentRescueReceipt: target,
      rescueModalOpen: true,
      receiptModalOpen: tab === 'history',
    });
  },

  closeIcuModal() {
    setAppState({
      icuModalOpen: false,
      rescueModalOpen: false,
      receiptModalOpen: false,
    });
  },

  setIcuTab(tab: 'rescue' | 'history') {
    setAppState({ icuModalTab: tab });
  },

  openRescueModal() {
    appActions.openIcuModal('rescue');
  },

  closeRescueModal() {
    appActions.closeIcuModal();
  },

  openReceiptModal(receipt?: RescueReceipt) {
    appActions.openIcuModal('history', receipt);
  },

  closeReceiptModal() {
    appActions.closeIcuModal();
  },

  openCustomStudyModal(
    preset: CustomStudyParams['preset'] = 'mistakes',
    deckId?: string
  ) {
    setAppState({
      customStudyModalOpen: true,
      customStudyInitialPreset: preset,
      customStudyInitialDeckId: deckId || null,
    });
  },

  closeCustomStudyModal() {
    setAppState({ customStudyModalOpen: false });
  },

  async startCustomStudySession(params: CustomStudyParams) {
    const isPreview = params.isPreviewOnly !== false;
    setAppState({ isLoading: true });

    try {
      if (isAnkiNativeEnv()) {
        const res = await callAnki<{
          success?: boolean;
          cards?: ReviewCardItem[];
          cardIds?: string[];
          count?: number;
          totalMatched?: number;
          isPreviewOnly?: boolean;
        }>('start_custom_study', params);

        if (!res || res.success === false || !Array.isArray(res.cards) || res.cards.length === 0) {
          setAppState({ isLoading: false });
          showToast(tState('emptyLibraryTitle'));
          return { success: false, count: 0 };
        }

        setAppState({
          isLoading: false,
          customStudyModalOpen: false,
          activeDeckId: params.deckId && params.deckId !== 'all' ? params.deckId : state.activeDeckId,
          inReviewMode: true,
          isSessionComplete: false,
          isPreviewSession: Boolean(res.isPreviewOnly ?? isPreview),
          reviewQueue: res.cards,
          currentCardIndex: 0,
          isCardFlipped: false,
          cardShownAtMs: Date.now(),
          sessionStudiedCount: 0,
          sessionCorrectCount: 0,
          sessionTotalTimeMs: 0,
          revealedHintsCount: 2,
          inlineEditing: false,
          inspectorOpen: false,
          slashMenuOpen: false,
        });

        showToast(`${tState('customStudyModalTitle')}: ${res.cards.length} ${tState('cardsUnit')}`);
        return { success: true, count: res.cards.length };
      }

      const limit = Math.max(1, Math.min(200, params.limit || 30));
      let candidates = state.libraryCards.filter((c) => !c.suspended);
      if (params.deckId && params.deckId !== 'all') {
        candidates = candidates.filter((c) => c.deckId === params.deckId);
      }
      if (params.flag && params.flag !== 'all') {
        if (params.flag === 'flagged') {
          candidates = candidates.filter((c) => (c.flags || 0) > 0);
        } else {
          candidates = candidates.filter((c) => (c.flags || 0) === Number(params.flag));
        }
      }
      if (params.tag && params.tag !== 'all') {
        candidates = candidates.filter((c) => c.tags.includes(params.tag!));
      }
      if (params.preset === 'extra_new') {
        candidates = candidates.filter((c) => c.status === 'new');
      }

      const selected = candidates.slice(0, limit);
      if (selected.length === 0) {
        setAppState({ isLoading: false });
        showToast(tState('emptyLibraryTitle'));
        return { success: false, count: 0 };
      }

      setAppState({ isLoading: false, customStudyModalOpen: false });
      await appActions.startReview(
        params.deckId && params.deckId !== 'all' ? params.deckId : undefined,
        false,
        isPreview,
        { limit, cardIds: selected.map((c) => c.id) }
      );
      return { success: true, count: selected.length };
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || tState('customStudyModalTitle'));
      return { success: false, count: 0 };
    }
  },

  async saveDeckOptions(params: {
    deckId: string;
    newPerDay: number;
    revPerDay: number;
    learningSteps: string;
    relearningSteps: string;
    leechThreshold: number;
    desiredRetention: number;
  }) {
    const clampedRet = Math.max(0.7, Math.min(0.97, Number(params.desiredRetention) || 0.9));
    const optimisticOptions: DeckOptionsData = {
      deckId: params.deckId,
      deckName: state.decks.find((d) => d.id === params.deckId)?.fullName || 'Default',
      presetId: state.decks.find((d) => d.id === params.deckId)?.options?.presetId || '1',
      presetName: state.decks.find((d) => d.id === params.deckId)?.options?.presetName || 'Default',
      newPerDay: Math.max(0, Math.min(9999, Math.round(params.newPerDay))),
      revPerDay: Math.max(0, Math.min(9999, Math.round(params.revPerDay))),
      learningSteps: params.learningSteps.trim() || '1m 10m',
      relearningSteps: params.relearningSteps.trim() || '10m',
      leechThreshold: Math.max(1, Math.min(99, Math.round(params.leechThreshold || 8))),
      desiredRetention: Math.round(clampedRet * 100) / 100,
    };

    setAppState((prev) => ({
      decks: prev.decks.map((d) =>
        d.id === params.deckId ? { ...d, options: optimisticOptions } : d
      ),
    }));

    if (isAnkiNativeEnv() && /^\d+$/.test(params.deckId)) {
      try {
        const res = await callAnki<{ saved: boolean; options?: DeckOptionsData; error?: string }>(
          'save_deck_options',
          optimisticOptions
        );
        if (res?.saved === false) {
          showToast(res.error || tState('deckOptionsTitle'));
          return res;
        }
        await appActions.initFromAnki(true);
      } catch (err: any) {
        showToast(err?.message || tState('deckOptionsTitle'));
        return { saved: false };
      }
    }

    showToast(
      `${tState('deckOptionsTitle')} (${optimisticOptions.newPerDay}/${optimisticOptions.revPerDay} · FSRS ${Math.round(optimisticOptions.desiredRetention * 100)}%)`
    );
    return { saved: true, options: optimisticOptions };
  },

  async setVacation(params: {
    days: number;
    reason: string;
    freezeNewCards?: boolean;
    shiftReviewCards?: boolean;
    freezeStreak?: boolean;
  }) {
    setAppState({ isLoading: true });
    try {
      const res = await callAnki<{ success: boolean; message?: string; vacation?: any }>('set_vacation', params);
      if (res?.success === false) {
        setAppState({ isLoading: false });
        showToast(res?.message || tState('vacationModalTitle'));
        return res;
      }
      await appActions.refreshDashboard(false);
      setAppState({ vacationModalOpen: false, isLoading: false });
      appActions.syncCollection();
      showToast(`${tState('vacationActiveBadge')} (${params.days} ${tState('daysUnit')})`);
      return res;
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || tState('vacationModalTitle'));
    }
  },

  async endVacation() {
    setAppState({ isLoading: true });
    try {
      const res = await callAnki<{ success: boolean; message?: string }>('end_vacation', {});
      await appActions.refreshDashboard(false);
      setAppState({ isLoading: false, vacationModalOpen: false });
      appActions.syncCollection();
      showToast(res?.message || tState('endVacationBtn'));
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || tState('endVacationBtn'));
    }
  },

  async cancelVacation() {
    setAppState({ isLoading: true });
    try {
      const res = await callAnki<{ success: boolean; message?: string }>('cancel_vacation', {});
      await appActions.refreshDashboard(false);
      setAppState({ isLoading: false, vacationModalOpen: false });
      appActions.syncCollection();
      showToast(res?.message || tState('vacationRevertBtn'));
      return res;
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || tState('vacationRevertBtn'));
    }
  },

  async rescueBacklog(params: {
    mode: 'amortize' | 'shift';
    days: number;
    deckId?: string;
  }) {
    setAppState({ isLoading: true });
    try {
      const res = await callAnki<{
        success: boolean;
        message?: string;
        error?: string;
        count: number;
        receipt?: RescueReceipt;
      }>('rescue_backlog', params);

      if (res?.success !== true) {
        setAppState({ isLoading: false });
        const msg = res?.error || res?.message || tState('backlogModalTitle');
        showToast(msg);
        return { success: false, message: msg };
      }

      const receipt = res?.receipt || null;
      setAppState({
        isLoading: false,
        icuModalOpen: true,
        icuModalTab: 'history',
        currentRescueReceipt: receipt,
        rescueModalOpen: true,
        receiptModalOpen: Boolean(receipt),
      });

      await appActions.initFromAnki(false);
      appActions.syncCollection();

      showToast(res?.message || tState('backlogModalTitle'));
      return res || { success: true, message: tState('backlogModalTitle') };
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || tState('backlogModalTitle'));
      return { success: false, message: String(err) };
    }
  },

  async undoRescue() {
    setAppState({ isLoading: true });
    try {
      const res = await callAnki<{ success: boolean; message: string; count?: number; receipt?: RescueReceipt }>('undo_rescue', {});
      if (res?.success !== true) {
        setAppState({ isLoading: false });
        showToast(res?.message || tState('icuUndoReliefBtn'));
        return { success: false, message: res?.message || tState('icuUndoReliefBtn') };
      }
      const updatedReceipt = res?.receipt || (state.currentRescueReceipt ? { ...state.currentRescueReceipt, canUndo: false, status: 'undone' as const } : null);
      setAppState({
        isLoading: false,
        currentRescueReceipt: updatedReceipt,
        icuModalTab: 'history',
      });
      await appActions.initFromAnki(false);
      appActions.syncCollection();
      showToast(res?.message || tState('icuUndoReliefBtn'));
      return res;
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || tState('icuUndoReliefBtn'));
      return { success: false, message: String(err) };
    }
  },

  async startLowEnergySession(deckId?: string) {
    setAppState({ isLoading: true });
    try {
      const lowRes = await callAnki<{ success?: boolean; cardIds?: Array<string | number>; count?: number }>(
        'start_low_energy',
        { deckId, limit: 15 }
      );
      if (lowRes?.success === false || !Array.isArray(lowRes?.cardIds)) {
        setAppState({ isLoading: false });
        showToast(tState('lowEnergyBtn'));
        return;
      }
      const curatedIds = Array.isArray(lowRes?.cardIds)
        ? lowRes.cardIds.map((id) => String(id))
        : undefined;
      await appActions.startReview(deckId || undefined, false, false, {
        limit: 15,
        cardIds: curatedIds && curatedIds.length > 0 ? curatedIds : undefined,
      });
      setAppState({ isLoading: false });
      showToast(`${tState('lowEnergyBtn')}: 15 ${tState('cardsUnit')}`);
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || tState('lowEnergyBtn'));
    }
  },

  setActiveTab(tab: NavTab) {
    if (state.inReviewMode) {
      appActions.stopAudio();
    }
    setAppState({
      activeTab: tab,
      inReviewMode: false,
      isSessionComplete: false,
      inlineEditing: false,
      inspectorOpen: false,
      ...(tab !== 'library'
        ? { librarySelectionMode: false, selectedCardIds: [] }
        : {}),
    });
    if (tab === 'stats' && isAnkiNativeEnv()) {
      appActions.refreshStatistics();
    }
  },

  unlockAndOpenDesignSystem() {
    setAppState({
      debugModeUnlocked: true,
      activeTab: 'design-system',
      inReviewMode: false,
      settingsOpen: false,
    });
    showToast(tState('designSystemTitle'));
  },

  toggleDeckCollapse(deckId: string) {
    const exists = state.collapsedDeckIds.includes(deckId);
    const nextCollapsed = exists
      ? state.collapsedDeckIds.filter((id) => id !== deckId)
      : [...state.collapsedDeckIds, deckId];
    appActions.updatePreferences({ collapsedDeckIds: nextCollapsed });
  },

  async toggleNoteTypeSandbox(notetypeId: string) {
    const cleanId = String(notetypeId || '').trim();
    if (!cleanId) return;
    const exists = state.sandboxNoteTypeIds.includes(cleanId);
    const nextIds = exists
      ? state.sandboxNoteTypeIds.filter((id) => id !== cleanId)
      : [...state.sandboxNoteTypeIds, cleanId];
    setAppState({ sandboxNoteTypeIds: nextIds });

    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{
          saved: boolean;
          sandboxNoteTypeIds?: string[];
        }>('toggle_notetype_sandbox', {
          notetypeId: cleanId,
          enabled: !exists,
        });
        if (res && Array.isArray(res.sandboxNoteTypeIds)) {
          setAppState({
            sandboxNoteTypeIds: res.sandboxNoteTypeIds.map((id) => String(id)),
          });
        }
      } catch {}
    }
  },

  async createDeck(name: string, parentFullName?: string) {
    const clean = name.trim();
    if (!clean) return;
    const fullName = parentFullName ? `${parentFullName}::${clean}` : clean;
    const depth = fullName.split('::').length - 1;
    let newId = `deck-${Date.now()}`;

    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{ id: string; name: string }>('create_deck', { name: fullName });
        if (res?.id) newId = res.id;
        await appActions.initFromAnki(false);
        showToast(`${tState('newDeckBtn')}: ${fullName}`);
        return;
      } catch {}
    }

    const parentDeck = parentFullName
      ? state.decks.find((d) => d.fullName === parentFullName || d.name === parentFullName)
      : null;

    const newDeck: DeckItem = {
      id: newId,
      parentId: parentDeck ? parentDeck.id : null,
      name: clean.split('::').pop() || clean,
      fullName,
      depth,
      isChild: depth > 0,
      totalCards: 0,
      dueReview: 0,
      dueNew: 0,
      learnCount: 0,
      reviewCount: 0,
      mastery: 0,
      icon: 'folder',
      accent: 'indigo',
      childrenCount: 0,
    };

    setAppState((prev) => {
      const updated = prev.decks.map((d) =>
        parentDeck && d.id === parentDeck.id ? { ...d, childrenCount: d.childrenCount + 1 } : d
      );
      return {
        decks: [...updated, newDeck],
      };
    });
    showToast(`${tState('newDeckBtn')}: ${fullName}`);
  },

  async renameDeck(deckId: string, newNameInput: string) {
    const clean = newNameInput.trim();
    if (!clean) return;

    const target = state.decks.find((d) => d.id === deckId);
    let fullNewName = clean;
    if (target && target.isChild && !clean.includes('::') && target.fullName.includes('::')) {
      const parentPrefix = target.fullName.slice(0, target.fullName.lastIndexOf('::'));
      fullNewName = `${parentPrefix}::${clean}`;
    }

    if (isAnkiNativeEnv() && /^\d+$/.test(deckId)) {
      try {
        await callAnki('rename_deck', { deckId, name: fullNewName });
        await appActions.initFromAnki(false);
        showToast(`${tState('deckActionRename')}: ${fullNewName}`);
        return;
      } catch {}
    }

    const shortName = fullNewName.split('::').pop() || fullNewName;
    const oldPrefix = target ? `${target.fullName}::` : '';

    setAppState((prev) => ({
      decks: prev.decks.map((d) => {
        if (d.id === deckId) {
          return {
            ...d,
            name: shortName,
            fullName: fullNewName,
            depth: fullNewName.split('::').length - 1,
            isChild: fullNewName.includes('::'),
          };
        }
        if (oldPrefix && d.fullName.startsWith(oldPrefix)) {
          const updatedChildFull = `${fullNewName}::${d.fullName.slice(oldPrefix.length)}`;
          return {
            ...d,
            fullName: updatedChildFull,
            depth: updatedChildFull.split('::').length - 1,
          };
        }
        return d;
      }),
    }));
    showToast(`${tState('deckActionRename')}: ${fullNewName}`);
  },

  async deleteDeck(deckId: string) {
    const target = state.decks.find((d) => d.id === deckId);
    if (!target) return;

    if (isAnkiNativeEnv() && /^\d+$/.test(deckId)) {
      try {
        await callAnki('delete_deck', { deckId });
        await appActions.initFromAnki(false);
        showToast(`${tState('batchDelete')}: ${target.fullName}`);
        return;
      } catch {}
    }

    setAppState((prev) => ({
      decks: prev.decks.filter(
        (d) => d.id !== deckId && !d.fullName.startsWith(`${target.fullName}::`)
      ),
    }));
    showToast(`${tState('batchDelete')}: ${target.fullName}`);
  },

  async startReview(
    deckId?: string,
    startOnAnswerSide = false,
    includePreview = false,
    options?: { limit?: number; cardIds?: string[] }
  ) {
    const targetDeckId = deckId || state.activeDeckId || state.decks[0]?.id || '';
    setAppState({
      activeDeckId: targetDeckId,
      reviewScopeDeckId: targetDeckId || 'all',
      inReviewMode: true,
      isSessionComplete: false,
      isPreviewSession: includePreview,
      currentCardIndex: 0,
      isCardFlipped: startOnAnswerSide,
      cardShownAtMs: Date.now(),
      sessionStudiedCount: 0,
      sessionCorrectCount: 0,
      sessionTotalTimeMs: 0,
      revealedHintsCount: 2,
      inlineEditing: false,
      inspectorOpen: false,
      slashMenuOpen: false,
    });

    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{ cards: ReviewCardItem[]; isPreviewOnly?: boolean }>(
          'start_review',
          {
            deckId: targetDeckId,
            includePreviewWhenEmpty: includePreview,
            ...(options?.limit ? { limit: options.limit } : {}),
            ...(options?.cardIds ? { cardIds: options.cardIds } : {}),
          }
        );
        const cards = res?.cards || [];
        setAppState({
          reviewQueue: cards,
          currentCardIndex: 0,
          isPreviewSession: Boolean(res?.isPreviewOnly || includePreview),
          isSessionComplete: cards.length === 0,
          cardShownAtMs: Date.now(),
        });
        return;
      } catch {
        setAppState({
          reviewQueue: [],
          currentCardIndex: 0,
          isSessionComplete: true,
        });
        return;
      }
    }

    const targetDeck = state.decks.find((d) => d.id === targetDeckId);
    const matchingLibCards = state.libraryCards.filter((c) => {
      if (c.suspended) return false;
      if (options?.cardIds && !options.cardIds.includes(c.id)) return false;
      const inDeck =
        !targetDeckId ||
        c.deckId === targetDeckId ||
        (targetDeck && (c.fullDeckName || c.deckName).startsWith(targetDeck.fullName));
      if (!inDeck) return false;
      if (includePreview) return true;
      return c.status === 'due' || c.status === 'new';
    });

    const synthesizedQueue: ReviewCardItem[] = matchingLibCards.map((cardItem) => ({
      id: cardItem.id,
      noteId: cardItem.noteId,
      noteTypeName: 'Basic',
      isCloze: (cardItem.frontHtml || cardItem.front).includes('{{c1::'),
      cardType: cardItem.status === 'new' ? 'new' : 'review',
      isPreviewOnly: includePreview,
      deckId: cardItem.deckId,
      deckName: cardItem.deckName,
      fullDeckName: cardItem.fullDeckName || cardItem.deckName,
      front: cardItem.front,
      reading: cardItem.reading || '',
      meaning: cardItem.back,
      etymology: cardItem.etymology || '',
      example: cardItem.example || '',
      extraHint: cardItem.extraHint || '',
      frontHtml: cardItem.frontHtml || cardItem.front,
      frontAnswerHtml: cardItem.frontHtml || cardItem.front,
      backHtml: cardItem.backHtml || cardItem.back,
      audioFiles: cardItem.audioFiles || [],
      fields: cardItem.fields || { 正面: cardItem.front, 释义: cardItem.back },
      fieldOrder: cardItem.fields ? Object.keys(cardItem.fields) : ['正面', '释义'],
      tags: cardItem.tags,
      reps: cardItem.reps,
      lapses: 0,
      intervalDays: cardItem.intervalDays,
      stability: cardItem.stability,
      difficulty: 5.0,
      lastReviewText: cardItem.lastReviewText || tState('statusNew'),
      suspended: cardItem.suspended,
      flags: cardItem.flags || 0,
      predictions: {
        again: '10m',
        hard: '2d',
        good: '4d',
        easy: '9d',
      },
      history: [],
    }));

    setAppState({
      reviewQueue: synthesizedQueue,
      currentCardIndex: 0,
      isPreviewSession: includePreview,
      isSessionComplete: synthesizedQueue.length === 0,
      cardShownAtMs: Date.now(),
    });
  },

  openCardInReviewerAndEdit(cardItem: LibraryCardItem, startEditing = true) {
    if (startEditing) {
      appActions.openCardEditor(cardItem);
      return;
    }

    const existingIdx = state.reviewQueue.findIndex((c) => c.id === cardItem.id);
    if (existingIdx >= 0) {
      setAppState({
        inReviewMode: true,
        isSessionComplete: false,
        currentCardIndex: existingIdx,
        isCardFlipped: true,
        cardShownAtMs: Date.now(),
        inlineEditing: startEditing,
        inspectorOpen: true,
        cmdKOpen: false,
      });
      return;
    }

    const synthesized: ReviewCardItem = {
      id: cardItem.id,
      noteId: cardItem.noteId,
      noteTypeName: 'Basic',
      isCloze: (cardItem.frontHtml || cardItem.front).includes('{{c1::'),
      cardType: cardItem.status === 'new' ? 'new' : 'review',
      deckId: cardItem.deckId,
      deckName: cardItem.deckName,
      fullDeckName: cardItem.fullDeckName || cardItem.deckName,
      front: cardItem.front,
      reading: cardItem.reading || `${cardItem.deckName}`,
      meaning: cardItem.back,
      etymology: cardItem.etymology || '',
      example: cardItem.example || '',
      extraHint: cardItem.extraHint || '',
      frontHtml: cardItem.frontHtml || cardItem.front,
      frontAnswerHtml: cardItem.frontHtml || cardItem.front,
      backHtml: cardItem.backHtml || cardItem.back,
      audioFiles: cardItem.audioFiles || [],
      fields: cardItem.fields || {
        正面: cardItem.front,
        释义: cardItem.back,
        ...(cardItem.example ? { 例句: cardItem.example } : {}),
      },
      fieldOrder: cardItem.fields
        ? Object.keys(cardItem.fields)
        : ['正面', '释义', ...(cardItem.example ? ['例句'] : [])],
      tags: cardItem.tags,
      reps: cardItem.reps,
      lapses: 0,
      intervalDays: cardItem.intervalDays,
      stability: cardItem.stability,
      difficulty: cardItem.difficultyLevel === 'high' ? 7.2 : 4.8,
      lastReviewText: cardItem.lastReviewText || '',
      suspended: cardItem.suspended,
      flags: cardItem.flags || 0,
      predictions: {
        again: '10m',
        hard: '2d',
        good: '4d',
        easy: '9d',
      },
      history: [],
    };

    setAppState((prev) => ({
      reviewQueue: [synthesized, ...prev.reviewQueue],
      currentCardIndex: 0,
      inReviewMode: true,
      isSessionComplete: false,
      isCardFlipped: true,
      cardShownAtMs: Date.now(),
      inlineEditing: startEditing,
      inspectorOpen: true,
      cmdKOpen: false,
    }));
  },

  exitReview() {
    appActions.stopAudio();
    setAppState({
      inReviewMode: false,
      isSessionComplete: false,
      isPreviewSession: false,
      inlineEditing: false,
      inspectorOpen: false,
      slashMenuOpen: false,
    });
    if (isAnkiNativeEnv()) {
      appActions.initFromAnki(true);
    }
  },

  flipCard() {
    setAppState((prev) => {
      const nextFlipped = !prev.isCardFlipped;
      const currentCard = prev.reviewQueue[prev.currentCardIndex];
      if (nextFlipped && currentCard?.audioFiles && currentCard.audioFiles.length > 0) {
        appActions.playAudio(currentCard.audioFiles[0], true);
      }
      return { isCardFlipped: nextFlipped };
    });
  },

  async playAudio(filename?: string, silentToast = false) {
    const currentCard = state.reviewQueue[state.currentCardIndex];
    const targetFile = filename || currentCard?.audioFiles?.[0];
    if (!targetFile) {
      if (!silentToast) {
        showToast(tState('readAloud'));
      }
      return;
    }

    setAppState({ playingAudioFile: targetFile });
    if (isAnkiNativeEnv()) {
      try {
        await callAnki('play_audio', { filename: targetFile });
      } catch {}
    }

    if (!silentToast) {
      showToast(`${tState('readAloud')}: ${targetFile}`);
    }
    setTimeout(() => {
      setAppState({ playingAudioFile: null });
    }, 900);
  },

  /** 停止 Anki 原生 AVPlayer 正在播放的音频（离开复习界面/切换卡片时调用）。 */
  stopAudio() {
    setAppState({ playingAudioFile: null });
    if (isAnkiNativeEnv()) {
      callAnki('stop_audio', {}).catch(() => {});
    }
  },

  revealNextHint() {
    setAppState((prev) => ({
      revealedHintsCount: prev.revealedHintsCount >= 3 ? 1 : prev.revealedHintsCount + 1,
    }));
  },

  /**
   * 当前队列快照用完后，重新向 Anki 调度器要一次队列。
   *
   * 刚答完的新卡/复习卡还处在 1m / 10m 学习步里，`get_queued_cards()` 的
   * learn-ahead 会把它们放回队列（原生 Anki 也是这么继续的）。只有调度器
   * 真的返回空，才允许显示「今日已完成」。
   */
  async continueReviewSession(): Promise<ReviewCardItem[] | null> {
    if (!isAnkiNativeEnv()) return null;
    const scope = getAppState().reviewScopeDeckId || 'all';
    try {
      const res = await callAnki<{ cards: ReviewCardItem[] }>('start_review', {
        deckId: scope,
        includePreviewWhenEmpty: false,
      });
      const cards = res?.cards || [];
      return cards.length > 0 ? cards : null;
    } catch {
      return null;
    }
  },

  async answerCurrentCard(ease: 1 | 2 | 3 | 4) {
    const currentCard = state.reviewQueue[state.currentCardIndex];
    if (!currentCard) return;

    // 翻到下一张前先停掉上一张可能还在播的音频（原生复习界面同样会停）
    appActions.stopAudio();

    const realElapsedMs = Math.max(500, Math.min(60000, Date.now() - state.cardShownAtMs));
    const isPreview = Boolean(state.isPreviewSession || currentCard.isPreviewOnly);

    const snapshot: UndoSnapshot = {
      cardIndex: state.currentCardIndex,
      card: currentCard,
      previousQueue: [...state.reviewQueue],
      previousDecks: state.decks.map((d) => ({ ...d })),
      previousTodayStats: { ...state.dashboard.todayStats },
      sessionStudied: state.sessionStudiedCount,
      sessionCorrect: state.sessionCorrectCount,
      sessionTotalTimeMs: state.sessionTotalTimeMs,
      wasSessionComplete: state.isSessionComplete,
    };

    let answerPromise: Promise<unknown> | null = null;
    if (isAnkiNativeEnv() && !isPreview && /^\d+$/.test(currentCard.id)) {
      answerPromise = callAnki('answer_card', {
        cardId: currentCard.id,
        ease,
        elapsedMs: realElapsedMs,
        isPreviewOnly: false,
      }).catch(() => {});
    }

    const isCorrect = ease > 1;
    const isNewCard = currentCard.cardType === 'new';

    const nextQueue = [...state.reviewQueue];
    if (ease === 1 && !isPreview) {
      nextQueue.push({
        ...currentCard,
        cardType: 'learning',
        reps: currentCard.reps + 1,
        lapses: currentCard.lapses + 1,
      });
    }

    const isLastCard = state.currentCardIndex + 1 >= nextQueue.length;

    // 最后一张答完先等它落库，再问调度器是否还有可学的卡（含学习步内的卡）。
    let continuation: ReviewCardItem[] | null = null;
    if (isLastCard && !isPreview) {
      if (answerPromise) await answerPromise;
      continuation = await appActions.continueReviewSession();
    }

    const shouldDecrementDue = !isPreview && ease > 1;
    const nextDueNew = shouldDecrementDue && isNewCard
      ? Math.max(0, state.dashboard.todayStats.dueNew - 1)
      : state.dashboard.todayStats.dueNew;
    const nextDueReview = shouldDecrementDue && !isNewCard
      ? Math.max(0, state.dashboard.todayStats.dueReview - 1)
      : state.dashboard.todayStats.dueReview;
    const nextCompleted = isPreview
      ? state.dashboard.todayStats.completed
      : state.dashboard.todayStats.completed + 1;
    const nextTotalPending = nextDueNew + nextDueReview;
    const nextTotalWorkload = nextCompleted + nextTotalPending;

    const updatedDecks = state.decks.map((d) => {
      if (!shouldDecrementDue) return d;
      const matchesDeck =
        d.id === currentCard.deckId ||
        currentCard.fullDeckName === d.fullName ||
        currentCard.fullDeckName.startsWith(`${d.fullName}::`);
      if (!matchesDeck) return d;
      return {
        ...d,
        dueNew: isNewCard ? Math.max(0, d.dueNew - 1) : d.dueNew,
        dueReview: !isNewCard ? Math.max(0, d.dueReview - 1) : d.dueReview,
      };
    });

    setAppState((prev) => ({
      undoStack: [...prev.undoStack, snapshot],
      reviewQueue: continuation ?? nextQueue,
      decks: updatedDecks,
      currentCardIndex: continuation
        ? 0
        : isLastCard
        ? prev.currentCardIndex
        : prev.currentCardIndex + 1,
      isSessionComplete: continuation ? false : isLastCard,
      isCardFlipped: false,
      cardShownAtMs: Date.now(),
      revealedHintsCount: 2,
      sessionStudiedCount: prev.sessionStudiedCount + 1,
      sessionCorrectCount: prev.sessionCorrectCount + (isCorrect ? 1 : 0),
      sessionTotalTimeMs: prev.sessionTotalTimeMs + realElapsedMs,
      dashboard: {
        ...prev.dashboard,
        decks: updatedDecks,
        todayStats: {
          ...prev.dashboard.todayStats,
          completed: nextCompleted,
          totalTodayWorkload: nextTotalWorkload,
          dailyGoal: nextTotalWorkload,
          remainingForGoal: nextTotalPending,
          dueNew: nextDueNew,
          dueReview: nextDueReview,
          totalPending: nextTotalPending,
        },
      },
    }));

    if (continuation) {
      // 一批学完了但调度器还有卡：明确告诉用户是「本批完成、继续下一批」，
      // 而不是让他误以为今日已学完（也不能显示今日完成）。
      showToast(tState('batchContinueToast', { n: nextQueue.length }));
      return;
    }

    const dynamicIvl =
      ease === 1
        ? currentCard.predictions.again
        : ease === 2
        ? currentCard.predictions.hard
        : ease === 3
        ? currentCard.predictions.good
        : currentCard.predictions.easy;

    const ratingName = {
      1: tState('rateAgain'),
      2: tState('rateHard'),
      3: tState('rateGood'),
      4: tState('rateEasy'),
    }[ease];

    showToast(`${ratingName} · ${dynamicIvl}`);
  },

  async undoLastReview() {
    if (state.undoStack.length === 0) {
      if (isAnkiNativeEnv()) {
        try {
          const res = await callAnki<{ undone: boolean; label: string }>('undo');
          showToast(res?.label || tState('undoBtnShort'));
          await appActions.initFromAnki(false);
          return;
        } catch {}
      }
      showToast(tState('undoBtnShort'));
      return;
    }

    const last = state.undoStack[state.undoStack.length - 1];
    if (isAnkiNativeEnv() && !state.isPreviewSession) {
      callAnki('undo').catch(() => {});
    }

    setAppState((prev) => ({
      undoStack: prev.undoStack.slice(0, -1),
      reviewQueue: last.previousQueue,
      decks: last.previousDecks,
      currentCardIndex: last.cardIndex,
      isSessionComplete: false,
      isCardFlipped: true,
      cardShownAtMs: Date.now(),
      sessionStudiedCount: last.sessionStudied,
      sessionCorrectCount: last.sessionCorrect,
      sessionTotalTimeMs: last.sessionTotalTimeMs,
      dashboard: {
        ...prev.dashboard,
        decks: last.previousDecks,
        todayStats: last.previousTodayStats,
      },
    }));
    showToast(`${tState('undoBtnShort')}: ${last.card.front}`);
  },

  async deleteCurrentReviewCard() {
    const currentCard = state.reviewQueue[state.currentCardIndex];
    if (!currentCard) return;

    if (isAnkiNativeEnv()) {
      try {
        await callAnki('delete_cards', {
          cardId: currentCard.id,
          noteId: currentCard.noteId,
        });
      } catch {}
    }

    const nextQueue = state.reviewQueue.filter(
      (c) => c.id !== currentCard.id && c.noteId !== currentCard.noteId
    );
    const nextLib = state.libraryCards.filter(
      (c) => c.id !== currentCard.id && c.noteId !== currentCard.noteId
    );
    const nextIdx = Math.min(state.currentCardIndex, Math.max(0, nextQueue.length - 1));

    setAppState((prev) => ({
      reviewQueue: nextQueue,
      libraryCards: nextLib,
      libraryTotalCount: Math.max(0, prev.libraryTotalCount - 1),
      libraryFilteredCount: Math.max(0, prev.libraryFilteredCount - 1),
      currentCardIndex: nextIdx,
      isSessionComplete: nextQueue.length === 0,
      isCardFlipped: false,
      inlineEditing: false,
      inspectorOpen: false,
      cardShownAtMs: Date.now(),
    }));

    showToast(`${tState('deleteCardBtn')}: ${currentCard.front}`);
  },

  async toggleSuspendCurrentReviewCard() {
    const currentCard = state.reviewQueue[state.currentCardIndex];
    if (!currentCard) return;

    const nextSuspended = !currentCard.suspended;
    if (isAnkiNativeEnv()) {
      try {
        await callAnki('toggle_suspend', {
          cardId: currentCard.id,
          suspend: nextSuspended,
        });
      } catch {}
    }

    const nextLib = state.libraryCards.map((c) =>
      c.id === currentCard.id
        ? {
            ...c,
            suspended: nextSuspended,
            status: (nextSuspended ? 'suspended' : 'due') as LibraryCardItem['status'],
            dueText: nextSuspended ? tState('statusSuspended') : c.dueText,
          }
        : c
    );

    if (nextSuspended) {
      const nextQueue = state.reviewQueue.filter((c) => c.id !== currentCard.id);
      const nextIdx = Math.min(state.currentCardIndex, Math.max(0, nextQueue.length - 1));
      setAppState({
        reviewQueue: nextQueue,
        libraryCards: nextLib,
        currentCardIndex: nextIdx,
        isSessionComplete: nextQueue.length === 0,
        isCardFlipped: false,
        cardShownAtMs: Date.now(),
      });
      showToast(`${tState('suspendCardBtn')}: ${currentCard.front}`);
    } else {
      await appActions.saveInlineCardUpdate({ suspended: false });
      showToast(tState('unsuspendCardBtn'));
    }
  },

  buryCurrentReviewCard: async () => {
    const state = getAppState();
    const currentCard = state.reviewQueue[state.currentCardIndex];
    if (!currentCard) return;

    if (isAnkiNativeEnv()) {
      try {
        await callAnki('toggle_bury', {
          cardId: currentCard.id,
          bury: true,
        });
      } catch {}
    }

    const nextLib = state.libraryCards.map((c) =>
      c.id === currentCard.id
        ? {
            ...c,
            buried: true,
            status: 'buried' as LibraryCardItem['status'],
            dueText: tState('statusBuried'),
          }
        : c
    );

    const nextQueue = state.reviewQueue.filter((c) => c.id !== currentCard.id);
    const nextIdx = Math.min(state.currentCardIndex, Math.max(0, nextQueue.length - 1));
    setAppState({
      reviewQueue: nextQueue,
      libraryCards: nextLib,
      currentCardIndex: nextIdx,
      isSessionComplete: nextQueue.length === 0,
      isCardFlipped: false,
      cardShownAtMs: Date.now(),
    });
    showToast(`${tState('buryCardBtn')}: ${currentCard.front}`);
  },

  async setCurrentReviewCardFlag(flag: CardFlagColor, toggleIfSame = true) {
    const currentCard = state.reviewQueue[state.currentCardIndex];
    if (!currentCard) return;

    const currentFlag = (currentCard.flags || 0) as CardFlagColor;
    const nextFlag: CardFlagColor =
      toggleIfSame && flag > 0 && currentFlag === flag ? 0 : flag;

    const nextQueue = [...state.reviewQueue];
    nextQueue[state.currentCardIndex] = {
      ...currentCard,
      flags: nextFlag,
    };

    const nextLib = state.libraryCards.map((c) =>
      c.id === currentCard.id ? { ...c, flags: nextFlag } : c
    );

    setAppState({
      reviewQueue: nextQueue,
      libraryCards: nextLib,
    });

    if (isAnkiNativeEnv() && /^\d+$/.test(currentCard.id)) {
      try {
        await callAnki('set_card_flag', {
          cardId: currentCard.id,
          flag: nextFlag,
        });
      } catch {}
    }

    if (nextFlag === 0) {
      showToast(tState('flagNone'));
    } else {
      showToast(tState(`flagLabel_${nextFlag}` as any));
    }
  },

  enterInlineEdit(field: string = '释义', openInspector = true) {
    setAppState({
      inlineEditing: true,
      editingField: field,
      inspectorOpen: openInspector,
      isCardFlipped: true,
    });
  },

  exitInlineEdit() {
    setAppState({
      inlineEditing: false,
      editingField: null,
      slashMenuOpen: false,
    });
  },

  async saveInlineCardUpdate(updates: Partial<ReviewCardItem>) {
    const currentCard = state.reviewQueue[state.currentCardIndex];
    if (!currentCard) return;

    const mergedFields: Record<string, string> = updates.fields
      ? { ...currentCard.fields, ...updates.fields }
      : {
          ...currentCard.fields,
          ...(updates.front !== undefined ? { 正面: updates.front } : {}),
          ...(updates.meaning !== undefined ? { 释义: updates.meaning } : {}),
          ...(updates.example !== undefined ? { 例句: updates.example } : {}),
        };

    const fieldKeys = currentCard.fieldOrder || Object.keys(mergedFields);
    const firstFieldVal =
      fieldKeys.length > 0 ? mergedFields[fieldKeys[0]] : updates.front || currentCard.front;
    const secondFieldVal =
      fieldKeys.length > 1
        ? mergedFields[fieldKeys[1]]
        : updates.meaning || currentCard.meaning;

    const updatedCard: ReviewCardItem = {
      ...currentCard,
      ...updates,
      front: updates.front ?? firstFieldVal ?? currentCard.front,
      meaning: updates.meaning ?? secondFieldVal ?? currentCard.meaning,
      frontHtml: updates.frontHtml ?? updates.front ?? firstFieldVal ?? currentCard.frontHtml,
      frontAnswerHtml:
        updates.frontAnswerHtml ?? updates.front ?? firstFieldVal ?? currentCard.frontAnswerHtml,
      backHtml: updates.backHtml ?? updates.meaning ?? secondFieldVal ?? currentCard.backHtml,
      fields: mergedFields,
    };

    const nextQueue = [...state.reviewQueue];
    nextQueue[state.currentCardIndex] = updatedCard;

    const nextLib = state.libraryCards.map((c) =>
      c.id === currentCard.id
        ? {
            ...c,
            front: updatedCard.front,
            back: updatedCard.meaning,
            frontHtml: updatedCard.frontHtml,
            backHtml: updatedCard.backHtml,
            fields: updatedCard.fields,
            tags: updatedCard.tags,
            suspended: updatedCard.suspended,
            deckId: updatedCard.deckId,
            deckName: updatedCard.deckName,
          }
        : c
    );

    setAppState({
      reviewQueue: nextQueue,
      libraryCards: nextLib,
      lastSavedTimestamp: tState('autoSaved'),
    });

    if (isAnkiNativeEnv()) {
      try {
        await callAnki('update_card_inline', {
          cardId: updatedCard.id,
          noteId: updatedCard.noteId,
          fields: updatedCard.fields,
          front: updatedCard.front,
          meaning: updatedCard.meaning,
          example: updatedCard.example,
          tags: updatedCard.tags,
          suspended: updatedCard.suspended,
          deckId: updatedCard.deckId,
          deckName: updatedCard.deckName,
        });
      } catch {}
    }
    showToast(tState('autoSaved'));
  },

  async pasteImageFromClipboard(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = String(reader.result || '');
        const ext = file.name?.split('.').pop() || 'png';
        if (isAnkiNativeEnv()) {
          try {
            const res = await callAnki<{
              saved: boolean;
              filename: string;
              fileUrl: string;
              htmlTag: string;
            }>('save_pasted_image', {
              base64Data,
              ext,
              filename: `paste_${Date.now()}.${ext}`,
            });
            if (res?.fileUrl) {
              showToast(`${tState('autoSaved')}: ${res.filename}`);
              resolve(`<img src="${res.fileUrl}" data-anki-media="${res.filename}" />`);
              return;
            }
          } catch {}
        }
        resolve(`<img src="${base64Data}" />`);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  },

  openQuickAdd(defaultDeckId?: string) {
    // 'all' 是复习会话的全局作用域，不是真实牌组 id，不能塞给制卡器默认牌组
    const fallbackDeckId =
      state.activeDeckId && state.activeDeckId !== 'all' ? state.activeDeckId : null;
    setAppState({
      quickAddOpen: true,
      editingCardData: null,
      activeDeckId: defaultDeckId || fallbackDeckId,
    });
  },

  openCardEditor(card: ReviewCardItem | LibraryCardItem) {
    setAppState({
      quickAddOpen: true,
      editingCardData: card,
    });
  },

  closeCardEditor() {
    setAppState({
      quickAddOpen: false,
      editingCardData: null,
    });
  },

  async saveCardEdits(payload: {
    cardId: string;
    noteId: string;
    deckId: string;
    deckName: string;
    front: string;
    back: string;
    tags: string[];
    fields?: Record<string, string>;
  }) {
    const isCloze = payload.front.includes('{{c1::') || payload.back.includes('{{c1::');
    const qIdx = state.reviewQueue.findIndex((c) => c.id === payload.cardId);
    const updatedQueue = [...state.reviewQueue];
    if (qIdx >= 0) {
      const cur = updatedQueue[qIdx];
      updatedQueue[qIdx] = {
        ...cur,
        deckId: payload.deckId,
        deckName: payload.deckName,
        front: payload.front,
        meaning: payload.back,
        frontHtml: payload.front,
        backHtml: payload.back,
        tags: payload.tags,
        isCloze,
        fields: payload.fields ? { ...cur.fields, ...payload.fields } : cur.fields,
      };
    }

    const updatedLib = state.libraryCards.map((c) =>
      c.id === payload.cardId
        ? {
            ...c,
            deckId: payload.deckId,
            deckName: payload.deckName,
            front: payload.front,
            back: payload.back,
            frontHtml: payload.front,
            backHtml: payload.back,
            tags: payload.tags,
            fields: payload.fields ? { ...c.fields, ...payload.fields } : c.fields,
          }
        : c
    );

    const updatedCmdK = state.cmdKResults.map((c) =>
      c.id === payload.cardId
        ? {
            ...c,
            deckId: payload.deckId,
            deckName: payload.deckName,
            front: payload.front,
            back: payload.back,
            tags: payload.tags,
          }
        : c
    );

    setAppState({
      reviewQueue: updatedQueue,
      libraryCards: updatedLib,
      cmdKResults: updatedCmdK,
      quickAddOpen: false,
      editingCardData: null,
    });

    if (isAnkiNativeEnv()) {
      try {
        await callAnki('update_card_inline', {
          cardId: payload.cardId,
          noteId: payload.noteId,
          deckId: payload.deckId,
          deckName: payload.deckName,
          front: payload.front,
          meaning: payload.back,
          tags: payload.tags,
          fields: payload.fields,
        });
        await appActions.initFromAnki(false);
      } catch {}
    }

    showToast(tState('autoSaved'));
  },

  async quickAddCard(payload: {
    deckId: string;
    deckName: string;
    front: string;
    back: string;
    tags: string[];
    modelId?: string;
    createReverseCard?: boolean;
    fields?: Record<string, string>;
  }) {
    let createdCardId = `card-${Date.now()}`;
    let createdNoteId = `note-${Date.now()}`;
    const targetDeckName = payload.deckName || state.decks[0]?.name || 'Default';
    const targetDeckId = payload.deckId || state.decks[0]?.id || '1';

    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{ cardId: string; noteId: string; deckId: string; createdCount?: number }>('quick_add', {
          ...payload,
          deckId: targetDeckId,
          deckName: targetDeckName,
        });
        if (res?.cardId) createdCardId = res.cardId;
        if (res?.noteId) createdNoteId = res.noteId;
        await appActions.initFromAnki(false);
        showToast(tState('addToDeckBtn', { deck: targetDeckName }));
        return;
      } catch {}
    }

    const isCloze = payload.front.includes('{{c1::') || payload.back.includes('{{c1::');
    const effectiveTags = payload.tags;
    const newLibCard: LibraryCardItem = {
      id: createdCardId,
      noteId: createdNoteId,
      deckId: targetDeckId,
      deckName: targetDeckName,
      front: payload.front,
      back: payload.back || (isCloze ? payload.front : ''),
      frontHtml: payload.front,
      backHtml: payload.back || payload.front,
      fields: payload.fields || (isCloze
        ? { Text: payload.front, 'Back Extra': payload.back }
        : { 正面: payload.front, 释义: payload.back }),
      tags: effectiveTags,
      mastery: 0,
      stability: 0,
      difficultyLevel: 'medium',
      dueText: tState('statusNew'),
      status: 'new',
      suspended: false,
      flags: 0,
      reps: 0,
      lapses: 0,
      intervalDays: 0,
    };

    const cardsToPrepend: LibraryCardItem[] = [newLibCard];
    if (payload.createReverseCard && !isCloze && payload.back.trim()) {
      cardsToPrepend.push({
        ...newLibCard,
        id: `${createdCardId}-rev`,
        noteId: `${createdNoteId}-rev`,
        front: payload.back,
        back: payload.front,
        frontHtml: payload.back,
        backHtml: payload.front,
        fields: { 正面: payload.back, 释义: payload.front },
      });
    }

    setAppState((prev) => ({
      libraryCards: [...cardsToPrepend, ...prev.libraryCards],
      libraryTotalCount: prev.libraryTotalCount + cardsToPrepend.length,
      libraryFilteredCount: prev.libraryFilteredCount + cardsToPrepend.length,
      cmdKResults: [...cardsToPrepend, ...prev.cmdKResults],
    }));

    showToast(tState('addToDeckBtn', { deck: targetDeckName }));
  },

  toggleCardSelection(cardId: string) {
    setAppState((prev) => {
      const exists = prev.selectedCardIds.includes(cardId);
      return {
        selectedCardIds: exists
          ? prev.selectedCardIds.filter((id) => id !== cardId)
          : [...prev.selectedCardIds, cardId],
      };
    });
  },

  setLibrarySelectionMode(enabled: boolean) {
    setAppState({
      librarySelectionMode: enabled,
      selectedCardIds: enabled ? state.selectedCardIds : [],
    });
  },

  clearCardSelection() {
    setAppState({ selectedCardIds: [] });
  },

  async executeBatchAction(
    actionType:
      | 'suspend'
      | 'unsuspend'
      | 'bury'
      | 'unbury'
      | 'setFlag'
      | 'addTag'
      | 'removeTag'
      | 'findReplace'
      | 'resetProgress'
      | 'moveDeck'
      | 'delete',
    payload?: {
      tag?: string;
      targetDeckId?: string;
      targetDeckName?: string;
      flag?: CardFlagColor;
      findText?: string;
      replaceText?: string;
      fieldScope?: 'all' | 'front' | 'back';
      ignoreCase?: boolean;
    }
  ) {
    const ids = state.selectedCardIds;
    if (ids.length === 0) return;

    if (isAnkiNativeEnv()) {
      try {
        await callAnki('batch_action', {
          actionType,
          cardIds: ids,
          tag: payload?.tag,
          targetDeckId: payload?.targetDeckId,
          targetDeckName: payload?.targetDeckName,
          flag: payload?.flag,
          findText: payload?.findText,
          replaceText: payload?.replaceText,
          fieldScope: payload?.fieldScope,
          ignoreCase: payload?.ignoreCase,
        });
      } catch {}
    }

    if (actionType === 'suspend' || actionType === 'unsuspend') {
      const shouldSuspend = actionType === 'suspend';
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                suspended: shouldSuspend,
                status: (shouldSuspend ? 'suspended' : 'due') as LibraryCardItem['status'],
                dueText: shouldSuspend ? tState('statusSuspended') : tState('statusDue'),
              }
            : c
        ),
      }));
      showToast(`${shouldSuspend ? tState('batchSuspend') : tState('batchUnsuspend')} (${ids.length})`);
    } else if (actionType === 'bury' || actionType === 'unbury') {
      const shouldBury = actionType === 'bury';
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                buried: shouldBury,
                status: (shouldBury ? 'buried' : 'due') as LibraryCardItem['status'],
                dueText: shouldBury ? tState('statusBuried') : tState('statusDue'),
              }
            : c
        ),
      }));
      showToast(`${shouldBury ? tState('batchBury') : tState('batchUnbury')} (${ids.length})`);
    } else if (actionType === 'setFlag') {
      const nextFlag = (payload?.flag ?? 0) as CardFlagColor;
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) =>
          ids.includes(c.id) ? { ...c, flags: nextFlag } : c
        ),
      }));
      showToast(
        nextFlag === 0
          ? `${tState('flagNone')} (${ids.length})`
          : `${tState(`flagLabel_${nextFlag}` as any)} (${ids.length})`
      );
    } else if (actionType === 'delete') {
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.filter((c) => !ids.includes(c.id)),
        libraryTotalCount: Math.max(0, prev.libraryTotalCount - ids.length),
        libraryFilteredCount: Math.max(0, prev.libraryFilteredCount - ids.length),
        selectedCardIds: [],
      }));
      showToast(`${tState('batchDelete')} (${ids.length})`);
    } else if (actionType === 'addTag') {
      const rawTag = (payload?.tag || '').trim();
      if (!rawTag) return;
      const newTags = rawTag.split(/[\s,，]+/).filter(Boolean);
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) => {
          if (!ids.includes(c.id)) return c;
          const merged = Array.from(new Set([...c.tags, ...newTags]));
          return { ...c, tags: merged };
        }),
      }));
      showToast(`${tState('batchAddTag')} (${ids.length})`);
    } else if (actionType === 'removeTag') {
      const rawTag = (payload?.tag || '').trim();
      if (!rawTag) return;
      const removeSet = new Set(
        rawTag
          .split(/[\s,，]+/)
          .map((t) => t.replace(/^#+/, '').toLowerCase())
          .filter(Boolean)
      );
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) => {
          if (!ids.includes(c.id)) return c;
          const nextTags = c.tags.filter((t) => !removeSet.has(t.toLowerCase()));
          return { ...c, tags: nextTags };
        }),
      }));
      showToast(`${tState('tagsLabel')} (${ids.length})`);
    } else if (actionType === 'findReplace') {
      const findText = payload?.findText ?? '';
      const replaceText = payload?.replaceText ?? '';
      const fieldScope = payload?.fieldScope || 'all';
      const ignoreCase = Boolean(payload?.ignoreCase);
      if (!findText) return;

      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapeRegExp(findText), ignoreCase ? 'gi' : 'g');
      let replacedCardCount = 0;

      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) => {
          if (!ids.includes(c.id)) return c;
          let changed = false;
          let nextFront = c.front;
          let nextBack = c.back;
          let nextFrontHtml = c.frontHtml || c.front;
          let nextBackHtml = c.backHtml || c.back;

          if (fieldScope === 'all' || fieldScope === 'front') {
            if (regex.test(nextFront) || regex.test(nextFrontHtml)) {
              nextFront = nextFront.replace(regex, replaceText);
              nextFrontHtml = nextFrontHtml.replace(regex, replaceText);
              changed = true;
            }
          }
          if (fieldScope === 'all' || fieldScope === 'back') {
            if (regex.test(nextBack) || regex.test(nextBackHtml)) {
              nextBack = nextBack.replace(regex, replaceText);
              nextBackHtml = nextBackHtml.replace(regex, replaceText);
              changed = true;
            }
          }
          if (changed) replacedCardCount++;
          return changed
            ? {
                ...c,
                front: nextFront,
                back: nextBack,
                frontHtml: nextFrontHtml,
                backHtml: nextBackHtml,
              }
            : c;
        }),
      }));

      showToast(`${tState('autoSaved')} (${replacedCardCount || ids.length})`);
    } else if (actionType === 'resetProgress') {
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) =>
          ids.includes(c.id)
            ? { ...c, mastery: 0, reps: 0, dueText: tState('statusNew'), status: 'new' }
            : c
        ),
      }));
      showToast(`${tState('batchResetProgress')} (${ids.length})`);
    } else if (actionType === 'moveDeck') {
      const targetDeck = state.decks.find(
        (d) => d.id === payload?.targetDeckId || d.name === payload?.targetDeckName
      );
      const targetDeckId = targetDeck?.id || payload?.targetDeckId || state.decks[0]?.id || '1';
      const targetDeckName =
        targetDeck?.name || payload?.targetDeckName || state.decks[0]?.name || 'Default';

      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                deckId: targetDeckId,
                deckName: targetDeckName,
                fullDeckName: targetDeck?.fullName || targetDeckName,
              }
            : c
        ),
      }));
      showToast(`${tState('batchMoveDeck')}: ${targetDeckName}`);
    }

    if (isAnkiNativeEnv()) {
      await appActions.initFromAnki(true);
    }
  },

  async triggerNativeEscape() {
    setAppState({ settingsOpen: false });
    if (isAnkiNativeEnv()) {
      await callAnki('toggle_native_ui');
    } else {
      showToast(tState('switchToNative'));
    }
  },

  setTheme(theme: ThemeMode) {
    appActions.updatePreferences({ theme });
  },

  setAccentColor(accentColor: AccentColor) {
    appActions.updatePreferences({ accentColor });
  },

  setLanguage(language: LanguageOption) {
    appActions.updatePreferences({ language });
  },

  moveWindow(dx: number, dy: number) {
    if (isAnkiNativeEnv()) {
      callAnki('move_window', { dx, dy }).catch(() => {});
    }
  },

  startSystemMove() {
    if (isAnkiNativeEnv()) {
      callAnki('start_system_move', {}).catch(() => {});
    }
  },

  toggleMaximize() {
    if (isAnkiNativeEnv()) {
      callAnki('toggle_maximize', {}).catch(() => {});
    }
  },
};

export function useAppStore(): AppState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getAppState,
    getAppState
  );
}
