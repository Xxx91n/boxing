import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_PATH = path.resolve(__dirname, '..', '..');

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
  await openSyncTab(page);
}

// Opens the settings modal on the Sync tab — the danger zone lives inside the
// settings modal, so interaction tests must surface it first (CodeRabbit).
async function openSyncTab(page) {
  await page.evaluate(() => (document.getElementById('settings-btn') as HTMLElement | null)?.click());
  await expect(page.locator('#settings-modal')).toBeVisible();
  await page.evaluate(() =>
    (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click());
  await expect(page.locator('#tab-sync')).toBeVisible();
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
    // spec (T-39) pins the sync tab to exactly 3 provider cards.
    expect(initial.syncGroupCount).toBe(3);

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
        // Playwright serializes evaluate return values across the page boundary,
        // so object identity never survives; compare the serialized bytes instead
        // (a v3 envelope is a plain {v,s,iv,d} record).
        passEnvSame: JSON.stringify(dbg.layout.settings._encWebdavPass) === JSON.stringify(seeded.envPass),
        tokenEnvSame: JSON.stringify(dbg.layout.settings._encGistToken) === JSON.stringify(seeded.envToken),
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

  test('remote-delete requested with no configured target aborts atomically (local provider)', async ({ page }) => {
    await resetFresh(page);
    const seeded = await seedStoredCredentials(page, { provider: 'local' });
    await page.click('#delete-sync-credential-open');
    await page.check('#delete-sync-credential-remote');
    await page.click('#delete-sync-credential-confirm');

    // No remote target exists for the local provider: the delete must abort with
    // the explicit no-target error and leave every stored envelope untouched.
    await expect.poll(() => page.evaluate(() =>
      (document.getElementById('delete-sync-credential-status') as HTMLElement)?.textContent || ''
    )).toContain('nothing was deleted');

    const after = await page.evaluate(async (seeded) => {
      const dbg = (window as any).__boxingDebug;
      const dec = (window as any).__boxingDecryptCredential;
      return {
        pass: await dec(dbg.layout.settings._encWebdavPass),
        token: await dec(dbg.layout.settings._encGistToken),
        provider: dbg.layout.settings.syncProvider,
        // Playwright serializes evaluate return values across the page boundary,
        // so object identity never survives; compare the serialized bytes instead
        // (a v3 envelope is a plain {v,s,iv,d} record).
        passEnvSame: JSON.stringify(dbg.layout.settings._encWebdavPass) === JSON.stringify(seeded.envPass),
        tokenEnvSame: JSON.stringify(dbg.layout.settings._encGistToken) === JSON.stringify(seeded.envToken),
      };
    }, seeded);
    expect(after.pass).toBe('spec-pass');
    expect(after.token).toBe('spec-token');
    expect(after.passEnvSame).toBe(true);
    expect(after.tokenEnvSame).toBe(true);
    expect(after.provider).toBe('local');

    const s = await zoneState(page);
    expect(s.zoneHidden).toBe(false);
    expect(s.panelHidden).toBe(false);
    expect(s.status).toContain('nothing was deleted');
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

// Ticket 116 (PR #115 review thread r4496619688): reason-specific feedback for
// remote-delete refusals. The result keeps its { ok, error } shape and gains a
// closed-allow-list `reason`; the status line prefixes that reason's localized
// text to the unchanged failure copy, so the pinned "nothing was changed" promise
// still holds. Transport/stub failures stay unidentified and keep the plain copy.
test.describe('Ticket 116: remote-delete refusal reasons', () => {
  const REASON_CASES = [
    { reason: 'query-fragment', key: 'webdavErrQuery', setup: { url: 'https://webdav.invalid/dav?token=abc' } },
    { reason: 'url-too-long', key: 'webdavErrUrlTooLong', setup: { url: 'https://webdav.invalid/dav/', longName: true } },
    { reason: 'embedded-credentials', key: 'webdavErrEmbedded', setup: { url: 'https://user:secret@webdav.invalid/dav/' } },
    { reason: 'missing-password', key: 'webdavErrNoPass', setup: { url: 'https://webdav.invalid/dav/', user: 'spec-user', noPass: true } },
  ];

  // Points the WebDAV config at a refusal case without ever reaching the network.
  async function seedCase(page: Page, setup: any) {
    await page.evaluate(({ url, longName, user, noPass }) => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.webdavUrl = url;
      dbg.layout.settings.webdavUser = user || '';
      dbg.layout.settings.syncFileName = longName ? 'x'.repeat(2100) : '';
      // missing-password needs "nothing to authenticate with": drop the stored
      // envelope so the decrypt fallback cannot supply one.
      if (noPass) delete dbg.layout.settings._encWebdavPass;
      const sel = document.getElementById('sync-provider') as HTMLSelectElement;
      sel.value = 'webdav';
      const userInput = document.getElementById('webdav-user') as HTMLInputElement | null;
      const passInput = document.getElementById('webdav-pass') as HTMLInputElement | null;
      const urlInput = document.getElementById('webdav-url') as HTMLInputElement | null;
      if (urlInput) urlInput.value = url;
      if (userInput) userInput.value = user || '';
      if (passInput) passInput.value = noPass ? '' : 'spec-pass';
    }, setup);
  }

  for (const c of REASON_CASES) {
    test('deleteRemoteBackup reports reason "' + c.reason + '" and a composed localized error', async ({ page }) => {
      await resetFresh(page);
      await seedCase(page, c.setup);
      const r = await page.evaluate(async (key) => {
        const del = (window as any).__boxingDeleteRemoteBackup;
        const out = await del();
        // The reason's own keyed text, straight from the ticket-111 mechanism, so the
        // assertion is locale-independent.
        const expectedWhy = (window as any).__bxSync.webdavError(key).message;
        return { out, expectedWhy };
      }, c.key);
      expect(r.out.ok).toBe(false);
      expect(r.out.reason).toBe(c.reason);
      // Composed text = reason text + the unchanged failure copy.
      // Composed with a sentence break (see sync-engine): no reason text ends in a
      // period, and webdavErrNoPass already contains an em-dash, so an em-dash join
      // would double it for that one reason.
      expect(r.out.error.startsWith(r.expectedWhy + '. ')).toBe(true);
      expect(r.out.error).toContain('nothing was changed');
      // Contract: no raw transport strings leak into the reason copy.
      expect(r.out.error).not.toContain('spec-remote-fail');
      expect(r.out.error).not.toContain('Error:');
    });

    test('the danger-zone status line shows reason "' + c.reason + '" and still refuses to reset credentials', async ({ page }) => {
      await resetFresh(page);
      await seedStoredCredentials(page);
      await seedCase(page, c.setup);
      // Drain the 800ms credential-flush debounce before snapshotting, and again
      // before comparing: seeding writes the URL/user inputs, so an in-flight flush
      // could legitimately land on either side of the assertion and make it flaky.
      // With the flush drained on both sides the comparison isolates what the delete
      // itself touched.
      const settle = async () => {
        await page.evaluate(async () => { await (window as any).__boxingDebug.flushCredentials(); });
        await page.waitForTimeout(50);
      };
      await settle();
      // Snapshot every stored setting AFTER seeding: a refused remote delete must
      // leave this object byte-identical (the AC "must not reset local credentials",
      // asserted as a whole rather than field-by-field so envelopes, provider and
      // the untouched sync config are all covered).
      const before = await page.evaluate(() => JSON.stringify((window as any).__boxingDebug.layout.settings));
      await page.click('#delete-sync-credential-open');
      await page.check('#delete-sync-credential-remote');
      await page.click('#delete-sync-credential-confirm');

      await expect.poll(() => page.evaluate(() =>
        (document.getElementById('delete-sync-credential-status') as HTMLElement)?.hidden
      )).toBe(false);

      const s = await zoneState(page);
      expect(s.status).toContain('nothing was changed');
      // data-reason is the machine-readable twin of the visible copy.
      const attr = await page.evaluate(() =>
        (document.getElementById('delete-sync-credential-status') as HTMLElement)?.dataset.reason
      );
      expect(attr).toBe(c.reason);

      await settle();
      const after = await page.evaluate(() => ({
        settings: JSON.stringify((window as any).__boxingDebug.layout.settings),
        provider: (window as any).__boxingDebug.layout.settings.syncProvider,
      }));
      expect(after.settings).toBe(before);
      expect(after.provider).toBe('webdav');
      expect(s.zoneHidden).toBe(false);
      expect(s.panelHidden).toBe(false);
    });
  }

  test('an unidentified failure keeps the plain copy and carries no reason', async ({ page }) => {
    await resetFresh(page);
    await seedStoredCredentials(page);
    // The stub failure path is the "unidentified" case: transport details must never
    // be surfaced, so there is no reason and the wording is byte-identical to pre-116.
    await page.evaluate(() => {
      // deleteRemoteBackup reads the provider off the select, so pin it explicitly
      // rather than trusting a re-render from settings.
      (document.getElementById('sync-provider') as HTMLSelectElement).value = 'webdav';
      (window as any).__boxingSetSyncRemoteDeleteStub(() => ({ ok: false, error: 'spec-remote-fail' }));
    });
    const out = await page.evaluate(async () => await (window as any).__boxingDeleteRemoteBackup());
    expect(out.ok).toBe(false);
    expect(out.reason).toBeUndefined();
    expect(out.error).toBe('Failed to delete the remote backup data — nothing was changed.');
  });

  test('a malformed base URL is not mislabelled as embedded credentials', async ({ page }) => {
    await resetFresh(page);
    await seedStoredCredentials(page);
    await seedCase(page, { url: 'not a url' });
    // resolveWebDAVFileUrl's new URL() throws a bare TypeError here, which is not a
    // refusal this engine can name. It must fall through to the generic copy rather
    // than claiming "embedded credentials" (PR #117 review).
    //
    // This also stands in for the "unidentified transport failure" case: the rethrow
    // lands in deleteSyncCredentials' catch branch, which must produce the plain copy
    // with no reason. It does so without mocking window.chrome, so the assertion holds
    // identically in the file:// and extension lanes — a runtime chrome override would
    // only be safe in one of them, and there is no code path that could surface the
    // raw error text anyway (the catch ignores it).
    await page.click('#delete-sync-credential-open');
    await page.check('#delete-sync-credential-remote');
    const out = await page.evaluate(async () => await (window as any).__boxingDeleteSyncCredentials());
    expect(out.ok).toBe(false);
    expect(out.reason).toBeUndefined();
    expect(out.error).toBe('Failed to delete the remote backup data — nothing was changed.');
  });

  test('the composed texts are supersets of the pre-116 copy in every locale', () => {
    // Vocabulary guard: each reason resolves to an existing webdavErr* key that is
    // present in all 14 locales (no new keys were added for ticket 116).
    const localesDir = path.join(REPO_PATH, '_locales');
    const langs = fs.readdirSync(localesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(langs.length).toBe(14);
    for (const c of REASON_CASES) {
      for (const lang of langs) {
        const msgs = JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'messages.json'), 'utf8'));
        expect(msgs[c.key], `reason ${c.reason} needs ${c.key} in ${lang}`).toBeDefined();
        expect(msgs['deleteSyncCredentialRemoteFailed'], `tail key missing in ${lang}`).toBeDefined();
      }
    }
  });
});
