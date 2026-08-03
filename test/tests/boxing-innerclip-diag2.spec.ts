import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NTP_URL = `file:///${path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\\\/g, '/')}`;
test('content layer diag', async ({ page }) => {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => {
    const dbg = (window as any).__boxingDebug;
    dbg.layout.boxes = [{ id: 'clip-lg', type: 'large', title: 'C', x: 0, y: 0, width: 320, height: 220,
      children: [{ id: 'clip-sm', type: 'small', title: 'T', x: 0, y: 0, width: 300, height: 100 }] }];
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
    const surface = document.querySelector('.inner__surface') as HTMLElement | null;
    const content = document.querySelector('.inner__surface-content') as HTMLElement | null;
    const box = document.querySelector('.small-box[data-id="clip-sm"]') as HTMLElement | null;
    const head = document.querySelector('.inner__canvas-head') as HTMLElement | null;
    if (!surface || !box || !head) return { ok: false, hasSurface: !!surface, hasBox: !!box, hasHead: !!head, hasContent: !!content };
    const sr = surface.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const hr = head.getBoundingClientRect();
    const cr = content ? content.getBoundingClientRect() : null;
    const cs = content ? getComputedStyle(content) : null;
    return {
      ok: true, hasContent: !!content,
      surfaceTop: Math.round(sr.top), surfaceH: Math.round(sr.height),
      contentTop: cr ? Math.round(cr.top) : null, contentH: cr ? Math.round(cr.height) : null,
      contentTransform: cs ? cs.transform : null, contentInsetPosition: cs ? cs.position : null,
      boxTop: Math.round(br.top),
      headBottom: Math.round(hr.bottom),
      boxParent: box.parentElement?.className,
      surfaceChildren: Array.from(surface.children).map(c => c.className),
    };
  });
  expect('DIAG2=' + JSON.stringify(g)).toBe('DIAG2=SHOW');
});
