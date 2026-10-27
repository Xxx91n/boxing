// Wave 2026.10.17 Acceptance Specs
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { dismissOnboarding } from '../helpers/onboarding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp/index.html')).href;

async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 10000 }).toBe(true);
  await dismissOnboarding(page);
  await page.waitForTimeout(200);
}

test.describe('Wave 2026.10.17 — Acceptance Tests', () => {
  test.setTimeout(30000);

  // ── Auto-backup decoupling & local silent snapshot ──────────
  test('performBackup does not trigger file download; Backup Now does; demo mode gated', async ({ page }) => {
    // 1. Static contract
    const syncSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/sync-engine.js'), 'utf8');
    const utilsSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/utils.js'), 'utf8');

    expect(syncSrc).not.toContain("if (p === 'local') backupToLocal();");
    expect(syncSrc).toContain("window.__BOXING_DEMO__");
    expect(utilsSrc).toContain("lastBackupAt: Date.now()");

    // 2. Browser runtime contract
    await boot(page);

    const r = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const bxSync = (window as any).__bxSync;

      // Track any click on anchor elements for file download
      let downloadTriggered = false;
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function(this: HTMLAnchorElement) {
        if (this.download) downloadTriggered = true;
        return origClick.apply(this);
      };

      const beforeSnaps = await dbg.listSnapshots();
      const beforeLastBackup = dbg.layout.settings.lastBackupAt || 0;

      // Ensure local mode
      const providerSel = document.getElementById('sync-provider') as HTMLSelectElement;
      if (providerSel) providerSel.value = 'local';

      // Execute performBackup
      await bxSync.performBackup();

      const afterSnaps = await dbg.listSnapshots();
      const afterLastBackup = dbg.layout.settings.lastBackupAt || 0;
      const autoDownloadCalled = downloadTriggered;

      // Now test explicit Backup Now button click
      downloadTriggered = false;
      const backupNowBtn = document.getElementById('backup-now-btn') as HTMLButtonElement;
      if (backupNowBtn) {
        backupNowBtn.click();
      }
      // Wait a tick for async handler
      await new Promise(r => setTimeout(r, 100));
      const explicitDownloadCalled = downloadTriggered;

      // Restore prototype
      HTMLAnchorElement.prototype.click = origClick;

      return {
        autoDownloadCalled,
        explicitDownloadCalled,
        snapshotSaved: afterSnaps.length >= beforeSnaps.length + 1,
        lastBackupUpdated: afterLastBackup >= beforeLastBackup,
      };
    });

    expect(r.autoDownloadCalled).toBe(false);
    expect(r.explicitDownloadCalled).toBe(true);
    expect(r.snapshotSaved).toBe(true);
    expect(r.lastBackupUpdated).toBe(true);
  });

  // ── Version check authority direct connection & UI feedback ──
  test('checkVersionUpdate connects to GitHub API, supports force refresh, and shows low-profile hint', async ({ page }) => {
    // 1. Static contract
    const settingsUiSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/settings-ui.js'), 'utf8');
    const indexSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/index.html'), 'utf8');

    expect(settingsUiSrc).toContain('https://api.github.com/repos/Xxx91n/boxing/releases/latest');
    expect(settingsUiSrc).toContain('version.json');
    expect(settingsUiSrc).toContain('TTL = 2 * 60 * 60 * 1000');
    expect(indexSrc).toContain('id="about-check-update-btn"');
    expect(indexSrc).toContain('id="about-update-hint"');

    // 2. Browser runtime contract
    await boot(page);

    const r = await page.evaluate(async () => {
      const hintEl = document.getElementById('about-update-hint') as HTMLElement;
      const checkBtn = document.getElementById('about-check-update-btn') as HTMLButtonElement;
      const versionEl = document.getElementById('about-version-value') as HTMLElement;

      if (versionEl) versionEl.textContent = 'v2026.10.16';

      // Mock fetch to simulate GitHub Release API returning a newer version
      const origFetch = window.fetch;
      window.fetch = async (url: any, opts: any) => {
        if (typeof url === 'string' && url.includes('api.github.com')) {
          return new Response(JSON.stringify({
            tag_name: 'v2026.10.17',
            name: 'v2026.10.17',
            html_url: 'https://github.com/Xxx91n/boxing/releases/tag/v2026.10.17',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return origFetch(url, opts);
      };

      // Click check updates button
      checkBtn?.click();
      await new Promise(r => setTimeout(r, 200));

      const hasNewVersionHint = hintEl?.textContent?.includes('v2026.10.17');
      const hintLink = hintEl?.querySelector('a')?.href;

      // Mock fetch returning same version (up to date)
      window.fetch = async (url: any, opts: any) => {
        if (typeof url === 'string' && url.includes('api.github.com')) {
          return new Response(JSON.stringify({
            tag_name: 'v2026.10.16',
            name: 'v2026.10.16',
            html_url: 'https://github.com/Xxx91n/boxing/releases/tag/v2026.10.16',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return origFetch(url, opts);
      };

      checkBtn?.click();
      await new Promise(r => setTimeout(r, 200));

      const hasUpToDateText = hintEl?.textContent && !hintEl.textContent.includes('v2026.10.17');

      // Restore fetch
      window.fetch = origFetch;

      return {
        checkBtnExists: Boolean(checkBtn),
        hintElExists: Boolean(hintEl),
        hasNewVersionHint,
        hintLink,
        hasUpToDateText,
      };
    });

    expect(r.checkBtnExists).toBe(true);
    expect(r.hintElExists).toBe(true);
    expect(r.hasNewVersionHint).toBe(true);
    expect(r.hintLink).toBe('https://github.com/Xxx91n/boxing/releases/tag/v2026.10.17');
    expect(r.hasUpToDateText).toBe(true);
  });

  // ── Auto-title rule buttons dark mode & token normalization ───
  test('rule action buttons use CSS classes and design tokens; getComputedStyle runtime verified', async ({ page }) => {
    // 1. Static CSS verification: design-system definitions & settings.css token bindings
    const dsSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/design-system.css'), 'utf8');
    const settingsSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/settings.css'), 'utf8');

    // Token definitions in design-system.css
    expect(dsSrc).toContain('--color-danger:');
    expect(dsSrc).toContain('--color-danger-hover:');
    expect(dsSrc).toContain('--color-hover:');
    expect(dsSrc).toContain('--radius-sm:');

    // Component bindings in settings.css
    expect(settingsSrc).toContain('.rule-action-btn');
    expect(settingsSrc).toContain('.rule-action-btn--delete');
    expect(settingsSrc).toContain('var(--color-surface)');
    expect(settingsSrc).toContain('var(--color-danger)');
    expect(settingsSrc).toContain('var(--color-danger-hover)');
    expect(settingsSrc).not.toContain('rgba(239, 68, 68, 0.15)'); // Bare color banned

    // 2. Browser DOM & getComputedStyle runtime contract
    await boot(page);

    // Open settings modal and navigate to General tab
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings-modal')).toBeVisible();

    // Verify token values and element computed styles in Light Mode
    const lightCheck = await page.evaluate(() => {
      const rootCs = window.getComputedStyle(document.documentElement);
      const tokenDanger = rootCs.getPropertyValue('--color-danger').trim();
      const tokenHover = rootCs.getPropertyValue('--color-hover').trim();
      const tokenRadiusSm = rootCs.getPropertyValue('--radius-sm').trim();
      const tokenDangerHover = rootCs.getPropertyValue('--color-danger-hover').trim();

      const rows = document.querySelectorAll('#auto-title-rules-tbody tr');
      if (!rows.length) return { rowsCount: 0 };

      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];

      const upBtns = document.querySelectorAll('#auto-title-rules-tbody .rule-action-btn');
      const delBtns = document.querySelectorAll('#auto-title-rules-tbody .rule-action-btn--delete');

      const firstUp = firstRow.querySelector('.rule-action-btn') as HTMLButtonElement;
      const firstDown = firstRow.querySelectorAll('.rule-action-btn')[1] as HTMLButtonElement;
      const lastDown = lastRow.querySelectorAll('.rule-action-btn')[1] as HTMLButtonElement;
      const firstDel = firstRow.querySelector('.rule-action-btn--delete') as HTMLButtonElement;
      const checkUpdateBtn = document.getElementById('about-check-update-btn') as HTMLButtonElement;

      const upCs = window.getComputedStyle(firstUp);
      const downCs = window.getComputedStyle(firstDown);
      const delCs = window.getComputedStyle(firstDel);
      const checkUpdateCs = checkUpdateBtn ? window.getComputedStyle(checkUpdateBtn) : null;

      return {
        rowsCount: rows.length,
        btnClassCount: upBtns.length,
        delClassCount: delBtns.length,
        tokenDanger,
        tokenHover,
        tokenRadiusSm,
        tokenDangerHover,
        upColor: upCs.color,
        upRadius: upCs.borderRadius,
        upBg: upCs.backgroundColor,
        downColor: downCs.color,
        delColor: delCs.color,
        delRadius: delCs.borderRadius,
        delBg: delCs.backgroundColor,
        checkUpdateRadius: checkUpdateCs?.borderRadius,
        firstUpDisabled: firstUp?.disabled,
        lastDownDisabled: lastDown?.disabled,
        firstUpAriaLabel: firstUp?.getAttribute('aria-label'),
        firstDelAriaLabel: firstDel?.getAttribute('aria-label'),
        firstUpHasNoInlineColor: !firstUp?.style.cssText.includes('color'),
        firstDelHasNoInlineColor: !firstDel?.style.cssText.includes('color'),
      };
    });

    expect(lightCheck.rowsCount).toBeGreaterThan(0);
    expect(lightCheck.btnClassCount).toBeGreaterThanOrEqual(6);
    expect(lightCheck.delClassCount).toBeGreaterThanOrEqual(2);

    // Tokens defined and non-empty
    expect(lightCheck.tokenDanger).toBeTruthy();
    expect(lightCheck.tokenHover).toBeTruthy();
    expect(lightCheck.tokenRadiusSm).toBe('3px');
    expect(lightCheck.tokenDangerHover).toBeTruthy();

    // Computed styles: border-radius restored to 3px (not 0px)
    expect(lightCheck.upRadius).toBe('3px');
    expect(lightCheck.delRadius).toBe('3px');
    expect(lightCheck.checkUpdateRadius).toBe('3px');

    // Delete color is danger (rgb(153, 27, 27)), NOT ink (rgb(42, 37, 32))
    expect(lightCheck.delColor).not.toBe(lightCheck.upColor);
    expect(lightCheck.delColor).toBe('rgb(153, 27, 27)');

    // Disabled states & a11y labels
    expect(lightCheck.firstUpDisabled).toBe(true);
    expect(lightCheck.lastDownDisabled).toBe(true);
    expect(lightCheck.firstUpAriaLabel).toBeTruthy();
    expect(lightCheck.firstDelAriaLabel).toBeTruthy();
    expect(lightCheck.firstUpHasNoInlineColor).toBe(true);
    expect(lightCheck.firstDelHasNoInlineColor).toBe(true);

    // 3. Hover state visual feedback verification (Ticket 72 / 102: poll for transition 0.15s to settle)
    // Hover on delete button changes background color to --color-danger-hover
    const delBtnLocator = page.locator('#auto-title-rules-tbody .rule-action-btn--delete').first();
    await delBtnLocator.hover();
    await expect.poll(() => page.evaluate(() => {
      const btn = document.querySelector('#auto-title-rules-tbody .rule-action-btn--delete') as HTMLElement;
      return window.getComputedStyle(btn).backgroundColor;
    }), { timeout: 3000 }).not.toBe(lightCheck.delBg);

    // Hover on second button (enabled down arrow) changes background color to --color-hover
    const downBtnLocator = page.locator('#auto-title-rules-tbody tr:first-child .rule-action-btn').nth(1);
    await downBtnLocator.hover();
    await expect.poll(() => page.evaluate(() => {
      const btn = document.querySelector('#auto-title-rules-tbody tr:first-child .rule-action-btn:nth-child(2)') as HTMLElement;
      return window.getComputedStyle(btn).backgroundColor;
    }), { timeout: 3000 }).not.toBe(lightCheck.upBg);

    // 4. Dark mode runtime verification (poll for 0.15s color transition to settle)
    await page.evaluate(() => {
      document.documentElement.classList.add('ntp--dark');
    });

    // Dark mode danger color is #FCA5A5 -> rgb(252, 165, 165)
    await expect.poll(() => page.evaluate(() => {
      const btn = document.querySelector('#auto-title-rules-tbody .rule-action-btn--delete') as HTMLElement;
      return window.getComputedStyle(btn).color;
    }), { timeout: 3000 }).toBe('rgb(252, 165, 165)');

    const darkCheck = await page.evaluate(() => {
      const rootCs = window.getComputedStyle(document.documentElement);
      const firstRow = document.querySelector('#auto-title-rules-tbody tr') as HTMLElement;
      const firstDown = firstRow?.querySelectorAll('.rule-action-btn')[1] as HTMLButtonElement;
      const firstDel = firstRow?.querySelector('.rule-action-btn--delete') as HTMLButtonElement;

      const downCs = window.getComputedStyle(firstDown);
      const delCs = window.getComputedStyle(firstDel);

      const res = {
        tokenDanger: rootCs.getPropertyValue('--color-danger').trim(),
        tokenHover: rootCs.getPropertyValue('--color-hover').trim(),
        downColor: downCs.color,
        delColor: delCs.color,
        delRadius: delCs.borderRadius,
      };
      // Reset dark mode
      document.documentElement.classList.remove('ntp--dark');
      return res;
    });

    expect(darkCheck.delRadius).toBe('3px');
    expect(darkCheck.delColor).not.toBe(darkCheck.downColor);
    expect(darkCheck.delColor).toBe('rgb(252, 165, 165)');
  });

  // ── Snapshot count cap (MAX_SNAPSHOT_COUNT = 30) & FIFO truncation ──
  test('MAX_SNAPSHOT_COUNT = 30 truncates oldest snapshots and removes pruned keys', async ({ page }) => {
    // 1. Static contract verification
    const storageSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/storage.js'), 'utf8');
    expect(storageSrc).toContain('MAX_SNAPSHOT_COUNT = 30');

    const enLocale = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, '_locales/en/messages.json'), 'utf8'));
    const zhLocale = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, '_locales/zh_CN/messages.json'), 'utf8'));
    expect(enLocale.dataHealthHint.message).toContain('30');
    expect(zhLocale.dataHealthHint.message).toContain('30');

    // 2. Browser runtime rotation test: week-spaced seed ensures GFS keeps > 30 entries
    // so that the MAX_SNAPSHOT_COUNT = 30 cap loop actually executes and prunes surplus entries.
    await boot(page);

    const r = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const prefix = 'snap.v1.';
      const indexKey = 'snap.v1.index';
      const DAY_MS = 86400000;

      // Seed 36 snapshots spaced 8 days apart:
      // Spacing 8 days apart ensures every entry falls into a distinct weekly bucket
      // under GFS rotation (weeklyBucket = Math.floor(ts / (7 * DAY_MS))), preventing
      // pre-cap deduplication from shrinking the list below 30.
      const now = Date.now();
      const tsList: number[] = [];
      for (let i = 36; i >= 1; i--) {
        tsList.push(now - i * 8 * DAY_MS);
      }

      const mkBody = (ts: number) => ({
        ts, schemaVersion: 3,
        data: { version: 3.5, boxes: [{ id: 'L1', type: 'large', title: 'S' + ts, x: 0, y: 0, width: 320, height: 220, children: [] }], nextLargeIndex: 2, settings: {} },
      });

      const seed: Record<string, unknown> = {
        [indexKey]: tsList.map(ts => ({ ts, schemaVersion: 3, size: 500 })),
      };
      for (const ts of tsList) seed[prefix + ts] = mkBody(ts);

      await dbg.storageSet(seed);

      // Now save a new snapshot at 'now', which appends the 37th entry and triggers rotation
      await dbg.saveSnapshot();

      const list = await dbg.listSnapshots();
      const all = await dbg.storageGet(null);
      const bodyKeys = Object.keys(all).filter(k => k.startsWith(prefix) && k !== indexKey);

      // Verify oldest 7 entries (tsList[0] to tsList[6]) are pruned from storage
      const prunedTsList = tsList.slice(0, 7);
      const prunedKeysExist = prunedTsList.map(ts => bodyKeys.includes(prefix + ts));

      // Verify the RAW_KEEP_FLOOR (newest 10 entries) remain intact
      const floorTsList = tsList.slice(tsList.length - 9); // 9 newest seeded + 1 newly saved
      const floorRetained = floorTsList.every(ts => list.some((e: any) => e.ts === ts));

      return {
        count: list.length,
        bodyCount: bodyKeys.length,
        prunedKeysExist,
        floorRetained,
        bodiesMatchIndex: bodyKeys.length === list.length && bodyKeys.every(k => list.some((e: any) => prefix + e.ts === k)),
      };
    });

    // Exact count verification (37 items -> cap to exactly 30)
    expect(r.count).toBe(30);
    expect(r.bodyCount).toBe(30);

    // Oldest 7 entries pruned from storage: physical keys must not exist
    for (let i = 0; i < 7; i++) {
      expect(r.prunedKeysExist[i]).toBe(false);
    }

    // RAW_KEEP_FLOOR = 10 intact
    expect(r.floorRetained).toBe(true);

    // Every body key in storage corresponds to an entry in snap.v1.index
    expect(r.bodiesMatchIndex).toBe(true);
  });
});
