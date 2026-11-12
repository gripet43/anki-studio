# 独立测试沙盒

一套与真实数据完全隔离的 Anki 测试环境。目的是在不动用户 collection 的前提下，
用「不同用户画像」的数据覆盖真实使用中才会出现的边界情况。

## 为什么需要它

真实卡库只有 2 个牌组、2 种笔记类型、0 张隐藏卡。它能证明日常路径可用，但下面这些
情况一次都测不到：多牌组嵌套、Cloze 与图片遮挡、标签体系、积压、状态混杂、空库、
脏数据、大集合性能。

## 隔离模型

```
~/Anki-Test-Env/                    ← 沙盒根，与真实数据目录无交集
  base/                             ← Anki 的 -b 目标
    prefs21.db                      ← 沙盒自己的 profile 元数据
    测试账户/collection.anki2        ← 当前激活场景
    addons21/anki_modern_os/        ← 插件副本（复制，不是软链）
  lib/                              ← 场景库，每个场景一个 collection.anki2
  state/                            ← 切换前的现场备份、真实库指纹基线
  active                            ← 当前场景名
```

三条硬规则：

1. **启动必须带 `-b`**。`run.sh` 里没有裸启动路径，`verify_isolation.py` 会检查。
2. **插件目录用复制而非软链**。软链会让插件写的 `config.json` 穿透到开发目录，
   等于绕过隔离。
3. **`config.json` 首次同步时剥离运行时字段**（昵称、减负回执、休假历史），
   测试环境不携带任何真实信息。

真实数据目录只在两处被接触：读取插件源码做副本、读取 collection 做指纹比对（只读）。

## 快速开始

```bash
cd tests/scenarios

./gate.sh                        # 一键门禁：隔离自检 → 补场景 → 冒烟回归
./gate.sh --with-project         # 额外跑项目的 Bundle 审计与单测

python3 build.py --list          # 看有哪些场景
python3 build.py --core          # 生成 empty / newbie / exam
./run.sh exam                    # macOS/Linux：同步插件 → 备份现场 → 切换 → 启动
python3 run.py exam              # Windows（或任意平台）：同样的流程
```

## 跨平台

整套测试在 macOS / Windows / Linux 上都能跑，路径按平台自动探测：

| 用途 | macOS | Windows |
|---|---|---|
| Anki 自带 Python 包 | `/Applications/Anki.app/Contents/Resources/app_packages` | `%LOCALAPPDATA%\Programs\Anki\app_packages`（也尝试 `_internal` 与 Program Files） |
| 真实数据目录 | `~/Library/Application Support/Anki2` | `%APPDATA%\Anki2` |
| 启动器 | `./run.sh <场景>` | `python run.py <场景>` |

探测不到时可以显式覆盖：

```bash
export ANKI_APP_PACKAGES=/path/to/app_packages   # 含 anki/ 子包
export ANKI_BIN=/path/to/anki                    # Anki 主程序
export ANKI_REAL_BASE=/path/to/Anki2             # 真实数据根目录
```

Windows 上需要 Python 3.10+；`run.py` 用纯标准库实现，不依赖 bash 或 rsync。
`gate.sh` 是 bash 脚本，在 Windows 上用 Git Bash 运行，或逐条执行它里面的命令。

`run.sh` 每次都会先 rsync 一份最新插件副本，所以改完代码直接重新跑即可，不用手动复制。

其他命令：

```bash
./run.sh --list                  # 场景列表与当前激活项
./run.sh --sync                  # 只同步插件，不启动
./run.sh --status                # 沙盒状态
python3 smoke.py                 # 冒烟回归（不启动 GUI）
python3 verify_isolation.py      # 隔离自检
python3 verify_isolation.py --baseline   # 记录真实库指纹
python3 verify_isolation.py --check      # 确认真实库未被改动
```

## 自动回归

场景库不只是手测素材。`smoke.py` 会把 `BridgeRouter` 直接接到场景 collection 上，
不启动 GUI 跑前端真正会调的那些 action：

