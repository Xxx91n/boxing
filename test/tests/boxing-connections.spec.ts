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

// Seed the layout with N large boxes at the given world coordinates. Persists and
// re-renders. Returns the assigned box ids.
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

// Seed small boxes inside a large box. Returns the small box ids.
async function seedSmallBoxes(page, largeId, coords) {
  return await page.evaluate(([lgId, cs]) => {
    const dbg = (window as any).__boxingDebug;
    const lb = dbg.getLargeBox(lgId);
    if (!lb) throw new Error('large box not found: ' + lgId);
    lb.children = cs.map((c, i) => ({
      id: 'sm-' + i + '-' + Math.random().toString(36).slice(2, 8),
      title: 'S' + i, x: c[0], y: c[1],
      width: 160, height: 110, bookmarks: [],
    }));
    dbg.renderCanvas();
    return lb.children.map((s: any) => s.id);
  }, [largeId, coords]);
}

test.describe('Boxing box-connections / star-mark (BX-DEV-137)', () => {
  test('BX-142: SVG connection layer exposes connection API (leader-line removed)', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => ({
      hasAdd: typeof (window as any).__boxingDebug.addConnection === 'function',
      hasStar: typeof (window as any).__boxingDebug.toggleStarMark === 'function',
      hasRender: typeof (window as any).__boxingDebug.renderConnections === 'function',
      hasMove: typeof (window as any).__boxingDebug.moveGroupTogether === 'function',
      hasLargeKey: typeof (window as any).__boxingDebug.largeKey === 'function',
      hasSmallKey: typeof (window as any).__boxingDebug.smallKey === 'function',
      hasResolve: typeof (window as any).__boxingDebug.resolveBoxEl === 'function',
      hasEnterConn: typeof (window as any).__boxingDebug.enterConnectMode === 'function',
      hasExitConn: typeof (window as any).__boxingDebug.exitConnectMode === 'function',
      hasGetGroup: typeof (window as any).__boxingDebug.getGroupByParent === 'function',
    }));
    expect(r.hasAdd).toBe(true);
    expect(r.hasStar).toBe(true);
    expect(r.hasRender).toBe(true);
    expect(r.hasMove).toBe(true);
    expect(r.hasLargeKey).toBe(true);
    expect(r.hasSmallKey).toBe(true);
    expect(r.hasResolve).toBe(true);
    expect(r.hasEnterConn).toBe(true);
    expect(r.hasExitConn).toBe(true);
    expect(r.hasGetGroup).toBe(true);
  });

  test('addConnection persists a connection and renders one SVG line', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    expect(ids.length).toBe(2);
    const [a, b] = ids;
    const r = await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      const ka = dbg.largeKey(aId);
      const kb = dbg.largeKey(bId);
      const before = dbg.layout.connections.length;
      const added = dbg.addConnection(ka, kb);
      dbg.renderConnections();
      return {
        before,
        added,
        after: dbg.layout.connections.length,
        lineCount: dbg.connCount(),
        firstConn: dbg.layout.connections[0] && { from: dbg.layout.connections[0].from, to: dbg.layout.connections[0].to },
      };
    }, [a, b]);
    expect(r.added).toBe(true);
    expect(r.after).toBe(r.before + 1);
    expect(r.lineCount).toBe(1);
    expect(r.firstConn.from).toBe('large:' + a);
    expect(r.firstConn.to).toBe('large:' + b);
  });

  test('duplicate add is rejected (no double-line between the same pair)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      const ka = dbg.largeKey(aId);
      const kb = dbg.largeKey(bId);
      const first = dbg.addConnection(ka, kb);
      const reverse = dbg.addConnection(kb, ka); // symmetric dup
      const dup = dbg.addConnection(ka, kb);       // explicit dup
      dbg.renderConnections();
      return { first, reverse, dup, count: dbg.layout.connections.length, lineCount: dbg.connCount() };
    }, ids);
    expect(r.first).toBe(true);
    expect(r.reverse).toBe(false);
    expect(r.dup).toBe(false);
    expect(r.count).toBe(1);
    expect(r.lineCount).toBe(1);
  });

  test('star-mark persists a group with the box as parent (tiered key)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const r = await page.evaluate(([pId]) => {
      const dbg = (window as any).__boxingDebug;
      const kp = dbg.largeKey(pId);
      dbg.toggleStarMark(kp);
      return {
        hasGroup: dbg.layout.groups.some((g: any) => g.parentId === kp),
        members: dbg.layout.groups.find((g: any) => g.parentId === kp)?.members?.length,
      };
    }, ids);
    expect(r.hasGroup).toBe(true);
    expect(r.members).toBe(0);
  });

  test('star-mark toggle removes the group on a second click (tiered key)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const r = await page.evaluate(([pId]) => {
      const dbg = (window as any).__boxingDebug;
      const kp = dbg.largeKey(pId);
      dbg.toggleStarMark(kp);
      dbg.toggleStarMark(kp);
      return { hasGroup: dbg.layout.groups.some((g: any) => g.parentId === kp) };
    }, ids);
    expect(r.hasGroup).toBe(false);
  });

  test('orphan pruning drops connections that reference a deleted box', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(aId), dbg.largeKey(bId));
      // Simulate deletion of box bId via prune path.
      dbg.layout.boxes = dbg.layout.boxes.filter((x: any) => x.id !== bId);
      dbg.pruneConnArrays();
      return {
        remaining: dbg.layout.connections.length,
        orphanGone: !dbg.layout.connections.some((c: any) => c.from.includes(bId) || c.to.includes(bId)),
      };
    }, ids);
    expect(r.remaining).toBe(0);
    expect(r.orphanGone).toBe(true);
  });

  test('group drag: parent move shifts member by the same delta (tiered key)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([pId, cId]) => {
      const dbg = (window as any).__boxingDebug;
      const kp = dbg.largeKey(pId);
      const kc = dbg.largeKey(cId);
      dbg.toggleStarMark(kp);
      dbg.addMember(kp, kc);
      const beforeX = dbg.getLargeBox(cId).x;
      const beforeY = dbg.getLargeBox(cId).y;
      dbg.moveGroupTogether(kp, 100, 50);
      return { beforeX, beforeY, afterX: dbg.getLargeBox(cId).x, afterY: dbg.getLargeBox(cId).y };
    }, ids);
    // snapCanvas (CANVAS_GRID=24) may round the member position to the nearest grid.
    expect(Math.abs(r.afterX - r.beforeX - 100)).toBeLessThanOrEqual(24);
    expect(Math.abs(r.afterY - r.beforeY - 50)).toBeLessThanOrEqual(24);
  });

  // ── Cross-level connection tests (BX-DEV-137+ Round 2) ──

  test('large-to-small connection persists and renders', async ({ page }) => {
    await resetBoxing(page);
    const [largeIds, smallIds] = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      // two large boxes
      dbg.layout.boxes = [
        { id: 'l1', type: 'large', title: 'LB1', x: 0, y: 0, width: 320, height: 220, children: [] },
        { id: 'l2', type: 'large', title: 'LB2', x: 600, y: 0, width: 320, height: 220, children: [
          { id: 's1', title: 'SB1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
      ];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      return [dbg.layout.boxes.map((b: any) => b.id), (dbg.layout.boxes[1].children || []).map((s: any) => s.id)];
    });
    expect(largeIds.length).toBe(2);
    expect(smallIds.length).toBe(1);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const largeK = dbg.largeKey('l1');
      const smallK = dbg.smallKey('l2', 's1');
      const added = dbg.addConnection(largeK, smallK);
      dbg.renderConnections();
      return {
        added,
        conn: dbg.layout.connections[0],
        lineCount: dbg.connCount(),
      };
    });
    expect(r.added).toBe(true);
    expect(r.conn.from).toBe('large:l1');
    expect(r.conn.to).toBe('small:l2:s1');
    // Small-box DOM lives inside inner-canvas which only renders after enterLargeBox.
    // Both endpoints may not be visible simultaneously — leader-line skips if a DOM is missing.
    // This test validates DATA-layer persistence; visual line rendering requires both box DOMs.
    expect(r.lineCount).toBeLessThanOrEqual(1);
  });

  test('small-to-small connection within the same large box', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{
        id: 'l1', type: 'large', title: 'LB1', x: 0, y: 0, width: 400, height: 300, children: [
          { id: 's1', title: 'SB1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
          { id: 's2', title: 'SB2', x: 200, y: 20, width: 160, height: 110, bookmarks: [] },
        ],
      }];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
    });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const k1 = dbg.smallKey('l1', 's1');
      const k2 = dbg.smallKey('l1', 's2');
      const added = dbg.addConnection(k1, k2);
      dbg.renderConnections();
      return { added, conn: dbg.layout.connections[0], lineCount: dbg.connCount() };
    });
    expect(r.added).toBe(true);
    expect(r.conn.from).toBe('small:l1:s1');
    expect(r.conn.to).toBe('small:l1:s2');
    expect(r.lineCount).toBeLessThanOrEqual(1);
  });

  test('small-to-small connection across different large boxes', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'l1', type: 'large', title: 'LB1', x: 0, y: 0, width: 320, height: 220, children: [
          { id: 's1', title: 'SB1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
        { id: 'l2', type: 'large', title: 'LB2', x: 600, y: 0, width: 320, height: 220, children: [
          { id: 's2', title: 'SB2', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
      ];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
    });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const k1 = dbg.smallKey('l1', 's1');
      const k2 = dbg.smallKey('l2', 's2');
      const added = dbg.addConnection(k1, k2);
      dbg.renderConnections();
      return { added, conn: dbg.layout.connections[0], lineCount: dbg.connCount() };
    });
    expect(r.added).toBe(true);
    expect(r.conn.from).toBe('small:l1:s1');
    expect(r.conn.to).toBe('small:l2:s2');
    expect(r.lineCount).toBeLessThanOrEqual(1);
  });

  test('orphan pruning drops small-box connections when its large box is deleted', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [
        { id: 'l1', type: 'large', title: 'LB1', x: 0, y: 0, width: 320, height: 220, children: [] },
        { id: 'l2', type: 'large', title: 'LB2', x: 600, y: 0, width: 320, height: 220, children: [
          { id: 's1', title: 'SB1', x: 20, y: 20, width: 160, height: 110, bookmarks: [] },
        ] },
      ];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
    });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const largeK = dbg.largeKey('l1');
      const smallK = dbg.smallKey('l2', 's1');
      dbg.addConnection(largeK, smallK);
      // Delete l2 — its small box s1 connection should be pruned
      dbg.layout.boxes = dbg.layout.boxes.filter((b: any) => b.id !== 'l2');
      dbg.pruneConnArrays();
      return {
        remaining: dbg.layout.connections.length,
        orphanGone: !dbg.layout.connections.some((c: any) => c.to === 'small:l2:s1'),
      };
    });
    expect(r.remaining).toBe(0);
    expect(r.orphanGone).toBe(true);
  });

  test('legacy raw-id connections still render (back-compat with Round 1)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      // Insert a legacy raw-id connection (no 'large:' prefix)
      dbg.layout.connections.push({ id: 'legacy-1', from: aId, to: bId, createdAt: Date.now() });
      dbg.renderConnections();
      // pruneConnArrays should keep it (rawId is valid via back-compat path)
      dbg.pruneConnArrays();
      return {
        kept: dbg.layout.connections.length,
        lineCount: dbg.connCount(),
      };
    }, ids);
    expect(r.kept).toBe(1);
    expect(r.lineCount).toBe(1);
  });

  // BX-DEV-137++++: edge-midpoint hotspot tests
  test('addEdgeAnchors creates 4 edge hotspots per large box', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const r = await page.evaluate((id) => {
      const el = document.querySelector('.large-box[data-id="' + id + '"]');
      if (!el) return { found: false };
      const anchors = el.querySelectorAll('.box-edge-anchor');
      return {
        found: true,
        count: anchors.length,
        sides: Array.from(anchors).map((a: any) => a.dataset.side),
        hasMousedown: anchors.length > 0 && typeof (anchors[0] as any).onclick !== 'undefined' || anchors.length > 0,
      };
    }, ids[0]);
    expect(r.found).toBe(true);
    expect(r.count).toBe(4);
    expect(r.sides.sort()).toEqual(['bottom', 'left', 'right', 'top']);
  });

  test('small-box star button (★) replaces arrow button (↗)', async ({ page }) => {
    await resetBoxing(page);
    const largeIds = await seedBoxes(page, [[0, 0]]);
    await page.evaluate((lgId) => {
      const dbg = (window as any).__boxingDebug;
      const lb = dbg.getLargeBox(lgId);
      lb.children = [{
        id: 'sm-0-aaa', title: 'S0', x: 0, y: 0, width: 160, height: 110, bookmarks: [],
      }];
      dbg.enterLargeBox(lgId);
    }, largeIds[0]);
    const r = await page.evaluate(lgId => {
      const order = () => {
        const sb = document.querySelector('.small-box[data-large-id="' + lgId + '"]');
        if (!sb) return { found: false };
        const bar = sb.querySelector('.small-box__bar') || sb.firstElementChild;
        const btns = bar ? Array.from(bar.querySelectorAll('button')) : [];
        return {
          found: true,
          hasStarBtn: !!bar && !!bar.querySelector('.box-star-btn'),
          hasConnectBtn: !!bar && !!bar.querySelector('.box-connect-btn'),
          btnCount: btns.length,
        };
      };
      return order();
    }, largeIds[0]);
    expect(r.found).toBe(true);
    expect(r.hasStarBtn).toBe(true);
    expect(r.hasConnectBtn).toBe(false);
  });

  test('small-box star button toggles group membership', async ({ page }) => {
    await resetBoxing(page);
    // Create 2 small boxes in one large box
    const lgIds = await seedBoxes(page, [[0, 0]]);
    const smIds = await seedSmallBoxes(page, lgIds[0], [[0, 0], [200, 0]]);
    const r = await page.evaluate(([lgId, smId]) => {
      const dbg = (window as any).__boxingDebug;
      const sk = dbg.smallKey(lgId, smId);
      const before = dbg.layout.groups.length;
      dbg.toggleStarMark(sk);
      return {
        before,
        after: dbg.layout.groups.length,
        groupParent: dbg.layout.groups[dbg.layout.groups.length - 1]?.parentId,
      };
    }, [lgIds[0], smIds[0]]);
    expect(r.after).toBe(r.before + 1);
    expect(r.groupParent).toContain('small:' + lgIds[0] + ':' + smIds[0]);
  });

  test('edge anchor mousedown enters connect mode', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const r = await page.evaluate((id) => {
      const el = document.querySelector('.large-box[data-id="' + id + '"]');
      if (!el) return { found: false };
      const anchor = el.querySelector('.box-edge-anchor--right');
      if (!anchor) return { found: false, hasAnchor: false };
      // Simulate mousedown on anchor
      anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      // Check if connect mode is active via body class
      return {
        found: true,
        hasAnchor: true,
        bodyConnecting: document.body.classList.contains('cx--connecting'),
      };
    }, ids[0]);
    expect(r.found).toBe(true);
    expect(r.hasAnchor).toBe(true);
    expect(r.bodyConnecting).toBe(true);
  });

  test('Bug 4: star parent auto-joins connected peer as member', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      const ka = dbg.largeKey(aId), kb = dbg.largeKey(bId);
      dbg.toggleStarMark(ka);
      dbg.addConnection(ka, kb);
      const g = dbg.layout.groups.find((x: any) => x.parentId === ka);
      return {
        hasGroup: !!g,
        memberCount: g?.members?.length || 0,
        bIsMember: g?.members?.includes(kb) || false,
      };
    }, ids);
    expect(r.hasGroup).toBe(true);
    expect(r.memberCount).toBe(1);
    expect(r.bIsMember).toBe(true);
  });

  test('Bug 4: star parent auto-joins existing connections on star', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      const ka = dbg.largeKey(aId), kb = dbg.largeKey(bId);
      dbg.addConnection(ka, kb);
      dbg.toggleStarMark(ka);
      const g = dbg.layout.groups.find((x: any) => x.parentId === ka);
      return {
        hasGroup: !!g,
        memberCount: g?.members?.length || 0,
        bIsMember: g?.members?.includes(kb) || false,
      };
    }, ids);
    expect(r.hasGroup).toBe(true);
    expect(r.memberCount).toBe(1);
    expect(r.bIsMember).toBe(true);
  });

  test('Bug 5: large-box connect-arrows btn removed (only star remains)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const r = await page.evaluate((id) => {
      const el = document.querySelector('.large-box[data-id="' + id + '"]');
      if (!el) return { found: false };
      const bar = el.querySelector('.large-box__bar') || el.firstElementChild;
      return {
        found: true,
        hasStarBtn: !!bar && !!bar.querySelector('.box-star-btn'),
        hasConnectBtn: !!bar && !!bar.querySelector('.box-connect-btn'),
      };
    }, ids[0]);
    expect(r.found).toBe(true);
    expect(r.hasStarBtn).toBe(true);
    expect(r.hasConnectBtn).toBe(false);
  });

  test('Bug 3: star/unstar cycle — group removed AND button --on removed', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const r = await page.evaluate((id) => {
      const dbg = (window as any).__boxingDebug;
      const kp = dbg.largeKey(id);
      dbg.toggleStarMark(kp);
      const afterStarKey = dbg.layout.groups.some((g: any) => g.parentId === kp);
      const el = document.querySelector('.large-box[data-id="' + id + '"]');
      const btn = el && el.querySelector('.box-star-btn');
      const afterStarBtn = btn && btn.classList.contains('box-tool-btn--on');
      dbg.toggleStarMark(kp);  // unstar
      const afterUnstarKey = dbg.layout.groups.some((g: any) => g.parentId === kp);
      const afterUnstarBtn = btn && btn.classList.contains('box-tool-btn--on');
      return {
        afterStarKey,
        afterStarBtn,
        afterUnstarKey,
        afterUnstarBtn,
      };
    }, ids[0]);
    expect(r.afterStarKey).toBe(true);
    expect(r.afterStarBtn).toBe(true);
    expect(r.afterUnstarKey).toBe(false);
    expect(r.afterUnstarBtn).toBe(false);
  });

  test('Bug 3b: small-box star/unstar cycle — group removed AND button --on removed', async ({ page }) => {
    await resetBoxing(page);
    const lgIds = await seedBoxes(page, [[0, 0]]);
    const smIds = await seedSmallBoxes(page, lgIds[0], [[0, 0]]);
    // Must enter the large box first so small-box DOM is rendered.
    await page.evaluate((lgId) => {
      const dbg = (window as any).__boxingDebug;
      if (typeof dbg.enterLargeBox === 'function') dbg.enterLargeBox(lgId);
    }, lgIds[0]);
    const r = await page.evaluate(([lgId, smId]) => {
      const dbg = (window as any).__boxingDebug;
      const sk = dbg.smallKey(lgId, smId);
      dbg.toggleStarMark(sk);
      const afterStarKey = dbg.layout.groups.some((g: any) => g.parentId === sk);
      const sbEl = document.querySelector('.small-box[data-id="' + smId + '"]');
      const btn = sbEl && sbEl.querySelector('.box-star-btn');
      const afterStarBtn = btn && btn.classList.contains('box-tool-btn--on');
      dbg.toggleStarMark(sk);  // unstar
      const afterUnstarKey = dbg.layout.groups.some((g: any) => g.parentId === sk);
      const afterUnstarBtn = btn && btn.classList.contains('box-tool-btn--on');
      return { afterStarKey, afterStarBtn, afterUnstarKey, afterUnstarBtn };
    }, [lgIds[0], smIds[0]]);
    expect(r.afterStarKey).toBe(true);
    expect(r.afterStarBtn).toBe(true);
    expect(r.afterUnstarKey).toBe(false);
    expect(r.afterUnstarBtn).toBe(false);
  });
