// Boxing — settings UI module (ticket 10, architecture-recovery).
// Settings modal open/close + DOM binding for the general/appearance/data tabs: tab switching,
// language / remember-last-pos / url-open-mode / conn-delete-action / zoom / font / dark-mode /
// square-corners / theme-pack controls, JSON export+import (SEC-06 caps), diagnostics surface,
// confirm-modal events. ADR-0016: presentation layer — persistence only via the ./storage.js
// facade (saveLayout/saveLayoutDebounced), never chrome.storage directly. Moved verbatim from
// ntp.js (byte-exact except `export` prefixes, facade glue, and the bindSettingsUi() wrapper).

import { layout, canvasZoom, currentLargeBoxId, setLayout, setCanvasZoom, setInnerZoom, setSelectedConnId, setConfirmCallback, confirmCallback, MAX_LARGE_BOXES, MAX_SMALL_BOXES, MAX_BOOKMARKS } from './state.js';
import { saveLayout, saveLayoutDebounced } from './storage.js';
import { migrateLayout, normalizeBookmarkUrl } from './utils.js';
import { i18n, applyI18n, loadI18nStore } from './i18n.js';
import { applyTheme } from './persist.js';
import { getLargeBox, renderInnerSurface, renderCrumbs, renderCanvas, updateAutohideUI, applyCanvasTransform, applyInnerTransform, disposeAllConns, ensureConnArrays, applyConnDeleteKeydoc, renderConnections, exitToCanvas, _execDeleteLargeBox, _execDeleteSmallBox } from './render.js';

let debug, debugErr, debugWarn, updateCaption;
let settingsModal, modalClose, langSelect, rememberCheck, urlOpenModeSelect, connDeleteActionSelect, fontSlider, fontSliderVal, zoomSlider, zoomSliderVal, darkModeCB, darkModeBtn, confirmModal, confirmTitle, confirmBody, confirmCancel, confirmDelete, appEl, exportBtn, importBtn, importFile, diagExportLogBtn, diagClearLogBtn, diagLogLevelSelect;

