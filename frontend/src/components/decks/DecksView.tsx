import React, { useState } from 'react';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const DecksView: React.FC = () => {
  const { decks, collapsedDeckIds, theme, accentColor, resolvedLang, isInitialSyncing, syncing, syncJustFinished } = useAppStore();
  const isZh = resolvedLang === 'zh-CN';
  const isSyncPending = isInitialSyncing || syncing;

  const [newDeckName, setNewDeckName] = useState('');
  const [parentFullName, setParentFullName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [renamingDeckId, setRenamingDeckId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);

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

        <button
          onClick={() => setShowCreateModal((prev) => !prev)}
          style={{ backgroundColor: brandHex }}
          className="btn-primary !h-10 !px-4"
        >
          <span>{isZh ? '+ 新建牌组' : '+ New Deck'}</span>
        </button>
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
          <div className="col-span-5">
            {isZh ? '牌组层级名称 (Parent::Child)' : 'Deck Hierarchy (Parent::Child)'}
          </div>
          <div className="col-span-2">{isZh ? '今日待复习 / 新卡' : 'Due / New'}</div>
          <div className="col-span-2">{isZh ? '总卡片数 & 熟练度' : 'Total & Mastery'}</div>
          <div className="col-span-3 text-right">
            {isZh ? '操作（复习 / 重命名 / 删除）' : 'Actions'}
          </div>
        </div>

        <div className="divide-y divide-[#EFEFF4] dark:divide-[#2A2C36]">
          {isSyncPending ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="px-6 py-4 grid grid-cols-12 items-center">
                <div className="col-span-5 flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg animate-skeleton-shimmer" />
                  <div className="w-32 h-4 rounded animate-skeleton-shimmer" />
                </div>
                <div className="col-span-2">
                  <div className="w-16 h-3.5 rounded animate-skeleton-shimmer" />
                </div>
                <div className="col-span-2">
                  <div className="w-20 h-3.5 rounded animate-skeleton-shimmer" />
                </div>
                <div className="col-span-3 flex justify-end">
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

              return (
                <div
                  key={deck.id}
                  className={`group px-6 py-4 grid grid-cols-12 items-center transition-colors ${
                    isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-[#F9F9FC]'
                  } ${syncJustFinished ? 'animate-sync-reveal delay-stagger-1' : ''}`}
                >
                {/* Deck Name + Multi-Level Tree Indentation */}
                <div
                  className="col-span-5 flex items-center gap-2.5"
                  style={{ paddingLeft: `${deck.depth * 24}px` }}
                >
                  {hasChildren ? (
                    <button
                      onClick={() => appActions.toggleDeckCollapse(deck.id)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs cursor-pointer ${
                        isDark ? 'bg-[#262630] text-white' : 'bg-[#F2F2F7] text-[#3A3A3C]'
                      }`}
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </button>
                  ) : (
                    <span className="w-6 text-center text-[#8E8E93] text-xs">
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
                    <div>
                      <div className="font-semibold text-[14px] flex items-center gap-2">
                        <span>{deck.name}</span>
                        {deck.isChild && (
                          <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[10px] font-medium">
                            {isZh ? '子牌组' : 'Subdeck'}
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] ${subText}`}>{deck.fullName}</div>
                    </div>
                  )}
                </div>

                {/* Due / New Pills */}
                <div className="col-span-2 flex items-center gap-2 text-[12px]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] font-medium">
                    {isZh ? `复习 ${deck.dueReview}` : `Due ${deck.dueReview}`}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--status-warning-soft)] text-[var(--status-warning)] font-medium">
                    {isZh ? `新卡 ${deck.dueNew}` : `New ${deck.dueNew}`}
                  </span>
                </div>

                {/* Total Cards & Mastery Bar */}
                <div className="col-span-2 pr-4">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className={subText}>
                      {deck.totalCards} {isZh ? '张' : 'cards'}
                    </span>
                    <span className="font-semibold">{deck.mastery}%</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-[#2A2C36]' : 'bg-[#ECECF2]'}`}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${deck.mastery}%`, backgroundColor: brandHex }}
                    />
                  </div>
                </div>

                {/* Actions: Study (Primary, prominent), Rename & Delete (Secondary, elegant hover reveal) */}
                <div className="col-span-3 flex items-center justify-end gap-2">
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
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                          onClick={() => {
                            setRenamingDeckId(deck.id);
                            // Bug #12 Fix: Initialize with fullName so user sees parent hierarchy clearly
                            setRenameValue(deck.fullName);
                          }}
                          className="btn-ghost !border !border-black/10 dark:!border-white/10 !h-8 !px-2.5"
                          title={isZh ? '重命名牌组' : 'Rename deck'}
                        >
                          {isZh ? '重命名' : 'Rename'}
                        </button>
                        <button
                          onClick={() => setDeletingDeckId(deck.id)}
                          className="btn-ghost !text-[var(--status-danger)] hover:!bg-[var(--status-danger-soft)] !h-8 !px-2.5"
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
    </div>
  );
};
