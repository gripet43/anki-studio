import React, { useMemo, useRef, useState } from 'react';
import { translate } from '../../i18n/translations';
import { appActions, NavTab, setAppState, useAppStore } from '../../stores/useAppStore';
import { AnkiStudioLogo } from '../common/AnkiStudioLogo';
import { UserAvatar } from '../common/UserAvatar';
import { getDeckColorByHash } from '../../utils/mathRenderer';
import { getAccentScale, resolveThemeMode } from '../../utils/themeTokens';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';
import { Tooltip } from '../common/Tooltip';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    decks,
    collapsedDeckIds,
    sidebarCollapsed,
    dashboard,
    theme,
    systemDark,
    accentColor,
    resolvedLang,
    customAvatar,
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activeToolbarIdx, setActiveToolbarIdx] = useState(0);
  // Arm inner reveal choreography only after a user toggle (avoid animating on initial app mount)
  const initialCollapsedRef = useRef(sidebarCollapsed);
  const [sidebarMotionArmed, setSidebarMotionArmed] = useState(false);
  if (!sidebarMotionArmed && sidebarCollapsed !== initialCollapsedRef.current) {
    setSidebarMotionArmed(true);
  }
  const hasNativeFocusGroup =
    typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype;

  const handleToolbarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (hasNativeFocusGroup) return;
    const bar = toolbarRef.current;
    if (!bar) return;
    const buttons = Array.from(
      bar.querySelectorAll<HTMLButtonElement>('button.sidebar-footer-tool-btn')
    );
    if (buttons.length === 0) return;
    const currentIdx = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
    const isVertical = bar.getAttribute('aria-orientation') === 'vertical';
    const rtl = typeof window !== 'undefined' && window.getComputedStyle(bar).direction === 'rtl';
    let nextIdx: number | null = null;
    if (isVertical) {
      if (e.key === 'ArrowDown') {
        nextIdx = (currentIdx + 1) % buttons.length;
      } else if (e.key === 'ArrowUp') {
        nextIdx = (currentIdx - 1 + buttons.length) % buttons.length;
      }
    } else {
      if (e.key === 'ArrowRight') {
        nextIdx = (currentIdx + (rtl ? -1 : 1) + buttons.length) % buttons.length;
      } else if (e.key === 'ArrowLeft') {
        nextIdx = (currentIdx + (rtl ? 1 : -1) + buttons.length) % buttons.length;
      }
    }
    if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = buttons.length - 1;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      setActiveToolbarIdx(nextIdx);
      buttons[nextIdx]?.focus();
    }
  };

  const handleVersionBadgeClick = (e?: React.MouseEvent) => {
    versionClickCountRef.current += 1;
    if (versionClickTimerRef.current) clearTimeout(versionClickTimerRef.current);
    if (e?.altKey || versionClickCountRef.current >= 3) {
      versionClickCountRef.current = 0;
      appActions.unlockAndOpenDesignSystem();
      return;
    }
    versionClickTimerRef.current = setTimeout(() => {
      versionClickCountRef.current = 0;
    }, 900);
    appActions.openSettings('about');
  };

  const resolvedTheme = resolveThemeMode(theme, systemDark);
  const accentScale = getAccentScale(accentColor, resolvedTheme);
  const brandHex = accentScale.brand;

  const isDark = resolvedTheme === 'dark';
  const sidebarBg = isDark
    ? 'bg-[#121317] border-[#252730] text-[#F2F3F7]'
    : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[#1D1D1F]';

  const mutedText = 'text-[#636366] dark:text-[#A6A8B6]';
  const navActiveBg = 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold';
  const navHoverBg = isDark ? 'hover:bg-white/5 text-[#EBEBF5]' : 'hover:bg-[var(--bg-subtle)] text-[#3A3A3C]';

  const SIDEBAR_DECK_CHUNK = 60;
  const [sidebarDeckLimit, setSidebarDeckLimit] = useState(SIDEBAR_DECK_CHUNK);

  const { visibleSidebarDecks, decksWithChildren } = useMemo(() => {
    const collapsedSet = new Set(collapsedDeckIds);
    const collapsedPrefixes = new Set<string>();
    const parentNames = new Set<string>();
    const parentIds = new Set<string>();

    for (const d of decks) {
      if (collapsedSet.has(d.id)) {
        collapsedPrefixes.add(d.fullName);
      }
      if (d.parentId) {
        parentIds.add(d.parentId);
      }
      const sepIdx = d.fullName.lastIndexOf('::');
      if (sepIdx > 0) {
        parentNames.add(d.fullName.slice(0, sepIdx));
      }
    }

    const withChildren = new Set<string>();
    for (const d of decks) {
      if (d.childrenCount > 0 || parentIds.has(d.id) || parentNames.has(d.fullName)) {
        withChildren.add(d.id);
      }
    }

    const visible = decks.filter((d) => {
      if (!d.isChild || collapsedPrefixes.size === 0) return true;
      let idx = d.fullName.indexOf('::');
      while (idx > 0) {
        if (collapsedPrefixes.has(d.fullName.slice(0, idx))) return false;
        idx = d.fullName.indexOf('::', idx + 2);
      }
      return true;
    });

    return { visibleSidebarDecks: visible, decksWithChildren: withChildren };
  }, [decks, collapsedDeckIds]);

  const renderedSidebarDecks = useMemo(
    () => visibleSidebarDecks.slice(0, sidebarDeckLimit),
    [visibleSidebarDecks, sidebarDeckLimit]
  );
  const remainingSidebarDecks = Math.max(0, visibleSidebarDecks.length - renderedSidebarDecks.length);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'dashboard',
      label: t('navDashboard'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 15h4M7 11h10" />
        </svg>
      ),
    },
    {
      id: 'stats',
      label: t('navStats'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
      ),
    },
  ];

  const userDisplay = dashboard.userName || t('defaultUser');
  const hasDueDecks = decks.some((d) => d.dueReview + d.dueNew > 0);
  const footerTooltipSide = sidebarCollapsed ? 'right' : 'top';

  const profileTrigger = (
    <Tooltip
      variant="compact"
      content={
        sidebarCollapsed
          ? `${userDisplay} · ${t('openSettingsTooltip')}`
          : t('openSettingsTooltip')
      }
      side={footerTooltipSide}
    >
      <button
        type="button"
        aria-label={sidebarCollapsed ? t('openSettingsTooltip') : undefined}
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        data-open={settingsOpen ? 'true' : undefined}
        onClick={() => appActions.openSettings('appearance')}
        className={
          sidebarCollapsed
            ? `w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                isDark
                  ? 'hover:bg-white/[0.05]'
                  : 'hover:bg-[var(--bg-subtle)]/75'
              }`
            : `min-w-0 flex-1 px-2 py-1.5 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                isDark
                  ? 'hover:bg-white/[0.05]'
                  : 'hover:bg-[var(--bg-subtle)]/75'
              }`
        }
      >
        <UserAvatar
          avatar={customAvatar}
          displayName={userDisplay}
          size="sm"
          brandHex={brandHex}
          accentColor={accentColor}
          isDark={isDark}
          className="shadow-xs transition-colors duration-200 shrink-0"
        />
        {!sidebarCollapsed && (
          <span className="studio-sidebar-reveal text-[13px] font-medium leading-tight truncate text-start">
            {userDisplay}
          </span>
        )}
      </button>
    </Tooltip>
  );

  const footerToolbar = (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t('studyRhythmToolsAria')}
      aria-orientation={sidebarCollapsed ? 'vertical' : 'horizontal'}
      {...({ focusgroup: sidebarCollapsed ? 'toolbar wrap block' : 'toolbar wrap' } as any)}
      onKeyDown={handleToolbarKeyDown}
      className="sidebar-footer-toolbar"
    >
      {/* 1. 休假模式 (Vacation Mode) */}
      <Tooltip
        variant="compact"
        content={
          dashboard.vacation?.isActive
            ? `${t('vacationActiveShort', { n: dashboard.vacation.remainingDays })} · ${t('vacationBtnTooltip')}`
            : t('vacationBtnTooltip')
        }
        side={footerTooltipSide}
      >
        <button
          type="button"
          aria-label={t('vacationBtn')}
          aria-pressed={Boolean(dashboard.vacation?.isActive)}
          tabIndex={hasNativeFocusGroup ? undefined : activeToolbarIdx === 0 ? 0 : -1}
          onFocus={() => setActiveToolbarIdx(0)}
          onClick={() => appActions.openVacationModal('status')}
          className="sidebar-footer-tool-btn"
        >
          <svg
            className="w-[15px] h-[15px] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
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
          {dashboard.vacation?.isActive && (
            <span
              aria-hidden="true"
              className="absolute top-0.5 end-0.5 w-1.5 h-1.5 rounded-full bg-[var(--status-success)]"
            />
          )}
        </button>
      </Tooltip>

      {/* 2. 进度减负 (Backlog Relief) */}
      <Tooltip variant="compact" content={t('backlogRescueTooltip')} side={footerTooltipSide}>
        <button
          type="button"
          aria-label={t('backlogRescueBtn')}
          data-alert={dashboard.backlog?.hasAvalanche ? 'true' : undefined}
          tabIndex={hasNativeFocusGroup ? undefined : activeToolbarIdx === 1 ? 0 : -1}
          onFocus={() => setActiveToolbarIdx(1)}
          onClick={() => appActions.openIcuModal('rescue')}
          className="sidebar-footer-tool-btn"
        >
          <svg
            className="w-[15px] h-[15px] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          {dashboard.backlog?.hasAvalanche && (
            <span
              aria-hidden="true"
              className="absolute top-0.5 end-0.5 w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]"
            />
          )}
        </button>
      </Tooltip>
    </div>
  );

  return (
    <aside
      data-collapsed={sidebarCollapsed ? 'true' : 'false'}
      data-motion={sidebarMotionArmed ? 'true' : undefined}
      className={`studio-sidebar ${
        sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'
      } shrink-0 h-screen flex flex-col border-e select-none overflow-x-hidden ${sidebarBg}`}
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
        className={
          sidebarCollapsed
            ? `px-2 ${envInfo.platform === 'mac' ? 'pt-1 pb-3' : 'pt-4 pb-3'} flex flex-col items-center gap-2 cursor-default select-none`
            : `ps-4 pe-2.5 ${envInfo.platform === 'mac' ? 'pt-1 pb-4' : 'pt-5 pb-4'} flex items-center justify-between gap-2 cursor-default select-none`
        }
      >
        <Tooltip
          variant="compact"
          content={`${t('settingsTabAbout')} · Anki Studio`}
          side="right"
        >
          <button
            type="button"
            onClick={handleVersionBadgeClick}
            // 父级在 mousedown 上挂了窗口拖拽，不拦截的话点击会被拖拽逻辑吃掉
            onMouseDown={(e) => e.stopPropagation()}
            aria-haspopup="dialog"
            aria-label={`${t('settingsTabAbout')} · Anki Studio`}
            className={`group/brand flex items-center min-w-0 rounded-xl cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 hover:bg-[var(--brand-soft)] ${
              sidebarCollapsed ? 'w-9 h-9 justify-center' : 'gap-2.5 ps-1.5 pe-2.5 py-1 -ms-1.5'
            }`}
          >
            <span className="w-7 h-7 rounded-[8px] shrink-0 flex items-center justify-center bg-gradient-to-b from-white to-[#F5F6F8] dark:from-[#23252E] dark:to-[#191B22] border border-black/[0.09] dark:border-white/[0.11] shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]">
              <AnkiStudioLogo size={16} />
            </span>
            {!sidebarCollapsed && (
              <span className="studio-sidebar-reveal font-semibold text-[15px] leading-tight tracking-tight truncate select-none transition-colors group-hover/brand:text-[var(--brand-text)]">
                Anki Studio
              </span>
            )}
          </button>
        </Tooltip>

        <Tooltip
          variant="compact"
          content={sidebarCollapsed ? t('sidebarExpandTooltip') : t('sidebarCollapseTooltip')}
          shortcut={'Cmd \\'}
          side="right"
        >
          <button
            type="button"
            onClick={() => appActions.toggleSidebar()}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={t('sidebarToggleLabel')}
            aria-expanded={!sidebarCollapsed}
            aria-controls="studio-sidebar-nav"
            className={`sidebar-collapse-btn shrink-0 ${sidebarCollapsed ? 'w-9 h-8' : ''}`}
          >
            {sidebarCollapsed ? (
              <svg
                className="w-4 h-4 shrink-0 rtl:scale-x-[-1]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                <path d="m14 9 3 3-3 3" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 shrink-0 rtl:scale-x-[-1]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                <path d="m16 15-3-3 3-3" />
              </svg>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Quick Add Button (+ 快速制卡) — Secondary Hierarchy per UX requirements */}
      <div className={sidebarCollapsed ? 'px-2 mb-4 flex justify-center' : 'px-4 mb-4'}>
        <Tooltip variant="compact" content={t('quickAddTooltipLabel')} shortcut="N" side="right">
          <button
            type="button"
            aria-label={sidebarCollapsed ? t('quickAddBtn') : undefined}
            onClick={() => setAppState({ quickAddOpen: true })}
            className={
              sidebarCollapsed
                ? 'btn-secondary !w-10 !h-10 !p-0 justify-center'
                : `btn-secondary w-full !h-auto min-h-9 py-1.5 ${
                    showShortcutHints ? 'justify-between' : 'justify-center'
                  }`
            }
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
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {!sidebarCollapsed && <span className="studio-sidebar-reveal whitespace-nowrap">{t('quickAddBtn')}</span>}
            </span>
            {!sidebarCollapsed && showShortcutHints && (
              <kbd
                className={`studio-sidebar-reveal px-1.5 py-0.5 text-[10px] rounded font-mono ${
                  isDark
                    ? 'bg-white/10 text-[#8E8E93] border border-white/10'
                    : 'bg-black/5 text-[#8E8E93] border border-black/5'
                }`}
              >
                N
              </kbd>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Study Navigation Section */}
      {sidebarCollapsed ? (
        <div className="studio-sidebar-rail-reveal px-2 flex-1 flex flex-col items-center overflow-y-auto">
          <nav
            id="studio-sidebar-nav"
            aria-label={t('navStudy')}
            className="flex flex-col items-center gap-1 w-full"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <Tooltip key={item.id} variant="compact" content={item.label} side="right">
                  <button
                    type="button"
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => appActions.setActiveTab(item.id)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                      isActive ? navActiveBg : navHoverBg
                    }`}
                  >
                    {item.icon}
                  </button>
                </Tooltip>
              );
            })}

            <div
              aria-hidden="true"
              className={`w-6 h-px my-1.5 ${
                isDark ? 'bg-white/10' : 'bg-[var(--border-subtle)]'
              }`}
            />

            {/* Compact Decks Shortcut when Deck Tree is Collapsed */}
            <Tooltip
              variant="compact"
              content={`${t('sidebarDecks')} (${decks.length})`}
              side="right"
            >
              <button
                type="button"
                aria-label={t('sidebarDecks')}
                aria-current={activeTab === 'decks' ? 'page' : undefined}
                onClick={() => appActions.setActiveTab('decks')}
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                  activeTab === 'decks' ? navActiveBg : navHoverBg
                }`}
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                </svg>
                {hasDueDecks && activeTab !== 'decks' && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 end-2 w-1.5 h-1.5 rounded-full bg-[var(--brand)]"
                  />
                )}
              </button>
            </Tooltip>

            {/* Item #7: Only visible when unlocked by developer */}
            {debugModeUnlocked && (
              <Tooltip variant="compact" content="Design System (DEV)" side="right">
                <button
                  type="button"
                  aria-label="Design System"
                  aria-current={activeTab === 'design-system' ? 'page' : undefined}
                  onClick={() => appActions.setActiveTab('design-system')}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                    activeTab === 'design-system' ? navActiveBg : navHoverBg
                  }`}
                >
                  <svg
                    className="w-4 h-4 shrink-0 opacity-85"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </button>
              </Tooltip>
            )}
          </nav>
        </div>
      ) : (
        <>
          <div className="px-3">
            <div className={`studio-sidebar-reveal px-2.5 mb-1.5 text-[11px] font-medium ${mutedText}`}>
              {t('navStudy')}
            </div>
            <nav id="studio-sidebar-nav" aria-label={t('navStudy')} className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => appActions.setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                      isActive ? navActiveBg : navHoverBg
                    }`}
                  >
                    {item.icon}
                    <span className="studio-sidebar-reveal truncate">{item.label}</span>
                  </button>
                );
              })}

              {/* Item #7: Only visible when unlocked by developer (`debug_mode: true`, 3-click version, or Ctrl+Shift+D) */}
              {debugModeUnlocked && (
                <button
                  type="button"
                  aria-current={activeTab === 'design-system' ? 'page' : undefined}
                  onClick={() => appActions.setActiveTab('design-system')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-colors cursor-pointer ${
                    activeTab === 'design-system' ? navActiveBg : navHoverBg
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <svg className="w-3.5 h-3.5 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    <span className="studio-sidebar-reveal truncate">Design System</span>
                  </span>
                  <span className="studio-sidebar-reveal text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-soft-strong)] text-[var(--brand-text)] shrink-0">
                    DEV
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* Decks Section — O(N) tree with incremental scroll loading to keep 600+ deck profiles 60fps */}
          <div
            className="studio-sidebar-reveal px-3 mt-6 flex-1 overflow-y-auto"
            onScroll={(e) => {
              if (remainingSidebarDecks <= 0) return;
              const el = e.currentTarget;
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
                setSidebarDeckLimit((prev) => prev + SIDEBAR_DECK_CHUNK);
              }
            }}
          >
            <div className="px-2.5 mb-2 flex items-center justify-between">
              <span className={`text-[11px] font-medium ${mutedText}`}>
                {t('sidebarDecks')} ({decks.length})
              </span>
              <button
                type="button"
                onClick={() => appActions.setActiveTab('decks')}
                className={`btn-ghost !text-[11px] !h-auto !px-2 -me-2 !py-0.5 ${
                  activeTab === 'decks'
                    ? '!bg-[var(--brand-soft)] !text-[var(--brand-text)] font-semibold'
                    : '!text-[var(--brand-text)]'
                }`}
              >
                {t('manage')}
              </button>
            </div>
            <div className="space-y-0.5">
              {renderedSidebarDecks.map((deck) => {
                const hasChildren = decksWithChildren.has(deck.id);
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
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            appActions.toggleDeckCollapse(deck.id);
                          }}
                          aria-label={deck.name}
                          aria-expanded={!isCollapsed}
                          className="w-4 h-4 -ms-0.5 flex items-center justify-center rounded text-[#8E8E93] hover:text-[var(--brand-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer shrink-0 transition-colors"
                        >
                          <svg
                            className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      ) : (
                        <span className="w-4 h-4 flex items-center justify-center shrink-0">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => appActions.startReview(deck.id)}
                        className="truncate text-start flex-1 min-w-0 cursor-pointer"
                      >
                        {deck.name}
                      </button>
                    </div>
                    {(deck.dueReview + deck.dueNew) > 0 && (
                      <span
                        className={`text-[11px] font-mono ${mutedText} group-hover/deck:hidden group-focus-within/deck:hidden`}
                      >
                        {deck.dueReview + deck.dueNew}
                      </span>
                    )}
                    {/* 悬停或键盘聚焦时把待复习数字换成「查看 / 学习」两个动作 */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 pointer-events-none w-0 overflow-hidden group-hover/deck:w-auto group-hover/deck:opacity-100 group-hover/deck:pointer-events-auto group-hover/deck:overflow-visible group-focus-within/deck:w-auto group-focus-within/deck:opacity-100 group-focus-within/deck:pointer-events-auto group-focus-within/deck:overflow-visible transition-opacity duration-150">
                      <button
                        type="button"
                        aria-label={t('viewInLibraryBtn')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAppState({ activeTab: 'library' });
                          appActions.searchLibraryDebounced({ deckId: deck.id });
                        }}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[#8E8E93] hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)] focus-visible:outline-2 focus-visible:outline-[var(--brand)] transition-colors cursor-pointer"
                      >
                        <svg
                          className="w-3 h-3 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="3" y="4" width="18" height="16" rx="2" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={t('startTodayStudy')}
                        onClick={(e) => {
                          e.stopPropagation();
                          appActions.startReview(deck.id);
                        }}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[#8E8E93] hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)] focus-visible:outline-2 focus-visible:outline-[var(--brand)] transition-colors cursor-pointer"
                      >
                        <svg className="w-2.5 h-2.5 fill-current ms-0.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {remainingSidebarDecks > 0 && (
                <button
                  type="button"
                  onClick={() => setSidebarDeckLimit((prev) => prev + SIDEBAR_DECK_CHUNK)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-start cursor-pointer transition-colors ${mutedText} hover:text-[var(--brand-text)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]`}
                >
                  + {remainingSidebarDecks}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Unified User Profile & Studio Controls Footer */}
      <div
        className={
          sidebarCollapsed
            ? `px-2 py-3 border-t flex flex-col items-center gap-2 ${
                isDark ? 'border-[#252730]' : 'border-[var(--border-subtle)]'
              }`
            : `px-3 py-2.5 border-t flex items-center justify-between gap-2 ${
                isDark ? 'border-[#252730]' : 'border-[var(--border-subtle)]'
              }`
        }
      >
        {sidebarCollapsed ? (
          <>
            {footerToolbar}
            {profileTrigger}
          </>
        ) : (
          <>
            {profileTrigger}
            {footerToolbar}
          </>
        )}
      </div>
    </aside>
  );
};
