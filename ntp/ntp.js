/** Boxing — NTP core v3.1: Obsidian-style infinite canvas, manual drag (real-time), title-only edit zone, elastic snap, bookmark CRUD, i18n store, settings modal, debug */
'use strict';

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
      } catch (_) { return; }
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

  // ── constants ──────────────────────────────────────────
  const CANVAS_GRID = 24;
  const INNER_GRID = 16;
  const RESIZE_SNAP = 5;
  const LARGE_DEF_W = 320, LARGE_DEF_H = 220;
  const SMALL_DEF_W = 300, SMALL_DEF_H = 340;
  const LARGE_MIN_W = 200, LARGE_MIN_H = 120;
  const SMALL_MIN_W = 180, SMALL_MIN_H = 200;
  const MAX_LARGE_BOXES = 1000;
  const MAX_SMALL_BOXES = 500;
  const MAX_BOOKMARKS = 50;
  const ZOOM_STEPS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5];
  const MIN_ZOOM = 0.3, MAX_ZOOM = 2.0;
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
  const __logRing = []; // FIFO entries newest-at-end; cap LOG_RING_MAX; not persisted to chrome.storage.
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
    addConnection, removeConnection, toggleStarMark, addMember, moveGroupTogether, enterConnectMode, exitConnectMode, getGroupByParent,
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
    exportLog: () => __logRing.map(e => (e.ts + ' ' + e.prefix + ' ' + e.text)).join('\n'),
    clearLog: () => { __logRing.length = 0; return true; },
    LOG_LEVELS: { ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 },
    // BX-DEV-122: expose sync payload helpers for Playwright tests
    get buildSyncPayload() { if (window.__bxSync) return window.__bxSync.buildSyncPayload; return null; },
    get resolveWebDAVFileUrl() { if (window.__bxSync) return window.__bxSync.resolveWebDAVFileUrl; return null; },
    get backupToGist() { if (window.__bxSync) return window.__bxSync.backupToGist; return null; },
    // BX-DEV-126: expose loadFavicon for Playwright tests verifying parallel CDN race.
    loadFavicon,
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
  let i18nStore = {};
  const I18N_FALLBACK = {
    brandName: 'Boxing', brandSub: 'organize bookmarks hierarchically',
    searchPlaceholder: 'Search bookmarks…', settingsTitle: 'Settings',
    closeSettings: 'Close', settingsLanguage: 'Language / 语言',
    rememberLastPos: 'Remember last position', rememberLastPosHint: 'Automatically reopen last visited large box on new tabs',
    fontSizeLabel: 'Font Size', zoomLabel: 'Zoom',
    zoomOut: 'Zoom out', zoomIn: 'Zoom in',
    emptyCanvasTitle: 'No large boxes yet', dblclickHint: 'Double-click canvas to add a large box',
    clickPlusHint: 'or click + above', emptyLargeHint: 'Click to add small boxes',
    emptyInnerHint: 'Click + to add your first small box', emptySmallHint: 'No bookmarks yet',
    clickToOpen: 'Click to open →', footerHint: 'Ctrl+scroll to zoom · Left-drag to pan · / to search · Dblclick to add',
    canvasRoot: 'Canvas', untitledBox: 'Untitled box',
    untitledLargeBox: 'Untitled large box', untitledSmallBox: 'Untitled small box',
    newLargeBox: 'Box $1$', newSmallBox: 'New small box',
    deleteBox: 'Delete box', confirmDeleteLarge: 'Delete this large box and all its small boxes?',
    confirmDeleteSmall: 'Delete this small box?', pin: 'Pin', unpin: 'Unpin',
    largeBoxesCount: '$1$ large boxes', smallBoxesCount: '$1$ small boxes',
    backTooltip: 'Go back', addLargeBoxTooltip: 'Add large box',
    settingsTooltip: 'Open settings', addSmallBoxTooltip: 'Add small box',
    editBookmarkLabel: 'Edit bookmark', addBookmarkBtn: 'Add',
    addBookmarkPlaceholder: 'Paste URL…', bookmarkTitlePlaceholder: 'Bookmark title',
    bookmarkUrlPlaceholder: 'https://…',
    dblclickCreateHint: 'Double-click to create',
    bookmarkSave: 'Save', bookmarkDelete: 'Delete',
    bookmarkEditTitle: 'Edit Bookmark',
    backupNow: 'Backup Now', backupNowHint: 'Create a timestamped backup of all layout data',
    autoBackupInterval: 'Auto-Backup Interval', syncProvider: 'Sync Provider',
    syncProviderHint: 'Boxing stores data in browser sync storage. Choose your provider.',
    squareCorners: 'Square Corners', squareCornersHint: 'Use sharp square corners instead of rounded',
    smallBoxCountLabel: '$1$ small boxes',
    autoExpand: 'Auto expand', autoExpandHover: 'Hover to expand',
    headerPin: 'Pin header', headerPinOn: 'Header pinned', headerPinOff: 'Header unpinned'
    ,
    confirmDeleteTitle: 'Confirm Delete', confirmYes: 'Delete', confirmCancel: 'Cancel',
    confirmDeleteLargeBody: 'Delete this large box and all its small boxes? This action cannot be undone.',
    confirmDeleteSmallBody: 'Delete this small box and all its bookmarks? This action cannot be undone.',
    darkMode: 'Dark Mode', darkModeHint: 'Switch between light and dark appearance',
    exportData: 'Export Data', importData: 'Import Data',
    importSuccess: 'Data imported successfully', importFailed: 'Import failed: invalid data format',
    importTooLarge: 'Import failed: file too large (max 5MB)',
    dblclickCreateHint: 'Double-click to create',
    bookmarkSave: 'Save', bookmarkDelete: 'Delete',
    bookmarkEditTitle: 'Edit Bookmark',
    backupNow: 'Backup Now', backupNowHint: 'Create a timestamped backup of all layout data',
    autoBackupInterval: 'Auto-Backup Interval', syncProvider: 'Sync Provider',
    squareCorners: 'Square Corners', squareCornersHint: 'Use sharp square corners instead of rounded',
    // BX-DEV-111P-v2:补齐 en 字面 fallback 全覆盖 (fix-7)
    accessibilityLabel: 'Keyboard accessible · Screen reader friendly',
    addBoxShortcut: 'Double-click empty area',
    allLanguages: 'All 13 languages translated',
    backupSaved: 'Backup saved',
    bookmarkReorderHint: 'Drag the grip to reorder bookmarks',
    canvasBoundaryHint: 'Canvas has boundaries at 30% zoom level',
    ctrlScrollZoom: 'Ctrl+scroll to zoom',
    dblclickAddBox: 'Double-click to add box',
    debugModeOff: 'Debug: OFF',
    debugModeOn: 'Debug: ON',
    deleteConfirmMessage: 'This action cannot be undone. All bookmarks inside will be removed.',
    diagClearLog: 'Clear Log',
    diagExportLog: 'Export Log',
    diagLogLevelDebug: 'Debug',
    diagLogLevelError: 'Error',
    diagLogLevelInfo: 'Info',
    diagLogLevelLabel: 'Log level',
    diagLogLevelWarn: 'Warning',
    diagNoLogs: 'No log entries yet',
    diagSectionDesc: 'Export a small ring-buffer snapshot of recent Boxing events to help diagnose issues. The buffer holds up to 300 entries and never persists across browser restarts.',
    diagSectionTitle: 'Diagnostics',
    doubleClickToCreateHint: 'Double-click to create',
    dragPanCanvas: 'Drag to pan canvas',
    dragToReorder: 'Drag to reorder',
    emptyBoxDragHint: 'Double-click or click + to add a box',
    emptyCanvasHint: 'Click + to create your first large box',
    escReturnHint: 'Press Esc to return to canvas',
    fontSizeLarge: 'Large',
    fontSizeNormal: 'Normal',
    fontSizeSmall: 'Small',
    headerPinUsage: 'Click ⊙ in canvas top-right: pinned keeps top bar visible, unpinned goes fullscreen',
    langAutoDetect: 'Auto-detect (browser language)',
    lastOpenedBox: 'Last opened box',
    noBookmarksYet: 'No bookmarks yet. Click + to add one.',
    onboardingSkipTour: 'Skip',
  onboardingLangDesc: 'Pick a language for the interface',
    onboardingLangTitle: 'Choose your language',
    onboardingRestore: 'Restore from backup',
    panShortcut: 'Left-drag empty area',
    returnShortcut: 'Right-click or Esc to return',
    rightClickReturnHint: 'Right-click to go back to canvas',
    searchResults: '$1$ results',
    searchShortcut: '/ or Ctrl+F',
    searchSlash: '/ to search',
    settingsCategoryAppearance: 'Appearance',
    settingsCategoryData: 'Data',
    settingsCategoryGeneral: 'General',
    settingsCategorySync: 'Sync & Backup',
    startDragHint: 'Drag titlebar to move box',
    storedDataFound: 'Stored data found',
    undoShortcut: 'Ctrl+Z to undo',
    urlOpenModeCurrentTab: 'Current Tab',
    urlOpenModeHint: 'Choose where bookmarks open when clicked',
    urlOpenModeLabel: 'Open bookmarks in',
    urlOpenModeNewTab: 'New Tab',
    webdavErrBlockedHost: 'WebDAV hosts on private or local network addresses are not allowed',
    webdavErrUrlTooLong: 'WebDAV URL is too long',
    zoomShortcut: 'Ctrl+scroll wheel',
  };
  // Add new v3.6 keys to I18N_FALLBACK
  I18N_FALLBACK.syncLocalOnly = 'Local Only';
  I18N_FALLBACK.syncChrome = 'Chrome Sync';
  I18N_FALLBACK.syncFirefox = 'Firefox Sync';
  I18N_FALLBACK.backupDisabled = 'Disabled';
  I18N_FALLBACK.backupDaily = 'Daily';
  I18N_FALLBACK.backupWeekly = 'Weekly';
  I18N_FALLBACK.backupHourly = 'Hourly';
  I18N_FALLBACK.syncWebDAV = 'WebDAV';
  I18N_FALLBACK.syncGitHubGist = 'GitHub Gist';
  I18N_FALLBACK.webdavUrl = 'WebDAV URL';
  I18N_FALLBACK.webdavUser = 'Username';
  I18N_FALLBACK.webdavPass = 'Password';
  I18N_FALLBACK.gistToken = 'GitHub Token';
  I18N_FALLBACK.gistTokenHint = 'Create a personal access token with gist scope';
  I18N_FALLBACK.gistId = 'Gist ID (auto-filled)';
  I18N_FALLBACK.webdavTestBtn = 'Test Connection';
  I18N_FALLBACK.webdavTestOk = 'WebDAV connection OK';
  I18N_FALLBACK.webdavTestFail = 'WebDAV connection failed';
  I18N_FALLBACK.webdavTesting = 'Testing...';
  I18N_FALLBACK.webdavErrNoUrl = 'WebDAV URL not configured';
  I18N_FALLBACK.webdavErrHttps = 'WebDAV URL must use HTTPS';
  I18N_FALLBACK.webdavErrEmbedded = 'WebDAV URL must not contain embedded credentials';
  I18N_FALLBACK.webdavErrNoPass = 'WebDAV password is empty — re-enter and retry';
  I18N_FALLBACK.webdavErrAuth = 'WebDAV auth failed ($1$) — check credentials';
  I18N_FALLBACK.webdavErrPath = 'WebDAV path not found — check the URL';
  I18N_FALLBACK.webdavErrStatus = 'WebDAV server returned $1$';
  I18N_FALLBACK.webdavErrPut = 'WebDAV PUT failed ($1$)';
  I18N_FALLBACK.webdavErrConflict = 'WebDAV conflict — parent directory may not exist';
  I18N_FALLBACK.webdavErrNetwork = 'Cannot reach WebDAV server — check URL or network';
  I18N_FALLBACK.gistBackupOk = 'Gist backup saved';
  I18N_FALLBACK.gistBackupFail = 'Gist backup failed';
  I18N_FALLBACK.backupTooFrequent = 'Auto-backup skipped: too frequent, minimum interval 1 hour';
  I18N_FALLBACK.lastBackupTime = 'Last backup';
  I18N_FALLBACK.neverText = 'Never';
  I18N_FALLBACK.settingsNavGeneral = 'General';
  I18N_FALLBACK.settingsNavAppearance = 'Appearance';
  I18N_FALLBACK.settingsNavData = 'Data';
  I18N_FALLBACK.settingsNavSync = 'Sync & Backup';
  I18N_FALLBACK.lastPositionLabel = 'Last position';
  I18N_FALLBACK.lastZoomLabel = 'Last zoom';
  I18N_FALLBACK.lastPageLabel = 'Last page';
  I18N_FALLBACK.boxDeletedWarning = 'This box has been deleted. Please refresh the page.';
  I18N_FALLBACK.refreshPage = 'Refresh';

  // BX-DEV-SYNC: WebDAV sync i18n keys
  I18N_FALLBACK.syncNow = 'Sync Now';
  I18N_FALLBACK.syncInProgress = 'Syncing...';
  I18N_FALLBACK.syncOk = 'Sync completed';
  I18N_FALLBACK.syncPullFirstTime = 'Cloud data detected — pulling to this device (first sync)';
  I18N_FALLBACK.syncUploadNewer = 'Local data is newer — uploaded to cloud';
  I18N_FALLBACK.syncCloudNewer = 'Cloud data is newer — updated local from cloud';
  I18N_FALLBACK.syncErrPartialLoss = 'Possible data loss detected ($1$ → $2$ boxes). Abort and restore from cloud?';
  I18N_FALLBACK.syncErrPartialLossTitle = 'Data loss detected';
  I18N_FALLBACK.syncErrCloudRestored = 'Local data restored from cloud ($1$ boxes)';
  I18N_FALLBACK.syncErrCloudRestoreFailed = 'Cloud restore failed: $1$';
  I18N_FALLBACK.syncErrGetFailed = 'WebDAV GET failed ($1$)';
  I18N_FALLBACK.syncErrParseFailed = 'Cloud data is not valid JSON';
  I18N_FALLBACK.onboardingTitle = 'Welcome to Boxing';
  I18N_FALLBACK.onboardingSkipTour = 'Skip';
  I18N_FALLBACK.onboardingPrev = 'Previous';
  I18N_FALLBACK.onboardingNext = 'Next';
  I18N_FALLBACK.onboardingFinish = 'Get started';
  I18N_FALLBACK.onboardingStep1Label = 'Step 1 of 3';
  I18N_FALLBACK.onboardingStep1Title = 'Add your first box';
  I18N_FALLBACK.onboardingStep1Desc = 'Double-click anywhere on the canvas, or click the + button in the toolbar, to create a large box. Large boxes group related small boxes and bookmarks.';
  I18N_FALLBACK.onboardingStep2Label = 'Step 2 of 3';
  I18N_FALLBACK.onboardingStep2Title = 'Nest boxes inside';
  I18N_FALLBACK.onboardingStep2Desc = 'Open a large box, then click + to add small boxes inside it. Each small box holds a list of bookmarks and can be reordered by drag.';
  I18N_FALLBACK.onboardingStep3Label = 'Step 3 of 3';
  I18N_FALLBACK.onboardingStep3Title = 'Sync across devices';
  I18N_FALLBACK.onboardingStep3Desc = 'Open Settings → Sync to connect a WebDAV server. Your boxes sync across browsers and tabs; data is backed up safely with timestamp-based two-way sync.';
  let currentLang = 'en';
  // BX-i18n-LOC: To add a new language, append the code here + update ONB_LANG_LABELS below + create _locales/<code>/messages.json.
  const SUPPORTED_LANGS = ['en', 'zh_CN', 'ja', 'ko', 'fr', 'de', 'es', 'pt_BR', 'ru', 'ar', 'hi', 'th', 'vi', 'zh_TW'];

  async function loadI18nStore(lang) {
    try {
      const url = api.runtime?.getURL?.(`_locales/${lang}/messages.json`) || `_locales/${lang}/messages.json`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      i18nStore = {};
      for (const [k, v] of Object.entries(raw)) {
        i18nStore[k] = (typeof v === 'object' && v.message) ? { message: v.message, placeholders: (v.placeholders || null) } : v;
      }
      currentLang = lang;
      debug(`i18n loaded: ${lang}, ${Object.keys(i18nStore).length} keys`);
    } catch (e) {
      debugErr('i18n load failed, falling back to en', e);
      i18nStore = { ...I18N_FALLBACK };
      currentLang = 'en';
    }
    applyI18n();
  }

  function i18n(key, placeholders) {
    const entry = i18nStore[key];
    let msg, phMap = null;
    if (entry && typeof entry === 'object' && entry.message) {
      msg = entry.message;
      phMap = entry.placeholders || null;
    } else if (typeof entry === 'string') {
      msg = entry;
    } else {
      msg = I18N_FALLBACK[key] || key;
    }
    if (placeholders && Array.isArray(placeholders) && placeholders.length) {
      if (phMap && Object.keys(phMap).length) {
        for (const [name, info] of Object.entries(phMap)) {
          let content = String((info && info.content) || '');
          for (let i = 0; i < placeholders.length; i++) {
            content = content.split('$' + (i + 1)).join(String(placeholders[i]));
          }
          msg = msg.split('$' + name + '$').join(content);
        }
      } else {
        for (let i = 0; i < placeholders.length; i++) { msg = msg.split('$' + (i + 1) + '$').join(String(placeholders[i])); }
      }
    }
    return msg;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = i18n(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = i18n(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = i18n(el.dataset.i18nPlaceholder);
    });
  }

  // ── DOM refs ───────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

  const canvasContainer = $('#canvas');
  const canvasSurface = $('#canvas-surface');
  const canvasEmpty = $('#canvas-empty');
  const canvasZoomOut = $('#canvas-zoom [data-zoom="out"]');
  const canvasZoomIn = $('#canvas-zoom [data-zoom="in"]');
  const canvasZoomVal = $('#canvas-zoom-value');
  const canvasZoomCtrl = $('#canvas-zoom');
  const innerSurface = $('#inner-surface');
  const innerZoomOut = $('#inner-zoom [data-zoom="out"]');
  const innerZoomIn = $('#inner-zoom [data-zoom="in"]');
  const innerZoomVal = $('#inner-zoom-value');
  const innerZoomCtrl = $('#inner-zoom');
  const innerWrapper = $('#inner');
  const innerCanvas = $('#inner-canvas');
  // BX-DEV-134 (B2 perf): ResizeObserver-fed geometry cache. clampCanvasPan/clampInnerPan
  // and onBoxDragEnd worldMaxX/Y read these instead of clientWidth/Height, eliminating
  // the per-mousemove forced layout that 60-120Hz pan/drag caused. Updated by the RO below.
  const canvasContainerSize = { w: 0, h: 0 };
  const innerSurfaceSize = { w: 0, h: 0 };
  let __sizeObserver = null;
  function refreshContainerSizes() {
    canvasContainerSize.w = canvasContainer.clientWidth || 0;
    canvasContainerSize.h = canvasContainer.clientHeight || 0;
    innerSurfaceSize.w = innerSurface.clientWidth || 0;
    innerSurfaceSize.h = innerSurface.clientHeight || 0;
  }
  function initSizeObserver() {
    refreshContainerSizes();
    if (__sizeObserver || typeof ResizeObserver === 'undefined') return;
    __sizeObserver = new ResizeObserver(() => { try { refreshContainerSizes(); } catch (_) {} });
    try { __sizeObserver.observe(canvasContainer); __sizeObserver.observe(innerSurface); } catch (_) {}
  }
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

  // ── state ──────────────────────────────────────────────
  let layout = {
    version: 3.5,
    boxes: [],
    nextLargeIndex: 1,
    settings: {
      selectedLanguage: 'en',
      rememberLastPos: true,
      zoomLevel: 1.0,
      darkMode: false,
      fontSize: 14
    }
  };
  let currentLargeBoxId = null;
  let canvasZoom = 1.0;
  let innerZoom = 1.0;
  // Obsidian-style pan state
  let canvasPanX = 0, canvasPanY = 0;
  let innerPanX = 0, innerPanY = 0;
  // manual drag state
  let dragState = null;
  // resize state
  let resizeState = null;
  // canvas pan state (left-drag empty area)
  let panState = null;
  // double-click detection
  let lastClickTime = 0;
  let lastClickTarget = null;
  let lastDragEndTime = 0;  // skip click if within 60ms of drag end (BX-DEV-065)
