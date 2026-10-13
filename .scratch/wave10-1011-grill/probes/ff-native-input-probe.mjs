// Round-3 §1.1-1 probe: playwright#16095-class native input stall on the
// firefox lane — headed vs headless, mouse.move drag-seq + dblclick + locator ops.
// Standalone (does not touch spec files). Mirrors playwright.config.ts
// firefox project: browserName firefox, args ['-no-remote'], persistent ctx.
// Dismisses onboarding like specs do (__boxingDebug.skipOnboarding) so native
// events land on the canvas, not the tour overlay.
// Each op wrapped in a hard Promise.race timeout; each op repeated ROUNDS times
// per mode to expose the racy stall pattern.
import { firefox } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs';

const NTP_URL = pathToFileURL(path.resolve('ntp', 'index.html')).href;
const OP_TIMEOUT = 15000;
const ROUNDS = 3;

const withTimeout = (p) => Promise.race([
  p.then(() => 'OK'),
  new Promise(res => setTimeout(() => res(`STALL>${OP_TIMEOUT}ms`), OP_TIMEOUT)),
]);

async function probe(headless) {
  const mode = headless ? 'headless' : 'headed';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-probe-'));
  let ctx;
  try {
    ctx = await firefox.launchPersistentContext(tmp, {
      headless,
      args: ['-no-remote'],
      timeout: 30000,
    });
  } catch (e) {
    console.log(`[${mode}] launch FAIL: ${e.message.split('\n')[0]}`);
    return;
  }
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    // wait for app + dismiss onboarding (same seam specs use)
    await page.waitForFunction(() => Boolean(window.__boxingDebug), null, { timeout: 10000 }).catch(() => console.log(`[${mode}] WARN __boxingDebug never appeared`));
    await page.evaluate(() => { try { window.__boxingDebug?.skipOnboarding?.(); } catch (_) { } });
    await page.waitForTimeout(500);
    const rect = await page.locator('#canvas').boundingBox().catch(() => null);
    const cx = rect ? rect.x + rect.width / 2 : 400;
    const cy = rect ? rect.y + rect.height / 2 : 300;
    const hit = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? el.tagName + '.' + String(el.className).slice(0, 50) : 'null'; }, { x: cx, y: cy }).catch(() => 'eval-fail');
    console.log(`[${mode}] hitTarget@canvas-center: ${hit}`);

    for (let r = 0; r < ROUNDS; r++) {
      const ops = {};
      ops['move'] = await withTimeout(page.mouse.move(cx, cy));
      ops['drag-seq'] = await withTimeout((async () => {
        await page.mouse.move(cx - 40, cy);
        await page.mouse.down();
        for (let i = 0; i < 5; i++) await page.mouse.move(cx - 40 + i * 20, cy);
        await page.mouse.up();
      })());
      ops['mouse.dblclick'] = await withTimeout(page.mouse.dblclick(cx, cy));
      ops['locator.click'] = await withTimeout(page.locator('#canvas').click({ position: { x: 10, y: 10 }, timeout: 10000 }).catch(e => 'ERR:' + e.message.split('\n')[0]));
      ops['locator.dblclick'] = await withTimeout(page.locator('#canvas').dblclick({ position: { x: 20, y: 20 }, timeout: 10000 }).catch(e => 'ERR:' + e.message.split('\n')[0]));
      console.log(`[${mode}] round${r + 1}: ` + Object.entries(ops).map(([k, v]) => `${k}=${v}`).join(' '));
    }
  } catch (e) {
    console.log(`[${mode}] FATAL: ${e.message.split('\n')[0]}`);
  } finally {
    try { await ctx.close(); } catch (_) { /* best-effort close */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const mode = process.argv[2] || 'both';
if (mode === 'both' || mode === 'headed') await probe(false);
if (mode === 'both' || mode === 'headless') await probe(true);
process.exit(0);
