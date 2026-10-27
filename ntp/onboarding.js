// Boxing — onboarding module (ticket 10, architecture-recovery).
// First-run guided tour. Trigger model: background.js persists boxingInstallSignal on
// chrome.runtime.onInstalled (reason install|update); ntp.js init() consumes the signal and calls
// initOnboarding({ reason }). reason 'install' → tour when not completed; 'update' → suppressed;
// missing signal (file:// mock lane) → legacy empty-canvas fresh-install judgment (tests alive).
// Moved verbatim from ntp.js except the trigger lines — the one deliberate behavior change of
// this ticket (issue 10: onboarding triggered by onInstalled, not per-init determination).
//
// Ticket 45 adds a replay entry (Settings > About) that reuses this same overlay: same step
// copy, same controls, same Escape/outside-click dismissals. The only differences are that a
// replay starts at step 1 without the first-run language picker and never writes the completion
// flag or the layout on close.

import { layout } from './state.js';
import { saveLayout } from './storage.js';
import { i18n, loadI18nStore, applyI18n, currentLang, SUPPORTED_LANGS } from './i18n.js';
import { renderCanvas, updateAutohideUI } from './render.js';
import { openSettingsModal } from './settings-ui.js';

let debug, debugErr, updateCaption, langSelect;
// injected runtime-id probe (defensive demo detection). ntp.js holds the
// only sanctioned browser-API handle; this module reads through the facade so the
// import-graph-guard B-6 whitelist stays intact.
let demoRuntimeId;

// Ticket 10: inject ntp.js-scope deps (loggers + caption updater + shared langSelect ref).
export function initOnboardingFacade(deps) {
  debug = deps.debug; debugErr = deps.debugErr; updateCaption = deps.updateCaption; langSelect = deps.langSelect;
  demoRuntimeId = deps.demoRuntimeId;
}