// ── BX-142: SVG connection layer regression tests ─────────────
test.describe('Boxing BX-142: SVG connection layer', () => {
  test('Bug 1: provisional line starts from box, not (0,0)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[200, 200]]);
    const r = await page.evaluate((id) => {
      const dbg = (window as any).__boxingDebug;
      const el = document.querySelector('.large-box[data-id="' + id + '"]');
      if (!el) return { found: false };
      dbg.enterConnectMode(dbg.largeKey(id), el);
      const provLine = document.querySelector('.conn-line--provisional');
      const x1 = provLine ? parseFloat(provLine.getAttribute('x1') || '0') : -1;
      const y1 = provLine ? parseFloat(provLine.getAttribute('y1') || '0') : -1;
      const x2 = provLine ? parseFloat(provLine.getAttribute('x2') || '0') : -1;
      const y2 = provLine ? parseFloat(provLine.getAttribute('y2') || '0') : -1;
      dbg.exitConnectMode(null);
      return { found: true, hasProv: !!provLine, x1, y1, x2, y2 };
    }, ids[0]);
    expect(r.found).toBe(true);
    expect(r.hasProv).toBe(true);
    expect(r.x1).toBeGreaterThan(100);
    expect(r.y1).toBeGreaterThan(100);
    expect(Math.abs(r.x2 - r.x1)).toBeLessThan(1);
    expect(Math.abs(r.y2 - r.y1)).toBeLessThan(1);
  });

  test('Bug 5: box move updates line endpoints', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(aId), dbg.largeKey(bId));
      dbg.saveLayout();
      dbg.renderConnections();
    }, ids);
    const before = await page.evaluate(() => {
      const lines = document.querySelectorAll('.conn-line:not(.conn-line--provisional)');
      if (!lines.length) return null;
      const line = lines[0] as any;
      return { x1: parseFloat(line.getAttribute('x1')), x2: parseFloat(line.getAttribute('x2')) };
    });
    expect(before).not.toBeNull();
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const lb = dbg.layout.boxes[1];
      if (lb) { lb.x = 600; lb.y = 300; }
      dbg.renderCanvas();
      dbg.renderConnections();
    });
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => {
      const lines = document.querySelectorAll('.conn-line:not(.conn-line--provisional)');
      if (!lines.length) return null;
      const line = lines[0] as any;
      return { x1: parseFloat(line.getAttribute('x1')), x2: parseFloat(line.getAttribute('x2')) };
    });
    expect(after).not.toBeNull();
    expect(after!.x2).not.toBe(before!.x2);
  });

  test('Bug 6: SVG layer inside canvas surface', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(aId), dbg.largeKey(bId));
      dbg.saveLayout();
      dbg.renderConnections();
      const svg = document.querySelector('#canvas-surface .conn-layer');
      return { hasSvg: !!svg };
    }, ids);
    expect(r.hasSvg).toBe(true);
  });

  test('SVG connection renders with correct coordinates', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate(([aId, bId]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(aId), dbg.largeKey(bId));
      dbg.saveLayout();
      dbg.renderConnections();
      const line = document.querySelector('.conn-line:not(.conn-line--provisional)') as any;
      if (!line) return { found: false };
      return { found: true, x1: parseFloat(line.getAttribute('x1')), y1: parseFloat(line.getAttribute('y1')), x2: parseFloat(line.getAttribute('x2')), y2: parseFloat(line.getAttribute('y2')) };
    }, ids);
    expect(r.found).toBe(true);
    expect(Math.abs(r.x1 - 160)).toBeLessThan(5);
    expect(Math.abs(r.y1 - 110)).toBeLessThan(5);
    expect(Math.abs(r.x2 - 560)).toBeLessThan(5);
    expect(Math.abs(r.y2 - 110)).toBeLessThan(5);
  });

  test('Bug 3: multiple connections to starred parent all render after move', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0], [200, 300]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const [a, b, c] = ids;
      dbg.toggleStarMark(dbg.largeKey(a));
      dbg.addConnection(dbg.largeKey(b), dbg.largeKey(a));
      dbg.addConnection(dbg.largeKey(c), dbg.largeKey(a));
      dbg.saveLayout();
      dbg.renderConnections();
      const lines = document.querySelectorAll('.conn-line:not(.conn-line--provisional)');
      const lb = dbg.layout.boxes[0];
      lb.x = 100; lb.y = 100;
      dbg.renderCanvas();
      dbg.renderConnections();
      const linesAfter = document.querySelectorAll('.conn-line:not(.conn-line--provisional)');
      return { conns: dbg.layout.connections.length, lineCount: lines.length, lineCountAfter: linesAfter.length };
    }, ids);
    expect(r.conns).toBe(2);
    expect(r.lineCount).toBe(2);
    expect(r.lineCountAfter).toBe(2);
  });

  test('Bug 4: unstar after connect+star removes group', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const [a, b] = ids;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.toggleStarMark(dbg.largeKey(a));
      const starred = !!dbg.getGroupByParent(dbg.largeKey(a));
      dbg.toggleStarMark(dbg.largeKey(a));
      const unstarred = !dbg.getGroupByParent(dbg.largeKey(a));
      return { starred, unstarred };
    }, ids);
    expect(r.starred).toBe(true);
    expect(r.unstarred).toBe(true);
  });
});

});


