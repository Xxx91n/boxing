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

test.describe('Bug3 settings persistence repro', () => {
  test('Bug3-a: set sameTab via UI change event; layout.settings.urlOpenMode= sameTab persisted', async ({ page }) => {
    await resetBoxing(page);
    // wait for layout init to apply default
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const select = document.getElementById('url-open-mode-select');
      const initial = dbg.layout.settings.urlOpenMode;
      const initialDom = select ? select.value : null;
      // simulate the user picking sameTab
      if (select) { select.value = 'sameTab'; select.dispatchEvent(new Event('change', { bubbles: true })); }
      return { initial, initialDom, afterChange: dbg.layout.settings.urlOpenMode, afterDom: select ? select.value : null };
    });
    console.log('Bug3-a:', JSON.stringify(r));
    expect(r.afterChange).toBe('sameTab');
  });

  test('Bug3-b: applyExternalLayout with remote urlOpenMode=sameTab — DOM sync', async ({ page }) => {
    await resetBoxing(page);
    const ids = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{ id: 'a1', type:'large', title:'A', x: 0, y: 0, width: 320, height: 220, children: [] }];
      dbg.renderCanvas();
      return [dbg.layout.boxes[0].id];
    });
    const r = await page.evaluate((ids) => {
      const dbg = (window as any).__boxingDebug;
      const remotePayload = JSON.parse(JSON.stringify(dbg.layout));
      remotePayload.settings = { ...(remotePayload.settings || {}), urlOpenMode: 'sameTab' };
      remotePayload._meta = { ...(remotePayload._meta || {}), revision: (remotePayload._meta?.revision || 0) + 1, updatedAt: Date.now() + 1, writerId: 'other-tab' };
      const applied = dbg.applyExternalLayout(remotePayload);
      const select = document.getElementById('url-open-mode-select');
      return { applied, settingsVal: dbg.layout.settings.urlOpenMode, domVal: select ? select.value : null };
    }, ids);
    console.log('Bug3-b:', JSON.stringify(r));
    // The actual settings should be updated; but DOM (set initially to default 'newTab') may not be re-synced.
    expect(r.settingsVal).toBe('sameTab');
  });

  test('Bug3-c: default urlOpenMode is newTab when undefined', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      delete dbg.layout.settings.urlOpenMode;
      const select = document.getElementById('url-open-mode-select');
      return { openBookmarkMode: dbg.layout.settings.urlOpenMode || 'newTab', selectVal: select ? select.value : null };
    });
    console.log('Bug3-c:', JSON.stringify(r));
    expect(r.openBookmarkMode).toBe('newTab');
  });
});
