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

    if failures:
        print(f"前端静态审计失败（{len(failures)}/{checks} 项）：")
        for item in failures:
            print(f"  ✗ {item}")
        return 1
    print(f"{checks} 项前端静态审计全部通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
