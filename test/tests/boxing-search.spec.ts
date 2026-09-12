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

  // A-033 (ticket 83): the two specs above seed via push -> persistView -> reload, and the seeded
  // boxes do not survive that reload in the file:// lane -- that is the pre-existing B3 breakage
  // (ticket 72 surface; root-cause evidence in reports/83-report.md §5). The debounce specs below
  // therefore seed and renderCanvas() in-page: no reload, no persistence dependency.
  async function seedLargeBox(page, id, title) {
    await page.evaluate(({ boxId, boxTitle }) => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes.push({ id: boxId, type: 'large', title: boxTitle, x: 0, y: 0, width: 320, height: 220, children: [] });
      dbg.renderCanvas();
    }, { boxId: id, boxTitle: title });
    await expect.poll(() => page.evaluate((boxId) => Boolean(document.querySelector(`.large-box[data-id="${boxId}"]`)), id)).toBe(true);
  }

  test('debounce: a keystroke burst runs the query once, after typing pauses', async ({ page }) => {
    await resetBoxing(page);
    await seedLargeBox(page, 'burst-test-1', 'GitHub');

    // Six input events dispatched in one synchronous turn -- no timer can interleave, so the
    // assertion is deterministic instead of timing-dependent.
    const runs = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const input = document.getElementById('q') as HTMLInputElement;
      const before = dbg.searchRunCount();
      for (const v of ['G', 'Gi', 'Git', 'GitH', 'GitHu', 'GitHub']) {
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const immediately = dbg.searchRunCount();
      await new Promise((r) => setTimeout(r, 400));
      return { before, immediately, after: dbg.searchRunCount() };
    });

    expect(runs.immediately).toBe(runs.before); // nothing runs per keystroke
    expect(runs.after).toBe(runs.before + 1);   // exactly one query once typing pauses
    // Same hits/highlight as the un-debounced path (AC: 结果一致).
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.search-results__item').length)).toBe(1);
    await expect.poll(() => page.evaluate(() => Boolean(
      document.querySelector('.large-box[data-id="burst-test-1"]')?.classList.contains('large-box--search-match'),
    ))).toBe(true);
  });

  test('debounce: Enter flushes the pending query without waiting for the pause', async ({ page }) => {
    await resetBoxing(page);
    await seedLargeBox(page, 'enter-test-1', 'GitHub');

    // Type and press Enter in the same synchronous turn: the debounce must not swallow it.
    const items = await page.evaluate(() => {
      const input = document.getElementById('q') as HTMLInputElement;
      input.value = 'GitHub';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      return document.querySelectorAll('.search-results__item').length;
    });
    expect(items).toBe(1);
  });
});
