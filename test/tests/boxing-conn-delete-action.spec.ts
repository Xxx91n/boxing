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
});
