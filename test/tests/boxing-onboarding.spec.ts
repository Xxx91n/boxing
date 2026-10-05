import { expect, test } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { dismissOnboarding } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

// Smoke test for the first-run onboarding overlay.

async function resetFreshInstall(page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
}

test.describe('Onboarding (first-run guided tour)', () => {
  test('overlay shows on fresh install with empty canvas', async ({ page }) => {
    await resetFreshInstall(page);
    const visible = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return !!ov && !ov.hidden;
    });
    expect(visible).toBe(true);
  });

  test('overlay does not show when onboardingCompleted=true (already onboarded)', async ({ page }) => {
    await resetFreshInstall(page);
    await dismissOnboarding(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    const visible = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return !!ov && !ov.hidden;
    });
    expect(visible).toBe(false);
  });

  // Ticket 27 (quarantine convergence): @quarantine retired. The guarded behavior is
  // the step-nav state machine, not input realness — native locator.click stalled on
  // the firefox lane under load (playwright#16095 class), so buttons are activated
  // synthetically (same pattern as the evaluate-only siblings above).
  test('step navigation: Next advances through all 3 steps and dismiss sets onboardingCompleted', async ({ page }) => {
    const jsClick = (sel: string) =>
      page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);
    await resetFreshInstall(page);
    // Step 1 visible
    let stepActive = await page.locator('.onboarding__step:not([hidden])').getAttribute('data-step');
    expect(stepActive).toBe('1');

    await jsClick('#onboarding-next-btn');
    stepActive = await page.locator('.onboarding__step:not([hidden])').getAttribute('data-step');
    expect(stepActive).toBe('2');

    await jsClick('#onboarding-prev-btn');
    stepActive = await page.locator('.onboarding__step:not([hidden])').getAttribute('data-step');
    expect(stepActive).toBe('1');

    await jsClick('#onboarding-next-btn');
    await jsClick('#onboarding-next-btn');
    // Step is now at last; one more click triggers close(true).
    await jsClick('#onboarding-next-btn');
    // After the last "Next", overlay closes and onboardingCompleted is persisted.
    await expect.poll(() => page.locator('#onboarding-overlay').isHidden()).toBe(true);
    const flag = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.onboardingCompleted);
    expect(flag).toBe(true);
  });

  test('overlay does not show when canvas already has boxes (existing user)', async ({ page }) => {
    await resetFreshInstall(page);
    // Add a large box before any onboarding dismissal — should still show because onboardingCompleted is false,
    // BUT per spec the overlay only auto-shows on empty canvas. So dismiss onboarding via the button first won't
    // matter; here we test the post-refresh scenario where boxes exist.
    await page.evaluate(() => (window as any)._boxingAddLargeBox());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    const visible = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return !!ov && !ov.hidden;
    });
    // Already showed before (savedLayout set onboardingCompleted=false); but canvas now non-empty,
    // so the overlay must NOT reappear because condition requires empty canvas.
    expect(visible).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BX-D-009 (Wave 2026.10.11 P-18 / S-11): tour suppression + Escape, live.
