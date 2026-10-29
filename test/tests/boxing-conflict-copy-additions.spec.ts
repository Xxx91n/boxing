// Boxing — issue #55 (#53 D2): explicitly add back copy-only small boxes and bookmarks.
// AC coverage:
//   AC1  the existing layered comparison recognizes a small box / bookmark that only the
//        archived copy has, offers it as one explicit whole-object choice, and an
//        unselected one leaves the current layout exactly as it was.
//   AC2  an add lands only in the corresponding subtree that STILL exists, keeps what is
//        already there, and never rebuilds a deleted target: a copy-only large box stays
//        "no longer exists" with its children, and a copy-only id the user deleted after
//        the copy was archived is reported, not resurrected. Applying is not a wholesale
//        canvas/settings replace.
//   AC3  a copy that lacks an object never deletes the current one, and objects both sides
//        have stay in #54's per-field verdicts — the add path cannot silently overwrite a
//        matched value, and #54's field list does not regress when adds share the panel.
//   AC4  the added object keeps the archive's own id and only user-editable content: no
//        counters, no _meta, no per-box view state, no raw JSON. Membership goes through
//        the unified mutation entry (commit) and the star through the star entry, so the
//        index, DSU and view-state rules hold; the existing per-box item cap still binds.
//   AC5  inherits #54's guards: a missing/truncated body offers nothing at all, a target
//        that changed after the comparison is re-compared and re-confirmed instead of
//        force-applied, and the conflict copy itself survives the apply.
//   AC6  real UI + the existing storage facade prove add / unselected-unchanged / current
//        content preserved / no force-apply, and the same add survives a reload of the
//        stored payload.
//   AC7  static gate: every new key exists in all 14 locale files and in the en fallback.
//   AC-real  the golden path in the ACTUAL built extension (dist/boxing-chrome).
//
// LANES ARE NOT INTERCHANGEABLE (#53 T3): AC1-AC7 run on the file:// mock lane, the same
// seam #54 and the ticket-79 readout spec use; the real-build lane is a separate describe
// that launches its own persistent Chromium on dist/. Input is JS-dispatched like the
// sibling data-tab specs. Seeding happens before the first navigation (addInitScript).
// Storage goes through __boxingDebug.storageGet/Set — the existing facade seam, no new
// test-only production interface.
//
// SAMPLE SOURCES (#53 T2, user-confirmed for this ticket): every fixture below is shaped
// like a payload the production archive path actually writes — a verbatim cloud large box
// from the import-merge and webdav field-conflict calls to archiveConflictLayouts
// (ntp/settings-ui.js, ntp/sync-engine.js), or the parent-wrapped diverged child from the
// webdav-child-conflict call in ntp/sync-engine.js — on top of #54's L1/L2/S1/b1 canvas.
// The new dimension is only "the canvas does not have this id".
//
// KNOWN GAP, DECLARED NOT HIDDEN: Firefox. The suite has never loaded an extension in
// Firefox (its project installs no add-on), so AC-real covers the built Chrome extension
// and states the missing-build reason instead of passing quietly.
import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp', 'index.html')).href;
const DIST_CHROME = path.join(EXTENSION_PATH, 'dist', 'boxing-chrome');

const CONFLICT_TS = 1726100000000;
const LIST = '#data-conflict-list';
const PANEL = LIST + ' .data-conflict-diff';
// The add addresses are box keys without the #field suffix (GLOSSARY "copy-only object").
const P_BOX = 'small:L1:S2';
const P_BM = 'small:L1:S1:b2';
const P_TITLE = 'large:L1#title';
const P_URL = 'small:L1:S1:b1#url';
// ntp/state.js — the production per-box caps, not spec inventions.
const MAX_BOOKMARKS = 50;
const MAX_SMALL_BOXES = 500;

