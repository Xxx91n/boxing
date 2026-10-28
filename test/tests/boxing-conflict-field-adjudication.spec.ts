// Boxing — issue #54 (#53 D2/D3): same-id conflict comparison and per-field apply.
// AC coverage:
//   AC1  the archived-copy list and its verbatim export stay the one conflict entry; the
//        comparison renders inside that same list — no second conflict surface.
//   AC2  objects both sides still have offer keep-current / adopt-copy per differing field,
//        the default is always keep-current, and only user-editable fields appear (no ids,
//        no counters, no raw JSON editing).
//   AC3  an explicit apply changes exactly the selected fields of that subtree: other boxes
//        and settings are untouched and the archive row is never deleted by applying.
//   AC4  a missing/truncated archive body is not applicable; a deleted target is reported
//        and never rebuilt; a target that moved after the comparison is re-compared and has
//        to be confirmed again instead of being overwritten.
//   AC5  opening and closing a comparison is read-only — no save, no stored-byte change —
//        so comparing can never be mistaken for applying (import/sync keep their own specs
//        for "not blocked by adjudication").
//   AC6  geometry is decided in pairs (never x without y), the star verdict goes through the
//        single mutation entry, adjudication writes without tombstoning anything, and the
//        persisted payload keeps `groups` as the non-persisted runtime mirror it is.
//   AC7  static gate: every new key exists in all 14 locale files and in the en fallback.
//   AC-real  the golden path in the ACTUAL built extension (dist/boxing-chrome).
//
// LANES ARE NOT INTERCHANGEABLE (#53 T3): AC1-AC7 run on the file:// mock lane, the same
// seam the ticket-79 conflict-copy readout spec uses. The real-build lane is a
// separate describe that launches its own persistent Chromium on dist/ — a file:// pass is
// never evidence of extension behavior and is not reported as one. Input is JS-dispatched,
// matching the sibling data-tab specs (boxing-debug, boxing-webdav) — real pointer input is
// the native-input specs' job, not this flow. Seeding happens before the first navigation
// (addInitScript, the import-merge harness discipline).
// Storage goes through __boxingDebug.storageGet/Set — the existing facade seam; no new
// test-only production interface.
//
// KNOWN GAP, DECLARED NOT HIDDEN: #54 asks for Chrome AND Firefox actual builds. The suite
// has never loaded an extension in Firefox (its project installs no add-on), so that lane
// needs temporary-add-on infrastructure this ticket does not add. AC-real below covers the
// built Chrome extension, and it needs `npm run build` — CI builds before testing, and the
// test states the missing-build reason instead of passing quietly.
import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp', 'index.html')).href;
const DIST_CHROME = path.join(EXTENSION_PATH, 'dist', 'boxing-chrome');

const CONFLICT_TS = 1726100000000;
const LIST = '#data-conflict-list';
const PANEL = LIST + ' .data-conflict-diff';
// The paths the diff produces for the fixtures below (id-addressed, same grammar as the
// tiered box keys: large:<id> / small:<large>:<small>[:<bookmark>]).
const P_TITLE = 'large:L1#title';
const P_URL = 'small:L1:S1:b1#url';
const P_STAR = 'large:L1#star';

// Canvas state: L1 (+ child S1 + bookmark b1) and an unrelated L2 that must never move.
function liveLayout() {
  return {
    version: 3.5, schemaVersion: 1, nextLargeIndex: 3,
    boxes: [{
      id: 'L1', type: 'large', title: 'Local Root', x: 40, y: 40, width: 320, height: 220,
      pinned: false, collapseHover: false, nextSmallIndex: 2,
      children: [{
        id: 'S1', type: 'small', title: 'Local Small', x: 0, y: 0, width: 240, height: 180,
        pinned: true, bookmarks: [{ id: 'b1', title: 'Shared Bookmark', url: 'https://local.test/b1' }],
      }],
    }, {
      id: 'L2', type: 'large', title: 'Other Root', x: 500, y: 40, width: 320, height: 220,
      nextSmallIndex: 1, children: [],
    }],
    connections: [], groups: [],
    settings: { selectedLanguage: 'en', rememberLastPos: true, darkMode: 'light', zoomLevel: 1 },
    _meta: { revision: 3, updatedAt: Date.now() - 5000, writerId: 'spec-writer' },
  };
}

