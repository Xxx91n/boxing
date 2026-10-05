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

// BX-D-008: the dark-mode cases drive the REAL header button, and the first-run
// tour is a full-viewport aria-modal overlay that wins the hit test — without
// this, page.click('#dark-mode-btn') lands on the overlay and every case fails
// for a reason that has nothing to do with dark mode (ticket 101 / A-055 / B65).
async function resetAndDismiss(page) {
  await resetBoxing(page);
  await dismissOnboarding(page);
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
    // Brain fix 2026-09-12: persistView() only writes view-state keys — the seeded
    // boxes must go through saveLayout() or reload loses them (T52-b was a broken test).
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 10000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length), { timeout: 10000 }).toBeGreaterThan(0);
    await page.evaluate(() => (window as any).__boxingDebug.renderCanvas());
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

// ═══════════════════════════════════════════════════════════════════════════
// BX-D-008 (Wave 2026.10.11 P-18 / S-11): dark-mode convergence.
//
// Regression class: three writers of '.ntp--dark' that disagreed.
//   1. boot-theme.js ADDED the class to <html> and only ever added it, while
//      the toggles wrote #app + body — so a session that booted dark could
//      never return to light ("only a new tab helps").
//   2. loadSettings never removed a stale class, so the mirror and the DOM
//      disagreed after a cross-tab change.
//   3. applyExternalLayout adopted remote settings without replaying any
//      visual state, so the session looked right and the reload disagreed.
//
// Every assertion below checks the html class as the SINGLE host: if any of
// these pass while #app/body still carry the class, the bug is back.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('BX-D-008: dark mode has one host and one apply path', () => {
  const BOOT_MIRROR_KEY = 'boxingBootTheme.v1';

  // Read every place the class could be, so an assertion can never pass by
  // looking at only one of them.
  const themeState = (page: any) => page.evaluate((key) => {
    const root = document.documentElement;
    let mirror: any = null;
    try { mirror = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { mirror = 'PARSE_ERROR'; }
    return {
      html: root.classList.contains('ntp--dark'),
      app: Boolean(document.getElementById('app')?.classList.contains('ntp--dark')),
      body: document.body.classList.contains('ntp--dark'),
      setting: (window as any).__boxingDebug.layout.settings.darkMode,
      mirror,
      // The control must agree with the applied theme, in both directions.
      glyph: document.querySelector('#dark-mode-btn span')?.textContent || null,
    };
  }, BOOT_MIRROR_KEY);

  test('D008-1: header toggle switches dark -> light in-page (the headline bug)', async ({ page }) => {
    await resetAndDismiss(page);
    expect((await themeState(page)).html).toBe(false);
    // Go dark through the real control.
    await page.click('#dark-mode-btn');
    await expect.poll(async () => (await themeState(page)).html).toBe(true);
    // Back to light. Before the fix this could not clear the html class that
    // boot-theme.js had added, so the page stayed dark until a new tab opened.
    await page.click('#dark-mode-btn');
    await expect.poll(async () => (await themeState(page)).html, { timeout: 5000 }).toBe(false);
    const s = await themeState(page);
    expect(s.setting).toBe(false);
    expect(s.mirror.darkMode).toBe(false);
    expect(s.glyph).toBe('\u2600'); // sun = light active
  });

  test('D008-2: html is the ONLY host — #app/body never carry the class', async ({ page }) => {
    await resetAndDismiss(page);
    await page.click('#dark-mode-btn');
    await expect.poll(async () => (await themeState(page)).html).toBe(true);
    let s = await themeState(page);
    expect(s.app, '#app must not be a dark-mode host').toBe(false);
    expect(s.body, 'body must not be a dark-mode host').toBe(false);
    await page.click('#dark-mode-btn');
    await expect.poll(async () => (await themeState(page)).html).toBe(false);
    s = await themeState(page);
    expect(s.app).toBe(false);
    expect(s.body).toBe(false);
  });

  test('D008-3: settings checkbox drives the same single path as the header button', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const cb = document.getElementById('dark-mode-cb') as HTMLInputElement | null;
      if (!cb) throw new Error('dark-mode checkbox missing');
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect.poll(async () => (await themeState(page)).html).toBe(true);
    let s = await themeState(page);
    expect(s.setting).toBe(true);
    expect(s.mirror.darkMode).toBe(true);
    expect(s.app).toBe(false);
    expect(s.body).toBe(false);
    // And back off through the same control.
    await page.evaluate(() => {
      const cb = document.getElementById('dark-mode-cb') as HTMLInputElement | null;
      if (!cb) throw new Error('dark-mode checkbox missing');
      cb.checked = false;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect.poll(async () => (await themeState(page)).html).toBe(false);
    s = await themeState(page);
    expect(s.setting).toBe(false);
    expect(s.mirror.darkMode).toBe(false);
  });

  test('D008-4: choice survives a reload (boot mirror and settings agree)', async ({ page }) => {
    await resetAndDismiss(page);
    await page.click('#dark-mode-btn');
    await expect.poll(async () => (await themeState(page)).html).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    // Dark must survive the reload.
    await expect.poll(async () => (await themeState(page)).html, { timeout: 8000 }).toBe(true);
    // Now flip to light and reload: this is the half that used to regress,
    // because boot-theme only ever ADDED the class.
    await page.click('#dark-mode-btn');
    await expect.poll(async () => (await themeState(page)).html).toBe(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    await expect.poll(async () => (await themeState(page)).html, { timeout: 8000 }).toBe(false);
    const s = await themeState(page);
    expect(s.setting).toBe(false);
    expect(s.mirror.darkMode).toBe(false);
  });

  test('D008-5: remote merge (incomingWins) replays the visual state in-session', async ({ page }) => {
    await resetAndDismiss(page);
    // Local tab is dark...
    await page.click('#dark-mode-btn');
    await expect.poll(async () => (await themeState(page)).html).toBe(true);
    // ...a newer remote payload turns it off. ADR-0016 keeps remote-wins LWW, but
    // the session must FOLLOW it immediately (bug2's "inconsistent within session").
    const applied = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const remote = JSON.parse(JSON.stringify(dbg.layout));
      remote.settings = { ...(remote.settings || {}), darkMode: false };
      remote._meta = {
        ...(remote._meta || {}),
        revision: (remote._meta?.revision || 0) + 1,
        updatedAt: Date.now() + 1000,
        writerId: 'remote-tab-D008',
      };
      return dbg.applyExternalLayout(remote);
    });
    expect(applied).toBe(true);
    await expect.poll(async () => (await themeState(page)).html, { timeout: 5000 }).toBe(false);
    const s = await themeState(page);
    expect(s.setting).toBe(false);
    expect(s.mirror.darkMode, 'the boot mirror must be rewritten on merge, or the reload regresses').toBe(false);
  });

  test('D008-6: remote merge to dark also replays + rewrites the mirror', async ({ page }) => {
    await resetBoxing(page);
    const applied = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const remote = JSON.parse(JSON.stringify(dbg.layout));
      remote.settings = { ...(remote.settings || {}), darkMode: true };
      remote._meta = {
        ...(remote._meta || {}),
        revision: (remote._meta?.revision || 0) + 1,
        updatedAt: Date.now() + 1000,
        writerId: 'remote-tab-D008-dark',
      };
      return dbg.applyExternalLayout(remote);
    });
    expect(applied).toBe(true);
    await expect.poll(async () => (await themeState(page)).html, { timeout: 5000 }).toBe(true);
    const s = await themeState(page);
    expect(s.mirror.darkMode).toBe(true);
    expect(s.glyph).toBe('\u263D'); // moon = dark active
  });

  test('D008-7: repeated onChanged-shaped applies are idempotent (no drift, no throw)', async ({ page }) => {
    await resetAndDismiss(page);
    await page.click('#dark-mode-btn');
    await expect.poll(async () => (await themeState(page)).html).toBe(true);
    // Firefox fires storage.onChanged with multi-key change sets and can repeat;
    // the replay inside the callback body must be safe to run many times.
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const payload = JSON.parse(JSON.stringify(dbg.layout));
      const results: boolean[] = [];
      for (let i = 0; i < 5; i++) results.push(!!dbg.applyExternalLayout(payload));
      return results;
    });
    // Later applies are rejected as not-newer; none may throw.
    expect(r.every((v) => typeof v === 'boolean')).toBe(true);
    await expect.poll(async () => (await themeState(page)).html).toBe(true);
    const s = await themeState(page);
    expect(s.html).toBe(true);
    expect(s.app).toBe(false);
    expect(s.body).toBe(false);
    expect(s.setting).toBe(true);
  });

  test('D008-8: no boot mirror + dark OS preference falls back to dark WITHOUT persisting it', async ({ page }) => {
    // Observe the FIRST FRAME, before loadSettings() hydrates the authoritative
    // default (darkMode=false) and corrects the class. Reading the class after
    // hydration would only ever see the corrected value and could not tell a
    // working fallback from a hard-coded light.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      // Record every write to the ntp--dark token together with the resulting
      // state, so the sequence (fallback-true, then hydrate-false) is provable.
      (window as any).__darkTrace = [];
      for (const op of ['add', 'remove', 'toggle'] as const) {
        const orig = DOMTokenList.prototype[op];
        DOMTokenList.prototype[op] = function (...tokens: string[]) {
          const res = (orig as any).apply(this, tokens);
          const root = document.documentElement;
          if (root && this === root.classList && tokens.indexOf('ntp--dark') !== -1) {
            (window as any).__darkTrace.push({
              op,
              on: root.classList.contains('ntp--dark'),
              booted: Boolean((window as any).__boxingDebug),
            });
          }
          return res;
        };
      }
    });
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    const trace = await page.evaluate(() => (window as any).__darkTrace || []);
    // The boot script turned dark ON from matchMedia (mirror absent).
    const preHydrationDark = trace.find((t: any) => t.on === true && t.booted === false);
    expect(preHydrationDark, 'boot-theme must fall back to prefers-color-scheme when the mirror is absent').toBeTruthy();
    // Hydration then applied the authoritative setting (false) — i.e. the
    // fallback was display-only and never became the persisted truth.
    const hydratedLight = trace.find((t: any) => t.on === false && t.booted === true);
    expect(hydratedLight, 'loadSettings must re-apply the authoritative setting after the boot fallback').toBeTruthy();
    const s = await themeState(page);
    expect(s.setting, 'matchMedia fallback is display-only and must never be persisted').toBe(false);
    expect(s.mirror ? s.mirror.darkMode : false).toBe(false);
    await page.emulateMedia({ colorScheme: 'light' });
  });
});
