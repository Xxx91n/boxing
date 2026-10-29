// Boxing — settings UI module (ticket 10, architecture-recovery).
// Settings modal open/close + DOM binding for the general/appearance/data tabs: tab switching,
// language / remember-last-pos / url-open-mode / conn-delete-action / zoom / font / dark-mode /
// square-corners / theme-pack controls, JSON export+import (SEC-06 caps), diagnostics surface,
// confirm-modal events. Presentation layer — persistence only via the ./storage.js
// facade (saveLayout/saveLayoutDebounced), never chrome.storage directly. Moved verbatim from
// ntp.js (byte-exact except `export` prefixes, facade glue, and the bindSettingsUi() wrapper).

import { layout, canvasZoom, currentLargeBoxId, setLayout, setCanvasZoom, setInnerZoom, setSelectedConnId, setConfirmCallback, confirmCallback, groupStar, MAX_LARGE_BOXES, MAX_SMALL_BOXES, MAX_BOOKMARKS } from './state.js';
import { saveLayout, saveLayoutDebounced, listSnapshots, listCorruptArchives, saveSnapshot, restoreFromSnapshot, replaceLayoutFromRestored, archiveConflictLayouts, listConflictArchives, getConflictArchive, listConflictGuards, saveConflictGuard, deleteConflictArchive, discardConflictGuard, restoreConflictGuard, readDrBodies } from './storage.js';
import { migrateLayout, normalizeBookmarkUrl, mergeImportedLayout, unwrapExportEnvelope, compareVersions, normalizeDarkModePref, diffConflictArchive, planConflictApply, largeKey, smallKey } from './utils.js';
import { i18n, applyI18n, loadI18nStore } from './i18n.js';
import { applyDarkMode, applyTheme, nextDarkModePreference } from './persist.js';
import { getLargeBox, renderInnerSurface, renderCrumbs, renderCanvas, updateAutohideUI, applyCanvasTransform, applyInnerTransform, exitToCanvas, _execDeleteLargeBox, _execDeleteSmallBox } from './render.js';
import { disposeAllConns, ensureConnArrays, applyConnDeleteKeydoc, renderConnections, toggleStarMark } from './conn-layer.js';
import { PRIVACY_URL, DEMO_URL } from './site-constants.js';
import { DEFAULT_AUTO_TITLE_RULES, EXTRACTION_TYPES } from './url-title.js';
import { isPassphraseBackupFile, validateBackupEnvelope, encryptBackupFile, decryptBackupFile, maxInnerBytes, utf8ByteLength, MAX_PASSPHRASE_CHARS, MAX_BACKUP_FILE_BYTES, BACKUP_ERROR_PASSPHRASE } from './backup-crypto.js';

let debug, debugErr, debugWarn, updateCaption;
let settingsModal, modalClose, langSelect, rememberCheck, urlOpenModeSelect, connDeleteActionSelect, fontSlider, fontSliderVal, zoomSlider, zoomSliderVal, darkModeGroup, darkModeBtn, confirmModal, confirmTitle, confirmBody, confirmCancel, confirmDelete, appEl, exportBtn, exportFullBtn, importBtn, importFile, diagExportLogBtn, diagClearLogBtn, diagLogLevelSelect;

