import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\\\/g, '/')}`;

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

async function seedBoxes(page, coords) {
  return await page.evaluate((cs) => {
    const dbg = (window as any).__boxingDebug;
    dbg.layout.boxes = cs.map((c, i) => ({
      id: 'seed-' + i + '-' + Math.random().toString(36).slice(2, 8),
      type: 'large', title: 'B' + i, x: c[0], y: c[1],
      width: 320, height: 220, children: [],
    }));
    dbg.layout._meta = { updatedAt: Date.now() };
    dbg.renderCanvas();
    dbg.renderConnections();
    return dbg.layout.boxes.map((b: any) => b.id);
  }, coords);
}

test.describe('Boxing conn persistence/sync (BX-DEV-137++++)', () => {
  test('connections survive saveLayout + reload', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.saveLayout();
    }, [ids[0], ids[1]]);
    const before = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    expect(before).toBe(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    const after = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    expect(after).toBe(1);
  });

  test('disposeAllConns + renderConnections on renderCanvas clears stale lines', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, [ids[0], ids[1]]);
    const countBefore = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(countBefore).toBe(1);
    await page.evaluate(() => (window as any).__boxingDebug.renderCanvas());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const countAfter = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(countAfter).toBe(1);
  });

  test('connections survive enterLargeBox + exitToCanvas roundtrip', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, [ids[0], ids[1]]);
    await page.evaluate((id) => (window as any).__boxingDebug.enterLargeBox(id), ids[0]);
    const dataCountInside = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    expect(dataCountInside).toBe(1);
    await page.keyboard.press('Escape');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const afterExit = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    expect(afterExit).toBe(1);
  });

  test('applyExternalLayout re-renders connections after cross-tab sync', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, [ids[0], ids[1]]);
    const beforeCount = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(beforeCount).toBe(1);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const snapshot = JSON.parse(JSON.stringify(dbg.layout));
      snapshot._meta.writerId = 'other-tab-' + Date.now();
      snapshot._meta.updatedAt = Date.now();
      snapshot._meta.revision = (snapshot._meta.revision || 0) + 1;
      dbg.applyExternalLayout(snapshot);
    });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const afterCount = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(afterCount).toBe(1);
  });
});
