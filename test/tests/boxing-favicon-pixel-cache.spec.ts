import { chromium, expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

// #58: the bounded 32×32 PNG pixel layer that accelerates the existing URL/SWR favicon
// cache. The controlled lanes below prove the validation / bound / fallback rules through
// the real display path; the final lane loads the actual dist/boxing-chrome build and
// proves the persisted bytes survive a browser restart with the network gone as a data URI.
// This is not a claim that every site is readable cross-origin: Chrome keeps https://*/*
// as an optional permission, so most hosts still fall back to the URL cache.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;
const DIST_CHROME = path.resolve(__dirname, '..', '..', 'dist', 'boxing-chrome');
const DIST_FIREFOX = path.resolve(__dirname, '..', '..', 'dist', 'boxing-firefox');

const FIXTURE_HOST = 'pixel-fixture.test';
const CDN_URL = `https://icons.duckduckgo.com/ip3/${FIXTURE_HOST}.ico`;
const EXTERNAL_FAVICON_RE = /https:\/\/(ico\.bytecook\.io|icons\.duckduckgo\.com|www\.google\.com|favicon\.im)\//;
const PIXEL_KEY = 'boxingFaviconPixels.v1';
const URL_KEY = 'boxingFaviconCache.v1';
const PIXEL_PREFIX = 'data:image/png;base64,';

// A real 1×1 PNG: the capture path must re-encode it as a 32×32 PNG, never store the source.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const SVG_ICON = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#c33"/></svg>',
);

type Entries = { entries?: Record<string, any> } | null;

async function seedStores(page: Page, data: {
  pixels?: Record<string, { data: string; ts: number }>;
  urls?: Record<string, { url: string | null; ts: number }>;
}) {
  await page.evaluate(({ pixelKey, urlKey, pixels, urls }) => {
    if (pixels) localStorage.setItem(pixelKey, JSON.stringify({ entries: pixels, savedAt: Date.now() }));
    if (urls) localStorage.setItem(urlKey, JSON.stringify({ entries: urls, savedAt: Date.now() }));
  }, { pixelKey: PIXEL_KEY, urlKey: URL_KEY, pixels: data.pixels, urls: data.urls });
}

async function readStore(page: Page, key: string): Promise<Entries> {
  return page.evaluate((k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }, key);
}

function pngMeta(dataUri: string): { width: number; height: number } {
  const bytes = Buffer.from(dataUri.slice(PIXEL_PREFIX.length), 'base64');
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function boot(page: Page, opts: { seed?: (page: Page) => Promise<void>; route?: (page: Page) => Promise<void> } = {}) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  if (opts.seed) await opts.seed(page);
  if (opts.route) await opts.route(page);
  else await page.route(EXTERNAL_FAVICON_RE, (route) => route.abort());
  await page.route(`https://${FIXTURE_HOST}/**`, (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 15000 }).toBe(true);
  await dismissOnboarding(page);
}

// Only the DuckDuckGo token answers, so Promise.any has one deterministic winner (the same
// discipline as boxing-favicon-fixture.spec.ts). Other sources fail fast.
function serveControlledIcon(page: Page, body: Buffer, contentType: string) {
  return page.route(EXTERNAL_FAVICON_RE, (route) =>
    route.request().url() === CDN_URL
      ? route.fulfill({
        status: 200,
        contentType,
        headers: { 'access-control-allow-origin': '*' },
        body,
      })
      : route.abort(),
  );
}

// The image probe succeeds (so a display path exists) while the capture fetch receives a
// different response. This exercises captureFaviconPixel's own ok/MIME/body/decode gate
// instead of letting the probe failure hide it.
async function serveIconWithBadCapture(page: Page, bad: () => { status: number; contentType: string; body: Buffer | string }) {
  const state = { fetches: 0 };
  await page.route(EXTERNAL_FAVICON_RE, async (route) => {
    if (route.request().url() !== CDN_URL) return route.abort();
    if (route.request().resourceType() === 'fetch') {
      state.fetches++;
      return route.fulfill(bad());
    }
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: PNG_1x1,
    });
  });
  return state;
}

async function serveIconWithFailedCapture(page: Page) {
  const state = { fetches: 0 };
  await page.route(EXTERNAL_FAVICON_RE, async (route) => {
    if (route.request().url() !== CDN_URL) return route.abort();
    if (route.request().resourceType() === 'fetch') {
      state.fetches++;
      return route.abort();
    }
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: PNG_1x1,
    });
  });
  return state;
}

