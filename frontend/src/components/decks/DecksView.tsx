import React, { useState } from 'react';
import { DeckItem, DeckOptionsData } from '../../bridge/pycmd';
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
  const isZh = resolvedLang === 'zh-CN';
  const isSyncPending = isInitialSyncing || syncing;

  const [newDeckName, setNewDeckName] = useState('');
  const [parentFullName, setParentFullName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [renamingDeckId, setRenamingDeckId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);

  // Deck Options / FSRS Preset Configuration Modal State
  const [editingOptionsDeck, setEditingOptionsDeck] = useState<DeckItem | null>(null);
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
            {isZh ? '牌组管理' : 'Deck Management'}
          </h1>
          {isSyncPending ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--status-warning)] animate-ping" />
              <span className="text-[12px] font-medium text-[var(--status-warning)] tracking-tight">
                {isZh ? '正在从云端同步牌组层级与调度进度...' : 'Syncing decks hierarchy from cloud...'}
              </span>
            </div>
          ) : syncJustFinished ? (
            <div className="flex items-center gap-1.5 mt-1 animate-in fade-in duration-300">
              <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight">
                {isZh ? '✓ 牌组数据已同步就绪' : '✓ Decks synchronized'}
              </span>
            </div>
          ) : (
            <p className={`text-[13px] ${subText} mt-0.5`}>
              {isZh
                ? `已收纳 ${decks.length} 个牌组与多级知识层级`
                : `${decks.length} decks organized in hierarchical workspace`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => appActions.openSettings('maintenance')}
            className="btn-secondary !h-10 !px-3.5 flex items-center gap-1.5"
            title={isZh ? '导入/导出卡片包 (.apkg) 与系统维护工具' : 'Import / Export (.apkg) & Maintenance'}
          >
            <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{isZh ? '导入 / 导出与维护' : 'Import / Export'}</span>
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
            <span>{isZh ? '自定义特训 / 错题集' : 'Custom Study'}</span>
          </button>

          <button
            onClick={() => setShowCreateModal((prev) => !prev)}
            style={{ backgroundColor: brandHex }}
            className="btn-primary !h-10 !px-4"
          >
            <span>{isZh ? '+ 新建牌组' : '+ New Deck'}</span>
          </button>
        </div>
      </header>

      {/* Create Deck Drawer / Panel */}
      {showCreateModal && (
        <section className={`rounded-2xl border p-5 space-y-4 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold">
              {isZh ? '创建新牌组或子牌组' : 'Create Deck or Subdeck'}
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
                {isZh ? '父级牌组（可选，留空则为顶级牌组）' : 'Parent Deck (Optional)'}
              </label>
              <select
                value={parentFullName}
                onChange={(e) => setParentFullName(e.target.value)}
                className={`w-full h-10 px-3 rounded-xl border text-[13px] focus:outline-none focus:border-[var(--brand)] ${
                  isDark ? 'bg-[#14141A] border-[#2A2C36]' : 'bg-[#F8F8FA] border-[#E5E5EA]'
                }`}
              >
                <option value="">{isZh ? '（作为顶级牌组）' : '(Top-level Deck)'}</option>
                {decks.map((p) => (
                  <option key={p.id} value={p.fullName}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-5">
              <label className={`block text-[11px] ${subText} mb-1.5`}>
                {isZh ? '牌组名称（也支持直接输入 Parent::Child 格式）' : 'Deck Name (supports Parent::Child)'}
              </label>
              <input
                type="text"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateDeck();
                }}
                placeholder={isZh ? '例如：公考行测言语理解 或 计算机算法精选题库' : 'e.g., Computer Science::Algorithms'}
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
                {isZh ? '确认创建' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary !h-10 !px-4"
              >
                {isZh ? '取消' : 'Cancel'}
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
            {isZh ? '牌组层级名称 (Parent::Child)' : 'Deck Hierarchy (Parent::Child)'}
          </div>
          <div className="col-span-2">{isZh ? '今日待复习 / 新卡' : 'Due / New'}</div>
          <div className="col-span-2">{isZh ? '每日限额与 FSRS' : 'Daily Limit & FSRS'}</div>
          <div className="col-span-4 text-right">
            {isZh ? '操作（特训 / 预设 / 重命名 / 删除 / 学习）' : 'Actions'}
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
                    className="col-span-4 flex items-center gap-2.5 min-w-0 pr-2"
                    style={{ paddingLeft: `${deck.depth * 22}px` }}
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
                          {isZh ? '保存' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] flex items-center gap-2 truncate">
                          <span className="truncate">{deck.name}</span>
                          {deck.isChild && (
                            <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[10px] font-medium shrink-0">
                              {isZh ? '子牌组' : 'Subdeck'}
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] ${subText} truncate`}>
                          {deck.totalCards} {isZh ? '张' : 'cards'} · {isZh ? '熟练度' : 'Mastery'} {deck.mastery}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Due / New Pills */}
                  <div className="col-span-2 flex items-center gap-1.5 text-[12px]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] font-medium">
                      {isZh ? `复习 ${deck.dueReview}` : `Due ${deck.dueReview}`}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--status-warning-soft)] text-[var(--status-warning)] font-medium">
                      {isZh ? `新卡 ${deck.dueNew}` : `New ${deck.dueNew}`}
                    </span>
                  </div>

                  {/* Daily Limits & FSRS Retention Summary Pill */}
                  <div className="col-span-2 pr-3">
                    <button
                      type="button"
                      onClick={() => handleOpenDeckOptions(deck)}
                      title={isZh ? '点击配置每日新卡/复习上限与 FSRS 目标留存率' : 'Configure deck scheduling preset & FSRS'}
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
                          {isZh ? '确认删除' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setDeletingDeckId(null)}
                          className="btn-secondary !h-8 !px-2.5 !text-[12px]"
                        >
                          {isZh ? '取消' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            type="button"
                            onClick={() => appActions.openCustomStudyModal('mistakes', deck.id)}
                            className="btn-ghost !border !border-black/10 dark:!border-white/10 !h-8 !px-2.5 !text-[11px]"
                            title={isZh ? '针对此牌组发起错题或旗标特训' : 'Custom Study for this deck'}
                          >
                            {isZh ? '特训' : 'Cram'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeckOptions(deck)}
                            className="btn-ghost !border !border-black/10 dark:!border-white/10 !h-8 !px-2.5 !text-[11px]"
                            title={isZh ? '牌组调度预设与 FSRS 参数' : 'Deck Options & FSRS'}
                          >
                            {isZh ? '预设' : 'Options'}
                          </button>
                          <button
                            onClick={() => {
                              setRenamingDeckId(deck.id);
                              setRenameValue(deck.fullName);
                            }}
                            className="btn-ghost !border !border-black/10 dark:!border-white/10 !h-8 !px-2.5 !text-[11px]"
                            title={isZh ? '重命名牌组' : 'Rename deck'}
                          >
                            {isZh ? '重命名' : 'Rename'}
                          </button>
                          <button
                            onClick={() => setDeletingDeckId(deck.id)}
                            className="btn-ghost !text-[var(--status-danger)] hover:!bg-[var(--status-danger-soft)] !h-8 !px-2 !text-[11px]"
                            title={isZh ? '删除牌组' : 'Delete deck'}
                          >
                            {isZh ? '删除' : 'Delete'}
                          </button>
                        </div>

                        <button
                          onClick={() => appActions.startReview(deck.id)}
                          style={{ backgroundColor: brandHex }}
                          className="btn-primary !h-8 !px-3.5 !text-[12px]"
                        >
                          <span className="text-[10px]">▶</span>
                          <span>{isZh ? '开始学习' : 'Study'}</span>
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
      {editingOptionsDeck && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
          onClick={() => setEditingOptionsDeck(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isZh ? '牌组预设与核心调度参数' : 'Deck Scheduling Options'}
            onClick={(e) => e.stopPropagation()}
            className={`w-[520px] max-w-full rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${cardSurface}`}
          >
            <header
              className={`px-6 py-4 border-b flex items-center justify-between ${
                isDark ? 'border-[#2A2C36]' : 'border-[#EFEFF4]'
              }`}
            >
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">
                  {isZh ? '牌组预设与核心调度参数' : 'Deck Scheduling Options'}
                </h2>
                <p className={`text-[11px] ${subText} mt-0.5`}>
                  {editingOptionsDeck.fullName} ·{' '}
                  {isZh
                    ? `预设组：${editingOptionsDeck.options?.presetName || 'Default'}`
                    : `Preset: ${editingOptionsDeck.options?.presetName || 'Default'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOptionsDeck(null)}
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
                      {isZh ? '每日新卡上限' : 'New Cards / Day'}
                    </label>
                    <span className={`text-[11px] ${subText}`}>{isZh ? '张/天' : '/ day'}</span>
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
                      {isZh ? '每日最大复习数' : 'Max Reviews / Day'}
                    </label>
                    <span className={`text-[11px] ${subText}`}>{isZh ? '张/天' : '/ day'}</span>
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
                      {isZh ? 'FSRS 期望记忆留存率 (Desired Retention)' : 'FSRS Desired Retention'}
                    </div>
                    <div className={`text-[11px] ${subText} mt-0.5`}>
                      {optDesiredRetention <= 0.85
                        ? isZh
                          ? '轻量省时档：复习间隔更长，显著降低每日复习压力'
                          : 'Lighter workload: longer intervals, fewer daily reviews'
                        : optDesiredRetention >= 0.93
                        ? isZh
                          ? '考前高强档：记忆极牢固，但每日复习卡量会显著增加'
                          : 'High intensity: frequent reviews for maximum exam recall'
                        : isZh
                        ? '官方黄金平衡档：兼顾长期记忆稳固度与每日复习负担'
                        : 'Recommended balance between recall and daily workload'}
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
                  {[
                    { val: 0.85, label: isZh ? '85% 减负' : '85% Light' },
                    { val: 0.9, label: isZh ? '90% 标准' : '90% Standard' },
                    { val: 0.93, label: isZh ? '93% 进阶' : '93% High' },
                    { val: 0.95, label: isZh ? '95% 冲刺' : '95% Sprint' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setOptDesiredRetention(preset.val)}
                      className={`flex-1 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                        Math.round(optDesiredRetention * 100) === Math.round(preset.val * 100)
                          ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)] font-semibold'
                          : isDark
                          ? 'bg-[#1A1B23] border-[#2E303E] text-[#8E8E93]'
                          : 'bg-white border-[#E5E5EA] text-[#636366]'
                      }`}
                    >
                      {preset.label}
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
                  <span>
                    {isZh
                      ? '高级步长与顽固卡设置（学习步长 / 重学步长 / Leech 阈值）'
                      : 'Learning Steps & Leech Threshold'}
                  </span>
                  <span className={`text-[11px] ${subText} group-open:rotate-180 transition-transform`}>
                    ▾
                  </span>
                </summary>

                <div className="pt-3.5 mt-3 border-t border-black/5 dark:border-white/5 grid grid-cols-3 gap-3">
                  <div>
                    <label className={`block text-[11px] ${subText} mb-1`}>
                      {isZh ? '新卡学习步长' : 'Learning Steps'}
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
                      {isZh ? '遗忘重学步长' : 'Relearning Steps'}
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
                      {isZh ? '顽固卡失误阈值' : 'Leech Threshold'}
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
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveDeckOptions}
                style={{ backgroundColor: brandHex }}
                className="btn-primary !h-9 !px-5 !text-[12px]"
              >
                {isZh ? '保存调度参数' : 'Save Options'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
