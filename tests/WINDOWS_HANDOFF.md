# Windows 端验版作业指导

> 这份文档写给 **Windows 测试机上的 AI 助手与验版执行者**。你没有 macOS 那边的对话上下文，按本文执行即可。
> 当前版本基线适用 **v1.5.9 及后续版本**（已合入 Windows 编辑器防屏闪与 Qt 几何守卫、学习页音频自动播放双开关与分体式控制、伴生 `(Cloze)` 转换、大图灯箱、视图 `Aa` 双维调节、卡片调试信息复制、Image Occlusion 只读策略、统一 `Tooltip`/`HoverCard` 及跨平台测试修补）。

## 你的角色

这台机器是**上线前的第二道关**，不是日常开发机。它存在的意义有三条：

1. **物理隔离**——这里没有用户的真实 Anki 数据，怎么折腾都不怕
2. **覆盖 Windows**——路径分隔符（`file:///C:/...`）、SQLite 文件锁、QtWebEngine/ANGLE 渲染与屏闪、中文 IME 输入法、高 DPI、Windows `Ctrl`/`Alt` 快捷键映射
3. **承载重负载**——可以造几万张卡的极端账号，用户自己机器上不敢造

**你不需要改产品功能**。你的产出是「测试结果 + 问题清单 + 截图」，不是 `bridge/` 或 `frontend/src/` 的代码补丁。

## 前置条件（人工确认一次）

| 项 | 要求 | 检查方式 |
|---|---|---|
| Anki | **26.09.4 及以上**桌面版（`min_point_version: 260904`） | 能正常打开与退出 |
| Python | 3.10 及以上 | `python -V` 或 `py -3 -V` |
| Git | 任意较新版本 | `git --version` |
| Node.js（强烈建议） | 20+，跑前端单测 / Bundle 审计 / Worker 测试 | `node -v`；缺失时仍可跑完整后端冒烟、Python 单测与 24 项静态审计 |
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

> v1.5.4 已修复此前 r5 报告中的 Windows 工具链兼容问题：仓库目录无需再叫 `anki_modern_os`（已改为 `_addon_bootstrap.py` 按路径加载），崩溃恢复单测也不再硬依赖 POSIX `SIGKILL`，Node 守卫已统一做 CRLF 归一化。现在所有测试套均可在默认 Windows `core.autocrlf=true` 环境下**直接运行**。

### 3.1 隔离场景后端冒烟（在 `tests\scenarios\`）

```powershell
python smoke.py
```

期望输出 **`705 项检查全部通过（11 个场景）`**，0 `FAIL`。允许出现 **3 条**「已知缺陷」提示，它们不算失败：

| 标签 | 含义 |
|---|---|
| `vacation:type-normalized` | 极端 `due` 下 Anki 框架会规范化 `type/queue` |
| `duplicate:skip` | 首次查重用的笔记正文去标签后为空，该分支未覆盖 |
| `vacation:rescue-skip` | 场景里没有到期的复习卡，减负与低能量分支未覆盖 |

重点守卫覆盖项（出现任何 `FAIL` 即为阻断或回归项，记录场景名与详情，**不要改产品代码让它变绿**）：

| 标签前缀 / 项 | 断言内容 |
|---|---|
| `sort:*` | 七种排序（失误降序/间隔升降/到期/稳定度/正面/最新）总数不变、顺序严格单调 |
| `custom-study:*` | 四种预设预览计数 `min(limit, totalMatched)`、预设卡片语义一致、全库调度零 diff、7 色旗标校验 |
| `occlusion:frontHtml` / `native-io:*` | 自定义与原生 Image Occlusion 静态渲染底图 `file://`、遮罩样式、多 group 隔离与标题兜底 |
| `media:audio-side-split` | `media` 场景带 `[sound:...]` 卡片提取到 `frontAudioFiles`，且不重复污染 `backAudioFiles` |
| `get_preferences` / `preferences:*` | 主题、正/背面音频自动播放双开关、画幅宽度与缩放配置齐全且读写往返一致 |
| `debug-info` | `get_card_debug_info` 返回卡片/笔记/模板/原生渲染及 `configSnapshot` 运行环境快照 |
| `editor:companion-cloze` | `exam` 场景普通卡添加 `{{c1::...}}` 后自动派生 `(Cloze)` 伴生卡型，原卡型其余卡不受影响 |
| `vacation:*` / `rescue:*` | 开启休假 / 应急减负与撤销还原后全库逐卡零 diff |

