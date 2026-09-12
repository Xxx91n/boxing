// Boxing — ticket 51 (spec W6-D2): export envelope + full DR package +
// copy-before-overwrite + envelope import restores the layout.
// AC coverage:
//   AC1 default export = { _exportedAt, meta:{schemaVersion, snapshots[], corrupt[],
//       conflicts[]}, layout } — meta carries INDICES ONLY (no snapshot bodies)
//   AC2 optional full DR package embeds verbatim _bodies; 5MB trim path pinned
//   AC3 download filename boxing-backup-YYYYMMDD.json
//   AC4 every overwrite entry (WebDAV pull / loss-guard restore / import overwrite)
//       snapshots the discarded local side BEFORE the destructive write
//   AC6 an exported envelope re-imports and restores the current layout
// file:// mock lane per 43R harness discipline: seed via addInitScript BEFORE the
// first navigation, single goto, no reload — leaves no unload-flush race window.
import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp', 'index.html')).href;
const WEBDAV_URL = 'https://app.koofr.net/dav/Koofr/';
const WEBDAV_USER = 'jinxi2410@gmail.com';
const WEBDAV_PASS = 'kel988j8tv44f2v0';

function bareLayout(title) {
  return {
    version: 3.5, schemaVersion: 3, nextLargeIndex: 2,
    boxes: [{ id: 'L1', type: 'large', title, x: 40, y: 40, width: 320, height: 220,
      nextSmallIndex: 1, children: [] }],
    connections: [], settings: { zoomLevel: 1.0, lastSyncAt: 0 },
    _meta: { revision: 1, updatedAt: Date.now() - 60000, writerId: 'this-tab' },
  };
}

// Seed the snap.v1 split-key snapshot (index entry + body) directly on the
// file:// mock storage: layoutStorage maps every non-main key through the
// 'bxstore:' localStorage prefix (ntp.js mock). Index entries are {ts,
// schemaVersion, size} — NO data field; the body key holds {ts, schemaVersion, data}.
// Ticket 71 (Wave8 G-A, N4): `ts` MUST ride in on the serialized `seed` argument.
// Playwright serializes an init script with fn.toString() and evaluates it in the
// page, so a module-scope constant like SNAP_TS is a FREE VARIABLE there — reading
// it throws ReferenceError and aborts the remainder of the script. That seeded
// boxingLayout (first statement) but never the snapshot keys, so AC1/AC2 asserted
// against an empty snapshot index (0 instead of 1) and could never go green. Same
// class of bug as the t43R "single goto, no reload" harness discipline: the
// fixture must survive the serialization boundary.
const SNAP_TS = 111;
function seedStorage(localTitle) {
  return (seed) => {
    const ts = seed.ts;
    localStorage.setItem('boxingLayout', JSON.stringify(seed.layout));
    localStorage.setItem('bxstore:snap.v1.index', JSON.stringify([{ ts, schemaVersion: 3, size: 999 }]));
    localStorage.setItem('bxstore:snap.v1.' + ts, JSON.stringify({ ts, schemaVersion: 3, data: seed.snapData }));
  };
}

async function boot(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.__boxingDebug))).toBe(true);
}

// Capture the export blob text + anchor download name without a real download:
// patch URL.createObjectURL (blob text) and HTMLAnchorElement.click (name).
async function armExportCapture(page) {
  await page.evaluate(() => {
    (window as any).__cap = { text: null, name: null };
    const origUrl = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      (blob as Blob).text().then((t) => { (window as any).__cap.text = t; });
      return origUrl(blob);
    };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download) (window as any).__cap.name = this.download;
      return origClick.apply(this, arguments as any);
    };
  });
}
async function readExport(page) {
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__cap?.text)), { timeout: 8000 }).toBe(true);
  return page.evaluate(() => ({
    text: (window as any).__cap.text,
    name: (window as any).__cap.name,
  }));
}

