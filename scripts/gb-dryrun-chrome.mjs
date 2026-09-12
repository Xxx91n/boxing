/**
 * G-B dry-run pre-check - Chromium lane (ticket 76, Wave8).
 *
 * WHAT THIS IS: a mechanical rehearsal harness that drives the REAL packaged unpacked
 * product in a real extension origin (so chrome.storage.local is the real storage API).
 * It proves the execution-card steps are reproducible before a human spends an evening.
 *
 * WHAT THIS IS NOT: NOT G-B evidence. A-009 (decision-ledger) + ADR-0017 require G-B to be
 * executed by a human on real Chrome AND Firefox. A green run here must never be reported
 * as "G-B passed". Output lands in a dry-run/ dir separate from the G-B evidence dir.
 *
 * IN SCOPE: product load, extension-origin + facade assertions, console-error capture,
 *   onboarding walk-through, create/persist/reload round-trip (G2-shaped), storage dumps,
 *   legacy-v2 single-trip normalization (G5b, ADR-0017 named item).
 * OUT OF SCOPE: G3 (real backup from previous release), G4 (upgrade install from
 *   v2026.9.11 + pre-update snapshot), G6 (named human sign-off), the whole Firefox lane
 *   (Playwright cannot load an unpacked extension without signing), service-worker console.
 *
 * Usage: node scripts/gb-dryrun-chrome.mjs [--ext=<unpacked-dir>] [--out=<dir>]
 * Needs: npm install (playwright + chromium). No build, no signing, no release triggered.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function arg(name, dflt) {
  const prefix = "--" + name + "=";
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : dflt;
}

const EXT = arg("ext", "D:/rel-2026.9.12/chrome");
const OUT = arg("out", path.join(REPO_ROOT, ".scratch/architecture-recovery/dry-run/76-gb-chromium"));
const FIXTURE = path.join(REPO_ROOT, "test/fixtures/schema/legacy-v2.json");

const results = [];
function rec(id, ok, detail) {
  results.push({ id: id, ok: Boolean(ok), detail: String(detail) });
  console.log((ok ? "PASS  " : "FAIL  ") + id + "  " + detail);
}

const waitFacade = (page) => page.waitForFunction(() => Boolean(window.__boxingDebug), null, { timeout: 30000 });

async function run() {
  fs.mkdirSync(OUT, { recursive: true });

  // P0: artifact identity read from disk, not from the browser.
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
  rec("P0-manifest", manifest.version === "2026.9.12" && manifest.manifest_version === 3,
    "version=" + manifest.version + " manifest_version=" + manifest.manifest_version);
  rec("P0-zero-flash-in-package", fs.existsSync(path.join(EXT, "ntp/boot-theme.js")),
    "ntp/boot-theme.js present in the unpacked candidate");
  rec("P0-not-repo-root", !fs.existsSync(path.join(EXT, ".git")),
    "target is an unpacked artifact, not the repo working tree");

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gb-dryrun-"));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      "--load-extension=" + EXT,
      "--disable-extensions-except=" + EXT,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const errors = [];
  const page = ctx.pages().find((x) => x.url() !== "about:blank") || (await ctx.newPage());
  page.on("console", (m) => { if (m.type() === "error") errors.push("[console] " + m.text()); });
  page.on("pageerror", (e) => errors.push("[pageerror] " + e.message));

  try {
    await page.goto("chrome://newtab", { waitUntil: "domcontentloaded" });
    await waitFacade(page);

    const env = await page.evaluate(() => ({
      protocol: location.protocol,
      hasFacade: Boolean(window.__boxingDebug),
    }));
    rec("P1-extension-origin", env.protocol === "chrome-extension:", "protocol=" + env.protocol);
    rec("P1-facade", env.hasFacade, "window.__boxingDebug reachable");

    const obStart = await page.evaluate(() => {
      const el = document.getElementById("onboarding-overlay");
      if (!el) return { present: false };
      const cs = getComputedStyle(el);
      const shown = cs.display !== "none" && cs.visibility !== "hidden" && el.getBoundingClientRect().width > 0;
      return { present: true, shown: shown, steps: el.querySelectorAll(".onboarding__step").length };
    });
    rec("G1a-onboarding-shown", obStart.present && obStart.shown,
      obStart.present ? "shown=" + obStart.shown + " steps=" + obStart.steps : "overlay element absent");

    let clicks = 0;
    while (clicks < 12) {
      const st = await page.evaluate(() => {
        const el = document.getElementById("onboarding-overlay");
        if (!el) return { gone: true };
        const cs = getComputedStyle(el);
        return { gone: cs.display === "none" || cs.visibility === "hidden" || el.getBoundingClientRect().width === 0 };
      });
      if (st.gone) break;
      const btn = await page.$("#onboarding-next-btn");
      if (!btn) break;
      await btn.click();
      await page.waitForTimeout(350);
      clicks += 1;
    }
    const obEnd = await page.evaluate(() => {
      const el = document.getElementById("onboarding-overlay");
      if (!el) return { gone: true };
      const cs = getComputedStyle(el);
      return { gone: cs.display === "none" || cs.visibility === "hidden" || el.getBoundingClientRect().width === 0 };
    });
    rec("G1b-onboarding-completable", obEnd.gone, "Next clicked " + clicks + " time(s), dismissed=" + obEnd.gone);

    const boxesBefore = await page.evaluate(() => window.__boxingDebug.state().boxes);
    await page.click("#add-box");
    await page.waitForTimeout(600);
    const boxesAfter = await page.evaluate(() => window.__boxingDebug.state().boxes);
    rec("G1c-main-surface-clickable", boxesAfter === boxesBefore + 1,
      "#add-box click: " + boxesBefore + " -> " + boxesAfter + " boxes");

    // G2-shaped: seed -> persist -> reload -> verify intact.
    const seeded = await page.evaluate(async () => {
      const d = window.__boxingDebug;
      const b = d.layout.boxes[0];
      if (!b) return null;
      b.title = "GB-DRYRUN-ALPHA";
      b.x = 120;
      b.y = 90;
      await d.saveLayout();
      return { boxes: d.layout.boxes.length, title: b.title, x: b.x, y: b.y };
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitFacade(page);
    const reread = await page.evaluate(() => {
      const d = window.__boxingDebug;
      const b = d.layout.boxes[0];
      return { boxes: d.layout.boxes.length, title: b ? b.title : null, x: b ? b.x : null, y: b ? b.y : null };
    });
    const g2ok = Boolean(seeded) && reread.title === "GB-DRYRUN-ALPHA" && reread.x === 120 && reread.boxes === seeded.boxes;
    rec("G2-persist-across-reload", g2ok,
      "seeded=" + JSON.stringify(seeded) + " reread=" + JSON.stringify(reread));

    const dump = await page.evaluate(async () => {
      const d = window.__boxingDebug;
      const all = (await d.storageGet(null)) || {};
      const keys = Object.keys(all).sort();
      const layout = all.boxingLayout;
      return {
        keys: keys,
        snapIndex: all["snap.v1.index"] || null,
        layoutType: typeof layout,
        layoutKeys: layout && typeof layout === "object" ? Object.keys(layout) : null,
      };
    });
    rec("P2-real-storage", dump.keys.indexOf("boxingLayout") >= 0, dump.keys.length + " storage keys");
    fs.writeFileSync(path.join(OUT, "storage-dump.json"), JSON.stringify(dump, null, 2), "utf8");
    const layoutDump = await page.evaluate(() => JSON.parse(JSON.stringify(window.__boxingDebug.layout)));
    fs.writeFileSync(path.join(OUT, "layout-dump.json"), JSON.stringify(layoutDump, null, 2), "utf8");

    if (fs.existsSync(FIXTURE)) {
      const fx = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
      await page.evaluate(async (fixture) => {
        const d = window.__boxingDebug;
        const cur = await d.storageGet("boxingLayout");
        const asString = typeof (cur && cur.boxingLayout) === "string";
        await d.storageSet({ boxingLayout: asString ? JSON.stringify(fixture) : fixture });
      }, fx);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitFacade(page);
      const v2 = await page.evaluate(async () => {
        const d = window.__boxingDebug;
        const all = (await d.storageGet(null)) || {};
        return {
          boxes: d.layout.boxes.length,
          titles: d.layout.boxes.map((b) => b.title),
          children: d.layout.boxes.reduce((n, b) => n + ((b.children || []).length), 0),
          bookmarks: d.layout.boxes.reduce((n, b) => n + (b.children || []).reduce((m, c) => m + ((c.bookmarks || []).length), 0), 0),
          schemaVersion: d.layout.schemaVersion,
          hasConnectionsKey: Object.prototype.hasOwnProperty.call(d.layout, "connections"),
          corrupt: Object.keys(all).filter((k) => /corrupt/i.test(k)),
        };
      });
      // Hard gate = NO DATA LOSS + no false corruption archive. schemaVersion / connections
      // are recorded as OBSERVATIONS, not gates: migrateLayout v2 branch (ntp/utils.js:175)
      // returns an object without those two keys; they are backfilled to 1 / [] on the NEXT
      // load via the version>=3 branch, so this is a conformance gap, not data loss.
      const lossless = v2.titles.indexOf("Legacy") >= 0 && v2.children >= 1 && v2.bookmarks >= 1;
      rec("G5b-v2-single-trip", lossless && v2.corrupt.length === 0,
        "children=" + v2.children + " bookmarks=" + v2.bookmarks + " titles=" + JSON.stringify(v2.titles) +
        " corrupt=" + JSON.stringify(v2.corrupt) +
        " OBSERVATION schemaVersion=" + v2.schemaVersion + " connectionsKey=" + v2.hasConnectionsKey);
    } else {
      rec("G5b-v2-single-trip", false, "fixture missing: " + FIXTURE);
    }

    rec("G1a-console-clean", errors.length === 0, errors.length + " page error(s)");
    fs.writeFileSync(path.join(OUT, "console-errors.txt"),
      errors.length ? errors.join(String.fromCharCode(10)) + String.fromCharCode(10) : "(no console errors captured)" + String.fromCharCode(10), "utf8");
  } finally {
    await ctx.close();
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    generatedAt: new Date().toISOString(),
    artifact: EXT,
    lane: "chromium (real unpacked product)",
    isGbEvidence: false,
    note: "Dry-run rehearsal only. NOT G-B evidence - see scripts/gb-dryrun-chrome.mjs header.",
    outOfScope: [
      "G3 real backup import (needs a backup produced by the previous release)",
      "G4 upgrade install from v2026.9.11 + pre-update snapshot",
      "G6 named human sign-off",
      "Firefox lane (Playwright cannot load an unpacked extension without signing)",
      "service-worker console (no Playwright event surface)",
    ],
    results: results,
    verdict: failed.length === 0 ? "DRY-RUN GREEN (not a G-B claim)" : "DRY-RUN RED - " + failed.length + " failing check(s)",
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log("");
  console.log(summary.verdict);
  console.log("artifacts: " + OUT);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => { console.error("FATAL: " + (e && e.stack ? e.stack : e)); process.exit(2); });

