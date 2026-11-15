// Boxing — issue #123 (#120 D5/T3): WebDAV manual permission prompt + background
// missing-permission coordination closure.
//
// Coverage split across explicit lanes (per #68/#69 & #53 T3):
//   1. Static contracts: 6 new i18n keys across all 14 locales + en fallback,
//      built dist/boxing-chrome (optional_host_permissions) & dist/boxing-firefox
//      (host_permissions), no notifications permission, no permissions.request in BG.
//   2. file:// mock runtime lane (runs on both chromium-extension and firefox-extension):
//      - Structured { needPermission: true, origin } never falls back to direct fetch();
//        legacy { success: false, error: 'bg down' } keeps its direct-fetch fallback.
//      - Non-gesture background paths (performBackup({ userInitiated: false }),
//        boxing-auto-backup-trigger) never call permissions.request(), never hit network,
//        never update lastBackupAt/snapshots, and persist webdavPendingPermission.
//      - User-gesture buttons (#webdav-test-btn / #backup-now-btn) request once:
//        grant clears pending state and succeeds; deny persists reason:'denied' with
//        no auto-retry and no direct fetch fallback.
//      - Settings -> Sync #webdav-permission-banner renders pending/denied/granted states,
//        updates across language switches, and stays outside .sync-group (count === 3).
//      - Firefox browser.permissions Promise path (revocation & fail-closed on throw) +
//        atomic failure on deleteSyncCredentials remote delete when permission is denied.
//   3. Real built Chrome extension lane (chromium-extension only, dist/boxing-chrome):
//      - Real SW dispatch returns { needPermission: true, origin } for ungranted origin
//        and { blocked: true } for private host.
//      - Real autoBackupDue catch-up on boot writes real chrome.storage.local
//        webdavPendingPermission without prompt/network/lastBackupAt and surfaces
//        #webdav-permission-banner in Settings -> Sync.
//
// Known gap declared honestly (#68/#69): Playwright's firefox-extension lane does not
// install the built .xpi; dist/boxing-firefox manifest/static contracts are asserted
// below and runtime add-on behavior follows docs/firefox-release-checklist.md.

import { expect, test, chromium, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(REPO_PATH, 'ntp', 'index.html')).href;
const DIST_CHROME = path.join(REPO_PATH, 'dist', 'boxing-chrome');
const DIST_FIREFOX = path.join(REPO_PATH, 'dist', 'boxing-firefox');
const WEBDAV_URL = 'https://webdav.invalid/dav/';
const WEBDAV_ORIGIN_PATTERN = 'https://webdav.invalid/*';
const WEBDAV_DISPLAY_ORIGIN = 'https://webdav.invalid';

const NEW_I18N_KEYS = [
  'webdavErrPermission',
  'webdavErrPermissionDenied',
  'webdavPermPendingHint',
  'webdavPermDeniedHint',
  'webdavAuthorizeBtn',
  'webdavPermGrantedStatus',
] as const;

const ORIGIN_PARAM_KEYS = [
  'webdavErrPermission',
  'webdavErrPermissionDenied',
  'webdavPermPendingHint',
  'webdavPermDeniedHint',
  'webdavPermGrantedStatus',
] as const;

interface MockOpts {
  apiStyle?: 'chrome' | 'browser';
  containsGranted?: boolean;
  containsThrows?: boolean;
  requestResult?: boolean;
  requestThrows?: boolean;
  swHandler?: (msg: any) => any;
}

