// Boxing — ticket 107 (Wave9.20 A-062): P0 single-bookmark delete writes a tombstone and
// routes through the ADR-0007 unified commit entry.
//
// ROOT CAUSE (Q2 research + local evidence): popups.js deleted a bookmark with a bare
// `sb.bookmarks.splice(index, 1); saveLayout();` — no markDeleted, no commit. The
// cross-tab merge path (storage.applyExternalLayout -> mergeConcurrentLayout ->
// mergeById(local, remote, tombstones)) therefore had no tombstone to filter the stale
// remote copy with, so the bookmark came back after a merge or a reload.
//
// AC coverage (issues/107-bookmark-delete-commit-p0.md):
//   AC1 mutationHandlers.deleteBookmark returns tombstoneIds:[bmId]
//   AC2 popups delete button goes through commit('deleteBookmark', ...); bare splice gone
//   AC3 never-quarantine regression: add -> delete -> stale remote merge / reload ->
//       the bookmark does NOT come back + layout._meta.deleted contains the bm id
//   AC4 never-quarantine: this file name lands inside the waiver-ledger
//       NEVER_QUARANTINE family (boxing-sync), so no waiver row can ever be filed for it.
//
// Harness discipline (t44/t91 file:// mock lane): seed BEFORE the first navigation via
// addInitScript (no reload race). The stale remote is injected through
// window.__boxingDebug.applyExternalLayout — the very entry the cross-tab
// storage.onChanged bridge calls — so the assertion exercises the real
// mergeConcurrentLayout -> mergeById -> tombstones path, not a stand-in.
import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(EXTENSION_PATH, 'ntp', 'index.html')).href;
const POPUPS_SRC = path.resolve(EXTENSION_PATH, 'ntp', 'popups.js');
const RENDER_SRC = path.resolve(EXTENSION_PATH, 'ntp', 'render.js');

// L1/S1 with NO bookmarks: the spec adds one through the real popup, so the id under
// test is a production-generated makeId('bm') rather than a fixture constant.
function seedLayout() {
  return {
    version: 3.5, schemaVersion: 1, nextLargeIndex: 2,
    boxes: [{
      id: 'L1', type: 'large', title: 'T107 Root', x: 40, y: 40, width: 320, height: 220,
      nextSmallIndex: 2,
      children: [{ id: 'S1', title: 'T107 Small', x: 0, y: 0, width: 260, height: 190, pinned: true, bookmarks: [] }],
    }],
    connections: [], groups: [],
    settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, lastSyncAt: 0 },
    _meta: { revision: 3, updatedAt: Date.now() - 5000, writerId: 'spec-seed-writer-107' },
  };
}

async function seedAndBoot(page) {
  // Seed BEFORE the first navigation (t44/t91 no-reload-race discipline). The guard is
  // load-bearing: addInitScript re-runs on EVERY navigation — including page.reload() —
  // and an unguarded seed would rewrite the pre-delete payload over the state under test.
  await page.addInitScript((seed) => {
    if (!localStorage.getItem('boxingLayout')) localStorage.setItem('boxingLayout', JSON.stringify(seed));
  }, seedLayout());
  // Budget note (ticket 13 lesson): firefox headed launch + first paint on a loaded host can
  // exceed 10s, so the boot navigation gets the Playwright default rather than a tight cap.
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
}

// Enter the large box with a synthetic dblclick — native input stalls on the firefox
// headed lane (playwright#16095 class), same dispatch pattern as the innerclip specs.
async function enterLargeBox(page) {
  await page.evaluate(() => {
    const el = document.querySelector('.large-box[data-id="L1"]');
    el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('.small-box[data-id="S1"]'))), { timeout: 5000 }).toBe(true);
}

