// Ticket 42 — onInstalled(update) COW-before-migrate acceptance tests (spec.md D2).
// Lane: file:// mock (SEC-01 — specs must NOT poke window.chrome.storage here). The
// install signal is seeded via the dbg.storageSet seam (bxstore: prefix), a legacy-shape
// layout seeds pre-update data, and page reload replays the boot path: consume signal →
// ensurePreUpdateSnapshot (NTP-side belt-and-suspenders) → loadLayout migration.
// The background-SW snapshot itself (onInstalled → takePreUpdateSnapshot) is verified by
// code-order review + node --check; the file:// lane has no service worker by design.
import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

const SNAP_INDEX_KEY = 'snap.v1.index';
const SNAP_KEY_PREFIX = 'snap.v1.';

// A modern (already-migrated) layout: full settings, __groupsMigrated stamped, no groups,
// connections with props — needsMigration() must return false for this shape.
function modernLayout() {
  return {
    version: 3.5,
    schemaVersion: 1,
    boxes: [{ id: 'L1', type: 'large', title: 'modern', x: 0, y: 0, width: 320, height: 220, children: [] }],
    nextLargeIndex: 2,
    connections: [{ id: 'C1', from: 'large:L1', to: 'large:L1', createdAt: 123, props: {} }],
    settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14, squareCorners: false, autoBackupInterval: 86400, headerPinned: true, syncProvider: 'local', urlOpenMode: 'sameTab', connDeleteAction: 'alt+click', theme: 'beige' },
    _meta: { revision: 1, updatedAt: 123, writerId: 'w', __groupsMigrated: true },
  };
}

// A legacy-shape layout that migrateLayout would rewrite: missing settings, persisted groups
// (ADR-0007 Q1 pending), connection without props (Q4c pending), no __groupsMigrated flag.
function legacyLayout() {
  return {
    version: 3.5,
    schemaVersion: 1,
    boxes: [{ id: 'L1', type: 'large', title: 'legacy', x: 0, y: 0, width: 320, height: 220, children: [] }],
    nextLargeIndex: 2,
    connections: [{ id: 'C1', from: 'large:L1', to: 'large:L1', createdAt: 123 }],
    groups: [{ parentId: 'large:L1' }],
  };
}

async function resetBoxing(page: import('@playwright/test').Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Readiness = the debug seam itself (the snapshot API must be live before seeding).
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__boxingDebug?.listSnapshots
      && (window as any).__boxingDebug?.storageSet
      && (window as any).__boxingDebug?.storageGet)), { timeout: 10000 }).toBe(true);
}

