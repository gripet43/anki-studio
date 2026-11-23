# Anki Studio — Add-on Configuration

本页说明 `config.json` 中每一项的含义。多数选项在 **Anki Studio 设置界面**里点选即可，
无需手改本文件；此处列出是为了透明可查、以及在界面出问题时手动恢复。

## 常用选项

- `theme`：`"auto"` | `"light"` | `"dark"`
  主题模式。`"auto"` 跟随系统浅色 / 深色外观自动切换；历史配置中的 `"oled"` 会自动兼容迁移为 `"dark"`。
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
- `continuous_card_creation`：`true` / `false`（默认 `false`）
  新建卡片时是否默认开启「连续制卡」：添加成功后保留制卡窗口并清空正文，
  保留当前牌组、卡型与标签，方便连续录入。

## 界面状态

- `collapsed_deck_ids`：首页牌组列表中处于折叠状态的牌组 ID 数组。由界面自动维护，
  一般不需要手动修改。
- `sidebar_collapsed`：`true` / `false`（默认 `false`）
  左侧主导航栏是否收起为紧凑图标栏（`72px`）。点击侧边栏顶部的缩放按钮或按 `Cmd+\`（Windows / Linux 为 `Ctrl+\`）后由界面自动保存。
- `compat_mode`：`true` / `false`（默认 `false`）
  全局原生沙盒兼容模式开关。开启后所有复习卡片统一在隔离 iframe 沙盒中以原生模板渲染，不再按卡型单独切换；若历史配置中曾为任意卡型开启过 `sandbox_notetype_ids`，升级后会自动继承开启。
- `sandbox_notetype_ids`：历史按卡型记录的兼容模式 ID 数组（保留用于向后兼容与升级迁移，一般不需要手动修改）。
- `review_dock_position`：`"bottom"` | `"side"`（默认 `"bottom"`）
  学习页面操作栏位置。设为 `"side"` 时，控制区与评分按钮会固定在右侧栏，让左侧卡片阅读区域获得接近全屏高度的纵向阅读空间。
- `review_swipe_gestures`：`true` / `false`（默认 `true`）
  学习页面双指滑动快捷手势开关（未翻面下拉翻面、翻面后左滑遗忘 / 右滑记得）。关闭后仅保留常规上下滚动与按钮/键盘操作。
- `zen_sound_enabled`：`true` / `false`（默认 `true`）
  禅模式仪式与触感音效开关（燃香、颂钵、法鼓、和纸翻面与落卡声），与环境声景独立控制。
- `zen_sfx_volume` / `zen_ambience_volume`：`0.0` ~ `1.0`（默认 `0.5`）
  禅模式仪式音效与背景环境声景的独立音量。
- `zen_ambience`：`"silent"` | `"rain"` | `"wind"` | `"warmth"`（默认 `"silent"`）
  禅模式可选离线环境声景（静默 / 檐雨 / 松风 / 暖寂），退出禅模式时淡出、再次进入时自动恢复。
- `support_prompt_status`：`"idle"` | `"liked"` | `"feedback"` | `"dismissed"`（默认 `"idle"`）
  复习完成页支持提示的一次性状态（全局生效、跨账号共享）；交互或关闭后自动写入，不再重复打扰。

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
