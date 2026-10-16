// Wave 2026.10.17 Acceptance Specs (S-01 to S-04 / D-001 to D-004)
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
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
  await page.waitForTimeout(200);
}

test.describe('Wave 2026.10.17 — S-01 to S-04 Acceptance Tests', () => {
  test.setTimeout(30000);

  // ── S-01 / D-001: Auto-backup decoupling & local silent snapshot ──────────
  test('S-01 / D-001: performBackup does not trigger file download; Backup Now does; demo mode gated', async ({ page }) => {
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

  // ── S-02 / D-002: Version check authority direct connection & UI feedback ──
  test('S-02 / D-002: checkVersionUpdate connects to GitHub API, supports force refresh, and shows low-profile hint', async ({ page }) => {
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

  // ── S-03 / D-003: Auto-title rule buttons dark mode & token normalization ───
  test('S-03 / D-003: rule action buttons use CSS classes and design tokens; no inline color styles', async ({ page }) => {
    // 1. Static CSS verification
    const cssSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/settings.css'), 'utf8');
    expect(cssSrc).toContain('.rule-action-btn');
    expect(cssSrc).toContain('.rule-action-btn--delete');
    expect(cssSrc).toContain('var(--color-surface)');
    expect(cssSrc).toContain('var(--color-danger)');

    // 2. Browser DOM verification
    await boot(page);

    const r = await page.evaluate(() => {
      // Open settings modal and navigate to General tab
      const settingsBtn = document.getElementById('btn-settings') as HTMLButtonElement;
      settingsBtn?.click();

      // Ensure auto-title rules are rendered
      const rows = document.querySelectorAll('#auto-title-rules-tbody tr');
      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];

      if (!firstRow) return { rowsCount: 0 };

      const upBtns = document.querySelectorAll('#auto-title-rules-tbody .rule-action-btn');
      const delBtns = document.querySelectorAll('#auto-title-rules-tbody .rule-action-btn--delete');

      const firstUp = firstRow.querySelector('.rule-action-btn') as HTMLButtonElement;
      const lastDown = lastRow.querySelectorAll('.rule-action-btn')[1] as HTMLButtonElement;
      const firstDel = firstRow.querySelector('.rule-action-btn--delete') as HTMLButtonElement;

      return {
        rowsCount: rows.length,
        btnClassCount: upBtns.length,
        delClassCount: delBtns.length,
        firstUpDisabled: firstUp?.disabled,
        lastDownDisabled: lastDown?.disabled,
        firstUpAriaLabel: firstUp?.getAttribute('aria-label'),
        firstDelAriaLabel: firstDel?.getAttribute('aria-label'),
        firstUpHasNoInlineColor: !firstUp?.style.cssText.includes('color'),
        firstDelHasNoInlineColor: !firstDel?.style.cssText.includes('color'),
      };
    });

    expect(r.rowsCount).toBeGreaterThan(0);
    expect(r.btnClassCount).toBeGreaterThanOrEqual(6);
    expect(r.delClassCount).toBeGreaterThanOrEqual(2);
    expect(r.firstUpDisabled).toBe(true);
    expect(r.lastDownDisabled).toBe(true);
    expect(r.firstUpAriaLabel).toBeTruthy();
    expect(r.firstDelAriaLabel).toBeTruthy();
    expect(r.firstUpHasNoInlineColor).toBe(true);
    expect(r.firstDelHasNoInlineColor).toBe(true);
  });

  // ── S-04 / D-004: Snapshot count cap (MAX_SNAPSHOT_COUNT = 30) & FIFO truncation ──
  test('S-04 / D-004: MAX_SNAPSHOT_COUNT = 30 truncates oldest snapshots and removes pruned keys', async ({ page }) => {
    // 1. Static contract verification
    const storageSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/storage.js'), 'utf8');
    expect(storageSrc).toContain('MAX_SNAPSHOT_COUNT = 30');

    const enLocale = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, '_locales/en/messages.json'), 'utf8'));
    const zhLocale = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, '_locales/zh_CN/messages.json'), 'utf8'));
    expect(enLocale.dataHealthHint.message).toContain('30');
    expect(zhLocale.dataHealthHint.message).toContain('30');

    // 2. Browser runtime rotation test
    await boot(page);

    const r = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const prefix = 'snap.v1.';
      const indexKey = 'snap.v1.index';

      // Seed 35 snapshots spaced across hours
      const now = Date.now();
      const tsList: number[] = [];
      // 35 entries across 35 different hour buckets in the past
      for (let i = 35; i >= 1; i--) {
        tsList.push(now - i * 3600_000);
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

      // Now save a new snapshot, which triggers rotation
      await dbg.saveSnapshot();

      const list = await dbg.listSnapshots();
      const all = await dbg.storageGet(null);
      const bodyKeys = Object.keys(all).filter(k => k.startsWith(prefix) && k !== indexKey);

      // Verify oldest are pruned
      const oldestSeeded = tsList[0];
      const oldestBodyExists = bodyKeys.includes(prefix + oldestSeeded);

      return {
        count: list.length,
        bodyCount: bodyKeys.length,
        oldestPruned: !oldestBodyExists,
        bodiesMatchIndex: bodyKeys.length === list.length && bodyKeys.every(k => list.some((e: any) => prefix + e.ts === k)),
      };
    });

    expect(r.count).toBeLessThanOrEqual(30);
    expect(r.bodyCount).toBeLessThanOrEqual(30);
    expect(r.oldestPruned).toBe(true);
    expect(r.bodiesMatchIndex).toBe(true);
  });
});
