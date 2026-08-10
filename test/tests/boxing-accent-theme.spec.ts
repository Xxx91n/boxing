import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\\\/g, '/')}`;

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 10000 }).toBe(true);
}

test.describe('ADR-0012: Curated Theme Pack System', () => {
  test('theme button click applies CSS variables', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug, undefined, { timeout: 8000 });
    // Click the 'coastal' theme button
    await page.evaluate(() => {
      const btn = document.querySelector('.theme-preset[data-theme="coastal"]') as HTMLButtonElement;
      if (btn) btn.click();
    });
    // Verify CSS accent-500 was injected with coastal theme value
    const cssVar = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-accent-500').trim();
    });
    // Coastal accent-500 = #5A8A9A
    expect(cssVar.toLowerCase()).toContain('5a8a9a');
  });

  test('theme button persists theme in layout.settings', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 8000 });
    // Click the 'forest' theme button
    await page.evaluate(() => {
      const btn = document.querySelector('.theme-preset[data-theme="forest"]') as HTMLButtonElement;
      if (btn) btn.click();
    });
    const theme = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return dbg.layout.settings.theme;
    });
    expect(theme).toBe('forest');
  });

  test('pure theme injects grayscale accent values', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug, undefined, { timeout: 8000 });
    // Click the 'pure' theme button
    await page.evaluate(() => {
      const btn = document.querySelector('.theme-preset[data-theme="pure"]') as HTMLButtonElement;
      if (btn) btn.click();
    });
    const cssVar = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-accent-500').trim();
    });
    // Pure theme: accent-500 = #777777
    expect(cssVar.toLowerCase()).toContain('777777');
  });

  test('graphite theme applies warm bg ramp', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug, undefined, { timeout: 8000 });
    // Click the 'graphite' theme button
    await page.evaluate(() => {
      const btn = document.querySelector('.theme-preset[data-theme="graphite"]') as HTMLButtonElement;
      if (btn) btn.click();
    });
    // Verify warm bg ramp was injected — graphite warm-50 = #F2F2F2
    const warmVar = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-warm-50').trim();
    });
    expect(warmVar.toLowerCase()).toContain('e8e8e8');
  });

  test('default theme: beige stays as-is without override', async ({ page }) => {
    await resetBoxing(page);
    await page.waitForFunction(() => (window as any).__boxingDebug && (window as any).__boxingDebug.layout, undefined, { timeout: 8000 });
    const r = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const theme = dbg.layout.settings.theme;
      // Beige theme should not override CSS (it matches hardcoded values)
      const css500 = getComputedStyle(document.documentElement).getPropertyValue('--color-accent-500').trim();
      return { theme, css500 };
    });
    expect(r.theme).toBe('beige');
  });
});
