// Boxing — ticket #131 (spec #120 T11): release gate, proven in the REAL build.
//
// Why this file exists: the rest of the backup suite loads background.js into a
// Node VM with a fake chrome.* API. That proves the logic, not the artifact that
// ships. This lane launches Chromium with --load-extension=dist/boxing-chrome,
// talks to the real MV3 worker, and checks the four release conditions that can
// be observed without a user gesture:
//
//   1. a fresh install has no alarm, no auto-backup state and no snapshot, so
//      nothing is uploaded before the user opts in (spec D3, T3.1);
//   2. enabling writes one local snapshot right away and arms the hourly alarm;
//   3. with EVERY extension page closed, the real chrome.alarms event still fires
//      and the worker writes another snapshot — the "no NTP tab" claim (D2, T3.1);
//   4. turning it off clears the alarm at once and records a cancellation instead
//      of a success (D6, T3.6).
//
// What stays outside this file, on purpose:
//   - cloud legs (WebDAV/Gist conditional writes, optional host permission
//     requests): Chrome refuses an optional-host-permission grant without a real
//     user gesture, so those keep their controlled-service proof in
//     boxing-webdav-auto-backup.spec.ts / boxing-gist-first-create.spec.ts;
//   - Firefox: the built add-on is the manual gate from #68 decision B and the
//     #69 checklist. A file:// page is not an extension there.

import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dismissOnboarding } from '../helpers/onboarding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_CHROME = path.resolve(__dirname, '..', '..', 'dist', 'boxing-chrome');
const ALARM = 'boxing-auto-backup';

function launch(profile: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profile, {
    headless: false,
    args: [
      '--load-extension=' + DIST_CHROME,
      '--disable-extensions-except=' + DIST_CHROME,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
}

// The worker can be torn down and replaced while a test runs, so always read the
// live one instead of pinning the first handle.
async function worker(ctx: BrowserContext): Promise<Worker> {
  for (let i = 0; i < 80; i++) {
    const live = ctx.serviceWorkers()[0];
    if (live) return live;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('the loaded build never started its service worker');
}

async function openNtp(ctx: BrowserContext) {
  const page = await ctx.newPage();
  await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)),
    { timeout: 30000, message: 'the loaded build must serve the NTP page itself' }).toBe(true);
  // Lane proof: the page came from the extension, not from disk.
  expect(page.url()).toContain('chrome-extension://');
  await dismissOnboarding(page);
  return page;
}

async function workerState(sw: Worker) {
  return sw.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    return {
      state: (all as any).autoBackupState || null,
      snapKeys: Object.keys(all).filter((k) => k.startsWith('snap.v1.')),
      snapIndex: (all as any)['snap.v1.index'] || null,
      alarms: await chrome.alarms.getAll(),
    };
  });
}

const DIST_READY = fs.existsSync(path.join(DIST_CHROME, 'manifest.json'));

// A gate must not pass on a stale dist: an old build would "prove" permissions
// from bytes nobody is shipping. Compare the built manifest with this tree.
const PACKAGE_VERSION: string = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8'),
).version;

// "Not built yet" is a local convenience only. In CI this lane is the release
// gate, so a missing dist must go red instead of quietly skipping both cases and
// exiting 0.
function requireBuiltLane() {
  test.skip(!DIST_READY && !process.env.CI, 'dist/boxing-chrome is not built - run npm run build');
  if (!DIST_READY) throw new Error('CI must build dist/boxing-chrome before the release-gate lane runs');
}

const extensionPages = (ctx: BrowserContext) =>
  ctx.pages().filter((p) => p.url().startsWith('chrome-extension://')).length;

// The worker can be torn down and replaced at any moment (opening a page is
// enough), so every read goes through the live handle rather than the one that
// happened to exist at launch.
async function liveWorkerState(ctx: BrowserContext, fallback?: Worker) {
  const live = ctx.serviceWorkers()[0] || fallback;
  if (!live) throw new Error('the loaded build has no service worker');
  return workerState(live);
}

// Windows keeps a handle on the profile for a moment after the browser exits, so
// a plain rmSync throws EPERM and turns a green run red (seen once in the third
// full-suite run). Retry briefly, then let the OS own the temp directory: cleanup
// failure is never a product signal.
function dropProfile(profile: string) {
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    /* temp dir, safe to leave behind */
  }
}

