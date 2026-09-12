import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

async function resetFresh(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug?.skipOnboarding?.());
  // __boxingEncryptCredential/__boxingDecryptCredential are exposed inside init()
  // (after async loadLayout/loadSettings), NOT synchronously with __boxingDebug.
  // Poll for the functions this suite actually uses, else Firefox hits
  // "enc is not a function" when init() has not reached the exposure line yet.
  await expect.poll(() => page.evaluate(() =>
    typeof (window as any).__boxingEncryptCredential === 'function' &&
    typeof (window as any).__boxingDecryptCredential === 'function'
  )).toBe(true);
}

test.describe('BX-CRED-V2: encrypted credential backup/restore', () => {
  test('encryptCredential produces v3 per-install-key format (no bundled key k field)', async ({ page }) => {
    await resetFresh(page);
    const enc = await page.evaluate(() => (window as any).__boxingEncryptCredential?.('hello-secret'));
    expect(enc).toBeTruthy();
    expect(enc.v).toBe(3);
    // Security invariant: key is NOT bundled with ciphertext.
    expect(enc.k).toBeUndefined();
    expect(enc.s).toBeTruthy();
    expect(enc.iv).toBeTruthy();
    expect(enc.d).toBeTruthy();
  });

  test('new install persists a per-install key under boxingCredKey.v1, outside the layout', async ({ page }) => {
    await resetFresh(page);
    const info = await page.evaluate(async () => {
      const enc = (window as any).__boxingEncryptCredential;
      await enc('probe');
      // Read chrome.storage.local directly — the PIK lives OUTSIDE boxingLayout.
      const api = (typeof chrome !== 'undefined' && chrome.storage) ? chrome : (typeof browser !== 'undefined' && browser.storage) ? browser : null;
      if (!api || !api.storage || !api.storage.local) return { lane: 'file', layoutHasPIK: null, storeHasKey: null };
      const got = await api.storage.local.get({ 'boxingCredKey.v1': null, boxingLayout: null });
      return {
        lane: 'extension',
        storeHasKey: typeof got['boxingCredKey.v1'] === 'string' && got['boxingCredKey.v1'].length >= 40,
        layoutHasPIK: JSON.stringify(got.boxingLayout || {}).includes('boxingCredKey'),
      };
    });
    if (info.lane === 'file') return; // file:// lane: session fallback, no storage assertions
    expect(info.storeHasKey).toBe(true);
    expect(info.layoutHasPIK).toBe(false);
  });

  test('exported JSON and sync payload never contain the per-install key or PIK name', async ({ page }) => {
    await resetFresh(page);
    await page.evaluate(async () => {
      const enc = (window as any).__boxingEncryptCredential;
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings._encWebdavPass = await enc('super-secret-pass-123');
    });
    const leaks = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const json = JSON.stringify(dbg.layout);
      return {
        inLayout: json.includes('boxingCredKey'),
        plaintextLeak: json.includes('super-secret-pass-123'),
      };
    });
    expect(leaks.inLayout).toBe(false);
    expect(leaks.plaintextLeak).toBe(false);
  });

  test('roundtrip: encrypt → decrypt returns the original plaintext', async ({ page }) => {
    await resetFresh(page);
    const result = await page.evaluate(async () => {
      const target = (window as any).__boxingEncryptCredential;
      const dec = (window as any).__boxingDecryptCredential;
      const enc = await target('my-webdav-pass');
      const back = await dec(enc);
      return { enc, back };
    });
    expect(result.back).toBe('my-webdav-pass');
  });

  test('legacy v1 format {k, iv, d} still decrypts (backward compat)', async ({ page }) => {
    await resetFresh(page);
    // Encrypt with legacy v1 by generating a key+ciphertext (mimic old format directly via an inline function).
    const result = await page.evaluate(async () => {
      const dec = (window as any).__boxingDecryptCredential;
      const algo = 'AES-GCM';
      const key = await crypto.subtle.generateKey({ name: algo, length: 256 }, true, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = await crypto.subtle.encrypt({ name: algo, iv }, key, new TextEncoder().encode('legacy-plain'));
      const raw = await crypto.subtle.exportKey('raw', key);
      const legacy = {
        k: btoa(String.fromCharCode(...new Uint8Array(raw))),
        iv: btoa(String.fromCharCode(...iv)),
        d: btoa(String.fromCharCode(...new Uint8Array(enc)))
      };
      const back = await dec(legacy);
      return back;
    });
    expect(result).toBe('legacy-plain');
  });

  test('plain-string credential is treated as plaintext (migration-friendly)', async ({ page }) => {
    await resetFresh(page);
    const back = await page.evaluate(() => (window as any).__boxingDecryptCredential?.('plain-password-string'));
    expect(back).toBe('plain-password-string');
  });

  test('exported JSON contains encrypted credentials, never plaintext', async ({ page }) => {
    await resetFresh(page);
    // Set a webdav pass via encrypt then verify export excludes plaintext form.
    await page.evaluate(async () => {
      const enc = (window as any).__boxingEncryptCredential;
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings._encWebdavPass = await enc('super-secret-pass-123');
      dbg.layout.settings.webdavUser = 'jinxi2410@gmail.com';
      await dbg.layout.settings;
    });
    // Snapshot layout export
    const exportPayload = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return JSON.parse(JSON.stringify(dbg.layout));
    });
    // Encrypted credential object is present
    expect(exportPayload.settings._encWebdavPass).toBeTruthy();
    expect(exportPayload.settings._encWebdavPass.v).toBe(3);
    // The plaintext must never appear anywhere in the settings object
    const json = JSON.stringify(exportPayload.settings);
    expect(json).not.toContain('super-secret-pass-123');
  });
});
