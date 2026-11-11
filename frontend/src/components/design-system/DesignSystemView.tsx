import React, { useEffect, useState } from 'react';
import {
  getLanguageMeta,
  LanguageOption,
  SUPPORTED_LANGUAGES,
  translate,
} from '../../i18n/translations';
import { appActions, showToast, ThemeMode, useAppStore } from '../../stores/useAppStore';
import { ACCENT_COLOR_LIST, ACCENT_THEMES, getAccentScale } from '../../utils/themeTokens';

export const DesignSystemView: React.FC = () => {
  const { theme, accentColor, languagePref, resolvedLang, customNickname, dashboard } =
    useAppStore();
  const isDark = theme === 'dark' || theme === 'oled';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const [nicknameDraft, setNicknameDraft] = useState(customNickname || '');

  useEffect(() => {
    setNicknameDraft(customNickname || '');
  }, [customNickname]);

  const currentScale = getAccentScale(accentColor, theme);
  const currentMeta = ACCENT_THEMES[accentColor] || ACCENT_THEMES.indigo;

  const cardSurface =
    theme === 'oled'
      ? 'bg-[#111216] border-[#22232B] text-white'
      : theme === 'dark'
      ? 'bg-[#1A1B21] border-[#2A2C36] text-white'
      : 'bg-white border-[#EBEBF0] text-[#1D1D1F]';

  const subText = 'text-[#8E8E93]';

  const colorSwatches = [
    { hex: currentScale.brand, label: 'Brand', bg: '' },
    { hex: currentScale.brandSoft, label: 'Soft Tint', bg: 'border border-[var(--brand-border)]' },
    { hex: currentScale.brandMutedBar, label: 'Muted Bar', bg: '' },
    { hex: currentScale.heatmap[2], label: 'Heatmap 3', bg: '' },
    { hex: isDark ? '#1A1B21' : '#F4F4F6', label: 'Surface', bg: 'border border-black/10 dark:border-white/10' },
  ];

  const themeOptions: Array<{ id: ThemeMode; label: string; style: string }> = [
    { id: 'light', label: t('themeLight'), style: 'bg-white text-[var(--brand-text)] border-2 border-[var(--brand)]' },
    { id: 'dark', label: t('themeDark'), style: 'bg-[#131418] text-white border border-[#2A2C36]' },
    { id: 'oled', label: t('themeOled'), style: 'bg-[#09090C] text-white border border-[#22232B]' },
  ];

  const languageGridItems: Array<{ id: LanguageOption; nativeName: string; subLabel: string }> = [
    {
      id: 'auto',
      nativeName: t('langAuto'),
      subLabel: `Auto · ${getLanguageMeta(resolvedLang).nativeName}`,
    },
    ...SUPPORTED_LANGUAGES.map((l) => ({
      id: l.id as LanguageOption,
      nativeName: l.nativeName,
      subLabel: l.englishName,
    })),
  ];

  return (
    <div className="flex-1 h-screen overflow-y-auto px-8 py-6 space-y-6 select-none">
      {/* Page 7: Core Design System & Theme / Language / Profile Preferences */}
      <section className={`rounded-2xl border p-7 shadow-xs ${cardSurface}`}>
        <div className="flex items-center justify-between pb-5 border-b border-[#EFEFF4] dark:border-[#2A2C36]">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">{t('designSystemTitle')}</h1>
            <p className={`text-[12px] ${subText} mt-1`}>
              {t('activeAccentSubtitle', {
                name: t(`accentName_${currentMeta.id}` as any),
                hex: currentScale.brand,
              })}
            </p>
          </div>
          <span className={`text-[12px] ${subText}`}>{t('designSystemSub')}</span>
        </div>

        <div className="grid grid-cols-12 gap-8 pt-6">
          {/* Left: Dynamic SaaS Color Tokens */}
          <div className="col-span-5">
            <div className={`text-[12px] ${subText} mb-3.5`}>
              {t('designSystemActiveTokens')}
            </div>
            <div className="flex items-center gap-3.5">
              {colorSwatches.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-2">
                  <div
                    style={{ backgroundColor: s.hex }}
                    className={`w-14 h-14 rounded-2xl shadow-xs ${s.bg}`}
                  />
                  <span className="text-[10px] font-semibold text-[#8E8E93]">{s.label}</span>
                  <span className="text-[10px] font-mono text-[#8E8E93]/80">{s.hex}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Middle: Typography */}
          <div className="col-span-3">
            <div className={`text-[12px] ${subText} mb-3.5`}>
              {t('designSystemTypography')}
            </div>
            <div className="space-y-2">
              <div className="text-[20px] font-semibold leading-tight">{t('navDashboard')}</div>
              <div className="text-[15px] font-medium">
                {t('cardFrontHeading')}
              </div>
              <div className={`text-[12px] ${subText}`}>
                {t('secondaryMetadataCaption')}
              </div>
              <div className="text-[11px] text-[#AEAEB2] pt-1">
                20 / 14 / 10 · SemiBold / Medium / Regular
              </div>
            </div>
          </div>

          {/* Right: Theme & 8 Accent Color Switcher (Persisted to Add-on Config) */}
          <div className="col-span-4">
            <div className={`text-[12px] ${subText} mb-3.5`}>
              {t('themeAndAccentsTitle')}
            </div>
            <div className="flex items-center gap-2.5 mb-4">
              {themeOptions.map((tOpt) => (
                <button
                  key={tOpt.id}
                  onClick={() => {
                    appActions.setTheme(tOpt.id);
                    showToast(t('savedThemeToast', { name: tOpt.label }));
                  }}
                  className={`px-3.5 py-2 rounded-xl text-[12px] font-medium cursor-pointer transition-transform active:scale-95 ${
                    tOpt.style
                  } ${theme === tOpt.id ? 'ring-2 ring-[var(--brand)]/40' : 'opacity-80 hover:opacity-100'}`}
                >
                  {tOpt.label}
                </button>
              ))}
            </div>

            <div
              role="radiogroup"
              aria-label={t('designSystemAccentAria')}
              className="grid grid-cols-4 gap-2.5"
            >
              {ACCENT_COLOR_LIST.map((a) => {
                const modeScale = isDark ? a.dark : a.light;
                const active = accentColor === a.id;
                const shortLabel = t(`accentShort_${a.id}` as any);
                const fullLabel = t(`accentName_${a.id}` as any);
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      appActions.setAccentColor(a.id);
                      showToast(t('savedAccentToast', { name: shortLabel }));
                    }}
                    title={fullLabel}
                    className={`px-2 py-1.5 rounded-xl border text-[11px] flex items-center gap-1.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-[var(--brand)] ${
                      active
                        ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold shadow-2xs'
                        : 'border-black/10 dark:border-white/10 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: modeScale.brand }}
                      className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                    />
                    <span className="truncate">{shortLabel}</span>
                    {a.isOfficial && (
                      <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-[var(--brand-softStrong)] text-[var(--brand-text)] shrink-0">
                        {t('officialBrandBadge')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Part 3 #1, #2, #4: Tiled Language Switcher (No Dropdown) & Profile Nickname Persistence */}
      <section className={`rounded-2xl border p-7 shadow-xs grid grid-cols-12 gap-8 ${cardSurface}`}>
        <div className="col-span-7 space-y-3">
          <div>
            <div className="text-[14px] font-bold">{t('languageLabel')}</div>
            <p className={`text-[12px] ${subText} mt-0.5`}>
              {t('languageAutoFollowSub')}
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label={t('languageLabel')}
            className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1"
          >
            {languageGridItems.map((langOpt) => {
              const active = languagePref === langOpt.id;
              return (
                <button
                  key={langOpt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    appActions.setLanguage(langOpt.id);
                    const meta = langOpt.id === 'auto' ? null : getLanguageMeta(langOpt.id);
                    showToast(
                      meta
                        ? `${meta.nativeName} (${meta.englishName})`
                        : t('langAuto')
                    );
                  }}
                  className={`px-3 py-2 rounded-xl border text-start cursor-pointer transition-all ${
                    active
                      ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)] ring-1 ring-[var(--brand)]/35 font-semibold'
                      : 'border-[#E5E5EA] dark:border-[#2C2C35] hover:border-[var(--brand-border)]'
                  }`}
                >
                  <div className="text-[12px] leading-snug truncate">{langOpt.nativeName}</div>
                  <div className="text-[10px] text-[#8E8E93] truncate mt-0.5">{langOpt.subLabel}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-5 space-y-3">
          <div className="text-[14px] font-bold">{t('nicknameLabel')}</div>
          <p className={`text-[12px] ${subText}`}>
            {t('activeProfileNameSub', { name: dashboard.userName || t('defaultUser') })}
          </p>
          <div className="flex items-center gap-2.5 pt-1">
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
              className="h-9 px-3.5 rounded-xl border border-[#E5E5EA] dark:border-[#2C2C35] text-[12px] flex-1 bg-transparent focus:outline-none focus:border-[var(--brand)]"
            />
            <button
              onClick={() => {
                appActions.updatePreferences({ customNickname: nicknameDraft });
                showToast(t('nicknameSavedToast'));
              }}
              className="btn-primary !h-9 !px-4"
            >
              {t('saveNickname')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