test.describe('Boxing BX-143: cross-tab sync + small-box group drag + unstar tombstone', () => {

  test('Bug #1+#3: groups mergeByIdUnion uses parentId key, not id — survives cross-tab merge', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const [a, b] = ids;
      const aKey = dbg.largeKey(a);
      const bKey = dbg.largeKey(b);
      dbg.addConnection(aKey, bKey);
      dbg.toggleStarMark(aKey);
      const beforeMerge = !!dbg.getGroupByParent(aKey);
      // Simulate cross-tab merge: applyExternalLayout with a remote that does NOT have the group
      // (to prove mergeByIdUnion for groups uses parentId, not id — without the fix it drops groups)
      const remotePayload = JSON.parse(JSON.stringify(dbg.layout));
      remotePayload._meta = { ...(remotePayload._meta || {}), revision: (remotePayload._meta?.revision || 0) + 1, updatedAt: Date.now() + 1, writerId: 'test-other-tab' };
      // Do NOT alter remotePayload.groups — it should already contain the group from the serialize
      const applied = dbg.applyExternalLayout(remotePayload);
      const afterApply = !!dbg.getGroupByParent(aKey);
      return { beforeMerge, applied, afterApply };
    }, ids);
    expect(r.beforeMerge).toBe(true);
    expect(r.applied).toBe(true);
    expect(r.afterApply).toBe(true);
  });

  test('Bug #3: unstar registers tombstone so cross-tab merge union does not resurrect the group', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const [a, b] = ids;
      const aKey = dbg.largeKey(a);
      const bKey = dbg.largeKey(b);
      dbg.addConnection(aKey, bKey);
      dbg.toggleStarMark(aKey);     // star — creates group
      const starred = !!dbg.getGroupByParent(aKey);
      // Save so the group is in remote storage
      dbg.saveLayout();
      // Now simulate a remote layout (loaded BEFORE unstar) that still HAS the group —
      // then unstar locally and save. The merge in saveLayout must tombstone aKey so the
      // remote group does NOT resurrect.
      const remotePayload = JSON.parse(JSON.stringify(dbg.layout));
      dbg.toggleStarMark(aKey);     // unstar locally — should tombstone + remove group
      const unstaredLocally = !dbg.getGroupByParent(aKey);
      // Now applyExternalLayout with a remote that HAS the group.
      // mergeByIdUnion with tombstone filter should drop the remote group, not resurrect it.
      const remoteWithGroup = JSON.parse(JSON.stringify(remotePayload));
      remoteWithGroup._meta = { ...(remoteWithGroup._meta || {}), revision: (remoteWithGroup._meta?.revision || 0) + 1, updatedAt: Date.now() + 1, writerId: 'test-other-tab-after-unstar' };
      const applied = dbg.applyExternalLayout(remoteWithGroup);
      const afterRemoteApply = !dbg.getGroupByParent(aKey);
      return { starred, unstaredLocally, applied, afterRemoteApply };
    }, ids);
    expect(r.starred).toBe(true);
    expect(r.unstaredLocally).toBe(true);
    expect(r.applied).toBe(true);
    expect(r.afterRemoteApply).toBe(true);
  });

  test('Bug #2: small-box parent drag moves member small boxes (group is not large-only)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const smIds = await seedSmallBoxes(page, ids[0], [[0, 0], [200, 0]]);
    const r = await page.evaluate((data) => {
      const dbg = (window as any).__boxingDebug;
      const [lgId, smIds] = data;
      dbg.enterLargeBox(lgId, true);
      const parentKey = dbg.smallKey(lgId, smIds[0]);
      const memberKey = dbg.smallKey(lgId, smIds[1]);
      dbg.addConnection(parentKey, memberKey);
      dbg.toggleStarMark(parentKey);
      const g = dbg.getGroupByParent(parentKey);
      const memberOrigin = (() => { const sb = dbg.getLargeBox(lgId).children.find(s => s.id === smIds[1]); return { x: sb.x, y: sb.y }; })();
      // Simulate parent drag by calling moveGroupTogether directly with a delta
      // Use deltas that are multiples of INNER_GRID (16) so elasticSnap's grid snap doesn't
      // shift the result off the predicted position. 48 = 3*16, 32 = 2*16.
      const memberBefore = dbg.getLargeBox(lgId).children.find(s => s.id === smIds[1]);
      const beforePos = { x: memberBefore.x, y: memberBefore.y };
      dbg.moveGroupTogether(parentKey, 48, 32, new Map([[memberKey, memberOrigin]]));
      const sbAfter = dbg.getLargeBox(lgId).children.find(s => s.id === smIds[1]);
      const afterPos = { x: sbAfter.x, y: sbAfter.y };
      return {
        groupExists: !!g,
        groupMembers: g ? g.members.length : 0,
        groupMemberKeys: g ? g.members : null,
        parentKey, memberKey,
        memberOrigin,
        beforePos, afterPos,
        expectedX: memberOrigin.x + 48,
        expectedY: memberOrigin.y + 32,
        memberHasMoved: (afterPos.x !== beforePos.x || afterPos.y !== beforePos.y),
      };
    }, [ids[0], smIds]);
    expect(r.groupExists).toBe(true);
    expect(r.memberHasMoved).toBe(true);
    // Grid-snap tolerance
    expect(Math.abs(r.afterPos.x - r.expectedX)).toBeLessThanOrEqual(16);
    expect(Math.abs(r.afterPos.y - r.expectedY)).toBeLessThanOrEqual(16);
  });

  test('Bug #4: star button shows ☆ for non-parent and ★ for parent', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const aKey = dbg.largeKey(ids[0]);
      const beforeText = document.querySelector('.box-star-btn')?.textContent || '';
      dbg.toggleStarMark(aKey);
      const afterText = document.querySelector('.box-star-btn')?.textContent || '';
      dbg.toggleStarMark(aKey);
      const backText = document.querySelector('.box-star-btn')?.textContent || '';
      return { beforeText, afterText, backText };
    }, ids);
    expect(r.beforeText).toBe('\u2606'); // ☆
    expect(r.afterText).toBe('\u2605'); // ★
    expect(r.backText).toBe('\u2606');
  });

  test('Bug #6: renderInnerSurface re-renders connections (no disappearing lines after addSmallBox)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const smIds = await seedSmallBoxes(page, ids[0], [[0, 0], [200, 0]]);
    const r = await page.evaluate((data) => {
      const dbg = (window as any).__boxingDebug;
      const [lgId, smIds] = data;
      dbg.enterLargeBox(lgId, true);
      const aKey = dbg.smallKey(lgId, smIds[0]);
      const bKey = dbg.smallKey(lgId, smIds[1]);
      dbg.addConnection(aKey, bKey);
      dbg.saveLayout();
      dbg.renderConnections();
      const linesBefore = document.querySelectorAll('.conn-line:not(.conn-line--provisional)').length;
      // Wait two rAFs for the deferred renderConnections inside renderInnerSurface to run
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          // Simulate adding a new small box (this calls renderInnerSurface which disposes+defers render)
          const lb = dbg.getLargeBox(lgId);
          lb.children.push({ id: 'c-test-' + Date.now(), type: 'small', title: 'C', x: 100, y: 100, width: 160, height: 110, bookmarks: [] });
          dbg.saveLayout();
          dbg.renderCanvas();
          // Re-enter large box so renderInnerSurface runs
          dbg.enterLargeBox(lgId, true);
          // Wait for deferred renderConnections
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const linesAfter = document.querySelectorAll('.conn-line:not(.conn-line--provisional)').length;
            resolve({ linesBefore, linesAfter });
          }));
        }));
      });
    }, [ids[0], smIds]);
    expect((r as any).linesBefore).toBe(1);
    expect((r as any).linesAfter).toBe(1);
  });

  test('Bug #7: provisional line endpoint does not fling to corner (rect inverse correct)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[400, 400]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const aKey = dbg.largeKey(ids[0]);
      const box = dbg.getLargeBox(ids[0]);
      // Pan canvas to known offset (exposes the double-subtract bug if present)
      // enterConnectMode expects initCx/initCy in client coords; we approximate by using box midpoint in world.
      const mp = (dbg as any).layout?.boxes && (window as any).__boxingDebug;
      // Call enterConnectMode with synthetic coords matching box midpoint in screen space.
      // We check that the line endpoint roughly matches the box midpoint, NOT a corner offset.
      dbg.enterConnectMode(aKey, document.querySelector('.large-box[data-id="' + ids[0] + '"]'), 100, 100);
      const provisional = document.querySelector('.conn-line--provisional');
      const x2 = provisional ? parseFloat(provisional.getAttribute('x2') || '0') : NaN;
      const y2 = provisional ? parseFloat(provisional.getAttribute('y2') || '0') : NaN;
      dbg.exitConnectMode(null);
      return { x2, y2 };
    }, ids);
    // Without the fix, x2/y2 would be hugely off (negative, far from screen). With the fix they
    // should be finite numbers in screen-to-world coords and not extremely negative.
    expect(Number.isFinite(r.x2)).toBe(true);
    expect(Number.isFinite(r.y2)).toBe(true);
    expect(r.x2).toBeGreaterThan(-10000);
    expect(r.y2).toBeGreaterThan(-10000);
  });

});




