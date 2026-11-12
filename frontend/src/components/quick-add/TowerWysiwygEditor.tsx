import React, { useEffect, useRef, useState } from 'react';
import { formatShortcut, translate } from '../../i18n/translations';
import { useAppStore } from '../../stores/useAppStore';
import { resolveMediaInHtml } from '../../utils/mediaUrl';

export interface TowerWysiwygEditorProps {
  label: string;
  badge?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  isDark?: boolean;
  accentColor?: string;
  mediaBaseUrl?: string;
  onPasteImage?: (file: File) => Promise<string | null>;
  onKeyDownShortcut?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  showCloze?: boolean;
  onOpenImageOcclusion?: () => void;
  hasImageOcclusion?: boolean;
}

const ZWSP = '\u200B';

function findClosestElement(
  node: Node | null,
  selector: string,
  boundary?: HTMLElement | null
): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== boundary) {
    if (cur.nodeType === Node.ELEMENT_NODE && (cur as HTMLElement).matches(selector)) {
      return cur as HTMLElement;
    }
    cur = cur.parentNode;
  }
  return null;
}

function buildClozePillHtml(ord: string | number, rawAns: string, hint?: string): string {
  const cleanAns = rawAns.replace(/\u200B/g, '');
  const isEmpty = cleanAns.trim().length === 0;
  const hintAttr = hint ? ` data-cloze-hint="${hint}"` : '';
  const hintDisplay = hint ? ` (${hint})` : '';
  const bodyContent = isEmpty ? ZWSP : `${cleanAns}${hintDisplay}`;
  const emptyAttr = isEmpty ? ' data-empty="true"' : '';
  return `<span class="anki-cloze-pill" data-cloze-ord="${ord}"${hintAttr}><span class="anki-cloze-prefix" contenteditable="false">c${ord}:</span><span class="anki-cloze-body"${emptyAttr}>${bodyContent}</span></span>${ZWSP}`;
}

/**
 * Deserializes raw card field HTML into visual WYSIWYG markup:
 * Resolves relative `<img src>` filenames against `mediaBaseUrl` and converts
 * Anki Cloze syntax `{{c1::answer}}` into visually highlighted Cloze badges.
 */
function deserializeToWysiwyg(raw: string, mediaBaseUrl?: string): string {
  if (!raw || !raw.trim()) return '';
  let html = resolveMediaInHtml(raw, mediaBaseUrl);

  // Convert standalone newlines into <br> if no block tags present
  if (!/<(p|div|br|ul|ol|li|h[1-6]|table|blockquote)\b/i.test(html) && html.includes('\n')) {
    html = html.replace(/\r\n|\r|\n/g, '<br>');
  }

  // Convert {{c1::answer::hint}} or {{c1::answer}} to visual cloze pills styled via .anki-cloze-pill
  html = html.replace(/\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (_, cNum, ans, hint) => {
    return buildClozePillHtml(cNum, ans, hint);
  });

  return html;
}

/**
 * Serializes editor HTML back to pure, standard Anki note field content:
 * Replaces visual cloze pills back into standard {{c1::answer}} syntax,
 * removes empty ghost pills/marks, and strips internal zero-width space cursor anchors.
 */
function serializeFromWysiwyg(container: HTMLElement): string {
  if (!container) return '';
  const clone = container.cloneNode(true) as HTMLElement;

  const pills = clone.querySelectorAll('.anki-cloze-pill');
  pills.forEach((pill) => {
    const ord = pill.getAttribute('data-cloze-ord') || '1';
    const hint = pill.getAttribute('data-cloze-hint');
    const bodyEl = pill.querySelector('.anki-cloze-body');
    let text = '';
    if (bodyEl) {
      text = bodyEl.textContent || '';
    } else {
      const clonePill = pill.cloneNode(true) as HTMLElement;
      clonePill.querySelectorAll('.anki-cloze-prefix').forEach((p) => p.remove());
      text = clonePill.textContent || '';
    }
    text = text.replace(/\u200B/g, '').replace(new RegExp(`^c${ord}:\\s*`), '');
    if (hint && text.endsWith(`(${hint})`)) {
      text = text.slice(0, -`(${hint})`.length).trimEnd();
    }
    if (!text.trim()) {
      pill.parentNode?.removeChild(pill);
      return;
    }
    const ankiCloze = hint ? `{{c${ord}::${text}::${hint}}}` : `{{c${ord}::${text}}}`;
    const textNode = document.createTextNode(ankiCloze);
    pill.parentNode?.replaceChild(textNode, pill);
  });

  // Unwrap empty <mark> placeholders or strip data-empty attributes
  clone.querySelectorAll('mark').forEach((mk) => {
    const clean = (mk.textContent || '').replace(/\u200B/g, '');
    if (!clean.trim()) {
      mk.parentNode?.removeChild(mk);
    } else {
      mk.removeAttribute('data-empty');
    }
  });

  const serialized = clone.innerHTML.replace(/\u200B/g, '');
  if (serialized === '<br>' || serialized === '<p><br></p>') {
    return '';
  }
  return serialized;
}

function computeVisibleCharCount(container: HTMLElement | null): number {
  if (!container) return 0;
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.anki-cloze-prefix').forEach((p) => p.remove());
  const rawText = (clone.textContent || '').replace(/\u200B/g, '');
  return rawText.length;
}

const STUDY_EMOJIS = [
  '💡', '⭐', '⚠️', '📌', '✅',
  '❌', '📝', '🔍', '🎯', '🚀',
  '📚', '🧠', '🔥', '💎', '⏳',
  '🔗', '❓', '❗', '🎉', '💪',
];

interface ActiveFormats {
  heading: '' | 'h1' | 'h2' | 'h3';
  bold: boolean;
  italic: boolean;
  orderedList: boolean;
  unorderedList: boolean;
  blockquote: boolean;
  code: boolean;
  cloze: boolean;
  mark: boolean;
}

