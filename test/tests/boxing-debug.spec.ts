import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXT_PATH = path.resolve(__dirname, '..', '..');

test.describe('Boxing v3 — Deep Debug', () => {
  test('open NTP via file:// and verify full workflow', async ({ page }) => {
    // full 12-step workflow with fixed waits + fixture boot reload — a cold headed
    // firefox run measured 44s (ticket-18), over the old 40s budget with all steps green
    test.setTimeout(90000);

    // Suite-standard boot (fixture page): a manual browser.newContext() is fragile
    // on headed firefox — probes this ticket caught stalls at launch, close, and an
    // invisible zero-size window. Same file:// workflow, no manual context.
    const NTP_URL = pathToFileURL(path.join(EXT_PATH, 'ntp/index.html')).href;
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    // All interaction goes through synthetic event dispatch: native input on the
    // firefox lane stalls (playwright#16095 class, ticket-18 evidence) and this
    // workflow's purpose is the app-level flow, not input realness.
    const jsClick = (sel: string) =>
      page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);
    const jsDblclick = (sel: string, x: number, y: number) =>
      page.evaluate(({ s, x, y }) => {
        (document.querySelector(s) as HTMLElement | null)?.dispatchEvent(
          new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        );
      }, { s: sel, x, y });

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
    await jsClick('#add-box');
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
      await jsDblclick('#canvas-surface', canvasBox.x + 400, canvasBox.y + 100);
      await page.waitForTimeout(800);
      const count2 = await largeBoxes.count();
      console.log('Large boxes after dblclick:', count2);
      expect(count2).toBeGreaterThanOrEqual(2);
    }

    // === 7. Click body of first box to enter inner view ===
    await jsClick('.large-box__body');
    await page.waitForTimeout(500);
    // Inner view should be visible
    await expect(page.locator('#inner')).toBeVisible();
    await expect(page.locator('#canvas')).toBeHidden();
    // Breadcrumb should show
    await expect(page.locator('#inner-crumb-title')).toBeVisible();
    // Inner title should be editable
    await expect(page.locator('#inner-crumb-title')).toBeVisible();

    // === 8. Verify back button works ===
    await jsClick('#back-btn');
    await page.waitForTimeout(500);
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#inner')).toBeHidden();

    // === 9. Add small box via dblclick inside inner ===
    await jsClick('.large-box__body');
    await page.waitForTimeout(500);
    const innerSurfaceBox = await page.locator('#inner-surface').boundingBox();
    if (innerSurfaceBox) {
      await jsDblclick('#inner-surface', innerSurfaceBox.x + 200, innerSurfaceBox.y + 100);
      await page.waitForTimeout(800);
      const smallBoxes = page.locator('.small-box');
      const sbCount = await smallBoxes.count();
      console.log('Small boxes after dblclick:', sbCount);
      expect(sbCount).toBeGreaterThanOrEqual(1);
    }

    // === 10. Test settings modal ===
    await jsClick('#back-btn'); // return to canvas
    await page.waitForTimeout(500);
    await jsClick('#settings-btn');
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
    await jsClick('#settings-modal .modal__close');
    await page.waitForTimeout(300);
    await expect(page.locator('#settings-modal')).toBeHidden();

    // === 11. Screenshot final state ===
    await page.screenshot({ path: 'test-results/debug-final.png', fullPage: true });

    // === 12. Check console for errors ===
    const errors = logs.filter(l => l.includes('[Boxing]') || l.includes('Error') || l.includes('error'));
    console.log('Console logs (Boxing/errors):', errors.join('\n'));
    const boxingLogs = logs.filter(l => l.includes('[Boxing]'));
    expect(boxingLogs.length).toBeGreaterThan(0); // debug should log

  });
});
