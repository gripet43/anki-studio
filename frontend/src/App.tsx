import React, { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { DashboardView } from './components/dashboard/DashboardView';
import { DecksView } from './components/decks/DecksView';
import { DesignSystemView } from './components/design-system/DesignSystemView';
import { Sidebar } from './components/layout/Sidebar';
import { QuickAddDrawer } from './components/quick-add/QuickAddDrawer';
import { ReviewerView } from './components/reviewer/ReviewerView';
import { CommandPaletteModal } from './components/search/CommandPaletteModal';
import { LibraryView } from './components/search/LibraryView';
import { SettingsModal } from './components/settings/SettingsModal';
import { StatsView } from './components/stats/StatsView';
import { CustomStudyModal } from './components/study/CustomStudyModal';
import { VacationModal } from './components/vacation/VacationModal';
import { IcuRescueModal } from './components/vacation/IcuRescueModal';
import { ZenHomeView } from './components/zen/ZenHomeView';
import { ZenReviewView } from './components/zen/ZenReviewView';
import { ZenThresholdOverlay } from './components/zen/ZenThresholdOverlay';
import { usePresence } from './hooks/usePresence';
import { ensureLanguageLoaded, isLanguageLoaded, isRtlLanguage, translate } from './i18n/translations';
import { appActions, getAppState, setAppState, showToast, useAppStore } from './stores/useAppStore';
import { isTypingTarget } from './utils/domTarget';
import { buildThemeCssVars, resolveThemeMode } from './utils/themeTokens';
import { isThemeViewTransitionActive } from './utils/viewTransition';
import { isZenBlockedGlobalShortcut } from './utils/zenMode';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const App: React.FC = () => {
  const {
    activeTab,
    profileGeneration,
    inReviewMode,
    zenMode,
    cmdKOpen,
    quickAddOpen,
    editingCardData,
    settingsOpen,
    vacationModalOpen,
    icuModalOpen,
    customStudyModalOpen,
    inlineEditing,
    theme,
    systemDark,
    accentColor,
    resolvedLang,
    toastMessage,
    dayBoundary,
  } = useAppStore();

  const resolvedTheme = resolveThemeMode(theme, systemDark);
  const themeVars = useMemo(
    () => buildThemeCssVars(accentColor, resolvedTheme),
    [accentColor, resolvedTheme]
  );
  const isRtl = isRtlLanguage(resolvedLang);

  // Cache last non-empty toast message so exit animation renders the departing text cleanly (E2)
  const lastToastTextRef = useRef<string>(toastMessage || '');
  if (toastMessage) {
    lastToastTextRef.current = toastMessage;
  }
  const toastPresence = usePresence(Boolean(toastMessage), 120, toastMessage || undefined);

  // 语言字典懒加载：中英已随首包常驻，其余 14 种在切到对应语言时才拉一个 chunk。
  // 加载完成后强制重渲染一次，让已经渲染出去的文案换成目标语言。
  const [, forceLanguageRender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let alive = true;
    if (!isLanguageLoaded(resolvedLang)) {
      void ensureLanguageLoaded(resolvedLang).then(() => {
        if (alive) forceLanguageRender();
      });
    }
    return () => {
      alive = false;
    };
  }, [resolvedLang]);

  // Smooth 260ms color/surface cross-fade fallback when View Transitions are unavailable.
  // Skips initial mount, ViewTransition-handled switches, and language/RTL changes.
  const themeMountedRef = useRef<boolean>(false);
  const themeSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!themeMountedRef.current) {
      themeMountedRef.current = true;
      return;
    }
    if (isThemeViewTransitionActive()) {
      return;
    }
    const rootEl = document.documentElement;
    rootEl.classList.add('theme-switching');
    if (themeSwitchTimerRef.current !== null) {
      clearTimeout(themeSwitchTimerRef.current);
    }
    themeSwitchTimerRef.current = setTimeout(() => {
      rootEl.classList.remove('theme-switching');
      themeSwitchTimerRef.current = null;
    }, 260);
    return () => {
      if (themeSwitchTimerRef.current !== null) {
        clearTimeout(themeSwitchTimerRef.current);
        themeSwitchTimerRef.current = null;
      }
    };
  }, [theme, resolvedTheme, accentColor]);

  // Synchronize CSS variables, color-scheme meta, theme class, and language/RTL direction onto document.documentElement
  // synchronously in layout phase so flushSync View Transitions capture updated tokens cleanly.
  useIsomorphicLayoutEffect(() => {
    const rootEl = document.documentElement;
    rootEl.classList.toggle('dark', resolvedTheme === 'dark');
    rootEl.classList.remove('oled');
    rootEl.dataset.themeMode = theme;
    rootEl.dataset.resolvedTheme = resolvedTheme;
    rootEl.dataset.accent = accentColor;
    rootEl.dir = isRtl ? 'rtl' : 'ltr';
    rootEl.lang = resolvedLang;
    const metaScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaScheme) {
      metaScheme.setAttribute('content', theme === 'auto' ? 'light dark' : resolvedTheme);
    }
    for (const [k, v] of Object.entries(themeVars)) {
      rootEl.style.setProperty(k, v);
    }
  }, [theme, resolvedTheme, accentColor, themeVars, isRtl, resolvedLang]);

  useEffect(() => {
    appActions.initFromAnki();

    const onCollectionUpdated = (e: Event) => {
      // Guard: do not interrupt cold start sync while in progress
      if (getAppState().isInitialSyncing) return;
      // Sync completion already runs a single coordinated refresh via handleNativeSyncFinished;
      // skip the paired duplicate `collection-updated` event emitted by `_on_sync_did_finish`.
      const detail = (e as CustomEvent)?.detail;
      if (detail?.source === 'sync') return;
      appActions.initFromAnki(true);
    };

    const onAnkiToast = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const msg = detail?.message;
      if (msg) {
        showToast(msg);
      }
    };

    const onSyncStarted = () => {
      const lang = getAppState().resolvedLang;
      setAppState({
        syncing: true,
        syncJustFinished: false,
        lastSyncedText: translate(lang, 'syncing'),
      });
    };

    const onSyncFinished = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      appActions.handleNativeSyncFinished(detail);
    };

    const onOpenSettings = () => {
      setAppState({ zenMode: false, settingsOpen: true });
    };

    const onDayChanged = (e: Event) => {
      if (getAppState().isInitialSyncing) return;
      const detail = (e as CustomEvent)?.detail;
      appActions.handleDayChanged(detail);
    };

    const onProfileChanged = () => {
      appActions.handleProfileChanged();
    };

    let lastWakeCheckMs = 0;
    const onWakeCheck = (source: string) => {
      if (getAppState().isInitialSyncing) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastWakeCheckMs < 3000) return;
      lastWakeCheckMs = now;
      appActions.checkDayRollover(source);
    };
    const onWindowFocus = () => onWakeCheck('window_focus');
    const onVisibilityChange = () => onWakeCheck('visibility');

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    const onSystemThemeChange = (e: MediaQueryListEvent) => {
      setAppState({ systemDark: e.matches });
    };
    if (mediaQuery) {
      setAppState({ systemDark: mediaQuery.matches });
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', onSystemThemeChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(onSystemThemeChange);
      }
    }

    window.addEventListener('anki:collection-updated', onCollectionUpdated);
    window.addEventListener('anki:profile-changed', onProfileChanged);
    window.addEventListener('anki:sync-started', onSyncStarted);
    window.addEventListener('anki:sync-finished', onSyncFinished);
    window.addEventListener('anki:toast', onAnkiToast);
    window.addEventListener('anki:open-settings', onOpenSettings);
    window.addEventListener('anki:day-changed', onDayChanged);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', onSystemThemeChange);
        } else if (typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(onSystemThemeChange);
        }
      }
      window.removeEventListener('anki:collection-updated', onCollectionUpdated);
      window.removeEventListener('anki:profile-changed', onProfileChanged);
      window.removeEventListener('anki:sync-started', onSyncStarted);
      window.removeEventListener('anki:sync-finished', onSyncFinished);
      window.removeEventListener('anki:toast', onAnkiToast);
      window.removeEventListener('anki:open-settings', onOpenSettings);
      window.removeEventListener('anki:day-changed', onDayChanged);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Precise browser-side cutoff timer aligned to Anki's `day_cutoff + 2s` with overdue backoff
  useEffect(() => {
    if (!dayBoundary?.available || !dayBoundary.dayCutoff || dayBoundary.dayCutoff <= 0) {
      return;
    }
    let cancelled = false;
    let timerId: number | null = null;
    let retryDelayMs = 2000;

    const arm = (delayMs: number) => {
      if (cancelled) return;
      const bounded = Math.min(2_147_000_000, Math.max(1000, delayMs));
      timerId = window.setTimeout(async () => {
        if (cancelled) return;
        await appActions.checkDayRollover('frontend_cutoff_timer');
        if (cancelled) return;
        const latest = getAppState().dayBoundary;
        if (
          latest?.available &&
          latest.dayCutoff === dayBoundary.dayCutoff &&
          Date.now() >= latest.dayCutoff * 1000
        ) {
          retryDelayMs = Math.min(retryDelayMs * 2, 60_000);
          arm(retryDelayMs);
        }
      }, bounded);
    };

    const initialDelay = Math.max(1000, dayBoundary.dayCutoff * 1000 + 2000 - Date.now());
    arm(initialDelay);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [dayBoundary?.available, dayBoundary?.dayCutoff, dayBoundary?.schedToday]);

  // Global keyboard shortcuts:
  // - Cmd+Shift+Z / Ctrl+Shift+Z: Toggle Minimalist Zen Mode
  // - Cmd+K / Ctrl+K: Search Palette (suppressed in Zen Mode)
  // - Cmd+\ / Ctrl+\: Collapse / Expand Left Navigation Sidebar (suppressed in Zen Mode / Reviewer)
  // - Ctrl+P / Cmd+, / Ctrl+,: Preferences & Settings Modal (suppressed in Zen Mode)
  // - N: Quick Add Drawer (suppressed in Zen Mode)
  // - Ctrl+Opt+M / Ctrl+Alt+M: Fail-safe Native UI Toggle (always active)
  // - Ctrl+Shift+D: Developer Design System View (suppressed in Zen Mode)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        appActions.triggerNativeEscape();
        return;
      }

      const typing = isTypingTarget(e.target);

      // Cmd/Ctrl + Shift + Z: Toggle Zen Mode (blocked while typing or inside modals/inline edit)
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        e.shiftKey &&
        e.key.toLowerCase() === 'z'
      ) {
        if (
          !typing &&
          !inlineEditing &&
          !cmdKOpen &&
          !quickAddOpen &&
          !editingCardData &&
          !settingsOpen &&
          !vacationModalOpen &&
          !icuModalOpen &&
          !customStudyModalOpen
        ) {
          e.preventDefault();
          appActions.toggleZenMode();
        }
        return;
      }

      if (
        zenMode &&
        isZenBlockedGlobalShortcut(e.key, {
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
        })
      ) {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
        }
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        appActions.unlockAndOpenDesignSystem();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAppState((prev) => ({ cmdKOpen: !prev.cmdKOpen }));
        return;
      }

      // Cmd/Ctrl + \: Toggle collapsible left navigation sidebar
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key === '\\' || e.code === 'Backslash')
      ) {
        if (
          !typing &&
          !zenMode &&
          !inReviewMode &&
          !inlineEditing &&
          !cmdKOpen &&
          !quickAddOpen &&
          !editingCardData &&
          !settingsOpen &&
          !vacationModalOpen &&
          !icuModalOpen &&
          !customStudyModalOpen
        ) {
          e.preventDefault();
          appActions.toggleSidebar();
        }
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key.toLowerCase() === 'p' || e.key === ',')
      ) {
        e.preventDefault();
        setAppState((prev) =>
          prev.settingsOpen
            ? { settingsOpen: false }
            : { settingsOpen: true, settingsInitialTab: 'appearance' }
        );
        return;
      }

      // N: Quick Add Drawer
      if (
        !typing &&
        !zenMode &&
        !inReviewMode &&
        !cmdKOpen &&
        !quickAddOpen &&
        !settingsOpen &&
        e.key.toLowerCase() === 'n'
      ) {
        e.preventDefault();
        setAppState({ quickAddOpen: true });
        return;
      }

      // Y: Anki Standard Manual Cloud Sync (also quietly supported on Zen Home)
      if (
        !typing &&
        !inReviewMode &&
        !cmdKOpen &&
        !quickAddOpen &&
        !settingsOpen &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'y'
      ) {
        e.preventDefault();
        appActions.syncCollection();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    zenMode,
    inReviewMode,
    inlineEditing,
    cmdKOpen,
    quickAddOpen,
    editingCardData,
    settingsOpen,
    vacationModalOpen,
    icuModalOpen,
    customStudyModalOpen,
  ]);

  const rootBg =
    resolvedTheme === 'dark'
      ? 'bg-[#131418] text-[#F2F3F7] dark'
      : 'bg-[var(--bg-canvas)] text-[#1D1D1F]';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      data-zen-mode={zenMode ? 'true' : undefined}
      style={themeVars as React.CSSProperties}
      className={`w-screen h-screen overflow-hidden flex font-sans antialiased ${rootBg}`}
    >
      {zenMode ? (
        <div
          key={`${profileGeneration}-zen-${inReviewMode ? 'review' : 'home'}`}
          className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative"
        >
          {inReviewMode ? <ZenReviewView /> : <ZenHomeView />}
          <ZenThresholdOverlay />
        </div>
      ) : (
        <>
          {/* Left Navigation Sidebar */}
          <Sidebar />

          {/* Main Workspace Area — Keyed inner wrapper for 160ms view enter animation (D) */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div
              key={`${profileGeneration}-${activeTab}`}
              className="ui-view-enter flex-1 flex flex-col min-w-0 h-full overflow-hidden"
            >
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'library' && <LibraryView />}
              {activeTab === 'decks' && <DecksView />}
              {activeTab === 'stats' && <StatsView />}
              {activeTab === 'design-system' && <DesignSystemView />}
            </div>
          </main>

          {/* Fullscreen Zen Reviewer & Inline WYSIWYG Editor */}
          {inReviewMode && <ReviewerView />}

          {/* Raycast-Style Global Search Modal (Cmd + K) */}
          <CommandPaletteModal />

          {/* Right Slide-Over Quick Add Drawer (Shortcut N) */}
          <QuickAddDrawer />

          {/* Unified Settings & 3-Layer Native Switch Guide Modal (Item #9) */}
          <SettingsModal />

          {/* Vacation Mode & Streak Freeze Modal */}
          <VacationModal />

          {/* ICU Backlog Crisis Rescue & Evidence Modal */}
          <IcuRescueModal />

          {/* Custom Study, Mistake Drill & Flag/Tag Cram Modal */}
          <CustomStudyModal />
        </>
      )}

      {/* Top-Center Dynamic Island Toast Notification with Presence Enter/Exit (E2) */}
      {toastPresence.mounted && (
        <div
          data-state={toastPresence.state}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-full border shadow-2xl text-[12px] font-medium flex items-center gap-2.5 backdrop-blur-md ui-toast select-none ${
            resolvedTheme === 'light'
              ? 'bg-[#1D1D1F]/92 text-white border-black/10 shadow-[0_12px_36px_rgba(0,0,0,0.22)]'
              : 'bg-[#22232B]/94 text-white border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.5)]'
          }`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: 'var(--brand)',
              boxShadow: '0 0 8px rgba(var(--brand-rgb), 0.65)',
            }}
          />
          <span className="tracking-tight">{toastMessage || lastToastTextRef.current}</span>
        </div>
      )}
    </div>
  );
};

export default App;
