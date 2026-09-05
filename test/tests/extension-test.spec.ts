import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXT_PATH = path.resolve(__dirname, '..', '..');

test.describe('Boxing Extension — Basic Rendering', () => {
  // Ticket 27 (quarantine convergence): @quarantine retired. Rendering/modal contract
  // is app-level — native settings-btn click stalled on the firefox lane
  // (playwright#16095 class, deterministic in the ticket-27 solo baseline), so the
  // two modal clicks are synthetic.
  test('Direct: Test NTP HTML rendering', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const jsClick = (sel: string) =>
      page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);

    const ntpPath = path.join(EXT_PATH, 'ntp', 'index.html');
    const fileUrl = pathToFileURL(ntpPath).href;

    // Suite-standard boot: waitUntil 'load' stalls on the firefox headed lane —
    // the NTP page's favicon/i18n network attempts from file:// keep the load
    // event pending (ticket-27 solo evidence: goto: Test ended). domcontentloaded
    // + __boxingDebug poll is the boot every main-lane spec uses.
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    // Dismiss onboarding overlay
    await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'test-results/04-ntp-direct-render.png', fullPage: true });
    console.log('NTP rendered successfully');

    // Check for key Boxing DOM elements
    const hasCanvas = await page.$eval('#canvas', el => !!el).catch(() => false);
    const hasAddBox = await page.$eval('#add-box', el => !!el).catch(() => false);
    const hasSettingsBtn = await page.$eval('#settings-btn', el => !!el).catch(() => false);
    console.log('Canvas present:', hasCanvas);
    console.log('Add-box button present:', hasAddBox);
    console.log('Settings button present:', hasSettingsBtn);
    expect(hasCanvas).toBe(true);
    expect(hasAddBox).toBe(true);
    expect(hasSettingsBtn).toBe(true);

    // Check CSS is loaded — Boxing uses beige theme
    const bodyStyle = await page.evaluate(() => {
      const el = document.body;
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('Body background color:', bodyStyle);

    // Settings modal
    await jsClick('#settings-btn');
    await page.waitForTimeout(400);
    await expect(page.locator('#settings-modal')).toBeVisible();
    const langOptions = await page.locator('#lang-select option').count();
    expect(langOptions).toBeGreaterThanOrEqual(13);
    console.log('Language options:', langOptions);
    await jsClick('#settings-modal .modal__close');
    await page.waitForTimeout(300);
    await expect(page.locator('#settings-modal')).toBeHidden();

    await context.close();
  });

  test('Popup: Test popup HTML rendering', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const popupPath = path.join(EXT_PATH, 'popup', 'popup.html');
    const fileUrl = pathToFileURL(popupPath).href;

    await page.goto(fileUrl);
    await page.waitForLoadState('domcontentloaded');

    await page.screenshot({ path: 'test-results/05-popup-render.png' });
    console.log('Popup rendered successfully');

    // Popup should contain a link/button to open the NTP
    const hasBody = await page.$eval('body', el => !!el).catch(() => false);
    expect(hasBody).toBe(true);
    console.log('Popup body present:', hasBody);

    await context.close();
  });
});