async function bootWithPermMock(page: Page, opts: MockOpts = {}) {
  const swSrc = opts.swHandler
    ? `(${opts.swHandler.toString()})`
    : `((msg) => {
        if (msg.type === 'webdav-test') return { success: true, status: 207, ok: true };
        if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, data: null, body: null };
        if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
        if (msg.type === 'webdav-delete') return { success: true, status: 204, ok: true };
        return { success: true };
      })`;
  await page.addInitScript(({ apiStyle, containsGranted, containsThrows, requestResult, requestThrows, swSrc }) => {
    const swFn = eval(swSrc);
    const state = {
      apiStyle,
      containsGranted: Boolean(containsGranted),
      containsThrows: Boolean(containsThrows),
      requestResult: Boolean(requestResult),
      requestThrows: Boolean(requestThrows),
    };
    const msgListeners: any[] = [];
    (window as any).__permTestState = state;
    (window as any).__permCalls = [];
    (window as any).__bgCalls = [];
    (window as any).__fetchCalls = [];

    const realFetch = window.fetch.bind(window);
    (window as any).fetch = (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      (window as any).__fetchCalls.push({ url: String(url), method: init?.method || 'GET' });
      if (String(url).startsWith('https://')) {
        return Promise.reject(new Error('unexpected direct https fetch in test: ' + url));
      }
      return realFetch(input, init);
    };

    const permApiChrome = {
      contains(details: any, cb?: (res: boolean) => void) {
        (window as any).__permCalls.push({ op: 'contains', details });
        if (state.containsThrows) {
          if (cb) {
            (window as any).chrome.runtime.lastError = { message: 'contains failed' };
            cb(false);
            (window as any).chrome.runtime.lastError = null;
            return;
          }
          return Promise.reject(new Error('contains failed'));
        }
        const v = state.containsGranted;
        if (cb) { cb(v); return; }
        return Promise.resolve(v);
      },
      request(details: any, cb?: (res: boolean) => void) {
        (window as any).__permCalls.push({ op: 'request', details });
        if (state.requestThrows) {
          if (cb) {
            (window as any).chrome.runtime.lastError = { message: 'request rejected' };
            cb(false);
            (window as any).chrome.runtime.lastError = null;
            return;
          }
          return Promise.reject(new Error('request rejected'));
        }
        const v = state.requestResult;
        if (v) state.containsGranted = true;
        if (cb) { cb(v); return; }
        return Promise.resolve(v);
      },
    };

    const permApiBrowser = {
      contains(details: any) {
        (window as any).__permCalls.push({ op: 'contains', details });
        if (state.containsThrows) return Promise.reject(new Error('browser contains failed'));
        return Promise.resolve(state.containsGranted);
      },
      request(details: any) {
        (window as any).__permCalls.push({ op: 'request', details });
        if (state.requestThrows) return Promise.reject(new Error('browser request rejected'));
        const v = state.requestResult;
        if (v) state.containsGranted = true;
        return Promise.resolve(v);
      },
    };

    const runtimeCommon = {
      getURL: (p: string) => p,
      lastError: null as any,
      onMessage: {
        addListener(fn: any) { msgListeners.push(fn); },
      },
    };

    (window as any).__dispatchRuntimeMessage = (msg: any) => new Promise((resolve) => {
      let responded = false;
      const sendResponse = (r: any) => { responded = true; resolve(r); };
      for (const fn of msgListeners) {
        try {
          const ret = fn(msg, { id: 'test-ext' }, sendResponse);
          if (ret && typeof ret.then === 'function') {
            ret.then((r: any) => { if (!responded) resolve(r); });
          } else if (ret !== true && !responded) {
            resolve(undefined);
          }
        } catch (e) {
          resolve({ ok: false, error: String(e) });
        }
      }
    });

    if (apiStyle === 'browser') {
      (window as any).browser = {
        runtime: {
          ...runtimeCommon,
          sendMessage(msg: any) {
            (window as any).__bgCalls.push(msg);
            try { return Promise.resolve(swFn(msg, state)); }
            catch (e) { return Promise.reject(e); }
          },
        },
        permissions: permApiBrowser,
      };
      // Keep chrome.runtime.onMessage available for alarm trigger registration
      (window as any).chrome = {
        runtime: {
          ...runtimeCommon,
          sendMessage(msg: any, cb?: (r: any) => void) {
            (window as any).__bgCalls.push(msg);
            const r = swFn(msg, state);
            if (cb) cb(r);
            return Promise.resolve(r);
          },
        },
      };
    } else {
      (window as any).chrome = {
        runtime: {
          ...runtimeCommon,
          sendMessage(msg: any, cb?: (r: any) => void) {
            (window as any).__bgCalls.push(msg);
            try {
              const r = swFn(msg, state);
              if (cb) { cb(r); return; }
              return Promise.resolve(r);
            } catch (e) {
              const errResp = { success: false, error: String(e) };
              if (cb) { cb(errResp); return; }
              return Promise.resolve(errResp);
            }
          },
        },
        permissions: permApiChrome,
      };
    }
  }, {
    apiStyle: opts.apiStyle || 'chrome',
    containsGranted: Boolean(opts.containsGranted),
    containsThrows: Boolean(opts.containsThrows),
    requestResult: Boolean(opts.requestResult),
    requestThrows: Boolean(opts.requestThrows),
    swSrc,
  });
}

