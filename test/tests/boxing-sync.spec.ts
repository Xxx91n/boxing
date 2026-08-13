import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;
const WEBDAV_URL = 'https://app.koofr.net/dav/Koofr/';
const WEBDAV_USER = 'jinxi2410@gmail.com';
const WEBDAV_PASS = 'kel988j8tv44f2v0';

// Inject handler that reads responses from window.__webdavHandlerState so the handler
// closure survives serialization. The init script copies cloudBody+putStatus+getStatus
// onto window, and the handler reads them — no external closure variables.
async function bootWithMockRuntime(page, heart) {
  await page.addInitScript((heartSrc) => {
    (window as any).__webdavCalls = [];
    const heart = eval(heartSrc);
    (window as any).chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          (window as any).__webdavCalls.push(msg);
          try { const resp = heart(msg); try { cb && cb(resp); } catch (_) {} }
          catch (e) { try { cb && cb({ success: false, error: String(e) }); } catch (_) {} }
        },
        getURL: (p) => p,
        lastError: null,
      },
    };
  }, `(${heart.toString()})`);
}

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

async function setSyncState(page, state) {
  await page.evaluate((s) => {
    const dbg = (window as any).__boxingDebug;
    if (s.lastSyncAt !== undefined) dbg.layout.settings.lastSyncAt = s.lastSyncAt;
    dbg.layout._meta = dbg.layout._meta || {};
    if (s.updatedAt !== undefined) dbg.layout._meta.updatedAt = s.updatedAt;
    if (s.revision !== undefined) dbg.layout._meta.revision = s.revision;
    if (s.writerId !== undefined) dbg.layout._meta.writerId = s.writerId;
  }, state);
}

function makeCloudData(count, titlePrefix, updatedAt, writerId) {
  return {
    version: '3.7.0',
    boxes: Array.from({ length: count }, (_, i) => ({ id: `cloud-${i}`, type: 'large', title: `${titlePrefix}${i}`, x: 100*i, y: 0, width: 320, height: 220, children: [] })),
    settings: {},
    _meta: { revision: count, updatedAt, writerId },
  };
}