let lastEnterLargeBoxAt = 0;  // BX-DEV-112C: time of last enterLargeBox via click/dblclick — used to suppress stray inner dblclick
let suppressInnerDblClickOnce = false;  // BX-DEV-112C: one-shot flag set by enterLargeBox to swallow the next inner dblclick
  let lastDragEndId = null;  // box id just dragged - clears barDownWasDragZone on next click (BX-DEV-077)

  // header auto-hide state (must be declared before functions that reference it)
  let headerPinned = true;  // BX-DEV-111: set after loadLayout reads persisted value
  let scrollTimeout;
  const TAB_VIEW_KEY = 'boxingTabView.v2';
  const LAST_ACTIVE_VIEW_KEY = 'boxingLastActiveView.v2';
  // BX-DEV-111L: permanent tab-view history (survives browser restart). LRU-bounded to prevent heap blow-up.
  const TAB_VIEW_HISTORY_KEY = 'boxingTabViewHistory.v3';
  const MAX_TAB_VIEW_HISTORY = 8;
  // Per-large-box inner view state persisted into layout (auto-syncs across tabs via chrome.storage).
  const writerId = crypto.randomUUID ? crypto.randomUUID() : `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let idSequence = 0;
  function makeId(prefix) {
    idSequence = (idSequence + 1) % Number.MAX_SAFE_INTEGER;
    return `${prefix}-${Date.now().toString(36)}-${writerId.slice(-8)}-${idSequence.toString(36)}`;
  }
  let storageWriteChain = Promise.resolve();
  let applyingExternalLayout = false;
  let saveDebounceTimer = null;
  const MAX_TOMBSTONES = 2000;

  // ── storage ────────────────────────────────────────────
  async function loadLayout() {
    try {
      const data = await layoutStorage.get({ boxingLayout: null });
      if (data.boxingLayout) {
        layout = migrateLayout(data.boxingLayout);
      } else {
        const legacy = layoutStorage === api.storage.sync ? data : await api.storage.sync.get({ boxingLayout: null });
        layout = legacy.boxingLayout ? migrateLayout(legacy.boxingLayout) : defaultLayout();
        if (legacy.boxingLayout && layoutStorage !== api.storage.sync) {
          await layoutStorage.set({ boxingLayout: layout });
          // A6: one-time cleanup — remove stale sync data after successful local migration
          try { await api.storage.sync.remove("boxingLayout"); } catch (_) {}
        }
      }
    } catch (e) { debugErr('loadLayout', e); layout = defaultLayout(); }
  }

  function currentViewSnapshot() {
    return {
      version: 2,
      currentLargeBoxId: currentLargeBoxId || null,
      canvasZoom, canvasPanX, canvasPanY,
      innerZoom, innerPanX, innerPanY,
      headerPinned,
      updatedAt: Date.now()
    };
  }

  function persistViewState(includeLastActive = true) {
    const snap = currentViewSnapshot();
    const serialized = JSON.stringify(snap);
    try { sessionStorage.setItem(TAB_VIEW_KEY, serialized); } catch (e) { debugWarn('tab view save', e); }
    if (includeLastActive && layout.settings.rememberLastPos !== false) {
      try { localStorage.setItem(LAST_ACTIVE_VIEW_KEY, serialized); } catch (e) { debugWarn('last active view save', e); }
    }
    // BX-DEV-111L: permanent LRU history — survives browser close. Used as fallback when sessionStorage is gone.
    try { pushTabViewHistory(snap); } catch (e) { debugWarn('tab view history push', e); }
  }

  function pushTabViewHistory(snap) {
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem(TAB_VIEW_HISTORY_KEY) || '[]'); } catch (_) { hist = []; }
    if (!Array.isArray(hist)) hist = [];
    // Drop stale entries older than 30 days, keep most recent MAX_TAB_VIEW_HISTORY.
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    hist = hist.filter(h => h && typeof h.updatedAt === 'number' && h.updatedAt >= cutoff);
    // Replace any entry sharing the same view signature to avoid dupes of identical state.
    const sig = snap.currentLargeBoxId + ':' + snap.canvasZoom.toFixed(3);
    hist = hist.filter(h => !h || (h.currentLargeBoxId + ':' + Number(h.canvasZoom).toFixed(3)) !== sig);
    hist.push(snap);
    if (hist.length > MAX_TAB_VIEW_HISTORY) hist = hist.slice(hist.length - MAX_TAB_VIEW_HISTORY);
    try { localStorage.setItem(TAB_VIEW_HISTORY_KEY, JSON.stringify(hist)); } catch (_) { /* quota exceeded — fail-soft; in-memory hist still valid this session */ }
  }

  function loadFallbackTabView() {
    try {
      const hist = JSON.parse(localStorage.getItem(TAB_VIEW_HISTORY_KEY) || '[]');
      if (Array.isArray(hist) && hist.length) { const latest = hist[hist.length - 1]; return latest && typeof latest === 'object' ? latest : null; }
    } catch (_) {}
    return null;
  }

  window.__boxingClearTabViewHistory = function () { try { localStorage.removeItem(TAB_VIEW_HISTORY_KEY); localStorage.removeItem(LAST_ACTIVE_VIEW_KEY); localStorage.removeItem(TAB_VIEW_KEY); sessionStorage.removeItem(TAB_VIEW_KEY); } catch (_) {} return true; };

  // BX-DEV-111N: persist the inner canvas zoom/pan into the large box record so it survives tab/browser close
  // and syncs across tabs via chrome.storage.onChanged. Cheap write — called on pan-end/zoom-end/exit.
  function saveLargeBoxViewState(boxId) {
    if (!boxId) return;
    const lb = getLargeBox(boxId);
    if (!lb) return;
    const ts = Date.now();
    lb.viewState = { innerZoom: innerZoom, innerPanX: innerPanX, innerPanY: innerPanY, updatedAt: ts };
    // BX-DEV-111N+v2: record this tab's own write timestamp per box so applyExternalLayout
    // can compare incoming.viewState.updatedAt against what *this* tab last wrote, not
    // against layout._meta.updatedAt (which mergeConcurrentLayout already overwrote).
    try { __selfLastWriteTs.set(boxId, ts); } catch (e) { debugWarn('selfLastWriteTs set', e); }
    // Drop stale view states across all boxes (>90 days). Prune at most once per hour to
    // keep the hot path cheap during continuous pan/zoom.
    try {
      if (Date.now() - __lastViewStatePruneTs > 3600000) {
        __lastViewStatePruneTs = Date.now();
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        for (const b of layout.boxes) if (b.viewState && b.viewState.updatedAt < cutoff) delete b.viewState;
      }
    } catch (e) { debugWarn('saveLargeBoxViewState prune', e); }
    saveLayout();
  }
  window.__boxingSaveLargeBoxViewState = saveLargeBoxViewState;
  // BX-DEV-111N+v2 : millisecond-grade cross-tab viewState propagation. Per-box 80ms
  // throttle (up from 25ms) keeps pan/zoom writes under chrome.storage.sync
  // MAX_WRITE_OPERATIONS_PER_MINUTE=1200 (=20/sec) quota with a 4x safety margin.
  // Each large box has its OWN timer (Map<boxId, timerHandle>) so switching boxes
  // mid-pan no longer overwrites a different box's pending write.
  const __viewStatePersistTimers = new Map();
  const __selfLastWriteTs = new Map();
  let __lastViewStatePruneTs = 0;
  function scheduleLargeBoxViewStatePersist(boxId) {
    if (!boxId) return;
    // Always refresh the in-memory snapshot first so even a tab that reads via
    // applyExternalLayout before the timer fires sees fresh values.
    try {
      const lb = getLargeBox(boxId);
      if (lb) lb.viewState = { innerZoom: innerZoom, innerPanX: innerPanX, innerPanY: innerPanY, updatedAt: Date.now() };
    } catch (e) { debugWarn('scheduleLargeBoxViewStatePersist snapshot', e); }
    if (__viewStatePersistTimers.has(boxId)) return;
    const handle = setTimeout(() => {
      __viewStatePersistTimers.delete(boxId);
      // saveLargeBoxViewState already updates lb.viewState + saveLayout(); reusing it
      // keeps the single-writer path and quota/error handling in one place.
      try { saveLargeBoxViewState(boxId); } catch (e) { debugWarn('throttled viewState persist', e); }
    }, 80);
    __viewStatePersistTimers.set(boxId, handle);
  }
  window.__boxingScheduleLargeBoxViewStatePersist = scheduleLargeBoxViewStatePersist;
  // BX-DEV-111N+v2 : flush all pending per-box view-state timers immediately. Called on
  // pagehide / visibilitychange=hidden / beforeunload so a tab close never loses the last
  // pan/zoom that was sitting in an 80ms timer window. Synchronous save so the browser
  // has the storage write before it tears down the page.
  function flushPendingViewStatePersist() {
    try {
      for (const [boxId, handle] of __viewStatePersistTimers) {
        clearTimeout(handle);
        try { saveLargeBoxViewState(boxId); } catch (e) { debugWarn('flush viewState persist', e); }
      }
      __viewStatePersistTimers.clear();
    } catch (e) { debugWarn('flushPendingViewStatePersist', e); }
  }
  window.__boxingFlushPendingViewStatePersist = flushPendingViewStatePersist;

  function mergeById(localItems, remoteItems, tombstones) {
    const local = (localItems || []).filter(item => item?.id && !tombstones.has(item.id));
    const known = new Set(local.map(item => item.id));
    for (const item of remoteItems || []) if (item?.id && !known.has(item.id) && !tombstones.has(item.id)) local.push(item);
    return local;
  }

  function mergeConcurrentLayout(localValue, remoteValue) {
    if (!remoteValue) return localValue;
    const localDeleted = localValue._meta?.deleted || {};
    const remoteDeleted = remoteValue._meta?.deleted || {};
    const deleted = { ...remoteDeleted, ...localDeleted };
    const tombstones = new Set(Object.keys(deleted));
    const boxes = mergeById(localValue.boxes, remoteValue.boxes, tombstones);
    // AUD-PERF: pre-index remote boxes & children by id to avoid O(N²) nested find
    // loops during cross-tab/cross-device merge (essential for engineering-scale layouts).
    const remoteBoxMap = new Map();
    for (const rb of (remoteValue.boxes || [])) if (rb?.id) remoteBoxMap.set(rb.id, rb);
    for (const localBox of boxes) {
      const remoteBox = remoteBoxMap.get(localBox.id);
      if (!remoteBox) continue;
      localBox.children = mergeById(localBox.children, remoteBox.children, tombstones);
      const remoteChildMap = new Map();
      for (const rc of (remoteBox.children || [])) if (rc?.id) remoteChildMap.set(rc.id, rc);
      for (const localChild of localBox.children) {
        const remoteChild = remoteChildMap.get(localChild.id);
        if (remoteChild) localChild.bookmarks = mergeById(localChild.bookmarks, remoteChild.bookmarks, tombstones);
      }
    }
    const trimmedDeleted = Object.fromEntries(Object.entries(deleted).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, MAX_TOMBSTONES));
    // BX-DEV-137++: explicit merge of connections/groups — spread alone lets
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
    return {
      ...remoteValue,
      ...localValue,
      boxes,
      nextLargeIndex: Math.max(Number(localValue.nextLargeIndex) || 1, Number(remoteValue.nextLargeIndex) || 1),
      settings: { ...(remoteValue.settings || {}), ...(localValue.settings || {}) },
      connections: mergeByIdUnion(localValue.connections, remoteValue.connections),
      _meta: { ...(remoteValue._meta || {}), ...(localValue._meta || {}), deleted: trimmedDeleted }
    };
  }

  function markDeleted(...ids) {
    const deleted = { ...(layout._meta?.deleted || {}) };
    const at = Date.now();
    for (const id of ids) if (id) deleted[id] = at;
    layout._meta = { ...(layout._meta || {}), deleted };
  }

  async function saveLayout() {
    storageWriteChain = storageWriteChain.then(async () => {
      debug('saveLayout called, boxCount=' + layout.boxes.length + ' nextLargeIndex=' + layout.nextLargeIndex);
      persistViewState(true);
      layout.settings.headerPinned = headerPinned;
      try { pruneConnArrays(); } catch (_) {}
      const stored = await layoutStorage.get({ boxingLayout: null });
      const remote = stored.boxingLayout ? migrateLayout(stored.boxingLayout) : null;
      layout = mergeConcurrentLayout(layout, remote);
      const revision = Math.max(Number(layout._meta?.revision) || 0, Number(remote?._meta?.revision) || 0) + 1;
      layout._meta = { ...(layout._meta || {}), revision, updatedAt: Date.now(), writerId };
      // BX-AUD-04: explicit chrome.storage.sync quota failure handling — sets a user-visible flag
      // and writes a emergency localStorage snapshot so data is never silently lost.
      try {
        await layoutStorage.set({ boxingLayout: JSON.parse(JSON.stringify(layout)) });
        if (layout.settings && layout.settings.__lastSaveError) { layout.settings.__lastSaveError = null; }
      } catch (e) {
        debugErr('saveLayout: set failed (quota?) — writing fallback snapshot', e);
        try {
          if (layout.settings) layout.settings.__lastSaveError = (e && e.message ? e.message : String(e)) + ' @ ' + new Date().toISOString();
          localStorage.setItem('boxingLayoutFallback.v1', JSON.stringify(layout));
        } catch (_fbErr) { debugErr('saveLayout: fallback snapshot also failed', _fbErr); }
        // Rethrow so the storage-write-chain catch below records it; the next saveLayout will retry.
        throw e;
      }
      debug('saveLayout done, revision=' + revision);
    });
    try { await storageWriteChain; } catch (e) { debugWarn('saveLayout', e); }
  }

  function saveLayoutDebounced() {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null;
      saveLayout();
    }, 120);
  }

  function defaultLayout() {
    return {
      version: 3.5, boxes: [], nextLargeIndex: 1, connections: [], groups: [],
      settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14, squareCorners: false, autoBackupInterval: 86400, headerPinned: true, syncProvider: 'local' }
    };
  }

  function migrateLayout(raw) {
    if (!raw) return defaultLayout();
    // BX-DEV-085: Data integrity — version >= 3 returns as-is; no data loss on downgrade.
    // Unknown future versions (>= 4) are still accepted to prevent upgrade-then-downgrade data loss.
    if (raw.version >= 3) {
      const defaults = defaultLayout();
      return {
        ...defaults,
        ...raw,
        boxes: Array.isArray(raw.boxes) ? raw.boxes : [],
        connections: Array.isArray(raw.connections) ? raw.connections : [],
        groups: Array.isArray(raw.groups) ? raw.groups : [],
        settings: { ...defaults.settings, ...(raw.settings || {}) }
      };
    }
    if (raw.version === 2) {
      return {
        version: 3.5,
        boxes: (raw.boxes || []).map(b => ({
          ...b, width: b.width || LARGE_DEF_W, height: b.height || LARGE_DEF_H,
          nextSmallIndex: (b.children?.length || 0) + 1,
          children: (b.children || []).map(s => ({
            ...s, width: s.width || SMALL_DEF_W, height: s.height || SMALL_DEF_H,
            pinned: s.pinned !== false, bookmarks: s.bookmarks || []
          }))
        })),
        nextLargeIndex: (raw.boxes?.length || 0) + 1,
        settings: raw.settings || { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14, syncProvider: 'local' }
      };
    }
    return defaultLayout();
  }

  async function loadSettings() {
    // Auto-detect browser language on first run (English default means not user-selected)
    if (!layout.settings.selectedLanguage || layout.settings.selectedLanguage === 'en') {
      const bl = (navigator.language || navigator.userLanguage || '').replace('-', '_');
      if (SUPPORTED_LANGS.includes(bl)) layout.settings.selectedLanguage = bl;
      else { const short = bl.split('_')[0]; const match = SUPPORTED_LANGS.find(l => l.startsWith(short)); if (match) layout.settings.selectedLanguage = match; }
    }
    const lang = layout.settings.selectedLanguage || 'en';
    if (!SUPPORTED_LANGS.includes(lang)) layout.settings.selectedLanguage = 'en';
    await loadI18nStore(layout.settings.selectedLanguage);
    canvasZoom = layout.settings.zoomLevel || 1.0;
    innerZoom = layout.settings.zoomLevel || 1.0;
    const fs = layout.settings.fontSize || 14;
    document.documentElement.style.setProperty('--font-size-base', fs + 'px');

    // dark mode
    if (layout.settings.darkMode) {
      document.getElementById('app').classList.add('ntp--dark');
      document.body.classList.add('ntp--dark');
      if (darkModeBtn) darkModeBtn.querySelector('span').textContent = '☽';
    }
    // square corners
    if (layout.settings.squareCorners) {
      document.getElementById('app').classList.add('ntp--square-corners');
    }
  }

  // ── helpers ────────────────────────────────────────────
  function getLargeBox(id) { return layout.boxes.find(b => b.id === id); }

  // ── Box Connections / Groups (BX-DEV-137) ────────────────────────────
  // leader-line draws mid-edge SVG between two DOM elements; we vendored
  // vendor/leader-line.min.js (MIT, zero-deps) into ntp/index.html. The lib's
  // `socket: 'auto'` picks the nearest edge midpoint; active-connect mode lets
  // the user click box A then box B; a star-mark makes a box the parent of a
  // group so dragging the parent averages the members and snaps them together.
  const MAX_CONNECTIONS = 5000; // ponytail: bounded; upgrade to pagination past 5k
  // BX-142: SVG-based connection layer — replaces LeaderLine.
  // SVG overlay lives INSIDE the transform surface, so line coords = box logical coords.
  // No BCR reads, no transform-commit timing issues, lines clipped by surface overflow.
  const connLines = new Map();          // connId -> SVG <line> element
const connById = new Map();            // connId -> connection object (O(1) lookup)
  const dirtyConns = new Set();         // connIds needing path update
  const connIdx = new Map();              // O(1) conn lookup by key-pair
  const boxConnIdx = new Map();            // O(1) reverse: boxKey -> Set<connId>
  // BX-DSU: Union-Find with path compression for O(α) group connectivity
  const boxGroupId = new Map();      // boxKey -> groupId (DSU find root)
  const groupMembers = new Map();    // groupId -> Set<boxKey> (all members)
  const groupStar = new Set();       // boxKeys marked as parent (starred)
  const groupIdx = new Map();       // kept for compat: parentId -> group object
  let canvasConnSvg = null;     // SVG overlay inside canvasSurface
  let innerConnSvg = null;     // SVG overlay inside innerSurfaceContent
  let connectMode = null;               // { fromId, fromEl, fromSide } | null
  let provisionalLine = null;        // temp SVG <line> during drag
  let provisionalGhost = null;      // { x, y } logical coords of drag endpoint

  function ensureConnArrays() {
    if (!Array.isArray(layout.connections)) layout.connections = [];
  }
  function pruneConnArrays(onSave) {
    ensureConnArrays();
    // Tiered-key aware: build set of all valid 'large:' + 'small:' keys.
    // Also accept legacy raw-id connections (Round 1 format) for back-compat.
    const validKeys = allValidKeys();
    const rawIds = new Set(layout.boxes.map(b => b.id));
    const isValidKey = k => validKeys.has(k) || rawIds.has(k);   // tiered or legacy
    layout.connections = layout.connections.filter(c => isValidKey(c.from) && isValidKey(c.to) && c.from !== c.to);
    // ponytail: O(n) prune on save only — runs once per saveLayout, not hot path.
    if (layout.connections.length > MAX_CONNECTIONS) {
      layout.connections = layout.connections.slice(layout.connections.length - MAX_CONNECTIONS);
    }
    // Groups: parentId and members may be tiered keys or legacy raw ids.
    // A5: layout.groups pruned via box.isParent — no separate filter needed
  }

  function findConn(from, to) {
    if (connIdx.size > 0) return connIdx.get(from + '>' + to) || null;
    // ponytail: fallback linear scan — connIdx not yet built (before first renderConnections)
    return layout.connections.find(c =>
      (c.from === from && c.to === to) || (c.from === to && c.to === from)) || null;
  }

  function addConnection(fromId, toId) {
    ensureConnArrays();
    if (fromId === toId) return false;
    if (findConn(fromId, toId)) return false;     // dedupe
    layout.connections.push({
      id: 'conn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      from: fromId, to: toId, createdAt: Date.now()
    });
    // BX-DSU: union the two boxes' groups when a connection is created
    dsuUnion(fromId, toId);
    // Bug 4: auto-join connection endpoints to a starred parent group.
    // If from is a starred parent, the to-end joins as a member;
    // if to is a starred parent, the from-end joins as a member.
    if (getGroupByParent(fromId)) addMember(fromId, toId);
    else if (getGroupByParent(toId)) addMember(toId, fromId);
    return true;
  }

  function removeConnection(connId) {
    ensureConnArrays();
    layout.connections = layout.connections.filter(c => c.id !== connId);
    connById.delete(connId);
    // BX-DSU: rebuild group connectivity after connection removal
    dsuRebuildFromConnections();
  }

  // ── ARCHITECTURAL INVARIANT ──────────────────────────────────────────
  // Any code that clears a transform surface (canvasSurface.innerHTML = ''
  // or innerSurfaceContent.innerHTML = '') MUST call disposeAllConns() first.
  // Without this, connLines Map holds stale SVG refs and renderConnections()
  // skips rebuild — lines become invisible forever. Call sites:
  //   L/renderCanvas:    disposeAllConns() → canvasSurface.innerHTML = ''
  //   L/renderInnerSurface: disposeAllConns() → content.innerHTML = ''
  //   L/applyExternalLayout: disposeAllConns() → renderInnerSurface(lb)
  //   L/enterLargeBox:   disposeAllConns() → renderInnerSurface(lb)
  //   L/exitLargeBox:    disposeAllConns() → renderCanvas()
  // ── END INVARIANT ──────────────────────────────────────────────────────
  function disposeAllConns() {
    for (const line of connLines.values()) {
      try { line.remove(); } catch (_) {}
    }
    connLines.clear();
    dirtyConns.clear();
    boxConnIdx.clear();
    connById.clear();
    if (__connRefreshRAF) { cancelAnimationFrame(__connRefreshRAF); __connRefreshRAF = 0; }
    // Clear SVG overlay DOM too
    if (canvasConnSvg) { while (canvasConnSvg.firstChild) canvasConnSvg.removeChild(canvasConnSvg.firstChild); }
    if (innerConnSvg) { while (innerConnSvg.firstChild) innerConnSvg.removeChild(innerConnSvg.firstChild); }
  }

  // BX-DEV-137++++: edge-midpoint connection hotspots — 4 anchors per box for initiating connections.
  function addEdgeAnchors(el, boxKey) {
    if (!el || el.querySelector('.box-edge-anchor')) return;  // already has anchors
    const sides = ['top', 'bottom', 'left', 'right'];
    for (const side of sides) {
      const a = document.createElement('div');
      a.className = 'box-edge-anchor box-edge-anchor--' + side;
      a.dataset.boxKey = boxKey;
      a.dataset.side = side;
      a.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        enterConnectMode(boxKey, el, e.clientX, e.clientY);
      });
      el.appendChild(a);
    }
  }

  // BX-142: Get or create the SVG overlay inside a transform surface.
  // SVG lives INSIDE the surface so it inherits pan/zoom — no BCR, no timing hacks.
  function getConnSvg(surface, layerVar) {
    if (layerVar && surface.contains(layerVar)) return layerVar;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'conn-layer');
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
    // Add arrow marker definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'conn-arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 8 5 L 0 10 z');
    path.setAttribute('fill', 'var(--connection-color, #333)');
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);
    surface.insertBefore(svg, surface.firstChild);
    return svg;
  }

  // Compute the mid-point of a box edge in logical (untransformed) coords.
  // Since SVG is inside the transform surface, we use raw box x/y/w/h.
  // BX-DEV-137+++++: title bar center anchor for auto-expand boxes.
  // For collapseHover=true (auto-expand mode active, box is collapsed to title bar), use
  // title bar center (TITLE_BAR_H/2 from box top) — keeps connection lines anchored to the
  // consistent visible title bar area. collapseHover=false means box is expanded → full center.
  const TITLE_BAR_H = 40; // matches .small-box__bar min-height + .large-box__bar padding

  function boxMidPoint(key) {
    if (!key || typeof key !== 'string') return null;
    if (key.startsWith('large:')) {
      const b = getLargeBox(key.slice(6));
      if (!b) return null;
      const x = b.x, y = b.y, w = b.width || LARGE_DEF_W, h = b.height || LARGE_DEF_H;
      // If auto-expand is active and box is NOT in hover-collapse mode, use title bar center
      const anchorY = (b.collapseHover === true) ? y + TITLE_BAR_H / 2 : y + h / 2;
      return { x: x + w / 2, y: anchorY, surface: 'canvas' };
    }
    if (key.startsWith('small:')) {
      const parts = key.split(':');
      if (parts.length < 3) return null;
      const sb = getSmallBox(parts[1], parts.slice(2).join(':'));
      if (!sb) return null;
      const x = sb.x, y = sb.y, w = sb.width || SMALL_DEF_W, h = sb.height || SMALL_DEF_H;
      const anchorY = (sb.collapseHover === true) ? y + TITLE_BAR_H / 2 : y + h / 2;
      return { x: x + w / 2, y: anchorY, surface: 'inner' };
    }
    // legacy raw id (Round 1 format) — treat as large box
    const b = getLargeBox(key);
    if (!b) return null;
    const x = b.x, y = b.y, w = b.width || LARGE_DEF_W, h = b.height || LARGE_DEF_H;
    const anchorY = (b.collapseHover === true) ? y + TITLE_BAR_H / 2 : y + h / 2;
    return { x: x + w / 2, y: anchorY, surface: 'canvas' };
  }

  // Pick the SVG layer for a connection based on which surface both boxes share.
  // large-large = canvas SVG, small-small = inner SVG, cross-level = canvas (parent view).
  function connSvgForConn(c) {
    const a = boxMidPoint(c.from);
    const b = boxMidPoint(c.to);
    if (!a || !b) return null;
    if (a.surface === 'inner' && b.surface === 'inner') {
      return innerConnSvg ? innerConnSvg : (innerSurfaceContent ? getConnSvg(innerSurfaceContent, innerConnSvg) : null);
    }
    return canvasConnSvg ? canvasConnSvg : (canvasSurface ? getConnSvg(canvasSurface, canvasConnSvg) : null);
  }

  // Update a single SVG <line> element from connection data.
  // A4: viewport cull margin (px in svg-local coords) — hide lines whose
  // both endpoints sit outside the surface visible area by this much.
  const CONN_VP_MARGIN = 60;

  function connSvgVisibleRect(svg) {
    // Returns {w, h} of the visible area in svg-local (world) coordinates.
    // The svg lives inside a transformed surface; its clientWidth/Height reflect
    // the on-screen viewport. Lines are in world coords (1:1 with svg viewBox 0..w).
    const w = svg.clientWidth || 0, h = svg.clientHeight || 0;
    if (!w || !h) return null;
    return { w, h };
  }

  function updateSvgLine(lineEl, c) {
    const a = boxMidPoint(c.from);
    const b = boxMidPoint(c.to);
    if (!a || !b) { lineEl.style.display = 'none'; return; }
    // A4: viewport culling — if both endpoints are far outside the visible
    // svg area, hide the line entirely instead of paying for attribute sets
    // and triggering layout/paint on off-screen geometry.
    const svg = lineEl.ownerSVGElement || lineEl.parentNode;
    const vr = svg ? connSvgVisibleRect(svg) : null;
    if (vr) {
      const minX = -CONN_VP_MARGIN, maxX = vr.w + CONN_VP_MARGIN;
      const minY = -CONN_VP_MARGIN, maxY = vr.h + CONN_VP_MARGIN;
      const aOut = a.x < minX || a.x > maxX || a.y < minY || a.y > maxY;
      const bOut = b.x < minX || b.x > maxX || b.y < minY || b.y > maxY;
      if (aOut && bOut) { lineEl.style.display = 'none'; return; }
    }
    // BX-145: round to integer to eliminate subpixel coordinate jitter at low zoom.
    lineEl.setAttribute('x1', Math.round(a.x));
    lineEl.setAttribute('y1', Math.round(a.y));
    lineEl.setAttribute('x2', Math.round(b.x));
    lineEl.setAttribute('y2', Math.round(b.y));
    // A4: LOD — thinner stroke at low zoom reduces Chrome antialiasing jitter
    // and saves fill-rate. At >=80% zoom keep the default 1.5, below 50% use 1,
    // below 35% use 0.75. CSS var --connection-color stays the same.
    const z = a.surface === 'inner' ? (typeof innerZoom !== 'undefined' ? innerZoom : 1) : canvasZoom;
    const sw = z >= 0.8 ? 1.5 : z >= 0.5 ? 1 : 0.75;
    lineEl.setAttribute('stroke-width', sw);
    lineEl.style.display = '';
  }

  function renderConnections() {
    ensureConnArrays();
    // Ensure SVG overlays exist
    if (canvasSurface) canvasConnSvg = getConnSvg(canvasSurface, canvasConnSvg);
    if (typeof innerSurfaceContent !== 'undefined' && innerSurfaceContent) innerConnSvg = getConnSvg(innerSurfaceContent, innerConnSvg);
    // Reconcile live lines with layout.connections: drop dead.
    const wanted = new Set(layout.connections.map(c => c.id));
    connIdx.clear();
    connById.clear();
    boxConnIdx.clear();
    for (const c of layout.connections) {
      connIdx.set(c.from + '>' + c.to, c);
      connIdx.set(c.to + '>' + c.from, c);
      // O(1) reverse index: boxKey -> Set of connIds
      if (!boxConnIdx.has(c.from)) boxConnIdx.set(c.from, new Set());
      if (!boxConnIdx.has(c.to)) boxConnIdx.set(c.to, new Set());
      boxConnIdx.get(c.from).add(c.id);
      boxConnIdx.get(c.to).add(c.id);
      connById.set(c.id, c);
    }
    for (const [id, line] of connLines.entries()) {
      if (!wanted.has(id)) {
        try { line.remove(); } catch (_) {}
        connLines.delete(id);
        dirtyConns.delete(id);
      }
    }
    // Create new SVG <line> elements for pending connections.
    const pending = layout.connections.filter(c => !connLines.has(c.id));
    for (const c of pending) {
      const svg = connSvgForConn(c);
      if (!svg) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'conn-line');
      line.setAttribute('stroke', 'var(--connection-color, #333)');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('shape-rendering', 'geometricPrecision');
      updateSvgLine(line, c);
      svg.appendChild(line);
      connLines.set(c.id, line);
    }
    scheduleConnRefresh(Array.from(connLines.keys()));
  }
  let __connRefreshRAF = 0;
  function scheduleConnRefresh(connIds) {
    if (!connIds || !connIds.length) return;
    for (const id of connIds) dirtyConns.add(id);
    // BX-DEV-PERF: rAF-batch to avoid sync layout thrash on Firefox during drag
    if (__connRefreshRAF) return;
    __connRefreshRAF = requestAnimationFrame(() => {
      __connRefreshRAF = 0;
      const ids = Array.from(dirtyConns);
      dirtyConns.clear();
      for (const id of ids) {
        const line = connLines.get(id);
        if (!line) continue;
        const conn = connById.get(id);
        if (conn) updateSvgLine(line, conn);
      }
    });
  }

  function refreshConnsForBox(boxKey) {
    ensureConnArrays();
    // O(1) via boxConnIdx reverse index — avoids O(n) filter on every mousemove
    const connSet = boxConnIdx.get(boxKey);
    if (connSet && connSet.size > 0) {
      scheduleConnRefresh(Array.from(connSet));
    }
  }

  // BX-DEV-145: sync variant used during active drag to remove the 1-frame rAF
  // lag between box DOM movement and SVG line endpoint update — without this,
  // the line endpoint trails behind the box for one frame, making a portion of
  // the line visible in the area the box just vacated ("线条显现").
  // Touches only the dragged box's N connections (typ. 1-5), so cost is trivial.
  function refreshConnsForBoxSync(boxKey) {
    ensureConnArrays();
    const connSet = boxConnIdx.get(boxKey);
    if (!connSet || connSet.size === 0) return;
    for (const id of connSet) {
      const line = connLines.get(id);
      if (!line) continue;
      const conn = layout.connections.find(x => x.id === id);
      if (conn) updateSvgLine(line, conn);
    }
  }

  function refreshAllConns() { scheduleConnRefresh(Array.from(connLines.keys())); }

  // ── Star-mark / group drag ──────────────────────────
  
  // ── BX-DSU: Union-Find with path compression ──
  let __nextGroupId = 1;
  
  function dsuFind(key) {
    if (!boxGroupId.has(key)) return 0;
    let root = key;
    while (boxGroupId.get(root) !== root) {
      // path compression: point to grandparent
      const parent = boxGroupId.get(root);
      const grandparent = boxGroupId.get(parent);
      if (grandparent !== parent) boxGroupId.set(root, grandparent);
      root = parent;
    }
    return boxGroupId.get(root);
  }
  
  function dsuMake(key) {
    if (!boxGroupId.has(key)) {
      boxGroupId.set(key, key);
      groupMembers.set(key, new Set([key]));
    }
  }
  
  function dsuUnion(a, b) {
    dsuMake(a); dsuMake(b);
    const ra = dsuFind(a), rb = dsuFind(b);
    if (ra === rb) return;
    // union by size: attach smaller group to larger
    const sa = groupMembers.get(ra).size, sb = groupMembers.get(rb).size;
    const big = sa >= sb ? ra : rb, small = sa >= sb ? rb : ra;
    // repoint all members of small group to big group
    for (const m of groupMembers.get(small)) boxGroupId.set(m, big);
    groupMembers.get(big).add(...groupMembers.get(small));
    groupMembers.delete(small);
  }
  
  function dsuReset() {
    boxGroupId.clear(); groupMembers.clear(); groupStar.clear();
  }
  
  function dsuRebuildFromConnections() {
    dsuReset();
    // Rebuild DSU from layout.connections — each connection unions two boxes
    for (const c of layout.connections) {
      if (c.from && c.to) dsuUnion(c.from, c.to);
    }
  // A5: Re-apply star marks from box.isParent field
  for (const b of (layout.boxes || [])) {
    if (b.isParent) groupStar.add(largeKey(b.id));
    }
  }
  
  function dsuGroupMembers(key) {
    const root = dsuFind(key);
    if (!root) return null;
    return groupMembers.get(root) || null;
  }
  

function ensureGroups() { ensureConnArrays(); dsuRebuildFromConnections(); const gs = (layout.boxes || []).filter(b => b.isParent).map(b => ({ parentId: largeKey(b.id), members: [] })); layout.groups = gs; return gs; }

  // ── Tiered keys for cross-level connections (BX-DEV-137+) ──────────
  // large:boxId  |  small:largeId:smallId  — addresses any box at any nesting.
  // Connections store these tiered keys, so a line can link large-to-large,
  // large-to-small, small-to-small regardless of inner-canvas nesting.
  function largeKey(id) { return 'large:' + id; }
  function smallKey(largeId, smallId) { return 'small:' + largeId + ':' + smallId; }
  function resolveBoxEl(key) {
    if (!key || typeof key !== 'string') return null;
    if (key.startsWith('large:')) {
      const id = key.slice(6);
      return document.querySelector(`.large-box[data-id="${CSS.escape(id)}"]`);
    }
    if (key.startsWith('small:')) {
      const parts = key.split(':');           // ['small','largeId','smallId']
      if (parts.length < 3) return null;
      const largeId = parts[1], smallId = parts.slice(2).join(':');
      return document.querySelector(`.small-box[data-id="${CSS.escape(smallId)}"][data-large-id="${CSS.escape(largeId)}"]`);
    }
    // legacy raw id (Round 1 format) — treat as large box
    return document.querySelector(`.large-box[data-id="${CSS.escape(key)}"]`);
  }
  // Build set of all currently-valid tiered keys (for pruneConnArrays)
  function allValidKeys() {
    const s = new Set();
    for (const b of layout.boxes) {
      s.add(largeKey(b.id));
      for (const sb of (b.children || [])) s.add(smallKey(b.id, sb.id));
    }
    return s;
  }

  function getGroupByParent(parentId) {
    // A5: lazy DSU rebuild on first access — needed after page reload where
    // groupStar is empty until ensureGroups()/dsuRebuildFromConnections runs.
    if (parentId && groupStar.size === 0) ensureGroups();
    // A5: star determined by groupStar Set (populated from box.isParent)
    if (!parentId || !groupStar.has(parentId)) return null;
    const members = dsuGroupMembers(parentId);
    if (!members) return null;
    return { parentId, members: [...members].filter(k => k !== parentId) };
  }
  function toggleStarMark(parentId) {
    ensureConnArrays();
    if (groupStar.has(parentId)) {
      // unstar: remove from groupStar, clear box.isParent
      groupStar.delete(parentId);
      const pk = parentId.startsWith('large:') ? parentId.slice(6) : parentId;
      const lb = getLargeBox(pk);
      if (lb) lb.isParent = false;
      markDeleted(parentId);
      debug('toggleStarMark: unstar parent=' + parentId);
      ensureGroups();
    } else {
      // star: add to groupStar, set box.isParent
      groupStar.add(parentId);
      const pk = parentId.startsWith('large:') ? parentId.slice(6) : parentId;
      const lb = getLargeBox(pk);
      if (lb) lb.isParent = true;
      debug('toggleStarMark: star parent=' + parentId);
    }
    ensureGroups();
    saveLayout();
    // Update star button visual state
    document.querySelectorAll('.box-star-btn').forEach(btn => {
      const boxEl = btn.closest('[data-box-key]');
      if (!boxEl) return;
      const key = boxEl.dataset.boxKey;
      const starred = groupStar.has(key);
      btn.classList.toggle('box-tool-btn--on', starred);
      btn.textContent = starred ? '★' : '☆';
      boxEl.classList.toggle('box--starred', starred);
    });
  }
  // A5: addMember no-op - DSU auto-unions on addConnection
  function addMember(parentId, memberId) {
    if (parentId === memberId) return;
    ensureConnArrays();
  }

  // During parent drag we apply the same delta to every member. Members collide
  // against OUT-of-group boxes only; intra-group siblings move as a rigid set.
  // BX-DEV-137+: group drag now performs a continuous elastic sweep against
  // OUT-of-group large boxes, not just a rigid delta translate. Each member
  // is resolved via elasticSnap with siblings (group + parent) excluded, so the
  // whole group visits new positions as a rigid set, then collisions push back.
  // ponytail: O(m*n) elastic pass per group; swap in rbush R-tree at >100 boxes.
  function moveGroupTogether(parentId, deltaX, deltaY, origins) {
    // BX-DSU: use DSU to find ALL group members (multi-level, not just direct children)
    const members = dsuGroupMembers(parentId);
    if (!members || members.size <= 1) return;
    const isLarge = (typeof parentId === 'string' && parentId.startsWith('large:'));
    // Separate members by key type — DSU may contain mixed large:/small: keys
    const largeMembers = [];
    const smallMembers = [];
    for (const k of members) {
      if (k === parentId) continue;
      if (typeof k === 'string' && k.startsWith('large:')) largeMembers.push(k);
      else if (typeof k === 'string' && k.startsWith('small:')) smallMembers.push(k);
      else largeMembers.push(k); // legacy raw id
    }
    if (!largeMembers.length && !smallMembers.length) return;

    // Move large-box members
    if (largeMembers.length) {
      const groupBoxIds = new Set();
      for (const k of largeMembers) {
        const rawId = (typeof k === 'string' && k.startsWith('large:')) ? k.slice(6) : k;
        groupBoxIds.add(rawId);
      }
      if (isLarge) { const parentRawId = parentId.slice(6); groupBoxIds.add(parentRawId); }
      const others = layout.boxes.filter(b => !groupBoxIds.has(b.id));
      for (const mId of largeMembers) {
        const rawId = (typeof mId === 'string' && mId.startsWith('large:')) ? mId.slice(6) : mId;
        const m = getLargeBox(rawId);
        if (!m) continue;
        const w = m.width || LARGE_DEF_W, h = m.height || LARGE_DEF_H;
        const base = (origins && origins.get(mId)) || { x: m.x, y: m.y };
        const nx0 = base.x + deltaX, ny0 = base.y + deltaY;
        const resolved = elasticSnap({ x: nx0, y: ny0 }, w, h, others, CANVAS_GRID, snapCanvas);
        const worldMaxX = (canvasContainer.clientWidth / 0.3) - w;
        const worldMaxY = (canvasContainer.clientHeight / 0.3) - h;
        m.x = Math.max(0, Math.min(resolved.x, worldMaxX));
        m.y = Math.max(0, Math.min(resolved.y, worldMaxY));
        const el = document.querySelector('.large-box[data-id="' + CSS.escape(rawId) + '"]');
        if (el) { el.style.left = m.x + 'px'; el.style.top = m.y + 'px'; }
        refreshConnsForBox(mId);
      }
    }

    // Move small-box members
    if (smallMembers.length) {
      let parentLargeId = null;
      if (isLarge) { parentLargeId = parentId.slice(6); }
      else { const parts = parentId.split(':'); if (parts.length >= 3) parentLargeId = parts[1]; }
      if (!parentLargeId) return;
      const lb = getLargeBox(parentLargeId);
      if (!lb) return;
      const memberSmallIds = new Set();
      for (const mId of smallMembers) {
        const mp = mId.split(':');
        if (mp.length >= 3 && mp[1] === parentLargeId) memberSmallIds.add(mp.slice(2).join(':'));
      }
      const others = (lb.children || []).filter(s => !memberSmallIds.has(s.id) && (!isLarge || s.id !== parentId.split(':').slice(2).join(':')));
      for (const mId of smallMembers) {
        const mp = mId.split(':');
        if (!mp || mp.length < 3 || mp[1] !== parentLargeId) continue;
        const rawId = mp.slice(2).join(':');
        const m = getSmallBox(parentLargeId, rawId);
        if (!m) continue;
        const w = m.width || SMALL_DEF_W, h = m.height || SMALL_DEF_H;
        const base = (origins && origins.get(mId)) || { x: m.x, y: m.y };
        const nx0 = base.x + deltaX, ny0 = base.y + deltaY;
        const resolved = elasticSnap({ x: nx0, y: ny0 }, w, h, others, INNER_GRID, snapInner);
        const sw2 = innerSurface.clientWidth || innerCanvas.clientWidth;
        const sh2 = innerSurface.clientHeight || (innerCanvas.clientHeight - 40);
        const worldMaxX2 = (sw2 / 0.3) - w;
        const worldMaxY2 = (sh2 / 0.3) - h;
        m.x = Math.max(0, Math.min(resolved.x, worldMaxX2));
        m.y = Math.max(0, Math.min(resolved.y, worldMaxY2));
        const el = resolveBoxEl(mId);
        if (el) { el.style.left = m.x + 'px'; el.style.top = m.y + 'px'; }
        refreshConnsForBox(mId);
      }
    }
  }

  // ── active-connect mode (drag from edge anchor to target box) ──
  // BX-142: SVG-based drag-create. provisionalLine is an SVG <line> inside the surface.
  // provisionalGhost is now { x, y } logical coords, updated on mousemove via rAF throttle.
  function enterConnectMode(fromId, fromEl, initCx, initCy) {
    if (connectMode) { exitConnectMode(); return; }   // second click cancels
    connectMode = { fromId, fromEl };
    document.body.classList.add('cx--connecting');
    document.body.style.cursor = 'crosshair';
    // Determine which surface this box lives in
    const mp = boxMidPoint(fromId);
    const isInner = mp && mp.surface === 'inner';
    const surface = isInner ? innerSurfaceContent : canvasSurface;
    const svg = surface ? getConnSvg(surface, isInner ? innerConnSvg : canvasConnSvg) : null;
    if (isInner) innerConnSvg = svg; else canvasConnSvg = svg;
    // Create provisional SVG <line> with dashed stroke
    if (svg && mp) {
      // Bug 1 fix: immediately snap line endpoint to mouse position — line follows cursor from first frame
      let initLX = mp.x, initLY = mp.y;
      if (typeof initCx === 'number' && typeof initCy === 'number' && surface) {
        // Bug 7 fix: surface is the TRANSFORMED element (has CSS translate(panX,panY) scale(zoom)).
        // Its getBoundingClientRect() already reflects the pan offset, so we must NOT subtract
        // panX/panY again — that would double-subtract and fling the endpoint off to a corner.
        // Inverse: world = (client - transformedRect.left) / zoom.
        const rect = surface.getBoundingClientRect();
        const zoom = isInner ? innerZoom : canvasZoom;
        initLX = (initCx - rect.left) / zoom;
        initLY = (initCy - rect.top) / zoom;
      }
      provisionalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      provisionalLine.setAttribute('class', 'conn-line conn-line--provisional');
      provisionalLine.setAttribute('stroke', 'var(--connection-color, #333)');
      provisionalLine.setAttribute('stroke-width', '1.5');
      provisionalLine.setAttribute('stroke-dasharray', '5,3');
      provisionalLine.setAttribute('x1', Math.round(mp.x));
      provisionalLine.setAttribute('y1', Math.round(mp.y));
      provisionalLine.setAttribute('x2', Math.round(initLX));
      provisionalLine.setAttribute('y2', Math.round(initLY));
      svg.appendChild(provisionalLine);
      provisionalGhost = { x: initLX, y: initLY, surface: mp.surface };
    }
    debug('enterConnectMode from=' + fromId);
  }
  function exitConnectMode(commitToId) {
    const cm = connectMode; connectMode = null;
    document.body.classList.remove('cx--connecting');
    document.body.style.cursor = '';
    // BX-142: dispose provisional SVG line + ghost coords.
    if (provisionalLine) { try { provisionalLine.remove(); } catch (_) {} provisionalLine = null; }
    provisionalGhost = null;
    if (cm && commitToId && cm.fromId && cm.fromId !== commitToId) {
      if (addConnection(cm.fromId, commitToId)) {
        saveLayout();
        // BX-DEV-137++: defer renderConnections to next rAF — avoids blocking the
        // mousedown event that triggered the connect. Synchronous LeaderLine ctor
        // on boxes×N pairs stalls the event loop on large layouts.
        renderConnections();
        debug('connect ' + cm.fromId + ' -> ' + commitToId);
      } else {
        debug('connect skipped (dup or self)');
      }
    }
  }

  function getSmallBox(largeId, smallId) {
    const lb = getLargeBox(largeId);
    return lb?.children?.find(s => s.id === smallId) || null;
  }

  function snapCanvas(x, y) { return { x: Math.round(x / CANVAS_GRID) * CANVAS_GRID, y: Math.round(y / CANVAS_GRID) * CANVAS_GRID }; }
  function snapInner(x, y) { return { x: Math.round(x / INNER_GRID) * INNER_GRID, y: Math.round(y / INNER_GRID) * INNER_GRID }; }

  function rectsOverlap(a, b) {
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }

  function clampToEdge(x, y, w, h, viewW, viewH) {
    return {
      x: Math.max(0, Math.min(x, Math.max(viewW - w, 0))),
      y: Math.max(0, Math.min(y, Math.max(viewH - h, 0)))
    };
  }

  // Canvas pan boundary: at 10% zoom, max pan range = 10x screen size
  function clampCanvasPan(panX, panY, zoom) {
    // BX-DEV-134 (B2 perf): read cached geometry — no per-mousemove forced layout.
    const w = canvasContainerSize.w || canvasContainer.clientWidth;
    const h = canvasContainerSize.h || canvasContainer.clientHeight;
    // Virtual world: [0, containerW/0.3]. Screen = world*zoom + pan.
    // Constraint: visible world must stay within [0, containerW/0.3].
    // Left: world=0 at screen pan → pan <= 0 (no blank left of origin)
    // Right: worldEdge*zoom+pan >= containerW → pan >= containerW*(1 - zoom/0.3)
    const minPanX = w * (1.0 - zoom / 0.3);
    const minPanY = h * (1.0 - zoom / 0.3);
    return {
      x: Math.max(minPanX, Math.min(0, panX)),
      y: Math.max(minPanY, Math.min(0, panY))
    };
  }

  function clampInnerPan(panX, panY, zoom) {
    const container = innerCanvas;
    // Use innerSurface dimensions — surface starts at top:40px (below canvas-head),
    // so its usable height is canvas - 40. Using innerCanvas height would count
    // the 40px head strip as world-pannable, causing bottom coverage bug.
    const sw = (innerSurfaceSize.w || innerSurface.clientWidth) || container.clientWidth;
    const sh = (innerSurfaceSize.h || innerSurface.clientHeight) || (container.clientHeight - 40);
    const minPanX = sw * (1.0 - zoom / 0.3);
    const minPanY = sh * (1.0 - zoom / 0.3);
    return {
      x: Math.max(minPanX, Math.min(0, panX)),
      y: Math.max(minPanY, Math.min(0, panY))
    };
  }

  // Elastic snap: iterative while-loop to resolve all overlaps (BX-DEV-013)
  function elasticSnap(pos, w, h, others, grid, snapFn) {
    let { x, y } = pos;
    let maxIter = 50;
    let movedThisPass = true;
    while (movedThisPass && maxIter-- > 0) {
      movedThisPass = false;
      for (const other of others) {
        const ow = other.width || LARGE_DEF_W, oh = other.height || LARGE_DEF_H;
        if (!rectsOverlap({ x, y, w, h }, { x: other.x, y: other.y, w: ow, h: oh })) continue;
        const candidates = [
          { x: other.x + ow + grid, y },
          { x: other.x - w - grid, y: y },
          { x, y: other.y + oh + grid },
          { x, y: other.y - h - grid }
        ];
        let best = null, bestDist = Infinity;
        for (const c of candidates) {
          if (c.x < 0 || c.y < 0) continue;
          const collides = others.some(o =>
            rectsOverlap({ x: c.x, y: c.y, w, h }, { x: o.x, y: o.y, w: ow, h: oh }));
          if (!collides) {
            const dist = Math.abs(c.x - x) + Math.abs(c.y - y);
            if (dist < bestDist) { bestDist = dist; best = c; }
          }
        }
        if (best) { x = best.x; y = best.y; movedThisPass = true; } else { x += grid; movedThisPass = true; }
      }
    }
    return snapFn(x, y);
  }

  // world-coord <-> screen-coord conversion
  function screenToWorld(clientX, clientY, container, panX, panY, zoom) {
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom
    };
  }

  // ── Obsidian-style zoom & pan ──────────────────────────
  function applyCanvasTransform() {
    canvasSurface.style.willChange = 'transform';
    canvasSurface.style.transform = `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`;
    canvasSurface.style.transformOrigin = '0 0';
    canvasZoomVal.textContent = Math.round(canvasZoom * 100) + '%';
    zoomSlider.value = Math.round(canvasZoom * 100);
    zoomSliderVal.textContent = Math.round(canvasZoom * 100) + '%';
    // BX-DEV-145: lines live inside canvasSurface, so CSS transform moves them
    // automatically on pan/zoom — no per-tick recalculation needed.
  }

  function applyInnerTransform() {
    const content = ensureInnerSurfaceContent();
    content.style.transform = `translate(${innerPanX}px, ${innerPanY}px) scale(${innerZoom})`;
    content.style.transformOrigin = '0 0';
    innerZoomVal.textContent = Math.round(innerZoom * 100) + '%';
    zoomSlider.value = Math.round(innerZoom * 100);
    zoomSliderVal.textContent = Math.round(innerZoom * 100) + '%';
    // BX-DEV-145: inner surface transform carries conn-lines too.
    // No per-tick recalculation — CSS transform handles line position.
  }

  function zoomAtPoint(container, zoom, panX, panY, clientX, clientY, factor) {
    const rect = container.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    const ratio = newZoom / zoom;
    const newPanX = mx - ratio * (mx - panX);
    const newPanY = my - ratio * (my - panY);
    return { zoom: newZoom, panX: newPanX, panY: newPanY };
  }

  function zoomStep(current, dir) {
    const idx = ZOOM_STEPS.indexOf(current);
    if (dir === 'in' && idx < ZOOM_STEPS.length - 1) return ZOOM_STEPS[idx + 1];
    if (dir === 'out' && idx > 0) return ZOOM_STEPS[idx - 1];
    return current;
  }

  const headerPinBtn = $('#header-pin-btn');
  const appEl = $('#app');
  const headerBar = $('.ntp__bar');

  // ── Header Pin: two-position strategy (v3.7.2) ──────────────────────────
  // Pinned (default): button lives in header bar, header visible.
  // Floating (unpinned): header hidden, button moved into canvas as absolute overlay.
  // This prevents canvas__surface from intercepting pointer events (stacking context bug).
  function updateAutohideUI() {
    const activeCanvas = canvasContainer.hidden ? innerCanvas : canvasContainer;

    if (headerPinned) {
      // Pinned: button belongs in the header bar
      if (headerPinBtn && headerPinBtn.parentElement !== headerBar) {
        if (headerPinBtn.parentElement) headerPinBtn.parentElement.removeChild(headerPinBtn);
        headerBar.appendChild(headerPinBtn);
      }
      if (headerBar) headerBar.style.display = '';
      appEl.classList.remove('ntp--autohide');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    } else {
      // Unpinned: hide header bar, move button onto canvas as floating absolute overlay
      if (headerPinBtn && headerPinBtn.parentElement !== activeCanvas) {
        if (headerPinBtn.parentElement) headerPinBtn.parentElement.removeChild(headerPinBtn);
        activeCanvas.appendChild(headerPinBtn);
      }
      if (headerBar) headerBar.style.display = 'none';
      appEl.classList.add('ntp--autohide');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    // Toggle floating visual class + force z-index above canvas__surface stacking context
    if (headerPinBtn) {
      const span = headerPinBtn.querySelector('span');
      if (span) span.textContent = headerPinned ? '⊙' : '○';
      headerPinBtn.title = headerPinned ? i18n('headerPin') : i18n('headerPinOff');
      headerPinBtn.classList.toggle('header-pin--floating', !headerPinned);
      headerPinBtn.style.zIndex = headerPinned ? '10' : '1000';
    }
  }
  if (headerPinBtn) {
    headerPinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      headerPinned = !headerPinned;
      updateAutohideUI();
      // When repinning: header reappears, canvas layout changes — reapply transforms
      if (headerPinned) { applyCanvasTransform(); applyInnerTransform(); }
      if (currentLargeBoxId) updateCaption(); else updateCaption();
      saveLayout();
    });
    headerPinBtn.title = i18n('headerPin');  // default pinned
    updateAutohideUI();  // button stays in header bar by default
  }
  function renderCanvas() {
    debug('renderCanvas start, boxCount=' + layout.boxes.length + ' hidden=' + canvasContainer.hidden);
    innerWrapper.hidden = true;
    canvasContainer.hidden = false;
    backBtn.dataset.show = '0';
    updateAutohideUI(); // always reposition pin to active canvas (BX-DEV-078)

    const hasBoxes = layout.boxes.length > 0;
    // BX-DEV-111: hide empty placeholder BEFORE clearing surface to avoid flash
    canvasEmpty.hidden = true;
    // Bug2: clear DOM synchronously then rebuild in same tick — no flash
    canvasSurface.innerHTML = '';
    disposeAllConns(); // clear stale connLines Map after DOM wipe
    // Then re-show empty state only if truly empty
    canvasEmpty.hidden = hasBoxes;
    // BX-DEV-111f: Ensure i18n is applied to empty state elements (may have been cleared in HTML)
    if (!hasBoxes) {
      document.querySelectorAll('#canvas-empty [data-i18n]').forEach(el => { if (!el.textContent) el.textContent = i18n(el.dataset.i18n); });
    }
    debug('renderCanvas creating DOM for ' + layout.boxes.length + ' boxes');
    const frag = document.createDocumentFragment();
    for (const box of layout.boxes) {
      debug('renderCanvas creating largeBox DOM for', box.id, box.title);
      try {
        frag.appendChild(createLargeBoxEl(box));
      } catch (e) { debugErr('createLargeBoxEl failed for', box.id, e); }
    }
    canvasSurface.appendChild(frag);
    ensureConnArrays(); debug('renderCanvas done, surface children=' + canvasSurface.children.length);
    // BX-DEV-111 v2: measure each collapsed box for precise expand animation
    canvasSurface.querySelectorAll('.large-box.box--hover-expand.box--collapsed').forEach(setBodyExpandHeight);
    // Bug2: render connections synchronously — no flash with deferred dispose
    renderConnections(); // Bug2: sync render — same JS tick, no flash
    applyCanvasTransform();
    updateCaption();
  }

  // BX-DEV-105: measure body scrollHeight and set CSS --body-max-height for precise drawer animation
  function setBodyExpandHeight(el) {
    const body = el.querySelector('.large-box__body') || el.querySelector('.small-box__body');
    if (!body) return;
    requestAnimationFrame(() => {
      // BX-DEV-111 v2: measure FULL box scrollHeight (bar+body+resize) for expand target
      // Temporarily remove max-height constraint to measure natural height
      const wasCollapsed = el.classList.contains('box--collapsed');
      const savedMaxH = el.style.maxHeight;
      el.style.maxHeight = 'none';
      // Force reflow: read offsetHeight triggers layout recalculation with new max-height
      void el.offsetHeight;
      const fullH = el.scrollHeight;
      el.style.maxHeight = savedMaxH;
      void el.offsetHeight; // reflow again after restoring
      debug('setBodyExpandHeight measured', { id: el.dataset.id, fullH, savedMaxH, wasCollapsed });
      if (fullH > 0) el.style.setProperty('--expand-height', fullH + 'px');
      // Also keep --body-max-height for compatibility
      const bh = body.scrollHeight;
      if (bh > 0) body.style.setProperty('--body-max-height', bh + 'px');
      // BX-DEV-137++: after layout settles, refresh lines — box height may have changed.
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
    });
  }

  function createLargeBoxEl(box) {
    const w = box.width || LARGE_DEF_W;
    const h = box.height || LARGE_DEF_H;

    const el = document.createElement('div');
    el.className = 'large-box';
    el.dataset.id = box.id;
    el.dataset.boxKey = largeKey(box.id);
    el.dataset.kind = 'large';
    el.style.left = box.x + 'px';
    el.style.top = box.y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    // header bar (drag handle — title EXCLUDED from drag)
    const bar = document.createElement('div');
    bar.className = 'large-box__bar';
    // bar is the drag area
    bar.addEventListener('mousedown', e => { if (!e.target.closest('.large-box__title') && !e.target.closest('.large-box__delete')) onBoxDragStart(e, 'large', box.id, el); });

    const icon = document.createElement('span');
    icon.className = 'large-box__icon';
    icon.textContent = '📦';
    icon.setAttribute('aria-hidden', 'true');

    const title = document.createElement('span');
    title.className = 'large-box__title';
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.textContent = box.title || i18n('newLargeBox', [layout.boxes.indexOf(box) + 1]);
    // Title: NO drag, NO click-through — only text editing
    title.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); title.focus(); });
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      if (e.key === 'Escape') { title.textContent = box.title || i18n('newLargeBox', [layout.boxes.indexOf(box) + 1]); title.blur(); }
    });
    // SEC-03: Force plain-text paste — prevent HTML injection via contentEditable
    title.addEventListener('paste', e => { e.preventDefault(); const text = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, text); });
    title.addEventListener('blur', () => {
      const t = title.textContent.trim() || i18n('untitledBox');
      if (t !== box.title) { box.title = t; saveLayout(); }
    });

    const meta = document.createElement('span');
    meta.className = 'large-box__meta';
    const childCount = box.children?.length || 0;
    meta.textContent = i18n('smallBoxCountLabel', [childCount]);

    const delBtn = document.createElement('button');
    delBtn.className = 'large-box__delete';
    delBtn.title = i18n('deleteBox');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteLargeBox(box.id); });


    // ── pin button (lock box position)
    const pinBtn = document.createElement('button');
    pinBtn.className = 'box-pin-btn';
    pinBtn.title = i18n('pin');
    pinBtn.textContent = '⊙';
    pinBtn.title = box.pinned ? i18n('unpin') : i18n('pin');
    pinBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:13px;padding:0 3px;opacity:0.4;flex-shrink:0;';
    // Default: NOT pinned
    box.pinned = box.pinned === true;  // normalize
    pinBtn.textContent = box.pinned ? '⊙' : '○';
    pinBtn.style.opacity = box.pinned ? '0.9' : '0.4';
    pinBtn.title = box.pinned ? i18n('unpin') : i18n('pin');
    pinBtn.addEventListener('click', e => {
      e.stopPropagation();
      box.pinned = !box.pinned;
      pinBtn.title = box.pinned ? i18n('unpin') : i18n('pin');
      pinBtn.style.opacity = box.pinned ? '0.9' : '0.4';
      pinBtn.textContent = box.pinned ? '⊙' : '○';
      el.classList.toggle('box--pinned', box.pinned);
      saveLayout();
    });

    // ── auto-expand button (hover vs always)
    const expandBtn = document.createElement('button');
    expandBtn.className = 'box-expand-btn';
    expandBtn.title = i18n('autoExpand');
    expandBtn.textContent = '⊟';
    expandBtn.title = box.collapseHover ? i18n('autoExpandHover') : i18n('autoExpand');
    expandBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:13px;padding:0 3px;opacity:0.4;flex-shrink:0;';
    expandBtn.addEventListener('click', e => {
      e.stopPropagation();
      box.collapseHover = !box.collapseHover;
      expandBtn.title = box.collapseHover ? i18n('autoExpandHover') : i18n('autoExpand');
      expandBtn.style.opacity = box.collapseHover ? '0.9' : '0.4';
      expandBtn.textContent = box.collapseHover ? '⊞' : '⊟';
      el.classList.toggle('box--hover-expand', box.collapseHover);
      if (box.collapseHover) {
        el.classList.add('box--collapsed');
        setBodyExpandHeight(el);  // BX-DEV-111: measure after collapsing
      } else {
        el.classList.remove('box--collapsed');
      }
      saveLayout();
      // BX-DEV-137++: refresh connections after expand/collapse — box height changed,
      // leader-line cached stale position. rAF-coalesced via refreshAllConns.
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
    });

    bar.append(icon, title, meta, pinBtn, expandBtn, delBtn);

    // body — click to enter
    const body = document.createElement('div');
    body.className = 'large-box__body';

    // Track actual drag distance to prevent click-from-drag entering (BX-DEV-048)
    // Track mousedown position on bar; compare click distance to detect drag (BX-DEV-048 v2)
    let barDownX = 0, barDownY = 0, barDownWasDragZone = false;
    bar.addEventListener('mousedown', e => {
      barDownX = e.clientX; barDownY = e.clientY;
      const tgt = e.target;
      barDownWasDragZone = tgt && !tgt.closest('.large-box__title') && !tgt.closest('.large-box__delete')
        && !tgt.closest('.box-pin-btn') && !tgt.closest('.box-expand-btn')
        && !tgt.closest('.box-resize-handle');
    }, true); // capture: fires before onBoxDragStart
    body.addEventListener('click', (ev) => {
      if (ev.target.closest('.box-resize-handle') || ev.target.closest('.large-box__delete')) return;
      // BX-DEV-077: clear stale drag state FIRST before any other checks
      if (lastDragEndId === box.id) { lastDragEndId = null; barDownWasDragZone = false; barDownX = 0; barDownY = 0; }
      // If mousedown was on drag zone and click moved >3px, treat as drag
      if (barDownWasDragZone) {
        const dx = Math.abs(ev.clientX - barDownX);
        const dy = Math.abs(ev.clientY - barDownY);
        barDownWasDragZone = false;
        if (dx > 3 || dy > 3) return;
      }
      // Skip click if drag just ended within 60ms (BX-DEV-065)
      if (Date.now() - lastDragEndTime < 60) { debug('skip click: drag just ended'); return; }
      // BX-DEV-112C: this click enters — set suppress guard so any follow-on
      // inner dblclick from the same physical click/dblclick does NOT create a stray small box.
      lastEnterLargeBoxAt = Date.now();
      suppressInnerDblClickOnce = true;
      enterLargeBox(box.id);
    });
    if (childCount) {
      const chips = document.createElement('div');
      chips.className = 'large-box__chips';
      for (const sb of box.children.slice(0, 6)) {
        const chip = document.createElement('span');
        chip.className = 'large-box__chip';
        chip.textContent = sb.title || i18n('untitledBox');
        chips.appendChild(chip);
      }
      if (childCount > 6) {
        const more = document.createElement('span');
        more.className = 'large-box__chip';
        more.textContent = `+${childCount - 6}`;
        chips.appendChild(more);
      }
      body.appendChild(chips);
    } else {
      const hint = document.createElement('div');
      hint.className = 'large-box__empty-hint';
      hint.textContent = i18n('emptyLargeHint');
      body.appendChild(hint);
    }

    const openHint = document.createElement('div');
    openHint.className = 'large-box__open-hint';
    openHint.textContent = i18n('clickToOpen');
    body.appendChild(openHint);

    // BX-DEV-137: star-mark (parent) + connect-mode toggle buttons. Cheap per-box UI;
    // theme uses currentColor so it adapts to dark/light automatically.
    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    const _starred = !!getGroupByParent(largeKey(box.id));
    starBtn.className = 'box-star-btn box-tool-btn' + (_starred ? ' box-tool-btn--on' : '');
    starBtn.textContent = _starred ? '★' : '☆';
    starBtn.title = i18n('connStarParent') || 'Star-mark as group parent';
    starBtn.addEventListener('click', e => { e.stopPropagation(); toggleStarMark(largeKey(box.id)); });
    // Bug 4: highlight parent box with --starred class for visual distinction.
    if (getGroupByParent(largeKey(box.id))) el.classList.add('box--starred');
    // Bug 5: large-box connect ↗ button removed — edge-midpoint drag has replaced it.
    bar.append(starBtn);
    el.append(bar, body);

    // resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'box-resize-handle';
    resizeHandle.addEventListener('mousedown', e => onResizeStart(e, 'large', box.id, el));

    // BX-DEV-111: restore persisted pinned & auto-expand state
    el.classList.toggle('box--pinned', box.pinned === true);
    if (box.collapseHover) { el.classList.add('box--hover-expand'); el.classList.add('box--collapsed'); }
    // BX-DEV-137++++: refresh connections on hover-expand transition — leader-line
    // must re-read bounding rect AFTER CSS max-height transition completes.
    if (box.collapseHover) {
      el.addEventListener('mouseenter', () => {
        // Defer until after CSS transitionend (~350ms); use transitionend for precision.
        const tidy = setTimeout(() => { if (connLines.size) refreshAllConns(); }, 360);
        const onEnd = () => { clearTimeout(tidy); el.removeEventListener('transitionend', onEnd); if (connLines.size) refreshAllConns(); };
        el.addEventListener('transitionend', onEnd, { once: true });
      });
      el.addEventListener('mouseleave', () => {
        const tidy = setTimeout(() => { if (connLines.size) refreshAllConns(); }, 360);
        const onEnd = () => { clearTimeout(tidy); el.removeEventListener('transitionend', onEnd); if (connLines.size) refreshAllConns(); };
        el.addEventListener('transitionend', onEnd, { once: true });
      });
    }

    el.appendChild(resizeHandle);


    addEdgeAnchors(el, largeKey(box.id));
    return el;
  }

  // ── render inner (small boxes inside a large box) ───────
  function enterLargeBox(id) {
    _enterLargeBox(id, arguments[1] === true);
  }
  function _enterLargeBox(id, skipPosRestore) {
    // BX-DEV-111N: stash the previous large box inner view state into its own record before switching.
    if (currentLargeBoxId && currentLargeBoxId !== id) { saveLargeBoxViewState(currentLargeBoxId); }
    currentLargeBoxId = id;
    const lb = getLargeBox(id);
    if (!lb) { exitToCanvas(); return; }
    persistViewState(true);
    // BX-DEV-111N: restore per-box inner view state (zoom/pan) saved earlier, unless caller asked to skip.
    if (!skipPosRestore && lb.viewState && typeof lb.viewState.innerZoom === 'number') {
      innerZoom = lb.viewState.innerZoom;
      innerPanX = Number(lb.viewState.innerPanX) || 0;
      innerPanY = Number(lb.viewState.innerPanY) || 0;
      debug('enterLargeBox: restored viewState for', id, { innerZoom, innerPanX, innerPanY });
    } else if (skipPosRestore) {
      // caller (reload/restore) will set inner* values externally after this returns
    } else {
      innerZoom = layout.settings.zoomLevel || 1.0; innerPanX = 0; innerPanY = 0;
    }

    canvasContainer.hidden = true;
    innerWrapper.hidden = false;
    // BX-DEV-112F: reliable cross-browser zoom-btn reveal — Chrome defers abs-pos child layout
    // when parent transitions hidden=>visible; sync offsetWidth alone is unreliable (chromium
    // bug 41117621). Push to next rAF (post-recalc/paint) and force a true layout there.
    requestAnimationFrame(() => {
      try {
        // getBoundingClientRect forces a full layout incl. abs-pos descendants.
        if (canvasZoomCtrl) void canvasZoomCtrl.getBoundingClientRect();
        if (innerZoomCtrl) void innerZoomCtrl.getBoundingClientRect();
        // Toggle visibility off→on on the controls to break Chrome layout-suppression cache.
        if (innerZoomCtrl) { innerZoomCtrl.style.visibility = "hidden"; void innerZoomCtrl.offsetTop; innerZoomCtrl.style.visibility = ""; }
        if (canvasZoomCtrl) { canvasZoomCtrl.style.visibility = "hidden"; void canvasZoomCtrl.offsetTop; canvasZoomCtrl.style.visibility = ""; }
      } catch (_) { /* fail-soft; next render will correct anyway */ }
    });
    backBtn.dataset.show = '1';
    if (addLargeBtn) addLargeBtn.style.display = 'none';  // BX-DEV-101: inner view hides header + button
    updateAutohideUI(); // always reposition pin to active canvas (BX-DEV-078)

    renderCrumbs(lb);
    innerCrumbTitle.textContent = lb.title || i18n('untitledBox');
    innerCrumbTitle.contentEditable = 'true';
    innerCrumbTitle.spellcheck = false;
    // Inner title: no drag allowed
    innerCrumbTitle.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
    // SEC-03: Force plain-text paste
    innerCrumbTitle.addEventListener('paste', e => { e.preventDefault(); const text = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, text); });
    innerCrumbTitle.onblur = () => {
      const t = innerCrumbTitle.textContent.trim() || i18n('untitledBox');
      if (t !== lb.title) { lb.title = t; saveLayout(); renderCrumbs(lb); }
    };

    disposeAllConns(); // BX-DEV-137+++: clear canvas-view lines before inner surface re-renders them
    renderInnerSurface(lb);
    updateInnerCaption(lb);
    applyInnerTransform();
    updateCaption();
    // BX-DEV-137++: re-render cross-level connections after entering large box —
    // small-box DOM elements are now live so leader-line can resolve tiered keys.
    renderConnections();
  }

  function exitToCanvas() {
    debug(`exitToCanvas: leaving box, back to canvas`);
    // BX-DEV-111N: stash inner view before resetting — preserves per-box view across exits.
    saveLargeBoxViewState(currentLargeBoxId);
    currentLargeBoxId = null;
    innerPanX = 0; innerPanY = 0; innerZoom = 1.0;
    persistViewState(true);
    if (addLargeBtn) addLargeBtn.style.display = '';  // BX-DEV-101: restore + button
    disposeAllConns(); // BX-DEV-137+++: clear inner-view lines before canvas re-renders them
    renderCanvas();
  }

  function renderCrumbs(lb) {
    // BX-DEV-136: inner-canvas-head de-coupled from canvas and floated at top
    // title bar level; the "画布/" breadcrumb is no longer rendered (mirrors the
    // large-canvas architecture where the canvas is a pure infinite surface).
    // The box title + add button live inside #inner-canvas-head directly; the
    // exit-to-canvas action is reachable via the Esc / back gesture.
  }

  // BX-DEV-132 (B1 real fix): inner surface uses an inner content layer as the
  // transform target. Previously the transform was applied to innerSurface itself, so
  // pan lifted the surface's overflow:hidden clip box above the inner__canvas-head
  // and small-box titles slipped under the head's solid background ("小盒子上面的标题
  // 被画布上方标题覆盖，缩放越小越严重"). Mirrors the large-page architecture where
  // .canvas (clip box) is separate from .canvas__surface (transform target).
  let innerSurfaceContent = null;
  function ensureInnerSurfaceContent() {
    if (innerSurfaceContent && innerSurface.contains(innerSurfaceContent)) return innerSurfaceContent;
    innerSurfaceContent = innerSurface.querySelector('.inner__surface-content');
    if (!innerSurfaceContent) {
      innerSurfaceContent = document.createElement('div');
      innerSurfaceContent.className = 'inner__surface-content';
      innerSurfaceContent.style.cssText = 'position:absolute;inset:0;transform-origin:0 0;will-change:transform;';
      innerSurface.appendChild(innerSurfaceContent);
    }
    return innerSurfaceContent;
  }
  function renderInnerSurface(lb) {
    // Keep the surface (parent clip box) intact; only refresh the content layer.
    // innerHTML='' on the surface would also wipe the content wrapper we added.
    const content = ensureInnerSurfaceContent();
    // BX-143: dispose connection state BEFORE clearing innerHTML — content.innerHTML=''
    // orphans innerConnSvg + all connLines SVG elements. Without this, renderConnections
    // skips creating new lines because connLines.has(c.id) returns true for stale refs.
    disposeAllConns();
    content.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const sb of lb.children || []) {
      frag.appendChild(createSmallBoxEl(lb.id, sb));
    }
    content.appendChild(frag);
    // BX-DEV-133 (B1 search): stamp largeId on inner surface so applySearchHighlight key matches
    innerSurface.dataset.largeId = lb.id;
    // BX-DEV-111 v2: measure each collapsed small box for precise expand animation
    content.querySelectorAll('.small-box.box--hover-expand.box--collapsed').forEach(setBodyExpandHeight);
    // BX-143: re-render connections AFTER disposeAllConns cleared them.
    // Without this call, any caller of renderInnerSurface strips all lines
    // (disposeAllConns is called early in this function), and subsequent
    // renderConnections is never called — lines stay invisible until
    // some other code path happens to render them.
    renderConnections();
  }

  function createSmallBoxEl(largeId, sb) {
    const w = sb.width || SMALL_DEF_W;
    const h = sb.height || SMALL_DEF_H;

    const el = document.createElement('div');
    el.className = 'small-box small-box--list'; // default list mode always
    el.dataset.id = sb.id;
    el.dataset.largeId = largeId;
    el.dataset.boxKey = smallKey(largeId, sb.id);
    el.dataset.kind = 'small';
    el.style.left = sb.x + 'px';
    el.style.top = sb.y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    // title bar (drag handle — title excluded)
    const bar = document.createElement('div');
    bar.className = 'small-box__bar';
    bar.addEventListener('mousedown', e => {
      if (!e.target.closest('.small-box__title') && !e.target.closest('.small-box__delete')) {
        // BX-DEV-111j: validate box still exists before allowing drag
        if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
        onBoxDragStart(e, 'small', { largeId, smallId: sb.id }, el);
      }
    });

    const title = document.createElement('span');
    title.className = 'small-box__title';
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.textContent = sb.title || i18n('newSmallBox');
    title.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); title.focus(); });
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      if (e.key === 'Escape') { title.textContent = sb.title || i18n('newSmallBox'); title.blur(); }
    });
    // SEC-03: Force plain-text paste for small box title
    title.addEventListener('paste', e => { e.preventDefault(); const text = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, text); });
    title.addEventListener('blur', () => {
      const t = title.textContent.trim() || i18n('newSmallBox');
      if (t !== sb.title) { sb.title = t; saveLayout(); }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'small-box__delete';
    delBtn.title = i18n('deleteBox');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteSmallBox(largeId, sb.id); });


    // ── pin button
    const pinBtn = document.createElement('button');
    pinBtn.className = 'box-pin-btn';
    pinBtn.title = i18n('pin');
    pinBtn.textContent = '⊙';
    pinBtn.title = sb.pinned ? i18n('unpin') : i18n('pin');
    pinBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:11px;padding:0 2px;opacity:0.4;flex-shrink:0;';
    // Default: NOT pinned
    sb.pinned = sb.pinned === true;  // normalize
    pinBtn.textContent = sb.pinned ? '⊙' : '○';
    pinBtn.style.opacity = sb.pinned ? '0.9' : '0.4';
    pinBtn.title = sb.pinned ? i18n('unpin') : i18n('pin');
    pinBtn.addEventListener('click', e => {
      e.stopPropagation();
      sb.pinned = !sb.pinned;
      pinBtn.title = sb.pinned ? i18n('unpin') : i18n('pin');
      pinBtn.style.opacity = sb.pinned ? '0.9' : '0.4';
      pinBtn.textContent = sb.pinned ? '⊙' : '○';
      el.classList.toggle('box--pinned', sb.pinned);
      saveLayout();
    });
    // ── auto-expand button
    const expandBtn = document.createElement('button');
    expandBtn.className = 'box-expand-btn';
    expandBtn.title = i18n('autoExpand');
    expandBtn.textContent = '⊟';
    expandBtn.title = sb.collapseHover ? i18n('autoExpandHover') : i18n('autoExpand');
    expandBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:11px;padding:0 2px;opacity:0.4;flex-shrink:0;';
    expandBtn.addEventListener('click', e => {
      e.stopPropagation();
      sb.collapseHover = !sb.collapseHover;
      expandBtn.title = sb.collapseHover ? i18n('autoExpandHover') : i18n('autoExpand');
      expandBtn.style.opacity = sb.collapseHover ? '0.9' : '0.4';
      expandBtn.textContent = sb.collapseHover ? '⊞' : '⊟';
      el.classList.toggle('box--hover-expand', sb.collapseHover);
      if (sb.collapseHover) {
        el.classList.add('box--collapsed');
        setBodyExpandHeight(el);  // BX-DEV-111: measure after collapsing small box
      } else {
        el.classList.remove('box--collapsed');
      }
      saveLayout();
      // BX-DEV-137++: refresh connections after small-box expand/collapse.
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
    });

        // BX-DEV-137+: connect button (↗) for cross-level lines. Star-mark stays
    // large-only per user confirmation — small-box star would need moveGroupTogether
    // override to lookup small-box parent context; not worth the complexity now.
    // BX-DEV-137++++: small-box star button (replaces ↗ connect button per user request).
    // Connection initiation now happens from box edge midpoints (mouse cursor +).
    const sbStarBtn = document.createElement('button');
    sbStarBtn.type = 'button';
    const _sbStarred = !!getGroupByParent(smallKey(largeId, sb.id));
    sbStarBtn.className = 'box-star-btn box-tool-btn' + (_sbStarred ? ' box-tool-btn--on' : '');
    sbStarBtn.textContent = _sbStarred ? '★' : '☆';
    sbStarBtn.title = i18n('connStarParent') || 'Star-mark as group parent';
    sbStarBtn.addEventListener('click', e => { e.stopPropagation(); toggleStarMark(smallKey(largeId, sb.id)); });
    if (_sbStarred) el.classList.add('box--starred');
    bar.append(title, pinBtn, expandBtn, sbStarBtn, delBtn);

    // body — bookmark list (always list mode, no grid)
    const body = document.createElement('div');
    body.className = 'small-box__body';

    renderBookmarks(body, largeId, sb);

    el.append(bar, body);

    // resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'box-resize-handle';
    resizeHandle.addEventListener('mousedown', e => onResizeStart(e, 'small', { largeId, smallId: sb.id }, el));
    el.appendChild(resizeHandle);

    // BX-DEV-111: restore persisted pinned & auto-expand state for small boxes
    el.classList.toggle('box--pinned', sb.pinned === true);
    if (sb.collapseHover) { el.classList.add('box--hover-expand'); el.classList.add('box--collapsed'); }
    // BX-DEV-137++++: refresh connections on hover-expand transition for small boxes.
    if (sb.collapseHover) {
      el.addEventListener('mouseenter', () => {
        const tidy = setTimeout(() => { if (connLines.size) refreshAllConns(); }, 360);
        const onEnd = () => { clearTimeout(tidy); el.removeEventListener('transitionend', onEnd); if (connLines.size) refreshAllConns(); };
        el.addEventListener('transitionend', onEnd, { once: true });
      });
      el.addEventListener('mouseleave', () => {
        const tidy = setTimeout(() => { if (connLines.size) refreshAllConns(); }, 360);
        const onEnd = () => { clearTimeout(tidy); el.removeEventListener('transitionend', onEnd); if (connLines.size) refreshAllConns(); };
        el.addEventListener('transitionend', onEnd, { once: true });
      });
    }


    addEdgeAnchors(el, smallKey(largeId, sb.id));
    return el;
  }

  function renderBookmarks(body, largeId, sb) {
    body.innerHTML = '';
    const bms = sb.bookmarks || [];

    for (let i = 0; i < bms.length; i++) {
      const bm = bms[i];

      const row = document.createElement('div');
      row.className = 'bm-row';
      // click bookmark → open tab
      row.style.cursor = 'pointer';
      row.addEventListener('click', e => {
        if (e.target.closest('.bm-row__edit-btn') || e.target.closest('.bm-row__grip')) return;
        const safeUrl = normalizeBookmarkUrl(bm.url);
        if (!safeUrl) { debugWarn('blocked invalid bookmark URL', bm.url); return; }
        (async function (url) {
          // BX-DEV-120: respect explicit settings.urlOpenMode first (default 'newTab').
          // Fall back to legacy per-browser default only when the setting is unset AND
          // Firefox exposes browserSettings.openBookmarksInNewTabs (Chrome has no equivalent).
          const mode = layout.settings && layout.settings.urlOpenMode;
          if (mode === 'sameTab') {
            if (api.tabs?.update) { api.tabs.update({ url }); }
            else { window.location.href = url; }
            return;
          }
          if (mode === 'newTab') {
            try {
              if (api.tabs?.create) { api.tabs.create({ url, active: true }); return; }
            } catch (e) { debug('tabs.create failed, fallback to window.open', e?.message); }
            window.open(url, '_blank', 'noopener');
            return;
          }
          // Unset — legacy browser default. Firefox respects openBookmarksInNewTabs; Chrome opens current tab.
          let openInNewTab = false;
          try {
            if (typeof browser !== 'undefined' && browser.browserSettings?.openBookmarksInNewTabs) {
              const s = await browser.browserSettings.openBookmarksInNewTabs.get({});
              openInNewTab = s.value;
            }
          } catch (_) { }
          if (openInNewTab) {
            api.tabs?.create ? api.tabs.create({ url, active: true }) : window.open(url, '_blank');
          } else {
            if (api.tabs?.update) { api.tabs.update({ url }); }
            else { window.location.href = url; }
          }
        })(safeUrl);
      });

      const dot = document.createElement('span');

      // Drag grip (⊛⋮) — leftmost handle for reordering bookmarks (BX-DEV-056)
      const grip = document.createElement('span');
      grip.className = 'bm-row__grip';
      grip.textContent = '⋮⋮';
      grip.title = i18n('dragToReorder');
      grip.style.cssText = 'cursor:grab;color:var(--color-muted);font-size:10px;padding:0 3px;flex-shrink:0;line-height:1;user-select:none;opacity:0.5;';
      grip.addEventListener('mouseenter', () => { grip.style.opacity = '1'; });
      grip.addEventListener('mouseleave', () => { grip.style.opacity = '0.5'; });
      grip.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        onBmRowDragStart(e, row, sb, largeId);
      });

      dot.className = 'bm-row__dot';
      dot.setAttribute('aria-hidden', 'true');

      const fav = document.createElement('img');
      fav.className = 'bm-row__favicon';
      // BX-DEV-107: multi-source async favicon with session cache
      fav.src = '';  // placeholder, loaded async below
      fav.width = 16; fav.height = 16;
      fav.style.flexShrink = '0';
      fav.style.display = 'none';  // hidden until loaded
      fav.onload = () => { fav.style.display = ''; };
      fav.onerror = () => { fav.style.display = 'none'; };
      // async load, non-blocking
      loadFavicon(fav, bm.url);

      const tEl = document.createElement('span');
      tEl.className = 'bm-row__title';
      tEl.textContent = bm.title || bm.url;

      // edit button (three dots)
      const editBtn = document.createElement('button');
      editBtn.className = 'bm-row__edit-btn';
      editBtn.title = i18n('editBookmarkLabel');
      editBtn.textContent = '⋯';
      editBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:14px;color:var(--color-muted);padding:0 4px;flex-shrink:0;';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        showBookmarkEditPopup(bm, i, sb, largeId);
      });

      row.append(grip, dot, fav, tEl, editBtn);
      body.appendChild(row);
    }

    // add bookmark button — opens popup for title+URL
    const addRow = document.createElement('div');
    addRow.className = 'bm-add-row';
    addRow.addEventListener('mousedown', e => e.stopPropagation());

    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.title = i18n('addBookmarkBtn');
    addBtn.style.cssText = 'width:100%;text-align:center;background:transparent;border:1px dashed var(--color-hairline);color:var(--color-muted);font-size:13px;padding:4px;border-radius:4px;cursor:pointer;';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      showAddBookmarkPopup(sb, largeId);
    });

    addRow.appendChild(addBtn);
    body.appendChild(addRow);
  }

  // BX-DEV-122 (Bug12 popup-followf-box): maintain a live tracker of open bookmark edit/add
  // popups so that pan/zoom/box-drag can reposition them to follow the attached small box.
  const __popupTrackers = new Map(); // DOMNode -> reposition fn
  function addPopupTracker(popupEl, repositionFn) {
    if (!popupEl || typeof repositionFn !== 'function') return;
    __popupTrackers.set(popupEl, repositionFn);
  }
  function removePopupTracker(popupEl) {
    if (popupEl) __popupTrackers.delete(popupEl);
  }
  function repositionAllPopups() {
    // Re-position every open popup to its currently attached small box.
    // Safe to call from hot paths (panmove, wheel, dragmove) — it's a Map#forEach + getBoundingClientRect.
    if (__popupTrackers.size === 0) return;
    // Drop popups that were resolved (removed from DOM, e.g. by save/cancel).
    for (const k of [...__popupTrackers.keys()]) {
      if (!document.body.contains(k)) __popupTrackers.delete(k);
    }
    __popupTrackers.forEach(fn => { try { fn(); } catch (_) {} });
  }

  // Inline bookmark edit popup
  function showBookmarkEditPopup(bm, index, sb, largeId) {
    // Remove any existing popup
    document.querySelectorAll('.bm-edit-popup').forEach(p => p.remove());

    // BX-DEV-111j: find small-box DOM for smart popup positioning
    const smallBoxEl = document.querySelector('.small-box[data-id="' + CSS.escape(sb.id) + '"]');
    const boxRect = smallBoxEl ? smallBoxEl.getBoundingClientRect() : null;

    const popup = document.createElement('div');
    popup.className = 'bm-edit-popup';
    popup.style.cssText = 'position:fixed;z-index:200;background:var(--color-elevated);border:1px solid var(--color-hairline);border-radius:var(--radius-tile);box-shadow:var(--shadow-pop);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);min-width:260px;';
    popup.dataset.attachedSbId = sb.id;

    // Title input
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = bm.title || '';
    titleInput.placeholder = i18n('bookmarkTitlePlaceholder');
    titleInput.style.cssText = 'padding:4px 8px;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;';
    titleInput.addEventListener('mousedown', e => e.stopPropagation());

    // URL input
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = bm.url || '';
    urlInput.placeholder = i18n('bookmarkUrlPlaceholder');
    urlInput.style.cssText = 'padding:4px 8px;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;';
    urlInput.addEventListener('mousedown', e => e.stopPropagation());

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:4px;justify-content:flex-end;';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = i18n('bookmarkSave');
    saveBtn.style.cssText = 'padding:4px 12px;background:var(--color-accent);color:#F7F3ED;border:0;border-radius:4px;font-size:12px;cursor:pointer;';
    saveBtn.addEventListener('click', e => {
      e.stopPropagation();
      const normalizedUrl = normalizeBookmarkUrl(urlInput.value);
      if (!normalizedUrl) { urlInput.style.borderColor = 'red'; return; }
      // BX-DEV-111k: validate box still exists before saving edited bookmark
      if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
      bm.title = titleInput.value.trim() || normalizedUrl;
      bm.url = normalizedUrl;
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
      removePopupTracker(popup);
    });
    // Enter key to save (BX-DEV-057)
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = i18n('bookmarkDelete');
    deleteBtn.style.cssText = 'padding:4px 12px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      // BX-DEV-111k: validate box still exists before deleting bookmark
      if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
      sb.bookmarks.splice(index, 1);
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
      removePopupTracker(popup);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = i18n('confirmCancel');
    cancelBtn.style.cssText = 'padding:4px 12px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    cancelBtn.addEventListener('click', e => { e.stopPropagation(); popup.remove(); removePopupTracker(popup); });

    btnRow.append(saveBtn, deleteBtn, cancelBtn);
    popup.append(titleInput, urlInput, btnRow);

    // BX-DEV-111j: position popup beside small box — right side if fits, else left
    const PW = 280, PH = 200, MARGIN = 12;
    function positionEditPopup() {
      const el = document.querySelector('.small-box[data-id="' + CSS.escape(sb.id) + '"]');
      const br = el ? el.getBoundingClientRect() : boxRect;
      if (br) {
        const rightSpace = window.innerWidth - br.right - MARGIN;
        if (rightSpace >= PW + MARGIN) {
          popup.style.left = (br.right + MARGIN) + 'px';
        } else {
          popup.style.left = Math.max(MARGIN, br.left - PW - MARGIN) + 'px';
        }
        popup.style.top = Math.max(MARGIN, Math.min(window.innerHeight - PH - MARGIN, br.top)) + 'px';
      } else {
        popup.style.left = Math.min(window.innerWidth - PW, 200) + 'px';
        popup.style.top = Math.min(window.innerHeight - PH, 300) + 'px';
      }
    }
    positionEditPopup();

    document.body.appendChild(popup);
    addPopupTracker(popup, positionEditPopup);

    // BX-DEV-127 (B7): close on outside MOUSEDOWN only — using 'click' closed the popup
    // when the user dragged-selected text starting inside an input and ending outside, because
    // the click target is the mouseup location (outside the popup). mousedown fires at the
    // press origin (inside the input, which popup.contains()), so drag-select no longer dismisses.
    const closeHandler = (ev) => {
      if (popup.contains(ev.target)) return; // press began inside popup → keep open
      popup.remove();
      removePopupTracker(popup);
      document.removeEventListener('mousedown', closeHandler, true);
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler, true), 50);
    titleInput.focus();
  }

  // Add bookmark popup (title + URL)
  function showAddBookmarkPopup(sb, largeId) {
    document.querySelectorAll('.bm-edit-popup').forEach(p => p.remove());

    // BX-DEV-111j: find small-box DOM for smart popup positioning
    const smallBoxEl = document.querySelector('.small-box[data-id="' + CSS.escape(sb.id) + '"]');
    const boxRect = smallBoxEl ? smallBoxEl.getBoundingClientRect() : null;

    const popup = document.createElement('div');
    popup.className = 'bm-edit-popup';
    popup.style.cssText = 'position:fixed;z-index:200;background:var(--color-elevated);border:1px solid var(--color-hairline);border-radius:var(--radius-tile);box-shadow:var(--shadow-pop);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);min-width:300px;';
    popup.dataset.attachedSbId = sb.id;

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = i18n('bookmarkTitlePlaceholder');
    titleInput.style.cssText = 'padding:6px 8px;border:1px solid var(--color-hairline);border-radius:4px;font-size:13px;background:var(--color-surface);color:var(--color-ink);outline:none;';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = i18n('bookmarkUrlPlaceholder');
    urlInput.style.cssText = 'padding:6px 8px;border:1px solid var(--color-hairline);border-radius:4px;font-size:13px;background:var(--color-surface);color:var(--color-ink);outline:none;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:4px;justify-content:flex-end;';

    const addBtn = document.createElement('button');
    addBtn.textContent = i18n('addBookmarkBtn');
    addBtn.style.cssText = 'padding:5px 14px;background:var(--color-accent);color:#F7F3ED;border:0;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      if (!url) return;
      const normalizedUrl = normalizeBookmarkUrl(url);
      if (!normalizedUrl) { urlInput.style.borderColor = 'red'; return; }
      // BX-DEV-111j: validate large box still exists before saving bookmark
      if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
      sb.bookmarks = sb.bookmarks || [];
      if (sb.bookmarks.length >= MAX_BOOKMARKS) { debug('max bookmarks'); return; }
      sb.bookmarks.push({ id: makeId('bm'), title: title || new URL(normalizedUrl).hostname, url: normalizedUrl });
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
      removePopupTracker(popup);
    });

    // Enter key in either input = add bookmark (BX-DEV-057)
    const addBmAction = () => {
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      if (!url) return;
      const normalizedUrl = normalizeBookmarkUrl(url);
      if (!normalizedUrl) { urlInput.style.borderColor = 'red'; return; }
      // BX-DEV-111j: validate large box still exists before saving bookmark
      if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
      sb.bookmarks = sb.bookmarks || [];
      if (sb.bookmarks.length >= MAX_BOOKMARKS) { debug('max bookmarks'); return; }
      sb.bookmarks.push({ id: makeId('bm'), title: title || new URL(normalizedUrl).hostname, url: normalizedUrl });
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
      removePopupTracker(popup);
    };
    // Update addBtn click to delegate:
    // Already handled above; add Enter key listeners:
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBmAction(); } });
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBmAction(); } });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = i18n('confirmCancel');
    cancelBtn.style.cssText = 'padding:5px 14px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    cancelBtn.addEventListener('click', e => { e.stopPropagation(); popup.remove(); removePopupTracker(popup); });

    btnRow.append(addBtn, cancelBtn);
    popup.append(titleInput, urlInput, btnRow);

    // BX-DEV-111j: position popup beside small box — right side if fits, else left
    const PW2 = 320, PH2 = 200, MG2 = 12;
    function positionAddPopup() {
      const el = document.querySelector('.small-box[data-id="' + CSS.escape(sb.id) + '"]');
      const br = el ? el.getBoundingClientRect() : boxRect;
      if (br) {
        const rightSpace = window.innerWidth - br.right - MG2;
        if (rightSpace >= PW2 + MG2) {
          popup.style.left = (br.right + MG2) + 'px';
        } else {
          popup.style.left = Math.max(MG2, br.left - PW2 - MG2) + 'px';
        }
        popup.style.top = Math.max(MG2, Math.min(window.innerHeight - PH2 - MG2, br.top)) + 'px';
      } else {
        popup.style.left = Math.max(MG2, (window.innerWidth - PW2) / 2) + 'px';
        popup.style.top = Math.max(MG2, (window.innerHeight - PH2) / 2) + 'px';
      }
    }
    positionAddPopup();

    document.body.appendChild(popup);
    addPopupTracker(popup, positionAddPopup);

    // BX-DEV-127 (B7): mousedown-only close — drag-select inside inputs no longer dismisses popup.
    const closeHandler2 = (ev) => {
      if (!popup.contains(ev.target)) {
        popup.remove();
        removePopupTracker(popup);
        document.removeEventListener('mousedown', closeHandler2, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler2, true), 50);
    titleInput.focus();
  }


  // ── Manual Drag (real-time, no jump) ─────────────────

  // Bookmark row drag-to-reorder (BX-DEV-056)
  // Drag grip on left of each bm-row; drag swaps positions in array
  function onBmRowDragStart(e, row, sb, largeId) {
    // BX-DEV-111k: validate large box still exists before allowing bookmark reorder
    if (!getLargeBox(largeId)) { showBoxDeletedWarning(largeId); return; }
    const body = row.parentElement;
    const rows = [...body.querySelectorAll('.bm-row')];
    const dragIdx = rows.indexOf(row);
    if (dragIdx < 0) return;
    const startY = e.clientY;
    const origOpacity = row.style.opacity;
    row.style.opacity = '0.5';
    row.style.zIndex = '10';
    document.body.style.cursor = 'grabbing';
    const onMove = (ev) => {
      row.style.transform = `translateY(${ev.clientY - startY}px)`;
      const rects = rows.map(r => r.getBoundingClientRect());
      rows.forEach(r => r.style.outline = 'none');
      for (let i = 0; i < rects.length; i++) {
        if (i !== dragIdx && ev.clientY < rects[i].bottom && ev.clientY > rects[i].top) {
          rows[i].style.outline = '2px dashed var(--color-accent)';
          rows[i].style.outlineOffset = '-2px';
          break;
        }
      }
    };
    const onUp = (ev) => {
      // Prevent click-from-drag on bookmark row (BX-DEV-065)
      const moved = Math.abs(ev.clientY - startY) > 4;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      row.style.transform = '';
      row.style.opacity = origOpacity;
      row.style.zIndex = '';
      rows.forEach(r => r.style.outline = 'none');
      if (moved) {
        // Block the subsequent click event that would open the bookmark
        ev.preventDefault(); ev.stopPropagation();
        setTimeout(() => {
          const blocker = (ce) => { ce.stopPropagation(); row.removeEventListener('click', blocker, true); };
          row.addEventListener('click', blocker, { once: true, capture: true });
        }, 0);
      }
      let targetIdx = dragIdx;
      const rects = rows.map(r => r.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        if (i !== dragIdx && ev.clientY < rects[i].bottom && ev.clientY > rects[i].top) { targetIdx = i; break; }
      }
      if (targetIdx !== dragIdx) {
        const bms = sb.bookmarks, item = bms[dragIdx];
        bms.splice(dragIdx, 1); bms.splice(targetIdx, 0, item);
        saveLayout();
        // BX-DEV-111k: only re-render bookmarks for this small box — don't rebuild entire surface
        const smallBoxEl = row.closest('.small-box');
        const bodyEl = smallBoxEl?.querySelector('.small-box__body');
        if (bodyEl) { renderBookmarks(bodyEl, largeId, sb); } else { const lb = getLargeBox(largeId); if (lb) renderInnerSurface(lb); }
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onBoxDragStart(e, type, id, el) {
    if (e.button !== 0) return; // left button only
    // Don't drag if box is pinned
    if (el.classList.contains('box--pinned')) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = el.getBoundingClientRect();
    const container = type === 'large' ? canvasContainer : innerCanvas;
    const zoom = type === 'large' ? canvasZoom : innerZoom;
    const panX = type === 'large' ? canvasPanX : innerPanX;
    const panY = type === 'large' ? canvasPanY : innerPanY;

    const memberOrigins = new Map(); // BX-DSU: capture ALL group member origins to prevent delta-stacking
    const dragKey = type === 'large' ? largeKey(id) : (id && id.largeId && id.smallId ? smallKey(id.largeId, id.smallId) : null);
    if (dragKey) {
      const g = getGroupByParent(dragKey);
      if (g) for (const mId of g.members) {
        // Capture origin for any member key type (large: or small:)
        if (typeof mId === 'string' && mId.startsWith('large:')) {
          const m = getLargeBox(mId.slice(6));
          if (m) memberOrigins.set(mId, { x: m.x, y: m.y });
        } else if (typeof mId === 'string' && mId.startsWith('small:')) {
          const parts = mId.split(':');
          if (parts.length >= 3) {
            const m = getSmallBox(parts[1], parts.slice(2).join(':'));
            if (m) memberOrigins.set(mId, { x: m.x, y: m.y });
          }
        } else {
          // legacy raw id — treat as large box
          const m = getLargeBox(mId);
          if (m) memberOrigins.set(mId, { x: m.x, y: m.y });
        }
      }
    }
    dragState = {
      type, id, el,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origLeft: parseInt(el.style.left, 10) || 0,
      origTop: parseInt(el.style.top, 10) || 0,
      zoom, panX, panY,
      container,
      memberOrigins,
      hasMoved: false // BX-DEV-137+++++: track actual drag movement to suppress accidental button click
    };

    el.classList.add(type === 'large' ? 'large-box--dragging' : 'small-box--dragging');
    el.style.zIndex = '10';

    document.addEventListener('mousemove', onBoxDragMove);
    document.addEventListener('mouseup', onBoxDragEnd);
    // BX-DEV-121: release a drag if focus leaves the window mid-drag (matches pan safety nets).
    window.addEventListener('blur', onBoxDragEnd);
    document.addEventListener('visibilitychange', onBoxDragVisHide);
    // BX-DEV-134 (B2): pointerup/pointercancel cover mouseup-swallow (iframe/popup/chrome)
    // cases that previously left dragState stuck with '-box--dragging' class + zIndex=10
    // permanently applied — a visible cause of intermittent 'cannot drag the box again'.
    document.addEventListener('pointerup', onBoxDragEnd);
    document.addEventListener('pointercancel', onBoxDragEnd);
  }
  function onBoxDragVisHide() { if (dragState) onBoxDragEnd({ type: 'visibilitychange' }); }

  function onBoxDragMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startMouseX;
    const dy = e.clientY - dragState.startMouseY;
    // BX-DEV-137+++++: Mark as moved if mouse traveled more than threshold — suppresses accidental button click after drag
    if (!dragState.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) dragState.hasMoved = true;
    // BX-DEV-121: read LIVE zoom — innerZoom/canvasZoom can change mid-drag via Ctrl+wheel.
    // Dividing by the stale start-of-drag snapshot made the box lag/jump behind the cursor.
    const liveZoom = dragState.type === 'large' ? canvasZoom : innerZoom;
    const worldDx = dx / liveZoom;
    const worldDy = dy / liveZoom;

    const newX = dragState.origLeft + worldDx;
    const newY = dragState.origTop + worldDy;

    dragState.el.style.left = newX + 'px';
    dragState.el.style.top = newY + 'px';
    // BX-DEV-PERF: only reposition popups if any exist — skip getBoundingClientRect on hot path
    if (__popupTrackers.size > 0) { try { repositionAllPopups(); } catch (_) {} }
    if (dragState.type === 'large') {
      // Real-time data model update so boxMidPoint reads live coords during drag
      const lb = getLargeBox(dragState.id);
      if (lb) { lb.x = newX; lb.y = newY; }
      refreshConnsForBoxSync(largeKey(dragState.id));
      // Bug 6: real-time group move — members follow parent during drag, not just at end
      if (getGroupByParent(largeKey(dragState.id))) {
        const dX = newX - dragState.origLeft;
        const dY = newY - dragState.origTop;
        moveGroupTogether(largeKey(dragState.id), dX, dY, dragState.memberOrigins);
      }
    }
    // BX-DEV-137+: small-box drag also refreshes cross-level lines
    if (dragState.type === 'small' && dragState.id && dragState.id.largeId && dragState.id.smallId) {
      // Real-time data model update so boxMidPoint reads live coords during drag
      const sb = getSmallBox(dragState.id.largeId, dragState.id.smallId);
      if (sb) { sb.x = newX; sb.y = newY; }
      const sKey = smallKey(dragState.id.largeId, dragState.id.smallId);
      refreshConnsForBoxSync(sKey);
      // BX-143: small-box parent drag — move group members real-time with elastic collision
      if (getGroupByParent(sKey)) {
        const dX = newX - dragState.origLeft;
        const dY = newY - dragState.origTop;
        moveGroupTogether(sKey, dX, dY, dragState.memberOrigins);
      }
    }
  }

  function onBoxDragEnd(e) {
    document.removeEventListener('mousemove', onBoxDragMove);
    document.removeEventListener('mouseup', onBoxDragEnd);
    window.removeEventListener('blur', onBoxDragEnd);
    document.removeEventListener('visibilitychange', onBoxDragVisHide);
    document.removeEventListener('pointerup', onBoxDragEnd);
    document.removeEventListener('pointercancel', onBoxDragEnd);
    // BX-DEV-137+++++: if a real drag happened, suppress the next click on toolbar buttons
    // to prevent accidental activation when drag started on a button area.
    if (dragState && dragState.hasMoved) {
      const suppressClick = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        document.removeEventListener('click', suppressClick, true);
      };
      document.addEventListener('click', suppressClick, true);
    }
    if (!dragState) return;

    const { type, id, el, container } = dragState;
    el.classList.remove(type === 'large' ? 'large-box--dragging' : 'small-box--dragging');
    el.style.zIndex = '';

    const finalX = parseInt(el.style.left, 10) || 0;
    const finalY = parseInt(el.style.top, 10) || 0;

    if (type === 'large') {
      const box = getLargeBox(id);
      if (!box) { dragState = null; return; }
      const w = box.width || LARGE_DEF_W, h = box.height || LARGE_DEF_H;
      const others = layout.boxes.filter(b => b.id !== box.id);
      // elastic snap
      const snapped = elasticSnap({ x: finalX, y: finalY }, w, h, others, CANVAS_GRID, snapCanvas);
      // clamp to virtual canvas boundary (world extends to containerW / MIN_ZOOM)
      const worldMaxX = (canvasContainer.clientWidth / 0.3) - w;
      const worldMaxY = (canvasContainer.clientHeight / 0.3) - h;
      const clamped = { x: Math.max(0, Math.min(snapped.x, worldMaxX)), y: Math.max(0, Math.min(snapped.y, worldMaxY)) };
      box.x = clamped.x; box.y = clamped.y;
      el.style.left = box.x + 'px';
      el.style.top = box.y + 'px';
      if (getGroupByParent(largeKey(box.id))) {
        const dX = box.x - dragState.origLeft;
        const dY = box.y - dragState.origTop;
        moveGroupTogether(largeKey(box.id), dX, dY, dragState.memberOrigins);
      }
      refreshConnsForBox(largeKey(box.id));
    } else {
      const sb = getSmallBox(id.largeId, id.smallId);
      if (!sb) { dragState = null; return; }
      const lb = getLargeBox(id.largeId);
      const others = (lb?.children || []).filter(s => s.id !== sb.id);
      const w = sb.width || SMALL_DEF_W, h = sb.height || SMALL_DEF_H;
      const snapped = elasticSnap({ x: finalX, y: finalY }, w, h, others, INNER_GRID, snapInner);
      // clamp to virtual inner surface boundary — surface starts at top:40px so
      // its inner height is (canvas - 40). Using innerCanvas height would add a
      // phantom 40px world region at the bottom covered by inner__canvas overflow
      // and cause the box to appear covered by nonexistent area at zoom out.
      const sw2 = innerSurface.clientWidth || innerCanvas.clientWidth;
      const sh2 = innerSurface.clientHeight || (innerCanvas.clientHeight - 40);
      const worldMaxX2 = (sw2 / 0.3) - w;
      const worldMaxY2 = (sh2 / 0.3) - h;
      sb.x = Math.max(0, Math.min(snapped.x, worldMaxX2));
      sb.y = Math.max(0, Math.min(snapped.y, worldMaxY2));
      el.style.left = sb.x + 'px';
      el.style.top = sb.y + 'px';
      // BX-DEV-137+: refresh cross-level lines connected to this small box
      const sKey = smallKey(id.largeId, id.smallId);
      refreshConnsForBox(sKey);
      // BX-143: small-box parent — final group move with snap at drag end
      if (getGroupByParent(sKey)) {
        const dX = sb.x - dragState.origLeft;
        const dY = sb.y - dragState.origTop;
        moveGroupTogether(sKey, dX, dY, dragState.memberOrigins);
        renderConnections();
      }
    }

    saveLayout();
    dragState = null;
    lastDragEndTime = Date.now();  // prevent click-from-drag (BX-DEV-065)
    if (type === "large") lastDragEndId = id;  // signal large box to clear barDownWasDragZone on next click (BX-DEV-077)
  }

  // ── Canvas Pan (left-drag empty area) ────────────────
  function onCanvasPanStart(e) {
    // Only pan if clicking empty canvas (not on a box)
    if (e.target.closest('.large-box') || e.target.closest('.small-box') || e.target.closest('.zoom-controls') || e.target.closest('.box-resize-handle') || e.target.closest('.header-pin-float') || e.target.id === 'header-pin-btn' || e.target.closest('#header-pin-btn')) return;
    if (e.button !== 0) return;

    canvasSurface.classList.add('panning');
    panState = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origPanX: canvasPanX,
      origPanY: canvasPanY,
      moved: false
    };
    document.addEventListener('mousemove', onCanvasPanMove);
    document.addEventListener('mouseup', onCanvasPanEnd);
    // BX-DEV-120A: window-blur safety net — if the user alt-tabs/releases the
    // mouse outside the document, document.mouseup can be missed, leaving
    // panState stuck and cursor=grabbing forever ("爬取键一直生效" bug).
    window.addEventListener('blur', onCanvasPanEnd);
    document.addEventListener('visibilitychange', onCanvasPanVisHide);
    // BX-DEV-128 (B3): pointerup/pointercancel cover the cases where mouseup is
    // swallowed by an iframe, cross-origin popup, or browser chrome (the recurring
    // "爬取键一直生效" intermittent). pointer events also fire for mouse and are
    // not blocked when the cursor leaves the document while the button is held.
    document.addEventListener('pointerup', onCanvasPanEnd);
    document.addEventListener('pointercancel', onCanvasPanEnd);
    // BX-DEV-112B: do not preventDefault on mousedown — allow dblclick synthesis.
  }

  function onCanvasPanMove(e) {
    if (!panState) return;
    const dx = e.clientX - panState.startMouseX;
    const dy = e.clientY - panState.startMouseY;
    if (!panState.moved && Math.abs(dx) < PAN_CURSOR_THRESHOLD && Math.abs(dy) < PAN_CURSOR_THRESHOLD) return;
    if (!panState.moved) {
      panState.moved = true;
      canvasContainer.style.cursor = 'grabbing';
    }
    const raw = { x: panState.origPanX + dx, y: panState.origPanY + dy };
    const clamped = clampCanvasPan(raw.x, raw.y, canvasZoom);
    canvasPanX = clamped.x;
    canvasPanY = clamped.y;
    applyCanvasTransform();
    e.preventDefault();
    try { repositionAllPopups(); } catch (_) {}
    // BX-DEV-145: refreshAllConns removed — applyCanvasTransform no longer
    // calls it, and CSS transform moves SVG lines automatically.
  }

  function onCanvasPanEnd(e) {
    canvasSurface.classList.remove('panning');
    document.removeEventListener('mousemove', onCanvasPanMove);
    document.removeEventListener('mouseup', onCanvasPanEnd);
    window.removeEventListener('blur', onCanvasPanEnd);
    document.removeEventListener('visibilitychange', onCanvasPanVisHide);
    document.removeEventListener('pointerup', onCanvasPanEnd);
    document.removeEventListener('pointercancel', onCanvasPanEnd);
    if (panState && panState.moved) canvasContainer.style.cursor = '';
    panState = null;
    persistViewState(true);
  }

  function onCanvasPanVisHide() {
    // BX-DEV-120A: tab-hide during pan — release grabbing immediately.
    if (panState) onCanvasPanEnd({ type: 'visibilitychange' });
  }

  // Inner canvas pan
  // BX-DEV-112B: mousedown must NOT prematurely set cursor=grabbing. Only after
  // a real drag (>= 3px movement) do we switch to grabbing. This keeps the
  // dblclick mousedown/mouseup sequence from flashing cursor between grab and
  // grabbing, and keeps dblclick event synthesis intact (no preventDefault on bare mousedown).
  const PAN_CURSOR_THRESHOLD = 3;
  function onInnerPanStart(e) {
    if (e.target.closest('.small-box') || e.target.closest('.zoom-controls') || e.target.closest('.box-resize-handle') || e.target.closest('.header-pin-float') || e.target.id === 'header-pin-btn' || e.target.closest('#header-pin-btn')) return;
    if (e.button !== 0) return;

    innerCanvas.classList.add('panning');
    panState = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origPanX: innerPanX,
      origPanY: innerPanY,
      moved: false
    };
    // Cursor switch deferred to first onInnerPanMove beyond threshold.
    document.addEventListener('mousemove', onInnerPanMove);
    document.addEventListener('mouseup', onInnerPanEnd);
    // BX-DEV-120A: window-blur + tab-hide safety net for inner canvas too.
    window.addEventListener('blur', onInnerPanEnd);
    document.addEventListener('visibilitychange', onInnerPanVisHide);
    // BX-DEV-128 (B3): pointerup/pointercancel mirror the canvas-pan fix; covers
    // iframe/popup/chrome swallow cases that leave the inner grab cursor stuck.
    document.addEventListener('pointerup', onInnerPanEnd);
    document.addEventListener('pointercancel', onInnerPanEnd);
    // Do NOT preventDefault on mousedown — that interferes with dblclick event
    // synthesis. panMove will call e.preventDefault() once a real drag starts.
  }

  function onInnerPanMove(e) {
    if (!panState) return;
    const dx = e.clientX - panState.startMouseX;
    const dy = e.clientY - panState.startMouseY;
    if (!panState.moved && Math.abs(dx) < PAN_CURSOR_THRESHOLD && Math.abs(dy) < PAN_CURSOR_THRESHOLD) return;
    if (!panState.moved) {
      panState.moved = true;
      innerCanvas.style.cursor = 'grabbing'; innerSurface.style.cursor = 'grabbing';
    }
    const raw = { x: panState.origPanX + dx, y: panState.origPanY + dy };
    const clamped = clampInnerPan(raw.x, raw.y, innerZoom);
    innerPanX = clamped.x;
    innerPanY = clamped.y;
    applyInnerTransform();
    e.preventDefault();
    // BX-DEV-111N+ : propagate live inner pan to other tabs within ~25ms (throttled).
    if (currentLargeBoxId) scheduleLargeBoxViewStatePersist(currentLargeBoxId);
    try { repositionAllPopups(); } catch (_) {}
  }

  function onInnerPanEnd(e) {
    innerCanvas.classList.remove('panning');
    document.removeEventListener('mousemove', onInnerPanMove);
    document.removeEventListener('mouseup', onInnerPanEnd);
    window.removeEventListener('blur', onInnerPanEnd);
    document.removeEventListener('visibilitychange', onInnerPanVisHide);
    document.removeEventListener('pointerup', onInnerPanEnd);
    document.removeEventListener('pointercancel', onInnerPanEnd);
    if (panState && panState.moved) {
      innerCanvas.style.cursor = ''; innerSurface.style.cursor = '';
    }
    panState = null;
    persistViewState(true);
    // BX-DEV-111N: persist inner pan into the current large box record.
    if (currentLargeBoxId) saveLargeBoxViewState(currentLargeBoxId);
  }

  function onInnerPanVisHide() {
    // BX-DEV-120A: tab-hide during pan — release grabbing immediately.
    if (panState) onInnerPanEnd({ type: 'visibilitychange' });
  }
  // ── Ctrl+scroll zoom ────────────────────────────────────
  function onCanvasWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const result = zoomAtPoint(canvasContainer, canvasZoom, canvasPanX, canvasPanY, e.clientX, e.clientY, factor);
      canvasZoom = result.zoom;
      // Clamp pan immediately to prevent flash-back on next move (BX-DEV-049)
      const clampedZoomPan = clampCanvasPan(result.panX, result.panY, canvasZoom);
      canvasPanX = clampedZoomPan.x;
      canvasPanY = clampedZoomPan.y;
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasTransform();
      // A4: refresh conn lines so LOD stroke-width + viewport-culling react to the new zoom.
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
      saveLayout();
      try { repositionAllPopups(); } catch (_) {}
    }
  }

  function onInnerWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const result = zoomAtPoint(innerCanvas, innerZoom, innerPanX, innerPanY, e.clientX, e.clientY, factor);
      innerZoom = result.zoom;
      const clampedInnerPan = clampInnerPan(result.panX, result.panY, innerZoom);
      innerPanX = clampedInnerPan.x;
      innerPanY = clampedInnerPan.y;
      applyInnerTransform();
      // A4: refresh inner conn lines after zoom so LOD/culling reacts.
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
      try { repositionAllPopups(); } catch (_) {}
      // BX-DEV-111N+v2 : single saveLayout path per wheel event via the throttled
      // schedulePersist (Map-based, 80ms). Previously this block called saveLayout()
      // AND saveLargeBoxViewState() AND schedulePersist() — three storage writes per
      // wheel tick, fully capable of blow-through chrome.storage.sync's
      // MAX_WRITE_OPERATIONS_PER_MINUTE=1200 mid continuous Ctrl+wheel zoom. The hot
      // path now schedules ONE throttled save (80ms, per-box isolated) which itself
      // runs saveLargeBoxViewState -> saveLayout. Snapshot is refreshed synchronously
      // inside schedulePersist so cross-tab readers still see fresh values immediately.
      if (currentLargeBoxId) scheduleLargeBoxViewStatePersist(currentLargeBoxId);
    }
  }

  // ── resize ─────────────────────────────────────────────
  function onResizeStart(e, type, id, el) {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;

    resizeState = {
      type, id, el,
      startX: e.clientX,
      startY: e.clientY,
      origW: parseInt(el.style.width, 10) || (type === 'large' ? LARGE_DEF_W : SMALL_DEF_W),
      origH: parseInt(el.style.height, 10) || (type === 'large' ? LARGE_DEF_H : SMALL_DEF_H),
      zoom: type === 'large' ? canvasZoom : innerZoom
    };
    document.body.classList.add('box-resizing');

    const onMove = (ev) => {
      if (!resizeState) return;
      const dx = (ev.clientX - resizeState.startX) / resizeState.zoom;
      const dy = (ev.clientY - resizeState.startY) / resizeState.zoom;
      let nw = resizeState.origW + dx;
      let nh = resizeState.origH + dy;
      nw = Math.round(nw / RESIZE_SNAP) * RESIZE_SNAP;
      nh = Math.round(nh / RESIZE_SNAP) * RESIZE_SNAP;
      const minW = type === 'large' ? LARGE_MIN_W : SMALL_MIN_W;
      const minH = type === 'large' ? LARGE_MIN_H : SMALL_MIN_H;
      nw = Math.max(minW, nw);
      nh = Math.max(minH, nh);
      el.style.width = nw + 'px';
      el.style.height = nh + 'px';
    };

    const onUp = () => {
      document.body.classList.remove('box-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!resizeState) return;
      const nw = parseInt(el.style.width, 10);
      const nh = parseInt(el.style.height, 10);
      if (type === 'large') {
        const box = getLargeBox(id);
        if (box) { box.width = nw; box.height = nh; }
      } else {
        const sb = getSmallBox(id.largeId, id.smallId);
        if (sb) { sb.width = nw; sb.height = nh; }
      }
      saveLayout();
      // BX-DEV-137++: refresh connections after resize — box dimensions changed,
      // leader-line cached stale bounding rect. rAF-coalesced via refreshAllConns.
      if (connLines.size) refreshAllConns();
      resizeState = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── create / delete ────────────────────────────────────
  async function addLargeBoxAt(clientX, clientY) {
    debug('addLargeBoxAt called', { clientX, clientY, boxCount: layout.boxes.length, nextIndex: layout.nextLargeIndex });
    if (layout.boxes.length >= MAX_LARGE_BOXES) { debug('max large boxes'); return; }
    const world = screenToWorld(clientX, clientY, canvasContainer, canvasPanX, canvasPanY, canvasZoom);
    debug('addLargeBoxAt world', world);
    const snapped = snapCanvas(world.x - LARGE_DEF_W / 2, world.y - LARGE_DEF_H / 2);
    debug('addLargeBoxAt snapped', snapped);
    const index = layout.nextLargeIndex++;
    debug('addLargeBoxAt making index', index);
    const newBox = {
      id: makeId('large'), type: 'large',
      title: i18n('newLargeBox', [index]),
      x: 0, y: 0,
      width: LARGE_DEF_W, height: LARGE_DEF_H,
      nextSmallIndex: 1, children: []
    };
    // BX-DEV-106: elastic-snap to avoid overlapping existing boxes
    const others = layout.boxes.map(b => ({ x: b.x, y: b.y, width: b.width || LARGE_DEF_W, height: b.height || LARGE_DEF_H }));
    const unsnapped = elasticSnap({ x: snapped.x, y: snapped.y }, LARGE_DEF_W, LARGE_DEF_H, others, CANVAS_GRID, snapCanvas);
    newBox.x = Math.max(0, unsnapped.x); newBox.y = Math.max(0, unsnapped.y);
    layout.boxes.push(newBox);
    debug('addLargeBoxAt pushed, count=' + layout.boxes.length);
    await saveLayout();
    debug('addLargeBoxAt saved, calling renderCanvas');
    renderCanvas();
    debug('addLargeBoxAt done, surface children=' + canvasSurface.children.length);
  }

  async function addLargeBox() {

    debug('addLargeBox (button) called', { boxCount: layout.boxes.length, nextIndex: layout.nextLargeIndex });
    if (layout.boxes.length >= MAX_LARGE_BOXES) { debug('max large boxes'); return; }
    const index = layout.nextLargeIndex++;
    debug('addLargeBox index', index);
    const others = layout.boxes.map(b => ({ x: b.x, y: b.y, width: b.width || LARGE_DEF_W, height: b.height || LARGE_DEF_H }));
    // BX-DEV-112: start at current viewport's top-left in world coords, not canvas origin
    const cvsRect = canvasContainer.getBoundingClientRect();
    const vpWorld = screenToWorld(cvsRect.left, cvsRect.top, canvasContainer, canvasPanX, canvasPanY, canvasZoom);
    let candidate = { x: vpWorld.x + 20, y: vpWorld.y + 20 };
    const snapped = snapCanvas(candidate.x, candidate.y);
    debug('addLargeBox snapped', snapped);
    candidate = elasticSnap(snapped, LARGE_DEF_W, LARGE_DEF_H, others, CANVAS_GRID, snapCanvas);
    debug('addLargeBox after elasticSnap', candidate);
    const newBox = {
      id: makeId('large'), type: 'large',
      title: i18n('newLargeBox', [index]),
      x: Math.max(0, candidate.x), y: Math.max(0, candidate.y),
      width: LARGE_DEF_W, height: LARGE_DEF_H,
      nextSmallIndex: 1, children: []
    };
    layout.boxes.push(newBox);
    debug('addLargeBox pushed, count=' + layout.boxes.length);
    await saveLayout();
    debug('addLargeBox saved, calling renderCanvas');
    renderCanvas();
    debug('addLargeBox done, surface children=' + canvasSurface.children.length);
  }
  debug('addLargeBox function defined');
  function updateInnerCaption(lb) {
    const captionEl = document.getElementById('caption');
    if (captionEl) captionEl.textContent = i18n('smallBoxesCount', [lb?.children?.length || 0]);
  }
  function deleteLargeBox(id) {
    openConfirmModal('large', id);
  }

  function _execDeleteLargeBox(id) {
    const removed = getLargeBox(id);
    markDeleted(id, ...(removed?.children || []).flatMap(child => [child.id, ...(child.bookmarks || []).map(bookmark => bookmark.id)]));
    ensureConnArrays();
    // BX-DEV-137+: connections/groups now use tiered keys. Drop connections where
    // from/to is 'large:id' or any 'small:id:*' (small boxes inside this large box).
    // Also keep back-compat with legacy raw-id connections (Round 1 format).
    const largeK = largeKey(id);
    const smallPrefix = 'small:' + id + ':';
    const matchesDeletedKey = k =>
      k === id ||                                    // legacy raw id
      k === largeK ||                               // 'large:id'
      (typeof k === 'string' && k.startsWith(smallPrefix));  // 'small:id:smallId'
    layout.connections = layout.connections.filter(c => !matchesDeletedKey(c.from) && !matchesDeletedKey(c.to));
    // A5: groups cleanup no longer needed
    layout.boxes = layout.boxes.filter(b => b.id !== id);
    layout.nextLargeIndex = layout.boxes.reduce((max, b) => Math.max(max, (parseInt((b.title || '').match(/\d+/) || [0]) || 0) + 1), 1);
    if (currentLargeBoxId === id) exitToCanvas();
    saveLayout();
    renderCanvas();
  }

  // BX-DEV-111j: Cross-tab delete protection — validate currentLargeBoxId still exists before any inner operation.
  function validateCurrentBox() {
    if (!currentLargeBoxId) return false;
    const lb = getLargeBox(currentLargeBoxId);
    if (!lb) {
      // Large box was deleted on another tab — block operations and warn
      showBoxDeletedWarning(currentLargeBoxId);
      currentLargeBoxId = null;
      exitToCanvas();
      return false;
    }
    return lb;
  }

  function showBoxDeletedWarning(staleId) {
    // Prevent duplicate warnings
    if (document.getElementById('box-deleted-warning')) return;
    const warn = document.createElement('div');
    warn.id = 'box-deleted-warning';
    warn.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--color-accent-ink);color:#F7F3ED;padding:var(--space-3) var(--space-5);border-radius:var(--radius-tile);box-shadow:var(--shadow-pop);font-size:14px;font-weight:600;display:flex;align-items:center;gap:var(--space-3);';
    const message = document.createElement('span');
    message.dataset.i18n = 'boxDeletedWarning';
    message.textContent = i18n('boxDeletedWarning');
    const refresh = document.createElement('button');
    refresh.dataset.i18n = 'refreshPage';
    refresh.textContent = i18n('refreshPage');
    refresh.style.cssText = 'background:transparent;color:inherit;border:1px solid rgba(255,255,255,0.3);padding:4px 12px;border-radius:var(--radius-tile);cursor:pointer;font-size:13px;';
    refresh.addEventListener('click', () => window.location.reload());
    warn.append(message, refresh);
    document.body.appendChild(warn);
    // Auto-dismiss after 10s
    setTimeout(() => { if (warn.parentNode) warn.remove(); }, 10000);
  }

  function addSmallBox() {
    const lb = validateCurrentBox();
    if (!lb) return;
    if ((lb.children?.length || 0) >= MAX_SMALL_BOXES) { debug('max small boxes'); return; }

    lb.children = lb.children || [];
    const others = lb.children.map(s => ({ x: s.x, y: s.y, width: s.width || SMALL_DEF_W, height: s.height || SMALL_DEF_H }));
    // BX-DEV-112: start at current viewport's top-left in world coords, not inner origin
    const innerRect = innerCanvas.getBoundingClientRect();
    const vpWorld = screenToWorld(innerRect.left, innerRect.top, innerCanvas, innerPanX, innerPanY, innerZoom);
    let candidate = { x: vpWorld.x + 20, y: vpWorld.y + 20 };
    const snapped = snapInner(candidate.x, candidate.y);
    candidate = elasticSnap(snapped, SMALL_DEF_W, SMALL_DEF_H, others, INNER_GRID, snapInner);
    lb.nextSmallIndex = lb.nextSmallIndex || 1;
    const idx = lb.nextSmallIndex++;
    lb.children.push({
      id: makeId('small'), type: 'small',
      title: i18n('newSmallBox'),
      x: Math.max(0, candidate.x), y: Math.max(0, candidate.y),
      width: SMALL_DEF_W, height: SMALL_DEF_H,
      pinned: false, bookmarks: []
    });
    saveLayout();
    renderInnerSurface(lb);
  }

  function addSmallBoxAt(clientX, clientY) {
    const lb = validateCurrentBox();
    if (!lb || (lb.children?.length || 0) >= MAX_SMALL_BOXES) return;
    const world = screenToWorld(clientX, clientY, innerCanvas, innerPanX, innerPanY, innerZoom);
    const snapped = snapInner(world.x - SMALL_DEF_W / 2, world.y - SMALL_DEF_H / 2);
    const idx = lb.nextSmallIndex++;
    lb.children = lb.children || [];
    lb.children.push({
      id: makeId('small'), type: 'small',
      title: i18n('newSmallBox'),
      x: 0, y: 0,
      width: SMALL_DEF_W, height: SMALL_DEF_H,
      pinned: false, bookmarks: []
    });
    // BX-DEV-106: elastic-snap to avoid overlapping existing small boxes
    const others = lb.children.filter(s => s.id !== lb.children[lb.children.length - 1].id).map(s => ({ x: s.x, y: s.y, width: s.width || SMALL_DEF_W, height: s.height || SMALL_DEF_H }));
    const last = lb.children[lb.children.length - 1];
    const unsnapped = elasticSnap({ x: snapped.x, y: snapped.y }, SMALL_DEF_W, SMALL_DEF_H, others, INNER_GRID, snapInner);
    last.x = Math.max(0, unsnapped.x); last.y = Math.max(0, unsnapped.y);
    saveLayout();
    renderInnerSurface(lb);
  }

  function deleteSmallBox(largeId, smallId) {
    openConfirmModal('small', smallId, largeId);
  }

  function _execDeleteSmallBox(largeId, smallId) {
    const lb = getLargeBox(largeId);
    if (!lb) return;
    const removed = lb.children.find(s => s.id === smallId);
    markDeleted(smallId, ...(removed?.bookmarks || []).map(bookmark => bookmark.id));
    // BX-DEV-137+: prune connections/groups referencing this small box's tiered key.
    const sk = smallKey(largeId, smallId);
    ensureConnArrays();
    layout.connections = layout.connections.filter(c => c.from !== sk && c.to !== sk);
    // A5: groups cleanup no longer needed
    lb.children = lb.children.filter(s => s.id !== smallId);
    saveLayout();
    disposeAllConns(); // BX-DEV-137+++: clear stale lines before re-rendering inner surface
    renderInnerSurface(lb);
    renderConnections(); // BX-DEV-137+++: re-render connections after small box deletion
  }

  function applyExternalLayout(raw) {
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

    applyingExternalLayout = true;
    const staleLargeBoxId = currentLargeBoxId;
    const incomingSerialized = JSON.stringify(incoming);
    layout = incomingWins
      ? mergeConcurrentLayout(incoming, layout)
      : mergeConcurrentLayout(layout, incoming);
    const needsReconcileWrite = JSON.stringify(layout) !== incomingSerialized;
    // A5: groupIdx no longer needed; dsuRebuild reads box.isParent
    dsuRebuildFromConnections();
    connIdx.clear();
    boxConnIdx.clear();
    try {
      if (staleLargeBoxId && !getLargeBox(staleLargeBoxId)) {
        currentLargeBoxId = null;
        innerPanX = 0;
        innerPanY = 0;
        innerZoom = 1;
        renderCanvas();
        showBoxDeletedWarning(staleLargeBoxId);
      } else if (currentLargeBoxId) {
        const lb = getLargeBox(currentLargeBoxId);
        if (lb) {
          // BX-DEV-111N+ : if the incoming writer is another tab and it produced a newer
          // viewState for the currently-open large box, and the user is not actively panning,
          // pull inner zoom/pan from lb.viewState so the current tab reflects the remote edit
          // immediately. Active pan (panState !== null) wins: never interrupt a live drag.
          try {
            if (panState === null && lb.viewState && typeof lb.viewState.innerZoom === 'number') {
              const remoteTs = Number(lb.viewState.updatedAt) || 0;
              // BX-DEV-111N+v2: compare against THIS tab's own last write to lb.viewState,
              // NOT layout._meta.updatedAt (mergeConcurrentLayout already overwrote
              // it with the incoming _meta, making remoteTs>localTs always false and
              // cross-tab adopt dead). 100ms tolerance absorbs wall-clock drift between
              // tabs while still excluding our own just-written revision.
              const ownTs = __selfLastWriteTs.get(lb.id) || 0;
              // Only adopt when the remote viewState is strictly newer than what this tab
              // most recently wrote; avoids ping-pong when both tabs idle on the same box.
              if (remoteTs > ownTs + 100) {
                innerZoom = Number(lb.viewState.innerZoom) || innerZoom;
                innerPanX = Number(lb.viewState.innerPanX) || 0;
                innerPanY = Number(lb.viewState.innerPanY) || 0;
                debug('applyExternalLayout: adopted remote viewState', { box: lb.id, innerZoom, innerPanX, innerPanY, remoteTs });
              }
            }
          } catch (ev) { debugWarn('applyExternalLayout viewState adopt', ev); }
          renderInnerSurface(lb);
          renderCrumbs(lb);
          updateCaption();
          applyInnerTransform();
          // BX-DEV-137++: re-render connections on cross-tab sync into inner-surface view
          renderConnections();
        }
      } else {
        renderCanvas();
      }
      if (needsReconcileWrite && incomingWins) saveLayoutDebounced();
      debug('external layout applied', { revision: incomingRevision, boxes: layout.boxes.length });
      return true;
    } finally {
      applyingExternalLayout = false;
    }
  }

  // ── settings modal ─────────────────────────────────────
  function openSettingsModal() {
    debug('openSettingsModal called, current hidden=' + settingsModal.hidden);
    settingsModal.hidden = false;
    debug('openSettingsModal set hidden=false, now=' + settingsModal.hidden + ' display=' + getComputedStyle(settingsModal).display);
    langSelect.value = layout.settings.selectedLanguage || 'en';
    rememberCheck.checked = layout.settings.rememberLastPos !== false;
  if (urlOpenModeSelect) urlOpenModeSelect.value = layout.settings.urlOpenMode || 'newTab';
    darkModeCB.checked = layout.settings.darkMode === true;
    zoomSlider.value = Math.round((canvasZoom || 1.0) * 100);
    zoomSliderVal.textContent = Math.round((canvasZoom || 1.0) * 100) + '%';
    fontSlider.value = layout.settings.fontSize || 14;
    fontSliderVal.textContent = (layout.settings.fontSize || 14) + 'px';
    // square corners
    const squareCB = document.getElementById('square-corners-cb');
    if (squareCB) squareCB.checked = layout.settings.squareCorners === true;
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
  window._boxingDeleteLargeBox = _execDeleteLargeBox; // BX-DEV-111k: exposed for cross-tab delete test

  // ── confirm modal (in-page, replaces browser confirm()) ──
  let confirmCallback = null;
  function openConfirmModal(type, id, largeId) {
    confirmModal.hidden = false;
    confirmTitle.textContent = i18n('confirmDeleteTitle');
    const bodyText = type === 'large' ? i18n('confirmDeleteLargeBody') : i18n('confirmDeleteSmallBody');
    confirmBody.textContent = bodyText;
    confirmCallback = () => {
      if (type === 'large') _execDeleteLargeBox(id);
      else _execDeleteSmallBox(largeId, id);
    };
  }
  function closeConfirmModal() {
    confirmModal.hidden = true;
    confirmCallback = null;
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
          innerPanX = Math.max(sw * (1.0 - innerZoom / 0.3), Math.min(0, -sb.x * innerZoom + 16));
          innerPanY = Math.max(sh * (1.0 - innerZoom / 0.3), Math.min(0, -sb.y * innerZoom + 16));
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
        innerZoom = zoomStep(innerZoom, 'in');
        const ci = clampInnerPan(innerPanX, innerPanY, innerZoom); innerPanX = ci.x; innerPanY = ci.y;
        applyInnerTransform();
      } else {
        canvasZoom = zoomStep(canvasZoom, 'in');
        const cc = clampCanvasPan(canvasPanX, canvasPanY, canvasZoom); canvasPanX = cc.x; canvasPanY = cc.y;
        layout.settings.zoomLevel = canvasZoom;
        applyCanvasTransform();
        saveLayout();
      }
    }
    if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      if (currentLargeBoxId) {
        innerZoom = zoomStep(innerZoom, 'out');
        const ci = clampInnerPan(innerPanX, innerPanY, innerZoom); innerPanX = ci.x; innerPanY = ci.y;
        applyInnerTransform();
      } else {
        canvasZoom = zoomStep(canvasZoom, 'out');
        const cc = clampCanvasPan(canvasPanX, canvasPanY, canvasZoom); canvasPanX = cc.x; canvasPanY = cc.y;
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
      lastEnterLargeBoxAt = Date.now();
      suppressInnerDblClickOnce = true;
      enterLargeBox(targetBox.dataset.id);
      return;
    }
    debug('onCanvasDblClick on empty area, calling addLargeBoxAt');
    addLargeBoxAt(e.clientX, e.clientY);
  }

  function onInnerClick(e) {
    const now = Date.now();
    const target = e.target.closest('.small-box');
    if (target) { lastClickTime = 0; return; }
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
        suppressInnerDblClickOnce = false;
        debug('onInnerDblClick suppressed: one-shot from enterLargeBox');
        return;
      } else {
        // Stale one-shot flag; discard so user dblclicks are no longer blocked.
        suppressInnerDblClickOnce = false;
      }
    }
    if (withinEnterWindow) {
      debug('onInnerDblClick suppressed: within 350ms of enterLargeBox');
      return;
    }
    const targetBox = e.target.closest('.small-box');
    if (targetBox) return;
    addSmallBoxAt(e.clientX, e.clientY);
  }

  // ── window resize → refresh canvas transform ───────────

  function normalizeBookmarkUrl(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 2048 || /^\d+(\.\d+){0,3}$/.test(trimmed)) return null;
    // Reject all non-http(s) schemes; protocol-relative URLs (//host) also rejected
    if (/^(javascript|data|vbscript|file|ftp|moz-extension|chrome-extension|chrome|edge|about|blob|view-source):/i.test(trimmed)) return null;
    if (/^\/\//.test(trimmed)) return null; // protocol-relative URL
    const privateHost = /^(10\.\d+\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.\d+\.\d+\.|localhost(?::\d+)?(?:\/|$))/i.test(trimmed);
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `${privateHost ? 'http' : 'https'}://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
      return parsed.href;
    } catch (_) { return null; }
  }

  function ensureHttpsUrl(url) {
    return normalizeBookmarkUrl(url);
  }
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
    headerPinned = layout.settings.headerPinned !== false;  // true if not explicitly set to false

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
      canvasZoom = zoomStep(canvasZoom, 'out');
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasTransform();
      saveLayout();
    });
    canvasZoomIn?.addEventListener('click', () => {
      canvasZoom = zoomStep(canvasZoom, 'in');
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasTransform();
      saveLayout();
    });
    innerZoomOut?.addEventListener('click', () => {
      innerZoom = zoomStep(innerZoom, 'out');
      applyInnerTransform();
    });
    innerZoomIn?.addEventListener('click', () => {
      innerZoom = zoomStep(innerZoom, 'in');
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
    zoomSlider?.addEventListener('input', () => {
      zoomSliderVal.textContent = zoomSlider.value + '%';
    });
    zoomSlider?.addEventListener('change', () => {
      const v = parseInt(zoomSlider.value, 10) / 100;
      canvasZoom = v; innerZoom = v;
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
          status = resp.status; ok = resp.ok;
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
          status = resp.status; ok = resp.ok;
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
            layout = cloud;
            if (savedSettings) layout.settings = { ...cloud.settings, ...savedSettings };
            if (savedMeta) layout._meta = { ...cloud._meta, ...savedMeta, updatedAt: Date.now(), writerId };
            layout._meta = layout._meta || {};
            layout._meta.updatedAt = Date.now();
            layout._meta.writerId = writerId;
            const lossRev = (Number(cloud._meta?.revision) || 0) + 1;
            layout._meta.revision = lossRev;
            // Direct write — avoid saveLayout restoring the truncated local.
            try {
              await layoutStorage.set({ boxingLayout: JSON.parse(JSON.stringify(layout)) });
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
        layout = cloud;
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
          await layoutStorage.set({ boxingLayout: JSON.parse(JSON.stringify(layout)) });
        } catch (e) { debugErr('WebDAV sync: first-time pull set failed', e); }
        renderCanvas();
        debug('WebDAV sync: first-time pull', { boxes: layout.boxes.length });
        return { direction: 'pull', cloudBoxes: layout.boxes.length, localBoxes: layout.boxes.length, firstSync: true };
      }

      // Both exist: newer wins.
      if (cloud && Array.isArray(cloud.boxes)) {
        if (cloudUpdatedAt >= localUpdatedAt && cloud?._meta?.writerId !== writerId) {
          // Cloud is newer or equal-but-different-writer → pull.
          // BX-DEV-138: preserve local connections/groups when cloud payload lacks them
          // (settingsOnly sync mode strips connections/groups from the uploaded payload).
          const savedSettings = layout.settings;
          const savedMeta = layout._meta;
          const savedConns = Array.isArray(layout.connections) ? layout.connections : [];
          layout = cloud;
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
            await layoutStorage.set({ boxingLayout: JSON.parse(JSON.stringify(layout)) });
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
        else { backupToLocal(); }
        layout.settings.lastBackupAt = Date.now();
        updateLastBackupDisplay();
        saveLayout();
      } catch (e) { debugErr('Backup failed', e); if (p !== 'local') backupToLocal(); }
    }

    backupNowBtn?.addEventListener('click', () => performBackup());

    // ── Auto-backup scheduler ──────────────────────
    let autoBackupTimer = null;
    let lastAutoBackupTs = 0;

    function setupAutoBackup(sec) {
      if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
      if (!sec || sec < 3600) return;  // minimum 1 hour
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
      if (file.size > 5 * 1024 * 1024) { try { alert(i18n('importTooLarge')); } catch (_) { } importFile.value = ''; return; }
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
        layout = migrateLayout(data);
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
        try { /* silent success — no alert needed */ } catch (_) { }
        debug('Import succeeded, layout replaced');
      } catch (_) { try { alert(i18n('importFailed')); } catch (_) { } }
      importFile.value = '';
    });

    // ── BX-AUD-05: diagnostics UI surface (Settings > Data > Diagnostics) ───
    diagExportLogBtn?.addEventListener('click', () => {
      try {
        const text = (window.__boxingDebug && typeof window.__boxingDebug.exportLog === 'function') ? window.__boxingDebug.exportLog() : '';
        if (!text) { try { alert(i18n('diagNoLogs') || 'No log entries yet'); } catch (_) {} return; }
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
    window.addEventListener('pagehide', () => { try { const __fvf = window.__boxingFlushPendingViewStatePersist; if (typeof __fvf === "function") __fvf(); } catch (_) {} persistViewState(false); try { const fn = window.__boxingFlushCredentials; if (typeof fn === 'function') fn(); } catch (_) {} });
    // BX-DEV-111M: flush credentials on tab switch / window hide / beforeunload —
    // fixes the 'close browser loses WebDAV password' bug (blur never fires in those paths).
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { try { const __fvf = window.__boxingFlushPendingViewStatePersist; if (typeof __fvf === "function") __fvf(); } catch (_) {} persistViewState(false); try { const fn = window.__boxingFlushCredentials; if (typeof fn === 'function') fn(); } catch (_) {} } });
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
          try { if (typeof refreshContainerSizes === 'function') refreshContainerSizes(); } catch (_) {}
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
    window.addEventListener('beforeunload', () => { try { const __fvf = window.__boxingFlushPendingViewStatePersist; if (typeof __fvf === "function") __fvf(); } catch (_) {} try { const fn = window.__boxingFlushCredentials; if (typeof fn === 'function') fn(); } catch (_) {} });

    api.storage.onChanged?.addListener?.((changes, areaName) => {
      const expectedArea = layoutStorage === api.storage.local ? 'local' : 'sync';
      if (areaName !== expectedArea || !changes.boxingLayout?.newValue) return;
      applyExternalLayout(changes.boxingLayout.newValue);
    });

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
      canvasZoom = Number(view.canvasZoom) || 1;
      canvasPanX = Number(view.canvasPanX) || 0;
      canvasPanY = Number(view.canvasPanY) || 0;
      innerZoom = Number(view.innerZoom) || 1;
      innerPanX = Number(view.innerPanX) || 0;
      innerPanY = Number(view.innerPanY) || 0;
      if (view.headerPinned !== undefined) headerPinned = view.headerPinned;
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
          try { close(false); } catch (_) {}
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
          saveLayout();
          debug('onboarding lang changed', onbLang.value);
        });
      }
    } catch (el) { debugErr('onboarding lang setup', el); }
    overlay.hidden = false;
    render();
  }

  await init();
})();
// BX-DEV-111 v2: Fastest-CDN race — probe all sources on first request, lock winner for session
const FAVICON_SOURCES = [
  { name: 'bytecook', url: (h) => `https://ico.bytecook.io/${h}` },
  { name: 'duckduckgo', url: (h) => `https://icons.duckduckgo.com/ip3/${h}.ico` },
  { name: 'google', url: (h) => `https://www.google.com/s2/favicons?domain=${h}&sz=32` },
  { name: 'faviconim', url: (h) => `https://favicon.im/${h}` },
];
let fastestCDN = null; // session-locked winner after race
let cdnRaceDone = false;

