import { test, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\/g, '/');

test('repro corners bug (auto-expand box top corners)', async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e && e.message || e)));

  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_: any) {} });
  await page.waitForTimeout(600);

  await page.click('#add-box');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/screenshots/01-largebox-default.png' });

  const lb = page.locator('.large-box').first();
  await lb.locator('.box-expand-btn').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/screenshots/02-largebox-collapsed.png' });

  // computed radius collapsed
  const br = await page.evaluate(() => {
    const el = document.querySelector('.large-box') as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { borderRadius: cs.borderRadius, width: cs.width, height: cs.height, classList: Array.from(el.classList), maxH: cs.maxHeight };
  });
  console.log('LARGE COLLAPSED computed:', JSON.stringify(br));

  await lb.hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/screenshots/03-largebox-hover-expand.png' });

  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/screenshots/04-largebox-collapsed-again.png' });

  // enter large box, create small box
  await lb.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/screenshots/05-inner-page.png' });

  // inner add button
  const innerAdd = page.locator('.inner__canvas-head button').last();
  await innerAdd.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/screenshots/06-smallbox-default.png' });

  const sb = page.locator('.small-box').first();
  await sb.locator('.box-expand-btn').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/screenshots/07-smallbox-collapsed.png' });

  const sbBR = await page.evaluate(() => {
    const el = document.querySelector('.small-box') as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { borderRadius: cs.borderRadius, width: cs.width, height: cs.height, classList: Array.from(el.classList), maxH: cs.maxHeight };
  });
  console.log('SMALL COLLAPSED computed:', JSON.stringify(sbBR));

  await sb.hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/screenshots/08-smallbox-hover-expand.png' });

  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/screenshots/09-smallbox-collapsed-again.png' });

  console.log('PAGE ERRORS:', errors.length);
  errors.slice(0, 8).forEach(e => console.log('  -', String(e).slice(0, 200)));
  await browser.close();
  expect(true).toBe(true);
});
