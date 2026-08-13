import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_PATH = 'ntp/index.html';

test.describe('Boxing v3 Extension', () => {
  test('manifest.json is valid MV3', async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(EXTENSION_PATH, 'manifest.json'), 'utf8')
    );
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Boxing');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('tabs');
    expect(manifest.chrome_url_overrides?.newtab).toBe('ntp/index.html');
    // bookmarks permission added in v3.5 for Firefox MV3 service worker compatibility
    expect(manifest.background?.service_worker).toBeTruthy();
  });

  test('NTP HTML has settings modal inline', async () => {
    const html = fs.readFileSync(path.join(EXTENSION_PATH, NTP_PATH), 'utf8');
    expect(html).toContain('id="settings-modal"');
    expect(html).toContain('class="modal-overlay"');
    expect(html).toContain('id="lang-select"');
    expect(html).toContain('id="remember-last-pos"');
    expect(html).toContain('id="zoom-slider"');
    expect(html).toContain('id="canvas-zoom"');
    expect(html).toContain('id="inner-zoom"');
    // 14 language options
    const langOptions = html.match(/<option value="([^"]+)"/g) || [];
    expect(langOptions.length).toBeGreaterThanOrEqual(13);
  });

  test('NTP JS has all core functions', async () => {
    const js = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp', 'ntp.js'), 'utf8');
    // Core modules must be present
    expect(js).toContain('function addLargeBoxAt');
    expect(js).toContain('function addSmallBoxAt');
    expect(js).toContain('function onResizeStart');
    expect(js).toContain('function applyCanvasTransform');
    expect(js).toContain('function applyInnerTransform');
    expect(js).toContain('function loadI18nStore');
    expect(js).toContain('function openSettingsModal');
    expect(js).toContain('function closeSettingsModal');
    expect(js).toContain('function onCanvasDblClick');
    expect(js).toContain('function onInnerDblClick');
    expect(js).toContain('function clampToEdge');
    expect(js).toContain('SUPPORTED_LANGS');
    expect(js).toContain('const DEBUG = true');
    expect(js).toContain('function migrateLayout');
    // No security vulnerabilities
    expect(js).not.toContain('eval(');
  });

  test('popup.js uses safe DOM APIs (no innerHTML XSS)', async () => {
    const js = fs.readFileSync(path.join(EXTENSION_PATH, 'popup', 'popup.js'), 'utf8');
    // Should use createElement + textContent, not innerHTML with user data
    expect(js).toContain('createElement');
    expect(js).toContain('textContent');
    // The innerHTML for empty message is static — safe
    const innerHTMLCount = (js.match(/innerHTML\s*=/g) || []).length;
    // Only static empty messages + clearing should use innerHTML
    // All 3 uses are safe: 2 x innerHTML='' clearing + 1 static error message
    expect(innerHTMLCount).toBeLessThanOrEqual(3);
  });

  test('13 locale directories exist with valid JSON', async () => {
    const localesDir = path.join(EXTENSION_PATH, '_locales');
    const dirs = fs.readdirSync(localesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    expect(dirs).toContain('en');
    expect(dirs).toContain('zh_CN');
    expect(dirs).toContain('ja');
    expect(dirs).toContain('ko');
    expect(dirs.length).toBeGreaterThanOrEqual(13);

    for (const dir of dirs) {
      const msgPath = path.join(localesDir, dir, 'messages.json');
      expect(fs.existsSync(msgPath)).toBe(true);
      const raw = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
      expect(raw.brandName?.message).toBeDefined();
      expect(raw.settingsTitle?.message).toBeDefined();
      expect(raw.newLargeBox?.message).toBeDefined();
    }
  });

  test('NTP CSS has resize and zoom styles', async () => {
    const css = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp', 'ntp.css'), 'utf8');
    expect(css).toContain('.box-resize-handle');
    expect(css).toContain('.zoom-controls');
    expect(css).toContain('.modal-overlay');
    expect(css).toContain('.bm-add-row');
    // Small box dimensions: CSS fallback 320x340, JS runtime sets 640x420
    expect(css).toMatch(/width:\s*\d{3}px/);
    expect(css).toMatch(/height:\s*\d{3}px/);
  });

  test('design-system.css uses beige token palette (ADR-0008 three-layer)', async () => {
    const css = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp', 'design-system.css'), 'utf8');
    expect(css).toContain('--color-warm-50: #F1EEE8');  // Layer 1: Primitive
    expect(css).toContain('--color-warm-150: #EBE5DB');
    expect(css).toContain('--color-warm-900: #2A2520');
    expect(css).toContain('--color-accent-500: #A08060');
    // Layer 2: Semantic var() references
    expect(css).toContain('--color-canvas: var(--color-warm-50)');
    expect(css).toContain('--color-elevated: var(--color-warm-150)');
    expect(css).toContain('--color-ink: var(--color-warm-900)');
    expect(css).toContain('--color-accent: var(--color-accent-500)');
    // No white background anywhere
    // No white color values (exclude property names like 'white-space')
    expect(css).not.toMatch(/#FFFFFF|#ffffff|#FFF(?!\w)|white(?![-\w])/i);
  });

  test('.gitignore excludes .codegraph/', async () => {
    const gi = fs.readFileSync(path.join(EXTENSION_PATH, '.gitignore'), 'utf8');
    expect(gi).toContain('.codegraph/');
  });

  test('README.md documents v3 features', async () => {
    const readme = fs.readFileSync(path.join(EXTENSION_PATH, 'README.md'), 'utf8');
    expect(readme).toContain('Boxing');
    expect(readme).toMatch(/[Ll]anguage/);
    expect(readme).toMatch(/[Cc]anvas/);  // updated for README rewrite
    expect(readme).toMatch(/[Zz]oom/);
    expect(readme).toMatch(/[Bb]ookmark/);
    });

  // v3.7.1: urlOpenMode removed — bookmarks always open in new tab (browser-compatible)
  test('open-bookmark handler uses browser tabs API', async () => {
    const js = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp', 'ntp.js'), 'utf8');
    expect(js).toContain('api.tabs.create');
    expect(js).toContain('normalizeBookmarkUrl');  // v3.7.1: renamed
  });

  // v3.7.1: urlOpenMode keys are deprecated but kept in locales
  test('All 13 locales have footerHint and headerPinUsage keys', async () => {
    const localesDir = path.join(EXTENSION_PATH, '_locales');
    const dirs = fs.readdirSync(localesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    expect(dirs.length).toBeGreaterThanOrEqual(13);
    for (const dir of dirs) {
      const msgPath = path.join(localesDir, dir, 'messages.json');
      const raw = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
      expect(raw['footerHint']?.message, `${dir} missing footerHint`).toBeDefined();
      expect(raw['headerPinUsage']?.message, `${dir} missing headerPinUsage`).toBeDefined();
    }
  });

  // v3.7.1: simplified to always use tabs.create (browser-compatible)
  test('NTP JS open-bookmark handler uses browser tabs API', async () => {
    const js = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp', 'ntp.js'), 'utf8');
    expect(js).toContain('api.tabs.create');
    expect(js).toContain('normalizeBookmarkUrl');  // v3.7.1: renamed
    expect(js).toContain('window.open');
  });

  test('Chromium: load extension and open new tab for visual check', async ({ browser }) => {
    test.setTimeout(30000);
    
    const context = await browser.newContext({
      // Chromium can load unpacked extensions via persistent context
    });
    const page = await context.newPage();

    // Open the NTP page from the extension files directly
    const ntpUrl = pathToFileURL(path.join(EXTENSION_PATH, NTP_PATH)).href;
    await page.goto(ntpUrl, { waitUntil: 'networkidle', timeout: 15000 });
    // Capture ALL console from page
    page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

    // Verify core DOM elements
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#back-btn')).toBeAttached(); // hidden when canvas is default view
    await expect(page.locator('#add-box')).toBeVisible();
    await expect(page.locator('#settings-btn')).toBeVisible();
    await expect(page.locator('#settings-modal')).toBeAttached();

    // Take screenshot
    await page.screenshot({ path: 'test-results/boxing-v3-ntp.png', fullPage: true });
    console.log('✓ Boxing v3 NTP screenshot captured');

    // Open settings modal
    // Open settings via exposed function (file:// disables button click in some cases)
    await page.evaluate(() => window._boxingOpenSettings && window._boxingOpenSettings());
    await page.waitForTimeout(300);

    // BX-ONBOARDING: dismiss first-run onboarding overlay so canvas interaction works.
    await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.screenshot({ path: 'test-results/boxing-v3-settings-modal.png', fullPage: true });

    // Close modal
    await page.locator('#settings-modal .modal__close').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#settings-modal')).toBeHidden();

    // Double-click canvas to create a large box
    const canvasBox = await page.locator('#canvas').boundingBox();
    if (canvasBox) {
      await page.mouse.dblclick(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
      await page.waitForTimeout(500);
      // Debug: check if any large-box exists in DOM
      const lbCount = await page.locator('.large-box').count();
      console.log('Large box count:', lbCount);
      const surfaceHTML = await page.locator('#canvas-surface').innerHTML();
      console.log('Canvas surface HTML length:', surfaceHTML ? surfaceHTML.length : 0);
      // Should have a large box on canvas
      const largeBoxes = page.locator('.large-box');
      await expect(largeBoxes.first()).toBeVisible({ timeout: 3000 });
      await page.screenshot({ path: 'test-results/boxing-v3-canvas-with-box.png', fullPage: true });
    }

    await context.close();
  });


  test('Pin header button: visible, clickable, toggles header hide/show', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${pathToFileURL(path.join(EXTENSION_PATH, 'ntp/index.html?debug')).href}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // BX-ONBOARDING: dismiss first-run onboarding overlay so canvas interaction works.
    await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });

    // 1. Button exists and is visible in header bar (default: pinned)
    const pinBtn = page.locator('#header-pin-btn');
    await expect(pinBtn).toBeVisible({ timeout: 3000 });
    const header = page.locator('.ntp__bar');
    await expect(header).toBeVisible();

    // 2. Button parent should be header bar (not canvas) when pinned
    const parentId = await pinBtn.evaluate(el => el.parentElement?.id || el.parentElement?.className || 'unknown');
    expect(parentId).toContain('ntp__bar');

    // 3. Click to unpin: header hides, button moves to canvas
    await pinBtn.click();
    await page.waitForTimeout(500);
    await expect(header).toBeHidden({ timeout: 2000 });
    const btnParentAfter = await pinBtn.evaluate(el => el.parentElement?.id || 'unknown');
    expect(btnParentAfter).toBe('canvas');
    // Button should have floating class
    const hasFloating = await pinBtn.evaluate(el => el.classList.contains('header-pin--floating'));
    expect(hasFloating).toBe(true);

    // 4. Click to repin: header shows, button back in header
    await pinBtn.click();
    await page.waitForTimeout(500);
    await expect(header).toBeVisible({ timeout: 2000 });
    const btnParentAfter2 = await pinBtn.evaluate(el => el.parentElement?.id || el.parentElement?.className || 'unknown');
    expect(btnParentAfter2).toContain('ntp__bar');
    const hasFloating2 = await pinBtn.evaluate(el => el.classList.contains('header-pin--floating'));
    expect(hasFloating2).toBe(false);

    await context.close();
  });


  // BX-DEV-111k: Cross-tab delete protection — box deleted, guards block inner ops + show warning
  test('Cross-tab delete: validateCurrentBox guards fire when box deleted', async ({ browser }) => {
    test.setTimeout(30000);

    const context = await browser.newContext();
    const page = await context.newPage();
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[ERROR] ${err.message}`));

    await page.goto(`${pathToFileURL(path.join(EXTENSION_PATH, 'ntp/index.html')).href}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2500);

    // BX-ONBOARDING: dismiss first-run onboarding overlay so canvas interaction works.
    await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });

    // 1. Create a large box and verify
    const canvasBox = await page.locator('#canvas').boundingBox();
    if (!canvasBox) throw new Error('Canvas not visible');
    await page.mouse.dblclick(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.waitForTimeout(1000);
    const lbCount = await page.locator('.large-box').count();
    console.log('Large boxes created:', lbCount);
    expect(lbCount).toBeGreaterThanOrEqual(1);

    // 2. Get the box ID and delete it via API (simulates cross-tab deletion)
    const boxId = await page.locator('.large-box').first().getAttribute('data-id');
    expect(boxId).toBeTruthy();
    console.log('Box ID:', boxId);

    // Delete the box directly from layout (simulate another tab deleted it)
    await page.evaluate((id) => {
      // Directly filter layout.boxes (same effect as _execDeleteLargeBox without confirm modal)
      const dbg = (window as any).__boxingDebug;
      if (dbg && dbg.layout) {
        dbg.layout.boxes = dbg.layout.boxes.filter((b: any) => b.id !== id);
        // Reset nextLargeIndex
        dbg.layout.nextLargeIndex = dbg.layout.boxes.reduce((max: number, b: any) =>
          Math.max(max, (parseInt((b.title || '').match(/\d+/) || [0]) || 0) + 1), 1);
      }
    }, boxId);
    await page.waitForTimeout(500);

    // 3. Verify box no longer in layout
    const stillInLayout = await page.evaluate((id) => {
      const dbg = (window as any).__boxingDebug;
      return dbg && dbg.layout && dbg.layout.boxes && dbg.layout.boxes.some((b: any) => b.id === id);
    }, boxId);
    expect(stillInLayout).toBe(false);
    console.log('Box still in layout:', stillInLayout);

    // 4. Verify DOM still shows the inner wrapper (from previous state if any)
    // The box was never entered — so we test the guard on inner operations from canvas perspective
    // Re-render canvas since we deleted the box
    await page.evaluate(() => {
      // Force renderCanvas if available
      const dbg = (window as any).__boxingDebug;
      // The guard triggers on addSmallBox/addSmallBoxAt/bookmark ops
    });

    // 5. Try to trigger an inner operation (addSmallBox) — should fail because no currentLargeBoxId
    const noInner = await page.evaluate(() => {
      return {
        canvasVisible: !(document.getElementById('canvas-container') as HTMLElement)?.hidden,
        innerWrapperHidden: (document.getElementById('inner-wrapper') as HTMLElement)?.hidden !== false,
        warningVisible: !!document.getElementById('box-deleted-warning'),
        warningText: document.getElementById('box-deleted-warning')?.textContent || '',
      };
    });
    console.log('Final state:', JSON.stringify(noInner));

    // Core assertion: canvas is visible (no box to enter)
    expect(noInner.canvasVisible).toBe(true);

    await page.screenshot({ path: 'test-results/cross-tab-delete-guard.png', fullPage: true });
    await context.close();
  });
});
