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
//   AC6  the Pages demo keeps suppressing the tour, and the new entry is not a dead control
//        there (the rule onboarding.js states for the replay entry).
//   AC7  key parity across all fourteen locales (static gate, both lanes).
//   AC8  the golden path in the ACTUAL built extension (dist/boxing-chrome).
//
// First-run tour and replay behavior belongs to boxing-onboarding.spec.ts (#53 D1: the replay
// from #42 is reused, not redefined). What is asserted here is only that the new entries leave
// it alone: the replay entry is still present (AC1/AC3) and the sheet writes no state (AC5).
//
// Assertions stay on observable behavior (#53 T1): locator visibility, rendered text, focus and
// hit tests — not class names or dataset attributes. The box is created through the app's own
// entry point (window._boxingAddLargeBox) rather than an invented fixture, and storage is read
// only through the debug seam (__boxingDebug.storageGet) — never window.chrome.storage (SEC-01).
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

// The four links About already offered (ntp/settings-ui.js link map + ntp/site-constants.js
// PRIVACY_URL). Re-listed here because AC1 says the copy path must offer exactly these targets
// and nothing new — they are the pre-existing values, not a fixture.
const PROJECT_LINKS = [
  ['about-link-repo', 'https://github.com/Xxx91n/boxing'],
  ['about-link-issues', 'https://github.com/Xxx91n/boxing/issues'],
  ['about-link-pulls', 'https://github.com/Xxx91n/boxing/pulls'],
  ['about-link-privacy', 'https://boxing.xxx91n.com/privacy-policy.html'],
];

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

const focusId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? null);
const currentBox = (page: Page) =>
  page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId);

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

// saveLayout() bumps _meta.revision on every call (storage.js), so it is the drain, never the
// read: a read that writes would make "the sheet stored nothing" red by itself (#54 lesson:
// drain the queued writes, then observe without touching the chain again).
const drainSaveChain = (page: Page) =>
  page.evaluate(async () => { await (window as any).__boxingDebug.saveLayout(); });

