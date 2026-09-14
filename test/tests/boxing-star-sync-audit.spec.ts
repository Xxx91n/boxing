import { expect, test, type Browser, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;
// Architecture audit Q1: verify cross-tab star sync behavior.
// These tests probe whether box.isParent survives cross-tab mergeConcurrentLayout
// without the layout.groups shim. Results determine if Block 1 (L1417-1430) in
// dsuRebuildFromConnections can be safely removed.

// A-041 (ticket 87): `reset` controls the storage wipe. Default true = clean slate.
// Pass { reset: false } for a tab that must ADOPT state another tab persisted: clearing
// storage there deletes the very data under test. Scenario 1 did exactly that and
// regressed to starB === null (box absent, not unstarred) on all three OS.
async function boot(page: Page, opts: { reset?: boolean } = {}) {
  const reset = opts.reset !== false;
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  if (reset) {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
}

test.describe('Cross-tab star (isParent) sync — architecture audit Q1', () => {
  test('Scenario 1: star set on tab A, fresh tab B adopts star via box.isParent', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    await boot(a);

    // Create box on tab A
    const idA = await a.evaluate(() => {
      (window as any)._boxingAddLargeBox();
      return (window as any).__boxingDebug.layout.boxes[0].id;
    });
    expect(idA).toBeTruthy();

    // Star it on tab A
    await a.evaluate((id) => {
      const key = (window as any).__boxingDebug.largeKey(id);
      (window as any).__boxingDebug.toggleStarMark(key);
    }, idA);

    // Verify star is set on tab A
    const starA = await a.evaluate((id) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((b: any) => b.id === id);
      return lb ? lb.isParent : null;
    }, idA);
    expect(starA).toBe(true);

    // Force save
    await a.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await a.waitForTimeout(400);

    // Open tab B (fresh — loads from storage). reset:false keeps the layout tab A
    // just persisted; without it this scenario can never observe adoption.
    const b = await ctx.newPage();
    await boot(b, { reset: false });

    // Check if tab B adopted the star via box.isParent (without layout.groups).
    // expect.poll replaces the fixed 600ms sleep so slow CI runners are not flaky;
    // the predicate and the `true` expectation are unchanged.
    let starB: boolean | null = null;
    await expect.poll(async () => {
      starB = await b.evaluate((id) => {
        const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === id);
        return lb ? lb.isParent : null;
      }, idA);
      return starB;
    }, { timeout: 10000 }).toBe(true);

    console.log('Scenario 1: starB =', starB);
    expect(starB).toBe(true);

    await ctx.close();
  });

  test('Scenario 3: unstar on tab A, tab B stale isParent cleared by tombstone', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await boot(a);
    await boot(b);

    // Create box on tab A
    const idA = await a.evaluate(() => {
      (window as any)._boxingAddLargeBox();
      return (window as any).__boxingDebug.layout.boxes[0].id;
    });
    expect(idA).toBeTruthy();

    // Star it on tab A
    await a.evaluate((id) => {
      const key = (window as any).__boxingDebug.largeKey(id);
      (window as any).__boxingDebug.toggleStarMark(key);
    }, idA);
    await a.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await a.waitForTimeout(400);

    // Wait for tab B to receive the star
    await b.waitForTimeout(600);
    const starB_before = await b.evaluate((id) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === id);
      return lb ? lb.isParent : null;
    }, idA);
    console.log('Scenario 3: starB_before unstar =', starB_before);

    // Unstar on tab A
    await a.evaluate((id) => {
      const key = (window as any).__boxingDebug.largeKey(id);
      (window as any).__boxingDebug.toggleStarMark(key);
    }, idA);
    await a.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await a.waitForTimeout(400);

    // Wait for tab B to receive the unstar
    await b.waitForTimeout(800);

    // Check if tab B's isParent was cleared
    const starB_after = await b.evaluate((id) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === id);
      return lb ? lb.isParent : null;
    }, idA);
    console.log('Scenario 3: starB_after unstar =', starB_after);

    // This is the key assertion: does tombstone propagation clear the stale star?
    expect(starB_after).toBe(false);

    await ctx.close();
  });

  test('Scenario 2: star set on tab A, existing tab B (already has box) adopts star', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await boot(a);
    await boot(b);

    // Create box on tab A
    const idA = await a.evaluate(() => {
      (window as any)._boxingAddLargeBox();
      return (window as any).__boxingDebug.layout.boxes[0].id;
    });
    await a.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await a.waitForTimeout(400);

    // Wait for tab B to receive the box
    await b.waitForTimeout(600);
    const hasBoxB = await b.evaluate((id) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === id);
      return !!lb;
    }, idA);
    expect(hasBoxB).toBe(true);

    // Star it on tab A (box already exists on tab B with isParent=false/undefined)
    await a.evaluate((id) => {
      const key = (window as any).__boxingDebug.largeKey(id);
      (window as any).__boxingDebug.toggleStarMark(key);
    }, idA);
    await a.evaluate(() => (window as any).__boxingDebug.saveLayout());
    await a.waitForTimeout(400);

    // Wait for tab B to receive the star change
    await b.waitForTimeout(800);

    const starB = await b.evaluate((id) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === id);
      return lb ? lb.isParent : null;
    }, idA);
    console.log('Scenario 2: starB (existing tab adopts star) =', starB);

    // Key question: does tab B adopt the star when it already has the box?
    // mergeById: local wins ties → tab B's box (isParent=false) overwrites tab A's (isParent=true)
    // So this might be FALSE — which would prove Block 1 in dsuRebuildFromConnections is needed
    // Document the actual result either way
    expect(typeof starB).toBe('boolean');

    await ctx.close();
  });
});
