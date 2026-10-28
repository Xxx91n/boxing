// Boxing — issue #59 (#53 D6 + D7): About-page convenience entries + non-modal operation quick reference.
//
// AC coverage (behavioral sources: #53 D6/D7/D8; origin issues #22 and #24; the replay entry
// stays under its own #42 contract and is NOT redefined here):
//   AC1  version + the EXISTING project links are copyable; no other destination is offered and
//        the existing version check / open-in-tab behavior is untouched.
//   AC2  the About > diagnostics shortcut lands on the diagnostics section that already exists
//        in Settings > Data — exactly one such surface in the page.
//   AC3  the quick-reference entry sits next to "Show the tour", adds no canvas-toolbar button
//        and never opens by itself.
//   AC4  opening it closes the settings panel; it collapses again; and the canvas keeps
//        receiving both pointer input and Escape while it is open.
//   AC5  its content is only strings the app already ships — no new teaching flow, no completion
//        state, no auto hint, no new persisted key.
//   AC7  key parity across all fourteen locales (static gate, both lanes).
//   AC8  the golden path in the ACTUAL built extension (dist/boxing-chrome).
//
// First-run tour and replay behavior belongs to boxing-onboarding.spec.ts (#53 D1: the replay
// from #42 is reused, not redefined). What is asserted here is only that the new entries leave
// it alone: the replay entry is still present (AC1/AC3) and the sheet writes no state (AC5/AC6).
//
// file:// UI lane: the box is created through the app's own entry point
// (window._boxingAddLargeBox, ntp.js) rather than an invented fixture, and storage is read only
// through the debug seam (__boxingDebug.storageGet) — never window.chrome.storage (SEC-01).
import { chromium, expect, test, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { assertPointerReaches, dismissOnboarding, resetNtp } from '../helpers/onboarding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(REPO_PATH, 'ntp', 'index.html')).href;
const DIST_CHROME = path.join(REPO_PATH, 'dist', 'boxing-chrome');

// The ten keys this ticket adds (#53 D6/D7). The sheet's BODY strings are deliberately not here:
// they are pre-existing keys, asserted against the on-screen copies of the same strings.
const NEW_KEYS = ['aboutCopyVersion', 'aboutCopyLink', 'aboutCopied', 'aboutCopyFailed',
  'aboutDiagnostics', 'aboutQuickHelp', 'quickHelpCreateBox', 'quickHelpBookmarks',
  'quickHelpPanZoom', 'quickHelpSyncRestore'];
// Existing keys the quick reference reuses instead of inventing tutorial text.
const REUSED_HELP_KEYS = ['dblclickCreateHint', 'addLargeBoxTooltip', 'addSmallBoxTooltip',
  'addBookmarkPlaceholder', 'dragToReorder', 'footerHint', 'syncProviderHint', 'onboardingRestore'];

// Synthetic activation: the Firefox lane stalls on native locator.click under load
// (playwright#16095 class) — same reason as the onboarding siblings. A real pointer is used only
// where the AC is about the pointer itself (AC4), always after assertPointerReaches.
const jsClick = (page: Page, sel: string) =>
  page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);

const openAboutTab = async (page: Page) => {
  await page.evaluate(() => {
    const open = (window as any)._boxingOpenSettings;
    if (typeof open === 'function') open();
  });
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.settings-nav__item[data-tab="about"]')?.click();
  });
  await expect(page.locator('#tab-about')).toBeVisible();
};

const sheetVisible = (page: Page) => page.locator('#quick-help').isVisible();
const sheetHidden = (page: Page) => page.evaluate(() => {
  const el = document.getElementById('quick-help') as HTMLElement | null;
  return Boolean(el && el.hidden);
});
const settingsHidden = (page: Page) => page.evaluate(() => {
  const el = document.getElementById('settings-modal') as HTMLElement | null;
  return Boolean(el && el.hidden);
});
const currentBox = (page: Page) =>
  page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId);
const focusId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? null);

// Drain the app's own write chain, then read the persisted layout through the debug seam, so a
// queued save cannot land between the two reads and look like a write by the new UI (#54 lesson).
const storedLayout = (page: Page) => page.evaluate(async () => {
  const dbg = (window as any).__boxingDebug;
  await dbg.saveLayout();
  const res = await dbg.storageGet('boxingLayout');
  return JSON.stringify(res?.boxingLayout ?? null);
});

const storageKeySets = (page: Page) => page.evaluate(() => ({
  local: Object.keys(localStorage).sort(),
  session: Object.keys(sessionStorage).sort(),
}));

