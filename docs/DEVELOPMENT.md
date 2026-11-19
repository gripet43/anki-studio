# Anki Studio 开发手册（Development Guide）

> 本文档面向 **Anki Studio**（`anki_modern_os`）的开发者与协作 Agent，说明系统架构、前后端通信协议、配置与 Profile 隔离机制、常见功能开发 SOP、自动化测试金字塔以及打包发布流程。
>
> 配套文档：视觉与组件规范见 [`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)，交互与快捷键规范见 [`docs/INTERACTION.md`](INTERACTION.md)。

---

## 1. 技术栈与目录结构

- **宿主环境**：Anki **26.09.4+**（`min_point_version: 260904`）、Qt6 / PyQt6、Anki 内置 Python 3.13（支持 macOS / Windows / Linux）。
- **前端工程**：React 19 + TypeScript + Tailwind CSS v4 + Vite 6（构建产物输出至 `web/`，由 Qt WebEngine 离线加载）。

```text
anki_modern_os/
├── __init__.py                 # 插件入口：Qt6 WebView 宿主、4 项原生补丁、gui_hooks 生命周期、事件广播
├── manifest.json               # AnkiWeb 清单（version / human_version / min_point_version / mod）
├── config.default.json         # 干净默认配置模板（入库）
├── config.md                   # Anki 原生插件配置说明
├── bridge/                     # Python 桥接与业务服务层
│   ├── router.py               # 统一动作路由器（50+ 个 action_* 方法）
│   ├── profile_config.py       # 全局 vs Profile 隔离配置、历史配置安全迁移、头像安全存储
│   ├── compat.py               # 运行时版本、4 补丁与 8+ 钩子健康自检（get_patch_health）
│   ├── deck_service.py         # 首页仪表盘、牌组 CRUD、牌组选项、统计数据
│   ├── review_service.py       # 复习队列、FSRS 间隔、评分、撤销、自定义学习、卡片调试信息
│   ├── edit_service.py         # 制卡、行内编辑、模板、查重、图片保存、重置进度/挂起/搁置/旗标/删卡
│   ├── search_service.py       # 卡片库检索、筛选、分页与批量操作
│   ├── vacation_service.py     # 休假守护、雪崩减负、撤销回执、低能量打卡
│   ├── media_utils.py          # 媒体 URL 映射、音频提取与播放控制
│   ├── day_rollover.py         # Anki day_cutoff 精确跨日检测
│   ├── safety.py               # 安全票据与快照保护
│   └── analytics_service.py    # 可选匿名使用统计（仅计数，不含任何笔记内容）
├── frontend/                   # React/Vite 前端源码（不打入 .ankiaddon）
│   └── src/
│       ├── App.tsx             # 根容器、主题/RTL 同步、事件监听、全局快捷键、Toast
│       ├── bridge/pycmd.ts     # 强类型 IPC 客户端（callAnki / NO_TIMEOUT_ACTIONS）
│       ├── stores/useAppStore.ts # 轻量全局状态与异步 Action 编排
│       ├── components/         # 按领域划分的视图与通用原语
│       ├── hooks/              # useFloatingPosition / usePresence 等
│       ├── i18n/               # translations.ts + locales/（16 种语言全覆盖）
│       ├── utils/              # 纯函数工具（严格 SSR 安全）
│       └── index.css           # Tailwind v4 入口、语义 Token 与组件样式
├── web/                        # Vite 构建产物（运行时白名单打包来源）
├── scripts/
│   ├── build_ankiaddon.py      # 生产构建 + 白名单打包 + 隐私键剥离 + 自动复制 Downloads
│   └── analytics-worker/       # 可选 Cloudflare Worker 统计端点
├── docs/                       # 设计手册 / 交互手册 / 开发手册 / 宣传资源
└── tests/                      # Python 单测、前端同步单测、构建守卫、沙盒场景门禁
```

---

## 2. 宿主架构与前后端通信协议

### 2.1 Qt6 宿主、原生补丁与生命周期自检

[`__init__.py`](../__init__.py) 在启动时完成三件事：
1. **0ms 首帧预注入**：在 WebView 挂载前预设匹配主题的 Qt 背景色与 HTML 预挂载骨架，避免冷启动白屏。
2. **4 项原生补丁**（由 [`bridge/compat.py`](../bridge/compat.py) 的 `PATCH_SPECS` 持续自检）：
   - `preferences`：接管 `Ctrl+P` / `Cmd+,` 指向 Anki Studio 设置弹窗
   - `progress`：静默原生进度弹窗与漏斗光标
   - `tooltip`：拦截原生黄色 tooltip 转为前端 Toast
   - `sync-error`：捕获原生同步异常并回传前端
3. **生命周期钩子**（`gui_hooks`）：挂载 `webview_did_receive_js_message`、`main_window_did_init`、`profile_did_open`、`profile_will_close`、`sync_will_start`、`sync_did_finish`、`operation_did_execute`、`state_did_reset`、`day_did_change`、`focus_did_change`、`top_toolbar_did_init_links`。

所有补丁均包裹在 `try/except` 中永不阻塞启动；任何失效均可通过 `get_patch_health` 或启动控制台日志定位。

### 2.2 JS → Python 请求协议（`callAnki`）

- **前端入口**：[`frontend/src/bridge/pycmd.ts`](../frontend/src/bridge/pycmd.ts)
  - 报文格式：`window.pycmd("modern_anki:" + JSON.stringify({ action, data }), callback)`
  - 响应格式：`{ status: "success", data: T }` 或 `{ status: "error", message: string }`
- **超时策略**：
  - 默认超时 **`8000ms`**，超时直接 `reject`（严禁静默返回 `{}`）。
  - 会打开操作系统原生模态文件框的动作，**必须加入 `NO_TIMEOUT_ACTIONS`**（当前包含 `pick_avatar_image`、`trigger_native_import`、`trigger_native_export`），也可单次传 `{ timeoutMs: null }` 禁用超时。
- **离线开发模式**：非 Anki 宿主（无 `window.pycmd`）时 `callAnki` 返回 `null`，便于 Vite 本地预览与 Node 同步测试。

### 2.3 Python → JS 事件推送协议

[`__init__.py`](../__init__.py) 通过 `webview.eval("window.dispatchEvent(new CustomEvent(...))")` 向前端广播以下 7 个标准事件（监听集中于 [`frontend/src/App.tsx`](../frontend/src/App.tsx)）：

| 事件名 | 触发时机 | 前端响应 |
|---|---|---|
| `anki:collection-updated` | Anki 原生操作或状态重置后 | 跳过冷启动及 `source === 'sync'` 重复通知，刷新仪表盘与牌组 |
| `anki:profile-changed` | 切换 Anki Profile 时 | 清空 Profile 专属状态、递增 `profileGeneration`、重拉数据 |
| `anki:sync-started` | 原生云同步开始 | 设置 `syncing = true`，更新同步胶囊文案 |
| `anki:sync-finished` | 原生云同步完成 | 执行单次协调刷新（`handleNativeSyncFinished`） |
| `anki:toast` | 原生拦截的提示消息 | 通过 `showToast` 展示顶部轻提示 |
| `anki:open-settings` | 触发原生 Preferences 入口 | 打开 `SettingsModal` |
| `anki:day-changed` | Anki 跨日钩子触发 | 执行 `handleDayChanged` 刷新今日进度与到期数 |

---

## 3. 数据安全与多 Profile 配置隔离

### 3.1 100% 原生 Anki 写入红线

- 所有对集合数据（卡片、笔记、牌组、调度、标签）的写入**必须调用 Anki 官方 Python API**（如 `col.update_card`、`col.update_note`、`col.sched.schedule_cards_as_new`、`col.sched.*`），由 Anki 自行维护 `mod` 与 `usn`，确保 AnkiWeb 双向同步绝对安全。
- **严禁**在 `bridge/` 中通过裸 SQL（`INSERT` / `UPDATE` / `DELETE`）修改合集数据库；该约束由 [`tests/test_release_safety.py`](../tests/test_release_safety.py) 自动扫描强制门禁。

### 3.2 全局配置 vs Profile 隔离配置

Anki 的 `mw.addonManager.getConfig / writeConfig` 全局共用同一份 `meta.json`。为防止不同账号的数据互串，[`bridge/profile_config.py`](../bridge/profile_config.py) 将配置严格划分为两层：

- **全局偏好（存顶层）**：`theme`、`accent_color`、`language`、`show_shortcut_hints`、`show_dashboard_tips`、`continuous_card_creation`、`auto_play_front_audio`、`auto_play_back_audio`、`review_content_scale`、`review_stage_width`、`answer_button_mode` 等跨账号通用的界面习惯。
- **Profile 专属状态（`PROFILE_SCOPED_KEYS`，存 `profile_states[profile_key]`）**：
  - `vacation_state`、`vacation_history`、`vacation_frozen_dates`
  - `last_rescue_receipt`、`rescue_history`、`safety_ticket`
  - `collapsed_deck_ids`、`sandbox_notetype_ids`
  - `custom_nickname`、`custom_avatar`、`last_sync_checked_map`
- **本地头像文件隔离**：自定义头像图片落地于 `user_files/avatars/<profile_hash>/`，仅接受光栅图（PNG / JPEG / WebP / GIF，上限 512 KB），严禁路径穿越与 SVG。
- **隐私打包防泄漏**：任何新增的含用户个人数据的键，必须同时加入 [`scripts/build_ankiaddon.py`](../scripts/build_ankiaddon.py) 的 `PRIVATE_CONFIG_KEYS`；`config.json`、`meta.json`、`user_files/` 已在 `.gitignore` 与打包排除名单中双重拦截。

---

## 4. 常见开发任务 SOP

### 4.1 新增一个 Bridge Action

1. 在对应的 `bridge/*_service.py` 实现纯业务函数，确保只走 Anki 官方 API。
2. 在 [`bridge/router.py`](../bridge/router.py) 添加 `def action_<name>(self, data: Dict[str, Any]) -> Dict[str, Any]`，返回可 JSON 序列化的字典；若业务校验失败，返回明确结构化错误码或抛出可读异常。
3. 在 [`frontend/src/bridge/pycmd.ts`](../frontend/src/bridge/pycmd.ts) 声明请求/响应 TypeScript 接口；若涉及系统原生交互弹窗，同步加入 `NO_TIMEOUT_ACTIONS`。
4. 在 [`frontend/src/stores/useAppStore.ts`](../frontend/src/stores/useAppStore.ts) 封装 Action，注意检查 `profileGeneration` 避免跨账号回写。
5. 在 `tests/` 下补充 Python 单元测试（如 `test_bridge.py` 或专题测试文件）。

### 4.2 新增一个持久化配置项

1. **先判归属**：属于界面习惯（全局）还是绑定某账号的学习/个人状态（Profile 隔离）？
2. 若为**全局项**：在 [`config.default.json`](../config.default.json) 与 [`config.md`](../config.md) 补充默认值及说明。
3. 若为**Profile 隔离项**：
   - 将键名加入 [`bridge/profile_config.py`](../bridge/profile_config.py) 的 `PROFILE_SCOPED_KEYS`。
   - 将键名同步加入 [`scripts/build_ankiaddon.py`](../scripts/build_ankiaddon.py) 的 `PRIVATE_CONFIG_KEYS`。
   - 在 `useAppStore.ts` 的 `handleProfileChanged()` 中将其重置为初始默认值。
4. 在 `bridge/router.py` 的 `action_get_preferences` 与 `action_save_preferences` 中做输入白名单校验与读写映射。
5. 同步更新前端 `UserPreferences` 类型（`pycmd.ts`）与 Store（`useAppStore.ts`），并在 `tests/test_profile_isolation.py` 补测隔离性。

### 4.3 新增或修改 UI 组件与文案

1. 动工前核对 [`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) 与 [`docs/INTERACTION.md`](INTERACTION.md)。
2. 同步补全 [`frontend/src/i18n/translations.ts`](../frontend/src/i18n/translations.ts) 与 [`frontend/src/i18n/locales/`](../frontend/src/i18n/locales) 下**全部 16 种语言**的键。
3. 在 `tests/frontend/specs/` 下补充同步单元测试（`renderToStaticMarkup` 渲染断言 + 纯函数逻辑断言），并在 `tests/frontend/suite.ts` 中引入。
4. 若新增前端核心模块或护栏点，可视情况同步登记到 [`tests/test_frontend_bundle.mjs`](../tests/test_frontend_bundle.mjs)。

---

## 5. 本地开发与五层测试门禁

### 5.1 推荐环境变量

macOS 本地运行测试与打包脚本前，优先将 Anki 内置 Python 3.13 与 Homebrew Node 纳入 `PATH`：

```sh
export PATH="$HOME/Library/Application Support/AnkiProgramFiles/.venv/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
```

### 5.2 五层自动化门禁

| 层级 | 命令 | 覆盖范围 |
|---|---|---|
| **1. TypeScript 类型检查** | `npm --prefix frontend run lint` | `tsc --noEmit` 全量静态类型检查 |
| **2. 前端构建与打包** | `python3 scripts/build_ankiaddon.py` | Vite 生产构建到 `web/` + 白名单生成 `anki_modern_os.ankiaddon` |
| **3. 前端同步单元测试** | `node tests/frontend/run.mjs` | 纯函数逻辑、SSR 渲染、Store、16 语种完整性（严格同步，详见 [`tests/frontend/README.md`](../tests/frontend/README.md)） |
| **4. 产物与架构守卫** | `node tests/test_frontend_bundle.mjs` | 校验源码契约与 `web/` 构建产物完整性（防止改了源码忘记重建） |
| **5. Python 单元 & 沙盒全门禁** | `python3 -m unittest discover -s tests -p "test_*.py" -v`<br>`./tests/scenarios/gate.sh --with-project` | Bridge/Profile/安全发布单测 + 沙盒隔离自检 + 11 个真实业务场景冒烟回归 + 24 项前端静态审计（[`tests/scenarios/frontend_audit.py`](../tests/scenarios/frontend_audit.py)） |

> 更多专题测试文档：
> - 前端测试框架说明：[`tests/frontend/README.md`](../tests/frontend/README.md)
> - 隔离沙盒与场景测试：[`tests/scenarios/README.md`](../tests/scenarios/README.md)
> - Windows 跨端联调交接：[`tests/WINDOWS_HANDOFF.md`](../tests/WINDOWS_HANDOFF.md)
> - 匿名统计 Worker 部署：[`scripts/analytics-worker/README.md`](../scripts/analytics-worker/README.md)

---

## 6. 打包与 AnkiWeb 发布清单

### 6.1 `manifest.json` 关键字段规则

- `version` 与 `human_version` 保持同步（如 `"1.6.12"`）。
- `min_point_version` **必须是 Anki `int_version()` 的 `YYMMDD` 整数**（如 `26.09.4` → `260904`）；打包脚本会硬性拒绝小于 `200000` 的值，防止误标兼容旧版 Anki 导致用户崩溃。
- `mod` 为发布时间戳，由 `scripts/build_ankiaddon.py` 在每次打包时自动刷新为当前时间戳（AnkiWeb 依赖 `mod` 推送版本更新）。

### 6.2 白名单打包与产物

执行 `python3 scripts/build_ankiaddon.py` 后：
- 仅打包运行时白名单：`__init__.py`、`manifest.json`、`config.json`（基于 `config.default.json` 清洗生成，自动剔除 `PRIVATE_CONFIG_KEYS`）、`config.md`、`bridge/*.py`、`web/**`。
- 自动排除 `frontend/`、`tests/`、`docs/`、`scripts/`、`node_modules/`、`meta.json`、`user_files/`、`.git/`、`__pycache__/`。
- 输出仓库根目录 `anki_modern_os.ankiaddon` 并打印 SHA-256，同时自动拷贝一份带版本号的归档到 `~/Downloads/anki_modern_os-v<version>.ankiaddon`（可用 `--no-downloads` 关闭）。

### 6.3 发版前核对清单

- [ ] `manifest.json` 版本号与 [`CHANGELOG.md`](../CHANGELOG.md) 已更新。
- [ ] 全套 5 层门禁（`lint` / `build_ankiaddon.py` / `tests/frontend/run.mjs` / `test_frontend_bundle.mjs` / `unittest` / `gate.sh --with-project`）全部通过。
- [ ] `git status` 确认无 `config.json`、`meta.json`、`user_files/` 等用户运行时隐私文件混入。
- [ ] macOS 与 Windows（参考 [`tests/WINDOWS_HANDOFF.md`](../tests/WINDOWS_HANDOFF.md)）核心流程验证通过后，再上传 `anki_modern_os-v<version>.ankiaddon` 至 AnkiWeb（`1071937836`）。
