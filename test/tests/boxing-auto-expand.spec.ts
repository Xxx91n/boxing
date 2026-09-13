import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const NTP_PATH = 'ntp/index.html';

// 89 (R3 deflake). The file:// lane renders the first-run onboarding overlay on
// fresh storage: #onboarding-overlay carries .modal-overlay, which is
// position:fixed; inset:0; z-index:100 with aria-modal="true" — it is NOT inert.
// It wins the hit test, so a real page.hover lands on the overlay and the box
// never enters CSS :hover; the collapsed clamp (max-height:60px) then survives
// the whole poll. That is exactly the ubuntu-only signature from the G-A
// definitive run 34749813393 ("Expected > 80 / Received 60" at line 44), which a
// local A/B/A probe reproduced deterministically by forcing the overlay visible
// (hidden -> h=105; visible -> h=60, elementFromPoint = #onboarding-overlay).
// The previous dismissal was fire-and-forget (optional-chained, issued before
// __boxingDebug was awaited) with no post-condition, so a late initOnboarding()
// could strand the overlay. Dismiss until it is provably hidden.
async function dismissOnboarding(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const dbg = (window as any).__boxingDebug;
    if (typeof dbg?.skipOnboarding === 'function') dbg.skipOnboarding();
    const ov = document.getElementById('onboarding-overlay') as HTMLElement | null;
    return !ov || ov.hidden === true;
  }), {
    timeout: 8000,
    message: 'first-run onboarding overlay must be dismissed before real pointer input',
  }).toBe(true);
}

// init() shows the first-run overlay near its END (initOnboarding, ntp.js:1160)
// and is itself delayed by an i18n fetch that fails over file://. Dismissing
// before init() finishes is therefore NOT permanent: loadLayout() (ntp.js:920)
// replaces layout.settings and reverts onboardingCompleted, after which
// initOnboarding() re-shows the overlay and the hover is intercepted. Waiting for
// init()'s own completion marker first makes the dismissal stick. The marker is a
// debug() entry, so the page is loaded with ?debug=1 to raise the level before
// init() runs; setLogLevel is kept as a belt-and-braces for late attachment.
async function waitForInitComplete(page: Page) {
  await page.evaluate(() => { try { (window as any).__boxingDebug?.setLogLevel?.(4); } catch (_) {} });
  await expect.poll(() => page.evaluate(() => {
    const ring = (window as any).__boxingDebug?.getLogRing?.() || [];
    return ring.some((e: any) => typeof e?.text === 'string' && e.text.indexOf('init complete') !== -1);
  }), {
    timeout: 15000,
    message: 'ntp init() must finish before the overlay can be dismissed permanently',
  }).toBe(true);
}

// The hover is performed OUTSIDE expect.poll: a page action inside the poll
// callback turns every poll round into a full input round trip, which is slow
// enough in the headed firefox lane to exhaust the test budget (measured: the
// historical inline hover passed 3/3 locally, hover-inside-poll timed out).
// Bounded to two attempts — attempt 0 mirrors that historical single hover;
// attempt 1 only runs when the input was actually dropped.
//
// Deliberate changes vs the historical inline hover, all from the ticket-89
// research (Playwright actionability / addLocatorHandler / no-networkidle):
//   - the pointer is hit-tested BEFORE the move and the blocker is named. The
//     historical { force: true } bypassed Playwright's Receives-Events check,
//     which is exactly how a full-screen onboarding overlay could silently pin
//     the box at the collapsed clamp instead of reporting an intercepted pointer.
//   - force:true is RETAINED, because firefox headed native input stalls without
//     it in this repo (tickets 01/13, playwright#16095; re-measured here: dropping
//     force timed out page.hover 3/3 on the firefox lane). The industrial advice
//     to avoid force assumes actionability is affordable — where it is not, the
//     explicit hit-test guard above is what restores the Receives-Events signal
//     that force bypasses.
async function hoverUntilExpanded(page: Page, selector: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Cheap, non-polling, idempotent re-hide before the hit test: the boot
    // dismissal is verified, but re-asserting it here keeps the precondition true
    // even if the overlay is shown again between boot and the hover. Polling is
    // deliberately avoided — a page action inside a poll loop is what made an
    // earlier revision exhaust the test budget.
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      if (typeof dbg?.skipOnboarding === 'function') dbg.skipOnboarding();
    });

    await expect(async () => {
      const blocker = await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return 'target element absent';
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(30, r.height / 2)) as HTMLElement | null;
        if (hit && (hit === el || el.contains(hit))) return null;
        return 'pointer intercepted by ' + (hit ? hit.tagName + '#' + (hit.id || '') + '.' + String(hit.className || '') : 'null');
      }, selector);
      if (blocker) throw new Error(blocker);
    }, { timeout: 5000, intervals: [100, 250, 500] }).toPass();

    await page.hover(selector, { force: true, timeout: 12000 });
    try {
      await expect.poll(() => page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        return el?.getBoundingClientRect().height || 0;
      }, selector), { timeout: 6000, intervals: [100, 250, 500] }).toBeGreaterThan(80);
      return;
    } catch (err) {
      if (attempt === 1) {
        const diag = await page.evaluate((sel) => {
          const ov = document.getElementById('onboarding-overlay') as HTMLElement | null;
          const el = document.querySelector(sel) as HTMLElement | null;
          const r = el?.getBoundingClientRect();
          const cx = r ? Math.round(r.left + r.width / 2) : -1;
          const cy = r ? Math.round(r.top + r.height / 2) : -1;
          const hit = r ? (document.elementFromPoint(cx, cy) as HTMLElement | null) : null;
          return {
            overlayHidden: ov ? ov.hidden : 'absent',
            height: r ? Math.round(r.height) : null,
            expandVar: el?.style.getPropertyValue('--expand-height') || '',
            hitTest: hit ? hit.tagName + '#' + (hit.id || '') + '.' + String(hit.className || '') : null,
          };
        }, selector);
        throw new Error('hover did not expand ' + selector + ' after 2 attempts — '
          + JSON.stringify(diag) + ' (cause: ' + String(err).split('\n')[0] + ')');
      }
    }
  }
}

