import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

// Ticket 95 (credential sweep): NO real credentials in source. These placeholders
// never hit the network; a staging account can be injected via BOXING_SPEC_WEBDAV_*
// env vars (91R pattern), same as boxing-memory.spec.ts.
const WEBDAV_URL = process.env.BOXING_SPEC_WEBDAV_URL || 'https://webdav.invalid/dav/';
const WEBDAV_USER = process.env.BOXING_SPEC_WEBDAV_USER || 'spec-user';

// Ticket 81 / spec D5 (finding V-08): the synchronous credential flush must only write
// envelopes for secrets that actually changed, must keep stored envelopes when the
// secret inputs are empty (URL/user edits, decrypt still in flight), and must not
// re-encrypt an unchanged secret on every flush. These tests assert storage behavior
// (envelope presence / plaintext round-trip), not internal function names.

async function resetFresh(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
  await expect.poll(() => page.evaluate(() =>
    typeof (window as any).__boxingEncryptCredential === 'function' &&
    typeof (window as any).__boxingDecryptCredential === 'function' &&
    typeof (window as any).__boxingFlushCredentials === 'function'
  )).toBe(true);
}

test.describe('Ticket 81 D5: credential flush keeps stored envelopes ', () => {
  test('URL/user-only edits with empty secret inputs keep the stored envelopes', async ({ page }) => {
    await resetFresh(page);
    // Seed a stored sync config whose secrets were never filled into the inputs
    // (cleared password box / decrypt never populated the field).
    const seeded = await page.evaluate(async ({ url, user }) => {
      const dbg = (window as any).__boxingDebug;
      const enc = (window as any).__boxingEncryptCredential;
      dbg.layout.settings.webdavUrl = 'https://old.invalid/dav/';
      dbg.layout.settings.webdavUser = 'old-user';
      dbg.layout.settings._encWebdavPass = await enc('spec-pass');
      dbg.layout.settings._encGistToken = await enc('spec-token');
      const urlInput = document.getElementById('webdav-url');
      const userInput = document.getElementById('webdav-user');
      const passInput = document.getElementById('webdav-pass');
      const gistInput = document.getElementById('gist-token');
      if (urlInput) urlInput.value = url;
      if (userInput) userInput.value = user;
      if (passInput) passInput.value = '';
      if (gistInput) gistInput.value = '';
      const modal = document.getElementById('settings-modal');
      if (modal) modal.hidden = false;
      return { envPass: dbg.layout.settings._encWebdavPass, envToken: dbg.layout.settings._encGistToken };
    }, { url: WEBDAV_URL, user: WEBDAV_USER });
    await page.evaluate(() => (window as any).__boxingFlushCredentials?.());
    await page.waitForTimeout(50);
    const after = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const dec = (window as any).__boxingDecryptCredential;
      return {
        url: dbg.layout.settings.webdavUrl,
        user: dbg.layout.settings.webdavUser,
        pass: await dec(dbg.layout.settings._encWebdavPass),
        token: await dec(dbg.layout.settings._encGistToken),
      };
    });
    // Plain fields committed…
    expect(after.url).toBe(WEBDAV_URL);
    expect(after.user).toBe(WEBDAV_USER);
    // …while the stored envelopes were KEPT, not nulled (V-08 regression).
    expect(after.pass).toBe('spec-pass');
    expect(after.token).toBe('spec-token');
    expect(seeded.envPass).toBeTruthy();
    expect(seeded.envToken).toBeTruthy();
  });

  test('a genuinely changed password is re-encrypted exactly once', async ({ page }) => {
    await resetFresh(page);
    const before = await page.evaluate(async ({ url }) => {
      const dbg = (window as any).__boxingDebug;
      const enc = (window as any).__boxingEncryptCredential;
      const seeded = await enc('spec-pass');
      dbg.layout.settings._encWebdavPass = seeded;
      const passInput = document.getElementById('webdav-pass');
      if (passInput) passInput.value = 'brand-new-pass';
      const urlInput = document.getElementById('webdav-url');
      if (urlInput) urlInput.value = url;
      return seeded;
    }, { url: WEBDAV_URL });
    await page.evaluate(() => (window as any).__boxingFlushCredentials?.());
    await page.waitForTimeout(50);
    const first = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const dec = (window as any).__boxingDecryptCredential;
      const env = dbg.layout.settings._encWebdavPass;
      return { env, plain: await dec(env) };
    });
    // The changed secret got a fresh envelope with the new plaintext…
    expect(first.env).not.toEqual(before);
    expect(first.plain).toBe('brand-new-pass');
    // …and a second flush with the same inputs does NOT re-encrypt (no ciphertext churn).
    await page.evaluate(() => (window as any).__boxingFlushCredentials?.());
    await page.waitForTimeout(50);
    const second = await page.evaluate(() => (window as any).__boxingDebug.layout.settings._encWebdavPass);
    expect(second).toEqual(first.env);
  });

  test('flush while credential decryption is pending keeps the stored envelopes', async ({ page }) => {
    await resetFresh(page);
    const seeded = await page.evaluate(async ({ url, user }) => {
      const dbg = (window as any).__boxingDebug;
      const enc = (window as any).__boxingEncryptCredential;
      const envPass = await enc('spec-pass');
      const envToken = await enc('spec-token');
      dbg.layout.settings.webdavUrl = 'https://old.invalid/dav/';
      dbg.layout.settings.webdavUser = 'old-user';
      dbg.layout.settings._encWebdavPass = envPass;
      dbg.layout.settings._encGistToken = envToken;
      const urlInput = document.getElementById('webdav-url');
      const userInput = document.getElementById('webdav-user');
      if (urlInput) urlInput.value = url;
      if (userInput) userInput.value = user;
      // Pin the boot-time window where the decrypt IIFE has not completed: inputs are
      // not yet filled with the secrets, and the decrypt gate is still pending.
      (window as any).__boxingSetCredentialDecryptPending(true);
      return { envPass, envToken };
    }, { url: WEBDAV_URL, user: WEBDAV_USER });
    await page.evaluate(() => (window as any).__boxingFlushCredentials?.());
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return {
        url: dbg.layout.settings.webdavUrl,
        user: dbg.layout.settings.webdavUser,
        pass: dbg.layout.settings._encWebdavPass,
        token: dbg.layout.settings._encGistToken,
      };
    });
    // URL/user edits are committed even mid-decrypt…
    expect(after.url).toBe(WEBDAV_URL);
    expect(after.user).toBe(WEBDAV_USER);
    // …but the envelopes are never cleared while decryption is in flight (D5 AC3).
    expect(after.pass).toEqual(seeded.envPass);
    expect(after.token).toEqual(seeded.envToken);
    // Once decryption is considered complete, an empty input still keeps the envelope
    // while a genuinely new secret is re-encrypted.
    await page.evaluate(async () => {
      (window as any).__boxingSetCredentialDecryptPending(false);
      const passInput = document.getElementById('webdav-pass');
      if (passInput) passInput.value = 'updated-pass';
      await (window as any).__boxingFlushCredentials?.();
    });
    await page.waitForTimeout(50);
    const final = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const dec = (window as any).__boxingDecryptCredential;
      return {
        pass: await dec(dbg.layout.settings._encWebdavPass),
        token: await dec(dbg.layout.settings._encGistToken),
      };
    });
    expect(final.pass).toEqual('updated-pass');
    expect(final.token).toEqual('spec-token');
  });
});
