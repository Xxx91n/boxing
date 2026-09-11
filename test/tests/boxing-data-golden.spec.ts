import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Ticket 45 (architecture-recovery) — CI data-layer golden gates.
// Five gates over the single-writer storage chain (see docs/adr/0009, ADR-0016,
// ntp/storage.js header contract):
//   1. roundtrip: 50 writes -> storage dump -> reload -> storage/DOM still match;
//      a stale snapshot must never overwrite the newest revision.
//   2. single write path: static scan — no direct chrome.storage writes outside the
//      ntp/storage.js facade (SW small-key exceptions documented in WORKFLOW section 6 / ticket 10).
//   3. undici keep-alive reuse across two syncs.
//   4. cross-page: window A layout update syncs into window B — same real browser
//      profile (newContext = fresh non-incognito profile), never a shared ephemeral
//      context trick.
//   5. import under near-full storage: no throw, user-visible BX-AUD-04 flag +
//      emergency fallback snapshot; plus SEC-06 oversized-payload rejection alerts.
//
// Burn-in: this file is tagged @data-golden and runs in its own CI job with
// continue-on-error (see .github/workflows/test.yml). After one week green, remove
// BOXING_EXCLUDE_GREP from the main lane steps and flip the job to blocking.
// If a gate is red because of a product gap, open an upstream ticket — do not
// disable the gate inside this ticket (ticket-45 acceptance rule).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(ROOT_DIR, 'ntp', 'index.html')).href;

async function bootNtp(page: import('@playwright/test').Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
}

async function readStoredLayout(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const stored = await (window as any).__boxingDebug.storageGet('boxingLayout');
    return stored.boxingLayout || null;
  });
}

