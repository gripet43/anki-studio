import React, { useEffect, useState } from 'react';
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

type SettingsTab = 'appearance' | 'shortcuts' | 'sync' | 'native' | 'about';

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
    lastSyncedTimestamp,
    settingsInitialTab,
    envInfo,
    showShortcutHints,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsInitialTab || 'appearance');
  const [nicknameDraft, setNicknameDraft] = useState(customNickname || '');

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
      onClick={() => setAppState({ settingsOpen: false })}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[5px] flex items-center justify-center p-6 select-none modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-label={isZh ? '系统偏好设置' : 'Preferences'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-[800px] h-[560px] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.35)] flex overflow-hidden transition-colors ${modalSurface}`}
      >
        {/* Left Settings Sidebar (Apple System Settings 2-Column Architecture) */}
        <div className={`w-[210px] shrink-0 border-r p-3.5 flex flex-col justify-between ${sidebarBg}`}>
          <div className="space-y-4">
            {/* Header */}
            <div className="px-3 pt-2">
              <h2 className="text-[16px] font-bold tracking-tight">
                {isZh ? '系统设置' : 'Preferences'}
              </h2>
              <div className={`text-[11px] ${subText} mt-0.5`}>
                {envInfo.platformBadge}
              </div>
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

          {/* Close button at bottom */}
          <div className="px-1 pt-3 border-t border-black/5 dark:border-white/5">
            <button
              onClick={() => setAppState({ settingsOpen: false })}
              className={`w-full py-1.5 rounded-lg border text-[12px] font-medium text-center transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#2E2E3C] text-[#8E8E93] hover:text-white'
                  : 'border-[#E5E5EA] text-[#6E6E73] hover:text-black'
              }`}
            >
              {isZh ? '完成 (Esc)' : 'Done (Esc)'}
            </button>
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

              {/* 8 Curated Modern SaaS Accent Colors Card */}
              <div className={`rounded-xl border p-4 space-y-3.5 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">
                      {isZh ? '现代 SaaS 强调色系统' : 'Curated SaaS Accent Palette'}
                    </div>
                    <div className={`text-[11px] ${subText} mt-0.5`}>
                      {isZh
                        ? `当前选中：${currentAccentMeta.nameZh} · ${currentAccentMeta.descZh}`
                        : `Active: ${currentAccentMeta.nameEn} · ${currentAccentMeta.descEn}`}
                    </div>
                  </div>
                  {/* Live mini preview of the 4-level heatmap & soft badge */}
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)]">
                      {isZh ? '全局色阶预览' : 'Scale Preview'}
                    </span>
                    {currentScale.heatmap.map((hmHex, idx) => (
                      <span
                        key={idx}
                        className="w-3 h-3 rounded-[3px]"
                        style={{ backgroundColor: hmHex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {ACCENT_COLOR_LIST.map((a) => {
                    const active = accentColor === a.id;
                    const modeScale = isDark ? a.dark : a.light;
                    const label = isZh ? a.nameZh : a.nameEn;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          appActions.setAccentColor(a.id);
                          showToast(isZh ? `已切换全局强调色：${a.nameZh}` : `Accent: ${a.nameEn}`);
                        }}
                        style={
                          active
                            ? {
                                backgroundColor: modeScale.brandSoft,
                                borderColor: modeScale.brand,
                              }
                            : undefined
                        }
                        className={`px-2.5 py-2 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all text-left ${
                          active
                            ? 'ring-1 ring-[var(--brand)] shadow-xs'
                            : isDark
                            ? 'border-[#303240] hover:border-white/20 bg-black/15'
                            : 'border-[#E6E6EC] hover:border-black/20 bg-white'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center shadow-inner"
                          style={{ backgroundColor: modeScale.brand }}
                        >
                          {active && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span
                          className={`text-[11px] truncate ${
                            active ? 'font-semibold text-[var(--brand-text)]' : 'font-medium'
                          }`}
                        >
                          {label}
                        </span>
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
          {activeTab === 'sync' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">
                  {isZh ? '云端同步' : 'AnkiWeb Sync'}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {isZh ? '与 AnkiWeb 官方云端实时同步学习进度' : 'Synchronize progress with AnkiWeb cloud'}
                </p>
              </div>

              {/* Sync Status Card */}
              <div className={`rounded-xl border p-5 flex items-center justify-between ${cardSurface}`}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-success)]" />
                    <span className="text-[14px] font-bold">{relativeSync}</span>
                  </div>
                  <div className={`text-[12px] ${subText}`}>{absSync}</div>
                </div>

                <button
                  type="button"
                  onClick={() => appActions.syncCollection()}
                  disabled={syncing}
                  className="btn-primary !h-10 !px-5 !text-[13px]"
                >
                  <span className={syncing ? 'animate-spin' : ''}>⟳</span>
                  <span>{syncing ? t('syncing') : isZh ? '立即同步' : 'Sync Now'}</span>
                </button>
              </div>

              {/* Automatic Sync Notice */}
              <div className={`rounded-xl border p-4 space-y-1.5 text-[12px] ${cardSurface}`}>
                <div className="font-semibold text-[var(--brand-text)]">
                  {isZh ? '静默安全同步机制' : 'Silent & Safe Sync'}
                </div>
                <p className={`${subText} leading-relaxed`}>
                  {isZh
                    ? '启动时自动检测同步，并在后台静默监听集合变动，保证多端进度实时一致、数据安全无缝。'
                    : 'Syncs automatically on launch and listens for background database updates in real-time.'}
                </p>
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
                <div
                  style={{ backgroundColor: currentScale.brand }}
                  className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-xl shadow-md"
                >
                  S
                </div>
                <div>
                  <div className="text-[16px] font-bold">Anki Studio</div>
                  <div className={`text-[12px] ${subText} mt-0.5`}>
                    Version 1.0.0 · {envInfo.platformBadge} · FSRS Ready
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
