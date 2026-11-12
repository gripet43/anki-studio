// ============================================================================
// Anki Studio — Pure Offline LaTeX / MathJax Formula, Furigana & Rich HTML Renderer
// Converts \( ... \), \[ ... \], $$ ... $$, $ ... $, [latex]...[/latex],
// [$]...[/$], Cloze {{c1::...}}, and Japanese Furigana 漢字[かな] into clean,
// styled HTML without external CDNs.
// Bug #13 Fix: Escapes `<` and `>` inside LaTeX expressions BEFORE injecting HTML
// tags so inequalities like `\( a < b \)` never truncate DOM nodes!
// ============================================================================

const GREEK_AND_SYMBOLS: Record<string, string> = {
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\epsilon': 'ε',
  '\\varepsilon': 'ε',
  '\\zeta': 'ζ',
  '\\eta': 'η',
  '\\theta': 'θ',
  '\\iota': 'ι',
  '\\kappa': 'κ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\nu': 'ν',
  '\\xi': 'ξ',
  '\\pi': 'π',
  '\\rho': 'ρ',
  '\\sigma': 'σ',
  '\\tau': 'τ',
  '\\upsilon': 'υ',
  '\\phi': 'φ',
  '\\varphi': 'φ',
  '\\chi': 'χ',
  '\\psi': 'ψ',
  '\\omega': 'ω',
  '\\Gamma': 'Γ',
  '\\Delta': 'Δ',
  '\\Theta': 'Θ',
  '\\Lambda': 'Λ',
  '\\Xi': 'Ξ',
  '\\Pi': 'Π',
  '\\Sigma': 'Σ',
  '\\Phi': 'Φ',
  '\\Psi': 'Ψ',
  '\\Omega': 'Ω',
  '\\times': '×',
  '\\div': '÷',
  '\\cdot': '·',
  '\\pm': '±',
  '\\mp': '∓',
  '\\le': '≤',
  '\\leq': '≤',
  '\\ge': '≥',
  '\\geq': '≥',
  '\\ne': '≠',
  '\\neq': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  '\\sim': '∼',
  '\\propto': '∝',
  '\\infty': '∞',
  '\\partial': '∂',
  '\\nabla': '∇',
  '\\forall': '∀',
  '\\exists': '∃',
  '\\in': '∈',
  '\\notin': '∉',
  '\\subset': '⊂',
  '\\subseteq': '⊆',
  '\\cup': '∪',
  '\\cap': '∩',
  '\\emptyset': '∅',
  '\\to': '→',
  '\\rightarrow': '→',
  '\\leftarrow': '←',
  '\\leftrightarrow': '↔',
  '\\Rightarrow': '⇒',
  '\\Leftarrow': '⇐',
  '\\Leftrightarrow': '⇔',
  '\\sum': '∑',
  '\\prod': '∏',
  '\\int': '∫',
  '\\oint': '∮',
  '\\therefore': '∴',
  '\\because': '∵',
  '\\angle': '∠',
  '\\perp': '⊥',
  '\\parallel': '∥',
  '\\ldots': '…',
  '\\cdots': '⋯',
};

const CLOZE_PREVIEW_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;
const FURIGANA_BRACKET_RE =
  / ?([0-9\u4e00-\u9fff\u3400-\u4dbf々〆ヵヶ\u3040-\u309f\u30a0-\u30ff]+)\[([\u3040-\u309f\u30a0-\u30ffー～〜・、，\s]+)\]/g;
const MDX_INDEX_MARKER_RE = /`\d+`/g;
const EMBEDDED_SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const EMBEDDED_STYLE_TAG_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;

/**
 * 数学表达式来自卡包字段，里面可能带 HTML 实体（PCSI 这类法语卡组用
 * `[$]&nbsp;sin(...)[/$]` 手写公式占位）。如果先转义 `&` 再处理，`&nbsp;`
 * 会变成字面量 `&amp;nbsp;` 直接显示在公式里。所以先解码实体，再统一转义。
 */
function decodeMathEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function formatLatexExpression(expr: string, isDisplayMode: boolean): string {
  // Bug #13 Fix: Escape raw `<` and `>` first so `a < b` or `x > 0` is never parsed as an HTML tag
  let s = decodeMathEntities(expr)
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Remove \left and \right sizing commands
  s = s.replace(/\\left\b/g, '').replace(/\\right\b/g, '');

  // LaTeX 函数名是正体（\sin(x) 里的 sin 不该跟着变量一起斜体）
  s = s.replace(
    /\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|lg|exp|lim|max|min|det|gcd)\b/g,
    '<span class="not-italic">$1</span>'
  );

  // \text{...} or \mathrm{...}
  s = s.replace(
    /\\(?:text|mathrm|mathbf|mathit)\{([^{}]*)\}/g,
    '<span class="font-sans not-italic">$1</span>'
  );

  // \frac{a}{b} (support nested up to 2 levels)
  const fracRegex = /\\frac\{([^{}]*)\}\{([^{}]*)\}/g;
  for (let pass = 0; pass < 2; pass++) {
    s = s.replace(
      fracRegex,
      '<span class="inline-flex flex-col items-center align-middle mx-1 text-[0.9em] leading-tight">' +
        '<span class="border-b border-current px-1 pb-0.5">$1</span>' +
        '<span class="px-1 pt-0.5">$2</span>' +
      '</span>'
    );
  }

  // \sqrt[n]{x} and \sqrt{x}
  s = s.replace(
    /\\sqrt\[([^\]]+)\]\{([^{}]*)\}/g,
    '<span class="inline-flex items-baseline"><sup class="text-[0.7em] mr-0.5">$1</sup>√<span class="border-t border-current px-0.5">$2</span></span>'
  );
  s = s.replace(
    /\\sqrt\{([^{}]*)\}/g,
    '<span class="inline-flex items-baseline">√<span class="border-t border-current px-0.5">$1</span></span>'
  );

  // Superscripts and subscripts: ^{...}, _{...}, ^x, _x
  s = s.replace(/\^\{([^{}]+)\}/g, '<sup class="text-[0.75em] leading-none ml-0.5">$1</sup>');
  s = s.replace(/_\{([^{}]+)\}/g, '<sub class="text-[0.75em] leading-none ml-0.5">$1</sub>');
  s = s.replace(/\^([A-Za-z0-9+\-=])/g, '<sup class="text-[0.75em] leading-none">$1</sup>');
  s = s.replace(/_([A-Za-z0-9+\-=])/g, '<sub class="text-[0.75em] leading-none">$1</sub>');

  // Replace known LaTeX Greek letters and math operators
  for (const [cmd, sym] of Object.entries(GREEK_AND_SYMBOLS)) {
    const escaped = cmd.replace(/\\/g, '\\\\');
    s = s.replace(new RegExp(`${escaped}(?![A-Za-z])`, 'g'), sym);
  }

  // Clean remaining formatting commands like \, \; \quad \qquad
  s = s.replace(/\\(?:quad|qquad|,|;|!|:)/g, ' ');

  const wrapperClass = isDisplayMode
    ? 'my-2.5 py-2 px-3.5 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand-border)] block text-center font-serif italic text-[1.08em] tracking-wide'
    : 'px-1.5 py-0.5 mx-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] font-serif italic text-[1.02em] inline-block align-baseline';

  return `<span class="${wrapperClass}">${s}</span>`;
}

