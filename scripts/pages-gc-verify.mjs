#!/usr/bin/env node
// Boxing - Pages G-C freshness gate + deploy-tail verify (ticket 109 / A-064).
//
// G-C used to mean three URLs answering 200. That cannot see stale-but-200: on
// 2026-09-15 the live site still served version 2026.9.12 while the latest
// release tag was v2026.9.15. The gate now adds the freshness assertion:
//   three URLs 200 AND GET <base>/demo/version.json?<cache-buster> whose
//   version equals the expected one (default: latest release tag).
//
// Modes:
//   gate         (default) one-shot G-C check (release gate / human run)
//   deploy-tail  poll until version.json converges, budget --timeout seconds
//   self-test    offline checks of the pure logic (no network)
//
// Exit: 0 = pass, 1 = gate failed, 2 = usage/config error.
// No dependencies (CRX-R-009): Node >= 18 global fetch.
//
// Failure taxonomy (D-003): MISMATCH = the deploy pipeline never landed the new
// artifact (stale site); UNREACHABLE = liveness/read problem (Pages down,
// cached 404, version.json unreadable).

import assert from "node:assert/strict";

export const GC_PATHS = ["/demo/", "/demo/ntp.css", "/privacy-policy.html"];
export const VERSION_PATH = "/demo/version.json";
export const DEFAULT_BASE_URL = "https://xxx91n.github.io/boxing";
export const DEFAULT_REPO = "Xxx91n/boxing";
export const DEFAULT_TIMEOUT_SEC = 180;

const NO_CACHE_HEADERS = {
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  pragma: "no-cache",
};

export function normalizeVersion(value) {
  let s = String(value == null ? "" : value).trim();
  if (s.length > 1 && (s[0] === "v" || s[0] === "V")) s = s.slice(1);
  return s;
}

export function cacheBust(url, token) {
  const sep = url.indexOf("?") >= 0 ? "&" : "?";
  return url + sep + "_=" + encodeURIComponent(String(token));
}

function stripTrailingSlash(value) {
  let s = String(value == null ? "" : value);
  while (s.length > 1 && s[s.length - 1] === "/") s = s.slice(0, -1);
  return s;
}

export function buildTargets(baseUrl) {
  const base = stripTrailingSlash(baseUrl || DEFAULT_BASE_URL);
  return { versionUrl: base + VERSION_PATH, urls: GC_PATHS.map((p) => base + p) };
}

export function parseVersionPayload(text) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(text));
  } catch {
    throw new Error("version.json is not valid JSON");
  }
  const version = normalizeVersion(parsed && parsed.version);
  if (!version) throw new Error("version.json has no usable version field");
  return {
    version,
    deployedAt: parsed && parsed.deployedAt ? String(parsed.deployedAt) : null,
    raw: parsed,
  };
}

export function classifyFailure({ urlsOk, reachable, version, expected }) {
  if (!urlsOk || !reachable) return "UNREACHABLE";
  if (expected && normalizeVersion(version) !== normalizeVersion(expected)) return "MISMATCH";
  return null;
}

export function backoffDelays(budgetMs, baseMs = 5000, maxMs = 30000) {
  const delays = [];
  let total = 0;
  let d = baseMs;
  while (total + d <= budgetMs) {
    delays.push(d);
    total += d;
    d = Math.min(maxMs, Math.round(d * 1.6));
  }
  return delays;
}

async function fetchNoCache(url, fetchImpl, token) {
  const fresh = token == null ? Date.now() + "-" + Math.random().toString(36).slice(2, 8) : token;
  return fetchImpl(cacheBust(url, fresh), {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
    redirect: "follow",
  });
}

export async function runGate(options) {
  const opts = options || {};
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const now = opts.now || (() => Date.now());
  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  const expected = opts.expected ? normalizeVersion(opts.expected) : null;
  const started = now();
  const { versionUrl, urls } = buildTargets(baseUrl);

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetchNoCache(url, fetchImpl, opts.token);
        return { url, status: res.status, ok: res.ok };
      } catch (error) {
        return { url, status: 0, ok: false, error: String(error && error.message ? error.message : error) };
      }
    }),
  );

  let version = null;
  let versionError = null;
  try {
    const res = await fetchNoCache(versionUrl, fetchImpl, opts.token);
    if (!res.ok) throw new Error("HTTP " + res.status + " on " + VERSION_PATH);
    version = parseVersionPayload(await res.text());
  } catch (error) {
    versionError = String(error && error.message ? error.message : error);
  }

  const urlsOk = results.every((r) => r.ok);
  const failure = classifyFailure({
    urlsOk,
    reachable: !versionError,
    version: version ? version.version : null,
    expected,
  });

  return {
    mode: "gate",
    baseUrl: stripTrailingSlash(baseUrl),
    expected,
    urls: results,
    version,
    versionError,
    ok: failure === null,
    failure,
    elapsedMs: now() - started,
  };
}

