/** Boxing — NTP core: Obsidian-style infinite canvas, manual drag (real-time), title-only edit zone, elastic snap, bookmark CRUD, i18n store, settings modal, debug */

// Ticket 65 (A-019): this file carries no literal version number. The single user-visible version
// is the manifest calver (manifest.version_name || manifest.version), stamped by build.mjs and read
// at runtime through __boxingVersion() below. A hardcoded literal here drifts on the next calver
// stamp, and users paste these strings into bug reports (ADR-0017 postmortem requires an accurate
// version). Section comments may still cite historical SemVer markers (v3.6.5+, v3.7.2) as feature
// provenance; they are not the extension version. History: docs/history/boxing-changelog.md.
'use strict';
// Ticket 03 (architecture-recovery): favicon cache block extracted verbatim to ./favicon.js — first ES module of the zero-build pipeline (spec.md).
import { loadFavicon } from './favicon.js';
// Ticket 06 (architecture-recovery): shared mutable state moved verbatim to ./state.js —
// single explicit state module (ESM live-binding singleton). Reads bind live; every write
// goes through a set*() setter (imported bindings are read-only in ESM).
import {
  MAX_LARGE_BOXES, MAX_SMALL_BOXES, MAX_BOOKMARKS, writerId,
  __viewStatePersistTimers, __selfLastWriteTs, boxById, smallBoxById, connLines,
  connById, dirtyConns, connIdx, boxConnIdx, boxGroupId,
  groupMembers, groupStar, groupIdx, __popupTrackers,
  layout, currentLargeBoxId, canvasZoom, innerZoom, canvasPanX, canvasPanY,
  innerPanX, innerPanY, dragState, resizeState, panState, lastClickTime,
  lastClickTarget, lastDragEndTime, lastEnterLargeBoxAt, suppressInnerDblClickOnce, lastDragEndId, headerPinned,
  scrollTimeout, idSequence, clearedTombstones,
  __nextGroupId, canvasConnSvg, innerConnSvg, connectMode, provisionalLine,
  provisionalGhost, selectedConnId, confirmCallback, __sizeObserver,
  setLayout, setCurrentLargeBoxId, setCanvasZoom, setInnerZoom, setCanvasPanX, setCanvasPanY,
  setInnerPanX, setInnerPanY, setDragState, setResizeState, setPanState, setLastClickTime,
  setLastClickTarget, setLastDragEndTime, setLastEnterLargeBoxAt, setSuppressInnerDblClickOnce, setLastDragEndId, setHeaderPinned,
  setScrollTimeout, setIdSequence, setClearedTombstones,
  setNextGroupId, setCanvasConnSvg, setInnerConnSvg, setConnectMode, setProvisionalLine,
  setProvisionalGhost, setSelectedConnId, setConfirmCallback, setSizeObserver,
} from './state.js';
import { CANVAS_GRID, INNER_GRID, LARGE_DEF_H, LARGE_DEF_W, LARGE_MIN_H, LARGE_MIN_W, MAX_ZOOM, MIN_ZOOM, RESIZE_SNAP, SMALL_DEF_H, SMALL_DEF_W, SMALL_MIN_H, SMALL_MIN_W, SPATIAL_THRESHOLD, ZOOM_STEPS, buildSpatialGrid, elasticSnap, hexToRgbTriplet, largeKey, mergeById, migrateLayout, normalizeBookmarkUrl, querySpatialNearby, screenToWorld, smallKey, snapCanvas, snapInner } from './utils.js';
import { initI18n, loadI18nStore, i18n, applyI18n, currentLang, SUPPORTED_LANGS } from './i18n.js';
// Ticket 07 (architecture-recovery): storage write facade — write chain + loop guard +
// onChanged listener moved verbatim to ./storage.js; all chrome.storage writes go through it.
import { TOMBSTONE_TTL_MS, applyExternalLayout, consumeInstallSignal, directSetBoxingLayout, ensurePreUpdateSnapshot, gcTombstones, initStorageFacade, listSnapshots, loadLayout, markDeleted, registerStorageOnChanged, restoreFromSnapshot, saveLayout, saveLayoutDebounced, saveSnapshot, stripGroupsForPersist } from './storage.js';
// Ticket 08 (architecture-recovery): layout/view-state persistence + theme packs + loadSettings moved verbatim to ./persist.js on top of the storage facade.
import { BOOT_THEME_KEY, LAST_ACTIVE_VIEW_KEY, TAB_VIEW_KEY, applyTheme, clearBootThemeMirror, initPersistFacade, loadFallbackTabView, loadSettings, persistBootThemeMirror, persistViewState, saveLargeBoxViewState, scheduleLargeBoxViewStatePersist } from './persist.js';
// Ticket 08 (architecture-recovery): render pipeline moved verbatim to ./render.js — conn SVG layer (culling/LOD/pool, ADR-0004),
// DSU groups, pan/zoom transforms, drag handlers, canvas render + box CRUD + bookmark UI. Diffs = export prefixes only.
import { _execDeleteLargeBox, _execDeleteSmallBox, addLargeBox, addLargeBoxAt, addPopupTracker, addSmallBox, addSmallBoxAt, applyCanvasTransform, applyInnerTransform, clampCanvasPan, clampInnerPan, commit, enterLargeBox, exitToCanvas, getLargeBox, getSmallBox, initRenderFacade, initSizeObserver, innerSurfaceContent, isWithinCreateCooldown, markCreate, onBoxDragEnd, onCanvasPanEnd, onCanvasPanStart, onCanvasWheel, onInnerPanEnd, onInnerPanStart, onInnerWheel, refreshContainerSizes, removePopupTracker, renderCanvas, renderCrumbs, renderInnerSurface, showBoxDeletedWarning, updateAutohideUI, zoomStep } from './render.js';
import { addConnection, addMember, allValidKeys, applyConnDeleteKeydoc, deleteConnById, disposeAllConns, dsuRebuildFromConnections, ensureConnArrays, ensureGroups, enterConnectMode, exitConnectMode, getConnDeleteTrigger, getGroupByParent, initConnFacade, markDsuDirty, moveGroupTogether, pruneConnArrays, refreshAllConns, removeConnection, renderConnections, resolveBoxEl, setConnDeleteAction, toggleStarMark } from './conn-layer.js';
import { initPopupsFacade } from './popups.js';

