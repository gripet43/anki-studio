import React, { useEffect, useMemo, useRef, useState } from 'react';
import { callAnki, isAnkiNativeEnv } from '../../bridge/pycmd';
import { usePresence } from '../../hooks/usePresence';
import { formatShortcut, translate } from '../../i18n/translations';
import { appActions, LibraryCardItem, ReviewCardItem, setAppState, showToast, useAppStore } from '../../stores/useAppStore';
import { renderMathAndRichHtml } from '../../utils/mathRenderer';
import { extractMediaBaseUrlFromHtml, resolveMediaInHtml } from '../../utils/mediaUrl';
import { getAccentScale } from '../../utils/themeTokens';
import {
  ImageOcclusionEditorModal,
  NativeOcclusionPayload,
  buildImageOcclusionHtml,
} from './ImageOcclusionEditorModal';
import { TowerWysiwygEditor } from './TowerWysiwygEditor';

const FRONT_ALIASES = [
  '正面',
  'Front',
  'Text',
  '文字',
  '问题',
  'Question',
  'Word',
  'Expression',
  '单词',
  'VocabKanji',
  'Mặt trước',
  '中文',
];
const BACK_ALIASES = [
  '背面',
  'Back',
  'Meaning',
  '释义',
  '解释',
  '答案',
  'Back Extra',
  'Answer',
  '背面额外',
  'VocabDefSC',
  'Tiếng Việt',
  'English',
  'Explain1',
  'Notes',
  'Examples',
  '例句',
];
const METADATA_SKIP_FIELDS = new Set([
  'noteid',
  'note id',
  'id',
  'guid',
  'uuid',
  'link',
  'level',
  'suborder',
  'honorific',
  'index',
  'order',
  '序号',
  '编号',
  'audio',
  'vocabaudio',
  'vocabpitch',
  'vocabpos',
  'example type',
  'source url',
  'article title',
]);
const READING_SKIP_FIELDS = new Set([
  '音标',
  'pinyin',
  'phiên âm',
  'vocabfurigana',
  '读音',
  'reading',
  'phonetic',
]);