export async function runDeployTail(options) {
  const opts = options || {};
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const now = opts.now || (() => Date.now());
  const sleep = opts.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timeoutSec = opts.timeoutSec == null ? DEFAULT_TIMEOUT_SEC : opts.timeoutSec;
  const expected = normalizeVersion(opts.expected || "");
  if (!expected) throw new Error("deploy-tail requires an expected version (--expected or EXPECTED_VERSION)");
  const budgetMs = timeoutSec * 1000;
  const started = now();
  const attempts = [];
  let last = null;

  for (;;) {
    last = await runGate({ baseUrl: opts.baseUrl, expected, fetchImpl, now, token: opts.token });
    const elapsedMs = now() - started;
    attempts.push({
      attempt: attempts.length + 1,
      elapsedMs,
      version: last.version ? last.version.version : null,
      failure: last.failure,
    });
    if (last.ok) {
      return { mode: "deploy-tail", ok: true, converged: true, expected, attempts, last, elapsedMs, budgetMs };
    }
    const remaining = budgetMs - elapsedMs;
    if (remaining <= 0) {
      return { mode: "deploy-tail", ok: false, converged: false, expected, attempts, last, elapsedMs, budgetMs };
    }
    const delays = backoffDelays(remaining, 5000, 30000);
    await sleep(delays.length ? delays[0] : Math.min(1000, remaining));
  }
}

