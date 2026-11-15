import { chromium, test, expect, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { dismissOnboarding } from '../helpers/onboarding';
import { stripComments } from '../helpers/source';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp/index.html')).href;

// Ticket 10 (wave4 P2) + ticket 121 (#120 T1 / D1): the three box titles — the large
// box title, the small box title and the title on the inner page — are native single
// line <input> elements. This spec checks what the user actually gets:
//
//   * the first REAL click on an unfocused title selects the whole name;
//   * a second REAL click on the already focused title drops that selection and puts
//     the caret where the user clicked (no re-select, no jump to either end);
//   * Enter commits, Escape cancels, plain blur commits, and an IME composition
//     swallows Enter until the composition ends;
//   * paste is plain text only, CRLF/LF/CR become one space, edges are trimmed and an
//     empty title falls back to that box type's localized default name;
//   * long titles keep the ellipsis while resting while the stored text stays whole.
//
// These are behaviour assertions, not a rewrite of the old contentEditable internals:
// the previous version pinned `span[contenteditable]`, `window.getSelection()` ranges
// and per-handler `execCommand` counts. The control changed, so the assertions follow
// the control's own observable surface (value / selectionStart / selectionEnd).
async function boot(page: Page) {
  await page.addInitScript(() => {
    // Counts how often a title VALUE is really persisted (the file:// lane keeps the
    // layout in localStorage). Writes that leave both titles untouched — the storage
    // facade also persists view state — are ignored, so "one edit, one write" means
    // what it says. Test-side instrumentation only: product code is not touched.
    localStorage.removeItem('__titleWriteCount');
    const titleSignature = (raw: string | null) => {
      try {
        const parsed = JSON.parse(raw || 'null');
        const lb = parsed && parsed.boxes && parsed.boxes[0];
        const sb = lb && lb.children && lb.children[0];
        return JSON.stringify([lb && lb.title, sb && sb.title]);
      } catch {
        return 'unreadable';
      }
    };
    const realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'boxingLayout') {
        const previous = localStorage.getItem('boxingLayout');
        if (previous === null || titleSignature(previous) !== titleSignature(value)) {
          localStorage.setItem.call(this, '__titleWriteCount',
            String(Number(localStorage.getItem('__titleWriteCount') || '0') + 1));
        }
      }
      return realSetItem.call(this, key, value);
    };
  });
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

// Selection state of a title input, read straight off the control.
function titleState(page: Page, sel: string) {
  return page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLInputElement | null;
    if (!el) return null;
    const active = document.activeElement as HTMLElement | null;
    return {
      value: el.value,
      start: el.selectionStart as number,
      end: el.selectionEnd as number,
      selected: el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0),
      focused: active === el,
      activeId: active?.id || '',
      activeClass: (active?.className || '').toString(),
      tag: el.tagName,
      type: el.getAttribute('type'),
    };
  }, sel);
}

// A REAL mouse click at a horizontal fraction of the title input's own box. The
// returned caret index comes from the control itself, so the assertions never depend
// on guessing glyph widths.
async function clickTitleAt(page: Page, sel: string, fraction: number) {
  const box = await page.locator(sel).boundingBox();
  if (!box) throw new Error(sel + ' has no box');
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
  return (await titleState(page, sel))!;
}

// Reaching the caret after a commit: Enter blurs the field, so the very next click is
// a FIRST click again and selects everything. Walk the real two-click path instead of
// pretending the field is still focused: click once (the whole name gets selected),
// prove that, then click at the fraction to place the caret.
async function selectThenClickTitleAt(page: Page, sel: string, fraction: number, expected: string) {
  await page.locator(sel).click();
  expect((await titleState(page, sel))!.selected, 'the focusing click selects the whole name').toBe(expected);
  return clickTitleAt(page, sel, fraction);
}

const layoutTitle = (page: Page) =>
  page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].title);
const childTitle = (page: Page) =>
  page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].children[0].title);
// The storage facade writes through a serial chain (and may also be holding a
// debounced save), so give a just-triggered write a moment to land before the counter
// is read. This is instrumentation for the "exactly once" contract, not an assertion
// about how fast the app persists.
const writeCount = async (page: Page) => {
  await page.waitForTimeout(300);
  return page.evaluate(() => Number(localStorage.getItem('__titleWriteCount') || '0'));
};
const resetWriteCount = async (page: Page) => {
  // Let anything the seeding step queued settle first, then open a fresh window.
  await page.waitForTimeout(400);
  await page.evaluate(() => localStorage.setItem('__titleWriteCount', '0'));
};

