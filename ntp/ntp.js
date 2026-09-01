/** Boxing — NTP core v3.1: Obsidian-style infinite canvas, manual drag (real-time), title-only edit zone, elastic snap, bookmark CRUD, i18n store, settings modal, debug */
'use strict';
// Ticket 03 (architecture-recovery): favicon cache block extracted verbatim to ./favicon.js — first ES module of the zero-build pipeline (spec.md).
import { loadFavicon } from './favicon.js';
// Ticket 06 (architecture-recovery): shared mutable state moved verbatim to ./state.js —
// single explicit state module (ESM live-binding singleton). Reads bind live; every write
// goes through a set*() setter (imported bindings are read-only in ESM).
import {
  MAX_LARGE_BOXES, MAX_SMALL_BOXES, MAX_BOOKMARKS, writerId, MAX_CONNECTIONS,
  LINE_POOL_CAP, __viewStatePersistTimers, __selfLastWriteTs, boxById, smallBoxById, connLines,
  connById, dirtyConns, connIdx, boxConnIdx, __linePool, boxGroupId,
  groupMembers, groupStar, groupIdx, __popupTrackers,
  layout, currentLargeBoxId, canvasZoom, innerZoom, canvasPanX, canvasPanY,
  innerPanX, innerPanY, dragState, resizeState, panState, lastClickTime,
  lastClickTarget, lastDragEndTime, lastEnterLargeBoxAt, suppressInnerDblClickOnce, lastDragEndId, headerPinned,
  scrollTimeout, idSequence, clearedTombstones,
  __dsuDirty, __nextGroupId, canvasConnSvg, innerConnSvg, connectMode, provisionalLine,
  provisionalGhost, selectedConnId, confirmCallback, __sizeObserver, __connRefreshRAF,
  setLayout, setCurrentLargeBoxId, setCanvasZoom, setInnerZoom, setCanvasPanX, setCanvasPanY,
  setInnerPanX, setInnerPanY, setDragState, setResizeState, setPanState, setLastClickTime,
  setLastClickTarget, setLastDragEndTime, setLastEnterLargeBoxAt, setSuppressInnerDblClickOnce, setLastDragEndId, setHeaderPinned,
  setScrollTimeout, setIdSequence, setClearedTombstones,
  setDsuDirty, setNextGroupId, setCanvasConnSvg, setInnerConnSvg, setConnectMode, setProvisionalLine,
  setProvisionalGhost, setSelectedConnId, setConfirmCallback, setSizeObserver, setConnRefreshRAF,
} from './state.js';
import { CANVAS_GRID, INNER_GRID, LARGE_DEF_H, LARGE_DEF_W, LARGE_MIN_H, LARGE_MIN_W, MAX_ZOOM, MIN_ZOOM, RESIZE_SNAP, SMALL_DEF_H, SMALL_DEF_W, SMALL_MIN_H, SMALL_MIN_W, SPATIAL_THRESHOLD, ZOOM_STEPS, buildSpatialGrid, elasticSnap, hexToRgbTriplet, largeKey, mergeById, migrateLayout, normalizeBookmarkUrl, querySpatialNearby, screenToWorld, smallKey, snapCanvas, snapInner } from './utils.js';
import { initI18n, loadI18nStore, i18n, applyI18n, currentLang, SUPPORTED_LANGS } from './i18n.js';
// Ticket 07 (architecture-recovery): storage write facade — write chain + loop guard +
// onChanged listener moved verbatim to ./storage.js; all chrome.storage writes go through it.
import { TOMBSTONE_TTL_MS, applyExternalLayout, directSetBoxingLayout, gcTombstones, initStorageFacade, loadLayout, markDeleted, registerStorageOnChanged, saveLayout, saveLayoutDebounced, saveSnapshot, stripGroupsForPersist } from './storage.js';
// Ticket 08 (architecture-recovery): layout/view-state persistence + theme packs + loadSettings moved verbatim to ./persist.js on top of the storage facade.
import { LAST_ACTIVE_VIEW_KEY, TAB_VIEW_KEY, applyTheme, initPersistFacade, loadFallbackTabView, loadSettings, persistViewState, saveLargeBoxViewState, scheduleLargeBoxViewStatePersist } from './persist.js';
// Ticket 08 (architecture-recovery): render pipeline moved verbatim to ./render.js — conn SVG layer (culling/LOD/pool, ADR-0004),
// DSU groups, pan/zoom transforms, drag handlers, canvas render + box CRUD + bookmark UI. Diffs = export prefixes only.
import { _execDeleteLargeBox, _execDeleteSmallBox, addConnection, addLargeBox, addLargeBoxAt, addMember, addSmallBox, addSmallBoxAt, allValidKeys, applyCanvasTransform, applyConnDeleteKeydoc, applyInnerTransform, clampCanvasPan, clampInnerPan, commit, deleteConnById, disposeAllConns, dsuRebuildFromConnections, ensureConnArrays, ensureGroups, enterConnectMode, enterLargeBox, exitConnectMode, exitToCanvas, getConnDeleteTrigger, getGroupByParent, getLargeBox, getSmallBox, initRenderFacade, initSizeObserver, innerSurfaceContent, isWithinCreateCooldown, markCreate, markDsuDirty, moveGroupTogether, onBoxDragEnd, onCanvasPanEnd, onCanvasPanStart, onCanvasWheel, onInnerPanEnd, onInnerPanStart, onInnerWheel, pruneConnArrays, refreshAllConns, refreshContainerSizes, removeConnection, renderCanvas, renderConnections, renderCrumbs, renderInnerSurface, resolveBoxEl, setConnDeleteAction, showBoxDeletedWarning, toggleStarMark, updateAutohideUI, zoomStep } from './render.js';

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
          get: async (_keys) => { try { const v = localStorage.getItem('boxingLayout'); return v ? { boxingLayout: JSON.parse(v) } : { boxingLayout: null }; } catch (_) { return { boxingLayout: null }; } },
          set: async (obj) => { try { localStorage.setItem('boxingLayout', JSON.stringify(obj.boxingLayout)); } catch (e) { if (typeof debugErr === 'function') debugErr('mock storage.set failed', e); throw e; } }
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
  initStorageFacade({ api, debug, debugErr, debugWarn, persistViewState, pruneConnArrays, rebuildBoxMaps, markDsuDirty, ensureGroups, dsuRebuildFromConnections, getLargeBox, renderCanvas, renderInnerSurface, renderCrumbs, updateCaption, applyInnerTransform, renderConnections, syncSettingsDOM, showBoxDeletedWarning });

  // ── constants ──────────────────────────────────────────
  const DEBUG = true;
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
    normalizeBookmarkUrl(value) { return normalizeBookmarkUrl(value); },
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
  // BX-DEV-120: urlOpenMode select — bookmarks open in newTab (default) or sameTab.
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
  const importBtn = $('#import-data-btn');
  const importFile = $('#import-file-input');
  // BX-AUD-05 UI surfaces — diagnostics export/clear/level.
  const diagExportLogBtn = $('#diag-export-log-btn');
  const diagClearLogBtn = $('#diag-clear-log-btn');
  const diagLogLevelSelect = $('#diag-log-level-select');
  // Ticket 08: inject ntp.js-scope deps into the persistence module (./persist.js)
  initPersistFacade({ debugWarn, darkModeBtn, getLargeBox });

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
  function syncSettingsDOM() {
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
  function openSettingsModal() {
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

  function closeSettingsModal() {
    // BX-DEV-111M: flush via the globally-exposed helper — flushUnsavedCredentials is defined inside loadSettings()'s
    // closure so the top-level closeSettingsModal cannot reference it directly. window.__boxingFlushCredentials is set
    // during loadSettings() and may be undefined on the very first open before that runs.
    try { const fn = window.__boxingFlushCredentials; if (typeof fn === 'function') fn(); } catch (e) { debugWarn('credential flush on close', e); }
    settingsModal.hidden = true;
  }
  // Expose for Playwright testing
  window._boxingOpenSettings = openSettingsModal;
  window._boxingAddLargeBox = addLargeBox;
  window._boxingAddSmallBox = addSmallBox;
  window._boxingEnterLargeBox = enterLargeBox; // BX-DEV-111k: exposed for test
  window._boxingExitToCanvas = exitToCanvas; // BX-DEV-020: exposed for hidden-override regression test (pair with _boxingEnterLargeBox)
  window._boxingDeleteLargeBox = _execDeleteLargeBox; // BX-DEV-111k: exposed for cross-tab delete test

  // ── confirm modal (in-page, replaces browser confirm()) ──
  function openConfirmModal(type, id, largeId) {
    confirmModal.hidden = false;
    confirmTitle.textContent = i18n('confirmDeleteTitle');
    const bodyText = type === 'large' ? i18n('confirmDeleteLargeBody') : i18n('confirmDeleteSmallBody');
    confirmBody.textContent = bodyText;
    setConfirmCallback(() => {
      if (type === 'large') _execDeleteLargeBox(id);
      else _execDeleteSmallBox(largeId, id);
    });
  }
  function closeConfirmModal() {
    confirmModal.hidden = true;
    setConfirmCallback(null);
  }

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

  // openBookmarkUrl respects settings.urlOpenMode: 'newTab' (default) or 'sameTab'.
  // works for both Chrome (tabs API not available from newtab without permission
  // elsewhere) and Firefox; falls back to window.open.
  function openBookmarkUrl(url) {
    const mode = layout.settings.urlOpenMode || 'newTab';
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
    if (modalClose) modalClose.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettingsModal(); });

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

    // ── Encrypted credential storage (Web Crypto AES-GCM) ───
    const ENC_ALGO = 'AES-GCM'; const ENC_KEY_LEN = 256;
    // BX-CRED-V2: PBKDF2-derived key + AES-GCM. Format = { v:2, s, iv, d } — key derived from a
    // constant app secret + per-record salt so the key is NOT stored alongside ciphertext.
    // Legacy v1 format { k, iv, d } (key bundled with ciphertext) still decrypts for backward compat.
    // Plain-string values are treated as plaintext (migration from pre-encryption backups).
    const CRED_APP_SECRET = 'boxing-sync-cred-v2-app-secret-2024';
    let __credDerivedKeyCache = null; // cached derived key (key derivation is the slowest step)
    function b64ToU8(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
    function u8ToB64(u8) { return btoa(String.fromCharCode(...u8)); }
    async function deriveCredKey(salt) {
      if (__credDerivedKeyCache) return __credDerivedKeyCache;
      const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(CRED_APP_SECRET), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        baseKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['encrypt', 'decrypt']);
      __credDerivedKeyCache = key; // cache: salt is constant across records (per-app) for V2
      return key;
    }
    async function encryptCredential(plaintext) {
      if (!plaintext) return null;
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        __credDerivedKeyCache = null; // refresh per-salt derivation
        const key = await deriveCredKey(salt);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = await crypto.subtle.encrypt({ name: ENC_ALGO, iv }, key, new TextEncoder().encode(plaintext));
        return { v: 2, s: u8ToB64(salt), iv: u8ToB64(iv), d: u8ToB64(new Uint8Array(enc)) };
      } catch (e) { debugErr('encryptCredential failed', e); return null; }
    }
    async function decryptCredential(encObj) {
      if (!encObj) return '';
      // Plain-string (legacy plaintext backup) → return as-is; caller re-encrypts on save.
      if (typeof encObj === 'string') return encObj;
      try {
        // Legacy v1: key bundled with ciphertext.
        if (encObj.k) {
          const rawKey = b64ToU8(encObj.k);
          const key = await crypto.subtle.importKey('raw', rawKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['decrypt']);
          const iv = b64ToU8(encObj.iv); const ct = b64ToU8(encObj.d);
          const dec = await crypto.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
          return new TextDecoder().decode(dec);
        }
        // v2: key derived from app secret + per-record salt.
        if (encObj.v === 2 && encObj.s && encObj.iv && encObj.d) {
          const salt = b64ToU8(encObj.s);
          __credDerivedKeyCache = null;
          const key = await deriveCredKey(salt);
          const iv = b64ToU8(encObj.iv); const ct = b64ToU8(encObj.d);
          const dec = await crypto.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
          return new TextDecoder().decode(dec);
        }
      } catch (e) { debugErr('decryptCredential failed', e); }
      return '';
    }
    // BX-CRED-V2: expose to __boxingDebug for tests.
    window.__boxingEncryptCredential = encryptCredential;
    window.__boxingDecryptCredential = decryptCredential;

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

    // Show last backup time
    function updateLastBackupDisplay() {
      if (lastBackupTimeVal) {
        lastBackupTimeVal.textContent = layout.settings.lastBackupAt ? new Date(layout.settings.lastBackupAt).toLocaleString() : i18n('neverText');
      }
    }
    updateLastBackupDisplay();

    function updateSyncConfigVisibility() {
      const p = syncProviderSelect.value;
      if (remoteBackupZone) remoteBackupZone.hidden = (p !== 'webdav' && p !== 'gist');
      if (webdavConfig) webdavConfig.hidden = p !== 'webdav';
      if (gistConfig) gistConfig.hidden = p !== 'gist';
    }
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
      if (webdavUrlInput) layout.settings.webdavUrl = webdavUrlInput.value.trim();
      if (webdavUserInput) layout.settings.webdavUser = webdavUserInput.value.trim();
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
        if (webdavUrlInput && webdavUrlCur !== (layout.settings.webdavUrl || '')) layout.settings.webdavUrl = webdavUrlCur;
        if (webdavUserInput && webdavUserCur !== (layout.settings.webdavUser || '')) layout.settings.webdavUser = webdavUserCur;
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
      const lvl = layout.settings.syncLevel || 'full';
      if (lvl === 'settingsOnly') return Object.assign({}, layout, { boxes: [], connections: [], groups: [] });
      if (lvl === 'boxesOnly') return Object.assign({}, layout, { settings: null });
      return layout;
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
        return merged;
      } catch (e) {
        debugErr('mergeLayoutFields', e);
        return null; // signal merge failure → fall back to newer-wins
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
          const merged = mergeLayoutFields(cloud, layout);
          if (merged) {
            setLayout(merged);
            layout._meta = layout._meta || {};
            layout._meta.updatedAt = Date.now();
            layout._meta.writerId = writerId;
            layout._meta.revision = (Number(cloud._meta?.revision) || 0) + 1;
            layout.settings.lastSyncAt = Date.now();
            await directSetBoxingLayout(stripGroupsForPersist(layout));
            renderCanvas();
            setBaselineBoxCount(computeBoxCount(layout).total);
            debug('WebDAV sync: field-level merge complete', { boxes: layout.boxes.length });
            return { direction: 'merge', cloudBoxes: cloud.boxes.length, localBoxes: layout.boxes.length, merged: true };
          }
          // Merge failed (same-field divergence) — fall through to newer-wins + warn
          debugWarn('WebDAV sync: field-level merge failed, falling back to newer-wins');
        }
        // ADR-0009: original newer-wins logic
        if (cloudUpdatedAt >= localUpdatedAt && cloud?._meta?.writerId !== writerId) {
          // Cloud is newer or equal-but-different-writer → pull.
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
        const body = JSON.stringify(layout, null, 2);
        await webdavPutLocal(fileUrl, user, pass, body);
        layout.settings.lastSyncAt = Date.now();
        setBaselineBoxCount(computeBoxCount(layout).total);
        saveLayout();
        debug('WebDAV sync: local newer, pushed', { boxes: layout.boxes.length });
        return { direction: 'push', cloudBoxes: cloud.boxes.length, localBoxes: layout.boxes.length };
      }

      // Cloud absent or invalid → upload local.
      const body = JSON.stringify(layout, null, 2);
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
      const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
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

    if (layout.settings.autoBackupInterval >= 3600) setupAutoBackup(layout.settings.autoBackupInterval);

    const autoBackupSelect = document.getElementById('auto-backup-interval');
    autoBackupSelect?.addEventListener('change', () => {
      layout.settings.autoBackupInterval = parseInt(autoBackupSelect.value, 10) || 0;
      setupAutoBackup(layout.settings.autoBackupInterval);
      saveLayout();
    });
    if (layout.settings.autoBackupInterval && autoBackupSelect) autoBackupSelect.value = String(layout.settings.autoBackupInterval);

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
    // BX-ONBOARDING: first-run guided tour — auto-show on fresh install with empty canvas.
    try { initOnboarding(); } catch (e) { debugErr('onboarding init', e); }
    persistViewState(true);
    debug('init complete v3.7.8', { boxes: layout.boxes.length, lang: currentLang, zoom: canvasZoom, fontSize: layout.settings.fontSize, headerPinned, darkMode: layout.settings.darkMode });
  }

  // ── BX-ONBOARDING: first-run guided tour ───────────────────────────────
  function initOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    const freshInstall = !layout.settings.onboardingCompleted && Array.isArray(layout.boxes) && layout.boxes.length === 0;
    if (!freshInstall) { return; }
    const steps = Array.from(overlay.querySelectorAll('.onboarding__step'));
    const dots = Array.from(overlay.querySelectorAll('.onboarding__dot'));
    const prevBtn = document.getElementById('onboarding-prev-btn');
    const nextBtn = document.getElementById('onboarding-next-btn');
    const skipBtn = document.getElementById('onboarding-skip-btn');
    let current = 0;
    function render() {
      steps.forEach((el, i) => { el.hidden = i !== current; });
      dots.forEach((d, i) => { d.classList.toggle('is-active', i === current); });
      if (prevBtn) prevBtn.disabled = current === 0;
      if (nextBtn) {
        const last = current === steps.length - 1;
        nextBtn.textContent = last ? (i18n('onboardingFinish') || 'Get started') : (i18n('onboardingNext') || 'Next');
      }
    }
    function close(commit) {
      overlay.hidden = true;
      layout.settings.onboardingCompleted = true;
      saveLayout();
      // Bug 1 fix: refresh canvas + caption after onboarding so i18n updates immediately
      renderCanvas();
      updateCaption();
      debug('onboarding', commit ? 'completed' : 'skipped');
    }
    prevBtn?.addEventListener('click', () => { if (current > 0) { current--; render(); } });
    nextBtn?.addEventListener('click', () => {
      if (current < steps.length - 1) { current++; render(); }
      else { close(true); }
    });
    skipBtn?.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    // BX-DEV-111O+: onboarding data-restore shortcut — opens Settings > Data and triggers the import
    // file picker so users with an existing JSON backup can pull it in on first run without hunting menus.
    try {
      const restoreBtn = document.getElementById('onboarding-restore-btn');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
          try { close(false); } catch (e) { /* silent: window.close may be blocked */ }
          try {
            if (typeof openSettingsModal === 'function') openSettingsModal();
            const tabBtn = document.querySelector('.settings-nav__item[data-tab="data"]');
            if (tabBtn) tabBtn.click();
            const importBtn = document.getElementById('import-data-btn');
            if (importBtn) importBtn.click();
          } catch (e) { debugErr('onboarding restore open', e); }
        });
      }
    } catch (e) { debugErr('onboarding restore bind', e); }
    // BX-DEV-111O: build onboarding language picker — mirrors the Settings lang-select list.
    try {
      const onbLang = document.getElementById('onboarding-lang-select');
      const ONB_LANG_LABELS = { en: 'English', zh_CN: '简体中文', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', pt_BR: 'Português (Brasil)', ru: 'Русский', ar: 'العربية', hi: 'हिन्दी', th: 'ไทย', vi: 'Tiếng Việt', zh_TW: '繁體中文' };
      if (onbLang) {
        if (!onbLang.options.length) {
          for (const code of SUPPORTED_LANGS) {
            const o = document.createElement('option');
            o.value = code; o.textContent = ONB_LANG_LABELS[code] || code;
            if (code === (layout.settings.selectedLanguage || currentLang)) o.selected = true;
            onbLang.appendChild(o);
          }
        }
        onbLang.addEventListener('change', async () => {
          layout.settings.selectedLanguage = onbLang.value;
          await loadI18nStore(onbLang.value);
          if (langSelect) langSelect.value = onbLang.value;
         render();
         if (typeof applyI18n === 'function') applyI18n();
         if (typeof updateAutohideUI === 'function') updateAutohideUI();
         saveLayout();
         debug('onboarding lang changed', onbLang.value);
        });
      }
    } catch (el) { debugErr('onboarding lang setup', el); }
    overlay.hidden = false;
    render();
  }

  await init();
  // ADR-0006: install global keydown listener if select+delete mode is active at startup
  try { applyConnDeleteKeydoc(); } catch (e) { /* silent: conn delete keydoc init, feature may be absent */ }
})();
