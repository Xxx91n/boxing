// Boxing — settings UI module (ticket 10, architecture-recovery).
// Settings modal open/close + DOM binding for the general/appearance/data tabs: tab switching,
// language / remember-last-pos / url-open-mode / conn-delete-action / zoom / font / dark-mode /
// square-corners / theme-pack controls, JSON export+import (SEC-06 caps), diagnostics surface,
// confirm-modal events. ADR-0016: presentation layer — persistence only via the ./storage.js
// facade (saveLayout/saveLayoutDebounced), never chrome.storage directly. Moved verbatim from
// ntp.js (byte-exact except `export` prefixes, facade glue, and the bindSettingsUi() wrapper).

import { layout, canvasZoom, currentLargeBoxId, setLayout, setCanvasZoom, setInnerZoom, setSelectedConnId, setConfirmCallback, confirmCallback, MAX_LARGE_BOXES, MAX_SMALL_BOXES, MAX_BOOKMARKS } from './state.js';
import { saveLayout, saveLayoutDebounced, listSnapshots, listCorruptArchives, saveSnapshot, archiveConflictLayouts, listConflictArchives, readDrBodies } from './storage.js';
import { migrateLayout, normalizeBookmarkUrl, mergeImportedLayout, unwrapExportEnvelope } from './utils.js';
import { i18n, applyI18n, loadI18nStore } from './i18n.js';
import { applyTheme } from './persist.js';
import { getLargeBox, renderInnerSurface, renderCrumbs, renderCanvas, updateAutohideUI, applyCanvasTransform, applyInnerTransform, exitToCanvas, _execDeleteLargeBox, _execDeleteSmallBox } from './render.js';
import { disposeAllConns, ensureConnArrays, applyConnDeleteKeydoc, renderConnections } from './conn-layer.js';

let debug, debugErr, debugWarn, updateCaption;
let settingsModal, modalClose, langSelect, rememberCheck, urlOpenModeSelect, connDeleteActionSelect, fontSlider, fontSliderVal, zoomSlider, zoomSliderVal, darkModeCB, darkModeBtn, confirmModal, confirmTitle, confirmBody, confirmCancel, confirmDelete, appEl, exportBtn, exportFullBtn, importBtn, importFile, diagExportLogBtn, diagClearLogBtn, diagLogLevelSelect;

