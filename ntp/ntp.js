/** Boxing — NTP core v3.1: Obsidian-style infinite canvas, manual drag (real-time), title-only edit zone, elastic snap, bookmark CRUD, i18n store, settings modal, debug */
'use strict';

(async () => {
  // ── cross-browser API ──────────────────────────────────
  let api = (typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : null);
  // In file:/// or non-extension contexts, chrome/browser may exist but storage is unavailable.
  if (!api || !api.storage || !api.storage.sync) {
    const mock = {
      storage: { sync: {
        get: async (_keys) => { try { const v = localStorage.getItem('boxingLayout'); return v ? { boxingLayout: JSON.parse(v) } : { boxingLayout: null }; } catch (_) { return { boxingLayout: null }; } },
        set: async (obj) => { try { localStorage.setItem('boxingLayout', JSON.stringify(obj.boxingLayout)); } catch (_) {} }
      }}, runtime: { getURL: (p) => p }
    };
    api = mock; self.chrome = mock; self.browser = mock;
  }

  // ── constants ──────────────────────────────────────────
  const CANVAS_GRID = 24;
  const INNER_GRID  = 16;
  const RESIZE_SNAP = 5;
  const LARGE_DEF_W = 320, LARGE_DEF_H = 220;
  const SMALL_DEF_W  = 360, SMALL_DEF_H = 340;
  const LARGE_MIN_W = 200, LARGE_MIN_H = 120;
  const SMALL_MIN_W  = 180, SMALL_MIN_H = 200;
  const MAX_LARGE_BOXES = 1000;
  const MAX_SMALL_BOXES = 500;
  const MAX_BOOKMARKS = 50;
  const ZOOM_STEPS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5];
  const MIN_ZOOM = 0.3, MAX_ZOOM = 2.0;
  const DEBUG = true;

  // ── debug ──────────────────────────────────────────────
  function debug(...args) { if (window.__BOXING_DEBUG__) console.log('[Boxing]', ...args); }
  function debugErr(...args) { if (window.__BOXING_DEBUG__) console.error('[Boxing]', ...args); }
  function debugWarn(...args) { if (window.__BOXING_DEBUG__) console.warn('[Boxing]', ...args); }

  // ── Enhanced debug system (v3.6.5+) ─────────────────
  // DEBUG=true enables all logs. Set DEBUG=false for production.
  // URL param ?debug=1 enables debug regardless of DEBUG constant.
  // URL param ?debug=0 disables debug regardless of DEBUG constant.
  // URL param ?debug=verbose adds stack traces and timing info.
  (function initDebugMode() {
    const params = new URLSearchParams(location.search);
    const flag = params.get('debug');
    if (flag === '1') { window.__BOXING_DEBUG__ = true; window.__BOXING_VERBOSE__ = false; }
    else if (flag === '0') { window.__BOXING_DEBUG__ = false; window.__BOXING_VERBOSE__ = false; }
    else if (flag === 'verbose') { window.__BOXING_DEBUG__ = true; window.__BOXING_VERBOSE__ = true; }
    else { window.__BOXING_DEBUG__ = DEBUG; window.__BOXING_VERBOSE__ = false; }
    debug('[debug] mode=' + (window.__BOXING_DEBUG__ ? 'on' : 'off') + ' verbose=' + (window.__BOXING_VERBOSE__ ? 'on' : 'off'));
  })();

  // Expose debug API for extension DevTools console inspection
  window.__boxingDebug = {
    state() { return { boxes: layout.boxes.length, currentLargeBoxId, canvasZoom, innerZoom, headerPinned, darkMode: layout.settings.darkMode, lang: currentLang, fontSize: layout.settings.fontSize }; },
    dumpLayout() { console.table(layout.boxes.map(b => ({ id: b.id, title: b.title, x: b.x, y: b.y, w: b.width, h: b.height, children: b.children?.length||0 }))); },
    dumpStorage() { api.storage?.sync?.get?.(null).then(d => console.log('[Boxing] storage:', d)).catch(e => console.error('[Boxing] storage read:', e)); },
    triggerGC() { if (typeof gc === 'function') gc(); else console.log('[Boxing] gc not available (not in --js-flags=--expose-gc mode)'); },
  };
  // Log mock usage (must be after DEBUG init)
  if (!api || !api.storage || !api.storage.sync) debug('Using localStorage mock for storage');

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
    dblclickCreateHint: 'Double-click to create',
    bookmarkSave: 'Save', bookmarkDelete: 'Delete',
    bookmarkEditTitle: 'Edit Bookmark',
    backupNow: 'Backup Now', backupNowHint: 'Create a timestamped backup of all layout data',
    autoBackupInterval: 'Auto-Backup Interval', syncProvider: 'Sync Provider',
    squareCorners: 'Square Corners', squareCornersHint: 'Use sharp square corners instead of rounded'
  };
  // Add new v3.6 keys to I18N_FALLBACK
  I18N_FALLBACK.settingsNavGeneral = 'General';
  I18N_FALLBACK.settingsNavAppearance = 'Appearance';
  I18N_FALLBACK.settingsNavData = 'Data';
  I18N_FALLBACK.settingsNavSync = 'Sync & Backup';
  I18N_FALLBACK.lastPositionLabel = 'Last position';
  I18N_FALLBACK.lastZoomLabel = 'Last zoom';
  I18N_FALLBACK.lastPageLabel = 'Last page';
  let currentLang = 'en';
  const SUPPORTED_LANGS = ['en', 'zh_CN', 'ja', 'ko', 'fr', 'de', 'es', 'pt_BR', 'ru', 'ar', 'hi', 'th', 'vi'];

  async function loadI18nStore(lang) {
    try {
      const url = api.runtime?.getURL?.(`_locales/${lang}/messages.json`) || `_locales/${lang}/messages.json`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      i18nStore = {};
      for (const [k, v] of Object.entries(raw)) {
        i18nStore[k] = typeof v === 'object' && v.message ? v.message : v;
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
    let msg = i18nStore[key] || I18N_FALLBACK[key] || key;
    if (placeholders && Array.isArray(placeholders)) {
      for (let i = 0; i < placeholders.length; i++) {
        msg = msg.replace(`$${i + 1}$`, placeholders[i]);
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
  const canvasSurface  = $('#canvas-surface');
  const canvasEmpty    = $('#canvas-empty');
  const canvasZoomOut  = $('#canvas-zoom [data-zoom="out"]');
  const canvasZoomIn   = $('#canvas-zoom [data-zoom="in"]');
  const canvasZoomVal  = $('#canvas-zoom-value');
  const canvasZoomCtrl = $('#canvas-zoom');
  const innerSurface   = $('#inner-surface');
  const innerZoomOut   = $('#inner-zoom [data-zoom="out"]');
  const innerZoomIn    = $('#inner-zoom [data-zoom="in"]');
  const innerZoomVal   = $('#inner-zoom-value');
  const innerZoomCtrl  = $('#inner-zoom');
  const innerWrapper   = $('#inner');
  const innerCanvas    = $('#inner-canvas');
  const innerTitle     = $('#inner-title');
  const crumbsEl       = $('#crumbs');
  const captionEl      = $('#caption');
  const searchInput    = $('#q');
  const backBtn        = $('#back-btn');
  const addLargeBtn    = $('#add-box');
  const addSmallBtn    = $('#add-small');
  const settingsBtn    = $('#settings-btn');
  const settingsModal  = $('#settings-modal');
  const modalClose     = $('#settings-modal .modal__close');
  const langSelect     = $('#lang-select');
  const rememberCheck  = $('#remember-last-pos');
  const urlOpenSelect  = $('#url-open-mode');
  const fontSlider     = $('#font-slider');
  const fontSliderVal  = $('#font-slider-value');
  const zoomSlider     = $('#zoom-slider');
  const zoomSliderVal  = $('#zoom-slider-value');
  const emptyEl        = $('#empty');

  // confirm modal
  const confirmModal   = $('#confirm-modal');
  const confirmTitle   = $('#confirm-title');
  const confirmBody    = $('#confirm-body');
  const confirmCancel  = $('#confirm-cancel-btn');
  const confirmDelete  = $('#confirm-delete-btn');

  // dark mode
  const darkModeBtn    = $('#dark-mode-btn');
  const darkModeCB     = $('#dark-mode-cb');

  // import/export
  const exportBtn      = $('#export-data-btn');
  const importBtn      = $('#import-data-btn');
  const importFile     = $('#import-file-input');

  // ── state ──────────────────────────────────────────────
  let layout = {
    version: 3.5,
    boxes: [],
    nextLargeIndex: 1,
    lastLargeBoxId: null,
    lastZoom: 1.0, lastPanX: 0, lastPanY: 0,
    lastInnerZoom: 1.0, lastInnerPanX: 0, lastInnerPanY: 0,
    settings: {
      selectedLanguage: 'en',
      rememberLastPos: true,
      zoomLevel: 1.0,
      urlOpenMode: 'newTab',
      darkMode: false,
      fontSize: 14
    }
  };
  let currentLargeBoxId = null;
  let canvasZoom = 1.0;
  let innerZoom  = 1.0;
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
  let lastDragEndId = null;  // box id just dragged - clears barDownWasDragZone on next click (BX-DEV-077)

  // header auto-hide state (must be declared before functions that reference it)
  let headerPinned = true;  // default: pinned ON, header visible, button sits on header bar
  let scrollTimeout;

  // ── storage ────────────────────────────────────────────
  async function loadLayout() {
    try {
      const data = await api.storage.sync.get({ boxingLayout: null });
      if (data.boxingLayout) layout = migrateLayout(data.boxingLayout);
      else layout = defaultLayout();
    } catch (e) { debugErr('loadLayout', e); layout = defaultLayout(); }
  }

  async function saveLayout() {
    debug('saveLayout called, boxCount=' + layout.boxes.length + ' nextLargeIndex=' + layout.nextLargeIndex);
    try { await api.storage.sync.set({ boxingLayout: layout }); } catch (e) { debugWarn('saveLayout', e); }
    debug('saveLayout done');
  }

  function defaultLayout() {
    return {
      version: 3.5, boxes: [], nextLargeIndex: 1, lastLargeBoxId: null,
      lastZoom: 1.0, lastPanX: 0, lastPanY: 0,
      lastInnerZoom: 1.0, lastInnerPanX: 0, lastInnerPanY: 0,
      settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14, urlOpenMode: 'newTab' }
    };
  }

  function migrateLayout(raw) {
    if (!raw) return defaultLayout();
    if (raw.version >= 3) return raw;
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
        lastLargeBoxId: raw.lastLargeBoxId || null,
        settings: raw.settings || { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14 }
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
  function getSmallBox(largeId, smallId) {
    const lb = getLargeBox(largeId);
    return lb?.children?.find(s => s.id === smallId) || null;
  }

  function snapCanvas(x, y) { return { x: Math.round(x / CANVAS_GRID) * CANVAS_GRID, y: Math.round(y / CANVAS_GRID) * CANVAS_GRID }; }
  function snapInner(x, y)  { return { x: Math.round(x / INNER_GRID) * INNER_GRID, y: Math.round(y / INNER_GRID) * INNER_GRID }; }

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
    const container = canvasContainer;
    const w = container.clientWidth, h = container.clientHeight;
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
    const w = container.clientWidth, h = container.clientHeight;
    const minPanX = w * (1.0 - zoom / 0.3);
    const minPanY = h * (1.0 - zoom / 0.3);
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
    canvasSurface.style.transform = `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`;
    canvasSurface.style.transformOrigin = '0 0';
    canvasZoomVal.textContent = Math.round(canvasZoom * 100) + '%';
    zoomSlider.value = Math.round(canvasZoom * 100);
    zoomSliderVal.textContent = Math.round(canvasZoom * 100) + '%';
  }

  function applyInnerTransform() {
    innerSurface.style.transform = `translate(${innerPanX}px, ${innerPanY}px) scale(${innerZoom})`;
    innerSurface.style.transformOrigin = '0 0';
    innerZoomVal.textContent = Math.round(innerZoom * 100) + '%';
    zoomSlider.value = Math.round(innerZoom * 100);
    zoomSliderVal.textContent = Math.round(innerZoom * 100) + '%';
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

  // ── render canvas (top-level large boxes) ───────────────
  const headerPinBtn = $('#header-pin-btn');
  const appEl = $('#app');
  // BX-DEV-059: Pin button must always stay on the active canvas (not header bar).
  // headerPinned controls only overflow lock + floating CSS class; button DOM never leaves canvas.
  function updateAutohideUI() {
    // Always reposition button to the currently visible canvas
    const activeCanvas = canvasContainer.hidden ? innerCanvas : canvasContainer;
    if (headerPinBtn && headerPinBtn.parentElement !== activeCanvas) {
      if (headerPinBtn.parentElement) headerPinBtn.parentElement.removeChild(headerPinBtn);
      activeCanvas.appendChild(headerPinBtn);
    }
    // Overflow / autohide class management
    if (!headerPinned) {
      appEl.classList.add('ntp--autohide');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      appEl.classList.remove('ntp--autohide');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    // Visual state toggle
    if (headerPinBtn) {
      const span = headerPinBtn.querySelector('span');
      if (span) span.textContent = headerPinned ? '⊙' : '○';
      headerPinBtn.title = headerPinned ? i18n('headerPin') : i18n('headerPinOff');
      headerPinBtn.classList.toggle('header-pin--floating', !headerPinned);
    }
  }
  if (headerPinBtn) {
    headerPinBtn.addEventListener('click', () => {
      headerPinned = !headerPinned;
      updateAutohideUI();
    });
    headerPinBtn.title = i18n('headerPin');  // default pinned
    // Ensure button starts on active canvas (not header bar) - BX-DEV-078
    updateAutohideUI();  // default: header pinned ON, button on canvas
  }
  function renderCanvas() {
    debug('renderCanvas start, boxCount=' + layout.boxes.length + ' hidden=' + canvasContainer.hidden);
    innerWrapper.hidden = true;
    canvasContainer.hidden = false;
    backBtn.dataset.show = '0';
    updateAutohideUI(); // always reposition pin to active canvas (BX-DEV-078)

    const hasBoxes = layout.boxes.length > 0;
    canvasEmpty.hidden = hasBoxes;

    canvasSurface.innerHTML = '';
    debug('renderCanvas creating DOM for ' + layout.boxes.length + ' boxes');
    for (const box of layout.boxes) {
      debug('renderCanvas creating largeBox DOM for', box.id, box.title);
      try {
      canvasSurface.appendChild(createLargeBoxEl(box));
      } catch(e) { debugErr('createLargeBoxEl failed for', box.id, e); }
    }
    debug('renderCanvas done, surface children=' + canvasSurface.children.length);
    applyCanvasTransform();
    updateCaption();
  }

  function createLargeBoxEl(box) {
    const w = box.width || LARGE_DEF_W;
    const h = box.height || LARGE_DEF_H;

    const el = document.createElement('div');
    el.className = 'large-box';
    el.dataset.id = box.id;
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
    expandBtn.title = box.collapseHover ? 'Hover to expand' : i18n('autoExpand');
    expandBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:13px;padding:0 3px;opacity:0.4;flex-shrink:0;';
    expandBtn.addEventListener('click', e => {
      e.stopPropagation();
      box.collapseHover = !box.collapseHover;
      expandBtn.title = box.collapseHover ? 'Hover to expand' : i18n('autoExpand');
      expandBtn.style.opacity = box.collapseHover ? '0.9' : '0.4';
      expandBtn.textContent = box.collapseHover ? '⊞' : '⊟';
      el.classList.toggle('box--hover-expand', box.collapseHover);
      if (box.collapseHover) {
        el.classList.add('box--collapsed');
      } else {
        el.classList.remove('box--collapsed');
      }
      saveLayout();
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
      // If mousedown was on drag zone and click moved >3px, treat as drag
      if (barDownWasDragZone) {
        const dx = Math.abs(ev.clientX - barDownX);
        const dy = Math.abs(ev.clientY - barDownY);
        barDownWasDragZone = false;
        if (dx > 3 || dy > 3) return;
      }
      // Skip click if drag just ended within 60ms (BX-DEV-065)
      if (Date.now() - lastDragEndTime < 60) { debug('skip click: drag just ended'); return; }
      if (lastDragEndId === box.id) { lastDragEndId = null; barDownWasDragZone = false; }
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

    el.append(bar, body);

    // resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'box-resize-handle';
    resizeHandle.addEventListener('mousedown', e => onResizeStart(e, 'large', box.id, el));
    el.appendChild(resizeHandle);

    return el;
  }

  // ── render inner (small boxes inside a large box) ───────
  function enterLargeBox(id) {
    currentLargeBoxId = id;
    layout.lastLargeBoxId = id;
    // Save current canvas zoom and pan for restore later
    layout.lastZoom = canvasZoom;
    layout.lastPanX = canvasPanX;
    layout.lastPanY = canvasPanY;
    const lb = getLargeBox(id);
    if (!lb) { exitToCanvas(); return; }

    canvasContainer.hidden = true;
    innerWrapper.hidden = false;
    backBtn.dataset.show = '1';
    updateAutohideUI(); // always reposition pin to active canvas (BX-DEV-078)

    renderCrumbs(lb);
    innerTitle.textContent = lb.title || i18n('untitledBox');
    innerTitle.contentEditable = 'true';
    innerTitle.spellcheck = false;
    // Inner title: no drag allowed
    innerTitle.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
    innerTitle.onblur = () => {
      const t = innerTitle.textContent.trim() || i18n('untitledBox');
      if (t !== lb.title) { lb.title = t; saveLayout(); renderCrumbs(lb); }
    };

    renderInnerSurface(lb);
    updateInnerCaption(lb);
    // Restore saved inner zoom and pan from last session
    if (layout.lastInnerZoom) innerZoom = layout.lastInnerZoom;
    if (layout.lastInnerPanX !== undefined) innerPanX = layout.lastInnerPanX;
    if (layout.lastInnerPanY !== undefined) innerPanY = layout.lastInnerPanY;
    applyInnerTransform();
    updateCaption();
  }

  function exitToCanvas() {
    currentLargeBoxId = null;
    // Save current inner zoom and pan for restore later
    layout.lastInnerZoom = innerZoom;
    layout.lastInnerPanX = innerPanX;
    layout.lastInnerPanY = innerPanY;
    innerPanX = 0; innerPanY = 0; innerZoom = 1.0;
    renderCanvas();
  }

  function renderCrumbs(lb) {
    // crumbs now render inline into inner__head area
    const innerHead = $('#inner .inner__head');
    // remove any existing crumbs
    const existing = innerHead?.parentNode?.querySelector('.crumbs--inner');
    existing?.remove();
    
    const crumbsDiv = document.createElement('div');
    crumbsDiv.className = 'crumbs crumbs--inner';
    
    const root = document.createElement('span');
    root.className = 'crumbs__item';
    root.textContent = i18n('canvasRoot');
    root.addEventListener('click', exitToCanvas);
    crumbsDiv.appendChild(root);

    const sep = document.createElement('span');
    sep.className = 'crumbs__sep';
    sep.textContent = '/';
    crumbsDiv.appendChild(sep);

    const cur = document.createElement('span');
    cur.className = 'crumbs__item crumbs__item--current';
    cur.textContent = lb.title || i18n('untitledBox');
    crumbsDiv.appendChild(cur);
    
    // insert before inner__head
    if (innerHead) {
      innerHead.parentNode.insertBefore(crumbsDiv, innerHead);
    }
  }

  function renderInnerSurface(lb) {
    innerSurface.innerHTML = '';
    for (const sb of lb.children || []) {
      innerSurface.appendChild(createSmallBoxEl(lb.id, sb));
    }
  }

  function createSmallBoxEl(largeId, sb) {
    const w = sb.width || SMALL_DEF_W;
    const h = sb.height || SMALL_DEF_H;

    const el = document.createElement('div');
    el.className = 'small-box small-box--list'; // default list mode always
    el.dataset.id = sb.id;
    el.style.left = sb.x + 'px';
    el.style.top = sb.y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    // title bar (drag handle — title excluded)
    const bar = document.createElement('div');
    bar.className = 'small-box__bar';
    bar.addEventListener('mousedown', e => { if (!e.target.closest('.small-box__title') && !e.target.closest('.small-box__delete')) onBoxDragStart(e, 'small', { largeId, smallId: sb.id }, el); });

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
    expandBtn.title = sb.collapseHover ? 'Hover to expand' : i18n('autoExpand');
    expandBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:11px;padding:0 2px;opacity:0.4;flex-shrink:0;';
    expandBtn.addEventListener('click', e => {
      e.stopPropagation();
      sb.collapseHover = !sb.collapseHover;
      expandBtn.title = sb.collapseHover ? 'Hover to expand' : i18n('autoExpand');
      expandBtn.style.opacity = sb.collapseHover ? '0.9' : '0.4';
      expandBtn.textContent = sb.collapseHover ? '⊞' : '⊟';
      el.classList.toggle('box--hover-expand', sb.collapseHover);
      if (sb.collapseHover) {
        el.classList.add('box--collapsed');
      } else {
        el.classList.remove('box--collapsed');
      }
      saveLayout();
    });

    bar.append(title, pinBtn, expandBtn, delBtn);

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
        (function(url) {
        const mode = layout.settings.urlOpenMode || 'newTab';
        if (api.tabs?.create) {
          if (mode === 'currentTab') {
            api.tabs.query({ active: true, currentWindow: true }, tabs => {
              if (tabs && tabs[0]) api.tabs.update(tabs[0].id, { url: url });
              else api.tabs.create({ url: url, active: true });
            });
          } else {
            api.tabs.create({ url: url, active: true });
          }
        } else {
          window.open(url, mode === 'currentTab' ? '_self' : '_blank');
        }
      })(ensureHttpsUrl(bm.url));
      });

      const dot = document.createElement('span');

      // Drag grip (⊛⋮) — leftmost handle for reordering bookmarks (BX-DEV-056)
      const grip = document.createElement('span');
      grip.className = 'bm-row__grip';
      grip.textContent = '⋮⋮';
      grip.title = 'Drag to reorder';
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
      fav.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bm.url)}&sz=16`;
      fav.width = 16; fav.height = 16;
      fav.style.flexShrink = '0';
      fav.onerror = () => { fav.style.display = 'none'; };

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

  // Inline bookmark edit popup
  function showBookmarkEditPopup(bm, index, sb, largeId) {
    // Remove any existing popup
    document.querySelectorAll('.bm-edit-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'bm-edit-popup';
    popup.style.cssText = 'position:fixed;z-index:200;background:var(--color-elevated);border:1px solid var(--color-hairline);border-radius:var(--radius-tile);box-shadow:var(--shadow-pop);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);min-width:260px;';

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
      bm.title = titleInput.value.trim() || bm.url;
      bm.url = ensureHttpsUrl(urlInput.value.trim()) || bm.url;
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
    });
    // Enter key to save (BX-DEV-057)
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = i18n('bookmarkDelete');
    deleteBtn.style.cssText = 'padding:4px 12px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      sb.bookmarks.splice(index, 1);
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = i18n('confirmCancel');
    cancelBtn.style.cssText = 'padding:4px 12px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    cancelBtn.addEventListener('click', e => { e.stopPropagation(); popup.remove(); });

    btnRow.append(saveBtn, deleteBtn, cancelBtn);
    popup.append(titleInput, urlInput, btnRow);

    // Position near the three-dots button
    const rect = popup.getBoundingClientRect || (() => ({ left: 200, top: 200 }));
    popup.style.left = Math.min(window.innerWidth - 280, 200) + 'px';
    popup.style.top = Math.min(window.innerHeight - 200, 300) + 'px';

    document.body.appendChild(popup);

    // Close on outside click
    const closeHandler = (ev) => {
      if (!popup.contains(ev.target)) {
        popup.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 50);
    titleInput.focus();
  }

  // Add bookmark popup (title + URL)
  function showAddBookmarkPopup(sb, largeId) {
    document.querySelectorAll('.bm-edit-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'bm-edit-popup';
    popup.style.cssText = 'position:fixed;z-index:200;background:var(--color-elevated);border:1px solid var(--color-hairline);border-radius:var(--radius-tile);box-shadow:var(--shadow-pop);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);min-width:300px;';

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
      sb.bookmarks = sb.bookmarks || [];
      if (sb.bookmarks.length >= MAX_BOOKMARKS) { debug('max bookmarks'); return; }
      sb.bookmarks.push({ id: 'bm-' + Date.now(), title: title || url.replace(/^https?:\/\//, '').split('/')[0] || url, url });
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
    });

    // Enter key in either input = add bookmark (BX-DEV-057)
    const addBmAction = () => {
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      if (!url) return;
      sb.bookmarks = sb.bookmarks || [];
      if (sb.bookmarks.length >= MAX_BOOKMARKS) { debug('max bookmarks'); return; }
      sb.bookmarks.push({ id: 'bm-' + Date.now(), title: title || url.replace(/^https?:\/\//, '').split('/')[0] || url, url });
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
    };
    // Update addBtn click to delegate:
    // Already handled above; add Enter key listeners:
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBmAction(); } });
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBmAction(); } });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = i18n('confirmCancel');
    cancelBtn.style.cssText = 'padding:5px 14px;background:transparent;border:1px solid var(--color-hairline);border-radius:4px;font-size:12px;cursor:pointer;color:var(--color-muted);';
    cancelBtn.addEventListener('click', e => { e.stopPropagation(); popup.remove(); });

    btnRow.append(addBtn, cancelBtn);
    popup.append(titleInput, urlInput, btnRow);

    popup.style.left = Math.max(40, (window.innerWidth - 320) / 2) + 'px';
    popup.style.top = Math.max(40, (window.innerHeight - 180) / 2) + 'px';

    document.body.appendChild(popup);

    const closeHandler = (ev) => {
      if (!popup.contains(ev.target)) {
        popup.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 50);
    titleInput.focus();
  }


  // ── Manual Drag (real-time, no jump) ─────────────────

  // Bookmark row drag-to-reorder (BX-DEV-056)
  // Drag grip on left of each bm-row; drag swaps positions in array
  function onBmRowDragStart(e, row, sb, largeId) {
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
        const lb = getLargeBox(largeId); if (lb) renderInnerSurface(lb);
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

    dragState = {
      type, id, el,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origLeft: parseInt(el.style.left, 10) || 0,
      origTop: parseInt(el.style.top, 10) || 0,
      zoom, panX, panY,
      container
    };

    el.classList.add(type === 'large' ? 'large-box--dragging' : 'small-box--dragging');
    el.style.zIndex = '10';

    document.addEventListener('mousemove', onBoxDragMove);
    document.addEventListener('mouseup', onBoxDragEnd);
  }

  function onBoxDragMove(e) {
    if (!dragState) return;

    const dx = e.clientX - dragState.startMouseX;
    const dy = e.clientY - dragState.startMouseY;
    // Convert screen delta to world delta
    const worldDx = dx / dragState.zoom;
    const worldDy = dy / dragState.zoom;

    const newX = dragState.origLeft + worldDx;
    const newY = dragState.origTop + worldDy;

    dragState.el.style.left = newX + 'px';
    dragState.el.style.top = newY + 'px';
  }

  function onBoxDragEnd(e) {
    document.removeEventListener('mousemove', onBoxDragMove);
    document.removeEventListener('mouseup', onBoxDragEnd);
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
    } else {
      const sb = getSmallBox(id.largeId, id.smallId);
      if (!sb) { dragState = null; return; }
      const lb = getLargeBox(id.largeId);
      const others = (lb?.children || []).filter(s => s.id !== sb.id);
      const w = sb.width || SMALL_DEF_W, h = sb.height || SMALL_DEF_H;
      const snapped = elasticSnap({ x: finalX, y: finalY }, w, h, others, INNER_GRID, snapInner);
      // clamp to virtual inner canvas boundary
      const worldMaxX2 = (innerCanvas.clientWidth / 0.3) - w;
      const worldMaxY2 = (innerCanvas.clientHeight / 0.3) - h;
      sb.x = Math.max(0, Math.min(snapped.x, worldMaxX2));
      sb.y = Math.max(0, Math.min(snapped.y, worldMaxY2));
      el.style.left = sb.x + 'px';
      el.style.top = sb.y + 'px';
    }

    saveLayout();
    dragState = null;
    lastDragEndTime = Date.now();  // prevent click-from-drag (BX-DEV-065)
    if (type === "large") lastDragEndId = id;  // signal large box to clear barDownWasDragZone on next click (BX-DEV-077)
  }

  // ── Canvas Pan (left-drag empty area) ────────────────
  function onCanvasPanStart(e) {
    // Only pan if clicking empty canvas (not on a box)
    if (e.target.closest('.large-box') || e.target.closest('.small-box') || e.target.closest('.zoom-controls') || e.target.closest('.box-resize-handle')) return;
    if (e.button !== 0) return;

    panState = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origPanX: canvasPanX,
      origPanY: canvasPanY
    };
    canvasContainer.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onCanvasPanMove);
    document.addEventListener('mouseup', onCanvasPanEnd);
    e.preventDefault();
  }

  function onCanvasPanMove(e) {
    if (!panState) return;
    const dx = e.clientX - panState.startMouseX;
    const dy = e.clientY - panState.startMouseY;
    const raw = { x: panState.origPanX + dx, y: panState.origPanY + dy };
    const clamped = clampCanvasPan(raw.x, raw.y, canvasZoom);
    canvasPanX = clamped.x;
    canvasPanY = clamped.y;
    applyCanvasTransform();
  }

  function onCanvasPanEnd(e) {
    document.removeEventListener('mousemove', onCanvasPanMove);
    document.removeEventListener('mouseup', onCanvasPanEnd);
    canvasContainer.style.cursor = '';
    panState = null;
  }

  // Inner canvas pan
  function onInnerPanStart(e) {
    if (e.target.closest('.small-box') || e.target.closest('.zoom-controls') || e.target.closest('.box-resize-handle')) return;
    if (e.button !== 0) return;

    panState = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origPanX: innerPanX,
      origPanY: innerPanY
    };
    innerCanvas.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onInnerPanMove);
    document.addEventListener('mouseup', onInnerPanEnd);
    e.preventDefault();
  }

  function onInnerPanMove(e) {
    if (!panState) return;
    const dx = e.clientX - panState.startMouseX;
    const dy = e.clientY - panState.startMouseY;
    const raw = { x: panState.origPanX + dx, y: panState.origPanY + dy };
    const clamped = clampInnerPan(raw.x, raw.y, innerZoom);
    innerPanX = clamped.x;
    innerPanY = clamped.y;
    applyInnerTransform();
  }

  function onInnerPanEnd(e) {
    document.removeEventListener('mousemove', onInnerPanMove);
    document.removeEventListener('mouseup', onInnerPanEnd);
    innerCanvas.style.cursor = '';
    panState = null;
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
      saveLayout();
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
      resizeState = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── create / delete ────────────────────────────────────
  async function addLargeBoxAt(clientX, clientY) {
    debug('addLargeBoxAt called', {clientX, clientY, boxCount: layout.boxes.length, nextIndex: layout.nextLargeIndex});
    if (layout.boxes.length >= MAX_LARGE_BOXES) { debug('max large boxes'); return; }
    const world = screenToWorld(clientX, clientY, canvasContainer, canvasPanX, canvasPanY, canvasZoom);
    debug('addLargeBoxAt world', world);
    const snapped = snapCanvas(world.x - LARGE_DEF_W / 2, world.y - LARGE_DEF_H / 2);
    debug('addLargeBoxAt snapped', snapped);
    const index = layout.nextLargeIndex++;
    debug('addLargeBoxAt making index', index);
    const newBox = {
      id: 'large-' + Date.now(), type: 'large',
      title: i18n('newLargeBox', [index]),
      x: Math.max(0, snapped.x), y: Math.max(0, snapped.y),
      width: LARGE_DEF_W, height: LARGE_DEF_H,
      nextSmallIndex: 1, children: []
    };
    layout.boxes.push(newBox);
    debug('addLargeBoxAt pushed, count=' + layout.boxes.length);
    await saveLayout();
    debug('addLargeBoxAt saved, calling renderCanvas');
    renderCanvas();
    debug('addLargeBoxAt done, surface children=' + canvasSurface.children.length);
  }

  async function addLargeBox() {
  window._boxingAddLargeBox = addLargeBox;
    debug('addLargeBox (button) called', {boxCount: layout.boxes.length, nextIndex: layout.nextLargeIndex});
    if (layout.boxes.length >= MAX_LARGE_BOXES) { debug('max large boxes'); return; }
    const index = layout.nextLargeIndex++;
    debug('addLargeBox index', index);
    const others = layout.boxes.map(b => ({ x: b.x, y: b.y, width: b.width || LARGE_DEF_W, height: b.height || LARGE_DEF_H }));
    // Start at default offset, then elastic-snap to avoid overlap
    let candidate = { x: 20, y: 20 };
    const snapped = snapCanvas(candidate.x, candidate.y);
    debug('addLargeBox snapped', snapped);
    candidate = elasticSnap(snapped, LARGE_DEF_W, LARGE_DEF_H, others, CANVAS_GRID, snapCanvas);
    debug('addLargeBox after elasticSnap', candidate);
    const newBox = {
      id: 'large-' + Date.now(), type: 'large',
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
    layout.boxes = layout.boxes.filter(b => b.id !== id);
    layout.nextLargeIndex = layout.boxes.reduce((max, b) => Math.max(max, (parseInt((b.title||'').match(/\d+/)||[0])||0)+1), 1);
    if (currentLargeBoxId === id) exitToCanvas();
    saveLayout();
    renderCanvas();
  }

  function addSmallBox() {
    if (!currentLargeBoxId) return;
    const lb = getLargeBox(currentLargeBoxId);
    if (!lb) return;
    if ((lb.children?.length || 0) >= MAX_SMALL_BOXES) { debug('max small boxes'); return; }

    lb.children = lb.children || [];
    const others = lb.children.map(s => ({ x: s.x, y: s.y, width: s.width || SMALL_DEF_W, height: s.height || SMALL_DEF_H }));
    let candidate = { x: 20, y: 20 };
    const snapped = snapInner(candidate.x, candidate.y);
    candidate = elasticSnap(snapped, SMALL_DEF_W, SMALL_DEF_H, others, INNER_GRID, snapInner);
    lb.nextSmallIndex = lb.nextSmallIndex || 1;
    const idx = lb.nextSmallIndex++;
    lb.children.push({
      id: 'small-' + Date.now(), type: 'small',
      title: i18n('newSmallBox'),
      x: Math.max(0, candidate.x), y: Math.max(0, candidate.y),
      width: SMALL_DEF_W, height: SMALL_DEF_H,
      pinned: true, bookmarks: []
    });
    saveLayout();
    renderInnerSurface(lb);
  }

  function addSmallBoxAt(clientX, clientY) {
    if (!currentLargeBoxId) return;
    const lb = getLargeBox(currentLargeBoxId);
    if (!lb || (lb.children?.length || 0) >= MAX_SMALL_BOXES) return;
    const world = screenToWorld(clientX, clientY, innerCanvas, innerPanX, innerPanY, innerZoom);
    const snapped = snapInner(world.x - SMALL_DEF_W / 2, world.y - SMALL_DEF_H / 2);
    const idx = lb.nextSmallIndex++;
    lb.children = lb.children || [];
    lb.children.push({
      id: 'small-' + Date.now(), type: 'small',
      title: i18n('newSmallBox'),
      x: Math.max(0, snapped.x), y: Math.max(0, snapped.y),
      width: SMALL_DEF_W, height: SMALL_DEF_H,
      pinned: true, bookmarks: []
    });
    saveLayout();
    renderInnerSurface(lb);
  }

  function deleteSmallBox(largeId, smallId) {
    openConfirmModal('small', smallId, largeId);
  }

  function _execDeleteSmallBox(largeId, smallId) {
    const lb = getLargeBox(largeId);
    if (!lb) return;
    lb.children = lb.children.filter(s => s.id !== smallId);
    saveLayout();
    renderInnerSurface(lb);
  }

  // ── settings modal ─────────────────────────────────────
  function openSettingsModal() {
    debug('openSettingsModal called, current hidden=' + settingsModal.hidden);
    // Expose for testing
    debug('openSettingsModal called, current hidden=' + settingsModal.hidden);
    settingsModal.hidden = false;
    debug('openSettingsModal set hidden=false, now=' + settingsModal.hidden + ' display=' + getComputedStyle(settingsModal).display);
    langSelect.value = layout.settings.selectedLanguage || 'en';
    rememberCheck.checked = layout.settings.rememberLastPos !== false;
    urlOpenSelect.value = layout.settings.urlOpenMode || 'newTab';
    darkModeCB.checked = layout.settings.darkMode === true;
    zoomSlider.value = Math.round((canvasZoom || 1.0) * 100);
    zoomSliderVal.textContent = Math.round((canvasZoom || 1.0) * 100) + '%';
    fontSlider.value = layout.settings.fontSize || 14;
    fontSliderVal.textContent = (layout.settings.fontSize || 14) + 'px';
    // square corners
    const squareCB = document.getElementById('square-corners-cb');
    if (squareCB) squareCB.checked = layout.settings.squareCorners === true;
    // Show General tab by default
    const firstTab = document.querySelector('.settings-nav__item');
    if (firstTab) firstTab.click();
  }

  function closeSettingsModal() { settingsModal.hidden = true; }
  // Expose for Playwright testing
  window._boxingOpenSettings = openSettingsModal;

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
    debug('onCanvasDblClick', {clientX: e.clientX, clientY: e.clientY, target: e.target.tagName, className: e.target.className});
    const targetBox = e.target.closest('.large-box');
    if (targetBox) {
      debug('onCanvasDblClick on existing box, entering', targetBox.dataset.id);
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
    const targetBox = e.target.closest('.small-box');
    if (targetBox) return;
    addSmallBoxAt(e.clientX, e.clientY);
  }

  // ── window resize → refresh canvas transform ───────────

  // Ensure URL has https:// scheme to prevent moz-extension prefix bug (BX-DEV-048)
  function ensureHttpsUrl(url) {
    if (!url) return 'https://www.google.com';
    const trimmed = url.trim();
    if (/^(https?:|ftp:|moz-extension:|chrome-extension:|edge:)/i.test(trimmed)) {
      return trimmed;
    }
    // Detect intranet / private IP (BX-DEV-055): 10.x, 172.16-31.x, 192.168.x, 127.x, localhost → http
    const isPrivate = /^(10\.\d+\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.\d+\.\d+\.|localhost)/i.test(trimmed);
    return (isPrivate ? 'http://' : 'https://') + trimmed;
  }
  function onWindowResize() {
    applyCanvasTransform();
    applyInnerTransform();
  }

  // ── init ───────────────────────────────────────────────
  async function init() {
    await loadLayout();
    await loadSettings();

    // events
    searchInput.addEventListener('input', e => {
      // simple caption update; full search TBD
      if (e.target.value.trim()) { captionEl.textContent = i18n('searchPlaceholder'); }
      else updateCaption();
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
    document.addEventListener('keydown', onKeyDown);

    // Canvas mouse events
    canvasContainer.addEventListener('mousedown', onCanvasPanStart);
    canvasContainer.addEventListener('click', onCanvasClick);
    canvasContainer.addEventListener('dblclick', onCanvasDblClick);
    canvasContainer.addEventListener('wheel', onCanvasWheel, { passive: false });

    // Inner mouse events
    // Inner canvas: pan (drag empty area) + zoom
    innerSurface.addEventListener('click', onInnerClick);
    innerSurface.addEventListener('dblclick', onInnerDblClick);
    innerCanvas.addEventListener('mousedown', onInnerPanStart);
    innerCanvas.addEventListener('wheel', onInnerWheel, { passive: false });

    // Ensure inner surface also gets wheel events
    innerSurface.addEventListener('wheel', onInnerWheel, { passive: false });

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
    });

    // Settings modal controls
    // ── Settings tab switching ────────────────────
    document.querySelectorAll('.settings-nav__item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-nav__item').forEach(b => b.classList.remove('settings-nav__item--active'));
        btn.classList.add('settings-nav__item--active');
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.settings-tab').forEach(t => t.hidden = true);
        const tab = document.getElementById('tab-' + tabId);
        if (tab) tab.hidden = false;
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
    const backupNowBtn = document.getElementById('backup-now-btn');
    backupNowBtn?.addEventListener('click', () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backup = JSON.stringify(layout, null, 2);
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'boxing-backup-' + timestamp + '.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    });

    // Auto-backup interval
    const autoBackupSelect = document.getElementById('auto-backup-interval');
    autoBackupSelect?.addEventListener('change', () => {
      layout.settings.autoBackupInterval = parseInt(autoBackupSelect.value, 10) || 0;
      saveLayout();
    });
    if (layout.settings.autoBackupInterval) {
      if (autoBackupSelect) autoBackupSelect.value = String(layout.settings.autoBackupInterval);
    }

    // Export / Import
    exportBtn?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'boxing-backup.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    });

    let importPending = false;
    importBtn?.addEventListener('click', () => { importPending = true; importFile?.click(); });
    importFile?.addEventListener('change', async () => {
      if (!importPending) return; importPending = false;
      const file = importFile.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.boxes)) throw new Error('invalid');
        layout = migrateLayout(data);
        await saveLayout();
        if (currentLargeBoxId) exitToCanvas();
        exitToCanvas();  // force exit any drill-in state
        renderCanvas();
        applyCanvasTransform();
        applyInnerTransform();
        updateCaption();
        try { /* silent success — no alert needed */ } catch(_) {}
        debug('Import succeeded, layout replaced');
      } catch (_) { try { alert(i18n('importFailed')); } catch(_) {} }
      importFile.value = '';
    });

    // Confirm modal events
    confirmDelete?.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirmModal();
    });
    confirmCancel?.addEventListener('click', closeConfirmModal);
    confirmModal?.addEventListener('click', e => { if (e.target === confirmModal) closeConfirmModal(); });

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // remember last position
    if (layout.settings.rememberLastPos && layout.lastLargeBoxId) {
      const lb = getLargeBox(layout.lastLargeBoxId);
      // Restore saved canvas zoom and pan
      canvasZoom = layout.lastZoom || 1.0;
      canvasPanX = layout.lastPanX || 0;
      canvasPanY = layout.lastPanY || 0;
      applyCanvasTransform();
      if (lb) { enterLargeBox(layout.lastLargeBoxId); return; }
    }

    renderCanvas();
    debug('init complete v3.5', { boxes: layout.boxes.length, lang: currentLang, zoom: canvasZoom, fontSize: layout.settings.fontSize });
    debug('init complete v3.5', { boxes: layout.boxes.length, lang: currentLang, zoom: canvasZoom, fontSize: layout.settings.fontSize, darkMode: layout.settings.darkMode });
  }

  await init();
})();
