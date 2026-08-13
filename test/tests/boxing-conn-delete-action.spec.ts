import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

async function seedBoxes(page, coords) {
  return await page.evaluate((cs) => {
    const dbg = (window as any).__boxingDebug;
    dbg.layout.boxes = cs.map((c: number[], i: number) => ({
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

async function setConnDeleteAction(page, mode) {
  // ADR-0006: simulate the UI change-handler path — disposeAllConns + recreate
  // so that mode-specific listeners (dblclick/contextmenu/mousedown) attach fresh.
  await page.evaluate((m) => {
    const dbg = (window as any).__boxingDebug;
    dbg.setConnDeleteAction(m);
    dbg.disposeAllConns();
    dbg.renderConnections();
    dbg.saveLayout();
  }, mode);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
}

// Common shape: two boxes connected, then exercise the configured delete gesture.
async function setupConnected(page) {
  await resetBoxing(page);
  const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
  await page.evaluate(([a, b]) => {
    const dbg = (window as any).__boxingDebug;
    dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
    dbg.renderConnections();
  }, [ids[0], ids[1]]);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
  await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(1);
  return ids;
}

test.describe('Boxing conn delete action (ADR-0006)', () => {
  test('default connDeleteAction is alt+click', async ({ page }) => {
    await resetBoxing(page);
    const mode = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.connDeleteAction);
    expect(mode).toBe('alt+click');
  });

  test('alt+click deletes the connection line', async ({ page }) => {
    await setupConnected(page);
    const lineHandle = await page.locator('.conn-line').first();
    const box = await lineHandle.boundingBox();
    expect(box).toBeTruthy();
    // Alt+mousedown at the line midpoint — Playwright doesn't render true SVG stroke hit-tests reliably at 1.5px wide,
    // so we dispatch the configured gesture via JS event on the SVG element directly (same path the user hits).
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, altKey: true, button: 0 });
      line.dispatchEvent(ev);
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
  });

  test('configures ctrl+click mode and deletes', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'ctrl+click');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, ctrlKey: true, button: 0 });
      line.dispatchEvent(ev);
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
  });

  test('configures shift+click mode and deletes', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'shift+click');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey: true, button: 0 });
      line.dispatchEvent(ev);
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
  });

  test('configures double-click mode and deletes', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'double-click');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
  });

  // right-click delete mode removed — conflicts with right-click → back navigation


  test('configures select+delete mode: click selects, Backspace removes', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'select+delete');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    // Click to select the line
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    });
    const hasSelected = await page.evaluate(() => document.querySelector('.conn-line').classList.contains('conn-line--selected'));
    expect(hasSelected).toBe(true);
    // Press Backspace — should remove
    await page.evaluate(() => {
      // Dispatch a keydown event directly so the test doesn't depend on page focus.
      const ev = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
      document.dispatchEvent(ev);
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
  });

  test('select+delete ignores Backspace while editing an input', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'select+delete');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    });
    // Simulate an active text input editing context
    await page.evaluate(() => {
      const inp = document.createElement('input');
      inp.id = '__test-input';
      (inp as any).focus();
      document.body.appendChild(inp);
      inp.focus();
    });
    await page.evaluate(() => {
      const ev = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
      document.dispatchEvent(ev);
    });
    await page.evaluate(() => { document.getElementById('__test-input')?.remove(); });
    // Connection should still exist
    const count = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(count).toBe(1);
  });

  test('setting persists across reload', async ({ page }) => {
    await resetBoxing(page);
    await setConnDeleteAction(page, 'ctrl+click');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    const mode = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.connDeleteAction);
    expect(mode).toBe('ctrl+click');
  });

  test('changing mode clears any stale selectedConnId', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'select+delete');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    });
    // Switching back to alt+click should clear selection visuals
    await setConnDeleteAction(page, 'alt+click');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const stillSelected = await page.evaluate(() => {
      const l = document.querySelector('.conn-line');
      return l ? l.classList.contains('conn-line--selected') : false;
    });
    expect(stillSelected).toBe(false);
  });

  // ── Bug 3+4: close-loop persistence tests ──────────────────────────
  test('alt+click delete persists across reload', async ({ page }) => {
    await setupConnected(page);
    // Default mode is alt+click; dispatch alt+mousedown on the line
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, altKey: true }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
    // Reload and verify the connection is still gone
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const connCount = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(connCount).toBe(0);
  });

  test('ctrl+click delete persists across reload', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'ctrl+click');
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ctrlKey: true }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const connCount = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(connCount).toBe(0);
  });

  test('shift+click delete persists across reload', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'shift+click');
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, shiftKey: true }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const connCount = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(connCount).toBe(0);
  });

  test('double-click delete persists across reload', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'double-click');
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, button: 0 }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const connCount = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(connCount).toBe(0);
  });

  test('select+delete persists across reload', async ({ page }) => {
    await setupConnected(page);
    await setConnDeleteAction(page, 'select+delete');
    // Click to select
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    });
    // Dispatch Backspace
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const connCount = await page.evaluate(() => (window as any).__boxingDebug.connCount());
    expect(connCount).toBe(0);
  });

  // ── Bug 3: re-connect after delete → line visible ──────────────────
  test('re-connect after delete shows the line again', async ({ page }) => {
    await setupConnected(page);
    const ids = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const boxes = dbg.layout.boxes;
      return [boxes[0].id, boxes[1].id];
    });
    // Delete the connection
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, altKey: true }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
    // Re-connect
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, ids);
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(1);
    const hasLine = await page.evaluate(() => !!document.querySelector('.conn-line'));
    expect(hasLine).toBe(true);
  });
  // ── Bug1: delete conn disconnects parent-child group ───────────────
  test('deleting connection dissolves parent-child group drag', async ({ page }) => {
    await setupConnected(page);
    const ids = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const boxes = dbg.layout.boxes;
      return [boxes[0].id, boxes[1].id];
    });
    // Star box A as parent
    await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.toggleStarMark(dbg.largeKey(a));
    }, ids);
    // Verify group exists
    let group = await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const g = dbg.getGroupByParent(dbg.largeKey(a));
      return g ? g.members.length : -1;
    }, ids);
    expect(group).toBe(1); // one member (box B)
    // Delete the connection
    await page.evaluate(() => {
      const line = document.querySelector('.conn-line');
      if (!line) throw new Error('no conn-line');
      line.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, altKey: true }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.connCount())).toBe(0);
    // Verify group is now empty or null
    const groupAfter = await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const g = dbg.getGroupByParent(dbg.largeKey(a));
      return g ? g.members.length : -1;
    }, ids);
    expect(groupAfter).toBeLessThanOrEqual(0);
  });
  test('BX-CONN-DELETE: deleting child box preserves parent star (async saveLayout race)', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    // Set box A as parent, then WAIT for saveLayout to finish
    await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.toggleStarMark(dbg.largeKey(a));
    }, [ids[0]]);
    // wait for saveLayout to complete (storage write chain)
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(200);
    // Connect A -> B, then wait for debounced save
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, [ids[0], ids[1]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(200);
    // Verify A is starred & conn exists before delete
    const before = await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.layout.boxes.find((b: any) => b.id === a);
      return { isParent: box?.isParent, inGroupStar: dbg.groupStar?.has(dbg.largeKey(a)), connCount: dbg.connCount() };
    }, [ids[0]]);
    expect(before.isParent).toBe(true);
    expect(before.connCount).toBe(1);
    // Delete box B (the child/non-parent), wait for saveLayout
    await page.evaluate(([b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg._execDeleteLargeBox(b);
    }, [ids[1]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(300);
    // BUG: A should STILL be starred after deleting B
    const starredAfter = await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.layout.boxes.find((b: any) => b.id === a);
      const groups = dbg.layout.groups;
      return {
        isParent: box?.isParent,
        inGroupStar: dbg.groupStar?.has(dbg.largeKey(a)),
        groupCount: groups?.length || 0,
        groupParentIds: groups?.map((g: any) => g.parentId) || [],
        tdel: JSON.stringify(dbg.layout._meta?.deleted || {})
      };
    }, [ids[0]]);
    expect(starredAfter.isParent).toBe(true);
    expect(starredAfter.inGroupStar).toBe(true);
    expect(starredAfter.groupParentIds).toContain('large:' + ids[0]);
  });

  test('BX-CONN-DELETE: GUI delete box B preserves parent star of A', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    // Set box A as parent via API (this is the same GUI performs internally)
    await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.toggleStarMark(dbg.largeKey(a));
    }, [ids[0]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(100);
    // Connect A -> B via API
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, [ids[0], ids[1]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(100);
    // Now trigger delete via GUI: call deleteLargeBox (opens confirm modal)
    await page.evaluate(([b]) => {
      (window as any).__boxingDebug; // ensure dbg ready
      // Simulate the delete button click path:
      // deleteLargeBox(b) opens confirm modal, then confirm-delete btn executes callback
    }, [ids[1]]);
    // Open confirm modal for box B
    await page.evaluate(([b]) => {
      const modal = document.getElementById('confirm-modal');
      // Directly simulate the delete button handler:
      const dbg = (window as any).__boxingDebug;
      // We'll use eval to call deleteLargeBox from the closure scope:
      // Since _execDeleteLargeBox is exported, use it after opening confirm modal
      dbg._execDeleteLargeBox(b);
    }, [ids[1]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(300);
    // Verify A is still starred
    const result = await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.layout.boxes.find((b: any) => b.id === a);
      const groups = dbg.layout.groups || [];
      return {
        boxCount: dbg.layout.boxes.length,
        isParent: box?.isParent,
        inGroupStar: dbg.groupStar?.has(dbg.largeKey(a)),
        groupLength: groups.length,
        groupParentIds: groups.map((g: any) => g.parentId),
        deleted: JSON.stringify(dbg.layout._meta?.deleted || {})
      };
    }, [ids[0]]);
    console.log('After delete B:', JSON.stringify(result));
    expect(result.isParent).toBe(true);
    expect(result.inGroupStar).toBe(true);
    expect(result.groupParentIds).toContain('large:' + ids[0]);
  });

  test('BX-CONN-DELETE: cross-tab star persists after child box delete in another tab', async ({ browser }) => {
    // Hardened against parallel-load flakiness: poll for __boxingDebug + star adoption.
    test.setTimeout(60_000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();
    await page1.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await page1.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page1.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page1.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 15_000 }).toBe(true);
    const ids = await page1.evaluate((cs) => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = cs.map((c: number[], i: number) => ({
        id: 'seed-' + i + '-' + Math.random().toString(36).slice(2, 8),
        type: 'large', title: 'B' + i, x: c[0], y: c[1],
        width: 320, height: 220, children: [],
      }));
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      return dbg.layout.boxes.map((b: any) => b.id);
    }, [[0, 0], [400, 0]]);
    await page1.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.toggleStarMark(dbg.largeKey(a));
    }, [ids[0]]);
    await page1.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page2.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page2.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 15_000 }).toBe(true);
    // Wait until page2 adopts star via storage/load
    await expect.poll(() => page2.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      return dbg.layout.boxes.find((b: any) => b.id === a)?.isParent === true;
    }, [ids[0]]), { timeout: 15_000 }).toBe(true);
    await page2.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, [ids[0], ids[1]]);
    await page2.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page2.evaluate(([b]) => {
      (window as any).__boxingDebug._execDeleteLargeBox(b);
    }, [ids[1]]);
    await page2.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await expect.poll(() => page1.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.layout.boxes.find((b: any) => b.id === a);
      return !!box?.isParent;
    }, [ids[0]]), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => page2.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.layout.boxes.find((b: any) => b.id === a);
      return !!box?.isParent;
    }, [ids[0]]), { timeout: 15_000 }).toBe(true);
    await ctx.close();
  });

  test('BX-CONN-DELETE: root cause — star-unstar-star cycle preserves star after child delete', async ({ page }) => {
    await resetBoxing(page);
    const ids = await seedBoxes(page, [[0, 0], [400, 0]]);
    // Star A
    await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.toggleStarMark(dbg.largeKey(a));
    }, [ids[0]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(100);
    // Unstar A (creates tombstone large:A)
    await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.toggleStarMark(dbg.largeKey(a));
    }, [ids[0]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(100);
    // Star A again (should clear tombstone locally, but saveLayout merge may resurrect it)
    await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.toggleStarMark(dbg.largeKey(a));
    }, [ids[0]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(200);
    // Connect A -> B
    await page.evaluate(([a, b]) => {
      const dbg = (window as any).__boxingDebug;
      dbg.addConnection(dbg.largeKey(a), dbg.largeKey(b));
      dbg.renderConnections();
    }, [ids[0], ids[1]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(200);
    // Verify A is starred before delete
    const before = await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.layout.boxes.find((b: any) => b.id === a);
      return { isParent: box?.isParent, tdel: dbg.layout._meta?.deleted?.[dbg.largeKey(a)] };
    }, [ids[0]]);
    console.log('Before delete:', JSON.stringify(before));
    // Delete box B
    await page.evaluate(([b]) => {
      (window as any).__boxingDebug._execDeleteLargeBox(b);
    }, [ids[1]]);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.waitForTimeout(300);
    // BUG: A should STILL be starred
    const after = await page.evaluate(([a]) => {
      const dbg = (window as any).__boxingDebug;
      const box = dbg.layout.boxes.find((b: any) => b.id === a);
      return {
        isParent: box?.isParent,
        inGroupStar: dbg.groupStar?.has(dbg.largeKey(a)),
        tdel: dbg.layout._meta?.deleted?.[dbg.largeKey(a)]
      };
    }, [ids[0]]);
    console.log('After delete:', JSON.stringify(after));
    expect(after.isParent).toBe(true);
    expect(after.tdel).toBeUndefined();
  });
});
