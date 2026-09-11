// Boxing — ticket 50 (spec W6-D1 / A-003, A-011): Time Machine one-click rollback UI +
// pre-restore safety snapshot. AC: (1) the settings data tab lists snapshots with
// ts/schemaVersion/size and a per-row rollback button, (2) rollback runs behind a secondary
// confirm and replaces the canvas via restoreFromSnapshot (a full replace, NOT the
// mergeConcurrentLayout union — the discarded side survives only as the safety snapshot),
// (3) every restore/overwrite/import entry takes a saveSnapshot('pre-restore') safety copy
// first (fail-closed: no un-snapshotted full replace), (4) this spec pins the rollback
// round-trip + the safety-snapshot counts.
// file:// mock lane per 43R/t44 harness discipline: mutations go through the t41R seam
// (__boxingDebug.saveSnapshot / listSnapshots / storageGet), never window.chrome.storage;
// no boot→seed→reload windows where an unload flush could clobber the seed.
import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

function mkBox(id: string, title: string, x: number) {
  return { id, type: 'large', title, x, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] };
}

async function bootFresh(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Readiness = the t41R snapshot seam itself (ticket 01 lesson: poll what the test calls)
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__boxingDebug?.listSnapshots
      && (window as any).__boxingDebug?.saveSnapshot
      && (window as any).__boxingDebug?.storageGet)), { timeout: 10000 }).toBe(true);
}

const confirmVisible = (page) => page.evaluate(() => !document.getElementById('confirm-modal')?.hidden);
const confirmAction = (page) => page.evaluate(() => { document.getElementById('confirm-delete-btn')?.click(); });
const confirmDismiss = (page) => page.evaluate(() => { document.getElementById('confirm-cancel-btn')?.click(); });
const settingsVisible = (page) => page.evaluate(() => !document.getElementById('settings-modal')?.hidden);
const openSettingsDataTab = async (page) => {
  await page.evaluate(() => { document.querySelector('#settings-btn')?.click(); });
  await page.evaluate(() => { document.querySelector<HTMLElement>('.settings-nav__item[data-tab="data"]')?.click(); });
};
const snapshotRows = (page) => page.locator('#data-snapshot-list .data-snapshot-row');

async function runImport(page, name: string, data) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.evaluate(() => { document.querySelector('#settings-btn')?.click(); });
  await page.evaluate(() => { document.querySelector('#import-data-btn')?.click(); });
  const chooser = await chooserPromise;
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}

