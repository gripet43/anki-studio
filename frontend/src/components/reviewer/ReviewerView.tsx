import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANKI_FLAG_PALETTE,
  CardFlagColor,
  REVIEW_CONTENT_SCALES,
  ReviewContentScale,
  ReviewStageWidth,
} from '../../bridge/pycmd';
import { formatShortcut, translate } from '../../i18n/translations';
import {
  appActions,
  getAppState,
  setAppState,
  showToast,
  useAppStore,
} from '../../stores/useAppStore';
import { renderMathAndRichHtml } from '../../utils/mathRenderer';
import {
  cardDebugSnapshotFromReviewCard,
  collectAndCopyCardDebugInfo,
} from '../../utils/cardDebugInfo';
import { getClosestFromTarget, isTypingTarget } from '../../utils/domTarget';
import {
  resolveManualPlayAudioFiles,
  resolveVisibleAudioFiles,
} from '../../utils/reviewAudio';
import { getAccentScale } from '../../utils/themeTokens';
import { CopyDebugInfoButton } from '../common/CopyDebugInfoButton';
import { Tooltip } from '../common/Tooltip';
import { LightboxTarget, ReviewerImageLightbox } from './ReviewerImageLightbox';
import { SandboxCardFrame } from './SandboxCardFrame';

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
    answerButtonMode,
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
    reviewScopeDeckId,
    sandboxNoteTypeIds,
    autoPlayFrontAudio,
    autoPlayBackAudio,
    reviewStageWidth,
    reviewContentScale,
  } = useAppStore();

  const isDark = theme === 'dark' || theme === 'oled';
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
  const [displayPopoverOpen, setDisplayPopoverOpen] = useState(false);
  const [audioPopoverOpen, setAudioPopoverOpen] = useState(false);
  const [lightboxTarget, setLightboxTarget] = useState<LightboxTarget | null>(null);

  const activeInputRef = useRef<HTMLInputElement>(null);
  const flagMenuRef = useRef<HTMLDivElement>(null);
  const displayMenuRef = useRef<HTMLDivElement>(null);
  const audioMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (flagMenuRef.current && !flagMenuRef.current.contains(e.target as Node)) {
        setFlagPopoverOpen(false);
      }
      if (displayMenuRef.current && !displayMenuRef.current.contains(e.target as Node)) {
        setDisplayPopoverOpen(false);
      }
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setAudioPopoverOpen(false);
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
    setDisplayPopoverOpen(false);
    setAudioPopoverOpen(false);
    setLightboxTarget(null);
    if (currentCard) {
      const fMap: Record<string, string> =
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
      const meaningAliases = [
        '释义',
        '解释',
        '背面',
        'Back',
        'Meaning',
        'VocabDefSC',
        'Tiếng Việt',
        'English',
        'Explain1',
        'Back Extra',
      ];
      const preferredMeaningKey = keys.find(
        (k) => meaningAliases.includes(k) && (fMap[k] || '').trim()
      );
      if (editingField && editingField in fMap) {
        setActiveFieldKey(editingField);
      } else if (preferredMeaningKey) {
        setActiveFieldKey(preferredMeaningKey);
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
    const frontAliases = [
      '正面',
      'Front',
      'Text',
      'Word',
      'Expression',
      '单词',
      'VocabKanji',
      'Mặt trước',
      '中文',
    ];
    const meaningAliases = [
      '释义',
      '解释',
      '背面',
      'Back',
      'Meaning',
      'VocabDefSC',
      'Tiếng Việt',
      'English',
      'Explain1',
      'Back Extra',
    ];
    const frontKey =
      keys.find((k) => frontAliases.includes(k) && (finalFields[k] || '').trim()) ||
      keys.find((k) => frontAliases.includes(k)) ||
      keys[0] ||
      '正面';
    const meaningKey =
      keys.find(
        (k) => k !== frontKey && meaningAliases.includes(k) && (finalFields[k] || '').trim()
      ) ||
      keys.find((k) => k !== frontKey && meaningAliases.includes(k)) ||
      keys.find((k) => k !== frontKey) ||
      frontKey;
    const exampleKey = keys.find(
      (k) => k === '例句' || k === 'Example' || k === 'Example1' || k === 'SentKanji1'
    );
    const etymKey = keys.find((k) => k === '词源' || k === '字源' || k === 'Etymology');
    const readingKey = keys.find(
      (k) =>
        k === '读音' ||
        k === '音标' ||
        k === 'Reading' ||
        k === 'Pinyin' ||
        k === 'Phiên âm' ||
        k === 'VocabFurigana'
    );

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

  const manualAudioFiles = resolveManualPlayAudioFiles(currentCard, isCardFlipped);
  const visibleAudioFiles = resolveVisibleAudioFiles(currentCard, isCardFlipped);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAppState({ optionKeyHeld: true });
      }

      const { settingsOpen, cmdKOpen, quickAddOpen } = getAppState();
      if (settingsOpen || cmdKOpen || quickAddOpen) {
        return;
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
          showToast(t('clozeBadge'));
        }
        return;
      }

      // CardEditorModal uses a contentEditable DIV, which is not in the tag
      // whitelist: typing a space or digit used to flip/grade the card instead.
      // event.target can be document on some Windows/WebView setups (no closest),
      // so the check lives in a defensive, unit-tested helper.
      if (isTypingTarget(e.target)) {
        return;
      }

      // 7-Color Flag Shortcuts: Cmd+1..7 (or Ctrl+1..7) toggles flag 1..7, Cmd+0 clears flag
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && /^[0-7]$/.test(e.key)) {
        e.preventDefault();
        const flagVal = parseInt(e.key, 10) as CardFlagColor;
        appActions.setCurrentReviewCardFlag(flagVal, true);
        return;
      }

      // Scoped Card Content Scale Shortcuts: Cmd/Ctrl + =/+ (zoom in), -/_ (zoom out), Shift+0 (reset 100%)
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const curIdx = REVIEW_CONTENT_SCALES.indexOf(reviewContentScale);
        const nextScale =
          REVIEW_CONTENT_SCALES[Math.min(REVIEW_CONTENT_SCALES.length - 1, Math.max(0, (curIdx >= 0 ? curIdx : 1) + 1))];
        if (nextScale !== reviewContentScale) {
          appActions.updatePreferences({ reviewContentScale: nextScale });
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const curIdx = REVIEW_CONTENT_SCALES.indexOf(reviewContentScale);
        const nextScale =
          REVIEW_CONTENT_SCALES[Math.min(REVIEW_CONTENT_SCALES.length - 1, Math.max(0, (curIdx >= 0 ? curIdx : 1) - 1))];
        if (nextScale !== reviewContentScale) {
          appActions.updatePreferences({ reviewContentScale: nextScale });
        }
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === '0' || e.key === ')' || e.code === 'Digit0')
      ) {
        e.preventDefault();
        if (reviewContentScale !== 100 || reviewStageWidth !== 'auto') {
          appActions.updatePreferences({ reviewContentScale: 100, reviewStageWidth: 'auto' });
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (lightboxTarget) {
          setLightboxTarget(null);
        } else if (audioPopoverOpen) {
          setAudioPopoverOpen(false);
        } else if (displayPopoverOpen) {
          setDisplayPopoverOpen(false);
        } else if (flagPopoverOpen) {
          setFlagPopoverOpen(false);
        } else {
          appActions.exitReview();
        }
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        // 原生 Anki：空格在正面显示答案，在背面等于「良好」。
        if (isCardFlipped) {
          appActions.answerCurrentCard(3);
        } else {
          appActions.flipCard();
        }
        return;
      }

      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        appActions.playAudio(manualAudioFiles);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        appActions.undoLastReview();
        return;
      }

      if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
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

      if (answerButtonMode === 'four' || optionKeyHeld || e.altKey) {
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
    answerButtonMode,
    isCardFlipped,
    isSessionComplete,
    currentCard,
    resolvedLang,
    lightboxTarget,
    audioPopoverOpen,
    displayPopoverOpen,
    flagPopoverOpen,
    manualAudioFiles,
    reviewContentScale,
    reviewStageWidth,
  ]);

  // 会话按 100 张一批从调度器取；续批时 currentCardIndex 会归零，直接用它算进度
  // 会跳回 1/100。这里用「已学张数」跨批累计：batchStartStudied 是当前批之前已学的数量。
  const batchStartStudied = Math.max(0, sessionStudiedCount - currentCardIndex);
  const totalSessionCards = Math.max(1, batchStartStudied + reviewQueue.length);
  const currentNumber = Math.min(totalSessionCards, sessionStudiedCount + 1);
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

  // 组件卸载（返回首页 / 切页签 / 完成复习）时兜底停掉原生音频：
  // 音频由 Anki 的 AVPlayer 播放，不随 React 组件销毁而停止。
  useEffect(() => {
    return () => {
      appActions.stopAudio();
    };
  }, []);

  // ============== SESSION COMPLETE CELEBRATION SCREEN (Light & Dark Adapted) ==============
  if (isSessionComplete || !currentCard) {
    return (
      <div className={`fixed inset-0 z-30 flex flex-col justify-between select-none overflow-hidden ui-view-enter ${screenBg}`}>
        <div className="w-full h-[2px] bg-[var(--status-success)]" />

        <header
          className={`h-16 ${
            isMac ? 'ps-[82px] pe-7' : 'px-7'
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
                {reviewScopeDeckId === 'all' ? t('congratsTitle') : t('congratsDeckTitle')}
              </h2>
              <p className="text-[13px] text-[#8E8E98] mt-1.5">
                {reviewScopeDeckId === 'all' ? t('congratsSub') : t('congratsDeckSub')}
              </p>
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
                  {avgSecDisplay} {t('secondsUnitShort')}
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
          <span>{t('reviewCompletedSub')}</span>
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
      label: 'Bold',
      action: () => appendToActiveField('<b>...</b>'),
    },
    {
      id: 'code',
      icon: '<>',
      label: 'Code',
      action: () => appendToActiveField('<code>code</code>'),
    },
    {
      id: 'latex',
      icon: '∑',
      label: 'LaTeX',
      action: () => appendToActiveField('\\( E = mc^2 \\)'),
    },
    {
      id: 'cloze',
      icon: '[]',
      label: t('clozeBadge'),
      action: () => appendToActiveField('{{c1::...}}'),
    },
  ];

  const orderedFieldKeys =
    currentCard.fieldOrder && currentCard.fieldOrder.length > 0
      ? currentCard.fieldOrder
      : Object.keys(fieldsDraft);

  const activeFlagNum = ((currentCard.flags || 0) & 7) as CardFlagColor;
  const activeFlagSpec = activeFlagNum !== 0 ? ANKI_FLAG_PALETTE[activeFlagNum] : null;

  const isSandboxCard = Boolean(
    (currentCard.needsSandbox ||
      (currentCard.notetypeId && sandboxNoteTypeIds.includes(currentCard.notetypeId))) &&
      (currentCard.sandboxFrontHtml || currentCard.sandboxBackHtml)
  );
  const combinedCardMarkup = [
    currentCard.frontHtml,
    currentCard.frontAnswerHtml,
    currentCard.backHtml,
    currentCard.front,
    currentCard.meaning,
  ]
    .filter(Boolean)
    .join(' ');
  const combinedCardTextLen = combinedCardMarkup.replace(/<[^>]*>/g, '').trim().length;
  const isComplexCard =
    isSandboxCard ||
    /<(img|table|svg|pre|canvas|video)\b|anki-io-wrap/i.test(combinedCardMarkup) ||
    combinedCardTextLen > 200;

  const isStageWidened =
    reviewStageWidth === 'full' ||
    reviewStageWidth === 'wide' ||
    (reviewStageWidth === 'auto' && isComplexCard);

  const stageMaxWidthClass =
    reviewStageWidth === 'full'
      ? 'max-w-[1120px]'
      : isStageWidened
      ? 'max-w-[840px]'
      : 'max-w-[580px]';

  const scaleFactor = reviewContentScale / 100;
  const scaleIdx = REVIEW_CONTENT_SCALES.indexOf(reviewContentScale);
  const resolvedScaleIdx = scaleIdx >= 0 ? scaleIdx : 1;
  const stepReviewScale = (delta: 1 | -1) => {
    const nextIdx = Math.min(REVIEW_CONTENT_SCALES.length - 1, Math.max(0, resolvedScaleIdx + delta));
    const nextScale = REVIEW_CONTENT_SCALES[nextIdx];
    if (nextScale !== reviewContentScale) {
      appActions.updatePreferences({ reviewContentScale: nextScale });
    }
  };

  const inlineImgMaxHeightPx = Math.round((isStageWidened ? 500 : 380) * scaleFactor);
  const inlineIoMaxHeightPx = Math.round((isStageWidened ? 560 : 420) * scaleFactor);

  const handleCardMediaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (inlineEditing) return;
    const ioWrap = getClosestFromTarget(e.target, '.anki-io-wrap') as HTMLElement | null;
    if (ioWrap && !getClosestFromTarget(e.target, 'a, button')) {
      e.preventDefault();
      e.stopPropagation();
      setLightboxTarget({ mode: 'io-html', html: ioWrap.outerHTML });
      return;
    }
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.tagName === 'IMG' &&
      !getClosestFromTarget(e.target, 'a, button, [onclick]')
    ) {
      const img = target as HTMLImageElement;
      const src = img.currentSrc || img.src;
      if (src) {
        e.preventDefault();
        e.stopPropagation();
        setLightboxTarget({ mode: 'img', src, alt: img.alt || undefined });
      }
    }
  };

  return (
    <div className={`fixed inset-0 z-30 flex flex-col select-none overflow-hidden transition-colors ${screenBg}`}>
      {/* Ultra-thin Top Progress Bar */}
      <div className={`w-full h-[2px] ${isDark ? 'bg-[#1C1D24]' : 'bg-[#E5E5EA]'}`}>
        <div
          className="h-full"
          style={{
            width: `${progressPct}%`,
            backgroundColor: brandHex,
            transition: 'width var(--dur-slow) var(--ease-out)',
          }}
        />
      </div>

      {/* Top Header Bar */}
      <header
        className={`h-16 ${
          isMac ? 'ps-[82px] pe-7' : 'px-7'
        } flex items-center justify-between border-b ${
          isDark ? 'border-white/[0.04]' : 'border-[#E5E5EA]'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <Tooltip variant="compact" content={t('backBtn')} side="bottom">
            <button
              type="button"
              onClick={() => {
                if (inlineEditing) {
                  setFieldsDraft({ ...originalFieldsDraft });
                  appActions.exitInlineEdit();
                } else {
                  appActions.exitReview();
                }
              }}
              aria-label={t('backBtn')}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${headerBtnSurface}`}
            >
              ‹
            </button>
          </Tooltip>
          <div>
            <div className="text-[14px] font-semibold tracking-tight flex items-center gap-2">
              <span>{inlineEditing ? t('editCardTitle') : currentCard.deckName}</span>
              {currentCard.isCloze && (
                <span className="px-2 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] text-[10px] font-medium">
                  {(currentCard.clozeSiblingCount || 1) > 1
                    ? t('clozeStepBadge', {
                        index: currentCard.clozeCardIndex || 1,
                        total: currentCard.clozeSiblingCount || 1,
                      })
                    : t('clozeBadge')}
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
                {t('cancel')}
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
                {t('saveChangesBtn')}
              </button>
            </div>
          ) : (
            <>
              {/* Unified Audio Control: Split Pill when card side has audio, Compact Icon Trigger otherwise */}
              <div ref={audioMenuRef} className="relative flex items-center">
                {manualAudioFiles.length > 0 ? (
                  <div
                    className={`h-8 rounded-lg border inline-flex items-stretch overflow-hidden transition-colors ${
                      playingAudioFile || audioPopoverOpen
                        ? isDark
                          ? 'bg-[#17181E] border-[var(--brand-border)]'
                          : 'bg-white border-[var(--brand-border)] shadow-2xs'
                        : isDark
                        ? 'bg-[#17181E] border-white/[0.07]'
                        : 'bg-white border-[#E5E5EA] shadow-2xs'
                    }`}
                  >
                    <Tooltip variant="compact" content={t('readAloud')} shortcut="R" side="bottom">
                      <button
                        type="button"
                        onClick={() => appActions.playAudio(manualAudioFiles)}
                        className={`h-full px-2.5 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                          playingAudioFile
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                            : isDark
                            ? 'text-[#8E8E93] hover:text-white hover:bg-white/[0.05]'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.03]'
                        }`}
                      >
                        <svg
                          className="w-3.5 h-3.5 opacity-85 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        <span>{t('readAloud')}</span>
                        {showShortcutHints && <kbd className="text-[10px] opacity-70 font-mono">R</kbd>}
                      </button>
                    </Tooltip>

                    <span
                      aria-hidden="true"
                      className={`w-px self-stretch shrink-0 transition-colors ${
                        playingAudioFile || audioPopoverOpen
                          ? 'bg-[var(--brand-border)]'
                          : isDark
                          ? 'bg-white/[0.08]'
                          : 'bg-[#E5E5EA]'
                      }`}
                    />

                    <Tooltip
                      variant="compact"
                      content={t('reviewAudioQuickBtn')}
                      side="bottom"
                      disabled={audioPopoverOpen}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setFlagPopoverOpen(false);
                          setDisplayPopoverOpen(false);
                          setAudioPopoverOpen((prev) => !prev);
                        }}
                        aria-label={t('reviewAudioQuickBtn')}
                        aria-expanded={audioPopoverOpen}
                        className={`h-full px-2 flex items-center justify-center cursor-pointer transition-colors ${
                          audioPopoverOpen
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                            : isDark
                            ? 'text-[#8E8E93] hover:text-white hover:bg-white/[0.05]'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.03]'
                        }`}
                      >
                        <svg
                          className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                            autoPlayFrontAudio || autoPlayBackAudio || audioPopoverOpen
                              ? 'opacity-90'
                              : 'opacity-45'
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        </svg>
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <Tooltip
                    variant="compact"
                    content={t('reviewAudioQuickBtn')}
                    side="bottom"
                    disabled={audioPopoverOpen}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFlagPopoverOpen(false);
                        setDisplayPopoverOpen(false);
                        setAudioPopoverOpen((prev) => !prev);
                      }}
                      aria-label={t('reviewAudioQuickBtn')}
                      aria-expanded={audioPopoverOpen}
                      className={`h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                        audioPopoverOpen
                          ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                          : headerBtnSurface
                      }`}
                    >
                      {autoPlayFrontAudio || autoPlayBackAudio ? (
                        <svg
                          className="w-3.5 h-3.5 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5 shrink-0 opacity-75"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <line x1="22" y1="9" x2="16" y2="15" />
                          <line x1="16" y1="9" x2="22" y2="15" />
                        </svg>
                      )}
                    </button>
                  </Tooltip>
                )}

                {audioPopoverOpen && (
                  <div
                    className={`absolute end-0 top-10 z-50 w-[280px] rounded-2xl border shadow-2xl p-3.5 space-y-3 backdrop-blur-xl ${
                      isDark
                        ? 'bg-[#181922]/96 border-[#2E303E] text-white'
                        : 'bg-white/96 border-[#E5E5EA] text-[#1D1D1F]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold">{t('reviewAudioQuickTitle')}</span>
                      <span className="text-[10px] font-mono text-[#8E8E93]">
                        {autoPlayFrontAudio && autoPlayBackAudio
                          ? 'Q + A'
                          : autoPlayFrontAudio
                          ? 'Q'
                          : autoPlayBackAudio
                          ? 'A'
                          : 'OFF'}
                      </span>
                    </div>

                    <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-[#E5E5EA]/70'}`}>
                      <div className="pb-2.5 flex items-center justify-between gap-3">
                        <span className="text-[12px] font-medium leading-snug">
                          {t('autoPlayFrontAudioTitle')}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoPlayFrontAudio}
                          aria-label={t('autoPlayFrontAudioTitle')}
                          onClick={() => {
                            const next = !autoPlayFrontAudio;
                            appActions.updatePreferences({ autoPlayFrontAudio: next });
                            if (!next && !isCardFlipped) {
                              appActions.stopAudio();
                            }
                          }}
                          style={autoPlayFrontAudio ? { backgroundColor: brandHex } : undefined}
                          className={`w-10 h-5.5 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 ease-in-out ${
                            autoPlayFrontAudio ? '' : isDark ? 'bg-[#3A3A48]' : 'bg-[#E5E5EA]'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                              autoPlayFrontAudio ? 'translate-x-4.5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="pt-2.5 flex items-center justify-between gap-3">
                        <span className="text-[12px] font-medium leading-snug">
                          {t('autoPlayBackAudioTitle')}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoPlayBackAudio}
                          aria-label={t('autoPlayBackAudioTitle')}
                          onClick={() => {
                            const next = !autoPlayBackAudio;
                            appActions.updatePreferences({ autoPlayBackAudio: next });
                            if (!next && isCardFlipped) {
                              appActions.stopAudio();
                            }
                          }}
                          style={autoPlayBackAudio ? { backgroundColor: brandHex } : undefined}
                          className={`w-10 h-5.5 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 ease-in-out ${
                            autoPlayBackAudio ? '' : isDark ? 'bg-[#3A3A48]' : 'bg-[#E5E5EA]'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                              autoPlayBackAudio ? 'translate-x-4.5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="text-[10.5px] text-[#8E8E93] leading-relaxed">
                      {t('autoPlayBackFallbackNote')}
                    </div>

                    <div className={`pt-2 border-t ${isDark ? 'border-white/[0.08]' : 'border-black/5'}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setAudioPopoverOpen(false);
                          setAppState({ settingsInitialTab: 'answer', settingsOpen: true });
                        }}
                        className={`w-full h-7.5 px-2.5 rounded-xl border text-[11px] font-medium flex items-center justify-between cursor-pointer transition-colors ${
                          isDark
                            ? 'bg-white/[0.04] border-white/[0.1] text-[#E5E5EA] hover:bg-white/[0.09]'
                            : 'bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#ECECF2]'
                        }`}
                      >
                        <span>{t('openAnswerSettingsLink')}</span>
                        <svg className="w-3 h-3 shrink-0 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 7-Color Flag Quick Picker Button & Popover */}
              <div ref={flagMenuRef} className="relative">
                <Tooltip variant="compact" content={t('flagFilterLabel')} shortcut="Cmd 1-7" side="bottom">
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayPopoverOpen(false);
                      setAudioPopoverOpen(false);
                      setFlagPopoverOpen((prev) => !prev);
                    }}
                    aria-label={
                      activeFlagSpec
                        ? `${t('flagFilterLabel')}: ${t(`flagLabel_${activeFlagNum}` as any)}`
                        : t('flagFilterLabel')
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
                      <span>{t(`flagShort_${activeFlagNum}` as any)}</span>
                    )}
                  </button>
                </Tooltip>

                {flagPopoverOpen && (
                  <div
                    className={`absolute end-0 top-10 z-50 w-[210px] rounded-2xl border shadow-2xl p-2 space-y-0.5 backdrop-blur-xl ${
                      isDark
                        ? 'bg-[#181922]/96 border-[#2E303E] text-white'
                        : 'bg-white/96 border-[#E5E5EA] text-[#1D1D1F]'
                    }`}
                  >
                    <div className="px-2.5 py-1 text-[10px] text-[#8E8E93] flex items-center justify-between">
                      <span>{t('flagFilterLabel')}</span>
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
                            <span>{t(`flagLabel_${fNum}` as any)}</span>
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
                        <span>{t('flagNone')}</span>
                        <span className="font-mono text-[10px]">0</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {currentCard.notetypeId && (
                <Tooltip
                  variant="compact"
                  content={`${t('compatMode')} (${currentCard.noteTypeName || 'Basic'})`}
                  side="bottom"
                >
                  <button
                    type="button"
                    onClick={() =>
                      currentCard.notetypeId &&
                      appActions.toggleNoteTypeSandbox(currentCard.notetypeId)
                    }
                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                      sandboxNoteTypeIds.includes(currentCard.notetypeId)
                        ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                        : headerBtnSurface
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <path d="M9 3v18" />
                    </svg>
                    <span>{t('compatMode')}</span>
                  </button>
                </Tooltip>
              )}

              {/* Display Settings (Aa): Content Scale + Card Stage Width */}
              <div ref={displayMenuRef} className="relative">
                <Tooltip variant="compact" content={t('reviewDisplayBtn')} side="bottom">
                  <button
                    type="button"
                    onClick={() => {
                      setFlagPopoverOpen(false);
                      setAudioPopoverOpen(false);
                      setDisplayPopoverOpen((prev) => !prev);
                    }}
                    aria-label={t('reviewDisplayBtn')}
                    aria-expanded={displayPopoverOpen}
                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                      displayPopoverOpen || reviewContentScale !== 100 || reviewStageWidth !== 'auto'
                        ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]'
                        : headerBtnSurface
                    }`}
                  >
                    <span className="font-bold tracking-tight text-[12px]">Aa</span>
                    {reviewContentScale !== 100 && (
                      <span className="font-mono text-[10px] opacity-90">{reviewContentScale}%</span>
                    )}
                  </button>
                </Tooltip>

                {displayPopoverOpen && (
                  <div
                    className={`absolute end-0 top-10 z-50 w-[280px] rounded-2xl border shadow-2xl p-3.5 space-y-3.5 backdrop-blur-xl ${
                      isDark
                        ? 'bg-[#181922]/96 border-[#2E303E] text-white'
                        : 'bg-white/96 border-[#E5E5EA] text-[#1D1D1F]'
                    }`}
                  >
                    {/* Content Scale Stepper */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold">{t('reviewScaleTitle')}</span>
                        <span className="font-mono text-[10px] text-[#8E8E93]">
                          {formatShortcut('Cmd +', platform)} / {formatShortcut('Cmd -', platform)}
                        </span>
                      </div>
                      <div
                        className={`flex items-center justify-between p-1 rounded-xl border ${
                          isDark
                            ? 'bg-white/[0.04] border-white/[0.08]'
                            : 'bg-[#F5F5F7] border-[#E5E5EA]'
                        }`}
                      >
                        <Tooltip variant="compact" content={t('decreaseFontSizeBtn')} shortcut="Cmd -">
                          <button
                            type="button"
                            onClick={() => stepReviewScale(-1)}
                            disabled={resolvedScaleIdx <= 0}
                            aria-label={t('decreaseFontSizeBtn')}
                            className="h-7 px-3 rounded-lg text-[12px] font-semibold hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer transition-colors"
                          >
                            A−
                          </button>
                        </Tooltip>
                        <Tooltip variant="compact" content={t('reviewResetDefaultBtn')} shortcut="Cmd Shift 0">
                          <button
                            type="button"
                            onClick={() => appActions.updatePreferences({ reviewContentScale: 100 })}
                            aria-label={t('reviewResetDefaultBtn')}
                            className={`h-7 px-3 rounded-lg text-[12px] font-mono font-semibold cursor-pointer transition-colors ${
                              reviewContentScale === 100
                                ? 'text-[var(--brand-text)]'
                                : 'hover:bg-black/5 dark:hover:bg-white/10'
                            }`}
                          >
                            {reviewContentScale}%
                          </button>
                        </Tooltip>
                        <Tooltip variant="compact" content={t('increaseFontSizeBtn')} shortcut="Cmd +">
                          <button
                            type="button"
                            onClick={() => stepReviewScale(1)}
                            disabled={resolvedScaleIdx >= REVIEW_CONTENT_SCALES.length - 1}
                            aria-label={t('increaseFontSizeBtn')}
                            className="h-7 px-3 rounded-lg text-[12px] font-semibold hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer transition-colors"
                          >
                            A+
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Card Stage Width Pills */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold">{t('reviewWidthTitle')}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { value: 'auto', labelKey: 'reviewWidthAuto', meta: '580/840' },
                            { value: 'standard', labelKey: 'reviewWidthStandard', meta: '580px' },
                            { value: 'wide', labelKey: 'reviewWidthWide', meta: '840px' },
                            { value: 'full', labelKey: 'reviewWidthFull', meta: '1120px' },
                          ] as Array<{ value: ReviewStageWidth; labelKey: any; meta: string }>
                        ).map((opt) => {
                          const active = reviewStageWidth === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => appActions.updatePreferences({ reviewStageWidth: opt.value })}
                              aria-pressed={active}
                              className={`px-2.5 py-1.5 rounded-xl border text-start transition-colors cursor-pointer flex items-center justify-between gap-1 ${
                                active
                                  ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)] font-semibold'
                                  : isDark
                                  ? 'bg-white/[0.03] border-white/[0.08] text-[#C8C8D2] hover:bg-white/[0.07]'
                                  : 'bg-white border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#F4F4F6]'
                              }`}
                            >
                              <span className="text-[11px] truncate">{t(opt.labelKey)}</span>
                              <span className="text-[9px] font-mono opacity-65 shrink-0">{opt.meta}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-2">
                      {(() => {
                        const isCustomDisplay =
                          reviewContentScale !== 100 || reviewStageWidth !== 'auto';
                        return (
                          <Tooltip
                            variant="compact"
                            content={t('reviewResetDefaultBtn')}
                            shortcut="Cmd Shift 0"
                            disabled={!isCustomDisplay}
                          >
                            <button
                              type="button"
                              disabled={!isCustomDisplay}
                              onClick={() =>
                                appActions.updatePreferences({
                                  reviewContentScale: 100,
                                  reviewStageWidth: 'auto',
                                })
                              }
                              className={`w-full h-7.5 px-2.5 rounded-xl border text-[11px] font-medium flex items-center justify-between transition-colors ${
                                isCustomDisplay
                                  ? isDark
                                    ? 'bg-white/[0.04] border-white/[0.1] text-[#E5E5EA] hover:bg-white/[0.09] cursor-pointer'
                                    : 'bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#ECECF2] cursor-pointer'
                                  : isDark
                                  ? 'bg-transparent border-white/[0.05] text-[#6E6E78] opacity-55 cursor-default'
                                  : 'bg-transparent border-[#ECECF2] text-[#AEAEB2] opacity-65 cursor-default'
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <svg
                                  className="w-3 h-3 shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                                <span>{t('reviewResetDefaultBtn')}</span>
                              </span>
                              <span className="text-[9px] font-mono opacity-75">100% · {t('reviewWidthAuto')}</span>
                            </button>
                          </Tooltip>
                        );
                      })()}
                      <div className="text-[10px] text-[#8E8E93] leading-relaxed">
                        {t('reviewImageZoomHint')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Tooltip variant="compact" content={t('editCardTitle')} shortcut="E" side="bottom">
                <button
                  type="button"
                  onClick={() => {
                    if (currentCard) appActions.openCardEditor(currentCard);
                  }}
                  aria-label={t('editCardTitle')}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${headerBtnSurface}`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              </Tooltip>

              <Tooltip variant="compact" content={t('cardInfoTitle')} shortcut="Cmd I" side="bottom">
                <button
                  type="button"
                  onClick={() => setAppState((prev) => ({ inspectorOpen: !prev.inspectorOpen }))}
                  aria-label={t('cardInfoTitle')}
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
              </Tooltip>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {/* Scrollable Center Pane for Flashcard */}
        <div
          className={`flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center transition-transform duration-[var(--dur-slow)] ${
            inspectorOpen ? 'ltr:-translate-x-28 rtl:translate-x-28' : ''
          }`}
        >
          <div
            style={
              {
                '--reviewer-img-max-h': `${inlineImgMaxHeightPx}px`,
                '--reviewer-io-max-h': `${inlineIoMaxHeightPx}px`,
              } as React.CSSProperties
            }
            className={`my-auto flex flex-col items-center w-full transition-[max-width] duration-200 ${stageMaxWidthClass}`}
          >
            {/* Floating Zen Flashcard — Strict Light/Dark Adaptation + Card Enter (C2) */}
            <div
              key={currentCard.id}
              onClick={handleCardMediaClick}
              onDoubleClick={(e) => {
                const target = e.target as HTMLElement | null;
                if (
                  (target && target.tagName === 'IMG') ||
                  getClosestFromTarget(e.target, '.anki-io-wrap')
                ) {
                  return;
                }
                if (currentCard) appActions.openCardEditor(currentCard);
              }}
              className={`w-full rounded-[22px] border p-7 sm:p-8 relative transition-[background-color,border-color,box-shadow] duration-[var(--dur-base)] shadow-sm ui-card-enter ${cardContainerSurface}`}
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
                      role="button"
                      tabIndex={0}
                      aria-label={`${fieldKey}: ${t('clickToEdit')}`}
                      onClick={() => setActiveFieldKey(fieldKey)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setActiveFieldKey(fieldKey);
                        }
                      }}
                      className="cursor-text group rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                    >
                      <div className="text-[11px] text-[#8E8E93] mb-1 flex items-center justify-between">
                        <span>{fieldKey}</span>
                        <span className="text-[10px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-[var(--dur-fast)] text-[var(--brand-text)]">
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
                    {hasDraftChanges ? `● ${t('unsavedChangesBadge')}` : t('autoSaved')}
                  </span>
                  <span>
                    {formatShortcut('Cmd Enter', platform)} {t('saveChangesBtn')} · Esc {t('cancel')}
                  </span>
                </div>

                {slashMenuOpen && (
                  <div
                    className={`absolute start-20 -bottom-44 w-[240px] rounded-2xl border shadow-2xl p-2 z-40 ${
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
                      <Tooltip variant="compact" content={t('clearFlagBtn')} shortcut="Cmd+0">
                        <button
                          type="button"
                          onClick={() => appActions.setCurrentReviewCardFlag(0, false)}
                          aria-label={t('clearFlagBtn')}
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
                          <span>{t(`flagShort_${activeFlagNum}` as any)}</span>
                        </button>
                      </Tooltip>
                    )}

                    {visibleAudioFiles.map((audioFile) => (
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

                {isSandboxCard ? (
                  <div className="my-2">
                    <SandboxCardFrame
                      cardId={currentCard.id}
                      frontHtml={currentCard.sandboxFrontHtml || currentCard.frontHtml}
                      backHtml={currentCard.sandboxBackHtml || currentCard.backHtml}
                      cssText={currentCard.sandboxCss || ''}
                      isFlipped={isCardFlipped}
                      isDark={isDark}
                      audioFiles={currentCard.audioFiles}
                      frontAudioFiles={currentCard.frontAudioFiles}
                      backAudioFiles={currentCard.backAudioFiles}
                      sandboxQuestionAudioFiles={currentCard.sandboxQuestionAudioFiles}
                      sandboxAnswerAudioFiles={currentCard.sandboxAnswerAudioFiles}
                      contentScale={scaleFactor}
                      onImageZoom={(target) => setLightboxTarget({ mode: 'img', src: target.src, alt: target.alt })}
                    />
                  </div>
                ) : (
                  <>
                    {/* Headword & Reading (hidden on flip when replaceFrontOnFlip is true so afmt replaces the whole card cleanly) */}
                    {!(isCardFlipped && currentCard.replaceFrontOnFlip) && (() => {
                      const frontHtmlContent = isCardFlipped
                        ? currentCard.frontAnswerHtml || currentCard.frontHtml || currentCard.front
                        : currentCard.frontHtml || currentCard.front;
                      const isNativeStyledFront = Boolean(
                        frontHtmlContent && frontHtmlContent.includes('anki-native-card')
                      );
                      const frontCleanText = (frontHtmlContent || '').replace(/<[^>]*>/g, '').trim();
                      const frontTextLen = frontCleanText.length;
                      const frontBaseFontPx =
                        isNativeStyledFront || frontTextLen > 80 ? 17 : frontTextLen > 35 ? 22 : 30;
                      const frontTypographyClass = isNativeStyledFront
                        ? 'w-full select-text break-words text-[17px] leading-relaxed'
                        : frontTextLen > 80
                        ? 'font-semibold leading-relaxed tracking-normal whitespace-pre-wrap'
                        : frontTextLen > 35
                        ? 'font-bold leading-snug tracking-tight whitespace-pre-wrap'
                        : 'font-bold leading-tight tracking-tight whitespace-pre-wrap';

                      return (
                        <div className="mb-6 select-text cursor-text">
                          <div
                            style={
                              isNativeStyledFront
                                ? scaleFactor !== 1
                                  ? { zoom: scaleFactor }
                                  : undefined
                                : { fontSize: `${Math.round(frontBaseFontPx * scaleFactor * 10) / 10}px` }
                            }
                            className={`${frontTypographyClass} break-words [&_img]:max-h-[var(--reviewer-img-max-h)] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-2 [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer [&_.anki-io-wrap]:cursor-zoom-in [&_.anki-io-wrap_img]:!my-0 [&_.anki-io-wrap_img]:!max-h-[var(--reviewer-io-max-h)]`}
                            dangerouslySetInnerHTML={{
                              __html: renderMathAndRichHtml(frontHtmlContent, !isCardFlipped),
                            }}
                          />
                          {currentCard.reading && !isNativeStyledFront && (
                            <p
                              style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                              className="text-[#8E8E98] mt-1.5"
                            >
                              {currentCard.reading}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {isCardFlipped ? (
                      <div className="ui-answer-reveal">
                        {!currentCard.replaceFrontOnFlip && (
                          <div
                            className={`h-[1px] my-5 ui-divider-reveal ${
                              isDark ? 'bg-white/[0.07]' : 'bg-[#ECECF2]'
                            }`}
                          />
                        )}

                        {/* Meaning */}
                        {(() => {
                          const backHtmlContent = currentCard.backHtml || currentCard.meaning;
                          const isNativeStyledBack = Boolean(
                            (currentCard.backHtml || '').includes('anki-native-card')
                          );
                          return (
                            <div
                              style={
                                isNativeStyledBack
                                  ? scaleFactor !== 1
                                    ? { zoom: scaleFactor }
                                    : undefined
                                  : { fontSize: `${Math.round(17 * scaleFactor * 10) / 10}px` }
                              }
                              className={`select-text cursor-text break-words ${
                                isNativeStyledBack
                                  ? 'w-full text-[16px] leading-relaxed [&_img]:max-h-[var(--reviewer-img-max-h)] [&_img]:w-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer'
                                  : 'font-medium leading-relaxed whitespace-pre-wrap [&_img]:max-h-[var(--reviewer-img-max-h)] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-3 [&_img]:cursor-zoom-in [&_a_img]:cursor-pointer [&_button_img]:cursor-pointer [&_.anki-io-wrap]:cursor-zoom-in [&_.anki-io-wrap_img]:!my-0 [&_.anki-io-wrap_img]:!max-h-[var(--reviewer-io-max-h)]'
                              } [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[0.85em] ${
                                isDark
                                  ? 'text-[#EFEFF5] [&_code]:bg-white/10'
                                  : 'text-[#1D1D1F] [&_code]:bg-[#F2F2F7]'
                              }`}
                              dangerouslySetInnerHTML={{
                                __html: renderMathAndRichHtml(backHtmlContent),
                              }}
                            />
                          );
                        })()}

                        {/* Progressive Hints */}
                        <div className="mt-5 space-y-2.5">
                          {currentCard.etymology && (
                            <div
                              style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                              className="flex items-center gap-2.5"
                            >
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
                            <div
                              style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                              className="flex items-center gap-2.5"
                            >
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
                            <div
                              style={{ fontSize: `${Math.round(13 * scaleFactor * 10) / 10}px` }}
                              className="flex items-center gap-2.5"
                            >
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
                      </div>
                    ) : (
                      <div
                        className={`py-7 flex flex-col items-center justify-center border-t mt-4 gap-3.5 ${
                          isDark ? 'border-white/[0.05]' : 'border-[#ECECF2]'
                        }`}
                      >
                        <p className="text-[13px] text-[#8E8E93]">{t('recallPrompt')}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Bottom Card Tags & Review Count — Smart Collapsed */}
                {(currentCard.tags.length > 0 || currentCard.reps > 0) && (
                  <div className="mt-6 pt-3.5 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between gap-2 text-[11px] text-[#8E8E93]">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {currentCard.tags.slice(0, 2).map((tag) => (
                        <Tooltip key={tag} variant="compact" content={`#${tag}`} onlyWhenTruncated>
                          <span
                            tabIndex={0}
                            className={`inline-block align-middle px-2 py-0.5 rounded-md text-[10px] truncate max-w-[120px] focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1 ${
                              isDark
                                ? 'bg-white/[0.06] text-[#8E8E98]'
                                : 'bg-[#F2F2F7] text-[#6E6E73]'
                            }`}
                          >
                            #{tag}
                          </span>
                        </Tooltip>
                      ))}
                      {currentCard.tags.length > 2 && (
                        <Tooltip
                          variant="compact"
                          content={currentCard.tags.slice(2).map((tItem) => `#${tItem}`).join(', ')}
                        >
                          <span
                            tabIndex={0}
                            className={`px-1.5 py-0.5 rounded-md text-[10px] cursor-default focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1 ${
                              isDark
                                ? 'bg-white/[0.04] text-[#7E7E86]'
                                : 'bg-[#ECECF2] text-[#8E8E93]'
                            }`}
                          >
                            +{currentCard.tags.length - 2}
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    {currentCard.reps > 0 && (
                      <span className="text-[11px] text-[#8E8E93] shrink-0 ms-auto font-mono">
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
          className={`shrink-0 pb-6 pt-3 px-6 flex flex-col items-center justify-center border-t border-black/[0.04] dark:border-white/[0.04] transition-transform duration-[var(--dur-slow)] z-10 ${
            isDark ? 'bg-[#0E0F14]/92' : 'bg-[#F8F8FA]/92'
          } backdrop-blur-md ${inspectorOpen ? 'ltr:-translate-x-28 rtl:translate-x-28' : ''}`}
        >
          <div className="w-[560px] max-w-full h-[58px]">
            {!isCardFlipped ? (
              /* Unflipped: Full 560px width so clicking center or center-right lands directly on "Good" after flip! */
              <button
                onClick={() => appActions.flipCard()}
                style={{ backgroundColor: brandHex }}
                className={`w-[560px] h-[58px] px-6 rounded-2xl hover:opacity-95 text-white font-semibold text-[15px] shadow-xl flex items-center ${
                  showShortcutHints ? 'justify-between' : 'justify-center'
                } cursor-pointer transition-[transform,opacity] duration-[var(--dur-fast)] active:scale-[0.98]`}
              >
                <span>{t('showAnswerBtn')}</span>
                {showShortcutHints && (
                  <kbd className="px-2.5 py-1 rounded-lg bg-white/20 text-[12px] font-mono">
                    Space / Enter
                  </kbd>
                )}
              </button>
            ) : optionKeyHeld || answerButtonMode === 'four' ? (
              /* 4-Level FSRS Mode: 560px 4-column grid */
              <div className="grid grid-cols-4 gap-3 w-[560px] h-[58px]">
                <button
                  onClick={() => appActions.answerCurrentCard(1)}
                  className={`h-[58px] px-4 rounded-2xl border flex items-center ${
                    showShortcutHints ? 'justify-between' : 'justify-center text-center'
                  } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] active:scale-[0.98] bg-[var(--status-danger-soft)] border-[var(--status-danger)]/35 hover:border-[var(--status-danger)] text-[var(--status-danger)]`}
                >
                  <div className={showShortcutHints ? 'text-start' : 'text-center'}>
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
                  } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] active:scale-[0.98] bg-[var(--status-warning-soft)] border-[var(--status-warning)]/35 hover:border-[var(--status-warning)] text-[var(--status-warning)]`}
                >
                  <div className={showShortcutHints ? 'text-start' : 'text-center'}>
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
                  } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] active:scale-[0.98] bg-[var(--status-success-soft)] border-[var(--status-success)]/35 hover:border-[var(--status-success)] text-[var(--status-success)]`}
                >
                  <div className={showShortcutHints ? 'text-start' : 'text-center'}>
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
                  } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] active:scale-[0.98] bg-[var(--status-info-soft)] border-[var(--status-info)]/35 hover:border-[var(--status-info)] text-[var(--status-info)]`}
                >
                  <div className={showShortcutHints ? 'text-start' : 'text-center'}>
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
                  } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] active:scale-[0.98] bg-[var(--status-danger-soft)] border-[var(--status-danger)]/35 hover:border-[var(--status-danger)] text-[var(--status-danger)]`}
                >
                  <div className={showShortcutHints ? 'text-start' : 'text-center'}>
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
                  } cursor-pointer transition-[transform,border-color,background-color] duration-[var(--dur-fast)] active:scale-[0.98] bg-[var(--brand-soft)] border-[var(--brand-border)] hover:border-[var(--brand)] text-[var(--brand-text)]`}
                >
                  <div className={showShortcutHints ? 'text-start' : 'text-center'}>
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
                  ? answerButtonMode === 'four'
                    ? `1 ${t('rateAgain')} · 2 ${t('rateHard')} · 3 ${t('rateGood')} · 4 ${t('rateEasy')} · Space/Enter ${t('rateGood')} · Backspace ${t('undoBtnShort')} · Cmd+1~7`
                    : `1 ${t('rateAgain')} · 2/3/Enter/Space ${t('rateGood')} · Opt 1~4 · Backspace ${t('undoBtnShort')} · Cmd+1~7`
                  : `Space / Enter ${t('showAnswerBtn')} · Backspace ${t('undoBtnShort')} · Cmd+1~7 · R`,
                platform
              )}
            </button>
          )}
        </footer>
      )}

        {/* RIGHT INSPECTOR DRAWER (Light & Dark Adapted) */}
        {inspectorOpen && (
          <aside className={`absolute end-0 top-0 bottom-0 w-[300px] backdrop-blur-xl border-s p-6 flex flex-col justify-between z-40 ${inspectorSurface}`}>
            <div className="space-y-5 overflow-y-auto pe-0.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold">{t('cardInfoTitle')}</h3>
                <Tooltip variant="compact" content={t('close')} shortcut="Esc" side="bottom">
                  <button
                    type="button"
                    aria-label={t('close')}
                    onClick={() => setAppState({ inspectorOpen: false })}
                    className="text-[#8E8E93] hover:text-[var(--brand-text)] text-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 rounded"
                  >
                    ✕
                  </button>
                </Tooltip>
              </div>

              {/* 7-Color Flag Picker inside Inspector */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#8E8E93] mb-2">
                  <span>{t('flagFilterLabel')}</span>
                  <span className="font-mono text-[10px]">
                    {activeFlagSpec
                      ? t(`flagLabel_${activeFlagNum}` as any)
                      : formatShortcut('Cmd 1-7', platform)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  {([1, 2, 3, 4, 5, 6, 7] as Array<Exclude<CardFlagColor, 0>>).map((fNum) => {
                    const spec = ANKI_FLAG_PALETTE[fNum];
                    const isSel = activeFlagNum === fNum;
                    return (
                      <Tooltip
                        key={fNum}
                        variant="compact"
                        content={t(`flagLabel_${fNum}` as any)}
                        shortcut={`Cmd+${fNum}`}
                      >
                        <button
                          type="button"
                          onClick={() => appActions.setCurrentReviewCardFlag(fNum, true)}
                          aria-label={t(`flagLabel_${fNum}` as any)}
                          className={`w-7 h-7 rounded-xl border flex items-center justify-center cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
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
                      </Tooltip>
                    );
                  })}
                  <Tooltip variant="compact" content={t('clearFlagBtn')} shortcut="Cmd+0">
                    <button
                      type="button"
                      onClick={() => appActions.setCurrentReviewCardFlag(0, false)}
                      aria-label={t('clearFlagBtn')}
                      className={`w-7 h-7 rounded-xl border text-[11px] flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                        activeFlagNum === 0
                          ? 'opacity-40'
                          : 'text-[#8E8E93] hover:text-[var(--status-danger)] border-black/10 dark:border-white/10'
                      }`}
                    >
                      ✕
                    </button>
                  </Tooltip>
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
                <Tooltip variant="compact" content={t('buryCardBtn')}>
                  <button
                    type="button"
                    onClick={() => appActions.buryCurrentReviewCard()}
                    className={`h-8 rounded-xl border text-[11px] font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                      isDark
                        ? 'bg-[#1A1B22] border-white/[0.08] text-[#C8C8D2] hover:bg-white/10'
                        : 'bg-[#F8F8FA] border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#EFEFF4]'
                    }`}
                  >
                    {t('batchBury')}
                  </button>
                </Tooltip>

                <button
                  type="button"
                  onClick={() => appActions.toggleSuspendCurrentReviewCard()}
                  className={`h-8 rounded-xl border text-[11px] font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2 ${
                    isDark
                      ? 'bg-[#1A1B22] border-white/[0.08] text-[#C8C8D2] hover:bg-white/10'
                      : 'bg-[#F8F8FA] border-[#E5E5EA] text-[#3A3A3C] hover:bg-[#EFEFF4]'
                  }`}
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
                    aria-label={t('deleteCardBtn')}
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

              <CopyDebugInfoButton
                key={currentCard.id}
                label={t('copyDebugInfoBtn')}
                copiedLabel={t('copiedBadge')}
                tooltipText={t('copyDebugInfoTooltip')}
                ariaLabel={t('copyDebugInfoBtn')}
                copiedToast={t('debugInfoCopiedToast')}
                failedToast={t('copyFailedToast')}
                idleClassName={
                  isDark
                    ? 'bg-[#1A1B22] border-white/[0.08] text-[#9A9AA6] hover:text-white hover:bg-white/10'
                    : 'bg-[#F8F8FA] border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#EFEFF4]'
                }
                onCopyDebugInfo={() =>
                  collectAndCopyCardDebugInfo({
                    client: {
                      sourceView: 'reviewer',
                      envInfo,
                      theme,
                      accentColor,
                      resolvedLang,
                      sandboxNoteTypeIds,
                      autoPlayFrontAudio,
                      autoPlayBackAudio,
                      reviewStageWidth,
                      reviewContentScale,
                      isPreviewSession,
                      isCardFlipped,
                      isSandboxCard,
                    },
                    card: cardDebugSnapshotFromReviewCard(currentCard),
                  })
                }
              />
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

      {lightboxTarget && (
        <ReviewerImageLightbox
          target={lightboxTarget}
          onClose={() => setLightboxTarget(null)}
        />
      )}
    </div>
  );
};