// Ticket 10: inject ntp.js-scope deps (loggers + caption updater + shared DOM refs declared once in ntp.js).
export function initSettingsUiFacade(deps) {
  debug = deps.debug; debugErr = deps.debugErr; debugWarn = deps.debugWarn; updateCaption = deps.updateCaption;
  settingsModal = deps.settingsModal; modalClose = deps.modalClose; langSelect = deps.langSelect;
  rememberCheck = deps.rememberCheck; urlOpenModeSelect = deps.urlOpenModeSelect; connDeleteActionSelect = deps.connDeleteActionSelect;
  fontSlider = deps.fontSlider; fontSliderVal = deps.fontSliderVal; zoomSlider = deps.zoomSlider; zoomSliderVal = deps.zoomSliderVal;
  darkModeGroup = deps.darkModeGroup; darkModeBtn = deps.darkModeBtn; confirmModal = deps.confirmModal;
  confirmTitle = deps.confirmTitle; confirmBody = deps.confirmBody; confirmCancel = deps.confirmCancel; confirmDelete = deps.confirmDelete;
  appEl = deps.appEl; exportBtn = deps.exportBtn; exportFullBtn = deps.exportFullBtn; importBtn = deps.importBtn; importFile = deps.importFile;
  diagExportLogBtn = deps.diagExportLogBtn; diagClearLogBtn = deps.diagClearLogBtn; diagLogLevelSelect = deps.diagLogLevelSelect;
}

  // Ticket 44 (spec #41): three-value preference — the checked radio shows the
  // active mode. Legacy booleans are read through the single normalizer.
  function syncDarkModeRadios() {
    if (typeof darkModeGroup === 'undefined' || !darkModeGroup) return;
    const pref = normalizeDarkModePref(layout.settings.darkMode);
    darkModeGroup.querySelectorAll('input[name="dark-mode"]').forEach(r => { r.checked = r.value === pref; });
  }

  export function syncSettingsDOM() {
    initAboutTab();
    syncAutoTitleDOM();
    if (typeof langSelect !== 'undefined' && langSelect) langSelect.value = layout.settings.selectedLanguage || 'en';
    if (typeof rememberCheck !== 'undefined' && rememberCheck) rememberCheck.checked = layout.settings.rememberLastPos !== false;
    if (typeof urlOpenModeSelect !== 'undefined' && urlOpenModeSelect) urlOpenModeSelect.value = layout.settings.urlOpenMode || 'sameTab';
    if (typeof connDeleteActionSelect !== 'undefined' && connDeleteActionSelect) connDeleteActionSelect.value = layout.settings.connDeleteAction || 'alt+click';
    syncDarkModeRadios();
    if (typeof zoomSlider !== 'undefined' && zoomSlider) zoomSlider.value = Math.round((canvasZoom || 1.0) * 100);
    if (typeof zoomSliderVal !== 'undefined' && zoomSliderVal) zoomSliderVal.textContent = Math.round((canvasZoom || 1.0) * 100) + '%';
    if (typeof fontSlider !== 'undefined' && fontSlider) fontSlider.value = layout.settings.fontSize || 14;
    if (typeof fontSliderVal !== 'undefined' && fontSliderVal) fontSliderVal.textContent = (layout.settings.fontSize || 14) + 'px';
    const squareCB = document.getElementById('square-corners-cb');
   if (squareCB) squareCB.checked = layout.settings.squareCorners === true;
    // Curated theme pack UI sync
    const currentTheme = layout.settings.theme || 'beige';
    document.querySelectorAll('.theme-preset').forEach(btn => {
      btn.classList.toggle('theme-preset--active', btn.dataset.theme === currentTheme);
    });

 }

  // ── Ticket 50 (spec ticket 50): Time Machine helpers ───────
  const SNAPSHOT_LIST_MAX = 20; // newest-first cap; rotation retains far more, the UI stays scannable
  function formatSnapshotSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    return (Math.round(n / 102.4) / 10) + ' KB';
  }

  // ── Issue #54 (#53 D2/D3): open conflict comparisons ─────
  // One entry per open panel: the fingerprint of the CURRENT side the user actually looked
  // at (`signature`) plus the fields they moved to "adopt copy". Applying re-compares and
  // refuses when the signature moved, so a stale verdict is refreshed with every choice back
  // on keep-current instead of being written over content nobody has re-reviewed.
  const conflictPanels = new Map();

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
      // Ticket 79 (spec): conflict-copy readout list — one row per archived
      // conflict copy (ts / reason / side / size, newest first, same SNAPSHOT_LIST_MAX cap)
      // with a per-row verbatim JSON export. Rows are rebuilt on every modal open alongside
      // the Time Machine list (refreshDataHealth is the single seam).
      // Ticket 56 (#53 D3): the same rows gain a Delete action — secondary confirm, then a
      // safe copy of THIS archive's payload into the snapshot subsystem, then the deletion.
      // The rendering itself stays read-only (issue 79 AC3); only performConflictDelete writes.
      const cWrapEl = document.getElementById('data-conflict-list-wrap');
      const cListEl = document.getElementById('data-conflict-list');
      if (cWrapEl && cListEl) {
        const cRows = conflicts.slice(-SNAPSHOT_LIST_MAX).reverse();
        cListEl.textContent = '';
        // Rows are rebuilt wholesale, so any open comparison goes with them: panel state
        // the user has not seen in this list must not survive into the next render.
        conflictPanels.clear();
        for (const e of cRows) {
          const row = document.createElement('div');
          row.className = 'data-conflict-row-item';
          row.dataset.ts = String((e && e.ts) || '');
          row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:4px 0;font-size:var(--fs-xs);';
          const when = document.createElement('span');
          when.textContent = (e && e.ts) ? new Date(e.ts).toLocaleString() : '-';
          const reason = document.createElement('span');
          reason.textContent = String((e && e.reason) || '?');
          const side = document.createElement('span');
          side.textContent = String((e && e.side) || '?');
          const size = document.createElement('span');
          size.textContent = formatSnapshotSize(e && e.size);
          const actions = document.createElement('span');
          actions.style.cssText = 'margin-left:auto;display:flex;gap:6px;';
          // Issue #54 (#53 D2): the same row is the entry point for the comparison — no
          // second conflict surface, and the ticket-79 verbatim export keeps working as is.
          const cmpBtn = document.createElement('button');
          cmpBtn.type = 'button';
          cmpBtn.className = 'btn btn--ghost data-conflict-compare-btn';
          cmpBtn.style.cssText = 'padding:2px 10px;font-size:var(--fs-xs);';
          cmpBtn.dataset.ts = String((e && e.ts) || '');
          cmpBtn.textContent = i18n('dataConflictCompareBtn');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn data-conflict-export-btn';
          btn.style.cssText = 'padding:2px 10px;font-size:var(--fs-xs);';
          btn.dataset.ts = String((e && e.ts) || '');
          btn.textContent = i18n('dataConflictExportBtn');
          // Ticket 56 (#53 D3): the same row also carries Delete, gated by a secondary
          // confirm and a safe copy of THIS archive's payload taken first.
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn btn--ghost data-conflict-delete-btn';
          delBtn.style.cssText = 'padding:2px 10px;font-size:var(--fs-xs);';
          delBtn.dataset.ts = String((e && e.ts) || '');
          delBtn.textContent = i18n('dataConflictDeleteBtn');
          actions.append(cmpBtn, btn, delBtn);
          row.append(when, reason, side, size, actions);
          cListEl.appendChild(row);
        }
        cWrapEl.hidden = cRows.length === 0;
      }

      // Ticket 56 (#53 D3): safe copies kept for conflict archives the user deleted. Same
      // data tab, same list idiom — not a second conflict surface and not a recycle bin: the
      // rows only exist because a deletion was confirmed, and each restores its own archived
      // payload (never the canvas).
      const gWrapEl = document.getElementById('data-conflict-guard-wrap');
      const gListEl = document.getElementById('data-conflict-guard-list');
      if (gWrapEl && gListEl) {
        const guards = await listConflictGuards();
        const gRows = guards.slice(-SNAPSHOT_LIST_MAX).reverse();
        gListEl.textContent = '';
        for (const e of gRows) {
          const row = document.createElement('div');
          row.className = 'data-conflict-guard-row-item';
          row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:4px 0;font-size:var(--fs-xs);';
          const when = document.createElement('span');
          when.textContent = (e && e.originTs) ? new Date(e.originTs).toLocaleString() : '-';
          const kind = document.createElement('span');
          kind.textContent = i18n('dataConflictGuardArchived');
          const size = document.createElement('span');
          size.textContent = formatSnapshotSize(e && e.size);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn data-conflict-guard-restore-btn';
          btn.style.cssText = 'margin-left:auto;padding:2px 10px;font-size:var(--fs-xs);';
          btn.dataset.ts = String((e && e.ts) || '');
          btn.textContent = i18n('dataConflictGuardRestoreBtn');
          row.append(when, kind, size, btn);
          gListEl.appendChild(row);
        }
        gWrapEl.hidden = gRows.length === 0;
      }
      // Ticket 50 (spec ticket 50): Time Machine list — one row per stored snapshot (ts /
      // schemaVersion / size, newest first, last SNAPSHOT_LIST_MAX) with a per-row rollback
      // button. Rows are rebuilt on every modal open (refreshDataHealth is the single seam).
      const tmEl = document.getElementById('data-snapshot-timemachine');
      const listEl = document.getElementById('data-snapshot-list');
      if (tmEl && listEl) {
        const rows = snaps.slice(-SNAPSHOT_LIST_MAX).reverse();
        listEl.textContent = '';
        for (const e of rows) {
          const row = document.createElement('div');
          row.className = 'data-snapshot-row';
          row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:4px 0;font-size:var(--fs-xs);';
          const when = document.createElement('span');
          when.textContent = (e && e.ts) ? new Date(e.ts).toLocaleString() : '-';
          const ver = document.createElement('span');
          ver.textContent = 'v' + ((e && e.schemaVersion != null) ? e.schemaVersion : '?');
          const size = document.createElement('span');
          size.textContent = formatSnapshotSize(e && e.size);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn data-snapshot-rollback-btn';
          btn.style.cssText = 'margin-left:auto;padding:2px 10px;font-size:var(--fs-xs);';
          btn.dataset.ts = String((e && e.ts) || '');
          btn.textContent = i18n('dataRollbackBtn');
          row.append(when, ver, size, btn);
          listEl.appendChild(row);
        }
        tmEl.hidden = rows.length === 0;
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
      if (tabToClick.dataset.tab === 'about') checkVersionUpdate();
    }
  }

  export function closeSettingsModal() {
    // flush via the globally-exposed helper — flushUnsavedCredentials is defined inside loadSettings()'s
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

  // ── Issue #57 (spec #53 D4): passphrase dialog for manual backup files ──────────
  // Same in-page surface and one-shot-listener shape as askConfirmModal. Resolves
  // { dismiss: true } on cancel/backdrop/Escape, or { passphrase } once the typing passes the
  // dialog's own input bounds. mode 'export' asks for the passphrase twice (a mistyped key
  // would seal the file shut); mode 'decrypt' asks once and can reopen with `initialError`
  // after a failed open. Fields are cleared on every settle: the passphrase lives only as
  // long as the click that asked for it, and never reaches storage, a log or the sync payload.
  // One dialog at a time. The overlay does not trap Tab (neither does the confirm modal), so
  // focus can leave it; a second export click while the first dialog is still open would
  // otherwise stack a new listener set on the same buttons and leave the FIRST promise with no
  // way to settle. A re-request therefore resolves 'dismiss' immediately and leaves the open
  // dialog exactly as it was.
  let passphraseDialogOpen = false;

  function askPassphraseModal(mode, initialError) {
    if (passphraseDialogOpen) return Promise.resolve({ dismiss: true });
    return new Promise(resolve => {
      const modal = document.getElementById('passphrase-modal');
      const titleEl = document.getElementById('passphrase-title');
      const bodyEl = document.getElementById('passphrase-body');
      const inputEl = document.getElementById('passphrase-input');
      const repeatEl = document.getElementById('passphrase-repeat-input');
      const errorEl = document.getElementById('passphrase-error');
      const actionEl = document.getElementById('passphrase-action-btn');
      const cancelEl = document.getElementById('passphrase-cancel-btn');
      // Where the user was standing before this dialog steals focus — keyboard and
      // screen-reader users get their place back when it closes, instead of a hidden
      // focused control dropping focus to the body.
      const opener = document.activeElement;
      const isExport = mode === 'export';
      let settled = false;
      const showError = (message) => { errorEl.textContent = message; errorEl.hidden = false; };
      const hideError = () => { errorEl.textContent = ''; errorEl.hidden = true; };
      const settle = (result) => {
        if (settled) return; settled = true;
        passphraseDialogOpen = false;
        inputEl.removeEventListener('keydown', onKey);
        repeatEl.removeEventListener('keydown', onKey);
        modal.removeEventListener('keydown', onModalKey);
        actionEl.removeEventListener('click', onAction);
        cancelEl.removeEventListener('click', onDismiss);
        modal.removeEventListener('click', onBackdrop);
        inputEl.value = ''; repeatEl.value = '';
        hideError();
        modal.hidden = true;
        if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
        resolve(result);
      };
      const onDismiss = () => settle({ dismiss: true });
      const onAction = () => {
        const passphrase = inputEl.value;
        if (!passphrase) { showError(i18n('passphraseRequired')); return; }
        // No maxLength on the fields: the browser would truncate both halves identically, so a
        // pasted over-long passphrase would pass the mismatch check and seal a phrase the user
        // never typed — an unrecoverable file. Reject it in words instead.
        if (passphrase.length > MAX_PASSPHRASE_CHARS) { showError(i18n('passphraseTooLong')); return; }
        if (isExport && passphrase !== repeatEl.value) { showError(i18n('passphraseMismatch')); return; }
        settle({ passphrase });
      };
      const onBackdrop = (e) => { if (e.target === modal) onDismiss(); };
      const onKey = (e) => {
        // Enter from either field submits; Escape cancels and must not reach the document
        // handler, which would also close the settings panel behind this dialog.
        if (e.key === 'Enter') { e.preventDefault(); onAction(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDismiss(); }
      };
      // Escape is also honored with focus on one of the dialog's own buttons; Enter is not
      // handled here because the button's click already fires for it.
      const onModalKey = (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      };
      titleEl.textContent = i18n(isExport ? 'passphraseExportTitle' : 'passphraseImportTitle');
      bodyEl.textContent = i18n(isExport ? 'passphraseExportBody' : 'passphraseImportBody');
      actionEl.textContent = i18n(isExport ? 'passphraseExportAction' : 'passphraseImportAction');
      repeatEl.hidden = !isExport;
      // 'off' in both modes: a password-manager prompt would offer to keep a copy of a phrase
      // this feature promises is unrecoverable, and export cannot autofill what it just minted.
      inputEl.autocomplete = 'off';
      repeatEl.autocomplete = 'off';
      inputEl.value = ''; repeatEl.value = '';
      if (initialError) showError(initialError); else hideError();
      actionEl.addEventListener('click', onAction);
      cancelEl.addEventListener('click', onDismiss);
      modal.addEventListener('click', onBackdrop);
      inputEl.addEventListener('keydown', onKey);
      repeatEl.addEventListener('keydown', onKey);
      modal.addEventListener('keydown', onModalKey);
      // Marked open only now that setup ran: a throw before this point must not leave the
      // re-entry guard stuck on, or every later export and encrypted import would silently
      // resolve as a dismissal forever.
      passphraseDialogOpen = true;
      modal.hidden = false;
      inputEl.focus();
    });
  }

  // Passphrase file -> the plain backup text the existing importer already understands.
  // Returns the text, or null when the user cancelled or the envelope cannot be opened at all.
  // Both exits stop the caller BEFORE any layout write, so a wrong guess can never change the
  // canvas (spec #53 D4). The envelope is validated before the first prompt — asking someone to
  // type a secret for a file this build cannot read at all is a bait-and-switch — and only the
  // tagged "does not open" failure re-prompts, so the loop cannot trap the dialog.
  async function openPassphraseBackup(envelope) {
    try {
      validateBackupEnvelope(envelope);
    } catch (e) {
      debugErr('openPassphraseBackup: envelope rejected', e);
      try { alert(i18n('importEncryptedInvalid')); } catch (e2) { /* silent: alert may be blocked */ }
      return null;
    }
    let initialError = null;
    for (;;) {
      const answer = await askPassphraseModal('decrypt', initialError);
      if (answer.dismiss) { debug('Import aborted — passphrase file left closed'); return null; }
      try {
        return await decryptBackupFile(envelope, answer.passphrase);
      } catch (e) {
        if (e.code !== BACKUP_ERROR_PASSPHRASE) {
          debugErr('openPassphraseBackup: envelope rejected', e);
          try { alert(i18n('importEncryptedInvalid')); } catch (e2) { /* silent: alert may be blocked */ }
          return null;
        }
        initialError = i18n('passphraseWrong');
      }
    }
  }


  // Envelope -> sealed file text, or a reason it cannot be written. Two DIFFERENT limits can
  // stop a seal, and blaming the wrong one sends the user off to shrink the wrong thing:
  //   layout — the importer lands at most 2,000,000 characters of LAYOUT (the same SEC-06 cap
  //            the plain path applies); no file, sealed or not, can bring that back.
  //   file   — the sealed bytes must still clear the importer's 5MB file gate, and base64
  //            inflates non-ASCII payloads roughly threefold. Snapshot bodies trim first (the
  //            same oldest-first drop the plain path uses), measured in BYTES here.
  // Refusing is the only alternative in both cases: falling back to a plain file would hand out
  // exactly the content the user asked to protect, and raising either limit would trade an
  // existing protection for a round trip (spec #53 D4 / AC7).
  async function sealForDownload(env, text, passphrase) {
    if (JSON.stringify(env.layout).length > 2_000_000) return { ok: false, reason: 'layout' };
    const allowed = maxInnerBytes();
    if (env._bodies) {
      while (utf8ByteLength(text) > allowed && env._bodies.snapshots.length > 0) {
        env._bodies.snapshots.shift();
        env.meta.bodyTrimmed = (env.meta.bodyTrimmed || 0) + 1;
        text = JSON.stringify(env, null, 2);
      }
    }
    if (utf8ByteLength(text) > allowed) return { ok: false, reason: 'file' };
    return { ok: true, text: JSON.stringify(await encryptBackupFile(text, passphrase)) };
  }


  // ── Ticket 50 (spec ticket 50): Time Machine one-click rollback ──────────────────
  // Row button -> secondary confirm (askConfirmModal, same in-page surface as ticket 44) ->
  // saveSnapshot('pre-restore') safety copy -> full-replacement apply through the storage
  // facade. The safety snapshot is FAIL-CLOSED: rollback aborts when the copy cannot be
  // captured (ticket 50 forbids an un-snapshotted full replace; atomcode negative cases: Gemini
  // "confirm said undo, did delete" + story-spark #5529 silent discard — the confirm copy
  // names both the target point and the safety copy so wording matches the executed action).
  async function performSnapshotRollback(ts) {
    const when = new Date(ts).toLocaleString();
    closeSettingsModal(); // don't stack the decision modal behind the settings overlay
    const decision = await askConfirmModal(
      i18n('rollbackConfirmTitle'),
      i18n('rollbackConfirmBody', [when]),
      i18n('rollbackConfirmAction')
    );
    if (decision !== 'action') { openSettingsModal(); return; }
    const safetyTs = await saveSnapshot('pre-restore');
    if (!safetyTs) {
      try { alert(i18n('rollbackNoSafety')); } catch (e) { /* silent: alert may be blocked */ }
      openSettingsModal();
      return;
    }
    const recovered = await restoreFromSnapshot(ts);
    if (!recovered) {
      try { alert(i18n('rollbackSnapshotMissing')); } catch (e) { /* silent: alert may be blocked */ }
      openSettingsModal();
      return;
    }
    try {
      await replaceLayoutFromRestored(recovered);
    } catch (e) {
      debugErr('performSnapshotRollback: replace write failed', e);
      try { alert(i18n('rollbackFailed')); } catch (e2) { /* silent: alert may be blocked */ }
      openSettingsModal();
      return;
    }
    if (currentLargeBoxId) exitToCanvas();
    exitToCanvas(); // force exit any drill-in state — the restored canvas may not contain it
    renderCanvas();
    applyCanvasTransform();
    applyInnerTransform();
    updateCaption();
    debug('Time Machine rollback applied: snapshot ts=' + ts + ', pre-restore safety copy ts=' + safetyTs);
    openSettingsModal(); // back on the data tab; refreshDataHealth now shows the safety copy
  }

  // Ticket 79 (spec): single conflict-copy verbatim export. Fetches the
  // archived entry via the read-only storage facade (getConflictArchive) and downloads
  // it as boxing-conflict-<ts>.json. Read-only — the archive entry is never mutated
  // and archiveConflictLayouts write semantics stay untouched (issue 79 AC3).
  async function exportConflictCopy(ts) {
    try {
      const entry = await getConflictArchive(ts);
      if (!entry) {
        // body pruned by rotation or unknown ts — fail-soft, no partial download
        debugWarn('exportConflictCopy: conflict archive body unavailable (pruned or unknown ts=' + ts + ')');
        return;
      }
      const text = JSON.stringify(entry, null, 2);
      const blob = new Blob([text], { type: 'application/json; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'boxing-conflict-' + String(ts) + '.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000);
      debug('Conflict copy exported: ts=' + ts + ' size=' + (entry.size || text.length));
    } catch (e) { debugErr('exportConflictCopy', e); }
  }

  // ── Ticket 56 (#53 D3): safe delete of one conflict archive ──────────────────
  // Same in-page confirm surface as the Time Machine rollback (askConfirmModal), and the
  // same fail-closed discipline with the opposite protection target: a layout rollback
  // snapshots the CURRENT canvas, while this must snapshot the ARCHIVED payload that is
  // about to be deleted. `saveSnapshot('pre-delete')` therefore does not satisfy this flow
  // — a current-layout copy says nothing about the conflict content being removed. No guard
  // ts, no deletion. A delete that fails after a successful guard is reported honestly: the
  // archive it refused to remove keeps its safe copy, and a guard that protects content still
  // present in the list is recycled instead of left to crowd out another archive's protection.
  async function performConflictDelete(ts) {
    const when = new Date(ts).toLocaleString();
    closeSettingsModal(); // don't stack the decision modal behind the settings overlay
    const decision = await askConfirmModal(
      i18n('conflictDeleteConfirmTitle'),
      i18n('conflictDeleteConfirmBody', [when]),
      i18n('conflictDeleteConfirmAction')
    );
    if (decision !== 'action') { openSettingsModal(); return; }
    const guardTs = await saveConflictGuard(ts);
    if (!guardTs) {
      try { alert(i18n('conflictDeleteNoSafety')); } catch (e) { /* silent: alert may be blocked */ }
      openSettingsModal();
      return;
    }
    if (!await deleteConflictArchive(ts, guardTs)) {
      // Nothing was deleted, so this safe copy protects content that is still in the list.
      // Leaving it behind would spend the guard store's shared count/byte budget on garbage and
      // could evict a real safe copy of another archive.
      await discardConflictGuard(guardTs);
      try { alert(i18n('conflictDeleteFailed')); } catch (e) { /* silent: alert may be blocked */ }
      openSettingsModal();
      return;
    }
    debug('Conflict copy deleted after safe copy: ts=' + ts + ', guard ts=' + guardTs);
    openSettingsModal(); // back on the data tab; the safe-copy row is the restore entry point
  }

  // Restore is archive-scoped: it re-inserts that one payload into the conflict store so the
  // existing readout/export path returns it again. Deliberately no replaceLayoutFromRestored,
  // no exitToCanvas, no re-render — the canvas and everything done on it since the deletion
  // stay untouched (that distinction is the whole point of #53 D3).
  async function performConflictRestore(guardTs) {
    const restored = await restoreConflictGuard(guardTs);
    if (!restored) {
      try { alert(i18n('conflictGuardRestoreFailed')); } catch (e) { /* silent: alert may be blocked */ }
      return;
    }
    debug('Conflict archive restored from safe copy: origin ts=' + restored);
    await refreshDataHealth();
  }

  // ── Issue #54 (#53 D2/D3): per-field adjudication of one conflict copy ─────────
  // Compares the archived subtree against what the canvas holds for the SAME ids today
  // (never the archive-time content as a source of truth), lets the user pick
  // keep-current / adopt-copy per differing field, and writes only what was picked.
  // Opening a comparison changes nothing; applying never deletes the archive row —
  // deleting a copy is a separate action, and copy-only objects belong to #55.
  function conflictPanelNode(ts) {
    return document.querySelector('#data-conflict-list .data-conflict-diff[data-ts="' + ts + '"]');
  }

  function conflictLevelLabel(level) {
    if (level === 'small') return i18n('dataConflictLevelSmallBox');
    if (level === 'bookmark') return i18n('dataConflictLevelBookmark');
    return i18n('dataConflictLevelLargeBox');
  }

  function conflictSpan(text, className) {
    const el = document.createElement('span');
    if (className) el.className = className;
    el.textContent = text;
    return el;
  }

  function buildConflictFieldRow(field, ts) {
    const row = document.createElement('div');
    row.className = 'data-conflict-diff-field';
    row.dataset.path = field.path;
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:2px 0;font-size:var(--fs-xs);';
    row.append(conflictSpan(i18n(field.labelKey)));
    // Each option carries the value it stands for: the radio labels are the comparison,
    // so there is no need for the user to read the payload itself.
    for (const side of ['keep', 'copy']) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;gap:4px;align-items:center;';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'conflict-' + ts + '-' + field.path;
      radio.value = side;
      radio.dataset.ts = String(ts);
      radio.dataset.path = field.path;
      radio.checked = side === 'keep'; // #53 D2: default is always keep-current
      label.append(radio, conflictSpan(
        (side === 'keep' ? i18n('dataConflictKeepCurrent') : i18n('dataConflictAdoptCopy')) + ': ' +
        (side === 'keep' ? field.current : field.copy)));
      row.append(label);
    }
    return row;
  }

  // An object shows up only when there is something to decide about it: differing fields,
  // or a descendant with them. Identical subtrees stay out of the way of the real choice.
  function conflictBlockHasContent(obj) {
    if (obj.status === 'missing') return true;
    if ((obj.fields || []).length) return true;
    return (obj.children || []).some(conflictBlockHasContent) || (obj.bookmarks || []).some(conflictBlockHasContent);
  }

  function buildConflictObjectBlock(obj, ts, depth) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin:2px 0 2px ' + (depth * 14) + 'px;';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;font-size:var(--fs-xs);opacity:0.75;';
    head.append(conflictSpan(conflictLevelLabel(obj.level) + ' · ' + (obj.title || obj.id)));
    if (obj.status === 'missing') head.append(conflictSpan(i18n('dataConflictTargetMissing')));
    wrap.append(head);
    for (const field of obj.fields || []) wrap.append(buildConflictFieldRow(field, ts));
    for (const child of obj.children || []) if (conflictBlockHasContent(child)) wrap.append(buildConflictObjectBlock(child, ts, depth + 1));
    for (const bm of obj.bookmarks || []) if (conflictBlockHasContent(bm)) wrap.append(buildConflictObjectBlock(bm, ts, depth + 1));
    return wrap;
  }

  function buildConflictPanel(ts, diff, notice) {
    const panel = document.createElement('div');
    panel.className = 'data-conflict-diff';
    panel.dataset.ts = String(ts);
    panel.style.cssText = 'margin:4px 0 10px;padding:6px 8px;border-left:2px solid var(--color-hairline);font-size:var(--fs-xs);';
    if (notice) {
      const noticeEl = conflictSpan(notice);
      noticeEl.style.cssText = 'display:block;margin:0 0 6px;';
      panel.append(noticeEl);
    }
    if (!diff.applicable) {
      // #53 D3: missing or truncated archive bytes are not recoverable content, so the
      // row stays listed and exportable but offers no apply control at all.
      panel.append(conflictSpan(i18n('dataConflictBodyUnavailable')));
      return panel;
    }
    panel.append(conflictSpan(i18n('dataConflictDiffHeading')));
    if (!diff.stats.fieldDiffs) panel.append(conflictSpan(i18n('dataConflictNoDiffs')));
    for (const group of diff.groups || []) if (conflictBlockHasContent(group)) panel.append(buildConflictObjectBlock(group, ts, 0));
    if (diff.stats.fieldDiffs) {
      const foot = document.createElement('div');
      foot.style.cssText = 'margin-top:6px;';
      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn data-conflict-apply-btn';
      applyBtn.dataset.ts = String(ts);
      applyBtn.style.cssText = 'padding:2px 10px;font-size:var(--fs-xs);';
      applyBtn.textContent = i18n('dataConflictApplyBtn');
      applyBtn.disabled = true; // nothing adopted yet
      foot.append(applyBtn);
      panel.append(foot);
    }
    return panel;
  }

  function toggleConflictCompare(ts) {
    const open = conflictPanelNode(ts);
    if (open) { open.remove(); conflictPanels.delete(ts); return; }
    void openConflictCompare(ts);
  }

  async function openConflictCompare(ts, notice) {
    const entry = await getConflictArchive(ts);
    const diff = diffConflictArchive(entry, layout);
    const panel = buildConflictPanel(ts, diff, notice);
    const row = document.querySelector('#data-conflict-list .data-conflict-row-item[data-ts="' + ts + '"]');
    if (row) row.after(panel);
    else document.getElementById('data-conflict-list')?.appendChild(panel);
    if (diff.applicable) conflictPanels.set(ts, { signature: diff.signature, selected: new Set() });
    else conflictPanels.delete(ts);
  }

  function setConflictSelection(ts, path, adopt) {
    const state = conflictPanels.get(ts);
    if (!state) return;
    if (adopt) state.selected.add(path); else state.selected.delete(path);
    const btn = conflictPanelNode(ts)?.querySelector('.data-conflict-apply-btn');
    if (btn) btn.disabled = state.selected.size === 0;
  }

  // Scalar field writes follow the shape the canvas controls themselves use (title/pin/
  // hover-expand assign + one save): the layout-bypass contract governs collection
  // membership, and the sibling external-payload paths (import merge / overwrite restore)
  // take archived geometry verbatim rather than re-snapping it, so this stays value-faithful
  // too. The star is different — isParent is the DSU leader truth — so it goes through the
  // public wrapper, which owns ensureConnArrays + commit('toggleStar') + the button sync.
  function writeConflictOp(op) {
    const lb = getLargeBox(op.largeId);
    if (!lb) return false;
    let target = lb;
    let tieredKey = largeKey(lb.id);
    if (op.level !== 'large') {
      target = (lb.children || []).find((s) => s && s.id === op.smallId) || null;
      if (!target) return false;
      tieredKey = smallKey(lb.id, target.id);
    }
    if (op.level === 'bookmark') {
      target = (target.bookmarks || []).find((b) => b && b.id === op.bmId) || null;
      if (!target) return false;
    }
    if (op.field === 'isParent') {
      // toggleStar reads the field OR the runtime star mirror, so "already starred" has to
      // be tested the same way — otherwise the toggle would un-star a live box while the
      // user asked to adopt its star, and report it as an applied field.
      const starred = Boolean(target.isParent) || groupStar.has(tieredKey);
      if (starred === Boolean(op.value)) return false;
      toggleStarMark(tieredKey);
      return true;
    }
    target[op.field] = op.value;
    return true;
  }

  async function applyConflictCompare(ts) {
    const state = conflictPanels.get(ts);
    if (!state || !state.selected.size) return;
    const entry = await getConflictArchive(ts);
    const fresh = diffConflictArchive(entry, layout);
    if (!fresh.applicable) {
      conflictPanels.delete(ts);
      conflictPanelNode(ts)?.replaceWith(buildConflictPanel(ts, fresh, i18n('dataConflictBodyUnavailable')));
      return;
    }
    if (fresh.signature !== state.signature) {
      conflictPanels.set(ts, { signature: fresh.signature, selected: new Set() });
      conflictPanelNode(ts)?.replaceWith(buildConflictPanel(ts, fresh, i18n('dataConflictStale')));
      debug('Conflict comparison refreshed before apply (target changed since it was compared): ts=' + ts);
      return;
    }
    // Count fields the user chose, not raw key writes — one adopted position sets x and y.
    const done = new Set();
    for (const op of planConflictApply(fresh, state.selected)) {
      if (writeConflictOp(op)) done.add(op.path);
    }
    const applied = done.size;
    conflictPanels.delete(ts);
    if (!applied) {
      // Nothing to write: every selected value already matches what the box has (the star
      // is the reachable case — the runtime mirror can hold it while isParent does not).
      // Targets vanishing cannot land here: that moves the signature and the refresh above
      // catches it. Say exactly that nothing changed, instead of reusing the staleness notice.
      conflictPanels.set(ts, { signature: fresh.signature, selected: new Set() });
      conflictPanelNode(ts)?.replaceWith(buildConflictPanel(ts, fresh, i18n('dataConflictNoChange')));
      debug('Conflict apply wrote nothing: ts=' + ts + ' (selected values already match the current content)');
      return;
    }
    await saveLayout();
    // renderCanvas() hides the inner wrapper — it repaints the OUTER canvas — so applying
    // while the user is drilled into a box must repaint that box instead of silently kicking
    // them back to the canvas. exitToCanvas() repaints the outer surface on the way out, so
    // the not-yet-visible layer cannot go stale from skipping renderCanvas here.
    if (currentLargeBoxId) {
      const lb = getLargeBox(currentLargeBoxId);
      if (lb) {
        renderInnerSurface(lb);
        renderCrumbs(lb);
      } else {
        renderCanvas();
        applyCanvasTransform();
      }
    } else {
      renderCanvas();
      applyCanvasTransform();
      applyInnerTransform();
    }
    updateCaption();
    // The archive row and its body stay exactly as they were (applying is not deleting):
    // the panel is re-compared so the adopted fields now read as the current values, while
    // the copy itself stays listed for export or a later verdict.
    const after = diffConflictArchive(entry, layout);
    conflictPanels.set(ts, { signature: after.signature, selected: new Set() });
    conflictPanelNode(ts)?.replaceWith(buildConflictPanel(ts, after, i18n('dataConflictApplied', [applied])));
    debug('Conflict copy applied field-by-field: ts=' + ts + ' fields=' + applied);
  }

function openLink(url) {
  try {
    const cr = globalThis.chrome || globalThis.browser;
    if (cr?.tabs?.create) {
      cr.tabs.create({ url, active: true });
    } else { window.open(url, '_blank', 'noopener'); }
  } catch (_) { window.open(url, '_blank', 'noopener'); }
}

export async function checkVersionUpdate(forceRefresh = false) {
  const hintEl = document.getElementById('about-update-hint');
  if (!hintEl) return;
  const versionValEl = document.getElementById('about-version-value');
  const currentVer = (versionValEl?.textContent || '').trim().replace(/^v/i, '');
  if (!currentVer || currentVer === '–') return;

  const cr = globalThis.chrome || globalThis.browser;
  const CACHE_KEY = 'boxingVersionCache';
  const TTL = 2 * 60 * 60 * 1000; // 2 hours TTL

  hintEl.hidden = false;
  hintEl.textContent = i18n('aboutUpdateChecking') || 'Checking for updates...';

  try {
    let cached = null;
    if (!forceRefresh && cr?.storage?.local) {
      const res = await new Promise(r => cr.storage.local.get([CACHE_KEY], r));
      cached = res?.[CACHE_KEY];
    }
    const now = Date.now();
    let latest = cached?.latest;
    let releaseUrl = cached?.url || 'https://github.com/Xxx91n/boxing/releases';

    if (forceRefresh || !latest || (now - (cached?.ts || 0)) >= TTL) {
      let fetched = null;
      // 1. Primary authority: GitHub Releases API
      try {
        const ghRes = await fetch('https://api.github.com/repos/Xxx91n/boxing/releases/latest', { cache: 'no-cache' });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          fetched = {
            latest: (ghData.tag_name || ghData.name || '').trim(),
            url: ghData.html_url || 'https://github.com/Xxx91n/boxing/releases'
          };
        }
      } catch (_) {}

      // 2. Fallback: Pages mirror demo/version.json if GitHub API failed or rate-limited
      if (!fetched) {
        try {
          const res = await fetch(`${DEMO_URL}version.json`, { cache: 'no-cache' });
          if (res.ok) {
            const data = await res.json();
            fetched = {
              latest: (data.version || data.tag_name || data.latest || '').trim(),
              url: data.url || 'https://github.com/Xxx91n/boxing/releases'
            };
          }
        } catch (_) {}
      }

      if (fetched && fetched.latest) {
        latest = fetched.latest;
        releaseUrl = fetched.url;
        if (cr?.storage?.local) {
          cr.storage.local.set({ [CACHE_KEY]: { ts: now, latest, url: releaseUrl } });
        }
      }
    }

    if (latest && compareVersions(currentVer, latest) < 0) {
      hintEl.hidden = false;
      hintEl.innerHTML = '';
      const prefix = document.createTextNode((i18n('aboutUpdateAvailable') || 'New version available: ') + ' ');
      const link = document.createElement('a');
      link.href = releaseUrl;
      link.textContent = 'v' + latest.replace(/^v/i, '');
      link.style.cssText = 'color:var(--color-accent);text-decoration:underline;cursor:pointer;';
      link.addEventListener('click', e => {
        e.preventDefault();
        openLink(releaseUrl);
      });
      hintEl.append(prefix, link);
    } else if (latest) {
      hintEl.hidden = false;
      hintEl.textContent = i18n('aboutUpdateLatest') || 'Up to date';
    } else {
      hintEl.hidden = false;
      hintEl.innerHTML = '';
      const failText = document.createTextNode((i18n('aboutUpdateFailed') || 'Check failed') + ' ');
      const relLink = document.createElement('a');
      relLink.href = 'https://github.com/Xxx91n/boxing/releases';
      relLink.textContent = '[' + (i18n('aboutViewReleases') || 'View Releases') + ']';
      relLink.style.cssText = 'color:var(--color-muted);text-decoration:underline;cursor:pointer;';
      relLink.addEventListener('click', e => {
        e.preventDefault();
        openLink('https://github.com/Xxx91n/boxing/releases');
      });
      hintEl.append(failText, relLink);
    }
  } catch (_) {
    hintEl.hidden = false;
    hintEl.textContent = i18n('aboutUpdateFailed') || 'Check failed';
  }
}