// Canvas state: L1 (+ child S1 + bookmark b1) and an unrelated L2. Deliberately the same
// canvas #54 compares, so the two tickets' row sets can be asserted side by side.
function liveLayout(): any {
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

// The copy-only small box (sample A): a subtree the canvas never received, with its own
// bookmarks. Its title/url/geometry are the archive's, and nextSmallIndex/_meta/viewState
// are the internal state the add must NOT carry in.
function copyOnlySmallBox(over: any = {}) {
  return {
    id: 'S2', type: 'small', title: 'Cloud Small', x: 300, y: 120, width: 240, height: 180,
    pinned: true, collapseHover: false, isParent: false,
    bookmarks: [
      { id: 'b3', title: 'Cloud Bookmark', url: 'https://cloud.test/b3' },
      { id: 'b4', title: 'Another Cloud Bookmark', url: 'https://cloud.test/b4' },
    ],
    nextSmallIndex: 7, _meta: { internal: 'must not travel' }, viewState: { innerZoom: 9 },
    ...over,
  };
}

// The verbatim cloud large box an import/sync field conflict archives (the
// archiveConflictLayouts({ boxes: conflicts }) call sites): same ids as the canvas
// PLUS a copy-only child (S2) and a copy-only bookmark (b2) inside the matched child.
function archivedCloudBox(over: any = {}) {
  const box: any = {
    id: 'L1', type: 'large', title: 'Cloud Root', x: 900, y: 900, width: 420, height: 300,
    pinned: true, collapseHover: true, isParent: true, nextSmallIndex: 99,
    children: [{
      id: 'S1', type: 'small', title: 'Local Small', x: 0, y: 0, width: 240, height: 180,
      pinned: false,
      bookmarks: [
        { id: 'b1', title: 'Shared Bookmark', url: 'https://cloud.test/b1' },
        { id: 'b2', title: 'Cloud Only Bookmark', url: 'https://cloud.test/b2' },
      ],
    }, copyOnlySmallBox()],
    ...over,
  };
  return box;
}

function entryOf(boxes: any[], over: any = {}) {
  return {
    ts: CONFLICT_TS, reason: 'webdav-field-conflict', side: 'cloud',
    raw: { boxes }, size: JSON.stringify(boxes).length, boxes: boxes.length, ...over,
  };
}

const copyEntry = (over: any = {}, boxOver: any = {}) => entryOf([archivedCloudBox(boxOver)], over);

// Sample B: the parent-wrapped shape the webdav-child-conflict archive call in
// ntp/sync-engine.js writes for a diverged child — the wrapper carries only id/type/title
// (no geometry of its own), and the child inside it is the copy-only object the canvas
// never received.
const wrappedEntry = () => ({
  ts: CONFLICT_TS, reason: 'webdav-child-conflict', side: 'cloud',
  raw: { boxes: [{ id: 'L1', type: 'large', title: 'Local Root', children: [copyOnlySmallBox()] }] },
  size: 1, boxes: 1,
});

const jsClick = (page: any, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return false;
    el.click();
    return true;
  }, sel);

async function openSettingsDataTab(page: any) {
  await expect.poll(async () => {
    await jsClick(page, '#settings-btn');
    return page.evaluate(() => {
      const modal = document.getElementById('settings-modal') as HTMLElement | null;
      return Boolean(modal) && !modal!.hidden;
    });
  }, { timeout: 25000, message: 'settings modal must be open before the data tab is read' }).toBe(true);
  expect(await jsClick(page, '.settings-nav__item[data-tab="data"]')).toBe(true);
  await expect.poll(() => page.evaluate(() => !document.getElementById('tab-data')?.hidden), { timeout: 10000 }).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    document.querySelectorAll('#data-conflict-list .data-conflict-row-item').length), { timeout: 15000 }).toBeGreaterThan(0);
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

// The add rows the panel offers, in document order, with whether each one can be chosen.
const addRows = (page: any) =>
  page.evaluate((p) => Array.from(document.querySelectorAll(p + ' .data-conflict-add-row'))
    .map((el: any) => ({ path: el.dataset.path, tickable: Boolean(el.querySelector('input[type="checkbox"]')), text: el.textContent || '' })), PANEL);

const fieldPaths = (page: any) =>
  page.evaluate((p) => Array.from(document.querySelectorAll(p + ' .data-conflict-diff-field'))
    .map((el: any) => el.dataset.path), PANEL);

const tickAdd = (page: any, addPath: string) =>
  page.evaluate((p) => {
    const input = document.querySelector(
      '#data-conflict-list .data-conflict-add-row[data-path="' + p + '"] input[type="checkbox"]') as HTMLInputElement | null;
    if (!input) return false;
    input.click();
    return input.checked;
  }, addPath);