//
// The static artifact contracts live in boxing-build-pipeline.spec.ts. This block
// proves the RUNTIME consequences, which are what the user actually felt:
//   - the demo flag really does leave the page free of a modal blocker,
//   - Escape really does dismiss the tour (WCAG 2.1.2, Level A),
//   - the real-extension install tour still appears, and the file:// debug lane
//     still shows it — i.e. the suppression is scoped, not a global kill switch.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('BX-D-009: tour suppression scope + Escape dismissal (live)', () => {
  test('D009-r1: with __BOXING_DEMO__ set, no overlay blocks the page', async ({ page }) => {
    await page.addInitScript(() => {
      // Same mechanism the demo build uses (a classic script running before the
      // deferred ntp.js module) — here injected at document start.
      (window as any).__BOXING_DEMO__ = true;
    });
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    const state = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return {
        flag: (window as any).__BOXING_DEMO__ === true,
        overlayVisible: Boolean(ov && !ov.hidden),
        onboardingCompleted: (window as any).__boxingDebug.layout.settings.onboardingCompleted,
      };
    });
    expect(state.flag).toBe(true);
    // THE bug: this overlay used to be visible here and swallow every click.
    expect(state.overlayVisible, 'demo must not show the tour').toBe(false);
    // Nothing was silently marked complete either — the tour was suppressed, not
    // force-completed, so a real install is unaffected by demo visits.
    expect(state.onboardingCompleted).not.toBe(true);
    // A real pointer must now reach the canvas (the actual user-visible symptom).
    const blocked = await page.evaluate(() => {
      const el = document.querySelector('.canvas__surface') || document.getElementById('canvas');
      if (!el) return 'canvas absent';
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement | null;
      if (!hit) return 'null';
      return (hit === el || el.contains(hit)) ? null : 'intercepted by ' + hit.tagName + '#' + (hit.id || '');
    });
    expect(blocked, 'pointer must reach the canvas on the demo lane').toBeNull();
  });

  test('D009-r2: real-extension install tour STILL appears (suppression is scoped to demo)', async ({ page }) => {
    await resetFreshInstall(page);
    // No __BOXING_DEMO__ here — this is the genuine fresh-install path.
    expect(await page.evaluate(() => Boolean((window as any).__BOXING_DEMO__))).toBe(false);
    await expect.poll(() => page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && !ov.hidden);
    }), { timeout: 8000 }).toBe(true);
  });

  test('D009-r3: file:// debug lane still shows the tour on an empty canvas', async ({ page }) => {
    await resetFreshInstall(page);
    // Same as r2 by construction (file:// lane, no demo flag); asserted separately
    // because it is the deliberate D-009 negative constraint: the debugging entry
    // point must keep working.
    const visible = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && !ov.hidden);
    });
    expect(visible, 'file:// empty-canvas tour must survive (debug lane)').toBe(true);
  });

  test('D009-r4: Escape dismisses the tour (WCAG 2.1.2) and takes priority over canvas Escape', async ({ page }) => {
    await resetFreshInstall(page);
    await expect.poll(() => page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && !ov.hidden);
    }), { timeout: 8000 }).toBe(true);

    // Seed a box and enter it first: canvas Escape means "exit to canvas". If the
    // overlay handler did NOT outrank the canvas handler, this Escape would exit
    // the box and leave the modal open — the exact keyboard-trap the fix removes.
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{ id: 'esc-lb', type: 'large', title: 'EscBox', x: 0, y: 0, width: 320, height: 220, children: [] }];
      dbg.layout._meta = { updatedAt: Date.now() };
      dbg.renderCanvas();
      dbg.enterLargeBox('esc-lb');
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId)).toBe('esc-lb');

    await page.keyboard.press('Escape');

    await expect.poll(() => page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && ov.hidden);
    }), { timeout: 5000 }).toBe(true);
    // The tour is gone AND the canvas handler never ran (still inside the box).
    const after = await page.evaluate(() => ({
      currentLargeBoxId: (window as any).__boxingDebug.state().currentLargeBoxId,
      completed: (window as any).__boxingDebug.layout.settings.onboardingCompleted,
    }));
    expect(after.currentLargeBoxId, 'canvas Escape must NOT also fire (exit-to-canvas)').toBe('esc-lb');
    expect(after.completed, 'Escape counts as a dismissal').toBe(true);
  });

  test('D009-r5: the Escape listener does not outlive the overlay', async ({ page }) => {
    await resetFreshInstall(page);
    await expect.poll(() => page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && !ov.hidden);
    }), { timeout: 8000 }).toBe(true);
    // Close it, then press Escape again from the canvas: nothing may react.
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && ov.hidden);
    }), { timeout: 5000 }).toBe(true);
    await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.boxes = [{ id: 'after-esc', type: 'large', title: 'B', x: 0, y: 0, width: 320, height: 220, children: [] }];
      dbg.renderCanvas();
      dbg.enterLargeBox('after-esc');
    });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId)).toBe('after-esc');
    // With no overlay open, Escape belongs to the canvas again: it must exit.
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.state().currentLargeBoxId), { timeout: 5000 }).toBe(null);
  });
});
