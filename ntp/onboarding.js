// Boxing — onboarding module (ticket 10, architecture-recovery).
// First-run guided tour. ADR-0016 trigger model: background.js persists boxingInstallSignal on
// chrome.runtime.onInstalled (reason install|update); ntp.js init() consumes the signal and calls
// initOnboarding({ reason }). reason 'install' → tour when not completed; 'update' → suppressed;
// missing signal (file:// mock lane) → legacy empty-canvas fresh-install judgment (tests alive).
// Moved verbatim from ntp.js except the trigger lines — the one deliberate behavior change of
// this ticket (issue 10: onboarding triggered by onInstalled, not per-init determination).

import { layout } from './state.js';
import { saveLayout } from './storage.js';
import { i18n, loadI18nStore, applyI18n, currentLang, SUPPORTED_LANGS } from './i18n.js';
import { renderCanvas, updateAutohideUI } from './render.js';
import { openSettingsModal } from './settings-ui.js';

let debug, debugErr, updateCaption, langSelect;

// Ticket 10: inject ntp.js-scope deps (loggers + caption updater + shared langSelect ref).
export function initOnboardingFacade(deps) {
  debug = deps.debug; debugErr = deps.debugErr; updateCaption = deps.updateCaption; langSelect = deps.langSelect;
}

  // ── BX-ONBOARDING: first-run guided tour ───────────────────────────────
  // BX-D-009 (bug3): the Pages demo is a trial surface, not a tutorial. The tour
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
  // that debugging entry point keeps working (D-009 negative constraint).
  export function initOnboarding(trigger = {}) {
    try {
      if (window.__BOXING_DEMO__ === true) {
        if (typeof debug === 'function') debug('onboarding', 'suppressed for Pages demo (__BOXING_DEMO__)');
        return;
      }
      const rid = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id)
        || (typeof browser !== 'undefined' && browser.runtime && browser.runtime.id);
      if (rid === 'boxing-pages-demo') {
        if (typeof debug === 'function') debug('onboarding', 'suppressed for Pages demo (runtime.id)');
        return;
      }
    } catch (e) { if (typeof debugErr === 'function') debugErr('onboarding demo probe', e); }
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    // ADR-0016: trigger by the onInstalled signal (install/update distinction) instead of judging
    // fresh install on every init. reason 'install' → tour if not completed; 'update' → suppressed;
    // no signal (file:// mock lane) → legacy judgment keeps the debug/test lane alive (ticket 03).
    const reason = trigger.reason || null;
    const freshInstall = reason === 'install' ? !layout.settings.onboardingCompleted
      : reason === 'update' ? false
      : (!layout.settings.onboardingCompleted && Array.isArray(layout.boxes) && layout.boxes.length === 0);
    if (!freshInstall) { return; }
    const steps = Array.from(overlay.querySelectorAll('.onboarding__step'));
    const dots = Array.from(overlay.querySelectorAll('.onboarding__dot'));
    const prevBtn = document.getElementById('onboarding-prev-btn');
    const nextBtn = document.getElementById('onboarding-next-btn');
    const skipBtn = document.getElementById('onboarding-skip-btn');
    let current = 0;
    function render() {
      steps.forEach((el, i) => { el.hidden = i !== current; });
      dots.forEach((d, i) => { d.classList.toggle('is-active', i === current); });
      if (prevBtn) prevBtn.disabled = current === 0;
      if (nextBtn) {
        const last = current === steps.length - 1;
        nextBtn.textContent = last ? (i18n('onboardingFinish') || 'Get started') : (i18n('onboardingNext') || 'Next');
      }
    }
    function close(commit) {
      // WCAG 2.1.2 No Keyboard Trap (Level A): the tour is a modal, so Escape must
      // dismiss it. The listener is mounted ONLY while the overlay is open and torn
      // down on close, so it can never outlive the modal or interfere with canvas
      // Escape semantics (ntp.js onKeyDown: Escape = exit box / clear search).
      // Capture phase + stopPropagation makes it win over that document-level
      // bubble-phase handler when both would fire (D-009④).
      detachOverlayKeydown();
      overlay.hidden = true;
      layout.settings.onboardingCompleted = true;
      saveLayout();
      // Bug 1 fix: refresh canvas + caption after onboarding so i18n updates immediately
      renderCanvas();
      updateCaption();
      debug('onboarding', commit ? 'completed' : 'skipped');
    }
    function onOverlayKeydown(e) {
      if (e.key !== 'Escape') return;
      // Self-heal: the overlay can be hidden WITHOUT going through close() —
      // the __boxingDebug.skipOnboarding() hook sets .hidden directly, and any
      // future caller may do the same. A capture-phase listener that outlived a
      // hidden overlay would swallow EVERY Escape in the app (title-restore,
      // search-clear, exit-box), because stopPropagation at capture runs before
      // all of those bubble-phase handlers. So: if the modal is already closed,
      // detach and let the event through untouched.
      if (overlay.hidden) { detachOverlayKeydown(); return; }
      e.preventDefault();
      e.stopPropagation();
      close(false);
    }
    function attachOverlayKeydown() {
      document.addEventListener('keydown', onOverlayKeydown, true);
    }
    function detachOverlayKeydown() {
      document.removeEventListener('keydown', onOverlayKeydown, true);
    }
    prevBtn?.addEventListener('click', () => { if (current > 0) { current--; render(); } });
    nextBtn?.addEventListener('click', () => {
      if (current < steps.length - 1) { current++; render(); }
      else { close(true); }
    });
    skipBtn?.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    // BX-DEV-111O+: onboarding data-restore shortcut — opens Settings > Data and triggers the import
    // file picker so users with an existing JSON backup can pull it in on first run without hunting menus.
    try {
      const restoreBtn = document.getElementById('onboarding-restore-btn');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
          try { close(false); } catch (e) { /* silent: window.close may be blocked */ }
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
    // BX-DEV-111O: build onboarding language picker — mirrors the Settings lang-select list.
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
         render();
         if (typeof applyI18n === 'function') applyI18n();
         if (typeof updateAutohideUI === 'function') updateAutohideUI();
         saveLayout();
         debug('onboarding lang changed', onbLang.value);
        });
      }
    } catch (el) { debugErr('onboarding lang setup', el); }
    overlay.hidden = false;
    // Mounted here, i.e. exactly when the overlay becomes visible (D-009④: mounted
    // only while the tour is open, never permanently).
    attachOverlayKeydown();
    render();
  }