// ── Issue #59 (#53 D6): About-page copy + diagnostics shortcut ───────
// Copying is the one thing About could not do: to file a bug you had to retype the version or
// the issues URL out of a control that only ever opened a tab. Both copy paths read the SAME
// value the open path uses — the manifest version above, the link map below — so what lands on
// the clipboard can never disagree with what the page shows.
// Neither manifest asks for clipboardWrite, so the async API is tried first and the textarea
// path is the fallback: it works in an extension page on a user gesture in both browsers
// without widening the permission set (D8 keeps the boundary as-is).
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { debugWarn('clipboard writeText', e); }
  let ta = null;
  try {
    ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    // Off-screen but still laid out: execCommand('copy') needs a selectable range, and the
    // shared .sr-only utility (clip + 1px box) is the one thing a future a11y tweak could
    // silently turn into visibility:hidden — which would break this path.
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.select();
    return document.execCommand('copy');
  } catch (e) {
    debugErr('clipboard fallback', e);
    return false;
  } finally {
    // A throw from execCommand must not leave a stray textarea on the page forever.
    ta?.remove();
  }
}

let _copyStatusTimer = null;
function showCopyFeedback(ok) {
  const el = document.getElementById('about-copy-status');
  if (!el) return;
  el.textContent = ok ? i18n('aboutCopied') : i18n('aboutCopyFailed');
  el.hidden = false;
  if (_copyStatusTimer) clearTimeout(_copyStatusTimer);
  _copyStatusTimer = setTimeout(() => { el.hidden = true; _copyStatusTimer = null; }, 2500);
}

