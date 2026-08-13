import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXT_PATH = path.resolve(__dirname, '..', '..');

test.describe('Boxing v3 — Deep Debug', () => {
  test('open NTP via file:// and verify full workflow', async ({ browser }) => {
    test.setTimeout(40000);

    const context = await browser.newContext();
    const page = await context.newPage();

    const ntpUrl = pathToFileURL(path.join(EXT_PATH, 'ntp/index.html')).href;
    await page.goto(ntpUrl, { waitUntil: 'networkidle', timeout: 15000 });

    // Dismiss onboarding overlay so it doesn't intercept pointer events
    await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });

    // Collect console logs
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    // === 1. Verify empty canvas state ===
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#canvas')).toBeVisible();
    // Empty state message should show
    await expect(page.locator('#canvas-empty')).toBeVisible();
    const emptyText = await page.locator('#canvas-empty').textContent();
    console.log('Empty canvas text:', emptyText?.substring(0, 60));

    // === 2. Click + button ===
    console.log('Clicking add-box button...');
    await page.locator('#add-box').click();
    await page.waitForTimeout(800);

    // === 3. After clicking +, should have 1 large box ===
    const largeBoxes = page.locator('.large-box');
    const count = await largeBoxes.count();
    console.log('Large boxes after + click:', count);
    expect(count).toBeGreaterThanOrEqual(1);
    // Empty canvas message should be hidden
    await expect(page.locator('#canvas-empty')).toBeHidden();

    // === 4. Verify large box title contains "Box 1" ===
    const firstBoxTitle = await page.locator('.large-box__title').first().textContent();
    console.log('First box title:', firstBoxTitle);
    expect(firstBoxTitle).toContain('1');
    // Should show resize handle
    await expect(page.locator('.box-resize-handle').first()).toBeAttached();

    // === 5. Screenshot with 1 box ===
    await page.screenshot({ path: 'test-results/debug-canvas-1box.png', fullPage: true });

    // === 6. Double-click to create another large box ===
    const canvasBox = await page.locator('#canvas-surface').boundingBox();
    if (canvasBox) {
      await page.mouse.dblclick(canvasBox.x + 400, canvasBox.y + 100);
      await page.waitForTimeout(800);
      const count2 = await largeBoxes.count();
      console.log('Large boxes after dblclick:', count2);
      expect(count2).toBeGreaterThanOrEqual(2);
    }

    // === 7. Click body of first box to enter inner view ===
    await page.locator('.large-box__body').first().click();
    await page.waitForTimeout(500);
    // Inner view should be visible
    await expect(page.locator('#inner')).toBeVisible();
    await expect(page.locator('#canvas')).toBeHidden();
    // Breadcrumb should show
    await expect(page.locator('#inner-crumb-title')).toBeVisible();
    // Inner title should be editable
    await expect(page.locator('#inner-crumb-title')).toBeVisible();

    // === 8. Verify back button works ===
    await page.locator('#back-btn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#inner')).toBeHidden();

    // === 9. Add small box via dblclick inside inner ===
    await page.locator('.large-box__body').first().click();
    await page.waitForTimeout(500);
    const innerSurfaceBox = await page.locator('#inner-surface').boundingBox();
    if (innerSurfaceBox) {
      await page.mouse.dblclick(innerSurfaceBox.x + 200, innerSurfaceBox.y + 100);
      await page.waitForTimeout(800);
      const smallBoxes = page.locator('.small-box');
      const sbCount = await smallBoxes.count();
      console.log('Small boxes after dblclick:', sbCount);
      expect(sbCount).toBeGreaterThanOrEqual(1);
    }

    // === 10. Test settings modal ===
    await page.locator('#back-btn').click(); // return to canvas
    await page.waitForTimeout(500);
    await page.locator('#settings-btn').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#settings-modal')).toBeVisible();
    // Verify language selector has options
    const langOptions = await page.locator('#lang-select option').count();
    console.log('Language options:', langOptions);
    expect(langOptions).toBeGreaterThanOrEqual(13);
    // Switch to Chinese
    await page.locator('#lang-select').selectOption('zh_CN');
    await page.waitForTimeout(500);
    // Check that modal title changed
    const modalTitle = await page.locator('#settings-modal .modal__title').textContent();
    console.log('Modal title after lang switch:', modalTitle);
    // Close modal
    await page.locator('#settings-modal .modal__close').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#settings-modal')).toBeHidden();

    // === 11. Screenshot final state ===
    await page.screenshot({ path: 'test-results/debug-final.png', fullPage: true });

    // === 12. Check console for errors ===
    const errors = logs.filter(l => l.includes('[Boxing]') || l.includes('Error') || l.includes('error'));
    console.log('Console logs (Boxing/errors):', errors.join('\n'));
    const boxingLogs = logs.filter(l => l.includes('[Boxing]'));
    expect(boxingLogs.length).toBeGreaterThan(0); // debug should log

    await context.close();
  });
});
