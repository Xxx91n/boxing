import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

// Ticket 99 (T13): delete stored sync credentials entry.
// The danger zone appears only while a stored credential envelope exists, uses a
// two-step confirm (open panel -> explicit delete), optionally deletes remote
// backup data (stubbed — the file:// lane must not hit the network), and resets
// the local sync config atomically: a remote failure leaves every stored byte
// untouched. Local bookmarks and boxes are never part of the deletion.

async function resetFresh(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
  await expect.poll(() => page.evaluate(() =>
    typeof (window as any).__boxingEncryptCredential === 'function' &&
    typeof (window as any).__boxingDeleteSyncCredentials === 'function' &&
    typeof (window as any).__boxingSetSyncRemoteDeleteStub === 'function'
  )).toBe(true);
}

// Seeds both credential envelopes and returns their ciphertexts so tests can
// verify the exact stored bytes survive (cancel) or disappear (confirm).
async function seedStoredCredentials(page, { provider = 'webdav' } = {}) {
  return page.evaluate(async ({ provider }) => {
    const dbg = (window as any).__boxingDebug;
    const enc = (window as any).__boxingEncryptCredential;
    const envPass = await enc('spec-pass');
    const envToken = await enc('spec-token');
    dbg.layout.settings.syncProvider = provider;
    dbg.layout.settings.webdavUrl = 'https://webdav.invalid/dav/';
    dbg.layout.settings.webdavUser = 'spec-user';
    dbg.layout.settings._encWebdavPass = envPass;
    dbg.layout.settings.gistId = 'spec-gist-id';
    dbg.layout.settings._encGistToken = envToken;
    // A box that must survive every delete path.
    dbg.layout.groups = [{ id: 'keep-me', name: 'Keep me', children: [] }];
    // Refresh the danger-zone visibility decision (it tracks stored envelopes).
    const sel = document.getElementById('sync-provider');
    if (sel) { sel.value = provider; sel.dispatchEvent(new Event('change')); }
    return { envPass, envToken };
  }, { provider });
}

function zoneState(page) {
  return page.evaluate(() => {
    const zone = document.getElementById('sync-credential-danger-zone');
    const open = document.getElementById('delete-sync-credential-open');
    const panel = document.getElementById('delete-sync-credential-panel');
    return {
      zoneHidden: zone ? zone.hidden : null,
      openHidden: open ? open.hidden : null,
      panelHidden: panel ? panel.hidden : null,
      syncGroupCount: document.querySelectorAll('#remote-backup-zone .sync-group, #sync-credential-danger-zone .sync-group').length,
      provider: (document.getElementById('sync-provider') as HTMLSelectElement)?.value,
      status: document.getElementById('delete-sync-credential-status')?.textContent || '',
      statusHidden: document.getElementById('delete-sync-credential-status')?.hidden,
    };
  });
}

