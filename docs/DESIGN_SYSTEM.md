# Anki Studio 设计规范（Design System）

> 本文档是 **Anki Studio** 的单一可信设计来源（Single Source of Truth），沉淀自当前代码库与自动化审计护栏，用于指导后续所有页面、组件、交互与文案的设计与实现。
>
> **开发者实时预览**：在侧边栏标题 `Anki Studio` 上连续三击可解锁内置的开发者设计系统视图（[`DesignSystemView.tsx`](../frontend/src/components/design-system/DesignSystemView.tsx)），在线查看色板、字阶、三层浮层原语、语言与头像组件。

---

## 1. 设计理念与产品气质

Anki Studio 定位为**安静、克制、桌面级沉浸式学习工作区**，参考 Apple HIG、Linear、Radix Colors 与 Material 3 Dark Theme 的工程实践：

1. **安静优先（Calm First）**：界面服务于每日复习专注力，拒绝游戏化噪音、夸张动效和高饱和霓虹色。
2. **默认纯净，氛围可选**：官方默认强调色 `indigo`（经典蓝）严格保持**纯中性极简画布 + 零装饰插画**；其余 7 套强调色各自绑定一套低干扰轻纸感底色与微插画氛围。
3. **语义原生与桌面手感**：优先使用原生 Web 语义控件（`<dialog>`、`<fieldset>`、`<details>`、`<input type="range">`、`role="tablist"`），适配 macOS / Windows / Linux 快捷键、窗口拖拽与 RTL 阅读方向。
4. **内容与界面隔离**：界面主题绝不污染用户的 Anki 笔记内容（如表格内联样式），也不破坏第三方复杂卡片模板的原生排版。

---

## 2. 色彩与主题系统

> 核心实现：[`frontend/src/utils/themeTokens.ts`](../frontend/src/utils/themeTokens.ts)、[`frontend/src/utils/deckPalette.ts`](../frontend/src/utils/deckPalette.ts)、[`frontend/src/index.css`](../frontend/src/index.css)

### 2.1 显示模式（Theme Mode）

- 支持 `auto`（跟随系统）、`light`、`dark` 三态；历史配置值 `oled` 自动迁移归一化为 `dark`（`normalizeThemeMode`）。
- Tailwind v4 使用基于 `.dark` 类的自定义变体 `@custom-variant dark (&:where(.dark, .dark *))`，并配合 `<meta name="color-scheme">` 让滚动条、表单原生控件自动同步明暗外观。

### 2.2 表面与文字语义 Token

新组件**必须优先使用语义 CSS 变量**，不再引入新的硬编码中性灰 hex（旧组件中的 `#1A1B21`、`#EBEBF0` 等后续按模块逐步收口）。

| Token | Light 默认值 | Dark 默认值 | 用途 |
|---|---|---|---|
| `--bg-canvas` | `#F4F4F6` | `#131418` | 页面主画布底色 |
| `--bg-card` | `#FFFFFF` | `#1A1B21` | 卡片、侧边栏、抽屉、主容器与次级按钮静息表面 |
| `--bg-subtle` | `#F7F7F9` | `#20222A` | 悬停浅底（`:hover`）、凹陷分组底框、输入框浅底；**禁止用作浅色/纸感主题下密排按钮的常驻实心填充** |
| `--border-subtle` | `#EAECEF` | `#2A2C36` | 细描边与分割线 |
| `--text-primary` | `#1D1D1F` | `#F2F3F7` | 主标题与正文 |
| `--text-secondary` | `#6E6E73` | `#B8BAC6` | 次级说明、副文本 |
| `--text-muted` | `#8E8E93` | `#A4A6B4` | 元信息、时间戳、禁用辅助字 |
| `--dashboard-track` | `#ECECF2` | `#2A2C36` | 进度条/环形底轨 |
| `--dashboard-track-new` | `#D6D6DE` | `#3A3D48` | 新卡进度段底轨 |

### 2.3 8 套品牌强调色与氛围绑定

运行时通过 `buildThemeCssVars(accent, theme, systemDark)` 将以下动态 Token 注入根节点：
`--brand`、`--brand-hover`、`--brand-rgb`、`--brand-text`、`--brand-soft`、`--brand-soft-strong`、`--brand-surface`、`--brand-border`、`--brand-muted-bar`、`--heatmap-0` ~ `--heatmap-4`。

