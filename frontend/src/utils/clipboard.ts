import { callAnki, isAnkiNativeEnv } from '../bridge/pycmd';

/**
 * Universal cross-platform copy to clipboard for Anki Studio.
 * Tier 1: Native Anki Qt QGuiApplication.clipboard() (100% reliable in Anki WebEngine).
 * Tier 2: Modern Browser navigator.clipboard.writeText().
 * Tier 3: Classic document.execCommand('copy') with invisible textarea.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const cleanText = text.replace(/<[^>]+>/g, '').trim();

  // Tier 1: Native Qt Python Bridge
  if (isAnkiNativeEnv()) {
    try {
      const res = await callAnki<{ copied: boolean }>('copy_to_clipboard', {
        text: cleanText,
      });
      if (res?.copied) return true;
    } catch {}
  }

  // Tier 2: Web Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(cleanText);
      return true;
    } catch {}
  }

  // Tier 3: execCommand Fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = cleanText;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, 99999);
    const success = document.execCommand('copy');
    document.body.removeChild(ta);
    return success;
  } catch {
    return false;
  }
}
