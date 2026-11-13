// ============================================================================
// DOM 事件 target 防御
//
// `event.target` 不一定是 Element：Windows/WebView 下可能是 document，
// 文本节点也可能出现。它们没有 `.closest()`，直接调用会抛
// `TypeError: xxx.closest is not a function`。这里钉住两件事：
//   1. 非 Element target 必须安全降级，不能抛错；
//   2. 真正的 Element / contentEditable 仍要按原逻辑识别。
// ============================================================================

import { section, test, equal } from '../harness';
import {
  getClosestFromTarget,
  isTypingTarget,
} from '../../../frontend/src/utils/domTarget';

section('dom target · 非 Element target 防御');

test('document / 文本节点 / null 不会抛错，按未命中处理', () => {
  const targets: Array<unknown> = [
    null,
    undefined,
    {},
    { nodeType: 9 },
    { nodeType: 3, textContent: 'x' },
  ];
  for (const target of targets) {
    equal(getClosestFromTarget(target as EventTarget | null, 'input'), null);
    equal(isTypingTarget(target as EventTarget | null), false);
  }
});

test('Element target 正常匹配 closest 与 contentEditable', () => {
  const inputAncestor = { tagName: 'INPUT' };
  const element = {
    isContentEditable: false,
    closest: (selector: string) => (selector.includes('input') ? inputAncestor : null),
  };
  equal(getClosestFromTarget(element as unknown as EventTarget, 'input'), inputAncestor);
  equal(isTypingTarget(element as unknown as EventTarget), true);
});

test('contentEditable 元素直接判为输入区域', () => {
  const editable = {
    isContentEditable: true,
    closest: () => null,
  };
  equal(isTypingTarget(editable as unknown as EventTarget), true);
  equal(getClosestFromTarget(editable as unknown as EventTarget, 'input'), null);
});

test('Element 无匹配祖先时返回 null / false', () => {
  const element = {
    isContentEditable: false,
    closest: () => null,
  };
  equal(getClosestFromTarget(element as unknown as EventTarget, 'button'), null);
  equal(isTypingTarget(element as unknown as EventTarget), false);
});
