/**
 * Anki Studio — minimal anonymous analytics endpoint (Cloudflare Worker + D1).
 *
 * POST /v1/events  { schema: 1, events: [ { event, ts, install_id, version, os, anki_version, locale, props? } ] }
 *
 * Privacy: validates and stores only the allowlisted fields below. No IP is
 * written to D1. Rows older than 90 days are removed by the cron trigger.
 */

const ALLOWED_EVENTS = new Set(["app_open", "daily_active", "review_session", "feature_use"]);
const MAX_EVENTS = 100;
const RETENTION_DAYS = 90;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function str(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== "POST" || url.pathname !== "/v1/events") {
      return json({ error: "not found" }, 404);
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
