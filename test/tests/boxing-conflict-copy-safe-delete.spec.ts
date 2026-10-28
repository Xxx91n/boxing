// Boxing — ticket 56 (#53 D3): conflict-copy SAFE delete + individual restore.
// AC coverage (the test names below match this list):
//   AC1 delete runs behind a secondary confirm; nothing is written or removed while the
//       dialog is open, and dismissing it changes nothing.
//   AC2 the archived payload itself is saved into the snapshot subsystem BEFORE the archive
//       is deleted; a failed safe save (metadata-only/truncated archive, or a storage error)
//       leaves the original archive in place — a current-layout snapshot is NOT the proof. A
//       delete that fails midway puts the archive body back, so it stays listed and retryable.
//   AC3 the deleted archive is restored individually: the existing conflict list/readout
//       returns the same verbatim payload (same reason, side, size, boxes) under its original
//       ts — unless another archive already occupies that ts, in which case the restore lands
//       elsewhere rather than overwriting it — and the canvas plus any work done after the
//       deletion is not rolled back. A restore the archive cap would prune again, and a safe
//       copy whose body was later pruned, both report failure instead of claiming a success
//       storage cannot back.
//   AC4 a safe copy is never a layout snapshot: it stays out of snap.v1.index, is not listed
//       by Time Machine, and restoreFromSnapshot refuses it (layout rollback does not regress).
//   AC5 safe copies obey the existing rotation/capacity limits — no unbounded store, and
//       guard rotation never prunes layout snapshots.
//   AC6 the fourteen locale key sets stay identical and carry the new strings.
// Lane honesty (#53 T3 / AC7): this drives the file:// mock lane — real UI clicks plus the
// existing storage facade seam — so it proves the behaviour above, NOT the "actual
// dist/boxing-chrome | dist/boxing-firefox extension build" check, which stays open.
// Mutations go through __boxingDebug.storageSet / storageGet / listSnapshots / saveSnapshot /
// restoreFromSnapshot / layout / saveLayout, never window.chrome.storage. alert() is captured
// by patching window.alert (dialog-free), and the two injected-fault cases patch
// Storage.prototype.setItem for one specific key (the guard bodies, then the conflict index)
// and restore it afterwards.
import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const CONFLICT_TS = 1726100000000;
const CONFLICT_PREFIX = 'boxingLayout.conflict.';
const CONFLICT_INDEX_KEY = 'boxingLayout.conflict.index';
const GUARD_PREFIX = 'snap.guard.v1.';
const GUARD_INDEX_KEY = 'snap.guard.v1.index';
// The archived subtree reused from the ticket-44/79 samples (L9 / 'Conflicted Side').
const CONFLICT_RAW = { boxes: [{ id: 'L9', type: 'large', title: 'Conflicted Side', x: 10, y: 10, width: 320, height: 220, nextSmallIndex: 1, children: [] }] };
// archiveConflictLayouts records the size of the ARCHIVED PAYLOAD, so the seed derives it from
// the payload instead of hardcoding a number: a hand-written constant would make the restore's
// "same bytes as before" assertion compare against a shape the real archive path never writes.

async function bootFresh(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__boxingDebug?.saveLayout
      && (window as any).__boxingDebug?.storageSet
      && (window as any).__boxingDebug?.storageGet
      && (window as any).__boxingDebug?.listSnapshots
      && (window as any).__boxingDebug?.restoreFromSnapshot)), { timeout: 10000 }).toBe(true);
}

const openSettingsDataTab = async (page) => {
  await page.evaluate(() => { document.querySelector('#settings-btn')?.click(); });
  await page.evaluate(() => { document.querySelector<HTMLElement>('.settings-nav__item[data-tab="data"]')?.click(); });
};
const confirmVisible = (page) => page.evaluate(() => !document.getElementById('confirm-modal')?.hidden);
const confirmAction = (page) => page.evaluate(() => { document.getElementById('confirm-delete-btn')?.click(); });
const confirmDismiss = (page) => page.evaluate(() => { document.getElementById('confirm-cancel-btn')?.click(); });
const conflictRows = (page) => page.locator('#data-conflict-list .data-conflict-row-item');
const guardRows = (page) => page.locator('#data-conflict-guard-list .data-conflict-guard-row-item');
const snapshotRows = (page) => page.locator('#data-snapshot-list .data-snapshot-row');

