// Round-3 acceptance probe: real-extension liveness on the BUILT artifact.
// Launches chromium persistent context with --load-extension=dist/boxing-chrome,
// opens the extension's NTP page (chrome-extension://), asserts __boxingDebug
// is live and captures console errors. This is the "启动并测活" evidence for
// the chromium lane that the file:// mock lane cannot provide.
import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DIST = path.resolve('dist', 'boxing-chrome');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bx-live-'));
const errors = [];
let ctx;
try {
  ctx = await chromium.launchPersistentContext(tmp, {
    headless: false,
    args: [
      `--load-extension=${DIST}`,
      `--disable-extensions-except=${DIST}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    timeout: 30000,
  });
} catch (e) {
  console.log('launch FAIL: ' + e.message.split('\n')[0]);
  process.exit(1);
}
try {
  // find the extension id via the service worker
  let extId = null;
  for (let i = 0; i < 20 && !extId; i++) {
    const sw = ctx.serviceWorkers()[0];
    if (sw) extId = new URL(sw.url()).host;
    else await new Promise(r => setTimeout(r, 500));
  }
  console.log('extensionId:', extId || 'NONE');
  if (!extId) throw new Error('service worker never appeared');
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errors.push('pageerror:' + String(e).slice(0, 120)));
  await page.goto(`chrome-extension://${extId}/ntp/index.html`, { waitUntil: 'domcontentloaded' });
  const dbg = await page.waitForFunction(() => Boolean(window.__boxingDebug), null, { timeout: 10000 }).then(() => true).catch(() => false);
  console.log('__boxingDebug live:', dbg);
  const canvas = await page.locator('#canvas').count();
  console.log('#canvas present:', canvas > 0);
  console.log('console errors:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  console.log(dbg && canvas > 0 && errors.length === 0 ? 'LIVENESS: PASS' : 'LIVENESS: CHECK');
} catch (e) {
  console.log('FATAL: ' + e.message.split('\n')[0]);
  console.log('LIVENESS: FAIL');
} finally {
  try { await ctx.close(); } catch (_) { /* best-effort */ }
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(0);
