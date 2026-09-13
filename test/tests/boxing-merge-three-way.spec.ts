// Boxing — ticket 91 (Wave9 A-045 / B55): child-box/id-level three-way WebDAV merge.
// AC coverage (issues/91-merge-three-way-b55.md):
//   AC1 子盒/id 级合并落地 + e2e 双端加子盒 → pull → 双方可见:
//       both ends add a DIFFERENT small box under the SAME large box, then sync →
//       direction 'merge', conflicts 0, BOTH children visible (the B55 silent-swallow
//       is gone), merged state rolls the syncBase slot + _meta.baseRevision forward.
//   AC2 冲突副本 UI (票 79) 接线: same-id child divergence archives a parent-wrapped
//       'webdav-child-conflict' copy AND the Settings > Data conflict list renders it
//       (the ticket-79 readout is reason-agnostic; this proves the new reason wires in).
//   AC3 baseRevision/等价 three-way semantics: with a syncBase record, a pure local
//       box-deletion is honored (no ghost resurrection), one-sided child edits
//       auto-merge without a conflict copy, and new ids from either side survive.
//   AC4 no-base degradation = additive two-way (never worse than ticket-44 baseline):
//       exercised by AC1 (fresh device, no syncBase yet). The legacy field-conflict
//       contract stays pinned by boxing-import-merge.spec.ts AC-sync.
// file:// mock lane per t44/t79 harness discipline: seed BEFORE first goto via
// addInitScript (no reload race), WebDAV GET/PUT answered by a runtime.sendMessage
// stub, sync driven through window.__boxingDebug.syncWebDAV(). The mock never pollutes
// self.chrome beyond the local object (SEC-01).
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;
const WEBDAV_URL = 'https://app.koofr.net/dav/Koofr/';
const WEBDAV_USER = 'jinxi2410@gmail.com';
const WEBDAV_PASS = 'kel988j8tv44f2v0';

const S = (id, title) => ({ id, title, x: 0, y: 0, width: 240, height: 180, pinned: true, bookmarks: [{ id: 'b-' + id, title, url: 'https://t91.test/' + id }] });

// One large box L1 with the given children, everything else fixed so only the
// children array (and chosen scalar fields) differ across the three fixtures.
const L1 = (children, extra = {}) => ({ id: 'L1', type: 'large', title: 'Root', x: 0, y: 0, width: 320, height: 220, nextSmallIndex: 9, children, ...extra });

const layoutOf = (box) => ({
  version: 3.5, schemaVersion: 1, nextLargeIndex: 2,
  boxes: [box], connections: [], groups: [],
  settings: { selectedLanguage: 'en', lastSyncAt: 0 },
  _meta: { revision: 3, updatedAt: Date.now() - 5000, writerId: 'spec-writer' },
});

// Cloud payload: newer than local (updatedAt + offset) and from another writer, so
// the concurrent-change gate fires regardless of wall-clock rounding.
const cloudJson = (box, revision = 9) => ({
  version: 3.5, schemaVersion: 1, nextLargeIndex: 2,
  boxes: [box], connections: [], groups: [],
  settings: {},
  _meta: { revision, updatedAt: Date.now() + 100000, writerId: 'other-client' },
});

async function boot(page, cloudBody, localLayout) {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.addInitScript((c) => {
    window.__t91cloud = c;
    window.chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          try {
            if (msg && msg.type === 'webdav-get') {
              cb && cb(window.__t91cloud ? { success: true, status: 200, ok: true, body: JSON.stringify(window.__t91cloud) } : { success: true, status: 404, ok: false, body: null });
              return;
            }
            cb && cb({ success: true, status: 200, ok: true });
          } catch (e) { cb && cb({ success: false, error: String(e) }); }
        },
        getURL: (p) => p,
        lastError: null,
      },
    };
  }, cloudBody);
  await page.addInitScript((l) => { localStorage.setItem('boxingLayout', JSON.stringify(l)); }, localLayout);
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.__boxingDebug))).toBe(true);
  return pageErrors;
}

