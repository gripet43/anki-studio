# Windows 端验版作业指导

> 这份文档写给 **Windows 测试机上的 AI 助手与验版执行者**。你没有 macOS 那边的对话上下文，按本文执行即可。
> 当前版本基线适用 **v1.7.4 及后续版本**（r8 轮次），已合入：
> - **主题与视觉系统**：`跟随系统 (auto) / 浅色 / 深色` 三档主题（移除 OLED）、7 套纸感氛围 + 光栅 Alpha 蒙版主题插画与「显示插画」开关、白瓷微浮雕双阶钛灰 Logo、可折叠侧栏（`Ctrl+\`）与「管理」胶囊对齐、原生 `<dialog>` 圆形头像裁切与 ±90° 旋转、多 Profile 配置隔离；
> - **首页与卡片库**：今日圆环百分数、oklab 热力图与本周节奏柱图、单槽位 `SyncStatusPill`、默认「最新添加」排序、牌组跨维度分面计数（`deckCounts`）、大卡库 SQL 快路径与分页缓存 /「加载更多」；
> - **复习台、禅模式与沙盒**：单行三栏底栏（`69px`）+ **右侧全高控制栏（`bottom` / `side`）**、2×3 详情抽屉与「重置进度（`forget_cards`）」、原生 Popover 无幽灵点击、**全局兼容模式（`compat_mode`）+ 通用脚本沙盒（`cardN` / 深浅画布与 `.cloze` 保真 / 内存 `localStorage` 垫片 / 沙盒 LaTeX）**、嵌套 Cloze 栈式解析、原生 Image Occlusion 翻面去重、**极简禅模式（Zen Mode）**、跨日自动刷新、触控板滑卡手势开关与物理滚轮隔离、AnkiWeb 点赞支持原生 `<dialog>`；
> - **Windows 专项稳定性**：全站全屏弹窗移除 `backdrop-blur`（根治 Windows QtWebEngine/ANGLE 悬停整窗闪屏）、`meta.json` 原子替换写盘与统计主线程落盘、Windows 单测文件锁修复及干净克隆直接打包。

## 你的角色

这台机器是**上线前的第二道关**，不是日常开发机。它存在的意义有三条：

1. **物理隔离**——这里没有用户的真实 Anki 数据，怎么折腾都不怕
2. **覆盖 Windows**——路径分隔符（`file:///C:/...`）、SQLite 文件锁、QtWebEngine/ANGLE 渲染与屏闪、中文 IME 输入法、高 DPI、Windows `Ctrl`/`Alt` 快捷键映射与音频驱动
3. **承载重负载**——可以造几万张卡的极端账号，实测 SQL 快路径与分页缓存表现

**你不需要改产品功能**。你的产出是「测试结果 + 问题清单 + 截图」，不是 `bridge/` 或 `frontend/src/` 的代码补丁。

## 前置条件（人工确认一次）

| 项 | 要求 | 检查方式 |
|---|---|---|
| Anki | **26.09.4 及以上**桌面版（`min_point_version: 260904`） | 能正常打开与退出 |
| Python | 3.10 及以上 | `python -V` 或 `py -3 -V` |
| Git | 任意较新版本 | `git --version` |
| Node.js（强烈建议） | 20+，跑前端单测 / Store 测试 / Bundle 审计 / Worker 测试 | `node -v`；缺失时仍可跑完整后端冒烟、Python 单测与 24 项静态审计 |
| 仓库 | 已同步到目标 commit | `git -C <repo> rev-parse --short HEAD` |

仓库已公开为 <https://github.com/gripet43/anki-studio>，可直接拉取，无需凭据。若要往仓库推送报告才需要 SSH key 或 Git Credential Manager，不要尝试绕过认证。

