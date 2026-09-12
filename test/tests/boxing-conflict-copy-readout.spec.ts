// Boxing — ticket 79 (spec Wave8 A-029): conflict-copy readout in the settings data tab.
// AC coverage:
//   AC1 list visible: the data tab shows one row per archived conflict copy
//       (ts / reason / side / size) with a per-row Export button — UI non-empty when
//       copies exist (handoff 专属验收), hidden when none.
//   AC2 single-entry export works: clicking Export downloads boxing-conflict-<ts>.json
//       whose JSON carries the verbatim archived entry (ts / reason / side / raw.boxes).
//   AC3 archive write semantics untouched: rendering + export never mutate
//       boxingLayout.conflict.index / boxingLayout.conflict.* bodies (read-only readout).
// file:// mock lane per t50/t51 harness discipline: mutations go through the t41R seam
// (__boxingDebug.storageSet / saveSnapshot / layout), never window.chrome.storage; the
// export capture patches URL.createObjectURL + HTMLAnchorElement.click (t51 precedent).
import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

// Seed one archived conflict copy via the storage seam, mirroring the entry shape
// archiveConflictLayouts writes: boxingLayout.conflict.<ts> body + conflict.index row.
// (layoutStorage maps non-main keys through the 'bxstore:' localStorage prefix in the
// file:// mock lane; index rows are {ts, reason, side, size, boxes} — no raw field.)
const CONFLICT_TS = 1726100000000;
function seedConflictCopy(title) {
  return {
    body: {
      ts: CONFLICT_TS, reason: 'import-merge', side: 'incoming',
      raw: { boxes: [{ id: 'L9', type: 'large', title, x: 10, y: 10, width: 320, height: 220, nextSmallIndex: 1, children: [] }] },
      size: 200, boxes: 1,
    },
    index: [{ ts: CONFLICT_TS, reason: 'import-merge', side: 'incoming', size: 200, boxes: 1 }],
  };
}

async function bootFresh(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__boxingDebug?.saveLayout
      && (window as any).__boxingDebug?.storageSet
      && (window as any).__boxingDebug?.storageGet)), { timeout: 10000 }).toBe(true);
}

const openSettingsDataTab = async (page) => {
  await page.evaluate(() => { document.querySelector('#settings-btn')?.click(); });
  await page.evaluate(() => { document.querySelector<HTMLElement>('.settings-nav__item[data-tab="data"]')?.click(); });
};
const conflictRows = (page) => page.locator('#data-conflict-list .data-conflict-row-item');

async function seedViaStorage(page, seed) {
  await page.evaluate(({ body, index }) => {
    const dbg = (window as any).__boxingDebug;
    return Promise.all([
      dbg.storageSet({ ['boxingLayout.conflict.' + body.ts]: body }),
      dbg.storageSet({ 'boxingLayout.conflict.index': index }),
    ]);
  }, seed);
}

// t51 precedent: capture blob text + anchor download name without a real download.
async function armExportCapture(page) {
  await page.evaluate(() => {
    (window as any).__cap = { text: null, name: null };
    const origUrl = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => {
      (blob as Blob).text().then((t) => { (window as any).__cap.text = t; });
      return origUrl.call(URL, blob);
    };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download) (window as any).__cap.name = this.download;
      return origClick.apply(this, arguments as any);
    };
  });
}

test.describe('Ticket 79 — conflict-copy readout (list + single export)', () => {

  test('AC1: data tab lists conflict copies (ts/reason/side/size + Export) when copies exist', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedViaStorage(page, seedConflictCopy('Conflicted Side'));

    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1);
    const row = conflictRows(page).first();
    const rowText = (await row.textContent()) || '';
    expect(rowText).toContain('import-merge');                       // reason shown
    expect(rowText).toContain('incoming');                           // side shown
    expect(/\d+(\.\d+)?\s?(B|KB)/.test(rowText)).toBeTruthy();       // size shown
    await expect(row.locator('.data-conflict-export-btn')).toBeVisible(); // per-row Export
  });

  test('AC1-neg: list stays hidden when no conflict copies exist', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await openSettingsDataTab(page);
    await expect.poll(() => page.evaluate(() =>
      document.getElementById('data-conflict-list-wrap')?.hidden), { timeout: 3000 }).toBe(true);
    await expect(conflictRows(page)).toHaveCount(0);
  });

  test('AC2: per-row Export downloads boxing-conflict-<ts>.json with the verbatim entry', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedViaStorage(page, seedConflictCopy('Conflicted Side'));
    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1);

    await armExportCapture(page);
    await page.evaluate(() => {
      const btn = document.querySelector('#data-conflict-list .data-conflict-row-item .data-conflict-export-btn');
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__cap?.text)), { timeout: 8000 }).toBe(true);
    const cap = await page.evaluate(() => ({ text: (window as any).__cap.text, name: (window as any).__cap.name }));

    expect(cap.name).toBe('boxing-conflict-' + CONFLICT_TS + '.json');
    const entry = JSON.parse(cap.text);
    expect(entry.ts).toBe(CONFLICT_TS);
    expect(entry.reason).toBe('import-merge');
    expect(entry.side).toBe('incoming');
    expect(entry.raw?.boxes?.[0]?.title).toBe('Conflicted Side');    // verbatim payload survives
  });

  test('AC3: readout + export never mutate the conflict index or bodies', async ({ page }) => {
    test.setTimeout(40000);
    await bootFresh(page);
    await seedViaStorage(page, seedConflictCopy('Conflicted Side'));
    await openSettingsDataTab(page);
    await expect(conflictRows(page)).toHaveCount(1);

    await armExportCapture(page);
    await page.evaluate(() => {
      const btn = document.querySelector('#data-conflict-list .data-conflict-row-item .data-conflict-export-btn');
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__cap?.text)), { timeout: 8000 }).toBe(true);

    const after = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const idx = await dbg.storageGet('boxingLayout.conflict.index');
      const body = await dbg.storageGet('boxingLayout.conflict.' + (1726100000000));
      return {
        index: idx && idx['boxingLayout.conflict.index'],
        body: body && body['boxingLayout.conflict.' + (1726100000000)],
      };
    });
    expect(Array.isArray(after.index)).toBe(true);
    expect(after.index.length).toBe(1);                              // no rows added/removed
    expect(after.index[0].ts).toBe(CONFLICT_TS);
    expect(after.index[0].reason).toBe('import-merge');
    expect(after.body?.raw?.boxes?.[0]?.title).toBe('Conflicted Side'); // body unchanged
  });

});
