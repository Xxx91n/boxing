/** Boxing — pure utility functions + geometry constants extracted from ntp.js (ticket 05, architecture-recovery).
 * Zero storage/DOM side effects: snapping, collision, layout data shaping, URL normalization, tiered key builders.
 * Blocks byte-verbatim from ntp.js (indentation preserved).
 * Purity exclusions (audited, see issues/05): makeId (session writerId + idSequence), mergeConcurrentLayout (reads layout/clearedTombstones identity),
 * clampCanvasPan/clampInnerPan (live DOM + size state), isSafeExtUrl/ensureHttpsUrl (window.__boxingIsSafeExtUrl entry contract).
 * Ticket 11 (architecture-recovery): zoomAtPoint moved verbatim from render.js (pure math; container rect via parameter, same accepted pattern as screenToWorld). */

  const CANVAS_GRID = 24;

  const INNER_GRID = 16;

  const RESIZE_SNAP = 5;

  const LARGE_DEF_W = 320, LARGE_DEF_H = 220;

  const SMALL_DEF_W = 300, SMALL_DEF_H = 340;

  const LARGE_MIN_W = 200, LARGE_MIN_H = 120;

  const SMALL_MIN_W = 180, SMALL_MIN_H = 200;

  const ZOOM_STEPS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5];

  const MIN_ZOOM = 0.3, MAX_ZOOM = 2.0;

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

  const SPATIAL_THRESHOLD = 32;

  function buildSpatialGrid(boxes) {
    if (!boxes || boxes.length < SPATIAL_THRESHOLD) return null;
    let maxW = 0, maxH = 0;
    for (const b of boxes) {
      maxW = Math.max(maxW, b.width || LARGE_DEF_W);
      maxH = Math.max(maxH, b.height || LARGE_DEF_H);
    }
    const cell = Math.max(32, Math.max(maxW, maxH) * 2);
    const grid = new Map();
    for (const b of boxes) {
      const bw = b.width || LARGE_DEF_W, bh = b.height || LARGE_DEF_H;
      const x0 = Math.floor(b.x / cell), y0 = Math.floor(b.y / cell);
      const x1 = Math.floor((b.x + bw) / cell), y1 = Math.floor((b.y + bh) / cell);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const key = cx + ":" + cy;
          let bucket = grid.get(key);
          if (!bucket) { bucket = []; grid.set(key, bucket); }
          bucket.push(b);
        }
      }
    }
    return { grid, cell };
  }

  function querySpatialNearby(spatial, x, y, w, h) {
    if (!spatial) return null;
    const { grid, cell } = spatial;
    const x0 = Math.floor(x / cell) - 1, y0 = Math.floor(y / cell) - 1;
    const x1 = Math.floor((x + w) / cell) + 1, y1 = Math.floor((y + h) / cell) + 1;
    const seen = new Set();
    const out = [];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const bucket = grid.get(cx + ":" + cy);
        if (!bucket) continue;
        for (const b of bucket) {
          if (seen.has(b)) continue;
          seen.add(b);
          out.push(b);
        }
      }
    }
    return out;
  }

  function elasticSnap(pos, w, h, others, grid, snapFn) {
    let { x, y } = pos;
    let maxIter = 50;
    let movedThisPass = true;
    // Build the spatial grid once per snap call when N is large; fall back to the full list below threshold.
    // Accept a pre-built spatial grid as the 7th arg to avoid O(n) rebuild per member in moveGroupTogether.
    const spatial = arguments.length > 6 ? arguments[6] : buildSpatialGrid(others);
    while (movedThisPass && maxIter-- > 0) {
      movedThisPass = false;
      const near = querySpatialNearby(spatial, x, y, w, h) || others;
      for (const other of near) {
        const ow = other.width || LARGE_DEF_W, oh = other.height || LARGE_DEF_H;
        if (!rectsOverlap({ x, y, w, h }, { x: other.x, y: other.y, w: ow, h: oh })) continue;
        const candidates = [
          { x: other.x + ow + grid, y },
          { x: other.x - w - grid, y },
          { x, y: other.y + oh + grid },
          { x, y: other.y - h - grid }
        ];
        let best = null, bestDist = Infinity;
        for (const c of candidates) {
          if (c.x < 0 || c.y < 0) continue;
          // check collisions against nearby set (or all when small N)
          const checkSet = querySpatialNearby(spatial, c.x, c.y, w, h) || others;
          const collides = checkSet.some(o =>
            rectsOverlap({ x: c.x, y: c.y, w, h }, { x: o.x, y: o.y, w: (o.width || LARGE_DEF_W), h: (o.height || LARGE_DEF_H) }));
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

  function mergeById(localItems, remoteItems, tombstones) {
    const local = (localItems || []).filter(item => item?.id && !tombstones.has(item.id));
    const known = new Set(local.map(item => item.id));
    for (const item of remoteItems || []) if (item?.id && !known.has(item.id) && !tombstones.has(item.id)) local.push(item);
    return local;
  }

  // Ticket 44 (spec #41): dark mode is a three-valued preference. This is the
  // single normalization helper used by the live read boundaries (loadSettings,
  // merge, save/persist) and effective-state derivation; migration output stays
  // byte-stable by design. Legacy boolean true/false maps to 'dark'/'light';
  // unknown values degrade to the default 'light'. Writes always store the string form.
  function normalizeDarkModePref(value) {
    if (value === true || value === 'dark') return 'dark';
    if (value === 'system') return 'system';
    return 'light';
  }

  function defaultLayout() {
   return {
      version: 3.5, schemaVersion: 1, boxes: [], nextLargeIndex: 1, connections: [], groups: [],
      settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: 'light', fontSize: 14, squareCorners: false, autoBackupInterval: 86400, lastBackupAt: Date.now(), headerPinned: true, syncProvider: 'local', urlOpenMode: 'sameTab', connDeleteAction: 'alt+click', theme: 'beige', webdavAllowPrivateHost: false, autoTitleEnabled: true, autoTitleRules: [ { pattern: 'https://github.com/*/*', type: 'first-two-paths' }, { pattern: 'https://*/*', type: 'domain-main' } ] }
    };
  }

  function migrateLayout(raw) {
    if (!raw) return defaultLayout();
    // v2 -> 3.5 expansion happens before the shared normalizer so the FIRST migrated
    // object is already complete. Previously this branch returned no connections,
    // groups or schemaVersion, and a crash-rescue write-back of that first pass could
    // persist the partial shape until some later load normalized it (issue #34).
    if (raw.version === 2) {
      raw = {
        version: 3.5,
        schemaVersion: 1,
        boxes: (raw.boxes || []).map(b => ({
          ...b, width: b.width || LARGE_DEF_W, height: b.height || LARGE_DEF_H,
          nextSmallIndex: (b.children?.length || 0) + 1,
          children: (b.children || []).map(s => ({
            ...s, width: s.width || SMALL_DEF_W, height: s.height || SMALL_DEF_H,
            pinned: s.pinned !== false, bookmarks: s.bookmarks || []
          }))
        })),
        nextLargeIndex: (raw.boxes?.length || 0) + 1,
        connections: Array.isArray(raw.connections) ? raw.connections : [],
        groups: Array.isArray(raw.groups) ? raw.groups : [],
        // Ticket 52: spread defaultLayout().settings so the v2 migration write path can
        // never persist a settings blob missing urlOpenMode (fresh default = sameTab);
        // an explicitly stored newTab still wins (user choice preserved).
        settings: { ...defaultLayout().settings, ...(raw.settings || {}), theme: raw.settings?.theme || 'beige' }
      };
    }
    // Data integrity — version >= 3 returns as-is; no data loss on downgrade.
    // Dark-mode preference normalization is deliberately NOT part of migration (spec
    // #41 keeps migration golden outputs stable): the live-layout read boundary
    // (loadSettings / mergeConcurrentLayout) accepts the legacy boolean, and every
    // write path stores the three-valued form. Unknown future versions (>= 4) are
    // still accepted to prevent upgrade-then-downgrade data loss.
    if (raw.version >= 3) {
      const defaults = defaultLayout();
      const result = {
        ...defaults,
        ...raw,
        schemaVersion: raw.schemaVersion || 1, // schema versioning for crash rescue
        boxes: Array.isArray(raw.boxes) ? raw.boxes : [],
        connections: Array.isArray(raw.connections) ? raw.connections : [],
        groups: [], // groups are no longer persisted
        settings: { ...defaults.settings, ...(raw.settings || {}) }
      };
    // One-time migration — restore box.isParent from old layout.groups, then discard
    if (!raw._meta || !raw._meta.__groupsMigrated) {
      if (Array.isArray(raw.groups) && raw.groups.length > 0) {
        for (const g of raw.groups) {
          // Legacy groups rows are untrusted input: a non-string parentId must be
          // skipped, not allowed to throw out of migrateLayout during boot.
          if (!g || typeof g.parentId !== 'string' || !g.parentId) continue;
          if (g.parentId.startsWith("large:")) {
            const lb = result.boxes.find(b => b.id === g.parentId.slice(6)); if (lb) lb.isParent = true;
          } else if (g.parentId.startsWith("small:")) {
            const sp = g.parentId.split(":");
            if (sp.length >= 3) { const lb2 = result.boxes.find(b => b.id === sp[1]);
              if (lb2) { const sc = lb2.children?.find(s => s.id === sp.slice(2).join(":")); if (sc) sc.isParent = true; } }
          }
        }
      }
      result._meta = result._meta || {}; result._meta.__groupsMigrated = true;
    }
    // Backfill connection.props for older layouts
    for (const c of result.connections) { if (c && c.props == null) c.props = {}; }
    return result;
    }
    return defaultLayout();
  }

  // Ticket 43 (spec D3): 判定"可读但结构损坏"的主键载荷。migrateLayout 对非法载荷会
  // 静默降级为 defaultLayout（无归档覆盖），故必须在迁移前用此判定拦截并走 fork 归档。
  // 合法载荷 = 对象 + 数字 version + boxes 数组；其余视为损坏。
  function isPlausibleLayout(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    if (typeof raw.version !== 'number') return false;
    if (!Array.isArray(raw.boxes)) return false;
    return true;
  }

  // Ticket 44 (spec D4): deep-equality with key-order tolerance — object key insertion
  // order drifts between export rounds (JSON.stringify keeps insertion order), so
  // identical boxes must never be reported as conflicts.
  function deepJsonEquals(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepJsonEquals(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i] || !deepJsonEquals(a[ka[i]], b[ka[i]])) return false;
    return true;
  }

  // Ticket 44 (spec D4): import = Raindrop-style append-merge (never overwrite, never
  // silently drop). Same-id boxes deep-equal -> skipped; same-id boxes divergent -> the
  // incoming whole subtree is returned as a conflict copy (caller archives it under
  // boxingLayout.conflict.<ts>), the local box stays verbatim on the canvas.
  // New ids append; connections union-dedup by from:to; settings stay local-authoritative
  // (user prefs are not data - replacing prefs is the explicit overwrite-restore mode).
  function mergeImportedLayout(local, incoming) {
    const boxes = (Array.isArray(local.boxes) ? local.boxes.slice() : []);
    const byId = new Map();
    for (const b of boxes) if (b && b.id) byId.set(b.id, b);
    const conflicts = [];
    let added = 0, skipped = 0;
    for (const ib of (incoming.boxes || [])) {
      if (!ib || typeof ib.id !== 'string') continue;
      const lb = byId.get(ib.id);
      if (!lb) { boxes.push(ib); byId.set(ib.id, ib); added++; continue; }
      if (deepJsonEquals(lb, ib)) { skipped++; continue; }
      conflicts.push(ib);
    }
    const connSet = new Set();
    const connections = [];
    for (const c of (local.connections || []).concat(incoming.connections || [])) {
      if (!c) continue;
      const key = (c.from || c.source || '') + ':' + (c.to || c.target || '');
      if (connSet.has(key)) continue;
      connSet.add(key);
      connections.push(c);
    }
    const merged = {
      ...local,
      boxes,
      connections,
      groups: [],
      schemaVersion: Math.max(local.schemaVersion || 1, incoming.schemaVersion || 1),
      nextLargeIndex: Math.max(local.nextLargeIndex || 1, incoming.nextLargeIndex || 1),
      settings: { ...local.settings },
    };
    return { merged, conflicts, stats: { added, conflicted: conflicts.length, skipped } };
  }

  function largeKey(id) { return 'large:' + id; }

  function smallKey(largeId, smallId) { return 'small:' + largeId + ':' + smallId; }

  function hexToRgbTriplet(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r + ', ' + g + ', ' + b;
  }

  // world-coord <-> screen-coord conversion
  function screenToWorld(clientX, clientY, container, panX, panY, zoom) {
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom
    };
  }

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

// Ticket 51 (spec ticket 51): export envelope unwrap. The default export is
// { _exportedAt, meta:{ schemaVersion, fullPackage, snapshots[], corrupt[], conflicts[] }, layout }
// (ticket 51 envelope); the full DR package additionally carries _bodies. Pure function: given a
// parsed export document, return the BARE layout payload the import pipeline understands —
// envelopes are unwrapped, legacy bare dumps pass through untouched, anything else returns null.
// Shared by the settings-ui import handler (live) and by pinned unit tests.
function unwrapExportEnvelope(data) {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data.boxes)) return data; // legacy bare dump
  if (data.meta && data.layout && typeof data.layout === "object" && !Array.isArray(data.layout)) {
    const inner = data.layout;
    if (Array.isArray(inner.boxes)) return inner; // envelope -> bare layout
  }
  return null;
}