const readKey = (page, key) => page.evaluate(async (k) => {
  const got = await (window as any).__boxingDebug.storageGet([k]);
  return got ? got[k] : undefined;
}, key);
const guardIndex = (page) => readKey(page, GUARD_INDEX_KEY);
const conflictIndex = (page) => readKey(page, CONFLICT_INDEX_KEY);

async function seedConflict(page) {
  await page.evaluate(({ prefix, indexKey, ts, raw }) => {
    const dbg = (window as any).__boxingDebug;
    const size = JSON.stringify(raw).length;   // same bytes archiveConflictLayouts would record
    return dbg.storageSet({
      [prefix + ts]: { ts, reason: 'import-merge', side: 'incoming', raw, size, boxes: 1 },
      [indexKey]: [{ ts, reason: 'import-merge', side: 'incoming', size, boxes: 1 }],
    });
  }, { prefix: CONFLICT_PREFIX, indexKey: CONFLICT_INDEX_KEY, ts: CONFLICT_TS, raw: CONFLICT_RAW });
}

async function seedCanvas(page) {
  await page.evaluate(async () => {
    const dbg = (window as any).__boxingDebug;
    dbg.layout.boxes = [
      { id: 'L1', type: 'large', title: 'Kept Box', x: 0, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] },
    ];
    dbg.layout.nextLargeIndex = 2;
    await dbg.saveLayout();
  });
}
const canvasTitles = (page) => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map((b: any) => b.title));
const storedTitles = (page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('boxingLayout') || 'null');
  return s && Array.isArray(s.boxes) ? s.boxes.map((b: any) => b.title) : null;
});

// Alert capture — the fail-closed paths report through alert(), the same copy discipline as
// rollbackNoSafety (ticket 50). Patching keeps the lane free of blocking native dialogs.
async function armAlertCapture(page) {
  await page.evaluate(() => {
    (window as any).__alerts = [];
    window.alert = ((m: any) => { (window as any).__alerts.push(String(m)); }) as any;
  });
}
const alerts = (page) => page.evaluate(() => (window as any).__alerts || []);

// Export-capture precedent (boxing-conflict-copy-readout.spec.ts): capture the blob text and
// the anchor download name without a real download, so the restore is proven through the
// EXISTING readout path rather than by reading storage keys.
async function armExportCapture(page) {
  await page.evaluate(() => {
    (window as any).__cap = { text: null, name: null };
    const origUrl = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => {
      (blob as Blob).text().then((t) => { (window as any).__cap.text = t; });
      return origUrl.call(URL, blob);
    };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download) (window as any).__cap.name = this.download;
      return origClick.apply(this, arguments as any);
    };
  });
}