| ID | 名称 | Light `--brand` | Dark `--brand` | 浅色纸感氛围 (`data-accent`) | 插画包 (`IllustrationPackId`) |
|---|---|---|---|---|---|
| `indigo`（默认） | 经典蓝 · Studio Blue | `#3076C3` | `#3E8AD9` | 净白默认画布（`#F4F4F6` / `#FFFFFF`） | `none`（**严格零插画**） |
| `emerald` | 松石绿 · Sage | `#247A4F` | `#359A67` | 温润鼠尾暖纸（`#F3F2EC` / `#FCFBF8`） | `botanical`（植物手账） |
| `cyan` | 雾海蓝 · Ocean | `#2B7ABF` | `#3783C6` | 晴空微雾纸（`#EEF3F7` / `#FAFDFE`） | `cloudscape`（云端纸飞机） |
| `rose` | 赤陶粉 · Rose | `#C44D6C` | `#CB5775` | 晨雾柔粉纸（`#F5F1F2` / `#FFFCFD`） | `neko`（橘猫伴读） |
| `amber` | 琥珀金 · Ochre | `#9F5915` | `#CA7F33` | 暖棉手账纸（`#F5F1E9` / `#FFFDF8`） | `cafe`（窗边咖啡馆） |
| `teal` | 峡湾青 · Fjord | `#1D757A` | `#2A9298` | 清岚淡青和纸（`#EDF2F1` / `#FAFDFC`） | `kyoto`（京都和纸） |
| `violet` | 暮光紫 · Iris | `#7A50B6` | `#865EC2` | 星尘暮光纸（`#F2F1F7` / `#FDFCFF`） | `celestial`（星夜天文台） |
| `slate` | 石墨灰 · Graphite | `#475569` | `#64748B` | 晨雾墨韵纸（`#F0F1F4` / `#FAFAFC`） | `library`（古典藏书阁） |

> **注意**：`index.css` 根节点上的 `#5B5BD6` 仅作为静态 CSS 兜底，实际运行时均由 `themeTokens.ts` 的 `indigo`（`#3076C3`）或其他所选强调色覆盖。

### 2.4 语义状态色与 WCAG AA 对比度

复习评分（Again / Hard / Good / Easy）、图表指标与告警使用去饱和低眩光状态色；**小字号文本与浮层数字必须使用 `*-text` 前景色**（已校准在 `--bg-card` 与 `--tooltip-bg` 上满足 WCAG AA ≥ 4.5:1）：

| 语义 | 实色填充 (`Light` / `Dark`) | 柔和浅底 (`Light` / `Dark`) | 高对比文本 (`--status-*-text`，`Light` / `Dark`) |
|---|---|---|---|
| Danger（重来/危险） | `#D44854` / `#E05A66` | `#FCECEE` / `rgba(224,90,102,0.16)` | `#C43643` / `#F27782` |
| Warning（困难/提醒） | `#CC7A25` / `#E0933E` | `#FDF3E7` / `rgba(224,147,62,0.16)` | `#A25810` / `#F0A854` |
| Success（良好/完成） | `#2F9461` / `#3FAE78` | `#EAF6F0` / `rgba(63,174,120,0.16)` | `#1F7A4D` / `#4CC38A` |
| Info（简单/信息） | `#2B7ABF` / `#4693D6` | `#EBF4FC` / `rgba(70,147,214,0.16)` | `#2266A3` / `#66ACEA` |

### 2.5 牌组卡单色源派生规则

首页牌组卡片**禁止使用彩虹色轮询**，统一通过 [`deckPalette.ts`](../frontend/src/utils/deckPalette.ts) 从当前 `AccentScale` 派生：
- 第 1 张主牌组偏移量为 `0`（直接使用品牌主色）。
- 5 档轮转周期（`DECK_TINT_CYCLE = 5`）：色相偏转严格控制在 **±13° 以内**（`0 / +9° / -9° / +13° / -13°`），并搭配浅底深度微调（`0 / 3 / 3 / 6 / 6`），同时保证 `brandText` 在浅底上对比度不跌破 4.5:1。

---

## 3. 排版与字号层级

### 3.1 字体栈

