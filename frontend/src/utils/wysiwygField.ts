// ============================================================================
// 编辑器 → 笔记字段 的序列化
//
// 单独抽出来有两个原因：
//   1. 这段逻辑决定「存进 Anki 的到底是什么」，是数据保真的最后一道关，值得被
//      静态审计和（将来）DOM 测试直接盯住，而不是埋在 1700 行的组件里；
//   2. 它只依赖 DOM，不依赖 React，可以脱离组件单独跑。
// ============================================================================

const ZWSP = '\u200B';

/**
 * 把编辑器 DOM 序列化成标准 Anki 字段内容。
 *
 * - `.anki-cloze-pill` → `{{cN::正文::提示}}`
 * - 清掉空的 `<mark>` 幽灵与内部零宽空格光标锚点
 *
 * ⚠️ 挖空正文取的是 **innerHTML 而不是 textContent**。`{{c1::...}}` 里可以放
 * `<b>`、`<img>`（Anki 原生完全支持），而 textContent 会把这些标签静默吃掉，于是
 * 「打开一张带加粗挖空的卡 → 顺手保存 → 加粗没了」。这类丢数据比显示差异严重得多，
 * 所以宁可在字符串上做几步裁剪，也不退化成纯文本。
 */
export function serializeFromWysiwyg(container: HTMLElement | null): string {
  if (!container) return '';
  const clone = container.cloneNode(true) as HTMLElement;

  // 用占位符换出挖空，最后再替换回 `{{cN::…}}`。
  // 不能直接把 `{{cN::…}}` 建成文本节点：`innerHTML` 序列化文本节点时会把 `<b>`
  // 转义成 `&lt;b&gt;`，存进字段就成了「字面量标签」——看起来像没坏，实际 Cloze
  // 里印着 `<b>` 四个字符。占位符用控制字符包裹，不会被内容或转义规则撞上。
  const pending: string[] = [];
  const token = (i: number) => `\u0001ANKI_CLOZE_${i}\u0001`;

  clone.querySelectorAll('.anki-cloze-pill').forEach((pill) => {
    const ord = pill.getAttribute('data-cloze-ord') || '1';
    const hint = pill.getAttribute('data-cloze-hint');
    const bodyEl = pill.querySelector('.anki-cloze-body');

    // 在副本上裁剪，别动真实 DOM（否则会把用户正在编辑的内容改掉）
    const src = (bodyEl || pill).cloneNode(true) as HTMLElement;
    // 编辑器自己画的 "cN:" 前缀不属于内容
    src.querySelectorAll('.anki-cloze-prefix').forEach((p) => p.remove());

    // hint 是建 pill 时拼在正文末尾的纯文本（不在任何子元素里），要单独摘掉，
    // 否则每保存一次正文末尾就多一截 "(提示)"。
    if (hint) {
      const walker = document.createTreeWalker(src, NodeFilter.SHOW_TEXT);
      let last: Text | null = null;
      let node: Node | null = walker.nextNode();
      while (node) {
        last = node as Text;
        node = walker.nextNode();
      }
      if (last) {
        const suffix = `(${hint})`;
        const data = last.data.replace(/\u200B/g, '');
        if (data.endsWith(suffix)) {
          last.data = data.slice(0, -suffix.length).trimEnd();
        }
      }
    }

    let html = src.innerHTML.replace(/\u200B/g, '');
    html = html.replace(new RegExp(`^c${ord}:\\s*`), '').trim();
    if (!html.trim()) {
      pill.parentNode?.removeChild(pill);
      return;
    }
    const ankiCloze = hint ? `{{c${ord}::${html}::${hint}}}` : `{{c${ord}::${html}}}`;
    const idx = pending.push(ankiCloze) - 1;
    pill.parentNode?.replaceChild(document.createTextNode(token(idx)), pill);
  });

  // 清掉空的高亮幽灵。只包着一张图的高亮不算空——按 textContent 判空会把图一起删掉。
  clone.querySelectorAll('mark').forEach((mk) => {
    const clean = (mk.textContent || '').replace(/\u200B/g, '');
    const hasMedia = mk.querySelector('img, video, audio, math') !== null;
    if (!clean.trim() && !hasMedia) {
      mk.parentNode?.removeChild(mk);
    } else {
      mk.removeAttribute('data-empty');
    }
  });

  let serialized = clone.innerHTML.replace(/\u200B/g, '');
  if (pending.length > 0) {
    serialized = serialized.replace(/\u0001ANKI_CLOZE_(\d+)\u0001/g, (_m, i: string) => pending[Number(i)] ?? '');
  }
  if (serialized === '<br>' || serialized === '<p><br></p>') {
    return '';
  }
  return serialized;
}