| 检查 | 断言什么 |
|---|---|
| `get_dashboard` | 关键字段齐全、牌组数不少于实际分布 |
| `get_statistics` | 七个统计块齐全、留存率落在 0~1 |
| `search_cards` | 全库搜索数等于实际卡片数、筛选不越界 |
| `get_deck_options` | 调度字段齐全 |
| `maintenance:*` | 脏数据场景下，空卡与缺失媒体必须被**检出** |
| `occlusion:frontHtml` | 遮挡结构完整：`data-io-mode`、`data-io-rect`、遮罩样式、图片 `file://`，且 cloze 已被消费 |
| `native-io:*` | 原生 `Image Occlusion` 卡可读取；模板渲染缺失时记为**已知缺陷** |
| `vacation:*` / `rescue:*` | 休假与减负「开启 → 撤销」后**逐卡零 diff**，不是只看 success |
| `deck-options:roundtrip` | 写 42 读回必须是 42 |
| `batch:tag-persisted` / `answer:revlog` | 批量加标签真的进 `notes.tags`；答题真的产生一条 revlog |
| `set_card_flag` / `toggle_suspend` / `quick_add` | 写下去真的落库（查 sqlite 验证，不信返回值） |
| `sort:*` | 七种排序（失误降序/间隔升降/到期/稳定度/正面/最新）结果集总数不变、顺序严格单调；未知 `sortBy` 不崩也不清空 |
| `custom-study:preview:*` / `start:*` | 四种预设的 `count == min(limit, totalMatched)`，返回卡片符合预设语义（只出新卡/只出带旗标/只出复习型），`isPreviewOnly` 正确回显 |
| `custom-study:no-schedule-side-effect` | 连跑四次「启动特训」（含 `isPreviewOnly=false`）后全库调度字段零 diff |
| `custom-study:flag-color` | 指定旗标色时返回的卡片颜色必须一致 |
| `custom-study:flag-data` | `mixed` 场景必须真的有带旗标的卡，防止配方退化后旗标检查空跑 |

另外每个返回值都会过一遍「非法数值」检查：出现 `Infinity` / `NaN` 直接判失败，
因为 Python 的 json 会把它们写成非法字面量，前端 `JSON.parse` 会当场抛错。

### 已知缺陷与失败的区别

产品当前确实不支持的能力，记为 `warning` 而不是 `FAIL`：门禁保持绿色，但每次运行
都会打印出来，避免「测试全绿 = 功能完整」的错觉。

原生 `Image Occlusion` 的显示缺陷曾以这种方式挂过 1 条（只显示 SVG 黑框、底图丢失）。
修复后已升级为正式断言 `native-io:frontHtml` 与 `native-io:review`，同时列表与复习
两条渲染路径都被守住。**目前没有未认领的已知缺陷。**

全部在 `state/smoke/` 的副本上执行，跑完即删。**11 个场景、692 项检查约 5 秒**。

### 覆盖范围

后端共 48 个 action：8 个是纯 UI 操作（窗口移动、剪贴板、播放音频、原生导入导出、原生界面切换）
不适合无头测试，其余 40 个中 **38 个已被 `smoke.py` 覆盖**。当前未覆盖的 2 个：

- `toggle_notetype_sandbox`：Track B 原生沙盒开关，需要断言 config 的 `sandbox_notetype_ids`
  真的写回（属前端/配置交互，补一条即可）；
- `get_patch_health`：运行时兼容性自检报告，脱离 Anki 的默认 router 返回空报告，断言价值主要在
  `tests/test_patch_health.py`，smoke 里补一条「不抛异常」的连通性检查即可。

补全覆盖时顺带确认的几个行为，已写成断言：

| 接口 | 断言什么 |
|---|---|
| `check_duplicate` | 用真实卡片正文查重必须判定为重复；遮挡类纯 SVG 正文则跳过 |
| `preview/start_custom_study` | 返回数量不得超过 `limit` |
| `toggle_bury` | 埋没后 `queue` 必须是 `-2` 或 `-3`（Anki 26 实测写 `-3`） |
| `update_card_inline` | 编辑内容真的进了 `notes.flds` |
| `save_pasted_image` | 素材真的落到 `collection.media` |
| `undo` | 先答题再撤销，`undone` 必须为真 |
| `sync` / `sync_collection` | 无真实 `mw` 时优雅降级，不抛异常 |
| `delete_cards` | 删完卡片数必须减少 |
| `end_vacation` | 能识别进行中的休假并正常结束 |

前端 20 个组件、渲染与交互仍没有自动覆盖，只有 `test_frontend_bundle.mjs` 的字符串审计
与手工跑 `./run.sh <场景>` 目视检查。这是目前唯一的测试盲区。

## 场景

| key | 规模 | 覆盖 |
|---|---|---|
| `empty` | 0 卡 | 首屏空态、统计除零、热力图全零 |
| `newbie` | 100 卡全新 | 新卡队列、首次学习、学习步长 |
| `exam` | ~800 卡 / 3 层牌组 | Basic + Cloze、30% 新卡、标签、复习历史（回归主力） |
| `backlog` | 600 卡全逾期 | 进度减负、Future Due 峰值、dailyLoad |
| `mixed` | 400 卡 | 暂停 / 隐藏 / 学习 / 重学混排、**7 色用户旗标**、批量操作边界 |
| `power` | 3000 卡 / 8 牌组 | 多笔记类型、大标签量、分页与查询延迟 |
| `media` | 200 卡 + 9 个素材 | 图片/音频引用、孤立媒体文件 |
| `occlusion` | 60 卡全遮挡 | 项目自定义 `.anki-io-wrap` 结构、hide-all / hide-one |
| `io-native` | 30 条原生 IO | Anki 内置 `Image Occlusion` 类型、`{{c1::<svg>}}`、canvas 渲染 |
| `edge` | 150 卡 | 负数/超大 `due`、`ivl` 含 0 与 2147483647 |
| `dirty` | 120 卡 | 空卡、重复笔记、缺失媒体、超长字段 |

