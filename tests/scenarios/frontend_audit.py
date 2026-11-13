#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""前端静态审计（Windows 测试机可直接用 Python 跑，不需要 Node）。

重点盯住一类真实踩过的线上问题：`event.target` 不一定是 Element。
有些 Windows/WebView 场景下它是 `document`，没有 `.closest()`，直接调用会抛
`TypeError: xxx.closest is not a function`。产品侧已把判断收拢到
`frontend/src/utils/domTarget.ts`，这个脚本负责防止有人再绕过 helper。

检查项：
  1. domTarget.ts 存在且包含鸭子类型判断
  2. helper 同时处理 closest 与 contentEditable
  3. helper 导出两个函数
  4. 复习界面使用 isTypingTarget
  5. 窗口拖拽使用 getClosestFromTarget
  6. helper 之外没有任何直接 .closest( 调用
  7. 构建产物里也包含该防御逻辑
  8. 挖空序列化必须用 innerHTML（否则 cloze 里的富文本被吃掉）
  9. 表格内联样式不得烘进界面主题（原生白底上表头会不可见）
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "frontend" / "src"
HELPER = SRC / "utils" / "domTarget.ts"


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def main() -> int:
    failures: list[str] = []
    checks = 0

    def check(ok: bool, message: str) -> None:
        nonlocal checks
        checks += 1
        if not ok:
            failures.append(message)

    helper_src = read(HELPER)
    check(HELPER.exists(), f"缺少 {HELPER.relative_to(ROOT)}")
    check(
        "typeof (target as Element).closest !== 'function'" in helper_src,
        "domTarget.ts 缺少 closest 鸭子类型判断",
    )
    check(
        "isContentEditable" in helper_src,
        "domTarget.ts 缺少 contentEditable 判断",
    )
    check(
        "export function getClosestFromTarget" in helper_src
        and "export function isTypingTarget" in helper_src,
        "domTarget.ts 未导出两个防御 helper",
    )

    reviewer_src = read(SRC / "components" / "reviewer" / "ReviewerView.tsx")
    drag_src = read(SRC / "utils" / "windowDrag.ts")
    check("isTypingTarget" in reviewer_src, "ReviewerView 未使用 isTypingTarget")
    check(
        "getClosestFromTarget" in drag_src,
        "windowDrag 未使用 getClosestFromTarget",
    )

    offenders: list[str] = []
    for path in sorted(SRC.rglob("*")):
        if path.suffix not in (".ts", ".tsx") or path == HELPER:
            continue
        text = read(path)
        if ".closest(" in text:
            offenders.append(str(path.relative_to(ROOT)))
    check(not offenders, "helper 之外仍有直接 .closest( 调用：" + ", ".join(offenders))

    bundle_src = read(ROOT / "web" / "assets" / "index.js")
    check(
        "closest" in bundle_src and "isContentEditable" in bundle_src,
        "构建产物中未找到 target 防御逻辑（可能未重新构建前端）",
    )

    # ---- 挖空序列化不得退回纯文本 ----
    # `{{c1::...}}` 里可以放 <b>/<img>，Anki 原生支持；用 textContent 取正文会把这些
    # 标签静默吃掉——「打开带加粗挖空的卡 → 保存 → 加粗没了」。这类丢数据只有一条防线：
    # 序列化时取 innerHTML。
    field_src = read(SRC / "utils" / "wysiwygField.ts")
    check(bool(field_src), "缺少 frontend/src/utils/wysiwygField.ts")
    check(
        "export function serializeFromWysiwyg" in field_src,
        "wysiwygField.ts 未导出 serializeFromWysiwyg",
    )
    check(
        "innerHTML" in field_src,
        "挖空序列化未使用 innerHTML，富文本（加粗/图片）会被吃掉",
    )
    check(
        "bodyEl.textContent" not in field_src,
        "挖空序列化仍在用 bodyEl.textContent 取正文，会丢掉里面的标签",
    )
    editor_src = read(SRC / "components" / "quick-add" / "TowerWysiwygEditor.tsx")
    check(
        "serializeFromWysiwyg" in editor_src,
        "编辑器没有接入 serializedFromWysiwyg（可能各写了一份）",
    )
    check(
        "from '../../utils/wysiwygField'" in editor_src,
        "编辑器未从 utils/wysiwygField 导入序列化函数",
    )

    # ---- 表格样式不得烘进当前主题 ----
    # 内联样式会存进字段，之后在 Anki 原生白底里渲染；写死深色底 + 继承黑字 = 表头不可见。
    table_src = read(SRC / "utils" / "editorTable.ts")
    check(bool(table_src), "缺少 frontend/src/utils/editorTable.ts")
    check(
        "TABLE_HEADER_FG" in table_src and "color:" in table_src,
        "表格表头没有显式文字色，原生白底上可能变成黑底黑字",
    )
    check(
        "isDark" not in table_src,
        "表格样式里出现了 isDark：会把界面主题烘进笔记内容",
    )

    if failures:
        print(f"前端静态审计失败（{len(failures)}/{checks} 项）：")
        for item in failures:
            print(f"  ✗ {item}")
        return 1
    print(f"{checks} 项前端静态审计全部通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