export async function fetchLatestReleaseTag(options) {
  const opts = options || {};
  const repo = opts.repo || DEFAULT_REPO;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const headers = Object.assign(
    {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "boxing-pages-gc-verify",
    },
    NO_CACHE_HEADERS,
  );
  const authToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (authToken) headers.authorization = "Bearer " + authToken;
  const res = await fetchImpl("https://api.github.com/repos/" + repo + "/releases/latest", {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("GitHub API returned HTTP " + res.status);
  const payload = await res.json();
  const tag = normalizeVersion(payload && payload.tag_name);
  if (!tag) throw new Error("GitHub API response has no tag_name");
  return tag;
}

// -- self-test (offline; no network, no workspace mutation) -------------------
function stubFetch(handler) {
  return async (url) => {
    const parsed = new URL(url);
    const out = await handler(parsed.pathname, parsed.searchParams.get("_"));
    return {
      ok: out.status >= 200 && out.status < 300,
      status: out.status,
      text: async () => (out.body == null ? "" : out.body),
      json: async () => JSON.parse(out.body),
    };
  };
}

function versionBody(version, deployedAt) {
  return JSON.stringify({
    version,
    deployedAt: deployedAt || "2026-09-15T00:00:00.000Z",
    source: "release",
  });
}

function liveSite(version, overrides) {
  const extra = overrides || {};
  return stubFetch((pathname, buster) => {
    if (pathname.endsWith("/demo/version.json")) {
      if (!buster) throw new Error("version.json probe carried no cache-buster");
      return { status: 200, body: versionBody(version) };
    }
    for (const key of Object.keys(extra)) {
      if (pathname.endsWith(key)) return { status: extra[key], body: "ok" };
    }
    return { status: 200, body: "ok" };
  });
}

export function selfTest() {
  const checks = [];
  const record = (name, fn) => {
    fn();
    checks.push(name);
  };

  record("normalizeVersion strips a leading v", () => {
    assert.equal(normalizeVersion("v2026.9.15"), "2026.9.15");
    assert.equal(normalizeVersion("2026.9.15"), "2026.9.15");
    assert.equal(normalizeVersion("   "), "");
  });
  record("cacheBust appends a fresh token", () => {
    assert.equal(cacheBust("https://x.test/demo/version.json", "t1"), "https://x.test/demo/version.json?_=t1");
    assert.equal(cacheBust("https://x.test/a?b=1", "t2"), "https://x.test/a?b=1&_=t2");
  });
  record("buildTargets derives the four probe URLs", () => {
    const t = buildTargets("https://x.test/boxing/");
    assert.equal(t.versionUrl, "https://x.test/boxing/demo/version.json");
    assert.equal(t.urls.length, 3);
    assert.equal(t.urls[0], "https://x.test/boxing/demo/");
  });
  record("parseVersionPayload requires a version field", () => {
    assert.equal(parseVersionPayload(versionBody("v2026.9.15")).version, "2026.9.15");
    assert.throws(() => parseVersionPayload("{oops"), /not valid JSON/);
    assert.throws(() => parseVersionPayload("{}"), /no usable version/);
  });
  record("classifyFailure splits stale from unreachable", () => {
    assert.equal(classifyFailure({ urlsOk: true, reachable: true, version: "2026.9.12", expected: "2026.9.15" }), "MISMATCH");
    assert.equal(classifyFailure({ urlsOk: true, reachable: false, version: null, expected: "2026.9.15" }), "UNREACHABLE");
    assert.equal(classifyFailure({ urlsOk: false, reachable: true, version: "2026.9.15", expected: "2026.9.15" }), "UNREACHABLE");
    assert.equal(classifyFailure({ urlsOk: true, reachable: true, version: "2026.9.15", expected: "2026.9.15" }), null);
  });
  record("backoffDelays stays inside the budget", () => {
    const delays = backoffDelays(180000);
    const total = delays.reduce((a, b) => a + b, 0);
    assert.ok(total <= 180000, "backoff total exceeds the 180s budget");
    assert.ok(delays.length >= 8, "backoff schedule too short to be useful");
    assert.equal(backoffDelays(1000).length, 0);
  });
  return checks;
}

export async function selfTestAsync() {
  const checks = selfTest();
  const clock = (stepMs) => {
    let t = -stepMs;
    return () => (t += stepMs);
  };

  const pass = await runGate({
    baseUrl: "https://x.test/boxing",
    expected: "v2026.9.15",
    fetchImpl: liveSite("2026.9.15"),
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.failure, null);
  checks.push("gate passes when the live version matches the expected tag");

  const stale = await runGate({
    baseUrl: "https://x.test/boxing",
    expected: "v2026.9.15",
    fetchImpl: liveSite("2026.9.12"),
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.failure, "MISMATCH");
  assert.equal(stale.urls.every((u) => u.ok), true);
  checks.push("gate fails with MISMATCH when Pages serves a stale version that still answers 200");

  const down = await runGate({
    baseUrl: "https://x.test/boxing",
    expected: "v2026.9.15",
    fetchImpl: liveSite("2026.9.15", { "/demo/": 500 }),
  });
  assert.equal(down.ok, false);
  assert.equal(down.failure, "UNREACHABLE");
  checks.push("gate fails with UNREACHABLE when a G-C URL is down");

  const missing = await runGate({
    baseUrl: "https://x.test/boxing",
    expected: "v2026.9.15",
    fetchImpl: stubFetch(() => ({ status: 404, body: "nope" })),
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.failure, "UNREACHABLE");
  checks.push("gate fails with UNREACHABLE when version.json cannot be read");

  let calls = 0;
  const flaky = stubFetch((pathname) => {
    if (pathname.endsWith("/demo/version.json")) {
      calls += 1;
      return { status: 200, body: versionBody(calls >= 3 ? "2026.9.15" : "2026.9.12") };
    }
    return { status: 200, body: "ok" };
  });
  const tail = await runDeployTail({
    baseUrl: "https://x.test/boxing",
    expected: "v2026.9.15",
    timeoutSec: 180,
    fetchImpl: flaky,
    sleep: async () => {},
    now: clock(1000),
  });
  assert.equal(tail.ok, true);
  assert.equal(tail.converged, true);
  assert.ok(tail.attempts.length >= 3, "deploy-tail should keep polling until convergence");
  checks.push("deploy-tail converges once the deployed version catches up");

  const never = await runDeployTail({
    baseUrl: "https://x.test/boxing",
    expected: "v2026.9.15",
    timeoutSec: 180,
    fetchImpl: liveSite("2026.9.12"),
    sleep: async () => {},
    now: clock(60000),
  });
  assert.equal(never.ok, false);
  assert.equal(never.converged, false);
  assert.equal(never.last.failure, "MISMATCH");
  assert.ok(never.elapsedMs <= never.budgetMs + 1, "deploy-tail overran its budget");
  checks.push("deploy-tail gives up inside the 180s budget and reports MISMATCH");

  const noExpected = await runDeployTail({
    baseUrl: "https://x.test/boxing",
    fetchImpl: liveSite("2026.9.15"),
  }).catch((e) => e);
  assert.ok(noExpected instanceof Error, "deploy-tail must reject a missing expected version");
  checks.push("deploy-tail refuses to run without an expected version");

  return checks;
}

// -- CLI ----------------------------------------------------------------------
const FAILURE_HINT = {
  MISMATCH: "stale site: the deploy pipeline never landed this version (rerun demo-deploy, check github-pages environment tag rules)",
  UNREACHABLE: "liveness/read problem: Pages down, cached 404, or version.json unreadable",
};

function parseArgs(argv) {
  const out = { mode: "gate", json: false };
  for (const arg of argv) {
    if (arg === "--json") {
      out.json = true;
      continue;
    }
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (!m) {
      out.error = "unrecognised argument: " + arg;
      continue;
    }
    out[m[1]] = m[2];
  }
  return out;
}

function emit(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const last = result.mode === "deploy-tail" ? result.last : result;
  for (const u of last.urls) {
    console.log((u.ok ? "ok  " : "BAD ") + u.status + "  " + u.url);
  }
  const v = last.version;
  console.log(
    (v ? "ok  " : "BAD ") +
      "version.json  version=" +
      (v ? v.version : "unreadable") +
      "  deployedAt=" +
      (v && v.deployedAt ? v.deployedAt : "none") +
      (last.versionError ? "  error=" + last.versionError : ""),
  );
  if (result.mode === "deploy-tail") {
    console.log(
      (result.converged ? "CONVERGED" : "NOT CONVERGED") +
        "  expected=" +
        result.expected +
        "  final=" +
        (result.last.version ? result.last.version.version : "none") +
        "  elapsed=" +
        (result.elapsedMs / 1000).toFixed(1) +
        "s  budget=" +
        result.budgetMs / 1000 +
        "s  attempts=" +
        result.attempts.length,
    );
  }
  console.log(
    (result.ok ? "G-C PASS" : "G-C FAIL " + (last.failure || "")) +
      "  expected=" +
      (last.expected || "?"),
  );
  if (!result.ok && last.failure) console.log("hint: " + FAILURE_HINT[last.failure]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error("FATAL: " + args.error);
    return 2;
  }
  const mode = args.mode || "gate";

  if (mode === "self-test") {
    const checks = await selfTestAsync();
    for (const c of checks) console.log("ok  - " + c);
    console.log("\nself-test: " + checks.length + " checks passed");
    return 0;
  }

  const baseUrl = args["base-url"] || DEFAULT_BASE_URL;
  const timeoutSec = Number(args.timeout == null ? DEFAULT_TIMEOUT_SEC : args.timeout);
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
    console.error("FATAL: --timeout must be a positive number of seconds");
    return 2;
  }

  if (mode === "deploy-tail") {
    const expected = args.expected || process.env.EXPECTED_VERSION || "";
    if (!normalizeVersion(expected)) {
      console.error("FATAL: deploy-tail needs --expected=<version> or EXPECTED_VERSION");
      return 2;
    }
    const result = await runDeployTail({ baseUrl, expected, timeoutSec });
    emit(result, args.json);
    return result.ok ? 0 : 1;
  }

  if (mode !== "gate") {
    console.error("FATAL: unknown mode " + mode);
    return 2;
  }

  let expected = normalizeVersion(args.expected || process.env.EXPECTED_VERSION || "");
  if (!expected) {
    try {
      expected = await fetchLatestReleaseTag({ repo: args.repo });
    } catch (error) {
      console.error("FATAL: cannot resolve the latest release tag: " + String(error && error.message ? error.message : error));
      return 2;
    }
  }
  const result = await runGate({ baseUrl, expected });
  emit(result, args.json);
  return result.ok ? 0 : 1;
}

process.exit(await main());