### 3.2 前端静态审计（仅需 Python，在 `tests\scenarios\` 或仓库根）

```powershell
python frontend_audit.py
```

期望输出 **`24 项前端静态审计全部通过`**。检查内容包括：
- `domTarget.ts` 鸭子类型防御、`ReviewerView` 与 `windowDrag` 走 helper、外部无裸 `.closest(`、构建产物含防御逻辑；
- 挖空序列化 `wysiwygField.ts` 走 `innerHTML`（不丢失 `<b>`/`<img>`）；
- `editorTable.ts` 表格表头不混入 `isDark`（防止原生白底黑底黑字）；
- 统一 `<Tooltip>` / `<HoverCard>` / `useFloatingPosition` 具备 `typeof document` SSR 守卫、无未迁移原生 JSX `title=` 属性（仅 `<iframe>` 例外）、`index.css` 含 `--tooltip-bg` / `--z-tooltip` 令牌。

### 3.3 Python 单元测试（在仓库根目录）

```powershell
cd <repo>
python -m unittest discover -s tests -p "test_*.py"
```

期望 **`Ran 150 tests ... OK`**（覆盖 Bridge 契约、伴生 `(Cloze)` 转换、卡片安全锁与崩溃恢复、Patch 健康自检、Release 安全门禁、以及 Windows `TestResizeFilterGeometryGuard` 几何过滤回归）。

### 3.4 Node.js 前端单测、Worker 测试与 Bundle 审计（在仓库根目录，需 Node 20+）

若本机首次跑前端套且还没有 `frontend\node_modules`，先安装一次依赖（仅安装，不改业务代码）：

```powershell
cd <repo>\frontend
npm install
cd ..
```

随后依次运行：

```powershell
node tests/frontend/run.mjs
node tests/test_analytics_worker.mjs
node tests/test_frontend_bundle.mjs
```

期望结果：
1. `tests/frontend/run.mjs`：**`ALL 126 CHECKS PASSED`**（覆盖 `domTarget`、挖空分组/胶囊、`editorTable` 对比度、`ioRects`、IO 只读策略、`cardDebugInfo`、`learningTips` 40 条校验、`reviewAudio` 双开关与回退规则、`<Tooltip>`/`<HoverCard>`/`SyncStatusPill` SSR 渲染）。
2. `tests/test_analytics_worker.mjs`：**`19 passed, 0 failed`**（校验 Worker UA 白名单、`/dashboard` 语法安全、`/v1/stats` 503/401/200 令牌校验）。
3. `tests/test_frontend_bundle.mjs`：**`ALL CHECKS PASSED!`**（覆盖 Item #1～#49 护栏与 16 语种词典一致性）。
   > **提示**：`Item #34` 会校验仓库根目录是否存在 `anki_modern_os.ankiaddon`。在干净 `git clone` 仓库里默认没有打包产物；如需让该守卫过打包存在性检查，可结合第五步打包验证一起执行（先确认干净 `config.json` 模板说明），**不要**因为 `.ankiaddon` 还没打而误判产品代码失败。
4. （可选）若机上有 Chrome：`python tests\frontend\run_browser.py`（跑 8 项编辑器 DOM 往返；未检测到 Chrome 时自动跳过）。

---

## 第四步：启动界面与 Windows 专项人工验收（共 25 项）

