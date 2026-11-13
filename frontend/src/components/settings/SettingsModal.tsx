import React, { useEffect, useState } from 'react';
import { AnkiStudioLogo } from '../common/AnkiStudioLogo';
import { SyncStateIcon, SyncVisualState } from '../common/SyncStateIcon';
import { usePresence } from '../../hooks/usePresence';
import {
  formatAbsoluteSyncTooltip,
  formatRelativeSyncLabel,
  formatShortcut,
  getLanguageMeta,
  LanguageOption,
  SUPPORTED_LANGUAGES,
  translate,
} from '../../i18n/translations';
import {
  appActions,
  setAppState,
  showToast,
  ThemeMode,
  useAppStore,
} from '../../stores/useAppStore';
import { callAnki, isAnkiNativeEnv } from '../../bridge/pycmd';
import { ACCENT_COLOR_LIST, getAccentScale } from '../../utils/themeTokens';
import { localDateKey } from '../../utils/localDate';

const XIAOHONGSHU_PROFILE_URL =
  'https://www.xiaohongshu.com/user/profile/6496d6f8000000001001ff0f';
const GITHUB_REPO_URL = 'https://github.com/gripet43/anki-studio';

type SettingsTab = 'appearance' | 'shortcuts' | 'sync' | 'maintenance' | 'native' | 'about';

