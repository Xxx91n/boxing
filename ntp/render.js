/** Boxing — NTP render module (ticket 08, architecture-recovery).
 * Render cohesive core extracted verbatim from ntp.js (zero-build strangler-fig):
 * conn SVG layer with viewport culling + LOD stroke (ADR-0004) + line pool + grid hash (ADR-0013),
 * rAF/debounce discipline (BX-EXPLORE-007/008), DSU groups, pan/zoom transforms, manual drag,
 * canvas render pipeline, box CRUD, bookmark rows/popups.
 * Diffs vs origin: 'export ' prefixes + this header/imports/initRenderFacade + 6 carved eval-time
 * statements (debug markers, ensureGroups warm-up) that stayed in ntp.js IIFE — nothing else.
 * Cross-scope deps injected once via initRenderFacade() before any runtime call. */
import {
  MAX_LARGE_BOXES, MAX_SMALL_BOXES, MAX_BOOKMARKS, MAX_CONNECTIONS, LINE_POOL_CAP,
  __connRefreshRAF, __dsuDirty, __linePool, __popupTrackers, __sizeObserver, __viewStatePersistTimers,
  boxById, smallBoxById, connLines, connById, dirtyConns, connIdx, boxConnIdx, boxGroupId,
  canvasConnSvg, innerConnSvg, clearedTombstones, connectMode, provisionalGhost, provisionalLine, selectedConnId,
  currentLargeBoxId, canvasZoom, innerZoom, canvasPanX, canvasPanY, innerPanX, innerPanY, headerPinned,
  dragState, resizeState, panState, lastDragEndId, lastDragEndTime, groupMembers, groupStar,
  layout, setCanvasConnSvg, setInnerConnSvg, setCanvasZoom, setInnerZoom, setCanvasPanX, setCanvasPanY,
  setInnerPanX, setInnerPanY, setConnectMode, setProvisionalLine, setSelectedConnId, setCurrentLargeBoxId,
  setDragState, setResizeState, setPanState, setProvisionalGhost, setLastDragEndId, setLastDragEndTime, setLastEnterLargeBoxAt,
  setDsuDirty, setSizeObserver, setConnRefreshRAF, setSuppressInnerDblClickOnce,
} from './state.js';
import { CANVAS_GRID, INNER_GRID, LARGE_DEF_H, LARGE_DEF_W, LARGE_MIN_H, LARGE_MIN_W, MAX_ZOOM, MIN_ZOOM, RESIZE_SNAP, SMALL_DEF_H, SMALL_DEF_W, SMALL_MIN_H, SMALL_MIN_W, ZOOM_STEPS, buildSpatialGrid, elasticSnap, largeKey, normalizeBookmarkUrl, screenToWorld, smallKey, snapCanvas, snapInner, zoomAtPoint } from './utils.js';
import { i18n } from './i18n.js';
import { markDeleted, saveLayout, saveLayoutDebounced } from './storage.js';
import { loadFavicon } from './favicon.js';
import { persistViewState, saveLargeBoxViewState, scheduleLargeBoxViewStatePersist } from './persist.js';

// Injected ntp.js-scope deps (set once at boot, before any runtime call).
let addLargeBtn, api, appEl, backBtn, canvasContainer, canvasEmpty, canvasSurface, canvasZoomCtrl, canvasZoomVal,
    debug, debugErr, debugSampled, debugWarn, enterAndLocateSmallBox, headerBar, headerPinBtn, innerCanvas,
    innerCrumbTitle, innerSurface, innerWrapper, innerZoomCtrl, innerZoomVal, makeId, openConfirmModal,
    rebuildBoxMaps, updateCaption, zoomSlider, zoomSliderVal;