> 每次启动前先退出任何运行中的主 Anki（Anki 单实例锁限制）。`run.py` 会自动把当前仓库源码（含 `web/` 构建产物）同步到 `%USERPROFILE%\Anki-Test-Env\base\addons21\anki_modern_os`，关掉 Anki 窗口后脚本才返回。

建议按场景依次启动核对，截图统一存 `tests\reports\screenshots\r6\`（**新建目录，不要覆盖 `r3\` / `r4\` / `r5\` 历史截图**）：

### 一、核心主力场景：`python run.py exam`（覆盖 A–D 组共 22 项）

#### A 组：基础路径与跨平台基线（7 项）
- [ ] **A1 首页与字形**：首页牌组列表、今日圆环、26×7 热力图与 40 条底部学习小贴士正常加载；中英文与数学公式无豆腐块，英雄卡连胜为「主题橙数字 + 右侧双层火苗与柔和暖光晕」（无糊开橙雾），顶栏搜索框仅有放大镜与文字（**无 `Ctrl K` 角标**）。
- [ ] **A2 卡片库搜索与排序**：搜词响应准确；最右侧无边框「排序」下拉展开不溢出右侧视口，切「到期最早」顺序真实反转；选中状态筛选条件后「匹配 N 张」旁出现分隔竖线，清空筛选后竖线消失。
- [ ] **A3 复习评分流程**：开卡 → 翻面 → 评分（至少评 2 张并测试一次撤销 `Ctrl+Z`），卡数与复习日志实时更新，无 Anki 26 `start_timer` 静默失败。
- [ ] **A4 统计页动效与图表**：统计页 6 块面板依次错峰平滑进场，完成后无残留位移或浮层遮挡；图表中所有数字正常、无 `NaN`。
- [ ] **A5 深浅与 OLED 切换**：依次切换 Light / Dark / OLED 纯黑及换强调色后重启/切页，卡片正文、挖空胶囊、浮窗与文字保持清晰可读。
- [ ] **A6 窄屏与高 DPI 适配**：缩窄 Anki 窗口或切换系统 DPI 缩放（如 100% / 125% / 150%），侧边栏、Gallery 列数自适应重排，按钮与热区不错位。
- [ ] **A7 快捷键平台文案**：打开「设置 → 快捷键」、`Ctrl+K` 面板及制卡编辑器 placeholder，确认全部显示 `Ctrl` / `Alt`，**不得出现 macOS 的 `⌘` / `Option`**。

#### B 组：Windows QtWebEngine 专项：防屏闪、中文 IME 与事件防御（5 项）
- [ ] **B1 窗口拖拽与缩放防闪白**：拖拽沉浸式标题栏移动、双击标题栏最大化/还原、拖动边缘缩放窗口大小——无崩溃、无白屏闪烁、WebView 几何边界贴合窗体无黑边或溢出。
- [ ] **B2 非 Element `event.target` 防御**：在复习界面刻意先点一下背景空白处，再按 `Space` 翻面、`1–4` 评分——正常生效，控制台（若挂调试器）无 `closest is not a function` 报错。
- [ ] **B3 Windows 编辑器与中文输入法（IME）防屏闪**：打开已有卡片或多字段卡片编辑弹窗，切换 **Windows 微软拼音 / 常用中文 IME** 连续打字、选词上屏、鼠标拖选片段加粗/高亮/切换 `c1`/`c2`：工具栏按钮与弹窗阴影**不频繁闪白重绘**、**不吞 IME 候选词与光标**；在多字段编辑器把某扩展字段首字输入或清空末尾字符，不会触发编辑区意外重挂载。
- [ ] **B4 编辑器内部快捷键与层级 `Esc`**：在输入框聚焦时按 `1–4`、`Space`、`E` 只输入字符、不误触发答题；点开工具栏表情面板（5×4 无 overflow 裁切）插 ⭐ 后再打开面板按 `Esc`，仅关子面板不关整个制卡弹窗；再按 `Esc`（无未保存修改直接关；有修改弹未保存确认）。
- [ ] **B5 卡片库 Gallery 交互边界**：hover 卡片约 220ms 整卡翻转；点背面标签直接按该标签筛选；卡片正文与图片内链接不可点跳转；单击卡片空白不直接打开编辑器，仅点击背面「编辑」按钮才进入；开启多选模式后卡片保持正面不翻转。

#### C 组：v1.5.1–v1.5.8 核心特性验收（6 项）
- [ ] **C1 深色模式下插入表格与预览**：在编辑器切换深色模式时插入一张表格，再切回浅色模式 / 打开右侧「预览」，表头始终为浅底深字高对比度（非黑底黑字）。
- [ ] **C2 普通卡加挖空 → 伴生 `(Cloze)` 卡型**：挑一张普通 `Basic` 卡点编辑，在正文加上 `{{c1::关键词}}`——确认左下角显示待保存转挖空提示；保存后该单条笔记迁入 `... (Cloze)` 伴生卡型，**同卡型其他普通卡不变**；打开卡片库已有挖空卡点编辑并切「预览」，默认能正常看 `[...]` 遮罩与切 `c1/c2`（不直接剧透答案）。
- [ ] **C3 复习与沙盒挖空胶囊样式**：在浅色、深色与 OLED 模式下查看普通挖空卡和自定义模板挖空卡的正背面，确认 `[...]` 与答案绿色胶囊对比度清晰、非当前挖空序号前后无多余空白错位。
- [ ] **C4 学习模式大图灯箱（Lightbox）**：单击复习卡片中的图片（或遮挡图、兼容沙盒图片）——打开全屏灯箱；测试光标处滚轮缩放、左键拖拽漫游、双击切换倍率、`Esc` 关闭；确认**双击卡片图片不会误触发打开卡片编辑器**。
- [ ] **C5 学习页视图双维调节（`Aa`）**：点击学习页顶栏 `Aa` 弹窗，切换「画幅宽度」（`智能宽屏 / 标准 580 / 宽屏 840 / 超宽 1120`）与「内容缩放」（`90% / 100% / 115% / 130% / 150%`），测试 `Ctrl + = / -` 缩放与 `Ctrl + Shift + 0` 恢复默认（同时确认 `Ctrl + 0` 仍能清除旗标）；放大到 `150%` 时内容不覆盖顶栏与底部答题坞，且重启 Anki 后偏好保留。
- [ ] **C6 卡片详情抽屉 `•••` → 复制调试信息**：在复习页点右上角 `•••` 打开详情抽屉，点击底部「复制调试信息」按钮，2 秒内出现绿色对勾与 Toast 提示；粘贴到记事本核对内容包含 `[Summary]`、`modelType`、`activeTemplate`、`qfmt/afmt`、原始 HTML 标签未剥离、Windows OS/Qt/Python 版本及 `patchHealth`。

#### D 组：v1.5.9 与最新版本重点验收（4 项）
- [ ] **D1 统一悬浮提示 `<Tooltip>` 与 `<HoverCard>`**：悬停复习顶栏按钮、编辑器工具栏、设置项及同步胶囊，均显示与当前主题一致的定制浮层；将弹窗或按钮移至窗口右/下边缘时浮层自动避让不溢出屏幕；全界面悬停不再出现 Windows/Chromium 原生黑色/白色 `title` 默认气泡。
- [ ] **D2 英文界面同步胶囊（`SyncStatusPill`）文字下沉防裁切**：在「设置 → 语言」临时切换为 `English`，检查首页右上角同步胶囊（未同步状态或 `Last synced · ...`）：云朵图标、状态文本与 `g`/`y`/`p` 等字母下沉部显示完整，**不被底边齐平裁掉**；鼠标悬停同步胶囊弹出快照浮卡；测完切回简体中文。
- [ ] **D3 「设置 → 答题设置」音频自动播放双开关**：确认包含「显示正面时自动播放」（默认关闭）与「翻面显示答案时自动播放」（默认开启）两个独立开关，且改动后关闭再重启 Anki 仍记忆上次配置。
- [ ] **D4 学习页顶栏分体式音频控制与模态 `Esc` 隔离**：在复习界面分别打开「设置」弹窗、`Ctrl+K` 全局搜索和编辑弹窗，按下 `Esc` **仅关闭当前最顶层弹窗，不退出复习页**；观察顶栏音频控制按钮形态——当前面有音频时显示 `[🔊 朗读 | ⚙]` 一体式分体胶囊，无音频时收敛为紧凑小喇叭图标触发器，点 `⚙` 气泡可即时切换正/背面开关、查看回退说明并一键跳转「设置 → 答题设置」。

### 二、媒体与真音频专项：`python run.py media`（1 项）
- [ ] **M1 媒体渲染与音频自动播放实测**：确认卡片库与复习页里的 `.png` 图片在 Windows `file:///C:/...` 路径下完整加载、无破图；在卡片库按 `sound` 或浏览队列找到含 `[sound:audio_01.mp3]` 的卡片进入学习，确认正面显示 `[🔊 朗读 | ⚙]`。
  > **提示**：`media` 场景内置的 `audio_01.mp3` 为占位空音频（仅验证路径与按钮状态）。若要真耳验证声音播放、双开关回退与切卡打断：请在测试库临时**新建 2 张带真实小段 `.mp3` 音频的卡片**（卡片 1「仅正面有音频」、卡片 2「正反面各有不同音频」），实测：① 正面开关关时不自动播、开则一出现正面即播；② 仅正面有音频 + 开启翻面开关时，翻面会自动回退重播正面音频一遍；③ 音频正在播放时瞬间按评分切下一张卡，**旧音频立即中断不串音**。