若终端中文显示乱码，先执行一次 `chcp 65001`。下文未特别说明仓库根目录的命令，均在 `tests\scenarios\` 目录下执行。

---

## 第一步：同步代码与环境自检

先确保本地仓库与目标分支同步，并探测 Windows 路径与沙盒隔离状态：

```powershell
cd <repo>
git pull --ff-only
cd tests\scenarios
python -c "import sys; sys.path.insert(0, '.'); from paths import anki_app_packages, anki_executable, real_anki_base; print('packages:', anki_app_packages()); print('exe     :', anki_executable()); print('realbase:', real_anki_base())"
python verify_isolation.py
```

期望三个路径都打印出真实目录，且隔离自检全部 `[PASS]`。如果 `packages` 或 `exe` 是 `None`，说明 Anki 装在非标准位置，先设置环境变量并重开终端：

```powershell
setx ANKI_APP_PACKAGES "D:\你的\Anki\app_packages"
setx ANKI_BIN "D:\你的\Anki\anki.exe"
```

`ANKI_APP_PACKAGES` 必须指向含 `anki\` 子目录的那一层。

---

## 第二步：生成场景并校验可复现性

```powershell
cd <repo>\tests\scenarios
python build.py --all
python build.py --verify-repro exam
```

共 **11 个场景**（Windows 文件系统较慢，通常 10–25 秒；超过 45 秒才算异常）。
**版本更新后必须全量重建**，不要复用旧 `lib\*.anki2`：`mixed` 含 7 色旗标数据、`io-native` 含原生 `{{c1::image-occlusion:rect:...}}` 指令、`media` 含图片与 `[sound:...]` 音频测试夹具。

期望看到 11 个场景全部完成，且 `exam … 可复现` 校验通过。**如果报错**，把完整堆栈抄进报告。

---

## 第三步：自动化全套回归

> r7 遗留的 3 项 Windows 工具链问题均已修复：`test_card_safety_round3.py` 已显式 `env.close()` 释放 Windows SQLite 文件锁；`scripts/build_ankiaddon.py` 在干净克隆无 `config.json` 时自动读取 `config.default.json` 并原子落盘；`test_frontend_bundle.mjs` Item #34 已校验 `.ankiaddon` ZIP 内部条目完整性。现在全套测试可在默认 Windows `core.autocrlf=true` 环境下**直接全绿运行**。

### 3.1 隔离场景后端冒烟（在 `tests\scenarios\`）

```powershell
python smoke.py
```

期望输出 **`726 项检查全部通过（11 个场景）`**，0 `FAIL`。允许出现 **3 条**「已知缺陷」提示，它们不算失败：

| 标签 | 含义 |
|---|---|
| `vacation:type-normalized` | 极端 `due` 下 Anki 框架会规范化 `type/queue` |
| `duplicate:skip` | 首次查重用的笔记正文去标签后为空，该分支未覆盖 |
| `vacation:rescue-skip` | 场景里没有到期的复习卡，减负与低能量分支未覆盖 |

重点守卫覆盖项（出现任何 `FAIL` 即为阻断或回归项，记录场景名与详情，**不要改产品代码让它变绿**）：

| 标签前缀 / 项 | 断言内容 |
|---|---|
| `get_dashboard` / `day-rollover` | 含 `dayBoundary`（`logicalDate`）与懒加载所需的 `allTags`；`check_day_rollover` 状态结构完整 |
| `search_cards` / `sort:*` | 默认缺省排序按最新添加（`id` 降序）、`facetCounts` 含 `deckCounts`/`deckAllCount`；七种排序总数不变、顺序严格单调 |
| `custom-study:*` | 四种预设 SQL 快路径预览计数 `min(limit, totalMatched)`、语义一致、全库调度零 diff、7 色旗标校验 |
| `occlusion:frontHtml` / `native-io:*` | 自定义与原生 Image Occlusion 底图 `file://`、遮罩样式、多 group 隔离，以及 **v1.7.4 原生 IO 复习背面无重复裸图** |
| `media:audio-side-split` | `media` 场景带 `[sound:...]` 卡片提取到 `frontAudioFiles`，且不重复污染 `backAudioFiles` |
| `get_review_queue` / `debug-info` | 复习卡片含 1-based `cardOrd` 与 `needsSandbox`；调试信息含脚本模板检测标志（`hasClozeOverlappingKeyword` / `questionHidesBodyWithoutScript`）与 `configSnapshot`（含 `reviewDockPosition` / `compatMode`） |
| `get_preferences` / `preferences:*` | 主题（含旧 `oled→dark` 归一化）、音频双开关、画幅/缩放、右侧控制栏、全局兼容模式、滑卡手势、侧栏折叠、插画与连续制卡开关往返一致 |
| `cards:forget` | `forget_cards` 将复习卡重置为新卡（`type=0, queue=0`）并可撤销恢复 |
| `editor:companion-cloze` / `editor:nested-cloze` | `exam` 场景普通卡加挖空派生 `(Cloze)` 伴生卡型；嵌套挖空 `{{c1::外层 {{c2::内层}}}}` 保存保留 `c1`/`c2` 两张卡且渲染无残余 `}}` |
| `vacation:*` / `rescue:*` | 开启休假 / 应急减负与撤销还原后全库逐卡零 diff |

### 3.2 前端静态审计（仅需 Python，在 `tests\scenarios\` 或仓库根）

