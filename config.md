# Anki Studio — Add-on Configuration

本页说明 `config.json` 中每一项的含义。多数选项在 **Anki Studio 设置界面**里点选即可，
无需手改本文件；此处列出是为了透明可查、以及在界面出问题时手动恢复。

## 常用选项

- `theme`：`"light"` | `"dark"` | `"oled"`
  主题模式。`oled` 为纯黑底，适合 OLED 屏。
- `accent_color`：`"indigo"` | `"emerald"` | `"cyan"` | `"rose"` | `"amber"` | `"teal"` | `"violet"` | `"slate"`
  品牌强调色，共 8 套。首页牌组卡片的配色也由这一项派生（同色系内的深浅变化，不会串色）。
- `language`：`"auto"` 或 `"zh-CN"` `"zh-TW"` `"en"` `"ja"` `"ko"` `"es"` `"fr"` `"de"` `"ru"` `"pt-BR"` `"it"` `"ar"` `"vi"` `"tr"` `"pl"` `"nl"`
  界面语言，共 16 种。`"auto"` 跟随 Anki 客户端的界面语言。
- `custom_nickname`：首页问候语中显示的名字。留空则使用当前 Anki 用户档案名。
- `auto_launch_modern_ui`：`true` / `false`
  Anki 启动时是否自动进入 Anki Studio。设为 `false` 则停留在原生界面，需要手动切换。
- `auto_play_front_audio`：`true` / `false`（默认 `false`）
  学习卡片显示正面时是否自动播放正面音频。
- `auto_play_back_audio`：`true` / `false`（默认 `true`）
  学习卡片翻面显示答案时是否自动播放背面音频；若背面没有独立音频，则回退重播正面音频。

## 切换与快捷键

- `toggle_shortcut`：在 Anki Studio 与原生 Anki 之间切换的快捷键，默认 `"Ctrl+Alt+M"`
  （macOS 上显示为 `Ctrl+Opt+M`）。除快捷键外还有两处常驻入口：顶部菜单栏的
  `Anki Studio` 菜单，以及原生工具栏上的彩色胶囊按钮。
- `show_shortcut_hints`：`true` / `false`
  是否在界面上显示快捷键提示。默认关闭。

## 界面状态

- `collapsed_deck_ids`：首页牌组列表中处于折叠状态的牌组 ID 数组。由界面自动维护，
  一般不需要手动修改。
- `sandbox_notetype_ids`：启用了「原生沙盒兼容模式」的卡型 ID 数组。在复习界面按卡型
  切换后由界面自动维护，用于让个别模板在隔离 iframe 中渲染；一般不需要手动修改。

## 匿名使用统计（可选）

- `analytics_enabled`：`true` / `false`（默认 `true`）
  是否上报匿名使用计数。只包含：启动、日活、复习会话张数区间、功能使用计数，
  以及版本 / 系统 / Anki 版本 / 界面语言 / 国家地区代码 / 时区偏移 / 一个随机安装 ID 的哈希。
  **不包含**卡片内容、牌组名、标签、搜索词或任何 AnkiWeb 账号信息。可在
  设置 → 关于中随时关闭。
- `analytics_endpoint`：默认内置官方端点
  （`https://anki.63096039.xyz/v1/events`）。
  设为空字符串会**完全停止上报**；也可以换成自己的 Cloudflare Worker 或
  大陆云函数，协议保持一致（见 `scripts/analytics-worker/`）。
- `analytics_install_id` / `analytics_queue` / `analytics_marks`：
  运行时自动维护（随机安装 ID、失败重试队列、每日去重标记），无需手动修改。

## 开发者选项

- `debug_mode`：`true` / `false`
  关闭错误静默并输出更详细的日志。正常使用请保持 `false`。
- `dev_server_url`：默认 `"http://localhost:5173"`
  仅供前端开发调试。只有在同时设置环境变量 `ANKI_MODERN_DEV_SERVER=1` 且
  `debug_mode` 为 `true` 时才会生效，正式使用时无需关心。

---

> 减负回执、休假记录、卡片快照等运行时数据保存在 Anki 的插件配置存储
> （`meta.json`）中，**不会**出现在随插件分发的 `config.json` 里，也不会随插件更新丢失。
