import React, { useEffect, useMemo, useRef, useState } from 'react';
import { appActions } from '../../stores/useAppStore';
import { renderLatexInSandboxHtml } from '../../utils/mathRenderer';
import { getSandboxPlayAudioFile } from '../../utils/reviewAudio';

interface SandboxCardFrameProps {
  cardId: string;
  cardOrd?: number;
  frontHtml: string;
  backHtml: string;
  cssText: string;
  mediaHttpBaseUrl?: string;
  preloadScripts?: string[];
  isFlipped: boolean;
  isDark: boolean;
  audioFiles?: string[];
  frontAudioFiles?: string[];
  backAudioFiles?: string[];
  sandboxQuestionAudioFiles?: string[];
  sandboxAnswerAudioFiles?: string[];
  contentScale?: number;
  onImageZoom?: (target: { src: string; alt?: string }) => void;
}

export function normalizeSandboxHttpBaseUrl(raw?: string): string {
  const clean = String(raw || '').trim();
  if (!clean || !/^https?:\/\//i.test(clean)) return '';
  return clean.endsWith('/') ? clean : `${clean}/`;
}

export function sanitizeSandboxPreloadScripts(urls?: string[]): string[] {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of urls) {
    const clean = String(item || '').trim();
    if (!clean || !/^https?:\/\//i.test(clean)) continue;
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface BuildSandboxSrcDocParams {
  cardId: string;
  cardOrd?: number;
  initialBody: string;
  cssText: string;
  isDark: boolean;
  initialZoom: number;
  initialIsFlipped?: boolean;
  mediaHttpBaseUrl?: string;
  preloadScripts?: string[];
}

export function buildSandboxSrcDoc({
  cardId,
  cardOrd,
  initialBody,
  cssText,
  isDark,
  initialZoom,
  initialIsFlipped = false,
  mediaHttpBaseUrl,
  preloadScripts,
}: BuildSandboxSrcDocParams): string {
  const safeCardOrd =
    typeof cardOrd === 'number' && Number.isFinite(cardOrd) && cardOrd >= 1
      ? Math.floor(cardOrd)
      : 1;
  const themeClass = isDark ? 'nightMode night_mode' : '';
  const bodyClass = [`card`, `card${safeCardOrd}`, themeClass].filter(Boolean).join(' ');
  const textColor = isDark ? '#EFEFF5' : '#1D1D1F';
  const normalizedBase = normalizeSandboxHttpBaseUrl(mediaHttpBaseUrl);
  const safePreloadScripts = sanitizeSandboxPreloadScripts(preloadScripts);
  const strippedCss = (cssText || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const templateDefinesClozeStyle = /(?:^|[^a-zA-Z0-9_-])\.cloze(?![a-zA-Z0-9_-])/.test(strippedCss);
  const needsDarkClozeRescue =
    templateDefinesClozeStyle &&
    !/\.night(?:Mode|_mode)[^{]*\.cloze(?![a-zA-Z0-9_-])/i.test(strippedCss) &&
    /\.cloze\s*\{[^}]*(?:^|[;\s])color\s*:\s*(?:blue|black|#000(?:000)?|#0000ff|#00f)\b/i.test(
      strippedCss
    );
  const clozeFallbackCss = templateDefinesClozeStyle
    ? `:where(.cloze) {
    font-weight: 600;
  }${
    needsDarkClozeRescue
      ? `
  .nightMode .cloze,
  .night_mode .cloze {
    color: #98CCFD;
  }`
      : ''
  }`
    : `:where(.cloze) {
    font-weight: 600;
    color: #235F9F;
    background: #D9E8F6;
    padding: 1px 6px;
    border-radius: 5px;
  }
  :where(.cloze[data-cloze]) {
    border: 1px solid #B0D0EF;
  }
  :where(.cloze:not([data-cloze])) {
    color: #2F9461;
    background: #EAF6F0;
  }
  :where(.nightMode .cloze, .night_mode .cloze) {
    color: #98CCFD;
    background: rgba(62, 138, 217, 0.24);
  }
  :where(.nightMode .cloze[data-cloze], .night_mode .cloze[data-cloze]) {
    border-color: rgba(152, 204, 253, 0.38);
  }
  :where(.nightMode .cloze:not([data-cloze]), .night_mode .cloze:not([data-cloze])) {
    color: #3FAE78;
    background: rgba(63, 174, 120, 0.16);
  }`;

  const storageShimTag = `<script>
// 沙盒 iframe 处于隔离源，直接读写 window.localStorage / sessionStorage 会抛 SecurityError。
// 在保持隔离边界不变的前提下提供内存级 Storage 垫片（支持 Object.keys 与属性访问），
// 让依赖存储的第三方模板（如 Cloze Overlapping 随机顺序、JLPT、Persistence 等）正常执行并在正反面间保持状态。
(function () {
  function createMemoryStorage() {
    var store = Object.create(null);
    var methods = {
      getItem: function (key) {
        var k = String(key);
        return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
      },
      setItem: function (key, value) {
        store[String(key)] = String(value);
      },
      removeItem: function (key) {
        delete store[String(key)];
      },
      clear: function () {
        Object.keys(store).forEach(function (k) {
          delete store[k];
        });
      },
      key: function (index) {
        var keys = Object.keys(store);
        var i = Number(index);
        return i >= 0 && i < keys.length ? keys[i] : null;
      }
    };
    if (typeof Proxy === 'function') {
      return new Proxy({}, {
        get: function (_target, prop) {
          if (prop === 'length') return Object.keys(store).length;
          if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(methods, prop)) {
            return methods[prop];
          }
          if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(store, prop)) {
            return store[prop];
          }
          return undefined;
        },
        set: function (_target, prop, value) {
          if (typeof prop === 'string' && prop !== 'length' && !Object.prototype.hasOwnProperty.call(methods, prop)) {
            store[prop] = String(value);
            return true;
          }
          return false;
        },
        deleteProperty: function (_target, prop) {
          if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(store, prop)) {
            delete store[prop];
          }
          return true;
        },
        has: function (_target, prop) {
          return (
            prop === 'length' ||
            (typeof prop === 'string' &&
              (Object.prototype.hasOwnProperty.call(methods, prop) ||
                Object.prototype.hasOwnProperty.call(store, prop)))
          );
        },
        ownKeys: function () {
          return Object.keys(store);
        },
        getOwnPropertyDescriptor: function (_target, prop) {
          if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(store, prop)) {
            return { enumerable: true, configurable: true, writable: true, value: store[prop] };
          }
          return undefined;
        }
      });
    }
    Object.defineProperty(methods, 'length', {
      enumerable: false,
      get: function () {
        return Object.keys(store).length;
      }
    });
    return methods;
  }
  ['localStorage', 'sessionStorage'].forEach(function (propName) {
    try {
      var nativeStore = window[propName];
      if (nativeStore) {
        nativeStore.setItem('__anki_studio_storage_probe__', '1');
        nativeStore.removeItem('__anki_studio_storage_probe__');
        return;
      }
    } catch (e) {}
    try {
      var memStore = createMemoryStorage();
      Object.defineProperty(window, propName, {
        configurable: true,
        enumerable: true,
        get: function () {
          return memStore;
        }
      });
    } catch (e) {}
  });
})();
</script>`;

  const relativeScriptResolverTag = normalizedBase
    ? `<script>
// 仅拦截 <script> 的相对路径赋值并补上本地 HTTP 媒体基址（如 Enhanced Cloze 动态加载 _jquery.min.js），
// 刻意不注入 base 标签，避免破坏页面内的 href="#" 锚点与内联 SVG url(#id) 引用。
(function () {
  var base = ${JSON.stringify(normalizedBase)};
  function resolveRelScript(val) {
    if (typeof val !== 'string') return val;
    var s = val.trim();
    if (!s || /^(?:https?:|\/\/|data:|blob:|file:|\/)/i.test(s)) return val;
    return base + s.replace(/^\.\//, '');
  }
  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (desc && typeof desc.set === 'function') {
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set: function (v) { return desc.set.call(this, resolveRelScript(v)); }
      });
    }
  } catch (e) {}
  try {
    var origSetAttr = HTMLScriptElement.prototype.setAttribute;
    if (typeof origSetAttr === 'function') {
      HTMLScriptElement.prototype.setAttribute = function (name, value) {
        if (typeof name === 'string' && name.toLowerCase() === 'src') {
          return origSetAttr.call(this, name, resolveRelScript(String(value)));
        }
        return origSetAttr.call(this, name, value);
      };
    }
  } catch (e) {}
})();
</script>`
    : '';

  const preloadScriptTags = safePreloadScripts
    .map((src) => `<script src="${escapeHtmlAttr(src)}"></script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html {
    margin: 0;
    padding: 0;
    background: transparent;
    overflow-x: hidden;
    overflow-y: hidden;
    overscroll-behavior-x: none;
  }
  body {
    margin: 0;
    padding: 0;
    background: transparent;
    color: ${textColor};
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", sans-serif;
    overscroll-behavior-x: none;
  }
  .card {
    background: transparent;
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: break-word;
  }
  .card.nightMode,
  .card.night_mode {
    background: transparent;
    color: #EFEFF5;
  }
  #qa {
    zoom: ${initialZoom};
  }
  img {
    max-width: 100%;
    height: auto;
    cursor: zoom-in;
  }
  a img, button img, [onclick] img {
    cursor: pointer;
  }
  ${clozeFallbackCss}
  .cloze-inactive {
    font-weight: inherit;
    color: inherit;
  }
  .anki-math-inline {
    display: inline-block;
    vertical-align: baseline;
    padding: 1px 6px;
    margin: 0 2px;
    border-radius: 5px;
    background: #ECF3FA;
    color: #235F9F;
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-size: 1.02em;
  }
  .anki-math-display {
    display: block;
    margin: 10px 0;
    padding: 8px 14px;
    border-radius: 12px;
    background: #ECF3FA;
    border: 1px solid #B0D0EF;
    color: #235F9F;
    text-align: center;
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-size: 1.08em;
    letter-spacing: 0.02em;
  }
  .nightMode .anki-math-inline,
  .night_mode .anki-math-inline {
    background: rgba(62, 138, 217, 0.18);
    color: #98CCFD;
  }
  .nightMode .anki-math-display,
  .night_mode .anki-math-display {
    background: rgba(62, 138, 217, 0.18);
    border-color: rgba(152, 204, 253, 0.35);
    color: #98CCFD;
  }
  .anki-math-fn {
    font-style: normal;
  }
  .anki-math-text {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
    font-style: normal;
  }
  .anki-math-frac {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    vertical-align: middle;
    margin: 0 4px;
    font-size: 0.9em;
    line-height: 1.2;
  }
  .anki-math-frac-num {
    border-bottom: 1px solid currentColor;
    padding: 0 4px 2px;
  }
  .anki-math-frac-den {
    padding: 2px 4px 0;
  }
  .anki-math-sqrt {
    display: inline-flex;
    align-items: baseline;
  }
  .anki-math-sqrt-idx {
    font-size: 0.7em;
    margin-inline-end: 2px;
  }
  .anki-math-sqrt-rad {
    border-top: 1px solid currentColor;
    padding: 0 2px;
  }
  .anki-math-sup,
  .anki-math-sub {
    font-size: 0.75em;
    line-height: 1;
    margin-inline-start: 1px;
  }
</style>
<style id="anki-model-css">
${cssText || ''}
</style>
${storageShimTag}
${relativeScriptResolverTag}
${preloadScriptTags}
<script>
// 部分中文选择题/刷题模板（如「选择题模板（单选多选自动匹配）」）依赖作者配套
// 插件注入的全局状态 gData；缺失时模板脚本会直接抛 ReferenceError，选项列表与
// 判分全部失效。这里在沙盒里预置一个中性兼容对象，让这类模板可以独立运行。
(function () {
  if (typeof window.gData === 'undefined') {
    window.gData = {
      clickedValues: [],
      correct: 0,
      total: 0,
      sum: 0,
      score: 0,
      clickNum: 0,
      options: [],
      correctanswer: [],
      list: '',
    };
  }
})();
</script>
<script>
(function() {
  window.pycmd = function(cmd) {
    try {
      parent.postMessage({
        type: 'anki-sandbox-pycmd',
        cardId: ${JSON.stringify(cardId)},
        cmd: String(cmd || '')
      }, '*');
    } catch (e) {}
  };
  window.ankiPlatform = 'desktop';

  function runScriptsIn(container) {
    if (!container) return;
    var scripts = Array.prototype.slice.call(container.querySelectorAll('script'));
    scripts.forEach(function(oldScript) {
      var newScript = document.createElement('script');
      Array.prototype.slice.call(oldScript.attributes).forEach(function(attr) {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      if (oldScript.parentNode) {
        oldScript.parentNode.replaceChild(newScript, oldScript);
      }
    });
  }

  var lastReportedHeight = 0;
  function reportHeight() {
    var qa = document.getElementById('qa');
    var body = document.body;
    var docEl = document.documentElement;
    if (!body || !docEl) return;
    var bodyMarginY = 0;
    try {
      var bodyCs = window.getComputedStyle(body);
      bodyMarginY =
        Math.max(0, parseFloat(bodyCs.marginTop) || 0) +
        Math.max(0, parseFloat(bodyCs.marginBottom) || 0);
    } catch (e) {}
    var rawH = Math.max(
      qa ? qa.scrollHeight + bodyMarginY : 0,
      qa ? qa.offsetHeight + bodyMarginY : 0,
      body.scrollHeight + bodyMarginY,
      body.offsetHeight + bodyMarginY
    );
    var currentZoom = parseFloat((qa && qa.style && qa.style.zoom) || '${initialZoom}') || 1;
    var h = rawH * (currentZoom > 1 ? 1 : 1);
    if (qa) {
      var rect = qa.getBoundingClientRect();
      if (rect && rect.height) {
        h = Math.max(h, rect.height + bodyMarginY);
      }
    }
    var clamped = Math.max(120, Math.min(4200, Math.ceil(h + 8)));
    if (Math.abs(clamped - lastReportedHeight) >= 2) {
      lastReportedHeight = clamped;
      parent.postMessage({
        type: 'anki-sandbox-height',
        cardId: ${JSON.stringify(cardId)},
        height: clamped
      }, '*');
    }
  }

  function bindMediaLoadEvents(root) {
    if (!root) return;
    Array.prototype.slice.call(root.querySelectorAll('img')).forEach(function(img) {
      if (!img.complete) {
        img.addEventListener('load', reportHeight, { once: true });
        img.addEventListener('error', reportHeight, { once: true });
      }
    });
  }

  var sandboxIsFlipped = ${initialIsFlipped ? 'true' : 'false'};

  window.addEventListener('message', function(ev) {
    var data = ev.data;
    if (!data || data.cardId !== ${JSON.stringify(cardId)}) return;
    if (data.type === 'anki-sandbox-scale') {
      var qaEl = document.getElementById('qa');
      if (qaEl) {
        qaEl.style.zoom = String(data.scale || 1);
        requestAnimationFrame(function() {
          reportHeight();
          setTimeout(reportHeight, 60);
        });
      }
      return;
    }
    if (data.type !== 'anki-sandbox-flip') return;
    sandboxIsFlipped = Boolean(data.isFlipped);
    var qa = document.getElementById('qa');
    if (!qa) return;
    qa.innerHTML = data.html || '';
    runScriptsIn(qa);
    bindMediaLoadEvents(qa);
    requestAnimationFrame(function() {
      reportHeight();
      setTimeout(reportHeight, 60);
    });
  });

  function hasInnerHorizontalScroller(target, rawDeltaX) {
    var node = target && target.nodeType === 1 ? target : (target && target.parentElement ? target.parentElement : null);
    while (node && node !== document.documentElement) {
      if (node.scrollWidth > node.clientWidth + 1) {
        var ov = '';
        try {
          ov = window.getComputedStyle(node).overflowX || '';
        } catch (err) {}
        if (ov === 'auto' || ov === 'scroll' || ov === 'overlay') {
          var maxLeft = node.scrollWidth - node.clientWidth;
          if (rawDeltaX > 0 && node.scrollLeft < maxLeft - 1) return true;
          if (rawDeltaX < 0 && node.scrollLeft > 1) return true;
          if (node.scrollLeft > 1 && node.scrollLeft < maxLeft - 1) return true;
        }
      }
      node = node.parentElement;
    }
    return false;
  }

  function hasInnerVerticalScroller(target, rawDeltaY) {
    var node = target && target.nodeType === 1 ? target : (target && target.parentElement ? target.parentElement : null);
    while (node && node !== document.documentElement) {
      if (node.scrollHeight > node.clientHeight + 1) {
        var ov = '';
        try {
          ov = window.getComputedStyle(node).overflowY || '';
        } catch (err) {}
        if (ov === 'auto' || ov === 'scroll' || ov === 'overlay') {
          var maxTop = node.scrollHeight - node.clientHeight;
          if (rawDeltaY > 0 && node.scrollTop < maxTop - 1) return true;
          if (rawDeltaY < 0 && node.scrollTop > 1) return true;
          if (node.scrollTop > 1 && node.scrollTop < maxTop - 1) return true;
        }
      }
      node = node.parentElement;
    }
    var se = document.scrollingElement || document.documentElement;
    if (se && se.scrollHeight > se.clientHeight + 1 && se.scrollTop > 1) {
      return true;
    }
    return false;
  }

  var horizPreventUntil = 0;

  window.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      parent.postMessage({
        type: 'anki-sandbox-pinch',
        cardId: ${JSON.stringify(cardId)}
      }, '*');
      return;
    }
    if (e.deltaMode !== 0) return;
    var t = e.target;
    var isTyping = Boolean(
      t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    );
    if (isTyping) return;
    var now = Date.now();
    var absX = Math.abs(e.deltaX || 0);
    var absY = Math.abs(e.deltaY || 0);
    var dy = e.deltaY || 0;
    var innerHScroll = absX >= 0.01 ? hasInnerHorizontalScroller(t, e.deltaX || 0) : false;
    var innerVScroll = absY >= 0.01 ? hasInnerVerticalScroller(t, dy) : false;
    var strongHoriz = !innerHScroll && absX > absY * 1.35 && absX >= 0.8;
    if (strongHoriz) {
      horizPreventUntil = now + 220;
      e.preventDefault();
    } else if (!innerHScroll && now < horizPreventUntil && absX >= 0.25 && absX >= absY * 0.45) {
      horizPreventUntil = now + 180;
      e.preventDefault();
    } else if (absY > absX * 1.35 && absY >= 4) {
      horizPreventUntil = 0;
    }
    parent.postMessage({
      type: 'anki-sandbox-wheel',
      cardId: ${JSON.stringify(cardId)},
      deltaX: Number(e.deltaX || 0),
      deltaY: Number(e.deltaY || 0),
      deltaMode: Number(e.deltaMode || 0),
      hasInnerHScroll: innerHScroll,
      hasInnerVScroll: innerVScroll
    }, '*');
  }, { passive: false });

  window.addEventListener('keydown', function(e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }
    var k = e.key;
    var c = e.code || '';
    if (
      k === ' ' ||
      k === 'Enter' ||
      k === 'Escape' ||
      k === 'Tab' ||
      k === '1' ||
      k === '2' ||
      k === '3' ||
      k === '4' ||
      k.toLowerCase() === 'r' ||
      k.toLowerCase() === 'e' ||
      ((e.metaKey || e.ctrlKey) && (
        k.toLowerCase() === 'z' ||
        k.toLowerCase() === 'i' ||
        /^[0-7]$/.test(k) ||
        k === '=' ||
        k === '+' ||
        k === '-' ||
        k === '_' ||
        k === ')' ||
        c === 'Digit0'
      ))
    ) {
      e.preventDefault();
      parent.postMessage({
        type: 'anki-sandbox-key',
        cardId: ${JSON.stringify(cardId)},
        key: k,
        code: c,
        altKey: Boolean(e.altKey),
        metaKey: Boolean(e.metaKey),
        ctrlKey: Boolean(e.ctrlKey),
        shiftKey: Boolean(e.shiftKey)
      }, '*');
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    var qa = document.getElementById('qa');
    bindMediaLoadEvents(qa);
    if (typeof ResizeObserver !== 'undefined' && qa) {
      var ro = new ResizeObserver(function() {
        reportHeight();
      });
      ro.observe(qa);
      ro.observe(document.body);
    }
    if (typeof MutationObserver !== 'undefined' && qa) {
      var mo = new MutationObserver(function() {
        reportHeight();
      });
      mo.observe(qa, { childList: true, subtree: true, attributes: true });
    }
    document.addEventListener('click', function(e) {
      var clickedEl = e.target;
      var interactiveAncestor = null;
      var walk = clickedEl;
      while (walk && walk.nodeType === 1) {
        var walkTag = walk.tagName;
        if (walkTag === 'A' || walkTag === 'BUTTON' || (walk.hasAttribute && walk.hasAttribute('onclick'))) {
          interactiveAncestor = walk;
          break;
        }
        walk = walk.parentElement;
      }
      if (clickedEl && clickedEl.tagName === 'IMG' && !interactiveAncestor) {
        var imgSrc = clickedEl.currentSrc || clickedEl.src || '';
        if (imgSrc) {
          e.preventDefault();
          parent.postMessage({
            type: 'anki-sandbox-img-zoom',
            cardId: ${JSON.stringify(cardId)},
            src: imgSrc,
            alt: clickedEl.alt || ''
          }, '*');
          return;
        }
      }
      setTimeout(reportHeight, 30);
      setTimeout(reportHeight, 150);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(reportHeight).catch(function() {});
    }
    reportHeight();
    setTimeout(reportHeight, 80);
    setTimeout(reportHeight, 250);
  });
})();
</script>
</head>
<body class="${bodyClass}">
  <div id="qa">${renderLatexInSandboxHtml(initialBody)}</div>
</body>
</html>`;
}

export const SandboxCardFrame: React.FC<SandboxCardFrameProps> = ({
  cardId,
  cardOrd,
  frontHtml,
  backHtml,
  cssText,
  mediaHttpBaseUrl,
  preloadScripts,
  isFlipped,
  isDark,
  audioFiles,
  frontAudioFiles,
  backAudioFiles,
  sandboxQuestionAudioFiles,
  sandboxAnswerAudioFiles,
  contentScale = 1,
  onImageZoom,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameHeight, setFrameHeight] = useState<number>(280);
  const initialSideHtmlRef = useRef<string>(isFlipped ? backHtml : frontHtml);
  const initialScaleRef = useRef<number>(contentScale);
  const initialFlippedRef = useRef<boolean>(isFlipped);
  const prevCardIdRef = useRef<string>(cardId);

  if (prevCardIdRef.current !== cardId) {
    prevCardIdRef.current = cardId;
    initialSideHtmlRef.current = isFlipped ? backHtml : frontHtml;
    initialScaleRef.current = contentScale;
    initialFlippedRef.current = isFlipped;
  }

  const preloadKey = (preloadScripts || []).join('\u0000');

  const srcDocHtml = useMemo(
    () =>
      buildSandboxSrcDoc({
        cardId,
        cardOrd,
        initialBody: initialSideHtmlRef.current || '',
        cssText,
        isDark,
        initialZoom: initialScaleRef.current || 1,
        initialIsFlipped: initialFlippedRef.current,
        mediaHttpBaseUrl,
        preloadScripts,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardId, cardOrd, cssText, isDark, mediaHttpBaseUrl, preloadKey]
  );

  // Swap #qa in-place on flip without reloading the iframe (prevents white flash!)
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'anki-sandbox-flip',
        cardId,
        isFlipped,
        html: renderLatexInSandboxHtml(isFlipped ? backHtml : frontHtml),
      },
      '*'
    );
  }, [cardId, isFlipped, frontHtml, backHtml]);

  // Update internal #qa scale live without reloading the iframe
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'anki-sandbox-scale',
        cardId,
        scale: contentScale,
      },
      '*'
    );
  }, [cardId, contentScale]);

  // Listen for height updates, pycmd whitelist commands, image zoom, and forwarded keyboard shortcuts
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.cardId !== cardId) return;

      if (data.type === 'anki-sandbox-height' && typeof data.height === 'number') {
        setFrameHeight(Math.max(120, Math.min(4200, Math.round(data.height))));
      } else if (data.type === 'anki-sandbox-img-zoom' && data.src) {
        onImageZoom?.({ src: String(data.src), alt: data.alt ? String(data.alt) : undefined });
      } else if (data.type === 'anki-sandbox-pycmd') {
        const cmd = String(data.cmd || '').trim();
        if (cmd === 'ans' || cmd === 'flip') {
          appActions.flipCard();
        } else if (cmd.startsWith('ease') && /^[1-4]$/.test(cmd.slice(4))) {
          const easeNum = parseInt(cmd.slice(4), 10) as 1 | 2 | 3 | 4;
          appActions.answerCurrentCard(easeNum);
        } else if (cmd.startsWith('play:')) {
          const parts = cmd.split(':');
          const sidePart = parts[1] || 'a';
          const idx = parseInt(parts[2] || '0', 10) || 0;
          const targetAudio = getSandboxPlayAudioFile(
            {
              audioFiles,
              frontAudioFiles,
              backAudioFiles,
              sandboxQuestionAudioFiles,
              sandboxAnswerAudioFiles,
            },
            sidePart,
            idx
          );
          appActions.playAudio(targetAudio);
        }
      } else if (data.type === 'anki-sandbox-key') {
        const synthetic = new KeyboardEvent('keydown', {
          key: data.key,
          code: data.code || '',
          altKey: Boolean(data.altKey),
          metaKey: Boolean(data.metaKey),
          ctrlKey: Boolean(data.ctrlKey),
          shiftKey: Boolean(data.shiftKey),
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(synthetic);
      } else if (data.type === 'anki-sandbox-pinch') {
        window.dispatchEvent(
          new CustomEvent('anki:sandbox-pinch', {
            detail: { cardId: data.cardId },
          })
        );
      } else if (data.type === 'anki-sandbox-wheel') {
        window.dispatchEvent(
          new CustomEvent('anki:sandbox-wheel', {
            detail: {
              cardId: data.cardId,
              deltaX: Number(data.deltaX || 0),
              deltaY: Number(data.deltaY || 0),
              deltaMode: Number(data.deltaMode || 0),
              hasInnerHScroll: Boolean(data.hasInnerHScroll),
              hasInnerVScroll: Boolean(data.hasInnerVScroll),
            },
          })
        );
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    cardId,
    audioFiles,
    frontAudioFiles,
    backAudioFiles,
    sandboxQuestionAudioFiles,
    sandboxAnswerAudioFiles,
    onImageZoom,
  ]);

  return (
    <iframe
      ref={iframeRef}
      key={cardId}
      title={`card-sandbox-${cardId}`}
      sandbox="allow-scripts"
      srcDoc={srcDocHtml}
      style={{ height: `${frameHeight}px` }}
      className="w-full border-0 bg-transparent rounded-xl transition-[height] duration-150 block"
    />
  );
};