```powershell
python frontend_audit.py
```

期望输出 **`24 项前端静态审计全部通过`**。检查内容包括：
- `domTarget.ts` 鸭子类型防御、`ReviewerView` 与 `windowDrag` 走 helper、外部无裸 `.closest(`、构建产物含防御逻辑；
- 挖空序列化 `wysiwygField.ts` 走 `innerHTML`（不丢失 `<b>`/`<img>`）；
- `editorTable.ts` 表格表头不混入 `isDark`；
- 统一 `<Tooltip>` / `<HoverCard>` / `useFloatingPosition` 具备 `typeof document` SSR 守卫、无未迁移原生 JSX `title=` 属性（仅 `<iframe>` 例外）、`index.css` 含 `--tooltip-bg` / `--z-tooltip` 令牌。

### 3.3 Python 单元测试（在仓库根目录）

```powershell
cd <repo>
python -m unittest discover -s tests -p "test_*.py"
```

期望 **`Ran 189 tests ... OK`**（覆盖 Bridge 契约、SQL 快路径与分页缓存、多 Profile 隔离、跨日切换、通用脚本沙盒、嵌套 Cloze 与原生 IO 翻面去重、`meta.json` 原子写盘与多线程匿名统计压测、卡片安全锁与崩溃恢复、Patch 健康自检、干净克隆打包门禁及 Windows 几何守卫）。

### 3.4 Node.js 前端单测、Store 测试、Worker 测试与 Bundle 审计（在仓库根目录，需 Node 20+）

若本机首次跑前端套且还没有 `frontend\node_modules`，先安装一次依赖（仅安装，不改业务代码）：

```powershell
cd <repo>\frontend
npm install
cd ..
```

随后依次运行：

```powershell
npm --prefix frontend run lint
node tests/frontend/run.mjs
node tests/test_day_rollover_store.mjs
node tests/test_reviewer_undo_store.mjs
node tests/test_analytics_worker.mjs
node tests/test_frontend_bundle.mjs
```

期望结果：
1. `npm --prefix frontend run lint`：无任何 TypeScript 报错。
2. `tests/frontend/run.mjs`：**`ALL 231 CHECKS PASSED!`**（覆盖 `domTarget`、挖空分组/胶囊、`editorTable`、清除格式、默认排序与分页加载、首页圆环与 oklab 图表、头像与多档案、`SandboxCardFrame`（`cardN` / 深色画布 / 自定义 `.cloze` / 内存 `localStorage` / LaTeX）、禅模式渲染与声景、滑卡手势状态机、AnkiWeb 点赞弹窗策略、`<Tooltip>`/`<HoverCard>`/`SyncStatusPill`、全站弹窗禁用 `backdrop-blur` 断言等）。
3. `tests/test_day_rollover_store.mjs`：**`ALL 5 SCENARIOS PASSED!`**。
4. `tests/test_reviewer_undo_store.mjs`：**`ALL 5 SCENARIOS PASSED!`**。
5. `tests/test_analytics_worker.mjs`：**`22 passed, 0 failed`**。
6. `tests/test_frontend_bundle.mjs`：**`ALL CHECKS PASSED!`**（覆盖 **Item #1–#69** 护栏、16 语种词典一致性、以及 `.ankiaddon` ZIP 内容完整性校验）。
   > **提示**：在干净 `git clone` 仓库里默认没有 `anki_modern_os.ankiaddon` 产物；跑 `test_frontend_bundle.mjs` 前可先执行一次第五步 5.2 的打包命令 `python scripts\build_ankiaddon.py --skip-build --no-downloads`，让 Item #34 完整校验 ZIP 内部条目。
7. （可选）若机上有 Chrome：`python tests\frontend\run_browser.py`（跑 8 项编辑器 DOM 往返；未检测到 Chrome 时自动跳过）。

---

## 第四步：启动界面与 Windows 专项人工验收（共 28 项）

> 每次启动前先退出任何运行中的主 Anki（Anki 单实例锁限制）。`run.py` 会自动把当前仓库源码（含 `web/` 构建产物）同步到 `%USERPROFILE%\Anki-Test-Env\base\addons21\anki_modern_os`，关掉 Anki 窗口后脚本才返回。

