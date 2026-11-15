import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(ROOT_DIR, 'ntp', 'index.html')).href;
const DIST_CHROME = path.join(ROOT_DIR, 'dist', 'boxing-chrome');
const DIST_FIREFOX = path.join(ROOT_DIR, 'dist', 'boxing-firefox');

async function bootFreshFileNtp(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout)))
    .toBe(true);
  await dismissOnboarding(page);
}

async function readAutoBackupStateFromPage(page) {
  return page.evaluate(async () => {
    const dbg = (window as any).__boxingDebug;
    const raw = (await dbg.storageGet('autoBackupState')).autoBackupState;
    return (window as any).__boxingSnapshotCore.normalizeAutoBackupState(raw);
  });
}

async function openSyncTab(page) {
  await page.evaluate(() => document.getElementById('settings-btn')?.click());
  await expect(page.locator('#settings-modal')).toBeVisible();
  await page.evaluate(() => {
    (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click();
  });
  await expect(page.locator('#tab-sync')).toBeVisible();
}

async function openDataTab(page) {
  await page.evaluate(() => document.getElementById('settings-btn')?.click());
  await expect(page.locator('#settings-modal')).toBeVisible();
  await page.evaluate(() => {
    (document.querySelector('.settings-nav__item[data-tab="data"]') as HTMLElement | null)?.click();
  });
  await expect(page.locator('#tab-data')).toBeVisible();
}

test.describe('Ticket #124 — Background local auto-backup contracts (file:// + static build)', () => {
  test.setTimeout(90_000);

  test('New user defaults are disabled, Local Only exposes local auto-backup controls, and .sync-group stays 3', async ({ page }) => {
    let downloadCount = 0;
    page.on('download', () => { downloadCount++; });
    const remoteRequests: string[] = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.startsWith('http://') || u.startsWith('https://')) remoteRequests.push(u);
    });

    await bootFreshFileNtp(page);
    const snap = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const raw = (await dbg.storageGet('autoBackupState')).autoBackupState;
      const state = (window as any).__boxingSnapshotCore.normalizeAutoBackupState(raw);
      const list = await dbg.listSnapshots();
      return {
        interval: dbg.layout.settings.autoBackupInterval,
        lastBackupAt: dbg.layout.settings.lastBackupAt,
        optIn: state.optIn,
        status: state.local?.status,
        snapCount: list.length,
      };
    });
    expect(snap).toEqual({
      interval: 0,
      lastBackupAt: 0,
      optIn: false,
      status: 'idle',
      snapCount: 0,
    });

    await openSyncTab(page);
    expect(await page.locator('#sync-provider').inputValue()).toBe('local');
    await expect(page.locator('#local-auto-backup-section')).toBeVisible();
    await expect(page.locator('#auto-backup-interval')).toBeVisible();
    expect(await page.locator('#auto-backup-interval').inputValue()).toBe('0');
    await expect(page.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'off');
    await expect(page.locator('#auto-backup-upgrade-box')).toBeHidden();
    expect((await page.locator('#last-backup-time-value').textContent())?.trim()).toBeTruthy();
    expect((await page.locator('#local-auto-backup-last-at').textContent())?.trim()).toBeTruthy();
    // Preserves #tab-sync .sync-group count invariant (Shared, WebDAV, Gist)
    await expect(page.locator('#tab-sync .sync-group')).toHaveCount(3);

    expect(downloadCount).toBe(0);
    expect(remoteRequests).toEqual([]);
  });

  test('Legacy non-zero autoBackupInterval stays paused until user clicks Enable local auto-backup, and disabling preserves history', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('__seeded_legacy_124')) return;
      localStorage.setItem('__seeded_legacy_124', '1');
      localStorage.setItem('boxingLayout', JSON.stringify({
        version: 3.5,
        schemaVersion: 3,
        boxes: [
          {
            id: 'L1',
            type: 'large',
            title: 'Work Box',
            x: 10,
            y: 20,
            width: 320,
            height: 220,
            nextSmallIndex: 2,
            children: [
              {
                id: 'S1',
                type: 'small',
                title: 'Docs',
                x: 10,
                y: 10,
                width: 120,
                height: 80,
                bookmarks: [{ id: 'b1', title: 'Example', url: 'https://example.com/' }],
              },
            ],
          },
        ],
        nextLargeIndex: 2,
        connections: [],
        settings: {
          onboardingCompleted: true,
          syncProvider: 'webdav',
          webdavUrl: 'https://dav.example.com/boxing/',
          webdavUser: 'legacy-user',
          _encWebdavPass: { v: 1, iv: 'abc', ct: 'SECRET_WEBDAV_CIPHER' },
          _encGistToken: { v: 1, iv: 'def', ct: 'SECRET_GIST_CIPHER' },
          autoBackupInterval: 3600,
          lastBackupAt: 1700000000000,
        },
        _meta: { revision: 5, updatedAt: 1700000000000, writerId: 'legacy' },
      }));
    });

    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageGet)))
      .toBe(true);
    await dismissOnboarding(page);

    // Must preserve legacy interval & history, but NOT auto-start or write a snapshot before opt-in.
    const preOptIn = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const raw = (await dbg.storageGet('autoBackupState')).autoBackupState;
      return {
        interval: dbg.layout.settings.autoBackupInterval,
        lastBackupAt: dbg.layout.settings.lastBackupAt,
        autoState: (window as any).__boxingSnapshotCore.normalizeAutoBackupState(raw),
        snaps: await dbg.listSnapshots(),
      };
    });
    expect(preOptIn.interval).toBe(3600);
    expect(preOptIn.lastBackupAt).toBe(1700000000000);
    expect(preOptIn.autoState.optIn).toBe(false);
    expect(preOptIn.snaps).toEqual([]);

    await openSyncTab(page);
    await expect(page.locator('#auto-backup-upgrade-box')).toBeVisible();
    await expect(page.locator('#auto-backup-activate-btn')).toBeVisible();
    await expect(page.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'paused');
    expect(await page.locator('#auto-backup-interval').inputValue()).toBe('3600');

    // Click explicit opt-in button
    await page.evaluate(() => document.getElementById('auto-backup-activate-btn')?.click());
    await expect
      .poll(async () => (await readAutoBackupStateFromPage(page)).optIn)
      .toBe(true);

    const postOptIn = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const raw = (await dbg.storageGet('autoBackupState')).autoBackupState;
      const state = (window as any).__boxingSnapshotCore.normalizeAutoBackupState(raw);
      const snaps = await dbg.listSnapshots();
      const latest = snaps[snaps.length - 1];
      const key = 'snap.v1.' + latest.ts;
      const stored = await dbg.storageGet(key);
      return {
        state,
        snaps,
        body: stored[key],
        bodyJson: JSON.stringify(stored[key]),
      };
    });
    expect(postOptIn.snaps.length).toBe(1);
    expect(postOptIn.state.intervalSec).toBe(3600);
    expect(postOptIn.state.local.status).toBe('ok');
    expect(postOptIn.state.local.lastSuccessAt).toBe(postOptIn.snaps[0].ts);
    expect(postOptIn.body.reason).toBe('auto-backup');
    // Ticket #122 allowlist enforcement inside snapshot body
    expect(postOptIn.bodyJson).not.toContain('SECRET_WEBDAV_CIPHER');
    expect(postOptIn.bodyJson).not.toContain('SECRET_GIST_CIPHER');
    expect(postOptIn.bodyJson).not.toContain('legacy-user');
    expect(postOptIn.bodyJson).not.toContain('https://dav.example.com');

    await expect(page.locator('#auto-backup-upgrade-box')).toBeHidden();
    await expect(page.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'active');

    // Disable again -> preserves historical lastSuccessAt and snapshots, bumps epoch
    await page.locator('#auto-backup-interval').selectOption('0');
    await expect
      .poll(async () => (await readAutoBackupStateFromPage(page)).optIn)
      .toBe(false);
    const afterDisable = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const raw = (await dbg.storageGet('autoBackupState')).autoBackupState;
      return {
        state: (window as any).__boxingSnapshotCore.normalizeAutoBackupState(raw),
        snaps: await dbg.listSnapshots(),
      };
    });
    expect(afterDisable.state.epoch).toBeGreaterThan(postOptIn.state.epoch);
    expect(afterDisable.state.local.lastSuccessAt).toBe(postOptIn.state.local.lastSuccessAt);
    expect(afterDisable.snaps.length).toBe(1);
  });

  test('Firefox dist build ships shared/snapshot-core.js, alarms permission, and ESM background script', async () => {
    const manifestPath = path.join(DIST_FIREFOX, 'manifest.json');
    const corePath = path.join(DIST_FIREFOX, 'shared', 'snapshot-core.js');
    const bgPath = path.join(DIST_FIREFOX, 'background.js');
    test.skip(!fs.existsSync(manifestPath), 'dist/boxing-firefox is not built - run npm run build first');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.permissions).toContain('alarms');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.background?.type).toBe('module');
    expect(manifest.background?.scripts).toContain('background.js');
    expect(fs.existsSync(corePath)).toBe(true);
    const bgCode = fs.readFileSync(bgPath, 'utf8');
    expect(bgCode).toContain("import('./shared/snapshot-core.js')");

    // Verify shared/snapshot-core.js loads cleanly in Node CJS and exposes expected API
    const core = require(corePath);
    expect(typeof core.saveSnapshotWithAdapter).toBe('function');
    expect(typeof core.normalizeAutoBackupState).toBe('function');
    expect(core.isAutoBackupActive({ optIn: true, intervalSec: 3600 })).toBe(true);
    expect(core.isAutoBackupActive({ optIn: false, intervalSec: 3600 })).toBe(false);
  });

  test('file://: rapid opt-out during slow snapshot save prevents stale opt-in overwrite', async ({ page }) => {
    await bootFreshFileNtp(page);
    await openSyncTab(page);

    await page.evaluate(() => {
      const core = (window as any).__boxingSnapshotCore;
      const origSave = core.saveSnapshotWithAdapter;
      let intercepted = false;
      (window as any).__testSaveStarted = false;
      core.saveSnapshotWithAdapter = function (...args: any[]) {
        if (!intercepted) {
          intercepted = true;
          (window as any).__testSaveStarted = true;
          return new Promise((resolve, reject) => {
            (window as any).__releaseSlowSave = () => {
              Promise.resolve(origSave.apply(core, args)).then(resolve, reject);
            };
          });
        }
        return origSave.apply(core, args);
      };
    });

    // Trigger opt-in (Hourly = 3600) -> enters saveSnapshotWithAdapter and pauses.
    await page.locator('#auto-backup-interval').selectOption('3600');
    await expect
      .poll(() => page.evaluate(() => Boolean((window as any).__testSaveStarted)))
      .toBe(true);

    // Rapidly disable ('0') while the initial snapshot write is still in flight.
    await page.locator('#auto-backup-interval').selectOption('0');
    await expect
      .poll(async () => (await readAutoBackupStateFromPage(page)).optIn)
      .toBe(false);
    await expect(page.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'off');

    // Release the slow opt-in save and verify stale completion does NOT overwrite opt-out.
    await page.evaluate(() => (window as any).__releaseSlowSave());
    await expect
      .poll(() => page.evaluate(() => (window as any).__boxingGetPendingAutoBackupConfigCount()), { timeout: 5000 })
      .toBe(0);

    const finalState = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const raw = (await dbg.storageGet('autoBackupState')).autoBackupState;
      return {
        state: (window as any).__boxingSnapshotCore.normalizeAutoBackupState(raw),
        setting: dbg.layout.settings.autoBackupInterval,
        selectVal: (document.getElementById('auto-backup-interval') as HTMLSelectElement | null)?.value,
        badgeState: document.getElementById('local-auto-backup-status-text')?.getAttribute('data-state'),
      };
    });
    expect(finalState.state.optIn).toBe(false);
    expect(finalState.state.intervalSec).toBe(0);
    expect(finalState.setting).toBe(0);
    expect(finalState.selectVal).toBe('0');
    expect(finalState.badgeState).toBe('off');
  });

  test('snapshot-core: readIndexWithAdapter storage error fails closed without overwriting existing snap.v1.index', async () => {
    const core = require(path.join(ROOT_DIR, 'shared', 'snapshot-core.js'));
    const store: Record<string, any> = {};
    let failIndexReads = false;
    const storage = {
      async get(keys: any) {
        if (keys === 'snap.v1.index' && failIndexReads) {
          throw new Error('transient index read failure');
        }
        if (typeof keys === 'string') {
          return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
        }
        const out: Record<string, any> = {};
        if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
          for (const [k, def] of Object.entries(keys)) {
            out[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : def;
          }
        }
        return out;
      },
      async set(obj: Record<string, any>) {
        Object.assign(store, obj);
      },
      async remove(keys: string | string[]) {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
      },
    };

    const first = await core.saveSnapshotWithAdapter(
      storage,
      { version: 3.5, schemaVersion: 3, boxes: [{ id: 'L1', title: 'Keep Me' }] },
      { reason: 'manual', now: 1_700_000_001_000, returnDetails: true },
    );
    expect(first.ok).toBe(true);
    const savedIndexBefore = JSON.parse(JSON.stringify(store['snap.v1.index']));
    expect(savedIndexBefore).toHaveLength(1);

    failIndexReads = true;
    const failed = await core.saveSnapshotWithAdapter(
      storage,
      { version: 3.5, schemaVersion: 3, boxes: [{ id: 'L2', title: 'New' }] },
      { reason: 'auto-backup', now: 1_700_000_002_000, returnDetails: true },
    );
    expect(failed.ok).toBe(false);
    expect(failed.reason).toBe('storage-error');
    expect(store['snap.v1.index']).toEqual(savedIndexBefore);
    expect(store['snap.v1.' + savedIndexBefore[0].ts]).toBeTruthy();
  });

  test('snapshot-core: migrateSnapshotsWithAdapter keeps boxingSnapshots intact if index write fails, then migrates cleanly on retry', async () => {
    const core = require(path.join(ROOT_DIR, 'shared', 'snapshot-core.js'));
    const store: Record<string, any> = {
      boxingSnapshots: [
        { ts: 1_700_000_010_000, schemaVersion: 2, data: { version: 3.5, boxes: [{ id: 'A' }] } },
        { ts: 1_700_000_020_000, schemaVersion: 2, data: { version: 3.5, boxes: [{ id: 'B' }] } },
      ],
    };
    let failIndexWriteOnce = true;
    const storage = {
      async get(keys: any) {
        if (typeof keys === 'string') {
          return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
        }
        const out: Record<string, any> = {};
        if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
          for (const [k, def] of Object.entries(keys)) {
            out[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : def;
          }
        }
        return out;
      },
      async set(obj: Record<string, any>) {
        if (failIndexWriteOnce && Object.prototype.hasOwnProperty.call(obj, 'snap.v1.index')) {
          failIndexWriteOnce = false;
          throw new Error('simulated quota/write error on snap.v1.index');
        }
        Object.assign(store, obj);
      },
      async remove(keys: string | string[]) {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
      },
    };

    await expect(core.migrateSnapshotsWithAdapter(storage)).rejects.toThrow('simulated quota/write error');
    expect(Array.isArray(store.boxingSnapshots)).toBe(true);
    expect(store.boxingSnapshots).toHaveLength(2);
    expect(store['snap.v1.index']).toBeUndefined();

    const migratedList = await core.listSnapshotsWithAdapter(storage);
    expect(migratedList.map((e: any) => e.ts)).toEqual([1_700_000_010_000, 1_700_000_020_000]);
    expect(store.boxingSnapshots).toBeUndefined();
    expect(store['snap.v1.1700000010000']).toBeTruthy();
    expect(store['snap.v1.1700000020000']).toBeTruthy();
  });

  test('file://: setAutoBackupState write failure surfaces error UI without unhandled rejection and allows retry', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await bootFreshFileNtp(page);
    await openSyncTab(page);

    await page.evaluate(() => {
      (window as any).__unhandledRejections = [];
      window.addEventListener('unhandledrejection', (ev) => {
        (window as any).__unhandledRejections.push(String(ev.reason?.message || ev.reason || 'unknown'));
      });
      const origSetItem = Storage.prototype.setItem;
      (window as any).__origSetItem = origSetItem;
      (window as any).__failAutoBackupStateWrite = true;
      Storage.prototype.setItem = function (key: string, value: string) {
        if ((window as any).__failAutoBackupStateWrite && key === 'bxstore:autoBackupState') {
          throw new Error('Simulated autoBackupState quota failure');
        }
        return origSetItem.call(this, key, value);
      };
    });

    try {
      // 1) Selecting an interval triggers change handler; setAutoBackupState rejection must be handled cleanly.
      await page.locator('#auto-backup-interval').selectOption('3600');
      await expect
        .poll(() => page.evaluate(() => (window as any).__boxingGetPendingAutoBackupConfigCount()), { timeout: 5000 })
        .toBe(0);

      await expect(page.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'error');
      await expect(page.locator('#local-auto-backup-error')).toBeVisible();
      await expect(page.locator('#local-auto-backup-error')).toContainText('Simulated autoBackupState quota failure');
      await expect(page.locator('#auto-backup-activate-btn')).toBeVisible();
      await expect(page.locator('#auto-backup-activate-btn')).toBeEnabled();

      // 2) Clicking activate button while failing also catches rejection, re-enables button, and keeps error visible.
      await page.evaluate(() => document.getElementById('auto-backup-activate-btn')?.click());
      await expect
        .poll(() => page.evaluate(() => (window as any).__boxingGetPendingAutoBackupConfigCount()), { timeout: 5000 })
        .toBe(0);

      await expect(page.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'error');
      await expect(page.locator('#local-auto-backup-error')).toContainText('Simulated autoBackupState quota failure');
      await expect(page.locator('#auto-backup-activate-btn')).toBeEnabled();

      // 3) Once storage recovers, clicking activate succeeds and clears the error banner.
      await page.evaluate(() => {
        (window as any).__failAutoBackupStateWrite = false;
      });
      await page.evaluate(() => document.getElementById('auto-backup-activate-btn')?.click());
      await expect
        .poll(async () => {
          const st = await readAutoBackupStateFromPage(page);
          const pending = await page.evaluate(() => (window as any).__boxingGetPendingAutoBackupConfigCount());
          return st.optIn === true && st.local?.status === 'ok' && pending === 0;
        }, { timeout: 5000 })
        .toBe(true);

      await expect(page.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'active');
      await expect(page.locator('#local-auto-backup-error')).toBeHidden();
      await expect(page.locator('#auto-backup-upgrade-box')).toBeHidden();

      const rejections = await page.evaluate(() => (window as any).__unhandledRejections);
      expect(rejections).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally {
      await page
        .evaluate(() => {
          if ((window as any).__origSetItem) {
            Storage.prototype.setItem = (window as any).__origSetItem;
          }
        })
        .catch(() => {});
    }
  });

  test('SW takePreUpdateSnapshot allocates monotonic ts on same-ms collision and backwards clock skew', async () => {
    const vm = require('node:vm');
    const existingTs = 1_750_000_000_000;
    const preIndex: any[] = [];
    const store: Record<string, any> = {
      boxingLayout: {
        version: 3.5,
        schemaVersion: 3,
        nextLargeIndex: 2,
        boxes: [{ id: 'L1', type: 'large', title: 'Updated State', x: 0, y: 0, width: 320, height: 220, children: [] }],
        connections: [],
        settings: { selectedLanguage: 'en', onboardingCompleted: true },
      },
    };
    // Fill 30 snapshots (cap) ending at existingTs so clock-backwards would be sorted first & evicted if not monotonic.
    for (let i = 0; i < 30; i++) {
      const ts = existingTs - (29 - i) * 3600_000;
      const snap = { ts, schemaVersion: 3, data: { version: 3.5, boxes: [{ id: 'OLD_' + i }] } };
      store['snap.v1.' + ts] = snap;
      preIndex.push({ ts, schemaVersion: 3, size: JSON.stringify(snap).length });
    }
    store['snap.v1.index'] = preIndex;

    let fakeNow = existingTs; // Start with exact same-ms collision against latest snapshot
    let onInstalledHandler: ((details: any) => Promise<void>) | null = null;
    const FakeDate: any = function (...args: any[]) {
      return args.length ? new (Date as any)(...args) : new Date(fakeNow);
    };
    FakeDate.now = () => fakeNow;
    FakeDate.UTC = Date.UTC;
    FakeDate.parse = Date.parse;
    FakeDate.prototype = Date.prototype;

    const chromeMock = {
      storage: {
        local: {
          get: (keys: any, cb?: (res: any) => void) => {
            const out: Record<string, any> = {};
            if (keys == null) Object.assign(out, structuredClone(store));
            else if (typeof keys === 'string') { if (keys in store) out[keys] = structuredClone(store[keys]); }
            else if (Array.isArray(keys)) { for (const k of keys) if (k in store) out[k] = structuredClone(store[k]); }
            else { for (const [k, d] of Object.entries(keys)) out[k] = k in store ? structuredClone(store[k]) : d; }
            if (typeof cb === 'function') { cb(out); return undefined; }
            return Promise.resolve(out);
          },
          set: (obj: Record<string, any>, cb?: () => void) => {
            for (const [k, v] of Object.entries(obj)) store[k] = structuredClone(v);
            if (typeof cb === 'function') { cb(); return undefined; }
            return Promise.resolve();
          },
          remove: (keys: string | string[], cb?: () => void) => {
            for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
            if (typeof cb === 'function') { cb(); return undefined; }
            return Promise.resolve();
          },
        },
        sync: { get: (_k: any, cb?: (r: any) => void) => { cb && cb({}); } },
      },
      alarms: {
        get: (_n: string, cb?: (a: any) => void) => { cb && cb(null); return Promise.resolve(null); },
        create: () => Promise.resolve(),
        clear: (_n: string, cb?: (b: boolean) => void) => { cb && cb(true); return Promise.resolve(true); },
        onAlarm: { addListener: () => {} },
      },
      action: {
        setBadgeText: () => Promise.resolve(),
        setBadgeBackgroundColor: () => Promise.resolve(),
      },
      runtime: {
        id: 'spec-ext-id',
        getURL: (p: string) => 'chrome-extension://spec-ext-id/' + p,
        onInstalled: { addListener: (fn: any) => { onInstalledHandler = fn; } },
        onStartup: { addListener: () => {} },
        onMessage: { addListener: () => {} },
        lastError: null,
      },
    };

    const sandbox: any = {
      chrome: chromeMock,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      Date: FakeDate,
      Math, JSON, Object, Array, Number, String, Boolean, RegExp, Error, Set, Map, WeakSet, WeakMap, URL, Promise,
      importScripts: (relPath: string) => {
        const code = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
        vm.runInContext(code, sandbox, { filename: relPath });
      },
    };
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT_DIR, 'background.js'), 'utf8'), sandbox, { filename: 'background.js' });

    expect(typeof onInstalledHandler).toBe('function');

    // 1) Exact same-millisecond Date.now() collision: must allocate existingTs + 1 and preserve existing snapshot.
    await onInstalledHandler!({ reason: 'update', previousVersion: '2026.10.0' });
    const idxAfterSameMs = store['snap.v1.index'];
    expect(idxAfterSameMs[idxAfterSameMs.length - 1].ts).toBe(existingTs + 1);
    expect(new Set(idxAfterSameMs.map((e: any) => e.ts)).size).toBe(idxAfterSameMs.length);
    expect(store['snap.v1.' + existingTs]?.data?.boxes?.[0]?.id).toBe('OLD_29');
    expect(store['snap.v1.' + (existingTs + 1)]?.reason).toBe('pre-update');
    expect(store['snap.v1.' + (existingTs + 1)]?.data?.boxes?.[0]?.title).toBe('Updated State');

    // 2) Clock skewed 1 hour backwards: must still allocate existingTs + 2 and NOT get evicted.
    fakeNow = existingTs - 3600_000;
    await onInstalledHandler!({ reason: 'update', previousVersion: '2026.10.1' });
    const idxAfterSkew = store['snap.v1.index'];
    expect(idxAfterSkew[idxAfterSkew.length - 1].ts).toBe(existingTs + 2);
    expect(new Set(idxAfterSkew.map((e: any) => e.ts)).size).toBe(idxAfterSkew.length);
    expect(store['snap.v1.' + (existingTs + 2)]?.reason).toBe('pre-update');
    expect(store['snap.v1.' + (existingTs + 2)]?.data?.boxes?.[0]?.title).toBe('Updated State');
  });
});