// Open the concurrent-change window: both sides newer than lastSyncAt, foreign writer.
async function forceConcurrent(page) {
  await page.evaluate((cfg) => window.__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
  await page.evaluate(() => {
    const dbg = window.__boxingDebug;
    dbg.layout.settings.lastSyncAt = Date.now() - 60000;
    dbg.layout._meta.updatedAt = Date.now() - 1000;
    dbg.layout._meta.writerId = 'this-tab';
  });
  return page.evaluate(() => window.__boxingDebug.syncWebDAV());
}

const childIds = (page) => page.evaluate(() => window.__boxingDebug.layout.boxes.find((b) => b.id === 'L1').children.map((c) => c.id));
const childTitles = (page) => page.evaluate(() => window.__boxingDebug.layout.boxes.find((b) => b.id === 'L1').children.map((c) => c.title));
const conflictIndex = (page) => page.evaluate(async () => (await window.__boxingDebug.storageGet(['boxingLayout.conflict.index']))['boxingLayout.conflict.index'] || []);
const readKey = (page, key) => page.evaluate(async (k) => (await window.__boxingDebug.storageGet([k]))[k], key);

test.describe('Ticket 91 — B55 child-box/id-level three-way WebDAV merge', () => {
  test('AC1: dual-end small-box adds under the same large box both survive a merge (no base → additive two-way)', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = await boot(
      page,
      cloudJson(L1([S('S1', 'kept'), S('S2c', 'cloud add')])),
      layoutOf(L1([S('S1', 'kept'), S('S2l', 'local add')]))
    );
    const result = await forceConcurrent(page);
    expect(result.direction).toBe('merge');
    expect(result.conflicts).toBe(0);

    // BOTH sides' new small boxes are visible — the core B55 acceptance.
    const ids = await childIds(page);
    expect(ids).toContain('S1');
    expect(ids).toContain('S2l');
    expect(ids).toContain('S2c');

    // Persisted main key agrees with the canvas (pull landed merged state, not a clobber).
    const stored = await readKey(page, 'boxingLayout');
    expect(stored.boxes[0].children.map((c) => c.id)).toContain('S2c');

    // baseRevision/等价 anchor: syncBase slot rolls to the merged agreement and the
    // payload stamps the cloud revision the merge diffed against.
    const base = await readKey(page, 'boxingLayout.syncBase');
    expect(Array.isArray(base.boxes)).toBe(true);
    expect(base.boxes[0].children.length).toBe(3);
    expect(stored._meta.baseRevision).toBe(9);

    // Zero-loss path: no conflict copies were needed for non-overlapping adds.
    expect(await conflictIndex(page)).toHaveLength(0);
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC2: same-id child divergence → child-level conflict copy wired into the ticket-79 readout', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = await boot(
      page,
      cloudJson(L1([S('S1', 'cloud v')])),
      layoutOf(L1([S('S1', 'local v')]))
    );
    const result = await forceConcurrent(page);
    expect(result.direction).toBe('merge');
    expect(result.conflicts).toBe(1);

    // Local content survives on the canvas; the cloud child was archived, not applied.
    expect(await childTitles(page)).toContain('local v');
    const idx = await conflictIndex(page);
    expect(idx.length).toBeGreaterThanOrEqual(1);
    const row = idx[idx.length - 1];
    expect(row.reason).toBe('webdav-child-conflict');
    expect(row.side).toBe('cloud');
    expect(row.boxes).toBe(1);
    const body = await readKey(page, 'boxingLayout.conflict.' + row.ts);
    expect(JSON.stringify(body)).toContain('cloud v');

    // 票 79 接线: the Settings > Data conflict list renders this new reason verbatim.
    await page.evaluate(() => { document.querySelector('#settings-btn')?.click(); });
    await page.evaluate(() => { document.querySelector('.settings-nav__item[data-tab="data"]')?.click(); });
    await expect.poll(() => page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#data-conflict-list .data-conflict-row-item'));
      return rows.map((r) => r.textContent || '').join('\n');
    }), { timeout: 5000 }).toContain('webdav-child-conflict');
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC3: with syncBase, deletion honored + one-sided edits auto-merge, adds never swallowed', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const baseBox = L1([S('S1', 'a'), S('S2', 'b')]);
    const pageErrors = await boot(
      page,
      // cloud: kept S2 untouched, added Sc (and a second large box L2 unchanged vs base)
      cloudJson(baseBox),
      // local: edited S1, dropped S2, added Sl; also carries an L2 the base has
      (() => { const l = layoutOf(L1([S('S1', 'local edited'), S('Sl', 'local add')])); return l; })()
    );
    // Seed the three-way record: base == cloud children-wise (S1 'a', S2 'b').
    await page.evaluate((b) => window.__boxingDebug.storageSet({ 'boxingLayout.syncBase': b }), { version: 3.5, schemaVersion: 1, nextLargeIndex: 2, boxes: [baseBox], connections: [], groups: [], settings: {}, _meta: { revision: 5, updatedAt: Date.now() - 70000, writerId: 'origin' } });
    const result = await forceConcurrent(page);
    expect(result.direction).toBe('merge');
    expect(result.conflicts).toBe(0);

    // S1: only local moved vs base → local edit wins silently (no conflict copy).
    // Sl: local addition survives. S2: local PURE deletion, cloud untouched → honored.
    const ids = await childIds(page);
    expect(ids).toContain('Sl');
    expect(ids).not.toContain('S2');
    expect(await childTitles(page)).toContain('local edited');
    expect(await conflictIndex(page)).toHaveLength(0);
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('AC3b: cloud-side child survives a local deletion when the cloud edited it (delete-vs-edit keeps content)', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const baseBox = L1([S('S1', 'a'), S('S2', 'b')]);
    // cloud edited S2 after the base; local deleted S2 entirely.
    const pageErrors = await boot(
      page,
      cloudJson(L1([S('S1', 'a'), S('S2', 'cloud edited')])),
      layoutOf(L1([S('S1', 'a')]))
    );
    await page.evaluate((b) => window.__boxingDebug.storageSet({ 'boxingLayout.syncBase': b }), { version: 3.5, schemaVersion: 1, nextLargeIndex: 2, boxes: [baseBox], connections: [], groups: [], settings: {}, _meta: { revision: 5, updatedAt: Date.now() - 70000, writerId: 'origin' } });
    const result = await forceConcurrent(page);
    expect(result.direction).toBe('merge');
    // delete-vs-edit: content kept, NOT a silent swallow and NOT a conflict copy
    expect(result.conflicts).toBe(0);
    expect(await childTitles(page)).toContain('cloud edited');
    expect(pageErrors).toEqual([]);
    await context.close();
  });
});
