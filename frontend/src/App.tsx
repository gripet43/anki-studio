import React, { useEffect, useMemo } from 'react';
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
import { VacationModal } from './components/vacation/VacationModal';
import { IcuRescueModal } from './components/vacation/IcuRescueModal';
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
    toastMessage,
  } = useAppStore();

  const themeVars = useMemo(() => buildThemeCssVars(accentColor, theme), [accentColor, theme]);

  // Synchronize CSS variables & theme class onto document.documentElement so portals and
  // root-level styles (scrollbars, selection, inputs) always reflect the active theme & accent.
  useEffect(() => {
    const rootEl = document.documentElement;
    rootEl.classList.toggle('dark', theme === 'dark' || theme === 'oled');
    rootEl.classList.toggle('oled', theme === 'oled');
    for (const [k, v] of Object.entries(themeVars)) {
      rootEl.style.setProperty(k, v);
    }
  }, [theme, themeVars]);

  useEffect(() => {
    appActions.initFromAnki();

    const onCollectionUpdated = () => {
      // Guard: do not interrupt cold start sync while in progress
      if (getAppState().isInitialSyncing) return;
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
      const isZh = getAppState().resolvedLang === 'zh-CN';
      setAppState({
        syncing: true,
        lastSyncedText: isZh ? '正在同步...' : 'Syncing...',
      });
    };

    const onSyncFinished = () => {
      // Guard: cold start sync manages its own choreographed reveal
      if (getAppState().isInitialSyncing) return;
      const isZh = getAppState().resolvedLang === 'zh-CN';
      const nowTs = Date.now();
      setAppState({
        syncing: false,
        syncJustFinished: true,
        lastSyncedTimestamp: nowTs,
        lastSyncedText: isZh ? '已同步 (刚刚)' : 'Synced (Just now)',
      });
      setTimeout(() => {
        setAppState({ syncJustFinished: false });
      }, 2600);
      appActions.initFromAnki(true);
    };

    window.addEventListener('anki:collection-updated', onCollectionUpdated);
    window.addEventListener('anki:sync-started', onSyncStarted);
    window.addEventListener('anki:sync-finished', onSyncFinished);
    window.addEventListener('anki:toast', onAnkiToast);
    return () => {
      window.removeEventListener('anki:collection-updated', onCollectionUpdated);
      window.removeEventListener('anki:sync-started', onSyncStarted);
      window.removeEventListener('anki:sync-finished', onSyncFinished);
      window.removeEventListener('anki:toast', onAnkiToast);
    };
  }, []);

  // Global keyboard shortcuts:
  // - Cmd+K / Ctrl+K: Search Palette
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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAppState((prev) => ({ cmdKOpen: !prev.cmdKOpen }));
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
      style={themeVars as React.CSSProperties}
      className={`w-screen h-screen overflow-hidden flex font-sans antialiased ${rootBg}`}
    >
      {/* Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'library' && <LibraryView />}
        {activeTab === 'decks' && <DecksView />}
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'design-system' && <DesignSystemView />}
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

      {/* Top-Center Dynamic Island Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-full border shadow-2xl text-[12px] font-medium flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 select-none ${
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
          <span className="tracking-tight">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
