// Ticket 41R — split-key snapshot storage acceptance tests (rewritten after brain review
// reports/45R-wave5-w1-brain-review.md declared ticket 41's spec FAIL: it never called the
// snapshot API and poked window.chrome.storage, which the file:// lane does not expose).
// Seam: __boxingDebug.saveSnapshot / listSnapshots / restoreFromSnapshot + storageGet/Set
// (AGENTS.md SEC-01: the file:// mock stays local and specs must NOT use chrome.storage there).
import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

const SNAP_INDEX_KEY = 'snap.v1.index';
const SNAP_KEY_PREFIX = 'snap.v1.';

async function resetBoxing(page: import('@playwright/test').Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Readiness = the 41R seam itself (not just __boxingDebug): the snapshot API must be live.
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__boxingDebug?.listSnapshots
      && (window as any).__boxingDebug?.saveSnapshot
      && (window as any).__boxingDebug?.restoreFromSnapshot
      && (window as any).__boxingDebug?.storageGet)), { timeout: 10000 }).toBe(true);
}

test.describe('Snapshot split-key storage + rotation (Ticket 41R)', () => {

  test('saveSnapshot writes one key per snapshot; listSnapshots returns metadata-only index', async ({ page }) => {
    test.setTimeout(30000);
    await resetBoxing(page);
    const r = await page.evaluate(async ({ prefix, indexKey }) => {
      const dbg = (window as any).__boxingDebug;
      const before = await dbg.listSnapshots();
      // Seed a box so each snapshot carries distinguishable payload, then save two snapshots.
      dbg.layout.boxes = [{ id: 'L1', type: 'large', title: 'first', x: 0, y: 0, width: 320, height: 220, children: [] }];
      dbg.layout.nextLargeIndex = 2;
      await dbg.saveLayout();
      await dbg.saveSnapshot();
      dbg.layout.boxes.push({ id: 'L2', type: 'large', title: 'second', x: 500, y: 0, width: 320, height: 220, children: [] });
      await dbg.saveLayout();
      await dbg.saveSnapshot();
      const after = await dbg.listSnapshots();
      const all = await dbg.storageGet(null);
      const bodyKeys = Object.keys(all).filter(k => k.startsWith(prefix) && k !== indexKey).sort();
      return {
        beforeCount: before.length,
        afterCount: after.length,
        bodyKeys,
        indexFields: Object.keys(after[after.length - 1] || {}).sort(),
        indexHasPayload: after.some(e => 'data' in e),
        hasMonolith: 'boxingSnapshots' in all,
        // each index ts has exactly one dedicated body key
        bodiesMatchIndex: after.every(e => bodyKeys.includes(prefix + e.ts)),
        bodyPayloadIsolated: bodyKeys.every(k => Array.isArray(all[k]?.data?.boxes) && all[k].data.boxes.length > 0),
      };
    }, { prefix: SNAP_KEY_PREFIX, indexKey: SNAP_INDEX_KEY });
    console.log('T41R-1:', JSON.stringify(r));
    expect(r.beforeCount).toBe(0);            // fresh profile starts empty
    expect(r.afterCount).toBeGreaterThanOrEqual(2); // ADR-0009 floor keeps same-hour entries
    expect(r.bodyKeys.length).toBeGreaterThanOrEqual(2); // one key per snapshot
    expect(r.indexFields).toEqual(['schemaVersion', 'size', 'ts']); // index is metadata-only
    expect(r.indexHasPayload).toBe(false);
    expect(r.hasMonolith).toBe(false);        // no giant boxingSnapshots[] master key
    expect(r.bodiesMatchIndex).toBe(true);
    expect(r.bodyPayloadIsolated).toBe(true);
  });

  test('restoreFromSnapshot returns the layout captured at that ts (not the latest)', async ({ page }) => {
    test.setTimeout(30000);
    await resetBoxing(page);
    const r = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{ id: 'L1', type: 'large', title: 'A', x: 0, y: 0, width: 320, height: 220, children: [] }];
      dbg.layout.nextLargeIndex = 2;
      await dbg.saveLayout();
      await dbg.saveSnapshot();
      const snaps1 = await dbg.listSnapshots();
      const ts1 = snaps1[snaps1.length - 1].ts;
      dbg.layout.boxes.push({ id: 'L2', type: 'large', title: 'B', x: 500, y: 0, width: 320, height: 220, children: [] });
      await dbg.saveLayout();
      await dbg.saveSnapshot();
      const restored = await dbg.restoreFromSnapshot(ts1);
      const missing = await dbg.restoreFromSnapshot(ts1 + 12345); // ts with no body key
      return {
        ts1,
        restoredTitles: restored ? restored.boxes.map((b: any) => b.title) : null,
        restoredMigrated: restored ? typeof restored.settings === 'object' : false,
        missing: missing === null,
      };
    });
    console.log('T41R-2:', JSON.stringify(r));
    expect(r.restoredTitles).toEqual(['A']);   // the snapshot taken BEFORE box B existed
    expect(r.restoredMigrated).toBe(true);     // returns migrateLayout-normalized data
    expect(r.missing).toBe(true);              // unknown ts → null, no throw
  });

  test('tier rotation dedups same-hour entries beyond the RAW_KEEP_FLOOR and prunes orphan bodies', async ({ page }) => {
    test.setTimeout(30000);
    await resetBoxing(page);
    const r = await page.evaluate(async ({ prefix, indexKey }) => {
      const dbg = (window as any).__boxingDebug;
      // Seed 13 entries in ONE hour bucket: ts is pinned to the middle of the hour bucket
      // containing (now-2h) so ±6s of seeding can never straddle the bucket boundary. Beyond
      // the floor of 10 the 4 oldest must collapse to 1 per bucket (tsList[3] survives).
      const now = Date.now();
      const bucketMid = Math.floor((now - 2 * 3600_000) / 3600_000) * 3600_000 + 1800_000;
      const tsList: number[] = [];
      for (let i = 0; i < 13; i++) { const ts = bucketMid + i * 1000; tsList.push(ts); }
      const mkBody = (ts: number) => ({
        ts, schemaVersion: 3,
        data: { version: 3.5, boxes: [{ id: 'L1', type: 'large', title: 'S' + ts, x: 0, y: 0, width: 320, height: 220, children: [] }], nextLargeIndex: 2, settings: {} },
      });
      const seed: Record<string, unknown> = {
        [indexKey]: tsList.map(ts => ({ ts, schemaVersion: 3, size: 1000 })),
      };
      for (const ts of tsList) seed[prefix + ts] = mkBody(ts);
      await dbg.storageSet(seed);
      await dbg.saveSnapshot(); // triggers rotation: 13 seeded + 1 new = 14 → floor(10) + dedup(4→1) = 11
      const list = await dbg.listSnapshots();
      const all = await dbg.storageGet(null);
      const bodyKeys = Object.keys(all).filter(k => k.startsWith(prefix) && k !== indexKey);
      return {
        count: list.length,
        keptTs: list.map((e: any) => e.ts),
        seededNewest: tsList[12],
        prunedOldest: [tsList[0], tsList[1], tsList[2]].map(ts => bodyKeys.includes(prefix + ts)),
        dedupSurvivor: bodyKeys.includes(prefix + tsList[3]),
        bodiesAreSubsetOfIndex: bodyKeys.every(k => list.some((e: any) => prefix + e.ts === k)),
      };
    }, { prefix: SNAP_KEY_PREFIX, indexKey: SNAP_INDEX_KEY });
    console.log('T41R-3:', JSON.stringify(r));
    expect(r.count).toBe(11);                  // 10 floor + 1 deduped from the 3 beyond the floor
    expect(r.prunedOldest).toEqual([false, false, false]); // orphaned body keys removed from storage
    expect(r.dedupSurvivor).toBe(true);        // newest-per-bucket survives dedup
    expect(r.bodiesAreSubsetOfIndex).toBe(true); // no body key exists that the index doesn't list
  });

  test('boot migration: seeded legacy boxingSnapshots[] splits into keys and the monolith is removed', async ({ page }) => {
    test.setTimeout(30000);
    await resetBoxing(page);
    // Seed the OLD monolithic layout into the mock storage, then reload — the loadLayout
    // boot path must run _migrateSnapshots (41R AC7: migration is on the boot path, the
    // upgrade profile splits even if no snapshot API is ever called manually).
    const seeded = await page.evaluate(async ({ prefix }) => {
      const dbg = (window as any).__boxingDebug;
      const now = Date.now();
      const mkBody = (ts: number) => ({
        ts, schemaVersion: 3,
        data: { version: 3.5, boxes: [{ id: 'L1', type: 'large', title: 'S' + ts, x: 0, y: 0, width: 320, height: 220, children: [] }], nextLargeIndex: 2, settings: {} },
      });
      const legacy = [mkBody(now - 3600_000), mkBody(now - 7200_000)];
      await dbg.storageSet({ boxingSnapshots: legacy });
      const check = await dbg.storageGet('boxingSnapshots');
      return { stored: Array.isArray(check.boxingSnapshots) && check.boxingSnapshots.length === 2 };
    }, { prefix: SNAP_KEY_PREFIX });
    expect(seeded.stored).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.listSnapshots)), { timeout: 10000 }).toBe(true);
    const r = await page.evaluate(async ({ prefix, indexKey }) => {
      const dbg = (window as any).__boxingDebug;
      const list = await dbg.listSnapshots();
      const all = await dbg.storageGet(null);
      const bodyKeys = Object.keys(all).filter(k => k.startsWith(prefix) && k !== indexKey).sort();
      return {
        count: list.length,
        hasMonolith: 'boxingSnapshots' in all,
        bodyKeys,
        bodiesMatchIndex: list.length > 0 && list.every((e: any) => bodyKeys.includes(prefix + e.ts)),
        payloadsReadable: list.every((e: any) => Array.isArray(all[prefix + e.ts]?.data?.boxes) && all[prefix + e.ts].data.boxes.length === 1),
      };
    }, { prefix: SNAP_KEY_PREFIX, indexKey: SNAP_INDEX_KEY });
    console.log('T41R-4:', JSON.stringify(r));
    expect(r.count).toBe(2);                   // both legacy entries migrated into the index
    expect(r.hasMonolith).toBe(false);         // monolith removed (AC1)
    expect(r.bodyKeys.length).toBe(2);         // split keys per snapshot
    expect(r.bodiesMatchIndex).toBe(true);
    expect(r.payloadsReadable).toBe(true);     // bodies survived the JSON round-trip intact
  });
});
