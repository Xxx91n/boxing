import { expect, test, type Browser, type Page } from '@playwright/test';
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

// Synthetic MouseEvent dispatch helpers — work on both Chromium and Firefox
// persistent contexts. Avoid page.mouse.{click,move,wheel} which can hang on
// Firefox persistent profiles (playwright #16095). Each fire re-resolves the
// hit-test target via document.elementFromPoint(cx, cy) BEFORE dispatching the
// event, mirroring how a real browser re-routes input when the view changes
// mid click-sequence (e.g. enterLargeBox revealing innerSurface after click 1).
async function dispatchClickAt(page: Page, cx: number, cy: number, opts: { dblclick?: boolean } = {}) {
  await page.evaluate(({ cx, cy, dblclick }) => {
    function fire(type: string, clickCount = 1) {
      // Re-resolve target every event; between mousedown/up/click the DOM may have
      // shifted (large-box click -> enterLargeBox -> innerSurface revealed), so a
      // cached target would mis-route dblclick to the wrong handler path.
      const el = (document.elementFromPoint(cx, cy) as HTMLElement) || document.body;
      const ev = new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        clientX: cx, clientY: cy, button: 0, buttons: type === 'mouseup' ? 0 : 1,
        detail: clickCount,
      });
      el.dispatchEvent(ev);
    }
    fire('mousedown', 1); fire('mouseup', 1); fire('click', 1);
    if (dblclick) {
      fire('mousedown', 2); fire('mouseup', 2); fire('click', 2); fire('dblclick', 2);
    }
  }, { cx, cy, dblclick: !!opts.dblclick });
}


// BX-DEV-112A: User reports a stable reproducer — after holddown Ctrl + scroll-wheel
// to zoom out, releasing and then dblclick on the inner canvas fails to add a small box.
// Regression: cursor/hit-test state leak. Verify dblclick AFTER a zoom-out cycle still
// triggers addSmallBoxAt.
test.describe('BX-DEV-112A — inner zoom-out then dblclick regression', () => {
  test('ctrl+wheel zoom-out then dblclick on inner canvas still adds a small box', async ({ page }: { page: Page }) => {
    test.setTimeout(60000);
    await boot(page);
    // 1) add a large box and enter it
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    const id = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].id);
    await page.evaluate((boxId) => (window as any)._boxingEnterLargeBox(boxId), id);
    await page.waitForTimeout(80);
    const innerCanvas = await page.locator('#inner-canvas');
    const innerSurface = await page.locator('#inner-surface');
    const surfaceBox = await innerSurface.boundingBox();
    if (!surfaceBox) throw new Error('inner-surface has no bounding box');
    const cx = surfaceBox.x + surfaceBox.width / 2;
    const cy = surfaceBox.y + surfaceBox.height / 2;

    // 2) Simulate user holddown Ctrl + wheel-zoom-out, then release ctrl.
    //    Use dispatchEvent on innerCanvas with a synthetic WheelEvent
    //    (ctrlKey=true, deltaY=120, cancelable=true) so the capture-phase
    //    onInnerWheel handler fires. This avoids playwright mouse.wheel which
    //    can hang on persistent Firefox contexts (playwright #16095) and works
    //    identically across chromium/firefox.
    await page.evaluate(({ cx, cy }) => {
      const target = document.getElementById('inner-canvas') as HTMLElement;
      for (let i = 0; i < 5; i++) {
        const ev = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: 120,
          clientX: cx,
          clientY: cy,
        });
        target.dispatchEvent(ev);
      }
    }, { cx, cy });
    await page.waitForTimeout(120);
    const innerZoomAfterZoomOut = await page.evaluate(() => (window as any).__boxingDebug.state().innerZoom);
    expect(innerZoomAfterZoomOut).toBeLessThan(1.0);

    // 3) Release ctrl then real dblclick sequence at surface center (cx, cy).
    const smallCountBefore = await page.evaluate(() => {
      const lb = (window as any).__boxingDebug.layout.boxes[0];
      return lb.children ? lb.children.length : 0;
    });
    // Synthetic dblclick at (cx, cy). Using dispatchClickAt avoids playwright
    // mouse.click hangs on Firefox persistent contexts (playwright #16095).
    await dispatchClickAt(page, cx, cy, { dblclick: true });
    await page.waitForTimeout(150);

    const smallCountAfter = await page.evaluate(() => {
      const lb = (window as any).__boxingDebug.layout.boxes[0];
      return lb.children ? lb.children.length : 0;
    });
    expect(smallCountAfter).toBe(smallCountBefore + 1);

    // 4) Verify cursor is not stuck in grabbing state (sanity check).
    const cursorOnSurface = await page.evaluate(() => {
      const s = document.getElementById('inner-surface') as HTMLDivElement;
      return window.getComputedStyle(s).cursor;
    });
    // grab/grabbing/default all acceptable; if 'default' is stuck after pan that's the prior bug
    expect(cursorOnSurface === 'grab' || cursorOnSurface === 'default').toBeTruthy();
  });
});