test.describe('Boxing WebDAV sync (two-way)', () => {
  test('first-sync pulls cloud data over empty local when lastSyncAt===0', async ({ page }) => {
    const cloud = makeCloudData(5, 'Cloud Box ', Date.now() - 10000, 'other-client');
    // heart reads cloud body from this evaluated object literal (no closure ref).
    const heart = (msg) => {
      const cloudBody = '{"version":"3.7.0","boxes":[{"id":"cloud-0","type":"large","title":"Cloud Box 0","x":0,"y":0,"width":320,"height":220,"children":[]},{"id":"cloud-1","type":"large","title":"Cloud Box 1","x":100,"y":0,"width":320,"height":220,"children":[]},{"id":"cloud-2","type":"large","title":"Cloud Box 2","x":200,"y":0,"width":320,"height":220,"children":[]},{"id":"cloud-3","type":"large","title":"Cloud Box 3","x":300,"y":0,"width":320,"height":220,"children":[]},{"id":"cloud-4","type":"large","title":"Cloud Box 4","x":400,"y":0,"width":320,"height":220,"children":[]}],"settings":{},"_meta":{"revision":5,"updatedAt":' + (Date.now() - 10000) + ',"writerId":"other-client"}}';
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, body: cloudBody };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true, status: 200, ok: true };
    };
    await bootWithMockRuntime(page, heart);
    await resetBoxing(page);
    await page.evaluate((cfg) => (window as any).__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    // BX-FATAL-FIX: first-sync only pulls when local is empty — keep local empty here.
    await setSyncState(page, { lastSyncAt: 0, updatedAt: 0, revision: 0, writerId: 'this-tab' });
    const before = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    expect(before).toBe(0);
    const result = await page.evaluate(() => (window as any).__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('pull');
    expect(result.firstSync).toBe(true);
    const after = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    expect(after).toBe(5);
  });

  test('cloud newer than local pulls cloud (overrides local)', async ({ page }) => {
    const heart = (msg) => {
      const body = '{"version":"3.7.0","boxes":[{"id":"cloud-new","type":"large","title":"Cloud wins","x":0,"y":0,"width":320,"height":220,"children":[]}],"settings":{},"_meta":{"revision":10,"updatedAt":' + (Date.now() + 100000) + ',"writerId":"other-client"}}';
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, body };
      return { success: true, status: 200, ok: true };
    };
    await bootWithMockRuntime(page, heart);
    await resetBoxing(page);
    await page.evaluate((cfg) => (window as any).__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    await setSyncState(page, { lastSyncAt: Date.now() - 60000, updatedAt: Date.now() - 50000, revision: 1, writerId: 'this-tab' });
    const result = await page.evaluate(() => (window as any).__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('pull');
    const title = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0]?.title);
    expect(title).toBe('Cloud wins');
  });

  test('local newer than cloud pushes local to cloud', async ({ page }) => {
    const heart = (msg) => {
      const body = '{"version":"3.7.0","boxes":[{"id":"cloud-old","type":"large","title":"Old","x":0,"y":0,"width":320,"height":220,"children":[]}],"settings":{},"_meta":{"revision":1,"updatedAt":' + (Date.now() - 100000) + ',"writerId":"other-client"}}';
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, body };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true, status: 200, ok: true };
    };
    await bootWithMockRuntime(page, heart);
    await resetBoxing(page);
    await page.evaluate((cfg) => (window as any).__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    await setSyncState(page, { lastSyncAt: Date.now() - 60000, updatedAt: Date.now(), revision: 2, writerId: 'this-tab' });
    const result = await page.evaluate(() => (window as any).__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('push');
    const calls = await page.evaluate(() => (window as any).__webdavCalls?.map(c => c.type) || []);
    expect(calls).toContain('webdav-put');
  });

  test('cloud 404 pushes local (first upload)', async ({ page }) => {
    const heart = (msg) => {
      if (msg.type === 'webdav-get') return { success: true, status: 404, ok: false, body: null };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true, status: 200, ok: true };
    };
    await bootWithMockRuntime(page, heart);
    await resetBoxing(page);
    await page.evaluate((cfg) => (window as any).__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    await setSyncState(page, { lastSyncAt: Date.now() - 1000, updatedAt: Date.now(), revision: 1, writerId: 'this-tab' });
    const result = await page.evaluate(() => (window as any).__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('push');
    const calls = await page.evaluate(() => (window as any).__webdavCalls?.map(c => c.type) || []);
    expect(calls).toContain('webdav-put');
  });

  test('BX-FATAL-FIX: first-sync does NOT pull cloud over non-empty local (prevents refresh data loss)', async ({ page }) => {
    const heart = (msg) => {
      const body = '{"version":"3.7.0","boxes":[{"id":"cloud-old","type":"large","title":"Stale Cloud","x":0,"y":0,"width":320,"height":220,"children":[]}],"settings":{},"_meta":{"revision":1,"updatedAt":' + (Date.now() - 100000) + ',"writerId":"other-client"}}';
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, body };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true, status: 200, ok: true };
    };
    await bootWithMockRuntime(page, heart);
    await resetBoxing(page);
    await page.evaluate((cfg) => (window as any).__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    // User has local content before lastSyncAt is set (e.g. added boxes before configuring sync, or stale lastSyncAt after refresh).
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    await setSyncState(page, { lastSyncAt: 0, updatedAt: Date.now(), revision: 2, writerId: 'this-tab' });
    const before = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    expect(before).toBe(1);
    const result = await page.evaluate(() => (window as any).__boxingDebug.syncWebDAV());
    // Local is newer than stale cloud → must PUSH, not pull (fatal-fix prevents stale cloud overwrite).
    expect(result.direction).toBe('push');
    const afterTitle = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0]?.title);
    expect(afterTitle).not.toBe('Stale Cloud');
  });

  test('BX-DATALOSS-V2 tier 2: does NOT trigger on 1-2 intentional deletes (noise filter)', async ({ page }) => {
    const heart = (msg) => {
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, body: '{"version":"3.7.0","boxes":[],"settings":{},"_meta":{"revision":1,"updatedAt":1,"writerId":"other"}}' };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true, status: 200, ok: true };
    };
    await bootWithMockRuntime(page, heart);
    await resetBoxing(page);
    await page.evaluate((cfg) => (window as any).__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    await setSyncState(page, { lastSyncAt: Date.now() - 60000, updatedAt: Date.now(), revision: 5, writerId: 'this-tab' });
    await page.evaluate(() => { (window as any).__boxingDebug.layout.settings.lastKnownBoxCountBaseline = 10; (window as any).__boxingDebug.layout.boxes = Array.from({length:8},(_,i)=>({id:'b'+i,type:'large',title:'L'+i,x:0,y:0,width:320,height:220,children:[]})); });
    const result = await page.evaluate(() => (window as any).__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('push');
  });

  test('BX-DATALOSS-V2 tier 2: triggers on medium drop (>=3 lost) and restores from cloud', async ({ page }) => {
    const heart = (msg) => {
      const boxes = Array.from({length:9},(_,i)=>'{"id":"c'+i+'","type":"large","title":"Restored '+i+'","x":'+(i*100)+',"y":0,"width":320,"height":220,"children":[]}').join(',');
      const body = '{"version":"3.7.0","boxes":['+boxes+'],"settings":{},"_meta":{"revision":9,"updatedAt":'+(Date.now()+100000)+',"writerId":"other-client"}}';
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, body };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true, status: 200, ok: true };
    };
    await bootWithMockRuntime(page, heart);
    await resetBoxing(page);
    await page.evaluate((cfg) => (window as any).__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    await setSyncState(page, { lastSyncAt: Date.now() - 60000, updatedAt: Date.now() - 1000, revision: 2, writerId: 'this-tab' });
    await page.evaluate(() => { (window as any).__boxingDebug.layout.settings.lastKnownBoxCountBaseline = 9; (window as any).__boxingDebug.layout.boxes = Array.from({length:6},(_,i)=>({id:'b'+i,type:'large',title:'L'+i,x:0,y:0,width:320,height:220,children:[]})); });
    page.on('dialog', d => d.accept());
    const result = await page.evaluate(() => (window as any).__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('pull');
    expect(result.restoredAfterLoss).toBe(true);
    const after = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    expect(after).toBe(9);
  });

  test('data-loss guard blocks upload and offers restore when local drops >50%', async ({ page }) => {
    const heart = (msg) => {
      const boxes = Array.from({ length: 6 }, (_, i) => '{"id":"c-' + i + '","type":"large","title":"Restored ' + i + '","x":' + (100*i) + ',"y":0,"width":320,"height":220,"children":[]}').join(',');
      const body = '{"version":"3.7.0","boxes":[' + boxes + '],"settings":{},"_meta":{"revision":6,"updatedAt":' + (Date.now() + 100000) + ',"writerId":"other-client"}}';
      if (msg.type === 'webdav-get') return { success: true, status: 200, ok: true, body };
      if (msg.type === 'webdav-put') return { success: true, status: 201, ok: true };
      return { success: true, status: 200, ok: true };
    };
    await bootWithMockRuntime(page, heart);
    await resetBoxing(page);
    await page.evaluate((cfg) => (window as any).__boxingDebug.setWebDAVConfig(cfg.url, cfg.user, cfg.pass), { url: WEBDAV_URL, user: WEBDAV_USER, pass: WEBDAV_PASS });
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    await setSyncState(page, { lastSyncAt: Date.now() - 60000, updatedAt: Date.now() - 1000, revision: 2, writerId: 'this-tab' });
    await page.evaluate(() => { (window as any).__boxingDebug.layout.settings.lastKnownBoxCountBaseline = 10; });
    page.on('dialog', d => d.accept());
    const result = await page.evaluate(() => (window as any).__boxingDebug.syncWebDAV());
    expect(result.direction).toBe('pull');
    expect(result.restoredAfterLoss).toBe(true);
    const after = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    expect(after).toBe(6);
  });
});