test.describe('Update COW before migrate (Ticket 42)', () => {

  test('update signal + pending migration snapshots pre-update layout, then migrates the main key', async ({ page }) => {
    test.setTimeout(30000);
    await resetBoxing(page);
    await page.evaluate(async (layout) => {
      const dbg = (window as any).__boxingDebug;
      await dbg.storageSet({ boxingLayout: layout, boxingInstallSignal: { reason: 'update', at: Date.now() } });
      // 42R: neutralize the OLD page's unload write-back. pagehide/beforeunload call
      // __boxingFlushCredentials, whose flushUnsavedCredentials() saveLayouts unconditionally
      // (it stamps _enc* = null even with empty inputs); the saveLayout chain body then lands
      // during the unload window and overwrites the seeded legacy with the boot layout's
      // migrated default shape → the new page's ensurePreUpdateSnapshot would (correctly)
      // see needsMigration=false and take no snapshot. Real update flows never seed a booted
      // page like this (SW COW happens at onInstalled before any NTP boot), so this is a
      // harness artifact, not a product-order bug.
      window.__boxingFlushCredentials = null;
    }, legacyLayout());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.listSnapshots)), { timeout: 10000 }).toBe(true);
    const r = await page.evaluate(async ({ prefix, indexKey }) => {
      const dbg = (window as any).__boxingDebug;
      const list = await dbg.listSnapshots();
      const all = await dbg.storageGet(null);
      const latest = list.length ? all[prefix + list[list.length - 1].ts] : null;
      return {
        snapCount: list.length,
        // the pre-update copy was taken BEFORE migration: settings still missing and
        // groups→isParent backfill had not run on the copied data
        snapKeepsLegacyShape: latest
          ? (!latest.data.settings && latest.data.boxes[0].isParent === undefined)
          : false,
        snapSchemaVersion: latest ? latest.schemaVersion : null,
        // the migrated live layout after loadLayout
        hasMigratedSettings: Boolean(dbg.layout.settings && dbg.layout.settings.selectedLanguage === 'en'),
        groupsMigrated: Boolean(dbg.layout._meta && dbg.layout._meta.__groupsMigrated),
        connPropsBackfilled: (dbg.layout.connections || []).every((c: any) => c && c.props),
        starBackfilled: dbg.layout.boxes[0].isParent === true,
        signalConsumed: !('boxingInstallSignal' in all),
      };
    }, { prefix: SNAP_KEY_PREFIX, indexKey: SNAP_INDEX_KEY });
    console.log('T42-1:', JSON.stringify(r));
    expect(r.snapCount).toBeGreaterThanOrEqual(1); // acceptance 3: pre-update snapshot exists
    expect(r.snapKeepsLegacyShape).toBe(true);     // it preserves the PRE-update schema shape
    expect(r.snapSchemaVersion).toBe(1);           // ADR-0009 schemaVersion preserved on the copy
    expect(r.hasMigratedSettings).toBe(true);      // main key migrated (defaults merged in)
    expect(r.groupsMigrated).toBe(true);           // ADR-0007 Q1 flag stamped by migration
    expect(r.connPropsBackfilled).toBe(true);      // ADR-0007 Q4c backfilled
    expect(r.starBackfilled).toBe(true);           // groups→isParent backfill ran
    expect(r.signalConsumed).toBe(true);           // signal read+removed once (ADR-0016)
  });

  test('update signal with an already-migrated layout takes no redundant snapshot', async ({ page }) => {
    test.setTimeout(30000);
    await resetBoxing(page);
    await page.evaluate(async (layout) => {
      const dbg = (window as any).__boxingDebug;
      await dbg.storageSet({ boxingLayout: layout, boxingInstallSignal: { reason: 'update', at: Date.now() } });
      window.__boxingFlushCredentials = null; // 42R: see T42-1 comment — unload write-back neutralization
    }, modernLayout());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.listSnapshots)), { timeout: 10000 }).toBe(true);
    const r = await page.evaluate(async ({ indexKey }) => {
      const dbg = (window as any).__boxingDebug;
      const list = await dbg.listSnapshots();
      const all = await dbg.storageGet(null);
      return {
        snapCount: list.length,
        noSnapshotKeys: Object.keys(all).filter(k => k.startsWith(indexKey.replace('.index', '.')) && k !== indexKey).length,
        layoutLoaded: dbg.layout.boxes.length === 1 && dbg.layout.boxes[0].title === 'modern',
        signalConsumed: !('boxingInstallSignal' in all),
      };
    }, { indexKey: SNAP_INDEX_KEY });
    console.log('T42-2:', JSON.stringify(r));
    expect(r.snapCount).toBe(0);       // needsMigration()=false → no COW copy for already-migrated data
    expect(r.noSnapshotKeys).toBe(0);
    expect(r.layoutLoaded).toBe(true); // boot still completes normally
    expect(r.signalConsumed).toBe(true);
  });

  test('no signal (file:// lane) — legacy boot: migration still runs, but no snapshot is taken', async ({ page }) => {
    test.setTimeout(30000);
    await resetBoxing(page);
    await page.evaluate(async (layout) => {
      const dbg = (window as any).__boxingDebug;
      await dbg.storageSet({ boxingLayout: layout }); // NOTE: no boxingInstallSignal seeded
      window.__boxingFlushCredentials = null; // 42R: see T42-1 comment — unload write-back neutralization
    }, legacyLayout());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.layout?.boxes?.length)), { timeout: 10000 }).toBe(true);
    const r = await page.evaluate(async ({ indexKey }) => {
      const dbg = (window as any).__boxingDebug;
      const list = await dbg.listSnapshots();
      const all = await dbg.storageGet(null);
      return {
        snapCount: list.length,
        layoutLoaded: dbg.layout.boxes.length === 1 && dbg.layout.boxes[0].title === 'legacy',
        // migration still happened (existing behavior, unchanged for the signal-less lane):
        hasMigratedSettings: Boolean(dbg.layout.settings && dbg.layout.settings.selectedLanguage === 'en'),
        starBackfilled: dbg.layout.boxes[0].isParent === true,
        signalAbsent: !('boxingInstallSignal' in all),
      };
    }, { indexKey: SNAP_INDEX_KEY });
    console.log('T42-3:', JSON.stringify(r));
    expect(r.snapCount).toBe(0);       // acceptance 4: no signal → no COW snapshot (no regression)
    expect(r.layoutLoaded).toBe(true);
    expect(r.hasMigratedSettings).toBe(true); // migration path untouched
    expect(r.starBackfilled).toBe(true);
    expect(r.signalAbsent).toBe(true); // nothing was ever written
  });
});