// The archived losing side (the #53 D2 counterpart): same ids, divergent title / position /
// size / pin / hover-expand / star, and a moved bookmark url. The small box and the bookmark
// title are deliberately IDENTICAL so "only differing fields are offered" proves something,
// and nextSmallIndex 99 vs 2 is the internal counter that must never show up.
function archivedBoxes(over: Record<string, unknown> = {}) {
  return [{
    id: 'L1', type: 'large', title: 'Cloud Root', x: 900, y: 900, width: 420, height: 300,
    pinned: true, collapseHover: true, isParent: true, nextSmallIndex: 99,
    children: [{
      id: 'S1', type: 'small', title: 'Local Small', x: 0, y: 0, width: 240, height: 180,
      pinned: true, bookmarks: [{ id: 'b1', title: 'Shared Bookmark', url: 'https://cloud.test/b1' }],
    }],
    ...over,
  }];
}

function archivedEntry(over: Record<string, unknown> = {}) {
  const boxes = archivedBoxes();
  return {
    ts: CONFLICT_TS, reason: 'import-merge', side: 'incoming',
    raw: { boxes }, size: JSON.stringify(boxes).length, boxes: boxes.length, ...over,
  };
}

// One archived bookmark url, so the url rules can be proven without a second fixture shape.
function archivedEntryWithUrl(copyUrl: string) {
  const boxes = archivedBoxes();
  (boxes[0].children[0].bookmarks as any[])[0].url = copyUrl;
  return {
    ts: CONFLICT_TS, reason: 'import-merge', side: 'incoming',
    raw: { boxes }, size: JSON.stringify(boxes).length, boxes: 1,
  };
}

const jsClick = (page: any, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return false;
    el.click();
    return true;
  }, sel);

async function openSettingsDataTab(page: any) {
  expect(await jsClick(page, '#settings-btn')).toBe(true);
  expect(await jsClick(page, '.settings-nav__item[data-tab="data"]')).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    document.querySelectorAll('#data-conflict-list .data-conflict-row-item').length), { timeout: 10000 }).toBeGreaterThan(0);
}

const openCompare = async (page: any) => {
  expect(await jsClick(page, LIST + ' .data-conflict-compare-btn')).toBe(true);
  await expect.poll(() => page.evaluate((p) => Boolean(document.querySelector(p)), PANEL), { timeout: 10000 }).toBe(true);
};

const closeCompare = async (page: any) => {
  expect(await jsClick(page, LIST + ' .data-conflict-compare-btn')).toBe(true);
  await expect.poll(() => page.evaluate((p) => Boolean(document.querySelector(p)), PANEL), { timeout: 10000 }).toBe(false);
};

const panelText = (page: any) =>
  page.evaluate((p) => (document.querySelector(p) as HTMLElement | null)?.textContent || '', PANEL);

const fieldPaths = (page: any) =>
  page.evaluate((p) => Array.from(document.querySelectorAll(p + ' .data-conflict-diff-field'))
    .map((el: any) => el.dataset.path), PANEL);

