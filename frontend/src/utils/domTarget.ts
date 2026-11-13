/**
 * DOM 事件 target 的安全工具。
 *
 * `event.target` 不一定是 Element：Window/WebView 场景下可能是 document，
 * 文本节点等也可能出现。它们没有 `.closest()` / `.isContentEditable`，
 * 直接调用会抛 `TypeError: xxx.closest is not a function`。
 * 这里用鸭子类型做统一防御，避免各处重复写 typeof 检查。
 */

/** 仅当 target 是带 closest 的 Element 时返回匹配祖先，否则返回 null。 */
export function getClosestFromTarget(
  target: EventTarget | null | undefined,
  selector: string
): Element | null {
  if (!target || typeof (target as Element).closest !== 'function') {
    return null;
  }
  const element = target as Element;
  return element.closest(selector);
}

/** 事件是否发生在可输入区域（input / textarea / select / contentEditable）。 */
export function isTypingTarget(target: EventTarget | null | undefined): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  if (typeof element.closest !== 'function') return false;
  return Boolean(
    element.isContentEditable ||
      element.closest('input, textarea, select, [contenteditable="true"]')
  );
}
