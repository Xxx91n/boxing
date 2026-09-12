// Boxing — sync/backup engine (ticket 10, architecture-recovery).
// WebDAV/Gist transport + two-way sync with ADR-0009 outbox-style field-level merge +
// chrome.alarms auto-backup + BX-AUD-01/03 front-end URL guard + the sync/backup config UI
// bindings (inputs, credential flush, test/backup buttons, auto-backup select).
// ADR-0016: engine layer — persistence only through the ./storage.js facade
// (saveLayout / directSetBoxingLayout / saveSnapshot / stripGroupsForPersist); shared state
// via ./state.js singletons (live bindings). Moved verbatim from ntp.js (byte-exact except
// `export` prefixes, facade glue, and the bindSyncBackupUi() wrapper around the init-time wiring).

import { layout, setLayout, writerId } from './state.js';
import { saveLayout, saveSnapshot, directSetBoxingLayout, stripGroupsForPersist, archiveConflictLayouts } from './storage.js';
import { migrateLayout } from './utils.js';
import { i18n } from './i18n.js';
import { renderCanvas } from './render.js';
import { encryptCredential, decryptCredential } from './credentials.js';

let debug, debugErr, debugWarn;
let syncProviderSelect, webdavConfig, gistConfig, webdavUrlInput, webdavUserInput, webdavPassInput, gistTokenInput, gistIdInput, syncLevelSelect, syncFilenameInput, backupNowBtn, remoteBackupZone, lastBackupTimeVal, webdavTestBtn;

