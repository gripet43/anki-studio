# 前端单元测试套件

`tests/test_frontend_bundle.mjs` 做的是**字符串审计**（源码里该出现的函数名/关键词有没有），
它拦得住「误删护栏」，但拦不住「逻辑算错」：媒体路径解析、主题令牌派生、语言回退链
这些纯函数只要参数一改就可能静默产出错误结果，而字符串审计依然是绿的。

本目录补的就是这一层。

## 为什么没有用 vitest / jest / jsdom

插件本身不依赖任何前端测试框架，为几十条断言引入一整棵依赖树（还要改 `frontend/package.json`
与 lockfile）不划算。这里复用了 Vite 已经装好的 esbuild：

```
suite.ts ──esbuild(bundle, platform=node, format=cjs)──▶ 临时 .cjs ──▶ node 执行
```

- **零新增依赖**：只用 `frontend/node_modules` 里已有的 esbuild / react / react-dom。
- **能跑 `.tsx`**：esbuild 负责模块解析与 JSX，绕开 Node 原生 ESM 对无扩展名导入的限制。
- **组件渲染用 `react-dom/server`**：`renderToStaticMarkup` 在 Node 里就能跑真实组件代码，
  不需要 jsdom。

## 运行

```bash
# 仓库根目录
node tests/frontend/run.mjs
```

退出码非 0 即失败，输出格式与 `test_frontend_bundle.mjs` 一致（`ALL N CHECKS PASSED!`）。
首次运行前需要 `cd frontend && npm install`（和其它前端命令共用同一份依赖）。

## 覆盖范围（84 项）

| 文件 | 覆盖内容 |
|---|---|
| `specs/themeTokens.spec.ts` | 8 套强调色 × 3 主题的令牌完整性、`isValidAccentColor`、CSS 变量契约、OLED/Dark/Light 明度序、纯函数确定性 |
| `specs/deckPalette.spec.ts` | 牌组色阶的 5 步轮转、首卡等于品牌色、正负索引回绕、浅深主题令牌合法、**色相偏移 ≤15°（不出现彩虹牌组）**、不修改入参 |
| `specs/mediaUrl.spec.ts` | `collection.media` 基址归一化、单次 URL 编码（防二次编码）、`http/data/blob/file://` 放行、`data-anki-media` 兜底、`<img>` 重写幂等、cloze/`[sound:]`/锚点不被误伤 |
| `specs/translations.spec.ts` | 16 语言注册表、Anki/browser 别名归一、`pref → Anki → browser` 回退链、RTL 判定、快捷键跨平台映射、同步相对时间格式 |
| `specs/render.spec.tsx` | `AnkiStudioLogo` / `SyncStateIcon` / `StreakFlameBackdrop` 的静态渲染：尺寸、无障碍属性、四种同步状态互不相同、深色模式确实生效 |
| `specs/ioRects.spec.ts` | Anki 渲染过的遮挡挖空（`span.cloze`）逆向还原成 `{{cN::}}`、幂等、缺 `data-ordinal` 时退回 `data-io-rect`、框外 cloze 不动、空输入安全 |
| `specs/nativeOcclusion.spec.ts` | 遮挡编辑器写出的原生 IO 指令：`hide-all` 每条带 `oi=1`、`hide-one` 一个 `oi` 都不带、坐标 0–1 小数、全部共用 `c1`（一笔记一卡）、Header 去空白 |
| `specs/editorTable.spec.ts` | 编辑器插表格的样式必须主题无关：表头显式文字色、表头底色/文字色对比度 ≥4.5:1、`td` 不写死色、不写死字号 |

## 浏览器端往返测试（可选）

`serializeFromWysiwyg`（`frontend/src/utils/wysiwygField.ts`）是纯 DOM 逻辑，Node 里没有 DOM
就没法测；它一旦退化是**静默丢数据**——挖空里的 `<b>`/`<img>` 被吃掉，界面上看不出来，
下次打开卡片才发现。

```bash
python3 tests/frontend/run_browser.py
```

用现成的 esbuild 把该模块打成 IIFE，交给无头 Chrome 跑 8 项断言（`--dump-dom` 取回结果）。
找不到 Chrome 时**跳过并返回 0**，不会卡住没有浏览器的机器。它**不在** `gate.sh` 与
`test_frontend_bundle.mjs` 里，属于需要时手动跑的补充层。

## 不覆盖什么

- **交互与 DOM 行为**：点击、拖拽、动画、弹窗焦点陷阱、iframe 沙盒通信，仍需要真实浏览器
  （`tests/scenarios/` 的场景库 + 手工目视）。这是当前唯一剩下的前端盲区——除了
  `run_browser.py` 覆盖的那条「编辑器 → 字段」序列化链路。
- **状态机**：`useAppStore.ts` 依赖 `window.pycmd` 与 React Hook，未在本套件内直接实例化。
- **构建产物**：`web/` 的打包结果由 `test_frontend_bundle.mjs` 与 `npm run build` 负责。

## 新增一条用例

1. 在 `specs/` 下新建 `xxx.spec.ts`（可写 `.tsx`）；
2. 用 `section('...')` 分组、`test('...', () => { ... })` 注册，断言用 `eq / equal / ok / matches / throws`；
3. 在 `suite.ts` 里 `import './specs/xxx.spec';`；
4. 跑 `node tests/frontend/run.mjs`。

> 注意：这套件跑在 Node 里，不要 import 任何依赖真实 DOM 或在模块顶层访问 `window` 的模块。

## 与门禁的关系

目前它是**独立命令**，尚未接入 `tests/test_frontend_bundle.mjs` 的末尾。原因是该文件正被
另一位助手在 Track B 沙盒分支上改动，避免并发覆盖；等那轮改动落地后，建议在
`test_frontend_bundle.mjs` 末尾 spawn 一次本命令，让发布门禁只跑一条命令。
