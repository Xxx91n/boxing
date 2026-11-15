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
});

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

    const downloads: string[] = [];
    const externalRequests: string[] = [];
    ctx.on('page', (p) => {
      p.on('download', (d) => downloads.push(d.suggestedFilename()));
      p.on('request', (req) => {
        const u = req.url();
        if (u.startsWith('http://') || u.startsWith('https://')) externalRequests.push(u);
      });
    });

    try {
      const keeperPage = await ctx.newPage();
      await keeperPage.goto('about:blank');

      const ntpPage = await ctx.newPage();
      await ntpPage.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect
        .poll(() => ntpPage.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout)), { timeout: 30000 })
        .toBe(true);
      await dismissOnboarding(ntpPage);

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
        dbg.layout.settings.syncProvider = 'webdav';
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
        .poll(async () => (await readAutoBackupStateFromPage(ntpPage)).optIn, { timeout: 15000 })
        .toBe(true);
      await expect(ntpPage.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'active');

      const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
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
      await ctx.close().catch(() => {});
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
