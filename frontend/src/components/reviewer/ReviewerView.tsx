import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  const activeInputRef = useRef<HTMLInputElement>(null);

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
    if (currentCard) {
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

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

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
                        className={`${frontTypographyClass} whitespace-pre-wrap break-words [&_img]:max-h-52 [&_img]:rounded-xl [&_img]:my-2`}
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
                    className={`py-10 flex flex-col items-center justify-center border-t mt-4 ${
                      isDark ? 'border-white/[0.05]' : 'border-[#ECECF2]'
                    }`}
                  >
                    <p className="text-[13px] text-[#8E8E93]">{t('recallPrompt')}</p>
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
                      ? '按住 Option 展开四档评分 (1重来 / 2困难 / 3记得 / 4简单) · 原地连击即可流式完成复习 · Cmd Z 撤销'
                      : 'Space / Enter 翻开答案 · R 音频 · Cmd Z 撤销',
                    platform
                  )}
                </button>
              )}
            </footer>
          )}

        {/* RIGHT INSPECTOR DRAWER (Light & Dark Adapted) */}
        {inspectorOpen && (
          <aside className={`absolute right-0 top-0 bottom-0 w-[300px] backdrop-blur-xl border-l p-6 flex flex-col justify-between z-40 ${inspectorSurface}`}>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold">{t('cardInfoTitle')}</h3>
                <button
                  onClick={() => setAppState({ inspectorOpen: false })}
                  className="text-[#8E8E93] hover:text-[var(--brand-text)] text-sm cursor-pointer"
                >
                  ✕
                </button>
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
                  className={`h-8 rounded-xl border text-[11px] font-medium cursor-pointer transition-colors ${
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
                  className={`h-8 rounded-xl border text-[11px] font-medium cursor-pointer transition-colors ${
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
                    className="h-8 rounded-xl bg-[var(--status-danger)] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {t('confirm')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="h-8 rounded-xl border text-[11px] font-medium cursor-pointer bg-[var(--status-danger-soft)] border-[var(--status-danger)]/30 text-[var(--status-danger)] hover:opacity-90"
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
