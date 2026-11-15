import { expect, test, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

// Deterministic favicon fixture lane (issue #26). The real cold path is exercised
// without external favicon CDNs or wall-clock sleeps: Playwright routes short-circuit
// every CDN probe and serve a valid PNG from a fixture hostname. The fixture host is a
// normal public-looking domain, so favicon.js's isValidPublicUrl() accepts it; the
// request never reaches DNS because the route answers it locally.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

const FIXTURE_HOST = 'favicon-fixture.test';
// 1x1 transparent PNG — a real, decodable image so img.decode() must settle.
const FIXTURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const EXTERNAL_FAVICON_RE = /https:\/\/(icons\.duckduckgo\.com|www\.google\.com|favicon\.im|icon\.horse|favicon\.yandex\.net)\//;
// One controlled CDN probe answers with the fixture PNG; the other probes fail, so
// Promise.any() deterministically selects this URL and the decode/display path runs
// against a real image response.
const FIXTURE_FAVICON_URL = `https://icons.duckduckgo.com/ip3/${FIXTURE_HOST}.ico`;

const CACHE_KEY = 'boxingFaviconCache.v1';
const DAY = 24 * 3600 * 1000;

async function bootFixtureLane(page: Page, opts: {
  faviconDelayMs?: number;
  entries?: Record<string, { url: string | null; ts: number }>;
  holdRetries?: boolean;
} = {}) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  if (opts.entries) {
    await page.evaluate(({ key, entries }) => localStorage.setItem(key, JSON.stringify({ entries })), {
      key: CACHE_KEY, entries: opts.entries,
    });
  }
  if (opts.holdRetries) {
    await page.addInitScript(() => {
      (window as any).__faviconIdleCallbacks = [];
      window.requestIdleCallback = (callback) => {
        (window as any).__faviconIdleCallbacks.push(callback);
        return 1;
      };
    });
  }

  await page.route(EXTERNAL_FAVICON_RE, async (route) => {
    if (route.request().url() !== FIXTURE_FAVICON_URL) return route.abort();
    if (opts.faviconDelayMs) await new Promise((r) => setTimeout(r, opts.faviconDelayMs));
    await route.fulfill({ status: 200, contentType: 'image/png', body: FIXTURE_PNG });
  });
  // The direct https://<host>/favicon.ico token is not used by this lane: the
  // controlled CDN response above wins the race. Fail it fast so it cannot hang.
  await page.route(`https://${FIXTURE_HOST}/**`, (route) => route.abort());

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 15000 }).toBe(true);
  await dismissOnboarding(page);
}

async function seedAndEnterSmallBox(page: Page) {
  await page.evaluate((host) => {
    const dbg = (window as any).__boxingDebug;
    dbg.layout.boxes = [{
      id: 'L1', type: 'large', title: 'Favicon', x: 0, y: 0, width: 420, height: 320,
      children: [{
        id: 'S1', title: 'Links', x: 10, y: 10, width: 300, height: 200,
        bookmarks: [{ id: 'b1', title: 'Fixture', url: `https://${host}/page` }],
      }],
    }];
    dbg.layout._meta = { updatedAt: Date.now() };
    dbg.renderCanvas();
    dbg.enterLargeBox('L1');
  }, FIXTURE_HOST);
}

async function expectFaviconPainted(page: Page) {
  const favicon = page.locator('.small-box[data-id="S1"] .bm-row__favicon').first();
  await expect(favicon).toBeVisible();
  await expect(favicon).toHaveClass(/is-cached/);
  const state = await favicon.evaluate((el) => {
    const img = el as HTMLImageElement;
    return {
      display: getComputedStyle(img).display,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    };
  });
  // The original cold-path bug left display:none after an empty src error; a painted
  // favicon must be visible, decoded, and carry non-zero pixel width.
  expect(state.display).not.toBe('none');
  expect(state.complete).toBe(true);
  expect(state.naturalWidth).toBeGreaterThan(0);
}

