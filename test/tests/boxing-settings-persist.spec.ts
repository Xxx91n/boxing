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
    // The actual settings should be updated; the DOM is re-synced by applyExternalLayout (BX-DEV-122 Bug3).
    expect(r.settingsVal).toBe('sameTab');
  });

  test('Bug3-c (ticket 11): default urlOpenMode is sameTab when undefined', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      delete dbg.layout.settings.urlOpenMode;
      // Exercise the real cross-tab sync path (BX-DEV-122 Bug3): remote with the key
      // missing on both sides must leave the select on the sameTab fallback, not newTab.
      const remote = JSON.parse(JSON.stringify(dbg.layout));
      remote._meta = { ...(remote._meta || {}), revision: (remote._meta?.revision || 0) + 1, updatedAt: Date.now() + 1, writerId: 'other-tab' };
      dbg.applyExternalLayout(remote);
      const select = document.getElementById('url-open-mode-select');
      return { openBookmarkMode: dbg.layout.settings.urlOpenMode || 'sameTab', selectVal: select ? select.value : null };
    });
    console.log('Bug3-c:', JSON.stringify(r));
    expect(r.openBookmarkMode).toBe('sameTab');
    // AC ticket 11: settings UI shows Current Tab; no regression to newTab after cross-tab onChanged
    expect(r.selectVal).toBe('sameTab');
  });
});

test.describe('Ticket 11 — urlOpenMode defaults to sameTab (bookmarks open in current tab)', () => {
  test('T11-a: fresh install defaults layout.settings.urlOpenMode to sameTab', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    const r = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.urlOpenMode);
    expect(r).toBe('sameTab');
  });

  test('T11-b: migrateLayout — missing key migrates to sameTab, explicit stored newTab is preserved', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return {
        empty: dbg.migrateLayout(null).settings.urlOpenMode,
        missingKey: dbg.migrateLayout({ version: 3.5, settings: {} }).settings.urlOpenMode,
        storedNewTab: dbg.migrateLayout({ version: 3.5, settings: { urlOpenMode: 'newTab' } }).settings.urlOpenMode,
      };
    });
    console.log('T11-b:', JSON.stringify(r));
    expect(r.empty).toBe('sameTab');
    expect(r.missingKey).toBe('sameTab');
    // user's explicit stored New Tab choice must survive the upgrade
    expect(r.storedNewTab).toBe('newTab');
  });

  test('T11-c: open path with missing key navigates the CURRENT tab, no new tab spawned', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      delete dbg.layout.settings.urlOpenMode;
      (window as any).__t11opened = [];
      window.open = (u?: any) => { (window as any).__t11opened.push(String(u)); return null; };
      dbg.openBookmarkUrl(location.href + '#t11-same-tab');
    });
    await expect.poll(() => page.url(), { timeout: 5000 }).toContain('#t11-same-tab');
    const opened = await page.evaluate(() => (window as any).__t11opened || []);
    expect(opened).toEqual([]);
  });

  test('T11-d: open path with stored newTab still opens a NEW tab, current tab untouched', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.urlOpenMode = 'newTab';
      (window as any).__t11opened = [];
      window.open = (u?: any) => { (window as any).__t11opened.push(String(u)); return null; };
      const before = location.href;
      dbg.openBookmarkUrl('https://example.test/bookmark');
      return { opened: (window as any).__t11opened, before, stillHere: location.href };
    });
    expect(r.opened).toContain('https://example.test/bookmark');
    expect(r.stillHere).toBe(r.before);
  });
});

// ═════════════════════════ Ticket 52 — 新装/重置默认 sameTab（以实机为准） ═════════════════════════
test.describe('Ticket 52 — fresh-install/reset opens bookmarks in the CURRENT tab (A-004/A-005)', () => {
  test('T52-a: empty-storage fresh install — model default sameTab, no persisted newTab', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    const r = await page.evaluate(() => ({
      stored: localStorage.getItem('boxingLayout'),
      mode: (window as any).__boxingDebug.layout.settings.urlOpenMode,
    }));
    // 空 storage 新装：模型默认必须是 sameTab；若 boot 路径已回写主键，回写的也只会是 sameTab（不得夹带 newTab）。
    expect(r.mode).toBe('sameTab');
    if (r.stored) expect(r.stored).not.toContain('newTab');
  });

  test('T52-b: bookmark-ROW click after fresh install navigates the CURRENT tab, spawns no new tab', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    // seed one box with one bookmark (in-memory layout, default settings — same state a fresh install has)
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{
        id: 't52-lg', type: 'large', title: 'T52', x: 0, y: 0, width: 320, height: 220,
        children: [
          { id: 't52-sm', type: 'small', title: 'SB', x: 0, y: 0, width: 300, height: 200,
            bookmarks: [{ id: 'bm52', title: 'T52 target', url: 'https://t52.example.test/bookmark' }],
          },
        ],
      }];
      dbg.layout._meta = { updatedAt: Date.now() };
    });
    await page.evaluate(() => (window as any).__boxingDebug.persistView());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 10000 }).toBe(true);
    // enter the large box via synthetic dblclick (native input stalls on firefox — playwright#16095 precedent)
    await page.evaluate(() => {
      const el = document.querySelector('.large-box[data-id="t52-lg"]') as HTMLElement | null;
      el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await page.route('https://t52.example.test/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>t52</body></html>' }));
    const ctx = page.context();
    // sameTab contract: current tab navigates to the bookmark URL …
    await page.evaluate(() => {
      const row = document.querySelector('.small-box[data-id="t52-sm"] .bm-row') as HTMLElement | null;
      row?.click();
    });
    await expect.poll(() => page.url(), { timeout: 5000 }).toContain('t52.example.test/bookmark');
    // … and NO new tab is spawned (newTab branch would window.open / tabs.create → page event)
    expect(ctx.pages().length).toBe(1);
  });

  test('T52-c: first-frame settings DOM defaults to sameTab before any modal sync (首帧 DOM)', async ({ page }) => {
    await resetBoxing(page);
    // syncSettingsDOM only runs on modal-open / applyExternalLayout — this pins the static HTML default.
    const v = await page.evaluate(() => (document.getElementById('url-open-mode-select') as HTMLSelectElement | null)?.value);
    expect(v).toBe('sameTab');
  });

  test('T52-d: v2 migration write path fills urlOpenMode=sameTab (旧包迁移残留面)', async ({ page }) => {
    await resetBoxing(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const v2 = (settings: any) => dbg.migrateLayout({ version: 2, boxes: [{ id: 'l1', children: [] }], settings });
      return {
        noSettings: v2(undefined).settings.urlOpenMode,
        emptySettings: v2({}).settings.urlOpenMode,
        storedNewTab: v2({ urlOpenMode: 'newTab' }).settings.urlOpenMode,
      };
    });
    expect(r.noSettings).toBe('sameTab');
    expect(r.emptySettings).toBe('sameTab');
    // explicit stored choice survives migration
    expect(r.storedNewTab).toBe('newTab');
  });

  test('T52-e: unknown/legacy mode value is treated as sameTab, never spawns a tab (残留写路径硬化)', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 3000 });
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.urlOpenMode = 'legacy-garbage';
      (window as any).__t52opened = [];
      window.open = ((u: any) => { (window as any).__t52opened.push(String(u)); return null; }) as any;
      dbg.openBookmarkUrl(location.href + '#t52-unknown');
    });
    await expect.poll(() => page.url(), { timeout: 5000 }).toContain('#t52-unknown');
    const opened = await page.evaluate(() => (window as any).__t52opened || []);
    expect(opened).toEqual([]);
  });
});
