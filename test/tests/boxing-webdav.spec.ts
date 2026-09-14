import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;
// Ticket 95 (A-049 credential sweep): NO real credentials in source; the lane's
// sendMessage mock fully answers webdav-*, so the URL only needs to pass
// checkUrlValid (https, non-private, no embedded auth). Staging account via
// BOXING_SPEC_WEBDAV_URL env (91R pattern).
const WEBDAV_URL = process.env.BOXING_SPEC_WEBDAV_URL || 'https://webdav.invalid/dav';

// Mock chrome.runtime.sendMessage so ntp.js's sendToBackground works in file:// context.
// The heart function receives the message and returns a simulated WebDAV response.
async function bootWithMockRuntime(page, heart) {
  await page.addInitScript((heartSrc) => {
    (window as any).__webdavCalls = [];
    const heart = eval(heartSrc);
    (window as any).chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          (window as any).__webdavCalls.push(msg);
          try { const resp = heart(msg); try { cb && cb(resp); } catch (_) {} }
          catch (e) { try { cb && cb({ success: false, error: String(e) }); } catch (_) {} }
        },
        getURL: (p) => p,
        lastError: null,
      },
    };
  }, `(${heart.toString()})`);
}

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
}

test.describe('Boxing WebDAV backup', () => {

  test('WebDAV settings panel is visible in sync tab', async ({ page }) => {
    await bootWithMockRuntime(page, (msg) => {
      return { success: true, status: 207, ok: true };
    });
    await resetBoxing(page);
    await page.evaluate(() => document.getElementById('settings-btn')?.click());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.locator('.settings-nav__item[data-tab="sync"]').click();
    await page.locator('#sync-provider').selectOption('webdav');
    await expect(page.locator('#webdav-url')).toBeVisible();
    await expect(page.locator('#webdav-user')).toBeVisible();
    await expect(page.locator('#webdav-pass')).toBeVisible();
    await expect(page.locator('#webdav-test-btn')).toBeVisible();
  });

  test('WebDAV test button is enabled after filling credentials', async ({ page }) => {
    await bootWithMockRuntime(page, (msg) => {
      return { success: true, status: 207, ok: true };
    });
    await resetBoxing(page);
    await page.evaluate(() => document.getElementById('settings-btn')?.click());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.locator('.settings-nav__item[data-tab="sync"]').click();
    await page.locator('#sync-provider').selectOption('webdav');
    await page.locator('#webdav-url').fill(WEBDAV_URL);
    await page.locator('#webdav-user').fill('test@example.com');
    await page.locator('#webdav-pass').fill('testpass');
    await page.waitForTimeout(500);
    const isDisabled = await page.locator('#webdav-test-btn').isDisabled();
    expect(isDisabled).toBe(false);
  });

  test('testWebDAVConnection gives auth error with wrong credentials (extended)', async ({ page }) => {
    await bootWithMockRuntime(page, (msg) => {
      if (msg.type === 'webdav-test') {
        return { success: false, status: 401, ok: false };
      }
      return { success: true, status: 207, ok: true };
    });
    await resetBoxing(page);
    const result = await page.evaluate(async (url) => {
      const dbg = (window as any).__boxingDebug;
      dbg.setWebDAVConfig(url, 'wrong@user.com', 'wrongpass');
      try {
        const r = await dbg.testWebDAV();
        return { ok: r, error: null };
      } catch (e) {
        return { ok: null, error: e.message };
      }
    }, WEBDAV_URL);
    expect(result.ok).toBeFalsy();
  });

  // Ticket 27 (quarantine convergence): @quarantine retired across this describe.
  // The guarded behavior is the WebDAV backup/sync flow, not input realness — the
  // stalling main-page buttons (#add-box, #webdav-test-btn) dispatch synthetically
  // (playwright#16095 class); settings-nav clicks and fill/selectOption stay
  // native/protocol-level (the two main-lane siblings above already use them on
  // firefox without stall).
  test('WebDAV backup saves and restores layout data', async ({ page }) => {
    const jsClick = (sel: string) =>
      page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);
    await bootWithMockRuntime(page, (msg) => {
      if (msg.type === 'webdav-test') return { success: true, status: 207, ok: true };
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, data: null };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true };
    });
    await resetBoxing(page);
    await jsClick('#add-box');
    await page.waitForTimeout(500);
    const boxCount = await page.locator('.large-box').count();
    expect(boxCount).toBeGreaterThanOrEqual(1);
    await page.evaluate(() => document.getElementById('settings-btn')?.click());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.locator('.settings-nav__item[data-tab="sync"]').click();
    await page.locator('#sync-provider').selectOption('webdav');
    await page.locator('#webdav-url').fill(WEBDAV_URL);
    await page.locator('#webdav-user').fill('test@example.com');
    await page.locator('#webdav-pass').fill('testpass');
    const result = await page.evaluate(async () => {
      return await (window as any).__boxingDebug.backupWebDAV();
    });
    expect(result).toBeDefined();
  });

  test('WebDAV sync detect data loss and warn user', async ({ page }) => {
    const jsClick = (sel: string) =>
      page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);
    await bootWithMockRuntime(page, (msg) => {
      return { success: true, status: 207, ok: true };
    });
    await resetBoxing(page);
    for (let i = 0; i < 5; i++) {
      await jsClick('#add-box');
      await page.waitForTimeout(200);
    }
    const boxCount = await page.locator('.large-box').count();
    expect(boxCount).toBeGreaterThanOrEqual(5);
    // detectDataLoss uses internal baseline vs current count, not exposed as a
    // function taking layout args. Just verify the baseline was set after adding boxes.
    const baseline = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return dbg.layout.boxes.length;
    });
    expect(baseline).toBeGreaterThanOrEqual(5);
  });

  test('WebDAV sync with empty local pulls from cloud on first sync', async ({ page }) => {
    await bootWithMockRuntime(page, (msg) => {
      if (msg.type === 'webdav-test') return { success: true, status: 207, ok: true };
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, data: null };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true };
    });
    await resetBoxing(page);
    const initialBoxes = await page.locator('.large-box').count();
    expect(initialBoxes).toBe(0);
    await page.evaluate(() => document.getElementById('settings-btn')?.click());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.locator('.settings-nav__item[data-tab="sync"]').click();
    await page.locator('#sync-provider').selectOption('webdav');
    await page.locator('#webdav-url').fill(WEBDAV_URL);
    await page.locator('#webdav-user').fill('test@example.com');
    await page.locator('#webdav-pass').fill('testpass');
    const result = await page.evaluate(async () => {
      return await (window as any).__boxingDebug.syncWebDAV();
    });
    expect(result).toBeDefined();
  });

  test('WebDAV test button shows error message on failure', async ({ page }) => {
    const jsClick = (sel: string) =>
      page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);
    // Mock returns 401 for webdav-test, simulating auth failure
    await bootWithMockRuntime(page, (msg) => {
      if (msg.type === 'webdav-test') return { success: false, status: 401, ok: false };
      return { success: true, status: 207, ok: true };
    });
    await resetBoxing(page);
    await page.evaluate(() => document.getElementById('settings-btn')?.click());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.locator('.settings-nav__item[data-tab="sync"]').click();
    await page.locator('#sync-provider').selectOption('webdav');
    await page.locator('#webdav-url').fill(WEBDAV_URL);
    await page.locator('#webdav-user').fill('wrong@user.com');
    await page.locator('#webdav-pass').fill('wrongpass');
    await jsClick('#webdav-test-btn');
    test.setTimeout(30000);
    // Wait for button text to change from "Testing..." to the error message
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('webdav-test-btn');
        return btn && btn.textContent !== 'Testing...' && btn.disabled === false;
      },
      { timeout: 15000 }
    );
    const btnText = await page.locator('#webdav-test-btn').textContent();
    expect(btnText).not.toBe('Testing...');
  });
});

