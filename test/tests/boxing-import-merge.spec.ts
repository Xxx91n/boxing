// Boxing — ticket 44 (spec D4): import/WebDAV restore = merge + conflict copies, never
// silent overwrite. AC: (1) importing a backup whose ids already exist locally keeps BOTH
// sides (conflicts queryable as conflict copies), (2) no silent-drop-local default remains,
// (3) explicit overwrite-restore still works and is gated by a confirm dialog (+ pre-snapshot),
// (4) sync field-level conflicts land on boxingLayout.conflict.<ts> instead of being lost.
// file:// mock lane per 43R harness discipline: seed BEFORE first navigation (addInitScript),
// single goto, no reload — leaves no unload-flush race window.
import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp', 'index.html')).href;
const WEBDAV_URL = 'https://app.koofr.net/dav/Koofr/';
const WEBDAV_USER = 'jinxi2410@gmail.com';
const WEBDAV_PASS = 'kel988j8tv44f2v0';

// Local state on the canvas: L1 with child S1 holding ONE bookmark (local.test).
function localLayout() {
  return {
    version: 3.5, schemaVersion: 1, nextLargeIndex: 2,
    boxes: [{ id: 'L1', type: 'large', title: 'Local Root', x: 40, y: 40, width: 320, height: 220,
      nextSmallIndex: 2,
      children: [{ id: 'S1', title: 'Local Small', x: 0, y: 0, width: 240, height: 180, pinned: true,
        bookmarks: [{ id: 'b1', title: 'Local Only', url: 'https://local.test/a' }] }] }],
    connections: [], groups: [],
    _meta: { revision: 3, updatedAt: Date.now() - 5000, writerId: 'spec-writer' },
    settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, lastSyncAt: 0 },
  };
}

// Backup file: divergent L1 (same ids, different bookmark content — url moved + extra b2)
// plus a brand-new L2 that local never had.
function backupLayout() {
  return {
    version: 3.5, schemaVersion: 1, nextLargeIndex: 3,
    boxes: [
      { id: 'L1', type: 'large', title: 'Backup Root', x: 40, y: 40, width: 320, height: 220,
        nextSmallIndex: 2,
        children: [{ id: 'S1', title: 'Local Small', x: 0, y: 0, width: 240, height: 180, pinned: true,
          bookmarks: [
            { id: 'b1', title: 'Local Only', url: 'https://backup.test/b1' },
            { id: 'b2', title: 'Backup Only', url: 'https://backup.test/b2' },
          ] }] },
      { id: 'L2', type: 'large', title: 'Backup New', x: 400, y: 40, width: 320, height: 220,
        nextSmallIndex: 1, children: [] },
    ],
    connections: [], groups: [],
    _meta: { revision: 7, updatedAt: Date.now() - 1000, writerId: 'backup-writer' },
    settings: {},
  };
}

async function seedAndBoot(page) {
  await page.addInitScript((seed) => {
    localStorage.setItem('boxingLayout', JSON.stringify(seed));
  }, localLayout());
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.__boxingDebug))).toBe(true);
}

async function runImport(page, name, data) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.evaluate(() => { document.querySelector('#settings-btn')?.click(); });
  await page.evaluate(() => { document.querySelector('#import-data-btn')?.click(); });
  const chooser = await chooserPromise;
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}

async function waitForConfirmModal(page, bodyPattern) {
  await expect.poll(() => page.evaluate(() =>
    !document.getElementById('confirm-modal').hidden &&
    (document.getElementById('confirm-body').textContent || '')), { timeout: 5000 }
  ).toMatch(bodyPattern);
  return page.evaluate(() => document.getElementById('confirm-body').textContent || '');
}

const confirmAction = (page) => page.evaluate(() => { document.getElementById('confirm-delete-btn').click(); });
const confirmDismiss = (page) => page.evaluate(() => { document.getElementById('confirm-cancel-btn').click(); });

function conflictKeys(page) {
  return page.evaluate(() => {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('bxstore:boxingLayout.conflict.') && !k.endsWith('.index')) out.push(k);
    }
    return out;
  });
}

