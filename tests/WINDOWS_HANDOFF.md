# Windows 端验版作业指导

> 这份文档写给 **Windows 测试机上的 AI 助手**。你没有 macOS 那边的对话上下文，
> 按本文执行即可。目标是：在这台机器上跑通整套测试，并找出一批只在 Windows
> 才会出现的问题。

## 你的角色

这台机器是**上线前的第二道关**，不是日常开发机。它存在的意义有三条：

1. 物理隔离——这里没有用户的真实 Anki 数据，怎么折腾都不怕
2. 覆盖 Windows——路径分隔符、文件锁、字体渲染、高 DPI、快捷键映射
3. 承载重负载——可以造几万张卡的极端账号，用户自己机器上不敢造

**你不需要改产品功能**。你的产出是「测试结果 + 问题清单」，不是代码补丁。

## 前置条件（人工确认一次）

| 项 | 要求 | 检查方式 |
|---|---|---|
| Anki | 26.x 桌面版 | 能正常打开 |
| Python | 3.10 及以上 | `python -V` 或 `py -3 -V` |
| Git | 任意较新版本 | `git --version` |
| 仓库 | 已 clone 到本地 | `git -C <repo> rev-parse --short HEAD` |

仓库是私有的，需要 GitHub 凭据。如果 clone 失败，先让人类配置 SSH key 或
Git Credential Manager，不要尝试绕过认证。

下文所有命令都在 `tests\scenarios\` 目录下执行。

## 第一步：环境自检

先确认三个路径都能被正确探测出来：

```powershell
python -c "import sys; sys.path.insert(0, '.'); from paths import anki_app_packages, anki_executable, real_anki_base; print('packages:', anki_app_packages()); print('exe     :', anki_executable()); print('realbase:', real_anki_base())"
```

期望三个都打印出真实路径。如果 `packages` 或 `exe` 是 `None`，说明 Anki 装在
非标准位置，用环境变量指定后再重试：

```powershell
setx ANKI_APP_PACKAGES "D:\你的\Anki\app_packages"
setx ANKI_BIN "D:\你的\Anki\anki.exe"
```

（`setx` 需要新开终端才生效。）

`ANKI_APP_PACKAGES` 必须指向含 `anki\` 子目录的那一层。

## 第二步：生成场景

```powershell
python build.py --all
```

11 个场景，总共约需 2–5 秒（Windows 文件系统可能比 macOS 慢，超过 30 秒才算异常）。
**必须重建**，不要复用上次的 `lib\`：本轮 `mixed` 场景新增了 7 色旗标数据，
旧库文件里 `cards.flags` 全是 0，旗标相关的检查会全部空跑。

期望输出类似：

```
→ empty (0 卡) … 完成
→ exam (800 卡) … 完成  卡 815  revlog 4085
...
全部生成完成。
```

**如果报错**，把完整堆栈抄进报告——Windows 上第一次跑，路径与编码问题最可能
在这里暴露，这正是要抓的东西。

## 第三步：后端回归

```powershell
python smoke.py
```

期望 `692 项检查全部通过（11 个场景）`。约 5–8 秒，出现 `FAIL` 即为阻断项。

允许出现 **3 条** `已知缺陷` 警告，它们不算失败：

| 标签 | 含义 |
|---|---|
| `vacation:type-normalized` | 极端 `due` 下 Anki 框架会规范化 `type/queue` |
| `duplicate:skip` | 首次查重用的笔记正文去标签后为空，该分支未覆盖 |
| `vacation:rescue-skip` | 场景里没有到期的复习卡，减负与低能量分支未覆盖 |

本轮新增的检查（都在 `smoke.py` 里，出问题会直接 FAIL）：

| 标签前缀 | 断言什么 |
|---|---|
| `sort:*` | 七种排序结果集总数不变、顺序单调；未知 sortBy 不崩、也不偷偷清空 |
| `custom-study:preview:*` | 四种预设的 `count` 必须等于 `min(limit, totalMatched)`，默认纯预览 |
| `custom-study:start:*` | 返回卡片符合预设语义（额外新卡只出新卡、旗标只出带旗标、提前复习只出复习型），且 `isPreviewOnly` 正确回显 |
| `custom-study:flag-color` | 指定旗标色（3 号）时，返回的卡必须全是该颜色 |
| `custom-study:deck-scope` | 选定目标牌组后，返回的卡必须都落在该牌组（含子牌组）内 |
| `custom-study:no-schedule-side-effect` | 连跑四次「启动特训」（含 `isPreviewOnly=false`）后，全库调度字段零 diff |
| `custom-study:flag-data` | `mixed` 场景里必须真的有带旗标的卡片（防止数据配方退化后检查空跑） |

如果出现 `FAIL`，**不要改产品代码去让它变绿**。记录：场景名、检查项、
错误信息。这是要带回去的结论。

## 第四步：启动界面并人工检查

```powershell
python run.py exam
```

会打开 Anki 窗口并加载 `exam` 场景（815 张卡、三层牌组）。逐项看一眼，**共 15 项**：

基础路径：

- [ ] 首页牌组列表正常，中文不缺字、不豆腐块
- [ ] 卡片库能搜到内容，图片能显示
- [ ] 点开一张卡，翻面能看到答案
- [ ] 评分后进入下一张（重点：Anki 26 曾因缺 `start_timer` 导致答题静默失败）
- [ ] 统计页图表能画出来，数字不是 `NaN`
- [ ] 深色 / 浅色切换后文字仍然可读
- [ ] 窗口缩放或系统 DPI 变化后，按钮与热区没有错位
- [ ] 快捷键：`Ctrl` 系列是否与界面提示一致

本轮新增功能（对应 11-12 的最新改动）：

- [ ] 首页英雄卡：连胜数字左侧没有火焰图标，数字为主题橙；火焰仍是「双层火苗 + 右侧暖光晕」，
      火焰周边不应是一团糊开的橙雾，也不应完全没有光晕
- [ ] 顶栏：搜索框里只有放大镜 +「搜索卡片与牌组」，**没有** `⌘K` / `Ctrl K` 角标
- [ ] 同步状态：已同步时左侧是**主题色云朵**（不再是一个绿圆点）；鼠标悬停能弹出快照浮窗；
      同步进行中云朵位置变成橙色脉冲点
- [ ] 卡片库筛选行：`排序` 在最右侧、无边框、和五个带边框的筛选胶囊明显不是一类东西；
      点开后菜单向右不会溢出窗口
- [ ] 卡片库：改动排序后顺序真的变化（例：选「到期时间升序」，首张应是已到期的卡）；
      「匹配 N 张」旁的竖线只在有筛选条件时出现
- [ ] 制卡编辑器：点表情按钮能弹出面板（本轮修复了被 `overflow` 裁切的问题），
      选一个表情能插到光标处；面板打开时按 `Esc` **只关面板**，不关整个制卡窗口

再额外跑一次旗标场景（`mixed` 有 7 色旗标数据，`exam` 没有）：

```powershell
python run.py mixed
```

- [ ] 卡片库「旗标」下拉里能看到 7 种颜色的计数，选某个颜色后列表只剩对应卡片

每项截一张图，命名 `01-home.png`、`02-library.png`……存到
`tests\reports\screenshots\r4\`（新建子目录，不要覆盖 `r3\` 的历史画面）。

**注意**：`run.py` 是前台运行，关掉 Anki 窗口后才返回。

## 第五步：重负载场景（可选，但建议做）

如果这台机器跑得动，可以造一个远超真实用户的账号：

```powershell
python -c "import sys; sys.path.insert(0, '.'); from scenarios import SCENARIOS; print([k for k in SCENARIOS])"
```

现有最大的是 `power`（3020 卡）。想要更重的，直接改 `scenarios.py` 里 `power`
的 `total_cards` 到 20000 再 `python build.py power`，然后：

```powershell
python run.py power
```

看首页加载、搜索、统计各要多久。把耗时记进报告。

## 第六步：写回结果

在仓库根目录新建 `tests\reports\windows-<YYYYMMDD>.md`，内容包含：

```markdown
# Windows 验版报告 <日期>

