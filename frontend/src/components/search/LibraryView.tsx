import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ANKI_FLAG_PALETTE, CardFlagColor } from '../../bridge/pycmd';
import { translate } from '../../i18n/translations';
import {
  appActions,
  FlagFilterValue,
  setAppState,
  showToast,
  useAppStore,
} from '../../stores/useAppStore';
import { getDeckColorByHash, renderMathAndRichHtml } from '../../utils/mathRenderer';
import { handleWindowDoubleClick, startWindowDrag } from '../../utils/windowDrag';

export const LibraryView: React.FC = () => {
  const {
    isLoading,
    isInitialSyncing,
    syncing,
    libraryCards,
    libraryTotalCount,
    libraryFilteredCount,
    libraryHasMoreFromBackend,
    libraryAllTags,
    librarySearching,
    libraryViewMode,
    librarySearchQuery,
    libraryVisibleCount,
    filterStatus,
    filterDifficulty,
    filterFlag,
    filterTag,
    filterDeckId,
    selectedCardIds,
    decks,
    theme,
    resolvedLang,
  } = useAppStore();

  const isSyncPending = isInitialSyncing || syncing || isLoading;

  const isZh = resolvedLang === 'zh-CN';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  // Custom Modern Dropdown Popover States (Status, Difficulty, Flag, Tag, Deck)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [diffDropdownOpen, setDiffDropdownOpen] = useState(false);
  const [flagDropdownOpen, setFlagDropdownOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false);
  const [deckSearchInput, setDeckSearchInput] = useState('');

  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const diffDropdownRef = useRef<HTMLDivElement>(null);
  const flagDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const deckDropdownRef = useRef<HTMLDivElement>(null);

  // Interactive Batch Popover State
  const [activeBatchModal, setActiveBatchModal] = useState<
    'none' | 'addTag' | 'moveDeck' | 'setFlag' | 'confirmDelete'
  >('none');
  const [batchTagInput, setBatchTagInput] = useState('');
  const [batchTargetDeckId, setBatchTargetDeckId] = useState(decks[0]?.id || '1');

  useEffect(() => {
    if (decks.length > 0 && (!batchTargetDeckId || !decks.some((d) => d.id === batchTargetDeckId))) {
      setBatchTargetDeckId(decks[0].id);
    }
  }, [decks, batchTargetDeckId]);

  // Close custom dropdowns when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (diffDropdownRef.current && !diffDropdownRef.current.contains(e.target as Node)) {
        setDiffDropdownOpen(false);
      }
      if (flagDropdownRef.current && !flagDropdownRef.current.contains(e.target as Node)) {
        setFlagDropdownOpen(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
      if (deckDropdownRef.current && !deckDropdownRef.current.contains(e.target as Node)) {
        setDeckDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const isDark = theme === 'dark' || theme === 'oled';
  const cardSurface =
    theme === 'oled'
      ? 'bg-[#111216] border-[#22232B] text-white'
      : theme === 'dark'
      ? 'bg-[#1A1B21] border-[#2A2C36] text-white'
      : 'bg-white border-[#EAECEF] text-[#1D1D1F]';

  const popoverSurface =
    theme === 'oled'
      ? 'bg-[#15161C]/95 border-[#2A2C38] text-white'
      : theme === 'dark'
      ? 'bg-[#1E1F28]/95 border-[#323444] text-white'
      : 'bg-white/95 border-[#E5E5EA] text-[#1D1D1F]';

  const subText = 'text-[#636366] dark:text-[#8E8E93]';

  // Compute per-status card counts for StatusSelectDropdown
  const statusCountsMap = useMemo(() => {
    const map: Record<string, number> = {
      all: libraryCards.length,
      due: 0,
      new: 0,
      completed: 0,
      review: 0,
      suspended: 0,
      buried: 0,
    };
    for (const c of libraryCards) {
      if (c.suspended || c.status === 'suspended') map.suspended++;
      else if (c.buried || c.status === 'buried') map.buried++;
      else if (c.status === 'completed' || c.ratedToday) map.completed++;
      else if (c.status === 'due') map.due++;
      else if (c.status === 'new') map.new++;
      else if (c.status === 'review') map.review++;
    }
    return map;
  }, [libraryCards]);

  // Compute per-difficulty card counts for DifficultySelectDropdown
  const diffCountsMap = useMemo(() => {
    const map: Record<string, number> = {
      all: libraryCards.length,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const c of libraryCards) {
      if (c.difficultyLevel === 'high') map.high++;
      else if (c.difficultyLevel === 'medium') map.medium++;
      else if (c.difficultyLevel === 'low') map.low++;
    }
    return map;
  }, [libraryCards]);

  // Compute per-flag card counts for FlagSelectDropdown
  const flagCountsMap = useMemo(() => {
    const map: Record<string, number> = {
      all: libraryCards.length,
      flagged: 0,
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0,
      '7': 0,
    };
    for (const c of libraryCards) {
      const f = (c.flags || 0) & 7;
      if (f > 0) {
        map.flagged++;
        map[String(f)] = (map[String(f)] || 0) + 1;
      }
    }
    return map;
  }, [libraryCards]);

  // Compute per-tag card counts for `TagSelectDropdown`
  const tagCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of libraryCards) {
      for (const tg of c.tags) {
        map[tg] = (map[tg] || 0) + 1;
      }
    }
    return map;
  }, [libraryCards]);

  const allAvailableTags = useMemo(() => {
    const set = new Set<string>([...libraryAllTags, ...Object.keys(tagCountsMap)]);
    return Array.from(set).sort((a, b) => (tagCountsMap[b] || 0) - (tagCountsMap[a] || 0));
  }, [libraryAllTags, tagCountsMap]);

  const filteredDropdownTags = useMemo(() => {
    const q = tagSearchInput.trim().toLowerCase();
    if (!q) return allAvailableTags;
    return allAvailableTags.filter((tg) => tg.toLowerCase().includes(q));
  }, [allAvailableTags, tagSearchInput]);

  const filteredDropdownDecks = useMemo(() => {
    const q = deckSearchInput.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(
      (d) => d.name.toLowerCase().includes(q) || d.fullName.toLowerCase().includes(q)
    );
  }, [decks, deckSearchInput]);

  const filteredCards = libraryCards.filter((card) => {
    if (librarySearchQuery.trim()) {
      const q = librarySearchQuery.toLowerCase();
      const match =
        card.front.toLowerCase().includes(q) ||
        card.back.toLowerCase().includes(q) ||
        card.deckName.toLowerCase().includes(q) ||
        card.tags.some((tItem) => tItem.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filterStatus === 'suspended' && !card.suspended && card.status !== 'suspended') return false;
    if (filterStatus === 'buried' && !card.buried && card.status !== 'buried') return false;
    if (filterStatus === 'due' && card.status !== 'due') return false;
    if (filterStatus === 'new' && card.status !== 'new') return false;
    if (filterStatus === 'completed' && card.status !== 'completed' && !card.ratedToday) return false;
    if (filterStatus === 'review' && card.status !== 'review') return false;
    if (filterDifficulty !== 'all' && card.difficultyLevel !== filterDifficulty) return false;
    if (filterFlag === 'flagged' && ((card.flags || 0) & 7) <= 0) return false;
    if (
      filterFlag !== 'all' &&
      filterFlag !== 'flagged' &&
      ((card.flags || 0) & 7) !== Number(filterFlag)
    ) {
      return false;
    }
    if (filterTag !== 'all' && !card.tags.includes(filterTag)) return false;
    if (filterDeckId !== 'all' && card.deckId !== filterDeckId) return false;
    return true;
  });

  const visibleCards = filteredCards.slice(0, libraryVisibleCount);
  const totalMatchedCount = Math.max(filteredCards.length, libraryFilteredCount);
  const canLoadMore =
    filteredCards.length > libraryVisibleCount || libraryHasMoreFromBackend;
  const hasActiveFilters =
    filterStatus !== 'all' ||
    filterDifficulty !== 'all' ||
    filterFlag !== 'all' ||
    filterTag !== 'all' ||
    filterDeckId !== 'all' ||
    librarySearchQuery.trim().length > 0;

  const selectedObjects = libraryCards.filter((c) => selectedCardIds.includes(c.id));
  const allSelectedSuspended =
    selectedObjects.length > 0 && selectedObjects.every((c) => c.suspended);
  const allSelectedBuried =
    selectedObjects.length > 0 && selectedObjects.every((c) => c.buried || c.status === 'buried');

  const handleConfirmBatchTag = () => {
    if (!batchTagInput.trim()) return;
    appActions.executeBatchAction('addTag', { tag: batchTagInput.trim() });
    setBatchTagInput('');
    setActiveBatchModal('none');
  };

  const handleConfirmBatchMoveDeck = () => {
    const targetDeck = decks.find((d) => d.id === batchTargetDeckId) || decks[0];
    if (!targetDeck) return;
    appActions.executeBatchAction('moveDeck', {
      targetDeckId: targetDeck.id,
      targetDeckName: targetDeck.name,
    });
    setActiveBatchModal('none');
  };

  const handleConfirmBatchDelete = () => {
    appActions.executeBatchAction('delete');
    setActiveBatchModal('none');
  };

  const statusLabels: Record<string, string> = isZh
    ? {
        all: '全部',
        due: '待复习',
        new: '新卡片',
        completed: '今日已完成',
        review: '未到期复习卡',
        suspended: '已暂停',
        buried: '已搁置',
      }
    : {
        all: 'All',
        due: 'Due Now',
        new: 'New',
        completed: 'Completed Today',
        review: 'Undue Review',
        suspended: 'Suspended',
        buried: 'Buried',
      };

  const difficultyLabels: Record<string, string> = isZh
    ? { all: '全部', high: '高', medium: '中', low: '低' }
    : { all: 'All', high: 'High', medium: 'Med', low: 'Low' };

  const activeDeckObj = decks.find((d) => d.id === filterDeckId);
  const activeFlagSpec =
    filterFlag in ANKI_FLAG_PALETTE
      ? ANKI_FLAG_PALETTE[Number(filterFlag) as Exclude<CardFlagColor, 0>]
      : null;

  return (
    <div className="flex-1 h-screen overflow-y-auto px-8 py-6 flex flex-col justify-between relative select-none">
      <div className="space-y-5 pb-24">
        {/* Top Header */}
        <header
          onMouseDown={startWindowDrag}
          onDoubleClick={handleWindowDoubleClick}
          className="flex items-center justify-between select-none cursor-default"
        >
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">{t('libraryTitle')}</h1>
            <p className={`text-[12px] ${subText} mt-0.5`}>
              {t('librarySub', {
                total: libraryTotalCount.toLocaleString(),
                decks: decks.length,
                matched: totalMatchedCount,
              })}
              {librarySearching ? t('searchingDb') : ''}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                appActions.openCustomStudyModal(
                  filterFlag !== 'all' || filterTag !== 'all' ? 'flagged' : 'mistakes',
                  filterDeckId !== 'all' ? filterDeckId : undefined
                )
              }
              className={`h-9 px-3.5 rounded-xl border text-[12px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors hover:border-[var(--brand-border)] ${cardSurface}`}
            >
              <svg className="w-3.5 h-3.5 text-[var(--brand-text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              <span>{isZh ? '专项特训' : 'Custom Study'}</span>
            </button>

            <div
              className={`h-9 w-[240px] px-3.5 rounded-xl border flex items-center gap-2 text-[12px] focus-within:border-[var(--brand)] ${cardSurface}`}
            >
              <svg
                className="w-3.5 h-3.5 text-[#8E8E93]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={librarySearchQuery}
                onChange={(e) => appActions.searchLibraryDebounced({ query: e.target.value })}
                placeholder={t('searchLibraryPlaceholder')}
                className="w-full bg-transparent focus:outline-none"
              />
            </div>

            <div
              className={`h-9 p-1 rounded-xl border flex items-center gap-1 ${
                isDark ? 'bg-[#15161C] border-[#2A2C36]' : 'bg-[#F4F4F6] border-[#E5E5EA]'
              }`}
            >
              <button
                onClick={() => setAppState({ libraryViewMode: 'gallery' })}
                className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                  libraryViewMode === 'gallery'
                    ? isDark
                      ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] shadow-xs'
                      : 'bg-white text-[var(--brand-text)] shadow-xs'
                    : 'text-[#8E8E93] hover:text-[var(--brand-text)]'
                }`}
                title="Gallery View"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setAppState({ libraryViewMode: 'table' })}
                className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                  libraryViewMode === 'table'
                    ? isDark
                      ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] shadow-xs'
                      : 'bg-white text-[var(--brand-text)] shadow-xs'
                    : 'text-[#8E8E93] hover:text-[var(--brand-text)]'
                }`}
                title="Table View"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Faceted Filter Pills Bar — Status, Difficulty, 7-Color Flag, Tag, Deck */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Pill 1: Custom Modern StatusSelectDropdown */}
            <div ref={statusDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setStatusDropdownOpen((prev) => !prev);
                  setDiffDropdownOpen(false);
                  setFlagDropdownOpen(false);
                  setTagDropdownOpen(false);
                  setDeckDropdownOpen(false);
                }}
                className={`h-8 px-3.5 rounded-full text-[12px] font-medium flex items-center gap-2 cursor-pointer transition-all ${
                  filterStatus !== 'all'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)]'
                    : `border hover:border-[var(--brand-border)] ${cardSurface}`
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    filterStatus === 'due'
                      ? 'bg-[var(--brand)]'
                      : filterStatus === 'new'
                      ? 'bg-[var(--status-warning)]'
                      : filterStatus === 'completed'
                      ? 'bg-[var(--status-success)]'
                      : filterStatus === 'review'
                      ? 'bg-[var(--brand)]'
                      : filterStatus === 'suspended'
                      ? 'bg-[var(--status-warning)]'
                      : 'bg-[#8E8E93]'
                  }`}
                />
                <span>
                  {t('statusFilterLabel')} · {statusLabels[filterStatus]}
                </span>
                <svg className="w-2.5 h-2.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {statusDropdownOpen && (
                <div
                  className={`absolute left-0 top-10 z-40 w-[220px] rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl p-2 space-y-0.5 ${popoverSurface}`}
                >
                  {(
                    [
                      { key: 'all', dot: 'bg-[#8E8E93]' },
                      { key: 'due', dot: 'bg-[var(--brand)]' },
                      { key: 'new', dot: 'bg-[var(--status-warning)]' },
                      { key: 'completed', dot: 'bg-[var(--status-success)]' },
                      { key: 'review', dot: 'bg-[var(--brand)]' },
                      { key: 'suspended', dot: 'bg-[var(--status-warning)]' },
                      { key: 'buried', dot: 'bg-[#8E8E93]' },
                    ] as const
                  ).map((opt) => {
                    const isSelected = filterStatus === opt.key;
                    const cnt = statusCountsMap[opt.key] ?? 0;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          appActions.searchLibraryDebounced({ status: opt.key });
                          setStatusDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                            : isDark
                            ? 'hover:bg-white/5'
                            : 'hover:bg-[#F4F4F6]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                          <span>{statusLabels[opt.key]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-[#8E8E93]">
                            {cnt}
                          </span>
                          {isSelected && <span className="text-[var(--brand-text)]">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pill 2: Custom Modern DifficultySelectDropdown */}
            <div ref={diffDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setDiffDropdownOpen((prev) => !prev);
                  setStatusDropdownOpen(false);
                  setFlagDropdownOpen(false);
                  setTagDropdownOpen(false);
                  setDeckDropdownOpen(false);
                }}
                className={`h-8 px-3.5 rounded-full text-[12px] font-medium flex items-center gap-2 cursor-pointer transition-all ${
                  filterDifficulty !== 'all'
                    ? 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[var(--status-warning)]/35'
                    : `border hover:border-[var(--brand-border)] ${cardSurface}`
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    filterDifficulty === 'high'
                      ? 'bg-[var(--status-danger)]'
                      : filterDifficulty === 'medium'
                      ? 'bg-[var(--status-warning)]'
                      : filterDifficulty === 'low'
                      ? 'bg-[var(--status-success)]'
                      : 'bg-[#8E8E93]'
                  }`}
                />
                <span>
                  {t('diffFilterLabel')} · {difficultyLabels[filterDifficulty]}
                </span>
                <svg className="w-2.5 h-2.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {diffDropdownOpen && (
                <div
                  className={`absolute left-0 top-10 z-40 w-[190px] rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl p-2 space-y-0.5 ${popoverSurface}`}
                >
                  {(
                    [
                      { key: 'all', dot: 'bg-[#8E8E93]' },
                      { key: 'high', dot: 'bg-[var(--status-danger)]' },
                      { key: 'medium', dot: 'bg-[var(--status-warning)]' },
                      { key: 'low', dot: 'bg-[var(--status-success)]' },
                    ] as const
                  ).map((opt) => {
                    const isSelected = filterDifficulty === opt.key;
                    const cnt = diffCountsMap[opt.key] ?? 0;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          appActions.searchLibraryDebounced({ difficulty: opt.key });
                          setDiffDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] font-semibold'
                            : isDark
                            ? 'hover:bg-white/5'
                            : 'hover:bg-[#F4F4F6]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                          <span>{difficultyLabels[opt.key]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-[#8E8E93]">
                            {cnt}
                          </span>
                          {isSelected && <span className="text-[var(--status-warning)]">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pill 3: 7-Color FlagSelectDropdown */}
            <div ref={flagDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setFlagDropdownOpen((prev) => !prev);
                  setStatusDropdownOpen(false);
                  setDiffDropdownOpen(false);
                  setTagDropdownOpen(false);
                  setDeckDropdownOpen(false);
                }}
                style={
                  activeFlagSpec
                    ? {
                        backgroundColor: activeFlagSpec.bgSoft,
                        borderColor: activeFlagSpec.borderHex,
                        color: activeFlagSpec.hex,
                      }
                    : undefined
                }
                className={`h-8 px-3.5 rounded-full text-[12px] font-medium flex items-center gap-2 cursor-pointer transition-all ${
                  activeFlagSpec
                    ? 'border'
                    : filterFlag === 'flagged'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)]'
                    : `border hover:border-[var(--brand-border)] ${cardSurface}`
                }`}
              >
                {activeFlagSpec ? (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeFlagSpec.hex }}
                  />
                ) : (
                  <svg className="w-3.5 h-3.5 opacity-70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                )}
                <span>
                  {isZh ? '旗标' : 'Flag'} ·{' '}
                  {filterFlag === 'all'
                    ? statusLabels.all
                    : filterFlag === 'flagged'
                    ? isZh
                      ? '任意有旗标'
                      : 'Flagged'
                    : activeFlagSpec
                    ? isZh
                      ? activeFlagSpec.shortZh
                      : activeFlagSpec.shortEn
                    : statusLabels.all}
                </span>
                <svg className="w-2.5 h-2.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {flagDropdownOpen && (
                <div
                  className={`absolute left-0 top-10 z-40 w-[225px] rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl p-2 space-y-0.5 ${popoverSurface}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      appActions.searchLibraryDebounced({ flag: 'all' });
                      setFlagDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                      filterFlag === 'all'
                        ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                        : isDark
                        ? 'hover:bg-white/5'
                        : 'hover:bg-[#F4F4F6]'
                    }`}
                  >
                    <span>{isZh ? '全部卡片' : 'All Cards'}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-[#8E8E93]">
                      {flagCountsMap.all}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      appActions.searchLibraryDebounced({ flag: 'flagged' });
                      setFlagDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                      filterFlag === 'flagged'
                        ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                        : isDark
                        ? 'hover:bg-white/5'
                        : 'hover:bg-[#F4F4F6]'
                    }`}
                  >
                    <span>{isZh ? '任意有旗标' : 'Any Flagged'}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-[#8E8E93]">
                      {flagCountsMap.flagged}
                    </span>
                  </button>

                  <div className="my-1 border-t border-black/5 dark:border-white/5" />

                  {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
                    const spec = ANKI_FLAG_PALETTE[fNum];
                    const keyStr = String(fNum) as FlagFilterValue;
                    const isSelected = filterFlag === keyStr;
                    const cnt = flagCountsMap[keyStr] || 0;
                    return (
                      <button
                        key={fNum}
                        type="button"
                        onClick={() => {
                          appActions.searchLibraryDebounced({ flag: keyStr });
                          setFlagDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-black/5 dark:bg-white/10 font-semibold'
                            : isDark
                            ? 'hover:bg-white/5'
                            : 'hover:bg-[#F4F4F6]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: spec.hex }}
                          />
                          <span>{isZh ? spec.labelZh : spec.labelEn}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-[#8E8E93]">
                          {cnt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pill 4: Custom Modern TagSelectDropdown (Item #8) */}
            <div ref={tagDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setTagDropdownOpen((prev) => !prev);
                  setStatusDropdownOpen(false);
                  setDiffDropdownOpen(false);
                  setFlagDropdownOpen(false);
                  setDeckDropdownOpen(false);
                }}
                className={`h-8 px-3.5 rounded-full text-[12px] font-medium flex items-center gap-2 cursor-pointer transition-all ${
                  filterTag !== 'all'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)]'
                    : `border hover:border-[var(--brand-border)] ${cardSurface}`
                }`}
              >
                <svg className="w-3.5 h-3.5 opacity-70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                  <path d="M7 7h.01" />
                </svg>
                <span>
                  {t('tagFilterLabel')} ·{' '}
                  {filterTag === 'all' ? statusLabels.all : `#${filterTag}`}
                </span>
                <svg className="w-2.5 h-2.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {tagDropdownOpen && (
                <div
                  className={`absolute left-0 top-10 z-40 w-[260px] rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl p-2.5 space-y-2 ${popoverSurface}`}
                >
                  {/* Search filter input inside dropdown */}
                  <div
                    className={`h-8 px-2.5 rounded-xl border flex items-center gap-2 text-[12px] ${
                      isDark
                        ? 'bg-[#121318] border-[#2A2C38]'
                        : 'bg-[#F4F4F6] border-[#E5E5EA]'
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 text-[#8E8E93] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      value={tagSearchInput}
                      onChange={(e) => setTagSearchInput(e.target.value)}
                      placeholder={isZh ? '搜索标签名称...' : 'Filter tags...'}
                      autoFocus
                      className="w-full bg-transparent focus:outline-none text-[12px]"
                    />
                  </div>

                  {/* Tag Options List */}
                  <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        appActions.searchLibraryDebounced({ tag: 'all' });
                        setTagDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                        filterTag === 'all'
                          ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                          : isDark
                          ? 'hover:bg-white/5'
                          : 'hover:bg-[#F4F4F6]'
                      }`}
                    >
                      <span>{isZh ? '全部标签' : 'All Tags'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#8E8E93]">
                          {libraryCards.length}
                        </span>
                        {filterTag === 'all' && <span className="text-[var(--brand-text)]">✓</span>}
                      </div>
                    </button>

                    {filteredDropdownTags.length > 0 ? (
                      filteredDropdownTags.map((tagItem) => {
                        const isSelected = filterTag === tagItem;
                        const cnt = tagCountsMap[tagItem] || 0;
                        return (
                          <button
                            key={tagItem}
                            type="button"
                            onClick={() => {
                              appActions.searchLibraryDebounced({ tag: tagItem });
                              setTagDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                                : isDark
                                ? 'hover:bg-white/5'
                                : 'hover:bg-[#F4F4F6]'
                            }`}
                          >
                            <span className="truncate">#{tagItem}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-[#8E8E93]">
                                {cnt}
                              </span>
                              {isSelected && <span className="text-[var(--brand-text)]">✓</span>}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-4 text-center text-[11px] text-[#8E8E93]">
                        {isZh ? '未找到匹配标签' : 'No matching tags'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pill 5: Custom Modern DeckSelectDropdown */}
            <div ref={deckDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setDeckDropdownOpen((prev) => !prev);
                  setStatusDropdownOpen(false);
                  setDiffDropdownOpen(false);
                  setFlagDropdownOpen(false);
                  setTagDropdownOpen(false);
                }}
                className={`h-8 px-3.5 rounded-full text-[12px] font-medium flex items-center gap-2 cursor-pointer transition-all ${
                  filterDeckId !== 'all'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)]'
                    : `border hover:border-[var(--brand-border)] ${cardSurface}`
                }`}
              >
                <svg className="w-3.5 h-3.5 opacity-70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                </svg>
                <span>
                  {t('deckFilterLabel')} ·{' '}
                  {filterDeckId === 'all'
                    ? statusLabels.all
                    : activeDeckObj?.name || statusLabels.all}
                </span>
                <svg className="w-2.5 h-2.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {deckDropdownOpen && (
                <div
                  className={`absolute left-0 top-10 z-40 w-[260px] rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl p-2.5 space-y-2 ${popoverSurface}`}
                >
                  <div
                    className={`h-8 px-2.5 rounded-xl border flex items-center gap-2 text-[12px] ${
                      isDark
                        ? 'bg-[#121318] border-[#2A2C38]'
                        : 'bg-[#F4F4F6] border-[#E5E5EA]'
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 text-[#8E8E93] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      value={deckSearchInput}
                      onChange={(e) => setDeckSearchInput(e.target.value)}
                      placeholder={isZh ? '搜索牌组名称...' : 'Filter decks...'}
                      autoFocus
                      className="w-full bg-transparent focus:outline-none text-[12px]"
                    />
                  </div>

                  <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        appActions.searchLibraryDebounced({ deckId: 'all' });
                        setDeckDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                        filterDeckId === 'all'
                          ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                          : isDark
                          ? 'hover:bg-white/5'
                          : 'hover:bg-[#F4F4F6]'
                      }`}
                    >
                      <span>{isZh ? '全部牌组' : 'All Decks'}</span>
                      {filterDeckId === 'all' && <span className="text-[var(--brand-text)]">✓</span>}
                    </button>

                    {filteredDropdownDecks.map((d) => {
                      const isSelected = filterDeckId === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            appActions.searchLibraryDebounced({ deckId: d.id });
                            setDeckDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
                              : isDark
                              ? 'hover:bg-white/5'
                              : 'hover:bg-[#F4F4F6]'
                          }`}
                        >
                          <span className="truncate">{d.fullName || d.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-[#8E8E93]">{d.totalCards}</span>
                            {isSelected && <span className="text-[var(--brand-text)]">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  appActions.searchLibraryDebounced({
                    query: '',
                    status: 'all',
                    difficulty: 'all',
                    flag: 'all',
                    tag: 'all',
                    deckId: 'all',
                  });
                  showToast(isZh ? '已重置所有筛选条件' : 'Filters reset');
                }}
                className={`h-8 px-3.5 rounded-full text-[12px] font-medium cursor-pointer transition-all active:scale-95 ${
                  isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-black/5 text-[#1D1D1F] hover:bg-black/10'
                }`}
              >
                {t('resetFilters')}
              </button>
            )}
          </div>

          <span className={`text-[12px] ${subText}`}>
            {t('matchedCountText', { n: totalMatchedCount })}
          </span>
        </div>

        {/* Skeleton Loading & Cloud Sync State */}
        {isSyncPending ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4.5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border p-4.5 h-[190px] flex flex-col justify-between ${cardSurface}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-20 h-4 rounded-md animate-skeleton-shimmer" />
                    <div className="w-12 h-4 rounded-md animate-skeleton-shimmer" />
                  </div>
                  <div className="w-3/4 h-5 rounded-md animate-skeleton-shimmer mb-2.5" />
                  <div className="w-full h-10 rounded-xl animate-skeleton-shimmer" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.05]">
                  <div className="w-24 h-3.5 rounded animate-skeleton-shimmer" />
                  <div className="w-12 h-6 rounded-lg animate-skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <div
            className={`rounded-2xl border p-12 text-center flex flex-col items-center justify-center space-y-3.5 ${cardSurface}`}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                isDark ? 'bg-white/5 text-[#8E8E93]' : 'bg-black/5 text-[#8E8E93]'
              }`}
            >
              <svg
                className="w-6 h-6 opacity-75"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="text-[16px] font-semibold tracking-tight">
              {t('emptyLibraryTitle')}
            </div>
            <p className={`text-[12px] ${subText} max-w-sm leading-relaxed`}>
              {t('emptyLibrarySub')}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setAppState({
                    filterStatus: 'all',
                    filterDifficulty: 'all',
                    filterFlag: 'all',
                    filterTag: 'all',
                    filterDeckId: 'all',
                    librarySearchQuery: '',
                  });
                  appActions.searchLibraryDebounced({
                    query: '',
                    status: 'all',
                    difficulty: 'all',
                    flag: 'all',
                    tag: 'all',
                    deckId: 'all',
                  });
                }}
                className="btn-primary mt-2 !h-9 !px-4 !text-[12px]"
              >
                <span>{isZh ? '清空所有筛选条件' : 'Clear all filters'}</span>
              </button>
            )}
          </div>
        ) : libraryViewMode === 'gallery' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4.5">
              {visibleCards.map((card) => {
                const isSelected = selectedCardIds.includes(card.id);
                const isSuspended = card.suspended || card.status === 'suspended';
                const isBuried = card.buried || card.status === 'buried';
                const cardFlagNum = ((card.flags || 0) & 7) as CardFlagColor;
                const cardFlagSpec = cardFlagNum !== 0 ? ANKI_FLAG_PALETTE[cardFlagNum] : null;
                const topBarColor = getDeckColorByHash(card.deckId || card.deckName);
                return (
                  <article
                    key={card.id}
                    onClick={(e) => {
                      if (selectedCardIds.length > 0 || e.metaKey || e.ctrlKey) {
                        appActions.toggleCardSelection(card.id);
                      } else {
                        appActions.openCardEditor(card);
                      }
                    }}
                    onDoubleClick={() => appActions.openCardEditor(card)}
                    className={`group relative rounded-2xl p-4.5 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none border ${
                      isSelected
                        ? 'bg-[var(--brand-surface)] border-[var(--brand)] ring-2 ring-[var(--brand)]/35 shadow-md'
                        : isDark
                        ? 'bg-[#1A1B21] border-[#2A2C36] hover:border-[var(--brand-border)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:-translate-y-0.5'
                        : 'bg-white border-[#EAECEF] hover:border-[var(--brand-border)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
                    }`}
                  >
                    <header className="flex items-center justify-between gap-1.5 mb-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Deck Pill with Deck Color Indicator */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium max-w-[115px] truncate ${
                            isDark ? 'bg-white/5 text-[#A1A1A6]' : 'bg-[#F2F2F7] text-[#636366]'
                          }`}
                          title={card.fullDeckName || card.deckName}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: topBarColor }}
                          />
                          <span className="truncate">{card.deckName}</span>
                        </span>

                        {cardFlagSpec && (
                          <span
                            title={isZh ? cardFlagSpec.labelZh : cardFlagSpec.labelEn}
                            style={{
                              backgroundColor: cardFlagSpec.bgSoft,
                              color: cardFlagSpec.hex,
                            }}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 shrink-0"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cardFlagSpec.hex }}
                            />
                            <span>{isZh ? cardFlagSpec.shortZh : cardFlagSpec.shortEn}</span>
                          </span>
                        )}

                        {/* Status Badge if special state */}
                        {isSuspended ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--status-warning-soft)] text-[var(--status-warning)] shrink-0">
                            {isZh ? '已暂停' : 'Suspended'}
                          </span>
                        ) : isBuried ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/5 dark:bg-white/10 text-[#555558] dark:text-[#A1A1A6] shrink-0">
                            {isZh ? '已搁置' : 'Buried'}
                          </span>
                        ) : card.status === 'new' ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--status-info-soft)] text-[var(--status-info)] shrink-0">
                            {isZh ? '新卡' : 'New'}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Tags */}
                        {card.tags.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--brand-soft)] text-[var(--brand-text)]">
                              #{card.tags[0]}
                            </span>
                            {card.tags.length > 1 && (
                              <span
                                className="text-[10px] text-[#8E8E93] font-medium cursor-default"
                                title={card.tags.map((tg) => `#${tg}`).join(' ')}
                              >
                                +{card.tags.length - 1}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Top-Right Selection Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            appActions.toggleCardSelection(card.id);
                          }}
                          aria-label={isSelected ? 'Deselect card' : 'Select card'}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--brand)] text-white shadow-2xs'
                              : 'border border-[#C7C7CC] dark:border-[#48484A] hover:border-[var(--brand)] opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-[#20202A]/80'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </header>

                    {/* Content Section */}
                    <div className="flex-1 min-h-[92px] flex flex-col justify-start">
                      <h3
                        className="text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-white leading-snug line-clamp-2 select-text cursor-text"
                        dangerouslySetInnerHTML={{
                          __html: renderMathAndRichHtml(card.frontHtml || card.front),
                        }}
                      />
                      <div
                        className={`mt-2.5 p-2.5 rounded-xl text-[12px] leading-relaxed line-clamp-2 select-text cursor-text border transition-colors ${
                          isDark
                            ? 'bg-[#14151B]/70 border-[#252732] text-[#A1A1A6]'
                            : 'bg-[#F8F8FA] border-[#ECECEE] text-[#636366]'
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: renderMathAndRichHtml(card.backHtml || card.back),
                        }}
                      />
                    </div>

                    {/* Footer Section */}
                    <footer className="mt-3.5 pt-2.5 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-[#8E8E93] text-[11px] truncate min-w-0 pr-2">
                        <span className="flex items-center gap-1 shrink-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSuspended
                                ? 'bg-[var(--status-warning)]'
                                : isBuried
                                ? 'bg-[#8E8E93]'
                                : card.status === 'due'
                                ? 'bg-[var(--status-danger)]'
                                : card.status === 'new'
                                ? 'bg-[var(--status-info)]'
                                : 'bg-[var(--status-success)]'
                            }`}
                          />
                          <span className="truncate">{card.dueText}</span>
                        </span>
                        <span>·</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md font-semibold text-[10px] shrink-0 ${
                            card.mastery >= 80
                              ? 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                              : card.mastery >= 50
                              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                              : card.mastery > 0
                              ? 'bg-[var(--status-warning-soft)] text-[var(--status-warning)]'
                              : 'bg-black/5 dark:bg-white/5 text-[#8E8E93]'
                          }`}
                        >
                          {t('masteryLabel')} {card.mastery}%
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          appActions.openCardEditor(card);
                        }}
                        className="h-6.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all bg-[var(--brand-soft)] text-[var(--brand-text)] hover:bg-[var(--brand)] hover:text-white shrink-0 shadow-2xs"
                        title={isZh ? '编辑卡片' : 'Edit card'}
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                        <span>{isZh ? '编辑' : 'Edit'}</span>
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>

            {canLoadMore && (
              <div className="pt-4 flex justify-center">
                <button
                  onClick={() => appActions.loadMoreLibraryCards()}
                  className={`px-6 py-2 rounded-xl border text-[12px] font-medium cursor-pointer hover:border-[var(--brand-border)] ${cardSurface}`}
                >
                  {t('loadMoreCards', {
                    loaded: Math.min(visibleCards.length, totalMatchedCount),
                    total: totalMatchedCount,
                  })}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className={`rounded-2xl border overflow-hidden shadow-xs ${cardSurface}`}>
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr
                    className={`border-b text-[11px] ${subText} ${
                      isDark ? 'border-[#2A2C36] bg-white/[0.02]' : 'border-[#EFEFF4] bg-[#FAFAFC]'
                    }`}
                  >
                    <th className="py-3 px-4 w-10">{isZh ? '选择' : 'Sel'}</th>
                    <th className="py-3 px-4">{isZh ? '正面词条' : 'Front'}</th>
                    <th className="py-3 px-4">{isZh ? '背面释义' : 'Back'}</th>
                    <th className="py-3 px-4">{isZh ? '所属牌组' : 'Deck'}</th>
                    <th className="py-3 px-4">{isZh ? '旗标与标签' : 'Flag & Tags'}</th>
                    <th className="py-3 px-4">{t('masteryLabel')}</th>
                    <th className="py-3 px-4">{isZh ? '到期状态' : 'Due'}</th>
                    <th className="py-3 px-4 text-right w-20">{isZh ? '操作' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCards.map((card) => {
                    const isSelected = selectedCardIds.includes(card.id);
                    const isSuspended = card.suspended || card.status === 'suspended';
                    const isBuried = card.buried || card.status === 'buried';
                    const cardFlagNum = ((card.flags || 0) & 7) as CardFlagColor;
                    const cardFlagSpec = cardFlagNum !== 0 ? ANKI_FLAG_PALETTE[cardFlagNum] : null;
                    const topBarColor = getDeckColorByHash(card.deckId || card.deckName);
                    return (
                      <tr
                        key={card.id}
                        onClick={(e) => {
                          if (selectedCardIds.length > 0 || e.metaKey || e.ctrlKey) {
                            appActions.toggleCardSelection(card.id);
                          } else {
                            appActions.openCardEditor(card);
                          }
                        }}
                        onDoubleClick={() => appActions.openCardEditor(card)}
                        className={`border-b cursor-pointer transition-colors ${
                          isDark ? 'border-[#252730] hover:bg-white/5' : 'border-[#F4F4F8] hover:bg-[#F9F9FC]'
                        } ${isSelected ? 'bg-[var(--brand-soft)]' : ''}`}
                      >
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => appActions.toggleCardSelection(card.id)}
                            className="rounded cursor-pointer w-4 h-4"
                          />
                        </td>
                        <td
                          className="py-3 px-4 font-semibold max-w-[220px] truncate select-text cursor-text"
                          dangerouslySetInnerHTML={{
                            __html: renderMathAndRichHtml(card.frontHtml || card.front),
                          }}
                        />
                        <td
                          className={`py-3 px-4 ${subText} truncate max-w-[260px] select-text cursor-text`}
                          dangerouslySetInnerHTML={{
                            __html: renderMathAndRichHtml(card.backHtml || card.back),
                          }}
                        />
                        <td className="py-3 px-4 text-[12px]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: topBarColor }} />
                            <span className="truncate max-w-[120px]">{card.deckName}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-[var(--brand-text)]">
                          <div className="flex items-center gap-1 flex-wrap">
                            {cardFlagSpec && (
                              <span
                                style={{
                                  backgroundColor: cardFlagSpec.bgSoft,
                                  color: cardFlagSpec.hex,
                                }}
                                className="px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cardFlagSpec.hex }}
                                />
                                <span>{isZh ? cardFlagSpec.shortZh : cardFlagSpec.shortEn}</span>
                              </span>
                            )}
                            {card.tags.slice(0, 2).map((tItem) => (
                              <span key={tItem} className="px-1.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)]">
                                #{tItem}
                              </span>
                            ))}
                            {card.tags.length > 2 && (
                              <span className="text-[10px] text-[#8E8E93]">+{card.tags.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[12px] font-medium">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${
                              card.mastery >= 80
                                ? 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                                : card.mastery >= 50
                                ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                                : card.mastery > 0
                                ? 'bg-[var(--status-warning-soft)] text-[var(--status-warning)]'
                                : 'bg-black/5 dark:bg-white/5 text-[#8E8E93]'
                            }`}
                          >
                            {card.mastery}%
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-[12px] ${subText}`}>
                          <div className="flex items-center gap-1.5">
                            {isSuspended ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--status-warning-soft)] text-[var(--status-warning)]">
                                {isZh ? '已暂停' : 'Suspended'}
                              </span>
                            ) : isBuried ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/5 dark:bg-white/10 text-[#555558] dark:text-[#A1A1A6]">
                                {isZh ? '已搁置' : 'Buried'}
                              </span>
                            ) : (
                              <>
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    card.status === 'due'
                                      ? 'bg-[var(--status-danger)]'
                                      : card.status === 'new'
                                      ? 'bg-[var(--status-info)]'
                                      : 'bg-[var(--status-success)]'
                                  }`}
                                />
                                <span>{card.dueText}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              appActions.openCardEditor(card);
                            }}
                            className="h-6 px-2 rounded-lg text-[11px] font-medium text-[var(--brand-text)] hover:bg-[var(--brand-soft)] transition-colors cursor-pointer"
                          >
                            {isZh ? '编辑' : 'Edit'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {canLoadMore && (
              <div className="pt-4 flex justify-center">
                <button
                  onClick={() => appActions.loadMoreLibraryCards()}
                  className={`px-6 py-2 rounded-xl border text-[12px] font-medium cursor-pointer hover:border-[var(--brand-border)] ${cardSurface}`}
                >
                  {t('loadMoreCards', {
                    loaded: Math.min(visibleCards.length, totalMatchedCount),
                    total: totalMatchedCount,
                  })}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Batch Operations Bar */}
      {selectedCardIds.length > 0 && (
        <div className="fixed bottom-6 left-[calc(50%+120px)] -translate-x-1/2 z-30 flex flex-col items-center gap-2.5">
          {activeBatchModal === 'setFlag' && (
            <div
              className={`px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-2 ${
                isDark ? 'bg-[#1E1F28] border-[#323442] text-white' : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'
              }`}
            >
              <span className="text-[12px] text-[#8E8E93] mr-1">
                {isZh ? '批量标记旗标：' : 'Set flag:'}
              </span>
              {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
                const spec = ANKI_FLAG_PALETTE[fNum];
                return (
                  <button
                    key={fNum}
                    type="button"
                    onClick={() => {
                      appActions.executeBatchAction('setFlag', { flag: fNum });
                      setActiveBatchModal('none');
                    }}
                    title={isZh ? spec.labelZh : spec.labelEn}
                    style={{
                      backgroundColor: spec.bgSoft,
                      borderColor: spec.borderHex,
                      color: spec.hex,
                    }}
                    className="h-7 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: spec.hex }} />
                    <span>{isZh ? spec.shortZh : spec.shortEn}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  appActions.executeBatchAction('setFlag', { flag: 0 });
                  setActiveBatchModal('none');
                }}
                className="h-7 px-2.5 rounded-xl border border-black/10 dark:border-white/10 text-[11px] text-[#8E8E93] hover:text-[var(--status-danger)] cursor-pointer"
              >
                {isZh ? '清除' : 'Clear'}
              </button>
            </div>
          )}

          {activeBatchModal === 'addTag' && (
            <div
              className={`px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-2.5 ${
                isDark ? 'bg-[#1E1F28] border-[#323442] text-white' : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'
              }`}
            >
              <span className="text-[12px] text-[#8E8E93]">
                {isZh ? '为所选卡片添加标签：' : 'Add tags:'}
              </span>
              <input
                type="text"
                value={batchTagInput}
                onChange={(e) => setBatchTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmBatchTag();
                  else if (e.key === 'Escape') setActiveBatchModal('none');
                }}
                placeholder={isZh ? '输入标签名（空格分隔）...' : 'Tag names...'}
                autoFocus
                className="h-8 px-3 rounded-xl border border-[var(--brand)] text-[12px] bg-transparent focus:outline-none"
              />
              <button
                onClick={handleConfirmBatchTag}
                className="btn-primary !h-8 !px-3.5 !text-[12px]"
              >
                {t('confirm')}
              </button>
              <button
                onClick={() => setActiveBatchModal('none')}
                className="text-xs text-[#8E8E93] cursor-pointer px-1"
              >
                ✕
              </button>
            </div>
          )}

          {activeBatchModal === 'moveDeck' && (
            <div
              className={`px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-2.5 ${
                isDark ? 'bg-[#1E1F28] border-[#323442] text-white' : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'
              }`}
            >
              <span className="text-[12px] text-[#8E8E93]">
                {isZh ? '移动到目标牌组：' : 'Move to deck:'}
              </span>
              <select
                value={batchTargetDeckId}
                onChange={(e) => setBatchTargetDeckId(e.target.value)}
                className={`h-8 px-3 rounded-xl border text-[12px] ${
                  isDark ? 'bg-[#14151B] border-[#323442] text-white' : 'bg-[#F8F8FA] border-[#E5E5EA] text-[#1D1D1F]'
                }`}
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName || d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleConfirmBatchMoveDeck}
                className="btn-primary !h-8 !px-3.5 !text-[12px]"
              >
                {t('confirm')}
              </button>
              <button
                onClick={() => setActiveBatchModal('none')}
                className="text-xs text-[#8E8E93] cursor-pointer px-1"
              >
                ✕
              </button>
            </div>
          )}

          {activeBatchModal === 'confirmDelete' && (
            <div
              className={`px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-3 ${
                isDark ? 'bg-[#1E1F28] border-[var(--status-danger)]/40 text-white' : 'bg-white border-[var(--status-danger)]/40 text-[#1D1D1F]'
              }`}
            >
              <span className="text-[12px] text-[var(--status-danger)] font-medium">
                {isZh
                  ? `确认永久删除所选的 ${selectedCardIds.length} 张卡片吗？`
                  : `Permanently delete ${selectedCardIds.length} selected cards?`}
              </span>
              <button
                onClick={handleConfirmBatchDelete}
                className="h-8 px-3.5 rounded-xl bg-[var(--status-danger)] text-white text-[12px] font-semibold cursor-pointer"
              >
                {t('confirm')}
              </button>
              <button
                onClick={() => setActiveBatchModal('none')}
                className="text-xs text-[#8E8E93] cursor-pointer px-1"
              >
                {t('cancel')}
              </button>
            </div>
          )}

          <div
            className={`h-12 px-4 rounded-2xl border shadow-[0_12px_36px_rgba(0,0,0,0.12)] flex items-center gap-4 ${
              isDark ? 'bg-[#1E1F28] border-[#323442] text-white' : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'
            }`}
          >
            <span className="px-3 py-1 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] text-[12px] font-semibold">
              {t('selectedCountBadge', { n: selectedCardIds.length })}
            </span>

            {allSelectedBuried ? (
              <button
                onClick={() => appActions.executeBatchAction('unbury')}
                className="text-[13px] font-medium hover:text-[var(--brand-text)] cursor-pointer transition-colors"
              >
                {t('batchUnbury')}
              </button>
            ) : (
              <>
                <button
                  onClick={() =>
                    appActions.executeBatchAction(allSelectedSuspended ? 'unsuspend' : 'suspend')
                  }
                  className="text-[13px] font-medium hover:text-[var(--brand-text)] cursor-pointer transition-colors"
                >
                  {allSelectedSuspended ? t('batchUnsuspend') : t('batchSuspend')}
                </button>
                {!allSelectedSuspended && (
                  <button
                    onClick={() => appActions.executeBatchAction('bury')}
                    className="text-[13px] font-medium hover:text-[var(--brand-text)] cursor-pointer transition-colors"
                  >
                    {t('batchBury')}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() =>
                setActiveBatchModal((prev) => (prev === 'setFlag' ? 'none' : 'setFlag'))
              }
              className={`text-[13px] font-medium cursor-pointer transition-colors ${
                activeBatchModal === 'setFlag'
                  ? 'text-[var(--brand-text)] font-bold'
                  : 'hover:text-[var(--brand-text)]'
              }`}
            >
              {isZh ? '标旗' : 'Flag'}
            </button>

            <button
              onClick={() =>
                setActiveBatchModal((prev) => (prev === 'addTag' ? 'none' : 'addTag'))
              }
              className={`text-[13px] font-medium cursor-pointer transition-colors ${
                activeBatchModal === 'addTag' ? 'text-[var(--brand-text)] font-bold' : 'hover:text-[var(--brand-text)]'
              }`}
            >
              {t('batchAddTag')}
            </button>

            <button
              onClick={() => appActions.executeBatchAction('resetProgress')}
              className="text-[13px] font-medium hover:text-[var(--brand-text)] cursor-pointer transition-colors"
            >
              {t('batchResetProgress')}
            </button>

            <button
              onClick={() =>
                setActiveBatchModal((prev) => (prev === 'moveDeck' ? 'none' : 'moveDeck'))
              }
              className={`text-[13px] font-medium cursor-pointer transition-colors ${
                activeBatchModal === 'moveDeck' ? 'text-[var(--brand-text)] font-bold' : 'hover:text-[var(--brand-text)]'
              }`}
            >
              {t('batchMoveDeck')}
            </button>

            <button
              onClick={() =>
                setActiveBatchModal((prev) =>
                  prev === 'confirmDelete' ? 'none' : 'confirmDelete'
                )
              }
              className="text-[13px] font-medium text-[var(--status-danger)] hover:opacity-80 cursor-pointer transition-colors"
            >
              {t('batchDelete')}
            </button>

            <div className={`w-[1px] h-4 ${isDark ? 'bg-[#323442]' : 'bg-[#E5E5EA]'}`} />

            <button
              onClick={() => {
                setActiveBatchModal('none');
                appActions.clearCardSelection();
              }}
              className="text-[12px] text-[#8E8E93] hover:text-[var(--brand-text)] cursor-pointer"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
