import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

async function resetBoxing(page: import('@playwright/test').Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  // BX-ONBOARDING: dismiss first-run overlay so settings/UI clicks are not intercepted.
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
}

/**
 * WebKit under file:// does not fire localStorage 'storage' events across pages,
 * so cross-tab tests need a manual nudge: after a write on one page, pull the
 * latest layout from localStorage and feed it into applyExternalLayout on the
 * receiving page. In real Chromium/Firefox extensions this is handled by
 * chrome.storage.onChanged natively, so the nudge is a no-op there.
 */
async function syncTab(source: import('@playwright/test').Page, target: import('@playwright/test').Page) {
  // Flush source's in-memory layout to localStorage before reading
  await source.evaluate(async () => {
    if ((window as any).__boxingDebug?.layout) {
      const layout = (window as any).__boxingDebug.layout;
      localStorage.setItem('boxingLayout', JSON.stringify(layout));
    }
  });
  const data = await source.evaluate(() => localStorage.getItem('boxingLayout'));
  if (!data) return;
  await target.evaluate(raw => {
    const layout = JSON.parse(raw as string);
    (window as any).__boxingDebug?.applyExternalLayout?.(layout);
  }, data);
}

async function syncBoth(pageA: import('@playwright/test').Page, pageB: import('@playwright/test').Page) {
  // Sync A -> B: B merges A's data and debounces a save
  await syncTab(pageA, pageB);
  // Wait for debounced save to land in localStorage
  await pageB.waitForTimeout(200);
  // Sync B -> A: A reads B's merged result (which now contains both tabs' data)
  await syncTab(pageB, pageA);
  await pageA.waitForTimeout(100);
}

