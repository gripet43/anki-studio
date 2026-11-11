import React, { useEffect, useState } from 'react';
import { AnkiStudioLogo } from '../common/AnkiStudioLogo';
import { SyncStateIcon, SyncVisualState } from '../common/SyncStateIcon';
import {
  formatAbsoluteSyncTooltip,
  formatRelativeSyncLabel,
  formatShortcut,
  LanguageOption,
  translate,
} from '../../i18n/translations';
import {
  appActions,
  setAppState,
  showToast,
  ThemeMode,
  useAppStore,
} from '../../stores/useAppStore';
import { ACCENT_COLOR_LIST, ACCENT_THEMES, getAccentScale } from '../../utils/themeTokens';

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
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsInitialTab || 'appearance');
  const [nicknameDraft, setNicknameDraft] = useState(customNickname || '');
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [dbReport, setDbReport] = useState<any | null>(null);
  const [emptyReport, setEmptyReport] = useState<any | null>(null);
  const [mediaReport, setMediaReport] = useState<any | null>(null);

  const isZh = resolvedLang === 'zh-CN';
  const isDark = theme === 'dark' || theme === 'oled';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

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

  if (!settingsOpen) return null;

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

  const subText = 'text-[#8E8E93]';
  const shortcutHint = formatShortcut('Ctrl + Opt + M', envInfo.platform);
  const currentAccentMeta = ACCENT_THEMES[accentColor] || ACCENT_THEMES.indigo;
  const currentScale = getAccentScale(accentColor, theme);

  const themeOptions: Array<{ id: ThemeMode; label: string; desc: string }> = [
    { id: 'light', label: t('themeLight'), desc: isZh ? '柔和纸感 · 低眩光' : 'Warm paper contrast' },
    { id: 'dark', label: t('themeDark'), desc: isZh ? 'Linear 级深灰层次' : 'Linear slate elevation' },
    { id: 'oled', label: t('themeOled'), desc: isZh ? '纯粹深邃黑 · 夜间沉浸' : 'True pitch dark' },
  ];

  const languageOptions: Array<{ id: LanguageOption; label: string }> = [
    { id: 'auto', label: t('langAuto') },
    { id: 'zh-CN', label: t('langZh') },
    { id: 'en', label: t('langEn') },
  ];

  const tabs: Array<{ id: SettingsTab; icon: React.ReactNode; label: string }> = [
    {
      id: 'appearance',
      label: isZh ? '外观与显示' : 'Appearance',
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
      label: isZh ? '快捷键' : 'Shortcuts',
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
        </svg>
      ),
    },
    {
      id: 'sync',
      label: isZh ? '云端同步' : 'Sync',
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      ),
    },
    {
      id: 'maintenance',
      label: isZh ? '数据与维护' : 'Data & Tools',
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
      label: isZh ? '原生模式' : 'Native Anki',
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        </svg>
      ),
    },
    {
      id: 'about',
      label: isZh ? '关于' : 'About',
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
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[5px] flex items-center justify-center p-6 select-none modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-label={isZh ? '系统偏好设置' : 'Preferences'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-[800px] h-[560px] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.35)] flex overflow-hidden transition-colors relative ${modalSurface}`}
      >
        {/* Top Right Close Button */}
        <button
          type="button"
          onClick={() => setAppState({ settingsOpen: false })}
          className={`absolute top-4 right-4 z-20 w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
            isDark ? 'text-[#8E8E93] hover:text-white hover:bg-white/10' : 'text-[#8E8E93] hover:text-black hover:bg-black/5'
          }`}
          title={isZh ? '关闭 (Esc)' : 'Close (Esc)'}
          aria-label={isZh ? '关闭' : 'Close'}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Left Settings Sidebar (Apple System Settings 2-Column Architecture) */}
        <div className={`w-[210px] shrink-0 border-r p-3.5 flex flex-col ${sidebarBg}`}>
          <div className="space-y-4">
            {/* Header */}
            <div className="px-3 pt-2">
              <h2 className="text-[16px] font-bold tracking-tight">
                {isZh ? '系统设置' : 'Preferences'}
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer text-left ${
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
                  {isZh ? '外观与显示' : 'Appearance & Display'}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {isZh
                    ? '基于现代 SaaS 感知色彩科学（LCH 低饱和护眼调校），全局实时联动'
                    : 'Calibrated low-saturation SaaS color tokens across light & dark modes'}
                </p>
              </div>

              {/* Theme Mode Card */}
              <div className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="text-[13px] font-semibold">{isZh ? '外观模式' : 'Theme Mode'}</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {themeOptions.map((opt) => {
                    const active = theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          appActions.setTheme(opt.id);
                          showToast(isZh ? `已切换为「${opt.label}」模式` : `Theme: ${opt.label}`);
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
                        className={`py-2.5 px-3 rounded-xl border text-left cursor-pointer transition-all ${
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
                  {isZh ? '主题色' : 'Theme Color'}
                </div>

                <div
                  role="radiogroup"
                  aria-label={isZh ? '主题色' : 'Theme Color'}
                  className="grid grid-cols-4 gap-2.5"
                >
                  {ACCENT_COLOR_LIST.map((a) => {
                    const active = accentColor === a.id;
                    const modeScale = isDark ? a.dark : a.light;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={isZh ? a.nameZh : a.nameEn}
                        title={isZh ? `${a.nameZh} · ${a.descZh}` : `${a.nameEn} · ${a.descEn}`}
                        onClick={() => {
                          appActions.setAccentColor(a.id);
                          showToast(
                            isZh ? `已切换强调色：${a.shortNameZh}` : `Accent: ${a.shortNameEn}`
                          );
                        }}
                        style={
                          active
                            ? {
                                backgroundColor: modeScale.brandSoft,
                                borderColor: modeScale.brand,
                              }
                            : undefined
                        }
                        className={`px-2.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-left relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
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
                            {isZh ? a.shortNameZh : a.shortNameEn}
                          </span>
                          {a.isOfficial && (
                            <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-[var(--brand-softStrong)] text-[var(--brand-text)] border border-[var(--brand-border)] leading-none shrink-0">
                              {isZh ? '官方' : 'Brand'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language & Profile Card */}
              <div className={`rounded-xl border p-4 space-y-4 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">{t('languageLabel')}</div>
                    <div className={`text-[11px] ${subText} mt-0.5`}>
                      {isZh ? '界面显示语言' : 'Interface language'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {languageOptions.map((langOpt) => {
                      const active = languagePref === langOpt.id;
                      return (
                        <button
                          key={langOpt.id}
                          onClick={() => {
                            appActions.setLanguage(langOpt.id);
                            showToast(langOpt.id === 'en' ? 'Language: English' : '界面语言已更新');
                          }}
                          style={active ? { backgroundColor: currentScale.brand, borderColor: currentScale.brand } : undefined}
                          className={`px-3 py-1.5 rounded-xl border text-[12px] font-medium cursor-pointer transition-colors ${
                            active
                              ? 'text-white'
                              : isDark
                              ? 'border-[#343444] hover:border-[var(--brand-border)]'
                              : 'bg-white border-[#E5E5EA] hover:border-[var(--brand-border)]'
                          }`}
                        >
                          {langOpt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-semibold">{isZh ? '问候昵称' : 'Nickname'}</div>
                    <div className={`text-[11px] ${subText} mt-0.5`}>
                      {isZh ? `当前账户: ${dashboard.userName || '学习者'}` : 'Greeting display name'}
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
                          showToast(isZh ? '个人昵称已保存' : 'Nickname saved');
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
                        showToast(isZh ? '个人昵称已保存' : 'Nickname saved');
                      }}
                      className="btn-primary !h-8 !px-3 !text-[12px]"
                    >
                      {t('saveNickname')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Keyboard Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">
                  {isZh ? '快捷键' : 'Keyboard Shortcuts'}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {isZh ? '界面按键提示配置与全键盘操作速查' : 'Shortcut display preference and cheatsheet'}
                </p>
              </div>

              {/* Toggle Switch Card: Show/Hide Shortcut Badges */}
              <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${cardSurface}`}>
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold">
                    {isZh ? '在界面按钮上显示按键提示角标' : 'Show keyboard shortcut badges'}
                  </div>
                  <div className={`text-[11px] ${subText} leading-relaxed`}>
                    {isZh
                      ? '开启后在搜索框、操作按钮上显示按键角标；关闭后界面更清爽纯净，适合鼠标用户。关闭后所有按键依然始终生效。'
                      : 'Display hotkey hints on buttons and search inputs. When disabled, the UI remains minimal and clean for mouse users.'}
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
                      isZh
                        ? next
                          ? '已开启按钮快捷键角标'
                          : '已开启清爽模式（隐藏按钮角标）'
                        : `Shortcut hints ${next ? 'enabled' : 'disabled'}`
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
                  {isZh ? '常用快捷键速查' : 'Key Shortcuts Cheatsheet'}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] font-medium text-[var(--brand-text)] mb-1.5">
                      {isZh ? '全局导航' : 'Global'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '全局检索' : 'Global Search'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">Cmd + K</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '快速制卡' : 'Quick Add'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">N</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '云端同步' : 'Sync AnkiWeb'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">Y</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '原生模式切换' : 'Toggle Native UI'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">{shortcutHint}</kbd>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-[var(--brand-text)] mb-1.5">
                      {isZh ? '卡片学习' : 'Review'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '显示答案 / 记得' : 'Show Answer / Good'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">Space / Enter</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '遗忘 (Again)' : 'Again'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">1</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '展开四档评分' : '4-Level Ratings'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">{isZh ? '按住 Option' : 'Hold Option'}</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '撤销上一张复习' : 'Undo Review'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">Cmd + Z</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '发音与朗读' : 'Replay Audio'}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">R</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{isZh ? '卡片行内编辑' : 'Inline Edit'}</span>
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
                    {isZh ? '云端同步' : 'AnkiWeb Sync'}
                  </h3>
                  <p className={`text-[12px] ${subText} mt-0.5`}>
                    {isZh
                      ? '按需与 AnkiWeb 官方云端双向同步本地学习进度与卡片'
                      : 'Sync local study progress and cards with AnkiWeb on demand'}
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
                    <span>{syncing ? t('syncing') : isZh ? '立即同步' : 'Sync Now'}</span>
                  </button>
                </div>

                {/* Snapshot Sync Notice */}
                <div className={`rounded-xl border p-4 space-y-1.5 text-[12px] ${cardSurface}`}>
                  <div className="font-semibold text-[var(--brand-text)]">
                    {isZh ? '按需双向快照同步' : 'On-Demand Snapshot Sync'}
                  </div>
                  <p className={`${subText} leading-relaxed`}>
                    {isZh
                      ? '启动时自动检测同步，并支持随时点击或按 Y 键触发双向对齐。所有本地练习与编辑都会实时写入 SQLite 数据库，但跨设备进度需再次同步后生效。'
                      : 'Checks on launch and syncs two-way on demand or via shortcut Y. Local edits save immediately to SQLite; sync again to align across devices.'}
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
                  {isZh ? '数据导入/导出与系统维护' : 'Import / Export & Maintenance'}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {isZh
                    ? '管理 .apkg / .colpkg 牌组包导入导出，以及数据库校验、空白卡片与冗余媒体清理'
                    : 'Import or export .apkg packages, verify SQLite integrity, and clean empty cards or unused media'}
                </p>
              </div>

              {/* Section 1: Import & Export (.apkg / .colpkg / .txt) */}
              <div className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">
                      {isZh ? '牌组包导入与集合导出' : 'Import & Export Packages'}
                    </div>
                    <div className={`text-[11px] ${subText} mt-0.5`}>
                      {isZh
                        ? '直接调用 Anki 原生文件引擎，完整支持 .apkg、.colpkg 及 CSV/TXT 词表'
                        : 'Full compatibility with .apkg decks, .colpkg backups, and text/CSV files'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => appActions.triggerNativeImport()}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#161720] border-[#2E303E] hover:border-[var(--brand)]'
                        : 'bg-white border-[#E5E5EA] hover:border-[var(--brand)]'
                    }`}
                  >
                    <div>
                      <div className="text-[13px] font-bold text-[var(--brand-text)]">
                        {isZh ? '导入卡片包 (.apkg)' : 'Import Package (.apkg)'}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {isZh ? '从本地导入第三方牌组或备份' : 'Import deck package or text file'}
                      </div>
                    </div>
                    <span className="text-[16px] text-[var(--brand-text)]">↓</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => appActions.triggerNativeExport()}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#161720] border-[#2E303E] hover:border-[var(--brand)]'
                        : 'bg-white border-[#E5E5EA] hover:border-[var(--brand)]'
                    }`}
                  >
                    <div>
                      <div className="text-[13px] font-bold">
                        {isZh ? '导出牌组 / 集合备份' : 'Export Deck / Backup'}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {isZh ? '打包分享牌组或导出含进度备份' : 'Export .apkg deck or .colpkg backup'}
                      </div>
                    </div>
                    <span className="text-[16px] text-[#8E8E93]">↑</span>
                  </button>
                </div>
              </div>

              {/* Section 2: System Maintenance & Diagnostics */}
              <div className={`rounded-xl border p-4 space-y-3.5 ${cardSurface}`}>
                <div className="text-[13px] font-semibold">
                  {isZh ? '系统维护与健康诊断' : 'System Maintenance & Diagnostics'}
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
                        {isZh ? '1. 检查并优化数据库 (Check Database)' : '1. Check & Optimize Database'}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {isZh
                          ? '执行 SQLite 完整性校验与索引重构 (ANALYZE)，确保学习记录安全无损'
                          : 'Verify SQLite integrity and rebuild query statistics'}
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
                      {runningTool === 'check_db'
                        ? isZh
                          ? '检查中...'
                          : 'Checking...'
                        : isZh
                        ? '立即检查'
                        : 'Check DB'}
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
                        {isZh ? '2. 清理空白与失效卡片 (Empty Cards)' : '2. Scan & Clean Empty Cards'}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {isZh
                          ? '扫描正面为空或删减 Cloze 挖空序号后遗留的空白子卡片'
                          : 'Detect and clean blank cards or orphaned Cloze sibling cards'}
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
                          {isZh
                            ? `清理 ${emptyReport.emptyCount} 张空卡`
                            : `Clean ${emptyReport.emptyCount}`}
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
                          ? isZh
                            ? '扫描中...'
                            : 'Scanning...'
                          : isZh
                          ? '扫描空卡'
                          : 'Scan Empty'}
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
                        {isZh ? '3. 媒体文件检查与冗余清理 (Check Media)' : '3. Check Media & Unused Files'}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {isZh
                          ? '比对 collection.media 目录与卡片引用，定位未使用的孤立图片/音频或缺失文件'
                          : 'Compare collection.media against note fields for unused or missing files'}
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
                          {isZh
                            ? `清理 ${mediaReport.unusedCount} 个冗余文件`
                            : `Clean ${mediaReport.unusedCount} Unused`}
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
                          ? isZh
                            ? '扫描中...'
                            : 'Scanning...'
                          : isZh
                          ? '检查媒体'
                          : 'Check Media'}
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
                          {isZh ? '未引用示例：' : 'Unused sample: '}
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
                  {isZh ? '原生模式' : 'Native Interface'}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {isZh ? '临时切换至 Anki 原生界面' : 'Temporarily switch to native Anki UI'}
                </p>
              </div>

              {/* Switch Action Card */}
              <div className={`rounded-xl border p-5 flex items-center justify-between ${cardSurface}`}>
                <div>
                  <div className="text-[14px] font-bold">{isZh ? '切回 Anki 原生界面' : 'Switch to Native UI'}</div>
                  <div className={`text-[12px] ${subText} mt-0.5`}>
                    {isZh ? '随时可以一键返回 Anki Studio' : 'All progress is preserved, return anytime'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAppState({ settingsOpen: false });
                    appActions.triggerNativeEscape();
                  }}
                  className="h-10 px-4 rounded-xl border border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-soft)] text-[12px] font-semibold cursor-pointer transition-colors"
                >
                  {isZh ? '立即切换回原生' : 'Switch to Native'}
                </button>
              </div>

              {/* Concise Return Tip */}
              <div className={`rounded-xl border p-4 space-y-1.5 text-[12px] ${cardSurface}`}>
                <div className="text-[13px] font-semibold text-[var(--brand-text)] flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[var(--brand-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                    <path d="M9 18h6M10 22h4" />
                  </svg>
                  <span>{isZh ? '如何随时返回 Anki Studio？' : 'How to return anytime:'}</span>
                </div>
                <p className={`${subText} leading-relaxed`}>
                  {isZh
                    ? `切回原生后，随时点击顶部工具栏的「进入 Anki Studio」胶囊按钮，或按下快捷键 ${shortcutHint}，即可秒级重返现代界面。`
                    : `In native UI, click the top toolbar "Anki Studio" button or press ${shortcutHint} to return instantly.`}
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: About Anki Studio */}
          {activeTab === 'about' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">
                  {isZh ? '关于 Anki Studio' : 'About Anki Studio'}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {isZh ? '系统版本与设计理念' : 'Version info and philosophy'}
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
                    Version 1.3.0 · {envInfo.platformBadge} · FSRS Ready
                  </div>
                </div>
              </div>

              {/* Philosophy Card */}
              <div className={`rounded-xl border p-4 space-y-2 text-[12px] ${cardSurface}`}>
                <div className="font-semibold text-[var(--brand-text)]">
                  {isZh ? '简约而不简单' : 'Simple Yet Powerful'}
                </div>
                <p className={`${subText} leading-relaxed`}>
                  {isZh
                    ? '去除冗杂的界面噪音，将快捷操作与核心功能收拢于无形。专为专注记忆与高效心流打造，兼顾鼠标的顺畅直觉与键盘的极速响应。'
                    : 'Designed for deep focus and effortless flow. Eliminates interface clutter while keeping complete memory mastery at your fingertips.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