// ═══════════════════════════════════════════════════════════════════════════
// #120 T1 last bullet: the key cases also run in the REAL Chrome build.
// The shared chromium project loads the built extension, but the rest of this file
// drives the file:// page like its siblings. This block mirrors the headline of the
// click/commit contract inside dist/boxing-chrome, the same way the copy-only /
// conflict-copy / About specs prove their golden path in the loaded build. Firefox
// coverage of the built add-on is the documented manual gate (#68 decision B, #69
// checklist) — a file:// page is not an extension there.
// ═══════════════════════════════════════════════════════════════════════════
const DIST_CHROME = path.join(EXTENSION_PATH, 'dist', 'boxing-chrome');

test.describe('Ticket 121 - title inputs in the loaded Chrome build', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the loaded build is a chromium lane');

  test('first click selects all, second click places the caret, Enter saves, reload keeps it', async ({}) => {
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - CI builds before running tests');
    test.setTimeout(180000);

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-121-ext-'));
    const ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [
        '--load-extension=' + DIST_CHROME,
        '--disable-extensions-except=' + DIST_CHROME,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    try {
      const page = await ctx.newPage();
      await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageGet)),
        { timeout: 30000 }).toBe(true);
      // Lane proof: the page is served by the extension, not read from disk.
      expect(page.url()).toContain('chrome-extension://');
      await dismissOnboarding(page);

      // A real box, created through the app's own entry point.
      await page.evaluate(() => (window as any)._boxingAddLargeBox());
      await expect(page.locator('.large-box')).toHaveCount(1);
      const original = (await titleState(page, '.large-box__title'))!.value;
      expect(original.length).toBeGreaterThan(0);

      await page.locator('.large-box__title').click();
      let state = (await titleState(page, '.large-box__title'))!;
      expect(state.tag, 'the loaded build ships an input, not an editable span').toBe('INPUT');
      expect(state.selected).toBe(original);

      const middle = await clickTitleAt(page, '.large-box__title', 0.45);
      expect(middle.start).toBe(middle.end);
      expect(middle.start).toBeGreaterThan(0);
      expect(middle.start).toBeLessThan(original.length);

      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('Built build title');
      await page.keyboard.press('Enter');
      const readBack = () => page.evaluate(async () => {
        const res = await (window as any).__boxingDebug.storageGet('boxingLayout');
        return res?.boxingLayout?.boxes?.[0]?.title ?? null;
      });
      await expect.poll(readBack, { timeout: 15000 }).toBe('Built build title');

      // The value is really persisted: a full reload shows it again.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 30000 }).toBe(true);
      await expect(page.locator('.large-box__title')).toHaveValue('Built build title');
      state = (await titleState(page, '.large-box__title'))!;
      expect(state.value).toBe('Built build title');
    } finally {
      await ctx.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});