async function resetBoxing(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
}

async function openSyncTab(page: Page) {
  await page.evaluate(() => document.getElementById('settings-btn')?.click());
  await expect(page.locator('#settings-modal')).toBeVisible();
  await page.evaluate(() => (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click());
  await expect(page.locator('#tab-sync')).toBeVisible();
}

async function seedWebDAV(page: Page, url = WEBDAV_URL) {
  await page.evaluate(async (u) => {
    const dbg = (window as any).__boxingDebug;
    dbg.layout.settings.syncProvider = 'webdav';
    dbg.layout.settings.webdavUrl = u;
    dbg.layout.settings.webdavUser = 'user';
    dbg.layout.settings.lastBackupAt = 0;
    const prov = document.getElementById('sync-provider') as HTMLSelectElement | null;
    if (prov) { prov.value = 'webdav'; prov.dispatchEvent(new Event('change')); }
    const urlEl = document.getElementById('webdav-url') as HTMLInputElement | null;
    const userEl = document.getElementById('webdav-user') as HTMLInputElement | null;
    const passEl = document.getElementById('webdav-pass') as HTMLInputElement | null;
    if (urlEl) urlEl.value = u;
    if (userEl) userEl.value = 'user';
    if (passEl) passEl.value = 'secret';
    await dbg.saveLayout({ preserveUpdatedAt: true });
  }, url);
}

test.describe('Static & Manifest & i18n contracts (ticket #123)', () => {
  test('all 6 permission keys exist across all 14 locales and I18N_FALLBACK with aligned placeholders', () => {
    const localesDir = path.join(REPO_PATH, '_locales');
    const langs = fs.readdirSync(localesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(langs.length).toBe(14);
    const i18nSrc = fs.readFileSync(path.join(REPO_PATH, 'ntp', 'i18n.js'), 'utf8');
    for (const key of NEW_I18N_KEYS) {
      expect(i18nSrc, `I18N_FALLBACK.${key} missing`).toContain(`I18N_FALLBACK.${key} = `);
    }
    for (const key of ORIGIN_PARAM_KEYS) {
      const m = i18nSrc.match(new RegExp(`I18N_FALLBACK\\.${key}\\s*=\\s*'([^']+)'`));
      expect(m?.[1], `I18N_FALLBACK.${key} missing $1$`).toContain('$1$');
    }
    for (const lang of langs) {
      const msgs = JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'messages.json'), 'utf8'));
      for (const key of NEW_I18N_KEYS) {
        expect(msgs[key], `missing ${key} in ${lang}`).toBeDefined();
        expect(typeof msgs[key].message).toBe('string');
        expect(msgs[key].message.length).toBeGreaterThan(0);
      }
      for (const key of ORIGIN_PARAM_KEYS) {
        expect(msgs[key].message, `${lang}.${key} should reference $origin$`).toContain('$origin$');
        expect(msgs[key].placeholders?.origin?.content, `${lang}.${key} placeholder origin`).toBe('$1');
      }
    }
  });

  test('built manifests preserve optional_host_permissions boundary and no notifications permission', () => {
    if (fs.existsSync(path.join(DIST_CHROME, 'manifest.json'))) {
      const chromeManifest = JSON.parse(fs.readFileSync(path.join(DIST_CHROME, 'manifest.json'), 'utf8'));
      expect(chromeManifest.optional_host_permissions || []).toContain('https://*/*');
      expect(chromeManifest.host_permissions || []).not.toContain('https://*/*');
      expect(chromeManifest.permissions || []).not.toContain('notifications');
    }
    if (fs.existsSync(path.join(DIST_FIREFOX, 'manifest.json'))) {
      const ffManifest = JSON.parse(fs.readFileSync(path.join(DIST_FIREFOX, 'manifest.json'), 'utf8'));
      expect(ffManifest.host_permissions || []).toContain('https://*/*');
      expect(ffManifest.permissions || []).not.toContain('notifications');
    }
    const bgSrc = fs.readFileSync(path.join(REPO_PATH, 'background.js'), 'utf8');
    expect(bgSrc).not.toMatch(/permissions\.request/);
  });
});

