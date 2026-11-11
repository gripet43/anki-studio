import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ANKI_FLAG_PALETTE, CardFlagColor } from '../../bridge/pycmd';
import { formatShortcut, translate } from '../../i18n/translations';
import { appActions, setAppState, showToast, useAppStore } from '../../stores/useAppStore';
import { renderMathAndRichHtml } from '../../utils/mathRenderer';
import { getAccentScale } from '../../utils/themeTokens';

export const ReviewerView: React.FC = () => {
  const {
    reviewQueue,
    currentCardIndex,
    isSessionComplete,
    isPreviewSession,
    isCardFlipped,
    sessionTotalTimeMs,
    revealedHintsCount,
    optionKeyHeld,
    sessionStudiedCount,
    sessionCorrectCount,
    inlineEditing,
    editingField,
    inspectorOpen,
    slashMenuOpen,
    playingAudioFile,
    decks,
    theme,
    accentColor,
    resolvedLang,
    envInfo,
    showShortcutHints,
    activeDeckId,
  } = useAppStore();

  const isDark = theme === 'dark' || theme === 'oled';
  const isZh = resolvedLang === 'zh-CN';
  const brandHex = getAccentScale(accentColor, theme).brand;
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  const platform = envInfo.platform;
  const isMac = platform === 'mac' || envInfo.platform === 'mac';

  const currentCard = reviewQueue[currentCardIndex] || reviewQueue[0];

  const [fieldsDraft, setFieldsDraft] = useState<Record<string, string>>(currentCard?.fields || {});
  const [originalFieldsDraft, setOriginalFieldsDraft] = useState<Record<string, string>>(
    currentCard?.fields || {}
  );
  const [activeFieldKey, setActiveFieldKey] = useState<string>(editingField || '释义');
  const [newTagInput, setNewTagInput] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [flagPopoverOpen, setFlagPopoverOpen] = useState(false);

  // Milestone 3: Type-in-the-Answer (默写检验与逐字差异高亮)
  const [typeAnswerEnabled, setTypeAnswerEnabled] = useState(false);
  const [typeAnswerInput, setTypeAnswerInput] = useState('');

  const activeInputRef = useRef<HTMLInputElement>(null);
  const typeAnswerInputRef = useRef<HTMLInputElement>(null);
  const flagMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (flagMenuRef.current && !flagMenuRef.current.contains(e.target as Node)) {
        setFlagPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const hasDraftChanges = useMemo(() => {
    const allKeys = Array.from(
      new Set([...Object.keys(fieldsDraft), ...Object.keys(originalFieldsDraft)])
    );
    for (const k of allKeys) {
      if ((fieldsDraft[k] || '') !== (originalFieldsDraft[k] || '')) return true;
    }
    return false;
  }, [fieldsDraft, originalFieldsDraft]);

  useEffect(() => {
    setConfirmingDelete(false);
    setFlagPopoverOpen(false);
    setTypeAnswerInput('');
    if (currentCard) {
      const autoType =
        currentCard.tags.some(
          (tg) => tg === '默写' || tg.toLowerCase() === 'type' || tg.toLowerCase() === 'type-answer'
        ) ||
        Boolean(
          currentCard.noteTypeName &&
            /type|默写|输入|拼写/i.test(currentCard.noteTypeName)
        );
      if (autoType) {
        setTypeAnswerEnabled(true);
      }
      const fMap =
        currentCard.fields && Object.keys(currentCard.fields).length > 0
          ? { ...currentCard.fields }
          : {
              正面: currentCard.front,
              释义: currentCard.meaning,
              ...(currentCard.example ? { 例句: currentCard.example } : {}),
            };
      setFieldsDraft(fMap);
      setOriginalFieldsDraft(fMap);
      const keys = currentCard.fieldOrder || Object.keys(fMap);
      if (editingField && editingField in fMap) {
        setActiveFieldKey(editingField);
      } else if (keys.length > 1) {
        setActiveFieldKey(keys[1]);
      } else if (keys.length > 0) {
        setActiveFieldKey(keys[0]);
      }
    }
  }, [currentCard, editingField]);

  useEffect(() => {
    if (inlineEditing && activeInputRef.current) {
      activeInputRef.current.focus();
    }
  }, [inlineEditing, activeFieldKey]);

  const commitInlineChanges = (nextFields?: Record<string, string>) => {
    if (!currentCard) return;
    const finalFields = nextFields || fieldsDraft;
    const keys = currentCard.fieldOrder || Object.keys(finalFields);
    const frontKey = keys[0] || '正面';
    const meaningKey =
      keys.find((k) => k === '释义' || k === '背面' || k === 'Back' || k === 'Back Extra') ||
      keys[1] ||
      frontKey;
    const exampleKey = keys.find((k) => k === '例句' || k === 'Example');
    const etymKey = keys.find((k) => k === '词源' || k === 'Etymology');
    const readingKey = keys.find((k) => k === '读音' || k === 'Reading');

    appActions.saveInlineCardUpdate({
      fields: finalFields,
      front: finalFields[frontKey] ?? currentCard.front,
      meaning: finalFields[meaningKey] ?? currentCard.meaning,
      example: exampleKey ? finalFields[exampleKey] : currentCard.example,
      etymology: etymKey ? finalFields[etymKey] : currentCard.etymology,
      reading: readingKey ? finalFields[readingKey] : currentCard.reading,
      frontHtml: finalFields[frontKey] ?? currentCard.frontHtml,
      frontAnswerHtml: finalFields[frontKey] ?? currentCard.frontAnswerHtml,
      backHtml: finalFields[meaningKey] ?? currentCard.backHtml,
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAppState({ optionKeyHeld: true });
      }

      if (isSessionComplete || !currentCard) {
        if (e.key === 'Escape') {
          e.preventDefault();
          appActions.exitReview();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          appActions.undoLastReview();
        }
        return;
      }

      if (inlineEditing) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          commitInlineChanges();
          appActions.exitInlineEdit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (slashMenuOpen) {
            setAppState({ slashMenuOpen: false });
          } else {
            setFieldsDraft({ ...originalFieldsDraft });
            appActions.exitInlineEdit();
          }
        } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setFieldsDraft((prev) => ({
            ...prev,
            [activeFieldKey]: `${prev[activeFieldKey] || ''} {{c1::...}}`,
          }));
          showToast(
            resolvedLang === 'zh-CN' ? '已插入一键挖空 {{c1::...}}' : 'Inserted Cloze {{c1::...}}'
          );
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      // CardEditorModal uses a contentEditable DIV, which is not in the tag
      // whitelist: typing a space or digit used to flip/grade the card instead.
      if (
        target?.isContentEditable ||
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      // 7-Color Flag Shortcuts: Cmd+1..7 (or Ctrl+1..7) toggles flag 1..7, Cmd+0 clears flag
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && /^[0-7]$/.test(e.key)) {
        e.preventDefault();
        const flagVal = parseInt(e.key, 10) as CardFlagColor;
        appActions.setCurrentReviewCardFlag(flagVal, true);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        appActions.exitReview();
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        appActions.flipCard();
        return;
      }

      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        appActions.playAudio();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        appActions.undoLastReview();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setAppState((prev) => ({ inspectorOpen: !prev.inspectorOpen }));
        return;
      }

      if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (currentCard) {
          appActions.openCardEditor(currentCard);
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (!isCardFlipped) {
          appActions.flipCard();
        } else {
          appActions.revealNextHint();
        }
        return;
      }

      if (!isCardFlipped) {
        if (e.key === 'Enter') {
          e.preventDefault();
          appActions.flipCard();
        }
        return;
      }

      if (optionKeyHeld) {
        if (e.key === '1') {
          e.preventDefault();
          appActions.answerCurrentCard(1);
        } else if (e.key === '2') {
          e.preventDefault();
          appActions.answerCurrentCard(2);
        } else if (e.key === '3' || e.key === 'Enter') {
          e.preventDefault();
          appActions.answerCurrentCard(3);
        } else if (e.key === '4') {
          e.preventDefault();
          appActions.answerCurrentCard(4);
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          appActions.answerCurrentCard(1);
        } else if (e.key === '2' || e.key === '3' || e.key === 'Enter') {
          e.preventDefault();
          appActions.answerCurrentCard(3);
        } else if (e.key === '4') {
          e.preventDefault();
          appActions.answerCurrentCard(4);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAppState({ optionKeyHeld: false });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    inlineEditing,
    slashMenuOpen,
    fieldsDraft,
    activeFieldKey,
    optionKeyHeld,
    isCardFlipped,
    isSessionComplete,
    currentCard,
    resolvedLang,
  ]);

  const totalSessionCards = Math.max(reviewQueue.length, 1);
  const currentNumber = Math.min(totalSessionCards, currentCardIndex + 1);
  const progressPct = isSessionComplete ? 100 : Math.round((currentNumber / totalSessionCards) * 100);

  const accuracyPct =
    sessionStudiedCount > 0 ? Math.round((sessionCorrectCount / sessionStudiedCount) * 100) : 0;
  const avgSecDisplay =
    sessionStudiedCount > 0 ? (sessionTotalTimeMs / sessionStudiedCount / 1000).toFixed(1) : '0.0';

  // Item #6: Strict Light / Dark / OLED Surface Tokens
  const screenBg =
    theme === 'oled'
      ? 'bg-[#09090C] text-[#F4F4F6]'
      : theme === 'dark'
      ? 'bg-[#131418] text-[#F2F3F7]'
      : 'bg-[#F4F4F6] text-[#1D1D1F]';

  const headerBtnSurface = isDark
    ? 'bg-[#17181E] border-white/[0.07] text-[#8E8E93] hover:text-white'
    : 'bg-white border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] shadow-2xs';

  const cardContainerSurface = isDark
    ? 'bg-[#16171D] border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.65)] text-white'
    : 'bg-white border-[#EAECEF] shadow-[0_20px_50px_rgba(0,0,0,0.07)] text-[#1D1D1F]';

  const inspectorSurface = isDark
    ? 'bg-[#121318]/95 border-white/[0.07] text-white'
    : 'bg-white/95 border-[#E5E5EA] text-[#1D1D1F] shadow-[-12px_0_36px_rgba(0,0,0,0.06)]';

  // Milestone 3: Extract expected target answer and compute character-level LCS diff
  // 必须放在会话完成态的提前 return 之前：否则「无卡片 / 已完成」与「有卡片」两条渲染路径的 Hook 数量不一致，
  // React 会抛 #310 "Rendered more hooks than during the previous render"。
  const expectedTypeTarget = useMemo(() => {
    if (!currentCard) return '';
    // For Cloze cards, extract the first {{cN::answer}} token
    const rawFront = currentCard.front || currentCard.frontHtml || '';
    const clozeMatch = rawFront.match(/\{\{c\d+::([^:}]+)(?:::[^}]*)?\}\}/i);
    if (clozeMatch && clozeMatch[1]) {
      return clozeMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    // Otherwise use the stripped plain text of the first non-empty line of meaning/back
    const rawBack = (currentCard.meaning || currentCard.backHtml || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>|<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    const firstLine =
      rawBack
        .split('\n')
        .map((l) => l.trim())
        .find(Boolean) || rawBack;
    return firstLine.slice(0, 120);
  }, [currentCard]);

  const typeAnswerDiff = useMemo(() => {
    const typed = typeAnswerInput.trim();
    const expected = expectedTypeTarget.trim();
    if (!expected) {
      return {
        accuracy: 100,
        isExact: true,
        typedTokens: [] as Array<{ char: string; status: 'match' | 'wrong' }>,
        expectedTokens: [] as Array<{ char: string; status: 'match' | 'missing' }>,
      };
    }

    const a = Array.from(typed);
    const b = Array.from(expected);
    const m = a.length;
    const n = b.length;

    // LCS DP table (case-insensitive comparison for Latin letters)
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    const eq = (c1: string, c2: string) => c1.toLowerCase() === c2.toLowerCase();

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (eq(a[i - 1], b[j - 1])) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const matchedA = new Array(m).fill(false);
    const matchedB = new Array(n).fill(false);
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (eq(a[i - 1], b[j - 1])) {
        matchedA[i - 1] = true;
        matchedB[j - 1] = true;
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    const lcsLen = dp[m][n];
    const maxLen = Math.max(m, n, 1);
    const accuracy = m === 0 ? 0 : Math.round((lcsLen / maxLen) * 100);
    const isExact = m > 0 && typed.toLowerCase() === expected.toLowerCase();

    return {
      accuracy: isExact ? 100 : accuracy,
      isExact,
      typedTokens: a.map((ch, idx) => ({
        char: ch,
        status: (matchedA[idx] ? 'match' : 'wrong') as 'match' | 'wrong',
      })),
      expectedTokens: b.map((ch, idx) => ({
        char: ch,
        status: (matchedB[idx] ? 'match' : 'missing') as 'match' | 'missing',
      })),
    };
  }, [typeAnswerInput, expectedTypeTarget]);

  // ============== SESSION COMPLETE CELEBRATION SCREEN (Light & Dark Adapted) ==============
  if (isSessionComplete || !currentCard) {
    return (
      <div className={`fixed inset-0 z-30 flex flex-col justify-between select-none overflow-hidden ${screenBg}`}>
        <div className="w-full h-[2px] bg-[var(--status-success)]" />

        <header
          className={`h-16 ${
            isMac ? 'pl-[82px] pr-7' : 'px-7'
          } flex items-center justify-between border-b ${
            isDark ? 'border-white/[0.04]' : 'border-[#E5E5EA]'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => appActions.exitReview()}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer ${headerBtnSurface}`}
            >
              ‹
            </button>
            <div>
              <div className="text-[14px] font-semibold">{t('reviewCompletedTitle')}</div>
              <div className="text-[11px] text-[#8E8E93] mt-0.5">{t('reviewCompletedSub')}</div>
            </div>
          </div>

          <button
            onClick={() => appActions.undoLastReview()}
            className={`h-8 px-3 rounded-lg border text-[12px] cursor-pointer ${headerBtnSurface}`}
          >
            {t('undoLastBtn', { key: formatShortcut('Cmd Z', platform) })}
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className={`w-[540px] rounded-[24px] border p-9 text-center space-y-6 ${cardContainerSurface}`}>
            <div className="w-16 h-16 rounded-2xl bg-[var(--status-success-soft)] border border-[var(--status-success)]/30 text-[var(--status-success)] text-[28px] flex items-center justify-center mx-auto">
              ✓
            </div>

            <div>
              <h2 className="text-[26px] font-bold tracking-tight">
                {t('congratsTitle')}
              </h2>
              <p className="text-[13px] text-[#8E8E98] mt-1.5">{t('congratsSub')}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'bg-[#1A1B23] border-white/[0.06]' : 'bg-[#F8F8FA] border-[#ECECF2]'
                }`}
              >
                <div className="text-[22px] font-bold">
                  {sessionStudiedCount} {t('cardsUnit')}
                </div>
                <div className="text-[11px] text-[#8E8E93] mt-1">{t('sessionStudiedLabel')}</div>
              </div>
              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'bg-[#1A1B23] border-white/[0.06]' : 'bg-[#F8F8FA] border-[#ECECF2]'
                }`}
              >
                <div className="text-[22px] font-bold text-[var(--status-success)]">{accuracyPct}%</div>
                <div className="text-[11px] text-[#8E8E93] mt-1">{t('sessionAccuracyLabel')}</div>
              </div>
              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'bg-[#1A1B23] border-white/[0.06]' : 'bg-[#F8F8FA] border-[#ECECF2]'
                }`}
              >
                <div className="text-[22px] font-bold text-[var(--brand-text)]">
                  {avgSecDisplay} {resolvedLang === 'zh-CN' ? '秒' : 's'}
                </div>
                <div className="text-[11px] text-[#8E8E93] mt-1">{t('sessionAvgTimeLabel')}</div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-center gap-3">
              <button
                onClick={() => appActions.exitReview()}
                style={{ backgroundColor: brandHex }}
                className="px-6 py-2.5 rounded-xl text-white font-semibold text-[13px] hover:opacity-95 cursor-pointer"
              >
                {t('backToDashboard')}
              </button>
              <button
                onClick={() => appActions.startReview(activeDeckId || undefined, false, true)}
                className={`px-5 py-2.5 rounded-xl border font-medium text-[13px] cursor-pointer ${headerBtnSurface}`}
              >
                {t('enterPreviewMode')}
              </button>
            </div>
          </div>
        </div>

        <footer
          className={`h-11 px-7 border-t flex items-center justify-between text-[11px] text-[#8E8E93] ${
            isDark ? 'border-white/[0.04]' : 'border-[#E5E5EA]'
          }`}
        >
          <span>{resolvedLang === 'zh-CN' ? '今日记忆任务已同步完成' : 'Study progress synced'}</span>
          <span>
            {showShortcutHints ? `Esc · ${formatShortcut('Cmd Z', platform)}` : 'Esc'}
          </span>
        </footer>
      </div>
    );
  }

  const appendToActiveField = (snippet: string) => {
    setFieldsDraft((prev) => {
      const curr = (prev[activeFieldKey] || '').replace(/\/$/, '');
      return {
        ...prev,
        [activeFieldKey]: `${curr}${curr ? ' ' : ''}${snippet}`,
      };
    });
    setAppState({ slashMenuOpen: false });
  };

  const slashItems = [
    {
      id: 'bold',
      icon: 'B',
      label: resolvedLang === 'zh-CN' ? '加粗' : 'Bold',
      action: () => appendToActiveField('<b>重点内容</b>'),
    },
    {
      id: 'code',
      icon: '<>',
      label: resolvedLang === 'zh-CN' ? '语法高亮代码块' : 'Code Block',
      action: () => appendToActiveField('<code>code</code>'),
    },
    {
      id: 'latex',
      icon: '∑',
      label: resolvedLang === 'zh-CN' ? 'LaTeX 公式' : 'LaTeX Formula',
      action: () => appendToActiveField('\\( E = mc^2 \\)'),
    },
    {
      id: 'cloze',
      icon: '[]',
      label: resolvedLang === 'zh-CN' ? '一键挖空' : 'Cloze Deletion',
      action: () => appendToActiveField('{{c1::...}}'),
    },
  ];

  const orderedFieldKeys =
    currentCard.fieldOrder && currentCard.fieldOrder.length > 0
      ? currentCard.fieldOrder
      : Object.keys(fieldsDraft);

  const activeFlagNum = ((currentCard.flags || 0) & 7) as CardFlagColor;
  const activeFlagSpec = activeFlagNum !== 0 ? ANKI_FLAG_PALETTE[activeFlagNum] : null;

  return (
    <div className={`fixed inset-0 z-30 flex flex-col select-none overflow-hidden transition-colors ${screenBg}`}>
      {/* Ultra-thin Top Progress Bar */}
      <div className={`w-full h-[2px] ${isDark ? 'bg-[#1C1D24]' : 'bg-[#E5E5EA]'}`}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progressPct}%`, backgroundColor: brandHex }}
        />
      </div>

      {/* Top Header Bar */}
      <header
        className={`h-16 ${
          isMac ? 'pl-[82px] pr-7' : 'px-7'
        } flex items-center justify-between border-b ${
          isDark ? 'border-white/[0.04]' : 'border-[#E5E5EA]'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => {
              if (inlineEditing) {
                setFieldsDraft({ ...originalFieldsDraft });
                appActions.exitInlineEdit();
              } else {
                appActions.exitReview();
              }
            }}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${headerBtnSurface}`}
          >
            ‹
          </button>
          <div>
            <div className="text-[14px] font-semibold tracking-tight flex items-center gap-2">
              <span>{inlineEditing ? t('editCardTitle') : currentCard.deckName}</span>
              {currentCard.isCloze && (
                <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[10px] font-medium">
                  {t('clozeBadge')}
                </span>
              )}
              {isPreviewSession && (
                <span className="px-2 py-0.5 rounded bg-[var(--status-warning-soft)] text-[var(--status-warning)] text-[10px] font-medium">
                  {t('previewModeBadge')}
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#8E8E93] mt-0.5">
              {inlineEditing
                ? `${currentCard.deckName} · ${currentCard.noteTypeName || 'Basic'}`
                : `${currentNumber} / ${totalSessionCards}`}
            </div>
          </div>
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-2.5">
          {inlineEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFieldsDraft({ ...originalFieldsDraft });
                  appActions.exitInlineEdit();
                }}
                className={`h-8 px-3.5 rounded-xl border text-[12px] font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'border-[#3A3A46] text-[#A0A0AB] hover:text-white hover:bg-white/5'
                    : 'border-[#E5E5EA] text-[#6E6E73] hover:text-black hover:bg-black/5'
                }`}
              >
                {resolvedLang === 'zh-CN' ? '取消' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => {
                  commitInlineChanges();
                  appActions.exitInlineEdit();
                }}
                style={{ backgroundColor: brandHex }}
                className={`h-8 px-4 rounded-xl text-[12px] font-semibold text-white shadow-xs transition-all cursor-pointer ${
                  hasDraftChanges
                    ? 'hover:opacity-95 active:scale-[0.98]'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                {resolvedLang === 'zh-CN' ? '保存' : 'Save'}
              </button>
            </div>
          ) : (
            <>
              {currentCard.audioFiles && currentCard.audioFiles.length > 0 && (
                <button
                  onClick={() => appActions.playAudio(currentCard.audioFiles?.[0])}
                  title="R"
                  className={`h-8 px-3 rounded-lg border text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors ${
                    playingAudioFile
                      ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                      : headerBtnSurface
                  }`}
                >
                  <svg className="w-3.5 h-3.5 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  <span>{t('readAloud')}</span>
                  {showShortcutHints && <kbd className="text-[10px] opacity-70 font-mono">R</kbd>}
                </button>
              )}

              {/* Milestone 3: Type-in-the-Answer (默写检验) Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  const next = !typeAnswerEnabled;
                  setTypeAnswerEnabled(next);
                  if (next && !isCardFlipped) {
                    setTimeout(() => typeAnswerInputRef.current?.focus(), 60);
                  }
                }}
                title={
                  isZh
                    ? '切换「拼写默写检验 (Type in the Answer)」模式：正面输入答案，翻面逐字比对差异'
                    : 'Toggle Type-in-the-Answer spelling check mode'
                }
                className={`h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                  typeAnswerEnabled
                    ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                    : headerBtnSurface
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
                </svg>
                <span>{isZh ? '默写' : 'Type'}</span>
              </button>

              {/* 7-Color Flag Quick Picker Button & Popover */}
              <div ref={flagMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setFlagPopoverOpen((prev) => !prev)}
                  title={
                    isZh
                      ? `卡片旗标 (${formatShortcut('Cmd 1-7', platform)})`
                      : `Card Flag (${formatShortcut('Cmd 1-7', platform)})`
                  }
                  style={
                    activeFlagSpec
                      ? {
                          backgroundColor: activeFlagSpec.bgSoft,
                          borderColor: activeFlagSpec.borderHex,
                          color: activeFlagSpec.hex,
                        }
                      : undefined
                  }
                  className={`h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                    activeFlagSpec ? '' : headerBtnSurface
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill={activeFlagSpec ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  {activeFlagSpec && (
                    <span>{isZh ? activeFlagSpec.shortZh : activeFlagSpec.shortEn}</span>
                  )}
                </button>

                {flagPopoverOpen && (
                  <div
                    className={`absolute right-0 top-10 z-50 w-[210px] rounded-2xl border shadow-2xl p-2 space-y-0.5 backdrop-blur-xl ${
                      isDark
                        ? 'bg-[#181922]/96 border-[#2E303E] text-white'
                        : 'bg-white/96 border-[#E5E5EA] text-[#1D1D1F]'
                    }`}
                  >
                    <div className="px-2.5 py-1 text-[10px] text-[#8E8E93] flex items-center justify-between">
                      <span>{isZh ? '7 色旗标标记' : '7-Color Flags'}</span>
                      <span className="font-mono">{formatShortcut('Cmd 1-7', platform)}</span>
                    </div>
                    {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
                      const spec = ANKI_FLAG_PALETTE[fNum];
                      const isSel = activeFlagNum === fNum;
                      return (
                        <button
                          key={fNum}
                          type="button"
                          onClick={() => {
                            appActions.setCurrentReviewCardFlag(fNum, true);
                            setFlagPopoverOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-black/5 dark:bg-white/10 font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: spec.hex }}
                            />
                            <span>{isZh ? spec.labelZh : spec.labelEn}</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#8E8E93]">
                            {isSel ? '✓' : fNum}
                          </span>
                        </button>
                      );
                    })}
                    {activeFlagNum > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          appActions.setCurrentReviewCardFlag(0, false);
                          setFlagPopoverOpen(false);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl text-[11px] text-[#8E8E93] hover:text-[var(--status-danger)] flex items-center justify-between cursor-pointer border-t border-black/5 dark:border-white/5 mt-1 pt-1.5"
                      >
                        <span>{isZh ? '清除旗标' : 'Clear Flag'}</span>
                        <span className="font-mono text-[10px]">0</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (currentCard) appActions.openCardEditor(currentCard);
                }}
                title="E"
                className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${headerBtnSurface}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>

              <button
                onClick={() => setAppState((prev) => ({ inspectorOpen: !prev.inspectorOpen }))}
                title={formatShortcut('Cmd I', platform)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                  inspectorOpen
                    ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                    : headerBtnSurface
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {/* Scrollable Center Pane for Flashcard */}
        <div
          className={`flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center transition-all duration-300 ${
            inspectorOpen ? '-translate-x-28' : ''
          }`}
        >
          <div className="my-auto flex flex-col items-center w-full max-w-[580px]">
            {/* Floating Zen Flashcard — Strict Light/Dark Adaptation */}
            <div
              onDoubleClick={() => {
                if (currentCard) appActions.openCardEditor(currentCard);
              }}
              className={`w-full rounded-[22px] border p-7 sm:p-8 relative transition-all shadow-sm ${cardContainerSurface}`}
            >
            {inlineEditing ? (
              <div className="space-y-4">
                {orderedFieldKeys.map((fieldKey, idx) => {
                  const isFocused = fieldKey === activeFieldKey;
                  const val = fieldsDraft[fieldKey] ?? '';
                  const isPrimaryFront = idx === 0 && !isFocused;

                  if (isFocused) {
                    return (
                      <div
                        key={fieldKey}
                        className="rounded-xl border-2 border-[var(--brand)] bg-[var(--brand-surface)] p-4 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-[var(--brand-text)]">
                            {t('editingFieldTag', { field: fieldKey })}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => appendToActiveField('{{c1::...}}')}
                              className="text-[11px] text-[var(--brand-text)] hover:underline cursor-pointer"
                            >
                              {t('clozeShortcutBtn', {
                                key: formatShortcut('Cmd+Shift+C', platform),
                              })}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAppState((prev) => ({ slashMenuOpen: !prev.slashMenuOpen }))
                              }
                              className="text-[11px] text-[var(--brand-text)] hover:underline cursor-pointer"
                            >
                              {t('slashInsertBtn')}
                            </button>
                          </div>
                        </div>
                        <input
                          ref={activeInputRef}
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            setFieldsDraft((prev) => ({ ...prev, [fieldKey]: nextVal }));
                            if (nextVal.endsWith('/')) {
                              setAppState({ slashMenuOpen: true });
                            }
                          }}
                          className="w-full bg-transparent text-[16px] font-medium focus:outline-none"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={fieldKey}
                      onClick={() => setActiveFieldKey(fieldKey)}
                      className="cursor-text group"
                    >
                      <div className="text-[11px] text-[#8E8E93] mb-1 flex items-center justify-between">
                        <span>{fieldKey}</span>
                        <span className="text-[10px] opacity-0 group-hover:opacity-100 text-[var(--brand-text)]">
                          {t('clickToEdit')}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={val}
                        onFocus={() => setActiveFieldKey(fieldKey)}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setFieldsDraft((prev) => ({ ...prev, [fieldKey]: nextVal }));
                        }}
                        className={
                          isPrimaryFront
                            ? 'w-full bg-transparent text-[26px] font-bold tracking-tight focus:outline-none'
                            : 'w-full bg-transparent text-[13px] opacity-85 focus:outline-none border-b border-transparent hover:border-[#8E8E93]/30 pb-1'
                        }
                      />
                    </div>
                  );
                })}

                <div
                  className={`pt-3 border-t flex items-center justify-between text-[11px] text-[#8E8E93] ${
                    isDark ? 'border-white/[0.06]' : 'border-[#ECECF2]'
                  }`}
                >
                  <span className={hasDraftChanges ? 'text-[var(--status-warning)] font-medium' : ''}>
                    {hasDraftChanges
                      ? (resolvedLang === 'zh-CN' ? '● 有未保存修改' : '● Unsaved changes')
                      : (resolvedLang === 'zh-CN' ? '未修改' : 'Unchanged')}
                  </span>
                  <span>{formatShortcut('Cmd Enter', platform)} 保存 · Esc 取消</span>
                </div>

                {slashMenuOpen && (
                  <div
                    className={`absolute left-20 -bottom-44 w-[240px] rounded-2xl border shadow-2xl p-2 z-40 ${
                      isDark
                        ? 'bg-[#1C1D24] border-white/[0.1] text-white'
                        : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'
                    }`}
                  >
                    <div className="space-y-0.5 mt-0.5">
                      {slashItems.map((item, idx) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setSelectedSlashIdx(idx)}
                          onClick={item.action}
                          className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center gap-3 cursor-pointer transition-colors ${
                            idx === selectedSlashIdx
                              ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-medium'
                              : 'hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <span className="w-5 text-center font-mono text-[11px] text-[var(--brand-text)]">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Top Card Meta */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium ${
                        isCardFlipped
                          ? 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                          : 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                      }`}
                    >
                      {isCardFlipped ? t('answerSideBadge') : t('questionSideBadge')}
                    </span>

                    {activeFlagSpec && (
                      <button
                        type="button"
                        onClick={() => appActions.setCurrentReviewCardFlag(0, false)}
                        title={isZh ? '点击清除旗标' : 'Click to clear flag'}
                        style={{
                          backgroundColor: activeFlagSpec.bgSoft,
                          borderColor: activeFlagSpec.borderHex,
                          color: activeFlagSpec.hex,
                        }}
                        className="px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: activeFlagSpec.hex }}
                        />
                        <span>{isZh ? activeFlagSpec.shortZh : activeFlagSpec.shortEn}</span>
                      </button>
                    )}

                    {currentCard.audioFiles &&
                      currentCard.audioFiles.map((audioFile) => (
                        <button
                          key={audioFile}
                          onClick={(e) => {
                            e.stopPropagation();
                            appActions.playAudio(audioFile);
                          }}
                          className={`px-2.5 py-0.5 rounded-md text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors ${
                            playingAudioFile === audioFile
                              ? 'bg-[var(--brand)] text-white'
                              : isDark
                              ? 'bg-white/[0.06] text-[#C8C8D2] hover:bg-white/[0.12]'
                              : 'bg-[#F2F2F7] text-[#3A3A3C] hover:bg-[#E5E5EA]'
                          }`}
                        >
                          <svg className="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          <span>{t('pronounceBtn')}</span>
                        </button>
                      ))}
                  </div>

                  <span className="text-[11px] text-[#8E8E93]">
                    {t('fsrsPredictHeader', {
                      ivl: (currentCard.predictions?.good || '').replace('后', ''),
                    })}
                  </span>
                </div>

                {/* Headword & Reading */}
                {(() => {
                  const frontHtmlContent = isCardFlipped
                    ? currentCard.frontAnswerHtml || currentCard.frontHtml || currentCard.front
                    : currentCard.frontHtml || currentCard.front;
                  const frontCleanText = (frontHtmlContent || '').replace(/<[^>]*>/g, '').trim();
                  const frontTextLen = frontCleanText.length;
                  const frontTypographyClass =
                    frontTextLen > 80
                      ? 'text-[17px] font-semibold leading-relaxed tracking-normal'
                      : frontTextLen > 35
                      ? 'text-[22px] font-bold leading-snug tracking-tight'
                      : 'text-[30px] font-bold leading-tight tracking-tight';

                  return (
                    <div className="mb-6 select-text cursor-text">
                      <div
                        className={`${frontTypographyClass} whitespace-pre-wrap break-words [&_img]:max-h-64 [&_img]:rounded-xl [&_img]:my-2 [&_.anki-io-wrap_img]:!my-0 [&_.anki-io-wrap_img]:!max-h-80`}
                        dangerouslySetInnerHTML={{
                          __html: renderMathAndRichHtml(frontHtmlContent, !isCardFlipped),
                        }}
                      />
                      {currentCard.reading && (
                        <p className="text-[13px] text-[#8E8E98] mt-1.5">{currentCard.reading}</p>
                      )}
                    </div>
                  );
                })()}

                {isCardFlipped ? (
                  <>
                    <div
                      className={`h-[1px] my-5 ${
                        isDark ? 'bg-white/[0.07]' : 'bg-[#ECECF2]'
                      }`}
                    />

                    {/* Milestone 3: Type-in-the-Answer Character-by-Character Diff Result */}
                    {(typeAnswerEnabled || typeAnswerInput.trim().length > 0) && expectedTypeTarget && (
                      <div
                        className={`mb-5 p-3.5 rounded-2xl border space-y-2 ${
                          typeAnswerDiff.isExact
                            ? 'bg-emerald-500/[0.08] border-emerald-500/30'
                            : typeAnswerInput.trim().length === 0
                            ? isDark
                              ? 'bg-[#1C1E26] border-[#2A2C38]'
                              : 'bg-[#F7F8FA] border-[#E5E5EA]'
                            : 'bg-amber-500/[0.08] border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold flex items-center gap-1.5">
                            <span>{isZh ? '⌨️ 拼写默写核对' : '⌨️ Type-in-the-Answer Check'}</span>
                            {typeAnswerInput.trim().length > 0 && (
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                  typeAnswerDiff.isExact
                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                    : typeAnswerDiff.accuracy >= 60
                                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                    : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {typeAnswerDiff.isExact
                                  ? isZh
                                    ? '✓ 100% 完全匹配'
                                    : '✓ 100% Exact Match'
                                  : isZh
                                  ? `匹配度 ${typeAnswerDiff.accuracy}%`
                                  : `Match ${typeAnswerDiff.accuracy}%`}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-[#8E8E93]">
                            {isZh ? '绿=正确 · 红=多写/错字 · 黄=漏写' : 'Green=Match · Red=Wrong · Amber=Missing'}
                          </span>
                        </div>

                        {/* User's Typed Line */}
                        <div className="flex items-baseline gap-2 text-[13px] font-mono break-all">
                          <span className="text-[11px] font-sans text-[#8E8E93] shrink-0 w-14">
                            {isZh ? '你的输入' : 'Typed'}
                          </span>
                          {typeAnswerInput.trim().length === 0 ? (
                            <span className="text-[12px] italic text-[#8E8E93] font-sans">
                              {isZh ? '（未输入内容）' : '(No answer typed)'}
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-[1px]">
                              {typeAnswerDiff.typedTokens.map((tk, idx) => (
                                <span
                                  key={idx}
                                  className={
                                    tk.status === 'match'
                                      ? 'px-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                                      : 'px-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 line-through'
                                  }
                                >
                                  {tk.char === ' ' ? '\u00A0' : tk.char}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Expected Target Line (shown when not exact match) */}
                        {!typeAnswerDiff.isExact && (
                          <div className="flex items-baseline gap-2 text-[13px] font-mono break-all pt-1 border-t border-black/5 dark:border-white/5">
                            <span className="text-[11px] font-sans text-[#8E8E93] shrink-0 w-14">
                              {isZh ? '标准答案' : 'Target'}
                            </span>
                            <div className="flex flex-wrap gap-[1px]">
                              {typeAnswerDiff.expectedTokens.map((tk, idx) => (
                                <span
                                  key={idx}
                                  className={
                                    tk.status === 'match'
                                      ? 'px-0.5 rounded text-emerald-700 dark:text-emerald-300'
                                      : 'px-0.5 rounded bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold underline'
                                  }
                                >
                                  {tk.char === ' ' ? '\u00A0' : tk.char}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meaning */}
                    <div
                      className={`text-[17px] font-medium leading-relaxed select-text cursor-text whitespace-pre-wrap break-words [&_img]:max-h-60 [&_img]:rounded-xl [&_img]:my-3 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[14px] ${
                        isDark
                          ? 'text-[#EFEFF5] [&_code]:bg-white/10'
                          : 'text-[#1D1D1F] [&_code]:bg-[#F2F2F7]'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: renderMathAndRichHtml(currentCard.backHtml || currentCard.meaning),
                      }}
                    />

                    {/* Progressive Hints */}
                    <div className="mt-5 space-y-2.5">
                      {currentCard.etymology && (
                        <div className="flex items-center gap-2.5 text-[13px]">
                          <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-medium shrink-0">
                            {t('etymologyBadge')}
                          </span>
                          <span
                            className={isDark ? 'text-[#C8C8D2]' : 'text-[#4A4A52]'}
                            dangerouslySetInnerHTML={{
                              __html: renderMathAndRichHtml(currentCard.etymology),
                            }}
                          />
                        </div>
                      )}

                      {revealedHintsCount >= 2 && currentCard.example && (
                        <div className="flex items-center gap-2.5 text-[13px]">
                          <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-medium shrink-0">
                            {t('exampleBadge')}
                          </span>
                          <span
                            className={isDark ? 'text-[#C8C8D2]' : 'text-[#4A4A52]'}
                            dangerouslySetInnerHTML={{
                              __html: renderMathAndRichHtml(currentCard.example),
                            }}
                          />
                        </div>
                      )}

                      {revealedHintsCount >= 3 && currentCard.extraHint ? (
                        <div className="flex items-center gap-2.5 text-[13px]">
                          <span className="px-2 py-0.5 rounded bg-[var(--status-success-soft)] text-[var(--status-success)] text-[11px] font-medium shrink-0">
                            {t('collocationBadge')}
                          </span>
                          <span
                            className={isDark ? 'text-[#C8C8D2]' : 'text-[#4A4A52]'}
                            dangerouslySetInnerHTML={{
                              __html: renderMathAndRichHtml(currentCard.extraHint),
                            }}
                          />
                        </div>
                      ) : currentCard.extraHint ? (
                        <button
                          onClick={() => appActions.revealNextHint()}
                          className="text-[12px] text-[#8E8E93] hover:text-[var(--brand-text)] transition-colors cursor-pointer pt-1 block"
                        >
                          {t('tabRevealHint')}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div
                    className={`py-7 flex flex-col items-center justify-center border-t mt-4 gap-3.5 ${
                      isDark ? 'border-white/[0.05]' : 'border-[#ECECF2]'
                    }`}
                  >
                    {typeAnswerEnabled ? (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-[#8E8E93]">
                          <span className="font-medium text-[var(--brand-text)]">
                            {isZh ? '⌨️ 拼写默写检验（Type in the Answer）' : '⌨️ Type in the Answer'}
                          </span>
                          <span>{isZh ? '按 Enter 提交并翻开核对' : 'Press Enter to check'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            ref={typeAnswerInputRef}
                            type="text"
                            value={typeAnswerInput}
                            onChange={(e) => setTypeAnswerInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                appActions.flipCard();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setTypeAnswerEnabled(false);
                              }
                            }}
                            placeholder={
                              isZh
                                ? '在此输入你默写的答案（支持英文拼写 / 填空词条）...'
                                : 'Type your answer here...'
                            }
                            autoFocus
                            className={`flex-1 h-10 px-3.5 rounded-xl border text-[14px] font-medium focus:outline-none focus:border-[var(--brand)] transition-colors ${
                              isDark
                                ? 'bg-[#1E202B] border-[#323546] text-white placeholder-[#6E7080]'
                                : 'bg-[#F8F9FB] border-[#DCDCE4] text-[#1D1D1F] placeholder-[#8E8E98]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => appActions.flipCard()}
                            style={{ backgroundColor: brandHex }}
                            className="h-10 px-4 rounded-xl text-white text-[12px] font-semibold cursor-pointer hover:opacity-95 shrink-0"
                          >
                            {isZh ? '核对 ↵' : 'Check ↵'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13px] text-[#8E8E93]">{t('recallPrompt')}</p>
                    )}
                  </div>
                )}

                {/* Bottom Card Tags & Review Count — Smart Collapsed */}
                {(currentCard.tags.length > 0 || currentCard.reps > 0) && (
                  <div className="mt-6 pt-3.5 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between gap-2 text-[11px] text-[#8E8E93]">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {currentCard.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 rounded-md text-[10px] truncate max-w-[120px] ${
                            isDark
                              ? 'bg-white/[0.06] text-[#8E8E98]'
                              : 'bg-[#F2F2F7] text-[#6E6E73]'
                          }`}
                        >
                          #{tag}
                        </span>
                      ))}
                      {currentCard.tags.length > 2 && (
                        <span
                          title={currentCard.tags.slice(2).map((t) => `#${t}`).join(', ')}
                          className={`px-1.5 py-0.5 rounded-md text-[10px] cursor-help ${
                            isDark
                              ? 'bg-white/[0.04] text-[#7E7E86]'
                              : 'bg-[#ECECF2] text-[#8E8E93]'
                          }`}
                        >
                          +{currentCard.tags.length - 2}
                        </span>
                      )}
                    </div>
                    {currentCard.reps > 0 && (
                      <span className="text-[11px] text-[#8E8E93] shrink-0 ml-auto font-mono">
                        {t('reviewedCountText', {
                          reps: currentCard.reps,
                          last: currentCard.lastReviewText,
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Ergonomic Decision Bar at the Bottom — Always Visible & Accessible */}
      {!inlineEditing && (
        <footer
          className={`shrink-0 pb-6 pt-3 px-6 flex flex-col items-center justify-center border-t border-black/[0.04] dark:border-white/[0.04] transition-all duration-300 z-10 ${
            isDark ? 'bg-[#0E0F14]/92' : 'bg-[#F8F8FA]/92'
          } backdrop-blur-md ${inspectorOpen ? '-translate-x-28' : ''}`}
        >
          <div className="w-[560px] max-w-full h-[58px]">
            {!isCardFlipped ? (
              /* Unflipped: Full 560px width so clicking center or center-right lands directly on "Good" after flip! */
              <button
                onClick={() => appActions.flipCard()}
                style={{ backgroundColor: brandHex }}
                className={`w-[560px] h-[58px] px-6 rounded-2xl hover:opacity-95 text-white font-semibold text-[15px] shadow-xl flex items-center ${
                  showShortcutHints ? 'justify-between' : 'justify-center'
                } cursor-pointer transition-all active:scale-[0.99]`}
              >
                <span>{t('showAnswerBtn')}</span>
                {showShortcutHints && (
                  <kbd className="px-2.5 py-1 rounded-lg bg-white/20 text-[12px] font-mono">
                    Space / Enter
                  </kbd>
                )}
              </button>
            ) : optionKeyHeld ? (
              /* 4-Level FSRS Mode: 560px 4-column grid */
              <div className="grid grid-cols-4 gap-3 w-[560px] h-[58px]">
                <button
                  onClick={() => appActions.answerCurrentCard(1)}
                  className={`h-[58px] px-4 rounded-2xl border flex items-center ${
                    showShortcutHints ? 'justify-between' : 'justify-center text-center'
                  } cursor-pointer transition-all bg-[var(--status-danger-soft)] border-[var(--status-danger)]/35 hover:border-[var(--status-danger)] text-[var(--status-danger)]`}
                >
                  <div className={showShortcutHints ? 'text-left' : 'text-center'}>
                    <div className="text-[13px] font-semibold">{t('rateAgain')}</div>
                    <div className="text-[11px] opacity-75">
                      {currentCard.predictions.again}
                    </div>
                  </div>
                  {showShortcutHints && (
                    <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-black/30 text-[11px] font-mono">
                      1
                    </kbd>
                  )}
                </button>

                <button
                  onClick={() => appActions.answerCurrentCard(2)}
                  className={`h-[58px] px-4 rounded-2xl border flex items-center ${
                    showShortcutHints ? 'justify-between' : 'justify-center text-center'
                  } cursor-pointer transition-all bg-[var(--status-warning-soft)] border-[var(--status-warning)]/35 hover:border-[var(--status-warning)] text-[var(--status-warning)]`}
                >
                  <div className={showShortcutHints ? 'text-left' : 'text-center'}>
                    <div className="text-[13px] font-semibold">{t('rateHard')}</div>
                    <div className="text-[11px] opacity-75">
                      {currentCard.predictions.hard}
                    </div>
                  </div>
                  {showShortcutHints && (
                    <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-black/30 text-[11px] font-mono">
                      2
                    </kbd>
                  )}
                </button>

                <button
                  onClick={() => appActions.answerCurrentCard(3)}
                  className={`h-[58px] px-4 rounded-2xl border flex items-center ${
                    showShortcutHints ? 'justify-between' : 'justify-center text-center'
                  } cursor-pointer transition-all bg-[var(--status-success-soft)] border-[var(--status-success)]/35 hover:border-[var(--status-success)] text-[var(--status-success)]`}
                >
                  <div className={showShortcutHints ? 'text-left' : 'text-center'}>
                    <div className="text-[13px] font-semibold">{t('rateGood')}</div>
                    <div className="text-[11px] opacity-75">
                      {currentCard.predictions.good}
                    </div>
                  </div>
                  {showShortcutHints && (
                    <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-black/30 text-[11px] font-mono">
                      3
                    </kbd>
                  )}
                </button>

                <button
                  onClick={() => appActions.answerCurrentCard(4)}
                  className={`h-[58px] px-4 rounded-2xl border flex items-center ${
                    showShortcutHints ? 'justify-between' : 'justify-center text-center'
                  } cursor-pointer transition-all bg-[var(--status-info-soft)] border-[var(--status-info)]/35 hover:border-[var(--status-info)] text-[var(--status-info)]`}
                >
                  <div className={showShortcutHints ? 'text-left' : 'text-center'}>
                    <div className="text-[13px] font-semibold">{t('rateEasy')}</div>
                    <div className="text-[11px] opacity-75">
                      {currentCard.predictions.easy}
                    </div>
                  </div>
                  {showShortcutHints && (
                    <kbd className="px-2 py-0.5 rounded bg-black/10 dark:bg-black/30 text-[11px] font-mono">
                      4
                    </kbd>
                  )}
                </button>
              </div>
            ) : (
              /* Item #5: Asymmetric Ergonomic Binary Mode (`w-[170px]` Again + `w-[374px]` Good = 560px with 16px gap) */
              <div className="w-[560px] h-[58px] flex items-center gap-4">
                <button
                  onClick={() => appActions.answerCurrentCard(1)}
                  className={`w-[170px] h-[58px] px-5 rounded-2xl border flex items-center ${
                    showShortcutHints ? 'justify-between' : 'justify-center text-center'
                  } cursor-pointer transition-all active:scale-[0.98] bg-[var(--status-danger-soft)] border-[var(--status-danger)]/35 hover:border-[var(--status-danger)] text-[var(--status-danger)]`}
                >
                  <div className={showShortcutHints ? 'text-left' : 'text-center'}>
                    <div className="text-[14px] font-semibold">{t('rateAgain')}</div>
                    <div className="text-[11px] opacity-75 mt-0.5">
                      {currentCard.predictions.again}
                    </div>
                  </div>
                  {showShortcutHints && (
                    <kbd className="w-6 h-6 rounded-md bg-black/10 dark:bg-white/[0.06] flex items-center justify-center text-[11px] font-mono">
                      1
                    </kbd>
                  )}
                </button>

                <button
                  onClick={() => appActions.answerCurrentCard(3)}
                  className={`w-[374px] h-[58px] px-6 rounded-2xl border flex items-center ${
                    showShortcutHints ? 'justify-between' : 'justify-center text-center'
                  } cursor-pointer transition-all active:scale-[0.98] bg-[var(--brand-soft)] border-[var(--brand-border)] hover:border-[var(--brand)] text-[var(--brand-text)]`}
                >
                  <div className={showShortcutHints ? 'text-left' : 'text-center'}>
                    <div className="text-[15px] font-bold">{t('rateGood')}</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {currentCard.predictions.good}
                    </div>
                  </div>
                  {showShortcutHints && (
                    <kbd className="px-2.5 h-6 rounded-md bg-black/10 dark:bg-white/[0.08] flex items-center justify-center text-[11px] font-mono">
                      2 / Enter
                    </kbd>
                  )}
                </button>
              </div>
            )}
          </div>

          {showShortcutHints && (
            <button
              type="button"
              onClick={() => setAppState((prev) => ({ optionKeyHeld: !prev.optionKeyHeld }))}
              className="mt-3.5 text-[11px] text-[#8E8E93] hover:text-[var(--brand-text)] cursor-pointer"
            >
              {formatShortcut(
                isCardFlipped
                  ? '按住 Option 展开四档评分 (1重来 / 2困难 / 3记得 / 4简单) · Cmd+1~7 标记旗标 · Cmd Z 撤销'
                  : 'Space / Enter 翻开答案 · Cmd+1~7 标记旗标 · R 音频 · Cmd Z 撤销',
                platform
              )}
            </button>
          )}
        </footer>
      )}

        {/* RIGHT INSPECTOR DRAWER (Light & Dark Adapted) */}
        {inspectorOpen && (
          <aside className={`absolute right-0 top-0 bottom-0 w-[300px] backdrop-blur-xl border-l p-6 flex flex-col justify-between z-40 ${inspectorSurface}`}>
            <div className="space-y-5 overflow-y-auto pr-0.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold">{t('cardInfoTitle')}</h3>
                <button
                  onClick={() => setAppState({ inspectorOpen: false })}
                  className="text-[#8E8E93] hover:text-[var(--brand-text)] text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 7-Color Flag Picker inside Inspector */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#8E8E93] mb-2">
                  <span>{isZh ? '7 色旗标' : 'Card Flag'}</span>
                  <span className="font-mono text-[10px]">
                    {activeFlagSpec
                      ? isZh
                        ? activeFlagSpec.labelZh
                        : activeFlagSpec.labelEn
                      : formatShortcut('Cmd 1-7', platform)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
                    const spec = ANKI_FLAG_PALETTE[fNum];
                    const isSel = activeFlagNum === fNum;
                    return (
                      <button
                        key={fNum}
                        type="button"
                        onClick={() => appActions.setCurrentReviewCardFlag(fNum, true)}
                        title={`${isZh ? spec.labelZh : spec.labelEn} (${formatShortcut(`Cmd+${fNum}`, platform)})`}
                        className={`w-7 h-7 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                          isSel
                            ? 'scale-110 ring-2 ring-offset-1 dark:ring-offset-[#121318]'
                            : 'opacity-75 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: spec.bgSoft,
                          borderColor: isSel ? spec.hex : spec.borderHex,
                        }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: spec.hex }}
                        />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => appActions.setCurrentReviewCardFlag(0, false)}
                    title={isZh ? '清除旗标 (Cmd+0)' : 'Clear Flag (Cmd+0)'}
                    className={`w-7 h-7 rounded-xl border text-[11px] flex items-center justify-center cursor-pointer transition-colors ${
                      activeFlagNum === 0
                        ? 'opacity-40'
                        : 'text-[#8E8E93] hover:text-[var(--status-danger)] border-black/10 dark:border-white/10'
                    }`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Deck Selector */}
              <div>
                <div className="text-[11px] text-[#8E8E93] mb-2">{t('deckLabel')}</div>
                <select
                  value={currentCard.deckId}
                  onChange={(e) => {
                    const found = decks.find((d) => d.id === e.target.value);
                    appActions.saveInlineCardUpdate({
                      deckId: e.target.value,
                      deckName: found ? found.name : currentCard.deckName,
                    });
                  }}
                  className={`w-full h-9 px-3 rounded-xl border text-[12px] focus:outline-none focus:border-[var(--brand)] ${
                    isDark
                      ? 'bg-[#1A1B22] border-white/[0.08] text-white'
                      : 'bg-[#F8F8FA] border-[#E5E5EA] text-[#1D1D1F]'
                  }`}
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName || d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags Manager */}
              <div>
                <div className="text-[11px] text-[#8E8E93] mb-2">{t('tagsLabel')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {currentCard.tags.map((tag) => (
                    <span
                      key={tag}
                      onClick={() =>
                        appActions.saveInlineCardUpdate({
                          tags: currentCard.tags.filter((tItem) => tItem !== tag),
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] hover:bg-[var(--status-danger-soft)] hover:text-[var(--status-danger)] cursor-pointer transition-colors ${
                        isDark ? 'bg-[#1C1D26] text-[#C8C8D2]' : 'bg-[#F2F2F7] text-[#3A3A3C]'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}

                  {addingTag ? (
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTagInput.trim()) {
                          appActions.saveInlineCardUpdate({
                            tags: [...currentCard.tags, newTagInput.trim()],
                          });
                          setNewTagInput('');
                          setAddingTag(false);
                        } else if (e.key === 'Escape') {
                          setAddingTag(false);
                        }
                      }}
                      placeholder="..."
                      autoFocus
                      className="w-20 px-2 py-0.5 rounded-lg border border-[var(--brand)] text-[11px] bg-transparent focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setAddingTag(true)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-medium hover:bg-[var(--brand-soft-strong)] cursor-pointer"
                    >
                      {t('addTagBtn')}
                    </button>
                  )}
                </div>
              </div>

              {/* Review History Log */}
              <div>
                <div className="text-[11px] text-[#8E8E93] mb-2.5">{t('reviewHistoryLabel')}</div>
                <div className="space-y-2.5">
                  {currentCard.history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-[12px]">
                      <span className="text-[#8E8E98]">{h.date}</span>
                      <span className={h.remembered ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}>
                        {h.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`pt-3.5 border-t space-y-2.5 ${
                isDark ? 'border-white/[0.06]' : 'border-[#ECECF2]'
              }`}
            >
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => appActions.buryCurrentReviewCard()}
                  className={`h-8 rounded-xl border text-[11px] font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                    isDark
                      ? 'bg-[#1A1B22] border-white/[0.08] text-[#C8C8D2] hover:bg-white/10'
                      : 'bg-[#F8F8FA] border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#EFEFF4]'
                  }`}
                  title={isZh ? '搁置此卡片至明日复习' : 'Bury card until tomorrow'}
                >
                  {isZh ? '搁置卡片' : 'Bury'}
                </button>

                <button
                  type="button"
                  onClick={() => appActions.toggleSuspendCurrentReviewCard()}
                  className={`h-8 rounded-xl border text-[11px] font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                    isDark
                      ? 'bg-[#1A1B22] border-white/[0.08] text-[#C8C8D2] hover:bg-white/10'
                      : 'bg-[#F8F8FA] border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#EFEFF4]'
                  }`}
                  title={isZh ? '长期暂停此卡片，移出学习队列' : 'Suspend card indefinitely'}
                >
                  {currentCard.suspended ? t('unsuspendCardBtn') : t('suspendCardBtn')}
                </button>

                {confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                      appActions.deleteCurrentReviewCard();
                    }}
                    className="h-8 rounded-xl bg-[var(--status-danger)] text-white text-[11px] font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--status-danger)] focus-visible:outline-offset-2"
                    aria-label={isZh ? '确认删除卡片' : 'Confirm delete card'}
                  >
                    {t('confirm')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="h-8 rounded-xl border text-[11px] font-medium cursor-pointer bg-[var(--status-danger-soft)] border-[var(--status-danger)]/30 text-[var(--status-danger)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--status-danger)] focus-visible:outline-offset-2"
                  >
                    {t('deleteCardBtn')}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => appActions.triggerNativeEscape()}
                className={`w-full h-8 rounded-xl border text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isDark
                    ? 'border-white/[0.08] text-[#8E8E93] hover:text-white hover:bg-white/5'
                    : 'border-[#E5E5EA] text-[#6E6E73] hover:text-black hover:bg-black/5'
                }`}
              >
                <span>{t('switchToNative')}</span>
                {showShortcutHints && (
                  <kbd className="text-[10px] opacity-70 font-mono">
                    {formatShortcut('Ctrl Opt M', platform)}
                  </kbd>
                )}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Status Bar */}
      {!inlineEditing && (
        <footer
          className={`h-11 px-7 border-t flex items-center justify-between text-[11px] text-[#8E8E93] ${
            isDark ? 'border-white/[0.04]' : 'border-[#E5E5EA]'
          }`}
        >
          <span>
            {t('sessionStudiedLabel')}: {sessionStudiedCount}
          </span>
          <div className="flex items-center gap-4">
            {showShortcutHints && (
              <>
                <span>Space</span>
                <span>R</span>
                <span>Tab</span>
              </>
            )}
            <button
              onClick={() => setAppState((prev) => ({ inspectorOpen: !prev.inspectorOpen }))}
              className="hover:text-[var(--brand-text)] cursor-pointer"
            >
              {showShortcutHints ? `${formatShortcut('Cmd I', platform)} ` : ''}{t('cardInfoTitle')}
            </button>
          </div>
          <span>
            {t('sessionAccuracyLabel')}: {accuracyPct}%
          </span>
        </footer>
      )}
    </div>
  );
};