const adoptField = (page: any, fieldPath: string) =>
  page.evaluate(({ p, side }) => {
    const input = document.querySelector(
      '#data-conflict-list input[data-path="' + p + '"][value="' + side + '"]') as HTMLInputElement | null;
    if (!input) return false;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { p: fieldPath, side: 'copy' });

const keepRadios = (page: any) =>
  page.evaluate((p) => Array.from(document.querySelectorAll(p + ' input[value="keep"]'))
    .map((el: any) => el.checked), PANEL);

const hasApplyButton = (page: any) =>
  page.evaluate((p) => Boolean(document.querySelector(p + ' .data-conflict-apply-btn')), PANEL);

// #53 D2 keeps adjudication after-the-fact: neither comparing nor applying may put a
// decision dialog in front of the canvas the user is working on.
const confirmModalHidden = (page: any) =>
  page.evaluate(() => Boolean(document.getElementById('confirm-modal')?.hidden));

const applyDisabled = (page: any) =>
  page.evaluate((p) => (document.querySelector(p + ' .data-conflict-apply-btn') as HTMLButtonElement | null)?.disabled ?? null, PANEL);

const clickApply = (page: any) => jsClick(page, LIST + ' .data-conflict-apply-btn');

const memoryLayout = (page: any) =>
  page.evaluate(() => JSON.parse(JSON.stringify((window as any).__boxingDebug.layout)));

const storedValue = (page: any, key = 'boxingLayout') =>
  page.evaluate(async (k) => JSON.stringify((await (window as any).__boxingDebug.storageGet(k))?.[k] ?? null), key);

// The user-visible part of the stored payload, with the write bookkeeping (_meta.revision /
// updatedAt, which boot-time migration legitimately moves) taken out. This is what
// "comparing changed nothing" is allowed to be measured against.
const storedData = (page: any) =>
  page.evaluate(async () => {
    const stored = (await (window as any).__boxingDebug.storageGet('boxingLayout'))?.boxingLayout || {};
    return JSON.stringify({ boxes: stored.boxes, settings: stored.settings, connections: stored.connections });
  });

// file:// lane boot: seed the canvas layout AND one archived conflict copy before the very
// first navigation, then land on the settings data tab where the comparison lives.
async function bootFileLane(page: any, entry: any) {
  await page.addInitScript(({ layout, conflict }) => {
    localStorage.setItem('boxingLayout', JSON.stringify(layout));
    localStorage.setItem('bxstore:boxingLayout.conflict.' + conflict.ts, JSON.stringify(conflict));
    localStorage.setItem('bxstore:boxingLayout.conflict.index', JSON.stringify([{
      ts: conflict.ts, reason: conflict.reason, side: conflict.side,
      size: conflict.size, boxes: conflict.boxes || 0, truncated: !!conflict.truncated,
    }]));
  }, { layout: liveLayout(), conflict: entry });
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageGet)), { timeout: 20000 }).toBe(true);
  await dismissOnboarding(page);
  await openSettingsDataTab(page);
}