test.describe('WebDAV permission loop & background closure (file:// lane, ticket #123)', () => {
  test.setTimeout(120_000);

  test('SW needPermission response never falls back to page-direct fetch across test/backup/sync', async ({ page }) => {
    // No permissions API on window.chrome so every call goes straight to SW and sees needPermission: true
    await page.addInitScript(() => {
      (window as any).__fetchCalls = [];
      (window as any).__bgCalls = [];
      const realFetch = window.fetch.bind(window);
      (window as any).fetch = (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        (window as any).__fetchCalls.push(String(url));
        if (String(url).startsWith('https://')) return Promise.reject(new Error('direct fetch forbidden'));
        return realFetch(input, init);
      };
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, cb?: (r: any) => void) => {
            (window as any).__bgCalls.push(msg);
            const r = { success: false, needPermission: true, origin: 'https://webdav.invalid/*', error: 'host permission not granted' };
            if (cb) cb(r);
            return Promise.resolve(r);
          },
          getURL: (p: string) => p,
          lastError: null,
        },
      };
    });
    await resetBoxing(page);
    await seedWebDAV(page);

    const out = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const run = async (fn: () => Promise<unknown>) => {
        try { await fn(); return { threw: false, key: '' }; }
        catch (e: any) { return { threw: true, key: e && e.key }; }
      };
      return {
        test: await run(() => dbg.testWebDAV()),
        backup: await run(() => dbg.backupWebDAV()),
        sync: await run(() => dbg.syncWebDAV({ bypassLossGuard: true })),
        fetchCalls: (window as any).__fetchCalls.filter((u: string) => u.startsWith('https://')),
        bgCalls: (window as any).__bgCalls.length,
      };
    });

    expect(out.test).toEqual({ threw: true, key: 'webdavErrPermission' });
    expect(out.backup).toEqual({ threw: true, key: 'webdavErrPermission' });
    expect(out.sync).toEqual({ threw: true, key: 'webdavErrPermission' });
    expect(out.fetchCalls).toEqual([]);
    expect(out.bgCalls).toBe(3);
  });

  test('non-gesture background paths never prompt, never hit network, never bump lastBackupAt, and persist pending state', async ({ page }) => {
    await bootWithPermMock(page, { containsGranted: false, requestResult: true });
    await resetBoxing(page);
    await seedWebDAV(page);

    const beforeSnaps = await page.evaluate(async () => (await (window as any).__boxingDebug.listSnapshots()).length);

    const out = await page.evaluate(async () => {
      const bxSync = (window as any).__bxSync;
      let performErr: any = null;
      try {
        await bxSync.performBackup({ userInitiated: false, source: 'background' });
      } catch (e: any) {
        performErr = { key: e && e.key, message: e && e.message };
      }
      const triggerResp = await (window as any).__dispatchRuntimeMessage({ type: 'boxing-auto-backup-trigger' });
      const pending = await (window as any).__boxingDebug.storageGet('webdavPendingPermission');
      const lastBackupAt = (window as any).__boxingDebug.layout.settings.lastBackupAt;
      return {
        performErr,
        triggerResp,
        pending: pending.webdavPendingPermission,
        lastBackupAt,
        permCalls: (window as any).__permCalls,
        bgCalls: (window as any).__bgCalls,
        fetchCalls: (window as any).__fetchCalls.filter((c: any) => c.url.startsWith('https://')),
      };
    });

    const afterSnaps = await page.evaluate(async () => (await (window as any).__boxingDebug.listSnapshots()).length);

    expect(out.performErr?.key).toBe('webdavErrPermission');
    expect(out.triggerResp?.ok).toBe(false);
    expect(out.triggerResp?.key).toBe('webdavErrPermission');
    expect(out.permCalls.filter((c: any) => c.op === 'request')).toEqual([]);
    expect(out.permCalls.filter((c: any) => c.op === 'contains').length).toBeGreaterThanOrEqual(2);
    expect(out.bgCalls).toEqual([]);
    expect(out.fetchCalls).toEqual([]);
    expect(out.lastBackupAt).toBe(0);
    expect(afterSnaps).toBe(beforeSnaps);
    expect(out.pending).toMatchObject({
      needed: true,
      origin: WEBDAV_ORIGIN_PATTERN,
      reason: 'missing-permission',
    });
  });

  test('manual button click prompts once: deny stops with denied state & no retry; grant clears pending & succeeds', async ({ page }) => {
    await bootWithPermMock(page, { containsGranted: false, requestResult: false });
    await resetBoxing(page);
    await openSyncTab(page);
    await seedWebDAV(page);

    // Click Test Connection while permission will be denied
    await page.evaluate(() => (document.getElementById('webdav-test-btn') as HTMLElement)?.click());
    await expect.poll(() => page.evaluate(() => document.getElementById('webdav-test-btn')?.textContent || '')).toContain('Permission denied');

    const afterDeny = await page.evaluate(async () => {
      const pending = (await (window as any).__boxingDebug.storageGet('webdavPendingPermission')).webdavPendingPermission;
      return {
        reqCount: (window as any).__permCalls.filter((c: any) => c.op === 'request').length,
        bgCount: (window as any).__bgCalls.length,
        fetchCount: (window as any).__fetchCalls.filter((c: any) => c.url.startsWith('https://')).length,
        pending,
        bannerHidden: document.getElementById('webdav-permission-banner')?.hidden,
        bannerState: document.getElementById('webdav-permission-banner')?.dataset.state,
      };
    });

    expect(afterDeny.reqCount).toBe(1);
    expect(afterDeny.bgCount).toBe(0);
    expect(afterDeny.fetchCount).toBe(0);
    expect(afterDeny.pending).toMatchObject({ needed: true, origin: WEBDAV_ORIGIN_PATTERN, reason: 'denied' });
    expect(afterDeny.bannerHidden).toBe(false);
    expect(afterDeny.bannerState).toBe('denied');

    // Now simulate user granting permission on retry via Sync Now
    await page.evaluate(() => { (window as any).__permTestState.requestResult = true; });
    await page.evaluate(() => (document.getElementById('backup-now-btn') as HTMLElement)?.click());
    await expect.poll(() => page.evaluate(() => (window as any).__bgCalls.length)).toBeGreaterThanOrEqual(1);
    await expect.poll(() => page.evaluate(async () =>
      (await (window as any).__boxingDebug.storageGet('webdavPendingPermission')).webdavPendingPermission ?? null
    )).toBeNull();

    const afterGrant = await page.evaluate(() => ({
      reqCount: (window as any).__permCalls.filter((c: any) => c.op === 'request').length,
      bannerHidden: document.getElementById('webdav-permission-banner')?.hidden,
      lastBackupAt: (window as any).__boxingDebug.layout.settings.lastBackupAt,
    }));
    expect(afterGrant.reqCount).toBe(2);
    expect(afterGrant.bannerHidden).toBe(true);
    expect(afterGrant.lastBackupAt).toBeGreaterThan(0);
  });

  test('Settings -> Sync permission banner shows background pending origin, switches language, handles deny -> grant lifecycle', async ({ page }) => {
    await bootWithPermMock(page, { containsGranted: false, requestResult: false });
    await resetBoxing(page);
    await seedWebDAV(page);
    await page.evaluate(async (origin) => {
      await (window as any).__boxingDebug.storageSet({
        webdavPendingPermission: { needed: true, origin, source: 'background', reason: 'missing-permission', updatedAt: Date.now() },
      });
    }, WEBDAV_ORIGIN_PATTERN);

    await openSyncTab(page);
    await expect(page.locator('#webdav-permission-banner')).toBeVisible();
    expect(await page.locator('#tab-sync .sync-group').count()).toBe(3);
    expect(await page.locator('#webdav-permission-banner').getAttribute('data-state')).toBe('pending');
    expect(await page.locator('#webdav-permission-msg').textContent()).toContain(WEBDAV_DISPLAY_ORIGIN);

    // Language switch updates localized banner text
    await page.evaluate(() => {
      const sel = document.getElementById('lang-select') as HTMLSelectElement;
      sel.value = 'zh_CN';
      sel.dispatchEvent(new Event('change'));
    });
    await expect.poll(() => page.locator('#webdav-permission-msg').textContent()).toContain(WEBDAV_DISPLAY_ORIGIN);
    const zhText = await page.locator('#webdav-permission-msg').textContent();
    expect(zhText).not.toContain('$origin$');
    expect(zhText).not.toContain('$1$');

    // Clicking authorize and denying updates banner to denied
    await page.evaluate(() => (document.getElementById('webdav-permission-btn') as HTMLElement)?.click());
    await expect.poll(() => page.locator('#webdav-permission-banner').getAttribute('data-state')).toBe('denied');

    // Granting clears pending storage and displays granted feedback before hiding
    await page.evaluate(() => { (window as any).__permTestState.requestResult = true; });
    await page.evaluate(() => (document.getElementById('webdav-permission-btn') as HTMLElement)?.click());
    await expect.poll(() => page.locator('#webdav-permission-banner').getAttribute('data-state')).toBe('granted');
    expect(await page.locator('#webdav-permission-btn').isVisible()).toBe(false);
    const cleared = await page.evaluate(async () =>
      (await (window as any).__boxingDebug.storageGet('webdavPendingPermission')).webdavPendingPermission ?? null
    );
    expect(cleared).toBeNull();
  });

  test('Firefox browser.permissions API: fail-closed on throw, runtime revocation, and atomic remote-delete failure', async ({ page }) => {
    await bootWithPermMock(page, { apiStyle: 'browser', containsThrows: true, requestResult: false });
    await resetBoxing(page);
    await openSyncTab(page);
    await seedWebDAV(page);

    // Encoded password so credential delete danger zone is active
    await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const enc = await (window as any).__boxingEncryptCredential('secret');
      dbg.layout.settings._encWebdavPass = enc;
      await dbg.saveLayout({ preserveUpdatedAt: true });
    });

    // contains() throws -> must fail closed, never reach SW or direct fetch
    const bgThrowRes = await page.evaluate(async () => {
      try {
        await (window as any).__bxSync.performBackup({ userInitiated: false, source: 'background' });
        return { threw: false };
      } catch (e: any) {
        return { threw: true, key: e && e.key };
      }
    });
    expect(bgThrowRes).toEqual({ threw: true, key: 'webdavErrPermission' });
    expect(await page.evaluate(() => (window as any).__bgCalls.length)).toBe(0);

    // Simulate runtime host permission revocation after previous grant
    await page.evaluate(() => {
      (window as any).__permTestState.containsThrows = false;
      (window as any).__permTestState.containsGranted = false;
    });

    // Remote delete fails atomically when user denies permission prompt
    const delOut = await page.evaluate(async () => {
      const remote = document.getElementById('delete-sync-credential-remote') as HTMLInputElement;
      remote.checked = true;
      return await (window as any).__boxingDeleteSyncCredentials();
    });
    expect(delOut.ok).toBe(false);
    const intact = await page.evaluate(() => {
      const s = (window as any).__boxingDebug.layout.settings;
      return {
        provider: s.syncProvider,
        url: s.webdavUrl,
        hasPass: Boolean(s._encWebdavPass),
      };
    });
    expect(intact).toEqual({ provider: 'webdav', url: WEBDAV_URL, hasPass: true });

    // Local-only delete clears webdavPendingPermission too
    const localDel = await page.evaluate(async () => {
      const remote = document.getElementById('delete-sync-credential-remote') as HTMLInputElement;
      remote.checked = false;
      const res = await (window as any).__boxingDeleteSyncCredentials();
      const pending = (await (window as any).__boxingDebug.storageGet('webdavPendingPermission')).webdavPendingPermission ?? null;
      return { res, pending };
    });
    expect(localDel.res.ok).toBe(true);
    expect(localDel.pending).toBeNull();
  });
});

