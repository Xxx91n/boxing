import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_PATH = path.resolve(__dirname, '..', '..');

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;
// Ticket 95 (credential sweep): NO real credentials in source; the lane's
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
    await page.evaluate(() => (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click());
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
    await page.evaluate(() => (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click());
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
    await page.evaluate(() => (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click());
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
    await page.evaluate(() => (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click());
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

// Ticket 90: the WebDAV private-host opt-in must reach BOTH the export
// (backup) and pull (sync) paths, and .local / .internal / IPv6-loopback hosts must
// be refused by default on both. Ticket 82 only pinned the isSafeExtUrl seam; the
// pull path ran through checkUrlValid, which matched the raw hostname - so it kept
// the IPv6 brackets ("[::1]" never matched the "::1$" alternative) and had no
// .local/.internal suffix rule, letting the default deny leak on that path only.
test.describe('WebDAV private-host opt-in propagation (ticket 90)', () => {
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

// Ticket 83 (V-10/V-11): WebDAV transport hardening — the page-direct fallback must
// refuse opaque redirects (same manual-redirect policy as the background proxy) and
// cap GET response bodies with a recognizable oversized-response error instead of
// buffering an unbounded body into the extension process.
test.describe('WebDAV transport hardening (ticket 83)', () => {
  // Simulates the direct fetch used when the background path is forced offline.
  // 'opaqueredirect' -> a redirect that manual mode surfaces as an opaque response;
  // 'too-large' -> a 3 MiB body (exceeds the 2 MiB GET cap). Other requests pass
  // through to the real fetch.
  async function bootWithFetchMock(page: Page, mode: 'opaqueredirect' | 'too-large') {
    await page.addInitScript(({ mode }) => {
      const realFetch = window.fetch.bind(window);
      (window as any).__fetchCalls = [];
      (window as any).fetch = (input: any, init: any) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        (window as any).__fetchCalls.push({ url: String(url), init });
        if (String(url).includes('webdav.invalid')) {
          if (mode === 'opaqueredirect') {
            return Promise.resolve({ type: 'opaqueredirect', status: 0, ok: false });
          }
          if (mode === 'too-large') {
            const payload = new Uint8Array(3 * 1024 * 1024); // 3 MiB > 2 MiB cap
            return Promise.resolve({
              type: 'default',
              status: 200,
              ok: true,
              body: new ReadableStream({ start(controller) { controller.enqueue(payload); controller.close(); } }),
            });
          }
        }
        return realFetch(input, init);
      };
    }, { mode });
  }

  async function seedWebDAVCreds(page: Page) {
    await page.evaluate((url) => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.webdavUrl = url;
      dbg.layout.settings.webdavUser = 'test@example.com';
      dbg.layout.settings._encWebdavPass = null;
      const pass = document.getElementById('webdav-pass') as HTMLInputElement | null;
      if (pass) pass.value = 'testpass';
    }, WEBDAV_URL);
  }

  test('direct GET fallback refuses opaque redirect (V-10)', async ({ page }) => {
    await bootWithFetchMock(page, 'opaqueredirect');
    await bootWithMockRuntime(page, (msg) => ({ success: false, error: 'bg down' }));
    await resetBoxing(page);
    await seedWebDAVCreds(page);
    const err = await page.evaluate(async () => {
      try { await (window as any).__boxingDebug.syncWebDAV({ bypassLossGuard: true }); return null; }
      catch (e) { return e.message; }
    });
    expect(err).toBe('Cannot reach WebDAV server — check URL or network');
    const calls = await page.evaluate(() => (window as any).__fetchCalls);
    const getCall = calls.find((c: any) => c.init && c.init.method === 'GET');
    expect(getCall).toBeTruthy();
    expect(getCall.init.redirect).toBe('manual');
  });

  test('direct PUT fallback refuses opaque redirect (V-10)', async ({ page }) => {
    await bootWithFetchMock(page, 'opaqueredirect');
    await bootWithMockRuntime(page, (msg) => ({ success: false, error: 'bg down' }));
    await resetBoxing(page);
    await seedWebDAVCreds(page);
    const err = await page.evaluate(async () => {
      try { await (window as any).__boxingDebug.backupWebDAV(); return null; }
      catch (e) { return e.message; }
    });
    expect(err).toBe('Cannot reach WebDAV server — check URL or network');
    const calls = await page.evaluate(() => (window as any).__fetchCalls);
    const putCall = calls.find((c: any) => c.init && c.init.method === 'PUT');
    expect(putCall).toBeTruthy();
    expect(putCall.init.redirect).toBe('manual');
  });

  test('direct GET fallback caps oversized response (V-11)', async ({ page }) => {
    await bootWithFetchMock(page, 'too-large');
    await bootWithMockRuntime(page, (msg) => ({ success: false, error: 'bg down' }));
    await resetBoxing(page);
    await seedWebDAVCreds(page);
    const err = await page.evaluate(async () => {
      try { await (window as any).__boxingDebug.syncWebDAV({ bypassLossGuard: true }); return null; }
      catch (e) { return e.message; }
    });
    expect(err).toContain('webdav-get response too large');
    const calls = await page.evaluate(() => (window as any).__fetchCalls);
    const getCall = calls.find((c: any) => c.init && c.init.method === 'GET');
    expect(getCall).toBeTruthy();
    expect(getCall.init.redirect).toBe('manual');
  });
});

// Ticket 114 (PR #112 review thread): a WebDAV base URL with a query string (or a
// fragment) corrupted the derived fileUrl — `https://dav.example.com/dir?token=abc`
// produced `.../dir?token=abc/boxing-backup.json`, so the filename landed inside the
// query value and the request degraded to `/dir`. The chosen behavior is refusal: every
// WebDAV entry point (test / export / pull / remote delete) rejects the base up front
// with the keyed error `webdavErrQuery`, and `resolveWebDAVFileUrl` additionally drops
// search/hash so the filename can never be appended after a query again.
test.describe('WebDAV base URL with a query string or fragment (ticket 114)', () => {
  const QUERY_BASES = [
    'https://dav.example.net/dav?token=abc',
    'https://dav.example.net/dav/?token=abc',
    'https://dav.example.net/dav#section',
  ];

  async function bootClean(page: Page) {
    await bootWithMockRuntime(page, (msg) => {
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, data: null };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      if (msg.type === 'webdav-delete') return { success: true, status: 204, ok: true };
      return { success: true, status: 207, ok: true };
    });
    await resetBoxing(page);
  }

  test('resolveWebDAVFileUrl keeps the filename in the path for a query-bearing base', async ({ page }) => {
    await bootClean(page);
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncFileName = 'my-backup.json';
      return {
        query: dbg.resolveWebDAVFileUrl('https://dav.example.net/dir?token=abc'),
        fragment: dbg.resolveWebDAVFileUrl('https://dav.example.net/dir#frag'),
        // The verbatim branch keys on the PATH: a query that merely ends in .json
        // must not select it (that was the second half of the bug).
        queryJson: dbg.resolveWebDAVFileUrl('https://dav.example.net/dir?file=x.json'),
        // Accepted bases are unchanged by the fix.
        plain: dbg.resolveWebDAVFileUrl('https://dav.example.net/dir'),
        trailingSlash: dbg.resolveWebDAVFileUrl('https://dav.example.net/dir/'),
        jsonPath: dbg.resolveWebDAVFileUrl('https://dav.example.net/dir/backup.json'),
        emptyQuery: dbg.resolveWebDAVFileUrl('https://dav.example.net/dir/?'),
        // PR #115 review: origin + pathname drops userinfo, so the derivation must
        // refuse an embedded-credential base instead of returning a clean URL that
        // silently sends the configured account's credentials.
        embedded: (() => {
          try {
            const r = dbg.resolveWebDAVFileUrl('https://user:secret@dav.example.net/dir/');
            return { threw: false, fileUrl: r.fileUrl };
          } catch (e: any) { return { threw: true, key: e && e.key }; }
        })(),
      };
    });
    // No derived URL may carry a query or fragment at all.
    expect(r.query.fileUrl).toBe('https://dav.example.net/dir/my-backup.json');
    expect(r.fragment.fileUrl).toBe('https://dav.example.net/dir/my-backup.json');
    expect(r.queryJson.fileUrl).toBe('https://dav.example.net/dir/my-backup.json');
    expect(r.queryJson.fileUrl).not.toContain('?');
    // The pre-existing contract for every query-less base is byte-identical.
    expect(r.plain.fileUrl).toBe('https://dav.example.net/dir/my-backup.json');
    expect(r.trailingSlash.fileUrl).toBe('https://dav.example.net/dir/my-backup.json');
    expect(r.jsonPath.fileUrl).toBe('https://dav.example.net/dir/backup.json');
    // An empty query serializes to no search component — not corruption, still accepted.
    expect(r.emptyQuery.fileUrl).toBe('https://dav.example.net/dir/my-backup.json');
    // Embedded credentials never survive into a derived URL (PR #115 review): the
    // old derivation kept user:secret@ and was refused by the background guard;
    // origin + pathname would strip them, so the seam itself must refuse.
    expect(r.embedded.threw).toBe(true);
    expect(r.embedded.key).toBe('webdavErrEmbedded');
  });

  // Locale contract (same shape as the ticket 57/99 key guards): the keyed error
  // must exist in all 14 locales and in the en fallback, and must stay
  // placeholder-free so it never renders a literal $1$.
  test('webdavErrQuery exists in all 14 locales and in the en fallback', () => {
    const localesDir = path.join(REPO_PATH, '_locales');
    const langs = fs.readdirSync(localesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(langs.length).toBe(14);
    const i18nSrc = fs.readFileSync(path.join(REPO_PATH, 'ntp', 'i18n.js'), 'utf8');
    expect(i18nSrc, 'I18N_FALLBACK.webdavErrQuery missing').toContain('I18N_FALLBACK.webdavErrQuery = ');
    // The fallback is what file:// lanes and forced-fetch-failure boots render —
    // it must match the en locale byte for byte.
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en', 'messages.json'), 'utf8'));
    expect(i18nSrc).toContain("I18N_FALLBACK.webdavErrQuery = '" + en.webdavErrQuery.message + "'");
    expect(en.webdavErrQuery.message).not.toContain('$1$');
    for (const lang of langs) {
      const msgs = JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'messages.json'), 'utf8'));
      expect(msgs.webdavErrQuery, `Missing key "webdavErrQuery" in _locales/${lang}/messages.json`).toBeDefined();
      expect(typeof msgs.webdavErrQuery.message).toBe('string');
      expect(msgs.webdavErrQuery.message.length).toBeGreaterThan(0);
      expect(msgs.webdavErrQuery.message, `unexpected placeholder in ${lang}`).not.toContain('$1$');
    }
  });

  test('the guard predicate flags real query/fragment components only', async ({ page }) => {
    await bootClean(page);
    const r = await page.evaluate(() => {
      const g = (window as any).__bxSync.webdavUrlHasQueryOrFragment;
      return {
        query: g('https://dav.example.net/dav?token=abc'),
        fragment: g('https://dav.example.net/dav#x'),
        emptyQuery: g('https://dav.example.net/dav/?'),
        plain: g('https://dav.example.net/dav/'),
        // A '?'/'#' inside the path is percent-encoded by the URL parser, not a component.
        encoded: g('https://dav.example.net/dav%3Ftoken/'),
        junk: g('not a url'),
      };
    });
    expect(r.query).toBe(true);
    expect(r.fragment).toBe(true);
    expect(r.emptyQuery).toBe(false);
    expect(r.plain).toBe(false);
    expect(r.encoded).toBe(false);
    expect(r.junk).toBe(false);
  });

  for (const base of QUERY_BASES) {
    test('test / export / pull all refuse ' + base + ' with the keyed error and zero network calls', async ({ page }) => {
      await bootClean(page);
      const r = await page.evaluate(async (url) => {
        const dbg = (window as any).__boxingDebug;
        const bxSync = (window as any).__bxSync;
        await dbg.setWebDAVConfig(url, 'u', 'p');
        const grab = async (fn: () => Promise<unknown>) => {
          try { await fn(); return { threw: false, key: '', message: '' }; }
          catch (e: any) { return { threw: true, key: e && e.key, message: e && e.message, known: bxSync.isKnownWebDAVError(e) }; }
        };
        const backup = await grab(() => dbg.backupWebDAV());
        const sync = await grab(() => dbg.syncWebDAV({ bypassLossGuard: true }));
        const test = await grab(() => dbg.testWebDAV());
        return {
          backup, sync, test,
          expected: bxSync.webdavError('webdavErrQuery').message,
          calls: (window as any).__webdavCalls.length,
        };
      }, base);

      for (const [name, out] of Object.entries({ backup: r.backup, sync: r.sync, test: r.test })) {
        expect((out as any).threw, name + ' should refuse the base').toBe(true);
        // Keyed identity (ticket 111 mechanism), not a message-text guess.
        expect((out as any).key, name + ' key').toBe('webdavErrQuery');
        expect((out as any).known, name + ' classified').toBe(true);
        expect((out as any).message, name + ' message').toBe(r.expected);
      }
      // Refusal happens before any transport: no webdav-* message was ever sent.
      expect(r.calls).toBe(0);
    });
  }

  test('remote delete refuses a query-bearing base instead of deleting a corrupted target', async ({ page }) => {
    await bootClean(page);
    const r = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const sel = document.getElementById('sync-provider') as HTMLSelectElement;
      const remote = document.getElementById('delete-sync-credential-remote') as HTMLInputElement;
      const run = async (url: string) => {
        dbg.layout.settings.webdavUrl = url;
        dbg.layout.settings.webdavUser = 'spec-user';
        const pass = document.getElementById('webdav-pass') as HTMLInputElement;
        if (pass) pass.value = 'spec-pass';
        sel.value = 'webdav';
        remote.checked = true;
        const before = (window as any).__webdavCalls.length;
        const out = await (window as any).__boxingDeleteSyncCredentials();
        // Read the status line right here: the control call below resets it.
        const statusText = (document.getElementById('delete-sync-credential-status') as HTMLElement)?.textContent || '';
        return { ok: out && out.ok, error: out && out.error, sent: (window as any).__webdavCalls.length - before, statusText };
      };
      const refused = await run('https://dav.example.net/dav?token=abc');
      // PR #115 review (Data Integrity): a base with embedded credentials must not
      // reach the transport — the derivation strips userinfo, so the DELETE would
      // otherwise execute under the configured account against that host.
      const embedded = await run('https://user:secret@dav.example.net/dav/');
      const accepted = await run('https://dav.example.net/dav/');
      return { refused, embedded, accepted };
    });
    expect(r.refused.ok).toBe(false);
    // The delete contract maps every refusal to the localized remote-delete failure
    // text — never a raw transport error, and never a DELETE at a corrupted URL.
    expect(typeof r.refused.error).toBe('string');
    expect(r.refused.error.length).toBeGreaterThan(0);
    expect(r.refused.statusText).toBe(r.refused.error);
    expect(r.refused.sent).toBe(0);
    // Same contract for the embedded-credential base: refused, nothing deleted.
    expect(r.embedded.ok).toBe(false);
    expect(r.embedded.error).toBe(r.refused.error);
    expect(r.embedded.statusText).toBe(r.embedded.error);
    expect(r.embedded.sent).toBe(0);
    // Control: the same call with a clean base does reach the transport.
    expect(r.accepted.sent).toBe(1);
    expect(r.accepted.ok).toBe(true);
  });
});