// Demo suppression is one rule for both the tour and its Settings > About entry:
// the build-time flag is the single source, the runtime id is the defensive
// second condition. Returns the matching source for the debug log, or null.
function demoSuppressionReason() {
  try {
    if (window.__BOXING_DEMO__ === true) return '__BOXING_DEMO__';
    if (typeof demoRuntimeId === 'function' && demoRuntimeId() === 'boxing-pages-demo') return 'runtime.id';
    return null;
  } catch (e) {
    if (typeof debugErr === 'function') debugErr('onboarding demo probe', e);
    return null;
  }
}

  // ── BX-ONBOARDING: first-run guided tour ───────────────────────────────
  // (bug3): the Pages demo is a trial surface, not a tutorial. The tour
  // is an aria-modal overlay that wins the hit test for the WHOLE page, so on the
  // demo — which has no install signal, so it fell through to the legacy
  // empty-canvas judgment — the tour blocked every pointer gesture: you could not
  // create a box, not enter one, and right-click "back" silently no-opped because
  // currentLargeBoxId was still null. Root cause is the overlay, NOT right-click
  // (verified: exit-to-canvas works once the overlay is gone), and conn-line
  // right-click delete was already removed years ago (conn-layer.js comment) —
  // there is no other contextmenu interceptor.
  //
  // __BOXING_DEMO__ is injected at BUILD time by build-demo.mjs as its own classic
  // script next to chrome-stub.js — deliberately not inline, because index.html's
  // CSP is `script-src 'self'` (SEC-15) and an inline flag would be blocked; and
  // deliberately a classic script in <head>, so the flag is set before the
  // deferred ntp.js module executes (no DOMContentLoaded wait, no init race).
  //
  // The runtime.id check is a defensive second condition only — chrome-stub.js
  // keeps reporting its real id; the build-time flag is the single source.
  //
  // The file:// debug lane is deliberately NOT suppressed: it has no
  // __BOXING_DEMO__, so the empty-canvas judgment still shows the tour there and
  // that debugging entry point keeps working (deliberate negative constraint).
  export function initOnboarding(trigger = {}) {
    const demoReason = demoSuppressionReason();
    if (demoReason) {
      if (typeof debug === 'function') debug('onboarding', 'suppressed for Pages demo (' + demoReason + ')');
      return;
    }
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    // Trigger by the onInstalled signal (install/update distinction) instead of judging
    // fresh install on every init. reason 'install' → tour if not completed; 'update' → suppressed;
    // no signal (file:// mock lane) → legacy judgment keeps the debug/test lane alive (ticket 03).
    const reason = trigger.reason || null;
    const freshInstall = reason === 'install' ? !layout.settings.onboardingCompleted
      : reason === 'update' ? false
      : (!layout.settings.onboardingCompleted && Array.isArray(layout.boxes) && layout.boxes.length === 0);
    if (!freshInstall) { return; }
    openTour('first-run', overlay);
  }

  // ── shared tour machinery (first run + replay, ticket 45) ──────────────
  // One overlay, one set of controls. tourMode is the only difference:
  //   'first-run' → language picker visible; closeTour() writes onboardingCompleted + saveLayout().
  //   'replay'    → language picker hidden; starts at step 1; closeTour() leaves
  //                 the saved completion state and the stored layout untouched.
  let tourOverlay = null;
  let tourSteps = [];
  let tourDots = [];
  let tourPrevBtn = null;
  let tourNextBtn = null;
  let tourCurrent = 0;
  let tourMode = 'first-run';
  let tourControlsBound = false;

  function renderTour() {
    tourSteps.forEach((el, i) => { el.hidden = i !== tourCurrent; });
    tourDots.forEach((d, i) => { d.classList.toggle('is-active', i === tourCurrent); });
    if (tourPrevBtn) tourPrevBtn.disabled = tourCurrent === 0;
    if (tourNextBtn) {
      const last = tourCurrent === tourSteps.length - 1;
      tourNextBtn.textContent = last ? (i18n('onboardingFinish') || 'Get started') : (i18n('onboardingNext') || 'Next');
    }
  }

  function closeTour(commit) {
    // WCAG 2.1.2 No Keyboard Trap (Level A): the tour is a modal, so Escape must
    // dismiss it. The listener is mounted ONLY while the overlay is open and torn
    // down on close, so it can never outlive the modal or interfere with canvas
    // Escape semantics (ntp.js onKeyDown: Escape = exit box / clear search).
    // Capture phase + stopPropagation makes it win over that document-level
    // bubble-phase handler when both would fire.
    detachOverlayKeydown();
    if (!tourOverlay) return;
    tourOverlay.hidden = true;
    // Ticket 45: a replay must be harmless. It never writes the completion flag
    // (even when the stored flag is still false) and never triggers a cross-tab
    // layout save.
    if (tourMode !== 'replay') {
      layout.settings.onboardingCompleted = true;
      saveLayout();
      // Bug 1 fix: refresh canvas + caption after onboarding so i18n updates immediately.
      // A replay has no i18n change to publish, and re-rendering the canvas would
      // blur the About entry the keyboard user just activated.
      renderCanvas();
      updateCaption();
    }
    debug('onboarding', tourMode === 'replay' ? 'replay closed' : commit ? 'completed' : 'skipped');
  }

  function onOverlayKeydown(e) {
    if (e.key !== 'Escape') return;
    // Self-heal: the overlay can be hidden WITHOUT going through closeTour() —
    // the __boxingDebug.skipOnboarding() hook sets .hidden directly, and any
    // future caller may do the same. A capture-phase listener that outlived a
    // hidden overlay would swallow EVERY Escape in the app (title-restore,
    // search-clear, exit-box), because stopPropagation at capture runs before
    // all of those bubble-phase handlers. So: if the modal is already closed,
    // detach and let the event through untouched.
    if (tourOverlay && tourOverlay.hidden) { detachOverlayKeydown(); return; }
    e.preventDefault();
    e.stopPropagation();
    closeTour(false);
  }

  function attachOverlayKeydown() {
    document.addEventListener('keydown', onOverlayKeydown, true);
  }

  function detachOverlayKeydown() {
    document.removeEventListener('keydown', onOverlayKeydown, true);
  }

  // Bind the overlay controls exactly once. Both the first run and any number of
  // replays drive the same nodes; re-binding per open would stack listeners and
  // make one click advance two steps.
  function ensureTourControlsBound(overlay) {
    if (tourControlsBound) return;
    tourControlsBound = true;
    tourOverlay = overlay;
    tourSteps = Array.from(overlay.querySelectorAll('.onboarding__step'));
    tourDots = Array.from(overlay.querySelectorAll('.onboarding__dot'));
    tourPrevBtn = document.getElementById('onboarding-prev-btn');
    tourNextBtn = document.getElementById('onboarding-next-btn');
    const skipBtn = document.getElementById('onboarding-skip-btn');

    tourPrevBtn?.addEventListener('click', () => { if (tourCurrent > 0) { tourCurrent--; renderTour(); } });
    tourNextBtn?.addEventListener('click', () => {
      if (tourCurrent < tourSteps.length - 1) { tourCurrent++; renderTour(); }
      else { closeTour(true); }
    });
    skipBtn?.addEventListener('click', () => closeTour(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeTour(false); });

    // +: onboarding data-restore shortcut — opens Settings > Data and triggers the import
    // file picker so users with an existing JSON backup can pull it in on first run without hunting menus.
    try {
      const restoreBtn = document.getElementById('onboarding-restore-btn');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
          try { closeTour(false); } catch (e) { /* silent: window.close may be blocked */ }
          try {
            if (typeof openSettingsModal === 'function') openSettingsModal();
            const tabBtn = document.querySelector('.settings-nav__item[data-tab="data"]');
            if (tabBtn) tabBtn.click();
            const importBtn = document.getElementById('import-data-btn');
            if (importBtn) importBtn.click();
          } catch (e) { debugErr('onboarding restore open', e); }
        });
      }
    } catch (e) { debugErr('onboarding restore bind', e); }
    // build onboarding language picker — mirrors the Settings lang-select list.
    try {
      const onbLang = document.getElementById('onboarding-lang-select');
      const ONB_LANG_LABELS = { en: 'English', zh_CN: '简体中文', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', pt_BR: 'Português (Brasil)', ru: 'Русский', ar: 'العربية', hi: 'हिन्दी', th: 'ไทย', vi: 'Tiếng Việt', zh_TW: '繁體中文' };
      if (onbLang) {
        if (!onbLang.options.length) {
          for (const code of SUPPORTED_LANGS) {
            const o = document.createElement('option');
            o.value = code; o.textContent = ONB_LANG_LABELS[code] || code;
            if (code === (layout.settings.selectedLanguage || currentLang)) o.selected = true;
            onbLang.appendChild(o);
          }
        }
        onbLang.addEventListener('change', async () => {
          layout.settings.selectedLanguage = onbLang.value;
          await loadI18nStore(onbLang.value);
          if (langSelect) langSelect.value = onbLang.value;
          renderTour();
          if (typeof applyI18n === 'function') applyI18n();
          if (typeof updateAutohideUI === 'function') updateAutohideUI();
          saveLayout();
          debug('onboarding lang changed', onbLang.value);
        });
      }
    } catch (el) { debugErr('onboarding lang setup', el); }
  }

  // Open the shared overlay in one of the two modes (ticket 45). The first run
  // keeps the language picker; a replay hides it and always starts at step 1.
  function openTour(mode, overlay) {
    const el = overlay || document.getElementById('onboarding-overlay');
    if (!el) return;
    tourMode = mode;
    tourOverlay = el;
    ensureTourControlsBound(el);
    const langWrap = document.getElementById('onboarding-lang-wrap');
    if (langWrap) langWrap.hidden = mode === 'replay';
    tourCurrent = 0;
    el.hidden = false;
    // Mounted here, i.e. exactly when the overlay becomes visible (mounted only
    // while the tour is open, never permanently).
    attachOverlayKeydown();
    renderTour();
  }

  // Ticket 45: Settings > About "Show the tour" entry. Bind it here (not in
  // settings-ui.js) because import-graph-guard B-9 forbids settings-ui.js →
  // onboarding.js; ntp.js calls this next to initOnboarding().
  // On the demo build the tour is suppressed, so the entry must be hidden and
  // left unbound — the demo must never show a dead control.
  export function initTourReplayEntry() {
    const btn = document.getElementById('about-show-tour');
    if (demoSuppressionReason()) {
      // The `[hidden]` pair for this control lives in settings.css; the demo
      // still gets the semantic hidden state and no click listener.
      if (btn) btn.hidden = true;
      return;
    }
    if (!btn) return;
    btn.addEventListener('click', () => { openTour('replay'); });
  }