```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang SC", "Inter", system-ui, sans-serif;
--font-mono: "SF Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### 3.2 字号与字重阶梯

| 角色 | 字号 | 字重 | 典型场景 |
|---|---|---|---|
| 页面主标题 | `20px`（`text-[20px]`） | `600–700` | Dashboard / Stats / DesignSystem 顶部标题 |
| 区块 / 弹窗标题 | `14.5px–15px` | `600–700` | 弹窗 Header（如 `AvatarCropModal`）、侧边栏品牌名、区块标题 |
| 导航与卡片标题 | `13px–14px` | `500–600` | 侧边栏主导航、设置项标题、卡片标题 |
| 正文与控件标签 | `12px` | `400–600` | 按钮文字（`.btn-*`）、常规表单、副标题、Toast |
| 辅助说明与浮层 | `11px–11.5px` | `400–500` | Tooltip、裁剪提示、统计副标签、表单小说明 |
| 徽章与快捷键 | `10px` | `600` | 卡片角标、快捷键 `<kbd>`、色块 Hex 标签 |

### 3.3 排版细节规则

- **等宽数字**：所有统计指标、百分比、倒计时、热力图与图表浮层数字**必须**加 `tabular-nums`，防止数值更新时抖动。
- **中文与多语言折行**：设置标题使用 `.settings-heading`（`text-wrap: balance`），说明文字使用 `.settings-helper-copy`（`text-wrap: pretty`）。
- **垂直光学居中**：分段按钮数字、键帽等短标签可使用 `text-box: trim-both cap alphabetic`。
- **文本可选中边界**：全局 `body` 默认 `user-select: none` 保持桌面应用质感；**复习卡片正文、输入框、可复制代码/调试信息**必须显式加 `.selectable-text`（`user-select: text`）。

---

## 4. 空间布局、圆角与层级（Z-Index）

### 4.1 间距阶梯

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
```

### 4.2 核心页面骨架尺寸

| 区域 | 尺寸规格 | 说明 |
|---|---|---|
| 侧边栏（`Sidebar`） | 展开 `240px`（`w-[240px]`）↔ 收起 `72px`（`w-[72px]`）紧凑图标栏 | macOS 顶部保留 `h-10`（`40px`）红黄绿交通灯拖拽区；收起态下工具栏自动转为纵向并由右侧 Tooltip 承接提示 |
| 首页画布（`.dashboard-shell`） | `max-w-[1440px]` 居中 | 卡片使用 `.dashboard-surface` + `--dashboard-shadow-card` |
| 复习舞台（`ReviewerView`） | 紧凑 `580px` / 宽幅 `840px` / 全宽 `1120px` | 由 `reviewStageWidth`（`auto / compact / wide / full`）与卡片复杂度控制 |
| 卡片库画廊（`.library-card-grid`） | `repeat(auto-fill, minmax(min(100%, 230px), 1fr))` | 间距 `12px`（`gap: 0.75rem`），支持 Subgrid 对齐 |
| 头像裁切视窗 | `256px × 256px`（`AVATAR_CROP_VIEWPORT_PX`） | 导出 `256×256` WebP/PNG（上限 512 KB） |

### 4.3 圆角阶梯

| 场景 | 圆角 |
|---|---|
| 键帽、微型徽章 | `4px–6px`（`rounded` / `rounded-md`） |
| 幽灵按钮、紧凑输入、次级按钮 | `8px`（`rounded-lg`） |
| 紧凑 Tooltip | `10px`（`rounded-[10px]`） |
| 主/次按钮、分段控制栏、图表面板浮层 | `12px`（`rounded-xl`） |
| 卡片、弹窗、弹窗内舞台 | `16px`（`rounded-2xl`） |
| Toast、胶囊开关、头像、指示点 | `9999px`（`rounded-full`） |

### 4.4 Z-Index 与 Top Layer 层级表

新增浮层必须严格遵循下表，严禁随意写 `z-[9999]`：

