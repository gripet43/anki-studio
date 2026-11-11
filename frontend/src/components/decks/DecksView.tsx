import React, { useRef, useState } from 'react';
import { DeckItem, DeckOptionsData } from '../../bridge/pycmd';
import { usePresence } from '../../hooks/usePresence';
import { translate } from '../../i18n/translations';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const DecksView: React.FC = () => {
  const {
    decks,
    collapsedDeckIds,
    theme,
    accentColor,
    resolvedLang,
    isInitialSyncing,
    syncing,
    syncJustFinished,
  } = useAppStore();
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  const isSyncPending = isInitialSyncing || syncing;

  const [newDeckName, setNewDeckName] = useState('');
  const [parentFullName, setParentFullName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [renamingDeckId, setRenamingDeckId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);

  // Deck Options / FSRS Preset Configuration Modal State
  const [editingOptionsDeck, setEditingOptionsDeck] = useState<DeckItem | null>(null);
  const lastOptionsDeckRef = useRef<DeckItem | null>(null);
  if (editingOptionsDeck) {
    lastOptionsDeckRef.current = editingOptionsDeck;
  }
  const optionsModalPresence = usePresence(Boolean(editingOptionsDeck), 120);
  const activeOptionsDeck = editingOptionsDeck || lastOptionsDeckRef.current;
  const [optNewPerDay, setOptNewPerDay] = useState<number>(20);
  const [optRevPerDay, setOptRevPerDay] = useState<number>(200);
  const [optDesiredRetention, setOptDesiredRetention] = useState<number>(0.9);
  const [optLearningSteps, setOptLearningSteps] = useState<string>('1m 10m');
  const [optRelearningSteps, setOptRelearningSteps] = useState<string>('10m');
  const [optLeechThreshold, setOptLeechThreshold] = useState<number>(8);

  const isDark = theme === 'dark' || theme === 'oled';
  const brandHex = getAccentScale(accentColor, theme).brand;

  const cardSurface =
    theme === 'oled'
      ? 'bg-[#111216] border-[#22232B] text-white'
      : theme === 'dark'
      ? 'bg-[#1A1B21] border-[#2A2C36] text-white'
      : 'bg-white border-[#EAECEF] text-[#1D1D1F]';

  const subText = 'text-[#8E8E93]';

  // Bug #12 Fix: Check if ANY ancestor deck in the hierarchy (`A`, `A::B`, `A::B::C`) is in `collapsedDeckIds`!
  const visibleDecks = decks.filter((d) => {
    if (!d.isChild) return true;
    const collapsedAncestor = decks.some(
      (ancestor) =>
        collapsedDeckIds.includes(ancestor.id) &&
        d.fullName.startsWith(`${ancestor.fullName}::`)
    );
    return !collapsedAncestor;
  });

  const handleCreateDeck = () => {
    if (!newDeckName.trim()) return;
    appActions.createDeck(newDeckName.trim(), parentFullName || undefined);
    setNewDeckName('');
    setParentFullName('');
    setShowCreateModal(false);
  };

  const handleOpenDeckOptions = (deck: DeckItem) => {
    const opts: Partial<DeckOptionsData> = deck.options || {};
    setEditingOptionsDeck(deck);
    setOptNewPerDay(opts.newPerDay ?? 20);
    setOptRevPerDay(opts.revPerDay ?? 200);
    setOptDesiredRetention(opts.desiredRetention ?? 0.9);
    setOptLearningSteps(opts.learningSteps || '1m 10m');
    setOptRelearningSteps(opts.relearningSteps || '10m');
    setOptLeechThreshold(opts.leechThreshold ?? 8);
  };

  const handleSaveDeckOptions = async () => {
    if (!editingOptionsDeck) return;
    await appActions.saveDeckOptions({
      deckId: editingOptionsDeck.id,
      newPerDay: optNewPerDay,
      revPerDay: optRevPerDay,
      desiredRetention: optDesiredRetention,
      learningSteps: optLearningSteps,
      relearningSteps: optRelearningSteps,
      leechThreshold: optLeechThreshold,
    });
    setEditingOptionsDeck(null);
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto px-8 py-6 space-y-6 select-none">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">
            {t('navDecks')}
          </h1>
          {isSyncPending ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--status-warning)] animate-ping" />
              <span className="text-[12px] font-medium text-[var(--status-warning)] tracking-tight">
                {syncing ? t('decksSyncingCloud') : t('decksLoadingLocal')}
              </span>
            </div>
          ) : syncJustFinished ? (
            <div className="flex items-center gap-1.5 mt-1 animate-in fade-in duration-300">
              <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight">
                ✓ {t('syncCompleted')}
              </span>
            </div>
          ) : (
            <p className={`text-[13px] ${subText} mt-0.5`}>
              {t('decksTotalCountSub', { n: decks.length })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => appActions.openSettings('maintenance')}
            className="btn-secondary !h-10 !px-3.5 flex items-center gap-1.5"
            title={t('importExportMaintBtn')}
          >
            <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{t('importExportMaintBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => appActions.openCustomStudyModal('mistakes')}
            className="btn-secondary !h-10 !px-4 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-[var(--brand-text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            <span>{t('customStudyEntryBtn')}</span>
          </button>

          <button
            onClick={() => setShowCreateModal((prev) => !prev)}
            style={{ backgroundColor: brandHex }}
            className="btn-primary !h-10 !px-4"
          >
            <span>+ {t('newDeckBtn')}</span>
          </button>
        </div>
      </header>

      {/* Create Deck Drawer / Panel */}
      {showCreateModal && (
        <section className={`rounded-2xl border p-5 space-y-4 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold">
              {t('createDeckModalTitle')}
            </h3>
            <button
              onClick={() => setShowCreateModal(false)}
              className={`text-xs ${subText} cursor-pointer`}
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-4">
              <label className={`block text-[11px] ${subText} mb-1.5`}>
                {t('parentDeckLabel')}
              </label>
              <select
                value={parentFullName}
                onChange={(e) => setParentFullName(e.target.value)}
                className={`w-full h-10 px-3 rounded-xl border text-[13px] focus:outline-none focus:border-[var(--brand)] ${
                  isDark ? 'bg-[#14141A] border-[#2A2C36]' : 'bg-[#F8F8FA] border-[#E5E5EA]'
                }`}
              >
                <option value="">{t('topLevelDeckOption')}</option>
                {decks.map((p) => (
                  <option key={p.id} value={p.fullName}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-5">
              <label className={`block text-[11px] ${subText} mb-1.5`}>
                {t('deckNameInputLabel')}
              </label>
              <input
                type="text"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateDeck();
                }}
                placeholder={t('deckNamePlaceholder')}
                autoFocus
                className={`w-full h-10 px-3.5 rounded-xl border text-[13px] focus:outline-none focus:border-[var(--brand)] ${
                  isDark ? 'bg-[#14141A] border-[#2A2C36]' : 'bg-[#F8F8FA] border-[#E5E5EA]'
                }`}
              />
            </div>

            <div className="col-span-3 flex items-center gap-2">
              <button
                onClick={handleCreateDeck}
                style={{ backgroundColor: brandHex }}
                className="btn-primary !h-10 flex-1"
              >
                {t('confirm')}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary !h-10 !px-4"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Hierarchical Deck Tree Table */}
      <section className={`rounded-2xl border overflow-hidden ${cardSurface}`}>
        <div
          className={`px-6 py-3.5 border-b text-[11px] font-medium ${subText} grid grid-cols-12 items-center ${
            isDark ? 'border-[#2A2C36] bg-[#15161C]' : 'border-[#EFEFF4] bg-[#FAFAFC]'
          }`}
        >
          <div className="col-span-4">
            {t('deckTableColHierarchy')}
          </div>
          <div className="col-span-2">{t('deckTableColDueNew')}</div>
          <div className="col-span-2">{t('deckTableColLimitsFsrs')}</div>
          <div className="col-span-4 text-end">
            {t('deckTableColActions')}
          </div>
        </div>

        <div className="divide-y divide-[#EFEFF4] dark:divide-[#2A2C36]">
          {isSyncPending ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="px-6 py-4 grid grid-cols-12 items-center">
                <div className="col-span-4 flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg animate-skeleton-shimmer" />
                  <div className="w-32 h-4 rounded animate-skeleton-shimmer" />
                </div>
                <div className="col-span-2">
                  <div className="w-16 h-3.5 rounded animate-skeleton-shimmer" />
                </div>
                <div className="col-span-2">
                  <div className="w-20 h-3.5 rounded animate-skeleton-shimmer" />
                </div>
                <div className="col-span-4 flex justify-end">
                  <div className="w-16 h-7 rounded-lg animate-skeleton-shimmer" />
                </div>
              </div>
            ))
          ) : (
            visibleDecks.map((deck) => {
              const hasChildren =
                deck.childrenCount > 0 ||
                decks.some((c) => c.parentId === deck.id || c.fullName.startsWith(`${deck.fullName}::`));
              const isCollapsed = collapsedDeckIds.includes(deck.id);
              const isRenaming = renamingDeckId === deck.id;
              const isConfirmingDelete = deletingDeckId === deck.id;
              const opts = deck.options;

              return (
                <div
                  key={deck.id}
                  className={`group px-6 py-4 grid grid-cols-12 items-center transition-colors ${
                    isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-[#F9F9FC]'
                  } ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}
                >
                  {/* Deck Name + Multi-Level Tree Indentation */}
                  <div
                    className="col-span-4 flex items-center gap-2.5 min-w-0 pe-2"
                    style={{ paddingInlineStart: `${deck.depth * 22}px` }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={() => appActions.toggleDeckCollapse(deck.id)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs cursor-pointer shrink-0 ${
                          isDark ? 'bg-[#262630] text-white' : 'bg-[#F2F2F7] text-[#3A3A3C]'
                        }`}
                      >
                        {isCollapsed ? '▸' : '▾'}
                      </button>
                    ) : (
                      <span className="w-6 text-center text-[#8E8E93] text-xs shrink-0">
                        {deck.isChild ? '└' : '●'}
                      </span>
                    )}

                    {isRenaming ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              appActions.renameDeck(deck.id, renameValue);
                              setRenamingDeckId(null);
                            } else if (e.key === 'Escape') {
                              setRenamingDeckId(null);
                            }
                          }}
                          autoFocus
                          className="h-8 px-2.5 rounded-lg border border-[var(--brand)] text-[13px] bg-transparent focus:outline-none flex-1"
                        />
                        <button
                          onClick={() => {
                            appActions.renameDeck(deck.id, renameValue);
                            setRenamingDeckId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--brand)] text-white text-[11px] cursor-pointer"
                        >
                          {t('saveNickname')}
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] flex items-center gap-2 truncate">
                          <span className="truncate">{deck.name}</span>
                          {deck.isChild && (
                            <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[10px] font-medium shrink-0">
                              {t('subdeckBadge')}
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] ${subText} truncate`}>
                          {deck.totalCards} {t('cardsUnit')} · {t('masteryLabel')} {deck.mastery}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Due / New Pills */}
                  <div className="col-span-2 flex items-center gap-1.5 text-[12px]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] font-medium">
                      {t('dueReviewPill', { n: deck.dueReview })}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--status-warning-soft)] text-[var(--status-warning)] font-medium">
                      {t('dueNewPill', { n: deck.dueNew })}
                    </span>
                  </div>

                  {/* Daily Limits & FSRS Retention Summary Pill */}
                  <div className="col-span-2 pe-3">
                    <button
                      type="button"
                      onClick={() => handleOpenDeckOptions(deck)}
                      title={t('deckOptionsTitle')}
                      className={`px-2.5 py-1 rounded-xl border text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isDark
                          ? 'bg-[#14151C] border-[#2A2C36] hover:border-[var(--brand-border)] text-[#C8C8D2]'
                          : 'bg-[#F8F8FA] border-[#E5E5EA] hover:border-[var(--brand-border)] text-[#4A4A52]'
                      }`}
                    >
                      <span className="font-mono font-semibold text-[var(--brand-text)]">
                        {opts ? `${opts.newPerDay}/${opts.revPerDay}` : '20/200'}
                      </span>
                      <span className="opacity-40">·</span>
                      <span>
                        FSRS {opts ? `${Math.round(opts.desiredRetention * 100)}%` : '90%'}
                      </span>
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="col-span-4 flex items-center justify-end gap-1.5">
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                        <button
                          onClick={() => {
                            appActions.deleteDeck(deck.id);
                            setDeletingDeckId(null);
                          }}
                          className="btn-primary !bg-[var(--status-danger)] !h-8 !px-3 !text-[12px]"
                        >
                          {t('confirm')}
                        </button>
                        <button
                          onClick={() => setDeletingDeckId(null)}
                          className="btn-secondary !h-8 !px-2.5 !text-[12px]"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            type="button"
                            onClick={() => appActions.openCustomStudyModal('mistakes', deck.id)}
                            className="btn-ghost !border !border-black/10 dark:!border-white/10 !h-8 !px-2.5 !text-[11px]"
                            title={t('customStudyEntryBtn')}
                          >
                            {t('deckActionCram')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeckOptions(deck)}
                            className="btn-ghost !border !border-black/10 dark:!border-white/10 !h-8 !px-2.5 !text-[11px]"
                            title={t('deckOptionsTitle')}
                          >
                            {t('deckActionOptions')}
                          </button>
                          <button
                            onClick={() => {
                              setRenamingDeckId(deck.id);
                              setRenameValue(deck.fullName);
                            }}
                            className="btn-ghost !border !border-black/10 dark:!border-white/10 !h-8 !px-2.5 !text-[11px]"
                            title={t('deckActionRename')}
                          >
                            {t('deckActionRename')}
                          </button>
                          <button
                            onClick={() => setDeletingDeckId(deck.id)}
                            className="btn-ghost !text-[var(--status-danger)] hover:!bg-[var(--status-danger-soft)] !h-8 !px-2 !text-[11px]"
                            title={t('batchDelete')}
                          >
                            {t('batchDelete')}
                          </button>
                        </div>

                        <button
                          onClick={() => appActions.startReview(deck.id)}
                          style={{ backgroundColor: brandHex }}
                          className="btn-primary !h-8 !px-3.5 !text-[12px]"
                        >
                          <span className="text-[10px]">▶</span>
                          <span>{t('navStudy')}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Deck Options & Core Scheduling Parameters Modal */}
      {optionsModalPresence.mounted && activeOptionsDeck && (
        <div
          data-state={optionsModalPresence.state}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none ui-modal-backdrop"
        >
          <div
            data-state={optionsModalPresence.state}
            role="dialog"
            aria-modal="true"
            aria-label={t('deckOptionsTitle')}
            className={`w-[520px] max-w-full rounded-3xl border shadow-2xl overflow-hidden flex flex-col ui-modal-panel ${cardSurface}`}
          >
            <header
              className={`px-6 py-4 border-b flex items-center justify-between ${
                isDark ? 'border-[#2A2C36]' : 'border-[#EFEFF4]'
              }`}
            >
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">
                  {t('deckOptionsTitle')}
                </h2>
                <p className={`text-[11px] ${subText} mt-0.5`}>
                  {activeOptionsDeck.fullName} · {activeOptionsDeck.options?.presetName || 'Default'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOptionsDeck(null)}
                aria-label={t('close')}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-current cursor-pointer"
              >
                ✕
              </button>
            </header>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* 1. Daily New Cards & Maximum Reviews */}
              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    isDark ? 'bg-[#14151C] border-[#262834]' : 'bg-[#F8F8FA] border-[#EAECEF]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-semibold">
                      {t('deckOptNewPerDayLabel')}
                    </label>
                    <span className={`text-[11px] ${subText}`}>/ {t('daysUnit')}</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={optNewPerDay}
                    onChange={(e) => setOptNewPerDay(Math.max(0, parseInt(e.target.value || '0', 10)))}
                    className={`w-full h-9 px-3 rounded-xl border font-mono text-[14px] font-bold focus:outline-none focus:border-[var(--brand)] ${
                      isDark ? 'bg-[#1A1B23] border-[#2E303E]' : 'bg-white border-[#E5E5EA]'
                    }`}
                  />
                  <div className="flex items-center gap-1">
                    {[0, 10, 20, 30, 50].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setOptNewPerDay(v)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-mono cursor-pointer transition-colors ${
                          optNewPerDay === v
                            ? 'bg-[var(--brand)] text-white font-semibold'
                            : 'bg-black/5 dark:bg-white/5 text-[#8E8E93] hover:text-current'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    isDark ? 'bg-[#14151C] border-[#262834]' : 'bg-[#F8F8FA] border-[#EAECEF]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-semibold">
                      {t('deckOptRevPerDayLabel')}
                    </label>
                    <span className={`text-[11px] ${subText}`}>/ {t('daysUnit')}</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={optRevPerDay}
                    onChange={(e) => setOptRevPerDay(Math.max(0, parseInt(e.target.value || '0', 10)))}
                    className={`w-full h-9 px-3 rounded-xl border font-mono text-[14px] font-bold focus:outline-none focus:border-[var(--brand)] ${
                      isDark ? 'bg-[#1A1B23] border-[#2E303E]' : 'bg-white border-[#E5E5EA]'
                    }`}
                  />
                  <div className="flex items-center gap-1">
                    {[50, 100, 200, 500, 9999].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setOptRevPerDay(v)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-mono cursor-pointer transition-colors ${
                          optRevPerDay === v
                            ? 'bg-[var(--brand)] text-white font-semibold'
                            : 'bg-black/5 dark:bg-white/5 text-[#8E8E93] hover:text-current'
                        }`}
                      >
                        {v === 9999 ? '∞' : v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. FSRS Desired Retention Slider */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-[#14151C] border-[#262834]' : 'bg-[#F8F8FA] border-[#EAECEF]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold">
                      {t('deckOptFsrsDesiredRetentionLabel')}
                    </div>
                    <div className={`text-[11px] ${subText} mt-0.5`}>
                      {optDesiredRetention <= 0.85
                        ? t('deckOptRetentionLightSub')
                        : optDesiredRetention >= 0.93
                        ? t('deckOptRetentionHighSub')
                        : t('deckOptRetentionBalancedSub')}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] font-mono text-[14px] font-bold">
                    {Math.round(optDesiredRetention * 100)}%
                  </span>
                </div>

                <input
                  type="range"
                  min={0.75}
                  max={0.97}
                  step={0.01}
                  value={optDesiredRetention}
                  onChange={(e) => setOptDesiredRetention(parseFloat(e.target.value))}
                  className="w-full accent-[var(--brand)] cursor-pointer"
                />

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  {[0.85, 0.9, 0.93, 0.95].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOptDesiredRetention(val)}
                      className={`flex-1 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                        Math.round(optDesiredRetention * 100) === Math.round(val * 100)
                          ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)] font-semibold'
                          : isDark
                          ? 'bg-[#1A1B23] border-[#2E303E] text-[#8E8E93]'
                          : 'bg-white border-[#E5E5EA] text-[#636366]'
                      }`}
                    >
                      {Math.round(val * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Progressive Disclosure: Learning Steps & Leech Threshold */}
              <details
                className={`rounded-2xl border px-4 py-3 group ${
                  isDark ? 'bg-[#14151C] border-[#262834]' : 'bg-[#F8F8FA] border-[#EAECEF]'
                }`}
              >
                <summary className="text-[12px] font-semibold cursor-pointer flex items-center justify-between list-none">
                  <span>{t('deckOptAdvancedStepsSummary')}</span>
                  <span className={`text-[11px] ${subText} group-open:rotate-180 transition-transform`}>
                    ▾
                  </span>
                </summary>

                <div className="pt-3.5 mt-3 border-t border-black/5 dark:border-white/5 grid grid-cols-3 gap-3">
                  <div>
                    <label className={`block text-[11px] ${subText} mb-1`}>
                      {t('deckOptLearningStepsLabel')}
                    </label>
                    <input
                      type="text"
                      value={optLearningSteps}
                      onChange={(e) => setOptLearningSteps(e.target.value)}
                      placeholder="1m 10m"
                      className={`w-full h-8 px-2.5 rounded-xl border font-mono text-[12px] focus:outline-none focus:border-[var(--brand)] ${
                        isDark ? 'bg-[#1A1B23] border-[#2E303E]' : 'bg-white border-[#E5E5EA]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] ${subText} mb-1`}>
                      {t('deckOptRelearningStepsLabel')}
                    </label>
                    <input
                      type="text"
                      value={optRelearningSteps}
                      onChange={(e) => setOptRelearningSteps(e.target.value)}
                      placeholder="10m"
                      className={`w-full h-8 px-2.5 rounded-xl border font-mono text-[12px] focus:outline-none focus:border-[var(--brand)] ${
                        isDark ? 'bg-[#1A1B23] border-[#2E303E]' : 'bg-white border-[#E5E5EA]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] ${subText} mb-1`}>
                      {t('deckOptLeechThresholdLabel')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={optLeechThreshold}
                      onChange={(e) =>
                        setOptLeechThreshold(Math.max(1, parseInt(e.target.value || '8', 10)))
                      }
                      className={`w-full h-8 px-2.5 rounded-xl border font-mono text-[12px] focus:outline-none focus:border-[var(--brand)] ${
                        isDark ? 'bg-[#1A1B23] border-[#2E303E]' : 'bg-white border-[#E5E5EA]'
                      }`}
                    />
                  </div>
                </div>
              </details>
            </div>

            <footer
              className={`px-6 py-4 border-t flex items-center justify-end gap-2.5 ${
                isDark ? 'border-[#2A2C36] bg-[#14151C]/60' : 'border-[#EFEFF4] bg-[#FAFAFC]'
              }`}
            >
              <button
                type="button"
                onClick={() => setEditingOptionsDeck(null)}
                className="btn-secondary !h-9 !px-4 !text-[12px]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveDeckOptions}
                style={{ backgroundColor: brandHex }}
                className="btn-primary !h-9 !px-5 !text-[12px]"
              >
                {t('saveNickname')}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
