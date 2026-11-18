#!/usr/bin/env node
// Standardized test-evidence block generator.
//
// Why this exists: final reports transcribe pass/fail/skip counts by hand from
// the line reporter, and hand-transcription drifts — a full-suite run on one
// tree has been reported as "356 passed" when the reproducible result was
// "355 passed + 1 skipped", because an unconditional test.skip was never
// counted. This script makes the evidence machine-generated instead:
// playwright's json reporter (written to a temp file via
// PLAYWRIGHT_JSON_OUTPUT_FILE so test console.log noise cannot corrupt the
// payload) -> per-project aggregation -> one markdown block a report can quote
// verbatim.
//
// What it captures:
//   - per-project passed/failed/skipped/flaky counts
//   - skipped AND failed spec titles (identity, not just counts)
//   - git HEAD (+ dirty-tree marker), timestamp, duration
//   - per-project headed state (read from playwright.config.ts text)
//
// Usage: node scripts/test-evidence.mjs [-- <playwright args>]
//   e.g. node scripts/test-evidence.mjs -- --project=firefox-extension
//        node scripts/test-evidence.mjs -- test/tests/boxing-focus-steal.spec.ts
// Output: test-results/evidence-<utc-ts>.md (test-results/ is gitignored; quote
// the block text into reports, do not commit the file). Exit code mirrors the
// playwright run (non-zero on failures) so it can gate scripts.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hardStaleCapMs } from "./test-mutex.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NL = String.fromCharCode(10);
const CONFIG_REL = "test/playwright.config.ts";
// A run that outlives its own lock can have the lock reclaimed under it. The
// cap comes from test-mutex itself (env vars included), so the check below
// cannot drift from the lock's real behaviour.
const LOCK_CAP_MS = hardStaleCapMs();
const envTimeout = Number(process.env.EVIDENCE_TIMEOUT_MS);
if (Number.isFinite(envTimeout) && envTimeout > 0 && envTimeout < 60 * 1000) {
  console.error("[test-evidence] EVIDENCE_TIMEOUT_MS is in milliseconds; " + envTimeout +
    "ms is under a minute. Did you mean minutes? Refusing to run.");
  process.exit(2);
}
const RUN_TIMEOUT_MS = Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 180 * 60 * 1000;
// In CI test-mutex bypasses the lock entirely, so the cap only applies to
// local runs (which pass --no-wait above and therefore queue for nothing).
if (!process.env.CI && RUN_TIMEOUT_MS > LOCK_CAP_MS) {
  console.error("[test-evidence] EVIDENCE_TIMEOUT_MS (" + Math.round(RUN_TIMEOUT_MS / 60000) +
    " min) is longer than test-mutex's lock cap (" + Math.round(LOCK_CAP_MS / 60000) +
    " min); a long run would lose its lock mid-suite.");
  console.error("[test-evidence] lower EVIDENCE_TIMEOUT_MS or raise TEST_MUTEX_HARD_STALE_MS.");
  process.exit(2);
}
// After the run ends, wait this long for the half-written JSON report to parse.
const REPORT_READ_TIMEOUT_MS = 10000;

function sh(cmd, args, opts) {
  const o = opts || {};
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: o.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    env: o.env,
    // A full two-project run takes about an hour on a busy desktop. Cutting it
    // off earlier leaves Playwright mid-write, so the report looks missing even
    // when the suite was fine. Raise it with EVIDENCE_TIMEOUT_MS.
    timeout: o.timeout || RUN_TIMEOUT_MS,
  });
  return r;
}

// spawnSync stops only the process it started: here that is test-mutex, whose
// child is Playwright, whose children are browsers. Once spawnSync returns
// from a timeout the direct child is already gone, so there is no reliable
// handle on the grandchildren (and a bare PID may already have been recycled).
// Do not pretend to clean them up; the caller warns instead.