test.describe('Auto-expand box survives enter+exit (BX-EXP-REGR)', () => {
  test('large box with collapseHover=true still expands after visiting and returning', async ({ browser }) => {
    test.setTimeout(90000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // ?debug=1 raises the log level at module init (ntp.js initDebugMode), so
    // init()'s "init complete" marker is recorded even if the test attaches late.
    const ntpUrl = pathToFileURL(path.join(EXTENSION_PATH, NTP_PATH)).href + '?debug=1';
    await page.goto(ntpUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    page.on('pageerror', e => console.log('[PAGE ERROR]', e.message));
    await page.waitForFunction(() => (window as any).__boxingDebug, undefined, { timeout: 8000 });
    await waitForInitComplete(page);
    await dismissOnboarding(page);

    // 1. Create a large box with collapseHover=true
    const boxId = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const id = 'large-test-' + Date.now();
      dbg.layout.boxes.push({
        id, title: 'A', x: 100, y: 100, width: 320, height: 280,
        children: [], nextSmallIndex: 1, pinned: false, collapseHover: true
      });
      dbg.renderCanvas();
      return id;
    });
    expect(boxId).toBeTruthy();
    await page.waitForTimeout(300);

    const selector = '.large-box[data-id="' + boxId + '"]';

    // 2. Hover BEFORE entering — should expand
    // 89: hardened hover — re-issues the input each poll round and names the hit
    // test on failure (see hoverUntilExpanded). The expanded height arrives
    // asynchronously (setBodyExpandHeight + CSS transition), so poll rather than sleep.
    await hoverUntilExpanded(page, selector);
    const hoverH1 = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      const expandVar = el?.style.getPropertyValue('--expand-height') || '';
      return { h: el?.getBoundingClientRect().height || 0, expandVar };
    }, selector);
    console.log('BEFORE ENTER hover:', JSON.stringify(hoverH1));

    // 3. Move away to collapse
    await page.hover('body', { force: true });
    await page.waitForTimeout(400);

    // 4. Enter the box
    await page.evaluate((id) => {
      (window as any).__boxingDebug.enterLargeBox(id);
    }, boxId);
    await page.waitForTimeout(300);

    // 5. Exit back to canvas via back-btn
    await page.evaluate(() => {
      const backBtn = document.getElementById('back-btn') as HTMLElement;
      if (backBtn) backBtn.click();
    });
    await page.waitForTimeout(400);

    // 6. Verify classes survived
    const stateAfter = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      return {
        classes: el?.className || '',
        expandVar: el?.style.getPropertyValue('--expand-height') || '',
        h: el?.getBoundingClientRect().height || 0,
      };
    }, selector);
    console.log('AFTER EXIT:', JSON.stringify(stateAfter));
    expect(stateAfter.classes).toContain('box--hover-expand');
    expect(stateAfter.classes).toContain('box--collapsed');

    // 7. Hover AFTER exiting — should still expand (89: same hardened helper as step 2)
    await hoverUntilExpanded(page, selector);
    const finalH = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      return el?.getBoundingClientRect().height || 0;
    }, selector);
    console.log('AFTER EXIT hover height=' + finalH + ' (collapsed was ' + stateAfter.h + ')');
    await ctx.close();
  });
});
