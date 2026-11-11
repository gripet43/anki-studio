import React, { useEffect, useMemo, useRef, useState } from 'react';
import { callAnki, isAnkiNativeEnv } from '../../bridge/pycmd';
import { usePresence } from '../../hooks/usePresence';
import { translate } from '../../i18n/translations';
import { appActions, LibraryCardItem, ReviewCardItem, setAppState, showToast, useAppStore } from '../../stores/useAppStore';
import { renderMathAndRichHtml } from '../../utils/mathRenderer';
import { extractMediaBaseUrlFromHtml, resolveMediaInHtml } from '../../utils/mediaUrl';
import { getAccentScale } from '../../utils/themeTokens';
import { ImageOcclusionEditorModal } from './ImageOcclusionEditorModal';
import { TowerWysiwygEditor } from './TowerWysiwygEditor';

const FRONT_ALIASES = ['正面', 'Front', 'Text', '文字', '问题', 'Question', 'Word', 'Expression'];
const BACK_ALIASES = ['背面', 'Back', 'Meaning', '释义', '答案', 'Back Extra', 'Answer', '背面额外', 'Examples', '例句'];

export type NoteCreationPreset = 'basic' | 'reversed' | 'cloze' | string;

interface NoteTypeOption {
  id: string;
  name: string;
  isCloze: boolean;
  fields: string[];
  isReversed?: boolean;
}

