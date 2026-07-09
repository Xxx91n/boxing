/** Boxing — NTP core v3.1: Obsidian-style infinite canvas, manual drag (real-time), title-only edit zone, elastic snap, bookmark CRUD, i18n store, settings modal, debug */
'use strict';

(async () => {
  // ── cross-browser API ──────────────────────────────────
  let api = (typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : null);
  if (!api) {
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
  const SMALL_DEF_W  = 320, SMALL_DEF_H = 340;
  const LARGE_MIN_W = 200, LARGE_MIN_H = 120;
  const SMALL_MIN_W  = 180, SMALL_MIN_H = 200;
  const MAX_LARGE_BOXES = 1000;
  const MAX_SMALL_BOXES = 500;
  const MAX_BOOKMARKS = 50;
  const ZOOM_STEPS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5];
  const MIN_ZOOM = 0.3, MAX_ZOOM = 2.0;
  const DEBUG = true;

  // ── debug ──────────────────────────────────────────────
  function debug(...args) { if (DEBUG) console.log('[Boxing]', ...args); }
  function debugErr(...args) { if (DEBUG) console.error('[Boxing]', ...args); }
  function debugWarn(...args) { if (DEBUG) console.warn('[Boxing]', ...args); }

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
    clickToOpen: 'Click to open →', footerHint: 'Right-click to return · / to search · Dblclick canvas to add',
    canvasRoot: 'Canvas', untitledBox: 'Untitled box',
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
    smallBoxCountLabel: '$1$ small boxes'
  };
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
  const innerContainer = $('#inner');
  const innerSurface   = $('#inner-surface');
  const innerZoomOut   = $('#inner-zoom [data-zoom="out"]');
  const innerZoomIn    = $('#inner-zoom [data-zoom="in"]');
  const innerZoomVal   = $('#inner-zoom-value');
  const innerZoomCtrl  = $('#inner-zoom');
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
  const fontSlider     = $('#font-slider');
  const fontSliderVal  = $('#font-slider-value');
  const zoomSlider     = $('#zoom-slider');
  const zoomSliderVal  = $('#zoom-slider-value');
  const emptyEl        = $('#empty');

  // ── state ──────────────────────────────────────────────
  let layout = {
    version: 3.1,
    boxes: [],
    nextLargeIndex: 1,
    lastLargeBoxId: null,
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

  // ── storage ────────────────────────────────────────────
  async function loadLayout() {
    try {
      const data = await api.storage.sync.get({ boxingLayout: null });
      if (data.boxingLayout) layout = migrateLayout(data.boxingLayout);
      else layout = defaultLayout();
    } catch (e) { debugErr('loadLayout', e); layout = defaultLayout(); }
  }

  async function saveLayout() {
    try { await api.storage.sync.set({ boxingLayout: layout }); } catch (e) { debugWarn('saveLayout', e); }
  }

  function defaultLayout() {
    return {
      version: 3.1, boxes: [], nextLargeIndex: 1, lastLargeBoxId: null,
      settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14 }
    };
  }

  function migrateLayout(raw) {
    if (!raw) return defaultLayout();
    if (raw.version >= 3) return raw;
    if (raw.version === 2) {
      return {
        version: 3.1,
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
    const lang = layout.settings.selectedLanguage || 'en';
    if (!SUPPORTED_LANGS.includes(lang)) layout.settings.selectedLanguage = 'en';
    await loadI18nStore(layout.settings.selectedLanguage);
    canvasZoom = layout.settings.zoomLevel || 1.0;
    innerZoom = layout.settings.zoomLevel || 1.0;
    const fs = layout.settings.fontSize || 14;
    document.documentElement.style.setProperty('--font-size-base', fs + 'px');
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

  // Elastic snap: find nearest edge alignment with other boxes
  function elasticSnap(pos, w, h, others, grid, snapFn) {
    let { x, y } = pos;
    for (const other of others) {
      const ow = other.width || LARGE_DEF_W, oh = other.height || LARGE_DEF_H;
      // Check overlap
      if (!rectsOverlap({ x, y, w, h }, { x: other.x, y: other.y, w: ow, h: oh })) continue;

      // Try 4 sides: right, left, below, above
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
      if (best) return snapFn(best.x, best.y);
    }
    // No overlap — just snap to grid
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
  function renderCanvas() {
    innerContainer.hidden = true;
    canvasContainer.hidden = false;
    backBtn.dataset.show = '0';

    const hasBoxes = layout.boxes.length > 0;
    canvasEmpty.hidden = hasBoxes;

    canvasSurface.innerHTML = '';
    for (const box of layout.boxes) {
      canvasSurface.appendChild(createLargeBoxEl(box));
    }
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

    bar.append(icon, title, meta, delBtn);

    // body — click to enter
    const body = document.createElement('div');
    body.className = 'large-box__body';
    body.addEventListener('click', () => enterLargeBox(box.id));
    body.addEventListener('mousedown', e => {
      // allow mousedown on body but NOT on title area (already blocked)
      if (e.target.closest('.large-box__title')) return;
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
    const lb = getLargeBox(id);
    if (!lb) { exitToCanvas(); return; }

    canvasContainer.hidden = true;
    innerContainer.hidden = false;
    backBtn.dataset.show = '1';

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
    applyInnerTransform();
    updateCaption();
  }

  function exitToCanvas() {
    currentLargeBoxId = null;
    innerPanX = 0; innerPanY = 0; innerZoom = 1.0;
    renderCanvas();
  }

  function renderCrumbs(lb) {
    crumbsEl.innerHTML = '';
    const root = document.createElement('span');
    root.className = 'crumbs__item';
    root.textContent = i18n('canvasRoot');
    root.addEventListener('click', exitToCanvas);
    crumbsEl.appendChild(root);

    const sep = document.createElement('span');
    sep.className = 'crumbs__sep';
    sep.textContent = '/';
    crumbsEl.appendChild(sep);

    const cur = document.createElement('span');
    cur.className = 'crumbs__item crumbs__item--current';
    cur.textContent = lb.title || i18n('untitledBox');
    crumbsEl.appendChild(cur);
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

    bar.append(title, delBtn);

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
        if (e.target.closest('.bm-row__edit-btn')) return;
        api.tabs?.create?.({ url: bm.url, active: true });
      });

      const dot = document.createElement('span');
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

      row.append(dot, fav, tEl, editBtn);
      body.appendChild(row);
    }

    // add bookmark row
    const addRow = document.createElement('div');
    addRow.className = 'bm-add-row';
    addRow.addEventListener('mousedown', e => e.stopPropagation());

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = i18n('addBookmarkPlaceholder');
    addInput.spellcheck = false;

    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      const url = addInput.value.trim();
      if (!url) return;
      let title = url.replace(/^https?:\/\//, '').split('/')[0] || url;
      if (url.startsWith('http')) {
        try { const u = new URL(url); title = u.hostname + (u.pathname !== '/' ? u.pathname.substring(0, 20) : ''); } catch (_) {}
      }
      sb.bookmarks = sb.bookmarks || [];
      if (sb.bookmarks.length >= MAX_BOOKMARKS) { debug('max bookmarks'); return; }
      sb.bookmarks.push({ id: 'bm-' + Date.now(), title, url });
      addInput.value = '';
      saveLayout();
      renderBookmarks(body, largeId, sb);
    });
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
    addInput.addEventListener('mousedown', e => e.stopPropagation());

    addRow.append(addInput, addBtn);
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
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'padding:4px 12px;background:var(--color-accent);color:#F7F3ED;border:0;border-radius:4px;font-size:12px;cursor:pointer;';
    saveBtn.addEventListener('click', e => {
      e.stopPropagation();
      bm.title = titleInput.value.trim() || bm.url;
      bm.url = urlInput.value.trim() || bm.url;
      saveLayout();
      const lb = getLargeBox(largeId);
      if (lb) renderInnerSurface(lb);
      popup.remove();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
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
    cancelBtn.textContent = 'Cancel';
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

  // ── Manual Drag (real-time, no jump) ─────────────────
  function onBoxDragStart(e, type, id, el) {
    if (e.button !== 0) return; // left button only
    e.preventDefault();
    e.stopPropagation();

    const rect = el.getBoundingClientRect();
    const container = type === 'large' ? canvasContainer : innerContainer;
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
      // clamp to container (canvas is infinite, no clamping needed — but clamp to avoid negative)
      const clamped = clampToEdge(snapped.x, snapped.y, w, h, Infinity, Infinity);
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
      sb.x = snapped.x; sb.y = snapped.y;
      el.style.left = sb.x + 'px';
      el.style.top = sb.y + 'px';
    }

    saveLayout();
    dragState = null;
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
    canvasPanX = panState.origPanX + dx;
    canvasPanY = panState.origPanY + dy;
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
    innerContainer.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onInnerPanMove);
    document.addEventListener('mouseup', onInnerPanEnd);
    e.preventDefault();
  }

  function onInnerPanMove(e) {
    if (!panState) return;
    const dx = e.clientX - panState.startMouseX;
    const dy = e.clientY - panState.startMouseY;
    innerPanX = panState.origPanX + dx;
    innerPanY = panState.origPanY + dy;
    applyInnerTransform();
  }

  function onInnerPanEnd(e) {
    document.removeEventListener('mousemove', onInnerPanMove);
    document.removeEventListener('mouseup', onInnerPanEnd);
    innerContainer.style.cursor = '';
    panState = null;
  }

  // ── Ctrl+scroll zoom ────────────────────────────────────
  function onCanvasWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const result = zoomAtPoint(canvasContainer, canvasZoom, canvasPanX, canvasPanY, e.clientX, e.clientY, factor);
      canvasZoom = result.zoom;
      canvasPanX = result.panX;
      canvasPanY = result.panY;
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasTransform();
      saveLayout();
    }
  }

  function onInnerWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const result = zoomAtPoint(innerContainer, innerZoom, innerPanX, innerPanY, e.clientX, e.clientY, factor);
      innerZoom = result.zoom;
      innerPanX = result.panX;
      innerPanY = result.panY;
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
    if (layout.boxes.length >= MAX_LARGE_BOXES) { debug('max large boxes'); return; }
    const world = screenToWorld(clientX, clientY, canvasContainer, canvasPanX, canvasPanY, canvasZoom);
    const snapped = snapCanvas(world.x - LARGE_DEF_W / 2, world.y - LARGE_DEF_H / 2);
    const index = layout.nextLargeIndex++;
    const newBox = {
      id: 'large-' + Date.now(), type: 'large',
      title: i18n('newLargeBox', [index]),
      x: Math.max(0, snapped.x), y: Math.max(0, snapped.y),
      width: LARGE_DEF_W, height: LARGE_DEF_H,
      nextSmallIndex: 1, children: []
    };
    layout.boxes.push(newBox);
    await saveLayout();
    renderCanvas();
  }

  async function addLargeBox() {
    if (layout.boxes.length >= MAX_LARGE_BOXES) { debug('max large boxes'); return; }
    let x = 20, y = 20;
    for (const box of layout.boxes) {
      x += (box.width || LARGE_DEF_W) + CANVAS_GRID;
      if (x > 1200) { x = 20; y += (box.height || LARGE_DEF_H) + CANVAS_GRID; }
    }
    const snapped = snapCanvas(x, y);
    const index = layout.nextLargeIndex++;
    const newBox = {
      id: 'large-' + Date.now(), type: 'large',
      title: i18n('newLargeBox', [index]),
      x: snapped.x, y: snapped.y, width: LARGE_DEF_W, height: LARGE_DEF_H,
      nextSmallIndex: 1, children: []
    };
    layout.boxes.push(newBox);
    await saveLayout();
    renderCanvas();
  }

  function deleteLargeBox(id) {
    if (!confirm(i18n('confirmDeleteLarge'))) return;
    layout.boxes = layout.boxes.filter(b => b.id !== id);
    if (currentLargeBoxId === id) exitToCanvas();
    saveLayout();
    renderCanvas();
  }

  function addSmallBox() {
    if (!currentLargeBoxId) return;
    const lb = getLargeBox(currentLargeBoxId);
    if (!lb) return;
    if ((lb.children?.length || 0) >= MAX_SMALL_BOXES) { debug('max small boxes'); return; }

    let x = 20, y = 20;
    for (const sb of lb.children || []) {
      x += (sb.width || SMALL_DEF_W) + INNER_GRID;
      if (x > 800) { x = 20; y += (sb.height || SMALL_DEF_H) + INNER_GRID; }
    }
    const snapped = snapInner(x, y);
    const idx = lb.nextSmallIndex++;
    lb.children = lb.children || [];
    lb.children.push({
      id: 'small-' + Date.now(), type: 'small',
      title: i18n('newSmallBox'),
      x: snapped.x, y: snapped.y,
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
    const world = screenToWorld(clientX, clientY, innerContainer, innerPanX, innerPanY, innerZoom);
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
    if (!confirm(i18n('confirmDeleteSmall'))) return;
    const lb = getLargeBox(largeId);
    if (!lb) return;
    lb.children = lb.children.filter(s => s.id !== smallId);
    saveLayout();
    renderInnerSurface(lb);
  }

  // ── settings modal ─────────────────────────────────────
  function openSettingsModal() {
    settingsModal.hidden = false;
    langSelect.value = layout.settings.selectedLanguage || 'en';
    rememberCheck.checked = layout.settings.rememberLastPos !== false;
    zoomSlider.value = Math.round((canvasZoom || 1.0) * 100);
    zoomSliderVal.textContent = Math.round((canvasZoom || 1.0) * 100) + '%';
    fontSlider.value = layout.settings.fontSize || 14;
    fontSliderVal.textContent = (layout.settings.fontSize || 14) + 'px';
  }

  function closeSettingsModal() { settingsModal.hidden = true; }

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
        applyInnerTransform();
      } else {
        canvasZoom = zoomStep(canvasZoom, 'in');
        layout.settings.zoomLevel = canvasZoom;
        applyCanvasTransform();
        saveLayout();
      }
    }
    if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      if (currentLargeBoxId) {
        innerZoom = zoomStep(innerZoom, 'out');
        applyInnerTransform();
      } else {
        canvasZoom = zoomStep(canvasZoom, 'out');
        layout.settings.zoomLevel = canvasZoom;
        applyCanvasTransform();
        saveLayout();
      }
    }
  }

  // ── dblclick create (also single-click two-quick for new boxes) ─
  function onCanvasClick(e) {
    const now = Date.now();
    const target = e.target.closest('.large-box');
    if (target) {
      // Enter large box on single click
      enterLargeBox(target.dataset.id);
      lastClickTime = 0;
      return;
    }
    // Check for double-click (two quick clicks on canvas empty)
    if (now - lastClickTime < 400 && lastClickTarget === 'canvas') {
      addLargeBoxAt(e.clientX, e.clientY);
      lastClickTime = 0;
      lastClickTarget = null;
      return;
    }
    lastClickTime = now;
    lastClickTarget = 'canvas';
  }

  function onCanvasDblClick(e) {
    const targetBox = e.target.closest('.large-box');
    if (targetBox) {
      enterLargeBox(targetBox.dataset.id);
      return;
    }
    addLargeBoxAt(e.clientX, e.clientY);
  }

  function onInnerClick(e) {
    const now = Date.now();
    const target = e.target.closest('.small-box');
    if (target) { lastClickTime = 0; return; }
    if (now - lastClickTime < 400 && lastClickTarget === 'inner') {
      addSmallBoxAt(e.clientX, e.clientY);
      lastClickTime = 0;
      lastClickTarget = null;
      return;
    }
    lastClickTime = now;
    lastClickTarget = 'inner';
  }

  function onInnerDblClick(e) {
    const targetBox = e.target.closest('.small-box');
    if (targetBox) return;
    addSmallBoxAt(e.clientX, e.clientY);
  }

  // ── window resize → refresh canvas transform ───────────
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
    if (addLargeBtn) addLargeBtn.addEventListener('click', addLargeBox);
    if (addSmallBtn) addSmallBtn.addEventListener('click', addSmallBox);
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
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
    innerContainer.addEventListener('mousedown', onInnerPanStart);
    innerSurface.addEventListener('click', onInnerClick);
    innerSurface.addEventListener('dblclick', onInnerDblClick);
    innerContainer.addEventListener('wheel', onInnerWheel, { passive: false });

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

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // remember last position
    if (layout.settings.rememberLastPos && layout.lastLargeBoxId) {
      const lb = getLargeBox(layout.lastLargeBoxId);
      if (lb) { enterLargeBox(layout.lastLargeBoxId); return; }
    }

    renderCanvas();
    debug('init complete v3.1', { boxes: layout.boxes.length, lang: currentLang, zoom: canvasZoom, fontSize: layout.settings.fontSize });
  }

  await init();
})();