async function seedAndEnterSmallBox(page: Page, host = FIXTURE_HOST) {
  await page.evaluate((h) => {
    const dbg = (window as any).__boxingDebug;
    dbg.layout.boxes = [{
      id: 'L1', type: 'large', title: 'Pixels', x: 0, y: 0, width: 420, height: 320,
      children: [{
        id: 'S1', title: 'Links', x: 10, y: 10, width: 300, height: 200,
        bookmarks: [{ id: 'b1', title: 'Fixture', url: `https://${h}/page` }],
      }],
    }];
    dbg.layout._meta = { updatedAt: Date.now() };
    dbg.renderCanvas();
    dbg.enterLargeBox('L1');
  }, host);
}

async function rowState(page: Page) {
  return page.locator('.small-box[data-id="S1"] .bm-row__favicon').first().evaluate((el) => {
    const img = el as HTMLImageElement;
    return {
      src: img.src,
      display: getComputedStyle(img).display,
      cached: img.classList.contains('is-cached'),
      naturalWidth: img.naturalWidth,
    };
  });
}

async function expectRowPainted(page: Page) {
  const favicon = page.locator('.small-box[data-id="S1"] .bm-row__favicon').first();
  await expect(favicon).toBeVisible();
  await expect(favicon).toHaveClass(/is-cached/);
}

async function loadProbeImage(page: Page, host: string) {
  await page.evaluate((h) => {
    const img = document.createElement('img');
    img.id = 'pixel-probe';
    document.body.appendChild(img);
    (window as any).__boxingDebug.loadFavicon(img, `https://${h}/page`);
  }, host);
}

async function probeImage(page: Page) {
  return page.evaluate(() => {
    const img = document.getElementById('pixel-probe') as HTMLImageElement | null;
    return img ? { src: img.src, naturalWidth: img.naturalWidth } : null;
  });
}