建议按场景依次启动核对，截图统一存 `tests\reports\screenshots\r8\`（**新建目录，不要覆盖 `r3\`–`r7\` 历史截图**）：

### 一、核心主力场景：`python run.py exam`（覆盖 A–E 组共 25 项）

#### A 组：首页、侧栏、主题氛围与卡片库（7 项）
- [ ] **A1 首页仪表盘、连胜火苗、oklab 图表与同步按钮**：今日进度圆环主指标为动画百分数（`0%`～`100%`）；连胜为「主题橙数字 + 右侧双层火苗与柔和暖光晕」；热力图与「本周学习节奏」柱图采用一致的柔和 oklab 色阶（含周均虚线与结构化 Tooltip）；底部 40 条学习小贴士支持首页「今日不再显示」与设置页永久开关分治；顶栏同步按钮为左侧单槽位刷新图标（`↻ 未同步` / 悬停旋转 180° / HoverCard 显示云朵详情），切 `English` 核对无文字下沉裁切后再切回简体中文；搜索框仅含放大镜与文字（无 `Ctrl K` 角标）。
- [ ] **A2 三档主题（无 OLED）与 7 套纸感插画氛围**：进入「设置 → 外观」，确认主题模式仅为 **`跟随系统 / 浅色 / 深色`** 三档（**无 OLED 选项**）；验证 `indigo`（经典蓝）严格零插画纯白画布，切换至 `emerald` / `amber` / `teal` 等主题可见对应温润纸感底色与淡墨插画（首页问候、牌组微章、复习四角边饰），切换「显示插画」总开关即时生效；**重点复验 r7 问题 1**：深色模式下普通 Basic 卡正背面均无突兀白底黑字块，整体对比度清晰。
- [ ] **A3 侧栏折叠缩放与视觉入口**：点击侧栏折叠按钮或按 `Ctrl+\`，侧栏平滑切换 `240px ↔ 72px` 紧凑图标栏（收起态悬停显示右侧 Tooltip），重启 Anki 偏好保留；左上角白瓷微浮雕双阶钛灰 Logo 点击直达「设置 → 关于」（页内含作者名片、匿名统计开关与 AnkiWeb 点赞 `Rate This` 指引）；左下角无重复设置齿轮图标，点头像直达「外观」；牌组区右上角「管理」胶囊悬停/激活态与下方牌组数字严格右对齐。
- [ ] **A4 个人头像圆形裁切与 ±90° 旋转**：在「设置 → 外观」点击「上传头像」选择一张本地 PNG/JPG 图片，打开原生 `<dialog>` 圆形裁切弹窗；测试拖拽平移、滑块/滚轮 `1×–3×` 缩放、`±90°` 旋转、键盘方向键与缩放微调；按 `Esc` **仅关闭裁切弹窗不穿透关闭设置页**；保存后侧栏左下角头像立即更新。
- [ ] **A5 卡片库默认「最新添加」排序、跨维度牌组计数与加载更多**：冷启动首次打开卡片库有平滑加载态；无筛选时默认按「最新添加」降序，切换「到期最早」等 7 种排序正常且不溢出视口；选定某标签/状态/搜索词后，**「牌组」下拉实时显示当前条件下的匹配条数（`deckCounts`）**、无匹配牌组淡显 `0`；存在激活筛选时「重置筛选」高亮为主题主色；点击底部「加载更多」显示加载态且防连点；打开 `Ctrl+K` 搜词后关闭再重新打开，输入框已清空无上次残留词。
- [ ] **A6 统计页 6 面板动效与 `(i)` 解释浮层**：统计页 6 张卡片错峰平滑进场，完成后无残留位移；点/悬停表头 `(i)` 浮层可查看口径说明；留存曲线、90% 基线、24 小时专注分布数字正常无 `NaN`、无 `20:00:00` 畸形时间。
- [ ] **A7 窄屏、高 DPI 适配与 Windows 快捷键文案**：缩窄窗口（如 900×650）或切换系统 DPI 缩放（100% / 125% / 150%），侧边栏与 Gallery 列数自适应重排不溢出；「设置 → 快捷键」、`Ctrl+K` 与编辑器角标全部显示 `Ctrl` / `Alt`，**不得出现 macOS 的 `⌘` / `Option`**。

#### B 组：Windows QtWebEngine 专项：防屏闪、中文 IME、滚轮与事件防御（5 项）
- [ ] **B1 窗口拖拽、双击最大化与缩放防闪白**：拖拽沉浸式标题栏移动、双击标题栏最大化/还原、拖动边缘缩放窗口大小——无崩溃、无白屏闪烁、WebView 几何边界贴合窗体无黑边或溢出。
- [ ] **B2 全站全屏弹窗悬停防整窗闪屏（v1.7.0 重点）**：依次打开「设置」「自定义学习」「休假模式」「进度减负」「`Ctrl+K`」弹窗，用鼠标高频扫过设置页 8 色主题色块、开关与各处 `<Tooltip>` / `<HoverCard>`——确认纯暗幕遮罩（已移除 `backdrop-blur`）在 Windows QtWebEngine/ANGLE 下**不再出现整窗瞬间消失闪现底层页面**的现象；浮层贴边自动避让且全界面无 Chromium 原生黑/白 `title` 气泡。
- [ ] **B3 Windows 中文 IME 编辑器防屏闪、连续制卡与清除格式**：打开新建/编辑弹窗，切换微软拼音连续输入、选词上屏、拖选加粗/高亮无闪白重绘与吞字；新建弹窗左下角开启「连续制卡」，添加一张卡后**弹窗不关闭**、自动清空正反面并保留当前牌组/卡型/标签、顶部弹出「已添加 1 张卡片至…」完成态 Toast；点工具栏「清除格式」按钮可清除加粗/颜色/内联样式同时保留挖空胶囊与图片；输入修改后按 `Esc` 弹出低饱和浅红底深红字（`.btn-danger-tinted`）确认弹窗，再按 `Esc` 仅关确认框不穿透关闭编辑器。
- [ ] **B4 非 Element `event.target` 防御与物理鼠标滚轮防误触滑卡**：在复习页刻意先点一下背景空白处，再按 `Space` 翻面、`1–4` 评分均正常生效（无 `closest is not a function`）；在正反面用**普通物理鼠标上下滚轮滚动长卡片**，确认**绝不会误触发下拉翻面或左右滑卡评分**；在「设置 → 答题设置」确认可见「触控板双指滑卡手势」开关且可正常切换保存。
- [ ] **B5 卡片库 Gallery 交互边界**：hover 卡片约 220ms 整卡翻转；富文本背面内容超出时干净裁切、**不越过底部分割线遮挡操作按钮**；点背面标签直接按该标签筛选；单击卡片空白不直接打开编辑器，仅点击背面「编辑」才进入；开启多选模式后卡片保持正面不翻转。

#### C 组：复习台布局、右侧全高控制栏、抽屉与音频（6 项）
- [ ] **C1 单行三栏底栏与语义评分色**：复习页底部为紧凑单行 3 栏（左「本轮完成卡片」、中翻面/评分主按钮、右「记忆正确率」并在抽屉打开时淡隐），底部已无重复「卡片信息」按钮；切至「简洁双按钮」模式并更换 `rose` / `amber` 等暖主题色，确认「记得」按钮始终锁定为成功绿，不与「遗忘」撞色；评分并测试 `Ctrl+Z` / `Backspace` 撤销，卡数与日志实时回退。
- [ ] **C2 右侧全高控制栏（v1.7.3 重点）**：在 `Aa` 浮层及「设置 → 答题设置」切换控制栏位置「底部 ↔ 右侧」，确认右侧栏（`224px`）集成可拖拽顶区（支持双击最大化）、紧凑工具栏、进度条、双行宽适纵向评分按钮及底部统计，左侧阅读舞台接近全屏纵向展示；点击 `···` 打开卡片详情抽屉时**原地覆盖右侧栏、左侧阅读区零跳动**；重启 Anki 后布局偏好保留。
- [ ] **C3 `Aa` 双维调节、原生 Popover 无幽灵点击与快捷键复验**：点 `Aa` 切换画幅（`自动 / 标准 / 宽屏 / 超宽`）与内容缩放（`90%–150%`），放大至 `150%` 不覆盖顶栏与控制栏；**关闭 `Aa` 与音频 Popover 后**，点击原先被浮层覆盖区域的按钮/文字确认**无透明幽灵层拦截点击**；顺带复验 `Ctrl + = / -` 与 `Ctrl + Shift + 0` 在本机是否生效或被 Anki 主窗体缩放拦截（记录现象）。
- [ ] **C4 2×3 详情抽屉、「重置进度」与复制调试信息**：点 `···` 打开详情抽屉，核对底部对称 `2×3` 带框居中六宫格（纸感主题下为净底细框、无「泥色砖块墙」，「删除卡片」静息为克制红字无大块粉底，点击才进入互斥内联二次确认）；测试「重置进度」→ 确认生效后按 `Ctrl+Z` 撤销还原；点击「复制调试信息」粘贴核对含 `reviewDockPosition`、`compatMode`、`hasClozeOverlappingKeyword`、`questionHidesBodyWithoutScript`、`Windows/Qt/Python` 版本及 `patchHealth`（留意是否仍有 r7 问题 6 的钩子警告）。
- [ ] **C5 音频自动播放双开关、分体控制与模态 `Esc` 隔离**：核对「设置 → 答题设置」正面（默认关）/ 背面（默认开）双开关重启记忆；复习页打开设置/`Ctrl+K`/编辑弹窗按 `Esc` 仅关最顶层不退出复习；无音频卡顶栏收敛为紧凑小喇叭，气泡可即时切换开关并直达设置。
- [ ] **C6 休假守护与雪崩减负双弹窗统一体验**：点击侧栏底部休假与减负图标，核对两弹窗共用暖纸表面、Studio 渐变滑轨、分段页签与 `Tab` 焦点环路；开启 2 天休假后再撤销，确认卡片与统计无异常。

#### D 组：挖空（含嵌套）、伴生卡型、脚本沙盒与灯箱（4 项）
- [ ] **D1 伴生 `(Cloze)` 与嵌套 Cloze 栈式解析（v1.7.4 重点）**：挑一张普通 `Basic` 卡点编辑，加入 `{{c1::关键词}}` 保存后迁入 `... (Cloze)` 伴生卡型且同卡型他卡不受影响；再新建或编辑一张含**嵌套挖空** `{{c1::外层 {{c2::内层}}}}` 的卡保存，确认生成 `c1`/`c2` 两张卡，重新编辑保存不误删 `c2`，且复习与预览中遮罩与答案清晰、**不出现残余 `}}` 源码**。
- [ ] **D2 深色表格与 LaTeX 预览/沙盒公式**：深色模式下在编辑器插入表格并切回浅色/预览，表头保持高对比；打开含 `\(...\)` 或 `$$...$$` LaTeX 公式的卡片，**不做任何修改直接点「预览」**及在复习页兼容沙盒下查看，均正常渲染数学公式。
- [ ] **D3 全局兼容模式与通用脚本沙盒（v1.7.0–v1.7.1 重点）**：在 `Aa` 中开启全局「兼容模式」，连续翻刷不同笔记类型的卡片确认开关保持常开不中途关闭；在浅色与深色模式下分别查看兼容沙盒卡片（含挖空卡），确认文字清晰无白字配白底 / 黑字配黑底，自定义 `.cloze` 配色不被强行套上浅绿胶囊；**可选进阶验证**：若临时导入或新建一张含深色 `.card` 画布、`document.body.className` 读取 `card1` 与 `localStorage` 的脚本模板卡（如 `Cloze Overlapping`），确认无需手动点 `Aa` 即可自动进沙盒正常渲染且无 `SecurityError` 白屏。
- [ ] **D4 学习模式大图灯箱（Lightbox）**：单击复习页或沙盒中的图片进入全屏灯箱，验证光标处滚轮缩放、左键拖拽、双击切换倍率、`Esc` 关闭；确认双击图片不误开编辑器、暗幕无 `backdrop-blur` 闪屏。

#### E 组：极简禅模式专项（v1.7.0–v1.7.1 重点，3 项）
- [ ] **E1 入口、焚香入静仪式与全键盘闭环**：首页顶栏同步按钮左侧点击毛笔「禅」字图标（或按 `Ctrl+Shift+Z`）进入禅模式，确认侧栏与一切统计数字隐藏；触发「焚香入静」仪式——未点香前按 `Esc` 直接退出；重新进入后点击或按 `Space` 点香，青烟升起伴颂钵显影水墨圆相（点香后二次轻触或按 `Space` 可柔切快进），进入禅首页后按 `Space`/`Enter` 开卷、点击「一签择卷」浮层切牌组。
- [ ] **E2 纯纸背诵、15 分钟燃香与离线 Web Audio 声景**：禅背诵页全程零待学数字与 FSRS 预测间隔；书案燃香青烟流畅、缩窄窗口时自动柔隐不与卡片正文重叠；进入前 3 秒顶栏按键可见随后淡隐、鼠标移近或键盘聚焦随时唤出；打开声景浮层（确认无 `backdrop-filter` 闪屏），分别测试静默 / 檐雨 / 松风 / 暖寂与音效/环境双音量滑块在 Windows 音频设备上发声正常无爆音，重启后声景偏好保留。
- [ ] **E3 复习中途切入/退出禅模式**：在普通复习页学习中途按 `Ctrl+Shift+Z`，确认跳过焚香仪式直接落入当前卡片的禅背诵页；未完赛退出禅模式时无缝回到同一张卡片的普通复习页。

---

### 二、媒体与真音频专项：`python run.py media`（1 项）
- [ ] **M1 媒体渲染与音频自动播放实测**：确认卡片库与复习页里的 `.png` 图片在 Windows `file:///C:/...` 路径下完整加载、无破图；进入含 `[sound:audio_01.mp3]` 的卡片确认正面显示 `[🔊 朗读 | ⚙]` 分体胶囊。
  > **提示**：`media` 场景内置 `audio_01.mp3` 与 1×1 PNG 均为占位素材。若要真耳与真实大图验证，可在测试库临时新建 2 张带真实 `.mp3` 与真实大图的卡片：实测① 正面自动播开关关/开生效；② 仅正面有音频 + 翻面自动播开启时自动回退重播正面音频；③ 播音中瞬间评分切卡旧音频立即中断不串音；④ 真实大图点击灯箱缩放漫游。

