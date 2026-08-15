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

test.describe('Empty state buttons + locate + perf (Bug 1-6 v2)', () => {
  // ============================================================
  // Bug 1: inner empty state stays centered during pan/zoom
  // (attached to #inner-surface, NOT transformed content layer)
  // ============================================================
  test('Bug1: inner empty state stays centered when canvas zoomed', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    // Get initial position
    const posBefore = await page.evaluate(() => {
      const el = document.querySelector('.inner__empty-state');
      const surf = document.getElementById('inner-surface');
      if (!el || !surf) return null;
      const elRect = el.getBoundingClientRect();
      const surfRect = surf.getBoundingClientRect();
      return {
        elCx: elRect.left + elRect.width / 2,
        elCy: elRect.top + elRect.height / 2,
        surfCx: surfRect.left + surfRect.width / 2,
        surfCy: surfRect.top + surfRect.height / 2,
      };
    });
    expect(posBefore).not.toBeNull();
    // Center of empty state should be close to center of inner-surface
    const dxBefore = Math.abs(posBefore!.elCx - posBefore!.surfCx);
    const dyBefore = Math.abs(posBefore!.elCy - posBefore!.surfCy);
    expect(dxBefore).toBeLessThan(50);
    expect(dyBefore).toBeLessThan(50);

    // Now zoom (change innerZoom via debug)
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      // Access innerZoom through the state or debug API — set it via __boxingDebug
      // The debug API exposes layout.settings but innerZoom is a closure var.
      // We can trigger zoom by dispatching a wheel event with ctrlKey on inner-surface
    });
    // Trigger ctrl+wheel zoom on inner surface
    await page.evaluate(() => {
      const surf = document.getElementById('inner-surface');
      if (!surf) return;
      const rect = surf.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const event = new WheelEvent('wheel', {
        ctrlKey: true,
        deltaY: -100,
        clientX: cx,
        clientY: cy,
        bubbles: true,
      });
      surf.dispatchEvent(event);
    });
    await page.waitForTimeout(300);

    // Now check that the empty state is still centered
    const posAfter = await page.evaluate(() => {
      const el = document.querySelector('.inner__empty-state');
      const surf = document.getElementById('inner-surface');
      if (!el || !surf) return null;
      const elRect = el.getBoundingClientRect();
      const surfRect = surf.getBoundingClientRect();
      return {
        elCx: elRect.left + elRect.width / 2,
        elCy: elRect.top + elRect.height / 2,
        surfCx: surfRect.left + surfRect.width / 2,
        surfCy: surfRect.top + surfRect.height / 2,
      };
    });
    expect(posAfter).not.toBeNull();
    const dxAfter = Math.abs(posAfter!.elCx - posAfter!.surfCx);
    const dyAfter = Math.abs(posAfter!.elCy - posAfter!.surfCy);
    // Bug1 key: empty state should STILL be centered after zoom (not moved with content)
    expect(dxAfter).toBeLessThan(50);
    expect(dyAfter).toBeLessThan(50);
  });

  test('Bug1: inner empty state is attached to #inner-surface not content layer', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    const parentInfo = await page.evaluate(() => {
      const el = document.querySelector('.inner__empty-state');
      if (!el) return null;
      return {
        parentId: el.parentElement?.id || null,
        parentClass: el.parentElement?.className || null,
      };
    });
    expect(parentInfo).not.toBeNull();
    // Bug1: should be direct child of #inner-surface (viewport), not .inner__surface-content (transformed)
    expect(parentInfo!.parentId).toBe('inner-surface');
  });

  test('Bug1: inner empty has button with pointer-events:auto', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    const info = await page.evaluate(() => {
      const btn = document.querySelector('.inner__empty-action');
      if (!btn) return null;
      return { tag: btn.tagName, pe: getComputedStyle(btn).pointerEvents };
    });
    expect(info).not.toBeNull();
    expect(info!.tag).toBe('BUTTON');
    expect(info!.pe).toBe('auto');
  });

  // Bug 2: large box empty shows button only (hint text removed per Q2)
  test('Bug2: large box empty state shows button only (no hint text)', async ({ page }) => {
    await resetBoxing(page);
    await addLargeBox(page);
    const info = await page.evaluate(() => {
      const hint = document.querySelector('.large-box__empty-hint');
      const btn = document.querySelector('.large-box__empty-action');
      return {
        hasHint: hint !== null,
        hasBtn: btn !== null,
        btnTag: btn?.tagName || null,
        btnText: btn?.textContent || null,
      };
    });
    expect(info.hasHint).toBe(false);
    expect(info.hasBtn).toBe(true);
    expect(info.btnTag).toBe('BUTTON');
    expect(info.btnText!.length).toBeGreaterThan(0);
  });
  test('Bug2: large box empty button enters the box on click', async ({ page }) => {
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

  // Bug 4: chips are buttons + chip click centers small box in viewport
  test('Bug4: large box chips are <button> with data-small-id', async ({ page }) => {
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

  test('Bug4: small-box--located highlight pulse animation exists', async ({ page }) => {
    await resetBoxing(page);
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

  // Bug 5: bm-add-btn styled with design tokens in base.css
  test('Bug5: bm-add-btn class styles the bookmark add button', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    await createSmallBox(page);
    const info = await page.evaluate(() => {
      const btn = document.querySelector('.bm-add-btn');
      if (!btn) return null;
      const cs = getComputedStyle(btn);
      return {
        className: btn.className,
        hasInlineStyle: (btn as HTMLElement).style.cssText.length > 0,
        cursor: cs.cursor,
        borderStyle: cs.borderStyle,
        borderRadius: cs.borderRadius,
      };
    });
    expect(info).not.toBeNull();
    expect(info!.className).toContain('bm-add-btn');
    expect(info!.hasInlineStyle).toBe(false);
    expect(info!.cursor).toBe('pointer');
    expect(info!.borderStyle).toBe('dashed');
  });

  // Bug 6: will-change:transform + contain:layout on boxes
  test('Bug6: will-change:transform on large-box', async ({ page }) => {
    await resetBoxing(page);
    await addLargeBox(page);
    const willChange = await page.evaluate(() => {
      const el = document.querySelector('.large-box');
      return el ? getComputedStyle(el).willChange : null;
    });
    expect(willChange).toBe('transform');
  });

  test('Bug6: contain:layout style on large-box', async ({ page }) => {
    await resetBoxing(page);
    await addLargeBox(page);
    const containVal = await page.evaluate(() => {
      const el = document.querySelector('.large-box');
      return el ? getComputedStyle(el).contain : null;
    });
    expect(containVal).not.toBeNull();
    expect(containVal).toContain('layout');
  });

  test('Bug6: will-change:transform + contain on small-box', async ({ page }) => {
    await resetBoxing(page);
    const lbId = await addLargeBox(page);
    await enterLargebox(page, lbId);
    await createSmallBox(page);
    const info = await page.evaluate(() => {
      const el = document.querySelector('.small-box');
      if (!el) return null;
      return { willChange: getComputedStyle(el).willChange, contain: getComputedStyle(el).contain };
    });
    expect(info).not.toBeNull();
    expect(info!.willChange).toBe('transform');
    expect(info!.contain).toContain('layout');
  });

  // Q1: Canvas empty state has unified button (not just text hint)
  test('Q1: canvas empty state has action button', async ({ page }) => {
    await resetBoxing(page);
    const info = await page.evaluate(() => {
      const btn = document.querySelector('.canvas__empty-action');
      const title = document.querySelector('.canvas__empty-title');
      const hint = document.querySelector('.canvas__empty-hint');
      return {
        hasBtn: btn !== null,
        btnTag: btn?.tagName || null,
        hasTitle: title !== null,
        hasHint: hint !== null,
      };
    });
    expect(info.hasBtn).toBe(true);
    expect(info.btnTag).toBe('BUTTON');
    expect(info.hasTitle).toBe(true);
    expect(info.hasHint).toBe(true);
  });

  // Q1: clicking canvas empty action button creates a large box
  test('Q1: clicking canvas empty action button adds a large box', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => {
      const btn = document.querySelector('.canvas__empty-action') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);
    const boxCount = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes.length);
    expect(boxCount).toBe(1);
  });

  // Q3: pin tooltip shows ACTION semantics (not state)
  test('Q3: pin tooltip shows action unpin when pinned', async ({ page }) => {
    await resetBoxing(page);
    // Default headerPinned=true -> tooltip should say "Unpin header" (the action)
    const title = await page.evaluate(() => {
      const btn = document.querySelector('#header-pin-btn') as HTMLElement;
      return btn?.title || null;
    });
    expect(title).toBeTruthy();
    // Should NOT contain state words like "pinned" or "已固定"
    expect(title).not.toMatch(/pinned|已固定/i);
  });

  test('Q3: pin tooltip shows action pin when unpinned', async ({ page }) => {
    await resetBoxing(page);
    // Toggle pin off first
    await page.evaluate(() => {
      const btn = document.querySelector('#header-pin-btn') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(200);
    const title = await page.evaluate(() => {
      const btn = document.querySelector('#header-pin-btn') as HTMLElement;
      return btn?.title || null;
    });
    expect(title).toBeTruthy();
    // Should NOT contain state words like "not pinned" or "未固定" or "unpinned"
    expect(title).not.toMatch(/not pinned|未固定|unpinned/i);
  });

  // Q4: settings-content has overflow-anchor:none (FF scroll jank fix)
  test('Q4: settings-content has overflow-anchor none', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => (window as any)._boxingOpenSettings());
    await page.waitForTimeout(200);
    const overflowAnchor = await page.evaluate(() => {
      const el = document.querySelector('.settings-content');
      return el ? getComputedStyle(el).overflowAnchor : null;
    });
    expect(overflowAnchor).toBe('none');
  });

  // Q4: modal__body does NOT have overflow-y auto (nested scroll jank fix)
  test('Q4: modal__body does not have overflow-y auto', async ({ page }) => {
    await resetBoxing(page);
    await page.evaluate(() => (window as any)._boxingOpenSettings());
    await page.waitForTimeout(200);
    const overflowY = await page.evaluate(() => {
      const el = document.querySelector('.modal__body');
      return el ? getComputedStyle(el).overflowY : null;
    });
    expect(overflowY).not.toBe('auto');
    expect(overflowY).not.toBe('scroll');
  });
});