const adoptField = (page: any, fieldPath: string) =>
  page.evaluate(({ p, side }) => {
    const input = document.querySelector(
      '#data-conflict-list input[data-path="' + p + '"][value="' + side + '"]') as HTMLInputElement | null;
    if (!input) return false;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { p: fieldPath, side: 'copy' });

const applyDisabled = (page: any) =>
  page.evaluate((p) => (document.querySelector(p + ' .data-conflict-apply-btn') as HTMLButtonElement | null)?.disabled ?? null, PANEL);

const hasApplyButton = (page: any) =>
  page.evaluate((p) => Boolean(document.querySelector(p + ' .data-conflict-apply-btn')), PANEL);

const clickApply = (page: any) => jsClick(page, LIST + ' .data-conflict-apply-btn');

// #53 D2 keeps this after-the-fact: neither comparing nor adding may put a decision dialog
// in front of the canvas the user is working on (import and sync keep their own specs).
const confirmModalHidden = (page: any) =>
  page.evaluate(() => Boolean(document.getElementById('confirm-modal')?.hidden));

const memoryLayout = (page: any) =>
  page.evaluate(() => JSON.parse(JSON.stringify((window as any).__boxingDebug.layout)));

const storedValue = (page: any, key = 'boxingLayout') =>
  page.evaluate(async (k) => JSON.stringify((await (window as any).__boxingDebug.storageGet(k))?.[k] ?? null), key);

// The user-visible part of the stored payload, without the write bookkeeping boot migration
// legitimately moves. This is what "choosing nothing changed nothing" is measured against.
const storedData = (page: any) =>
  page.evaluate(async () => {
    const stored = (await (window as any).__boxingDebug.storageGet('boxingLayout'))?.boxingLayout || {};
    return JSON.stringify({ boxes: stored.boxes, settings: stored.settings, connections: stored.connections });
  });

const childIds = (page: any) =>
  page.evaluate(() => (((window as any).__boxingDebug.layout.boxes.find((b: any) => b.id === 'L1') || {}).children || []).map((c: any) => c.id));

const bookmarkIds = (page: any) =>
  page.evaluate(() => {
    const lb = (window as any).__boxingDebug.layout.boxes.find((b: any) => b.id === 'L1');
    return (((lb || {}).children.find((s: any) => s.id === 'S1') || {}).bookmarks || []).map((b: any) => b.id);
  });

// #53 D2: adding is something the user has to ask for, so the default state must be
// provably inert — no checkbox pre-ticked, and the apply control stayed disabled.
const tickedAdds = (page: any) =>
  page.evaluate((p) => Array.from(document.querySelectorAll(p + ' .data-conflict-add-row input[type="checkbox"]'))
    .map((el: any) => el.checked), PANEL);

async function bootFileLane(page: any, entry: any, seedLayout?: any) {
  const layout = seedLayout || liveLayout();
  await page.addInitScript(({ layout, conflict }) => {
    localStorage.setItem('boxingLayout', JSON.stringify(layout));
    localStorage.setItem('bxstore:boxingLayout.conflict.' + conflict.ts, JSON.stringify(conflict));
    localStorage.setItem('bxstore:boxingLayout.conflict.index', JSON.stringify([{
      ts: conflict.ts, reason: conflict.reason, side: conflict.side,
      size: conflict.size, boxes: conflict.boxes || 0, truncated: !!conflict.truncated,
    }]));
  }, { layout, conflict: entry });
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageGet)), { timeout: 20000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().boxes), { timeout: 20000 })
    .toBe(layout.boxes.length);
  await dismissOnboarding(page);
  await openSettingsDataTab(page);
}

