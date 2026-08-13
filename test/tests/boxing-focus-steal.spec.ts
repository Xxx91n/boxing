import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
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

test.describe('dblclick — REAL native input + text selection', () => {
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