// Ticket 10: inject ntp.js-scope deps (loggers + caption updater + shared DOM refs declared once in ntp.js).
export function initSettingsUiFacade(deps) {
  debug = deps.debug; debugErr = deps.debugErr; debugWarn = deps.debugWarn; updateCaption = deps.updateCaption;
  settingsModal = deps.settingsModal; modalClose = deps.modalClose; langSelect = deps.langSelect;
  rememberCheck = deps.rememberCheck; urlOpenModeSelect = deps.urlOpenModeSelect; connDeleteActionSelect = deps.connDeleteActionSelect;
  fontSlider = deps.fontSlider; fontSliderVal = deps.fontSliderVal; zoomSlider = deps.zoomSlider; zoomSliderVal = deps.zoomSliderVal;
  darkModeCB = deps.darkModeCB; darkModeBtn = deps.darkModeBtn; confirmModal = deps.confirmModal;
  confirmTitle = deps.confirmTitle; confirmBody = deps.confirmBody; confirmCancel = deps.confirmCancel; confirmDelete = deps.confirmDelete;
  appEl = deps.appEl; exportBtn = deps.exportBtn; importBtn = deps.importBtn; importFile = deps.importFile;
  diagExportLogBtn = deps.diagExportLogBtn; diagClearLogBtn = deps.diagClearLogBtn; diagLogLevelSelect = deps.diagLogLevelSelect;
}

  export function syncSettingsDOM() {
    if (typeof langSelect !== 'undefined' && langSelect) langSelect.value = layout.settings.selectedLanguage || 'en';
    if (typeof rememberCheck !== 'undefined' && rememberCheck) rememberCheck.checked = layout.settings.rememberLastPos !== false;
    if (typeof urlOpenModeSelect !== 'undefined' && urlOpenModeSelect) urlOpenModeSelect.value = layout.settings.urlOpenMode || 'newTab';
    if (typeof connDeleteActionSelect !== 'undefined' && connDeleteActionSelect) connDeleteActionSelect.value = layout.settings.connDeleteAction || 'alt+click';
    if (typeof darkModeCB !== 'undefined' && darkModeCB) darkModeCB.checked = layout.settings.darkMode === true;
    if (typeof zoomSlider !== 'undefined' && zoomSlider) zoomSlider.value = Math.round((canvasZoom || 1.0) * 100);
    if (typeof zoomSliderVal !== 'undefined' && zoomSliderVal) zoomSliderVal.textContent = Math.round((canvasZoom || 1.0) * 100) + '%';
    if (typeof fontSlider !== 'undefined' && fontSlider) fontSlider.value = layout.settings.fontSize || 14;
    if (typeof fontSliderVal !== 'undefined' && fontSliderVal) fontSliderVal.textContent = (layout.settings.fontSize || 14) + 'px';
    const squareCB = document.getElementById('square-corners-cb');
   if (squareCB) squareCB.checked = layout.settings.squareCorners === true;
    // ADR-0012: curated theme pack UI sync
    const currentTheme = layout.settings.theme || 'beige';
    document.querySelectorAll('.theme-preset').forEach(btn => {
      btn.classList.toggle('theme-preset--active', btn.dataset.theme === currentTheme);
    });

 }

  // ── settings modal ─────────────────────────────────────
  export function openSettingsModal() {
    debug('openSettingsModal called, current hidden=' + settingsModal.hidden);
    settingsModal.hidden = false;
    debug('openSettingsModal set hidden=false, now=' + settingsModal.hidden + ' display=' + getComputedStyle(settingsModal).display);
    syncSettingsDOM();
    const firstTab = document.querySelector('.settings-nav__item');
    const lastTabId = layout.settings.lastSettingsTab || 'general';
    const targetTabBtn = document.querySelector('.settings-nav__item[data-tab="' + lastTabId + '"]');
    const tabToClick = targetTabBtn || firstTab;
    if (tabToClick) {
      document.querySelectorAll('.settings-nav__item').forEach(b => b.classList.toggle('settings-nav__item--active', b === tabToClick));
      document.querySelectorAll('.settings-tab').forEach(t => { t.hidden = t.id !== 'tab-' + tabToClick.dataset.tab; });
      document.querySelector('.settings-content')?.scrollTo({ top: 0 });
    }
  }

  export function closeSettingsModal() {
    // BX-DEV-111M: flush via the globally-exposed helper — flushUnsavedCredentials is defined inside loadSettings()'s
    // closure so the top-level closeSettingsModal cannot reference it directly. window.__boxingFlushCredentials is set
    // during loadSettings() and may be undefined on the very first open before that runs.
    try { const fn = window.__boxingFlushCredentials; if (typeof fn === 'function') fn(); } catch (e) { debugWarn('credential flush on close', e); }
    settingsModal.hidden = true;
  }

  // ── confirm modal (in-page, replaces browser confirm()) ──
  export function openConfirmModal(type, id, largeId) {
    confirmModal.hidden = false;
    confirmTitle.textContent = i18n('confirmDeleteTitle');
    const bodyText = type === 'large' ? i18n('confirmDeleteLargeBody') : i18n('confirmDeleteSmallBody');
    confirmBody.textContent = bodyText;
    setConfirmCallback(() => {
      if (type === 'large') _execDeleteLargeBox(id);
      else _execDeleteSmallBox(largeId, id);
    });
  }
  export function closeConfirmModal() {
    confirmModal.hidden = true;
    setConfirmCallback(null);
  }

