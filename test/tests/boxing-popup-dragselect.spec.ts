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

// BX-DEV-127 (B7): drag-select text inside the edit popup must NOT dismiss the popup
// even when the selection ends outside the popup bounds.
test.describe('Boxing popup drag-select (BX-DEV-POPUP-DRAGSELECT)', () => {
  test('edit popup stays open when text drag-selection ends outside popup', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{
        id: 'pop-lg', type: 'large', title: 'Pop', x: 0, y: 0, width: 320, height: 220,
        children: [
          { id: 'pop-sm', type: 'small', title: 'SB', x: 0, y: 0, width: 300, height: 200,
            bookmarks: [{ id: 'bm1', title: 'https://www.baidu.cn/', url: 'https://www.baidu.cn/' }],
          },
        ],
      }];
      dbg.layout._meta = { updatedAt: Date.now() };
    });
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    // enter large box via synthetic dblclick — native input stalls on firefox
    // (playwright#16095 class, ticket-18 probe 2026-09-03); same dispatch pattern
    // as the innerclip specs in the main lane.
    await page.evaluate(() => {
      const el = document.querySelector('.large-box[data-id="pop-lg"]') as HTMLElement | null;
      el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    // open edit popup via JS click (no native input pipeline)
    await page.evaluate(() => {
      (document.querySelector('.small-box[data-id="pop-sm"] .bm-row__edit-btn') as HTMLElement | null)?.click();
    });
    await page.waitForTimeout(150);
    const popup = page.locator('.bm-edit-popup');
    await expect(popup).toBeVisible();
    const urlInput = popup.locator('input').nth(1);
    // fill a longer value to enable drag-select
    await urlInput.fill('https://www.baidu.cn/some-very-long-text-to-select-here');
    await urlInput.selectText();
    // press inside the input, drag past the popup edge, release outside — synthetic
    // pointer/mouse sequence. The BX-DEV-127 guard keys on the mousedown origin only
    // (document-capture mousedown inside the popup → no dismiss), so the synthetic
    // sequence exercises the same decision the real drag feeds it.
    const box = await popup.boundingBox();
    if (!box) throw new Error('no popup box');
    const outsideX = box.x + box.width + 200;
    const outsideY = box.y;
    await page.evaluate(({ bx, by, ox, oy }) => {
      const fire = (type: string, x: number, y: number, target?: EventTarget) => {
        const opts: any = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true };
        (target ?? document).dispatchEvent(new PointerEvent(type, opts));
        (target ?? document).dispatchEvent(new MouseEvent(type.replace('pointer', 'mouse'), opts));
      };
      const input = document.querySelector('.bm-edit-popup input') as HTMLElement | null;
      fire('pointerdown', bx + 30, by + 30, input);
      for (let s = 1; s <= 6; s++) {
        fire('pointermove', bx + 30 + ((ox - bx - 30) * s) / 6, by + ((oy - by) * s) / 6);
      }
      fire('pointerup', ox, oy);
    }, { bx: box.x, by: box.y, ox: outsideX, oy: outsideY });
    await page.waitForTimeout(200);
    // The popup must still be present (drag-select did not close it)
    const stillThere = await page.evaluate(() => !!document.querySelector('.bm-edit-popup'));
    expect(stillThere).toBe(true);
  });
});