| 层级 | 值 / 机制 | 对应元素 |
|---|---|---|
| 局部叠层 | `1` ~ `20` | 分段选中态、Dashboard Header（`z-index: 20`） |
| 页面内抽屉 / 筛选浮层 | `z-40` | Reviewer 侧边检查器、Library 筛选 Popover、卡片操作菜单 |
| 常规模态弹窗 | `z-50` | `SettingsModal`、`CommandPaletteModal`、`CardEditorModal`、`VacationModal`、`CustomStudyModal` 等 |
| 二级叠加弹窗 | `z-[60]` | `ImageOcclusionEditorModal` |
| 媒体全屏灯箱 | `z-[120]` / `z-[130]` | `ReviewerImageLightbox` 背景与工具条 |
| 统一悬浮提示 / 浮卡 | `--z-tooltip: 9500` | `.ui-tooltip`、`.ui-hovercard`（必须严格低于 Toast） |
| 全局轻提示 Toast | `z-[9999]` | `App.tsx` 顶部居中 `.ui-toast` |
| 浏览器原生顶层（Top Layer） | `<dialog>.showModal()` | `AvatarCropModal` 等新一代独立子弹窗；位于所有普通 z-index 之上。`<Tooltip>` 已内置 `getClosestFromTarget(triggerEl, 'dialog[open]')`，会自动 Portal 到当前打开的 `<dialog>` 内部以免被顶层遮挡 |

---

## 5. 动效规范（Motion）

### 5.1 时长与缓动 Token

| Token | 值 | 适用场景 |
|---|---|---|
| `--dur-fast` | `120ms` | 按钮 hover/active、Tooltip/HoverCard 显隐（退出为 `80ms`） |
| `--dur-base` | `180ms` | 普通状态切换、卡片展开 |
| `--dur-reveal` | `240ms` | 答案揭示、面板显现 |
| `--dur-slow` | `260ms` | 主题/强调色切换交叉淡入（`.theme-switching`） |
| `--dur-draw` | `320ms` | 图表/环形进度绘制 |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 入场与位移缓动 |
| `--ease-std` | `cubic-bezier(0.4, 0, 0.2, 1)` | 颜色、透明度与常规状态过渡 |

### 5.2 动效约束

- **显式属性过渡**：优先声明具体属性（如 `background-color, border-color, color, transform, opacity`），避免无节制使用 `transition-all` 引起布局属性抖动。
- **按压触感**：主/次/幽灵按钮在 `:active:not(:disabled)` 时统一施加 `transform: scale(0.98)`。
- **减弱动态效果**：全局 `@media (prefers-reduced-motion: reduce)` 会将动画与过渡压缩至 `0.01ms` 并关闭骨架屏扫光与浮层位移动画；新增自定义动效时不得绕过该规则（Tailwind 类同步配合 `motion-reduce:transition-none`）。

---

## 6. 核心组件规范

### 6.1 按钮四层级

优先复用 [`index.css`](../frontend/src/index.css) 定义的语义类：

| 层级 | 类名 / 样式 | 默认高度与圆角 | 使用场景 |
|---|---|---|---|
| Primary | `.btn-primary` | `h-9`（`36px`） / `rounded-xl` | 页面或弹窗内唯一主操作（保存、确认、开始学习） |
| Secondary | `.btn-secondary` | `h-9`（`36px`） / `rounded-xl` | 次要操作（取消、刷新、切换选项、侧栏快速制卡） |
| Ghost | `.btn-ghost` | `h-8`（`32px`） / `rounded-lg` | 轻量辅助动作（更换图片、重置、低干扰文字按钮） |
| Icon Button | `w-7 h-7` 或 `w-8 h-8` `rounded-lg` / `rounded-full` | `28px–32px` | 工具栏、关闭按钮、缩放微调；**必须**带 `aria-label` + `<Tooltip>` |

- 弹窗 Footer 紧凑动作可通过 `!h-8 !rounded-lg !text-[12px]` 统一降一档高度。
- 禁用态统一降低透明度（`opacity-45`）、去除阴影并弱化描边，同时取消手型光标。
- **密排动作网格与纸感主题表面纪律（Inspector / Popover 动作区）**：
  1. **禁止“泥色砖块墙”**：浅色模式（尤其 7 套纸感氛围）下的密排次级按钮**严禁使用 `--bg-subtle` 作为常驻实心填充**，也严禁在 hover 中硬编码冷灰（如 `#ECECF1`）。抽屉与浮层自身表面须使用 `var(--bg-card)`，按钮静息态采用透明或 `var(--bg-card)` 净底 + `1px` `var(--border-subtle)` 细描边，仅在 `:hover` 时浮现 `var(--bg-subtle)` 或 `var(--brand-soft)`。
  2. **禁止“伪禁用”降灰**：同一动作组内，所有可点击按钮必须使用统一启用态正文色（`var(--text-primary)`）；低频辅助功能（如「调试信息」）不得通过把字色调灰或降低底色透明度来区分层级，以免与真正禁用态混淆。
  3. **危险操作静息克制原则**：在常驻侧栏、检查器或工具栏内的危险操作（如「删除卡片」），**静息态禁止常驻大面积粉红底与亮红框**；静息时保持与同排一致的净底细框 + `var(--status-danger-text)` 文字与图标，`:hover` 时浮现 `var(--status-danger-soft)` 与淡红边，点击进入二次确认态后才实心高亮 `var(--status-danger)`。
  4. **对齐纪律（带框居中、无框靠起始边）**：凡带独立边框的按键（Boxed Button，含 `.btn-primary` / `.btn-secondary` 及带框动作网格）内容统一**居中（`justify-center`）**，保证短文案重心平衡且切换确认态不横跳；仅无边框菜单项、侧边栏导航与下拉列表行使用靠起始边（`justify-start`）以维持纵向扫读基线。