test.describe('favicon fixture lane', () => {
  test('cold entry into a small box displays the first-entry favicon', async ({ page }) => {
    await bootFixtureLane(page);
    await seedAndEnterSmallBox(page);
    await expectFaviconPainted(page);
  });

  test('cold entry still displays when the favicon resolves late (decode race)', async ({ page }) => {
    await bootFixtureLane(page, { faviconDelayMs: 300 });
    await seedAndEnterSmallBox(page);
    await expectFaviconPainted(page);
  });

  test('a miss younger than 7 days stays hidden without a request', async ({ page }) => {
    await bootFixtureLane(page, {
      entries: { [FIXTURE_HOST]: { url: null, ts: Date.now() - 6 * DAY } }, holdRetries: true,
    });
    const requests: string[] = [];
    page.on('request', (request) => { if (request.url().includes(FIXTURE_HOST)) requests.push(request.url()); });
    await seedAndEnterSmallBox(page);
    await expect(page.locator('.small-box[data-id="S1"] .bm-row__favicon')).toBeHidden();
    // Run the deferred load-time sample too: fresh misses are excluded there as well.
    await runRetrySample(page);
    expect(requests).toEqual([]);
  });

  test('an old miss shares one probe and repaints every visible row without a reload', async ({ page }) => {
    const oldTs = Date.now() - 8 * DAY;
    await bootFixtureLane(page, {
      entries: { [FIXTURE_HOST]: { url: null, ts: oldTs } }, holdRetries: true,
    });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let directRequests = 0;
    const requests: string[] = [];
    page.on('request', (request) => { if (request.url().includes(FIXTURE_HOST)) requests.push(request.url()); });
    await page.route(`https://${FIXTURE_HOST}/**`, async (route) => {
      directRequests++;
      await gate;
      await route.fulfill({ status: 200, contentType: 'image/png', body: FIXTURE_PNG });
    });
    // Keep all CDN probes pending until the direct token has already started.
    // This proves the direct request is parallel, rather than a last resort.
    await page.route(EXTERNAL_FAVICON_RE, async (route) => { await gate; await route.abort(); });
    try {
      await seedAndEnterSmallBox(page);
      await page.evaluate((host) => {
        const img = document.createElement('img');
        img.id = 'second-favicon';
        document.body.appendChild(img);
        (window as any).__boxingDebug.loadFavicon(img, `https://${host}/other`);
      }, FIXTURE_HOST);
      try { await expect.poll(() => directRequests).toBe(1); }
      catch (error) {
        const cache = await page.evaluate((key) => localStorage.getItem(key), CACHE_KEY);
        throw new Error(`Direct request did not start. Requests: ${JSON.stringify(requests)}; cache: ${cache}`, { cause: error });
      }
      await runRetrySample(page); // skips the host whose display probe is pending
      expect(directRequests).toBe(1);
      release();
      await expectFaviconPainted(page);
      await expect(page.locator('#second-favicon')).toBeVisible();
      await expect(page.locator('#second-favicon')).toHaveClass(/is-cached/);
      await expect.poll(() => page.evaluate(({ key, host }) => {
        return JSON.parse(localStorage.getItem(key) || '{}').entries?.[host]?.url;
      }, { key: CACHE_KEY, host: FIXTURE_HOST })).toBe(`https://${FIXTURE_HOST}/favicon.ico`);
    } finally { release(); }
  });

  test('the load-time sample waits for paint, retries at most 3 misses and retains entries through 180 days', async ({ page }) => {
    const now = Date.now();
    const entries: Record<string, { url: null; ts: number }> = {};
    for (let i = 0; i < 8; i++) entries[`retry-${i}.test`] = { url: null, ts: now - (8 + i) * DAY };
    entries['old-miss.test'] = { url: null, ts: now - 179 * DAY };
    entries['expired-miss.test'] = { url: null, ts: now - 181 * DAY };
    await bootFixtureLane(page, { entries, holdRetries: true });
    const directHosts = new Set<string>();
    const requests: string[] = [];
    page.on('request', (request) => { if (request.url().includes('.test')) requests.push(request.url()); });
    await page.route('https://*.test/favicon.ico', (route) => {
      const host = new URL(route.request().url()).hostname;
      if (Object.hasOwn(entries, host)) directHosts.add(host);
      return route.abort();
    });
    // The page and its first-entry icon work while the sample is still held.
    await seedAndEnterSmallBox(page);
    await expectFaviconPainted(page);
    expect(directHosts.size).toBe(0);
    await runRetrySample(page);
    try { await expect.poll(() => directHosts.size).toBe(3); }
    catch (error) {
      const cache = await page.evaluate((key) => localStorage.getItem(key), CACHE_KEY);
      throw new Error(`Sample requests missing. Requests: ${JSON.stringify(requests)}; cache: ${cache}`, { cause: error });
    }
    expect(directHosts.has('old-miss.test')).toBe(true);
    expect(directHosts.has('expired-miss.test')).toBe(false);
    // Persisting a refreshed miss also flushes the hydrated cache. This checks
    // retention via public storage, including both sides of the hard expiry.
    await expect.poll(() => page.evaluate((key) => {
      return JSON.parse(localStorage.getItem(key) || '{}').entries?.['old-miss.test']?.ts || 0;
    }, CACHE_KEY)).toBeGreaterThan(now);
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').entries, CACHE_KEY);
    expect(stored['retry-0.test'].ts).toBe(entries['retry-0.test'].ts);
    expect(stored['expired-miss.test']).toBeUndefined();
  });

  test('a cached URL from a retired provider is discarded before display', async ({ page }) => {
    const retiredUrl = `https://retired-provider.test/${FIXTURE_HOST}`;
    let retiredRequests = 0;
    await page.route('https://retired-provider.test/**', (route) => { retiredRequests++; return route.abort(); });
    await bootFixtureLane(page, {
      entries: { [FIXTURE_HOST]: { url: retiredUrl, ts: Date.now() } },
    });
    await seedAndEnterSmallBox(page);
    await expectFaviconPainted(page);
    expect(retiredRequests).toBe(0);
  });

  for (const outcome of ['resolve', 'reject'] as const) {
    test(`a late stale decode cannot ${outcome === 'resolve' ? 'replace' : 'hide'} a refreshed icon`, async ({ page }) => {
      await bootFixtureLane(page, {
        entries: { [FIXTURE_HOST]: { url: FIXTURE_FAVICON_URL, ts: Date.now() - 8 * DAY } },
        holdRetries: true,
      });
      const freshUrl = `https://icon.horse/icon/${FIXTURE_HOST}`;
      await page.route(EXTERNAL_FAVICON_RE, (route) => route.request().url() === freshUrl
        ? route.fulfill({ status: 200, contentType: 'image/png', body: FIXTURE_PNG })
        : route.abort());
      await page.evaluate((oldUrl) => {
        const originalDecode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = function () {
          if (this.src !== oldUrl) return originalDecode.call(this);
          (window as any).__oldFaviconDecodeStarted = true;
          return new Promise<void>((resolve, reject) => {
            (window as any).__finishOldFaviconDecode = (succeed: boolean) => succeed ? resolve() : reject(new Error('old icon failed'));
          });
        };
      }, FIXTURE_FAVICON_URL);
      await seedAndEnterSmallBox(page);
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__oldFaviconDecodeStarted))).toBe(true);
      const favicon = page.locator('.small-box[data-id="S1"] .bm-row__favicon').first();
      await expect(favicon).toHaveAttribute('src', freshUrl);
      await expect(favicon).toBeVisible();
      await page.evaluate((succeed) => (window as any).__finishOldFaviconDecode(succeed), outcome === 'resolve');
      // Wait for the old promise's continuation before checking the painted icon.
      await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
      await expect(favicon).toHaveAttribute('src', freshUrl);
      await expect(favicon).toBeVisible();
    });
  }

  for (const winner of ['https://icon.horse/icon/', 'https://favicon.yandex.net/favicon/v2/']) {
    test(`the added source ${winner} can supply a cold icon`, async ({ page }) => {
      await bootFixtureLane(page);
      await page.route(EXTERNAL_FAVICON_RE, (route) => route.request().url().startsWith(winner)
        ? route.fulfill({ status: 200, contentType: 'image/png', body: FIXTURE_PNG })
        : route.abort());
      await seedAndEnterSmallBox(page);
      await expectFaviconPainted(page);
      const expectedUrl = winner + FIXTURE_HOST + (winner.includes('yandex') ? '?size=32' : '');
      await expect(page.locator('.small-box[data-id="S1"] .bm-row__favicon')).toHaveAttribute('src', expectedUrl);
    });
  }
});

async function runRetrySample(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).__faviconIdleCallbacks?.length || 0)).toBeGreaterThan(0);
  await page.evaluate(() => {
    for (const callback of (window as any).__faviconIdleCallbacks.splice(0)) callback({ didTimeout: false, timeRemaining: () => 50 });
  });
}
