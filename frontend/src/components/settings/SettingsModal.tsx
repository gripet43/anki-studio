import React, { useEffect, useId, useRef, useState } from 'react';
import { AnkiStudioLogo } from '../common/AnkiStudioLogo';
import { Tooltip } from '../common/Tooltip';
import { SyncStateIcon, SyncVisualState } from '../common/SyncStateIcon';
import { CheckIcon, DownloadIcon, SyncArrowsIcon, UploadIcon } from '../common/Icons';
import { UserAvatar } from '../common/UserAvatar';
import { AvatarCropModal } from './AvatarCropModal';
import { ReviewerWidthGlyph } from '../reviewer/ReviewerView';
import { usePresence } from '../../hooks/usePresence';
import { runThemeViewTransition } from '../../utils/viewTransition';
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
  type AvatarCropTransform,
  AvatarImageError,
  isDefaultCustomAvatar,
  normalizeCustomAvatarConfig,
  validateAvatarSourceFile,
} from '../../utils/avatarImage';
import {
  ACCENT_COLOR_LIST,
  getAccentScale,
  resolveThemeMode,
} from '../../utils/themeTokens';

const XIAOHONGSHU_PROFILE_URL =
  'https://www.xiaohongshu.com/user/profile/6496d6f8000000001001ff0f';
const GITHUB_REPO_URL = 'https://github.com/gripet43/anki-studio';
const ANKIWEB_ADDON_URL =
  'https://ankiweb.net/shared/info/1071937836?cb=1794962974753';

type SettingsTab = 'appearance' | 'answer' | 'shortcuts' | 'sync' | 'maintenance' | 'native' | 'about';

const Keycap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="settings-keycap">{children}</kbd>
);

const AnswerModeGlyph: React.FC<{ mode: 'binary' | 'four'; active: boolean }> = ({
  mode,
  active,
}) => {
  const buttons =
    mode === 'binary'
      ? [
          { x: 2, width: 10, rx: 1.5, opacity: active ? 0.58 : 0.5 },
          { x: 14, width: 10, rx: 1.5, opacity: active ? 0.95 : 0.82 },
        ]
      : [
          { x: 2, width: 4, rx: 1, opacity: active ? 0.48 : 0.42 },
          { x: 8, width: 4, rx: 1, opacity: active ? 0.65 : 0.56 },
          { x: 14, width: 4, rx: 1, opacity: active ? 0.84 : 0.72 },
          { x: 20, width: 4, rx: 1, opacity: active ? 0.96 : 0.85 },
        ];

  return (
    <svg
      className={`w-[26px] h-[18px] shrink-0 ${
        active ? 'text-[var(--brand-text)]' : 'text-[var(--text-secondary)]'
      }`}
      viewBox="0 0 26 18"
      fill="none"
      aria-hidden="true"
    >
      {/* Flashcard preview sheet */}
      <rect
        x="2"
        y="1.5"
        width="22"
        height="9.5"
        rx="2"
        fill="currentColor"
        fillOpacity={active ? 0.1 : 0.06}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity={active ? 0.85 : 0.68}
      />
      <path
        d="M7 6.25h12"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeOpacity={active ? 0.72 : 0.55}
      />
      {/* Bottom rating buttons dock */}
      {buttons.map((b, idx) => (
        <rect
          key={idx}
          x={b.x}
          y="13"
          width={b.width}
          height="3.5"
          rx={b.rx}
          fill="currentColor"
          fillOpacity={b.opacity}
        />
      ))}
    </svg>
  );
};