test.describe('Ticket 131 - release gate in the loaded Chrome build', () => {
  test('a fresh install ships the optional-permission boundary and uploads nothing by itself', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-extension', 'the loaded build is a chromium lane');
    requireBuiltLane();
    test.setTimeout(120000);

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-131-fresh-'));
    const ctx = await launch(profile);
    try {
      const sw = await worker(ctx);
      const manifest = await sw.evaluate(() => chrome.runtime.getManifest());

      // The real runtime manifest, not the source file: Chrome keeps
      // https://*/* optional, and no notification permission is requested.
      expect(manifest.optional_host_permissions || []).toContain('https://*/*');
      expect(manifest.host_permissions || []).not.toContain('https://*/*');
      expect(manifest.permissions || []).not.toContain('notifications');
      expect(manifest.version, 'the loaded build must come from this tree, not an old dist')
        .toBe(PACKAGE_VERSION);

      await openNtp(ctx);
      const fresh = await liveWorkerState(ctx, sw);
      expect(fresh.state, 'a fresh install has no auto-backup state').toBeNull();
      expect(fresh.snapKeys, 'a fresh install must not write a snapshot by itself').toEqual([]);
      expect(fresh.alarms.map((a) => a.name), 'no alarm may exist before the user opts in').not.toContain(ALARM);
    } finally {
      await ctx.close();
      dropProfile(profile);
    }
  });

  test('the real alarm still writes a snapshot with every extension page closed, and the off switch stops it', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-extension', 'the loaded build is a chromium lane');
    requireBuiltLane();
    test.setTimeout(240000);

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-131-alarm-'));
    const ctx = await launch(profile);
    try {
      let sw = await worker(ctx);
      const page = await openNtp(ctx);

      // Real content, created through the app's own entry point, so the worker
      // has a plausible layout to snapshot instead of rejecting an empty one.
      await page.evaluate(() => (window as any)._boxingAddLargeBox());
      await expect.poll(() => page.evaluate(async () => {
        const res = await (window as any).__boxingDebug.storageGet('boxingLayout');
        return res && res.boxingLayout && res.boxingLayout.boxes ? res.boxingLayout.boxes.length : 0;
      }), { timeout: 15000 }).toBeGreaterThan(0);

      // The same message the settings page sends when the user turns the switch on.
      const cfg = await page.evaluate(async () =>
        await (globalThis as any).chrome.runtime.sendMessage({
          type: 'auto-backup-configure', optIn: true, intervalSec: 3600,
        }));
      expect(cfg && cfg.success).toBe(true);
      expect(cfg && cfg.ok, 'the opt-in run must succeed on a valid layout').toBe(true);

      await expect.poll(async () => (await liveWorkerState(ctx, sw)).state?.local?.status,
        { timeout: 30000, message: 'the opt-in run records a real local success' }).toBe('ok');
      const first = await liveWorkerState(ctx, sw);
      const firstSuccess = first.state.local.lastSuccessAt;
      expect(firstSuccess).toBeGreaterThan(0);
      expect(first.snapKeys.length).toBeGreaterThanOrEqual(1);
      expect(first.alarms.map((a) => a.name)).toContain(ALARM);
      expect(first.alarms.find((a) => a.name === ALARM)?.periodInMinutes).toBe(60);
      // Local-only: the cloud side has no success to report.
      expect(first.state.remote.lastSuccessAt).toBe(0);

      // ── the claim under test: zero NTP tabs, the alarm still runs ────────────
      await page.goto('about:blank');
      expect(extensionPages(ctx), 'no extension page may be open for this step').toBe(0);

      sw = ctx.serviceWorkers()[0] || sw;
      await sw.evaluate(async (name) => {
        // An explicit due signal, the same event the browser raises on schedule.
        await chrome.alarms.create(name, { when: Date.now() + 1000 });
      }, ALARM);

      await expect.poll(async () => {
        const live = ctx.serviceWorkers()[0] || sw;
        const s = await workerState(live);
        return s.snapKeys.length;
      }, { timeout: 90000, intervals: [500, 1000, 2000],
        message: 'the alarm must fire and write another snapshot without any NTP tab' })
        .toBeGreaterThan(first.snapKeys.length);

      // The run settles as a real success, not a leftover "running".
      await expect.poll(async () => (await liveWorkerState(ctx, sw)).state?.local?.status,
        { timeout: 30000 }).toBe('ok');
      const afterAlarm = await liveWorkerState(ctx, sw);
      expect(afterAlarm.state.local.lastSuccessAt).toBeGreaterThan(firstSuccess);

      // ── the off switch is immediate and honest ──────────────────────────────
      const back = await openNtp(ctx);
      // Opening the page sends `auto-backup-ensure` asynchronously, which puts the
      // periodic alarm back. Wait for it before testing the switch: otherwise
      // "no alarm after off" passes simply because the alarm never came back.
      await expect.poll(async () => {
        const s = await liveWorkerState(ctx, sw);
        return s.alarms.find((a) => a.name === ALARM)?.periodInMinutes;
      }, { timeout: 30000, message: 'the periodic alarm must exist before the off switch is tested' })
        .toBe(60);
      const off = await back.evaluate(async () =>
        await (globalThis as any).chrome.runtime.sendMessage({
          type: 'auto-backup-configure', optIn: false, intervalSec: 0,
        }));
      expect(off && off.success).toBe(true);

      const stopped = await liveWorkerState(ctx, sw);
      expect(stopped.alarms.map((a) => a.name)).not.toContain(ALARM);
      expect(stopped.state.optIn).toBe(false);
      expect(stopped.state.intervalSec).toBe(0);
      // An explicit stop is a cancellation; the old success time stays real.
      expect(stopped.state.local.status).toBe('cancelled');
      expect(stopped.state.local.lastSuccessAt).toBe(afterAlarm.state.local.lastSuccessAt);
    } finally {
      await ctx.close();
      dropProfile(profile);
    }
  });
});