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

async function dispatchClickAt(page: Page, cx: number, cy: number, opts: { dblclick?: boolean } = {}) {
  await page.evaluate(({ cx, cy, dblclick }) => {
    function fire(type: string, clickCount = 1) {
      const el = (document.elementFromPoint(cx, cy) as HTMLElement) || document.body;
      const ev = new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        clientX: cx, clientY: cy, button: 0, buttons: type === 'mouseup' ? 0 : 1,
        detail: clickCount,
      });
      el.dispatchEvent(ev);
    }
    fire('mousedown');
    fire('mouseup');
    fire('click');
    if (dblclick) {
      fire('mousedown', 2);
      fire('mouseup', 2);
      fire('click', 2);
      fire('dblclick', 2);
    }
  }, { cx, cy, dblclick: opts.dblclick || false });
}

test.describe('dblclick focus-steal prevention (BX-DEV-140d)', () => {
  test('dblclick empty canvas does not steal focus to toolbar or title', async ({ page }) => {
    await boot(page);

    // Get canvas position
    const canvasRect = await page.evaluate(() => {
      const c = document.getElementById('canvas')!;
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    // Dbl-click on empty canvas center
    const cx = canvasRect.x + canvasRect.w / 2;
    const cy = canvasRect.y + canvasRect.h / 2;
    await dispatchClickAt(page, cx, cy, { dblclick: true });
    await page.waitForTimeout(500);

    // Check what got focus
    const activeAfter = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'body', id: '', editable: false };
      return {
        tag: el.tagName,
        id: el.id || '',
        editable: el.isContentEditable,
        className: (el.className || '').substring(0, 50),
        tabIndex: el.tabIndex,
      };
    });
    console.log('Focus after dblclick:', JSON.stringify(activeAfter));

    // Focus should NOT be on: INPUT, BUTTON, or contenteditable
    expect(activeAfter.tag).not.toBe('INPUT');
    expect(activeAfter.tag).not.toBe('BUTTON');
    expect(activeAfter.editable).toBe(false);
  });

  test('dblclick creating first box does not focus the box title', async ({ page }) => {
    await boot(page);

    const canvasRect = await page.evaluate(() => {
      const c = document.getElementById('canvas')!;
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    // Dbl-click center to create first box
    const cx = canvasRect.x + canvasRect.w / 2;
    const cy = canvasRect.y + canvasRect.h / 2;
    await dispatchClickAt(page, cx, cy, { dblclick: true });
    await page.waitForTimeout(800);

    // Check focus is not on the box title
    const activeAfter = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'body', editable: false, class: '' };
      return {
        tag: el.tagName,
        editable: el.isContentEditable,
        class: (el.className || '').substring(0, 50),
      };
    });
    console.log('Focus after first box creation:', JSON.stringify(activeAfter));

    // The large-box__title should NOT have focus
    expect(activeAfter.editable).toBe(false);
    expect(activeAfter.class).not.toContain('large-box__title');
  });

  test('dblclick creating 3 boxes — none steal focus', async ({ page }) => {
    await boot(page);

    const canvasRect = await page.evaluate(() => {
      const c = document.getElementById('canvas')!;
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    for (let i = 0; i < 3; i++) {
      const cx = canvasRect.x + 100 + i * 180;
      const cy = canvasRect.y + 100;
      await dispatchClickAt(page, cx, cy, { dblclick: true });
      await page.waitForTimeout(400);
    }

    const activeAfter = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'body', editable: false };
      return {
        tag: el.tagName,
        id: el.id || '',
        editable: el.isContentEditable,
        class: (el.className || '').substring(0, 50),
      };
    });
    console.log('Focus after 3 dblclicks:', JSON.stringify(activeAfter));

    expect(activeAfter.tag).not.toBe('INPUT');
    expect(activeAfter.tag).not.toBe('BUTTON');
    expect(activeAfter.editable).toBe(false);
  });
});
