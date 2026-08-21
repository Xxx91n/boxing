import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..', '..', 'dist', 'boxing-chrome');
const OUT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'store-assets', 'screenshots');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      '--load-extension=' + EXTENSION_PATH,
      '--disable-extensions-except=' + EXTENSION_PATH,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  const page = await browser.newPage();
  await page.goto('chrome://newtab', { waitUntil: 'networkidle' });
  await sleep(2000);

  // Dismiss onboarding overlay
  await page.evaluate(() => {
    if (typeof window.skipOnboarding === 'function') window.skipOnboarding();
    const ov = document.getElementById('onboarding-overlay');
    if (ov) ov.remove();
  });
  await sleep(500);

  // Screenshot 1: Empty canvas
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-1-canvas.png') });
  console.log('Screenshot 1: canvas captured');

  // Create boxes by double-clicking canvas
  const canvas = page.locator('#canvas-surface');
  await canvas.dblclick({ position: { x: 200, y: 200 } });
  await sleep(1000);
  await canvas.dblclick({ position: { x: 500, y: 300 } });
  await sleep(800);
  await canvas.dblclick({ position: { x: 800, y: 150 } });
  await sleep(800);

  // Screenshot 2: Boxes on canvas
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-2-boxes.png') });
  console.log('Screenshot 2: boxes captured');

  // Screenshot 3: Connections (just more boxes + canvas state)
  await canvas.dblclick({ position: { x: 350, y: 500 } });
  await sleep(800);
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-3-connections.png') });
  console.log('Screenshot 3: connections captured');

  // Screenshot 4: Settings panel
  await page.locator('#settings-btn').click();
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-4-settings.png') });
  console.log('Screenshot 4: settings captured');

  // Close settings
  const closeBtn = page.locator('.settings-close, [data-action="close-settings"], .modal-close');
  if (await closeBtn.count() > 0) { await closeBtn.first().click(); await sleep(500); }
  else { await page.keyboard.press('Escape'); await sleep(500); }

  // Screenshot 5: Enter a box to show bookmark view
  const firstBox = page.locator('.large-box').first();
  if (await firstBox.count() > 0) { await firstBox.click(); await sleep(1500); }
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-5-bookmarks.png') });
  console.log('Screenshot 5: bookmarks captured');

  await browser.close();
  console.log('All 5 screenshots captured to', OUT_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });