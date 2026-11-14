/**
 * Anki Studio — minimal anonymous analytics endpoint + protected dashboard (Cloudflare Worker + D1).
 *
 * POST /v1/events   { schema: 1, events: [ { event, ts, install_id, version, os, anki_version, locale, props? } ] }
 *                   Requires User-Agent: AnkiStudio/<add-on version>.
 * GET  /dashboard   Self-contained real-time analytics dashboard (HTML).
 * GET  /v1/stats    Aggregated JSON stats for /dashboard (requires Authorization: Bearer <DASHBOARD_TOKEN>).
 *
 * Privacy: validates and stores only the allowlisted fields below. No IP is
 * written to D1. Rows older than 90 days are removed by the cron trigger.
 */

const ALLOWED_EVENTS = new Set(["app_open", "daily_active", "review_session", "feature_use"]);
const MAX_EVENTS = 100;
const RETENTION_DAYS = 90;

// Only the add-on's Python client identifies itself this way. Generic scanners
// (curl / python-requests / Go-http-client) and browser drive-by requests —
// which cannot spoof User-Agent — are rejected before they can reach D1.
// The value is compared for gating and never stored.
const LEGIT_UA_PREFIX = "AnkiStudio/";
const MAX_UA_LENGTH = 80;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow",
};

