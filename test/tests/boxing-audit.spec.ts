import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path
  .resolve(__dirname, '..', '..', 'ntp', 'index.html')
  .replace(/\\/g, '/')}`;

// BX-AUD-01/03/04/05 regression: hardened URL guards, saveLayout quota fallback,
// leveled log ring buffer cap, and setLogLevel clamping. Uses the file:// harness so
// these do not depend on a running extension service worker.

async function bootFresh(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
}

test.describe('Boxing audit hardening (BX-AUD-01/03/04/05)', () => {
  test('isSafeExtUrl rejects private hosts, http, embedded creds, overlong URLs', async ({ page }) => {
    await bootFresh(page);
    const isSafe = (u: string) => page.evaluate((x) => (window as any).__boxingIsSafeExtUrl(x), u);

    expect(await isSafe('https://app.koofr.net/dav/Koofr/')).toBe(true);
    expect(await isSafe('https://example.com/foo')).toBe(true);
    expect(await isSafe('http://app.koofr.net/dav/Koofr/')).toBe(false);
    expect(await isSafe('https://127.0.0.1/dav/')).toBe(false);
    expect(await isSafe('https://10.0.0.1/dav/')).toBe(false);
    expect(await isSafe('https://192.168.1.1/dav/')).toBe(false);
    expect(await isSafe('https://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(await isSafe('https://172.16.0.1/dav/')).toBe(false);
    expect(await isSafe('https://172.31.255.255/dav/')).toBe(false);
    expect(await isSafe('https://localhost/dav/')).toBe(false);
    expect(await isSafe('https://host.local/dav/')).toBe(false);
    expect(await isSafe('https://host.internal/dav/')).toBe(false);
    expect(await isSafe('https://[::1]/dav/')).toBe(false);
    expect(await isSafe('https://user:pass@app.koofr.net/dav/Koofr/')).toBe(false);
    expect(await isSafe('https://app.koofr.net/dav/' + 'a'.repeat(2100))).toBe(false);
    expect(await isSafe('not-a-url')).toBe(false);
  });

  test('private-network opt-in: opt-in admits LAN hosts, denies nothing else (A-032)', async ({ page }) => {
    await bootFresh(page);
    const isSafe = (u: string, allow?: boolean) =>
      page.evaluate(({ x, flag }) => (window as any).__boxingIsSafeExtUrl(x, flag), { x: u, flag: allow });

    // Not opted in: identical to the refusal asserted above.
    expect(await isSafe('https://192.168.1.50/dav/', false)).toBe(false);
    // Opted in: private / loopback / link-local / LAN names are admitted...
    expect(await isSafe('https://192.168.1.50/dav/', true)).toBe(true);
    expect(await isSafe('https://10.0.0.5/dav/', true)).toBe(true);
    expect(await isSafe('https://localhost:8443/dav/', true)).toBe(true);
    expect(await isSafe('https://nas.local/dav/', true)).toBe(true);
    // ...while every non-private rule is untouched.
    expect(await isSafe('http://192.168.1.50/dav/', true)).toBe(false);
    expect(await isSafe('https://user:pass@192.168.1.50/dav/', true)).toBe(false);
    expect(await isSafe('https://192.168.1.50/dav/' + 'a'.repeat(2100), true)).toBe(false);
    expect(await isSafe('https://app.koofr.net/dav/Koofr/', true)).toBe(true);
  });

  test('private-network opt-in defaults to off and follows the persisted setting (A-032)', async ({ page }) => {
    await bootFresh(page);

    // The settings checkbox ships unchecked and the setting is not opted in.
    expect(await page.evaluate(() => {
      const el = document.getElementById('webdav-allow-private') as HTMLInputElement | null;
      return el ? el.checked : null;
    })).toBe(false);
    const opted = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.webdavAllowPrivateHost);
    expect(opted).toBeFalsy();

    // Single-argument contract still denies, exactly as before this ticket.
    expect(await page.evaluate(() => (window as any).__boxingIsSafeExtUrl('https://192.168.1.50/dav/'))).toBe(false);

    // Flipping the setting the way the checkbox does makes the guard follow it.
    await page.evaluate(() => { (window as any).__boxingDebug.layout.settings.webdavAllowPrivateHost = true; });
    expect(await page.evaluate(() => (window as any).__boxingIsSafeExtUrl('https://192.168.1.50/dav/'))).toBe(true);
  });

  test('testWebDAV guard rejects private hosts without emitting a network request', async ({ page }) => {
    await bootFresh(page);
    const requested: string[] = [];
    page.on('request', (req) => { if (/127\.0\.0\.1/.test(req.url())) requested.push(req.url()); });
    await page.evaluate(() => (window as any).__boxingDebug.setWebDAVConfig('https://127.0.0.1/dav/', 'u', 'p'));
    const err = await page.evaluate(() =>
      (window as any).__boxingDebug.testWebDAV().catch((e: Error) => e.message),
    );
    expect(typeof err).toBe('string');
    expect((err as string).length).toBeGreaterThan(0);
    await page.waitForTimeout(150);
    expect(requested).toEqual([]);
  });

  test('saveLayout writes localStorage fallback + __lastSaveError when storage.local.set throws', async ({ page }) => {
    await bootFresh(page);
    // In file:// harness the extension uses a mock storage whose .set() writes
    // localStorage('boxingLayout', ...). We force that specific key write to throw
    // a quota-style error while leaving the fallback snapshot write intact.
    await page.evaluate(() => {
      const d = (window as any).__boxingDebug;
      d.clearLog();
      d.setLogLevel(4);
      // Firefox ignores instance-level shadowing of localStorage methods (probe 2026-09-03:
      // own-property assignment AND defineProperty both fail there), so patch the Storage
      // prototype — honored on both engines — and restore it right after the write trigger.
      const protoSetItem = Storage.prototype.setItem;
      const origSetItem = protoSetItem.bind(window.localStorage);
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (key === 'boxingLayout') {
          const e = new Error('QUOTA_BYTES quota exceeded');
          (e as any).code = 'QUOTA_BYTES';
          throw e;
        }
        return origSetItem(key, value);
      } as typeof Storage.prototype.setItem;
      (window as any).__boxingRestoreSetItem = () => { Storage.prototype.setItem = protoSetItem; };
    });
    await page.evaluate(async () => {
      try {
        await (window as any).__boxingDebug.setWebDAVConfig('https://example.com/dav/', 'u', 'p');
      } catch (_) {}
    });
    await page.evaluate(() => (window as any).__boxingRestoreSetItem?.());
    const fb = await page.evaluate(() => localStorage.getItem('boxingLayoutFallback.v1'));
    expect(fb && fb.length).toBeTruthy();
    const lastSaveErr = await page.evaluate(
      () => (window as any).__boxingDebug.layout.settings?.__lastSaveError,
    );
    expect(lastSaveErr).toBeTruthy();
    const ring = await page.evaluate(() => (window as any).__boxingDebug.getLogRing());
    expect(Array.isArray(ring)).toBe(true);
    expect(ring.length).toBeLessThanOrEqual(300);
    const hasSaveErr = ring.some((e: any) => /saveLayout.*failed|fallback|quota/i.test(e.text || ''));
    expect(hasSaveErr).toBe(true);
  });

  test('log ring buffer caps at LOG_RING_MAX (300) entries under floods', async ({ page }) => {
    await bootFresh(page);
    await page.evaluate(() => {
      const d = (window as any).__boxingDebug;
      d.clearLog();
      d.setLogLevel(4);
      for (let i = 0; i < 500; i++) {
        // console.log flows through debug() (piped into the ring); guaranteed to be pushed.
        console.log('[Boxing][DBG] audit-flood-' + i);
      }
    });
    await page.waitForTimeout(200);
    const ringLen = await page.evaluate(() => (window as any).__boxingDebug.getLogRing().length);
    expect(ringLen).toBeLessThanOrEqual(300);
    expect(ringLen).toBeGreaterThan(0);
  });

  test('setLogLevel clamps to [1,4] and returns the clamped value', async ({ page }) => {
    await bootFresh(page);
    const results = await page.evaluate(() => {
      const d = (window as any).__boxingDebug;
      return {
        low: d.setLogLevel(-5),
        high: d.setLogLevel(99),
        mid: d.setLogLevel(3),
        current: d.getLogLevel(),
      };
    });
    expect(results.low).toBe(1);
    expect(results.high).toBe(4);
    expect(results.mid).toBe(3);
    expect(results.current).toBe(3);
  });
});