### 三、图片遮挡只读策略专项：`python run.py io-native` 与 `python run.py occlusion`（1 项）
- [ ] **I1 IO 创作入口收口与只读预览**：
  - 点「新建卡片 → 卡型下拉」：**看不到 `Image Occlusion`**，编辑器工具栏也没有图片遮挡创作按钮；
  - 在 `io-native`（及 `occlusion`）打开一张已有遮挡卡点编辑：弹窗**默认直接落在「预览」态**、顶部显示仅支持预览与复习提示、隐藏保存按钮、按 `Esc` 直接关闭；列表与复习中图片底图（`file:///C:/...`）和遮挡色块位置精准对齐（不再出现裸 SVG 或 `{{c1::...}}` 源码）。

### 四、七色旗标专项：`python run.py mixed`（1 项）
- [ ] **F1 卡片库旗标筛选与设置**：在「旗标」下拉中可见 7 种颜色及各自准确计数，选定某色后列表仅展示对应旗标卡片；复习页旗标弹窗与 `Ctrl+1..7` / `Ctrl+0` 正常。

---

## 第五步：重负载与干净环境打包检验（建议做）

### 5.1 重负载压力检验（`power` 20,000 卡）
临时将 `tests\scenarios\scenarios.py` 里 `power.total_cards` 改为 `20000` 并 `python build.py power`，启动 `python run.py power` 记录首页、卡片库搜索、统计页的冷启动/交互流畅度与耗时；测完务必还原测试场景并清回默认 3020 卡：

