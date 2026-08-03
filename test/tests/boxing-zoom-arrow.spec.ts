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

// Regression for BX-DEV-124: Chrome culled zero-size border-triangle arrows.
// BX-DEV-135/136: the fix is a pure CSS border triangle via ::before with no
// text content (font-size:0 hides the legacy Unicode literal that was removed
// from HTML to avoid ungood-chromium glyph-fallback invisibility). Assert the
// triangle renders with non-zero box size and that the ::before pseudo exists.
test.describe('Boxing zoom-arrow visibility (BX-DEV-ZOOMARROW)', () => {
  test('canvas zoom arrows render with non-zero size on chrome', async ({ page }) => {
    await resetBoxing(page);
    // Only check canvas-zoom arrows (inner-zoom is hidden until a large box is entered).
    const r = await page.evaluate(() => {
      const arrows = Array.from(document.querySelectorAll('#canvas-zoom .zoom-arrow')) as HTMLElement[];
      return arrows.map(a => ({
        w: a.offsetWidth,
        h: a.offsetHeight,
        before: window.getComputedStyle(a, '::before').content,
        bw: (window.getComputedStyle(a, '::before').borderWidth || ''),
      }));
    });
    expect(r.length).toBe(2);
    for (const a of r) {
      expect(a.w).toBeGreaterThan(0);
      expect(a.h).toBeGreaterThan(0);
      expect(a.before).not.toBe('none');
      expect(a.bw).not.toBe('0px');
    }
  });

  test('inner zoom arrows render with non-zero size after entering a large box', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{ id: 'z-lg', type: 'large', title: 'Z', x: 0, y: 0, width: 320, height: 220, children: [] }];
      dbg.layout._meta = { updatedAt: Date.now() };
    });
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    await page.evaluate(() => {
      const el = document.querySelector('.large-box[data-id="z-lg"]');
      if (el) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    // rAF-based reveal may need two frames
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const ctrl = document.getElementById('inner-zoom');
      if (!ctrl || ctrl.offsetParent === null) return { ok: false, reason: 'ctrl hidden' };
      const arrows = Array.from(ctrl.querySelectorAll('.zoom-arrow')) as HTMLElement[];
      if (!arrows.length) return { ok: false, reason: 'no arrows' };
      return { ok: true, arrows: arrows.map(a => ({ w: a.offsetWidth, h: a.offsetHeight, before: window.getComputedStyle(a, '::before').content, bw: (window.getComputedStyle(a, '::before').borderWidth || '') })) };
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const a of (r as any).arrows) {
        expect(a.w).toBeGreaterThan(0);
        expect(a.h).toBeGreaterThan(0);
        expect(a.before).not.toBe('none');
        expect(a.bw).not.toBe('0px');
      }
    }
  });
});