test.describe('Ticket 50 — Time Machine rollback UI + pre-restore safety snapshot', () => {

  test('AC1+AC2: data tab lists snapshots (ts/schemaVersion/size); confirmed rollback replaces the canvas and keeps a pre-restore safety copy', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);

    // Seed two points in time: snapshot A (only box A live), then box B lands.
    const seed = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'L1', type: 'large', title: 'A', x: 0, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] },
      ];
      dbg.layout.nextLargeIndex = 2;
      await dbg.saveLayout();
      const tsA = await dbg.saveSnapshot(); // rollback target
      dbg.layout.boxes.push(
        { id: 'L2', type: 'large', title: 'B', x: 500, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] },
      );
      await dbg.saveLayout();
      return { tsA, count: (await dbg.listSnapshots()).length };
    });
    expect(seed.count).toBe(1);

    await openSettingsDataTab(page);
    await expect(snapshotRows(page)).toHaveCount(1);
    const row = snapshotRows(page).first();
    const rowText = await row.textContent() || '';
    const sizeOk = /\d+(\.\d+)?\s?(B|KB)/.test(rowText);
    expect(sizeOk).toBeTruthy();                     // size shown (AC1)
    expect(/v\d+/.test(rowText)).toBeTruthy();       // schemaVersion shown (AC1)
    await expect(row.locator('.data-snapshot-rollback-btn')).toBeVisible(); // Roll back button (AC1)

    // Secondary confirm must appear BEFORE anything is replaced.
    // (evaluate-click, not a real pointer click: the onboarding overlay intercepts pointer
    // events in the file:// lane — same synthetic-input discipline as t41R/t44 specs.)
    await page.evaluate(() => {
      const btn = document.querySelector('#data-snapshot-list .data-snapshot-row .data-snapshot-rollback-btn');
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    const body = await page.evaluate(() => document.getElementById('confirm-body')?.textContent || '');
    expect(body).toMatch(/snapshot/i);               // t44 AC3 precedent: confirm names the snapshot mechanism
    const mid = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map((b) => b.title));
    expect(mid).toEqual(['A', 'B']);                 // nothing replaced while the dialog is open

    await confirmAction(page);

    // Rollback replaces (not merges): B is gone from memory AND the main key
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map((b) => b.title)), { timeout: 5000 }).toEqual(['A']);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('boxingLayout') || 'null'));
    expect(stored.boxes.map((b) => b.title)).toEqual(['A']);
    // A full-replace without a safety snapshot is forbidden (W6-D1): exactly one more snapshot,
    // and the newest body holds the PRE-rollback state A+B with reason 'pre-restore'.
    const snaps = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const list = await dbg.listSnapshots();
      const newest = list[list.length - 1];
      const key = 'snap.v1.' + newest.ts;
      const all = await dbg.storageGet(key);
      return { list, titles: (all[key]?.data?.boxes || []).map((b) => b.title), reason: all[key]?.reason };
    });
    expect(snaps.list.length).toBe(2);
    expect(snaps.list[snaps.list.length - 1].ts).toBeGreaterThan(seed.tsA);
    expect(snaps.titles).toEqual(['A', 'B']);
    expect(snaps.reason).toBe('pre-restore');
    // 41R invariant pinned: the index entry gained NO extra fields (body-only labeling)
    expect(Object.keys(snaps.list[snaps.list.length - 1]).sort()).toEqual(['schemaVersion', 'size', 'ts']);

    // Settings reopens on the data tab and the list refreshes with both rows
    await expect.poll(() => settingsVisible(page), { timeout: 3000 }).toBe(true);
    await expect(snapshotRows(page)).toHaveCount(2);
  });

  test('AC2 dismiss: cancelling the rollback confirm changes nothing and stores nothing', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'L1', type: 'large', title: 'A', x: 0, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] },
      ];
      await dbg.saveLayout();
      await dbg.saveSnapshot();
      dbg.layout.boxes.push(
        { id: 'L2', type: 'large', title: 'B', x: 500, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] },
      );
      await dbg.saveLayout();
    });
    await openSettingsDataTab(page);
    await expect(snapshotRows(page)).toHaveCount(1);
    await snapshotRows(page).first().locator('.data-snapshot-rollback-btn').evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmDismiss(page);
    // dismiss → settings reopens, nothing happened
    await expect.poll(() => settingsVisible(page), { timeout: 3000 }).toBe(true);
    const r = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      return {
        titles: dbg.layout.boxes.map((b) => b.title),
        stored: (JSON.parse(localStorage.getItem('boxingLayout') || 'null').boxes || []).map((b) => b.title),
        snapCount: (await dbg.listSnapshots()).length,
      };
    });
    expect(r.titles).toEqual(['A', 'B']);
    expect(r.stored).toEqual(['A', 'B']);
    expect(r.snapCount).toBe(1); // no safety copy taken for a cancelled rollback
  });

  test('AC3 merge-import takes its pre-restore safety snapshot BEFORE applying', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'L1', type: 'large', title: 'Local Root', x: 0, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] },
      ];
      dbg.layout.nextLargeIndex = 2;
      await dbg.saveLayout();
    });
    const before = await page.evaluate(async () => (await (window as any).__boxingDebug.listSnapshots()).length);
    expect(before).toBe(0);

    // Backup with only a NEW id → merge path, no conflict archiving
    const backup = {
      version: 3.5,
      boxes: [
        { id: 'L9', type: 'large', title: 'Backup New', x: 400, y: 40, width: 320, height: 220, nextSmallIndex: 1, children: [] },
      ],
      connections: [], groups: [],
      _meta: { revision: 7, updatedAt: Date.now() - 1000, writerId: 't50-backup' },
      settings: {},
    };
    await runImport(page, 'backup.json', backup);
    await expect.poll(() => confirmVisible(page), { timeout: 5000 }).toBe(true);
    await confirmAction(page); // 'Merge & import'

    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map((b) => b.title).sort()), { timeout: 5000 }).toEqual(['Backup New', 'Local Root']);
    const after = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const list = await dbg.listSnapshots();
      const newest = list[list.length - 1];
      const key = 'snap.v1.' + newest.ts;
      const all = await dbg.storageGet(key);
      return { count: list.length, titles: (all[key]?.data?.boxes || []).map((b) => b.title), reason: all[key]?.reason };
    });
    expect(after.count).toBe(1);
    expect(after.reason).toBe('pre-restore');
    // The safety copy captured the pre-import canvas — NOT the merged result
    expect(after.titles).toEqual(['Local Root']);
  });
});
