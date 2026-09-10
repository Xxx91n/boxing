import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp/index.html')).href;

// Ticket 10 (wave4 P2): clicking a box title (large / small / inner crumb) must enter
// rename mode with the WHOLE name pre-selected so typing replaces it directly, and the
// crumb title must also gain focus. mousedown interactions are synthetic (ticket-27
// convention: cross-browser deterministic dispatch); text input uses real keyboard on
// the focused contenteditable.
async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
  await page.waitForTimeout(300);
}

async function seedTitles(page: Page) {
  const applied = await page.evaluate(() => {
    const dbg = (window as any).__boxingDebug;
    return dbg.applyExternalLayout({
      boxes: [{
        id: 'L1', type: 'large', title: 'Alpha', x: 80, y: 80, width: 340, height: 220,
        children: [{ id: 'S1', type: 'small', title: 'Beta', x: 20, y: 20, width: 260, height: 200, pinned: false, bookmarks: [] }],
      }],
      connections: [],
      _meta: { updatedAt: Date.now() + 100000, revision: 5 },
    });
  });
  expect(applied).toBe(true);
  await expect(page.locator('.large-box')).toHaveCount(1);
}

function jsClickTitle(page: Page, sel: string) {
  return page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    return true;
  }, sel);
}

function selState(page: Page) {
  return page.evaluate(() => {
    const sel = window.getSelection();
    const active = document.activeElement as HTMLElement | null;
    return {
      text: sel ? sel.toString() : '',
      rangeCount: sel ? sel.rangeCount : 0,
      activeId: active?.id || '',
      activeClass: (active?.className || '').toString(),
      activeEditable: active?.isContentEditable || false,
    };
  });
}

const layoutTitle = (page: Page) =>
  page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].title);
const childTitle = (page: Page) =>
  page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].children[0].title);

test.describe('Ticket 10 - title click selects all (large / small / crumb)', () => {

  test('large title: click selects whole name, typing replaces, Enter saves, Escape restores', async ({ page }) => {
    test.setTimeout(30000);
    await boot(page);
    await seedTitles(page);

    const boxBefore = await page.locator('.large-box').boundingBox();
    expect(await jsClickTitle(page, '.large-box__title')).toBe(true);

    // AC1: selection string === current title text; editor focused.
    const after = await selState(page);
    expect(after.text).toBe('Alpha');
    expect(after.activeEditable).toBe(true);
    expect(after.activeClass).toContain('large-box__title');

    // AC4: clicking the title must not start a box drag.
    expect(await page.locator('.large-box').boundingBox()).toEqual(boxBefore);

    // AC3: typing replaces the whole name; Enter blurs and persists via the blur handler.
    await page.keyboard.type('Gamma', { delay: 20 });
    await expect(page.locator('.large-box__title')).toHaveText('Gamma');
    await page.keyboard.press('Enter');
    await expect.poll(() => layoutTitle(page)).toBe('Gamma');
    const blurred = await selState(page);
    expect(blurred.activeClass).not.toContain('large-box__title');

    // AC3: Escape restores the previous name and blurs without saving.
    await jsClickTitle(page, '.large-box__title');
    expect((await selState(page)).text).toBe('Gamma');
    await page.keyboard.type('X', { delay: 20 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.large-box__title')).toHaveText('Gamma');
    await expect.poll(() => layoutTitle(page)).toBe('Gamma');
  });

  test('small title: click selects whole name, typing replaces, Enter saves', async ({ page }) => {
    test.setTimeout(30000);
    await boot(page);
    await seedTitles(page);
    await page.evaluate(() => (window as any).__boxingDebug.enterLargeBox('L1'));
    await expect(page.locator('.small-box__title')).toHaveCount(1);

    const boxBefore = await page.locator('.small-box').boundingBox();
    expect(await jsClickTitle(page, '.small-box__title')).toBe(true);

    const after = await selState(page);
    expect(after.text).toBe('Beta');
    expect(after.activeEditable).toBe(true);
    expect(after.activeClass).toContain('small-box__title');
    expect(await page.locator('.small-box').boundingBox()).toEqual(boxBefore);

    await page.keyboard.type('Delta', { delay: 20 });
    await expect(page.locator('.small-box__title')).toHaveText('Delta');
    await page.keyboard.press('Enter');
    await expect.poll(() => childTitle(page)).toBe('Delta');

    await jsClickTitle(page, '.small-box__title');
    expect((await selState(page)).text).toBe('Delta');
    await page.keyboard.type('Y', { delay: 20 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.small-box__title')).toHaveText('Delta');
    await expect.poll(() => childTitle(page)).toBe('Delta');
  });

  test('crumb title: click selects all AND gains focus; Enter saves, Escape restores', async ({ page }) => {
    test.setTimeout(30000);
    await boot(page);
    await seedTitles(page);
    await page.evaluate(() => (window as any).__boxingDebug.enterLargeBox('L1'));
    await expect(page.locator('#inner-crumb-title')).toHaveText('Alpha');

    expect(await jsClickTitle(page, '#inner-crumb-title')).toBe(true);

    // AC2: crumb gets the selection AND focus (pre-ticket: no focus() call at all).
    const after = await selState(page);
    expect(after.text).toBe('Alpha');
    expect(after.activeId).toBe('inner-crumb-title');
    expect(after.activeEditable).toBe(true);

    // AC3 parity: Enter blurs (onblur saves); Escape restores without saving.
    await page.keyboard.type('Crumbed', { delay: 20 });
    await expect(page.locator('#inner-crumb-title')).toHaveText('Crumbed');
    await page.keyboard.press('Enter');
    await expect.poll(() => layoutTitle(page)).toBe('Crumbed');

    await jsClickTitle(page, '#inner-crumb-title');
    expect((await selState(page)).text).toBe('Crumbed');
    await page.keyboard.type('Z', { delay: 20 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#inner-crumb-title')).toHaveText('Crumbed');
    await expect.poll(() => layoutTitle(page)).toBe('Crumbed');
  });

  test('source contract: one shared helper, three mousedown sites, SEC-03 + ticket-09 pipeline intact', () => {
    const src = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/render.js'), 'utf8');
    // Shared helper defined once...
    expect((src.match(/function selectAllTitleText\(/g) || []).length).toBe(1);
    // ...wired into exactly the three title mousedown surfaces.
    expect((src.match(/selectAllTitleText\(title\)/g) || []).length).toBe(2);   // large + small
    expect((src.match(/selectAllTitleText\(innerCrumbTitle\)/g) || []).length).toBe(1); // crumb
    // AC4: crumb Enter/Escape contract present.
    expect(src).toContain('innerCrumbTitle.onkeydown');
    // SEC-03: plain-text paste stays on all three editable titles.
    expect((src.match(/document\.execCommand\('insertText', false, text\)/g) || []).length).toBe(3);
    // Ticket 09 scope untouched: create pipeline still renders before fire-and-forget save.
    expect(src).not.toContain('await saveLayout');
    expect((src.match(/void saveLayout\(\);/g) || []).length).toBe(3);
  });
});