function getFaviconUrl(url) {
  try { const host = new URL(url).hostname; if (!host) return null; } catch (_) { return null; }
  const host = new URL(url).hostname;
  if (fastestCDN) return fastestCDN.url(host);
  // Default: DuckDuckGo (global, CN-accessible)
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

// BX-DEV-111 v2: Race all CDNs on first favicon request, pick fastest
async function raceCDN(testHost) {
  if (cdnRaceDone) return;
  cdnRaceDone = true;
  let bestTime = Infinity;
  const results = await Promise.allSettled(FAVICON_SOURCES.map(async (src) => {
    const url = src.url(testHost);
    const start = performance.now();
    await new Promise((resolve, reject) => {
      const probe = new Image();
      const timer = setTimeout(() => reject(new Error('timeout')), 2500);
      probe.onload = () => { clearTimeout(timer); resolve(); };
      probe.onerror = () => { clearTimeout(timer); reject(new Error('load failed')); };
      probe.src = url;
    });
    const elapsed = performance.now() - start;
    return { src, elapsed };
  }));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.elapsed < bestTime) {
      bestTime = r.value.elapsed;
      fastestCDN = r.value.src;
    }
  }
  if (window.__BOXING_DEBUG__) console.debug('[Boxing] CDN race winner:', fastestCDN?.name || 'none', Number.isFinite(bestTime) ? bestTime.toFixed(0) + 'ms' : 'n/a');
}