### 6.2 悬浮提示与信息浮卡（三层原语）

> 核心实现：[`Tooltip.tsx`](../frontend/src/components/common/Tooltip.tsx)、[`HoverCard.tsx`](../frontend/src/components/common/HoverCard.tsx)、[`useFloatingPosition.ts`](../frontend/src/hooks/useFloatingPosition.ts)

**铁律：严禁在 JSX UI 组件中使用原生 `title=` 属性（唯一例外：`<iframe>` 无障碍标题）。此规则由 `frontend_audit.py` 自动门禁强制拦截。**

| 层级 | 组件与属性 | 延迟参数 | 适用场景 |
|---|---|---|---|
| Tier 1 · 紧凑提示 | `<Tooltip variant="compact" content={...} shortcut={...}>` | 首次 `350ms` / 300ms 暖窗内 `80ms` / 关闭 `80ms` | 图标按钮说明、快捷键提示（`.ui-tooltip-kbd`）、截断文本提示 |
| Tier 2 · 图表数据提示 | `<Tooltip variant="chart" content={<ChartTooltipContent ... />}>` | 开启 `0ms` 即时 / 关闭 `60ms` | 热力图、周节奏、30 天预测、成熟度、24 小时专注等所有图表数据点 |
| Tier 3 · 可交互信息浮卡 | `<HoverCard size="sm \| md \| lg \| auto" content={...}>` | 开启 `180ms` / 关闭 `150ms` | 含多行结构化说明、多指标对比或需要鼠标移入交互的富信息卡片 |

### 6.3 弹窗与抽屉规范

- **新一代子弹窗首选原生 `<dialog>`**：参考 [`AvatarCropModal.tsx`](../frontend/src/components/settings/AvatarCropModal.tsx)，使用 `showModal()` 进入 Top Layer、`closedby="any"` + 兼容外部点击回退、`<dialog>::backdrop` 磨砂遮罩；**不要**在原生 `<dialog>` 上重复写 `role="dialog"` 或 `aria-modal="true"`。
- **原生 `[popover]` / `<dialog>` 严禁根节点直挂 `flex`/`grid`/`block`**：作者样式表的无条件 `display` 会覆盖浏览器默认的 `[popover]:not(:popover-open) { display: none }`，在配合 `opacity: 0` 过渡时会残留**不可见但可点击的幽灵拦截层**。布局类必须放在内层包裹 `<div>` 上，或限定在 `:popover-open` / `[open]` 伪类下，并在关闭态显式加 `display: none; pointer-events: none`。
- **滚动隔离**：所有弹窗遮罩与可滚动内容区必须加 `.modal-contain-scroll`（`overscroll-behavior: contain`），防止滚动穿透到主工作区。
- **嵌套弹窗防误关**：当主弹窗内打开子弹窗（如 `SettingsModal` 内打开 `AvatarCropModal`）时，父弹窗的全局 `Escape` 监听器必须检测子弹窗状态并让权，禁止一次按 `Esc` 同时关闭两层弹窗。
- **标准弹窗结构**：Header（标题 + 右上关闭 `×`）+ Body（主内容）+ Footer（左侧辅助动作如「更换图片」，右侧「取消 + 主操作」）。

### 6.4 表单与设置项规范

