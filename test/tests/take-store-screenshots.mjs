/**
 * Store screenshot capture (ticket 36, architecture-recovery round 7).
 *
 * Captures the five Chrome Web Store / AMO listing screenshots from the REAL new-tab UI
 * of the built Chrome extension (dist/boxing-chrome/) via Playwright, in English, at
 * 1280x800, and overwrites docs/store-assets/screenshots/screenshot-*.png.
 *
 * Usage:  node test/tests/take-store-screenshots.mjs
 * Needs:  npm install (playwright + chromium), a current dist/boxing-chrome/ build.
 *
 * Semantics per docs/store-assets/screenshots/README.md:
 *   screenshot-1-canvas.png        main canvas with several boxes
 *   screenshot-2-boxes.png         box detail — bookmarks in list view
 *   screenshot-3-connections.png   boxes linked with connections (SVG lines)
 *   screenshot-4-settings.png      settings modal (appearance: theme / font / zoom)
 *   screenshot-5-bookmarks.png     bookmark edit dialog (inline, prefilled)
 *
 * The script drives the public UI plus the test-only window.__boxingDebug facade — the
 * same facade the Playwright E2E suite uses — to seed deterministic content. No manual
 * image pasting; every pixel comes from the running extension.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..', '..', 'dist', 'boxing-chrome');
const OUT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'store-assets', 'screenshots');
const VIEWPORT = { width: 1280, height: 800 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error('FAIL: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
  fail('dist/boxing-chrome/manifest.json not found — run the build first (CI or npm run build).');
}

const browser = await chromium.launchPersistentContext('', {
  headless: false,
  viewport: VIEWPORT,
  args: [
    '--load-extension=' + EXTENSION_PATH,
    '--disable-extensions-except=' + EXTENSION_PATH,
    '--no-first-run',
    '--no-default-browser-check',
    '--lang=en-US',
  ],
});

const page = await browser.newPage();
page.setDefaultTimeout(15000);

// Open the extension new tab (chrome://newtab resolves to the boxing NTP via chrome_url_overrides)
await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__boxingDebug), null, { timeout: 20000 });

// ── Force English UI language ────────────────────────────────────────────────
// persist.loadSettings() prefers layout.settings.selectedLanguage; seed it, persist,
// reload so the i18n store boots from the real _locales/en/messages.json.
const seeded = await page.evaluate(async () => {
  const dbg = window.__boxingDebug;
  dbg.layout.settings = dbg.layout.settings || {};
  dbg.layout.settings.selectedLanguage = 'en';
  dbg.layout.settings.onboardingCompleted = true;
  dbg.layout._meta = { updatedAt: Date.now() };
  await dbg.saveLayout();
  return dbg.state();
});
if (seeded && seeded.lang && seeded.lang !== 'en') {
  // saveLayout may have merged a concurrent value back; reload re-runs loadSettings anyway.
  console.log('lang before reload: ' + seeded.lang);
}
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__boxingDebug), null, { timeout: 20000 });

// Wipe any previously persisted layout so every run starts from the same clean state,
// then seed the demo content through the debug facade.
await page.evaluate(async () => {
  const dbg = window.__boxingDebug;
  // Clear current in-memory layout and storage keys owned by the extension.
  try {
    const area = (typeof browser !== 'undefined' && browser.storage && browser.storage.local)
      ? browser.storage.local
      : (chrome && chrome.storage && chrome.storage.local);
    if (area) await area.clear();
  } catch (e) { /* storage.clear unavailable — continue with in-memory wipe */ }
  dbg.layout.boxes = [];
  dbg.layout.connections = [];
  dbg.layout.groups = [];
  dbg.layout.settings = dbg.layout.settings || {};
  dbg.layout.settings.selectedLanguage = 'en';
  dbg.layout.settings.onboardingCompleted = true;
  dbg.layout._meta = { updatedAt: Date.now() };
});

// Dismiss onboarding if the overlay still appears after reload.
await page.evaluate(() => {
  if (typeof window.__boxingDebug.skipOnboarding === 'function') window.__boxingDebug.skipOnboarding();
  const ov = document.getElementById('onboarding-overlay');
  if (ov) ov.remove();
});

