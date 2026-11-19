# Anki Studio 交互手册（Interaction Guidelines）

> 本文档定义 **Anki Studio** 的业务级交互规范，包括全站快捷键地图与冲突优先级、弹窗与浮层流转、异步状态反馈分工、破坏性操作保护及多账号/跨日生命周期约定。
>
> 配套文档：视觉与组件规范见 [`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)，系统架构与开发流程见 [`docs/DEVELOPMENT.md`](DEVELOPMENT.md)。

---

## 1. 交互核心原则

1. **键盘一等公民**：高频复习、检索、制卡、切换设置均支持全键盘闭环；任何需要输入文字的场景都必须可靠屏蔽全局单键快捷键（`isTypingTarget`）。
2. **分层渐进退出（Layered Escape）**：按 `Esc` 每次只关闭最顶层的一层浮层或编辑态，禁止一次性穿透关闭多层弹窗或意外退出复习。
3. **非阻塞与可撤销**：不滥用阻塞弹窗；耗时系统文件框不设超时；涉及批量调度的大改操作必须提供预览与撤销回执。
4. **状态确定性**：切换 Anki Profile 或跨日时，前端状态必须原子切换并丢弃过期异步请求，杜绝跨账号或跨日数据残留。

---

## 2. 全站快捷键总表与冲突优先级

### 2.1 优先级顺序（高 → 低）

1. **浏览器原生 Top Layer `<dialog>`**（如 `AvatarCropModal`）与**全屏媒体灯箱**（`ReviewerImageLightbox`）
2. **模态弹窗与命令面板**（`CardEditorModal`、`SettingsModal`、`CommandPaletteModal`、`CustomStudyModal`、`VacationModal`）
3. **系统级逃生舱与全局导航组合键**（`Ctrl+Opt/Alt+M`、`Cmd/Ctrl+K`、`Cmd/Ctrl+,`、`Ctrl+P`）
4. **当前工作区上下文快捷键**（如复习舞台、卡片库批量弹窗）
5. **文本输入保护层**：当焦点位于 `INPUT`、`TEXTAREA`、`SELECT` 或任意 `contentEditable` 节点时，单键快捷键一律让位于输入法与编辑动作（通过 [`domTarget.ts`](../frontend/src/utils/domTarget.ts) 的 `isTypingTarget` 判定）

### 2.2 全局快捷键（[`App.tsx`](../frontend/src/App.tsx)）

| 快捷键（macOS / Win & Linux） | 动作 | 生效前提 |
|---|---|---|
| `Ctrl+Opt+M` / `Ctrl+Alt+M` | 切回原生 Anki 界面（逃生舱） | 始终生效 |
| `Cmd+K` / `Ctrl+K` | 打开 / 关闭命令搜索面板 | 始终生效 |
| `Cmd+\` / `Ctrl+\` | 收起 / 展开左侧主导航栏（全局布局偏好持久化） | 非输入态、非复习态、无弹窗打开 |
| `Cmd+,` 或 `Cmd+P` / `Ctrl+,` 或 `Ctrl+P` | 打开 / 关闭设置弹窗 | 始终生效 |
| `Ctrl+Shift+D` | 解锁并打开开发者设计系统视图 | 始终生效 |
| `N` | 打开快速制卡抽屉 | 非输入态、非复习态、无弹窗打开 |
| `Y` | 触发 Anki 原生云同步 | 非输入态、非复习态、无弹窗打开 |

### 2.3 复习舞台快捷键（[`ReviewerView.tsx`](../frontend/src/components/reviewer/ReviewerView.tsx)）

> 兼容沙盒模式（[`SandboxCardFrame.tsx`](../frontend/src/components/reviewer/SandboxCardFrame.tsx)）会自动将 iframe 内按下的复习快捷键转发回主窗口。

| 场景 | 快捷键 | 动作 |
|---|---|---|
| **正面 / 背面通用** | `Space` | 正面显示答案；背面提交「良好 (Good)」 |
| | `Enter` | 正面显示答案；背面提交「良好 (Good)」 |
| | `Tab` | 正面显示答案；背面逐条展开折叠提示（Hint） |
| | `R` | 重播当前音频 |
| | `E` | 打开当前卡片完整编辑器 |
| | `Cmd/Ctrl+I` | 切换右侧卡片信息检查器 |
| | `Cmd/Ctrl+Z` 或 `Backspace` | 撤销上一次复习评分 |
| | `Cmd/Ctrl+1` ~ `7` / `Cmd/Ctrl+0` | 切换 1–7 号旗标 / 清除旗标 |
| | `Cmd/Ctrl + =` / `-` | 放大 / 缩小卡片正文缩放比例 |
| | `Cmd/Ctrl+Shift+0` | 重置卡片缩放（100%）与舞台宽度（自动） |
| | `Esc` | 逐层关闭：媒体灯箱 → 顶部 Popover → 取消抽屉内联确认态 → 退出复习返回首页 |
| **背面评分（四键模式 / 按住 `Alt` 临时展开）** | `1` / `2` / `3` / `4` | 重来（Again）/ 困难（Hard）/ 良好（Good）/ 简单（Easy） |
| **背面评分（二键极简模式）** | `1` / `2` 或 `3` / `4` | 重来（Again）/ 良好（Good）/ 简单（Easy）；按住 `Alt/Option` 键临时显示四键 |
| **行内编辑态** | `Cmd/Ctrl+Enter` | 保存行内修改并退出编辑 |
| | `Cmd/Ctrl+Shift+C` | 插入挖空模板 `{{c1::...}}` |
| | `Esc` | 若 `/` 斜杠菜单打开则先关菜单，否则放弃草稿并退出行内编辑 |

### 2.4 专用控件与子弹窗快捷键

| 组件 | 快捷键 / 手势 | 动作 |
|---|---|---|
| **图片灯箱**（`ReviewerImageLightbox`） | 滚轮 / 左键拖拽 / `Esc` | 以光标为锚点无极缩放（75%–500%）/ 平移 / 关闭 |
| **头像裁切**（`AvatarCropModal`） | 拖拽 / 滚轮 / `方向键`（`Shift` 微调 3px） | 平移与缩放（1×–3×） |
| | `+` / `-`、`R` / `Shift+R`、`0`、`Esc` | 步进缩放 / 顺逆时针旋转 90° / 重置位置与角度 / 关闭 |
| **命令面板**（`CommandPaletteModal`） | `ArrowUp` / `ArrowDown`、`Enter`、`Esc` | 上下选择命令、执行、关闭 |
| **侧栏底栏 & 设置标签栏** | `ArrowLeft/Right` 或 `ArrowUp/Down`、`Home` / `End` | Roving tabindex 焦点移动（RTL 下左右方向自动反转） |

---

## 3. 浮层、弹窗与焦点流转规范

### 3.1 悬浮提示触发时机

| 原语 | 开启延迟 | 关闭延迟 | 特殊机制 |
|---|---|---|---|
| `<Tooltip variant="compact">` | 首次 `350ms`；300ms 暖窗内 `80ms` | `80ms` | 同一时刻只保留一个 compact tooltip，快速扫过工具栏不卡顿 |
| `<Tooltip variant="chart">` | `0ms`（即时响应） | `60ms` | 跟随图表柱条/热力格切换零迟滞 |
| `<HoverCard>` | `180ms` | `150ms` | 允许鼠标移入浮卡内部阅读或点击操作；外部点击通过 `getClosestFromTarget` 判定关闭 |

- **Top Layer 兼容**：位于 `<dialog open>` 内部的 `<Tooltip>` 会自动探测并 Portal 至当前 `<dialog>`，避免被浏览器顶层遮挡。

### 3.2 弹窗嵌套与关闭守则

1. **禁止穿透关闭**：父弹窗（如 `SettingsModal`）监听全局 `Escape` 时，若内部存在打开的子弹窗（如 `AvatarCropModal`），父弹窗必须主动 `return` 让权。
2. **保存中防中断**：在保存/裁切/提交进行中（`saving === true`），弹窗必须禁用取消/关闭按钮并拦截 `<dialog>` 的 `cancel` 事件及外部点击关闭，防止产生半提交状态。
3. **原生系统文件弹窗无超时**：调用 `pick_avatar_image`、`trigger_native_import`、`trigger_native_export` 时，前端 IPC 必须免除 8 秒超时限制（`NO_TIMEOUT_ACTIONS`），允许用户在 Finder / 资源管理器中长时间挑选文件；用户主动取消返回 `{ picked: false, canceled: true }`，**静默关闭且不弹出错误提示**。

---

## 4. 异步状态、错误反馈与确认门槛

### 4.1 反馈渠道分工

| 渠道 | 适用场景 | 禁止滥用 |
|---|---|---|
| **顶部 Toast**（`showToast` / `anki:toast`） | 操作成功的简短确认（已保存、已切换主题、已撤销）、单次轻量失败提示（图片格式不支持、超限） | 不用于需要用户阅读长文本或反复核对的错误 |
| **内联提示（Inline）** | 表单校验、文件格式/大小说明、设置项持久状态（如同步状态、补丁健康信息）、空列表引导 | 不在设置项下堆砌重复营销文案 |
| **状态胶囊（`SyncStatusPill`）** | 持续进行的云同步状态、刚刚同步完成、同步失败重连入口 | — |
| **确认框 / 预览态** | 破坏性操作或大规模调度变更（详见 4.2） | 轻量偏好开关（主题、语言、开关项）必须即时生效，**不弹确认框** |

### 4.2 破坏性操作与可撤销护栏

- **不可逆或重置进度操作（删除牌组、删除卡片、重置卡片进度）**：必须经过二次确认（复习抽屉内采用互斥内联确认态，切卡/关抽屉/按 `Esc` 自动取消）；单卡「重置进度」与「删除卡片」均纳入会话撤销栈与 Anki 原生撤销栈。
- **调度级批量操作（休假顺延、雪崩减负）**：
  - 执行前展示清晰的参数预览与影响估算。
  - 执行后持久化回执（`last_rescue_receipt` / `vacation_state`），支持**一键撤销恢复快照**（`undo_rescue` / `cancel_vacation`）。
- **普通偏好设置**：采用乐观更新（立即更新 UI），失败时回滚或提示 Toast，并自动持久化。

---

## 5. 桌面壳与多账号生命周期交互

### 5.1 窗口与跨平台原生体验

- **沉浸式标题栏拖拽**：macOS 侧边栏顶部 40px 与品牌栏空白处支持 `startWindowDrag` 与双击最大化；该区域内任何可点击按钮必须绑定 `onMouseDown={(e) => e.stopPropagation()}`，避免点击被拖拽吞噬。
- **三层防迷失安全网**：快捷键 `Ctrl+Opt+M`（macOS）/ `Ctrl+Alt+M`（Win/Linux）、Anki 顶栏 Tools 菜单入口、原生顶部工具栏常驻彩色入口，保证任何时候可 1 秒切回原生 Anki。

### 5.2 多 Profile 切换隔离

当用户在 Anki 内切换账号（触发 `anki:profile-changed`）：
1. 前端立即递增 `profileGeneration`，所有旧账号在途异步请求返回时因代际不匹配而被静默丢弃。
2. 同步清空上一账号的 Profile 专属内存态（`customAvatar`、`customNickname`、休假状态、减负回执、牌组折叠态、当前复习队列等）。
3. 重新初始化并拉取新账号的仪表盘与偏好配置，杜绝跨账号串台。

### 5.3 跨日自动刷新

- 启动时读取 Anki 精确 `day_cutoff`（`dayBoundary`），前端在 `day_cutoff + 2s` 处挂设精确计时器（超时后指数退避重试至最多 60s）。
- 窗口重新聚焦（`window focus`）或标签可见（`visibilitychange`）时附带 3 秒节流触发 `checkDayRollover`，配合 Python 端 `day_did_change` 钩子推送 `anki:day-changed`，确保通宵或休眠唤醒后今日到期数与连续天数自动刷新。