- **输入框**：使用 `.settings-text-input`（边框清晰、聚焦时 `border-color: var(--brand)` + `3px` 品牌光环）。
- **下拉选择器**：全站严禁直接使用原生 `<select>`（Anki QtWebEngine Chromium 版本低于 `appearance: base-select` 支持线，会弹出割裂的原生系统白底菜单）；统一使用 [`StudioSelect.tsx`](../frontend/src/components/common/StudioSelect.tsx)（`role="combobox"` + Portal `role="listbox"` + `useFloatingPosition` 边缘自动翻转 + 选项数 ≥ 10 时自动启用内置搜索过滤 + 品牌柔和选中态与勾选图标）。
- **单选与分段控制**：单选组使用语义 `<fieldset>` + 原生 `<input type="radio">`，多档数值（如缩放比例）使用 `.settings-segmented-bar` + `.settings-segmented-option`。
- **滑块**：使用原生 `<input type="range">`，通过 CSS 变量驱动已填充轨道进度并支持 `:dir(rtl)` 镜像（参考 `.avatar-crop-slider`）。
- **折叠面板**：次级多选项（如 16 语种选择器）优先使用原生 `<details>` 渐进展开，避免视觉堆砌。
- **极简设置文案**：设置页**不堆叠冗长营销口号或重复副标题**（如已由输入框显示当前值时不再重复一行「当前生效名称」），保持单行直白。

### 6.5 头像组件（`<UserAvatar>`）

> 核心实现：[`UserAvatar.tsx`](../frontend/src/components/common/UserAvatar.tsx)、[`avatarImage.ts`](../frontend/src/utils/avatarImage.ts)

- 预设尺寸：`xs`（24px）、`sm`（32px）、`md`（40px）、`lg`（56px）、`xl`（64px）或自定义像素值。
- 三种模式：首字母（`initial`，随品牌色变化）、8 枚内置矢量预设（`book / owl / leaf / spark / cat / mountain / compass / flame`，自动随当前强调色和明暗模式着色）、自定义本地图片（`image`，严格限制安全光栅 Base64 Data URL ≤ 512 KB，**绝对阻断 SVG 与远程/本地路径 URL**）。
- 自定义图片上传后必须经过 `<AvatarCropModal>`（支持拖拽平移、1×–3× 缩放、±90° 旋转、键盘精调）导出标准 1:1 头像。

### 6.6 图标规范

- 统一使用 `lucide-react` 或 `viewBox="0 0 24 24"` 的圆角线条内联 SVG（`fill="none"`、`stroke="currentColor"`、`strokeLinecap="round"`、`strokeLinejoin="round"`）。
- 线条粗细：常规 `14px–16px` 图标使用 `strokeWidth="2"`（轻量装饰或 18px+ 可用 `1.8`）。
- 装饰性图标必须标记 `aria-hidden="true"`；纯图标交互按钮必须提供 `aria-label`。

---

## 7. 无障碍、国际化与跨平台适配

### 7.1 无障碍（Accessibility）

- **焦点可见**：所有可交互元素必须有清晰的 `focus-visible` 样式（`outline-2` 或品牌色焦点环），禁止无替代方案地移除 `outline`。
- **触控与粗指针适配**：`@media (pointer: coarse)` 下关键控件最小点击高度抬升至 `2.75rem`（`44px`），输入框字号不低于 `1rem`。
- **高对比度模式**：关键自定义边框/选中态/浮层需提供 `@media (forced-colors: active)` 适配（使用 `ButtonBorder` / `CanvasText` / `Highlight` 等系统色）。
- **实时播报**：键盘缩放、旋转、重置等无可见弹窗提示的连续操作应通过 `sr-only` + `aria-live="polite"` 区域同步播报。

### 7.2 国际化（16 语种全覆盖）

> 核心实现：[`translations.ts`](../frontend/src/i18n/translations.ts) 及 [`frontend/src/i18n/locales/`](../frontend/src/i18n/locales)

- 任何新增或修改的用户可见文案，**必须同步补齐全部 16 种官方支持语言**：
  `zh-CN`、`zh-TW`、`en`、`ja`、`ko`、`es`、`fr`、`de`、`ru`、`pt-BR`、`it`、`ar`、`vi`、`tr`、`pl`、`nl`。
- **禁止**在组件内硬编码中文或英文 UI 文案；占位符统一使用 `{param}` 并在所有语种保持一致。
- 文案风格：动词前置、简短精准（如「上传头像」「向左旋转 90°」「恢复默认」），避免生硬直译和冗长解释。