// A single read can land on a half-written or empty file, and the parse error
// then aborts the script before its own exit code is reported. Retry briefly
// until the payload parses; a genuinely missing report still ends as "missing"
// with the run's exit code preserved.
function readJsonReport(file, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  for (;;) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      // Playwright writes the report in one shot when the run ends. A payload
      // without a suites array is a half-written file, not a finished run;
      // returning it would silently count zero tests, which is worse than
      // failing loudly.
      if (Array.isArray(parsed.suites)) return parsed;
      lastError = new Error("report has no suites array");
    } catch (e) {
      lastError = e;
    }
    if (Date.now() >= deadline) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  if (lastError && lastError.code !== "ENOENT") {
    console.error("[test-evidence] report unreadable: " + lastError.message);
  }
  return null;
}

// Local runs follow the config's fixed worker cap. The old label hardcoded
// "4 (local)" and contradicted the config, which defeats the point of a
// machine-readable block — read the value instead.
function configWorkers() {
  try {
    // Strip // comments first, same as headedStates() below: a commented-out
    // "// workers: 4" must never win.
    const text = fs.readFileSync(path.join(ROOT, CONFIG_REL), "utf8")
      .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    const m = /^\s*workers:\s*(\d+)/m.exec(text);
    return m ? m[1] : null;
  } catch (e) {
    return null;
  }
}

function gitInfo() {
  const head = sh("git", ["rev-parse", "HEAD"]);
  const dirty = sh("git", ["status", "--porcelain"]);
  return {
    head: head.status === 0 ? head.stdout.trim() : "unknown",
    dirty: dirty.status === 0 && dirty.stdout.trim().length > 0,
  };
}

// Per-project headed state: read the config text rather than re-deriving it —
// the config is the source of truth (firefox runs headless).
// `//` comments are stripped first so prose like "// headless: true …" cannot
// false-positive a project; project bodies slice between `name:` marks so a
// missed `}]` terminator can't bleed one project's flags into the next.
function headedStates() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, CONFIG_REL), "utf8");
    const text = raw.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    const out = {};
    // Global `use:` default applies to projects that don't set headless.
    const gm = /^\s*use:\s*\{([\s\S]*?)\n\s*\}/m.exec(text);
    const globalHeadless = gm && /headless:\s*true/.test(gm[1]) ? "headless" : "headed";
    const marks = [];
    const re = /name:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(text)) !== null) marks.push({ proj: m[1], at: m.index + m[0].length });
    for (let i = 0; i < marks.length; i++) {
      const body = text.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : text.length);
      if (/headless:\s*true/.test(body)) out[marks[i].proj] = "headless";
      else if (/headless:\s*false/.test(body)) out[marks[i].proj] = "headed";
      else out[marks[i].proj] = globalHeadless + " (default)";
    }
    return out;
  } catch (e) {
    return {};
  }
}

function walkSpecs(suite, project, acc) {
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const p = t.projectName || project || "unknown";
      const a = (acc[p] = acc[p] || { passed: 0, failed: 0, skipped: 0, flaky: 0, skipNames: [], failNames: [] });
      const statuses = (t.results || []).map((r) => r.status);
      const last = statuses[statuses.length - 1] || "skipped";
      if (t.expectedStatus === "skipped" || last === "skipped") {
        a.skipped++;
        a.skipNames.push(spec.title);
      } else if (statuses.length > 1 && last === "passed") {
        a.flaky++;
      } else if (last === "passed") {
        a.passed++;
      } else {
        a.failed++;
        a.failNames.push(spec.title);
      }
    }
  }
  for (const s of suite.suites || []) walkSpecs(s, project, acc);
  return acc;
}