function pickEditorFrontAndBackKeys(
  fieldKeys: string[],
  allFields: Record<string, string>
): { fKey: string; bKey: string } {
  const fKey =
    fieldKeys.find((k) => FRONT_ALIASES.includes(k) && (allFields[k] || '').trim()) ||
    fieldKeys.find((k) => FRONT_ALIASES.includes(k)) ||
    fieldKeys.find(
      (k) =>
        !METADATA_SKIP_FIELDS.has(k.trim().toLowerCase()) &&
        !READING_SKIP_FIELDS.has(k.trim().toLowerCase()) &&
        Boolean((allFields[k] || '').trim())
    ) ||
    fieldKeys.find((k) => !METADATA_SKIP_FIELDS.has(k.trim().toLowerCase())) ||
    fieldKeys[0] ||
    '正面';

  const bKey =
    fieldKeys.find(
      (k) => k !== fKey && BACK_ALIASES.includes(k) && (allFields[k] || '').trim()
    ) ||
    fieldKeys.find((k) => k !== fKey && BACK_ALIASES.includes(k)) ||
    fieldKeys.find(
      (k) =>
        k !== fKey &&
        !METADATA_SKIP_FIELDS.has(k.trim().toLowerCase()) &&
        !READING_SKIP_FIELDS.has(k.trim().toLowerCase()) &&
        Boolean((allFields[k] || '').trim())
    ) ||
    fieldKeys.find(
      (k) =>
        k !== fKey &&
        !METADATA_SKIP_FIELDS.has(k.trim().toLowerCase()) &&
        !READING_SKIP_FIELDS.has(k.trim().toLowerCase())
    ) ||
    fieldKeys.find((k) => k !== fKey) ||
    '背面';

  return { fKey, bKey };
}

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
    cmdKCardStyles,
    cmdKFrontCardStyles,
    libraryCardStyles,
    libraryFrontCardStyles,
  } = useAppStore();

  const isDark = theme === 'dark' || theme === 'oled';
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  // 正面输入框的占位提示里带挖空快捷键，必须随平台走（macOS `Cmd` / Windows·Linux `Ctrl`）。
  // 16 个语言包里该文案统一写成 `{shortcut}`，由这里注入，避免任何一端再写死 Cmd。
  const clozeShortcutStr = formatShortcut('Cmd+Shift+C', envInfo.platform);

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
  const [noteFieldOrder, setNoteFieldOrder] = useState<string[]>([]);
  const [allFieldsMap, setAllFieldsMap] = useState<Record<string, string>>({});
  const [originalFieldsMap, setOriginalFieldsMap] = useState<Record<string, string>>({});
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
  // 遮挡编辑器产出的原生 Image Occlusion 载荷；有值时正面正文改用摘要展示，
  // 提交时走 quick_add_card 的原生 IO 分支（1 张笔记 = 1 张卡）。
  const [ioPayload, setIoPayload] = useState<NativeOcclusionPayload | null>(null);

  // Interactive Card Preview State ('edit' vs 'preview')
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [previewFlipped, setPreviewFlipped] = useState(false);
  const [previewClozeOrd, setPreviewClozeOrd] = useState<number>(1);
  const [previewReverseDir, setPreviewReverseDir] = useState<'forward' | 'reverse'>('forward');

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

  // 词库 / 第三方卡包的模板 CSS 由后端按卡型去重下发（搜索接口的 cardStyles 字段），
  // 存在 store 里而不是塞进每张卡的 HTML——200 条结果里同卡型只占一份。
  // 编辑器预览本身不渲染 Anki 模板，必须按当前卡型把这份样式表取回来，否则
  // 从卡片库 / Cmd+K 打开的卡（尤其柯林斯、蓝宝书这类词库）预览会掉成无样式裸文本。
  const injectedCardStyle = useMemo(() => {
    const notetypeId = editingCardData?.notetypeId
      ? String(editingCardData.notetypeId)
      : '';
    if (!notetypeId) return '';
    return cmdKCardStyles[notetypeId] || libraryCardStyles[notetypeId] || '';
  }, [cmdKCardStyles, libraryCardStyles, editingCardData]);

  // 正面单独一份：保留模板 display:none，避免柯林斯详解/{{hint}} 在预览正面提前露出。
  const injectedFrontCardStyle = useMemo(() => {
    const notetypeId = editingCardData?.notetypeId
      ? String(editingCardData.notetypeId)
      : '';
    if (!notetypeId) return '';
    return (
      cmdKFrontCardStyles[notetypeId] ||
      libraryFrontCardStyles[notetypeId] ||
      cmdKCardStyles[notetypeId] ||
      libraryCardStyles[notetypeId] ||
      ''
    );
  }, [
    cmdKFrontCardStyles,
    libraryFrontCardStyles,
    cmdKCardStyles,
    libraryCardStyles,
    editingCardData,
  ]);

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

      const fieldKeys = editingCardData.fieldOrder || Object.keys(allFields);
      const { fKey, bKey } = pickEditorFrontAndBackKeys(fieldKeys, allFields);

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

      const resolvedFields: Record<string, string> = {};
      const orderedKeys: string[] = [];
      for (const k of fieldKeys) {
        if (!orderedKeys.includes(k)) orderedKeys.push(k);
        resolvedFields[k] = resolveMediaInHtml(allFields[k] ?? '', effectiveMediaBaseUrl);
      }
      for (const [k, v] of Object.entries(allFields)) {
        if (!orderedKeys.includes(k)) orderedKeys.push(k);
        if (!(k in resolvedFields)) {
          resolvedFields[k] = resolveMediaInHtml(v ?? '', effectiveMediaBaseUrl);
        }
      }

      setNoteFieldOrder(orderedKeys);
      setAllFieldsMap(resolvedFields);
      setOriginalFieldsMap({ ...resolvedFields });

      const extra: Record<string, string> = {};
      for (const [k, v] of Object.entries(allFields)) {
        if (k !== fKey && k !== bKey) {
          extra[k] = v;
        }
      }
      setAdditionalFields(extra);
      setShowMoreFields(orderedKeys.length >= 3 ? false : Object.keys(extra).length > 0);

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
      setNoteFieldOrder([]);
      setAllFieldsMap({});
      setOriginalFieldsMap({});
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
    setEditorMode('edit');
    setPreviewFlipped(false);
    setPreviewClozeOrd(1);
    setPreviewReverseDir('forward');
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

  const isMultiFieldEdit = isEditMode && noteFieldOrder.length >= 3;

  // Dirty state computation
  const hasChanges = useMemo(() => {
    if (!isEditMode) {
      return Boolean(front.trim() || back.trim() || tags.length > 0);
    }
    if (selectedDeckId !== originalSnapshot.deckId) return true;
    if (tags.length !== originalSnapshot.tags.length) return true;
    if (tags.some((tItem, idx) => tItem !== originalSnapshot.tags[idx])) return true;
    if (isMultiFieldEdit) {
      for (const k of noteFieldOrder) {
        if ((allFieldsMap[k] || '').trim() !== (originalFieldsMap[k] || '').trim()) {
          return true;
        }
      }
      return false;
    }
    if (front.trim() !== originalSnapshot.front.trim()) return true;
    if (back.trim() !== originalSnapshot.back.trim()) return true;
    return false;
  }, [
    front,
    back,
    tags,
    selectedDeckId,
    originalSnapshot,
    isEditMode,
    isMultiFieldEdit,
    noteFieldOrder,
    allFieldsMap,
    originalFieldsMap,
  ]);

  // Cloze indicator & distinct cloze ordinals (c1, c2, c3...)
  const clozeOrdinals = useMemo(() => {
    const combined = `${front}\n${back}`;
    const ords = new Set<number>();
    const re = /\{\{c(\d+)::/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(combined)) !== null) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) ords.add(n);
    }
    return Array.from(ords).sort((a, b) => a - b);
  }, [front, back]);

  const isCloze = useMemo(() => {
    return (
      selectedPreset === 'cloze' ||
      clozeOrdinals.length > 0 ||
      /data-cloze-ord/.test(front) ||
      /data-cloze-ord/.test(back)
    );
  }, [front, back, selectedPreset, clozeOrdinals]);

  const activePreviewClozeOrd = useMemo(() => {
    if (clozeOrdinals.length === 0) return 1;
    return clozeOrdinals.includes(previewClozeOrd) ? previewClozeOrd : clozeOrdinals[0];
  }, [clozeOrdinals, previewClozeOrd]);

  // Number of generated cards for preview badge (e.g., 2 for reversed, K for multi-cloze)
  const generatedCardCount = useMemo(() => {
    if (clozeOrdinals.length > 1) return clozeOrdinals.length;
    if (!isEditMode && selectedPreset === 'reversed') return 2;
    return 1;
  }, [clozeOrdinals, isEditMode, selectedPreset]);

  // Resolved Question & Answer HTML for Preview Stage
  const previewCardContent = useMemo(() => {
    const isReverseSecondCard =
      !isEditMode && selectedPreset === 'reversed' && previewReverseDir === 'reverse';
    // 遮挡卡的正文不在 front/back 里 —— 用户什么都没往输入框写，图片与遮罩全在
    // ioPayload 上（Occlusion 指令 + Image 字段）。所以预览必须优先取 previewHtml，
    // 否则正面只剩 placeholder、背面空白，看起来就是「预览是白板」。
    // previewHtml 里带的是 `.anki-io-wrap` + 原始 `{{c1::label}}`，交给下面的
    // renderMathAndRichHtml 才会按「问题=盖住 / 答案=揭晓」渲染成真实色块。
    const ioPreviewHtml = ioPayload ? ioPayload.previewHtml : '';
    const rawQ = resolveMediaInHtml(
      ioPreviewHtml || (isReverseSecondCard ? back : front),
      effectiveMediaBaseUrl
    );
    const rawA = resolveMediaInHtml(isReverseSecondCard ? front : back, effectiveMediaBaseUrl);

    const plainQ = rawQ
      .replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim();

    const hasInjectedCardStyle = Boolean(injectedCardStyle.trim());
    const hasInjectedFrontCardStyle = Boolean(injectedFrontCardStyle.trim());
    const hasBlockMarkup = /<(?:img|table|ul|ol|blockquote|pre|h[1-6])\b|anki-io-wrap/i.test(rawQ);
    const questionSizeClass = hasInjectedFrontCardStyle
      ? 'w-full text-start'
      : hasBlockMarkup
      ? 'text-[17px] leading-relaxed font-normal text-start w-full'
      : plainQ.length > 80
      ? 'text-[18px] leading-relaxed font-medium text-start w-full'
      : plainQ.length > 25
      ? 'text-[22px] leading-snug font-semibold text-center'
      : 'text-[28px] sm:text-[30px] leading-tight font-bold tracking-tight text-center';

    // 有模板样式时套上卡包自己的作用域容器：模板 CSS 一律以 `.card` 打底，
    // 少这一层就只剩插件的排版，等于样式注入了也一条都命中不了。
    // 正面/背面各用各的作用域根，两面同时出现时 display 规则不会互相覆盖。
    const wrapWithCardStyle = (html: string, css: string, front: boolean): string => {
      if (!css.trim() || !html || html.includes('anki-native-card')) return html;
      const rootClass = front ? 'anki-native-card anki-native-card-front' : 'anki-native-card';
      return `<div class="${rootClass}"><div class="card">${html}</div></div>`;
    };

    const questionHtml = wrapWithCardStyle(
      renderMathAndRichHtml(
        rawQ,
        !previewFlipped,
        clozeOrdinals.length > 0 ? activePreviewClozeOrd : undefined
      ),
      injectedFrontCardStyle,
      true
    );
    const answerHtml = wrapWithCardStyle(
      renderMathAndRichHtml(
        rawA,
        false,
        clozeOrdinals.length > 0 ? activePreviewClozeOrd : undefined
      ),
      injectedCardStyle,
      false
    );

    const populatedExtras = Object.entries(additionalFields).filter(([fKey, val]) => {
      if (!val || !val.trim()) return false;
      const kLower = fKey.trim().toLowerCase();
      if (
        kLower === 'noteid' ||
        kLower === 'note id' ||
        kLower === 'link' ||
        kLower === 'suborder' ||
        kLower === 'audio' ||
        kLower === 'vocabaudio'
      ) {
        return false;
      }
      const rendered = renderMathAndRichHtml(
        resolveMediaInHtml(val, effectiveMediaBaseUrl),
        false
      ).trim();
      return Boolean(rendered);
    });

    return {
      rawQ,
      rawA,
      plainQ,
      questionSizeClass,
      questionHtml,
      answerHtml,
      populatedExtras,
      hasInjectedCardStyle,
      hasInjectedFrontCardStyle,
    };
  }, [
    isEditMode,
    selectedPreset,
    previewReverseDir,
    front,
    back,
    effectiveMediaBaseUrl,
    previewFlipped,
    clozeOrdinals,
    activePreviewClozeOrd,
    additionalFields,
    injectedCardStyle,
    injectedFrontCardStyle,
    ioPayload,
  ]);

  const handleSelectNotePreset = (presetId: NoteCreationPreset, customModel?: NoteTypeOption) => {
    setSelectedPreset(presetId);
    setNoteTypeDropdownOpen(false);
    if (customModel && customModel.fields.length >= 1) {
      const dummyFields: Record<string, string> = {};
      for (const f of customModel.fields) dummyFields[f] = '';
      const { fKey, bKey } = pickEditorFrontAndBackKeys(customModel.fields, dummyFields);
      setFrontFieldName(fKey || '正面');
      setBackFieldName(bKey || '背面');
      const extra: Record<string, string> = {};
      for (const fName of customModel.fields) {
        if (fName !== fKey && fName !== bKey) {
          extra[fName] = additionalFields[fName] || '';
        }
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

  // Global keyboard shortcuts inside CardEditorModal (Space to flip in Preview mode, Escape to return to Edit mode)
  useEffect(() => {
    if (!quickAddOpen || ioEditorOpen || confirmDiscardOpen) return;
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (editorMode === 'preview') {
        const target = e.target as HTMLElement | null;
        const isInput =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (!isInput && (e.key === ' ' || e.key === 'Enter') && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setPreviewFlipped((prev) => !prev);
        } else if (!isInput && e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setEditorMode('edit');
        }
      }
    };
    window.addEventListener('keydown', onWindowKeyDown, true);
    return () => window.removeEventListener('keydown', onWindowKeyDown, true);
  }, [quickAddOpen, ioEditorOpen, confirmDiscardOpen, editorMode]);

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

  // 摘要里显示真实遮罩数。occlusions 是 Anki 原生指令串，一个遮罩 = 一个
  // `image-occlusion:rect:` 片段；卡数恒为 1 —— 同一 ordinal 的全部遮罩共用一个
  // 挖空组，Anki 只出一张卡（实测，见 edit_service._quick_add_image_occlusion）。
  const ioMaskCount = ioPayload
    ? (ioPayload.occlusions.match(/image-occlusion:rect:/g) || []).length
    : 0;

  const canSubmit = isMultiFieldEdit
    ? noteFieldOrder.some((k) => Boolean((allFieldsMap[k] || '').trim()))
    : Boolean(ioPayload?.occlusions) || Boolean(front.trim());

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    applyFormatting('cloze');

    try {
      if (isEditMode && editingCardData) {
        const mergedFields: Record<string, string> = {};
        if (isMultiFieldEdit) {
          for (const k of noteFieldOrder) {
            mergedFields[k] = (allFieldsMap[k] ?? '').trim();
          }
          for (const [k, v] of Object.entries(allFieldsMap)) {
            if (!(k in mergedFields)) mergedFields[k] = (v ?? '').trim();
          }
        } else {
          for (const [k, v] of Object.entries(additionalFields)) {
            mergedFields[k] = v.trim();
          }
          mergedFields[frontFieldName] = front.trim();
          mergedFields[backFieldName] = back.trim();
        }

        // 原生 Image Occlusion 笔记的 Occlusion/Image 是结构化字段，不能把编辑器里的
        // 文本直接塞回去（那会把 SVG 覆盖层写成一段 HTML）。按字段名精确回填。
        if (ioPayload) {
          const keyOf = (name: string) =>
            Object.keys(mergedFields).find((k) => k.trim().toLowerCase() === name);
          const occlKey = keyOf('occlusion');
          const imgKey = keyOf('image');
          const headerKey = keyOf('header');
          if (occlKey) mergedFields[occlKey] = ioPayload.occlusions;
          if (imgKey) mergedFields[imgKey] = ioPayload.image;
          if (headerKey) mergedFields[headerKey] = ioPayload.header;
        }

        const formattedFront = (mergedFields[frontFieldName] ?? front).trim();
        const formattedBack = (mergedFields[backFieldName] ?? back).trim();

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
          // 有遮挡载荷时后端走原生 Image Occlusion 分支，front/back 不参与建卡。
          imageOcclusion: ioPayload
            ? { ...ioPayload, backExtra: formattedBack }
            : undefined,
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
        <div className={`h-14 px-5 border-b flex items-center justify-between gap-2 shrink-0 ${cardBorder}`}>
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

          {/* Right Action & Close Buttons: Single Unified Cycling Button (View <-> Edit) + Close */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditorMode((prev) => {
                  const next = prev === 'edit' ? 'preview' : 'edit';
                  if (next === 'preview') setPreviewFlipped(false);
                  return next;
                });
              }}
              className={`h-7 px-3 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                editorMode === 'preview'
                  ? 'bg-[var(--brand-soft)] border-[var(--brand-border)] text-[var(--brand-text)]'
                  : isDark
                  ? 'border-[#343644] bg-[#21222E] hover:border-[var(--brand-border)] text-[#D8D8E0]'
                  : 'border-[#E0E0E6] bg-[#F4F4F6] hover:border-[var(--brand-border)] text-[#3A3A3C]'
              }`}
            >
              {editorMode === 'preview' ? (
                <>
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <span>{t('editBtnShort')}</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>{t('previewCardBtn')}</span>
                  {generatedCardCount > 1 && (
                    <span className="px-1 rounded text-[9px] font-mono font-bold bg-[var(--brand-soft-strong)] text-[var(--brand-text)]">
                      ×{generatedCardCount}
                    </span>
                  )}
                </>
              )}
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

        {/* Modal Body: Either Two Tower WYSIWYG Editor Blocks OR Reviewer-Grade Live Card Preview */}
        {editorMode === 'edit' ? (
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

            {isMultiFieldEdit ? (
              (() => {
                const populatedFieldKeys = noteFieldOrder.filter((k) =>
                  Boolean((allFieldsMap[k] || '').trim())
                );
                const emptyFieldKeys = noteFieldOrder.filter(
                  (k) => !(allFieldsMap[k] || '').trim()
                );

                const renderNoteField = (fKey: string) => {
                  const fVal = allFieldsMap[fKey] || '';
                  const isPrimaryRich = fKey === frontFieldName || fKey === backFieldName;
                  if (isPrimaryRich) {
                    const roleLabel =
                      fKey === frontFieldName
                        ? `${fKey} (${t('cardFrontLabel')})`
                        : `${fKey} (${t('cardBackLabel')})`;
                    return (
                      <TowerWysiwygEditor
                        key={fKey}
                        label={roleLabel}
                        badge={fKey === frontFieldName ? t('requiredBadge') : undefined}
                        value={fVal}
                        onChange={(val) => {
                          setAllFieldsMap((prev) => ({ ...prev, [fKey]: val }));
                          if (fKey === frontFieldName) setFront(val);
                          if (fKey === backFieldName) setBack(val);
                        }}
                        placeholder={t('editorBackPlaceholder')}
                        minHeight={115}
                        isDark={isDark}
                        accentColor={brandHex}
                        mediaBaseUrl={effectiveMediaBaseUrl}
                        onPasteImage={appActions.pasteImageFromClipboard}
                        onKeyDownShortcut={handleEditorKeyDown}
                        showCloze={true}
                        onOpenImageOcclusion={
                          fKey === frontFieldName ? () => setIoEditorOpen(true) : undefined
                        }
                        hasImageOcclusion={
                          fKey === frontFieldName ? fVal.includes('anki-io-wrap') : false
                        }
                      />
                    );
                  }

                  const isMultiLineOrHtml =
                    fVal.length > 80 ||
                    fVal.includes('\n') ||
                    /<(?:table|div|p|ul|ol|img|br)\b/i.test(fVal);

                  return (
                    <div key={fKey} className="space-y-1.5">
                      <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#A0A2B2]">
                        {fKey}
                      </label>
                      {isMultiLineOrHtml ? (
                        <textarea
                          rows={3}
                          value={fVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAllFieldsMap((prev) => ({ ...prev, [fKey]: val }));
                            setAdditionalFields((prev) => ({ ...prev, [fKey]: val }));
                          }}
                          className={`w-full py-2 px-3 rounded-xl border text-[13px] leading-relaxed focus:outline-none focus:border-[var(--brand)] resize-y ${inputBg} ${cardBorder}`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={fVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAllFieldsMap((prev) => ({ ...prev, [fKey]: val }));
                            setAdditionalFields((prev) => ({ ...prev, [fKey]: val }));
                          }}
                          className={`w-full h-9 px-3 rounded-xl border text-[13px] focus:outline-none focus:border-[var(--brand)] ${inputBg} ${cardBorder}`}
                        />
                      )}
                    </div>
                  );
                };

                return (
                  <div className="space-y-4">
                    {populatedFieldKeys.map((fKey) => renderNoteField(fKey))}

                    {emptyFieldKeys.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowMoreFields((prev) => !prev)}
                          className="text-[12px] font-semibold text-[var(--brand-text)] hover:underline flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{showMoreFields ? '▾' : '▸'}</span>
                          <span>{t('moreFieldsBtn', { n: emptyFieldKeys.length })}</span>
                        </button>

                        {showMoreFields && (
                          <div className="mt-3 space-y-3 ps-2.5 border-s-2 border-[var(--brand-border)]">
                            {emptyFieldKeys.map((fKey) => renderNoteField(fKey))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <>
                {/* Front WYSIWYG Box (Tower Editor — with Image Occlusion integrated in toolbar row) */}
                {ioPayload ? (
                  /* 遮挡模式：正面不再是自由文本，而是对已生成遮挡的摘要。
                     直接展示一张原生 Image Occlusion 笔记的承诺：整图 1 张卡。 */
                  <div className={`rounded-xl border p-3.5 space-y-2.5 ${inputBg} ${cardBorder}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-semibold flex items-center gap-2">
                        <span>{t('ioButtonLabel')}</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)] text-[10px] font-semibold">
                          {t('ioNativeBadge')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIoEditorOpen(true)}
                          className="text-[11px] font-semibold text-[var(--brand-text)] hover:underline cursor-pointer"
                        >
                          {t('ioReeditBtn')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIoPayload(null)}
                          className="text-[11px] font-semibold text-[var(--status-danger)] hover:underline cursor-pointer"
                        >
                          {t('ioRemoveBtn')}
                        </button>
                      </div>
                    </div>
                    {ioPayload.header ? (
                      <div className="text-[12px] text-[#6E6E73] dark:text-[#A0A2B2] break-words">
                        {ioPayload.header}
                      </div>
                    ) : null}
                    <div className="text-[11px] text-[#8E8E93]">
                      {t('ioMasksCountSummary', { rects: ioMaskCount, cards: 1 })}
                    </div>
                  </div>
                ) : (
                <TowerWysiwygEditor
                  label={`${frontFieldName} (${t('cardFrontLabel')})`}
                  badge={t('requiredBadge')}
                  value={front}
                  onChange={(val) => setFront(val)}
                  placeholder={t('editorFrontPlaceholder', { shortcut: clozeShortcutStr })}
                  minHeight={130}
                  isDark={isDark}
                  accentColor={brandHex}
                  mediaBaseUrl={effectiveMediaBaseUrl}
                  onPasteImage={appActions.pasteImageFromClipboard}
                  onKeyDownShortcut={handleEditorKeyDown}
                  showCloze={true}
                  onOpenImageOcclusion={() => setIoEditorOpen(true)}
                  hasImageOcclusion={front.includes('anki-io-wrap')}
                />
                )}

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

                {/* Additional Fields (New card / 2-field presets) */}
                {Object.keys(additionalFields).length > 0 && (() => {
                  const allEntries = Object.entries(additionalFields);
                  const nonEmptyEntries = allEntries.filter(([, v]) => Boolean(v && v.trim()));
                  const emptyEntries = allEntries.filter(([, v]) => !v || !v.trim());
                  const visibleEntries =
                    allEntries.length > 12
                      ? [...nonEmptyEntries, ...emptyEntries.slice(0, 4)]
                      : [...nonEmptyEntries, ...emptyEntries];
                  return (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowMoreFields((prev) => !prev)}
                        className="text-[12px] font-semibold text-[var(--brand-text)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>{showMoreFields ? '▾' : '▸'}</span>
                        <span>
                          {t('moreFieldsBtn', { n: nonEmptyEntries.length || allEntries.length })}
                        </span>
                      </button>

                      {showMoreFields && (
                        <div className="mt-3 space-y-3 ps-2 border-s-2 border-[var(--brand-border)]">
                          {visibleEntries.map(([fKey, fVal]) => {
                            const isMultiLineOrHtml =
                              fVal.length > 80 || fVal.includes('\n') || /<(?:table|div|p|ul|ol|img|br)\b/i.test(fVal);
                            return (
                              <div key={fKey} className="space-y-1">
                                <label className="block text-[11px] text-[#8E8E93] font-medium">{fKey}</label>
                                {isMultiLineOrHtml ? (
                                  <textarea
                                    rows={3}
                                    value={fVal}
                                    onChange={(e) =>
                                      setAdditionalFields((prev) => ({
                                        ...prev,
                                        [fKey]: e.target.value,
                                      }))
                                    }
                                    className={`w-full py-2 px-3 rounded-xl border text-[13px] leading-relaxed focus:outline-none focus:border-[var(--brand)] resize-y ${inputBg} ${cardBorder}`}
                                  />
                                ) : (
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
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
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
        ) : (
          <div
            className={`flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 ${
              isDark ? 'bg-[#12131A]' : 'bg-[#F5F6F9]'
            }`}
          >
            {/* Preview Control Bar: Multi-Cloze / Reversed Selector + Question/Answer Side Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Multi-Cloze / Image Occlusion Card Ordinal Selector */}
                {clozeOrdinals.length > 1 && (
                  <div
                    className={`h-7 p-0.5 rounded-lg border flex items-center gap-0.5 ${
                      isDark ? 'bg-[#1A1B24] border-[#2E3040]' : 'bg-white border-[#E4E4EA]'
                    }`}
                  >
                    {clozeOrdinals.map((ord) => {
                      const active = activePreviewClozeOrd === ord;
                      return (
                        <button
                          key={ord}
                          type="button"
                          onClick={() => {
                            setPreviewClozeOrd(ord);
                            setPreviewFlipped(false);
                          }}
                          className={`h-5.5 px-2 rounded-[6px] text-[11px] font-mono font-bold cursor-pointer transition-all ${
                            active
                              ? 'bg-[var(--brand)] text-white shadow-2xs'
                              : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'
                          }`}
                        >
                          c{ord}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Reversed Card Direction Selector */}
                {!isEditMode && selectedPreset === 'reversed' && (
                  <div
                    className={`h-7 p-0.5 rounded-lg border flex items-center gap-0.5 ${
                      isDark ? 'bg-[#1A1B24] border-[#2E3040]' : 'bg-white border-[#E4E4EA]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewReverseDir('forward');
                        setPreviewFlipped(false);
                      }}
                      className={`h-5.5 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-all ${
                        previewReverseDir === 'forward'
                          ? 'bg-[var(--brand)] text-white shadow-2xs'
                          : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'
                      }`}
                    >
                      1 · {frontFieldName} → {backFieldName}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewReverseDir('reverse');
                        setPreviewFlipped(false);
                      }}
                      className={`h-5.5 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-all ${
                        previewReverseDir === 'reverse'
                          ? 'bg-[var(--brand)] text-white shadow-2xs'
                          : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'
                      }`}
                    >
                      2 · {backFieldName} → {frontFieldName}
                    </button>
                  </div>
                )}

                {clozeOrdinals.length <= 1 && (isEditMode || selectedPreset !== 'reversed') && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#8E8E93]">
                    <span className="px-2 py-0.5 rounded-md font-medium bg-black/5 dark:bg-white/5 text-[#6E6E73] dark:text-[#A0A2B2]">
                      {currentDeck.name}
                    </span>
                    <span>·</span>
                    <span>{activePresetLabel}</span>
                  </div>
                )}
              </div>

              {/* Question / Answer Side Segmented Toggle */}
              <div
                className={`h-7 p-0.5 rounded-lg border flex items-center gap-0.5 ${
                  isDark ? 'bg-[#1A1B24] border-[#2E3040]' : 'bg-white border-[#E4E4EA]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setPreviewFlipped(false)}
                  className={`h-5.5 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-all ${
                    !previewFlipped
                      ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] shadow-2xs'
                      : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'
                  }`}
                >
                  {t('questionSideBadge')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFlipped(true)}
                  className={`h-5.5 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer transition-all ${
                    previewFlipped
                      ? 'bg-[var(--status-success-soft)] text-[var(--status-success)] shadow-2xs'
                      : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'
                  }`}
                >
                  {t('answerSideBadge')}
                </button>
              </div>
            </div>

            {/* Reviewer-Grade Flashcard Simulation Stage */}
            <div
              onClick={() => setPreviewFlipped((prev) => !prev)}
              className={`flex-1 min-h-[340px] rounded-2xl border p-6 sm:p-8 flex flex-col justify-between transition-all cursor-pointer select-text ui-card-enter ${
                isDark
                  ? 'bg-[#1A1B25] border-[#2A2C3B] shadow-[0_14px_38px_rgba(0,0,0,0.36)]'
                  : 'bg-white border-[#E6E8EF] shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
              }`}
            >
              {/* Top Meta Strip Inside Flashcard */}
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                      previewFlipped
                        ? 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                        : 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                    }`}
                  >
                    {previewFlipped ? t('answerSideBadge') : t('questionSideBadge')}
                  </span>

                  {clozeOrdinals.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-black/5 dark:bg-white/10 text-[#6E6E73] dark:text-[#A0A2B2]">
                      c{activePreviewClozeOrd}
                    </span>
                  )}
                </div>

                {/* Tags Pills on Card */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {tags.slice(0, 4).map((tg) => (
                      <span
                        key={tg}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/5 dark:bg-white/5 text-[#8E8E93]"
                      >
                        #{tg}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Card Body */}
              <div className="my-auto flex flex-col items-center justify-center w-full py-2">
                {isEditMode && !hasChanges && editingCardData?.backHtml ? (
                  (() => {
                    const nativeReplace = Boolean((editingCardData as ReviewCardItem).replaceFrontOnFlip);
                    const rawFrontHtml = editingCardData.frontHtml || '';
                    const rawBackHtml = editingCardData.backHtml || '';
                    // 复习卡的正/反 HTML 自带对应的 <style>（后端 wrap_card_with_styles
                    // 的产物，正面是 .anki-native-card-front、背面是 .anki-native-card）；
                    // 卡片库 / Cmd+K 来的词库卡没有——后端按卡型下发 cardStyles（背面，揭开隐藏）
                    // 与 cardFrontStyles（正面，保留 display:none），这里按面分别注入。
                    const frontHasStyle = /<style\b[^>]*>[\s\S]*?<\/style\s*>/i.test(rawFrontHtml);
                    const backHasStyle = /<style\b[^>]*>[\s\S]*?<\/style\s*>/i.test(rawBackHtml);
                    const frontCssToInject = frontHasStyle
                      ? ''
                      : injectedFrontCardStyle || injectedCardStyle;
                    const backCssToInject = backHasStyle ? '' : injectedCardStyle;
                    const wrapWithCardStyle = (html: string, css: string, front: boolean): string => {
                      if (!css.trim() || !html || html.includes('anki-native-card')) return html;
                      const rootClass = front
                        ? 'anki-native-card anki-native-card-front'
                        : 'anki-native-card';
                      return `<div class="${rootClass}"><div class="card">${html}</div></div>`;
                    };
                    const nativeFrontHtml = resolveMediaInHtml(
                      wrapWithCardStyle(rawFrontHtml, frontCssToInject, true),
                      effectiveMediaBaseUrl
                    );
                    const nativeBackHtml = resolveMediaInHtml(
                      wrapWithCardStyle(rawBackHtml, backCssToInject, false),
                      effectiveMediaBaseUrl
                    );
                    return (
                      <>
                        {frontCssToInject ? (
                          <style dangerouslySetInnerHTML={{ __html: frontCssToInject }} />
                        ) : null}
                        {backCssToInject && backCssToInject !== frontCssToInject ? (
                          <style dangerouslySetInnerHTML={{ __html: backCssToInject }} />
                        ) : null}
                        {!(previewFlipped && nativeReplace) && (
                          <div
                            className="w-full select-text break-words text-[17px] leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: nativeFrontHtml }}
                          />
                        )}
                        {previewFlipped && (
                          <div
                            className={`w-full select-text break-words text-[16px] leading-relaxed ui-answer-reveal ${
                              nativeReplace ? '' : 'mt-6 pt-6 relative'
                            }`}
                          >
                            {!nativeReplace && (
                              <div
                                aria-hidden="true"
                                className={`absolute inset-x-0 top-0 border-t ${cardBorder} ui-divider-reveal`}
                              />
                            )}
                            <div dangerouslySetInnerHTML={{ __html: nativeBackHtml }} />
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <>
                    {previewCardContent.hasInjectedFrontCardStyle ? (
                      <style dangerouslySetInnerHTML={{ __html: injectedFrontCardStyle }} />
                    ) : null}
                    {previewCardContent.hasInjectedCardStyle &&
                    injectedCardStyle !== injectedFrontCardStyle ? (
                      <style dangerouslySetInnerHTML={{ __html: injectedCardStyle }} />
                    ) : null}
                    {previewCardContent.rawQ.trim() ? (
                      <div
                        className={`select-text break-words [&_img]:max-h-64 [&_img]:rounded-xl [&_img]:mx-auto [&_img]:my-2 [&_blockquote]:border-s-[3px] [&_blockquote]:border-[var(--brand)] [&_blockquote]:ps-3 [&_blockquote]:my-2 [&_blockquote]:text-[#8E8E93] [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-2 [&_pre]:bg-black/5 dark:[&_pre]:bg-white/5 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-[13px] ${previewCardContent.questionSizeClass}`}
                        dangerouslySetInnerHTML={{
                          __html: previewCardContent.questionHtml,
                        }}
                      />
                    ) : (
                      <div className="text-[14px] text-[#8E8E93] italic py-8 text-center">
                        {t('editorFrontPlaceholder', { shortcut: clozeShortcutStr })}
                      </div>
                    )}

                    {/* Answer Reveal Section */}
                    {previewFlipped && (
                      <div className="w-full mt-6 pt-6 relative space-y-4 text-start ui-answer-reveal">
                        <div
                          aria-hidden="true"
                          className={`absolute inset-x-0 top-0 border-t ${cardBorder} ui-divider-reveal`}
                        />

                        {previewCardContent.rawA.trim() ? (
                          <div
                            className="text-[16px] sm:text-[17px] leading-relaxed font-medium select-text break-words [&_img]:max-h-64 [&_img]:rounded-xl [&_img]:my-2 [&_blockquote]:border-s-[3px] [&_blockquote]:border-[var(--brand)] [&_blockquote]:ps-3 [&_blockquote]:my-2 [&_blockquote]:text-[#8E8E93] [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-2 [&_pre]:bg-black/5 dark:[&_pre]:bg-white/5 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-[13px]"
                            dangerouslySetInnerHTML={{
                              __html: previewCardContent.answerHtml,
                            }}
                          />
                        ) : !isCloze && !front.includes('anki-io-wrap') && !ioPayload ? (
                          <div className="text-[13px] text-[#8E8E93] italic">
                            {t('noBackContentPlaceholder')}
                          </div>
                        ) : null}

                        {/* Additional Custom Fields (Reading / Etymology / Example / Notes) */}
                        {previewCardContent.populatedExtras.length > 0 && (
                          <div className="grid grid-cols-1 gap-2.5 pt-2">
                            {previewCardContent.populatedExtras.map(([fKey, fVal]) => (
                              <div
                                key={fKey}
                                className={`p-3 rounded-xl border text-[13px] ${
                                  isDark
                                    ? 'bg-[#14151E] border-[#282A38]'
                                    : 'bg-[#F8F9FB] border-[#ECEEF4]'
                                }`}
                              >
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text)] mb-1">
                                  {fKey}
                                </div>
                                <div
                                  className="leading-relaxed text-[#3A3A3C] dark:text-[#D5D6E0]"
                                  dangerouslySetInnerHTML={{
                                    __html: renderMathAndRichHtml(
                                      resolveMediaInHtml(fVal, effectiveMediaBaseUrl),
                                      false
                                    ),
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bottom Recall Prompt / Flip Action Bar inside Flashcard */}
              <div className={`pt-4 mt-4 border-t border-dashed ${cardBorder} flex items-center justify-between gap-2 text-[11px] text-[#8E8E93]`}>
                <span className="truncate">{t('recallPrompt')}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewFlipped((prev) => !prev);
                  }}
                  className="h-7 px-3 rounded-lg font-semibold text-[11px] bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-strong)] text-[var(--brand-text)] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <span>{previewFlipped ? t('questionSideBadge') : t('showAnswerBtn')}</span>
                  <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/5 dark:bg-white/10">
                    Space
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Action Bar */}
        <div
          className={`h-14 px-5 border-t flex items-center justify-between shrink-0 ${cardBorder} ${
            isDark ? 'bg-[#13141C]' : 'bg-[#FAFAFC]'
          }`}
        >
          {/* Left Status (Unsaved changes badge only — no duplicate preview button) */}
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
              disabled={!canSubmit || submitting}
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
          initialFrontHtml={ioPayload ? ioPayload.previewHtml : front}
          isDark={isDark}
          brandHex={brandHex}
          mediaBaseUrl={effectiveMediaBaseUrl}
          onSaveImageFile={appActions.pasteImageFromClipboard}
          onClose={() => setIoEditorOpen(false)}
          onApply={(payload, cardCount) => {
            setIoPayload(payload);
            setIoEditorOpen(false);
            showToast(t('ioApplyBtn', { cards: cardCount }));
          }}
        />
      </div>
    </div>
  );
};
