// Boxing e2e helper — first-run onboarding overlay (ticket 101 / A-055 / B65).
//
// ROOT CAUSE (measured, not inferred — ticket 89 §6.1, ticket 93 §2.3):
// ntp/index.html ships a full-screen first-run tour overlay (#onboarding-overlay,
// class .modal-overlay: position:fixed; inset:0; z-index:100; aria-modal="true").
// It is NOT inert, so it wins the hit test: a real page.hover / page.click lands on
// the overlay and the intended element never receives the pointer.
//
// The overlay is shown by initOnboarding() — the LAST step of ntp init()
// (ntp/ntp.js:1168 -> ntp/onboarding.js:108) — and only when the fresh-install
// decision holds (onboarding.js:30-33). The historic per-spec dismissal was
// fire-and-forget: no post-condition, no ordering.
//
//   await page.evaluate(() => { try { (window as any).__boxingDebug?.skipOnboarding?.(); } catch (_) {} });
//
// If that ran before init() had settled its onboarding decision, loadLayout()
// replaced layout.settings (reverting onboardingCompleted) and initOnboarding()
// re-showed the overlay AFTER the dismissal; the overlay then intercepted the next
// real pointer action. Observed signature (ledger, ticket 93):
//   boxing-empty-state-buttons Bug5-dark — expect.poll 5000ms:
//   Expected "rgba(196, 168, 130, 0.12)" / Received "rgba(0, 0, 0, 0)"
// (the :hover never applied because page.hover('.bm-add-btn') hit the overlay).
//
// THE FIX — three parts, zero arbitrary delay (no waitForTimeout anywhere here):
//   1. waitForOnboardingDecision() gates on init() having settled its decision;
//   2. dismissOnboarding() dismisses idempotently and proves the overlay hidden;
//   3. assertPointerReaches() restores the Receives-Events signal that
//      { force: true } bypasses (still needed on the firefox headed lane, 89 R1).
//
// The gate needs NO product-side change and NO ?debug=1: the three conditions it
// checks are exactly the ones initOnboarding() itself branches on, so the gate is
// satisfied no later than the moment that decision is made — and a dismissal after
// it is permanent (nothing re-shows the tour once the decision is settled).
//
// The origin of this pattern is boxing-auto-expand.spec.ts (ticket 89, four-layer
// hardening: init gate + idempotent dismissal + elementFromPoint hit test +
// domcontentloaded). Do NOT reintroduce the fire-and-forget form: ticket 89 fixed
// one spec and left ~25 siblings carrying the same race, which is what this ticket
// had to clean up.

import { expect, type Page } from '@playwright/test';

export const ONBOARDING_OVERLAY_ID = 'onboarding-overlay';

/**
 * Resolve once ntp init() has settled its first-run onboarding decision.
 *
 * initOnboarding() (ntp/onboarding.js:23) is the last step of init() and either
 * SHOWS the overlay (fresh install: not completed AND empty canvas) or returns
 * early (already completed, or the canvas already has boxes). Those are precisely
 * the three conditions polled below, so the gate cannot pass before the decision
 * exists and cannot miss it afterwards.
 */
export async function waitForOnboardingDecision(page: Page, timeout = 15000): Promise<void> {
  await expect.poll(
    () => page.evaluate((overlayId) => {
      const dbg = (window as any).__boxingDebug;
      if (!dbg) return false;
      const overlay = document.getElementById(overlayId) as HTMLElement | null;
      if (!overlay) return true;
      if (!overlay.hidden) return true;
      const layout = dbg.layout;
      if (layout && layout.settings && layout.settings.onboardingCompleted === true) return true;
      if (layout && Array.isArray(layout.boxes) && layout.boxes.length > 0) return true;
      return false;
    }, ONBOARDING_OVERLAY_ID),
    {
      timeout,
      message: 'ntp init() must settle the first-run onboarding decision before the tour can be dismissed permanently (ticket 101 / B65)',
    },
  ).toBe(true);
}

/**
 * Dismiss the first-run tour and PROVE it is hidden. Idempotent: safe to call
 * repeatedly, and each round re-dismisses if the overlay is visible again.
 *
 * Always gates on waitForOnboardingDecision() first — that ordering is the whole
 * point. Dismissing before the decision is settled is not permanent.
 */
export async function dismissOnboarding(
  page: Page,
  opts: { decisionTimeout?: number; dismissTimeout?: number } = {},
): Promise<void> {
  await waitForOnboardingDecision(page, opts.decisionTimeout ?? 15000);
  await expect.poll(
    () => page.evaluate((overlayId) => {
      const dbg = (window as any).__boxingDebug;
      const overlay = document.getElementById(overlayId) as HTMLElement | null;
      if (!overlay) return true;
      if (!overlay.hidden) {
        try { dbg?.skipOnboarding?.(); } catch (_) { /* helper: idempotent re-dismiss; the poll retries */ }
      }
      return overlay.hidden === true;
    }, ONBOARDING_OVERLAY_ID),
    {
      timeout: opts.dismissTimeout ?? 8000,
      message: 'first-run onboarding overlay must be provably hidden before real pointer input (ticket 101 / B65)',
    },
  ).toBe(true);
}

/**
 * The whole fresh-storage boot in one call: goto -> (clear storage) -> reload ->
 * wait for __boxingDebug -> dismiss the tour. Use this for new specs; existing
 * specs keep their local resetBoxing/boot shell and delegate to dismissOnboarding.
 */
export async function resetNtp(
  page: Page,
  url: string,
  opts: { clear?: boolean } = {},
): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (opts.clear !== false) {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
  await dismissOnboarding(page);
}

/**
 * Assert a real pointer can reach the given selector — i.e. the point a
 * page.hover() / page.click() would hit resolves to the element (or a descendant)
 * rather than a blocker. This restores the Receives-Events signal that
 * { force: true } skips; use it before any forced pointer action, and as the
 * named blocker report when a full-screen overlay is suspected.
 */
export async function assertPointerReaches(
  page: Page,
  selector: string,
  opts: { timeout?: number; intervals?: number[] } = {},
): Promise<void> {
  await expect(async () => {
    const blocker = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return 'target element absent: ' + sel;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(30, r.height / 2)) as HTMLElement | null;
      if (hit && (hit === el || el.contains(hit))) return null;
      return 'pointer intercepted by ' + (hit ? hit.tagName + '#' + (hit.id || '') + '.' + String(hit.className || '') : 'null');
    }, selector);
    if (blocker) throw new Error(blocker);
  }, { timeout: opts.timeout ?? 5000, intervals: opts.intervals ?? [100, 250, 500] }).toPass();
}