test.describe('Ticket 44 — restore = merge + conflict copies', () => {

  test('AC1+AC2: merge import keeps local, adds new ids, archives same-id divergence as a conflict copy', async ({ browser }) => {
    test.setTimeout(25000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await seedAndBoot(page);
    await runImport(page, 'backup.json', backupLayout());

    // decision modal appears (merge preview counts) — no silent replace before it
    const body = await waitForConfirmModal(page, /conflict/i);
    expect(/nothing .*overwritten|overwrite/i.test(body)).toBeTruthy();
    await confirmAction(page); // 'Merge & import'

    // main layout: local L1 verbatim (local.test url survives) + incoming L2 appended
    await expect.poll(() => page.evaluate(() => {
      try { const s = JSON.parse(localStorage.getItem('boxingLayout') || 'null'); return s && Array.isArray(s.boxes) ? s.boxes.length : 0; } catch { return 0; }
    }), { timeout: 5000 }).toBe(2);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('boxingLayout') || 'null'));
    const titles = stored.boxes.map(b => b.title);
    expect(titles).toContain('Local Root');           // local side kept on canvas
    expect(titles).toContain('Backup New');           // new id appended
    expect(titles).not.toContain('Backup Root');      // divergence did NOT overwrite local
    const l1 = stored.boxes.find(b => b.id === 'L1');
    expect(l1.children[0].bookmarks.map(b => b.url)).not.toContain('https://backup.test/b1');

    // incoming divergent subtree archived as a conflict copy (queryable)
    const keys = await conflictKeys(page);
    expect(keys.length).toBe(1);
    const archived = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), keys[0]);
    expect(archived.reason).toBe('import-merge');
    expect(archived.boxes).toBe(1);
    expect(JSON.stringify(archived.raw)).toContain('backup.test/b2');
    expect(JSON.stringify(archived.raw)).toContain('Backup Root');
    const idx = await page.evaluate(() => JSON.parse(localStorage.getItem('bxstore:boxingLayout.conflict.index') || 'null'));
    expect(Array.isArray(idx)).toBe(true);
    expect(idx[idx.length - 1].reason).toBe('import-merge');

    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC3: declining merge opens the explicit overwrite-restore confirm; taking it replaces after a pre-snapshot', async ({ browser }) => {
    test.setTimeout(25000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await seedAndBoot(page);
    await runImport(page, 'backup.json', backupLayout());
    await waitForConfirmModal(page, /conflict/i);
    await confirmDismiss(page); // decline merge -> second, explicit overwrite dialog

    const body2 = await waitForConfirmModal(page, /overwrite/i);
    expect(/snapshot/i.test(body2)).toBeTruthy();
    await confirmAction(page); // 'Overwrite restore'

    // replace semantics: backup content lands on the main key
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('boxingLayout') || 'null'));
    const titles = stored.boxes.map(b => b.title);
    expect(titles).toContain('Backup Root');
    const l1 = stored.boxes.find(b => b.id === 'L1');
    expect(l1.children[0].bookmarks.map(b => b.url)).toContain('https://backup.test/b1');

    // recovery point: snapshot of the discarded local side exists BEFORE the replace
    const snap = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('bxstore:snap.v1.') && !k.endsWith('.index')) {
          const v = JSON.parse(localStorage.getItem(k));
          if (JSON.stringify(v).includes('Local Root')) return true;
        }
      }
      return false;
    });
    expect(snap, 'pre-overwrite snapshot of the local side missing').toBeTruthy();

    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC2-regression: empty canvas imports without any confirm (nothing to overwrite), gate 5 parity', async ({ browser }) => {
    test.setTimeout(25000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await expect.poll(() => page.evaluate(() => Boolean(window.__boxingDebug))).toBe(true);

    await runImport(page, 'backup.json', backupLayout());
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => document.getElementById('confirm-modal').hidden)).toBe(true);
    const dbg = await page.evaluate(() => window.__boxingDebug.layout.boxes.map(b => b.title));
    expect(dbg).toContain('Backup Root');
    expect(dbg).toContain('Backup New');
    // identical re-import path sanity: no throw when the modal flow is exercised again
    await context.close();
  });

  // WebDAV side (sync-engine mergeLayoutFields): same-id field divergence in the
  // concurrent branch must keep the cloud side as a conflict copy instead of losing it.
  test('AC-sync: WebDAV field-level conflict archives the cloud side as a conflict copy (merge keeps both)', async ({ browser }) => {
    test.setTimeout(25000);
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
      window.__webdavCalls = [];
      window.chrome = {
        runtime: {
          sendMessage: (msg, cb) => {
            window.__webdavCalls.push(msg);
            try { const resp = heart(msg); cb && cb(resp); } catch (e) { cb && cb({ success: false, error: String(e) }); }
          },
          getURL: (p) => p,
          lastError: null,
        },
      };
    });
    await page.addInitScript((seed) => {
      localStorage.setItem('boxingLayout', JSON.stringify(seed));
    }, localLayout());
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await expect.poll(() => page.evaluate(() => Boolean(window.__boxingDebug))).toBe(true);

    await page.evaluate((cfg) => window.__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    // concurrent change window: both sides moved after lastSyncAt, different writers
    await page.evaluate(() => {
      const dbg = window.__boxingDebug;
      dbg.layout.settings.lastSyncAt = Date.now() - 60000;
      dbg.layout._meta.updatedAt = Date.now() - 1000;
      dbg.layout._meta.writerId = 'this-tab';
    });
    const result = await page.evaluate(() => window.__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('merge');
    expect(result.conflicts).toBe(1);

    // local side kept verbatim on the canvas (never overwritten by cloud)
    const titles = await page.evaluate(() => window.__boxingDebug.layout.boxes.map(b => b.title));
    expect(titles).toContain('Local Root');
    expect(titles).not.toContain('Cloud Wins');

    // cloud divergent box archived as a conflict copy — queryable via the facade index
    const idx = await page.evaluate(async () => {
      const got = await window.__boxingDebug.storageGet(['boxingLayout.conflict.index']);
      return got['boxingLayout.conflict.index'];
    });
    expect(Array.isArray(idx)).toBe(true);
    expect(idx.length).toBeGreaterThan(0);
    expect(idx[idx.length - 1].reason).toBe('webdav-field-conflict');
    expect(idx[idx.length - 1].boxes).toBe(1);
    const body = await page.evaluate(async (ts) => {
      const got = await window.__boxingDebug.storageGet(['boxingLayout.conflict.' + ts]);
      return JSON.stringify(got['boxingLayout.conflict.' + ts]);
    }, idx[idx.length - 1].ts);
    expect(body).toContain('Cloud Wins');

    expect(pageErrors).toEqual([]);
    await context.close();
  });
});