// Numeric dot-separated version compare (v-prefix tolerated): -1/0/1.
function compareVersions(v1, v2) {
  const p1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export { CANVAS_GRID, INNER_GRID, LARGE_DEF_H, LARGE_DEF_W, LARGE_MIN_H, LARGE_MIN_W, MAX_ZOOM, MIN_ZOOM, RESIZE_SNAP, SMALL_DEF_H, SMALL_DEF_W, SMALL_MIN_H, SMALL_MIN_W, SPATIAL_THRESHOLD, ZOOM_STEPS, buildSpatialGrid, clampToEdge, deepJsonEquals, defaultLayout, elasticSnap, hexToRgbTriplet, isPlausibleLayout, largeKey, mergeById, mergeImportedLayout, migrateLayout, compareVersions, normalizeBookmarkUrl, normalizeDarkModePref, querySpatialNearby, unwrapExportEnvelope, rectsOverlap, screenToWorld, smallKey, snapCanvas, snapInner, zoomAtPoint };

// ─── Id-level three-way layout merge ──────────
// Implements the three-way-with-base plan, degrading to the
// two-way additive merge when no base). Industrial baseline: Joplin sync_items.base_*
// client-local common-ancestor + refresh-on-clean-sync, Syncthing/Dropbox conflict-
// copy semantics (ctx sources: atomcode-91-baseline, atomcode-merge-quality).
// Pure functions — no storage/DOM/i18n access (utils purity contract).

// Merge one large box's children array by child-box id. baseChildren = last agreed
// state; pass null (box the base never had) → additive two-way fallback, never worse
// than the old whole-array overwrite. Rules (id = small-box id):
//  - same id, equal → keep local verbatim;
//  - with base: the side that moved alone vs base is adopted silently (diff3);
//  - same id, true both-side divergence → local child stays on canvas, the cloud
//    child is returned as a child-level conflict copy (caller archives it);
//  - one side lacks a base-known child: pure deletion (other side unchanged vs
//    base) is honored; delete-vs-edit keeps the side that has content;
//  - new ids from either side are additive — this is the silent-swallow fix.
function mergeChildrenById(localChildren, cloudChildren, baseChildren) {
  const localArr = Array.isArray(localChildren) ? localChildren : [];
  const cloudArr = Array.isArray(cloudChildren) ? cloudChildren : [];
  const hasBase = Array.isArray(baseChildren);
  const byCloud = new Map();
  for (const s of cloudArr) if (s && s.id && !byCloud.has(s.id)) byCloud.set(s.id, s);
  const byBase = new Map();
  if (hasBase) for (const s of baseChildren) if (s && s.id && !byBase.has(s.id)) byBase.set(s.id, s);
  const children = [];
  const childConflicts = [];
  const seen = new Set();
  for (const s of localArr) {
    if (!s || !s.id) { if (s) children.push(s); continue; }
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const cs = byCloud.get(s.id);
    const bs = byBase.get(s.id);
    if (!cs) {
      // Cloud lacks it: local addition (keep) or cloud deletion (only base can tell).
      if (!bs || !deepJsonEquals(s, bs)) children.push(s); // else: pure cloud deletion honored
      continue;
    }
    if (deepJsonEquals(s, cs)) { children.push(s); continue; }
    if (bs) {
      const localChanged = !deepJsonEquals(s, bs);
      const cloudChanged = !deepJsonEquals(cs, bs);
      if (localChanged && !cloudChanged) { children.push(s); continue; }
      if (!localChanged && cloudChanged) { children.push(cs); continue; }
    }
    // Both sides edited differently (or two-way ambiguity): keep local, archive cloud.
    children.push(s);
    childConflicts.push(cs);
  }
  for (const s of cloudArr) {
    if (!s) continue;
    if (!s.id) {
      const dup = localArr.some((x) => x && !x.id && deepJsonEquals(x, s));
      if (!dup) children.push(s);
      continue;
    }
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const bs = byBase.get(s.id);
    if (!bs || !deepJsonEquals(s, bs)) children.push(s); // cloud addition, or cloud edit surviving a local delete
    // base-known + cloud unchanged = pure local deletion → honored (skip)
  }
  return { children, childConflicts };
}

// Three-way merge of the whole layout (cloud x local x optional base).
// cloud/local MUST be migrateLayout-ed; base is the raw syncBase slot payload as
// stored (already normalized when written) or null. Per box id: children ALWAYS
// merge via mergeChildrenById (children is no longer clobbered as one field);
// non-children fields use diff3 vs base when a base box exists, else the
// preserved field-count heuristic (>3 diverged fields -> local wins wholesale, else
// field merge local-wins; any divergence archives the cloud box verbatim as a
// conflict copy — never silent). Boxes absent from one side: additive by default;
// with base, a pure one-side deletion (other side unchanged vs base) is honored.
// Connections stay a from:to-union; settings stay local-authoritative (ticket-80
// semantics unchanged). nextLargeIndex/nextSmallIndex take max (id-collision guard).
function mergeLayoutThreeWay(cloud, local, base) {
  const cloudBoxes = Array.isArray(cloud.boxes) ? cloud.boxes : [];
  const localBoxes = Array.isArray(local.boxes) ? local.boxes : [];
  const hasBase = !!(base && Array.isArray(base.boxes));
  const baseById = new Map();
  if (hasBase) for (const b of base.boxes) if (b && b.id && !baseById.has(b.id)) baseById.set(b.id, b);
  const localById = new Map();
  for (const b of localBoxes) if (b && b.id && !localById.has(b.id)) localById.set(b.id, b);
  const boxConflicts = [];
  const childConflicts = [];
  const maxIdx = (...vs) => vs.reduce((a, v) => Math.max(a, Number(v) || 1), 1);
  const byId = new Map();
  for (const cb of cloudBoxes) if (cb) byId.set(cb.id, { ...cb });
  for (const lb of localBoxes) {
    if (!lb) continue;
    const existing = byId.get(lb.id);
    if (!existing) {
      const bb = baseById.get(lb.id);
      if (bb && deepJsonEquals(lb, bb)) continue; // cloud deleted it, local unchanged -> honor
      byId.set(lb.id, { ...lb });
      continue;
    }
    const bb = baseById.get(lb.id);
    const baseChildArr = bb ? (Array.isArray(bb.children) ? bb.children : []) : null;
    const childMerge = mergeChildrenById(lb.children, existing.children, baseChildArr);
    for (const cs of childMerge.childConflicts) {
      childConflicts.push({ parentId: lb.id, parentTitle: lb.title != null ? lb.title : existing.title, child: cs });
    }
    let box;
    if (bb) {
      // diff3 per field: adopt the side that moved vs base; both moved differently
      // -> local wins the main key and the cloud box is archived verbatim.
      const mergedBox = { ...existing };
      let conflicted = false;
      const fieldKeys = new Set([...Object.keys(lb), ...Object.keys(existing)]);
      for (const key of fieldKeys) {
        if (key === 'children') continue;
        const inL = Object.prototype.hasOwnProperty.call(lb, key);
        const lv = inL ? lb[key] : undefined;
        const cv = existing[key];
        const bv = bb[key];
        const localChanged = !deepJsonEquals(lv, bv);
        const cloudChanged = !deepJsonEquals(cv, bv);
        if (localChanged && !cloudChanged) { if (inL) mergedBox[key] = lv; else delete mergedBox[key]; }
        else if (!localChanged && cloudChanged) { /* cloud moved alone - spread already carries it */ }
        else if (localChanged && cloudChanged && !deepJsonEquals(lv, cv)) {
          conflicted = true;
          if (inL) mergedBox[key] = lv; else delete mergedBox[key];
        }
      }
      if (conflicted) boxConflicts.push({ ...existing });
      box = mergedBox;
    } else {
      // No base for this box: legacy ticket-44 heuristic on non-children fields.
      // nextSmallIndex is an auto-increment counter — already unified via maxIdx
      // below, so a difference here is not a user-data conflict (AC1/AC2 fix).
      // Only keys present on BOTH sides can diverge: page init/migrate may inject
      // bookkeeping fields (isParent, etc.) on one side only — those are not
      // user-data conflicts and must not inflate boxConflicts (ticket 91 CI).
      const divergedFields = [];
      const fieldKeys = new Set([...Object.keys(lb), ...Object.keys(existing)]);
      for (const key of fieldKeys) {
        if (key === 'children' || key === 'nextSmallIndex') continue;
        if (!Object.prototype.hasOwnProperty.call(lb, key)) continue;
        if (!Object.prototype.hasOwnProperty.call(existing, key)) continue;
        if (JSON.stringify(existing[key]) !== JSON.stringify(lb[key])) divergedFields.push(key);
      }
      if (divergedFields.length > 0) boxConflicts.push({ ...existing });
      box = divergedFields.length > 3 ? { ...lb } : { ...existing, ...lb };
    }
    // layout-bypass-allow: pure-merge-output - leaf module mergeSmallBoxChildren returns fresh arrays (expires:2027-03-31; ticket:108)
    box.children = childMerge.children;
    box.nextSmallIndex = bb
      ? maxIdx(lb.nextSmallIndex, existing.nextSmallIndex, bb.nextSmallIndex)
      : maxIdx(lb.nextSmallIndex, existing.nextSmallIndex);
    byId.set(lb.id, box);
  }
  if (hasBase) {
    // Honor pure local deletions of cloud-side boxes (cloud unchanged vs base).
    for (const id of Array.from(byId.keys())) {
      if (localById.has(id)) continue;
      const bb = baseById.get(id);
      if (bb && deepJsonEquals(byId.get(id), bb)) byId.delete(id);
    }
  }
  const connSet = new Set();
  const mergedConns = [];
  for (const c of (cloud.connections || []).concat(local.connections || [])) {
    if (!c) continue;
    const key = (c.from || c.source || '') + ':' + (c.to || c.target || '');
    if (!connSet.has(key)) { connSet.add(key); mergedConns.push(c); }
  }
  const merged = {
    ...cloud,
    ...local,
    boxes: Array.from(byId.values()),
    connections: mergedConns,
    groups: [], // runtime mirror only
    schemaVersion: Math.max(cloud.schemaVersion || 1, local.schemaVersion || 1),
    nextLargeIndex: maxIdx(cloud.nextLargeIndex, local.nextLargeIndex),
    settings: { ...cloud.settings, ...local.settings },
    _meta: { ...local._meta, updatedAt: Date.now() },
  };
  return { merged, conflicts: boxConflicts, childConflicts, stats: { boxes: merged.boxes.length, boxConflicts: boxConflicts.length, childConflicts: childConflicts.length, base: hasBase } };
}

// ── Issue #54 (#53 D2/D3): same-id conflict comparison ───────────────────────
// The archive stores the losing subtree verbatim (storage.archiveConflictLayouts ->
// raw.boxes) while the canvas keeps its own version of those same ids. This is the
// read half of "keep current / adopt copy": for objects BOTH sides still have, report
// only the user-editable fields that actually differ, and carry the exact writes that
// adopting the copy would produce. Pure — never touches layout, storage or the DOM.
//
// Field map (the N2 detail #53 left to this ticket, derived from what the UI can
// already edit: inline title, drag/resize, pin, hover-expand and the star):
//   boxes    — title, position (x+y), size (width+height), pinned, collapseHover, isParent
//   bookmarks — title, url
// Geometry is grouped x/y and width/height because a half-adopted box would land on top
// of its neighbours. Internal state stays out: ids, nextSmallIndex/nextLargeIndex
// counters, children/bookmarks membership (adding copy-only objects is #55), _meta,
// per-box view state and settings. Nothing here can express "edit raw JSON".
const CONFLICT_BOX_FIELDS = [
  { key: 'title', kind: 'text', labelKey: 'dataConflictFieldTitle' },
  { key: 'position', kind: 'num', fields: ['x', 'y'], labelKey: 'dataConflictFieldPosition' },
  { key: 'size', kind: 'num', fields: ['width', 'height'], labelKey: 'dataConflictFieldSize' },
  { key: 'pinned', kind: 'bool', labelKey: 'dataConflictFieldPinned' },
  // collapseHover stores the negation of the user-facing switch, so the displayed value
  // is flipped while the write stays on the real field.
  { key: 'autoExpand', kind: 'bool', field: 'collapseHover', negate: true, labelKey: 'autoExpand' },
  { key: 'star', kind: 'bool', field: 'isParent', labelKey: 'dataConflictFieldStar' },
];
const CONFLICT_BOOKMARK_FIELDS = [
  { key: 'title', kind: 'text', labelKey: 'dataConflictFieldTitle' },
  { key: 'url', kind: 'text', labelKey: 'dataConflictFieldUrl' },
];

function conflictSymbolValue(bool, negate) {
  const shown = negate ? !bool : bool;
  return shown ? '✓' : '–';
}

// One descriptor -> { token, entry }. The token always describes the CURRENT side
// (it feeds the staleness signature), the entry only exists when the two sides differ.
function probeConflictField(cur, copy, spec, basePath) {
  const path = basePath + '#' + spec.key;
  const field = spec.field || spec.key;
  if (spec.kind === 'bool') {
    const cv = Boolean(cur[field]);
    const pv = Boolean(copy[field]);
    const entry = cv === pv ? null : {
      key: spec.key, labelKey: spec.labelKey, path,
      current: conflictSymbolValue(cv, spec.negate),
      copy: conflictSymbolValue(pv, spec.negate),
      writes: [{ field, value: pv }],
    };
    return { token: path + '=' + cv, entry };
  }
  if (spec.kind === 'num') {
    const keys = spec.fields || [field];
    // A geometry group is atomic: adopting x without y would drop the box on top of its
    // neighbours, and a side that carries no finite number is not user data to adopt.
    if (!keys.every((k) => Number.isFinite(Number(cur[k])) && Number.isFinite(Number(copy[k])))) {
      return { token: path + '=n/a', entry: null };
    }
    const changed = keys.some((k) => Number(cur[k]) !== Number(copy[k]));
    const entry = changed ? {
      key: spec.key, labelKey: spec.labelKey, path,
      current: keys.map((k) => Math.round(Number(cur[k]))).join(', '),
      copy: keys.map((k) => Math.round(Number(copy[k]))).join(', '),
      writes: keys.map((k) => ({ field: k, value: Number(copy[k]) })),
    } : null;
    return { token: keys.map((k) => path + '.' + k + '=' + Number(cur[k])).join(','), entry };
  }
  const pv = copy[field];
  if (typeof pv !== 'string') return { token: path + '=n/a', entry: null };
  const cv = typeof cur[field] === 'string' ? cur[field] : '';
  const entry = cv === pv ? null : {
    key: spec.key, labelKey: spec.labelKey, path, current: cv, copy: pv,
    writes: [{ field, value: pv }],
  };
  return { token: path + '=' + cv, entry };
}

function collectConflictFields(cur, copy, specs, basePath, sig, stats) {
  const fields = [];
  for (const spec of specs) {
    const probed = probeConflictField(cur, copy, spec, basePath);
    sig.push(probed.token);
    if (probed.entry) { fields.push(probed.entry); stats.fieldDiffs++; }
  }
  return fields;
}

function conflictObjectLabel(obj) {
  return obj && typeof obj.title === 'string' ? obj.title : '';
}

// entry: a verbatim conflict body ({ ts, raw, truncated? } as stored by the facade).
// layout: the live layout the comparison runs against.
function diffConflictArchive(entry, layout) {
  const result = { applicable: false, reason: null, groups: [], stats: { objects: 0, fieldDiffs: 0, missing: 0 }, signature: '' };
  if (!entry || typeof entry !== 'object') { result.reason = 'unavailable'; return result; }
  // #53 D3: a body that was over the byte cap (truncated) or already pruned by rotation
  // never carries the archive content, so it must not be presented as applicable.
  if (entry.truncated) { result.reason = 'truncated'; return result; }
  if (!entry.raw || !Array.isArray(entry.raw.boxes)) { result.reason = 'unavailable'; return result; }
  result.applicable = true;
  const currentBoxes = Array.isArray(layout && layout.boxes) ? layout.boxes : [];
  const sig = [];
  for (const archived of entry.raw.boxes) {
    if (!archived || typeof archived.id !== 'string') continue;
    const basePath = 'large:' + archived.id;
    const cur = currentBoxes.find((b) => b && b.id === archived.id) || null;
    // Target gone: report it, offer nothing. Rebuilding a box the user deleted is out of
    // scope for adjudication (#53 D3), and the archive row itself is never touched.
    if (!cur) {
      sig.push(basePath + '=missing');
      result.stats.missing++;
      result.groups.push({ level: 'large', id: archived.id, title: conflictObjectLabel(archived), status: 'missing', fields: [], children: [] });
      continue;
    }
    const group = { level: 'large', id: archived.id, title: conflictObjectLabel(archived), status: 'matched', fields: [], children: [] };
    group.fields = collectConflictFields(cur, archived, CONFLICT_BOX_FIELDS, basePath, sig, result.stats);
    result.stats.objects++;
    const currentChildren = Array.isArray(cur.children) ? cur.children : [];
    for (const archivedChild of (Array.isArray(archived.children) ? archived.children : [])) {
      if (!archivedChild || typeof archivedChild.id !== 'string') continue;
      const childBase = 'small:' + archived.id + ':' + archivedChild.id;
      const curChild = currentChildren.find((s) => s && s.id === archivedChild.id) || null;
      // A child the canvas does not have is either copy-only (#55 adds it) or deleted
      // later; neither is a field adjudication, so it stays off the list entirely.
      if (!curChild) continue;
      const child = { level: 'small', id: archivedChild.id, title: conflictObjectLabel(archivedChild), status: 'matched', fields: [], bookmarks: [] };
      child.fields = collectConflictFields(curChild, archivedChild, CONFLICT_BOX_FIELDS, childBase, sig, result.stats);
      result.stats.objects++;
      const currentBookmarks = Array.isArray(curChild.bookmarks) ? curChild.bookmarks : [];
      for (const archivedBm of (Array.isArray(archivedChild.bookmarks) ? archivedChild.bookmarks : [])) {
        if (!archivedBm || typeof archivedBm.id !== 'string') continue;
        const bmBase = childBase + ':' + archivedBm.id;
        const curBm = currentBookmarks.find((b) => b && b.id === archivedBm.id) || null;
        if (!curBm) continue;
        const bm = { level: 'bookmark', id: archivedBm.id, title: conflictObjectLabel(archivedBm), status: 'matched', fields: [] };
        bm.fields = collectConflictFields(curBm, archivedBm, CONFLICT_BOOKMARK_FIELDS, bmBase, sig, result.stats);
        result.stats.objects++;
        child.bookmarks.push(bm);
      }
      group.children.push(child);
    }
    result.groups.push(group);
  }
  result.signature = sig.join('|');
  return result;
}

// Selections are the field paths the user moved to "adopt copy"; everything else keeps
// the current value by construction (no write is emitted for it).
function planConflictApply(diff, selectedPaths) {
  const selected = new Set(selectedPaths || []);
  const ops = [];
  if (!diff || !Array.isArray(diff.groups)) return ops;
  for (const group of diff.groups) {
    if (group.status !== 'matched') continue;
    const push = (target, fields, level, smallId, bmId) => {
      for (const field of fields || []) {
        if (!selected.has(field.path)) continue;
        for (const write of field.writes) {
          ops.push({ level, largeId: group.id, smallId: smallId || null, bmId: bmId || null, field: write.field, value: write.value });
        }
      }
    };
    push(group, group.fields, 'large');
    for (const child of group.children || []) {
      push(child, child.fields, 'small', child.id);
      for (const bm of child.bookmarks || []) push(bm, bm.fields, 'bookmark', child.id, bm.id);
    }
  }
  return ops;
}

export { mergeChildrenById, mergeLayoutThreeWay, diffConflictArchive, planConflictApply };