```powershell
cd <repo>
git checkout -- tests\scenarios\scenarios.py
cd tests\scenarios
python build.py power
```

### 5.2 `.ankiaddon` 打包脚本跨平台验证（可选）
> 若需验证 GitHub 干净环境能否正确调用 Windows `npm.cmd` 并产出安装包：

1. 查看 `scripts/build_ankiaddon.py` 是否可按 `shutil.which("npm")` 与 `os.pathsep` 正常驱动 Vite 构建。
2. **注意**：目前 `scripts/build_ankiaddon.py` 的 `TOP_LEVEL_FILES` 仍会在写入 ZIP 前检查仓库根目录是否存在 `config.json`（该文件已在 `.gitignore` 中，干净 clone 默认缺失，直接运行会报 `FileNotFoundError`）。验证打包 payload 时可先临时执行 `Copy-Item config.default.json config.json`，再跑 `python scripts\build_ankiaddon.py --skip-build`，核对根目录与 `%USERPROFILE%\Downloads\anki_modern_os-v*.ankiaddon` 产物（顶层文件、无 `__pycache__`/私人字段、`manifest.json` 的 `mod` 与 `human_version`），测完删掉临时 `config.json` 与 `.ankiaddon` 保持工作区干净。若已装好 Node，也可顺带跑一遍 `node tests/test_frontend_bundle.mjs` 确认 `Item #34` 通过。