test.describe('Ticket 10/121 - native title inputs: first click selects all, later clicks place the caret', () => {

  test('large title: first real click selects everything, typing replaces, Enter saves once', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);

    const boxBefore = await page.locator('.large-box').boundingBox();
    await page.locator('.large-box__title').click();

    // The whole name is selected and the input owns the focus.
    let state = (await titleState(page, '.large-box__title'))!;
    expect(state.tag).toBe('INPUT');
    expect(state.type).toBe('text');
    expect(state.selected).toBe('Alpha');
    expect(state.focused).toBe(true);
    expect(state.activeClass).toContain('large-box__title');

    // Clicking the title must not drag the box.
    expect(await page.locator('.large-box').boundingBox()).toEqual(boxBefore);

    // Typing replaces the whole name; Enter commits; the blur that follows Enter must
    // not persist the same edit a second time.
    await resetWriteCount(page);
    await page.keyboard.type('Gamma', { delay: 20 });
    await expect(page.locator('.large-box__title')).toHaveValue('Gamma');
    await page.keyboard.press('Enter');
    await expect.poll(() => layoutTitle(page)).toBe('Gamma');
    expect((await titleState(page, '.large-box__title'))!.focused).toBe(false);
    expect(await writeCount(page)).toBe(1);

    // Escape throws this edit away: the stored name stays and the blur after Escape
    // does not write the abandoned text back.
    await resetWriteCount(page);
    await page.locator('.large-box__title').click();
    expect((await titleState(page, '.large-box__title'))!.selected).toBe('Gamma');
    await page.keyboard.type('X', { delay: 20 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.large-box__title')).toHaveValue('Gamma');
    expect(await layoutTitle(page)).toBe('Gamma');
    expect(await writeCount(page)).toBe(0);
  });

  test('large title: the second real click collapses the selection and puts the caret where it landed', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);

    await page.locator('.large-box__title').click();
    expect((await titleState(page, '.large-box__title'))!.selected).toBe('Alpha');

    // Real click in the middle area of the focused title: the selection collapses and
    // the caret sits inside the text, not at either end.
    const middle = await clickTitleAt(page, '.large-box__title', 0.4);
    expect(middle.focused).toBe(true);
    expect(middle.start).toBe(middle.end);
    expect(middle.start).toBeGreaterThan(0);
    expect(middle.start).toBeLessThan('Alpha'.length);

    // A second, further-right click moves the caret further right — plain native
    // caret placement, never a fresh select-all.
    const right = await clickTitleAt(page, '.large-box__title', 0.6);
    expect(right.start).toBe(right.end);
    expect(right.start).toBeGreaterThan(middle.start);

    // Edit around that caret: insert a letter, delete a neighbour, and save.
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type('X');
    await expect(page.locator('.large-box__title')).toHaveValue('AlXpha');
    await page.keyboard.press('Backspace');
    await expect(page.locator('.large-box__title')).toHaveValue('Alpha');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Backspace'); // removes "h", leaving "Alpa"
    await expect(page.locator('.large-box__title')).toHaveValue('Alpa');

    await page.keyboard.press('Enter');
    await expect.poll(() => layoutTitle(page)).toBe('Alpa');

    // The edit survives a real reload, not just memory.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    await expect(page.locator('.large-box__title')).toHaveValue('Alpa');
    expect(await layoutTitle(page)).toBe('Alpa');
  });

  test('small title: same click contract, Enter saves, Escape restores', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);
    await page.evaluate(() => (window as any).__boxingDebug.enterLargeBox('L1'));
    await expect(page.locator('.small-box__title')).toHaveCount(1);

    const boxBefore = await page.locator('.small-box').boundingBox();
    await page.locator('.small-box__title').click();

    let state = (await titleState(page, '.small-box__title'))!;
    expect(state.tag).toBe('INPUT');
    expect(state.selected).toBe('Beta');
    expect(state.focused).toBe(true);
    expect(await page.locator('.small-box').boundingBox()).toEqual(boxBefore);

    await page.keyboard.type('Delta', { delay: 20 });
    await expect(page.locator('.small-box__title')).toHaveValue('Delta');
    await page.keyboard.press('Enter');
    await expect.poll(() => childTitle(page)).toBe('Delta');

    // Enter blurred the field, so reaching a caret means walking the real two-click
    // path: the first click selects the new name, the second collapses it to a caret.
    const middle = await selectThenClickTitleAt(page, '.small-box__title', 0.4, 'Delta');
    expect(middle.start).toBe(middle.end);
    expect(middle.start).toBeGreaterThan(0);
    expect(middle.start).toBeLessThan('Delta'.length);
    await page.keyboard.type('Y');
    const edited = (await titleState(page, '.small-box__title'))!.value;
    expect(edited).toHaveLength('Delta'.length + 1);
    expect(edited.at(middle.start)).toBe('Y');

    await page.keyboard.press('Escape');
    await expect(page.locator('.small-box__title')).toHaveValue('Delta');
    await expect.poll(() => childTitle(page)).toBe('Delta');
  });

  test('inner-page title: first click selects all, second click places the caret, Enter saves once', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);
    await page.evaluate(() => (window as any).__boxingDebug.enterLargeBox('L1'));
    await expect(page.locator('#inner-crumb-title')).toHaveValue('Alpha');

    await page.locator('#inner-crumb-title').click();
    let state = (await titleState(page, '#inner-crumb-title'))!;
    expect(state.tag).toBe('INPUT');
    expect(state.selected).toBe('Alpha');
    expect(state.focused).toBe(true);
    expect(state.activeId).toBe('inner-crumb-title');

    // Enter commits exactly once, even though a blur follows it.
    await resetWriteCount(page);
    await page.keyboard.type('Crumbed', { delay: 20 });
    await page.keyboard.press('Enter');
    await expect.poll(() => layoutTitle(page)).toBe('Crumbed');
    expect(await writeCount(page)).toBe(1);

    const middle = await selectThenClickTitleAt(page, '#inner-crumb-title', 0.4, 'Crumbed');
    expect(middle.start).toBe(middle.end);
    expect(middle.start).toBeGreaterThan(0);
    expect(middle.start).toBeLessThan('Crumbed'.length);
    await page.keyboard.type('Z');
    const edited = (await titleState(page, '#inner-crumb-title'))!.value;
    expect(edited.at(middle.start)).toBe('Z');
    await page.keyboard.press('Enter');
    await expect.poll(() => layoutTitle(page)).toBe(edited);

    // Escape after a fresh click restores the stored name.
    await page.locator('#inner-crumb-title').click();
    await page.keyboard.type('Q', { delay: 20 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#inner-crumb-title')).toHaveValue(edited);
    expect(await layoutTitle(page)).toBe(edited);
  });

  test('plain blur commits; Enter during an IME composition does not', async ({ page }) => {
    test.setTimeout(60000);
    await boot(page);
    await seedTitles(page);

    // Plain blur (focus moved to a blank canvas spot) commits the trimmed text.
    await resetWriteCount(page);
    await page.locator('.large-box__title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('  Blurred  ');
    await page.locator('.canvas__surface').click({ position: { x: 900, y: 700 } });
    await expect.poll(() => layoutTitle(page)).toBe('Blurred');
    await expect(page.locator('.large-box__title')).toHaveValue('Blurred');
    expect(await writeCount(page), 'a plain blur persists the edit exactly once').toBe(1);

    // While an IME composition is running, Enter belongs to the candidate list and
    // must not commit. Chromium gets its real composition through CDP; the Firefox
    // lane dispatches the same event shape (isComposing) the browser would produce.
    await page.locator('.large-box__title').click();
    await resetWriteCount(page);
    const cdp = await page.context().newCDPSession(page).catch(() => null);
    if (cdp) {
      try {
        await cdp.send('Input.imeSetComposition', { text: 'にほん', selectionStart: 3, selectionEnd: 3 });
      } catch {
        // Older Chromium builds may not accept the composition command; the
        // dispatched events below carry the same contract.
      }
    }
    await page.evaluate(() => {
      const el = document.querySelector('.large-box__title')!;
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'にほん' }));
      el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', isComposing: true, bubbles: true, cancelable: true,
      }));
    });
    await page.waitForTimeout(150);
    expect(await layoutTitle(page), 'an IME Enter must never commit the title').toBe('Blurred');
    expect(await writeCount(page), 'an IME Enter must not persist anything either').toBe(0);

    // Ending the composition leaves the decision to the user: nothing was saved, and
    // the next real Enter commits the current value exactly once.
    await page.evaluate(() => {
      document.querySelector('.large-box__title')!
        .dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'にほん' }));
    });
    await page.locator('.large-box__title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Japan');
    await resetWriteCount(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => layoutTitle(page)).toBe('Japan');
    expect(await writeCount(page)).toBe(1);
  });

  test('paste is plain text: CRLF/LF/CR become one space, markup stays text, edges trimmed', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);

    const cases: Array<[string, string]> = [
      ['  one\r\ntwo  ', 'one two'],
      ['three\nfour', 'three four'],
      ['five\rsix', 'five six'],
      ['<b>bold</b> kept as text', '<b>bold</b> kept as text'],
    ];

    for (const [pasted, expected] of cases) {
      await page.locator('.large-box__title').click();
      const notCancelled = await page.evaluate((text) => {
        const el = document.querySelector('.large-box__title') as HTMLInputElement;
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        dt.setData('text/html', '<b>markup</b>');
        return el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      }, pasted);
      // The handler claims the paste, so no native rich-text insertion happens.
      expect(notCancelled).toBe(false);
      await page.keyboard.press('Enter');
      await expect.poll(() => layoutTitle(page)).toBe(expected);
      await expect(page.locator('.large-box__title')).toHaveValue(expected);
    }

    // The title never gained child markup.
    expect(await page.evaluate(() => document.querySelector('.large-box__title')!.children.length)).toBe(0);
  });

  test('an empty title falls back to that box type localized default name', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);

    // All-whitespace on the large box → untitledBox ("Untitled box").
    await page.locator('.large-box__title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('   ');
    await page.keyboard.press('Enter');
    await expect.poll(() => layoutTitle(page)).toBe('Untitled box');
    await expect(page.locator('.large-box__title')).toHaveValue('Untitled box');

    // The small box uses its own default name instead.
    await page.evaluate(() => (window as any).__boxingDebug.enterLargeBox('L1'));
    await expect(page.locator('.small-box__title')).toHaveCount(1);
    await page.locator('.small-box__title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    await expect.poll(() => childTitle(page)).toBe('New small box');
    await expect(page.locator('.small-box__title')).toHaveValue('New small box');
  });

  test('every title input carries a localized accessible name, not its own value', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);

    // The field shows the user's own text, which cannot name it: each of the three
    // surfaces needs the localized "Box title" label. Check each while its surface is
    // the visible one, and prove the name is not just the seeded value echoed back.
    await expect(page.locator('.large-box__title')).toHaveValue('Alpha');
    await expect(page.locator('.large-box__title'), 'the large title needs an accessible name')
      .toHaveAttribute('aria-label', 'Box title');

    await page.evaluate(() => (window as any).__boxingDebug.enterLargeBox('L1'));
    await expect(page.locator('.small-box__title')).toHaveCount(1);
    await expect(page.locator('.small-box__title')).toHaveValue('Beta');
    await expect(page.locator('.small-box__title'), 'the small title needs an accessible name')
      .toHaveAttribute('aria-label', 'Box title');

    await expect(page.locator('#inner-crumb-title')).toHaveValue('Alpha');
    await expect(page.locator('#inner-crumb-title'), 'the inner-page title needs an accessible name')
      .toHaveAttribute('aria-label', 'Box title');

    // The label is a real i18n key in all 14 locales, and in the English fallback too.
    const localesDir = path.join(EXTENSION_PATH, '_locales');
    const locales = fs.readdirSync(localesDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name).sort();
    expect(locales, 'the shipped locale set').toHaveLength(14);
    for (const lang of locales) {
      const messages = JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'messages.json'), 'utf8'));
      expect(messages.titleInputLabel?.message, 'titleInputLabel in ' + lang).toBeTruthy();
    }
    expect(JSON.parse(fs.readFileSync(path.join(localesDir, 'en', 'messages.json'), 'utf8'))
      .titleInputLabel.message).toBe('Box title');
    const i18nSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/i18n.js'), 'utf8');
    expect(i18nSrc).toMatch(/titleInputLabel: 'Box title'/);
  });

  test('long titles: ellipsis while resting, whole value stored, caret reachable in the middle', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    const longTitle = 'A very long box title that cannot possibly fit inside one title bar';
    const applied = await page.evaluate((t) => {
      // The same seeding path the other cases use: it also rebuilds the box maps, so
      // the inner page can be entered afterwards.
      return (window as any).__boxingDebug.applyExternalLayout({
        version: 3.5,
        boxes: [{
          id: 'L1', type: 'large', title: t, x: 80, y: 80, width: 340, height: 220,
          children: [{ id: 'S1', type: 'small', title: t, x: 20, y: 20, width: 260, height: 200, bookmarks: [] }],
        }],
        connections: [],
        _meta: { updatedAt: Date.now() + 100000, revision: 5 },
      });
    }, longTitle);
    expect(applied).toBe(true);
    await expect(page.locator('.large-box__title')).toHaveValue(longTitle);

    const resting = await page.evaluate(() => {
      const el = document.querySelector('.large-box__title') as HTMLInputElement;
      const cs = getComputedStyle(el);
      return { textOverflow: cs.textOverflow, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(resting.textOverflow).toBe('ellipsis');
    expect(resting.scrollWidth).toBeGreaterThan(resting.clientWidth);

    // Nothing truncates the stored text.
    expect(await layoutTitle(page)).toBe(longTitle);

    // Editing reaches the middle of a long name: the select-all still shows the whole
    // value, and a real click in the middle lands the caret inside it.
    await page.locator('.large-box__title').click();
    expect((await titleState(page, '.large-box__title'))!.selected).toBe(longTitle);
    const middle = await clickTitleAt(page, '.large-box__title', 0.45);
    expect(middle.value).toBe(longTitle);
    expect(middle.start).toBe(middle.end);
    expect(middle.start).toBeGreaterThan(0);
    expect(middle.start).toBeLessThan(longTitle.length - 1);
    await page.keyboard.press('Escape');

    // The small box title keeps its ellipsis too, and nothing truncates the data.
    await page.evaluate(() => (window as any).__boxingDebug.enterLargeBox('L1'));
    await expect(page.locator('.small-box__title')).toHaveValue(longTitle);
    const smallResting = await page.evaluate(() => {
      const el = document.querySelector('.small-box__title') as HTMLInputElement;
      const cs = getComputedStyle(el);
      return { textOverflow: cs.textOverflow, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(smallResting.textOverflow).toBe('ellipsis');
    expect(smallResting.scrollWidth).toBeGreaterThan(smallResting.clientWidth);
    expect(await childTitle(page)).toBe(longTitle);

    // The inner-page title adds no ellipsis of its own (it never had one).
    const crumb = await page.evaluate(() => {
      const el = document.querySelector('#inner-crumb-title') as HTMLInputElement;
      return { textOverflow: getComputedStyle(el).textOverflow, value: el.value };
    });
    expect(crumb.textOverflow).not.toContain('ellipsis');
    expect(crumb.value).toBe(longTitle);
  });

  test('keyboard and mouse selection inside a title still behave natively', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);

    await page.locator('.large-box__title').click();
    expect((await titleState(page, '.large-box__title'))!.selected).toBe('Alpha');

    // ArrowLeft collapses the select-all to a caret.
    await page.keyboard.press('ArrowLeft');
    let state = (await titleState(page, '.large-box__title'))!;
    expect(state.start).toBe(state.end);

    // Shift+ArrowRight extends a PARTIAL selection, not the whole name.
    await page.keyboard.press('Shift+ArrowRight');
    state = (await titleState(page, '.large-box__title'))!;
    expect(state.selected.length).toBeGreaterThan(0);
    expect(state.selected.length).toBeLessThan('Alpha'.length);
    expect('Alpha'.includes(state.selected)).toBe(true);

    // Dragging over part of the text selects that part only, and the box does not move.
    const boxBefore = await page.locator('.large-box').boundingBox();
    await page.keyboard.press('Home');
    const box = (await page.locator('.large-box__title').boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, y, { steps: 6 });
    await page.mouse.up();
    state = (await titleState(page, '.large-box__title'))!;
    expect(state.selected.length).toBeGreaterThan(0);
    expect('Alpha'.startsWith(state.selected)).toBe(true);
    expect(await page.locator('.large-box').boundingBox()).toEqual(boxBefore);
  });

  test('the title bar blank space still drags the whole box', async ({ page }) => {
    test.setTimeout(40000);
    await boot(page);
    await seedTitles(page);

    const boxBefore = (await page.locator('.large-box').boundingBox())!;
    const icon = (await page.locator('.large-box__icon').boundingBox())!;
    await page.mouse.move(icon.x + icon.width / 2, icon.y + icon.height / 2);
    await page.mouse.down();
    await page.mouse.move(icon.x + icon.width / 2 + 120, icon.y + icon.height / 2 + 90, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await page.locator('.large-box').boundingBox())!.x)
      .toBeGreaterThan(boxBefore.x + 60);

    // Nothing was typed into the title by the drag, and the stored name is intact.
    await expect(page.locator('.large-box__title')).toHaveValue('Alpha');
    expect(await layoutTitle(page)).toBe('Alpha');
  });

  test('source contract: one shared title-input helper drives all three surfaces', () => {
    const src = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/render.js'), 'utf8');
    // The helper is defined once...
    expect((src.match(/function attachTitleInput\(/g) || []).length).toBe(1);
    expect((src.match(/function insertPlainTitleText\(/g) || []).length).toBe(1);
    // ...and wired into exactly the three title surfaces.
    expect((src.match(/attachTitleInput\(title, \{/g) || []).length).toBe(2);   // large + small
    expect((src.match(/attachTitleInput\(innerCrumbTitle, \{/g) || []).length).toBe(1);
    // No box title is a contentEditable span any more. Read code, not comments: the
    // helper's own comment names the surface it replaced, and a comment cannot run.
    // Case-insensitive too, so setAttribute('contenteditable', …) cannot slip past.
    const code = stripComments(src, 'js');
    expect(code).not.toMatch(/contenteditable/i);
    expect(code).not.toContain('execCommand');
    // The negative check still bites: the API name survives in the working copy, i.e.
    // the ban above is not vacuously true because nothing mentions it.
    expect(src).toMatch(/contenteditable/i);
    // SEC-03: paste still goes through text/plain only.
    expect(src).toContain("getData('text/plain')");
    // Ticket 09 scope untouched: create pipeline still renders before fire-and-forget save.
    expect(src).not.toContain('await saveLayout');
    expect((src.match(/void saveLayout\(\);/g) || []).length).toBe(3);
  });

  test('source contract: the comment stripper cannot hide a reintroduced old implementation', () => {
    // The negative source checks above only mean something while the stripper keeps
    // real code and drops comments. These cases pin that boundary; the regex one is
    // the trap: a naive scanner reads the `//` inside /\/\// as a line comment and
    // blanks the contentEditable assignment that follows, so the ban would pass on
    // code that brought the old implementation back.
    const kept: Array<[string, string]> = [
      ["const re = /\/\//; el.contentEditable = 'true';", 'el.contentEditable'],
      ['const r = document.caretPositionFromPoint(x, y);', 'caretPositionFromPoint'],
      ["el.setAttribute('contenteditable', 'true');", 'contenteditable'],
      ['const half = total / 2; el.contentEditable = true;', 'el.contentEditable'],
      ['const url = "https://example.com/a//b"; el.contentEditable = true;', 'el.contentEditable'],
      ['const t = `a // b`; el.contentEditable = true;', 'el.contentEditable'],
    ];
    for (const [source, needle] of kept) {
      expect(stripComments(source, 'js'), 'real code must survive: ' + source).toContain(needle);
    }

    // Comments, on the other hand, must be gone.
    const dropped: Array<[string, string, 'js' | 'html' | 'css']> = [
      ['// it removed contentEditable entirely', 'contentEditable', 'js'],
      ['/* contentEditable is no longer used */ const a = 1;', 'contentEditable', 'js'],
      ['const s = "kept"; // contentEditable', 'contentEditable', 'js'],
      ['<!-- <div contenteditable="true"></div> -->', 'contenteditable', 'html'],
      ['.a { color: red; } /* .b[contenteditable] { } */', 'contenteditable', 'css'],
    ];
    for (const [source, needle, lang] of dropped) {
      expect(stripComments(source, lang), 'comments must be blanked: ' + source)
        .not.toMatch(new RegExp(needle, 'i'));
    }

    // Markup keeps its URLs: the `//` in https:// is not a JavaScript comment.
    const markup = '<input placeholder="https://dav.example.com/boxing/" type="url">';
    expect(stripComments(markup, 'html')).toContain('https://dav.example.com/boxing/');

    // Line numbers stay honest: the stripper never changes the line count.
    const src = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/render.js'), 'utf8');
    expect(stripComments(src, 'js').split('\n')).toHaveLength(src.split('\n').length);
  });

  test('source contract: the title markup is a native single-line input everywhere', () => {
    // Each file is read with its own comment syntax: a JavaScript scanner pointed at
    // markup would swallow the `//` inside placeholder="https://…" and blank real code.
    const src = stripComments(fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/render.js'), 'utf8'), 'js');
    const html = stripComments(fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/index.html'), 'utf8'), 'html');
    const css = stripComments(fs.readFileSync(path.join(EXTENSION_PATH, 'ntp/base.css'), 'utf8'), 'css');

    // Two created titles are inputs with type=text, and the inner-page one is too.
    expect((src.match(/title\.type = 'text';/g) || []).length).toBe(2);
    expect(html).toContain('id="inner-crumb-title" type="text"');
    expect(html).not.toContain('contenteditable');

    // Composition guard, Enter/Escape contract, plain blur commit, trim + fallback.
    expect(src).toContain('e.isComposing || e.keyCode === 229');
    expect(src).toContain('commitTitleInput(el, opts)');
    expect(src).toContain('el.select();');
    expect(src).toContain('.trim()');

    // The contentEditable-only styling hooks are gone from the stylesheet, and each
    // surface still has its own focus look.
    expect(css).not.toContain('contenteditable');
    expect(css).toContain('.large-box__title:focus');
    expect(css).toContain('.small-box__title:focus');
    expect(css).toContain('.inner__crumb-title:focus');
  });
  test('favicon Phase-1 hot pool, decode(), is-loading and is-cached classes', () => {
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

  test('About tab markup, initAboutTab, and 14-locale i18n completeness', () => {
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
