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

test.describe('Boxing inner surface clip (BX-DEV-CLIP)', () => {
  test('small-box at y=0 is not covered by inner__canvas-head', async ({ page }) => {
    await resetBoxing(page);
    // Create a large box and a small box at y=0 (surface top)
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{
        id: 'clip-lg', type: 'large', title: 'ClipTest', x: 0, y: 0, width: 320, height: 220,
        children: [
          { id: 'clip-sm', type: 'small', title: 'TopBox', x: 0, y: 0, width: 300, height: 100 },
          { id: 'clip-sm2', type: 'small', title: 'BottomBox', x: 0, y: 5000, width: 300, height: 100 },
        ],
      }];
      dbg.layout._meta = { updatedAt: Date.now() };
    });
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    // Enter the large box
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      // find box element and dispatch dblclick to enter
      const el = document.querySelector('.large-box[data-id="clip-lg"]');
      if (el) { const ev = new MouseEvent('dblclick', { bubbles: true }); el.dispatchEvent(ev); }
    });
    await page.waitForTimeout(500);

    const metrics = await page.evaluate(() => {
      const head = document.querySelector('.inner__canvas-head') as HTMLElement;
      const surface = document.querySelector('.inner__surface') as HTMLElement;
      const topBox = document.querySelector('.small-box[data-id="clip-sm"]') as HTMLElement;
      const bottomBox = document.querySelector('.small-box[data-id="clip-sm2"]') as HTMLElement;
      if (!head || !surface || !topBox || !bottomBox) {
        return { found: false, head: !!head, surface: !!surface, topBox: !!topBox, bottomBox: !!bottomBox };
      }
      const headRect = head.getBoundingClientRect();
      const surfRect = surface.getBoundingClientRect();
      const topRect = topBox.getBoundingClientRect();
      const botRect = bottomBox.getBoundingClientRect();
      // visible check: topBox title bar should be within surface vertical bounds
      // and should NOT be above surface top (i.e. topRect.top >= surfRect.top)
      return {
        found: true,
        headTop: headRect.top, headBottom: headRect.bottom,
        surfTop: surfRect.top, surfBottom: surfRect.bottom, surfHeight: surfRect.height,
        topBoxTop: topRect.top, topBoxBottom: topRect.bottom,
        bottomBoxTop: botRect.top, bottomBoxBottom: botRect.bottom,
        // true if top box visual top is at or below surface top (not covered by head)
        topBoxWithinSurface: Math.round(topRect.top) >= Math.round(surfRect.top) - 1,
        // true if bottom box (at y=5000 unscrolled) is hidden below surface bottom (clipped)
        bottomBoxClipped: botRect.top >= surfRect.bottom - 1,
      };
    });
    expect(metrics.found).toBe(true);
    // The top small box should render within the surface, not overlapping the head
    expect(metrics.topBoxWithinSurface).toBe(true);
    // The bottom small box placed far down should be clipped (hidden) below surface bottom
    expect(metrics.bottomBoxClipped).toBe(true);
  });

  test('small-box at y=0 stays visible across zoom levels (no progressive clip)', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{
        id: 'clip-lg', type: 'large', title: 'ClipTest', x: 0, y: 0, width: 320, height: 220,
        children: [
          { id: 'clip-sm', type: 'small', title: 'TopBox', x: 0, y: 0, width: 300, height: 100 },
        ],
      }];
      dbg.layout._meta = { updatedAt: Date.now() };
    });
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    await page.evaluate(() => {
      const el = document.querySelector('.large-box[data-id="clip-lg"]');
      if (el) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.waitForTimeout(400);

    for (let i = 0; i < 3; i++) {
      const surface = await page.locator('.inner__surface');
      const box = await surface.boundingBox();
      if (!box) break;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, -120, [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
      // ctrl+wheel can't be done via mouse.wheel; use keyboard-mediated approach below
      await page.keyboard.down('Control');
      await page.evaluate((p2) => {
        const s = document.querySelector('.inner__surface') as HTMLElement;
        s.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, clientX: p2.cx, clientY: p2.cy, bubbles: true, cancelable: true }));
      }, { cx, cy });
      await page.keyboard.up('Control');
      await page.waitForTimeout(150);
    }

    const m = await page.evaluate(() => {
      const surface = document.querySelector('.inner__surface') as HTMLElement;
      const head = document.querySelector('.inner__canvas-head') as HTMLElement;
      const bx = document.querySelector('.small-box[data-id="clip-sm"]') as HTMLElement;
      if (!surface || !bx || !head) return { ok: false };
      const sr = surface.getBoundingClientRect();
      const hr = head.getBoundingClientRect();
      const br = bx.getBoundingClientRect();
      const st = (window as any).__boxingDebug?.state?.();
      const cx = br.left + br.width / 2;
      const sampleY = hr.top + Math.max(2, hr.height / 2);
      const hit = document.elementFromPoint(cx, sampleY) as HTMLElement | null;
      const hitIsHeadOrCanvasAncestor = !!hit && !hit.closest('.small-box[data-id="clip-sm"]');
      return {
        ok: true,
        hitIsHeadOrCanvasAncestor,
        headTop: Math.round(hr.top), headBottom: Math.round(hr.bottom),
        surfTop: Math.round(sr.top), boxTop: Math.round(br.top),
        zoom: st?.innerZoom,
      };
    });
    expect(m.ok).toBe(true);
    expect(m.hitIsHeadOrCanvasAncestor).toBe(true);
  });

  test('small-box title bar at y=0 does not visually intrude into head zone', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{
        id: 'clip-lg', type: 'large', title: 'ClipTest', x: 0, y: 0, width: 320, height: 220,
        children: [
          { id: 'clip-sm', type: 'small', title: 'TopBox', x: 0, y: 0, width: 300, height: 100 },
        ],
      }];
      dbg.layout._meta = { updatedAt: Date.now() };
    });
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    await page.evaluate(() => {
      const el = document.querySelector('.large-box[data-id="clip-lg"]');
      if (el) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.waitForTimeout(400);

    const g = await page.evaluate(() => {
      const head = document.querySelector('.inner__canvas-head') as HTMLElement;
      const box = document.querySelector('.small-box[data-id="clip-sm"]') as HTMLElement;
      const bar = box?.querySelector('.small-box__bar') as HTMLElement;
      const surface = document.querySelector('.inner__surface') as HTMLElement;
      if (!head || !box || !bar || !surface) return { ok: false };
      const hr = head.getBoundingClientRect();
      const br = box.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const sr = surface.getBoundingClientRect();
      return {
        ok: true,
        headBottom: Math.round(hr.bottom),
        surfTop: Math.round(sr.top),
        boxTop: Math.round(br.top),
        barTop: Math.round(barRect.top),
        gap: Math.round(br.top - hr.bottom),
        // True intrusion: box top is above head bottom (overlap into head zone)
        intrudes: br.top < hr.bottom - 1,
        // Title bar top: should be >= surface top (not above)
        barAtOrBelowSurface: Math.round(barRect.top) >= Math.round(sr.top) - 1,
      };
    });
    expect(g.ok).toBe(true);
    // The box must not visually intrude into the head's pixel zone
    expect(g.intrudes).toBe(false);
  });
});
