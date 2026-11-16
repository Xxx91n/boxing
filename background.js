// Boxing — MV3 Service Worker
// Cross-browser guard for chrome.* / browser.*
// Debug: open chrome://extensions → Inspect views: service worker → console
const BG_LOG_PREFIX = '[Boxing:BG]';
// Debug mode toggle — set boxing_debug_mode in storage.sync to enable
let BG_DEBUG_ENABLED = false;
function bgRedactUrlToken(rawUrl) {
  let urlPart = rawUrl;
  let suffix = '';
  while (urlPart.endsWith(')') || urlPart.endsWith(']')) {
    const open = urlPart.endsWith(')') ? '(' : '[';
    const close = urlPart.slice(-1);
    let opens = 0;
    let closes = 0;
    for (let i = 0; i < urlPart.length; i++) {
      if (urlPart[i] === open) opens++;
      else if (urlPart[i] === close) closes++;
    }
    if (closes > opens) {
      suffix = close + suffix;
      urlPart = urlPart.slice(0, -1);
    } else {
      break;
    }
  }
  const redacted = urlPart
    .replace(/(https?:\/\/)[^/\s:@?#]*:[^/\s@?#]*@/gi, '$1***:***@')
    .replace(/(https?:\/\/)[^/\s:@?#]+@/gi, '$1***@')
    .replace(/\?[^#]*/g, '?***')
    .replace(/#[\s\S]*/g, '#***');
  return redacted + suffix;
}
function bgRedactSensitiveText(text) {
  return String(text ?? '')
    .replace(/https?:\/\/[^\s"'<>`]+/gi, bgRedactUrlToken)
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]{4,}/gi, '$1 [REDACTED]')
    .replace(/"(_encWebdavPass|_encGistToken|webdavUrl|webdavUser|gistId|boxingCredKey(?:\.v\d+)?)"\s*:\s*(?:"(?:\\.|[^"\\])*"|\{[^}]*\})/g, '"$1":"[REDACTED]"');
}
function bgRedactUrl(urlStr) {
  if (typeof urlStr !== 'string') return '';
  const trimmed = urlStr.trim();
  if (!trimmed) return '';
  try {
    const u = new URL(trimmed);
    const authPart = (u.username || u.password) ? '***:***@' : '';
    const queryPart = u.search ? '?***' : '';
    const hashPart = u.hash ? '#***' : '';
    return u.protocol + '//' + authPart + u.host + u.pathname + queryPart + hashPart;
  } catch (_) {
    return bgRedactSensitiveText(trimmed)
      .replace(/\?[^#\s]*/g, '?***')
      .replace(/#[^\s]*/g, '#***');
  }
}
function bgLog(...a) { if (BG_DEBUG_ENABLED) console.log(BG_LOG_PREFIX, ...a); }
function bgErr(...a) {
  const safeText = bgRedactSensitiveText(a.map(function(x){ return x instanceof Error ? x.message : String(x); }).join(' '));
  console.error(BG_LOG_PREFIX, safeText); // errors always log (redacted)
  // persist bg errors to storage.local so NTP diagnostics panel can surface them
  try {
    const entry = { ts: Date.now(), prefix: '[Boxing:BG]', text: safeText };
    chrome.storage && chrome.storage.local && chrome.storage.local.get && chrome.storage.local.get({ bgErrLog: [] }, function(r) {
      try {
        var log = (r.bgErrLog || []).slice(-49);
        log.push(entry);
        if (chrome.storage && chrome.storage.local && chrome.storage.local.set) chrome.storage.local.set({ bgErrLog: log });
      } catch (_) {}
    });
  } catch (_) {}
}
try {
  chrome.storage?.sync?.get?.('boxing_debug_mode', r => {
    BG_DEBUG_ENABLED = !!(r && r.boxing_debug_mode);
    bgLog('background debug:', BG_DEBUG_ENABLED ? 'enabled' : 'disabled');
  });
} catch (e) { /* silent: top-level init guard, extension loads anyway */ }
(() => {
  const api = (typeof browser !== "undefined" ? browser :
    typeof chrome !== "undefined" ? chrome : null) || null;
  if (!api) return;
  const root = (typeof self !== "undefined" ? self :
    typeof globalThis !== "undefined" ? globalThis : null);
  if (!root) return;

  // Ticket #124 (spec #120 T4): classic Chrome SW loads shared/snapshot-core.js synchronously;
  // Firefox ESM background loads it lazily via dynamic import() in ensureSnapshotCore().
  if (typeof importScripts === 'function' && !root.__boxingSnapshotCore) {
    try {
      importScripts('shared/snapshot-core.js');
    } catch (e) {
      bgErr('Failed to importScripts shared/snapshot-core.js', e);
    }
  }
  // Ticket #125 (spec #120 T5): credential-envelope crypto is shared with the NTP page
  // so the background decrypts with the same code path (no second copy of the legacy
  // literals). Same load split as the snapshot core.
  if (typeof importScripts === 'function' && !root.__boxingCredentialCore) {
    try {
      importScripts('shared/credential-core.js');
    } catch (e) {
      bgErr('Failed to importScripts shared/credential-core.js', e);
    }
  }
  // Ticket #126: the pure Gist first-create protocol core, classic-SW path.
  if (typeof importScripts === 'function' && !root.__boxingGistBackupCore) {
    try {
      importScripts('shared/gist-backup-core.js');
    } catch (e) {
      bgErr('Failed to importScripts shared/gist-backup-core.js', e);
    }
  }

  let _corePromise = null;
  async function ensureSnapshotCore() {
    if (root.__boxingSnapshotCore) return root.__boxingSnapshotCore;
    if (!_corePromise) {
      _corePromise = import('./shared/snapshot-core.js').then((mod) => {
        const core = root.__boxingSnapshotCore || (mod && (mod.default || mod));
        if (core && !root.__boxingSnapshotCore) root.__boxingSnapshotCore = core;
        return root.__boxingSnapshotCore;
      }).catch((e) => {
        _corePromise = null;
        throw e;
      });
    }
    return _corePromise;
  }

  let _credCorePromise = null;
  async function ensureCredentialCore() {
    if (root.__boxingCredentialCore) return root.__boxingCredentialCore;
    if (!_credCorePromise) {
      _credCorePromise = import('./shared/credential-core.js').then((mod) => {
        const candidate = root.__boxingCredentialCore || (mod && (mod.default || mod));
        // A classic-script IIFE module has no ESM exports; accept it only when the
        // expected API is really present so an empty namespace cannot poison the cache.
        const core = candidate && typeof candidate.createCredentialCore === 'function' ? candidate : null;
        if (core && !root.__boxingCredentialCore) root.__boxingCredentialCore = core;
        return core;
      }).catch((e) => {
        _credCorePromise = null;
        throw e;
      });
    }
    return _credCorePromise;
  }

  let _gistCorePromise = null;
  async function ensureGistCore() {
    if (root.__boxingGistBackupCore) return root.__boxingGistBackupCore;
    if (!_gistCorePromise) {
      _gistCorePromise = import('./shared/gist-backup-core.js').then((mod) => {
        const candidate = root.__boxingGistBackupCore || (mod && (mod.default || mod));
        const core = candidate && typeof candidate.planGistFirstCreate === 'function' ? candidate : null;
        if (core && !root.__boxingGistBackupCore) root.__boxingGistBackupCore = core;
        return core;
      }).catch((e) => {
        _gistCorePromise = null;
        throw e;
      });
    }
    return _gistCorePromise;
  }

  // ── Cross-browser storage / alarms / badge helpers ────────
  function bgStorageGet(keys) {
    const local = api.storage && api.storage.local;
    if (!local || typeof local.get !== 'function') return Promise.resolve({});
    return new Promise((resolve, reject) => {
      try {
        if (typeof browser !== 'undefined' && api === browser) {
          Promise.resolve(local.get(keys)).then(resolve, reject);
          return;
        }
        let settled = false;
        const ret = local.get(keys, (res) => {
          if (settled) return;
          settled = true;
          const err = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError;
          if (err) reject(new Error(err.message));
          else resolve(res || {});
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (v) => { if (!settled) { settled = true; resolve(v || {}); } },
            (e) => { if (!settled) { settled = true; reject(e); } }
          );
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  function bgStorageSetValidated(obj, allowHint) {
    const local = api.storage && api.storage.local;
    if (!local || typeof local.set !== 'function') {
      return Promise.reject(new Error('storage.local.set unavailable'));
    }
    // Fail-closed invariant: background must NEVER write boxingLayout.
    if (!obj || typeof obj !== 'object' || Object.prototype.hasOwnProperty.call(obj, 'boxingLayout')) {
      return Promise.reject(new Error('Background refused write to boxingLayout'));
    }
    for (const k of Object.keys(obj)) {
      const okKey = k === 'autoBackupState' || k === 'snap.v1.index' || k.startsWith('snap.v1.');
      if (!okKey) {
        return Promise.reject(new Error('Background refused unexpected write key: ' + k));
      }
    }
    return new Promise((resolve, reject) => {
      try {
        if (typeof browser !== 'undefined' && api === browser) {
          Promise.resolve(local.set(obj)).then(resolve, reject);
          return;
        }
        let settled = false;
        const ret = api.storage.local.set(obj, () => { // SW_SNAP_KEY_PREFIX / SW_SNAP_INDEX_KEY / autoBackupState validated above
          if (settled) return;
          settled = true;
          const err = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError;
          if (err) reject(new Error(err.message));
          else resolve();
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            () => { if (!settled) { settled = true; resolve(); } },
            (e) => { if (!settled) { settled = true; reject(e); } }
          );
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  function bgStorageRemoveValidated(keys) {
    const local = api.storage && api.storage.local;
    if (!local || typeof local.remove !== 'function') return Promise.resolve();
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      if (k === 'boxingLayout') {
        return Promise.reject(new Error('Background refused remove of boxingLayout'));
      }
    }
    return new Promise((resolve, reject) => {
      try {
        if (typeof browser !== 'undefined' && api === browser) {
          Promise.resolve(local.remove(keys)).then(resolve, reject);
          return;
        }
        let settled = false;
        const ret = local.remove(keys, () => {
          if (settled) return;
          settled = true;
          const err = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError;
          if (err) reject(new Error(err.message));
          else resolve();
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            () => { if (!settled) { settled = true; resolve(); } },
            (e) => { if (!settled) { settled = true; reject(e); } }
          );
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  const bgSnapStorage = {
    get: bgStorageGet,
    set: (obj) => bgStorageSetValidated(obj, 'snap.v1.'),
    remove: bgStorageRemoveValidated,
  };

  function bgAlarmsGet(name) {
    const alarms = api.alarms;
    if (!alarms || typeof alarms.get !== 'function') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        if (typeof browser !== 'undefined' && api === browser) {
          Promise.resolve(alarms.get(name)).then((v) => resolve(v || null), () => resolve(null));
          return;
        }
        let settled = false;
        const ret = alarms.get(name, (a) => {
          if (!settled) { settled = true; resolve(a || null); }
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (v) => { if (!settled) { settled = true; resolve(v || null); } },
            () => { if (!settled) { settled = true; resolve(null); } }
          );
        }
      } catch (_) {
        resolve(null);
      }
    });
  }

  function bgAlarmsCreate(name, alarmInfo) {
    const alarms = api.alarms;
    if (!alarms || typeof alarms.create !== 'function') return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const ret = alarms.create(name, alarmInfo);
        if (ret && typeof ret.then === 'function') ret.then(() => resolve(), () => resolve());
        else resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  function bgAlarmsClear(name) {
    const alarms = api.alarms;
    if (!alarms || typeof alarms.clear !== 'function') return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        if (typeof browser !== 'undefined' && api === browser) {
          Promise.resolve(alarms.clear(name)).then((v) => resolve(Boolean(v)), () => resolve(false));
          return;
        }
        let settled = false;
        const ret = alarms.clear(name, (cleared) => {
          if (!settled) { settled = true; resolve(Boolean(cleared)); }
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (v) => { if (!settled) { settled = true; resolve(Boolean(v)); } },
            () => { if (!settled) { settled = true; resolve(false); } }
          );
        }
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function setAutoBackupBadge(isError) {
    const actionApi = api.action || api.browserAction;
    if (!actionApi || typeof actionApi.setBadgeText !== 'function') return;
    try {
      await Promise.resolve(actionApi.setBadgeText({ text: isError ? '!' : '' }));
      if (isError && typeof actionApi.setBadgeBackgroundColor === 'function') {
        await Promise.resolve(actionApi.setBadgeBackgroundColor({ color: '#b3261e' }));
      }
    } catch (_) {
      // Non-fatal: badge API may be unavailable in test environments
    }
  }

  // ── Background local auto-backup (single owner, #124 / #120 T4) ──
  const BG_WEBDAV_PERM_KEY = 'webdavPendingPermission';
  const BG_AUTO_BACKUP_STATE_KEY = 'autoBackupState';
  const BG_AUTO_BACKUP_ALARM_NAME = 'boxing-auto-backup';
  // Ticket #130: extra attempts for short-lived network trouble run on their own
  // one-shot alarm. The normal hourly/daily/weekly alarm is never shortened, so a
  // retry can never be mistaken for the user's chosen cycle.
  const BG_AUTO_BACKUP_RETRY_ALARM_NAME = 'boxing-auto-backup-retry';
  const BG_WORKER_OWNER_ID = 'sw-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();
  let bgAutoBackupQueue = Promise.resolve();
  let bgAutoBackupInFlightPromise = null;
  let bgSnapshotQueue = Promise.resolve();
  // Ticket #130: turning auto-backup off must stop work already on the wire, not
  // wait behind it in the queue. Every request handle is registered here, and the
  // off switch aborts them immediately while bumping the epoch so the next write
  // step sees the stop before it runs.
  const bgAutoBackupAborts = new Set();
  // Ticket #130: the off switch sets this synchronously before it aborts anything, so a
  // task that passed its last state check cannot register a brand-new request afterwards.
  let bgAutoBackupStopping = false;
  // Every configuration request takes a ticket. A queued enable that was overtaken by a
  // later disable must not write optIn back on when the queue finally reaches it.
  let bgAutoBackupConfigSeq = 0;
  // Auto-backup state is read-modify-written by the local run, the manual-write
  // note, and privilege/status updates. Serialize those mutations so a fresh read
  // cannot be overtaken between the read and the storage write.
  let bgStateMutationQueue = Promise.resolve();

  function enqueueBgStateMutation(fn) {
    const run = bgStateMutationQueue.then(fn, fn);
    bgStateMutationQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  function enqueueBgAutoBackup(fn) {
    const run = bgAutoBackupQueue.then(fn, fn);
    bgAutoBackupQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  function enqueueBgSnapshotOp(fn) {
    const run = bgSnapshotQueue.then(fn, fn);
    bgSnapshotQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  function swIsPlausibleLayout(raw) {
    if (!swIsPlainObj(raw)) return false;
    if (typeof raw.version !== 'number' || !Number.isFinite(raw.version)) return false;
    if (!Array.isArray(raw.boxes)) return false;
    return true;
  }

  async function bgReadAutoBackupState() {
    const core = await ensureSnapshotCore();
    const res = await bgStorageGet({ [BG_AUTO_BACKUP_STATE_KEY]: null });
    return core.normalizeAutoBackupState(res && res[BG_AUTO_BACKUP_STATE_KEY]);
  }

  async function bgWriteAutoBackupState(nextState) {
    const core = await ensureSnapshotCore();
    const normalized = core.normalizeAutoBackupState(nextState);
    if (api.storage && api.storage.local && api.storage.local.set) {
      await bgStorageSetValidated({ autoBackupState: normalized }, BG_AUTO_BACKUP_STATE_KEY);
    }
    return normalized;
  }

  // ── Ticket #125 (spec #120 T5): background WebDAV first-create auto backup ──
  // One job only: when the user has enabled auto-backup against a saved WebDAV
  // target, and the remote file is verifiably ABSENT, create it once with
  // If-None-Match: * so a concurrent writer can never be overwritten. Every
  // uncertain case pauses with a reason code and sends nothing. Updating a known
  // target on later cycles belongs to T6 and is deliberately not implemented here.
  const BG_WEBDAV_DEFAULT_FILENAME = 'boxing-backup.json';
  // One network step must not hang the target queue (and therefore future creates)
  // forever. A timed-out PUT is an unknown outcome, never a retryable success.
  const BG_WEBDAV_TIMEOUT_MS = 30000;
  let bgCredKeyPromise = null;
  let bgCredCoreInstance = null;
  const bgWebDAVTargetQueues = new Map();

  // Per-target write queue: a page-driven manual PUT through this worker and the
  // background create sequence for the same fileUrl never interleave here. The
  // create itself stays protected across worker restarts by the conditional header,
  // and a page fallback that skips this worker still cannot make the create
  // overwrite anything (the server answers 412 instead).
  function enqueueBgWebDAVTargetWrite(targetUrl, fn) {
    const key = typeof targetUrl === 'string' ? targetUrl : '';
    const prev = bgWebDAVTargetQueues.get(key) || Promise.resolve();
    const next = prev.then(fn, fn);
    const tail = next.then(() => undefined, () => undefined);
    bgWebDAVTargetQueues.set(key, tail);
    tail.then(() => {
      if (bgWebDAVTargetQueues.get(key) === tail) bgWebDAVTargetQueues.delete(key);
    });
    return next;
  }

  async function bgGetPerInstallCredKeyB64() {
    if (bgCredKeyPromise) return bgCredKeyPromise;
    const pending = (async () => {
      const core = await ensureCredentialCore();
      const storeKey = core.CRED_KEY_STORE_KEY;
      const res = await bgStorageGet({ [storeKey]: null });
      const v = res && res[storeKey];
      return core.isUsablePerInstallKey(v) ? v : '';
    })();
    bgCredKeyPromise = pending;
    try {
      const value = await pending;
      // Only a real key is memoized: a read before the page wrote the key must not
      // pin an empty value for the rest of this worker's life.
      if (!value) bgCredKeyPromise = null;
      return value || '';
    } catch (_) {
      bgCredKeyPromise = null;
      return '';
    }
  }

  // Shared envelope compatibility (v1 decrypt bridge, v2 legacy constant secret, v3
  // per-install key, legacy plaintext string) lives in shared/credential-core.js.
  // Plaintext is used only as the Authorization value and never enters state, logs,
  // or snapshots.
  async function bgDecryptCredential(enc) {
    if (!enc) return '';
    if (typeof enc === 'string') return enc;
    try {
      const core = await ensureCredentialCore();
      if (!core || typeof core.createCredentialCore !== 'function') return '';
      if (!bgCredCoreInstance) {
        bgCredCoreInstance = core.createCredentialCore({
          getPerInstallKeyB64: bgGetPerInstallCredKeyB64,
          onError: (e) => bgErr('bg credential decrypt failed', e),
        });
      }
      return await bgCredCoreInstance.decrypt(enc);
    } catch (e) {
      bgErr('bgDecryptCredential failed', e);
      return '';
    }
  }

  // Mirrors ntp/sync-engine.js resolveWebDAVFileUrl for every accepted base URL
  // (origin + pathname, trailing slash, custom syncFileName sanitization, and the
  // verbatim path that already ends in .json).
  function bgResolveWebDAVFileUrl(settings) {
    const base = settings && typeof settings.webdavUrl === 'string' ? settings.webdavUrl.trim() : '';
    if (!base || base.length > BG_MAX_URL) return { error: 'invalid-url' };
    let target;
    try { target = new URL(base); } catch (_) { return { error: 'invalid-url' }; }
    if (target.protocol !== 'https:') return { error: 'invalid-url' };
    if (target.username || target.password) return { error: 'invalid-url' };
    if (target.search || target.hash) return { error: 'invalid-url' };
    if (!isSafeWebDAVUrl(base, settings.webdavAllowPrivateHost === true)) return { error: 'invalid-url' };
    const baseHref = target.origin + target.pathname;
    let basePath = baseHref;
    if (!basePath.endsWith('/')) basePath += '/';
    const customName = (typeof settings.syncFileName === 'string' ? settings.syncFileName : '')
      .trim().replace(/[\\/]/g, '_').replace(/[\x00-\x1f]/g, '');
    const filename = customName || BG_WEBDAV_DEFAULT_FILENAME;
    let fileUrl = basePath.endsWith(filename) ? basePath : basePath + filename;
    if (target.pathname.endsWith('.json')) fileUrl = baseHref;
    if (fileUrl.length > BG_MAX_URL) return { error: 'invalid-url' };
    try { if (new URL(fileUrl).href.length > BG_MAX_URL) return { error: 'invalid-url' }; } catch (_) { return { error: 'invalid-url' }; }
    return { fileUrl };
  }

  // The saved settings can change while a backup is in flight. Re-read them just
  // before a write: if the target identity moved, stop instead of sending to the
  // old fileUrl. (The epoch check remains the primary stop; this narrows the race
  // caused by a configuration message queued behind a running backup.)
  async function bgWebDAVTargetStillMatches(url, user) {
    const stored = await bgStorageGet({ boxingLayout: null });
    const settings = stored && stored.boxingLayout && stored.boxingLayout.settings;
    if (!settings || settings.syncProvider !== 'webdav') return false;
    const derived = bgResolveWebDAVFileUrl(settings);
    const currentUser = typeof settings.webdavUser === 'string' ? settings.webdavUser.trim() : '';
    return !derived.error && derived.fileUrl === url && currentUser === user;
  }

  // Same allowlist boundary as the page (#122): only sanitized boxing data leaves,
  // syncLevel still decides what the user shares. Credentials never enter this body.
  function bgBuildWebDAVBackupBody(rawLayout) {
    const clean = swSanitizeLayoutForBackup(rawLayout);
    const level = rawLayout && rawLayout.settings ? rawLayout.settings.syncLevel : undefined;
    if (level === 'settingsOnly') {
      clean.boxes = [];
      clean.connections = [];
    } else if (level === 'boxesOnly') {
      clean.settings = null;
    }
    return JSON.stringify(clean, null, 2);
  }

  function bgCoreIfLoaded() {
    return root.__boxingSnapshotCore || null;
  }

  // Retry-After is honored by the retry planner, never by an eager immediate retry.
  function bgRetryAfterMs(resp) {
    const core = bgCoreIfLoaded();
    if (!core || typeof core.parseRetryAfterMs !== 'function') return 0;
    const raw = resp && resp.headers && typeof resp.headers.get === 'function'
      ? resp.headers.get('retry-after')
      : '';
    return core.parseRetryAfterMs(raw, Date.now());
  }

  // `autoBackup` marks the handles the off switch may abort. A user-driven manual
  // backup keeps its own handle so turning the automatic switch off cannot kill it.
  function bgWebDAVAbortHandle(timeoutMs, autoBackup) {
    if (autoBackup === true && bgAutoBackupStopping) {
      const stopped = new Error('auto-backup stopped before the request');
      stopped.bgUserCancelled = true;
      stopped.bgNotSent = true;
      throw stopped;
    }
    if (typeof AbortController !== 'function') return { signal: undefined, done: () => {}, cancel: () => {} };
    const controller = new AbortController();
    let cancelledByUser = false;
    const timer = setTimeout(() => { try { controller.abort(); } catch (_) {} }, timeoutMs);
    const handle = {
      signal: controller.signal,
      get cancelledByUser() { return cancelledByUser; },
      cancel() {
        cancelledByUser = true;
        try { controller.abort(); } catch (_) { /* already settled */ }
      },
      done: () => {
        clearTimeout(timer);
        bgAutoBackupAborts.delete(handle);
      },
    };
    if (autoBackup === true) bgAutoBackupAborts.add(handle);
    return handle;
  }

  // Stop work already in flight for the automatic lane only. Manual backups and
  // manual Gist writes keep running because the user started them explicitly.
  function bgCancelInFlightAutoBackupRequests() {
    for (const handle of bgAutoBackupAborts) {
      try { handle.cancel(); } catch (_) { /* keep cancelling the rest */ }
    }
    bgAutoBackupAborts.clear();
  }

  function bgMarkCancelledError(error, handle) {
    if (handle && handle.cancelledByUser && error && typeof error === 'object') {
      try { error.bgUserCancelled = true; } catch (_) { /* frozen error */ }
    }
    return error;
  }

  async function bgWebDAVReadFileState(url, user, pass, options) {
    const opts = options || {};
    const h = new Headers();
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    const abort = bgWebDAVAbortHandle(BG_WEBDAV_TIMEOUT_MS, opts.autoBackup === true);
    let resp;
    try {
      resp = await fetch(url, { method: 'GET', headers: h, redirect: 'manual', signal: abort.signal });
    } catch (e) {
      abort.done();
      throw bgMarkCancelledError(e, abort);
    }
    if (!resp || resp.status === 0 || resp.type === 'opaqueredirect') {
      abort.done();
      return { kind: 'unreachable', retryAfterMs: bgRetryAfterMs(resp) };
    }
    if (resp.status === 404) { abort.done(); return { kind: 'absent' }; }
    if (resp.status === 401 || resp.status === 403) { abort.done(); return { kind: 'auth' }; }
    if (resp.status === 423) {
      // A locked file is a conflict, not a temporary network problem: the caller keeps
      // it as a readable pause instead of spending the three extra attempts.
      abort.done();
      return { kind: 'locked' };
    }
    if (!resp.ok) {
      abort.done();
      return { kind: 'unreachable', status: resp.status, retryAfterMs: bgRetryAfterMs(resp) };
    }
    const etag = resp.headers.get('etag') || null;
    if (opts.includeBody === false) {
      // The first-create path only needs existence; do not download a foreign file.
      try { if (resp.body && typeof resp.body.cancel === 'function') await resp.body.cancel(); } catch (_) {}
      abort.done();
      return { kind: 'exists', etag };
    }
    let body = '';
    try {
      body = await readCappedBody(resp, 2 * 1024 * 1024);
    } catch (e) {
      // A body read interrupted by the off switch is a cancellation, not a network
      // failure; recording it as "unreachable" would fake a reason the user can fix.
      if (abort.cancelledByUser) throw bgMarkCancelledError(e, abort);
      return { kind: 'unreachable', status: resp.status, retryAfterMs: bgRetryAfterMs(resp) };
    } finally {
      // Keep the abort timer alive through the body read: a server that stops
      // sending after the headers must not hang the target queue forever.
      abort.done();
    }
    return { kind: 'exists', etag, body };
  }

  // A usable If-Match value must be a strong ETag. Weak ETags (W/"...") are not
  // allowed in If-Match, and a missing ETag cannot protect a later write.
  function bgIsStrongETag(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 512 && value !== '*' && !value.startsWith('W/');
  }

  function bgWebDAVProbeTag() {
    return '"boxing-conditional-probe-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 10) + '"';
  }

  // Capability probes must never touch the trusted backup file. Use a throwaway
  // sibling in the same directory: create it, try a wrong If-Match, then delete it.
  function bgWebDAVProbeSiblingUrl(fileUrl) {
    try {
      const u = new URL(fileUrl);
      const slash = u.pathname.lastIndexOf('/');
      const dir = u.pathname.slice(0, slash + 1);
      u.pathname = dir + '.boxing-probe-' + Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 8) + '.json';
      return u.href.length <= 2048 ? u.href : '';
    } catch (_) {
      return '';
    }
  }

  async function bgWebDAVDeleteUrl(url, user, pass) {
    const h = new Headers();
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    const abort = bgWebDAVAbortHandle(BG_WEBDAV_TIMEOUT_MS, true);
    try {
      const resp = await fetch(url, { method: 'DELETE', headers: h, redirect: 'manual', signal: abort.signal });
      if (!resp || resp.status === 0 || resp.type === 'opaqueredirect') return { ok: false, status: 0 };
      return { ok: resp.ok, status: resp.status };
    } catch (e) {
      throw bgMarkCancelledError(e, abort);
    } finally {
      abort.done();
    }
  }

  // Update-only PUT. Unlike create-only (#125), the caller already read the remote
  // file and holds its ETag as the trusted baseline. The condition is the safety
  // story: a writer that got in first turns this into 412, never a silent overwrite.
  async function bgWebDAVUpdateOnly(url, user, pass, body, ifMatch) {
    const h = new Headers({
      'Content-Type': 'application/json',
      'Overwrite': 'T',
      'If-Match': ifMatch,
    });
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    const abort = bgWebDAVAbortHandle(BG_WEBDAV_TIMEOUT_MS, true);
    let resp;
    try {
      resp = await fetch(url, { method: 'PUT', headers: h, body, redirect: 'manual', signal: abort.signal });
    } catch (e) {
      throw bgMarkCancelledError(e, abort);
    } finally {
      abort.done();
    }
    if (!resp || resp.status === 0 || resp.type === 'opaqueredirect') throw new Error('webdav conditional update redirect blocked');
    return { status: resp.status, ok: Boolean(resp.ok), etag: resp.headers.get('etag') || null, retryAfterMs: bgRetryAfterMs(resp) };
  }

  // A successful manual WebDAV write through this worker also becomes the new
  // trusted version for the same target. Without this, the next automatic cycle
  // would see a different ETag and stop as if another device had written. The
  // manual three-way merge and confirmation flow is untouched; only the stored
  // baseline advances. Manual success never counts as an automatic success time.
  async function bgNoteManualWebDAVWrite(url, responseEtag, user, pass, body) {
    try {
      const stored = await bgStorageGet({ boxingLayout: null });
      const settings = stored && stored.boxingLayout && stored.boxingLayout.settings;
      if (!settings || settings.syncProvider !== 'webdav') return null;
      const currentDerived = bgResolveWebDAVFileUrl(settings);
      const currentUser = typeof settings.webdavUser === 'string' ? settings.webdavUser.trim() : '';
      if (currentDerived.error || currentDerived.fileUrl !== url) return null;

      const before = await bgReadAutoBackupState();
      const beforeBaseline = before.remote && before.remote.baseline;
      if (!beforeBaseline || beforeBaseline.service !== 'webdav' || beforeBaseline.fileUrl !== url ||
          beforeBaseline.account !== currentUser) {
        return null;
      }

      if (!bgIsStrongETag(responseEtag)) {
        // Some WebDAV servers omit ETag on PUT but return it on GET. Only adopt the
        // ETag when the bytes on the server are the bytes we just wrote; otherwise
        // another writer got in between and its version is not ours.
        try {
          const read = await bgWebDAVReadFileState(url, user || '', pass || '');
          if (read.kind === 'exists' && bgIsStrongETag(read.etag) && read.body === body) {
            responseEtag = read.etag;
          }
        } catch (_) { /* fall through: no trusted version yet */ }
      }
      if (!bgIsStrongETag(responseEtag)) return null;

      // Patch only the fields this manual write really changes. The patch helper
      // reads the current state again inside the mutation queue, so an automatic
      // success time or a newer pause is not rolled back by a stale copy.
      const next = await bgPatchAutoBackupRemote((remote) => {
        const baseline = remote && remote.baseline;
        if (!baseline || baseline.service !== 'webdav' || baseline.fileUrl !== url ||
            baseline.account !== currentUser) {
          return null;
        }
        const cleared = remote.status !== 'ok';
        return {
          provider: 'webdav',
          status: cleared ? 'idle' : remote.status,
          lastErrorCode: cleared ? null : remote.lastErrorCode,
          baseline: {
            ...baseline,
            etag: responseEtag,
            version: responseEtag,
            verifiedAt: Date.now(),
          },
        };
      }, before.remote.generation);
      if (next) await setAutoBackupBadge(bgAutoBackupNeedsAttention(next.local, next.remote));
      return next;
    } catch (e) {
      bgErr('WebDAV manual write baseline note failed', e);
      return null;
    }
  }

  // Create-only PUT. The header is the whole safety story: on a correct server a
  // concurrent writer turns this into 412 instead of being overwritten.
  async function bgWebDAVCreateOnly(url, user, pass, body) {
    const h = new Headers({ 'Content-Type': 'application/json', 'If-None-Match': '*' });
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    const abort = bgWebDAVAbortHandle(BG_WEBDAV_TIMEOUT_MS, true);
    let resp;
    try {
      resp = await fetch(url, { method: 'PUT', headers: h, body, redirect: 'manual', signal: abort.signal });
    } catch (e) {
      throw bgMarkCancelledError(e, abort);
    } finally {
      abort.done();
    }
    if (!resp || resp.status === 0 || resp.type === 'opaqueredirect') throw new Error('webdav conditional create redirect blocked');
    return { status: resp.status, ok: Boolean(resp.ok), etag: resp.headers.get('etag') || null, retryAfterMs: bgRetryAfterMs(resp) };
  }

  async function bgRecordWebDAVPendingPermission(origin, reason) {
    if (!origin || !api.storage || !api.storage.local || !api.storage.local.set) return null;
    try {
      const stored = await bgStorageGet({ [BG_WEBDAV_PERM_KEY]: null });
      const prev = stored && stored[BG_WEBDAV_PERM_KEY];
      const nextReason = (reason === 'missing-permission' && prev && prev.needed && prev.origin === origin && prev.reason === 'denied')
        ? 'denied'
        : (reason || 'missing-permission');
      const permState = { needed: true, origin, source: 'background', reason: nextReason, updatedAt: Date.now() };
      // Literal key (not the constant) so the data-golden write-site tripwire can name
      // the target key class on this line, same as the pre-#125 writer.
      await api.storage.local.set({ webdavPendingPermission: permState });
      return permState;
    } catch (e) {
      bgErr('bgRecordWebDAVPendingPermission failed', e);
      return null;
    }
  }

  function bgRemoteStatusForCode(code) {
    if (code === 'remote-unreachable' || code === 'create-failed' || code === 'update-failed' || code === 'internal-error') return 'error';
    if (code === 'unknown-outcome') return 'unknown';
    return 'paused';
  }

  function bgAutoBackupNeedsAttention(localState, remoteState) {
    if (localState && localState.status === 'error') return true;
    const rs = remoteState && remoteState.status;
    return rs === 'paused' || rs === 'unknown' || rs === 'error';
  }

  // Ticket #129: a success time and a trusted baseline only describe the provider
  // that wrote them. Provider switches keep the old record for a later switch back,
  // but must never hand it to the new target.
  function bgSuccessAtForProvider(remote, provider) {
    return remote && remote.provider === provider ? (Number(remote.lastSuccessAt) || 0) : 0;
  }
  function bgBaselineForProvider(remote, service) {
    return remote && remote.baseline && remote.baseline.service === service
      ? remote.baseline
      : null;
  }
  // The display side compares this exact string, so an address change cannot inherit
  // the previous address's success time.
  function bgWebDAVSuccessTarget(fileUrl, account) {
    return 'webdav|' + String(fileUrl || '') + '|' + String(account || '');
  }
  function bgGistSuccessTarget(gistId) {
    return gistId ? 'gist|' + String(gistId) : '';
  }

  // Ticket #130 (spec #120 D6): "unknown outcome" is not proof that nothing was
  // written. Before the next automatic write, look at the real file once:
  //   * absent                       -> the earlier create never landed; safe to retry
  //   * exactly the bytes this run would upload -> the server already holds them
  //   * same ETag as the trusted version        -> nothing changed; update may run
  //   * anything else                -> stay paused as unknown; never guess
  async function bgRecheckWebDAVUnknownOutcome(url, user, pass, rawLayout, prevRemote) {
    let read;
    try {
      read = await bgWebDAVReadFileState(url, user, pass, { autoBackup: true });
    } catch (e) {
      if (e && e.bgUserCancelled) return { kind: 'cancelled', remote: prevRemote };
      return { kind: 'unresolved', remote: prevRemote };
    }
    if (read.kind === 'auth') return { kind: 'unresolved', remote: prevRemote };
    if (read.kind === 'locked') return { kind: 'unresolved', remote: prevRemote };
    if (read.kind === 'absent') {
      return { kind: 'not-written', remote: { ...prevRemote, status: 'idle', lastErrorCode: null } };
    }
    if (read.kind !== 'exists') return { kind: 'unresolved', remote: prevRemote };

    let body = null;
    try { body = bgBuildWebDAVBackupBody(rawLayout); } catch (_) { body = null; }
    if (body && read.body === body) {
      // The remote already holds exactly what this run would upload. That is a
      // confirmed success, not a reason to write again.
      const confirmedAt = Date.now();
      const prevBaseline = prevRemote.baseline && prevRemote.baseline.service === 'webdav'
        ? prevRemote.baseline
        : null;
      const strong = bgIsStrongETag(read.etag);
      return {
        kind: 'already-written',
        remote: {
          ...prevRemote,
          provider: 'webdav',
          status: strong ? 'ok' : 'paused',
          lastAttemptAt: confirmedAt,
          lastSuccessAt: confirmedAt,
          lastSuccessTarget: bgWebDAVSuccessTarget(url, user),
          lastErrorCode: strong ? null : 'baseline-unverified',
          baseline: {
            service: 'webdav',
            fileUrl: url,
            account: user,
            createdAt: (prevBaseline && prevBaseline.createdAt) || confirmedAt,
            etag: read.etag || null,
            version: read.etag || null,
            verifiedAt: confirmedAt,
            conditionalVerifiedAt: (prevBaseline && prevBaseline.conditionalVerifiedAt) || 0,
          },
        },
      };
    }

    const prevBaseline = prevRemote.baseline && prevRemote.baseline.service === 'webdav'
      ? prevRemote.baseline
      : null;
    const baselineVersion = prevBaseline ? (prevBaseline.version || prevBaseline.etag) : null;
    if (baselineVersion && read.etag === baselineVersion) {
      // Nothing changed since the last confirmed write, so the earlier request never
      // landed. Releasing "unknown" lets the normal conditional update run again.
      return { kind: 'not-written', remote: { ...prevRemote, status: 'idle', lastErrorCode: null } };
    }
    return { kind: 'unresolved', remote: prevRemote };
  }

  async function runBackgroundWebDAVAutoBackup(opts) {
    const options = opts || {};
    const core = await ensureSnapshotCore();
    const state = options.state;
    const rawLayout = options.layout;
    const activeEpoch = options.epoch;
    const prevRemote = core.normalizeRemoteAutoBackupState(state && state.remote);
    // Ticket #130: an unknown result is re-checked against the real file before any
    // automatic write, so this run may resolve it and continue.
    const wasUnknown = prevRemote.status === 'unknown';
    const settings = rawLayout && rawLayout.settings ? rawLayout.settings : null;
    // Ticket #129: a success time and a trusted baseline only describe the provider
    // that wrote them. Provider switches keep the old record for a later switch back,
    // but must never hand it to the new target.
    const webdavBaseline = bgBaselineForProvider(prevRemote, 'webdav');
    // Ticket #130: the server's own Retry-After (if any) is carried to the planner.
    let retryAfterMs = 0;
    // Ticket #127: the WebDAV baseline this run actually started from. A manual
    // write can land between the caller's snapshot and this run's queue turn.
    let baselineUsed = webdavBaseline;

    if (!settings || settings.syncProvider !== 'webdav') {
      // Not a WebDAV target: cloud auto-backup is off. Keep the trusted baseline
      // (so switching back to the same target still matches), just stop reporting.
      return {
        attempted: false,
        skipped: 'not-webdav',
        remote: { ...prevRemote, status: 'idle', lastErrorCode: null },
      };
    }

    const pausedFrom = (remote, code) => ({
      provider: 'webdav',
      status: bgRemoteStatusForCode(code),
      generation: remote.generation,
      lastAttemptAt: Date.now(),
lastSuccessAt: bgSuccessAtForProvider(remote, 'webdav'),
      lastErrorCode: code,
      lastSuccessTarget: remote.lastSuccessTarget || '',
      account: remote.account,
      baseline: remote.baseline,
      // A Gist POST may still be unconfirmed; switching providers must not erase
      // the marker, or switching back could create a second Gist.
      pendingCreate: remote.pendingCreate,
    });
    const pausedRemote = (code) => pausedFrom(prevRemote, code);

    const derived = bgResolveWebDAVFileUrl(settings);
    const user = typeof settings.webdavUser === 'string' ? settings.webdavUser.trim() : '';

// Safety pauses that require the user to look at the remote file first do not
    // retry on their own (D4: user resolves, then auto-backup resumes). Permission,
    // auth, credential and reachability problems stay retryable because fixing them
    // is a normal user action elsewhere in Settings.
    if (!wasUnknown && prevRemote.status === 'paused' && core.AUTO_BACKUP_REMOTE_BLOCKING_REASONS.includes(prevRemote.lastErrorCode)) {
      return { attempted: false, skipped: 'paused', remote: prevRemote };
    }

    // A saved baseline binds auto-backup to one real target. Any address, account or
    // file-name change stops writes to both the old and the new target until the user
    // confirms the new configuration.
    if (webdavBaseline) {
      if (derived.error) return { attempted: false, remote: pausedRemote('invalid-target') };
      if (webdavBaseline.fileUrl !== derived.fileUrl || webdavBaseline.account !== user) {
        return { attempted: false, remote: pausedRemote('target-changed') };
      }
    }

    if (derived.error) return { attempted: false, remote: pausedRemote('invalid-target') };

    let pass = '';
    if (settings._encWebdavPass) {
      pass = await bgDecryptCredential(settings._encWebdavPass);
      if (!pass) {
        // An unresolved earlier write stays the headline reason until it is checked.
        if (wasUnknown) return { attempted: false, skipped: 'unknown-outcome', remote: prevRemote };
        return { attempted: false, remote: pausedRemote('credential-unreadable') };
      }
    }
    if (user && !pass) {
      if (wasUnknown) return { attempted: false, skipped: 'unknown-outcome', remote: prevRemote };
      return { attempted: false, remote: pausedRemote('credential-unreadable') };
    }

    const perm = await ensureWebDAVPermission(derived.fileUrl);
    if (!perm.ok) {
      if (perm.needPermission && perm.origin) {
        await bgRecordWebDAVPendingPermission(perm.origin, 'missing-permission');
        if (wasUnknown) return { attempted: false, skipped: 'unknown-outcome', remote: prevRemote };
        return { attempted: false, remote: pausedRemote('need-permission') };
      }
      if (wasUnknown) return { attempted: false, skipped: 'unknown-outcome', remote: prevRemote };
      return { attempted: false, remote: pausedRemote('invalid-target') };
    }

    // Ticket #130 (spec #120 D6): before any write that could overwrite, check the
    // real target again. "Already written" is recorded as a confirmed success;
    // "not written" releases the hold; anything else stays unknown and pauses.
    if (wasUnknown) {
      const recheck = await bgRecheckWebDAVUnknownOutcome(derived.fileUrl, user, pass, rawLayout, prevRemote);
      if (recheck.kind === 'cancelled') {
        return { attempted: false, cancelled: true, remote: prevRemote };
      }
      if (recheck.kind === 'already-written') {
        return { attempted: true, rechecked: 'already-written', remote: recheck.remote };
      }
      if (recheck.kind !== 'not-written') {
        return { attempted: false, skipped: 'unknown-outcome', remote: recheck.remote || prevRemote };
      }
      // Persist the release before entering the write queue: the queued step reads the
      // saved state again and would otherwise see the stale "unknown" and skip itself.
      // The generation check keeps a concurrent credential reset intact.
      const released = await bgPatchAutoBackupRemote({
        provider: 'webdav',
        status: 'idle',
        lastErrorCode: null,
      }, Number(recheck.remote && recheck.remote.generation) || 0);
      if (!released) {
        return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
      }
      // The queued step below re-reads the saved state; the released copy is not used here.
    }

    const outcome = await enqueueBgWebDAVTargetWrite(derived.fileUrl, async () => {
      const live = await bgReadAutoBackupState();
      if (!core.isAutoBackupActive(live) || live.epoch !== activeEpoch) {
        return { attempted: false, cancelled: true, remote: live.remote };
      }
const liveRemote = core.normalizeRemoteAutoBackupState(live.remote);
      const liveBaseline = bgBaselineForProvider(liveRemote, 'webdav');
      baselineUsed = liveBaseline;
      // A manual sync may have committed a new layout and baseline after this run
      // captured its local layout. Writing that older layout now would erase the
      // merged result, so stop and let the next cycle use the fresh layout.
      const expectedBaselineVersion = options.expectedBaselineVersion;
      const liveVersion = liveBaseline
        ? (liveBaseline.version || liveBaseline.etag)
        : null;
      if (expectedBaselineVersion !== undefined && liveVersion !== expectedBaselineVersion) {
        return { attempted: false, skipped: 'baseline-changed', remote: liveRemote };
      }
      if (liveRemote.status === 'unknown') {
        return { attempted: false, skipped: 'unknown-outcome', remote: liveRemote };
      }

      // ── Ticket #127: a known, trusted target is updated in place ──
      const baseline = liveBaseline;
      if (baseline) {
        if (baseline.fileUrl !== derived.fileUrl || baseline.account !== user) {
          return { attempted: false, remote: pausedFrom(liveRemote, 'target-changed') };
        }
        const baselineVersion = baseline.version || baseline.etag;
        if (!bgIsStrongETag(baselineVersion)) {
          // No strong ETag came with the last confirmed write. The server cannot
          // protect this update, so wait for a manual sync to establish one.
          return { attempted: false, remote: pausedFrom(liveRemote, 'baseline-unverified') };
        }

        let current;
        try {
          current = await bgWebDAVReadFileState(derived.fileUrl, user, pass, { autoBackup: true });
        } catch (e) {
          if (e && e.bgNotSent) {
            return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
          }
          if (e && e.bgUserCancelled) {
            return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
          }
          bgErr('WebDAV auto-backup update: remote read failed', e);
          return { attempted: true, remote: pausedFrom(liveRemote, 'remote-unreachable') };
        }
        retryAfterMs = Math.max(retryAfterMs, Number(current.retryAfterMs) || 0);
        if (current.kind === 'absent') return { attempted: true, remote: pausedFrom(liveRemote, 'remote-missing') };
        if (current.kind === 'auth') return { attempted: true, remote: pausedFrom(liveRemote, 'auth-failed') };
        if (current.kind === 'locked') return { attempted: true, remote: pausedFrom(liveRemote, 'remote-locked') };
        if (current.kind !== 'exists') return { attempted: true, remote: pausedFrom(liveRemote, 'remote-unreachable') };
        if (!bgIsStrongETag(current.etag)) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'conditional-unsupported') };
        }
        // Different from the version this browser last wrote: another client changed
        // the remote in the meantime. Pause instead of overwriting or pulling.
        if (current.etag !== baselineVersion) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'remote-changed') };
        }

        // Re-check cancellation before the probe. The body build after this point is
        // synchronous, so the probe follows the remote read as closely as possible
        // (the probe window is minimized, not eliminated).
        const liveBeforeProbe = await bgReadAutoBackupState();
        if (!core.isAutoBackupActive(liveBeforeProbe) || liveBeforeProbe.epoch !== activeEpoch) {
          return { attempted: false, cancelled: true, remote: liveBeforeProbe.remote };
        }
        if (!(await bgWebDAVTargetStillMatches(derived.fileUrl, user))) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'target-changed') };
        }

        let body;
        try {
          body = bgBuildWebDAVBackupBody(rawLayout);
        } catch (_) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'internal-error') };
        }
        // Ordinary local edits change this body; an unchanged one is not a conflict.
        // When the remote already holds the same JSON there is nothing to upload.
        if (current.body === body) {
          return {
            attempted: false,
            skipped: 'unchanged',
            remote: {
              ...liveRemote,
              provider: 'webdav',
              status: 'ok',
              lastErrorCode: null,
              baseline: { ...baseline, verifiedAt: Date.now() },
            },
          };
        }

        // Prove the server really enforces If-Match before the first update. The probe
        // runs on a throwaway sibling, never on the trusted backup file: create it,
        // send a wrong If-Match, then delete it. A correct server answers 412; a
        // server that ignores the condition rewrites only the throwaway file.
        if (!baseline.conditionalVerifiedAt) {
          let probeUrl = '';
          let created = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            probeUrl = bgWebDAVProbeSiblingUrl(derived.fileUrl);
            if (!probeUrl) break;
            try {
              const c = await bgWebDAVCreateOnly(probeUrl, user, pass, '{}');
              if (c.status === 412) { created = null; continue; }
              created = c;
              break;
            } catch (e) {
              if (e && e.bgNotSent) {
                return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
              }
              created = { threw: true };
              break;
            }
          }
          if (!created || created.threw) {
            if (probeUrl) { try { await bgWebDAVDeleteUrl(probeUrl, user, pass); } catch (_) {} }
            return { attempted: true, remote: pausedFrom(liveRemote, created && created.threw ? 'update-failed' : 'conditional-unsupported') };
          }
          if (created.status !== 201) {
            if (probeUrl) { try { await bgWebDAVDeleteUrl(probeUrl, user, pass); } catch (_) {} }
            // Keep the server's own floor even when the probe sibling failed.
            retryAfterMs = Math.max(retryAfterMs, Number(created.retryAfterMs) || 0);
            // A lock/conflict on the throwaway sibling is not a network hiccup, so it
            // pauses for the user instead of spending the three extra attempts.
            let code = 'conditional-unsupported';
            if (created.status === 409 || created.status === 423) code = 'remote-locked';
            else if (created.status >= 500) code = 'update-failed';
            return { attempted: true, remote: pausedFrom(liveRemote, code) };
          }

          let probe = null;
          try {
            probe = await bgWebDAVUpdateOnly(probeUrl, user, pass, '{}', bgWebDAVProbeTag());
          } catch (e) {
            if (e && e.bgNotSent) {
              return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
            }
            bgErr('WebDAV auto-backup update: condition probe outcome unknown', e);
            return { attempted: true, remote: pausedFrom(liveRemote, 'unknown-outcome') };
          } finally {
            try { await bgWebDAVDeleteUrl(probeUrl, user, pass); } catch (_) {}
          }
          if (probe.status === 401 || probe.status === 403) {
            return { attempted: true, remote: pausedFrom(liveRemote, 'auth-failed') };
          }
          retryAfterMs = Math.max(retryAfterMs, Number(probe.retryAfterMs) || 0);
          if (probe.status === 404) {
            return { attempted: true, remote: pausedFrom(liveRemote, 'conditional-unsupported') };
          }
          if (probe.status === 409 || probe.status === 423) {
            // A lock or a conflicting state is not a network hiccup: pause and let the
            // user look instead of burning the three extra attempts.
            return { attempted: true, remote: pausedFrom(liveRemote, 'remote-locked') };
          }
          if (probe.status >= 500) {
            // Temporary server trouble is the one thing that gets bounded retries.
            return { attempted: true, remote: pausedFrom(liveRemote, 'update-failed') };
          }
          if (probe.status !== 412) {
            // 2xx means the server ignored If-Match; 428/400 and anything else
            // did not prove conditional support. Never fall back to a plain PUT.
            return { attempted: true, remote: pausedFrom(liveRemote, 'conditional-unsupported') };
          }
        }

        const liveBeforeWrite = await bgReadAutoBackupState();
        if (!core.isAutoBackupActive(liveBeforeWrite) || liveBeforeWrite.epoch !== activeEpoch) {
          return { attempted: false, cancelled: true, remote: liveBeforeWrite.remote };
        }
        if (!(await bgWebDAVTargetStillMatches(derived.fileUrl, user))) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'target-changed') };
        }

        let updated;
        try {
          updated = await bgWebDAVUpdateOnly(derived.fileUrl, user, pass, body, baselineVersion);
        } catch (e) {
          if (e && e.bgNotSent) {
            // The off switch landed just before this write was registered, so nothing
            // reached the server: that is a cancellation, not an unknown outcome.
            return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
          }
          // The PUT may have reached the server. Do not guess and do not retry.
          bgErr('WebDAV auto-backup update outcome unknown', e);
          return { attempted: true, remote: pausedFrom(liveRemote, 'unknown-outcome') };
        }
        if (updated.status === 412 || updated.status === 409) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'remote-changed') };
        }
        retryAfterMs = Math.max(retryAfterMs, Number(updated.retryAfterMs) || 0);
        if (updated.status === 401 || updated.status === 403) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'auth-failed') };
        }
        if (updated.status === 428) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'conditional-unsupported') };
        }
        if (updated.status === 201) return { attempted: true, remote: pausedFrom(liveRemote, 'remote-changed') };
        if (updated.status === 423) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'remote-locked') };
        }
        if (!updated.ok) return { attempted: true, remote: pausedFrom(liveRemote, 'update-failed') };

        // Read the committed version back so the trusted baseline and the success
        // time describe the bytes the server actually holds, not the request.
        let after;
        try {
          after = await bgWebDAVReadFileState(derived.fileUrl, user, pass, { autoBackup: true });
        } catch (e) {
          if (e && e.bgNotSent) {
            return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
          }
          if (e && e.bgUserCancelled) {
            return { attempted: true, remote: pausedFrom(liveRemote, 'unknown-outcome') };
          }
          bgErr('WebDAV auto-backup update: verification read failed', e);
          return { attempted: true, remote: pausedFrom(liveRemote, 'unknown-outcome') };
        }
        retryAfterMs = Math.max(retryAfterMs, Number(after.retryAfterMs) || 0);
        if (after.kind !== 'exists') {
          // The PUT was accepted but the committed file can no longer be read, so
          // the final state is unknown rather than "conditional unsupported".
          return { attempted: true, remote: pausedFrom(liveRemote, 'unknown-outcome') };
        }
        if (!bgIsStrongETag(after.etag)) {
          // The conditional PUT was accepted but the server exposes no strong
          // version to pin the next update to. Keep the data, drop the stale
          // version, and ask for a manual sync rather than calling this success.
          const paused = pausedFrom(liveRemote, 'baseline-unverified');
          paused.baseline = {
            ...baseline,
            etag: null,
            version: null,
            verifiedAt: Date.now(),
          };
          return { attempted: true, remote: paused };
        }
        if (after.etag === baselineVersion) {
          return { attempted: true, remote: pausedFrom(liveRemote, 'conditional-unsupported') };
        }
        if (after.body !== body) {
          // Another writer replaced the file right after our PUT. The write is no
          // longer the remote state, so it cannot be recorded as a success.
          return { attempted: true, remote: pausedFrom(liveRemote, 'unknown-outcome') };
        }

        const confirmedAt = Date.now();
        return {
          attempted: true,
          updated: true,
          remote: {
            ...liveRemote,
            provider: 'webdav',
            status: 'ok',
            lastAttemptAt: confirmedAt,
            lastSuccessAt: confirmedAt,
            lastSuccessTarget: bgWebDAVSuccessTarget(derived.fileUrl, user),
            lastErrorCode: null,
            baseline: {
              ...baseline,
              etag: after.etag,
              version: after.etag,
              verifiedAt: confirmedAt,
              conditionalVerifiedAt: baseline.conditionalVerifiedAt || confirmedAt,
            },
          },
        };
      }

      // ── Ticket #125: first create, only when the remote is verifiably absent ──
      let fileState;
      try {
        fileState = await bgWebDAVReadFileState(derived.fileUrl, user, pass, { includeBody: false, autoBackup: true });
      } catch (e) {
        if (e && e.bgUserCancelled) {
          return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
        }
        bgErr('WebDAV auto-backup: remote check failed', e);
        return { attempted: true, remote: pausedFrom(liveRemote, 'remote-unreachable') };
      }
      retryAfterMs = Math.max(retryAfterMs, Number(fileState.retryAfterMs) || 0);
      if (fileState.kind === 'exists') return { attempted: true, remote: pausedFrom(liveRemote, 'remote-exists-untrusted') };
      if (fileState.kind === 'auth') return { attempted: true, remote: pausedFrom(liveRemote, 'auth-failed') };
      if (fileState.kind === 'locked') return { attempted: true, remote: pausedFrom(liveRemote, 'remote-locked') };
      if (fileState.kind !== 'absent') return { attempted: true, remote: pausedFrom(liveRemote, 'remote-unreachable') };

      let body;
      try {
        body = bgBuildWebDAVBackupBody(rawLayout);
      } catch (_) {
        return { attempted: true, remote: pausedFrom(liveRemote, 'internal-error') };
      }

      // The user may have disabled auto-backup while the remote check was in flight.
      const liveBeforeWrite = await bgReadAutoBackupState();
      if (!core.isAutoBackupActive(liveBeforeWrite) || liveBeforeWrite.epoch !== activeEpoch) {
        return { attempted: false, cancelled: true, remote: liveBeforeWrite.remote };
      }
      if (bgBaselineForProvider(liveBeforeWrite.remote, 'webdav')) {
        return { attempted: false, skipped: 'baseline-present', remote: { ...liveBeforeWrite.remote, status: 'ok', lastErrorCode: null } };
      }
      if (!(await bgWebDAVTargetStillMatches(derived.fileUrl, user))) {
        return { attempted: true, remote: pausedFrom(liveRemote, 'target-changed') };
      }

      let created;
      try {
        created = await bgWebDAVCreateOnly(derived.fileUrl, user, pass, body);
      } catch (e) {
        if (e && e.bgNotSent) {
          return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
        }
        // The request may or may not have reached the server. Do not guess and do
        // not retry automatically; the user must re-check the target first.
        bgErr('WebDAV auto-backup: conditional create outcome unknown', e);
        return { attempted: true, remote: pausedFrom(liveRemote, 'unknown-outcome') };
      }

      if (created.status === 201) {
        const confirmedAt = Date.now();
        // Some servers omit ETag on PUT but return it on GET. Read it once so the
        // first trusted baseline is not lost just because the create response was
        // sparse; a missing ETag everywhere still leaves version=null and pauses.
        let createdEtag = created.etag;
        let createdOverwritten = false;
        if (!bgIsStrongETag(createdEtag)) {
          try {
            const readBack = await bgWebDAVReadFileState(derived.fileUrl, user, pass, { autoBackup: true });
            if (readBack.kind === 'exists' && bgIsStrongETag(readBack.etag)) {
              if (readBack.body === body) createdEtag = readBack.etag;
              else createdOverwritten = true;
            }
          } catch (_) { /* keep the sparse create response */ }
        }
        if (createdOverwritten) {
          const lost = pausedFrom(liveRemote, 'remote-changed');
          lost.lastAttemptAt = confirmedAt;
          lost.lastSuccessAt = confirmedAt;
          lost.baseline = {
            service: 'webdav',
            fileUrl: derived.fileUrl,
            account: user,
            createdAt: confirmedAt,
            etag: null,
            version: null,
            verifiedAt: confirmedAt,
            conditionalVerifiedAt: 0,
          };
          return { attempted: true, remote: lost };
        }
        return {
          attempted: true,
          created: true,
          remote: {
            provider: 'webdav',
            status: bgIsStrongETag(createdEtag) ? 'ok' : 'paused',
            generation: liveRemote.generation,
            lastAttemptAt: confirmedAt,
            lastSuccessAt: confirmedAt,
lastSuccessTarget: bgWebDAVSuccessTarget(derived.fileUrl, user),
            lastErrorCode: bgIsStrongETag(createdEtag) ? null : 'baseline-unverified',
            account: liveRemote.account,
            pendingCreate: liveRemote.pendingCreate,
            baseline: {
              service: 'webdav',
              fileUrl: derived.fileUrl,
              account: user,
              createdAt: confirmedAt,
              etag: createdEtag || null,
              version: createdEtag || null,
              verifiedAt: confirmedAt,
              conditionalVerifiedAt: 0,
            },
          },
        };
      }
      if (created.status === 412) return { attempted: true, remote: pausedFrom(liveRemote, 'remote-exists-unknown') };
      if (created.status === 409) return { attempted: true, remote: pausedFrom(liveRemote, 'create-conflict') };
      if (created.status === 423) return { attempted: true, remote: pausedFrom(liveRemote, 'remote-locked') };
      retryAfterMs = Math.max(retryAfterMs, Number(created.retryAfterMs) || 0);
      if (created.status >= 500) {
        // The server said "try later": one of the three extra attempts may help.
        return { attempted: true, remote: pausedFrom(liveRemote, 'remote-unreachable') };
      }
      if (created.status === 401 || created.status === 403) return { attempted: true, remote: pausedFrom(liveRemote, 'auth-failed') };
      if (created.status === 428) return { attempted: true, remote: pausedFrom(liveRemote, 'conditional-unsupported') };
      // A plain 200/204 means the server did not prove create-only behaviour — a
      // server that ignores If-None-Match could have overwritten a file. Fail closed.
      if (created.ok) return { attempted: true, remote: pausedFrom(liveRemote, 'conditional-unsupported') };
      return { attempted: true, remote: pausedFrom(liveRemote, 'create-failed') };
    });

    bgLog('WebDAV auto-backup result:', JSON.stringify({
      attempted: Boolean(outcome && outcome.attempted),
      created: Boolean(outcome && outcome.created),
      skipped: (outcome && outcome.skipped) || null,
      status: outcome && outcome.remote ? outcome.remote.status : null,
      code: outcome && outcome.remote ? outcome.remote.lastErrorCode : null,
    }));
    return { ...outcome, baselineBefore: baselineUsed, retryAfterMs };
  }

  // ── Background Gist first-create (ticket #126 / #120 T7) ──────────────
  // Only the FIRST unattended Gist is created here. Existing-Gist automatic
  // updates stay paused by product decision (ticket #128 / #120 D4), so this
  // function never PATCHes. Manual writes use the same queue via
  // writeManualGistBackup below. The function returns the same {attempted, remote}
  // shape as the WebDAV path, and writes the durable pending marker before POST.
  const BG_GIST_API_BASE = 'https://api.github.com';
  const BG_GIST_REQUEST_TIMEOUT_MS = 20000;
  const BG_GIST_LIST_MAX_PAGES = 3;

  function bgGistHeaders(token) {
    return new Headers({
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
  }

  async function bgGistFetch(pathname, token, options) {
    const opts = options || {};
    if (opts.autoBackup === true && bgAutoBackupStopping) {
      const stopped = new Error('auto-backup stopped before the request');
      stopped.bgUserCancelled = true;
      stopped.bgNotSent = true;
      throw stopped;
    }
    const controller = new AbortController();
    let cancelledByUser = false;
    const timer = setTimeout(() => {
      try { controller.abort(); } catch (_) { /* already settled */ }
    }, BG_GIST_REQUEST_TIMEOUT_MS);
    const handle = {
      cancel() {
        cancelledByUser = true;
        try { controller.abort(); } catch (_) { /* already settled */ }
      },
    };
    if (opts.autoBackup === true) bgAutoBackupAborts.add(handle);
    const headers = bgGistHeaders(token);
    if (opts.body !== undefined) headers.set('Content-Type', 'application/json');
    try {
      const resp = await fetch(BG_GIST_API_BASE + pathname, {
        method: opts.method || 'GET',
        headers,
        body: opts.body,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (resp.status === 0 || resp.type === 'opaqueredirect') {
        const e = new Error('gist redirect blocked');
        e.gistUnknown = true;
        throw e;
      }
      let text = '';
      try {
        text = await resp.text();
      } catch (e) {
        const bodyErr = new Error('gist response body unreadable');
        bodyErr.gistUnknown = true;
        if (cancelledByUser) bodyErr.bgUserCancelled = true;
        throw bodyErr;
      }
      return { status: resp.status, ok: resp.ok, headers: resp.headers, text, retryAfterMs: bgRetryAfterMs(resp) };
    } catch (e) {
      // An aborted POST that may have reached GitHub is an unknown outcome, never a
      // "the server rolled it back" claim. Callers record that distinction.
      if (cancelledByUser && e && typeof e === 'object') {
        try { e.bgUserCancelled = true; } catch (_) { /* frozen error */ }
      }
      throw e;
    } finally {
      clearTimeout(timer);
      bgAutoBackupAborts.delete(handle);
    }
  }

  function bgNormalizeAccountId(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return typeof value === 'string' && /^\d{1,20}$/.test(value) ? value : '';
  }

  async function bgGistGetUser(token, options) {
    const opts = options || {};
    let resp;
    try {
      resp = await bgGistFetch('/user', token, { method: 'GET', autoBackup: opts.autoBackup === true });
    } catch (e) {
      if (e && e.bgUserCancelled) return { ok: false, reasonCode: 'cancelled' };
      return { ok: false, reasonCode: 'gistCheckFailed' };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, reasonCode: 'gistRequestRejected' };
    }
    if (!resp.ok) return { ok: false, reasonCode: 'gistCheckFailed', retryAfterMs: resp.retryAfterMs || 0 };
    let json;
    try { json = JSON.parse(resp.text); } catch (_) { return { ok: false, reasonCode: 'gistCheckFailed' }; }
    const login = json && json.login;
    const normalizedId = bgNormalizeAccountId(json && json.id);
    if (!normalizedId || typeof login !== 'string' || !login) {
      return { ok: false, reasonCode: 'gistCheckFailed' };
    }
    return { ok: true, account: { login: login.slice(0, 100), id: normalizedId } };
  }

  async function bgGistListOwnGists(token, options) {
    const opts = options || {};
    const all = [];
    for (let page = 1; page <= BG_GIST_LIST_MAX_PAGES; page++) {
      let resp;
      try {
        resp = await bgGistFetch('/gists?per_page=100&page=' + page, token, {
          method: 'GET',
          autoBackup: opts.autoBackup === true,
        });
      } catch (e) {
        // The user's off switch aborted this read. Nothing was written, so this is a
        // cancellation, not a network failure worth recording.
        if (e && e.bgUserCancelled) return { ok: false, reasonCode: 'cancelled' };
        return { ok: false, reasonCode: 'gistCheckFailed' };
      }
      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, reasonCode: 'gistRequestRejected' };
      }
      if (!resp.ok) {
        return { ok: false, reasonCode: 'gistCheckFailed', retryAfterMs: resp.retryAfterMs || 0 };
      }
      let json;
      try { json = JSON.parse(resp.text); } catch (_) { return { ok: false, reasonCode: 'gistCheckFailed' }; }
      if (!Array.isArray(json)) return { ok: false, reasonCode: 'gistCheckFailed' };
      for (const gist of json) all.push(gist);
      const link = resp.headers && typeof resp.headers.get === 'function' ? resp.headers.get('link') : '';
      const hasNext = typeof link === 'string' && /rel="next"/i.test(link);
      if (!hasNext) return { ok: true, gists: all };
    }
    return { ok: false, reasonCode: 'gistListTooMany' };
  }

  async function bgRecordGistPendingPermission(origin, reason) {
    if (!origin || !api.storage || !api.storage.local || !api.storage.local.set) return null;
    try {
      const stored = await bgStorageGet({ [BG_GIST_PENDING_PERM_KEY]: null });
      const prev = stored && stored[BG_GIST_PENDING_PERM_KEY];
      const nextReason = (reason === 'missing-permission' && prev && prev.needed && prev.origin === origin && prev.reason === 'denied')
        ? 'denied'
        : (reason || 'missing-permission');
      const permState = { needed: true, origin, source: 'background', reason: nextReason, updatedAt: Date.now() };
      await api.storage.local.set({ gistPendingPermission: permState });
      return permState;
    } catch (e) {
      bgErr('bgRecordGistPendingPermission failed', e);
      return null;
    }
  }

  async function bgClearGistPendingPermission(origin) {
    try {
      const stored = await bgStorageGet({ [BG_GIST_PENDING_PERM_KEY]: null });
      const pending = stored && stored[BG_GIST_PENDING_PERM_KEY];
      if (!pending) return;
      if (!origin || pending.origin === origin) {
        await bgStorageRemoveValidated(BG_GIST_PENDING_PERM_KEY);
      }
    } catch (e) {
      bgErr('bgClearGistPendingPermission failed', e);
    }
  }

  async function inspectAndRecordBackgroundGistPermission() {
    try {
      const stored = await bgStorageGet({ boxingLayout: null, [BG_GIST_PENDING_PERM_KEY]: null });
      const settings = stored && stored.boxingLayout && stored.boxingLayout.settings;
      if (!settings || settings.syncProvider !== 'gist') return null;
      const perm = await ensureGistApiPermission();
      if (!perm.ok && perm.needPermission) {
        return await bgRecordGistPendingPermission(perm.origin, 'missing-permission');
      }
      if (perm.ok) await bgClearGistPendingPermission(perm.origin);
      return null;
    } catch (e) {
      bgErr('inspectAndRecordBackgroundGistPermission error', e);
      return null;
    }
  }

  async function bgPatchAutoBackupRemote(patch, expectedGeneration) {
    return enqueueBgStateMutation(async () => {
      const latest = await bgReadAutoBackupState();
      const currentGeneration = Number(latest.remote && latest.remote.generation) || 0;
      if (expectedGeneration !== undefined && currentGeneration !== expectedGeneration) {
        return null;
      }
      const resolved = typeof patch === 'function' ? patch(latest.remote || {}, latest) : patch;
      if (!resolved) return null;
      const now = Date.now();
      const remote = { ...(latest.remote || {}), ...resolved };
      const next = await bgWriteAutoBackupState({ ...latest, remote, updatedAt: now });
      return next;
    });
  }

  function bgGistConfigStillMatches(capturedSettings, freshLayout) {
    if (!swIsPlausibleLayout(freshLayout)) return false;
    const fresh = freshLayout.settings || {};
    return fresh.syncProvider === 'gist' &&
      JSON.stringify(fresh._encGistToken || null) === JSON.stringify(capturedSettings._encGistToken || null) &&
      String(fresh.syncFileName || '') === String(capturedSettings.syncFileName || '') &&
      String(fresh.syncLevel || 'full') === String(capturedSettings.syncLevel || 'full') &&
      String(fresh.gistId || '') === String(capturedSettings.gistId || '');
  }

  // Ticket #130 (spec #120 D6): an interrupted POST left a durable marker. Before any
  // new create, check the account's Gists once. Only a real file owned by the same
  // account counts as the confirmed write; an empty list is NOT proof that nothing
  // was created (listing can lag), so the hold stays instead of making a copy.
  async function bgVerifyGistPendingCreate(input) {
    const opts = input || {};
    const gistCore = opts.gistCore;
    const pending = opts.pendingCreate;
    const prevRemote = opts.prevRemote;
    if (!gistCore || !pending) return { kind: 'unresolved', retryAfterMs: 0 };
    const listResult = await bgGistListOwnGists(opts.token, { autoBackup: true });
    if (!listResult.ok) {
      if (listResult.reasonCode === 'cancelled') return { kind: 'cancelled', retryAfterMs: 0 };
      return { kind: 'unresolved', retryAfterMs: listResult.retryAfterMs || 0 };
    }
    const gists = Array.isArray(listResult.gists) ? listResult.gists : [];
    let match = null;
    for (const gist of gists) {
      if (!gist || typeof gist !== 'object') continue;
      if (!gist.files || typeof gist.files !== 'object' || !gist.files[pending.fileName]) continue;
      match = gist;
      break;
    }
    if (!match) return { kind: 'unresolved', retryAfterMs: 0 };
    const parsed = gistCore.parseGistResponse(match, pending.fileName);
    if (!parsed) return { kind: 'unresolved', retryAfterMs: 0 };
    if (pending.accountId && parsed.ownerId && String(parsed.ownerId) !== String(pending.accountId)) {
      return { kind: 'target-changed', retryAfterMs: 0 };
    }
    // A same-named Gist that already existed before this POST started belongs to an
    // earlier attempt or another tool; it is not proof that this interrupted create
    // landed. GitHub timestamps have second resolution, so allow a little skew.
    const skewMs = 60 * 1000;
    const createdAt = Number(parsed.createdAt) || 0;
    if (!createdAt || createdAt < (Number(pending.startedAt) || 0) - skewMs) {
      return { kind: 'unresolved', retryAfterMs: 0 };
    }
    const finishedAt = Date.now();
    const baseline = {
      service: 'gist',
      gistId: parsed.gistId,
      fileName: parsed.fileName,
      ownerLogin: parsed.ownerLogin || pending.accountLogin,
      ownerId: parsed.ownerId || pending.accountId,
      createdAt: parsed.createdAt || pending.startedAt,
      updatedAt: parsed.updatedAt || finishedAt,
      verifiedAt: finishedAt,
    };
    const next = await bgPatchAutoBackupRemote({
      provider: 'gist',
      status: 'ok',
      lastAttemptAt: finishedAt,
      lastSuccessAt: parsed.updatedAt || finishedAt,
      lastSuccessTarget: bgGistSuccessTarget(parsed.gistId),
      lastErrorCode: null,
      account: { login: baseline.ownerLogin, id: baseline.ownerId },
      baseline,
      pendingCreate: null,
    }, Number(prevRemote && prevRemote.generation) || 0);
    if (!next) return { kind: 'cancelled', retryAfterMs: 0 };
    bgLog('Gist pending create confirmed id=' + parsed.gistId);
    return { kind: 'confirmed', remote: next.remote };
  }

  async function runBackgroundGistAutoBackup(opts) {
    const options = opts || {};
    const trigger = String(options.trigger || 'alarm');
    const expectedEpoch = options.epoch;
    const core = await ensureSnapshotCore();
    const gistCore = await ensureGistCore();
    let state = options.state || await bgReadAutoBackupState();
    let rawLayout = options.layout || null;
    if (!rawLayout) {
      const stored = await bgStorageGet({ boxingLayout: null });
      rawLayout = stored && stored.boxingLayout;
    }
    const prevRemote = core.normalizeRemoteAutoBackupState(state && state.remote);
    const remoteGeneration = Number(prevRemote.generation) || 0;
    const prevGistSuccessAt = bgSuccessAtForProvider(prevRemote, 'gist');
    const settings = rawLayout && rawLayout.settings ? rawLayout.settings : null;
    if (!settings || settings.syncProvider !== 'gist') {
      return { attempted: false, skipped: 'not-gist', remote: prevRemote };
    }

    const finish = async (attempted, remote, extra) => {
      const nextRemote = remote || (await bgReadAutoBackupState()).remote;
      await setAutoBackupBadge(bgAutoBackupNeedsAttention(null, nextRemote));
      return { attempted, remote: nextRemote, ...(extra || {}) };
    };

    const finishPause = async (code, fromRemote, extraPatch, retryAfterMs) => {
      const patch = {
        provider: 'gist',
        // An unresolved write stays "unknown" and is never retried on its own; a failed
        // check keeps the readable pause and is eligible for the bounded retry by code.
        status: code === 'gistResultUnknown' ? 'unknown' : 'paused',
        lastAttemptAt: Date.now(),
        // Ticket #129: a WebDAV timestamp must not become the Gist target's
        // "last success" after a provider switch.
        lastSuccessAt: (fromRemote && fromRemote.provider === 'gist')
          ? (Number(fromRemote.lastSuccessAt) || 0)
          : 0,
        lastErrorCode: code,
        ...extraPatch,
      };
      const next = await bgPatchAutoBackupRemote(patch, remoteGeneration);
      if (!next) {
        return { attempted: true, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
      }
      bgLog('Gist first-create paused: ' + code + ' trigger=' + trigger);
      return finish(true, next.remote, { retryAfterMs: Math.max(0, Number(retryAfterMs) || 0) });
    };

    let token = '';
    try {
      token = await bgDecryptCredential(settings._encGistToken);
    } catch (e) {
      bgErr('Gist token decrypt failed', e);
      token = '';
    }
    const tokenPresent = typeof token === 'string' && token.trim().length > 0;

    let permission = { ok: false, needPermission: true, origin: BG_GIST_API_ORIGIN };
    if (tokenPresent) {
      permission = await ensureGistApiPermission();
      if (!permission.ok && permission.needPermission) {
        await bgRecordGistPendingPermission(permission.origin);
      } else if (permission.ok) {
        await bgClearGistPendingPermission(permission.origin);
      }
    }
    if (!tokenPresent) return finishPause('gistTokenMissing', prevRemote);
    if (!permission.ok) return finishPause('gistPermissionMissing', prevRemote);

    if (prevRemote.pendingCreate) {
      // Ticket #130: check the account's Gists once before any create. A confirmed
      // match is a real success; anything else keeps the hold, so a lost POST never
      // turns into a second copy.
      const verified = await bgVerifyGistPendingCreate({
        gistCore,
        token,
        pendingCreate: prevRemote.pendingCreate,
        prevRemote,
      });
      if (verified.kind === 'confirmed') return finish(true, verified.remote);
      if (verified.kind === 'cancelled') {
        return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
      }
      if (verified.kind === 'target-changed') {
        return finishPause('gistPendingTargetChanged', prevRemote, {}, verified.retryAfterMs || 0);
      }
      return finishPause('gistResultUnknown', prevRemote, {}, verified.retryAfterMs || 0);
    }

    const accountResult = await bgGistGetUser(token, { autoBackup: true });
    if (!accountResult.ok) {
      if (accountResult.reasonCode === 'cancelled') {
        return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
      }
      return finishPause(accountResult.reasonCode || 'gistCheckFailed', prevRemote, {}, accountResult.retryAfterMs || 0);
    }
    const account = accountResult.account;

    const remoteBaseline = prevRemote.baseline && prevRemote.baseline.service === 'gist'
      ? {
          provider: 'gist',
          gistId: prevRemote.baseline.gistId,
          fileName: prevRemote.baseline.fileName,
          ownerLogin: prevRemote.baseline.ownerLogin,
          ownerId: prevRemote.baseline.ownerId,
        }
      : null;
    const plan = gistCore.planGistFirstCreate({
      settings,
      cloud: {
        pendingCreate: prevRemote.pendingCreate,
        baseline: remoteBaseline,
        account: prevRemote.account,
      },
      account,
      tokenPresent: true,
      permission: { ok: true },
    });

    const sameAccountPatch = (!prevRemote.account || String(prevRemote.account.id) === String(account.id))
      ? { account }
      : {};

    if (plan.action === 'pause') {
      return finishPause(plan.reasonCode, prevRemote, sameAccountPatch);
    }
    if (plan.action === 'update-not-enabled') {
      return finishPause('gistUpdateNotEnabled', prevRemote, sameAccountPatch);
    }
    if (plan.action !== 'create') {
      return { attempted: false, skipped: plan.action, remote: prevRemote };
    }

    const listResult = await bgGistListOwnGists(token, { autoBackup: true });
    if (!listResult.ok) {
      if (listResult.reasonCode === 'cancelled') {
        return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
      }
      return finishPause(listResult.reasonCode || 'gistCheckFailed', prevRemote, sameAccountPatch, listResult.retryAfterMs || 0);
    }
    const conflict = gistCore.findGistWithFile(listResult.gists, plan.fileName);
    if (conflict) {
      return finishPause('gistUnknownExisting', prevRemote, sameAccountPatch);
    }

    const beforePost = await bgReadAutoBackupState();
    const freshStored = await bgStorageGet({ boxingLayout: null });
    const freshLayout = freshStored && freshStored.boxingLayout;
    const freshGeneration = Number(beforePost.remote && beforePost.remote.generation) || 0;
    if (!core.isAutoBackupActive(beforePost) ||
        (expectedEpoch !== undefined && beforePost.epoch !== expectedEpoch) ||
        freshGeneration !== remoteGeneration ||
        !bgGistConfigStillMatches(settings, freshLayout)) {
      if (!core.isAutoBackupActive(beforePost)) await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
      return { attempted: false, cancelled: true, remote: beforePost.remote };
    }

    const fileName = plan.fileName;
    const content = bgBuildWebDAVBackupBody(freshLayout);
    if (content.length > BG_MAX_BODY) {
      return finishPause('gistPayloadTooLarge', prevRemote, sameAccountPatch);
    }
    const body = gistCore.buildGistCreateBody(fileName, content);
    const startedAt = Date.now();
    const pendingCreate = {
      provider: 'gist',
      fileName,
      description: body.description,
      startedAt,
      accountLogin: account.login,
      accountId: account.id,
      gistId: '',
    };

    const markerState = await bgPatchAutoBackupRemote({
      provider: 'gist',
      status: 'running',
      lastAttemptAt: startedAt,
      lastSuccessAt: prevGistSuccessAt,
      lastErrorCode: null,
      account,
      pendingCreate,
    }, remoteGeneration);
    if (!markerState) {
      return { attempted: false, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
    }

    const pendingPatch = (extra) => ({
      provider: 'gist',
      status: 'unknown',
      lastAttemptAt: startedAt,
      lastSuccessAt: prevGistSuccessAt,
      lastErrorCode: 'gistResultUnknown',
      account,
      pendingCreate,
      ...extra,
    });
    const writePending = async (extra) => {
      const next = await bgPatchAutoBackupRemote(pendingPatch(extra), remoteGeneration);
      return next ? next.remote : null;
    };

    let resp = null;
    let requestError = null;
    try {
      resp = await bgGistFetch('/gists', token, { method: 'POST', body: JSON.stringify(body), autoBackup: true });
    } catch (e) {
      requestError = e;
    }
    const finishedAt = Date.now();

    if (requestError && requestError.bgNotSent) {
      // The off switch landed before the POST was registered. Nothing was created, so
      // roll the pending marker back instead of leaving an unknown result behind.
      const rolled = await bgPatchAutoBackupRemote({
        provider: 'gist',
        status: prevRemote.status,
        lastErrorCode: prevRemote.lastErrorCode,
        lastAttemptAt: prevRemote.lastAttemptAt,
        pendingCreate: prevRemote.pendingCreate,
      }, remoteGeneration);
      return {
        attempted: false,
        cancelled: true,
        remote: rolled ? rolled.remote : (await bgReadAutoBackupState()).remote,
      };
    }
    if (!resp) {
      const remote = await writePending();
      bgErr('Gist create result unknown (' + trigger + '):', requestError && requestError.message ? requestError.message : 'network error');
      if (!remote) return { attempted: true, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
      return finish(true, remote);
    }

    if (resp.status === 201) {
      let json = null;
      try { json = JSON.parse(resp.text); } catch (_) { json = null; }
      const parsed = json ? gistCore.parseGistResponse(json, fileName) : null;
      if (parsed) {
        const baseline = {
          service: 'gist',
          gistId: parsed.gistId,
          ownerLogin: parsed.ownerLogin || account.login,
          ownerId: parsed.ownerId || account.id,
          fileName,
          createdAt: parsed.createdAt || finishedAt,
          updatedAt: parsed.updatedAt || finishedAt,
          verifiedAt: finishedAt,
        };
        const next = await bgPatchAutoBackupRemote({
          provider: 'gist',
          status: 'ok',
          lastAttemptAt: startedAt,
          lastSuccessAt: finishedAt,
          lastSuccessTarget: bgGistSuccessTarget(baseline.gistId),
          lastErrorCode: null,
          account: { login: baseline.ownerLogin, id: baseline.ownerId },
          baseline,
          pendingCreate: null,
        }, remoteGeneration);
        if (!next) {
          bgLog('Gist first-create confirmed but discarded after reset id=' + baseline.gistId + ' trigger=' + trigger);
          return { attempted: true, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
        }
        bgLog('Gist first-create confirmed id=' + baseline.gistId + ' trigger=' + trigger);
        return finish(true, next.remote);
      }
      const knownId = json ? gistCore.normalizeGistId(json.id) : '';
      const remote = await writePending({ pendingCreate: { ...pendingCreate, gistId: knownId } });
      bgErr('Gist create response incomplete (' + trigger + ')');
      if (!remote) return { attempted: true, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
      return finish(true, remote);
    }

    const failure = gistCore.classifyGistFailure(resp.status);
    if (failure.kind === 'unknown') {
      const remote = await writePending({ lastErrorCode: failure.reasonCode });
      bgErr('Gist create returned HTTP ' + resp.status + ' (' + trigger + '); result treated as unknown');
      if (!remote) return { attempted: true, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
      return finish(true, remote);
    }

    const next = await bgPatchAutoBackupRemote({
      provider: 'gist',
      status: 'paused',
      lastAttemptAt: startedAt,
      lastSuccessAt: prevGistSuccessAt,
      lastErrorCode: failure.reasonCode,
      account,
      pendingCreate: null,
    }, remoteGeneration);
    if (!next) {
      return { attempted: true, cancelled: true, remote: (await bgReadAutoBackupState()).remote };
    }
    bgLog('Gist first-create rejected HTTP ' + resp.status + ' trigger=' + trigger);
    return finish(true, next.remote);
  }

  // ── Manual Gist write inside the same single queue (ticket #128) ────────
  // The page no longer PATCHes/POSTs GitHub directly when an extension runtime
  // exists: every Gist write enters enqueueBgAutoBackup, so two tabs, a manual
  // click, and the unattended first create cannot run at the same time. The
  // automatic UPDATE of an existing Gist stays disabled by product decision in
  // planGistFirstCreate; this function is the user-driven path only.
  function bgGistWriteError(reasonCode, error, extra) {
    return { success: false, reasonCode, error: error || reasonCode, ...(extra || {}) };
  }

  // A manual write never claims the unattended success time, but it does resolve
  // an "unknown" remote result that the write just confirmed. Other automatic
  // states (paused for an unproven update, error) stay exactly as they were.
  function bgManualGistSuccessStatus(remote) {
    if (!remote) return 'idle';
    if (remote.status === 'running' || remote.status === 'unknown') return 'idle';
    return remote.status;
  }

  function bgManualGistSuccessCode(remote) {
    if (!remote || remote.status === 'unknown') return null;
    return remote.lastErrorCode || null;
  }

  async function writeManualGistBackup(msg) {
    const opts = msg || {};
    const content = typeof opts.content === 'string' ? opts.content : '';
    if (!content) return bgGistWriteError('gistCheckFailed', 'Empty backup body');
    if (content.length > BG_MAX_BODY) {
      return bgGistWriteError('gistPayloadTooLarge', 'Backup body too large');
    }

    const stored = await bgStorageGet({ boxingLayout: null });
    const rawLayout = stored && stored.boxingLayout;
    if (!swIsPlausibleLayout(rawLayout)) {
      return bgGistWriteError('gistCheckFailed', 'boxingLayout is missing or invalid');
    }
    const settings = rawLayout.settings || {};
    if (settings.syncProvider !== 'gist') {
      return bgGistWriteError('gistCheckFailed', 'Gist is not the selected sync provider');
    }

    // The settings page may have just received a token typed into its input; that
    // value is preferred so a click does not race the asynchronous envelope flush.
    // It only travels in the in-extension message, never to storage or logs.
    const pageToken = typeof opts.token === 'string' ? opts.token.trim() : '';
    let storedToken = '';
    try {
      storedToken = await bgDecryptCredential(settings._encGistToken);
    } catch (e) {
      bgErr('Manual Gist token decrypt failed', e);
      storedToken = '';
    }
    let token = pageToken || storedToken;
    const tokenPresent = typeof token === 'string' && token.trim().length > 0;

    let permission = { ok: false, needPermission: true, origin: BG_GIST_API_ORIGIN };
    if (tokenPresent) {
      permission = await ensureGistApiPermission();
      if (!permission.ok && permission.needPermission) {
        await bgRecordGistPendingPermission(permission.origin, 'missing-permission');
      } else if (permission.ok) {
        await bgClearGistPendingPermission(permission.origin);
      }
    }
    if (!tokenPresent) return bgGistWriteError('gistTokenMissing', 'GitHub token not configured');
    if (!permission.ok) {
      return bgGistWriteError('gistPermissionMissing', 'host permission not granted', {
        needPermission: Boolean(permission.needPermission),
        origin: permission.origin || BG_GIST_API_ORIGIN,
      });
    }

    // Re-read inside the queue: the first writer may have just created the Gist or
    // left an unconfirmed POST marker while this call was waiting.
    const state = await bgReadAutoBackupState();
    const remote = state.remote || {};
    const generation = Number(remote.generation) || 0;
    let baseline = remote.baseline && remote.baseline.service === 'gist' ? remote.baseline : null;
    const gistCore = await ensureGistCore();
    const plan = gistCore.planManualGistWrite({
      settings,
      cloud: { pendingCreate: remote.pendingCreate, baseline },
      gistId: opts.gistId,
      fileName: opts.fileName,
      payloadTooLarge: false,
      tokenPresent: true,
      permission: { ok: true },
    });
    if (plan.action === 'pause') {
      // A pending marker that conflicts with the trusted baseline is a known
      // target review, not an unconfirmed write; clear it so the user is not
      // locked out of both paths forever.
      if (remote.pendingCreate && plan.reasonCode === 'gistTargetNeedsReview') {
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          pendingCreate: null,
          status: 'paused',
          lastAttemptAt: Date.now(),
          lastErrorCode: plan.reasonCode,
        }, generation);
      }
      return bgGistWriteError(plan.reasonCode, plan.reasonCode);
    }
    if (plan.action !== 'post' && plan.action !== 'patch' && plan.action !== 'confirm-pending') {
      return bgGistWriteError('gistCheckFailed', 'Gist backup is not available');
    }

    const fileName = plan.fileName;

    // Verify the token belongs to the account the target was bound to before any
    // write. A changed account never silently takes over an existing baseline.
    // Never fall back to a different saved credential here: a rejected page token
    // must fail instead of uploading under another account.
    const accountResult = await bgGistGetUser(token);
    if (!accountResult.ok) {
      await bgPatchAutoBackupRemote({
        provider: 'gist',
        // A pending POST still needs a human check; do not replace "unknown" with
        // a different pause reason.
        status: remote.pendingCreate ? 'unknown' : 'paused',
        lastAttemptAt: Date.now(),
        lastErrorCode: accountResult.reasonCode || 'gistCheckFailed',
      }, generation);
      return bgGistWriteError(accountResult.reasonCode || 'gistCheckFailed', 'GitHub account check failed');
    }
    const account = accountResult.account;
    const boundAccountId = remote.pendingCreate && remote.pendingCreate.accountId
      ? remote.pendingCreate.accountId
      : (baseline && baseline.ownerId);
    if (boundAccountId && String(boundAccountId) !== String(account.id)) {
      await bgPatchAutoBackupRemote({
        provider: 'gist',
        status: 'paused',
        lastAttemptAt: Date.now(),
        lastErrorCode: 'gistAccountChanged',
      }, generation);
      return bgGistWriteError('gistAccountChanged', 'GitHub account changed');
    }

    let action = plan.action;
    let targetGistId = plan.gistId;

    // Recover a POST whose response carried the Gist id but not a usable body:
    // GET that Gist, confirm the expected file, record the baseline, then PATCH.
    // A marker without an id cannot be recovered safely and stays paused.
    if (action === 'confirm-pending') {
      const pending = remote.pendingCreate || {};
      const pendingFileName = gistCore.sanitizeGistFileName(pending.fileName || fileName);
      const clearPendingPause = async (code) => {
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          pendingCreate: null,
          status: 'paused',
          lastAttemptAt: Date.now(),
          lastErrorCode: code,
          account,
        }, generation);
      };
      if (pendingFileName !== fileName) {
        // Keep the marker: the POST may have created that Gist, and the user can
        // switch the file name back to confirm it. Clearing it here would make the
        // old Gist untracked or cause a second Gist to be created.
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: Date.now(),
          lastErrorCode: 'gistPendingFileNameChanged',
          account,
        }, generation);
        return bgGistWriteError('gistPendingFileNameChanged', 'The pending Gist file name changed', {
          resultUnknown: true,
          gistId: targetGistId,
        });
      }

      let confirmResp = null;
      try {
        confirmResp = await bgGistFetch('/gists/' + encodeURIComponent(targetGistId), token, { method: 'GET' });
      } catch (_) {
        confirmResp = null;
      }
      if (!confirmResp) {
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: Date.now(),
          lastErrorCode: 'gistResultUnknown',
          account,
        }, generation);
        return bgGistWriteError('gistResultUnknown', 'Gist confirmation result unknown', { resultUnknown: true });
      }
      if (confirmResp.status === 404) {
        // The Gist is definitely gone, so a later POST cannot create a duplicate.
        await clearPendingPause('gistTargetNeedsReview');
        return bgGistWriteError('gistTargetNeedsReview', 'The pending Gist no longer exists');
      }
      if (!confirmResp.ok) {
        const confirmCode = (confirmResp.status === 401 || confirmResp.status === 403)
          ? 'gistRequestRejected'
          : 'gistCheckFailed';
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: Date.now(),
          lastErrorCode: confirmCode,
          account,
        }, generation);
        return bgGistWriteError(confirmCode, 'GitHub API ' + confirmResp.status);
      }
      let confirmJson = null;
      try { confirmJson = JSON.parse(confirmResp.text); } catch (_) { confirmJson = null; }
      const confirmed = confirmJson ? gistCore.parseGistResponse(confirmJson, pendingFileName) : null;
      if (!confirmed) {
        // The id exists but does not carry the file the pending POST was writing.
        // Keep the marker (the write may still be confirmed after a human check)
        // and report the unresolved result instead of silently re-POSTing.
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: Date.now(),
          lastErrorCode: 'gistPendingFileMissing',
          account,
        }, generation);
        return bgGistWriteError('gistPendingFileMissing', 'The pending Gist does not contain the expected file', {
          resultUnknown: true,
          gistId: targetGistId,
        });
      }
      if (confirmed.ownerId && String(confirmed.ownerId) !== String(account.id)) {
        await clearPendingPause('gistTargetNeedsReview');
        return bgGistWriteError('gistTargetNeedsReview', 'The pending Gist belongs to another account');
      }
      const verifiedAt = Date.now();
      baseline = {
        service: 'gist',
        gistId: confirmed.gistId || targetGistId,
        ownerLogin: confirmed.ownerLogin || account.login,
        ownerId: confirmed.ownerId || account.id,
        fileName: pendingFileName,
        createdAt: confirmed.createdAt || verifiedAt,
        updatedAt: confirmed.updatedAt || verifiedAt,
        verifiedAt,
      };
      const confirmedState = await bgPatchAutoBackupRemote({
        provider: 'gist',
        baseline,
        account: { login: baseline.ownerLogin, id: baseline.ownerId },
        pendingCreate: null,
        lastErrorCode: bgManualGistSuccessCode(remote),
        status: bgManualGistSuccessStatus(remote),
      }, generation);
      if (!confirmedState) {
        return bgGistWriteError('gistResultUnknown', 'Gist confirmed but the local state changed', {
          resultUnknown: true,
          gistId: baseline.gistId,
        });
      }
      action = 'patch';
      targetGistId = baseline.gistId;
    }

    if (action === 'patch') {
      const gistId = targetGistId;
      let resp = null;
      try {
        resp = await bgGistFetch('/gists/' + encodeURIComponent(gistId), token, {
          method: 'PATCH',
          body: JSON.stringify(gistCore.buildGistUpdateBody(fileName, content)),
        });
      } catch (e) {
        resp = null;
      }
      if (!resp) {
        // The server may have committed the PATCH. Do not claim success, do not
        // retry automatically, and leave the trusted baseline untouched.
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: Date.now(),
          lastErrorCode: 'gistResultUnknown',
          account,
        }, generation);
        return bgGistWriteError('gistResultUnknown', 'Gist update result unknown', { resultUnknown: true });
      }
      if (resp.status >= 200 && resp.status < 300) {
        let json = null;
        try { json = JSON.parse(resp.text); } catch (_) { json = null; }
        const parsed = json ? gistCore.parseGistResponse(json, fileName) : null;
        const verifiedAt = Date.now();
        if (parsed) {
          const nextBaseline = {
            service: 'gist',
            gistId: parsed.gistId || gistId,
            ownerLogin: parsed.ownerLogin || (baseline && baseline.ownerLogin) || account.login,
            ownerId: parsed.ownerId || (baseline && baseline.ownerId) || account.id,
            fileName,
            createdAt: parsed.createdAt || (baseline && baseline.createdAt) || verifiedAt,
            updatedAt: parsed.updatedAt || verifiedAt,
            verifiedAt,
          };
          await bgPatchAutoBackupRemote({
            provider: 'gist',
            baseline: nextBaseline,
            account: nextBaseline.ownerId
              ? { login: nextBaseline.ownerLogin, id: nextBaseline.ownerId }
              : (remote.account || null),
            // A manual write is not an unattended success: keep the automatic
            // result and its reason exactly as they were.
            lastErrorCode: bgManualGistSuccessCode(remote),
            status: bgManualGistSuccessStatus(remote),
          }, generation);
        }
        return { success: true, gistId: parsed ? parsed.gistId : gistId, created: false };
      }
      const failure = gistCore.classifyGistFailure(resp.status);
      const code = resp.status === 404 ? 'gistTargetNeedsReview' : failure.reasonCode;
      if (failure.kind === 'unknown') {
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: Date.now(),
          lastErrorCode: code,
          account,
        }, generation);
      } else {
        await bgPatchAutoBackupRemote({
          provider: 'gist',
          status: 'paused',
          lastAttemptAt: Date.now(),
          lastErrorCode: code,
          account,
        }, generation);
      }
      return bgGistWriteError(code, 'GitHub API ' + resp.status, failure.kind === 'unknown' ? { resultUnknown: true } : undefined);
    }

    // POST: the same durable pending marker as the unattended path, so a lost
    // response or a worker shutdown cannot turn into a second Gist.
    const listResult = await bgGistListOwnGists(token);
    if (!listResult.ok) {
      await bgPatchAutoBackupRemote({
        provider: 'gist',
        status: 'paused',
        lastAttemptAt: Date.now(),
        lastErrorCode: listResult.reasonCode || 'gistCheckFailed',
        account,
      }, generation);
      return bgGistWriteError(listResult.reasonCode || 'gistCheckFailed', 'Gist list check failed');
    }
    const conflict = gistCore.findGistWithFile(listResult.gists, fileName);
    if (conflict) {
      return bgGistWriteError('gistUnknownExisting', 'A Gist with this file name already exists');
    }

    const startedAt = Date.now();
    const pendingCreate = {
      provider: 'gist',
      fileName,
      description: gistCore.GIST_CREATE_DESCRIPTION,
      startedAt,
      accountLogin: account.login,
      accountId: account.id,
      gistId: '',
    };
    const markerState = await bgPatchAutoBackupRemote({
      provider: 'gist',
      status: 'running',
      lastAttemptAt: startedAt,
      lastSuccessAt: Number(remote.lastSuccessAt) || 0,
      lastErrorCode: null,
      pendingCreate,
    }, generation);
    if (!markerState) {
      return bgGistWriteError('gistResultUnknown', 'Auto-backup state changed before the Gist POST', { resultUnknown: true });
    }

    let resp = null;
    try {
      resp = await bgGistFetch('/gists', token, {
        method: 'POST',
        body: JSON.stringify(gistCore.buildGistCreateBody(fileName, content)),
      });
    } catch (e) {
      resp = null;
    }
    if (!resp) {
      await bgPatchAutoBackupRemote({
        provider: 'gist',
        status: 'unknown',
        lastAttemptAt: startedAt,
        lastSuccessAt: Number(remote.lastSuccessAt) || 0,
        lastErrorCode: 'gistResultUnknown',
        pendingCreate,
      }, generation);
      return bgGistWriteError('gistResultUnknown', 'Gist create result unknown', { resultUnknown: true });
    }
    if (resp.status === 201) {
      let json = null;
      try { json = JSON.parse(resp.text); } catch (_) { json = null; }
      const parsed = json ? gistCore.parseGistResponse(json, fileName) : null;
      if (parsed) {
        const verifiedAt = Date.now();
        const nextBaseline = {
          service: 'gist',
          gistId: parsed.gistId,
          ownerLogin: parsed.ownerLogin,
          ownerId: parsed.ownerId,
          fileName,
          createdAt: parsed.createdAt || verifiedAt,
          updatedAt: parsed.updatedAt || verifiedAt,
          verifiedAt,
        };
        const next = await bgPatchAutoBackupRemote({
          provider: 'gist',
          baseline: nextBaseline,
          account: nextBaseline.ownerId
            ? { login: nextBaseline.ownerLogin, id: nextBaseline.ownerId }
            : (remote.account || null),
          pendingCreate: null,
          // Manual create, not an unattended success: keep the automatic result
          // and its reason, and only clear the running marker.
          lastErrorCode: bgManualGistSuccessCode(remote),
          status: bgManualGistSuccessStatus(remote),
        }, generation);
        if (!next) {
          return bgGistWriteError('gistResultUnknown', 'Gist created but the local state was reset', {
            resultUnknown: true,
            gistId: parsed.gistId,
          });
        }
        return { success: true, gistId: parsed.gistId, created: true };
      }
      const knownId = json ? gistCore.normalizeGistId(json.id) : '';
      await bgPatchAutoBackupRemote({
        provider: 'gist',
        status: 'unknown',
        lastAttemptAt: startedAt,
        lastErrorCode: 'gistResultUnknown',
        pendingCreate: { ...pendingCreate, gistId: knownId },
      }, generation);
      return bgGistWriteError('gistResultUnknown', 'Gist create response incomplete', {
        resultUnknown: true,
        gistId: knownId,
      });
    }

    const failure = gistCore.classifyGistFailure(resp.status);
    if (failure.kind === 'unknown') {
      await bgPatchAutoBackupRemote({
        provider: 'gist',
        status: 'unknown',
        lastAttemptAt: startedAt,
        lastErrorCode: failure.reasonCode,
        pendingCreate,
      }, generation);
      return bgGistWriteError(failure.reasonCode, 'GitHub API ' + resp.status, { resultUnknown: true });
    }
    // GitHub said no object was created; clear the marker so the next attempt is
    // not blocked by an outcome that is already known.
    await bgPatchAutoBackupRemote({
      provider: 'gist',
      status: 'paused',
      lastAttemptAt: startedAt,
      lastErrorCode: failure.reasonCode,
      pendingCreate: null,
    }, generation);
    return bgGistWriteError(failure.reasonCode, 'GitHub API ' + resp.status);
  }

  // The dispatch path and tests use this wrapper so every manual write is queued
  // exactly once (writeManualGistBackup itself must stay callable inside the queue).
  function enqueueManualGistWrite(msg) {
    return enqueueBgAutoBackup(() => writeManualGistBackup(msg));
  }

  // Ticket #130: one place that decides whether the next run is an extra attempt.
  // Only the three transient codes count, only for the same target, and the counter
  // restarts when the target changes or a normal cycle succeeds.
  function bgNextRetryPlan(core, prevRetry, remote, finishedAt, target, retryAfterMs) {
    const empty = core.defaultAutoBackupRetryState();
    if (!remote || !remote.lastErrorCode) return empty;
    if (!core.AUTO_BACKUP_TRANSIENT_REASONS.includes(remote.lastErrorCode)) return empty;
    const prev = core.normalizeAutoBackupRetryState(prevRetry);
    const used = (prev.code && prev.target === target) ? prev.attempt : 0;
    return core.computeAutoBackupRetryPlan({
      attempt: used,
      failureAt: finishedAt,
      retryAfterMs: Math.max(0, Number(retryAfterMs) || 0),
      code: remote.lastErrorCode,
      target: target || '',
    });
  }

  // The extra attempt gets its own one-shot alarm; the user's normal period keeps
  // its own alarm untouched so a retry never looks like a new frequency setting.
  async function bgSyncRetryAlarm(retry, nowMs) {
    await bgAlarmsClear(BG_AUTO_BACKUP_RETRY_ALARM_NAME);
    const plan = retry || {};
    if (!plan.code || !plan.nextAt) return;
    const now = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now();
    const delayInMinutes = Math.max(1, Math.ceil((plan.nextAt - now) / 60000));
    await bgAlarmsCreate(BG_AUTO_BACKUP_RETRY_ALARM_NAME, { delayInMinutes });
  }

  function bgAutoBackupRetryTargetKey(provider, settings) {
    if (!settings) return '';
    if (provider === 'webdav') {
      const derived = bgResolveWebDAVFileUrl(settings);
      if (derived.error) return '';
      const user = typeof settings.webdavUser === 'string' ? settings.webdavUser.trim() : '';
      return bgWebDAVSuccessTarget(derived.fileUrl, user);
    }
    if (provider === 'gist') {
      return 'gist|' + String(settings.gistId || 'new') + '|' + String(settings.syncFileName || '');
    }
    return '';
  }

  // Ticket #130: switching off while a real request is in flight must not erase what
  // the server actually answered. Only a run that really attempted a write reaches
  // here, and only while auto-backup is still off and the target generation matches.
  //
  // A manual write may have advanced the trusted WebDAV version in the meantime (it
  // does not bump the generation), so the newer baseline always wins; the automatic
  // result still updates the status, the attempt time and the success time.
  function bgMergeStoppedRemoteResult(fresh, settledRemote, baselineStartVersion) {
    const freshBaseline = bgBaselineForProvider(fresh.remote, 'webdav');
    const freshVersion = freshBaseline ? (freshBaseline.version || freshBaseline.etag) : null;
    if (freshVersion && (!baselineStartVersion || freshVersion !== baselineStartVersion)) {
      return {
        ...fresh.remote,
        status: settledRemote.status,
        lastAttemptAt: settledRemote.lastAttemptAt,
        lastErrorCode: settledRemote.lastErrorCode,
        lastSuccessAt: Math.max(
          Number(fresh.remote && fresh.remote.lastSuccessAt) || 0,
          Number(settledRemote.lastSuccessAt) || 0,
        ),
        notBeforeAt: settledRemote.notBeforeAt,
      };
    }
    return settledRemote;
  }

  async function bgCommitStoppedAutoBackupResult(core, remoteOutcome, remoteState, finishedAt, baselineStartVersion) {
    if (!remoteOutcome || !remoteOutcome.attempted || !remoteState) return null;
    const retryFloorMs = Number(remoteOutcome.retryAfterMs) || 0;
    const settledRemote = {
      ...remoteState,
      notBeforeAt: retryFloorMs > 0 ? finishedAt + retryFloorMs : 0,
    };
    return enqueueBgStateMutation(async () => {
      const fresh = await bgReadAutoBackupState();
      if (core.isAutoBackupActive(fresh)) return null;
      const sameGeneration = (Number(remoteState.generation) || 0) ===
        (Number(fresh.remote && fresh.remote.generation) || 0);
      if (!sameGeneration) return null;
      return bgWriteAutoBackupState({
        ...fresh,
        updatedAt: finishedAt,
        remote: bgMergeStoppedRemoteResult(fresh, settledRemote, baselineStartVersion),
        retry: core.defaultAutoBackupRetryState(),
        lock: null,
      });
    });
  }

  async function runBackgroundLocalAutoBackup(opts) {
    const options = opts || {};
    const trigger = String(options.trigger || 'alarm');
    const forceImmediate = Boolean(options.forceImmediate);
    const expectedEpoch = options.expectedEpoch;

    if (bgAutoBackupInFlightPromise && !forceImmediate) {
      return bgAutoBackupInFlightPromise;
    }

    const work = enqueueBgAutoBackup(async () => {
      const core = await ensureSnapshotCore();
      const now = Date.now();
      let state = await bgReadAutoBackupState();
      // Ticket #127: capture the remote version before reading the local layout.
      // A manual sync that finishes after this point must win over the older layout
      // this run is about to snapshot.
      const baselineVersionAtStart = state.remote && state.remote.baseline
        ? (state.remote.baseline.version || state.remote.baseline.etag)
        : null;

      if (!core.isAutoBackupActive(state)) {
        await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
        return { ok: false, skipped: true, reason: 'inactive', state };
      }
      if (expectedEpoch !== undefined && state.epoch !== expectedEpoch) {
        return { ok: false, cancelled: true, reason: 'epoch-changed', state };
      }
      // Ticket #130: the server's Retry-After floor applies to every trigger, including
      // the user's normal alarm, so nothing calls it earlier than it allowed.
      const serverNotBefore = Number(state.remote && state.remote.notBeforeAt) || 0;
      if (!forceImmediate && serverNotBefore > now) {
        await bgSyncRetryAlarm(state.retry, now);
        return { ok: false, skipped: true, reason: 'server-wait', state };
      }
      const isInterruptedRecovery = Boolean(
        state.local &&
        state.local.status === 'running' &&
        (!state.lock || state.lock.expiresAt <= now)
      );
      if (!forceImmediate) {
        // Dedup across startup/ensure bursts: catch-up / ensure runs when overdue or recovering an interrupted run.
        // An explicit alarm event is itself the browser's due signal (and keeps tests able to fire it directly).
        // Ticket #130: an extra attempt lands between two normal cycles, so "due"
        // means the retry time OR the normal schedule has arrived.
        const retryDue = core.isAutoBackupRetryDue(state, now);
        const normalDue = !state.nextScheduledAt || now >= state.nextScheduledAt;
        if (trigger === 'retry' && !retryDue) {
          // The one-shot alarm fired early (or a restart lost it). Put the same planned
          // time back on the schedule instead of swallowing the extra attempt.
          await bgSyncRetryAlarm(state.retry, now);
          return { ok: false, skipped: true, reason: 'retry-not-due', state };
        }
        if (trigger !== 'alarm' && !isInterruptedRecovery && !retryDue && !normalDue) {
          return { ok: false, skipped: true, reason: 'not-due-yet', state };
        }
        // Durable lease lock against overlapping wakeups.
        if (state.lock && state.lock.expiresAt > now && state.lock.ownerId !== BG_WORKER_OWNER_ID) {
          // The lock holder finishes the run and reschedules; if it died, the lease
          // expires. Keep this pipeline alive either way.
          await bgSyncRetryAlarm(state.retry, now);
          return { ok: false, skipped: true, reason: 'locked', state };
        }
      }

      const activeEpoch = state.epoch;
      const prevLocal = state.local || core.defaultAutoBackupState().local;
      // Do NOT advance nextScheduledAt until the snapshot settles; an interrupted SW wakeup must retry.
      const claimedState = await enqueueBgStateMutation(async () => {
        const fresh = await bgReadAutoBackupState();
        if (!core.isAutoBackupActive(fresh) || fresh.epoch !== activeEpoch) return null;
        return bgWriteAutoBackupState({
          ...fresh,
          updatedAt: now,
          local: {
            ...(fresh.local || prevLocal),
            status: 'running',
            lastAttemptAt: now,
          },
          lock: {
            ownerId: BG_WORKER_OWNER_ID,
            epoch: activeEpoch,
            acquiredAt: now,
            expiresAt: now + core.AUTO_BACKUP_LOCK_TTL_MS,
          },
        });
      });
      if (!claimedState) {
        return { ok: false, cancelled: true, reason: 'cancelled-before-claim', state: await bgReadAutoBackupState() };
      }

      let snapOutcome = null;
      let errMessage = null;
      let rawLayout = null;
      try {
        const storedLayout = await bgStorageGet({ boxingLayout: null });
        rawLayout = storedLayout && storedLayout.boxingLayout;
        if (!swIsPlausibleLayout(rawLayout)) {
          rawLayout = null; // never build a cloud body from an invalid layout
          throw new Error('boxingLayout is missing or invalid for local auto-backup');
        }

        // Re-check cancellation before writing snapshot body/index.
        const beforeWriteState = await bgReadAutoBackupState();
        if (!core.isAutoBackupActive(beforeWriteState) || beforeWriteState.epoch !== activeEpoch) {
          await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
          return { ok: false, cancelled: true, reason: 'cancelled-before-write', state: beforeWriteState };
        }

        snapOutcome = await enqueueBgSnapshotOp(() => core.saveSnapshotWithAdapter(bgSnapStorage, rawLayout, {
          reason: 'auto-backup',
          sanitizeLayout: swSanitizeLayoutForBackup,
          now: Date.now(),
          log: bgLog,
          errorLog: bgErr,
          returnDetails: true,
        }));
        if (!snapOutcome || !snapOutcome.ok) {
          throw new Error((snapOutcome && snapOutcome.error) || 'Failed to save local snapshot');
        }
      } catch (e) {
        errMessage = bgRedactSensitiveText(e && e.message ? e.message : String(e || 'Auto-backup failed')).slice(0, 240);
        bgErr('Background local auto-backup failed (' + trigger + '):', errMessage);
      }

      let latestState = await bgReadAutoBackupState();
      if (!core.isAutoBackupActive(latestState) || latestState.epoch !== activeEpoch) {
        // User turned off or changed configuration mid-flight: preserve disabled/new state.
        if (!core.isAutoBackupActive(latestState)) {
          await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
        }
        return {
          ok: Boolean(snapOutcome && snapOutcome.ok),
          cancelled: !core.isAutoBackupActive(latestState),
          state: latestState,
        };
      }

      // Ticket #125: the cloud (WebDAV) first-create attempt runs only after the local
      // snapshot settled, and its result stays independent from the local result.
      let remoteOutcome = null;
      const remoteProvider = rawLayout && rawLayout.settings ? rawLayout.settings.syncProvider : '';
      if (rawLayout) {
        try {
          if (remoteProvider === 'webdav') {
            remoteOutcome = await runBackgroundWebDAVAutoBackup({
              state: latestState,
              layout: rawLayout,
              epoch: activeEpoch,
              trigger,
              expectedBaselineVersion: baselineVersionAtStart,
            });
          } else if (remoteProvider === 'gist') {
            remoteOutcome = await runBackgroundGistAutoBackup({
              state: latestState,
              layout: rawLayout,
              epoch: activeEpoch,
              trigger,
            });
          }
        } catch (e) {
          bgErr('Background ' + (remoteProvider || 'remote') + ' auto-backup failed (' + trigger + '):', e);
          // A result write may have failed after the pending marker was saved. Re-read
          // so the marker is never replaced by the pre-request snapshot.
          let recovery = null;
          try { recovery = await bgReadAutoBackupState(); } catch (_) { recovery = null; }
          remoteOutcome = {
            attempted: true,
            remote: recovery
              ? {
                  ...recovery.remote,
                  status: 'error',
                  lastAttemptAt: Date.now(),
                  lastErrorCode: 'internal-error',
                }
              : null,
          };
        }
      }
      latestState = await bgReadAutoBackupState();
      let remoteState = (remoteOutcome && remoteOutcome.remote) || latestState.remote;
      const baselineStartVersion = remoteOutcome && Object.prototype.hasOwnProperty.call(remoteOutcome, 'baselineBefore')
        ? (remoteOutcome.baselineBefore
            ? (remoteOutcome.baselineBefore.version || remoteOutcome.baselineBefore.etag)
            : null)
        : baselineVersionAtStart;
      if (remoteProvider === 'gist') {
        const outcomeGeneration = Number(remoteState && remoteState.generation) || 0;
        const currentGeneration = Number(latestState.remote && latestState.remote.generation) || 0;
        if (outcomeGeneration !== currentGeneration) {
          // A credential reset won the race; never write the stale Gist outcome back.
          remoteState = latestState.remote;
        }
      }
      const finishedAt = Date.now();
      const remoteTargetKey = bgAutoBackupRetryTargetKey(
        remoteProvider,
        rawLayout && rawLayout.settings ? rawLayout.settings : null,
      );
      // Only a real attempt can consume one of the three extra tries. A skipped,
      // cancelled or paused run must not inflate the counter.
      const countsAsAttempt = Boolean(
        remoteOutcome && remoteOutcome.attempted && !remoteOutcome.cancelled && !remoteOutcome.skipped
      );
      const nextRetryPlan = countsAsAttempt
        ? bgNextRetryPlan(
            core,
            latestState.retry,
            remoteState,
            finishedAt,
            remoteTargetKey,
            remoteOutcome.retryAfterMs,
          )
        : core.defaultAutoBackupRetryState();
      // The stopped branch below records the same real result as the helper above.
      const stoppedRetryFloorMs = Number(remoteOutcome && remoteOutcome.retryAfterMs) || 0;
      const stoppedRemoteState = remoteState
        ? { ...remoteState, notBeforeAt: stoppedRetryFloorMs > 0 ? finishedAt + stoppedRetryFloorMs : 0 }
        : remoteState;

      // The user may have disabled or reconfigured auto-backup while the remote create
      // was in flight. A changed epoch means the saved configuration may point at a
      // different target, so the old outcome is not merged into it — except for a
      // confirmed create whose target still matches, which must keep its baseline.
      if (latestState.epoch !== activeEpoch) {
        const createdTarget = remoteState && bgBaselineForProvider(remoteState, 'webdav');
        if (createdTarget) {
          try {
            const current = await bgStorageGet({ boxingLayout: null });
            const currentSettings = current && current.boxingLayout && current.boxingLayout.settings;
            const currentDerived = bgResolveWebDAVFileUrl(currentSettings || {});
            const currentUser = currentSettings && typeof currentSettings.webdavUser === 'string'
              ? currentSettings.webdavUser.trim()
              : '';
            if (!currentDerived.error &&
                currentSettings && currentSettings.syncProvider === 'webdav' &&
                currentDerived.fileUrl === createdTarget.fileUrl &&
                currentUser === createdTarget.account) {
              // Compare-and-set: a concurrent configuration write must win over the
              // older snapshot this run read before the network call.
              const merged = await enqueueBgStateMutation(async () => {
                const beforeMerge = await bgReadAutoBackupState();
                if (beforeMerge.epoch !== latestState.epoch) return null;
                const beforeBaseline = bgBaselineForProvider(beforeMerge.remote, 'webdav');
                const beforeVersion = beforeBaseline
                  ? (beforeBaseline.version || beforeBaseline.etag)
                  : null;
                let mergedRemote = remoteState;
                if (beforeVersion && (!baselineStartVersion || beforeVersion !== baselineStartVersion)) {
                  mergedRemote = {
                    ...beforeMerge.remote,
                    lastSuccessAt: Math.max(
                      Number(beforeMerge.remote && beforeMerge.remote.lastSuccessAt) || 0,
                      Number(remoteState && remoteState.lastSuccessAt) || 0,
                    ),
                  };
                }
                return bgWriteAutoBackupState({
                  ...beforeMerge,
                  updatedAt: finishedAt,
                  remote: mergedRemote,
                  lock: null,
                });
              });
              if (!merged) {
                const cancelledState = await bgReadAutoBackupState();
                return {
                  ok: Boolean(snapOutcome && snapOutcome.ok),
                  cancelled: true,
                  state: cancelledState,
                };
              }
              if (!core.isAutoBackupActive(merged)) {
                await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
              }
              return {
                ok: Boolean(snapOutcome && snapOutcome.ok),
                cancelled: true,
                state: merged,
                remote: merged.remote,
              };
            }
          } catch (_) { /* unknown current target: drop the stale outcome */ }
        }
        // Ticket #130: a run that really talked to the server keeps its honest result
        // even though the switch went off mid-flight: confirmed success, a definite
        // miss and an unknown outcome all stay visible instead of snapping back to idle.
        if (!core.isAutoBackupActive(latestState)) {
          const recorded = await bgCommitStoppedAutoBackupResult(core, remoteOutcome, remoteState, finishedAt, baselineStartVersion);
          if (recorded) {
            await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
            await bgAlarmsClear(BG_AUTO_BACKUP_RETRY_ALARM_NAME);
            return {
              ok: Boolean(snapOutcome && snapOutcome.ok),
              cancelled: true,
              state: recorded,
              remote: recorded.remote,
            };
          }
        }
        if (!core.isAutoBackupActive(latestState)) {
          await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
        }
        return {
          ok: Boolean(snapOutcome && snapOutcome.ok),
          cancelled: true,
          state: latestState,
        };
      }
      if (!core.isAutoBackupActive(latestState)) {
        await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
        return {
          ok: Boolean(snapOutcome && snapOutcome.ok),
          cancelled: true,
          state: latestState,
        };
      }

      const settledIntervalMs = latestState.intervalSec * 1000;
      const localResult = (snapOutcome && snapOutcome.ok)
        ? {
            status: 'ok',
            lastAttemptAt: claimedState.local.lastAttemptAt,
            lastSuccessAt: snapOutcome.ts,
            lastSnapshotTs: snapOutcome.ts,
            lastError: null,
          }
        : {
            // Failure: NEVER update lastSuccessAt or lastSnapshotTs.
            status: 'error',
            lastAttemptAt: claimedState.local.lastAttemptAt,
            lastSuccessAt: prevLocal.lastSuccessAt || 0,
            lastSnapshotTs: prevLocal.lastSnapshotTs || 0,
            lastError: errMessage || 'Failed to save local snapshot',
          };
      // Serialize this result with manual-write notes and re-read inside the
      // mutation. Ticket #127: a manual PUT can commit a newer remote version
      // after this run read the target but before the result is saved; never move
      // the trusted baseline backwards, and keep the newest success time.
      const committed = await enqueueBgStateMutation(async () => {
        const fresh = await bgReadAutoBackupState();
        if (fresh.epoch !== activeEpoch) {
          // Ticket #130: turning auto-backup off is not a reason to erase what really
          // happened on the server. A confirmed success, a definite miss and an
          // unknown result each stay on record while the switch and schedule stay off.
          const stopped = !core.isAutoBackupActive(fresh);
          const sameGeneration = (Number(remoteState && remoteState.generation) || 0) ===
            (Number(fresh.remote && fresh.remote.generation) || 0);
          if (stopped && remoteOutcome && remoteOutcome.attempted && remoteState && sameGeneration) {
            return bgWriteAutoBackupState({
              ...fresh,
              updatedAt: finishedAt,
              remote: bgMergeStoppedRemoteResult(fresh, stoppedRemoteState, baselineStartVersion),
              retry: core.defaultAutoBackupRetryState(),
              lock: null,
            });
          }
          return null;
        }
        let finalRemote = remoteState;
        const freshBaseline = bgBaselineForProvider(fresh.remote, 'webdav');
        const freshVersion = freshBaseline
          ? (freshBaseline.version || freshBaseline.etag)
          : null;
        if (freshVersion && (!baselineStartVersion || freshVersion !== baselineStartVersion)) {
          finalRemote = {
            ...fresh.remote,
            lastSuccessAt: Math.max(
              Number(fresh.remote && fresh.remote.lastSuccessAt) || 0,
              Number(remoteState && remoteState.lastSuccessAt) || 0,
            ),
          };
        }
        // Ticket #130: remember the server's own floor on the result itself, so the next
        // ordinary alarm cannot fire a request before it.
        const retryFloorMs = Number(remoteOutcome && remoteOutcome.retryAfterMs) || 0;
        finalRemote = {
          ...finalRemote,
          notBeforeAt: retryFloorMs > 0 ? finishedAt + retryFloorMs : 0,
        };
        return bgWriteAutoBackupState({
          ...fresh,
          nextScheduledAt: Math.max(
            finishedAt + settledIntervalMs,
            // Ticket #130: a server Retry-After that runs past the chosen interval still
            // wins, so the next normal cycle is never earlier than the server allows.
            finishedAt + (Number(remoteOutcome && remoteOutcome.retryAfterMs) || 0),
          ),
          updatedAt: finishedAt,
          local: localResult,
          remote: finalRemote,
          // Ticket #130: the bounded retry plan lives beside the normal schedule and
          // survives a worker restart, so the attempt counter never resets silently.
          retry: nextRetryPlan,
          lock: null,
        });
      });
      if (!committed) {
        const cancelledState = await bgReadAutoBackupState();
        return { ok: Boolean(snapOutcome && snapOutcome.ok), cancelled: true, state: cancelledState };
      }
      // Ticket #130: the off switch may have landed between the commit and these calls.
      // Re-read once so a stopped run neither lights the badge nor schedules a retry.
      const settledState = await bgReadAutoBackupState();
      if (!core.isAutoBackupActive(settledState)) {
        await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
        await bgAlarmsClear(BG_AUTO_BACKUP_RETRY_ALARM_NAME);
        return { ok: Boolean(snapOutcome && snapOutcome.ok), cancelled: true, state: settledState };
      }
      await bgSyncRetryAlarm(settledState.retry, finishedAt);
      await setAutoBackupBadge(bgAutoBackupNeedsAttention(settledState.local, settledState.remote));
      if (snapOutcome && snapOutcome.ok) {
        bgLog('Background local auto-backup saved ts=' + snapOutcome.ts + ' trigger=' + trigger);
        return { ok: true, ts: snapOutcome.ts, state: committed, remote: committed.remote };
      }
      return { ok: false, error: committed.local.lastError, state: committed, remote: committed.remote };
    });

    if (!forceImmediate) {
      const wrapped = work.finally(() => {
        if (bgAutoBackupInFlightPromise === wrapped) bgAutoBackupInFlightPromise = null;
      });
      bgAutoBackupInFlightPromise = wrapped;
      return wrapped;
    }
    return work;
  }

  async function reconcileAutoBackupSchedule(opts) {
    const options = opts || {};
    const trigger = String(options.trigger || 'reconcile');
    const runCatchup = options.runCatchup !== false;
    const core = await ensureSnapshotCore();
    const state = await bgReadAutoBackupState();

    if (!core.isAutoBackupActive(state)) {
      await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
      await bgAlarmsClear(BG_AUTO_BACKUP_RETRY_ALARM_NAME);
      return { ok: true, active: false, state };
    }

    // Ticket #129: the toolbar badge does not survive a browser restart, so a pending
    // local/cloud problem must be restored from the persisted state on startup/install
    // instead of waiting for the next alarm.
    await setAutoBackupBadge(bgAutoBackupNeedsAttention(state.local, state.remote));

    const now = Date.now();
    const periodInMinutes = Math.max(1, Math.ceil(state.intervalSec / 60));
    // Ticket #130: the retry alarm is rebuilt from the persisted plan, so a worker
    // restart (or a lost alarm) resumes the same bounded attempt instead of forgetting it.
    await bgSyncRetryAlarm(state.retry, now);
    const existingAlarm = await bgAlarmsGet(BG_AUTO_BACKUP_ALARM_NAME);
    if (!existingAlarm || Number(existingAlarm.periodInMinutes) !== periodInMinutes) {
      const delayInMinutes = core.computeAlarmDelayMinutes(state, now);
      await bgAlarmsCreate(BG_AUTO_BACKUP_ALARM_NAME, { delayInMinutes, periodInMinutes });
    }

    if (runCatchup && core.isAutoBackupOverdue(state, now)) {
      const res = await runBackgroundLocalAutoBackup({
        trigger,
        expectedEpoch: state.epoch,
      });
      return { ok: res.ok, active: true, catchupRan: true, result: res, state: res.state };
    }
    return { ok: true, active: true, catchupRan: false, state };
  }

  // Ticket #130 (spec #120 D6): the user's off switch is immediate. It never waits
  // behind a running backup: abort what is on the wire, clear both alarms, then bump
  // the epoch so every later write step sees the stop. The settings page does not
  // wait for the interrupted flow to finish.
  async function stopBackgroundAutoBackup(deps) {
    const core = (deps && deps.core) || await ensureSnapshotCore();
    // Set the in-memory stop first: a task that already passed its last state check is
    // then unable to register a new request, even before the epoch reaches storage.
    bgAutoBackupStopping = true;
    bgCancelInFlightAutoBackupRequests();
    await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
    await bgAlarmsClear(BG_AUTO_BACKUP_RETRY_ALARM_NAME);
    await setAutoBackupBadge(false);
    const now = Date.now();
    const disabledState = await enqueueBgStateMutation(async () => {
      const fresh = await bgReadAutoBackupState();
      const freshLocal = fresh.local || core.defaultAutoBackupState().local;
      return bgWriteAutoBackupState({
        ...fresh,
        version: 1,
        optIn: false,
        intervalSec: 0,
        epoch: (fresh.epoch || 0) + 1,
        nextScheduledAt: 0,
        updatedAt: now,
        local: {
          ...freshLocal,
          // A real snapshot keeps its success time; the run itself records whether the
          // cloud side was confirmed, definitely not sent, or left unknown. An explicit
          // stop is always a cancellation, even before any success existed.
          status: (fresh.optIn === true || freshLocal.lastSuccessAt > 0 || freshLocal.lastError)
            ? 'cancelled'
            : 'idle',
        },
        // Cloud success/pause history is not erased by turning auto-backup off.
        remote: fresh.remote,
        retry: core.defaultAutoBackupRetryState(),
        lock: null,
      });
    });
    return { ok: true, state: disabledState };
  }

  async function configureBackgroundAutoBackup(opts) {
    const options = opts || {};
    const core = await ensureSnapshotCore();
    const intervalSec = core.normalizeAutoBackupInterval(options.intervalSec);
    const optIn = Boolean(options.optIn) && intervalSec >= core.MIN_AUTO_BACKUP_INTERVAL_SEC;
    const mySeq = ++bgAutoBackupConfigSeq;

    // The stop path is deliberately outside the backup queue, so a long upload can
    // never delay it; see stopBackgroundAutoBackup above.
    if (!optIn) return stopBackgroundAutoBackup({ core });

    return enqueueBgAutoBackup(async () => {
      // A later configure call (usually the user switching off) has already won. Writing
      // optIn back on now would silently undo the user's last choice.
      if (mySeq !== bgAutoBackupConfigSeq) {
        return { ok: false, stale: true, state: await bgReadAutoBackupState() };
      }
      const prev = await bgReadAutoBackupState();
      const now = Date.now();
      const nextEpoch = (prev.epoch || 0) + 1;
      const prevLocal = prev.local || core.defaultAutoBackupState().local;

      const periodInMinutes = Math.max(1, Math.ceil(intervalSec / 60));
      const enabledState = await enqueueBgStateMutation(async () => {
        const fresh = await bgReadAutoBackupState();
        const freshLocal = fresh.local || prevLocal;
        const freshRemote = fresh.remote || prev.remote;
        return bgWriteAutoBackupState({
          ...fresh,
          version: 1,
          optIn: true,
          intervalSec,
          epoch: nextEpoch,
          nextScheduledAt: 0,
          updatedAt: now,
          local: {
            ...freshLocal,
            status: 'running',
            lastError: null,
          },
          // Ticket #125: an explicit user re-enable/reconfigure is the acknowledgement
          // that releases a held pause or unknown outcome; the next attempt re-checks the
          // remote file before writing anything.
          remote: freshRemote ? {
            ...freshRemote,
            status: (freshRemote.status === 'unknown' || freshRemote.status === 'paused') ? 'idle' : freshRemote.status,
            lastErrorCode: (freshRemote.status === 'unknown' || freshRemote.status === 'paused') ? null : freshRemote.lastErrorCode,
          } : undefined,
          // A fresh enable/reconfigure starts a new bounded retry run.
          retry: core.defaultAutoBackupRetryState(),
          lock: null,
        });
      });
      await bgAlarmsCreate(BG_AUTO_BACKUP_ALARM_NAME, {
        delayInMinutes: periodInMinutes,
        periodInMinutes,
      });
      // An explicit enable is the user saying "go": clear the in-memory stop so the
      // immediate run below can register its requests.
      bgAutoBackupStopping = false;
      return { ok: true, state: enabledState, shouldRunImmediate: true, epoch: nextEpoch };
    }).then(async (cfgResult) => {
      if (cfgResult && cfgResult.stale) return cfgResult;
      if (cfgResult && cfgResult.shouldRunImmediate) {
        if (mySeq !== bgAutoBackupConfigSeq) {
          return { ok: false, stale: true, state: cfgResult.state };
        }
        const execRes = await runBackgroundLocalAutoBackup({
          trigger: 'opt-in-immediate',
          expectedEpoch: cfgResult.epoch,
          forceImmediate: true,
        });
        return {
          ok: Boolean(execRes && execRes.ok),
          error: execRes && execRes.error ? execRes.error : undefined,
          state: (execRes && execRes.state) || cfgResult.state,
        };
      }
      return cfgResult;
    });
  }

  async function inspectAndRecordBackgroundWebDAVPermission() {
    try {
      if (!api.storage || !api.storage.local || !api.storage.local.get) return;
      const stored = await bgStorageGet({ boxingLayout: null, [BG_WEBDAV_PERM_KEY]: null });
      const settings = stored && stored.boxingLayout && stored.boxingLayout.settings;
      if (!settings || settings.syncProvider !== 'webdav') return null;
      const url = typeof settings.webdavUrl === 'string' ? settings.webdavUrl.trim() : '';
      if (!url || !isSafeWebDAVUrl(url, settings.webdavAllowPrivateHost === true)) return null;
      const perm = await ensureWebDAVPermission(url);
      if (!perm.ok && perm.needPermission && perm.origin) {
        return await bgRecordWebDAVPendingPermission(perm.origin, 'missing-permission');
      } else if (perm.ok && stored[BG_WEBDAV_PERM_KEY] && stored[BG_WEBDAV_PERM_KEY].origin === perm.origin) {
        if (api.storage.local.remove) {
          await bgStorageRemoveValidated(BG_WEBDAV_PERM_KEY);
        }
      }
      return null;
    } catch (e) {
      bgErr('inspectAndRecordBackgroundWebDAVPermission error', e);
      return null;
    }
  }

  if (api.alarms && api.alarms.onAlarm && typeof api.alarms.onAlarm.addListener === 'function') {
    api.alarms.onAlarm.addListener((alarm) => {
      if (!alarm) return;
      // Ticket #130: the bounded extra attempt has its own one-shot alarm and must
      // never be confused with the user's normal cycle.
      if (alarm.name === BG_AUTO_BACKUP_RETRY_ALARM_NAME) {
        bgLog('Auto-backup retry alarm fired');
        runBackgroundLocalAutoBackup({ trigger: 'retry' }).catch((e) => {
          bgErr('Auto-backup retry handler error', e);
        });
        return;
      }
      if (alarm.name !== BG_AUTO_BACKUP_ALARM_NAME) return;
      bgLog('Auto-backup alarm fired');
      // Execute local snapshot directly in background (single executor, works with zero open NTP tabs).
      runBackgroundLocalAutoBackup({ trigger: 'alarm' }).catch((e) => {
        bgErr('Auto-backup alarm handler error', e);
      });
      // Ticket #123: on background alarm, inspect WebDAV permission read-only via
      // permissions.contains and persist pending state if ungranted — never prompt
      // or send a WebDAV request without permission.
      inspectAndRecordBackgroundWebDAVPermission();
      inspectAndRecordBackgroundGistPermission();
    });
  }

  if (api.runtime && api.runtime.onStartup && typeof api.runtime.onStartup.addListener === 'function') {
    api.runtime.onStartup.addListener(() => {
      reconcileAutoBackupSchedule({ trigger: 'startup-catchup', runCatchup: true }).catch((e) => {
        bgErr('onStartup auto-backup reconcile error', e);
      });
      inspectAndRecordBackgroundWebDAVPermission();
      inspectAndRecordBackgroundGistPermission();
    });
  }

  root.__boxingBgAutoBackup = {
    runBackgroundLocalAutoBackup,
    reconcileAutoBackupSchedule,
    configureBackgroundAutoBackup,
    getAutoBackupState: bgReadAutoBackupState,
    inspectAndRecordBackgroundWebDAVPermission,
    inspectAndRecordBackgroundGistPermission,
    runBackgroundWebDAVAutoBackup,
    runBackgroundGistAutoBackup,
    writeManualGistBackup,
    enqueueManualGistWrite,
    readWebDAVFileState: bgWebDAVReadFileState,
    decryptCredential: bgDecryptCredential,
    resolveWebDAVFileUrl: bgResolveWebDAVFileUrl,
    buildWebDAVBackupBody: bgBuildWebDAVBackupBody,
  };

  // ── WebDAV message proxy ────────────────────────────────────
  // The background service worker bypasses page-level CSP and CORS
  // restrictions that block cross-origin fetch from extension pages.
  // Route WebDAV test/backup through background to fix
  // "NetworkError when attempting to fetch resource" in Firefox MV3.

  // SECURITY (BX-AUD-01/02/03) — v3.7.10: harden the background WebDAV proxy against abuse.
  const BG_MAX_URL = 2048;
  const BG_MAX_BODY = 2 * 1024 * 1024; // 2 MiB; Service Worker memory-budget safe.
  // Ticket 83 (V-11): the WebDAV GET response is read with the same byte budget as
  // PUT — an oversized or hostile server response must abort instead of filling the
  // service worker's memory.
  const BG_MAX_GET_BODY = 2 * 1024 * 1024; // 2 MiB; same budget as BG_MAX_BODY.
  // BX-AUD-01: refuse hostnames that resolve to private / loopback / link-local addresses.
  const BG_PRIVATE_HOST_RE = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:|fc00:|fd00:)/i;

  // Ticket 82: the private-network refusal is an explicit opt-in, forwarded by the NTP caller
  // on every webdav-* message. Absent or non-boolean means deny - unchanged for anything not opted in.
  function isSafeWebDAVUrl(urlStr, allowPrivateHost) {
    if (typeof urlStr !== 'string' || urlStr.length > BG_MAX_URL) return false;
    let u;
    try { u = new URL(urlStr); } catch (_) { return false; }
    if (u.protocol !== 'https:') return false;          // BX-AUD-01: scheme lock
    if (u.username || u.password) return false;           // no embedded credentials
    // Ticket 90: strip the IPv6 literal brackets so "::1$" / "fe80:" / "fc00:" match
    // here exactly as they do in the NTP guard (URL.hostname keeps "[::1]").
    const host = (u.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (allowPrivateHost !== true) {
      if (BG_PRIVATE_HOST_RE.test(host)) return false;     // BX-AUD-01: private / host-only literals
      if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    }
    return true;
  }

  function guardWebDAVRequest(msg, requireBodyOK) {
    if (!msg || !isSafeWebDAVUrl(msg.url, msg.allowPrivateHost)) {
      return { success: false, error: 'blocked unsafe WebDAV url', blocked: true };
    }
    if (requireBodyOK) {
      if (typeof msg.body !== 'string' || msg.body.length > BG_MAX_BODY) {
        return { success: false, error: 'blocked oversized WebDAV body', blocked: true };
      }
    }
    return null;
  }

  // A2 / Ticket #123: Chrome MV3 keeps https://*/* in optional_host_permissions, and
  // Firefox MV3 lets users revoke host permissions at runtime. Check actual origin
  // grant status before any background WebDAV fetch and never fail open on errors.
  function getWebDAVOriginPattern(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' || !u.hostname) return '';
      return u.protocol + '//' + u.hostname + '/*';
    } catch (_) {
      return '';
    }
  }

  function checkPermissionsContains(permApi, origin) {
    return new Promise((resolve, reject) => {
      try {
        if (typeof browser !== 'undefined' && permApi === browser.permissions) {
          const ret1 = permApi.contains({ origins: [origin] });
          if (ret1 && typeof ret1.then === 'function') ret1.then((v) => resolve(Boolean(v)), reject);
          else resolve(Boolean(ret1));
          return;
        }
        let settled = false;
        const ret = permApi.contains({ origins: [origin] }, (granted) => {
          if (settled) return;
          settled = true;
          const lastErr = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError;
          if (lastErr) reject(new Error(lastErr.message));
          else resolve(Boolean(granted));
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (v) => { if (!settled) { settled = true; resolve(Boolean(v)); } },
            (e) => { if (!settled) { settled = true; reject(e); } }
          );
        }
      } catch (e) {
        try {
          const ret1 = permApi.contains({ origins: [origin] });
          if (ret1 && typeof ret1.then === 'function') ret1.then((v) => resolve(Boolean(v)), reject);
          else resolve(Boolean(ret1));
        } catch (e2) {
          reject(e2);
        }
      }
    });
  }

  async function ensureOriginPermission(origin) {
    if (!origin) return { ok: false, needPermission: false, origin: '', error: 'invalid origin' };
    try {
      const apiNs = typeof browser !== 'undefined' ? browser : chrome;
      if (!apiNs || !apiNs.permissions || typeof apiNs.permissions.contains !== 'function') {
        return { ok: false, needPermission: true, origin, error: 'permissions.contains unavailable' };
      }
      const granted = await checkPermissionsContains(apiNs.permissions, origin);
      if (granted) return { ok: true, origin };
      return { ok: false, needPermission: true, origin };
    } catch (e) {
      return { ok: false, needPermission: true, origin, error: e && e.message ? e.message : String(e) };
    }
  }

  async function ensureWebDAVPermission(url) {
    const origin = getWebDAVOriginPattern(url);
    if (!origin) {
      return { ok: false, needPermission: false, origin: '', error: 'invalid WebDAV origin' };
    }
    return ensureOriginPermission(origin);
  }

  // Ticket #126: the GitHub API origin used by the unattended Gist first-create.
  // The background only reads permissions.contains; the user gesture request lives
  // in the NTP settings page.
  const BG_GIST_API_ORIGIN = 'https://api.github.com/*';
  const BG_GIST_PENDING_PERM_KEY = 'gistPendingPermission';
  async function ensureGistApiPermission() {
    return ensureOriginPermission(BG_GIST_API_ORIGIN);
  }

  // BX-AUD-01: only messages sent from our own extension (sender.id === our runtime id) may use the WebDAV proxy.
  // This blocks other installed extensions or arbitrary extension pages from driving Boxing as a blind fetch proxy.
  function isOwnSender(sender) {
    if (!sender) return false;
    if (typeof sender.id === 'string' && typeof api.runtime?.id === 'string') {
      return sender.id === api.runtime.id;
    }
    // Firefox browser.* sometimes leaves sender.id empty for self-frames — accept when the url is our origin.
    if (!sender.id) {
      const ourBase = api.runtime?.getURL?.('') || 'chrome-extension://';
      return !sender.url || String(sender.url).startsWith(ourBase);
    }
    return false;
  }

  function makeAuthHeader(user, pass) {
    if (!user) return null;
    return 'Basic ' + btoa(user + ':' + pass);
  }

  async function handleWebDAVTest(msg) {
    const { url, user, pass } = msg;
    bgLog('WebDAV test via BG:', { url: bgRedactUrl(url), user: user ? '(set)' : '(empty)' });
    const auth = makeAuthHeader(user, pass);

    // Try PROPFIND first (standard WebDAV method, returns 207 on success)
    // Send an XML PROPFIND body so servers that reject bodyless PROPFIND still respond.
    try {
      const pfHeaders = new Headers({
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8'
      });
      if (auth) pfHeaders.set('Authorization', auth);
      const pfBody = '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><displayname/></prop></propfind>';
      const pfResp = await fetch(url, {
        method: 'PROPFIND',
        headers: pfHeaders,
        body: pfBody,
        redirect: 'manual' // BX-AUD-02: refuse transparent 3xx; Authorization never follows.
      });
      bgLog('WebDAV test PROPFIND response:', pfResp.status);
      if (pfResp.status === 0 || pfResp.type === 'opaqueredirect') {
        return { status: 0, ok: false, error: 'webdav redirect blocked' };
      }
      // 207 = Multi-Status (WebDAV success), 200 also OK
      if (pfResp.status === 207 || pfResp.status === 200) {
        return { status: pfResp.status, ok: true };
      }
      // 401/403 = auth failed, 404 = path not found — return these directly
      if (pfResp.status === 401 || pfResp.status === 403 || pfResp.status === 404) {
        return { status: pfResp.status, ok: false };
      }
      // 405 = Method Not Allowed — fall through to OPTIONS
    } catch (e) {
      bgErr('WebDAV test PROPFIND failed:', e.message);
    }

    // Fallback: OPTIONS (servers without PROPFIND at the collection root)
    try {
      const optHeaders = new Headers();
      if (auth) optHeaders.set('Authorization', auth);
      const resp = await fetch(url, { method: 'OPTIONS', headers: optHeaders, redirect: 'manual' });
      bgLog('WebDAV test OPTIONS response:', resp.status);
      if (resp.status === 0 || resp.type === 'opaqueredirect') {
        return { status: 0, ok: false, error: 'webdav redirect blocked' };
      }
      return { status: resp.status, ok: resp.ok };
    } catch (e) {
      bgErr('WebDAV test OPTIONS failed:', e.message);
      throw e;
    }
  }

  async function handleWebDAVPut(msg) {
    const { url, user, pass, body } = msg;
    bgLog('WebDAV PUT via BG:', { url: bgRedactUrl(url), size: body?.length || 0 });
    const h = new Headers({ 'Content-Type': 'application/json', 'Overwrite': 'T' });
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    // Ticket #125 review: this PUT runs inside the per-target queue, so a hung
    // request must release the queue. A timeout is an unknown outcome for the
    // caller, never a success.
    const abort = bgWebDAVAbortHandle(BG_WEBDAV_TIMEOUT_MS);
    let resp;
    try {
      resp = await fetch(url, { method: 'PUT', headers: h, body, redirect: 'manual', signal: abort.signal });
    } finally {
      abort.done();
    }
    bgLog('WebDAV PUT response:', resp.status);
    if (resp.status === 0 || resp.type === 'opaqueredirect') {
      return { status: 0, ok: false, error: 'webdav redirect blocked' };
    }
    const etag = resp.headers.get('etag') || null;
    if (resp.ok) await bgNoteManualWebDAVWrite(url, etag, user, pass, body);
    return { status: resp.status, ok: resp.ok, etag };
  }

  // Ticket 99 (T13): DELETE the cloud backup file when the user chooses to
  // remove remote data while deleting stored sync credentials. Same guards as
  // PUT/GET — no body, so guardWebDAVRequest(msg, false) applies.
  async function handleWebDAVDelete(msg) {
    const { url, user, pass } = msg;
    bgLog('WebDAV DELETE via BG:', { url: bgRedactUrl(url) });
    const h = new Headers();
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    const resp = await fetch(url, { method: 'DELETE', headers: h, redirect: 'manual' });
    bgLog('WebDAV DELETE response:', resp.status);
    if (resp.status === 0 || resp.type === 'opaqueredirect') {
      return { status: 0, ok: false, error: 'webdav redirect blocked' };
    }
    return { status: resp.status, ok: resp.ok };
  }

  // Ticket 83 (V-11): stream the GET body with a byte cap. When the cap is exceeded
  // the response is cancelled and a recognizable error is thrown instead of buffering
  // unbounded data into the service worker. Same policy as the page-direct fallback
  // in ntp/sync-engine.js so both WebDAV paths agree.
  async function readCappedBody(resp, capBytes) {
    if (!resp || !resp.body) return resp ? await resp.text() : '';
    const reader = resp.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > capBytes) {
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

  // GET cloud backup file for sync comparison. Returns status + body text on success.
  async function handleWebDAVGet(msg) {
    const { url, user, pass } = msg;
    bgLog('WebDAV GET via BG:', { url: bgRedactUrl(url) });
    const h = new Headers();
    const auth = makeAuthHeader(user, pass);
    if (auth) h.set('Authorization', auth);
    const resp = await fetch(url, { method: 'GET', headers: h, redirect: 'manual' });
    bgLog('WebDAV GET response:', resp.status);
    if (resp.status === 0 || resp.type === 'opaqueredirect') {
      return { status: 0, ok: false, body: null, error: 'webdav redirect blocked' };
    }
    if (resp.status === 404) { return { status: 404, ok: false, body: null }; }
    if (resp.status === 401 || resp.status === 403) { return { status: resp.status, ok: false, body: null }; }
    const body = await readCappedBody(resp, BG_MAX_GET_BODY);
    return { status: resp.status, ok: resp.ok, body };
  }

  // Dispatch table mirroring kiss-translator's messageHandlers pattern.
  async function dispatch(msg, sender) {
    if (!msg || !msg.type) return { success: false, error: 'Empty message type' };
    bgLog('BG message:', msg.type);
    // BX-AUD-01: reject external senders — other extensions cannot use Boxing as a fetch proxy.
    if (!isOwnSender(sender)) {
      bgErr('BG: rejected external sender', sender && { id: sender.id, url: sender.url });
      return { success: false, error: 'external sender blocked', blocked: true };
    }
    // BX-AUD-01/03: per-handler scheme + private-address + length guards.
    if (msg.type === 'webdav-test' || msg.type === 'webdav-get' || msg.type === 'webdav-delete') {
      const block = guardWebDAVRequest(msg, false);
      if (block) return block;
    } else if (msg.type === 'webdav-put') {
      const block = guardWebDAVRequest(msg, true);
      if (block) return block;
    }
    // A2 / Ticket #123: verify origin permission before fetch (Chrome optional_host_permissions
    // and Firefox runtime revocations). Return structured flags, never fall open.
    if (msg.type === 'webdav-test' || msg.type === 'webdav-put' || msg.type === 'webdav-get' || msg.type === 'webdav-delete') {
      const perm = await ensureWebDAVPermission(msg.url);
      if (!perm.ok) {
        if (perm.needPermission) {
          return { success: false, needPermission: true, error: 'host permission not granted', origin: perm.origin };
        }
        return { success: false, blocked: true, error: perm.error || 'blocked unsafe WebDAV url' };
      }
    }
    try {
      if (msg.type === 'webdav-test') {
        const result = await handleWebDAVTest(msg);
        return { success: true, ...result };
      } else if (msg.type === 'webdav-put') {
        // Ticket #125: page-driven manual PUTs and the background create sequence share
        // one per-target queue, so the same remote file never sees two writers at once.
        const result = await enqueueBgWebDAVTargetWrite(msg.url, () => handleWebDAVPut(msg));
        return { success: true, ...result };
      } else if (msg.type === 'webdav-get') {
        const result = await handleWebDAVGet(msg);
        return { success: true, ...result };
      } else if (msg.type === 'webdav-delete') {
        const result = await handleWebDAVDelete(msg);
        return { success: true, ...result };
      } else if (msg.type === 'gist-write') {
        // Ticket #128: manual Gist writes share the unattended queue. One worker
        // instance (and therefore one queue) serialises all Gist POST/PATCH work.
        return await enqueueManualGistWrite(msg);
      } else if (msg.type === 'auto-backup-configure') {
        const result = await configureBackgroundAutoBackup(msg);
        return { success: true, ...result };
      } else if (msg.type === 'auto-backup-ensure') {
        const result = await reconcileAutoBackupSchedule({
          trigger: 'ntp-ensure',
          runCatchup: msg.runCatchup !== false,
        });
        return { success: true, ...result };
      } else if (msg.type === 'auto-backup-get-state') {
        const state = await bgReadAutoBackupState();
        return { success: true, state };
      } else if (msg.type === 'auto-backup-note-manual-result') {
        // Ticket #129: a manual Sync Now is a real result for the selected target.
        //   ok      -> the upload really happened: bind provider + target + time
        //   failed  -> a request was sent and failed: record reason, keep old success
        //   skipped -> pre-check refusal / pull / merge / local only: write no cloud result
        // The local lane records the snapshot time and clears a resolved local error.
        // Status, pause reason and baseline stay owned by the automatic path (T6/T8).
        const snapshotTs = Math.max(0, Number(msg.snapshotTs) || 0);
        const provider = msg.provider === 'webdav' || msg.provider === 'gist' ? msg.provider : '';
        const targetKey = typeof msg.targetKey === 'string' ? msg.targetKey.slice(0, 2048) : '';
        const outcome = msg.outcome === 'ok' || msg.outcome === 'failed' ? msg.outcome : 'skipped';
        const core = await ensureSnapshotCore();
        const errorCode = typeof msg.errorCode === 'string' && core.AUTO_BACKUP_REMOTE_REASONS.includes(msg.errorCode)
          ? msg.errorCode
          : 'internal-error';
        const next = await enqueueBgAutoBackup(async () => {
          return enqueueBgStateMutation(async () => {
          const latest = await bgReadAutoBackupState();
          const now = Date.now();
          const local = snapshotTs > 0
            ? {
                ...latest.local,
                // A real snapshot is a real local success; a resolved error must not
                // keep showing in Settings or keep the badge lit.
                status: 'ok',
                lastSuccessAt: Math.max(Number(latest.local.lastSuccessAt) || 0, snapshotTs),
                lastSnapshotTs: Math.max(Number(latest.local.lastSnapshotTs) || 0, snapshotTs),
                lastError: null,
              }
            : latest.local;
          let remote = latest.remote;
          if (provider && outcome === 'ok') {
            remote = {
              ...latest.remote,
              provider,
              status: 'ok',
              lastAttemptAt: now,
              lastSuccessAt: Math.max(bgSuccessAtForProvider(latest.remote, provider), now),
              lastSuccessTarget: targetKey,
              lastErrorCode: null,
            };
          } else if (provider && outcome === 'failed') {
            remote = {
              ...latest.remote,
              provider,
              status: bgRemoteStatusForCode(errorCode),
              lastAttemptAt: now,
              lastSuccessAt: bgSuccessAtForProvider(latest.remote, provider),
              lastErrorCode: errorCode,
            };
          }
          const written = await bgWriteAutoBackupState({ ...latest, local, remote, updatedAt: now });
          await setAutoBackupBadge(bgAutoBackupNeedsAttention(written.local, written.remote));
          return written;
          });
        });
        return { success: true, state: next };
      } else if (msg.type === 'auto-backup-reset-cloud') {
        // Ticket #126: explicit credential deletion removes the saved remote target.
        // Run inside the queue so it cannot interleave with a Gist read-modify-write,
        // and bump the generation so stale in-flight results are dropped.
        const next = await enqueueBgAutoBackup(async () => {
          const core = await ensureSnapshotCore();
          return enqueueBgStateMutation(async () => {
            const latest = await bgReadAutoBackupState();
            const nextGeneration = (Number(latest.remote && latest.remote.generation) || 0) + 1;
            return bgWriteAutoBackupState({
              ...latest,
              remote: { ...core.defaultRemoteAutoBackupState(), generation: nextGeneration },
              updatedAt: Date.now(),
            });
          });
        });
        await bgClearGistPendingPermission();
        return { success: true, state: next };
      } else if (msg.type === 'webdav-permission-inspect') {
        const pending = await inspectAndRecordBackgroundWebDAVPermission();
        return { success: true, pending };
      } else if (msg.type === 'snapshot-save') {
        const rawLayout = msg.layout;
        if (!swIsPlainObj(rawLayout)) {
          return { success: true, result: { ok: false, reason: 'invalid-layout', error: 'Invalid layout object for snapshot' } };
        }
        const reason = typeof msg.reason === 'string' && msg.reason.trim() ? msg.reason.trim().slice(0, 64) : undefined;
        const core = await ensureSnapshotCore();
        const result = await enqueueBgSnapshotOp(() => core.saveSnapshotWithAdapter(bgSnapStorage, rawLayout, {
          reason,
          sanitizeLayout: swSanitizeLayoutForBackup,
          log: bgLog,
          errorLog: bgErr,
          returnDetails: true,
        }));
        return { success: true, result };
      } else if (msg.type === 'snapshot-list') {
        const core = await ensureSnapshotCore();
        const snapshots = await enqueueBgSnapshotOp(() => core.listSnapshotsWithAdapter(bgSnapStorage, {
          log: bgLog,
          errorLog: bgErr,
        }));
        return { success: true, snapshots };
      } else if (msg.type === 'snapshot-migrate') {
        const core = await ensureSnapshotCore();
        await enqueueBgSnapshotOp(() => core.migrateSnapshotsWithAdapter(bgSnapStorage, {
          log: bgLog,
          errorLog: bgErr,
        }));
        return { success: true };
      }
      return { success: false, error: 'Unknown message type: ' + msg.type };
    } catch (e) {
      bgErr('BG dispatch error:', e);
      return { success: false, error: e.message || String(e) };
    }
  }

  // Cross-browser message listener.
  // Returns a Promise on Firefox/browser.* native API (Promise resolves → frame receives it).
  // On Chrome chrome.* API, where the listener must return true and use sendResponse,
  // we also call sendResponse so the callback path keeps working.
  api.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
    const promise = dispatch(msg, sender);
    // Chrome callback-style path: sendResponse is called when the promise resolves,
    // and we return true to keep the message channel open for the async response.
    if (typeof sendResponse === 'function') {
      promise.then(result => {
        try { sendResponse(result); } catch (e) { bgErr("sendResponse", e); }
      });
      return true; // keep channel open for async sendResponse
    }
    // Firefox/browser-native path: returning the Promise resolves the response.
    return promise;
  });

  // ── Ticket 42 (spec D2): COW before onInstalled(update) migration ──────────
  // The MV3 background is a classic script (dual manifest service_worker + scripts for
  // Firefox) so it cannot import the NTP ESM storage facade. This is the SW-side
  // self-contained copy-on-write: it snapshots the current boxingLayout into the same
  // split-key shape the NTP facade reads (snap.v1.<ts> body + snap.v1.index directory,
  // ticket 41), BEFORE any update-time migration can touch the data.
  // Migration itself runs later in the NTP facade on first open; this copy preserves
  // the exact pre-update bytes as a rollback point.
  const SW_SNAP_KEY_PREFIX = 'snap.v1.';
  const SW_SNAP_INDEX_KEY = 'snap.v1.index';
  const SW_SNAP_MAX_BYTES = 2 * 1024 * 1024; // single-snapshot size cap (2MB)
  const SW_SNAP_INDEX_CAP = 40;              // SW-side bounded directory; NTP owns full rotation

  // Ticket 122 (spec #120 T2): SW-side self-contained explicit allowlist sanitizer
  // (parity-tested 1:1 against ntp/utils.js). Reused by takePreUpdateSnapshot and
  // future SW-side backup/snapshot callers (#124).
  const SW_ALLOWED_TOP_LEVEL_KEYS = Object.freeze([
    'version', 'schemaVersion', 'boxes', 'nextLargeIndex', 'connections', 'settings', '_meta',
  ]);
  const SW_ALLOWED_SETTINGS_KEYS = Object.freeze([
    'selectedLanguage', 'rememberLastPos', 'zoomLevel', 'darkMode', 'fontSize',
    'squareCorners', 'autoBackupInterval', 'lastBackupAt', 'headerPinned',
    'syncProvider', 'urlOpenMode', 'connDeleteAction', 'theme',
    'autoTitleEnabled', 'autoTitleRules', 'lastSettingsTab',
    'onboardingCompleted', 'syncLevel', 'syncFileName', 'lastSyncAt',
    'lastKnownBoxCountBaseline',
  ]);
  const SW_ALLOWED_AUTO_TITLE_RULE_KEYS = Object.freeze(['pattern', 'type']);
  const SW_ALLOWED_META_KEYS = Object.freeze([
    'revision', 'updatedAt', 'writerId', 'baseRevision', '__groupsMigrated', 'deleted',
  ]);
  const SW_ALLOWED_LARGE_BOX_KEYS = Object.freeze([
    'id', 'type', 'title', 'x', 'y', 'width', 'height',
    'nextSmallIndex', 'collapseHover', 'pinned', 'isParent', 'viewState', 'children',
  ]);
  const SW_ALLOWED_VIEW_STATE_KEYS = Object.freeze([
    'innerZoom', 'innerPanX', 'innerPanY', 'updatedAt',
  ]);
  const SW_ALLOWED_SMALL_BOX_KEYS = Object.freeze([
    'id', 'type', 'title', 'x', 'y', 'width', 'height',
    'pinned', 'collapseHover', 'isParent', 'bookmarks',
  ]);
  const SW_ALLOWED_BOOKMARK_KEYS = Object.freeze(['id', 'title', 'url']);
  const SW_ALLOWED_CONN_KEYS = Object.freeze([
    'id', 'from', 'to', 'source', 'target', 'createdAt', 'props',
  ]);
  const SW_ALLOWED_CONN_PROPS_KEYS = Object.freeze([]);

  function swIsPlainObj(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
  function swHasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function swIsScalar(v) {
    if (typeof v === 'string' || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    return false;
  }
  function swNormDarkMode(v) {
    if (v === true || v === 'dark') return 'dark';
    if (v === 'system') return 'system';
    return 'light';
  }
  function swPickScalars(src, keys) {
    const out = {};
    for (const k of keys) {
      if (!swHasOwn(src, k) || src[k] === undefined) continue;
      if (swIsScalar(src[k])) out[k] = src[k];
    }
    return out;
  }
  function swSanitizeViewState(vs) {
    if (!swIsPlainObj(vs)) return undefined;
    const out = {};
    for (const k of SW_ALLOWED_VIEW_STATE_KEYS) {
      if (swHasOwn(vs, k) && typeof vs[k] === 'number' && Number.isFinite(vs[k])) out[k] = vs[k];
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  function swSanitizeBookmark(bm) {
    return swIsPlainObj(bm) ? swPickScalars(bm, SW_ALLOWED_BOOKMARK_KEYS) : null;
  }
  function swSanitizeSmallBox(sb) {
    if (!swIsPlainObj(sb)) return null;
    const out = {};
    for (const k of SW_ALLOWED_SMALL_BOX_KEYS) {
      if (!swHasOwn(sb, k) || sb[k] === undefined) continue;
      if (k === 'bookmarks') {
        out.bookmarks = Array.isArray(sb.bookmarks) ? sb.bookmarks.map(swSanitizeBookmark).filter(Boolean) : [];
      } else if (swIsScalar(sb[k])) {
        out[k] = sb[k];
      }
    }
    return out;
  }
  function swSanitizeLargeBox(lb) {
    if (!swIsPlainObj(lb)) return null;
    const out = {};
    for (const k of SW_ALLOWED_LARGE_BOX_KEYS) {
      if (!swHasOwn(lb, k) || lb[k] === undefined) continue;
      if (k === 'viewState') {
        const cleanVs = swSanitizeViewState(lb.viewState);
        if (cleanVs !== undefined) out.viewState = cleanVs;
      } else if (k === 'children') {
        out.children = Array.isArray(lb.children) ? lb.children.map(swSanitizeSmallBox).filter(Boolean) : [];
      } else if (swIsScalar(lb[k])) {
        out[k] = lb[k];
      }
    }
    return out;
  }
  function swSanitizeConn(conn) {
    if (!swIsPlainObj(conn)) return null;
    const out = {};
    for (const k of SW_ALLOWED_CONN_KEYS) {
      if (!swHasOwn(conn, k) || conn[k] === undefined) continue;
      if (k === 'props') {
        if (swIsPlainObj(conn.props)) out.props = swPickScalars(conn.props, SW_ALLOWED_CONN_PROPS_KEYS);
      } else if (swIsScalar(conn[k])) {
        out[k] = conn[k];
      }
    }
    return out;
  }
  function swSanitizeSettings(settings) {
    if (settings === null) return null;
    if (settings === undefined) return undefined;
    if (!swIsPlainObj(settings)) return {};
    const out = {};
    for (const k of SW_ALLOWED_SETTINGS_KEYS) {
      if (!swHasOwn(settings, k) || settings[k] === undefined) continue;
      if (k === 'darkMode') {
        out.darkMode = swNormDarkMode(settings.darkMode);
      } else if (k === 'autoTitleRules') {
        const rules = [];
        for (const r of (Array.isArray(settings.autoTitleRules) ? settings.autoTitleRules : [])) {
          if (!swIsPlainObj(r)) continue;
          const clean = {};
          for (const rk of SW_ALLOWED_AUTO_TITLE_RULE_KEYS) {
            if (swHasOwn(r, rk) && typeof r[rk] === 'string') clean[rk] = r[rk];
          }
          if (typeof clean.pattern === 'string' && typeof clean.type === 'string') rules.push(clean);
        }
        out.autoTitleRules = rules;
      } else if (swIsScalar(settings[k])) {
        out[k] = settings[k];
      }
    }
    return out;
  }
  function swSanitizeMeta(meta) {
    if (!swIsPlainObj(meta)) return undefined;
    const out = {};
    for (const k of SW_ALLOWED_META_KEYS) {
      if (!swHasOwn(meta, k) || meta[k] === undefined) continue;
      if (k === 'deleted') {
        if (swIsPlainObj(meta.deleted)) {
          const cleanDel = {};
          for (const [dk, dv] of Object.entries(meta.deleted)) {
            if (typeof dv === 'number' && Number.isFinite(dv)) cleanDel[dk] = dv;
          }
          out.deleted = cleanDel;
        }
      } else if (swIsScalar(meta[k])) {
        out[k] = meta[k];
      }
    }
    return out;
  }
  function swSanitizeLayoutForBackup(raw) {
    if (!swIsPlainObj(raw)) return {};
    const out = {};
    for (const k of SW_ALLOWED_TOP_LEVEL_KEYS) {
      if (!swHasOwn(raw, k) || raw[k] === undefined) continue;
      if (k === 'boxes') {
        out.boxes = Array.isArray(raw.boxes) ? raw.boxes.map(swSanitizeLargeBox).filter(Boolean) : [];
      } else if (k === 'connections') {
        out.connections = Array.isArray(raw.connections) ? raw.connections.map(swSanitizeConn).filter(Boolean) : [];
      } else if (k === 'settings') {
        const cleanSettings = swSanitizeSettings(raw.settings);
        if (cleanSettings !== undefined) out.settings = cleanSettings;
      } else if (k === '_meta') {
        const cleanMeta = swSanitizeMeta(raw._meta);
        if (cleanMeta !== undefined) out._meta = cleanMeta;
      } else if (swIsScalar(raw[k])) {
        out[k] = raw[k];
      }
    }
    return out;
  }
  root.__boxingSwSanitizeLayoutForBackup = swSanitizeLayoutForBackup;

  async function takePreUpdateSnapshot() {
    return enqueueBgSnapshotOp(async () => {
      try {
        const storedLayout = await bgStorageGet({ boxingLayout: null });
        const boxingLayout = storedLayout && storedLayout.boxingLayout;
        if (!swIsPlainObj(boxingLayout)) return; // no valid layout object (fresh install or corrupt non-object) — nothing to snapshot
        let core = null;
        try {
          core = await ensureSnapshotCore();
        } catch (_) {
          core = null;
        }
        if (core && typeof core.saveSnapshotWithAdapter === 'function') {
          const outcome = await core.saveSnapshotWithAdapter(bgSnapStorage, boxingLayout, {
            reason: 'pre-update',
            sanitizeLayout: swSanitizeLayoutForBackup,
            log: bgLog,
            errorLog: bgErr,
            returnDetails: true,
          });
          if (outcome && outcome.ok) {
            bgLog('pre-update snapshot saved ts=' + outcome.ts + ' bytes=' + outcome.size);
          } else if (outcome && outcome.reason === 'oversize') {
            bgErr('pre-update snapshot skipped: ' + outcome.size + 'B exceeds 2MB single cap');
          }
          return;
        }
        // Fallback for minimal VM harnesses without importScripts/import(): still allocate strictly monotonic ts.
        const stored = await bgStorageGet(SW_SNAP_INDEX_KEY);
        const index = Array.isArray(stored && stored[SW_SNAP_INDEX_KEY]) ? stored[SW_SNAP_INDEX_KEY].slice() : [];
        let maxTs = 0;
        for (const row of index) {
          if (row && typeof row.ts === 'number' && row.ts > maxTs) maxTs = row.ts;
        }
        const ts = Math.max(Date.now(), maxTs + 1);
        const snap = { ts, schemaVersion: Number(boxingLayout.schemaVersion) || 1, data: swSanitizeLayoutForBackup(boxingLayout) };
        const json = JSON.stringify(snap);
        if (json.length > SW_SNAP_MAX_BYTES) { bgErr('pre-update snapshot skipped: ' + json.length + 'B exceeds 2MB single cap'); return; }
        await bgStorageSetValidated({ [SW_SNAP_KEY_PREFIX + snap.ts]: snap }, SW_SNAP_KEY_PREFIX);
        index.push({ ts: snap.ts, schemaVersion: snap.schemaVersion, size: json.length });
        index.sort((a, b) => a.ts - b.ts);
        let evicted = [];
        if (index.length > SW_SNAP_INDEX_CAP) {
          evicted = index.splice(0, index.length - SW_SNAP_INDEX_CAP);
        }
        await bgStorageSetValidated({ [SW_SNAP_INDEX_KEY]: index }, SW_SNAP_INDEX_KEY);
        for (const e of evicted) { try { await bgStorageRemoveValidated(SW_SNAP_KEY_PREFIX + e.ts); } catch (_) { /* non-fatal */ } }
        bgLog('pre-update snapshot saved ts=' + snap.ts + ' bytes=' + json.length);
      } catch (e) { bgErr('pre-update snapshot failed', e); } // never block onInstalled
    });
  }

  api.runtime?.onInstalled?.addListener(async (details) => {
    try {
      root.__boxing_last_install__ = { reason: details?.reason || "unknown", at: Date.now() };
      if (details?.reason === "update") {
        // Ticket 42 / spec D2: COW FIRST — snapshot the pre-update layout before any
        // migration runs. Migration happens later in the NTP facade (first open), so the
        // order here — costly snapshot before even writing the signal — is deliberate.
        await takePreUpdateSnapshot();
      }
      // Persist the install signal so NTP onboarding triggers on install
      // (and can distinguish update) instead of judging fresh-install on every init.
      if ((details?.reason === "install" || details?.reason === "update") && api.storage?.local?.set) {
        await api.storage.local.set({ boxingInstallSignal: { reason: details.reason, at: Date.now() } });
      }
      await reconcileAutoBackupSchedule({ trigger: 'installed-reconcile', runCatchup: false });
    } catch (e) { bgErr('onInstalled:', e); }
  });

  api.action?.onClicked?.addListener(async (tab) => {
    if (api.action && typeof api.action.openPopup === "function") {
      try { await api.action.openPopup(); return; } catch (e) { bgErr('openPopup:', e); }
    }
    if (api.tabs && typeof api.tabs.create === "function") {
      try { await api.tabs.create({ url: api.runtime.getURL("popup/popup.html") }); } catch (e) { bgErr('tabs.create:', e); }
    }
  });

})();
