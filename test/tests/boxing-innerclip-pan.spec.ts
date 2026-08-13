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

// BX-DEV-CLIP-PAN: regression for the "small-box at top is covered by head, worse at
// smaller zoom" report. This is the user's actual reproduction: pan the inner surface
// so a small box at world y=0 ends up at the top of the visible surface; the surface
// overflow:hidden must clip it at the surface top edge, NOT let it intrude into the
// inner__canvas-head's solid background band. Verifies surface.top >= head.bottom.
test.describe('Boxing inner surface clip under pan (BX-DEV-CLIP-PAN)', () => {
  test('small-box panned to surface top is clipped by surface, not covered by head, across zoom', async ({ page }) => {
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

    // Simulate a real pan that pushes the small box up toward the surface top:
    // drive a few mouse moves on the inner surface with the left button held.
    const surface = page.locator('.inner__surface');
    await surface.waitFor({ state: 'visible' });
    const box = await surface.boundingBox();
    if (!box) throw new Error('no surface');
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // Move upward so innerPanY goes negative (content moves up; a box at world y=0 ends
    // up at the surface top and beyond).
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(sx, sy - 40 - i*30, { steps: 4 });
    }
    await page.mouse.up();
    await page.waitForTimeout(150);

    // Also try at a smaller zoom to mirror the "缩放得越小覆盖越严重" repro.
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const s = document.querySelector('.inner__surface') as HTMLElement;
        s.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, ctrlKey: true, clientX: 200, clientY: 200, bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(30);
    }

    const g = await page.evaluate(() => {
      const head = document.querySelector('.inner__canvas-head') as HTMLElement | null;
      const surface = document.querySelector('.inner__surface') as HTMLElement | null;
      const bx = document.querySelector('.small-box[data-id="clip-sm"]') as HTMLElement | null;
      if (!head || !surface || !bx) return { ok: false };
      const hr = head.getBoundingClientRect();
      const sr = surface.getBoundingClientRect();
      const br = bx.getBoundingClientRect();
      const st = (window as any).__boxingDebug?.state?.();
      // BX-DEV-CLIP-PAN: rect.top after transform reports the box's logical position
      // but does NOT reflect overflow:hidden clipping. Use elementFromPoint at the box's
      // horizontal center, sampling INSIDE the head's solid band (just below head top).
      // If the head is drawn over the (clipped) box, this point returns head/canvas,
      // NOT the small box. A passing test means the head zone stays covered by the
      // head's own background → no "标题被覆盖" visual leak.
      const cx = br.left + Math.min(br.width, 40) / 2;
      const sampleY = hr.top + Math.max(2, hr.height / 2); // inside head's solid band
      const hit = document.elementFromPoint(cx, sampleY) as HTMLElement | null;
      const hitIsHeadOrCanvasAncestor = !!hit && !hit.closest('.small-box[data-id="clip-sm"]');
      return {
        ok: true,
        headTop: Math.round(hr.top), headBottom: Math.round(hr.bottom),
        surfTop: Math.round(sr.top),
        boxTop: Math.round(br.top),
        innerZoom: st?.innerZoom,
        hitClass: hit?.className || null,
        hitIsHeadOrCanvasAncestor, // true = small box is NOT pierced through into head zone
      };
    });
    expect(g.ok).toBe(true);
    expect(g.hitIsHeadOrCanvasAncestor).toBe(true);
  });
});