---

## 第六步：回写验版报告与截图

在 `tests\reports\` 新建 `windows-<YYYYMMDD>.md`（或 `-r6.md`），模板如下：

```markdown
# Windows 验版报告 <日期>

## 环境
- Windows 版本 / 分辨率 / DPI：
- Anki 版本 / Qt / Python / Node / Git：
- 仓库 commit：
- 沙盒目录：%USERPROFILE%\Anki-Test-Env（确认未写入真实 %APPDATA%\Anki2）

## 自动化回归结果
- build.py --all & --verify-repro exam：通过 / 失败
- smoke.py：705/705 通过（11 个场景，3 条已知豁免）/ 失败 n 项
- frontend_audit.py：24/24 通过 / 失败 n 项
- python -m unittest discover -s tests -p "test_*.py"：150/150 OK / 失败 n 项
- node tests/frontend/run.mjs：126/126 PASSED / 未跑或失败
- node tests/test_analytics_worker.mjs：19/19 passed / 未跑或失败
- node tests/test_frontend_bundle.mjs：ALL CHECKS PASSED / 未跑或失败

## 界面与 Windows 专项验收（22 + 3 = 25 项）
- A 组基础基线（7 项）：
- B 组 Windows 专项防闪/IME/事件（5 项）：
- C 组 v1.5.1–v1.5.8 核心特性（6 项）：
- D 组 v1.5.9+ 音频/英文胶囊/浮层（4 项）：
- M1 媒体与真音频 / I1 IO 只读 / F1 7 色旗标（3 项）：
- （注：打包检查与重负载结果附后）

## 发现的问题
1. <现象> | <复现步骤> | <截图文件名> | <是否阻断发布>

## 与 macOS 的差异
<字体、DPI 缩放、QtWebEngine/IME 表现、file:/// 路径、音频驱动、快捷键等观察>
```

提交报告与截图时仅纳入报告与新轮次截图目录：

```powershell
git add tests/reports
git commit -m "test(windows): verification report <日期>"
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
| `test_frontend_bundle.mjs` 提示缺 `.ankiaddon` | 干净 clone 默认无产物文件 | 见第五步 5.2 用临时 `config.default.json` 打包后复跑验证 |

## 绝对不要做的事

- **不要**把测试指向真实的 Anki 数据目录 `%APPDATA%\Anki2`。沙盒固定 `%USERPROFILE%\Anki-Test-Env`。
- **不要**为了「让测试变绿」修改 `bridge/`、`frontend/src/` 或业务代码。
- **不要**用 `git push --force`。
- **不要**跳过截图。Windows 特有的字体抗锯齿、DPI 裁切、QtWebEngine 闪烁与 IME 重影必须靠实机截图留证。
- **不要**忘记还原 `scenarios.py` 的重负载临时改动与删掉临时打包用的 `config.json`。

## 参考

- 沙盒与场景总览：[tests/scenarios/README.md](scenarios/README.md)
- 场景配方定义：[tests/scenarios/scenarios.py](scenarios/scenarios.py)
- 自动化后端冒烟：[tests/scenarios/smoke.py](scenarios/smoke.py)
- 前端纯 Python 静态审计：[tests/scenarios/frontend_audit.py](scenarios/frontend_audit.py)
