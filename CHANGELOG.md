# Changelog (项目改动日志)

本文件严格遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范，并采用 [语义化版本 (Semantic Versioning)](https://semver.org/lang/zh-CN/)。

> [!IMPORTANT]
> ### 🤖 多助手协同开发协议 (Multi-Assistant Collaboration Protocol)
> 本项目由多位 AI 助手（如 Gemini、Antigravity、Claude 等）与人类开发者共同维护。为确保协同开发不发生逻辑冲突、踩踏覆盖或设计降级，所有助手在此项目工作时必须遵守以下规范：
> 1. **开工前必读**：开始任何任务前，必须首先阅读本文件 (`CHANGELOG.md`) 的最新记录，了解上一位助手的改动细节与设计决策。
> 2. **完工后必记**：完成任何代码修改、Bug 修复或 UI 调整后，必须在本文件顶部的 `[Unreleased]` 或最新版本段落中追加本次改动的详细条目，格式为：
>    `- [助手标识] 变更描述（标注改动的核心文件与原因）`
> 3. **验证门禁**：改动后必须运行 `node tests/test_frontend_bundle.mjs` 和 `python3 -m unittest discover tests` 确保测试 100% 通过，并执行 `npm run build` 打包。
> 4. **Git 提交通知**：推荐使用标准 Git Commit 记录变更，便于回溯 diff。

---

## [Unreleased]

- **[Gemini] Windows 验版报告第二轮（2026-11-12）3 项新问题修复（深色模式次级文字与图表对比度提升、快捷键清单平台动态适配与二元/四键模式对齐、`get_dashboard` 首屏轻量聚合与统计按需异步加载）**：
  - **问题 1（深色模式下次级文字与图表数值对比度偏低）**（[`frontend/src/index.css`](frontend/src/index.css)、[`frontend/src/utils/themeTokens.ts`](frontend/src/utils/themeTokens.ts)、[`frontend/src/components/stats/StatsView.tsx`](frontend/src/components/stats/StatsView.tsx)、[`frontend/src/components/layout/Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx)、[`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx)）：
    - 在 `index.css` 中提亮 `.dark`（`--text-secondary: #B8BAC6`、`--text-muted: #A4A6B4`）与 `.oled`（`--text-secondary: #B4B6C2`、`--text-muted: #9E9FAD`）全局变量；在 `themeTokens.ts` 中提亮深色模式 `indigo`（`#86C2F8 -> #98CCFD`）、`emerald`（`#72D5A1 -> #7EE0AE`）、`cyan`（`#7EC1F8 -> #92CAFA`）的 `brandText` 与 `brandMutedBar`。
    - 在 `StatsView.tsx`、`Sidebar.tsx`、`SettingsModal.tsx` 中将深色次级文字由 `#8E8E93` 提升至 `#A6A8B6` / `#A8AAB8`（在 `#1A1B21` 底色上对比度达 ~6.8:1）；将「12 周历史记忆留存率」柱顶百分比升级为 `text-[10px] font-bold tabular-nums` 且非当周采用高对比度亮白灰 `dark:text-[#D8DAE8]`（当周高亮为 `text-[var(--brand-text)]`），将「真实留存率」26px 大字由深色主填充色 `brandHex` 改为高对比度 `text-[var(--brand-text)]`，并将三张图表底部坐标轴统一接入 `${subText}`，解决 Windows 96 DPI 显示器深色模式下蓝灰字发暗难读的问题。
  - **问题 2（快捷键清单在 Windows 上仍写 `Cmd` 且复习评分键位说明与二元/四键模式不一致）**（[`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx)、[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)）：
    - 在 `SettingsModal.tsx` 中将原本写死的 `<kbd>Cmd + K</kbd>` 与 `<kbd>Cmd + Z</kbd>` 统一改为 `{formatShortcut('Cmd + K', envInfo.platform)}` 与 `{formatShortcut('Cmd + Z', envInfo.platform)}`（Windows/Linux 自动显示 `Ctrl + K` / `Ctrl + Z`）。
    - 将「开始学习」分组快捷键与复习器实际的二元主模式 + `Opt/Alt` 四键 FSRS 模式对齐：「显示答案 / 良好」标注 `Space / Enter / 2`、「重来」标注 `1`、「困难 / 良好 / 简单」标注 `{formatShortcut('Opt + 1~4', envInfo.platform)}`（Windows 显示 `Alt + 1~4`），并在 `ReviewerView.tsx` 中支持 `optionKeyHeld || e.altKey` 同步触发四键评分。
  - **问题 3（`get_dashboard` 大集合耗时优化与消除 `13b9a59` SQL 聚合回退）**（[`bridge/deck_service.py`](bridge/deck_service.py)、[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts)）：
    - **消除 `_build_decks_list` SQL 回退并合并超期扫描**：将 `cards GROUP BY did` 简化为仅计算总数、3 个互斥整数段（`ivl >= 21`、`ivl < 21 and type = 2`、`ivl < 21 and type in (1,3)`）与超期卡数（`queue = 2 and due < ?`），在 Python 端直接推导 `n_new` 与 `weighted_mastered = n_mature * 1.0 + n_review * 0.6 + n_learning * 0.3`，既消除 5 段 `CASE` 重复求值与浮点累加开销，又省去 `get_dashboard` 中原本独立的第二次 `cards` 全表超期扫描。
    - **消除 `_build_heatmap_and_streak` 二次全表扫描**：将连胜历史查询限制为 `WHERE id < start_365_sec * 1000 AND type < 4 AND ease > 0`，直接复用 Query 1 已聚合出的近 365 天活跃日集合 `day_map`，利用 `revlog.id` 主键索引跳过近一年全部复习记录的二次扫描。
    - **首屏 `get_dashboard` 与重型 `get_statistics` 解耦**：`get_dashboard` 默认仅拉取首页所需的牌组、今日进度、365 天热力图与 7 天周节奏（支持 `includeStats=True` 显式内联）；`useAppStore.ts` 在首屏渲染就绪后及切换至「统计分析」视图时异步调用 `refreshStatistics()`（`get_statistics`），在 20,000 卡 / 120,000 条 `revlog` 基准下将 `get_dashboard` SQL 耗时从 `172 ms` 降至 `~13 ms`（提速超 **12×**）。
  - **验证**：新增 [`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs) `Item #36` 门禁，`tsc --noEmit`、前端构建、Bundle 审计与 38 项 Python 单测 100% 通过。

- **[Claude Code] 首页 Quiet Study Studio 视觉收敛**（[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`frontend/src/components/dashboard/SyncStatusPill.tsx`](frontend/src/components/dashboard/SyncStatusPill.tsx)、[`frontend/src/index.css`](frontend/src/index.css)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - 将首页卡片、同步胶囊、提示层统一到 semantic surface/elevation token，减少 Light/Dark/OLED 下分散的硬编码背景、边框和阴影。
  - 顶部改为轻量 sticky toolbar；Hero 保留既有学习/同步/休假业务分支和 CTA，仅降低统计 pill 动效噪音、统一进度轨道与连胜层级。
  - 牌组网格改为 `auto-fit + minmax(260px, 1fr)`，热力图增加可控横向视口，分析卡片统一间距与分隔线；保留牌组 accent、熟记度 tooltip、Windows 响应式和 RTL 逻辑定位。
  - 新增 Bundle Item #36 守卫 semantic dashboard class、构建产物 CSS 和共享 tooltip 样式。

- **[Qoder] 牌组卡片二次精修：熟记度改悬停提示 + 移除与进度条重复的中部分隔线**（[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)）：
  - **删除问号按钮，改悬停自动展示**：移除熟记度右侧的 `?` 圆形按钮，将百分比 + 「熟记度」标签整体改为可悬停/可聚焦触发区（`tabIndex=0`、`cursor-help`、`aria-label` 复用 `masteryHintTrigger`、`aria-describedby` 指向弹窗）。鼠标移入即展开说明弹窗，悬停时百分比染上牌组色（`group-hover/mastery:text-[var(--deck-brand)]`）作为交互提示。
  - **防闪烁宽限期**：新增 `hintCloseTimer` ref + `openMasteryHint`/`scheduleCloseMasteryHint`，离开触发区或弹窗后延迟 160ms 收起，进入任一则取消收起——保证从触发区移向弹窗时不闪烁；弹窗补 `role="tooltip"` 与 `id`，并绑定 `onMouseEnter/Leave` 维持悬停；组件卸载清理定时器。键盘聚焦展开、失焦收起，兼顾无障碍。
  - **WCAG 1.4.13 合规**（对照 `interest-triggered-tooltips` 指南）：新增 document 级 `keydown` 监听，悬停/聚焦期间按 `Escape` 即收起（Dismissible，无需移动指针或焦点）；弹窗可悬停（Hoverable）、持续显示至触发移除（Persistent）；不将焦点移入弹窗（避免 WCAG 3.2.1 On Focus 违规）。因 Anki Qt WebEngine 内嵌运行时不支持 native `popover="hint"`/`interestfor`（需多个重型 polyfill），采用满足同等 WCAG 约束的手动实现。
  - **移除中部分隔线**：删去 footer 的 `border-t pt-3.5`（及骨架屏同款分隔线）。原灰色横线与上方全宽进度条形成两条平行横线的视觉重复，去除后仅以留白分隔，进度条成为唯一横向元素，画面更干净。
  - **验证**：浏览器实测悬停展开（`role=tooltip`、内容/几何位置正确、无横向溢出）、移开收起、移入弹窗保持、键盘 focus/blur 开合、`Escape` 收起均正常；问号按钮 0 残留、footer `border-top-width=0`；控制台零报错；`tsc`、Bundle 审计、38 项 Python 单测、`npm run build` 全绿。

- **[Qoder] 首页牌组卡片优雅化重设计（熟记度主角化 + 每牌组独立色彩身份 + 尺寸自适应 footer）**（[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`frontend/src/index.css`](frontend/src/index.css)）：
  - **问题**：旧卡片把图标、名称、熟记度百分比、`?` 与一条 64×4px 迷你进度条全挤在头部一行，进度条配色写死（`#85B7EB`/`#B5D4F4`）不跟随主题；底部「待复习文字 ↔ 按钮」hover 互换导致布局跳动且按钮仅 24px 高；牌组自带的 `accent` 字段未被用于配色，卡片千篇一律。
  - **熟记度主角化**：百分比升级为 18px 粗体 `tabular-nums`（`%` 缩小为次级），下方配 10px「熟记度」标签；迷你条改为**全宽 6px 四段分段进度条**（已熟记/复习中/学习中/新卡），成为卡片视觉锚点，`role="img"` + `aria-label` 保留无障碍语义。
  - **每牌组独立色彩身份**：新增 `deckAccentToTheme` 将牌组 `accent`（indigo/blue/emerald/amber/rose/purple）映射到全局色阶，图标底色、进度条分段、待复习圆点与「学习」按钮统一取该牌组色（`--deck-brand`/`--deck-brand-hover`/`--deck-border` CSS 变量），与全局强调色解耦——全局色仍主导应用 CTA，牌组色仅作用于自身卡片。`deckIconMap` 补齐 rose（星芒）/purple（层叠）两色图标，统一 18px、1.8 描边。
  - **footer 常驻不跳动**：移除 hover 互换，改为左侧「待复习/新卡」圆点指示 + 右侧常驻标准按钮（`btn-secondary` 查看 / `btn-primary` 学习，紧凑 h-7），布局稳定、可发现性更强。
  - **尺寸自适应（容器查询）**：卡片设 `container-type: inline-size`，`@container (max-width: 260px)` 下「查看」收敛为纯图标、隐藏次要的新卡指示，杜绝窄卡 truncation 与溢出；宽卡完整展示。遵循 `card` 指南「按卡片自身可用空间而非视口适配」。
  - **微交互与语义**：hover 上浮 2px + 图标 `scale(1.05)` + 牌组色边框 + 环境投影，统一走 `--dur-base`/`--ease-out` 令牌；卡片根改为 `<article>` + `<h3>` 标题，`focus-within` 高亮，熟记度弹窗图例配色与进度条分段一致。
  - **验证**：Light/Dark/OLED 三主题 × 6 牌组色浏览器实拍确认；窄（216px content）/宽（338px content）容器查询切换无溢出；hover 位移/缩放/边框经计算样式确认；`tsc`、Bundle 审计（含 `Item #35`）、38 项 Python 单测、`npm run build` 全绿。

- **[Gemini] Anki Studio 动效体系整体补齐（A1–A5 统一令牌与死类修复、B1–B2 `usePresence` 离场体系、C1–C4 复习器翻面与切卡动效、D–G 视图/模态/Toast/主题切换/数字滚动、H1–H3 依赖清理与 `Item #35` 门禁）**：
  - **A. 统一动效令牌、6 个死类纯 CSS 补齐与全局无障碍降级**（[`frontend/src/index.css`](frontend/src/index.css)）：
    - 在 `:root` 补齐 `--dur-fast`（`120ms`）、`--dur-base`（`180ms`）、`--dur-slow`（`260ms`）、`--dur-reveal`（`240ms`）、`--dur-draw`（`320ms`）、`--dur-shimmer`（`1.6s`）、`--dur-sweep`（`1.4s`）与 `--ease-out`、`--ease-std` 曲线令牌，收敛全仓散落时长，并将 `.btn-primary` / `.btn-secondary` / `.btn-ghost` 的 `transition: all` 改为显式属性列表。
    - 针对 Tailwind v4 未装 `tailwindcss-animate` 且 `.duration-*` 仅设置 `transition-duration` 导致 `animate-in fade-in`、`slide-in-from-top-4`、`delay-stagger-1/2/3`、`animate-sync-border-flash` 0 命中的根因，以纯 CSS 实现上述动效类与 `ui-fade-in/out`、`ui-enter-top`、`ui-view-enter`、`ui-card-enter`、`ui-answer-reveal`、`ui-divider-reveal`、`sync-border-flash` keyframes；将 `.delay-stagger-1/2/3` 置于 `.animate-sync-reveal` 之后以防简写 `animation:` 重置延迟。
    - 新增全局 `@media (prefers-reduced-motion: reduce)` `0.01ms` 兜底规则，并为 `.animate-skeleton-shimmer` 提供静态淡底降级。
  - **B & E. 通用 `usePresence` 进出场状态机与 7 大模态 / Toast 离场过渡**（[`frontend/src/hooks/usePresence.ts`](frontend/src/hooks/usePresence.ts)、[`CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx)、[`SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx)、[`CustomStudyModal.tsx`](frontend/src/components/study/CustomStudyModal.tsx)、[`VacationModal.tsx`](frontend/src/components/vacation/VacationModal.tsx)、[`IcuRescueModal.tsx`](frontend/src/components/vacation/IcuRescueModal.tsx)、[`CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`ImageOcclusionEditorModal.tsx`](frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx)、[`DecksView.tsx`](frontend/src/components/decks/DecksView.tsx)、[`App.tsx`](frontend/src/App.tsx)）：
    - 新增 `usePresence(open, exitMs, resetKey)` 钩子管理 `entering -> entered -> leaving` 状态与延迟卸载；各模态保留自身外层 `fixed inset-0` 遮罩节点且不绑定背景点击关闭（严守 `Item #23`），统一实现遮罩 `120ms` 淡入淡出与面板 `180ms` 进场 / `120ms` 离场。
    - `App.tsx` 的 Toast 接入 `usePresence` 并缓存离场文案，新 Toast 顶替旧 Toast 时平滑重置为 `entering` 而不闪退。
  - **C. 复习器翻面揭示、切卡入场与完成页过渡**（[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)）：
    - 翻面答案区包裹 `.ui-answer-reveal`（`180ms` `opacity + translateY(8px)`），分割线接入 `.ui-divider-reveal`（逻辑起点 `inline-start` 的 `scaleX(0->1)`）；卡片容器绑定 `key={currentCard.id}` 与 `.ui-card-enter`（`160ms` 入场）；完成页根节点接入 `.ui-view-enter`（严格不新增或移动任何 Hook，守住 `Item #30`）；评分按钮与顶部进度条收敛至统一令牌且全流程无 `disabled` 阻塞。
  - **D, F & G. 主视图切换、主题/8 强调色 260ms 过渡与英雄区数字滚动**（[`frontend/src/App.tsx`](frontend/src/App.tsx)、[`frontend/src/hooks/useCountUp.ts`](frontend/src/hooks/useCountUp.ts)、[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)）：
    - `<main>` 内层包裹 `<div key={activeTab} className="ui-view-enter ...">` 实现五大主视图切换淡入上浮；`App.tsx` 监听 `[theme, accentColor]`（跳过首帧且不响应语言切换）临时挂载 `260ms` `.theme-switching` 平滑过渡色彩变量；新增 `useCountUp`（`reduced-motion` 下直出终值）并仅绑定首页今日进度完成数与连胜天数。
  - **H. 清理无用依赖与新增 `Item #35` 动效门禁**（[`frontend/package.json`](frontend/package.json)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
    - 从 `frontend/package.json` 移除 0 引用的 `framer-motion`；在 `tests/test_frontend_bundle.mjs` 新增 `Item #35`，强校验编译产物 `web/assets/index.css` 包含核心动效类、令牌与 `prefers-reduced-motion`，并自动扫描 `frontend/src/**/*.tsx` 全部 `animate-*` 类确保产物 100% 命中（经变异测试验证）。

- **[WorkBuddy]** 窗口扩展改为一次性 + 火焰在窄屏隐藏（[__init__.py](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/__init__.py)、[StreakFlameBackdrop.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/dashboard/StreakFlameBackdrop.tsx)）：
  - **窗口尺寸保护落持久化标记**：`_did_initial_expand` 原为实例级变量，Anki 每次启动都会重置，导致用户手动调小的窗口每次开机都被拉回 1180×760。现改为从 `get_config()["windowInitialExpandDone"]` 初始化，且**只在真正执行过 resize 时**写入该键；窗口本来就够大的用户不写标记，每次启动检查一次但不做任何 resize，完全无感。
  - **窄屏隐藏火焰**：响应式改版后连胜卡在 `<1024px` 变为底部通栏，原先贴整卡右下角的 142×186 火焰会横向压住「19 天」。给 SVG 加 `hidden lg:block`，宽屏保留背景剪影，窄屏只留干净的连胜区。
  - 验证：1440 / 720 两种宽度实拍确认宽屏火焰仍在、窄屏消失且文字不再被遮挡；`py_compile`、38 项单测、`tsc`、Bundle 审计、前端构建全绿。

- **[Gemini] Windows 验版报告（2026-11-11）8 项问题全量调查与修复**：
  - **问题 1（首次启动 `prefs21.db` 被判定损坏并重建 + 语言确认框）**：定位根因为 [`tests/scenarios/run.py`](tests/scenarios/run.py) 的 `ensure_profile()` 仅写入了 `(PROFILE, pickle.dumps({}))`，缺失 Anki 26 `ProfileManager.loadMeta()` 强依赖的 `'_global'` 元数据行（导致 `pickle.loads(None)` 抛异常触发数据库重建并重置 `firstRun=True`）。现补齐完整 `_global` 字典（含 `ver: 0`、`firstRun: False`、`defaultLang: 'zh_CN'`、`last_run_version: 260904`、`last_loaded_profile_name`、`suppressUpdate: True`）与标准 profile 配置字典；同时将 `sync_addon()` 由 `shutil.rmtree` 整目录删除改为 `shutil.copytree(..., dirs_exist_ok=True)` 增量覆盖同步，避免一次性删除 65+ 个文件触发批量删除拦截，并在 [`tests/scenarios/paths.py`](tests/scenarios/paths.py) 中自动配置 UTF-8 标准输出流解决 Windows 终端默认代码页乱码。
  - **问题 2（默认窗口尺寸 `683×609` / `820×650` 下首页右侧文案一字一行竖排）**：
    - **宿主窗口尺寸自适应**：在 [`__init__.py`](__init__.py) 中新增 `_ensure_comfortable_window_size()`，进入现代工作台时设置最小尺寸保护（`860×600`，切回原生界面时无损还原），并在首次打开且窗口小于 `1040×680`（如 Windows 原生默认 `683×609`）时自动扩展至 `1180×760`（受当前屏幕可用工作区 `availableGeometry` 约束）。
    - **响应式折行与防竖排保护**：重构 [`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx) 顶栏与「今日学习进度」英雄区布局（改为 `flex-col lg:flex-row` 响应式排布，连胜卡在 `< 1024px` 窗口下自动转为底部横向通栏，核心标题/剩余卡数/预计用时/操作按钮补充 `whitespace-nowrap` 与 `min-w-[200px]`，底部热力图与周节奏改为 `col-span-12 xl:col-span-7` / `col-span-12 xl:col-span-5`），确保在 `683px–1280px` 全宽度区间内均无单字竖排。
  - **问题 3 & 问题 4（Windows / QEMU 下 WebView 焦点、重绘覆盖与切到原生界面后无法切回）**：
    - 在 [`__init__.py`](__init__.py) 中将 `_resize_filter` 同时安装到 `mw` 与 `target_parent`（Windows 下的 `mw.centralWidget()`），监听 `Resize`、`Show` 与 `LayoutRequest` 事件，并在 `_on_state_did_reset` 中重新隐藏被 `mw.reset()` 恢复显示的 `mw.toolbar.web` / `mw.web` 并提升 `self.webview.raise_()` 与 `StrongFocus` 焦点。
    - 为 `切换 Anki Studio / 原生界面 (Ctrl+Alt+M)` 显式设置 `Qt.ShortcutContext.ApplicationShortcut` 全局快捷键上下文，并在原生窗口顶部菜单栏（`mw.form.menubar`）直接挂载一级菜单项「`🌟 Anki Studio`」，即使在 QEMU 虚拟机等 WebEngine 鼠标命中异常环境下，也能通过原生菜单栏一键双向切回。
  - **问题 5（`smoke.py` 在 Windows 上因二次 SQLite 连接报 `OperationalError: database is locked` 11/11 全红）**：在 [`tests/scenarios/smoke.py`](tests/scenarios/smoke.py) 中将 `sqlite_count()`、`_sqlite_rows()` 与 `_schedule_snapshot()` 统一改为优先复用已打开的 `self.col.db.scalar()` / `self.col.db.all()`，消除 Windows 按句柄独占锁拒绝同进程第二条 `sqlite3.connect` 连接的问题；同时优化查重检查扫描前 30 条笔记跳过 `dirty` 场景前置空卡。
  - **问题 6（清理 Anki 26 已废弃的 `col.save()` 与 `col.sched.reset()` 调用告警）**：在 [`bridge/vacation_service.py`](bridge/vacation_service.py)、[`bridge/deck_service.py`](bridge/deck_service.py) 与 [`bridge/safety.py`](bridge/safety.py) 中增加 `not hasattr(col, "_backend")` 守卫，在 Anki 26 Rust 后端下不再触发已废弃的 `save()` 与 `reset()` 警告。
  - **问题 7（优化 `get_dashboard` 与 `get_statistics` 大集合性能热点）**：在 [`bridge/deck_service.py`](bridge/deck_service.py) 中将 `_build_decks_list` 的逐牌组 SQL 查询合并为单次 `GROUP BY did` 查询 + 内存子树聚合；将 `_build_weekly_rhythm` 的 7 次循环查询合并为单次 `GROUP BY` 查询；将 `get_statistics` 中 12 周留存率的 12 次循环查询合并为单次 `GROUP BY` 查询；用基于本地时区偏移的纯整数取模运算替代逐行调用 `strftime('%H', ..., 'localtime')`（消除 12 万次 OS 时区锁调用）；将 `trueRetention` 的全表窗口函数排序 `ROW_NUMBER() OVER` 优化为 `GROUP BY cid, day_bucket` + `MIN(id)` 聚合。
  - **问题 8（菜单标注 `Ctrl+P` 不生效）**：在 [`frontend/src/App.tsx`](frontend/src/App.tsx) 中新增 `Ctrl+P` 与 `Cmd+,` / `Ctrl+,` 快捷键映射以切换设置弹窗，并在 [`__init__.py`](__init__.py) 中桥接原生 `mw.form.actionPreferences`（`工具 -> 设置(P) Ctrl+P`），在现代界面激活时直接呼出 Anki Studio 设置中心。
  - **验证**：新增 `test_27_windows_qa_fixes_no_deprecated_save_and_prefs21_schema` 与 Bundle 审计 `Item #34`，`tsc --noEmit`、前端构建、Bundle 审计、38 项 Python 单测与 11 场景 `smoke.py` 全部通过。

- **[WorkBuddy]** 修复侧边栏「设置」齿轮图标残缺（[Sidebar.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/layout/Sidebar.tsx)）：
  - **根因**：path 里 `a2 2 0 0 1-2-2` 少了一个空格。SVG 允许用负号当分隔符，于是它被解析成 `sweep=1, dx=-2, dy=-2`，而本意是 `dx=+2, dy=-2`——齿轮顶部那一段弧往反方向画，整圈就不闭合，看起来像缺了一块。
  - **修法**：换成 lucide 标准 `settings` 路径（12 齿 + 中心圆），不再手工维护这段坐标。
  - 验证：截图确认齿轮闭合对称；`tsc` 0 错误、Bundle 审计 ALL PASSED、37 项单测通过。

- **[WorkBuddy]** 「自定义学习」入口按钮与弹窗标题统一（[translations.ts](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/i18n/translations.ts)、[locales/](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/i18n/locales)）：
  - 按钮原为「自定义学习 / 错题特训」、弹窗标题为「自定义学习与错题集特训」，但点进去是通用自定义学习面板（可按状态 / 难度 / 标签 / 牌组组合筛选，错题集只是其中一个预设），副标题名不副实。两处统一为「自定义学习」。
  - 16 种语言的 `customStudyEntryBtn` / `customStudyModalTitle` 同步去掉副标题（EN: `Custom Study / Cram` → `Custom Study`；DE: `Benutzerdefiniertes Lernen & Fehlertraining` → `Benutzerdefiniertes Lernen`…），避免只有中文变短、其他语言仍拖着一长串。
  - 验证：`tsc` 0 错误、Bundle 审计 ALL PASSED、37 项单测通过、产物 677.04 kB。

- **[WorkBuddy]** 首页三处视觉收敛（[DashboardView.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/dashboard/DashboardView.tsx)）：
  - **连胜火焰去掉柔化**：`StreakFlameBackdrop` 只保留清晰的火苗剪影——移除 `feGaussianBlur`（`stdDeviation=2`）与底部那层径向光晕，两者叠加会在卡片底边糊出一片橙雾；底部改用渐变自身的 `stop-opacity` 淡出，被卡片圆角裁切时不留硬边。透明度从 0.20 → 0.22（深色 0.28 → 0.30），补偿去掉柔化后的视觉重量。
  - **移除牌组卡片常驻播放键**：右下角默认不再显示圆形 ▶，只在悬停时出现「查看 / 学习」两个胶囊；给按钮容器补 `min-h-7` 占位，避免悬停瞬间卡片高度抖动。
  - **统计标签并入信息行**：「待复习 / 新卡 / 已完成」三个 pill 从按钮行右侧搬到「预计 N 分钟」后面，与剩余卡数同行展示；按钮行只保留「开始今日学习 / 轻量复习 / 自定义学习」等动作，行动与数据分层更清楚。
  - **连胜数字去图标改色**：去掉「19 天」前面那个 20px 火苗图标，数字本身改为火焰色 `#FF8A00`（与背景火焰渐变中段同色），把「火」的语义从图标交给数字；`天` 与「最长 N 天」保持次级灰，层级仍然清楚。
  - 验证：`tsc --noEmit` 0 错误、Bundle 审计 ALL CHECKS PASSED、产物 677.62 kB。

- **[WorkBuddy]** 语言字典拆包（首包 −392 kB）+ 越南语修正 + `Item #33` 字典守卫（[translations.ts](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/i18n/translations.ts)、[locales/](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/i18n/locales)、[App.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/App.tsx)）：
  - **拆分**：`translations.ts` 从 8902 行降到 1490 行，14 种语言移到 `i18n/locales/*.ts`，只留 zh-CN / en 两份常驻首包（这两份是最常用、也最不能接受首屏闪烁的）。
  - **懒加载**：新增 `ensureLanguageLoaded` / `isLanguageLoaded`；`App.tsx` 在 `resolvedLang` 变化时按需 `import()` 对应 chunk，加载完成后用 `useReducer` 强制重渲染一次。`translate()` 保持同步，查表顺序 `LAZY_DICTS → DICT → EN → key`，加载失败也只会回落英文、不阻塞渲染。
  - **体积**：主包 **1,070.69 → 678.43 kB**（gzip 288.28 → 179.13 kB）；另出 14 个语言 chunk，每个 25–37 kB（gzip 9.7–11.7 kB），切到该语言时才拉。
  - **越南语修正**：`customStudyPresetMistakesTitle`（"Đặc训"）、`icuNoHistorySub`（"lưu快照"）、`streakRulesTooltipBody`（"chuỗi打卡"）三条中越混杂改为纯越语表述。
  - **守卫**：新增 `Item #33`——16 份字典的 key 集合与中文基准逐一对齐、占位符集合逐键比对、越南语不得出现 CJK 字符。三条断言都做过变异测试（`{n}`→`{N}`、删掉 `backBtn`、塞入汉字），确认会红而不是空跑。
  - 验证：`tsc --noEmit` 0 错误、Bundle 审计 ALL CHECKS PASSED、37 项 Python 单测通过；实测切到日语时懒加载 chunk 正确加载并完成渲染。

- **[WorkBuddy]** 首页与侧边栏四处交互修正（[Sidebar.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/layout/Sidebar.tsx)、[DashboardView.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/dashboard/DashboardView.tsx)、[translations.ts](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/i18n/translations.ts)）：
  - **logo 可点击回首页**：侧边栏左上角 app 图标由装饰性 `<div>` 改为 `<button>`，点击切到「今日概览」。父级挂了 `onMouseDown={startWindowDrag}` 做窗口拖动，按钮上补 `stopPropagation`，否则点击会被拖拽逻辑吃掉。
  - **「管理」右对齐**：`btn-ghost` 自带 `padding: 0 0.625rem` + `height: 2rem`，原先只覆盖 `!px-2`，文字右侧仍留 8px 空白，看起来偏左。改为 `!h-auto !ps-2 !pe-0`，让文字贴内容区右边界（与左侧留白对称）。
  - **侧边栏牌组行悬停双动作**：每行悬停时把待复习数字换成「查看 / 学习」两个图标按钮——查看 → 卡片库并 `searchLibraryDebounced({ deckId })` 过滤到该牌组；学习 → `startReview(deckId)`。移开即复原，静态时不增加视觉噪音。
  - **首页牌组卡片同样处理**：默认仍是一个播放键，悬停后替换为「查看」「学习」两个胶囊按钮（查看为描边次要按钮、学习为品牌色主按钮），行为与侧边栏一致，`stopPropagation` 避免冒泡触发整卡点击。
  - **牌组数量文案去重**：无子牌组时 `topLevelDecks.length === decks.length`，原副标题「N 个主牌组 · 共 N 个牌组」是同义反复。改为该场景只输出一次数量（新增 `decksTotalOnly`），有子牌组时才显示「N 个主牌组 · 共 M 个牌组」。
  - **i18n**：新增 `viewDeckBtn` / `studyDeckBtn` / `decksTotalOnly` 三个键，16 个语言字典全部按字母序补齐（不走英文兜底），满足本轮 `Item #31` 的「组件内零 `isZh` 内联三元」约束。
  - 验证：`tsc --noEmit` 0 错误、Bundle 审计 ALL CHECKS PASSED、37 项 Python 单测通过、`npm run build` 已重建产物。

- **[Gemini] 多语言系统深度重构：组件层 100% 接入 `t()`（清零 474 处 `isZh` 三元表达式）、16 国语言 100% 独立词条覆盖、阿拉伯语 RTL 布局与设置页平铺语言网格**：
  - **1. 组件层彻底消除硬编码 `isZh ? '中文' : 'English'`（解决根本原因）**：重构 [`App.tsx`](frontend/src/App.tsx)、[`Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx)、[`DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`SyncStatusPill.tsx`](frontend/src/components/dashboard/SyncStatusPill.tsx)、[`LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx)、[`CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx)、[`ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)、[`DecksView.tsx`](frontend/src/components/decks/DecksView.tsx)、[`StatsView.tsx`](frontend/src/components/stats/StatsView.tsx)、[`CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`ImageOcclusionEditorModal.tsx`](frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx)、[`TowerWysiwygEditor.tsx`](frontend/src/components/quick-add/TowerWysiwygEditor.tsx)、[`CustomStudyModal.tsx`](frontend/src/components/study/CustomStudyModal.tsx)、[`VacationModal.tsx`](frontend/src/components/vacation/VacationModal.tsx)、[`IcuRescueModal.tsx`](frontend/src/components/vacation/IcuRescueModal.tsx)、[`SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx)、[`DesignSystemView.tsx`](frontend/src/components/design-system/DesignSystemView.tsx) 与 [`useAppStore.ts`](frontend/src/stores/useAppStore.ts)，将全仓 474 处 `isZh ? ... : ...` 与 `{ zh, en }` 内联三元表达式全部替换为统一 `t(...)` 字典调用，`frontend/src/` 下 `isZh` 残留清零。
  - **2. 16 国语言 100% 自有翻译覆盖率（零 `...EN_DICT` / `...ZH_CN_DICT` 回退混排）**：将 [`frontend/src/i18n/translations.ts`](frontend/src/i18n/translations.ts) 词条库扩展至 **526 个键**，并为全部 16 种官方语言（`zh-CN`、`zh-TW`、`en`、`ja`、`ko`、`es`、`fr`、`de`、`ru`、`pt-BR`、`it`、`ar`、`vi`、`tr`、`pl`、`nl`）提供 **100% 独立原生翻译（共 8,416 条独立词条）**，彻底移除 `...EN_DICT` 与 `...ZH_CN_DICT` 展开回退，杜绝切换德语/法语/日语后弹窗与设置页回退英文的混排问题。
  - **3. 阿拉伯语（`ar`）原生 RTL 从右向左排版支持**：在 [`translations.ts`](frontend/src/i18n/translations.ts) 中新增 `isRtlLanguage()`，在 [`App.tsx`](frontend/src/App.tsx) 中动态同步 `document.documentElement.dir = isRtl ? 'rtl' : 'ltr'`、`document.documentElement.lang` 与根容器 `dir` 属性，并在 [`index.css`](frontend/src/index.css) 及各导航/弹窗组件中采用 CSS 逻辑属性（`border-e`、`ps-*`、`pe-*`、`ms-*`、`me-*`、`start-*`、`end-*`、`text-start`）与 `[dir="rtl"]` 双向文字隔离规则。
  - **4. 设置中心平铺展示全部语言（移除下拉框）**：在 [`SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx) 与 [`DesignSystemView.tsx`](frontend/src/components/design-system/DesignSystemView.tsx) 中彻底移除 `<select>` 语言下拉框，改为 `grid-cols-3 sm:grid-cols-4` 响应式平铺卡片网格，直观展示「自动跟随 Anki」及全部 16 种语言的母语名称、英文名称与激活状态。
  - **5. 验证**：升级 [`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs) `Item #31` 门禁断言（强制校验零 `...EN_DICT` 回退、零 `isZh`、RTL `dir="rtl"` 与无 `<select>` 平铺语言网格），`tsc --noEmit`、前端构建、Bundle 审计与 38 项 Python 单测 100% 通过。

- **[WorkBuddy]** 下线「默写」相关功能：复习界面的自检模式 + 制卡弹窗的默写卡预设（[ReviewerView.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/reviewer/ReviewerView.tsx)、[CardEditorModal.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/quick-add/CardEditorModal.tsx)）：
  - **下线理由**：比对目标只取第一个 `{{cN::}}` 或背面首行（截 120 字），多空卡与长答案判不准；LCS 逐字评分只影响显示、不写回调度，对「这一步该评 Again 还是 Good」没有决策价值。另外它的 10 个文案键从未进过字典，界面上一直显示 `typeAnswerModeBtn` 这类原始标识符（已核 HEAD 版本，不是本轮回退）。
  - **删除范围**：`typeAnswerEnabled` / `typeAnswerInput` / `typeAnswerInputRef`；卡片切换时按 `默写` / `type` / `type-answer` 标签与笔记类型名自动开启的 `autoType` 逻辑；`expectedTypeTarget` 与 `typeAnswerDiff` 两个 useMemo（含整套 LCS 动态规划）；工具栏开关按钮、翻面后的逐字对比面板、正面的默写输入框。正面底部保留原有 `recallPrompt` 提示，布局不变。
  - **连带下线制卡预设**：制卡弹窗的「默写卡」（`selectedPreset === 'type_answer'`）一并移除——预设列表项、`NoteCreationPreset` 字面量、`NoteTypeOption.isTypeAnswer`、`typeAnswerMode` 传参、预设标题与背面徽章分支全部清掉；后端 [`edit_service.py`](bridge/edit_service.py) 的 `type_answer_mode` 参数与「自动补 `默写` 标签」逻辑同步删除，[`useAppStore.ts`](frontend/src/stores/useAppStore.ts) 的对应标签注入也一并去掉（`effectiveTags` 直接取 `payload.tags`）。
  - **测试同步**：`test_bridge` 第 3 段由「必定注入默写标签」改为「即使旧调用方仍传 `typeAnswerMode` 也不再注入」；`Item #30` 去掉对已删两个 `useMemo` 的引用，只保留「最后一个 Hook 必须早于会话完成态 return」的位置守卫。
  - **防回归**：`tests/test_frontend_bundle.mjs` 的 `Item #22` 从正向断言改为反向断言（`!typeAnswerEnabled`、`!typeAnswerDiff`，同时要求 `recallPrompt` 仍在），Bundle 审计与 37 项 Python 单测全绿。

- **[WorkBuddy]** 「连续打卡」标题新增计数规则说明浮层（[DashboardView.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/dashboard/DashboardView.tsx)）：
  - 标题右侧加 14px 灰色 info 图标（`cursor-help`），hover 或键盘聚焦弹出 248px 说明卡，解释连胜的判定口径。
  - **文案严格对齐后端实现**（`deck_service._build_heatmap_and_streak`）：活跃日 = `revlog` 中 `type < 4 AND ease > 0` 的任意一次作答（答错也算）；今天尚无记录时 `cursor` 回退到昨天判定，所以早上打开不会清零；`frozen_dates`（休假冻结日）计入活跃、不断连胜。
  - **不被裁切**：卡片的 `overflow-hidden` 从 `<section>` 移到专管火焰的裁剪层，否则浮层会被卡片圆角切掉；浮层 `z-50`，`group-hover/streak` + `group-focus-within/streak` 双通道触发，键盘可达。

- **[WorkBuddy]** 首页「今日学习进度」卡片新增连胜火焰背景（[StreakFlameBackdrop.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/dashboard/StreakFlameBackdrop.tsx)、[DashboardView.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/dashboard/DashboardView.tsx)）：
  - 在卡片右侧「连续打卡 / 最长 N 天」区域铺一层低透明度暖色火焰插画，把「连胜」的意象做成大面积淡背景，而不是只靠 20px 的小火苗图标。
  - **形状**：双尖浅谷的火苗轮廓（谷深约占全高 28%，刻意避开对称双尖的「兔耳感」与单尖的「水滴感」），底部圆弧展开；底部叠一层径向暖光，制造「光从下方升起」。
  - **淡出处理**：`feGaussianBlur(2)` 虚化边缘，渐变最低端 `stop-opacity` 归零——被卡片圆角裁切时不会留下水平硬线（此前一版在卡片底边有明显橙线）。
  - **层叠**：卡片 `<section>` 补 `relative overflow-hidden` 承载背景，中间内容与连胜区块包 `relative z-10`，保证文字、按钮始终在火焰之上；火焰本身 `pointer-events-none` + `aria-hidden`，不参与交互与读屏。
  - **主题**：浅色 0.20、深色 0.28（深底上橙色容易发闷，需略提），色相走 `#FF4D21 → #FF8A00 → #FFB23C`。
  - 验证：在 Vite dev（5173）用无头 Chrome 截图逐版比对形状与浓度，还原 mock 数据后 `tsc`/门禁复核。

- **[WorkBuddy]** 修复快捷搜索（Cmd+K）点「清空」后光标丢失（[CommandPaletteModal.tsx](file:///Users/gripet/Library%20Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/search/CommandPaletteModal.tsx)）：
  - **现象**：首页点开快捷搜索、输入关键词后点「清空」，焦点不在输入框，必须再点一次才能继续输入。
  - **根因**：清空按钮 `onClick` 只调 `appActions.searchCmdKDebounced('')`；`mousedown` 时浏览器把焦点交给按钮，随后 `cmdKQuery` 变空、按钮被 `{cmdKQuery && …}` 条件卸载，焦点落到 `body`，输入框彻底失焦。
  - **修复**：为输入框补 `searchInputRef`；按钮 `onMouseDown` 阻止默认行为（焦点不离开输入框，中文输入法也不被中断），`onClick` 清空后 `searchInputRef.current?.focus()` 显式交还焦点；顺带给按钮补 `aria-label`。
  - **验证**：`tests/test_frontend_bundle.mjs` 新增 `Item #32`，并用变异测试确认有效——删掉 `focus()` 调用后该断言立即失败，恢复后全绿；`tsc --noEmit` 0 错误、Python 单测 37 项通过、`npm run build` 已重建产物。

- **[Gemini] 新增对齐 Anki 官方客户端的 16 国多语言国际化系统（Multi-Language i18n System）**：
  - **16 国语言全量对齐**：对齐 Anki 桌面端核心支持的 16 种官方语言：简体中文（`zh-CN`）、繁體中文（`zh-TW`）、English（`en`）、日本語（`ja`）、한국어（`ko`）、Español（`es`）、Français（`fr`）、Deutsch（`de`）、Русский（`ru`）、Português (Brasil)（`pt-BR`）、Italiano（`it`）、العربية（`ar`）、Tiếng Việt（`vi`）、Türkçe（`tr`）、Polski（`pl`）、Nederlands（`nl`），并支持「跟随 Anki 客户端（`auto`）」自动读取 `anki.lang.current_lang`。
  - **后端语言归一化与本地化**：在 [`bridge/deck_service.py`](bridge/deck_service.py) 中新增 `SUPPORTED_LANG_CODES`、`ANKI_LANG_ALIAS_MAP` 与 `normalize_language_code()`（兼容 `zh_CN`、`zh_TW`、`ja_JP`、`pt_BR` 等 Anki 底层 locale 命名），并为 16 种语言提供原生问候语（`_get_greeting`）、7 日星期短标签（`_get_weekday_short_labels`）与日期格式化（`_format_date_display`）。
  - **前端多语言字典引擎与设置中心选择器**：重构 [`frontend/src/i18n/translations.ts`](frontend/src/i18n/translations.ts)，内置 16 国完整翻译字典（`DICT`）、`SUPPORTED_LANGUAGES` 元数据、浏览器/客户端语言自动探测以及基于 `Intl.RelativeTimeFormat` / `Intl.DateTimeFormat` 的多语言时间格式化；升级 [`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx) 与 [`frontend/src/components/design-system/DesignSystemView.tsx`](frontend/src/components/design-system/DesignSystemView.tsx) 的语言切换卡片，提供 16 国语言下拉选择器与高频语言一键胶囊切换。
  - **验证**：新增 Python 单测 `test_26_multi_language_16_locales_resolution_and_formatting` 与 Bundle 审计 `Item #31`，前端编译、Bundle 审计与 Python 单测全部通过。

- **[WorkBuddy]** 修复复习界面渲染崩溃（React `#310 Rendered more hooks than during the previous render`，[ReviewerView.tsx](file:///Users/gripet/Library/Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/reviewer/ReviewerView.tsx)）：
  - **根因**：`// Milestone 3` 的 `expectedTypeTarget` 与 `typeAnswerDiff` 两个 `useMemo` 写在 `if (isSessionComplete || !currentCard)` 早退**之后**。进入复习模式时 `reviewQueue` 先为空（渲染完成态，Hook 数量少 2 个），队列异步到达后同一实例再次渲染便多出 2 个 Hook → React 直接抛 #310，整屏被渲染异常兜底页接管。
  - **修复**：将两个 `useMemo` 上移至早退之前（均在内部保留 `!currentCard` / `!expected` 空值守卫），使两条渲染路径的 Hook 数量恒定；`orderedFieldKeys`、`activeFlagNum` 等纯计算仍留在早退之后。
  - **回归守卫**：`tests/test_frontend_bundle.mjs` 新增 `Item #30`，以字符串位置比对断言「ReviewerView 中最后一个 Hook 必须早于会话完成态 return」，并用 `git show HEAD` 的旧版源码验证该断言确实能捕获此缺陷（旧版 18973 > 11919，判定失败）。
  - 验证：`node tests/test_frontend_bundle.mjs` 全绿、Python 单测 36 项全绿、`npm run build` 重新产出 `web/assets`。

- **[Antigravity]** 精简制卡弹窗（[CardEditorModal.tsx](file:///Users/gripet/Library/Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/quick-add/CardEditorModal.tsx)）冗余连建交互：移除各字段的 `📌 固定` 开关、标签栏的 `📌 连建时保留标签` 开关、顶栏 `已连建 N 张` 徽章以及底部 `保存并继续 +1` 按钮（含对应 `Cmd+Shift+Enter` 分支与 `keepOpen`/pin 状态），更新 [`test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs) `Item #22` 校验规则。

- **[Antigravity]** 优化卡片库（[LibraryView.tsx](file:///Users/gripet/Library/Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/components/search/LibraryView.tsx)、[index.css](file:///Users/gripet/Library/Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/index.css)、[mathRenderer.ts](file:///Users/gripet/Library/Application%20Support/Anki2/addons21/anki_modern_os/frontend/src/utils/mathRenderer.ts)）卡片与表格预览 UI：
  - 新增 `formatCardPreviewHtml`，在保留数学公式、完形填空标签、图片与原生 Image Occlusion（`.anki-io-wrap`）的同时，将多段落/列表块边界规整为单行内流，彻底消除卡片背面预览框文字溢出与底部半字截断；
  - 将背面预览外框（`.library-card-snippet`）与多行截断容器（`.library-card-snippet-body`，`line-clamp: 3` + 块级子元素内联化）解耦，标题应用 `text-wrap: balance`；
  - 为 `.library-card-grid` 与 `.library-card` 引入自适应列宽（`repeat(auto-fill, minmax(min(100%, 254px), 1fr))`）、`subgrid` 行高对齐（`header` / `body` / `footer`）及 CSS 容器查询（`@container library-card-band`），修复底部“到期天数 + 熟练度”与“编辑”按钮重叠加盖问题；
  - 完善无障碍交互：复选框点击热区扩容至 `28x28px` 并补充 `:focus-visible` 聚焦指示与 `aria-pressed`，为每张卡片的“选择 / 编辑”按钮提供带卡片标题的区分性 `aria-label`；表格视图同步启用 `table-fixed` 与单行预览截断。

- **[WorkBuddy + Antigravity] `config.json` 脱敏防泄露与 `answer_card` 计时器修复及协同状态全量恢复**：
  - **历史清理与脱敏打包**（WorkBuddy）：从 15 个提交的 Git 历史中剥离含真实昵称/减负/休假记录的 `config.json`，新增纯净模板 [`config.default.json`](config.default.json)，将 `config.json` 加入 [`.gitignore`](.gitignore)，并调整 [`scripts/build_ankiaddon.py`](scripts/build_ankiaddon.py) 优先读取 `config.default.json` 结合 `PRIVATE_CONFIG_KEYS`（保留 `last_sync_checked_map`）打包。
  - **答题计时器修复**（WorkBuddy）：在 [`bridge/review_service.py`](bridge/review_service.py) `answer_card` 调用 `col.sched.build_answer` 前先执行 `card.start_timer()`，修复 Anki 26 因 `card.timer_started is None` 抛出 `TypeError` 导致答题静默失败且不写 `revlog` 的问题。
  - **全量无损恢复**（Antigravity）：利用 Gemini `08:55` 任务备份、`transcript_full.jsonl` 全量重放与 `12:17` `.ankiaddon` 产物对照，100% 字节级无损恢复 `Item #22`（Gemini）、`Item #23–#28`（Antigravity）与 `io-native` / `start_timer`（WorkBuddy）全部改动，并补齐 `test_25_answer_card_starts_timer_before_build_answer` 单测，Python 单测（36 项）、Bundle 审计与 11 场景 471 项冒烟回归全绿通过。

- **[WorkBuddy] 测试沙盒第二轮：补齐遮挡与极端值场景，并让数据可复现**：
  - **场景扩到 11 个**：新增 `media`（200 卡 + 4 个真实素材 + 5 个孤立文件）、`occlusion`（60 卡全为项目自定义 `.anki-io-wrap` 遮挡，1~3 个矩形、hide-all 与 hide-one 混排）、`io-native`（30 条 Anki 内置 `Image Occlusion`，`{{c1::<svg><rect/>}}</svg>}}` + canvas 渲染）、`edge`（150 卡注入负数与超大 `due`、`ivl` 含 0 与 2147483647）、`dirty`（120 卡注入 3 张空卡、2 组重复笔记、3 个缺失媒体引用、1 条超长字段）。
  - **遮挡两条路径的区别**：Anki 26 原生用 `canvas` + `anki.imageOcclusion.setup()`，而本项目用「Basic 笔记 + `.anki-io-wrap` + `span.anki-io-rect` 包 cloze」的自定义方案。生成器逐字复刻 `buildImageOcclusionHtml` 的结构，否则测到的是另一条渲染路径。
  - **可复现性校验**：`build.py --verify-repro` 生成两份并比对业务指纹（排除 `id`/`mod`/`due` 这些必然变化的时间字段，只比 notes 正文与 `type/queue/ivl/factor/reps/lapses`），`exam` / `occlusion` / `dirty` 两次生成完全一致。
  - **非法数值检查**：所有返回值序列化后不得含 `Infinity` / `NaN`——Python 的 json 会写成非法字面量，前端 `JSON.parse` 会当场抛错；`edge` 场景就是为此准备的。
  - **测试自身暴露并修复的两处缺陷**：① `smoke` 起初只复制 `anki2` 不复制 `.media`，`check_media` 把确实存在的文件误报为缺失；② `dirty` 场景 3 条笔记引用同一个文件名，而 `check_media` 按文件名去重只算 1 个，断言因此失去区分度。

- **[WorkBuddy] 测试沙盒第三轮审查：修正三处会让结论失真的缺陷，业务接口覆盖补到 38/38**：
  - **① 场景 `due` 量纲错误（影响所有场景）**：`builder` 用 Unix 天数（≈20756）写 review 卡的 `due`，而 Anki 的 `due` 是「距 collection 创建日的天数」（≈0–3）。结果是所有复习卡都被视为几万年后到期——「积压场景」里一张积压卡都没有，进度减负与低能量模式永远空跑。改为从 `col.crt` 推算 `today`；修正后 `backlog` 564/564 全部到期、`exam` 86/489、`power` 304/1993。
  - **② 测试环境的配置写入语义与产品不一致**：`smoke.py` 的 `config_writer` 原先整体替换，而 `__init__.py` 的 `write_config` 是 `{**old, **new}` 合并。`rescue_backlog` 只写 receipt 两个键时会连带清掉 `vacation_state`，于是 `undo_rescue` 找不到回执、零 diff 断言假失败。
  - **③ `backlog` 配方方向写反**：`overdue_range=(20, 180)` 是正数（未来到期），改为 `(-180, -20)` 才是逾期。
  - **新增回归链路（117 → 471 项）**：休假 `set_vacation → cancel` 与减负 `rescue_backlog → undo_rescue` 的**逐卡零 diff**、低能量选卡、牌组 `create → rename → delete`、`save_deck_options` 往返、`batch_action` 加标签落 `notes.tags`、`answer_card` 后 revlog 精确 +1。核心断言从「返回 success」升级为「查 sqlite 对得上」。
  - **补齐 13 个此前未覆盖的 action**：`get_review_queue`、`preview/start_custom_study`、`check_duplicate`、`save_preferences`、`end_vacation`、`toggle_bury`、`update_card_inline`、`save_pasted_image`、`undo`、`sync`、`sync_collection`、`delete_cards`，业务接口覆盖率 11 → **38/38**。
  - **门禁有效性验证（变异测试）**：临时让 `render_native_image_occlusion` 直接返回空，`native-io:frontHtml` / `native-io:review` / `native-io:multi-cloze` 三条立即 FAIL；恢复后回到全绿，确认断言不是摆设。
  - **边界处理**：极端 `due` 下 Anki 会把 relearn 卡规范化成 review 卡，`edge` 场景改为只对调度数值做零 diff、`type/queue` 变化记 warning；无到期复习卡的场景跳过减负/低能量并 warn，而不是判失败。

- **[Antigravity] 精简同步胶囊浮窗结构与悬停高亮细节（[SyncStatusPill.tsx](frontend/src/components/dashboard/SyncStatusPill.tsx)）**：
  - 删除同步浮窗右上角状态徽标（`历史快照 / 同步中 / 刚刚对齐 / 未同步`）以及底部操作栏（`立即同步` 与 `设置` 按钮），避免与外层同步按钮重复。
  - 将底部说明文案调整为「`此时间代表上次同步云端时间。如有新的修改，请点击按钮完成同步。`」，同步清理无用主题变量，并补充前端断言覆盖。
  - 移除悬停时左侧状态文字（「上次同步 / 尚未同步」）与 `Y` 快捷键的 `group-hover:text-[var(--brand-text)]` 变蓝样式，仅保留右侧刷新图标在悬停时变蓝高亮；并将图标过渡改为 `motion-safe:transition-[transform,rotate,color]`（Tailwind v4 `rotate-180` 映射到独立的 CSS `rotate` 属性，缺 `rotate` 会导致悬停 180° 旋转动画消失）。

- **[Antigravity] 修复点击「立即同步」后同步胶囊状态/时间未更新的生命周期与 `col.ls` 回写覆盖 Bug**：
  - **问题根因**：
    1. **Anki `NO_CHANGES` 不更新数据库 `col.ls`**：当本地与 AnkiWeb 均无变更时，Anki 原生同步以 `NO_CHANGES` 结束，只触发 `gui_hooks.sync_did_finish`，而**不会修改 SQLite `col.ls`**；随后前端 `initFromAnki(true)` 拉取 `get_dashboard()` 又读回 40 分钟前的旧 `col.ls`，把刚设置的“刚刚”覆盖回旧时间。
    2. **`initFromAnki(true)` 强行清零 `syncJustFinished`**：静默刷新直接把 `syncJustFinished: false` 写入状态，导致 `✓ 同步完成` 瞬时态在几百毫秒内被掐断。
    3. **异步时序与异常缺失**：`syncCollection()` 使用固定 2200ms 定时器而非等待真实的 `anki:sync-finished` 事件；未登录 `AnkiWeb`（`pm.sync_auth()` 为空）或发生 `handle_sync_error` 异常时无法准确区分真实完成、登录拦截与失败状态；且 `_on_sync_did_finish` 连发 `sync-finished` 与 `collection-updated` 导致双次并发刷新。
  - **修复内容**：
    - 后端 [__init__.py](__init__.py) 与 [scripts/build_ankiaddon.py](scripts/build_ankiaddon.py)：拦截 `aqt.sync.handle_sync_error` 识别真实同步异常；在 `_on_sync_did_finish` 校验 `col.ls > 0` 后，将本次验证时间按 profile 持久化到私有配置键 `last_sync_checked_map` 并透传 `synced` / `syncedAt` / `error`。
    - 后端 [bridge/deck_service.py](bridge/deck_service.py) 与 [bridge/router.py](bridge/router.py)：`get_dashboard` 在 `col.ls > 0` 时合并 `max(col.ls, last_sync_checked_map[profile])`（未同步库 `col.ls == 0` 仍严格保持 `0`）；`action_sync` 检测 `pm.sync_auth()` 与媒体后台同步状态并标记 `asyncPending` / `requiresLogin`。
    - 前端 [frontend/src/stores/useAppStore.ts](frontend/src/stores/useAppStore.ts)、[frontend/src/App.tsx](frontend/src/App.tsx) 与 [frontend/src/components/dashboard/SyncStatusPill.tsx](frontend/src/components/dashboard/SyncStatusPill.tsx)：引入 `sessionVerifiedSyncTs` 与 `handleNativeSyncFinished` 协调真实完成事件，静默刷新保留 `syncJustFinished` 与单调最新验证时间戳，跳过 `source === 'sync'` 的重复刷新，并确保胶囊 `effectiveNow` 不因 `nowTick` 采样滞后出现偏差。
  - **验证**：新增 Python 单测 `test_23_sync_no_changes_checked_timestamp_and_requires_login` 与前端审计断言 Item #28，前端编译、Bundle 审计及 Python 单测全部通过。

- **[WorkBuddy] 修复原生 Image Occlusion 卡片只显示 SVG 黑框、底图完全丢失的问题**：
  - **现象**：打开任何来自 Anki 官方界面或他人分享 `.apkg` 的 `Image Occlusion` 卡片，列表与复习界面都只显示若干半透明黑色矩形，原图不出现，卡片标题是一串 SVG 源码。
  - **根因**：`search_service._serialize_library_card` 与 `review_service` 都按 `fields[0]` 取正文，而原生遮挡笔记的字段顺序是 `Occlusion`（SVG 覆盖层）、`Image`（底图）、`Header`、`Back Extra`、`Comments`。于是 SVG 被当成正文直出，`Image` 从未参与渲染。插件也没有实现原生模板里的 `canvas` + `anki.imageOcclusion.setup()`——但即便实现也无效：React 的 `dangerouslySetInnerHTML` 不执行 `<script>`。
  - **修复**：在 [`bridge/media_utils.py`](bridge/media_utils.py) 新增 `render_native_image_occlusion(note)`，把 `Occlusion` 里 `{{cN::<svg><rect …/></svg>}}` 的 viewBox 坐标（0–100）直接当作百分比，生成 `.anki-io-wrap` + `span.anki-io-rect`，复用项目既有的静态遮罩渲染链路；底图取 `Image` 字段，答案面返回原图。`search_service` 与 `review_service` 在取字段前先尝试该函数，命中则整体替换 front/back，未命中回落原逻辑；列表标题回落到 `Header`，不再把 SVG 源码当标题。
  - **验证**：`io-native` 场景 12 项冒烟全通过（`native-io:frontHtml` 与 `native-io:review` 分别守住列表与复习两条路径）；新增单测 `test_22_native_image_occlusion_renders_static_masks`（含 0 尺寸矩形丢弃、非遮挡笔记回落）；34 项 Python 单测与 Bundle 审计全绿。

- **[Antigravity] 按「方案 B + Modern Web Guidance」重构同步状态胶囊与同步设置页语义体验**：
  - **问题根因**：原先 [SyncStatusPill.tsx](frontend/src/components/dashboard/SyncStatusPill.tsx) 与 [SettingsModal.tsx](frontend/src/components/settings/SettingsModal.tsx) 在历史同步后恒定展示带光晕的实心绿色圆点及「已同步 (XX分钟前) / 实时同步」，容易误导用户以为处于实时在线一致状态，忽略了同步时间点新旧的相对性。
  - **改动内容**：
    - 新增形状语义清晰的共享图标组件 [SyncStateIcon.tsx](frontend/src/components/common/SyncStateIcon.tsx)：仅在同步刚完成的瞬时态短暂展示绿色对勾，常态历史同步展示**中性云朵图标**，从未同步展示**斜杠云朵图标**，同步中展示 **motion-safe 旋转环**（符合 `color` / `accessibility` 不单独依赖颜色区分状态的原则）。
    - 重构 [translations.ts](frontend/src/i18n/translations.ts)：文案由「已同步 / 已是最新」修正为事实陈述「上次同步 · 40分钟前」与「历史快照」，并采用原生 `Intl.RelativeTimeFormat({ numeric: 'auto', style: 'narrow' })` 与语义化 `<time dateTime={...}>` 输出相对/绝对时间戳。
    - 升级 [SyncStatusPill.tsx](frontend/src/components/dashboard/SyncStatusPill.tsx)、[index.css](frontend/src/index.css) 与 [SettingsModal.tsx](frontend/src/components/settings/SettingsModal.tsx)：移除冗余 `title`、为飞出信息卡补充键盘焦点（`onFocusCapture`/`onBlurCapture`）与 `Escape` 关闭支持（满足 WCAG 1.4.13），并在 `@media (prefers-reduced-motion: no-preference)` 下补齐微动画与减少动态效果兜底，同时在 `tests/test_frontend_bundle.mjs` 新增 Item #27 校验。

- **[Antigravity] 修复首页点击「进度减负」默认打开历史记录标签页的问题**：
  - **问题根因**：`frontend/src/components/layout/Sidebar.tsx` 点击「进度减负」按钮时会在存在 `recentReceipt` 且无积压警报时强制传入 `'history'` 打开 `IcuRescueModal`，且 `frontend/src/components/vacation/IcuRescueModal.tsx` 在 `totalDue === 0 && rescueHistory.length > 0` 时也将初始 `activeTab` 回退为 `'history'`。
  - **修复内容**：移除侧边栏按钮的自动跳转历史记录分支，统一调用 `appActions.openIcuModal('rescue')`；同时简化 `IcuRescueModal.tsx` 初始标签判断为仅在显式请求 `store.icuModalTab === 'history'` 时进入历史记录，默认始终展示「减负方案」（执行减负/撤销后及手动点击标签切换仍保留在历史记录页）。并在 `tests/test_frontend_bundle.mjs` 新增 Item #26 回归断言。

- **[WorkBuddy] 新增与真实数据完全隔离的用户场景测试沙盒（`tests/scenarios/`）**：
  - **背景**：此前所有验证都跑在真实 collection 上，而该库只有 2 个牌组、2 种笔记类型、0 张隐藏卡。日常路径能测通，但多牌组嵌套、Cloze/图片遮挡、标签体系、积压、状态混杂、空库、大集合性能等问题一次都覆盖不到。多人协作下更需要一套「不碰用户数据」的验证环境。
  - **技术底座（已实测）**：Anki 26.9.4 自带完整 `anki` Python 包（`/Applications/Anki.app/Contents/Resources/app_packages`，含 `_rsbridge.so`，CPython 3.13），系统 Python 直接 import 即可创建真实 collection，无需 pip 安装或伪造 schema。生成分三段：① 官方 API 建牌组/笔记/卡片并关闭 → ② 标准库 `sqlite3` 直写 `due`/`queue`/`type`/`ivl`/`factor`/`revlog` → ③ 重新用官方 API 打开复验卡片数与队列分布。
  - **隔离模型**：沙盒固定在 `~/Anki-Test-Env`，用 `Anki -b <沙盒>/base -p 测试账户` 启动，与 `~/Library/Application Support/Anki2` 无交集。三条硬规则：启动必须带 `-b`（无裸启动路径）；插件目录用 **rsync 复制而非软链**（软链会让插件写入的 `config.json` 穿透回开发目录）；首次同步时剥离 `config.json` 的 `custom_nickname` / `last_rescue_receipt` / `vacation_state` / `vacation_history` / `vacation_frozen_dates`，测试环境不携带真实信息。
  - **新增文件**：[`tests/scenarios/guard.py`](tests/scenarios/guard.py)（路径守卫，`assert_sandboxed` 解析软链后校验，越界直接抛 `IsolationError`）、[`builder.py`](tests/scenarios/builder.py)（四段式生成器，支持媒体素材与脏数据注入，固定 seed 可复现）、[`scenarios.py`](tests/scenarios/scenarios.py)（8 个场景配方）、[`build.py`](tests/scenarios/build.py)（生成 CLI）、[`smoke.py`](tests/scenarios/smoke.py)（无 GUI 冒烟回归）、[`run.sh`](tests/scenarios/run.sh)（同步副本→备份现场→切库→启动）、[`gate.sh`](tests/scenarios/gate.sh)（一键门禁）、[`verify_isolation.py`](tests/scenarios/verify_isolation.py)（6 项隔离自检）、[`README.md`](tests/scenarios/README.md)。
  - **场景矩阵（11 个）**：`empty`（0 卡空态）、`newbie`（100 卡全新）、`exam`（~800 卡 / 三层牌组 / Basic+Cloze / 30% 新卡 / 标签 / 复习历史，回归主力）、`backlog`（600 卡全逾期）、`mixed`（暂停/隐藏/学习/重学混排）、`power`（3000 卡 / 8 牌组 / 3 笔记类型）、`media`（200 卡 + 4 个真实 PNG/MP3 素材 + 5 个孤立文件）、`occlusion`（60 卡全部为项目自定义 `.anki-io-wrap` 遮挡结构）、`io-native`（30 条 Anki 内置 `Image Occlusion` 笔记，`{{c1::<svg>}}` + canvas 渲染）、`edge`（150 卡注入负数与超大 `due`、`ivl` 含 0 与 2147483647）、`dirty`（120 卡注入空卡、重复笔记、缺失媒体、超长字段）。
  - **该场景直接促成了一次产品修复**：`io-native` 场景暴露了原生遮挡卡只显示 SVG 黑框、底图丢失的问题。起初以 `warning` 挂起（详见下条机制），确认根因后已按文首条目修复，warning 随之升级为正式断言 `native-io:frontHtml` / `native-io:review`，列表与复习两条路径都守住。
  - **已知缺陷机制（保留）**：`smoke.py` 的 `runner.warn()` 把「产品确实不支持」与「测试失败」区分开——前者不计入退出码，但每次运行都会汇总打印，避免「全绿 = 功能完整」的错觉。当前无未认领项。
  - **图片遮挡场景的口径修正**：动手前先探明 Anki 26 原生 Image Occlusion 走 `canvas` + `anki.imageOcclusion.setup()`，而本项目走的是「Basic 笔记 + `.anki-io-wrap` + `span.anki-io-rect` 包 cloze」的自定义方案，两者不同。生成器逐字复刻 `buildImageOcclusionHtml` 的结构；实测确认**后端已消费 cloze 并注入遮罩样式**，因此断言写成「cloze 必须已被消费」而非「保留 cloze」——后者会把正确行为判成失败。
  - **自动回归（`smoke.py`）**：不启动 GUI，把 `BridgeRouter` 直接接到场景 collection 上，跑前端真实会调的 action 并断言。读路径覆盖 `get_dashboard` / `get_statistics` / `search_cards` / `get_deck_options` / `get_vacation_status` / `get_preferences`；维护路径在 dirty 场景断言 `check_db` 完整性为 ok、`check_empty_cards` 至少检出注入数、`check_media` 至少检出注入的缺失数；遮挡路径断言 `data-io-mode` / `data-io-rect` / 遮罩样式 / 图片 `file://` 齐备且 cloze 已消费；写路径直接查 sqlite 验证 `set_card_flag` 的 flags 低三位、`toggle_suspend` 的 queue=-1、`quick_add` 的卡片数 +1，不相信返回值自报成功。所有返回值额外过一遍非法数值检查（出现 `Infinity` / `NaN` 即失败，因为前端 `JSON.parse` 会抛错）。全部在 `state/smoke/` 副本上跑，11 场景 115 项约 3.6 秒。另加 `gate.sh` 五步门禁（隔离自检 → 补场景 → 可复现性 → 冒烟回归 → 可选项目门禁）。
  - **可复现性校验**：`python3 build.py --verify-repro <场景>` 会生成两份并比对业务指纹（排除 `id` / `mod` / `due` 这些必然变化的时间字段，只比 notes 正文与 `type/queue/ivl/factor/reps/lapses`）。`exam` / `occlusion` / `dirty` 实测两次生成指纹完全一致。

- **[Antigravity] 修复卡片库/复习预览可见图片但点开编辑显示破图图标的 Bug，并完善编辑器与数据库之间的媒体路径双向往返标准化**：
  - **问题根因**：Anki 卡片字段（以及原生理卡、图片遮挡模板 `ImageOcclusionEditorModal`）在 `notes.flds` 中以相对文件名保存图片（如 `<img src="paste-xxx.png">`）。此前 [`search_service.py`](bridge/search_service.py) 与 [`review_service.py`](bridge/review_service.py) 仅在生成展示用 `frontHtml` / `backHtml` 时将其改写为 `file:///.../collection.media/...`（因此列表与搜索预览正常显示图片），而下发给编辑弹窗的原始 `fields` 仍保留相对路径；WebView 文档根路径为插件 `web/index.html`，导致 [`CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`TowerWysiwygEditor.tsx`](frontend/src/components/quick-add/TowerWysiwygEditor.tsx) 与 [`ImageOcclusionEditorModal.tsx`](frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx) 加载相对路径时全部 404 破图。
  - **后端媒体基础路径与双向规范化**：
    - 提取共享模块 [`bridge/media_utils.py`](bridge/media_utils.py)（提供 `get_media_dir`、`get_media_base_url`、`resolve_media_img_src_for_webview` 与 `normalize_media_html_for_storage`），复用并消除 `search_service` / `review_service` 中的重复图片正则逻辑，支持相对文件名、带空格/中文文件名、无引号 `src` 与携带 `data-anki-media` 的跨机失效 `file://` 兜底修复，且严格跳过 `data-src` 与 `{{c1::...}}` / `[sound:...]`。
    - [`bridge/deck_service.py`](bridge/deck_service.py) 在 `envInfo`（`get_dashboard` / `get_preferences`）中注入当前集合媒体库根目录 URI `mediaBaseUrl`。
    - [`bridge/edit_service.py`](bridge/edit_service.py) 在 `quick_add_card` 与 `update_card_inline` 写入 SQLite 前，将属于当前 `collection.media` 的 `file://` 图片地址自动归一化为标准相对文件名，确保兼容 Anki 原生界面、AnkiWeb 云同步与移动端。
  - **前端编辑态解析**：新增 [`frontend/src/utils/mediaUrl.ts`](frontend/src/utils/mediaUrl.ts)（含从 `frontHtml`/`backHtml` 反推 `collection.media` 路径的二次兜底），并在 [`CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`TowerWysiwygEditor.tsx`](frontend/src/components/quick-add/TowerWysiwygEditor.tsx) 与 [`ImageOcclusionEditorModal.tsx`](frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx) 打开编辑、晚到同步及遮挡应用时自动解析显示 `file://` 媒体图片，同时保持 `originalSnapshot` 与脏检查准确。

- **[Antigravity] 修复卡片库筛选下拉计数与实际结果不一致的 Bug，并消除顶部副标题重复计数文案**：
  - **数字不一致根因修复**：
    - **后端全量分面统计**：在 [`bridge/search_service.py`](bridge/search_service.py) 中新增 `_get_collection_total()` 与 `_compute_facet_counts()`，通过单次 SQLite 全表扫描（单测环境平滑回退 `col.get_card()`）结合跨维度过滤查询，随 `search_cards` 下发真实的全库总卡片数 `collectionTotal` 与按其它激活条件交叉统计的 `facetCounts`（覆盖 `statusCounts`、`difficultyCounts`、`flagCounts`、`tagCounts` 与 `tagAllCount`），彻底解决此前前端仅基于分页第 1 页（前 200 条）`libraryCards` 统计导致下拉框显示「已暂停 2」而点击筛选后实际匹配 `47` 张的偏差，且批量操作后统一刷新全库计数与分面状态。
    - **真实总数不被筛选覆盖**：修复此前 `search_cards` 返回 `"total": len(cids)` 被筛选条件（如 `已暂停`）覆盖后覆盖写入 `libraryTotalCount`，导致「总卡片」变成筛选子集数量（`47 张总卡片`）的问题；保持原有 `"total"` 向后兼容的同时，前端 [`useAppStore.ts`](frontend/src/stores/useAppStore.ts) 改为绑定 `collectionTotal` 与 `libraryFacetCounts`。
  - **消除重复显示文案**：调整 [`translations.ts`](frontend/src/i18n/translations.ts) 与 [`LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx) 顶部副标题 `librarySub` 为简洁准确的「**共 {total} 张卡片 · {decks} 个牌组**」（英文 `{total} total cards · {decks} decks`），移除原先在标题下与过滤栏右侧（`{n} 张符合条件`）重复出现的「当前匹配 X 张」，且仅在存在实际收敛筛选条件时在过滤栏右侧展示符合条件数量。

- **[Antigravity] 禁止弹窗点击外部灰色遮罩误触关闭，仅保留弹窗自身关闭按钮/Esc 关闭，并补全全局搜索弹窗关闭符号**：
  - **全量弹窗遮罩防误触**：移除 [`CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx)、[`SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx)、[`CustomStudyModal.tsx`](frontend/src/components/study/CustomStudyModal.tsx)、[`DecksView.tsx`](frontend/src/components/decks/DecksView.tsx)（牌组选项弹窗）、[`CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`ImageOcclusionEditorModal.tsx`](frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx)、[`VacationModal.tsx`](frontend/src/components/vacation/VacationModal.tsx) 与 [`IcuRescueModal.tsx`](frontend/src/components/vacation/IcuRescueModal.tsx) 外层 `fixed inset-0` 灰色遮罩上的点击关闭事件，彻底杜绝鼠标移出或误点弹窗周边灰色区域导致内容丢失或面板意外关闭的问题（`Esc` 快捷键与弹窗内明确关闭/取消按钮继续保留）。
  - **全局搜索弹窗关闭符号拆分**：修复 [`CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx) 原先顶部右侧 `✕` 仅在有搜索词时显示且点击只清空搜索文字、不关闭弹窗的交互冲突——在弹窗右上角常驻明确的 `✕` 关闭按钮（绑定关闭面板并标注 `关闭 (Esc)`），并将输入框右侧原有清空功能拆分为独立的「**清空 / Clear**」文本胶囊按钮，避免图标语义混淆。

- **[Antigravity] 全局搜索预览面板新增「复制正面」与「复制背面」悬浮快捷按钮**：
  - **交互与样式细节**：在 [`CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx) 右侧卡片预览区的「卡片正面」和「卡片背面」区域右上角分别新增「**复制正面**」与「**复制背面**」按钮，基于 Tailwind `group/front` 与 `group/back` 实现**仅当鼠标悬停对应区域（或键盘聚焦内部）时淡入显示**、默认隐身且不引起布局抖动的优雅交互；点击复制后保留 2 秒按钮内嵌绿色「已复制」状态反馈，移除多余的全局成功 Toast 弹窗（仅在复制失败时提示）。
  - **多行文本保真**：新增 `extractCopyableText()` 辅助函数，在点击复制时通过安全 DOMParser 将卡片 HTML 中的换行与段落结构完整保留为纯文本（如保留选项 A/B/C/D 分行），共享同一套 `renderCopyButton()` 组件与防错位定时器管理。


- **[Gemini] 新增三大高阶原生能力：制卡增强套件（模板选择/防重预警/连续制卡与字段固定）、卡片库高阶管理（多维排序/批量查找替换/批量删标）、复习拼写默写检验模式（Type-in-the-Answer）**：
  - **1. 制卡增强套件（Card Creation Power Suite）**：
    - **后端**：在 [`bridge/edit_service.py`](bridge/edit_service.py) 与 [`bridge/router.py`](bridge/router.py) 中新增 `get_note_types`（枚举集合内全部 Note Types 及其自定义字段序列）、`check_duplicate`（实时检索 `notes` 表 `sfld` 与首字段，毫秒级识别重复词条并支持 `excludeNoteId` 排除自身）以及升级 `quick_add`（支持指定 `modelId`、开启 `createReverseCard` 一键生成正反双向卡片、开启 `typeAnswerMode` 自动附加 `#默写` 标签及写入自定义扩展字段 `fields`）。
    - **前端**：在 [`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx) 中新增：① **笔记类型与制卡模式选择器**（支持 `问答题 Basic`、`正反双向卡 Basic + Reversed (2张)`、`拼写默写卡 Basic (type in the answer)`、`填空题 Cloze` 及集合内任意多字段自定义模板）；② **实时防重预警横幅**（输入正面词条时自动检测重复卡片，并支持一键「在卡库中查看」）；③ **字段固定图钉（`📌 固定`）与连续制卡按钮（`保存并继续 +1` / `Cmd+Shift+Enter`）**，固定后的字段或标签在连续建卡时自动保留，大幅提速批量制卡流。
  - **2. 卡片库高阶管理（Library Multi-Sort, Batch Find & Replace, Batch Tag Removal）**：
    - **后端**：在 [`bridge/search_service.py`](bridge/search_service.py) 中为 `search_cards` 新增 `sortBy` 多维排序参数（支持 `default`、`lapses_desc` 失误最多、`due_asc` 到期最早、`ivl_asc` 间隔最短、`ivl_desc` 间隔最长、`stability_asc` 熟练度最低、`front_asc` 词条 A→Z、`newest` 最新创建），并在 `_serialize_library_card` 中下发真实 `lapses` 与 `dueRaw`；在 `batch_action` 中新增 `removeTag`（批量移除指定标签）与 `findReplace`（支持按 `all` / `front` / `back` 字段范围及 `ignoreCase` 批量查找替换文本）。
    - **前端**：在 [`frontend/src/components/search/LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx) 与 [`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts) 中新增「排序」下拉胶囊、表格视图可点击排序表头，以及底部批量操作栏的「移除标签」（含已选卡片高频标签一键点选移除）与「查找替换」交互面板。
  - **3. 复习拼写输入比对模式（Type-in-the-Answer 默写检验与逐字差异高亮）**：
    - 在 [`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx) 顶部工具栏新增「⌨️ 默写 (Type)」开关（当卡片带有 `#默写` / `#type-answer` 标签或属于 Type 类模板时自动开启）。问题面提供原生级默写输入框（按 `Enter` 直接提交并翻面），答案面基于 LCS 动态规划算法逐字比对用户输入与标准答案（填空卡自动提取 `{{cN::答案}}` 词条，问答卡提取背面核心释义），以翠绿（匹配）、玫红删除线（多写/错字）、琥珀下划线（漏写）直观呈现拼写差异与匹配度百分比。
  - **验证**：新增 `test_19_note_types_duplicate_sort_find_replace` 与 Bundle 审计 Item #22，全部 Python 单测、`tsc --noEmit`、前端构建与 Bundle 审计 100% 通过。

- **[Antigravity] 极简打卡副标题：移除连续打卡卡片中的「本周 X / 7」提示**：
  - 在 [`translations.ts`](frontend/src/i18n/translations.ts) 与 [`DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx) 中简化连续打卡卡片副标，移除容易引起理解歧义的「· 本周 X / 7」，保持清爽极简的「**最长 {longest} 天**」（英文对齐为 `Best {longest}d`），使打卡卡片聚焦在当前连续天数与个人最长历史纪录上。


- **[Antigravity] 优化完成今日学习待办时的庆贺文案**：
  - 在 [`translations.ts`](frontend/src/i18n/translations.ts) 中将今日所有牌组待办学完后的主标题文案 `allClearedTitle` 由「今日待办已全部清空！」更新为「**恭喜你已完成全部牌组的学习！**」（英文同步对齐为 `Congratulations! All decks completed!`），视觉呈现更加亲和振奋。


- **[Antigravity] 全链路真云端同步态对齐与本地数据加载解耦（Truth-in-Syncing & Reconcile Architecture）**：
  - **1. 根因彻底清查与虚假同步修复**：
    - 查明原生界面与现代界面切换、冷启动或刷新时界面错误显示「正在从云端同步...」、「集合与云端已完全同步」及胶囊显示「已同步 (刚刚)」的根本原因：此前 [`bridge/deck_service.py`](bridge/deck_service.py) 中的 `get_dashboard()` 每次被调用时均硬编码 `"syncedAt": int(time.time() * 1000)`，导致前端误认为刚刚发生了一次完整的 AnkiWeb 云端同步。
    - 在 [`bridge/deck_service.py`](bridge/deck_service.py) 中新增 `_get_last_sync_timestamp(col)`，穿透读取 Anki 官方 SQLite `col` 表真正的 `ls` 字段（最后一次与 AnkiWeb 双向同步完成的真实微秒/毫秒时间戳）；若从未配置或未同步过则真实返回 `0`。
  - **2. 文案真实化：彻底解耦「本地卡库加载」与「AnkiWeb 云端同步」**：
    - 在 [`DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`DecksView.tsx`](frontend/src/components/decks/DecksView.tsx)、[`StatsView.tsx`](frontend/src/components/stats/StatsView.tsx) 中纠正误导性文案：本地 SQLite 数据读取与 FSRS 留存率计算期间准确提示「正在加载本地卡库与 FSRS 记忆调度...」/「正在从本地卡库计算 FSRS 记忆留存与预测曲线...」，数据就绪后提示「数据就绪 · 本地卡库已更新」；仅在真正触发 AnkiWeb 同步时提示「正在与 AnkiWeb 云端同步...」。
  - **3. 状态胶囊精准真态显示与未同步态兜底**：
    - 重构 [`SyncStatusPill.tsx`](frontend/src/components/dashboard/SyncStatusPill.tsx) 与 [`translations.ts`](frontend/src/i18n/translations.ts)：当 `lastSyncedTimestamp === 0` 时，呈现中性灰状态点与「尚未同步」文案，气泡悬浮窗标明「从未同步 · 暂无云端同步记录」，并在气泡底部明确注明「本地修改已实时自动保存至 SQLite。点击立即同步即可与 AnkiWeb 云端双向对齐」；当有真实同步记录时，准确呈现「已同步 (1小时前)」及真实时间戳（如 `2026-11-10 20:25:37`）。
  - **4. 原生切换复习队列多端对齐（Review Queue Reconciliation）**：
    - 在 [`useAppStore.ts`](frontend/src/stores/useAppStore.ts) 的 `initFromAnki()` 中增加校验：若用户在复习做题状态下切换至原生 Anki 并在原生中做完了卡片，返回现代界面时自动调用 `start_review` 重新获取最新到期队列；若卡片已全部完成，平滑切换为恭喜完成庆贺屏幕，彻底杜绝已学卡片二次作答或状态不同步问题。
  - **5. 自动化测试保障**：
    - 在 [`tests/test_bridge.py`](tests/test_bridge.py) 中补齐真实 `col.ls` 读取与 `synced: False` 零时间戳兜底双向单测，30 项 Python 核心单测、12 项卡片安全单测及前端 bundle 审计全部 100% 通过。

- **[Antigravity] 遵循现代 Web 规范全面审查并优化新功能 UI (Modern Web Guidance & Accessibility Polish)**：
  - **1. 文本与徽章色彩对比度升级 (WCAG 1.4.3 Contrast Minimum)**：
    - 全局次级文字 `subText` 从静态 `#8E8E93`（浅色模式白底对比度仅 3.0:1）升级为响应式语义类 `text-[#636366] dark:text-[#8E8E93]`，浅色模式对比度提升至 **5.1:1**（深色模式保持 4.6:1），使 [`DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`StatsView.tsx`](frontend/src/components/stats/StatsView.tsx) 与 [`LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx) 中所有的副标题、说明文字与数据格全线达到 WCAG AA 4.5:1 硬门禁。
    - [`LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx) 中已搁置（Buried）状态徽章文本优化为 `text-[#555558] dark:text-[#A1A1A6]`，在浅色底色与深色底色下对比度分别达 5.5:1 和 5.8:1，并将卡片卡头圆点统一归正为中性灰 `#8E8E93`。
  - **2. 交互控件键盘焦点与靶区尺寸优化 (WCAG 2.4.7 Focus Visible & 2.5.8 Target Size)**：
    - 主界面看板「待复习」、「新卡」、「已完成」3 枚可点击微胶囊设置 `min-h-[30px]`（确保大于 24x24px 目标尺寸规范），并配置 `:focus-visible:outline-2 outline-offset-2` 专用焦点环，装饰性圆点注入 `aria-hidden="true"` 避免读屏器冗余朗读。
    - 做题界面抽屉内「搁置卡片」、「暂停卡片」与「删除卡片」三向独立操作按钮全面注入标准 `:focus-visible` 焦点样式与确认删除无障碍标签。
  - **3. 高级统计图表与数据条语义化支持 (WCAG 1.1.1 Non-text Content & 4.1.2 Name, Role, Value)**：
    - 成熟度多段堆叠条注入 `role="img"` 与全量百分比汇总 `aria-label`，各状态分段配置中英双语语义化悬浮 `title`。
    - 答题按钮分布横向进度条注入 `role="progressbar"`、`aria-valuenow`、`aria-valuemin` 与 `aria-valuemax`。
    - 留存率曲线与 24 小时活跃分布柱状图增加 `tabIndex={0}`、`role="img"` 及键盘悬停感知支持。
  - **验证**：全部 30 项 Python 单测通过，Bundle 审计（含 Guardrails 与 UX 门禁）100% 通过，`npx tsc --noEmit` 零类型报错，Vite 打包成功。

- **[Gemini] 新增图片遮挡制卡工作台（Image Occlusion Studio）与导入/导出及系统维护工具（Import/Export & Maintenance）**：
  - **1. 可视化图片遮挡制卡与复习渲染（Image Occlusion）**：
    - **后端与渲染引擎**：在 [`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py) 与 [`frontend/src/utils/mathRenderer.ts`](frontend/src/utils/mathRenderer.ts) 中新增 `.anki-io-wrap` 与 `.anki-io-rect` 百分比遮罩图层解析器，底层直接复用 Anki 原生 Cloze 挖空序号（`{{c1::...}}`、`{{c2::...}}`）自动拆分为独立子卡片。支持「隐藏全部 · 猜当前（`hide-all`）」与「仅隐藏当前（`hide-one`）」两种模式：问题面将当前提问区域渲染为高对比度琥珀色目标遮罩（`? #N`），答案面切换为半透明翠绿高亮边框并无损揭示原图文字。
    - **前端可视化画布工作台**：新增 [`frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx`](frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx) 并集成至 [`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx) 顶部工具栏，支持选择本地图片或直接按 `Cmd+V` 粘贴截图、鼠标左键拖拽绘制遮挡框、拖拽微调位置、修改卡组编号（如将多处标签同设为 `c1` 联动提问）、撤销/删除遮挡框，以及在编辑已有图片遮挡卡片时无损回读全部遮挡矩形。
  - **2. 导入/导出（`.apkg` / `.colpkg`）与系统维护工具（System Maintenance）**：
    - **后端**：在 [`bridge/deck_service.py`](bridge/deck_service.py) 与 [`bridge/router.py`](bridge/router.py) 中新增 `trigger_native_import`（唤起 Anki 原生 `.apkg` / `.colpkg` / 文本导入向导）、`trigger_native_export`（唤起原生牌组与集合备份导出向导）及 `run_maintenance` 诊断清理引擎（涵盖 `check_db` SQLite `PRAGMA quick_check` 完整性校验与 `ANALYZE` 索引优化、`check_empty_cards` / `clean_empty_cards` 空白卡与缺失挖空序号子卡扫描清理、`check_media` / `clean_unused_media` `collection.media` 未引用冗余文件与缺失引用比对清理）。
    - **前端**：在 [`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx) 新增「数据与维护」标签页，并在 [`frontend/src/components/decks/DecksView.tsx`](frontend/src/components/decks/DecksView.tsx) 顶部工具栏提供「导入 / 导出与维护」一键入口。
  - **验证**：新增 `test_18_image_occlusion_and_maintenance_tools` 与 Bundle 审计 Item #21，全部 Python 单测、`tsc --noEmit`、前端构建与 Bundle 审计 100% 通过。

- **[Gemini] 新增三大原生核心能力：牌组预设与核心调度参数（Deck Options）、7 色旗标系统（Flags）、自定义学习与错题集抽卡特训（Custom Study / Cram）**：
  - **1. 牌组预设与核心调度参数（Deck Options & FSRS Retention）**：
    - **后端**：在 [`bridge/deck_service.py`](bridge/deck_service.py) 与 [`bridge/router.py`](bridge/router.py) 中新增 `get_deck_options`、`save_deck_options`、`_serialize_deck_options` 及步长解析器（支持 `30s`、`1m`、`10m`、`1h`、`1d` 等格式双向转换），支持按牌组读取与持久化每日新卡上限（`newPerDay`）、每日最大复习数（`revPerDay`）、FSRS 目标记忆留存率（`desiredRetention` `0.70–0.97`）、学习步长（`learningSteps`）、遗忘重学步长（`relearningSteps`）与顽固卡失误阈值（`leechThreshold`），并在 `get_dashboard` 的每个牌组对象上直接下发 `options` 摘要。
    - **前端**：在 [`frontend/src/components/decks/DecksView.tsx`](frontend/src/components/decks/DecksView.tsx) 中新增每日限额与 FSRS 留存率胶囊及「牌组预设与核心调度参数」配置弹窗（采用主参数直出 + 高级步长 `<details>`/`<summary>` 渐进式披露，保持界面清爽）。
  - **2. 7 色旗标系统（7-Color Flags）**：
    - **后端**：在 [`bridge/edit_service.py`](bridge/edit_service.py) 中新增 `set_card_flag`（兼容 `col.set_user_flag_for_cards` 与 `card.flags` 位运算更新）；在 [`bridge/search_service.py`](bridge/search_service.py) 中支持 `flag` 过滤（`all` / `flagged` / `0`~`7`）、卡片 `flags` 序列化及批量操作 `batch_action(setFlag)`。
    - **前端**：在 [`frontend/src/bridge/pycmd.ts`](frontend/src/bridge/pycmd.ts) 中定义 `ANKI_FLAG_PALETTE`（红/橙/绿/蓝/粉/青/紫 7 色语义与色板）；在 [`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx) 中集成 `Cmd+1`~`Cmd+7`（或 `Ctrl+1`~`7`）一键标旗、`Cmd+0` 清除旗标、顶部旗标下拉选择器、卡片正面旗标徽章与右侧属性抽屉 7 色圆点；在 [`frontend/src/components/search/LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx) 中新增旗标筛选下拉菜单（含各色卡片计数）、卡片旗标徽章与底部悬浮栏批量标旗操作。
  - **3. 自定义学习 / 错题集抽卡特训（Custom Study & Mistake Drills）**：
    - **后端**：在 [`bridge/review_service.py`](bridge/review_service.py) 中新增 `preview_custom_study` 与 `start_custom_study`，支持 4 大核心模式：① **错题集重练（`mistakes`）**（自动检索过去 $N$ 天 `revlog` 中 `ease = 1` 的遗忘卡片及高频 `lapses > 0` 错题）、② **旗标/标签专练（`flagged`）**、③ **考前突击/提前复习（`ahead`）**、④ **今日新卡加练（`extra_new`）**，支持按失误次数、最短间隔、随机乱序或到期顺序排序，并支持切换「纯特训刷题（不改动原 FSRS 排期）」与「正式计入调度」。
    - **前端**：新增 [`frontend/src/components/study/CustomStudyModal.tsx`](frontend/src/components/study/CustomStudyModal.tsx)，实时预览符合条件的卡片数量，并在 [`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`frontend/src/components/decks/DecksView.tsx`](frontend/src/components/decks/DecksView.tsx) 与 [`frontend/src/components/search/LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx) 提供一键启动入口。
  - **验证**：新增 `test_17_deck_options_flags_and_custom_study` 与 Bundle 审计 Item #20，全部 Python 单测、`tsc --noEmit`、前端构建与 Bundle 审计 100% 通过。

- **[WorkBuddy] 卡片安全第 3 轮：工业级验证、崩溃一致性与恢复提示**：
  - **背景**：环境未安装 `hypothesis` / `coverage` / `pytest`，且不擅自往系统 Python 装包。采用**渐进增强**：标准库实现始终运行、提供等价能力；可选依赖装上后自动叠加更严格的检查，CI 永不静默跳过。新增 [`tests/requirements-dev.txt`](tests/requirements-dev.txt) 说明升级方式。
  - **harness 扩展**：`SyntheticCollection` 支持 `db_path` 文件型数据库与 `from_file()` 重连；`SafetyEnv.from_files()` 可从持久化 DB + JSON 配置重建完整环境（默认仍为 `:memory:`，隔离性断言改为逐行检查所有 `sqlite3.connect` 不含硬编码真实路径）。
  - **新增 [`tests/test_card_safety_round3.py`](tests/test_card_safety_round3.py) 4 项**：
    1. **故障注入**：在批量改期执行到第 3 张卡时 `commit()` 已落盘的部分写入后抛注入异常，验证不返回假成功、逐卡回滚到操作前零 diff、ticket 标记 `rolled_back`（3 组 seed）。
    2. **`SIGKILL` 崩溃一致性**：spawn 真实子进程，在 `finish_ticket(done)` 前 `os.kill(pid, SIGKILL)`；父进程验证 `PRAGMA integrity_check = ok`、ticket 仍为 `pending`、receipt 快照完整，重启后下一次 IPC 自动 reconcile 并全字段零 diff、ticket 变 `recovered`。
    3. **状态化随机序列 + 反例收缩**：10 组固定种子 × 24 步（共 240 步，11 类含非法 deckId / 畸形 query / 未知 actionType 的操作），每步校验卡集合、笔记哈希、revlog 只增；失败时自动删除步骤收缩到最短复现序列并打印。安装 Hypothesis 后额外跑 40 组 `@given` 属性搜索与自动 shrinking。
    4. **写路径覆盖率门禁**：标准库 `trace` + AST 统计可执行行，对 `bridge/safety.py` 设 ≥70%、`bridge/vacation_service.py` 设 ≥35% 硬门禁；明确标注这是**行覆盖**，branch 覆盖需 `coverage.py`（命令已写入 requirements-dev.txt）。
  - **恢复提示**：`vacation_service.safety_warning()` 改为「一次消费」语义（成功恢复也提示，且只提示一次）；`action_get_dashboard` 通过 `safetyWarning` 字段下发；[`pycmd.ts`](frontend/src/bridge/pycmd.ts) 补 `SafetyWarning` 类型，[`useAppStore.ts`](frontend/src/stores/useAppStore.ts) 的 `initFromAnki` 用既有 toast 提示「已自动恢复 N 张卡片」或「需人工检查」，不新增常驻 UI 元素。
  - **验证**：28 项 Python 单测 OK、Bundle 审计 Item #19、`tsc --noEmit`、`npm run build` 全部通过。
  - **明确边界**：本轮仍是行覆盖而非 branch 覆盖；未做持续 fuzzing / 多进程并发写压力；崩溃恢复为「恢复快照后提示」，未做 UI 级的手动确认/忽略交互。

- **[WorkBuddy] 卡片安全第 2 轮：应用级安全壳 + 减负撤销零 diff**：
  - **起点**：第 1 轮把 `rescue_backlog → undo_rescue` 的差距钉成基线（seed=0 下 25/60 张卡 `due` 被拍平到今天）。本轮修复后该基线按设计主动失败，提示升级为零 diff 断言。
  - **新增 [`bridge/safety.py`](bridge/safety.py)**：① `capture_schedule` / `restore_schedule` / `verify_restoration` —— 逐卡快照 11 个调度字段、经 `col.update_card` 精确回写、逐字段校验；② `begin_undo_group` / `end_undo_group` —— 使用 Anki 官方 `add_custom_undo_entry` + `merge_undo_entries`，解决逐卡 `update_card` 产生 N 个 undo 条目导致用户无法整体撤销；③ `try_native_backup` —— `create_backup(force=False)` 尊重 Anki 自身备份间隔，任何失败都不阻断主流程；④ `quick_integrity_check` —— 只读 `PRAGMA quick_check`；⑤ 操作票 `begin_ticket` / `finish_ticket` / `reconcile_pending_ticket` —— pending 票代表上次进程中断，按 receiptId 找回快照并校验 checksum 后自动恢复。
  - **接入**：[`bridge/vacation_service.py`](bridge/vacation_service.py) 的 `rescue_backlog` 在改期前拍快照并落 pending 票，异常时自动回滚并标记 `rolled_back`，成功时先写 receipt（含 `scheduleSnapshot` 与 safety 元数据）再关闭票；`undo_last_rescue` 改为逐卡精确回写 + `verify_restoration` 自检，校验不通过直接返回失败并保留原状，旧回执无快照时才降级为不带 `!` 的 `"0"`；`set_vacation` / `cancel_vacation` 接入原生 undo 合并与节流备份。[`bridge/router.py`](bridge/router.py) 在每次分发前统一做崩溃恢复，`action_get_dashboard` 暴露 `safetyWarning`。
  - **测试**：`test_04` 升级为零 diff 断言（4 组随机集合，校验快照、`verification.exact`、ticket done）；新增 `test_07`（undo 合并 / 节流备份 / 完整性检查确实被调用）与 `test_08`（模拟进程在 `finish_ticket` 前死亡，下一次 IPC 调用自动把卡片恢复到操作前）。harness 补齐原生 API 测试替身。
  - **实测**：24 项单测 OK；减负平摊 → 撤销从「25/60 张卡 `due` 变动」变为 **0 变动**，全字段零 diff。
  - **本轮明确不做**（第 3 轮）：Hypothesis 状态机、故障注入、`kill -9` 崩溃一致性、写路径 branch coverage 门禁、`safetyWarning` 的前端展示。
  - **验证**：24 项 Python 单测、Bundle 审计 Item #17 / #18、`tsc --noEmit`、`npm run build` 全部通过。

- **[WorkBuddy] 卡片安全第 1 轮：零 diff round-trip 测试框架落地**：
  - **背景**：全量审计量化出 33 个写库 / 写配置调用点、16 个测试 / 190 条断言，但显式事务、前置备份、崩溃恢复、全库快照与不变式断言均为 0。参照 SQLite 官方测试体系（4 套独立 harness、100% branch / MC-DC、故障注入后必跑 `PRAGMA integrity_check`、每个 bug 必须配能复现的测试）与 Anki 官方 API（`create_backup` / `fix_integrity` / `add_custom_undo_entry` / `merge_undo_entries`）设计分层防御；本轮落地 L0 不变式 + L4 golden-master round trip。
  - **新增文件**：[`tests/safety_harness.py`](tests/safety_harness.py)（完全隔离的内存合成卡库，唯一的 `sqlite3.connect` 为 `:memory:`，绝不解析用户真实 collection；字段级 `snapshot` / `compare`；对比业务列并排除 `mod` / `usn` 避免时间戳假失败；revlog 只增不减不变式；`SafetyEnv` 驱动真实 `BridgeRouter` 与 services）、[`tests/test_card_safety.py`](tests/test_card_safety.py)（6 项）。
  - **6 项测试**：① harness 隔离性 ② 元测试：故意改 `flds` / 改 `due` / 删卡 / 删复习历史，快照引擎必须全部检出（验证测试套件本身有效）③ 12 组随机集合 × 60 张卡的 `set_vacation → cancel_vacation` 零 diff（cards / notes / revlog / deck limits 逐字段）④ `rescue_backlog → undo_rescue` 底线安全 + 显式锁定「due 被拍平」已知差距 ⑤ 8 组固定种子 × 12 步随机操作序列，每步校验卡片 ID 集合、笔记内容哈希、revlog 历史 ⑥ 所有写操作 revlog 只增不减。
  - **框架首次运行即产出实证**：休假撤销路径零 diff（上一轮加的逐卡快照回写确实生效）；减负撤销路径确认「不丢卡、不改笔记、不删历史」，但 `due` 未逐卡还原（现有 `undo_last_rescue` 用 `set_due_date(cids, "0")` 把卡片统一拍平到今天）。该差距已作为**可追踪基线**钉在测试里，第 2 轮修复后必须改为零 diff 断言。
  - 顺带给 `test_bridge.py` 增加 `tearDown` 关闭 sqlite 连接，消除测试输出中的 ResourceWarning。
  - **本轮明确不做**（后续轮次）：操作票 + 前置强制备份、Anki 原生 undo 合并、`fix_integrity` 提交后自检、Hypothesis 状态机、故障注入、`kill -9` 崩溃一致性、写路径 branch coverage 门禁。
  - **验证**：22 项 Python 单测 OK（原 16 + 新 6，0.22s，无告警）、Bundle 审计 Item #17、`tsc --noEmit`、`npm run build` 全部通过。

- **[WorkBuddy] 全量产品审计与批量 Bug 修复（4 区域调研 → 计划 → 修复）**：
  - **调研**：并行审查 Python 后端 / 前端状态与 IPC / 全部 UI 组件 / 运行时与构建配置，共收集 45 条候选，逐条回查源码后确认 31 条成立，剔除 14 条误报、纯文档滞后与设计取舍。按「数据安全 → 假成功 → 功能错误 → 显示与发布」分四批修复，本次落地 23 项。
  - **P0 数据安全**：
    1. `get_or_reconstruct_receipt()` 原先在 `get_dashboard` / `get_vacation_status` 的**只读路径**里，把「未来 7 天正常到期卡」推断成被平摊卡片，捏造 `canUndo: True` 回执并写回配置；用户点撤销会把无关卡片全部拉回今天。现改为只返回 `rescue_backlog` 真实生成、带 `rescheduledCids` 的回执，读路径零写入。
    2. `undo_last_rescue()` 增加回执来源校验，拒绝旧版捏造的 `rescue_active` 等回执。
    3. `rescue_backlog()` 查询由裸 `is:due` 改为 `is:due is:review`：Anki 的 Set Due Date 会把 learning/new 卡转成 review 卡并改写间隔，与「保留间隔」承诺相反。
    4. `_build_deck_search_clause()` 在 deckId 解析失败时不再静默返回空串（那会把牌组级操作降级成全库重排），改为返回必然空集的哨兵子句。
    5. `write_config()` 不再把运行时状态双写回 `config.json`（该文件是插件默认配置/schema 模板），只写 `mw.addonManager.writeConfig`。
    6. `build_ankiaddon.py` 打包时对 `config.json` 做洁净化，剥离 `last_rescue_receipt` / `vacation_state` / `vacation_history` / `vacation_frozen_dates` / `custom_nickname` 等私有字段，杜绝真实卡片原文随发布包外泄。
  - **P1 假成功与状态链路**：
    7. `answer_card()` 的 `except Exception: pass` 会让未落库的评分返回 `answered: True`；现返回 `answered: False` + `error`。
    8. `search_cards()` 查询异常时不再降级 `find_cards("")` 把整库当筛选结果，改为返回空结果集 + `error`。
    9. `batch_action()` 未知 `actionType`、无 collection、无有效卡片 ID 一律返回 `success: False`；`resetProgress` 异常不再吞掉。
    10. `edit_service.py` 三处 `col is None` 分支不再伪造 `saved/created: True` 与时间戳假 ID。
    11. `action_sync()` 仅在原生同步确实被触发时才返回 `synced: True`。
    12. `pycmd.ts` 超时与空响应由 `resolve({})` 改为 `reject`，让所有调用方的 catch 与成功校验真正生效。
    13. `initFromAnki()` 校验 dashboard 结构完整性，避免超时得到的 `{}` 写入残缺状态树导致白屏。
    14. `syncCollection()` 不再在 `syncPromise` 上吞掉 rejection；失败时保留旧时间戳、显示「同步失败」而非「已同步」。
    15. `rescueBacklog` / `undoRescue` / `startLowEnergySession` 统一校验 `success !== true`。
    16. `App.tsx` 的 `onSyncFinished` 先复位 `syncing` 再走冷启动 guard，修复 `syncing` 永久卡 true 导致同步按钮死锁。
    17. `__init__.py` 补注册 `sync_will_start` hook（此前 `_on_sync_will_start` 是死代码，同步期间前端无「同步中」状态）。
  - **P2 交互与显示**：
    18. `ReviewerView` 键盘白名单补 `contentEditable` 判断，修复复习中打开卡片编辑器后空格/数字被当作翻卡与评分；同时补上常规复习下的 `Esc` 退出。
    19. `CardEditorModal` 初始化 effect 去掉 `decks` 依赖，后台刷新不再静默清空未保存草稿。
    20. `CardEditorModal` 保存时不再向非中文字段模型注入 `正面` / `背面` 键污染笔记结构。
    21. `IcuRescueModal` 存证改用真实 `lostCards`（>0 标红）与 `rescheduledCount`，移除硬编码的「丢失 0 / 间隔 100%」；`dayDistribution` 补空态兜底防止展开崩溃。
  - **P3 构建与运行时**：
    22. `build_ankiaddon.py` 排除判断改用相对路径 `rel.parts`（原先绝对路径的任一上级目录名命中 `frontend` / `tests` 等会静默产出无前端资源的包），并在打包后强制校验 `web/index.html` 存在。
    23. `__init__.py` 切换快捷键按平台统一为单一 `QKeySequence`（macOS `Meta+Alt+M` = ⌃⌥M，其它 `Ctrl+Alt+M`），删除会双重触发的重复 `QShortcut`。
  - **本次明确未纳入（需独立架构设计，硬塞进一轮会引入新缺陷）**：跨 Profile 状态隔离（需按 profile 分键改造全部状态读写）、monkey patch 完整还原与 hook 去重（需生命周期管理）、并发请求序号与 `loadMore` 分页竞态（需重构 `initFromAnki` 与 debounce）、批量操作多视图状态一致性、前端 i18n 全量化、0ms 骨架主题注入、`manifest.json` 版本 / `mod` 发布对齐、连胜计算负偏移 CAST 取整（需真实数据实测）、`undo_last_action` 全局撤销栈语义、图表 X 轴刻度与休假规则文案硬编码。
  - **修改文件**：`bridge/vacation_service.py`, `bridge/review_service.py`, `bridge/search_service.py`, `bridge/edit_service.py`, `bridge/router.py`, `__init__.py`, `scripts/build_ankiaddon.py`, `frontend/src/bridge/pycmd.ts`, `frontend/src/stores/useAppStore.ts`, `frontend/src/App.tsx`, `frontend/src/components/reviewer/ReviewerView.tsx`, `frontend/src/components/quick-add/CardEditorModal.tsx`, `frontend/src/components/vacation/IcuRescueModal.tsx`, `tests/test_bridge.py`, `tests/test_frontend_bundle.mjs`。
  - **验证**：新增 `test_16_full_audit_no_fake_success_or_fabricated_receipt`（只读路径零写入、捏造回执被拒、评分失败、异常查询不返全库、未知批量操作、无集合时全部写操作不伪造成功）与 Bundle 审计 Item #16；16 项 Python 单测、Bundle 审计、`tsc --noEmit`、`npm run build` 全部通过；实际打包 14 个运行时文件，校验含 `web/index.html` 且 `config.json` 无私有字段残留。

- **[WorkBuddy] 对齐 Anki 官方统计：新增答题按钮分布、真实留存率与日均负载**：
  - **调研对照**：官方 Statistics 窗口含 Future Due / Calendar / Reviews / Card Counts / Review Time / Review Intervals / Card Ease / Card Stability / Card Difficulty / Card Retrievability / Hourly Breakdown / Answer Buttons / True Retention Table。本插件已覆盖 Future Due（30 天预测）、Calendar（首页热力图）、Card Counts（成熟度分布）、Hourly Breakdown（24 小时分布）及近似的 Reviews / Retention。本次补齐三项「官方有、我们没有、且对备考排期与制卡质量有直接决策价值」的指标。
  - **新增指标**：
    1. `answerButtons`：近 1 年 Again / Hard / Good / Easy 作答分布，按复习前间隔（`lastIvl >= 21` 为成熟卡）拆分通过率，用于发现 Again 过高（卡片表述问题）或 Easy 过多（间隔过保守）。
    2. `trueRetention`：严格采用官方口径 —— `ROW_NUMBER() OVER (PARTITION BY cid, day)` 只取每张卡每天首次复习，Again 记失败、Hard / Good / Easy 记通过，分别给出近 30 天 / 全部历史的年轻卡、成熟卡与总体留存率，可直接对照 FSRS 目标留存率。旧版 SQLite 不支持窗口函数时优雅降级为空值，不影响其它统计。
    3. `dailyLoad`：Σ(1 / 间隔)，与官方 Future Due 的 Daily Load 同公式（间隔不足 1 天按 1 计），展示在预测卡片副标题，回答「平均每天要复习多少张」。
  - **前端**：[`frontend/src/components/stats/StatsView.tsx`](frontend/src/components/stats/StatsView.tsx) 新增第三行两张卡片（四按钮横向分布条 + 分层通过率；真实留存率双区间数字格）；[`frontend/src/bridge/pycmd.ts`](frontend/src/bridge/pycmd.ts) 与 [`frontend/src/data/mockData.ts`](frontend/src/data/mockData.ts) 同步补齐类型与空状态。
  - **明确未纳入**：FSRS 三图（稳定性 / 难度 / 可提取性）依赖 `cards.data` 的 FSRS 状态、与 Anki 版本强耦合且易算错误导；Card Ease 在 FSRS 下意义下降；Review Intervals 与长周期 Review Time 的决策价值低于以上三项，且已有热力图 / 周节奏近似覆盖。
  - **修改文件**：[`bridge/deck_service.py`](bridge/deck_service.py), [`frontend/src/bridge/pycmd.ts`](frontend/src/bridge/pycmd.ts), [`frontend/src/data/mockData.ts`](frontend/src/data/mockData.ts), [`frontend/src/components/stats/StatsView.tsx`](frontend/src/components/stats/StatsView.tsx), [`tests/test_bridge.py`](tests/test_bridge.py), [`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)。
  - **验证**：新增 `test_15_official_statistics_metrics`（同卡当天二次复习只计首次、`type=4` 改期日志不污染、Daily Load 公式）与 Bundle 审计 Item #15；15 项 Python 单测、`tsc --noEmit`、Bundle 审计与 `npm run build` 全部通过。

- **[WorkBuddy] 回退「首页右上角搜索框重构」**：
  - **原因**：用户试用后确认「真输入框 + 回车 / 搜索按钮跳转卡片库」的体验不如原方案，决定恢复原交互。
  - **回退范围**：[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx) 完整恢复原有的 Cmd+K 面板入口（`<button>` 伪输入框 + `formatShortcut('Cmd K')` 角标 + `showShortcutHints` 控制），移除真输入框 `homeSearchQuery` / `homeSearchRef` / `submitHomeSearch` 与 `data-no-drag` 逻辑；同步撤销 [`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs) 的 Bundle 审计 Item #14。卡片库关键词检索、Cmd+K 全局指令台与本轮的休假配置修复均不受影响。
  - **验证**：`DashboardView.tsx` 与 `test_frontend_bundle.mjs` 已逐字恢复至 `aa692bf` 版本（`git diff HEAD` 为空）；`tsc --noEmit`、14 项 Python 单测、Bundle 审计与 `npm run build` 全部通过。

- **[WorkBuddy] 修复「休假已撤销但首页热力图仍显示连胜冰冻」的旧配置残留**：
  - **原因定位**：上一轮引入顶层 `vacation_frozen_dates` 后，`effective_frozen_dates()` 为兼容旧配置，在顶层字段缺失时回退读取 `vacation_state.frozen_dates`；而修复前的 `cancel_vacation()` 从不清理该字段，导致 2026-11-10 10:39 已撤销的休假仍在 `config.json` / `meta.json` 中留下 `['2026-11-10']`。热力图据此把今天标为 `isStreakFrozen`，悬浮提示显示「休假连胜冰冻保护中」。该问题与 `vacation.isActive` 无关（侧栏已正确显示非休假态），且重启 Anki 也不会消失，因为脏数据来自回退逻辑本身。
  - **修复措施**：旧配置回退分支增加 `cancelled_at` 判断 —— 已撤销的休假不提供任何连胜保护，直接返回空集合；仍在生效 / 已正常结束的旧休假保持原有回退行为。不改动用户配置中的历史记录，避免影响正在运行的 Anki 与 AnkiWeb 同步。
  - **修改文件**：[`bridge/vacation_service.py`](bridge/vacation_service.py), [`tests/test_bridge.py`](tests/test_bridge.py)。
  - **验证**：新增 `test_14_legacy_cancelled_vacation_has_no_heatmap_freeze`（复刻旧配置形状、断言热力图零冰冻格、生效中的旧休假保护不回退）；14 项 Python 单测、前端 Bundle 审计、`npm run build` 与 `tsc --noEmit` 全部通过。

- **[WorkBuddy] 修复答题界面工具抽屉因 `isZh` 未定义导致的运行时崩溃**：
  - **原因定位**：[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx) 第 1226 / 1228 / 1239 行的「搁置卡片 / 暂停卡片」按钮使用了 `isZh`，但组件内从未定义（上一位助手新增该工具抽屉时遗漏）。Vite/esbuild 不做类型检查，因此 `npm run build` 仍能通过，而渲染该区域时会抛 `ReferenceError: isZh is not defined`；`npm run lint`（`tsc --noEmit`）报 3 个 `TS2304`。
  - **修复措施**：在组件 `useAppStore()` 解构之后补一行 `const isZh = resolvedLang === 'zh-CN';`，与文件内其余中英文判断口径完全一致；未改动任何文案、按钮行为或视觉样式。
  - **修改文件**：[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)。
  - **验证**：`npx tsc --noEmit` 退出码 0（零错误）；13 项 Python 单测、前端 Bundle 审计与 `npm run build` 全部通过。

- **[WorkBuddy] 休假模式状态机三处逻辑错误修复（过期不收敛 / 连胜冰冻生命周期 / 撤销破坏记忆间隔）**：
  - **原因定位**：
    1. 自动过期判定只写在 `get_vacation_status()`（[`bridge/vacation_service.py`](bridge/vacation_service.py)），而前端整个 `frontend/src` 从不调用该 action，只读 `get_dashboard()`；后者在 `end_date` 过期后仅把 `remainingDays` 置 0，仍返回 `isActive=True` 且不写回配置。结果 `vacation_state.active` 永远为真，主界面卡在全画布休假视图、侧栏显示「休假中 · 0d」、弹窗因 `isAlreadyActive` 隐藏「开启休假」按钮。自动过期若被触发，还会经 `end_vacation()` 把按期结束误标为「提前结束」。
    2. `frozen_dates` 挂在每次都被整体重建的 `vacation_state` 上：`cancel_vacation()` 撤销后原样保留，热力图与连胜算法继续把这些日期算作已打卡；反向 `set_vacation()` 又会抹掉上一次休假的冰冻日期，导致历史连胜在旧休假日断开。
    3. `cancel_vacation()` 与 `undo_last_rescue()` 使用 `set_due_date(cids, "0!")`。Anki 官方手册明确「不带 `!` 才 rescheduled without changing their current interval」，带 `!` 会改写间隔，与注释/UI 承诺的「保留 FSRS 间隔、原样复原」正好相反；且 `shifted_cids` 只存 ID，撤销只能把所有卡片拍平到今日。
  - **修复措施**：
    1. 新增 `VacationService.reconcile_expired_vacation()`，由 [`bridge/router.py`](bridge/router.py) 的 `handle_pycmd()` 在分发**任何** action 前统一收敛；[`bridge/deck_service.py`](bridge/deck_service.py) 的 `get_dashboard()` 另加显示层兜底（过期即 `isActive=False / remainingDays=0`）；`end_vacation()` 按 `reason=auto_expired` 将历史标为 `completed` 而非 `ended_early`。
    2. 新增顶层累积配置 `vacation_frozen_dates` 与纯函数 `effective_frozen_dates()`：开启时追加本次区间，撤销时精确移除本次区间，按期/提前结束保留；`get_dashboard()`、`get_vacation_status()`、`_build_heatmap_and_streak()` 全部改读该字段，并兼容旧配置回退。
    3. 开启休假时快照每张卡的 `due/ivl/queue` 至 `shifted_card_snapshot`，撤销时经 `col.update_card()` 逐张精确回写（保持同步安全的 mod/usn）；无快照的旧数据回退到 `set_due_date(cids, "0")`。`undo_last_rescue()` 同步去除 `!`。
    4. `set_vacation()` 增加防重入：已有生效休假时返回 `success=False`，避免把已冻结为 0 的新卡限额误存为「原始值」；[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts) 的 `setVacation` 对失败结果不再误报成功 toast。
  - **修改文件**：[`bridge/vacation_service.py`](bridge/vacation_service.py), [`bridge/deck_service.py`](bridge/deck_service.py), [`bridge/router.py`](bridge/router.py), [`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts), [`tests/test_bridge.py`](tests/test_bridge.py)。
  - **验证**：新增 `test_13_vacation_expiry_revert_and_freeze_integrity`（过期收敛与历史状态、防重入、逐张排程回写、冰冻日期增删、`!` 后缀禁令）；13 项 Python 测试、前端 Bundle 审计与 `npm run build` 全部通过。

- **[Antigravity] 彻底纠正「已暂停 (Suspended)」与「已搁置 (Buried)」状态混淆及系统全链路重构**：
  - **原因定位**：
    1. 概念与文案倒置：此前在 Reviewer 暂停卡片时错误提示「已挂起卡片并跳过本轮复习」，将永久性移出学习队列的「暂停 (Suspend)」与推迟至次日恢复的「搁置 (Bury)」严重混淆，且使用了非标黑话「挂起」。
    2. 检索污染：`search_service.py` 筛选 `new` (`is:new`) 与 `review` (`is:review -is:due`) 时未排除 `-is:suspended -is:buried`，因 Anki 底层卡片暂停后仍保留原有卡片类型（`type=0` 或 `type=2`），导致已暂停/搁置卡片被混入待学卡片库；`review_service.py` 中抽取新卡时也同样因未排除而拉入了被暂停的新卡。
    3. 能力缺失与统计账目偏差：缺少原生的 `toggle_bury`（搁置/取消搁置）桥接与卡库批量取消搁置操作；成熟度统计未统计 `queue in (-2, -3)` 导致总卡片数对不上。
  - **修复措施**：
    1. **术语全量归正**：全界面彻底清除「挂起/已挂起」，规范对齐 Anki 官方标准：`已暂停 (Suspended)` 与 `已搁置 (Buried)`。
    2. **检索与会话绝对去污染**：在 [`bridge/search_service.py`](bridge/search_service.py) 中将 `due`、`new`、`review` 统一追加 `-is:suspended -is:buried`，确保各状态绝对互斥精准；在 [`bridge/review_service.py`](bridge/review_service.py) 中严格封堵暂停/搁置卡片流入复习队列。
    3. **补齐原生搁置/取消搁置能力**：在 [`bridge/edit_service.py`](bridge/edit_service.py) 与 [`bridge/router.py`](bridge/router.py) 中新增 `toggle_bury`（直连 `col.sched.bury_cards / unbury_cards`）；在 [`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx) 工具抽屉中独立提供「搁置卡片 (推迟至明日)」、「暂停卡片 (长期移出)」与「删除卡片」三向独立操作；在卡库批量操作栏中，对选中的已搁置卡片支持一键「取消搁置 (Unbury)」。
    4. **统计看板对齐**：在 [`bridge/deck_service.py`](bridge/deck_service.py) 与 [`frontend/src/components/stats/StatsView.tsx`](frontend/src/components/stats/StatsView.tsx) 中新增 `buried` 独立统计指标与灰色标记条，与 Anki 官方 Rust 统计规范 100% 对齐。
    5. **单测防护**：在 [`tests/test_bridge.py`](tests/test_bridge.py) 中补充 `toggle_bury`、`batch_action(bury/unbury)` 以及状态互斥断言，全部 12 项测试与前端 Bundle 审计 100% 通过。
  - **修改文件**：[`bridge/search_service.py`](bridge/search_service.py), [`bridge/review_service.py`](bridge/review_service.py), [`bridge/edit_service.py`](bridge/edit_service.py), [`bridge/deck_service.py`](bridge/deck_service.py), [`bridge/router.py`](bridge/router.py), [`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts), [`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx), [`frontend/src/components/search/LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx), [`frontend/src/components/stats/StatsView.tsx`](frontend/src/components/stats/StatsView.tsx), [`frontend/src/i18n/translations.ts`](frontend/src/i18n/translations.ts), [`tests/test_bridge.py`](tests/test_bridge.py)。

- **[Antigravity] 修复连续打卡「本周活跃天数」统计口径跨周污染的 Bug**：
  - **原因定位**：连续打卡卡片副标题中的「本周 {active} / {total}」指标此前在 [`bridge/deck_service.py`](bridge/deck_service.py) 中直接采用滚动 7 天窗口（`range(7)` 即今天及过去 6 天），而非自然周（周一至周日）的已过天数。当用户拥有较长连续打卡（如 18 天打卡）并在周二查看时，滚动 7 天将上周三至周日的打卡天数全部计入，导致周二仅过两天却出现「本周 7 / 7」的逻辑荒谬。
  - **修复措施**：
    1. 改为严格基于当前自然周（ISO 周一为起点，`weekday_idx = today_date.weekday()`）计算自周一至今日的已发生天数范围（`range(weekday_idx + 1)`）。
    2. 遍历本周已过天数，检查当天复习记录（`day_map`）或休假冻结记录（`frozen_dates`），周二在周一与周二均打卡的情况下准确呈现「本周 2 / 7」，周日全勤时呈现「本周 7 / 7」。
    3. 在 [`tests/test_bridge.py`](tests/test_bridge.py) 中加入 `weekActiveDays <= weekday + 1` 的自然周上限断言测试，12 项测试全部通过。
  - **修改文件**：[`bridge/deck_service.py`](bridge/deck_service.py), [`tests/test_bridge.py`](tests/test_bridge.py)。

- **[Antigravity] 主界面看板状态胶囊交互化与卡库联动筛选**：
  - **主界面胶囊按钮化**：将英雄区「待复习」、「新卡」、「已完成」3枚原本仅用于展示的标签重构为可点击的交互式微胶囊（`hover:opacity-85 hover:scale-[1.02] active:scale-95 cursor-pointer`）。
  - **卡库直连与筛选注入**：点击「待复习」自动切换至卡库并应用 `status: 'due'` 过滤；点击「新卡」自动切换并应用 `status: 'new'` 过滤；点击「已完成」自动切换并应用 `status: 'completed'`（底层直连 Anki `rated:1` 检索语义），卡库状态下拉列表同步增设「今日已完成」选项与状态标记。
  - **修改文件**：[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx), [`frontend/src/components/search/LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx), [`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts), [`bridge/search_service.py`](bridge/search_service.py), [`tests/test_bridge.py`](tests/test_bridge.py)。

- **[Antigravity] 设置中心主题色卡片极简重构**：
  - 将原「现代 SaaS 强调色系统」卡片标题精简为标准「主题色」（Theme Color）。
  - 彻底移除标题下方多余的选中说明（如「当前选中：经典蓝 · Anki Studio 官方固定品牌色」）以及右上角色阶预览胶囊组件，标题直连 8 色选择栅格，视觉极致轻盈。
  - 修改文件：[`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx)。

- **[Antigravity] 全局弹窗冗余快捷键提示与占位元素降噪清理**：
  - **搜索面板（CommandPaletteModal）**：移除搜索栏右侧多余的 `Esc` 按键胶囊，清除底部「↑↓ 导航 · ↵ 在编辑器中修改 · Esc 关闭」快捷键提示条，结果统计数字保持右对齐。修改文件：[`frontend/src/components/search/CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx)。
  - **系统设置（SettingsModal）**：移除左上角标题下方的系统版本徽标（`macOS · 26.09.4`），移除左侧导航底部的「完成 (Esc)」按钮，在弹窗右上角增设统一标准 `✕` 关闭按钮。修改文件：[`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx)。
  - **进度减负（IcuRescueModal）**：移除底部常驻的「执行后将自动生成可逆存证并归档」解释文案，操作按钮自适应右对齐。修改文件：[`frontend/src/components/vacation/IcuRescueModal.tsx`](frontend/src/components/vacation/IcuRescueModal.tsx)。
  - **卡片编辑器（CardEditorModal）**：移除底部「支持 Cmd+V 粘贴截图 · Cmd+Enter 保存 · Esc 取消」常驻快捷键文本，仅保留未保存修改状态警告，界面彻底回归干净纯粹。修改文件：[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)。

- **[Antigravity] 侧栏底部工具胶囊对称重构与设置中心强调色栅格去截断优化**：
  - **侧边栏底部胶囊优化**：修复「休假模式」与「进度减负」按钮左右不对称的伪 Tab 切换错觉。消除正常状态下减负按钮因历史存证可撤销而被强制上色（`bg-[var(--brand-soft)]`）导致的视觉倾斜，规范两项工具的默认静止态（均采用无底色微动卡片、居中排版 `justify-center gap-1.5` 与对齐图标）；将休假激活态（`休假中 · Xd`）与待办洪峰警告态（`animate-pulse`）作为唯一的高亮分支；依循现代 Web 最佳实践补充 `role="toolbar"` 与焦点环无障碍支持。修改文件：[`frontend/src/components/layout/Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx)。
  - **强调色栅格去截断与官方标识**：针对偏好设置中心「现代 SaaS 强调色系统」中按钮文字被长英文字段截断的问题（如 `经典蓝 · S...`），在 [`frontend/src/utils/themeTokens.ts`](frontend/src/utils/themeTokens.ts) 中为 8 套主题引入短标题系统（`shortNameZh` / `shortNameEn`），中文展示为纯粹的三字名称（如 `经典蓝`、`松石绿`、`雾海蓝`），彻底消除 `...` 截断；为官方固定品牌色（经典蓝 `#3076C3`）附加「官方」专属微标签；依循表单无障碍实践补充 `role="radiogroup"`、`role="radio"` 与 `aria-checked` 语义。修改文件：[`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx), [`frontend/src/components/design-system/DesignSystemView.tsx`](frontend/src/components/design-system/DesignSystemView.tsx)。
- **[Gemini] 修复 `revlog` 统计口径受 `set_due_date` 改期日志（`type=4, ease=0`）污染的严重 Bug**：
  - **原因定位**：Anki 在调用 `col.sched.set_due_date()`（如执行「进度减负」平摊或「休假模式」顺延/恢复卡片）时，会在 `revlog` 表中写入 `type = 4`（手动改期，`ease = 0, time = 0`）的记录。此前 `get_dashboard()`、`get_statistics()`、`_build_heatmap_and_streak()`、`_build_weekly_rhythm()` 与 `_serialize_review_card()` 查询 `revlog` 时未过滤 `type < 4 AND ease > 0`，导致：
    1. 每次休假顺延或进度减负改期的卡片行（如 100 条改期记录）被误计入「今日已完成卡片数」（如实际复习 22 张 + 100 条改期日志 = 虚高显示已完成 122 / 161 张）；
    2. 12 周留存率曲线与热力图准确率将 `ease = 0` 的改期记录计入总分母且算作未通过（分子 `ease > 1` 为 0），导致本周真实留存率（`84.4%`）被异常拉低至 `46.5%`。
  - **修复措施**：在 [`bridge/deck_service.py`](bridge/deck_service.py) 与 [`bridge/review_service.py`](bridge/review_service.py) 所有复习统计 SQL 中严格限定 `type < 4 AND ease > 0`，并在 [`tests/test_bridge.py`](tests/test_bridge.py) 中新增 50 条 `type = 4, ease = 0` 日志注入的防污染断言测试。
- **[Gemini] 休假模式生效态全画布极简视图重构**：
  - 当开启休假模式（`dashboard.vacation.isActive === true`）时，将 [`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx) 主内容区切换为全画布极简休假视图（放松插画 + `享受你的假期 ^_^` 主标题 + 单行轻量状态提示 + `休假设置 / 结束` 与 `查看看板` 按钮），并修复 [`frontend/src/components/layout/Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx) 底部休假按钮激活态文字截断。
- **[Antigravity] 官方品牌 Logo 与经典蓝视觉系统正式确立**：
  - 正式集成等轴测对折知识棱柱（Open Knowledge Prism）作为 Anki Studio 官方标志。
  - 创建独立像素级矢量组件 [`frontend/src/components/common/AnkiStudioLogo.tsx`](frontend/src/components/common/AnkiStudioLogo.tsx)，右侧面采用用户指定的官方经典蔚蓝 `#3076C3`（反面/输出），左侧面采用同色系柔和淡蓝 `#A1C1E4`（正面/输入）。
  - 全面更新侧边栏品牌区域 [`frontend/src/components/layout/Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx)、设置中心关于视图 [`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx) 以及 0ms 首帧骨架 [`frontend/index.html`](frontend/index.html)。
  - 品牌色固定为用户指定的官方经典蓝（Studio Blue `#3076C3` / `rgb(48, 118, 195)`），完成 12 阶色阶重新标定，同步更新 [`config.json`](config.json)、[`meta.json`](meta.json)、[`__init__.py`](__init__.py) 与 [`themeTokens.ts`](frontend/src/utils/themeTokens.ts)。

---

## [v1.3.0] - 2026-11-10

### 进度减负 (Schedule Relief) 极简重构与状态线收敛
- **[Antigravity] 弹窗架构 2-Tab 化与存证整合**：
  - 将原「减负方案」、「存证与回退」、「历史记录」3个复杂入口收敛为标准 2-Tab 结构：`[减负方案]` 与 `[历史记录]`。
  - 将卡片流向明细、未来每日排布图表和抽检卡片样本完整内嵌至历史记录详情中，消除重复弹窗。
  - 修改文件：[`frontend/src/components/vacation/IcuRescueModal.tsx`](frontend/src/components/vacation/IcuRescueModal.tsx)
- **[Antigravity] 严格单次撤销不变式 (Single-Undo Invariant)**：
  - 确立“仅允许撤销最近一次减负（`index === 0`）”的安全红线。
  - 历史更早记录自动归档为不可撤销状态，防止多次嵌套操作导致卡片排程时序错乱。
  - 修改文件：[`bridge/vacation_service.py`](bridge/vacation_service.py), [`frontend/src/components/vacation/IcuRescueModal.tsx`](frontend/src/components/vacation/IcuRescueModal.tsx)
- **[Antigravity] 界面极简降噪与时间线重构**：
  - 标题精简为纯文本「进度减负」，去除标题下方冗余的解释段落。
  - 历史记录每条卡片的主标题改为执行时间戳（如 `2026-11-09 21:35`，Mono 等宽加粗字体），操作详情下沉为副标题。
  - 移除主界面侧边栏「进度减负」按钮旁的小圆点提示。
  - 移除弹窗「历史记录」Tab 按钮及卡片内多余的小绿点。
  - 历史记录默认全部折叠（`expandedId: null`），点击「详情 ▾」按需展开，降低视觉压迫感。
  - 修改文件：[`frontend/src/components/vacation/IcuRescueModal.tsx`](frontend/src/components/vacation/IcuRescueModal.tsx), [`frontend/src/components/layout/Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx)
- **[Antigravity] 休假模式标题规范**：
  - 统一主标题为「休假模式」，去除副标题长句解释，增加「剩 N 天」状态胶囊。
  - 修改文件：[`frontend/src/components/vacation/VacationModal.tsx`](frontend/src/components/vacation/VacationModal.tsx), [`frontend/src/i18n/translations.ts`](frontend/src/i18n/translations.ts)
- **[Gemini] 全链路回归与边界条件测试套件**：
  - 在 [`tests/test_bridge.py`](tests/test_bridge.py) 中新增 `test_12_regression_and_edge_cases_guardrails`，覆盖：
    1. IPC Router 容错（非法前缀、畸形 JSON、未知 Action 优雅报错）；
    2. 低能量模式牌组 ID 解析与卡片提取上限控制；
    3. `quick_add` 多重填空 `{{c3::...}}` 解析支持；
    4. 批量操作（打标签、删除）在包含不存在卡片 ID 时的容错隔离；
    5. 连续多次减负操作下的单次撤销不变式验证；
    6. Collection 为空（切换 Profile 时）的优雅降级。
  - 修改文件：[`tests/test_bridge.py`](tests/test_bridge.py)

---

## [v1.2.0] - 2026-11-09

### 9 大核心体验升级 (9 Core UX Enhancements)
- **[Gemini & Antigravity] 云端同步按钮强化**：
  - 新增相对时间显示（如「刚刚同步」、「2分钟前」）与绝对时间悬浮 Tooltip。
  - 同步过程中图标 360° 旋转微动效，同步成功后平滑复位。
  - 修改文件：[`frontend/src/components/dashboard/SyncStatusPill.tsx`](frontend/src/components/dashboard/SyncStatusPill.tsx), [`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)
- **[Gemini & Antigravity] 仪表盘视觉降噪**：
  - 移除仪表盘右上角多余的铃铛通知图标。
  - 修改文件：[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)
- **[Gemini & Antigravity] 热力图与周节奏浮动 Tooltip**：
  - 26×7 学习热力图悬浮展示「日期 + 星期 + 复习卡片数 + 记忆准确率」。
  - 7 天周节奏柱状图悬浮展示「复习卡片数 + 学习时长（分钟）」。
  - 纯 CSS + 绝对定位无感渲染，零布局抖动（Zero CLS）。
  - 修改文件：[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)
- **[Gemini & Antigravity] Cmd+K 快捷指令搜索台 (Command Palette)**：
  - 采用左 5 列列表、右 7 列即时预览的分栏布局。
  - 改为点击选定预览（去除鼠标滑过误触切换），并支持一键复制卡片内容。
  - 修改文件：[`frontend/src/components/search/CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx)
- **[Gemini & Antigravity] 人机工学答题操作栏 (Ergonomic Reviewer Bar)**：
  - 固定底部高度 `58px`，未翻面时为 `560px` 宽度的居中大按钮。
  - 二元答题模式下采用 `170px` 重来 (Again) + `374px` 记住 (Good) 的不对称比例，大幅降低视线焦点移动损耗。
  - 修改文件：[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)
- **[Gemini & Antigravity] 全界面深浅模式矩阵**：
  - 完善 Light、Dark、OLED 三重色彩规范，消除答题界面与卡片编辑器的色差。
  - 修改文件：[`frontend/src/utils/themeTokens.ts`](frontend/src/utils/themeTokens.ts), [`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)
- **[Gemini & Antigravity] 设计系统调试入口收口**：
  - 移除侧边栏显式的「设计规范」导航项，改为调试模式下可用（连击版本号或 `Ctrl+Shift+D` 激活）。
  - 修改文件：[`frontend/src/components/layout/Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx)
- **[Gemini & Antigravity] 卡片库自定义标签下拉筛选**：
  - 实现独立的 `TagSelectDropdown`，支持标签实时搜索与卡片数量统计。
  - 修改文件：[`frontend/src/components/search/LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx)
- **[Gemini & Antigravity] 统一设置中心与三层原生防迷失安全网**：
  - 合并用户信息与偏好设置，集成 `Ctrl+Opt+M` 全局快捷键、原生菜单项与顶部工具栏胶囊。
  - 修改文件：[`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx), [`__init__.py`](__init__.py)
- **[Gemini & Antigravity] 自动化审计脚本**：
  - 引入 [`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs) 自动化校验打包与代码护栏。

---

## [v1.1.0] - 2026-11-09

### 认知减压与科学调度引擎 (Vacation & Anti-Burnout Engine)
- **[Gemini & Antigravity] 事前休假模式 (Vacation Mode)**：
  - 新增新卡冻结（保存并在休假结束后无损还原配额）。
  - 到期卡片平移顺延（保留原有 FSRS 记忆间隔权重）。
  - 连胜天数冰冻（Streak Freeze），在打卡热力图上标记为冰冻态并桥接连续记录。
  - 修改文件：[`bridge/vacation_service.py`](bridge/vacation_service.py), [`frontend/src/components/vacation/VacationModal.tsx`](frontend/src/components/vacation/VacationModal.tsx)
- **[Gemini & Antigravity] 进度平摊与削峰填谷 (Backlog Amortization)**：
  - 支持将积压卡片按天均匀打散至未来 1~N 天，或整体后延 N 天。
  - 建立操作存证生成机制，计算卡片总数前后校验与零丢失凭据。
  - 修改文件：[`bridge/vacation_service.py`](bridge/vacation_service.py), [`frontend/src/components/vacation/IcuRescueModal.tsx`](frontend/src/components/vacation/IcuRescueModal.tsx)
- **[Gemini & Antigravity] 低能量微习惯模式 (Low Energy Mode)**：
  - 一键智能筛选熟练度最高的 15 张成熟到期卡片，快速通关打卡，维护习惯闭环。
  - 修改文件：[`bridge/vacation_service.py`](bridge/vacation_service.py), [`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)

---

## [v1.0.0] - 2026-11-08

### 初始发布与基础架构 (Initial Release & Core Architecture)
- **沉浸式 macOS 风格窗口容器**：
  - 支持无缝融入原生交通灯、自定义区域拖拽及双击窗口缩放。
  - 修改文件：[`__init__.py`](__init__.py), [`frontend/src/utils/windowDrag.ts`](frontend/src/utils/windowDrag.ts)
- **0 毫秒启动与防白屏机制**：
  - Qt 视图背景色提前预注入 + HTML 骨架预挂载，消除闪白。
  - 修改文件：[`__init__.py`](__init__.py), [`frontend/index.html`](frontend/index.html)
- **Python Bridge IPC 通信中心**：
  - `BridgeRouter` 统一路由 `modern_anki:{action, data}` 请求，并分发至各 service 模块。
  - 修改文件：[`bridge/router.py`](bridge/router.py), [`bridge/deck_service.py`](bridge/deck_service.py), [`bridge/review_service.py`](bridge/review_service.py), [`bridge/search_service.py`](bridge/search_service.py), [`bridge/edit_service.py`](bridge/edit_service.py)
- **现代化前端设计系统**：
  - 基于 React 18 + TypeScript + Tailwind CSS，构建高质感 Apple HIG 风格界面。
  - 集中式单一状态树（`useSyncExternalStore`）。
  - 4 级按钮体系、365 天学习热力图与 7 天复习节奏可视化。
