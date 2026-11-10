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
