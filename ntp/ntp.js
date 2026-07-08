/** Boxing — NTP core: infinite canvas, dual-level boxes, drag, magnet, storage, i18n */

(async () => {
  // Cross-browser API
  const api = (typeof browser !== "undefined" ? browser :
    typeof chrome !== "undefined" ? chrome : null);
  if (!api) return;

  // i18n helper
  function i18n(key) {
    try { return api.i18n?.getMessage(key) || key; } catch { return key; }
  }

  // DOM refs
  const canvasEl = document.getElementById('canvas');
  const canvasSurface = document.getElementById('canvas-surface');
  const canvasEmpty = document.getElementById('canvas-empty');
  const innerEl = document.getElementById('inner');
  const innerSurface = document.getElementById('inner-surface');
  const innerTitle = document.getElementById('inner-title');
  const crumbsEl = document.getElementById('crumbs');
  const captionEl = document.getElementById('caption');
  const pinBarEl = document.getElementById('pin-bar');
  const searchInput = document.getElementById('q');
  const backBtn = document.getElementById('back-btn');
  const viewToggle = document.getElementById('view-toggle');
  const innerViewToggle = document.getElementById('inner-view-toggle');
  const addLargeBtn = document.getElementById('add-box');
  const addSmallBtn = document.getElementById('add-small');
  const settingsBtn = document.getElementById('settings-btn');
  const emptyEl = document.getElementById('empty');

  // State
  let layout = { version: 2, boxes: [] };       // persisted layout
  let bookmarksTree = [];                         // native bookmarks
  let viewMode = 'list';                          // 'list' | 'grid'  (for small boxes)
  let currentLargeBoxId = null;                   // null = canvas view
  let dragState = null;                           // { type, id, el, startX, startY, origX, origY, ghost }

  // Grid constants
  const CANVAS_GRID = 24;
  const INNER_GRID = 16;
  const LARGE_W = 320, LARGE_H = 220;
  const SMALL_W = 200, SMALL_H = 140;

  // ==================== STORAGE ====================
  async function loadLayout() {
    try {
      const data = await api.storage.sync.get({ boxingLayout: null });
      if (data.boxingLayout && data.boxingLayout.version === 2) {
        layout = data.boxingLayout;
      }
    } catch (e) { console.warn('loadLayout', e); }
  }

  async function saveLayout() {
    try {
      await api.storage.sync.set({ boxingLayout: layout });
    } catch (e) { console.warn('saveLayout', e); }
  }

  // ==================== BOOKMARKS ====================
  async function loadBookmarks() {
    try {
      bookmarksTree = await api.bookmarks.getTree();
      renderPinBar();
    } catch (e) { console.error('bookmarks', e); }
  }

  function flattenBookmarks(nodes, out = []) {
    for (const n of nodes || []) {
      if (n.url) out.push(n);
      if (n.children) flattenBookmarks(n.children, out);
    }
    return out;
  }

  // ==================== RENDER HELPERS ====================
  function getLargeBox(id) { return layout.boxes.find(b => b.id === id); }
  function getSmallBox(largeId, smallId) {
    const lb = getLargeBox(largeId);
    return lb?.children?.find(s => s.id === smallId);
  }

  function snapCanvas(x, y) {
    return { x: Math.round(x / CANVAS_GRID) * CANVAS_GRID, y: Math.round(y / CANVAS_GRID) * CANVAS_GRID };
  }

  function snapInner(x, y) {
    return { x: Math.round(x / INNER_GRID) * INNER_GRID, y: Math.round(y / INNER_GRID) * INNER_GRID };
  }

  // Collision detection: return new position that doesn't overlap
  function resolveCanvasCollision(box, proposed) {
    let { x, y } = proposed;
    const others = layout.boxes.filter(b => b.id !== box.id);
    for (const other of others) {
      if (rectsOverlap({x, y, w: LARGE_W, h: LARGE_H}, {x: other.x, y: other.y, w: LARGE_W, h: LARGE_H})) {
        // Push right, then down
        x = other.x + LARGE_W + CANVAS_GRID;
        const snapped = snapCanvas(x, y);
        if (!others.some(o => o.id !== box.id && rectsOverlap({x: snapped.x, y: snapped.y, w: LARGE_W, h: LARGE_H}, {x: o.x, y: o.y, w: LARGE_W, h: LARGE_H}))) {
          return snapped;
        }
        // Try down
        y = other.y + LARGE_H + CANVAS_GRID;
        x = box.x;
        const snapped2 = snapCanvas(x, y);
        if (!others.some(o => o.id !== box.id && rectsOverlap({x: snapped2.x, y: snapped2.y, w: LARGE_W, h: LARGE_H}, {x: o.x, y: o.y, w: LARGE_W, h: LARGE_H}))) {
          return snapped2;
        }
      }
    }
    return { x, y };
  }

  function resolveInnerCollision(largeId, box, proposed) {
    let { x, y } = proposed;
    const lb = getLargeBox(largeId);
    const others = lb.children.filter(s => s.id !== box.id);
    for (const other of others) {
      if (rectsOverlap({x, y, w: SMALL_W, h: SMALL_H}, {x: other.x, y: other.y, w: SMALL_W, h: SMALL_H})) {
        x = other.x + SMALL_W + INNER_GRID;
        const snapped = snapInner(x, y);
        if (!others.some(o => o.id !== box.id && rectsOverlap({x: snapped.x, y: snapped.y, w: SMALL_W, h: SMALL_H}, {x: o.x, y: o.y, w: SMALL_W, h: SMALL_H}))) {
          return snapped;
        }
        y = other.y + SMALL_H + INNER_GRID;
        x = box.x;
        const snapped2 = snapInner(x, y);
        if (!others.some(o => o.id !== box.id && rectsOverlap({x: snapped2.x, y: snapped2.y, w: SMALL_W, h: SMALL_H}, {x: o.x, y: o.y, w: SMALL_W, h: SMALL_H}))) {
          return snapped2;
        }
      }
    }
    return { x, y };
  }

  function rectsOverlap(a, b) {
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }

  // ==================== RENDER CANVAS (TOP LEVEL) ====================
  function renderCanvas() {
    innerEl.hidden = true;
    canvasEl.hidden = false;
    backBtn.dataset.show = '0';

    const hasBoxes = layout.boxes.length > 0;
    canvasEmpty.hidden = hasBoxes;

    // Clear surface
    canvasSurface.innerHTML = '';

    // Magnet guide layer
    let guides = canvasSurface.querySelector('.canvas__guides');
    if (!guides) {
      guides = document.createElement('div');
      guides.className = 'canvas__guides';
      canvasSurface.appendChild(guides);
    }

    // Render each large box
    for (const box of layout.boxes) {
      const el = createLargeBoxEl(box);
      canvasSurface.appendChild(el);
    }

    updateCaption();
  }

  function createLargeBoxEl(box) {
    const el = document.createElement('div');
    el.className = 'large-box';
    el.dataset.id = box.id;
    el.style.left = box.x + 'px';
    el.style.top = box.y + 'px';

    // Header bar (drag handle)
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
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      if (e.key === 'Escape') { title.textContent = box.title || i18n('untitledBox'); title.blur(); }
    });
    title.addEventListener('blur', () => {
      const newTitle = title.textContent.trim() || i18n('untitledBox');
      if (newTitle !== box.title) {
        box.title = newTitle;
        saveLayout();
      }
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

    // Body
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

    // Click on body/title (not bar drag) -> enter inner
    const enterHandler = () => enterLargeBox(box.id);
    body.addEventListener('click', enterHandler);
    title.addEventListener('click', e => { e.stopPropagation(); enterHandler(); });

    // Drag events on bar
    bar.addEventListener('dragstart', e => onDragStart(e, 'large', box.id));
    bar.addEventListener('dragend', onDragEnd);
    bar.addEventListener('drag', e => onDrag(e, 'large'));

    return el;
  }

  // ==================== RENDER INNER (SMALL BOXES) ====================
  function enterLargeBox(id) {
    currentLargeBoxId = id;
    const lb = getLargeBox(id);
    if (!lb) return;

    canvasEl.hidden = true;
    innerEl.hidden = false;
    backBtn.dataset.show = '1';

    // Breadcrumb
    renderCrumbs(lb);

    // Title
    innerTitle.contentEditable = 'true';
    innerTitle.spellcheck = false;
    innerTitle.textContent = lb.title || i18n('untitledLargeBox');
    innerTitle.onblur = () => {
      const t = innerTitle.textContent.trim() || i18n('untitledLargeBox');
      if (t !== lb.title) { lb.title = t; saveLayout(); renderCrumbs(lb); }
    };
    innerTitle.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); innerTitle.blur(); } };

    // View toggle
    innerViewToggle.setAttribute('aria-label', viewMode === 'list' ? i18n('switchToGrid') : i18n('switchToList'));
    innerViewToggle.querySelector('span[aria-hidden]').textContent = viewMode === 'list' ? '▤' : '☰';

    // Render small boxes
    renderInnerSurface(lb);
  }

  function renderCrumbs(lb) {
    crumbsEl.innerHTML = '';
    const root = document.createElement('span');
    root.className = 'crumbs__item';
    root.textContent = i18n('canvasRoot');
    root.addEventListener('click', () => exitToCanvas());
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
    renderCanvas();
  }

  function renderInnerSurface(lb) {
    innerSurface.innerHTML = '';

    if (!lb.children || !lb.children.length) {
      const empty = document.createElement('div');
      empty.className = 'bm-empty';
      empty.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-size:13px;color:var(--color-muted);';
      empty.textContent = i18n('emptyInnerHint');
      innerSurface.appendChild(empty);
      return;
    }

    for (const sb of lb.children) {
      const el = createSmallBoxEl(lb.id, sb);
      innerSurface.appendChild(el);
    }
  }

  function createSmallBoxEl(largeId, sb) {
    const el = document.createElement('div');
    el.className = `small-box ${viewMode === 'list' ? 'small-box--list' : 'small-box--grid'}`;
    el.dataset.id = sb.id;
    el.style.left = sb.x + 'px';
    el.style.top = sb.y + 'px';

    // Title bar (drag handle only)
    const bar = document.createElement('div');
    bar.className = 'small-box__bar';
    bar.draggable = true;

    const title = document.createElement('span');
    title.className = 'small-box__title';
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.textContent = sb.title || i18n('untitledSmallBox');
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

    // Body
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
        row.addEventListener('click', e => { e.preventDefault(); api.tabs?.create?.({ url: bm.url, active: true }); });

        const dot = document.createElement('span');
        dot.className = 'bm-row__dot';
        // favicon placeholder
        row.appendChild(dot);

        const t = document.createElement('span');
        t.className = 'bm-row__title';
        t.textContent = bm.title || 'Untitled';
        row.appendChild(t);

        body.appendChild(row);
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'bm-empty';
      empty.textContent = i18n('emptySmallHint');
      body.appendChild(empty);
    }

    el.append(bar, body);

    // Drag on bar only
    bar.addEventListener('dragstart', e => onDragStart(e, 'small', { largeId, smallId: sb.id }));
    bar.addEventListener('dragend', onDragEnd);
    bar.addEventListener('drag', e => onDrag(e, 'small'));

    return el;
  }

  // ==================== DRAG & DROP ====================
  function onDragStart(e, type, id) {
    const el = e.target.closest(type === 'large' ? '.large-box' : '.small-box');
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const containerRect = (type === 'large' ? canvasSurface : innerSurface).getBoundingClientRect();

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

    el.classList.add(`${type === 'large' ? 'large-box' : 'small-box'}--dragging`);

    // Create ghost for visual feedback
    const ghost = el.cloneNode(true);
    ghost.classList.add(`${type === 'large' ? 'large-box' : 'small-box'}--ghost`);
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
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

    // Snap while dragging
    let snapped;
    if (type === 'large') {
      snapped = snapCanvas(newX, newY);
    } else {
      snapped = snapInner(newX, newY);
    }

    // Update ghost position
    if (dragState.ghost) {
      const container = type === 'large' ? canvasSurface : innerSurface;
      const cRect = container.getBoundingClientRect();
      dragState.ghost.style.left = (cRect.left + snapped.x) + 'px';
      dragState.ghost.style.top = (cRect.top + snapped.y) + 'px';
    }

    // Show magnet guides
    showMagnetGuides(type, snapped);
  }

  function showMagnetGuides(type, pos) {
    const guides = canvasSurface.querySelector('.canvas__guides');
    if (!guides) return;
    guides.dataset.show = '1';
    guides.innerHTML = '';

    const container = type === 'large' ? canvasSurface : innerSurface;
    const grid = type === 'large' ? CANVAS_GRID : INNER_GRID;

    // Vertical guide
    const v = document.createElement('div');
    v.className = 'canvas__guide canvas__guide--v';
    v.style.left = pos.x + 'px';
    guides.appendChild(v);

    // Horizontal guide
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
    el.classList.remove(`${type === 'large' ? 'large-box' : 'small-box'}--dragging`);
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
      finalPos = resolveCanvasCollision(box, snapped);
      if (box) { box.x = finalPos.x; box.y = finalPos.y; }
      el.style.left = finalPos.x + 'px';
      el.style.top = finalPos.y + 'px';
    } else {
      const snapped = snapInner(newX, newY);
      const sb = getSmallBox(id.largeId, id.smallId);
      finalPos = resolveInnerCollision(id.largeId, sb, snapped);
      if (sb) { sb.x = finalPos.x; sb.y = finalPos.y; }
      el.style.left = finalPos.x + 'px';
      el.style.top = finalPos.y + 'px';
    }

    saveLayout();
    dragState = null;
  }

  // ==================== CREATE / DELETE ====================
  async function addLargeBox() {
    // Find a free spot near origin
    let x = 20, y = 20;
    const others = layout.boxes;
    for (let i = 0; i < others.length; i++) {
      x += LARGE_W + CANVAS_GRID;
      if (x > 1200) { x = 20; y += LARGE_H + CANVAS_GRID; }
    }
    const snapped = snapCanvas(x, y);

    const newBox = {
      id: 'large-' + Date.now(),
      type: 'large',
      title: i18n('newLargeBox'),
      x: snapped.x,
      y: snapped.y,
      width: LARGE_W,
      height: LARGE_H,
      children: []
    };
    layout.boxes.push(newBox);
    await saveLayout();
    renderCanvas();
  }

  function deleteLargeBox(id) {
    if (!confirm(i18n('confirmDeleteLarge'))) return;
    layout.boxes = layout.boxes.filter(b => b.id !== id);
    saveLayout();
    renderCanvas();
  }

  function addSmallBox() {
    if (!currentLargeBoxId) return;
    const lb = getLargeBox(currentLargeBoxId);
    if (!lb) return;

    let x = 20, y = 20;
    for (let i = 0; i < (lb.children?.length || 0); i++) {
      x += SMALL_W + INNER_GRID;
      if (x > 800) { x = 20; y += SMALL_H + INNER_GRID; }
    }
    const snapped = snapInner(x, y);

    const newSb = {
      id: 'small-' + Date.now(),
      type: 'small',
      title: i18n('newSmallBox'),
      x: snapped.x,
      y: snapped.y,
      width: SMALL_W,
      height: SMALL_H,
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

  // ==================== VIEW MODE TOGGLE ====================
  function toggleViewMode() {
    viewMode = viewMode === 'list' ? 'grid' : 'list';
    viewToggle.querySelector('.view-toggle__label').textContent = viewMode === 'list' ? i18n('viewList') : i18n('viewGrid');
    viewToggle.querySelector('.view-toggle__icon').textContent = viewMode === 'list' ? '▤' : '☰';
    viewToggle.setAttribute('aria-label', viewMode === 'list' ? i18n('switchToGrid') : i18n('switchToList'));
    saveLayout();

    // Re-render current view
    if (currentLargeBoxId) {
      const lb = getLargeBox(currentLargeBoxId);
      if (lb) renderInnerSurface(lb);
    }
  }

  function toggleInnerViewMode() { toggleViewMode(); }

  // ==================== PIN BAR ====================
  function renderPinBar() {
    pinBarEl.innerHTML = '';
    const rootFolders = bookmarksTree[0]?.children || [];
    for (const folder of rootFolders) {
      if (folder.children && folder.children.length) {
        const li = document.createElement('li');
        li.className = 'pin-item';
        li.innerHTML = `<span class="pin-item__icon" aria-hidden="true">📁</span><span class="pin-item__label">${folder.title}</span>`;
        li.addEventListener('click', () => {
          // Navigate to this folder in the canvas
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
        });
        pinBarEl.appendChild(li);
      }
    }
  }

  // ==================== SEARCH ====================
  function handleSearch(query) {
    if (query.trim()) {
      const flat = flattenBookmarks(bookmarksTree);
      const results = flat.filter(b => b.title.toLowerCase().includes(query.toLowerCase()));
      // For now, just show in grid (could make a dedicated search view)
      captionEl.textContent = i18n('searchResults', [results.length]);
    } else {
      updateCaption();
    }
  }

  function updateCaption() {
    if (currentLargeBoxId) {
      const lb = getLargeBox(currentLargeBoxId);
      captionEl.textContent = i18n('smallBoxesCount', [lb?.children?.length || 0]);
    } else {
      captionEl.textContent = i18n('largeBoxesCount', [layout.boxes.length]);
    }
  }

  // ==================== CONTEXT MENU (RIGHT CLICK = BACK) ====================
  function onContextMenu(e) {
    if (currentLargeBoxId) {
      e.preventDefault();
      exitToCanvas();
    }
  }

  // ==================== KEYBOARD ====================
  function onKeyDown(e) {
    // "/" to focus search
    if (e.key === '/' && e.target === document.body) {
      e.preventDefault();
      searchInput.focus();
    }
    // Escape to clear search or go back
    if (e.key === 'Escape') {
      if (searchInput.value) {
        searchInput.value = '';
        handleSearch('');
      } else if (currentLargeBoxId) {
        exitToCanvas();
      }
    }
  }

  // ==================== SETTINGS BUTTON ====================
  function openSettings() {
    const url = api.runtime?.getURL?.('options/options.html');
    if (url) api.tabs?.create?.({ url, active: true });
  }

  // ==================== INIT ====================
  async function init() {
    await loadLayout();
    await loadBookmarks();
    applyI18n();

    // Events
    searchInput.addEventListener('input', e => handleSearch(e.target.value));
    backBtn.addEventListener('click', exitToCanvas);
    viewToggle.addEventListener('click', toggleViewMode);
    innerViewToggle.addEventListener('click', toggleInnerViewMode);
    addLargeBtn.addEventListener('click', addLargeBox);
    addSmallBtn.addEventListener('click', addSmallBox);
    settingsBtn.addEventListener('click', openSettings);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);

    // Initial render
    renderCanvas();
  }

  // Apply i18n to data-i18n attributes
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const msg = i18n(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = msg;
      } else {
        el.textContent = msg;
      }
    });
  }

  // Start
  await init();
})();