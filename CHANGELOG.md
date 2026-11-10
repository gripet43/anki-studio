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
