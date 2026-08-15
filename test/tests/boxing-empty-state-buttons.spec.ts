import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

async function resetBoxing(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

// Helper: create a large box via debug API and return its id
async function addLargeBox(page) {
  const lbId = await page.evaluate(async () => {
    await (window as any)._boxingAddLargeBox();
    const dbg = (window as any).__boxingDebug;
    return dbg.layout.boxes[dbg.layout.boxes.length - 1]?.id || null;
  });
  await page.waitForTimeout(200);
  return lbId;
}

// Helper: enter a large box via debug API and wait for render
async function enterLargebox(page, lbId) {
  await page.evaluate((id) => (window as any).__boxingDebug.enterLargeBox(id), lbId);
  await page.waitForTimeout(300);
}

// Helper: create a small box inside current inner view
async function createSmallBox(page) {
  await page.evaluate(async () => { await (window as any)._boxingAddSmallBox(); });
  await page.waitForTimeout(200);
}

// Helper: exit back to canvas via debug API
async function exitToCanvas(page) {
  await page.evaluate(() => (window as any)._boxingExitToCanvas());
  await page.waitForTimeout(300);
}

test.describe('Empty state action buttons (Bug 1-6)', () => {
  test('Bug1: inner canvas empty state is position:absolute inset:0 centered', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    const style = await page.evaluate(() => {
      const el = document.querySelector('.inner__empty-state');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        position: cs.position,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        pointerEvents: cs.pointerEvents,
      };
    });
    expect(style).not.toBeNull();
    expect(style!.position).toBe('absolute');
    expect(style!.display).toBe('flex');
    expect(style!.alignItems).toContain('center');
    expect(style!.justifyContent).toContain('center');
    expect(style!.pointerEvents).toBe('none');
  });

  test('Bug1: inner empty state button has pointer-events:auto and is a <button>', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    const info = await page.evaluate(() => {
      const btn = document.querySelector('.inner__empty-action') as HTMLElement;
      if (!btn) return null;
      return {
        tag: btn.tagName,
        pointerEvents: getComputedStyle(btn).pointerEvents,
      };
    });
    expect(info).not.toBeNull();
    expect(info!.tag).toBe('BUTTON');
    expect(info!.pointerEvents).toBe('auto');
  });

  test('Bug2+3: large box empty state has button-only, no hint text', async ({ page }) => {
    await resetBoxing(page);
    await addLargeBox(page);
    const hintExists = await page.evaluate(() => document.querySelector('.large-box__empty-hint') !== null);
    expect(hintExists).toBe(false);
    const btnInfo = await page.evaluate(() => {
      const b = document.querySelector('.large-box__empty-action');
      return b ? { tag: b.tagName, text: b.textContent } : null;
    });
    expect(btnInfo).not.toBeNull();
    expect(btnInfo!.tag).toBe('BUTTON');
    expect(btnInfo!.text!.length).toBeGreaterThan(0);
  });

  test('Bug2+3: large box empty button is clickable and enters the box', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await page.evaluate(() => {
      const btn = document.querySelector('.large-box__empty-action') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);
    const currentId = await page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId);
    expect(currentId).toBe(lbId);
  });

  test('Bug4: large box chips are <button> elements with click handlers', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    await createSmallBox(page);
    await exitToCanvas(page);
    const chipInfo = await page.evaluate(() => {
      const chips = document.querySelectorAll('.large-box__chip:not(.large-box__chip--more)');
      return Array.from(chips).map(c => ({
        tag: c.tagName,
        hasDataSmallId: c.getAttribute('data-small-id') !== null,
        smallId: c.getAttribute('data-small-id'),
      }));
    });
    expect(chipInfo.length).toBeGreaterThan(0);
    expect(chipInfo[0].tag).toBe('BUTTON');
    expect(chipInfo[0].hasDataSmallId).toBe(true);
  });

  test('Bug4: chip click enters large box', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    await createSmallBox(page);
    const sbId = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return dbg.layout.boxes[0]?.children?.[0]?.id || null;
    });
    await exitToCanvas(page);
    await page.evaluate((sid) => {
      const chip = document.querySelector(`.large-box__chip[data-small-id="${sid}"]`) as HTMLElement;
      if (chip) chip.click();
    }, sbId);
    await page.waitForTimeout(500);
    const currentId = await page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId);
    expect(currentId).toBe(lbId);
  });

  test('Bug5: bm-add-row button uses CSS class bm-add-btn, not inline styles', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    await createSmallBox(page);
    const btnInfo = await page.evaluate(() => {
      const btn = document.querySelector('.bm-add-btn');
      if (!btn) return null;
      const cs = getComputedStyle(btn);
      return {
        className: btn.className,
        hasInlineStyle: (btn as HTMLElement).style.cssText.length > 0,
        width: cs.width,
        cursor: cs.cursor,
        borderStyle: cs.borderStyle,
      };
    });
    expect(btnInfo).not.toBeNull();
    expect(btnInfo!.className).toContain('bm-add-btn');
    expect(btnInfo!.hasInlineStyle).toBe(false);
    expect(btnInfo!.cursor).toBe('pointer');
    expect(btnInfo!.borderStyle).toBe('dashed');
  });

  test('Bug6: will-change:transform on large-box', async ({ page }) => {
    await resetBoxing(page);
    await addLargeBox(page);
    const willChange = await page.evaluate(() => {
      const el = document.querySelector('.large-box');
      return el ? getComputedStyle(el).willChange : null;
    });
    expect(willChange).not.toBeNull();
    expect(willChange).toBe('transform');
  });

  test('Bug6: will-change:transform on small-box', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    await createSmallBox(page);
    const willChange = await page.evaluate(() => {
      const el = document.querySelector('.small-box');
      return el ? getComputedStyle(el).willChange : null;
    });
    expect(willChange).not.toBeNull();
    expect(willChange).toBe('transform');
  });

  test('Bug4: .small-box--located keyframe animation locate-pulse exists', async ({ page }) => {
    await resetBoxing(page);
    // Check the animation-name via computed style on an element with .small-box--located
    const animationName = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'small-box--located';
      el.style.visibility = 'hidden';
      document.body.appendChild(el);
      const name = getComputedStyle(el).animationName;
      document.body.removeChild(el);
      return name;
    });
    expect(animationName).toBe('locate-pulse');
  });

  test('Bug4: large-box__chip has cursor:pointer (button styled)', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    await createSmallBox(page);
    await exitToCanvas(page);
    const cursor = await page.evaluate(() => {
      const chip = document.querySelector('.large-box__chip:not(.large-box__chip--more)') as HTMLElement;
      return chip ? getComputedStyle(chip).cursor : null;
    });
    expect(cursor).toBe('pointer');
  });
});
