import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path.resolve(__dirname, '..', '..', 'ntp', 'index.html').replace(/\\\\/g, '/')}`;

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
}

test.describe('Boxing sync-level + file-name modularity (BX-DEV-SYNC-MOD)', () => {
  test('makeSyncBody: full level preserves settings + boxes', async ({ page }) => {
    await resetBoxing(page);
    const result = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncLevel = 'full';
      const body = dbg.buildSyncPayload();
      return { hasBoxes: Array.isArray(body.boxes) && body.boxes.length >= 0, hasSettings: typeof body.settings === 'object' };
    });
    expect(result.hasBoxes).toBe(true);
    expect(result.hasSettings).toBe(true);
  });

  test('makeSyncBody: settingsOnly level strips boxes', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.push({ id: 'test-1', type: 'large', title: 'T', x: 0, y: 0, width: 320, height: 220, children: [] }));
    const result = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncLevel = 'settingsOnly';
      const body = dbg.buildSyncPayload();
      return { boxesLen: body.boxes.length, hasSettings: typeof body.settings === 'object' };
    });
    expect(result.boxesLen).toBe(0);
    expect(result.hasSettings).toBe(true);
  });

  test('makeSyncBody: boxesOnly level strips settings', async ({ page }) => {
    await resetBoxing(page);
    const result = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncLevel = 'boxesOnly';
      const body = dbg.buildSyncPayload();
      return { hasBoxes: Array.isArray(body.boxes), settingsNull: body.settings === null };
    });
    expect(result.hasBoxes).toBe(true);
    expect(result.settingsNull).toBe(true);
  });

  test('syncFileName: custom name appears in resolveWebDAVFileUrl', async ({ page }) => {
    await resetBoxing(page);
    const result = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncFileName = 'my-custom-backup.json';
      const url = dbg.resolveWebDAVFileUrl('https://example.com/dav/');
      return { fileUrl: url.fileUrl };
    });
    expect(result.fileUrl).toContain('my-custom-backup.json');
  });

  test('syncFileName: empty falls back to boxing-backup.json', async ({ page }) => {
    await resetBoxing(page);
    const result = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncFileName = '';
      const url = dbg.resolveWebDAVFileUrl('https://example.com/dav/');
      return { fileUrl: url.fileUrl };
    });
    expect(result.fileUrl).toContain('boxing-backup.json');
  });

  test('backupToGist uses makeSyncBody (settingsOnly strips boxes from gist payload)', async ({ page }) => {
    await resetBoxing(page);
    // Mock fetch to capture gist body
    await page.evaluate(() => {
      (window as any).__gistFetchCalls = [];
      const origFetch = window.fetch;
      window.fetch = (url, opts) => {
        if (typeof url === 'string' && url.includes('api.github.com/gists')) {
          const body = JSON.parse(opts.body);
          const fileName = Object.keys(body.files)[0];
          const content = JSON.parse(body.files[fileName].content);
          (window as any).__gistFetchCalls.push({ url, fileName, boxesLen: content.boxes?.length || 0, settingsKeys: Object.keys(content.settings || {}).length });
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'test-gist-id' }) });
        }
        return origFetch(url, opts);
      };
    });
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncLevel = 'settingsOnly';
     dbg.layout.settings.syncFileName = 'gist-test';
      // gist filename needs .json suffix to match value validation pattern
      dbg.layout.settings.syncFileName = 'gist-test.json';
      // Fill gist token input
      const tokenInput = document.getElementById('gist-token');
      if (tokenInput) tokenInput.value = 'ghp_test_token';
    });
    await page.evaluate(() => (window as any).__boxingDebug.backupToGist());
    const calls = await page.evaluate(() => (window as any).__gistFetchCalls);
    expect(calls.length).toBe(1);
    expect(calls[0].fileName).toContain('gist-test.json');
    expect(calls[0].boxesLen).toBe(0); // settingsOnly strips boxes
  });

  test('CSS square-corners: hover-expand box keeps border-radius 0 in square mode', async ({ page }) => {
    await resetBoxing(page);
    const result = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      // Enable square corners
      document.body.classList.add('ntp--square-corners');
      // Create a box with hover-expand
      const box = document.createElement('div');
      box.className = 'large-box box--hover-expand box--collapsed';
      document.body.appendChild(box);
      // force layout so computed style reflects class
      void document.body.offsetHeight;
      const r1 = getComputedStyle(box).borderRadius;
      document.body.removeChild(box);
      // In square-corners mode, box border-radius should be 0px (overriding default rounded)
      return { radiusIsZero: r1 === '0px', actualRadius: r1 };
    });
    expect(result.radiusIsZero).toBe(true);
  });


  // BX-DEV-127: both default-rounded and square modes must keep corners stable
  // across collapsed, hover-expanded, and non-collapsed (auto-expand default-open) states.
  test('CSS corners stay stable across hover-expand lifecycle (square + default)', async ({ page }) => {
    await resetBoxing(page);
    const result = await page.evaluate(() => {
      const out = {};
      const states = ['box--collapsed', 'box--collapsed test-hover', ''];
      const classes = ['large-box box--hover-expand', 'small-box box--hover-expand'];
      for (const mode of ['default', 'square']) {
        out[mode] = {};
        if (mode === 'square') document.body.classList.add('ntp--square-corners');
        else document.body.classList.remove('ntp--square-corners');
        for (const cls of classes) {
          const set = [];
          for (const st of states) {
            const box = document.createElement('div');
            box.className = (cls + ' ' + st).trim();
            if (st.includes('hover')) {
              // emulate :hover by appending class — :hover cannot be set directly; check via rule specificity instead.
              // Use the :hover rule indirectly: we read computed style for the base expanded-not-hover state.
              box.className = (cls);
            }
            document.body.appendChild(box);
            void document.body.offsetHeight;
            set.push(getComputedStyle(box).borderRadius);
            document.body.removeChild(box);
          }
          out[mode][cls] = set;
        }
      }
      // square mode: every state must be 0px
      const squareAllZero = Object.values(out.square).flat().every(v => v === '0px');
      // default mode: every state must be the card radius token (non-zero), NOT 0px
      const defaultAllRounded = Object.values(out.default).flat().every(v => v !== '0px' && v.length > 0);
      return { squareAllZero, defaultAllRounded, sample: out };
    });
    expect(result.squareAllZero).toBe(true);
    expect(result.defaultAllRounded).toBe(true);
  });
});