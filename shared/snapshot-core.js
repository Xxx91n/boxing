// Boxing — shared split-key snapshot & auto-backup scheduling core.
// Classic UMD-lite IIFE: works via importScripts() (Chrome classic SW),
// dynamic import() (Firefox module background), <script src> (NTP / Demo),
// and CommonJS require() in unit tests.
(function (root) {
  'use strict';

  const SNAP_KEY_PREFIX = 'snap.v1.';
  const SNAP_INDEX_KEY = 'snap.v1.index';
  // UTF-16 length limits matching legacy ntp/storage.js contract (#41 / #71).
  const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
  const MAX_SNAPSHOTS_TOTAL_BYTES = 8 * 1024 * 1024;
  const HOUR_MS = 3600000;
  const DAY_MS = 86400000;
  const HOURLY_WINDOW_MS = 24 * HOUR_MS;
  const DAILY_WINDOW_MS = 30 * DAY_MS;
  const RAW_KEEP_FLOOR = 10;
  const MAX_SNAPSHOT_COUNT = 30;

  const AUTO_BACKUP_STATE_KEY = 'autoBackupState';
  const AUTO_BACKUP_ALARM_NAME = 'boxing-auto-backup';
  const ALLOWED_AUTO_BACKUP_INTERVALS = Object.freeze([0, 3600, 86400, 604800]);
  const AUTO_BACKUP_LOCK_TTL_MS = 30000;
  const MIN_AUTO_BACKUP_INTERVAL_SEC = 3600;

  const hourlyBucket = (ts) => Math.floor(ts / HOUR_MS);
  const dailyBucket = (ts) => Math.floor(ts / DAY_MS);
  const weeklyBucket = (ts) => Math.floor(ts / (7 * DAY_MS));

  // Per-storage migration cache + in-flight dedupe + write serialization.
  const migratedStorages = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  const migratingStorages = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  const writeQueues = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  let lastSnapTs = 0;

  function enqueueStorageOp(storage, fn) {
    if (!writeQueues || !storage || typeof storage !== 'object') return fn();
    const prev = writeQueues.get(storage) || Promise.resolve();
    const next = prev.then(fn, fn);
    const tail = next.then(() => undefined, () => undefined);
    writeQueues.set(storage, tail);
    return next;
  }

  function isPlainObject(v) {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  function nextMonotonicTs(existingIndex, nowMs) {
    const baseNow = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now();
    let maxExisting = 0;
    if (Array.isArray(existingIndex)) {
      for (const row of existingIndex) {
        if (row && typeof row.ts === 'number' && row.ts > maxExisting) {
          maxExisting = row.ts;
        }
      }
    }
    let ts = baseNow;
    if (ts <= lastSnapTs) ts = lastSnapTs + 1;
    if (ts <= maxExisting) ts = maxExisting + 1;
    lastSnapTs = ts;
    return ts;
  }

  async function readIndexWithAdapter(storage, indexKey) {
    const key = indexKey || SNAP_INDEX_KEY;
    const stored = await storage.get(key);
    const v = stored && stored[key];
    return Array.isArray(v) ? v : [];
  }

  async function writeIndexWithAdapter(storage, index, indexKey) {
    const key = indexKey || SNAP_INDEX_KEY;
    await storage.set({ [key]: index });
  }

  async function rotateAndWriteIndexWithAdapter(storage, index, ns) {
    const opts = ns || {};
    const keyPrefix = opts.keyPrefix || SNAP_KEY_PREFIX;
    const indexKey = opts.indexKey || SNAP_INDEX_KEY;
    const countCap = opts.countCap || MAX_SNAPSHOT_COUNT;
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const sorted = (Array.isArray(index) ? index : []).slice().sort((a, b) => a.ts - b.ts);
    const floor = sorted.slice(Math.max(0, sorted.length - RAW_KEEP_FLOOR));
    const older = sorted.slice(0, Math.max(0, sorted.length - RAW_KEEP_FLOOR));
    const tiers = { hourly: [], daily: [], weekly: [] };
    for (const e of older) {
      const age = now - e.ts;
      if (age <= HOURLY_WINDOW_MS) tiers.hourly.push(e);
      else if (age <= DAILY_WINDOW_MS) tiers.daily.push(e);
      else tiers.weekly.push(e);
    }
    const dedup = (entries, bucketFn) => {
      const map = new Map();
      for (const e of entries) {
        const b = bucketFn(e.ts);
        const existing = map.get(b);
        if (!existing || e.ts > existing.ts) map.set(b, e);
      }
      return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
    };
    const kept = opts.tiers === false
      ? sorted.slice()
      : []
          .concat(dedup(tiers.hourly, hourlyBucket))
          .concat(dedup(tiers.daily, dailyBucket))
          .concat(dedup(tiers.weekly, weeklyBucket))
          .concat(floor);
    kept.sort((a, b) => a.ts - b.ts);
    while (kept.length > countCap) kept.shift();
    let totalBytes = kept.reduce((s, e) => s + (e.size || 0), 0);
    while (kept.length > 1 && totalBytes > MAX_SNAPSHOTS_TOTAL_BYTES) {
      totalBytes -= (kept.shift().size || 0);
    }
    const keptTs = new Set(kept.map((e) => e.ts));
    await writeIndexWithAdapter(storage, kept, indexKey);
    for (const e of index) {
      if (!keptTs.has(e.ts)) {
        try {
          if (typeof storage.remove === 'function') {
            await storage.remove(keyPrefix + e.ts);
          }
        } catch (_) {
          // Non-fatal: unreferenced orphan body
        }
      }
    }
    return kept;
  }

  async function migrateSnapshotsWithAdapter(storage, opts) {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') return;
    if (migratedStorages && migratedStorages.has(storage)) return;
    if (migratingStorages && migratingStorages.has(storage)) return migratingStorages.get(storage);

    const log = (opts && typeof opts.log === 'function') ? opts.log : null;
    const errorLog = (opts && typeof opts.errorLog === 'function') ? opts.errorLog : null;

    const task = (async () => {
      const stored = await storage.get({ boxingSnapshots: null });
      const oldSnaps = Array.isArray(stored && stored.boxingSnapshots) ? stored.boxingSnapshots : [];
      if (oldSnaps.length > 0) {
        if (log) log('Migrating ' + oldSnaps.length + ' boxingSnapshots[] to split keys');
        const index = await readIndexWithAdapter(storage, SNAP_INDEX_KEY);
        const keysToSet = {};
        for (const snap of oldSnaps) {
          if (!snap || typeof snap.ts !== 'number') continue;
          const snapJson = JSON.stringify(snap);
          if (snapJson.length > MAX_SNAPSHOT_BYTES) continue;
          const key = SNAP_KEY_PREFIX + snap.ts;
          keysToSet[key] = snap;
          if (!index.some((e) => e && e.ts === snap.ts)) {
            index.push({ ts: snap.ts, schemaVersion: snap.schemaVersion || 1, size: snapJson.length });
          }
        }
        if (Object.keys(keysToSet).length > 0) {
          await storage.set(keysToSet);
        }
        index.sort((a, b) => a.ts - b.ts);
        await rotateAndWriteIndexWithAdapter(storage, index);
        try {
          if (typeof storage.remove === 'function') await storage.remove('boxingSnapshots');
        } catch (_) {
          // Non-fatal: monolith removal retries on later boot
        }
        if (log) log('Snapshot migration complete: ' + index.length + ' entries');
      }
      if (migratedStorages) migratedStorages.add(storage);
    })();

    if (migratingStorages) migratingStorages.set(storage, task);
    try {
      await task;
    } catch (e) {
      if (migratingStorages) migratingStorages.delete(storage);
      if (errorLog) errorLog('_migrateSnapshots', e);
      throw e;
    }
    if (migratingStorages) migratingStorages.delete(storage);
  }

  function saveSnapshotWithAdapter(storage, rawLayout, opts) {
    const options = opts || {};
    const log = typeof options.log === 'function' ? options.log : null;
    const errorLog = typeof options.errorLog === 'function' ? options.errorLog : null;
    const sanitizeLayout = typeof options.sanitizeLayout === 'function'
      ? options.sanitizeLayout
      : (x) => x;
    const returnDetails = Boolean(options.returnDetails);

    return enqueueStorageOp(storage, async () => {
      try {
        if (!isPlainObject(rawLayout)) {
          const msg = 'Invalid layout object for snapshot';
          return returnDetails ? { ok: false, reason: 'invalid-layout', error: msg } : null;
        }
        await migrateSnapshotsWithAdapter(storage, options);
        const index = await readIndexWithAdapter(storage, SNAP_INDEX_KEY);
        const ts = nextMonotonicTs(index, options.now);
        const snap = {
          ts,
          schemaVersion: Number(rawLayout.schemaVersion) || 1,
          data: sanitizeLayout(rawLayout),
        };
        if (options.reason) snap.reason = String(options.reason);
        const snapJson = JSON.stringify(snap);
        if (snapJson.length > MAX_SNAPSHOT_BYTES) {
          const msg = 'Snapshot skipped: single snapshot ' + snapJson.length + 'B exceeds cap ' + MAX_SNAPSHOT_BYTES;
          if (log) log(msg);
          return returnDetails ? { ok: false, reason: 'oversize', error: msg, size: snapJson.length } : null;
        }
        const key = SNAP_KEY_PREFIX + ts;
        await storage.set({ [key]: snap });
        index.push({ ts, schemaVersion: snap.schemaVersion, size: snapJson.length });
        const kept = await rotateAndWriteIndexWithAdapter(storage, index, { now: options.now });
        if (log) {
          log(
            'Snapshot saved' + (options.reason ? ' (' + options.reason + ')' : '') +
            ', total=' + kept.length + ' entries, bytes~' +
            kept.reduce((s, e) => s + (e.size || 0), 0)
          );
        }
        return returnDetails
          ? { ok: true, ts, size: snapJson.length, total: kept.length }
          : ts;
      } catch (e) {
        if (errorLog) errorLog('saveSnapshot', e);
        const msg = e && e.message ? e.message : String(e || 'Snapshot storage error');
        return returnDetails ? { ok: false, reason: 'storage-error', error: msg } : null;
      }
    });
  }

  async function listSnapshotsWithAdapter(storage, opts) {
    const options = opts || {};
    const errorLog = typeof options.errorLog === 'function' ? options.errorLog : null;
    try {
      await migrateSnapshotsWithAdapter(storage, options);
      return await readIndexWithAdapter(storage, SNAP_INDEX_KEY);
    } catch (e) {
      if (errorLog) errorLog('listSnapshots', e);
      return [];
    }
  }

  async function getSnapshotBodyWithAdapter(storage, ts) {
    try {
      const key = SNAP_KEY_PREFIX + Number(ts);
      const stored = await storage.get(key);
      return (stored && stored[key]) || null;
    } catch (_) {
      return null;
    }
  }

  async function getLatestSnapshotWithAdapter(storage, opts) {
    const options = opts || {};
    const errorLog = typeof options.errorLog === 'function' ? options.errorLog : null;
    try {
      await migrateSnapshotsWithAdapter(storage, options);
      const index = await readIndexWithAdapter(storage, SNAP_INDEX_KEY);
      if (index.length === 0) return null;
      const latest = index[index.length - 1];
      return await getSnapshotBodyWithAdapter(storage, latest.ts);
    } catch (e) {
      if (errorLog) errorLog('getLatestSnapshot', e);
      return null;
    }
  }

  // ── Auto-backup state & scheduler normalization ───────────────────────────
  function normalizeAutoBackupInterval(value) {
    const n = Number(value);
    return ALLOWED_AUTO_BACKUP_INTERVALS.includes(n) ? n : 0;
  }

  // Cloud result is independent from the local snapshot result (ticket #126 /
  // spec #120 D6). Only fields needed to resume or explain an unattended Gist
  // first-create live here; no credential, token, or backup body ever enters it.
  function defaultCloudState() {
    return {
      provider: '',
      status: 'idle',
      lastAttemptAt: 0,
      lastSuccessAt: 0,
      lastError: null,
      lastErrorCode: null,
      account: null,
      baseline: null,
      pendingCreate: null,
    };
  }

  // A present-but-malformed account/baseline/pending marker must still block the
  // unattended path. Returning null here would re-open the "create a fresh Gist"
  // branch on corrupt state, which is exactly the duplicate the ticket forbids.
  function normalizeCloudAccount(raw) {
    if (!isPlainObject(raw)) return null;
    const login = typeof raw.login === 'string' ? raw.login.trim().slice(0, 100) : '';
    const id = (typeof raw.id === 'number' && Number.isFinite(raw.id))
      ? raw.id
      : (typeof raw.id === 'string' && /^\d{1,20}$/.test(raw.id) ? raw.id : '');
    return { login, id };
  }

  function normalizeCloudBaseline(raw) {
    if (!isPlainObject(raw)) return null;
    if (raw.provider !== 'gist') return null;
    const gistId = typeof raw.gistId === 'string' && /^[a-f0-9]{5,64}$/i.test(raw.gistId)
      ? raw.gistId.toLowerCase()
      : '';
    const fileName = typeof raw.fileName === 'string' ? raw.fileName.trim().slice(0, 512) : '';
    const owner = normalizeCloudAccount({ login: raw.ownerLogin, id: raw.ownerId });
    return {
      provider: 'gist',
      gistId,
      fileName,
      ownerLogin: owner ? owner.login : '',
      ownerId: owner ? owner.id : '',
      createdAt: Math.max(0, Number(raw.createdAt) || 0),
      updatedAt: Math.max(0, Number(raw.updatedAt) || 0),
      verifiedAt: Math.max(0, Number(raw.verifiedAt) || 0),
    };
  }

  function normalizeCloudPendingCreate(raw) {
    if (!isPlainObject(raw) || raw.provider !== 'gist') return null;
    // Keep the marker even if its file name is missing; the plan only needs the
    // marker to pause, and a malformed marker must not authorize a second POST.
    const fileName = typeof raw.fileName === 'string' && raw.fileName.trim()
      ? raw.fileName.trim().slice(0, 512)
      : 'boxing-backup.json';
    const gistId = typeof raw.gistId === 'string' && /^[a-f0-9]{5,64}$/i.test(raw.gistId)
      ? raw.gistId.toLowerCase()
      : '';
    return {
      provider: 'gist',
      fileName,
      description: typeof raw.description === 'string' ? raw.description.slice(0, 200) : '',
      startedAt: Math.max(0, Number(raw.startedAt) || 0),
      accountLogin: typeof raw.accountLogin === 'string' ? raw.accountLogin.slice(0, 100) : '',
      accountId: (typeof raw.accountId === 'number' && Number.isFinite(raw.accountId))
        ? raw.accountId
        : (typeof raw.accountId === 'string' && /^\d{1,20}$/.test(raw.accountId) ? raw.accountId : ''),
      gistId,
    };
  }

  function normalizeCloudState(raw) {
    const dflt = defaultCloudState();
    if (!isPlainObject(raw)) return dflt;
    const provider = raw.provider === 'gist' || raw.provider === 'webdav' ? raw.provider : '';
    const allowedStatus = ['idle', 'running', 'ok', 'paused', 'error', 'pending'];
    const status = allowedStatus.includes(raw.status) ? raw.status : 'idle';
    return {
      provider,
      status,
      lastAttemptAt: Math.max(0, Number(raw.lastAttemptAt) || 0),
      lastSuccessAt: Math.max(0, Number(raw.lastSuccessAt) || 0),
      lastError: typeof raw.lastError === 'string' && raw.lastError ? raw.lastError.slice(0, 300) : null,
      lastErrorCode: typeof raw.lastErrorCode === 'string' && raw.lastErrorCode ? raw.lastErrorCode.slice(0, 64) : null,
      account: normalizeCloudAccount(raw.account),
      baseline: normalizeCloudBaseline(raw.baseline),
      pendingCreate: normalizeCloudPendingCreate(raw.pendingCreate),
    };
  }

  function defaultAutoBackupState() {
    return {
      version: 1,
      optIn: false,
      intervalSec: 0,
      epoch: 0,
      nextScheduledAt: 0,
      updatedAt: 0,
      local: {
        status: 'idle',
        lastAttemptAt: 0,
        lastSuccessAt: 0,
        lastSnapshotTs: 0,
        lastError: null,
      },
      cloud: defaultCloudState(),
      lock: null,
    };
  }

  function normalizeAutoBackupState(raw) {
    const dflt = defaultAutoBackupState();
    if (!isPlainObject(raw)) return dflt;
    const rawLocal = isPlainObject(raw.local) ? raw.local : {};
    const intervalSec = normalizeAutoBackupInterval(raw.intervalSec);
    const optIn = raw.optIn === true && intervalSec >= MIN_AUTO_BACKUP_INTERVAL_SEC;
    const rawStatus = typeof rawLocal.status === 'string' ? rawLocal.status : 'idle';
    const allowedStatus = ['idle', 'running', 'ok', 'error', 'cancelled'];
    const status = allowedStatus.includes(rawStatus) ? rawStatus : 'idle';
    let lock = null;
    if (isPlainObject(raw.lock) && typeof raw.lock.ownerId === 'string' && raw.lock.ownerId) {
      const acquiredAt = Number(raw.lock.acquiredAt) || 0;
      const expiresAt = Number(raw.lock.expiresAt) || 0;
      const lockEpoch = Number(raw.lock.epoch) || 0;
      if (expiresAt > 0) {
        lock = { ownerId: raw.lock.ownerId, epoch: lockEpoch, acquiredAt, expiresAt };
      }
    }
    return {
      version: 1,
      optIn,
      intervalSec: optIn ? intervalSec : 0,
      epoch: Math.max(0, Math.floor(Number(raw.epoch) || 0)),
      nextScheduledAt: optIn ? Math.max(0, Number(raw.nextScheduledAt) || 0) : 0,
      updatedAt: Math.max(0, Number(raw.updatedAt) || 0),
      local: {
        status,
        lastAttemptAt: Math.max(0, Number(rawLocal.lastAttemptAt) || 0),
        lastSuccessAt: Math.max(0, Number(rawLocal.lastSuccessAt) || 0),
        lastSnapshotTs: Math.max(0, Number(rawLocal.lastSnapshotTs) || 0),
        lastError: typeof rawLocal.lastError === 'string' && rawLocal.lastError ? rawLocal.lastError : null,
      },
      cloud: normalizeCloudState(raw.cloud),
      lock,
    };
  }

  function isAutoBackupActive(state) {
    const norm = normalizeAutoBackupState(state);
    return norm.optIn === true && norm.intervalSec >= MIN_AUTO_BACKUP_INTERVAL_SEC;
  }

  function isAutoBackupOverdue(state, nowMs) {
    const norm = normalizeAutoBackupState(state);
    if (!isAutoBackupActive(norm)) return false;
    const now = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now();
    // Interrupted run whose lease lock is missing or expired must catch up immediately.
    if (norm.local.status === 'running' && (!norm.lock || norm.lock.expiresAt <= now)) {
      return true;
    }
    if (!norm.nextScheduledAt) return true;
    return now >= norm.nextScheduledAt;
  }

  function computeAlarmDelayMinutes(state, nowMs) {
    const norm = normalizeAutoBackupState(state);
    if (!isAutoBackupActive(norm)) return 0;
    const now = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now();
    const periodMin = Math.max(1, Math.ceil(norm.intervalSec / 60));
    if (norm.nextScheduledAt > now) {
      return Math.max(1, Math.ceil((norm.nextScheduledAt - now) / 60000));
    }
    return periodMin;
  }

  const exported = {
    SNAP_KEY_PREFIX,
    SNAP_INDEX_KEY,
    MAX_SNAPSHOT_BYTES,
    MAX_SNAPSHOTS_TOTAL_BYTES,
    HOUR_MS,
    DAY_MS,
    HOURLY_WINDOW_MS,
    DAILY_WINDOW_MS,
    RAW_KEEP_FLOOR,
    MAX_SNAPSHOT_COUNT,
    AUTO_BACKUP_STATE_KEY,
    AUTO_BACKUP_ALARM_NAME,
    ALLOWED_AUTO_BACKUP_INTERVALS,
    AUTO_BACKUP_LOCK_TTL_MS,
    MIN_AUTO_BACKUP_INTERVAL_SEC,
    readIndexWithAdapter,
    writeIndexWithAdapter,
    rotateAndWriteIndexWithAdapter,
    migrateSnapshotsWithAdapter,
    saveSnapshotWithAdapter,
    listSnapshotsWithAdapter,
    getSnapshotBodyWithAdapter,
    getLatestSnapshotWithAdapter,
    normalizeAutoBackupInterval,
    defaultAutoBackupState,
    defaultCloudState,
    normalizeCloudState,
    normalizeAutoBackupState,
    isAutoBackupActive,
    isAutoBackupOverdue,
    computeAlarmDelayMinutes,
  };

  if (root) root.__boxingSnapshotCore = exported;
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = exported;
  }
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