export function renderMathAndRichHtml(
  rawHtml: string | undefined | null,
  maskClozeAsQuestion = false,
  activeClozeOrd?: number
): string {
  if (!rawHtml) return '';
  let html = String(rawHtml);
  const targetOrdStr = activeClozeOrd !== undefined ? String(activeClozeOrd) : '1';

  // Strip raw <script> blocks and MDX dictionary index markers (`1`爱`4`);
  // extract scoped `.anki-native-card` <style> blocks BEFORE running Furigana/LaTeX/newline
  // replacements so `\n -> <br/>` never corrupts CSS rules inside `<style>...</style>`!
  html = html.replace(EMBEDDED_SCRIPT_RE, '');
  html = html.replace(MDX_INDEX_MARKER_RE, '');
  const preservedStyleBlocks: string[] = [];
  html = html.replace(EMBEDDED_STYLE_TAG_RE, (fullMatch, cssContent: string) => {
    if (cssContent && cssContent.includes('.anki-native-card')) {
      preservedStyleBlocks.push(fullMatch);
    }
    return '';
  });

  // Convert Japanese Furigana bracket syntax ` 漢字[かな]` into `<ruby>漢字<rt>かな</rt></ruby>`
  if (html.includes('[') && html.includes(']')) {
    html = html.replace(FURIGANA_BRACKET_RE, '<ruby>$1<rt>$2</rt></ruby>');
  }

  // Format Image Occlusion rectangles (<span class="anki-io-rect" ...>{{c1::...}}</span>)
  if (html.includes('anki-io-rect')) {
    const ioRegex =
      /<span\b([^>]*?\bclass\s*=\s*["'][^"']*\banki-io-rect\b[^"']*["'][^>]*)>\s*\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}\s*<\/span>/gi;
    const styleAttrRegex = /\bstyle\s*=\s*(["'])(.*?)\1/i;
    const ioMode = html.includes('data-io-mode="hide-one"') ? 'hide-one' : 'hide-all';

    html = html.replace(ioRegex, (_, attrsStr: string, cNum: string) => {
      const styleMatch = styleAttrRegex.exec(attrsStr || '');
      const posStyle = styleMatch ? styleMatch[2].trim().replace(/;$/, '') : 'position:absolute';
      if (maskClozeAsQuestion) {
        if (cNum === targetOrdStr) {
          return `<span class="anki-io-rect-resolved anki-io-target" data-io-rect="${cNum}" style="${posStyle};background:#F59E0B;border:2px solid #FFFFFF;box-shadow:0 4px 14px rgba(245,158,11,0.45);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:11px;font-weight:800;line-height:1;user-select:none;z-index:3;">? #${cNum}</span>`;
        }
        if (ioMode === 'hide-all') {
          return `<span class="anki-io-rect-resolved anki-io-masked" data-io-rect="${cNum}" style="${posStyle};background:#334155;border:1.5px solid rgba(255,255,255,0.65);border-radius:6px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.78);font-size:10px;font-weight:700;line-height:1;user-select:none;z-index:2;">#${cNum}</span>`;
        }
        return `<span class="anki-io-rect-resolved anki-io-hidden" data-io-rect="${cNum}" style="${posStyle};opacity:0;pointer-events:none;"></span>`;
      }
      if (activeClozeOrd !== undefined && cNum !== targetOrdStr) {
        if (ioMode === 'hide-all') {
          return `<span class="anki-io-rect-resolved anki-io-masked" data-io-rect="${cNum}" style="${posStyle};background:rgba(51,65,85,0.55);border:1.5px solid rgba(255,255,255,0.5);border-radius:6px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.75);font-size:10px;font-weight:700;line-height:1;user-select:none;z-index:2;">#${cNum}</span>`;
        }
        return `<span class="anki-io-rect-resolved anki-io-hidden" data-io-rect="${cNum}" style="${posStyle};opacity:0;pointer-events:none;"></span>`;
      }
      return `<span class="anki-io-rect-resolved anki-io-revealed" data-io-rect="${cNum}" style="${posStyle};background:rgba(16,185,129,0.16);border:2px solid #10B981;border-radius:6px;pointer-events:none;z-index:3;"><span style="position:absolute;top:-1px;left:-1px;background:#10B981;color:#FFFFFF;font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px 0 4px 0;line-height:1.1;">#${cNum}</span></span>`;
    });
  }

  // Format raw {{c1::answer::hint}} Cloze syntax (e.g., in QuickAdd live preview or table view)
  if (CLOZE_PREVIEW_RE.test(html)) {
    html = html.replace(CLOZE_PREVIEW_RE, (_, cNum: string, cAns: string, cHint?: string) => {
      const isTargetOrd = activeClozeOrd === undefined || cNum === targetOrdStr;
      if (maskClozeAsQuestion) {
        if (!isTargetOrd) {
          return cAns;
        }
        const label = cHint ? cHint : '...';
        return `<span class="px-2 py-0.5 rounded bg-[var(--brand-soft-strong)] text-[var(--brand-text)] font-semibold border border-[var(--brand-border)]">[${label}]</span>`;
      }
      if (!isTargetOrd) {
        return cAns;
      }
      return `<span class="px-1.5 py-0.5 rounded bg-[var(--status-success-soft)] text-[var(--status-success)] font-semibold">${cAns}</span>`;
    });
  }

  // 1. Display math: \[ ... \] or $$ ... $$ or [latex] ... [/latex] or [$$] ... [/$$]
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => formatLatexExpression(expr, true));
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => formatLatexExpression(expr, true));
  html = html.replace(/\[latex\]([\s\S]*?)\[\/latex\]/gi, (_, expr) => formatLatexExpression(expr, true));
  html = html.replace(/\[\$\$\]([\s\S]*?)\[\/\$\$\]/g, (_, expr) => formatLatexExpression(expr, true));

  // 2. Inline math: \( ... \) or [$] ... [/$] or $ ... $ (single line, non-currency)
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => formatLatexExpression(expr, false));
  html = html.replace(/\[\$\]([\s\S]*?)\[\/\$\]/g, (_, expr) => formatLatexExpression(expr, false));
  html = html.replace(/\$([^\n$]+?)\$/g, (match, expr) => {
    if (/^\d+(\.\d+)?$/.test(expr.trim())) return match;
    return formatLatexExpression(expr, false);
  });

  // 3. Newline preservation: convert \n to <br/> for plain text / simple fields,
  //    but never inside `.anki-native-card` template HTML where newlines are template indentation.
  if (html.includes('\n') && !html.includes('anki-native-card')) {
    html = html.replace(/(<br\s*\/?>)\s*\r?\n/gi, '$1');
    html = html.replace(/\r\n|\r|\n/g, '<br/>');
  }

  return preservedStyleBlocks.length > 0 ? `${preservedStyleBlocks.join('')}${html}` : html;
}

/**
 * Formats rich card HTML for library preview surfaces by resolving media/math/cloze
 * and normalizing multi-block HTML boundaries so multi-paragraph cards clamp cleanly
 * without overflowing or vertically slicing glyphs inside `-webkit-line-clamp`.
 */
export function formatCardPreviewHtml(
  rawHtml: string | undefined | null,
  options: { singleLine?: boolean; maskClozeAsQuestion?: boolean } = {}
): string {
  const rendered = renderMathAndRichHtml(rawHtml, options.maskClozeAsQuestion ?? false);
  if (!rendered) return '';

  // Strip `<style>` blocks and oversized inline font-size / width / background styles
  // on non-Image-Occlusion elements so 100px/48px/28px deck templates never burst out of
  // compact LibraryView cards or table rows.
  let sanitized = rendered.replace(EMBEDDED_STYLE_TAG_RE, '');
  if (!sanitized.includes('anki-io-wrap')) {
    sanitized = sanitized
      .replace(/<\/?center\b[^>]*>/gi, '')
      .replace(
        /(<(?!span\b[^>]*\banki-io-rect)[^>]+?)\sstyle\s*=\s*(["'])([\s\S]*?)\2/gi,
        (fullMatch, tagPrefix: string, quote: string, styleBody: string) => {
          const cleanedStyle = styleBody
            .replace(
              /\b(?:font-size|line-height|width|min-width|max-width|height|min-height|margin|padding|background|background-color)\s*:[^;]+;?/gi,
              ''
            )
            .trim();
          return cleanedStyle ? `${tagPrefix} style=${quote}${cleanedStyle}${quote}` : tagPrefix;
        }
      );
  }

  // Keep rich media, Image Occlusion wrappers, and tables intact in card boxes
  if (!options.singleLine && /<(?:img|table|svg|canvas|video|audio)\b|anki-io-wrap/i.test(sanitized)) {
    return sanitized;
  }

  let normalized = sanitized
    .replace(/<(p|div|li|blockquote|h[1-6])\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, '<br/>')
    .replace(/<\/?(?:ul|ol)\b[^>]*>/gi, '<br/>')
    .replace(/<li\b[^>]*>/gi, '<br/>• ')
    .replace(/(<\/(?:p|div|li|blockquote|pre|section|article|h[1-6])>)/gi, '$1<br/>')
    .replace(/([^\s>])(<(?:p|div|blockquote|pre|section|article|h[1-6])\b[^>]*>)/gi, '$1<br/>$2')
    .replace(/<hr\b[^>]*>/gi, '<br/>')
    .replace(
      /<br\/>\s*((?:<\/(?:p|div|li|blockquote|pre|section|article|h[1-6])>\s*)+)<br\/>/gi,
      '$1<br/>'
    )
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br/>')
    .replace(/^(?:\s|<br\s*\/?>)+/gi, '')
    .replace(/(?:\s|<br\s*\/?>)+$/gi, '');

  if (options.singleLine) {
    normalized = normalized.replace(/<br\s*\/?>/gi, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  return normalized;
}

/**
 * Deterministic low-saturation SaaS palette color assignment based on deck ID or deck name hash (#6).
 */
const SAAS_DECK_PALETTE = [
  '#5B5BD6', // Indigo
  '#2F9461', // Sage Emerald
  '#2B7ABF', // Nordic Ocean
  '#C27429', // Warm Ochre
  '#C44D6C', // Dusty Rose
  '#23868C', // Fjord Teal
  '#7A50B6', // Twilight Iris
  '#475569', // Graphite Slate
];

export function getDeckColorByHash(identifier: string | undefined | null): string {
  if (!identifier) return SAAS_DECK_PALETTE[0];
  let hash = 0;
  const str = String(identifier);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return SAAS_DECK_PALETTE[hash % SAAS_DECK_PALETTE.length];
}