### 三、图片遮挡只读与翻面去重专项：`python run.py io-native` 与 `python run.py occlusion`（1 项）
- [ ] **I1 IO 只读策略与原生 IO 翻面去重（v1.7.4 重点）**：
  - 点「新建卡片 → 卡型下拉」：**看不到 `Image Occlusion`**，编辑器工具栏也没有图片遮挡创作按钮；
  - 在 `io-native` 与 `occlusion` 打开已有遮挡卡点编辑：弹窗默认落在「预览」态、显示只读提示、隐藏保存按钮、按 `Esc` 直接关闭；
  - **v1.7.4 重点回归**：在 `io-native` 进入普通复习与禅模式翻面显示答案——确认正面遮罩已揭晓为绿色透明框，且**下方不再重复出现第二张无遮罩裸图**（无额外备注时不出现多余分隔线）；底图 `file:///C:/...` 与遮罩位置精准对齐。

### 四、七色旗标专项：`python run.py mixed`（1 项）
- [ ] **F1 卡片库旗标筛选与设置**：在「旗标」下拉中可见 7 种颜色及各自准确计数，选定某色后列表仅展示对应旗标卡片（核对计数与结果数口径一致）；复习页旗标浮层与 `Ctrl+1~7` / `Ctrl+0` 正常。