async function runImport(page, name, data) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.evaluate(() => { document.querySelector('#settings-btn')?.click(); });
  await page.evaluate(() => { document.querySelector('#import-data-btn')?.click(); });
  const chooser = await chooserPromise;
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}

const confirmAction = (page) => page.evaluate(() => { document.getElementById('confirm-delete-btn')?.click(); });

function envelopeFor(layout, extraMeta) {
  return {
    _exportedAt: new Date().toISOString(),
    meta: Object.assign({ schemaVersion: 3, fullPackage: false, snapshots: [], corrupt: [], conflicts: [] }, extraMeta || {}),
    layout,
  };
}

test.describe('Ticket 51 — export envelope + full DR package + copy-before-overwrite', () => {

  test('AC1+AC3: default export is an envelope with meta indices only, spec filename', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await page.addInitScript(seedStorage(), { layout: bareLayout('Envelope Root'), snapData: bareLayout('Seeded Snap'), ts: SNAP_TS });
    await boot(page);

    await armExportCapture(page);
    await page.evaluate(() => { document.getElementById('export-data-btn')?.click(); });
    const cap = await readExport(page);

    expect(cap.name).toMatch(/^boxing-backup-\d{8}\.json$/);
    const env = JSON.parse(cap.text);
    // envelope shape (W6-D2): layout + meta index, _exportedAt stamp
    expect(env._exportedAt).toBeTruthy();
    expect(env.meta).toBeTruthy();
    expect(env.meta.schemaVersion).toBe(3);
    expect(env.meta.fullPackage).toBe(false);
    // main layout rides in the envelope
    expect(Array.isArray(env.layout.boxes)).toBe(true);
    expect(env.layout.boxes[0].title).toBe('Envelope Root');
    // meta carries the snapshot INDEX entries only — never bodies (D-006 negative)
    expect(Array.isArray(env.meta.snapshots)).toBe(true);
    expect(env.meta.snapshots.length).toBe(1);
    expect(env.meta.snapshots[0].ts).toBe(SNAP_TS);
    expect(env.meta.snapshots[0].data).toBeUndefined();
    expect(env.meta.corrupt).toEqual([]);
    expect(env.meta.conflicts).toEqual([]);
    expect(env._bodies).toBeUndefined();
    // bare top-level boxes field must be GONE (envelope-only layout)
    expect(env.boxes).toBeUndefined();
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC2: full DR package export embeds verbatim bodies, indices stay body-free', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await page.addInitScript(seedStorage(), { layout: bareLayout('Envelope Root'), snapData: bareLayout('Seeded Snap'), ts: SNAP_TS });
    await boot(page);

    await armExportCapture(page);
    await page.evaluate(() => { document.getElementById('export-full-dr-btn')?.click(); });
    const cap = await readExport(page);
    expect(cap.name).toMatch(/^boxing-backup-\d{8}\.json$/);
    const env = JSON.parse(cap.text);
    expect(env.meta.fullPackage).toBe(true);
    // bodies: the snapshot payload lands verbatim
    expect(Array.isArray(env._bodies.snapshots)).toBe(true);
    expect(env._bodies.snapshots.length).toBe(1);
    expect(env._bodies.snapshots[0].data.boxes[0].title).toBe('Seeded Snap');
    expect(env._bodies.corrupt).toEqual([]);
    expect(env._bodies.conflicts).toEqual([]);
    // index still has no bodies; trim flag only appears when the 5MB cap bites
    expect(env.meta.snapshots[0].data).toBeUndefined();
    expect(env.meta.bodyTrimmed).toBeUndefined();
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC6: envelope import onto an empty canvas restores the current layout', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await boot(page);

    await runImport(page, 'boxing-backup-20260912.json', envelopeFor(bareLayout('Restored Root')));
    await page.waitForTimeout(1500);
    // empty-canvas import lands without a confirm (nothing to overwrite)
    expect(await page.evaluate(() => document.getElementById('confirm-modal').hidden)).toBe(true);
    const titles = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map(b => b.title));
    expect(titles).toContain('Restored Root');
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC6b: envelope import onto a non-empty canvas rides the merge pipeline (no silent overwrite)', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await page.addInitScript(() => {
      localStorage.setItem('boxingLayout', JSON.stringify(bareLayoutSeed('Keep Me')));
      function bareLayoutSeed(title) {
        return {
          version: 3.5, schemaVersion: 3, nextLargeIndex: 2,
          boxes: [{ id: 'L9', type: 'large', title, x: 500, y: 500, width: 320, height: 220, nextSmallIndex: 1, children: [] }],
          connections: [], settings: { zoomLevel: 1.0, lastSyncAt: 0 },
          _meta: { revision: 1, updatedAt: Date.now(), writerId: 'this-tab' },
        };
      }
    });
    await boot(page);

    await runImport(page, 'env.json', envelopeFor(bareLayout('Restored Root')));
    // merge confirmation appears (local side never silently dropped)
    await expect.poll(() => page.evaluate(() => !document.getElementById('confirm-modal').hidden), { timeout: 5000 }).toBe(true);
    await confirmAction(page); // 'Merge & import'
    await page.waitForTimeout(1200);
    const titles = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map(b => b.title));
    expect(titles).toContain('Restored Root');
    expect(titles).toContain('Keep Me');
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC4: WebDAV cloud-newer pull snapshots the discarded local side BEFORE overwrite', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await page.addInitScript(() => {
      const heart = (msg) => {
        const cloudBody = JSON.stringify({
          version: 3.5,
          boxes: [{ id: 'L1', type: 'large', title: 'Cloud Wins', x: 0, y: 0, width: 320, height: 220, children: [] }],
          settings: {},
          _meta: { revision: 9, updatedAt: Date.now() + 100000, writerId: 'other-client' },
        });
        if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, body: cloudBody };
        return { success: true, status: 200, ok: true };
      };
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg, cb) => {
            try { const resp = heart(msg); cb && cb(resp); } catch (e) { cb && cb({ success: false, error: String(e) }); }
          },
          getURL: (p) => p,
          lastError: null,
        },
      };
    });
    await page.addInitScript(() => {
      localStorage.setItem('boxingLayout', JSON.stringify({
        version: 3.5, schemaVersion: 3, nextLargeIndex: 2,
        boxes: [{ id: 'L1', type: 'large', title: 'Pre-Pull Root', x: 40, y: 40, width: 320, height: 220, nextSmallIndex: 1, children: [] }],
        connections: [], settings: { zoomLevel: 1.0, lastSyncAt: Date.now() - 1000 },
        _meta: { revision: 1, updatedAt: Date.now() - 60000, writerId: 'this-tab' },
      }));
    });
    await boot(page);

    await page.evaluate((cfg) => window.__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    // pure pull window: only the cloud moved after lastSyncAt, different writer
    const result = await page.evaluate(() => window.__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('pull');

    const titles = await page.evaluate(() => window.__boxingDebug.layout.boxes.map(b => b.title));
    expect(titles).toContain('Cloud Wins');
    // the discarded local side survives as a snapshot taken before the write
    const idx = await page.evaluate(async () => {
      const got = await window.__boxingDebug.storageGet(['snap.v1.index']);
      return got['snap.v1.index'];
    });
    expect(Array.isArray(idx)).toBe(true);
    expect(idx.length).toBeGreaterThanOrEqual(1);
    const body = await page.evaluate(async (ts) => {
      const got = await window.__boxingDebug.storageGet(['snap.v1.' + ts]);
      return JSON.stringify(got['snap.v1.' + ts]);
    }, idx[idx.length - 1].ts);
    expect(body).toContain('Pre-Pull Root');
    expect(pageErrors).toEqual([]);
    await context.close();
  });
});
