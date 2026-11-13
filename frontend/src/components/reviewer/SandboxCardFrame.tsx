import React, { useEffect, useMemo, useRef, useState } from 'react';
import { appActions } from '../../stores/useAppStore';

interface SandboxCardFrameProps {
  cardId: string;
  frontHtml: string;
  backHtml: string;
  cssText: string;
  isFlipped: boolean;
  isDark: boolean;
  audioFiles?: string[];
}

export const SandboxCardFrame: React.FC<SandboxCardFrameProps> = ({
  cardId,
  frontHtml,
  backHtml,
  cssText,
  isFlipped,
  isDark,
  audioFiles,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameHeight, setFrameHeight] = useState<number>(280);
  const initialSideHtmlRef = useRef<string>(isFlipped ? backHtml : frontHtml);
  const prevCardIdRef = useRef<string>(cardId);

  if (prevCardIdRef.current !== cardId) {
    prevCardIdRef.current = cardId;
    initialSideHtmlRef.current = isFlipped ? backHtml : frontHtml;
  }

  const srcDocHtml = useMemo(() => {
    const initialBody = initialSideHtmlRef.current || '';
    const themeClass = isDark ? 'nightMode night_mode' : '';
    const textColor = isDark ? '#EFEFF5' : '#1D1D1F';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: transparent !important;
    color: ${textColor};
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", sans-serif;
    overflow-x: hidden;
    overflow-y: hidden;
  }
  .card {
    background: transparent !important;
    box-sizing: border-box;
    width: 100%;
    overflow-wrap: break-word;
  }
  img {
    max-width: 100%;
    height: auto;
  }
</style>
<style id="anki-model-css">
${cssText || ''}
</style>
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
    var h = Math.max(
      qa ? qa.scrollHeight : 0,
      qa ? qa.offsetHeight : 0,
      body.scrollHeight,
      body.offsetHeight
    );
    var clamped = Math.max(120, Math.min(2600, Math.ceil(h + 8)));
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

  window.addEventListener('message', function(ev) {
    var data = ev.data;
    if (!data || data.type !== 'anki-sandbox-flip' || data.cardId !== ${JSON.stringify(cardId)}) return;
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

  window.addEventListener('keydown', function(e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }
    var k = e.key;
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
      ((e.metaKey || e.ctrlKey) && (k.toLowerCase() === 'z' || k.toLowerCase() === 'i' || /^[0-7]$/.test(k)))
    ) {
      e.preventDefault();
      parent.postMessage({
        type: 'anki-sandbox-key',
        cardId: ${JSON.stringify(cardId)},
        key: k,
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
    document.addEventListener('click', function() {
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
<body class="card ${themeClass}">
  <div id="qa">${initialBody}</div>
</body>
</html>`;
  }, [cardId, cssText, isDark]);

  // Swap #qa in-place on flip without reloading the iframe (prevents white flash!)
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'anki-sandbox-flip',
        cardId,
        isFlipped,
        html: isFlipped ? backHtml : frontHtml,
      },
      '*'
    );
  }, [cardId, isFlipped, frontHtml, backHtml]);

  // Listen for height updates, pycmd whitelist commands, and forwarded keyboard shortcuts
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.cardId !== cardId) return;

      if (data.type === 'anki-sandbox-height' && typeof data.height === 'number') {
        setFrameHeight(Math.max(120, Math.min(2600, Math.round(data.height))));
      } else if (data.type === 'anki-sandbox-pycmd') {
        const cmd = String(data.cmd || '').trim();
        if (cmd === 'ans' || cmd === 'flip') {
          appActions.flipCard();
        } else if (cmd.startsWith('ease') && /^[1-4]$/.test(cmd.slice(4))) {
          const easeNum = parseInt(cmd.slice(4), 10) as 1 | 2 | 3 | 4;
          appActions.answerCurrentCard(easeNum);
        } else if (cmd.startsWith('play:')) {
          const parts = cmd.split(':');
          const idx = parseInt(parts[2] || '0', 10) || 0;
          const targetAudio = audioFiles && audioFiles[idx] ? audioFiles[idx] : audioFiles?.[0];
          appActions.playAudio(targetAudio);
        }
      } else if (data.type === 'anki-sandbox-key') {
        const synthetic = new KeyboardEvent('keydown', {
          key: data.key,
          altKey: Boolean(data.altKey),
          metaKey: Boolean(data.metaKey),
          ctrlKey: Boolean(data.ctrlKey),
          shiftKey: Boolean(data.shiftKey),
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(synthetic);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [cardId, audioFiles]);

  return (
    <iframe
      ref={iframeRef}
      key={cardId}
      title={`card-sandbox-${cardId}`}
      sandbox="allow-scripts"
      srcDoc={srcDocHtml}
      style={{ height: `${frameHeight}px` }}
      className="w-full border-0 bg-transparent transition-[height] duration-150 block"
    />
  );
};