// Ticket 10: inject ntp.js-scope deps (loggers + caption updater + shared DOM refs declared once in ntp.js).
export function initSettingsUiFacade(deps) {
  debug = deps.debug; debugErr = deps.debugErr; debugWarn = deps.debugWarn; updateCaption = deps.updateCaption;
  settingsModal = deps.settingsModal; modalClose = deps.modalClose; langSelect = deps.langSelect;
  rememberCheck = deps.rememberCheck; urlOpenModeSelect = deps.urlOpenModeSelect; connDeleteActionSelect = deps.connDeleteActionSelect;
  fontSlider = deps.fontSlider; fontSliderVal = deps.fontSliderVal; zoomSlider = deps.zoomSlider; zoomSliderVal = deps.zoomSliderVal;
  darkModeCB = deps.darkModeCB; darkModeBtn = deps.darkModeBtn; confirmModal = deps.confirmModal;
  confirmTitle = deps.confirmTitle; confirmBody = deps.confirmBody; confirmCancel = deps.confirmCancel; confirmDelete = deps.confirmDelete;
  appEl = deps.appEl; exportBtn = deps.exportBtn; exportFullBtn = deps.exportFullBtn; importBtn = deps.importBtn; importFile = deps.importFile;
  diagExportLogBtn = deps.diagExportLogBtn; diagClearLogBtn = deps.diagClearLogBtn; diagLogLevelSelect = deps.diagLogLevelSelect;
}

  export function syncSettingsDOM() {
    if (typeof langSelect !== 'undefined' && langSelect) langSelect.value = layout.settings.selectedLanguage || 'en';
    if (typeof rememberCheck !== 'undefined' && rememberCheck) rememberCheck.checked = layout.settings.rememberLastPos !== false;
    if (typeof urlOpenModeSelect !== 'undefined' && urlOpenModeSelect) urlOpenModeSelect.value = layout.settings.urlOpenMode || 'sameTab';
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
  // Ticket 43 (spec D3): data-health surface — snapshot count / latest snapshot time /
  // corrupt-archive entry row. Reads via the storage facade (listSnapshots /
  // listCorruptArchives); refreshed on every modal open, fire-and-forget (never blocks
  // the modal). Corrupt row stays hidden unless crash-rescue actually forked a damaged
  // main key — persistent entry point instead of a startup popup (ABP one-notice lesson).
  export async function refreshDataHealth() {
    try {
      const snapCountEl = document.getElementById('data-snapshot-count');
      const lastSnapEl = document.getElementById('data-last-snapshot-time');
      const corruptRow = document.getElementById('data-corrupt-row');
      const corruptCountEl = document.getElementById('data-corrupt-count');
      const corruptTimeEl = document.getElementById('data-corrupt-time');
      const snaps = await listSnapshots();
      if (snapCountEl) snapCountEl.textContent = String(snaps.length);
      if (lastSnapEl) {
        const latest = snaps.length ? snaps[snaps.length - 1] : null;
        lastSnapEl.textContent = (latest && latest.ts) ? new Date(latest.ts).toLocaleString() : i18n('neverText');
      }
      const corrupt = await listCorruptArchives();
      if (corruptRow) {
        if (corrupt.length > 0) {
          const latestCorrupt = corrupt[corrupt.length - 1];
          if (corruptCountEl) corruptCountEl.textContent = String(corrupt.length);
          if (corruptTimeEl && latestCorrupt && latestCorrupt.ts) corruptTimeEl.textContent = new Date(latestCorrupt.ts).toLocaleString();
          corruptRow.hidden = false;
        } else {
          corruptRow.hidden = true;
        }
      }
      // Ticket 44: conflict-copy row — import/sync conflicts archived (never silently dropped)
      const conflictRow = document.getElementById('data-conflict-row');
      const conflictCountEl = document.getElementById('data-conflict-count');
      const conflictTimeEl = document.getElementById('data-conflict-time');
      const conflicts = await listConflictArchives();
      if (conflictRow) {
        if (conflicts.length > 0) {
          const latestConflict = conflicts[conflicts.length - 1];
          if (conflictCountEl) conflictCountEl.textContent = String(conflicts.length);
          if (conflictTimeEl && latestConflict && latestConflict.ts) conflictTimeEl.textContent = new Date(latestConflict.ts).toLocaleString();
          conflictRow.hidden = false;
        } else {
          conflictRow.hidden = true;
        }
      }
    } catch (e) { if (typeof debugWarn === 'function') debugWarn('refreshDataHealth', e); }
  }

  export function openSettingsModal() {
    debug('openSettingsModal called, current hidden=' + settingsModal.hidden);
    settingsModal.hidden = false;
    debug('openSettingsModal set hidden=false, now=' + settingsModal.hidden + ' display=' + getComputedStyle(settingsModal).display);
    syncSettingsDOM();
    refreshDataHealth();
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
    confirmDelete.textContent = i18n('confirmYes'); // ticket 44: reset action label (import flow relabels it per stage)
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

  // Ticket 44: promise wrapper over the shared confirm modal (in-page, same surface as
  // openConfirmModal). Resolves 'action' on the accent button, 'dismiss' on cancel or
  // backdrop click. One-shot listeners are removed on settle; the delete flow's
  // confirmCallback stays null here so the static callback path never double-fires.
  function askConfirmModal(title, body, actionLabel) {
    return new Promise(resolve => {
      let settled = false;
      const settle = (v) => {
        if (settled) return; settled = true;
        confirmDelete.removeEventListener('click', onAction);
        confirmCancel.removeEventListener('click', onDismiss);
        confirmModal.removeEventListener('click', onBackdrop);
        closeConfirmModal();
        resolve(v);
      };
      const onAction = () => settle('action');
      const onDismiss = () => settle('dismiss');
      const onBackdrop = (e) => { if (e.target === confirmModal) settle('dismiss'); };
      confirmTitle.textContent = title;
      confirmBody.textContent = body;
      confirmDelete.textContent = actionLabel;
      confirmDelete.addEventListener('click', onAction);
      confirmCancel.addEventListener('click', onDismiss);
      confirmModal.addEventListener('click', onBackdrop);
      confirmModal.hidden = false;
    });
  }


// Init-time wiring, called from ntp.js init() at the position of the original statement blocks.
export function bindSettingsUi() {
    // Ticket 08 (2026.9.12): footer version reflects the manifest version_name at runtime so it
    // can never drift again; static markup stays the fallback for the file:// mock lane
    // (no extension chrome API there — SEC-01: read-only, never defines globals).
    try {
      const versionEl = document.querySelector('.modal__version');
      const manifest = globalThis.chrome?.runtime?.getManifest?.();
      const ver = manifest?.version_name || manifest?.version;
      if (versionEl && ver) versionEl.textContent = 'Boxing v' + ver;
    } catch { /* keep static fallback */ }
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
    // BX-DEV-120 + ticket 11: urlOpenMode — default 'sameTab' so bookmarks open in the current tab unless the user explicitly picks New Tab.
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
    // Ticket 51 (spec W6-D2 / D-006 hybrid strategy): the DEFAULT export is a clean
    // envelope — current main layout + lightweight meta index (snap.v1 / corrupt /
    // conflict entries, NO bodies; pg_dump-vs-WAL separation per the 2026-09-12
    // atomcode export research). The optional second button exports the FULL DR
    // package: the same envelope plus verbatim _bodies, size-estimated before
    // download and trimmed to stay inside the 5MB import cap (oldest snapshot
    // bodies drop first; indices always survive). Filename per spec:
    // boxing-backup-YYYYMMDD.json. Import accepts both this envelope and the
    // legacy bare-layout dumps (see the unwrap in the import handler).
    function _ymd() {
      const d = new Date();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return String(d.getFullYear()) + m + day;
    }
    async function buildExportEnvelope() {
      const snaps = await listSnapshots();
      const corrupt = await listCorruptArchives();
      const conflicts = await listConflictArchives();
      return {
        _exportedAt: new Date().toISOString(),
        meta: {
          schemaVersion: layout.schemaVersion || 1,
          fullPackage: false,
          snapshots: snaps,
          corrupt: corrupt,
          conflicts: conflicts
        },
        layout: Object.assign({}, layout)
      };
    }
    function downloadJson(text, name) {
      const blob = new Blob([text], { type: 'application/json; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    async function doExportEnvelope(fullPackage) {
      try {
        const env = await buildExportEnvelope();
        let text = JSON.stringify(env, null, 2);
        if (fullPackage) {
          env.meta.fullPackage = true;
          env._bodies = await readDrBodies();
          // Size estimate + 5MB handling (SEC-06 parity: the importer rejects
          // payloads it cannot land; a full package must stay restorable, not
          // maximal).
          const CAP = 5 * 1024 * 1024;
          text = JSON.stringify(env, null, 2);
          while (text.length > CAP && env._bodies.snapshots.length > 0) {
            env._bodies.snapshots.shift(); // oldest body drops first
            env.meta.bodyTrimmed = (env.meta.bodyTrimmed || 0) + 1;
            text = JSON.stringify(env, null, 2);
          }
          if (text.length > CAP) {
            // even metadata-only is too big (huge live layout) — fall back to the
            // standard envelope so the user still gets a clean, importable export.
            debug('Full DR package exceeds 5MB after trim — falling back to standard envelope');
            try { alert(i18n('exportFullOverflow')); } catch (_) { /* alert may be blocked */ }
            const plain = await buildExportEnvelope();
            text = JSON.stringify(plain, null, 2);
          }
        }
        downloadJson(text, 'boxing-backup-' + _ymd() + '.json');
        debug('Export done — fullPackage=' + Boolean(fullPackage) + ' bytes=' + text.length);
      } catch (e) { debugErr('export failed', e); }
    }
    exportBtn?.addEventListener('click', () => { void doExportEnvelope(false); });
    exportFullBtn?.addEventListener('click', () => { void doExportEnvelope(true); });

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
        let data = JSON.parse(cleanText);
        // Ticket 51 (spec W6-D2): unwrap the export envelope — { _exportedAt, meta,
        // layout[, _bodies] } lands as the bare layout, so a default-envelope or
        // full-DR-package export round-trips back through the unchanged merge /
        // overwrite pipeline below (AC: envelope import restores the current
        // layout). Legacy bare dumps (boxes at top level) skip the unwrap entirely.
        // The package's _bodies and meta are ignored on import; the SEC-06 depth
        // cap applies to the LAYOUT payload (what reaches storage), not the index.
        const unwrapped = unwrapExportEnvelope(data);
        if (unwrapped) data = unwrapped;
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
        // Ticket 44 (spec D4): JSON import defaults to Raindrop-style append-merge — local
        // bookmarks are never silently dropped; same-id divergence is archived as a
        // conflict copy instead of overwriting. The classic full replace survives ONLY as
        // an explicit two-stage overwrite-restore with a pre-snapshot, and stays the
        // behavior for an empty canvas (nothing can be overwritten there).
        const incoming = migrateLayout(data);
        let importMode = 'merge';
        let importStats = null;
        const localBoxCount = Array.isArray(layout.boxes) ? layout.boxes.length : 0;
        const savedConns = Array.isArray(layout.connections) ? layout.connections : [];
        if (localBoxCount === 0) {
          // A5: savedGroups guard removed (groups derived from box.isParent)
          setLayout(incoming);
          // AUD-SEC: preserve local connections if the import file lacks them
          // (older backups predate the connections system; full replace would lose user lines).
          if (!Array.isArray(layout.connections) || layout.connections.length === 0) layout.connections = savedConns;
          importMode = 'replace-empty';
        } else {
          const mergePlan = mergeImportedLayout(layout, incoming);
          importStats = mergePlan.stats;
          closeSettingsModal(); // don't stack the decision modal behind the settings overlay
          const mergeDecision = await askConfirmModal(
            i18n('importMergeTitle'),
            i18n('importMergeBody', [importStats.added, importStats.conflicted, importStats.skipped]),
            i18n('importBtnMerge')
          );
          if (mergeDecision === 'action') {
            if (mergePlan.conflicts.length) {
              await archiveConflictLayouts({ boxes: mergePlan.conflicts }, { reason: 'import-merge', side: 'incoming' });
            }
            setLayout(mergePlan.merged);
          } else {
            const overwriteDecision = await askConfirmModal(
              i18n('importOverwriteTitle'),
              i18n('importOverwriteBody'),
              i18n('importBtnOverwrite')
            );
            if (overwriteDecision !== 'action') { debug('Import aborted by user — silent replace is no longer a default'); importFile.value = ''; return; }
            importMode = 'overwrite-confirmed';
            await saveSnapshot(); // COW before destructive replace (ADR-0009 / atomcode 4.1-1)
            setLayout(incoming);
            if (!Array.isArray(layout.connections) || layout.connections.length === 0) layout.connections = savedConns;
          }
        }
        await saveLayout();
        if (currentLargeBoxId) exitToCanvas();
        exitToCanvas();  // force exit any drill-in state
        renderCanvas();
        applyCanvasTransform();
        applyInnerTransform();
        updateCaption();
        try { /* silent success — no alert needed */ } catch (e) { /* silent: no-op */ }
        debug('Import succeeded — mode=' + importMode + (importStats ? ' stats=' + JSON.stringify(importStats) : ''));
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
