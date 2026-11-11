import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatShortcut, translate } from '../../i18n/translations';
import { appActions, setAppState, showToast, useAppStore } from '../../stores/useAppStore';
import { copyTextToClipboard } from '../../utils/clipboard';
import { getDeckColorByHash, renderMathAndRichHtml } from '../../utils/mathRenderer';
import { getAccentScale } from '../../utils/themeTokens';

function extractCopyableText(htmlContent?: string, fallbackPlain?: string): string {
  const raw = (htmlContent || '').trim();
  if (!raw) return (fallbackPlain || '').trim();
  if (!/[<&]/.test(raw)) return raw;
  try {
    const withLineBreaks = raw
      .replace(/<\/(?:div|p|li|tr|blockquote|h[1-6])>\s*<(?:div|p|li|tr|blockquote|h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>|<\/?(?:div|p|li|tr|blockquote|h[1-6])\b[^>]*>/gi, '\n');
    const doc = new DOMParser().parseFromString(withLineBreaks, 'text/html');
    const extracted = (doc.body.textContent || '')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return extracted || (fallbackPlain || '').trim();
  } catch {
    return (fallbackPlain || raw).trim();
  }
}

export const CommandPaletteModal: React.FC = () => {
  const {
    cmdKOpen,
    cmdKQuery,
    cmdKSelectedIndex,
    cmdKResults,
    cmdKSearching,
    libraryCards,
    libraryTotalCount,
    libraryAllTags,
    decks,
    theme,
    accentColor,
    resolvedLang,
    envInfo,
  } = useAppStore();

  const [copiedSide, setCopiedSide] = useState<'front' | 'back' | 'all' | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark' || theme === 'oled';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  formatShortcut('Cmd Enter', envInfo.platform);

  const brandHex = getAccentScale(accentColor, theme).brand;

  const hasQuery = cmdKQuery.trim().length > 0;
  const displayedResults = hasQuery ? cmdKResults : [];
  const activeCard = displayedResults[cmdKSelectedIndex] || displayedResults[0] || null;

  // Dynamic filter pills bound to actual existing tags and decks
  const quickSearchPills = useMemo<Array<{ label: string; query: string; icon: React.ReactNode }>>(() => {
    const firstTag = libraryAllTags && libraryAllTags.length > 0 ? libraryAllTags[0] : null;
    const tagIcon = (
      <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <path d="M7 7h.01" />
      </svg>
    );
    const tagPill = firstTag
      ? { label: `#${firstTag}`, query: `tag:${firstTag}`, icon: tagIcon }
      : { label: t('tagFilterLabel'), query: 'tag:', icon: tagIcon };

    const firstDeck = decks && decks.length > 0 ? decks[0] : null;
    const deckIcon = (
      <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    );
    const deckPill = firstDeck
      ? {
          label: `${t('deckFilterLabel')} · ${firstDeck.name}`,
          query: `deck:${firstDeck.name}`,
          icon: deckIcon,
        }
      : { label: t('deckFilterLabel'), query: 'deck:', icon: deckIcon };

    return [
      {
        label: t('statusDue'),
        query: 'is:due',
        icon: (
          <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      {
        label: t('statusNew'),
        query: 'is:new',
        icon: (
          <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
        ),
      },
      tagPill,
      deckPill,
    ];
  }, [libraryAllTags, decks, resolvedLang]);

  useEffect(() => {
    setCopiedSide(null);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, [activeCard?.id, cmdKOpen]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!cmdKOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAppState({ cmdKOpen: false });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (displayedResults.length > 0) {
          setAppState((prev) => ({
            cmdKSelectedIndex: (prev.cmdKSelectedIndex + 1) % displayedResults.length,
          }));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (displayedResults.length > 0) {
          setAppState((prev) => ({
            cmdKSelectedIndex:
              (prev.cmdKSelectedIndex - 1 + displayedResults.length) % displayedResults.length,
          }));
        }
      } else if (e.key === 'Enter' && activeCard) {
        e.preventDefault();
        setAppState({ cmdKOpen: false });
        appActions.openCardEditor(activeCard);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cmdKOpen, displayedResults.length, activeCard]);

  if (!cmdKOpen) return null;

  const handleCopyText = async (rawText: string, side: 'front' | 'back' | 'all' = 'all') => {
    const success = await copyTextToClipboard(rawText);
    if (!success) {
      showToast(t('copyFailedToast'));
      return;
    }
    setCopiedSide(side);

    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopiedSide(null);
      copyTimerRef.current = null;
    }, 2000);
  };

  const renderCopyButton = ({
    side,
    label,
    title,
    getText,
    hoverRevealClass = '',
  }: {
    side: 'front' | 'back' | 'all';
    label: string;
    title: string;
    getText: () => string;
    hoverRevealClass?: string;
  }) => {
    const isCopied = copiedSide === side;
    const isInlineSide = side !== 'all';
    return (
      <button
        type="button"
        onClick={() => handleCopyText(getText(), side)}
        title={title}
        aria-label={title}
        className={`${
          isInlineSide ? 'px-2 py-0.5 min-h-[24px]' : 'px-2.5 py-1'
        } rounded-md text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-all duration-150 focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
          isCopied
            ? 'bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[var(--status-success)]/30 opacity-100 pointer-events-auto'
            : isDark
            ? 'bg-white/6 hover:bg-white/12 text-[#8E8E93] hover:text-white border border-transparent'
            : isInlineSide
            ? 'bg-white hover:bg-[#EFEFF4] text-[#636366] hover:text-[#1D1D1F] border border-[#E5E5EA] shadow-2xs'
            : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#636366] hover:text-[#1D1D1F] border border-transparent'
        } ${!isCopied ? hoverRevealClass : ''}`}
      >
        {isCopied ? (
          <>
            <svg className="w-3 h-3 text-[var(--status-success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{t('copiedBadge')}</span>
          </>
        ) : (
          <>
            <svg className="w-3 h-3 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{label}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 select-none animate-in fade-in duration-150 modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-label={t('cmdPaletteAriaLabel')}
    >
      <div
        className={`w-[840px] max-w-full rounded-2xl border shadow-[0_24px_64px_rgba(0,0,0,0.32)] overflow-hidden transition-colors ${
          isDark ? 'bg-[#181920] border-[#2C2E3A] text-[#F4F4F6]' : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'
        }`}
      >
        {/* Top Search Input Row */}
        <div
          className={`h-14 px-5 border-b flex items-center justify-between gap-3 ${
            isDark ? 'border-[#262834] bg-[#14151B]' : 'border-[#EBEBF0] bg-[#FAFAFC]'
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <svg
              className="w-4 h-4 text-[#8E8E93] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={cmdKQuery}
              onChange={(e) => appActions.searchCmdKDebounced(e.target.value)}
              placeholder={t('cmdKSearchPlaceholder')}
              autoFocus
              className="w-full bg-transparent text-[15px] font-medium focus:outline-none placeholder:text-[#8E8E93]"
            />
            {cmdKQuery && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  appActions.searchCmdKDebounced('');
                  searchInputRef.current?.focus();
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 transition-colors cursor-pointer ${
                  isDark
                    ? 'text-[#A1A1AA] hover:text-white bg-white/6 hover:bg-white/12'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F] bg-black/5 hover:bg-black/10'
                }`}
                title={t('clearSearchBtn')}
                aria-label={t('clearSearchBtn')}
              >
                {t('clearSearchBtn')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasQuery && cmdKSearching && (
              <span className="text-[11px] text-[var(--brand-text)] font-medium flex items-center gap-1 me-1">
                <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-ping" />
                <span>{t('searchingShort')}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setAppState({ cmdKOpen: false })}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={`${t('close')} (Esc)`}
              aria-label={t('close')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body: Clean Spotlight-grade Initial State (Search Cards & Decks) or Search Results Grid */}
        {!hasQuery ? (
          <div className="h-[410px] flex flex-col items-center justify-center text-center px-8 py-5 select-none relative overflow-hidden">
            {/* Ambient Background Gradient Aura */}
            <div
              className="absolute w-[360px] h-[200px] rounded-full blur-3xl opacity-15 pointer-events-none -top-10"
              style={{
                background: `radial-gradient(circle, ${brandHex} 0%, rgba(194,116,41,0.15) 50%, transparent 80%)`,
              }}
            />

            {/* Seamless 100% Vector Stacked Cards Artwork */}
            <div className="relative mb-3 flex items-center justify-center select-none">
              <div className="relative w-28 h-20 flex items-center justify-center">
                <div
                  className={`absolute w-20 h-13 rounded-xl border shadow-sm -rotate-12 -translate-x-3 -translate-y-1 transition-transform ${
                    isDark ? 'bg-[#22232E]/80 border-white/10' : 'bg-[#F2F2F7] border-black/8'
                  }`}
                />
                <div
                  className={`absolute w-20 h-13 rounded-xl border shadow-sm rotate-8 translate-x-3 -translate-y-0.5 transition-transform ${
                    isDark ? 'bg-[#282936]/90 border-white/12' : 'bg-[#EAEAEF] border-black/8'
                  }`}
                />
                <div
                  className={`relative w-22 h-15 rounded-xl border shadow-md backdrop-blur-md flex flex-col justify-between p-2.5 z-10 border-[var(--brand-border)] ${
                    isDark ? 'bg-[#1C1D26]/95' : 'bg-white/95'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
                    <span className="w-5 h-1 rounded-full bg-black/10 dark:bg-white/10" />
                  </div>
                  <div className="space-y-1">
                    <div className="w-10 h-1.5 rounded-full bg-[var(--brand)]/50" />
                    <div className="w-13 h-1.5 rounded-full bg-black/10 dark:bg-white/10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Title & Refined Subtitle */}
            <div className="text-[16px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F4F4F6]">
              {t('cmdKEmptyHeroTitle')}
            </div>
            <p className="text-[12px] text-[#8E8E93] mt-1 max-w-[340px] leading-relaxed">
              {t('cmdKEmptyHeroSub')}
            </p>

            {/* Interactive Smart Quick Filter Pills */}
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap max-w-[480px]">
              {quickSearchPills.map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => appActions.searchCmdKDebounced(pill.query)}
                  className={`h-7 px-3 rounded-full border text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 hover:scale-[1.03] ${
                    isDark
                      ? 'border-white/[0.08] bg-white/[0.04] text-[#D1D1D6] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)]'
                      : 'border-black/[0.06] bg-black/[0.03] text-[#48484A] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)] shadow-2xs'
                  }`}
                >
                  <span className="shrink-0">{pill.icon}</span>
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : displayedResults.length === 0 ? (
          /* Single-pane Centered Empty Search Results */
          <div className="h-[410px] flex flex-col items-center justify-center text-center px-8 py-6 select-none">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-xs ${
                isDark ? 'bg-white/5 text-[#8E8E93]' : 'bg-black/5 text-[#8E8E93]'
              }`}
            >
              <svg
                className="w-5 h-5 opacity-70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F4F4F6]">
              {t('cmdKNoResultsTitle', { q: cmdKQuery })}
            </div>
            <p className="text-[12px] text-[#8E8E93] mt-1.5 max-w-[320px] leading-relaxed">
              {t('cmdKNoResultsSub')}
            </p>
            <div className="flex items-center gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => appActions.searchCmdKDebounced('')}
                className="btn-primary !h-8 !px-4 !text-[12px]"
              >
                {t('clearSearchBtn')}
              </button>
              {libraryCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAppState({ cmdKOpen: false, activeTab: 'library' });
                  }}
                  className={`h-8 px-3.5 rounded-xl border text-[12px] font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'border-[#2C2C36] text-[#8E8E93] hover:text-white hover:bg-white/5'
                      : 'border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5'
                  }`}
                >
                  {t('browseAllLibraryBtn')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 h-[410px]">
            {/* Left Column: Streamlined Card List */}
            <div
              className={`col-span-5 p-2 overflow-y-auto border-e flex flex-col justify-between ${
                isDark ? 'border-[#262834]' : 'border-[#EBEBF0]'
              }`}
            >
              <div className="space-y-1">
                {displayedResults.map((item, idx) => {
                  const isSelected = idx === cmdKSelectedIndex;
                  const deckDot = getDeckColorByHash(item.deckId || item.deckName);
                  return (
                    <div
                      key={item.id}
                      onClick={() => setAppState({ cmdKSelectedIndex: idx })}
                      onDoubleClick={() => {
                        setAppState({ cmdKOpen: false });
                        appActions.openCardEditor(item);
                      }}
                      className={`px-3 py-2 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] shadow-2xs'
                          : isDark
                          ? 'hover:bg-white/5 text-[#D1D1D6]'
                          : 'hover:bg-[#F5F5F8] text-[#3A3A3C]'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: deckDot }}
                      />

                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[13px] font-semibold truncate leading-snug ${
                            isSelected ? 'text-[var(--brand-text)]' : ''
                          }`}
                        >
                          {item.front}
                        </div>
                        <div className="text-[11px] text-[#8E8E93] truncate mt-0.5 flex items-center gap-1.5">
                          <span className="font-medium text-[var(--brand-text)]">
                            {item.deckName}
                          </span>
                          <span>·</span>
                          <span className="truncate">{item.back.slice(0, 26)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setAppState({
                    cmdKOpen: false,
                    activeTab: 'library',
                  });
                  appActions.searchLibraryDebounced({ query: cmdKQuery });
                }}
                className="mt-2 py-1.5 text-center text-[11px] font-medium text-[var(--brand-text)] hover:underline cursor-pointer"
              >
                {t('cmdKViewAllInLibrary', { n: displayedResults.length })}
              </button>
            </div>

            {/* Right Column: Clean Flashcard Preview with Single Copy Action */}
            <div className="col-span-7 p-4 flex flex-col justify-between overflow-y-auto select-text">
              {activeCard ? (
                <>
                  <div className="space-y-3">
                    {/* Header: Deck Badge & Single Copy Button */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 bg-[var(--brand-soft)] text-[var(--brand-text)]">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: getDeckColorByHash(activeCard.deckId || activeCard.deckName) }}
                        />
                        <span>{activeCard.deckName}</span>
                      </span>

                      {renderCopyButton({
                        side: 'all',
                        label: t('copyCardBtn'),
                        title: t('copyCardBtn'),
                        getText: () =>
                          `${extractCopyableText(activeCard.frontHtml, activeCard.front)}\n\n---\n\n${extractCopyableText(
                            activeCard.backHtml,
                            activeCard.back
                          )}`,
                      })}
                    </div>

                    {/* Clean Card Typography (Direct Flashcard Layout, No Nested Gray Boxes) */}
                    <div
                      className={`rounded-2xl border select-text overflow-hidden ${
                        isDark ? 'bg-[#15161E] border-[#262834]' : 'bg-[#FAFAFC] border-[#E8E8EE]'
                      }`}
                    >
                      {/* Front Section */}
                      <div className="group/front px-4 pt-3.5 pb-3">
                        <div className="flex items-center justify-between gap-2 min-h-[24px] mb-1">
                          <div className="text-[10px] font-semibold text-[#636366] dark:text-[#8E8E93] uppercase tracking-wider">
                            {t('cardFrontLabel')}
                          </div>
                          {renderCopyButton({
                            side: 'front',
                            label: t('copyFrontBtn'),
                            title: t('copyFrontBtn'),
                            getText: () => extractCopyableText(activeCard.frontHtml, activeCard.front),
                            hoverRevealClass:
                              'opacity-0 pointer-events-none group-hover/front:opacity-100 group-hover/front:pointer-events-auto group-focus-within/front:opacity-100 group-focus-within/front:pointer-events-auto',
                          })}
                        </div>
                        <div
                          className="text-[15px] font-semibold leading-relaxed break-words select-text cursor-text text-[#1D1D1F] dark:text-[#F4F4F6]"
                          dangerouslySetInnerHTML={{
                            __html: renderMathAndRichHtml(activeCard.frontHtml || activeCard.front),
                          }}
                        />
                      </div>

                      {/* Subtle Divider */}
                      <div className={`mx-4 border-t ${isDark ? 'border-[#262834]' : 'border-[#EAEAEF]'}`} />

                      {/* Back Section */}
                      <div className="group/back px-4 pt-3 pb-3.5">
                        <div className="flex items-center justify-between gap-2 min-h-[24px] mb-1">
                          <div className="text-[10px] font-semibold text-[#636366] dark:text-[#8E8E93] uppercase tracking-wider">
                            {t('cardBackLabel')}
                          </div>
                          {renderCopyButton({
                            side: 'back',
                            label: t('copyBackBtn'),
                            title: t('copyBackBtn'),
                            getText: () => extractCopyableText(activeCard.backHtml, activeCard.back),
                            hoverRevealClass:
                              'opacity-0 pointer-events-none group-hover/back:opacity-100 group-hover/back:pointer-events-auto group-focus-within/back:opacity-100 group-focus-within/back:pointer-events-auto',
                          })}
                        </div>
                        <div
                          className="text-[13px] font-normal leading-relaxed break-words text-[#3A3A3C] dark:text-[#D1D1D6] select-text cursor-text"
                          dangerouslySetInnerHTML={{
                            __html: renderMathAndRichHtml(activeCard.backHtml || activeCard.back),
                          }}
                        />
                      </div>
                    </div>

                    {/* Compact SRS Metadata */}
                    <div className="flex items-center justify-between text-[11px] text-[#8E8E93] px-1">
                      <span className="font-mono">
                        {activeCard.dueText || t('statusDue')}
                      </span>
                      <span className="font-mono text-[10px]">
                        {t('masteryLabel')} {activeCard.mastery}% · {t('stabilityLabel')} {activeCard.stability}
                      </span>
                    </div>
                  </div>

                  {/* Single Primary Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAppState({ cmdKOpen: false });
                        appActions.openCardEditor(activeCard);
                      }}
                      className="btn-primary w-full !h-9 !text-[12px]"
                    >
                      <span>{t('editInCardEditorBtn')}</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono leading-none">
                        ↵
                      </kbd>
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[12px] text-[#8E8E93]">
                  {t('noCardSelectedText')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Bar */}
        <div
          className={`h-9 px-5 border-t flex items-center justify-end text-[11px] text-[#8E8E93] ${
            isDark ? 'border-[#262834] bg-[#14151B]' : 'border-[#EBEBF0] bg-[#FAFAFC]'
          }`}
        >
          <span>
            {hasQuery && displayedResults.length > 0
              ? t('matchedCountText', { n: displayedResults.length })
              : !hasQuery
              ? `${t('libraryTitle')}: ${libraryTotalCount || libraryCards.length || 0} ${t('cardsUnit')}`
              : ''}
          </span>
        </div>
      </div>
    </div>
  );
};
