import React, { useEffect, useMemo, useState } from 'react';
import { formatShortcut, translate } from '../../i18n/translations';
import { appActions, setAppState, showToast, useAppStore } from '../../stores/useAppStore';
import { copyTextToClipboard } from '../../utils/clipboard';
import { getDeckColorByHash, renderMathAndRichHtml } from '../../utils/mathRenderer';
import { getAccentScale } from '../../utils/themeTokens';

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
    showShortcutHints,
    envInfo,
  } = useAppStore();

  const [copiedSide, setCopiedSide] = useState<'front' | 'back' | 'all' | null>(null);

  const isDark = theme === 'dark' || theme === 'oled';
  const isZh = resolvedLang === 'zh-CN';
  const t = (key: any) => translate(resolvedLang, key);
  const cmdEnterLabel = formatShortcut('Cmd Enter', envInfo.platform);

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
      : { label: isZh ? '按标签检索' : 'Tags', query: 'tag:', icon: tagIcon };

    const firstDeck = decks && decks.length > 0 ? decks[0] : null;
    const deckIcon = (
      <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    );
    const deckPill = firstDeck
      ? {
          label: isZh ? `牌组 · ${firstDeck.name}` : `Deck: ${firstDeck.name}`,
          query: `deck:${firstDeck.name}`,
          icon: deckIcon,
        }
      : { label: isZh ? '按牌组检索' : 'Decks', query: 'deck:', icon: deckIcon };

    return [
      {
        label: isZh ? '待复习' : 'Due Cards',
        query: 'is:due',
        icon: (
          <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      {
        label: isZh ? '新卡片' : 'New Cards',
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
  }, [libraryAllTags, decks, isZh]);

  useEffect(() => {
    setCopiedSide(null);
  }, [activeCard?.id, cmdKOpen]);

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

  // Single copy action for the full card content
  const handleCopyText = async (rawText: string) => {
    const success = await copyTextToClipboard(rawText);
    setCopiedSide('all');

    showToast(
      success
        ? isZh
          ? '✓ 已复制卡片内容到剪贴板'
          : '✓ Copied card to clipboard'
        : isZh
        ? '复制失败，请重试'
        : 'Failed to copy'
    );

    setTimeout(() => {
      setCopiedSide(null);
    }, 2000);
  };

  return (
    <div
      onClick={() => setAppState({ cmdKOpen: false })}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 select-none animate-in fade-in duration-150 modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-label={isZh ? '全局命令面板' : 'Command Palette'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
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
              type="text"
              value={cmdKQuery}
              onChange={(e) => appActions.searchCmdKDebounced(e.target.value)}
              placeholder={
                resolvedLang === 'en'
                  ? 'Search cards or decks...'
                  : '搜索卡片或牌组...'
              }
              autoFocus
              className="w-full bg-transparent text-[15px] font-medium focus:outline-none placeholder:text-[#8E8E93]"
            />
            {cmdKQuery && (
              <button
                type="button"
                onClick={() => appActions.searchCmdKDebounced('')}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="清空搜索"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasQuery && cmdKSearching && (
              <span className="text-[11px] text-[var(--brand-text)] font-medium flex items-center gap-1 mr-1">
                <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-ping" />
                <span>{resolvedLang === 'en' ? 'Searching...' : '检索中...'}</span>
              </span>
            )}
            <kbd
              onClick={() => setAppState({ cmdKOpen: false })}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium cursor-pointer transition-colors ${
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-[#8E8E93] hover:text-white'
                  : 'bg-black/5 hover:bg-black/10 text-[#8E8E93] hover:text-[#1D1D1F]'
              }`}
              title={isZh ? '关闭 (Esc)' : 'Close (Esc)'}
            >
              Esc
            </kbd>
          </div>
        </div>

        {/* Modal Body: Clean Spotlight-grade Initial State or Search Results Grid */}
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
                {/* Back Left Card */}
                <div
                  className={`absolute w-20 h-13 rounded-xl border shadow-sm -rotate-12 -translate-x-3 -translate-y-1 transition-transform ${
                    isDark ? 'bg-[#22232E]/80 border-white/10' : 'bg-[#F2F2F7] border-black/8'
                  }`}
                />
                {/* Back Right Card */}
                <div
                  className={`absolute w-20 h-13 rounded-xl border shadow-sm rotate-8 translate-x-3 -translate-y-0.5 transition-transform ${
                    isDark ? 'bg-[#282936]/90 border-white/12' : 'bg-[#EAEAEF] border-black/8'
                  }`}
                />
                {/* Center Frosted Card */}
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
              {resolvedLang === 'en' ? 'Search Cards & Decks' : '搜索卡片与知识库'}
            </div>
            <p className="text-[12px] text-[#8E8E93] mt-1 max-w-[340px] leading-relaxed">
              {resolvedLang === 'en'
                ? 'Type any keyword for instant search, or tap quick filters'
                : '输入关键词即享毫秒级检索，或点选下方快捷分类'}
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
              {isZh ? `未找到与「${cmdKQuery}」匹配的卡片` : `No cards matching "${cmdKQuery}"`}
            </div>
            <p className="text-[12px] text-[#8E8E93] mt-1.5 max-w-[320px] leading-relaxed">
              {isZh
                ? '请尝试检查拼写、更换关键词，或清空筛选条件'
                : 'Check spelling, try broader keywords, or clear search'}
            </p>
            <div className="flex items-center gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => appActions.searchCmdKDebounced('')}
                className="btn-primary !h-8 !px-4 !text-[12px]"
              >
                {isZh ? '清空搜索词' : 'Clear search'}
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
                  {isZh ? '浏览全部卡片库' : 'Browse All Library'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 h-[410px]">
          {/* Left Column: Streamlined Card List */}
          <div
            className={`col-span-5 p-2 overflow-y-auto border-r flex flex-col justify-between ${
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
              {resolvedLang === 'en'
                ? `View all ${displayedResults.length} in Library →`
                : `在卡片库中浏览全部 ${displayedResults.length} 条 →`}
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

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          `${activeCard.front}\n\n---\n\n${activeCard.back}`
                        )
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                        copiedSide === 'all'
                          ? 'bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[var(--status-success)]/30'
                          : isDark
                          ? 'bg-white/5 hover:bg-white/10 text-[#8E8E93] hover:text-white'
                          : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                      title={isZh ? '复制卡片正反面完整内容' : 'Copy card content'}
                    >
                      {copiedSide === 'all' ? (
                        <>
                          <svg className="w-3 h-3 text-[var(--status-success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{isZh ? '已复制' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          <span>{isZh ? '复制卡片' : 'Copy Card'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Clean Card Typography (Direct Flashcard Layout, No Nested Gray Boxes) */}
                  <div
                    className={`rounded-2xl p-4 border select-text ${
                      isDark ? 'bg-[#15161E] border-[#262834]' : 'bg-[#FAFAFC] border-[#E8E8EE]'
                    }`}
                  >
                    {/* Front Section */}
                    <div>
                      <div className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                        {resolvedLang === 'en' ? 'Front' : '卡片正面'}
                      </div>
                      <div
                        className="text-[15px] font-semibold leading-relaxed break-words select-text cursor-text text-[#1D1D1F] dark:text-[#F4F4F6]"
                        dangerouslySetInnerHTML={{
                          __html: renderMathAndRichHtml(activeCard.frontHtml || activeCard.front),
                        }}
                      />
                    </div>

                    {/* Subtle Divider */}
                    <div className={`my-3 border-t ${isDark ? 'border-[#262834]' : 'border-[#EAEAEF]'}`} />

                    {/* Back Section */}
                    <div>
                      <div className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                        {resolvedLang === 'en' ? 'Back' : '卡片背面'}
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
                      {activeCard.dueText || (resolvedLang === 'en' ? 'Due Today' : '待复习')}
                    </span>
                    <span className="font-mono text-[10px]">
                      {resolvedLang === 'en'
                        ? `Mastery ${activeCard.mastery}% · Stability ${activeCard.stability}`
                        : `熟练度 ${activeCard.mastery}% · 稳定度 ${activeCard.stability}`}
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
                    <span>{resolvedLang === 'en' ? 'Edit in Card Editor' : '在编辑器中修改'}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono leading-none">
                      ↵
                    </kbd>
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-[12px] text-[#8E8E93]">
                {resolvedLang === 'en' ? 'No card selected' : '无匹配卡片预览'}
              </div>
            )}
          </div>
        </div>
      )}

        {/* Footer Hint Bar */}
        <div
          className={`h-9 px-5 border-t flex items-center justify-between text-[11px] text-[#8E8E93] ${
            isDark ? 'border-[#262834] bg-[#14151B]' : 'border-[#EBEBF0] bg-[#FAFAFC]'
          }`}
        >
          <div className="flex items-center gap-2">
            {!hasQuery ? (
              <>
                <kbd className="font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px]">↑↓</kbd>
                <span>{isZh ? '选择' : 'Navigate'}</span>
                <span className="opacity-40">·</span>
                <kbd className="font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px]">↵</kbd>
                <span>{isZh ? '打开' : 'Inspect'}</span>
                <span className="opacity-40">·</span>
                <kbd className="font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px]">Esc</kbd>
                <span>{isZh ? '关闭' : 'Close'}</span>
              </>
            ) : displayedResults.length === 0 ? (
              <>
                <kbd className="font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px]">Esc</kbd>
                <span>{isZh ? '退出' : 'Close'}</span>
              </>
            ) : (
              <>
                <kbd className="font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px]">↑↓</kbd>
                <span>{isZh ? '导航' : 'Navigate'}</span>
                <span className="opacity-40">·</span>
                <kbd className="font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px]">↵</kbd>
                <span>{isZh ? '在编辑器中修改' : 'Edit'}</span>
                <span className="opacity-40">·</span>
                <kbd className="font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px]">Esc</kbd>
                <span>{isZh ? '关闭' : 'Close'}</span>
              </>
            )}
          </div>
          <span>
            {hasQuery && displayedResults.length > 0
              ? resolvedLang === 'en'
                ? `Total ${displayedResults.length} results`
                : `共 ${displayedResults.length} 条结果`
              : !hasQuery
              ? resolvedLang === 'en'
                ? `Library: ${libraryTotalCount || libraryCards.length || 0} cards`
                : `记忆库共 ${libraryTotalCount || libraryCards.length || 0} 张卡片`
              : ''}
          </span>
        </div>
      </div>
    </div>
  );
};
