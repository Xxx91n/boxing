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
    // enter large box
    await page.locator('.large-box[data-id="pop-lg"]').dblclick();
    await page.waitForTimeout(300);
    // open edit popup for the bookmark
    const editBtn = page.locator('.small-box[data-id="pop-sm"] .bm-row__edit-btn').first();
    await editBtn.waitFor({ state: 'visible' });
    await editBtn.click();
    await page.waitForTimeout(150);
    const popup = page.locator('.bm-edit-popup');
    await expect(popup).toBeVisible();
    const urlInput = popup.locator('input').nth(1);
    // fill a longer value to enable drag-select
    await urlInput.fill('https://www.baidu.cn/some-very-long-text-to-select-here');
    // drag-select from inside the input to outside the popup
    await urlInput.selectText();
    // move mouse outside the popup to a canvas point and release
    const box = await popup.boundingBox();
    if (!box) throw new Error('no popup box');
    const outsideX = box.x + box.width + 200;
    const outsideY = box.y;
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(outsideX, outsideY, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    // The popup must still be present (drag-select did not close it)
    const stillThere = await page.evaluate(() => !!document.querySelector('.bm-edit-popup'));
    expect(stillThere).toBe(true);
  });
});