export const SettingsModal: React.FC = () => {
  const {
    settingsOpen,
    theme,
    accentColor,
    languagePref,
    resolvedLang,
    customNickname,
    dashboard,
    syncing,
    syncJustFinished,
    lastSyncedTimestamp,
    settingsInitialTab,
    envInfo,
    showShortcutHints,
    tipsHiddenOn,
    analyticsEnabled,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsInitialTab || 'appearance');
  const [nicknameDraft, setNicknameDraft] = useState(customNickname || '');
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [dbReport, setDbReport] = useState<any | null>(null);
  const [emptyReport, setEmptyReport] = useState<any | null>(null);
  const [mediaReport, setMediaReport] = useState<any | null>(null);

  const isDark = theme === 'dark' || theme === 'oled';
  const tipsHiddenToday = tipsHiddenOn === localDateKey();
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  // 关于页的外链用系统浏览器打开：WebView 从 file:// 加载，直接导航会把整个
  // 工作区替换成网页；非 Anki 环境（演示/测试）退化为 window.open。
  const openExternal = (url: string) => {
    if (isAnkiNativeEnv()) {
      callAnki('open_external_url', { url }).catch(() => {});
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    if (settingsOpen && settingsInitialTab) {
      setActiveTab(settingsInitialTab);
    }
  }, [settingsOpen, settingsInitialTab]);

  useEffect(() => {
    setNicknameDraft(customNickname || '');
  }, [customNickname, settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAppState({ settingsOpen: false });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen]);

  const presence = usePresence(settingsOpen, 120);
  if (!presence.mounted) return null;

  const modalSurface =
    theme === 'oled'
      ? 'bg-[#101115] border-[#242630] text-white'
      : theme === 'dark'
      ? 'bg-[#181920] border-[#2C2E3A] text-white'
      : 'bg-white border-[#E5E5EA] text-[#1D1D1F]';

  const cardSurface =
    theme === 'oled'
      ? 'bg-[#15161C] border-[#242630]'
      : theme === 'dark'
      ? 'bg-[#1F212A] border-[#2E303D]'
      : 'bg-[#F9F9FB] border-[#ECECF2]';

  const sidebarBg =
    theme === 'oled'
      ? 'bg-[#0B0C0F] border-[#22232D]'
      : theme === 'dark'
      ? 'bg-[#13141A] border-[#252732]'
      : 'bg-[#F5F5F7] border-[#E8E8ED]';

  const subText = 'text-[#636366] dark:text-[#A6A8B6]';
  const shortcutHint = formatShortcut('Ctrl + Opt + M', envInfo.platform);
  const currentScale = getAccentScale(accentColor, theme);

  const themeOptions: Array<{ id: ThemeMode; label: string; desc: string }> = [
    { id: 'light', label: t('themeLight'), desc: t('themeLightDesc') },
    { id: 'dark', label: t('themeDark'), desc: t('themeDarkDesc') },
    { id: 'oled', label: t('themeOled'), desc: t('themeOledDesc') },
  ];

  const currentLangMeta = getLanguageMeta(resolvedLang);

  // Tiled language grid items: Auto + 16 official Anki languages (no <select> dropdown)
  const tiledLanguageOptions: Array<{
    id: LanguageOption;
    nativeName: string;
    subLabel: string;
  }> = [
    {
      id: 'auto',
      nativeName: t('langAuto'),
      subLabel: `Auto · ${currentLangMeta.nativeName}`,
    },
    ...SUPPORTED_LANGUAGES.map((item) => ({
      id: item.id as LanguageOption,
      nativeName: item.nativeName,
      subLabel: item.englishName,
    })),
  ];

  const tabs: Array<{ id: SettingsTab; icon: React.ReactNode; label: string }> = [
    {
      id: 'appearance',
      label: t('settingsTabAppearance'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      ),
    },
    {
      id: 'shortcuts',
      label: t('settingsTabShortcuts'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
        </svg>
      ),
    },
    {
      id: 'sync',
      label: t('settingsTabSync'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      ),
    },
    {
      id: 'maintenance',
      label: t('settingsTabMaintenance'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5V19A9 3 0 0 0 21 19V5" />
          <path d="M3 12A9 3 0 0 0 21 12" />
        </svg>
      ),
    },
    {
      id: 'native',
      label: t('settingsTabNative'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        </svg>
      ),
    },
    {
      id: 'about',
      label: t('settingsTabAbout'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      ),
    },
  ];

  const relativeSync = formatRelativeSyncLabel(lastSyncedTimestamp, resolvedLang);
  const absSync = formatAbsoluteSyncTooltip(lastSyncedTimestamp, resolvedLang);

  return (
    <div
      data-state={presence.state}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[5px] flex items-center justify-center p-6 select-none ui-modal-backdrop modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-label={t('navSettings')}
    >
      <div
        data-state={presence.state}
        onClick={(e) => e.stopPropagation()}
        className={`w-[800px] h-[560px] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.35)] flex overflow-hidden ui-modal-panel relative ${modalSurface}`}
      >
        {/* Top Right Close Button */}
        <button
          type="button"
          onClick={() => setAppState({ settingsOpen: false })}
          className={`absolute top-4 end-4 z-20 w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
            isDark ? 'text-[#8E8E93] hover:text-white hover:bg-white/10' : 'text-[#8E8E93] hover:text-black hover:bg-black/5'
          }`}
          title={`${t('close')} (Esc)`}
          aria-label={t('close')}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Left Settings Sidebar */}
        <div className={`w-[210px] shrink-0 border-e p-3.5 flex flex-col ${sidebarBg}`}>
          <div className="space-y-4">
            {/* Header */}
            <div className="px-3 pt-2">
              <h2 className="text-[16px] font-bold tracking-tight">
                {t('navSettings')}
              </h2>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={active ? { backgroundColor: currentScale.brand } : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer text-start ${
                      active
                        ? 'text-white shadow-xs font-semibold'
                        : isDark
                        ? 'hover:bg-white/5 text-[#D1D1D8]'
                        : 'hover:bg-black/5 text-[#3A3A3C]'
                    }`}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Right Settings Content Panel */}
        <div className="flex-1 p-7 overflow-y-auto space-y-5">
          {/* TAB 1: Appearance & Display */}
          {activeTab === 'appearance' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">
                  {t('settingsTabAppearance')}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {t('settingsAppearanceSub')}
                </p>
              </div>

              {/* Theme Mode Card */}
              <div className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="text-[13px] font-semibold">{t('settingsThemeModeTitle')}</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {themeOptions.map((opt) => {
                    const active = theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          appActions.setTheme(opt.id);
                          showToast(t('savedThemeToast', { name: opt.label }));
                        }}
                        style={
                          active
                            ? {
                                backgroundColor: currentScale.brandSoft,
                                borderColor: currentScale.brand,
                                color: currentScale.brandText,
                              }
                            : undefined
                        }
                        className={`py-2.5 px-3 rounded-xl border text-start cursor-pointer transition-all ${
                          active
                            ? 'shadow-xs ring-1 ring-[var(--brand)]'
                            : isDark
                            ? 'border-[#343444] text-[#C8C8D2] hover:border-[var(--brand-border)]'
                            : 'bg-white border-[#E5E5EA] text-[#3A3A3C] hover:border-[var(--brand-border)]'
                        }`}
                      >
                        <div className="text-[12px] font-semibold">{opt.label}</div>
                        <div className="text-[10px] opacity-75 mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Color Card */}
              <div className={`rounded-xl border p-4 space-y-3.5 ${cardSurface}`}>
                <div className="text-[13px] font-semibold">
                  {t('settingsThemeColorTitle')}
                </div>

                <div
                  role="radiogroup"
                  aria-label={t('settingsThemeColorTitle')}
                  className="grid grid-cols-4 gap-2.5"
                >
                  {ACCENT_COLOR_LIST.map((a) => {
                    const active = accentColor === a.id;
                    const modeScale = isDark ? a.dark : a.light;
                    const shortLabel = t(`accentShort_${a.id}` as any);
                    const fullLabel = t(`accentName_${a.id}` as any);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={fullLabel}
                        title={fullLabel}
                        onClick={() => {
                          appActions.setAccentColor(a.id);
                          showToast(t('savedAccentToast', { name: shortLabel }));
                        }}
                        style={
                          active
                            ? {
                                backgroundColor: modeScale.brandSoft,
                                borderColor: modeScale.brand,
                              }
                            : undefined
                        }
                        className={`px-2.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-start relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                          active
                            ? 'ring-1 ring-[var(--brand)] shadow-xs'
                            : isDark
                            ? 'border-[#303240] hover:border-white/25 bg-black/15'
                            : 'border-[#E6E6EC] hover:border-black/20 bg-white hover:bg-[#FAFBFD]'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center shadow-inner ring-1 ring-black/10 dark:ring-white/15"
                          style={{ backgroundColor: modeScale.brand }}
                        >
                          {active && (
                            <svg
                              className="w-3 h-3 text-white"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-[11px] whitespace-nowrap ${
                              active ? 'font-semibold text-[var(--brand-text)]' : 'font-medium'
                            }`}
                          >
                            {shortLabel}
                          </span>
                          {a.isOfficial && (
                            <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-[var(--brand-softStrong)] text-[var(--brand-text)] border border-[var(--brand-border)] leading-none shrink-0">
                              {t('officialBrandBadge')}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language & Profile Card — Flat Tiled Grid of All Languages (No Dropdown) */}
              <div className={`rounded-xl border p-4 space-y-4 ${cardSurface}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold">{t('languageLabel')}</div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {t('languageAutoFollowSub')} · {currentLangMeta.nativeName}
                      </div>
                    </div>
                  </div>

                  {/* Direct Tiled Grid of All Languages */}
                  <div
                    role="radiogroup"
                    aria-label={t('languageLabel')}
                    className="grid grid-cols-3 sm:grid-cols-4 gap-2"
                  >
                    {tiledLanguageOptions.map((langOpt) => {
                      const active = languagePref === langOpt.id;
                      return (
                        <button
                          key={langOpt.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => {
                            appActions.setLanguage(langOpt.id);
                            const meta =
                              langOpt.id === 'auto' ? null : getLanguageMeta(langOpt.id);
                            showToast(
                              meta
                                ? `${meta.nativeName} (${meta.englishName})`
                                : t('langAuto')
                            );
                          }}
                          style={
                            active
                              ? {
                                  backgroundColor: currentScale.brandSoft,
                                  borderColor: currentScale.brand,
                                  color: currentScale.brandText,
                                }
                              : undefined
                          }
                          className={`px-2.5 py-2 rounded-xl border text-start cursor-pointer transition-all ${
                            active
                              ? 'ring-1 ring-[var(--brand)] shadow-2xs font-semibold'
                              : isDark
                              ? 'border-[#303240] hover:border-[var(--brand-border)] bg-black/15'
                              : 'bg-white border-[#E5E5EA] hover:border-[var(--brand-border)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[12px] truncate leading-snug">
                              {langOpt.nativeName}
                            </span>
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-[#8E8E93] truncate mt-0.5">
                            {langOpt.subLabel}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-semibold">{t('nicknameLabel')}</div>
                    <div className={`text-[11px] ${subText} mt-0.5`}>
                      {t('activeProfileNameSub', {
                        name: dashboard.userName || t('defaultUser'),
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nicknameDraft}
                      onChange={(e) => setNicknameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          appActions.updatePreferences({ customNickname: nicknameDraft });
                          showToast(t('nicknameSavedToast'));
                        }
                      }}
                      placeholder={t('nicknamePlaceholder')}
                      className={`h-8 px-3 rounded-xl border text-[12px] w-36 focus:outline-none focus:border-[var(--brand)] ${
                        isDark ? 'bg-[#14141A] border-[#343444]' : 'bg-white border-[#E5E5EA]'
                      }`}
                    />
                    <button
                      onClick={() => {
                        appActions.updatePreferences({ customNickname: nicknameDraft });
                        showToast(t('nicknameSavedToast'));
                      }}
                      className="btn-primary !h-8 !px-3 !text-[12px]"
                    >
                      {t('saveNickname')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Dashboard Learning Tips Toggle */}
              <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${cardSurface}`}>
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold">{t('settingsShowTipsTitle')}</div>
                  <div className={`text-[11px] ${subText} leading-relaxed`}>
                    {t('settingsShowTipsSub')}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!tipsHiddenToday}
                  onClick={() => appActions.updatePreferences({ tipsHiddenOn: tipsHiddenToday ? '' : localDateKey() })}
                  style={!tipsHiddenToday ? { backgroundColor: currentScale.brand } : undefined}
                  className={`w-12 h-6.5 shrink-0 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                    !tipsHiddenToday ? '' : isDark ? 'bg-[#3A3A48]' : 'bg-[#E5E5EA]'
                  }`}
                >
                  <div
                    className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      !tipsHiddenToday ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Keyboard Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">
                  {t('settingsTabShortcuts')}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {t('settingsShortcutsSub')}
                </p>
              </div>

              {/* Toggle Switch Card: Show/Hide Shortcut Badges */}
              <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${cardSurface}`}>
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold">
                    {t('settingsShowShortcutBadgesTitle')}
                  </div>
                  <div className={`text-[11px] ${subText} leading-relaxed`}>
                    {t('settingsShowShortcutBadgesSub')}
                  </div>
                </div>

                {/* Apple-style Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={showShortcutHints}
                  onClick={() => {
                    const next = !showShortcutHints;
                    appActions.updatePreferences({ showShortcutHints: next });
                    showToast(
                      next
                        ? t('shortcutHintsEnabledToast')
                        : t('shortcutHintsDisabledToast')
                    );
                  }}
                  style={showShortcutHints ? { backgroundColor: currentScale.brand } : undefined}
                  className={`w-12 h-6.5 shrink-0 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                    showShortcutHints
                      ? ''
                      : isDark
                      ? 'bg-[#3A3A48]'
                      : 'bg-[#E5E5EA]'
                  }`}
                >
                  <div
                    className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      showShortcutHints ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Cheatsheet Grid */}
              <div className={`rounded-xl border p-4 space-y-4 ${cardSurface}`}>
                <div className="text-[13px] font-semibold">
                  {t('settingsCheatsheetTitle')}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] font-medium text-[var(--brand-text)] mb-1.5">
                      {t('settingsGroupGlobal')}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('cmdPaletteAriaLabel')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">
                          {formatShortcut('Cmd + K', envInfo.platform)}
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('quickAddBtn')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">N</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('syncNowAction')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">Y</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('nativeSwitch')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">{shortcutHint}</kbd>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-[var(--brand-text)] mb-1.5">
                      {t('navStudy')}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('showAnswerBtn')} / {t('rateGood')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">Space / Enter / 2</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('rateAgain')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">1</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('rateHard')} / {t('rateGood')} / {t('rateEasy')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">
                          {formatShortcut('Opt + 1~4', envInfo.platform)}
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('undoBtnShort')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">
                          {formatShortcut('Cmd + Z', envInfo.platform)}
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('pronounceBtn')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">R</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('editCardTitle')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">E</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AnkiWeb Sync */}
          {activeTab === 'sync' && (() => {
            const hasSynced = Boolean(lastSyncedTimestamp && lastSyncedTimestamp > 0);
            const syncVisualState: SyncVisualState = syncing
              ? 'syncing'
              : syncJustFinished
              ? 'justFinished'
              : hasSynced
              ? 'snapshot'
              : 'unsynced';
            const isoTimestamp = hasSynced ? new Date(lastSyncedTimestamp).toISOString() : undefined;

            return (
              <div className="space-y-5">
                <div>
                  <h3 className="text-[17px] font-bold tracking-tight">
                    {t('syncCloudTitle')}
                  </h3>
                  <p className={`text-[12px] ${subText} mt-0.5`}>
                    {t('settingsSyncTabSub')}
                  </p>
                </div>

                {/* Sync Status Card */}
                <div className={`rounded-xl border p-5 flex items-center justify-between gap-4 ${cardSurface}`}>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <SyncStateIcon state={syncVisualState} size="lg" />
                      {hasSynced ? (
                        <time dateTime={isoTimestamp} className="text-[14px] font-bold tabular-nums">
                          {relativeSync}
                        </time>
                      ) : (
                        <span className="text-[14px] font-bold">{relativeSync}</span>
                      )}
                    </div>
                    <div className={`text-[12px] ${subText}`}>{absSync}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => appActions.syncCollection()}
                    disabled={syncing}
                    className="btn-primary !h-10 !px-5 !text-[13px] shrink-0"
                  >
                    <span aria-hidden="true" className={syncing ? 'motion-safe:animate-spin' : ''}>⟳</span>
                    <span>{syncing ? t('syncing') : t('syncNowAction')}</span>
                  </button>
                </div>

                {/* Snapshot Sync Notice */}
                <div className={`rounded-xl border p-4 space-y-1.5 text-[12px] ${cardSurface}`}>
                  <div className="font-semibold text-[var(--brand-text)]">
                    {t('settingsOnDemandSyncTitle')}
                  </div>
                  <p className={`${subText} leading-relaxed`}>
                    {t('settingsOnDemandSyncBody')}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* TAB 3.5: Import / Export & System Maintenance Tools */}
          {activeTab === 'maintenance' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">
                  {t('settingsMaintTitle')}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {t('settingsMaintSub')}
                </p>
              </div>

              {/* Section 1: Import & Export (.apkg / .colpkg / .txt) */}
              <div className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">
                      {t('settingsImportExportCardTitle')}
                    </div>
                    <div className={`text-[11px] ${subText} mt-0.5`}>
                      {t('settingsImportExportCardSub')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => appActions.triggerNativeImport()}
                    className={`p-3.5 rounded-xl border text-start flex items-center justify-between cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#161720] border-[#2E303E] hover:border-[var(--brand)]'
                        : 'bg-white border-[#E5E5EA] hover:border-[var(--brand)]'
                    }`}
                  >
                    <div>
                      <div className="text-[13px] font-bold text-[var(--brand-text)]">
                        {t('settingsImportApkgTitle')}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {t('settingsImportApkgSub')}
                      </div>
                    </div>
                    <span className="text-[16px] text-[var(--brand-text)]">↓</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => appActions.triggerNativeExport()}
                    className={`p-3.5 rounded-xl border text-start flex items-center justify-between cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#161720] border-[#2E303E] hover:border-[var(--brand)]'
                        : 'bg-white border-[#E5E5EA] hover:border-[var(--brand)]'
                    }`}
                  >
                    <div>
                      <div className="text-[13px] font-bold">
                        {t('settingsExportApkgTitle')}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {t('settingsExportApkgSub')}
                      </div>
                    </div>
                    <span className="text-[16px] text-[#8E8E93]">↑</span>
                  </button>
                </div>
              </div>

              {/* Section 2: System Maintenance & Diagnostics */}
              <div className={`rounded-xl border p-4 space-y-3.5 ${cardSurface}`}>
                <div className="text-[13px] font-semibold">
                  {t('settingsDiagnosticsCardTitle')}
                </div>

                {/* Tool A: Check Database */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2.5 ${
                    isDark ? 'bg-[#161720] border-[#2C2E3C]' : 'bg-white border-[#EAECEF]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold">
                        1. {t('settingsCheckDbTitle')}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {t('settingsCheckDbSub')}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={runningTool === 'check_db'}
                      onClick={async () => {
                        setRunningTool('check_db');
                        const res = await appActions.runMaintenanceAction('check_db');
                        setDbReport(res);
                        setRunningTool(null);
                      }}
                      className="btn-secondary !h-8 !px-3.5 !text-[12px] shrink-0"
                    >
                      {runningTool === 'check_db' ? t('processingText') : t('settingsCheckDbBtn')}
                    </button>
                  </div>

                  {dbReport && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-[var(--status-success)] font-semibold">
                        ✓ {dbReport.message}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tool B: Empty Cards Check & Cleanup */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2.5 ${
                    isDark ? 'bg-[#161720] border-[#2C2E3C]' : 'bg-white border-[#EAECEF]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold">
                        2. {t('settingsEmptyCardsTitle')}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {t('settingsEmptyCardsSub')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {emptyReport && emptyReport.emptyCount > 0 && (
                        <button
                          type="button"
                          disabled={runningTool === 'clean_empty_cards'}
                          onClick={async () => {
                            setRunningTool('clean_empty_cards');
                            const res = await appActions.runMaintenanceAction('clean_empty_cards');
                            setEmptyReport(res);
                            setRunningTool(null);
                          }}
                          className="h-8 px-3 rounded-xl bg-[var(--status-danger)] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          {t('batchDelete')} ({emptyReport.emptyCount})
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={runningTool === 'check_empty_cards'}
                        onClick={async () => {
                          setRunningTool('check_empty_cards');
                          const res = await appActions.runMaintenanceAction('check_empty_cards');
                          setEmptyReport(res);
                          setRunningTool(null);
                        }}
                        className="btn-secondary !h-8 !px-3.5 !text-[12px]"
                      >
                        {runningTool === 'check_empty_cards'
                          ? t('processingText')
                          : t('settingsScanEmptyBtn')}
                      </button>
                    </div>
                  </div>

                  {emptyReport && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 text-[11px] flex items-center justify-between">
                      <span
                        className={
                          emptyReport.emptyCount > 0
                            ? 'text-[var(--status-warning)] font-semibold'
                            : 'text-[var(--status-success)] font-semibold'
                        }
                      >
                        {emptyReport.emptyCount > 0 ? '● ' : '✓ '}
                        {emptyReport.message}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tool C: Media Check & Unused Cleanup */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2.5 ${
                    isDark ? 'bg-[#161720] border-[#2C2E3C]' : 'bg-white border-[#EAECEF]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold">
                        3. {t('settingsCheckMediaTitle')}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {t('settingsCheckMediaSub')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {mediaReport && mediaReport.unusedCount > 0 && (
                        <button
                          type="button"
                          disabled={runningTool === 'clean_unused_media'}
                          onClick={async () => {
                            setRunningTool('clean_unused_media');
                            const res = await appActions.runMaintenanceAction('clean_unused_media');
                            setMediaReport(res);
                            setRunningTool(null);
                          }}
                          className="h-8 px-3 rounded-xl bg-[var(--status-danger)] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          {t('batchDelete')} ({mediaReport.unusedCount})
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={runningTool === 'check_media'}
                        onClick={async () => {
                          setRunningTool('check_media');
                          const res = await appActions.runMaintenanceAction('check_media');
                          setMediaReport(res);
                          setRunningTool(null);
                        }}
                        className="btn-secondary !h-8 !px-3.5 !text-[12px]"
                      >
                        {runningTool === 'check_media'
                          ? t('processingText')
                          : t('settingsCheckMediaBtn')}
                      </button>
                    </div>
                  </div>

                  {mediaReport && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 text-[11px] space-y-1">
                      <div
                        className={
                          mediaReport.unusedCount > 0 || mediaReport.missingCount > 0
                            ? 'text-[var(--status-warning)] font-semibold'
                            : 'text-[var(--status-success)] font-semibold'
                        }
                      >
                        {mediaReport.unusedCount > 0 || mediaReport.missingCount > 0 ? '● ' : '✓ '}
                        {mediaReport.message}
                      </div>
                      {Array.isArray(mediaReport.unusedFiles) && mediaReport.unusedFiles.length > 0 && (
                        <div className={`${subText} truncate`}>
                          {mediaReport.unusedFiles.slice(0, 5).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Native Anki */}
          {activeTab === 'native' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight text-[var(--status-danger)]">
                  {t('settingsTabNative')}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {t('settingsNativeSub')}
                </p>
              </div>

              {/* Switch Action Card */}
              <div className={`rounded-xl border p-5 flex items-center justify-between ${cardSurface}`}>
                <div>
                  <div className="text-[14px] font-bold">{t('settingsSwitchNativeCardTitle')}</div>
                  <div className={`text-[12px] ${subText} mt-0.5`}>
                    {t('settingsSwitchNativeCardSub')}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAppState({ settingsOpen: false });
                    appActions.triggerNativeEscape();
                  }}
                  className="h-10 px-4 rounded-xl border border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-soft)] text-[12px] font-semibold cursor-pointer transition-colors"
                >
                  {t('switchToNative')}
                </button>
              </div>

              {/* Concise Return Tip */}
              <div className={`rounded-xl border p-4 space-y-1.5 text-[12px] ${cardSurface}`}>
                <div className="text-[13px] font-semibold text-[var(--brand-text)] flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[var(--brand-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                    <path d="M9 18h6M10 22h4" />
                  </svg>
                  <span>{t('settingsHowToReturnTitle')}</span>
                </div>
                <p className={`${subText} leading-relaxed`}>
                  {t('settingsHowToReturnBody', { key: shortcutHint })}
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: About Anki Studio */}
          {activeTab === 'about' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">
                  {t('settingsTabAbout')} · Anki Studio
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {t('settingsAboutSub')}
                </p>
              </div>

              {/* Version Card */}
              <div className={`rounded-xl border p-5 flex items-center gap-4 ${cardSurface}`}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs border border-black/5 dark:border-white/10 bg-black/[0.025] dark:bg-white/[0.05]">
                  <AnkiStudioLogo size={30} />
                </div>
                <div>
                  <div className="text-[16px] font-bold">Anki Studio</div>
                  <div className={`text-[12px] ${subText} mt-0.5`}>
                    Version {envInfo.studioVersion || '1.4'} · {envInfo.platformBadge} · FSRS Ready
                  </div>
                </div>
              </div>

              {/* Highlights Card */}
              <div className={`rounded-xl border p-4 ${cardSurface}`}>
                <p className={`text-[12px] ${subText} leading-relaxed`}>
                  {t('aboutHighlights')}
                </p>
              </div>

              {/* Follow & Feedback */}
              <div className={`rounded-xl border p-4 space-y-2 ${cardSurface}`}>
                <div className="font-semibold text-[12px] text-[var(--brand-text)]">
                  {t('aboutLinksTitle')}
                </div>
                {[
                  { key: 'aboutXiaohongshu', url: XIAOHONGSHU_PROFILE_URL, primary: true },
                  { key: 'aboutGithub', url: GITHUB_REPO_URL, primary: false },
                ].map((link) => (
                  <button
                    key={link.key}
                    type="button"
                    onClick={() => openExternal(link.url)}
                    className={`w-full h-9 px-3 rounded-lg border text-[12px] font-medium flex items-center justify-between gap-2 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                      link.primary
                        ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)] hover:opacity-90'
                        : isDark
                        ? 'border-white/[0.08] bg-white/[0.03] text-[#E8E8F0] hover:bg-white/[0.07]'
                        : 'border-[#E5E5EA] bg-[#FAFAFC] text-[#3A3A3C] hover:bg-[#F1F1F5]'
                    }`}
                  >
                    <span>{t(link.key)}</span>
                    <span className="text-[10px] opacity-60" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                ))}
              </div>

              {/* Privacy & Analytics Card */}
              <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${cardSurface}`}>
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold">{t('settingsAnalyticsTitle')}</div>
                  <div className={`text-[11px] ${subText} leading-relaxed`}>
                    {t('settingsAnalyticsSub')}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analyticsEnabled}
                  onClick={() => appActions.updatePreferences({ analyticsEnabled: !analyticsEnabled })}
                  style={analyticsEnabled ? { backgroundColor: currentScale.brand } : undefined}
                  className={`w-12 h-6.5 shrink-0 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                    analyticsEnabled ? '' : isDark ? 'bg-[#3A3A48]' : 'bg-[#E5E5EA]'
                  }`}
                >
                  <div
                    className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      analyticsEnabled ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Philosophy Card */}
              <div className={`rounded-xl border p-4 space-y-2 text-[12px] ${cardSurface}`}>
                <div className="font-semibold text-[var(--brand-text)]">
                  {t('settingsPhilosophyTitle')}
                </div>
                <p className={`${subText} leading-relaxed`}>
                  {t('settingsPhilosophyBody')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
