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
