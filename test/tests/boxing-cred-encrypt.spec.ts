import { expect, test } from '@playwright/test';
import fs from 'fs';
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
    // 81R2: the PIK reaches storage through the storage.js narrow port injected at
    // init() — wait for injection so a pre-init encrypt cannot pin the session-key fallback.
    await expect.poll(() => page.evaluate(() =>
      (window as any).__boxingPerInstallKeyInfo?.()?.injected === true)).toBe(true);
    await page.evaluate(async () => { await (window as any).__boxingEncryptCredential('probe'); });
    // Extension lane: read chrome.storage.local directly. file:// lane: the SEC-01 mock
    // keeps non-layout keys under the 'bxstore:' prefix (41R mock shape). Either way the
    // PIK must exist and must NOT live inside boxingLayout.
    const info = await page.evaluate(async () => {
      const api = (typeof chrome !== 'undefined' && chrome?.storage?.local) ? chrome
        : (typeof browser !== 'undefined' && browser?.storage?.local) ? browser : null;
      if (api) {
        const got = await api.storage.local.get({ 'boxingCredKey.v1': null, boxingLayout: null });
        return {
          storeHasKey: typeof got['boxingCredKey.v1'] === 'string' && got['boxingCredKey.v1'].length >= 40,
          layoutHasPIK: JSON.stringify(got.boxingLayout || {}).includes('boxingCredKey'),
        };
      }
      let parsed = null;
      try { parsed = JSON.parse(localStorage.getItem('bxstore:boxingCredKey.v1') || 'null'); } catch (_) { /* silent: malformed mock entry */ }
      return {
        storeHasKey: typeof parsed === 'string' && parsed.length >= 40,
        layoutHasPIK: (localStorage.getItem('boxingLayout') || '').includes('boxingCredKey'),
      };
    });
    expect(info.storeHasKey, 'per-install key must be persisted outside boxingLayout').toBe(true);
    expect(info.layoutHasPIK, 'layout must never contain the per-install key').toBe(false);
  });

  test('source contract: cred-key port prefix-pinned + credentials.js has no direct browser storage (81R2)', () => {
    const rootDir = path.resolve(__dirname, '..', '..');
    const storageSrc = fs.readFileSync(path.join(rootDir, 'ntp', 'storage.js'), 'utf8');
    const portStart = storageSrc.indexOf('export function credKeyGet');
    expect(portStart, 'storage.js must expose the cred-key narrow port').toBeGreaterThan(-1);
    const port = storageSrc.slice(portStart, storageSrc.indexOf('export const TOMBSTONE_TTL_MS'));
    expect(port).toContain("startsWith('boxingCredKey.')");
    expect(port).toContain('only boxingCredKey.* keys allowed');
    // gate2 single-write-path invariant, same line-scan semantics as gate 2 itself:
    // comments may name the API, executable lines must not reach browser storage directly.
    const credSrc = fs.readFileSync(path.join(rootDir, 'ntp', 'credentials.js'), 'utf8');
    const credCodeLines = credSrc.split(/\r?\n/).filter((l) => {
      const t = l.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    });
    const directAccess = credCodeLines.filter((l) =>
      /\b(?:api|chrome|browser)\.storage\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*[Ss]torage[a-zA-Z0-9_$]*\.(set|remove|clear)\s*\(/.test(l));
    expect(directAccess, 'credentials.js executable lines must stay free of direct browser storage access').toEqual([]);
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
