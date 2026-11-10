import React, { useEffect, useState } from 'react';
import { LanguageOption, translate } from '../../i18n/translations';
import { appActions, showToast, ThemeMode, useAppStore } from '../../stores/useAppStore';
import { ACCENT_COLOR_LIST, ACCENT_THEMES, getAccentScale } from '../../utils/themeTokens';

export const DesignSystemView: React.FC = () => {
  const { theme, accentColor, languagePref, resolvedLang, customNickname, dashboard } =
    useAppStore();
  const isZh = resolvedLang === 'zh-CN';
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

  const languageOptions: Array<{ id: LanguageOption; label: string }> = [
    { id: 'auto', label: t('langAuto') },
    { id: 'zh-CN', label: t('langZh') },
    { id: 'en', label: t('langEn') },
  ];

  return (
    <div className="flex-1 h-screen overflow-y-auto px-8 py-6 space-y-6 select-none">
      {/* Page 7: Core Design System & Theme / Language / Profile Preferences */}
      <section className={`rounded-2xl border p-7 shadow-xs ${cardSurface}`}>
        <div className="flex items-center justify-between pb-5 border-b border-[#EFEFF4] dark:border-[#2A2C36]">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">{t('designSystemTitle')}</h1>
            <p className={`text-[12px] ${subText} mt-1`}>
              {isZh
                ? `当前生效主题色：${currentMeta.nameZh} (${currentScale.brand}) · ${currentMeta.descZh}`
                : `Active SaaS Accent: ${currentMeta.nameEn} (${currentScale.brand})`}
            </p>
          </div>
          <span className={`text-[12px] ${subText}`}>{t('designSystemSub')}</span>
        </div>

        <div className="grid grid-cols-12 gap-8 pt-6">
          {/* Left: Dynamic SaaS Color Tokens */}
          <div className="col-span-5">
            <div className={`text-[12px] ${subText} mb-3.5`}>
              {isZh ? '动态色彩令牌 Active Tokens' : 'Dynamic Color Tokens'}
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
              {isZh ? '字体层级 Typography · SF Pro / Inter' : 'Typography Hierarchy'}
            </div>
            <div className="space-y-2">
              <div className="text-[20px] font-semibold leading-tight">{t('navDashboard')}</div>
              <div className="text-[15px] font-medium">
                {isZh ? '卡片正面' : 'Card Front Heading'}
              </div>
              <div className={`text-[12px] ${subText}`}>
                {isZh ? '说明文字与元信息' : 'Secondary metadata & captions'}
              </div>
              <div className="text-[11px] text-[#AEAEB2] pt-1">
                20 / 14 / 10 · SemiBold / Medium / Regular
              </div>
            </div>
          </div>

          {/* Right: Theme & 8 Accent Color Switcher (Persisted to Add-on Config) */}
          <div className="col-span-4">
            <div className={`text-[12px] ${subText} mb-3.5`}>
              {isZh ? '主题模式与 8 套现代 SaaS 强调色' : 'Theme & 8 Curated SaaS Accents'}
            </div>
            <div className="flex items-center gap-2.5 mb-4">
              {themeOptions.map((tOpt) => (
                <button
                  key={tOpt.id}
                  onClick={() => {
                    appActions.setTheme(tOpt.id);
                    showToast(
                      isZh
                        ? `已切换并保存「${tOpt.label}」主题`
                        : `Saved "${tOpt.label}" theme`
                    );
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
                aria-label={isZh ? '设计系统全局强调色' : 'Design System Accent Colors'}
                className="grid grid-cols-4 gap-2.5"
              >
                {ACCENT_COLOR_LIST.map((a) => {
                  const modeScale = isDark ? a.dark : a.light;
                  const active = accentColor === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        appActions.setAccentColor(a.id);
                        showToast(
                          isZh ? `已保存强调色：${a.shortNameZh}` : `Saved accent: ${a.shortNameEn}`
                        );
                      }}
                      title={isZh ? `${a.nameZh} · ${a.descZh}` : `${a.nameEn} · ${a.descEn}`}
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
                      <span className="truncate">{isZh ? a.shortNameZh : a.shortNameEn}</span>
                      {a.isOfficial && (
                        <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-[var(--brand-softStrong)] text-[var(--brand-text)] shrink-0">
                          {isZh ? '官方' : 'Brand'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
          </div>
        </div>
      </section>

      {/* Part 3 #1, #2, #4: Language Switcher & Profile Nickname Persistence */}
      <section className={`rounded-2xl border p-7 shadow-xs grid grid-cols-12 gap-8 ${cardSurface}`}>
        <div className="col-span-6 space-y-3">
          <div className="text-[14px] font-bold">{t('languageLabel')}</div>
          <p className={`text-[12px] ${subText}`}>
            {isZh
              ? '支持自动跟随 Anki 客户端语言（anki.lang.current_lang）或手动指定中英文'
              : 'Automatically follows Anki client interface language or manual override'}
          </p>
          <div className="flex items-center gap-2.5 pt-1">
            {languageOptions.map((langOpt) => {
              const active = languagePref === langOpt.id;
              return (
                <button
                  key={langOpt.id}
                  onClick={() => {
                    appActions.setLanguage(langOpt.id);
                    showToast(
                      langOpt.id === 'en'
                        ? 'Language set to English'
                        : '界面语言已更新并保存'
                    );
                  }}
                  className={`px-4 py-2 rounded-xl border text-[12px] font-medium cursor-pointer transition-colors ${
                    active
                      ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                      : 'border-[#E5E5EA] dark:border-[#2C2C35] hover:border-[var(--brand)]'
                  }`}
                >
                  {langOpt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-6 space-y-3">
          <div className="text-[14px] font-bold">{t('nicknameLabel')}</div>
          <p className={`text-[12px] ${subText}`}>
            {isZh
              ? `当前生效用户名：${dashboard.userName || '（默认读取 Anki Profile 名称）'}`
              : `Active profile name: ${dashboard.userName || '(Anki Profile Default)'}`}
          </p>
          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="text"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  appActions.updatePreferences({ customNickname: nicknameDraft });
                  showToast(isZh ? '个人昵称已持久化保存' : 'Nickname saved');
                }
              }}
              placeholder={t('nicknamePlaceholder')}
              className="h-9 px-3.5 rounded-xl border border-[#E5E5EA] dark:border-[#2C2C35] text-[12px] flex-1 bg-transparent focus:outline-none focus:border-[var(--brand)]"
            />
            <button
              onClick={() => {
                appActions.updatePreferences({ customNickname: nicknameDraft });
                showToast(isZh ? '个人昵称已持久化保存' : 'Nickname saved');
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