test.describe('Issue #54 — conflict comparison and per-field apply (file:// UI lane)', () => {

  test('AC1+AC2: comparison opens inline in the existing row, defaults to keep-current, offers only editable fields', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, archivedEntry());

    // AC1: the retained list actions still work and the diff is rendered inside the same
    // list — there is no second conflict-handling surface anywhere in the document.
    await expect.poll(() => page.evaluate(() => ({
      exportBtn: Boolean(document.querySelector('#data-conflict-list .data-conflict-export-btn')),
      compareBtn: Boolean(document.querySelector('#data-conflict-list .data-conflict-compare-btn')),
      panelsOutsideList: document.querySelectorAll('.data-conflict-diff').length
        - document.querySelectorAll('#data-conflict-list .data-conflict-diff').length,
    })), { timeout: 5000 }).toEqual({ exportBtn: true, compareBtn: true, panelsOutsideList: 0 });

    await openCompare(page);
    const text = await panelText(page);
    expect(text).toContain('Differences with current content');
    expect(text).not.toContain('dataConflict'); // strings resolve; a raw key would leak the gap

    // AC2: exactly the differing user-editable fields of the objects both sides have.
    expect(await fieldPaths(page)).toEqual([
      'large:L1#title', 'large:L1#position', 'large:L1#size', 'large:L1#pinned',
      'large:L1#autoExpand', 'large:L1#star',
      'small:L1:S1:b1#url',
    ]);
    // Internal state and equal fields stay out: counters, writer ids, the small box.
    expect(text).not.toContain('nextSmallIndex');
    expect(text).not.toContain('schemaVersion');
    expect(text).not.toContain('writerId');
    expect(text).not.toContain('Other Root');                 // objects only one side has stay out
    // Default is always keep-current (#53 D2: comparing must not overwrite for the user).
    expect((await keepRadios(page)).every(Boolean)).toBe(true);
    expect(await page.evaluate((p) => document.querySelectorAll(p + ' input[value="copy"]').length, PANEL)).toBe(7);
    // Applying waits for an explicit choice.
    expect(await hasApplyButton(page)).toBe(true);
    expect(await applyDisabled(page)).toBe(true);
    expect(await adoptField(page, P_TITLE)).toBe(true);
    expect(await applyDisabled(page)).toBe(false);
  });

  test('AC3: adopting one bookmark field rewrites only that bookmark, keeps settings and the archive row', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, archivedEntry());
    await openCompare(page);
    expect(await adoptField(page, P_URL)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    expect(await confirmModalHidden(page)).toBe(true);        // no modal in front of the canvas

    const after = await memoryLayout(page);
    const bm = after.boxes[0].children[0].bookmarks[0];
    expect(bm.url).toBe('https://cloud.test/b1');            // the one selected field
    expect(bm.title).toBe('Shared Bookmark');                // untouched sibling field
    expect(after.boxes[0].title).toBe('Local Root');         // its parent box did not move
    expect(after.boxes[0].x).toBe(40);
    expect(after.boxes[0].children[0].title).toBe('Local Small');
    expect(after.boxes[1]).toEqual(expect.objectContaining({ title: 'Other Root', x: 500 }));
    expect(after.settings.selectedLanguage).toBe('en');
    expect(after.settings.darkMode).toBe('light');
    // The same limited change is what reached storage — no whole-payload replace.
    const stored = JSON.parse(await storedValue(page));
    expect(stored.boxes[0].title).toBe('Local Root');
    expect(stored.boxes[0].children[0].bookmarks[0].url).toBe('https://cloud.test/b1');
    // AC3 tail: applying is not deleting. The copy stays listed with its verbatim body.
    expect(JSON.parse(await storedValue(page, 'boxingLayout.conflict.index'))).toHaveLength(1);
    const body = JSON.parse(await storedValue(page, 'boxingLayout.conflict.' + CONFLICT_TS));
    expect(body.raw.boxes[0].title).toBe('Cloud Root');
    expect(body.truncated).toBeUndefined();
    // The panel says what it did, and only the chosen field left the diff: the box's own
    // six differences are still on the table because the user never adopted them.
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Applied 1 field/);
    expect(await fieldPaths(page)).toEqual([
      'large:L1#title', 'large:L1#position', 'large:L1#size', 'large:L1#pinned',
      'large:L1#autoExpand', 'large:L1#star',
    ]);
  });

  test('AC2: an archived url is adopted in the form the app stores, and an unusable one is never offered', async ({ page }) => {
    test.setTimeout(90000);
    // Schemeless copy: the app never writes a url without normalizing it (popup add/edit,
    // and the importer rejects what normalizeBookmarkUrl cannot handle), so what the row
    // shows and what lands must both be the canonical form.
    await bootFileLane(page, archivedEntryWithUrl('cloud.test/orphan'));
    await openCompare(page);
    expect(await adoptField(page, P_URL)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    const stored = JSON.parse(await storedValue(page));
    expect(stored.boxes[0].children[0].bookmarks[0].url).toBe('https://cloud.test/orphan');
    expect((await memoryLayout(page)).boxes[0].children[0].bookmarks[0].url).toBe('https://cloud.test/orphan');

    // A url the app refuses to store cannot be adopted; the row stays for export, and the
    // rest of the comparison is unaffected.
    await page.evaluate(async (entry) => {
      await (window as any).__boxingDebug.storageSet({ ['boxingLayout.conflict.' + entry.ts]: entry });
    }, archivedEntryWithUrl('javascript:alert(1)'));
    await closeCompare(page);
    await openCompare(page);
    expect(await fieldPaths(page)).not.toContain(P_URL);
    expect(await fieldPaths(page)).toContain(P_TITLE);
  });

  test('AC6: geometry is adopted as pairs, the star goes through the mutation entry, and nothing is tombstoned', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, archivedEntry());
    await openCompare(page);
    expect(await adoptField(page, P_STAR)).toBe(true);
    expect(await adoptField(page, P_TITLE)).toBe(true);
    expect(await adoptField(page, 'large:L1#position')).toBe(true);
    expect(await adoptField(page, 'large:L1#size')).toBe(true);
    expect(await clickApply(page)).toBe(true);

    const after = await memoryLayout(page);
    expect(after.boxes[0].isParent).toBe(true);              // star adopted via toggleStarMark
    expect(after.boxes[0].title).toBe('Cloud Root');         // second selected field lands too
    // A position/size choice is one field: both coordinates, both dimensions, never half.
    expect([after.boxes[0].x, after.boxes[0].y]).toEqual([900, 900]);
    expect([after.boxes[0].width, after.boxes[0].height]).toEqual([420, 300]);
    expect(after.boxes[0].pinned).toBe(false);               // unselected fields stay current
    expect(after.boxes[0].collapseHover).toBe(false);
    // Adjudication writes, it does not delete: no tombstone for anything it touched.
    const deleted = await page.evaluate(() => Object.keys((window as any).__boxingDebug.layout._meta?.deleted || {}));
    expect(deleted.filter((k: string) => k.startsWith('L1') || k.startsWith('S1') || k === 'b1' || k.includes(':L1'))).toEqual([]);
    const stored = JSON.parse(await storedValue(page));
    // The runtime groups mirror is stripped before persisting, so it is absent entirely.
    expect(stored.groups).toBeUndefined();
    expect(stored.settings.selectedLanguage).toBe('en');
    // Star truth stays isParent, and the group mirror is derived, not authored.
    expect(await page.evaluate(() => (window as any).__boxingDebug.state().boxes)).toBe(2);
  });

  test('AC4: a truncated archive body is not applicable', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, archivedEntry({ truncated: true, raw: undefined }));
    await openCompare(page);
    expect(await panelText(page)).toContain('missing or truncated');
    expect(await fieldPaths(page)).toEqual([]);
    expect(await hasApplyButton(page)).toBe(false);
    // Nothing was offered, so nothing can have changed: the canvas is byte-identical.
    expect((await memoryLayout(page)).boxes[0].title).toBe('Local Root');
  });

  test('AC4: a pruned archive body (index row without the body) is not applicable', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, archivedEntry());
    await page.evaluate(async (ts) => {
      await (window as any).__boxingDebug.storageRemove('boxingLayout.conflict.' + ts);
    }, CONFLICT_TS);
    await openCompare(page);
    expect(await panelText(page)).toContain('missing or truncated');
    expect(await hasApplyButton(page)).toBe(false);
    expect(await fieldPaths(page)).toEqual([]);
  });

  test('AC4: a deleted target is reported and never rebuilt', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, archivedEntry());
    // The user deletes L1 through the real mutation entry, then opens the comparison.
    await page.evaluate(() => { (window as any).__boxingDebug._execDeleteLargeBox('L1'); });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length), { timeout: 10000 }).toBe(1);
    await openCompare(page);

    const text = await panelText(page);
    expect(text).toContain('no longer exists');
    // The deleted target is reported, but nothing about it can be adopted or applied.
    expect(await fieldPaths(page)).toEqual([]);
    expect(await hasApplyButton(page)).toBe(false);
    // The verdict cannot resurrect a box the user deleted afterwards.
    expect(await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.some((b: any) => b.id === 'L1'))).toBe(false);
  });

  test('AC4+AC5: a target that moved after the comparison is re-compared and re-confirmed, never overwritten', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, archivedEntry());

    // AC5: comparing and closing is read-only — none of the user's data moves.
    const dataBefore = await storedData(page);
    await openCompare(page);
    expect(await confirmModalHidden(page)).toBe(true);
    await closeCompare(page);
    expect(await storedData(page)).toBe(dataBefore);

    await openCompare(page);
    expect(await adoptField(page, P_TITLE)).toBe(true);

    // Another tab renames the SAME box, through the real cross-tab apply path.
    const externallySet = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const incoming = JSON.parse(JSON.stringify(dbg.layout));
      incoming.boxes[0].title = 'Renamed Elsewhere';
      incoming._meta = Object.assign({}, incoming._meta, {
        revision: (Number(incoming._meta?.revision) || 0) + 50,
        updatedAt: Date.now() + 1000, writerId: 'other-tab-writer',
      });
      dbg.applyExternalLayout(incoming);
      return incoming.boxes[0].title;
    });
    expect(externallySet).toBe('Renamed Elsewhere');
    await expect.poll(async () => (await memoryLayout(page)).boxes[0].title, { timeout: 10000 }).toBe('Renamed Elsewhere');

    // The stale verdict is refused: refresh + re-confirm instead of writing over unseen edits.
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/changed after this comparison/);
    expect((await keepRadios(page)).every(Boolean)).toBe(true); // every choice reset
    const after = await memoryLayout(page);
    expect(after.boxes[0].title).toBe('Renamed Elsewhere');     // not the archive value
    expect(after.boxes[0].title).not.toBe('Cloud Root');

    // Confirming against the FRESH diff is what applies now.
    expect(await adoptField(page, P_TITLE)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(async () => (await memoryLayout(page)).boxes[0].title, { timeout: 10000 }).toBe('Cloud Root');
  });

  test('AC7: every comparison key exists in all 14 locales and in the en fallback', () => {
    const keys = [
      'dataConflictCompareBtn', 'dataConflictDiffHeading', 'dataConflictKeepCurrent',
      'dataConflictAdoptCopy', 'dataConflictApplyBtn', 'dataConflictNoDiffs',
      'dataConflictBodyUnavailable', 'dataConflictTargetMissing', 'dataConflictStale',
      'dataConflictApplied', 'dataConflictLevelLargeBox', 'dataConflictLevelSmallBox',
      'dataConflictLevelBookmark', 'dataConflictFieldTitle', 'dataConflictFieldPosition',
      'dataConflictFieldSize', 'dataConflictFieldPinned', 'dataConflictFieldStar', 'dataConflictFieldUrl',
    ];
    const i18nSrc = fs.readFileSync(path.join(EXTENSION_PATH, 'ntp', 'i18n.js'), 'utf8');
    for (const key of keys) expect(i18nSrc, 'fallback for ' + key).toContain('I18N_FALLBACK.' + key + ' = ');

    const langs = fs.readdirSync(path.join(EXTENSION_PATH, '_locales'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);
    expect(langs.length).toBe(14);
    for (const lang of langs) {
      const msgs = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, '_locales', lang, 'messages.json'), 'utf8'));
      for (const key of keys) {
        expect(msgs[key], 'Missing key "' + key + '" in _locales/' + lang + '/messages.json').toBeDefined();
        expect(typeof msgs[key].message).toBe('string');
        expect(msgs[key].message.length).toBeGreaterThan(0);
      }
    }
    // The auto-expand column reuses the existing control label, not a near-duplicate key.
    const en = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, '_locales', 'en', 'messages.json'), 'utf8'));
    expect(en.autoExpand.message.length).toBeGreaterThan(0);
  });
});

