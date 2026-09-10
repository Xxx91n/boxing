import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

// Ticket 04 / T-39 (sync-ui): the Sync & Backup tab must visually separate the
// provider-agnostic "Shared settings" card from the WebDAV and GitHub Gist
// provider cards, and the provider mutex driven by sync-engine.js must never
// surface both provider configs at once. Local provider hides the whole
// remote-backup-zone. These are presentation/contract assertions on the file://
// lane — provider switching is pure DOM hidden-toggling, so a benign mock runtime
// (mirroring boxing-webdav.spec.ts) is enough; no real WebDAV traffic is exercised.
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
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
}

async function openSyncTab(page) {
  await page.evaluate(() => document.getElementById('settings-btn')?.click());
  await expect(page.locator('#settings-modal')).toBeVisible();
  await page.locator('.settings-nav__item[data-tab="sync"]').click();
  await expect(page.locator('#tab-sync')).toBeVisible();
}

test.describe('Boxing Sync UI grouping (T-39 / 04-sync-ui)', () => {

  // Acceptance #1 (visual grouping): three titled cards exist — Shared,
  // WebDAV, Gist. Counts are DOM-based so they hold even before a provider is
  // picked (when the zone is still hidden).
  test('Shared / WebDAV / Gist are visually grouped with titled cards', async ({ page }) => {
    await bootWithMockRuntime(page, () => ({ success: true, status: 207, ok: true }));
    await resetBoxing(page);
    await openSyncTab(page);
    await expect(page.locator('#tab-sync .sync-group')).toHaveCount(3);
    await expect(page.locator('#tab-sync .sync-group__title')).toHaveCount(3);
    await expect(page.locator('#webdav-config.sync-group')).toHaveCount(1);
    await expect(page.locator('#gist-config.sync-group')).toHaveCount(1);
  });

  // Acceptance #1 + #2: WebDAV reveals the Shared card + WebDAV card, hides Gist.
  test('WebDAV provider shows Shared + WebDAV cards and hides Gist (mutex)', async ({ page }) => {
    await bootWithMockRuntime(page, () => ({ success: true, status: 207, ok: true }));
    await resetBoxing(page);
    await openSyncTab(page);
    await page.locator('#sync-provider').selectOption('webdav');
    await expect(page.locator('#remote-backup-zone')).toBeVisible();
    // Shared (provider-agnostic) fields are visible under WebDAV.
    await expect(page.locator('#sync-level-select')).toBeVisible();
    await expect(page.locator('#sync-filename-input')).toBeVisible();
    await expect(page.locator('#auto-backup-interval')).toBeVisible();
    await expect(page.locator('#backup-now-btn')).toBeVisible();
    // WebDAV provider card visible, Gist provider card hidden.
    await expect(page.locator('#webdav-config')).toBeVisible();
    await expect(page.locator('#gist-config')).toBeHidden();
    await expect(page.locator('#webdav-url')).toBeVisible();
  });

  test('Gist provider shows Shared + Gist cards and hides WebDAV (mutex)', async ({ page }) => {
    await bootWithMockRuntime(page, () => ({ success: true, status: 207, ok: true }));
    await resetBoxing(page);
    await openSyncTab(page);
    await page.locator('#sync-provider').selectOption('gist');
    await expect(page.locator('#remote-backup-zone')).toBeVisible();
    await expect(page.locator('#gist-config')).toBeVisible();
    await expect(page.locator('#webdav-config')).toBeHidden();
    await expect(page.locator('#gist-token')).toBeVisible();
  });

  // Acceptance #2 (Playwright mutex assert): switching provider never shows both.
  test('Switching provider never shows both WebDAV and Gist configs', async ({ page }) => {
    await bootWithMockRuntime(page, () => ({ success: true, status: 207, ok: true }));
    await resetBoxing(page);
    await openSyncTab(page);
    for (const prov of ['webdav', 'gist', 'webdav', 'gist', 'local', 'gist', 'webdav']) {
      await page.locator('#sync-provider').selectOption(prov);
      const webdavVisible = await page.locator('#webdav-config').isVisible();
      const gistVisible = await page.locator('#gist-config').isVisible();
      expect(webdavVisible && gistVisible).toBe(false);
    }
  });

  // Acceptance #3: local provider hides the remote-backup-zone entirely.
  test('Local provider hides the remote-backup-zone entirely', async ({ page }) => {
    await bootWithMockRuntime(page, () => ({ success: true, status: 207, ok: true }));
    await resetBoxing(page);
    await openSyncTab(page);
    await page.locator('#sync-provider').selectOption('local');
    await expect(page.locator('#remote-backup-zone')).toBeHidden();
    await expect(page.locator('#webdav-config')).toBeHidden();
    await expect(page.locator('#gist-config')).toBeHidden();
  });

});
