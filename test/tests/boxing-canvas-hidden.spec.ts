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

// BX-DEV-020 regression guard:
// CSS `display:flex` on `.inner` / `.canvas` MUST NOT override the HTML `hidden`
// attribute. Before the fix, `.inner { display:flex }` lacked a `.inner[hidden]`
// fallback, so <div id="inner" class="inner" hidden> rendered despite `hidden`,
// surfacing the inner (small-box) canvas below the large-box canvas.
test.describe('BX-DEV-020: hidden override pairing (.inner / .canvas)', () => {
  test('#inner is computed display:none on initial load', async ({ page }) => {
    await resetBoxing(page);
    const innerDisplay = await page.evaluate(() => {
      const el = document.getElementById('inner');
      return el ? getComputedStyle(el).display : '<no #inner>';
    });
    expect(innerDisplay).toBe('none');
  });

  test('#canvas is computed display:flex on initial load (not hidden-collapsed)', async ({ page }) => {
    await resetBoxing(page);
    const canvasDisplay = await page.evaluate(() => {
      const el = document.getElementById('canvas');
      return el ? getComputedStyle(el).display : '<no #canvas>';
    });
    // Could be 'flex' or 'block' depending on rule layering — the invariant is
    // that it's NOT 'none' on initial load (it is the active surface).
    expect(canvasDisplay).not.toBe('none');
  });

  test('setting #inner.hidden=true yields computed display:none (CSS pair honored)', async ({ page }) => {
    await resetBoxing(page);
    const result = await page.evaluate(() => {
      const el = document.getElementById('inner') as HTMLElement | null;
      if (!el) return { ok: false, reason: 'no #inner' };
      el.hidden = true;
      const disp = getComputedStyle(el).display;
      el.hidden = false; // restore for other tests
      const dispAfter = getComputedStyle(el).display;
      return { ok: true, displayHidden: disp, displayRestored: dispAfter };
    });
    expect(result.ok).toBe(true);
    // CRITICAL invariant: when hidden=true, computed display MUST be 'none'.
    // If this fails, someone added a display:flex/block/grid rule to `.inner`
    // without the `.inner[hidden] { display:none }` fallback (BX-DEV-020).
    expect(result.displayHidden).toBe('none');
  });

  test('enterLargeBox makes #inner visible (flex) and #canvas hidden (none)', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      // Seed one large box to enter
      dbg.layout.boxes = [{
        id: 'seed-hidden-A', type: 'large', title: 'A', x: 100, y: 100,
        width: 320, height: 220, children: [],
      }];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      const id = dbg.layout.boxes[0].id;
      (window as any)._boxingEnterLargeBox(id);
      const innerDisp = getComputedStyle(document.getElementById('inner')!).display;
      const canvasDisp = getComputedStyle(document.getElementById('canvas')!).display;
      return { innerDisp, canvasDisp };
    });
    // After enter: #inner visible, #canvas hidden
    expect(r.innerDisp).not.toBe('none');
    expect(r.canvasDisp).toBe('none');
  });

  test('exitToCanvas restores #inner hidden (none) and #canvas visible (flex)', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{
        id: 'seed-hidden-B', type: 'large', title: 'B', x: 100, y: 100,
        width: 320, height: 220, children: [],
      }];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      const id = dbg.layout.boxes[0].id;
      (window as any)._boxingEnterLargeBox(id);
      // Now exit back to the large canvas
      (window as any)._boxingExitToCanvas();
      const innerDisp = getComputedStyle(document.getElementById('inner')!).display;
      const canvasDisp = getComputedStyle(document.getElementById('canvas')!).display;
      return { innerDisp, canvasDisp };
    });
    expect(r.innerDisp).toBe('none');
    expect(r.canvasDisp).not.toBe('none');
  });
});