export const TowerWysiwygEditor: React.FC<TowerWysiwygEditorProps> = ({
  label,
  badge,
  value,
  onChange,
  placeholder,
  minHeight = 130,
  isDark = false,
  mediaBaseUrl,
  onPasteImage,
  onKeyDownShortcut,
  showCloze = true,
  onOpenImageOcclusion,
  hasImageOcclusion = false,
}) => {
  const { resolvedLang, envInfo } = useAppStore();
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const anyDropdownOpenRef = useRef(false);
  const isComposingRef = useRef(false);

  // Dropdown states
  const [headingOpen, setHeadingOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Active formatting states for toolbar visual feedback
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    heading: '',
    bold: false,
    italic: false,
    orderedList: false,
    unorderedList: false,
    blockquote: false,
    code: false,
    cloze: false,
    mark: false,
  });

  // Character count
  const [charCount, setCharCount] = useState(0);

  // Track initial value loaded to avoid cursor jumps
  const lastLoadedValueRef = useRef<string | null>(null);
  const lastLoadedMediaBaseRef = useRef<string | undefined>(undefined);

  const closeAllDropdowns = () => {
    setHeadingOpen(false);
    setEmojiOpen(false);
    setAlignOpen(false);
    setTableOpen(false);
    setHelpOpen(false);
  };

  const toggleDropdown = (which: 'heading' | 'emoji' | 'align' | 'table' | 'help') => {
    setHeadingOpen((prev) => (which === 'heading' ? !prev : false));
    setEmojiOpen((prev) => (which === 'emoji' ? !prev : false));
    setAlignOpen((prev) => (which === 'align' ? !prev : false));
    setTableOpen((prev) => (which === 'table' ? !prev : false));
    setHelpOpen((prev) => (which === 'help' ? !prev : false));
  };

  /**
   * Reads the authoritative formatting state at the current selection.
   * IMPORTANT: For `bold`, `italic`, `insertOrderedList`, and `insertUnorderedList`,
   * we MUST rely on `document.queryCommandState(...)` WITHOUT overriding it with
   * `findClosestElement(anchor, 'b, strong') || ...`!
   * Why: When the caret is at the end of `<b>word|</b>` and the user clicks `B` to turn off bold,
   * the browser flips its internal typing-style override (`queryCommandState('bold') === false`)
   * while `sel.anchorNode` still sits inside `<b>` until the next character is typed.
   */
  const updateActiveFormats = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const anchor = sel.anchorNode;
    if (!anchor || !editorRef.current.contains(anchor)) return;

    const headingEl = findClosestElement(anchor, 'h1, h2, h3', editorRef.current);
    const headingTag = headingEl ? (headingEl.tagName.toLowerCase() as 'h1' | 'h2' | 'h3') : '';

    const inCloze = Boolean(findClosestElement(anchor, '.anki-cloze-pill', editorRef.current));
    const inMark = Boolean(findClosestElement(anchor, 'mark', editorRef.current));
    const inBlockquote = Boolean(findClosestElement(anchor, 'blockquote', editorRef.current));
    const inCode = Boolean(findClosestElement(anchor, 'pre, code', editorRef.current));

    let inBold = false;
    let inItalic = false;
    let inOl = false;
    let inUl = false;
    try {
      inBold = Boolean(document.queryCommandState('bold'));
      inItalic = Boolean(document.queryCommandState('italic'));
      inOl = Boolean(document.queryCommandState('insertOrderedList'));
      inUl = Boolean(document.queryCommandState('insertUnorderedList'));
    } catch {
      inBold = Boolean(findClosestElement(anchor, 'b, strong', editorRef.current));
      inItalic = Boolean(findClosestElement(anchor, 'i, em', editorRef.current));
      inOl = Boolean(findClosestElement(anchor, 'ol', editorRef.current));
      inUl = Boolean(findClosestElement(anchor, 'ul', editorRef.current));
    }

    setActiveFormats({
      heading: headingTag,
      bold: inBold,
      italic: inItalic,
      orderedList: inOl,
      unorderedList: inUl,
      blockquote: inBlockquote,
      code: inCode,
      cloze: inCloze,
      mark: inMark,
    });
  };

  const saveSelectionRange = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
      updateActiveFormats();
    }
  };

  const placeCaret = (node: Node, offset: number) => {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStart(node, offset);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    savedRangeRef.current = r.cloneRange();
    updateActiveFormats();
  };

  /**
   * Ensures there is a valid outside Text node immediately after an inline pill
   * (`.anki-cloze-pill` or `<mark>`) and moves the caret outside the pill.
   * If the pill itself is completely empty, removes it cleanly so no empty shell remains.
   */
  const exitInlinePill = (pillEl: HTMLElement, insertTrailingSpace = false) => {
    if (!editorRef.current) return;
    const parent = pillEl.parentNode;
    if (!parent) return;

    const bodyEl = pillEl.matches('.anki-cloze-pill')
      ? (pillEl.querySelector('.anki-cloze-body') as HTMLElement | null)
      : pillEl;
    const clean = (bodyEl ? bodyEl.textContent || '' : pillEl.textContent || '')
      .replace(/\u200B/g, '')
      .trim();

    if (clean.length === 0) {
      const prev = pillEl.previousSibling;
      const next = pillEl.nextSibling;
      pillEl.remove();
      if (next && next.nodeType === Node.TEXT_NODE) {
        placeCaret(next, Math.min(1, (next as Text).data.length));
      } else if (prev && prev.nodeType === Node.TEXT_NODE) {
        placeCaret(prev, (prev as Text).data.length);
      } else {
        const anchor = document.createTextNode(ZWSP);
        parent.appendChild(anchor);
        placeCaret(anchor, 1);
      }
      return;
    }

    if (bodyEl) {
      bodyEl.removeAttribute('data-empty');
    }

    const next = pillEl.nextSibling;
    const suffix = insertTrailingSpace ? `${ZWSP} ` : ZWSP;
    if (next && next.nodeType === Node.TEXT_NODE) {
      const tNode = next as Text;
      if (!tNode.data.startsWith(ZWSP) && tNode.data.length === 0) {
        tNode.insertData(0, suffix);
        placeCaret(tNode, suffix.length);
      } else if (insertTrailingSpace) {
        const pos = tNode.data.startsWith(ZWSP) ? 1 : 0;
        tNode.insertData(pos, ' ');
        placeCaret(tNode, pos + 1);
      } else {
        const pos = tNode.data.startsWith(ZWSP) ? 1 : 0;
        placeCaret(tNode, pos);
      }
    } else {
      const outsideText = document.createTextNode(suffix);
      parent.insertBefore(outsideText, next);
      placeCaret(outsideText, suffix.length);
    }
  };

  /**
   * Synchronizes `data-empty` attributes on `.anki-cloze-body` and `<mark>` in-place
   * without destroying active Text nodes or interrupting IME composition.
   */
  const syncInlinePillsInPlace = (stripExtraZwsp: boolean) => {
    if (!editorRef.current) return;
    const bodies = editorRef.current.querySelectorAll('.anki-cloze-body, mark');
    bodies.forEach((el) => {
      const raw = el.textContent || '';
      const visible = raw.replace(/\u200B/g, '');
      if (visible.length === 0) {
        el.setAttribute('data-empty', 'true');
        if (raw.length === 0 && !isComposingRef.current) {
          el.appendChild(document.createTextNode(ZWSP));
        }
      } else {
        el.removeAttribute('data-empty');
        // Strip ZWSP in-place using CharacterData.deleteData so selection & IME are never reset
        if (stripExtraZwsp && !isComposingRef.current && raw.includes(ZWSP)) {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let tNode = walker.nextNode() as Text | null;
          while (tNode) {
            let idx = tNode.data.indexOf(ZWSP);
            while (idx !== -1) {
              tNode.deleteData(idx, 1);
              idx = tNode.data.indexOf(ZWSP);
            }
            tNode = walker.nextNode() as Text | null;
          }
        }
      }
    });
  };

  /**
   * Restores focus and selection ONLY when the editor does not already own the active selection.
   * Calling `sel.removeAllRanges(); sel.addRange(...)` unconditionally when the editor is already
   * focused would wipe out Chromium's pending typing-style state (`execCommand('bold')` toggle)!
   */
  const focusAndRestoreSelection = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (
      document.activeElement === editorRef.current &&
      sel &&
      sel.rangeCount > 0 &&
      editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)
    ) {
      return;
    }

    editorRef.current.focus();
    if (!sel) return;

    if (
      savedRangeRef.current &&
      editorRef.current.contains(savedRangeRef.current.commonAncestorContainer)
    ) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
  };

  useEffect(() => {
    if (!editorRef.current || isComposingRef.current) return;
    const currentSerialized = serializeFromWysiwyg(editorRef.current);
    const mediaBaseChanged =
      Boolean(mediaBaseUrl) && mediaBaseUrl !== lastLoadedMediaBaseRef.current;
    if (lastLoadedValueRef.current === null || value !== currentSerialized || mediaBaseChanged) {
      editorRef.current.innerHTML = deserializeToWysiwyg(value, mediaBaseUrl);
      lastLoadedValueRef.current = value;
      lastLoadedMediaBaseRef.current = mediaBaseUrl;
      setCharCount(computeVisibleCharCount(editorRef.current));
    }
  }, [value, mediaBaseUrl]);

  const handleInput = () => {
    if (!editorRef.current) return;
    if (isComposingRef.current) {
      syncInlinePillsInPlace(false);
      setCharCount(computeVisibleCharCount(editorRef.current));
      return;
    }
    syncInlinePillsInPlace(true);
    saveSelectionRange();
    const serialized = serializeFromWysiwyg(editorRef.current);
    lastLoadedValueRef.current = serialized;
    setCharCount(computeVisibleCharCount(editorRef.current));
    onChange(serialized);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    handleInput();
  };

  useEffect(() => {
    anyDropdownOpenRef.current =
      headingOpen || emojiOpen || alignOpen || tableOpen || helpOpen;
  }, [headingOpen, emojiOpen, alignOpen, tableOpen, helpOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
        return;
      }
      closeAllDropdowns();
    };
    // 捕获阶段消费 Esc：仅当有浮层打开时才拦截，
    // 否则 Esc 会既关下拉又冒泡到制卡弹窗，把整个编辑流程一起关掉
    const handleKeyDownEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !anyDropdownOpenRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      closeAllDropdowns();
    };
    const handleSelectionChange = () => {
      if (!editorRef.current || document.activeElement !== editorRef.current) return;
      saveSelectionRange();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDownEscape, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDownEscape, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const execCmd = (command: string, arg: string | undefined = undefined) => {
    if (!editorRef.current) return;
    focusAndRestoreSelection();
    document.execCommand(command, false, arg);
    updateActiveFormats();
    handleInput();
  };

  const toggleBlockTag = (tag: 'blockquote' | 'pre') => {
    if (!editorRef.current) return;
    focusAndRestoreSelection();
    const sel = window.getSelection();
    const anchor = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
    const activeBlock = findClosestElement(anchor, tag, editorRef.current);
    if (activeBlock) {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, `<${tag}>`);
    }
    updateActiveFormats();
    handleInput();
  };

  const setHeading = (tag: '<p>' | '<h1>' | '<h2>' | '<h3>') => {
    if (!editorRef.current) return;
    focusAndRestoreSelection();
    const targetTag = tag.replace(/[<>]/g, '').toLowerCase();
    // Clicking the already-active heading level toggles back to normal paragraph <p>
    if (targetTag !== 'p' && activeFormats.heading === targetTag) {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, tag);
    }
    setHeadingOpen(false);
    updateActiveFormats();
    handleInput();
  };

  const insertEmoji = (emoji: string) => {
    if (!editorRef.current) return;
    focusAndRestoreSelection();
    const inserted = document.execCommand('insertText', false, emoji);
    if (!inserted) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(emoji);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editorRef.current.appendChild(document.createTextNode(emoji));
      }
    }
    setEmojiOpen(false);
    handleInput();
  };

  const insertTable = (rows = 2, cols = 3) => {
    if (!editorRef.current) return;
    focusAndRestoreSelection();

    const borderColor = isDark ? '#343646' : '#E5E5EA';
    const thBg = isDark ? '#21222E' : '#F5F5F7';

    const table = document.createElement('table');
    table.style.cssText = `width:100%; border-collapse:collapse; margin:10px 0; border:1px solid ${borderColor};`;

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    let firstCell: HTMLElement | null = null;
    for (let c = 0; c < cols; c++) {
      const th = document.createElement('th');
      th.style.cssText = `border:1px solid ${borderColor}; padding:6px 10px; background:${thBg}; text-align:start; font-size:13px; min-width:48px;`;
      th.appendChild(document.createElement('br'));
      if (c === 0) firstCell = th;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.style.cssText = `border:1px solid ${borderColor}; padding:6px 10px; font-size:13px; min-width:48px;`;
        td.appendChild(document.createElement('br'));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const trailingP = document.createElement('p');
    trailingP.appendChild(document.createElement('br'));

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(trailingP);
      range.insertNode(table);
    } else {
      editorRef.current.appendChild(table);
      editorRef.current.appendChild(trailingP);
    }

    setTableOpen(false);
    if (firstCell) {
      placeCaret(firstCell, 0);
    }
    handleInput();
  };

  const insertClozeBadge = (reuseLastOrd = false) => {
    if (!editorRef.current) return;
    focusAndRestoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      editorRef.current.focus();
      return;
    }

    const existingPill = findClosestElement(
      range.commonAncestorContainer,
      '.anki-cloze-pill',
      editorRef.current
    );
    if (existingPill) {
      const bodyEl = existingPill.querySelector('.anki-cloze-body');
      const cleanText = (bodyEl ? bodyEl.textContent : existingPill.textContent || '')
        .replace(/\u200B/g, '')
        .trim();
      if (!range.collapsed || cleanText.length === 0) {
        const plainNode = document.createTextNode(cleanText);
        existingPill.parentNode?.replaceChild(plainNode, existingPill);
        placeCaret(plainNode, plainNode.data.length);
      } else {
        exitInlinePill(existingPill, false);
      }
      handleInput();
      return;
    }

    const selectedText = range.toString().replace(/\u200B/g, '').trim();

    const existingPills = editorRef.current.querySelectorAll('.anki-cloze-pill');
    let maxIdx = 0;
    existingPills.forEach((p) => {
      const ord = parseInt(p.getAttribute('data-cloze-ord') || '0', 10);
      if (ord > maxIdx) maxIdx = ord;
    });
    const nextIdx = reuseLastOrd && maxIdx >= 1 ? maxIdx : maxIdx + 1;

    const pill = document.createElement('span');
    pill.className = 'anki-cloze-pill';
    pill.setAttribute('data-cloze-ord', String(nextIdx));

    const prefix = document.createElement('span');
    prefix.className = 'anki-cloze-prefix';
    prefix.setAttribute('contenteditable', 'false');
    prefix.textContent = `c${nextIdx}:`;

    const body = document.createElement('span');
    body.className = 'anki-cloze-body';
    const bodyTextNode = document.createTextNode(selectedText || ZWSP);
    if (!selectedText) {
      body.setAttribute('data-empty', 'true');
    }
    body.appendChild(bodyTextNode);

    pill.appendChild(prefix);
    pill.appendChild(body);

    const outsideTextNode = document.createTextNode(ZWSP);

    range.deleteContents();
    range.insertNode(outsideTextNode);
    range.insertNode(pill);

    if (selectedText) {
      placeCaret(outsideTextNode, 1);
    } else {
      placeCaret(bodyTextNode, bodyTextNode.data.length);
    }

    handleInput();
  };

  const insertMath = () => {
    if (!editorRef.current) return;
    focusAndRestoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    const selected = range.toString().replace(/\u200B/g, '').trim();
    range.deleteContents();

    if (selected) {
      const mathNode = document.createTextNode(`\\( ${selected} \\)`);
      range.insertNode(mathNode);
      placeCaret(mathNode, mathNode.data.length);
    } else {
      const mathNode = document.createTextNode('\\(  \\)');
      range.insertNode(mathNode);
      placeCaret(mathNode, 3);
    }
    handleInput();
  };

  const insertMark = () => {
    if (!editorRef.current) return;
    focusAndRestoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    const existingMark = findClosestElement(
      range.commonAncestorContainer,
      'mark',
      editorRef.current
    );
    if (existingMark) {
      const cleanText = (existingMark.textContent || '').replace(/\u200B/g, '');
      if (!range.collapsed || cleanText.trim().length === 0) {
        const plainNode = document.createTextNode(cleanText);
        existingMark.parentNode?.replaceChild(plainNode, existingMark);
        placeCaret(plainNode, plainNode.data.length);
      } else {
        exitInlinePill(existingMark, false);
      }
      handleInput();
      return;
    }

    const selected = range.toString().replace(/\u200B/g, '').trim();
    const markEl = document.createElement('mark');
    markEl.style.cssText = `background:${
      isDark ? 'rgba(224, 147, 62, 0.28)' : '#FDF3E7'
    }; padding:1px 5px; border-radius:4px; color:inherit;`;
    const markTextNode = document.createTextNode(selected || ZWSP);
    if (!selected) {
      markEl.setAttribute('data-empty', 'true');
    }
    markEl.appendChild(markTextNode);

    const outsideTextNode = document.createTextNode(ZWSP);
    range.deleteContents();
    range.insertNode(outsideTextNode);
    range.insertNode(markEl);

    if (selected) {
      placeCaret(outsideTextNode, 1);
    } else {
      placeCaret(markTextNode, markTextNode.data.length);
    }
    handleInput();
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file && onPasteImage) {
            const imgHtml = await onPasteImage(file);
            if (imgHtml && editorRef.current) {
              focusAndRestoreSelection();
              document.execCommand('insertHTML', false, imgHtml);
              handleInput();
            }
          }
          return;
        }
      }
    }

    const plainText = e.clipboardData?.getData('text/plain') || '';
    if (/\{\{c\d+::/.test(plainText) && editorRef.current) {
      e.preventDefault();
      focusAndRestoreSelection();
      const escaped = plainText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const deserialized = deserializeToWysiwyg(escaped, mediaBaseUrl);
      document.execCommand('insertHTML', false, deserialized);
      handleInput();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onPasteImage && editorRef.current) {
      const imgHtml = await onPasteImage(file);
      if (imgHtml) {
        focusAndRestoreSelection();
        document.execCommand('insertHTML', false, imgHtml);
        handleInput();
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditorMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editorRef.current) return;

    const target = e.target as HTMLElement | null;
    const prefixEl = target ? findClosestElement(target, '.anki-cloze-prefix', editorRef.current) : null;
    if (prefixEl) {
      e.preventDefault();
      const pill = findClosestElement(prefixEl, '.anki-cloze-pill', editorRef.current);
      if (pill) {
        const allPills = editorRef.current.querySelectorAll('.anki-cloze-pill');
        let maxOrd = 1;
        allPills.forEach((p) => {
          const n = parseInt(p.getAttribute('data-cloze-ord') || '1', 10);
          if (n > maxOrd) maxOrd = n;
        });
        const curOrd = parseInt(pill.getAttribute('data-cloze-ord') || '1', 10);
        const nextOrd = curOrd >= maxOrd + 1 ? 1 : curOrd + 1;
        pill.setAttribute('data-cloze-ord', String(nextOrd));
        prefixEl.textContent = `c${nextOrd}:`;
        handleInput();
      }
      return;
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const pill = findClosestElement(
        range.commonAncestorContainer,
        '.anki-cloze-pill, mark',
        editorRef.current
      );
      if (pill) {
        const rect = pill.getBoundingClientRect();
        if (e.clientX > rect.right + 2) {
          exitInlinePill(pill, false);
          return;
        }
      }
    }

    saveSelectionRange();
  };

  const isCaretAtEndOfElement = (el: HTMLElement, range: Range): boolean => {
    const testRange = document.createRange();
    testRange.selectNodeContents(el);
    testRange.setStart(range.endContainer, range.endOffset);
    const remaining = testRange.toString().replace(/\u200B/g, '');
    return remaining.length === 0;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      isComposingRef.current ||
      e.nativeEvent.isComposing ||
      (e as any).keyCode === 229
    ) {
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      insertClozeBadge(e.altKey);
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      execCmd('bold');
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      execCmd('italic');
      return;
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      const activePill = findClosestElement(
        range.commonAncestorContainer,
        '.anki-cloze-pill, mark',
        editorRef.current
      );

      // 1. Inside a Cloze pill or Mark highlight: smart keyboard navigation & exit
      if (activePill && range.collapsed) {
        const bodyEl = activePill.matches('.anki-cloze-pill')
          ? (activePill.querySelector('.anki-cloze-body') as HTMLElement | null) || activePill
          : activePill;
        const visibleText = (bodyEl.textContent || '').replace(/\u200B/g, '');

        // Backspace / Delete / Escape inside empty or 1-char pill
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Escape') {
          if (visibleText.length === 0) {
            e.preventDefault();
            e.stopPropagation();
            exitInlinePill(activePill, false);
            handleInput();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            exitInlinePill(activePill, false);
            handleInput();
            return;
          }
          if (visibleText.length === 1 && e.key === 'Backspace') {
            e.preventDefault();
            bodyEl.textContent = ZWSP;
            bodyEl.setAttribute('data-empty', 'true');
            if (bodyEl.firstChild) {
              placeCaret(bodyEl.firstChild, 1);
            }
            handleInput();
            return;
          }
        }

        // Tab or Enter inside a Cloze pill / Mark -> immediately step out of the pill into normal text
        if (e.key === 'Tab' || (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey)) {
          e.preventDefault();
          exitInlinePill(activePill, false);
          handleInput();
          return;
        }

        // ArrowRight at the end of the pill -> step outside the pill
        if (e.key === 'ArrowRight' && isCaretAtEndOfElement(bodyEl, range)) {
          e.preventDefault();
          exitInlinePill(activePill, false);
          return;
        }

        // Double-Space at the end of a Cloze pill / Mark -> remove trailing space inside pill and exit to normal text!
        if (e.key === ' ' && isCaretAtEndOfElement(bodyEl, range)) {
          if (visibleText.length === 0) {
            e.preventDefault();
            exitInlinePill(activePill, false);
            handleInput();
            return;
          }
          if (/\s$/.test(visibleText)) {
            e.preventDefault();
            const walker = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT);
            let lastText: Text | null = null;
            let n = walker.nextNode() as Text | null;
            while (n) {
              if (n.data.replace(/\u200B/g, '').length > 0) {
                lastText = n;
              }
              n = walker.nextNode() as Text | null;
            }
            if (lastText) {
              lastText.data = lastText.data.replace(/[\s\u00A0]+(\u200B*)$/, '$1');
            }
            exitInlinePill(activePill, true);
            handleInput();
            return;
          }
        }
      }

      // 2. Smart LaTeX \( ... \) inline navigation: Backspace deletes empty \(  \), Tab/Enter exits before \)
      if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
        const tNode = range.startContainer as Text;
        const offset = range.startOffset;
        const text = tNode.data;
        if (
          e.key === 'Backspace' &&
          offset >= 2 &&
          text.slice(offset - 3, offset + 2) === '\\(  \\)'
        ) {
          e.preventDefault();
          tNode.deleteData(offset - 3, 5);
          placeCaret(tNode, offset - 3);
          handleInput();
          return;
        }
        if (
          (e.key === 'Tab' || (e.key === 'Enter' && !e.metaKey && !e.ctrlKey)) &&
          text.slice(offset, offset + 3) === ' \\)'
        ) {
          e.preventDefault();
          placeCaret(tNode, offset + 3);
          return;
        }
      }

      // 3. Inside a <table>: Tab / Shift+Tab navigates between cells
      const activeCell = findClosestElement(
        range.commonAncestorContainer,
        'td, th',
        editorRef.current
      );
      if (activeCell && e.key === 'Tab') {
        e.preventDefault();
        const table = findClosestElement(activeCell, 'table', editorRef.current);
        if (table) {
          const cells = Array.from(table.querySelectorAll('th, td')) as HTMLElement[];
          const idx = cells.indexOf(activeCell);
          if (!e.shiftKey) {
            if (idx >= 0 && idx < cells.length - 1) {
              placeCaret(cells[idx + 1], 0);
            } else {
              const nextEl = table.nextElementSibling as HTMLElement | null;
              if (nextEl) {
                placeCaret(nextEl, 0);
              } else {
                const p = document.createElement('p');
                p.appendChild(document.createElement('br'));
                table.parentNode?.insertBefore(p, table.nextSibling);
                placeCaret(p, 0);
              }
            }
          } else if (idx > 0) {
            placeCaret(cells[idx - 1], 0);
          }
        }
        return;
      }

      // 4. Inside <blockquote>, <pre>, or <h1>/<h2>/<h3>: pressing Enter at end exits cleanly to normal <p>
      const activeHeading = findClosestElement(
        range.commonAncestorContainer,
        'h1, h2, h3',
        editorRef.current
      );
      if (
        activeHeading &&
        e.key === 'Enter' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        range.collapsed &&
        isCaretAtEndOfElement(activeHeading, range)
      ) {
        e.preventDefault();
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        activeHeading.parentNode?.insertBefore(p, activeHeading.nextSibling);
        placeCaret(p, 0);
        handleInput();
        return;
      }

      const activeBlock = findClosestElement(
        range.commonAncestorContainer,
        'blockquote, pre',
        editorRef.current
      );
      if (
        activeBlock &&
        e.key === 'Enter' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        range.collapsed
      ) {
        const blockText = (activeBlock.textContent || '').replace(/\u200B/g, '');
        if (blockText.trim().length === 0 || /\n\s*$/.test(blockText)) {
          e.preventDefault();
          activeBlock.textContent = blockText.replace(/\n\s*$/, '');
          const p = document.createElement('p');
          p.appendChild(document.createElement('br'));
          activeBlock.parentNode?.insertBefore(p, activeBlock.nextSibling);
          if (!activeBlock.textContent.trim()) {
            activeBlock.remove();
          }
          placeCaret(p, 0);
          handleInput();
          return;
        }
      }
    }

    if (onKeyDownShortcut) {
      onKeyDownShortcut(e);
    }
  };

  const containerBorder = isDark ? 'border-[#2C2E3A]' : 'border-[#E2E2E8]';
  const containerBg = isDark ? 'bg-[#171822]' : 'bg-white';
  const toolbarBg = isDark
    ? 'bg-[#151620] border-b border-[#262836] rounded-t-[11px]'
    : 'bg-[#FAFAFC] border-b border-[#ECECF0] rounded-t-[11px]';
  const iconBtnClass = `h-7 w-7 rounded flex items-center justify-center transition-colors cursor-pointer text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#8E8E93] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10`;
  const activeIconBtnClass = `bg-[var(--brand-soft)] !text-[var(--brand-text)]`;

  const boldShortcutStr = formatShortcut('Cmd+B', envInfo.platform);
  const italicShortcutStr = formatShortcut('Cmd+I', envInfo.platform);
  const clozeShortcutStr = formatShortcut('Cmd+Shift+C', envInfo.platform);
  const saveShortcutStr = formatShortcut('Cmd+Enter', envInfo.platform);
  const pasteShortcutStr = formatShortcut('Cmd+V', envInfo.platform);

  return (
    <div className="space-y-1.5">
      {/* Field Label & Meta Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F4F4F6]">
            {label}
          </label>
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--brand-soft)] text-[var(--brand-text)]">
              {badge}
            </span>
          )}
        </div>
        <span className="text-[11px] text-[#8E8E93] font-mono">
          {charCount} {t('charsCountUnit')}
        </span>
      </div>

      {/* Editor Container — keep overflow visible so toolbar popovers (Emoji, Heading, Table, Align, Help) are never clipped */}
      <div
        className={`relative rounded-xl border transition-shadow focus-within:ring-2 focus-within:ring-[var(--brand)]/25 focus-within:border-[var(--brand)] ${containerBorder} ${containerBg}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          tabIndex={-1}
        />

        {/* Top Tower Toolbar — all buttons have tabIndex={-1} so pressing Tab in Front jumps straight to Back editor */}
        <div
          ref={toolbarRef}
          className={`relative z-20 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1 ${toolbarBg}`}
        >
          <div className="flex flex-wrap items-center gap-0.5">
            {/* Heading Dropdown (#) */}
            <div className="relative">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleDropdown('heading')}
                title={t('slashInsertBtn')}
                aria-expanded={headingOpen}
                className={`${iconBtnClass} ${
                  headingOpen || activeFormats.heading ? activeIconBtnClass : ''
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="9" x2="20" y2="9" />
                  <line x1="4" y1="15" x2="20" y2="15" />
                  <line x1="10" y1="3" x2="8" y2="21" />
                  <line x1="16" y1="3" x2="14" y2="21" />
                </svg>
              </button>

              {headingOpen && (
                <div
                  className="dashboard-tooltip absolute start-0 top-8 z-50 w-40 rounded-xl border p-1 space-y-0.5 animate-in fade-in duration-150"
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setHeading('<p>')}
                    className={`w-full text-start px-2.5 py-1.5 text-[12px] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer flex items-center justify-between ${
                      activeFormats.heading === '' ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold' : ''
                    }`}
                  >
                    <span>{t('editorHeadingParagraph')}</span>
                    {activeFormats.heading === '' && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setHeading('<h1>')}
                    className={`w-full text-start px-2.5 py-1.5 text-[14px] font-bold rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer flex items-center justify-between ${
                      activeFormats.heading === 'h1' ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]' : ''
                    }`}
                  >
                    <span>{t('editorHeading1')}</span>
                    {activeFormats.heading === 'h1' && <span className="text-[12px]">✓</span>}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setHeading('<h2>')}
                    className={`w-full text-start px-2.5 py-1.5 text-[13px] font-bold rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer flex items-center justify-between ${
                      activeFormats.heading === 'h2' ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]' : ''
                    }`}
                  >
                    <span>{t('editorHeading2')}</span>
                    {activeFormats.heading === 'h2' && <span className="text-[12px]">✓</span>}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setHeading('<h3>')}
                    className={`w-full text-start px-2.5 py-1.5 text-[12px] font-semibold rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer flex items-center justify-between ${
                      activeFormats.heading === 'h3' ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]' : ''
                    }`}
                  >
                    <span>{t('editorHeading3')}</span>
                    {activeFormats.heading === 'h3' && <span className="text-[12px]">✓</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Emoji Picker */}
            <div className="relative">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleDropdown('emoji')}
                title={t('editorToolEmoji')}
                aria-expanded={emojiOpen}
                className={`${iconBtnClass} ${emojiOpen ? activeIconBtnClass : ''}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>

              {emojiOpen && (
                <div
                  role="menu"
                  aria-label={t('editorToolEmoji')}
                  className="dashboard-tooltip absolute start-0 top-8 z-50 p-2 rounded-xl border grid grid-cols-5 gap-1 w-52 animate-in fade-in duration-150"
                >
                  {STUDY_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertEmoji(em)}
                      className="h-8 rounded-lg hover:bg-[var(--brand-soft)] hover:scale-110 transition-transform text-[16px] flex items-center justify-center cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1" />

            {/* Bold */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('bold')}
              title={t('editorToolBold', { key: boldShortcutStr })}
              aria-pressed={activeFormats.bold}
              className={`${iconBtnClass} font-bold text-[13px] ${activeFormats.bold ? activeIconBtnClass : ''}`}
            >
              B
            </button>

            {/* Italic */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('italic')}
              title={t('editorToolItalic', { key: italicShortcutStr })}
              aria-pressed={activeFormats.italic}
              className={`${iconBtnClass} font-serif italic text-[13px] ${activeFormats.italic ? activeIconBtnClass : ''}`}
            >
              I
            </button>

            <span className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1" />

            {/* Ordered List */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('insertOrderedList')}
              title={t('editorToolOrderedList')}
              aria-pressed={activeFormats.orderedList}
              className={`${iconBtnClass} ${activeFormats.orderedList ? activeIconBtnClass : ''}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="10" y1="6" x2="21" y2="6" />
                <line x1="10" y1="12" x2="21" y2="12" />
                <line x1="10" y1="18" x2="21" y2="18" />
                <path d="M4 6h1v4" />
                <path d="M4 10h2" />
                <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
              </svg>
            </button>

            {/* Unordered List */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('insertUnorderedList')}
              title={t('editorToolUnorderedList')}
              aria-pressed={activeFormats.unorderedList}
              className={`${iconBtnClass} ${activeFormats.unorderedList ? activeIconBtnClass : ''}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="9" y1="6" x2="20" y2="6" />
                <line x1="9" y1="12" x2="20" y2="12" />
                <line x1="9" y1="18" x2="20" y2="18" />
                <circle cx="4" cy="6" r="1.5" fill="currentColor" />
                <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                <circle cx="4" cy="18" r="1.5" fill="currentColor" />
              </svg>
            </button>

            {/* Blockquote */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleBlockTag('blockquote')}
              title={t('editorToolQuote')}
              aria-pressed={activeFormats.blockquote}
              className={`${iconBtnClass} ${activeFormats.blockquote ? activeIconBtnClass : ''}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
              </svg>
            </button>

            {/* Image Upload Button */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              title={t('ioUploadImageBtn')}
              className={iconBtnClass}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </button>

            {/* Code Block */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleBlockTag('pre')}
              title={t('editorToolCode')}
              aria-pressed={activeFormats.code}
              className={`${iconBtnClass} ${activeFormats.code ? activeIconBtnClass : ''}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>

            {/* Table Insertion */}
            <div className="relative">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleDropdown('table')}
                title={t('editorToolTable')}
                aria-expanded={tableOpen}
                className={`${iconBtnClass} ${tableOpen ? activeIconBtnClass : ''}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                  <path d="M9 3v18" />
                  <path d="M15 3v18" />
                </svg>
              </button>

              {tableOpen && (
                <div
                  className="dashboard-tooltip absolute start-0 top-8 z-50 p-1.5 rounded-xl border w-32 animate-in fade-in duration-150"
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertTable(2, 2)}
                    className="w-full text-start px-2.5 py-1 text-[12px] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer"
                  >
                    2 × 2
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertTable(2, 3)}
                    className="w-full text-start px-2.5 py-1 text-[12px] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer"
                  >
                    2 × 3
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertTable(3, 3)}
                    className="w-full text-start px-2.5 py-1 text-[12px] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer"
                  >
                    3 × 3
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('insertHorizontalRule')}
              title={t('editorToolDivider')}
              className={iconBtnClass}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
            </button>

            {/* Alignment Dropdown */}
            <div className="relative">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleDropdown('align')}
                title={t('editorToolAlign')}
                aria-expanded={alignOpen}
                className={`${iconBtnClass} ${alignOpen ? activeIconBtnClass : ''}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="15" y2="12" />
                  <line x1="3" y1="18" x2="18" y2="18" />
                </svg>
              </button>

              {alignOpen && (
                <div
                  className="dashboard-tooltip absolute start-0 top-8 z-50 p-1 rounded-xl border w-32 space-y-0.5 animate-in fade-in duration-150"
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      execCmd('justifyLeft');
                      setAlignOpen(false);
                    }}
                    className="w-full text-start px-2.5 py-1.5 text-[12px] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer flex items-center gap-2"
                  >
                    <span className="font-mono text-[11px] opacity-70">⇤</span>
                    <span>{t('editorAlignLeft')}</span>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      execCmd('justifyCenter');
                      setAlignOpen(false);
                    }}
                    className="w-full text-start px-2.5 py-1.5 text-[12px] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer flex items-center gap-2"
                  >
                    <span className="font-mono text-[11px] opacity-70">⇔</span>
                    <span>{t('editorAlignCenter')}</span>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      execCmd('justifyRight');
                      setAlignOpen(false);
                    }}
                    className="w-full text-start px-2.5 py-1.5 text-[12px] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] cursor-pointer flex items-center gap-2"
                  >
                    <span className="font-mono text-[11px] opacity-70">⇥</span>
                    <span>{t('editorAlignRight')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Indent / Outdent */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('outdent')}
              title={t('editorToolOutdent')}
              className={iconBtnClass}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 8 3 12 7 16" />
                <line x1="21" y1="12" x2="11" y2="12" />
                <line x1="21" y1="6" x2="11" y2="6" />
                <line x1="21" y1="18" x2="11" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('indent')}
              title={t('editorToolIndent')}
              className={iconBtnClass}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 8 21 12 17 16" />
                <line x1="3" y1="12" x2="13" y2="12" />
                <line x1="3" y1="6" x2="13" y2="6" />
                <line x1="3" y1="18" x2="13" y2="18" />
              </svg>
            </button>

            <span className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1.5 shrink-0" />

            {/* Anki Cloze Pill Button */}
            {showCloze && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => insertClozeBadge(e.altKey)}
                title={t('clozeShortcutBtn', { key: clozeShortcutStr })}
                aria-pressed={activeFormats.cloze}
                className={`h-7 px-2 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0 ${
                  activeFormats.cloze
                    ? 'bg-[var(--brand)] text-white ring-2 ring-[var(--brand)]/30'
                    : 'bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-strong)] text-[var(--brand-text)]'
                }`}
              >
                <span>[ ... ]</span>
                <span className="text-[11px] font-sans font-semibold">
                  {t('editorClozeBtnLabel')}
                </span>
              </button>
            )}

            {/* Image Occlusion Button (Integrated in Toolbar Row) */}
            {onOpenImageOcclusion && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onOpenImageOcclusion}
                title={t('ioStudioTitle')}
                className={`h-7 px-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                  hasImageOcclusion
                    ? 'bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/25'
                    : isDark
                    ? 'bg-white/5 hover:bg-white/10 text-[#D8D8E0]'
                    : 'bg-black/5 hover:bg-black/10 text-[#3A3A3C]'
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span>
                  {hasImageOcclusion ? t('ioEditButtonLabel') : t('ioButtonLabel')}
                </span>
              </button>
            )}

            {/* LaTeX Math Formula f(x) */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertMath}
              title={t('editorToolMath')}
              className="h-7 px-2 rounded-lg text-[12px] font-serif italic text-[var(--status-info)] hover:bg-[var(--status-info-soft)] cursor-pointer transition-colors shrink-0"
            >
              f(x)
            </button>

            {/* Mark Highlight */}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertMark}
              title={t('editorToolMark')}
              aria-pressed={activeFormats.mark}
              className={`h-7 px-2 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors shrink-0 ${
                activeFormats.mark
                  ? 'bg-[var(--status-warning)] text-white'
                  : 'text-[var(--status-warning)] hover:bg-[var(--status-warning-soft)]'
              }`}
            >
              {t('editorMarkBtnLabel')}
            </button>
          </div>

          {/* Right Corner: Quick Shortcut Help (?) */}
          <div className="relative ms-auto shrink-0 ps-1">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleDropdown('help')}
              title={t('editorHelpTitle')}
              aria-label={t('editorHelpTitle')}
              aria-expanded={helpOpen}
              className={`w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer ${
                helpOpen ? 'bg-[var(--brand-soft)] !text-[var(--brand-text)] !border-[var(--brand-border)]' : ''
              }`}
            >
              ?
            </button>

            {helpOpen && (
              <div
                className="dashboard-tooltip absolute end-0 top-7 z-50 p-3 rounded-xl border w-64 text-[11px] space-y-1.5 animate-in fade-in duration-150"
              >
                <div className="font-bold text-[12px] pb-1 border-b border-black/10 dark:border-white/10 text-[var(--brand-text)]">
                  {t('editorHelpTitle')}
                </div>
                <div className="flex justify-between gap-2">
                  <span>{t('editorHelpBoldItalic')}</span>
                  <span className="font-mono text-[#8E8E93] shrink-0">
                    {boldShortcutStr} / {italicShortcutStr}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>{t('editorHelpCloze')}</span>
                  <span className="font-mono text-[var(--brand-text)] shrink-0">
                    {clozeShortcutStr}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>{t('editorHelpExitCloze')}</span>
                  <span className="font-mono text-[#8E8E93] shrink-0">
                    {t('editorHelpExitClozeKeys')}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>{t('saveNickname')}</span>
                  <span className="font-mono text-[#8E8E93] shrink-0">
                    {saveShortcutStr}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>{t('editorHelpPasteImage')}</span>
                  <span className="font-mono text-[#8E8E93] shrink-0">
                    {pasteShortcutStr}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main WYSIWYG ContentEditable Surface — full padding on the editable surface itself so clicking anywhere focuses */}
        <div
          ref={editorRef}
          contentEditable={true}
          onInput={handleInput}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyUp={saveSelectionRange}
          onMouseUp={handleEditorMouseUp}
          onFocus={saveSelectionRange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          style={{ minHeight: `${minHeight}px` }}
          data-placeholder={placeholder || t('editorDefaultPlaceholder')}
          className="p-3.5 sm:p-4 rounded-b-[11px] outline-none leading-relaxed text-[15px] select-text break-words cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-[#8E8E93]/60 empty:before:pointer-events-none [&_blockquote]:border-s-[3px] [&_blockquote]:border-[var(--brand)] [&_blockquote]:ps-3 [&_blockquote]:my-2 [&_blockquote]:text-[#8E8E93] [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-2 [&_pre]:bg-black/5 dark:[&_pre]:bg-white/5 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:my-2 [&_h1]:text-[20px] [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:my-1.5 [&_h3]:text-[15px] [&_h3]:my-1 [&_h3]:font-semibold [&_img]:max-h-60 [&_img]:rounded-xl [&_img]:my-2 [&_img]:shadow-xs [&_hr]:border-t [&_hr]:border-black/10 dark:[&_hr]:border-white/10 [&_hr]:my-3"
        />
      </div>
    </div>
  );
};