test.describe('Data-layer golden gates (ticket 45) @data-golden', () => {
  test.setTimeout(120000);

  test('gate 1: roundtrip — 50 writes survive reload; stale snapshot never overwrites', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await bootNtp(page);

    const pre = await page.evaluate(async () => {
      const d = (window as any).__boxingDebug;
      (window as any)._boxingAddLargeBox();
      (window as any)._boxingAddLargeBox();
      for (let i = 0; i < 50; i++) {
        d.layout.settings.tick = i;
        await d.saveLayout();
      }
      const stored = await d.storageGet('boxingLayout');
      return {
        revision: stored.boxingLayout._meta.revision,
        tick: stored.boxingLayout.settings.tick,
        boxes: (stored.boxingLayout.boxes || []).length,
      };
    });
    expect(pre.boxes).toBe(2);
    expect(pre.tick).toBe(49);
    expect(pre.revision).toBeGreaterThanOrEqual(50);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    await page.waitForTimeout(600);

    const post = await readStoredLayout(page);
    expect(post.settings.tick, 'reloaded storage lost the last write (stale overwrite?)').toBe(49);
    expect(post.boxes.length).toBe(2);
    expect(post._meta.revision, 'revision must never regress across reload').toBeGreaterThanOrEqual(pre.revision);

    // DOM agrees with storage — what the user actually sees.
    expect(await page.locator('.large-box').count()).toBe(2);

    // Quiescence: a late-arriving stale snapshot (boot-time restore chains) must not
    // mutate storage afterwards. Two samples >1s apart must be identical.
    const firstSample = post._meta.revision;
    await page.waitForTimeout(1200);
    const second = await readStoredLayout(page);
    expect(second._meta.revision).toBe(firstSample);
    expect(second.settings.tick).toBe(49);
    expect(errors).toEqual([]);
  });

  test('gate 2: single write path — no direct chrome.storage writes outside storage.js', () => {
    // The header of ntp/storage.js documents the contract; the scan enforces it.
    const storageSrc = fs.readFileSync(path.join(ROOT_DIR, 'ntp', 'storage.js'), 'utf8');
    expect(storageSrc.slice(0, 3000)).toContain('All boxingLayout writes flow through this module');

    const writeRe = /(api|chrome|browser)\.storage(\.(local|sync|session))?\.(set|remove|clear)\s*\(|\b[a-zA-Z_$][a-zA-Z0-9_$]*[Ss]torage[a-zA-Z0-9_$]*\.(set|remove|clear)\s*\(/;
    const ntpFiles = fs.readdirSync(path.join(ROOT_DIR, 'ntp')).filter((f) => f.endsWith('.js') && f !== 'storage.js');
    // The ONLY sanctioned exception: the __boxingDebug facade passthrough trio
    // (storageGet/storageSet/storageRemove, added by ticket 41R for snapshot
    // testing). Pinned by exact shape + count so any NEW write site anywhere —
    // including a fourth debug handle — still goes red.
    const debugPassthroughRe = /^\s*storage(Get|Set|Remove): \(.*=> layoutStorage\.(get|set|remove)\b/;
    const violations: string[] = [];
    const debugHits: string[] = [];
    for (const file of ntpFiles) {
      const lines = fs.readFileSync(path.join(ROOT_DIR, 'ntp', file), 'utf8').split(/\r?\n/);
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (debugPassthroughRe.test(line)) { debugHits.push(trimmed); return; }
        if (writeRe.test(line)) violations.push('ntp/' + file + ' ' + trimmed.slice(0, 100));
      });
    }
    expect(violations, 'direct storage writes outside the facade:').toEqual([]);
    expect(debugHits.slice().sort(), 'the pinned debug passthrough trio drifted').toEqual([
      'storageGet: (keys) => layoutStorage.get(keys),',
      'storageRemove: (keys) => layoutStorage.remove ? layoutStorage.remove(keys) : Promise.resolve(),',
      'storageSet: (obj) => layoutStorage.set(obj),',
    ]);

    // SW exceptions: background.js may only write the documented non-layout small
    // keys (bgErrLog, boxingInstallSignal) and must never touch boxingLayout.
    const bg = fs.readFileSync(path.join(ROOT_DIR, 'background.js'), 'utf8');
    expect(bg).not.toContain('boxingLayout');
    const bgWrites = bg.split(/\r?\n/).filter((l) => /\.storage\.local\.set\(/.test(l));
    expect(bgWrites.length, 'background must keep its storage writes').toBeGreaterThan(0);
    for (const line of bgWrites) {
      expect(line, 'un-whitelisted background storage write key').toMatch(/bgErrLog|boxingInstallSignal/);
    }
  });

  test('gate 3: undici keep-alive reuse across two syncs', async () => {
    // Explicit skip with reason (ticket-45 acceptance allows skip(reason)): the WebDAV
    // and Gist transports run as page/service-worker fetch inside the browser network
    // stack (ADR-0016), not through Node undici — there is no parent-process connection
    // surface for Playwright to observe reuse, and Chrome does not expose connection
    // pooling via Resource Timing. Revisit if a Node-side sync harness lands upstream.
    test.skip(true, 'transport is browser-side fetch (MV3 network stack); no undici surface to assert');
  });

  test('gate 4: cross-page — window A update syncs to window B (same profile, non-incognito)', async ({ browser }) => {
    // newContext() = fresh dedicated browser profile; pages inside it share the
    // extension storage domain (mock localStorage on the file:// lane). Not incognito:
    // extension storage there is isolated/unavailable by default.
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    const errors: string[] = [];
    a.on('pageerror', (e) => errors.push('A: ' + String(e)));
    b.on('pageerror', (e) => errors.push('B: ' + String(e)));
    await bootNtp(a);
    await bootNtp(b);

    const revA = await a.evaluate(async () => {
      (window as any)._boxingAddLargeBox();
      await (window as any).__boxingDebug.saveLayout();
      const stored = await (window as any).__boxingDebug.storageGet('boxingLayout');
      return stored.boxingLayout._meta.revision as number;
    });
    expect(revA).toBeGreaterThan(0);

    await expect.poll(async () => b.evaluate(() => (window as any).__boxingDebug.layout.boxes.length),
      { timeout: 8000, intervals: [150, 300, 600] }).toBe(1);

    // The loop guard (applyingExternalLayout) must converge without a write storm:
    // storage revision is stable across a settle window and B's memory matches storage.
    const settle1 = await readStoredLayout(b);
    await a.waitForTimeout(1200);
    const settle2 = await readStoredLayout(a);
    expect(settle2._meta.revision).toBe(settle1._meta.revision);
    expect(settle1._meta.revision).toBeGreaterThanOrEqual(revA);
    const bMem = await b.evaluate(() => ((window as any).__boxingDebug.layout._meta || {}).revision ?? null);
    expect(bMem, 'B converged to the shared revision').toBe(settle2._meta.revision);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('gate 5: import under near-full storage — no throw, BX-AUD-04 flag + fallback snapshot', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await bootNtp(page);
    await page.evaluate(() => { (window as any).__alerts = []; (window as any).alert = (m: any) => { (window as any).__alerts.push(String(m)); }; });

    // Simulate storage.local being near full: the mock's set() funnels through
    // localStorage.setItem('boxingLayout', ...), so throw a QUOTA_BYTES-style error
    // for exactly that key. Storage.prototype patch — honored on both engines
    // (probe 2026-09-03 in boxing-audit.spec.ts; instance shadowing is ignored on
    // Firefox).
    await page.evaluate(() => {
      const protoSetItem = Storage.prototype.setItem;
      const origSetItem = protoSetItem.bind(window.localStorage);
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (key === 'boxingLayout') {
          const e = new Error('QUOTA_BYTES quota exceeded');
          (e as any).code = 'QUOTA_BYTES';
          throw e;
        }
        return origSetItem(key, value);
      } as typeof Storage.prototype.setItem;
      (window as any).__boxingRestoreSetItem = () => { Storage.prototype.setItem = protoSetItem; };
    });

    const payload = JSON.stringify({
      version: 3.5,
      boxes: [{ id: 'golden-box', x: 100, y: 100, title: 'Golden', width: 420, height: 320, nextSmallIndex: 2,
        children: [{ id: 'golden-child', x: 0, y: 0, title: 'Child', pinned: true, width: 240, height: 180,
          bookmarks: [{ id: 'golden-bm', title: 'MDN', url: 'https://developer.mozilla.org/' }] }] }],
      connections: [],
      settings: {},
    });

    const chooserPromise = page.waitForEvent('filechooser');
    await page.evaluate(() => { (document.querySelector('#settings-btn') as HTMLElement | null)?.click(); });
    await page.evaluate(() => { (document.querySelector('#import-data-btn') as HTMLElement | null)?.click(); });
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: 'golden-import.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { (window as any).__boxingRestoreSetItem?.(); });

    // (a) no throw / no crash — the import succeeded in memory and rendered:
    expect(errors).toEqual([]);
    expect(await page.locator('.large-box[data-id="golden-box"]').count()).toBe(1);
    // (b) user-visible flag per BX-AUD-04 + emergency fallback snapshot on disk:
    const lastErr = await page.evaluate(() => (window as any).__boxingDebug.layout.settings?.__lastSaveError);
    expect(lastErr, 'BX-AUD-04 quota flag not set').toBeTruthy();
    const fb = await page.evaluate(() => localStorage.getItem('boxingLayoutFallback.v1'));
    expect(fb, 'emergency fallback snapshot missing').toContain('golden-box');
    // (c) recovery: once quota pressure clears, the next save succeeds and the flag resets.
    await page.evaluate(async () => { await (window as any).__boxingDebug.saveLayout(); });
    const stored = await readStoredLayout(page);
    expect(stored.boxes[0].id).toBe('golden-box');
    const cleared = await page.evaluate(() => (window as any).__boxingDebug.layout.settings?.__lastSaveError);
    expect(cleared, 'quota flag must clear after a successful save').toBeFalsy();
  });

  test('gate 5b: SEC-06 oversized import payloads rejected with visible alerts, no crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await bootNtp(page);
    await page.evaluate(() => { (window as any).__alerts = []; (window as any).alert = (m: any) => { (window as any).__alerts.push(String(m)); }; });

    // JSON payload over the 2MB SEC-06 cap (but under the 5MB file cap) -> rejected
    // via importFailed alert, layout untouched.
    const huge = JSON.stringify({ version: 3.5, boxes: [], pad: 'x'.repeat(2000001) });
    const chooser1Promise = page.waitForEvent('filechooser');
    await page.evaluate(() => { (document.querySelector('#settings-btn') as HTMLElement | null)?.click(); });
    await page.evaluate(() => { (document.querySelector('#import-data-btn') as HTMLElement | null)?.click(); });
    (await chooser1Promise).setFiles({ name: 'huge.json', mimeType: 'application/json', buffer: Buffer.from(huge) });
    await page.waitForTimeout(800);

    // Over the 5MB file cap -> importTooLarge alert.
    const oversized = JSON.stringify({ version: 3.5, boxes: [], pad: 'y'.repeat(5 * 1024 * 1024 + 64) });
    const chooser2Promise = page.waitForEvent('filechooser');
    await page.evaluate(() => { (document.querySelector('#import-data-btn') as HTMLElement | null)?.click(); });
    (await chooser2Promise).setFiles({ name: 'oversized.json', mimeType: 'application/json', buffer: Buffer.from(oversized) });
    await page.waitForTimeout(800);

    const alerts = await page.evaluate(() => (window as any).__alerts);
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.some((m: string) => /import failed|invalid data format/i.test(m))).toBe(true);
    expect(alerts.some((m: string) => /too large/i.test(m))).toBe(true);
    expect(errors).toEqual([]);
    const layoutBoxes = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    expect(layoutBoxes).toBe(0);
  });
});
