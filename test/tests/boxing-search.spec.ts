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

test.describe('Boxing bookmark search (BX-DEV-SEARCH)', () => {
  test('search filters large boxes by title on main canvas', async ({ page }) => {
    await resetBoxing(page);
    // Create two large boxes with different titles
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes.push(
        { id: 'search-test-1', type: 'large', title: 'GitHub', x: 0, y: 0, width: 320, height: 220, children: [] },
        { id: 'search-test-2', type: 'large', title: 'Google', x: 400, y: 0, width: 320, height: 220, children: [] },
      );
      dbg.layout._meta = dbg.layout._meta || {};
      dbg.layout._meta.updatedAt = Date.now();
    });
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    // Type in search box
    const searchInput = page.locator('#q');
    await searchInput.fill('GitHub');
    await page.waitForTimeout(200);

    const result = await page.evaluate(() => {
      const matchEl = document.querySelector('.large-box[data-id="search-test-1"]');
      const hiddenEl = document.querySelector('.large-box[data-id="search-test-2"]');
      return {
        matchHasClass: matchEl?.classList.contains('large-box--search-match'),
        hiddenHasClass: hiddenEl?.classList.contains('large-box--search-hidden'),
        caption: document.getElementById('caption')?.textContent,
      };
    });
    expect(result.matchHasClass).toBe(true);
    expect(result.hiddenHasClass).toBe(true);
  });

  test('search clears highlight when emptied', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes.push(
        { id: 'clear-test-1', type: 'large', title: 'TestBox', x: 0, y: 0, width: 320, height: 220, children: [] },
      );
      dbg.layout._meta = dbg.layout._meta || {};
      dbg.layout._meta.updatedAt = Date.now();
    });
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    const searchInput = page.locator('#q');
    await searchInput.fill('TestBox');
    await page.waitForTimeout(200);
    await searchInput.fill('');
    await page.waitForTimeout(200);

    const result = await page.evaluate(() => {
      const el = document.querySelector('.large-box[data-id="clear-test-1"]');
      return {
        hasMatch: el?.classList.contains('large-box--search-match'),
        hasHidden: el?.classList.contains('large-box--search-hidden'),
      };
    });
    expect(result.hasMatch).toBe(false);
    expect(result.hasHidden).toBe(false);
  });

  test('Escape clears search', async ({ page }) => {
    await resetBoxing(page);
    const searchInput = page.locator('#q');
    await searchInput.fill('test');
    await page.waitForTimeout(200);
    await searchInput.press('Escape');
    await page.waitForTimeout(100);
    expect(await searchInput.inputValue()).toBe('');
  });

  test('favicon uses Promise.any parallel race (no serial waterfall)', async ({ page }) => {
    await resetBoxing(page);
    // BX-DEV-126: loadFavicon now exposed via __boxingDebug.loadFavicon
    const usesPromiseAny = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      if (!dbg || typeof dbg.loadFavicon !== 'function') return false;
      return dbg.loadFavicon.toString().includes('Promise.any');
    });
    expect(usesPromiseAny).toBe(true);
  });
});
