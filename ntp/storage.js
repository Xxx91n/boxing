// Boxing — storage write facade module (ticket 07, architecture-recovery).
// Single write gate for chrome.storage on the NTP side: the serial write chain
// (storageWriteChain), the cross-tab loop guard (applyingExternalLayout) and the
// storage.onChanged listener registration were moved here VERBATIM as one piece
// (WORKFLOW §6: 写链/防回环/onChanged 严禁拆散到多模块, 拆散即引入竞态).
// All boxingLayout writes flow through this module:
//   - saveLayout()/saveLayoutDebounced() — chained merge writes; the SEC-08 debounced
//     vs direct call-site classification is unchanged (AGENTS.md SEC-08).
//   - directSetBoxingLayout() — the deliberate no-merge/no-chain bypass used by the
//     WebDAV data-loss-restore / first-pull / newer-cloud-pull flows (call sites keep
//     their "Direct write" comments).
//   - loadLayout() legacy migration + saveSnapshot() — facade-internal writes.
// Storage area selection untouched: chrome.storage.local is deliberate.
// Cross-scope ntp.js functions (log trio + render pipeline) are injected once via
// initStorageFacade(); moved bodies stay byte-identical to their origin (WORKFLOW §6
// byte-exact rule). State variables remain state.js singletons — after this ticket the
// facade is their ONLY writer (setStorageWriteChain/setApplyingExternalLayout/setSaveDebounceTimer).

import {
  MAX_TOMBSTONES, __selfLastWriteTs, applyingExternalLayout, boxConnIdx, clearedTombstones,
  connIdx, currentLargeBoxId, headerPinned, innerPanX, innerPanY, innerZoom, layout, panState,
  saveDebounceTimer, setApplyingExternalLayout, setCurrentLargeBoxId, setInnerPanX, setInnerPanY,
  setInnerZoom, setLayout, setSaveDebounceTimer, setStorageWriteChain, storageWriteChain, writerId,
} from './state.js';
import { defaultLayout, isPlausibleLayout, mergeById, migrateLayout, normalizeDarkModePref } from './utils.js';

// ── injected ntp.js-scope bindings (assigned once by initStorageFacade, before any call) ──
let api = null;
let layoutStorage = null;
let mirrorWriter = null; // ticket 60: paint-critical boot mirror writer (persist.js facade)
let debug, debugErr, debugWarn, persistViewState, pruneConnArrays, rebuildBoxMaps, markDsuDirty, ensureGroups, dsuRebuildFromConnections, getLargeBox, renderCanvas, renderInnerSurface, renderCrumbs, updateCaption, applyInnerTransform, renderConnections, syncSettingsDOM, showBoxDeletedWarning;
// the single dark-mode apply path, INJECTED (not imported). storage.js is
// a leaf module (import-graph-guard B-1 forbids sibling imports), and the write
// chain / loop guard / onChanged listener stay as one inseparable unit here —
// moving the listener elsewhere to reach a helper directly would violate WORKFLOW §6.
// Facade injection is the established pattern for exactly this constraint.
let applyDarkMode = null;

export function initStorageFacade(deps) {
  api = deps.api;
  layoutStorage = api.storage.local;  // A6: storage.local (10MB / unlimited) vs sync 100KB quota
  mirrorWriter = deps.mirrorWriter; // ticket 60: boot mirror writer (localStorage, sync-readable first paint)
  applyDarkMode = deps.applyDarkMode; // single dark-mode apply path (persist.js)
  debug = deps.debug;
  debugErr = deps.debugErr;
  debugWarn = deps.debugWarn;
  persistViewState = deps.persistViewState;
  pruneConnArrays = deps.pruneConnArrays;
  rebuildBoxMaps = deps.rebuildBoxMaps;
  markDsuDirty = deps.markDsuDirty;
  ensureGroups = deps.ensureGroups;
  dsuRebuildFromConnections = deps.dsuRebuildFromConnections;
  getLargeBox = deps.getLargeBox;
  renderCanvas = deps.renderCanvas;
  renderInnerSurface = deps.renderInnerSurface;
  renderCrumbs = deps.renderCrumbs;
  updateCaption = deps.updateCaption;
  applyInnerTransform = deps.applyInnerTransform;
  renderConnections = deps.renderConnections;
  syncSettingsDOM = deps.syncSettingsDOM;
  showBoxDeletedWarning = deps.showBoxDeletedWarning;
}

// Direct write path (SEC-08 'direct' class): replaces the stored boxingLayout without
// merging and without enqueueing the write chain — the deliberate bypass kept intact
// from ntp.js; callers retain their own try/catch + debugErr with per-flow messages.
export function directSetBoxingLayout(persisted) {
  return layoutStorage.set({ boxingLayout: persisted });
}

// autoBackupDue is a storage.local coordination flag written by the
// service worker and consumed by the NTP. It is not boxingLayout state, but the
// write path still routes through this facade (data-golden gate 2, single write
// path — direct chrome.storage.* writes outside storage.js are violations).
export function clearAutoBackupDue() {
  return layoutStorage.remove('autoBackupDue');
}

// storage.onChanged listener registration — moved verbatim from ntp.js init() (same
// registration point in the boot sequence). External boxingLayout changes feed
// applyExternalLayout, whose applyingExternalLayout guard below prevents
// write → onChanged → write loops.
export function registerStorageOnChanged() {
    api.storage.onChanged?.addListener?.((changes, areaName) => {
      const expectedArea = layoutStorage === api.storage.local ? 'local' : 'sync';
      if (areaName !== expectedArea || !changes.boxingLayout?.newValue) return;
      applyExternalLayout(changes.boxingLayout.newValue);
    });
}

