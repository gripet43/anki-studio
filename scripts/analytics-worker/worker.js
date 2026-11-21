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
const MAX_TS_DRIFT_SEC = 7 * 86400;

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

function parseExcludePrefixes(raw) {
  if (!raw || typeof raw !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const part of raw.split(/[\s,]+/)) {
    const clean = part.trim().toLowerCase();
    if (/^[a-f0-9]{4,64}$/.test(clean) && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
      if (out.length >= 10) break;
    }
  }
  return out;
}

function sanitize(event, serverNow = Math.trunc(Date.now() / 1000)) {
  if (!event || typeof event !== "object") return null;
  const name = str(event.event, 32);
  if (!ALLOWED_EVENTS.has(name)) return null;
  const installId = str(event.install_id, 64);
  if (!/^[a-f0-9]{32,64}$/i.test(installId)) return null;

  // Clamp abnormal client clocks (e.g. ts=0 or >7d drift) back to server time.
  let ts = serverNow;
  if (Number.isFinite(event.ts)) {
    const candidate = Math.trunc(event.ts);
    if (Math.abs(candidate - serverNow) <= MAX_TS_DRIFT_SEC) {
      ts = candidate;
    }
  }

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

const CACHE_TTL_MS = 60_000;
const MAX_SCAN_ROWS = 50000;
let cachedEvents = null;

function formatDayUTC(unixSec, tzOffsetSec) {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

function nextDayKey(dayKey) {
  const ms = Date.parse(dayKey + "T00:00:00Z");
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms + 86400 * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

async function fetchAllEvents(db, forceFresh) {
  const nowMs = Date.now();
  if (!forceFresh && cachedEvents && nowMs - cachedEvents.fetchedAt < CACHE_TTL_MS) {
    return cachedEvents.rows;
  }
  const stmt = db
    .prepare(
      `SELECT ts, install_id, event, version, os, anki_version, locale, tz_offset, country, colo, props
       FROM events
       ORDER BY ts DESC, id DESC
       LIMIT ?`
    )
    .bind(MAX_SCAN_ROWS);
  const res = typeof stmt.all === "function" ? await stmt.all() : (await db.batch([stmt]))[0];
  const rows = res && Array.isArray(res.results) ? res.results : [];
  cachedEvents = { fetchedAt: nowMs, rows };
  return rows;
}

function aggregateStats(allRows, opts) {
  const { now, tzHours, tzOffsetSec, todayStart, yesterdayStart, rangeParam, rangeSince, rangeUntil = Infinity, trendDays, trendSince, d1CohortSince, excludePrefixes } = opts;
  const wauSince = todayStart - 6 * 86400;
  const mauSince = todayStart - 29 * 86400;

  const active15m = new Set();
  const active1h = new Set();
  const dauToday = new Set();
  const dauYesterday = new Set();
  const wau7d = new Set();
  const mau30d = new Set();
  const reviewersInRange = new Set();

  const firstSeenTs = new Map(); // install_id -> min ts
  const userDays = new Map(); // install_id -> Set(dayKey)
  const dayEvents = new Map(); // dayKey -> { users: Set, events: number }

  const hourlyMap = new Map(); // 0..23 -> { users: Set, events: number }
  const countryMap = new Map();
  const versionMap = new Map();
  const osMap = new Map();
  const ankiVerMap = new Map();
  const localeMap = new Map();
  const tzMap = new Map();
  const bucketMap = new Map();
  const featureMap = new Map();
  const recent = [];

  let eventsToday = 0;
  let totalEvents = 0;
  let reviewsInRange = 0;

  const bumpMap = (map, key, installId) => {
    let entry = map.get(key);
    if (!entry) {
      entry = { users: new Set(), count: 0 };
      map.set(key, entry);
    }
    entry.users.add(installId);
    entry.count += 1;
  };

  for (const r of allRows) {
    const id = String(r.install_id || "");
    if (!id) continue;
    if (excludePrefixes.length) {
      const lower = id.toLowerCase();
      if (excludePrefixes.some((p) => lower.startsWith(p))) continue;
    }

    const ts = Number(r.ts || 0);
    const ev = String(r.event || "");
    const dayKey = formatDayUTC(ts, tzOffsetSec);
    totalEvents += 1;

    if (recent.length < 30) {
      recent.push({
        ts,
        id_prefix: id.slice(0, 8),
        event: ev,
        version: r.version || "",
        os: r.os || "",
        anki_version: r.anki_version || "",
        locale: r.locale || "",
        tz_offset: r.tz_offset ?? null,
        country: r.country || "",
        colo: r.colo || "",
        props: r.props ?? null,
      });
    }

    const prevFirst = firstSeenTs.get(id);
    if (prevFirst === undefined || ts < prevFirst) firstSeenTs.set(id, ts);

    let dSet = userDays.get(id);
    if (!dSet) {
      dSet = new Set();
      userDays.set(id, dSet);
    }
    dSet.add(dayKey);

    if (ts >= now - 900) active15m.add(id);
    if (ts >= now - 3600) active1h.add(id);
    if (ts >= todayStart) {
      dauToday.add(id);
      eventsToday += 1;
    } else if (ts >= yesterdayStart) {
      dauYesterday.add(id);
    }
    if (ts >= wauSince) wau7d.add(id);
    if (ts >= mauSince) mau30d.add(id);

    if (ts >= trendSince) {
      let de = dayEvents.get(dayKey);
      if (!de) {
        de = { users: new Set(), events: 0 };
        dayEvents.set(dayKey, de);
      }
      de.users.add(id);
      de.events += 1;
    }

    if (ts >= rangeSince && ts < rangeUntil) {
      const hour = new Date((ts + tzOffsetSec) * 1000).getUTCHours();
      bumpMap(hourlyMap, hour, id);
      bumpMap(countryMap, r.country ? String(r.country) : "??", id);
      bumpMap(versionMap, r.version ? String(r.version) : "unknown", id);
      bumpMap(osMap, r.os ? String(r.os) : "unknown", id);
      bumpMap(ankiVerMap, r.anki_version ? String(r.anki_version) : "unknown", id);
      bumpMap(localeMap, r.locale ? String(r.locale) : "unknown", id);
      bumpMap(tzMap, r.tz_offset ?? null, id);

      let parsedProps = null;
      if (r.props && typeof r.props === "string") {
        try {
          parsedProps = JSON.parse(r.props);
        } catch {}
      }
      if (ev === "review_session") {
        reviewsInRange += 1;
        reviewersInRange.add(id);
        if (parsedProps && parsedProps.cards_bucket) {
          bumpMap(bucketMap, String(parsedProps.cards_bucket), id);
        }
      } else if (ev === "feature_use" && parsedProps && parsedProps.feature) {
        bumpMap(featureMap, String(parsedProps.feature), id);
      }
    }
  }

  let newToday = 0;
  let newYesterday = 0;
  let d1Cohort7d = 0;
  let d1Retained7d = 0;
  const newByDay = new Map();

  for (const [id, fts] of firstSeenTs.entries()) {
    const firstDay = formatDayUTC(fts, tzOffsetSec);
    newByDay.set(firstDay, (newByDay.get(firstDay) || 0) + 1);
    if (fts >= todayStart) newToday += 1;
    else if (fts >= yesterdayStart) newYesterday += 1;
    if (fts >= d1CohortSince && fts < todayStart) {
      d1Cohort7d += 1;
      const nextDay = nextDayKey(firstDay);
      if (userDays.get(id)?.has(nextDay)) d1Retained7d += 1;
    }
  }

  const daily = Array.from(dayEvents.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, info]) => ({
      day,
      dau: info.users.size,
      new_users: newByDay.get(day) || 0,
      events: info.events,
    }));

  const hourly = Array.from(hourlyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, info]) => ({ hour, installs: info.users.size, events: info.count }));

  const sortByInstalls = (map, keyName, includeEvents = false, limit = 20) =>
    Array.from(map.entries())
      .map(([k, info]) =>
        includeEvents
          ? { [keyName]: k, installs: info.users.size, events: info.count }
          : { [keyName]: k, installs: info.users.size }
      )
      .sort((a, b) => b.installs - a.installs || (b.events || 0) - (a.events || 0))
      .slice(0, limit);

  const review_buckets = Array.from(bucketMap.entries())
    .map(([bucket, info]) => ({ bucket, installs: info.users.size, sessions: info.count }))
    .sort((a, b) => b.sessions - a.sessions);

  const features = Array.from(featureMap.entries())
    .map(([feature, info]) => ({ feature, installs: info.users.size, uses: info.count }))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 50);

  return {
    generated_at: now,
    tz_hours: tzHours,
    range: rangeParam,
    trend_days: trendDays,
    today_start: todayStart,
    excluded: excludePrefixes,
    summary: {
      active_15m: active15m.size,
      active_1h: active1h.size,
      dau_today: dauToday.size,
      dau_yesterday: dauYesterday.size,
      wau_7d: wau7d.size,
      mau_30d: mau30d.size,
      total_installs: firstSeenTs.size,
      new_today: newToday,
      new_yesterday: newYesterday,
      events_today: eventsToday,
      total_events: totalEvents,
      reviews_in_range: reviewsInRange,
      reviewers_in_range: reviewersInRange.size,
      d1_cohort_7d: d1Cohort7d,
      d1_retained_7d: d1Retained7d,
    },
    daily,
    hourly,
    countries: sortByInstalls(countryMap, "country", true, 20),
    versions: sortByInstalls(versionMap, "version", true, 15),
    oses: sortByInstalls(osMap, "os", false, 10),
    anki_versions: sortByInstalls(ankiVerMap, "anki_version", false, 12),
    locales: sortByInstalls(localeMap, "locale", false, 12),
    timezones: sortByInstalls(tzMap, "tz_offset", false, 12),
    review_buckets,
    features,
    recent,
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
    yesterday: yesterdayStart,
    "7d": todayStart - 6 * 86400,
    "30d": todayStart - 29 * 86400,
    all: 0,
  };
  const rangeSince = Object.prototype.hasOwnProperty.call(rangeMap, rangeParam) ? rangeMap[rangeParam] : rangeMap["7d"];
  const rangeUntil = rangeParam === "yesterday" ? todayStart : Infinity;
  const trendDays = rangeParam === "30d" || rangeParam === "all" ? 30 : 14;
  const trendSince = todayStart - (trendDays - 1) * 86400;
  const d1CohortSince = todayStart - 7 * 86400;
  const excludePrefixes = parseExcludePrefixes(url.searchParams.get("exclude") || "");
  const forceFresh = url.searchParams.get("fresh") === "1";

  let allRows;
  try {
    allRows = await fetchAllEvents(env.DB, forceFresh);
  } catch (err) {
    const rawMsg = String(err && err.message ? err.message : err);
    const isQuota = rawMsg.toLowerCase().includes("daily row read limit") || rawMsg.toLowerCase().includes("exceeded");
    return json(
      {
        error: isQuota ? "d1_daily_quota_exceeded" : "d1_query_failed",
        message: isQuota
          ? "今日 Cloudflare D1 免费读取额度已用完（北京时间次日 08:00 自动重置）；插件用户的正常数据上报不受影响。"
          : "数据库查询暂时繁忙，请稍后重试 (" + rawMsg.slice(0, 120) + ")",
      },
      503,
      NO_STORE_HEADERS
    );
  }

  return json(
    aggregateStats(allRows, {
      now,
      tzHours,
      tzOffsetSec,
      todayStart,
      yesterdayStart,
      rangeParam,
      rangeSince,
      rangeUntil,
      trendDays,
      trendSince,
      d1CohortSince,
      excludePrefixes,
    }),
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
      --green-soft: rgba(16, 185, 129, 0.16);
      --amber: #f59e0b;
      --danger: #ef4444;
      --danger-soft: rgba(239, 68, 68, 0.12);
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
        --green: #34d399;
        --green-soft: rgba(52, 211, 153, 0.18);
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
    .wrap { max-width: 1160px; margin: 0 auto; padding: 18px 14px 48px; }
    .topbar {
      display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .title { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 700; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 4px var(--green-soft); }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .seg { display: inline-flex; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
    .seg button {
      border: 0; background: transparent; color: var(--muted); padding: 5px 10px; border-radius: 7px;
      font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    .seg button.active { background: var(--accent); color: #fff; }
    .btn {
      border: 1px solid var(--border); background: var(--card); color: var(--text);
      padding: 6px 10px; border-radius: 9px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.xs { padding: 2px 7px; font-size: 11px; border-radius: 6px; }
    .btn:disabled { opacity: 0.6; cursor: default; }
    .meta { font-size: 12px; color: var(--muted); margin-bottom: 12px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .banner-err {
      background: var(--danger-soft); color: var(--danger); border: 1px solid rgba(239,68,68,.28);
      border-radius: 10px; padding: 9px 12px; font-size: 12.5px; margin-bottom: 12px;
      display: flex; justify-content: space-between; align-items: center; gap: 10px;
    }
    .filter-bar {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px;
      background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; font-size: 12px;
    }
    .filter-input {
      flex: 1; min-width: 180px; border: 1px solid var(--border); background: var(--bg); color: var(--text);
      border-radius: 8px; padding: 5px 9px; font-size: 12px;
    }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 11px; margin-bottom: 12px; }
    .card {
      background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px;
    }
    .kpi-label { font-size: 12px; color: var(--muted); font-weight: 500; }
    .kpi-val { font-size: 26px; font-weight: 700; margin-top: 4px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .kpi-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .pos { color: var(--green); font-weight: 600; }
    .neg { color: var(--danger); font-weight: 600; }
    .charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 12px; margin-top: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 12px; margin-top: 12px; }
    .card h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .legend { display: inline-flex; gap: 10px; font-size: 11px; color: var(--muted); font-weight: 500; }
    .leg-item { display: inline-flex; align-items: center; gap: 4px; }
    .leg-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
    .bar-row { margin-bottom: 9px; }
    .bar-row:last-child { margin-bottom: 0; }
    .bar-head { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; gap: 8px; }
    .bar-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-num { color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .bar-track { height: 6px; border-radius: 99px; background: var(--accent-soft); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 99px; background: var(--accent); }
    .bar-fill.green { background: var(--green); }
    .chart-wrap { width: 100%; overflow-x: auto; }
    .chart-bars { display: flex; align-items: flex-end; gap: 5px; height: 144px; padding-top: 8px; }
    .day-col { flex: 1; min-width: 14px; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
    .day-val { height: 15px; line-height: 15px; font-size: 10px; color: var(--muted); font-variant-numeric: tabular-nums; margin-bottom: 3px; }
    .bar-stage { width: 100%; height: 96px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid var(--border); padding-bottom: 1px; }
    .stack-bar { width: 100%; max-width: 24px; display: flex; flex-direction: column; justify-content: flex-end; border-radius: 4px 4px 1px 1px; overflow: hidden; }
    .seg-new { background: var(--green); width: 100%; }
    .seg-ret { background: var(--accent); width: 100%; }
    .hour-bar { width: 100%; max-width: 16px; background: var(--accent); border-radius: 4px 4px 1px 1px; min-height: 2px; opacity: 0.92; }
    .hour-bar.zero { opacity: 0.16; }
    .day-lbl { height: 18px; line-height: 18px; font-size: 10px; color: var(--muted); white-space: nowrap; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 8px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    th { color: var(--muted); font-weight: 600; }
    tbody tr:hover { background: var(--accent-soft); }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
    @media (max-width: 980px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
    .table-scroll { overflow-x: auto; }
    .pill {
      display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 11px; font-weight: 600;
      background: var(--accent-soft); color: var(--accent);
    }
    .pill.green { background: var(--green-soft); color: var(--green); }
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
    label.chk { font-size: 12px; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; white-space: nowrap; }
    @media (max-width: 640px) {
      .kpi-val { font-size: 22px; }
      .title { font-size: 16px; }
    }
  </style>
</head>
<body>
  <div id="app" class="wrap"></div>
  <script>
    const STORAGE_KEY = "anki_studio_dash_token";
    const EXCLUDE_KEY = "anki_studio_dash_exclude";

    const COUNTRY_OVERRIDES = {
      CN: "中国大陆", HK: "中国香港", MO: "中国澳门", TW: "中国台湾",
    };
    const regionDisplay = typeof Intl !== "undefined" && Intl.DisplayNames
      ? new Intl.DisplayNames(["zh-CN"], { type: "region" })
      : null;
    const langDisplay = typeof Intl !== "undefined" && Intl.DisplayNames
      ? new Intl.DisplayNames(["zh-CN"], { type: "language" })
      : null;
    const LOCALE_OVERRIDES = {
      "zh-CN": "简体中文", "zh-TW": "繁体中文", en: "English", auto: "跟随系统",
      ja: "日语", ko: "韩语", de: "德语", fr: "法语", es: "西班牙语", ru: "俄语",
      "pt-BR": "葡萄牙语", it: "意大利语", ar: "阿拉伯语", vi: "越南语", tr: "土耳其语", pl: "波兰语", nl: "荷兰语",
    };
    function codeToFlag(code) {
      if (!/^[A-Z]{2}$/.test(code)) return "🌐";
      return String.fromCodePoint(0x1f1e6 + code.charCodeAt(0) - 65, 0x1f1e6 + code.charCodeAt(1) - 65);
    }
    function fmtCountry(raw) {
      const code = String(raw || "").trim().toUpperCase();
      if (!code || code === "??") return "🌐 未知地区";
      const flag = codeToFlag(code);
      if (COUNTRY_OVERRIDES[code]) return flag + " " + COUNTRY_OVERRIDES[code];
      if (regionDisplay) {
        try {
          const name = regionDisplay.of(code);
          if (name && name !== code) return flag + " " + name;
        } catch {}
      }
      return flag + " " + code;
    }
    function fmtLocale(raw) {
      const val = String(raw || "").trim();
      if (!val || val === "unknown") return "未知";
      if (LOCALE_OVERRIDES[val]) return LOCALE_OVERRIDES[val] + " (" + val + ")";
      if (langDisplay) {
        try {
          const name = langDisplay.of(val);
          if (name && name !== val) return name + " (" + val + ")";
        } catch {}
      }
      return val;
    }
    const OS_NAMES = {
      darwin: "macOS",
      windows: "Windows",
      linux: "Linux",
      unknown: "未知系统"
    };
    const EVENT_NAMES = {
      app_open: "启动",
      daily_active: "日活",
      review_session: "复习会话",
      feature_use: "功能使用"
    };
    const FEATURE_NAMES = {
      library_search: "卡片库搜索",
      quick_add: "快速制卡",
      vacation: "休假模式",
      relief: "雪崩减负",
      zen_mode: "专注模式",
      low_energy: "轻量复习",
      custom_study: "自定义学习",
      stats_view: "数据统计页",
      decks_view: "牌组管理页",
      command_palette: "Cmd+K 全局搜索",
      sync: "AnkiWeb 同步",
      card_edit: "编辑卡片",
      paste_image: "粘贴图片制卡",
      library_batch: "卡片库批量操作",
      deck_manage: "牌组增删改",
      deck_options: "牌组学习设置",
      zen_ambience: "专注白噪音",
      audio_play: "卡片朗读播放",
      audio_autoplay: "自动播音开关",
      undo_review: "撤销评分",
      card_flag: "旗标标记",
      card_suspend: "暂停/恢复卡片",
      card_bury: "搁置卡片",
      card_forget: "重置卡片进度",
      card_delete: "删除卡片",
      sandbox_compat: "原生兼容沙盒",
      image_lightbox: "图片灯箱缩放",
      view_tuning: "复习画幅/字号",
      theme_change: "切换主题/配色",
      language_change: "切换界面语言",
      avatar_custom: "自定义头像",
      sidebar_toggle: "侧边栏缩放",
      import_export: "导入 / 导出",
      maintenance: "数据库维护",
      switch_native: "切回原生界面"
    };
    const BUCKET_ORDER = ["1-20", "21-50", "51-100", "100+"];

    const state = {
      token: localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || "",
      range: "today",
      recentFilter: "all",
      showZeroFeatures: false,
      error: "",
      data: null,
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
    function fmtOs(v) {
      const k = String(v || "").toLowerCase();
      return OS_NAMES[k] || v || "未知";
    }
    function fmtEvent(v) {
      return EVENT_NAMES[v] || v || "-";
    }
    function fmtFeature(v) {
      return FEATURE_NAMES[v] || v || "-";
    }
    function fmtProps(raw) {
      if (!raw) return "";
      try {
        const obj = JSON.parse(raw);
        if (obj.feature) return FEATURE_NAMES[obj.feature] || obj.feature;
        if (obj.cards_bucket) return obj.cards_bucket + " 张";
        return raw;
      } catch {
        return raw;
      }
    }
    function pad2(n) { return n < 10 ? "0" + n : String(n); }
    function formatDayKey(unixSec, tzHours) {
      const d = new Date((unixSec + tzHours * 3600) * 1000);
      return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
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

    function renderBars(items, labelFn, countKey = "installs", extraFn = null, colorClass = "") {
      if (!items || !items.length) return '<div class="empty">暂无数据</div>';
      const max = Math.max(1, ...items.map((x) => Number(x[countKey] || 0)));
      const total = items.reduce((acc, x) => acc + Number(x[countKey] || 0), 0);
      return items.map((item) => {
        const val = Number(item[countKey] || 0);
        const pctWidth = val > 0 ? Math.max(2, Math.round((val / max) * 100)) : 0;
        const share = total > 0 ? Math.round((val / total) * 100) : 0;
        const extra = extraFn ? extraFn(item) : "";
        return \`<div class="bar-row">
          <div class="bar-head">
            <span class="bar-name">\${esc(labelFn(item))}</span>
            <span class="bar-num">\${val} (\${share}%)\${extra ? " · " + esc(extra) : ""}</span>
          </div>
          <div class="bar-track"><div class="bar-fill \${colorClass}" style="width:\${pctWidth}%"></div></div>
        </div>\`;
      }).join("");
    }

    function renderTrend(daily, todayStart, trendDays, tzHours) {
      const byDay = new Map((daily || []).map((d) => [d.day, d]));
      const series = [];
      const count = Math.max(1, Number(trendDays || 14));
      for (let i = count - 1; i >= 0; i -= 1) {
        const key = formatDayKey(todayStart - i * 86400, tzHours);
        const row = byDay.get(key) || { day: key, dau: 0, new_users: 0, events: 0 };
        series.push({
          day: key,
          dau: Number(row.dau || 0),
          new_users: Number(row.new_users || 0),
          events: Number(row.events || 0),
        });
      }
      const maxDau = Math.max(1, ...series.map((d) => d.dau));
      const labelStep = count > 16 ? 5 : 2;
      return '<div class="chart-wrap"><div class="chart-bars">' + series.map((d, idx) => {
        const ret = Math.max(0, d.dau - d.new_users);
        const totalH = d.dau > 0 ? Math.max(4, Math.round((d.dau / maxDau) * 90)) : 2;
        const newH = d.dau > 0 ? Math.round((d.new_users / d.dau) * totalH) : 0;
        const retH = Math.max(0, totalH - newH);
        const showLbl = idx === series.length - 1 || idx % labelStep === 0;
        const label = showLbl ? d.day.slice(5) : "";
        const title = \`\${d.day}：活跃 \${d.dau}（新增 \${d.new_users} / 回访 \${ret}），共 \${d.events} 事件\`;
        return \`<div class="day-col" title="\${esc(title)}">
          <div class="day-val">\${d.dau || ""}</div>
          <div class="bar-stage">
            <div class="stack-bar" style="height:\${totalH}px;opacity:\${d.dau ? 1 : 0.16}">
              \${newH > 0 ? \`<div class="seg-new" style="height:\${newH}px"></div>\` : ""}
              \${retH > 0 ? \`<div class="seg-ret" style="height:\${retH}px"></div>\` : ""}
            </div>
          </div>
          <div class="day-lbl">\${esc(label)}</div>
        </div>\`;
      }).join("") + '</div></div>';
    }

    function renderHourly(hourly) {
      const byHour = new Map((hourly || []).map((h) => [Number(h.hour), h]));
      const series = [];
      for (let h = 0; h < 24; h += 1) {
        const row = byHour.get(h) || { hour: h, installs: 0, events: 0 };
        series.push({ hour: h, installs: Number(row.installs || 0), events: Number(row.events || 0) });
      }
      const maxVal = Math.max(1, ...series.map((x) => x.events));
      return '<div class="chart-wrap"><div class="chart-bars">' + series.map((x) => {
        const h = x.events > 0 ? Math.max(4, Math.round((x.events / maxVal) * 90)) : 2;
        const lbl = x.hour % 3 === 0 ? pad2(x.hour) : "";
        const title = \`\${pad2(x.hour)}:00 - \${pad2(x.hour)}:59：\${x.installs} 台设备 / \${x.events} 事件\`;
        return \`<div class="day-col" style="min-width:11px" title="\${esc(title)}">
          <div class="day-val">\${x.events || ""}</div>
          <div class="bar-stage">
            <div class="hour-bar \${x.events ? "" : "zero"}" style="height:\${h}px"></div>
          </div>
          <div class="day-lbl">\${lbl}</div>
        </div>\`;
      }).join("") + '</div></div>';
    }

    function renderDashboard() {
      const d = state.data;
      const s = d.summary;
      const dauDiff = s.dau_today - s.dau_yesterday;
      const dauDiffHtml = dauDiff === 0 ? "与昨日持平" : (dauDiff > 0 ? \`<span class="pos">+\${dauDiff}</span>\` : \`<span class="neg">\${dauDiff}</span>\`);
      const newDiff = s.new_today - s.new_yesterday;
      const newDiffHtml = newDiff === 0 ? "与昨日持平" : (newDiff > 0 ? \`<span class="pos">+\${newDiff}</span>\` : \`<span class="neg">\${newDiff}</span>\`);
      const d1Pct = s.d1_cohort_7d > 0 ? Math.round((s.d1_retained_7d / s.d1_cohort_7d) * 100) + "%" : "—";
      const stickiness = s.wau_7d > 0 ? Math.round((s.dau_today / s.wau_7d) * 100) + "%" : "—";
      const updated = new Date(d.generated_at * 1000).toLocaleTimeString();

      const sortedBuckets = [...(d.review_buckets || [])].sort((a, b) => {
        const ia = BUCKET_ORDER.indexOf(a.bucket);
        const ib = BUCKET_ORDER.indexOf(b.bucket);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      const featureList = (() => {
        const used = d.features || [];
        if (!state.showZeroFeatures) return used;
        const usedSet = new Set(used.map((x) => x.feature));
        const zeros = Object.keys(FEATURE_NAMES)
          .filter((k) => !usedSet.has(k))
          .map((feature) => ({ feature, installs: 0, uses: 0 }));
        return [...used, ...zeros];
      })();

      const recentFiltered = (d.recent || []).filter((r) => state.recentFilter === "all" || r.event === state.recentFilter);

      app.innerHTML = \`
        <div class="topbar">
          <div class="title"><span class="dot"></span> Anki Studio 实时用户看板</div>
          <div class="controls">
            <div class="seg">
              \${[["today","今天"],["yesterday","昨天"],["7d","近 7 天"],["30d","近 30 天"],["all","90 天全量"]].map(([k, lbl]) =>
                \`<button data-range="\${k}" class="\${state.range === k ? "active" : ""}">\${lbl}</button>\`
              ).join("")}
            </div>
            <button id="export-btn" class="btn">导出 JSON</button>
            <button id="logout-btn" class="btn">退出</button>
          </div>
        </div>

        \${state.error ? \`<div class="banner-err"><span>⚠️ \${esc(state.error)}</span><button id="retry-btn" class="btn xs">重试</button></div>\` : ""}

        <div class="meta">
          <span>更新于 \${esc(updated)}</span>
          <span>时区 UTC\${d.tz_hours >= 0 ? "+" + d.tz_hours : d.tz_hours}</span>
          <span>保留 90 天 · 不含 IP 与卡片内容</span>
        </div>

        <div class="kpis">
          <div class="card">
            <div class="kpi-label">实时活跃（15 分钟）</div>
            <div class="kpi-val">\${s.active_15m}</div>
            <div class="kpi-sub">近 1 小时：\${s.active_1h} 台设备</div>
          </div>
          <div class="card">
            <div class="kpi-label">今日活跃（DAU）</div>
            <div class="kpi-val">\${s.dau_today}</div>
            <div class="kpi-sub">昨日 \${s.dau_yesterday}（\${dauDiffHtml}）</div>
          </div>
          <div class="card">
            <div class="kpi-label">今日新增设备</div>
            <div class="kpi-val" style="color:var(--green)">\${s.new_today}</div>
            <div class="kpi-sub">昨日新增 \${s.new_yesterday}（\${newDiffHtml}）</div>
          </div>
          <div class="card">
            <div class="kpi-label">次日留存（近 7 日新客）</div>
            <div class="kpi-val">\${d1Pct}</div>
            <div class="kpi-sub">\${s.d1_retained_7d}/\${s.d1_cohort_7d} · 粘性 \${stickiness}</div>
          </div>
          <div class="card">
            <div class="kpi-label">深度复习（所选时段）</div>
            <div class="kpi-val">\${s.reviews_in_range}</div>
            <div class="kpi-sub">\${s.reviewers_in_range} 台设备完成复习</div>
          </div>
          <div class="card">
            <div class="kpi-label">90 天累计安装</div>
            <div class="kpi-val">\${s.total_installs}</div>
            <div class="kpi-sub">7日 \${s.wau_7d} / 30日 \${s.mau_30d}</div>
          </div>
        </div>

        <div class="charts-row">
          <div class="card">
            <h3>
              <span>近 \${d.trend_days} 天活跃趋势</span>
              <span class="legend">
                <span class="leg-item"><span class="leg-dot" style="background:var(--green)"></span>新增</span>
                <span class="leg-item"><span class="leg-dot" style="background:var(--accent)"></span>回访</span>
              </span>
            </h3>
            \${renderTrend(d.daily, d.today_start, d.trend_days, d.tz_hours)}
          </div>
          <div class="card">
            <h3><span>24 小时分时段活跃</span><span class="kpi-sub">按事件数 · 适合看作息高峰</span></h3>
            \${renderHourly(d.hourly)}
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h3><span>国家 / 地区分布</span><span class="kpi-sub">独立设备占比</span></h3>
            \${renderBars(d.countries, (x) => fmtCountry(x.country), "installs", (x) => x.events + " 事件")}
          </div>
          <div class="card">
            <h3><span>插件版本分布</span><span class="kpi-sub">新版升级进度</span></h3>
            \${renderBars(d.versions, (x) => "v" + x.version, "installs", (x) => x.events + " 事件")}
          </div>
          <div class="card">
            <h3><span>复习单次刷卡量分布</span><span class="kpi-sub">复习会话</span></h3>
            \${renderBars(sortedBuckets, (x) => x.bucket + " 张", "sessions", (x) => x.installs + " 人", "green")}
          </div>
          <div class="card">
            <h3>
              <span>功能热度排行</span>
              <span style="display:inline-flex;align-items:center;gap:8px;">
                <span class="kpi-sub">使用次数</span>
                <button id="toggle-zero-feat" class="btn xs">\${state.showZeroFeatures ? "隐藏 0 次" : "展开全部"}</button>
              </span>
            </h3>
            <div style="max-height:360px;overflow-y:auto;padding-right:2px;">
              \${renderBars(featureList, (x) => fmtFeature(x.feature), "uses", (x) => x.installs + " 人")}
            </div>
          </div>
          <div class="card">
            <h3><span>操作系统 & Anki 本体版本</span><span class="kpi-sub">独立设备</span></h3>
            \${renderBars(d.oses, (x) => fmtOs(x.os))}
            <div style="height:12px;border-top:1px solid var(--border);margin:12px 0;"></div>
            \${renderBars(d.anki_versions, (x) => "Anki " + x.anki_version)}
          </div>
          <div class="card">
            <h3><span>界面语言 & 时区偏移</span><span class="kpi-sub">独立设备</span></h3>
            \${renderBars(d.locales, (x) => fmtLocale(x.locale))}
            <div style="height:12px;border-top:1px solid var(--border);margin:12px 0;"></div>
            \${renderBars(d.timezones, (x) => fmtTz(x.tz_offset))}
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <h3>
            <span>最近 30 条实时上报</span>
            <span class="seg">
              \${[["all","全部"],["app_open","启动"],["daily_active","日活"],["review_session","复习"],["feature_use","功能"]].map(([k, lbl]) =>
                \`<button data-ev="\${k}" class="\${state.recentFilter === k ? "active" : ""}">\${lbl}</button>\`
              ).join("")}
            </span>
          </h3>
          <div class="table-scroll">
            <table>
              <thead>
                <tr><th>时间</th><th>设备</th><th>事件</th><th>插件版本</th><th>系统 / Anki</th><th>语言</th><th>地区 / 时区</th><th>机房</th><th>附加</th></tr>
              </thead>
              <tbody>
                \${recentFiltered.length ? recentFiltered.map((r) => \`<tr>
                  <td>\${esc(fmtRel(r.ts))}</td>
                  <td><code>\${esc(r.id_prefix)}</code></td>
                  <td><span class="pill \${r.event === "review_session" ? "green" : ""}">\${esc(fmtEvent(r.event))}</span></td>
                  <td>\${esc(r.version ? "v" + r.version : "-")}</td>
                  <td>\${esc(fmtOs(r.os))}\${r.anki_version ? " · " + esc(r.anki_version) : ""}</td>
                  <td>\${esc(fmtLocale(r.locale))}</td>
                  <td>\${esc(fmtCountry(r.country))} (\${esc(fmtTz(r.tz_offset))})</td>
                  <td>\${esc(r.colo || "-")}</td>
                  <td><code>\${esc(fmtProps(r.props))}</code></td>
                </tr>\`).join("") : '<tr><td colspan="9" class="empty">当前筛选条件下暂无记录</td></tr>'}
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
      document.querySelectorAll("[data-ev]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.recentFilter = btn.getAttribute("data-ev");
          renderDashboard();
        });
      });
      const toggleZeroBtn = document.getElementById("toggle-zero-feat");
      if (toggleZeroBtn) {
        toggleZeroBtn.addEventListener("click", () => {
          state.showZeroFeatures = !state.showZeroFeatures;
          renderDashboard();
        });
      }
      const retryBtn = document.getElementById("retry-btn");
      if (retryBtn) retryBtn.addEventListener("click", () => loadStats());
      document.getElementById("export-btn").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "anki-studio-stats-" + formatDayKey(d.generated_at, d.tz_hours) + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
      document.getElementById("logout-btn").addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        state.token = "";
        state.data = null;
        renderAuth();
      });
    }

    async function loadStats() {
      if (!state.token) { renderAuth(); return; }
      try {
        const tz = Math.round(-new Date().getTimezoneOffset() / 60);
        const params = new URLSearchParams({ range: state.range, tz: String(tz) });
        const res = await fetch("/v1/stats?" + params.toString(), {
          headers: { Authorization: "Bearer " + state.token },
        });
        if (res.status === 401) {
          localStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY);
          state.token = "";
          state.data = null;
          state.error = "密钥错误，请重新输入";
          renderAuth();
          return;
        }
        const rawText = await res.text();
        let payload = null;
        try {
          payload = JSON.parse(rawText);
        } catch {
          state.error = "服务端暂时繁忙（HTTP " + res.status + "），请稍后点击重试";
          if (state.data) renderDashboard();
          else renderAuth();
          return;
        }
        if (!res.ok) {
          state.error = (payload && (payload.message || payload.error)) || ("请求失败: HTTP " + res.status);
          if (state.data) renderDashboard();
          else renderAuth();
          return;
        }
        state.error = "";
        state.data = payload;
        renderDashboard();
      } catch (err) {
        state.error = "网络请求失败：" + (err && err.message ? err.message : String(err));
        if (state.data) renderDashboard();
        else renderAuth();
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
    const serverNow = Math.trunc(Date.now() / 1000);
    const incoming = Array.isArray(body && body.events) ? body.events.slice(0, MAX_EVENTS) : [];
    const rows = incoming.map((ev) => sanitize(ev, serverNow)).filter(Boolean);
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