test.describe('#58 favicon pixel layer — controlled responses', () => {
  test('captures a bounded 32×32 PNG and paints it after the network is gone', async ({ page }) => {
    await boot(page, { route: (p) => serveControlledIcon(p, PNG_1x1, 'image/png') });
    await seedAndEnterSmallBox(page);
    await expectRowPainted(page);

    await expect.poll(async () => Boolean((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]?.data), { timeout: 15000 }).toBe(true);
    const pixel = (await readStore(page, PIXEL_KEY))!.entries![FIXTURE_HOST];
    expect(String(pixel.data).startsWith(PIXEL_PREFIX)).toBe(true);
    const meta = pngMeta(pixel.data);
    // The source was 1×1: a 32×32 header proves the re-encode, not a stored original.
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
    expect(String(pixel.data).length).toBeLessThanOrEqual(16 * 1024);

    // Cut every source, then display the same host through a fresh image: only the
    // persisted data URI can paint it.
    await page.unroute(EXTERNAL_FAVICON_RE);
    await page.route(EXTERNAL_FAVICON_RE, (route) => route.abort());
    await loadProbeImage(page, FIXTURE_HOST);
    await expect.poll(async () => (await probeImage(page))?.src || '', { timeout: 15000 }).toMatch(/^data:image\/png;base64,/);
    const probe = await probeImage(page);
    expect(probe!.naturalWidth).toBe(32);
  });

  for (const [label, response] of [
    ['404 HTML', { status: 404, contentType: 'text/html', body: '<!DOCTYPE html><html><body>not found</body></html>' }],
    ['200 empty body', { status: 200, contentType: 'image/png', body: Buffer.alloc(0) }],
    ['200 undecodable body', { status: 200, contentType: 'image/png', body: 'this is not an image' }],
  ] as const) {
    test(`a ${label} capture response is refused while the URL icon still paints`, async ({ page }) => {
      let capture: { fetches: number } | undefined;
      await boot(page, {
        route: async (p) => { capture = await serveIconWithBadCapture(p, () => ({ ...response })); },
      });
      await seedAndEnterSmallBox(page);
      await expectRowPainted(page);
      // The probe really did succeed; only the capture's response was bad.
      await expect.poll(async () => (await readStore(page, URL_KEY))?.entries?.[FIXTURE_HOST]?.url, { timeout: 20000 }).toBe(CDN_URL);
      await expect.poll(() => capture!.fetches, { timeout: 15000 }).toBeGreaterThan(0);
      // Outlast the 400 ms pixel-persist debounce, so a build that wrongly accepted this
      // response would have had time to write it and fail here.
      await page.waitForTimeout(800);
      expect((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]).toBeUndefined();
      expect((await rowState(page)).src).toContain('icons.duckduckgo.com');
    });
  }

  test('a refused capture fetch never disturbs the URL icon', async ({ page }) => {
    let capture: { fetches: number } | undefined;
    await boot(page, {
      route: async (p) => { capture = await serveIconWithFailedCapture(p); },
    });
    await seedAndEnterSmallBox(page);
    await expectRowPainted(page);
    await expect.poll(() => capture!.fetches, { timeout: 15000 }).toBeGreaterThan(0);
    const state = await rowState(page);
    expect(state.src).toContain('icons.duckduckgo.com');
    expect(state.display).not.toBe('none');
    expect((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]).toBeUndefined();
  });

  test('an SVG source is re-encoded as PNG and never stored as SVG', async ({ page }) => {
    await boot(page, { route: (p) => serveControlledIcon(p, SVG_ICON, 'image/svg+xml') });
    await seedAndEnterSmallBox(page);
    await expectRowPainted(page);

    await expect.poll(async () => Boolean((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]?.data), { timeout: 15000 }).toBe(true);
    const stored = String((await readStore(page, PIXEL_KEY))!.entries![FIXTURE_HOST].data);
    expect(stored.startsWith(PIXEL_PREFIX)).toBe(true);
    // pngMeta's magic check is the deterministic "not the raw SVG": stored bytes are a PNG.
    const meta = pngMeta(stored);
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });

  test('hydrate enforces the per-entry cap, the 1 MiB budget and oldest-write eviction', async ({ page }) => {
    const prefix = PIXEL_PREFIX;
    await boot(page, {
      seed: async (p) => {
        const entries: Record<string, { data: string; ts: number }> = {};
        const base = Date.now() - 10_000_000;
        // 70 × 16 000 chars = 1 120 000 > 1 MiB. The budget keeps 65 of them (newest first).
        for (let i = 0; i < 70; i++) entries[`h${i}.test`] = { data: prefix + 'A'.repeat(16000 - prefix.length), ts: base + i * 1000 };
        entries['oversize.test'] = { data: prefix + 'B'.repeat(17000), ts: base + 80_000 };
        entries['expired.test'] = { data: prefix + 'C'.repeat(100), ts: Date.now() - 100 * 24 * 3600 * 1000 };
        await seedStores(p, { pixels: entries });
      },
    });

    await expect.poll(async () => Object.keys((await readStore(page, PIXEL_KEY))?.entries || {}).length, { timeout: 15000 }).toBe(65);
    const stored = (await readStore(page, PIXEL_KEY))!.entries!;
    expect(stored['oversize.test']).toBeUndefined();
    expect(stored['expired.test']).toBeUndefined();
    // Oldest write times go first; the newest host survives.
    expect(stored['h0.test']).toBeUndefined();
    expect(stored['h4.test']).toBeUndefined();
    expect(stored['h5.test']).toBeDefined();
    expect(stored['h69.test']).toBeDefined();
    const total = Object.values(stored).reduce((sum: number, e: any) => sum + String(e.data).length, 0);
    expect(total).toBeLessThanOrEqual(1024 * 1024);
    // The budget covers the whole serialized layer, not just the image payloads.
    const raw = await page.evaluate((k) => localStorage.getItem(k) || '', PIXEL_KEY);
    expect(raw.length).toBeGreaterThan(0);
    expect(raw.length).toBeLessThanOrEqual(1024 * 1024);
  });

  test('a negative URL entry does not suppress a valid pixel', async ({ page }) => {
    const now = Date.now();
    await boot(page, {
      seed: (p) => seedStores(p, {
        pixels: { [FIXTURE_HOST]: { data: PIXEL_PREFIX + PNG_1x1.toString('base64'), ts: now - 5 * 24 * 3600 * 1000 } },
        urls: { [FIXTURE_HOST]: { url: null, ts: now } },
      }),
    });
    await seedAndEnterSmallBox(page);
    // A miss governs re-probing; the pixel's own 90-day ceiling governs painting.
    await expectRowPainted(page);
    expect((await rowState(page)).src.startsWith(PIXEL_PREFIX)).toBe(true);
  });

  test('an offline revalidation failure does not blank the pixel on the next load', async ({ page }) => {
    const now = Date.now();
    await boot(page, {
      seed: (p) => seedStores(p, {
        pixels: { [FIXTURE_HOST]: { data: PIXEL_PREFIX + PNG_1x1.toString('base64'), ts: now - 8 * 24 * 3600 * 1000 } },
      }),
    });
    await seedAndEnterSmallBox(page);
    await expectRowPainted(page);
    // The failed background probe records a fresh miss.
    await expect.poll(async () => (await readStore(page, URL_KEY))?.entries?.[FIXTURE_HOST]?.url, { timeout: 20000 }).toBe(null);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 15000 }).toBe(true);
    await dismissOnboarding(page);
    await page.evaluate(() => (window as any).__boxingDebug.enterLargeBox('L1'));
    await expectRowPainted(page);
    expect((await rowState(page)).src.startsWith(PIXEL_PREFIX)).toBe(true);
  });

  test('a corrupt pixel is discarded and the existing URL icon still paints', async ({ page }) => {
    await boot(page, {
      seed: (p) => seedStores(p, {
        pixels: { [FIXTURE_HOST]: { data: PIXEL_PREFIX + 'AAAA', ts: Date.now() } },
        urls: { [FIXTURE_HOST]: { url: CDN_URL, ts: Date.now() } },
      }),
      route: (p) => serveControlledIcon(p, PNG_1x1, 'image/png'),
    });
    await seedAndEnterSmallBox(page);
    await expectRowPainted(page);

    const state = await rowState(page);
    expect(state.src).toContain('icons.duckduckgo.com');
    await expect.poll(async () => (await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST], { timeout: 15000 }).toBeUndefined();
  });

  test('a pixel past the 90-day ceiling is dropped and does not replace the fallback', async ({ page }) => {
    await boot(page, {
      seed: (p) => seedStores(p, {
        pixels: { [FIXTURE_HOST]: { data: PIXEL_PREFIX + PNG_1x1.toString('base64'), ts: Date.now() - 91 * 24 * 3600 * 1000 } },
      }),
    });
    await seedAndEnterSmallBox(page);

    await expect.poll(async () => (await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST], { timeout: 15000 }).toBeUndefined();
    await expect.poll(async () => (await rowState(page)).display, { timeout: 5000 }).toBe('none');
    expect((await rowState(page)).cached).toBe(false);
  });

  test('a stale pixel still paints and its one revalidation refreshes the write time', async ({ page }) => {
    const oldTs = Date.now() - 8 * 24 * 3600 * 1000;
    await boot(page, {
      seed: (p) => seedStores(p, {
        pixels: { [FIXTURE_HOST]: { data: PIXEL_PREFIX + PNG_1x1.toString('base64'), ts: oldTs } },
      }),
      route: (p) => serveControlledIcon(p, PNG_1x1, 'image/png'),
    });
    await seedAndEnterSmallBox(page);

    await expect.poll(async () => Number((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]?.ts || 0), { timeout: 20000 }).toBeGreaterThan(oldTs + 1000);
    await expect.poll(async () => (await readStore(page, URL_KEY))?.entries?.[FIXTURE_HOST]?.url, { timeout: 20000 }).toBe(CDN_URL);
  });

  test('a stale pixel with a fresh URL hit does not re-probe', async ({ page }) => {
    const now = Date.now();
    let probes = 0;
    await boot(page, {
      seed: (p) => seedStores(p, {
        pixels: { [FIXTURE_HOST]: { data: PIXEL_PREFIX + PNG_1x1.toString('base64'), ts: now - 8 * 24 * 3600 * 1000 } },
        urls: { [FIXTURE_HOST]: { url: CDN_URL, ts: now } },
      }),
      route: async (p) => {
        await p.route(EXTERNAL_FAVICON_RE, (route) => { probes++; return route.abort(); });
      },
    });
    await seedAndEnterSmallBox(page);
    await expectRowPainted(page);
    await page.waitForTimeout(1000);
    // The URL hit was refreshed more recently than the pixel; a refused capture must not
    // make every load pay for another five-token probe.
    expect(probes).toBe(0);
    expect((await rowState(page)).src.startsWith(PIXEL_PREFIX)).toBe(true);
  });

  test('a failed revalidation keeps the already-painted stale pixel on screen', async ({ page }) => {
    await boot(page, {
      seed: (p) => seedStores(p, {
        pixels: { [FIXTURE_HOST]: { data: PIXEL_PREFIX + PNG_1x1.toString('base64'), ts: Date.now() - 8 * 24 * 3600 * 1000 } },
      }),
    });
    await seedAndEnterSmallBox(page);
    await expectRowPainted(page);
    // The background probe has no network to reach; the painted data URI must survive it.
    await page.waitForTimeout(1500);
    const state = await rowState(page);
    expect(state.src.startsWith(PIXEL_PREFIX)).toBe(true);
    expect(state.display).not.toBe('none');
  });

  test('a hanging capture never delays the URL paint', async ({ page }) => {
    let captureFetches = 0;
    let releaseFetch: () => void = () => {};
    const fetchGate = new Promise<void>((resolve) => { releaseFetch = resolve; });
    try {
      await boot(page, {
        route: async (p) => {
          await p.route(EXTERNAL_FAVICON_RE, async (route) => {
            if (route.request().url() !== CDN_URL) return route.abort();
            // The image probe answers immediately; the capture's fetch hangs on the gate.
            if (route.request().resourceType() === 'fetch') {
              captureFetches++;
              await fetchGate;
              await route.abort().catch(() => { /* teardown race */ });
              return;
            }
            await route.fulfill({
              status: 200,
              contentType: 'image/png',
              headers: { 'access-control-allow-origin': '*' },
              body: PNG_1x1,
            });
          });
        },
      });
      await seedAndEnterSmallBox(page);
      // If the paint waited for the gated fetch, this would never settle and the test
      // would time out: no clock-bound assumption is needed.
      await expectRowPainted(page);
      await expect.poll(() => captureFetches, { timeout: 5000 }).toBeGreaterThan(0);
      expect((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]).toBeUndefined();
    } finally {
      releaseFetch();
    }
  });

  test('a refused pixel write neither hides the icon nor blocks the core save', async ({ page }) => {
    await page.addInitScript(() => {
      (globalThis as any).__pixelWriteAttempts = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'boxingFaviconPixels.v1') {
          (globalThis as any).__pixelWriteAttempts++;
          throw new DOMException('quota', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    await boot(page, { route: (p) => serveControlledIcon(p, PNG_1x1, 'image/png') });
    await seedAndEnterSmallBox(page);
    await expectRowPainted(page);
    // The write was actually attempted (after the persist debounce) and refused.
    await expect.poll(() => page.evaluate(() => (globalThis as any).__pixelWriteAttempts), { timeout: 15000 }).toBeGreaterThan(0);
    expect((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]).toBeUndefined();

    const persisted = await page.evaluate(async () => {
      await (window as any).__boxingDebug.saveLayout();
      return (window as any).__boxingDebug.storageGet('boxingLayout');
    });
    expect(persisted?.boxingLayout?.boxes?.length).toBe(1);
  });

  test('the emergency layout snapshot reclaims the pixel layer when quota blocks it', async ({ page }) => {
    await page.addInitScript(() => {
      const g = globalThis as any;
      g.__failLayoutWrites = false;
      g.__failFallbackOnce = false;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'boxingLayout' && g.__failLayoutWrites) throw new DOMException('quota', 'QuotaExceededError');
        if (key === 'boxingLayoutFallback.v1' && g.__failFallbackOnce) {
          g.__failFallbackOnce = false;
          throw new DOMException('quota', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    await boot(page);
    await seedAndEnterSmallBox(page);
    const result = await page.evaluate(async () => {
      const g = globalThis as any;
      const pixel = 'data:image/png;base64,' + 'A'.repeat(64);
      localStorage.setItem('boxingFaviconPixels.v1', JSON.stringify({ entries: { 'x.test': { data: pixel, ts: Date.now() } } }));
      g.__failLayoutWrites = true;
      g.__failFallbackOnce = true;
      await (window as any).__boxingDebug.saveLayout();
      return {
        fallback: localStorage.getItem('boxingLayoutFallback.v1'),
        pixel: localStorage.getItem('boxingFaviconPixels.v1'),
      };
    });
    // The first fallback write hit quota; releasing the discardable pixel layer let the
    // retry through, so the core snapshot survives at the pixel layer's expense.
    expect(result.fallback).toBeTruthy();
    expect(result.pixel).toBeNull();
  });

  test('built manifests keep the existing authorization boundary', () => {
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')) && !fs.existsSync(path.join(DIST_FIREFOX, 'manifest.json')),
      'dist is not built - run npm run build first');
    const chromeManifest = path.join(DIST_CHROME, 'manifest.json');
    if (fs.existsSync(chromeManifest)) {
      const m = JSON.parse(fs.readFileSync(chromeManifest, 'utf8'));
      expect(m.host_permissions || []).not.toContain('https://*/*');
      expect(m.optional_host_permissions || []).toContain('https://*/*');
    }
    const firefoxManifest = path.join(DIST_FIREFOX, 'manifest.json');
    if (fs.existsSync(firefoxManifest)) {
      const m = JSON.parse(fs.readFileSync(firefoxManifest, 'utf8'));
      expect(m.host_permissions || []).toContain('https://*/*');
    }
  });
});

// #53 T3: the offline acceptance runs in the ACTUAL build Chrome loads, from a new browser
// process with DNS dead. Persisted pixels are compared byte-for-byte and must paint as a
// data URI with zero source requests - an HTTPS image hitting the HTTP cache cannot pass.
test.describe('#58 favicon pixel layer — real Chrome build restart', () => {
  test('stored pixels paint as a data URI in a new process with the network gone', async ({}, testInfo) => {
    test.setTimeout(240000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'the loaded build lane is chromium');
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')), 'dist/boxing-chrome is not built - run npm run build first');

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue58-ext-'));
    const launchArgs = [
      '--load-extension=' + DIST_CHROME,
      '--disable-extensions-except=' + DIST_CHROME,
      '--no-first-run',
      '--no-default-browser-check',
    ];
    let persisted = '';

    const first = await chromium.launchPersistentContext(profile, { headless: false, args: launchArgs });
    try {
      const page = await first.newPage();
      await page.route(EXTERNAL_FAVICON_RE, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'access-control-allow-origin': '*' },
          body: PNG_1x1,
        }),
      );
      await page.route(`https://${FIXTURE_HOST}/**`, (route) => route.abort());
      await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.loadFavicon)), { timeout: 30000 }).toBe(true);
      expect(page.url()).toContain('chrome-extension://');

      // The build keeps https://*/* optional and ungranted: capture here succeeds because
      // this controlled response is CORS-readable, not because the extension gained access.
      const granted = await page.evaluate(() => (globalThis as any).chrome.permissions.contains({ origins: ['https://*/*'] }));
      expect(granted).toBe(false);

      await loadProbeImage(page, FIXTURE_HOST);
      await expect.poll(async () => Boolean((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]?.data), { timeout: 30000 }).toBe(true);
      persisted = String((await readStore(page, PIXEL_KEY))!.entries![FIXTURE_HOST].data);
      expect(pngMeta(persisted).width).toBe(32);
    } finally {
      await first.close().catch(() => { /* teardown is best-effort */ });
    }

    const second = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [...launchArgs, '--host-resolver-rules=MAP * ~NOTFOUND'],
    });
    try {
      const page = await second.newPage();
      let sourceRequests = 0;
      await second.route('https://**', (route) => {
        if (EXTERNAL_FAVICON_RE.test(route.request().url()) || route.request().url().startsWith(`https://${FIXTURE_HOST}/`)) sourceRequests++;
        route.abort();
      });
      await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.loadFavicon)), { timeout: 30000 }).toBe(true);

      // The bytes came back from the profile, unchanged.
      const restored = String((await readStore(page, PIXEL_KEY))?.entries?.[FIXTURE_HOST]?.data || '');
      expect(restored).toBe(persisted);

      await loadProbeImage(page, FIXTURE_HOST);
      await expect.poll(async () => (await probeImage(page))?.src || '', { timeout: 30000 }).toMatch(/^data:image\/png;base64,/);
      expect((await probeImage(page))!.naturalWidth).toBe(32);
      expect(sourceRequests).toBe(0);
    } finally {
      await second.close().catch(() => { /* teardown is best-effort */ });
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
