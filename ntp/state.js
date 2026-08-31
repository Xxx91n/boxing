// Boxing — shared mutable state module (ticket 06, architecture-recovery).
// Single holder of the ticket-02 callgraph §5 "state 模块 (票06)" bucket plus the
// handoff-named suppression-flag family (lastClick*/lastDrag*/lastEnter*/suppress*).
//
// Decision (issues/06 item 2): (b) state module singleton via ESM live bindings — NOT (a) injection. Reasons:
//   1. ~55 symbols × 700+ read sites: injection rewrites reads too; live bindings leave every read site untouched.
//   2. Module graph evaluates once — exactly one copy exists (research-report.md: 两模块各持副本 = 各活各的 is the forbidden mode).
//   3. Imports initialize before the entry body runs — no init-order hazard for handlers.
//   4. Leaf module (zero imports): no cycles; tickets 07/08 import these same singletons.
// Writes must go through the set*() functions (imported bindings are read-only in ESM).
// Lines below were extracted verbatim from ntp.js (WORKFLOW §6 byte-exact rule, assertion-guarded node script).

  export const MAX_LARGE_BOXES = 1000;
  export const MAX_SMALL_BOXES = 500;
  export const MAX_BOOKMARKS = 50;

  export let __sizeObserver = null;

  export let layout = {
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

  export let currentLargeBoxId = null;
  export let canvasZoom = 1.0;
  export let innerZoom = 1.0;
  // Obsidian-style pan state
  export let canvasPanX = 0, canvasPanY = 0;
  export let innerPanX = 0, innerPanY = 0;
  // manual drag state
  export let dragState = null;
  // resize state
  export let resizeState = null;
  // canvas pan state (left-drag empty area)
  export let panState = null;
  // double-click detection
  export let lastClickTime = 0;
  export let lastClickTarget = null;
  export let lastDragEndTime = 0;  // skip click if within 60ms of drag end (BX-DEV-065)
export let lastEnterLargeBoxAt = 0;  // BX-DEV-112C: time of last enterLargeBox via click/dblclick — used to suppress stray inner dblclick
export let suppressInnerDblClickOnce = false;  // BX-DEV-112C: one-shot flag set by enterLargeBox to swallow the next inner dblclick
  export let lastDragEndId = null;  // box id just dragged - clears barDownWasDragZone on next click (BX-DEV-077)

  // header auto-hide state (must be declared before functions that reference it)
  export let headerPinned = true;  // BX-DEV-111: set after loadLayout reads persisted value
  export let scrollTimeout;

  export const writerId = crypto.randomUUID ? crypto.randomUUID() : `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  export let idSequence = 0;

  export let storageWriteChain = Promise.resolve();
  export let applyingExternalLayout = false;
  export let saveDebounceTimer = null;
  export const MAX_TOMBSTONES = 2000;

  // mid-pan no longer overwrites a different box's pending write.
  export const __viewStatePersistTimers = new Map();
  export const __selfLastWriteTs = new Map();

  // -- box index maps (ADR-0007 Phase 1.3: O(1) lookups) --
  export const boxById = new Map();       // largeBoxId -> box object
  export const smallBoxById = new Map();  // smallKey ("largeId:smallId") -> small box object

  export const MAX_CONNECTIONS = 5000; // ponytail: bounded; upgrade to pagination past 5k

  export const connLines = new Map();          // connId -> SVG <line> element
  export const connById = new Map();            // connId -> connection object (O(1) lookup)
  export const dirtyConns = new Set();         // connIds needing path update
  export const connIdx = new Map();              // O(1) conn lookup by key-pair
  export const boxConnIdx = new Map();            // O(1) reverse: boxKey -> Set<connId>

  // ADR-0013 BX-PERF-002: SVG <line> element pool — recycle instead of createElementNS per render cycle.
  export const LINE_POOL_CAP = 64; // ponytail: cap prevents unbounded growth; 64 is generous for typical layouts.
  export const __linePool = [];

  // BX-DSU: Union-Find with path compression for O(α) group connectivity
  export const boxGroupId = new Map();      // boxKey -> groupId (DSU find root)
  export const groupMembers = new Map();    // groupId -> Set<boxKey> (all members)
  export const groupStar = new Set();       // boxKeys marked as parent (starred)
  export let clearedTombstones = new Set(); // BX-144: in-memory set of tombstone keys this tab has explicitly cleared (per-tab, never persisted)
  export const groupIdx = new Map();       // kept for compat: parentId -> group object
  export let __dsuDirty = true;              // ADR-0007 Q4b: rebuild DSU only when dirty (replaces __dsuDirty)
  export let canvasConnSvg = null;     // SVG overlay inside canvasSurface
  export let innerConnSvg = null;     // SVG overlay inside innerSurfaceContent
  export let connectMode = null;               // { fromId, fromEl, fromSide } | null
  export let provisionalLine = null;        // temp SVG <line> during drag
  export let provisionalGhost = null;      // { x, y } logical coords of drag endpoint

  // Single config field layout.settings.connDeleteAction drives which gesture deletes a line.
  export let selectedConnId = null;

  export let __connRefreshRAF = 0;

  export let __nextGroupId = 1;

  // popups so that pan/zoom/box-drag can reposition them to follow the attached small box.
  export const __popupTrackers = new Map(); // DOMNode -> reposition fn

  export let confirmCallback = null;

// ── setters: the only writers; imported bindings are read-only in ESM ──
export function setLayout(v) { layout = v; }
export function setCurrentLargeBoxId(v) { currentLargeBoxId = v; }
export function setCanvasZoom(v) { canvasZoom = v; }
export function setInnerZoom(v) { innerZoom = v; }
export function setCanvasPanX(v) { canvasPanX = v; }
export function setCanvasPanY(v) { canvasPanY = v; }
export function setInnerPanX(v) { innerPanX = v; }
export function setInnerPanY(v) { innerPanY = v; }
export function setDragState(v) { dragState = v; }
export function setResizeState(v) { resizeState = v; }
export function setPanState(v) { panState = v; }
export function setLastClickTime(v) { lastClickTime = v; }
export function setLastClickTarget(v) { lastClickTarget = v; }
export function setLastDragEndTime(v) { lastDragEndTime = v; }
export function setLastEnterLargeBoxAt(v) { lastEnterLargeBoxAt = v; }
export function setSuppressInnerDblClickOnce(v) { suppressInnerDblClickOnce = v; }
export function setLastDragEndId(v) { lastDragEndId = v; }
export function setHeaderPinned(v) { headerPinned = v; }
export function setScrollTimeout(v) { scrollTimeout = v; }
export function setIdSequence(v) { idSequence = v; }
export function setStorageWriteChain(v) { storageWriteChain = v; }
export function setApplyingExternalLayout(v) { applyingExternalLayout = v; }
export function setSaveDebounceTimer(v) { saveDebounceTimer = v; }
export function setClearedTombstones(v) { clearedTombstones = v; }
export function setDsuDirty(v) { __dsuDirty = v; }
export function setNextGroupId(v) { __nextGroupId = v; }
export function setCanvasConnSvg(v) { canvasConnSvg = v; }
export function setInnerConnSvg(v) { innerConnSvg = v; }
export function setConnectMode(v) { connectMode = v; }
export function setProvisionalLine(v) { provisionalLine = v; }
export function setProvisionalGhost(v) { provisionalGhost = v; }
export function setSelectedConnId(v) { selectedConnId = v; }
export function setConfirmCallback(v) { confirmCallback = v; }
export function setSizeObserver(v) { __sizeObserver = v; }
export function setConnRefreshRAF(v) { __connRefreshRAF = v; }
