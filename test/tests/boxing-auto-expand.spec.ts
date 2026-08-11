import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_PATH = 'ntp/index.html';

test.describe('Auto-expand box survives enter+exit (BX-EXP-REGR)', () => {
  test('large box with collapseHover=true still expands after visiting and returning', async ({ browser }) => {
    test.setTimeout(30000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const ntpUrl = `file:///${path.join(EXTENSION_PATH, NTP_PATH).replace(/\\/g, '/')}`;
    await page.goto(ntpUrl, { waitUntil: 'networkidle', timeout: 15000 });
    page.on('pageerror', e => console.log('[PAGE ERROR]', e.message));
    await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
    await page.waitForFunction(() => (window as any).__boxingDebug, undefined, { timeout: 8000 });

    // 1. Create a large box with collapseHover=true
    const boxId = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const id = 'large-test-' + Date.now();
      dbg.layout.boxes.push({
        id, title: 'A', x: 100, y: 100, width: 320, height: 280,
        children: [], nextSmallIndex: 1, pinned: false, collapseHover: true
      });
      dbg.renderCanvas();
      return id;
    });
    expect(boxId).toBeTruthy();
    await page.waitForTimeout(300);

    const selector = '.large-box[data-id="' + boxId + '"]';

    // 2. Hover BEFORE entering — should expand
    await page.hover(selector, { force: true });
    await page.waitForTimeout(450);
    const hoverH1 = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      const expandVar = el?.style.getPropertyValue('--expand-height') || '';
      return { h: el?.getBoundingClientRect().height || 0, expandVar };
    }, selector);
    console.log('BEFORE ENTER hover:', JSON.stringify(hoverH1));
    expect(hoverH1.h).toBeGreaterThan(80);

    // 3. Move away to collapse
    await page.hover('body', { force: true });
    await page.waitForTimeout(400);

    // 4. Enter the box
    await page.evaluate((id) => {
      (window as any).__boxingDebug.enterLargeBox(id);
    }, boxId);
    await page.waitForTimeout(300);

    // 5. Exit back to canvas via back-btn
    await page.evaluate(() => {
      const backBtn = document.getElementById('back-btn') as HTMLElement;
      if (backBtn) backBtn.click();
    });
    await page.waitForTimeout(400);

    // 6. Verify classes survived
    const stateAfter = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      return {
        classes: el?.className || '',
        expandVar: el?.style.getPropertyValue('--expand-height') || '',
        h: el?.getBoundingClientRect().height || 0,
      };
    }, selector);
    console.log('AFTER EXIT:', JSON.stringify(stateAfter));
    expect(stateAfter.classes).toContain('box--hover-expand');
    expect(stateAfter.classes).toContain('box--collapsed');

    // 7. Hover AFTER exiting — should still expand
    await page.hover(selector, { force: true });
    await page.waitForTimeout(450);
    const finalH = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      return el?.getBoundingClientRect().height || 0;
    }, selector);
    console.log('AFTER EXIT hover height=' + finalH + ' (collapsed was ' + stateAfter.h + ')');
    expect(finalH).toBeGreaterThan(80);
    await ctx.close();
  });
});
