# Anki Studio

> 专为 Anki 打造的现代化、桌面级沉浸式记忆工作区。以 Apple 人机交互设计规范（HIG）为审美基准，与 Anki 24+ 原生生态和 AnkiWeb 云端 100% 双向同步。

---

## 🌟 核心特性

- **macOS 沉浸式标题栏**：无缝延伸至原生红黄绿交通灯后方，支持无感拖拽与系统级窗口缩放。
- **0 毫秒首帧启动**：Qt 底层背景颜色预注入 + HTML 预挂载骨架，彻底消除传统 Web 插件冷启动白屏。
- **全局瀑布流级联同步**：顶部状态指示、环形进度雷达、牌组卡片、26×7 学习热力图与周节奏图表全屏协同呼吸。
- **4 级统一按钮系统**：严谨的视觉层级（Primary、Secondary、Ghost、Icon Circle），提供细腻的物理触感反馈。
- **🌴 休假守护与雪崩急救**：内建事前休假（新卡冻结 + 顺延 + 连胜冰冻 Streak Freeze）、事后削峰填谷（卡片均匀平摊消化）与低能量极简打卡模式。
- **三层防迷失安全网**：快捷键 `Ctrl+Opt+M` / `Ctrl+Alt+M`、工具菜单入口与原生工具栏常驻彩色胶囊，随时秒切原生。
- **多主题与个性化**：支持 Light、Dark、OLED 纯黑三种专业主题，以及 4 款品牌强调色。

---

## 📖 设计与开发规范手册

为保持后续迭代的代码与视觉一致性，请务必参阅项目内部规范标准：

👉 **[详细设计规范与开发工程标准手册 (docs/DESIGN_AND_DEV_GUIDELINES.md)](docs/DESIGN_AND_DEV_GUIDELINES.md)**  
👉 **[项目改动日志与多助手协同协议 (CHANGELOG.md)](CHANGELOG.md)**

该文档涵盖：
1. **色彩与主题矩阵**：Light、Dark、OLED 调色板与语义 Token。
2. **按钮四级体系**：`btn-primary`、`btn-secondary`、`btn-ghost`、`btn-icon-circle` 的类名规范与交互微动效。
3. **动效流水线**：阶段一同步呼吸（1.8s）到阶段二瀑布流入场（0.8s）的编排细节。
4. **前端工程规范**：`useSyncExternalStore` 状态单向流、防中断保护锁、Modern Web 合成器动效铁律。
5. **IPC 桥接与构建红线**：双向安全通信规范、自动化测试与构建发布流水线。

---

## 🛠️ 本地开发与构建

### 1. 前端开发
```bash
cd frontend
npm install
npm run dev      # 启动本地开发热更新服务器 (localhost:5173)
npm run build    # 打包生产静态资源到 web/ 目录
```

### 2. 自动化测试与体检
```bash
node tests/test_frontend_bundle.mjs
```

### 3. 打包发布
```bash
python3 scripts/build_ankiaddon.py
```
打包完成后会在根目录生成 `anki_modern_os.ankiaddon` 安装包。
