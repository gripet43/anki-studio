import React, { useEffect, useMemo, useState } from 'react';
import {
  ANKI_FLAG_PALETTE,
  callAnki,
  CardFlagColor,
  CustomStudyParams,
  isAnkiNativeEnv,
} from '../../bridge/pycmd';
import { usePresence } from '../../hooks/usePresence';
import { Tooltip } from '../common/Tooltip';
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
      setTag('all');
      if (nextPreset === 'mistakes') {
        setDays(7);
        setSortOrder('lapses_desc');
        setFlag('all');
        setIsPreviewOnly(true);
      } else if (nextPreset === 'flagged') {
        setFlag('flagged');
        setSortOrder('ivl_asc');
        setIsPreviewOnly(true);
      } else if (nextPreset === 'ahead') {
        setDays(3);
        setSortOrder('due_asc');
        setFlag('all');
        setIsPreviewOnly(true);
      } else if (nextPreset === 'extra_new') {
        setSortOrder('due_asc');
        setFlag('all');
        setIsPreviewOnly(false);
      }
    }
  }, [customStudyModalOpen, customStudyInitialPreset, customStudyInitialDeckId]);

  // Escape key dismissal (WCAG 2.1.1 Keyboard Accessible)
  useEffect(() => {
    if (!customStudyModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        appActions.closeCustomStudyModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [customStudyModalOpen]);

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
        if (preset === 'extra_new') {
          list = list.filter((c) => c.status === 'new');
        } else if (preset === 'mistakes') {
          const lapsed = list.filter(
            (c) => (c.lapses || 0) > 0 || c.difficultyLevel === 'high'
          );
          if (lapsed.length > 0) list = lapsed;
        } else if (preset === 'ahead') {
          list = list.filter((c) => c.status === 'review' || c.status === 'due');
        }
        setMatchedCount(list.length);
      }
    };

    const timer = setTimeout(fetchPreview, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    customStudyModalOpen,
    preset,
    deckId,
    days,
    flag,
    tag,
    sortOrder,
    limit,
    isPreviewOnly,
    libraryCards,
  ]);

  const presence = usePresence(customStudyModalOpen, 120);
  if (!presence.mounted) return null;

  const modalBg =
    theme === 'oled'
      ? 'bg-[#101115] border-[#242630] text-[#F4F4F6]'
      : isDark
      ? 'bg-[#181920] border-[#2C2E3A] text-[#F2F3F7]'
      : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#1D1D1F]';

  const cardSurface =
    theme === 'oled'
      ? 'bg-[#15161C] border-[#242630]'
      : isDark
      ? 'bg-[#1F212A] border-[#2E303D]'
      : 'bg-[#F9F9FB] border-[#ECECF2]';

  const controlBg = isDark
    ? 'bg-[#16171F] border-[#2C2E3B] text-[#F2F3F7]'
    : 'bg-white border-[#E4E5EC] text-[#1D1D1F]';

  const subText = 'text-[#6E6E73] dark:text-[#A4A6B4]';

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
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      id: 'extra_new',
      titleKey: 'customStudyPresetExtraNewTitle',
      descKey: 'customStudyPresetExtraNewDesc',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
  ];

  const handleSelectPreset = (next: CustomStudyParams['preset']) => {
    setPreset(next);
    if (next === 'mistakes') {
      setDays(7);
      setFlag('all');
      setSortOrder('lapses_desc');
      setIsPreviewOnly(true);
    } else if (next === 'flagged') {
      if (flag === 'all' && tag === 'all') setFlag('flagged');
      setSortOrder('ivl_asc');
      setIsPreviewOnly(true);
    } else if (next === 'ahead') {
      setDays(3);
      setFlag('all');
      setSortOrder('due_asc');
      setIsPreviewOnly(true);
    } else if (next === 'extra_new') {
      setFlag('all');
      setSortOrder('due_asc');
      // Extra new cards are typically studied to advance today's new queue,
      // while still allowing the user to toggle cram preview if desired.
      setIsPreviewOnly(false);
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

  const hasSecondaryFilters = flag !== 'all' || tag !== 'all';
  const effectiveDrawCount =
    matchedCount !== null ? Math.min(limit, matchedCount) : limit;

  const renderFlagSelector = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={`text-[11.5px] font-medium ${subText}`}>
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
          className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-all ${
            flag === 'all'
              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)] font-semibold'
              : `${controlBg} opacity-80 hover:opacity-100 hover:border-[var(--brand-border)]`
          }`}
        >
          {t('filterAll')}
        </button>

        <button
          type="button"
          onClick={() => setFlag('flagged')}
          className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-all ${
            flag === 'flagged'
              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)] font-semibold'
              : `${controlBg} opacity-80 hover:opacity-100 hover:border-[var(--brand-border)]`
          }`}
        >
          {t('anyFlaggedOption')}
        </button>

        {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
          const meta = ANKI_FLAG_PALETTE[fNum];
          const isSel = flag === String(fNum);
          return (
            <Tooltip key={fNum} variant="compact" content={t(`flagLabel_${fNum}` as any)}>
              <button
                type="button"
                onClick={() => setFlag(isSel ? 'all' : String(fNum))}
              className={`h-7 px-2 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                isSel
                  ? 'font-semibold shadow-2xs'
                  : `${controlBg} opacity-85 hover:opacity-100`
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
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: meta.hex }}
              />
              <span>{t(`flagShort_${fNum}` as any)}</span>
            </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );

  const renderTagSelector = () => (
    <div>
      <label className={`block text-[11.5px] font-medium ${subText} mb-1.5`}>
        {t('customStudyFilterByTagLabel')}
      </label>
      <select
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        className={`w-full h-8 px-2.5 rounded-xl border text-[12px] focus:outline-none focus:border-[var(--brand)] transition-colors cursor-pointer ${controlBg}`}
      >
        <option value="all">{t('anyTagOption')}</option>
        {availableTags.map((tg) => (
          <option key={tg} value={tg}>
            #{tg}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      data-state={presence.state}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[5px] p-4 select-none ui-modal-backdrop modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-study-modal-title"
    >
      <div
        data-state={presence.state}
        className={`w-full max-w-[560px] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.32)] overflow-hidden flex flex-col max-h-[86vh] ui-modal-panel ${modalBg}`}
      >
        {/* Top Header — Clean Studio Title + Global Target Deck Selector */}
        <header className="px-5 py-3.5 border-b border-black/5 dark:border-white/8 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                <circle cx="12" cy="12" r="9.5" />
                <circle cx="12" cy="12" r="5.5" />
                <circle cx="12" cy="12" r="1.8" fill="currentColor" />
              </svg>
            </div>
            <h2 id="custom-study-modal-title" className="text-[15px] font-bold tracking-tight truncate">
              {t('customStudyModalTitle')}
            </h2>
          </div>

          {/* Global Target Deck Scope + Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="custom-study-deck-select"
                className={`text-[11px] font-medium hidden sm:inline ${subText}`}
              >
                {t('customStudyTargetDeckLabel')}
              </label>
              <select
                id="custom-study-deck-select"
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                aria-label={t('customStudyTargetDeckLabel')}
                className={`h-8 max-w-[180px] px-2.5 rounded-lg border text-[12px] font-medium focus:outline-none focus:border-[var(--brand)] cursor-pointer transition-colors ${controlBg}`}
              >
                <option value="all">{t('allDecksOption')}</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName || d.name}
                  </option>
                ))}
              </select>
            </div>

            <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
              <button
                type="button"
                onClick={() => appActions.closeCustomStudyModal()}
                aria-label={t('close')}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-current hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </Tooltip>
          </div>
        </header>

        {/* Scrollable Body — 3-Tier Information Hierarchy */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tier 1: 4 Mode Cards (Level-2 Tonal Selection — Never competes with solid Primary CTA) */}
          <div
            role="radiogroup"
            aria-label={t('customStudyModalTitle')}
            className="grid grid-cols-2 gap-2.5"
          >
            {presets.map((item) => {
              const active = preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleSelectPreset(item.id)}
                  className={`relative p-3.5 rounded-xl border text-start transition-all cursor-pointer flex items-start gap-3 ${
                    active
                      ? 'bg-[var(--brand-soft)]/65 border-[var(--brand)] ring-1 ring-[var(--brand)]/35 shadow-2xs'
                      : `${cardSurface} hover:border-[var(--brand-border)]`
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      active
                        ? 'bg-[var(--brand-soft-strong)] text-[var(--brand-text)]'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A4A6B4]'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1 pe-3">
                    <div
                      className={`text-[13px] font-semibold leading-tight ${
                        active ? 'text-[var(--brand-text)]' : ''
                      }`}
                    >
                      {t(item.titleKey)}
                    </div>
                    <div className={`text-[11px] ${subText} mt-1 leading-snug line-clamp-2`}>
                      {t(item.descKey)}
                    </div>
                  </div>
                  {active && (
                    <span
                      aria-hidden="true"
                      className=" absolute top-3 end-3 w-2 h-2 rounded-full bg-[var(--brand)]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tier 2: Mode-Specific Core Parameters + Session Limit & Order */}
          <div className={`rounded-xl border p-4 space-y-4 ${cardSurface}`}>
            {/* Contextual Primary Control per Mode */}
            {(preset === 'mistakes' || preset === 'ahead') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[12px] font-semibold">
                    {preset === 'mistakes'
                      ? t('customStudyMistakeWindowLabel')
                      : t('customStudyAheadDaysLabel')}
                  </label>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)]">
                    {days} {t('daysUnit')}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {(preset === 'mistakes' ? [1, 3, 7, 14, 30] : [1, 3, 5, 7, 14]).map((dVal) => {
                    const active = days === dVal;
                    return (
                      <button
                        key={dVal}
                        type="button"
                        onClick={() => setDays(dVal)}
                        className={`h-8 rounded-lg border text-[12px] font-medium cursor-pointer transition-all ${
                          active
                            ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                            : `${controlBg} hover:border-[var(--brand-border)]`
                        }`}
                      >
                        {dVal}d
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {preset === 'flagged' && (
              <div className="space-y-3.5">
                {renderFlagSelector()}
                {renderTagSelector()}
              </div>
            )}

            {preset === 'extra_new' && renderTagSelector()}

            {/* Unified Session Limit (Segmented Track) & Sort Order Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-black/5 dark:border-white/6">
              {/* Session Card Limit — Segmented Track */}
              <div>
                <label className={`block text-[11.5px] font-medium ${subText} mb-1.5`}>
                  {t('customStudySessionLimitLabel')}
                </label>
                <div className="grid grid-cols-4 gap-1 p-0.5 h-8 rounded-xl bg-black/[0.045] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.05]">
                  {[15, 30, 50, 100].map((cnt) => {
                    const active = limit === cnt;
                    return (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setLimit(cnt)}
                        className={`rounded-lg text-[12px] font-mono transition-all cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-[#2A2C38] text-[var(--brand-text)] font-semibold shadow-2xs'
                            : `${subText} hover:text-current`
                        }`}
                      >
                        {cnt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card Sort Order */}
              <div>
                <label className={`block text-[11.5px] font-medium ${subText} mb-1.5`}>
                  {t('customStudyCardOrderLabel')}
                </label>
                <select
                  value={
                    preset === 'extra_new' &&
                    sortOrder !== 'due_asc' &&
                    sortOrder !== 'random'
                      ? 'due_asc'
                      : sortOrder
                  }
                  onChange={(e) =>
                    setSortOrder(e.target.value as CustomStudyParams['sortOrder'])
                  }
                  className={`w-full h-8 px-2.5 rounded-xl border text-[12px] focus:outline-none focus:border-[var(--brand)] transition-colors cursor-pointer ${controlBg}`}
                >
                  {preset !== 'extra_new' && (
                    <>
                      <option value="lapses_desc">{t('sortLapsesDesc')}</option>
                      <option value="ivl_asc">{t('sortIvlAsc')}</option>
                    </>
                  )}
                  <option value="due_asc">{t('sortDueAsc')}</option>
                  <option value="random">{t('sortRandom')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tier 3A: Progressive Disclosure (<details>/<summary>) for Optional Flag/Tag Narrowing when not in 'flagged' preset */}
          {preset !== 'flagged' && (
            <details
              open={hasSecondaryFilters || undefined}
              className={`rounded-xl border px-4 py-2.5 text-[12px] group ${cardSurface}`}
            >
              <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <svg
                    className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  <span className={`font-medium ${subText} group-hover:text-current transition-colors truncate`}>
                    {preset === 'extra_new'
                      ? t('customStudyFilterByFlagLabel')
                      : `${t('customStudyFilterByFlagLabel')} / ${t('customStudyFilterByTagLabel')}`}
                  </span>
                  {hasSecondaryFilters && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--brand-soft)] text-[var(--brand-text)]">
                      {flag !== 'all' && tag !== 'all' ? '2' : '1'}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--brand-text)] font-medium shrink-0 ms-2">
                  {t('customizeLabel')} ▾
                </span>
              </summary>

              <div className="pt-3 mt-2.5 border-t border-black/5 dark:border-white/6 space-y-3">
                {renderFlagSelector()}
                {preset !== 'extra_new' && renderTagSelector()}
              </div>
            </details>
          )}

          {/* Tier 3B: FSRS Schedule Safeguard Switch */}
          <div
            onClick={() => setIsPreviewOnly((prev) => !prev)}
            className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${cardSurface}`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isPreviewOnly
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                    : 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                }`}
              >
                {isPreviewOnly ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold leading-snug">
                  {t('customStudyCramPreviewTitle')}
                </div>
                <div className={`text-[11px] ${subText} mt-0.5 leading-snug`}>
                  {isPreviewOnly
                    ? t('customStudyCramPreviewOnSub')
                    : t('customStudyCramPreviewOffSub')}
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isPreviewOnly}
              aria-label={t('customStudyCramPreviewTitle')}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                isPreviewOnly ? 'bg-[var(--brand)]' : isDark ? 'bg-[#2E303E]' : 'bg-[#D1D1D6]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                  isPreviewOnly ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer — Live Match Status + Sole Level-1 Solid Primary CTA */}
        <footer className="px-5 py-3.5 border-t border-black/5 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.015] flex items-center justify-between gap-3 shrink-0">
          <div className="text-[12px] min-w-0 truncate">
            {previewLoading ? (
              <span className={`inline-flex items-center gap-1.5 ${subText}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
                <span>{t('searchingShort')}</span>
              </span>
            ) : matchedCount !== null ? (
              <span
                className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${
                  matchedCount > 0 ? '' : 'text-[var(--status-warning)]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    matchedCount > 0 ? 'bg-[var(--status-success)]' : 'bg-[var(--status-warning)]'
                  }`}
                />
                <Tooltip
                  variant="compact"
                  content={t('customStudyMatchedSummary', {
                    matched: matchedCount,
                    limit: effectiveDrawCount,
                  })}
                  onlyWhenTruncated
                >
                  <span className="truncate">
                    {t('customStudyMatchedSummary', {
                      matched: matchedCount,
                      limit: effectiveDrawCount,
                    })}
                  </span>
                </Tooltip>
              </span>
            ) : (
              <Tooltip variant="compact" content={t('customStudyModalSub')} onlyWhenTruncated>
                <span className={`truncate ${subText}`}>{t('customStudyModalSub')}</span>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
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
              className="btn-primary !h-9 !px-5 !text-[12px] font-semibold shadow-[0_4px_12px_rgba(var(--brand-rgb),0.22)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-3 h-3 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
              <span>
                {t('customStudyStartSessionBtn')}
                {matchedCount ? ` (${effectiveDrawCount})` : ''}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