// Init-time wiring, called from ntp.js init() at the position of the original statement blocks.
export function bindSettingsUi() {
    if (modalClose) modalClose.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettingsModal(); });
    // ── Settings tab switching ────────────────────
    document.querySelectorAll('.settings-nav__item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-nav__item').forEach(b => b.classList.remove('settings-nav__item--active'));
        btn.classList.add('settings-nav__item--active');
        const tabId = btn.dataset.tab;
        layout.settings.lastSettingsTab = tabId;  // BX-DEV-111k: remember last active tab
        document.querySelectorAll('.settings-tab').forEach(t => t.hidden = true);
        const tab = document.getElementById('tab-' + tabId);
        if (tab) tab.hidden = false;
        document.querySelector('.settings-content')?.scrollTo({ top: 0 });
      });
    });

    langSelect?.addEventListener('change', async () => {
      layout.settings.selectedLanguage = langSelect.value;
      await loadI18nStore(langSelect.value);
      await saveLayout();
      if (currentLargeBoxId) {
        const lb = getLargeBox(currentLargeBoxId);
        if (lb) { renderInnerSurface(lb); renderCrumbs(lb); }
        updateCaption();
      } else { renderCanvas(); }
     applyI18n();
     applyCanvasTransform();
     // ADR-0015: re-apply pin tooltip after i18n reset (applyI18n overwrites data-i18n-title)
     updateAutohideUI();
     applyInnerTransform();
    });
    rememberCheck?.addEventListener('change', () => {
      layout.settings.rememberLastPos = rememberCheck.checked;
      saveLayout();
    });
    // BX-DEV-120: urlOpenMode — default 'newTab' so bookmarks open in a new tab unless user picks Current Tab.
    urlOpenModeSelect?.addEventListener('change', () => {
      layout.settings.urlOpenMode = urlOpenModeSelect.value === 'sameTab' ? 'sameTab' : 'newTab';
      saveLayout();
    });

    connDeleteActionSelect?.addEventListener('change', () => {
      layout.settings.connDeleteAction = connDeleteActionSelect.value || 'alt+click';
      // ADR-0006: force full re-create so new-mode listeners (dblclick/contextmenu/keydoc) attach to fresh <line> elements.
      // renderConnections only registers listeners on pending (new) lines — existing connLines stay with stale mode listeners.
      setSelectedConnId(null);
      disposeAllConns();
      ensureConnArrays(); // rebuild indices after dispose
      applyConnDeleteKeydoc();
      renderConnections();
      saveLayoutDebounced();
    });
    zoomSlider?.addEventListener('input', () => {
      zoomSliderVal.textContent = zoomSlider.value + '%';
    });
    zoomSlider?.addEventListener('change', () => {
      const v = parseInt(zoomSlider.value, 10) / 100;
      setCanvasZoom(v); setInnerZoom(v);
      layout.settings.zoomLevel = v;
      applyCanvasTransform(); applyInnerTransform();
      saveLayout();
    });
    fontSlider?.addEventListener('input', () => {
      fontSliderVal.textContent = fontSlider.value + 'px';
    });
    fontSlider?.addEventListener('change', () => {
      const v = parseInt(fontSlider.value, 10);
      layout.settings.fontSize = v;
      document.documentElement.style.setProperty('--font-size-base', v + 'px');
      saveLayout();
    });

    // Dark mode toggle
    darkModeCB?.addEventListener('change', () => {
      layout.settings.darkMode = darkModeCB.checked;
      appEl.classList.toggle('ntp--dark', darkModeCB.checked);
      document.body.classList.toggle('ntp--dark', darkModeCB.checked);
      saveLayout();
    });

    // Square corners toggle
    const squareCB = document.getElementById('square-corners-cb');
    squareCB?.addEventListener('change', () => {
      layout.settings.squareCorners = squareCB.checked;
      appEl.classList.toggle('ntp--square-corners', squareCB.checked);
      saveLayout();
    });
   // apply square corners on load
   if (layout.settings.squareCorners) {
     appEl.classList.add('ntp--square-corners');
   }

    // ADR-0012: Curated theme pack — theme button click handlers
    document.querySelectorAll('.theme-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const themeKey = btn.dataset.theme;
        layout.settings.theme = themeKey;
        applyTheme(themeKey);
        document.querySelectorAll('.theme-preset').forEach(b => b.classList.remove('theme-preset--active'));
        btn.classList.add('theme-preset--active');
        saveLayout();
      });
    });

    if (darkModeBtn) {
      darkModeBtn.addEventListener('click', () => {
        layout.settings.darkMode = !layout.settings.darkMode;
        appEl.classList.toggle('ntp--dark', layout.settings.darkMode);
        document.body.classList.toggle('ntp--dark', layout.settings.darkMode);
        if (darkModeCB) darkModeCB.checked = layout.settings.darkMode;
        darkModeBtn.querySelector('span').textContent = layout.settings.darkMode ? '☽' : '☀';
        saveLayout();
      });
    }
    // Export / Import
    exportBtn?.addEventListener('click', () => {
      // BX-DEV-111f: Export includes integrity metadata
      const exportData = Object.assign({}, layout, { _exportedAt: new Date().toISOString() });
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'boxing-backup.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000);
    });

    let importPending = false;
    importBtn?.addEventListener('click', () => { importPending = true; importFile?.click(); });
    importFile?.addEventListener('change', async () => {
      if (!importPending) return; importPending = false;
      const file = importFile.files[0];
      if (!file) return;
      // BX-DEV-111f: File size sanity check — reject imports > 5MB
      if (file.size > 5 * 1024 * 1024) { try { alert(i18n('importTooLarge')); } catch (e) { /* silent: alert may be blocked */ } importFile.value = ''; return; }
      try {
        const text = await file.text();
        // BX-DEV-111f: Strip UTF-8 BOM if present
        const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
        const data = JSON.parse(cleanText);
        // BX-DEV-111f: Validate structure — must have boxes array, version field
        // SEC-06: Reject excessively large JSON payloads to prevent OOM/stack overflow
        if (JSON.stringify(data).length > 2_000_000) throw new Error('too large');
        if (!data || !Array.isArray(data.boxes)) throw new Error('invalid');
        if (data.boxes.some(b => typeof b !== 'object' || !b.id)) throw new Error('corrupt boxes');
        if (data.boxes.length > MAX_LARGE_BOXES) throw new Error('too many boxes');
        const ids = new Set();
        // Validate each box has minimum required fields
        for (const b of data.boxes) {
          if (typeof b.id !== 'string' || b.id.length > 128 || ids.has(b.id)) throw new Error('corrupt box id');
          ids.add(b.id);
          if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || Math.abs(b.x) > 100000 || Math.abs(b.y) > 100000) throw new Error('corrupt box position');
          if (typeof b.title === 'string' && b.title.length > 500) throw new Error('box title too long');
          if (b.children != null && !Array.isArray(b.children)) throw new Error('corrupt children');
          if ((b.children?.length || 0) > MAX_SMALL_BOXES) throw new Error('too many small boxes');
          for (const s of b.children || []) {
            if (typeof s?.id !== 'string' || s.id.length > 128 || ids.has(s.id)) throw new Error('corrupt small box id');
            ids.add(s.id);
            if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || Math.abs(s.x) > 100000 || Math.abs(s.y) > 100000) throw new Error('corrupt small box position');
            if (!Array.isArray(s.bookmarks || [])) throw new Error('corrupt bookmarks');
            if ((s.bookmarks?.length || 0) > MAX_BOOKMARKS) throw new Error('too many bookmarks');
            for (const bm of s.bookmarks || []) {
              if (typeof bm?.id !== 'string' || bm.id.length > 128 || ids.has(bm.id)) throw new Error('corrupt bookmark id');
              ids.add(bm.id);
              if (typeof bm.title !== 'string' || bm.title.length > 1000 || !normalizeBookmarkUrl(bm.url)) throw new Error('corrupt bookmark');
            }
          }
        }
        // BX-DEV-111f: Sanitize settings — prevent NaN/Infinity injection
        if (data.settings) {
          const s = data.settings;
          if (s.zoomLevel && !isFinite(s.zoomLevel)) s.zoomLevel = 1.0;
          if (s.fontSize && (!isFinite(s.fontSize) || s.fontSize < 8 || s.fontSize > 72)) s.fontSize = 14;
        }
        const savedConns = Array.isArray(layout.connections) ? layout.connections : [];
        // A5: savedGroups guard removed (groups derived from box.isParent)
        setLayout(migrateLayout(data));
        // AUD-SEC: preserve local connections/groups if import file lacks them
        // (older backups predate the connections system; full replace would lose user lines).
        if (!Array.isArray(layout.connections) || layout.connections.length === 0) layout.connections = savedConns;
        // A5: savedGroups restore removed
        await saveLayout();
        if (currentLargeBoxId) exitToCanvas();
        exitToCanvas();  // force exit any drill-in state
        renderCanvas();
        applyCanvasTransform();
        applyInnerTransform();
        updateCaption();
        try { /* silent success — no alert needed */ } catch (e) { /* silent: no-op */ }
        debug('Import succeeded, layout replaced');
      } catch (e) { try { alert(i18n('importFailed')); } catch (e2) { /* silent: alert may be blocked */ } }
      importFile.value = '';
    });
    // ── BX-AUD-05: diagnostics UI surface (Settings > Data > Diagnostics) ───
    diagExportLogBtn?.addEventListener('click', () => {
      try {
        const text = (window.__boxingDebug && typeof window.__boxingDebug.exportLog === 'function') ? window.__boxingDebug.exportLog() : '';
        if (!text) { try { alert(i18n('diagNoLogs') || 'No log entries yet'); } catch (e) { /* silent: alert may be blocked */ } return; }
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'boxing-log-' + ts + '.log';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000);
        debug('diag: exported log ring');
      } catch (e) { debugErr('diag: export log failed', e); }
    });
    diagClearLogBtn?.addEventListener('click', () => {
      try {
        if (window.__boxingDebug && typeof window.__boxingDebug.clearLog === 'function') {
          window.__boxingDebug.clearLog();
          debug('diag: log ring cleared by user');
        }
      } catch (e) { debugErr('diag: clear log failed', e); }
    });
    diagLogLevelSelect?.addEventListener('change', () => {
      try {
        const v = parseInt(diagLogLevelSelect.value, 10) || 2;
        if (window.__boxingDebug && typeof window.__boxingDebug.setLogLevel === 'function') {
          window.__boxingDebug.setLogLevel(v);
          layout.settings.__diagLogLevel = v;
          saveLayout();
        }
      } catch (e) { debugErr('diag: log level change failed', e); }
    });
    if (diagLogLevelSelect && layout.settings.__diagLogLevel) {
      diagLogLevelSelect.value = String(layout.settings.__diagLogLevel);
    }

    // Confirm modal events
    confirmDelete?.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirmModal();
    });
    confirmCancel?.addEventListener('click', closeConfirmModal);
    confirmModal?.addEventListener('click', e => { if (e.target === confirmModal) closeConfirmModal(); });
}
