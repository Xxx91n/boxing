/** Boxing — NTP persistence module (ticket 08, architecture-recovery).
 * Layout/view-state persistence extracted verbatim from ntp.js (zero-build strangler-fig):
 * tab view keys, view-state persist family (BX-DEV-111L/M/N), theme packs (ADR-0012),
 * loadSettings. Sits on top of the storage facade (./storage.js, ticket 07).
 * Diffs vs origin: 'export ' prefixes + this header/imports/initPersistFacade — nothing else.
 * Cross-scope deps are injected once via initPersistFacade() (same pattern as initStorageFacade). */
import { __selfLastWriteTs, __viewStatePersistTimers, canvasPanX, canvasPanY, canvasZoom, currentLargeBoxId, headerPinned, innerPanX, innerPanY, innerZoom, layout, setCanvasZoom, setInnerZoom } from './state.js';
import { SUPPORTED_LANGS, loadI18nStore } from './i18n.js';
import { hexToRgbTriplet } from './utils.js';
import { saveLayout } from './storage.js';

// Injected ntp.js-scope deps (set once at boot, before any runtime call).
let debugWarn, darkModeBtn, getLargeBox;
export function initPersistFacade(deps) {
  debugWarn = deps.debugWarn;
  darkModeBtn = deps.darkModeBtn;
  getLargeBox = deps.getLargeBox;
}

  export const TAB_VIEW_KEY = 'boxingTabView.v2';
  export const LAST_ACTIVE_VIEW_KEY = 'boxingLastActiveView.v2';
  // BX-DEV-111L: permanent tab-view history (survives browser restart). LRU-bounded to prevent heap blow-up.
  const TAB_VIEW_HISTORY_KEY = 'boxingTabViewHistory.v3';
  const MAX_TAB_VIEW_HISTORY = 8;
  // Per-large-box inner view state persisted into layout (auto-syncs across tabs via chrome.storage).
  export function currentViewSnapshot() {
    return {
      version: 2,
      currentLargeBoxId: currentLargeBoxId || null,
      canvasZoom, canvasPanX, canvasPanY,
      innerZoom, innerPanX, innerPanY,
      headerPinned,
      updatedAt: Date.now()
    };
  }

  export function persistViewState(includeLastActive = true) {
    const snap = currentViewSnapshot();
    const serialized = JSON.stringify(snap);
    try { sessionStorage.setItem(TAB_VIEW_KEY, serialized); } catch (e) { debugWarn('tab view save', e); }
    if (includeLastActive && layout.settings.rememberLastPos !== false) {
      try { localStorage.setItem(LAST_ACTIVE_VIEW_KEY, serialized); } catch (e) { debugWarn('last active view save', e); }
    }
    // BX-DEV-111L: permanent LRU history — survives browser close. Used as fallback when sessionStorage is gone.
    try { pushTabViewHistory(snap); } catch (e) { debugWarn('tab view history push', e); }
  }

  export function pushTabViewHistory(snap) {
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem(TAB_VIEW_HISTORY_KEY) || '[]'); } catch (_) { hist = []; }
    if (!Array.isArray(hist)) hist = [];
    // Drop stale entries older than 30 days, keep most recent MAX_TAB_VIEW_HISTORY.
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    hist = hist.filter(h => h && typeof h.updatedAt === 'number' && h.updatedAt >= cutoff);
    // Replace any entry sharing the same view signature to avoid dupes of identical state.
    const sig = snap.currentLargeBoxId + ':' + snap.canvasZoom.toFixed(3);
    hist = hist.filter(h => !h || (h.currentLargeBoxId + ':' + Number(h.canvasZoom).toFixed(3)) !== sig);
    hist.push(snap);
    if (hist.length > MAX_TAB_VIEW_HISTORY) hist = hist.slice(hist.length - MAX_TAB_VIEW_HISTORY);
    try { localStorage.setItem(TAB_VIEW_HISTORY_KEY, JSON.stringify(hist)); } catch (_) { /* quota exceeded — fail-soft; in-memory hist still valid this session */ }
  }

  export function loadFallbackTabView() {
    try {
      const hist = JSON.parse(localStorage.getItem(TAB_VIEW_HISTORY_KEY) || '[]');
      if (Array.isArray(hist) && hist.length) { const latest = hist[hist.length - 1]; return latest && typeof latest === 'object' ? latest : null; }
    } catch (e) { /* silent: tab view history parse, non-critical */ }
    return null;
  }

  window.__boxingClearTabViewHistory = function () { try { localStorage.removeItem(TAB_VIEW_HISTORY_KEY); localStorage.removeItem(LAST_ACTIVE_VIEW_KEY); localStorage.removeItem(TAB_VIEW_KEY); sessionStorage.removeItem(TAB_VIEW_KEY); } catch (e) { /* silent: localStorage clear, already gone */ } return true; };

  // BX-DEV-111N: persist the inner canvas zoom/pan into the large box record so it survives tab/browser close
  // and syncs across tabs via chrome.storage.onChanged. Cheap write — called on pan-end/zoom-end/exit.
  export function saveLargeBoxViewState(boxId) {
    if (!boxId) return;
    const lb = getLargeBox(boxId);
    if (!lb) return;
    const ts = Date.now();
    lb.viewState = { innerZoom: innerZoom, innerPanX: innerPanX, innerPanY: innerPanY, updatedAt: ts };
    // BX-DEV-111N+v2: record this tab's own write timestamp per box so applyExternalLayout
    // can compare incoming.viewState.updatedAt against what *this* tab last wrote, not
    // against layout._meta.updatedAt (which mergeConcurrentLayout already overwrote).
    try { __selfLastWriteTs.set(boxId, ts); } catch (e) { debugWarn('selfLastWriteTs set', e); }
    // Drop stale view states across all boxes (>90 days). Prune at most once per hour to
    // keep the hot path cheap during continuous pan/zoom.
    try {
      if (Date.now() - __lastViewStatePruneTs > 3600000) {
        __lastViewStatePruneTs = Date.now();
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        for (const b of layout.boxes) if (b.viewState && b.viewState.updatedAt < cutoff) delete b.viewState;
      }
    } catch (e) { debugWarn('saveLargeBoxViewState prune', e); }
    saveLayout();
  }
  window.__boxingSaveLargeBoxViewState = saveLargeBoxViewState;
  // BX-DEV-111N+v2 : millisecond-grade cross-tab viewState propagation. Per-box 80ms
  // throttle (up from 25ms) keeps pan/zoom writes under chrome.storage.sync
  // MAX_WRITE_OPERATIONS_PER_MINUTE=1200 (=20/sec) quota with a 4x safety margin.
  // Each large box has its OWN timer (Map<boxId, timerHandle>) so switching boxes
  let __lastViewStatePruneTs = 0;
  export function scheduleLargeBoxViewStatePersist(boxId) {
    if (!boxId) return;
    // Always refresh the in-memory snapshot first so even a tab that reads via
    // applyExternalLayout before the timer fires sees fresh values.
    try {
      const lb = getLargeBox(boxId);
      if (lb) lb.viewState = { innerZoom: innerZoom, innerPanX: innerPanX, innerPanY: innerPanY, updatedAt: Date.now() };
    } catch (e) { debugWarn('scheduleLargeBoxViewStatePersist snapshot', e); }
    if (__viewStatePersistTimers.has(boxId)) return;
    const handle = setTimeout(() => {
      __viewStatePersistTimers.delete(boxId);
      // saveLargeBoxViewState already updates lb.viewState + saveLayout(); reusing it
      // keeps the single-writer path and quota/error handling in one place.
      try { saveLargeBoxViewState(boxId); } catch (e) { debugWarn('throttled viewState persist', e); }
    }, 80);
    __viewStatePersistTimers.set(boxId, handle);
  }
  window.__boxingScheduleLargeBoxViewStatePersist = scheduleLargeBoxViewStatePersist;
  // BX-DEV-111N+v2 : flush all pending per-box view-state timers immediately. Called on
  // pagehide / visibilitychange=hidden / beforeunload so a tab close never loses the last
  // pan/zoom that was sitting in an 80ms timer window. Synchronous save so the browser
  // has the storage write before it tears down the page.
  export function flushPendingViewStatePersist() {
    try {
      for (const [boxId, handle] of __viewStatePersistTimers) {
        clearTimeout(handle);
        try { saveLargeBoxViewState(boxId); } catch (e) { debugWarn('flush viewState persist', e); }
      }
      __viewStatePersistTimers.clear();
    } catch (e) { debugWarn('flushPendingViewStatePersist', e); }
  }
  window.__boxingFlushPendingViewStatePersist = flushPendingViewStatePersist;
  // ═══════════════════════════════════════════════════
  // Accent Theme Manager (ADR-0012)
  // Hue-based preset + slider for user-customizable accent color
  // ═══════════════════════════════════════════════════
  // ADR-0012: Curated theme pack system — replaces free hue slider (supersedes ADR-0010)
  // 5 designer-curated themes: beige (default), graphite, coastal, forest, pure
  // Each theme stores complete warm bg ramp (9 tiers) + accent ramp (3 tiers) for light + dark.
  // User picks a theme by key — no free hue slider.
  const THEME_PACKS = {
    beige: {
      name: 'themeBeige',
      light: {
        warm: { '50': '#F1EEE8', '100': '#EEE9E1', '150': '#EBE5DB', '200': '#E0D8CB', '300': '#ECE8E0', '700': '#A89F92', '800': '#7B7167', '850': '#3B342C', '900': '#2A2520' },
        accent: { '300': '#B89878', '500': '#A08060', '600': '#6E5540' },
      },
      dark: {
        warm: { '50': '#1C1814', '100': '#242019', '150': '#27231C', '200': '#2C2820', '300': '#322E25', '700': '#928878', '800': '#A89E8E', '850': '#C4B89E', '900': '#D8D0C0' },
        accent: { '300': '#C4A882', '500': '#BFA075', '600': '#D4B88C' },
      },
    },
    graphite: {
      name: 'themeGraphite',
      light: {
        warm: { '50': '#E8E8E8', '100': '#DEDEDE', '150': '#D6D6D6', '200': '#CCCCCC', '300': '#DCDCDC', '700': '#9A9A9A', '800': '#6E6E6E', '850': '#3A3A3A', '900': '#282828' },
        accent: { '300': '#787878', '500': '#5C5C5C', '600': '#3A3A3A' },
      },
      dark: {
        warm: { '50': '#1A1A1A', '100': '#222222', '150': '#262626', '200': '#2A2A2A', '300': '#303030', '700': '#909090', '800': '#A8A8A8', '850': '#C0C0C0', '900': '#D4D4D4' },
        accent: { '300': '#A8A8A8', '500': '#989898', '600': '#B8B8B8' },
      },
    },
    coastal: {
      name: 'themeCoastal',
      light: {
        warm: { '50': '#EDF2F3', '100': '#E6EDF0', '150': '#DFE8EC', '200': '#CDDDE4', '300': '#E4EDF2', '700': '#7A99A8', '800': '#5A7B8C', '850': '#2E4452', '900': '#1E2E38' },
        accent: { '300': '#7EAAB8', '500': '#5A8A9A', '600': '#3E6A7A' },
      },
      dark: {
        warm: { '50': '#141C20', '100': '#1A242A', '150': '#1E2830', '200': '#242E36', '300': '#28343C', '700': '#8AAAB8', '800': '#A0C0CE', '850': '#BED8E4', '900': '#D4E8F0' },
        accent: { '300': '#A8C8D8', '500': '#92B4C8', '600': '#C0DCEC' },
      },
    },
    forest: {
      name: 'themeForest',
      light: {
        warm: { '50': '#EDF1EC', '100': '#E6EBE2', '150': '#DFE6DB', '200': '#CDD9C8', '300': '#E2E9DF', '700': '#7A9478', '800': '#5A7458', '850': '#2E3E2C', '900': '#1E2E1C' },
        accent: { '300': '#88BA8A', '500': '#6A9870', '600': '#4A7850' },
      },
      dark: {
        warm: { '50': '#141C14', '100': '#1A2418', '150': '#1E2820', '200': '#242E28', '300': '#28342C', '700': '#88A88C', '800': '#A0C8A4', '850': '#BED8C2', '900': '#D4E8D8' },
        accent: { '300': '#A8C8AC', '500': '#92B496', '600': '#C0DCC4' },
      },
    },
    pure: {
      name: 'themePure',
      light: {
        warm: { '50': '#F8F8F8', '100': '#F4F4F4', '150': '#F0F0F0', '200': '#E4E4E4', '300': '#E8E8E8', '700': '#A0A0A0', '800': '#747474', '850': '#3A3A3A', '900': '#1E1E1E' },
        accent: { '300': '#888888', '500': '#777777', '600': '#555555' },
      },
      dark: {
        warm: { '50': '#1A1A1A', '100': '#222222', '150': '#262626', '200': '#2C2C2C', '300': '#303030', '700': '#909090', '800': '#AAAAAA', '850': '#C4C4C4', '900': '#D4D4D4' },
        accent: { '300': '#AAAAAA', '500': '#999999', '600': '#CCCCCC' },
      },
    },
  };

  export function applyTheme(themeKey) {
    const theme = THEME_PACKS[themeKey] || THEME_PACKS.beige;
    const root = document.documentElement;
    // ADR-0012: delta-diff (pwm gpt5.6 enterprise pattern) only setProperty for changed vars
    for (const tier of Object.keys(theme.light.warm)) {
      const v = theme.light.warm[tier], vd = theme.dark.warm[tier];
      if (root.style.getPropertyValue('--color-warm-' + tier) !== v) root.style.setProperty('--color-warm-' + tier, v);
      if (root.style.getPropertyValue('--color-warm-dark-' + tier) !== vd) root.style.setProperty('--color-warm-dark-' + tier, vd);
    }
    for (const tier of ['300', '500', '600']) {
      const v = theme.light.accent[tier], vd = theme.dark.accent[tier];
      if (root.style.getPropertyValue('--color-accent-' + tier) !== v) root.style.setProperty('--color-accent-' + tier, v);
      if (root.style.getPropertyValue('--color-accent-dark-' + tier) !== vd) root.style.setProperty('--color-accent-dark-' + tier, vd);
    }
    const rgb500 = hexToRgbTriplet(theme.light.accent['500']);
    const rgbDark500 = hexToRgbTriplet(theme.dark.accent['500']);
    if (root.style.getPropertyValue('--accent-500-rgb') !== rgb500) root.style.setProperty('--accent-500-rgb', rgb500);
    if (root.style.getPropertyValue('--accent-dark-500-rgb') !== rgbDark500) root.style.setProperty('--accent-dark-500-rgb', rgbDark500);
  }

  export async function loadSettings() {
    // Auto-detect browser language on first run (English default means not user-selected)
    if (!layout.settings.selectedLanguage || layout.settings.selectedLanguage === 'en') {
      const bl = (navigator.language || navigator.userLanguage || '').replace('-', '_');
      if (SUPPORTED_LANGS.includes(bl)) layout.settings.selectedLanguage = bl;
      else { const short = bl.split('_')[0]; const match = SUPPORTED_LANGS.find(l => l.startsWith(short)); if (match) layout.settings.selectedLanguage = match; }
    }
    const lang = layout.settings.selectedLanguage || 'en';
    if (!SUPPORTED_LANGS.includes(lang)) layout.settings.selectedLanguage = 'en';
    await loadI18nStore(layout.settings.selectedLanguage);
    setCanvasZoom(layout.settings.zoomLevel || 1.0);
    setInnerZoom(layout.settings.zoomLevel || 1.0);
    const fs = layout.settings.fontSize || 14;
    document.documentElement.style.setProperty('--font-size-base', fs + 'px');

   // dark mode
   if (layout.settings.darkMode) {
     document.getElementById('app').classList.add('ntp--dark');
     document.body.classList.add('ntp--dark');
     if (darkModeBtn) darkModeBtn.querySelector('span').textContent = '☽';
   }
    // accent theme (ADR-0012) — apply curated theme pack
    if (layout.settings.theme && layout.settings.theme !== 'beige') {
      applyTheme(layout.settings.theme);
    }
   // square corners
    if (layout.settings.squareCorners) {
      document.getElementById('app').classList.add('ntp--square-corners');
    }
  }