### 7.3 RTL（阿拉伯语）布局规则

当 `resolvedLang === 'ar'` 时，根节点设置 `dir="rtl"`。编写样式时：
- **必须**使用逻辑方向类与属性：`ms-* / me-*`、`ps-* / pe-*`、`start-* / end-*`、`text-start / text-end`、`border-s / border-e`、`inset-inline-*`。
- **禁止**对具有方向含义的布局硬编码 `ml- / mr- / left- / right- / text-left / text-right`（纯居中 `left-1/2 -translate-x-1/2` 除外）。
- 代码、快捷键、等宽数字（`kbd`、`code`、`.font-mono`）已在 `index.css` 中强制隔离为 `direction: ltr; unicode-bidi: isolate`。

### 7.4 三平台桌面适配

- **快捷键显示**：统一使用 `formatShortcut(shortcut, platform)` 自动将 `Cmd / Opt` 渲染为 macOS 符号（`⌘ / ⌥`）或 Windows / Linux 标签（`Ctrl / Alt`）。
- **窗口拖拽区保护**：位于窗口拖拽区域（绑定了 `startWindowDrag` 的标题栏/侧栏头部）内部的可点击按钮，必须加 `onMouseDown={(e) => e.stopPropagation()}`，防止点击被拖拽逻辑吞噬。

---

## 8. 工程安全与 Anki 生态护栏

以下约束已固化到自动化静态审计脚本（[`tests/scenarios/frontend_audit.py`](../tests/scenarios/frontend_audit.py)）与单元测试中，违反将直接阻塞构建门禁：

1. **事件目标防御**：严禁在 `frontend/src/utils/domTarget.ts` 之外直接调用 `.closest(`（Windows/WebView 下 `event.target` 可能是 `document` 或文本节点导致运行时崩溃）；统一使用 `getClosestFromTarget` 和 `isTypingTarget`。
2. **第三方卡片模板隔离**：`.anki-native-card` 与卡片库预览容器内的第三方 HTML 已通过 `index.css` 还原 `border-style: none` 和 `img, svg { display: inline-block }`，避免 Tailwind Preflight 破坏用户自带的词典/卡片模板样式。
3. **笔记数据纯净**：
   - 富文本挖空序列化必须走 `serializeFromWysiwyg` 并保留 `innerHTML`，禁止退回 `textContent`。
   - 编辑器生成的表格内联样式（[`editorTable.ts`](../frontend/src/utils/editorTable.ts)）禁止引用 `isDark`，必须自带独立高对比表头文字色，避免在 Anki 原生白底中不可见。
4. **SSR 同步单测兼容**：所有工具函数与通用浮层组件必须对 `window` / `document` / `HTMLElement` 做存在性守卫，确保能在 Node 环境中被 `renderToStaticMarkup` 同步渲染测试。
5. **配置隔离**：用户个性化外观（如 `custom_avatar`、`custom_nickname`）与学习状态必须按 Anki Profile 隔离（`PROFILE_SCOPED_KEYS`），且打包脚本严禁携带真实用户隐私字段。

---

## 9. 开发与验收自检清单

提交前端界面改动前，请按以下清单逐项核对：

- [ ] 浅色（默认 `indigo` + 至少 1 套纸感主题如 `emerald`）与深色模式均对比度清晰，无硬编码冲突色。
- [ ] 所有悬浮提示均使用 `<Tooltip>` / `<HoverCard>`，无原生 `title=` 属性。
- [ ] 无裸写 `.closest(`，事件目标判断走 `domTarget.ts`。
- [ ] 布局与对齐使用逻辑方向属性，兼容阿拉伯语 RTL。
- [ ] 所有新增/改动文案已同步更新 16 种语言。
- [ ] 交互支持键盘聚焦（`focus-visible`）、`Esc` 关闭与 `prefers-reduced-motion`。
- [ ] 完整跑通构建与门禁：
  ```sh
  npm --prefix frontend run lint
  python3 scripts/build_ankiaddon.py
  node tests/frontend/run.mjs
  node tests/test_frontend_bundle.mjs
  python3 -m unittest discover -s tests -p "test_*.py" -v
  ./tests/scenarios/gate.sh --with-project
  ```
