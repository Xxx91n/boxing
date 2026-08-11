import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path
  .resolve(__dirname, '..', '..', 'ntp', 'index.html')
  .replace(/\\\\/g, '/')}`;

async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
}

async function dispatchDblClickAt(page: Page, cx: number, cy: number) {
  await page.evaluate(({ cx, cy }) => {
    function fire(type: string, clickCount = 1) {
      const el = (document.elementFromPoint(cx, cy) as HTMLElement) || document.body;
      const ev = new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        clientX: cx, clientY: cy, button: 0, buttons: type === 'mouseup' ? 0 : 1,
        detail: clickCount,
      });
      el.dispatchEvent(ev);
    }
    // Full dblclick sequence: down,up,click,down,up,click,dblclick
    fire('mousedown'); fire('mouseup'); fire('click');
    fire('mousedown', 2); fire('mouseup', 2); fire('click', 2); fire('dblclick', 2);
  }, { cx, cy });
}

test.describe('dblclick focus-steal — real dynamic test (BX-DEV-140d)', () => {
  test('dblclick on canvas-empty center (📦 area) — verify target + focus', async ({ page }) => {
    await boot(page);

    // Get the EXACT position of #canvas-empty (the 📦 hint area)
    const emptyRect = await page.evaluate(() => {
      const el = document.getElementById('canvas-empty')!;
      const r = el.getBoundingClientRect();
      // Also list ALL focusable elements before dblclick
      const focusableBefore = Array.from(document.querySelectorAll(
        'button, input, [contenteditable], [tabindex], a[href], select, textarea'
      )).map((el: any) => ({
        tag: el.tagName, id: el.id || '', class: (el.className || '').substring(0, 30),
        tabindex: el.tabIndex, editable: el.isContentEditable,
        hidden: el.hidden || el.style.display === 'none',
      }));
      return { x: r.x, y: r.y, w: r.width, h: r.height, focusableBefore };
    });
    console.log('canvas-empty rect:', JSON.stringify(emptyRect));

    // Log all focusable elements BEFORE dblclick
    console.log('Focusable elements BEFORE dblclick:');
    emptyRect.focusableBefore.forEach((f: any) => {
      if (!f.hidden) console.log('  ', JSON.stringify(f));
    });

    // Dbl-click DEAD CENTER on the canvas-empty hint area
    const cx = emptyRect.x + emptyRect.w / 2;
    const cy = emptyRect.y + emptyRect.h / 2;

    // First: record what element is at that point
    const targetBefore = await page.evaluate(({ cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      return el ? el.tagName + '#' + el.id + '.' + (el.className || '').substring(0, 30) : 'null';
    }, { cx, cy });
    console.log('elementFromPoint before dblclick:', targetBefore);

    // Now dispatch dblclick
    await dispatchDblClickAt(page, cx, cy);
    await page.waitForTimeout(800);

    // Check: what has focus now?
    const focusState = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'body', id: '', editable: false, class: '', tabindex: -99 };
      return {
        tag: el.tagName,
        id: el.id || '',
        class: (el.className || '').substring(0, 50),
        editable: el.isContentEditable,
        tabindex: el.tabIndex,
      };
    });
    console.log('Focus AFTER dblclick:', JSON.stringify(focusState));

    // List all focusable elements AFTER dblclick (new box may add contenteditable title)
    const focusableAfter = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(
        'button, input, [contenteditable], [tabindex], a[href], select, textarea'
      )).map((el: any) => ({
        tag: el.tagName, id: el.id || '', class: (el.className || '').substring(0, 30),
        tabindex: el.tabIndex, editable: el.isContentEditable,
        hidden: el.hidden || el.style.display === 'none',
      })).filter((f: any) => !f.hidden);
    });
    console.log('Focusable elements AFTER dblclick:');
    focusableAfter.forEach((f: any) => console.log('  ', JSON.stringify(f)));

    // Check if a box was actually created
    const boxCount = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    console.log('Box count after dblclick:', boxCount);

    // Assertions: focus must NOT be on button, input, or contenteditable
    expect(focusState.tag).not.toBe('INPUT');
    expect(focusState.tag).not.toBe('BUTTON');
    expect(focusState.editable).toBe(false);

    // If box was created, verify it exists
    if (boxCount > 0) {
      expect(boxCount).toBe(1);
    }
  });

  test('dblclick on canvas-empty ICON (📦) specifically — verify no steal', async ({ page }) => {
    await boot(page);

    // Get the 📦 icon position
    const iconRect = await page.evaluate(() => {
      const el = document.querySelector('.canvas__empty-icon') as HTMLElement;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    console.log('Icon rect:', JSON.stringify(iconRect));
    expect(iconRect).not.toBeNull();

    const cx = iconRect!.x + iconRect!.w / 2;
    const cy = iconRect!.y + iconRect!.h / 2;

    // Verify what element is at that point
    const targetEl = await page.evaluate(({ cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      return el ? el.tagName + '#' + el.id + '.' + (el.className || '').substring(0, 40) : 'null';
    }, { cx, cy });
    console.log('Element at icon center:', targetEl);

    await dispatchDblClickAt(page, cx, cy);
    await page.waitForTimeout(800);

    const focusState = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'body', id: '', editable: false, class: '' };
      return {
        tag: el.tagName, id: el.id || '',
        class: (el.className || '').substring(0, 50),
        editable: el.isContentEditable,
      };
    });
    console.log('Focus after icon dblclick:', JSON.stringify(focusState));

    expect(focusState.tag).not.toBe('INPUT');
    expect(focusState.tag).not.toBe('BUTTON');
    expect(focusState.editable).toBe(false);
  });

  test('rapid dblclick 3x on empty area — no cumulative focus steal', async ({ page }) => {
    await boot(page);

    const canvasRect = await page.evaluate(() => {
      const c = document.getElementById('canvas')!;
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    // Each dblclick at different positions spread far enough to avoid overlap
    for (let i = 0; i < 3; i++) {
      const cx = canvasRect.x + 100 + i * 350;
      const cy = canvasRect.y + 150 + (i % 2) * 200;
      await dispatchDblClickAt(page, cx, cy);
      await page.waitForTimeout(600);
    }

    const focusState = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'body', editable: false, class: '' };
      return {
        tag: el.tagName,
        id: el.id || '',
        editable: el.isContentEditable,
        class: (el.className || '').substring(0, 50),
      };
    });
    console.log('Focus after 3 rapid dblclicks:', JSON.stringify(focusState));

    expect(focusState.tag).not.toBe('INPUT');
    expect(focusState.tag).not.toBe('BUTTON');
    expect(focusState.editable).toBe(false);

    const boxCount = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    console.log('Box count:', boxCount);
    // Focus assertion is the important one — box count may vary due to elasticSnap
    expect(boxCount).toBeGreaterThanOrEqual(1);
  });
});
