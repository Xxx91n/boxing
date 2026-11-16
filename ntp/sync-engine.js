// Boxing — sync/backup engine (ticket 10, architecture-recovery).
// WebDAV/Gist transport + two-way sync with outbox-style field-level merge +
// background SW auto-backup coordination + BX-AUD-01/03 front-end URL guard + the sync/backup config UI
// bindings (inputs, credential flush, test/backup buttons, local auto-backup controls).
// Engine layer — persistence only through the ./storage.js facade
// (saveLayout / directSetBoxingLayout / saveSnapshot / stripGroupsForPersist); shared state
// via ./state.js singletons (live bindings).

import { layout, setLayout, writerId } from './state.js';
import { saveLayout, saveSnapshot, directSetBoxingLayout, stripGroupsForPersist, archiveConflictLayouts, getSyncBase, setSyncBase, getAutoBackupState, getAutoBackupStateStrict, setAutoBackupState, getWebDAVPendingPermission, setWebDAVPendingPermission, clearWebDAVPendingPermission, getGistPendingPermission, setGistPendingPermission, clearGistPendingPermission } from './storage.js';
import { migrateLayout, mergeLayoutThreeWay, sanitizeLayoutForBackup, redactUrlForLog } from './utils.js';
import { i18n } from './i18n.js';
import { renderCanvas } from './render.js';
import { encryptCredential, decryptCredential } from './credentials.js';

let debug, debugErr, debugWarn;
let refreshDataHealth = null;
let refreshSnapshotHealth = null;
let syncProviderSelect, webdavConfig, gistConfig, webdavUrlInput, webdavUserInput, webdavPassInput, gistTokenInput, gistIdInput, syncLevelSelect, syncFilenameInput, backupNowBtn, remoteBackupZone, lastBackupTimeVal, webdavTestBtn, webdavAllowPrivateInput;
let webdavPermissionBanner, webdavPermissionMsg, webdavPermissionBtn;
let gistPermissionBanner, gistPermissionMsg, gistPermissionBtn;
let localAutoBackupStatusEl, localAutoBackupLastAtEl, localAutoBackupErrorEl, autoBackupUpgradeBox, autoBackupActivateBtn;
let autoBackupRemoteEl, autoBackupRemoteActionEl;
// Ticket 99 (T13): stored-credential danger zone refs — assigned in bindSyncBackupUi
// before updateSyncConfigVisibility() first runs so the visibility toggle is safe.
let syncCredentialDangerZone, deleteOpenBtn, deletePanel, deleteCancelBtn, deleteConfirmBtn, deleteRemoteCheck, deleteStatusEl;