const ThemeModeGlyph: React.FC<{ mode: ThemeMode; active: boolean }> = ({ mode, active }) => {
  const cls = `w-4 h-4 shrink-0 ${
    active ? 'text-[var(--brand-text)]' : 'text-[var(--text-secondary)]'
  }`;
  if (mode === 'light') {
    return (
      <svg
        className={cls}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="2.75" />
        <path d="M8 1.5v1.25M8 13.25v1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M1.5 8h1.25M13.25 8h1.25M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
      </svg>
    );
  }
  if (mode === 'dark') {
    return (
      <svg
        className={cls}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13.25 9.8A5.75 5.75 0 0 1 6.2 2.75a5.75 5.75 0 1 0 7.05 7.05Z" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5V1.75Z" fill="currentColor" />
    </svg>
  );
};

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
    showIllustrations,
    showDashboardTips,
    analyticsEnabled,
    answerButtonMode,
    autoPlayFrontAudio,
    autoPlayBackAudio,
    reviewStageWidth,
    reviewContentScale,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsInitialTab || 'appearance');
  const [nicknameDraft, setNicknameDraft] = useState(customNickname || '');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarCropSaving, setAvatarCropSaving] = useState(false);
  const [pendingAvatarCrop, setPendingAvatarCrop] = useState<{
    source: File | Blob | string;
    previewUrl: string;
    revokeOnClose: boolean;
  } | null>(null);
  const pendingAvatarCropRef = useRef(pendingAvatarCrop);
  pendingAvatarCropRef.current = pendingAvatarCrop;
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [dbReport, setDbReport] = useState<any | null>(null);
  const [emptyReport, setEmptyReport] = useState<any | null>(null);
  const [mediaReport, setMediaReport] = useState<any | null>(null);

  const resolvedTheme = resolveThemeMode(theme, systemDark);
  const isDark = resolvedTheme === 'dark';

  const modalTitleId = useId();
  const aboutHeadingId = useId();
  const illustrationsSwitchId = useId();
  const nicknameInputId = useId();
  const tipsSwitchId = useId();
  const tipsDescId = useId();
  const frontAudioSwitchId = useId();
  const backAudioSwitchId = useId();
  const shortcutHintsSwitchId = useId();
  const shortcutHintsDescId = useId();
  const analyticsSwitchId = useId();
  const analyticsDescId = useId();

  const supportsNativeSwitch =
    typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
  const studioVersion = envInfo.studioVersion || '1.7.1';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  // Open external URLs in the system browser because Qt WebView loads from file://
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
    if (!settingsOpen) {
      setPendingAvatarCrop((prev) => {
        if (prev?.revokeOnClose && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return null;
      });
      setAvatarCropSaving(false);
    }
  }, [settingsOpen]);

  useEffect(() => {
    return () => {
      const current = pendingAvatarCropRef.current;
      if (current?.revokeOnClose && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(current.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen || pendingAvatarCrop) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAppState({ settingsOpen: false });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, pendingAvatarCrop]);

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
  const userDisplay = dashboard.userName || t('defaultUser');
  const normalizedAvatar = normalizeCustomAvatarConfig(customAvatar);
  const isDefaultAvatar = isDefaultCustomAvatar(normalizedAvatar);
  const savedNickname = customNickname || '';
  const isNicknameDirty = nicknameDraft !== savedNickname;

  const commitNicknameIfDirty = () => {
    if (nicknameDraft === savedNickname) return;
    void appActions.updatePreferences({ customNickname: nicknameDraft });
    showToast(t('nicknameSavedToast'));
  };

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

  const openAvatarCrop = (source: File | Blob | string, previewUrl: string, revokeOnClose: boolean) => {
    setPendingAvatarCrop((prev) => {
      if (prev?.revokeOnClose && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return { source, previewUrl, revokeOnClose };
    });
  };

  const closeAvatarCrop = () => {
    setPendingAvatarCrop((prev) => {
      if (prev?.revokeOnClose && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
    setAvatarCropSaving(false);
  };

  const handlePickAvatarImage = async () => {
    if (avatarBusy || avatarCropSaving) return;
    if (!isAnkiNativeEnv()) {
      avatarFileInputRef.current?.click();
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUrl = await appActions.pickNativeAvatarDataUrl(() => {
        avatarFileInputRef.current?.click();
      });
      if (dataUrl) {
        openAvatarCrop(dataUrl, dataUrl, false);
      }
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      validateAvatarSourceFile(file);
    } catch (err) {
      if (err instanceof AvatarImageError && err.code === 'invalid_type') {
        showToast(t('avatarUploadInvalidToast'));
      } else {
        showToast(t('avatarUploadTooLargeToast'));
      }
      return;
    }
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(file);
      openAvatarCrop(file, objectUrl, true);
      return;
    }
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result) {
          openAvatarCrop(file, reader.result, false);
        } else {
          showToast(t('avatarUploadTooLargeToast'));
        }
      };
      reader.onerror = () => showToast(t('avatarUploadTooLargeToast'));
      reader.readAsDataURL(file);
      return;
    }
    setAvatarBusy(true);
    try {
      await appActions.saveAvatarFromImageSource(file);
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleConfirmAvatarCrop = async (crop: AvatarCropTransform, viewportSize: number) => {
    if (!pendingAvatarCrop || avatarCropSaving) return;
    setAvatarCropSaving(true);
    try {
      const saved = await appActions.saveAvatarFromImageSource(pendingAvatarCrop.source, {
        crop,
        viewportSize,
      });
      if (saved) {
        closeAvatarCrop();
      }
    } finally {
      setAvatarCropSaving(false);
    }
  };

  const themeOptions: Array<{ id: ThemeMode; label: string }> = [
    { id: 'auto', label: t('themeAuto') },
    { id: 'light', label: t('themeLight') },
    { id: 'dark', label: t('themeDark') },
  ];

  const currentLangMeta = getLanguageMeta(resolvedLang);

  // Collapsible tiled grid of Auto + 16 official Anki languages
  const tiledLanguageOptions: Array<{
    id: LanguageOption;
    nativeName: string;
    subLabel: string;
  }> = [
    {
      id: 'auto',
      nativeName: t('langAuto'),
      subLabel: currentLangMeta.nativeName,
    },
    ...SUPPORTED_LANGUAGES.map((item) => ({
      id: item.id as LanguageOption,
      nativeName: item.nativeName,
      subLabel: item.englishName,
    })),
  ];

  const activeLangSummary =
    languagePref === 'auto'
      ? `${t('langAuto')} · ${currentLangMeta.nativeName}`
      : currentLangMeta.nativeName;

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

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowDown') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowUp') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const nextTab = tabs[nextIdx].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const relativeSync = formatRelativeSyncLabel(lastSyncedTimestamp, resolvedLang);
  const absSync = formatAbsoluteSyncTooltip(lastSyncedTimestamp, resolvedLang);

  return (
    <>
    <div
      data-state={presence.state}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 sm:p-6 select-none ui-modal-backdrop modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <div
        data-state={presence.state}
        onClick={(e) => e.stopPropagation()}
        className={`w-[min(800px,calc(100vw-2rem))] h-[min(580px,calc(100dvh-2rem))] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.35)] flex overflow-hidden ui-modal-panel relative ${modalSurface}`}
      >
        {/* Top Right Close Button */}
        <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
          <button
            type="button"
            onClick={() => setAppState({ settingsOpen: false })}
            className={`absolute top-4 end-4 z-20 w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
              isDark ? 'text-[#8E8E93] hover:text-white hover:bg-white/10' : 'text-[#8E8E93] hover:text-black hover:bg-black/5'
            }`}
            aria-label={t('close')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </Tooltip>

        {/* Left Settings Sidebar */}
        <aside className={`w-[208px] shrink-0 border-e p-3.5 flex flex-col ${sidebarBg}`}>
          <div className="space-y-3.5">
            <div className="px-3 pt-1.5">
              <h2 id={modalTitleId} className="text-[16px] font-bold tracking-tight settings-heading">
                {t('navSettings')}
              </h2>
            </div>

            <div
              role="tablist"
              aria-orientation="vertical"
              aria-label={t('navSettings')}
              className="space-y-1"
            >
              {tabs.map((tab, idx) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`settings-tab-${tab.id}`}
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className={`settings-tablist-btn relative w-full flex items-center gap-2.5 ps-3.5 pe-3 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer text-start focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-1 ${
                      active
                        ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] before:content-[""] before:absolute before:inset-y-2 before:start-1 before:border-inline-start-[3px] before:border-[var(--brand-text)] before:rounded-full'
                        : isDark
                        ? 'hover:bg-white/5 text-[#D1D1D8]'
                        : 'hover:bg-black/5 text-[#3A3A3C]'
                    }`}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <span className="truncate min-w-0">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Settings Content Panel */}
        <div
          role="tabpanel"
          aria-labelledby={`settings-tab-${activeTab}`}
          className="flex-1 min-w-0 px-6 py-5 sm:px-7 sm:py-6 overflow-y-auto overscroll-contain space-y-3.5"
        >
          <div key={activeTab} className="ui-tab-enter">
          {/* TAB 1: Appearance & Language */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <h3 className="text-[17px] font-bold tracking-tight settings-heading">
                {t('settingsTabAppearance')}
              </h3>

              {/* Theme Mode Radio Cards */}
              <article className={`rounded-xl border p-4 ${cardSurface}`}>
                <fieldset className="reviewer-width-fieldset">
                  <legend className="text-[13px] font-semibold p-0 mb-2.5 settings-heading">
                    {t('settingsThemeModeTitle')}
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {themeOptions.map((opt) => {
                      const active = theme === opt.id;
                      return (
                        <label
                          key={opt.id}
                          data-selected={active ? 'true' : 'false'}
                          className="reviewer-width-card settings-choice-card px-3 py-2.5 rounded-xl border text-start cursor-pointer flex items-center gap-2 select-none"
                        >
                          <input
                            type="radio"
                            name="settings-theme-mode"
                            value={opt.id}
                            checked={active}
                            onChange={() => {
                              runThemeViewTransition(() => {
                                appActions.setTheme(opt.id);
                              });
                              showToast(t('savedThemeToast', { name: opt.label }));
                            }}
                            className="sr-only"
                          />
                          <ThemeModeGlyph mode={opt.id} active={active} />
                          <span className="text-[12.5px] leading-tight truncate">
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </article>

              {/* Theme Color & Illustrations */}
              <article className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold">
                    {t('settingsThemeColorTitle')}
                  </span>
                  <div className="inline-flex items-center gap-2 shrink-0">
                    <label
                      htmlFor={illustrationsSwitchId}
                      className={`text-[12px] font-medium cursor-pointer select-none ${subText}`}
                    >
                      {t('settingsShowIllustrationsLabel')}
                    </label>
                    <input
                      id={illustrationsSwitchId}
                      type="checkbox"
                      checked={showIllustrations}
                      onChange={(e) =>
                        appActions.updatePreferences({ showIllustrations: e.target.checked })
                      }
                      {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                      {...(supportsNativeSwitch
                        ? {}
                        : { role: 'switch', 'aria-checked': showIllustrations })}
                      data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                      className="anki-switch anki-switch-sm shrink-0"
                    />
                  </div>
                </div>

                <div
                  role="radiogroup"
                  aria-label={t('settingsThemeColorTitle')}
                  className="grid grid-cols-4 gap-2"
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
                            runThemeViewTransition(() => {
                              appActions.setAccentColor(a.id);
                            });
                            showToast(t('savedAccentToast', { name: shortLabel }));
                          }}
                          style={
                            active
                              ? {
                                  backgroundColor: modeScale.brandSoft,
                                  borderColor: modeScale.brand,
                                  boxShadow: '0 0 0 1px rgba(var(--brand-rgb), 0.22)',
                                }
                              : undefined
                          }
                          className={`w-full min-w-0 overflow-hidden px-2.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors text-start relative focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                            active
                              ? 'text-[var(--brand-text)]'
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
                          <span className="block min-w-0 flex-1 text-[11.5px] font-medium truncate leading-tight">
                            {shortLabel}
                          </span>
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </article>

              {/* Interface Language (Collapsible <details> disclosure) */}
              <article className={`rounded-xl border overflow-hidden ${cardSurface}`}>
                <details className="group studio-details">
                  <summary className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <span className="text-[13px] font-semibold">{t('languageLabel')}</span>
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)] truncate max-w-[200px]">
                        {activeLangSummary}
                      </span>
                      <svg
                        className={`w-4 h-4 shrink-0 ${subText} studio-details-chevron`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </summary>

                  <div className="px-4 pb-4 pt-3 border-t border-black/5 dark:border-white/5">
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
                                    boxShadow: '0 0 0 1px rgba(var(--brand-rgb), 0.22)',
                                  }
                                : undefined
                            }
                            className={`px-2.5 py-2 rounded-xl border text-start cursor-pointer transition-colors font-medium focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                              active
                                ? ''
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
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" aria-hidden="true" />
                              )}
                            </div>
                            <Tooltip variant="compact" content={langOpt.subLabel} onlyWhenTruncated>
                              <div className="text-[10px] text-[#8E8E93] truncate mt-0.5 font-normal">
                                {langOpt.subLabel}
                              </div>
                            </Tooltip>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </details>
              </article>

              {/* Standalone Local Profile Card (Avatar + Display Nickname) */}
              <article className={`@container rounded-xl border p-4 ${cardSurface}`}>
                <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-[#E5E5EA]/80'}`}>
                  <div className="pb-4 space-y-3.5">
                    <div className="flex flex-wrap @sm:flex-nowrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <UserAvatar
                          avatar={normalizedAvatar}
                          displayName={userDisplay}
                          size="lg"
                          brandHex={currentScale.brand}
                          accentColor={accentColor}
                          isDark={isDark}
                          className={
                            normalizedAvatar.kind === 'image'
                              ? `ring-2 ring-[var(--brand)] ring-offset-2 ${
                                  isDark ? 'ring-offset-[#1F212A]' : 'ring-offset-[#F9F9FB]'
                                } shadow-xs`
                              : 'shadow-xs'
                          }
                        />
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold settings-heading">
                            {t('avatarSectionLabel')}
                          </div>
                          <p className={`text-[11.5px] ${subText} mt-0.5 leading-relaxed settings-helper-copy`}>
                            {t('avatarSectionSub')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isDefaultAvatar && (
                          <Tooltip variant="compact" content={t('avatarResetBtn')}>
                            <button
                              type="button"
                              aria-label={t('avatarResetBtn')}
                              onClick={handleResetAvatar}
                              className="btn-ghost !h-8 !px-2.5 !rounded-lg !text-[11.5px]"
                            >
                              {t('avatarResetBtn')}
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip variant="compact" content={t('avatarUploadBtn')}>
                          <button
                            type="button"
                            aria-label={t('avatarUploadBtn')}
                            aria-pressed={normalizedAvatar.kind === 'image'}
                            disabled={avatarBusy}
                            onClick={handlePickAvatarImage}
                            className={`h-8 px-3 rounded-lg border text-[11.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                              normalizedAvatar.kind === 'image'
                                ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)]'
                                : isDark
                                ? 'border-white/[0.12] bg-white/[0.04] text-[#D1D1D8] hover:border-white/[0.22]'
                                : 'bg-white border-[#DCDCE2] text-[#3A3A3C] hover:border-[var(--brand-border)]'
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
                      </div>
                    </div>

                    {/* Built-in Avatar Identities (Single Clean Row) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Tooltip variant="compact" content={t('avatarModeInitial')}>
                        <button
                          type="button"
                          aria-label={t('avatarModeInitial')}
                          aria-pressed={normalizedAvatar.kind === 'initial'}
                          onClick={handleSelectInitialAvatar}
                          className={`h-8 px-2.5 rounded-full border text-[11.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                            normalizedAvatar.kind === 'initial'
                              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)] shadow-2xs'
                              : isDark
                              ? 'border-[#303240] bg-black/15 text-[#D1D1D8] hover:border-[var(--brand-border)]'
                              : 'bg-white border-[#DCDCE2] text-[#3A3A3C] hover:border-[var(--brand-border)]'
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
                              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-transform focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] focus-visible:outline-offset-2 ${
                                isSelected
                                  ? `ring-2 ring-[var(--brand)] ring-offset-2 ${
                                      isDark ? 'ring-offset-[#1F212A]' : 'ring-offset-[#F9F9FB]'
                                    } scale-[1.04]`
                                  : 'ring-1 ring-black/[0.08] dark:ring-white/[0.12] opacity-95 hover:opacity-100 hover:scale-[1.04]'
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
                  </div>

                  {/* Display Nickname (Auto-saves on blur or IME-safe Enter) */}
                  <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
                    <label htmlFor={nicknameInputId} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block text-[13px] font-semibold settings-heading">
                        {t('nicknameLabel')}
                      </span>
                      {(nicknameDraft.trim().length === 0 || isNicknameDirty) && (
                        <span className={`block text-[11.5px] ${subText} mt-0.5 truncate`}>
                          {t('activeProfileNameSub', { name: userDisplay })}
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative flex items-center">
                        <input
                          ref={nicknameInputRef}
                          id={nicknameInputId}
                          type="text"
                          value={nicknameDraft}
                          onChange={(e) => setNicknameDraft(e.target.value)}
                          onBlur={commitNicknameIfDirty}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          placeholder={t('nicknamePlaceholder')}
                          enterKeyHint="done"
                          className={`settings-text-input ${
                            nicknameDraft.trim().length > 0 ? 'pe-8' : ''
                          }`}
                        />
                        {nicknameDraft.trim().length > 0 && (
                          <Tooltip variant="compact" content={t('clearSearchBtn')}>
                            <button
                              type="button"
                              aria-label={t('clearSearchBtn')}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setNicknameDraft('');
                                if (savedNickname !== '') {
                                  void appActions.updatePreferences({ customNickname: '' });
                                  showToast(t('nicknameSavedToast'));
                                }
                                nicknameInputRef.current?.focus();
                              }}
                              className="absolute end-1 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </Tooltip>
                        )}
                      </div>
                      {isNicknameDirty && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={commitNicknameIfDirty}
                          className="btn-primary !h-9 !px-3 !rounded-lg !text-[12px]"
                        >
                          {t('saveNickname')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>

              {/* Dashboard Learning Tips Toggle */}
              <article className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${cardSurface}`}>
                <div className="space-y-0.5 min-w-0">
                  <label
                    htmlFor={tipsSwitchId}
                    className="block text-[13px] font-semibold cursor-pointer settings-heading"
                  >
                    {t('settingsShowTipsTitle')}
                  </label>
                  <p id={tipsDescId} className={`text-[11.5px] ${subText} leading-relaxed settings-helper-copy`}>
                    {t('settingsShowTipsSub')}
                  </p>
                </div>
                <input
                  id={tipsSwitchId}
                  type="checkbox"
                  checked={showDashboardTips}
                  onChange={(e) =>
                    appActions.updatePreferences({
                      showDashboardTips: e.target.checked,
                      ...(e.target.checked ? { tipsHiddenOn: '' } : {}),
                    })
                  }
                  aria-describedby={tipsDescId}
                  {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                  {...(supportsNativeSwitch
                    ? {}
                    : { role: 'switch', 'aria-checked': showDashboardTips })}
                  data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                  className="anki-switch shrink-0"
                />
              </article>
            </div>
          )}

          {/* TAB 2: Answer Settings */}
          {activeTab === 'answer' && (
            <div className="space-y-3.5">
              <h3 className="text-[17px] font-bold tracking-tight settings-heading">
                {t('settingsTabAnswer')}
              </h3>

              {/* Answer Buttons Layout */}
              <article className={`rounded-xl border px-4 py-3.5 ${cardSurface}`}>
                <fieldset className="reviewer-width-fieldset">
                  <legend className="text-[13px] font-semibold p-0 mb-2.5 settings-heading">
                    {t('settingsAnswerButtonsTitle')}
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(
                      [
                        { mode: 'binary', label: t('answerButtonsBinary') },
                        { mode: 'four', label: t('answerButtonsFour') },
                      ] as const
                    ).map((opt) => {
                      const active = answerButtonMode === opt.mode;
                      return (
                        <label
                          key={opt.mode}
                          data-selected={active ? 'true' : 'false'}
                          className="reviewer-width-card settings-choice-card px-3.5 py-2.5 rounded-xl border text-start cursor-pointer flex items-center gap-2.5 select-none"
                        >
                          <input
                            type="radio"
                            name="settings-answer-mode"
                            value={opt.mode}
                            checked={active}
                            onChange={() =>
                              appActions.updatePreferences({ answerButtonMode: opt.mode })
                            }
                            className="sr-only"
                          />
                          <AnswerModeGlyph mode={opt.mode} active={active} />
                          <span className="text-[12.5px] leading-tight truncate">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </article>

              {/* Unified Card Display: Content Scale + Stage Width */}
              <article className={`rounded-xl border px-4 py-3.5 ${cardSurface}`}>
                <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-[#E5E5EA]/80'}`}>
                  <div className="pb-3.5">
                    <fieldset className="reviewer-width-fieldset space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <legend className="text-[13px] font-semibold p-0 settings-heading">
                          {t('reviewScaleTitle')}
                        </legend>
                        {reviewContentScale !== 100 && (
                          <button
                            type="button"
                            onClick={() => appActions.updatePreferences({ reviewContentScale: 100 })}
                            className="text-[11px] font-medium text-[var(--brand-text)] hover:underline cursor-pointer"
                          >
                            {t('reviewResetDefaultBtn')}
                          </button>
                        )}
                      </div>
                      <p className={`text-[11.5px] ${subText} leading-snug settings-helper-copy`}>
                        {t('reviewScaleSub')}
                      </p>
                      <div className="settings-segmented-bar">
                        {REVIEW_CONTENT_SCALES.map((scaleOpt) => {
                          const active = reviewContentScale === scaleOpt;
                          return (
                            <label
                              key={scaleOpt}
                              data-selected={active ? 'true' : 'false'}
                              className="settings-segmented-option font-mono"
                            >
                              <input
                                type="radio"
                                name="settings-review-scale"
                                value={scaleOpt}
                                checked={active}
                                onChange={() =>
                                  appActions.updatePreferences({ reviewContentScale: scaleOpt })
                                }
                                className="sr-only"
                              />
                              <span className="settings-segmented-value">{scaleOpt}%</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>

                  <div className="pt-3.5">
                    <fieldset className="reviewer-width-fieldset space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <legend className="text-[13px] font-semibold p-0 settings-heading">
                          {t('reviewWidthTitle')}
                        </legend>
                        {reviewStageWidth !== 'auto' && (
                          <button
                            type="button"
                            onClick={() => appActions.updatePreferences({ reviewStageWidth: 'auto' })}
                            className="text-[11px] font-medium text-[var(--brand-text)] hover:underline cursor-pointer"
                          >
                            {t('reviewResetDefaultBtn')}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                            <label
                              key={opt.value}
                              data-selected={active ? 'true' : 'false'}
                              className="reviewer-width-card settings-choice-card px-2.5 py-2.5 rounded-xl border text-start cursor-pointer flex items-center gap-2 select-none"
                            >
                              <input
                                type="radio"
                                name="settings-stage-width"
                                value={opt.value}
                                checked={active}
                                onChange={() =>
                                  appActions.updatePreferences({ reviewStageWidth: opt.value })
                                }
                                className="sr-only"
                              />
                              <ReviewerWidthGlyph mode={opt.value} active={active} />
                              <span className="text-[12px] leading-tight truncate">
                                {t(opt.labelKey)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>
                </div>
              </article>

              {/* Audio Auto-Play */}
              <article className={`rounded-xl border px-4 py-3.5 space-y-2.5 ${cardSurface}`}>
                <div className="space-y-0.5">
                  <div className="text-[13px] font-semibold settings-heading">
                    {t('settingsAutoPlayAudioTitle')}
                  </div>
                  <p className={`text-[11.5px] ${subText} leading-snug settings-helper-copy`}>
                    {t('settingsAutoPlayAudioSub')}
                  </p>
                </div>

                <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-[#E5E5EA]/70'}`}>
                  <div className="py-2.5 first:pt-1 flex items-center justify-between gap-4">
                    <label
                      htmlFor={frontAudioSwitchId}
                      className="text-[13px] font-medium cursor-pointer min-w-0 flex-1"
                    >
                      {t('autoPlayFrontAudioTitle')}
                    </label>
                    <input
                      id={frontAudioSwitchId}
                      type="checkbox"
                      checked={autoPlayFrontAudio}
                      onChange={(e) => {
                        const next = e.target.checked;
                        appActions.updatePreferences({ autoPlayFrontAudio: next });
                        if (!next && !autoPlayBackAudio) {
                          appActions.stopAudio();
                        }
                      }}
                      {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                      {...(supportsNativeSwitch
                        ? {}
                        : { role: 'switch', 'aria-checked': autoPlayFrontAudio })}
                      data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                      className="anki-switch shrink-0"
                    />
                  </div>

                  <div className="py-2.5 last:pb-0 flex items-center justify-between gap-4">
                    <label
                      htmlFor={backAudioSwitchId}
                      className="text-[13px] font-medium cursor-pointer min-w-0 flex-1"
                    >
                      {t('autoPlayBackAudioTitle')}
                    </label>
                    <input
                      id={backAudioSwitchId}
                      type="checkbox"
                      checked={autoPlayBackAudio}
                      onChange={(e) => {
                        const next = e.target.checked;
                        appActions.updatePreferences({ autoPlayBackAudio: next });
                        if (!next && !autoPlayFrontAudio) {
                          appActions.stopAudio();
                        }
                      }}
                      {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                      {...(supportsNativeSwitch
                        ? {}
                        : { role: 'switch', 'aria-checked': autoPlayBackAudio })}
                      data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                      className="anki-switch shrink-0"
                    />
                  </div>
                </div>
              </article>
            </div>
          )}

          {/* TAB 3: Keyboard Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <h3 className="text-[17px] font-bold tracking-tight">
                {t('settingsTabShortcuts')}
              </h3>

              {/* Toggle Switch Card: Show/Hide Shortcut Badges */}
              <article className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${cardSurface}`}>
                <div className="space-y-0.5 min-w-0">
                  <label
                    htmlFor={shortcutHintsSwitchId}
                    className="block text-[13px] font-semibold cursor-pointer"
                  >
                    {t('settingsShowShortcutBadgesTitle')}
                  </label>
                  <p id={shortcutHintsDescId} className={`text-[11px] ${subText} leading-relaxed`}>
                    {t('settingsShowShortcutBadgesSub')}
                  </p>
                </div>

                <input
                  id={shortcutHintsSwitchId}
                  type="checkbox"
                  checked={showShortcutHints}
                  onChange={(e) => {
                    const next = e.target.checked;
                    appActions.updatePreferences({ showShortcutHints: next });
                    showToast(
                      next
                        ? t('shortcutHintsEnabledToast')
                        : t('shortcutHintsDisabledToast')
                    );
                  }}
                  aria-describedby={shortcutHintsDescId}
                  {...({ switch: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                  {...(supportsNativeSwitch
                    ? {}
                    : { role: 'switch', 'aria-checked': showShortcutHints })}
                  data-switch-fallback={supportsNativeSwitch ? 'false' : 'true'}
                  className="anki-switch shrink-0"
                />
              </article>

              {/* Cheatsheet Grid with Semantic <dl> and Separated Keycaps */}
              <article className={`rounded-xl border p-4 space-y-4 ${cardSurface}`}>
                <div className="text-[13px] font-semibold">
                  {t('settingsCheatsheetTitle')}
                </div>

                <div className="space-y-3.5">
                  <div>
                    <div className="text-[11px] font-medium text-[var(--brand-text)] mb-1.5">
                      {t('settingsGroupGlobal')}
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-[12px]">
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('cmdPaletteAriaLabel')}</dt>
                        <dd className="shrink-0">
                          <Keycap>{formatShortcut('Cmd + K', envInfo.platform)}</Keycap>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('quickAddBtn')}</dt>
                        <dd className="shrink-0"><Keycap>N</Keycap></dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('syncNowAction')}</dt>
                        <dd className="shrink-0"><Keycap>Y</Keycap></dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('nativeSwitch')}</dt>
                        <dd className="shrink-0"><Keycap>{shortcutHint}</Keycap></dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('zenShortcutLabel')}</dt>
                        <dd className="shrink-0">
                          <Keycap>{formatShortcut('Cmd + Shift + Z', envInfo.platform)}</Keycap>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('sidebarToggleLabel')}</dt>
                        <dd className="shrink-0">
                          <Keycap>{formatShortcut('Cmd + \\', envInfo.platform)}</Keycap>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-[var(--brand-text)] mb-1.5">
                      {t('navStudy')}
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-[12px]">
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>
                          {t('showAnswerBtn')} / {t('rateGood')}
                        </dt>
                        <dd className="shrink-0 flex items-center gap-1">
                          <Keycap>Space</Keycap>
                          <span className="opacity-50">/</span>
                          <Keycap>Enter</Keycap>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('tabRevealHint')}</dt>
                        <dd className="shrink-0"><Keycap>Tab</Keycap></dd>
                      </div>

                      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={subText}>{t('answerButtonsBinary')}</dt>
                        <dd className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
                          <span className="inline-flex items-center gap-1">
                            <Keycap>1</Keycap>
                            <span>{t('rateAgain')}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Keycap>2</Keycap>
                            <span className="opacity-50">/</span>
                            <Keycap>3</Keycap>
                            <span>{t('rateGood')}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Keycap>4</Keycap>
                            <span>{t('rateEasy')}</span>
                          </span>
                        </dd>
                      </div>

                      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={subText}>{t('answerButtonsFour')}</dt>
                        <dd className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
                          <span className="inline-flex items-center gap-1">
                            <Keycap>1</Keycap>
                            <span>{t('rateAgain')}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Keycap>2</Keycap>
                            <span>{t('rateHard')}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Keycap>3</Keycap>
                            <span>{t('rateGood')}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Keycap>4</Keycap>
                            <span>{t('rateEasy')}</span>
                          </span>
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('undoBtnShort')}</dt>
                        <dd className="shrink-0 flex items-center gap-1">
                          <Keycap>Backspace</Keycap>
                          <span className="opacity-50">/</span>
                          <Keycap>{formatShortcut('Cmd + Z', envInfo.platform)}</Keycap>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('pronounceBtn')}</dt>
                        <dd className="shrink-0"><Keycap>R</Keycap></dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('editCardTitle')}</dt>
                        <dd className="shrink-0"><Keycap>E</Keycap></dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('cardInfoTitle')}</dt>
                        <dd className="shrink-0">
                          <Keycap>{formatShortcut('Cmd + I', envInfo.platform)}</Keycap>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('flagFilterLabel')}</dt>
                        <dd className="shrink-0">
                          <Keycap>{formatShortcut('Cmd + 1~7', envInfo.platform)}</Keycap>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/[0.035] dark:bg-white/[0.04]">
                        <dt className={`${subText} truncate`}>{t('reviewScaleTitle')}</dt>
                        <dd className="shrink-0">
                          <Keycap>{formatShortcut('Cmd + +/-', envInfo.platform)}</Keycap>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            </div>
          )}

          {/* TAB 4: AnkiWeb Sync */}
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
              <div className="space-y-4">
                <h3 className="text-[17px] font-bold tracking-tight">
                  {t('syncCloudTitle')}
                </h3>

                {/* Sync Status Card */}
                <article className={`rounded-xl border p-5 flex items-center justify-between gap-4 ${cardSurface}`}>
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
                    <SyncArrowsIcon
                      className={`w-3.5 h-3.5 ${syncing ? 'motion-safe:animate-spin' : ''}`}
                      strokeWidth={2.2}
                    />
                    <span>{syncing ? t('syncing') : t('syncNowAction')}</span>
                  </button>
                </article>

                {/* Concise Sync Trigger Note */}
                <article className={`rounded-xl border px-4 py-3 flex items-start gap-2.5 text-[12px] ${cardSurface}`}>
                  <span className="pt-0.5 shrink-0">
                    <Keycap>Y</Keycap>
                  </span>
                  <p className={`${subText} leading-relaxed`}>
                    {t('settingsOnDemandSyncBody')}
                  </p>
                </article>
              </div>
            );
          })()}

          {/* TAB 5: Import / Export & System Maintenance Tools */}
          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              <h3 className="text-[17px] font-bold tracking-tight">
                {t('settingsMaintTitle')}
              </h3>

              {/* Section 1: Import & Export */}
              <article className={`rounded-xl border p-4 space-y-3 ${cardSurface}`}>
                <div className="text-[13px] font-semibold">
                  {t('settingsImportExportCardTitle')}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => appActions.triggerNativeImport()}
                    className={`p-3.5 rounded-xl border text-start flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isDark
                        ? 'bg-[#161720] border-[#2E303E] hover:border-[var(--brand)]'
                        : 'bg-white border-[#E5E5EA] hover:border-[var(--brand)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--brand-text)]">
                        {t('settingsImportApkgTitle')}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {t('settingsImportApkgSub')}
                      </div>
                    </div>
                    <DownloadIcon className="w-4 h-4 text-[var(--brand-text)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => appActions.triggerNativeExport()}
                    className={`p-3.5 rounded-xl border text-start flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isDark
                        ? 'bg-[#161720] border-[#2E303E] hover:border-[var(--brand)]'
                        : 'bg-white border-[#E5E5EA] hover:border-[var(--brand)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">
                        {t('settingsExportApkgTitle')}
                      </div>
                      <div className={`text-[11px] ${subText} mt-0.5`}>
                        {t('settingsExportApkgSub')}
                      </div>
                    </div>
                    <UploadIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                </div>
              </article>

              {/* Section 2: System Maintenance & Diagnostics (Single-Level Card + divide-y) */}
              <article className={`rounded-xl border p-4 ${cardSurface}`}>
                <div className="text-[13px] font-semibold mb-1.5">
                  {t('settingsDiagnosticsCardTitle')}
                </div>

                <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-[#E5E5EA]/80'}`}>
                  {/* Check Database */}
                  <div className="py-3 first:pt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">
                          {t('settingsCheckDbTitle')}
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

                    <div role="status" aria-live="polite" className="text-[11px]">
                      {dbReport && (
                        <span className="inline-flex items-center gap-1.5 text-[var(--status-success)] font-semibold">
                          <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                          <span>{dbReport.message}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Empty Cards Check & Cleanup */}
                  <div className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">
                          {t('settingsEmptyCardsTitle')}
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

                    <div role="status" aria-live="polite" className="text-[11px]">
                      {emptyReport && (
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${
                            emptyReport.emptyCount > 0
                              ? 'text-[var(--status-warning)]'
                              : 'text-[var(--status-success)]'
                          }`}
                        >
                          {emptyReport.emptyCount > 0 ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                          ) : (
                            <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                          )}
                          <span>{emptyReport.message}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Media Check & Unused Cleanup */}
                  <div className="py-3 last:pb-1 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">
                          {t('settingsCheckMediaTitle')}
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

                    <div role="status" aria-live="polite" className="text-[11px] space-y-1">
                      {mediaReport && (
                        <>
                          <div
                            className={`inline-flex items-center gap-1.5 font-semibold ${
                              mediaReport.unusedCount > 0 || mediaReport.missingCount > 0
                                ? 'text-[var(--status-warning)]'
                                : 'text-[var(--status-success)]'
                            }`}
                          >
                            {mediaReport.unusedCount > 0 || mediaReport.missingCount > 0 ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                            ) : (
                              <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                            )}
                            <span>{mediaReport.message}</span>
                          </div>
                          {Array.isArray(mediaReport.unusedFiles) && mediaReport.unusedFiles.length > 0 && (
                            <div className={`${subText} truncate`}>
                              {mediaReport.unusedFiles.slice(0, 5).join(', ')}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}

          {/* TAB 6: Native Anki */}
          {activeTab === 'native' && (
            <div className="space-y-4">
              <h3 className="text-[17px] font-bold tracking-tight">
                {t('settingsTabNative')}
              </h3>

              {/* Switch Action Card (Neutral semantics: reversible & lossless) */}
              <article className={`rounded-xl border p-5 flex items-center justify-between gap-4 ${cardSurface}`}>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold">{t('settingsSwitchNativeCardTitle')}</div>
                  <div className={`text-[12px] ${subText} mt-0.5`}>
                    {t('settingsSwitchNativeCardSub')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppState({ settingsOpen: false });
                    appActions.triggerNativeEscape();
                  }}
                  className="btn-secondary !h-10 !px-4 !text-[12.5px] shrink-0"
                >
                  {t('switchToNative')}
                </button>
              </article>

              {/* Concise Return Tip */}
              <article className={`rounded-xl border p-4 space-y-1.5 text-[12px] ${cardSurface}`}>
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
              </article>
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
                      className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center bg-gradient-to-b from-white to-[#F5F6F8] dark:from-[#23252E] dark:to-[#191B22] border border-black/[0.08] dark:border-white/[0.11] shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    >
                      <AnkiStudioLogo size={24} />
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
    </div>
    {pendingAvatarCrop && (
      <AvatarCropModal
        imageSrc={pendingAvatarCrop.previewUrl}
        resolvedLang={resolvedLang}
        isDark={isDark}
        saving={avatarCropSaving}
        onClose={closeAvatarCrop}
        onChangePhoto={() => {
          void handlePickAvatarImage();
        }}
        onImageError={() => {
          showToast(t('avatarUploadTooLargeToast'));
          closeAvatarCrop();
        }}
        onConfirm={handleConfirmAvatarCrop}
      />
    )}
    </>
  );
};
