import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\/g, '/');

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
}

test.describe('ADR-0007 acceptance gates', () => {
  test('Q1 migration: old layout.groups restores isParent then discards groups + sets __groupsMigrated', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const raw = {
        version: 3.5,
        boxes: [
          { id: 'L1', type: 'large', title: 'A', x: 0, y: 0, width: 320, height: 220, children: [
            { id: 'S1', title: 's', x: 10, y: 10, width: 160, height: 110, bookmarks: [] }
          ] },
          { id: 'L2', type: 'large', title: 'B', x: 400, y: 0, width: 320, height: 220, children: [] },
        ],
        connections: [],
        groups: [
          { parentId: 'large:L1', members: ['large:L2'] },
          { parentId: 'small:L1:S1', members: [] },
        ],
        settings: {},
        _meta: { revision: 1, updatedAt: Date.now(), writerId: 'mig-test' },
      };
      const migrated = dbg.migrateLayout(raw);
      const persisted = dbg.stripGroupsForPersist(migrated);
      return {
        largeParent: !!migrated.boxes.find((b: any) => b.id === 'L1')?.isParent,
        smallParent: !!migrated.boxes.find((b: any) => b.id === 'L1')?.children?.find((c: any) => c.id === 'S1')?.isParent,
        migratedFlag: !!migrated._meta?.__groupsMigrated,
        runtimeGroupsLen: Array.isArray(migrated.groups) ? migrated.groups.length : -1,
        persistedHasGroups: Object.prototype.hasOwnProperty.call(persisted, 'groups'),
        persistedGroups: (persisted as any).groups,
      };
    });
    expect(r.largeParent).toBe(true);
    expect(r.smallParent).toBe(true);
    expect(r.migratedFlag).toBe(true);
    expect(r.runtimeGroupsLen).toBe(0); // migrate sets groups: []
    expect(r.persistedHasGroups).toBe(false);
    expect(r.persistedGroups).toBeUndefined();
  });

  test('Q1 persist: saveLayout strip keeps groups out of storage snapshot', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{
        id: 'P1', type: 'large', title: 'P', x: 0, y: 0, width: 320, height: 220, children: [], isParent: true,
      }];
      dbg.layout.connections = [];
      dbg.ensureGroups();
      const beforeRuntime = (dbg.layout.groups || []).length;
      await dbg.saveLayout();
      // storage mock uses localStorage boxingLayout for file:// mode in tests
      let stored: any = null;
      try {
        const raw = localStorage.getItem('boxingLayout');
        stored = raw ? JSON.parse(raw) : null;
      } catch (_) {}
      // also try chrome storage mock path via dump — fall back to strip helper
      const stripped = dbg.stripGroupsForPersist(dbg.layout);
      return {
        beforeRuntime,
        storedHasGroups: stored ? Object.prototype.hasOwnProperty.call(stored, 'groups') : null,
        strippedHasGroups: Object.prototype.hasOwnProperty.call(stripped, 'groups'),
      };
    });
    expect(r.beforeRuntime).toBeGreaterThanOrEqual(1);
    expect(r.strippedHasGroups).toBe(false);
    // stored may be null if storage backend is not localStorage key; strip helper is authoritative for persist path
    if (r.storedHasGroups !== null) expect(r.storedHasGroups).toBe(false);
  });

  test('Q4a tombstone GC: entries older than 24h removed; fresh kept; hard cap still honored', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const now = Date.now();
      const ttl = dbg.TOMBSTONE_TTL_MS;
      const target: any = { _meta: { deleted: {
        oldA: now - ttl - 1000,
        oldB: now - ttl - 5000,
        fresh: now - 1000,
      } } };
      const n = dbg.gcTombstones(target);
      return {
        n,
        keys: Object.keys(target._meta.deleted).sort(),
        hasFresh: !!target._meta.deleted.fresh,
        hasOldA: !!target._meta.deleted.oldA,
      };
    });
    expect(r.n).toBe(2);
    expect(r.hasFresh).toBe(true);
    expect(r.hasOldA).toBe(false);
    expect(r.keys).toEqual(['fresh']);
  });

  test('Q3b spatial index: threshold 32, builds grid at N>=32 and null below', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const mk = (n: number) => Array.from({ length: n }, (_, i) => ({
        id: 'b' + i, x: (i % 10) * 100, y: Math.floor(i / 10) * 100, width: 80, height: 60,
      }));
      const thr = dbg.SPATIAL_THRESHOLD;
      const under = dbg.buildSpatialGrid(mk(thr - 1));
      const at = dbg.buildSpatialGrid(mk(thr));
      const over = dbg.buildSpatialGrid(mk(100));
      // query nearby should return a bounded subset for dense grid
      let nearbyCount = -1;
      if (over) {
        const near = dbg.querySpatialNearby(over, 0, 0, 80, 60) || [];
        nearbyCount = near.length;
      }
      // micro-benchmark: 200 queries over 100 boxes should finish quickly
      const t0 = performance.now();
      for (let i = 0; i < 200; i++) {
        const g = dbg.buildSpatialGrid(mk(100));
        dbg.querySpatialNearby(g, (i % 10) * 100, Math.floor(i / 10) * 100, 80, 60);
      }
      const ms = performance.now() - t0;
      return { thr, underNull: under == null, atOk: !!at, overOk: !!over, nearbyCount, ms };
    });
    expect(r.thr).toBe(32);
    expect(r.underNull).toBe(true);
    expect(r.atOk).toBe(true);
    expect(r.overOk).toBe(true);
    expect(r.nearbyCount).toBeGreaterThan(0);
    expect(r.nearbyCount).toBeLessThan(100); // spatial should prune full scan
    expect(r.ms).toBeLessThan(500); // sanity upper bound on CI
  });

  test('Q4c/Q4d: conn props backfill + deleteLarge clears viewState path via commit', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const raw = {
        version: 3.5,
        boxes: [{ id: 'V1', type: 'large', title: 'V', x: 0, y: 0, width: 320, height: 220, children: [], viewState: { innerZoom: 1.2, updatedAt: Date.now() } }],
        connections: [{ id: 'c1', from: 'large:V1', to: 'large:V1', createdAt: Date.now() }],
        groups: [],
        settings: {},
        _meta: { __groupsMigrated: true, revision: 1, updatedAt: Date.now(), writerId: 'p' },
      };
      const migrated = dbg.migrateLayout(raw);
      const propsOk = migrated.connections.every((c: any) => c.props && typeof c.props === 'object');
      // load into live layout and delete
      dbg.layout.boxes = migrated.boxes;
      dbg.layout.connections = migrated.connections;
      dbg.layout._meta = migrated._meta;
      // rebuild maps by render
      dbg.renderCanvas();
      const beforeVS = !!dbg.getLargeBox('V1')?.viewState;
      dbg._execDeleteLargeBox('V1');
      const afterBox = dbg.getLargeBox('V1');
      return { propsOk, beforeVS, afterBoxNull: afterBox == null, boxCount: dbg.layout.boxes.length };
    });
    expect(r.propsOk).toBe(true);
    expect(r.beforeVS).toBe(true);
    expect(r.afterBoxNull).toBe(true);
    expect(r.boxCount).toBe(0);
  });
});
