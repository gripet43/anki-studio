import React, { useEffect, useId, useRef, useState } from 'react';
import { AnkiStudioLogo } from '../common/AnkiStudioLogo';
import { Tooltip } from '../common/Tooltip';
import { SyncStateIcon, SyncVisualState } from '../common/SyncStateIcon';
import { UserAvatar } from '../common/UserAvatar';
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
import {
  AVATAR_PRESET_IDS,
  AvatarPresetId,
  callAnki,
  isAnkiNativeEnv,
  REVIEW_CONTENT_SCALES,
  ReviewStageWidth,
} from '../../bridge/pycmd';
import {
  AVATAR_IMAGE_ACCEPT,
  isDefaultCustomAvatar,
  normalizeCustomAvatarConfig,
} from '../../utils/avatarImage';
import {
  ACCENT_COLOR_LIST,
  getAccentScale,
  resolveThemeMode,
} from '../../utils/themeTokens';
import { hasIllustrationPack } from '../common/ThemeIllustrations';
import { getEffectiveDayKey } from '../../utils/localDate';

const XIAOHONGSHU_PROFILE_URL =
  'https://www.xiaohongshu.com/user/profile/6496d6f8000000001001ff0f';
const GITHUB_REPO_URL = 'https://github.com/gripet43/anki-studio';
const ANKIWEB_ADDON_URL =
  'https://ankiweb.net/shared/info/1071937836?cb=1794962974753';

type SettingsTab = 'appearance' | 'answer' | 'shortcuts' | 'sync' | 'maintenance' | 'native' | 'about';