// Ticket 10: inject ntp.js-scope deps (loggers + sync config DOM refs — the refs are declared
// once in ntp.js; duplicate getElementById here would fork their null-ness).
export function initSyncEngineFacade(deps) {
  debug = deps.debug; debugErr = deps.debugErr; debugWarn = deps.debugWarn;
  refreshDataHealth = typeof deps.refreshDataHealth === 'function' ? deps.refreshDataHealth : null;
  refreshSnapshotHealth = typeof deps.refreshSnapshotHealth === 'function' ? deps.refreshSnapshotHealth : refreshDataHealth;
  syncProviderSelect = deps.syncProviderSelect; webdavConfig = deps.webdavConfig; gistConfig = deps.gistConfig;
  webdavUrlInput = deps.webdavUrlInput; webdavUserInput = deps.webdavUserInput; webdavPassInput = deps.webdavPassInput; webdavAllowPrivateInput = deps.webdavAllowPrivateInput;
  gistTokenInput = deps.gistTokenInput; gistIdInput = deps.gistIdInput;
  syncLevelSelect = deps.syncLevelSelect; syncFilenameInput = deps.syncFilenameInput;
  backupNowBtn = deps.backupNowBtn; remoteBackupZone = deps.remoteBackupZone;
  lastBackupTimeVal = deps.lastBackupTimeVal; webdavTestBtn = deps.webdavTestBtn;
}

  // Ticket 111: keyed WebDAV error identity. Sync-path errors carry the i18n key on
  // e.key (message stays the already-interpolated localized text), so classification
  // is key membership. The old e.message === i18n(k) comparison silently failed for
  // parameterized messages (webdavErrAuth/webdavErrPut/webdavErrStatus) and broke on
  // translation collisions; the four per-site whitelists also drifted (ticket 108 /
  // PR #109). The message comparison survives only inside isKnownWebDAVError as a
  // legacy fallback for errors re-wrapped without a key.
  const WEBDAV_ERROR_KEYS = [
    'webdavErrNoUrl', 'webdavErrHttps', 'webdavErrEmbedded', 'webdavErrNoPass',
    'webdavErrAuth', 'webdavErrPath', 'webdavErrStatus', 'webdavErrPut',
    'webdavErrConflict', 'webdavErrNetwork', 'webdavErrUrlTooLong', 'webdavErrBlockedHost',
    'webdavErrQuery', 'webdavErrPermission', 'webdavErrPermissionDenied',
  ];
  function webdavError(key, params) {
    const e = new Error(i18n(key, params));
    e.key = key;
    return e;
  }
  // Ticket #129 (spec #120 D6): a pre-check refusal never leaves the browser, so
  // #123's "nothing was attempted, nothing changes" contract still holds and no
  // snapshot side effect is created. Classify by the shared key list instead of a
  // second hand-written copy: these are the keys that can only appear AFTER a
  // request was sent.
  const WEBDAV_REMOTE_ATTEMPT_KEYS = [
    'webdavErrAuth', 'webdavErrPath', 'webdavErrStatus', 'webdavErrPut',
    'webdavErrConflict', 'webdavErrNetwork',
  ];
  function failedAfterRemoteAttempt(e) {
    if (!e) return false;
    // Ticket #129 review: a provider path can refuse before sending anything (no
    // Gist token, unreadable auto-backup state, unknown pending create). Those mark
    // themselves so they stay "nothing was attempted" like the WebDAV pre-checks.
    if (e.preflight === true) return false;
    // A non-WebDAV error (Gist rejection, fetch TypeError, storage error) came out
    // of a real attempt; only a known local pre-check key means "nothing was sent".
    if (!WEBDAV_ERROR_KEYS.includes(e.key)) return true;
    return WEBDAV_REMOTE_ATTEMPT_KEYS.includes(e.key);
  }
  function isKnownWebDAVError(e) {
    if (e && WEBDAV_ERROR_KEYS.includes(e.key)) return true;
    // Legacy fallback: compares against the UNinterpolated i18n(k), so only
    // unparameterized keys can match here — parameterized messages classify by
    // key or not at all (that asymmetry is the defect this seam fixes).
    return !!(e && e.message && WEBDAV_ERROR_KEYS.some(k => i18n(k) === e.message));
  }

  // BX-AUD-01/03 — front-end WebDAV URL guard (mirrors the stricter guard in background.js).
  // Rejects private / host-only hostnames and oversized URLs so users never silently target a local network.
  // Ticket 82: that private-network refusal is now an explicit opt-in. It stays the default;
  // only a boolean true relaxes it, and the SSRF rationale is unchanged (see README Privacy).
  // Ticket 90: one hostname normaliser + one private-host predicate are shared by every
  // WebDAV entry point (test / export / pull). The pull path used to inline this regex and missed
  // both the IPv6 bracket strip and the .local/.internal suffix rule, so the default deny leaked
  // there only. OWASP SSRF guidance: a guard applied inconsistently across request paths is
  // equivalent to no guard.
  const AUD_PRIVATE_HOST_RE = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:|fc00:|fd00:)/i;

  // URL.hostname keeps the brackets around an IPv6 literal ("[::1]"), so strip them before
  // matching - otherwise the "::1$" / "fe80:" / "fc00:" alternatives never fire.
  function normalizeHostname(u) {
    return (u.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  }
  // Private unless the opt-in is the literal boolean true. Non-public name spaces:
  // .local (mDNS, RFC 6761/6762) and .internal (ICANN-reserved private-use TLD) both
  // resolve only inside the user's own network.
  function isPrivateHost(host, allowPrivateHost) {
    if (allowPrivateHost === true) return false;
    if (AUD_PRIVATE_HOST_RE.test(host)) return true;
    return host.endsWith('.local') || host.endsWith('.internal');
  }
  function isSafeExtUrl(urlStr, allowPrivateHost) {
    // Undefined reads the persisted setting, so the single-argument contract used by existing
    // callers and by Playwright keeps tracking the user's choice. Anything not boolean true denies.
    if (allowPrivateHost === undefined) allowPrivateHost = layout.settings.webdavAllowPrivateHost === true;
    if (typeof urlStr !== 'string' || urlStr.length > 2048) return false;
    let u;
    try { u = new URL(urlStr); } catch (_) { return false; }
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    return !isPrivateHost(normalizeHostname(u), allowPrivateHost);
  }
  window.__boxingIsSafeExtUrl = isSafeExtUrl;

  // Ticket 114 (PR #112 review thread): a WebDAV base URL that carries a query
  // string corrupts the derived fileUrl. resolveWebDAVFileUrl appends the sync
  // filename to the serialized base, so a base of `/dir?token=abc` derived
  // `/dir?token=abc/boxing-backup.json`: the filename landed inside the query
  // value and the request itself degraded to `/dir`. A fragment corrupts
  // identically (`/dir#frag/boxing-backup.json` likewise requests `/dir`), and
  // neither form can be repaired without guessing whether the user meant a query
  // or a path, so every WebDAV entry point refuses it up front. Test / export /
  // pull surface the keyed error webdavErrQuery; remote delete maps the same
  // refusal to its existing localized failure, because that function's contract is
  // to never surface a transport-level error. Same "a guard applied inconsistently
  // across request paths is equivalent to no guard" rule as ticket 90: test /
  // export / pull / remote delete all run this one predicate.
  function webdavUrlHasQueryOrFragment(urlStr) {
    if (typeof urlStr !== 'string') return false;
    let u;
    try { u = new URL(urlStr); } catch (_) { return false; } // malformed → the caller's own parse reports it
    // An empty query (`.../dir?`) serializes to no search component at all, so it
    // is not corruption and stays accepted.
    return u.search !== '' || u.hash !== '';
  }

    // Ticket #129 (spec #120 D6): "#last-backup-time-value" is shared by both lanes
    // (it sits outside #remote-backup-zone). With a remote provider it carries only a
    // real remote success — a local Time Machine snapshot has its own line
    // (#local-auto-backup-last-at) and never stands in for the cloud. Local Only has no
    // cloud at all, so its only meaningful time is that local snapshot.
    // A changed or unsafe target means the stored timestamps describe a DIFFERENT
    // remote file, so they cannot prove the current target ever succeeded.
    const REMOTE_TIME_UNPROVEN_CODES = ['target-changed', 'invalid-target'];
    function isRemoteTimeUnproven(remote) {
      return Boolean(remote && REMOTE_TIME_UNPROVEN_CODES.includes(remote.lastErrorCode));
    }
    function updateLastBackupDisplay(autoState) {
      const localAt = Number(autoState && autoState.local && autoState.local.lastSuccessAt) || 0;
      const remote = autoState && autoState.remote ? autoState.remote : null;
      // Only the provider-tagged cloud success can stand for the selected target.
      // The legacy lastBackupAt carries no target, so it is no longer shown as proof
      // that the current target worked (manual success now writes this same field).
      const cloudAt = Number(remote && remote.lastSuccessAt) || 0;
      if (lastBackupTimeVal) {
        const provider = layout.settings.syncProvider || 'local';
        const remoteBelongsHere = !remote || (
          (!remote.provider || remote.provider === provider) &&
          (!remote.lastSuccessTarget || remote.lastSuccessTarget === currentRemoteTargetKey(provider))
        );
        const displayAt = provider === 'local'
          ? localAt
          : ((!remoteBelongsHere || isRemoteTimeUnproven(remote)) ? 0 : cloudAt);
        lastBackupTimeVal.textContent = displayAt > 0 ? new Date(displayAt).toLocaleString() : i18n('neverText');
      }
      if (localAutoBackupLastAtEl) {
        localAutoBackupLastAtEl.textContent = localAt > 0 ? new Date(localAt).toLocaleString() : i18n('neverText');
      }
    }

    function updateSyncConfigVisibility() {
      const p = syncProviderSelect.value;
      if (remoteBackupZone) remoteBackupZone.hidden = (p !== 'webdav' && p !== 'gist');
      if (webdavConfig) webdavConfig.hidden = p !== 'webdav';
      if (gistConfig) gistConfig.hidden = p !== 'gist';
      // Ticket 99 (T13): the danger zone is reachable whenever stored sync
      // credentials exist — even after the user switches the provider back to
      // local (D5 keeps the envelopes in that case, so they must stay deletable).
      if (syncCredentialDangerZone) syncCredentialDangerZone.hidden = !(layout.settings._encWebdavPass || layout.settings._encGistToken);
    }

    // Route WebDAV through background service worker to bypass CORS.
    // In Firefox MV3, extension page fetch to external HTTPS is blocked even with
    // host_permissions — "NetworkError when attempting to fetch resource".
    // Background SW runs in extension origin, not subject to page CSP/CORS.
    function sendToBackground(msg) {
      // Cross-browser message passing.
      // Firefox browser.* returns a Promise from sendMessage without callback.
      // Chrome chrome.* supports callback-style. Try Promise first, fall back to callback.
      debug('sendToBackground:', msg.type);
      // Ticket 82: single injection point - every webdav-* message carries the opt-in to the
      // background guard so both enforcement layers agree. Absent means deny on that side too.
      if (msg && typeof msg.type === 'string' && msg.type.indexOf('webdav-') === 0) {
        msg.allowPrivateHost = layout.settings.webdavAllowPrivateHost === true;
      }
      // Try Promise-based API first (Firefox browser.* native, Chrome MV3 also supports this)
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        return browser.runtime.sendMessage(msg).then(resp => {
          if (resp && (resp.success || resp.needPermission || resp.blocked)) return resp;
          const err = new Error(resp && resp.error ? resp.error : 'BG error');
          if (resp && resp.reasonCode) err.reasonCode = resp.reasonCode;
          throw err;
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
              if (resp && (resp.success || resp.needPermission || resp.blocked)) resolve(resp);
              else if (resp && !resp.success) {
                const err = new Error(resp.error || 'BG error');
                if (resp.reasonCode) err.reasonCode = resp.reasonCode;
                reject(err);
              }
              else reject(new Error('No response from background'));
            });
          } catch (e) { reject(e); }
        });
      }
      return Promise.reject(new Error('No extension runtime available'));
    }

  // Ticket #123: cross-browser origin permission helpers (Chrome optional_host_permissions +
  // Firefox runtime host_permissions revocation). Never fail open when permissions API throws.
  function getWebDAVOriginPattern(urlOrOrigin) {
    try {
      const clean = typeof urlOrOrigin === 'string' && urlOrOrigin.endsWith('/*')
        ? urlOrOrigin.slice(0, -2)
        : urlOrOrigin;
      const u = new URL(clean);
      if (u.protocol !== 'https:' || !u.hostname) return '';
      return u.protocol + '//' + u.hostname + '/*';
    } catch (_) {
      return '';
    }
  }

  // Ticket #126: the only GitHub origin the unattended Gist backup contacts.
  // Chrome ships https://*/* as an optional host permission; the user grants the
  // narrower api.github.com origin from a real click in this settings page.
  const GIST_API_ORIGIN = 'https://api.github.com/*';

  function displayOriginFromPattern(pattern) {
    if (typeof pattern !== 'string') return '';
    return pattern.endsWith('/*') ? pattern.slice(0, -2) : pattern;
  }

  function canRequestWebDAVUrlSynchronously(rawUrl) {
    return Boolean(rawUrl && isSafeExtUrl(rawUrl) && !webdavUrlHasQueryOrFragment(rawUrl));
  }

  function getPermissionsApi() {
    const apiNs = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    return apiNs && apiNs.permissions ? apiNs.permissions : null;
  }

  function callPermApi(permApi, methodName, details) {
    return new Promise((resolve, reject) => {
      try {
        let settled = false;
        const fn = permApi[methodName];
        if (typeof fn !== 'function') {
          reject(new Error('permissions.' + methodName + ' unavailable'));
          return;
        }
        // Firefox browser.permissions is Promise-only (single-arg); invoke directly so
        // permissions.request stays on the synchronous user-input stack without throwing first.
        if (typeof browser !== 'undefined' && permApi === browser.permissions) {
          const ret1 = fn.call(permApi, details);
          if (ret1 && typeof ret1.then === 'function') ret1.then((v) => resolve(Boolean(v)), reject);
          else resolve(Boolean(ret1));
          return;
        }
        const ret = fn.call(permApi, details, (res) => {
          if (settled) return;
          settled = true;
          const lastErr = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError;
          if (lastErr) reject(new Error(lastErr.message));
          else resolve(Boolean(res));
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (v) => { if (!settled) { settled = true; resolve(Boolean(v)); } },
            (e) => { if (!settled) { settled = true; reject(e); } }
          );
        }
      } catch (e) {
        try {
          const ret1 = permApi[methodName].call(permApi, details);
          if (ret1 && typeof ret1.then === 'function') ret1.then((v) => resolve(Boolean(v)), reject);
          else resolve(Boolean(ret1));
        } catch (e2) {
          reject(e2);
        }
      }
    });
  }

  async function checkWebDAVOriginPermission(urlOrOrigin) {
    const origin = getWebDAVOriginPattern(urlOrOrigin);
    if (!origin) return { supported: true, granted: false, origin: '', error: 'invalid WebDAV origin' };
    const permApi = getPermissionsApi();
    if (!permApi || typeof permApi.contains !== 'function') {
      return { supported: false, granted: false, origin };
    }
    try {
      const granted = await callPermApi(permApi, 'contains', { origins: [origin] });
      return { supported: true, granted, origin };
    } catch (e) {
      return { supported: true, granted: false, origin, error: e && e.message ? e.message : String(e) };
    }
  }

  async function requestWebDAVOriginPermission(urlOrOrigin) {
    const origin = getWebDAVOriginPattern(urlOrOrigin);
    if (!origin) return { supported: true, granted: false, origin: '', error: 'invalid WebDAV origin' };
    const permApi = getPermissionsApi();
    if (!permApi || typeof permApi.request !== 'function') {
      return { supported: false, granted: false, origin };
    }
    try {
      const granted = await callPermApi(permApi, 'request', { origins: [origin] });
      return { supported: true, granted, origin };
    } catch (e) {
      return { supported: true, granted: false, origin, error: e && e.message ? e.message : String(e) };
    }
  }

  let permUiEpoch = 0;
  let grantedFeedbackOrigin = '';
  let grantedFeedbackTimer = null;

  function clearGrantedFeedback() {
    if (grantedFeedbackTimer) {
      clearTimeout(grantedFeedbackTimer);
      grantedFeedbackTimer = null;
    }
    grantedFeedbackOrigin = '';
  }

  function showGrantedFeedback(origin) {
    clearGrantedFeedback();
    grantedFeedbackOrigin = origin;
    if (webdavPermissionBanner && webdavPermissionMsg) {
      const displayOrigin = displayOriginFromPattern(origin) || origin;
      webdavPermissionBanner.hidden = false;
      webdavPermissionBanner.dataset.state = 'granted';
      webdavPermissionMsg.textContent = i18n('webdavPermGrantedStatus', [displayOrigin]);
      if (webdavPermissionBtn) webdavPermissionBtn.hidden = true;
    }
    grantedFeedbackTimer = setTimeout(() => {
      grantedFeedbackOrigin = '';
      grantedFeedbackTimer = null;
      refreshWebDAVPermissionUi();
    }, 4000);
  }

  async function persistPendingPermissionState({ origin, source, reason }) {
    if (!origin) return;
    try {
      let nextReason = reason || 'missing-permission';
      if (nextReason === 'missing-permission') {
        const existing = await getWebDAVPendingPermission();
        if (existing && existing.needed && existing.origin === origin && existing.reason === 'denied') {
          nextReason = 'denied';
        }
      }
      await setWebDAVPendingPermission({
        needed: true,
        origin,
        source: source || 'background',
        reason: nextReason,
        updatedAt: Date.now(),
      });
    } catch (e) {
      debugWarn('persistPendingPermissionState failed', e);
    }
  }

  async function clearPendingPermissionIfOrigin(origin) {
    try {
      const pending = await getWebDAVPendingPermission();
      if (!pending) return;
      if (!origin || pending.origin === origin) {
        await clearWebDAVPendingPermission();
      }
    } catch (e) {
      debugWarn('clearPendingPermissionIfOrigin failed', e);
    }
  }

  async function refreshWebDAVPermissionUi() {
    const myEpoch = ++permUiEpoch;
    if (!webdavPermissionBanner || !webdavPermissionMsg || !webdavPermissionBtn) return;
    const provider = syncProviderSelect?.value || layout.settings.syncProvider || 'local';
    if (provider !== 'webdav') {
      clearGrantedFeedback();
      webdavPermissionBanner.hidden = true;
      delete webdavPermissionBanner.dataset.state;
      delete webdavPermissionBtn.dataset.origin;
      return;
    }
    const rawUrl = (webdavUrlInput?.value ?? layout.settings.webdavUrl ?? '').trim();
    const hasValidUrl = Boolean(rawUrl && isSafeExtUrl(rawUrl) && !webdavUrlHasQueryOrFragment(rawUrl));
    if (rawUrl && !hasValidUrl) {
      clearGrantedFeedback();
      webdavPermissionBanner.hidden = true;
      delete webdavPermissionBanner.dataset.state;
      delete webdavPermissionBtn.dataset.origin;
      return;
    }
    const currentPattern = hasValidUrl ? getWebDAVOriginPattern(rawUrl) : '';
    const pending = await getWebDAVPendingPermission();
    if (myEpoch !== permUiEpoch) return;

    const targetOrigin = currentPattern || (pending && pending.needed && typeof pending.origin === 'string' ? pending.origin : '');
    if (!targetOrigin) {
      clearGrantedFeedback();
      webdavPermissionBanner.hidden = true;
      delete webdavPermissionBanner.dataset.state;
      delete webdavPermissionBtn.dataset.origin;
      return;
    }

    const check = await checkWebDAVOriginPermission(targetOrigin);
    if (myEpoch !== permUiEpoch) return;
    if (check.supported && check.granted) {
      if (pending && pending.needed && pending.origin === targetOrigin) {
        await clearPendingPermissionIfOrigin(targetOrigin);
        if (myEpoch !== permUiEpoch) return;
      }
      if (grantedFeedbackOrigin === targetOrigin) {
        const displayOrigin = displayOriginFromPattern(targetOrigin) || targetOrigin;
        webdavPermissionBanner.hidden = false;
        webdavPermissionBanner.dataset.state = 'granted';
        webdavPermissionMsg.textContent = i18n('webdavPermGrantedStatus', [displayOrigin]);
        webdavPermissionBtn.hidden = true;
        return;
      }
      webdavPermissionBanner.hidden = true;
      delete webdavPermissionBanner.dataset.state;
      delete webdavPermissionBtn.dataset.origin;
      return;
    }

    const matchesPending = Boolean(pending && pending.needed && pending.origin === targetOrigin);
    const shouldShow = matchesPending || (check.supported && Boolean(currentPattern));
    if (!shouldShow) {
      if (grantedFeedbackOrigin === targetOrigin && !check.supported) {
        const displayOrigin = displayOriginFromPattern(targetOrigin) || targetOrigin;
        webdavPermissionBanner.hidden = false;
        webdavPermissionBanner.dataset.state = 'granted';
        webdavPermissionMsg.textContent = i18n('webdavPermGrantedStatus', [displayOrigin]);
        webdavPermissionBtn.hidden = true;
        return;
      }
      webdavPermissionBanner.hidden = true;
      delete webdavPermissionBanner.dataset.state;
      delete webdavPermissionBtn.dataset.origin;
      return;
    }

    clearGrantedFeedback();
    const displayOrigin = displayOriginFromPattern(targetOrigin) || targetOrigin;
    const isDenied = matchesPending && pending.reason === 'denied';
    webdavPermissionBanner.hidden = false;
    webdavPermissionBanner.dataset.state = isDenied ? 'denied' : 'pending';
    webdavPermissionMsg.textContent = i18n(isDenied ? 'webdavPermDeniedHint' : 'webdavPermPendingHint', [displayOrigin]);
    webdavPermissionBtn.hidden = false;
    webdavPermissionBtn.textContent = i18n('webdavAuthorizeBtn');
    webdavPermissionBtn.dataset.origin = targetOrigin;
  }
  window.__boxingRefreshWebDAVPermissionUi = refreshWebDAVPermissionUi;

  // ── Ticket #126: Gist origin permission banner ─────────────────────────
  // The background never pops a permission prompt. This banner is the user-gesture
  // path for the GitHub API origin, using the same contains/request helpers as WebDAV.
  async function persistGistPendingPermissionState({ origin, source, reason }) {
    if (!origin) return;
    try {
      let nextReason = reason || 'missing-permission';
      if (nextReason === 'missing-permission') {
        const existing = await getGistPendingPermission();
        if (existing && existing.needed && existing.origin === origin && existing.reason === 'denied') {
          nextReason = 'denied';
        }
      }
      await setGistPendingPermission({
        needed: true,
        origin,
        source: source || 'background',
        reason: nextReason,
        updatedAt: Date.now(),
      });
    } catch (e) {
      debugWarn('persistGistPendingPermissionState failed', e);
    }
  }

  async function clearGistPendingPermissionIfOrigin(origin) {
    try {
      const pending = await getGistPendingPermission();
      if (!pending) return;
      if (!origin || pending.origin === origin) await clearGistPendingPermission();
    } catch (e) {
      debugWarn('clearGistPendingPermissionIfOrigin failed', e);
    }
  }

  async function refreshGistPermissionUi() {
    if (!gistPermissionBanner || !gistPermissionMsg || !gistPermissionBtn) return;
    const provider = syncProviderSelect?.value || layout.settings.syncProvider || 'local';
    const hide = () => {
      gistPermissionBanner.hidden = true;
      delete gistPermissionBanner.dataset.state;
      delete gistPermissionBtn.dataset.origin;
    };
    if (provider !== 'gist') return hide();
    const pending = await getGistPendingPermission();
    const check = await checkWebDAVOriginPermission(GIST_API_ORIGIN);
    if (check.supported && check.granted) {
      if (pending && pending.needed && pending.origin === GIST_API_ORIGIN) {
        await clearGistPendingPermissionIfOrigin(GIST_API_ORIGIN);
      }
      return hide();
    }
    const matchesPending = Boolean(pending && pending.needed && pending.origin === GIST_API_ORIGIN);
    const hasToken = Boolean(gistTokenInput?.value?.trim() || layout.settings._encGistToken);
    if (!matchesPending && !(check.supported && hasToken)) return hide();
    const isDenied = matchesPending && pending.reason === 'denied';
    gistPermissionBanner.hidden = false;
    gistPermissionBanner.dataset.state = isDenied ? 'denied' : 'pending';
    gistPermissionMsg.textContent = i18n(
      isDenied ? 'gistPermDeniedHint' : 'gistPermPendingHint',
      [displayOriginFromPattern(GIST_API_ORIGIN) || GIST_API_ORIGIN]
    );
    gistPermissionBtn.hidden = false;
    gistPermissionBtn.textContent = i18n('webdavAuthorizeBtn');
    gistPermissionBtn.dataset.origin = GIST_API_ORIGIN;
  }
  window.__boxingRefreshGistPermissionUi = refreshGistPermissionUi;

  async function sendWebDAVViaBackground(msg, opts = {}) {
    const allowPrompt = Boolean(opts && opts.allowPermissionPrompt);
    const source = (opts && opts.source) || (allowPrompt ? 'manual' : 'background');
    const origin = getWebDAVOriginPattern(msg.url);
    const displayOrigin = displayOriginFromPattern(origin) || msg.url;

    const preCheck = await checkWebDAVOriginPermission(msg.url);
    if (preCheck.supported) {
      if (!preCheck.granted) {
        if (allowPrompt) {
          const req = await requestWebDAVOriginPermission(msg.url);
          if (!req.granted) {
            await persistPendingPermissionState({
              origin: req.origin || origin,
              source,
              reason: 'denied',
            });
            refreshWebDAVPermissionUi();
            throw webdavError('webdavErrPermissionDenied', [displayOrigin]);
          }
          await clearPendingPermissionIfOrigin(req.origin || origin);
          refreshWebDAVPermissionUi();
        } else {
          await persistPendingPermissionState({
            origin: preCheck.origin || origin,
            source,
            reason: 'missing-permission',
          });
          refreshWebDAVPermissionUi();
          throw webdavError('webdavErrPermission', [displayOrigin]);
        }
      } else {
        await clearPendingPermissionIfOrigin(preCheck.origin || origin);
      }
    }

    const resp = await sendToBackground(msg);
    if (resp && resp.blocked) {
      if (typeof resp.error === 'string' && resp.error.includes('unsafe WebDAV url')) {
        throw webdavError('webdavErrBlockedHost');
      }
      const be = new Error(resp.error || 'WebDAV request blocked');
      be.noDirectFallback = true;
      throw be;
    }
    if (resp && resp.needPermission) {
      const missingOrigin = resp.origin || origin;
      const missingDisplay = displayOriginFromPattern(missingOrigin) || displayOrigin;
      if (allowPrompt) {
        const req = await requestWebDAVOriginPermission(missingOrigin || msg.url);
        if (req.supported && req.granted) {
          await clearPendingPermissionIfOrigin(req.origin || missingOrigin);
          const resp2 = await sendToBackground(msg);
          if (resp2 && resp2.blocked) {
            if (typeof resp2.error === 'string' && resp2.error.includes('unsafe WebDAV url')) {
              throw webdavError('webdavErrBlockedHost');
            }
            const be2 = new Error(resp2.error || 'WebDAV request blocked');
            be2.noDirectFallback = true;
            throw be2;
          }
          if (resp2 && resp2.needPermission) {
            await persistPendingPermissionState({
              origin: resp2.origin || missingOrigin,
              source,
              reason: 'missing-permission',
            });
            refreshWebDAVPermissionUi();
            throw webdavError('webdavErrPermission', [missingDisplay]);
          }
          refreshWebDAVPermissionUi();
          return resp2;
        }
        const reason = req.supported ? 'denied' : 'missing-permission';
        await persistPendingPermissionState({
          origin: missingOrigin,
          source,
          reason,
        });
        refreshWebDAVPermissionUi();
        throw webdavError(req.supported ? 'webdavErrPermissionDenied' : 'webdavErrPermission', [missingDisplay]);
      }
      await persistPendingPermissionState({
        origin: missingOrigin,
        source,
        reason: 'missing-permission',
      });
      refreshWebDAVPermissionUi();
      throw webdavError('webdavErrPermission', [missingDisplay]);
    }
    return resp;
  }

  async function testWebDAVConnection(opts = {}) {
      const url = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
      const user = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
      let pass = webdavPassInput?.value || '';
      if (!pass && layout.settings._encWebdavPass) {
        try { pass = (await decryptCredential(layout.settings._encWebdavPass)) || ''; } catch (_) {}
      }
      debug('WebDAV test: starting', { url: redactUrlForLog(url), user: user ? '(set)' : '(empty)', pass: pass ? '(set)' : '(empty)' });
      if (!url) throw webdavError('webdavErrNoUrl');
      // BX-AUD-01/03 front-end guard: private hosts, scheme, length, embedded creds
      if (!isSafeExtUrl(url)) {
        if (url.length > 2048) throw webdavError('webdavErrUrlTooLong');
        let _u; try { _u = new URL(url); } catch (_) { throw webdavError('webdavErrNetwork'); }
        if (_u.protocol !== 'https:') throw webdavError('webdavErrHttps');
        if (_u.username || _u.password) throw webdavError('webdavErrEmbedded');
        throw webdavError('webdavErrBlockedHost');
      }
      // Ticket 114: Test Connection is a WebDAV entry point too — a base URL this
      // engine must refuse for backup/sync/delete cannot be reported as "OK" here.
      if (webdavUrlHasQueryOrFragment(url)) throw webdavError('webdavErrQuery');
      const target = new URL(url);
      if (user && !pass) {
        debugErr('WebDAV test: password is empty — decrypt may not have completed');
        throw webdavError('webdavErrNoPass');
      }
      try {
        let status, ok;
        // Primary: route through background SW (bypasses CORS in Firefox MV3)
        try {
          const resp = await sendWebDAVViaBackground(
            { type: 'webdav-test', url: target.href, user, pass },
            { allowPermissionPrompt: Boolean(opts && opts.allowPermissionPrompt), source: (opts && opts.source) || 'manual' }
          );
          status = resp.status; ok = resp.ok;
          debug('WebDAV test via BG:', { status, ok });
        } catch (bgErr) {
          if (isKnownWebDAVError(bgErr) || (bgErr && bgErr.noDirectFallback)) throw bgErr;
          debug('WebDAV test via BG failed, falling back to direct fetch', bgErr && bgErr.message ? bgErr.message : bgErr);
          // Fallback: direct fetch (works in Chromium extension, not in Firefox)
          const h = new Headers({ 'Depth': '0' });
          if (user) h.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
          const resp = await fetch(target.href, { method: 'PROPFIND', headers: h, redirect: 'manual' });
          if (resp.type === 'opaqueredirect') throw webdavError('webdavErrNetwork');
          status = resp.status;
          ok = resp.status === 207 || resp.ok;
          debug('WebDAV test direct: PROPFIND', { status, ok });
        }
        // Interpret response
        debug('WebDAV test: interpreting response', { status, ok });
        if (status === 401 || status === 403) {
          throw webdavError('webdavErrAuth', [status]);
        }
        if (status === 404) {
          throw webdavError('webdavErrPath');
        }
        if (status === 207 || status === 200 || (ok && status >= 200 && status < 300)) {
          debug('WebDAV test: connection OK');
          return true;
        }
        throw webdavError('webdavErrStatus', [status]);
      } catch (netErr) {
        // If the error is already a known i18n message, re-throw it
        if (isKnownWebDAVError(netErr)) throw netErr;
        // Map network/fetch errors (TypeError, NetworkError, etc.) to the i18n message
        debugErr('WebDAV test: network-level error', netErr);
        throw webdavError('webdavErrNetwork');
      }
    }

    // (Bug16): apply layout.settings.syncLevel — what to push to remote.
    function buildSyncPayload() {
      // Ticket 122 (spec #120 T2): explicit field allowlist boundary ensures sync
      // credentials, runtime diagnostics (__*), computed groups, and unknown fields
      // never leave the browser.
      const lvl = layout.settings.syncLevel || 'full';
      const clean = sanitizeLayoutForBackup(layout);
      if (lvl === 'settingsOnly') {
        clean.boxes = [];
        clean.connections = [];
        return clean;
      }
      if (lvl === 'boxesOnly') {
        clean.settings = null;
        return clean;
      }
      return clean;
    }
    window.__bxSync = window.__bxSync || {};
    window.__bxSync.buildSyncPayload = buildSyncPayload;

    async function backupToWebDAV(opts = {}) {
      const url = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
      const user = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
      let pass = webdavPassInput?.value || '';
      if (!pass && layout.settings._encWebdavPass) {
        try { pass = (await decryptCredential(layout.settings._encWebdavPass)) || ''; } catch (_) {}
      }
      debug('WebDAV backup: starting', { url: redactUrlForLog(url), user: user ? '(set)' : '(empty)' });
      if (!url) throw webdavError('webdavErrNoUrl');
      // BX-AUD-01/03 front-end guard: private hosts, scheme, length, embedded creds
      if (!isSafeExtUrl(url)) {
        if (url.length > 2048) throw webdavError('webdavErrUrlTooLong');
        let _u; try { _u = new URL(url); } catch (_) { throw webdavError('webdavErrNetwork'); }
        if (_u.protocol !== 'https:') throw webdavError('webdavErrHttps');
        if (_u.username || _u.password) throw webdavError('webdavErrEmbedded');
        throw webdavError('webdavErrBlockedHost');
      }
      // Ticket 114: the filename is appended to this base — a query/fragment would
      // swallow it into the query value, so refuse before deriving fileUrl.
      if (webdavUrlHasQueryOrFragment(url)) throw webdavError('webdavErrQuery');
      // Resolve file URL — reuse the shared helper (honors custom sync filename).
      const { fileUrl } = resolveWebDAVFileUrl(url);
      // Ticket 108: the base URL passes the 2048 cap but the appended sync filename
      // can push fileUrl over it — check the value that is actually sent, so the
      // page-direct fetch fallback below can never see an overlong URL.
      if (fileUrlOverCap(fileUrl)) throw webdavError('webdavErrUrlTooLong');
      debug('WebDAV backup: resolved file URL', redactUrlForLog(fileUrl));
      if (user && !pass) throw webdavError('webdavErrNoPass');
      const body = JSON.stringify(buildSyncPayload(), null, 2);
      debug('WebDAV backup: sending PUT', { size: body.length });
      try {
        let status, ok;
        // Primary: route through background SW
        try {
          const resp = await sendWebDAVViaBackground(
            { type: 'webdav-put', url: fileUrl, user, pass, body },
            { allowPermissionPrompt: Boolean(opts && opts.allowPermissionPrompt), source: (opts && opts.source) || 'manual' }
          );
          status = resp.status; ok = resp.ok;
          debug('WebDAV backup via BG: PUT', { status, ok });
        } catch (bgErr) {
          if (isKnownWebDAVError(bgErr) || (bgErr && bgErr.noDirectFallback)) throw bgErr;
          debug('WebDAV backup via BG failed, falling back to direct fetch', bgErr && bgErr.message ? bgErr.message : bgErr);
          const h = new Headers({ 'Content-Type': 'application/json', 'Overwrite': 'T' });
          if (user) h.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
          const resp = await fetch(fileUrl, { method: 'PUT', headers: h, body, redirect: 'manual' });
          if (resp.type === 'opaqueredirect') throw webdavError('webdavErrNetwork');
          status = resp.status; ok = resp.ok;
          debug('WebDAV backup direct: PUT', { status, ok });
        }
        if (status === 401 || status === 403) {
          throw webdavError('webdavErrAuth', [status]);
        }
        if (status === 409) {
          throw webdavError('webdavErrConflict');
        }
        if (!ok && status !== 201 && status !== 204) {
          throw webdavError('webdavErrPut', [status]);
        }
        debug('WebDAV backup: success');
        return true;
      } catch (netErr) {
        if (isKnownWebDAVError(netErr)) throw netErr;
        debugErr('WebDAV backup: network-level error', netErr);
        throw webdavError('webdavErrNetwork');
      }
    }
    // expose for __boxingDebug (which runs in outer scope)
    window.__boxingTestWebDAV = testWebDAVConnection;
    window.__boxingBackupWebDAV = backupToWebDAV;

    // ── WebDAV two-way sync (replaces blind backup) ───────────
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

    // Ticket 83 (V-10/V-11): the page-direct fallback uses the same transport policy
    // as the background proxy — redirects stay manual (opaque redirects are refused)
    // and GET bodies are read with a byte cap so a hostile server cannot flood the
    // extension process through the fallback path either.
    const WEBDAV_GET_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB; same budget as the BG PUT guard.
    async function readWebDAVBodyCapped(resp) {
      if (!resp || !resp.body) return resp ? await resp.text() : '';
      const reader = resp.body.getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > WEBDAV_GET_MAX_BYTES) {
          try { await reader.cancel(); } catch (_) {}
          throw new Error('webdav-get response too large');
        }
        chunks.push(value);
      }
      const joined = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
      return new TextDecoder().decode(joined);
    }

    async function webdavGetCloud(fileUrl, user, pass, opts = {}) {
      let status, body;
      try {
        const resp = await sendWebDAVViaBackground(
          { type: 'webdav-get', url: fileUrl, user, pass },
          { allowPermissionPrompt: Boolean(opts && opts.allowPermissionPrompt), source: (opts && opts.source) || 'background' }
        );
        status = resp.status; body = resp.body;
      } catch (bgErr) {
        if (isKnownWebDAVError(bgErr) || (bgErr && bgErr.noDirectFallback)) throw bgErr;
        debug('WebDAV GET via BG failed, trying direct fetch', bgErr && bgErr.message ? bgErr.message : bgErr);
        const h = new Headers();
        if (user) h.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
        const resp = await fetch(fileUrl, { method: 'GET', headers: h, redirect: 'manual' });
        if (resp.type === 'opaqueredirect') throw webdavError('webdavErrNetwork');
        status = resp.status; body = resp.ok ? await readWebDAVBodyCapped(resp) : null;
      }
      debug('WebDAV GET cloud:', { status, bodyLen: body?.length || 0 });
      if (status === 404) return null;
      if (status === 401 || status === 403) throw webdavError('webdavErrAuth', [status]);
      if (status >= 400) throw new Error(i18n('syncErrGetFailed', [status]));
      if (!body) return null;
      try { return JSON.parse(body); } catch (_) { throw new Error(i18n('syncErrParseFailed')); }
    }

    async function webdavPutLocal(fileUrl, user, pass, body, opts = {}) {
      let status, ok;
      try {
        const resp = await sendWebDAVViaBackground(
          { type: 'webdav-put', url: fileUrl, user, pass, body },
          { allowPermissionPrompt: Boolean(opts && opts.allowPermissionPrompt), source: (opts && opts.source) || 'background' }
        );
        status = resp.status; ok = resp.ok;
      } catch (bgErr) {
        if (isKnownWebDAVError(bgErr) || (bgErr && bgErr.noDirectFallback)) throw bgErr;
        debug('WebDAV PUT via BG failed, trying direct fetch', bgErr && bgErr.message ? bgErr.message : bgErr);
        const h = new Headers({ 'Content-Type': 'application/json', 'Overwrite': 'T' });
        if (user) h.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
        const resp = await fetch(fileUrl, { method: 'PUT', headers: h, body, redirect: 'manual' });
        if (resp.type === 'opaqueredirect') throw webdavError('webdavErrNetwork');
        status = resp.status; ok = resp.ok;
      }
      if (status === 401 || status === 403) throw webdavError('webdavErrAuth', [status]);
      if (status === 409) throw webdavError('webdavErrConflict');
      if (!ok && status !== 201 && status !== 204) throw webdavError('webdavErrPut', [status]);
      return true;
    }

    // Resolve the cloud file URL the same way backupToWebDAV does.
    // Ticket 114: the derivation also drops any query/fragment, so a base that
    // slipped past the entry-point guards can never place the filename inside a
    // query value. For every accepted base (no search, no hash) this is
    // byte-identical to the old `target.href` behavior — origin + pathname is the
    // same serialization minus the components that are now refused.
    function resolveWebDAVFileUrl(urlInput) {
      const url = urlInput.trim();
      if (!url) return { url: '', fileUrl: '' };
      const target = new URL(url);
      // PR #115 review (Data Integrity): origin + pathname DROPS embedded
      // userinfo, so a base like `user:secret@host/dav/` used to keep the
      // credentials in fileUrl (and be refused by the background guard in
      // background.js) but would now derive a clean URL and go out with whatever
      // credentials the caller passes. The remote-delete path derives straight
      // from this function without running the entry-point guards, so refuse
      // here — the same way every other WebDAV entry point does.
      if (target.username || target.password) throw webdavError('webdavErrEmbedded');
      const baseHref = target.origin + target.pathname;
      let basePath = baseHref;
      if (!basePath.endsWith('/')) basePath += '/';
      // (Bug16): honor user-set sync filename; default boxing-backup.json.
      const customName = (layout.settings.syncFileName || '').trim().replace(/[\\/]/g, '_').replace(/[\x00-\x1f]/g, '');
      const BACKUP_FILENAME = customName || 'boxing-backup.json';
      let fileUrl = basePath.endsWith(BACKUP_FILENAME) ? basePath : basePath + BACKUP_FILENAME;
      // Ticket 114: the verbatim branch keys on the PATH ending in .json, not the
      // whole href — a base whose query merely ends in `.json` (`.../dir?file=x.json`)
      // must never select it.
      if (target.pathname.endsWith('.json')) fileUrl = baseHref;
      return { url, fileUrl };
    }
    window.__bxSync = window.__bxSync || {};
    window.__bxSync.resolveWebDAVFileUrl = resolveWebDAVFileUrl;
    // Ticket 114 test seam (mirrors the fileUrlOverCap / webdavError pattern): lets
    // specs pin the query/fragment predicate without a live WebDAV server.
    window.__bxSync.webdavUrlHasQueryOrFragment = webdavUrlHasQueryOrFragment;

    // Ticket 108 (PR #109 review): the 2048 budget applies to the URL actually sent.
    // A non-ASCII syncFileName survives sanitization and percent-encodes during URL
    // serialization, so the raw string can pass while its wire form exceeds the cap.
    function fileUrlOverCap(fileUrl) {
      if (typeof fileUrl !== 'string' || fileUrl.length > 2048) return true;
      try { return new URL(fileUrl).href.length > 2048; } catch (_) { return true; }
    }
    window.__bxSync.fileUrlOverCap = fileUrlOverCap;
    // Ticket 111 test seam (mirrors the fileUrlOverCap pattern): lets specs pin
    // keyed-error identity and classification without a live WebDAV server.
    window.__bxSync.webdavError = webdavError;
    window.__bxSync.isKnownWebDAVError = isKnownWebDAVError;

    // Two-way sync. Returns { direction: 'pull'|'push'|'merge'|'none', cloudBoxes, localBoxes }.
    // Outbox-style merge for concurrent WebDAV changes.
    // The big-box field heuristic is upgraded to an
    // id-level three-way merge in utils.mergeLayoutThreeWay. baseData = the client-
    // local syncBase slot (last state both sides agreed on; storage.getSyncBase) or
    // null -> additive two-way fallback. Children (small boxes) now ALWAYS merge per
    // id, so a child added on either side is never silently swallowed (the old gap);
    // same-id child divergence lands in child-level conflict copies instead of a
    // silent local overwrite. Merge-failure contract (return null -> caller archives
    // the losing side, then newer-wins) is preserved unchanged (ticket 44).
    function mergeLayoutFields(cloudData, localData, baseData) {
      try {
        const cloud = migrateLayout(cloudData);
        const local = migrateLayout(localData);
        const base = baseData && typeof baseData === "object" && Array.isArray(baseData.boxes) ? baseData : null;
        return mergeLayoutThreeWay(cloud, local, base);
      } catch (e) {
        debugErr('mergeLayoutFields', e);
        return null; // signal merge failure -> conflict-copy guard at the call site (ticket 44)
      }
    }


    async function syncWithWebDAV(opts = {}) {
      const bypassLossGuard = !!opts.bypassLossGuard;
      const allowPermissionPrompt = Boolean(opts && (opts.allowPermissionPrompt || opts.userInitiated));
      const transportOpts = {
        allowPermissionPrompt,
        source: (opts && opts.source) || (allowPermissionPrompt ? 'manual' : 'background'),
      };
      const url = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
      const user = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
      let pass = webdavPassInput?.value || '';
      if (!pass && layout.settings._encWebdavPass) {
        try { pass = (await decryptCredential(layout.settings._encWebdavPass)) || ''; } catch (_) {}
      }
      debug('WebDAV sync: starting', { url: redactUrlForLog(url), user: user ? '(set)' : '(empty)' });
      if (!url) throw webdavError('webdavErrNoUrl');
      checkUrlValid(url);
      if (user && !pass) throw webdavError('webdavErrNoPass');
      const { fileUrl } = resolveWebDAVFileUrl(url);
      // Ticket 108: checkUrlValid caps the BASE url; the derived fileUrl needs its own cap.
      if (fileUrlOverCap(fileUrl)) throw webdavError('webdavErrUrlTooLong');

      // Data-loss guard — blocks destructive upload unless user confirms restore-from-cloud.
      if (!bypassLossGuard && detectDataLoss()) {
        const baseline = getBaselineBoxCount();
        const cur = computeBoxCount(layout).total;
        const msg = i18n('syncErrPartialLoss', [baseline, cur]);
        if (typeof confirm === 'function' && confirm(msg)) {
          // Try to restore from cloud (force pull). If user declines after all, abort sync.
          const cloud = await webdavGetCloud(fileUrl, user, pass, transportOpts);
          if (cloud && typeof cloud === 'object' && Array.isArray(cloud.boxes)) {
            // Replace local layout with cloud (keep sync meta).
            // Ticket 44: explicit user-confirmed overwrite — newer-wins is allowed HERE,
            // but the discarded local side is archived as a conflict copy first (never silent).
            await archiveConflictLayouts(sanitizeLayoutForBackup(layout), { reason: 'webdav-data-loss-restore', side: 'local' });
            // Ticket 51 (spec ticket 51): copy-before-overwrite unified — the conflict
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
              const restoredPersisted = stripGroupsForPersist(layout);
              await directSetBoxingLayout(restoredPersisted);
              await setSyncBase(sanitizeLayoutForBackup(restoredPersisted)); // ticket 91: user-confirmed cloud state becomes the new ancestor
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
      const cloud = await webdavGetCloud(fileUrl, user, pass, transportOpts);
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
          const firstPullPersisted = stripGroupsForPersist(layout);
          await directSetBoxingLayout(firstPullPersisted);
          await setSyncBase(sanitizeLayoutForBackup(firstPullPersisted)); // ticket 91: adopted state is the new ancestor
        } catch (e) { debugErr('WebDAV sync: first-time pull set failed', e); }
        renderCanvas();
        debug('WebDAV sync: first-time pull', { boxes: layout.boxes.length });
        return { direction: 'pull', cloudBoxes: layout.boxes.length, localBoxes: layout.boxes.length, firstSync: true };
      }

      // Outbox conflict detection — if both sides changed since last sync, merge fields.
      if (cloud && Array.isArray(cloud.boxes)) {
        // Concurrent change detection — both changed since lastSyncAt
        const cloudChangedAfterSync = cloudUpdatedAt > lastSyncAt;
        const localChangedAfterSync = localUpdatedAt > lastSyncAt;
        if (cloudChangedAfterSync && localChangedAfterSync && cloud?._meta?.writerId !== writerId) {
          // Both sides diverged — try id-level three-way merge (ticket 91: base =
          // client-local syncBase slot when a previous clean sync recorded one)
          debug('WebDAV sync: concurrent change detected, attempting id-level merge');
          const syncBase = await getSyncBase();
          const mergeResult = mergeLayoutFields(cloud, layout, syncBase);
          if (mergeResult && mergeResult.merged) {
            if (mergeResult.conflicts.length) {
              await archiveConflictLayouts({ boxes: mergeResult.conflicts }, { reason: 'webdav-field-conflict', side: 'cloud' });
            }
            if (mergeResult.childConflicts.length) {
              // Child-box conflicts archive parent-wrapped so the ticket-79 readout
              // shows which large box the diverged small box lived in.
              const wrappedChildren = mergeResult.childConflicts.map((cc) => ({ id: cc.parentId, type: 'large', title: cc.parentTitle, children: [cc.child] }));
              await archiveConflictLayouts({ boxes: wrappedChildren }, { reason: 'webdav-child-conflict', side: 'cloud' });
            }
            setLayout(mergeResult.merged);
            layout._meta = layout._meta || {};
            layout._meta.updatedAt = Date.now();
            layout._meta.writerId = writerId;
            layout._meta.revision = (Number(cloud._meta?.revision) || 0) + 1;
            // Ticket 91: informational anchor — the cloud revision this merge diffed
            // against (the syncBase revision when a base was present).
            layout._meta.baseRevision = Number((syncBase && syncBase._meta && syncBase._meta.revision) || (cloud._meta && cloud._meta.revision)) || 0;
            layout.settings.lastSyncAt = Date.now();
            const mergedPersisted = stripGroupsForPersist(layout);
            await directSetBoxingLayout(mergedPersisted);
            await setSyncBase(sanitizeLayoutForBackup(mergedPersisted)); // merged agreement rolls base forward
            renderCanvas();
            setBaselineBoxCount(computeBoxCount(layout).total);
            debug('WebDAV sync: field-level merge complete', { boxes: layout.boxes.length });
            return { direction: 'merge', cloudBoxes: cloud.boxes.length, localBoxes: layout.boxes.length, merged: true, conflicts: mergeResult.conflicts.length + mergeResult.childConflicts.length };
          }
          // Ticket 44 (spec D4): merge threw — a silent newer-wins here would drop one
          // side. Archive the side the LWW write is about to discard, THEN land the newer
          // main copy (both sides survive: winner on boxingLayout, loser on the conflict key).
          debugWarn('WebDAV sync: field-level merge failed — archiving the losing side as a conflict copy before newer-wins');
          if (cloudUpdatedAt >= localUpdatedAt && cloud?._meta?.writerId !== writerId) {
            await archiveConflictLayouts(sanitizeLayoutForBackup(layout), { reason: 'webdav-merge-failed', side: 'local' });
          } else {
            await archiveConflictLayouts({ boxes: (sanitizeLayoutForBackup(cloud).boxes || []) }, { reason: 'webdav-merge-failed', side: 'cloud' });
          }
        }
        // Original newer-wins logic
        if (cloudUpdatedAt >= localUpdatedAt && cloud?._meta?.writerId !== writerId) {
          // Cloud is newer or equal-but-different-writer → pull.
          // Ticket 51: 覆盖必先本地副本 — this pull fully
          // replaces the main key, so snapshot the discarded local side FIRST
          // (copy-before-overwrite discipline; the import-side twin lives in settings-ui's
          // overwrite-confirmed branch, and the data-loss / merge-failure paths
          // already keep a verbatim conflict copy).
          if (computeBoxCount(layout).total > 0) await saveSnapshot();
          // preserve local connections/groups when cloud payload lacks them
          // (settingsOnly sync mode strips connections/groups from the uploaded payload).
          const savedSettings = layout.settings;
          const savedMeta = layout._meta;
          const savedConns = Array.isArray(layout.connections) ? layout.connections : [];
          setLayout(cloud);
          if (savedSettings) layout.settings = { ...cloud.settings, ...savedSettings };
          if (savedMeta) layout._meta = { ...cloud._meta, ...savedMeta, updatedAt: Date.now(), writerId };
          // layout-bypass-allow: sync-preserve-conns - settingsOnly sync strips conns from payload; keep local (expires:2027-03-31; ticket:108)
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
            const pulledPersisted = stripGroupsForPersist(layout);
            await directSetBoxingLayout(pulledPersisted);
            await setSyncBase(sanitizeLayoutForBackup(pulledPersisted)); // ticket 91: adopted state is the new ancestor
          } catch (e) { debugErr('WebDAV sync: cloud-newer pull set failed', e); }
          renderCanvas();
          debug('WebDAV sync: cloud newer, pulled', { boxes: layout.boxes.length });
          return { direction: 'pull', cloudBoxes: layout.boxes.length, localBoxes: layout.boxes.length };
        }
        // Local is newer → upload local over cloud.
        const sanitizedPayload = sanitizeLayoutForBackup(layout);
        const body = JSON.stringify(sanitizedPayload, null, 2);
        await webdavPutLocal(fileUrl, user, pass, body, transportOpts);
        layout.settings.lastSyncAt = Date.now();
        setBaselineBoxCount(computeBoxCount(layout).total);
        saveLayout();
        await setSyncBase(sanitizedPayload); // ticket 91: pushed state is the new ancestor
        debug('WebDAV sync: local newer, pushed', { boxes: layout.boxes.length });
        return { direction: 'push', cloudBoxes: cloud.boxes.length, localBoxes: layout.boxes.length };
      }

      // Cloud absent or invalid → upload local.
      const sanitizedPayload = sanitizeLayoutForBackup(layout);
      const body = JSON.stringify(sanitizedPayload, null, 2);
      await webdavPutLocal(fileUrl, user, pass, body, transportOpts);
      layout.settings.lastSyncAt = Date.now();
      setBaselineBoxCount(computeBoxCount(layout).total);
      saveLayout();
      await setSyncBase(sanitizedPayload); // ticket 91: pushed state is the new ancestor
      debug('WebDAV sync: no cloud, pushed local', { boxes: layout.boxes.length });
      return { direction: 'push', cloudBoxes: 0, localBoxes: layout.boxes.length };
    }

    function checkUrlValid(urlStr) {
      if (typeof urlStr !== 'string' || urlStr.length > 2048) throw webdavError('webdavErrUrlTooLong');
      const target = new URL(urlStr);
      if (target.protocol !== 'https:') throw webdavError('webdavErrHttps');
      if (target.username || target.password) throw webdavError('webdavErrEmbedded');
      // Ticket 114: the pull/sync path derives the same fileUrl, so it refuses a
      // base with a query/fragment exactly like the export and test paths do.
      if (webdavUrlHasQueryOrFragment(urlStr)) throw webdavError('webdavErrQuery');
      // Ticket 90: share the exact predicate isSafeExtUrl uses, so the pull path denies
      // the same hosts the export/test paths deny. The old inline regex tested the raw hostname
      // (keeping the IPv6 brackets) and had no .local/.internal suffix rule.
      if (isPrivateHost(normalizeHostname(target), layout.settings.webdavAllowPrivateHost === true)) throw webdavError('webdavErrBlockedHost');
    }

    // Expose sync for debug + tests.
    window.__boxingSyncWebDAV = syncWithWebDAV;

    // A local Gist refusal (missing token, unreadable state, unconfirmed create, bad
    // id) never sends a request, so it must not look like a remote attempt (#129).
    function gistPrecheckError(message) {
      const e = new Error(message);
      e.preflight = true;
      return e;
    }

    async function backupToGist() {
      const token = gistTokenInput?.value?.trim();
      if (!token) throw gistPrecheckError('GitHub token not configured');
      // Ticket #126: do not race the background first-create. A pending POST result
      // means a Gist may already exist; a trusted baseline is the real target even
      // before the settings field has been mirrored.
      let autoState = null;
      try {
        autoState = await getAutoBackupStateStrict();
      } catch (e) {
        debugErr('backupToGist: auto-backup state read failed', e);
        throw gistPrecheckError('Could not read auto-backup state');
      }
      const remote = autoState && autoState.remote ? autoState.remote : {};
      if (remote.pendingCreate) throw gistPrecheckError(i18n('gistAutoBackupErrUnknown'));
      const baselineId = remote.baseline && remote.baseline.service === 'gist' ? remote.baseline.gistId : '';
      const gistId = layout.settings.gistId || gistIdInput?.value?.trim() || baselineId;
      if (gistId && !/^[a-f0-9]{5,64}$/i.test(gistId)) throw gistPrecheckError('Invalid Gist ID');
      const content = JSON.stringify(buildSyncPayload(), null, 2);
      // (Bug16): honor custom sync filename; default boxing-backup.json.
      const _rawName = (layout.settings.syncFileName || '').trim().replace(/[\\/]/g, '_').replace(/[\x00-\x1f]/g, '');
      const GIST_FILENAME = _rawName || 'boxing-backup.json';
      // Ticket #128: a real extension sends every Gist write through the background
      // queue. The page no longer PATCHes/POSTs GitHub itself, so two tabs and the
      // unattended first create cannot overwrite each other.
      if (hasExtensionRuntime()) {
        let resp = null;
        try {
          resp = await sendToBackground({
            type: 'gist-write',
            gistId,
            fileName: GIST_FILENAME,
            content,
          });
        } catch (e) {
          const code = e && e.reasonCode;
          if (code && REMOTE_REASON_I18N[code]) throw new Error(i18n(REMOTE_REASON_I18N[code]));
          throw e;
        }
        if (resp && resp.needPermission) throw new Error(i18n('gistAutoBackupErrPermission'));
        if (!resp || !resp.success) {
          if (resp && resp.resultUnknown) throw new Error(i18n('gistAutoBackupErrUnknown'));
          const code = resp && resp.reasonCode;
          if (code && REMOTE_REASON_I18N[code]) throw new Error(i18n(REMOTE_REASON_I18N[code]));
          throw new Error(i18n('gistBackupFail'));
        }
        if (resp.gistId && !layout.settings.gistId) {
          layout.settings.gistId = resp.gistId;
          if (gistIdInput) gistIdInput.value = resp.gistId;
          saveLayout();
        }
        return true;
      }
      // Non-extension contexts (file:// tests, the standalone demo) keep the old
      // direct request; there is no second extension context to serialise against.
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
    window.__bxSync.backupToLocal = backupToLocal;
    window.__bxSync.performBackup = performBackup;

    function backupToLocal() {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const blob = new Blob([JSON.stringify(sanitizeLayoutForBackup(layout), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'boxing-backup-' + ts + '.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    // Unified backup dispatcher (only used for remote providers)
    // Unified sync dispatcher (only used for remote providers)
    async function performBackup(opts = {}) {
      const p = syncProviderSelect?.value || layout.settings.syncProvider || 'local';
      const userInitiated = Boolean(opts && opts.userInitiated);
      const allowPermissionPrompt = opts && opts.allowPermissionPrompt !== undefined
        ? Boolean(opts.allowPermissionPrompt)
        : userInitiated;
      const source = (opts && opts.source) || (userInitiated ? 'manual' : 'background');
      let remoteError = null;
      let syncResult = null;
      try {
        if (p === 'webdav') {
          syncResult = await syncWithWebDAV({ allowPermissionPrompt, source });
          debug('WebDAV sync ok', syncResult && syncResult.direction ? { direction: syncResult.direction, conflicts: syncResult.conflicts || 0 } : undefined);
          // Ticket 91: box-level AND child-level conflict copies land in the
          // ticket-79 Settings > Data readout automatically (same archive key
          // family) — surface the pointer instead of leaving the count invisible.
          if (syncResult && syncResult.conflicts) debugWarn('WebDAV sync archived ' + syncResult.conflicts + ' conflict copy(ies) - review under Settings > Data > Conflict copies');
        }
        else if (p === 'gist') { await backupToGist(); debug('Gist backup ok'); }
      } catch (e) {
        // Ticket #129: a failed upload no longer skips the local history. The single
        // exception is a local pre-check refusal — nothing was sent, so #123 keeps its
        // "no attempt, no side effect" contract.
        debugErr('Backup failed', e);
        remoteError = e;
      }

      // The Time Machine snapshot is its own lane: it still runs when the remote
      // upload threw, and its own result is never reported as a remote success.
      // A local pre-check refusal never left the browser, so #123 keeps its
      // "nothing was attempted, nothing changes" contract.
      let snapshotTs = 0;
      if (!remoteError || failedAfterRemoteAttempt(remoteError)) {
        try {
          snapshotTs = Number(await saveSnapshot()) || 0; // always save a versioned snapshot
        } catch (e) {
          debugErr('Backup snapshot failed', e);
        }
      }
      // Only a real upload counts as a cloud success. A pull or a merge never sent the
      // local copy to the remote file, so it must not advance the success time.
      let outcome = 'skipped';
      if (!remoteError && p !== 'local') {
        if (p === 'gist') outcome = 'ok';
        else if (syncResult && syncResult.direction === 'push') outcome = 'ok';
      } else if (remoteError && failedAfterRemoteAttempt(remoteError)) {
        outcome = 'failed';
      }
      // lastBackupAt is a REMOTE success timestamp. Local-only mode keeps its history
      // in autoBackupState.local instead of pretending a remote backup happened.
      if (outcome === 'ok') {
        layout.settings.lastBackupAt = Date.now();
        saveLayout();
      }
      // Ticket #129: manual results are real results. Record both lanes in the same
      // state the background uses, so a later target switch can tell whose time it is.
      if (outcome !== 'skipped' || snapshotTs > 0) {
        try {
          await noteManualBackupResult(
            p,
            outcome,
            snapshotTs,
            currentRemoteTargetKey(p),
            manualFailureCode(p, remoteError),
          );
        } catch (e) {
          debugWarn('note manual backup result failed', e);
        }
      }
      try { await refreshLocalAutoBackupUi(); } catch (e) { debugWarn('refresh local auto-backup ui failed', e); }
      if (remoteError) throw remoteError;
      return true;
    }

    // ── Background local auto-backup coordination (#124 / #120 T4) ──
    // Single executor lives in background.js. NTP never owns setInterval or alarm listeners;
    // NTP only configures opt-in, ensures missed alarms/catch-ups on boot, and mirrors persisted state.
    function hasExtensionRuntime() {
      if (typeof window !== 'undefined' && window.__BOXING_DEMO__) return false;
      const proto = (typeof window !== 'undefined' && window.location && window.location.protocol) || '';
      if (!proto.endsWith('-extension:') && proto !== 'extension:') return false;
      if (typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.sendMessage === 'function') {
        return true;
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        return true;
      }
      return false;
    }

// Ticket #129: a navbar-level identity for the selected remote target. Two WebDAV
    // addresses are different targets, so the provider alone is not enough.
    function currentRemoteTargetKey(provider) {
      if (provider === 'webdav') {
        const url = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
        if (!url) return '';
        let resolved;
        try { resolved = resolveWebDAVFileUrl(url); } catch (_) { return ''; }
        if (!resolved || resolved.error) return '';
        const user = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
        return 'webdav|' + resolved.fileUrl + '|' + user;
      }
      if (provider === 'gist') {
        const id = layout.settings.gistId || '';
        return id ? 'gist|' + id : '';
      }
      return '';
    }

    // A manual failure still has to say WHY in Settings. Map the page error to the
    // shared closed reason list (the background rejects anything outside it).
    const MANUAL_WEBDAV_FAILURE_CODES = {
      webdavErrAuth: 'auth-failed',
      webdavErrNetwork: 'remote-unreachable',
      webdavErrConflict: 'create-conflict',
      webdavErrStatus: 'create-failed',
      webdavErrPut: 'create-failed',
    };
    function manualFailureCode(provider, error) {
      if (provider === 'gist') return 'gistRequestRejected';
      return (error && MANUAL_WEBDAV_FAILURE_CODES[error.key]) || 'internal-error';
    }

    // Ticket #129: a manual Sync Now produces real results. They are written to the
    // same autoBackupState the automatic lane uses, so each success time stays
    // attached to the target that earned it. The extension path goes through the
    // background queue (#124 single writer); a bare page writes directly.
    async function noteManualBackupResult(provider, outcome, snapshotTs, targetKey, errorCode) {
      const payload = {
        type: 'auto-backup-note-manual-result',
        provider: provider === 'webdav' || provider === 'gist' ? provider : '',
        outcome,
        targetKey: targetKey || '',
        errorCode: errorCode || '',
        snapshotTs: Math.max(0, Number(snapshotTs) || 0),
      };
      if (hasExtensionRuntime()) {
        await sendToBackground(payload);
        return;
      }
      const core = typeof globalThis !== 'undefined' ? globalThis.__boxingSnapshotCore : null;
      if (!core) return;
      const st = await getAutoBackupState();
      const now = Date.now();
      const local = payload.snapshotTs > 0
        ? {
            ...st.local,
            status: 'ok',
            lastSuccessAt: Math.max(Number(st.local.lastSuccessAt) || 0, payload.snapshotTs),
            lastSnapshotTs: Math.max(Number(st.local.lastSnapshotTs) || 0, payload.snapshotTs),
            lastError: null,
          }
        : st.local;
      let remote = st.remote;
      const code = core.AUTO_BACKUP_REMOTE_REASONS.includes(payload.errorCode) ? payload.errorCode : 'internal-error';
      if (payload.provider && payload.outcome === 'ok') {
        remote = {
          ...st.remote,
          provider: payload.provider,
          status: 'ok',
          lastAttemptAt: now,
          lastSuccessAt: Math.max(
            st.remote.provider === payload.provider ? (Number(st.remote.lastSuccessAt) || 0) : 0,
            now,
          ),
          lastSuccessTarget: payload.targetKey,
          lastErrorCode: null,
        };
      } else if (payload.provider && payload.outcome === 'failed') {
        remote = {
          ...st.remote,
          provider: payload.provider,
          status: ['remote-unreachable', 'create-failed', 'internal-error'].includes(code) ? 'error' : 'paused',
          lastAttemptAt: now,
          lastSuccessAt: st.remote.provider === payload.provider ? (Number(st.remote.lastSuccessAt) || 0) : 0,
          lastErrorCode: code,
        };
      }
      await setAutoBackupState({ ...st, local, remote, updatedAt: now });
    }

    // Ticket #125 (spec #120 T5) / #129 (D6): the cloud result line. It is separate
    // from the local snapshot result on purpose — a local snapshot success never
    // claims the cloud side worked, and a cloud pause keeps its own reason visible.
    // One row per code: the localized line plus the manual entry that clears it, so a
    // new code is added once instead of keeping parallel tables in sync.
    // "permission" reuses the real grant button, "credentials" focuses the stored
    // credential field, and an absent action means "confirm the remote side, then
    // re-check once".
    const REMOTE_REASON_META = {
      'need-permission': { i18n: 'autoBackupCloudReasonNeedPermission', action: 'permission' },
      'remote-exists-untrusted': { i18n: 'autoBackupCloudReasonRemoteExists' },
      'remote-exists-unknown': { i18n: 'autoBackupCloudReasonRemoteExists' },
      'remote-unreachable': { i18n: 'autoBackupCloudReasonUnreachable' },
      'auth-failed': { i18n: 'autoBackupCloudReasonAuth', action: 'credentials' },
      'invalid-target': { i18n: 'autoBackupCloudReasonInvalidTarget' },
      'credential-unreadable': { i18n: 'autoBackupCloudReasonCredential', action: 'credentials' },
      'create-conflict': { i18n: 'autoBackupCloudReasonConflict' },
      'create-failed': { i18n: 'autoBackupCloudReasonError' },
      'conditional-unsupported': { i18n: 'autoBackupCloudReasonConditional' },
      'unknown-outcome': { i18n: 'autoBackupCloudReasonUnknownOutcome' },
      'target-changed': { i18n: 'autoBackupCloudReasonTargetChanged' },
      'internal-error': { i18n: 'autoBackupCloudReasonError' },
      // Ticket #127 (WebDAV trusted-target updates) stable codes.
      'remote-changed': { i18n: 'autoBackupCloudReasonRemoteChanged' },
      'baseline-unverified': { i18n: 'autoBackupCloudReasonBaselineUnverified' },
      'remote-missing': { i18n: 'autoBackupCloudReasonRemoteMissing' },
      'update-failed': { i18n: 'autoBackupCloudReasonUpdateFailed' },
      // Ticket #126 (Gist first-create) stable codes.
      gistTokenMissing: { i18n: 'gistAutoBackupErrToken', action: 'credentials' },
      gistPermissionMissing: { i18n: 'gistAutoBackupErrPermission', action: 'permission' },
      gistAccountChanged: { i18n: 'gistAutoBackupErrAccount', action: 'credentials' },
      gistTargetNeedsReview: { i18n: 'gistAutoBackupErrTarget' },
      gistUnknownExisting: { i18n: 'gistAutoBackupErrExisting' },
      gistResultUnknown: { i18n: 'gistAutoBackupErrUnknown' },
      gistRequestRejected: { i18n: 'gistAutoBackupErrRejected', action: 'credentials' },
      gistCheckFailed: { i18n: 'gistAutoBackupErrCheck' },
      gistUpdateNotEnabled: { i18n: 'gistAutoBackupErrUpdate' },
      gistPayloadTooLarge: { i18n: 'gistAutoBackupErrTooLarge' },
    };

    function formatRemoteAutoBackupState(remote, currentProvider) {
      if (!remote || remote.status === 'idle') return { text: '', state: 'idle', action: null };
      const meta = REMOTE_REASON_META[remote.lastErrorCode] || {};
      const reason = i18n(meta.i18n || 'autoBackupCloudReasonError');
      if (remote.status === 'running') {
        return { text: i18n('localAutoBackupStatusRunning'), state: 'active', action: null };
      }
      // Only a value that belongs to the CURRENT provider AND the current concrete
      // target may be shown as its success: switching WebDAV ↔ Gist or changing an
      // address keeps the old record but must not hand its timestamp to the new one.
      const sameTarget = (!remote.provider || remote.provider === currentProvider) &&
        (!remote.lastSuccessTarget || remote.lastSuccessTarget === currentRemoteTargetKey(currentProvider));
      const lastAt = Math.max(0, Number(remote.lastSuccessAt) || 0);
      const lastSuffix = sameTarget && lastAt > 0 && !isRemoteTimeUnproven(remote)
        ? ' · ' + i18n('autoBackupCloudLastLabel') + ': ' + new Date(lastAt).toLocaleString()
        : '';
      if (remote.status === 'ok') {
        return { text: i18n('autoBackupCloudStatusOk') + lastSuffix, state: 'ok', action: null };
      }
      const fixAction = sameTarget ? (meta.action || 'recheck') : null;
      if (remote.status === 'unknown') {
        return {
          text: i18n('autoBackupCloudStatusUnknown') + lastSuffix,
          state: 'unknown',
          action: fixAction,
        };
      }
      if (remote.status === 'paused') {
        // Only the shared list decides which pauses get the retry hint; an absent
        // core simply shows no hint instead of keeping a second copy of the list.
        const core = typeof globalThis !== 'undefined' ? globalThis.__boxingSnapshotCore : null;
        const blocking = core && Array.isArray(core.AUTO_BACKUP_REMOTE_BLOCKING_REASONS)
          ? core.AUTO_BACKUP_REMOTE_BLOCKING_REASONS
          : [];
        const hint = blocking.includes(remote.lastErrorCode) ? ' ' + i18n('autoBackupCloudRetryHint') : '';
        return {
          text: i18n('autoBackupCloudStatusPaused', [reason]) + hint + lastSuffix,
          state: 'paused',
          action: fixAction,
        };
      }
      return {
        text: i18n('autoBackupCloudStatusError', [reason]) + lastSuffix,
        state: 'error',
        action: fixAction,
      };
    }

    function formatAutoBackupStateLabel(state, isActive, needsOptIn) {
      const st = state && state.local ? state.local.status : 'idle';
      if (st === 'error' && (isActive || (state && state.local && state.local.lastError))) {
        return { text: i18n('localAutoBackupStatusError'), badgeState: 'error' };
      }
      if (isActive && st === 'running') {
        return { text: i18n('localAutoBackupStatusRunning'), badgeState: 'active' };
      }
      if (isActive) {
        return { text: i18n('localAutoBackupStatusActive'), badgeState: 'active' };
      }
      if (needsOptIn) {
        return { text: i18n('localAutoBackupStatusNeedsOptIn'), badgeState: 'paused' };
      }
      return { text: i18n('localAutoBackupStatusOff'), badgeState: 'off' };
    }

    async function refreshLocalAutoBackupUi(stateFromCaller) {
      const core = typeof globalThis !== 'undefined' ? globalThis.__boxingSnapshotCore : null;
      const state = stateFromCaller
        ? (core ? core.normalizeAutoBackupState(stateFromCaller) : stateFromCaller)
        : await getAutoBackupState();
      const autoBackupSelect = document.getElementById('auto-backup-interval');
      const rawInterval = Number(layout.settings && layout.settings.autoBackupInterval) || 0;
      const normalizedLayoutInterval = core
        ? core.normalizeAutoBackupInterval(rawInterval)
        : (rawInterval === 3600 || rawInterval === 86400 || rawInterval === 604800 ? rawInterval : 0);
      const isActive = core
        ? core.isAutoBackupActive(state)
        : Boolean(state && state.optIn === true && state.intervalSec >= 3600);
      const needsLegacyOptIn = !isActive && normalizedLayoutInterval >= 3600;

      if (autoBackupSelect) {
        autoBackupSelect.value = isActive
          ? String(state.intervalSec)
          : (needsLegacyOptIn ? String(normalizedLayoutInterval) : '0');
      }
      updateLastBackupDisplay(state);

      // A background-created Gist id is the real target. Mirror it into the normal
      // settings field once, through the layout facade (background never writes layout).
      const remoteBaseline = state && state.remote && state.remote.baseline;
      if (remoteBaseline && remoteBaseline.service === 'gist' && remoteBaseline.gistId &&
          layout.settings.syncProvider === 'gist' && !layout.settings.gistId) {
        layout.settings.gistId = remoteBaseline.gistId;
        if (gistIdInput) gistIdInput.value = remoteBaseline.gistId;
        try {
          await saveLayout({ preserveUpdatedAt: true });
        } catch (e) {
          debugWarn('mirror background Gist id failed', e);
        }
      }

      if (localAutoBackupStatusEl) {
        const badge = formatAutoBackupStateLabel(state, isActive, needsLegacyOptIn);
        localAutoBackupStatusEl.textContent = badge.text;
        localAutoBackupStatusEl.dataset.state = badge.badgeState;
      }
      if (localAutoBackupErrorEl) {
        const errMsg = state && state.local && state.local.lastError;
        if (errMsg && (state.local.status === 'error' || isActive)) {
          localAutoBackupErrorEl.textContent = errMsg;
          localAutoBackupErrorEl.hidden = false;
        } else {
          localAutoBackupErrorEl.textContent = '';
          localAutoBackupErrorEl.hidden = true;
        }
      }
      if (autoBackupRemoteEl) {
        const provider = layout.settings.syncProvider || 'local';
        const remoteLine = formatRemoteAutoBackupState(state && state.remote, provider);
        autoBackupRemoteEl.textContent = remoteLine.text;
        autoBackupRemoteEl.hidden = !remoteLine.text;
        if (remoteLine.text) autoBackupRemoteEl.dataset.state = remoteLine.state;
        else delete autoBackupRemoteEl.dataset.state;
        // Ticket #129: the cloud line carries its own manual entry so the user does
        // not have to guess which field or button releases the pause.
        if (autoBackupRemoteActionEl) {
          const showFix = Boolean(remoteLine.action) && provider !== 'local';
          autoBackupRemoteActionEl.hidden = !showFix;
          if (showFix) {
            autoBackupRemoteActionEl.dataset.action = remoteLine.action;
            autoBackupRemoteActionEl.textContent = remoteLine.action === 'permission'
              ? i18n('webdavAuthorizeBtn')
              : i18n('autoBackupCloudActionFix');
          } else {
            delete autoBackupRemoteActionEl.dataset.action;
          }
        }
      }
      if (autoBackupUpgradeBox) {
        autoBackupUpgradeBox.hidden = !needsLegacyOptIn;
      }
      return state;
    }
    window.__boxingRefreshLocalAutoBackupUi = refreshLocalAutoBackupUi;

    // Ticket #129: one click and no hidden request. A permission pause reuses the
    // real grant button, a credential problem focuses the stored-credential field,
    // and every other pause asks for one explicit re-check through the existing
    // re-enable path (#125/#126 already treat that as the user's acknowledgement).
    async function handleRemoteAutoBackupAction() {
      const action = autoBackupRemoteActionEl && autoBackupRemoteActionEl.dataset.action;
      if (!action) return;
      const provider = layout.settings.syncProvider || 'local';
      if (action === 'permission') {
        const grantBtn = provider === 'gist' ? gistPermissionBtn : webdavPermissionBtn;
        if (grantBtn && !grantBtn.hidden) {
          grantBtn.click();
          return;
        }
      }
      if (action === 'permission' || action === 'credentials') {
        const field = provider === 'gist' ? gistTokenInput : webdavPassInput;
        if (field) {
          field.focus();
          if (typeof field.select === 'function') field.select();
        }
        return;
      }
      // recheck: only a running auto-backup may re-check; while it is off there is
      // nothing to resume automatically, so point at the manual Sync Now button.
      const st = await getAutoBackupState();
      if (!st.optIn) {
        backupNowBtn?.focus();
        return;
      }
      await configureLocalAutoBackup(Number(st.intervalSec) || 0, true);
    }

    // Ticket #126: deleting stored sync credentials explicitly drops the saved
    // target. Clear the background remote baseline/account/pending marker and bump
    // its generation so an in-flight Gist result cannot restore the old target.
    async function resetAutoBackupCloudTarget() {
      try {
        if (hasExtensionRuntime()) {
          const resp = await sendToBackground({ type: 'auto-backup-reset-cloud' });
          await refreshLocalAutoBackupUi(resp && resp.state ? resp.state : null);
          return;
        }
        const core = typeof globalThis !== 'undefined' ? globalThis.__boxingSnapshotCore : null;
        if (!core) {
          debugWarn('resetAutoBackupCloudTarget: snapshot core missing');
          return;
        }
        const st = await getAutoBackupState();
        const nextGeneration = (Number(st.remote && st.remote.generation) || 0) + 1;
        const next = await setAutoBackupState({
          ...st,
          remote: { ...core.defaultRemoteAutoBackupState(), generation: nextGeneration },
        });
        await refreshLocalAutoBackupUi(next);
      } catch (e) {
        debugWarn('resetAutoBackupCloudTarget failed', e);
      }
    }

    let localAutoBackupConfigSeq = 0;
    let pendingLocalAutoBackupConfigs = 0;
    window.__boxingGetPendingAutoBackupConfigCount = () => pendingLocalAutoBackupConfigs;

    async function configureLocalAutoBackup(rawIntervalSec, optIn) {
      pendingLocalAutoBackupConfigs += 1;
      const mySeq = ++localAutoBackupConfigSeq;
      try {
        const core = typeof globalThis !== 'undefined' ? globalThis.__boxingSnapshotCore : null;
        const intervalSec = core
          ? core.normalizeAutoBackupInterval(rawIntervalSec)
          : (rawIntervalSec === 3600 || rawIntervalSec === 86400 || rawIntervalSec === 604800 ? Number(rawIntervalSec) : 0);
        const enable = Boolean(optIn) && intervalSec >= 3600;

        layout.settings.autoBackupInterval = enable ? intervalSec : 0;
        await saveLayout({ preserveUpdatedAt: true });
        if (mySeq !== localAutoBackupConfigSeq) {
          return { ok: false, stale: true };
        }

        if (typeof window !== 'undefined' && window.__BOXING_DEMO__) {
          await refreshLocalAutoBackupUi();
          return { ok: true, demo: true };
        }

        if (hasExtensionRuntime()) {
          try {
            const resp = await sendToBackground({
              type: 'auto-backup-configure',
              optIn: enable,
              intervalSec: enable ? intervalSec : 0,
            });
            if (mySeq !== localAutoBackupConfigSeq) {
              return { ok: false, stale: true };
            }
            await refreshLocalAutoBackupUi(resp && resp.state ? resp.state : null);
            if (mySeq !== localAutoBackupConfigSeq) {
              return { ok: false, stale: true };
            }
            if (typeof refreshSnapshotHealth === 'function') {
              try { await refreshSnapshotHealth(); } catch (_) {}
            }
            return resp;
          } catch (e) {
            debugWarn('auto-backup-configure failed', e);
            if (mySeq !== localAutoBackupConfigSeq) {
              return { ok: false, stale: true };
            }
            const errMsg = ((e && e.message ? e.message : String(e || '')) || 'Failed to configure local auto-backup').slice(0, 240);
            const persistedState = await getAutoBackupState();
            if (mySeq !== localAutoBackupConfigSeq) {
              return { ok: false, stale: true };
            }
            await refreshLocalAutoBackupUi({
              ...persistedState,
              local: {
                ...(persistedState.local || {}),
                status: 'error',
                lastAttemptAt: Date.now(),
                lastError: (persistedState.local && persistedState.local.lastError) || errMsg,
              },
            });
            return { ok: false, error: errMsg };
          }
        }

        // file:// lane (no background SW): update persisted coordination state directly via storage facade, never setInterval.
        const prev = await getAutoBackupState();
        if (mySeq !== localAutoBackupConfigSeq) {
          return { ok: false, stale: true };
        }
        const now = Date.now();
        const nextEpoch = (prev.epoch || 0) + 1;
        try {
          if (!enable) {
            const disabled = await setAutoBackupState({
              version: 1,
              optIn: false,
              intervalSec: 0,
              epoch: nextEpoch,
              nextScheduledAt: 0,
              updatedAt: now,
              local: {
                ...(prev.local || {}),
                status: (prev.local && (prev.local.lastSuccessAt > 0 || prev.local.lastError)) ? 'cancelled' : 'idle',
              },
              // Ticket #125: cloud history survives the switch-off.
              remote: prev.remote,
              lock: null,
            });
            if (mySeq !== localAutoBackupConfigSeq) {
              return { ok: false, stale: true };
            }
            await refreshLocalAutoBackupUi(disabled);
            return { ok: true, state: disabled };
          }

          const ts = await saveSnapshot('auto-backup');
          if (mySeq !== localAutoBackupConfigSeq) {
            return { ok: false, stale: true };
          }
          const localState = ts
            ? { status: 'ok', lastAttemptAt: now, lastSuccessAt: ts, lastSnapshotTs: ts, lastError: null }
            : {
                status: 'error',
                lastAttemptAt: now,
                lastSuccessAt: (prev.local && prev.local.lastSuccessAt) || 0,
                lastSnapshotTs: (prev.local && prev.local.lastSnapshotTs) || 0,
                lastError: 'Failed to save local snapshot',
              };
          const enabled = await setAutoBackupState({
            version: 1,
            optIn: true,
            intervalSec,
            epoch: nextEpoch,
            nextScheduledAt: now + intervalSec * 1000,
            updatedAt: now,
            local: localState,
            remote: prev.remote,
            lock: null,
          });
          if (mySeq !== localAutoBackupConfigSeq) {
            return { ok: false, stale: true };
          }
          await refreshLocalAutoBackupUi(enabled);
          if (mySeq !== localAutoBackupConfigSeq) {
            return { ok: false, stale: true };
          }
          if (typeof refreshSnapshotHealth === 'function') {
            try { await refreshSnapshotHealth(); } catch (_) {}
          }
          return { ok: Boolean(ts), state: enabled };
        } catch (e) {
          debugWarn('local auto-backup configure failed', e);
          if (mySeq !== localAutoBackupConfigSeq) {
            return { ok: false, stale: true };
          }
          const errMsg = ((e && e.message ? e.message : String(e || '')) || 'Failed to save auto-backup state').slice(0, 240);
          try {
            await refreshLocalAutoBackupUi({
              ...prev,
              local: {
                ...(prev.local || {}),
                status: 'error',
                lastAttemptAt: now,
                lastError: errMsg,
              },
            });
          } catch (uiErr) {
            debugWarn('refreshLocalAutoBackupUi after failure failed', uiErr);
          }
          return { ok: false, error: errMsg };
        }
      } catch (e) {
        debugWarn('configureLocalAutoBackup unexpected error', e);
        if (mySeq !== localAutoBackupConfigSeq) {
          return { ok: false, stale: true };
        }
        const errMsg = ((e && e.message ? e.message : String(e || '')) || 'Failed to configure local auto-backup').slice(0, 240);
        try {
          const core = typeof globalThis !== 'undefined' ? globalThis.__boxingSnapshotCore : null;
          const base = core ? core.defaultAutoBackupState() : { version: 1, optIn: false, intervalSec: 0, local: {} };
          await refreshLocalAutoBackupUi({
            ...base,
            local: {
              ...(base.local || {}),
              status: 'error',
              lastAttemptAt: Date.now(),
              lastError: errMsg,
            },
          });
        } catch (uiErr) {
          debugWarn('refreshLocalAutoBackupUi fallback failed', uiErr);
        }
        return { ok: false, error: errMsg };
      } finally {
        pendingLocalAutoBackupConfigs -= 1;
      }
    }

// Init-time wiring, called from ntp.js init() at the exact positions these statements
// originally occupied (after loadLayout/loadSettings — they read layout.settings).
export function bindSyncBackupUi() {
    // Ticket 99 (T13): grab danger-zone refs before updateSyncConfigVisibility()
    // runs (it toggles the zone on stored-credential presence).
    syncCredentialDangerZone = document.getElementById('sync-credential-danger-zone');
    deleteOpenBtn = document.getElementById('delete-sync-credential-open');
    deletePanel = document.getElementById('delete-sync-credential-panel');
    deleteCancelBtn = document.getElementById('delete-sync-credential-cancel');
    deleteConfirmBtn = document.getElementById('delete-sync-credential-confirm');
    deleteRemoteCheck = document.getElementById('delete-sync-credential-remote');
    deleteStatusEl = document.getElementById('delete-sync-credential-status');
    webdavPermissionBanner = document.getElementById('webdav-permission-banner');
    webdavPermissionMsg = document.getElementById('webdav-permission-msg');
    webdavPermissionBtn = document.getElementById('webdav-permission-btn');
    gistPermissionBanner = document.getElementById('gist-permission-banner');
    gistPermissionMsg = document.getElementById('gist-permission-msg');
    gistPermissionBtn = document.getElementById('gist-permission-btn');
    localAutoBackupStatusEl = document.getElementById('local-auto-backup-status-text');
    localAutoBackupLastAtEl = document.getElementById('local-auto-backup-last-at');
    localAutoBackupErrorEl = document.getElementById('local-auto-backup-error');
    autoBackupRemoteEl = document.getElementById('auto-backup-remote-status');
    autoBackupRemoteActionEl = document.getElementById('auto-backup-remote-action');
    autoBackupUpgradeBox = document.getElementById('auto-backup-upgrade-box');
    autoBackupActivateBtn = document.getElementById('auto-backup-activate-btn');

    // Restore persisted config
    const syncProviderVal = layout.settings.syncProvider || 'local';
    if (syncProviderSelect) syncProviderSelect.value = syncProviderVal;
    if (layout.settings.webdavUrl && webdavUrlInput) webdavUrlInput.value = layout.settings.webdavUrl;
    if (layout.settings.webdavUser && webdavUserInput) webdavUserInput.value = layout.settings.webdavUser;
    if (layout.settings.gistId && gistIdInput) gistIdInput.value = layout.settings.gistId;
    // Ticket 82: private-network opt-in - off unless explicitly persisted as true.
    if (webdavAllowPrivateInput) webdavAllowPrivateInput.checked = layout.settings.webdavAllowPrivateHost === true;
    // (Bug16): sync level + filename (shared across all remote providers)
    if (syncLevelSelect) syncLevelSelect.value = layout.settings.syncLevel || 'full';
    if (syncFilenameInput) syncFilenameInput.value = layout.settings.syncFileName || '';
    // Ticket 81 / spec D5 (finding V-08): per-secret decrypt baselines gate all envelope
    // rewrites. An envelope is only written when its input actually changed (decrypt gate
    // ready AND non-empty AND differing from the baseline); an empty input means "keep the
    // stored envelope", so editing URL/user can never null out _encWebdavPass /
    // _encGistToken again. While decryption is still in flight (gate not ready), a
    // pagehide / visibilitychange / beforeunload / modal-close flush is a no-op for the
    // envelopes (D5 AC3). No stored envelope → ready with an empty baseline.
    // Ticket 99 (T13) / CodeRabbit: once the danger zone deletes stored credentials, any
    // in-flight decrypt/migrate or debounced flush must not write envelopes back into the
    // reset config. Every async credential write captures the epoch at start and aborts
    // when a deletion bumped it mid-flight.
    let credentialsDeletionEpoch = 0;
    let webdavPassBaseline = '';
    let webdavPassReady = !layout.settings._encWebdavPass;
    let gistTokenBaseline = '';
    let gistTokenReady = !layout.settings._encGistToken;
    // Decrypt and fill sensitive fields — awaited so test button waits for password
    if (webdavTestBtn) webdavTestBtn.disabled = true; // disable until password is ready
    (async () => {
      try {
        let migrated = false;
        const deletionEpochAtStart = credentialsDeletionEpoch;
        // CodeRabbit D5 follow-up: snapshot each secret input before decryption starts so
        // a user edit made while decryptCredential is pending is not overwritten on
        // completion (the decrypt baseline still tracks the stored secret).
        const webdavPassInputAtStart = webdavPassInput ? webdavPassInput.value : '';
        const gistTokenInputAtStart = gistTokenInput ? gistTokenInput.value : '';
        if (layout.settings._encWebdavPass && webdavPassInput) {
          webdavPassReady = false;
          const decryptedWebdavPass = await decryptCredential(layout.settings._encWebdavPass);
          if (webdavPassInput.value === webdavPassInputAtStart) webdavPassInput.value = decryptedWebdavPass;
          webdavPassBaseline = decryptedWebdavPass;
          webdavPassReady = true;
          // Ticket 81 lazy migration: rewrite legacy v1/v2/string envelopes as v3
          // (per-install key) so stored records converge without a one-shot pass.
          if (decryptedWebdavPass) {
            const upgraded = await encryptCredential(decryptedWebdavPass);
            if (upgraded && layout.settings._encWebdavPass !== upgraded) {
              if (credentialsDeletionEpoch !== deletionEpochAtStart) return;
              layout.settings._encWebdavPass = upgraded; migrated = true;
            }
          }
        }
        if (layout.settings._encGistToken && gistTokenInput) {
          gistTokenReady = false;
          const decryptedGistToken = await decryptCredential(layout.settings._encGistToken);
          if (gistTokenInput.value === gistTokenInputAtStart) gistTokenInput.value = decryptedGistToken;
          gistTokenBaseline = decryptedGistToken;
          gistTokenReady = true;
          if (decryptedGistToken) {
            const upgraded = await encryptCredential(decryptedGistToken);
            if (upgraded && layout.settings._encGistToken !== upgraded) {
              if (credentialsDeletionEpoch !== deletionEpochAtStart) return;
              layout.settings._encGistToken = upgraded; migrated = true;
            }
          }
        }
        if (migrated) saveLayout();
        debug('WebDAV: credentials decrypted successfully');
      } catch (e) {
        debugErr('WebDAV: credential decrypt failed', e);
      } finally {
        // A field whose decryption threw is ready with an empty baseline: an empty
        // input still means "keep", never "clear" (D5); a freshly typed value may
        // overwrite the unreadable envelope.
        webdavPassReady = true;
        gistTokenReady = true;
        if (webdavTestBtn) webdavTestBtn.disabled = false;
      }
    })();

    updateLastBackupDisplay();

    updateSyncConfigVisibility();
    refreshWebDAVPermissionUi();
    refreshGistPermissionUi();

    autoBackupRemoteActionEl?.addEventListener('click', async () => {
      if (autoBackupRemoteActionEl.disabled) return;
      autoBackupRemoteActionEl.disabled = true;
      try {
        await handleRemoteAutoBackupAction();
      } catch (e) {
        debugWarn('auto-backup cloud action failed', e);
      } finally {
        autoBackupRemoteActionEl.disabled = false;
      }
    });

    webdavPermissionBtn?.addEventListener('click', async () => {
      if (webdavPermissionBtn.disabled) return;
      const rawUrl = (webdavUrlInput?.value ?? layout.settings.webdavUrl ?? '').trim();
      if (rawUrl && !canRequestWebDAVUrlSynchronously(rawUrl)) return;
      const targetOrigin = rawUrl
        ? getWebDAVOriginPattern(rawUrl)
        : (webdavPermissionBtn.dataset.origin || '');
      if (!targetOrigin) return;
      webdavPermissionBtn.disabled = true;
      // Call permissions.request synchronously inside the click gesture before any await (Firefox MV3).
      const reqPromise = requestWebDAVOriginPermission(targetOrigin);
      try {
        const req = await reqPromise;
        if (req.supported && req.granted) {
          await clearPendingPermissionIfOrigin(req.origin || targetOrigin);
          showGrantedFeedback(req.origin || targetOrigin);
          return;
        }
        await persistPendingPermissionState({
          origin: req.origin || targetOrigin,
          source: 'manual-banner',
          reason: req.supported ? 'denied' : 'missing-permission',
        });
        await refreshWebDAVPermissionUi();
      } finally {
        webdavPermissionBtn.disabled = false;
      }
    });

    // Ticket #126: user-gesture grant for the GitHub API origin. The background
    // never calls permissions.request; this button and the enable/sync controls do.
    gistPermissionBtn?.addEventListener('click', async () => {
      if (gistPermissionBtn.disabled) return;
      gistPermissionBtn.disabled = true;
      const reqPromise = requestWebDAVOriginPermission(GIST_API_ORIGIN);
      try {
        const req = await reqPromise;
        if (req.supported && req.granted) {
          await clearGistPendingPermissionIfOrigin(req.origin || GIST_API_ORIGIN);
          await refreshGistPermissionUi();
          return;
        }
        await persistGistPendingPermissionState({
          origin: req.origin || GIST_API_ORIGIN,
          source: 'manual-gist-banner',
          reason: req.supported ? 'denied' : 'missing-permission',
        });
        await refreshGistPermissionUi();
      } finally {
        gistPermissionBtn.disabled = false;
      }
    });

    // (Bug16): sync level + filename persist on change
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
      clearGrantedFeedback();
      updateSyncConfigVisibility();
      refreshWebDAVPermissionUi();
      refreshGistPermissionUi();
      // Switching to Gist while auto-backup is already on is the user action that
      // grants the GitHub API origin (the background cannot prompt).
      if (layout.settings.syncProvider === 'gist' &&
          Number(layout.settings.autoBackupInterval) >= 3600 &&
          getPermissionsApi()) {
        requestWebDAVOriginPermission(GIST_API_ORIGIN).then((req) => {
          if (req && req.granted) {
            clearGistPendingPermissionIfOrigin(req.origin || GIST_API_ORIGIN).then(refreshGistPermissionUi);
          } else {
            persistGistPendingPermissionState({
              origin: GIST_API_ORIGIN,
              source: 'manual',
              reason: req && req.supported ? 'denied' : 'missing-permission',
            }).then(refreshGistPermissionUi);
          }
        }, () => { refreshGistPermissionUi(); });
      }
      saveLayout();
    });

    webdavAllowPrivateInput?.addEventListener('change', () => {
      layout.settings.webdavAllowPrivateHost = webdavAllowPrivateInput.checked === true;
      refreshWebDAVPermissionUi();
      saveLayout();
    });

    // Ticket 81 / D5: __credDirty marks plain fields committed to layout.settings but not
    // yet persisted, so the debounced flush (which runs on pagehide / modal close) can
    // tell a URL/user-only edit apart from "nothing changed" and still save it.
    let __credDirty = false;
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
      __credDirty = false;
      if (urlChanged) { clearGrantedFeedback(); refreshWebDAVPermissionUi(); }
    }));
    // debounced input listeners — survive close without blur (browser close, tab close).
    let __credDebounceTimer = null;
    function __scheduleCredFlush() {
      if (__credDebounceTimer) clearTimeout(__credDebounceTimer);
      __credDebounceTimer = setTimeout(() => { __credDebounceTimer = null; flushUnsavedCredentials(); }, 800);
    }
    // Commit synchronous plain fields instantly (cheap), defer the async encryption via debounce.
    // Ticket 81 / D5: __credDirty is set here because urlChanged is already false by the
    // time the debounced flush runs (the listener committed the value to layout.settings) —
    // without the flag a URL/user-only edit would early-return in flushUnsavedCredentials
    // and be lost.
    [webdavUrlInput, webdavUserInput].forEach(inp => inp?.addEventListener('input', () => {
      const prevUrl = layout.settings.webdavUrl || '';
      const prevUser = layout.settings.webdavUser || '';
      if (webdavUrlInput) layout.settings.webdavUrl = webdavUrlInput.value.trim();
      if (webdavUserInput) layout.settings.webdavUser = webdavUserInput.value.trim();
      if ((layout.settings.webdavUrl || '') !== prevUrl) {
        __credDirty = true;
        clearGrantedFeedback();
        refreshWebDAVPermissionUi();
      } else if ((layout.settings.webdavUser || '') !== prevUser) {
        __credDirty = true;
      }
      __scheduleCredFlush();
    }));
    webdavPassInput?.addEventListener('input', __scheduleCredFlush);
    gistTokenInput?.addEventListener('input', __scheduleCredFlush);
    // Keep blur for immediate commit on tabbing away.
    webdavPassInput?.addEventListener('blur', () => { if (__credDebounceTimer) { clearTimeout(__credDebounceTimer); __credDebounceTimer = null; } flushUnsavedCredentials(); });
    gistTokenInput?.addEventListener('blur', () => {
      if (__credDebounceTimer) { clearTimeout(__credDebounceTimer); __credDebounceTimer = null; }
      flushUnsavedCredentials();
      refreshGistPermissionUi();
    });
    // flush helper — encrypts current input values into layout.settings then saveLayout.
    // Safe-no-op when called from contexts without settings inputs (early startup, etc.).
    let __credFlushInFlight = false;
    async function flushUnsavedCredentials() {
      if (__credFlushInFlight) return;
      const deletionEpochAtStart = credentialsDeletionEpoch;
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
        // unload write-back root cause).
        // Ticket 81 / spec D5 (finding V-08): a secret envelope is written ONLY when the
        // corresponding input actually changed (decrypt gate ready AND non-empty AND
        // differing from the decrypt baseline) — so editing URL/user with empty password /
        // token boxes keeps the stored envelopes, and a pagehide while credential
        // decryption is still in flight is a no-op for the envelopes. Blank inputs are
        // never treated as "delete credential" (a delete entry is spec Q2).
        const urlChanged = webdavUrlInput && webdavUrlCur !== (layout.settings.webdavUrl || '');
        const userChanged = webdavUserInput && webdavUserCur !== (layout.settings.webdavUser || '');
        const passChanged = webdavPassInput && webdavPassReady && passCur !== '' && passCur !== (webdavPassBaseline || '');
        const gistChanged = gistTokenInput && gistTokenReady && gistCur !== '' && gistCur !== (gistTokenBaseline || '');
        if (!urlChanged && !userChanged && !passChanged && !gistChanged && !__credDirty) return;
        if (urlChanged) layout.settings.webdavUrl = webdavUrlCur;
        if (userChanged) layout.settings.webdavUser = webdavUserCur;
        // CodeRabbit D5 follow-up: store a new envelope and advance the baseline only when
        // encryption succeeds — a null result keeps the stored envelope and lets a later
        // flush retry with the same inputs (each secret handled independently).
        if (passChanged) {
          const encPass = await encryptCredential(passCur);
          if (encPass) {
            if (credentialsDeletionEpoch !== deletionEpochAtStart) return;
            layout.settings._encWebdavPass = encPass; webdavPassBaseline = passCur;
          }
        }
        if (gistChanged) {
          const encGist = await encryptCredential(gistCur);
          if (encGist) {
            if (credentialsDeletionEpoch !== deletionEpochAtStart) return;
            layout.settings._encGistToken = encGist; gistTokenBaseline = gistCur;
          }
        }
        __credDirty = false;
        saveLayout();
        debug('flushUnsavedCredentials: committed', { webdavUrl: webdavUrlCur ? '(set)' : '(empty)', pass: passCur ? '(set)' : '(empty)', gist: gistCur ? '(set)' : '(empty)' });
      } catch (e) { debugErr('flushUnsavedCredentials failed', e); }
    }
    window.__boxingFlushCredentials = flushUnsavedCredentials;
    // Ticket 81 test seam (mirrors the __boxingFlushCredentials pattern): lets a spec
    // deterministically pin the "pagehide while credential decryption is still in
    // flight" state (D5 AC3) — the boot-time decrypt window is too short to race in CI.
    window.__boxingSetCredentialDecryptPending = (pending) => { webdavPassReady = !pending; gistTokenReady = !pending; };
    // WebDAV test connection button
    let webdavTestLabelReset = null;
    webdavTestBtn?.addEventListener('click', async () => {
      if (webdavTestLabelReset) { clearTimeout(webdavTestLabelReset); webdavTestLabelReset = null; }
      const rawUrl = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
      const rawUser = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
      const hasPassOrEnvelope = Boolean(webdavPassInput?.value || layout.settings._encWebdavPass);
      const canPreflightPerm = canRequestWebDAVUrlSynchronously(rawUrl) && (!rawUser || hasPassOrEnvelope);
      // Invoke permissions.request synchronously in click handler before any await (Firefox MV3).
      const permPromise = canPreflightPerm ? requestWebDAVOriginPermission(rawUrl) : null;
      webdavTestBtn.textContent = i18n('webdavTesting');
      webdavTestBtn.disabled = true;
      try {
        let preflightHandled = false;
        if (permPromise) {
          const req = await permPromise;
          if (req.supported) {
            preflightHandled = true;
            const targetOrigin = req.origin || getWebDAVOriginPattern(rawUrl);
            if (!req.granted) {
              await persistPendingPermissionState({
                origin: targetOrigin,
                source: 'manual',
                reason: 'denied',
              });
              refreshWebDAVPermissionUi();
              throw webdavError('webdavErrPermissionDenied', [displayOriginFromPattern(targetOrigin) || rawUrl]);
            }
            await clearPendingPermissionIfOrigin(targetOrigin);
            refreshWebDAVPermissionUi();
          }
        }
        await testWebDAVConnection({ allowPermissionPrompt: !preflightHandled, source: 'manual' });
        webdavTestBtn.textContent = i18n('webdavTestOk');
      } catch (e) {
        debugErr('WebDAV test failed', e);
        // Show i18n error if it's a known error, otherwise show the raw message
        const isKnown = isKnownWebDAVError(e);
        if (isKnown) {
          webdavTestBtn.textContent = e.message;
        } else {
          // Network errors (CORS, NetworkError, etc.) get a friendly i18n message
          debug('WebDAV test: unknown error type, showing network error', e.message);
          webdavTestBtn.textContent = i18n('webdavErrNetwork');
        }
      } finally {
        webdavTestBtn.disabled = false;
        webdavTestLabelReset = setTimeout(() => { webdavTestBtn.textContent = i18n('webdavTestBtn'); }, 4000);
      }
    });
    let backupNowLabelReset = null;
    backupNowBtn?.addEventListener('click', async () => {
      const p = syncProviderSelect?.value || layout.settings.syncProvider || 'local';
      // Same contract as the WebDAV test button above: disabled while the
      // request runs, previous label reset cancelled before scheduling a new
      // one, and every failure — including a synchronous backupToLocal() throw —
      // surfaces on the button instead of rejecting unhandled.
      if (backupNowLabelReset) { clearTimeout(backupNowLabelReset); backupNowLabelReset = null; }
      const rawUrl = (layout.settings.webdavUrl || webdavUrlInput?.value || '').trim();
      const rawUser = (layout.settings.webdavUser || webdavUserInput?.value || '').trim();
      const hasPassOrEnvelope = Boolean(webdavPassInput?.value || layout.settings._encWebdavPass);
      let urlCapOk = false;
      if (p === 'webdav' && canRequestWebDAVUrlSynchronously(rawUrl)) {
        try {
          const { fileUrl } = resolveWebDAVFileUrl(rawUrl);
          urlCapOk = Boolean(fileUrl && !fileUrlOverCap(fileUrl));
        } catch (_) { urlCapOk = false; }
      }
      const isGist = p === 'gist';
      const canPreflightPerm = (p === 'webdav' && urlCapOk && (!rawUser || hasPassOrEnvelope)) || isGist;
      // Invoke permissions.request synchronously in click handler before any await (Firefox MV3).
      const permPromise = canPreflightPerm
        ? requestWebDAVOriginPermission(isGist ? GIST_API_ORIGIN : rawUrl)
        : null;
      backupNowBtn.disabled = true;
      try {
        if (p === 'local') {
          backupToLocal();
        }
        let preflightHandled = false;
        if (permPromise) {
          const req = await permPromise;
          if (req.supported) {
            preflightHandled = true;
            const targetOrigin = req.origin || (isGist ? GIST_API_ORIGIN : getWebDAVOriginPattern(rawUrl));
            if (!req.granted) {
              if (isGist) {
                await persistGistPendingPermissionState({
                  origin: targetOrigin,
                  source: 'manual',
                  reason: 'denied',
                });
                await refreshGistPermissionUi();
                throw new Error(i18n('gistAutoBackupErrPermission'));
              }
              await persistPendingPermissionState({
                origin: targetOrigin,
                source: 'manual',
                reason: 'denied',
              });
              refreshWebDAVPermissionUi();
              throw webdavError('webdavErrPermissionDenied', [displayOriginFromPattern(targetOrigin) || rawUrl]);
            }
            if (isGist) {
              await clearGistPendingPermissionIfOrigin(targetOrigin);
              await refreshGistPermissionUi();
            } else {
              await clearPendingPermissionIfOrigin(targetOrigin);
              refreshWebDAVPermissionUi();
            }
          }
        }
        await performBackup({ userInitiated: true, allowPermissionPrompt: !preflightHandled, source: 'manual' });
      } catch (e) {
        // PR #109 review round 2: performBackup now propagates failures —
        // display the localized error on the button (known i18n error verbatim,
        // otherwise the friendly network message, never a raw transport error).
        debugErr('Backup Now failed', e);
        const isKnown = isKnownWebDAVError(e);
        // Gist failures throw curated English strings ("GitHub API 401") — show
        // those verbatim rather than the WebDAV-specific network message.
        backupNowBtn.textContent = isKnown || p === 'gist' ? e.message : i18n('webdavErrNetwork');
      } finally {
        backupNowBtn.disabled = false;
        backupNowLabelReset = setTimeout(() => { backupNowBtn.textContent = i18n('syncNow'); }, 4000);
      }
    });
    let autoBackupSelectSeq = 0;
    const autoBackupSelect = document.getElementById('auto-backup-interval');
    autoBackupSelect?.addEventListener('change', async () => {
      const mySeq = ++autoBackupSelectSeq;
      const intervalSec = parseInt(autoBackupSelect.value, 10) || 0;
      const provider = syncProviderSelect?.value || layout.settings.syncProvider || 'local';
      const wantsGist = provider === 'gist' && intervalSec >= 3600;
      // Call permissions.request synchronously inside the change gesture before any await.
      const gistPermPromise = wantsGist ? requestWebDAVOriginPermission(GIST_API_ORIGIN) : null;
      try {
        if (gistPermPromise) {
          const req = await gistPermPromise;
          if (mySeq !== autoBackupSelectSeq) return;
          if (req && req.granted) {
            await clearGistPendingPermissionIfOrigin(req.origin || GIST_API_ORIGIN);
          } else {
            await persistGistPendingPermissionState({
              origin: GIST_API_ORIGIN,
              source: 'manual',
              reason: req && req.supported ? 'denied' : 'missing-permission',
            });
          }
          if (mySeq !== autoBackupSelectSeq) return;
          await refreshGistPermissionUi();
        }
        if (provider === 'gist') {
          try { await flushUnsavedCredentials(); } catch (e) { debugWarn('pre-auto-backup Gist credential flush failed', e); }
        }
        if (mySeq !== autoBackupSelectSeq) return;
        await configureLocalAutoBackup(intervalSec, intervalSec >= 3600);
      } catch (e) {
        if (typeof debugWarn === 'function') debugWarn('autoBackupSelect change failed', e);
      }
    });
    autoBackupActivateBtn?.addEventListener('click', async () => {
      if (autoBackupActivateBtn.disabled) return;
      const curInterval = parseInt((autoBackupSelect && autoBackupSelect.value) || layout.settings.autoBackupInterval, 10) || 0;
      if (curInterval < 3600) return;
      autoBackupActivateBtn.disabled = true;
      try {
        const provider = syncProviderSelect?.value || layout.settings.syncProvider || 'local';
        if (provider === 'gist') {
          try { await flushUnsavedCredentials(); } catch (e) { debugWarn('pre-activate Gist credential flush failed', e); }
        }
        await configureLocalAutoBackup(curInterval, true);
      } catch (e) {
        if (typeof debugWarn === 'function') debugWarn('autoBackupActivateBtn click failed', e);
      } finally {
        autoBackupActivateBtn.disabled = false;
      }
    });

    // Hydrate local auto-backup UI immediately from persisted state, then ask SW to reconcile
    // any lost alarm / overdue catch-up (only acts if optIn === true).
    refreshLocalAutoBackupUi().catch((e) => { if (typeof debugWarn === 'function') debugWarn('refreshLocalAutoBackupUi init', e); });
    if (hasExtensionRuntime()) {
      sendToBackground({ type: 'auto-backup-ensure', runCatchup: true })
        .then((resp) => refreshLocalAutoBackupUi(resp && resp.state ? resp.state : null))
        .then(() => { if (typeof refreshSnapshotHealth === 'function') return refreshSnapshotHealth(); })
        .catch((e) => { if (typeof debugWarn === 'function') debugWarn('auto-backup-ensure', e); });
    }

    // ── Ticket 99 (T13): delete stored sync credentials — danger zone ──────
    // Two-step confirm (open panel → explicit delete), optional remote data
    // deletion, atomic local reset. After a successful deletion the sync config
    // returns to "not configured" (provider local, credentials and the sync
    // ancestor cleared) so the only reconnect path is the provider select.
    // The three-layer scope list mirrors the research doc (Q2):
    //  will delete  : stored sync credentials in this browser
    //  remote data  : optional — WebDAV file / Gist (delete or keep)
    //  will keep    : local bookmarks and boxes (never touched)
    const dangerRemoteDeleteFailed = i18n('deleteSyncCredentialRemoteFailed');
    const dangerRemoteDeleteNoTarget = i18n('deleteSyncCredentialNoRemoteTarget');
    const dangerPersistFailed = i18n('deleteSyncCredentialPersistFailed');
    const dangerStatusDone = i18n('deleteSyncCredentialStatusDone');

    // Ticket 116 (PR #115 review thread r4496619688): reason-specific feedback for
    // remote-delete refusals. The result keeps its existing { ok, error } shape; a
    // failed delete now also carries a machine-readable `reason`, and the status
    // line prefixes that reason's localized text to the unchanged failure copy
    // ("Failed to delete the remote backup data — nothing was changed."), so the
    // user learns WHY instead of only WHAT, without losing the "nothing changed"
    // promise the ticket pins.
    //
    // The reason vocabulary is a closed allow-list: a reason names only a refusal
    // this engine decided on, and only these reach the result. Transport/stub
    // failures stay unidentified — they are mapped to the generic copy exactly as
    // before (the ticket forbids exposing raw transport errors).
    //   query-fragment    — ticket 114: a base URL with a query string or fragment
    //   url-too-long      — ticket 108: the derived fileUrl exceeds the 2048 cap
    //   embedded-credentials — the derivation would strip userinfo and delete under
    //                          a different account, so it refuses instead
    //   missing-password  — nothing to authenticate the DELETE with
    // Each reason reuses an existing webdavErr* key, so the composed text stays in
    // the same keyed-error vocabulary the sync buttons already show (ticket 111)
    // and ticket 116 adds no new i18n keys.
    const REMOTE_DELETE_REASONS = Object.freeze({
      'query-fragment': 'webdavErrQuery',
      'url-too-long': 'webdavErrUrlTooLong',
      'embedded-credentials': 'webdavErrEmbedded',
      'missing-password': 'webdavErrNoPass',
    });
    function remoteDeleteReasonMessage(reason) {
      const key = REMOTE_DELETE_REASONS[reason];
      return key ? i18n(key) : '';
    }
    // Compose the status line: "<reason>. <unchanged failure copy>". A sentence break,
    // not an em-dash: webdavErrNoPass already reads "…is empty — re-enter and retry"
    // in every locale, so an em-dash join produced a doubled "— … —" for that one
    // reason. No reason text ends in a period, so ". " reads as two sentences in all
    // 14 locales and needs no per-reason separator table.
    // An unknown or absent reason returns the plain copy, so the pre-ticket-116
    // wording, and every "nothing was changed" assertion that pins it, still holds
    // for those failures.
    function remoteDeleteFailureText(reason) {
      const why = remoteDeleteReasonMessage(reason);
      return why ? why + '. ' + dangerRemoteDeleteFailed : dangerRemoteDeleteFailed;
    }

    // Test seam: remote-delete stub (file:// lane has no runtime/network), so
    // tests can simulate remote success/failure without hitting the network.
    let remoteDeleteStub = null;
    window.__boxingSetSyncRemoteDeleteStub = (fn) => { remoteDeleteStub = typeof fn === 'function' ? fn : null; };
    window.__boxingHasStoredSyncCredentials = () => Boolean(layout.settings._encWebdavPass || layout.settings._encGistToken);

    // Ticket 116: an optional machine-readable reason rides along on the status
    // line's data-reason attribute, so the visible copy stays locale-shaped while
    // tests and future callers can distinguish the refusal without parsing text.
    function setDeleteStatus(msg, isError, reason) {
      if (!deleteStatusEl) return;
      deleteStatusEl.textContent = msg || '';
      deleteStatusEl.hidden = !msg;
      deleteStatusEl.dataset.kind = isError ? 'error' : 'ok';
      if (reason) deleteStatusEl.dataset.reason = reason;
      else delete deleteStatusEl.dataset.reason;
    }

    function showDeletePanel(show) {
      if (deleteOpenBtn) deleteOpenBtn.hidden = show;
      if (deletePanel) deletePanel.hidden = !show;
      if (show && deleteCancelBtn) deleteCancelBtn.focus(); // default focus on the safe action
    }

    // Resolve live credentials for the remote delete: input first (typed this
    // session), otherwise decrypt the stored envelope (same install key).
    async function deleteRemoteBackup(opts = {}) {
      const allowPermissionPrompt = opts && opts.allowPermissionPrompt !== undefined ? Boolean(opts.allowPermissionPrompt) : true;
      const provider = syncProviderSelect ? syncProviderSelect.value : 'local';
      if (provider === 'local') return { ok: false, error: dangerRemoteDeleteNoTarget };
      if (remoteDeleteStub) {
        const r = remoteDeleteStub(provider);
        // Never surface the raw stub/transport error to the UI — map any
        // failure to the localized remote-delete failure text.
        return r && r.ok ? { ok: true } : { ok: false, error: dangerRemoteDeleteFailed };
      }
      if (provider === 'webdav') {
        const rawUrl = (webdavUrlInput && webdavUrlInput.value.trim()) || layout.settings.webdavUrl || '';
        // Ticket 114: the delete path derives the same fileUrl, so it applies the
        // same base-URL rules — refuse a query/fragment (corrupted target) and
        // embedded credentials (derivation strips userinfo, so the DELETE would
        // otherwise execute under the configured account) before touching the
        // network. Keeps the "no raw transport error" contract intact.
        if (webdavUrlHasQueryOrFragment(rawUrl)) {
          return { ok: false, reason: 'query-fragment', error: remoteDeleteFailureText('query-fragment') };
        }
        // resolveWebDAVFileUrl throws webdavErrEmbedded when the base carries
        // userinfo (its origin+pathname derivation would strip it). Only that keyed
        // error is a refusal we can name: new URL() also throws a bare TypeError for
        // an unparsable base, and calling that "embedded credentials" would be a
        // wrong reason. Rethrow anything else so deleteSyncCredentials falls back to
        // the generic copy, exactly as it did before this ticket.
        let fileUrl;
        try { fileUrl = resolveWebDAVFileUrl(rawUrl).fileUrl; }
        catch (e) {
          if (!e || e.key !== 'webdavErrEmbedded') throw e;
          return { ok: false, reason: 'embedded-credentials', error: remoteDeleteFailureText('embedded-credentials') };
        }
        if (!fileUrl) return { ok: false, error: dangerRemoteDeleteNoTarget }; // no remote target configured
        // Ticket 108: same derived-URL cap — the background guard would reject this
        // anyway; refuse here so the delete contract stays "no raw transport error".
        if (fileUrlOverCap(fileUrl)) {
          return { ok: false, reason: 'url-too-long', error: remoteDeleteFailureText('url-too-long') };
        }
        // Ticket #123: fail closed on unsafe scheme/private-host URLs before requesting permission or decrypting.
        if (!isSafeExtUrl(rawUrl)) {
          return { ok: false, error: dangerRemoteDeleteFailed };
        }
        const user = (webdavUserInput && webdavUserInput.value.trim()) || layout.settings.webdavUser || '';
        let pass = (webdavPassInput && webdavPassInput.value) || '';
        if (!pass && layout.settings._encWebdavPass) pass = (await decryptCredential(layout.settings._encWebdavPass)) || '';
        if (!pass) {
          return { ok: false, reason: 'missing-password', error: remoteDeleteFailureText('missing-password') };
        }
        const delResp = await sendWebDAVViaBackground(
          { type: 'webdav-delete', url: fileUrl, user, pass },
          { allowPermissionPrompt, source: 'remote-delete' }
        );
        // Server-side refusal: no reason — the transport result is deliberately not
        // surfaced, so this keeps the generic copy (ticket 116 closed allow-list).
        if (!delResp || delResp.ok !== true) return { ok: false, error: dangerRemoteDeleteFailed };
        return { ok: true };
      }
      if (provider === 'gist') {
        const gistId = (gistIdInput && gistIdInput.value.trim()) || layout.settings.gistId || '';
        if (!gistId) return { ok: false, error: dangerRemoteDeleteNoTarget }; // no remote target configured
        let token = (gistTokenInput && gistTokenInput.value.trim()) || '';
        if (!token && layout.settings._encGistToken) token = (await decryptCredential(layout.settings._encGistToken)) || '';
        if (!token) return { ok: false, error: dangerRemoteDeleteFailed }; // cannot authenticate
        const resp = await fetch('https://api.github.com/gists/' + encodeURIComponent(gistId), {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!resp.ok) return { ok: false, error: dangerRemoteDeleteFailed };
        return { ok: true };
      }
      return { ok: false, error: dangerRemoteDeleteNoTarget };
    }

    // Deletes stored sync credentials. Returns { ok, error? }.
    async function deleteSyncCredentials(opts = {}) {
      setDeleteStatus('', false);
      const deleteRemote = Boolean(deleteRemoteCheck && deleteRemoteCheck.checked);
      if (deleteRemote) {
        try {
          const remote = await deleteRemoteBackup(opts);
          if (!remote.ok) {
            // deleteRemoteBackup() already composes the localized text (ticket 116:
            // reason prefix + the unchanged failure copy when it knows the reason);
            // surfacing it here keeps the no-target vs failed distinction. The
            // reason, when present, is mirrored onto the status line for tests.
            setDeleteStatus(remote.error || dangerRemoteDeleteFailed, true, remote.reason);
            return remote;
          }
        } catch (e) {
          // A throw here is a transport/stub surprise, never one of the four
          // refusals above — no reason, generic copy (ticket 116 allow-list).
          debugErr('deleteSyncCredentials: remote delete failed', e);
          setDeleteStatus(dangerRemoteDeleteFailed, true);
          return { ok: false, error: dangerRemoteDeleteFailed };
        }
      }
      // Atomic local reset — provider back to local, credentials and the sync
      // ancestor cleared. syncLevel / syncFileName are provider-agnostic and
      // deliberately kept; the auto-backup interval is a local behavior.
      if (syncProviderSelect) syncProviderSelect.value = 'local';
      layout.settings.syncProvider = 'local'; // persist the provider too (CodeRabbit)
      for (const k of ['webdavUrl', 'webdavUser', '_encWebdavPass', 'webdavAllowPrivateHost', 'gistId', '_encGistToken']) delete layout.settings[k];
      for (const el of [webdavUrlInput, webdavUserInput, webdavPassInput, gistTokenInput, gistIdInput]) if (el) el.value = '';
      if (webdavAllowPrivateInput) webdavAllowPrivateInput.checked = false;
      // Reset the D5 decrypt baselines so a later reconnect with a freshly typed
      // secret is seen as a change and writes a new envelope.
      webdavPassBaseline = ''; gistTokenBaseline = ''; webdavPassReady = true; gistTokenReady = true;
      // Fence any in-flight encrypt/decrypt/migrate writes (flushUnsavedCredentials,
      // the boot decrypt task) so they cannot resurrect the deleted envelopes.
      credentialsDeletionEpoch++;
      try { await setSyncBase(null); } catch (e) { debugWarn('deleteSyncCredentials: syncBase clear failed', e); }
      // Persist WITHOUT merge: saveLayout() merges the stored layout back and its
      // settings spread would resurrect the just-deleted credential fields. The
      // direct write path (same class as pull/restore) bypasses that merge; the
      // revision/updatedAt still advance so peers order the write correctly.
      const persisted = stripGroupsForPersist(layout);
      persisted._meta = {
        ...(persisted._meta || {}),
        revision: (Number(layout._meta && layout._meta.revision) || 0) + 1,
        updatedAt: Date.now()
      };
      try {
        await directSetBoxingLayout(persisted);
        layout._meta = persisted._meta;
      } catch (e) {
        debugErr('deleteSyncCredentials: persist failed', e);
        setDeleteStatus(dangerPersistFailed, true);
        return { ok: false, error: dangerPersistFailed };
      }
      try { await clearWebDAVPendingPermission(); } catch (_) {}
      try { await clearGistPendingPermission(); } catch (_) {}
      await resetAutoBackupCloudTarget();
      clearGrantedFeedback();
      updateSyncConfigVisibility();
      refreshWebDAVPermissionUi();
      refreshGistPermissionUi();
      updateLastBackupDisplay();
      showDeletePanel(false);
      setDeleteStatus(dangerStatusDone, false);
      return { ok: true };
    }
    window.__boxingDeleteSyncCredentials = deleteSyncCredentials;
    // Ticket 116 test seam: exposes the remote-delete result directly so specs can
    // assert the returned `reason` (and the composed `error` text) without routing
    // through the local-reset side effects of deleteSyncCredentials().
    window.__boxingDeleteRemoteBackup = deleteRemoteBackup;

    deleteOpenBtn?.addEventListener('click', () => {
      setDeleteStatus('', false);
      showDeletePanel(true);
    });
    deleteCancelBtn?.addEventListener('click', () => {
      if (deleteRemoteCheck) deleteRemoteCheck.checked = false;
      setDeleteStatus('', false);
      showDeletePanel(false);
    });
    deleteConfirmBtn?.addEventListener('click', async () => {
      if (deleteConfirmBtn.disabled) return;
      const deleteRemote = Boolean(deleteRemoteCheck && deleteRemoteCheck.checked);
      const provider = syncProviderSelect ? syncProviderSelect.value : 'local';
      const rawUrl = (webdavUrlInput && webdavUrlInput.value.trim()) || layout.settings.webdavUrl || '';
      const hasPassOrEnvelope = Boolean((webdavPassInput && webdavPassInput.value) || layout.settings._encWebdavPass);
      let urlCapOk = false;
      if (deleteRemote && provider === 'webdav' && !remoteDeleteStub && canRequestWebDAVUrlSynchronously(rawUrl)) {
        try {
          const { fileUrl } = resolveWebDAVFileUrl(rawUrl);
          urlCapOk = Boolean(fileUrl && !fileUrlOverCap(fileUrl));
        } catch (_) { urlCapOk = false; }
      }
      const canPreflightPerm = deleteRemote && provider === 'webdav' && !remoteDeleteStub && urlCapOk && hasPassOrEnvelope;
      // Invoke permissions.request synchronously in click handler before any await (Firefox MV3).
      const permPromise = canPreflightPerm ? requestWebDAVOriginPermission(rawUrl) : null;
      deleteConfirmBtn.disabled = true;
      try {
        let preflightHandled = false;
        if (permPromise) {
          const req = await permPromise;
          if (req.supported) {
            preflightHandled = true;
            const targetOrigin = req.origin || getWebDAVOriginPattern(rawUrl);
            if (!req.granted) {
              await persistPendingPermissionState({
                origin: targetOrigin,
                source: 'remote-delete',
                reason: 'denied',
              });
              refreshWebDAVPermissionUi();
              setDeleteStatus(dangerRemoteDeleteFailed, true);
              return;
            }
            await clearPendingPermissionIfOrigin(targetOrigin);
            refreshWebDAVPermissionUi();
          }
        }
        await deleteSyncCredentials({ allowPermissionPrompt: !preflightHandled });
      } finally {
        deleteConfirmBtn.disabled = false;
      }
    });
}
