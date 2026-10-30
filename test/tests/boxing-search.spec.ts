import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

test.describe('Boxing bookmark search ', () => {
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

    // Ticket 101 (this spec's historic flake face): the form was
    // fill -> fixed 200ms sleep -> read the class. Search is debounced (120ms,
    // ticket 83), so on a slow runner the class had not been applied yet and the
    // read raced the debounce (signature: Expected true / Received false,
    // macos-latest firefox only). A web-first assertion retries instead of
    // guessing a delay — and it is the only form that cannot pass vacuously.
    const matchBox = page.locator('.large-box[data-id="search-test-1"]');
    const hiddenBox = page.locator('.large-box[data-id="search-test-2"]');
    await expect(matchBox).toHaveClass(/large-box--search-match/);
    await expect(hiddenBox).toHaveClass(/large-box--search-hidden/);
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
    const box = page.locator('.large-box[data-id="clear-test-1"]');
    await searchInput.fill('TestBox');
    // Ticket 101: wait until the debounced search has actually applied, otherwise
    // the assertions below can pass vacuously (the classes were never added).
    await expect(box).toHaveClass(/large-box--search-match/);
    await searchInput.fill('');
    // The contract is that clearing REMOVES the classes — not that they were
    // absent because the search never ran.
    await expect(box).not.toHaveClass(/large-box--search-match/);
    await expect(box).not.toHaveClass(/large-box--search-hidden/);
  });

  test('Escape clears search', async ({ page }) => {
    await resetBoxing(page);
    // the tour is a modal that now consumes Escape (WCAG 2.1.2), and
    // this case is specifically about the SEARCH field's own Escape handling.
    // Without dismissing the tour first, the modal would legitimately take the
    // key and the assertion would be testing the wrong owner. The other two
    // cases in this file use fill()/class assertions, which the overlay does not
    // intercept, so they need no dismissal — same reasoning as ticket 101.
    await dismissOnboarding(page);
    const searchInput = page.locator('#q');
    await searchInput.fill('test');
    await searchInput.press('Escape');
    // Ticket 101: Escape clears the input synchronously; a retrying value
    // assertion replaces the fixed 200ms/100ms sleeps that raced it.
    await expect(searchInput).toHaveValue('');
    // The tour must stay closed: dismissing it is one-shot, and a second Escape
    // belongs to the page (here: no-op), never to a resurrected modal.
    expect(await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && ov.hidden);
    })).toBe(true);
  });

  test('favicon uses Promise.any parallel race (no serial waterfall)', async ({ page }) => {
    await resetBoxing(page);
    // loadFavicon now exposed via __boxingDebug.loadFavicon
    const usesPromiseAny = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      if (!dbg || typeof dbg.loadFavicon !== 'function') return false;
      return dbg.loadFavicon.toString().includes('Promise.any');
    });
    expect(usesPromiseAny).toBe(true);
  });

  // (ticket 83): the two specs above seed via push -> persistView -> reload, and the seeded
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

  // ── Ticket 82 (spec D6 / finding V-09) ─────────────────────────────────
  // Search-hit bookmark open must go through the same normalizeBookmarkUrl
  // gate as bookmark rows: invalid schemes, empty URLs, and protocol-relative
  // URLs are rejected with no navigation side effects, valid http(s) targets
  // keep the sameTab / newTab behavior.
  async function seedSearchBookmark(page, boxId, bmId, bmUrl) {
    await page.evaluate(({ boxId, bmId, bmUrl }) => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes.push({
        id: boxId, type: 'large', title: 'SearchHitBox', x: 0, y: 0, width: 320, height: 220,
        children: [{
          id: boxId + '-sm', type: 'small', title: 'HitSB', x: 0, y: 0, width: 300, height: 200,
          bookmarks: [{ id: bmId, title: 'HitBookmark', url: bmUrl }],
        }],
      });
      dbg.renderCanvas();
    }, { boxId, bmId, bmUrl });
  }

  test('search-hit with invalid bookmark URLs is rejected with no navigation side effects', async ({ page }) => {
    await resetBoxing(page);
    const invalid = [
      'javascript:alert(1)',
      'data:text/html,<script>1</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '//evil.example.test/protocol-relative',
      '',
    ];
    for (const [i, url] of invalid.entries()) {
      await seedSearchBookmark(page, `reject-box-${i}`, `reject-bm-${i}`, url);
    }
    const input = page.locator('#q');
    await input.fill('HitBookmark');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.search-results__item').length)).toBe(invalid.length);
    const before = page.url();
    await page.evaluate(() => {
      (window as any).__searchHitOpened = [];
      window.open = ((u?: any) => { (window as any).__searchHitOpened.push(String(u)); return null; }) as any;
      const items = Array.from(document.querySelectorAll('.search-results__item')) as HTMLElement[];
      for (const item of items) item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(150);
    expect(page.url()).toBe(before);
    const opened = await page.evaluate(() => (window as any).__searchHitOpened || []);
    expect(opened).toEqual([]);
  });

  test('search-hit with a valid http URL navigates via the normalized path (sameTab)', async ({ page }) => {
    await resetBoxing(page);
    await page.route('https://search-hit.example.test/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>hit</body></html>' }));
    await seedSearchBookmark(page, 'ok-box-1', 'ok-bm-1', 'https://search-hit.example.test/bookmark');
    const input = page.locator('#q');
    await input.fill('HitBookmark');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.search-results__item').length)).toBe(1);
    await page.evaluate(() => {
      (window as any).__searchHitOpened = [];
      window.open = ((u?: any) => { (window as any).__searchHitOpened.push(String(u)); return null; }) as any;
      const item = document.querySelector('.search-results__item') as HTMLElement | null;
      item?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.url(), { timeout: 5000 }).toContain('search-hit.example.test/bookmark');
    const opened = await page.evaluate(() => (window as any).__searchHitOpened || []);
    expect(opened).toEqual([]);
  });

  test('search-hit with a valid http URL opens a NEW tab via the normalized path (newTab)', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.urlOpenMode = 'newTab';
    });
    await seedSearchBookmark(page, 'ok-box-2', 'ok-bm-2', 'https://search-hit.example.test/bookmark2');
    const input = page.locator('#q');
    await input.fill('HitBookmark');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.search-results__item').length)).toBe(1);
    const before = page.url();
    await page.evaluate(() => {
      (window as any).__searchHitOpened = [];
      window.open = ((u?: any) => { (window as any).__searchHitOpened.push(String(u)); return null; }) as any;
      const item = document.querySelector('.search-results__item') as HTMLElement | null;
      item?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__searchHitOpened || []), { timeout: 5000 }).toContain('https://search-hit.example.test/bookmark2');
    expect(page.url()).toBe(before);
  });

  // ── Ticket 85 (spec D9 / finding I-02) ─────────────────────────────────
  // Identifier DOM queries must CSS.escape box/small-box ids. A small-box id
  // containing `"`, `]`, or whitespace must still be located by the chip
  // click without throwing and without mis-matching a different element.
  async function seedSpecialIdBox(page) {
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes.push({
        id: 'loc-lb-special', type: 'large', title: 'SpecialIdBox', x: 0, y: 0, width: 320, height: 220,
        children: [
          { id: 'we"ird ]id 1', type: 'small', title: 'SpecialSB', x: 0, y: 0, width: 140, height: 100, bookmarks: [] },
          { id: 'plain-sb-1', type: 'small', title: 'PlainSB', x: 160, y: 0, width: 140, height: 100, bookmarks: [] },
        ],
      });
      dbg.renderCanvas();
    });
  }

  test('special-character small-box id is located via chip without throwing or mis-matching', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await resetBoxing(page);
    await seedSpecialIdBox(page);
    // Click the chip whose data-small-id holds quotes/brackets/whitespace.
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.large-box__chip'));
      const chip = chips.find((c) => c.getAttribute('data-small-id') === 'we"ird ]id 1');
      if (chip) (chip as HTMLElement).click();
    });
    await page.waitForTimeout(400);
    const located = await page.evaluate(() => {
      const special = document.querySelector('.small-box[data-id="' + CSS.escape('we"ird ]id 1') + '"]');
      const plain = document.querySelector('.small-box[data-id="plain-sb-1"]');
      return {
        specialFound: Boolean(special),
        specialLocated: Boolean(special && special.classList.contains('small-box--located')),
        plainLocated: Boolean(plain && plain.classList.contains('small-box--located')),
        locatedCount: document.querySelectorAll('.small-box--located').length,
      };
    });
    expect(pageErrors).toEqual([]);
    expect(located.specialFound).toBe(true);
    expect(located.specialLocated).toBe(true);
    expect(located.plainLocated).toBe(false);
    expect(located.locatedCount).toBe(1);
  });
});