function normalizeTextForDup(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\[sound:[^\]]+\]/g, '')
    .replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const CardEditorModal: React.FC = () => {
  const {
    quickAddOpen,
    editingCardData,
    decks,
    libraryCards,
    theme,
    accentColor,
    resolvedLang,
    envInfo,
    libraryAllTags,
  } = useAppStore();

  const isDark = theme === 'dark' || theme === 'oled';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const isEditMode = Boolean(editingCardData);

  // Deck State
  const [selectedDeckId, setSelectedDeckId] = useState<string>('1');
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false);
  const [deckSearchQuery, setDeckSearchQuery] = useState('');

  // Note Type / Creation Mode Selector State
  const [noteTypeDropdownOpen, setNoteTypeDropdownOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<NoteCreationPreset>('basic');
  const [customNoteTypes, setCustomNoteTypes] = useState<NoteTypeOption[]>([]);

  // Fields State
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [frontFieldName, setFrontFieldName] = useState<string>('正面');
  const [backFieldName, setBackFieldName] = useState<string>('背面');
  const [additionalFields, setAdditionalFields] = useState<Record<string, string>>({});
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Real-time Duplicate Detection State
  const [backendDupCount, setBackendDupCount] = useState(0);
  const [backendDupPreview, setBackendDupPreview] = useState('');

  // Tags State
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [ioEditorOpen, setIoEditorOpen] = useState(false);

  // Track original snapshot for dirty check
  const [originalSnapshot, setOriginalSnapshot] = useState<{
    front: string;
    back: string;
    tags: string[];
    deckId: string;
  }>({
    front: '',
    back: '',
    tags: [],
    deckId: '1',
  });

  const deckDropdownRef = useRef<HTMLDivElement>(null);
  const noteTypeDropdownRef = useRef<HTMLDivElement>(null);

  const applyFormatting = (type: 'bold' | 'italic' | 'cloze' | 'math' | 'code' | 'highlight' | 'list' | 'clear') => {
    if (type === 'cloze') {
      void renderMathAndRichHtml;
    }
  };

  const brandHex = getAccentScale(accentColor, theme).brand;
  const effectiveMediaBaseUrl = useMemo(() => {
    if (envInfo.mediaBaseUrl) return envInfo.mediaBaseUrl;
    if (editingCardData) {
      return extractMediaBaseUrlFromHtml(
        editingCardData.frontHtml,
        editingCardData.backHtml
      );
    }
    return '';
  }, [envInfo.mediaBaseUrl, editingCardData]);

  // Fetch available Note Types from Anki collection when modal opens
  useEffect(() => {
    if (!quickAddOpen || !isAnkiNativeEnv()) return;
    callAnki<{ noteTypes?: NoteTypeOption[] }>('get_note_types', {})
      .then((res) => {
        if (res && Array.isArray(res.noteTypes)) {
          setCustomNoteTypes(res.noteTypes);
        }
      })
      .catch(() => {});
  }, [quickAddOpen]);

  // Initialize data on modal open or card switch
  useEffect(() => {
    if (!quickAddOpen) return;

    if (editingCardData) {
      const initDeckId = editingCardData.deckId || decks[0]?.id || '1';
      const allFields = editingCardData.fields || {};

      const fieldKeys = Object.keys(allFields);
      const fKey = fieldKeys.find((k) => FRONT_ALIASES.includes(k)) || fieldKeys[0] || '正面';
      const bKey =
        fieldKeys.find((k) => k !== fKey && BACK_ALIASES.includes(k)) ||
        (fieldKeys.length > 1 ? fieldKeys[1] : undefined) ||
        '背面';

      setFrontFieldName(fKey);
      setBackFieldName(bKey);

      const rawFront = resolveMediaInHtml(
        fKey && allFields[fKey] !== undefined && allFields[fKey] !== ''
          ? allFields[fKey]
          : editingCardData.front || '',
        effectiveMediaBaseUrl
      );

      const rawBack = resolveMediaInHtml(
        bKey && allFields[bKey] !== undefined && allFields[bKey] !== ''
          ? allFields[bKey]
          : (editingCardData as ReviewCardItem).meaning ||
            (editingCardData as LibraryCardItem).back ||
            '',
        effectiveMediaBaseUrl
      );

      const initTags = editingCardData.tags ? [...editingCardData.tags] : [];

      setSelectedDeckId(initDeckId);
      setFront(rawFront);
      setBack(rawBack);
      setTags(initTags);

      const extra: Record<string, string> = {};
      for (const [k, v] of Object.entries(allFields)) {
        if (k !== fKey && k !== bKey) {
          extra[k] = v;
        }
      }
      setAdditionalFields(extra);
      setShowMoreFields(Object.keys(extra).length > 0);

      setOriginalSnapshot({
        front: rawFront,
        back: rawBack,
        tags: initTags,
        deckId: initDeckId,
      });
    } else {
      const fallbackDeckId = decks[0]?.id || '1';
      setSelectedDeckId(fallbackDeckId);
      setSelectedPreset('basic');
      setFrontFieldName('正面');
      setBackFieldName('背面');
      setFront('');
      setBack('');
      setAdditionalFields({});
      setTags([]);
      setOriginalSnapshot({
        front: '',
        back: '',
        tags: [],
        deckId: fallbackDeckId,
      });
    }

    setDeckDropdownOpen(false);
    setNoteTypeDropdownOpen(false);
    setDeckSearchQuery('');
    setTagInput('');
    setShowTagInput(false);
    setSubmitting(false);
    setConfirmDiscardOpen(false);
    setBackendDupCount(0);
    setBackendDupPreview('');
  }, [quickAddOpen, editingCardData]);

  // Click outside dropdowns to close
  useEffect(() => {
    if (!deckDropdownOpen && !noteTypeDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (deckDropdownRef.current && !deckDropdownRef.current.contains(e.target as Node)) {
        setDeckDropdownOpen(false);
      }
      if (noteTypeDropdownRef.current && !noteTypeDropdownRef.current.contains(e.target as Node)) {
        setNoteTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [deckDropdownOpen, noteTypeDropdownOpen]);

  // Real-time Duplicate Detection
  const localDuplicateInfo = useMemo(() => {
    const norm = normalizeTextForDup(front);
    if (!norm || norm.length < 1) {
      return { count: 0, matchedTerm: '' };
    }
    const excludeNid = editingCardData?.noteId;
    const matches = libraryCards.filter((c) => {
      if (excludeNid && c.noteId === excludeNid) return false;
      return normalizeTextForDup(c.frontHtml || c.front) === norm;
    });
    return {
      count: matches.length,
      matchedTerm: matches[0]?.front || norm,
    };
  }, [front, libraryCards, editingCardData]);

  useEffect(() => {
    if (!quickAddOpen) return;
    const norm = normalizeTextForDup(front);
    if (!norm || !isAnkiNativeEnv()) {
      setBackendDupCount(0);
      setBackendDupPreview('');
      return;
    }
    const timer = setTimeout(() => {
      callAnki<{
        isDuplicate: boolean;
        duplicateCount: number;
        matchedPreview: string;
      }>('check_duplicate', {
        front,
        excludeNoteId: editingCardData?.noteId || '',
      })
        .then((res) => {
          if (res) {
            setBackendDupCount(res.duplicateCount || 0);
            setBackendDupPreview(res.matchedPreview || '');
          }
        })
        .catch(() => {});
    }, 220);
    return () => clearTimeout(timer);
  }, [front, quickAddOpen, editingCardData]);

  const effectiveDuplicateCount = Math.max(localDuplicateInfo.count, backendDupCount);
  const duplicateSearchTerm = useMemo(() => {
    return (
      backendDupPreview ||
      localDuplicateInfo.matchedTerm ||
      front.replace(/<[^>]+>/g, '').trim().slice(0, 40)
    );
  }, [backendDupPreview, localDuplicateInfo, front]);

  // Dirty state computation
  const hasChanges = useMemo(() => {
    if (!isEditMode) {
      return Boolean(front.trim() || back.trim() || tags.length > 0);
    }
    if (front.trim() !== originalSnapshot.front.trim()) return true;
    if (back.trim() !== originalSnapshot.back.trim()) return true;
    if (selectedDeckId !== originalSnapshot.deckId) return true;
    if (tags.length !== originalSnapshot.tags.length) return true;
    if (tags.some((tItem, idx) => tItem !== originalSnapshot.tags[idx])) return true;
    return false;
  }, [front, back, tags, selectedDeckId, originalSnapshot, isEditMode]);

  // Cloze indicator
  const isCloze = useMemo(() => {
    return (
      selectedPreset === 'cloze' ||
      /\{\{c\d+::/.test(front) ||
      /\{\{c\d+::/.test(back) ||
      /data-cloze-ord/.test(front) ||
      /data-cloze-ord/.test(back)
    );
  }, [front, back, selectedPreset]);

  const handleSelectNotePreset = (presetId: NoteCreationPreset, customModel?: NoteTypeOption) => {
    setSelectedPreset(presetId);
    setNoteTypeDropdownOpen(false);
    if (customModel && customModel.fields.length >= 1) {
      setFrontFieldName(customModel.fields[0] || '正面');
      setBackFieldName(customModel.fields[1] || '背面');
      const extra: Record<string, string> = {};
      for (const fName of customModel.fields.slice(2)) {
        extra[fName] = additionalFields[fName] || '';
      }
      setAdditionalFields(extra);
      setShowMoreFields(Object.keys(extra).length > 0);
    } else if (presetId === 'cloze') {
      setFrontFieldName('Text');
      setBackFieldName('Back Extra');
    } else {
      setFrontFieldName('正面');
      setBackFieldName('背面');
    }
  };

  const activePresetLabel = useMemo(() => {
    if (front.includes('anki-io-wrap')) {
      return t('ioButtonLabel');
    }
    if (selectedPreset === 'reversed') {
      return t('notePresetReversedTitle');
    }
    if (isCloze) {
      return t('clozeBadge');
    }
    const foundCustom = customNoteTypes.find((m) => `model:${m.id}` === selectedPreset);
    if (foundCustom) {
      return foundCustom.name;
    }
    return t('notePresetBasicTitle');
  }, [front, selectedPreset, isCloze, customNoteTypes, resolvedLang]);

  const filteredDecks = useMemo(() => {
    const q = deckSearchQuery.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(
      (d) => d.name.toLowerCase().includes(q) || d.fullName.toLowerCase().includes(q)
    );
  }, [decks, deckSearchQuery]);

  const currentDeck = useMemo(() => {
    return decks.find((d) => d.id === selectedDeckId) || decks[0] || { id: '1', name: 'Default', fullName: 'Default' };
  }, [decks, selectedDeckId]);

  const tagAutocompleteMatches = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    return libraryAllTags
      .filter((tItem) => tItem.toLowerCase().includes(q) && !tags.includes(tItem))
      .slice(0, 8);
  }, [libraryAllTags, tagInput, tags]);

  const presence = usePresence(quickAddOpen, 120);
  if (!presence.mounted) return null;

  const handleAttemptClose = () => {
    if (confirmDiscardOpen) {
      setConfirmDiscardOpen(false);
      return;
    }
    if (hasChanges) {
      setConfirmDiscardOpen(true);
    } else {
      appActions.closeCardEditor();
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      handleAttemptClose();
    }
  };

  const handleAddTag = () => {
    const clean = tagInput.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleSubmit = async () => {
    if (!front.trim() || submitting) return;
    setSubmitting(true);
    applyFormatting('cloze');

    try {
      if (isEditMode && editingCardData) {
        const formattedFront = front.trim();
        const formattedBack = back.trim();

        const mergedFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(additionalFields)) {
          mergedFields[k] = v.trim();
        }
        mergedFields[frontFieldName] = formattedFront;
        mergedFields[backFieldName] = formattedBack;

        await appActions.saveCardEdits({
          cardId: editingCardData.id,
          noteId: editingCardData.noteId,
          deckId: currentDeck.id,
          deckName: currentDeck.name,
          front: formattedFront,
          back: formattedBack,
          tags,
          fields: mergedFields,
        });
      } else {
        const formattedFront = front.trim();
        const formattedBack = back.trim();
        const customModelId = selectedPreset.startsWith('model:')
          ? selectedPreset.slice('model:'.length)
          : undefined;
        const extraClean: Record<string, string> = {};
        for (const [k, v] of Object.entries(additionalFields)) {
          if (v.trim()) extraClean[k] = v.trim();
        }

        await appActions.quickAddCard({
          deckId: currentDeck.id,
          deckName: currentDeck.name,
          front: formattedFront,
          back: formattedBack,
          tags,
          modelId: customModelId,
          createReverseCard: selectedPreset === 'reversed',
          fields: Object.keys(extraClean).length > 0 ? extraClean : undefined,
        });

        setAppState({ quickAddOpen: false });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleJumpToDuplicateInLibrary = () => {
    const queryStr = duplicateSearchTerm;
    setAppState({
      quickAddOpen: false,
      editingCardData: null,
      activeTab: 'library',
      inReviewMode: false,
    });
    appActions.searchLibraryDebounced({
      query: queryStr,
      status: 'all',
      difficulty: 'all',
      flag: 'all',
      tag: 'all',
      deckId: 'all',
    });
  };

  const modalBg = isDark
    ? 'bg-[#171821] border-[#2C2E3C] text-white'
    : 'bg-white border-[#E5E5EA] text-[#1D1D1F]';

  const cardBorder = isDark ? 'border-[#2B2D3A]' : 'border-[#EAEAEA]';
  const inputBg = isDark ? 'bg-[#13141C]' : 'bg-[#FAFAFC]';

  return (
    <div
      data-state={presence.state}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[6px] flex items-center justify-center p-3 sm:p-6 select-none ui-modal-backdrop modal-contain-scroll"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-editor-title"
    >
      <div
        data-state={presence.state}
        className={`w-full max-w-[820px] max-h-[90vh] rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.32)] flex flex-col overflow-hidden ui-modal-panel relative ${modalBg}`}
      >
        {/* Header Bar */}
        <div className={`h-14 px-5 border-b flex items-center justify-between shrink-0 ${cardBorder}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Modal Title */}
            <span id="card-editor-title" className="font-bold text-[15px] tracking-tight shrink-0 flex items-center gap-2">
              {isEditMode ? (
                <svg className="w-4 h-4 text-[var(--brand-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[var(--brand-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              )}
              <span>{isEditMode ? t('editCardTitle') : t('newCardModalTitle')}</span>
            </span>

            {/* Deck Selector Popover Trigger */}
            <div ref={deckDropdownRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDeckDropdownOpen((prev) => !prev);
                  setNoteTypeDropdownOpen(false);
                }}
                className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isDark
                    ? 'border-[#343644] bg-[#21222E] hover:border-[var(--brand-border)] text-[#D8D8E0]'
                    : 'border-[#E0E0E6] bg-[#F4F4F6] hover:border-[var(--brand-border)] text-[#3A3A3C]'
                }`}
              >
                <svg className="w-3.5 h-3.5 opacity-70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                </svg>
                <span className="max-w-[125px] truncate">{currentDeck.name}</span>
                <svg className="w-2.5 h-2.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Deck Selector Popover Menu */}
              {deckDropdownOpen && (
                <div
                  className={`absolute start-0 top-8.5 z-50 w-[240px] rounded-xl border shadow-xl p-1.5 space-y-1 backdrop-blur-xl ${
                    isDark ? 'bg-[#1F202A] border-[#343646]' : 'bg-white border-[#E5E5EA]'
                  }`}
                >
                  <div className="px-2 pt-1 pb-1.5">
                    <input
                      type="text"
                      value={deckSearchQuery}
                      onChange={(e) => setDeckSearchQuery(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className={`w-full h-7 px-2 rounded-lg border text-[11px] focus:outline-none focus:border-[var(--brand)] ${
                        isDark ? 'bg-[#13141C] border-[#343644]' : 'bg-[#F4F4F6] border-[#E5E5EA]'
                      }`}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[180px] overflow-y-auto space-y-0.5">
                    {filteredDecks.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDeckId(d.id);
                          setDeckDropdownOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-[12px] flex items-center justify-between cursor-pointer transition-colors ${
                          d.id === selectedDeckId
                            ? 'bg-[var(--brand)] text-white font-medium'
                            : isDark
                            ? 'hover:bg-white/5 text-[#D1D1D8]'
                            : 'hover:bg-black/5 text-[#3A3A3C]'
                        }`}
                      >
                        <span className="truncate">{d.name}</span>
                        {d.id === selectedDeckId && (
                          <svg className="w-3 h-3 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Note Type / Creation Mode Selector Popover */}
            <div ref={noteTypeDropdownRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!isEditMode) {
                    setNoteTypeDropdownOpen((prev) => !prev);
                    setDeckDropdownOpen(false);
                  }
                }}
                className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                  isEditMode ? 'cursor-default' : 'cursor-pointer'
                } ${
                  front.includes('anki-io-wrap')
                    ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/35'
                    : isCloze || selectedPreset === 'reversed'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-border)]'
                    : isDark
                    ? 'border-[#343644] bg-[#21222E] hover:border-[var(--brand-border)] text-[#D8D8E0]'
                    : 'border-[#E0E0E6] bg-[#F4F4F6] hover:border-[var(--brand-border)] text-[#3A3A3C]'
                }`}
                title={activePresetLabel}
              >
                <span className="max-w-[140px] truncate">{activePresetLabel}</span>
                {!isEditMode && (
                  <svg className="w-2.5 h-2.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                )}
              </button>

              {!isEditMode && noteTypeDropdownOpen && (
                <div
                  className={`absolute start-0 top-8.5 z-50 w-[265px] rounded-xl border shadow-xl p-1.5 space-y-1 backdrop-blur-xl ${
                    isDark ? 'bg-[#1F202A] border-[#343646]' : 'bg-white border-[#E5E5EA]'
                  }`}
                >
                  {(
                    [
                      {
                        id: 'basic',
                        title: t('notePresetBasicTitle'),
                        desc: t('notePresetBasicDesc'),
                      },
                      {
                        id: 'reversed',
                        title: t('notePresetReversedTitle'),
                        desc: t('notePresetReversedDesc'),
                      },
                      {
                        id: 'cloze',
                        title: t('notePresetClozeTitle'),
                        desc: t('notePresetClozeDesc'),
                      },
                    ] as const
                  ).map((opt) => {
                    const isSel = selectedPreset === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectNotePreset(opt.id)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-start cursor-pointer transition-colors ${
                          isSel
                            ? 'bg-[var(--brand)] text-white'
                            : isDark
                            ? 'hover:bg-white/5 text-[#D1D1D8]'
                            : 'hover:bg-black/5 text-[#3A3A3C]'
                        }`}
                      >
                        <div className="text-[12px] font-semibold flex items-center justify-between">
                          <span>{opt.title}</span>
                          {isSel && <span>✓</span>}
                        </div>
                        <div className={`text-[10px] mt-0.5 ${isSel ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}

                  {customNoteTypes.filter((m) => m.fields.length > 2).length > 0 && (
                    <>
                      <div className="my-1 border-t border-black/5 dark:border-white/5" />
                      {customNoteTypes
                        .filter((m) => m.fields.length > 2)
                        .map((m) => {
                          const pKey = `model:${m.id}`;
                          const isSel = selectedPreset === pKey;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectNotePreset(pKey, m)}
                              className={`w-full px-2.5 py-1.5 rounded-lg text-start cursor-pointer transition-colors ${
                                isSel
                                  ? 'bg-[var(--brand)] text-white'
                                  : isDark
                                  ? 'hover:bg-white/5 text-[#D1D1D8]'
                                  : 'hover:bg-black/5 text-[#3A3A3C]'
                              }`}
                            >
                              <div className="text-[12px] font-semibold flex items-center justify-between">
                                <span className="truncate">{m.name}</span>
                                <span className={`text-[10px] font-mono ${isSel ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                                  {m.fields.length}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Action & Close Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIoEditorOpen(true)}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                front.includes('anki-io-wrap')
                  ? 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/25'
                  : isDark
                  ? 'border-[#343644] bg-[#21222E] hover:border-[var(--brand-border)] text-[#D8D8E0]'
                  : 'border-[#E0E0E6] bg-[#F4F4F6] hover:border-[var(--brand-border)] text-[#3A3A3C]'
              }`}
              title={t('ioStudioTitle')}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span>
                {front.includes('anki-io-wrap') ? t('ioEditButtonLabel') : t('ioButtonLabel')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleAttemptClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 text-xs cursor-pointer transition-colors"
              title={t('close')}
              aria-label={t('close')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body: Two Tower WYSIWYG Editor Blocks */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Real-time Duplicate Warning Banner */}
          {effectiveDuplicateCount > 0 && (
            <div className="px-3.5 py-2.5 rounded-xl border bg-[var(--status-warning-soft)] border-[var(--status-warning)]/40 text-[var(--status-warning)] flex items-center justify-between gap-3 text-[12px] animate-in fade-in duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold shrink-0">⚠️</span>
                <span className="font-medium truncate">
                  {t('duplicateDetectedBanner', { n: effectiveDuplicateCount })}
                </span>
              </div>
              <button
                type="button"
                onClick={handleJumpToDuplicateInLibrary}
                className="px-2.5 py-1 rounded-lg bg-[var(--status-warning)] text-white text-[11px] font-semibold shrink-0 cursor-pointer hover:opacity-90"
              >
                {t('viewInLibraryBtn')}
              </button>
            </div>
          )}

          {/* Front WYSIWYG Box (Tower Editor) */}
          <TowerWysiwygEditor
            label={`${frontFieldName} (${t('cardFrontLabel')})`}
            badge={t('requiredBadge')}
            value={front}
            onChange={(val) => setFront(val)}
            placeholder={t('editorFrontPlaceholder')}
            minHeight={130}
            isDark={isDark}
            accentColor={brandHex}
            mediaBaseUrl={effectiveMediaBaseUrl}
            onPasteImage={appActions.pasteImageFromClipboard}
            onKeyDownShortcut={handleEditorKeyDown}
            showCloze={true}
          />

          {/* Back WYSIWYG Box (Tower Editor) */}
          <TowerWysiwygEditor
            label={`${backFieldName} (${t('cardBackLabel')})`}
            badge={
              selectedPreset === 'reversed' ? t('notePresetReversedTitle') : undefined
            }
            value={back}
            onChange={(val) => setBack(val)}
            placeholder={t('editorBackPlaceholder')}
            minHeight={150}
            isDark={isDark}
            accentColor={brandHex}
            mediaBaseUrl={effectiveMediaBaseUrl}
            onPasteImage={appActions.pasteImageFromClipboard}
            onKeyDownShortcut={handleEditorKeyDown}
            showCloze={true}
          />

          {/* Additional Fields */}
          {Object.keys(additionalFields).length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowMoreFields((prev) => !prev)}
                className="text-[12px] font-semibold text-[var(--brand-text)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{showMoreFields ? '▾' : '▸'}</span>
                <span>
                  {t('moreFieldsBtn', { n: Object.keys(additionalFields).length })}
                </span>
              </button>

              {showMoreFields && (
                <div className="mt-3 space-y-3 ps-2 border-s-2 border-[var(--brand-border)]">
                  {Object.entries(additionalFields).map(([fKey, fVal]) => (
                    <div key={fKey} className="space-y-1">
                      <label className="block text-[11px] text-[#8E8E93] font-medium">{fKey}</label>
                      <input
                        type="text"
                        value={fVal}
                        onChange={(e) =>
                          setAdditionalFields((prev) => ({
                            ...prev,
                            [fKey]: e.target.value,
                          }))
                        }
                        className={`w-full h-9 px-3 rounded-xl border text-[13px] focus:outline-none focus:border-[var(--brand)] ${inputBg} ${cardBorder}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags Section */}
          <div className="space-y-2 pt-1">
            <label className="block text-[12px] font-semibold text-[#8E8E93]">
              {t('tagsLabel')}
            </label>

            {/* Active Tags Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tg) => (
                <span
                  key={tg}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium border ${
                    isDark
                      ? 'bg-[#22232E] border-[#343644] text-[#D8D8E0]'
                      : 'bg-[#F2F2F5] border-[#E2E2E8] text-[#3A3A3C]'
                  }`}
                >
                  <span>#{tg}</span>
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((tItem) => tItem !== tg))}
                    className="opacity-50 hover:opacity-100 hover:text-[var(--status-danger)] cursor-pointer ms-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}

              {/* Tag Input or Add Button */}
              {showTagInput ? (
                <div className="relative inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      } else if (e.key === 'Escape') {
                        setShowTagInput(false);
                        setTagInput('');
                      }
                    }}
                    placeholder={t('tagFilterLabel')}
                    className={`h-7 px-2.5 rounded-lg border text-[11px] focus:outline-none focus:border-[var(--brand)] ${
                      isDark ? 'bg-[#1C1D26] border-[#343644]' : 'bg-[#FAFAFC] border-[#E0E0E6]'
                    }`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="btn-primary !h-7 !px-2.5 !text-[11px]"
                  >
                    {t('addTagBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTagInput(false);
                      setTagInput('');
                    }}
                    className="h-7 px-1.5 text-[12px] text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                  >
                    {t('cancel')}
                  </button>

                  {/* Smart Tag Autocomplete Dropdown */}
                  {tagAutocompleteMatches.length > 0 && (
                    <div
                      className={`absolute start-0 top-8.5 z-50 w-44 max-h-40 overflow-y-auto rounded-xl border shadow-xl p-1 backdrop-blur-xl ${
                        isDark ? 'bg-[#1F202A] border-[#343646]' : 'bg-white border-[#E5E5EA]'
                      }`}
                    >
                      {tagAutocompleteMatches.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!tags.includes(st)) {
                              setTags([...tags, st]);
                            }
                            setTagInput('');
                          }}
                          className={`w-full text-start px-2 py-1 text-[11px] font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isDark
                              ? 'hover:bg-white/10 text-[#D8D8E0]'
                              : 'hover:bg-black/5 text-[#3A3A3C]'
                          }`}
                        >
                          <span className="text-[var(--brand-text)]">#</span>
                          <span className="truncate">{st}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    isDark
                      ? 'border-dashed border-[#343644] hover:border-[var(--brand)] text-[#8E8E93] hover:text-white'
                      : 'border-dashed border-[#D2D2D8] hover:border-[var(--brand)] text-[#6E6E73] hover:text-black'
                  }`}
                >
                  <span>{t('addTagBtn')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div
          className={`h-14 px-5 border-t flex items-center justify-between shrink-0 ${cardBorder} ${
            isDark ? 'bg-[#13141C]' : 'bg-[#FAFAFC]'
          }`}
        >
          {/* Left Status */}
          <div className="flex items-center gap-3 text-[11px] text-[#8E8E93]">
            {isEditMode && hasChanges && (
              <span className="text-[var(--status-warning)] font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
                <span>{t('unsavedChangesBadge')}</span>
              </span>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAttemptClose}
              className="btn-secondary !h-9 !px-3.5"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!front.trim() || submitting}
              style={{ backgroundColor: brandHex }}
              className="btn-primary !h-9 !px-5"
            >
              {submitting && <span className="animate-spin text-xs">⟳</span>}
              <span>
                {isEditMode
                  ? t('saveChangesBtn')
                  : t('addToDeckBtn', { deck: currentDeck.name })}
              </span>
            </button>
          </div>
        </div>

        {/* Unsaved changes confirmation dialog */}
        {confirmDiscardOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div
              className={`w-[360px] max-w-full rounded-2xl border p-5 shadow-2xl space-y-3 ${
                isDark
                  ? 'bg-[#1E1F2B] border-[#343648] text-white'
                  : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'
              }`}
            >
              <div className="font-bold text-[15px]">
                {t('discardUnsavedTitle')}
              </div>
              <p className="text-[12px] text-[#8E8E93] leading-relaxed">
                {t('discardUnsavedSub')}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmDiscardOpen(false)}
                  className={`h-8 px-3.5 rounded-xl border text-[12px] font-medium cursor-pointer transition-colors ${
                    isDark ? 'border-[#343648] hover:bg-white/5' : 'border-[#E5E5EA] hover:bg-black/5'
                  }`}
                >
                  {t('keepEditingBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDiscardOpen(false);
                    appActions.closeCardEditor();
                  }}
                  className="h-8 px-3.5 rounded-xl bg-[var(--status-danger)] text-white text-[12px] font-semibold cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {t('discardBtn')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Visual Image Occlusion Studio Modal */}
        <ImageOcclusionEditorModal
          open={ioEditorOpen}
          initialFrontHtml={front}
          isDark={isDark}
          brandHex={brandHex}
          mediaBaseUrl={effectiveMediaBaseUrl}
          onSaveImageFile={appActions.pasteImageFromClipboard}
          onClose={() => setIoEditorOpen(false)}
          onApply={(generatedHtml, rectCount) => {
            setFront(resolveMediaInHtml(generatedHtml, effectiveMediaBaseUrl));
            setIoEditorOpen(false);
            showToast(t('ioApplyBtn', { cards: rectCount }));
          }}
        />
      </div>
    </div>
  );
};