// BX-DEV-111 v2: Validate URL before favicon fetch — skip intranet / non-http / raw IP
function isValidPublicUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return false;
    const h = u.hostname;
    if (!h || h === 'localhost') return false;
    // Skip raw IPv4 / IPv6 addresses
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
    if (h.includes(':')) return false; // IPv6
    // Skip intranet ranges: 10.x, 172.16-31.x, 192.168.x, 127.x
    const parts = h.split('.');
    if (parts.length === 4) {
      const a = +parts[0], b = +parts[1];
      if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    return true;
  } catch (_) { return false; }
}

const faviconCache = new Map(); // volatile: cleared on browser restart (session-scoped)
// BX-DEV-121 (Bug12): persistent favicon URL cache in localStorage with TTLs.
//   hit  (url != null) → 7-day TTL
//   miss (url == null) → 90-day TTL (avoid re-racing 404 sites)
const FAV_CACHE_KEY = 'boxingFaviconCache.v1';
const FAV_HIT_TTL = 7 * 24 * 3600 * 1000;     // 7 days
const FAV_MISS_TTL = 90 * 24 * 3600 * 1000;   // 90 days
const FAV_MAX_ENTRIES = 2000; // bounded — no unbounded localStorage growth
let __favPersistPending = false;
function loadFaviconCacheFromStorage() {
  try {
    const raw = localStorage.getItem(FAV_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    const now = Date.now();
    const entries = (obj && obj.entries) || {};
    for (const host of Object.keys(entries)) {
      const e = entries[host];
      if (!e || typeof e.ts !== 'number') continue;
      const ttl = (e.url === null) ? FAV_MISS_TTL : FAV_HIT_TTL;
      if (now - e.ts > ttl) continue; // expired: drop it (will re-race lazily)
      faviconCache.set(host, e.url);
    }
  } catch (_) { /* corrupt cache — ignore; will rebuild lazily */ }
}
function persistFaviconCacheNow() {
  try {
    const entries = {};
    // Trim to most recent FAV_MAX_ENTRIES to keep the JSON bounded.
    let pairs = Array.from(faviconCache.entries());
    // We track no per-entry ts in mem; approximate recency by iteration order (Map preserves insertion order).
    // Cap: keep newest FAV_MAX_ENTRIES by trimming oldest inserts (first ones).
    if (pairs.length > FAV_MAX_ENTRIES) pairs = pairs.slice(pairs.length - FAV_MAX_ENTRIES);
    const now = Date.now();
    for (const [host, u] of pairs) entries[host] = { url: u, ts: now };
    localStorage.setItem(FAV_CACHE_KEY, JSON.stringify({ entries, savedAt: now }));
  } catch (_) { /* quota exceeded — fail-soft; mem cache still works this session */ }
}
function persistFaviconCacheDebounced() {
  if (__favPersistPending) return;
  __favPersistPending = true;
  setTimeout(() => { __favPersistPending = false; persistFaviconCacheNow(); }, 400);
}
// BX-DEV-121: hydrate the mem cache on first script load.
try { loadFaviconCacheFromStorage(); } catch (_) {}

async function loadFavicon(img, url) {
  // BX-DEV-126 (B10): parallel CDN race via Promise.any — fastest token wins, no serial waterfall.
  if (!isValidPublicUrl(url)) { img.style.display = 'none'; return; }
  const host = new URL(url).hostname;
  // Cache hit — instant render, zero network.
  if (faviconCache.has(host)) { const c = faviconCache.get(host); if (c === null) { img.style.display = 'none'; return; } img.src = c; return; }
  // Trigger session CDN speed race on first-ever favicon request (sets fastestCDN).
  if (!cdnRaceDone) raceCDN(host);
  // Build token list: racy winner first (if resolved), then other sources, then direct /favicon.ico.
  const tokens = [];
  if (fastestCDN) tokens.push(fastestCDN.url(host));
  for (const src of FAVICON_SOURCES) {
    const u = src.url(host);
    if (!tokens.includes(u)) tokens.push(u);
  }
  tokens.push(`https://${host}/favicon.ico`);
  // Probe helper — resolves with the winning url, rejects on timeout/error.
  function probe(url) {
    return new Promise((resolve, reject) => {
      const probe = new Image();
      const timer = setTimeout(() => reject(new Error('timeout')), 3000);
      probe.onload = () => { clearTimeout(timer); resolve(url); };
      probe.onerror = () => { clearTimeout(timer); reject(new Error('fail')); };
      probe.src = url;
    });
  }
  try {
    // Promise.any: returns first fulfilled (winning url). Removed serial waterfall blocking.
    const winningUrl = await Promise.any(tokens.map(probe));
    faviconCache.set(host, winningUrl); try { persistFaviconCacheDebounced(); } catch (_) {} img.src = winningUrl;
  } catch (_) {
    // All tokens failed — cache the miss with 90-day TTL so we don't re-race dead hosts.
    faviconCache.set(host, null); try { persistFaviconCacheDebounced(); } catch (_) {} img.style.display = 'none';
  }
}
