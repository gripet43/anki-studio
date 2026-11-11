import React, { useEffect, useMemo, useState } from 'react';
import {
  ANKI_FLAG_PALETTE,
  callAnki,
  CardFlagColor,
  CustomStudyParams,
  isAnkiNativeEnv,
} from '../../bridge/pycmd';
import { usePresence } from '../../hooks/usePresence';
import { translate } from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const CustomStudyModal: React.FC = () => {
  const {
    customStudyModalOpen,
    customStudyInitialPreset,
    customStudyInitialDeckId,
    decks,
    libraryAllTags,
    libraryCards,
    theme,
    accentColor,
    resolvedLang,
  } = useAppStore();

  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  const isDark = theme === 'dark' || theme === 'oled';
  const brandHex = getAccentScale(accentColor, theme).brand;

  const [preset, setPreset] = useState<CustomStudyParams['preset']>(
    customStudyInitialPreset || 'mistakes'
  );
  const [deckId, setDeckId] = useState<string>(customStudyInitialDeckId || 'all');
  const [days, setDays] = useState<number>(7);
  const [flag, setFlag] = useState<string>('all');
  const [tag, setTag] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<CustomStudyParams['sortOrder']>('lapses_desc');
  const [limit, setLimit] = useState<number>(30);
  const [isPreviewOnly, setIsPreviewOnly] = useState<boolean>(true);
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  useEffect(() => {
    if (customStudyModalOpen) {
      const nextPreset = customStudyInitialPreset || 'mistakes';
      setPreset(nextPreset);
      setDeckId(customStudyInitialDeckId || 'all');
      if (nextPreset === 'mistakes') {
        setDays(7);
        setSortOrder('lapses_desc');
        setFlag('all');
      } else if (nextPreset === 'flagged') {
        setFlag('flagged');
        setSortOrder('ivl_asc');
      } else if (nextPreset === 'ahead') {
        setDays(3);
        setSortOrder('due_asc');
      } else if (nextPreset === 'extra_new') {
        setSortOrder('due_asc');
      }
    }
  }, [customStudyModalOpen, customStudyInitialPreset, customStudyInitialDeckId]);

  const availableTags = useMemo(() => {
    const s = new Set<string>(libraryAllTags);
    for (const c of libraryCards) {
      for (const tg of c.tags) s.add(tg);
    }
    return Array.from(s);
  }, [libraryAllTags, libraryCards]);

  // Live preview of matched cards count
  useEffect(() => {
    if (!customStudyModalOpen) return;
    let cancelled = false;

    const fetchPreview = async () => {
      if (isAnkiNativeEnv()) {
        setPreviewLoading(true);
        try {
          const res = await callAnki<{ totalMatched?: number; count?: number }>(
            'preview_custom_study',
            {
              preset,
              deckId,
              days,
              flag,
              tag,
              sortOrder,
              limit,
              isPreviewOnly,
            }
          );
          if (!cancelled && res && typeof res.totalMatched === 'number') {
            setMatchedCount(res.totalMatched);
          }
        } catch {
          if (!cancelled) setMatchedCount(null);
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      } else {
        let list = libraryCards.filter((c) => !c.suspended);
        if (deckId !== 'all') list = list.filter((c) => c.deckId === deckId);
        if (flag === 'flagged') list = list.filter((c) => (c.flags || 0) > 0);
        else if (flag !== 'all') list = list.filter((c) => (c.flags || 0) === Number(flag));
        if (tag !== 'all') list = list.filter((c) => c.tags.includes(tag));
        if (preset === 'extra_new') list = list.filter((c) => c.status === 'new');
        setMatchedCount(list.length);
      }
    };

    const timer = setTimeout(fetchPreview, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customStudyModalOpen, preset, deckId, days, flag, tag, sortOrder, limit, isPreviewOnly, libraryCards]);

  const presence = usePresence(customStudyModalOpen, 120);
  if (!presence.mounted) return null;

  const modalSurface =
    theme === 'oled'
      ? 'bg-[#111216] border-[#252730] text-white'
      : theme === 'dark'
      ? 'bg-[#191A22] border-[#2C2E3B] text-white'
      : 'bg-white border-[#E5E5EA] text-[#1D1D1F]';

  const cardBg = isDark ? 'bg-[#14151C] border-[#262834]' : 'bg-[#F8F8FA] border-[#EAECEF]';
  const subText = 'text-[#8E8E93]';

  const presets: Array<{
    id: CustomStudyParams['preset'];
    titleKey: string;
    descKey: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'mistakes',
      titleKey: 'customStudyPresetMistakesTitle',
      descKey: 'customStudyPresetMistakesDesc',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      id: 'flagged',
      titleKey: 'customStudyPresetFlaggedTitle',
      descKey: 'customStudyPresetFlaggedDesc',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      ),
    },
    {
      id: 'ahead',
      titleKey: 'customStudyPresetAheadTitle',
      descKey: 'customStudyPresetAheadDesc',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      id: 'extra_new',
      titleKey: 'customStudyPresetExtraNewTitle',
      descKey: 'customStudyPresetExtraNewDesc',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
  ];

  const handleSelectPreset = (next: CustomStudyParams['preset']) => {
    setPreset(next);
    if (next === 'mistakes') {
      setSortOrder('lapses_desc');
    } else if (next === 'flagged') {
      if (flag === 'all' && tag === 'all') setFlag('flagged');
      setSortOrder('ivl_asc');
    } else if (next === 'ahead') {
      setDays(3);
      setSortOrder('due_asc');
    } else if (next === 'extra_new') {
      setSortOrder('due_asc');
    }
  };

  const handleStart = () => {
    appActions.startCustomStudySession({
      preset,
      deckId,
      days,
      flag,
      tag,
      sortOrder,
      limit,
      isPreviewOnly,
    });
  };

  return (
    <div
      data-state={presence.state}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none ui-modal-backdrop"
    >
      <div
        data-state={presence.state}
        role="dialog"
        aria-modal="true"
        aria-label={t('customStudyModalTitle')}
        className={`w-[580px] max-w-full rounded-3xl border shadow-2xl overflow-hidden flex flex-col ui-modal-panel ${modalSurface}`}
      >
        {/* Header */}
        <header
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-[#262834]' : 'border-[#EFEFF4]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div>
              <h2 className="text-[16px] font-bold tracking-tight">
                {t('customStudyModalTitle')}
              </h2>
              <p className={`text-[11px] ${subText}`}>
                {t('customStudyModalSub')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => appActions.closeCustomStudyModal()}
            aria-label={t('close')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-current hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            ✕
          </button>
        </header>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[76vh] overflow-y-auto">
          {/* 4 Preset Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {presets.map((item) => {
              const active = preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPreset(item.id)}
                  className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer flex items-start gap-3 ${
                    active
                      ? 'bg-[var(--brand-surface)] border-[var(--brand)] ring-1 ring-[var(--brand)]/30'
                      : `${cardBg} hover:border-[var(--brand-border)]`
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      active
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">
                      {t(item.titleKey)}
                    </div>
                    <div className={`text-[11px] ${subText} mt-0.5 leading-snug`}>
                      {t(item.descKey)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Scope & Filters */}
          <div className={`rounded-2xl border p-4 space-y-4 ${cardBg}`}>
            <div className="grid grid-cols-2 gap-3">
              {/* Target Deck */}
              <div>
                <label className={`block text-[11px] font-medium ${subText} mb-1.5`}>
                  {t('customStudyTargetDeckLabel')}
                </label>
                <select
                  value={deckId}
                  onChange={(e) => setDeckId(e.target.value)}
                  className={`w-full h-9 px-3 rounded-xl border text-[12px] focus:outline-none focus:border-[var(--brand)] ${
                    isDark ? 'bg-[#1A1B23] border-[#2E303E]' : 'bg-white border-[#E5E5EA]'
                  }`}
                >
                  <option value="all">{t('allDecksOption')}</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName || d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic 2nd Control: Days Lookback / Lookahead OR Tag Filter */}
              {preset === 'mistakes' || preset === 'ahead' ? (
                <div>
                  <label className={`block text-[11px] font-medium ${subText} mb-1.5`}>
                    {preset === 'mistakes'
                      ? t('customStudyMistakeWindowLabel')
                      : t('customStudyAheadDaysLabel')}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {(preset === 'mistakes' ? [1, 3, 7, 14, 30] : [1, 3, 7, 14]).map((dVal) => (
                      <button
                        key={dVal}
                        type="button"
                        onClick={() => setDays(dVal)}
                        className={`flex-1 h-9 rounded-xl border text-[12px] font-medium cursor-pointer transition-colors ${
                          days === dVal
                            ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                            : isDark
                            ? 'bg-[#1A1B23] border-[#2E303E] hover:border-[var(--brand-border)]'
                            : 'bg-white border-[#E5E5EA] hover:border-[var(--brand-border)]'
                        }`}
                      >
                        {dVal}d
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className={`block text-[11px] font-medium ${subText} mb-1.5`}>
                    {t('customStudyFilterByTagLabel')}
                  </label>
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className={`w-full h-9 px-3 rounded-xl border text-[12px] focus:outline-none focus:border-[var(--brand)] ${
                      isDark ? 'bg-[#1A1B23] border-[#2E303E]' : 'bg-white border-[#E5E5EA]'
                    }`}
                  >
                    <option value="all">{t('anyTagOption')}</option>
                    {availableTags.map((tg) => (
                      <option key={tg} value={tg}>
                        #{tg}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 7-Color Flag Selector Row */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-[11px] font-medium ${subText}`}>
                  {t('customStudyFilterByFlagLabel')}
                </label>
                {flag !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFlag('all')}
                    className="text-[11px] text-[var(--brand-text)] hover:underline cursor-pointer"
                  >
                    {t('resetFilters')}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFlag('all')}
                  className={`h-8 px-2.5 rounded-xl border text-[11px] font-medium cursor-pointer transition-all ${
                    flag === 'all'
                      ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)]'
                      : isDark
                      ? 'bg-[#1A1B23] border-[#2E303E] text-[#8E8E93]'
                      : 'bg-white border-[#E5E5EA] text-[#636366]'
                  }`}
                >
                  {t('filterAll')}
                </button>

                <button
                  type="button"
                  onClick={() => setFlag('flagged')}
                  className={`h-8 px-2.5 rounded-xl border text-[11px] font-medium cursor-pointer transition-all ${
                    flag === 'flagged'
                      ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)]'
                      : isDark
                      ? 'bg-[#1A1B23] border-[#2E303E] text-[#8E8E93]'
                      : 'bg-white border-[#E5E5EA] text-[#636366]'
                  }`}
                >
                  {t('anyFlaggedOption')}
                </button>

                {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
                  const meta = ANKI_FLAG_PALETTE[fNum];
                  const isSel = flag === String(fNum);
                  return (
                    <button
                      key={fNum}
                      type="button"
                      onClick={() => setFlag(isSel ? 'all' : String(fNum))}
                      title={t(`flagLabel_${fNum}` as any)}
                      className={`h-8 px-2.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                        isSel
                          ? 'ring-2 ring-offset-1 dark:ring-offset-[#14151C]'
                          : isDark
                          ? 'bg-[#1A1B23] border-[#2E303E] hover:border-white/20'
                          : 'bg-white border-[#E5E5EA] hover:border-black/20'
                      }`}
                      style={
                        isSel
                          ? {
                              backgroundColor: meta.bgSoft,
                              borderColor: meta.hex,
                              color: meta.hex,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.hex }}
                      />
                      <span>{t(`flagShort_${fNum}` as any)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card Count & Sort Order */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className={`block text-[11px] font-medium ${subText} mb-1.5`}>
                  {t('customStudySessionLimitLabel')}
                </label>
                <div className="flex items-center gap-1.5">
                  {[15, 30, 50, 100].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setLimit(cnt)}
                      className={`flex-1 h-8 rounded-xl border text-[12px] font-medium cursor-pointer transition-colors ${
                        limit === cnt
                          ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                          : isDark
                          ? 'bg-[#1A1B23] border-[#2E303E]'
                          : 'bg-white border-[#E5E5EA]'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-medium ${subText} mb-1.5`}>
                  {t('customStudyCardOrderLabel')}
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as CustomStudyParams['sortOrder'])}
                  className={`w-full h-8 px-2.5 rounded-xl border text-[12px] focus:outline-none focus:border-[var(--brand)] ${
                    isDark ? 'bg-[#1A1B23] border-[#2E303E]' : 'bg-white border-[#E5E5EA]'
                  }`}
                >
                  <option value="lapses_desc">{t('sortLapsesDesc')}</option>
                  <option value="ivl_asc">{t('sortIvlAsc')}</option>
                  <option value="random">{t('sortRandom')}</option>
                  <option value="due_asc">{t('sortDueAsc')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* FSRS Schedule Mode Toggle */}
          <div
            onClick={() => setIsPreviewOnly((prev) => !prev)}
            className={`rounded-2xl border px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${cardBg}`}
          >
            <div>
              <div className="text-[12px] font-semibold">
                {t('customStudyCramPreviewTitle')}
              </div>
              <div className={`text-[11px] ${subText} mt-0.5`}>
                {isPreviewOnly
                  ? t('customStudyCramPreviewOnSub')
                  : t('customStudyCramPreviewOffSub')}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isPreviewOnly}
              className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                isPreviewOnly ? 'bg-[var(--brand)]' : isDark ? 'bg-[#2E303E]' : 'bg-[#D1D1D6]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  isPreviewOnly ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer
          className={`px-6 py-4 border-t flex items-center justify-between ${
            isDark ? 'border-[#262834] bg-[#14151C]/60' : 'border-[#EFEFF4] bg-[#FAFAFC]'
          }`}
        >
          <div className="text-[12px]">
            {previewLoading ? (
              <span className={subText}>{t('searchingShort')}</span>
            ) : matchedCount !== null ? (
              <span className={matchedCount > 0 ? 'font-medium' : 'text-[var(--status-warning)]'}>
                {t('customStudyMatchedSummary', {
                  matched: matchedCount,
                  limit: Math.min(limit, matchedCount),
                })}
              </span>
            ) : (
              <span className={subText}>{t('customStudyModalSub')}</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => appActions.closeCustomStudyModal()}
              className="btn-secondary !h-9 !px-4 !text-[12px]"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              disabled={matchedCount === 0}
              onClick={handleStart}
              style={{ backgroundColor: brandHex }}
              className="btn-primary !h-9 !px-5 !text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>▶</span>
              <span>
                {t('customStudyStartSessionBtn')}
                {matchedCount ? ` (${Math.min(limit, matchedCount)})` : ''}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