// #53 T3: the key browser flow must run in an ACTUAL extension build. The suite's chromium
// project installs the repo root, while AGENTS.md is explicit that Chrome loads from
// dist/boxing-chrome — so this launches its own persistent context on the built tree, the
// way the store-screenshot harness does (test/tests/take-store-screenshots.mjs). It skips
// visibly when the build is absent; it is never quietly downgraded to the file:// page.
test.describe('Issue #54 — golden path in the real Chrome extension build', () => {

  test('AC-real: compare and adopt inside the loaded extension write to real chrome.storage.local', async ({}, testInfo) => {
    test.setTimeout(180000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'the loaded build is a chromium lane');
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - run npm run build first');

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue54-ext-'));
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
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageSet)), { timeout: 30000 }).toBe(true);
      // Lane proof: this page is served by the extension, not from disk.
      expect(page.url()).toContain('chrome-extension://');

      const entry = archivedEntry();
      await page.evaluate(async ({ layout, conflict }) => {
        const dbg = (window as any).__boxingDebug;
        await dbg.storageSet({ ['boxingLayout.conflict.' + conflict.ts]: conflict });
        await dbg.storageSet({ 'boxingLayout.conflict.index': [{
          ts: conflict.ts, reason: conflict.reason, side: conflict.side,
          size: conflict.size, boxes: conflict.boxes || 0, truncated: false,
        }] });
        await dbg.storageSet({ boxingLayout: layout });
      }, { layout: liveLayout(), conflict: entry });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageSet)), { timeout: 30000 }).toBe(true);
      await dismissOnboarding(page);
      await openSettingsDataTab(page);
      await openCompare(page);

      expect((await fieldPaths(page)).length).toBeGreaterThan(0);
      expect((await keepRadios(page)).every(Boolean)).toBe(true);
      expect(await adoptField(page, P_TITLE)).toBe(true);
      expect(await adoptField(page, P_URL)).toBe(true);
      expect(await clickApply(page)).toBe(true);
      await expect.poll(() => panelText(page), { timeout: 15000 }).toMatch(/Applied 2 field/);

      // Bytes read back through the facade are the extension's own storage.local.
      const stored = JSON.parse(await storedValue(page));
      expect(stored.boxes[0].title).toBe('Cloud Root');
      expect(stored.boxes[0].children[0].bookmarks[0].url).toBe('https://cloud.test/b1');
      expect(stored.boxes[0].x).toBe(40);                    // unselected fields unchanged
      expect(stored.boxes[1].title).toBe('Other Root');
      expect(stored.groups).toBeUndefined();                 // runtime mirror never persists
      // Applying kept the archive: still one index row, still the verbatim body.
      expect(JSON.parse(await storedValue(page, 'boxingLayout.conflict.index'))).toHaveLength(1);
      const body = JSON.parse(await storedValue(page, 'boxingLayout.conflict.' + CONFLICT_TS));
      expect(body.raw.boxes[0].title).toBe('Cloud Root');
    } finally {
      await ctx.close().catch(() => { /* lane teardown is best-effort */ });
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
