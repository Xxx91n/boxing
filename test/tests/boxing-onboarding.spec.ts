import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

// Smoke test for the first-run onboarding overlay.

async function resetFreshInstall(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

test.describe('Onboarding (first-run guided tour)', () => {
  test('overlay shows on fresh install with empty canvas', async ({ page }) => {
    await resetFreshInstall(page);
    const visible = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return !!ov && !ov.hidden;
    });
    expect(visible).toBe(true);
  });

  test('overlay does not show when onboardingCompleted=true (already onboarded)', async ({ page }) => {
    await resetFreshInstall(page);
    await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    const visible = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return !!ov && !ov.hidden;
    });
    expect(visible).toBe(false);
  });

  test('step navigation: Next advances through all 3 steps and dismiss sets onboardingCompleted', async ({ page }) => {
    await resetFreshInstall(page);
    // Step 1 visible
    let stepActive = await page.locator('.onboarding__step:not([hidden])').getAttribute('data-step');
    expect(stepActive).toBe('1');

    await page.locator('#onboarding-next-btn').click();
    stepActive = await page.locator('.onboarding__step:not([hidden])').getAttribute('data-step');
    expect(stepActive).toBe('2');

    await page.locator('#onboarding-prev-btn').click();
    stepActive = await page.locator('.onboarding__step:not([hidden])').getAttribute('data-step');
    expect(stepActive).toBe('1');

    await page.locator('#onboarding-next-btn').click();
    await page.locator('#onboarding-next-btn').click();
    // Step is now at last; one more click triggers close(true).
    await page.locator('#onboarding-next-btn').click();
    // After the last "Next", overlay closes and onboardingCompleted is persisted.
    await expect.poll(() => page.locator('#onboarding-overlay').isHidden()).toBe(true);
    const flag = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.onboardingCompleted);
    expect(flag).toBe(true);
  });

  test('overlay does not show when canvas already has boxes (existing user)', async ({ page }) => {
    await resetFreshInstall(page);
    // Add a large box before any onboarding dismissal — should still show because onboardingCompleted is false,
    // BUT per spec the overlay only auto-shows on empty canvas. So dismiss onboarding via the button first won't
    // matter; here we test the post-refresh scenario where boxes exist.
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    const visible = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return !!ov && !ov.hidden;
    });
    // Already showed before (savedLayout set onboardingCompleted=false); but canvas now non-empty,
    // so the overlay must NOT reappear because condition requires empty canvas.
    expect(visible).toBe(false);
  });
});
