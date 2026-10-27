import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { dismissOnboarding, dismissReplay, type ReplayDismissal } from '../helpers/onboarding';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NTP_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'ntp', 'index.html')).href;

// Synthetic activation: the Firefox lane stalls on native locator.click under
// load (playwright#16095 class); used by the tour step machine and replay tests.
const jsClick = (page: Page, sel: string) =>
  page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);

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
    await resetFreshInstall(page);
    // Step 1 visible
    let stepActive = await page.locator('.onboarding__step:not([hidden])').getAttribute('data-step');
    expect(stepActive).toBe('1');

    await jsClick(page, '#onboarding-next-btn');
    // Poll the step label: the click handler updates it asynchronously, and a
    // same-turn read under load observes the previous step (issue #36).
    await expect.poll(() => page.locator('.onboarding__step:not([hidden])').getAttribute('data-step')).toBe('2');

    await jsClick(page, '#onboarding-prev-btn');
    await expect.poll(() => page.locator('.onboarding__step:not([hidden])').getAttribute('data-step')).toBe('1');

    await jsClick(page, '#onboarding-next-btn');
    await jsClick(page, '#onboarding-next-btn');
    // Step is now at last; one more click triggers close(true).
    await jsClick(page, '#onboarding-next-btn');
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
// (Wave 2026.10.11 P-18 / S-11): tour suppression + Escape, live.
//
// The static artifact contracts live in boxing-build-pipeline.spec.ts. This block
// proves the RUNTIME consequences, which are what the user actually felt:
//   - the demo flag really does leave the page free of a modal blocker,
//   - Escape really does dismiss the tour (WCAG 2.1.2, Level A),
//   - the real-extension install tour still appears, and the file:// debug lane
//     still shows it — i.e. the suppression is scoped, not a global kill switch.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('tour suppression scope + Escape dismissal (live)', () => {
  test('with __BOXING_DEMO__ set, no overlay blocks the page', async ({ page }) => {
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

  test('real-extension install tour STILL appears (suppression is scoped to demo)', async ({ page }) => {
    await resetFreshInstall(page);
    // No __BOXING_DEMO__ here — this is the genuine fresh-install path.
    expect(await page.evaluate(() => Boolean((window as any).__BOXING_DEMO__))).toBe(false);
    await expect.poll(() => page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && !ov.hidden);
    }), { timeout: 8000 }).toBe(true);
  });

  test('file:// debug lane still shows the tour on an empty canvas', async ({ page }) => {
    await resetFreshInstall(page);
    // Same as the real-extension case by construction (file:// lane, no demo flag);
    // asserted separately because it is the deliberate negative constraint: the debugging entry
    // point must keep working.
    const visible = await page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && !ov.hidden);
    });
    expect(visible, 'file:// empty-canvas tour must survive (debug lane)').toBe(true);
  });

  test('Escape dismisses the tour (WCAG 2.1.2) and takes priority over canvas Escape', async ({ page }) => {
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

  test('the Escape listener does not outlive the overlay', async ({ page }) => {
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

// ═══════════════════════════════════════════════════════════════════════════
// Ticket 45: tour replay entry in Settings > About.
//
// The replay must reuse the existing overlay (step 1, no first-run language
// picker) and must be harmless: every dismissal path leaves the persisted
// completion flag and the stored layout exactly as they were before the replay.
// The genuine first-run tour is asserted unchanged in the same block.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('tour replay entry (Settings > About)', () => {
  async function openAboutTab(page) {
    await page.evaluate(() => {
      const open = (window as any)._boxingOpenSettings;
      if (typeof open === 'function') open();
    });
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.settings-nav__item[data-tab="about"]')?.click();
    });
    await expect(page.locator('#about-show-tour')).toBeVisible();
  }

  // A completed first run, with the dismissal write settled so the "stored layout
  // unchanged" comparison has a stable baseline.
  async function completeFirstRun(page) {
    await resetFreshInstall(page);
    await dismissOnboarding(page);
    await page.evaluate(() => (window as any).__boxingDebug.saveLayout());
  }

  const storedLayout = (page) =>
    page.evaluate(async () => {
      const res = await (window as any).__boxingDebug.storageGet('boxingLayout');
      return JSON.stringify(res?.boxingLayout ?? null);
    });

  const overlayVisible = (page) =>
    page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && !ov.hidden);
    });

  const overlayHidden = (page) =>
    page.evaluate(() => {
      const ov = document.getElementById('onboarding-overlay');
      return Boolean(ov && ov.hidden);
    });

  async function openReplay(page) {
    await openAboutTab(page);
    // Focus first, then activate synthetically: focus is what a real keyboard or
    // pointer activation establishes, and replay saves it for restoration.
    await page.evaluate(() => (document.getElementById('about-show-tour') as HTMLElement).focus());
    // Synthetic activation, same reason as the step machine above: the Firefox
    // lane can stall on native locator.click under load.
    await jsClick(page, '#about-show-tour');
    await expect.poll(() => overlayVisible(page)).toBe(true);
  }

  test('after the tour is completed, About shows a visible focusable button', async ({ page }) => {
    await completeFirstRun(page);
    await openAboutTab(page);
    const btn = page.locator('#about-show-tour');
    await expect(btn).toBeVisible();
    await expect(btn, 'the entry must carry a clear, localized label').toHaveText('Show the tour');
    const state = await page.evaluate(() => {
      const el = document.getElementById('about-show-tour') as HTMLElement | null;
      if (!el) return null;
      el.focus();
      return { tag: el.tagName, tabIndex: el.tabIndex, focused: document.activeElement === el };
    });
    expect(state, 'the replay entry must exist').not.toBeNull();
    expect(state!.tag).toBe('BUTTON');
    expect(state!.tabIndex).toBe(0);
    expect(state!.focused, 'the entry must be keyboard-focusable').toBe(true);
  });

  test('clicking the entry reopens the overlay at step 1 without the language picker', async ({ page }) => {
    await completeFirstRun(page);
    await openReplay(page);
    const state = await page.evaluate(() => {
      const step = document.querySelector('.onboarding__step:not([hidden])');
      const lang = document.getElementById('onboarding-lang-wrap') as HTMLElement | null;
      return {
        step: step?.getAttribute('data-step') ?? null,
        langHidden: Boolean(lang && lang.hidden),
      };
    });
    expect(state.step).toBe('1');
    expect(state.langHidden, 'a replay must not repeat the first-run language picker').toBe(true);
    // The property alone is not enough: `.onboarding__lang` sets display:flex,
    // which overrides the UA [hidden] rule without the CSS pair in onboarding.css.
    await expect(page.locator('#onboarding-lang-wrap')).toBeHidden();
  });

  const dismissals: Array<{ name: string; via: ReplayDismissal }> = [
    { name: 'finish', via: 'finish' },
    { name: 'skip', via: 'skip' },
    { name: 'Escape', via: 'escape' },
    { name: 'outside click', via: 'outside-click' },
  ];

  for (const { name, via } of dismissals) {
    test(`replay dismissal via ${name} leaves the completion flag and stored layout untouched`, async ({ page }) => {
      await completeFirstRun(page);
      await openReplay(page);
      const before = await storedLayout(page);

      await dismissReplay(page, via);

      const after = await storedLayout(page);
      expect(after, `closing a replay via ${name} must not write the layout`).toBe(before);
      const flag = await page.evaluate(() => (window as any).__boxingDebug.layout.settings.onboardingCompleted);
      expect(flag, `closing a replay via ${name} must leave the completion flag true`).toBe(true);
    });
  }

  test('closing a replay keeps focus on the About entry (keyboard path)', async ({ page }) => {
    await completeFirstRun(page);
    await openReplay(page);
    // openReplay focuses the entry and openTour saves it for restoration.
    await page.keyboard.press('Escape');
    await expect.poll(() => overlayHidden(page)).toBe(true);
    const focused = await page.evaluate(() => document.activeElement?.id || null);
    expect(focused, 'a replay close must not re-render the canvas and blur the entry').toBe('about-show-tour');
  });

  test('replay moves focus into the tour so Enter advances instead of reopening', async ({ page }) => {
    await completeFirstRun(page);
    await openReplay(page);
    const focused = await page.evaluate(() => document.activeElement?.id || null);
    expect(focused, 'replay must move focus into the overlay').toBe('onboarding-next-btn');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.locator('.onboarding__step:not([hidden])').getAttribute('data-step')).toBe('2');
    await page.keyboard.press('Escape');
    await expect.poll(() => overlayHidden(page)).toBe(true);
    const restored = await page.evaluate(() => document.activeElement?.id || null);
    expect(restored, 'closing the replay must return focus to the entry').toBe('about-show-tour');
  });

  test('genuine first-run tour still shows the language picker, starts at step 1, and records completion', async ({ page }) => {
    await resetFreshInstall(page);
    await expect.poll(() => overlayVisible(page), { timeout: 8000 }).toBe(true);
    const state = await page.evaluate(() => {
      const step = document.querySelector('.onboarding__step:not([hidden])');
      const lang = document.getElementById('onboarding-lang-wrap') as HTMLElement | null;
      return {
        step: step?.getAttribute('data-step') ?? null,
        langHidden: Boolean(lang && lang.hidden),
      };
    });
    expect(state.step).toBe('1');
    expect(state.langHidden, 'the genuine first run must keep the language picker').toBe(false);
    await expect(page.locator('#onboarding-lang-wrap')).toBeVisible();

    await jsClick(page, '#onboarding-next-btn');
    await jsClick(page, '#onboarding-next-btn');
    await jsClick(page, '#onboarding-next-btn');
    await expect.poll(() => overlayHidden(page)).toBe(true);
    await expect.poll(async () => page.evaluate(async () => {
      const res = await (window as any).__boxingDebug.storageGet('boxingLayout');
      return res?.boxingLayout?.settings?.onboardingCompleted === true;
    })).toBe(true);
  });

  test('demo build hides the entry and exposes no dead control', async ({ page }) => {
    await page.addInitScript(() => {
      // Same mechanism as the existing demo test: injected at document start, so
      // it is set before the deferred ntp.js module executes.
      (window as any).__BOXING_DEMO__ = true;
    });
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);

    await page.evaluate(() => {
      const open = (window as any)._boxingOpenSettings;
      if (typeof open === 'function') open();
    });
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.settings-nav__item[data-tab="about"]')?.click();
    });

    const state = await page.evaluate(() => {
      const btn = document.getElementById('about-show-tour') as HTMLElement | null;
      const ov = document.getElementById('onboarding-overlay');
      return {
        present: Boolean(btn),
        hidden: Boolean(btn && btn.hidden),
        overlayVisible: Boolean(ov && !ov.hidden),
      };
    });
    expect(state.present, 'the demo must keep the entry in the DOM').toBe(true);
    expect(state.hidden, 'the demo must hide the show-tour control').toBe(true);
    expect(state.overlayVisible, 'the demo must keep the tour suppressed').toBe(false);
    await expect(page.locator('#about-show-tour')).toBeHidden();
  });
});