---

## 第五步：重负载与干净环境打包检验（建议做）

### 5.1 重负载压力检验（`power` 20,000 卡 — 验证 v1.7.0/v1.7.3 SQL 快路径与分页缓存）
临时将 `tests\scenarios\scenarios.py` 里 `power.total_cards` 改为 `20000` 并 `python build.py power`，启动 `python run.py power` 实测并记录：
1. 首页冷启动（已改为按需懒加载卡片库）、统计页加载、卡片库搜索与「加载更多」翻页（分页缓存）耗时；
2. 打开首页「自定义学习」弹窗并在「错题 / 旗标 / 提前复习 / 额外新卡」间切换，验证新 SQL 快路径是否毫秒级响应、不再卡顿。

测完务必还原测试场景并清回默认 3020 卡：

```powershell
cd <repo>
git checkout -- tests\scenarios\scenarios.py
cd tests\scenarios
python build.py power
```

### 5.2 `.ankiaddon` 干净环境打包与完整性验证
`scripts/build_ankiaddon.py` 已支持直接从 `config.default.json` 清洗生成包内 `config.json` 并通过 `.tmp` 原子替换写出，**干净 clone 无需再手工拷贝 `config.json`**：

```powershell
cd <repo>
python scripts\build_ankiaddon.py --skip-build --no-downloads
node tests/test_frontend_bundle.mjs
```

