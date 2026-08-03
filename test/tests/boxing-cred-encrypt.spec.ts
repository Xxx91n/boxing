import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\/g, '/')}`;

async function resetFresh(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug?.skipOnboarding?.());
}

test.describe('BX-CRED-V2: encrypted credential backup/restore', () => {
  test('encryptCredential produces v2 format (no bundled key k field)', async ({ page }) => {
    await resetFresh(page);
    const enc = await page.evaluate(() => (window as any).__boxingEncryptCredential?.('hello-secret'));
    expect(enc).toBeTruthy();
    expect(enc.v).toBe(2);
    // Security invariant: key is NOT bundled with ciphertext.
    expect(enc.k).toBeUndefined();
    expect(enc.s).toBeTruthy();
    expect(enc.iv).toBeTruthy();
    expect(enc.d).toBeTruthy();
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
    expect(exportPayload.settings._encWebdavPass.v).toBe(2);
    // The plaintext must never appear anywhere in the settings object
    const json = JSON.stringify(exportPayload.settings);
    expect(json).not.toContain('super-secret-pass-123');
  });
});
