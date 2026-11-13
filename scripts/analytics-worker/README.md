# Anki Studio 匿名统计端点（Cloudflare Worker + D1）

只存匿名计数：事件名、哈希后的安装 ID、版本、系统、Anki 版本、界面语言、极小 props。
**不存**卡片内容、牌组名、搜索词、IP。

## 部署（约 5 分钟）

```bash
cd scripts/analytics-worker
npm install -g wrangler          # 或 npx wrangler
wrangler login

# 1. 创建 D1 数据库，把输出的 database_id 填进 wrangler.toml
wrangler d1 create anki-studio-analytics

# 2. 建表
wrangler d1 execute anki-studio-analytics --remote --file=schema.sql

# 3. 部署
wrangler deploy

# 4. 绑定自定义域名（强烈建议；*.workers.dev 在大陆不稳定）
wrangler routes add stats.example.com/*
```

部署完成后，把下面的地址写进插件 `config.json`（或在开发环境改
`bridge/analytics_service.py` 的 `DEFAULT_ENDPOINT`）：

```json
{ "analytics_endpoint": "https://stats.example.com/v1/events" }
```

官方部署实例：`https://anki-studio-analytics.congtoubyby.workers.dev/v1/events`（已内置为默认端点）。
`analytics_endpoint` 设为空字符串时插件**完全不会发出任何请求**。

## 验证

端点**只接受 `AnkiStudio/` 开头的 User-Agent**（插件的 Python 客户端固定发
`AnkiStudio/<版本号>`）。不带 UA 或用 curl / 浏览器直接 POST 会返回 `403`，
这是故意的：扫描器和跨站请求连 D1 的门都进不去。UA 只用于判断，不落库。

```bash
curl -s https://stats.example.com/v1/events \
  -A 'AnkiStudio/1.4.33' \
  -H 'content-type: application/json' \
  -d '{"schema":1,"events":[{"event":"app_open","ts":0,"install_id":"0123456789abcdef0123456789abcdef","version":"1.4.33","os":"darwin","anki_version":"26.9.4","locale":"zh-CN"}]}'
# => {"ok":true,"stored":1}

# 反向验证：漏掉 -A 应返回 403（curl 默认 UA 不是 AnkiStudio/）
curl -s -o /dev/null -w '%{http_code}\n' https://stats.example.com/v1/events \
  -H 'content-type: application/json' \
  -d '{"schema":1,"events":[]}'
# => 403
```

本地行为回归（不需要 Cloudflare 凭据，从仓库根目录跑）：

```bash
node tests/test_analytics_worker.mjs   # 14 项，含 UA 白名单的正反向用例
```

## 看数据

```bash
# 日活
wrangler d1 execute anki-studio-analytics --remote \
  --command "SELECT date(ts,'unixepoch') d, count(DISTINCT install_id) dau, count(*) events FROM events GROUP BY d ORDER BY d DESC LIMIT 30"

# 版本分布
wrangler d1 execute anki-studio-analytics --remote \
  --command "SELECT version, count(DISTINCT install_id) installs FROM events GROUP BY version ORDER BY installs DESC"
```

大陆可达性说明：Cloudflare 自定义域名通常可用但偶有波动；如果要「毫无障碍」，
把同样的 `worker.js` 逻辑部署到大陆云函数（阿里云/腾讯云）+ 自有备案域名，
接口协议保持一致即可，插件侧只认 `analytics_endpoint`。