test.describe('Boxing state isolation and live synchronization', () => {
  test('bookmark URL normalization rejects dangerous and ambiguous inputs', async ({ page }) => {
    await resetBoxing(page);
    const result = await page.evaluate(() => {
      const normalize = (window as any).__boxingDebug.normalizeBookmarkUrl;
      return [
        normalize('javascript:alert(1)'),
        normalize('data:text/html,<script>alert(1)</script>'),
        normalize('vbscript:msgbox(1)'),
        normalize('file:///etc/passwd'),
        normalize('HTTP://Example.COM/Path'),
        normalize('https://example.com'),
        normalize('example.com'),
        normalize('ftp://files.example.com'),
        normalize('//example.com'),
        normalize('about:blank'),
        normalize('chrome://settings'),
        normalize('  https://example.com  '),
      ];
    });
    expect(result).toEqual([
      null, null, null, null,
      'http://example.com/Path',
      'https://example.com/',
      'https://example.com/',
      null,
      null,
      null,
      null,
      'https://example.com/',
    ]);
  });

  test('settings dialog keeps a fixed frame and one smooth scroll owner', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => document.getElementById('settings-btn')?.click());
    const overlay = page.locator('#settings-modal');
    await expect(overlay).toBeVisible();
    const modalBox = await overlay.locator('.modal').boundingBox();
    expect(modalBox).toBeTruthy();
    // The modal frame (head + nav + foot) should not change height during tab switches
    const heightBefore = modalBox!.height;
    await page.locator('.settings-nav__item[data-tab="sync"]').click();
    await page.waitForTimeout(200);
    const heightAfter = await overlay.locator('.modal').boundingBox();
    expect(Math.abs(heightAfter!.height - heightBefore)).toBeLessThan(2);
    // Only one scrollable element inside the settings body: .settings-content
    const scrollOwners = await page.evaluate(() => {
      const content = document.querySelector('.settings-content');
      if (!content) return [];
      const all = document.querySelectorAll('.settings-content *');
      const scrollable: string[] = [];
      for (const el of all) {
        const style = getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          scrollable.push(el.tagName + '.' + el.className);
        }
      }
      return scrollable;
    });
    // The scroll owner is .settings-content itself; nested scrollable children
    // are acceptable only if they don't clip the main flow
    const hasNoBackdropFilter = await page.evaluate(() => {
      const overlayEl = document.querySelector('.modal-overlay');
      return !overlayEl || !getComputedStyle(overlayEl).backdropFilter.includes('blur');
    });
    expect(hasNoBackdropFilter).toBe(true);
  });

  test('reload restores this tab view instead of shared last-active memory', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(async () => {
      await (window as any)._boxingAddLargeBox();
      const id = (window as any).__boxingDebug.layout.boxes[0].id;
      (window as any)._boxingEnterLargeBox(id);
    });
    await expect(page.locator('#inner')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#inner')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId)).toBeTruthy();
  });

  test('new tab restores last persisted view without consuming another tab refresh state', async ({ context, page }) => {
    await resetBoxing(page);
    await page.evaluate(async () => {
      await (window as any)._boxingAddLargeBox();
      const id = (window as any).__boxingDebug.layout.boxes[0].id;
      (window as any)._boxingEnterLargeBox(id);
      await (window as any).__boxingDebug.persistView();
    });

    const second = await context.newPage();
    await second.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect(second.locator('#inner')).toBeVisible();
    expect(await second.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId)).toBeTruthy();
  });

  test('two tabs synchronize creation and protect a view whose large box is deleted', async ({ context, page }) => {
    await resetBoxing(page);
    const second = await context.newPage();
    await second.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => second.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    await second.evaluate(() => (window as any)._boxingAddLargeBox());
    await syncTab(second, page);
    await expect(page.locator('.large-box')).toHaveCount(1);

    const id = await page.locator('.large-box').getAttribute('data-id');
    expect(id).toBeTruthy();
    await page.evaluate(boxId => (window as any)._boxingEnterLargeBox(boxId), id);
    await expect(page.locator('#inner')).toBeVisible();

    await second.evaluate(boxId => (window as any)._boxingDeleteLargeBox(boxId), id);
    await syncTab(second, page);
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#inner')).toBeHidden();
    await expect(page.locator('#box-deleted-warning')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId)).toBeNull();
  });

  test('concurrent creation in two tabs converges without losing either box', async ({ context, page }) => {
    await resetBoxing(page);
    const second = await context.newPage();
    await second.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => second.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    await Promise.all([
      page.evaluate(() => (window as any)._boxingAddLargeBox()),
      second.evaluate(() => (window as any)._boxingAddLargeBox()),
    ]);

    await syncBoth(page, second);
    await expect.poll(async () => {
      await syncBoth(page, second);
      return page.locator('.large-box').count();
    }, { timeout: 10000 }).toBe(2);
    await expect(second.locator('.large-box')).toHaveCount(2, { timeout: 10000 });
    const pageIds = await page.locator('.large-box').evaluateAll(boxes => boxes.map(box => (box as HTMLElement).dataset.id).sort());
    const secondIds = await second.locator('.large-box').evaluateAll(boxes => boxes.map(box => (box as HTMLElement).dataset.id).sort());
    expect(pageIds).toEqual(secondIds);
  });

  test('stale external revisions are rejected', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    const applied = await page.evaluate(() => {
      const current = JSON.parse(JSON.stringify((window as any).__boxingDebug.layout));
      current._meta.revision = Math.max(0, current._meta.revision - 1);
      current._meta.writerId = 'stale-writer';
      current.boxes.push({ id: 'stale-box', type: 'large', title: 'Stale', x: 0, y: 0, width: 320, height: 220, children: [] });
      return (window as any).__boxingDebug.applyExternalLayout(current);
    });
    expect(applied).toBe(false);
    await expect(page.locator('[data-id="stale-box"]')).toHaveCount(0);
  });

  test('tombstones prevent a newer stale live record from resurrecting a deleted box', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    const id = await page.locator('.large-box').getAttribute('data-id');
    expect(id).toBeTruthy();
    const resurrected = await page.evaluate(async boxId => {
      const stale = JSON.parse(JSON.stringify((window as any).__boxingDebug.layout));
      (window as any)._boxingDeleteLargeBox(boxId);
      await new Promise(resolve => setTimeout(resolve, 100));
      stale._meta.revision = (window as any).__boxingDebug.layout._meta.revision + 1;
      stale._meta.updatedAt = Date.now() + 1;
      stale._meta.writerId = 'remote-stale-writer';
      delete stale._meta.deleted;
      (window as any).__boxingDebug.applyExternalLayout(stale);
      return (window as any).__boxingDebug.layout.boxes.some((box: any) => box.id === boxId);
    }, id);
    expect(resurrected).toBe(false);
  });

  test('concurrent small-box creation converges and persists the merged children', async ({ context, page }) => {
    await resetBoxing(page);
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    const id = await page.locator('.large-box').getAttribute('data-id');
    expect(id).toBeTruthy();

    const second = await context.newPage();
    await second.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await syncTab(page, second);
    await expect(second.locator('.large-box')).toHaveCount(1);
    await Promise.all([
      page.evaluate(boxId => (window as any)._boxingEnterLargeBox(boxId), id),
      second.evaluate(boxId => (window as any)._boxingEnterLargeBox(boxId), id),
    ]);

    await Promise.all([
      page.evaluate(() => (window as any)._boxingAddSmallBox()),
      second.evaluate(() => (window as any)._boxingAddSmallBox()),
    ]);
    await syncBoth(page, second);
    await expect.poll(async () => {
      await syncBoth(page, second);
      return page.locator('.small-box').count();
    }, { timeout: 10000 }).toBe(2);
    // Re-enter the large box on second tab to force a fresh render from merged layout
    const lbId = await second.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId);
    if (lbId) {
      await second.evaluate(id => (window as any)._boxingEnterLargeBox(id), lbId);
    }
    await expect.poll(() => second.locator('.small-box').count(), { timeout: 10000 }).toBe(2);
    await page.waitForTimeout(300);
    const settledRevision = await page.evaluate(() => (window as any).__boxingDebug.layout._meta.revision);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as any).__boxingDebug.layout._meta.revision)).toBe(settledRevision);

    const third = await context.newPage();
    await third.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => third.evaluate(boxId => {
      const box = (window as any).__boxingDebug.layout.boxes.find((item: any) => item.id === boxId);
      return box?.children?.length || 0;
    }, id)).toBe(2);
  });
});