export const SettingsModal: React.FC = () => {
  const {
    settingsOpen,
    theme,
    systemDark,
    accentColor,
    languagePref,
    resolvedLang,
    customNickname,
    customAvatar,
    dashboard,
    syncing,
    syncJustFinished,
    lastSyncedTimestamp,
    settingsInitialTab,
    envInfo,
    showShortcutHints,
    tipsHiddenOn,
    analyticsEnabled,
    answerButtonMode,
    autoPlayFrontAudio,
    autoPlayBackAudio,
    reviewStageWidth,
    reviewContentScale,
    dayBoundary,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsInitialTab || 'appearance');
  const [nicknameDraft, setNicknameDraft] = useState(customNickname || '');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [dbReport, setDbReport] = useState<any | null>(null);
  const [emptyReport, setEmptyReport] = useState<any | null>(null);
  const [mediaReport, setMediaReport] = useState<any | null>(null);

  const resolvedTheme = resolveThemeMode(theme, systemDark);
  const isDark = resolvedTheme === 'dark';
  const effectiveDayKey = getEffectiveDayKey(dayBoundary);
  const tipsHiddenToday = tipsHiddenOn === effectiveDayKey;
  const aboutHeadingId = useId();
  const analyticsSwitchId = useId();
  const analyticsDescId = useId();
  const supportsNativeSwitch =
    typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
  const studioVersion = envInfo.studioVersion || '1.6.10';
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

  const modalSurface = isDark
    ? 'bg-[#181920] border-[#2C2E3A] text-white'
    : 'bg-white border-[#E5E5EA] text-[#1D1D1F]';

  const cardSurface = isDark
    ? 'bg-[#1F212A] border-[#2E303D]'
    : 'bg-[#F9F9FB] border-[#ECECF2]';

  const sidebarBg = isDark
    ? 'bg-[#13141A] border-[#252732]'
    : 'bg-[#F5F5F7] border-[#E8E8ED]';

  const subText = 'text-[#636366] dark:text-[#A6A8B6]';
  const shortcutHint = formatShortcut('Ctrl + Opt + M', envInfo.platform);
  const currentScale = getAccentScale(accentColor, resolvedTheme);
  const systemModeLabel = systemDark ? t('themeDark') : t('themeLight');
  const userDisplay = dashboard.userName || t('defaultUser');
  const normalizedAvatar = normalizeCustomAvatarConfig(customAvatar);
  const isDefaultAvatar = isDefaultCustomAvatar(normalizedAvatar);

  const handleSelectInitialAvatar = () => {
    void appActions.updatePreferences({ customAvatar: { kind: 'initial' } });
  };

  const handleSelectPresetAvatar = (presetId: AvatarPresetId) => {
    void appActions.updatePreferences({
      customAvatar: { kind: 'preset', presetId },
    });
  };

  const handleResetAvatar = () => {
    void appActions.updatePreferences({ customAvatar: { kind: 'initial' } });
  };

  const handlePickAvatarImage = async () => {
    if (avatarBusy) return;
    if (!isAnkiNativeEnv()) {
      avatarFileInputRef.current?.click();
      return;
    }
    setAvatarBusy(true);
    try {
      await appActions.pickNativeAvatarImage(() => {
        avatarFileInputRef.current?.click();
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      await appActions.saveAvatarFromImageSource(file);
    } finally {
      setAvatarBusy(false);
    }
  };

  const themeOptions: Array<{ id: ThemeMode; label: string; desc: string }> = [
    { id: 'auto', label: t('themeAuto'), desc: t('themeAutoDesc', { mode: systemModeLabel }) },
    { id: 'light', label: t('themeLight'), desc: t('themeLightDesc') },
    { id: 'dark', label: t('themeDark'), desc: t('themeDarkDesc') },
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
      id: 'answer',
      label: t('settingsTabAnswer'),
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
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
        <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
          <button
            type="button"
            onClick={() => setAppState({ settingsOpen: false })}
            className={`absolute top-4 end-4 z-20 w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              isDark ? 'text-[#8E8E93] hover:text-white hover:bg-white/10' : 'text-[#8E8E93] hover:text-black hover:bg-black/5'
            }`}
            aria-label={t('close')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </Tooltip>

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
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold">
                    {t('settingsThemeColorTitle')}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                      hasIllustrationPack(accentColor)
                        ? 'bg-[var(--brand-soft)] border-[var(--brand-border)] text-[var(--brand-text)]'
                        : isDark
                        ? 'bg-white/[0.04] border-white/[0.08] text-[#A4A6B4]'
                        : 'bg-[#F5F6F8] border-[#E5E6EC] text-[#6E6E73]'
                    }`}
                  >
                    {t(`accentAtmoName_${accentColor}` as any)}
                  </span>
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
                    const atmoLabel = t(`accentAtmoName_${a.id}` as any);
                    const tooltipText = `${fullLabel} · ${atmoLabel}`;
                    return (
                      <Tooltip key={a.id} variant="compact" content={tooltipText}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={tooltipText}
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
                          className={`w-full min-w-0 overflow-hidden px-2.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-start relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
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
                          <span
                            className={`block min-w-0 flex-1 text-[11px] truncate leading-tight ${
                              active ? 'font-semibold text-[var(--brand-text)]' : 'font-medium'
                            }`}
                          >
                            {shortLabel}
                          </span>
                        </button>
                      </Tooltip>
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
                            <Tooltip variant="compact" content={langOpt.nativeName} onlyWhenTruncated>
                              <span className="text-[12px] truncate leading-snug">
                                {langOpt.nativeName}
                              </span>
                            </Tooltip>
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" />
                            )}
                          </div>
                          <Tooltip variant="compact" content={langOpt.subLabel} onlyWhenTruncated>
                            <div className="text-[10px] text-[#8E8E93] truncate mt-0.5">
                              {langOpt.subLabel}
                            </div>
                          </Tooltip>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Profile: Local Avatar + Display Nickname */}
                <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-3.5">
                  <div className="flex items-center gap-3.5">
                    <UserAvatar
                      avatar={normalizedAvatar}
                      displayName={userDisplay}
                      size="lg"
                      brandHex={currentScale.brand}
                      accentColor={accentColor}
                      isDark={isDark}
                      className="shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold">{t('avatarSectionLabel')}</div>
                      <div className={`text-[11px] ${subText} mt-0.5 leading-relaxed`}>
                        {t('avatarSectionSub')}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tooltip variant="compact" content={t('avatarModeInitial')}>
                      <button
                        type="button"
                        aria-label={t('avatarModeInitial')}
                        aria-pressed={normalizedAvatar.kind === 'initial'}
                        onClick={handleSelectInitialAvatar}
                        className={`h-8 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                          normalizedAvatar.kind === 'initial'
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)] ring-1 ring-[var(--brand)]/40 font-semibold shadow-2xs'
                            : isDark
                            ? 'border-[#303240] bg-black/15 text-[#D1D1D8] hover:border-[var(--brand-border)]'
                            : 'bg-white border-[#E5E5EA] text-[#3A3A3C] hover:border-[var(--brand-border)]'
                        }`}
                      >
                        <UserAvatar
                          avatar={{ kind: 'initial' }}
                          displayName={userDisplay}
                          size={20}
                          brandHex={currentScale.brand}
                          accentColor={accentColor}
                          isDark={isDark}
                        />
                        <span>{t('avatarModeInitial')}</span>
                      </button>
                    </Tooltip>

                    {AVATAR_PRESET_IDS.map((presetId) => {
                      const presetLabel = t(`avatarPreset_${presetId}` as any);
                      const isSelected =
                        normalizedAvatar.kind === 'preset' &&
                        normalizedAvatar.presetId === presetId;
                      return (
                        <Tooltip key={presetId} variant="compact" content={presetLabel}>
                          <button
                            type="button"
                            aria-label={t('avatarPresetAria', { name: presetLabel })}
                            aria-pressed={isSelected}
                            onClick={() => handleSelectPresetAvatar(presetId)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                              isSelected
                                ? `ring-2 ring-[var(--brand)] ring-offset-1 ${
                                    isDark ? 'ring-offset-[#1F212A]' : 'ring-offset-[#F9F9FB]'
                                  } scale-[1.04]`
                                : 'opacity-90 hover:opacity-100 hover:scale-[1.04]'
                            }`}
                          >
                            <UserAvatar
                              avatar={{ kind: 'preset', presetId }}
                              displayName={userDisplay}
                              size={28}
                              brandHex={currentScale.brand}
                              accentColor={accentColor}
                              isDark={isDark}
                            />
                          </button>
                        </Tooltip>
                      );
                    })}

                    <Tooltip variant="compact" content={t('avatarUploadBtn')}>
                      <button
                        type="button"
                        aria-label={t('avatarUploadBtn')}
                        aria-pressed={normalizedAvatar.kind === 'image'}
                        disabled={avatarBusy}
                        onClick={handlePickAvatarImage}
                        className={`h-8 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                          normalizedAvatar.kind === 'image'
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)] ring-1 ring-[var(--brand)]/40 font-semibold shadow-2xs'
                            : isDark
                            ? 'border-[#303240] bg-black/15 text-[#D1D1D8] hover:border-[var(--brand-border)]'
                            : 'bg-white border-[#E5E5EA] text-[#3A3A3C] hover:border-[var(--brand-border)]'
                        }`}
                      >
                        <svg
                          className="w-3.5 h-3.5 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>{t('avatarUploadBtn')}</span>
                      </button>
                    </Tooltip>

                    {!isDefaultAvatar && (
                      <Tooltip variant="compact" content={t('avatarResetBtn')}>
                        <button
                          type="button"
                          aria-label={t('avatarResetBtn')}
                          onClick={handleResetAvatar}
                          className="btn-ghost !h-8 !px-2.5 !rounded-full !text-[11px]"
                        >
                          {t('avatarResetBtn')}
                        </button>
                      </Tooltip>
                    )}

                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept={AVATAR_IMAGE_ACCEPT}
                      onChange={handleAvatarFileChange}
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="pt-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">{t('nicknameLabel')}</div>
                      <div className={`text-[11px] ${subText} mt-0.5 truncate`}>
                        {t('activeProfileNameSub', {
                          name: userDisplay,
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                        type="button"
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
                  onClick={() => appActions.updatePreferences({ tipsHiddenOn: tipsHiddenToday ? '' : effectiveDayKey })}
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

          {/* TAB 2: Answer Settings */}
          {activeTab === 'answer' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">
                  {t('settingsTabAnswer')}
                </h3>
                <p className={`text-[12px] ${subText} mt-0.5`}>
                  {t('settingsAnswerTabSub')}
                </p>
              </div>

              {/* Answer Buttons Layout */}
              <div className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold">{t('settingsAnswerButtonsTitle')}</div>
                  <div className={`text-[11px] ${subText} leading-relaxed`}>
                    {t('settingsAnswerButtonsSub')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => appActions.updatePreferences({ answerButtonMode: 'binary' })}
                    aria-pressed={answerButtonMode === 'binary'}
                    className={`h-8 px-3.5 rounded-lg border text-[12px] font-medium cursor-pointer transition-colors ${
                      answerButtonMode === 'binary'
                        ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-border)]'
                        : isDark
                        ? 'bg-white/[0.03] border-white/[0.08] text-[#C8C8D2] hover:bg-white/[0.07]'
                        : 'bg-white border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#F4F4F6]'
                    }`}
                  >
                    {t('answerButtonsBinary')}
                  </button>
                  <button
                    type="button"
                    onClick={() => appActions.updatePreferences({ answerButtonMode: 'four' })}
                    aria-pressed={answerButtonMode === 'four'}
                    className={`h-8 px-3.5 rounded-lg border text-[12px] font-medium cursor-pointer transition-colors ${
                      answerButtonMode === 'four'
                        ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-border)]'
                        : isDark
                        ? 'bg-white/[0.03] border-white/[0.08] text-[#C8C8D2] hover:bg-white/[0.07]'
                        : 'bg-white border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#F4F4F6]'
                    }`}
                  >
                    {t('answerButtonsFour')}
                  </button>
                </div>
              </div>

              {/* Audio Auto-Play */}
              <div className={`rounded-xl border p-4 space-y-3.5 ${cardSurface}`}>
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold">{t('settingsAutoPlayAudioTitle')}</div>
                  <div className={`text-[11px] ${subText} leading-relaxed`}>
                    {t('settingsAutoPlayAudioSub')}
                  </div>
                </div>

                <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-[#E5E5EA]/70'}`}>
                  <div className="pb-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[12.5px] font-medium">{t('autoPlayFrontAudioTitle')}</div>
                      <div className={`text-[11px] ${subText} leading-relaxed`}>
                        {t('autoPlayFrontAudioSub')}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoPlayFrontAudio}
                      aria-label={t('autoPlayFrontAudioTitle')}
                      onClick={() => {
                        const next = !autoPlayFrontAudio;
                        appActions.updatePreferences({ autoPlayFrontAudio: next });
                        if (!next && !autoPlayBackAudio) {
                          appActions.stopAudio();
                        }
                      }}
                      style={autoPlayFrontAudio ? { backgroundColor: currentScale.brand } : undefined}
                      className={`w-12 h-6.5 shrink-0 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                        autoPlayFrontAudio ? '' : isDark ? 'bg-[#3A3A48]' : 'bg-[#E5E5EA]'
                      }`}
                    >
                      <div
                        className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          autoPlayFrontAudio ? 'translate-x-5.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[12.5px] font-medium">{t('autoPlayBackAudioTitle')}</div>
                      <div className={`text-[11px] ${subText} leading-relaxed`}>
                        {t('autoPlayBackAudioSub')}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoPlayBackAudio}
                      aria-label={t('autoPlayBackAudioTitle')}
                      onClick={() => {
                        const next = !autoPlayBackAudio;
                        appActions.updatePreferences({ autoPlayBackAudio: next });
                        if (!next && !autoPlayFrontAudio) {
                          appActions.stopAudio();
                        }
                      }}
                      style={autoPlayBackAudio ? { backgroundColor: currentScale.brand } : undefined}
                      className={`w-12 h-6.5 shrink-0 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                        autoPlayBackAudio ? '' : isDark ? 'bg-[#3A3A48]' : 'bg-[#E5E5EA]'
                      }`}
                    >
                      <div
                        className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          autoPlayBackAudio ? 'translate-x-5.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Content Scale */}
              <div className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">{t('reviewScaleTitle')}</span>
                    <span className="text-[11px] font-mono text-[var(--brand-text)]">
                      {reviewContentScale}%
                    </span>
                  </div>
                  <div className={`text-[11px] ${subText} leading-relaxed`}>
                    {t('reviewScaleSub')}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {REVIEW_CONTENT_SCALES.map((scaleOpt) => {
                    const active = reviewContentScale === scaleOpt;
                    return (
                      <button
                        key={scaleOpt}
                        type="button"
                        onClick={() => appActions.updatePreferences({ reviewContentScale: scaleOpt })}
                        aria-pressed={active}
                        className={`h-8 px-3.5 rounded-lg border text-[12px] font-mono font-medium cursor-pointer transition-colors ${
                          active
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-border)]'
                            : isDark
                            ? 'bg-white/[0.03] border-white/[0.08] text-[#C8C8D2] hover:bg-white/[0.07]'
                            : 'bg-white border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#F4F4F6]'
                        }`}
                      >
                        {scaleOpt}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card Stage Width */}
              <div className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold">{t('reviewWidthTitle')}</div>
                  <div className={`text-[11px] ${subText} leading-relaxed`}>
                    {t('reviewWidthSub')}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { value: 'auto', labelKey: 'reviewWidthAuto' },
                      { value: 'standard', labelKey: 'reviewWidthStandard' },
                      { value: 'wide', labelKey: 'reviewWidthWide' },
                      { value: 'full', labelKey: 'reviewWidthFull' },
                    ] as Array<{ value: ReviewStageWidth; labelKey: any }>
                  ).map((opt) => {
                    const active = reviewStageWidth === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => appActions.updatePreferences({ reviewStageWidth: opt.value })}
                        aria-pressed={active}
                        className={`h-8 px-3.5 rounded-lg border text-[12px] font-medium cursor-pointer transition-colors ${
                          active
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-border)]'
                            : isDark
                            ? 'bg-white/[0.03] border-white/[0.08] text-[#C8C8D2] hover:bg-white/[0.07]'
                            : 'bg-white border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#F4F4F6]'
                        }`}
                      >
                        {t(opt.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Keyboard Shortcuts */}
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
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('showAnswerBtn')} / {t('rateGood')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold text-end">
                          Space / Enter
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('answerButtonsBinary')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold text-end">
                          1 {t('rateAgain')} · 2/3 {t('rateGood')} · 4 {t('rateEasy')}
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('answerButtonsFour')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold text-end">
                          1 {t('rateAgain')} · 2 {t('rateHard')} · 3 {t('rateGood')} · 4 {t('rateEasy')}
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('answerButtonsFour')} · {formatShortcut('Opt', envInfo.platform)}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold text-end">
                          {formatShortcut('Opt + 1~4', envInfo.platform)}
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('undoBtnShort')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold text-end">
                          Backspace / {formatShortcut('Cmd + Z', envInfo.platform)}
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className={subText}>{t('pronounceBtn')}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px] font-semibold">R</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
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

          {/* TAB 7: About Anki Studio */}
          {activeTab === 'about' && (
            <section aria-labelledby={aboutHeadingId} className="space-y-4">
              <h3 id={aboutHeadingId} className="text-[17px] font-bold tracking-tight text-balance">
                {t('settingsTabAbout')} · Anki Studio
              </h3>

              {/* Version & Runtime Info Card */}
              <article className={`@container rounded-xl border p-5 space-y-4 ${cardSurface}`}>
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      aria-hidden="true"
                      className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center shadow-xs border border-black/5 dark:border-white/10 bg-black/[0.025] dark:bg-white/[0.05]"
                    >
                      <AnkiStudioLogo size={26} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-bold tracking-tight text-balance">Anki Studio</h4>
                      <p className={`text-[12px] ${subText} mt-0.5 text-pretty`}>
                        {t('aboutVersionTitle')}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-mono font-semibold tabular-nums border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)]">
                    v{studioVersion}
                  </span>
                </header>

                <dl className="grid grid-cols-1 @sm:grid-cols-2 gap-3 pt-3.5 border-t border-black/[0.05] dark:border-white/[0.06]">
                  <div className="min-w-0">
                    <dt className={`text-[11px] ${subText}`}>{t('aboutRuntimeEnvLabel')}</dt>
                    <dd className="text-[13px] font-semibold mt-0.5 break-words">
                      {envInfo.platformBadge}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className={`text-[11px] ${subText}`}>{t('aboutEngineLabel')}</dt>
                    <dd className="text-[13px] font-semibold mt-0.5 break-words">FSRS Ready</dd>
                  </div>
                </dl>
              </article>

              {/* Author / Creator Info Card */}
              <article className={`@container rounded-xl border p-5 space-y-4 ${cardSurface}`}>
                <header className="flex items-center gap-3.5">
                  <img
                    src="./creator-avatar.jpg"
                    width={44}
                    height={44}
                    alt=""
                    decoding="async"
                    className="w-11 h-11 aspect-square rounded-full shrink-0 object-cover ring-1 ring-black/10 dark:ring-white/15 shadow-xs"
                  />
                  <div className="min-w-0">
                    <h4 className="flex flex-wrap items-center gap-2 text-[15px] font-bold tracking-tight text-balance">
                      <span>gripet</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.03] dark:bg-white/[0.06] text-[#636366] dark:text-[#A6A8B6]">
                        {t('aboutCreatorTitle')}
                      </span>
                    </h4>
                    <p className={`text-[12px] ${subText} mt-0.5 text-pretty`}>
                      {t('aboutCreatorRole')}
                    </p>
                  </div>
                </header>

                <ul role="list" className="about-creator-links">
                  {[
                    {
                      key: 'aboutXiaohongshu' as const,
                      url: XIAOHONGSHU_PROFILE_URL,
                      variant: 'primary' as const,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5 shrink-0 opacity-85"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                      ),
                    },
                    {
                      key: 'aboutGithub' as const,
                      url: GITHUB_REPO_URL,
                      variant: 'neutral' as const,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5 shrink-0 opacity-80"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
                        </svg>
                      ),
                    },
                    {
                      key: 'aboutAnkiwebLike' as const,
                      url: ANKIWEB_ADDON_URL,
                      variant: 'like' as const,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5 shrink-0 text-[var(--status-danger-text)] transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none motion-reduce:transform-none"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      ),
                    },
                  ].map((link) => (
                    <li key={link.key}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          openExternal(link.url);
                        }}
                        className={`group about-creator-link rounded-xl border text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                          link.variant === 'primary'
                            ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)] hover:bg-[var(--brand-soft-strong)]'
                            : isDark
                            ? 'border-white/[0.12] bg-white/[0.04] text-[#ECECF2] hover:bg-white/[0.08] hover:border-white/[0.2]'
                            : 'border-[#DCDCE2] bg-white text-[#1D1D1F] hover:border-[var(--brand-border)] hover:bg-[var(--brand-surface)] shadow-2xs'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {link.icon}
                          <span>{t(link.key)}</span>
                        </span>
                        <svg
                          className="w-3.5 h-3.5 shrink-0 opacity-50 transition-transform duration-150 group-hover:opacity-90 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:transform-none"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M7 17 17 7" />
                          <path d="M7 7h10v10" />
                        </svg>
                        <span className="sr-only">, {t('aboutOpensInBrowser')}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </article>

              {/* Anonymous Feedback Settings Card */}
              <article className={`@container rounded-xl border p-5 ${cardSurface}`}>
                <div className="flex flex-wrap @sm:flex-nowrap items-start @sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <label
                      htmlFor={analyticsSwitchId}
                      className="block text-[14px] font-bold tracking-tight cursor-pointer text-balance"
                    >
                      {t('aboutFeedbackTitle')}
                    </label>
                    <p
                      id={analyticsDescId}
                      className={`text-[12px] ${subText} leading-relaxed text-pretty`}
                    >
                      {t('settingsAnalyticsSub')}
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5 @sm:pt-0">
                    <input
                      id={analyticsSwitchId}
                      type="checkbox"
                      checked={analyticsEnabled}
                      onChange={(e) =>
                        appActions.updatePreferences({ analyticsEnabled: e.target.checked })
                      }
                      aria-describedby={analyticsDescId}
                      {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                      {...(supportsNativeSwitch
                        ? {}
                        : { role: 'switch', 'aria-checked': analyticsEnabled })}
                      data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                      className="anki-switch shrink-0"
                    />
                  </div>
                </div>
              </article>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
