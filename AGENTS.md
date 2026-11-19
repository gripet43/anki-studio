# Anki Studio — Agent 开发与设计规则

本仓库为 **Anki Studio**（`anki_modern_os`）Anki 插件源码。

## 核心手册与动工前必读规则（Read Before Edit）

在开始任何新开发任务、出方案或修改代码**之前**，必须先按任务类型实际读取对应手册的相关章节，确认无冲突后再动工：

| 任务范围 | 动工前必先读取 |
|---|---|
| 视觉样式、色彩/主题氛围、组件、布局/Z-Index、动效、文案与 16 语种 / RTL | [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) |
| 快捷键、弹窗与浮层流转、嵌套 Esc、异步状态/报错/Toast/确认门槛、多账号或跨日交互 | [`docs/INTERACTION.md`](docs/INTERACTION.md) |
| 新增/修改 Python 桥接（`bridge/`）、持久化配置/Profile 隔离、宿主补丁、测试或打包发布 | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) |
| 新功能开发或跨前后端/多模块改动 | 上述三册相关章节均须先核对后再动手 |

> 若本次改动新增或变更了设计 Token、快捷键、弹窗层级、Bridge Action 或配置项，完成后同步更新对应手册以保持文档与代码一致。

## 硬性工程与 UI 红线（门禁自动拦截）

除遵守上述手册外，以下 7 条红线在任何改动中均不得违背：

1. **色彩与主题**：优先使用 `frontend/src/index.css` 与 `frontend/src/utils/themeTokens.ts` 的语义 CSS 变量；小字状态色使用 `--status-*-text`（WCAG AA ≥ 4.5:1）；官方默认强调色 `indigo` 保持纯中性画布、严禁添加插画；牌组配色由 `deckPalette.ts` 单色源派生。
2. **禁止原生 `title=`**：所有悬浮提示必须使用 `<Tooltip>`（`compact` / `chart`）或 `<HoverCard>`，禁止在 JSX 中编写原生 `title=` 属性（仅 `<iframe>` 例外）。
3. **事件目标安全**：`frontend/src/utils/domTarget.ts` 之外严禁直接调用 `.closest(`，统一使用 `getClosestFromTarget` / `isTypingTarget`。
4. **弹窗与层级**：独立子弹窗优先使用原生 `<dialog>`（`showModal()`，不重复写 `role="dialog"` / `aria-modal`）；弹窗均需 `.modal-contain-scroll`；嵌套弹窗需避免按一次 `Esc` 同时关闭父弹窗；严格遵守 `docs/DESIGN_SYSTEM.md` 的 Z-Index 层级（`--z-tooltip: 9500`，`z-[9999]` 仅限全局 Toast）。
5. **16 语种与 RTL**：任何新增或修改的用户可见文案必须同步更新 `frontend/src/i18n/translations.ts` 及 `frontend/src/i18n/locales/` 下全部 16 种语言；布局必须使用逻辑方向属性（`ms-/me-/ps-/pe-/start-/end-/text-start/border-s`）以适配阿拉伯语 RTL。
6. **无障碍与动效**：可交互元素提供 `focus-visible` 焦点环；纯图标按钮必须带 `aria-label` + `<Tooltip>`；尊重 `prefers-reduced-motion: reduce` 与 `forced-colors: active`；避免 `transition-all`。
7. **Anki 生态与 SSR 安全**：挖空序列化必须通过 `wysiwygField.ts` 保留 `innerHTML`；表格内联样式（`editorTable.ts`）不得引用 `isDark`；工具函数与浮层组件必须守卫 `window` / `document` 以通过同步 SSR 单测；涉及用户状态/外观的本地配置须按 Anki Profile 隔离（`bridge/profile_config.py`）。

## 构建与回归验收

前端或桥接改动完成后，请同步重建产物并运行门禁：

```sh
export PATH="$HOME/Library/Application Support/AnkiProgramFiles/.venv/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
npm --prefix frontend run lint
python3 scripts/build_ankiaddon.py
node tests/frontend/run.mjs
node tests/test_frontend_bundle.mjs
python3 -m unittest discover -s tests -p "test_*.py" -v
./tests/scenarios/gate.sh --with-project
```
