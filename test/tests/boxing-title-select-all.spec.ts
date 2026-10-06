import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { dismissOnboarding } from '../helpers/onboarding';
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
  await dismissOnboarding(page);
  await page.waitForTimeout(300);
}

async function seedTitles(page: Page) {
  const applied = await page.evaluate(() => {
    const dbg = (window as any).__boxingDebug;
    // 48 (wave4 residual title-select-all x3): a raw without version>=3 is degraded
    // to defaultLayout by migrateLayout (its _meta — including revision 5 — dropped),
    // so the stale-revision guard rejects the apply and seedTitles sees applied=false.
    // Real cross-tab payloads always carry the persisted version field; match that.
    return dbg.applyExternalLayout({
      version: 3.5,
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
    // D-003: focus-state machine defined once...
    expect((src.match(/function makeTitleFocusMachine\(/g) || []).length).toBe(1);
    // ...wired into exactly the three title surfaces.
    expect((src.match(/makeTitleFocusMachine\(title\)/g) || []).length).toBe(2);   // large + small
    expect((src.match(/makeTitleFocusMachine\(innerCrumbTitle\)/g) || []).length).toBe(1); // crumb
    // AC4: crumb Enter/Escape contract present.
    expect(src).toContain('innerCrumbTitle.onkeydown');
    // SEC-03: plain-text paste stays on all three editable titles.
    expect((src.match(/document\.execCommand\('insertText', false, text\)/g) || []).length).toBe(3);
    // Ticket 09 scope untouched: create pipeline still renders before fire-and-forget save.
    expect(src).not.toContain('await saveLayout');
    expect((src.match(/void saveLayout\(\);/g) || []).length).toBe(3);
  });

  test('D-003 source contract: per-focus flag + mouseup re-assert guard present', () => {
    const src = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/render.js'), 'utf8');
    // Per-focus-cycle flag (not a bare "first ever click" boolean) gates the select-all.
    expect(src).toContain('let selectedThisFocus = false;');
    expect(src).toContain('let guardFirstMouseUp = false;');
    expect(src).toContain('if (!selectedThisFocus) {');
    // blur resets both flags so the next focus cycle re-selects.
    expect(src).toContain('selectedThisFocus = false;');
    // mouseup normalization guard re-asserts the swallowed first-click select-all.
    expect(src).toContain('if (guardFirstMouseUp) {');
    expect(src).toContain('e.preventDefault();');
  });

  test('D-003: second activation places a native caret (first click still selects all)', async ({ page }) => {
    test.setTimeout(30000);
    await boot(page);
    await seedTitles(page);

    // Deterministic first activation: synthetic mousedown/mouseup → focus + select-all.
    expect(await jsClickTitle(page, '.large-box__title')).toBe(true);
    expect((await selState(page)).text).toBe('Alpha');

    // Second activation: a real (trusted) click on the already-focused title must collapse
    // the selection to a native caret instead of re-selecting the whole name.
    await page.locator('.large-box__title').click();
    const after = await page.evaluate(() => {
      const sel = window.getSelection();
      const active = document.activeElement as HTMLElement | null;
      return { collapsed: sel ? sel.isCollapsed : false, active: (active?.className || '').toString() };
    });
    expect(after.active).toContain('large-box__title');
    expect(after.collapsed).toBe(true);
  });

  test('D-003: arrow key collapses the select-all; Shift+Arrow makes a partial selection', async ({ page }) => {
    test.setTimeout(30000);
    await boot(page);
    await seedTitles(page);

    // Deterministic first activation: synthetic mousedown/mouseup → focus + select-all.
    expect(await jsClickTitle(page, '.large-box__title')).toBe(true);
    expect((await selState(page)).text).toBe('Alpha');

    // ArrowLeft collapses the whole-name selection to a caret (browser native).
    await page.keyboard.press('ArrowLeft');
    const collapsed = await page.evaluate(() => {
      const sel = window.getSelection();
      return { collapsed: sel ? sel.isCollapsed : false };
    });
    expect(collapsed.collapsed).toBe(true);

    // Shift+ArrowRight extends a PARTIAL selection (not the whole name).
    await page.keyboard.press('Shift+ArrowRight');
    const partial = await selState(page);
    expect(partial.text.length).toBeGreaterThan(0);
    expect(partial.text.length).toBeLessThan('Alpha'.length);
    expect('Alpha'.includes(partial.text)).toBe(true);
  });

  test('D-003: mouse drag makes a partial selection (native)', async ({ page, browserName }) => {
    test.setTimeout(30000);
    test.skip(browserName === 'firefox',
      'native mouse.move stalls on the Firefox headed lane (playwright#16095 class); Chromium keeps native coverage');
    await boot(page);
    await seedTitles(page);

    // Focus + select-all, then collapse to the start so the drag extends rightwards.
    expect(await jsClickTitle(page, '.large-box__title')).toBe(true);
    expect((await selState(page)).text).toBe('Alpha');
    await page.keyboard.press('ArrowLeft');

    const box = await page.locator('.large-box__title').boundingBox();
    if (!box) throw new Error('.large-box__title not found');
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, y, { steps: 6 });
    await page.mouse.up();

    const s = await selState(page);
    expect(s.text.length).toBeGreaterThan(0);
    expect(s.text.length).toBeLessThan('Alpha'.length);
    expect('Alpha'.includes(s.text)).toBe(true);
  });

  test('D-005: favicon Phase-1 hot pool, decode(), is-loading and is-cached classes', () => {
    const favSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/favicon.js'), 'utf8');
    const popSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/popups.js'), 'utf8');
    const cssSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/base.css'), 'utf8');

    expect(favSrc).toContain('const _faviconHotPool = new Map();');
    expect(favSrc).toContain('probe.decode()');
    expect(favSrc).toContain("img.classList.remove('is-loading')");
    expect(favSrc).toContain("img.classList.add('is-cached')");

    expect(popSrc).toContain("fav.className = 'bm-row__favicon is-loading';");

    expect(cssSrc).toContain('.bm-row__favicon.is-loading');
    expect(cssSrc).toContain('.bm-row__favicon.is-cached');
  });

  test('D-006: About tab markup, initAboutTab, and 14-locale i18n completeness', () => {
    const htmlSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/index.html'), 'utf8');
    const settingsUiSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/settings-ui.js'), 'utf8');
    const i18nSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/i18n.js'), 'utf8');

    expect(htmlSrc).toContain('data-tab="about"');
    expect(htmlSrc).toContain('data-i18n="settingsNavAbout"');
    expect(htmlSrc).toContain('id="tab-about"');
    expect(htmlSrc).toContain('id="about-version-value"');
    expect(htmlSrc).toContain('id="about-link-repo"');
    expect(htmlSrc).toContain('id="about-link-issues"');
    expect(htmlSrc).toContain('id="about-link-pulls"');
    expect(htmlSrc).toContain('id="about-link-privacy"');

    expect(settingsUiSrc).toContain('export function initAboutTab()');

    const expectedKeys = [
      'settingsNavAbout',
      'aboutVersion',
      'aboutLinksTitle',
      'aboutLinkRepo',
      'aboutLinkIssues',
      'aboutLinkPulls',
      'aboutLinkPrivacy',
      'aboutLicense',
    ];

    for (const key of expectedKeys) {
      expect(i18nSrc).toContain(`I18N_FALLBACK.${key} = `);
    }

    const localesDir = path.join(EXTENSION_PATH, '_locales');
    const langs = fs.readdirSync(localesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    expect(langs.length).toBe(14);

    for (const lang of langs) {
      const msgPath = path.join(localesDir, lang, 'messages.json');
      const msgs = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
      for (const key of expectedKeys) {
        expect(msgs[key], `Missing key "${key}" in _locales/${lang}/messages.json`).toBeDefined();
        expect(typeof msgs[key].message).toBe('string');
        expect(msgs[key].message.length).toBeGreaterThan(0);
      }
    }
  });
});
