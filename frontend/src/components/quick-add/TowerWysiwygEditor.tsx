import React, { useEffect, useRef, useState } from 'react';
import { translate } from '../../i18n/translations';
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
    const hintAttr = hint ? ` data-cloze-hint="${hint}"` : '';
    const hintDisplay = hint ? ` (${hint})` : '';
    return `<span class="anki-cloze-pill" data-cloze-ord="${cNum}"${hintAttr} style="display:inline-flex; align-items:baseline; gap:3px; padding:1px 7px; margin:0 2px; border-radius:6px; background:var(--brand-soft); color:var(--brand-text); border:1px solid var(--brand-border); font-weight:600; font-size:0.95em;"><span class="anki-cloze-prefix" style="opacity:0.65; font-size:0.82em; user-select:none; font-mono:true;">c${cNum}:</span><span class="anki-cloze-body">${ans}${hintDisplay}</span></span>`;
  });

  return html;
}

/**
 * Serializes editor HTML back to pure, standard Anki note field content:
 * Replaces visual cloze pills back into standard {{c1::answer}} syntax.
 */
function serializeFromWysiwyg(container: HTMLElement): string {
  if (!container) return '';
  const clone = container.cloneNode(true) as HTMLElement;

  const pills = clone.querySelectorAll('.anki-cloze-pill');
  pills.forEach((pill) => {
    const ord = pill.getAttribute('data-cloze-ord') || '1';
    const hint = pill.getAttribute('data-cloze-hint');
    const bodyEl = pill.querySelector('.anki-cloze-body');
    let text = (bodyEl ? bodyEl.textContent : pill.textContent) || '';
    text = text.replace(new RegExp(`^c${ord}:\\s*`), '').trim();
    if (hint && text.endsWith(`(${hint})`)) {
      text = text.slice(0, -`(${hint})`.length).trim();
    }
    const ankiCloze = hint ? `{{c${ord}::${text}::${hint}}}` : `{{c${ord}::${text}}}`;
    const textNode = document.createTextNode(ankiCloze);
    pill.parentNode?.replaceChild(textNode, pill);
  });

  return clone.innerHTML;
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
}) => {
  const { resolvedLang } = useAppStore();
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dropdown states
  const [headingOpen, setHeadingOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Character count
  const [charCount, setCharCount] = useState(0);

  // Track initial value loaded to avoid cursor jumps
  const lastLoadedValueRef = useRef<string | null>(null);
  const lastLoadedMediaBaseRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!editorRef.current) return;
    const currentSerialized = serializeFromWysiwyg(editorRef.current);
    const mediaBaseChanged =
      Boolean(mediaBaseUrl) && mediaBaseUrl !== lastLoadedMediaBaseRef.current;
    if (lastLoadedValueRef.current === null || value !== currentSerialized || mediaBaseChanged) {
      editorRef.current.innerHTML = deserializeToWysiwyg(value, mediaBaseUrl);
      lastLoadedValueRef.current = value;
      lastLoadedMediaBaseRef.current = mediaBaseUrl;
      setCharCount(editorRef.current.textContent?.length || 0);
    }
  }, [value, mediaBaseUrl]);

  const handleInput = () => {
    if (!editorRef.current) return;
    const serialized = serializeFromWysiwyg(editorRef.current);
    lastLoadedValueRef.current = serialized;
    setCharCount(editorRef.current.textContent?.length || 0);
    onChange(serialized);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setHeadingOpen(false);
      setEmojiOpen(false);
      setAlignOpen(false);
      setTableOpen(false);
      setHelpOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const execCmd = (command: string, arg: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, arg);
    handleInput();
  };

  const setHeading = (tag: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('formatBlock', false, tag);
    setHeadingOpen(false);
    handleInput();
  };

  const insertEmoji = (emoji: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, emoji);
    setEmojiOpen(false);
    handleInput();
  };

  const insertTable = (rows = 2, cols = 3) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    let tableHtml = `<table style="width:100%; border-collapse:collapse; margin:10px 0; border:1px solid ${
      isDark ? '#343646' : '#E5E5EA'
    };">`;
    tableHtml += '<thead><tr>';
    for (let c = 0; c < cols; c++) {
      tableHtml += `<th style="border:1px solid ${
        isDark ? '#343646' : '#E5E5EA'
      }; padding:6px 10px; background:${isDark ? '#21222E' : '#F5F5F7'}; text-align:start; font-size:13px;">#${
        c + 1
      }</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="border:1px solid ${
          isDark ? '#343646' : '#E5E5EA'
        }; padding:6px 10px; font-size:13px;">...</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br></p>';

    document.execCommand('insertHTML', false, tableHtml);
    setTableOpen(false);
    handleInput();
  };

  const insertClozeBadge = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      editorRef.current.focus();
      return;
    }

    const selectedText = range.toString().trim() || '...';

    const existingPills = editorRef.current.querySelectorAll('.anki-cloze-pill');
    let maxIdx = 0;
    existingPills.forEach((p) => {
      const ord = parseInt(p.getAttribute('data-cloze-ord') || '0', 10);
      if (ord > maxIdx) maxIdx = ord;
    });
    const nextIdx = maxIdx + 1;

    const pill = document.createElement('span');
    pill.className = 'anki-cloze-pill';
    pill.setAttribute('data-cloze-ord', String(nextIdx));
    pill.style.cssText =
      'display:inline-flex; align-items:baseline; gap:3px; padding:1px 7px; margin:0 2px; border-radius:6px; background:var(--brand-soft); color:var(--brand-text); border:1px solid var(--brand-border); font-weight:600; font-size:0.95em;';

    const prefix = document.createElement('span');
    prefix.className = 'anki-cloze-prefix';
    prefix.setAttribute('contenteditable', 'false');
    prefix.style.cssText = 'opacity:0.65; font-size:0.82em; user-select:none; margin-right:2px; font-mono:true;';
    prefix.textContent = `c${nextIdx}:`;

    const body = document.createElement('span');
    body.className = 'anki-cloze-body';
    body.textContent = selectedText;

    pill.appendChild(prefix);
    pill.appendChild(body);

    range.deleteContents();
    range.insertNode(pill);

    range.setStartAfter(pill);
    range.setEndAfter(pill);
    selection.removeAllRanges();
    selection.addRange(range);

    handleInput();
  };

  const insertMath = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    const selected = selection?.toString() || 'x^2 + y^2 = r^2';
    document.execCommand('insertHTML', false, `\\( ${selected} \\)`);
    handleInput();
  };

  const insertMark = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    const selected = selection?.toString() || '...';
    const markHtml = `<mark style="background:${
      isDark ? 'rgba(224, 147, 62, 0.28)' : '#FDF3E7'
    }; padding:1px 4px; border-radius:4px; color:inherit;">${selected}</mark>`;
    document.execCommand('insertHTML', false, markHtml);
    handleInput();
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file && onPasteImage) {
          const imgHtml = await onPasteImage(file);
          if (imgHtml && editorRef.current) {
            editorRef.current.focus();
            document.execCommand('insertHTML', false, imgHtml);
            handleInput();
          }
        }
        return;
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onPasteImage && editorRef.current) {
      const imgHtml = await onPasteImage(file);
      if (imgHtml) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, imgHtml);
        handleInput();
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing || (e as any).keyCode === 229) {
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      insertClozeBadge();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      execCmd('bold');
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      execCmd('italic');
      return;
    }

    if (onKeyDownShortcut) {
      onKeyDownShortcut(e);
    }
  };

  const containerBorder = isDark ? 'border-[#2C2E3A]' : 'border-[#E2E2E8]';
  const containerBg = isDark ? 'bg-[#171822]' : 'bg-white';
  const toolbarBg = isDark ? 'bg-[#151620] border-b border-[#262836]' : 'bg-[#FAFAFC] border-b border-[#ECECF0]';
  const iconBtnClass = `h-7 w-7 rounded flex items-center justify-center transition-colors cursor-pointer text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#8E8E93] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10`;

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

      {/* Editor Container */}
      <div
        className={`rounded-xl border transition-shadow focus-within:ring-2 focus-within:ring-[var(--brand)]/25 focus-within:border-[var(--brand)] overflow-hidden ${containerBorder} ${containerBg}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Top Tower Toolbar */}
        <div className={`px-2.5 py-1.5 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar ${toolbarBg}`}>
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Heading Dropdown (#) */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setHeadingOpen((prev) => !prev)}
                title={t('slashInsertBtn')}
                className={iconBtnClass}
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
                  className={`absolute start-0 top-8 z-50 w-32 rounded-lg border shadow-xl p-1 backdrop-blur-xl ${
                    isDark ? 'bg-[#1F202A] border-[#343646]' : 'bg-white border-[#E5E5EA]'
                  }`}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setHeading('<p>')}
                    className="w-full text-start px-2.5 py-1.5 text-[12px] rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    P
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setHeading('<h1>')}
                    className="w-full text-start px-2.5 py-1.5 text-[15px] font-bold rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    H1
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setHeading('<h2>')}
                    className="w-full text-start px-2.5 py-1.5 text-[13px] font-bold rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setHeading('<h3>')}
                    className="w-full text-start px-2.5 py-1.5 text-[12px] font-semibold rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    H3
                  </button>
                </div>
              )}
            </div>

            {/* Emoji Picker */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEmojiOpen((prev) => !prev)}
                title="Emoji"
                className={iconBtnClass}
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
                  className={`absolute start-0 top-8 z-50 p-2 rounded-xl border shadow-xl grid grid-cols-4 gap-1.5 w-44 backdrop-blur-xl ${
                    isDark ? 'bg-[#1F202A] border-[#343646]' : 'bg-white border-[#E5E5EA]'
                  }`}
                >
                  {['💡', '⭐', '⚠️', '📌', '✅', '❌', '📝', '🔍', '🎯', '🚀', '📚', '🧠'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertEmoji(em)}
                      className="h-8 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[16px] flex items-center justify-center cursor-pointer"
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('bold')}
              title="Bold (Cmd+B)"
              className={`${iconBtnClass} font-bold text-[13px]`}
            >
              B
            </button>

            {/* Italic */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('italic')}
              title="Italic (Cmd+I)"
              className={`${iconBtnClass} font-serif italic text-[13px]`}
            >
              I
            </button>

            <span className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-1" />

            {/* Ordered List */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('insertOrderedList')}
              title="1. List"
              className={iconBtnClass}
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('insertUnorderedList')}
              title="• List"
              className={iconBtnClass}
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('formatBlock', '<blockquote>')}
              title="Quote"
              className={iconBtnClass}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
              </svg>
            </button>

            {/* Image Upload Button */}
            <button
              type="button"
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('formatBlock', '<pre>')}
              title="Code"
              className={iconBtnClass}
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setTableOpen((prev) => !prev)}
                title="Table"
                className={iconBtnClass}
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
                  className={`absolute start-0 top-8 z-50 p-1.5 rounded-lg border shadow-xl w-32 backdrop-blur-xl ${
                    isDark ? 'bg-[#1F202A] border-[#343646]' : 'bg-white border-[#E5E5EA]'
                  }`}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertTable(2, 2)}
                    className="w-full text-start px-2.5 py-1 text-[12px] rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    2 × 2
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertTable(2, 3)}
                    className="w-full text-start px-2.5 py-1 text-[12px] rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    2 × 3
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertTable(3, 3)}
                    className="w-full text-start px-2.5 py-1 text-[12px] rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    3 × 3
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('insertHorizontalRule')}
              title="HR"
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAlignOpen((prev) => !prev)}
                title="Align"
                className={iconBtnClass}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="15" y2="12" />
                  <line x1="3" y1="18" x2="18" y2="18" />
                </svg>
              </button>

              {alignOpen && (
                <div
                  className={`absolute start-0 top-8 z-50 p-1 rounded-lg border shadow-xl w-24 backdrop-blur-xl ${
                    isDark ? 'bg-[#1F202A] border-[#343646]' : 'bg-white border-[#E5E5EA]'
                  }`}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      execCmd('justifyLeft');
                      setAlignOpen(false);
                    }}
                    className="w-full text-start px-2 py-1 text-[12px] rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    ⇤
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      execCmd('justifyCenter');
                      setAlignOpen(false);
                    }}
                    className="w-full text-start px-2 py-1 text-[12px] rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    ⇔
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      execCmd('justifyRight');
                      setAlignOpen(false);
                    }}
                    className="w-full text-start px-2 py-1 text-[12px] rounded hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]"
                  >
                    ⇥
                  </button>
                </div>
              )}
            </div>

            {/* Indent / Outdent */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('outdent')}
              title="Outdent"
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('indent')}
              title="Indent"
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={insertClozeBadge}
                title={t('clozeShortcutBtn', { key: 'Cmd+Shift+C' })}
                className="h-7 px-2 rounded-lg text-[11px] font-mono font-bold bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-strong)] text-[var(--brand-text)] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0"
              >
                <span>[ ... ]</span>
                <span className="text-[10px] font-sans font-medium">Cloze</span>
              </button>
            )}

            {/* LaTeX Math Formula f(x) */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertMath}
              title="LaTeX \( ... \)"
              className="h-7 px-2 rounded-lg text-[12px] font-serif italic text-[var(--status-info)] hover:bg-[var(--status-info-soft)] cursor-pointer transition-colors shrink-0"
            >
              f(x)
            </button>

            {/* Mark Highlight */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertMark}
              title="Mark"
              className="h-7 px-2 rounded-lg text-[11px] font-semibold text-[var(--status-warning)] hover:bg-[var(--status-warning-soft)] cursor-pointer transition-colors shrink-0"
            >
              Mark
            </button>
          </div>

          {/* Right Corner: Quick Shortcut Help (?) */}
          <div className="relative ms-auto shrink-0 ps-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setHelpOpen((prev) => !prev)}
              title="?"
              className="w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              ?
            </button>

            {helpOpen && (
              <div
                className={`absolute end-0 top-7 z-50 p-3 rounded-xl border shadow-xl w-64 text-[11px] space-y-1.5 backdrop-blur-xl ${
                  isDark ? 'bg-[#1F202A] border-[#343646] text-[#D8D8E0]' : 'bg-white border-[#E5E5EA] text-[#3A3A3C]'
                }`}
              >
                <div className="font-bold text-[12px] pb-1 border-b border-black/10 dark:border-white/10 text-[var(--brand-text)]">
                  WYSIWYG
                </div>
                <div className="flex justify-between">
                  <span>B / I</span>
                  <span className="font-mono text-[#8E8E93]">Cmd+B / Cmd+I</span>
                </div>
                <div className="flex justify-between">
                  <span>Cloze</span>
                  <span className="font-mono text-[var(--brand-text)]">Cmd+Shift+C</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('saveNickname')}</span>
                  <span className="font-mono text-[#8E8E93]">Cmd+Enter</span>
                </div>
                <div className="flex justify-between">
                  <span>Image</span>
                  <span className="font-mono text-[#8E8E93]">Cmd+V</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main WYSIWYG ContentEditable Surface */}
        <div className="relative p-3.5 sm:p-4">
          <div
            ref={editorRef}
            contentEditable={true}
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            style={{ minHeight: `${minHeight}px` }}
            data-placeholder={placeholder || t('editorDefaultPlaceholder')}
            className="outline-none leading-relaxed text-[15px] select-text break-words empty:before:content-[attr(data-placeholder)] empty:before:text-[#8E8E93]/60 empty:before:pointer-events-none [&_blockquote]:border-s-[3px] [&_blockquote]:border-[var(--brand)] [&_blockquote]:ps-3 [&_blockquote]:my-2 [&_blockquote]:text-[#8E8E93] [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-2 [&_pre]:bg-black/5 dark:[&_pre]:bg-white/5 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:my-2 [&_h1]:text-[20px] [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:my-1.5 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:my-1 [&_img]:max-h-60 [&_img]:rounded-xl [&_img]:my-2 [&_img]:shadow-xs [&_hr]:border-t [&_hr]:border-black/10 dark:[&_hr]:border-white/10 [&_hr]:my-3"
          />
        </div>
      </div>
    </div>
  );
};
