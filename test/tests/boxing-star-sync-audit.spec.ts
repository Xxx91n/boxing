import { expect, test, type Browser, type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = `file:///${path
  .resolve(__dirname, '..', '..', 'ntp', 'index.html')
  .replace(/\\/g, '/')}`;

// Architecture audit Q1: verify cross-tab star sync behavior.
// These tests probe whether box.isParent survives cross-tab mergeConcurrentLayout
// without the layout.groups shim. Results determine if Block 1 (L1417-1430) in
// dsuRebuildFromConnections can be safely removed.

async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
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
    await a.waitForTimeout(200);

    // Open tab B (fresh — loads from storage)
    const b = await ctx.newPage();
    await boot(b);
    await b.waitForTimeout(300);

    // Check if tab B adopted the star via box.isParent (without layout.groups)
    const starB = await b.evaluate((id) => {
      const lb = (window as any).__boxingDebug.layout.boxes.find((bx: any) => bx.id === id);
      return lb ? lb.isParent : null;
    }, idA);

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
    await a.waitForTimeout(200);

    // Wait for tab B to receive the star
    await b.waitForTimeout(300);
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
    await a.waitForTimeout(200);

    // Wait for tab B to receive the unstar
    await b.waitForTimeout(400);

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
    await a.waitForTimeout(200);

    // Wait for tab B to receive the box
    await b.waitForTimeout(300);
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
    await a.waitForTimeout(200);

    // Wait for tab B to receive the star change
    await b.waitForTimeout(400);

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