核对：
1. 根目录产出完整 `anki_modern_os.ankiaddon`（顶层仅 `__init__.py`、`manifest.json`、`config.json`、`config.md`、`bridge/`、`web/`，无 `meta.json`、`frontend/`、`tests/`、`__pycache__/` 或私人字段；`manifest.json` 版本号与 `min_point_version: 260904` 正确）。
2. `test_frontend_bundle.mjs` Item #34 ZIP 完整性校验通过。
3. 如需顺带验证 Windows `npm.cmd` 调用 Vite 构建，可再跑一次不带 `--skip-build` 的 `python scripts\build_ankiaddon.py --no-downloads`；测完删除根目录 `anki_modern_os.ankiaddon` 保持工作区干净。

---

## 第六步：回写验版报告与截图

在 `tests\reports\` 新建 `windows-<YYYYMMDD>-r8.md`，模板如下：

```markdown
# Windows 验版报告 <日期>（r8 / v1.7.4）

## 环境
- Windows 版本 / 分辨率 / DPI：
- Anki 版本 / QtWebEngine / Python / Node / Git：
- 仓库 commit：
- 沙盒目录：%USERPROFILE%\Anki-Test-Env（确认未写入真实 %APPDATA%\Anki2）

## 自动化回归结果
- build.py --all & --verify-repro exam：通过 / 失败
- smoke.py：726/726 通过（11 个场景，3 条已知豁免）/ 失败 n 项
- frontend_audit.py：24/24 通过 / 失败 n 项
- python -m unittest discover -s tests -p "test_*.py"：189/189 OK / 失败 n 项
- npm --prefix frontend run lint：通过 / 失败
- node tests/frontend/run.mjs：231/231 PASSED / 未跑或失败
- node tests/test_day_rollover_store.mjs：5/5 PASSED / 未跑或失败
- node tests/test_reviewer_undo_store.mjs：5/5 PASSED / 未跑或失败
- node tests/test_analytics_worker.mjs：22/22 passed / 未跑或失败
- node tests/test_frontend_bundle.mjs（Item #1–#69）：ALL CHECKS PASSED / 未跑或失败