function verifyAndAttachSwNetworkAudit(ctx: any) {
  const downloads: string[] = [];
  const externalRequests: string[] = [];
  let probeUrl: string | null = null;
  let probeCapturedFromSw = false;

  const onPage = (p: any) => {
    p.on('download', (d: any) => downloads.push(d.suggestedFilename()));
  };
  const onRequest = (req: any) => {
    const u = req.url();
    if (probeUrl && u === probeUrl) {
      if (req.serviceWorker()) probeCapturedFromSw = true;
      return;
    }
    if (u.startsWith('http://') || u.startsWith('https://')) {
      externalRequests.push(u);
    }
  };

  ctx.on('page', onPage);
  ctx.on('request', onRequest);

  return {
    downloads,
    externalRequests,
    async verifySwCapture(sw: any) {
      const testProbeUrl = 'https://sw-network-audit.invalid/ping';
      probeUrl = testProbeUrl;
      probeCapturedFromSw = false;
      const routeHandler = (route: any) => route.abort();
      await ctx.route(testProbeUrl, routeHandler);
      try {
        await sw.evaluate((u: string) => fetch(u).catch(() => {}), testProbeUrl);
        await expect.poll(() => probeCapturedFromSw, { timeout: 5000 }).toBe(true);
      } finally {
        await ctx.unroute(testProbeUrl, routeHandler).catch(() => {});
        probeUrl = null;
      }
    },
    dispose() {
      ctx.off('page', onPage);
      ctx.off('request', onRequest);
    },
  };
}