const storedLayout = (page: Page) => page.evaluate(async () => {
  const res = await (window as any).__boxingDebug.storageGet('boxingLayout');
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

    // The entry pair D7 asks for, measured rather than read off the tree: same row band, the
    // sheet entry to the right of the replay entry. (A parent-node check alone stayed green
    // while .modal__section's column direction stacked the two buttons on top of each other.)
    await expect(page.locator('#about-show-tour')).toHaveText('Show the tour');
    await expect(page.locator('#about-quick-help')).toHaveText('Quick reference');
    const entries = await page.evaluate(() => {
      const r = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: Math.round(b.top), right: Math.round(b.right), left: Math.round(b.left), w: Math.round(b.width) };
      };
      return { tour: r('about-show-tour'), help: r('about-quick-help') };
    });
    expect(entries.tour, 'the replay entry must still render').not.toBeNull();
    expect(entries.help, 'the quick-reference entry must render').not.toBeNull();
    expect(entries.help!.w, 'a zero-width entry is not laid out beside anything').toBeGreaterThan(0);
    expect(Math.abs(entries.help!.top - entries.tour!.top), '并列 means one row, not a stack')
      .toBeLessThanOrEqual(1);
    expect(entries.help!.left, 'the quick reference sits beside the replay entry')
      .toBeGreaterThanOrEqual(entries.tour!.right - 1);

    await expect(page.locator('#about-diagnostics-btn')).toHaveText('Open diagnostics');
    // Existing behavior survives: the version line still carries the check-for-updates control.
    await expect(page.locator('#about-check-update-btn')).toHaveText('Check for updates');

    // Copy controls exist for exactly the version row and the four links the page already had —
    // five in total, and each one names the target it copies so four identical "Copy link"
    // buttons never reach a screen reader.
    const controls = await page.evaluate(() => Array.from(document.querySelectorAll('.about-copy-btn')).map((el) => {
      const node = el as HTMLElement;
      return {
        title: node.title,
        name: node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        row: node.parentElement?.querySelectorAll('.about-link-btn, #about-version-value').length ?? 0,
      };
    }));
    expect(controls).toHaveLength(5);
    expect(controls[0].title).toBe('Copy version');
    expect(controls[0].name).toContain('Copy version');
    const LINK_LABELS = ['GitHub Repository', 'Issues', 'Pull Requests', 'Privacy Policy'];
    LINK_LABELS.forEach((linkLabel, i) => {
      const c = controls[i + 1];
      expect(c.title, `copy control ${i} tooltip`).toBe('Copy link');
      expect(c.name, `copy control ${i} names its action`).toContain('Copy link');
      expect(c.name, `copy control ${i} names its target`).toContain(linkLabel);
      expect(c.row, `copy control ${i} shares its row with the thing it copies`).toBe(1);
    });
    expect(controls[0].row, 'the version copy control sits with the version value').toBe(1);
  });

  test('AC3: the sheet never opens by itself and is not a dialog', async ({ page }) => {
    await resetNtp(page, NTP_URL);
    await expect(page.locator('#quick-help'), 'nothing auto-prompts').toBeHidden();
    await openAboutTab(page);
    await expect(page.locator('#quick-help'), 'opening settings and About must not raise the sheet').toBeHidden();

    // Not a modal that could steal the canvas: a body-level sibling with no dialog semantics.
    const shape = await page.evaluate(() => {
      const el = document.getElementById('quick-help') as HTMLElement | null;
      return {
        exists: Boolean(el),
        parent: el?.parentElement?.tagName ?? null,
        role: el?.getAttribute('role'),
        ariaModal: el?.getAttribute('aria-modal'),
        labelledBy: el?.getAttribute('aria-labelledby'),
      };
    });
    expect(shape.exists).toBe(true);
    expect(shape.parent, 'the sheet lives beside the canvas, not inside a modal overlay').toBe('BODY');
    expect(shape.role, 'no dialog role — it must not read as a blocking dialog').toBeNull();
    expect(shape.ariaModal).toBeNull();
    expect(shape.labelledBy, 'titled by its own heading').toBe('quick-help-title');
  });

  // ── AC1 on the file:// lane: that host has no manifest, and the page already says so with
  // '–'. Copying the placeholder would hand the user a dash instead of a version, so the
  // control refuses it (the same '–' semantics initAboutTab already renders). The positive
  // copy result is only provable in the real build, below.
  test('AC1: a version the host cannot provide is refused, not copied', async ({ page }) => {
    await bootOnAbout(page);
    expect(await page.locator('#about-version-value').textContent()).toBe('–');
    await expect(page.locator('#about-copy-status')).toBeHidden();
    await jsClick(page, '#about-copy-version');
    await expect(page.locator('#about-copy-status')).toBeVisible();
    await expect(page.locator('#about-copy-status')).toHaveText('Copy failed');
  });

  test('AC2: the shortcut lands on the diagnostics section that already exists', async ({ page }) => {
    await bootOnAbout(page);
    await jsClick(page, '#about-diagnostics-btn');

    // The user-visible consequence of the jump: the Data tab is shown, About is not.
    await expect(page.locator('#tab-data')).toBeVisible();
    await expect(page.locator('#tab-about')).toBeHidden();

    const landed = await page.evaluate(() => {
      const target = document.getElementById('settings-diagnostics') as HTMLElement | null;
      const port = document.querySelector('.settings-content') as HTMLElement | null;
      if (!target || !port) return null;
      const t = target.getBoundingClientRect(), p = port.getBoundingClientRect();
      return {
        inScrollport: t.top < p.bottom && t.bottom > p.top,
        focused: document.activeElement?.id ?? null,
        diagTitleNodes: document.querySelectorAll('[data-i18n="diagSectionTitle"]').length,
        // The jump target is the pre-existing BX-AUD-05 control, not a copy of it.
        exportBtn: Boolean(document.getElementById('diag-export-log-btn')),
      };
    });
    expect(landed, 'the diagnostics section must exist as the jump target').not.toBeNull();
    expect(landed!.inScrollport, 'the section must be scrolled into view, not merely selected').toBe(true);
    expect(landed!.focused, 'focus must arrive inside the section').toBe('diag-export-log-btn');
    // One diagnostics surface only — D6 forbids a second log UI.
    expect(landed!.diagTitleNodes).toBe(1);
    expect(landed!.exportBtn).toBe(true);
  });

  test('AC5: the sheet shows existing strings and nothing else', async ({ page }) => {
    await bootOnAbout(page);
    await jsClick(page, '#about-quick-help');
    await expect(page.locator('#quick-help')).toBeVisible();

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

  // ── AC5: the sheet must be free of side effects. Both the persisted layout and the set of
  // storage keys are compared, so a hidden "help seen" flag or a completion state cannot sneak
  // in. (On this lane the version check returns early on '–', so no async cache write can land
  // between the two key-set reads.)
  test('AC5/AC6: opening and collapsing the sheet writes nothing', async ({ page }) => {
    await bootOnAbout(page);
    await drainSaveChain(page);
    const before = await storedLayout(page);
    const keysBefore = await storageKeySets(page);
    const completedBefore = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.onboardingCompleted);

    for (let round = 0; round < 2; round++) {
      await jsClick(page, '#about-quick-help');
      await expect(page.locator('#quick-help')).toBeVisible();
      await jsClick(page, '#quick-help-close-btn');
      await expect(page.locator('#quick-help')).toBeHidden();
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
    await expect(page.locator('#settings-modal')).toBeVisible();

    await jsClick(page, '#about-quick-help');
    await expect(page.locator('#settings-modal')).toBeHidden();
    await expect(page.locator('#quick-help')).toBeVisible();
    // Focus lands inside the sheet so a keyboard user is not left behind a closed modal.
    expect(await focusId(page)).toBe('quick-help-close-btn');

    // The hit test must resolve to the box while the sheet is open (helper from #89/#93)…
    await assertPointerReaches(page, '.large-box');
    // …and to the bottom-right zoom cluster, which is why the sheet anchors bottom-left.
    await assertPointerReaches(page, '#canvas-zoom');
    // A real pointer click enters the box, with the sheet still readable.
    await page.locator('.large-box').click();
    await expect.poll(() => currentBox(page))
      .toBeTruthy();
    await expect(page.locator('#quick-help')).toBeVisible();
  });

  // The empty-state action is the canvas control that lives mid-surface, so the sheet's corner
  // is checked against it too: with nothing on the canvas yet, opening the help must still leave
  // "Add large box" reachable — that button is the first operation a new user needs.
  test('AC4: an empty canvas keeps its own action hittable while the sheet is open', async ({ page }) => {
    await resetNtp(page, NTP_URL);
    await openAboutTab(page);
    await expect(page.locator('.canvas__empty-action')).toBeVisible();

    await jsClick(page, '#about-quick-help');
    await expect(page.locator('#quick-help')).toBeVisible();
    await assertPointerReaches(page, '.canvas__empty-action');
    await page.locator('.canvas__empty-action').click();
    await expect.poll(() => page.locator('.large-box').count()).toBe(1);
    await expect(page.locator('#quick-help')).toBeVisible();
  });

  test('AC4: Escape collapses it only while focus is inside, and never eats canvas Escape', async ({ page }) => {
    await bootOnAbout(page);
    await jsClick(page, '#about-quick-help');
    await expect(page.locator('#quick-help')).toBeVisible();
    await page.locator('.large-box').click();
    await expect.poll(() => currentBox(page))
      .toBeTruthy();
    const boxId = await currentBox(page);

    // Inside: the sheet takes the key and stops it, so "exit to canvas" does not also run.
    await page.evaluate(() => (document.getElementById('quick-help-close-btn') as HTMLElement).focus());
    await page.keyboard.press('Escape');
    await expect(page.locator('#quick-help')).toBeHidden();
    expect(await currentBox(page),
      'Escape inside the sheet must not exit the box as well').toBe(boxId);

    // Reopen, then leave focus outside: the same key now belongs to the canvas again.
    await jsClick(page, '#about-quick-help');
    await expect(page.locator('#quick-help')).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    await expect.poll(() => currentBox(page))
      .toBeNull();
    await expect(page.locator('#quick-help'), 'a canvas-side Escape must not close the sheet').toBeVisible();

    // Collapse it and press Escape once more: the listener left with the sheet, so the key must
    // stay inert for it (the self-heal rule already proven for the tour overlay).
    await jsClick(page, '#quick-help-close-btn');
    await expect(page.locator('#quick-help')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#quick-help')).toBeHidden();
  });

  // AC6 — the Pages demo suppresses the tour because the overlay won the hit test for the whole
  // page (bug3). The sheet is not an overlay, so the demo keeps it: the entry must be live there,
  // not a dead control, and must not reintroduce the blocker bug3 removed.
  test('AC6: on the demo build the tour stays suppressed while the sheet works', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__BOXING_DEMO__ = true; });
    await resetNtp(page, NTP_URL);
    await seedOneBox(page);
    await openAboutTab(page);

    await expect(page.locator('#about-show-tour'), 'the replay entry stays hidden on the demo').toBeHidden();
    await expect(page.locator('#about-quick-help'), 'the new entry must not be a dead control').toBeVisible();

    await jsClick(page, '#about-quick-help');
    await expect(page.locator('#settings-modal')).toBeHidden();
    await expect(page.locator('#quick-help')).toBeVisible();
    await assertPointerReaches(page, '.large-box');
    await page.locator('.large-box').click();
    await expect.poll(() => currentBox(page))
      .toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC7 — static key-set gate across the fourteen locales (both lanes, no browser interaction).
// D8 requires the key sets to stay aligned. build.mjs A7 compares the same sets but only logs a
// report, so this gate is the one that goes red on a missing locale.
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
// Declared gap (unchanged repo limitation, see #58): the Firefox project drives a file:// page,
// and Playwright cannot attach to a web-ext-loaded extension, so the clipboard assertions below
// are Chrome-only. The Firefox-side UI wiring runs in the file:// lanes above.
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
      const expectedVersion = String(manifest.version_name || manifest.version);
      expect(expectedVersion, 'the built manifest must carry a version').toBeTruthy();
      await expect(page.locator('#about-version-value'), 'About shows the built manifest version')
        .toHaveText(expectedVersion);

      await openAboutTab(page);
      const clipboard = () => page.evaluate(async () => await navigator.clipboard.readText());

      // Real clicks from here on, not synthetic ones: the clipboard API requires transient user
      // activation, and a dispatched HTMLElement.click() grants none — with a synthetic click the
      // product would look broken when it is the harness that never pressed anything. AC8 asks for
      // the user actually operating the loaded build.
      await page.locator('#about-copy-version').click();
      // Asserted on the clipboard itself: the status node keeps its previous text for a moment,
      // so polling that would let a stale 'Copied' satisfy the next round.
      await expect.poll(clipboard, { timeout: 15000 }).toBe(expectedVersion);

      // Every existing project link, copied verbatim instead of only opened in a tab.
      for (const [source, url] of PROJECT_LINKS) {
        await page.locator(`.about-copy-btn[data-copy-source="${source}"]`).click();
        await expect.poll(clipboard, { timeout: 15000 }).toBe(url);
      }

      // Diagnostics shortcut inside the real build: the same pre-existing section, real focus.
      await openAboutTab(page);
      await page.locator('#about-diagnostics-btn').click();
      await expect(page.locator('#tab-data')).toBeVisible();
      await expect.poll(() => focusId(page), { timeout: 15000 }).toBe('diag-export-log-btn');
      expect(await page.evaluate(() => document.querySelectorAll('[data-i18n="diagSectionTitle"]').length)).toBe(1);

      // The sheet in the real build: settings closes, the canvas keeps working underneath it.
      await openAboutTab(page);
      await page.locator('#about-quick-help').click();
      await expect(page.locator('#settings-modal')).toBeHidden();
      await seedOneBox(page);
      await assertPointerReaches(page, '.large-box');
      await page.locator('.large-box').click();
      await expect.poll(() => currentBox(page),
        { timeout: 15000 }).toBeTruthy();
      await expect(page.locator('#quick-help')).toBeVisible();
      await page.locator('#quick-help-close-btn').click();
      await expect(page.locator('#quick-help')).toBeHidden();
    } finally {
      await ctx.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