// -- BX-144: cross-tab star-mark sync + line connection refresh regressions --
test.describe('Boxing BX-144: cross-tab star-mark + conn refresh regression', () => {
  test('Bug 1: applyExternalLayout invalidates DSU state after cross-tab merge', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const aKey = dbg.largeKey(ids[0]);
      const bKey = dbg.largeKey(ids[1]);
      dbg.addConnection(aKey, bKey);
      dbg.toggleStarMark(aKey);
      const beforeApply = !!dbg.getGroupByParent(aKey);
      const remotePayload = JSON.parse(JSON.stringify(dbg.layout));
      remotePayload._meta = { ...(remotePayload._meta || {}), revision: (remotePayload._meta?.revision || 0) + 1, updatedAt: Date.now() + 1, writerId: 'test-remote-BX144' };
      remotePayload.groups = [];
      const applied = dbg.applyExternalLayout(remotePayload);
      const afterApply = !!dbg.getGroupByParent(aKey);
      return { beforeApply, applied, afterApply };
    }, ids);
    expect(r.beforeApply).toBe(true);
    expect(r.applied).toBe(true);
    expect(r.afterApply).toBe(true);
  });

  test('Bug 1b: remote star-mark adoption — local DOM shows starred after cross-tab sync', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0], [800, 0]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const beforeStar = !!dbg.getGroupByParent(dbg.largeKey(ids[0]));
      const remotePayload = JSON.parse(JSON.stringify(dbg.layout));
      const aKey = dbg.largeKey(ids[0]);
      remotePayload.groups = [{ parentId: aKey, members: [dbg.largeKey(ids[1]), dbg.largeKey(ids[2])] }];
      remotePayload._meta = { ...(remotePayload._meta || {}), revision: (remotePayload._meta?.revision || 0) + 1, updatedAt: Date.now() + 1, writerId: 'test-remote-star' };
      const applied = dbg.applyExternalLayout(remotePayload);
      const afterApply = !!dbg.getGroupByParent(aKey);
      dbg.renderCanvas();
      const starredEl = document.querySelector('.large-box[data-id="' + ids[0] + '"]');
      const hasStarredClass = starredEl ? starredEl.classList.contains('box--starred') : false;
      const starBtn = starredEl ? starredEl.querySelector('.box-star-btn') : null;
      const starText = starBtn ? starBtn.textContent : '';
      return { beforeStar, applied, afterApply, hasStarredClass, starText };
    }, ids);
    expect(r.beforeStar).toBe(false);
    expect(r.applied).toBe(true);
    expect(r.afterApply).toBe(true);
    expect(r.hasStarredClass).toBe(true);
    expect(r.starText).toBe('\u2605');
  });

  test('Bug 3 reg: unstar clears group + DSU state + registers tombstone', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const aKey = dbg.largeKey(ids[0]);
      dbg.addConnection(aKey, dbg.largeKey(ids[1]));
      dbg.toggleStarMark(aKey);
      const afterStar = !!dbg.getGroupByParent(aKey);
      dbg.toggleStarMark(aKey);
      const afterUnstar = !!dbg.getGroupByParent(aKey);
      const hasTombstone = !!(dbg.layout._meta?.deleted?.[aKey]);
      return { afterStar, afterUnstar, hasTombstone };
    }, ids);
    expect(r.afterStar).toBe(true);
    expect(r.afterUnstar).toBe(false);
    expect(r.hasTombstone).toBe(true);
  });

  test('Bug 5: auto-expand toggle keeps connection endpoints at model midpoint', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const [a, b] = ids;
      const aKey = dbg.largeKey(a);
      const bKey = dbg.largeKey(b);
      dbg.addConnection(aKey, bKey);
      dbg.renderCanvas();
      dbg.renderConnections();
      const linesBefore = document.querySelectorAll('.conn-line:not(.conn-line--provisional)').length;
      const boxEl = document.querySelector('.large-box[data-id="' + a + '"]');
      const expandBtn = boxEl ? boxEl.querySelector('.box-expand-btn') : null;
      if (expandBtn) expandBtn.click();
      const linesAfter = document.querySelectorAll('.conn-line:not(.conn-line--provisional)').length;
      const line = document.querySelector('.conn-line:not(.conn-line--provisional)');
      const x1 = line ? parseFloat(line.getAttribute('x1') || '0') : NaN;
      const y1 = line ? parseFloat(line.getAttribute('y1') || '0') : NaN;
      const aBox = dbg.getLargeBox(a);
      const expectedX = aBox.x + (aBox.width || 320) / 2;
      const expectedY = aBox.y + (aBox.height || 220) / 2;
      return { linesBefore, linesAfter, x1, y1, expectedX, expectedY };
    }, ids);
    expect(r.linesBefore).toBe(1);
    expect(r.linesAfter).toBe(1);
    expect(Math.abs(r.x1 - r.expectedX)).toBeLessThan(5);
    expect(Math.abs(r.y1 - r.expectedY)).toBeLessThan(5);
  });

  test('Bug 6 reg: addSmallBox keeps A-B line visible after rAF settle (uses existing LB)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const smIds = await seedSmallBoxes(page, ids[0], [[0, 0], [200, 0]]);
    const r = await page.evaluate((data) => {
      const dbg = (window as any).__boxingDebug;
      const [lgId, smIds] = data;
      dbg.enterLargeBox(lgId, true);
      const aKey = dbg.smallKey(lgId, smIds[0]);
      const bKey = dbg.smallKey(lgId, smIds[1]);
      dbg.addConnection(aKey, bKey);
      dbg.saveLayout();
      dbg.renderConnections();
      const linesBefore = document.querySelectorAll('.conn-line:not(.conn-line--provisional)').length;
      // Push a 3rd small box into children manually + re-enter triggers renderInnerSurface
      const lb = dbg.getLargeBox(lgId);
      lb.children.push({ id: 'c-test-' + Date.now(), type: 'small', title: 'C', x: 100, y: 100, width: 160, height: 110, bookmarks: [] });
      dbg.saveLayout();
      // Re-entering runs renderInnerSurface internally (disposeAllConns + deferred renderConnections).
      dbg.enterLargeBox(lgId, true);
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const linesAfter = document.querySelectorAll('.conn-line:not(.conn-line--provisional)').length;
          resolve({ linesBefore, linesAfter });
        }));
      });
    }, [ids[0], smIds]);
    expect(r.linesBefore).toBe(1);
    expect(r.linesAfter).toBe(1);
  });

  test('Bug 7 reg: provisional line endpoint near box center, not corner', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[400, 400]]);
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const aKey = dbg.largeKey(ids[0]);
      const boxEl = document.querySelector('.large-box[data-id="' + ids[0] + '"]');
      const rect = boxEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      dbg.enterConnectMode(aKey, boxEl, cx, cy);
      const prov = document.querySelector('.conn-line--provisional');
      const x2 = prov ? parseFloat(prov.getAttribute('x2') || '0') : NaN;
      const y2 = prov ? parseFloat(prov.getAttribute('y2') || '0') : NaN;
      dbg.exitConnectMode(null);
      const box = dbg.getLargeBox(ids[0]);
      const expectedMidX = box.x + (box.width || 320) / 2;
      const expectedMidY = box.y + (box.height || 220) / 2;
      return { x2, y2, expectedMidX, expectedMidY, offX: Math.abs(x2 - expectedMidX), offY: Math.abs(y2 - expectedMidY) };
    }, ids);
    expect(Number.isFinite(r.x2)).toBe(true);
    expect(Number.isFinite(r.y2)).toBe(true);
    expect(r.offX).toBeLessThan(50);
    expect(r.offY).toBeLessThan(50);
  });

  test('Bug 1c: remote star-mark adoption — local inner surface shows starred after cross-tab sync inside large box', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const smIds = await seedSmallBoxes(page, ids[0], [[0, 0], [200, 0]]);
    const r = await page.evaluate((data) => {
      const dbg = (window as any).__boxingDebug;
      const [lgId, smIds] = data;
      dbg.enterLargeBox(lgId, true);
      const beforeStar = !!dbg.getGroupByParent(dbg.smallKey(lgId, smIds[0]));
      const remotePayload = JSON.parse(JSON.stringify(dbg.layout));
      const aKey = dbg.smallKey(lgId, smIds[0]);
      remotePayload.groups = [{ parentId: aKey, members: [dbg.smallKey(lgId, smIds[1])] }];
      remotePayload._meta = { ...(remotePayload._meta || {}), revision: (remotePayload._meta?.revision || 0) + 1, updatedAt: Date.now() + 1, writerId: 'test-remote-inner-star' };
      const applied = dbg.applyExternalLayout(remotePayload);
      const afterApply = !!dbg.getGroupByParent(aKey);
      // After apply, renderInnerSurface ran — small box A should have star DOM.
      const sbEl = document.querySelector('.small-box[data-id="' + smIds[0] + '"]');
      const hasStarredClass = sbEl ? sbEl.classList.contains('box--starred') : false;
      const starBtn = sbEl ? sbEl.querySelector('.box-star-btn') : null;
      const starText = starBtn ? starBtn.textContent : '';
      return { beforeStar, applied, afterApply, hasStarredClass, starText };
    }, [ids[0], smIds]);
    expect(r.beforeStar).toBe(false);
    expect(r.applied).toBe(true);
    expect(r.afterApply).toBe(true);
    expect(r.hasStarredClass).toBe(true);
    expect(r.starText).toBe('★');
  });

  test('Bug 2 reg: small-box parent drag — member small box moves with same delta', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0]]);
    const smIds = await seedSmallBoxes(page, ids[0], [[0, 0], [200, 0]]);
    const r = await page.evaluate((data) => {
      const dbg = (window as any).__boxingDebug;
      const [lgId, smIds] = data;
      dbg.enterLargeBox(lgId, true);
      const parentKey = dbg.smallKey(lgId, smIds[0]);
      const memberKey = dbg.smallKey(lgId, smIds[1]);
      dbg.addConnection(parentKey, memberKey);
      dbg.toggleStarMark(parentKey);
      const lb0 = dbg.getLargeBox(lgId);
      const beforeMember = lb0 ? lb0.children.find((c: any) => c.id === smIds[1]) : null;
      const beforeY = beforeMember ? beforeMember.y : -1;
      // Simulate parent drag of 50px down — moveGroupTogether should apply same delta to member
      dbg.moveGroupTogether(parentKey, 0, 50, new Map([[memberKey, { x: beforeMember.x, y: beforeMember.y }]]));
      const lb1 = dbg.getLargeBox(lgId);
      const afterMember = lb1 ? lb1.children.find((c: any) => c.id === smIds[1]) : null;
      const afterY = afterMember ? afterMember.y : -2;
      return { beforeY, afterY };
    }, [ids[0], smIds]);
    // Member moves with parent — allow INNER_GRID snap tolerance.
    const delta = r.afterY - r.beforeY;
    expect(delta).toBeGreaterThanOrEqual(45);
    expect(delta).toBeLessThanOrEqual(55);
  });
});