// The shortcut reaches the diagnostics surface that already lives in Settings > Data — there is
// no second log UI to land on. Driving the nav button reuses the existing tab switch (including
// its lastSettingsTab bookkeeping) instead of duplicating it here.
function showDiagnosticsSection() {
  document.querySelector('.settings-nav__item[data-tab="data"]')?.click();
  const section = document.getElementById('settings-diagnostics');
  if (!section) return;
  section.scrollIntoView({ block: 'start' });
  // A repeat click must re-flash: removing and re-adding the class inside the same task would
  // be coalesced by the browser and produce no animation.
  section.classList.remove('settings-section--flash');
  void section.offsetWidth;
  section.classList.add('settings-section--flash');
  document.getElementById('diag-export-log-btn')?.focus();
}

let _aboutTabInited = false;
export function initAboutTab() {
  const versionEl = document.getElementById('about-version-value');
  if (versionEl) {
    try {
      const cr = globalThis.chrome || globalThis.browser;
      const mf = cr?.runtime?.getManifest ? cr.runtime.getManifest() : null;
      versionEl.textContent = (mf && (mf.version_name || mf.version)) || '–';
    } catch (_) { versionEl.textContent = '–'; }
  }
  if (_aboutTabInited) return;
  _aboutTabInited = true;
  const links = {
    'about-link-repo': 'https://github.com/Xxx91n/boxing',
    'about-link-issues': 'https://github.com/Xxx91n/boxing/issues',
    'about-link-pulls': 'https://github.com/Xxx91n/boxing/pulls',
    'about-link-privacy': PRIVACY_URL,
  };
  const checkUpdateBtn = document.getElementById('about-check-update-btn');
  checkUpdateBtn?.addEventListener('click', () => {
    checkVersionUpdate(true);
  });
  for (const [id, url] of Object.entries(links)) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => openLink(url));
  }
  document.querySelectorAll('.about-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copySource === 'version'
        ? (versionEl?.textContent || '').trim()
        : links[btn.dataset.copySource];
      // '–' is the placeholder for "this host has no manifest version" (the file:// lane).
      // Copying it would hand the user a dash instead of a version.
      if (!value || value === '–') { showCopyFeedback(false); return; }
      showCopyFeedback(await copyToClipboard(value));
    });
  });
  document.getElementById('about-diagnostics-btn')?.addEventListener('click', showDiagnosticsSection);
}