// ── Seed demo content (deterministic, realistic titles) ─────────────────────
const boxIds = await page.evaluate(() => {
  const dbg = window.__boxingDebug;
  const now = Date.now();
  const mkSmall = (id, title, x, y, bookmarks, isParent) => ({
    id, type: 'small', title, x, y, width: 260, height: 180,
    bookmarks: bookmarks.map((b, i) => ({ id: id + '-bm' + i, title: b[0], url: b[1] })),
    ...(isParent ? { isParent: true } : {}),
  });
  dbg.layout.boxes = [
    {
      id: 'store-projects', type: 'large', title: 'Projects', x: 80, y: 120,
      width: 340, height: 240, children: [],
    },
    {
      id: 'store-research', type: 'large', title: 'Research', x: 560, y: 90,
      width: 340, height: 240, children: [
        mkSmall('store-r-papers', 'Papers', 24, 24, [
          ['Rendering Performance', 'https://web.dev/explore/rendering-performance'],
          ['Canvas Handbook', 'https://developer.mozilla.org/docs/Web/API/Canvas_API'],
        ]),
        mkSmall('store-r-notes', 'Notes', 24, 260, [
          ['Architecture Notes', 'https://example.org/notes/architecture'],
        ]),
      ],
    },
    {
      id: 'store-reading', type: 'large', title: 'Reading', x: 330, y: 430,
      width: 340, height: 240, children: [],
    },
  ];
  dbg.layout._meta = { updatedAt: now };
  dbg.renderCanvas();
  dbg.saveLayout();
  return dbg.layout.boxes.map((b) => b.id);
});
await sleep(600);

const shot = (n) => path.join(OUT_DIR, 'screenshot-' + n + '.png');

// ── Screenshot 1: main canvas with several boxes ────────────────────────────
{
  const state = page.evaluate(() => window.__boxingDebug.state());
  console.log('state before shot 1: ' + JSON.stringify(await state));
}
await page.screenshot({ path: shot('1-canvas') });
console.log('Screenshot 1 (canvas): captured');

// ── Screenshot 2: box detail with bookmarks in list view ────────────────────
await page.evaluate(() => window.__boxingDebug.enterLargeBox('store-research'));
await sleep(900);
const innerVisible = await page.evaluate(() => {
  const inner = document.getElementById('inner');
  return inner && !inner.hidden && document.querySelectorAll('.small-box').length;
});
if (!innerVisible) fail('inner surface not visible for screenshot 2');
await page.screenshot({ path: shot('2-boxes') });
console.log('Screenshot 2 (boxes): captured, small boxes visible = ' + innerVisible);

// ── Screenshot 3: connection lines between boxes on the canvas ──────────────
await page.evaluate(() => window.__boxingDebug.exitToCanvas ? window.__boxingDebug.exitToCanvas() : document.getElementById('back-btn').click());
await sleep(900);
const connAdded = await page.evaluate(() => {
  const dbg = window.__boxingDebug;
  const [projects, research, reading] = ['store-projects', 'store-research', 'store-reading'];
  const a = dbg.addConnection(dbg.largeKey(projects), dbg.largeKey(research));
  const b = dbg.addConnection(dbg.largeKey(research), dbg.largeKey(reading));
  dbg.saveLayout();
  dbg.renderConnections();
  return { a, b, lines: dbg.connCount() };
});
if (!connAdded.a || !connAdded.b || connAdded.lines < 2) {
  fail('connections not rendered: ' + JSON.stringify(connAdded));
}
// settle the rAF-deferred connection render
await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
await sleep(300);
await page.screenshot({ path: shot('3-connections') });
console.log('Screenshot 3 (connections): captured, lines = ' + connAdded.lines);

// ── Screenshot 4: settings modal — appearance tab (theme/font/zoom) ─────────
await page.locator('#settings-btn').click();
await page.waitForSelector('#settings-modal:not([hidden])', { timeout: 5000 });
// README label: "settings/modal with theme, font, zoom options" → Appearance tab
await page.locator('.settings-nav__item[data-tab="appearance"]').click();
await page.waitForSelector('#tab-appearance:not([hidden])', { timeout: 5000 });
await sleep(400);
await page.screenshot({ path: shot('4-settings') });
console.log('Screenshot 4 (settings): captured (appearance tab)');
await page.locator('.modal__close').click();
await sleep(400);

// ── Screenshot 5: bookmark editing dialog (inline edit popup, prefilled) ────
await page.evaluate(() => window.__boxingDebug.enterLargeBox('store-research'));
await sleep(900);
const editBtnCount = await page.locator('.bm-row__edit-btn').count();
if (editBtnCount < 1) fail('no bookmark edit button found for screenshot 5');
await page.locator('.bm-row__edit-btn').first().click();
await page.waitForSelector('.bm-edit-popup', { timeout: 5000 });
await sleep(400);
await page.screenshot({ path: shot('5-bookmarks') });
console.log('Screenshot 5 (bookmarks): captured, edit popup open');

await browser.close();
console.log('All 5 screenshots captured to ' + OUT_DIR);
