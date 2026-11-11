import React, { useEffect, useMemo, useReducer, useRef } from 'react';
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
import { usePresence } from './hooks/usePresence';
import { ensureLanguageLoaded, isLanguageLoaded, isRtlLanguage, translate } from './i18n/translations';
import { appActions, getAppState, setAppState, showToast, useAppStore } from './stores/useAppStore';
import { buildThemeCssVars } from './utils/themeTokens';

export const App: React.FC = () => {
  const {
    activeTab,
    inReviewMode,
    cmdKOpen,
    quickAddOpen,
    settingsOpen,
    theme,
    accentColor,
    resolvedLang,
    toastMessage,
  } = useAppStore();

  const themeVars = useMemo(() => buildThemeCssVars(accentColor, theme), [accentColor, theme]);
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

  // Smooth 260ms color/surface cross-fade when user switches theme or accentColor (F)
  // Skips initial mount and does NOT trigger on language/RTL changes.
  const themeMountedRef = useRef<boolean>(false);
  const themeSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!themeMountedRef.current) {
      themeMountedRef.current = true;
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
  }, [theme, accentColor]);

  // Synchronize CSS variables, theme class, and language/RTL direction onto document.documentElement
  // so portals and root-level styles always reflect the active theme, accent, and text direction.
  useEffect(() => {
    const rootEl = document.documentElement;
    rootEl.classList.toggle('dark', theme === 'dark' || theme === 'oled');
    rootEl.classList.toggle('oled', theme === 'oled');
    rootEl.dir = isRtl ? 'rtl' : 'ltr';
    rootEl.lang = resolvedLang;
    for (const [k, v] of Object.entries(themeVars)) {
      rootEl.style.setProperty(k, v);
    }
  }, [theme, themeVars, isRtl, resolvedLang]);

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
      setAppState({ settingsOpen: true });
    };

    window.addEventListener('anki:collection-updated', onCollectionUpdated);
    window.addEventListener('anki:sync-started', onSyncStarted);
    window.addEventListener('anki:sync-finished', onSyncFinished);
    window.addEventListener('anki:toast', onAnkiToast);
    window.addEventListener('anki:open-settings', onOpenSettings);
    return () => {
      window.removeEventListener('anki:collection-updated', onCollectionUpdated);
      window.removeEventListener('anki:sync-started', onSyncStarted);
      window.removeEventListener('anki:sync-finished', onSyncFinished);
      window.removeEventListener('anki:toast', onAnkiToast);
      window.removeEventListener('anki:open-settings', onOpenSettings);
    };
  }, []);

  // Global keyboard shortcuts:
  // - Cmd+K / Ctrl+K: Search Palette
  // - Ctrl+P / Cmd+, / Ctrl+,: Preferences & Settings Modal (aligned with Anki Tools -> Preferences)
  // - N: Quick Add Drawer
  // - Ctrl+Opt+M / Ctrl+Alt+M: Fail-safe Native UI Toggle
  // - Ctrl+Shift+D: Developer Design System View (Item #7)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        appActions.triggerNativeEscape();
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

      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key.toLowerCase() === 'p' || e.key === ',')
      ) {
        e.preventDefault();
        setAppState((prev) => ({ settingsOpen: !prev.settingsOpen }));
        return;
      }

      const targetTag = (e.target as HTMLElement)?.tagName;
      const isTyping = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT';

      // N: Quick Add Drawer
      if (
        !isTyping &&
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

      // Y: Anki Standard Manual Cloud Sync
      if (
        !isTyping &&
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
  }, [inReviewMode, cmdKOpen, quickAddOpen, settingsOpen]);

  const rootBg =
    theme === 'oled'
      ? 'bg-[#09090C] text-[#F4F4F6] dark oled'
      : theme === 'dark'
      ? 'bg-[#131418] text-[#F2F3F7] dark'
      : 'bg-[#F4F4F6] text-[#1D1D1F]';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={themeVars as React.CSSProperties}
      className={`w-screen h-screen overflow-hidden flex font-sans antialiased ${rootBg}`}
    >
      {/* Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Workspace Area — Keyed inner wrapper for 160ms view enter animation (D) */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div
          key={activeTab}
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

      {/* Top-Center Dynamic Island Toast Notification with Presence Enter/Exit (E2) */}
      {toastPresence.mounted && (
        <div
          data-state={toastPresence.state}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-full border shadow-2xl text-[12px] font-medium flex items-center gap-2.5 backdrop-blur-md ui-toast select-none ${
            theme === 'light'
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
