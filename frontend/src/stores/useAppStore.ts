// ============================================================================
// Anki Modern OS — Global State Store (100% Real Anki Collection Driven)
// Implements all 14 audit bug fixes, 9 UX enhancements (semantic sync timestamp,
// SettingsModal, developer-only DesignSystemView, etc.), dynamic daily workload,
// Deck Options & FSRS Presets, 7-Color Flags, Custom Study / Mistake Drills,
// i18n language & OS platform adaptation, and two-way Anki lifecycle listeners.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  AdvancedStatsData,
  ANKI_FLAG_PALETTE,
  callAnki,
  CardFlagColor,
  CustomStudyParams,
  DashboardData,
  DeckItem,
  DeckOptionsData,
  EnvInfo,
  isAnkiNativeEnv,
  LibraryCardItem,
  RescueReceipt,
  ReviewCardItem,
} from '../bridge/pycmd';

export type {
  CardFlagColor,
  CustomStudyParams,
  DeckOptionsData,
  LibraryCardItem,
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
  envInfo: EnvInfo;

  // Dashboard, Decks & Statistics
  dashboard: DashboardData;
  decks: DeckItem[];
  advancedStats: AdvancedStatsData;
  showAllDashboardDecks: boolean;
  collapsedDeckIds: string[];

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
  cmdKSearching: boolean;

  // Card Library & Faceted Filters + Backend Pagination
  libraryCards: LibraryCardItem[];
  libraryTotalCount: number;
  libraryFilteredCount: number;
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
  selectedCardIds: string[];

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
  lastSyncedText: initialLang === 'zh-CN' ? '正在连接同步...' : 'Checking sync...',

  theme: 'light',
  accentColor: 'indigo',
  languagePref: 'auto',
  resolvedLang: initialLang,
  customNickname: '',
  showShortcutHints: false,
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
  lastSavedTimestamp: initialLang === 'zh-CN' ? '已自动保存' : 'Auto-saved',

  cmdKQuery: '',
  cmdKSelectedIndex: 0,
  cmdKResults: [],
  cmdKSearching: false,

  libraryCards: [],
  libraryTotalCount: 0,
  libraryFilteredCount: 0,
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
  selectedCardIds: [],

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

let libraryDebounceTimer: any = null;
let cmdKDebounceTimer: any = null;

const LIBRARY_PAGE_SIZE = 200;

// Track cold-start synchronization to protect against premature interruption
let coldStartInProgress = false;
let coldStartStartTs = 0;

// ---- Actions ----

export const appActions = {
  async initFromAnki(silent = false) {
    if (!isAnkiNativeEnv()) {
      setAppState({ isLoading: false, isInitialSyncing: false });
      return;
    }

    // If cold start sync is currently in progress, do not let background updates cancel it prematurely
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
          filteredCount: number;
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
          offset: 0,
          limit: LIBRARY_PAGE_SIZE,
        }),
        new Promise((resolve) => {
          const elapsed = Date.now() - startTs;
          const remaining = Math.max(0, MIN_INITIAL_SYNC_ANIMATION_MS - elapsed);
          setTimeout(resolve, remaining);
        }),
      ]);

      // A timed-out / malformed dashboard must never be merged into the state tree:
      // {} is truthy and would strip todayStats, streak, heatmap and weeklyRhythm,
      // crashing every downstream consumer.
      const dashValid = Boolean(dash && dash.todayStats && Array.isArray(dash.decks));
      const realDecks = dash?.decks || [];
      const realCards = searchRes?.cards || [];
      const prefs = dash?.preferences;
      const effectiveLang = resolveLanguage(
        prefs?.language || state.languagePref,
        dash?.language
      );

      coldStartInProgress = false;

      const genuineSyncTs = dash?.syncedAt !== undefined ? dash.syncedAt : (state.lastSyncedTimestamp || 0);

      setAppState({
        isLoading: false,
        isInitialSyncing: false,
        syncJustFinished: false,
        decks: realDecks,
        activeDeckId: state.activeDeckId || realDecks[0]?.id || null,
        advancedStats: dash?.advancedStats || EMPTY_ADVANCED_STATS,
        theme: prefs?.theme || state.theme,
        accentColor: prefs?.accentColor || state.accentColor,
        languagePref: prefs?.language || state.languagePref,
        resolvedLang: effectiveLang,
        customNickname: prefs?.customNickname ?? state.customNickname,
        collapsedDeckIds: prefs?.collapsedDeckIds || state.collapsedDeckIds,
        showShortcutHints: prefs?.showShortcutHints !== undefined ? prefs.showShortcutHints : state.showShortcutHints,
        debugModeUnlocked: Boolean(prefs?.debugMode) || state.debugModeUnlocked,
        envInfo: dash?.envInfo || state.envInfo,
        lastSyncedTimestamp: genuineSyncTs,
        lastSyncedText: genuineSyncTs > 0
          ? formatRelativeSyncLabel(genuineSyncTs, effectiveLang)
          : (effectiveLang === 'zh-CN' ? '尚未同步' : 'Not synced'),
        dashboard: dashValid
          ? {
              ...dash!,
              synced: genuineSyncTs > 0,
              syncedAt: genuineSyncTs,
              decks: realDecks,
            }
          : EMPTY_DASHBOARD,
        libraryCards: realCards,
        libraryTotalCount: searchRes?.total ?? realCards.length,
        libraryFilteredCount: searchRes?.filteredCount ?? realCards.length,
        libraryHasMoreFromBackend: Boolean(searchRes?.hasMore),
        libraryAllTags: searchRes?.allTags || [],
        cmdKResults: state.cmdKQuery.trim() ? state.cmdKResults : [],
      });

      // If user was actively reviewing cards and collection updated in native Anki:
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

      // Crash recovery happens automatically on the Python side. Surface it once
      // so the user knows an interrupted bulk operation was reconciled.
      const safetyWarning = dash?.safetyWarning;
      if (safetyWarning) {
        const recovered = safetyWarning.state === 'recovered';
        const isZh = state.resolvedLang === 'zh-CN';
        showToast(
          isZh
            ? recovered
              ? `检测到上次批量操作曾中断，已自动恢复 ${safetyWarning.restored} 张卡片`
              : '检测到上次批量操作异常中断，请检查卡片排期'
            : recovered
            ? `Recovered ${safetyWarning.restored} cards after an interrupted operation`
            : 'An interrupted bulk operation needs a manual review'
        );
      }
    } catch {
      coldStartInProgress = false;
      setAppState({ isLoading: false, isInitialSyncing: false, syncJustFinished: false });
    }
  },

  async refreshDashboard(silent = true) {
    return this.initFromAnki(silent);
  },

  /**
   * Persist user preferences to Anki Add-on Config (`config.json` / `mw.addonManager.writeConfig`)
   */
  async updatePreferences(patch: {
    theme?: ThemeMode;
    accentColor?: AccentColor;
    language?: LanguageOption;
    customNickname?: string;
    collapsedDeckIds?: string[];
    showShortcutHints?: boolean;
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

  /**
   * Debounced backend search for Card Library with offset/limit pagination (#8 & #14)
   */
  searchLibraryDebounced(overrides?: {
    query?: string;
    status?: 'all' | 'due' | 'new' | 'suspended' | 'review' | 'buried' | 'completed';
    difficulty?: 'all' | 'high' | 'medium' | 'low';
    flag?: FlagFilterValue;
    tag?: string;
    deckId?: string;
  }) {
    const nextQuery = overrides?.query !== undefined ? overrides.query : state.librarySearchQuery;
    const nextStatus = overrides?.status !== undefined ? overrides.status : state.filterStatus;
    const nextDifficulty =
      overrides?.difficulty !== undefined ? overrides.difficulty : state.filterDifficulty;
    const nextFlag = overrides?.flag !== undefined ? overrides.flag : state.filterFlag;
    const nextTag = overrides?.tag !== undefined ? overrides.tag : state.filterTag;
    const nextDeckId = overrides?.deckId !== undefined ? overrides.deckId : state.filterDeckId;

    setAppState({
      librarySearchQuery: nextQuery,
      filterStatus: nextStatus,
      filterDifficulty: nextDifficulty,
      filterFlag: nextFlag,
      filterTag: nextTag,
      filterDeckId: nextDeckId,
      libraryVisibleCount: 24,
    });

    if (!isAnkiNativeEnv()) return;

    if (libraryDebounceTimer) clearTimeout(libraryDebounceTimer);
    setAppState({ librarySearching: true });

    libraryDebounceTimer = setTimeout(async () => {
      try {
        const res = await callAnki<{
          total: number;
          filteredCount: number;
          hasMore: boolean;
          cards: LibraryCardItem[];
          allTags: string[];
        }>('search_cards', {
          query: nextQuery,
          status: nextStatus,
          difficulty: nextDifficulty,
          flag: nextFlag,
          tag: nextTag,
          deckId: nextDeckId,
          offset: 0,
          limit: LIBRARY_PAGE_SIZE,
        });
        if (res && Array.isArray(res.cards)) {
          setAppState({
            libraryCards: res.cards,
            libraryTotalCount: res.total ?? res.cards.length,
            libraryFilteredCount: res.filteredCount ?? res.cards.length,
            libraryHasMoreFromBackend: Boolean(res.hasMore),
            libraryAllTags: res.allTags || state.libraryAllTags,
            librarySearching: false,
          });
        } else {
          setAppState({ librarySearching: false });
        }
      } catch {
        setAppState({ librarySearching: false });
      }
    }, 200);
  },

  /**
   * Bug #14 Fix: Loads next page of cards from backend when user clicks "Load More"
   */
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
        }>('search_cards', {
          query: state.librarySearchQuery,
          status: state.filterStatus,
          difficulty: state.filterDifficulty,
          flag: state.filterFlag,
          tag: state.filterTag,
          deckId: state.filterDeckId,
          offset: state.libraryCards.length,
          limit: LIBRARY_PAGE_SIZE,
        });
        if (res && Array.isArray(res.cards)) {
          const existingIds = new Set(state.libraryCards.map((c) => c.id));
          const appended = res.cards.filter((c) => !existingIds.has(c.id));
          setAppState((prev) => ({
            libraryCards: [...prev.libraryCards, ...appended],
            libraryFilteredCount: res.filteredCount ?? prev.libraryFilteredCount,
            libraryHasMoreFromBackend: Boolean(res.hasMore),
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
        }>('search_cards', {
          query: query.trim(),
          status: 'all',
          difficulty: 'all',
          flag: 'all',
          tag: 'all',
          deckId: 'all',
          offset: 0,
          limit: 200,
        });
        if (res && Array.isArray(res.cards)) {
          setAppState({ cmdKResults: res.cards, cmdKSearching: false });
        } else {
          setAppState({ cmdKSearching: false });
        }
      } catch {
        setAppState({ cmdKSearching: false });
      }
    }, 180);
  },

  async syncCollection() {
    if (state.syncing) return;
    const isZh = state.resolvedLang === 'zh-CN';
    setAppState({ syncing: true, lastSyncedText: isZh ? '正在同步...' : 'Syncing...' });

    const startTime = Date.now();
    const MIN_SYNC_VISUAL_MS = 2200; // Guaranteed at least 2.2s of buttery-smooth animation

    try {
      // 1. Trigger native Anki sync asynchronously
      let syncPromise: Promise<any> = Promise.resolve({ synced: true });
      if (isAnkiNativeEnv()) {
        // Do not swallow rejection here: the outer catch must be reachable.
        syncPromise = callAnki<{ synced?: boolean; triggeredNativeSync?: boolean }>('sync');
      }

      // 2. Wait for at least MIN_SYNC_VISUAL_MS without blocking the main rendering thread
      const [syncRes] = await Promise.all([
        syncPromise,
        new Promise((resolve) => setTimeout(resolve, MIN_SYNC_VISUAL_MS)),
      ]);
      if (syncRes && syncRes.synced === false) {
        throw new Error(isZh ? '未能触发 AnkiWeb 同步' : 'Failed to trigger AnkiWeb sync');
      }

      const nowTs = Date.now();
      setAppState({
        syncing: false,
        syncJustFinished: true,
        lastSyncedTimestamp: nowTs,
        lastSyncedText: isZh ? '已同步 (刚刚)' : 'Synced (Just now)',
        dashboard: { ...state.dashboard, synced: true, syncedAt: nowTs },
      });

      setTimeout(() => {
        setAppState({ syncJustFinished: false });
      }, 2500);

      // 3. Defer silent collection reload after animation finishes so SQLite query doesn't cause UI stutter
      setTimeout(() => {
        if (isAnkiNativeEnv()) {
          appActions.initFromAnki(true);
        }
      }, 300);
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_SYNC_VISUAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SYNC_VISUAL_MS - elapsed));
      }
      // Keep the previous timestamp: a failed sync must never look like "Synced".
      setAppState({
        syncing: false,
        syncJustFinished: false,
        lastSyncedText: isZh ? '同步失败' : 'Sync failed',
      });
      showToast(`${err?.message || (isZh ? '同步失败，请检查网络或登录' : 'Sync error')}`);
    }
  },

  openSettings(
    tab: 'appearance' | 'shortcuts' | 'sync' | 'maintenance' | 'native' | 'about' = 'appearance'
  ) {
    setAppState({ settingsOpen: true, settingsInitialTab: tab });
  },

  async triggerNativeImport() {
    const isZh = state.resolvedLang === 'zh-CN';
    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{ success: boolean; message?: string }>('trigger_native_import', {});
        showToast(
          res?.message ||
            (isZh
              ? '已唤起 Anki 原生导入向导（支持 .apkg / .colpkg / 文本卡片包）'
              : 'Opened native Anki Import dialog (.apkg / .colpkg)')
        );
        return res;
      } catch (err: any) {
        showToast(err?.message || (isZh ? '唤起导入向导失败' : 'Failed to open Import dialog'));
      }
    } else {
      showToast(
        isZh
          ? '已发送导入指令（在 Anki 客户端中将打开 .apkg / .colpkg 文件导入向导）'
          : 'Triggered native Anki Import (.apkg / .colpkg)'
      );
    }
  },

  async triggerNativeExport() {
    const isZh = state.resolvedLang === 'zh-CN';
    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{ success: boolean; message?: string }>('trigger_native_export', {});
        showToast(
          res?.message ||
            (isZh
              ? '已唤起 Anki 原生导出向导（支持导出 .apkg 牌组包或 .colpkg 集合备份）'
              : 'Opened native Anki Export dialog (.apkg / .colpkg)')
        );
        return res;
      } catch (err: any) {
        showToast(err?.message || (isZh ? '唤起导出向导失败' : 'Failed to open Export dialog'));
      }
    } else {
      showToast(
        isZh
          ? '已发送导出指令（在 Anki 客户端中将打开 .apkg / .colpkg 导出向导）'
          : 'Triggered native Anki Export (.apkg / .colpkg)'
      );
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
    const isZh = state.resolvedLang === 'zh-CN';
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
        showToast(err?.message || (isZh ? '执行维护操作失败' : 'Maintenance action failed'));
        return { success: false, toolType, error: String(err) };
      }
    }

    // Offline / Browser preview fallback
    if (toolType === 'check_db') {
      const msg = isZh
        ? `数据库完整性校验通过（OK）：共 ${state.libraryTotalCount} 张卡片，索引已优化`
        : `Database check passed (ok): ${state.libraryTotalCount} cards optimized.`;
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
      const msg = isZh
        ? '扫描完成：当前集合没有空白卡片或失效挖空卡'
        : 'No empty cards found.';
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
      const msg = isZh
        ? '媒体库扫描完成：未发现冗余或缺失的媒体文件'
        : 'Media check complete: 0 unused, 0 missing.';
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
    const isZh = state.resolvedLang === 'zh-CN';
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
          showToast(
            isZh
              ? '当前条件下没有匹配的特训卡片，请尝试放宽筛选范围'
              : 'No cards matched the selected criteria'
          );
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

        const presetTitle = isZh
          ? {
              mistakes: '错题重练',
              flagged: '旗标/标签专练',
              ahead: '提前复习',
              extra_new: '新卡加练',
              custom: '自定义特训',
            }[params.preset]
          : 'Custom Study';

        showToast(
          isZh
            ? `已开启「${presetTitle}」：共抽取 ${res.cards.length} 张卡片`
            : `Started ${presetTitle}: ${res.cards.length} cards`
        );
        return { success: true, count: res.cards.length };
      }

      // Offline / browser preview fallback
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
        showToast(isZh ? '当前条件下暂无匹配卡片' : 'No matching cards found');
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
      showToast(err?.message || (isZh ? '开启特训失败' : 'Custom study failed'));
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
    const isZh = state.resolvedLang === 'zh-CN';
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
          showToast(res.error || (isZh ? '保存牌组设置失败' : 'Failed to save deck options'));
          return res;
        }
        await appActions.initFromAnki(true);
      } catch (err: any) {
        showToast(err?.message || (isZh ? '保存牌组设置失败' : 'Failed to save deck options'));
        return { saved: false };
      }
    }

    showToast(
      isZh
        ? `已保存牌组调度预设（新卡 ${optimisticOptions.newPerDay}/天 · FSRS 留存率 ${Math.round(optimisticOptions.desiredRetention * 100)}%）`
        : `Saved deck options (New ${optimisticOptions.newPerDay}/d · FSRS ${Math.round(optimisticOptions.desiredRetention * 100)}%)`
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
        showToast(res?.message || '设置休假失败');
        return res;
      }
      await appActions.refreshDashboard(false);
      setAppState({ vacationModalOpen: false, isLoading: false });
      // Trigger cloud sync to update vacation state on AnkiWeb
      appActions.syncCollection();
      showToast(
        state.resolvedLang === 'zh-CN'
          ? `已开启休假保护（${params.days} 天）`
          : `Vacation Mode active for ${params.days} days.`
      );
      return res;
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || '设置休假失败');
    }
  },

  async endVacation() {
    setAppState({ isLoading: true });
    try {
      const res = await callAnki<{ success: boolean; message?: string }>('end_vacation', {});
      await appActions.refreshDashboard(false);
      setAppState({ isLoading: false, vacationModalOpen: false });
      appActions.syncCollection();
      showToast(
        res?.message ||
          (state.resolvedLang === 'zh-CN'
            ? '已结束休假保护，欢迎归来'
            : 'Vacation ended. Welcome back!')
      );
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || '结束休假失败');
    }
  },

  async cancelVacation() {
    setAppState({ isLoading: true });
    try {
      const res = await callAnki<{ success: boolean; message?: string }>('cancel_vacation', {});
      await appActions.refreshDashboard(false);
      setAppState({ isLoading: false, vacationModalOpen: false });
      appActions.syncCollection();
      showToast(
        res?.message ||
          (state.resolvedLang === 'zh-CN'
            ? '已撤销本次休假，卡片队列与限额已恢复'
            : 'Vacation cancelled.')
      );
      return res;
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || '撤销休假失败');
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
        const msg = res?.error || res?.message || '进度减负操作失败';
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

      // Automatically push rescheduled changes to AnkiWeb so mobile/tablet match instantly
      appActions.syncCollection();

      showToast(res?.message || (state.resolvedLang === 'zh-CN' ? '进度减负已完成' : 'Backlog reschedule completed'));
      return res || { success: true, message: '进度减负已完成' };
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || '进度减负操作失败');
      return { success: false, message: String(err) };
    }
  },

  async undoRescue() {
    setAppState({ isLoading: true });
    try {
      const res = await callAnki<{ success: boolean; message: string; count?: number; receipt?: RescueReceipt }>('undo_rescue', {});
      if (res?.success !== true) {
        setAppState({ isLoading: false });
        showToast(res?.message || '撤销减负失败');
        return { success: false, message: res?.message || '撤销减负失败' };
      }
      const updatedReceipt = res?.receipt || (state.currentRescueReceipt ? { ...state.currentRescueReceipt, canUndo: false, status: 'undone' as const } : null);
      setAppState({
        isLoading: false,
        currentRescueReceipt: updatedReceipt,
        icuModalTab: 'history',
      });
      await appActions.initFromAnki(false);
      appActions.syncCollection();
      showToast(res?.message || (state.resolvedLang === 'zh-CN' ? '已撤销进度减负，卡片已恢复至原队列' : 'Reschedule undone'));
      return res;
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || '撤销减负失败');
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
        showToast(state.resolvedLang === 'zh-CN' ? '开启轻量复习失败' : 'Light session failed');
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
      showToast(
        state.resolvedLang === 'zh-CN'
          ? '已开启轻量复习：精选 15 张高熟练度卡片'
          : 'Light Session started: 15 high-stability cards'
      );
    } catch (err: any) {
      setAppState({ isLoading: false });
      showToast(err?.message || '开启轻量复习失败');
    }
  },

  setActiveTab(tab: NavTab) {
    setAppState({
      activeTab: tab,
      inReviewMode: false,
      isSessionComplete: false,
      inlineEditing: false,
      inspectorOpen: false,
    });
  },

  unlockAndOpenDesignSystem() {
    setAppState({
      debugModeUnlocked: true,
      activeTab: 'design-system',
      inReviewMode: false,
      settingsOpen: false,
    });
    showToast(
      state.resolvedLang === 'zh-CN'
        ? '已进入开发者专属：设计规范与 Token 调试视图'
        : 'Unlocked Developer Design System View'
    );
  },

  toggleDeckCollapse(deckId: string) {
    const exists = state.collapsedDeckIds.includes(deckId);
    const nextCollapsed = exists
      ? state.collapsedDeckIds.filter((id) => id !== deckId)
      : [...state.collapsedDeckIds, deckId];
    appActions.updatePreferences({ collapsedDeckIds: nextCollapsed });
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
        showToast(state.resolvedLang === 'zh-CN' ? `已创建牌组「${fullName}」` : `Created deck "${fullName}"`);
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
    showToast(state.resolvedLang === 'zh-CN' ? `已创建牌组「${fullName}」` : `Created deck "${fullName}"`);
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
        showToast(
          state.resolvedLang === 'zh-CN'
            ? `牌组已重命名为「${fullNewName}」`
            : `Renamed deck to "${fullNewName}"`
        );
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
    showToast(
      state.resolvedLang === 'zh-CN'
        ? `牌组已重命名为「${fullNewName}」`
        : `Renamed deck to "${fullNewName}"`
    );
  },

  async deleteDeck(deckId: string) {
    const target = state.decks.find((d) => d.id === deckId);
    if (!target) return;

    if (isAnkiNativeEnv() && /^\d+$/.test(deckId)) {
      try {
        await callAnki('delete_deck', { deckId });
        await appActions.initFromAnki(false);
        showToast(
          state.resolvedLang === 'zh-CN'
            ? `已删除牌组「${target.fullName}」`
            : `Deleted deck "${target.fullName}"`
        );
        return;
      } catch {}
    }

    setAppState((prev) => ({
      decks: prev.decks.filter(
        (d) => d.id !== deckId && !d.fullName.startsWith(`${target.fullName}::`)
      ),
    }));
    showToast(
      state.resolvedLang === 'zh-CN'
        ? `已删除牌组「${target.fullName}」`
        : `Deleted deck "${target.fullName}"`
    );
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
      lastReviewText: cardItem.lastReviewText || 'New card',
      suspended: cardItem.suspended,
      flags: cardItem.flags || 0,
      predictions: {
        again: state.resolvedLang === 'zh-CN' ? '10分钟后' : 'in 10m',
        hard: state.resolvedLang === 'zh-CN' ? '2天后' : 'in 2d',
        good: state.resolvedLang === 'zh-CN' ? '4天后' : 'in 4d',
        easy: state.resolvedLang === 'zh-CN' ? '9天后' : 'in 9d',
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
        again: state.resolvedLang === 'zh-CN' ? '10分钟后' : 'in 10m',
        hard: state.resolvedLang === 'zh-CN' ? '2天后' : 'in 2d',
        good: state.resolvedLang === 'zh-CN' ? '4天后' : 'in 4d',
        easy: state.resolvedLang === 'zh-CN' ? '9天后' : 'in 9d',
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
        showToast(state.resolvedLang === 'zh-CN' ? '当前卡片未包含音频附件' : 'No audio on this card');
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
      showToast(
        state.resolvedLang === 'zh-CN'
          ? `正在播放音频：${targetFile}`
          : `Playing audio: ${targetFile}`
      );
    }
    setTimeout(() => {
      setAppState({ playingAudioFile: null });
    }, 900);
  },

  revealNextHint() {
    setAppState((prev) => ({
      revealedHintsCount: prev.revealedHintsCount >= 3 ? 1 : prev.revealedHintsCount + 1,
    }));
  },

  async answerCurrentCard(ease: 1 | 2 | 3 | 4) {
    const currentCard = state.reviewQueue[state.currentCardIndex];
    if (!currentCard) return;

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

    if (isAnkiNativeEnv() && !isPreview && /^\d+$/.test(currentCard.id)) {
      callAnki('answer_card', {
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
      reviewQueue: nextQueue,
      decks: updatedDecks,
      currentCardIndex: isLastCard ? prev.currentCardIndex : prev.currentCardIndex + 1,
      isSessionComplete: isLastCard,
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

    const isZh = state.resolvedLang === 'zh-CN';
    const dynamicIvl =
      ease === 1
        ? currentCard.predictions.again
        : ease === 2
        ? currentCard.predictions.hard
        : ease === 3
        ? currentCard.predictions.good
        : currentCard.predictions.easy;

    const ratingName = isZh
      ? { 1: '遗忘 (Again)', 2: '困难 (Hard)', 3: '记得 (Good)', 4: '简单 (Easy)' }[ease]
      : { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }[ease];

    showToast(
      isZh
        ? `已评分：${ratingName} · ${dynamicIvl}`
        : `Rated: ${ratingName} · ${dynamicIvl}`
    );
  },

  async undoLastReview() {
    const isZh = state.resolvedLang === 'zh-CN';
    if (state.undoStack.length === 0) {
      if (isAnkiNativeEnv()) {
        try {
          const res = await callAnki<{ undone: boolean; label: string }>('undo');
          showToast(res?.label || (isZh ? '已执行原生撤销' : 'Undid last action'));
          await appActions.initFromAnki(false);
          return;
        } catch {}
      }
      showToast(isZh ? '当前没有可撤销的评分记录' : 'Nothing to undo');
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
    showToast(
      isZh
        ? `已毫秒级回滚至上一张卡片：「${last.card.front}」`
        : `Rolled back to "${last.card.front}"`
    );
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

    showToast(
      state.resolvedLang === 'zh-CN'
        ? `已从数据库永久删除卡片「${currentCard.front}」`
        : `Deleted card "${currentCard.front}"`
    );
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
            dueText: nextSuspended
              ? state.resolvedLang === 'zh-CN'
                ? '已暂停'
                : 'Suspended'
              : c.dueText,
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
      showToast(
        state.resolvedLang === 'zh-CN'
          ? `已暂停卡片「${currentCard.front}」（已移出学习队列）`
          : `Suspended "${currentCard.front}"`
      );
    } else {
      await appActions.saveInlineCardUpdate({ suspended: false });
      showToast(state.resolvedLang === 'zh-CN' ? '已取消暂停（已恢复卡片）' : 'Unsuspended card');
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
            dueText: state.resolvedLang === 'zh-CN' ? '已搁置' : 'Buried',
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
    showToast(
      state.resolvedLang === 'zh-CN'
        ? `已搁置卡片「${currentCard.front}」至明日`
        : `Buried "${currentCard.front}" until tomorrow`
    );
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

    const isZh = state.resolvedLang === 'zh-CN';
    if (nextFlag === 0) {
      showToast(isZh ? '已清除卡片旗标' : 'Cleared card flag');
    } else {
      const meta = ANKI_FLAG_PALETTE[nextFlag];
      showToast(
        isZh ? `已标记为「${meta.labelZh}」` : `Flagged: ${meta.labelEn}`
      );
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
      lastSavedTimestamp: state.resolvedLang === 'zh-CN' ? '刚刚已自动保存' : 'Saved just now',
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
    showToast(state.resolvedLang === 'zh-CN' ? '卡片修改已保存' : 'Card changes saved');
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
              showToast(
                state.resolvedLang === 'zh-CN'
                  ? `截图已存入媒体库：${res.filename}`
                  : `Saved image: ${res.filename}`
              );
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
    setAppState({
      quickAddOpen: true,
      editingCardData: null,
      activeDeckId: defaultDeckId || state.activeDeckId,
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
    let updatedQueue = [...state.reviewQueue];
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

    showToast(state.resolvedLang === 'zh-CN' ? '卡片修改已保存' : 'Card changes saved');
  },

  async quickAddCard(payload: { deckId: string; deckName: string; front: string; back: string; tags: string[] }) {
    let createdCardId = `card-${Date.now()}`;
    let createdNoteId = `note-${Date.now()}`;
    const targetDeckName = payload.deckName || state.decks[0]?.name || 'Default';
    const targetDeckId = payload.deckId || state.decks[0]?.id || '1';

    if (isAnkiNativeEnv()) {
      try {
        const res = await callAnki<{ cardId: string; noteId: string; deckId: string }>('quick_add', {
          ...payload,
          deckId: targetDeckId,
          deckName: targetDeckName,
        });
        if (res?.cardId) createdCardId = res.cardId;
        if (res?.noteId) createdNoteId = res.noteId;
        await appActions.initFromAnki(false);
        showToast(
          state.resolvedLang === 'zh-CN'
            ? `已添加到「${targetDeckName}」并加入今日学习队列`
            : `Added to "${targetDeckName}"`
        );
        return;
      } catch {}
    }

    const isCloze = payload.front.includes('{{c1::') || payload.back.includes('{{c1::');
    const newLibCard: LibraryCardItem = {
      id: createdCardId,
      noteId: createdNoteId,
      deckId: targetDeckId,
      deckName: targetDeckName,
      front: payload.front,
      back: payload.back || (isCloze ? payload.front : ''),
      frontHtml: payload.front,
      backHtml: payload.back || payload.front,
      fields: isCloze
        ? { Text: payload.front, 'Back Extra': payload.back }
        : { 正面: payload.front, 释义: payload.back },
      tags: payload.tags,
      mastery: 0,
      stability: 0,
      difficultyLevel: 'medium',
      dueText: state.resolvedLang === 'zh-CN' ? '新卡片' : 'New',
      status: 'new',
      suspended: false,
      flags: 0,
      reps: 0,
      intervalDays: 0,
    };

    setAppState((prev) => ({
      libraryCards: [newLibCard, ...prev.libraryCards],
      libraryTotalCount: prev.libraryTotalCount + 1,
      libraryFilteredCount: prev.libraryFilteredCount + 1,
      cmdKResults: [newLibCard, ...prev.cmdKResults],
    }));

    showToast(
      state.resolvedLang === 'zh-CN'
        ? `已添加到「${targetDeckName}」并加入今日学习队列`
        : `Added to "${targetDeckName}"`
    );
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
      | 'resetProgress'
      | 'moveDeck'
      | 'delete',
    payload?: {
      tag?: string;
      targetDeckId?: string;
      targetDeckName?: string;
      flag?: CardFlagColor;
    }
  ) {
    const ids = state.selectedCardIds;
    if (ids.length === 0) return;
    const isZh = state.resolvedLang === 'zh-CN';

    if (isAnkiNativeEnv()) {
      try {
        await callAnki('batch_action', {
          actionType,
          cardIds: ids,
          tag: payload?.tag,
          targetDeckId: payload?.targetDeckId,
          targetDeckName: payload?.targetDeckName,
          flag: payload?.flag,
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
                dueText: shouldSuspend ? (isZh ? '已暂停' : 'Suspended') : isZh ? '到期 今天' : 'Due Today',
              }
            : c
        ),
      }));
      showToast(
        isZh
          ? `已批量${shouldSuspend ? '暂停' : '取消暂停'} ${ids.length} 张卡片`
          : `${shouldSuspend ? 'Suspended' : 'Unsuspended'} ${ids.length} cards`
      );
    } else if (actionType === 'bury' || actionType === 'unbury') {
      const shouldBury = actionType === 'bury';
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                buried: shouldBury,
                status: (shouldBury ? 'buried' : 'due') as LibraryCardItem['status'],
                dueText: shouldBury ? (isZh ? '已搁置' : 'Buried') : isZh ? '到期 今天' : 'Due Today',
              }
            : c
        ),
      }));
      showToast(
        isZh
          ? `已批量${shouldBury ? '搁置至次日' : '取消搁置'} ${ids.length} 张卡片`
          : `${shouldBury ? 'Buried' : 'Unburied'} ${ids.length} cards`
      );
    } else if (actionType === 'setFlag') {
      const nextFlag = (payload?.flag ?? 0) as CardFlagColor;
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) =>
          ids.includes(c.id) ? { ...c, flags: nextFlag } : c
        ),
      }));
      if (nextFlag === 0) {
        showToast(
          isZh
            ? `已批量清除 ${ids.length} 张卡片的旗标`
            : `Cleared flags on ${ids.length} cards`
        );
      } else {
        const meta = ANKI_FLAG_PALETTE[nextFlag];
        showToast(
          isZh
            ? `已为 ${ids.length} 张卡片标记「${meta.shortZh}」`
            : `Flagged ${ids.length} cards as ${meta.shortEn}`
        );
      }
    } else if (actionType === 'delete') {
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.filter((c) => !ids.includes(c.id)),
        libraryTotalCount: Math.max(0, prev.libraryTotalCount - ids.length),
        libraryFilteredCount: Math.max(0, prev.libraryFilteredCount - ids.length),
        selectedCardIds: [],
      }));
      showToast(isZh ? `已批量删除 ${ids.length} 张卡片` : `Deleted ${ids.length} cards`);
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
      showToast(
        isZh
          ? `已为 ${ids.length} 张卡片添加标签：${newTags.map((t) => `#${t}`).join(' ')}`
          : `Added tags to ${ids.length} cards`
      );
    } else if (actionType === 'resetProgress') {
      setAppState((prev) => ({
        libraryCards: prev.libraryCards.map((c) =>
          ids.includes(c.id)
            ? { ...c, mastery: 0, reps: 0, dueText: isZh ? '新卡片' : 'New', status: 'new' }
            : c
        ),
      }));
      showToast(
        isZh ? `已重置 ${ids.length} 张卡片的 FSRS 调度进度` : `Reset FSRS progress for ${ids.length} cards`
      );
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
      showToast(
        isZh
          ? `已将 ${ids.length} 张卡片移动至牌组「${targetDeckName}」`
          : `Moved ${ids.length} cards to "${targetDeckName}"`
      );
    }
  },

  async triggerNativeEscape() {
    setAppState({ settingsOpen: false });
    if (isAnkiNativeEnv()) {
      await callAnki('toggle_native_ui');
    } else {
      showToast(
        state.resolvedLang === 'zh-CN'
          ? '已发送原生界面切换指令 (可通过顶部按钮或 Ctrl+Opt+M 随时返回)'
          : 'Switched to Native Anki UI (Press Ctrl+Opt+M or click top toolbar button to return)'
      );
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
