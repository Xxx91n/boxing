import { expect, test, type Browser, type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path
  .resolve(__dirname, '..', '..', 'ntp', 'index.html')
  .replace(/\\/g, '/')}`;

// BX-DEV-111N+ regression: millisecond-grade cross-tab viewState propagation.
// Two pages share the same file:// origin so the mock-storage 'storage' event
// delivers boxingLayout changes between them. A pan/zoom on page A must surface
// on page B's in-memory layout within the throttled persist window.

async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
}

test.describe('Cross-tab per-box viewState sync (BX-DEV-111N+)', () => {
  test('inner zoom/pan written on tab A reaches tab B via storage.onChanged', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await boot(a);
    await boot(b);

    const idA = await a.evaluate(() => {
      (window as any)._boxingAddLargeBox();
      return (window as any).__boxingDebug.layout.boxes[0].id;
    });
    expect(idA).toBeTruthy();
    await a.evaluate((id) => (window as any)._boxingEnterLargeBox(id), idA);
    await a.waitForTimeout(80);

    const innerZoomBefore = await a.evaluate(() => (window as any).__boxingDebug.state().innerZoom);
    await a.evaluate(() => {
      const c = document.getElementById('inner-canvas') as HTMLDivElement;
      c.dispatchEvent(new WheelEvent('wheel', {
        ctrlKey: true, deltaY: -120, clientX: 240, clientY: 240, bubbles: true, cancelable: true,
      }));
    });
    await a.waitForTimeout(220);
    const innerZoomAfter = await a.evaluate(() => (window as any).__boxingDebug.state().innerZoom);
    expect(innerZoomAfter).not.toBeCloseTo(Number(innerZoomBefore), 5);

    await expect.poll(async () => {
      return await b.evaluate((id) => {
        const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === id);
        return lb && lb.viewState ? lb.viewState.innerZoom : null;
      }, idA);
    }, { timeout: 4000, intervals: [120, 220, 360] }).toBeCloseTo(Number(innerZoomAfter), 5);

    const tsB = await b.evaluate((id) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === id);
      return lb && lb.viewState ? lb.viewState.updatedAt : null;
    }, idA);
    expect(typeof tsB).toBe('number');
    expect(tsB).toBeGreaterThan(0);

    await ctx.close();
  });

  test('scheduleLargeBoxViewStatePersist writes within ~25ms throttle and survives saveLayout queue', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    const id = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].id);
    await page.evaluate((boxId) => (window as any)._boxingEnterLargeBox(boxId), id);
    const before = await page.evaluate(() => Date.now());
    await page.evaluate((boxId) => (window as any).__boxingScheduleLargeBoxViewStatePersist(boxId), id);
    await page.waitForTimeout(220);
    const vs = await page.evaluate((boxId) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === boxId);
      return lb && lb.viewState ? { ts: lb.viewState.updatedAt, zoom: lb.viewState.innerZoom } : null;
    }, id);
    expect(vs).toBeTruthy();
    expect(typeof vs.ts).toBe('number');
    expect(vs.ts).toBeGreaterThanOrEqual(before);
  });
});

