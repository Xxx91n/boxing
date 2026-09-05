import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path
  .resolve(__dirname, '..', '..', 'ntp', 'index.html')
  .replace(/\\/g, '/')}`;

async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
}

// Capture selection state + focus state
async function captureState(page: Page, label: string) {
  const state = await page.evaluate(() => {
    const sel = window.getSelection();
    const selText = sel ? sel.toString() : '';
    const selRangeCount = sel ? sel.rangeCount : 0;
    let anchorTag = '';
    let anchorClass = '';
    let anchorId = '';
    let anchorEditable = false;
    if (sel && sel.anchorNode) {
      let node: Node | null = sel.anchorNode;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (node instanceof Element) {
        anchorTag = node.tagName;
        anchorClass = (node.className || '').toString().substring(0, 40);
        anchorId = (node as HTMLElement).id || '';
        anchorEditable = (node as HTMLElement).isContentEditable;
      }
    }
    const active = document.activeElement;
    return {
      selText: selText.substring(0, 60),
      selRangeCount,
      anchorTag,
      anchorClass,
      anchorId,
      anchorEditable,
      activeTag: active?.tagName || '',
      activeId: active?.id || '',
      activeEditable: (active as HTMLElement)?.isContentEditable || false,
    };
  });
  console.log(`[STATE ${label}]`, JSON.stringify(state));
  return state;
}

// Seed a real Selection over an element so the BX-SEL-01 clear guard in
// renderCanvas (ntp/render.js removeAllRanges before the DOM wipe) is
// observable: a synthetic dblclick cannot produce native selection, so
// without a seeded range the "selection cleared" assertion would be vacuous.
async function seedSelectionOver(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.rangeCount > 0;
  }, selector);
}

test.describe('dblclick — REAL native input + text selection', () => {
  // Ticket 27 (quarantine convergence): the @quarantine tag is retired. Native-input
  // realness IS this block's purpose — the browser must not select text under a real
  // dblclick (BX-SEL-01 end-to-end proof, chrome-origin bug) — so the tests are NOT
  // converted to synthetic dispatch. Firefox native input stalls on this lane
  // (playwright#16095 class), so the native block is explicitly chromium-scoped and
  // the app-level guard contract keeps firefox coverage via the synthetic block below.
  test.skip(({ browserName }) => browserName === 'firefox',
    'native dblclick stalls on the firefox headed lane (playwright#16095 class); chromium keeps the native coverage, firefox uses the synthetic BX-SEL-01 block below');

  test('native dblclick on empty canvas center does not select text or steal focus', async ({ page }) => {
    await boot(page);

    // Verify empty state is visible
    const emptyVisible = await page.evaluate(() => !document.getElementById('canvas-empty')?.hidden);
    console.log('Empty state visible:', emptyVisible);

    const canvasRect = await page.locator('#canvas').boundingBox();
    const cx = canvasRect!.x + canvasRect!.width / 2;
    const cy = canvasRect!.y + canvasRect!.height / 2;

    // Capture state BEFORE
    await captureState(page, 'BEFORE');

    // Native dblclick on canvas center (this is where "暂无大盒子" text is)
    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(800);

    // Capture state AFTER
    const after = await captureState(page, 'AFTER');

    // If selection is not empty, Chrome's native dblclick selected text
    const hasSelection = after.selRangeCount > 0 && after.selText.length > 0;
    console.log('Selection after dblclick:', hasSelection ? JSON.stringify(after.selText) : 'EMPTY');

    // The bug: selection should NOT be present after dblclick on canvas to create box
    // (currently will fail — proving the bug)
    expect(hasSelection).toBe(false);
    expect(after.activeTag).not.toBe('INPUT');
    expect(after.activeEditable).toBe(false);
  });

  test('native dblclick on canvas-empty title text directly', async ({ page }) => {
    await boot(page);

    // Find the empty title text element (暂无大盒子 or equivalent)
    const titleRect = await page.locator('.canvas__empty-title').boundingBox();
    if (!titleRect) { test.skip(); return; }

    const cx = titleRect.x + titleRect.width / 2;
    const cy = titleRect.y + titleRect.height / 2;
    console.log('Title rect center:', cx, cy);

    // Check elementFromPoint — does it hit the title or pass through to canvas?
    const hitTarget = await page.evaluate(({ cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      return el ? el.tagName + '.' + (el.className || '').substring(0, 40) : 'null';
    }, { cx, cy });
    console.log('elementFromPoint at title:', hitTarget);

    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(800);

    const after = await captureState(page, 'AFTER TITLE DBLCLICK');
    expect(after.selRangeCount > 0 && after.selText.length > 0).toBe(false);
  });

  test('selection cleared after renderCanvas', async ({ page }) => {
    await boot(page);

    const canvasRect = await page.locator('#canvas').boundingBox();
    const cx = canvasRect!.x + canvasRect!.width / 2;
    const cy = canvasRect!.y + canvasRect!.height / 2;

    // Create first box
    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(500);

    // Now dblclick on different empty spot to create second box
    const cx2 = canvasRect!.x + canvasRect!.width / 2 + 300;
    const cy2 = canvasRect!.y + canvasRect!.height / 2 + 300;
    await page.mouse.dblclick(cx2, cy2);
    await page.waitForTimeout(500);

    const state = await captureState(page, 'AFTER 2 BOXES');
    expect(state.selRangeCount > 0 && state.selText.length > 0).toBe(false);
    expect(state.activeEditable).toBe(false);
  });
});

// Ticket 27 (quarantine convergence): the synthetic twin of the native block —
// BX-SEL-01's app-level contract (renderCanvas clears residual selection; focus is
// not stolen by canvas dblclick; .canvas keeps user-select:none) — exercised on the
// firefox main lane where native input is unavailable (playwright#16095 class).
// Seeding a real Selection makes the clear-guard assertion behavioral, not vacuous.
test.describe('dblclick — BX-SEL-01 selection guard via synthetic input', () => {
  // Empty canvas: dblclick at center creates a box → renderCanvas runs → the
  // seeded selection must be gone (removeAllRanges before the DOM wipe).
  test('synthetic dblclick on empty canvas center clears seeded selection and keeps focus', async ({ page }) => {
    await boot(page);

    const seeded = await seedSelectionOver(page, '.canvas__empty-title');
    expect(seeded).toBe(true);

    const canvasRect = await page.locator('#canvas').boundingBox();
    const cx = canvasRect!.x + canvasRect!.width / 2;
    const cy = canvasRect!.y + canvasRect!.height / 2;

    await page.evaluate(({ x, y }) => {
      document.getElementById('canvas-surface')?.dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
      );
    }, { x: cx, y: cy });
    await page.waitForTimeout(500);

    // Box creation proves the dblclick → renderCanvas path actually ran.
    const boxCount = await page.locator('.large-box').count();
    expect(boxCount).toBeGreaterThanOrEqual(1);

    const after = await captureState(page, 'AFTER SYNTHETIC DBLCLICK');
    expect(after.selRangeCount).toBe(0);
    expect(after.activeTag).not.toBe('INPUT');
    expect(after.activeEditable).toBe(false);

    // CSS layer of BX-SEL-01: .canvas must keep user-select none (this is what
    // blocks native selection under real input).
    const canvasUserSelect = await page.evaluate(
      () => getComputedStyle(document.querySelector('.canvas') as Element).userSelect,
    );
    expect(canvasUserSelect).toBe('none');
  });

  // Title text directly: seeding over the title then dblclicking the title element
  // itself must not leave the selection behind either.
  test('synthetic dblclick on canvas-empty title text clears seeded selection', async ({ page }) => {
    await boot(page);

    const seeded = await seedSelectionOver(page, '.canvas__empty-title');
    expect(seeded).toBe(true);

    await page.evaluate(() => {
      const title = document.querySelector('.canvas__empty-title') as HTMLElement | null;
      if (!title) return;
      const rect = title.getBoundingClientRect();
      title.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true, cancelable: true,
        clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
      }));
    });
    await page.waitForTimeout(500);

    const after = await captureState(page, 'AFTER TITLE SYNTHETIC DBLCLICK');
    expect(after.selRangeCount).toBe(0);
    expect(after.activeEditable).toBe(false);
  });

  // Two box creations in a row: renderCanvas runs twice; no selection and no
  // stolen focus may remain.
  test('synthetic dblclick creating two boxes leaves no selection or stolen focus', async ({ page }) => {
    await boot(page);

    await seedSelectionOver(page, '.canvas__empty-title');

    const canvasRect = await page.locator('#canvas').boundingBox();
    const cx = canvasRect!.x + canvasRect!.width / 2;
    const cy = canvasRect!.y + canvasRect!.height / 2;

    await page.evaluate(({ x, y }) => {
      document.getElementById('canvas-surface')?.dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
      );
    }, { x: cx, y: cy });
    await page.waitForTimeout(500);

    const cx2 = cx + 300;
    const cy2 = cy + 300;
    await page.evaluate(({ x, y }) => {
      document.getElementById('canvas-surface')?.dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
      );
    }, { x: cx2, y: cy2 });
    await page.waitForTimeout(500);

    const boxCount = await page.locator('.large-box').count();
    expect(boxCount).toBeGreaterThanOrEqual(2);

    const state = await captureState(page, 'AFTER 2 SYNTHETIC BOXES');
    expect(state.selRangeCount).toBe(0);
    expect(state.activeEditable).toBe(false);
  });
});