async function seedOneBox(page: Page) {
  await page.evaluate(() => (window as any)._boxingAddLargeBox());
  await expect.poll(() => page.locator('.large-box').count(), { timeout: 15000 }).toBe(1);
}

// Boot with the tour dismissed, one box on the canvas and the About tab open.
async function bootOnAbout(page: Page) {
  await resetNtp(page, NTP_URL);
  await seedOneBox(page);
  await openAboutTab(page);
}

// ═══════════════════════════════════════════════════════════════════════════
// AC1 + AC3 — what About offers now, and that the replay entry is still there.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('About page entries', () => {

  test('AC1/AC3: version + the four existing links are copyable, next to the untouched replay entry', async ({ page }) => {
    await bootOnAbout(page);

    // The entry pair D7 asks for: replay first, quick reference beside it, in one section.
    await expect(page.locator('#about-show-tour')).toHaveText('Show the tour');
    await expect(page.locator('#about-quick-help')).toHaveText('Quick reference');
    expect(await page.evaluate(() => {
      const tour = document.getElementById('about-show-tour');
      const help = document.getElementById('about-quick-help');
      return Boolean(tour?.parentElement) && tour?.parentElement === help?.parentElement;
    }), 'the quick reference must be a sibling of the replay entry').toBe(true);

    await expect(page.locator('#about-diagnostics-btn')).toHaveText('Open diagnostics');
    // Existing behavior survives: the version line still carries the manifest value + check button.
    await expect(page.locator('#about-check-update-btn')).toHaveText('Check for updates');
    await expect(page.locator('#about-version-value')).not.toHaveText('');

    // Every copy control maps onto a target the page already had: the version row and exactly
    // the four link buttons. No invented link destination can be copied (D6).
    const sources = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.about-copy-btn'))
        .map((el) => (el as HTMLElement).dataset.copySource ?? null));
    expect(sources).toEqual(['version', 'about-link-repo', 'about-link-issues', 'about-link-pulls', 'about-link-privacy']);

    // Tooltip is localized, and the accessible name names the target — so the UI never shows four
    // identical "Copy link" buttons to a screen reader.
    const contexts = await page.evaluate(() => Array.from(document.querySelectorAll('.about-copy-btn')).map((el) => {
      const node = el as HTMLElement;
      return {
        source: node.dataset.copySource ?? null,
        title: node.title,
        name: node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      };
    }));
    const bySource = Object.fromEntries(contexts.map((c) => [c.source as string, c]));
    expect(Object.keys(bySource)).toHaveLength(5);
    expect(bySource['version'].title).toBe('Copy version');
    expect(bySource['version'].name).toContain('Copy version');
    for (const [source, linkLabel] of [
      ['about-link-repo', 'GitHub Repository'],
      ['about-link-issues', 'Issues'],
      ['about-link-pulls', 'Pull Requests'],
      ['about-link-privacy', 'Privacy Policy'],
    ] as const) {
      expect(bySource[source].title, `${source} tooltip`).toBe('Copy link');
      expect(bySource[source].name, `${source} accessible name`).toContain('Copy link');
      expect(bySource[source].name, `${source} names its target`).toContain(linkLabel);
    }
  });

  test('AC3: the sheet never opens by itself and is not a dialog', async ({ page }) => {
    await resetNtp(page, NTP_URL);
    expect(await sheetHidden(page), 'hidden straight after boot — nothing auto-prompts').toBe(true);
    await openAboutTab(page);
    expect(await sheetHidden(page), 'opening settings and About must not raise the sheet').toBe(true);

    // Not a modal that could steal the canvas: body-level sibling, no role, no aria-modal,
    // and no backdrop element anywhere near it.
    const shape = await page.evaluate(() => {
      const el = document.getElementById('quick-help') as HTMLElement | null;
      return {
        exists: Boolean(el),
        parent: el?.parentElement?.tagName ?? null,
        classes: el ? Array.from(el.classList) : [],
        role: el?.getAttribute('role'),
        ariaModal: el?.getAttribute('aria-modal'),
        labelledBy: el?.getAttribute('aria-labelledby'),
      };
    });
    expect(shape).toEqual({
      exists: true,
      parent: 'BODY',
      classes: ['quick-help'],
      role: null,
      ariaModal: null,
      labelledBy: 'quick-help-title',
    });
  });

  // ── AC1 on the file:// lane: that host has no manifest, and the page already says so with
  // '–'. Copying the placeholder would hand the user a dash instead of a version, so the
  // control refuses it (the same '–' semantics initAboutTab already renders, #59 AC1).
  test('AC1: a version the host cannot provide is refused, not copied', async ({ page }) => {
    await bootOnAbout(page);
    expect(await page.locator('#about-version-value').textContent()).toBe('–');
    const status = page.locator('#about-copy-status');
    await expect(status).toBeHidden();
    await jsClick(page, '#about-copy-version');
    await expect.poll(() => status.isVisible()).toBe(true);
    await expect(status).toHaveText('Copy failed');
  });

  test('AC2: the shortcut lands on the diagnostics section that already exists', async ({ page }) => {
    await bootOnAbout(page);
    await jsClick(page, '#about-diagnostics-btn');

    await expect(page.locator('#tab-data')).toBeVisible();
    await expect(page.locator('.settings-nav__item[data-tab="data"]')).toHaveClass(/settings-nav__item--active/);

    const landed = await page.evaluate(() => {
      const target = document.getElementById('settings-diagnostics') as HTMLElement | null;
      const port = document.querySelector('.settings-content') as HTMLElement | null;
      if (!target || !port) return null;
      const t = target.getBoundingClientRect(), p = port.getBoundingClientRect();
      return {
        inScrollport: t.top < p.bottom && t.bottom > p.top,
        flashed: target.classList.contains('settings-section--flash'),
        focused: document.activeElement?.id ?? null,
        diagTitleNodes: document.querySelectorAll('[data-i18n="diagSectionTitle"]').length,
        // The jump target is the pre-existing BX-AUD-05 control, not a copy of it.
        exportBtn: Boolean(document.getElementById('diag-export-log-btn')),
      };
    });
    expect(landed, 'the diagnostics section must exist as the jump target').not.toBeNull();
    expect(landed!.inScrollport, 'the section must be scrolled into view, not merely selected').toBe(true);
    expect(landed!.flashed, 'the arrival must be visible').toBe(true);
    expect(landed!.focused, 'focus must arrive inside the section').toBe('diag-export-log-btn');
    // One diagnostics surface only — D6 forbids a second log UI.
    expect(landed!.diagTitleNodes).toBe(1);
    expect(landed!.exportBtn).toBe(true);
  });

  test('AC5/AC7: the sheet shows existing strings and nothing else', async ({ page }) => {
    await bootOnAbout(page);
    await jsClick(page, '#about-quick-help');
    await expect.poll(() => sheetVisible(page)).toBe(true);

    const sheet = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#quick-help .quick-help__item')) as HTMLElement[];
      return {
        labels: items.map((li) => li.querySelector('.quick-help__label')?.textContent?.trim() ?? ''),
        texts: items.map((li) => li.querySelector('.quick-help__text')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
        buttons: document.querySelectorAll('#quick-help button').length,
        inputs: document.querySelectorAll('#quick-help input, #quick-help select').length,
        title: document.getElementById('quick-help-title')?.textContent?.trim() ?? '',
        footer: document.querySelector('.foot__txt')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      };
    });
    // Four groups, named exactly as #53 D7 lists them.
    expect(sheet.labels).toEqual(['Add boxes', 'Bookmarks', 'Pan & zoom', 'Sync & restore']);
    expect(sheet.title).toBe('Quick reference');
    // One control only: the collapse button. No "next step", no progress, no completion affordance.
    expect(sheet.buttons).toBe(1);
    expect(sheet.inputs).toBe(0);
    // The pan/zoom line IS the canvas footer, byte for byte — reuse, not a rewritten hint.
    expect(sheet.texts[2], 'pan & zoom reuses footerHint verbatim').toBe(sheet.footer);
    expect(sheet.texts[0]).toContain('Double-click to create');
    expect(sheet.texts[0]).toContain('Add large box');
    expect(sheet.texts[0]).toContain('Add small box');
    expect(sheet.texts[1]).toContain('Paste URL');
    expect(sheet.texts[1]).toContain('Drag to reorder');
    expect(sheet.texts[3]).toContain('Pick a provider to sync across devices');
    expect(sheet.texts[3]).toContain('Restore from backup');
  });

  // ── AC5 + AC6: the sheet must be free of side effects. Both the persisted layout and the set
  // of storage keys are compared, so a hidden "help seen" flag or a completion state cannot
  // sneak in. (On this lane the version check returns early on '–', so no async cache write can
  // land between the two key-set reads.)
  test('AC5/AC6: opening and collapsing the sheet writes nothing', async ({ page }) => {
    await bootOnAbout(page);
    const before = await storedLayout(page);
    const keysBefore = await storageKeySets(page);
    const completedBefore = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.onboardingCompleted);

    for (let round = 0; round < 2; round++) {
      await jsClick(page, '#about-quick-help');
      await expect.poll(() => sheetVisible(page)).toBe(true);
      await jsClick(page, '#quick-help-close-btn');
      await expect.poll(() => sheetHidden(page)).toBe(true);
      await openAboutTab(page);
    }

    expect(await storageKeySets(page), 'no new persisted key may come from the sheet').toEqual(keysBefore);
    expect(await page.evaluate(() => (window as any).__boxingDebug.layout.settings.onboardingCompleted),
      'the sheet must not mark onboarding complete').toBe(completedBefore);
    expect(await storedLayout(page), 'the stored layout is byte-identical').toBe(before);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC4 — the point of the ticket: help that does not block the canvas.
// A full-screen modal overlay used to swallow every gesture (bug3, onboarding.js), so this is
// asserted against that symptom — hit test, real click, keyboard — not against styling.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('quick reference stays out of the canvas way', () => {

  test('AC4: opening it closes settings, and the canvas still takes pointer input', async ({ page }) => {
    await bootOnAbout(page);
    expect(await settingsHidden(page), 'settings is open before the click').toBe(false);

    await jsClick(page, '#about-quick-help');
    await expect.poll(() => settingsHidden(page)).toBe(true);
    await expect.poll(() => sheetVisible(page)).toBe(true);
    // Focus lands inside the sheet so a keyboard user is not left behind the closed modal.
    expect(await focusId(page)).toBe('quick-help-close-btn');

    // The hit test must resolve to the box while the sheet is open (helper from #89/#93).
    await assertPointerReaches(page, '.large-box');
    // ...and a real pointer click must actually enter it, with the sheet still readable.
    await page.locator('.large-box').click();
    await expect.poll(() => currentBox(page)).toBeTruthy();
    await expect(page.locator('#quick-help')).toBeVisible();
  });

  test('AC4: Escape collapses it only while focus is inside, and never eats canvas Escape', async ({ page }) => {
    await bootOnAbout(page);
    await jsClick(page, '#about-quick-help');
    await expect.poll(() => sheetVisible(page)).toBe(true);
    await page.locator('.large-box').click();
    await expect.poll(() => currentBox(page)).toBeTruthy();
    const boxId = await currentBox(page);

    // Inside: the sheet takes the key and stops it, so "exit to canvas" does not also run.
    await page.evaluate(() => (document.getElementById('quick-help-close-btn') as HTMLElement).focus());
    await page.keyboard.press('Escape');
    await expect.poll(() => sheetHidden(page)).toBe(true);
    expect(await currentBox(page), 'Escape inside the sheet must not exit the box as well').toBe(boxId);

    // Reopen, then leave focus outside: the same key now belongs to the canvas again.
    await jsClick(page, '#about-quick-help');
    await expect.poll(() => sheetVisible(page)).toBe(true);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    await expect.poll(() => currentBox(page)).toBeNull();
    await expect(page.locator('#quick-help'), 'a canvas-side Escape must not close the sheet').toBeVisible();

    // Collapse it and press Escape once more: the listener left with the sheet, so the key must
    // stay inert for the sheet (the self-heal rule already proven for the tour overlay).
    await jsClick(page, '#quick-help-close-btn');
    await expect.poll(() => sheetHidden(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => sheetHidden(page)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC7 — static key-set gate across the fourteen locales (both lanes, no browser interaction).
// D8 requires the key sets to stay aligned; the build runs the same check (A7) and fails the
// package, but a red gate here is what names the missing locale in the test report.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('locale parity for the new entries', () => {

  test('AC7: every key ships in all fourteen locales and in the en fallback', async () => {
    const langs = fs.readdirSync(path.join(REPO_PATH, '_locales')).sort();
    expect(langs.length).toBe(14);
    const i18nSrc = fs.readFileSync(path.join(REPO_PATH, 'ntp', 'i18n.js'), 'utf8');
    for (const lang of langs) {
      const msgs = JSON.parse(fs.readFileSync(path.join(REPO_PATH, '_locales', lang, 'messages.json'), 'utf8'));
      for (const key of [...NEW_KEYS, ...REUSED_HELP_KEYS]) {
        expect(msgs[key], `${key} missing in _locales/${lang}`).toBeDefined();
        const message = String(msgs[key].message ?? '');
        expect(message.length, `${key} empty in ${lang}`).toBeGreaterThan(0);
        expect(message, `${key} left unresolved in ${lang}`).not.toBe(key);
      }
    }
    // The fallback dictionary is what the file:// lane renders when _locales cannot load, so the
    // NEW labels must live there too (the reused keys already did).
    for (const key of NEW_KEYS) {
      expect(i18nSrc, `${key} absent from I18N_FALLBACK`).toContain(`I18N_FALLBACK.${key} = `);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC8 — the real built extension (#53 T3: a file:// page is not an extension).
// The suite's chromium project installs the repo root, while Chrome must load
// dist/boxing-chrome, so this launches its own persistent context on the built tree
// (take-store-screenshots.mjs / #54 precedent). It skips visibly when the build is absent.
//
// Declared gap: Firefox. The suite's Firefox lane is the file:// page, and loading the built
// xpi needs web-ext with a real profile; the copy path's clipboard-read assertion is therefore
// proven on Chrome only, while its UI wiring runs in both lanes above.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Issue #59 — golden path in the real Chrome extension build', () => {

  test('AC1/AC2/AC4/AC8: copy results, diagnostics jump and canvas clicks in the loaded build', async ({}, testInfo) => {
    test.setTimeout(180000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'the loaded build is a chromium lane');
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - run npm run build first');

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue59-ext-'));
    const ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [
        '--load-extension=' + DIST_CHROME,
        '--disable-extensions-except=' + DIST_CHROME,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    // Writing the clipboard needs no permission; reading it back for the assertion does.
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    try {
      const page = await ctx.newPage();
      await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageGet)),
        { timeout: 30000 }).toBe(true);
      // Lane proof: this page is served by the extension, not from disk.
      expect(page.url()).toContain('chrome-extension://');
      await dismissOnboarding(page);

      // The value the build itself reports, read off its own manifest — not a hand-written one.
      const manifest = JSON.parse(fs.readFileSync(path.join(DIST_CHROME, 'manifest.json'), 'utf8'));
      const expectedVersion = manifest.version_name || manifest.version;
      expect(expectedVersion, 'the built manifest must carry a version').toBeTruthy();
      await expect(page.locator('#about-version-value'), 'About shows the built manifest version')
        .toHaveText(String(expectedVersion));

      await openAboutTab(page);
      const clipboard = () => page.evaluate(async () => await navigator.clipboard.readText());
      const statusText = () => page.evaluate(() => document.getElementById('about-copy-status')?.textContent ?? '');

      await jsClick(page, '#about-copy-version');
      // Asserted on the clipboard itself: the status node keeps its previous text for a moment,
      // so polling it would let a stale 'Copied' pass the next round.
      await expect.poll(clipboard, { timeout: 15000 }).toBe(String(expectedVersion));
      expect(await statusText()).toBe('Copied');

      // The existing link targets, copied verbatim instead of only opened in a tab.
      for (const [source, url] of [
        ['about-link-repo', 'https://github.com/Xxx91n/boxing'],
        ['about-link-issues', 'https://github.com/Xxx91n/boxing/issues'],
      ] as const) {
        await jsClick(page, `.about-copy-btn[data-copy-source="${source}"]`);
        await expect.poll(clipboard, { timeout: 15000 }).toBe(url);
      }

      // Diagnostics shortcut inside the real build: the same pre-existing section, real focus.
      await openAboutTab(page);
      await jsClick(page, '#about-diagnostics-btn');
      await expect(page.locator('#tab-data')).toBeVisible();
      await expect.poll(() => focusId(page), { timeout: 15000 }).toBe('diag-export-log-btn');
      expect(await page.evaluate(() => document.querySelectorAll('[data-i18n="diagSectionTitle"]').length)).toBe(1);

      // The sheet in the real build: settings closes, the canvas keeps working underneath it.
      await openAboutTab(page);
      await jsClick(page, '#about-quick-help');
      await expect.poll(() => settingsHidden(page)).toBe(true);
      await seedOneBox(page);
      await assertPointerReaches(page, '.large-box');
      await page.locator('.large-box').click();
      await expect.poll(() => currentBox(page), { timeout: 15000 }).toBeTruthy();
      await expect(page.locator('#quick-help')).toBeVisible();
      await jsClick(page, '#quick-help-close-btn');
      await expect.poll(() => sheetHidden(page)).toBe(true);
    } finally {
      await ctx.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