function main() {
  const sep = process.argv.indexOf("--");
  const extra = sep >= 0 ? process.argv.slice(sep + 1) : process.argv.slice(2);
  const jsonOut = path.join(os.tmpdir(), `boxing-evidence-${Date.now()}.json`);
  const headed = headedStates();
  const git = gitInfo();
  const startedAt = new Date();

  const run = sh("node", ["scripts/test-mutex.mjs", "--no-wait", "playwright", "test", `--config=${CONFIG_REL}`, "--reporter=json", ...extra], {
    inherit: true,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonOut },
  });
  const exitCode = run.status === null ? 1 : run.status;
  // A timeout is not "the report went missing": it means the wrapped run was
  // cut off, and its descendants may still be alive. Say that plainly instead
  // of letting the next run trip over an old Playwright that is still going.
  const timedOut = Boolean(run.error && run.error.code === "ETIMEDOUT");
  if (timedOut) {
    console.error("[test-evidence] the run hit the " + Math.round(RUN_TIMEOUT_MS / 60000) + "-minute limit.");
    console.error("[test-evidence] the wrapped process was stopped, but its Playwright and browser descendants may still be running.");
    console.error("[test-evidence] wait for them to exit (or stop them by hand) before rerunning, or raise EVIDENCE_TIMEOUT_MS.");
    // A timed-out run has no trustworthy verdict. Even a complete-looking
    // report would describe a run that was cut off, so do not emit evidence.
    // 124 is the usual "timed out" code, distinct from a test failure (1).
    process.exit(124);
  }

  // Workers label: reflect a --workers passthrough when present, else the
  // config's own cap. CI no longer hardcodes a number — that is exactly how the
  // old "4 (local)" label drifted away from the config.
  const wIdx = extra.findIndex((a) => a === "--workers" || a.startsWith("--workers="));
  const configuredWorkers = configWorkers();
  const workersLabel = wIdx >= 0
    ? (extra[wIdx].includes("=") ? extra[wIdx].split("=")[1] : extra[wIdx + 1] || "?") + " (arg)"
    : configuredWorkers
      ? configuredWorkers + (process.env.CI ? " (CI)" : " (config)")
      : "?";

  const report = readJsonReport(jsonOut, REPORT_READ_TIMEOUT_MS);
  if (!report) {
    console.error("[test-evidence] playwright json report missing — the run failed before reporting (exit " + exitCode + ")");
    process.exit(exitCode || 1);
  }
  try { fs.unlinkSync(jsonOut); } catch (e) { /* temp cleanup best-effort */ }

  const acc = walkSpecs({ specs: [], suites: report.suites || [] }, null, {});
  const stats = report.stats || {};
  const durationMin = stats.duration ? (stats.duration / 60000).toFixed(1) : "n/a";

  const lines = [];
  lines.push("## Test evidence — " + startedAt.toISOString().slice(0, 16).replace("T", " ") + "Z");
  lines.push("");
  lines.push("| field | value |");
  lines.push("|---|---|");
  lines.push("| git HEAD | `" + git.head + (git.dirty ? " (dirty)" : "") + "` |");
  lines.push("| playwright args | `" + (extra.join(" ") || "(full suite)") + "` |");
  lines.push("| duration | " + durationMin + " min |");
  lines.push("| workers | " + workersLabel + " |");
  lines.push("");
  lines.push("| project | headed | passed | failed | skipped | flaky |");
  lines.push("|---|---|---|---|---|---|");
  for (const proj of Object.keys(acc)) {
    const a = acc[proj];
    lines.push("| " + proj + " | " + (headed[proj] || "?") + " | " + a.passed + " | " + a.failed + " | " + a.skipped + " | " + a.flaky + " |");
  }
  for (const proj of Object.keys(acc)) {
    const a = acc[proj];
    if (a.skipNames.length > 0) {
      lines.push("");
      lines.push("### " + proj + " — skipped (" + a.skipNames.length + ")");
      a.skipNames.forEach((n) => lines.push("- " + n));
    }
    if (a.failNames.length > 0) {
      lines.push("");
      lines.push("### " + proj + " — failed (" + a.failNames.length + ")");
      a.failNames.forEach((n) => lines.push("- " + n));
    }
  }
  const block = lines.join(NL);

  const outDir = path.join(ROOT, "test-results");
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { /* exists */ }
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(outDir, "evidence-" + stamp + ".md");
  fs.writeFileSync(outFile, block + NL, "utf8");

  console.log(NL + block);
  console.log(NL + "[test-evidence] wrote " + path.relative(ROOT, outFile) + " (gitignored; quote the block into reports)");
  process.exit(exitCode);
}

main();