let _autoTitleInited = false;

function renderAutoTitleRows() {
  const tbody = document.getElementById('auto-title-rules-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rules = layout.settings.autoTitleRules || [];
  rules.forEach((rule, idx) => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid var(--color-hairline);';

    const tdPattern = document.createElement('td');
    tdPattern.style.cssText = 'padding:4px;';
    const patInput = document.createElement('input');
    patInput.type = 'text';
    patInput.value = rule.pattern || '';
    patInput.style.cssText = 'width:100%;padding:2px 4px;font-size:var(--fs-xs);border:1px solid var(--color-hairline);border-radius:3px;background:var(--color-surface);color:var(--color-ink);';
    patInput.addEventListener('change', () => {
      rule.pattern = patInput.value.trim();
      saveLayout();
    });
    tdPattern.appendChild(patInput);

    const tdType = document.createElement('td');
    tdType.style.cssText = 'padding:4px;';
    const typeSelect = document.createElement('select');
    typeSelect.style.cssText = 'width:100%;padding:2px 4px;font-size:var(--fs-xs);border:1px solid var(--color-hairline);border-radius:3px;background:var(--color-surface);color:var(--color-ink);';
    const typeKeyMap = {
      'domain-main': 'ruleTypeDomainMain',
      'full-host': 'ruleTypeFullHost',
      'subdomain': 'ruleTypeSubdomain',
      'first-path': 'ruleTypeFirstPath',
      'last-path': 'ruleTypeLastPath',
      'first-two-paths': 'ruleTypeFirstTwoPaths',
      'domain-first-path': 'ruleTypeDomainFirstPath',
      'full-url': 'ruleTypeFullUrl',
    };
    EXTRACTION_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = i18n(typeKeyMap[t]) || t;
      if (t === rule.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      rule.type = typeSelect.value;
      saveLayout();
    });
    tdType.appendChild(typeSelect);

    const tdActions = document.createElement('td');
    tdActions.style.cssText = 'padding:4px;text-align:right;white-space:nowrap;';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'rule-action-btn';
    upBtn.textContent = '↑';
    upBtn.title = i18n('ruleBtnMoveUp');
    upBtn.setAttribute('aria-label', i18n('ruleBtnMoveUp') || 'Move up');
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', () => {
      if (idx > 0) {
        const tmp = rules[idx - 1];
        rules[idx - 1] = rules[idx];
        rules[idx] = tmp;
        saveLayout();
        renderAutoTitleRows();
      }
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'rule-action-btn';
    downBtn.textContent = '↓';
    downBtn.title = i18n('ruleBtnMoveDown');
    downBtn.setAttribute('aria-label', i18n('ruleBtnMoveDown') || 'Move down');
    downBtn.disabled = idx === rules.length - 1;
    downBtn.addEventListener('click', () => {
      if (idx < rules.length - 1) {
        const tmp = rules[idx + 1];
        rules[idx + 1] = rules[idx];
        rules[idx] = tmp;
        saveLayout();
        renderAutoTitleRows();
      }
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'rule-action-btn rule-action-btn--delete';
    delBtn.textContent = '×';
    delBtn.title = i18n('bookmarkDelete');
    delBtn.setAttribute('aria-label', i18n('bookmarkDelete') || 'Delete');
    delBtn.addEventListener('click', () => {
      rules.splice(idx, 1);
      saveLayout();
      renderAutoTitleRows();
    });

    tdActions.append(upBtn, downBtn, delBtn);
    tr.append(tdPattern, tdType, tdActions);
    tbody.appendChild(tr);
  });
}

export function syncAutoTitleDOM() {
  const enabledCb = document.getElementById('auto-title-enabled');
  const container = document.getElementById('auto-title-rules-container');
  const tbody = document.getElementById('auto-title-rules-tbody');
  if (!enabledCb || !tbody) return;

  const isEnabled = layout.settings.autoTitleEnabled !== false;
  enabledCb.checked = isEnabled;
  if (container) container.style.display = isEnabled ? '' : 'none';

  if (!Array.isArray(layout.settings.autoTitleRules) || layout.settings.autoTitleRules.length === 0) {
    layout.settings.autoTitleRules = DEFAULT_AUTO_TITLE_RULES.map(r => ({ ...r }));
  }

  renderAutoTitleRows();
}

export function initAutoTitleSettings() {
  const enabledCb = document.getElementById('auto-title-enabled');
  const container = document.getElementById('auto-title-rules-container');
  const addBtn = document.getElementById('btn-add-rule');
  const resetBtn = document.getElementById('btn-reset-rules');
  if (!enabledCb) return;

  if (!_autoTitleInited) {
    _autoTitleInited = true;

    enabledCb.addEventListener('change', () => {
      layout.settings.autoTitleEnabled = enabledCb.checked;
      if (container) container.style.display = enabledCb.checked ? '' : 'none';
      saveLayout();
    });

    addBtn?.addEventListener('click', () => {
      layout.settings.autoTitleRules = layout.settings.autoTitleRules || [];
      layout.settings.autoTitleRules.push({ pattern: 'https://*/*', type: 'domain-main' });
      saveLayout();
      renderAutoTitleRows();
    });

    resetBtn?.addEventListener('click', () => {
      layout.settings.autoTitleRules = DEFAULT_AUTO_TITLE_RULES.map(r => ({ ...r }));
      saveLayout();
      renderAutoTitleRows();
    });
  }

  syncAutoTitleDOM();
}

// Init-time wiring, called from ntp.js init() at the position of the original statement blocks.
export function bindSettingsUi() {
    initAboutTab();
    initAutoTitleSettings();
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
        layout.settings.lastSettingsTab = tabId;  // remember last active tab
        document.querySelectorAll('.settings-tab').forEach(t => t.hidden = true);
        const tab = document.getElementById('tab-' + tabId);
        if (tab) tab.hidden = false;
        if (tabId === 'about') checkVersionUpdate();
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
     // The quick reference assembles its text from the store in onboarding.js instead of
     // [data-i18n] nodes, so applyI18n() cannot reach it: refresh it through the same window
     // contract idiom closeSettingsModal() uses for the credential flush (B-9 forbids this file
     // from importing onboarding.js). Undefined until the entry is bound — same tolerance as
     // __boxingFlushCredentials above.
     try { const refresh = window.__boxingRefreshQuickHelp; if (typeof refresh === 'function') refresh(); } catch (e) { debugWarn('quick help refresh', e); }
     // Re-apply the action tooltip/aria-label in the new language (the header button
     // no longer carries a static data-i18n-title). Kept even though saveLayout above
     // already replays the apply path: a failed persist must not leave a stale label.
     applyDarkMode(layout.settings.darkMode);
     applyCanvasTransform();
     // Re-apply pin tooltip after i18n reset (applyI18n overwrites data-i18n-title)
     updateAutohideUI();
     applyInnerTransform();
    });
    rememberCheck?.addEventListener('change', () => {
      layout.settings.rememberLastPos = rememberCheck.checked;
      saveLayout();
    });
    // + ticket 11: urlOpenMode — default 'sameTab' so bookmarks open in the current tab unless the user explicitly picks New Tab.
    urlOpenModeSelect?.addEventListener('change', () => {
      layout.settings.urlOpenMode = urlOpenModeSelect.value === 'sameTab' ? 'sameTab' : 'newTab';
      saveLayout();
    });

    connDeleteActionSelect?.addEventListener('change', () => {
      layout.settings.connDeleteAction = connDeleteActionSelect.value || 'alt+click';
      // Force full re-create so new-mode listeners (dblclick/contextmenu/keydoc) attach to fresh <line> elements.
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

    // Dark mode preference — the three radios only WRITE the preference; the single
    // apply path (persist.js applyDarkMode) derives and renders the effective state.
    darkModeGroup?.addEventListener('change', () => {
      const checked = darkModeGroup.querySelector('input[name="dark-mode"]:checked');
      if (!checked) return;
      layout.settings.darkMode = normalizeDarkModePref(checked.value);
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

    // Curated theme pack — theme button click handlers
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
        // Ticket 44 (spec #41): explicit preferences toggle to the opposite explicit
        // preference; 'system' exits by choosing the opposite of the CURRENT EFFECTIVE
        // state (currently dark -> 'light', currently light -> 'dark').
        layout.settings.darkMode = nextDarkModePreference(layout.settings.darkMode);
        syncDarkModeRadios(); // keep the appearance radios truthful if the panel is open
        saveLayout();
      });
    }
    // Export / Import
    // Ticket 51 (hybrid strategy): the DEFAULT export is a clean
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
        // Issue #57 (spec #53 D4): the data-tab checkbox is the only thing that changes this
        // path — unchecked, it stays the ticket-51 plain export. Dismissing the dialog
        // downloads nothing at all.
        let passphrase = null;
        if (document.getElementById('export-encrypt-cb')?.checked) {
          const answer = await askPassphraseModal('export', null);
          if (answer.dismiss) return;
          passphrase = answer.passphrase;
        }
        let env = await buildExportEnvelope();
        let text = JSON.stringify(env, null, 2);
        if (fullPackage) {
          env.meta.fullPackage = true;
          env._bodies = await readDrBodies();
          // Size estimate + 5MB handling (SEC-06 parity: the importer rejects
          // payloads it cannot land; a full package must stay restorable, not
          // maximal).
          text = JSON.stringify(env, null, 2);
          while (text.length > MAX_BACKUP_FILE_BYTES && env._bodies.snapshots.length > 0) {
            env._bodies.snapshots.shift(); // oldest body drops first
            env.meta.bodyTrimmed = (env.meta.bodyTrimmed || 0) + 1;
            text = JSON.stringify(env, null, 2);
          }
          if (text.length > MAX_BACKUP_FILE_BYTES) {
            // even metadata-only is too big (huge live layout) — fall back to the
            // standard envelope so the user still gets a clean, importable export.
            debug('Full DR package exceeds 5MB after trim — falling back to standard envelope');
            try { alert(i18n('exportFullOverflow')); } catch (_) { /* alert may be blocked */ }
            env = await buildExportEnvelope();
            text = JSON.stringify(env, null, 2);
          }
        }
        if (passphrase) {
          const sealed = await sealForDownload(env, text, passphrase);
          if (!sealed.ok) {
            try { alert(i18n(sealed.reason === 'layout' ? 'exportEncryptedLayoutTooLarge' : 'exportEncryptedTooLarge')); } catch (_) { /* alert may be blocked */ }
            return;
          }
          downloadJson(sealed.text, 'boxing-backup-' + _ymd() + '.json');
          debug('Export done — fullPackage=' + Boolean(fullPackage) + ' encrypted=true len=' + sealed.text.length);
          return;
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
      // File size sanity check — reject imports > 5MB. Export keeps a sealed file inside this
      // same gate (maxInnerBytes()), so sealing can never produce a file the gate would refuse;
      // the caps BEHIND the gate (structure checks, the 2,000,000-char layout payload) still
      // apply to the decrypted bytes exactly as they do to a plain file.
      if (file.size > MAX_BACKUP_FILE_BYTES) { try { alert(i18n('importTooLarge')); } catch (e) { /* silent: alert may be blocked */ } importFile.value = ''; return; }
      try {
        const text = await file.text();
        // Strip UTF-8 BOM if present
        const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
        // Issue #57 (spec #53 D4): a passphrase-protected file is opened back into the plain
        // backup text it was sealed from, then rides the UNCHANGED validation / confirm /
        // merge pipeline below — file encryption never bypasses the existing data protections.
        // Cancelling the dialog or a file the app cannot open at all stops here, before any
        // layout write, so the canvas stays exactly as it was.
        let data = null;
        try { data = JSON.parse(cleanText); } catch (e) { /* unparsable: the structure checks below reject it */ }
        if (isPassphraseBackupFile(data)) {
          const inner = await openPassphraseBackup(data);
          if (inner === null) { importFile.value = ''; return; }
          data = JSON.parse(inner);
        }
        // Ticket 51 (spec ticket 51): unwrap the export envelope — { _exportedAt, meta,
        // layout[, _bodies] } lands as the bare layout, so a default-envelope or
        // full-DR-package export round-trips back through the unchanged merge /
        // overwrite pipeline below (AC: envelope import restores the current
        // layout). Legacy bare dumps (boxes at top level) skip the unwrap entirely.
        // The package's _bodies and meta are ignored on import; the SEC-06 depth
        // cap applies to the LAYOUT payload (what reaches storage), not the index.
        const unwrapped = unwrapExportEnvelope(data);
        if (unwrapped) data = unwrapped;
        // Validate structure — must have boxes array, version field
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
        // Sanitize settings — prevent NaN/Infinity injection
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
          await saveSnapshot('pre-restore'); // Ticket 50 (ticket 50): an empty-canvas replace is a full replace too — safety copy first
          setLayout(incoming);
          // AUD-SEC: preserve local connections if the import file lacks them
          // (older backups predate the connections system; full replace would lose user lines).
          // layout-bypass-allow: import-preserve-conns - restore local conns when import predates connections system (expires:2027-03-31; ticket:108)
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
            await saveSnapshot('pre-restore'); // Ticket 50 (ticket 50): every restore entry snapshots before applying
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
            await saveSnapshot('pre-restore'); // Ticket 50 (ticket 50): copy-before-overwrite before destructive replace
            setLayout(incoming);
            // layout-bypass-allow: import-overwrite-preserve-conns - same restore on confirmed overwrite path (expires:2027-03-31; ticket:108)
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

    // Ticket 50: delegated rollback click for the rebuilt Time Machine rows
    const snapshotListEl = document.getElementById('data-snapshot-list');
    snapshotListEl?.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('.data-snapshot-rollback-btn') : null;
      if (!btn) return;
      const ts = Number(btn.dataset.ts);
      if (Number.isFinite(ts) && ts > 0) performSnapshotRollback(ts);
    });

    // Ticket 79: delegated export click for the rebuilt conflict-copy rows.
    // Issue #54: the same rows carry the compare toggle and, inside the opened panel, the
    // apply control — rows and panels are rebuilt together, so one listener still covers it.
    // Ticket 56: and the delete action, so the same single listener covers every row button
    // (rows are rebuilt on every modal open, so per-row listeners would leak).
    const conflictListEl = document.getElementById('data-conflict-list');
    conflictListEl?.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(
        '.data-conflict-compare-btn, .data-conflict-apply-btn, .data-conflict-export-btn, .data-conflict-delete-btn'
      ) : null;
      if (!btn) return;
      const ts = Number(btn.dataset.ts);
      if (!Number.isFinite(ts) || ts <= 0) return;
      if (btn.classList.contains('data-conflict-compare-btn')) toggleConflictCompare(ts);
      else if (btn.classList.contains('data-conflict-apply-btn')) void applyConflictCompare(ts);
      else if (btn.classList.contains('data-conflict-delete-btn')) performConflictDelete(ts);
      else exportConflictCopy(ts);
    });

    // Issue #54: the per-field radios live inside the rebuilt panel, so one delegated
    // change listener tracks the selections instead of per-field listeners.
    conflictListEl?.addEventListener('change', (e) => {
      const input = e.target;
      if (!input || input.type !== 'radio' || !input.dataset.path) return;
      const ts = Number(input.dataset.ts);
      if (!Number.isFinite(ts) || ts <= 0) return;
      setConflictSelection(ts, input.dataset.path, input.value === 'copy');
    });

    // Ticket 56: delegated restore click for the safe-copy rows
    const conflictGuardListEl = document.getElementById('data-conflict-guard-list');
    conflictGuardListEl?.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('.data-conflict-guard-restore-btn') : null;
      if (!btn) return;
      const ts = Number(btn.dataset.ts);
      if (Number.isFinite(ts) && ts > 0) performConflictRestore(ts);
    });

    // Confirm modal events
    confirmDelete?.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirmModal();
    });
    confirmCancel?.addEventListener('click', closeConfirmModal);
    confirmModal?.addEventListener('click', e => { if (e.target === confirmModal) closeConfirmModal(); });
}
