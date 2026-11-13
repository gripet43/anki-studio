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

## [v1.4.19] - 2026-11-13

- **[DeepSeek] 离开复习界面时停止音频播放**（改 [`bridge/review_service.py`](bridge/review_service.py)、[`bridge/router.py`](bridge/router.py)、[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts)、[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)；[`tests/test_general_fixes.py`](tests/test_general_fixes.py) 新增 4 项回归）：
  - **现象**：卡片正面/背面音频（较长时）播放中返回首页，声音继续播放。
  - **根因**：音频由 Anki 的 `aqt.sound.av_player` 播放，与前端组件生命周期无关；退出复习只切换了界面，从未下发停止指令。
  - **修法**：新增 `stop_audio` 后端 action（优先 `av_player.stop_and_clear_queue()`，回退 `av_player.stop()` / `aqt.sound.stop()`）；前端在 `exitReview()`、`setActiveTab()` 离开复习、答题切下一张时调用，并在 `ReviewerView` 卸载时兜底停止。
  - **验证**：Python 115 项（新增 4 项停止音频回归）、`tsc --noEmit`、前端单元 63 项、Bundle 审计、隔离场景冒烟 692/692、打包全绿。版本 1.4.18 → 1.4.19。

## [v1.4.18] - 2026-11-13

- **[DeepSeek] 复习完成提示按会话范围区分：单牌组显示「当前牌组」，全牌组才显示「今日全部」**（改 [`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx) 及 16 种语言字典）：
  - **现象**：只复习完一个牌组时，完成弹窗写「恭喜完成今日牌组复习！」，容易被理解成「今日所有牌组都学完了」。
  - **修法**：按 `reviewScopeDeckId` 区分——单牌组会话用新文案「恭喜完成当前牌组复习！」/「当前牌组所有到期卡片均已完成 FSRS 间隔重算…」；只有首页「开始今日学习」（scope = `'all'`）才用「恭喜完成今日全部复习！」。
  - **验证**：`tsc --noEmit`、前端单元 63 项、Bundle 审计、Python 111 项、隔离场景冒烟 692/692、打包全绿。版本 1.4.17 → 1.4.18。

## [v1.4.17] - 2026-11-13

- **[DeepSeek] 复习会话按批续学：进度跨批累计 + 「本批完成，继续下一批」提示**（改 [`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)、[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts) 及 16 种语言字典）：
  - **先澄清 100 的语义**：单批 100 张是 IPC 传输批量（后端 `limit` 默认 100），**不是每日上限**；每天实际可学多少由 Anki 调度器决定（新卡/复习限额、learn-ahead、兄弟卡埋没）。超过 100 张时会自动续批，50/150/300 都一样。
  - **续批不再静默跳回 1/100**：进度改为跨批累计（例如第一批学完后显示 `101 / 200`），并在批次衔接时弹出「本批 100 张已完成，继续下一批」；只有调度器真的返回空才显示「恭喜完成今日牌组复习！」——不会把「100 张学完」误报成「今日学完」。
  - **验证**：150 张新卡的合成集合上，batch1 = 100，全部答完后重新取队列非空（成功续批）；Python 111 项、`tsc --noEmit`、前端单元 63 项、Bundle 审计、隔离场景冒烟 692/692、打包全绿。版本 1.4.16 → 1.4.17。

## [v1.4.16] - 2026-11-13

- **[DeepSeek] 修复复习会话「首页 360 张却只学 20 张就显示今日完成」+ 学习步卡片丢失**（改 [`bridge/review_service.py`](bridge/review_service.py)、[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts)、[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)；[`tests/test_general_fixes.py`](tests/test_general_fixes.py) 新增 5 项回归）：
  - **根因 1（首页与会话口径不一致）**：首页「开始今日学习」之前只启动 `decks[0]`（第一个牌组）的会话，而首页数字是全部牌组汇总，于是出现「首页 360 张、会话只有 20 张」。
  - **根因 2（学习步卡片被丢掉）**：会话队列是启动时的一次性快照；答完最后一张就直接判「今日完成」，但刚答完的卡还处在 1m / 10m 学习步，Anki 的 learn-ahead 会把它们放回调度器队列（原生界面会继续考）——我们没再问调度器，于是误报完成，首页也看不到待复习的 17 张。
  - **修法**：`get_review_queue(deckId="all")` 跨全部顶层牌组逐个取 Anki 原生队列（每日限额、learn ahead、兄弟卡埋没都交给调度器）并合并去重，取完恢复原来的当前牌组；首页「开始今日学习」改传 `'all'`；队列耗尽时先等 `answer_card` 落库，再调用 `start_review` 重新取队列——有卡就续上（`isSessionComplete=false`），只有调度器真的返回空才显示「今日已完成」。
  - **验证**：真实集合副本上「全部牌组」队列 = 各顶层牌组 pending 之和（42 = Default 18 + 错题 24）；全新集合上答完唯一新卡（Good → 10 分钟学习步）后重新取队列仍返回该卡，不再误判完成。Python 111 项（新增 5 项聚合队列断言）、`tsc --noEmit`、前端单元 63 项、Bundle 审计、隔离场景冒烟 692/692、打包全绿。版本 1.4.15 → 1.4.16。

## [v1.4.15] - 2026-11-13

- **[DeepSeek] 首页牌组区入口文案「全部牌组管理」精简为「牌组管理」**（改 [`frontend/src/i18n/translations.ts`](frontend/src/i18n/translations.ts)、[`frontend/src/i18n/locales/zh-TW.ts`](frontend/src/i18n/locales/zh-TW.ts)）：该入口只是切换到牌组页签，没有「全部 / 部分」的筛选语义；其他语言（Manage Decks / デッキ管理 …）本来就没有这层冗余，简繁中文对齐。
  - 验证：`tsc --noEmit`、前端单元 63 项、Bundle 审计、Python 106 项、打包全绿。版本 1.4.14 → 1.4.15。

## [v1.4.14] - 2026-11-13

