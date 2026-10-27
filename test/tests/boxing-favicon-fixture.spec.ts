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
const EXTERNAL_FAVICON_RE = /https:\/\/(ico\.bytecook\.io|icons\.duckduckgo\.com|www\.google\.com|favicon\.im)\//;
// One controlled CDN probe answers with the fixture PNG; the other probes fail, so
// Promise.any() deterministically selects this URL and the decode/display path runs
// against a real image response.
const FIXTURE_FAVICON_URL = `https://icons.duckduckgo.com/ip3/${FIXTURE_HOST}.ico`;

async function bootFixtureLane(page: Page, opts: { faviconDelayMs?: number } = {}) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

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
});
