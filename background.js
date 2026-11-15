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
  // Ticket #126: the background must decrypt the saved Gist envelope and run the
  // pure first-create protocol without importing the NTP ES modules.
  if (typeof importScripts === 'function' && !root.__boxingCredentialCore) {
    try {
      importScripts('shared/credential-core.js');
    } catch (e) {
      bgErr('Failed to importScripts shared/credential-core.js', e);
    }
  }
  if (typeof importScripts === 'function' && !root.__boxingGistBackupCore) {
    try {
      importScripts('shared/gist-backup-core.js');
    } catch (e) {
      bgErr('Failed to importScripts shared/gist-backup-core.js', e);
    }
  }

  function ensureSharedModule(globalName, relPath, currentPromise, setPromise) {
    if (root[globalName]) return Promise.resolve(root[globalName]);
    if (!currentPromise) {
      const p = import('./' + relPath).then((mod) => {
        const loaded = root[globalName] || (mod && (mod.default || mod));
        if (loaded && !root[globalName]) root[globalName] = loaded;
        return root[globalName];
      }).catch((e) => {
        setPromise(null);
        throw e;
      });
      setPromise(p);
      return p;
    }
    return currentPromise;
  }

  let _corePromise = null;
  function ensureSnapshotCore() {
    return ensureSharedModule('__boxingSnapshotCore', 'shared/snapshot-core.js', _corePromise, (p) => { _corePromise = p; });
  }

  let _credentialCorePromise = null;
  function ensureCredentialCore() {
    return ensureSharedModule('__boxingCredentialCore', 'shared/credential-core.js', _credentialCorePromise, (p) => { _credentialCorePromise = p; });
  }

  let _gistCorePromise = null;
  function ensureGistCore() {
    return ensureSharedModule('__boxingGistBackupCore', 'shared/gist-backup-core.js', _gistCorePromise, (p) => { _gistCorePromise = p; });
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
  const BG_WORKER_OWNER_ID = 'sw-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();
  let bgAutoBackupQueue = Promise.resolve();
  let bgAutoBackupInFlightPromise = null;
  let bgSnapshotQueue = Promise.resolve();

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

      if (!core.isAutoBackupActive(state)) {
        await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
        return { ok: false, skipped: true, reason: 'inactive', state };
      }
      if (expectedEpoch !== undefined && state.epoch !== expectedEpoch) {
        return { ok: false, cancelled: true, reason: 'epoch-changed', state };
      }
      const isInterruptedRecovery = Boolean(
        state.local &&
        state.local.status === 'running' &&
        (!state.lock || state.lock.expiresAt <= now)
      );
      if (!forceImmediate) {
        // Dedup across startup/ensure bursts: catch-up / ensure runs when overdue or recovering an interrupted run.
        // An explicit alarm event is itself the browser's due signal (and keeps tests able to fire it directly).
        if (trigger !== 'alarm' && !isInterruptedRecovery && state.nextScheduledAt && now < state.nextScheduledAt) {
          return { ok: false, skipped: true, reason: 'not-due-yet', state };
        }
        // Durable lease lock against overlapping wakeups.
        if (state.lock && state.lock.expiresAt > now && state.lock.ownerId !== BG_WORKER_OWNER_ID) {
          return { ok: false, skipped: true, reason: 'locked', state };
        }
      }

      const activeEpoch = state.epoch;
      const prevLocal = state.local || core.defaultAutoBackupState().local;
      // Do NOT advance nextScheduledAt until the snapshot settles; an interrupted SW wakeup must retry.
      const claimedState = await bgWriteAutoBackupState({
        ...state,
        updatedAt: now,
        local: {
          ...prevLocal,
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

      let snapOutcome = null;
      let errMessage = null;
      try {
        const storedLayout = await bgStorageGet({ boxingLayout: null });
        const rawLayout = storedLayout && storedLayout.boxingLayout;
        if (!swIsPlausibleLayout(rawLayout)) {
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

      const latestState = await bgReadAutoBackupState();
      const finishedAt = Date.now();
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

      const settledIntervalMs = latestState.intervalSec * 1000;
      let settledState;
      if (snapOutcome && snapOutcome.ok) {
        settledState = await bgWriteAutoBackupState({
          ...latestState,
          nextScheduledAt: finishedAt + settledIntervalMs,
          updatedAt: finishedAt,
          local: {
            status: 'ok',
            lastAttemptAt: claimedState.local.lastAttemptAt,
            lastSuccessAt: snapOutcome.ts,
            lastSnapshotTs: snapOutcome.ts,
            lastError: null,
          },
          lock: null,
        });
        bgLog('Background local auto-backup saved ts=' + snapOutcome.ts + ' trigger=' + trigger);
      } else {
        // Failure: NEVER update lastSuccessAt or lastSnapshotTs.
        settledState = await bgWriteAutoBackupState({
          ...latestState,
          nextScheduledAt: finishedAt + settledIntervalMs,
          updatedAt: finishedAt,
          local: {
            status: 'error',
            lastAttemptAt: claimedState.local.lastAttemptAt,
            lastSuccessAt: prevLocal.lastSuccessAt || 0,
            lastSnapshotTs: prevLocal.lastSnapshotTs || 0,
            lastError: errMessage || 'Failed to save local snapshot',
          },
          lock: null,
        });
      }

      // Ticket #126: cloud result is independent from the local snapshot result.
      // The local snapshot stays the fallback even when the Gist step pauses.
      let cloudResult = null;
      if (core.isAutoBackupActive(settledState) && settledState.epoch === activeEpoch) {
        try {
          cloudResult = await runBackgroundGistAutoBackup({
            trigger,
            expectedEpoch: activeEpoch,
          });
        } catch (e) {
          bgErr('Background Gist auto-backup failed (' + trigger + '):', e);
          cloudResult = { ok: false, error: e && e.message ? e.message : String(e || 'Gist auto-backup failed') };
        }
      }

      const finalState = cloudResult && cloudResult.state ? cloudResult.state : await bgReadAutoBackupState();
      const localFailed = !(snapOutcome && snapOutcome.ok);
      // Only current Gist targets own the cloud badge; a historical pause must not
      // leave "!" after the user switches to WebDAV/local.
      const latestLayout = await bgStorageGet({ boxingLayout: null });
      const currentProvider = latestLayout && latestLayout.boxingLayout &&
        latestLayout.boxingLayout.settings ? latestLayout.boxingLayout.settings.syncProvider : '';
      const cloudNeedsAttention = Boolean(
        currentProvider === 'gist' &&
        finalState.cloud &&
        (finalState.cloud.status === 'paused' ||
          finalState.cloud.status === 'pending')
      );
      await setAutoBackupBadge(localFailed || cloudNeedsAttention);
      return {
        ok: Boolean(snapOutcome && snapOutcome.ok),
        ts: snapOutcome && snapOutcome.ok ? snapOutcome.ts : undefined,
        error: localFailed ? (settledState.local && settledState.local.lastError) : undefined,
        cloud: cloudResult,
        state: finalState,
      };
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
      return { ok: true, active: false, state };
    }

    const now = Date.now();
    const periodInMinutes = Math.max(1, Math.ceil(state.intervalSec / 60));
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

  async function configureBackgroundAutoBackup(opts) {
    const options = opts || {};
    const core = await ensureSnapshotCore();
    const intervalSec = core.normalizeAutoBackupInterval(options.intervalSec);
    const optIn = Boolean(options.optIn) && intervalSec >= core.MIN_AUTO_BACKUP_INTERVAL_SEC;

    return enqueueBgAutoBackup(async () => {
      const prev = await bgReadAutoBackupState();
      const now = Date.now();
      const nextEpoch = (prev.epoch || 0) + 1;
      const prevLocal = prev.local || core.defaultAutoBackupState().local;

      if (!optIn) {
        await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
        await setAutoBackupBadge(false);
        const disabledState = await bgWriteAutoBackupState({
          version: 1,
          optIn: false,
          intervalSec: 0,
          epoch: nextEpoch,
          nextScheduledAt: 0,
          updatedAt: now,
          local: {
            ...prevLocal,
            status: prevLocal.lastSuccessAt > 0 || prevLocal.lastError ? 'cancelled' : 'idle',
          },
          // Ticket #126: reconfiguring the interval must never drop the cloud
          // baseline/account/pending marker. Doing so would erase a pending POST
          // result and let the immediate run create a duplicate Gist.
          cloud: prev.cloud,
          lock: null,
        });
        return { ok: true, state: disabledState };
      }

      const periodInMinutes = Math.max(1, Math.ceil(intervalSec / 60));
      const enabledState = await bgWriteAutoBackupState({
        version: 1,
        optIn: true,
        intervalSec,
        epoch: nextEpoch,
        nextScheduledAt: 0,
        updatedAt: now,
        cloud: prev.cloud,
        local: {
          ...prevLocal,
          status: 'running',
          lastError: null,
        },
        lock: null,
      });
      await bgAlarmsCreate(BG_AUTO_BACKUP_ALARM_NAME, {
        delayInMinutes: periodInMinutes,
        periodInMinutes,
      });
      return { ok: true, state: enabledState, shouldRunImmediate: true, epoch: nextEpoch };
    }).then(async (cfgResult) => {
      if (cfgResult && cfgResult.shouldRunImmediate) {
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

  // ── Background Gist first-create (ticket #126 / #120 T7) ──────────────
  // Only the FIRST unattended Gist is created here. Updating an existing Gist is
  // ticket #128's problem; this path must never PATCH, and must never POST twice
  // when a previous result is unknown.
  const BG_GIST_API_BASE = 'https://api.github.com';
  const BG_GIST_REQUEST_TIMEOUT_MS = 20000;

  async function bgGetPerInstallKeyB64() {
    const res = await bgStorageGet({ 'boxingCredKey.v1': null });
    const key = res && res['boxingCredKey.v1'];
    if (typeof key !== 'string' || key.length < 40) {
      throw new Error('per-install credential key unavailable');
    }
    return key;
  }

  async function bgDecryptStoredCredential(envelope) {
    if (!envelope) return '';
    if (typeof envelope === 'string') return envelope;
    const core = await ensureCredentialCore();
    return core.decryptCredential(envelope, {
      getPerInstallKeyB64: bgGetPerInstallKeyB64,
      debugErr: (msg, err) => bgErr(msg, err),
    });
  }

  function bgGistHeaders(token) {
    return new Headers({
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
  }

  async function bgGistFetch(pathname, token, options) {
    const opts = options || {};
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try { controller.abort(); } catch (_) { /* already settled */ }
    }, BG_GIST_REQUEST_TIMEOUT_MS);
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
      return resp;
    } finally {
      clearTimeout(timer);
    }
  }

  function bgNormalizeAccountId(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return typeof value === 'string' && /^\d{1,20}$/.test(value) ? value : '';
  }

  async function bgGistGetUser(token) {
    let resp;
    try {
      resp = await bgGistFetch('/user', token, { method: 'GET' });
    } catch (e) {
      return { ok: false, reasonCode: 'gistCheckFailed' };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, reasonCode: 'gistRequestRejected' };
    }
    if (!resp.ok) return { ok: false, reasonCode: 'gistCheckFailed' };
    let json;
    try { json = await resp.json(); } catch (_) { return { ok: false, reasonCode: 'gistCheckFailed' }; }
    const login = json && json.login;
    const normalizedId = bgNormalizeAccountId(json && json.id);
    if (!normalizedId || typeof login !== 'string' || !login) {
      return { ok: false, reasonCode: 'gistCheckFailed' };
    }
    return { ok: true, account: { login: login.slice(0, 100), id: normalizedId } };
  }

  const BG_GIST_LIST_MAX_PAGES = 3; // 300 gists; beyond that "absent" cannot be proven.

  async function bgGistListOwnGists(token) {
    const all = [];
    for (let page = 1; page <= BG_GIST_LIST_MAX_PAGES; page++) {
      let resp;
      try {
        resp = await bgGistFetch('/gists?per_page=100&page=' + page, token, { method: 'GET' });
      } catch (e) {
        return { ok: false, reasonCode: 'gistCheckFailed' };
      }
      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, reasonCode: 'gistRequestRejected' };
      }
      if (!resp.ok) return { ok: false, reasonCode: 'gistCheckFailed' };
      let json;
      try { json = await resp.json(); } catch (_) { return { ok: false, reasonCode: 'gistCheckFailed' }; }
      if (!Array.isArray(json)) return { ok: false, reasonCode: 'gistCheckFailed' };
      for (const gist of json) all.push(gist);
      const link = resp.headers && typeof resp.headers.get === 'function' ? resp.headers.get('link') : '';
      const hasNext = typeof link === 'string' && /rel="next"/i.test(link);
      if (!hasNext) return { ok: true, gists: all };
    }
    // Still more pages than the bound: absence cannot be proven, so pause.
    return { ok: false, reasonCode: 'gistCheckFailed' };
  }

  async function bgPatchAutoBackupCloud(patch) {
    const latest = await bgReadAutoBackupState();
    const now = Date.now();
    const cloud = { ...(latest.cloud || {}), ...patch };
    const next = await bgWriteAutoBackupState({ ...latest, cloud, updatedAt: now });
    return next;
  }

  async function bgRecordGistPendingPermission(perm) {
    try {
      if (!api.storage || !api.storage.local || !api.storage.local.set) return;
      const stored = await bgStorageGet({ [BG_GIST_PENDING_PERM_KEY]: null });
      const prev = stored && stored[BG_GIST_PENDING_PERM_KEY];
      const reason = (prev && prev.needed && prev.origin === perm.origin && prev.reason === 'denied')
        ? 'denied'
        : 'missing-permission';
      await api.storage.local.set({ [BG_GIST_PENDING_PERM_KEY]: { needed: true, origin: perm.origin, source: 'background', reason, updatedAt: Date.now() } });
    } catch (e) {
      bgErr('record Gist pending permission failed', e);
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
      bgErr('clear Gist pending permission failed', e);
    }
  }

  async function inspectAndRecordBackgroundGistPermission() {
    try {
      const stored = await bgStorageGet({ boxingLayout: null, [BG_GIST_PENDING_PERM_KEY]: null });
      const settings = stored && stored.boxingLayout && stored.boxingLayout.settings;
      if (!settings || settings.syncProvider !== 'gist') return null;
      const perm = await ensureGistApiPermission();
      if (!perm.ok && perm.needPermission) {
        await bgRecordGistPendingPermission(perm);
        const after = await bgStorageGet({ [BG_GIST_PENDING_PERM_KEY]: null });
        return after && after[BG_GIST_PENDING_PERM_KEY] ? after[BG_GIST_PENDING_PERM_KEY] : null;
      }
      if (perm.ok) await bgClearGistPendingPermission(perm.origin);
      return null;
    } catch (e) {
      bgErr('inspectAndRecordBackgroundGistPermission error', e);
      return null;
    }
  }

  async function runBackgroundGistAutoBackup(options) {
    const opts = options || {};
    const trigger = String(opts.trigger || 'alarm');
    const expectedEpoch = opts.expectedEpoch;
    const core = await ensureSnapshotCore();
    const gistCore = await ensureGistCore();

    let state = await bgReadAutoBackupState();
    if (!core.isAutoBackupActive(state)) {
      return { ok: false, skipped: true, reason: 'inactive', state };
    }
    if (expectedEpoch !== undefined && state.epoch !== expectedEpoch) {
      return { ok: false, cancelled: true, reason: 'epoch-changed', state };
    }

    const stored = await bgStorageGet({ boxingLayout: null });
    const rawLayout = stored && stored.boxingLayout;
    if (!swIsPlausibleLayout(rawLayout)) {
      return { ok: false, skipped: true, reason: 'invalid-layout', state };
    }
    const settings = rawLayout.settings || {};
    if (settings.syncProvider !== 'gist') {
      return { ok: true, skipped: true, reason: 'provider-not-gist', state };
    }

    const cloud = state.cloud || core.defaultCloudState();
    let token = '';
    try {
      token = await bgDecryptStoredCredential(settings._encGistToken);
    } catch (e) {
      bgErr('Gist token decrypt failed', e);
      token = '';
    }
    const tokenPresent = typeof token === 'string' && token.trim().length > 0;

    let permission = { ok: false, needPermission: true, origin: BG_GIST_API_ORIGIN };
    if (tokenPresent) {
      permission = await ensureGistApiPermission();
      if (!permission.ok && permission.needPermission) {
        await bgRecordGistPendingPermission(permission);
      } else if (permission.ok) {
        await bgClearGistPendingPermission(permission.origin);
      }
    }

    const finishPause = async (reasonCode, fromCloud, extraPatch) => {
      const patch = {
        provider: 'gist',
        // Unknown POST outcomes stay explicitly pending, never downgraded to a plain pause.
        status: reasonCode === 'gistResultUnknown' ? 'pending' : 'paused',
        lastAttemptAt: Date.now(),
        lastSuccessAt: Number(fromCloud && fromCloud.lastSuccessAt) || 0,
        lastErrorCode: reasonCode,
        ...extraPatch,
      };
      const next = await bgPatchAutoBackupCloud(patch);
      await setAutoBackupBadge(true);
      bgLog('Gist first-create paused: ' + reasonCode + ' trigger=' + trigger);
      return { ok: false, paused: true, reasonCode, state: next };
    };

    if (!tokenPresent) return finishPause('gistTokenMissing', cloud);
    if (!permission.ok) return finishPause('gistPermissionMissing', cloud);

    // A pending POST outcome blocks every side effect before any account request.
    if (cloud.pendingCreate) return finishPause('gistResultUnknown', cloud);

    const accountResult = await bgGistGetUser(token);
    if (!accountResult.ok) {
      return finishPause(accountResult.reasonCode || 'gistCheckFailed', cloud);
    }
    const account = accountResult.account;

    const plan = gistCore.planGistFirstCreate({
      settings,
      cloud,
      account,
      tokenPresent: true,
      permission: { ok: true },
    });

    const sameAccountPatch = (!cloud.account || String(cloud.account.id) === String(account.id))
      ? { account }
      : {};

    if (plan.action === 'pause') {
      return finishPause(plan.reasonCode, cloud, sameAccountPatch);
    }
    if (plan.action === 'update-not-enabled') {
      return finishPause('gistUpdateNotEnabled', cloud, sameAccountPatch);
    }
    if (plan.action !== 'create') {
      return { ok: true, skipped: true, reason: plan.action, state };
    }

    // Spec D4: create only when the remote target is proven absent. Without a
    // saved Gist id, the target is "this account + file name", so an untracked
    // Gist carrying that file name is an unknown target and must pause.
    const listResult = await bgGistListOwnGists(token);
    if (!listResult.ok) {
      return finishPause(listResult.reasonCode || 'gistCheckFailed', cloud, sameAccountPatch);
    }
    const conflict = gistCore.findGistWithFile(listResult.gists, plan.fileName);
    if (conflict) {
      return finishPause('gistUnknownExisting', cloud, sameAccountPatch);
    }

    // Re-check cancellation immediately before the one irreversible step.
    const beforePost = await bgReadAutoBackupState();
    if (!core.isAutoBackupActive(beforePost) || (expectedEpoch !== undefined && beforePost.epoch !== expectedEpoch)) {
      if (!core.isAutoBackupActive(beforePost)) await bgAlarmsClear(BG_AUTO_BACKUP_ALARM_NAME);
      return { ok: false, cancelled: true, reason: 'cancelled-before-post', state: beforePost };
    }

    const fileName = plan.fileName;
    const payload = swBuildSyncPayload(rawLayout);
    const content = JSON.stringify(payload, null, 2);
    if (content.length > BG_MAX_BODY) {
      return finishPause('gistRequestRejected', cloud, sameAccountPatch);
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

    // Persist the unknown-result marker BEFORE sending the POST. If the worker dies
    // mid-request, the next run must pause instead of creating a second Gist.
    await bgPatchAutoBackupCloud({
      provider: 'gist',
      status: 'running',
      lastAttemptAt: startedAt,
      lastSuccessAt: Number(cloud.lastSuccessAt) || 0,
      lastErrorCode: null,
      account,
      pendingCreate,
    });

    const pendingPatch = (extra) => ({
      provider: 'gist',
      status: 'pending',
      lastAttemptAt: startedAt,
      lastSuccessAt: Number(cloud.lastSuccessAt) || 0,
      lastErrorCode: 'gistResultUnknown',
      account,
      pendingCreate,
      ...extra,
    });

    let resp = null;
    let requestError = null;
    try {
      resp = await bgGistFetch('/gists', token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (e) {
      requestError = e;
    }
    const finishedAt = Date.now();

    if (!resp) {
      const next = await bgPatchAutoBackupCloud(pendingPatch());
      await setAutoBackupBadge(true);
      bgErr('Gist create result unknown (' + trigger + '):', requestError && requestError.message ? requestError.message : 'network error');
      return { ok: false, pending: true, reasonCode: 'gistResultUnknown', state: next };
    }

    if (resp.ok) {
      let json = null;
      try { json = await resp.json(); } catch (_) { json = null; }
      const parsed = json ? gistCore.parseGistResponse(json, fileName) : null;
      if (parsed) {
        const baseline = {
          provider: 'gist',
          gistId: parsed.gistId,
          ownerLogin: parsed.ownerLogin || account.login,
          ownerId: parsed.ownerId || account.id,
          fileName,
          createdAt: parsed.createdAt || finishedAt,
          updatedAt: parsed.updatedAt || finishedAt,
          verifiedAt: finishedAt,
        };
        const next = await bgPatchAutoBackupCloud({
          provider: 'gist',
          status: 'ok',
          lastAttemptAt: startedAt,
          lastSuccessAt: finishedAt,
          lastErrorCode: null,
          account: { login: baseline.ownerLogin, id: baseline.ownerId },
          baseline,
          pendingCreate: null,
        });
        await setAutoBackupBadge(false);
        bgLog('Gist first-create confirmed id=' + baseline.gistId + ' trigger=' + trigger);
        return { ok: true, created: true, gistId: baseline.gistId, state: next };
      }
      // GitHub said 2xx but the body is unusable. The object may exist; keep the
      // pending marker (and any id we can see) so no second POST is sent.
      const knownId = json ? gistCore.normalizeGistId(json.id) : '';
      const next = await bgPatchAutoBackupCloud(pendingPatch({
        pendingCreate: { ...pendingCreate, gistId: knownId },
      }));
      await setAutoBackupBadge(true);
      bgErr('Gist create response incomplete (' + trigger + ')');
      return { ok: false, pending: true, reasonCode: 'gistResultUnknown', state: next };
    }

    const failure = gistCore.classifyGistFailure(resp.status);
    if (failure.kind === 'unknown') {
      const next = await bgPatchAutoBackupCloud(pendingPatch({ lastErrorCode: failure.reasonCode }));
      await setAutoBackupBadge(true);
      bgErr('Gist create returned HTTP ' + resp.status + ' (' + trigger + '); result treated as unknown');
      return { ok: false, pending: true, reasonCode: failure.reasonCode, state: next };
    }

    const next = await bgPatchAutoBackupCloud({
      provider: 'gist',
      status: 'paused',
      lastAttemptAt: startedAt,
      lastSuccessAt: Number(cloud.lastSuccessAt) || 0,
      lastErrorCode: failure.reasonCode,
      account,
      pendingCreate: null,
    });
    await setAutoBackupBadge(true);
    bgLog('Gist first-create rejected HTTP ' + resp.status + ' trigger=' + trigger);
    return { ok: false, paused: true, reasonCode: failure.reasonCode, state: next };
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
        if (api.storage.local.set) {
          const prev = stored[BG_WEBDAV_PERM_KEY];
          const reason = (prev && prev.needed && prev.origin === perm.origin && prev.reason === 'denied')
            ? 'denied'
            : 'missing-permission';
          const permState = { needed: true, origin: perm.origin, source: 'background', reason, updatedAt: Date.now() };
          await api.storage.local.set({ webdavPendingPermission: permState });
          return permState;
        }
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
      if (!alarm || alarm.name !== BG_AUTO_BACKUP_ALARM_NAME) return;
      bgLog('Auto-backup alarm fired');
      // Execute local snapshot directly in background (single executor, works with zero open NTP tabs).
      runBackgroundLocalAutoBackup({ trigger: 'alarm' }).catch((e) => {
        bgErr('Auto-backup alarm handler error', e);
      });
      // Ticket #123: on background alarm, inspect WebDAV permission read-only via
      // permissions.contains and persist pending state if ungranted — never prompt
      // or send a WebDAV request without permission.
      inspectAndRecordBackgroundWebDAVPermission();
      // Ticket #126: same read-only check for the GitHub API origin; the actual
      // first-create run above already refuses to fetch without permission.
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
    runBackgroundGistAutoBackup,
    reconcileAutoBackupSchedule,
    configureBackgroundAutoBackup,
    getAutoBackupState: bgReadAutoBackupState,
    inspectAndRecordBackgroundWebDAVPermission,
    inspectAndRecordBackgroundGistPermission,
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
    if (!origin) {
      return { ok: false, needPermission: false, origin: '', error: 'invalid origin' };
    }
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

  // Ticket #126: GitHub API origin used by the unattended Gist first-create. The
  // background only reads permissions.contains; the user gesture request lives in
  // the NTP settings page (D5).
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
    const resp = await fetch(url, { method: 'PUT', headers: h, body, redirect: 'manual' });
    bgLog('WebDAV PUT response:', resp.status);
    if (resp.status === 0 || resp.type === 'opaqueredirect') {
      return { status: 0, ok: false, error: 'webdav redirect blocked' };
    }
    return { status: resp.status, ok: resp.ok };
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
        const result = await handleWebDAVPut(msg);
        return { success: true, ...result };
      } else if (msg.type === 'webdav-get') {
        const result = await handleWebDAVGet(msg);
        return { success: true, ...result };
      } else if (msg.type === 'webdav-delete') {
        const result = await handleWebDAVDelete(msg);
        return { success: true, ...result };
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
      } else if (msg.type === 'auto-backup-reset-cloud') {
        // Ticket #126: an explicit credential deletion removes the saved target.
        // Clear only cloud identity; local snapshot history and the opt-in stay.
        const core = await ensureSnapshotCore();
        const latest = await bgReadAutoBackupState();
        const next = await bgWriteAutoBackupState({
          ...latest,
          cloud: core.defaultCloudState(),
          updatedAt: Date.now(),
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

  // Ticket #126: mirror ntp/sync-engine.js buildSyncPayload() for the unattended
  // Gist body. The allowlist sanitizer already excludes credentials; syncLevel is
  // the user's existing choice and must not be widened by the background path.
  function swBuildSyncPayload(rawLayout) {
    const clean = swSanitizeLayoutForBackup(rawLayout);
    const settings = swIsPlainObj(rawLayout) && swIsPlainObj(rawLayout.settings) ? rawLayout.settings : {};
    const level = settings.syncLevel === 'settingsOnly' || settings.syncLevel === 'boxesOnly'
      ? settings.syncLevel
      : 'full';
    if (level === 'settingsOnly') {
      clean.boxes = [];
      clean.connections = [];
      return clean;
    }
    if (level === 'boxesOnly') {
      clean.settings = null;
      return clean;
    }
    return clean;
  }
  root.__boxingSwBuildSyncPayload = swBuildSyncPayload;

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
