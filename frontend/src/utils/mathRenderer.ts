// ============================================================================
// Anki Studio — Pure Offline LaTeX / MathJax Formula & Rich HTML Renderer
// Converts \( ... \), \[ ... \], $$ ... $$, $ ... $, [latex]...[/latex],
// [$]...[/$], and Cloze {{c1::...}} into clean, styled HTML without external CDNs.
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

function formatLatexExpression(expr: string, isDisplayMode: boolean): string {
  // Bug #13 Fix: Escape raw `<` and `>` first so `a < b` or `x > 0` is never parsed as an HTML tag
  let s = expr
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Remove \left and \right sizing commands
  s = s.replace(/\\left\b/g, '').replace(/\\right\b/g, '');

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
  maskClozeAsQuestion = false
): string {
  if (!rawHtml) return '';
  let html = String(rawHtml);

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
        if (cNum === '1') {
          return `<span class="anki-io-rect-resolved anki-io-target" data-io-rect="${cNum}" style="${posStyle};background:#F59E0B;border:2px solid #FFFFFF;box-shadow:0 4px 14px rgba(245,158,11,0.45);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:11px;font-weight:800;line-height:1;user-select:none;z-index:3;">? #${cNum}</span>`;
        }
        if (ioMode === 'hide-all') {
          return `<span class="anki-io-rect-resolved anki-io-masked" data-io-rect="${cNum}" style="${posStyle};background:#334155;border:1.5px solid rgba(255,255,255,0.65);border-radius:6px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.78);font-size:10px;font-weight:700;line-height:1;user-select:none;z-index:2;">#${cNum}</span>`;
        }
        return `<span class="anki-io-rect-resolved anki-io-hidden" data-io-rect="${cNum}" style="${posStyle};opacity:0;pointer-events:none;"></span>`;
      }
      return `<span class="anki-io-rect-resolved anki-io-revealed" data-io-rect="${cNum}" style="${posStyle};background:rgba(16,185,129,0.16);border:2px solid #10B981;border-radius:6px;pointer-events:none;z-index:3;"><span style="position:absolute;top:-1px;left:-1px;background:#10B981;color:#FFFFFF;font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px 0 4px 0;line-height:1.1;">#${cNum}</span></span>`;
    });
  }

  // Format raw {{c1::answer::hint}} Cloze syntax (e.g., in QuickAdd live preview or table view)
  if (CLOZE_PREVIEW_RE.test(html)) {
    html = html.replace(CLOZE_PREVIEW_RE, (_, _cNum, cAns, cHint) => {
      if (maskClozeAsQuestion) {
        const label = cHint ? cHint : '...';
        return `<span class="px-2 py-0.5 rounded bg-[var(--brand-soft-strong)] text-[var(--brand-text)] font-semibold border border-[var(--brand-border)]">[${label}]</span>`;
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

  // 3. Newline preservation: convert \n to <br/> if not preceded by <br>
  if (html.includes('\n')) {
    html = html.replace(/(<br\s*\/?>)\s*\r?\n/gi, '$1');
    html = html.replace(/\r\n|\r|\n/g, '<br/>');
  }

  return html;
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
