/** Boxing — NTP core v3: infinite canvas, dual-level boxes, drag/resize/magnet, zoom, i18n store, settings modal, debug */
'use strict';

(async () => {
  // ── cross-browser API ──────────────────────────────────
  const api = (typeof browser !== 'undefined' ? browser
    : typeof chrome !== 'undefined' ? chrome : null);
  if (!api) return;

  // ── constants ──────────────────────────────────────────
  const CANVAS_GRID = 24;
  const INNER_GRID  = 16;
  const RESIZE_SNAP = 5;
  const LARGE_DEF_W = 320, LARGE_DEF_H = 220;
  const SMALL_DEF_W  = 280, SMALL_DEF_H = 220;
  const LARGE_MIN_W = 200, LARGE_MIN_H = 120;
  const SMALL_MIN_W  = 140, SMALL_MIN_H = 100;
  const MAX_LARGE_BOXES = 1000;
  const MAX_SMALL_BOXES = 500;
  const MAX_BOOKMARKS = 50;
  const ZOOM_LEVELS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5];
  const DEBUG = true; // ── debug toggle ──

  // ── debug helpers ──────────────────────────────────────
  function debug(...args) { if (DEBUG) console.log('[Boxing]', ...args); }
  function debugErr(...args) { if (DEBUG) console.error('[Boxing]', ...args); }
  function debugWarn(...args) { if (DEBUG) console.warn('[Boxing]', ...args); }

  // ── i18n store ─────────────────────────────────────────
  let i18nStore = {};
  let currentLang = 'en';
  const SUPPORTED_LANGS = ['en', 'zh_CN', 'ja', 'ko', 'fr', 'de', 'es', 'pt_BR', 'ru', 'ar', 'hi', 'th', 'vi'];

  async function loadI18nStore(lang) {
    try {
      const url = `_locales/${lang}/messages.json`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      // flatten Chrome i18n format { key: { message: "..." } } → { key: "..." }
      i18nStore = {};
      for (const [k, v] of Object.entries(raw)) {
        i18nStore[k] = typeof v === 'object' && v.message ? v.message : v;
      }
      currentLang = lang;
      debug(`i18n loaded: ${lang}, ${Object.keys(i18nStore).length} keys`);
      applyI18n();
    } catch (e) {
      debugErr('i18n load failed, falling back to en', e);
      if (lang !== 'en') await loadI18nStore('en');
    }
  }

  function i18n(key, placeholders) {
    let msg = i18nStore[key] || key;
    if (placeholders && Array.isArray(placeholders)) {
      for (let i = 0; i < placeholders.length; i++) {
        msg = msg.replace(`$${i + 1}$`, placeholders[i]);
      }
    }
    return msg;
  }

  // apply i18n to all data-i18n, data-i18n-title, data-i18n-placeholder attrs
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

  const canvasEl       = $('#canvas');
  const canvasSurface  = $('#canvas-surface');
  const canvasEmpty    = $('#canvas-empty');
  const canvasZoomOut  = $('#canvas-zoom [data-zoom="out"]');
  const canvasZoomIn   = $('#canvas-zoom [data-zoom="in"]');
  const canvasZoomVal  = $('#canvas-zoom-value');
  const innerEl        = $('#inner');
  const innerSurface   = $('#inner-surface');
  const innerZoomOut   = $('#inner-zoom [data-zoom="out"]');
  const innerZoomIn    = $('#inner-zoom [data-zoom="in"]');
  const innerZoomVal   = $('#inner-zoom-value');
  const innerTitle     = $('#inner-title');
  const crumbsEl       = $('#crumbs');
  const captionEl      = $('#caption');
  const searchInput    = $('#q');
  const backBtn        = $('#back-btn');
  const viewToggle     = $('#view-toggle');
  const innerViewToggle = $('#inner-view-toggle');
  const addLargeBtn    = $('#add-box');
  const addSmallBtn    = $('#add-small');
  const settingsBtn    = $('#settings-btn');
  const settingsModal  = $('#settings-modal');
  const modalClose     = $('#settings-modal .modal__close');
  const langSelect     = $('#lang-select');
  const rememberCheck  = $('#remember-last-pos');
  const zoomSlider     = $('#zoom-slider');
  const zoomSliderVal  = $('#zoom-slider-value');
  const emptyEl        = $('#empty');

  // ── state ──────────────────────────────────────────────
  let layout = {
    version: 3,
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
  let viewMode = 'list';
  let currentLargeBoxId = null;
  let canvasZoom = 1.0;
  let innerZoom  = 1.0;
  let dragState  = null;   // { type, id, el, startX, startY, origX, origY, ghost }
  let resizeState = null;  // { type, id, el, startX, startY, origW, origH }

  // ── storage ────────────────────────────────────────────
  async function loadLayout() {
    try {
      const data = await api.storage.sync.get({ boxingLayout: null });
      if (data.boxingLayout) {
        layout = migrateLayout(data.boxingLayout);
      } else {
        layout = defaultLayout();
      }
    } catch (e) { debugErr('loadLayout', e); layout = defaultLayout(); }
  }

  async function saveLayout() {
    try {
      await api.storage.sync.set({ boxingLayout: layout });
    } catch (e) { debugWarn('saveLayout', e); }
  }

  function defaultLayout() {
    return {
      version: 3,
      boxes: [],
      nextLargeIndex: 1,
      lastLargeBoxId: null,
      settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14 }
    };
  }

  function migrateLayout(raw) {
    if (!raw || raw.version === 3) return raw;
    // v2 → v3
    if (raw.version === 2) {
      return {
        version: 3,
        boxes: (raw.boxes || []).map(b => ({
          ...b,
          width: b.width || LARGE_DEF_W,
          height: b.height || LARGE_DEF_H,
          nextSmallIndex: (b.children?.length || 0) + 1,
          children: (b.children || []).map(s => ({
            ...s,
            width: s.width || SMALL_DEF_W,
            height: s.height || SMALL_DEF_H,
            pinned: s.pinned !== false,
            bookmarks: s.bookmarks || []
          }))
        })),
        nextLargeIndex: (raw.boxes?.length || 0) + 1,
        lastLargeBoxId: raw.lastLargeBoxId || null,
        settings: raw.settings || { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14 }
      };
    }
    // v1 → v3
    return defaultLayout();
  }

  async function loadSettings() {
    const lang = layout.settings.selectedLanguage || 'en';
    if (!SUPPORTED_LANGS.includes(lang)) { layout.settings.selectedLanguage = 'en'; }
    await loadI18nStore(layout.settings.selectedLanguage);
    canvasZoom = layout.settings.zoomLevel || 1.0;
    innerZoom = layout.settings.zoomLevel || 1.0;
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

  function clampToEdge(x, y, w, h, containerW, containerH) {
    return {
      x: Math.max(0, Math.min(x, Math.max(containerW - w, 0))),
      y: Math.max(0, Math.min(y, Math.max(containerH - h, 0)))
    };
  }

  function resolveCanvasCollision(box, proposed) {
    let { x, y } = proposed;
    const others = layout.boxes.filter(b => b.id !== box.id);
    for (const other of others) {
      if (rectsOverlap({ x, y, w: box.width || LARGE_DEF_W, h: box.height || LARGE_DEF_H },
                       { x: other.x, y: other.y, w: other.width || LARGE_DEF_W, h: other.height || LARGE_DEF_H })) {
        x = other.x + (other.width || LARGE_DEF_W) + CANVAS_GRID;
        const s1 = snapCanvas(x, y);
        const conflict1 = others.some(o => o.id !== box.id &&
          rectsOverlap({ x: s1.x, y: s1.y, w: box.width || LARGE_DEF_W, h: box.height || LARGE_DEF_H },
                       { x: o.x, y: o.y, w: o.width || LARGE_DEF_W, h: o.height || LARGE_DEF_H }));
        if (!conflict1) return snapCanvas(x, y);
        y = other.y + (other.height || LARGE_DEF_H) + CANVAS_GRID;
        x = box.x;
        return snapCanvas(x, y);
      }
    }
    return { x, y };
  }

  function resolveInnerCollision(largeId, box, proposed) {
    let { x, y } = proposed;
    const lb = getLargeBox(largeId);
    if (!lb) return proposed;
    const others = (lb.children || []).filter(s => s.id !== box.id);
    for (const other of others) {
      if (rectsOverlap({ x, y, w: box.width || SMALL_DEF_W, h: box.height || SMALL_DEF_H },
                       { x: other.x, y: other.y, w: other.width || SMALL_DEF_W, h: other.height || SMALL_DEF_H })) {
        x = other.x + (other.width || SMALL_DEF_W) + INNER_GRID;
        const s1 = snapInner(x, y);
        const conflict1 = others.some(o => o.id !== box.id &&
          rectsOverlap({ x: s1.x, y: s1.y, w: box.width || SMALL_DEF_W, h: box.height || SMALL_DEF_H },
                       { x: o.x, y: o.y, w: o.width || SMALL_DEF_W, h: o.height || SMALL_DEF_H }));
        if (!conflict1) return snapInner(x, y);
        y = other.y + (other.height || SMALL_DEF_H) + INNER_GRID;
        x = box.x;
        return snapInner(x, y);
      }
    }
    return { x, y };
  }

  // ── zoom ───────────────────────────────────────────────
  function applyCanvasZoom() {
    canvasSurface.style.transform = `scale(${canvasZoom})`;
    canvasSurface.style.transformOrigin = '0 0';
    canvasZoomVal.textContent = Math.round(canvasZoom * 100) + '%';
    zoomSlider.value = Math.round(canvasZoom * 100);
    zoomSliderVal.textContent = Math.round(canvasZoom * 100) + '%';
  }

  function applyInnerZoom() {
    innerSurface.style.transform = `scale(${innerZoom})`;
    innerSurface.style.transformOrigin = '0 0';
    innerZoomVal.textContent = Math.round(innerZoom * 100) + '%';
    zoomSlider.value = Math.round(innerZoom * 100);
    zoomSliderVal.textContent = Math.round(innerZoom * 100) + '%';
  }

  function zoomStep(current, dir) {
    const idx = ZOOM_LEVELS.indexOf(current);
    if (dir === 'in' && idx < ZOOM_LEVELS.length - 1) return ZOOM_LEVELS[idx + 1];
    if (dir === 'out' && idx > 0) return ZOOM_LEVELS[idx - 1];
    return current;
  }

  // ── render canvas ──────────────────────────────────────
  function renderCanvas() {
    innerEl.hidden = true;
    canvasEl.hidden = false;
    backBtn.dataset.show = '0';

    const hasBoxes = layout.boxes.length > 0;
    canvasEmpty.hidden = hasBoxes;

    canvasSurface.innerHTML = '';
    renderMagnetGuidesLayer();

    for (const box of layout.boxes) {
      canvasSurface.appendChild(createLargeBoxEl(box));
    }

    applyCanvasZoom();
    updateCaption();
  }

  function renderMagnetGuidesLayer() {
    let guides = canvasSurface.querySelector('.canvas__guides');
    if (!guides) {
      guides = document.createElement('div');
      guides.className = 'canvas__guides';
      canvasSurface.appendChild(guides);
    }
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

    // header bar (drag handle only — title excluded from drag)
    const bar = document.createElement('div');
    bar.className = 'large-box__bar';
    bar.draggable = true;

    const icon = document.createElement('span');
    icon.className = 'large-box__icon';
    icon.textContent = '📦';
    icon.setAttribute('aria-hidden', 'true');

    const title = document.createElement('span');
    title.className = 'large-box__title';
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.textContent = box.title || i18n('untitledBox');
    // block drag from title mousedown
    title.addEventListener('mousedown', e => { e.stopPropagation(); });
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      if (e.key === 'Escape') { title.textContent = box.title || i18n('untitledBox'); title.blur(); }
    });
    title.addEventListener('blur', () => {
      const t = title.textContent.trim() || i18n('untitledBox');
      if (t !== box.title) { box.title = t; saveLayout(); }
    });

    const meta = document.createElement('span');
    meta.className = 'large-box__meta';
    meta.textContent = `${box.children?.length || 0} small boxes`;

    const delBtn = document.createElement('button');
    delBtn.className = 'large-box__delete';
    delBtn.setAttribute('aria-label', i18n('deleteBox'));
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteLargeBox(box.id); });

    bar.append(icon, title, meta, delBtn);

    // body
    const body = document.createElement('div');
    body.className = 'large-box__body';

    if (box.children && box.children.length) {
      const chips = document.createElement('div');
      chips.className = 'large-box__chips';
      for (const sb of box.children.slice(0, 8)) {
        const chip = document.createElement('span');
        chip.className = 'large-box__chip';
        chip.textContent = sb.title;
        chips.appendChild(chip);
      }
      if (box.children.length > 8) {
        const more = document.createElement('span');
        more.className = 'large-box__chip';
        more.textContent = `+${box.children.length - 8}`;
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

    // click body → enter large box
    body.addEventListener('click', () => enterLargeBox(box.id));
    // title click → enter (but not during mousedown)
    title.addEventListener('click', e => { e.stopPropagation(); enterLargeBox(box.id); });

    // drag on bar
    bar.addEventListener('dragstart', e => onDragStart(e, 'large', box.id));
    bar.addEventListener('dragend', onDragEnd);
    bar.addEventListener('drag', e => onDrag(e, 'large'));

    // resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'box-resize-handle';
    resizeHandle.addEventListener('mousedown', e => onResizeStart(e, 'large', box.id, el));
    el.appendChild(resizeHandle);

    return el;
  }

  // ── render inner ───────────────────────────────────────
  function enterLargeBox(id) {
    currentLargeBoxId = id;
    layout.lastLargeBoxId = id;
    const lb = getLargeBox(id);
    if (!lb) { exitToCanvas(); return; }

    canvasEl.hidden = true;
    innerEl.hidden = false;
    backBtn.dataset.show = '1';

    renderCrumbs(lb);

    innerTitle.contentEditable = 'true';
    innerTitle.spellcheck = false;
    innerTitle.textContent = lb.title || i18n('untitledLargeBox');
    innerTitle.addEventListener('mousedown', e => { e.stopPropagation(); });
    innerTitle.onblur = () => {
      const t = innerTitle.textContent.trim() || i18n('untitledLargeBox');
      if (t !== lb.title) { lb.title = t; saveLayout(); renderCrumbs(lb); }
    };
    innerTitle.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); innerTitle.blur(); } };

    innerViewToggle.setAttribute('aria-label', viewMode === 'list' ? i18n('switchToGrid') : i18n('switchToList'));
    const iconEl = innerViewToggle.querySelector('span[aria-hidden]');
    if (iconEl) iconEl.textContent = viewMode === 'list' ? '▤' : '☰';

    renderInnerSurface(lb);
    applyInnerZoom();
    updateCaption();
    saveLayout();
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
    sep.textContent = '›';
    crumbsEl.appendChild(sep);

    const current = document.createElement('span');
    current.className = 'crumbs__item crumbs__item--current';
    current.textContent = lb.title || i18n('untitledLargeBox');
    crumbsEl.appendChild(current);
  }

  function exitToCanvas() {
    currentLargeBoxId = null;
    layout.lastLargeBoxId = null;
    saveLayout();
    renderCanvas();
  }

  function renderInnerSurface(lb) {
    innerSurface.innerHTML = '';

    if (!lb.children || !lb.children.length) {
      const empty = document.createElement('div');
      empty.className = 'inner__empty';
      empty.textContent = i18n('emptyInnerHint');
      innerSurface.appendChild(empty);
      return;
    }

    for (const sb of lb.children) {
      innerSurface.appendChild(createSmallBoxEl(lb.id, sb));
    }
  }

  function createSmallBoxEl(largeId, sb) {
    const w = sb.width || SMALL_DEF_W;
    const h = sb.height || SMALL_DEF_H;

    const el = document.createElement('div');
    el.className = `small-box ${viewMode === 'list' ? 'small-box--list' : 'small-box--grid'}`;
    el.dataset.id = sb.id;
    el.style.left = sb.x + 'px';
    el.style.top = sb.y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    // title bar
    const bar = document.createElement('div');
    bar.className = 'small-box__bar';
    bar.draggable = true;

    const title = document.createElement('span');
    title.className = 'small-box__title';
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.textContent = sb.title || i18n('untitledSmallBox');
    title.addEventListener('mousedown', e => { e.stopPropagation(); });
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      if (e.key === 'Escape') { title.textContent = sb.title || i18n('untitledSmallBox'); title.blur(); }
    });
    title.addEventListener('blur', () => {
      const t = title.textContent.trim() || i18n('untitledSmallBox');
      if (t !== sb.title) { sb.title = t; saveLayout(); }
    });

    const modeBtn = document.createElement('button');
    modeBtn.className = 'small-box__mode';
    modeBtn.setAttribute('aria-label', sb.pinned ? i18n('unpin') : i18n('pin'));
    modeBtn.textContent = sb.pinned ? '📌' : '📍';
    modeBtn.addEventListener('click', e => {
      e.stopPropagation();
      sb.pinned = !sb.pinned;
      modeBtn.textContent = sb.pinned ? '📌' : '📍';
      modeBtn.setAttribute('aria-label', sb.pinned ? i18n('unpin') : i18n('pin'));
      saveLayout();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'small-box__delete';
    delBtn.setAttribute('aria-label', i18n('deleteBox'));
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteSmallBox(largeId, sb.id); });

    bar.append(title, modeBtn, delBtn);

    // body
    const body = document.createElement('div');
    body.className = 'small-box__body';

    const bookmarks = sb.bookmarks || [];
    if (bookmarks.length) {
      for (const bm of bookmarks) {
        const row = document.createElement('a');
        row.className = 'bm-row';
        row.href = bm.url;
        row.target = '_blank';
        row.rel = 'noopener';
        row.addEventListener('click', e => {
          e.preventDefault();
          api.tabs?.create?.({ url: bm.url, active: true });
        });
        const dot = document.createElement('span');
        dot.className = 'bm-row__dot';
        row.appendChild(dot);
        const tEl = document.createElement('span');
        tEl.className = 'bm-row__title';
        tEl.textContent = bm.title || 'Untitled';
        row.appendChild(tEl);
        body.appendChild(row);
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'bm-empty';
      empty.textContent = i18n('emptySmallHint');
      body.appendChild(empty);
    }

    // bookmark add input
    const addRow = document.createElement('div');
    addRow.className = 'bm-add-row';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = i18n('addBookmarkPlaceholder');
    addInput.spellcheck = false;
    addRow.appendChild(addInput);
    const addBtn = document.createElement('button');
    addBtn.textContent = i18n('addBookmarkBtn');
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      const url = addInput.value.trim();
      if (!url) return;
      const title = url.replace(/^https?:\/\//, '').split('/')[0] || url;
      sb.bookmarks = sb.bookmarks || [];
      if (sb.bookmarks.length >= MAX_BOOKMARKS) {
        debugWarn('max bookmarks reached');
        return;
      }
      sb.bookmarks.push({ id: 'bm-' + Date.now(), title, url });
      addInput.value = '';
      saveLayout();
      renderInnerSurface(getLargeBox(largeId));
    });
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
    addInput.addEventListener('mousedown', e => { e.stopPropagation(); });
    addRow.appendChild(addBtn);
    body.appendChild(addRow);

    el.append(bar, body);

    // drag on bar only
    bar.addEventListener('dragstart', e => onDragStart(e, 'small', { largeId, smallId: sb.id }));
    bar.addEventListener('dragend', onDragEnd);
    bar.addEventListener('drag', e => onDrag(e, 'small'));

    // resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'box-resize-handle';
    resizeHandle.addEventListener('mousedown', e => onResizeStart(e, 'small', { largeId, smallId: sb.id }, el));
    el.appendChild(resizeHandle);

    return el;
  }

  // ── drag & drop ────────────────────────────────────────
  function onDragStart(e, type, id) {
    const el = e.target.closest(type === 'large' ? '.large-box' : '.small-box');
    if (!el) return;

    dragState = {
      type,
      id,
      el,
      startX: e.clientX,
      startY: e.clientY,
      origX: parseInt(el.style.left, 10) || 0,
      origY: parseInt(el.style.top, 10) || 0,
      ghost: null
    };

    el.classList.add(type === 'large' ? 'large-box--dragging' : 'small-box--dragging');

    // create ghost
    const ghost = el.cloneNode(true);
    ghost.classList.add(type === 'large' ? 'large-box--ghost' : 'small-box--ghost');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    const rect = el.getBoundingClientRect();
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = el.style.width;
    ghost.style.height = el.style.height;
    document.body.appendChild(ghost);
    dragState.ghost = ghost;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }

  function onDrag(e, type) {
    if (!dragState || dragState.type !== type) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const newX = dragState.origX + dx;
    const newY = dragState.origY + dy;

    const snapped = type === 'large' ? snapCanvas(newX, newY) : snapInner(newX, newY);

    if (dragState.ghost) {
      const container = type === 'large' ? canvasSurface : innerSurface;
      const cRect = container.getBoundingClientRect();
      dragState.ghost.style.left = (cRect.left + snapped.x / (type === 'large' ? canvasZoom : innerZoom)) + 'px';
      dragState.ghost.style.top  = (cRect.top + snapped.y / (type === 'large' ? canvasZoom : innerZoom)) + 'px';
    }

    showMagnetGuides(type, snapped);
  }

  function showMagnetGuides(type, pos) {
    const guides = canvasSurface.querySelector('.canvas__guides');
    if (!guides) return;
    guides.dataset.show = '1';
    guides.innerHTML = '';
    const v = document.createElement('div');
    v.className = 'canvas__guide canvas__guide--v';
    v.style.left = pos.x + 'px';
    guides.appendChild(v);
    const h = document.createElement('div');
    h.className = 'canvas__guide canvas__guide--h';
    h.style.top = pos.y + 'px';
    guides.appendChild(h);
  }

  function hideMagnetGuides() {
    const guides = canvasSurface.querySelector('.canvas__guides');
    if (guides) guides.dataset.show = '0';
  }

  function onDragEnd(e) {
    if (!dragState) return;

    const { type, id, el, origX, origY, ghost } = dragState;
    el.classList.remove(type === 'large' ? 'large-box--dragging' : 'small-box--dragging');
    if (ghost) ghost.remove();
    hideMagnetGuides();

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const newX = origX + dx;
    const newY = origY + dy;

    let finalPos;
    if (type === 'large') {
      const snapped = snapCanvas(newX, newY);
      const box = getLargeBox(id);
      if (!box) { dragState = null; return; }
      finalPos = resolveCanvasCollision(box, snapped);
      finalPos = clampToEdge(finalPos.x, finalPos.y, box.width || LARGE_DEF_W, box.height || LARGE_DEF_H, Infinity, Infinity);
      box.x = finalPos.x;
      box.y = finalPos.y;
    } else {
      const snapped = snapInner(newX, newY);
      const sb = getSmallBox(id.largeId, id.smallId);
      if (!sb) { dragState = null; return; }
      finalPos = resolveInnerCollision(id.largeId, sb, snapped);
      finalPos = clampToEdge(finalPos.x, finalPos.y, sb.width || SMALL_DEF_W, sb.height || SMALL_DEF_H, Infinity, Infinity);
      sb.x = finalPos.x;
      sb.y = finalPos.y;
    }

    el.style.left = finalPos.x + 'px';
    el.style.top = finalPos.y + 'px';
    saveLayout();
    dragState = null;
  }

  // ── resize ─────────────────────────────────────────────
  function onResizeStart(e, type, id, el) {
    e.preventDefault();
    e.stopPropagation();
    resizeState = {
      type,
      id,
      el,
      startX: e.clientX,
      startY: e.clientY,
      origW: parseInt(el.style.width, 10) || (type === 'large' ? LARGE_DEF_W : SMALL_DEF_W),
      origH: parseInt(el.style.height, 10) || (type === 'large' ? LARGE_DEF_H : SMALL_DEF_H)
    };
    document.body.classList.add('box-resizing');

    const onMove = (ev) => {
      if (!resizeState) return;
      const dx = ev.clientX - resizeState.startX;
      const dy = ev.clientY - resizeState.startY;
      let nw = resizeState.origW + dx;
      let nh = resizeState.origH + dy;

      // snap to RESIZE_SNAP grid
      nw = Math.round(nw / RESIZE_SNAP) * RESIZE_SNAP;
      nh = Math.round(nh / RESIZE_SNAP) * RESIZE_SNAP;

      const minW = type === 'large' ? LARGE_MIN_W : SMALL_MIN_W;
      const minH = type === 'large' ? LARGE_MIN_H : SMALL_MIN_H;
      nw = Math.max(minW, nw);
      nh = Math.max(minH, nh);

      el.style.width = nw + 'px';
      el.style.height = nh + 'px';
    };

    const onUp = (ev) => {
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
    if (layout.boxes.length >= MAX_LARGE_BOXES) {
      debugWarn('max large boxes reached');
      return;
    }

    const surfaceRect = canvasSurface.getBoundingClientRect();
    let x = (clientX - surfaceRect.left) / canvasZoom - LARGE_DEF_W / 2;
    let y = (clientY - surfaceRect.top) / canvasZoom - LARGE_DEF_H / 2;
    const snapped = snapCanvas(x, y);
    const clamped = clampToEdge(snapped.x, snapped.y, LARGE_DEF_W, LARGE_DEF_H, Infinity, Infinity);

    const index = layout.nextLargeIndex || (layout.boxes.length + 1);
    layout.nextLargeIndex = index + 1;

    const newBox = {
      id: 'large-' + Date.now(),
      type: 'large',
      title: i18n('newLargeBox', [index]),
      x: clamped.x,
      y: clamped.y,
      width: LARGE_DEF_W,
      height: LARGE_DEF_H,
      nextSmallIndex: 1,
      children: []
    };
    layout.boxes.push(newBox);
    await saveLayout();
    renderCanvas();
  }

  async function addLargeBox() {
    // find free spot
    let x = 20, y = 20;
    const others = layout.boxes;
    for (let i = 0; i < others.length; i++) {
      x += (others[i].width || LARGE_DEF_W) + CANVAS_GRID;
      if (x > 1200) { x = 20; y += (others[i].height || LARGE_DEF_H) + CANVAS_GRID; }
    }
    const snapped = snapCanvas(x, y);

    const index = layout.nextLargeIndex || (layout.boxes.length + 1);
    layout.nextLargeIndex = index + 1;

    const newBox = {
      id: 'large-' + Date.now(),
      type: 'large',
      title: i18n('newLargeBox', [index]),
      x: snapped.x,
      y: snapped.y,
      width: LARGE_DEF_W,
      height: LARGE_DEF_H,
      nextSmallIndex: 1,
      children: []
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
    if ((lb.children?.length || 0) >= MAX_SMALL_BOXES) { debugWarn('max small boxes'); return; }

    let x = 20, y = 20;
    for (let i = 0; i < (lb.children?.length || 0); i++) {
      x += (lb.children[i].width || SMALL_DEF_W) + INNER_GRID;
      if (x > 800) { x = 20; y += (lb.children[i].height || SMALL_DEF_H) + INNER_GRID; }
    }
    const snapped = snapInner(x, y);

    const idx = lb.nextSmallIndex || ((lb.children?.length || 0) + 1);
    lb.nextSmallIndex = idx + 1;

    const newSb = {
      id: 'small-' + Date.now(),
      type: 'small',
      title: i18n('newSmallBox'),
      x: snapped.x,
      y: snapped.y,
      width: SMALL_DEF_W,
      height: SMALL_DEF_H,
      pinned: true,
      displayMode: viewMode,
      bookmarks: []
    };
    lb.children = lb.children || [];
    lb.children.push(newSb);
    saveLayout();
    renderInnerSurface(lb);
  }

  function addSmallBoxAt(clientX, clientY) {
    if (!currentLargeBoxId) return;
    const lb = getLargeBox(currentLargeBoxId);
    if (!lb) return;
    if ((lb.children?.length || 0) >= MAX_SMALL_BOXES) { debugWarn('max small boxes'); return; }

    const surfaceRect = innerSurface.getBoundingClientRect();
    let x = (clientX - surfaceRect.left) / innerZoom - SMALL_DEF_W / 2;
    let y = (clientY - surfaceRect.top) / innerZoom - SMALL_DEF_H / 2;
    const snapped = snapInner(x, y);

    const idx = lb.nextSmallIndex || ((lb.children?.length || 0) + 1);
    lb.nextSmallIndex = idx + 1;

    const newSb = {
      id: 'small-' + Date.now(),
      type: 'small',
      title: i18n('newSmallBox'),
      x: snapped.x,
      y: snapped.y,
      width: SMALL_DEF_W,
      height: SMALL_DEF_H,
      pinned: true,
      displayMode: viewMode,
      bookmarks: []
    };
    lb.children = lb.children || [];
    lb.children.push(newSb);
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

  // ── view mode toggle ───────────────────────────────────
  function toggleViewMode() {
    viewMode = viewMode === 'list' ? 'grid' : 'list';
    const labelEl = viewToggle.querySelector('.view-toggle__label');
    const iconEl = viewToggle.querySelector('.view-toggle__icon');
    if (labelEl) labelEl.textContent = viewMode === 'list' ? i18n('viewList') : i18n('viewGrid');
    if (iconEl) iconEl.textContent = viewMode === 'list' ? '▤' : '☰';
    viewToggle.setAttribute('aria-label', viewMode === 'list' ? i18n('switchToGrid') : i18n('switchToList'));

    if (currentLargeBoxId) {
      const lb = getLargeBox(currentLargeBoxId);
      if (lb) renderInnerSurface(lb);
    }
  }

  function toggleInnerViewMode() { toggleViewMode(); }

  // ── settings modal ─────────────────────────────────────
  function openSettingsModal() {
    settingsModal.hidden = false;
    langSelect.value = layout.settings.selectedLanguage || 'en';
    rememberCheck.checked = layout.settings.rememberLastPos !== false;
    zoomSlider.value = Math.round((canvasZoom || 1.0) * 100);
    zoomSliderVal.textContent = Math.round((canvasZoom || 1.0) * 100) + '%';
  }

  function closeSettingsModal() {
    settingsModal.hidden = true;
  }

  // ── search ─────────────────────────────────────────────
  function updateCaption() {
    if (currentLargeBoxId) {
      const lb = getLargeBox(currentLargeBoxId);
      captionEl.textContent = i18n('smallBoxesCount', [lb?.children?.length || 0]);
    } else {
      captionEl.textContent = i18n('largeBoxesCount', [layout.boxes.length]);
    }
  }

  function handleSearch(query) {
    // future: full text search across bookmarks; currently uses native browser mechanism
    if (query.trim()) {
      updateCaption(); // placeholder
    } else {
      updateCaption();
    }
  }

  // ── context menu ───────────────────────────────────────
  function onContextMenu(e) {
    if (currentLargeBoxId) {
      e.preventDefault();
      exitToCanvas();
    }
  }

  // ── keyboard ───────────────────────────────────────────
  function onKeyDown(e) {
    // / → focus search
    if (e.key === '/' && e.target === document.body && !currentLargeBoxId) {
      e.preventDefault();
      searchInput.focus();
    }
    // Escape
    if (e.key === 'Escape') {
      if (!settingsModal.hidden) { closeSettingsModal(); return; }
      if (searchInput.value) { searchInput.value = ''; handleSearch(''); }
      else if (currentLargeBoxId) { exitToCanvas(); }
    }
  }

  // ── dblclick create ────────────────────────────────────
  function onCanvasDblClick(e) {
    const targetBox = e.target.closest('.large-box');
    if (targetBox) {
      enterLargeBox(targetBox.dataset.id);
      return;
    }
    addLargeBoxAt(e.clientX, e.clientY);
  }

  function onInnerDblClick(e) {
    const targetBox = e.target.closest('.small-box');
    if (targetBox) return; // do nothing on existing small box
    addSmallBoxAt(e.clientX, e.clientY);
  }

  // ── init ───────────────────────────────────────────────
  async function init() {
    await loadLayout();
    await loadSettings();

    // events
    searchInput.addEventListener('input', e => handleSearch(e.target.value));
    backBtn.addEventListener('click', exitToCanvas);
    viewToggle.addEventListener('click', toggleViewMode);
    if (innerViewToggle) innerViewToggle.addEventListener('click', toggleInnerViewMode);
    addLargeBtn.addEventListener('click', addLargeBox);
    if (addSmallBtn) addSmallBtn.addEventListener('click', addSmallBox);
    settingsBtn.addEventListener('click', openSettingsModal);
    if (modalClose) modalClose.addEventListener('click', closeSettingsModal);
    // close modal on backdrop click
    settingsModal.addEventListener('click', e => {
      if (e.target === settingsModal) closeSettingsModal();
    });
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);

    // dblclick
    canvasEl.addEventListener('dblclick', onCanvasDblClick);
    innerSurface.addEventListener('dblclick', onInnerDblClick);

    // zoom controls
    canvasZoomOut?.addEventListener('click', () => {
      canvasZoom = zoomStep(canvasZoom, 'out');
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasZoom();
      saveLayout();
    });
    canvasZoomIn?.addEventListener('click', () => {
      canvasZoom = zoomStep(canvasZoom, 'in');
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasZoom();
      saveLayout();
    });
    innerZoomOut?.addEventListener('click', () => {
      innerZoom = zoomStep(innerZoom, 'out');
      applyInnerZoom();
    });
    innerZoomIn?.addEventListener('click', () => {
      innerZoom = zoomStep(innerZoom, 'in');
      applyInnerZoom();
    });

    // settings modal controls
    langSelect?.addEventListener('change', async () => {
      const lang = langSelect.value;
      layout.settings.selectedLanguage = lang;
      await loadI18nStore(lang);
      await saveLayout();
      // re-render current view with new i18n
      if (currentLargeBoxId) {
        const lb = getLargeBox(currentLargeBoxId);
        if (lb) { renderInnerSurface(lb); renderCrumbs(lb); }
        updateCaption();
      } else {
        renderCanvas();
      }
      applyI18n();
      applyCanvasZoom();
      applyInnerZoom();
    });
    rememberCheck?.addEventListener('change', () => {
      layout.settings.rememberLastPos = rememberCheck.checked;
      saveLayout();
    });
    zoomSlider?.addEventListener('input', () => {
      const v = parseInt(zoomSlider.value, 10);
      zoomSliderVal.textContent = v + '%';
    });
    zoomSlider?.addEventListener('change', () => {
      const v = parseInt(zoomSlider.value, 10) / 100;
      canvasZoom = v;
      innerZoom = v;
      layout.settings.zoomLevel = v;
      applyCanvasZoom();
      applyInnerZoom();
      saveLayout();
    });

    // remember last position
    if (layout.settings.rememberLastPos && layout.lastLargeBoxId) {
      const lb = getLargeBox(layout.lastLargeBoxId);
      if (lb) {
        enterLargeBox(layout.lastLargeBoxId);
        return;
      }
    }

    renderCanvas();
    debug('init complete', { boxes: layout.boxes.length, lang: currentLang, zoom: canvasZoom });
  }

  await init();

})();