// Add one bookmark through the real add popup (no native input pipeline: the handler
// reads input.value directly, so setting value + a JS click is the full production path).
async function addBookmarkViaPopup(page, title, url) {
  await page.evaluate(() => {
    const btn = document.querySelector('.small-box[data-id="S1"] .bm-add-btn');
    btn?.click();
  });
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('.bm-edit-popup'))), { timeout: 5000 }).toBe(true);
  await page.evaluate(({ t, u }) => {
    const popup = document.querySelector('.bm-edit-popup');
    const ins = popup.querySelectorAll('input');
    ins[0].value = t;
    ins[1].value = u;
    const addBtn = Array.from(popup.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Add');
    addBtn.click();
  }, { t: title, u: url });
  await expect.poll(() => page.evaluate(() => {
    const dbg = window.__boxingDebug;
    const lb = dbg.layout.boxes.find((b) => b.id === 'L1');
    const sb = lb && lb.children.find((c) => c.id === 'S1');
    return (sb && sb.bookmarks ? sb.bookmarks.length : 0);
  }), { timeout: 5000 }).toBe(1);
}

// Delete that bookmark through the real edit popup delete button.
async function deleteBookmarkViaPopup(page, title) {
  await page.evaluate((t) => {
    const rows = Array.from(document.querySelectorAll('.small-box[data-id="S1"] .bm-row'));
    const row = rows.find((r) => (r.textContent || '').includes(t));
    row.querySelector('.bm-row__edit-btn').click();
  }, title);
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('.bm-edit-popup'))), { timeout: 5000 }).toBe(true);
  await page.evaluate(() => {
    const popup = document.querySelector('.bm-edit-popup');
    const delBtn = Array.from(popup.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Delete');
    delBtn.click();
  });
}

const readBookmarks = (page) => page.evaluate(() => {
  const dbg = window.__boxingDebug;
  const lb = dbg.layout.boxes.find((b) => b.id === 'L1');
  const sb = lb && lb.children.find((c) => c.id === 'S1');
  return {
    ids: (sb && sb.bookmarks ? sb.bookmarks : []).map((b) => b.id),
    deleted: Object.keys((dbg.layout._meta && dbg.layout._meta.deleted) || {}),
  };
});

const readPersisted = (page) => page.evaluate(async () => {
  const got = await window.__boxingDebug.storageGet(['boxingLayout']);
  const stored = got && got.boxingLayout;
  const lb = stored && (stored.boxes || []).find((b) => b.id === 'L1');
  const sb = lb && (lb.children || []).find((c) => c.id === 'S1');
  return {
    ids: (sb && sb.bookmarks ? sb.bookmarks : []).map((b) => b.id),
    deleted: Object.keys((stored && stored._meta && stored._meta.deleted) || {}),
  };
});

