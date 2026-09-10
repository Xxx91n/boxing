import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp/index.html')).href;

// Ticket 09 (wave4 P1): dblclick creation must render synchronously after the
// mutation and persist fire-and-forget — never await saveLayout() before render,
// or feedback stalls behind storageWriteChain and boxes batch-appear.
// Box-creating dblclicks are synthetic: native dblclick stalls on the firefox
// lane (playwright#16095 class; ticket-27 convention shared with data-recovery.spec.ts).
async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
  await page.waitForTimeout(300);
}

function jsDblclick(page: Page, sel: string, x: number, y: number) {
  return page.evaluate(({ s, x, y }) => {
    (document.querySelector(s) as HTMLElement | null)?.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    );
  }, { s: sel, x, y });
}

const layoutBoxCount = (page: Page) =>
  page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);

test.describe('Ticket 09 - create: mutate -> render -> async persist', () => {

  test('dblclick empty canvas -> .large-box +1; second dblclick -> +1 (DOM matches layout.boxes)', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await boot(page);

    const canvasBox = await page.locator('#canvas').boundingBox();
    expect(canvasBox).toBeTruthy();
    const cx = canvasBox!.x + canvasBox!.width / 2;
    const cy = canvasBox!.y + canvasBox!.height / 3;

    await expect(page.locator('.large-box')).toHaveCount(0);

    // 1st dblclick: the box must show up without waiting for the storage write chain.
    await jsDblclick(page, '#canvas-surface', cx, cy);
    await expect(page.locator('.large-box')).toHaveCount(1);
    expect(await layoutBoxCount(page)).toBe(1);

    // 2nd dblclick at a different spot (>12px apart, outside the cooldown radius).
    await jsDblclick(page, '#canvas-surface', cx + 260, cy + 140);
    await expect(page.locator('.large-box')).toHaveCount(2);
    expect(await layoutBoxCount(page)).toBe(2);

    // Visible feedback stays consistent with the model...
    expect(await page.locator('.large-box').count()).toBe(await layoutBoxCount(page));
    // ...and the fire-and-forget persist lands eventually.
    await expect.poll(() => page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('boxingLayout') || '{}')?.boxes?.length ?? 0; }
      catch (_) { return 0; }
    }), { timeout: 5000 }).toBe(2);

    await context.close();
  });

  test('create cooldown still suppresses the duplicate dblclick at the same spot', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await boot(page);

    const canvasBox = await page.locator('#canvas').boundingBox();
    expect(canvasBox).toBeTruthy();
    const cx = canvasBox!.x + canvasBox!.width / 2;
    const cy = canvasBox!.y + canvasBox!.height / 2;

    // Two dblclicks at the identical position inside one task (guaranteed within the
    // 350ms/12px CREATE_COOLDOWN window): the second must be suppressed.
    await page.evaluate(({ s, x, y }) => {
      const fire = () => (document.querySelector(s) as HTMLElement | null)?.dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      fire();
      fire();
    }, { s: '#canvas-surface', x: cx, y: cy });
    await expect(page.locator('.large-box')).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(await page.locator('.large-box').count()).toBe(1);
    expect(await layoutBoxCount(page)).toBe(1);

    await context.close();
  });

  test('source contract: creation entries render before persisting, no await saveLayout in render.js', async () => {
    const src = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/render.js'), 'utf8');
    // The blocking await is gone from the whole render module.
    expect(src).not.toContain('await saveLayout');

    const fnRegion = (name: string) => {
      const start = src.indexOf(`export function ${name}(`) !== -1
        ? src.indexOf(`export function ${name}(`)
        : src.indexOf(`export async function ${name}(`);
      expect(start, name + ' not found').toBeGreaterThan(-1);
      const next = src.indexOf('\n  export ', start + 10);
      return src.slice(start, next === -1 ? src.length : next);
    };

    for (const name of ['addLargeBoxAt', 'addLargeBox', 'addSmallBoxAt']) {
      const body = fnRegion(name);
      const renderAt = Math.min(
        ...['renderCanvas();', 'renderInnerSurface(lb);'].map((s) => {
          const i = body.indexOf(s);
          return i === -1 ? Infinity : i;
        })
      );
      const persistAt = body.indexOf('void saveLayout();');
      expect(renderAt, name + ' renders').not.toBe(Infinity);
      expect(persistAt, name + ' persists fire-and-forget').toBeGreaterThan(-1);
      expect(persistAt, name + ' persists AFTER render').toBeGreaterThan(renderAt);
    }
  });
});
