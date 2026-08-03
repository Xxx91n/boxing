import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\\\/g, '/')}`;

test('zoom-arrow diagnostic', async ({ page }) => {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

  const diag = await page.evaluate(() => {
    const ctrl = document.querySelector('#canvas-zoom') as HTMLElement | null;
    const arrows = Array.from(document.querySelectorAll('#canvas-zoom .zoom-arrow')) as HTMLElement[];
    const btns = Array.from(document.querySelectorAll('#canvas-zoom .zoom-btn')) as HTMLElement[];
    if (!ctrl) return { ok: false };
    const cs = getComputedStyle(ctrl);
    const out = arrows.map(a => {
      const acs = getComputedStyle(a);
      return { text: a.textContent, ohW: a.offsetWidth, ohH: a.offsetHeight, display: acs.display, fontSize: acs.fontSize, lineHeight: acs.lineHeight, width: acs.width, height: acs.height, visibility: acs.visibility, position: acs.position };
    });
    const bout = btns.map(b => { const bcs = getComputedStyle(b); return { ohW: b.offsetWidth, ohH: b.offsetHeight, display: bcs.display, fontSize: bcs.font, minW: bcs.minWidth } as any; });
    return {
      ok: true,
      ctrl: { visible: ctrl.offsetParent !== null, ohW: ctrl.offsetWidth, ohH: ctrl.offsetHeight, display: cs.display, visibility: cs.visibility },
      arrows: out,
      btns: bout,
    };
  });
  console.log('DIAG', JSON.stringify(diag));
  expect(true).toBe(true);
});