test.describe('Ticket 99 T13: delete stored sync credentials entry', () => {
  test('danger zone is hidden without stored credentials and appears when envelopes exist', async ({ page }) => {
    await resetFresh(page);
    const initial = await zoneState(page);
    expect(initial.zoneHidden).toBe(true);
    // The danger zone is deliberately NOT a .sync-group card — the UI grouping
    // spec (T-39) pins the sync tab to exactly 3 groups.
    expect(initial.syncGroupCount).toBe(0);

    const seeded = await seedStoredCredentials(page);
    const visible = await zoneState(page);
    expect(visible.zoneHidden).toBe(false);
    expect(visible.openHidden).toBe(false);
    expect(visible.panelHidden).toBe(true);
    expect(seeded.envPass).toBeTruthy();
    expect(seeded.envToken).toBeTruthy();

    // The zone must stay reachable even after the provider is switched back to
    // local (D5 keeps the envelopes in that case — they still need a delete path).
    await page.evaluate(() => {
      const sel = document.getElementById('sync-provider') as HTMLSelectElement;
      sel.value = 'local';
      sel.dispatchEvent(new Event('change'));
    });
    const switched = await zoneState(page);
    expect(switched.provider).toBe('local');
    expect(switched.zoneHidden).toBe(false);
  });

  test('cancel keeps every stored envelope and hides the panel', async ({ page }) => {
    await resetFresh(page);
    const seeded = await seedStoredCredentials(page);
    await page.click('#delete-sync-credential-open');
    let s = await zoneState(page);
    expect(s.panelHidden).toBe(false);
    expect(s.openHidden).toBe(true);

    await page.click('#delete-sync-credential-cancel');
    s = await zoneState(page);
    expect(s.panelHidden).toBe(true);
    expect(s.openHidden).toBe(false);
    expect(s.statusHidden).toBe(true);

    const kept = await page.evaluate(async (seeded) => {
      const dbg = (window as any).__boxingDebug;
      const dec = (window as any).__boxingDecryptCredential;
      return {
        pass: await dec(dbg.layout.settings._encWebdavPass),
        token: await dec(dbg.layout.settings._encGistToken),
        provider: dbg.layout.settings.syncProvider,
      };
    }, seeded);
    expect(kept.pass).toBe('spec-pass');
    expect(kept.token).toBe('spec-token');
    expect(kept.provider).toBe('webdav');
  });

  test('confirm without remote delete clears local credentials only, keeps bookmarks', async ({ page }) => {
    await resetFresh(page);
    await seedStoredCredentials(page);
    await page.click('#delete-sync-credential-open');
    await page.click('#delete-sync-credential-confirm');

    // The delete flow is async (remote stub / storage persist); wait for the
    // success status before asserting the cleared state.
    await expect.poll(() => page.evaluate(() =>
      (document.getElementById('delete-sync-credential-status') as HTMLElement)?.hidden
    )).toBe(false);

    const after = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return {
        envPass: dbg.layout.settings._encWebdavPass,
        envToken: dbg.layout.settings._encGistToken,
        webdavUrl: dbg.layout.settings.webdavUrl,
        webdavUser: dbg.layout.settings.webdavUser,
        gistId: dbg.layout.settings.gistId,
        provider: dbg.layout.settings.syncProvider,
        groups: dbg.layout.groups,
      };
    });
    expect(after.envPass).toBeUndefined();
    expect(after.envToken).toBeUndefined();
    expect(after.webdavUrl).toBeUndefined();
    expect(after.webdavUser).toBeUndefined();
    expect(after.gistId).toBeUndefined();
    expect(after.provider).toBe('local');
    // Bookmarks / boxes untouched.
    expect(after.groups).toEqual([{ id: 'keep-me', name: 'Keep me', children: [] }]);

    const s = await zoneState(page);
    expect(s.zoneHidden).toBe(true);
    expect(s.statusHidden).toBe(false);
    expect(s.status).toContain('deleted');
  });

  test('remote-delete failure aborts the deletion atomically (nothing changed)', async ({ page }) => {
    await resetFresh(page);
    const seeded = await seedStoredCredentials(page);
    await page.evaluate(() => {
      (window as any).__boxingSetSyncRemoteDeleteStub(() => ({ ok: false, error: 'spec-remote-fail' }));
    });
    await page.click('#delete-sync-credential-open');
    await page.check('#delete-sync-credential-remote');
    await page.click('#delete-sync-credential-confirm');

    // Wait for the failure status — the remote stub rejects and the local state
    // must remain exactly as seeded.
    await expect.poll(() => page.evaluate(() =>
      (document.getElementById('delete-sync-credential-status') as HTMLElement)?.textContent || ''
    )).toContain('nothing was changed');

    const after = await page.evaluate(async (seeded) => {
      const dbg = (window as any).__boxingDebug;
      const dec = (window as any).__boxingDecryptCredential;
      return {
        pass: await dec(dbg.layout.settings._encWebdavPass),
        token: await dec(dbg.layout.settings._encGistToken),
        provider: dbg.layout.settings.syncProvider,
        passEnvSame: dbg.layout.settings._encWebdavPass === seeded.envPass,
        tokenEnvSame: dbg.layout.settings._encGistToken === seeded.envToken,
      };
    }, seeded);
    expect(after.pass).toBe('spec-pass');
    expect(after.token).toBe('spec-token');
    expect(after.passEnvSame).toBe(true);
    expect(after.tokenEnvSame).toBe(true);
    expect(after.provider).toBe('webdav');

    const s = await zoneState(page);
    expect(s.zoneHidden).toBe(false);
    expect(s.panelHidden).toBe(false);
    expect(s.statusHidden).toBe(false);
    expect(s.status).toContain('nothing was changed');
  });

  test('remote-delete success with a gist provider clears local state and reports the provider', async ({ page }) => {
    await resetFresh(page);
    await seedStoredCredentials(page, { provider: 'gist' });
    const calls: string[] = [];
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as any).__boxingSetSyncRemoteDeleteStub((provider: string) => { seen.push(provider); return { ok: true }; });
      (window as any).__boxingDebug.seenRemoteDeleteCalls = seen;
    });
    await page.click('#delete-sync-credential-open');
    await page.check('#delete-sync-credential-remote');
    await page.click('#delete-sync-credential-confirm');

    // Wait for the success status before reading the cleared state.
    await expect.poll(() => page.evaluate(() =>
      (document.getElementById('delete-sync-credential-status') as HTMLElement)?.hidden
    )).toBe(false);

    const after = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return {
        calls: (dbg as any).seenRemoteDeleteCalls,
        envPass: dbg.layout.settings._encWebdavPass,
        envToken: dbg.layout.settings._encGistToken,
        provider: dbg.layout.settings.syncProvider,
      };
    });
    expect(after.calls).toEqual(['gist']);
    expect(after.envPass).toBeUndefined();
    expect(after.envToken).toBeUndefined();
    expect(after.provider).toBe('local');
  });
});
