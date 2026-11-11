import React, { useRef } from 'react';
import { translate } from '../../i18n/translations';
import { appActions, NavTab, setAppState, useAppStore } from '../../stores/useAppStore';
import { AnkiStudioLogo } from '../common/AnkiStudioLogo';
import { getDeckColorByHash } from '../../utils/mathRenderer';
import { getAccentScale } from '../../utils/themeTokens';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    decks,
    collapsedDeckIds,
    dashboard,
    theme,
    accentColor,
    resolvedLang,
    envInfo,
    showShortcutHints,
    debugModeUnlocked,
    settingsOpen,
  } = useAppStore();

  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  // Item #7: Triple-click on version badge unlocks Developer-only Design System View
  const versionClickCountRef = useRef(0);
  const versionClickTimerRef = useRef<any>(null);

  const handleVersionBadgeClick = () => {
    versionClickCountRef.current += 1;
    if (versionClickTimerRef.current) clearTimeout(versionClickTimerRef.current);
    if (versionClickCountRef.current >= 3) {
      versionClickCountRef.current = 0;
      appActions.unlockAndOpenDesignSystem();
      return;
    }
    versionClickTimerRef.current = setTimeout(() => {
      versionClickCountRef.current = 0;
    }, 900);
  };

  const accentScale = getAccentScale(accentColor, theme);
  const brandHex = accentScale.brand;

  const isDark = theme === 'dark' || theme === 'oled';
  const sidebarBg =
    theme === 'oled'
      ? 'bg-[#08080B] border-[#1E1F26] text-[#F4F4F6]'
      : theme === 'dark'
      ? 'bg-[#121317] border-[#252730] text-[#F2F3F7]'
      : 'bg-[#FFFFFF] border-[#E8E9EE] text-[#1D1D1F]';

  const mutedText = 'text-[#8E8E93]';
  const navActiveBg = 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold';
  const navHoverBg = isDark ? 'hover:bg-white/5 text-[#EBEBF5]' : 'hover:bg-[#F4F4F6] text-[#3A3A3C]';

  const visibleSidebarDecks = decks.filter((d) => {
    if (!d.isChild) return true;
    const collapsedAncestor = decks.some(
      (ancestor) =>
        collapsedDeckIds.includes(ancestor.id) &&
        d.fullName.startsWith(`${ancestor.fullName}::`)
    );
    return !collapsedAncestor;
  });

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'dashboard',
      label: t('navDashboard'),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'library',
      label: t('navLibrary'),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 15h4M7 11h10" />
        </svg>
      ),
    },
    {
      id: 'stats',
      label: t('navStats'),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const userDisplay = dashboard.userName || t('defaultUser');

  return (
    <aside
      className={`w-[240px] shrink-0 h-screen flex flex-col border-e select-none transition-colors duration-200 ${sidebarBg}`}
    >
      {/* macOS Traffic Lights Spacer & Drag Area (Immersive Titlebar) */}
      {envInfo.platform === 'mac' && (
        <div
          onMouseDown={startWindowDrag}
          onDoubleClick={handleWindowDoubleClick}
          className="h-10 shrink-0 w-full cursor-default select-none"
        />
      )}

      {/* Brand Header — Triple-click version badge to unlock Dev Design System (Item #7) */}
      <div
        onMouseDown={startWindowDrag}
        onDoubleClick={handleWindowDoubleClick}
        className={`px-5 ${envInfo.platform === 'mac' ? 'pt-1 pb-4' : 'pt-5 pb-4'} flex items-center gap-3 cursor-default select-none`}
      >
        <button
          type="button"
          onClick={() => appActions.setActiveTab('dashboard')}
          // 父级在 mousedown 上挂了窗口拖拽，不拦截的话点击会被拖拽逻辑吃掉
          onMouseDown={(e) => e.stopPropagation()}
          title={t('navDashboard')}
          aria-label={t('navDashboard')}
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs transition-colors duration-200 border border-black/5 dark:border-white/10 bg-black/[0.025] dark:bg-white/[0.05] hover:bg-[var(--brand-soft)] hover:border-[var(--brand-border)] cursor-pointer"
        >
          <AnkiStudioLogo size={22} />
        </button>
        <div
          onClick={handleVersionBadgeClick}
          title="Anki Studio"
          className="font-semibold text-[15px] leading-tight tracking-tight cursor-default select-none"
        >
          Anki Studio
        </div>
      </div>

      {/* Quick Add Button (+ 快速制卡) — Secondary Hierarchy per UX requirements */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setAppState({ quickAddOpen: true })}
          className={`btn-secondary w-full ${
            showShortcutHints ? 'justify-between' : 'justify-center'
          }`}
          title={t('quickAddTooltip')}
        >
          <span className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-[var(--brand-text)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{t('quickAddBtn')}</span>
          </span>
          {showShortcutHints && (
            <kbd
              className={`px-1.5 py-0.5 text-[10px] rounded font-mono ${
                isDark
                  ? 'bg-white/10 text-[#8E8E93] border border-white/10'
                  : 'bg-black/5 text-[#8E8E93] border border-black/5'
              }`}
            >
              N
            </kbd>
          )}
        </button>
      </div>

      {/* Study Navigation Section */}
      <div className="px-3">
        <div className={`px-2.5 mb-1.5 text-[11px] font-medium ${mutedText}`}>
          {t('navStudy')}
        </div>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => appActions.setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                  isActive ? navActiveBg : navHoverBg
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Item #7: Only visible when unlocked by developer (`debug_mode: true`, 3-click version, or Ctrl+Shift+D) */}
          {debugModeUnlocked && (
            <button
              onClick={() => appActions.setActiveTab('design-system')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-colors cursor-pointer ${
                activeTab === 'design-system' ? navActiveBg : navHoverBg
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                <span>Design System</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-soft-strong)] text-[var(--brand-text)]">
                DEV
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Decks Section */}
      <div className="px-3 mt-6 flex-1 overflow-y-auto">
        <div className="px-2.5 mb-2 flex items-center justify-between">
          <span className={`text-[11px] font-medium ${mutedText}`}>
            {t('sidebarDecks')} ({decks.length})
          </span>
          <button
            onClick={() => appActions.setActiveTab('decks')}
            className={`btn-ghost !text-[11px] !h-auto !ps-2 !pe-0 !py-0.5 ${
              activeTab === 'decks'
                ? '!bg-[var(--brand-soft)] !text-[var(--brand-text)] font-semibold'
                : '!text-[var(--brand-text)]'
            }`}
          >
            {t('manage')}
          </button>
        </div>
        <div className="space-y-0.5">
          {visibleSidebarDecks.map((deck) => {
            const hasChildren =
              deck.childrenCount > 0 ||
              decks.some((c) => c.parentId === deck.id || c.fullName.startsWith(`${deck.fullName}::`));
            const isCollapsed = collapsedDeckIds.includes(deck.id);
            const dotColor = getDeckColorByHash(deck.id || deck.name);

            return (
              <div
                key={deck.id}
                style={{ paddingInlineStart: `${deck.depth * 14}px` }}
                className={`group/deck w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${navHoverBg}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        appActions.toggleDeckCollapse(deck.id);
                      }}
                      className="w-3.5 text-[10px] text-[#8E8E93] hover:text-[var(--brand-text)] cursor-pointer"
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </button>
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full shrink-0 ms-1"
                      style={{ backgroundColor: dotColor }}
                    />
                  )}
                  <button
                    onClick={() => appActions.startReview(deck.id)}
                    className="truncate text-start flex-1 cursor-pointer"
                  >
                    {deck.name}
                  </button>
                </div>
                {(deck.dueReview + deck.dueNew) > 0 && (
                  <span
                    className={`text-[11px] font-mono ${mutedText} group-hover/deck:hidden`}
                  >
                    {deck.dueReview + deck.dueNew}
                  </span>
                )}
                {/* 悬停时把待复习数字换成「查看 / 学习」两个动作 */}
                <div className="hidden group-hover/deck:flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    title={t('viewInLibraryBtn')}
                    aria-label={t('viewInLibraryBtn')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAppState({ activeTab: 'library' });
                      appActions.searchLibraryDebounced({ deckId: deck.id });
                    }}
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[#8E8E93] hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)] transition-colors cursor-pointer"
                  >
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title={t('navStudy')}
                    aria-label={t('startTodayStudy')}
                    onClick={(e) => {
                      e.stopPropagation();
                      appActions.startReview(deck.id);
                    }}
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[#8E8E93] hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)] transition-colors cursor-pointer"
                  >
                    <svg className="w-2.5 h-2.5 fill-current ms-0.5" viewBox="0 0 24 24">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Rhythm & Backlog Relief Bar — Unified, Minimalist Studio Controls */}
      <div className="px-3 pb-2.5">
        <div
          role="toolbar"
          aria-label={t('studyRhythmToolsAria')}
          className={`p-1 rounded-xl border grid grid-cols-2 gap-1 transition-colors ${
            isDark ? 'bg-white/[0.025] border-white/[0.07]' : 'bg-[#F5F6F8] border-[#E5E7EB]'
          }`}
        >
          {/* 1. 休假模式 (Vacation Mode) */}
          <button
            type="button"
            onClick={() => appActions.openVacationModal('status')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-[var(--brand)] ${
              dashboard.vacation?.isActive
                ? 'bg-[var(--status-success-soft)] text-[var(--status-success)] font-semibold shadow-2xs'
                : isDark
                ? 'text-[#9A9CA6] hover:text-white hover:bg-white/[0.06] hover:shadow-2xs'
                : 'text-[#5C5E66] hover:text-[#111215] hover:bg-white hover:shadow-2xs'
            }`}
            title={t('vacationBtnTooltip')}
          >
            <svg
              className="w-3.5 h-3.5 shrink-0 opacity-80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="10" y1="14" x2="10" y2="18" />
              <line x1="14" y1="14" x2="14" y2="18" />
            </svg>
            <span className="truncate">
              {dashboard.vacation?.isActive
                ? t('vacationActiveShort', { n: dashboard.vacation.remainingDays })
                : t('vacationBtn')}
            </span>
            {dashboard.vacation?.isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] shrink-0" />
            )}
          </button>

          {/* 2. 进度减负 (Backlog Relief) */}
          <button
            type="button"
            onClick={() => appActions.openIcuModal('rescue')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-[var(--brand)] ${
              dashboard.backlog?.hasAvalanche
                ? 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] font-semibold shadow-2xs'
                : isDark
                ? 'text-[#9A9CA6] hover:text-white hover:bg-white/[0.06] hover:shadow-2xs'
                : 'text-[#5C5E66] hover:text-[#111215] hover:bg-white hover:shadow-2xs'
            }`}
            title={t('backlogRescueTooltip')}
          >
            <svg
              className="w-3.5 h-3.5 shrink-0 opacity-80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="truncate">{t('backlogRescueBtn')}</span>
            {dashboard.backlog?.hasAvalanche && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] shrink-0 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Unified User Profile & Settings Entrance */}
      <div className={`p-3 border-t ${isDark ? 'border-[#252730]' : 'border-[#F0F0F5]'}`}>
        <button
          type="button"
          onClick={() => setAppState({ settingsOpen: true })}
          title={t('openSettingsTooltip')}
          className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
            settingsOpen
              ? navActiveBg
              : isDark
              ? 'hover:bg-white/5'
              : 'hover:bg-[#F4F4F6]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 shadow-xs transition-colors duration-200"
              style={{ backgroundColor: brandHex }}
            >
              {userDisplay.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 text-start">
              <div className="text-[13px] font-medium leading-tight truncate">
                {userDisplay}
              </div>
              <div className={`text-[11px] ${mutedText} mt-0.5`}>
                {t('navSettings')}
              </div>
            </div>
          </div>

          <svg className="w-4 h-4 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          </svg>
        </button>
      </div>
    </aside>
  );
};
