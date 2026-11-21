/**
 * Behaviour tests for the analytics Worker (scripts/analytics-worker/worker.js).
 *
 * Run: node tests/test_analytics_worker.mjs
 *
 * The Worker is an ES module but lives in a package without "type": "module",
 * so it is loaded through a data: URL instead of a direct import. No network,
 * no Cloudflare credentials and no D1 are involved — only the request gating
 * and the (mocked) batch call are asserted.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(root, "scripts/analytics-worker/worker.js"), "utf8");
const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`)).default;

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function makeEnv(extra = {}) {
  const batches = [];
  return {
    batches,
    ...extra,
    DB: {
      prepare: (sql) => ({ bind: (...args) => ({ sql, args }) }),
      batch: async (stmts) => {
        batches.push(stmts);
        if (typeof extra.onBatch === "function") {
          return extra.onBatch(stmts);
        }
        return stmts;
      },
    },
  };
}

const validEvent = () => ({
  event: "app_open",
  ts: Math.floor(Date.now() / 1000),
  install_id: "0123456789abcdef0123456789abcdef",
  version: "1.5.5",
  os: "darwin",
  anki_version: "26.9.4",
  locale: "zh-CN",
});

function makeRequest(method, pathname, ua, body) {
  const headers = { "content-type": "application/json" };
  if (ua !== null) headers["user-agent"] = ua;
  return new Request(`https://example.workers.dev${pathname}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? { schema: 1, events: [] }) : undefined,
  });
}

async function call(method, pathname, ua, body) {
  const env = makeEnv();
  const response = await worker.fetch(makeRequest(method, pathname, ua, body), env);
  const payload = await response.json();
  return { status: response.status, payload, writes: env.batches.length };
}

const EVENTS_PATH = "/v1/events";
const good = { schema: 1, events: [validEvent()] };

// 1. Legitimate client — current and older add-on versions.
const current = await call("POST", EVENTS_PATH, "AnkiStudio/1.5.5", good);
check("合法客户端 UA 放行", current.status === 200, `status=${current.status}`);
check("合法请求写入 1 条", current.payload.stored === 1 && current.writes === 1, JSON.stringify(current.payload));

const legacy = await call("POST", EVENTS_PATH, "AnkiStudio/1.4.33", {
  schema: 1,
  events: [{ ...validEvent(), version: "1.4.33" }],
});
check("已装旧版客户端兼容", legacy.status === 200 && legacy.payload.stored === 1, `status=${legacy.status}`);

// 2. Everything else is rejected before the body is parsed or D1 is touched.
const rejected = [
  ["无 UA", null],
  ["curl", "curl/8.7.1"],
  ["python-requests", "python-requests/2.31.0"],
  ["Go 扫描器", "Go-http-client/1.1"],
  ["浏览器跨站请求", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"],
  ["空版本号", "AnkiStudio/"],
  ["前缀伪装", "XAnkiStudio/1.5.5"],
  ["超长 UA", `AnkiStudio/${"9".repeat(200)}`],
];
for (const [name, ua] of rejected) {
  const result = await call("POST", EVENTS_PATH, ua, good);
  check(`拒绝 ${name}`, result.status === 403 && result.writes === 0, `status=${result.status}, writes=${result.writes}`);
}

// 3. The allowlist does not relax the existing event validation.
const badInstall = await call("POST", EVENTS_PATH, "AnkiStudio/1.5.5", {
  schema: 1,
  events: [{ ...validEvent(), install_id: "fake" }],
});
check("合法 UA 下无效 install_id 仍不入库", badInstall.status === 200 && badInstall.payload.stored === 0 && badInstall.writes === 0, JSON.stringify(badInstall.payload));

// 4. Unrelated methods keep their original behaviour (preflight must not break).
const options = await worker.fetch(makeRequest("OPTIONS", EVENTS_PATH, null), makeEnv());
check("OPTIONS 预检不受 UA 限制", options.status === 200);
const get = await call("GET", EVENTS_PATH, "curl/8.7.1");
check("GET 仍返回 404", get.status === 404, `status=${get.status}`);

// 5. Real-time dashboard HTML & protected /v1/stats endpoint.
const dashEnv = makeEnv();
const dashRes = await worker.fetch(new Request("https://example.workers.dev/dashboard"), dashEnv);
const dashHtml = await dashRes.text();
check("/dashboard 返回 200 HTML 且不触达 D1", dashRes.status === 200 && dashRes.headers.get("content-type")?.includes("text/html") && dashEnv.batches.length === 0);
const scriptMatch = dashHtml.match(/<script>([\s\S]*?)<\/script>/);
let scriptSyntaxOk = false;
if (scriptMatch) {
  try {
    new vm.Script(scriptMatch[1]);
    scriptSyntaxOk = true;
  } catch (err) {
    console.error("Dashboard script syntax error:", err);
  }
}
check("/dashboard 内嵌脚本语法有效", scriptSyntaxOk);

const unconfiguredEnv = makeEnv();
const unconfiguredRes = await worker.fetch(new Request("https://example.workers.dev/v1/stats"), unconfiguredEnv);
check("未配置 DASHBOARD_TOKEN 时 /v1/stats 返回 503 且不查 D1", unconfiguredRes.status === 503 && unconfiguredEnv.batches.length === 0);

const unauthorizedEnv = makeEnv({ DASHBOARD_TOKEN: "secret-123" });
const noTokenRes = await worker.fetch(new Request("https://example.workers.dev/v1/stats"), unauthorizedEnv);
const badTokenRes = await worker.fetch(
  new Request("https://example.workers.dev/v1/stats", { headers: { Authorization: "Bearer wrong" } }),
  unauthorizedEnv
);
check("缺密钥或错密钥访问 /v1/stats 返回 401 且不查 D1", noTokenRes.status === 401 && badTokenRes.status === 401 && unauthorizedEnv.batches.length === 0);

const nowTs = Math.trunc(Date.now() / 1000);
const statsEnv = makeEnv({
  DASHBOARD_TOKEN: "secret-123",
  onBatch: () => [
    {
      results: [
        {
          ts: nowTs - 60,
          install_id: "11111111111111111111111111111111",
          event: "review_session",
          version: "1.6.13",
          os: "darwin",
          anki_version: "26.9.4",
          locale: "zh-CN",
          tz_offset: 8,
          country: "CN",
          colo: "HKG",
          props: JSON.stringify({ cards_bucket: "21-50" }),
        },
        {
          ts: nowTs - 86400,
          install_id: "11111111111111111111111111111111",
          event: "app_open",
          version: "1.6.13",
          os: "darwin",
          anki_version: "26.9.4",
          locale: "zh-CN",
          tz_offset: 8,
          country: "CN",
          colo: "HKG",
          props: null,
        },
        {
          ts: nowTs - 120,
          install_id: "22222222222222222222222222222222",
          event: "app_open",
          version: "1.6.13",
          os: "windows",
          anki_version: "26.9.4",
          locale: "zh-CN",
          tz_offset: 8,
          country: "CN",
          colo: "SIN",
          props: null,
        },
        {
          ts: nowTs - 30,
          install_id: "d31d6419111111111111111111111111",
          event: "app_open",
          version: "1.6.13",
          os: "darwin",
          anki_version: "26.9.4",
          locale: "zh-CN",
          tz_offset: 8,
          country: "US",
          colo: "SJC",
          props: null,
        },
      ],
    },
  ],
});
const okStatsRes = await worker.fetch(
  new Request("https://example.workers.dev/v1/stats?range=7d&tz=8&fresh=1&exclude=D31D6419,bad!,abcd1234", {
    headers: { Authorization: "Bearer secret-123" },
  }),
  statsEnv
);
const okStats = await okStatsRes.json();
check(
  "合法密钥访问 /v1/stats 单次查询在内存聚合并返回完整汇总字段",
  okStatsRes.status === 200 &&
    okStats.summary?.active_15m === 2 &&
    okStats.summary?.dau_today === 2 &&
    okStats.summary?.new_today === 1 &&
    okStats.summary?.d1_cohort_7d === 1 &&
    okStats.summary?.d1_retained_7d === 1 &&
    okStats.summary?.reviews_in_range === 1 &&
    okStats.countries?.[0]?.country === "CN" &&
    okStats.anki_versions?.[0]?.anki_version === "26.9.4" &&
    okStats.review_buckets?.[0]?.bucket === "21-50" &&
    JSON.stringify(okStats.excluded) === JSON.stringify(["d31d6419", "abcd1234"]) &&
    statsEnv.batches.length === 1 &&
    statsEnv.batches[0].length === 1,
  JSON.stringify(okStats)
);

// Cached second call within 60s should not hit D1 again.
const cachedRes = await worker.fetch(
  new Request("https://example.workers.dev/v1/stats?range=today&tz=8", {
    headers: { Authorization: "Bearer secret-123" },
  }),
  statsEnv
);
check("60 秒内切换时间范围命中内存缓存，不重复查询 D1", cachedRes.status === 200 && statsEnv.batches.length === 1);

const failingD1Env = makeEnv({
  DASHBOARD_TOKEN: "secret-123",
  onBatch: () => {
    throw new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit.");
  },
});
const d1ErrRes = await worker.fetch(
  new Request("https://example.workers.dev/v1/stats?range=7d&tz=8&fresh=1", {
    headers: { Authorization: "Bearer secret-123" },
  }),
  failingD1Env
);
const d1ErrJson = await d1ErrRes.json();
check(
  "D1 超日读限额时返回 JSON 503 清晰提示而非 HTML 500",
  d1ErrRes.status === 503 && d1ErrJson.error === "d1_daily_quota_exceeded",
  `status=${d1ErrRes.status}, body=${JSON.stringify(d1ErrJson)}`
);

// 6. Client timestamp drift clamping (ts=0 or far future is clamped to server time).
const clampEnv = makeEnv();
const clampRes = await worker.fetch(
  makeRequest("POST", EVENTS_PATH, "AnkiStudio/1.5.9", {
    schema: 1,
    events: [{ ...validEvent(), ts: 0 }],
  }),
  clampEnv
);
const clampedTs = clampEnv.batches[0]?.[0]?.args?.[0];
const nowSec = Math.trunc(Date.now() / 1000);
check(
  "异常客户端时间戳 ts=0 自动回落到服务器当前时间",
  clampRes.status === 200 && Math.abs(clampedTs - nowSec) <= 5,
  `clampedTs=${clampedTs}, now=${nowSec}`
);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
