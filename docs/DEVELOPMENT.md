# Anki Studio — 本地开发与构建（内部）

> 内部维护者文档，面向参与本项目的开发者；项目主页 README 不再展示这些内容。
> 设计与代码规范见 [DESIGN_AND_DEV_GUIDELINES.md](DESIGN_AND_DEV_GUIDELINES.md)。

## 本地开发与构建

### 1. 前端开发
```bash
cd frontend
npm install
npm run dev      # 启动本地开发热更新服务器 (localhost:5173)
npm run build    # 打包生产静态资源到 web/ 目录
```

### 2. 自动化测试与体检
```bash
node tests/test_frontend_bundle.mjs                   # 前端字符串审计：护栏 / IPC / 样式 / i18n
node tests/frontend/run.mjs                           # 前端单元套件：纯逻辑 + 叶子组件渲染
python3 tests/frontend/run_browser.py                 # 可选：无头 Chrome 跑「编辑器→字段」DOM 往返（缺 Chrome 自动跳过）
python3 tests/scenarios/frontend_audit.py              # 前端静态审计：DOM target 防御 / helper 使用（仅需 Python）
python3 -m unittest discover -s tests -p "test_*.py"  # Python 侧单元测试（含兼容性自检、通用修复与 CSS 解析回归）

cd tests/scenarios && ./gate.sh                       # 隔离冒烟 + 前端静态审计（不动真实数据）
python3 tests/apkg/run.py                             # 真实 .apkg 显示兼容性：17 个排名卡组（需本地卡组，约 16 秒）
```

前三组都必须全绿再提交；改完还要跑一次 `npm run build`，确保 `web/assets` 与源码同步。
改到桥接层业务逻辑时，再跑一次场景冒烟。前端单元套件只依赖 `frontend/node_modules` 里已有的 esbuild，无需额外安装测试框架。

### 3. 打包发布
```bash
python3 scripts/build_ankiaddon.py
```
打包完成后会在根目录生成 `anki_modern_os.ankiaddon` 安装包，并打印其 SHA-256；随后自动复制一份到 `~/Downloads/anki_modern_os-v<version>.ankiaddon`，方便直接上传 AnkiWeb 或装到另一台机器。加 `--no-downloads` 可关闭复制。

脚本只按白名单收运行时文件（`__init__.py`、`manifest.json`、`config.json`、`config.md`、`bridge/`、`web/`），并保证：顶层不带包裹目录、不含 `__pycache__`、不打包 `meta.json`、随包的 `config.json` 会剥掉昵称与学习记录等私人数据。打包时还会自动把 `manifest.json` 的 `mod` 刷新为当前时间戳（AnkiWeb 靠它判断版本更新），并校验 `min_point_version` 与 `human_version` 是否合法。

### 4. 预览图
README 与 AnkiWeb 简介页共用同一张 5 帧英文循环 GIF，由 `scripts/build_preview_gif.py` 生成（当前规格 **1200×850 / 5 帧 × 2.8s / 613 KB**）。把若干张同尺寸、同构图、纯白底边的整窗截图传进去即可重建，宽度、每帧停留时长、是否淡入都可调：

```bash
python3 scripts/build_preview_gif.py \
  --frames 01-dashboard.png 02-reviewer.png 03-library.png 04-stats-dark.png 05-relief.png \
  --out docs/assets/anki-studio-preview.gif --width 1200 --hold-ms 2800
```

GIF 只有 256 色，画质上有几个已经踩过并写在脚本 docstring 里的坑（JPEG 白噪声污染调色板、全局调色板反而放大色差、抖动与预模糊是负收益），改参数前建议先读一遍。