## 环境
- Windows 版本：
- Anki 版本：
- Python 版本：
- 仓库 commit：

## 结果
- build.py --all：通过 / 失败（附错误）
- smoke.py：692/692 通过 / 失败 n 项（附清单）
- 界面检查：15 项中通过 n 项

## 发现的问题
1. <现象> | <复现步骤> | <截图文件名> | <是否阻断发布>

## 与 macOS 的差异
<字体、DPI、路径、快捷键等观察>
```

然后：

```powershell
git add tests/reports
git commit -m "test(windows): verification report <日期>"
git push
```

macOS 那边会 pull 下来看。

## 已知会踩的坑

| 现象 | 原因 | 处理 |
|---|---|---|
| `python` 命令不存在 | 只有 `py` 启动器 | 全部命令换成 `py -3` |
| `找不到 Anki 的 Python 包` | 装在非默认路径 | 设 `ANKI_APP_PACKAGES` |
| `run.py` 启动后立即退出 | 主 Anki 也开着，Anki 是单实例应用 | 先完全退出 Anki 再跑 |
| 媒体图片显示不出来 | `file://` URL 在 Windows 上是 `file:///C:/...` | 记录下来，这是要修的问题 |
| 中文乱码 | 终端编码不是 UTF-8 | `chcp 65001` 后重试 |

## 绝对不要做的事

- **不要**把测试指向真实的 Anki 数据目录。沙盒固定 `%USERPROFILE%\Anki-Test-Env`。
- **不要**为了「让测试变绿」而修改 `bridge/` 或 `frontend/src/` 下的产品代码。
- **不要**用 `git push --force`。
- **不要**跳过截图。很多 Windows 特有问题（字体、DPI、错位）只有肉眼能发现。

## 参考

- 测试系统说明：`tests/scenarios/README.md`
- 场景配方：`tests/scenarios/scenarios.py`
- 后端断言：`tests/scenarios/smoke.py`