// BX-DEV-112C: Double-clicking a large box to enter must NOT also create a
// stray small box. Before the fix, the click that triggered enterLargeBox
// sometimes synthesized into a follow-on dblclick on the just-revealed inner
// surface, which would then call addSmallBoxAt unconditionally.
test.describe('BX-DEV-112C — dblclick large box enters without creating small box', () => {
  test('double-click on a large box body enters inner view and adds zero small boxes', async ({ page }: { page: Page }) => {
    test.setTimeout(60000);
    await boot(page);
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    const id = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].id);
    const box = await page.locator(`.large-box[data-id="${id}"]`);
    const bb = await box.boundingBox();
    if (!bb) throw new Error('no large box');
    const cx = bb.x + bb.width / 2;
    const cy = bb.y + bb.height / 2;

    // Synthetic dblclick — first click enters large box, second click must NOT create a small box.
    await dispatchClickAt(page, cx, cy, { dblclick: true });
    await page.waitForTimeout(150);

    const after = await page.evaluate((boxId) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === boxId);
      return {
        childrenCount: lb?.children?.length || 0,
        currentLargeBoxId: (window as any).__boxingDebug.state().currentLargeBoxId,
        innerHidden: (document.getElementById('inner') as HTMLElement).hidden,
      };
    }, id);
    expect(after.currentLargeBoxId).toBe(id);
    expect(after.childrenCount).toBe(0);
    expect(after.innerHidden).toBe(false);
  });
});


// BX-DEV-112C-extra: Single-click enter large box, wait > 350ms, then dblclick inner
// should still create a small box (suppress should not linger).
test.describe('BX-DEV-112C extra — click enter then dblclick inner after delay', () => {
  test('single click enters; later dblclick inner creates exactly one small box', async ({ page }: { page: Page }) => {
    test.setTimeout(60000);
    await boot(page);
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    const id = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].id);
    const box = await page.locator(`.large-box[data-id="${id}"]`);
    const bb = await box.boundingBox();
    if (!bb) throw new Error('no large box');
    // 1. Single click to enter large box (suppress guard is set)
    await dispatchClickAt(page, bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(150);
    // 2. Wait > 350ms so the time-based guard no longer blocks.
    await page.waitForTimeout(420);
    // 3. Now dblclick inside inner surface should create exactly one small box.
    const surface = await page.locator('#inner-surface');
    const sb = await surface.boundingBox();
    if (!sb) throw new Error('no inner surface bbox');
    const cx = sb.x + sb.width / 2;
    const cy = sb.y + sb.height / 2;
    const beforeCount = await page.evaluate((boxId) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === boxId);
      return lb?.children?.length || 0;
    }, id);
    await dispatchClickAt(page, cx, cy, { dblclick: true });
    await page.waitForTimeout(150);
    const afterCount = await page.evaluate((boxId) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === boxId);
      return lb?.children?.length || 0;
    }, id);
    expect(afterCount).toBe(beforeCount + 1);
  });
});