test.describe('Real built Chrome extension build (chromium-extension only, ticket #123)', () => {
  test('AC-real: SW rejects ungranted HTTPS origin with needPermission, blocks private host, and boot catch-up writes webdavPendingPermission + surfaces banner', async ({}, testInfo) => {
    test.setTimeout(180_000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'the loaded build is a chromium lane');
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - run npm run build first');

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue123-ext-'));
    const ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [
        '--load-extension=' + DIST_CHROME,
        '--disable-extensions-except=' + DIST_CHROME,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    try {
      const page = await ctx.newPage();
      await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageSet)), { timeout: 30000 }).toBe(true);
      expect(page.url()).toContain('chrome-extension://');
      await dismissOnboarding(page);
      await page.evaluate(() => (window as any).__boxingDebug.saveLayout());

      // Confirm manifest optional permission is NOT granted for webdav.invalid
      const hasPerm = await page.evaluate(() =>
        new Promise<boolean>((resolve) => chrome.permissions.contains({ origins: ['https://webdav.invalid/*'] }, resolve))
      );
      expect(hasPerm).toBe(false);

      // Real SW IPC checks: ungranted public HTTPS origin -> needPermission: true; private host -> blocked: true
      const swChecks = await page.evaluate(async () => {
        const send = (m: any) => new Promise<any>((resolve) => chrome.runtime.sendMessage(m, resolve));
        return {
          testResp: await send({ type: 'webdav-test', url: 'https://webdav.invalid/dav/', user: 'u', pass: 'p' }),
          putResp: await send({ type: 'webdav-put', url: 'https://webdav.invalid/dav/b.json', user: 'u', pass: 'p', body: '{}' }),
          getResp: await send({ type: 'webdav-get', url: 'https://webdav.invalid/dav/b.json', user: 'u', pass: 'p' }),
          delResp: await send({ type: 'webdav-delete', url: 'https://webdav.invalid/dav/b.json', user: 'u', pass: 'p' }),
          privateResp: await send({ type: 'webdav-test', url: 'https://127.0.0.1/dav/', user: '', pass: '', allowPrivateHost: false }),
        };
      });
      expect(swChecks.testResp).toMatchObject({ success: false, needPermission: true, origin: WEBDAV_ORIGIN_PATTERN });
      expect(swChecks.putResp).toMatchObject({ success: false, needPermission: true, origin: WEBDAV_ORIGIN_PATTERN });
      expect(swChecks.getResp).toMatchObject({ success: false, needPermission: true, origin: WEBDAV_ORIGIN_PATTERN });
      expect(swChecks.delResp).toMatchObject({ success: false, needPermission: true, origin: WEBDAV_ORIGIN_PATTERN });
      expect(swChecks.privateResp).toMatchObject({ success: false, blocked: true });

      // Seed WebDAV + encrypted password + hourly auto-backup + autoBackupDue: true and reload to run real catch-up without user gesture
      await page.evaluate(async (url) => {
        const dbg = (window as any).__boxingDebug;
        const enc = await (window as any).__boxingEncryptCredential('secret');
        await dbg.setWebDAVConfig(url, 'u', 'secret');
        dbg.layout.settings.syncProvider = 'webdav';
        dbg.layout.settings._encWebdavPass = enc;
        dbg.layout.settings.autoBackupInterval = 3600;
        dbg.layout.settings.lastBackupAt = 0;
        await dbg.saveLayout({ preserveUpdatedAt: true });
        await dbg.storageSet({ autoBackupDue: true });
      }, WEBDAV_URL);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageGet)), { timeout: 30000 }).toBe(true);
      await dismissOnboarding(page);

      // Catch-up runs asynchronously after init; poll until real chrome.storage.local records webdavPendingPermission
      await expect.poll(async () => page.evaluate(async () => {
        const res = await (window as any).__boxingDebug.storageGet('webdavPendingPermission');
        return res.webdavPendingPermission || null;
      }), { timeout: 15000 }).toMatchObject({
        needed: true,
        origin: WEBDAV_ORIGIN_PATTERN,
        reason: 'missing-permission',
      });

      const lastBackupAt = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.lastBackupAt);
      expect(lastBackupAt).toBe(0);

      // Open Settings -> Sync and verify the permission banner surfaces the pending origin
      await openSyncTab(page);
      await expect(page.locator('#webdav-permission-banner')).toBeVisible();
      expect(await page.locator('#webdav-permission-msg').textContent()).toContain(WEBDAV_DISPLAY_ORIGIN);
      await expect(page.locator('#webdav-permission-btn')).toBeVisible();
    } finally {
      await ctx.close().catch(() => {});
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
