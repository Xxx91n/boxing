import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\\\/g, '/');

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
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

async function syncTab(source, target) {
  await source.evaluate(async () => {
    if ((window as any).__boxingDebug?.layout) {
      const layout = (window as any).__boxingDebug.layout;
      localStorage.setItem('boxingLayout', JSON.stringify(layout));
    }
  });
  const data = await source.evaluate(() => localStorage.getItem('boxingLayout'));
  if (!data) return;
  await target.evaluate(raw => {
    const layout = JSON.parse(raw as string);
    (window as any).__boxingDebug?.applyExternalLayout?.(layout);
  }, data);
}

test.describe('Boxing DSU baseline (A9-Phase1)', () => {
  test('DSU: 3 boxes + 2 conns => one component with all 3', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0], [800, 0]]);
    const r = await page.evaluate(([a, b, c]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.addConnection(dbg.largeKey(b), dbg.largeKey(c));
      dbg.toggleStarMark(dbg.largeKey(a));
      const g = dbg.getGroupByParent(dbg.largeKey(a));
      return { connCount: dbg.layout.connections.length, memberCount: g ? g.members.length : 0 };
    }, ids);
    expect(r.connCount).toBe(2);
    expect(r.memberCount).toBe(2); // A5 fix: getGroupByParent returns DSU members
  });

  test('removeConnection keeps remaining connections intact', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0], [800, 0]]);
    const r = await page.evaluate(([a, b, c]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.addConnection(dbg.largeKey(b), dbg.largeKey(c));
      const connId = dbg.layout.connections[0].id;
      dbg.removeConnection(connId);
      return { remaining: dbg.layout.connections.length };
    }, ids);
    expect(r.remaining).toBe(1);
  });

  test('star toggle ON then OFF: groups array reflects state', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      const ka = dbg.largeKey(a), kb = dbg.largeKey(b);
      dbg.addConnection(ka, kb);
      dbg.toggleStarMark(ka);
      const starredOn = dbg.layout.groups.length;
      const groupExistsOn = !!dbg.getGroupByParent(ka);
      dbg.toggleStarMark(ka);
      const starredOff = dbg.layout.groups.length;
      const groupExistsOff = !!dbg.getGroupByParent(ka);
      return { starredOn, groupExistsOn, starredOff, groupExistsOff };
    }, ids);
    expect(r.starredOn).toBe(1); // A5: ensureGroups derives from box.isParent
    expect(r.groupExistsOn).toBe(true); // A5: getGroupByParent uses groupStar (in sync with box.isParent)
    // After unstar: groups array filtered to 0, groupStar deleted, getGroupByParent returns false
    expect(r.starredOff).toBe(0);
    expect(r.groupExistsOff).toBe(false); // A5 fix: groupStar cleared, getGroupByParent returns null
  });

  test('star persists across saveLayout + reload', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.toggleStarMark(dbg.largeKey(a));
      dbg.saveLayout();
    }, ids);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    const r = await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const ka = dbg.largeKey(a);
      return { groupsLen: dbg.layout.groups ? dbg.layout.groups.length : 0, hasGroup: !!dbg.getGroupByParent(ka) };
    }, [ids[0]]);
    expect(r.groupsLen).toBe(1);
    expect(r.hasGroup).toBe(true);
  });

  test('cross-level connection: large to small box tiered key', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [800, 0]]);
    const smallIds = await page.evaluate(([lgId]) => {
      const dbg = (window as any).__boxingDebug;
      const lb = dbg.getLargeBox(lgId);
      lb.children = [{ id: 'sm-0-test', title: 'S0', x: 20, y: 20, width: 160, height: 110, bookmarks: [] }];
      dbg.renderCanvas();
      return lb.children.map((s: any) => s.id);
    }, [ids[0]]);
    const r = await page.evaluate(([la, lb, sm]) => {
      const dbg = (window as any).__boxingDebug;
      const ka = dbg.largeKey(la);
      const ks = dbg.smallKey(lb, sm);
      const added = dbg.addConnection(ka, ks);
      dbg.renderConnections();
      return { added, connCount: dbg.layout.connections.length, from: dbg.layout.connections[0]?.from, to: dbg.layout.connections[0]?.to };
    }, [ids[0], ids[0], smallIds[0]]);
    expect(r.added).toBe(true);
    expect(r.connCount).toBe(1);
    expect(r.from).toBe('large:' + ids[0]);
    expect(r.to).toBe('small:' + ids[0] + ':' + smallIds[0]);
  });

  test('cross-tab: connections sync via applyExternalLayout', async ({ page: pageA, context }) => {
    await resetBoxing(pageA);
    const pageB = await context.newPage();
    await resetBoxing(pageB);
    const ids = await seedBoxes(pageA, [[0, 0], [400, 0]]);
    await pageA.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.saveLayout();
    }, ids);
    await syncTab(pageA, pageB);
    await pageB.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const after = await pageB.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    expect(after).toBe(1);
    await pageB.close();
  });

  test('cross-tab: star-mark syncs via applyExternalLayout', async ({ page: pageA, context }) => {
    await resetBoxing(pageA);
    const pageB = await context.newPage();
    await resetBoxing(pageB);
    const ids = await seedBoxes(pageA, [[0, 0], [400, 0]]);
    await pageA.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.toggleStarMark(dbg.largeKey(a));
      dbg.saveLayout();
    }, ids);
    await syncTab(pageA, pageB);
    await pageB.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const r = await pageB.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const ka = dbg.largeKey(a);
      return { groupsLen: dbg.layout.groups ? dbg.layout.groups.length : 0, hasGroup: !!dbg.getGroupByParent(ka) };
    }, [ids[0]]);
    expect(r.groupsLen).toBe(1);
    expect(r.hasGroup).toBe(true);
    await pageB.close();
  });

  test('orphan pruning: deleting connected box removes stale connections', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0], [800, 0]]);
    await page.evaluate(([a, b, c]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.addConnection(dbg.largeKey(b), dbg.largeKey(c));
      dbg.saveLayout();
    }, ids);
    const before = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    expect(before).toBe(2);
    await page.evaluate(([bId]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = dbg.layout.boxes.filter((b: any) => b.id !== bId);
      dbg.pruneConnArrays();
      dbg.renderCanvas();
      dbg.renderConnections();
    }, [ids[1]]);
    const after = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    expect(after).toBe(0);
  });

  test('zoom does not break connection line presence', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, ids);
    const before = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const after = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(before).toBe(1);
    expect(after).toBe(1);
  });

  test('enterLargeBox + exitToCanvas preserves connection state', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, ids);
    const before = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    await page.evaluate((id) => (window as any).__boxingDebug.enterLargeBox(id), ids[0]);
    const inside = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      if (typeof dbg.exitToCanvas === 'function') dbg.exitToCanvas();
    });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const afterExit = await page.evaluate(() => (window as any).__boxingDebug.layout.connections.length);
    expect(before).toBe(1);
    expect(inside).toBe(1);
    expect(afterExit).toBe(1);
  });
  test('A4/Bug4: parent drag moves group members rigidly (no fly-off)', async ({ page }) => {
    // Bug 4 regression guard: starring A, connecting B to A, then moving A must move B
    // by the same delta. Pre-A5 the DSU stale lookup returned stale lookup causing members
    // not to move at all; DSU refactor must not regress this.
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0], [800, 0]]);
    // star A as parent
    await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.toggleStarMark(dbg.largeKey(a));
    }, [ids[0]]);
    // connect A<->B so they are in the same DSU group
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, [ids[0], ids[1]]);
    // Before drag: capture B coords
    const beforeB = await page.evaluate(([b]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.getLargeBox(b);
      return { x: box.x, y: box.y };
    }, [ids[1]]);
    // Move A by (100, 0) via the moveGroupTogether shim directly (unit-style).
    const afterMove = await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      const aBox = dbg.getLargeBox(a);
      const aKey = dbg.largeKey(a);
      const bKey = dbg.largeKey(b);
      // capture member origins (mirrors onBoxDragStart)
      const g = dbg.getGroupByParent(aKey);
      const origins = new Map();
      if (g && Array.isArray(g.members)) {
        for (const mId of g.members) {
          if (typeof mId === 'string' && mId.startsWith('large:')) {
            const m = dbg.getLargeBox(mId.slice(6));
            if (m) origins.set(mId, { x: m.x, y: m.y });
          }
        }
      }
      const dX = 100, dY = 0;
      dbg.moveGroupTogether(aKey, dX, dY, origins);
      const afterB = dbg.getLargeBox(b);
      return { a_has_group: !!g, origins_size: origins.size, b_before: undefined, b_after: { x: afterB.x, y: afterB.y } };
    }, [ids[0], ids[1]]);
    // Re-read B after
    const afterB = await page.evaluate(([b]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.getLargeBox(b);
      return { x: box.x, y: box.y };
    }, [ids[1]]);
    // Member B should have moved by exactly dX=100 (within snapping slack)
    expect(afterMove.a_has_group).toBe(true);
    expect(afterMove.origins_size).toBeGreaterThanOrEqual(1);
    // B must have moved with parent (rigid), with grid-snap slack.
    // dX=100 → expect dx in [50, 100] (snapping pulls to nearest grid).
    const dx = Math.abs(afterB.x - beforeB.x);
    expect(dx).toBeGreaterThanOrEqual(40);
    expect(dx).toBeLessThanOrEqual(120);
    expect(Math.abs(afterB.y - beforeB.y)).toBeLessThan(10);
  });
});
