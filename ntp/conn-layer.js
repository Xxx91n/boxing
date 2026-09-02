/** Boxing — connection-line layer module (ticket 12, architecture-recovery).
 * Extracted verbatim from render.js (ticket 08): line pool (acquireLineEl/recycleLineEl),
 * SVG overlay + connection render/refresh, viewport culling + LOD stroke (ADR-0004),
 * DSU groups + star-mark group drag with grid-hash elastic snap (ADR-0013), connect-mode drag.
 * Scheduling state (__linePool/__connRefreshRAF/__dsuDirty + LINE_POOL_CAP/MAX_CONNECTIONS) moved
 * here from state.js and kept MODULE-PRIVATE — not shared cross-module (ticket 12 delta).
 * Cross-scope deps (render.js commit/getLargeBox/getSmallBox/getInnerSurfaceContent + ntp.js
 * DOM refs/log fns/rebuildBoxMaps) injected once via initConnFacade() before any runtime call. */
import {
  layout,
  connLines, connById, dirtyConns, connIdx, boxConnIdx,
  boxGroupId, groupMembers, groupStar,
  canvasConnSvg, innerConnSvg, connectMode, provisionalLine, provisionalGhost, selectedConnId,
  setCanvasConnSvg, setInnerConnSvg, setConnectMode, setProvisionalLine, setProvisionalGhost, setSelectedConnId,
  canvasZoom, innerZoom, canvasPanX, canvasPanY, innerPanX, innerPanY,
} from './state.js';
import { CANVAS_GRID, INNER_GRID, LARGE_DEF_H, LARGE_DEF_W, SMALL_DEF_H, SMALL_DEF_W, buildSpatialGrid, elasticSnap, largeKey, smallKey, snapCanvas, snapInner } from './utils.js';
import { saveLayout, saveLayoutDebounced } from './storage.js';

// Scheduling state — moved from state.js (ticket 12). Module-private, NOT exported.
const MAX_CONNECTIONS = 5000; // ponytail: bounded; upgrade to pagination past 5k
const LINE_POOL_CAP = 64; // ponytail: cap prevents unbounded growth; 64 is generous for typical layouts.
const __linePool = []; // ADR-0013 BX-PERF-002: SVG <line> element pool
let __dsuDirty = true; // ADR-0007 Q4b: rebuild DSU only when dirty
let __connRefreshRAF = 0; // rAF id for scheduleConnRefresh batching
function setDsuDirty(v) { __dsuDirty = v; }
function setConnRefreshRAF(v) { __connRefreshRAF = v; }

// Injected render.js/ntp.js-scope deps (set once at boot, before any runtime call).
let commit, getLargeBox, getSmallBox, getInnerSurfaceContent, rebuildBoxMaps,
    debug, debugSampled, canvasSurface, canvasContainer, innerCanvas, innerSurface;
export function initConnFacade(deps) {
  commit = deps.commit; getLargeBox = deps.getLargeBox; getSmallBox = deps.getSmallBox;
  getInnerSurfaceContent = deps.getInnerSurfaceContent; rebuildBoxMaps = deps.rebuildBoxMaps;
  debug = deps.debug; debugSampled = deps.debugSampled;
  canvasSurface = deps.canvasSurface; canvasContainer = deps.canvasContainer;
  innerCanvas = deps.innerCanvas; innerSurface = deps.innerSurface;
}

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
      const _isc = getInnerSurfaceContent(); return innerConnSvg ? innerConnSvg : (_isc ? getConnSvg(_isc, innerConnSvg) : null);
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
    const _isc2 = getInnerSurfaceContent(); if (_isc2) setInnerConnSvg(getConnSvg(_isc2, innerConnSvg));
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
    const surface = isInner ? getInnerSurfaceContent() : canvasSurface;
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