async function clickDelete(page, ts = CONFLICT_TS) {
  await page.evaluate((wantTs) => {
    const btn = Array.from(document.querySelectorAll('#data-conflict-list .data-conflict-delete-btn'))
      .find((b) => (b as HTMLElement).dataset.ts === String(wantTs));
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, ts);
}
async function clickRestore(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('#data-conflict-guard-list .data-conflict-guard-restore-btn');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

test.describe('Ticket 56 — conflict-copy safe delete + individual restore', () => {

  test('AC1+AC2+AC3+AC4: confirm gates the delete, the archived payload is saved first, and restore returns it without rolling back the canvas', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedCanvas(page);
    await seedConflict(page);
    await armAlertCapture(page);
    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 15000 });
    // Export and Delete share the row (ticket 79 readout stays intact).
    await expect.poll(() => page.evaluate(() =>
      Boolean(document.querySelector('#data-conflict-list .data-conflict-row-item .data-conflict-export-btn')
        && document.querySelector('#data-conflict-list .data-conflict-row-item .data-conflict-delete-btn'))), { timeout: 10000 }).toBe(true);

    // One real layout snapshot exists, so AC4 compares against a non-empty Time Machine list.
    const baseline = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      await dbg.saveSnapshot('pre-restore');
      return { snaps: (await dbg.listSnapshots()).length };
    });
    expect(baseline.snaps).toBe(1);

    // ── AC1: secondary confirm, and nothing happens while it is open ──
    await clickDelete(page);
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    const confirmText = await page.evaluate(() => document.getElementById('confirm-body')?.textContent || '');
    expect(confirmText).toMatch(/safe copy/i);                    // names the protection actually taken
    expect(confirmText).not.toMatch(/current (layout|data)/i);    // NOT the layout-snapshot wording
    expect((await conflictIndex(page))?.length).toBe(1);          // archive untouched while deciding
    expect(await guardIndex(page)).toBeUndefined();               // no safe copy written before the decision
    await confirmDismiss(page);
    expect((await conflictIndex(page))?.length).toBe(1);
    expect(await guardIndex(page)).toBeUndefined();
    expect((await alerts(page))).toEqual([]);

    // ── AC2: confirm → the archived payload lands as a safe copy, then the archive goes ──
    const preDeleteRow = (await conflictIndex(page))[0];
    await clickDelete(page);
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmAction(page);
    await expect.poll(async () => (await guardIndex(page))?.length, { timeout: 8000 }).toBe(1);
    const guards = await guardIndex(page);
    const guardTs = guards[0].ts;
    expect(guards[0].originTs).toBe(CONFLICT_TS);                 // identifies what it protects
    const guardBody = await readKey(page, GUARD_PREFIX + guardTs);
    expect(JSON.stringify(guardBody.raw)).toBe(JSON.stringify(CONFLICT_RAW)); // verbatim payload
    expect(guardBody.reason).toBe('import-merge');
    expect(guardBody.size).toBe(JSON.stringify(CONFLICT_RAW).length); // payload bytes, not envelope
    expect((await conflictIndex(page))?.length).toBe(0);          // deleted only after the save succeeded
    expect(await readKey(page, CONFLICT_PREFIX + CONFLICT_TS)).toBeUndefined();
    expect((await alerts(page))).toEqual([]);                     // no failure notice on the happy path

    // ── AC4: the safe copy is not a layout snapshot ──
    const snapshotView = await page.evaluate(async (ts) => {
      const dbg = (window as any).__boxingDebug;
      const list = await dbg.listSnapshots();
      return { count: list.length, hasGuardRow: list.some((e: any) => e.ts === ts) };
    }, guardTs);
    expect(snapshotView.count).toBe(baseline.snaps);              // snap.v1.index unchanged by the guard
    expect(snapshotView.hasGuardRow).toBe(false);                 // never offered to Time Machine
    // Handing a non-layout archive to the layout restore path must yield nothing, not a canvas.
    expect(await page.evaluate((ts) => (window as any).__boxingDebug.restoreFromSnapshot(ts), guardTs)).toBeNull();
    expect(await canvasTitles(page)).toEqual(['Kept Box']);       // delete did not rewrite the canvas
    expect(await storedTitles(page)).toEqual(['Kept Box']);
    await expect(guardRows(page)).toHaveCount(1, { timeout: 10000 });
    await expect(snapshotRows(page)).toHaveCount(1);

    // ── AC3: work happens after the deletion, then the archive is restored on its own ──
    await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes.push({ id: 'L2', type: 'large', title: 'Later Work', x: 500, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] });
      await dbg.saveLayout();
    });
    await clickRestore(page);
    await expect.poll(async () => (await conflictIndex(page))?.length, { timeout: 8000 }).toBe(1);
    const restoredRow = (await conflictIndex(page))[0];
    expect(restoredRow.ts).toBe(CONFLICT_TS);                     // original archive identity kept
    expect(restoredRow.reason).toBe('import-merge');
    expect(restoredRow.side).toBe('incoming');
    expect(restoredRow.size).toBe(preDeleteRow.size);             // row metadata survives unchanged
    expect(restoredRow.boxes).toBe(preDeleteRow.boxes);
    const restoredBody = await readKey(page, CONFLICT_PREFIX + CONFLICT_TS);
    expect(JSON.stringify(restoredBody.raw)).toBe(JSON.stringify(CONFLICT_RAW)); // readout returns the original text
    expect(restoredBody.size).toBe(preDeleteRow.size);            // same bytes shown before and after
    // Prove it through the EXISTING readout: the per-row export downloads the archived entry
    // verbatim, which is what "恢复后可通过现有冲突列表／读取能力取得原文" actually promises.
    // Wait for the row to be painted first — the storage poll above says nothing about the
    // asynchronous refreshDataHealth render (readout-spec precedent).
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 15000 });
    await armExportCapture(page);
    await page.evaluate(() => {
      const btn = document.querySelector('#data-conflict-list .data-conflict-row-item .data-conflict-export-btn');
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__cap?.text)), { timeout: 8000 }).toBe(true);
    const cap = await page.evaluate(() => ({ text: (window as any).__cap.text, name: (window as any).__cap.name }));
    expect(cap.name).toBe('boxing-conflict-' + CONFLICT_TS + '.json');
    expect(JSON.parse(cap.text).raw).toEqual(CONFLICT_RAW);
    expect(await canvasTitles(page)).toEqual(['Kept Box', 'Later Work']);  // canvas + later work intact
    expect(await storedTitles(page)).toEqual(['Kept Box', 'Later Work']);
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 10000 });
    await expect(snapshotRows(page)).toHaveCount(1);              // restore is not a rollback

    // ── AC6 tail: with a guard store present, the existing layout rollback still works ──
    // Same row/confirm surface the ticket-50 spec drives. Rolling back to the baseline
    // snapshot must replace the canvas (that IS what a rollback does) while leaving the
    // restored archive and its safe copy listed — the two paths stay distinguishable.
    await page.evaluate(() => {
      const btn = document.querySelector('#data-snapshot-list .data-snapshot-row .data-snapshot-rollback-btn');
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmAction(page);
    await expect.poll(() => canvasTitles(page), { timeout: 5000 }).toEqual(['Kept Box']);
    const rollback = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const list = await dbg.listSnapshots();
      const newest = list[list.length - 1];
      const all = await dbg.storageGet('snap.v1.' + newest.ts);
      return { count: list.length, reason: all?.['snap.v1.' + newest.ts]?.reason };
    });
    expect(rollback.reason).toBe('pre-restore');                  // rollback safety copy still taken
    expect(rollback.count).toBe(2);
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 10000 });  // archives untouched by rollback
    await expect(guardRows(page)).toHaveCount(1, { timeout: 10000 });
    expect(await storedTitles(page)).toEqual(['Kept Box']);
  });

  test('AC2-fail: a metadata-only (truncated) archive is refused as a safe copy, so nothing is deleted', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedCanvas(page);
    await page.evaluate(({ prefix, indexKey, ts }) => {
      const dbg = (window as any).__boxingDebug;
      return dbg.storageSet({
        [prefix + ts]: { ts, reason: 'import-merge', side: 'incoming', truncated: true, size: 3000000 },
        [indexKey]: [{ ts, reason: 'import-merge', side: 'incoming', size: 3000000, boxes: 1, truncated: true }],
      });
    }, { prefix: CONFLICT_PREFIX, indexKey: CONFLICT_INDEX_KEY, ts: CONFLICT_TS });
    await armAlertCapture(page);
    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 15000 });

    await clickDelete(page);
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmAction(page);
    await expect.poll(async () => (await alerts(page)).length, { timeout: 8000 }).toBe(1);
    expect((await alerts(page))[0]).toMatch(/safe copy/i);
    expect((await alerts(page))[0]).toMatch(/nothing was deleted/i);
    const idx = await conflictIndex(page);
    expect(idx.length).toBe(1);                                   // original archive still present
    expect(idx[0].ts).toBe(CONFLICT_TS);
    expect(await readKey(page, CONFLICT_PREFIX + CONFLICT_TS)).toBeTruthy();
    expect(await guardIndex(page)).toBeUndefined();               // no partial safe copy recorded
    await expect(guardRows(page)).toHaveCount(0);
    expect(await canvasTitles(page)).toEqual(['Kept Box']);
  });

  test('AC2-fail: a storage failure while saving the safe copy aborts the delete and changes nothing', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedCanvas(page);
    await seedConflict(page);
    await armAlertCapture(page);
    // Fail only the guard keys, so the injected fault cannot masquerade as a general outage.
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      (window as any).__restoreSetItem = () => { Storage.prototype.setItem = orig; };
      Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
        if (String(k).startsWith('bxstore:snap.guard.v1.')) throw new Error('QuotaExceeded (injected)');
        return orig.apply(this, [k, v] as any);
      };
    });
    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 15000 });

    await clickDelete(page);
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmAction(page);
    await expect.poll(async () => (await alerts(page)).length, { timeout: 8000 }).toBe(1);
    expect((await alerts(page))[0]).toMatch(/nothing was deleted/i);
    const idx = await conflictIndex(page);
    expect(idx.length).toBe(1);                                   // save failed → the archive stays
    expect(idx[0].ts).toBe(CONFLICT_TS);
    expect(await readKey(page, CONFLICT_PREFIX + CONFLICT_TS)).toBeTruthy();
    expect(await guardIndex(page)).toBeUndefined();
    expect(await canvasTitles(page)).toEqual(['Kept Box']);
    await page.evaluate(() => (window as any).__restoreSetItem());
  });

  test('AC3-fail: a restore the archive cap would prune immediately reports failure and loses nothing else', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedCanvas(page);
    // The conflict store is full (MAX_CONFLICT_ARCHIVES = 20, all NEWER than the archived
    // copy this safe copy protects), so the row the restore writes is the oldest and the cap
    // drops it again. The facade must return null — a success the storage cannot back would
    // leave the UI claiming a restored archive that the readout cannot actually list.
    await page.evaluate(({ prefix, indexKey, guardPrefix, guardIndexKey, count, raw }) => {
      const dbg = (window as any).__boxingDebug;
      const rows = [];
      const payload: Record<string, unknown> = {};
      for (let i = 0; i < count; i++) {
        const ts = 1000 + i;
        rows.push({ ts, reason: 'import-merge', side: 'incoming', size: 40, boxes: 1, truncated: false });
        payload[prefix + ts] = { ts, reason: 'import-merge', side: 'incoming', raw: { boxes: [] }, size: 40, boxes: 1 };
      }
      payload[indexKey] = rows;
      payload[guardIndexKey] = [{ ts: 5000, originTs: 100, size: 200 }];
      payload[guardPrefix + 5000] = {
        ts: 5000, originTs: 100, reason: 'import-merge', side: 'incoming', raw, size: 200, boxes: 1,
      };
      return dbg.storageSet(payload);
    }, {
      prefix: CONFLICT_PREFIX, indexKey: CONFLICT_INDEX_KEY,
      guardPrefix: GUARD_PREFIX, guardIndexKey: GUARD_INDEX_KEY, count: 20, raw: CONFLICT_RAW,
    });
    await armAlertCapture(page);
    await openSettingsDataTab(page);
    await expect(guardRows(page)).toHaveCount(1, { timeout: 15000 });

    await clickRestore(page);
    await expect.poll(async () => (await alerts(page)).length, { timeout: 8000 }).toBe(1);
    expect((await alerts(page))[0]).toMatch(/could not be restored/i);
    const idx = await conflictIndex(page);
    expect(idx.length).toBe(20);                                   // no row was lost either way
    expect(idx.some(e => e.ts === 100)).toBe(false);               // the self-pruned restore is not claimed
    expect(idx.map(e => e.ts).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => 1000 + i));
    expect(await canvasTitles(page)).toEqual(['Kept Box']);         // and still no canvas change
    await expect(guardRows(page)).toHaveCount(1, { timeout: 10000 }); // the safe copy survives a retry
  });

  test('AC2-fail: a failed index write puts the archive back and reclaims the unused safe copy', async ({ page }) => {
    test.setTimeout(60000);
    await bootFresh(page);
    await seedCanvas(page);
    await seedConflict(page);
    await armAlertCapture(page);
    // Fail ONLY the conflict index write, and only once: the safe copy lands, the body key is
    // removed, then the index write throws. Record every key written afterwards so the
    // put-back is observable rather than inferred from "the file is still there".
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      const w = window as any;
      w.__faulted = false;
      w.__writes = [];
      w.__restoreSetItem = () => { Storage.prototype.setItem = orig; };
      Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
        if (!w.__faulted && String(k) === 'bxstore:boxingLayout.conflict.index') {
          w.__faulted = true;
          throw new Error('QuotaExceeded (injected)');
        }
        if (w.__faulted) w.__writes.push(String(k));
        return orig.apply(this, [k, v] as any);
      };
    });
    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 15000 });

    await clickDelete(page);
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmAction(page);
    await expect.poll(async () => (await alerts(page)).length, { timeout: 8000 }).toBe(1);
    expect((await alerts(page))[0]).toMatch(/did not complete/i);
    const idx = await conflictIndex(page);
    expect(idx.length).toBe(1);                                   // row still listed
    expect(idx[0].ts).toBe(CONFLICT_TS);
    const writes = await page.evaluate(() => (window as any).__writes);
    expect(writes).toContain('bxstore:' + CONFLICT_PREFIX + CONFLICT_TS);  // the body was put back
    const survived = await readKey(page, CONFLICT_PREFIX + CONFLICT_TS);
    expect(JSON.stringify(survived.raw)).toBe(JSON.stringify(CONFLICT_RAW)); // and is readable
    // The safe copy that protected nothing is reclaimed instead of piling up in the store.
    expect((await guardIndex(page))?.length ?? 0).toBe(0);
    await expect(guardRows(page)).toHaveCount(0, { timeout: 10000 });
    expect(await canvasTitles(page)).toEqual(['Kept Box']);

    // Clear the fault and retry the same row: the delete now completes.
    await page.evaluate(() => (window as any).__restoreSetItem());
    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 15000 });
    await clickDelete(page);
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmAction(page);
    await expect.poll(async () => (await guardIndex(page))?.length, { timeout: 8000 }).toBe(1);
    expect((await conflictIndex(page))?.length ?? 0).toBe(0);
    expect(await readKey(page, CONFLICT_PREFIX + CONFLICT_TS)).toBeUndefined();
    expect((await alerts(page)).length).toBe(1);                  // no second failure notice
    await expect(guardRows(page)).toHaveCount(1, { timeout: 15000 });
  });

  test('AC2-fail: an archived payload that is literally null cannot be protected, so it is not deleted', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedCanvas(page);
    await page.evaluate(({ prefix, indexKey, ts }) => (window as any).__boxingDebug.storageSet({
      [prefix + ts]: { ts, reason: 'import-merge', side: 'incoming', raw: null, size: 4, boxes: 0 },
      [indexKey]: [{ ts, reason: 'import-merge', side: 'incoming', size: 4, boxes: 0, truncated: false }],
    }), { prefix: CONFLICT_PREFIX, indexKey: CONFLICT_INDEX_KEY, ts: CONFLICT_TS });
    await armAlertCapture(page);
    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1, { timeout: 15000 });

    await clickDelete(page);
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmAction(page);
    await expect.poll(async () => (await alerts(page)).length, { timeout: 8000 }).toBe(1);
    expect((await alerts(page))[0]).toMatch(/nothing was deleted/i);
    // A null raw once passed the "verbatim payload exists" test, so the archive was deleted and
    // the restore threw on it forever — the one copy gone with a green "safe copy saved" path.
    expect((await conflictIndex(page))?.length).toBe(1);
    expect(await readKey(page, CONFLICT_PREFIX + CONFLICT_TS)).toBeTruthy();
    expect(await guardIndex(page)).toBeUndefined();
    expect(await canvasTitles(page)).toEqual(['Kept Box']);
  });

  test('AC3-fail: a safe copy whose body was later pruned reports failure instead of fabricating an archive', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedCanvas(page);
    // The guard index outlives its body exactly the way the snapshot index can outlive a
    // pruned snapshot body (#53 N2: a safe copy is not promised to survive forever).
    await page.evaluate(({ guardIndexKey, guardTs, originTs }) => (window as any).__boxingDebug.storageSet({
      [guardIndexKey]: [{ ts: guardTs, originTs, size: 200 }],
    }), { guardIndexKey: GUARD_INDEX_KEY, guardTs: 6000, originTs: CONFLICT_TS });
    await armAlertCapture(page);
    await openSettingsDataTab(page);
    await expect(guardRows(page)).toHaveCount(1, { timeout: 15000 });   // row lists from the index

    await clickRestore(page);
    await expect.poll(async () => (await alerts(page)).length, { timeout: 8000 }).toBe(1);
    expect((await alerts(page))[0]).toMatch(/could not be restored/i);
    expect(await conflictIndex(page)).toBeUndefined();                  // no archive invented
    expect(await readKey(page, CONFLICT_PREFIX + CONFLICT_TS)).toBeUndefined();
    expect(await canvasTitles(page)).toEqual(['Kept Box']);             // and still no canvas change
  });

  test('AC5: the safe-copy store is bounded by the existing rotation cap and never prunes layout snapshots', async ({ page }) => {
    test.setTimeout(60000);
    await bootFresh(page);
    await seedCanvas(page);
    // Fill the safe-copy store to the conflict archive's own count cap (20) with ancient rows,
    // then protect one more archive: the oldest safe copy (row + body) must be pruned instead
    // of the store growing.
    await page.evaluate(async ({ prefix, indexKey, ts, raw, guardPrefix, guardIndexKey, count }) => {
      const dbg = (window as any).__boxingDebug;
      const rows = [];
      for (let i = 0; i < count; i++) rows.push({ ts: 1000 + i, originTs: 1000 + i, size: 40 });
      const size = JSON.stringify(raw).length;
      const payload: Record<string, unknown> = {
        [prefix + ts]: { ts, reason: 'import-merge', side: 'incoming', raw, size, boxes: 1 },
        [indexKey]: [{ ts, reason: 'import-merge', side: 'incoming', size, boxes: 1 }],
        [guardIndexKey]: rows,
      };
      for (let i = 0; i < count; i++) {
        payload[guardPrefix + (1000 + i)] = { ts: 1000 + i, originTs: 1000 + i, reason: 'seed', side: 'seed', raw: { boxes: [] }, size: 40 };
      }
      await dbg.storageSet(payload);
    }, {
      prefix: CONFLICT_PREFIX, indexKey: CONFLICT_INDEX_KEY, ts: CONFLICT_TS, raw: CONFLICT_RAW,
      guardPrefix: GUARD_PREFIX, guardIndexKey: GUARD_INDEX_KEY, count: 20,
    });

    const snapsBefore = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      // Seed a non-empty snapshot list first: comparing 0 against 0 would prove nothing about
      // guard rotation leaving layout snapshots alone.
      await dbg.saveSnapshot('seed-a');
      await dbg.saveSnapshot('seed-b');
      return (await dbg.listSnapshots()).length;
    });
    expect(snapsBefore).toBe(2);
    await openSettingsDataTab(page);
    await expect(snapshotRows(page)).toHaveCount(2, { timeout: 15000 });
    await expect(guardRows(page)).toHaveCount(20, { timeout: 15000 });

    await clickDelete(page);
    await expect.poll(() => confirmVisible(page), { timeout: 3000 }).toBe(true);
    await confirmAction(page);
    await expect.poll(async () => (await guardIndex(page))?.length, { timeout: 10000 }).toBe(20);
    const guards = await guardIndex(page);
    expect(guards.some(e => e.originTs === CONFLICT_TS)).toBe(true);   // newest survives
    expect(guards.some(e => e.ts === 1000)).toBe(false);               // oldest dropped by the cap
    expect(await readKey(page, GUARD_PREFIX + 1000)).toBeUndefined();     // its body went with the row
    expect(await readKey(page, GUARD_PREFIX + 1019)).toBeTruthy();      // the rest stay readable
    expect((await conflictIndex(page))?.length).toBe(0);
    await expect(guardRows(page)).toHaveCount(20, { timeout: 15000 });
    const snapsAfter = await page.evaluate(async () => (await (window as any).__boxingDebug.listSnapshots()).length);
    expect(snapsAfter).toBe(snapsBefore);   // guard rotation never touches the snapshot index
  });

  test('AC6: the fourteen locale key sets stay identical and cover the new strings', () => {
    const localesDir = path.join(ROOT_DIR, '_locales');
    const langs = fs.readdirSync(localesDir).filter(f => fs.statSync(path.join(localesDir, f)).isDirectory());
    expect(langs.length).toBe(14);
    const enKeys = Object.keys(JSON.parse(fs.readFileSync(path.join(localesDir, 'en', 'messages.json'), 'utf8')));
    const needed = [
      'dataConflictDeleteBtn', 'dataConflictGuardList', 'dataConflictGuardArchived',
      'dataConflictGuardRestoreBtn', 'conflictDeleteConfirmTitle', 'conflictDeleteConfirmBody',
      'conflictDeleteConfirmAction', 'conflictDeleteNoSafety', 'conflictDeleteFailed', 'conflictGuardRestoreFailed',
    ];
    for (const lang of langs) {
      const msgs = JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'messages.json'), 'utf8'));
      for (const key of needed) {
        expect(msgs[key], `Missing ${key} in _locales/${lang}/messages.json`).toBeDefined();
        expect(msgs[key].message.length, `Empty message ${key} in ${lang}`).toBeGreaterThan(0);
      }
      expect(Object.keys(msgs).filter(k => !enKeys.includes(k)), `Key drift in ${lang}`).toEqual([]);
      expect(enKeys.filter(k => !Object.keys(msgs).includes(k)), `Missing baseline keys in ${lang}`).toEqual([]);
      const body = msgs.conflictDeleteConfirmBody;
      expect(body.placeholders?.point?.content).toBe('$1');
      expect(body.message).toContain('$point$');
    }
    const fallbackSrc = fs.readFileSync(path.join(ROOT_DIR, 'ntp', 'i18n.js'), 'utf8');
    for (const key of needed) expect(fallbackSrc, `I18N_FALLBACK.${key}`).toContain(`I18N_FALLBACK.${key} = `);
  });

});