// Ticket 10: inject ntp.js-scope deps (loggers + sync config DOM refs — the refs are declared
// once in ntp.js; duplicate getElementById here would fork their null-ness).
export function initSyncEngineFacade(deps) {
  debug = deps.debug; debugErr = deps.debugErr; debugWarn = deps.debugWarn;
  syncProviderSelect = deps.syncProviderSelect; webdavConfig = deps.webdavConfig; gistConfig = deps.gistConfig;
  webdavUrlInput = deps.webdavUrlInput; webdavUserInput = deps.webdavUserInput; webdavPassInput = deps.webdavPassInput;
  gistTokenInput = deps.gistTokenInput; gistIdInput = deps.gistIdInput;
  syncLevelSelect = deps.syncLevelSelect; syncFilenameInput = deps.syncFilenameInput;
  backupNowBtn = deps.backupNowBtn; remoteBackupZone = deps.remoteBackupZone;
  lastBackupTimeVal = deps.lastBackupTimeVal; webdavTestBtn = deps.webdavTestBtn;
}

  // BX-AUD-01/03 — front-end WebDAV URL guard (mirrors the stricter guard in background.js).
  // Rejects private / host-only hostnames and oversized URLs so users never silently target a local network.
  const AUD_PRIVATE_HOST_RE = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:|fc00:|fd00:)/i;
  function isSafeExtUrl(urlStr) {
    if (typeof urlStr !== 'string' || urlStr.length > 2048) return false;
    let u;
    try { u = new URL(urlStr); } catch (_) { return false; }
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    const host = (u.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (AUD_PRIVATE_HOST_RE.test(host)) return false;
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    return true;
  }
  window.__boxingIsSafeExtUrl = isSafeExtUrl;

    // Show last backup time
    function updateLastBackupDisplay() {
      if (lastBackupTimeVal) {
        lastBackupTimeVal.textContent = layout.settings.lastBackupAt ? new Date(layout.settings.lastBackupAt).toLocaleString() : i18n('neverText');
      }
    }

    function updateSyncConfigVisibility() {
      const p = syncProviderSelect.value;
      if (remoteBackupZone) remoteBackupZone.hidden = (p !== 'webdav' && p !== 'gist');
      if (webdavConfig) webdavConfig.hidden = p !== 'webdav';
      if (gistConfig) gistConfig.hidden = p !== 'gist';
    }

    // BX-DEV-115: Route WebDAV through background service worker to bypass CORS.
    // In Firefox MV3, extension page fetch to external HTTPS is blocked even with
    // host_permissions — "NetworkError when attempting to fetch resource".
    // Background SW runs in extension origin, not subject to page CSP/CORS.
    function sendToBackground(msg) {
      // BX-DEV-115: Cross-browser message passing.
      // Firefox browser.* returns a Promise from sendMessage without callback.
      // Chrome chrome.* supports callback-style. Try Promise first, fall back to callback.
      debug('sendToBackground:', msg.type);
      // Try Promise-based API first (Firefox browser.* native, Chrome MV3 also supports this)
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        return browser.runtime.sendMessage(msg).then(resp => {
          if (resp && resp.success) return resp;
          throw new Error(resp && resp.error ? resp.error : 'BG error');
        });
      }
      // Fall back to callback-style (Chrome chrome.* API)
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        return new Promise((resolve, reject) => {
          try {
            chrome.runtime.sendMessage(msg, resp => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              if (resp && resp.success) resolve(resp);
              else if (resp && !resp.success) reject(new Error(resp.error || 'BG error'));
              else reject(new Error('No response from background'));
            });
          } catch (e) { reject(e); }
        });
      }
      return Promise.reject(new Error('No extension runtime available'));
    }

    // A2b: Chrome MV3 — request optional host permission from user gesture (click handler context).
  async function ensureWebDAVPermissionGranted(url) {
    const u = new URL(url);
    const origin = u.origin + '/*';
    const apiNs = typeof browser !== 'undefined' ? browser : chrome;
    if (!apiNs.permissions) return true; // no permissions API — assume granted
    try {
      const has = await apiNs.permissions.contains({ origins: [origin] });
      if (has) return true;
      const granted = await apiNs.permissions.request({ origins: [origin] });
      return !!granted;
    } catch (_) { return true; } // fail open on Firefox (host_permissions required)
  }

  async function testWebDAVConnection() {
      const url = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
      const user = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
      const pass = webdavPassInput?.value || '';
      debug('WebDAV test: starting', { url, user: user ? '(set)' : '(empty)', pass: pass ? '(set)' : '(empty)' });
      if (!url) throw new Error(i18n('webdavErrNoUrl'));
      // BX-AUD-01/03 front-end guard: private hosts, scheme, length, embedded creds
      if (!isSafeExtUrl(url)) {
        if (url.length > 2048) throw new Error(i18n('webdavErrUrlTooLong'));
        let _u; try { _u = new URL(url); } catch (_) { throw new Error(i18n('webdavErrNetwork')); }
        if (_u.protocol !== 'https:') throw new Error(i18n('webdavErrHttps'));
        if (_u.username || _u.password) throw new Error(i18n('webdavErrEmbedded'));
        throw new Error(i18n('webdavErrBlockedHost'));
      }
      const target = new URL(url);
      if (user && !pass) {
        debugErr('WebDAV test: password is empty — decrypt may not have completed');
        throw new Error(i18n('webdavErrNoPass'));
      }
      try {
        let status, ok;
        // Primary: route through background SW (bypasses CORS in Firefox MV3)
        try {
          const resp = await sendToBackground({ type: 'webdav-test', url: target.href, user, pass });
          if (resp.needPermission) {
            debug('WebDAV test: needPermission, requesting origin', resp.origin);
            const granted = await ensureWebDAVPermissionGranted(target.href);
            if (!granted) throw new Error(i18n('webdavErrNetwork'));
            // Retry after permission granted
            const resp2 = await sendToBackground({ type: 'webdav-test', url: target.href, user, pass });
            status = resp2.status; ok = resp2.ok;
          } else {
            status = resp.status; ok = resp.ok;
          }
          debug('WebDAV test via BG:', { status, ok });
        } catch (bgErr) {
          debug('WebDAV test via BG failed, falling back to direct fetch', bgErr && bgErr.message ? bgErr.message : bgErr);
          // Fallback: direct fetch (works in Chromium extension, not in Firefox)
          const h = new Headers({ 'Depth': '0' });
          if (user) h.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
          const resp = await fetch(target.href, { method: 'PROPFIND', headers: h, redirect: 'manual' });
          if (resp.type === 'opaqueredirect') throw new Error(i18n('webdavErrNetwork'));
          status = resp.status;
          ok = resp.status === 207 || resp.ok;
          debug('WebDAV test direct: PROPFIND', { status, ok });
        }
        // Interpret response
        debug('WebDAV test: interpreting response', { status, ok });
        if (status === 401 || status === 403) {
          throw new Error(i18n('webdavErrAuth', [status]));
        }
        if (status === 404) {
          throw new Error(i18n('webdavErrPath'));
        }
        if (status === 207 || status === 200 || (ok && status >= 200 && status < 300)) {
          debug('WebDAV test: connection OK');
          return true;
        }
        throw new Error(i18n('webdavErrStatus', [status]));
      } catch (netErr) {
        // If the error is already a known i18n message, re-throw it
        const knownErrors = ['webdavErrNoUrl', 'webdavErrHttps', 'webdavErrEmbedded', 'webdavErrNoPass', 'webdavErrAuth', 'webdavErrPath', 'webdavErrStatus', 'webdavErrNetwork'];
        const isKnown = knownErrors.some(k => netErr.message && i18n(k) === netErr.message);
        if (isKnown) throw netErr;
        // Map network/fetch errors (TypeError, NetworkError, etc.) to the i18n message
        debugErr('WebDAV test: network-level error', netErr);
        throw new Error(i18n('webdavErrNetwork'));
      }
    }

    // BX-DEV-121 (Bug16): apply layout.settings.syncLevel — what to push to remote.
    function buildSyncPayload() {
      // 66/A-020: every sync/export payload goes through the same sanitize boundary as
      // persistence, so runtime-only diagnostics (__lastSaveError) and computed data
      // (groups, ADR-0007 Q1) never leave the browser.
      const lvl = layout.settings.syncLevel || 'full';
      if (lvl === 'settingsOnly') return stripGroupsForPersist(Object.assign({}, layout, { boxes: [], connections: [], groups: [] }));
      if (lvl === 'boxesOnly') return stripGroupsForPersist(Object.assign({}, layout, { settings: null }));
      return stripGroupsForPersist(layout);
    }
    window.__bxSync = window.__bxSync || {};
    window.__bxSync.buildSyncPayload = buildSyncPayload;

    async function backupToWebDAV() {
      const url = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
      const user = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
      const pass = webdavPassInput?.value || '';
      debug('WebDAV backup: starting', { url, user: user ? '(set)' : '(empty)' });
      if (!url) throw new Error(i18n('webdavErrNoUrl'));
      // BX-AUD-01/03 front-end guard: private hosts, scheme, length, embedded creds
      if (!isSafeExtUrl(url)) {
        if (url.length > 2048) throw new Error(i18n('webdavErrUrlTooLong'));
        let _u; try { _u = new URL(url); } catch (_) { throw new Error(i18n('webdavErrNetwork')); }
        if (_u.protocol !== 'https:') throw new Error(i18n('webdavErrHttps'));
        if (_u.username || _u.password) throw new Error(i18n('webdavErrEmbedded'));
        throw new Error(i18n('webdavErrBlockedHost'));
      }
      // Resolve file URL — reuse the shared helper (honors custom sync filename).
      const { fileUrl } = resolveWebDAVFileUrl(url);
      debug('WebDAV backup: resolved file URL', fileUrl);
      if (user && !pass) throw new Error(i18n('webdavErrNoPass'));
      const body = JSON.stringify(buildSyncPayload(), null, 2);
      debug('WebDAV backup: sending PUT', { size: body.length });
      try {
        let status, ok;
        // Primary: route through background SW
        try {
          const resp = await sendToBackground({ type: 'webdav-put', url: fileUrl, user, pass, body });
          if (resp.needPermission) {
            debug('WebDAV backup: needPermission, requesting origin', resp.origin);
            const granted = await ensureWebDAVPermissionGranted(fileUrl);
            if (!granted) throw new Error(i18n('webdavErrNetwork'));
            const resp2 = await sendToBackground({ type: 'webdav-put', url: fileUrl, user, pass, body });
            status = resp2.status; ok = resp2.ok;
          } else {
            status = resp.status; ok = resp.ok;
          }
          debug('WebDAV backup via BG: PUT', { status, ok });
        } catch (bgErr) {
          debug('WebDAV backup via BG failed, falling back to direct fetch', bgErr && bgErr.message ? bgErr.message : bgErr);
          const h = new Headers({ 'Content-Type': 'application/json', 'Overwrite': 'T' });
          if (user) h.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
          const resp = await fetch(fileUrl, { method: 'PUT', headers: h, body, redirect: 'manual' });
          if (resp.type === 'opaqueredirect') throw new Error(i18n('webdavErrNetwork'));
          status = resp.status; ok = resp.ok;
          debug('WebDAV backup direct: PUT', { status, ok });
        }
        if (status === 401 || status === 403) {
          throw new Error(i18n('webdavErrAuth', [status]));
        }
        if (status === 409) {
          throw new Error(i18n('webdavErrConflict'));
        }
        if (!ok && status !== 201 && status !== 204) {
          throw new Error(i18n('webdavErrPut', [status]));
        }
        debug('WebDAV backup: success');
        return true;
      } catch (netErr) {
        const knownErrors = ['webdavErrNoUrl', 'webdavErrHttps', 'webdavErrEmbedded', 'webdavErrNoPass', 'webdavErrAuth', 'webdavErrPath', 'webdavErrStatus', 'webdavErrPut', 'webdavErrConflict', 'webdavErrNetwork'];
        const isKnown = knownErrors.some(k => netErr.message && i18n(k) === netErr.message);
        if (isKnown) throw netErr;
        debugErr('WebDAV backup: network-level error', netErr);
        throw new Error(i18n('webdavErrNetwork'));
      }
    }
    // BX-DEV-114: expose for __boxingDebug (which runs in outer scope)
    window.__boxingTestWebDAV = testWebDAVConnection;
    window.__boxingBackupWebDAV = backupToWebDAV;

    // ── BX-DEV-SYNC: WebDAV two-way sync (replaces blind backup) ───────────
    // First sync (lastSyncAt === 0) + cloud exists → pull cloud over local.
    // Otherwise: compare layout._meta.updatedAt vs cloud._meta.updatedAt — newer wins.
    // Data-loss guard runs BEFORE any destructive upload: if currentLocalBoxCount
    // < 50% of lastKnownBoxCountBaseline, prompt user to restore from cloud instead.

    function computeBoxCount(layoutObj) {
      const large = Array.isArray(layoutObj?.boxes) ? layoutObj.boxes.length : 0;
      let small = 0;
      for (const b of (layoutObj?.boxes || [])) {
        if (Array.isArray(b?.children)) small += b.children.length;
      }
      return { large, small, total: large + small };
    }

    function getBaselineBoxCount() {
      return Number(layout.settings?.lastKnownBoxCountBaseline) || 0;
    }

    function setBaselineBoxCount(n) {
      if (!layout.settings) layout.settings = {};
      layout.settings.lastKnownBoxCountBaseline = n;
    }

    // BX-DATALOSS-V2: improved data-loss detection.
    // Combines three independent signals so intentional deletes and sync recoveries do NOT
    // false-trigger, while true data-loss (stale/truncated local after refresh or bad merge)
    // is caught:
    //   1) local total dropped to <50% of the renormalized baseline AND >=2 boxes missing;
    //   2) local total dropped to <70% of baseline AND >=3 boxes missing (stricter ratio for
    //      medium drops, avoids catching normal user 1-2 deletions);
    // Signal must hold for the *current* sync attempt only (not a transient state), and
    // intentionally does not run when baseline is itself 0/<2 (fresh installs).
    function detectDataLoss() {
      const baseline = getBaselineBoxCount();
      if (!baseline || baseline < 2) return false;
      const cur = computeBoxCount(layout).total;
      if (cur >= baseline) return false; // local grew or held — not loss
      const drop = baseline - cur;
      // Tier 1: catastrophic drop (>50% missing, >=2 boxes).
      const catastrophic = cur < baseline * 0.5 && drop >= 2;
      // Tier 2: significant drop (>=30% missing) requires at least 3 boxes lost —
      // guards against accidentally triggering on 1-2 intentional user deletions.
      const significant = cur < baseline * 0.7 && drop >= 3;
      return catastrophic || significant;
    }

    async function webdavGetCloud(fileUrl, user, pass) {
      let status, body;
      try {
        const resp = await sendToBackground({ type: 'webdav-get', url: fileUrl, user, pass });
        status = resp.status; body = resp.body;
      } catch (bgErr) {
        debug('WebDAV GET via BG failed, trying direct fetch', bgErr && bgErr.message ? bgErr.message : bgErr);
        const h = new Headers();
        if (user) h.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
        const resp = await fetch(fileUrl, { method: 'GET', headers: h, redirect: 'follow' });
        status = resp.status; body = resp.ok ? await resp.text() : null;
      }
      debug('WebDAV GET cloud:', { status, bodyLen: body?.length || 0 });
      if (status === 404) return null;
      if (status === 401 || status === 403) throw new Error(i18n('webdavErrAuth', [status]));
      if (status >= 400) throw new Error(i18n('syncErrGetFailed', [status]));
      if (!body) return null;
      try { return JSON.parse(body); } catch (_) { throw new Error(i18n('syncErrParseFailed')); }
    }

    async function webdavPutLocal(fileUrl, user, pass, body) {
      let status, ok;
      try {
        const resp = await sendToBackground({ type: 'webdav-put', url: fileUrl, user, pass, body });
        status = resp.status; ok = resp.ok;
      } catch (bgErr) {
        debug('WebDAV PUT via BG failed, trying direct fetch', bgErr && bgErr.message ? bgErr.message : bgErr);
        const h = new Headers({ 'Content-Type': 'application/json', 'Overwrite': 'T' });
        if (user) h.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
        const resp = await fetch(fileUrl, { method: 'PUT', headers: h, body, redirect: 'follow' });
        status = resp.status; ok = resp.ok;
      }
      if (status === 401 || status === 403) throw new Error(i18n('webdavErrAuth', [status]));
      if (status === 409) throw new Error(i18n('webdavErrConflict'));
      if (!ok && status !== 201 && status !== 204) throw new Error(i18n('webdavErrPut', [status]));
      return true;
    }

    // Resolve the cloud file URL the same way backupToWebDAV does.
    function resolveWebDAVFileUrl(urlInput) {
      const url = urlInput.trim();
      if (!url) return { url: '', fileUrl: '' };
      const target = new URL(url);
      let basePath = target.href;
      if (!basePath.endsWith('/')) basePath += '/';
      // BX-DEV-121 (Bug16): honor user-set sync filename; default boxing-backup.json.
      const customName = (layout.settings.syncFileName || '').trim().replace(/[\\/]/g, '_').replace(/[\x00-\x1f]/g, '');
      const BACKUP_FILENAME = customName || 'boxing-backup.json';
      let fileUrl = basePath.endsWith(BACKUP_FILENAME) ? basePath : basePath + BACKUP_FILENAME;
      if (target.href.endsWith('.json')) fileUrl = target.href;
      return { url, fileUrl };
    }
    window.__bxSync = window.__bxSync || {};
    window.__bxSync.resolveWebDAVFileUrl = resolveWebDAVFileUrl;

    // Two-way sync. Returns { direction: 'pull'|'push'|'none', cloudBoxes, localBoxes }.
    // ADR-0009: Outbox-style field-level merge for concurrent WebDAV changes
    function mergeLayoutFields(cloudData, localData) {
      try {
        const cloud = migrateLayout(cloudData);
        const local = migrateLayout(localData);
        // Ticket 44 (spec D4): same-field divergence collects the cloud side verbatim as
        // a conflict copy — the merged main layout keeps the existing local-wins heuristic,
        // but neither side is silently dropped any more.
        const conflictCopies = [];
        // Merge boxes by id — non-overlapping field changes merge automatically
        const boxMap = new Map();
        // Start with cloud boxes
        for (const cb of (cloud.boxes || [])) boxMap.set(cb.id, { ...cb });
        // Merge local box changes — only update fields that differ from cloud
        for (const lb of (local.boxes || [])) {
          const existing = boxMap.get(lb.id);
          if (!existing) { boxMap.set(lb.id, { ...lb }); continue; }
          // Same-field divergence check: if both changed the same field to different values, bail
          const divergedFields = [];
          for (const key of Object.keys(lb)) {
            if (JSON.stringify(existing[key]) !== JSON.stringify(lb[key])) {
              divergedFields.push(key);
            }
          }
          if (divergedFields.length > 0) conflictCopies.push({ ...existing });
          // ponytail: if >3 fields diverge, consider it a full edit and keep local (newer)
          if (divergedFields.length > 3) {
            boxMap.set(lb.id, { ...lb });
          } else {
            // Merge non-overlapping: local overrides cloud for diverged fields (local is newer)
            boxMap.set(lb.id, { ...existing, ...lb });
          }
        }
        // Merge connections — union of both sets (dedup by from+to pair)
        const connSet = new Set();
        const mergedConns = [];
        const allConns = [...(cloud.connections || []), ...(local.connections || [])];
        for (const c of allConns) {
          const key = (c.from || c.source || '') + ':' + (c.to || c.target || '');
          if (!connSet.has(key)) { connSet.add(key); mergedConns.push(c); }
        }
        // Settings: local overrides cloud (settings are user preferences, local is authoritative)
        const merged = {
          ...cloud,
          ...local,
          boxes: Array.from(boxMap.values()),
          connections: mergedConns,
          groups: [], // ADR-0007: runtime mirror only
          schemaVersion: Math.max(cloud.schemaVersion || 1, local.schemaVersion || 1),
          settings: { ...cloud.settings, ...local.settings },
          _meta: { ...local._meta, updatedAt: Date.now() }
        };
        return { merged, conflicts: conflictCopies };
      } catch (e) {
        debugErr('mergeLayoutFields', e);
        return null; // signal merge failure → conflict-copy guard at the call site (ticket 44)
      }
    }

    async function syncWithWebDAV(opts = {}) {
      const bypassLossGuard = !!opts.bypassLossGuard;
      const url = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
      const user = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
      const pass = webdavPassInput?.value || '';
      debug('WebDAV sync: starting', { url, user: user ? '(set)' : '(empty)' });
      if (!url) throw new Error(i18n('webdavErrNoUrl'));
      checkUrlValid(url);
      if (user && !pass) throw new Error(i18n('webdavErrNoPass'));
      const { fileUrl } = resolveWebDAVFileUrl(url);

      // Data-loss guard — blocks destructive upload unless user confirms restore-from-cloud.
      if (!bypassLossGuard && detectDataLoss()) {
        const baseline = getBaselineBoxCount();
        const cur = computeBoxCount(layout).total;
        const msg = i18n('syncErrPartialLoss', [baseline, cur]);
        if (typeof confirm === 'function' && confirm(msg)) {
          // Try to restore from cloud (force pull). If user declines after all, abort sync.
          const cloud = await webdavGetCloud(fileUrl, user, pass);
          if (cloud && typeof cloud === 'object' && Array.isArray(cloud.boxes)) {
            // Replace local layout with cloud (keep sync meta).
            // Ticket 44: explicit user-confirmed overwrite — newer-wins is allowed HERE,
            // but the discarded local side is archived as a conflict copy first (never silent).
            await archiveConflictLayouts(stripGroupsForPersist(layout), { reason: 'webdav-data-loss-restore', side: 'local' });
            // Ticket 51 (spec W6-D2): copy-before-overwrite unified — the conflict
            // archive keeps the payload verbatim, but the snapshot makes it a
            // one-click Time Machine point like every other overwrite entry.
            if (computeBoxCount(layout).total > 0) await saveSnapshot();
            const savedMeta = layout._meta;
            const savedSettings = layout.settings;
            setLayout(cloud);
            if (savedSettings) layout.settings = { ...cloud.settings, ...savedSettings };
            if (savedMeta) layout._meta = { ...cloud._meta, ...savedMeta, updatedAt: Date.now(), writerId };
            layout._meta = layout._meta || {};
            layout._meta.updatedAt = Date.now();
            layout._meta.writerId = writerId;
            const lossRev = (Number(cloud._meta?.revision) || 0) + 1;
            layout._meta.revision = lossRev;
            // Direct write — avoid saveLayout restoring the truncated local.
            try {
              await directSetBoxingLayout(stripGroupsForPersist(layout));
            } catch (e) { debugErr('WebDAV sync: data-loss restore set failed', e); }
            renderCanvas();
            const cnt = computeBoxCount(layout).total;
            setBaselineBoxCount(cnt);
            debug('WebDAV sync: cloud restored after data-loss guard', { boxes: cnt });
            return { direction: 'pull', cloudBoxes: cnt, localBoxes: cnt, restoredAfterLoss: true };
          }
          throw new Error(i18n('syncErrCloudRestoreFailed', ['cloud missing or invalid']));
        }
        debug('WebDAV sync: data-loss guard triggered but user declined restore; aborting upload');
        throw new Error(i18n('syncErrPartialLossTitle'));
      }

      // GET cloud file.
      const cloud = await webdavGetCloud(fileUrl, user, pass);
      const lastSyncAt = Number(layout.settings?.lastSyncAt) || 0;
      const localUpdatedAt = Number(layout._meta?.updatedAt) || 0;
      const cloudUpdatedAt = cloud && typeof cloud === 'object' ? (Number(cloud._meta?.updatedAt) || 0) : 0;
      debug('WebDAV sync: timestamps', { localUpdatedAt, cloudUpdatedAt, lastSyncAt, cloudExists: !!cloud });

      // First sync (never synced before) + cloud exists → pull cloud over local.
      // Use direct storage.set (bypass saveLayout merge) so the old local layout is fully replaced, not merged.
      // BX-FATAL-FIX: ONLY blindly pull cloud over local when local is empty. If local has
      // data (e.g. user added content after install, or lastSyncAt was lost by a stale
      // storage migration / cross-tab state loss), do NOT overwrite — fall through to
      // timestamp comparison so the newer side wins. This prevents the fatal "refresh
      // reverts to first-sync" scenario where user's freshly-added content is wiped by
      // stale cloud data because lastSyncAt somehow reads as 0 after reload.
      const localBoxCountTotal = computeBoxCount(layout).total;
      if (lastSyncAt === 0 && cloud && Array.isArray(cloud.boxes) && localBoxCountTotal === 0) {
        const savedSettings = layout.settings;
        const savedMeta = layout._meta;
        setLayout(cloud);
        if (savedSettings) layout.settings = { ...cloud.settings, ...savedSettings };
        if (savedMeta) layout._meta = { ...cloud._meta, ...savedMeta, updatedAt: Date.now(), writerId };
        layout._meta = layout._meta || {};
        layout._meta.updatedAt = Date.now();
        layout._meta.writerId = writerId;
        const newRevision = (Number(cloud._meta?.revision) || 0) + 1;
        layout._meta.revision = newRevision;
        layout.settings.lastSyncAt = Date.now();
        setBaselineBoxCount(computeBoxCount(layout).total);
        // Direct write — do NOT merge with old local (we are intentionally discarding it).
        try {
          await directSetBoxingLayout(stripGroupsForPersist(layout));
        } catch (e) { debugErr('WebDAV sync: first-time pull set failed', e); }
        renderCanvas();
        debug('WebDAV sync: first-time pull', { boxes: layout.boxes.length });
        return { direction: 'pull', cloudBoxes: layout.boxes.length, localBoxes: layout.boxes.length, firstSync: true };
      }

      // ADR-0009: Outbox conflict detection — if both sides changed since last sync, merge fields.
      if (cloud && Array.isArray(cloud.boxes)) {
        // ADR-0009: concurrent change detection — both changed since lastSyncAt
        const cloudChangedAfterSync = cloudUpdatedAt > lastSyncAt;
        const localChangedAfterSync = localUpdatedAt > lastSyncAt;
        if (cloudChangedAfterSync && localChangedAfterSync && cloud?._meta?.writerId !== writerId) {
          // Both sides diverged — try field-level auto-merge
          debug('WebDAV sync: concurrent change detected, attempting field-level merge');
          const mergeResult = mergeLayoutFields(cloud, layout);
          if (mergeResult && mergeResult.merged) {
            if (mergeResult.conflicts.length) {
              await archiveConflictLayouts({ boxes: mergeResult.conflicts }, { reason: 'webdav-field-conflict', side: 'cloud' });
            }
            setLayout(mergeResult.merged);
            layout._meta = layout._meta || {};
            layout._meta.updatedAt = Date.now();
            layout._meta.writerId = writerId;
            layout._meta.revision = (Number(cloud._meta?.revision) || 0) + 1;
            layout.settings.lastSyncAt = Date.now();
            await directSetBoxingLayout(stripGroupsForPersist(layout));
            renderCanvas();
            setBaselineBoxCount(computeBoxCount(layout).total);
            debug('WebDAV sync: field-level merge complete', { boxes: layout.boxes.length });
            return { direction: 'merge', cloudBoxes: cloud.boxes.length, localBoxes: layout.boxes.length, merged: true, conflicts: mergeResult.conflicts.length };
          }
          // Ticket 44 (spec D4): merge threw — a silent newer-wins here would drop one
          // side. Archive the side the LWW write is about to discard, THEN land the newer
          // main copy (both sides survive: winner on boxingLayout, loser on the conflict key).
          debugWarn('WebDAV sync: field-level merge failed — archiving the losing side as a conflict copy before newer-wins');
          if (cloudUpdatedAt >= localUpdatedAt && cloud?._meta?.writerId !== writerId) {
            await archiveConflictLayouts(stripGroupsForPersist(layout), { reason: 'webdav-merge-failed', side: 'local' });
          } else {
            await archiveConflictLayouts({ boxes: (cloud.boxes || []) }, { reason: 'webdav-merge-failed', side: 'cloud' });
          }
        }
        // ADR-0009: original newer-wins logic
        if (cloudUpdatedAt >= localUpdatedAt && cloud?._meta?.writerId !== writerId) {
          // Cloud is newer or equal-but-different-writer → pull.
          // Ticket 51 (spec W6-D2 / D-006): 覆盖必先本地副本 — this pull fully
          // replaces the main key, so snapshot the discarded local side FIRST
          // (ADR-0009 COW discipline; the import-side twin lives in settings-ui's
          // overwrite-confirmed branch, and the data-loss / merge-failure paths
          // already keep a verbatim conflict copy).
          if (computeBoxCount(layout).total > 0) await saveSnapshot();
          // BX-DEV-138: preserve local connections/groups when cloud payload lacks them
          // (settingsOnly sync mode strips connections/groups from the uploaded payload).
          const savedSettings = layout.settings;
          const savedMeta = layout._meta;
          const savedConns = Array.isArray(layout.connections) ? layout.connections : [];
          setLayout(cloud);
          if (savedSettings) layout.settings = { ...cloud.settings, ...savedSettings };
          if (savedMeta) layout._meta = { ...cloud._meta, ...savedMeta, updatedAt: Date.now(), writerId };
          if (!Array.isArray(layout.connections) || layout.connections.length === 0) layout.connections = savedConns;
          layout._meta = layout._meta || {};
          layout._meta.updatedAt = Date.now();
          layout._meta.writerId = writerId;
          const newRevision2 = (Number(cloud._meta?.revision) || 0) + 1;
          layout._meta.revision = newRevision2;
          layout.settings.lastSyncAt = Date.now();
          setBaselineBoxCount(computeBoxCount(layout).total);
          // Direct write — avoid saveLayout merging old local boxes back in.
          try {
            await directSetBoxingLayout(stripGroupsForPersist(layout));
          } catch (e) { debugErr('WebDAV sync: cloud-newer pull set failed', e); }
          renderCanvas();
          debug('WebDAV sync: cloud newer, pulled', { boxes: layout.boxes.length });
          return { direction: 'pull', cloudBoxes: layout.boxes.length, localBoxes: layout.boxes.length };
        }
        // Local is newer → upload local over cloud.
        const body = JSON.stringify(stripGroupsForPersist(layout), null, 2);
        await webdavPutLocal(fileUrl, user, pass, body);
        layout.settings.lastSyncAt = Date.now();
        setBaselineBoxCount(computeBoxCount(layout).total);
        saveLayout();
        debug('WebDAV sync: local newer, pushed', { boxes: layout.boxes.length });
        return { direction: 'push', cloudBoxes: cloud.boxes.length, localBoxes: layout.boxes.length };
      }

      // Cloud absent or invalid → upload local.
      const body = JSON.stringify(stripGroupsForPersist(layout), null, 2);
      await webdavPutLocal(fileUrl, user, pass, body);
      layout.settings.lastSyncAt = Date.now();
      setBaselineBoxCount(computeBoxCount(layout).total);
      saveLayout();
      debug('WebDAV sync: no cloud, pushed local', { boxes: layout.boxes.length });
      return { direction: 'push', cloudBoxes: 0, localBoxes: layout.boxes.length };
    }

    function checkUrlValid(urlStr) {
      if (typeof urlStr !== 'string' || urlStr.length > 2048) throw new Error(i18n('webdavErrUrlTooLong'));
      const target = new URL(urlStr);
      if (target.protocol !== 'https:') throw new Error(i18n('webdavErrHttps'));
      if (target.username || target.password) throw new Error(i18n('webdavErrEmbedded'));
      if (AUD_PRIVATE_HOST_RE.test((target.hostname || '').toLowerCase())) throw new Error(i18n('webdavErrBlockedHost'));
    }

    // Expose sync for debug + tests.
    window.__boxingSyncWebDAV = syncWithWebDAV;

    async function backupToGist() {
      const token = gistTokenInput?.value?.trim();
      if (!token) throw new Error('GitHub token not configured');
      const gistId = layout.settings.gistId || gistIdInput?.value?.trim();
      if (gistId && !/^[a-f0-9]{5,64}$/i.test(gistId)) throw new Error('Invalid Gist ID');
      const content = JSON.stringify(buildSyncPayload(), null, 2);
      // BX-DEV-121 (Bug16): honor custom sync filename; default boxing-backup.json.
      const _rawName = (layout.settings.syncFileName || '').trim().replace(/[\\/]/g, '_').replace(/[\x00-\x1f]/g, '');
      const GIST_FILENAME = _rawName || 'boxing-backup.json';
      const h = new Headers({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' });
      let resp, result;
      if (gistId) {
        resp = await fetch('https://api.github.com/gists/' + gistId, {
          method: 'PATCH', headers: h, body: JSON.stringify({ files: { [GIST_FILENAME]: { content } } })
        });
      } else {
        resp = await fetch('https://api.github.com/gists', {
          method: 'POST', headers: h,
          body: JSON.stringify({ public: false, files: { [GIST_FILENAME]: { content } }, description: 'Boxing extension backup' })
        });
      }
      if (!resp.ok) throw new Error('GitHub API ' + resp.status);
      result = await resp.json();
      if (result.id && !layout.settings.gistId) {
        layout.settings.gistId = result.id;
        if (gistIdInput) gistIdInput.value = result.id;
        saveLayout();
      }
      return true;
    }
    window.__bxSync = window.__bxSync || {};
    window.__bxSync.backupToGist = backupToGist;

    function backupToLocal() {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const blob = new Blob([JSON.stringify(stripGroupsForPersist(layout), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'boxing-backup-' + ts + '.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    // Unified backup dispatcher (only used for remote providers)
    // Unified sync dispatcher (only used for remote providers)
    async function performBackup() {
      const p = syncProviderSelect?.value || 'local';
      try {
        if (p === 'webdav') { await syncWithWebDAV(); debug('WebDAV sync ok'); }
        else if (p === 'gist') { await backupToGist(); debug('Gist backup ok'); }
        await saveSnapshot(); // ADR-0009: always save versioned snapshot
        if (p === 'local') backupToLocal();
        layout.settings.lastBackupAt = Date.now();
        updateLastBackupDisplay();
        saveLayout();
      } catch (e) { debugErr('Backup failed', e); if (p !== 'local') backupToLocal(); }
    }

    // ── Auto-backup scheduler ──────────────────────
    let autoBackupTimer = null;
    let lastAutoBackupTs = 0;

    // ADR-0009: chrome.alarms replaces setInterval — survives NTP page close + SW eviction.
    // Listener registered ONCE at module scope; setupAutoBackup only creates/refreshes the alarm.
    // Avoids leaking duplicate listeners on every settings change.
    let __autoBackupAlarmListenerRegistered = false;
    function ensureAutoBackupAlarmListener() {
      if (__autoBackupAlarmListenerRegistered) return;
      __autoBackupAlarmListenerRegistered = true;
      try {
        if (typeof chrome !== 'undefined' && chrome.alarms && chrome.alarms.onAlarm) {
          chrome.alarms.onAlarm.addListener(function alarmHandler(alarm) {
            if (alarm.name !== 'boxing-auto-backup') return;
            const sec = layout.settings.autoBackupInterval || 0;
            if (sec < 3600) return;
            const now = Date.now();
            if (lastAutoBackupTs && (now - lastAutoBackupTs) < sec * 900) { debug('Auto-backup skipped: too close to last'); return; }
            lastAutoBackupTs = now;
            performBackup().then(() => debug('Auto-backup (alarm) done')).catch(e => debugErr('Auto-backup (alarm) err', e));
          });
        }
      } catch (e) { debugWarn('chrome.alarms.onAlarm unavailable', e); }
    }

        // ADR-0009: chrome.alarms replaces setInterval — survives NTP page close + SW eviction
    function setupAutoBackup(sec) {
      if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
      if (!sec || sec < 3600) return;  // minimum 1 hour
      // Try chrome.alarms first (works even when NTP page is closed)
      try {
        if (typeof chrome !== 'undefined' && chrome.alarms) {
          ensureAutoBackupAlarmListener();
          chrome.alarms.create('boxing-auto-backup', { periodInMinutes: Math.ceil(sec / 60) });
          debug('Auto-backup via chrome.alarms, period=' + Math.ceil(sec / 60) + 'min');
          return;
        }
      } catch (e) { debugWarn('chrome.alarms not available, falling back to setInterval', e); }
      // Fallback: setInterval (only works while NTP page is open)
      autoBackupTimer = setInterval(async () => {
        const now = Date.now();
        if (lastAutoBackupTs && (now - lastAutoBackupTs) < sec * 900) { debug('Auto-backup skipped: too close to last'); return; }
        lastAutoBackupTs = now;
        try { await performBackup(); debug('Auto-backup done'); } catch (e) { debugErr('Auto-backup err', e); }
      }, sec * 1000);
    }

// Init-time wiring, called from ntp.js init() at the exact positions these statements
// originally occupied (after loadLayout/loadSettings — they read layout.settings).
export function bindSyncBackupUi() {
    // Restore persisted config
    const syncProviderVal = layout.settings.syncProvider || 'local';
    if (syncProviderSelect) syncProviderSelect.value = syncProviderVal;
    if (layout.settings.webdavUrl && webdavUrlInput) webdavUrlInput.value = layout.settings.webdavUrl;
    if (layout.settings.webdavUser && webdavUserInput) webdavUserInput.value = layout.settings.webdavUser;
    if (layout.settings.gistId && gistIdInput) gistIdInput.value = layout.settings.gistId;
    // BX-DEV-121 (Bug16): sync level + filename (shared across all remote providers)
    if (syncLevelSelect) syncLevelSelect.value = layout.settings.syncLevel || 'full';
    if (syncFilenameInput) syncFilenameInput.value = layout.settings.syncFileName || '';
    // Decrypt and fill sensitive fields — awaited so test button waits for password
    if (webdavTestBtn) webdavTestBtn.disabled = true; // BX-DEV-114: disable until password is ready
    (async () => {
      try {
        if (layout.settings._encWebdavPass && webdavPassInput) webdavPassInput.value = await decryptCredential(layout.settings._encWebdavPass);
        if (layout.settings._encGistToken && gistTokenInput) gistTokenInput.value = await decryptCredential(layout.settings._encGistToken);
        debug('WebDAV: credentials decrypted successfully');
      } catch (e) {
        debugErr('WebDAV: credential decrypt failed', e);
      } finally {
        if (webdavTestBtn) webdavTestBtn.disabled = false;
      }
    })();

    updateLastBackupDisplay();

    updateSyncConfigVisibility();

    // BX-DEV-121 (Bug16): sync level + filename persist on change
    syncLevelSelect?.addEventListener('change', () => {
      layout.settings.syncLevel = syncLevelSelect.value === 'settingsOnly' || syncLevelSelect.value === 'boxesOnly' ? syncLevelSelect.value : 'full';
      saveLayout();
    });
    syncFilenameInput?.addEventListener('input', () => {
      let v = (syncFilenameInput.value || '').trim();
      v = v.replace(/[\\/]/g, '_').replace(/[\x00-\x1f]/g, '');
      syncFilenameInput.value = v;
      layout.settings.syncFileName = v;
      saveLayout();
    });
    syncProviderSelect?.addEventListener('change', () => {
      layout.settings.syncProvider = syncProviderSelect.value;
      updateSyncConfigVisibility();
      saveLayout();
    });

    // Persist + encrypt on blur
    [webdavUrlInput, webdavUserInput].forEach(inp => inp?.addEventListener('blur', () => {
      // Ticket 59 (42R leftover): empty-credential no-change guard — blur used to
      // saveLayout() unconditionally even when neither field diverged from settings.
      const urlChanged = !!webdavUrlInput && webdavUrlInput.value.trim() !== (layout.settings.webdavUrl || '');
      const userChanged = !!webdavUserInput && webdavUserInput.value.trim() !== (layout.settings.webdavUser || '');
      if (!urlChanged && !userChanged) return;
      if (urlChanged) layout.settings.webdavUrl = webdavUrlInput.value.trim();
      if (userChanged) layout.settings.webdavUser = webdavUserInput.value.trim();
      saveLayout();
    }));
    // BX-DEV-111M: debounced input listeners — survive close without blur (browser close, tab close).
    let __credDebounceTimer = null;
    function __scheduleCredFlush() {
      if (__credDebounceTimer) clearTimeout(__credDebounceTimer);
      __credDebounceTimer = setTimeout(() => { __credDebounceTimer = null; flushUnsavedCredentials(); }, 800);
    }
    // Commit synchronous plain fields instantly (cheap), defer the async encryption via debounce.
    [webdavUrlInput, webdavUserInput].forEach(inp => inp?.addEventListener('input', () => {
      if (webdavUrlInput) layout.settings.webdavUrl = webdavUrlInput.value.trim();
      if (webdavUserInput) layout.settings.webdavUser = webdavUserInput.value.trim();
      __scheduleCredFlush();
    }));
    webdavPassInput?.addEventListener('input', __scheduleCredFlush);
    gistTokenInput?.addEventListener('input', __scheduleCredFlush);
    // Keep blur for immediate commit on tabbing away.
    webdavPassInput?.addEventListener('blur', () => { if (__credDebounceTimer) { clearTimeout(__credDebounceTimer); __credDebounceTimer = null; } flushUnsavedCredentials(); });
    gistTokenInput?.addEventListener('blur', () => { if (__credDebounceTimer) { clearTimeout(__credDebounceTimer); __credDebounceTimer = null; } flushUnsavedCredentials(); });
    // BX-DEV-111M: flush helper — encrypts current input values into layout.settings then saveLayout.
    // Safe-no-op when called from contexts without settings inputs (early startup, etc.).
    let __credFlushInFlight = false;
    async function flushUnsavedCredentials() {
      if (__credFlushInFlight) return;
      const hasInputs = !!(webdavPassInput || webdavUrlInput || webdavUserInput || gistTokenInput);
      if (!hasInputs) return;
      try {
        const webdavUrlCur = webdavUrlInput ? webdavUrlInput.value.trim() : layout.settings.webdavUrl;
        const webdavUserCur = webdavUserInput ? webdavUserInput.value.trim() : layout.settings.webdavUser;
        const passCur = webdavPassInput ? webdavPassInput.value : '';
        const gistCur = gistTokenInput ? gistTokenInput.value.trim() : '';
        // Ticket 59 (42R leftover): empty-credential no-change guard. flushUnsavedCredentials
        // runs on pagehide/beforeunload/visibilitychange/closeSettingsModal; with no
        // credentials it used to write layout.settings._enc* = null unconditionally and
        // saveLayout() — a redundant boxingLayout write on every page teardown (the 42R
        // unload write-back root cause). Skip when nothing diverged AND no credential
        // text is present (an existing stored credential with empty inputs is NOT cleared —
        // blank inputs no longer wipe _enc*).
        const urlChanged = webdavUrlInput && webdavUrlCur !== (layout.settings.webdavUrl || '');
        const userChanged = webdavUserInput && webdavUserCur !== (layout.settings.webdavUser || '');
        const passChanged = webdavPassInput && passCur && passCur !== (layout.settings.webdavPass || '');
        const gistChanged = gistTokenInput && gistCur && gistCur !== (layout.settings.gistToken || '');
        if (!urlChanged && !userChanged && !passChanged && !gistChanged) return;
        if (urlChanged) layout.settings.webdavUrl = webdavUrlCur;
        if (userChanged) layout.settings.webdavUser = webdavUserCur;
        const encPass = passCur ? await encryptCredential(passCur) : null;
        const encGist = gistCur ? await encryptCredential(gistCur) : null;
        layout.settings._encWebdavPass = encPass;
        layout.settings._encGistToken = encGist;
        saveLayout();
        debug('flushUnsavedCredentials: committed', { webdavUrl: webdavUrlCur ? '(set)' : '(empty)', pass: passCur ? '(set)' : '(empty)', gist: gistCur ? '(set)' : '(empty)' });
      } catch (e) { debugErr('flushUnsavedCredentials failed', e); }
    }
    window.__boxingFlushCredentials = flushUnsavedCredentials;
    // WebDAV test connection button
    webdavTestBtn?.addEventListener('click', async () => {
      webdavTestBtn.textContent = i18n('webdavTesting');
      webdavTestBtn.disabled = true;
      try {
        await testWebDAVConnection();
        webdavTestBtn.textContent = i18n('webdavTestOk');
      } catch (e) {
        debugErr('WebDAV test failed', e);
        // Show i18n error if it's a known error, otherwise show the raw message
        const knownErrors = ['webdavErrNoUrl', 'webdavErrHttps', 'webdavErrEmbedded', 'webdavErrNoPass', 'webdavErrAuth', 'webdavErrPath', 'webdavErrStatus', 'webdavErrNetwork'];
        const isKnown = knownErrors.some(k => e.message && i18n(k) === e.message);
        if (isKnown) {
          webdavTestBtn.textContent = e.message;
        } else {
          // Network errors (CORS, NetworkError, etc.) get a friendly i18n message
          debug('WebDAV test: unknown error type, showing network error', e.message);
          webdavTestBtn.textContent = i18n('webdavErrNetwork');
        }
      } finally {
        webdavTestBtn.disabled = false;
        setTimeout(() => { webdavTestBtn.textContent = i18n('webdavTestBtn'); }, 4000);
      }
    });
    backupNowBtn?.addEventListener('click', () => performBackup());
    // ADR-0009: listen for background SW auto-backup trigger
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
        if (msg && msg.type === 'boxing-auto-backup-trigger') {
          debug('Auto-backup triggered by background alarm');
          performBackup().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: e.message }));
          return true; // async response
        }
      });
    }
    if (layout.settings.autoBackupInterval >= 3600) setupAutoBackup(layout.settings.autoBackupInterval);

    const autoBackupSelect = document.getElementById('auto-backup-interval');
    autoBackupSelect?.addEventListener('change', () => {
      layout.settings.autoBackupInterval = parseInt(autoBackupSelect.value, 10) || 0;
      setupAutoBackup(layout.settings.autoBackupInterval);
      saveLayout();
    });
    if (layout.settings.autoBackupInterval && autoBackupSelect) autoBackupSelect.value = String(layout.settings.autoBackupInterval);
}
