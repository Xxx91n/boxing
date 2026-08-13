import { test, expect, chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

test('probe collapsed box computed styles', async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_: any) {} });
  await page.waitForTimeout(600);
  await page.click('#add-box');
  await page.waitForTimeout(400);
  const lb = page.locator('.large-box').first();
  // toggle collapse
  await lb.locator('.box-expand-btn').click();
  await page.waitForTimeout(400);

  const probe = await page.evaluate(() => {
    const el = document.querySelector('.large-box') as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const barCs = el.querySelector('.large-box__bar') ? getComputedStyle(el.querySelector('.large-box__bar') as Element) : null;
    return {
      box: {
        borderRadius: cs.borderRadius,
        borderTopLeftRadius: cs.borderTopLeftRadius,
        borderTopRightRadius: cs.borderTopRightRadius,
        height: cs.height, maxHeight: cs.maxHeight, overflow: cs.overflow,
        width: cs.width, background: cs.backgroundColor, border: cs.border,
        hasSquareCorners: document.getElementById('app')?.classList.contains('ntp--square-corners'),
        inlineStyle: el.getAttribute('style')
      },
      bar: barCs ? { borderBttm: barCs.borderBottom, background: barCs.backgroundColor, height: barCs.height, borderRadius: barCs.borderRadius } : null
    };
  });
  console.log('PROBE:', JSON.stringify(probe, null, 2));
  await browser.close();
  expect(true).toBe(true);
});