## 界面与 Windows 专项验收（25 + 3 = 28 项）
- A 组首页/侧栏/主题氛围/卡片库（7 项）：
- B 组 Windows 防闪/IME/滚轮/事件（5 项）：
- C 组复习台/右侧全高控制栏/抽屉/音频（6 项）：
- D 组嵌套挖空/伴生卡型/脚本沙盒/灯箱（4 项）：
- E 组极简禅模式与离线声景（3 项）：
- M1 媒体真音频 / I1 IO 只读与翻面去重 / F1 七色旗标（3 项）：
- （注：20k 重负载与干净打包验证结果附后）

## 发现的问题
1. <现象> | <复现步骤> | <截图文件名> | <是否阻断发布>

## 与 macOS 的差异
<字体/CJK 渲染、DPI 缩放、QtWebEngine/ANGLE 弹窗与禅模式表现、IME、file:/// 路径、Web Audio 声景、物理滚轮隔离、快捷键等观察>
```

提交报告与截图时仅纳入报告与新轮次截图目录：

```powershell
git add tests/reports
git commit -m "test(windows): verification report <日期> (r8)"
git push
```

## 已知会踩的坑

| 现象 | 原因 | 处理 |
|---|---|---|
| `python` 命令不存在 | 只有 `py` 启动器 | 全部命令换成 `py -3` |
| 找不到 Anki 的 Python 包 | 装在非默认路径 | 设置 `ANKI_APP_PACKAGES` 与 `ANKI_BIN` |
| `run.py` 启动后立即退出 | 主 Anki 未完全退出（单实例锁） | 任务管理器确认无残余 `anki.exe` 后再跑 |
| 媒体图片显示不出来 | Windows 路径需正确转为 `file:///C:/...` | 重点对比 `media`、`io-native`、`occlusion`，如异常立刻截屏记为阻断 |
| 终端输出中文乱码 | Windows 代码页非 UTF-8 | 执行 `chcp 65001` 后重试 |
| 首次点击 QEMU 窗口似无响应 | 虚拟化首次点击只激活失焦窗体 | 激活窗体后再测功能操作，不要快速连续双击菜单穿透下层元素 |
| `test_frontend_bundle.mjs` 提示缺 `.ankiaddon` | 干净 clone 默认无产物文件 | 直接执行 `python scripts\build_ankiaddon.py --skip-build --no-downloads` 后复跑 |

## 绝对不要做的事

- **不要**把测试指向真实的 Anki 数据目录 `%APPDATA%\Anki2`。沙盒固定 `%USERPROFILE%\Anki-Test-Env`。
- **不要**为了「让测试变绿」修改 `bridge/`、`frontend/src/` 或业务代码。
- **不要**用 `git push --force`。
- **不要**跳过截图。Windows 特有的字体抗锯齿、DPI 裁切、QtWebEngine 弹窗与禅模式渲染、IME 重影必须靠实机截图留证。
- **不要**忘记还原 `scenarios.py` 的重负载临时改动与删除临时打出的 `anki_modern_os.ankiaddon`。

## 参考

- 沙盒与场景总览：[tests/scenarios/README.md](scenarios/README.md)
- 场景配方定义：[tests/scenarios/scenarios.py](scenarios/scenarios.py)
- 自动化后端冒烟：[tests/scenarios/smoke.py](scenarios/smoke.py)
- 前端纯 Python 静态审计：[tests/scenarios/frontend_audit.py](scenarios/frontend_audit.py)