import { initCredentialsFacade } from './credentials.js';
import { initSyncEngineFacade, bindSyncBackupUi } from './sync-engine.js';
import { initSettingsUiFacade, bindSettingsUi, syncSettingsDOM, openSettingsModal, openConfirmModal } from './settings-ui.js';
import { initOnboardingFacade, initOnboarding } from './onboarding.js';
(async () => {
  // ── cross-browser API ──────────────────────────────────
  let api = (typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : null);
  // In file:/// or non-extension contexts, chrome/browser may exist but storage is unavailable.
  if (!api || !api.storage || !(api.storage.local || api.storage.sync)) {
    const mockChangeListeners = new Set();
    window.addEventListener('storage', event => {
      if (event.key !== 'boxingLayout' || !event.newValue) return;
      let newValue = null;
      let oldValue = null;
      try {
        newValue = JSON.parse(event.newValue);
        oldValue = event.oldValue ? JSON.parse(event.oldValue) : null;
      } catch (e) { /* silent: storage event JSON parse, non-boxing keys */ return; }
      // A6-fix: emit BOTH area names so listeners using either 'local' or 'sync' fire.
      // In file:// test/mock contexts the source tap is a single localStorage key, so
      // emitting both is safe — the listener's expectedArea filter discards the wrong one.
      for (const listener of mockChangeListeners) {
        listener({ boxingLayout: { oldValue, newValue } }, 'sync');
        listener({ boxingLayout: { oldValue, newValue } }, 'local');
      }
    });
    const mock = {
      storage: {
        sync: {
          get: async (_keys) => { try { const v = localStorage.getItem('boxingLayout'); return v ? { boxingLayout: JSON.parse(v) } : { boxingLayout: null }; } catch (_) { return { boxingLayout: null }; } },
          set: async (obj) => { try { localStorage.setItem('boxingLayout', JSON.stringify(obj.boxingLayout)); } catch (e) { if (typeof debugErr === 'function') debugErr('mock storage.set failed', e); throw e; } }
        },
        local: {
          // 41R: generic multi-key persistence for the file:// lane. boxingLayout keeps the
          // BARE localStorage key (cross-tab 'storage' event + specs seed it directly); every
          // other key lives under 'bxstore:' so the snapshot split keys (snap.v1.<ts>),
          // snap.v1.index and the legacy boxingSnapshots[] round-trip through get/set/remove.
          // Before 41R a set() of any non-layout key wrote JSON.stringify(undefined) OVER the
          // boxingLayout value — saveSnapshot on file:// silently destroyed the mock layout.
          get: async (keys) => {
            const out = {};
            const readOne = (k, fallback) => {
              const storeKey = k === 'boxingLayout' ? k : 'bxstore:' + k;
              try {
                const v = localStorage.getItem(storeKey);
                out[k] = v !== null ? JSON.parse(v) : fallback;
              } catch (_) { /* silent: unparseable mock entry — fallback value returned */ out[k] = fallback; }
            };
            try {
              if (keys === null || keys === undefined) {
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  if (k === 'boxingLayout') readOne('boxingLayout', null);
                  else if (k && k.startsWith('bxstore:')) readOne(k.slice('bxstore:'.length), null);
                }
              } else if (typeof keys === 'string') {
                readOne(keys, undefined);
                if (out[keys] === undefined) delete out[keys];
              } else if (Array.isArray(keys)) {
                for (const k of keys) { readOne(k, undefined); if (out[k] === undefined) delete out[k]; }
              } else if (typeof keys === 'object') {
                for (const [k, def] of Object.entries(keys)) readOne(k, def);
              }
            } catch (e) { if (typeof debugErr === 'function') debugErr('mock storage.get failed', e); }
            return out;
          },
          set: async (obj) => {
            try {
              for (const [k, v] of Object.entries(obj)) {
                localStorage.setItem(k === 'boxingLayout' ? k : 'bxstore:' + k, JSON.stringify(v));
              }
            } catch (e) { if (typeof debugErr === 'function') debugErr('mock storage.set failed', e); throw e; }
          },
          remove: async (keys) => {
            try {
              const list = Array.isArray(keys) ? keys : [keys];
              for (const k of list) localStorage.removeItem(k === 'boxingLayout' ? k : 'bxstore:' + k);
            } catch (e) { if (typeof debugErr === 'function') debugErr('mock storage.remove failed', e); }
          }
        },
        onChanged: {
          addListener: listener => mockChangeListeners.add(listener),
          removeListener: listener => mockChangeListeners.delete(listener)
        }
      },
      runtime: { getURL: (p) => p }
    };
    api = mock; /* SEC-01: mock stays local — no global chrome/browser pollution */
  }
  const layoutStorage = api.storage.local;  // A6: storage.local (10MB / unlimited) vs sync 100KB quota
  // Ticket 07 (architecture-recovery): inject ntp.js-scope deps into the storage write facade
  // (./storage.js) — write chain + loop guard + onChanged listener moved there verbatim.
  initStorageFacade({ api, debug, debugErr, debugWarn, persistViewState, pruneConnArrays, rebuildBoxMaps, markDsuDirty, ensureGroups, dsuRebuildFromConnections, getLargeBox, renderCanvas, renderInnerSurface, renderCrumbs, updateCaption, applyInnerTransform, renderConnections, syncSettingsDOM, showBoxDeletedWarning, mirrorWriter: () => { persistBootThemeMirror((mirror) => { try { localStorage.setItem(BOOT_THEME_KEY, JSON.stringify(mirror)); } catch (e) { debugWarn('boot mirror setItem', e); } }); } });

  // ── constants ──────────────────────────────────────────
  const DEBUG = true;
  // ── log system (BX-AUD-05) ─────────────────────────────
  // Tiered, bounded, off-by-default-in-production logging that mirrors the well-worn pino/winston-style shape:
  //   ERROR(1) → always recorded (ring buffer + console whenever console is attached)
  //   WARN(2)  → recorded when level >= WARN
  //   INFO(3)  → recorded when level >= INFO  (opt-in, recommended for support sessions)
  //   DEBUG(4) → recorded when level >= DEBUG (verbose; default only via ?debug=verbose or setting)
  // Design constraints enforced to protect the host / user:
  //   - Ring buffer is capped at LOG_RING_MAX entries; older entries are evicted FIFO — no unbounded memory growth.
  //   - Nothing is written to chrome.storage.sync, so logs cannot create state sprawl or cross-tab writes.
  //   - The console sink still obeys window.__BOXING_DEBUG__ so production users without ?debug get no console spam,
  //     but error/warn records still land in the ring buffer (exportable via __boxingDebug.exportLog()).
  const LOG_ERROR = 1, LOG_WARN = 2, LOG_INFO = 3, LOG_DEBUG = 4;
  const LOG_RING_MAX = 300;
  // Default level = WARN in production (records errors + warnings), elevate to DEBUG with ?debug=verbose.
  let __logLevel = LOG_WARN;
  const __logRing = [];
  // BX-DEV-115C: background error log cache - synced from chrome.storage.local.bgErrLog
  let __bgErrLogCache = [];
  try {
    chrome.storage && chrome.storage.local && chrome.storage.local.get && chrome.storage.local.get({ bgErrLog: [] }, function(r){ if (r && Array.isArray(r.bgErrLog)) __bgErrLogCache = r.bgErrLog.slice(-50); });
    chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener && chrome.storage.onChanged.addListener(function(changes, area){ if (area === 'local' && changes.bgErrLog && Array.isArray(changes.bgErrLog.newValue)) __bgErrLogCache = changes.bgErrLog.newValue.slice(-50); });
  } catch (e) { /* silent: bgErrLog sync, non-critical */ } // FIFO entries newest-at-end; cap LOG_RING_MAX; not persisted to chrome.storage.
  // Sample rate for the most chatty DEBUG call sites (pan/zoom/saveLayout done) — 1 in N preserved to avoid log spam.
  let __logSampleSlot = 0;

  function __logFmt(level, args) {
    const t = new Date();
    const ts = t.toISOString();
    // BX-AUD-05: keep the legacy `[Boxing]` prefix on the console so existing observability
    // (Playwright specs that filter on '[Boxing]' substrings, DevTools console greps) keeps working.
    // Level is preserved on entry.level; the visible prefix adds a level tag for human triage.
    let prefix = '[Boxing]';
    if (level === LOG_ERROR) prefix = '[Boxing][ERR]';
    else if (level === LOG_WARN) prefix = '[Boxing][WARN]';
    else if (level === LOG_INFO) prefix = '[Boxing][INFO]';
    else prefix = '[Boxing][DBG]';
    const text = args.map(a => {
      try {
        if (a instanceof Error) return a.stack || (a.name + ': ' + a.message);
        if (typeof a === 'string') return a;
        return JSON.stringify(a);
      } catch (_) { return String(a); }
    }).join(' ');
    return { ts, level, prefix, text: text.length > 800 ? text.slice(0, 800) + '…' : text };
  }

  function __logPush(level, args) {
    if (level > __logLevel) return;
    const entry = __logFmt(level, args);
    __logRing.push(entry);
    if (__logRing.length > LOG_RING_MAX) __logRing.splice(0, __logRing.length - LOG_RING_MAX);
    if (window.__BOXING_DEBUG__) {
      if (level === LOG_ERROR) console.error(entry.prefix, ...args);
      else if (level === LOG_WARN) console.warn(entry.prefix, ...args);
      else console.log(entry.prefix, ...args);
    }
  }

  // BX-AUD-05: sampled DEBUG — every DEBUG_SAMPLE_RATE calls produce one entry. Use for hot paths
  // (pan/zoom/saveLayout) so they cannot flood the ring even when level is set to DEBUG.
  const LOG_DEBUG_SAMPLE_RATE = 20;
  function debugSampled(...args) { __logSampleSlot = (__logSampleSlot + 1) % LOG_DEBUG_SAMPLE_RATE; if (__logSampleSlot === 0) __logPush(LOG_DEBUG, args); }

  function debug(...args) { __logPush(LOG_DEBUG, args); }
  function debugErr(...args) { __logPush(LOG_ERROR, args); }
  function debugWarn(...args) { __logPush(LOG_WARN, args); }
  function debugInfo(...args) { __logPush(LOG_INFO, args); }

  // -- Ticket 65 (A-019): single source of truth for user-visible version strings ---------------
  // Version is the manifest calver ONLY: manifest.version_name || manifest.version. Alignment
  // strategy (no fifth version source): manifest.json is the sole writer; build.mjs restamps both
  // version and version_name from BOXING_BUILD_VERSION (ticket 08); ntp/index.html keeps a static
  // calver fallback for the file:// mock lane; settings-ui.js overwrites the settings footer from
  // this same manifest read at runtime. ntp.js is only the fourth reader of that one field.
  // SEC-01: read-only, defines no globals; the file:// mock lane has no chrome API at all.
  function __boxingVersion() {
    try {
      const m = globalThis.chrome?.runtime?.getManifest?.();
      const v = m?.version_name || m?.version;
      return v ? 'Boxing v' + v : 'Boxing v(manifest unavailable)';
    } catch (e) { /* silent: B-class, diagnostic-only version tag; mock lane has no chrome API */ }
    return 'Boxing v(manifest unavailable)';
  }
  // ── Enhanced debug system (v3.6.5+) ─────────────────
  // DEBUG=true enables all logs. Set DEBUG=false for production.
  // URL param ?debug=1 enables debug regardless of DEBUG constant.
  // URL param ?debug=0 disables debug regardless of DEBUG constant.
  // URL param ?debug=verbose adds stack traces and timing info.
  (function initDebugMode() {
    const params = new URLSearchParams(location.search);
    const flag = params.get('debug');
    if (flag === '1') { window.__BOXING_DEBUG__ = true; window.__BOXING_VERBOSE__ = false; __logLevel = LOG_DEBUG; } // BX-AUD-05: debug=1 → full DEBUG level (legacy compat)
    else if (flag === '0') { window.__BOXING_DEBUG__ = false; window.__BOXING_VERBOSE__ = false; __logLevel = LOG_ERROR; }
    else if (flag === 'verbose') { window.__BOXING_DEBUG__ = true; window.__BOXING_VERBOSE__ = true; __logLevel = LOG_DEBUG; }
    else if (flag === 'info') { window.__BOXING_DEBUG__ = true; __logLevel = LOG_INFO; }
    // BX-AUD-05: when DEBUG constant is true (legacy dev build), elevate level to LOG_DEBUG so existing tests
    // that key on [Boxing] console logs keep producing output. Production ships DEBUG=false → LOG_ERROR only.
    else { window.__BOXING_DEBUG__ = DEBUG; window.__BOXING_VERBOSE__ = false; __logLevel = DEBUG ? LOG_DEBUG : LOG_WARN; }
    debug('[debug] mode=' + (window.__BOXING_DEBUG__ ? 'on' : 'off') + ' verbose=' + (window.__BOXING_VERBOSE__ ? 'on' : 'off'));
  })();

  // Expose debug API for extension DevTools console inspection
  window.__boxingDebug = {
    addConnection, removeConnection, commit, deleteConnById, getConnDeleteTrigger, setConnDeleteAction, toggleStarMark, addMember, moveGroupTogether, enterConnectMode, exitConnectMode, getGroupByParent, ensureGroups, _execDeleteLargeBox, _execDeleteSmallBox,
    largeKey, smallKey, resolveBoxEl, allValidKeys,
    getLargeBox, renderCanvas,
    pruneConnArrays, renderConnections, disposeAllConns, enterLargeBox,
    connCount: () => connLines.size,
    get layout() { return layout; }, // BX-DEV-111k: live ref to layout for Playwright testing
    state() { return { boxes: layout.boxes.length, currentLargeBoxId, canvasZoom, innerZoom, headerPinned, darkMode: layout.settings.darkMode, lang: currentLang, fontSize: layout.settings.fontSize }; },
    dumpLayout() { console.table(layout.boxes.map(b => ({ id: b.id, title: b.title, x: b.x, y: b.y, w: b.width, h: b.height, children: b.children?.length || 0 }))); },
    dumpStorage() { layoutStorage?.get?.(null).then(d => console.log('[Boxing] storage:', d)).catch(e => console.error('[Boxing] storage read:', e)); },
    persistView() { persistViewState(true); },
    applyExternalLayout(raw) { return applyExternalLayout(raw); },
    saveLayout,
    // Ticket 41R: snapshot subsystem + storage seams for Playwright assertions (spec.md D1).
    // Real chrome.storage in the extension lane; generic localStorage mock in file:// (SEC-01
    // keeps the mock local — specs must NOT poke window.chrome.storage as the file:// seam).
    saveSnapshot,
    listSnapshots,
    restoreFromSnapshot,
    storageGet: (keys) => layoutStorage.get(keys),
    storageSet: (obj) => layoutStorage.set(obj),
    storageRemove: (keys) => layoutStorage.remove ? layoutStorage.remove(keys) : Promise.resolve(),
    normalizeBookmarkUrl(value) { return normalizeBookmarkUrl(value); },
    // Ticket 11: expose openBookmarkUrl for Playwright open-path assertions (precedent: loadFavicon, BX-DEV-126).
    openBookmarkUrl,
    triggerGC() { if (typeof gc === 'function') gc(); else console.log('[Boxing] gc not available (not in --js-flags=--expose-gc mode)'); },
    // BX-DEV-114: WebDAV config for Playwright tests
    setWebDAVConfig(url, user, pass) {
      layout.settings.webdavUrl = url;
      layout.settings.webdavUser = user;
      layout.settings._encWebdavPass = pass ? pass : null;
      // Also fill the input fields if they exist
      const urlInput = document.getElementById('webdav-url');
      const userInput = document.getElementById('webdav-user');
      const passInput = document.getElementById('webdav-pass');
      if (urlInput) urlInput.value = url || '';
      if (userInput) userInput.value = user || '';
      if (passInput) passInput.value = pass || '';
      return saveLayout();
    },
    async testWebDAV() { return await window.__boxingTestWebDAV(); },
    async backupWebDAV() { return await window.__boxingBackupWebDAV(); },
    async syncWebDAV(opts) { return await window.__boxingSyncWebDAV(opts || {}); },
    // BX-ONBOARDING: dismiss onboarding for E2E tests / scripted flows.
    skipOnboarding() {
      const ov = document.getElementById('onboarding-overlay');
      if (ov) ov.hidden = true;
      if (layout.settings) layout.settings.onboardingCompleted = true;
      return saveLayout();
    },
    // BX-DEV-111M/N/L: test hooks for credential flush + per-box viewState + LRU history
    flushCredentials: () => window.__boxingFlushCredentials && window.__boxingFlushCredentials(),
    saveLargeBoxViewState: (id) => window.__boxingSaveLargeBoxViewState && window.__boxingSaveLargeBoxViewState(id),
    clearTabViewHistory: () => window.__boxingClearTabViewHistory && window.__boxingClearTabViewHistory(),
    setOnboardingLangInUI: (code) => { const el = document.getElementById('onboarding-lang-select'); if (el) { el.value = code; el.dispatchEvent(new Event('change')); } },
    // BX-AUD-05: leveled log API — supports support / debugging without unbounded log sprawl.
    getLogLevel: () => __logLevel,
    setLogLevel: (n) => { const v = Math.max(1, Math.min(4, Number(n) | 0)); __logLevel = v; debugInfo('log level set to', v); return v; },
    getLogRing: () => __logRing.slice(),
    exportLog: () => {
      var all = __logRing.slice();
      if (__bgErrLogCache && __bgErrLogCache.length) all.push.apply(all, __bgErrLogCache.map(function(e){ return { ts: e.ts, prefix: e.prefix || '[Boxing:BG]', text: e.text || String(e) }; }));
      all.sort(function(a,b){ return a.ts - b.ts; });
      return all.map(function(e){ return e.ts + ' ' + e.prefix + ' ' + e.text; }).join('\n');
    },
    clearLog: () => { __logRing.length = 0; return true; },
    LOG_LEVELS: { ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 },
    // BX-DEV-122: expose sync payload helpers for Playwright tests
    get buildSyncPayload() { if (window.__bxSync) return window.__bxSync.buildSyncPayload; debugWarn("buildSyncPayload: __bxSync not ready"); return () => undefined; },
    get resolveWebDAVFileUrl() { if (window.__bxSync) return window.__bxSync.resolveWebDAVFileUrl; debugWarn("resolveWebDAVFileUrl: __bxSync not ready"); return () => undefined; },
    get backupToGist() { if (window.__bxSync) return window.__bxSync.backupToGist; debugWarn("backupToGist: __bxSync not ready"); return () => undefined; },
    // BX-DEV-126: expose loadFavicon for Playwright tests verifying parallel CDN race.
    loadFavicon,
    get groupStar() { return groupStar; },
    get connById() { return connById; },
    // ADR-0007 acceptance hooks (Playwright)
    stripGroupsForPersist,
    migrateLayout,
    gcTombstones,
    buildSpatialGrid,
    querySpatialNearby,
    get SPATIAL_THRESHOLD() { return SPATIAL_THRESHOLD; },
    get TOMBSTONE_TTL_MS() { return TOMBSTONE_TTL_MS; },
  };
  // Log mock usage (must be after DEBUG init)
  if (!api || !api.storage || !api.storage.sync) debug('Using localStorage mock for storage');

  // ── Debug Address System ──────────────────
  // Open boxing with ?debug to enable overlay HUD + detailed logging
  // Open boxing with ?debug=verbose for ultra-detailed logs
  if (new URLSearchParams(location.search).has('debug')) {
    window.__BOXING_DEBUG__ = true;
    window.__BOXING_VERBOSE__ = new URLSearchParams(location.search).get('debug') === 'verbose';
    debug(`Debug mode activated via URL param (verbose=${window.__BOXING_VERBOSE__})`);
  }


  // ── i18n store ─────────────────────────────────────────
  // Ticket 04 (architecture-recovery): dictionary / en-fallback / store extracted verbatim to ./i18n.js
  // (zero-build strangler-fig wave 1). initI18n() injects the mock-resolved api + tiered loggers;
  // SEC-01 keeps the file:// mock local to ntp.js. currentLang / SUPPORTED_LANGS are ESM live bindings,
  // so the read sites below (state() / init log / onboarding picker) are untouched.
  initI18n({ api, debug, debugErr });

  // ── DOM refs ───────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

  const canvasContainer = $('#canvas');
  canvasContainer.tabIndex = -1; // BX-DEV-140c: focus sink — Chrome dblclick focus-steal prevention
  const canvasSurface = $('#canvas-surface');
  const canvasEmpty = $('#canvas-empty');
  const canvasZoomOut = $('#canvas-zoom [data-zoom="out"]');
  const canvasZoomIn = $('#canvas-zoom [data-zoom="in"]');
  const canvasZoomVal = $('#canvas-zoom-value');
  const canvasZoomCtrl = $('#canvas-zoom');
  const innerSurface = $('#inner-surface');
  innerSurface.tabIndex = -1; // BX-DEV-140c: focus sink for inner canvas
  const innerZoomOut = $('#inner-zoom [data-zoom="out"]');
  const innerZoomIn = $('#inner-zoom [data-zoom="in"]');
  const innerZoomVal = $('#inner-zoom-value');
  const innerZoomCtrl = $('#inner-zoom');
  const innerWrapper = $('#inner');
  const innerCanvas = $('#inner-canvas');
  // BX-DEV-134 (B2 perf): ResizeObserver-fed geometry cache. clampCanvasPan/clampInnerPan
  // and onBoxDragEnd worldMaxX/Y read these instead of clientWidth/Height, eliminating
  // the per-mousemove forced layout that 60-120Hz pan/drag caused. Updated by the RO below.
  const innerCrumbTitle = $('#inner-crumb-title');
  const crumbsEl = $('#crumbs');
  const captionEl = $('#caption');
  const searchInput = $('#q');
  const searchResultsEl = $('#search-results');
  const backBtn = $('#back-btn');
  const addLargeBtn = $('#add-box');
  const addSmallBtn = $('#add-small');
  const settingsBtn = $('#settings-btn');
  const settingsModal = $('#settings-modal');
  const modalClose = $('#settings-modal .modal__close');
  const langSelect = $('#lang-select');
  const rememberCheck = $('#remember-last-pos');
  // BX-DEV-120 + ticket 11: urlOpenMode select — bookmarks open in sameTab (default) or newTab.
  const urlOpenModeSelect = $('#url-open-mode-select');
  // ADR-0006: conn-delete-action select — configurable gesture for deleting connection lines.
  const connDeleteActionSelect = $('#conn-delete-action-select');
  const fontSlider = $('#font-slider');
  const fontSliderVal = $('#font-slider-value');
  const zoomSlider = $('#zoom-slider');
  const zoomSliderVal = $('#zoom-slider-value');
  const emptyEl = $('#empty');

  // confirm modal
  const confirmModal = $('#confirm-modal');
  const confirmTitle = $('#confirm-title');
  const confirmBody = $('#confirm-body');
  const confirmCancel = $('#confirm-cancel-btn');
  const confirmDelete = $('#confirm-delete-btn');

  // dark mode
  const darkModeBtn = $('#dark-mode-btn');
  const darkModeCB = $('#dark-mode-cb');

  // import/export
  const exportBtn = $('#export-data-btn');
  const exportFullBtn = $('#export-full-dr-btn'); // ticket 51: optional full DR package export
  const importBtn = $('#import-data-btn');
  const importFile = $('#import-file-input');
  // BX-AUD-05 UI surfaces — diagnostics export/clear/level.
  const diagExportLogBtn = $('#diag-export-log-btn');
  const diagClearLogBtn = $('#diag-clear-log-btn');
  const diagLogLevelSelect = $('#diag-log-level-select');
    // Backup Now button
    // ── Backup system: WebDAV / GitHub Gist / Local ──────
    const syncProviderSelect = document.getElementById('sync-provider');
    const webdavConfig = document.getElementById('webdav-config');
    const gistConfig = document.getElementById('gist-config');
    const webdavUrlInput = document.getElementById('webdav-url');
    const webdavUserInput = document.getElementById('webdav-user');
    const webdavPassInput = document.getElementById('webdav-pass');
    const gistTokenInput = document.getElementById('gist-token');
    const gistIdInput = document.getElementById('gist-id');
    // BX-DEV-121 (Bug16): provider-agnostic Sync Level + Sync File Name
    const syncLevelSelect = document.getElementById('sync-level-select');
    const syncFilenameInput = document.getElementById('sync-filename-input');
    const backupNowBtn = document.getElementById('backup-now-btn');
    const remoteBackupZone = document.getElementById('remote-backup-zone');
    const lastBackupTimeVal = document.getElementById('last-backup-time-value');
    const webdavTestBtn = document.getElementById('webdav-test-btn');
  // Ticket 08: inject ntp.js-scope deps into the persistence module (./persist.js)
  // Ticket 60 (Wave7 zero-flash): inject the paint-critical mirror writer — writes the
  // boot mirror (theme/darkMode/fontSize) to localStorage so the next new tab's classic
  // blocking boot script (ntp/boot-theme.js) paints the remembered theme before first
  // frame. localStorage here is the sync-readable first-paint cache (Wave7 D-002);
  // boxingLayout stays the only authoritative layout source.
  initPersistFacade({ debugWarn, darkModeBtn, getLargeBox, mirrorWriter: (mirror) => { try { localStorage.setItem(BOOT_THEME_KEY, JSON.stringify(mirror)); } catch (e) { debugWarn('boot mirror setItem', e); } } });

  // ── state ── moved verbatim to ./state.js (ticket 06, architecture-recovery) ──

  function makeId(prefix) {
    setIdSequence((idSequence + 1) % Number.MAX_SAFE_INTEGER);
    return `${prefix}-${Date.now().toString(36)}-${writerId.slice(-8)}-${idSequence.toString(36)}`;
  }


  function rebuildBoxMaps() {
    boxById.clear();
    smallBoxById.clear();
    for (const lb of layout.boxes) {
      boxById.set(lb.id, lb);
      for (const sb of (lb.children || [])) {
        smallBoxById.set(lb.id + ":" + sb.id, sb);
      }
    }
  }


  const headerPinBtn = $('#header-pin-btn');
  const appEl = $('#app');
  const headerBar = $('.ntp__bar');
  // Ticket 08: inject ntp.js-scope deps into the render module (./render.js)
  initRenderFacade({ addLargeBtn, api, appEl, backBtn, canvasContainer, canvasEmpty, canvasSurface, canvasZoomCtrl, canvasZoomVal, debug, debugErr, debugSampled, debugWarn, enterAndLocateSmallBox, headerBar, headerPinBtn, innerCanvas, innerCrumbTitle, innerSurface, innerWrapper, innerZoomCtrl, innerZoomVal, makeId, openConfirmModal, rebuildBoxMaps, updateCaption, zoomSlider, zoomSliderVal });
  initConnFacade({ commit, getLargeBox, getSmallBox, getInnerSurfaceContent: () => innerSurfaceContent, rebuildBoxMaps, debug, debugSampled, canvasSurface, canvasContainer, innerCanvas, innerSurface });
  initPopupsFacade({ getLargeBox, renderInnerSurface, showBoxDeletedWarning, addPopupTracker, removePopupTracker, makeId, api, debug, debugWarn });
  // Ticket 10 (architecture-recovery): inject ntp.js-scope deps into the four settings/init-domain
  // modules (ADR-0016). Must stay after every DOM const it reads (ticket-08 TDZ lesson).
  initCredentialsFacade({ debugErr });
  initSyncEngineFacade({ debug, debugErr, debugWarn, syncProviderSelect, webdavConfig, gistConfig, webdavUrlInput, webdavUserInput, webdavPassInput, gistTokenInput, gistIdInput, syncLevelSelect, syncFilenameInput, backupNowBtn, remoteBackupZone, lastBackupTimeVal, webdavTestBtn });
  initSettingsUiFacade({ debug, debugErr, debugWarn, updateCaption, settingsModal, modalClose, langSelect, rememberCheck, urlOpenModeSelect, connDeleteActionSelect, fontSlider, fontSliderVal, zoomSlider, zoomSliderVal, darkModeCB, darkModeBtn, confirmModal, confirmTitle, confirmBody, confirmCancel, confirmDelete, appEl, exportBtn, exportFullBtn, importBtn, importFile, diagExportLogBtn, diagClearLogBtn, diagLogLevelSelect });
  initOnboardingFacade({ debug, debugErr, updateCaption, langSelect });

  // ── Header Pin: two-position strategy (v3.7.2) ──────────────────────────
  // Pinned (default): button lives in header bar, header visible.
  // Floating (unpinned): header hidden, button moved into canvas as absolute overlay.
  // This prevents canvas__surface from intercepting pointer events (stacking context bug).
  if (headerPinBtn) {
    headerPinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      setHeaderPinned(!headerPinned);
      updateAutohideUI();
      // When repinning: header reappears, canvas layout changes — reapply transforms
      if (headerPinned) { applyCanvasTransform(); applyInnerTransform(); }
      if (currentLargeBoxId) updateCaption(); else updateCaption();
      saveLayout();
    });
    // ADR-0015.updated: default headerPinned=true → tooltip shows action "Unpin header".
    headerPinBtn.title = i18n('headerPinOff');
    updateAutohideUI();  // button stays in header bar by default
  }
  debug('addLargeBox function defined');
  // select.value stays stale and the user sees the old choice — Bug3.
  // Expose for Playwright testing
  window._boxingOpenSettings = openSettingsModal;
  window._boxingAddLargeBox = addLargeBox;
  window._boxingAddSmallBox = addSmallBox;
  window._boxingEnterLargeBox = enterLargeBox; // BX-DEV-111k: exposed for test
  window._boxingExitToCanvas = exitToCanvas; // BX-DEV-020: exposed for hidden-override regression test (pair with _boxingEnterLargeBox)
  window._boxingDeleteLargeBox = _execDeleteLargeBox; // BX-DEV-111k: exposed for cross-tab delete test


  // ── search / caption ───────────────────────────────────
  function updateCaption() {
    if (currentLargeBoxId) {
      const lb = getLargeBox(currentLargeBoxId);
      captionEl.textContent = i18n('smallBoxesCount', [lb?.children?.length || 0]);
    } else {
      captionEl.textContent = i18n('largeBoxesCount', [layout.boxes.length]);
    }
  }

  // BX-DEV-121 (Bug9 search): live search across large boxes, small boxes, bookmarks.
  // returns up to 50 hits sorted by container depth (large>small>bookmark).
  function runSearch(q) {
    const hits = [];
    const pushHit = (type, largeId, largeTitle, smallId, smallTitle, bm) => {
      hits.push({ type, largeId, largeTitle, smallId, smallTitle, bm });
    };
    for (const lb of (layout.boxes || [])) {
      const lt = (lb.title || '').toLowerCase();
      if (lt.includes(q)) pushHit('large', lb.id, lb.title || i18n('untitledBox'), null, null, null);
      for (const sb of (lb.children || [])) {
        const st = (sb.title || '').toLowerCase();
        if (st.includes(q)) pushHit('small', lb.id, lb.title || i18n('untitledBox'), sb.id, sb.title || i18n('newLargeBox', ['']?.[0] || ''), null);
        for (const bm of (sb.bookmarks || [])) {
          const bt = (bm.title || '').toLowerCase();
          const bu = (bm.url || '').toLowerCase();
          if (bt.includes(q) || bu.includes(q)) {
            pushHit('bookmark', lb.id, lb.title || i18n('untitledBox'), sb.id, sb.title || '', bm);
          }
        }
      }
    }
    return hits.slice(0, 50);
  }

  function renderSearchResults(hits, q) {
    if (!searchResultsEl) return;
    if (!hits || !hits.length) {
      searchResultsEl.hidden = false;
      searchResultsEl.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'search-results__empty';
      empty.textContent = i18n('searchPlaceholder');
      searchResultsEl.appendChild(empty);
      return;
    }
    searchResultsEl.hidden = false;
    searchResultsEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const h of hits) {
      const item = document.createElement('div');
      item.className = 'search-results__item';
      item.setAttribute('role', 'option');
      item.dataset.hitType = h.type;
      item.dataset.largeId = h.largeId || '';
      item.dataset.smallId = h.smallId || '';
      if (h.bm) item.dataset.bmId = h.bm.id;
      const titleRow = document.createElement('div');
      titleRow.className = 'search-results__item-title';
      titleRow.textContent = h.bm ? (h.bm.title || h.bm.url) : (h.smallTitle || h.largeTitle);
      const meta = document.createElement('div');
      meta.className = 'search-results__item-meta';
      const metaParts = [];
      if (h.type === 'bookmark') metaParts.push('🔖');
      else if (h.type === 'small') metaParts.push('📦');
      else metaParts.push('🗂');
      metaParts.push(h.largeTitle || '');
      if (h.smallTitle) { metaParts.push('›'); metaParts.push(h.smallTitle); }
      meta.textContent = metaParts.join(' ');
      item.appendChild(titleRow);
      item.appendChild(meta);
      if (h.bm && h.bm.url) {
        const urlRow = document.createElement('div');
        urlRow.className = 'search-results__item-url';
        urlRow.textContent = h.bm.url;
        item.appendChild(urlRow);
      }
      item.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        openSearchHit(h);
      });
      frag.appendChild(item);
    }
    searchResultsEl.appendChild(frag);
  }

  function hideSearchResults() {
    if (searchResultsEl) { searchResultsEl.hidden = true; searchResultsEl.innerHTML = ''; }
    clearSearchHighlight();
  }
  function clearSearchHighlight() {
    document.querySelectorAll('.large-box--search-match, .large-box--search-hidden, .small-box--search-match, .small-box--search-hidden').forEach(el => {
      el.classList.remove('large-box--search-match', 'large-box--search-hidden', 'small-box--search-match', 'small-box--search-hidden');
    });
  }
  function applySearchHighlight(hits) {
    clearSearchHighlight();
    const matchIds = new Set();
    for (const h of hits) {
      if (h.largeId) matchIds.add(h.largeId);
    }
    const smallMatchIds = new Set();
    for (const h of hits) {
      if (h.smallId) smallMatchIds.add(h.smallId + '@' + h.largeId);
    }
    document.querySelectorAll('.large-box').forEach(el => {
      const id = el.dataset.id;
      if (matchIds.has(id)) el.classList.add('large-box--search-match');
      else el.classList.add('large-box--search-hidden');
    });
    document.querySelectorAll('.small-box').forEach(el => {
      const sid = el.dataset.id;
      const container = el.closest('.inner__surface');
      if (!container) return;
      const lid = container.dataset.largeId || '';
      const key = sid + '@'+ lid;
      // BX-DEV-133 (B1): old || matchIds.size>0 lit every small box when any large title matched
      if (smallMatchIds.has(key)) {
        el.classList.add('small-box--search-match');
      } else if (smallMatchIds.size > 0 && matchIds.has(lid)) {
        el.classList.add('small-box--search-hidden');
      }
    });
  }

  // navigate to the box/box-context for a search hit.
  // bookmark type: also resolve bookmark editor/open behavior (current vs new tab).
  function openSearchHit(h) {
    if (!h || !h.largeId) return;
    saveLargeBoxViewState(currentLargeBoxId);
    // If we're already inside a large box and it's NOT the same, exit first.
    if (currentLargeBoxId && currentLargeBoxId !== h.largeId) { exitToCanvas(); }
    // Enter target large box (skipPosRestore=true keeps current zoom/pan for snappy locate).
    if (currentLargeBoxId !== h.largeId) enterLargeBox(h.largeId, true);
    if (h.bm && h.bm.url) {
      // Open the bookmark URL — respect urlOpenMode setting if it exists.
      try { openBookmarkUrl(h.bm.url); } catch (_) { /* background or fallback */ }
      searchInput.value = '';
      hideSearchResults();
      updateCaption();
    } else if (h.smallId) {
      // scroll small box into view inside inner canvas (jump pan to sb origin).
      try {
        const sb = getSmallBox(h.largeId, h.smallId);
        if (sb) {
          const sw = innerSurface.clientWidth || innerCanvas.clientWidth || 600;
          const sh = innerSurface.clientHeight || (innerCanvas.clientHeight - 40) || 400;
          // ADR-0015: center-align + clamp (unified with enterAndLocateSmallBox pan formula)
          var bw = (sb.width || 200) * innerZoom;
          var bh = (sb.height || 160) * innerZoom;
          setInnerPanX(Math.max(sw * (1.0 - innerZoom / 0.3), Math.min(0, -sb.x * innerZoom + (sw - bw) / 2)));
          setInnerPanY(Math.max(sh * (1.0 - innerZoom / 0.3), Math.min(0, -sb.y * innerZoom + (sh - bh) / 2)));
          applyInnerTransform();
          if (currentLargeBoxId) saveLargeBoxViewState(currentLargeBoxId);
        }
      } catch (_) { /* no-op */ }
      searchInput.value = '';
      hideSearchResults();
      updateCaption();
    } else {
      searchInput.value = '';
      hideSearchResults();
      updateCaption();
    }
    searchInput.blur();
  }

  // Bug4: Enter a large box and locate/highlight a specific small box.
  // Same mental model as openSearchHit — pan viewport to center the small box,
  // then apply a visible highlight pulse.
 function enterAndLocateSmallBox(largeId, smallId) {
   saveLargeBoxViewState(currentLargeBoxId);
   if (currentLargeBoxId && currentLargeBoxId !== largeId) { exitToCanvas(); }
   if (currentLargeBoxId !== largeId) enterLargeBox(largeId, true);
    // ADR-0015: rAF guard — ensure DOM and innerZoom settled after enterLargeBox
    requestAnimationFrame(function () {
      try {
        const sb = getSmallBox(largeId, smallId);
        if (sb) {
          const sw = innerSurface.clientWidth || innerCanvas.clientWidth || 600;
          const sh = innerSurface.clientHeight || (innerCanvas.clientHeight - 40) || 400;
          // ADR-0015: center-align + clamp (unified with openSearchHit pan formula)
          var bw = (sb.width || 200) * innerZoom;
          var bh = (sb.height || 160) * innerZoom;
          setInnerPanX(Math.max(sw * (1.0 - innerZoom / 0.3), Math.min(0, -sb.x * innerZoom + (sw - bw) / 2)));
          setInnerPanY(Math.max(sh * (1.0 - innerZoom / 0.3), Math.min(0, -sb.y * innerZoom + (sh - bh) / 2)));
          applyInnerTransform();
          if (currentLargeBoxId) saveLargeBoxViewState(currentLargeBoxId);
          // ADR-0015: highlight pulse via outline (escapes contain:layout clipping)
          var targetEl = innerSurface.querySelector('[data-id="' + smallId + '"]') || innerCanvas.querySelector('[data-id="' + smallId + '"]');
          if (targetEl) {
            targetEl.classList.add('small-box--located');
            setTimeout(function () { targetEl.classList.remove('small-box--located'); }, 2000);
          }
        }
      } catch (_) { /* no-op */ }
    });
  }

  // openBookmarkUrl respects settings.urlOpenMode: 'sameTab' (default, ticket 11) or 'newTab'.
  // works for both Chrome (tabs API not available from newtab without permission
  // elsewhere) and Firefox; falls back to window.open.
  function openBookmarkUrl(url) {
    // Ticket 52: only an explicit stored 'newTab' opens a new tab — missing or
    // unknown (legacy-package) values resolve to the sameTab default, mirroring
    // the popups.js bookmark-row contract.
    const mode = layout.settings.urlOpenMode === 'newTab' ? 'newTab' : 'sameTab';
    try {
      if (mode === 'sameTab') {
        // stay in this Boxing tab — navigation will leave the page; boxing state
        // is autosaved by saveLayout on every model mutation.
        window.location.href = url;
      } else {
        // newTab: prefer tabs API if extension context allows; else window.open.
        try {
          if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url }); return;
          } else if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.create) {
            browser.tabs.create({ url }); return;
          }
        } catch (e) { debug('tabs.create via openBookmarkUrl failed', e?.message); }
        window.open(url, '_blank', 'noopener');
      }
    } catch (e) {
      debug('openBookmarkUrl fallback', e && e.message);
      window.open(url, '_blank', 'noopener');
    }
  }

  // ── context menu (right-click → back) ──────────────────
  function onContextMenu(e) {
    if (currentLargeBoxId) {
      e.preventDefault();
      exitToCanvas();
    }
  }

  // ── keyboard ───────────────────────────────────────────
  function onKeyDown(e) {
    if (e.key === '/' && e.target === document.body && !currentLargeBoxId) {
      e.preventDefault(); searchInput.focus();
    }
    if (e.key === 'Escape') {
      if (!settingsModal.hidden) { closeSettingsModal(); return; }
      if (searchInput.value) { searchInput.value = ''; }
      else if (currentLargeBoxId) { exitToCanvas(); }
    }
    // Ctrl+ / Ctrl- zoom
    if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      if (currentLargeBoxId) {
        setInnerZoom(zoomStep(innerZoom, 'in'));
        const ci = clampInnerPan(innerPanX, innerPanY, innerZoom); setInnerPanX(ci.x); setInnerPanY(ci.y);
        applyInnerTransform();
      } else {
        setCanvasZoom(zoomStep(canvasZoom, 'in'));
        const cc = clampCanvasPan(canvasPanX, canvasPanY, canvasZoom); setCanvasPanX(cc.x); setCanvasPanY(cc.y);
        layout.settings.zoomLevel = canvasZoom;
        applyCanvasTransform();
        saveLayout();
      }
    }
    if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      if (currentLargeBoxId) {
        setInnerZoom(zoomStep(innerZoom, 'out'));
        const ci = clampInnerPan(innerPanX, innerPanY, innerZoom); setInnerPanX(ci.x); setInnerPanY(ci.y);
        applyInnerTransform();
      } else {
        setCanvasZoom(zoomStep(canvasZoom, 'out'));
        const cc = clampCanvasPan(canvasPanX, canvasPanY, canvasZoom); setCanvasPanX(cc.x); setCanvasPanY(cc.y);
        layout.settings.zoomLevel = canvasZoom;
        applyCanvasTransform();
        saveLayout();
      }
    }
  }

  // ── dblclick create (also single-click two-quick for new boxes) ─
  function onCanvasClick(e) {
    // Single clicks on boxes are handled by the body click handler
    // Clicks on empty canvas are ignored — use dblclick to create
    const target = e.target.closest('.large-box');
    if (target) {
      // Don't enter from canvas single click — only body click enters
      return;
    }
    // Click on empty canvas — no action (dblclick handles creation)
  }

  function onCanvasDblClick(e) {
    debug('onCanvasDblClick', { clientX: e.clientX, clientY: e.clientY, target: e.target.tagName, className: e.target.className });
    const targetBox = e.target.closest('.large-box');
    if (targetBox) {
      debug('onCanvasDblClick on existing box, entering', targetBox.dataset.id);
      // BX-DEV-112C: suppress stray inner dblclick that synthesizes from the entry click.
      setLastEnterLargeBoxAt(Date.now());
      setSuppressInnerDblClickOnce(true);
      enterLargeBox(targetBox.dataset.id);
      return;
    }
    debug('onCanvasDblClick on empty area, calling addLargeBoxAt');
    e.preventDefault(); // BX-DEV-140c: prevent Chrome dblclick focus-steal
    addLargeBoxAt(e.clientX, e.clientY);
  }

  function onInnerClick(e) {
    const now = Date.now();
    const target = e.target.closest('.small-box');
    if (target) { setLastClickTime(0); return; }
    // Click on empty inner — no action (dblclick handles creation)
  }

  function onInnerDblClick(e) {
    // BX-DEV-112C: If this dblclick is a continuation of the click that
    // triggered enterLargeBox (within 350ms), do NOT create a small box.
    // After 350ms the one-shot flag is auto-cleared so user-initiated
    // dblclicks outside this window still create boxes normally.
    const withinEnterWindow = (Date.now() - lastEnterLargeBoxAt) < 350;
    if (suppressInnerDblClickOnce) {
      if (withinEnterWindow) {
        setSuppressInnerDblClickOnce(false);
        debug('onInnerDblClick suppressed: one-shot from enterLargeBox');
        return;
      } else {
        // Stale one-shot flag; discard so user dblclicks are no longer blocked.
        setSuppressInnerDblClickOnce(false);
      }
    }
    if (withinEnterWindow) {
      debug('onInnerDblClick suppressed: within 350ms of enterLargeBox');
      return;
    }
    const targetBox = e.target.closest('.small-box');
    if (targetBox) return;
    e.preventDefault(); // BX-DEV-140c: prevent Chrome dblclick focus-steal
    addSmallBoxAt(e.clientX, e.clientY);
  }

  // ── window resize → refresh canvas transform ───────────

  function onWindowResize() {
    debug(`window resize: ${window.innerWidth}x${window.innerHeight}`);
    applyCanvasTransform();
    applyInnerTransform();
    debug(`window resize done`);
  }

  // ── init ───────────────────────────────────────────────
  async function init() {
    // Ticket 42 (spec D2): NTP-side COW — consume the install signal BEFORE loadLayout so
    // an update with a pending migration snapshots the stored layout first (the background
    // SW already snapshotted at onInstalled; this is the belt-and-suspenders copy). The
    // reason value is reused by initOnboarding further down. The file:// mock lane has no
    // signal → installReason stays null → legacy behavior untouched.
    let installReason = null;
    try { installReason = await consumeInstallSignal(); } catch (e) { debugWarn('install signal read failed', e); }
    if (installReason === 'update') {
      try { await ensurePreUpdateSnapshot(); } catch (e) { debugErr('pre-update snapshot', e); }
    }
    await loadLayout();
    await loadSettings();
    initSizeObserver();

    // BX-DEV-111: Now that layout is loaded, restore headerPinned from persisted state
    setHeaderPinned(layout.settings.headerPinned !== false);  // true if not explicitly set to false

    // events
    searchInput.addEventListener('input', e => {
      // BX-DEV-121 (Bug9 search): full live search across large boxes, small boxes, bookmarks.
      const q = e.target.value.trim().toLowerCase();
      if (!q) { hideSearchResults(); updateCaption(); return; } /* hideSearchResults now calls clearSearchHighlight */
      const hits = runSearch(q);
      renderSearchResults(hits, q);
      applySearchHighlight(hits);
      if (hits.length) captionEl.textContent = i18n('searchResults', [hits.length]);
      else captionEl.textContent = i18n('searchPlaceholder');
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const list = searchResultsEl.querySelectorAll('.search-results__item');
        if (list.length) list[0].click();
      } else if (e.key === 'Escape') {
        searchInput.value = '';
        hideSearchResults();
        updateCaption();
        searchInput.blur();
      }
    });
    searchInput.addEventListener('blur', e => {
      // Defer hide so item click (mousedown happens AFTER blur in some browsers) can fire.
      setTimeout(hideSearchResults, 180);
    });
    backBtn.addEventListener('click', exitToCanvas);

    // ── header auto-hide ON by default: fullscreen immersive canvas ──

    if (addLargeBtn) addLargeBtn.addEventListener('click', addLargeBox);
    if (addSmallBtn) addSmallBtn.addEventListener('click', addSmallBox);
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
    debug('settingsBtn listener attached, settingsBtn=', !!settingsBtn);

    document.addEventListener('contextmenu', onContextMenu);
    // BX-DEV-137++++: connect mode is now drag-based: mousedown on edge anchor
    // starts connect mode, user drags to target box, mouseup connects to nearest midpoint.
    // BX-142: update provisional SVG line endpoint via rAF throttle.
    // Convert screen coords to surface logical coords: logical = (clientXY - rect.left - panXY) / zoom.
    let _provisionalRafPending = false;
    let _provisionalLastEvent = null;
    document.addEventListener('mousemove', e => {
      if (!connectMode || !provisionalGhost || !provisionalLine) return;
      _provisionalLastEvent = e;
      if (_provisionalRafPending) return;
      _provisionalRafPending = true;
      requestAnimationFrame(() => {
        _provisionalRafPending = false;
        if (!_provisionalLastEvent || !provisionalLine) return;
        const e = _provisionalLastEvent;
        const isInner = provisionalGhost.surface === 'inner';
        const surface = isInner ? innerSurfaceContent : canvasSurface;
        if (!surface) return;
        // Bug 7 fix: surface is the transformed element — rect already includes pan.
        // No additional panX/panY subtraction needed (would double-subtract).
        const rect = surface.getBoundingClientRect();
        const zoom = isInner ? innerZoom : canvasZoom;
        const lx = (e.clientX - rect.left) / zoom;
        const ly = (e.clientY - rect.top) / zoom;
        provisionalLine.setAttribute('x2', Math.round(lx));
        provisionalLine.setAttribute('y2', Math.round(ly));
      });
    }, { passive: true });
    document.addEventListener('mouseup', e => {
      if (!connectMode) return;
      const targetBox = e.target.closest && (e.target.closest('.large-box') || e.target.closest('.small-box'));
      if (!targetBox) { exitConnectMode(null); return; }
      const targetKey = targetBox.dataset.boxKey || targetBox.dataset.id;
      if (targetKey && targetKey !== connectMode.fromId) { exitConnectMode(targetKey); return; }
      // same-box or non-box release → cancel
      exitConnectMode(null);
    }, true);   // capture so we run BEFORE bar's own mouseup handler
    document.addEventListener('keydown', onKeyDown);

    // Canvas mouse events
    canvasContainer.addEventListener('mousedown', onCanvasPanStart);
    canvasContainer.addEventListener('click', onCanvasClick);
    canvasContainer.addEventListener('dblclick', onCanvasDblClick);
    // Phase 5: canvas-empty action button → calls addLargeBox() (统一空态按钮心智模型).
    const canvasEmptyBtn = canvasEmpty ? canvasEmpty.querySelector('.canvas__empty-action') : null;
    if (canvasEmptyBtn) {
      canvasEmptyBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        // BX-DEV-112D: bridge the physical dblclick — click2 and the follow-on
        // dblclick (→ onCanvasDblClick → addLargeBoxAt) must not double-create.
        // Toolbar #add-box stays unguarded so rapid multi-add keeps working.
        if (isWithinCreateCooldown(e.clientX, e.clientY)) { debug('canvas CTA suppressed: create cooldown'); return; }
        markCreate(e.clientX, e.clientY);
        if (layout.boxes.length >= MAX_LARGE_BOXES) { debug('max large boxes (empty-state btn)'); return; }
        // BX-DEV-140c: prevent Chrome click focus-steal (mirror onCanvasDblClick).
        addLargeBox(e);
      });
    }
    // BX-DEV-116: capture-phase wheel on canvas for reliable ctrl+wheel zoom
    canvasContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey) { e.preventDefault(); onCanvasWheel(e); }
    }, { capture: true, passive: false });

    // Inner mouse events
    // Inner canvas: pan (drag empty area) + zoom
    innerSurface.addEventListener('click', onInnerClick);
    innerSurface.addEventListener('dblclick', onInnerDblClick);
    innerCanvas.addEventListener('mousedown', onInnerPanStart);
    // BX-DEV-116: capture-phase ctrl+wheel on inner canvas ensures zoom works even
    // when mouse is over a scrollable small-box__body that would normally consume the event.
    // Use capture phase so the event is intercepted before reaching scrollable children.
    innerCanvas.addEventListener('wheel', (e) => {
      if (e.ctrlKey) { e.preventDefault(); onInnerWheel(e); }
      else if (e.target.classList && (e.target.classList.contains('small-box__body') || e.target.closest('.small-box__body'))) {
        // Plain wheel inside small-box body: let it scroll normally
      }
    }, { capture: true, passive: false });
    // Zoom buttons
    canvasZoomOut?.addEventListener('click', () => {
      setCanvasZoom(zoomStep(canvasZoom, 'out'));
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasTransform();
      saveLayout();
    });
    canvasZoomIn?.addEventListener('click', () => {
      setCanvasZoom(zoomStep(canvasZoom, 'in'));
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasTransform();
      saveLayout();
    });
    innerZoomOut?.addEventListener('click', () => {
      setInnerZoom(zoomStep(innerZoom, 'out'));
      applyInnerTransform();
    });
    innerZoomIn?.addEventListener('click', () => {
      setInnerZoom(zoomStep(innerZoom, 'in'));
      applyInnerTransform();
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
    });

    // Settings modal controls
    bindSettingsUi();

    bindSyncBackupUi();

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // Per-tab session state survives reload but is isolated from every other tab.
    window.addEventListener('pagehide', () => { try { const __fvf = window.__boxingFlushPendingViewStatePersist; if (typeof __fvf === "function") __fvf(); } catch (e) { /* silent: flush helper may not exist */ } persistViewState(false); try { const fn = window.__boxingFlushCredentials; if (typeof fn === 'function') fn(); } catch (e) { /* silent: flush helper may not exist */ } });
    // BX-DEV-111M: flush credentials on tab switch / window hide / beforeunload —
    // fixes the 'close browser loses WebDAV password' bug (blur never fires in those paths).
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { try { const __fvf = window.__boxingFlushPendingViewStatePersist; if (typeof __fvf === "function") __fvf(); } catch (e) { /* silent: flush helper may not exist */ } persistViewState(false); try { const fn = window.__boxingFlushCredentials; if (typeof fn === 'function') fn(); } catch (e) { /* silent: flush helper may not exist */ } } });
    // BX-DEV-120 (Bug8 return freeze): when returning to the Boxing tab after
    // opening a bookmark in a new tab, any lingering dragState/panState + a
    // stalled async storage-write chain could leave the UI trapped. On visibility
    // == visible we proactive release any stuck interaction state and let the
    // view self-heal without a full reload. Safe: no write happens, only state
    // reset + transform re-apply.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        try {
          // BX-DEV-135 (B8): tab-hide may have deferred RO; refresh geometry cache so
          // the re-applied transform does not use a stale container/surface size
          try { if (typeof refreshContainerSizes === 'function') refreshContainerSizes(); } catch (e) { /* silent: container sizes refresh, non-critical */ }
          if (panState && typeof onCanvasPanEnd === 'function') onCanvasPanEnd({ type: 'visibilitychange' });
          if (panState && typeof onInnerPanEnd === 'function') onInnerPanEnd({ type: 'visibilitychange' });
          if (typeof dragState === 'object' && dragState && typeof onBoxDragEnd === 'function') {
            // simulate a final mouseup so drag won't get stuck mid-pending
            onBoxDragEnd({ type: 'visibilitychange', clientX: 0, clientY: 0 });
          }
          // re-apply transforms from current vars — no extra read from storage
          if (currentLargeBoxId) { applyInnerTransform(); }
          else { applyCanvasTransform(); }
        } catch (e) { debugWarn('visibility-visible recovery', e); }
      }
    });
    window.addEventListener('beforeunload', () => { try { const __fvf = window.__boxingFlushPendingViewStatePersist; if (typeof __fvf === "function") __fvf(); } catch (e) { /* silent: flush helper may not exist */ } try { const fn = window.__boxingFlushCredentials; if (typeof fn === 'function') fn(); } catch (e) { /* silent: flush helper may not exist */ } });

    registerStorageOnChanged();

    const navigationType = performance.getEntriesByType?.('navigation')?.[0]?.type;
    let view = null;
    try {
      const key = navigationType === 'reload' ? TAB_VIEW_KEY : LAST_ACTIVE_VIEW_KEY;
      view = JSON.parse((navigationType === 'reload' ? sessionStorage : localStorage).getItem(key) || 'null');
      // BX-DEV-111L: when sessionStorage is gone (fresh browser launch), fall back to permanent LRU history.
      if (!view) { view = loadFallbackTabView(); debug('view restore: using permanent history fallback', !!view); }
    } catch (e) { debugWarn('view restore', e); }

    const shouldRestoreView = navigationType === 'reload' || layout.settings.rememberLastPos !== false;
    if (view && shouldRestoreView) {
      setCanvasZoom(Number(view.canvasZoom) || 1);
      setCanvasPanX(Number(view.canvasPanX) || 0);
      setCanvasPanY(Number(view.canvasPanY) || 0);
      setInnerZoom(Number(view.innerZoom) || 1);
      setInnerPanX(Number(view.innerPanX) || 0);
      setInnerPanY(Number(view.innerPanY) || 0);
      if (view.headerPinned !== undefined) setHeaderPinned(view.headerPinned);
    }

    if (view?.currentLargeBoxId && getLargeBox(view.currentLargeBoxId)) {
      enterLargeBox(view.currentLargeBoxId, true);
    } else {
      renderCanvas();
      applyCanvasTransform();
    }
    // BX-ONBOARDING: first-run guided tour — trigger from the onInstalled install/update signal
    // (ADR-0016). installReason was consumed before loadLayout (ticket 42) so the update path
    // could snapshot first; the file:// mock lane has no signal and falls back to the legacy
    // empty-canvas judgment inside initOnboarding (ticket-03 lesson).
    try { initOnboarding({ reason: installReason }); } catch (e) { debugErr('onboarding init', e); }
    persistViewState(true);
    debug('init complete ' + __boxingVersion(), { boxes: layout.boxes.length, lang: currentLang, zoom: canvasZoom, fontSize: layout.settings.fontSize, headerPinned, darkMode: layout.settings.darkMode });
  }


  await init();
  // ADR-0006: install global keydown listener if select+delete mode is active at startup
  try { applyConnDeleteKeydoc(); } catch (e) { /* silent: conn delete keydoc init, feature may be absent */ }
})();