test.describe('Issue #55 — explicit add of copy-only small boxes and bookmarks (file:// UI lane)', () => {

  test('AC1: copy-only objects appear as one explicit choice each, unticked, and nothing is selected', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, copyEntry());
    await openCompare(page);

    // Same panel, same list — no second conflict surface anywhere in the document.
    expect(await page.evaluate(() => document.querySelectorAll('.data-conflict-diff').length
      - document.querySelectorAll('#data-conflict-list .data-conflict-diff').length)).toBe(0);
    const rows = await addRows(page);
    // One row per copy-only object: the bookmarks inside S2 come with it and never open as
    // separate choices of their own.
    expect(rows.map((r: any) => r.path)).toEqual([P_BM, P_BOX]);
    expect(rows.every((r: any) => r.tickable)).toBe(true);
    // #53 D2 default: nothing added, so the apply control cannot even be pressed.
    expect((await tickedAdds(page)).every(Boolean)).toBe(false);
    expect(await applyDisabled(page)).toBe(true);
    // Un-selected content does not move: the canvas is exactly the seeded layout.
    expect(await childIds(page)).toEqual(['S1']);
    expect(await bookmarkIds(page)).toEqual(['b1']);
    // Internal state of the archive never becomes a row the user can decide.
    const text = await panelText(page);
    expect(text).not.toContain('nextSmallIndex');
    expect(text).not.toContain('viewState');
  });

  test('AC1+AC2: an explicitly added small box lands in the existing subtree and keeps what is there', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, copyEntry());
    await openCompare(page);
    expect(await tickAdd(page, P_BOX)).toBe(true);
    expect(await applyDisabled(page)).toBe(false);
    expect(await clickApply(page)).toBe(true);
    expect(await confirmModalHidden(page)).toBe(true);        // no modal in front of the canvas
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Added 1 item/);

    const after = await memoryLayout(page);
    const lb = after.boxes.find((b: any) => b.id === 'L1');
    const s2 = lb.children.find((s: any) => s.id === 'S2');
    // The archive's own object: its id, its user-editable content, its bookmarks with it.
    expect(s2).toEqual(expect.objectContaining({
      id: 'S2', type: 'small', title: 'Cloud Small', x: 300, y: 120, width: 240, height: 180,
      pinned: true, collapseHover: false,
    }));
    expect(s2.bookmarks.map((b: any) => b.id)).toEqual(['b3', 'b4']);
    // Current content of the same subtree is preserved, not replaced.
    expect(lb.children.map((s: any) => s.id)).toEqual(['S1', 'S2']);
    expect(lb.title).toBe('Local Root');                 // no field was adopted
    expect(lb.x).toBe(40);
    expect(lb.children[0].pinned).toBe(true);
    expect(lb.children[0].bookmarks[0].url).toBe('https://local.test/b1');
    // Only that subtree changed: the other box and the settings are untouched.
    expect(after.boxes.find((b: any) => b.id === 'L2')).toEqual(expect.objectContaining({ title: 'Other Root', x: 500 }));
    expect(after.settings.selectedLanguage).toBe('en');
    expect(after.settings.darkMode).toBe('light');
    // AC4: only the whitelisted content came in — no counter, no _meta, no per-box view state.
    expect(s2.nextSmallIndex).toBeUndefined();
    expect(s2._meta).toBeUndefined();
    expect(s2.viewState).toBeUndefined();
    // The same object is what reached storage.
    const stored = JSON.parse(await storedValue(page));
    expect(stored.boxes.find((b: any) => b.id === 'L1').children.map((s: any) => s.id)).toEqual(['S1', 'S2']);
    // AC5: applying is not deleting — the copy is still listed with its verbatim body.
    expect(JSON.parse(await storedValue(page, 'boxingLayout.conflict.index'))).toHaveLength(1);
    const body = JSON.parse(await storedValue(page, 'boxingLayout.conflict.' + CONFLICT_TS));
    expect(body.raw.boxes[0].children[1].title).toBe('Cloud Small');
  });

  test('AC1+AC3: choosing only the bookmark adds only it, and a bookmark the copy lacks survives', async ({ page }) => {
    test.setTimeout(90000);
    // bLocal exists only on the canvas: an incomplete copy must not read as a delete order
    // (#53 D2 — 副本缺项不自动删除当前内容).
    const seeded = liveLayout();
    seeded.boxes[0].children[0].bookmarks.push({ id: 'bLocal', title: 'Only On Canvas', url: 'https://local.test/bLocal' });
    await bootFileLane(page, copyEntry(), seeded);
    await openCompare(page);
    expect(await tickAdd(page, P_BM)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Added 1 item/);
    expect(await bookmarkIds(page)).toEqual(['b1', 'bLocal', 'b2']);
    expect(await childIds(page)).toEqual(['S1']);
    const stored = JSON.parse(await storedValue(page));
    const lb = stored.boxes.find((b: any) => b.id === 'L1');
    expect(lb.children.map((s: any) => s.id)).toEqual(['S1']);
    expect(lb.children[0].bookmarks.map((b: any) => b.id)).toEqual(['b1', 'b2']);
    // AC3: adding did not touch the matched bookmark's value — #54 owns that decision.
    expect(lb.children[0].bookmarks[0].url).toBe('https://local.test/b1');
  });

  test('AC5: opening a comparison that offers adds changes no stored byte', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, copyEntry());
    const before = await storedData(page);
    await openCompare(page);
    expect((await addRows(page)).length).toBe(2);
    await closeCompare(page);
    expect(await storedData(page)).toBe(before);
    expect(await childIds(page)).toEqual(['S1']);
  });

  test('AC4: an added small box keeps working as a canvas object — same id, real delete after it', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, copyEntry());
    await openCompare(page);
    expect(await tickAdd(page, P_BOX)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => childIds(page), { timeout: 10000 }).toContain('S2');
    // The index map and DOM see it: entering the box renders the added small box, and the
    // unified mutation entry can delete it again by the same id.
    await page.evaluate(() => { (window as any).__boxingDebug.enterLargeBox('L1'); });
    await expect.poll(() => page.evaluate(() =>
      Boolean(document.querySelector('.small-box[data-id="S2"]'))), { timeout: 10000 }).toBe(true);
    await page.evaluate(() => { (window as any).__boxingDebug._execDeleteSmallBox('L1', 'S2'); });
    await expect.poll(() => childIds(page), { timeout: 10000 }).not.toContain('S2');
    // The only tombstones left are the ones this test's own final delete legitimately
    // wrote. Comparing, adopting fields and adding never tombstone, and nothing the user
    // kept — the box, its original child, either bookmark — is touched.
    const deleted = await page.evaluate(() => Object.keys((window as any).__boxingDebug.layout._meta?.deleted || {}));
    expect(deleted.filter((k: string) => k === 'L1' || k === 'S1' || k === 'b1' || k === 'b2'
      || k.includes(':L1:S1'))).toEqual([]);
    expect(deleted).toContain('S2');
    expect(deleted).toContain('small:L1:S2');
  });

  test('AC2: a copy-only large box is never rebuilt and its descendants never reach the add list', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, copyEntry());
    await page.evaluate(() => { (window as any).__boxingDebug._execDeleteLargeBox('L1'); });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length), { timeout: 10000 }).toBe(1);
    await openCompare(page);
    const text = await panelText(page);
    expect(text).toContain('no longer exists');
    // S2 / b2 lived under that box: with the target gone there is nothing to add into.
    expect(await addRows(page)).toEqual([]);
    expect(await fieldPaths(page)).toEqual([]);
    expect(await hasApplyButton(page)).toBe(false);
    expect(await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.some((b: any) => b.id === 'L1'))).toBe(false);
  });

  test('AC2: a copy-only id the user deleted after the archive is reported, not resurrected', async ({ page }) => {
    test.setTimeout(90000);
    // Same canvas, but S2 was present and the user deleted it through the real entry —
    // which is what puts its id in the tombstone set.
    const seeded = liveLayout();
    seeded.boxes[0].children.push({
      id: 'S2', type: 'small', title: 'Local Small Two', x: 300, y: 120, width: 240, height: 180,
      pinned: false, bookmarks: [{ id: 'b3', title: 'Cloud Bookmark', url: 'https://cloud.test/b3' }],
    });
    await bootFileLane(page, copyEntry(), seeded);
    expect(await page.evaluate(() => { (window as any).__boxingDebug._execDeleteSmallBox('L1', 'S2'); return true; })).toBe(true);
    await expect.poll(() => childIds(page), { timeout: 10000 }).not.toContain('S2');
    const tombstoned = await page.evaluate(() => Object.keys((window as any).__boxingDebug.layout._meta?.deleted || {}));
    expect(tombstoned).toContain('S2');

    await openCompare(page);
    const rows = await addRows(page);
    const boxRow = rows.find((r: any) => r.path === P_BOX);
    expect(boxRow.tickable).toBe(false);
    expect(boxRow.text).toContain('deleted after the copy');
    // b2 was never deleted, so its own add stays available.
    expect(rows.find((r: any) => r.path === P_BM).tickable).toBe(true);
    // Applying the one available add cannot drag the deleted box back in.
    expect(await tickAdd(page, P_BM)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Added 1 item/);
    expect(await childIds(page)).toEqual(['S1']);
    const stored = JSON.parse(await storedValue(page));
    expect(stored.boxes.find((b: any) => b.id === 'L1').children.map((s: any) => s.id)).toEqual(['S1']);
  });

  test('AC4: an id that already exists elsewhere on the canvas is refused, not duplicated', async ({ page }) => {
    test.setTimeout(90000);
    // L2 already holds a small box with the archive's S2 id.
    const seeded = liveLayout();
    seeded.boxes[1].children = [{
      id: 'S2', type: 'small', title: 'Elsewhere Small', x: 10, y: 10, width: 240, height: 180,
      pinned: false, bookmarks: [],
    }];
    await bootFileLane(page, copyEntry(), seeded);
    await openCompare(page);
    const boxRow = (await addRows(page)).find((r: any) => r.path === P_BOX);
    expect(boxRow.tickable).toBe(false);
    expect(boxRow.text).toContain('already on your canvas');
    expect(await hasApplyButton(page)).toBe(true);   // b2 is still addable
    expect(await tickAdd(page, P_BOX)).toBe(false);  // a refusal renders no control to tick
    expect(await tickAdd(page, P_BM)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Added 1 item/);
    // Only one S2 exists, and it is the one L2 already had.
    const after = await memoryLayout(page);
    expect(after.boxes.filter((b: any) => (b.children || []).some((s: any) => s.id === 'S2')).length).toBe(1);
    expect(after.boxes[1].children[0].title).toBe('Elsewhere Small');
    expect(after.boxes[0].children.map((s: any) => s.id)).toEqual(['S1']);
  });

  test('AC4: a copy-only object the app cannot store is refused whole, never half-inserted', async ({ page }) => {
    test.setTimeout(90000);
    // One javascript: url inside S2's bookmarks: the app refuses to store that url at all,
    // so the whole box is refused rather than inserted minus one bookmark silently.
    const bad = copyEntry({}, {});
    (bad.raw.boxes[0].children[1].bookmarks[1] as any).url = 'javascript:alert(1)';
    await bootFileLane(page, bad);
    await openCompare(page);
    const boxRow = (await addRows(page)).find((r: any) => r.path === P_BOX);
    expect(boxRow.tickable).toBe(false);
    expect(boxRow.text).toContain('cannot be stored as the copy holds it');
    expect(await childIds(page)).toEqual(['S1']);

    // Geometry that cannot be placed is refused the same way.
    const noGeo = copyEntry();
    delete (noGeo.raw.boxes[0].children[1] as any).width;
    await page.evaluate(async (entry) => {
      await (window as any).__boxingDebug.storageSet({ ['boxingLayout.conflict.' + entry.ts]: entry });
    }, noGeo);
    await closeCompare(page);
    await openCompare(page);
    expect((await addRows(page)).find((r: any) => r.path === P_BOX).tickable).toBe(false);
  });

  test('AC4: a repeated id inside one archived small box refuses the whole box', async ({ page }) => {
    test.setTimeout(90000);
    // The id is the merge key, so a copy that lists b3 twice would lose one bookmark at the
    // next cross-tab merge. That payload is not addable, and it must not be offered.
    const dup = copyEntry();
    dup.raw.boxes[0].children[1].bookmarks = [
      { id: 'b3', title: 'First B3', url: 'https://cloud.test/b3' },
      { id: 'b3', title: 'Second B3', url: 'https://cloud.test/b3b' },
    ];
    await bootFileLane(page, dup);
    await openCompare(page);
    const boxRow = (await addRows(page)).find((r: any) => r.path === P_BOX);
    expect(boxRow.tickable).toBe(false);
    expect(boxRow.text).toContain('cannot be stored as the copy holds it');
    expect(await tickAdd(page, P_BOX)).toBe(false);
    expect(await childIds(page)).toEqual(['S1']);
  });

  test('AC4: a starred copy-only box keeps its star through the star entry, not as a field', async ({ page }) => {
    test.setTimeout(90000);
    // isParent is DSU leader truth (GLOSSARY), so the added box's star must land via the
    // star path — and the archive's starred L1 must stay an unadopted FIELD verdict.
    const starred = copyEntry({}, {});
    starred.raw.boxes[0].children[1].isParent = true;
    await bootFileLane(page, starred);
    await openCompare(page);
    expect(await tickAdd(page, P_BOX)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Added 1 item/);
    const after = await memoryLayout(page);
    const lb = after.boxes.find((b: any) => b.id === 'L1');
    const s2 = lb.children.find((s: any) => s.id === 'S2');
    expect(s2.isParent).toBe(true);
    expect(lb.isParent).toBeFalsy();                 // the star FIELD of L1 was never adopted
    const stored = JSON.parse(await storedValue(page));
    expect(stored.boxes.find((b: any) => b.id === 'L1').children.find((s: any) => s.id === 'S2').isParent).toBe(true);
    // Star truth stays the persisted field; the group mirror is derived and never stored.
    expect(stored.groups).toBeUndefined();
  });

  test('AC4: one id claimed by two candidate rows refuses both, not the later one', async ({ page }) => {
    test.setTimeout(90000);
    // b9 is offered twice by the same copy: as its own row inside S1, and again inside the
    // copy-only box S2. Whichever the archive happened to list first, adding both would put
    // two objects under one merge key, so NEITHER is offered — no listing-order winner.
    const rival = copyEntry();
    rival.raw.boxes[0].children[0].bookmarks.push({ id: 'b9', title: 'Rival B9', url: 'https://cloud.test/b9' });
    rival.raw.boxes[0].children[1].bookmarks.push({ id: 'b9', title: 'Same B9 in the box', url: 'https://cloud.test/b9' });
    await bootFileLane(page, rival);
    await openCompare(page);
    const rows = await addRows(page);
    expect(rows.map((r: any) => r.path)).toEqual([P_BM, 'small:L1:S1:b9', P_BOX]);
    expect(rows.filter((r: any) => r.tickable).map((r: any) => r.path)).toEqual([P_BM]);
    expect(rows.find((r: any) => r.path === 'small:L1:S1:b9').text).toContain('cannot be stored as the copy holds it');
    expect(rows.find((r: any) => r.path === P_BOX).text).toContain('cannot be stored as the copy holds it');
    expect(await tickAdd(page, 'small:L1:S1:b9')).toBe(false);
    expect(await tickAdd(page, P_BOX)).toBe(false);
    // The unrelated copy-only bookmark is still a real choice.
    expect(await tickAdd(page, P_BM)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Added 1 item/);
    expect(await childIds(page)).toEqual(['S1']);
    expect(await bookmarkIds(page)).toEqual(['b1', 'b2']);
  });

  test('AC4: the existing per-small-box cap still binds an add', async ({ page }) => {
    test.setTimeout(90000);
    // L1 is exactly at the production cap (ntp/state.js MAX_SMALL_BOXES), so the add has to
    // be refused by the mutation entry rather than pushing the layout over its limit.
    const full = liveLayout();
    const kids: any[] = [];
    for (let i = 1; i < MAX_SMALL_BOXES; i++) {
      kids.push({ id: 'k' + i, type: 'small', title: 'Box ' + i, x: i, y: 0, width: 240, height: 180, pinned: false, bookmarks: [] });
    }
    // S1 plus 499 generated boxes = the cap, so the fixture itself stays a legal canvas.
    full.boxes[0].children = [full.boxes[0].children[0]].concat(kids);
    await bootFileLane(page, copyEntry(), full);
    await openCompare(page);
    expect(await tickAdd(page, P_BOX)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/item limit/);
    const stored = JSON.parse(await storedValue(page));
    const lb = stored.boxes.find((b: any) => b.id === 'L1');
    expect(lb.children.some((s: any) => s.id === 'S2')).toBe(false);
    expect(lb.children).toHaveLength(MAX_SMALL_BOXES);
  });

  test('AC4: the existing per-small-box bookmark cap still binds an add', async ({ page }) => {
    test.setTimeout(90000);
    // S1 is already at the production cap, and the copy offers one more bookmark.
    const full = liveLayout();
    const bms: any[] = [];
    for (let i = 1; i <= MAX_BOOKMARKS; i++) {
      bms.push({ id: 'b' + i, title: 'Bookmark ' + i, url: 'https://local.test/b' + i });
    }
    full.boxes[0].children[0].bookmarks = bms;
    const entry = copyEntry();
    // Only the matched child stays in this copy: the one add on offer is the 51st bookmark.
    entry.raw.boxes[0].children = [entry.raw.boxes[0].children[0]];
    entry.raw.boxes[0].children[0].bookmarks = bms.concat([{ id: 'b51', title: 'Cloud Only Bookmark', url: 'https://cloud.test/b51' }]);
    await bootFileLane(page, entry, full);
    await openCompare(page);
    const rows = await addRows(page);
    expect(rows.length).toBe(1);
    expect(rows[0].path).toBe('small:L1:S1:b51');
    expect(await tickAdd(page, 'small:L1:S1:b51')).toBe(true);
    expect(await clickApply(page)).toBe(true);
    // Refused by the cap, said out loud, and nothing was inserted.
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/item limit/);
    expect(await bookmarkIds(page)).toHaveLength(MAX_BOOKMARKS);
    const stored = JSON.parse(await storedValue(page));
    expect(stored.boxes[0].children[0].bookmarks).toHaveLength(MAX_BOOKMARKS);
  });

  test('AC5: a target that appeared after the comparison is re-compared, not force-applied', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, copyEntry());
    await openCompare(page);
    expect(await tickAdd(page, P_BOX)).toBe(true);

    // Another tab adds an S2 of its own, with different content, through the real external path.
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const incoming = JSON.parse(JSON.stringify(dbg.layout));
      incoming.boxes[0].children.push({
        id: 'S2', type: 'small', title: 'Renamed Elsewhere', x: 5, y: 5, width: 240, height: 180,
        pinned: false, bookmarks: [],
      });
      incoming._meta = Object.assign({}, incoming._meta, {
        revision: (Number(incoming._meta?.revision) || 0) + 50,
        updatedAt: Date.now() + 1000, writerId: 'other-tab-writer',
      });
      dbg.applyExternalLayout(incoming);
    });
    await expect.poll(() => childIds(page), { timeout: 10000 }).toContain('S2');

    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/changed after this comparison/);
    expect((await tickedAdds(page)).every(Boolean)).toBe(false);   // every checkbox reset
    // A refreshed panel always starts with the apply control disabled, so this corroborates
    // the reset rather than proving it. The proof is above and below: the apply was refused
    // with the staleness notice, and the content the other tab wrote survived untouched.
    expect(await applyDisabled(page)).toBe(true);
    const after = await memoryLayout(page);
    const s2 = after.boxes[0].children.find((s: any) => s.id === 'S2');
    expect(s2.title).toBe('Renamed Elsewhere');                    // the unseen content survived
    expect(s2.x).toBe(5);
    // The box row is gone — that id is on the canvas now — and its own bookmarks became the
    // copy-only items: the externally added S2 is empty, so the copy's b3/b4 are what is
    // missing from the subtree, and the refreshed diff offers them instead.
    expect((await addRows(page)).map((r: any) => r.path)).toEqual([
      'small:L1:S1:b2', 'small:L1:S2:b3', 'small:L1:S2:b4',
    ]);
  });

  test('AC5: a missing or truncated body offers no add at all', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, copyEntry({ truncated: true, raw: undefined }));
    await openCompare(page);
    expect(await panelText(page)).toContain('missing or truncated');
    expect(await addRows(page)).toEqual([]);
    expect(await fieldPaths(page)).toEqual([]);
    expect(await hasApplyButton(page)).toBe(false);
    expect(await childIds(page)).toEqual(['S1']);
  });

  test('AC3: #54 field verdicts still work in the same panel and the add never overwrites silently', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, copyEntry());
    await openCompare(page);
    // The #54 field list is unchanged by the two add rows sharing the panel.
    expect(await fieldPaths(page)).toEqual([
      'large:L1#title', 'large:L1#position', 'large:L1#size', 'large:L1#pinned',
      'large:L1#autoExpand', 'large:L1#star', 'small:L1:S1#pinned', P_URL,
    ]);
    expect((await addRows(page)).map((r: any) => r.path)).toEqual([P_BM, P_BOX]);
    // Adopt one field AND add one object in a single apply — the shared apply path.
    expect(await adoptField(page, P_TITLE)).toBe(true);
    expect(await tickAdd(page, P_BOX)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Added 1 item\(s\) back, applied 1 field/);
    const after = await memoryLayout(page);
    const lb = after.boxes.find((b: any) => b.id === 'L1');
    expect(lb.title).toBe('Cloud Root');                  // the adopted field
    expect(lb.children.map((s: any) => s.id)).toEqual(['S1', 'S2']);
    // Unadopted fields stayed current, including the one the add did not touch.
    expect(lb.x).toBe(40);
    expect(lb.children[0].bookmarks[0].url).toBe('https://local.test/b1');

    // A copy that LACKS an object must not delete it: L2 exists only on the canvas.
    expect(lb.id).toBe('L1');
    expect(after.boxes.find((b: any) => b.id === 'L2')).toBeDefined();
  });

  test('AC6: an add from the parent-wrapped child-conflict shape persists across a reload', async ({ page }) => {
    test.setTimeout(90000);
    await bootFileLane(page, wrappedEntry());
    await openCompare(page);
    const rows = await addRows(page);
    expect(rows.map((r: any) => r.path)).toEqual([P_BOX]);
    expect(await tickAdd(page, P_BOX)).toBe(true);
    expect(await clickApply(page)).toBe(true);
    await expect.poll(() => panelText(page), { timeout: 10000 }).toMatch(/Added 1 item/);
    // The one write the apply performed is what a reload reads back.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.storageGet)), { timeout: 20000 }).toBe(true);
    await expect.poll(() => page.evaluate(() =>
      ((window as any).__boxingDebug.layout.boxes.find((b: any) => b.id === 'L1') || {}).children?.length), { timeout: 20000 }).toBe(2);
    const stored = JSON.parse(await storedValue(page));
    const s2 = stored.boxes[0].children.find((s: any) => s.id === 'S2');
    expect(s2.title).toBe('Cloud Small');
    expect(s2.bookmarks.map((b: any) => b.id)).toEqual(['b3', 'b4']);
    // The runtime groups mirror is stripped before persisting, so it is absent entirely.
    expect(stored.groups).toBeUndefined();
  });

  test('AC7: every add key exists in all 14 locales and in the en fallback', () => {
    const keys = [
      'dataConflictAddBtn', 'dataConflictAddApplied', 'dataConflictAddSkippedExists',
      'dataConflictAddSkippedDeleted', 'dataConflictAddSkippedUnusable',
      'dataConflictAddSkippedFull', 'dataConflictAddFailed',
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
    // The summary line carries both counts, in every locale that resolves placeholders.
    const en = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, '_locales', 'en', 'messages.json'), 'utf8'));
    expect(Object.keys(en.dataConflictAddApplied.placeholders)).toEqual(['added', 'fields']);
    expect(en.dataConflictAddApplied.message).toContain('$added$');
    expect(en.dataConflictAddApplied.message).toContain('$fields$');
  });
});