- **[DeepSeek] 移除「卡片信息」面板底部多余的「切回原生」按钮**（改 [`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)）：该入口与三层防迷失机制（`Ctrl+Opt+M` / `Ctrl+Alt+M` 快捷键、工具菜单、原生工具栏胶囊）完全重复，放在卡片检查器底部既占空间又容易误触。移除后原生兜底入口一个不少。
  - 验证：`tsc --noEmit`、前端单元 63 项、Bundle 审计、Python 106 项、隔离场景冒烟 692/692、打包全绿。版本 1.4.13 → 1.4.14。

## [v1.4.13] - 2026-11-13

- **[DeepSeek] 修复兼容模式图片全部破图：QtWebEngine 默认禁止 file:// 页面加载本地媒体服务**（改 [`__init__.py`](__init__.py)、[`tests/test_general_fixes.py`](tests/test_general_fixes.py)；README / DESIGN 计数同步）：
  - **现象**：同一张图卡在默认模式正常显示，切到「兼容模式」后图片变成破图（Track B 沙盒 iframe 里所有媒体都加载失败）。
  - **根因**：沙盒 iframe 为了隔离模板脚本使用 `sandbox="allow-scripts"`（opaque origin），媒体只能走 Anki 本地媒体服务 `http://127.0.0.1:<port>/...`；而插件 SPA 是用 `file://` 加载的，QtWebEngine 默认 `LocalContentCanAccessRemoteUrls = false`，会在引擎层直接拦截该请求。默认模式媒体是 `file://`，所以不受影响——正好对上「默认正常、兼容模式破图」。
  - **修法**：创建 WebView 时显式开启 `LocalContentCanAccessRemoteUrls` 与 `LocalContentCanAccessFileUrls`。用 Anki 自带 PyQt6 + 真实媒体服务探针验证：开启前 sandbox / 普通 img 的 `naturalWidth=0`，开启后全部为 `611`（同时确认不会因 `Origin: null` 被媒体服务拒绝——实际 `<img>` 请求不带 Origin）。
  - **验证**：Python 106 项（新增 1 项入口配置守卫）、`tsc --noEmit`、前端单元 63 项、Bundle 审计、隔离场景冒烟 692/692、打包全绿。版本 1.4.12 → 1.4.13。

## [v1.4.12] - 2026-11-13

- **[DeepSeek] 新增真实 .apkg 卡组显示兼容性测试（17 个 AnkiWeb 排名卡组）+ 修复 @charset 导致的模板 CSS 作用域失效**（新增 [`tests/apkg/`](tests/apkg/README.md)（`run.py` / `render_check.mjs` / `decks.json` / `known_issues.json`）；改 [`bridge/media_utils.py`](bridge/media_utils.py)、[`tests/scenarios/gate.sh`](tests/scenarios/gate.sh)、[`tests/test_general_fixes.py`](tests/test_general_fixes.py)、[`README.md`](README.md)、[`docs/DESIGN_AND_DEV_GUIDELINES.md`](docs/DESIGN_AND_DEV_GUIDELINES.md)）：
  - **测试框架**：每个 `.apkg` 导入临时隔离 collection（不碰真实数据），按卡型抽样走 `ReviewService` / `SearchService` 真实序列化管线，再由 Node 端用界面同一个 `renderMathAndRichHtml` 渲染抽样 HTML。断言覆盖空卡面、`<script>` / `[sound:]` / 模板占位符残留、图片相对路径、公式实体、正反两面 `display:none` 语义、搜索接口正/背面样式下发等。17 个卡组约 16 秒；卡组文件不随仓库分发（默认 `~/Downloads`，可用 `--dir` / `ANKI_STUDIO_APKG_DIR`），缺失时 SKIP 不失败；`gate.sh --with-apkg` 可并入场景门禁。
  - **修复真实 bug**：`scope_card_css` 遇到以分号结束的 at-rule（`@charset` / `@namespace`）时，会把后面的第一个选择器粘成 at-rule 前缀，导致该规则既不作用域化、也不参与「背面揭开隐藏」。JLPT10k 的模板 CSS 首行正是 `@charset "UTF-8";`。新增状态机区分「选择器区 / 声明区」，并补 2 项 Python 回归。
  - **断言口径修正**：公式里的 `&gt;` / `&nbsp;` 属于前端可解码实体，不再误报；`display:none` 只认声明区，不误报 `[style*='display: none']` 这类选择器。
  - **已知限制（可追踪）**：mhchem `\ce{}`、`\overline` / `\underset` / 嵌套 `\sqrt` 尚未支持（自研迷你 LaTeX 渲染器），记录在 `known_issues.json`，命中降级为 `[WARN]` 并打印原因。彻底解决需改用 KaTeX（含 mhchem 扩展）。
  - **验证**：17 个真实卡组 0 失败（2 个已知限制 WARN）；Python 105 项、`tsc --noEmit`、前端单元 63 项、Bundle 审计、隔离场景冒烟 692/692、打包全部通过。版本 1.4.11 → 1.4.12。

## [v1.4.11] - 2026-11-13

- **[DeepSeek] 修复数学公式里的 HTML 实体字面量（`&nbsp;`），并让 LaTeX 函数名按规范正体渲染**（改 [`frontend/src/utils/mathRenderer.ts`](frontend/src/utils/mathRenderer.ts)；新增 [`tests/frontend/specs/mathRenderer.spec.ts`](tests/frontend/specs/mathRenderer.spec.ts) 5 项断言）：
  - **现象**：PCSI 法语数学卡组的公式显示成字面量 `&nbsp;sin(π/2 - t )`（字段原文是 `[$]&nbsp;sin(\frac{\pi}{2} - t )[/$]`），且 `sin` / `cos` 跟着变量一起斜体。
  - **根因**：`formatLatexExpression` 先对公式做 HTML 转义（`&` → `&amp;`），再塞进 `dangerouslySetInnerHTML`；字段里的 `&nbsp;` 因此变成 `&amp;nbsp;` 被原样显示。
  - **修法**：新增 `decodeMathEntities()`，先把 `&nbsp;` / `&amp;` / `&lt;` / `&gt;` / `&quot;` / 数字实体解码，再统一转义；同时把 `\sin`、`\cos`、`\log`、`\lim` 等 LaTeX 函数名渲染成 `not-italic` 正体。
  - **覆盖范围**：复习、Cmd+K、编辑器、卡片库摘要共用同一个 `renderMathAndRichHtml`，一处修复全部生效。
  - **验证**：前端单元套件用该字段原文断言「不再含 `&nbsp;` 字面量、`π` 与分数结构正确、`\sin` 正体」；前端 63 项、Python 103 项、`tsc --noEmit`、Bundle 审计、隔离场景冒烟 692/692、打包全绿。版本 1.4.10 → 1.4.11。

## [v1.4.10] - 2026-11-13

- **[DeepSeek] 卡面正面 / 背面样式彻底分离：搜索预览与编辑器一并修复（通用问题，不是单卡包）**（改 [`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py)、[`frontend/src/components/search/CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx)、[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts)、[`docs/DESIGN_AND_DEV_GUIDELINES.md`](docs/DESIGN_AND_DEV_GUIDELINES.md)；[`tests/test_general_fixes.py`](tests/test_general_fixes.py) 新增 1 项并强化既有断言）：
  - **普遍性实测**：本机 collection 的 36 个卡型里 **10 个**（16,411 / 66,256 张卡，约 **25%**）在正面使用 `display:none` 或 `{{hint}}` 隐藏内容：JLPT10k（10,641）、双类型文法卡组（3,241）、UVBasic-English（997）、Ultimate Geography（978）、Cloze Overlapping（463）等。所以这是通用缺陷，不是柯林斯 / 考研英语某个卡包的问题。
  - **修法（正反双作用域）**：`render_native_card_sides` 现在产出两份作用域 CSS——背面 `.anki-native-card`（`reveal_hidden=True`，揭开隐藏段落）与正面 `.anki-native-card-front`（`reveal_hidden=False`，保留 `display:none`）；`wrap_card_with_styles(..., front=True)` 的正面容器同时挂两个类。两面同屏（Cmd+K 预览）时 display 规则互不覆盖。
  - **搜索 / 预览**：`search_cards` 新增 `cardFrontStyles`（按卡型去重）；`useAppStore` 新增 `cmdKFrontCardStyles` / `libraryFrontCardStyles`；Cmd+K 右侧预览与编辑器预览都改为按面选 CSS（正面保留隐藏、背面揭开）。
  - **规则化**：DESIGN 手册新增红线——任何新增卡面渲染面都必须按面取样式，禁止正反共用一份 CSS。
  - **验证**：真实 collection 上 UVBasic-English 正面 CSS 含 `.anki-native-card-front #ext_collins{display:none}` 且背面不含 `display:none`；Python 103 项、`tsc --noEmit`、前端单元 58 项、Bundle 审计、隔离场景冒烟 692/692、打包全绿。版本 1.4.9 → 1.4.10。

## [v1.4.9] - 2026-11-13

- **[DeepSeek] 词库卡（柯林斯等）正面不再摊开模板默认隐藏的内容**（改 [`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)；[`tests/test_general_fixes.py`](tests/test_general_fixes.py) 新增 5 项断言）：
  - **现象**：`UVBasic-English`（考研英语真题生词 / 柯林斯）复习「`perceive`」这类卡时，原生正面只显示 单词 + 音标 + 真题原句 + 提示入口 + 柯林斯标题栏，Studio 却把 `{{hint::vocab简明}}` 的内容和 `#ext_collins`（柯林斯详解）整段摊在正面。
  - **根因**：模板用 CSS `#ext_collins{display:none}` 与 `{{hint}}` 的 inline `display:none` 把内容藏起来、靠点击/脚本展开。`scope_card_css(reveal_hidden=True)` 会删掉 `display:none`——那是给**背面**揭底用的策略；正面复用了同一份样式表，于是隐藏内容全部可见。
  - **修法**：`build_card_css` 新增 `reveal_hidden` 参数；`NativeRender` 新增 `question_css`；`render_native_card_sides` 同时产出「背面用（揭开隐藏）」与「正面用（保留隐藏）」两份作用域样式表；`sanitize_rendered_card_html` 新增 `reveal_hints` 控制 `{{hint}}` 是否保留 `display:none`。复习服务正面改用 `question_css`，背面逻辑不变。
  - **验证**：真实 collection 副本上该卡正面 CSS 含 `.anki-native-card #ext_collins{display:none}`、hint 保留 inline `display:none`，背面已揭开；Python 102 项、`tsc --noEmit`、前端单元 58 项、Bundle 审计、隔离场景冒烟 692/692、打包全绿。版本 1.4.8 → 1.4.9。

- **[DeepSeek] 构建脚本打包后自动复制到 `~/Downloads`**（改 [`scripts/build_ankiaddon.py`](scripts/build_ankiaddon.py)、[`README.md`](README.md)）：`python3 scripts/build_ankiaddon.py` 打包完成后会打印产物 SHA-256，并把 `.ankiaddon` 复制到 `~/Downloads/anki_modern_os.ankiaddon`（覆盖旧包），省去手工拷贝；`--no-downloads` 可关闭该行为，Downloads 不可写时只警告、不影响打包。发布说明已同步进 README。

## [v1.4.8] - 2026-11-13

- **[DeepSeek] 复习队列改用 Anki 原生 v3 调度器顺序（「同一张卡多出例句」的真凶）+ 沙盒开关文案改为「兼容模式」**（改 [`bridge/review_service.py`](bridge/review_service.py)、[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)、16 个 i18n 字典；[`tests/test_general_fixes.py`](tests/test_general_fixes.py) 新增 7 项队列断言）：
  - **1. 队列顺序与原生逐张一致**：用户反馈「同一个笔记，原生正面只有 1 条例句，Studio 却有 3 条」。用真实 collection 副本复现后确认**不是渲染错误**——Studio 对每张卡的 `frontHtml` 与原生 `card.render_output().question_text` 逐字一致；真凶是 `get_review_queue()` 用 `find_cards()` 自拼队列（card id 升序），而 Anki v3 调度器按 gather / sort order 给出的顺序不同。同一「蓝宝书」牌组下，Studio 先打开 Card 01（文法卡，正面 3 条例句），原生先打开 Card 02（例文卡，正面 1 条例句），用户看到的就是「同一张卡多了例句」。
    现改为：显式数字 `deckId` 时先调 `col.sched.get_queued_cards(fetch_limit)` 取 Anki 真实队列（含每日新卡/复习上限、兄弟卡埋没、筛选牌组顺序），再逐张序列化；`get_queued_cards` 不可用（旧 Anki / 测试桩）时回落旧逻辑；队列为空时**尊重每日配额**，不再回落成无限新卡；无 `deckId` 的旧调用保持整库语义。
  - **2. 沙盒开关文案**：复习界面右上角「原生切换」改为「兼容模式」，新增 i18n 键 `compatMode` 并同步 16 种语言；设置页快捷键说明里的「原生切换」语义不变。
  - **验证**：用真实 `测试账号` collection 副本对比，5 个牌组（ROOT / 文法 / 例文 / N1 叶子）首 8 张卡与 `get_queued_cards()` **逐张 MATCH**；Python 97 项、`tsc --noEmit`、前端单元 58 项、Bundle 审计、隔离场景冒烟 692/692、`npm run build` 与 `.ankiaddon` 打包全部通过。版本 1.4.7 → 1.4.8。

## [v1.4.7] - 2026-11-13

- **[Gemini] 根治背诵界面（`ReviewerView`）丢失模板样式的根因 + 落地 Track B 原生沙盒兼容模式（Anki 本地 HTTP 媒体服务 + `SandboxCardFrame`）并完成 8 大 `.apkg` 双轨全量实测**（[`frontend/src/utils/mathRenderer.ts`](frontend/src/utils/mathRenderer.ts)、[`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py)、[`bridge/deck_service.py`](bridge/deck_service.py)、[`bridge/router.py`](bridge/router.py)、[`frontend/src/components/reviewer/SandboxCardFrame.tsx`](frontend/src/components/reviewer/SandboxCardFrame.tsx)、[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)、[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts)、[`frontend/src/bridge/pycmd.ts`](frontend/src/bridge/pycmd.ts)、[`scripts/build_ankiaddon.py`](scripts/build_ankiaddon.py)、[`tests/test_bridge.py`](tests/test_bridge.py)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - **1. 定位并根治「编辑器预览有样式、背诵卡片页面却丢失样式」的三大根因（通用修复）**：
    - **真凶一（`mathRenderer.ts` 将 `<style>` 内的换行替换成 `<br/>`，导致整张样式表在 Chromium 中失效）**：编辑器预览直接将 `editingCardData.backHtml` 塞进 `dangerouslySetInnerHTML`，而 `ReviewerView.tsx` 会经过 `renderMathAndRichHtml(currentCard.backHtml)`。该函数末尾执行了 `html.replace(/\r\n|\r|\n/g, '<br/>')`，把 `scope_card_css` 输出在 `<style>...</style>` 里的每一个换行符都插进了 `<br/>`（变成 `<br/>.anki-native-card .connectiveTag{...}`），导致 Chromium CSS 解析器将所有带 `<br/>` 前缀的选择器当作语法错误直接丢弃！现修改 `renderMathAndRichHtml`：在处理前先提取并保护全部 `<style>...</style>` 块，且对含 `.anki-native-card` 的模板 HTML 禁用 `\n -> <br/>` 全局替换，处理完公式与挖空后再原样拼回 `<style>`。
    - **真凶二（问题面 `frontHtml` 此前只取单字段裸文本，丢弃了 `native.question` 模板结构与 CSS）**：此前仅 `backHtml` 走了 `native.answer` + `wrap_card_with_styles`，而 `frontHtml` 只取 `fields[front_key]` 裸文本，导致蓝宝书 `N1N2N3N4N5`（问题面含 `接続 ①` 与例句框）、`eggrolls-JLPT10k`、`Chinese Grammar Wiki` 等卡包在未翻面时丢失模板排版与样式。现统一在 `review_service.py` 与 `search_service.py` 中：只要 `native.question` 包含模板 HTML 结构且与正面字段匹配，即使用 `wrap_card_with_styles(native.question, native_back_css)` 完整保留问题面模板结构与样式（纯文本字段 `front` 仍保持干净词条供标题/TTS 使用）。
    - **真凶三（`ReviewerView.tsx` 外层容器 `whitespace-pre-wrap` 与固定大字号覆盖）**：当 `frontHtml` / `backHtml` 含 `anki-native-card` 时，自动移除外层容器的 `whitespace-pre-wrap` 与固定 `text-[30px] font-bold`，避免模板缩进变成空行或覆盖模板自身字号。
  - **2. 落地 Track B 原生沙盒兼容模式（最大兼容性方案）**：
    - **本地 HTTP 媒体管线（`get_media_http_base_url`）**：在 `media_utils.py` 中接入 `mw.mediaServer.getPort()`，新增 `render_sandbox_card_sides` 与 `build_sandbox_card_css`，将沙盒模式下的 `<img src>` 与 CSS `@font-face` / `url(...)` 统一改写为本地 HTTP URL，彻底解决 `sandbox="allow-scripts"`（无 `allow-same-origin`）下不透明 origin 无法加载 `file://` 字体与图片的问题。
    - **安全隔离沙盒组件（`SandboxCardFrame.tsx`）**：使用 `<iframe sandbox="allow-scripts" srcDoc={...}>`（严格不加 `allow-same-origin`，隔绝父页面 `window.pycmd` 特权桥），内置：① `window.pycmd` 白名单转发 shim（支持 `ans` 翻面、`ease1..4` 评分、`play:...` 音频重播）；② 翻面就地更新 `#qa` DOM 并重跑脚本（零白闪）；③ `ResizeObserver` + 图片 `load` 自适应高度回传；④ 焦点在 iframe 内时转发 `Space` / `Enter` / `1~4` 快捷键回父页面。
    - **按卡型（Note Type）一键切换并持久化记忆**：在 `ReviewerView.tsx` 顶栏新增原生沙盒模式开关按钮，通过 `toggle_notetype_sandbox` 按 `notetypeId` 写入 `sandbox_notetype_ids` 配置，一次选择永久记住。

- **[DeepSeek] 补前端测试盲区 + 新增运行时 patch 自检 + 同步文档**（新增 [`tests/frontend/`](tests/frontend/README.md)、[`bridge/compat.py`](bridge/compat.py)、[`tests/test_patch_health.py`](tests/test_patch_health.py)；改 [`bridge/router.py`](bridge/router.py)、[`__init__.py`](__init__.py)、[`README.md`](README.md)、[`config.md`](config.md)、[`docs/DESIGN_AND_DEV_GUIDELINES.md`](docs/DESIGN_AND_DEV_GUIDELINES.md)、[`tests/scenarios/README.md`](tests/scenarios/README.md)）：
  - **1. 前端单元套件 `tests/frontend/`（58 项，零新增依赖）**：现有门禁只有字符串审计，拦得住「护栏被误删」，拦不住「逻辑算错」。新增 `run.mjs` 复用 `frontend/node_modules` 里 Vite 已装的 esbuild，把 suite 打成 CJS 后由 Node 执行，`react-dom/server` 做叶子组件静态渲染，不需要 vitest/jsdom。覆盖：`themeTokens`（8 强调色 × 3 主题令牌与 CSS 变量契约、OLED/Dark/Light 明度序）、`deckPalette`（5 步轮转、首卡=品牌色、正负索引回绕、**色相偏移 ≤15° 不出族**、不改入参）、`mediaUrl`（编码只做一次、`http/data/blob/file://` 放行、`data-anki-media` 兜底、`<img>` 重写幂等、cloze/`[sound:]` 不被误伤）、`translations`（16 语言别名归一、`pref → Anki → browser` 回退链、RTL、快捷键跨平台、相对时间）、`render`（Logo / SyncStateIcon 四状态 / StreakFlameBackdrop 的静态渲染与 a11y 属性）。已做负向对照确认失败会以非 0 退出。
  - **2. 运行时兼容性自检 `bridge/compat.py`**：所有 patch 都是 `try/except` 包住的私有接口接管，失败时「不崩但静默降级」（用户只会看到原生黄 tooltip/进度弹窗回来了）。新增 `collect_health()` 汇总 Anki 版本（按 `int_version()` 口径换算并与 `manifest.json` 的 `min_point_version` 交叉校验）+ 4 个补丁 + 8 个生命周期钩子的生效状态，`state: ok|degraded`，逐条给出原因；`AnkiModernHost.refresh_patch_health()` 在 `initialize()` 末尾执行，降级时打印 `patch health` 报告，healthy 仅在 `debug_mode` 下打印；新增 IPC action `get_patch_health`（`BridgeRouter` 新增可选 `health_getter`，默认返回 `{}`，不破坏既有构造调用）。
  - **3. 测试**：`tests/test_patch_health.py` 共 20 项，覆盖版本换算边界（`26.09.4→260904`、`2.1.66→20166`）、缺失补丁/必需钩子必须 degraded 且点名、可选钩子缺失不降级、未知/过低版本、`format_health_summary`、Router action 三种情形（注入报告/默认空/health getter 抛异常仍返回结构化解），以及脱离 Anki 运行时 `refresh_patch_health()` 不抛异常。Python 单测 50 → **70**。
  - **4. 文档同步**：`DESIGN_AND_DEV_GUIDELINES.md` 版本对齐 v1.4.6、强调色由「4 套 + 旧色值」更正为代码真实的 **8 套**（`#3076C3` 经典蓝等，并指向 `themeTokens.ts` 为唯一真实源）、补上运行时自检规范、把门禁流水线扩到 6 步并写明「字符串审计 ≠ 算得对」；`README.md` 更新测试命令与兼容性表（新增「运行时自检」行）；`tests/scenarios/README.md` 更正 action 计数（48 个，8 个纯 UI 不适合无头，38/40 已覆盖，点名 `toggle_notetype_sandbox` 与 `get_patch_health` 两个缺口）；`config.md` 补记 `sandbox_notetype_ids`。
  - **验证**：`python3 -m unittest discover -s tests -p "test_*.py"` → 70 OK；`node tests/frontend/run.mjs` → 58 CHECKS PASSED；`node tests/test_frontend_bundle.mjs` → ALL CHECKS PASSED。本次未改动 `frontend/src` 应用代码，故未重建 `web/`，避免覆盖并行开发中的构建产物；`bridge/compat.py` 在下一次打包时会按 `bridge/*.py` 白名单自动进入 `.ankiaddon`。

- **[DeepSeek] 三处通用修复：沙盒样式表不再被振假名清洗误删、搜索/复习统一整页翻面与多模板正面判定、编辑器按卡型注入词库模板 CSS**（改 [`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py)、[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts)、[`frontend/src/bridge/pycmd.ts`](frontend/src/bridge/pycmd.ts)；新增 [`tests/test_general_fixes.py`](tests/test_general_fixes.py)）：
  - **1. `convert_furigana_to_ruby` 先提取 `<style>` / `<script>` 再清洗**：该函数原本无条件 `STYLE_BLOCK_RE.sub("")`，在沙盒渲染路径上会把模板自带样式表整段删掉——iframe 里只剩无样式裸文本，而因为正文仍然正确，任何只比对正文的测试都发现不了。新增 `preserve_style_blocks` 开关：开启时先把两类块换成占位符，只对正文做振假名转换与 MDX 标记清洗，最后原样拼回；`resolve_media_for_sandbox` 改走该开关，替换掉原先手工 `re.split` 的块保护写法（漏一类块就会复现误删）。
  - **2. 搜索与复习共用整页翻面判定 + 模板优先的正面字段判定**：新增 `resolve_replace_front_on_flip()`（Cloze / IO 统一排除）与 `resolve_front_field_name()`——后者按**这张卡自己的模板** `qfmt` 引用的字段顺序判定正面，跳过 `NoteID` 等元数据，模板不可用时才回落到 `pick_display_field` 的内容比对。`search_service` 新增 `replaceFrontOnFlip` 下发（编辑器/预览拿不到它就会在翻面时重复展示正面），两个服务都以 `card.ord` 指向的模板为判定依据，修掉多模板卡型（日→中 / 中→日）正面串模板的问题。
  - **3. 编辑器按卡型注入词库 `cardStyles`**：搜索接口本就按卡型去重下发模板 CSS（`cardStyles`），但编辑器只渲染字段 HTML、不渲染模板，从卡片库 / Cmd+K 打开的词库卡（柯林斯、蓝宝书等）预览会掉成无样式裸文本。`useAppStore` 新增 `libraryCardStyles`（卡片库搜索结果同样收集），`CardEditorModal` 按 `editingCardData.notetypeId` 取回模板 CSS，注入 `<style>` 并套上 `.anki-native-card > .card` 作用域容器；复习卡反面自带 `<style>` 时保持原有注入方式不变。
  - **4. 进度减负对坏卡健壮（场景门禁暴露的既有 bug）**：`edge` 场景里存在 `ivl`/`due` 越界的卡，Anki 26 的 Rust 后端连 `col.get_card()` 都抛 `IntegralValueOutOfRange`，而 `set_due_date(cids, ...)` 内部要重新读卡——于是**一张坏卡让整批减负抛错**，用户看到「减负失败：None」，几十张正常卡一张都没动。新增 `_filter_schedulable_cids()` 在写入前把调度器读不出来的卡摘出来，正常卡仍走单次批量 `set_due_date`；全部不可调度时明确返回失败且不写回执。**刻意不做「批量失败后逐张重试」**——那会把已部分提交的改期当成成功，破坏崩溃一致性不变量（`test_card_safety_round3` 仍然守着这条线）。
  - **验证**：新增 `tests/test_general_fixes.py` 16 项行为断言（样式块逐字节保留、沙盒脚本不被改写、多模板正面、Cloze/IO 不翻面、搜索接口下发 `replaceFrontOnFlip` 等）与 `tests/test_rescue_robustness.py` 4 项（坏卡摘除、顺序保持、全坏卡失败且不调用调度器），Python 单测 70 → **90** 全绿；`npx tsc --noEmit`、前端单元套件 58 项、Bundle 审计、隔离场景冒烟 **692/692**（含原先失败的 `edge / rescue:amortize`）、`npm run build` 与 `.ankiaddon` 打包全部通过。版本 1.4.6 → 1.4.7。

## [v1.4.6] - 2026-11-12

- **[Gemini] 落地方案「第 1 步」核心架构升级：智能整页翻面 + 3 字段以上编辑器真实字段平铺与空字段折叠 + 渲染文本摘要（`sfld` 仅作兜底）**（[`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py)、[`frontend/src/bridge/pycmd.ts`](frontend/src/bridge/pycmd.ts)、[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)、[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`tests/test_bridge.py`](tests/test_bridge.py)）：
  - **1. 智能整页翻面（Smart Full-Page Replacement on Flip）**：在 `media_utils.py` 新增 `should_replace_front_on_flip(card, front_plain, full_answer_html)` 与 `render_native_card_sides(..., strip_front_side=...)`，通过模板 `afmt` 是否包含 `{{FrontSide}}` 或渲染答案是否已包含题干正文（兼容 `Chinese Grammar Wiki` 与 `N1N2N3N4N5` 等手写复述正面模板）精确判定是否整页替换；`ReviewService` 下发 `replaceFrontOnFlip` 标志并保留完整答案面，`ReviewerView.tsx` 翻面后自动隐藏上方重复题干与分隔线，实现零重复、贴近原生的翻面切换。
  - **2. 3 字段以上编辑器真实字段平铺与空字段折叠**：`CardEditorModal.tsx` 在新建与 2 字段卡片保持简洁双塔编辑布局，在编辑 ≥3 字段笔记时按卡型真实 `fieldOrder` 顺序直接平铺所有非空字段，并将全部空白字段折叠于「展开更多字段 (N)」按钮下以便按需补填（如 167 字段蓝宝书）；未修改草稿切入预览时直接呈现 `render_output()` 原生渲染结果并尊重 `replaceFrontOnFlip`。
  - **3. 搜索摘要改用渲染文本、`sfld` 仅作兜底**：`SearchService._serialize_library_card` 优先取非元数据模板匹配字段或渲染后 `question_text` 纯文本作为卡片库标题，`sfld`（排序键，如柯林斯 `2005`、蓝宝书 `UUID`）仅在前述均为空时最后兜底。
  - **验证**：新增 `test_33_step1_smart_full_page_flip_and_sfld_fallback`，全部 Python 单测、`tsc --noEmit`、前端构建、`.ankiaddon` 打包与 Bundle 门禁测试 100% 通过。

- **[WorkBuddy] 复核与发版：真实卡包判定分布、编辑器保存路径、已知边界**（不采信自述，全部自己重跑）：
  - **门禁**：49 项 Python 单测、`npx tsc --noEmit`、`npm run build`、Bundle 审计全绿。额外查了编辑器保存路径：`isMultiFieldEdit` 分支按 `noteFieldOrder` 把 `allFieldsMap` **全量**回填进 `mergedFields` 再提交，折叠起来的空字段不会被丢掉——这是「按字段数平铺」最容易出数据事故的地方，确认安全。
  - **整页翻面判定的真实分布**：日语 `eggrolls-JLPT10k` 10,641 张 **100% 由模板 `afmt` 里的 `{{FrontSide}}` 命中**（确定性判定，正是方案第一步想要的）；柯林斯 `UVBasic-English` 997 张 **0 张命中模板、100% 由「答案正文包含正面文本」兜底命中**。柯林斯的答案首行是 `perceive [pə'si:v]}(2005.0) vt.察觉…` 这种内联词条，词与音标都在背面里，所以隐藏上方大标题不丢信息，但**翻面观感会变**：大字主词消失、分隔线消失，整屏让给卡面。这是贴近原生的取舍，已知会变，不是回归。
  - **已知边界（本版不动）**：兜底用的是 `clean_front in ans_plain` 全文包含比对——它在这里的角色是「判重」而非「猜字段」，与之前反对的字段名白名单不是一回事；但若某卡包背面只在例句里顺带提到正面词、并未在开头重述标题，就会误隐藏大标题。真出现反例时把「全文包含」收紧成「答案开头 N 字符内包含」即可，不必回退架构。
  - **中间态说明**：正面目前仍是单字段文本，背面是整张卡，翻面时会从「纯字段」跳到「卡包自己的排版」。这是有意保留的半步，下一步可把正面也换成 `question_text`，彻底不再选字段。
  - 版本号 `1.4.5 → 1.4.6`，`docs/ANKIWEB_LISTING.md` 标题同步，重新打包。

## [v1.4.5] - 2026-11-12

- **[Gemini] 8 大热门第三方 `.apkg` 卡牌库在学习模式、搜索模式与编辑模式下的全面兼容校验与样式修复**（[`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py)、[`bridge/edit_service.py`](bridge/edit_service.py)、[`frontend/src/utils/mathRenderer.ts`](frontend/src/utils/mathRenderer.ts)、[`frontend/src/index.css`](frontend/src/index.css)、[`frontend/src/bridge/pycmd.ts`](frontend/src/bridge/pycmd.ts)、[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)、[`tests/test_bridge.py`](tests/test_bridge.py)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - **校验范围**：以 Anki 原生界面渲染为标准，对下载目录最新的 8 个热门 `.apkg` 卡牌库（`HSK1-6_full_audio_image_and_Vietnamese_meaning_.apkg`、`Chinese_Grammar_Wiki_Study_Deck (1).apkg`、`egg_rollsJLPT_N1N5__v35NO_ENGLISH (1).apkg`、`blank (1).apkg` 成语大全、`N1N2N3N4N5.apkg` 蓝宝书文法、`GRE.apkg` 极品GRE红宝书、`167000.apkg` 考研英语例句、`120.apkg` 高中120文言文实词）进行逐一解包与三模式全链路校验，定位并修复以下 7 类共性及卡包特定渲染问题：
  - **1. 消除背面重复显示正面内容（`{{FrontSide}}` 去重）**：
    - 第三方模板常在 `afmt` 顶部写 `{{FrontSide}}<hr id=answer>`、`<main id="FrontSide">...</main>` 或重复正面 `.hanzi` 块，而 Anki Studio 在复习界面、卡片库与 Cmd+K 预览中上方已常驻展示正面，原样渲染 `answer_text` 会导致正面词条/句子重复出现两次并挤占卡片库 3 行摘要。
    - 在 `media_utils.py` 新增 `strip_front_side_from_answer(answer_html, question_html)`，自动识别并剥离 `<hr id=answer>` 之前的内容、`<main id="FrontSide">` 块、完全匹配的 `question_html` 前缀（如 `GRE.apkg` 与 `Chinese Grammar Wiki` 的 `Translation` 模板）以及重复的 `<div class="hanzi">` 题干块，同时清理 `{{type:...}}` 残留的 `<input id=typeans>` 占位框。
  - **2. 日语振假名 ` 漢字[かな]` 转 `<ruby>` 与题干防剧透**：
    - `egg_rollsJLPT` 与 `N1N2N3N4N5` 在字段内使用 Anki 日语插件语法 ` 漢字[かな]`（如 `一[いち] 敗[ぱい] 塗[と] 地[ち]`、`山田[やまだ] 監督[かんとく]`）。此前直接取原始字段展示时会在正面、卡片库与编辑器预览中直接暴露裸方括号读音。
    - 在后端 `media_utils.py`（`convert_furigana_to_ruby`）与前端 `mathRenderer.ts` 中新增假名专用正则（严格仅匹配假名读音，不误伤英语音标 `[ə'bændən]` 或汉语拼音 `[ài]`），自动转换为 `<ruby>漢字<rt>かな</rt></ruby>`；当模板正面使用 `{{kanji:...}}` 不显示注音时（如 `N1N2N3N4N5` 例句卡），正面自动剥离方括号读音防止提前剧透，翻面后在 `frontAnswerHtml` 中完整呈现 `<ruby>` 振假名。
  - **3. 还原 `egg_rollsJLPT` 脚本动态注入的 `［词性］` / `［例句类型］` 徽标并清理无效装饰栏**：
    - `eggrolls-JLPT10k-v3.5` 将 `{{VocabPoS}}` 与 `{{SentType1..4}}` 写在 `<script>` 中由 `setType()` 动态注入 `［名］`、`［一］`、`［例］`、`［関］`、`［対］`、`［訳］`，且 CSS `.LabelIndent` 预留了 `-3em` 悬挂缩进；直接剥离脚本会导致词性与同反义词标签消失且整段左移悬空。
    - 新增 `_apply_jlpt_script_transforms()` 在剥离 `<script>` 前提取词性与例句类型并注入 `<em lang="ja">［...］</em>`，同时移除卡片顶部不生效的 `.Top` 导航栏与 `.Search` 外部搜索按钮。
  - **4. 修正 `N1N2N3N4N5`（167 字段 26 模板）例句卡正面字段识别与内嵌 `<style>` 污染**：
    - 升级 `pick_display_field()`：忽略 `NoteID`、`Note ID`、`Link`、`Level`、`SubOrder` 等元数据字段，通过 `plain_text_of()` 剥离 `<style>`、`<script>`、`<rt>`、振假名括号与行内格式标签后再与模板正面比对；针对蓝宝书 Card 02~26 例句卡（`class="sentenceexample"`）优先匹配 `Example1..25` 字段，避免误取 `Level`（`N1`）或语法词条 `Word`。
  - **5. 补齐 `Chinese Grammar Wiki` 正面提问提示语与 `HSK1-6` 背面核心释义/表格自适应**：
    - 提取 `CGW-ValidExample` / `CGW-InvalidExample` 正面模板顶部的 `<div class="header">Is this sentence grammatically correct?</div>` 挂在题干上方，避免判断正误卡变成无提示句子；
    - 为 `HSK1-6` 背面自动置顶补齐模板漏写的 `Phiên âm`（拼音）与 `Tiếng Việt`（越南语核心释义），在 `scope_card_css` 中过滤刺眼的 `.card { background-color: green }` 与超长 `min-height`，并在 `index.css` 中为 `.anki-native-card` 与卡片库预览增加 `<table width=2000>` 宽度钳制（`max-width: 100% !important; width: auto !important`）与 `td#I_C img` 行内图标对齐规则。
  - **6. 清洗 `120.apkg` 与 `HSK1-6` 的 MDX 词典序号标记 `` `1` `` / `` `2` ``**：
    - 在 `media_utils.py` 与 `mathRenderer.ts` 中新增 `MDX_INDEX_MARKER_RE`（`` `\d+` ``），消除文言文实词与 HSK 词典字段中残留的 `` `1` ``、`` `2` `` 反引号数字标记。
  - **7. 编辑模式（`CardEditorModal.tsx` / `ReviewerView.tsx` / `edit_service.py`）字段智能匹配与多字段体验优化**：
    - 新增 `pickEditorFrontAndBackKeys` 并扩展 8 卡包正反面字段别名（正面：`单词`、`VocabKanji`、`Mặt trước`、`中文`、`Word` 等；背面：`解释`、`VocabDefSC`、`Tiếng Việt`、`English`、`Explain1` 等），严格跳过 `NoteID`、`Link`、`Level`、`Audio` 等元数据字段与 `音标`、`Pinyin`、`Phiên âm`、`VocabFurigana` 等注音字段，解决打开 `egg_rollsJLPT`、`GRE`、`N1N2N3N4N5`、`Chinese Grammar Wiki` 编辑时正反面落入 `NoteID`、`Link` 或 `音标` 的问题；
    - 优化多字段卡包（如 `N1N2N3N4N5` 167 字段、`egg_rollsJLPT` 36 字段）在编辑弹窗中的附加字段展示：非空字段置顶排列、折叠大量空白占位字段，并对含 HTML 表格/图片或长文本的附加字段自动切换为多行 `<textarea>`。
  - **验证**：新增 `test_32_eight_popular_apkg_models_study_search_edit_compatibility` 与 Bundle 审计 `Item #41`，8 个 `.apkg` 真实数据三模式仿真校验、`npx tsc --noEmit`、`npm run build`、`node tests/test_frontend_bundle.mjs` 与 48 项 Python 单测 100% 通过。

- **[WorkBuddy] 发版收尾：把 `render_native_card_sides` 的注释补回来**（改 [`bridge/media_utils.py`](bridge/media_utils.py)）：
  - 上一条改动把这函数的 docstring 压成了一句“用 Anki 自己的模板引擎渲染正反两面”，顺手删掉的正是「**绝不能传 `browser=True`**」那段——而那是 v1.4.4 花半天才定位到的结论（`browser=True` 会把正面退化成第一个字段的原样文本，`{{FrontSide}}` 跟着塌掉，用户看到的就是一串 uuid）。CHANGELOG 里写着，但改代码的人未必翻到；注释留在出事的那一行才拦得住。
  - 同步把新职责写进去：背面现在还要过 `strip_front_side_from_answer` 剥掉 `afmt` 顶部重复的 `{{FrontSide}}`，否则 Studio 上方已展示的正面会和背面重复一遍。
  - 纯注释改动，48 项单测与前端产物均无变化；本次发版一并处理：版本号 `1.4.4 → 1.4.5`、`docs/ANKIWEB_LISTING.md` 标题同步、重新打包。

## [v1.4.4] - 2026-11-12

- **[WorkBuddy] 日语卡包显示“乱码”：`browser=True` 是降级渲染，正面直接给出一串 uuid**（改 [`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py)、[`tests/test_bridge.py`](tests/test_bridge.py)）：
  - **现象**：用户装上 `egg_rollsJLPT_N1N5__v35NO_ENGLISH.apkg`（`eggrolls-JLPT10k-v3.5` 卡型，36 字段，日-中 / 中-日 两个模板）后说“日语好像会显示乱码”。实际不是编码问题，是**正面位置显示了一串裸 uuid**——`469b5ba2-a0bb-11ef-9eca-75d1f1bae144`，背面开头也是同一串，后面的假名汉字部分反倒是对的。
  - **根因一（真正的坑）：`card.render_output(browser=True)` 不是“关掉钩子的同一个渲染”**。v1.4.1 的注释里写着“拿 UVBasic-English 997 张卡比对过，`browser` 取 True/False 输出完全一致”——**这句话是错的**。`browser=True` 走的是浏览器列表那条**降级**路径，`question_text` 会直接退化成“第一个字段的原样文本”，`{{FrontSide}}` 也跟着塌成那一个字段。UVBasic-English 恰好把主词放在第一位，所以退化不可见；换到这个卡包就现原形。同一个模板实测：`browser=True` 正面 **36 字符**，`browser=False` 正面 **18,778 字符**（完整正文）。柯林斯卡两种模式都是 4,126 字符，这也是它一直“看起来没问题”的原因。
  - **根因二：插件一直把 `fields[0]` 当正面**。Anki 的正面是模板算出来的，跟字段顺序无关。这个卡包把 `NoteID` 排在第一位（第二位才是 `VocabKanji`，也就是真正的主词），于是插件亲手把 uuid 摆到了正面。
  - **修法**：`render_native_card_html` 拆成 `render_native_card_sides`，返回 `NativeRender(question, answer, question_audio, answer_audio, css)` 这个 NamedTuple，正反两面都取模板结果；旧函数保留为只取背面的薄包装，调用方不用改签名。渲染一律 `card.render_output()`，**不带任何参数**——Anki 自己的复习界面就是 `card.question()` → `render_output(reload, browser=False).question_and_style()`，这里必须对齐。
  - **正面取哪个字段交给模板判断**：新增 `pick_display_field(fields, rendered_front)`，按字段顺序找第一个“内容真的出现在模板正面里”的字段。注意传入的必须是**净化之后**的正面——原始渲染结果里那段脚本还带着 `{{text:NoteID}}` 替换出来的 uuid，不先净化的话第一个字段会“看起来出现过”，等于白判。
  - **正面只换字段、不换排版**（有意为之）：第一版试过把整段 `native.question` 连同作用域样式塞进正面，出图立刻暴露两个问题——卡包自己的顶栏（`eggrolls-JLPT10k-v3.5::1-N5 … 反馈`）跑到 Studio 的正面区域里，以及背面里的 `{{FrontSide}}` 与正面重复一遍。所以正面仍然只换那一个字段，整张卡的完整排版交给背面呈现。
  - **顺带清掉 `[anki:play:a:0]` 占位符**：Anki 把 `{{VocabAudio}}` 这类音频字段渲染成重播按钮占位符，等着它自己的复习界面换成按钮。插件不复刻那个按钮（音频走 `audioFiles` 自己的播放条），留着就是页面上肉眼可见的一串方括号标记——而这个卡包的每张卡都带语音，等于每张卡都在露。新增 `MEDIA_PLACEHOLDER_RE` 在净化阶段一并删掉。
  - **回归验证**：柯林斯卡包 `sides.answer` 与修复前 `html` 逐字节相等（`True`），样式表在把 `file:///…/c.media/` 归一化之后也完全相同，正面字段解析回 `英语单词`。真机出图对比见 `~/Downloads/anki-studio-jlpt-uuid-check.png`（不入库）：修复前正面是等宽红字 uuid、背面从 uuid 起头；修复后正面是 `高校`，背面假名注音 `こうこう ⓪`、`高中`、`「高等学校」の略`、例句 `妹は高校に通っています` 的 `<ruby>` 振假名与 `妹妹在上高中` 全部正常，无方框字、无占位符。
  - **性能实测**：`render_native_card_sides` 在真实卡包上 **1.02 ms/卡**（100 张 102 ms），18 KB 正文的净化 0.60 ms/卡，仍在可忽略区间。这个卡型的 CSS 有 9,157 字符（Tailwind 式 reset、`@charset "UTF-8"`、三个指向 `_SourceHanSerif{CN,TW,JP}-Medium.otf` 的 `@font-face`、`:lang(ja)`/`:lang(zh-Hans)`/`:lang(zh-Hant)` 分语言字族），走的是 v1.4.2 那套作用域管线，未做特殊处理；v1.4.3 的「按 `notetypeId` 去重」也仍然安全——用户自己的 8 个卡型（公文/申论）只在 `/* */` 注释里提到 `{{Subdeck}}`。
  - **测试**：`test_28` 的第 6 条断言从“必须带 `browser=True`”改成“必须**不带任何参数**”（桩也改成记录 `(args, kwargs)`，断言 `[((), {})]`）。新增 **`test_31_front_falls_back_to_template_when_first_field_is_not_front`**：锁住「`pick_display_field` 会跳过 uuid / 第一个字段本身就是正面时不动它 / 都不匹配时回落第一个字段 / 空字段表返回空串 / 必须先净化再比对 / 两侧渲染与音频与作用域 CSS / 端到端 `start_review` 取模板正面而非 `fields[0]`」七件事。46 → 47 条。

## [v1.4.3] - 2026-11-12

- **[WorkBuddy] Cmd+K 右侧预览也只显示纯文本：模板 CSS 跟着搜索结果一起下发**（改 [`bridge/search_service.py`](bridge/search_service.py)、[`bridge/media_utils.py`](bridge/media_utils.py)、[`frontend/src/components/search/CommandPaletteModal.tsx`](frontend/src/components/search/CommandPaletteModal.tsx)、[`frontend/src/stores/useAppStore.ts`](frontend/src/stores/useAppStore.ts)、[`frontend/src/index.css`](frontend/src/index.css)、[`tests/test_bridge.py`](tests/test_bridge.py)）：
  - **现象**：1.4.2 修好了背诵界面，但快速搜索（Cmd+K）右栏的卡片预览还是“认字不认样”——柯林斯的色条、词性小标签、真题块全摊成一段同字号文字。根因和 1.4.2 同源：`search_service` 当时只搬了正文，样式表被有意丢掉（“列表页一屏几十张卡各带一份 `<style>` 既浪费也会互相串味”），而右栏恰好是唯一需要样式的消费者。
  - **样式改为按卡型去重下发**：`_serialize_library_card` 新增 `style_sink` 参数，渲染时把 `build_card_css` 的结果 `setdefault` 进一个字典；`search_cards` 最终把这份字典当 `cardStyles` 返回，每张卡另带 `notetypeId` 指回自己。200 条结果里同卡型只占一个键，实测整包只多一份 7 KB 样式表，而不是 200 份。
  - **作用域从 `id` 换成 `class`**：原来用 `#anki-native-card`，一个页面只能存在一张卡；换成 `.anki-native-card` 之后，同一份样式表可以服务多个渲染点（右栏换卡不必重建样式表）。`wrap_card_html` 与 `wrap_card_with_styles` 拆开：前者只套壳，后者才带 `<style>`，复习界面继续用后者（一张卡一份，省一次请求），搜索侧用前者 + 顶层注入一次。
  - **`render_native_card_html` 加了兜底**：整段“取模板渲染结果”的代码都进了 try/except。第三方卡包的 `css` 字段可能是任意脏数据，以前解析炸掉会把**整张卡**从序列化结果里静默丢掉（`_serialize_library_card` 返回 None），现在最差只是这张卡没有样式。顺手加了 `isinstance` 检查，非字符串一律降级。
  - **补掉深色模式的对比度隐患**：卡包模板 CSS 几乎都按 Anki 浅色主题硬编码 `color:#000` / `background:#fff`，极少认 `nightMode`。`.anki-native-card` 现在固定垫一张白纸（`background:#fff; color:#1d1d1f; border-radius:12px`），浅色主题下看不出变化，深色主题下不会出现“深字压深底”。这是**有意与插件主题解耦**：卡面按 Anki 里的样子渲染，外壳跟随插件主题。
  - **验证方式**：把 `Anki.apkg` 解包还原成临时集合（含 60 个媒体文件），对真实 997 张卡跑 `render_native_card_html` 拿到 7,205 字符作用域样式，再在无头 Chrome 里按右栏结构 1:1 复现浅色/深色两套图比对——修复前是纯文本流水，修复后 `perceive` 标题、`vt.察觉`、Vocabulary.com 绿条、Collins 深蓝条与 ★★★★★、带编号的义项块全部还原，深色主题下也没有不可读区域。
  - **新增 `test_30_search_payload_carries_scoped_css_per_notetype`**：锁住「样式按卡型去重 / 卡片带 notetypeId / 列表正文不夹带 `<style>` / 无模板引擎时不凭空造样式」四件事。

## [v1.4.2] - 2026-11-12

- **[WorkBuddy] 回到模板样式：正文搬了、样式没搬，卡包背面变成一坨无样式纯文本**（改 [`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py)、[`tests/test_bridge.py`](tests/test_bridge.py)）：
  - **1.4.1 只做对了一半**：字段回来了，但模板 CSS 完全没跟上。用户看到的是 `.section` 的标题色条、`.extension` 的灰底块、`#chinese a.pos_v` 的词性小标签、`#vocab`/`#collins` 的 logo 条全部消失，整张背面塌成一行行同字号文字。而编辑器预览里样式是好的——因为那里走的是插件自己的排版，掩盖了问题。
  - **不能直接把 css 字段塞进 `<style>`**：这批 2016 年的卡包把整段 HTML 写进 css 字段（`</style>` + `<!-- 注释 -->` + `<style>` + 一段 `function toggle()` 的 `<script>`）。原样注入会撑破样式表，尾部片段变成页面上的可见乱码。新增 `extract_model_css_text`：按 `<style>` 块取内容、剥掉注释与残留标签，没有标签时按纯 CSS 处理。
  - **`@import` 就地展开**：`@import url('_collins_c.css')` 指向 `collection.media`，插件的页面是 `file://` 加载的，相对路径解析不到媒体目录。改为读出该文件、展开到最前面再一起作用域化——顺带消除“先闪一下无样式柯林斯”的加载空窗。路径经 `_rewrite_css_urls` 统一改写为 `file:///…/collection.media/…`，`_vocab_logo.png` / `_collins_logo4.png` 两条背景图实测能正常加载。
  - **作用域化**：`scope_card_css` 做一层花括号扫描，把每条选择器都收进 `#anki-native-card` 之下；`@media` / `@supports` 递归处理，`@keyframes` / `@font-face` 原样保留。`body` / `html` / `:root` 前缀直接替换成容器本身，于是 `body{font-size:…}` 变成容器的基准字号而不是全站。正文用 `wrap_card_with_styles` 包成 `#anki-native-card > .card`——里层那个 `class="card"` 不能省，模板 CSS 基本都以 `.card{color/font}` 打底，缺了它深色主题下就是浅色字压在白底卡面上。
  - **`display:none` 一律删掉**：`#ext_collins{display:none}` 这类折叠块本来靠 `onclick="toggle('collins')"` 点开，而脚本不执行、内联事件也已清掉。留着重则内容永远不可达，所以宁可默认展开。这是**有意偏离原生行为**，等量替换的是“内容必须看得到”。
  - **列表页不注入**：卡包库里一屏几十张卡各带一份 `<style>` 既浪费也会互相串味，`search_service` 只取正文。`build_card_css` 加了 `lru_cache`（同一 notetype 只算一次），整队列 100 张从 40 ms 涨到 121 ms 后回落到可接受区间。
  - **验证方式**：从真实卡包生成 `backHtml`，套进模拟深色主题的容器，用无头 Chrome 出图逐项核对——白底 `#english` 标题块、`#chinese` 灰底块、真题块、Vocabulary.com 绿条、Collins 深蓝条与 ★ 星级全部还原，文字无白压白/黑压黑。产物临时图见 `~/Downloads/anki-studio-card-css-check.png`（不入库）。
  - **新增 `test_29_review_back_injects_scoped_model_css`**：锁住「HTML 大杂烩抽纯 CSS / 选择器作用域 / body 前缀替换 / @import 展开 / url 改写 / display:none 清除 / @media 递归 / 包壳与空值降级」八件事。

## [v1.4.1] - 2026-11-12

- **[WorkBuddy] 背诵界面背面只显示一行音标：背面正文改由 Anki 模板引擎渲染**（改 [`bridge/media_utils.py`](bridge/media_utils.py)、[`bridge/review_service.py`](bridge/review_service.py)、[`bridge/search_service.py`](bridge/search_service.py)、[`tests/test_bridge.py`](tests/test_bridge.py)）：
  - **现象**：用户装上 `Anki.apkg`（997 张 `UVBasic-English` 卡，10 字段）后反馈「编辑时拓展字段都在，学习模式的背面却只有一个音标」。定位到 `_serialize_review_card` 里 `back_raw = fields_dict.get(field_keys[1])`——**把「第二个字段」当成了整张背面**。这个卡包的 `fields[1]` 恰好是 `英美音标`，于是 `中文释义 / vocab简明 / vocab扩展 / 真题原句 / 柯林斯星级 / 柯林斯解释` 六个字段全部被丢掉。只要卡包不是「两字段」形态，拓展字段就会这样整段消失，且编辑界面看不出异常，肉眼很难归因。`_extract_structured_fields` 里写死的 `词源 / 例句 / 提示 / 读音` 四个字段名同样不匹配这个卡包，等于第二重漏掉。
  - **修法**：新增 `media_utils.render_native_card_html(card)`，背面一律取 `card.render_output().answer_text`，`{{字段}}`、`{{#字段}}` 条件段、`{{FrontSide}}`、`{{hint:}}` 由 Anki 自己算完。复习队列与卡包库（`search_service._serialize_library_card`）同源改造，两处不再各写一套。取不到模板引擎时（老版本 / 单测桩）安静回落 `fields[1]`，行为与修复前一致。
  - **验证方式**：用 Anki.app 自带的 Python 3.13 + `app_packages` 直接打开解包后的 `collection.anki2`，对真实 997 张卡跑通渲染；再加载改造后的 `review_service` 复算 `backHtml`，确认六个字段全部回到背面、`<script>/<style>/onclick` 均已清除。`UVBasic-English` 逐卡比对确认 `browser` 取 True/False 输出完全一致。
  - **模板 CSS 故意不注入**：该卡包的 `css` 字段起手就是 `</style>` + html 注释 + `<style>` + `@import` + 一段 `function toggle()` 的 `<script>`——塞进 React 会直接撑破样式表，尾巴变成可见乱码；而且那套样式按白底写（`background-color:#fff`），落到深色主题里是白块，`.card / .section` 这类通用类名还会泄漏到全站。**只保留正文结构，视觉交给插件自己的设计系统**，这也是「柯林斯解释」在插件里默认展开的原因（模板原本靠脚本点击折叠，而 `dangerouslySetInnerHTML` 不执行脚本，藏起来就再也点不开）。
  - **三处必须清掉的模板残留**：`<script>`（不执行，且真执行等于让第三方卡包在本插件的特权 WebView 里跑任意 JS，那里面有 pycmd 桥）、`{{hint:}}` 脚手架（`<a class=hint>` 标签 + `display:none` 的内容块，脚本不跑就没有展开入口，改为直接露出内容）、`onclick` 内联事件（点了会抛 ReferenceError）。
  - **`white-space: pre-wrap` 的连带问题**：正文容器为保留纯文本卡的手动换行用了 `pre-wrap`，而模板缩进是成片 `\n\n\n`，直接注入会变成背面上好几行空行。新增 `normalize_rendered_whitespace` 把换行压成一个空格（不是删掉，避免把相邻行内元素粘成 `foobar`）。
  - **Cloze 与原生遮挡卡不走新路径**：`frontAnswerHtml` 已经负责把挖空补全，背面再叠一份完整答案会让同一句话在翻转时出现两次；原生 IO 仍用 `render_native_image_occlusion`。
  - **性能实测**：`render_output` 走 Rust 后端，100 张卡全字段序列化从 40 ms 起（0.40 ms/卡，含原有的 FSRS 预测与 revlog 查询），可以忽略。`browser=True` 只是为了不触发 `card_did_render` 钩子（那是给真正复习界面用的，批量序列化会误伤别的插件）。
  - **新增 `test_28_review_back_uses_native_template_not_second_field`**：锁住「背面含拓展字段 / 正面维持 field[0] / 脏东西清干净 / hint 内容露出 / 音频从 `answer_av_tags` 补回 / `browser=True` / 无引擎时降级」七件事。

- **[WorkBuddy] 仓库转 public 后的收尾：README 补预览图与缺失的测试命令，清掉「仓库还是私有」的过期说明**（改 [`README.md`](README.md)、[`docs/ANKIWEB_LISTING.md`](docs/ANKIWEB_LISTING.md)、[`tests/WINDOWS_HANDOFF.md`](tests/WINDOWS_HANDOFF.md)）：
  - **README 顶部加了预览 GIF**（复用 `docs/assets/anki-studio-preview.gif`，相对路径引用，GitHub 侧直接渲染），并为「预览图」新增第 4 小节，写明生成脚本与可调参数。
  - **补上 README 漏写的门禁命令**：原来「自动化测试与体检」只列了 `node tests/test_frontend_bundle.mjs`，漏了 `python3 -m unittest discover -s tests`，照文档做的人会漏跑一半测试。现补齐并注明「两组全绿再提交，改完还要 `npm run build`」。
  - **两处「仓库是私有的」已过期**：仓库已于 2026-11-12 转为 public（`github.com/gripet43/anki-studio` 与 raw 直链均匿名可访问，实测 200）。`docs/ANKIWEB_LISTING.md` §3 改为「已公开，上传前确认文件已推送到 main」；`tests/WINDOWS_HANDOFF.md` 的前置条件改为「可直接匿名 clone，推送才需要凭据」。
  - 历史条目（v1.4.0 第 3 点）里「发布前必须转为 public」的表述保留不动——那是当时的记录，事实已在上一条完成。

- **[WorkBuddy] 重做 AnkiWeb 预览 GIF：定位到「JPEG 白噪声污染调色板」这一真凶，并把生成过程脚本化**（改 [`docs/assets/anki-studio-preview.gif`](docs/assets/anki-studio-preview.gif)、新增 [`scripts/build_preview_gif.py`](scripts/build_preview_gif.py)、[`docs/ANKIWEB_LISTING.md`](docs/ANKIWEB_LISTING.md)）：
  - **起因**：用户反馈旧版预览图「不是很好看」，并补了 4 张 2944×2086 的 macOS 整窗截图（今日概览 / 全局搜索 / 进度减负 / 休假模式，统一构图、纯白外底）。
  - **真凶是 JPEG 的白色噪声，不是缩放**：截图白底带 ±1 色度噪声，中位切分于是把调色板里的 4~6 个名额发给了几乎相同的白。量化后**纯白像素从 58% 掉到 0%**，整片底色被压到 252 一类「脏白」——观感就是整屏发灰、底色带噪点。修法：量化前把 `min(R,G,B) >= 250` 的像素统一拍成 255。修完 GIF 与源图逐点比对，平区域颜色差值为 **(0,0,0)**，全图平均色差 MAE 0.38–0.53。
  - **全局调色板：试了，然后否掉**。本想共用一套调色板避免换帧跳色，实测共用调色板要迁就四帧平均分布，单帧 **MAE 2.32**，而逐帧自适应只要 **0.24**，差一个数量级（纯白直接归零）。硬切播放时每帧独立出现，跳色问题本就不存在，已回退为逐帧自适应量化，并在脚本 docstring 里写明「别再改回去」。
  - **两个 Pillow 坑**：① `Image.quantize(dither=...)` 被静默忽略——A、B 两版像素差异实测为 **0**，要抖动只能走别的路径，但该路径保真度更差，故放弃抖动；② 预模糊是负收益，MAE 从 0.24 涨到 0.60（0.4px）/ 1.32（0.7px），纯粹糊文字，已移除（LANCZOS 缩放本身自带抗锯齿）。
  - **硬切而非淡入**：3 步淡入把体积从 564 KB 顶到 **3.4 MB**，且中间帧是两张图合成的、落在调色板分布之外，量化质量最差。
  - **成图**：**1200×850 / 4 帧 / 11.2 秒 / 564 KB**。旧版是 900×563 / 13 帧 / 1.36 MB——画布大 33%，体积只有 41%。停留时长不占体积，直接给到 2.8 秒一帧。
  - **脚本化**：原来是一次性命令拼的，改不动也复现不了。新增 `scripts/build_preview_gif.py`，`--width / --hold-ms / --fade-steps / --fade-ms / --loop-back` 全参数化，并校验各帧尺寸一致。
  - **已知短板（未解决，已在文档标注）**：四帧里只有首页是亮屏，后三帧是弹窗叠加「压暗 + 高斯模糊」的背景，平均亮度 243.9 → 181.9 / 161.2 / 156.1，纯白占比 58% → 31/18/17%。这是模态层的真实表现，不宜调色补偿；循环时会有「一帧亮、三帧灰」的落差，待补亮屏截图（卡片库 / 复习界面）后替换掉其中一帧。

- **[WorkBuddy] 改写 AnkiWeb Title 策略：从「功能描述优先」改为「各语言母语词串联」，并补 Description 的渲染风险兜底**（改 [`docs/ANKIWEB_LISTING.md`](docs/ANKIWEB_LISTING.md)）：
  - **原方案被用户判为理解偏差**：上一版推荐 `Anki Studio — immersive desktop workspace · 16 languages`，逻辑是"功能优先、语言数量次要"。用户指出真实意图是——标题里直接排开各语言中「工作室」这个词，让任何语言的读者扫一眼就认出自己的母语词，从而**零成本**得出"这个插件我看得懂"。`16 languages` 是数字，需要读者额外推理一步才转化为信任，效果弱于母语词本身。
  - **现推荐（72 字符，未超 80 上限）**：`Anki Studio · 工作室 · スタジオ · 스튜디오 · Estudio · Atelier · Werkstatt · Студия`。排序按覆盖面：中文（简繁同形）→ 日 → 韩 → 西（葡语 `Estúdio` 仅差一个重音符，可覆盖）→ 法 → 德（荷语 `Werkplaats` 同源可类推）→ 俄（乌克兰语、保加利亚语近似）。
  - **7 个是硬上限**：以 ` · ` 分隔逐个实测，第 8 个词（`Estúdio` 或 `Stüdyo`）会把标题顶到 **82 / 81 字符**，无解。余下 8 字符放不下任何有意义的词。
  - **刻意剔除 `it` 与 `pl`**：这两国语言里「工作室」就是 **Studio**，与标题中已有的英文原词一字不差，列上去只消耗字符、不产生任何新信息——这两国读者本来就已经看懂了。
  - **代价已明示**：标题不再说明功能。这是有意的取舍，功能由 Tags 与 Description 首句承担，而该首句正是列表页正文第一行，往下拉一行即可补上。
  - **备选表整体重测**：旧表里「窄分隔 9 种 = 73」实测应为 **76**，「7 种 + 功能尾巴 = 88」是占位数字且未给出可用写法。现四条备选全部按真实字符串重新测量（窄分隔 9 种 76 / 窄分隔 8 种 65 / 7 种+「桌面工作区」71 / 功能描述优先 56）。
  - **新发现的一处渲染风险，已写进 §5**：对着 Review Heatmap 的线上页面核过，AnkiWeb 一定渲染的是粗体、斜体、链接、图片、无序列表与 `---`；而 `##` 二级标题官网只说「supports Markdown」，没有明文保证。正文 15 处 `## 语言名` 若不被解析会显示成字面井号，故预先写明兜底：批量换成 `**…**`，分隔效果由已有 `---` 承担。这是**待上传后目视确认**的项，不阻塞发布。

## [v1.4.0] - 2026-11-12

- **[WorkBuddy] 上架 AnkiWeb 前的发布整改：manifest 版本语义修正、同步安全性清理、换档案重挂载、许可证与文档补全**（改 [`manifest.json`](manifest.json)、[`scripts/build_ankiaddon.py`](scripts/build_ankiaddon.py)、[`__init__.py`](__init__.py)、[`bridge/vacation_service.py`](bridge/vacation_service.py)、[`config.md`](config.md)、[`README.md`](README.md)，新增 [`LICENSE`](LICENSE)、[`tests/test_release_safety.py`](tests/test_release_safety.py)）：
  - **1. `min_point_version` 从 `26` 改成 `260904`（最危险的一条）**：反汇编本机 Anki 26.9.4 的 `aqt/addons.pyc` 确认，兼容判断就是 `if int_version() < min_point_version: 不兼容`，而 `int_version()` 返回 `YYMMDD` 整数（26.9.4 → `260904`）。原先写的 `26` 让 `260904 < 26` 恒为假，**等于宣称兼容包括 2.1.x 在内的所有版本**——那类用户装上一个依赖 Qt6 与 AnkiWebView 深度接管主窗口的插件必然崩溃，且会直接反映成差评。现按「只在实测通过的版本上声明」定为 `260904`，后续可在旧版实测通过后再下探。
  - **2. 补齐 `human_version`**：Anki 实际读取的 manifest 字段是 `mod / conflicts / min_point_version / max_point_version / branch_index / human_version`，`version` 它并不读。之前缺 `human_version`，插件列表里不显示版本号。现补成 `1.4.0`。
  - **3. `homepage` 从占位 `https://ankiweb.net` 换成仓库地址**：原值会被当作「支持/主页」链接展示，用户点进去回到首页。现指向 `https://github.com/gripet43/anki-studio`——**该仓库目前是私有的，发布前必须转为 public**，否则链接 404。
  - **4. 打包脚本自动盖 `mod` 并对版本字段做校验**：AnkiWeb 靠 `mod` 判断有无新版本，停在旧值等于推不动更新。现在每次打包无条件把 `mod` 刷成当前时间戳；同时拒绝 `min_point_version < 200000`（拦「写成大版本号」这类笔误）与空 `human_version`。两条守卫均做过变异测试确认会真的报错。
  - **5. 删除 5 处同步不安全的裸 SQL 写库**（`bridge/vacation_service.py`）：这些 `UPDATE cards SET due = ...` 绕过 `col.update_card` / `col.sched.set_due_date`，**不会把 `usn` 置为 -1、也不更新 `mod`**，Anki 会认为该行「已同步」，多设备用户会静默丢失这次改期。它们原本是 `set_due_date` 不存在时的兜底分支，在声明了 `min_point_version` 之后已是不可能走到的死代码，故直接移除并在原位留下说明。`deck_service.py` 中的 `ANALYZE` 保留——它只刷新 sqlite 统计信息，不触碰行数据。
  - **6. 换用户档案后重新挂载界面**（`__init__.py`）：原先只订阅 `main_window_did_init`（每次启动触发一次），而档案切换会重建主窗口中央控件、销毁挂在旧父控件下的 webview，导致界面「消失」且再也切不回来。现新增 `profile_did_open` 钩子重挂，并给 `_ensure_webview` 加上**探活 + 重设父控件**：先 `parent()` 探一次，若抛 `RuntimeError`（C++ 侧已销毁）就把缓存置空重建；父控件变了则 `setParent` 对齐。重挂载只在用户本来就处于现代界面时发生，不覆盖「切回原生」的显式选择。
  - **7. 补 `LICENSE`（MIT）**、重写 `config.md`、修正 `README.md` 的过期表述：`config.md` 原先只列 4 套强调色（实际 8 套）、3 种语言（实际 16 种）、漏了 4 个键，而它就是用户在 Anki「配置」界面看到的说明；README 里的「4 款强调色」「Anki 24+」一并订正，并补了兼容性表与许可段落。
  - **8. 新增 `tests/test_release_safety.py`（5 条）**：锁住上述硬事实——`min_point_version` 必须是 `int_version()` 口径、`human_version` 非空、`homepage` 不得是占位值、`bridge/` 内不得出现绕过官方 API 的写库语句（`ANALYZE` 豁免）、`profile_did_open` 与 `main_window_did_init` 两个钩子都在。裸 SQL 守卫做过变异测试（注入一条 `UPDATE cards SET due = 0` 后精确报出 `safety.py:233`）。
  - **未做（有意为之）**：`setWebExports` 未接入。当前前端用 `file://` 加载，在 r4 的 Windows 与 macOS 上均已验证可用；改成 `/_addons/<id>/` 的 HTTP 加载属于行为变更，无法在无 GUI 环境验证，风险大于当期收益。已记录为后续项：一旦未来 Qt 收紧本地文件互访策略，这条会是白屏的根因。
  - **打包结构复验**：`scripts/build_ankiaddon.py` 产出的包顶层无包裹目录、不含 `__pycache__` / `*.pyc` / `meta.json`、随包 `config.json` 已剥离昵称与学习记录，共 30 个运行时文件，符合 AnkiWeb 的接收条件。

- **[WorkBuddy] 修掉 r4 Windows 验版判失败的 A8：文案里写死的快捷键改为按平台注入**（改 [`frontend/src/i18n/translations.ts`](frontend/src/i18n/translations.ts)、[`frontend/src/i18n/locales/`](frontend/src/i18n/locales/)、[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx`](frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - **报告结论**：[`tests/reports/windows-20261112-r4.md`](tests/reports/windows-20261112-r4.md) 里 15 项界面检查 13 项通过，**A8「快捷键与界面提示一致」判失败**，唯一原因是制卡编辑器正面输入框的 placeholder 在 Windows 上仍写 `Cmd+Shift+C`。B3（同步中脉冲、已同步云朵跟随主题色）是沙盒没有 AnkiWeb 凭据导致无法目视，代码层已确认实现，不属缺陷。
  - **同一缺陷的第二处**：排查时发现 `ioEmptyCanvasTitle`（图片遮挡空画布标题）也是写死 `Cmd+V` 的，Windows 上会提示「直接按 Cmd+V 粘贴剪贴板图片」。r4 报告只点到编辑器一处，此处一并修掉。
  - **改法**：两条文案在 16 个语言包里统一改为占位符 `{shortcut}`，由调用点注入 `formatShortcut('Cmd+Shift+C' | 'Cmd+V', envInfo.platform)`——macOS 得 `Cmd+Shift+C`，Windows/Linux 得 `Ctrl+Shift+C`。`CardEditorModal` 的输入框 placeholder 与预览空态两处共用同一个 `clozeShortcutStr`，`ImageOcclusionEditorModal` 用 `pasteShortcutStr`。
  - **刻意不动的两处**：`ioEmptyCanvasSub` 写的是「`Cmd+V / Ctrl+V`」两个平台并列列出，用户自己会对号入座；`settingsShortcutsSub` 是在解释「这里会自动适配 Cmd 与 Ctrl」这一机制本身。两者都已在句中出现 `Ctrl`，不属写死。
  - **守卫（Item #40，6 组断言）**：r4 的根因是「新增文案时漏了平台适配」，只修当前两条必然复发，所以守卫**不针对具体某个键**——扫描全部 16 个语言包，任何一条文案值只要出现 `Cmd` 却不同时出现 `Ctrl` 就判失败，并打印文件:行号:键名。另外断言两条键在每个语言包里都带 `{shortcut}`、`translate()` 的插值实现仍在、以及 `CardEditorModal` 的 2 处调用都真的传入了参数（否则界面会直接显示 `{shortcut}`）。
  - **验证**：① 变异测试——把 32 处 `{shortcut}` 全改回 `Cmd+Shift+C`（模拟「各语言包统一写死」这一 Item #33 抓不到的形态），Item #40 精确报出 32 条位置；② 端到端——esbuild 打包真实 `translations.ts` 后调用 `translate()`，确认 `mac` 得 `Cmd+Shift+C`、`win` 得 `Ctrl+Shift+C`、无裸占位符残留；德语与日语语言包抽验同样带 `{shortcut}`。

- **[WorkBuddy] 统一去掉「问号光标」+ 修正左侧栏「进度减负」在积压时的橙色实心格误读**（改 [`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`frontend/src/components/layout/Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx)、[`frontend/src/components/reviewer/ReviewerView.tsx`](frontend/src/components/reviewer/ReviewerView.tsx)）：
  - **1. 三处 `cursor-help`（问号光标）全部回落为默认光标**：帮助性提示靠 `title` 气泡与视觉上的 `?` 图标已经足够表达，光标再变问号属于多余且打断输入的信号——
    - 首页「连续打卡」旁的信息图标（用户指出的这一处）；
    - 首页牌组卡的掌握度百分比热区（刻意保留可点悬停范围，只把 `cursor-help` 换 `cursor-default`，`group/mastery` 悬停反馈不受影响）；
    - 复习界面标签栏的 `+N` 溢出芯片。
    - 复核：`grep -rn "cursor-help\|cursor: help" frontend/src` 返回 0 条。
  - **2. 「进度减负」不再给整格铺 `--status-warning-soft` 底色（触发条件是对的，改的只是呈现方式）**：
    - **现象**：Windows 机器上左下角「休假模式 | 进度减负」分段控件里右格是一块橙色实心格，看起来像「当前选中了进度减负」。
    - **前提澄清（重要，避免下一位助手误判为 bug）**：那台机器**当天未复习卡超过 200 张**，`total_due >= 60` 成立，`hasAvalanche` 为真是**正确行为**，数据层没有问题。本机合集实测为逾期 12 张 / 今天到期 27 张 / 新卡 2 张，`overdue` 与 `total_due` 都不到阈值，所以本机不亮——两台机器的差异来自数据，不是环境 bug。
    - **真正的缺陷在呈现**：该按钮与「休假模式」同处一个 `grid grid-cols-2` 分段容器。容器里某一格被**实心填充**，语义上就等于「这一项当前生效」——而 `hasAvalanche` 表达的是「你积压很多，建议来减负」，是系统检测出的提醒，不是用户自己打开的开关。同一个容器里「休假模式」用实心绿底表示用户真的开启了它，两种含义挤在一套视觉语言里，歧义是必然的（这次就是它把用户引到「默认状态出错」的方向去了）。
    - **改法**：只去掉那层会冒充「选中态」的底色，**保留警告色语义**（积压确实该报警，不该降级成品牌蓝）——有积压时图标与文字走琥珀色 + 实心琥珀圆点，无积压时保持原中性灰（`#9A9CA6` / `#5C5E66`）。
    - **文字色分档的原因**：`--status-warning`（`#CC7A25`）不区分明暗，作为 11px 正文压在浅色底上只有 **3.04:1**（压在 `#FFFFFF` 上 3.29:1），低于小字号 4.5:1 门槛——这是原设计就存在的问题，去掉填充后底色变浅反而更明显。因此浅色用 `#9A5B12`（对 `#F5F6F8` **5.01:1**、对 `#FFFFFF` **5.41:1**）、深色用 `#D98A3C`（对 `#17171C` **6.51:1**）。圆点维持 `bg-[var(--status-warning)]`，1.5px 非文字元素不受该门槛约束。
    - **提示点不再 `animate-pulse`**：积压是持续性状态（可能持续数周），常驻脉冲会长期占据周边视觉。若认为需要更强提醒，可单独把它加回来，与本改动无关。
    - **验证**：用真实 `web/assets/index.css` 以 3× DPR 渲染「改前 / 改后·有积压 / 改后·无积压」× 明暗两套主题共 6 格对照，确认改后不再读作「选中态」、警告感仍在、默认态零变化。

- **[WorkBuddy] 首页牌组卡配色改为「由主题色派生」，不再按位置轮流派发六个写死的色系**（新增 [`frontend/src/utils/deckPalette.ts`](frontend/src/utils/deckPalette.ts)，改 [`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - **问题**：后端 `_build_decks_list` 里 `color_idx = len(decks_out) % len(accents)`，把 indigo / blue / emerald / amber / rose / purple 六个色系按牌组顺序轮流发下去；前端再由 `deckAccentToTheme` 把这六个名字映射到主题库里的 indigo / cyan / emerald / amber / rose / violet。**卡片颜色因此与用户选定的主题色完全无关**——选了「经典蓝」，第二张牌组仍是青的、第三张仍是绿的、第四张是橙的，看起来像一套彩虹配色，而不是「我的主题」。
  - **改法**：以 `getAccentScale(accentColor, theme)` 为唯一色源，按牌组在列表中的次序叠加两档很轻的偏移，派生出一整套 `AccentScale` 供卡片使用：
    - **色相**：整族一起偏转，幅度封顶 ±13°。这个量级是实测定的——「经典蓝」h≈212°，+20° 就已经发紫、−20° 已经发青，再大就不再读作同一个主题色，等于把彩虹牌组换个写法装回去。
    - **浅底深度**：只作用于浅色填充（图标底、`学习` 按钮底、进度条浅段）。这些颜色明度都在 95% 上下，**只转色相根本看不出差别**，必须靠「同色相的不同浓淡」分离；深色主题里这些填充是 `rgba()` 半透明，深度改为调 alpha（0.16 → 0.196 / 0.232）。
    - **对比度补偿**：浅底变浓会把压在上面的 `brandText` 吃掉一截——只加深底色时，琥珀第 4 张、经典蓝与雾海蓝第 5 张掉到 3.7:1，低于小字号 4.5:1。让实色令牌（品牌色、文字色）按 0.8 系数跟着一起加深，8 套主题 × 明暗 × 5 档共 80 组全部回到 **4.5:1 以上（最低 4.66:1，中位 6.76:1）**，同时「越靠后越浓」的语义反而更统一。
    - 第 1 张牌组偏移为 0，即完全等于主题色本身：绝大多数用户只有一两个牌组，主牌组始终穿品牌色，第二张起才逐渐分化；第 6 张起回绕。
  - **配色边界**：`brand / brandHover / brandText / brandSoft / brandSoftStrong / brandSurface / brandBorder / brandMutedBar / heatmap[4]` 全部套用同一组偏移，所以一张卡内部的图标底、描边、进度条、悬停按钮永远自洽，不会出现「底是冷调、字是暖调」。
  - **图标不再与颜色耦合**：`deck.accent` 现在**只**决定图标形状（book / code / heart / folder / sparkles / layers），不再决定颜色；变量随之更名为 `deckIconByAccent`，避免下一位助手误以为它还是配色开关。
  - **守卫**：`test_frontend_bundle.mjs` 新增 Item #39（4 条断言）——模板里必须走 `buildDeckScales(accentScale)` 且 `deckScales` 要 memo（否则切主题色不重算）、`deckAccentToTheme` 不得复活、`deckPalette.ts` 内不得出现任何写死的十六进制颜色、色相偏移上限 15°（改回 ±28° 会立刻报「超过 15° 就跑出主题色家族了」）。两条变异测试已验证守卫会真的红。

- **[Gemini] 制卡弹窗与富文本编辑器第二轮深度打磨：单按钮循环预览、图片遮挡整合进工具栏、加粗/斜体状态翻转 Bug 修复与全工具栏 16 国语言本地化**（[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`frontend/src/components/quick-add/TowerWysiwygEditor.tsx`](frontend/src/components/quick-add/TowerWysiwygEditor.tsx)、[`frontend/src/i18n/translations.ts`](frontend/src/i18n/translations.ts)、[`frontend/src/i18n/locales/`](frontend/src/i18n/locales/)）：
  - **1. 顶栏「查看 ↔ 编辑」单按钮循环切换 + 移除左下角冗余查看按钮 + 图片遮挡整合进编辑器工具栏**：
    - 移除 `CardEditorModal.tsx` 左下角底栏的「查看 (`⌘P`)」按钮，底栏左侧仅保留未保存修改状态提示；
    - 将顶栏右上角原本拆开的「编辑 / 查看」双胶囊合并为**单个循环切换按钮**（编辑态显示「`👁 查看`」，点击进入预览后同一按钮切换为「`✎ 编辑`」，再点即回编辑态）；
    - 将「图片遮挡 / 编辑遮挡框」按钮从弹窗顶栏移入正面 `TowerWysiwygEditor` 的工具栏功能区（与 `[ ... ] 挖空`、`f(x)`、`高亮` 同行排布）。
  - **2. 根治「点击加粗/斜体输入文字后再点取消，按钮仍显示高亮、必须再输一个字才更新」的 Bug**：
    - **根因 A（DOM 祖先或运算覆盖）**：原 `updateActiveFormats()` 使用 `Boolean(findClosestElement(anchor, 'b, strong')) || document.queryCommandState('bold')`。在 `<b>文字|</b>` 末尾点击 `B` 取消加粗时，`document.execCommand('bold')` 已将浏览器待输入加粗开关（`queryCommandState('bold')`）翻转为 `false`，但打下一个字前 `anchorNode` 仍停在 `<b>` 内，导致 `findClosestElement` 恒为 `true` 并掩盖了 `false`；现对 `bold`、`italic`、`orderedList`、`unorderedList` 直接采用 `Boolean(document.queryCommandState(...))` 作为唯一权威状态。
    - **根因 B（`focusAndRestoreSelection` 重置 Range 抹除待输入状态）**：工具栏按钮已通过 `onMouseDown={e.preventDefault()}` 保持编辑器焦点，而原 `focusAndRestoreSelection()` 每次点击仍无条件执行 `sel.removeAllRanges(); sel.addRange(...)`，导致 Chromium 丢弃刚通过 `execCommand` 切换的待输入样式开关（Typing Style Override）；现仅在编辑器未聚焦时恢复选区，并新增 `document.addEventListener('selectionchange', ...)` 实时同步光标移动时的激活态。
  - **3. 工具栏全部提示、下拉菜单与最右侧 `?` 帮助浮窗 100% 本地化（16 国语言 + 平台动态快捷键）**：
    - 在 `translations.ts` 与 14 个 `locales/*.ts` 中补齐 29 个编辑器专属词条（`editorHelpTitle`、`editorToolBold`、`editorClozeBtnLabel`、`editorMarkBtnLabel` 等），彻底清除工具栏 `title`、标题/对齐下拉菜单以及最右侧 `?` 快捷键说明浮窗中的硬编码英文（`WYSIWYG`、`Bold`、`Cloze`、`Exit Cloze`、`Mark` 等），并通过 `formatShortcut(..., envInfo.platform)` 自动适配 macOS (`Cmd`) 与 Windows (`Ctrl`)。
  - **4. 额外深挖并修复的 4 项编辑器体验细节**：
    - **工具栏按钮统一设置 `tabIndex={-1}`**：消除在「正面」按 `Tab` 想跳到「背面」时焦点被迫在工具栏 16 个图标按钮上逐个停留的问题；
    - **标题级别（`P / H1 / H2 / H3`）激活勾选、二次点击退回正文与行末回车自动回 `<p>`**；
    - **空挖空/空高亮按 `Escape` 或切换预览时自动清理空壳**（`serializeFromWysiwyg` 过滤空 `{{c1::}}` 标签）；
    - **编辑区内边距移至 `contentEditable` 自身**，消除四周 16px 内边距点击无法落焦的死区。

- **[Gemini] 制卡富文本编辑器（`TowerWysiwygEditor.tsx`）全链路交互与输入法深度修复**（[`frontend/src/components/quick-add/TowerWysiwygEditor.tsx`](frontend/src/components/quick-add/TowerWysiwygEditor.tsx)、[`frontend/src/index.css`](frontend/src/index.css)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - **1. 消除点击「Cloze 挖空」与「Mark 高亮」出现真实 `...` 字符需手动删除的问题**：
    - 移除原先 `selectedText || '...'` 向 DOM 写入真实三个点字符且将光标置于胶囊外的反直觉逻辑；
    - 未选中文本直接点击 `Cloze`（或按 `Cmd+Shift+C`）时，插入带零宽锚点（`\u200B`）与 `data-empty="true"` 的空胶囊，并将光标**直接落入挖空内部**；通过 CSS `.anki-cloze-body[data-empty="true"]::after { content: '...' }` 渲染视觉虚影占位——无需按退格删除任何字符，直接打字即刻替换虚影。若已选中文本再点 `Cloze`，则自动包裹选中词并将光标落于胶囊外右侧。
  - **2. 根治挖空内中文输入法（IME）首字重复两遍的 Bug**：
    - **根因 A**：`.anki-cloze-pill` 原先使用 `display: inline-flex` 搭配子元素 `<span contenteditable="false">c1:</span>`，在 Chromium / QtWebEngine 的 `contentEditable` 中形成原子内联弹性盒边界，导致中文输入法 `compositionstart` / `compositionend` 锚定偏移错乱并将首字提交两次；现改为纯内联 `display: inline` + `box-decoration-break: clone` 并在空胶囊内维持 `\u200B` 文本节点锚点。
    - **根因 B**：`onInput` 原先在拼音合成过程（`isComposing`）中每次按键都触发序列化与外部 `value` 同步，并在清理 `\u200B` 时重建节点打断输入法；现新增 `isComposingRef`（`onCompositionStart` / `onCompositionEnd`），合成期间严禁重置 DOM，且在合成结束后使用 `CharacterData.deleteData()` 原位剔除零宽锚点，100% 保持光标与输入法状态不断裂。
  - **3. 补齐 5 种顺滑退出「挖空 / 高亮」模式的方式（解决一直按空格被困在挖空内的问题）**：
    - 在每个 `.anki-cloze-pill` 与 `<mark>` 右侧始终维护外部文本节点锚点，并在挖空/高亮内支持：① **连按两次空格（Double-Space）**自动删去末尾多余空格并跳出到普通正文；② 按 **`Tab` / `Enter`** 立即跳出胶囊；③ 在胶囊末尾按 **`→`（右方向键）** 跨出胶囊；④ 再次点击工具栏 **`Cloze` / `Mark` 按钮（或 `Cmd+Shift+C`）** 切换跳出；⑤ 鼠标点击胶囊右侧空白区域自动落位至胶囊外。
  - **4. 全面排查并修复编辑器其余 6 项体验缺陷**：
    - **一键退格删除空挖空**：挖空为空时按 `Backspace` / `Delete` 直接整枚移除，不再卡在 `c1:` 前缀上；点击 `c1:` 前缀可循环切换序号（`c1 ↔ c2`）。
    - **`f(x)` 数学公式即点即输**：未选中文本点击 `f(x)` 时不再塞入 `x^2 + y^2 = r^2` 假公式，而是插入 `\(  \)` 并将光标精准定位于括号正中间。
    - **插入表格无废字 + `Tab` 跳格**：插入表格不再预填 `#1/#2/#3` 与满格 `...`，插入后光标直达首格，并支持 `Tab` / `Shift+Tab` 在单元格间顺畅跳转（末格按 `Tab` 自动跳出至表格下方段落）。
    - **引用块（`Quote`）与代码块（`Code`）双向开关与回车退出**：再次点击工具栏按钮或块末空行按 `Enter` 即可退回普通段落 `<p>`。
    - **工具栏实时高亮激活态与字数统计去噪**：光标处于粗体、斜体、列表、引用、代码、挖空、高亮时工具栏对应按钮实时高亮；字数统计自动剔除 `c1:` 前缀与零宽字符。

- **[Gemini] 新建与编辑卡片新增实时交互式「卡片预览」工作台**（[`frontend/src/components/quick-add/CardEditorModal.tsx`](frontend/src/components/quick-add/CardEditorModal.tsx)、[`frontend/src/utils/mathRenderer.ts`](frontend/src/utils/mathRenderer.ts)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - **1. 顶栏分段切换器 + 底栏快捷入口 + 键盘直达（`⌘P` / `Ctrl+P`）**：
    - 在制卡/改卡弹窗顶栏右侧（图片遮挡按钮左侧）加入轻量二段式分段控件「**✎ 编辑 / 👁 预览**」（当笔记将生成多张子卡片时自动显示 `×N` 计数徽标），并在底栏左侧提供带 `⌘P` 提示的快捷切换按钮，无需挤压原有双塔富文本编辑区空间。
  - **2. 1:1 复刻复习器（Reviewer）质感的沉浸式翻面预览舞台**：
    - 切入预览态后直接呈现与真实学习界面一致的卡片画布、自适应字号阶梯（短词条 `28px–30px` 居中粗体、中等题干 `22px`、长段落/富媒体 `17px–18px` 左对齐）、问题面回忆提示条（`Space` 键或点击卡片任意位置翻转）以及答案面 `.ui-divider-reveal` + `.ui-answer-reveal` 揭晓动效，完整渲染 LaTeX 公式、表格、引用块、本地媒体图片、扩展字段（Additional Fields）与 `#标签`。
  - **3. 多空填空题（`c1` / `c2` / `c3`…）、图片遮挡与正反双向卡（`1 · 正面 → 背面` / `2 · 背面 → 正面`）独立子卡预览**：
    - 升级 `renderMathAndRichHtml(rawHtml, maskClozeAsQuestion, activeClozeOrd)` 支持按指定 `cN` 序号精准遮罩当前问题项（`[...]` 或琥珀色 `? #N`）并在答案面高亮为翠绿，同时将其余非当前序号（`cM, M ≠ N`）自然还原为明文或对应遮挡模式；当存在多个填空序号或选择了「正反双向卡」时，预览栏顶部自动浮现子卡切换胶囊。

- **[WorkBuddy] 测试套件升级至第四轮（Windows r4）口径：补齐旗标数据、排序全键序校验、自定义学习 6 组语义断言与 Item #37**（[`tests/scenarios/builder.py`](tests/scenarios/builder.py)、[`tests/scenarios/scenarios.py`](tests/scenarios/scenarios.py)、[`tests/scenarios/build.py`](tests/scenarios/build.py)、[`tests/scenarios/smoke.py`](tests/scenarios/smoke.py)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)、[`tests/WINDOWS_HANDOFF.md`](tests/WINDOWS_HANDOFF.md)、[`tests/scenarios/README.md`](tests/scenarios/README.md)）：前三轮验证之后新增了排序控件重排、自定义学习三层弹窗、同步云图标、编辑器 Esc 作用域等改动，原有用例已无法覆盖。本轮场景检查项由 **472 → 692**（11 场景，5.1 s），前端产物审计新增第 37 组。
  - **1. 修复「旗标功能从未被真实数据覆盖」的测试空洞（根因级）**：`ScenarioSpec` 新增 `flag_mix: dict[int, float]` 字段，builder 按比例从洗牌后的卡池里切分并真正写入 `cards.flags` 低 3 位，同时把 `flag_dist` 记入场景元数据。此前**全项目没有任何一处写入过 `cards.flags`**——旗标筛选、旗标分面计数、旗标专项特训、7 色旗标选择器全都在「零旗标」的数据上空转，通过与否毫无意义。现 `mixed` 场景挂载 7 色旗标（约 38% 卡片带旗标，实测分布 `{0:267, 1:43, 2:34, 3:26, 4:22, 5:17, 6:13, 7:9}`），其余场景保持零旗标以继续守住「无旗标时不误报」的分支。
  - **2. 排序从「能返回结果」升级为「结果真的有序」**：新增 `run_library_sort_checks()`，覆盖 `search_service` 全部 7 个排序分支（`lapses_desc` / `ivl_asc` / `ivl_desc` / `due_asc` / `stability_asc` / `front_asc` / `newest`），用 `_sort_projection()` 复刻每一条后端排序语义后逐条断言：① `total` 不因排序改变（排序只换顺序、不缩结果集）；② 返回序列在投影上单调；③ 传入未知 `sortBy` 既不报错也不返回空集。
  - **3. 自定义学习 6 组语义断言**：新增 `run_custom_study_preset_checks()`——`custom-study:preview`（各预设「匹配 N 张」必须等于 `min(limit, totalMatched)` 且回传 `isPreviewOnly === true`）、`custom-study:start`（`count` 与 `cardIds` 长度一致、`isPreviewOnly` 原样回显、抽出的卡须真的符合该预设语义）、`custom-study:flag-color`（选 3 号色只能抽到 3 号色）、`custom-study:no-schedule-side-effect`（四次以 `isPreviewOnly=false` 起学后调度快照 diff 必须为 0）、`custom-study:flag-data`（`mixed` 场景必须真的存在带旗标卡，防止这组断言未来再次退化为空转）、`custom-study:deck-scope`（限定牌组时不得混入其它牌组）。
  - **4. 修掉两个由测试自身引入的假失败**：`deck-scope` 最初用 `decks where id > 1 order by id` 取牌组，取到的是「零卡片的父牌组」，且用 `::` 拼子牌组名——而 Anki 原始 SQL 里 `decks.name` 的分层分隔符是 `\x1f`。改为按卡片数降序取牌组、并把 `\x1f` 还原成 `::` 后通过。两处**均为用例 bug，不是产品 bug**。
  - **5. 可复现指纹纳入 `flags`**：`build.py` 的卡片指纹查询增加 `flags` 列，否则旗标数据的差异不会被指纹发现。重建后 `mixed … notes a3c05a62cdc5dca8 cards d3e15ebf22344c23`、`exam … notes 7ef8d9adb02e1583 cards 99535d267aec5dfd`。
  - **6. 前端产物审计新增 Item #37（10 条断言）**：锁定本轮四处视觉改动——卡片库排序控件已脱离筛选胶囊组（`ms-auto` + `aria-haspopup="menu"` + 无 `rounded-full`）且下拉锚定 `end-0`、`SyncStatusPill` 改用 `SyncStateIcon size="sm"` 并无残留 `bg-[#22C55E]`、`SyncStateIcon` 已同步态取 `--brand-text`、`DashboardView` 无 `⌘K` / `<kbd>` 残留、`TowerWysiwygEditor` 的 Esc 监听必须注册在捕获阶段且带 `anyDropdownOpenRef` 前置判断、`StreakFlameBackdrop` 必须保留 `glowGradId` + `<ellipse>`、`.dashboard-hero` 必须保留 `radial-gradient`。后三条专门用于防止「已确认要保留的效果被后一位助手再次误删」。
  - **7. 交接文档同步**：`WINDOWS_HANDOFF.md` 补上「必须先重建场景（旧 `lib\` 零旗标）」的警告、期望值改为 `692 项检查全部通过`、登记 3 项已知缺陷告警、新增 7 组检查说明表、UI 人工核对清单由 8 项扩至 **15 项**（新增火焰暖光晕 / 无快捷键角标 / 云朵主题色 / 排序靠右且不溢出 / 排序真实换序且分隔线仅在筛选时出现 / 表情浮层与 Esc 作用域），并要求额外跑一次 `run.py mixed` 的旗标核对、截图落到 `screenshots/r4/` 以保持 `r3/` 结论有效。

- **[Gemini] 「自定义学习」弹窗（`CustomStudyModal.tsx`）三层信息架构重构与模式专属动态参数收敛**（[`frontend/src/components/study/CustomStudyModal.tsx`](frontend/src/components/study/CustomStudyModal.tsx)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - **1. 解决高饱和实心蓝泛滥（Primary Color Overload）**：
    - 原弹窗内同时出现 5 处高饱和实心主色（模式选中图标、错题天数 `7d`、抽卡上限 `30`、特训开关、底部主按钮），导致视觉重心碎裂。
    - 现重构为清晰的 3 级色彩权重：仅底部主行动按钮「**▶ 开始专项特训 (N)**」保留高饱和实心品牌色（Level-1 Primary CTA）；模式卡片与天数胶囊采用柔和品牌色调（Level-2 Tonal，`border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]`）；「本轮抽卡上限」改为 macOS 风格一体化分段滑块轨道（`bg-white dark:bg-[#2A2C38] shadow-2xs`）。
  - **2. 顶栏全局作用域提升 + 模式驱动的动态专属参数（Contextual Controls）**：
    - 将全局前提「**目标牌组**」提升至精简后的顶栏右侧，去除顶栏下冗余长句副标题；
    - 中部配置区严格随所选特训模式切换主控件：「错题集特训」与「提前复习」直出 5 档时间跨度选择器；「旗标 / 标签专项」直出 7 色旗标与 `#标签` 选择器；在其他三个非旗标模式下，将「按旗标 / 标签筛选」收纳进原生 `<details>/<summary>` 渐进式披露折叠栏（有附加筛选时显示数量角标与一键重置），消除原先 9 个旗标按钮常驻霸屏的视觉拥挤。
  - **3. 修正「额外新卡加练」的调度与排序逻辑**：
    - 未学新卡（`ivl=0, lapses=0`）无所谓“失误最多”或“间隔最短”，在「额外新卡加练」模式下将排序选项收敛为合理的「到期/加入顺序」与「随机乱序」，并将该模式下的默认调度开关设为正式计入 FSRS 学习（仍支持手动切换为纯预览），同时补齐 `Escape` 键关闭弹窗支持。

- **[WorkBuddy] 首页顶栏两处视觉收敛：移除搜索框快捷键角标、同步状态绿点改为云端图标**（[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`frontend/src/components/dashboard/SyncStatusPill.tsx`](frontend/src/components/dashboard/SyncStatusPill.tsx)、[`frontend/src/components/common/SyncStateIcon.tsx`](frontend/src/components/common/SyncStateIcon.tsx)）：
  - **搜索框去掉常驻快捷键角标**：删除右上角搜索框内 `⌘K` / `Ctrl K` 的 `<kbd>` 徽标，仅保留放大镜图标与「搜索卡片与牌组」提示文字（容器由 `justify-between` 回归单子元素排布），同时清理因此空置的 `formatShortcut` 导入与 `envInfo.platform` 取值。
  - **同步状态指示器由纯色绿点改为云朵图标**：`SyncStatusPill` 触发区原先的 `bg-[#22C55E]` 圆点复用 `SyncStateIcon`（`size="sm"`，14px 定宽槽位避免状态切换时文字跳动），形状随真实状态变化——已同步 = 云朵、同步完成瞬间 = 对勾、从未同步 = 断云、同步中仍保留橙色脉冲点。配色统一走**主题色**（`var(--brand-text)`，随用户所选强调色变化），与浮窗标题栏、设置页同步卡片三处形态与色彩完全一致。
  - **保留 `StreakFlameBackdrop` 的径向暖光晕与 `.dashboard-hero` 橙色径向底色**：经实机对比确认 Gemini 这版「外焰柔光 + 暖芯 + 右侧暖光晕」的组合优于早期只有剪影的版本，本轮不再回退，双层火苗与新版 `viewBox` 留白一并沿用。

- **[WorkBuddy] 卡片库筛选栏：排序脱离筛选胶囊组，改为右侧独立的「视图属性」控件**（[`frontend/src/components/search/LibraryView.tsx`](frontend/src/components/search/LibraryView.tsx)）：排序与筛选是**交叉维度**（筛选决定「看哪些」，排序只决定「看什么顺序」，不缩小结果集），原先却与状态/难度/旗标/标签/牌组共用同一套带边框胶囊样式并排陈列，层级被抹平。本轮重排：
  - **位置**：移出筛选组，`ms-auto` 顶到该行最右侧，与左侧筛选形成「左：筛选 / 右：视图属性」的二段式结构；匹配计数与排序同组，两者之间用 1px 竖线分隔。
  - **形态**：由带边框胶囊改为**无边框 Ghost 按钮**（仅 hover/展开时给一层极浅底色）——筛选组全员是描边胶囊，唯一的无边框控件自然读作「另一类东西」。
  - **排印**：`排序` 用 11.5px 弱化小字，`·` 分隔符降到 40% 不透明度，当前值用 12px/500 正文色；排序偏离默认时仅将图标与值染成 `var(--brand-text)`，不填充底色，避免又变回「一个被选中的筛选」。
  - **竖线的出现条件**：仅在「匹配 N 张」计数存在时渲染。计数缺席时单独一条竖线会退化成一根无处依附的杂线（已离屏比对 A/B 两版确认）。
  - **下拉方向**：菜单锚点由 `start-0` 改为 `end-0`，避免控件贴右后被面板右侧溢出裁切。

- **[WorkBuddy] 制卡富文本编辑器 Esc 作用域收敛**（[`frontend/src/components/quick-add/TowerWysiwygEditor.tsx`](frontend/src/components/quick-add/TowerWysiwygEditor.tsx)）：下拉浮层（表情/标题/表格/对齐/快捷键说明）的 `Esc` 关闭逻辑原先挂在 `document` 冒泡阶段，会与制卡弹窗自身的 `Esc` 关闭同时命中——表情面板打开时按一次 Esc 会直接触发整窗关闭（脏数据还会弹二次确认）。改为 **捕获阶段 + 仅在有浮层打开时拦截并 `stopPropagation`**，无浮层打开时完全不介入，Esc 正常关闭弹窗。

- **[Gemini] 牌组卡片「学习」按钮二级视觉降阶、学习统计页图表 Hover 浮窗统一与新建卡片编辑器表情选择器修复**（[`frontend/src/index.css`](frontend/src/index.css)、[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`frontend/src/components/stats/StatsView.tsx`](frontend/src/components/stats/StatsView.tsx)、[`frontend/src/components/quick-add/TowerWysiwygEditor.tsx`](frontend/src/components/quick-add/TowerWysiwygEditor.tsx)、[`tests/test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs)）：
  - **1. 首页牌组卡片「学习」按钮降为第 2 层级（Tonal / Soft Primary）**：
    - 英雄区「`▶ 开始今日学习`」保持全场唯一的**第 1 层级**高饱和实心主按钮（`bg: var(--brand)` + 纯白文字 + 品牌色投影）；
    - 将每张牌组卡片右下角的「`▶ 学习`」（`.deck-study-btn`）由实心纯白字降为**第 2 层级柔和品牌色调按钮**（`background-color: var(--deck-brand-soft)`、`color: var(--deck-brand-text)`、`border: 1px solid color-mix(in srgb, var(--deck-border) 72%, transparent)`，悬停加深至 `var(--deck-brand-soft-strong)`），与左上角牌组图标色调遥相呼应，既不争夺英雄区主按钮的注意力，又在色彩饱和度与边界感上明显高于旁边**第 3 层级**透明描边的「`查看`」按钮（`.deck-view-btn`）。
  - **2. 学习统计页（`StatsView.tsx`）全部图表鼠标 Hover 浮窗与首页 `.dashboard-tooltip` 统一**：
    - 移除「未来 30 天复习负载预测」、「卡片成熟度构成」、「12 周历史记忆留存率」与「24 小时学习活跃分布」四张图表原先使用的浏览器原生 `title` 提示，统一接入与首页热力图/周节奏一致的 `.dashboard-tooltip` 语义化双行浮动卡片（第 1 行次级灰展示日期/时段/分段维度，第 2 行彩色 `tabular-nums` 展示张数、成熟/年轻拆分或记忆准确率），支持鼠标悬停与键盘聚焦双触发，并带左右边界夹紧防溢出。
  - **3. 修复新建卡片富文本编辑器（`TowerWysiwygEditor.tsx`）点击表情无弹窗的问题**：
    - **根因**：工具栏容器设置了 `overflow-x-auto`（根据 CSS 规范强制将 `overflow-y` 计算为 `auto` 形成裁切盒），且外层编辑器容器设置了 `overflow-hidden`，导致高度超过 36px 工具栏的 `absolute top-8` 下拉浮层（表情、标题、表格、对齐、快捷键说明）被 100% 裁切不可见。
    - **修复**：移除工具栏 `overflow-x-auto` 与外层容器 `overflow-hidden`（改为 `flex-wrap` 与顶部独立圆角 `rounded-t-[11px]`），补齐 `toolbarRef.contains` 外部点击判断、多下拉菜单互斥开关（`toggleDropdown`）、`Escape` 关闭以及编辑器光标选区记忆恢复（`savedRangeRef`，即使未先点击编辑区也能自动将表情插入末尾），并将常用制卡表情扩充至 20 枚（5×4 网格）。

- **[Gemini] 首页纵向版式间距与视觉呼吸感优化（遵循 `@modern-web-guidance` 留白与视觉层级规范）**（[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`frontend/src/components/dashboard/StreakFlameBackdrop.tsx`](frontend/src/components/dashboard/StreakFlameBackdrop.tsx)、[`frontend/src/index.css`](frontend/src/index.css)）：
  - **修复顶栏与英雄卡上沿粘连**：移除 [`index.css`](frontend/src/index.css) `.dashboard-header` 原有的 `margin-block: -4px` 负向收缩与半透明吸顶遮罩（避免首屏态把英雄区往上拉并贴近 `11 月 12 日 · 星期四`），并将问候语与日期行距由 `mt-0.5` 提升至 `mt-1.5`。
  - **拉开全页四大区块纵向节奏**：将 `.dashboard-shell` 外围内边距由 `px-5 sm:px-6 lg:px-8 py-5 sm:py-6` 提升至 `px-6 sm:px-8 lg:px-10 py-6 sm:py-8`，纵向区块间距由 `space-y-6`（24px）提升至 `space-y-7 sm:space-y-8`（28px–32px）。
  - **舒展英雄卡内部行距与火焰顶距**：
    - 卡片内边距由 `px-6 sm:px-7 py-5 sm:py-6` 升级为 `px-7 sm:px-9 py-6 sm:py-7`（圆角 `rounded-[24px]`）；
    - 中左三行文案栈（「今日学习进度」/「还剩 N 张 · 预计 M 分钟」/「待复习 X · 新卡 Y」）行距由紧绷的 `space-y-1.5` 拉开为 `mt-2.5` + `mt-3`，使三行总高度与左侧 `104px` 进度圆环自然对齐；
    - 右侧「连续打卡 ⓘ」与「20 天」大数字纵向间距由 `lg:gap-1`（4px）拉开至 `lg:gap-2.5`（10px）；
    - 调整 [`StreakFlameBackdrop.tsx`](frontend/src/components/dashboard/StreakFlameBackdrop.tsx) 高度与 `viewBox`（`h-[138px]`，主火尖下移至 `y=18`），在卡片顶部留出约 `22px` 纯净留白，避免火尖顶到卡片上边框。
  - **优化牌组与统计区内部留白与搜索框展示**：牌组网格与底部图表网格间距统一升级为 `gap-5`，牌组卡片内边距提升至 `px-6 py-5.5`（分段进度条上下间距 `mt-5` / `mt-4.5`），热力图与周节奏卡片升级为 `p-6 sm:p-7` + `my-5` + `pt-4`；右上角搜索框复用既有 `cmdPaletteAriaLabel` 呈现「搜索卡片与牌组」（快捷键角标经复核已于本轮移除，见上方 WorkBuddy 条目）。

- **[Gemini] 首页顶栏与「今日学习进度」英雄区视觉对齐重构**（[`frontend/src/components/dashboard/DashboardView.tsx`](frontend/src/components/dashboard/DashboardView.tsx)、[`frontend/src/components/dashboard/SyncStatusPill.tsx`](frontend/src/components/dashboard/SyncStatusPill.tsx)、[`frontend/src/components/dashboard/StreakFlameBackdrop.tsx`](frontend/src/components/dashboard/StreakFlameBackdrop.tsx)、[`frontend/src/index.css`](frontend/src/index.css)）：
  - **顶栏（Header）**：问候语连接符支持中文全角逗号（`晚上好，大馒头`），日期副标统一采用 `11 月 11 日 · 星期三` 中圆点分隔；同步状态改为无外框内联指示器（绿点 `•` + 同步相对时间 + 独立刷新图标 `↻`，悬停仍弹出完整快照详情浮窗）；右侧搜索框以放大镜图标 +「搜索卡片与牌组」提示文字呈现。
  - **英雄区（Hero Card）四栏水平居中布局**：
    1. **左栏进度环**：`104×104` 圆环居中展示已完成张数与 `/ N 张` 总量；
    2. **中左三行文案栈**：第一行「今日学习进度」，第二行大字号「还剩 N 张」+「预计 M 分钟」，第三行由原彩色胶囊沉淀为清爽的纯排印内联可点击统计「`待复习 14 · 新卡 2`」（点击仍直达卡库对应筛选）；
    3. **中右操作按钮组**：由原先压在标题正下方改为在卡片中部偏右水平居中排列（「`▶ 开始今日学习`」+「`⚡ 轻量复习`」+ 带滑块调节图标的「`自定义学习`」）；
    4. **右栏连续打卡与双层暖焰背景**：移除桌面端多余的左侧竖向分割线与底部「最长 N 天」副标（合并至 `ⓘ` 规则浮层内），`19 天` 升级为 `34px` 暖橙粗体数字，搭配 `StreakFlameBackdrop` 新增的双层火苗（外焰 + 暖芯）与右侧径向暖光晕（英雄卡底色同步改为同位置橙色径向淡染，光晕与卡片底色连成一体）。

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

- **[WorkBuddy]** 窗口扩展改为一次性 + 火焰在窄屏隐藏（[__init__.py](__init__.py)、[StreakFlameBackdrop.tsx](frontend/src/components/dashboard/StreakFlameBackdrop.tsx)）：
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

- **[WorkBuddy]** 修复侧边栏「设置」齿轮图标残缺（[Sidebar.tsx](frontend/src/components/layout/Sidebar.tsx)）：
  - **根因**：path 里 `a2 2 0 0 1-2-2` 少了一个空格。SVG 允许用负号当分隔符，于是它被解析成 `sweep=1, dx=-2, dy=-2`，而本意是 `dx=+2, dy=-2`——齿轮顶部那一段弧往反方向画，整圈就不闭合，看起来像缺了一块。
  - **修法**：换成 lucide 标准 `settings` 路径（12 齿 + 中心圆），不再手工维护这段坐标。
  - 验证：截图确认齿轮闭合对称；`tsc` 0 错误、Bundle 审计 ALL PASSED、37 项单测通过。

- **[WorkBuddy]** 「自定义学习」入口按钮与弹窗标题统一（[translations.ts](frontend/src/i18n/translations.ts)、[locales/](frontend/src/i18n/locales)）：
  - 按钮原为「自定义学习 / 错题特训」、弹窗标题为「自定义学习与错题集特训」，但点进去是通用自定义学习面板（可按状态 / 难度 / 标签 / 牌组组合筛选，错题集只是其中一个预设），副标题名不副实。两处统一为「自定义学习」。
  - 16 种语言的 `customStudyEntryBtn` / `customStudyModalTitle` 同步去掉副标题（EN: `Custom Study / Cram` → `Custom Study`；DE: `Benutzerdefiniertes Lernen & Fehlertraining` → `Benutzerdefiniertes Lernen`…），避免只有中文变短、其他语言仍拖着一长串。
  - 验证：`tsc` 0 错误、Bundle 审计 ALL PASSED、37 项单测通过、产物 677.04 kB。

- **[WorkBuddy]** 首页三处视觉收敛（[DashboardView.tsx](frontend/src/components/dashboard/DashboardView.tsx)）：
  - **连胜火焰去掉柔化**：`StreakFlameBackdrop` 只保留清晰的火苗剪影——移除 `feGaussianBlur`（`stdDeviation=2`）与底部那层径向光晕，两者叠加会在卡片底边糊出一片橙雾；底部改用渐变自身的 `stop-opacity` 淡出，被卡片圆角裁切时不留硬边。透明度从 0.20 → 0.22（深色 0.28 → 0.30），补偿去掉柔化后的视觉重量。（**已被后续版本取代**：见上方「双层暖焰背景」，改用低不透明度径向光晕 + 双层清晰火苗，实机对比效果更好，`feGaussianBlur` 不再回归。）
  - **移除牌组卡片常驻播放键**：右下角默认不再显示圆形 ▶，只在悬停时出现「查看 / 学习」两个胶囊；给按钮容器补 `min-h-7` 占位，避免悬停瞬间卡片高度抖动。
  - **统计标签并入信息行**：「待复习 / 新卡 / 已完成」三个 pill 从按钮行右侧搬到「预计 N 分钟」后面，与剩余卡数同行展示；按钮行只保留「开始今日学习 / 轻量复习 / 自定义学习」等动作，行动与数据分层更清楚。
  - **连胜数字去图标改色**：去掉「19 天」前面那个 20px 火苗图标，数字本身改为火焰色 `#FF8A00`（与背景火焰渐变中段同色），把「火」的语义从图标交给数字；`天` 与「最长 N 天」保持次级灰，层级仍然清楚。
  - 验证：`tsc --noEmit` 0 错误、Bundle 审计 ALL CHECKS PASSED、产物 677.62 kB。

- **[WorkBuddy]** 语言字典拆包（首包 −392 kB）+ 越南语修正 + `Item #33` 字典守卫（[translations.ts](frontend/src/i18n/translations.ts)、[locales/](frontend/src/i18n/locales)、[App.tsx](frontend/src/App.tsx)）：
  - **拆分**：`translations.ts` 从 8902 行降到 1490 行，14 种语言移到 `i18n/locales/*.ts`，只留 zh-CN / en 两份常驻首包（这两份是最常用、也最不能接受首屏闪烁的）。
  - **懒加载**：新增 `ensureLanguageLoaded` / `isLanguageLoaded`；`App.tsx` 在 `resolvedLang` 变化时按需 `import()` 对应 chunk，加载完成后用 `useReducer` 强制重渲染一次。`translate()` 保持同步，查表顺序 `LAZY_DICTS → DICT → EN → key`，加载失败也只会回落英文、不阻塞渲染。
  - **体积**：主包 **1,070.69 → 678.43 kB**（gzip 288.28 → 179.13 kB）；另出 14 个语言 chunk，每个 25–37 kB（gzip 9.7–11.7 kB），切到该语言时才拉。
  - **越南语修正**：`customStudyPresetMistakesTitle`（"Đặc训"）、`icuNoHistorySub`（"lưu快照"）、`streakRulesTooltipBody`（"chuỗi打卡"）三条中越混杂改为纯越语表述。
  - **守卫**：新增 `Item #33`——16 份字典的 key 集合与中文基准逐一对齐、占位符集合逐键比对、越南语不得出现 CJK 字符。三条断言都做过变异测试（`{n}`→`{N}`、删掉 `backBtn`、塞入汉字），确认会红而不是空跑。
  - 验证：`tsc --noEmit` 0 错误、Bundle 审计 ALL CHECKS PASSED、37 项 Python 单测通过；实测切到日语时懒加载 chunk 正确加载并完成渲染。

- **[WorkBuddy]** 首页与侧边栏四处交互修正（[Sidebar.tsx](frontend/src/components/layout/Sidebar.tsx)、[DashboardView.tsx](frontend/src/components/dashboard/DashboardView.tsx)、[translations.ts](frontend/src/i18n/translations.ts)）：
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

- **[WorkBuddy]** 下线「默写」相关功能：复习界面的自检模式 + 制卡弹窗的默写卡预设（[ReviewerView.tsx](frontend/src/components/reviewer/ReviewerView.tsx)、[CardEditorModal.tsx](frontend/src/components/quick-add/CardEditorModal.tsx)）：
  - **下线理由**：比对目标只取第一个 `{{cN::}}` 或背面首行（截 120 字），多空卡与长答案判不准；LCS 逐字评分只影响显示、不写回调度，对「这一步该评 Again 还是 Good」没有决策价值。另外它的 10 个文案键从未进过字典，界面上一直显示 `typeAnswerModeBtn` 这类原始标识符（已核 HEAD 版本，不是本轮回退）。
  - **删除范围**：`typeAnswerEnabled` / `typeAnswerInput` / `typeAnswerInputRef`；卡片切换时按 `默写` / `type` / `type-answer` 标签与笔记类型名自动开启的 `autoType` 逻辑；`expectedTypeTarget` 与 `typeAnswerDiff` 两个 useMemo（含整套 LCS 动态规划）；工具栏开关按钮、翻面后的逐字对比面板、正面的默写输入框。正面底部保留原有 `recallPrompt` 提示，布局不变。
  - **连带下线制卡预设**：制卡弹窗的「默写卡」（`selectedPreset === 'type_answer'`）一并移除——预设列表项、`NoteCreationPreset` 字面量、`NoteTypeOption.isTypeAnswer`、`typeAnswerMode` 传参、预设标题与背面徽章分支全部清掉；后端 [`edit_service.py`](bridge/edit_service.py) 的 `type_answer_mode` 参数与「自动补 `默写` 标签」逻辑同步删除，[`useAppStore.ts`](frontend/src/stores/useAppStore.ts) 的对应标签注入也一并去掉（`effectiveTags` 直接取 `payload.tags`）。
  - **测试同步**：`test_bridge` 第 3 段由「必定注入默写标签」改为「即使旧调用方仍传 `typeAnswerMode` 也不再注入」；`Item #30` 去掉对已删两个 `useMemo` 的引用，只保留「最后一个 Hook 必须早于会话完成态 return」的位置守卫。
  - **防回归**：`tests/test_frontend_bundle.mjs` 的 `Item #22` 从正向断言改为反向断言（`!typeAnswerEnabled`、`!typeAnswerDiff`，同时要求 `recallPrompt` 仍在），Bundle 审计与 37 项 Python 单测全绿。

- **[WorkBuddy]** 「连续打卡」标题新增计数规则说明浮层（[DashboardView.tsx](frontend/src/components/dashboard/DashboardView.tsx)）：
  - 标题右侧加 14px 灰色 info 图标（`cursor-help`），hover 或键盘聚焦弹出 248px 说明卡，解释连胜的判定口径。
  - **文案严格对齐后端实现**（`deck_service._build_heatmap_and_streak`）：活跃日 = `revlog` 中 `type < 4 AND ease > 0` 的任意一次作答（答错也算）；今天尚无记录时 `cursor` 回退到昨天判定，所以早上打开不会清零；`frozen_dates`（休假冻结日）计入活跃、不断连胜。
  - **不被裁切**：卡片的 `overflow-hidden` 从 `<section>` 移到专管火焰的裁剪层，否则浮层会被卡片圆角切掉；浮层 `z-50`，`group-hover/streak` + `group-focus-within/streak` 双通道触发，键盘可达。

- **[WorkBuddy]** 首页「今日学习进度」卡片新增连胜火焰背景（[StreakFlameBackdrop.tsx](frontend/src/components/dashboard/StreakFlameBackdrop.tsx)、[DashboardView.tsx](frontend/src/components/dashboard/DashboardView.tsx)）：
  - 在卡片右侧「连续打卡 / 最长 N 天」区域铺一层低透明度暖色火焰插画，把「连胜」的意象做成大面积淡背景，而不是只靠 20px 的小火苗图标。
  - **形状**：双尖浅谷的火苗轮廓（谷深约占全高 28%，刻意避开对称双尖的「兔耳感」与单尖的「水滴感」），底部圆弧展开；底部叠一层径向暖光，制造「光从下方升起」。
  - **淡出处理**：`feGaussianBlur(2)` 虚化边缘，渐变最低端 `stop-opacity` 归零——被卡片圆角裁切时不会留下水平硬线（此前一版在卡片底边有明显橙线）。
  - **层叠**：卡片 `<section>` 补 `relative overflow-hidden` 承载背景，中间内容与连胜区块包 `relative z-10`，保证文字、按钮始终在火焰之上；火焰本身 `pointer-events-none` + `aria-hidden`，不参与交互与读屏。
  - **主题**：浅色 0.20、深色 0.28（深底上橙色容易发闷，需略提），色相走 `#FF4D21 → #FF8A00 → #FFB23C`。
  - 验证：在 Vite dev（5173）用无头 Chrome 截图逐版比对形状与浓度，还原 mock 数据后 `tsc`/门禁复核。

- **[WorkBuddy]** 修复快捷搜索（Cmd+K）点「清空」后光标丢失（[CommandPaletteModal.tsx](frontend/src/components/search/CommandPaletteModal.tsx)）：
  - **现象**：首页点开快捷搜索、输入关键词后点「清空」，焦点不在输入框，必须再点一次才能继续输入。
  - **根因**：清空按钮 `onClick` 只调 `appActions.searchCmdKDebounced('')`；`mousedown` 时浏览器把焦点交给按钮，随后 `cmdKQuery` 变空、按钮被 `{cmdKQuery && …}` 条件卸载，焦点落到 `body`，输入框彻底失焦。
  - **修复**：为输入框补 `searchInputRef`；按钮 `onMouseDown` 阻止默认行为（焦点不离开输入框，中文输入法也不被中断），`onClick` 清空后 `searchInputRef.current?.focus()` 显式交还焦点；顺带给按钮补 `aria-label`。
  - **验证**：`tests/test_frontend_bundle.mjs` 新增 `Item #32`，并用变异测试确认有效——删掉 `focus()` 调用后该断言立即失败，恢复后全绿；`tsc --noEmit` 0 错误、Python 单测 37 项通过、`npm run build` 已重建产物。

- **[Gemini] 新增对齐 Anki 官方客户端的 16 国多语言国际化系统（Multi-Language i18n System）**：
  - **16 国语言全量对齐**：对齐 Anki 桌面端核心支持的 16 种官方语言：简体中文（`zh-CN`）、繁體中文（`zh-TW`）、English（`en`）、日本語（`ja`）、한국어（`ko`）、Español（`es`）、Français（`fr`）、Deutsch（`de`）、Русский（`ru`）、Português (Brasil)（`pt-BR`）、Italiano（`it`）、العربية（`ar`）、Tiếng Việt（`vi`）、Türkçe（`tr`）、Polski（`pl`）、Nederlands（`nl`），并支持「跟随 Anki 客户端（`auto`）」自动读取 `anki.lang.current_lang`。
  - **后端语言归一化与本地化**：在 [`bridge/deck_service.py`](bridge/deck_service.py) 中新增 `SUPPORTED_LANG_CODES`、`ANKI_LANG_ALIAS_MAP` 与 `normalize_language_code()`（兼容 `zh_CN`、`zh_TW`、`ja_JP`、`pt_BR` 等 Anki 底层 locale 命名），并为 16 种语言提供原生问候语（`_get_greeting`）、7 日星期短标签（`_get_weekday_short_labels`）与日期格式化（`_format_date_display`）。
  - **前端多语言字典引擎与设置中心选择器**：重构 [`frontend/src/i18n/translations.ts`](frontend/src/i18n/translations.ts)，内置 16 国完整翻译字典（`DICT`）、`SUPPORTED_LANGUAGES` 元数据、浏览器/客户端语言自动探测以及基于 `Intl.RelativeTimeFormat` / `Intl.DateTimeFormat` 的多语言时间格式化；升级 [`frontend/src/components/settings/SettingsModal.tsx`](frontend/src/components/settings/SettingsModal.tsx) 与 [`frontend/src/components/design-system/DesignSystemView.tsx`](frontend/src/components/design-system/DesignSystemView.tsx) 的语言切换卡片，提供 16 国语言下拉选择器与高频语言一键胶囊切换。
  - **验证**：新增 Python 单测 `test_26_multi_language_16_locales_resolution_and_formatting` 与 Bundle 审计 `Item #31`，前端编译、Bundle 审计与 Python 单测全部通过。

- **[WorkBuddy]** 修复复习界面渲染崩溃（React `#310 Rendered more hooks than during the previous render`，[ReviewerView.tsx](frontend/src/components/reviewer/ReviewerView.tsx)）：
  - **根因**：`// Milestone 3` 的 `expectedTypeTarget` 与 `typeAnswerDiff` 两个 `useMemo` 写在 `if (isSessionComplete || !currentCard)` 早退**之后**。进入复习模式时 `reviewQueue` 先为空（渲染完成态，Hook 数量少 2 个），队列异步到达后同一实例再次渲染便多出 2 个 Hook → React 直接抛 #310，整屏被渲染异常兜底页接管。
  - **修复**：将两个 `useMemo` 上移至早退之前（均在内部保留 `!currentCard` / `!expected` 空值守卫），使两条渲染路径的 Hook 数量恒定；`orderedFieldKeys`、`activeFlagNum` 等纯计算仍留在早退之后。
  - **回归守卫**：`tests/test_frontend_bundle.mjs` 新增 `Item #30`，以字符串位置比对断言「ReviewerView 中最后一个 Hook 必须早于会话完成态 return」，并用 `git show HEAD` 的旧版源码验证该断言确实能捕获此缺陷（旧版 18973 > 11919，判定失败）。
  - 验证：`node tests/test_frontend_bundle.mjs` 全绿、Python 单测 36 项全绿、`npm run build` 重新产出 `web/assets`。

- **[Antigravity]** 精简制卡弹窗（[CardEditorModal.tsx](frontend/src/components/quick-add/CardEditorModal.tsx)）冗余连建交互：移除各字段的 `📌 固定` 开关、标签栏的 `📌 连建时保留标签` 开关、顶栏 `已连建 N 张` 徽章以及底部 `保存并继续 +1` 按钮（含对应 `Cmd+Shift+Enter` 分支与 `keepOpen`/pin 状态），更新 [`test_frontend_bundle.mjs`](tests/test_frontend_bundle.mjs) `Item #22` 校验规则。

- **[Antigravity]** 优化卡片库（[LibraryView.tsx](frontend/src/components/search/LibraryView.tsx)、[index.css](frontend/src/index.css)、[mathRenderer.ts](frontend/src/utils/mathRenderer.ts)）卡片与表格预览 UI：
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