function json(data, status = 200, extraHeaders = CORS_HEADERS) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function str(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

function extractBearerToken(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return (request.headers.get("x-dashboard-token") || "").trim();
}

function sanitize(event) {
  if (!event || typeof event !== "object") return null;
  const name = str(event.event, 32);
  if (!ALLOWED_EVENTS.has(name)) return null;
  const installId = str(event.install_id, 64);
  if (!/^[a-f0-9]{32,64}$/i.test(installId)) return null;
  const ts = Number.isFinite(event.ts) ? Math.trunc(event.ts) : Math.trunc(Date.now() / 1000);
  let props = null;
  if (event.props && typeof event.props === "object") {
    try {
      props = JSON.stringify(event.props).slice(0, 512);
    } catch {
      props = null;
    }
  }
  const tz = Number.isFinite(event.tz_offset) ? Math.max(-12, Math.min(14, Math.trunc(event.tz_offset))) : null;
  return {
    ts,
    install_id: installId,
    event: name,
    version: str(event.version, 32),
    os: str(event.os, 16),
    anki_version: str(event.anki_version, 32),
    locale: str(event.locale, 16),
    tz_offset: tz,
    props,
  };
}

async function handleStats(request, env, url) {
  const expected = typeof env.DASHBOARD_TOKEN === "string" ? env.DASHBOARD_TOKEN.trim() : "";
  if (!expected) {
    return json(
      { error: "dashboard_not_configured", message: "Worker secret DASHBOARD_TOKEN is not set" },
      503,
      NO_STORE_HEADERS
    );
  }
  const provided = extractBearerToken(request);
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "unauthorized" }, 401, NO_STORE_HEADERS);
  }

  const now = Math.trunc(Date.now() / 1000);
  const rawTz = Number(url.searchParams.get("tz"));
  const tzHours = Number.isFinite(rawTz) ? Math.max(-12, Math.min(14, Math.trunc(rawTz))) : 8;
  const tzOffsetSec = tzHours * 3600;
  const localNow = now + tzOffsetSec;
  const todayStart = localNow - (((localNow % 86400) + 86400) % 86400) - tzOffsetSec;
  const yesterdayStart = todayStart - 86400;

  const rangeParam = url.searchParams.get("range") || "7d";
  const rangeMap = {
    today: todayStart,
    "7d": now - 7 * 86400,
    "30d": now - 30 * 86400,
    all: 0,
  };
  const rangeSince = Object.prototype.hasOwnProperty.call(rangeMap, rangeParam) ? rangeMap[rangeParam] : rangeMap["7d"];
  const trendDays = rangeParam === "30d" || rangeParam === "all" ? 30 : 14;
  const trendSince = todayStart - (trendDays - 1) * 86400;

  const results = await env.DB.batch([
    env.DB.prepare(
      `SELECT
        COUNT(DISTINCT CASE WHEN ts >= ? THEN install_id END) AS active_15m,
        COUNT(DISTINCT CASE WHEN ts >= ? THEN install_id END) AS active_1h,
        COUNT(DISTINCT CASE WHEN ts >= ? THEN install_id END) AS dau_today,
        COUNT(DISTINCT CASE WHEN ts >= ? AND ts < ? THEN install_id END) AS dau_yesterday,
        COUNT(DISTINCT CASE WHEN ts >= ? THEN install_id END) AS wau_7d,
        COUNT(DISTINCT CASE WHEN ts >= ? THEN install_id END) AS mau_30d,
        COUNT(DISTINCT install_id) AS total_installs,
        COALESCE(SUM(CASE WHEN ts >= ? THEN 1 ELSE 0 END), 0) AS events_today,
        COUNT(*) AS total_events
      FROM events`
    ).bind(now - 900, now - 3600, todayStart, yesterdayStart, todayStart, now - 7 * 86400, now - 30 * 86400, todayStart),

    env.DB.prepare(
      `SELECT date(ts + ?, 'unixepoch') AS day, count(DISTINCT install_id) AS dau, count(*) AS events
       FROM events
       WHERE ts >= ?
       GROUP BY day
       ORDER BY day ASC`
    ).bind(tzOffsetSec, trendSince),

    env.DB.prepare(
      `SELECT COALESCE(NULLIF(country, ''), '??') AS country, count(DISTINCT install_id) AS installs, count(*) AS events
       FROM events
       WHERE ts >= ?
       GROUP BY country
       ORDER BY installs DESC, events DESC
       LIMIT 20`
    ).bind(rangeSince),

    env.DB.prepare(
      `SELECT COALESCE(NULLIF(version, ''), 'unknown') AS version, count(DISTINCT install_id) AS installs, count(*) AS events
       FROM events
       WHERE ts >= ?
       GROUP BY version
       ORDER BY installs DESC, events DESC
       LIMIT 15`
    ).bind(rangeSince),

    env.DB.prepare(
      `SELECT COALESCE(NULLIF(os, ''), 'unknown') AS os, count(DISTINCT install_id) AS installs
       FROM events
       WHERE ts >= ?
       GROUP BY os
       ORDER BY installs DESC
       LIMIT 10`
    ).bind(rangeSince),

    env.DB.prepare(
      `SELECT COALESCE(NULLIF(locale, ''), 'unknown') AS locale, count(DISTINCT install_id) AS installs
       FROM events
       WHERE ts >= ?
       GROUP BY locale
       ORDER BY installs DESC
       LIMIT 12`
    ).bind(rangeSince),

    env.DB.prepare(
      `SELECT tz_offset, count(DISTINCT install_id) AS installs
       FROM events
       WHERE ts >= ?
       GROUP BY tz_offset
       ORDER BY installs DESC
       LIMIT 12`
    ).bind(rangeSince),

    env.DB.prepare(
      `SELECT CASE WHEN json_valid(props) THEN COALESCE(json_extract(props, '$.feature'), '') ELSE '' END AS feature,
              count(DISTINCT install_id) AS installs,
              count(*) AS uses
       FROM events
       WHERE ts >= ? AND event = 'feature_use'
       GROUP BY feature
       HAVING feature != ''
       ORDER BY uses DESC
       LIMIT 15`
    ).bind(rangeSince),

    env.DB.prepare(
      `SELECT ts, substr(install_id, 1, 8) AS id_prefix, event, version, os, locale, tz_offset, country, colo, props
       FROM events
       ORDER BY ts DESC, id DESC
       LIMIT 15`
    ),
  ]);

  const rows = (idx) => (results[idx] && Array.isArray(results[idx].results) ? results[idx].results : []);
  const summary = rows(0)[0] || {};

  return json(
    {
      generated_at: now,
      tz_hours: tzHours,
      range: rangeParam,
      summary: {
        active_15m: Number(summary.active_15m || 0),
        active_1h: Number(summary.active_1h || 0),
        dau_today: Number(summary.dau_today || 0),
        dau_yesterday: Number(summary.dau_yesterday || 0),
        wau_7d: Number(summary.wau_7d || 0),
        mau_30d: Number(summary.mau_30d || 0),
        total_installs: Number(summary.total_installs || 0),
        events_today: Number(summary.events_today || 0),
        total_events: Number(summary.total_events || 0),
      },
      daily: rows(1),
      countries: rows(2),
      versions: rows(3),
      oses: rows(4),
      locales: rows(5),
      timezones: rows(6),
      features: rows(7),
      recent: rows(8),
    },
    200,
    NO_STORE_HEADERS
  );
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Anki Studio 实时统计看板</title>
  <style>
    :root {
      --bg: #f5f6fa;
      --card: #ffffff;
      --text: #18181b;
      --muted: #71717a;
      --border: #e4e4e7;
      --accent: #4f46e5;
      --accent-soft: rgba(79, 70, 229, 0.12);
      --green: #10b981;
      --amber: #f59e0b;
      --danger: #ef4444;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0c0d12;
        --card: #151720;
        --text: #f4f4f5;
        --muted: #a1a1aa;
        --border: #27272f;
        --accent: #818cf8;
        --accent-soft: rgba(129, 140, 248, 0.16);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 20px 16px 48px; }
    .topbar {
      display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
      margin-bottom: 18px;
    }
    .title { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 700; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 4px rgba(16,185,129,.18); }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .seg { display: inline-flex; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
    .seg button {
      border: 0; background: transparent; color: var(--muted); padding: 5px 10px; border-radius: 7px;
      font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .seg button.active { background: var(--accent); color: #fff; }
    .btn {
      border: 1px solid var(--border); background: var(--card); color: var(--text);
      padding: 6px 11px; border-radius: 9px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn:disabled { opacity: 0.6; cursor: default; }
    .meta { font-size: 12px; color: var(--muted); margin-bottom: 16px; display: flex; gap: 14px; flex-wrap: wrap; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 14px; }
    .card {
      background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px;
    }
    .kpi-label { font-size: 12px; color: var(--muted); font-weight: 500; }
    .kpi-val { font-size: 28px; font-weight: 700; margin-top: 4px; letter-spacing: -0.02em; }
    .kpi-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 12px; margin-top: 12px; }
    .card h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
    .bar-row { margin-bottom: 9px; }
    .bar-row:last-child { margin-bottom: 0; }
    .bar-head { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; gap: 8px; }
    .bar-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-num { color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .bar-track { height: 6px; border-radius: 99px; background: var(--accent-soft); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 99px; background: var(--accent); }
    .chart-wrap { width: 100%; overflow-x: auto; }
    .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 130px; padding-top: 10px; }
    .day-col { flex: 1; min-width: 20px; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 4px; }
    .day-val { font-size: 10px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .day-bar { width: 100%; max-width: 28px; background: var(--accent); border-radius: 5px 5px 2px 2px; min-height: 2px; transition: height .2s; }
    .day-lbl { font-size: 10px; color: var(--muted); white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    th { color: var(--muted); font-weight: 600; }
    .table-scroll { overflow-x: auto; }
    .pill {
      display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 11px; font-weight: 600;
      background: var(--accent-soft); color: var(--accent);
    }
    .auth-box {
      max-width: 400px; margin: 10vh auto; background: var(--card); border: 1px solid var(--border);
      border-radius: 16px; padding: 24px;
    }
    .auth-box h2 { margin: 0 0 8px; font-size: 18px; }
    .auth-box p { margin: 0 0 16px; font-size: 13px; color: var(--muted); }
    .input {
      width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--bg); color: var(--text); font-size: 14px; margin-bottom: 12px;
    }
    .err { color: var(--danger); font-size: 12.5px; margin-bottom: 10px; min-height: 18px; }
    .empty { color: var(--muted); font-size: 12.5px; padding: 10px 0; }
    label.chk { font-size: 12px; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="app" class="wrap"></div>
  <script>
    const STORAGE_KEY = "anki_studio_dash_token";
    const COUNTRY_NAMES = {
      CN: "🇨🇳 中国大陆", HK: "🇭🇰 中国香港", MO: "🇲🇴 中国澳门", TW: "🇹🇼 中国台湾",
      US: "🇺🇸 美国", JP: "🇯🇵 日本", SG: "🇸🇬 新加坡", GB: "🇬🇧 英国",
      DE: "🇩🇪 德国", CA: "🇨🇦 加拿大", AU: "🇦🇺 澳大利亚", KR: "🇰🇷 韩国",
      FR: "🇫🇷 法国", NL: "🇳🇱 荷兰", RU: "🇷🇺 俄罗斯", IN: "🇮🇳 印度",
      "??": "🌐 未知"
    };
    const state = {
      token: localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || "",
      range: "7d",
      autoRefresh: true,
      loading: false,
      error: "",
      data: null,
      timer: null,
    };

    const app = document.getElementById("app");
    function esc(v) {
      return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function fmtRel(ts) {
      const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts || 0));
      if (diff < 60) return diff + " 秒前";
      if (diff < 3600) return Math.floor(diff / 60) + " 分钟前";
      if (diff < 86400) return Math.floor(diff / 3600) + " 小时前";
      return Math.floor(diff / 86400) + " 天前";
    }
    function fmtTz(v) {
      if (v === null || v === undefined || v === "") return "未知";
      const n = Number(v);
      return "UTC" + (n >= 0 ? "+" + n : String(n));
    }

    function renderAuth() {
      app.innerHTML = \`
        <div class="auth-box">
          <h2>Anki Studio 实时统计</h2>
          <p>请输入 Worker 环境变量 <code>DASHBOARD_TOKEN</code> 中设置的访问密钥。</p>
          <form id="auth-form">
            <input id="tok-input" class="input" type="password" placeholder="输入访问密钥..." autocomplete="current-password" required />
            <div class="err">\${esc(state.error)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <label class="chk"><input id="remember" type="checkbox" checked /> 在本设备记住密钥</label>
              <button class="btn primary" type="submit">进入看板</button>
            </div>
          </form>
        </div>\`;
      document.getElementById("auth-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const val = document.getElementById("tok-input").value.trim();
        if (!val) return;
        const remember = document.getElementById("remember").checked;
        state.token = val;
        state.error = "";
        if (remember) localStorage.setItem(STORAGE_KEY, val);
        else sessionStorage.setItem(STORAGE_KEY, val);
        loadStats();
      });
    }

    function renderBars(items, labelFn, countKey = "installs", extraFn = null) {
      if (!items || !items.length) return '<div class="empty">暂无数据</div>';
      const max = Math.max(1, ...items.map((x) => Number(x[countKey] || 0)));
      return items.map((item) => {
        const val = Number(item[countKey] || 0);
        const pct = Math.max(2, Math.round((val / max) * 100));
        const extra = extraFn ? extraFn(item) : "";
        return \`<div class="bar-row">
          <div class="bar-head">
            <span class="bar-name">\${esc(labelFn(item))}</span>
            <span class="bar-num">\${val}\${extra ? " · " + esc(extra) : ""}</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:\${pct}%"></div></div>
        </div>\`;
      }).join("");
    }

    function renderTrend(daily) {
      if (!daily || !daily.length) return '<div class="empty">暂无趋势数据</div>';
      const maxDau = Math.max(1, ...daily.map((d) => Number(d.dau || 0)));
      return '<div class="chart-wrap"><div class="chart-bars">' + daily.map((d) => {
        const dau = Number(d.dau || 0);
        const h = Math.max(3, Math.round((dau / maxDau) * 86));
        const label = String(d.day || "").slice(5);
        return \`<div class="day-col" title="\${esc(d.day)}: \${dau} 设备 / \${Number(d.events || 0)} 事件">
          <div class="day-val">\${dau}</div>
          <div class="day-bar" style="height:\${h}px"></div>
          <div class="day-lbl">\${esc(label)}</div>
        </div>\`;
      }).join("") + '</div></div>';
    }

    function renderDashboard() {
      const d = state.data;
      const s = d.summary;
      const diff = s.dau_today - s.dau_yesterday;
      const diffTxt = diff === 0 ? "与昨日持平" : (diff > 0 ? \`较昨日 +\${diff}\` : \`较昨日 \${diff}\`);
      const updated = new Date(d.generated_at * 1000).toLocaleTimeString();

      app.innerHTML = \`
        <div class="topbar">
          <div class="title"><span class="dot"></span> Anki Studio 实时用户看板</div>
          <div class="controls">
            <div class="seg">
              \${[["today","今天"],["7d","近 7 天"],["30d","近 30 天"],["all","90 天全量"]].map(([k, lbl]) =>
                \`<button data-range="\${k}" class="\${state.range === k ? "active" : ""}">\${lbl}</button>\`
              ).join("")}
            </div>
            <label class="chk"><input id="auto-chk" type="checkbox" \${state.autoRefresh ? "checked" : ""} /> 30s 自动刷新</label>
            <button id="refresh-btn" class="btn" \${state.loading ? "disabled" : ""}>\${state.loading ? "刷新中..." : "立即刷新"}</button>
            <button id="logout-btn" class="btn">退出</button>
          </div>
        </div>
        <div class="meta">
          <span>更新于 \${esc(updated)}</span>
          <span>统计时区 UTC\${d.tz_hours >= 0 ? "+" + d.tz_hours : d.tz_hours}</span>
          <span>数据保留最近 90 天 · 不含 IP 与卡片隐私</span>
        </div>
        <div class="kpis">
          <div class="card">
            <div class="kpi-label">实时活跃（15 分钟）</div>
            <div class="kpi-val">\${s.active_15m}</div>
            <div class="kpi-sub">近 1 小时：\${s.active_1h} 台设备</div>
          </div>
          <div class="card">
            <div class="kpi-label">今日活跃设备（DAU）</div>
            <div class="kpi-val">\${s.dau_today}</div>
            <div class="kpi-sub">昨日 \${s.dau_yesterday}（\${diffTxt}）</div>
          </div>
          <div class="card">
            <div class="kpi-label">7 日 / 30 日活跃</div>
            <div class="kpi-val">\${s.wau_7d} <span style="font-size:16px;color:var(--muted);font-weight:500">/ \${s.mau_30d}</span></div>
            <div class="kpi-sub">今日收到 \${s.events_today} 条事件</div>
          </div>
          <div class="card">
            <div class="kpi-label">90 天累计独立安装</div>
            <div class="kpi-val">\${s.total_installs}</div>
            <div class="kpi-sub">累计事件：\${s.total_events}</div>
          </div>
        </div>

        <div class="card">
          <h3><span>每日活跃设备趋势（DAU）</span><span class="kpi-sub">悬停柱状图可看事件数</span></h3>
          \${renderTrend(d.daily)}
        </div>

        <div class="grid">
          <div class="card">
            <h3><span>国家 / 地区分布</span><span class="kpi-sub">按独立设备</span></h3>
            \${renderBars(d.countries, (x) => COUNTRY_NAMES[x.country] || x.country, "installs", (x) => x.events + " 事件")}
          </div>
          <div class="card">
            <h3><span>插件版本分布</span><span class="kpi-sub">新版升级进度</span></h3>
            \${renderBars(d.versions, (x) => "v" + x.version, "installs", (x) => x.events + " 事件")}
          </div>
          <div class="card">
            <h3><span>操作系统 & 时区</span><span class="kpi-sub">独立设备</span></h3>
            \${renderBars(d.oses, (x) => x.os)}
            <div style="height:12px;border-top:1px solid var(--border);margin:12px 0;"></div>
            \${renderBars(d.timezones, (x) => fmtTz(x.tz_offset))}
          </div>
          <div class="card">
            <h3><span>界面语言 & 功能热度</span><span class="kpi-sub">feature_use</span></h3>
            \${renderBars(d.locales, (x) => x.locale)}
            <div style="height:12px;border-top:1px solid var(--border);margin:12px 0;"></div>
            \${renderBars(d.features, (x) => x.feature, "uses", (x) => x.installs + " 人")}
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <h3><span>最近 15 条实时上报</span><span class="kpi-sub">已脱敏设备哈希前 8 位</span></h3>
          <div class="table-scroll">
            <table>
              <thead>
                <tr><th>时间</th><th>设备</th><th>事件</th><th>版本</th><th>系统</th><th>语言</th><th>地区</th><th>机房</th><th>附加</th></tr>
              </thead>
              <tbody>
                \${d.recent.length ? d.recent.map((r) => \`<tr>
                  <td>\${esc(fmtRel(r.ts))}</td>
                  <td><code>\${esc(r.id_prefix)}</code></td>
                  <td><span class="pill">\${esc(r.event)}</span></td>
                  <td>\${esc(r.version || "-")}</td>
                  <td>\${esc(r.os || "-")}</td>
                  <td>\${esc(r.locale || "-")}</td>
                  <td>\${esc(COUNTRY_NAMES[r.country] || r.country || "-")} (\${esc(fmtTz(r.tz_offset))})</td>
                  <td>\${esc(r.colo || "-")}</td>
                  <td><code>\${esc(r.props || "")}</code></td>
                </tr>\`).join("") : '<tr><td colspan="9" class="empty">暂无上报记录</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>\`;

      document.querySelectorAll("[data-range]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.range = btn.getAttribute("data-range");
          loadStats();
        });
      });
      document.getElementById("refresh-btn").addEventListener("click", loadStats);
      document.getElementById("auto-chk").addEventListener("change", (e) => {
        state.autoRefresh = e.target.checked;
        resetTimer();
      });
      document.getElementById("logout-btn").addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        state.token = "";
        state.data = null;
        clearInterval(state.timer);
        renderAuth();
      });
    }

    function resetTimer() {
      clearInterval(state.timer);
      if (state.autoRefresh && state.token) {
        state.timer = setInterval(() => loadStats(true), 30000);
      }
    }

    async function loadStats(silent = false) {
      if (!state.token) { renderAuth(); return; }
      if (!silent) {
        state.loading = true;
        if (state.data) renderDashboard();
      }
      try {
        const tz = Math.round(-new Date().getTimezoneOffset() / 60);
        const res = await fetch(\`/v1/stats?range=\${encodeURIComponent(state.range)}&tz=\${tz}\`, {
          headers: { Authorization: "Bearer " + state.token },
        });
        if (res.status === 401) {
          localStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY);
          state.token = "";
          state.data = null;
          state.error = "密钥错误，请重新输入";
          clearInterval(state.timer);
          renderAuth();
          return;
        }
        const payload = await res.json();
        if (!res.ok) {
          state.error = payload.message || payload.error || ("请求失败: " + res.status);
          if (!state.data) renderAuth();
          return;
        }
        state.error = "";
        state.data = payload;
        renderDashboard();
        resetTimer();
      } catch (err) {
        state.error = "网络请求失败：" + (err && err.message ? err.message : String(err));
        if (!state.data) renderAuth();
      } finally {
        state.loading = false;
      }
    }

    if (state.token) loadStats();
    else renderAuth();
  </script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    if (request.method === "GET" && (url.pathname === "/dashboard" || url.pathname === "/dashboard/")) {
      return new Response(DASHBOARD_HTML, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          ...NO_STORE_HEADERS,
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/stats") {
      return handleStats(request, env, url);
    }

    if (request.method !== "POST" || url.pathname !== "/v1/events") {
      return json({ error: "not found" }, 404);
    }

    // UA allowlist: reject anything that is not the add-on client before we
    // parse the body or open a D1 batch. See LEGIT_UA_PREFIX above.
    const ua = request.headers.get("user-agent") || "";
    if (
      !ua.startsWith(LEGIT_UA_PREFIX) ||
      ua.length <= LEGIT_UA_PREFIX.length ||
      ua.length > MAX_UA_LENGTH
    ) {
      return json({ error: "forbidden" }, 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const incoming = Array.isArray(body && body.events) ? body.events.slice(0, MAX_EVENTS) : [];
    const rows = incoming.map(sanitize).filter(Boolean);
    if (!rows.length) return json({ ok: true, stored: 0 });

    const cf = request.cf || {};
    const country = cf.country ? String(cf.country).slice(0, 2).toUpperCase() : "";
    const colo = cf.colo ? String(cf.colo).slice(0, 3).toUpperCase() : "";
    const stmt = env.DB.prepare(
      "INSERT INTO events (ts, install_id, event, version, os, anki_version, locale, tz_offset, country, colo, props) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    await env.DB.batch(
      rows.map((row) =>
        stmt.bind(
          row.ts,
          row.install_id,
          row.event,
          row.version,
          row.os,
          row.anki_version,
          row.locale,
          row.tz_offset,
          country,
          colo,
          row.props
        )
      )
    );
    return json({ ok: true, stored: rows.length });
  },

  async scheduled(_event, env) {
    const cutoff = Math.trunc(Date.now() / 1000) - RETENTION_DAYS * 86400;
    await env.DB.prepare("DELETE FROM events WHERE ts < ?").bind(cutoff).run();
  },
};
