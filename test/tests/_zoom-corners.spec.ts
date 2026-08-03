import { test, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\/g, '/');

test('zoomed capture of collapsed box corner', async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_: any) {} });
  await page.waitForTimeout(600);
  await page.click('#add-box');
  await page.waitForTimeout(400);
  const lb = page.locator('.large-box').first();
  await lb.locator('.box-expand-btn').click();
  await page.waitForTimeout(400);

  // get box bounding box and screenshot just the box at 4x zoom via css zoom
  const bb = await lb.boundingBox();
  console.log('BB:', JSON.stringify(bb));
  // element screenshot full element
  await lb.screenshot({ path: 'test-results/screenshots/collapsed-largebox-only.png' });
  // also do an explicit bigradius test: set radius to 60px so we can clearly see if the corner is clipped
  await page.evaluate(() => {
    const el = document.querySelector('.large-box') as HTMLElement;
    el.style.borderRadius = '40px';
    el.style.border = '3px solid red';
  });
  await page.waitForTimeout(200);
  await lb.screenshot({ path: 'test-results/screenshots/collapsed-largebox-bigradius-debug.png' });
  console.log('done');
  await browser.close();
  expect(true).toBe(true);
});
