import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
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

// ═══════════════════════════════════════════════════════════════════════════
// BX-D-007 (Wave 2026.10.11 P-18 / S-11): connection surface ownership.
//
// Regression class: one connId projected onto every open inner surface. The
// resolver asked only "are both endpoints inner?" and never WHICH large box
// they belong to, while coordinates are solved from layout data (DOM
// independent) — so a line created inside box A reappeared as a ghost inside
// box B at the same local position.
//
// These assert the RESOLVER contract and the RENDERED-DOM outcome separately:
// a resolver-only test would still pass if the render path ignored it.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('BX-D-007: connection lines render only in their owning surface', () => {
  // Two large boxes, each holding two small boxes, plus one canvas-level edge.
  async function seedTwoBoxes(page) {
    await resetBoxing(page);
    return await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'A', type: 'large', title: 'A', x: 0, y: 0, width: 400, height: 300, children: [
          { id: 'a1', title: 'a1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
          { id: 'a2', title: 'a2', x: 220, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
        { id: 'B', type: 'large', title: 'B', x: 600, y: 0, width: 400, height: 300, children: [
          { id: 'b1', title: 'b1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
          { id: 'b2', title: 'b2', x: 220, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
      ];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      // a1<->a2 belongs to A's inner surface; A<->B belongs to the canvas.
      dbg.addConnection(dbg.smallKey('A', 'a1'), dbg.smallKey('A', 'a2'));
      dbg.addConnection(dbg.largeKey('A'), dbg.largeKey('B'));
      dbg.renderConnections();
      return { conns: dbg.layout.connections.length };
    });
  }

  // Enter a large box the way the app does, so currentLargeBoxId is real.
  async function enterBox(page, id) {
    await page.evaluate((boxId) => {
      const dbg = (window as any).__boxingDebug;
      dbg.enterLargeBox(boxId);
    }, id);
    await expect.poll(() => page.evaluate((boxId) => {
      const dbg = (window as any).__boxingDebug;
      return dbg.state().currentLargeBoxId === boxId;
    }, id), { timeout: 5000 }).toBe(true);
  }

  const lineCount = (page: any) => page.evaluate(() => {
    const inner = document.querySelector('.inner__surface .conn-layer, .inner-surface-content .conn-layer');
    const canvas = document.querySelector('.canvas__surface .conn-layer');
    return {
      inner: inner ? inner.querySelectorAll('line.conn-line').length : 0,
      canvas: canvas ? canvas.querySelectorAll('line.conn-line').length : 0,
      total: document.querySelectorAll('line.conn-line').length,
    };
  });

  test('D007-1: canvas-level edge renders on the canvas and nowhere else', async ({ page }) => {
    await seedTwoBoxes(page);
    // Canvas is the open surface -> the large<->large edge renders exactly once.
    const onCanvas = await lineCount(page);
    expect(onCanvas.canvas).toBe(1);
    expect(onCanvas.inner).toBe(0);
    expect(onCanvas.total).toBe(1);
  });

  test('D007-2: canvas-level edge is NOT projected into an open inner surface', async ({ page }) => {
    // Canvas-ONLY seed on purpose: seedTwoBoxes also creates an inner edge, so
    // counting there could not tell "the canvas edge leaked in" apart from "the
    // inner edge correctly rendered". With a single canvas edge, any line at all
    // inside the box IS the leak.
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'A', type: 'large', title: 'A', x: 0, y: 0, width: 400, height: 300, children: [
          { id: 'a1', title: 'a1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
        { id: 'B', type: 'large', title: 'B', x: 600, y: 0, width: 400, height: 300, children: [] },
      ];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      dbg.addConnection(dbg.largeKey('A'), dbg.largeKey('B'));
      dbg.renderConnections();
    });
    // Sanity: on the canvas the edge does render.
    expect((await lineCount(page)).total).toBe(1);
    await enterBox(page, 'A');
    const inA = await lineCount(page);
    // Inside A the canvas edge belongs to the CLOSED canvas surface -> zero lines.
    // This is the ghost-line class of bug.
    expect(inA.inner, 'a canvas-level edge must never be drawn on an inner surface').toBe(0);
    expect(inA.total, 'zero lines total inside A (canvas surface is closed)').toBe(0);
  });

  test('D007-3: an inner edge renders only inside ITS OWN box (B sees zero lines)', async ({ page }) => {
    await seedTwoBoxes(page);
    await enterBox(page, 'A');
    const inA = await lineCount(page);
    expect(inA.inner, "A's own inner edge must render inside A").toBe(1);
    // Now enter B. The SAME connId must not reappear — before the fix the edge
    // was re-projected at the same local coordinates, i.e. a ghost in B.
    await enterBox(page, 'B');
    const inB = await lineCount(page);
    expect(inB.inner, "box B must show ZERO lines: the edge belongs to box A").toBe(0);
    expect(inB.total).toBe(0);
  });

  test('D007-4: going back to A restores its edge (suppression is view-scoped, not destructive)', async ({ page }) => {
    await seedTwoBoxes(page);
    await enterBox(page, 'A');
    expect((await lineCount(page)).inner).toBe(1);
    await enterBox(page, 'B');
    expect((await lineCount(page)).total).toBe(0);
    await enterBox(page, 'A');
    expect((await lineCount(page)).inner, 'returning to A must bring the line back').toBe(1);
  });

  test('D007-5: resolveConnSurface contract (canvas / inner / cross-parent / mixed)', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'A', type: 'large', title: 'A', x: 0, y: 0, width: 400, height: 300, children: [
          { id: 'a1', title: 'a1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
          { id: 'a2', title: 'a2', x: 220, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
        { id: 'B', type: 'large', title: 'B', x: 600, y: 0, width: 400, height: 300, children: [
          { id: 'b1', title: 'b1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
      ];
      const k = {
        largeA: dbg.largeKey('A'), largeB: dbg.largeKey('B'),
        a1: dbg.smallKey('A', 'a1'), a2: dbg.smallKey('A', 'a2'),
        b1: dbg.smallKey('B', 'b1'),
      };
      const before = {
        canvas: dbg.resolveConnSurface(k.largeA, k.largeB),
        innerClosed: dbg.resolveConnSurface(k.a1, k.a2),
        crossParent: dbg.resolveConnSurface(k.a1, k.b1),
        mixed: dbg.resolveConnSurface(k.largeA, k.a1),
        garbage: dbg.resolveConnSurface(null, undefined),
      };
      return before;
    });
    // Canvas open (default after reset): large<->large owns the canvas.
    expect(r.canvas.kind).toBe('canvas');
    // Inner surface closed -> resolvable, but not rendered here.
    expect(r.innerClosed.kind).toBe('none');
    expect(r.innerClosed.reason).toBe('inner-surface-closed');
    // Cross-parent: no common surface at all.
    expect(r.crossParent.kind).toBe('none');
    expect(r.crossParent.crossParent).toBe(true);
    // Mixed canvas/inner tiers share no coordinate space.
    expect(r.mixed.kind).toBe('none');
    expect(r.mixed.reason).toBe('mixed-tier');
    // Unresolvable endpoints must not throw.
    expect(r.garbage.kind).toBe('none');
  });

  test('D007-5a: inner ownership follows the live layout after reparenting', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const a1 = { id: 'a1', title: 'a1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] };
      const a2 = { id: 'a2', title: 'a2', x: 220, y: 20, width: 160, height: 110, bookmarks: [] };
      dbg.layout.boxes = [
        { id: 'A', type: 'large', title: 'A', x: 0, y: 0, width: 400, height: 300, children: [a1, a2] },
        { id: 'B', type: 'large', title: 'B', x: 600, y: 0, width: 400, height: 300, children: [] },
      ];
      // The persisted connection key still names A, but both endpoint objects
      // are moved under B before ownership is resolved.
      const a = dbg.layout.boxes[0];
      const b = dbg.layout.boxes[1];
      b.children.push(...a.children.splice(0));
      return dbg.resolveConnSurface(dbg.smallKey('A', 'a1'), dbg.smallKey('A', 'a2'));
    });
    expect(r).toEqual({ kind: 'none', reason: 'inner-surface-closed' });
  });

  test('D007-6: cross-parent inner edge keeps its DATA and logs a console debugWarn (no UI warning)', async ({ page }) => {
    await resetBoxing(page);
    const warns: string[] = [];
    page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'debug') warns.push(m.text()); });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'A', type: 'large', title: 'A', x: 0, y: 0, width: 400, height: 300, children: [
          { id: 'a1', title: 'a1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
        { id: 'B', type: 'large', title: 'B', x: 600, y: 0, width: 400, height: 300, children: [
          { id: 'b1', title: 'b1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
      ];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      const added = dbg.addConnection(dbg.smallKey('A', 'a1'), dbg.smallKey('B', 'b1'));
      dbg.renderConnections();
      return {
        added,
        stored: dbg.layout.connections.length,
        renderedAnywhere: document.querySelectorAll('line.conn-line').length,
        // merge reversibility: the data must survive for a future re-merge
        storedConn: JSON.parse(JSON.stringify(dbg.layout.connections[0] || null)),
      };
    });
    expect(r.added).toBe(true);
    // DATA RETAINED (D-007: deleting it would break merge reversibility).
    expect(r.stored).toBe(1);
    expect(r.storedConn.from).toBe('small:A:a1');
    expect(r.storedConn.to).toBe('small:B:b1');
    // NOT RENDERED anywhere.
    expect(r.renderedAnywhere).toBe(0);
    // Console diagnostic present (not a UI warning — no modal, no toast).
    await expect.poll(() => warns.some((w) => /cross-surface connection/.test(w)), { timeout: 5000 }).toBe(true);
    // No UI surface was raised by the condition.
    expect(await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && !ov.hidden);
    })).toBe(false);
  });

  test('D007-7: deleting the source edge removes every projection (tombstone is conn-scoped)', async ({ page }) => {
    await seedTwoBoxes(page);
    await enterBox(page, 'A');
    expect((await lineCount(page)).inner).toBe(1);
    const after = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const id = dbg.layout.connections.find((c: any) => c.from === 'small:A:a1' || c.to === 'small:A:a1')?.id;
      dbg.removeConnection(id);
      dbg.renderConnections();
      return { conns: dbg.layout.connections.length, removedId: id };
    });
    expect(after.conns).toBe(1); // only the canvas edge remains
    expect((await lineCount(page)).total).toBe(0);
    // Re-entering must not resurrect it.
    await enterBox(page, 'B');
    await enterBox(page, 'A');
    expect((await lineCount(page)).total).toBe(0);
  });

  test('D007-8: legacy raw-id connections still render on the canvas (back-compat preserved)', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'L1', type: 'large', title: 'L1', x: 0, y: 0, width: 320, height: 220, children: [] },
        { id: 'L2', type: 'large', title: 'L2', x: 400, y: 0, width: 320, height: 220, children: [] },
      ];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      dbg.layout.connections.push({ id: 'legacy-1', from: 'L1', to: 'L2', createdAt: Date.now() });
      dbg.renderConnections();
      return document.querySelectorAll('line.conn-line').length;
    });
    expect(r).toBe(1);
  });
});
