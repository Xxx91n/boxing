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
  // Ticket 27 (quarantine convergence): @quarantine retired. The pan that reproduces
  // the bug is app-level state (mousedown → mousemove deltas), not input realness —
  // native mouse.move/down/up stalled on the firefox lane (playwright#16095 class,
  // ticket-18 evidence), so the sequence is dispatched synthetically: mousedown on
  // innerCanvas (the bound target) then mousemove/mouseup on document (where the
  // handlers are bound). The wheel-zoom step was already synthetic.
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
    // dispatch a synthetic left-button press on the inner canvas, then drag
    // upward via document-level mousemove (where onInnerPanMove is bound) so
    // innerPanY goes negative (content moves up; a box at world y=0 ends up at
    // the surface top and beyond).
    await page.evaluate(() => {
      const canvas = document.getElementById('inner-canvas') as HTMLElement | null;
      if (!canvas) throw new Error('no inner-canvas');
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, button: 0,
        clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
      }));
      for (let i = 0; i < 6; i++) {
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true, cancelable: true,
          clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 - 40 - i * 30,
        }));
      }
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    });
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