export function initRenderFacade(deps) {
  addLargeBtn = deps.addLargeBtn; api = deps.api; appEl = deps.appEl; backBtn = deps.backBtn;
  canvasContainer = deps.canvasContainer; canvasEmpty = deps.canvasEmpty; canvasSurface = deps.canvasSurface;
  canvasZoomCtrl = deps.canvasZoomCtrl; canvasZoomVal = deps.canvasZoomVal;
  debug = deps.debug; debugErr = deps.debugErr; debugSampled = deps.debugSampled; debugWarn = deps.debugWarn;
  enterAndLocateSmallBox = deps.enterAndLocateSmallBox; headerBar = deps.headerBar; headerPinBtn = deps.headerPinBtn;
  innerCanvas = deps.innerCanvas; innerCrumbTitle = deps.innerCrumbTitle; innerSurface = deps.innerSurface;
  innerWrapper = deps.innerWrapper; innerZoomCtrl = deps.innerZoomCtrl; innerZoomVal = deps.innerZoomVal;
  makeId = deps.makeId; openConfirmModal = deps.openConfirmModal; rebuildBoxMaps = deps.rebuildBoxMaps;
  updateCaption = deps.updateCaption; zoomSlider = deps.zoomSlider; zoomSliderVal = deps.zoomSliderVal;
}

  export const canvasContainerSize = { w: 0, h: 0 };
  export const innerSurfaceSize = { w: 0, h: 0 };
  export function refreshContainerSizes() {
    canvasContainerSize.w = canvasContainer.clientWidth || 0;
    canvasContainerSize.h = canvasContainer.clientHeight || 0;
    innerSurfaceSize.w = innerSurface.clientWidth || 0;
    innerSurfaceSize.h = innerSurface.clientHeight || 0;
  }
  export function initSizeObserver() {
    refreshContainerSizes();
    if (__sizeObserver || typeof ResizeObserver === 'undefined') return;
    setSizeObserver(new ResizeObserver(() => { try { refreshContainerSizes(); } catch (e) { /* silent: RO callback, layout recalc on next tick */ } }));
    try { __sizeObserver.observe(canvasContainer); __sizeObserver.observe(innerSurface); } catch (e) { /* silent: RO observe, container may be detached */ }
  }
  // ── helpers ────────────────────────────────────────────
  export function getLargeBox(id) { return boxById.get(id) || null; }

  // ── Box Connections / Groups (BX-DEV-137) ────────────────────────────
  // leader-line draws mid-edge SVG between two DOM elements; we vendored
  // vendor/leader-line.min.js (MIT, zero-deps) into ntp/index.html. The lib's
  // `socket: 'auto'` picks the nearest edge midpoint; active-connect mode lets
  // the user click box A then box B; a star-mark makes a box the parent of a
  // group so dragging the parent averages the members and snaps them together.
  // BX-142: SVG-based connection layer — replaces LeaderLine.
  // SVG overlay lives INSIDE the transform surface, so line coords = box logical coords.
  // No BCR reads, no transform-commit timing issues, lines clipped by surface overflow.
  export function acquireLineEl() {
    const el = __linePool.pop();
    if (el) return el;
    return document.createElementNS('http://www.w3.org/2000/svg', 'line');
  }
  export function recycleLineEl(el) {
    if (!el || __linePool.length >= LINE_POOL_CAP) return;
    // Strip attributes so reused element starts clean
    el.removeAttribute('data-conn-id');
    el.classList.remove('conn-line--selected');
    el.style.display = '';
    __linePool.push(el);
  }

  export function ensureConnArrays() {
    if (!Array.isArray(layout.connections)) layout.connections = [];
  }
  export function pruneConnArrays(onSave) {
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

  export function findConn(from, to) {
    if (connIdx.size > 0) return connIdx.get(from + '>' + to) || null;
    // ponytail: fallback linear scan — connIdx not yet built (before first renderConnections)
    return layout.connections.find(c =>
      (c.from === from && c.to === to) || (c.from === to && c.to === from)) || null;
  }

  // ── ADR-0007 Phase 1.2: unified commit(op) (tldraw Store put/remove pattern) ──
  // Handlers mutate data only. commit() owns tombstones, DSU dirty, viewState clear,
  // optional save/render. Public wrappers keep call-site behavior stable.
  export function getBoxByTieredKey(key) {
    if (!key || typeof key !== "string") return null;
    if (key.startsWith("large:")) return getLargeBox(key.slice(6));
    if (key.startsWith("small:")) {
      const sp = key.split(":");
      if (sp.length < 3) return null;
      return getSmallBox(sp[1], sp.slice(2).join(":"));
    }
    return getLargeBox(key);
  }

  export const mutationHandlers = {
    addConn(state, { from, to }) {
      const id = "conn-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
      state.connections.push({ id, from, to, createdAt: Date.now(), props: {} });
      return { connId: id, affectedBoxKeys: [from, to], connChanged: true };
    },
    removeConn(state, { connId }) {
      const conn = state.connections.find(c => c.id === connId) || connById.get(connId);
      state.connections = state.connections.filter(c => c.id !== connId);
      connById.delete(connId);
      return {
        tombstoneIds: connId ? [connId] : [],
        affectedBoxKeys: conn ? [conn.from, conn.to] : [],
        connChanged: true
      };
    },
    toggleStar(state, { parentId }) {
      const box = getBoxByTieredKey(parentId);
      if (!box) return { skipped: true };
      if (box.isParent || groupStar.has(parentId)) {
        box.isParent = false;
        groupStar.delete(parentId);
        return { tombstoneIds: [parentId], starChanged: true, unstarred: true };
      }
      box.isParent = true;
      groupStar.add(parentId);
      return { clearedTombstoneKeys: [parentId], starChanged: true, starred: true };
    },
    deleteLargeBox(state, { id }) {
      const removed = getLargeBox(id);
      if (!removed) return { skipped: true };
      // ADR-0007 Q4d: clear viewState while object still reachable
      try { delete removed.viewState; } catch (e) { debugErr("delete removed.viewState", e); }
      const tomb = [id, largeKey(id)];
      for (const child of (removed.children || [])) {
        tomb.push(child.id, smallKey(id, child.id));
        for (const bm of (child.bookmarks || [])) if (bm && bm.id) tomb.push(bm.id);
      }
      const largeK = largeKey(id);
      const smallPrefix = "small:" + id + ":";
      const matchesDeletedKey = k =>
        k === id || k === largeK || (typeof k === "string" && k.startsWith(smallPrefix));
      for (const rc of state.connections) {
        if (rc && (matchesDeletedKey(rc.from) || matchesDeletedKey(rc.to))) tomb.push(rc.id);
      }
      state.connections = state.connections.filter(c => !matchesDeletedKey(c.from) && !matchesDeletedKey(c.to));
      state.boxes = state.boxes.filter(b => b.id !== id);
      boxById.delete(id);
      for (const sb of (removed.children || [])) smallBoxById.delete(id + ":" + sb.id);
      state.nextLargeIndex = state.boxes.reduce((max, b) => Math.max(max, (parseInt((b.title || "").match(/\d+/) || [0]) || 0) + 1), 1);
      return {
        tombstoneIds: tomb,
        viewStateClear: [id],
        connChanged: true,
        deletedLargeId: id
      };
    },
    deleteSmallBox(state, { largeId, smallId }) {
      const lb = getLargeBox(largeId);
      if (!lb) return { skipped: true };
      const removed = (lb.children || []).find(s => s.id === smallId);
      const sk = smallKey(largeId, smallId);
      const tomb = [smallId, sk];
      for (const bm of (removed?.bookmarks || [])) if (bm && bm.id) tomb.push(bm.id);
      for (const rc of state.connections) {
        if (rc && (rc.from === sk || rc.to === sk)) tomb.push(rc.id);
      }
      state.connections = state.connections.filter(c => c.from !== sk && c.to !== sk);
      lb.children = (lb.children || []).filter(s => s.id !== smallId);
      smallBoxById.delete(largeId + ":" + smallId);
      return {
        tombstoneIds: tomb,
        // small boxes do not own large-box viewState; no viewStateClear
        connChanged: true,
        deletedSmall: { largeId, smallId },
        parentLargeId: largeId
      };
    },
    applyExternal(state, { incoming, incomingWins }) {
      // merge already applied by caller onto layout; handler only signals rebuild
      return { isExternal: true, connChanged: true, forceMaps: true };
    }
  };

  export function commit(op, payload, opts) {
    opts = opts || {};
    const handler = mutationHandlers[op];
    if (!handler) throw new Error("Unknown mutation: " + op);
    const result = handler(layout, payload || {}) || {};
    if (result.skipped) return result;

    if (result.tombstoneIds && result.tombstoneIds.length) {
      markDeleted(...result.tombstoneIds);
    }
    if (result.clearedTombstoneKeys) {
      for (const k of result.clearedTombstoneKeys) {
        if (layout._meta && layout._meta.deleted && layout._meta.deleted[k]) delete layout._meta.deleted[k];
        clearedTombstones.add(k);
      }
    }

    // ADR-0007 Q4d: clear per-box viewState on delete
    if (result.viewStateClear) {
      for (const id of result.viewStateClear) {
        const lb = boxById.get(id) || (layout.boxes || []).find(b => b.id === id);
        // box already removed from map — clear on removed snapshot if still reachable is N/A;
        // ensure no stale viewState remains on any remaining box with same id (none).
        if (lb) delete lb.viewState;
        // Also drop any scheduled persist timer for this id
        try {
          if (typeof __viewStatePersistTimers !== "undefined" && __viewStatePersistTimers.has(id)) {
            clearTimeout(__viewStatePersistTimers.get(id));
            __viewStatePersistTimers.delete(id);
          }
        } catch (e) { debugErr("inner render", e); }
      }
    }

    if (result.forceMaps) rebuildBoxMaps();

    // DSU dirty + rebuild (Q4b). External/load paths also force dirty.
    if (result.connChanged || result.starChanged || result.isExternal || opts.forceDsu) {
      markDsuDirty();
      if (opts.skipDsuRebuild) {
        /* caller will rebuild */
      } else {
        dsuRebuildFromConnections();
        // ADR-0007 Q1: keep runtime layout.groups mirror in sync for tests/debug/getters.
        try { ensureGroups(); } catch (e) { debugErr("ensureGroups after render", e); }
      }
    }

    if (opts.save) saveLayout();
    else if (opts.saveDebounced) saveLayoutDebounced();
    if (opts.renderConns) renderConnections();
    return result;
  }

  export function addConnection(fromId, toId) {
    ensureConnArrays();
    if (fromId === toId) return false;
    if (findConn(fromId, toId)) return false;     // dedupe
    commit("addConn", { from: fromId, to: toId });
    // Bug 4: auto-join connection endpoints to a starred parent group.
    if (getGroupByParent(fromId)) addMember(fromId, toId);
    else if (getGroupByParent(toId)) addMember(toId, fromId);
    return true;
  }

  export function removeConnection(connId) {
    ensureConnArrays();
    commit("removeConn", { connId });
    debug("removeConnection " + connId + ", conns=" + layout.connections.length);
  }

  // ADR-0006: Configurable connection delete action (tldraw Actions pattern, vanilla JS).

  export function getConnDeleteTrigger() { return (layout.settings && layout.settings.connDeleteAction) || 'alt+click'; }

  export function deleteConnById(connId) {
    if (!connId) return;
    removeConnection(connId);
    if (selectedConnId === connId) setSelectedConnId(null);
    renderConnections();
    saveLayoutDebounced();
    debug('deleteConnById ' + connId + ' mode=' + getConnDeleteTrigger());
  }

  // ADR-0006: convenience API for tests/debug — sets connDeleteAction in one call.
  export function setConnDeleteAction(mode) { layout.settings.connDeleteAction = mode || 'alt+click'; }

  // BX-EXPLORE-008++: unified primary detector for click-family modes.
  // Listener attached in renderConnections; CSS pointer-events:stroke enables hit-test on line only.
  export function onConnLinePointerDown(e) {
    const mode = getConnDeleteTrigger();
    // mousedown detector only owns the three modifier-click modes.
    // double-click mode is handled by its own dblclick listener.
    if (mode === 'double-click') return;
    if (mode === 'alt+click' && !e.altKey) return;
    if (mode === 'ctrl+click' && !e.ctrlKey) return;
    if (mode === 'shift+click' && !e.shiftKey) return;
    if (mode === 'select+delete') { // click selects; delete handled by keydown
      e.preventDefault(); e.stopPropagation();
      const connId = e.currentTarget.getAttribute('data-conn-id');
      if (selectedConnId && selectedConnId !== connId) {
        const prev = connLines.get(selectedConnId); if (prev) prev.classList.remove('conn-line--selected');
      }
      setSelectedConnId(connId);
      e.currentTarget.classList.add('conn-line--selected');
      return;
    }
    e.preventDefault(); e.stopPropagation();
    const connId = e.currentTarget.getAttribute('data-conn-id');
    if (!connId) return;
    deleteConnById(connId);
  }

  // double-click mode
  export function onConnLineDblClick(e) {
    if (getConnDeleteTrigger() !== 'double-click') return;
    e.preventDefault(); e.stopPropagation();
    const connId = e.currentTarget.getAttribute('data-conn-id');
    if (!connId) return;
    deleteConnById(connId);
  }

  // right-click delete mode removed (conflicts with right-click → back navigation)

  // select+delete mode: Backspace/Delete removes selected line
  export function onConnLineKeydown(e) {
    if (getConnDeleteTrigger() !== 'select+delete') return;
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    if (!selectedConnId) return;
    // Avoid hijacking Backspace while editing text inputs / contenteditable
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    e.preventDefault();
    deleteConnById(selectedConnId);
  }

  // ADR-0006: idempotent global keydown installer for select+delete mode.
  export let __connKeydocInstalled = false;
  export function applyConnDeleteKeydoc() {
    if (__connKeydocInstalled) return;
    document.addEventListener('keydown', onConnLineKeydown, true);
    __connKeydocInstalled = true;
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
  export function disposeAllConns() {
    for (const line of connLines.values()) {
      try { line.remove(); recycleLineEl(line); } catch (e) { /* silent: DOM line already detached */ }
    }
    connLines.clear();
    dirtyConns.clear();
    boxConnIdx.clear();
    rebuildBoxMaps();
    connById.clear();
    if (__connRefreshRAF) { cancelAnimationFrame(__connRefreshRAF); setConnRefreshRAF(0); }
    // Clear SVG overlay DOM too
    if (canvasConnSvg) { while (canvasConnSvg.firstChild) canvasConnSvg.removeChild(canvasConnSvg.firstChild); }
    if (innerConnSvg) { while (innerConnSvg.firstChild) innerConnSvg.removeChild(innerConnSvg.firstChild); }
  }

  // BX-DEV-137++++: edge-midpoint connection hotspots — 4 anchors per box for initiating connections.
  export function addEdgeAnchors(el, boxKey) {
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
  export function getConnSvg(surface, layerVar) {
    if (layerVar && surface.contains(layerVar)) return layerVar;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'conn-layer');
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:0;';
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
  export const TITLE_BAR_H = 40; // matches .small-box__bar min-height + .large-box__bar padding

  export function boxMidPoint(key) {
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
  export function connSvgForConn(c) {
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
  export const CONN_VP_MARGIN = 60;

  export function connSvgVisibleRect(svg) {
    // Returns {minX, minY, maxX, maxY} of the visible world window in svg-local coords.
    // The svg lives inside a surface with transform: translate(panX,panY) scale(zoom).
    // Visible world region = [-panX/zoom, (-panY+h)/zoom] — accounts for pan offset.
    // WITHOUT pan, low-zoom + clamped-pan shifts the world window past 0..w, culling
    // visible lines at right/bottom (Bug1: lines vanish right side at ~50-60% zoom).
    const w = svg.clientWidth || 0, h = svg.clientHeight || 0;
    if (!w || !h) return null;
    const isInner = svg.closest('.inner__surface') || svg.closest('.inner-surface-content');
    const z = (svg.closest('.canvas__surface') || svg.closest('[style*="scale"]'))
      ? (isInner
        ? (typeof innerZoom !== 'undefined' ? innerZoom : 1)
        : (typeof canvasZoom !== 'undefined' ? canvasZoom : 1))
      : 1;
    const panX = isInner ? (typeof innerPanX !== 'undefined' ? innerPanX : 0) : (typeof canvasPanX !== 'undefined' ? canvasPanX : 0);
    const panY = isInner ? (typeof innerPanY !== 'undefined' ? innerPanY : 0) : (typeof canvasPanY !== 'undefined' ? canvasPanY : 0);
    return { minX: -panX / z, minY: -panY / z, maxX: (w - panX) / z, maxY: (h - panY) / z };
  }

  export function updateSvgLine(lineEl, c) {
    const a = boxMidPoint(c.from);
    const b = boxMidPoint(c.to);
    if (!a || !b) { lineEl.style.display = 'none'; return; }
    // A4: viewport culling — if both endpoints are far outside the visible
    // svg area, hide the line entirely instead of paying for attribute sets
    // and triggering layout/paint on off-screen geometry.
    const svg = lineEl.ownerSVGElement || lineEl.parentNode;
    const vr = svg ? connSvgVisibleRect(svg) : null;
    if (vr) {
      const minX = vr.minX - CONN_VP_MARGIN, maxX = vr.maxX + CONN_VP_MARGIN;
      const minY = vr.minY - CONN_VP_MARGIN, maxY = vr.maxY + CONN_VP_MARGIN;
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
    // Bug4: Chrome renders SVG lines jagged at low zoom due to subpixel sampling.
    // crispEdges forces integer-aligned rasterization at low zoom; geometricPrecision at high zoom.
    lineEl.setAttribute('shape-rendering', z < 0.5 ? 'crispEdges' : 'geometricPrecision');
    const sw = z >= 0.8 ? 1.5 : z >= 0.5 ? 1 : 0.75;
    lineEl.setAttribute('stroke-width', sw);
    lineEl.style.display = '';
  }

  export function renderConnections() {
    ensureConnArrays();
    // Ensure SVG overlays exist
    if (canvasSurface) setCanvasConnSvg(getConnSvg(canvasSurface, canvasConnSvg));
    if (typeof innerSurfaceContent !== 'undefined' && innerSurfaceContent) setInnerConnSvg(getConnSvg(innerSurfaceContent, innerConnSvg));
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
        try { line.remove(); recycleLineEl(line); } catch (e) { /* silent: DOM line already detached */ }
        connLines.delete(id);
        dirtyConns.delete(id);
      } else {
        // ADR-0006: ensure visual selection reflects current mode — strip stale highlight when not selecting.
        if (id !== selectedConnId) line.classList.remove('conn-line--selected');
      }
    }
    // Create new SVG <line> elements for pending connections.
    const pending = layout.connections.filter(c => !connLines.has(c.id));
    for (const c of pending) {
      const svg = connSvgForConn(c);
      if (!svg) continue;
      const line = acquireLineEl();
      line.setAttribute('class', 'conn-line');
      line.setAttribute('stroke', 'var(--connection-color, #333)');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('shape-rendering', 'geometricPrecision');
      line.setAttribute('data-conn-id', c.id);
      // ADR-0006: register delete-action listeners based on layout.settings.connDeleteAction
      {
        const mode = getConnDeleteTrigger();
        // mousedown is the detector for the three click-family modes; select+delete uses mousedown for selection.
        if (mode === 'alt+click' || mode === 'ctrl+click' || mode === 'shift+click' || mode === 'select+delete') {
          line.addEventListener('mousedown', onConnLinePointerDown);
        }
        if (mode === 'double-click') line.addEventListener('dblclick', onConnLineDblClick);
        // right-click delete removed — conflicts with right-click → back navigation.
      }
      updateSvgLine(line, c);
      svg.appendChild(line);
      connLines.set(c.id, line);
    }
    scheduleConnRefresh(Array.from(connLines.keys()));
  }
  export function scheduleConnRefresh(connIds) {
    if (!connIds || !connIds.length) return;
    for (const id of connIds) dirtyConns.add(id);
    // BX-DEV-PERF: rAF-batch to avoid sync layout thrash on Firefox during drag
    if (__connRefreshRAF) return;
    setConnRefreshRAF(requestAnimationFrame(() => {
      setConnRefreshRAF(0);
      const ids = Array.from(dirtyConns);
      dirtyConns.clear();
      for (const id of ids) {
        const line = connLines.get(id);
        if (!line) continue;
        const conn = connById.get(id);
        if (conn) updateSvgLine(line, conn);
      }
    }));
  }

  export function refreshConnsForBox(boxKey) {
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
  export function refreshConnsForBoxSync(boxKey) {
    ensureConnArrays();
    const connSet = boxConnIdx.get(boxKey);
    if (!connSet || connSet.size === 0) return;
    for (const id of connSet) {
      const line = connLines.get(id);
      if (!line) continue;
      const conn = connById.get(id);
      if (conn) updateSvgLine(line, conn);
    }
  }

  export function refreshAllConns() { scheduleConnRefresh(Array.from(connLines.keys())); }

  // ── Star-mark / group drag ──────────────────────────
  
  // ── BX-DSU: Union-Find with path compression ──
  
  export function dsuFind(key) {
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
  
  export function dsuMake(key) {
    if (!boxGroupId.has(key)) {
      boxGroupId.set(key, key);
      groupMembers.set(key, new Set([key]));
    }
  }
  
  export function dsuUnion(a, b) {
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
  
  export function dsuReset() {
    boxGroupId.clear(); groupMembers.clear(); groupStar.clear();
    // ADR-0007 Q4b: dirty flag is owned by markDsuDirty/dsuRebuild — not reset here
  }
  export function markDsuDirty() { setDsuDirty(true); }
  
  export function dsuRebuildFromConnections() {
    if (!__dsuDirty) return; // ADR-0007 Q4b: skip full rebuild when clean
    dsuReset();
    // Rebuild DSU from layout.connections — each connection unions two boxes
    for (const c of layout.connections) {
      if (c.from && c.to) dsuUnion(c.from, c.to);
    }
    debugSampled('dsuRebuild: conns='+layout.connections.length);
  // A5: Re-apply star marks from box.isParent field
  // BX-144: clear isParent for tombstoned parents before applying star marks
  // (mergeById filters by box.id, but tombstones are keyed by box key — e.g. "large:<id>").
  // A remote box with isParent=true can survive mergeById when its key is tombstoned;
  // this filter ensures unstarred parents stay unstarred after cross-tab merge.
  const __tdel = layout._meta?.deleted || {};
  for (const b of (layout.boxes || [])) {
    if (b.isParent && __tdel[largeKey(b.id)]) b.isParent = false;
    for (const sb of (b.children || [])) {
      if (sb.isParent && __tdel[smallKey(b.id, sb.id)]) sb.isParent = false;
    }
  }
  for (const b of (layout.boxes || [])) {
    if (b.isParent) {
      const pk = largeKey(b.id);
      groupStar.add(pk);
      // ADR-0007 / BX-144: starred parent is a valid group even with zero connections.
      // Without dsuMake, getGroupByParent() would fail (dsuGroupMembers null) after remote star adopt.
      dsuMake(pk);
    }
    for (const sb of (b.children || [])) {
      if (sb.isParent) {
        const sp = smallKey(b.id, sb.id);
        groupStar.add(sp);
        dsuMake(sp);
      }
    }
  }
  setDsuDirty(false); // Bug1: mark DSU as built so getGroupByParent skips ensureGroups on subsequent calls
}
  
  export function dsuGroupMembers(key) {
    const root = dsuFind(key);
    if (!root) return null;
    return groupMembers.get(root) || null;
  }
  

export function ensureGroups() {
  ensureConnArrays();
  dsuRebuildFromConnections();
  debugSampled('ensureGroups: boxes='+(layout.boxes||[]).length+' conns='+(layout.connections||[]).length);
  const gs = [];
  for (const b of (layout.boxes || [])) {
    if (b.isParent) {
      const pk = largeKey(b.id);
      const ms = dsuGroupMembers(pk);
      const membersStr = ms ? [...ms].filter(k => k !== pk) : [];
      gs.push({ parentId: pk, members: membersStr });
    }
    for (const sb of (b.children || [])) {
      if (sb.isParent) {
        const sp = smallKey(b.id, sb.id);
        const ms2 = dsuGroupMembers(sp);
        const membersStr2 = ms2 ? [...ms2].filter(k => k !== sp) : [];
        gs.push({ parentId: sp, members: membersStr2 });
      }
    }
  }
  // ADR-0007 Q1: runtime mirror only — stripGroupsForPersist removes groups on save.
  layout.groups = gs;
  return gs;
}

  // ── Tiered keys for cross-level connections (BX-DEV-137+) ──────────
  // large:boxId  |  small:largeId:smallId  — addresses any box at any nesting.
  // Connections store these tiered keys, so a line can link large-to-large,
  // large-to-small, small-to-small regardless of inner-canvas nesting.
  export function resolveBoxEl(key) {
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
  export function allValidKeys() {
    const s = new Set();
    for (const b of layout.boxes) {
      s.add(largeKey(b.id));
      for (const sb of (b.children || [])) s.add(smallKey(b.id, sb.id));
    }
    return s;
  }

  export function getGroupByParent(parentId) {
    // A5: lazy DSU rebuild on first access — needed after page reload where
    // groupStar is empty until ensureGroups()/dsuRebuildFromConnections runs.
    if (parentId && __dsuDirty) ensureGroups();
    // A5: star determined by groupStar Set (populated from box.isParent)
    if (!parentId || !groupStar.has(parentId)) return null;
    const members = dsuGroupMembers(parentId);
    if (!members) return null;
    return { parentId, members: [...members].filter(k => k !== parentId) };
  }
  export function toggleStarMark(parentId) {
    ensureConnArrays();
    const result = commit("toggleStar", { parentId }, { save: true });
    if (result && result.skipped) return;
    if (result && result.unstarred) debug("toggleStarMark: unstar parent=" + parentId);
    if (result && result.starred) debug("toggleStarMark: star parent=" + parentId);
    // Update star button visual state (large + small parity)
    document.querySelectorAll(".box-star-btn").forEach(btn => {
      const boxEl = btn.closest("[data-box-key]");
      if (!boxEl) return;
      const key = boxEl.dataset.boxKey;
      const starred = groupStar.has(key);
      btn.classList.toggle("box-tool-btn--on", starred);
      btn.textContent = starred ? "★" : "☆";
      boxEl.classList.toggle("box--starred", starred);
    });
  }
  // addMember: unions parent+member in DSU (compat API for external callers)
  export function addMember(parentId, memberId) {
    if (parentId === memberId) return;
    ensureConnArrays();
    dsuUnion(parentId, memberId); // Bug2: union DSU
    setDsuDirty(false); // DSU is valid after dsuUnion
  }
  // During parent drag we apply the same delta to every member. Members collide
  // against OUT-of-group boxes only; intra-group siblings move as a rigid set.
  // BX-DEV-137+: group drag now performs a continuous elastic sweep against
  // OUT-of-group large boxes, not just a rigid delta translate. Each member
  // is resolved via elasticSnap with siblings (group + parent) excluded, so the
 // whole group visits new positions as a rigid set, then collisions push back.
  // ADR-0013 BX-PERF-001: build spatial grid ONCE per moveGroupTogether call, pass to elasticSnap for all members.
  // Old: O(m*n) — elasticSnap rebuilt grid per member per frame. New: grid built once, O(m*k) where k = neighbors.
  export function moveGroupTogether(parentId, deltaX, deltaY, origins) {
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
      // ADR-0013 BX-PERF-001: build spatial grid once for this call — reuse across all large members.
      const largeSpatial = buildSpatialGrid(others);
      for (const mId of largeMembers) {
        const rawId = (typeof mId === 'string' && mId.startsWith('large:')) ? mId.slice(6) : mId;
        const m = getLargeBox(rawId);
        if (!m) continue;
        const w = m.width || LARGE_DEF_W, h = m.height || LARGE_DEF_H;
        const base = (origins && origins.get(mId)) || { x: m.x, y: m.y };
        const nx0 = base.x + deltaX, ny0 = base.y + deltaY;
        const resolved = elasticSnap({ x: nx0, y: ny0 }, w, h, others, CANVAS_GRID, snapCanvas, largeSpatial);
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
      // ADR-0013 BX-PERF-001: build spatial grid once for this call — reuse across all small members.
      const smallSpatial = buildSpatialGrid(others);
      for (const mId of smallMembers) {
        const mp = mId.split(':');
        if (!mp || mp.length < 3 || mp[1] !== parentLargeId) continue;
        const rawId = mp.slice(2).join(':');
        const m = getSmallBox(parentLargeId, rawId);
        if (!m) continue;
        const w = m.width || SMALL_DEF_W, h = m.height || SMALL_DEF_H;
        const base = (origins && origins.get(mId)) || { x: m.x, y: m.y };
        const nx0 = base.x + deltaX, ny0 = base.y + deltaY;
        const resolved = elasticSnap({ x: nx0, y: ny0 }, w, h, others, INNER_GRID, snapInner, smallSpatial);
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
  export function enterConnectMode(fromId, fromEl, initCx, initCy) {
    if (connectMode) { exitConnectMode(); return; }   // second click cancels
    setConnectMode({ fromId, fromEl });
    document.body.classList.add('cx--connecting');
    document.body.style.cursor = 'crosshair';
    // Determine which surface this box lives in
    const mp = boxMidPoint(fromId);
    const isInner = mp && mp.surface === 'inner';
    const surface = isInner ? innerSurfaceContent : canvasSurface;
    const svg = surface ? getConnSvg(surface, isInner ? innerConnSvg : canvasConnSvg) : null;
    if (isInner) setInnerConnSvg(svg); else setCanvasConnSvg(svg);
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
      setProvisionalLine(document.createElementNS('http://www.w3.org/2000/svg', 'line'));
      provisionalLine.setAttribute('class', 'conn-line conn-line--provisional');
      provisionalLine.setAttribute('stroke', 'var(--connection-color, #333)');
      provisionalLine.setAttribute('stroke-width', '1.5');
      provisionalLine.setAttribute('stroke-dasharray', '5,3');
      provisionalLine.setAttribute('x1', Math.round(mp.x));
      provisionalLine.setAttribute('y1', Math.round(mp.y));
      provisionalLine.setAttribute('x2', Math.round(initLX));
      provisionalLine.setAttribute('y2', Math.round(initLY));
      svg.appendChild(provisionalLine);
      setProvisionalGhost({ x: initLX, y: initLY, surface: mp.surface });
    }
    debug('enterConnectMode from=' + fromId);
  }
  export function exitConnectMode(commitToId) {
    const cm = connectMode; setConnectMode(null);
    document.body.classList.remove('cx--connecting');
    document.body.style.cursor = '';
    // BX-142: dispose provisional SVG line + ghost coords.
    if (provisionalLine) { try { provisionalLine.remove(); } catch (e) { /* silent: DOM line already detached */ } setProvisionalLine(null); }
    setProvisionalGhost(null);
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

  export function getSmallBox(largeId, smallId) {
    return smallBoxById.get(largeId + ":" + smallId) || null;
  }

  // Canvas pan boundary: at 10% zoom, max pan range = 10x screen size
  export function clampCanvasPan(panX, panY, zoom) {
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

  export function clampInnerPan(panX, panY, zoom) {
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
  // ADR-0007 Q3b: GDevelop-style spatial hash for elasticSnap when N >= 32.

  // ── Obsidian-style zoom & pan ──────────────────────────
  export function applyCanvasTransform() {
    canvasSurface.style.transform = `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`;
    canvasSurface.style.transformOrigin = '0 0';
    canvasZoomVal.textContent = Math.round(canvasZoom * 100) + '%';
    zoomSlider.value = Math.round(canvasZoom * 100);
    zoomSliderVal.textContent = Math.round(canvasZoom * 100) + '%';
    // BX-DEV-145: lines live inside canvasSurface, so CSS transform moves them
    // automatically on pan/zoom — no per-tick recalculation needed.
  }

  export function applyInnerTransform() {
    const content = ensureInnerSurfaceContent();
    content.style.transform = `translate(${innerPanX}px, ${innerPanY}px) scale(${innerZoom})`;
    content.style.transformOrigin = '0 0';
    innerZoomVal.textContent = Math.round(innerZoom * 100) + '%';
    zoomSlider.value = Math.round(innerZoom * 100);
    zoomSliderVal.textContent = Math.round(innerZoom * 100) + '%';
    // BX-DEV-145: inner surface transform carries conn-lines too.
    // No per-tick recalculation — CSS transform handles line position.
  }

  export function zoomStep(current, dir) {
    const idx = ZOOM_STEPS.indexOf(current);
    if (dir === 'in' && idx < ZOOM_STEPS.length - 1) return ZOOM_STEPS[idx + 1];
    if (dir === 'out' && idx > 0) return ZOOM_STEPS[idx - 1];
    return current;
  }
  export function updateAutohideUI() {
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
      // ADR-0015.updated: tooltip shows the ACTION clicking will perform (standard toggle UX).
      // Pinned → "Unpin header" (headerPinOff), Unpinned → "Pin header" (headerPin).
      headerPinBtn.title = headerPinned ? i18n('headerPinOff') : i18n('headerPin');
      headerPinBtn.classList.toggle('header-pin--floating', !headerPinned);
      headerPinBtn.style.zIndex = headerPinned ? '10' : '1000';
    }
  }
  export function renderCanvas() {
    debug('renderCanvas start, boxCount=' + layout.boxes.length + ' hidden=' + canvasContainer.hidden);
    innerWrapper.hidden = true;
    canvasContainer.hidden = false;
    backBtn.dataset.show = '0';
    updateAutohideUI(); // always reposition pin to active canvas (BX-DEV-078)

    const hasBoxes = layout.boxes.length > 0;
    // BX-DEV-111: hide empty placeholder BEFORE clearing surface to avoid flash
    canvasEmpty.hidden = true;
   // Bug2: clear DOM synchronously then rebuild in same tick — no flash
    // BX-DEV-140b/d: blur activeElement before DOM wipe — prevents Chrome focus-steal on rebuild
    // BX-DEV-140d: also blur if activeElement is a contenteditable inside canvasSurface
    // or a toolbar button that Chrome will redirect to after the wipe.
    const _ae1 = document.activeElement;
    // BX-SEL-01: clear residual text selection before DOM wipe — Chrome native dblclick
    // on selectable text creates a Selection range that survives innerHTML=''; when new text
    // nodes appear, Chrome re-anchors the stale range to them.
    window.getSelection()?.removeAllRanges();
    if (_ae1 && _ae1 !== document.body) _ae1.blur();
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
  export function setBodyExpandHeight(el) {
    const body = el.querySelector('.large-box__body') || el.querySelector('.small-box__body');
    if (!body) return;
    requestAnimationFrame(() => {
      // BX-EXP-REGR: must measure NATURAL content height, not the max-height-clamped value.
      // Temporarily remove max-height so scrollHeight reflects the full content the drawer
      // needs to expand to. Restore before the frame paints to avoid any visible flash.
      // (This is the BX-DEV-105 pattern that BX-DEV-140d removed by mistake; 140d kept the
      // debug referencing the deleted savedMaxH/wasCollapsed locals, masking the regression
      // with a ReferenceError that prevented setProperty from running at all.)
      const savedMaxH = el.style.maxHeight;
      el.style.maxHeight = 'none';
      void el.offsetHeight; // force reflow under the unconstrained max-height
      const fullH = el.scrollHeight;
      el.style.maxHeight = savedMaxH;
      debug('setBodyExpandHeight measured', { id: el.dataset.id, fullH });
      if (fullH > 0) el.style.setProperty('--expand-height', fullH + 'px');
      // Also keep --body-max-height for compatibility
      const bh = body.scrollHeight;
      if (bh > 0) body.style.setProperty('--body-max-height', bh + 'px');
      // BX-DEV-137++: after layout settles, refresh lines — box height may have changed.
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
    });
  }

  export function createLargeBoxEl(box) {
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
    bar.addEventListener('mousedown', e => { if (!e.target.closest('.large-box__title') && !e.target.closest('.large-box__delete') && !e.target.closest('.box-star-btn')) onBoxDragStart(e, 'large', box.id, el); });

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
    delBtn.tabIndex = -1;
    delBtn.title = i18n('deleteBox');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteLargeBox(box.id); });


    // ── pin button (lock box position)
    const pinBtn = document.createElement('button');
    pinBtn.className = 'box-pin-btn';
    pinBtn.tabIndex = -1;
    pinBtn.title = i18n('pin');
    pinBtn.textContent = '⊙';
    pinBtn.title = box.pinned ? i18n('unpin') : i18n('pin');
    pinBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:13px;padding:0 3px;opacity:0.4;flex-shrink:0;-webkit-appearance:none;appearance:none;outline:none;box-shadow:none;color:inherit;';
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
    expandBtn.tabIndex = -1;
    expandBtn.title = i18n('autoExpand');
    expandBtn.textContent = '⊟';
    expandBtn.title = box.collapseHover ? i18n('autoExpandHover') : i18n('autoExpand');
    expandBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:13px;padding:0 3px;opacity:0.4;flex-shrink:0;-webkit-appearance:none;appearance:none;outline:none;box-shadow:none;color:inherit;';
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
      if (lastDragEndId === box.id) { setLastDragEndId(null); barDownWasDragZone = false; barDownX = 0; barDownY = 0; }
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
      setLastEnterLargeBoxAt(Date.now());
      setSuppressInnerDblClickOnce(true);
      enterLargeBox(box.id);
    });
    if (childCount) {
      const chips = document.createElement('div');
      chips.className = 'large-box__chips';
      for (const sb of box.children.slice(0, 6)) {
        const chip = document.createElement('button');
        chip.className = 'large-box__chip';
        chip.textContent = sb.title || i18n('untitledBox');
        chip.setAttribute('data-large-id', box.id);
        chip.setAttribute('data-small-id', sb.id);
        chip.setAttribute('tabindex', '-1');
        chip.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          enterAndLocateSmallBox(box.id, sb.id);
        });
        chips.appendChild(chip);
      }
      if (childCount > 6) {
        const more = document.createElement('span');
        more.className = 'large-box__chip large-box__chip--more';
        more.textContent = `+${childCount - 6}`;
        chips.appendChild(more);
      }
      body.appendChild(chips);
    } else {
      // Q2: Empty state — action button only, no hint text line.
      // User: "删除'点击添加小盒子'的一行字彻底替换成按钮". Button alone carries intent.
      const actionBtn = document.createElement('button');
      actionBtn.className = 'large-box__empty-action';
      actionBtn.textContent = i18n('emptyLargeAction');
      actionBtn.setAttribute('data-box-id', box.id);
      actionBtn.setAttribute('tabindex', '-1');
      actionBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        enterLargeBox(box.id);
      });
      body.appendChild(actionBtn);
    }

    // BX-DEV-137: star-mark (parent) + connect-mode toggle buttons. Cheap per-box UI;
    // theme uses currentColor so it adapts to dark/light automatically.
    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    const _starred = !!getGroupByParent(largeKey(box.id));
    starBtn.className = 'box-star-btn box-tool-btn' + (_starred ? ' box-tool-btn--on' : '');
    starBtn.tabIndex = -1;
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
  export function enterLargeBox(id) {
    _enterLargeBox(id, arguments[1] === true);
  }
  export function _enterLargeBox(id, skipPosRestore) {
    // BX-DEV-111N: stash the previous large box inner view state into its own record before switching.
    if (currentLargeBoxId && currentLargeBoxId !== id) { saveLargeBoxViewState(currentLargeBoxId); }
    setCurrentLargeBoxId(id);
    const lb = getLargeBox(id);
    if (!lb) { exitToCanvas(); return; }
    persistViewState(true);
    // BX-DEV-111N: restore per-box inner view state (zoom/pan) saved earlier, unless caller asked to skip.
    if (!skipPosRestore && lb.viewState && typeof lb.viewState.innerZoom === 'number') {
      setInnerZoom(lb.viewState.innerZoom);
      setInnerPanX(Number(lb.viewState.innerPanX) || 0);
      setInnerPanY(Number(lb.viewState.innerPanY) || 0);
      debug('enterLargeBox: restored viewState for', id, { innerZoom, innerPanX, innerPanY });
    } else if (skipPosRestore) {
      // caller (reload/restore) will set inner* values externally after this returns
    } else {
      setInnerZoom(layout.settings.zoomLevel || 1.0); setInnerPanX(0); setInnerPanY(0);
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

  export function exitToCanvas() {
    debug(`exitToCanvas: leaving box, back to canvas`);
    // BX-DEV-111N: stash inner view before resetting — preserves per-box view across exits.
    saveLargeBoxViewState(currentLargeBoxId);
    setCurrentLargeBoxId(null);
    setInnerPanX(0); setInnerPanY(0); setInnerZoom(1.0);
    persistViewState(true);
    if (addLargeBtn) addLargeBtn.style.display = '';  // BX-DEV-101: restore + button
    disposeAllConns(); // BX-DEV-137+++: clear inner-view lines before canvas re-renders them
    renderCanvas();
  }

  export function renderCrumbs(lb) {
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
  export let innerSurfaceContent = null;
  export function ensureInnerSurfaceContent() {
    if (innerSurfaceContent && innerSurface.contains(innerSurfaceContent)) return innerSurfaceContent;
    innerSurfaceContent = innerSurface.querySelector('.inner__surface-content');
    if (!innerSurfaceContent) {
      innerSurfaceContent = document.createElement('div');
      innerSurfaceContent.className = 'inner__surface-content';
      innerSurfaceContent.style.cssText = 'position:absolute;inset:0;transform-origin:0 0;';
      innerSurface.appendChild(innerSurfaceContent);
    }
    return innerSurfaceContent;
  }
  export function renderInnerSurface(lb) {
    // Keep the surface (parent clip box) intact; only refresh the content layer.
    // innerHTML='' on the surface would also wipe the content wrapper we added.
    const content = ensureInnerSurfaceContent();
    // BX-143: dispose connection state BEFORE clearing innerHTML — content.innerHTML=''
    // orphans innerConnSvg + all connLines SVG elements. Without this, renderConnections
    // skips creating new lines because connLines.has(c.id) returns true for stale refs.
   disposeAllConns();
    // BX-DEV-140b/d: blur activeElement before DOM wipe — prevents Chrome focus-steal on rebuild
    const _ae2 = document.activeElement;
    if (_ae2 && _ae2 !== document.body) _ae2.blur();
   content.innerHTML = '';
   const frag = document.createDocumentFragment();
   for (const sb of lb.children || []) {
     frag.appendChild(createSmallBoxEl(lb.id, sb));
   }
   // Bug1: Empty state attached to innerSurface (viewport — non-transformed)
   // NOT to content/frag (which is inside innerSurfaceContent = transformed by applyInnerTransform).
   // This makes it stay centered during pan/zoom, matching #canvas-empty behavior.
   const existingEmpty = innerSurface.querySelector(':scope > .inner__empty-state');
   if (existingEmpty) existingEmpty.remove();
   if (!lb.children || lb.children.length === 0) {
     const emptyWrap = document.createElement('div');
     emptyWrap.className = 'inner__empty-state';
     emptyWrap.innerHTML = '<div class="inner__empty-hint">' + i18n('emptyInnerHint') + '</div>';
     const actionBtn = document.createElement('button');
     actionBtn.className = 'inner__empty-action';
     actionBtn.textContent = i18n('emptyInnerAction');
     actionBtn.setAttribute('data-large-id', lb.id);
     actionBtn.setAttribute('tabindex', '-1');
     actionBtn.addEventListener('click', function (e) {
       e.stopPropagation();
       e.preventDefault();
       // BX-DEV-112D: bridge the physical dblclick — click2 and the follow-on
       // dblclick (→ onInnerDblClick → addSmallBoxAt) must not double-create.
       if (isWithinCreateCooldown(e.clientX, e.clientY)) { debug('inner CTA suppressed: create cooldown'); return; }
       markCreate(e.clientX, e.clientY);
       addSmallBox(e);
     });
     emptyWrap.appendChild(actionBtn);
     innerSurface.appendChild(emptyWrap); // Bug1: viewport parent, not transformed content
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

  export function createSmallBoxEl(largeId, sb) {
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
      if (!e.target.closest('.small-box__title') && !e.target.closest('.small-box__delete') && !e.target.closest('.box-star-btn')) {
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
    delBtn.tabIndex = -1;
    delBtn.title = i18n('deleteBox');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteSmallBox(largeId, sb.id); });


    // ── pin button
    const pinBtn = document.createElement('button');
    pinBtn.className = 'box-pin-btn';
    pinBtn.tabIndex = -1;
    pinBtn.title = i18n('pin');
    pinBtn.textContent = '⊙';
    pinBtn.title = sb.pinned ? i18n('unpin') : i18n('pin');
    pinBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:11px;padding:0 2px;opacity:0.4;flex-shrink:0;-webkit-appearance:none;appearance:none;outline:none;box-shadow:none;color:inherit;';
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
    expandBtn.tabIndex = -1;
    expandBtn.title = i18n('autoExpand');
    expandBtn.textContent = '⊟';
    expandBtn.title = sb.collapseHover ? i18n('autoExpandHover') : i18n('autoExpand');
    expandBtn.style.cssText = 'background:transparent;border:0;cursor:pointer;font-size:11px;padding:0 2px;opacity:0.4;flex-shrink:0;-webkit-appearance:none;appearance:none;outline:none;box-shadow:none;color:inherit;';
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
    sbStarBtn.tabIndex = -1;
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

  export function renderBookmarks(body, largeId, sb) {
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
          } catch (e) { /* silent: inner render variant, non-critical */ }
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
    addBtn.className = 'bm-add-btn';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      showAddBookmarkPopup(sb, largeId);
    });

    addRow.appendChild(addBtn);
    body.appendChild(addRow);
  }

  // BX-DEV-122 (Bug12 popup-followf-box): maintain a live tracker of open bookmark edit/add
  export function addPopupTracker(popupEl, repositionFn) {
    if (!popupEl || typeof repositionFn !== 'function') return;
    __popupTrackers.set(popupEl, repositionFn);
  }
  export function removePopupTracker(popupEl) {
    if (popupEl) __popupTrackers.delete(popupEl);
  }
  export function repositionAllPopups() {
    // Re-position every open popup to its currently attached small box.
    // Safe to call from hot paths (panmove, wheel, dragmove) — it's a Map#forEach + getBoundingClientRect.
    if (__popupTrackers.size === 0) return;
    // Drop popups that were resolved (removed from DOM, e.g. by save/cancel).
    for (const k of [...__popupTrackers.keys()]) {
      if (!document.body.contains(k)) __popupTrackers.delete(k);
    }
    __popupTrackers.forEach(fn => { try { fn(); } catch (e) { /* silent: popup tracker callback, tracker auto-cleaned */ } });
  }

  // Inline bookmark edit popup
  export function showBookmarkEditPopup(bm, index, sb, largeId) {
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
    // Feat-4: Enter on title field advances focus to URL field (not save). Enter on URL saves.
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); urlInput.focus(); urlInput.select(); } });
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
  export function showAddBookmarkPopup(sb, largeId) {
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
    // Feat-4: Enter on title advances to URL field; Enter on URL adds the bookmark.
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); urlInput.focus(); urlInput.select(); } });
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
  export function onBmRowDragStart(e, row, sb, largeId) {
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

  export function onBoxDragStart(e, type, id, el) {
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
    setDragState({
      type, id, el,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origLeft: parseInt(el.style.left, 10) || 0,
      origTop: parseInt(el.style.top, 10) || 0,
      zoom, panX, panY,
      container,
      memberOrigins,
      hasMoved: false // BX-DEV-137+++++: track actual drag movement to suppress accidental button click
    });

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
  export function onBoxDragVisHide() { if (dragState) onBoxDragEnd({ type: 'visibilitychange' }); }

  export function onBoxDragMove(e) {
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
    if (__popupTrackers.size > 0) { try { repositionAllPopups(); } catch (e) { /* silent: popup reposition, DOM may be mid-render */ } }
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

  export function onBoxDragEnd(e) {
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

    const finalX = type === 'large'
      ? (parseInt(el.style.left, 10) || getLargeBox(id)?.x || 0)
      : (parseInt(el.style.left, 10) || getSmallBox(id.largeId, id.smallId)?.x || 0);
    const finalY = type === 'large'
      ? (parseInt(el.style.top, 10) || getLargeBox(id)?.y || 0)
      : (parseInt(el.style.top, 10) || getSmallBox(id.largeId, id.smallId)?.y || 0);

    if (type === 'large') {
      const box = getLargeBox(id);
      if (!box) { setDragState(null); return; }
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
      if (!sb) { setDragState(null); return; }
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
    setDragState(null);
    setLastDragEndTime(Date.now());  // prevent click-from-drag (BX-DEV-065)
    if (type === "large") setLastDragEndId(id);  // signal large box to clear barDownWasDragZone on next click (BX-DEV-077)
  }

  // ── Canvas Pan (left-drag empty area) ────────────────
  export function onCanvasPanStart(e) {
    // Only pan if clicking empty canvas (not on a box)
    if (e.target.closest('.large-box') || e.target.closest('.small-box') || e.target.closest('.zoom-controls') || e.target.closest('.box-resize-handle') || e.target.closest('.header-pin-float') || e.target.id === 'header-pin-btn' || e.target.closest('#header-pin-btn')) return;
    if (e.button !== 0) return;

    canvasSurface.classList.add('panning');
    setPanState({
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origPanX: canvasPanX,
      origPanY: canvasPanY,
      moved: false
    });
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

  export function onCanvasPanMove(e) {
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
    setCanvasPanX(clamped.x);
    setCanvasPanY(clamped.y);
    applyCanvasTransform();
    e.preventDefault();
    try { repositionAllPopups(); } catch (e) { /* silent: popup reposition, DOM may be mid-render */ }
    // BX-DEV-145/EXPLORE-008: CSS transform moves SVG coords automatically,
    // but viewport culling (display:none) must be re-evaluated on pan —
    // previously-culled lines may re-enter the visible window. scheduleConnRefresh
    // is rAF-coalesced → at most once per frame, not per mousemove event.
    if (connLines.size) scheduleConnRefresh(Array.from(connLines.keys()));
  }

  export function onCanvasPanEnd(e) {
    canvasSurface.classList.remove('panning');
    document.removeEventListener('mousemove', onCanvasPanMove);
    document.removeEventListener('mouseup', onCanvasPanEnd);
    window.removeEventListener('blur', onCanvasPanEnd);
    document.removeEventListener('visibilitychange', onCanvasPanVisHide);
    document.removeEventListener('pointerup', onCanvasPanEnd);
    document.removeEventListener('pointercancel', onCanvasPanEnd);
    if (panState && panState.moved) canvasContainer.style.cursor = '';
    setPanState(null);
    persistViewState(true);
  }

  export function onCanvasPanVisHide() {
    // BX-DEV-120A: tab-hide during pan — release grabbing immediately.
    if (panState) onCanvasPanEnd({ type: 'visibilitychange' });
  }

  // Inner canvas pan
  // BX-DEV-112B: mousedown must NOT prematurely set cursor=grabbing. Only after
  // a real drag (>= 3px movement) do we switch to grabbing. This keeps the
  // dblclick mousedown/mouseup sequence from flashing cursor between grab and
  // grabbing, and keeps dblclick event synthesis intact (no preventDefault on bare mousedown).
  const PAN_CURSOR_THRESHOLD = 3;
  export function onInnerPanStart(e) {
    if (e.target.closest('.small-box') || e.target.closest('.zoom-controls') || e.target.closest('.box-resize-handle') || e.target.closest('.header-pin-float') || e.target.id === 'header-pin-btn' || e.target.closest('#header-pin-btn')) return;
    if (e.button !== 0) return;

    innerCanvas.classList.add('panning');
    setPanState({
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origPanX: innerPanX,
      origPanY: innerPanY,
      moved: false
    });
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

  export function onInnerPanMove(e) {
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
    setInnerPanX(clamped.x);
    setInnerPanY(clamped.y);
    applyInnerTransform();
    e.preventDefault();
    // BX-DEV-111N+ : propagate live inner pan to other tabs within ~25ms (throttled).
    if (currentLargeBoxId) scheduleLargeBoxViewStatePersist(currentLargeBoxId);
    try { repositionAllPopups(); } catch (e) { /* silent: popup reposition, DOM may be mid-render */ }
    // BX-DEV-145/EXPLORE-008: re-evaluate viewport culling on inner pan too.
    if (connLines.size) scheduleConnRefresh(Array.from(connLines.keys()));
  }

  export function onInnerPanEnd(e) {
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
    setPanState(null);
    persistViewState(true);
    // BX-DEV-111N: persist inner pan into the current large box record.
    if (currentLargeBoxId) saveLargeBoxViewState(currentLargeBoxId);
  }

  export function onInnerPanVisHide() {
    // BX-DEV-120A: tab-hide during pan — release grabbing immediately.
    if (panState) onInnerPanEnd({ type: 'visibilitychange' });
  }
  // ── Ctrl+scroll zoom ────────────────────────────────────
  export function onCanvasWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const result = zoomAtPoint(canvasContainer, canvasZoom, canvasPanX, canvasPanY, e.clientX, e.clientY, factor);
      setCanvasZoom(result.zoom);
      // Clamp pan immediately to prevent flash-back on next move (BX-DEV-049)
      const clampedZoomPan = clampCanvasPan(result.panX, result.panY, canvasZoom);
      setCanvasPanX(clampedZoomPan.x);
      setCanvasPanY(clampedZoomPan.y);
      layout.settings.zoomLevel = canvasZoom;
      applyCanvasTransform();
      // A4: refresh conn lines so LOD stroke-width + viewport-culling react to the new zoom.
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
      saveLayout();
      try { repositionAllPopups(); } catch (e) { /* silent: popup reposition, DOM may be mid-render */ }
    }
  }

  export function onInnerWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const result = zoomAtPoint(innerCanvas, innerZoom, innerPanX, innerPanY, e.clientX, e.clientY, factor);
      setInnerZoom(result.zoom);
      const clampedInnerPan = clampInnerPan(result.panX, result.panY, innerZoom);
      setInnerPanX(clampedInnerPan.x);
      setInnerPanY(clampedInnerPan.y);
      applyInnerTransform();
      // A4: refresh inner conn lines after zoom so LOD/culling reacts.
      if (typeof refreshAllConns === 'function' && connLines.size) refreshAllConns();
      try { repositionAllPopups(); } catch (e) { /* silent: popup reposition, DOM may be mid-render */ }
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
  export function onResizeStart(e, type, id, el) {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;

    setResizeState({
      type, id, el,
      startX: e.clientX,
      startY: e.clientY,
      origW: parseInt(el.style.width, 10) || (type === 'large' ? LARGE_DEF_W : SMALL_DEF_W),
      origH: parseInt(el.style.height, 10) || (type === 'large' ? LARGE_DEF_H : SMALL_DEF_H),
      zoom: type === 'large' ? canvasZoom : innerZoom
    });
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
      setResizeState(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── create / delete ────────────────────────────────────
  // ── BX-DEV-112D: physical-double-click idempotency for creation entries ──
  // One physical double-click dispatches click(detail=1) → click(detail=2) → dblclick
  // (W3C UI Events). When the two clicks land on different elements (canvas, then a
  // just-revealed empty-state CTA), dblclick targets the nearest common ancestor, so
  // double-click. Guard: a 350ms/12px time+position cooldown (Excalidraw double-tap
  // pattern) bridges the CTA click path and the dblclick path — the empty-state CTA
  // handlers mark the cooldown before creating, and the dblclick entries (add*BoxAt)
  // check it. Toolbar #add-box / #add-small stay UNGUARDED so rapid intentional
  // multi-add keeps working. Programmatic calls (no event / non-finite coords)
  // bypass the cooldown.
  const CREATE_COOLDOWN_MS = 350;
  const CREATE_COOLDOWN_DIST_PX = 12;
  let lastCreateAt = { t: 0, x: NaN, y: NaN };
  export function isWithinCreateCooldown(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    if (Date.now() - lastCreateAt.t > CREATE_COOLDOWN_MS) return false;
    return Math.hypot(clientX - lastCreateAt.x, clientY - lastCreateAt.y) <= CREATE_COOLDOWN_DIST_PX;
  }
  export function markCreate(clientX, clientY) {
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      lastCreateAt = { t: Date.now(), x: clientX, y: clientY };
    }
  }

  export async function addLargeBoxAt(clientX, clientY) {
    // BX-DEV-112D: cooldown bridges the empty-state CTA click path and this dblclick path
    if (isWithinCreateCooldown(clientX, clientY)) { debug('addLargeBoxAt suppressed: create cooldown'); return; }
    markCreate(clientX, clientY);
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
    boxById.set(newBox.id, newBox);
    debug('addLargeBoxAt pushed, count=' + layout.boxes.length);
    await saveLayout();
    debug('addLargeBoxAt saved, calling renderCanvas');
    renderCanvas();
    // BX-DEV-140d: after DOM rebuild, Chrome redirects focus to the first
    // focusable element in DOM order (contenteditable title / toolbar button).
    // Explicitly park focus on our tabindex=-1 sink to prevent the steal.
    canvasContainer.focus({ preventScroll: true });
    debug('addLargeBoxAt done, surface children=' + canvasSurface.children.length);
  }

  export async function addLargeBox(e) {
    if (e && e.preventDefault) e.preventDefault(); // BX-DEV-140c: prevent Chrome click focus-steal

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
    canvasContainer.focus({ preventScroll: true }); // BX-DEV-140d: prevent Chrome focus-steal
    debug('addLargeBox done, surface children=' + canvasSurface.children.length);
  }
  export function updateInnerCaption(lb) {
    const captionEl = document.getElementById('caption');
    if (captionEl) captionEl.textContent = i18n('smallBoxesCount', [lb?.children?.length || 0]);
  }
  export function deleteLargeBox(id) {
    openConfirmModal('large', id);
  }

  export function _execDeleteLargeBox(id) {
    const result = commit("deleteLargeBox", { id }, { save: true });
    if (result && result.skipped) return;
    // ADR-0007 Q4d: viewState cleared inside commit; box already removed from maps
    if (currentLargeBoxId === id) exitToCanvas();
    renderCanvas();
  }

  // BX-DEV-111j: Cross-tab delete protection — validate currentLargeBoxId still exists before any inner operation.
  export function validateCurrentBox() {
    if (!currentLargeBoxId) return false;
    const lb = getLargeBox(currentLargeBoxId);
    if (!lb) {
      // Large box was deleted on another tab — block operations and warn
      showBoxDeletedWarning(currentLargeBoxId);
      setCurrentLargeBoxId(null);
      exitToCanvas();
      return false;
    }
    return lb;
  }

  export function showBoxDeletedWarning(staleId) {
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

  export function addSmallBox(e) {
    if (e && e.preventDefault) e.preventDefault(); // BX-DEV-140c: prevent Chrome click focus-steal
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
    smallBoxById.set(lb.id + ":" + lb.children[lb.children.length - 1].id, lb.children[lb.children.length - 1]);
    saveLayout();
    renderInnerSurface(lb);
  }

  export function addSmallBoxAt(clientX, clientY) {
    // BX-DEV-112D: cooldown bridges the empty-state CTA click path and this dblclick path
    if (isWithinCreateCooldown(clientX, clientY)) { debug('addSmallBoxAt suppressed: create cooldown'); return; }
    markCreate(clientX, clientY);
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
    smallBoxById.set(lb.id + ":" + lb.children[lb.children.length - 1].id, lb.children[lb.children.length - 1]);
    // BX-DEV-106: elastic-snap to avoid overlapping existing small boxes
    const others = lb.children.filter(s => s.id !== lb.children[lb.children.length - 1].id).map(s => ({ x: s.x, y: s.y, width: s.width || SMALL_DEF_W, height: s.height || SMALL_DEF_H }));
    const last = lb.children[lb.children.length - 1];
    const unsnapped = elasticSnap({ x: snapped.x, y: snapped.y }, SMALL_DEF_W, SMALL_DEF_H, others, INNER_GRID, snapInner);
    last.x = Math.max(0, unsnapped.x); last.y = Math.max(0, unsnapped.y);
    saveLayout();
    renderInnerSurface(lb);
  }

  export function deleteSmallBox(largeId, smallId) {
    openConfirmModal('small', smallId, largeId);
  }

  export function _execDeleteSmallBox(largeId, smallId) {
    const lb = getLargeBox(largeId);
    if (!lb) return;
    const result = commit("deleteSmallBox", { largeId, smallId }, { save: true });
    if (result && result.skipped) return;
    disposeAllConns(); // BX-DEV-137+++: clear stale lines before re-rendering inner surface
    renderInnerSurface(lb);
    renderConnections();
  }

  // BX-DEV-122: sync settings-DOM from layout.settings. Used by openSettingsModal init
  // AND by applyExternalLayout so cross-tab settings writes (e.g. urlOpenMode flip) reflect
  // in the local settings modal even before the user reopens it. Without this, the local
