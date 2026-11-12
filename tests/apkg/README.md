# 真实 .apkg 卡组显示兼容性测试

`tests/scenarios` 用合成数据覆盖业务边界；这里用 **AnkiWeb 排名靠前的真实卡组**
覆盖「导入 → 渲染 → 显示」整条链路。它回答的问题是：**这些卡包装进 Anki Studio
以后，正反面会不会显示成裸源码、丢样式、漏媒体、露出模板占位符。**

## 为什么卡组不放进仓库

真实卡组动辄几十到几百 MB（本机最大 226 MB），且版权归原作者，不能随仓库分发。
所以测试从本地目录读取：

- 默认 `~/Downloads`
- 或环境变量 `ANKI_STUDIO_APKG_DIR`
- 或命令行 `--dir /path/to/apkg`

目录里没有卡组时只打印 SKIP、不算失败，CI 上不会因此变红。

## 怎么跑

```bash
# 默认：跑 decks.json 清单里的 17 个卡组（约 16 秒）
python3 tests/apkg/run.py

# 常用参数
python3 tests/apkg/run.py --list                 # 只列出会测哪些文件
python3 tests/apkg/run.py --only JLPT            # 只测文件名含 JLPT 的
python3 tests/apkg/run.py --all                  # 测目录下全部 .apkg
python3 tests/apkg/run.py --json report.json     # 输出完整报告
python3 tests/apkg/run.py --keep                 # 保留临时 collection 便于排查
python3 tests/apkg/run.py --no-frontend          # 跳过 Node 渲染检查

# 也可以挂在场景门禁上一起跑
cd tests/scenarios && ./gate.sh --with-apkg
```

系统 `python3` 与 Anki 自带 Python 版本不一致时，脚本会**自动找到 Anki 的
Python 3.13 重跑**（macOS）；也可以显式指定：

```bash
export ANKI_APP_PYTHON=/Applications/Anki.app/Contents/Frameworks/Python.framework/Versions/3.13/bin/python3
export ANKI_APP_PACKAGES=/Applications/Anki.app/Contents/Resources/app_packages
```

## 测试做了什么

每个 `.apkg`：

1. **隔离导入**：`anki.collection.Collection` 建一个临时 collection，导入媒体，
   全程不碰真实 Anki2 数据；跑完删除（`--keep` 可保留）。
2. **按卡型抽样**：每个卡型取首/中/尾最多 3 张，单卡组上限 80 张。
3. **走后端真实管线**：`ReviewService._serialize_review_card`（复习）
   + `SearchService._serialize_library_card`（卡片库 / Cmd+K / 编辑器）。
4. **后端断言**：
   - 正反面非空、序列化不返回 None；
   - 无 `<script>` 残留、无 `[sound:]` 未消费、无模板占位符 `{{...}}`；
   - `<img src>` 已重写为 `file://` / `http(s)` / `data:`，不残留相对路径；
   - 公式里不出现前端无法解码的 HTML 实体（`&nbsp;` 这类会变字面量）；
   - 模板有 `display:none` 时：**正面样式必须保留隐藏、背面样式必须揭开**；
   - 搜索接口按卡型下发正面 / 背面两份样式表，且作用域正确。
5. **前端断言**（`render_check.mjs`，复用 `frontend/node_modules` 的 esbuild）：
   用**界面同一个** `renderMathAndRichHtml` 渲染抽样 HTML，检查二次转义实体、
   残留 LaTeX 命令、公式分隔符、占位符、`undefined/NaN`。

## 已知限制（不阻塞门禁，但每次都会打印）

`known_issues.json` 记录「产品目前确实没做到」的项，命中后降级为 `[WARN]`，
避免「全绿 = 完全没问题」的错觉。当前两条：

- `Raagaceptions`：化学式 mhchem `\ce{...}` 未支持（迷你 LaTeX 渲染器覆盖不到）；
- `Maths_sup`：`\overline` / `\underset` / 嵌套 `\sqrt{...\overline{...}}` 未支持。

彻底解决需要把自研迷你渲染器换成 KaTeX（含 mhchem 扩展）。修好后请从
`known_issues.json` 删掉对应条目，让检查重新变严。

## 新增卡组

1. 把 `.apkg` 放进 `~/Downloads`（或 `--dir` 指定目录）；
2. 在 `decks.json` 的 `decks` 数组里加一条 `{"match": "文件名子串", "note": "说明"}`；
3. `python3 tests/apkg/run.py --only <子串>` 单独验证；
4. 如果是已知限制，在 `known_issues.json` 记录原因，不要直接把检查删掉。

## 设计取舍

- **抽样而不是全量**：1 万张卡的卡组全量渲染要几分钟，按卡型抽样已经能覆盖
  模板级问题；卡级别的数据边界由 `tests/scenarios` 的合成场景负责。
- **真实导入而不是解析 apkg**：只有走 Anki 自己的导入与模板引擎，才能拿到
  与用户完全一致的正反面 HTML。
- **两项独立断言**：后端负责「HTML 产得对」，Node 端负责「前端渲染不把它弄坏」，
  两者都不通过才算回归。