// ═══════════════════════════════════════════════════════════
// Moved verbatim from ntp.js (ticket 07) — byte-exact except `export` prefixes.
// Origin line refs (pre-move ntp.js): storage/load/snapshots L362-432,
// merge/persist-helpers/write-chain L543-672, applyExternalLayout L3565-3644.
// ═══════════════════════════════════════════════════════════

  // ── storage ────────────────────────────────────────────
  export async function loadLayout() {
    let corruptRaw = null;    // 43 fork: 捕获可读但损坏的主键载荷（catch 作用域拿不到 try 内的 data）
    let corruptErr = null;
    try {
      const data = await layoutStorage.get({ boxingLayout: null });
      if (data.boxingLayout) {
        if (!isPlausibleLayout(data.boxingLayout)) {
          corruptRaw = data.boxingLayout;
          corruptErr = new Error('boxingLayout failed integrity check (readable but not a layout)');
        } else {
          try {
            setLayout(migrateLayout(data.boxingLayout));
          } catch (migrateErr) {
            // The payload is readable but the migration rejected it. Keep it so the
            // corrupt-payload fork archives it before the recovery write replaces
            // the main key; without this the catch below sees corruptRaw === null.
            corruptRaw = data.boxingLayout;
            throw migrateErr;
          }
        }
      } else {
        const legacy = layoutStorage === api.storage.sync ? data : await api.storage.sync.get({ boxingLayout: null });
        if (legacy.boxingLayout) {
          if (!isPlausibleLayout(legacy.boxingLayout)) {
            // 43R: 损坏 legacy 载荷不得在归档前写回主键 —— 交给下方 fork 统一路径
            // （archiveCorruptMain → crashRescue 重建 → 持久化写回）；A6 sync cleanup
            // 同样不做（保留 sync 侧原始副本，归档轮转 20 条兜底）。
            corruptRaw = legacy.boxingLayout;
            corruptErr = new Error('legacy boxingLayout failed integrity check (readable but not a layout)');
          } else {
            try {
              setLayout(migrateLayout(legacy.boxingLayout));
            } catch (migrateErr) {
              corruptRaw = legacy.boxingLayout;
              throw migrateErr;
            }
            if (layoutStorage !== api.storage.sync) {
              await layoutStorage.set({ boxingLayout: stripGroupsForPersist(layout) });
              // A6: one-time cleanup — remove stale sync data after successful local migration
              try { await api.storage.sync.remove("boxingLayout"); } catch (e) { debugErr("storage.sync.remove stale data", e); }
            }
          }
        } else {
          setLayout(defaultLayout());
        }
      }
    } catch (e) {
      // get() 本身失败（API 层损坏/瞬态）: 载荷不可读 → 无法归档（atomcode ABP #6599 边界），仅恢复。
      debugErr('loadLayout', e);
      corruptErr = e;
    }
    if (corruptErr) {
      // 43 fork (spec D3): 先归档损坏载荷（写 boxingLayout.corrupt.<ts>，禁止无归档覆盖），
      // 再以最近健康快照重建主键并持久化写回 —— 无快照时落 defaultLayout，避免每次启动重复归档。
      if (corruptRaw !== null) await archiveCorruptMain(corruptRaw, corruptErr);
      const rescued = await crashRescue();
      setLayout(rescued || defaultLayout());
      try { await layoutStorage.set({ boxingLayout: stripGroupsForPersist(layout) }); }
      catch (e2) { debugErr('loadLayout: rebuild write-back failed', e2); }
      debugErr('loadLayout: corrupted main key forked' + (corruptRaw !== null ? ' (archived)' : ' (unreadable, not archivable)'), corruptErr);
    }
    // 41R AC7: run the one-time snapshot-key migration on the boot path itself, so an
    // upgraded profile splits its boxingSnapshots[] even if no snapshot API is ever called.
    try { await _migrateSnapshots(); } catch (e) { debugErr('loadLayout snapshot migrate', e); }
    rebuildBoxMaps();
    markDsuDirty(); // layout replaced — DSU must rebuild on first use
    try { ensureGroups(); } catch (e) { debugErr("ensureGroups after load", e); } // runtime groups mirror after load
  }

  // ── Ticket 41: Split-key snapshots + Time Machine layered rotation ───────────
  // Replaces boxingSnapshots[] single-key (Sidebery #1057 anti-pattern) with:
  //   snap.v1.<ts>  — per-snapshot body key (max 2MB each)
  //   snap.v1.index  — lightweight index: [{ts, schemaVersion, size}]
  // Rotation (spec D1): last 24h hourly, 24h–30d daily, >30d weekly; total byte cap LRU fallback.
  // Compatible with the schemaVersion field; sync transport unchanged.
  const SNAP_KEY_PREFIX = 'snap.v1.';
  const SNAP_INDEX_KEY = 'snap.v1.index';
  const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
  const MAX_SNAPSHOTS_TOTAL_BYTES = 8 * 1024 * 1024;
  const HOUR_MS = 3600000;
  const DAY_MS = 86400000;
  const HOURLY_WINDOW_MS = 24 * HOUR_MS;
  const DAILY_WINDOW_MS = 30 * DAY_MS;
  // Compatibility contract (41R): the newest N snapshots are always kept verbatim —
  // tier dedup applies beyond the floor, so saveSnapshot + restoreFromSnapshot within one
  // hour still finds every entry (strict same-hour dedup silently pruned pre-update copies).
  const RAW_KEEP_FLOOR = 10;
  export const MAX_SNAPSHOT_COUNT = 30;

  const hourlyBucket = (ts) => Math.floor(ts / HOUR_MS);
  const dailyBucket = (ts) => Math.floor(ts / DAY_MS);
  const weeklyBucket = (ts) => Math.floor(ts / (7 * DAY_MS));

  // 41R: _snapMigrated is set ONLY after a fully successful pass (a failed quota/storage
  // error retries on the next call); _snapMigrating dedupes concurrent callers.
  let _snapMigrated = false;
  let _snapMigrating = null;

  // One-time migration: boxingSnapshots[] → split keys
  async function _migrateSnapshots() {
    if (_snapMigrated) return;
    if (_snapMigrating) return _snapMigrating;
    _snapMigrating = (async () => {
      const stored = await layoutStorage.get({ boxingSnapshots: null });
      const oldSnaps = Array.isArray(stored.boxingSnapshots) ? stored.boxingSnapshots : [];
      if (oldSnaps.length > 0) {
        debug('Migrating ' + oldSnaps.length + ' boxingSnapshots[] to split keys');
        const index = await _readIndex();
        const keysToSet = {};
        for (const snap of oldSnaps) {
          if (!snap || typeof snap.ts !== 'number') continue;
          const snapJson = JSON.stringify(snap);
          if (snapJson.length > MAX_SNAPSHOT_BYTES) continue;
          const key = SNAP_KEY_PREFIX + snap.ts;
          keysToSet[key] = snap;
          if (!index.some(e => e.ts === snap.ts)) {
            index.push({ ts: snap.ts, schemaVersion: snap.schemaVersion || 1, size: snapJson.length });
          }
        }
        if (Object.keys(keysToSet).length > 0) {
          await layoutStorage.set(keysToSet);
        }
        // Remove old monolithic key
        try { await layoutStorage.remove('boxingSnapshots'); } catch (_) { /* silent: monolith removal, retry happens next boot */ }
        index.sort((a, b) => a.ts - b.ts);
        await _rotateAndWriteIndex(index);
        debug('Snapshot migration complete: ' + index.length + ' entries');
      }
      _snapMigrated = true;
    })();
    try {
      await _snapMigrating;
    } catch (e) {
      _snapMigrating = null; // allow retry — flag stays unset until success (41R AC8)
      debugErr('_migrateSnapshots', e);
    }
  }

  // Namespace-scoped so ticket 56's conflict-archive safe copies run through this same
  // rotation instead of growing a second retention engine; the defaults keep the layout
  // snapshot path byte-identical. `tiers: false` is for stores whose entries hold distinct
  // payloads (a safe copy is not a redundant sample of its bucket): only the caps prune.
  async function _readIndex(indexKey = SNAP_INDEX_KEY) {
    try {
      const stored = await layoutStorage.get(indexKey);
      const v = stored && stored[indexKey];
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }

  async function _writeIndex(index, indexKey = SNAP_INDEX_KEY) {
    await layoutStorage.set({ [indexKey]: index });
  }

  // Rotation: newest RAW_KEEP_FLOOR entries pass through verbatim; older
  // entries are tier-deduped (hourly / daily / weekly), then total-byte LRU.
  async function _rotateAndWriteIndex(index, ns = {}) {
    const keyPrefix = ns.keyPrefix || SNAP_KEY_PREFIX;
    const indexKey = ns.indexKey || SNAP_INDEX_KEY;
    const countCap = ns.countCap || MAX_SNAPSHOT_COUNT;
    const now = Date.now();
    const sorted = index.slice().sort((a, b) => a.ts - b.ts);
    const floor = sorted.slice(Math.max(0, sorted.length - RAW_KEEP_FLOOR));
    const older = sorted.slice(0, Math.max(0, sorted.length - RAW_KEEP_FLOOR));
    const tiers = { hourly: [], daily: [], weekly: [] };
    for (const e of older) {
      const age = now - e.ts;
      if (age <= HOURLY_WINDOW_MS) tiers.hourly.push(e);
      else if (age <= DAILY_WINDOW_MS) tiers.daily.push(e);
      else tiers.weekly.push(e);
    }
    // Per-tier dedup: keep newest entry per bucket
    const dedup = (entries, bucketFn) => {
      const map = new Map();
      for (const e of entries) {
        const b = bucketFn(e.ts);
        const existing = map.get(b);
        if (!existing || e.ts > existing.ts) map.set(b, e);
      }
      return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
    };
    const kept = ns.tiers === false
      ? sorted.slice()
      : [
          ...dedup(tiers.hourly, hourlyBucket),
          ...dedup(tiers.daily, dailyBucket),
          ...dedup(tiers.weekly, weeklyBucket),
          ...floor,
        ];
    kept.sort((a, b) => a.ts - b.ts);
    // Absolute count cap: drop oldest until at or under the namespace cap (snapshots: 30)
    while (kept.length > countCap) {
      const removed = kept.shift();
      try { await layoutStorage.remove(keyPrefix + removed.ts); } catch (_) { /* non-fatal */ }
    }
    // Total byte cap: drop oldest until under budget (keep at least 1)
    let totalBytes = kept.reduce((s, e) => s + (e.size || 0), 0);
    while (kept.length > 1 && totalBytes > MAX_SNAPSHOTS_TOTAL_BYTES) {
      const removed = kept.shift();
      totalBytes -= (removed.size || 0);
      try { await layoutStorage.remove(keyPrefix + removed.ts); } catch (_) { /* non-fatal */ }
    }
    // Remove pruned entries' keys that are no longer in the kept set
    const keptTs = new Set(kept.map(e => e.ts));
    for (const e of index) {
      if (!keptTs.has(e.ts)) {
        try { await layoutStorage.remove(keyPrefix + e.ts); } catch (_) { /* non-fatal */ }
      }
    }
    await _writeIndex(kept, indexKey);
    return kept;
  }

  // Ticket 50 (spec ticket 50): saveSnapshot(reason) — the optional label (e.g. 'pre-restore') is
  // written on the snapshot BODY only; snap.v1.index stays metadata-only {ts,schemaVersion,size}
  // (41R pin). Returns snap.ts on success, null when skipped (over-cap) or on storage error —
  // callers fail closed: ticket 50 forbids a full-replacement restore without a safety snapshot
  // (fail-closed semantics). Monotonic ts guard (precedent: _lastConflictTs):
  // two snapshots in one millisecond must not share a body key.
  let _lastSnapTs = 0;
  export async function saveSnapshot(reason) {
    try {
      await _migrateSnapshots();
      let ts = Date.now();
      if (ts <= _lastSnapTs) ts = _lastSnapTs + 1;
      _lastSnapTs = ts;
      const snap = {
        ts,
        schemaVersion: layout.schemaVersion || 1,
        data: stripGroupsForPersist(layout)
      };
      if (reason) snap.reason = String(reason);
      const snapJson = JSON.stringify(snap);
      if (snapJson.length > MAX_SNAPSHOT_BYTES) {
        debug('Snapshot skipped: single snapshot ' + snapJson.length + 'B exceeds cap ' + MAX_SNAPSHOT_BYTES);
        return null;
      }
      const key = SNAP_KEY_PREFIX + ts;
      await layoutStorage.set({ [key]: snap });
      const index = await _readIndex();
      index.push({ ts, schemaVersion: snap.schemaVersion, size: snapJson.length });
      const kept = await _rotateAndWriteIndex(index);
      debug('Snapshot saved' + (reason ? ' (' + reason + ')' : '') + ', total=' + kept.length + ' entries, bytes~' +
        kept.reduce((s, e) => s + (e.size || 0), 0));
      return ts;
    } catch (e) { debugErr('saveSnapshot', e); return null; }
  }

  async function getLatestSnapshot() {
    try {
      await _migrateSnapshots();
      const index = await _readIndex();
      if (index.length === 0) return null;
      const latest = index[index.length - 1];
      const key = SNAP_KEY_PREFIX + latest.ts;
      const stored = await layoutStorage.get(key);
      return (stored && stored[key]) || null;
    } catch (e) { debugErr('getLatestSnapshot', e); return null; }
  }

  export async function listSnapshots() {
    try {
      await _migrateSnapshots();
      return await _readIndex();
    } catch (e) { debugErr('listSnapshots', e); return []; }
  }

  async function _getSnapshotBody(ts) {
    try {
      const key = SNAP_KEY_PREFIX + ts;
      const stored = await layoutStorage.get(key);
      return (stored && stored[key]) || null;
    } catch (_) { return null; }
  }

  export async function restoreFromSnapshot(ts) {
    try {
      await _migrateSnapshots();
      const snap = await _getSnapshotBody(ts);
      if (!snap || !snap.data) {
        debug('restoreFromSnapshot: no snapshot at ts=' + ts);
        return null;
      }
      const recovered = migrateLayout(snap.data);
      debug('restoreFromSnapshot: recovered from ts=' + ts +
        ' @' + new Date(snap.ts).toISOString());
      return recovered;
    } catch (e) {
      debugErr('restoreFromSnapshot', e);
      return null;
    }
  }

  // Ticket 50 (spec ticket 50): the full-replacement write leg of a restore (Time Machine rollback).
  // Deliberately bypasses mergeConcurrentLayout — a cross-tab merge would resurrect the
  // replaced-away boxes from storage and break rollback ("restore to point" must be exact).
  // Keeps the two write-path invariants that still matter:
  //   - corrupt-payload fork: a corrupt-but-readable stored payload is archived before the overwrite;
  //   - revision continues above the stored value, so other tabs' applyExternalLayout gate
  //     still orders correctly.
  // In-memory layout is replaced only after the write resolves (fail closed on quota errors).
  export async function replaceLayoutFromRestored(recovered) {
    const stored = await layoutStorage.get({ boxingLayout: null });
    if (stored.boxingLayout && !isPlausibleLayout(stored.boxingLayout)) {
      await archiveCorruptMain(stored.boxingLayout, new Error('replaceLayoutFromRestored: stored boxingLayout failed integrity check'));
    }
    const storedRevision = Number(stored.boxingLayout && stored.boxingLayout._meta && stored.boxingLayout._meta.revision) || 0;
    const persisted = stripGroupsForPersist(recovered);
    persisted._meta = {
      ...(persisted._meta || {}),
      revision: Math.max(storedRevision, Number(persisted._meta && persisted._meta.revision) || 0) + 1,
      updatedAt: Date.now(),
      writerId
    };
    await layoutStorage.set({ boxingLayout: persisted });
    setLayout(persisted);
    rebuildBoxMaps();
    markDsuDirty(); // layout replaced — DSU must rebuild on first use
    try { ensureGroups(); } catch (e) { debugErr('ensureGroups after restore', e); }
    return persisted;
  }

  async function crashRescue() {
    const snap = await getLatestSnapshot();
    if (!snap || !snap.data) { debug('crashRescue: no snapshot available'); return null; }
    try {
      const recovered = migrateLayout(snap.data);
      debug('crashRescue: recovered from snapshot @' + new Date(snap.ts).toISOString());
      return recovered;
    } catch (e) {
      debugErr('crashRescue: snapshot also corrupt', e);
      return null;
    }
  }

  // ── Ticket 43 (spec D3): corrupt-main-key fork ──────────────────────────────
  // 损坏主键禁止无归档覆盖: 原载荷 verbatim 归档到 boxingLayout.corrupt.<ts>（含崩溃
  // 上下文元数据），主键再从最近健康快照重建（Dropbox conflicted copy / 1Password
  // item-history 的 fork 语义, atomcode 2026-09-11）。索引键 boxingLayout.corrupt.index
  // 只存轻量元数据（设置页数据区展示入口用, 不拉快照体）。隔离区上限 20 条, 超限淘汰
  // 最旧（atomcode: 隔离键也计入配额, 必须有容量上限）; 单条归档沿用 MAX_SNAPSHOT_BYTES
  // 2MB 上限, 超限降级为仅元数据（truncated）, 与 SEC-06 防 OOM 精神一致。
  const CORRUPT_PREFIX = 'boxingLayout.corrupt.';
  const CORRUPT_INDEX_KEY = 'boxingLayout.corrupt.index';
  const MAX_CORRUPT_ARCHIVES = 20;

  async function _readCorruptIndex() {
    try {
      const stored = await layoutStorage.get(CORRUPT_INDEX_KEY);
      const v = stored && stored[CORRUPT_INDEX_KEY];
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }

  async function archiveCorruptMain(raw, error) {
    try {
      const ts = Date.now();
      const entry = { ts, error: String((error && error.message) || error || 'corrupt main key') };
      let payloadJson = '';
      try { payloadJson = JSON.stringify(raw === undefined ? null : raw); } catch (_) { payloadJson = ''; }
      if (payloadJson && payloadJson.length <= MAX_SNAPSHOT_BYTES) {
        entry.raw = raw; // verbatim — 验收项: 归档后仍可从 storage 读出
        entry.size = payloadJson.length;
      } else {
        entry.truncated = true; // 超限只留元数据, 不写大载荷
        entry.size = payloadJson ? payloadJson.length : 0;
      }
      await layoutStorage.set({ [CORRUPT_PREFIX + ts]: entry });
      const index = await _readCorruptIndex();
      index.push({ ts, error: entry.error, size: entry.size, truncated: !!entry.truncated });
      index.sort((a, b) => a.ts - b.ts);
      while (index.length > MAX_CORRUPT_ARCHIVES) {
        const oldest = index.shift();
        try { await layoutStorage.remove(CORRUPT_PREFIX + oldest.ts); } catch (_) { /* non-fatal */ }
      }
      await layoutStorage.set({ [CORRUPT_INDEX_KEY]: index });
      debug('Corrupt main key archived @' + new Date(ts).toISOString() + ' (archives=' + index.length + ')');
    } catch (e) { debugErr('archiveCorruptMain', e); }
  }

  export async function listCorruptArchives() {
    try { return await _readCorruptIndex(); }
    catch (e) { debugErr('listCorruptArchives', e); return []; }
  }


  // ── Ticket 44 (spec D4): conflict-copy fork ─────────────────────────────────
  // Import/sync conflicts must never silently drop a side (Dropbox conflicted copy /
  // Syncthing .sync-conflict lifecycle, atomcode 2026-09-11). The losing payload is
  // archived verbatim under boxingLayout.conflict.<ts>; boxingLayout.conflict.index
  // holds lightweight metadata for the settings data-health row. Cap and single-entry
  // byte limit mirror the corrupt archives (isolation keys count against quota).
  const CONFLICT_PREFIX = 'boxingLayout.conflict.';
  const CONFLICT_INDEX_KEY = 'boxingLayout.conflict.index';
  const MAX_CONFLICT_ARCHIVES = 20;
  let _lastConflictTs = 0; // monotonic ts guard: two archives in one ms must not share a key

  async function _readConflictIndex() {
    try {
      const stored = await layoutStorage.get(CONFLICT_INDEX_KEY);
      const v = stored && stored[CONFLICT_INDEX_KEY];
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }

  // Shared write leg of the conflict store: body key + index row + the store's own count cap.
  // Row shape is {ts, reason, side, size, boxes, truncated} — ts/reason/side/size drive the
  // settings readout, boxes and truncated are the archive's own metadata. Re-inserting a known
  // ts updates that row instead of duplicating it: ticket 56 restores a deleted archive under
  // its ORIGINAL ts, so the copy keeps the identity it had before.
  async function _writeConflictEntry(entry) {
    await layoutStorage.set({ [CONFLICT_PREFIX + entry.ts]: entry });
    const index = await _readConflictIndex();
    const row = { ts: entry.ts, reason: entry.reason, side: entry.side, size: entry.size, boxes: entry.boxes || 0, truncated: !!entry.truncated };
    const at = index.findIndex(e => e && e.ts === entry.ts);
    if (at >= 0) index[at] = row; else index.push(row);
    index.sort((a, b) => a.ts - b.ts);
    while (index.length > MAX_CONFLICT_ARCHIVES) {
      const oldest = index.shift();
      try { await layoutStorage.remove(CONFLICT_PREFIX + oldest.ts); } catch (_) { /* non-fatal */ }
    }
    await layoutStorage.set({ [CONFLICT_INDEX_KEY]: index });
    return index;
  }

  export async function archiveConflictLayouts(payload, meta) {
    try {
      let ts = Date.now();
      if (ts <= _lastConflictTs) ts = _lastConflictTs + 1;
      _lastConflictTs = ts;
      const reason = String((meta && meta.reason) || 'conflict');
      const side = String((meta && meta.side) || 'unknown');
      const entry = { ts, reason, side };
      let payloadJson = '';
      try { payloadJson = JSON.stringify(payload === undefined ? null : payload); } catch (_) { payloadJson = ''; }
      if (payloadJson && payloadJson.length <= MAX_SNAPSHOT_BYTES) {
        entry.raw = payload; // verbatim — recoverable by re-importing raw.boxes through the merge path
        entry.size = payloadJson.length;
      } else {
        entry.truncated = true; // over-cap: metadata only (SEC-06 OOM hygiene, same as corrupt archives)
        entry.size = payloadJson ? payloadJson.length : 0;
      }
      if (Array.isArray(payload && payload.boxes)) entry.boxes = payload.boxes.length;
      const index = await _writeConflictEntry(entry);
      debug('Conflict copy archived @' + new Date(ts).toISOString() + ' reason=' + reason + ' side=' + side + ' (archives=' + index.length + ')');
    } catch (e) { debugErr('archiveConflictLayouts', e); }
  }

  export async function listConflictArchives() {
    try { return await _readConflictIndex(); }
    catch (e) { debugErr('listConflictArchives', e); return []; }
  }

  // ── Ticket 79 (spec): conflict-copy readout ─────────────────────
  // Read-only single-entry getter for the settings conflict list export button.
  // Returns the verbatim archived entry (raw payload + meta) or null when the
  // body was pruned by rotation or the ts is unknown. Never writes: archive
  // semantics (archiveConflictLayouts) are untouched (issue 79 AC3).
  export async function getConflictArchive(ts) {
    try {
      const key = CONFLICT_PREFIX + Number(ts);
      const stored = await layoutStorage.get(key);
      const v = stored && stored[key];
      return v || null;
    } catch (e) { debugErr('getConflictArchive', e); return null; }
  }

  // ── Ticket 56 (spec #53 D3): conflict-archive safe copies ────────────────────
  // Deleting a conflict copy must not be the moment its only copy disappears, so the
  // VERBATIM archived payload is first written into the snapshot subsystem as its own
  // split-key body (snap.guard.v1.<ts> + snap.guard.v1.index) and only then removed from
  // the conflict store. It deliberately stays OUT of snap.v1.index: an archived conflict
  // payload is not a layout snapshot, so Time Machine listing, restoreFromSnapshot and
  // migrateLayout never see it (restoring one must not roll back the canvas).
  //
  // Retention runs the snapshot rotation code on a second namespace: the same 2MB per-body
  // ceiling and the same 8MB total-byte cap, each enforced per index, so the safe-copy store
  // adds a bounded budget of its own instead of sharing the layout snapshots' (worst case
  // +8MB against storage.local + unlimitedStorage — it cannot starve the layout legs). The
  // count cap is the conflict store's own (20) and tier dedup is OFF: unlike layout
  // snapshots, where a same-bucket entry is a redundant sample, every safe copy holds
  // distinct content, so only the count and byte caps prune here. Safe copies are therefore
  // NOT promised to live forever (#53 N2), and restoring one re-enters the conflict store
  // through the existing archive leg, inheriting that store's oldest-first pruning.
  const GUARD_KEY_PREFIX = 'snap.guard.v1.';
  const GUARD_INDEX_KEY = 'snap.guard.v1.index';
  const GUARD_NS = { keyPrefix: GUARD_KEY_PREFIX, indexKey: GUARD_INDEX_KEY, countCap: MAX_CONFLICT_ARCHIVES, tiers: false };
  let _lastGuardTs = 0; // monotonic ts guard: two safe copies in one ms must not share a key

  // Fail-closed by construction: any path that cannot land the verbatim payload returns
  // null, and deleteConflictArchive refuses to run without a returned ts. A `truncated`
  // archive (metadata only, SEC-06), a missing or null payload and an over-cap body all fail —
  // saving a stub would not be a safe copy of what is actually about to be deleted, and a
  // null-valued raw would sail through the save only to make the archive undeletable-then-
  // unrestorable later on.
  //
  // guard.size is the length of the ARCHIVED PAYLOAD, not of the guard envelope, so a restore
  // re-registers the conflict row with the exact size it had before the deletion (the readout
  // shows the same bytes either way). The stored body is then measured separately, because
  // the ceiling that matters for storage is the whole body. Like the sibling stores
  // (saveSnapshot, archiveConflictLayouts), every ceiling here counts `String.length` — UTF-16
  // code units, not UTF-8 bytes — so a non-ASCII payload is under-counted against the browser's
  // byte-based quota. That is the repo's existing convention for all three stores; changing it
  // for one namespace would make the guard's numbers disagree with the rows it protects.
  export async function saveConflictGuard(ts) {
    try {
      await _migrateSnapshots();
      const originTs = Number(ts);
      const entry = await getConflictArchive(originTs);
      if (!entry || entry.truncated || entry.raw === undefined || entry.raw === null) {
        debug('Conflict guard skipped: archive ' + originTs + ' carries no verbatim payload');
        return null;
      }
      let guardTs = Date.now();
      if (guardTs <= _lastGuardTs) guardTs = _lastGuardTs + 1;
      _lastGuardTs = guardTs;
      const guard = {
        ts: guardTs,
        originTs,
        reason: String(entry.reason || 'conflict'),
        side: String(entry.side || 'unknown'),
        raw: entry.raw
      };
      let rawJson = '';
      try { rawJson = JSON.stringify(entry.raw); } catch (_) { rawJson = ''; }
      if (!rawJson || rawJson.length > MAX_SNAPSHOT_BYTES) {
        debug('Conflict guard skipped: archived payload ' + rawJson.length + 'B exceeds cap ' + MAX_SNAPSHOT_BYTES);
        return null;
      }
      guard.size = rawJson.length;
      const guardJson = JSON.stringify(guard);
      if (guardJson.length > MAX_SNAPSHOT_BYTES) {
        debug('Conflict guard skipped: safe copy ' + guardJson.length + 'B exceeds cap ' + MAX_SNAPSHOT_BYTES);
        return null;
      }
      await layoutStorage.set({ [GUARD_KEY_PREFIX + guardTs]: guard });
      const index = await _readIndex(GUARD_INDEX_KEY);
      index.push({ ts: guardTs, originTs, size: guard.size });
      await _rotateAndWriteIndex(index, GUARD_NS);
      debug('Conflict archive guarded @' + new Date(guardTs).toISOString() + ' (origin=' + originTs + ')');
      return guardTs;
    } catch (e) { debugErr('saveConflictGuard', e); return null; }
  }

  export async function listConflictGuards() {
    try {
      await _migrateSnapshots();
      return await _readIndex(GUARD_INDEX_KEY);
    } catch (e) { debugErr('listConflictGuards', e); return []; }
  }

  export async function getConflictGuard(ts) {
    try {
      const key = GUARD_KEY_PREFIX + Number(ts);
      const stored = await layoutStorage.get(key);
      const v = stored && stored[key];
      return v || null;
    } catch (e) { debugErr('getConflictGuard', e); return null; }
  }

  // Re-inserts the protected payload into the conflict store under its ORIGINAL ts, so the
  // existing readout/export path returns it unchanged. This is the whole restore: the main
  // key, the in-memory layout and the revision are never touched — unlike a Time Machine
  // rollback there is no full-canvas replace here.
  export async function restoreConflictGuard(ts) {
    try {
      await _migrateSnapshots();
      const guard = await getConflictGuard(ts);
      if (!guard || guard.raw === undefined || guard.raw === null) {
        debug('restoreConflictGuard: no safe copy at ts=' + ts);
        return null;
      }
      const originTs = Number(guard.originTs);
      if (!Number.isFinite(originTs) || originTs <= 0) return null;
      const entry = {
        ts: originTs,
        reason: String(guard.reason || 'conflict'),
        side: String(guard.side || 'unknown'),
        raw: guard.raw,
        size: Number(guard.size) || 0
      };
      if (Array.isArray(guard.raw.boxes)) entry.boxes = guard.raw.boxes.length;
      // Restoring onto the original ts is the point of the safe copy — but every new-tab page
      // keeps its own monotonic _lastConflictTs, so an unrelated archive can already occupy
      // originTs with different bytes. Overwriting it would destroy a payload the user never
      // agreed to lose, so a conflicting occupant moves the restore elsewhere: reuse the row an
      // earlier restore of this same guard already created, otherwise a fresh ts. The occupant
      // stays untouched either way, and a second click never duplicates the content.
      const occupant = await getConflictArchive(originTs);
      if (occupant && JSON.stringify(occupant.raw) !== JSON.stringify(guard.raw)) {
        const guardJson = JSON.stringify(guard.raw);
        const rows = await _readConflictIndex();
        let alreadyTs = 0;
        for (const row of rows) {
          if (!row || !row.ts) continue;
          const body = await getConflictArchive(row.ts);
          if (body && JSON.stringify(body.raw) === guardJson) { alreadyTs = Number(row.ts); break; }
        }
        if (alreadyTs) {
          debug('Conflict archive already restored from this safe copy @ts=' + alreadyTs);
          return alreadyTs;
        }
        let freshTs = Date.now();
        if (freshTs <= _lastConflictTs) freshTs = _lastConflictTs + 1;
        _lastConflictTs = freshTs;
        entry.ts = freshTs;
      }
      await _writeConflictEntry(entry);
      // The conflict store's count cap prunes by oldest ts, so restoring an archive older than
      // every row already held can drop the row this call just wrote. Report that as a failure:
      // the archive would not be readable through the conflict list, and the store is back to
      // the rows it held before this call, so "nothing was changed" stays true for the user.
      const after = await _readConflictIndex();
      if (!after.some(e => e && e.ts === entry.ts)) {
        debug('restoreConflictGuard: restored row pruned by the archive cap (ts=' + entry.ts + ')');
        return null;
      }
      debug('Conflict archive restored from safe copy @' + new Date(entry.ts).toISOString() + ' (guard=' + Number(ts) + ')');
      return entry.ts;
    } catch (e) { debugErr('restoreConflictGuard', e); return null; }
  }

  // D3's proof obligation lives in the facade, not only in the caller: without a stored safe
  // copy of THIS archive there is nothing to delete, so a caller that skipped or lost the save
  // can never reach the removal — and the safe copy must still describe the bytes about to be
  // removed, so a same-timestamp rewrite between the save and this delete cannot let a newer
  // payload be erased while the guard holds only the older one.
  //
  // The body key goes first and the index row second: a row whose body was lost (a storage error
  // in between, or an upgrade that pruned bodies) is a state the readout already handles
  // fail-soft, while a live body whose row is gone would hide an archive the user never agreed
  // to lose. If the index write itself fails, the body is put back before returning false, so
  // "nothing was deleted" is literally true and the deletion stays retryable.
  export async function deleteConflictArchive(ts, guardTs) {
    try {
      const originTs = Number(ts);
      if (!Number.isFinite(originTs) || originTs <= 0) return false;
      const guard = await getConflictGuard(guardTs);
      if (!guard || Number(guard.originTs) !== originTs || guard.raw === undefined) {
        debug('deleteConflictArchive refused: no safe copy of ' + originTs + ' at guard ts=' + guardTs);
        return false;
      }
      const index = await _readConflictIndex();
      if (!index.some(e => e && e.ts === originTs)) return false;
      const current = await getConflictArchive(originTs);
      if (!current || JSON.stringify(current.raw) !== JSON.stringify(guard.raw)) {
        debug('deleteConflictArchive refused: archive at ' + originTs + ' no longer matches its safe copy');
        return false;
      }
      const bodyJson = JSON.stringify(current);
      await layoutStorage.remove(CONFLICT_PREFIX + originTs);
      try {
        await layoutStorage.set({ [CONFLICT_INDEX_KEY]: index.filter(e => e && e.ts !== originTs) });
      } catch (indexErr) {
        debugErr('deleteConflictArchive: index write failed, putting the archive body back', indexErr);
        try { await layoutStorage.set({ [CONFLICT_PREFIX + originTs]: JSON.parse(bodyJson) }); }
        catch (restoreErr) { debugErr('deleteConflictArchive: archive body could not be restored', restoreErr); }
        return false;
      }
      debug('Conflict copy deleted @' + new Date(originTs).toISOString() + ' (safe copy kept)');
      return true;
    } catch (e) { debugErr('deleteConflictArchive', e); return false; }
  }

  // ── Sync base slot ───────────────────────────────────────────────
  // Client-local record of the last state BOTH sides agreed on — the common
  // ancestor the sync-engine three-way merge (utils.mergeLayoutThreeWay) diffs
  // against. Written only after a clean pull/merge/push lands and NEVER uploaded
  // (Joplin sync_items.base_* model — ctx source=atomcode-91-baseline). Single
  // slot, overwritten per successful sync. Failures are soft by design: a
  // missing/unreadable base degrades the merge to the additive two-way path
  // (ticket-80 fallback contract). Read-only for callers outside sync-engine.
  const SYNC_BASE_KEY = 'boxingLayout.syncBase';
  export async function getSyncBase() {
    try {
      const stored = await layoutStorage.get(SYNC_BASE_KEY);
      const raw = stored && stored[SYNC_BASE_KEY];
      if (!isPlausibleLayout(raw)) return null;
      return raw;
    } catch (e) { debugErr('getSyncBase', e); return null; }
  }
  export async function setSyncBase(payload) {
    try {
      await layoutStorage.set({ [SYNC_BASE_KEY]: payload });
      return true;
    } catch (e) { debugWarn('setSyncBase failed \u2014 base stays stale; next merge degrades to two-way', e); return false; }
  }

  // ── Ticket 51 (spec ticket 51): full DR package bodies ───────────────────────────
  // The optional "full disaster-recovery package" export needs the VERBATIM bodies
  // behind the three index keys (snap.v1.*, boxingLayout.corrupt.*, boxingLayout.
  // conflict.*). Ticket 56's fourth split-key store (snap.guard.v1.*) is deliberately
  // NOT part of it: #53 D4 forbids extending the package's whole-package restore to new
  // history bodies, and a safe copy is recovered one archive at a time through
  // restoreConflictGuard, not by re-importing a file. The default envelope export never
  // calls this — snapshot payloads stay out of everyday backups (negative constraint).
  // Read-only facade method: returns { snapshots, corrupt, conflicts }, each oldest→newest,
  // skipping bodies already pruned from storage (index entry stays, body may be gone).
  export async function readDrBodies() {
    const out = { snapshots: [], corrupt: [], conflicts: [] };
    try {
      await _migrateSnapshots();
      const snapIndex = await _readIndex();
      for (const e of snapIndex) {
        const body = await _getSnapshotBody(e.ts);
        if (body) out.snapshots.push(body);
      }
      const corruptIndex = await _readCorruptIndex();
      for (const e of corruptIndex) {
        const key = CORRUPT_PREFIX + e.ts;
        try {
          const stored = await layoutStorage.get(key);
          const v = stored && stored[key];
          if (v) out.corrupt.push(v);
        } catch (_) { /* non-fatal: body pruned or unreadable */ }
      }
      const conflictIndex = await _readConflictIndex();
      for (const e of conflictIndex) {
        const key = CONFLICT_PREFIX + e.ts;
        try {
          const stored = await layoutStorage.get(key);
          const v = stored && stored[key];
          if (v) out.conflicts.push(v);
        } catch (_) { /* non-fatal */ }
      }
    } catch (e) { debugErr('readDrBodies', e); }
    return out;
  }



  function mergeConcurrentLayout(localValue, remoteValue) {
    debug('mergeConcurrentLayout: local='+(localValue?.boxes?.length||0)+' remote='+(remoteValue?.boxes?.length||0));
    if (!remoteValue) return localValue;
    const localDeleted = localValue._meta?.deleted || {};
    const remoteDeleted = remoteValue._meta?.deleted || {};
    let deleted = { ...remoteDeleted, ...localDeleted };
    // BX-144: in-memory clearedTombstones Set (this tab only) overrides any
    // tombstone keys coming from remote. Requires localValue to be layout —
    // the in-memory current state. When localValue === layout (saveLayout's
    // own merge), clearedTombstones applies. When localValue === incoming
    // (applyExternalLayout path where incoming wins), the local in-memory
    // set still applies because mergeConcurrentLayout only sees one in locals.
    if (localValue === layout && clearedTombstones.size > 0) {
      for (const k of Object.keys(deleted)) if (clearedTombstones.has(k)) delete deleted[k];
    }
    const tombstones = new Set(Object.keys(deleted));
    const boxes = mergeById(localValue.boxes, remoteValue.boxes, tombstones);
    // AUD-PERF: pre-index remote boxes & children by id to avoid O(N²) nested find
    // loops during cross-tab/cross-device merge (essential for engineering-scale layouts).
    const remoteBoxMap = new Map();
    for (const rb of (remoteValue.boxes || [])) if (rb?.id) remoteBoxMap.set(rb.id, rb);
    for (const localBox of boxes) {
      const remoteBox = remoteBoxMap.get(localBox.id);
      if (!remoteBox) continue;
      // layout-bypass-allow: storage-facade-merge - storage facade owns cross-tab merge write chain (expires:2027-03-31; ticket:108)
      localBox.children = mergeById(localBox.children, remoteBox.children, tombstones);
      const remoteChildMap = new Map();
      for (const rc of (remoteBox.children || [])) if (rc?.id) remoteChildMap.set(rc.id, rc);
      for (const localChild of localBox.children) {
        const remoteChild = remoteChildMap.get(localChild.id);
        // layout-bypass-allow: storage-facade-merge-bookmarks - same merge chain at bookmark level (expires:2027-03-31; ticket:108)
        if (remoteChild) localChild.bookmarks = mergeById(localChild.bookmarks, remoteChild.bookmarks, tombstones);
      }
    }
    const trimmedDeleted = Object.fromEntries(Object.entries(deleted).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, MAX_TOMBSTONES));
    // explicit merge of connections/groups — spread alone lets
    // localValue.connections=undefined (new tab, not yet initialized) overwrite
    // remoteValue.connections, silently dropping all lines cross-tab.
    const mergeByIdUnion = (localArr, remoteArr, keyField = 'id') => {
      const la = Array.isArray(localArr) ? localArr : [];
      const ra = Array.isArray(remoteArr) ? remoteArr : [];
      const map = new Map();
      // tombstone filter: drop items whose key is tombstoned (deleted cross-tab)
      // remote first so local entries overwrite on id conflict (local writes win ties)
      for (const item of ra) { if (item && item[keyField] && !tombstones.has(item[keyField])) map.set(item[keyField], item); }
      for (const item of la) { if (item && item[keyField] && !tombstones.has(item[keyField])) map.set(item[keyField], item); }
      return Array.from(map.values());
    };
    const localSettings = localValue.settings || {};
    const remoteSettings = remoteValue.settings || {};
    // Ticket 44 (spec #41): field-by-field, local-wins as before; darkMode is one
    // field like any other and is normalized after the spread (a legacy boolean from
    // either side becomes the three-valued string, never a resolved OS value).
    const darkMode = localSettings.darkMode !== undefined ? localSettings.darkMode : remoteSettings.darkMode;
    return {
      ...remoteValue,
      ...localValue,
      boxes,
      nextLargeIndex: Math.max(Number(localValue.nextLargeIndex) || 1, Number(remoteValue.nextLargeIndex) || 1),
      settings: { ...remoteSettings, ...localSettings, darkMode: normalizeDarkModePref(darkMode) },
      connections: mergeByIdUnion(localValue.connections, remoteValue.connections),
      _meta: { ...(remoteValue._meta || {}), ...(localValue._meta || {}), deleted: trimmedDeleted }
    };
  }

  // Persist helper — groups are computed-only, never persisted.
  // 66/also the single sanitize boundary for runtime-only diagnostics. Keys
  // prefixed "__" are in-memory flags, never part of the user's persisted settings;
  // they are dropped from the deep clone so src (the live layout) stays untouched.
  export const RUNTIME_ONLY_SETTING_RE = /^__/;
  export function stripGroupsForPersist(src) {
    const out = Object.assign({}, src);
    delete out.groups;
    const cloned = JSON.parse(JSON.stringify(out));
    if (cloned.settings && typeof cloned.settings === 'object') {
      // Ticket 44 (spec #41): the persisted payload always stores the three-valued
      // dark-mode preference, even if a legacy boolean reached the live layout.
      cloned.settings.darkMode = normalizeDarkModePref(cloned.settings.darkMode);
      for (const k of Object.keys(cloned.settings)) {
        if (RUNTIME_ONLY_SETTING_RE.test(k)) delete cloned.settings[k];
      }
    }
    return cloned;
  }

  // Drop tombstones older than 24h (Excalidraw soft-delete GC pattern).
  // ── Ticket 81R2: per-install credential-key (PIK) narrow storage port ──────────
// credentials.js must not touch chrome.storage directly (gate2 single-write-path scan;
// WORKFLOW §6 write-chain discipline). The PIK (boxingCredKey.v1) is a NON-layout key —
// it is deliberately outside boxingLayout so it never rides exports/sync payloads/snapshots
// (ticket 81 threat model). This port is the sanctioned access seam: pinned to the
// 'boxingCredKey.' prefix by construction, it is structurally incapable of writing
// boxingLayout, so the single-write-path invariant stays structural, not caller-discipline.
// Injection path: ntp.js init() → initCredentialsFacade({ credKeyStore }) (same facade-dep
// pattern as debugErr ticket 10 / mirrorWriter ticket 60 — credentials.js leaf untouched).
export function credKeyGet(key) {
  if (typeof key !== 'string' || !key.startsWith('boxingCredKey.')) {
    return Promise.reject(new Error('credKeyGet: only boxingCredKey.* keys allowed'));
  }
  return layoutStorage.get(key);
}
export function credKeySet(key, value) {
  if (typeof key !== 'string' || !key.startsWith('boxingCredKey.')) {
    return Promise.reject(new Error('credKeySet: only boxingCredKey.* keys allowed'));
  }
  return layoutStorage.set({ [key]: value });
}

export const TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;
  export function gcTombstones(target) {
    const del = target && target._meta && target._meta.deleted;
    if (!del) return 0;
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    let n = 0;
    for (const k of Object.keys(del)) {
      if (Number(del[k]) < cutoff) { delete del[k]; n++; }
    }
    // still honor MAX_TOMBSTONES hard cap after time GC
    const keys = Object.keys(del);
    if (keys.length > MAX_TOMBSTONES) {
      keys.sort((a, b) => Number(del[a]) - Number(del[b]));
      for (let i = 0; i < keys.length - MAX_TOMBSTONES; i++) delete del[keys[i]];
    }
    return n;
  }

  export function markDeleted(...ids) {
    const deleted = { ...(layout._meta?.deleted || {}) };
    const at = Date.now();
    for (const id of ids) if (id) deleted[id] = at;
    layout._meta = { ...(layout._meta || {}), deleted };
  }

  // Ticket 71 (N3 dr-export AC4): `saveLayout(opts)` — when
  // `opts.preserveUpdatedAt` is set, the write keeps the existing `_meta.updatedAt`
  // instead of re-stamping it to now.
  //
  // Why: `_meta.updatedAt` is the DATA timestamp — "when did the user's layout
  // content last change". Sync-provider configuration (URL / user / encrypted
  // password) lives in the same `layout.settings` object but is connection config,
  // not layout data. Persisting it through the ordinary path advanced the data
  // timestamp, so the next WebDAV sync saw `localUpdatedAt > lastSyncAt`, concluded
  // "both sides changed since the last sync", and took the concurrent-change
  // field-merge path even though only the cloud had moved. That is a phantom local
  // change, and it is what made the cloud-newer pull land as `merge` (AC4).
  // The revision still advances, so the write propagates and ordering stays
  // monotonic; only the data timestamp is held back.
  export async function saveLayout(opts) {
    setStorageWriteChain(storageWriteChain.then(async () => {
      debug('saveLayout called, boxCount=' + layout.boxes.length + ' nextLargeIndex=' + layout.nextLargeIndex);
      persistViewState(true);
      layout.settings.headerPinned = headerPinned;
      // Ticket 44 (spec #41): normalize the live value so every subsequent read and
      // the mirror see the three-valued preference, never a legacy boolean.
      layout.settings.darkMode = normalizeDarkModePref(layout.settings.darkMode);
      try { pruneConnArrays(); } catch (e) { debugErr("pruneConnArrays", e); }
      const stored = await layoutStorage.get({ boxingLayout: null });
      // 43R (spec D3): 写路径同 fork 语义 —— stored 载荷可读但非 plausible 时先归档
      // 再继续，禁止无归档覆盖。migrateLayout 对非法载荷会静默降级为 defaultLayout，
      // merge 后写回即覆盖损坏键；先 archiveCorruptMain 后，remote 视为 null（不参与
      // merge），写回的是本地内存态 —— 与 loadLayout 读路径同一语义。
      let remote = null;
      if (stored.boxingLayout) {
        if (!isPlausibleLayout(stored.boxingLayout)) {
          await archiveCorruptMain(stored.boxingLayout, new Error('saveLayout: stored boxingLayout failed integrity check'));
        } else {
          remote = migrateLayout(stored.boxingLayout);
        }
      }
      // Ticket 71 (N2 state-sync): a save-time merge can bring in boxes this
      // tab has never rendered — e.g. a box created concurrently in another tab and
      // discovered here only when saveLayout() merges the stored side. Memory and DOM
      // must not diverge, so re-render when the merge actually changed the box set.
      //
      // Cross-tab updates normally render through applyExternalLayout, but that path is
      // a no-op when the payload carries this tab's own `_meta.writerId` (merge
      // overwrites `_meta` wholesale, so a tab can end up holding a peer payload stamped
      // with its own id) and it never runs at all where storage events do not fire
      // (file:// lane). Without this render, a converged tab keeps showing a stale
      // canvas until something else happens to repaint.
      const boxSigBefore = Array.isArray(layout.boxes) ? layout.boxes.map(b => (b && b.id) || '').join('|') : '';
      setLayout(mergeConcurrentLayout(layout, remote));
      const boxSigAfter = Array.isArray(layout.boxes) ? layout.boxes.map(b => (b && b.id) || '').join('|') : '';
      if (boxSigAfter !== boxSigBefore) {
        try { renderCanvas(); } catch (e) { debugErr('saveLayout: renderCanvas after merge', e); }
      }
      const revision = Math.max(Number(layout._meta?.revision) || 0, Number(remote?._meta?.revision) || 0) + 1;
      // Ticket 71: hold the data timestamp for config-only writes (see saveLayout docs).
      const prevUpdatedAt = Number(layout._meta && layout._meta.updatedAt) || 0;
      const nextUpdatedAt = (opts && opts.preserveUpdatedAt && prevUpdatedAt) ? prevUpdatedAt : Date.now();
      layout._meta = { ...(layout._meta || {}), revision, updatedAt: nextUpdatedAt, writerId };
      // BX-AUD-04: explicit chrome.storage.local quota failure handling — sets a user-visible flag
      // and writes a emergency localStorage snapshot so data is never silently lost.
      try {
        // groups is runtime-only — never persist.
        const persisted = stripGroupsForPersist(layout);
        await layoutStorage.set({ boxingLayout: persisted });
        try { gcTombstones(layout); } catch (_gc) { /* non-fatal */ }
        if (layout.settings && layout.settings.__lastSaveError) { layout.settings.__lastSaveError = null; }
        // Ticket 60 (zero-flash): mirror paint-critical settings AFTER a successful
        // boxingLayout persist so the first paint of the next new tab is already the
        // remembered theme. Mirror is derived-only (never a second layout source);
        // failure here is fail-soft — the boot script falls back to default theme once.
        try { if (typeof mirrorWriter === 'function') mirrorWriter(); } catch (_mw) { /* non-fatal */ }
        // Settings controls only mutate the persisted value and call saveLayout;
        // replay the visual state here after durability succeeds so every toggle
        // still uses the single applyDarkMode path.
        try { if (typeof applyDarkMode === 'function') applyDarkMode(layout.settings.darkMode); } catch (_dm) { debugWarn('saveLayout applyDarkMode', _dm); }
      } catch (e) {
        debugErr('saveLayout: set failed (quota?) — writing fallback snapshot', e);
        try {
          if (layout.settings) layout.settings.__lastSaveError = (e && e.message ? e.message : String(e)) + ' @ ' + new Date().toISOString();
          localStorage.setItem('boxingLayoutFallback.v1', JSON.stringify(stripGroupsForPersist(layout)));
        } catch (_fbErr) { debugErr('saveLayout: fallback snapshot also failed', _fbErr); }
        // Rethrow so the storage-write-chain catch below records it; the next saveLayout will retry.
        throw e;
      }
      debug('saveLayout done, revision=' + revision);
    }).catch(err => { debugErr('storageWriteChain stage failed - chain kept alive', err); }));
    try { await storageWriteChain; } catch (e) { debugWarn('saveLayout', e); }
  }

  export function saveLayoutDebounced() {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    setSaveDebounceTimer(setTimeout(() => {
      setSaveDebounceTimer(null);
      saveLayout();
   }, 120));
 }

  // ── Ticket 71 (N1 data-golden gate4) ───────────────────────────
  // Canonical, order-insensitive projection of the REPLICATED USER DATA. Used for
  // one decision only: after adopting an external layout, does this tab still hold
  // anything of its own that the incoming payload does not already carry?
  //
  // The previous decision was `JSON.stringify(layout) !== JSON.stringify(incoming)`,
  // which compared the whole in-memory object and therefore counted three classes of
  // NON-user difference as "I have local changes to publish":
  //   (a) merge bookkeeping — mergeConcurrentLayout always synthesises `_meta.deleted`
  //       and re-stamps revision/updatedAt/writerId, so `_meta` is structurally
  //       different from an incoming payload that (legitimately) has no tombstones;
  //   (b) key order — the merged object is built by spread, so its key order is the
  //       local object's, not the incoming's;
  //   (c) computed-only state — `groups` (runtime-only, never persisted)
  //       can never appear in an incoming payload.
  // Consequence: every tab echoed exactly one extra revision the first time it
  // received a cross-tab update. That is write amplification, and it is what turned
  // data-golden gate4 red (revision 3 -> 4 inside a settle window that must be quiet).
  //
  // Excluded from the projection because they are bookkeeping, not user data:
  // `_meta.revision` / `_meta.updatedAt` / `_meta.writerId`. Tombstones
  // (`_meta.deleted`) ARE kept — a deletion is real user intent, and dropping it from
  // the comparison would let a resurrecting peer silently win.
  function stableJson(value) {
    if (Array.isArray(value)) {
      // Collections are compared as SETS: two tabs that merged the same entities in a
      // different order must still be considered converged.
      const items = value.map(stableJson);
      items.sort();
      return '[' + items.join(',') + ']';
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value).sort();
      return '{' + keys.map(k => JSON.stringify(k) + ':' + stableJson(value[k])).join(',') + '}';
    }
    return JSON.stringify(value === undefined ? null : value);
  }

  function canonicalReplicated(src) {
    let clone;
    try { clone = JSON.parse(JSON.stringify(src || {})); } catch (_) { return ''; }
    if (!clone || typeof clone !== 'object') return '';
    delete clone.groups; // computed-only, never part of the replicated state
    if (clone.settings && typeof clone.settings === 'object') {
      for (const k of Object.keys(clone.settings)) {
        if (RUNTIME_ONLY_SETTING_RE.test(k)) delete clone.settings[k]; // 66/diagnostics
      }
    }
    const deleted = (clone._meta && clone._meta.deleted) || {};
    delete clone._meta;
    clone.deleted = deleted;
    return stableJson(clone);
  }

  export function applyExternalLayout(raw) {
    if (!raw || applyingExternalLayout) return false;
    const incoming = migrateLayout(raw);
    const incomingRevision = Number(incoming._meta?.revision) || 0;
    const currentRevision = Number(layout._meta?.revision) || 0;
    const incomingUpdatedAt = Number(incoming._meta?.updatedAt) || 0;
    const currentUpdatedAt = Number(layout._meta?.updatedAt) || 0;
    if (incoming._meta?.writerId === writerId) return false;
    if (incomingRevision < currentRevision) return false;
    const incomingWins = incomingRevision > currentRevision
      || incomingUpdatedAt > currentUpdatedAt
      || (incomingUpdatedAt === currentUpdatedAt
        && String(incoming._meta?.writerId || '') > String(layout._meta?.writerId || ''));

    setApplyingExternalLayout(true);
    // Hardening: the guard used to be released only by the
    // render-block finally at the bottom, so any throw in merge/DSU/rebuild ABOVE that
    // try would stick applyingExternalLayout at true for the page's lifetime — a
    // permanently deaf tab that rejects every future cross-tab sync. The whole
    // post-guard body is now inside the try/finally.
    try {
    const staleLargeBoxId = currentLargeBoxId;
    setLayout(incomingWins
      ? mergeConcurrentLayout(incoming, layout)
      : mergeConcurrentLayout(layout, incoming));
    const needsReconcileWrite = canonicalReplicated(layout) !== canonicalReplicated(incoming);
    // A5: groupIdx no longer needed; dsuRebuild reads box.isParent
    markDsuDirty(); dsuRebuildFromConnections();
    try { ensureGroups(); } catch (e) { debugErr("ensureGroups conn ops", e); }
    rebuildBoxMaps();
    connIdx.clear();
    boxConnIdx.clear();
      if (staleLargeBoxId && !getLargeBox(staleLargeBoxId)) {
        setCurrentLargeBoxId(null);
        setInnerPanX(0);
        setInnerPanY(0);
        setInnerZoom(1);
        renderCanvas();
        showBoxDeletedWarning(staleLargeBoxId);
      } else if (currentLargeBoxId) {
        const lb = getLargeBox(currentLargeBoxId);
        if (lb) {
          // +: if the incoming writer is another tab and it produced a newer
          // viewState for the currently-open large box, and the user is not actively panning,
          // pull inner zoom/pan from lb.viewState so the current tab reflects the remote edit
          // immediately. Active pan (panState !== null) wins: never interrupt a live drag.
          try {
            if (panState === null && lb.viewState && typeof lb.viewState.innerZoom === 'number') {
              const remoteTs = Number(lb.viewState.updatedAt) || 0;
              // +v2: compare against THIS tab's own last write to lb.viewState,
              // NOT layout._meta.updatedAt (mergeConcurrentLayout already overwrote
              // it with the incoming _meta, making remoteTs>localTs always false and
              // cross-tab adopt dead). 100ms tolerance absorbs wall-clock drift between
              // tabs while still excluding our own just-written revision.
              const ownTs = __selfLastWriteTs.get(lb.id) || 0;
              // Only adopt when the remote viewState is strictly newer than what this tab
              // most recently wrote; avoids ping-pong when both tabs idle on the same box.
              if (remoteTs > ownTs + 100) {
                setInnerZoom(Number(lb.viewState.innerZoom) || innerZoom);
                setInnerPanX(Number(lb.viewState.innerPanX) || 0);
                setInnerPanY(Number(lb.viewState.innerPanY) || 0);
                debug('applyExternalLayout: adopted remote viewState', { box: lb.id, innerZoom, innerPanX, innerPanY, remoteTs });
              }
            }
          } catch (ev) { debugWarn('applyExternalLayout viewState adopt', ev); }
          renderInnerSurface(lb);
          renderCrumbs(lb);
          updateCaption();
          applyInnerTransform();
          // re-render connections on cross-tab sync into inner-surface view
          renderConnections();
        }
      } else {
        renderCanvas();
      }
      if (needsReconcileWrite && incomingWins) saveLayoutDebounced();
      // Bug3: re-sync settings DOM so modal reflects cross-tab updated urlOpenMode etc.
      try { syncSettingsDOM(); } catch (e) { debugErr("syncSettingsDOM", e); }
      // bug2's third face — remote settings won the LWW merge above but no
      // visual state was replayed and the boot mirror was not rewritten, so the session
      // looked right until the next reload reverted it. Replaying through the single
      // apply path is what removes "inconsistent within the session vs. after reload".
      // Engine layering and the remote-wins LWW semantics above are untouched.
      try { applyDarkMode(layout.settings.darkMode); } catch (e) { debugWarn("applyDarkMode replay", e); }
      debug('external layout applied', { revision: incomingRevision, boxes: layout.boxes.length });
      return true;
    } finally {
      setApplyingExternalLayout(false);
    }
  }

// Ticket 10: onInstalled install/update signal — read once and consume (remove).
// The signal key is written by the background SW (bg onInstalled), NOT by the layout write
// chain; keeping the read+remove here preserves the "storage touches live in the facade"
// invariant (checkpoint 1 of issues/10).
export async function consumeInstallSignal() {
  try {
    const sig = await layoutStorage.get('boxingInstallSignal');
    const reason = (sig && sig.boxingInstallSignal && sig.boxingInstallSignal.reason) || null;
    if (reason && typeof layoutStorage.remove === 'function') await layoutStorage.remove('boxingInstallSignal');
    return reason;
  } catch (e) { debugWarn('install signal read failed', e); return null; }
}

// Ticket 42 (spec D2): NTP-side COW belt-and-suspenders. The background SW already
// snapshots at onInstalled(update); this covers the case where that snapshot failed or
// the signal is consumed by a tab that opened after the update. When the update signal
// is present and the stored layout still needs migration, snapshot the RAW stored
// layout BEFORE loadLayout() migrates it — the copy preserves the pre-update schema.
export async function ensurePreUpdateSnapshot() {
  try {
    const stored = await layoutStorage.get({ boxingLayout: null });
    const raw = stored.boxingLayout;
    if (!raw || !needsMigration(raw)) return false;
    setLayout(raw); // raw, pre-migration — the next loadLayout() re-reads and migrates over it
    await saveSnapshot();
    return true;
  } catch (e) { debugErr('ensurePreUpdateSnapshot', e); return false; }
}

// Migration heuristics: true when migrateLayout would rewrite the stored layout
// (migrateLayout is version-ungated and mutates box objects in place, so a JSON diff
// against the same object reference cannot detect "pending" — white-list the shapes).
function needsMigration(raw) {
  if (typeof raw !== 'object' || raw === null) return true;
  if (!(Number(raw.version) >= 3)) return true;                     // pre-3 legacy shapes
  if (!Array.isArray(raw.boxes)) return true;
  if (!raw.settings || typeof raw.settings !== 'object') return true;
  if (Array.isArray(raw.groups) && raw.groups.length > 0) return true; // groups still persisted, migration pending
  if (!raw._meta || !raw._meta.__groupsMigrated) return true;          // groups-migration flag not yet stamped
  if (Array.isArray(raw.connections)) {
    for (const c of raw.connections) if (c && typeof c === 'object' && c.props == null) return true; // connection props backfill pending
  }
  return false;
}