// #53 T3: the key browser flow must run in an ACTUAL extension build. This launches its own
// persistent Chromium on dist/boxing-chrome (AGENTS.md: Chrome loads from dist/, never the
// repo root) and skips visibly when the build is absent.
test.describe('Issue #55 — add a copy-only small box in the real Chrome extension build', () => {

  test('AC-real: an explicit add writes through the real chrome.storage.local and renders', async ({}, testInfo) => {
    test.setTimeout(180000);
    test.skip(testInfo.project.name !== 'chromium-extension', 'the loaded build is a chromium lane');
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')),
      'dist/boxing-chrome is not built - run npm run build first');

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-issue55-ext-'));
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
      expect(page.url()).toContain('chrome-extension://');
      await dismissOnboarding(page);
      // skipOnboarding() queues a saveLayout while the seed below writes storage directly,
      // so awaiting the chain drains it before the fixture lands (the #54 lane note).
      await page.evaluate(() => (window as any).__boxingDebug.saveLayout());

      const entry = copyEntry();
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
      await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().boxes), { timeout: 30000 }).toBe(2);
      await dismissOnboarding(page);
      await openSettingsDataTab(page);
      await openCompare(page);

      expect((await addRows(page)).map((r: any) => r.path)).toEqual([P_BM, P_BOX]);
      expect(await tickAdd(page, P_BOX)).toBe(true);
      expect(await clickApply(page)).toBe(true);
      await expect.poll(() => panelText(page), { timeout: 15000 }).toMatch(/Added 1 item/);

      // Bytes read back through the facade are the extension's own storage.local.
      const stored = JSON.parse(await storedValue(page));
      const lb = stored.boxes.find((b: any) => b.id === 'L1');
      expect(lb.children.map((s: any) => s.id)).toEqual(['S1', 'S2']);
      expect(lb.children[1].title).toBe('Cloud Small');
      expect(lb.children[1].bookmarks.map((b: any) => b.id)).toEqual(['b3', 'b4']);
      expect(lb.children[0].bookmarks[0].url).toBe('https://local.test/b1');   // preserved
      expect(stored.boxes.find((b: any) => b.id === 'L2').title).toBe('Other Root');
      expect(stored.groups).toBeUndefined();
      // The conflict copy survived its own apply.
      expect(JSON.parse(await storedValue(page, 'boxingLayout.conflict.index'))).toHaveLength(1);
      // And the extension renders the added box for real, not only in the model.
      await page.evaluate(() => { (window as any).__boxingDebug.enterLargeBox('L1'); });
      await expect.poll(() => page.evaluate(() =>
        Boolean(document.querySelector('.small-box[data-id="S2"]'))), { timeout: 15000 }).toBe(true);
    } finally {
      await ctx.close().catch(() => { /* lane teardown is best-effort */ });
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