test.describe('Ticket #124 — Real Chrome extension background local auto-backup (chromium-extension only)', () => {
  test('AC1-AC6: runs with zero NTP tabs open, deduplicates concurrent catch-ups, cleans up on disable, isolates failures + badge, and rolls back via Time Machine', async ({}, testInfo) => {
    test.setTimeout(180_000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'real extension SW test runs on chromium-extension lane');
    test.skip(
      !fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - run npm run build first',
    );

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue124-ext-'));
    const ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [
        '--load-extension=' + DIST_CHROME,
        '--disable-extensions-except=' + DIST_CHROME,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const audit = verifyAndAttachSwNetworkAudit(ctx);
    const { downloads, externalRequests } = audit;

    try {
      const keeperPage = await ctx.newPage();
      await keeperPage.goto('about:blank');

      const ntpPage = await ctx.newPage();
      await ntpPage.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect
        .poll(() => ntpPage.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout)), { timeout: 30000 })
        .toBe(true);
      await dismissOnboarding(ntpPage);

      const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
      await audit.verifySwCapture(sw);

      // Seed initial layout with a box and simulated encrypted secret (must stay out of snapshots).
      await ntpPage.evaluate(async () => {
        const dbg = (window as any).__boxingDebug;
        dbg.layout.boxes = [
          {
            id: 'L1',
            type: 'large',
            title: 'Alpha Box',
            x: 40,
            y: 50,
            width: 320,
            height: 220,
            nextSmallIndex: 2,
            children: [
              {
                id: 'S1',
                type: 'small',
                title: 'Links',
                x: 12,
                y: 12,
                width: 140,
                height: 90,
                bookmarks: [{ id: 'b1', title: 'MDN', url: 'https://developer.mozilla.org/' }],
              },
            ],
          },
        ];
        dbg.layout.nextLargeIndex = 2;
        // Ticket #125: keep the WebDAV fields to prove they never leak into snapshots,
        // but leave the provider on Local so this #124 spec still isolates the local
        // snapshot lane (cloud auto-backup now has its own spec: boxing-webdav-auto-backup).
        dbg.layout.settings.syncProvider = 'local';
        dbg.layout.settings.webdavUrl = 'https://dav.example.com/private/';
        dbg.layout.settings.webdavUser = 'secret-account';
        dbg.layout.settings._encWebdavPass = { v: 1, iv: 'iv1', ct: 'CIPHER_SHOULD_NOT_LEAK' };
        await dbg.saveLayout();
      });

      const beforeLayoutMeta = await ntpPage.evaluate(async () => {
        const dbg = (window as any).__boxingDebug;
        const stored = await dbg.storageGet('boxingLayout');
        return {
          revision: stored.boxingLayout?._meta?.revision || 0,
          updatedAt: stored.boxingLayout?._meta?.updatedAt || 0,
          boxTitles: (stored.boxingLayout?.boxes || []).map((b: any) => b.title),
        };
      });

      // Enable local auto-backup (Hourly = 3600) in Settings -> Sync.
      await openSyncTab(ntpPage);
      await ntpPage.locator('#auto-backup-interval').selectOption('3600');
      await expect
        .poll(async () => {
          const st = await readAutoBackupStateFromPage(ntpPage);
          const pending = await ntpPage.evaluate(() => (window as any).__boxingGetPendingAutoBackupConfigCount());
          return st.optIn === true && st.local?.status === 'ok' && pending === 0;
        }, { timeout: 15000 })
        .toBe(true);
      await expect(ntpPage.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'active');

      const afterOptIn = await sw.evaluate(async () => {
        const alarm = await chrome.alarms.get('boxing-auto-backup');
        const all = await chrome.storage.local.get(null);
        const snapKeys = Object.keys(all).filter((k) => k.startsWith('snap.v1.') && k !== 'snap.v1.index').sort();
        const latestSnap = snapKeys.length ? all[snapKeys[snapKeys.length - 1]] : null;
        const badge = await chrome.action.getBadgeText({});
        return {
          hasOnAlarmListener: chrome.alarms.onAlarm.hasListeners(),
          alarm,
          state: all.autoBackupState,
          snapKeys,
          latestSnap,
          latestSnapJson: JSON.stringify(latestSnap),
          boxingLayout: all.boxingLayout,
          badge,
        };
      });

      expect(afterOptIn.hasOnAlarmListener).toBe(true);
      expect(afterOptIn.alarm?.name).toBe('boxing-auto-backup');
      expect(afterOptIn.alarm?.periodInMinutes).toBe(60);
      expect(afterOptIn.state.optIn).toBe(true);
      expect(afterOptIn.state.intervalSec).toBe(3600);
      expect(afterOptIn.state.local.status).toBe('ok');
      expect(afterOptIn.state.local.lastSuccessAt).toBeGreaterThan(0);
      expect(afterOptIn.snapKeys.length).toBe(1);
      expect(afterOptIn.latestSnap.reason).toBe('auto-backup');
      expect(afterOptIn.latestSnapJson).not.toContain('CIPHER_SHOULD_NOT_LEAK');
      expect(afterOptIn.latestSnapJson).not.toContain('secret-account');
      expect(afterOptIn.latestSnapJson).not.toContain('dav.example.com');
      expect(afterOptIn.badge).toBe('');
      // NTP persisted autoBackupInterval=3600 with preserveUpdatedAt:true; now capture that settled revision
      // and verify background SW alarm runs NEVER write or mutate boxingLayout.
      expect(afterOptIn.boxingLayout._meta.updatedAt).toBe(beforeLayoutMeta.updatedAt);
      const settledRevisionBeforeBg = afterOptIn.boxingLayout._meta.revision;
      expect(settledRevisionBeforeBg).toBeGreaterThanOrEqual(beforeLayoutMeta.revision);

      // Close ALL NTP pages — only about:blank stays open.
      await ntpPage.close();
      const remainingNtpPages = ctx.pages().filter((p) => p.url().startsWith('chrome-extension://'));
      expect(remainingNtpPages.length).toBe(0);

      // Fire background alarm handler with ZERO open NTP pages.
      const alarmRun = await sw.evaluate(async () => {
        const bg = (self as any).__boxingBgAutoBackup;
        const res = await bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
        const all = await chrome.storage.local.get(null);
        const snapKeys = Object.keys(all).filter((k) => k.startsWith('snap.v1.') && k !== 'snap.v1.index').sort();
        return {
          res,
          snapKeys,
          state: all.autoBackupState,
          revision: all.boxingLayout?._meta?.revision || 0,
          updatedAt: all.boxingLayout?._meta?.updatedAt || 0,
        };
      });
      expect(alarmRun.res.ok).toBe(true);
      expect(alarmRun.snapKeys.length).toBe(2);
      expect(alarmRun.state.local.lastSuccessAt).toBeGreaterThan(afterOptIn.state.local.lastSuccessAt);
      expect(alarmRun.revision).toBe(settledRevisionBeforeBg);
      expect(alarmRun.updatedAt).toBe(beforeLayoutMeta.updatedAt);

      // Concurrent overdue catch-up burst (simulating startup + multiple wakeups): must run at most ONCE.
      const burstResult = await sw.evaluate(async () => {
        const bg = (self as any).__boxingBgAutoBackup;
        const stored = await chrome.storage.local.get('autoBackupState');
        await chrome.storage.local.set({
          autoBackupState: {
            ...stored.autoBackupState,
            nextScheduledAt: Date.now() - 2 * 3600 * 1000,
          },
        });
        const results = await Promise.all([
          bg.reconcileAutoBackupSchedule({ trigger: 'startup-catchup', runCatchup: true }),
          bg.reconcileAutoBackupSchedule({ trigger: 'ntp-ensure', runCatchup: true }),
          bg.reconcileAutoBackupSchedule({ trigger: 'ntp-ensure', runCatchup: true }),
        ]);
        const all = await chrome.storage.local.get(null);
        const snapKeys = Object.keys(all).filter((k) => k.startsWith('snap.v1.') && k !== 'snap.v1.index').sort();
        const alarms = await chrome.alarms.getAll();
        const index = all['snap.v1.index'];
        return { results, index, snapCount: snapKeys.length, alarmsCount: alarms.filter((a) => a.name === 'boxing-auto-backup').length };
      });
      expect(burstResult.snapCount, JSON.stringify({ after: afterOptIn.snapKeys, alarm: alarmRun.snapKeys, burst: burstResult })).toBe(3);
      expect(burstResult.alarmsCount).toBe(1);

      // Failure boundary: > 2MB layout fails closed, sets '!' badge, NEVER updates lastSuccessAt;
      // then recovering size clears '!' badge on the next successful alarm.
      const savedTsBeforeError = await sw.evaluate(async () => {
        const s = (await chrome.storage.local.get('autoBackupState')).autoBackupState;
        return s.local.lastSuccessAt;
      });
      const failureCheck = await sw.evaluate(async () => {
        const cur = (await chrome.storage.local.get('boxingLayout')).boxingLayout;
        const backupCopy = JSON.parse(JSON.stringify(cur));
        const bloated = JSON.parse(JSON.stringify(cur));
        bloated.boxes.push({
          id: 'L99',
          type: 'large',
          title: 'X'.repeat(2_250_000),
          x: 500,
          y: 0,
          width: 320,
          height: 220,
          nextSmallIndex: 1,
          children: [],
        });
        await chrome.storage.local.set({ boxingLayout: bloated });
        const bg = (self as any).__boxingBgAutoBackup;
        const failRes = await bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
        const stateAfterFail = (await chrome.storage.local.get('autoBackupState')).autoBackupState;
        const badgeAfterFail = await chrome.action.getBadgeText({});
        // Restore normal layout and run again -> clears error badge
        await chrome.storage.local.set({ boxingLayout: backupCopy });
        const recoverRes = await bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
        const stateAfterRecover = (await chrome.storage.local.get('autoBackupState')).autoBackupState;
        const badgeAfterRecover = await chrome.action.getBadgeText({});
        return { failRes, stateAfterFail, badgeAfterFail, recoverRes, stateAfterRecover, badgeAfterRecover };
      });
      expect(failureCheck.failRes.ok).toBe(false);
      expect(failureCheck.stateAfterFail.local.status).toBe('error');
      expect(failureCheck.stateAfterFail.local.lastSuccessAt).toBe(savedTsBeforeError);
      expect(failureCheck.badgeAfterFail).toBe('!');
      expect(failureCheck.recoverRes.ok).toBe(true);
      expect(failureCheck.stateAfterRecover.local.status).toBe('ok');
      expect(failureCheck.stateAfterRecover.local.lastError).toBeNull();
      expect(failureCheck.stateAfterRecover.local.lastSuccessAt).toBeGreaterThan(savedTsBeforeError);
      expect(failureCheck.badgeAfterRecover).toBe('');

      // Reopen NTP, add a transient box, roll back to a background snapshot via Time Machine, then disable auto-backup.
      const ntpReopened = await ctx.newPage();
      await ntpReopened.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect
        .poll(() => ntpReopened.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout)), { timeout: 30000 })
        .toBe(true);
      await dismissOnboarding(ntpReopened);

      await ntpReopened.evaluate(async () => {
        const dbg = (window as any).__boxingDebug;
        dbg.layout.boxes.push({
          id: 'L_TEMP',
          type: 'large',
          title: 'Temp Before Rollback',
          x: 600,
          y: 0,
          width: 320,
          height: 220,
          nextSmallIndex: 1,
          children: [],
        });
        await dbg.saveLayout();
      });

      await openDataTab(ntpReopened);
      await expect(ntpReopened.locator('#data-snapshot-list .data-snapshot-row')).toHaveCount(4);
      await ntpReopened.evaluate(() => {
        const btns = document.querySelectorAll('#data-snapshot-list .data-snapshot-row .data-snapshot-rollback-btn');
        const target = btns[btns.length - 1] as HTMLElement | undefined;
        target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await expect.poll(() => ntpReopened.evaluate(() => !document.getElementById('confirm-modal')?.hidden)).toBe(true);
      await ntpReopened.evaluate(() => document.getElementById('confirm-delete-btn')?.click());
      await expect
        .poll(() => ntpReopened.evaluate(() => (window as any).__boxingDebug.layout.boxes.map((b: any) => b.title)))
        .toEqual(['Alpha Box']);

      // Disable auto-backup from Settings -> Sync: alarm cleared, epoch bumped, history retained, alarm no-ops.
      await openSyncTab(ntpReopened);
      await ntpReopened.locator('#auto-backup-interval').selectOption('0');
      await expect
        .poll(async () => (await readAutoBackupStateFromPage(ntpReopened)).optIn, { timeout: 15000 })
        .toBe(false);

      const afterDisable = await sw.evaluate(async () => {
        const bg = (self as any).__boxingBgAutoBackup;
        const alarm = await chrome.alarms.get('boxing-auto-backup');
        const triggerAfterDisable = await bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
        const all = await chrome.storage.local.get(null);
        const snapKeys = Object.keys(all).filter((k) => k.startsWith('snap.v1.') && k !== 'snap.v1.index');
        return { alarm, triggerAfterDisable, state: all.autoBackupState, snapCount: snapKeys.length };
      });
      expect(afterDisable.alarm).toBeUndefined();
      expect(afterDisable.triggerAfterDisable.skipped).toBe(true);
      expect(afterDisable.triggerAfterDisable.reason).toBe('inactive');
      expect(afterDisable.state.local.lastSuccessAt).toBe(failureCheck.stateAfterRecover.local.lastSuccessAt);
      expect(afterDisable.snapCount).toBe(5); // 4 auto-backup + 1 pre-restore safety snapshot

      // Legacy upgrade gate in real extension: without optIn, ensure/startup stays inactive.
      const legacyExtCheck = await sw.evaluate(async () => {
        await chrome.storage.local.remove('autoBackupState');
        const cur = (await chrome.storage.local.get('boxingLayout')).boxingLayout;
        cur.settings.autoBackupInterval = 86400;
        await chrome.storage.local.set({ boxingLayout: cur });
        const bg = (self as any).__boxingBgAutoBackup;
        const res = await bg.reconcileAutoBackupSchedule({ trigger: 'startup-catchup', runCatchup: true });
        const alarm = await chrome.alarms.get('boxing-auto-backup');
        return { res, alarm };
      });
      expect(legacyExtCheck.res.active).toBe(false);
      expect(legacyExtCheck.alarm).toBeUndefined();

      expect(downloads).toEqual([]);
      expect(externalRequests).toEqual([]);
    } finally {
      audit.dispose();
      await ctx.close().catch(() => {});
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });

  test('Crash recovery: interrupted running state with expired or missing lock and future nextScheduledAt still catches up immediately', async ({}, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'real extension SW test runs on chromium-extension lane');
    test.skip(
      !fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - run npm run build first',
    );

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue124-crash-'));
    const ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [
        '--load-extension=' + DIST_CHROME,
        '--disable-extensions-except=' + DIST_CHROME,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const audit = verifyAndAttachSwNetworkAudit(ctx);
    const { downloads, externalRequests } = audit;

    try {
      const ntpPage = await ctx.newPage();
      await ntpPage.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect
        .poll(() => ntpPage.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout)), { timeout: 30000 })
        .toBe(true);
      await dismissOnboarding(ntpPage);

      const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
      await audit.verifySwCapture(sw);

      await openSyncTab(ntpPage);
      await ntpPage.locator('#auto-backup-interval').selectOption('604800');
      await expect
        .poll(async () => {
          const st = await readAutoBackupStateFromPage(ntpPage);
          const pending = await ntpPage.evaluate(() => (window as any).__boxingGetPendingAutoBackupConfigCount());
          return st.optIn === true && st.local?.status === 'ok' && pending === 0;
        }, { timeout: 15000 })
        .toBe(true);

      const recoveryMissingLock = await sw.evaluate(async () => {
        const bg = (self as any).__boxingBgAutoBackup;
        const cur = (await chrome.storage.local.get('autoBackupState')).autoBackupState;
        const beforeSnaps = (await chrome.storage.local.get('snap.v1.index'))['snap.v1.index'] || [];
        // Simulate SW killed after claiming running state while nextScheduledAt is a week away and lock is gone.
        await chrome.storage.local.set({
          autoBackupState: {
            ...cur,
            nextScheduledAt: Date.now() + 7 * 86400 * 1000,
            local: {
              ...cur.local,
              status: 'running',
              lastAttemptAt: Date.now() - 60_000,
            },
            lock: null,
          },
        });
        const rec = await bg.reconcileAutoBackupSchedule({ trigger: 'startup-catchup', runCatchup: true });
        const afterState = (await chrome.storage.local.get('autoBackupState')).autoBackupState;
        const afterSnaps = (await chrome.storage.local.get('snap.v1.index'))['snap.v1.index'] || [];
        return {
          beforeCount: beforeSnaps.length,
          afterCount: afterSnaps.length,
          rec,
          afterState,
        };
      });
      expect(recoveryMissingLock.rec.catchupRan).toBe(true);
      expect(recoveryMissingLock.rec.ok).toBe(true);
      expect(recoveryMissingLock.afterCount).toBe(recoveryMissingLock.beforeCount + 1);
      expect(recoveryMissingLock.afterState.local.status).toBe('ok');
      expect(recoveryMissingLock.afterState.lock).toBeNull();

      // Also verify interrupted state with an expired lease lock catches up.
      const recoveryExpiredLock = await sw.evaluate(async () => {
        const bg = (self as any).__boxingBgAutoBackup;
        const cur = (await chrome.storage.local.get('autoBackupState')).autoBackupState;
        const beforeSnaps = (await chrome.storage.local.get('snap.v1.index'))['snap.v1.index'] || [];
        await chrome.storage.local.set({
          autoBackupState: {
            ...cur,
            nextScheduledAt: Date.now() + 7 * 86400 * 1000,
            local: {
              ...cur.local,
              status: 'running',
              lastAttemptAt: Date.now() - 120_000,
            },
            lock: {
              ownerId: 'dead-sw-owner',
              epoch: cur.epoch,
              acquiredAt: Date.now() - 120_000,
              expiresAt: Date.now() - 5_000,
            },
          },
        });
        const rec = await bg.reconcileAutoBackupSchedule({ trigger: 'ntp-ensure', runCatchup: true });
        const afterState = (await chrome.storage.local.get('autoBackupState')).autoBackupState;
        const afterSnaps = (await chrome.storage.local.get('snap.v1.index'))['snap.v1.index'] || [];
        return {
          beforeCount: beforeSnaps.length,
          afterCount: afterSnaps.length,
          rec,
          afterState,
        };
      });
      expect(recoveryExpiredLock.rec.catchupRan).toBe(true);
      expect(recoveryExpiredLock.rec.ok).toBe(true);
      expect(recoveryExpiredLock.afterCount).toBe(recoveryExpiredLock.beforeCount + 1);
      expect(recoveryExpiredLock.afterState.local.status).toBe('ok');
      expect(recoveryExpiredLock.afterState.lock).toBeNull();

      expect(downloads).toEqual([]);
      expect(externalRequests).toEqual([]);
    } finally {
      audit.dispose();
      await ctx.close().catch(() => {});
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });

  test('Cross-context serialization: concurrent SW auto-backup and NTP saveSnapshot preserve all snapshots in snap.v1.index and Time Machine', async ({}, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'real extension SW test runs on chromium-extension lane');
    test.skip(
      !fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - run npm run build first',
    );

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue124-race-'));
    const ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [
        '--load-extension=' + DIST_CHROME,
        '--disable-extensions-except=' + DIST_CHROME,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const audit = verifyAndAttachSwNetworkAudit(ctx);
    const { downloads, externalRequests } = audit;

    try {
      const ntpPage = await ctx.newPage();
      await ntpPage.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect
        .poll(() => ntpPage.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout)), { timeout: 30000 })
        .toBe(true);
      await dismissOnboarding(ntpPage);

      const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
      await audit.verifySwCapture(sw);

      await openSyncTab(ntpPage);
      await ntpPage.locator('#auto-backup-interval').selectOption('3600');
      await expect
        .poll(async () => {
          const st = await readAutoBackupStateFromPage(ntpPage);
          const pending = await ntpPage.evaluate(() => (window as any).__boxingGetPendingAutoBackupConfigCount());
          return st.optIn === true && st.local?.status === 'ok' && pending === 0;
        }, { timeout: 15000 })
        .toBe(true);

      const initialSnaps = await ntpPage.evaluate(() => (window as any).__boxingDebug.listSnapshots());
      expect(initialSnaps).toHaveLength(1);

      // Fire SW auto-backup concurrently with two NTP saveSnapshot calls in the same turn.
      const [bgRes, ntpTs1, ntpTs2] = await Promise.all([
        sw.evaluate(() => (self as any).__boxingBgAutoBackup.runBackgroundLocalAutoBackup({ trigger: 'alarm' })),
        ntpPage.evaluate(() => (window as any).__boxingDebug.saveSnapshot('pre-restore')),
        ntpPage.evaluate(() => (window as any).__boxingDebug.saveSnapshot('manual-race')),
      ]);

      expect(bgRes.ok).toBe(true);
      expect(typeof bgRes.ts).toBe('number');
      expect(typeof ntpTs1).toBe('number');
      expect(typeof ntpTs2).toBe('number');

      const tsSet = new Set([initialSnaps[0].ts, bgRes.ts, ntpTs1, ntpTs2]);
      expect(tsSet.size).toBe(4);

      const storedCheck = await sw.evaluate(async () => {
        const all = await chrome.storage.local.get(null);
        const index = all['snap.v1.index'] || [];
        const reasons = index.map((row: any) => all['snap.v1.' + row.ts]?.reason || null);
        return { index, reasons };
      });
      expect(storedCheck.index).toHaveLength(4);
      expect(storedCheck.reasons).toContain('auto-backup');
      expect(storedCheck.reasons).toContain('pre-restore');
      expect(storedCheck.reasons).toContain('manual-race');

      // Time Machine UI lists all 4 snapshots without any dropped entry.
      await openDataTab(ntpPage);
      await expect(ntpPage.locator('#data-snapshot-list .data-snapshot-row')).toHaveCount(4);

      expect(downloads).toEqual([]);
      expect(externalRequests).toEqual([]);
    } finally {
      audit.dispose();
      await ctx.close().catch(() => {});
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });

  test('autoBackupState updates refresh Time Machine snapshots without clearing open conflict comparison panels', async ({}, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'real extension SW test runs on chromium-extension lane');
    test.skip(
      !fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - run npm run build first',
    );

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue124-conflict-'));
    const ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [
        '--load-extension=' + DIST_CHROME,
        '--disable-extensions-except=' + DIST_CHROME,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const audit = verifyAndAttachSwNetworkAudit(ctx);
    const { downloads, externalRequests } = audit;

    try {
      const ntpPage = await ctx.newPage();
      await ntpPage.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect
        .poll(() => ntpPage.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout)), { timeout: 30000 })
        .toBe(true);
      await dismissOnboarding(ntpPage);

      const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
      await audit.verifySwCapture(sw);

      // Seed current layout + a diverged conflict archive + activate local auto-backup.
      await ntpPage.evaluate(async () => {
        const dbg = (window as any).__boxingDebug;
        dbg.layout.boxes = [
          {
            id: 'L1',
            type: 'large',
            title: 'Current Alpha',
            x: 40,
            y: 50,
            width: 320,
            height: 220,
            nextSmallIndex: 1,
            children: [],
          },
        ];
        dbg.layout.nextLargeIndex = 2;
        await dbg.saveLayout();

        const ts = 1_726_100_000_000;
        const raw = {
          boxes: [
            {
              id: 'L1',
              type: 'large',
              title: 'Conflicted Alpha',
              x: 40,
              y: 50,
              width: 320,
              height: 220,
              nextSmallIndex: 1,
              children: [],
            },
          ],
        };
        const size = JSON.stringify(raw).length;
        await dbg.storageSet({
          ['boxingLayout.conflict.' + ts]: { ts, reason: 'import-merge', side: 'incoming', raw, size, boxes: 1 },
          'boxingLayout.conflict.index': [{ ts, reason: 'import-merge', side: 'incoming', size, boxes: 1 }],
        });
      });

      await openSyncTab(ntpPage);
      await ntpPage.locator('#auto-backup-interval').selectOption('3600');
      await expect
        .poll(async () => {
          const st = await readAutoBackupStateFromPage(ntpPage);
          const pending = await ntpPage.evaluate(() => (window as any).__boxingGetPendingAutoBackupConfigCount());
          return st.optIn === true && st.local?.status === 'ok' && pending === 0;
        }, { timeout: 15000 })
        .toBe(true);
      const activeBadgeText = (await ntpPage.locator('#local-auto-backup-status-text').textContent()) || '';

      await openDataTab(ntpPage);
      await expect(ntpPage.locator('#data-snapshot-list .data-snapshot-row')).toHaveCount(1);
      await ntpPage.locator('#data-conflict-list .data-conflict-compare-btn').first().click();
      await expect(ntpPage.locator('#data-conflict-list .data-conflict-diff')).toBeVisible();
      await ntpPage.locator('#data-conflict-list .data-conflict-diff input[type="radio"][value="copy"]').first().check();
      await expect(ntpPage.locator('#data-conflict-list .data-conflict-apply-btn')).toBeEnabled();

      // 1) Intermediate autoBackupState update (lastSnapshotTs unchanged) must not wipe panel or selection.
      await sw.evaluate(async () => {
        const cur = (await chrome.storage.local.get('autoBackupState')).autoBackupState;
        await chrome.storage.local.set({
          autoBackupState: {
            ...cur,
            local: {
              ...cur.local,
              status: 'running',
              lastAttemptAt: Date.now(),
            },
          },
        });
      });
      await expect(ntpPage.locator('#local-auto-backup-status-text')).not.toHaveText(activeBadgeText);
      await expect(ntpPage.locator('#data-conflict-list .data-conflict-diff')).toBeVisible();
      await expect(ntpPage.locator('#data-conflict-list .data-conflict-apply-btn')).toBeEnabled();

      // 2) Background backup completes (lastSnapshotTs changes while modal is open): updates Time Machine
      //    snapshots in-place without clearing #data-conflict-list or conflictPanels selection.
      const bgRes = await sw.evaluate(() =>
        (self as any).__boxingBgAutoBackup.runBackgroundLocalAutoBackup({ trigger: 'alarm' }),
      );
      expect(bgRes.ok).toBe(true);
      await expect(ntpPage.locator('#data-snapshot-list .data-snapshot-row')).toHaveCount(2);
      await expect(ntpPage.locator('#data-conflict-list .data-conflict-diff')).toBeVisible();
      await expect(ntpPage.locator('#data-conflict-list .data-conflict-apply-btn')).toBeEnabled();

      expect(downloads).toEqual([]);
      expect(externalRequests).toEqual([]);
    } finally {
      audit.dispose();
      await ctx.close().catch(() => {});
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