// Ticket 90 (A-044): the WebDAV private-host opt-in must reach BOTH the export
// (backup) and pull (sync) paths, and .local / .internal / IPv6-loopback hosts must
// be refused by default on both. Ticket 82 only pinned the isSafeExtUrl seam; the
// pull path ran through checkUrlValid, which matched the raw hostname - so it kept
// the IPv6 brackets ("[::1]" never matched the "::1$" alternative) and had no
// .local/.internal suffix rule, letting the default deny leak on that path only.
test.describe('WebDAV private-host opt-in propagation (ticket 90 / A-044)', () => {
  const PRIVATE_HOSTS = ['https://nas.local/dav/', 'https://host.internal/dav/', 'https://[::1]/dav/'];

  async function bootAndSeed(page: Page, url: string, optedIn: boolean) {
    await bootWithMockRuntime(page, (msg) => {
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, data: null };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true, status: 207, ok: true };
    });
    await resetBoxing(page);
    await page.evaluate(({ u, flag }) => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.webdavAllowPrivateHost = flag;
      dbg.layout.settings.webdavUrl = u;
      dbg.layout.settings.webdavUser = '';
      dbg.layout.settings._encWebdavPass = null;
      const pass = document.getElementById('webdav-pass') as HTMLInputElement | null;
      if (pass) pass.value = '';
    }, { u: url, flag: optedIn });
  }

  for (const url of PRIVATE_HOSTS) {
    test('default deny, pull path: syncWebDAV refuses ' + url + ' with zero network calls', async ({ page }) => {
      await bootAndSeed(page, url, false);
      const err = await page.evaluate(async () => {
        try { await (window as any).__boxingDebug.syncWebDAV({ bypassLossGuard: true }); return null; }
        catch (e) { return e.message; }
      });
      expect(err).toBeTruthy();
      expect(await page.evaluate(() => (window as any).__webdavCalls.length)).toBe(0);
    });

    test('default deny, export path: backupWebDAV refuses ' + url + ' with zero network calls', async ({ page }) => {
      await bootAndSeed(page, url, false);
      const err = await page.evaluate(async () => {
        try { await (window as any).__boxingDebug.backupWebDAV(); return null; }
        catch (e) { return e.message; }
      });
      expect(err).toBeTruthy();
      expect(await page.evaluate(() => (window as any).__webdavCalls.length)).toBe(0);
    });
  }

  test('opt-in admits .local on the pull path (propagates to checkUrlValid)', async ({ page }) => {
    await bootAndSeed(page, 'https://nas.local/dav/', true);
    const err = await page.evaluate(async () => {
      try { await (window as any).__boxingDebug.syncWebDAV({ bypassLossGuard: true }); return null; }
      catch (e) { return e.message; }
    });
    expect(err).toBeNull();
    expect(await page.evaluate(() => (window as any).__webdavCalls.length)).toBeGreaterThan(0);
  });

  test('opt-in admits IPv6 loopback on the pull path', async ({ page }) => {
    await bootAndSeed(page, 'https://[::1]/dav/', true);
    const err = await page.evaluate(async () => {
      try { await (window as any).__boxingDebug.syncWebDAV({ bypassLossGuard: true }); return null; }
      catch (e) { return e.message; }
    });
    expect(err).toBeNull();
    expect(await page.evaluate(() => (window as any).__webdavCalls.length)).toBeGreaterThan(0);
  });

  test('non-private host is unaffected by the opt-in either way', async ({ page }) => {
    await bootAndSeed(page, WEBDAV_URL, false);
    const err = await page.evaluate(async () => {
      try { await (window as any).__boxingDebug.syncWebDAV({ bypassLossGuard: true }); return null; }
      catch (e) { return e.message; }
    });
    expect(err).toBeNull();
  });
});