所有场景用固定 seed 生成。用 `python3 build.py --verify-repro exam` 可以验证
「同一份配方生成两次，业务数据完全一致」——比对的是排除 id/mod/due 之后的
notes 与 cards 指纹。

## 可复现性

场景数据必须可复现，否则「昨天测出来的 bug 今天复现不了」。生成器的随机性全部
由 `seed` 驱动，`--verify-repro` 会生成两份并比对：

```bash
python3 build.py --verify-repro exam occlusion dirty
# → exam … 可复现  notes 7ef8d9ad…  cards 99535d26…
```

指纹刻意排除 `id` / `mod` / `due`：前两者是时间戳，后者对学习卡存的是毫秒时刻，
每次生成必然不同。剩下 `type / queue / ivl / factor / reps / lapses / flags` 与笔记正文
才是真正应该稳定的部分。

## 生成原理

Anki 26 的 collection 在打开状态下由 Rust 后端持有连接，写调度字段既慢又受限，所以
分四段：

1. 用 Anki 自带的 `anki` 包建牌组、笔记、卡片，写入媒体素材，正常关闭；
2. 关闭后用标准库 `sqlite3` 直接写 `due` / `queue` / `type` / `ivl` / `factor`
   与 `revlog`；
3. 需要时继续注入脏数据（空字段、重复内容、缺失媒体引用、超长字段）；
4. 重新用官方 API 打开，校验 Anki 认这份数据（卡片数、队列分布）。

生成器只依赖 `/Applications/Anki.app/Contents/Resources/app_packages`，不装包、
不读真实 collection。

## 新增场景

在 `scenarios.py` 里加一个 `ScenarioSpec` 即可：

```python
"my-case": ScenarioSpec(
    key="my-case",
    title="……",
    description="……要验证的具体行为",
    total_cards=500,
    decks=(DeckSpec("A"), DeckSpec("A::B", 0.6)),
    notetype_mix={"Basic": 0.7, "Cloze": 0.3},
    state_mix={"new": 0.2, "relearn": 0.05},
    revlog_per_card=(1, 6),
    overdue_range=(-10, 60),
    tag_pool=("标签1", "标签2"),
    # 需要带旗标时加这一行（1~7 是颜色，未列出的部分为无旗标）
    flag_mix={1: 0.10, 3: 0.05},
    seed=20261111,
)
```

`total_cards` 是目标**卡片**数。Cloze 一条笔记可能生成多张卡，所以实际数量会略高，
manifest 里会同时记录 `target_cards` 与实际的 `cards`。

## 已知限制

- **媒体素材是占位内容**：PNG 是 1×1 透明图、MP3 是空文件。足以验证渲染路径、
  引用解析与 `check_media` 的比对逻辑，但看不出图片内容、也听不到声音。
- **遮挡场景走的是项目自定义方案**：`Basic` 笔记 + `.anki-io-wrap` /
  `span.anki-io-rect` 包 cloze，不是 Anki 26 原生 Image Occlusion 类型的
  `canvas` + `anki.imageOcclusion.setup()`。
- **原生遮挡卡已支持**：`io-native` 场景用于守住这条路径。bridge 层会把
  `Image` 底图与 `Occlusion` 里的 SVG 矩形转成 `.anki-io-wrap` + `span.anki-io-rect`，
  复用自定义遮挡的静态渲染链路。原生 canvas 方案本身仍未实现（也不需要，因为
  WebView 不执行模板 script）。
- **脏数据六类**：空字段、重复内容、缺失媒体、超长字段、极端 `due`、极端 `ivl`。
  损坏的 UTF-8 与孤立标签尚未覆盖。
- **不测移动端与 AnkiWeb 同步**：真实同步会污染账号，冲突场景需另做本地双库模拟。
- **不能对 `decks.name` 排序**：Anki 给该列注册了自定义 `unicase` collation，
  裸 `sqlite3` 执行 `order by name` 会报错，改成 `order by id`。
- **profile 元数据是手工写的最小 pickle**：Anki 会自动补全，但升级大版本后
  建议删掉 `base/prefs21.db` 让它重建。
- **`Anki -b` 只隔离数据，不隔离应用**：两个实例共用同一个 Anki.app，
  升级 Anki 后建议先跑一次 `gate.sh --rebuild` 确认生成器仍兼容。