test.describe('Ticket 107 — bookmark delete writes a tombstone (never-quarantine)', () => {

  test('AC1+AC3: add -> delete -> stale remote merge -> reload never resurrects; _meta.deleted holds the bm id', async ({ page }) => {
    test.setTimeout(120_000); // ticket 13 lesson: firefox headed cold start on a shared host
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await seedAndBoot(page);
    await enterLargeBox(page);
    await addBookmarkViaPopup(page, 'T107 bookmark', 'https://t107.example.test/a');

    const bmId = (await readBookmarks(page)).ids[0];
    expect(typeof bmId).toBe('string');
    expect(bmId.length).toBeGreaterThan(0);

    // The stale-remote fixture is the post-add state, captured BEFORE the delete: exactly
    // what another device that has not yet seen the deletion still holds.
    const stale = await page.evaluate((id) => {
      const snapshot = JSON.parse(JSON.stringify(window.__boxingDebug.layout));
      snapshot._meta = { ...(snapshot._meta || {}), revision: 99, updatedAt: Date.now() + 100000, writerId: 'stale-device-107' };
      const lb = snapshot.boxes.find((b) => b.id === 'L1');
      const sb = lb && lb.children.find((c) => c.id === 'S1');
      return { snapshot, carriesDeletedBm: !!(sb && sb.bookmarks || []).find((b) => b.id === id) };
    }, bmId);
    expect(stale.carriesDeletedBm).toBe(true);

    await deleteBookmarkViaPopup(page, 'T107 bookmark');

    // In-memory post-condition: bookmark gone, tombstone written for its id.
    const afterDelete = await readBookmarks(page);
    expect(afterDelete.ids).not.toContain(bmId);
    expect(afterDelete.deleted).toContain(bmId);

    // Flush the write chain, then prove the tombstone is durable, not in-memory only.
    await page.evaluate(() => window.__boxingDebug.saveLayout());
    await expect.poll(async () => (await readPersisted(page)).deleted, { timeout: 5000 }).toContain(bmId);

    // The real cross-tab entry: a HIGHER-revision stale payload must be accepted (else the
    // assertion would pass vacuously) and must still not bring the bookmark back.
    const applied = await page.evaluate((snapshot) => window.__boxingDebug.applyExternalLayout(snapshot), stale.snapshot);
    expect(applied).toBe(true);

    const afterMerge = await readBookmarks(page);
    expect(afterMerge.ids).not.toContain(bmId);
    expect(afterMerge.deleted).toContain(bmId);

    // Reload: the tombstone survives persistence and the bookmark stays deleted.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await expect.poll(() => page.evaluate(() => Boolean(window.__boxingDebug))).toBe(true);
    const afterReload = await readBookmarks(page);
    expect(afterReload.ids).not.toContain(bmId);
    expect(afterReload.deleted).toContain(bmId);

    // Negative control (falsification): with the tombstone removed, the SAME stale payload
    // DOES resurrect the bookmark. This pins the tombstone as the load-bearing element —
    // the spec cannot pass by accident of the payload being inert.
    const control = await page.evaluate((snapshot) => {
      const dbg = window.__boxingDebug;
      dbg.layout._meta.deleted = {};
      const bumped = JSON.parse(JSON.stringify(snapshot));
      bumped._meta = { ...(bumped._meta || {}), revision: 999, updatedAt: Date.now() + 500000 };
      const appliedControl = dbg.applyExternalLayout(bumped);
      const lb = dbg.layout.boxes.find((b) => b.id === 'L1');
      const sb = lb && lb.children.find((c) => c.id === 'S1');
      return { appliedControl, ids: (sb && sb.bookmarks ? sb.bookmarks : []).map((b) => b.id) };
    }, stale.snapshot);
    expect(control.appliedControl).toBe(true);
    expect(control.ids).toContain(bmId);

    expect(pageErrors).toEqual([]);
  });

  test('AC1: mutationHandlers.deleteBookmark returns tombstoneIds:[bmId] and tombstones the id', async ({ page }) => {
    test.setTimeout(60_000);
    await seedAndBoot(page);
    const r = await page.evaluate(() => {
      const dbg = window.__boxingDebug;
      dbg.layout.boxes = [{
        id: 'L1', type: 'large', title: 'R', x: 0, y: 0, width: 320, height: 220,
        children: [{ id: 'S1', title: 's', x: 0, y: 0, width: 200, height: 150, bookmarks: [{ id: 'bm-107', title: 'x', url: 'https://t107.example.test/x' }] }],
      }];
      dbg.renderCanvas();
      const res = dbg.commit('deleteBookmark', { largeId: 'L1', smallId: 'S1', bmId: 'bm-107' }, {});
      const lb = dbg.layout.boxes.find((b) => b.id === 'L1');
      const sb = lb.children.find((c) => c.id === 'S1');
      return {
        tombstoneIds: res.tombstoneIds,
        skipped: !!res.skipped,
        remaining: sb.bookmarks.map((b) => b.id),
        deleted: Object.keys((dbg.layout._meta && dbg.layout._meta.deleted) || {}),
      };
    });
    expect(r.skipped).toBe(false);
    expect(r.tombstoneIds).toEqual(['bm-107']);
    expect(r.remaining).toEqual([]);
    expect(r.deleted).toContain('bm-107');
  });

  test('AC2 static: popups delete button routes through commit and no bare splice remains', async () => {
    const popups = fs.readFileSync(POPUPS_SRC, 'utf8');
    const render = fs.readFileSync(RENDER_SRC, 'utf8');
    expect(popups).toMatch(/commit\(\s*['"]deleteBookmark['"]/);
    expect(popups).not.toMatch(/bookmarks\.splice\(/);
    expect(render).toContain('deleteBookmark(state,');
    expect(render).toContain('tombstoneIds');
  });
});
