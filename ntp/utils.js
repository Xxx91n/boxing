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
    // ADR-0007 Q3b: build spatial once per snap call when N large; fall back to full list below threshold.
    // ADR-0013 BX-PERF-001: accept pre-built spatial grid as 7th arg to avoid O(n) rebuild per member in moveGroupTogether.
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

  function defaultLayout() {
   return {
      version: 3.5, schemaVersion: 1, boxes: [], nextLargeIndex: 1, connections: [], groups: [],
      settings: { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14, squareCorners: false, autoBackupInterval: 86400, headerPinned: true, syncProvider: 'local', urlOpenMode: 'sameTab', connDeleteAction: 'alt+click', theme: 'beige' }
    };
  }

  function migrateLayout(raw) {
    if (!raw) return defaultLayout();
    // BX-DEV-085: Data integrity — version >= 3 returns as-is; no data loss on downgrade.
    // Unknown future versions (>= 4) are still accepted to prevent upgrade-then-downgrade data loss.
    if (raw.version >= 3) {
      const defaults = defaultLayout();
      const result = {
        ...defaults,
        ...raw,
        schemaVersion: raw.schemaVersion || 1, // ADR-0009: schema versioning for crash rescue
        boxes: Array.isArray(raw.boxes) ? raw.boxes : [],
        connections: Array.isArray(raw.connections) ? raw.connections : [],
        groups: [], // ADR-0007 Q1: groups no longer persisted
        settings: { ...defaults.settings, ...(raw.settings || {}) }
      };
    // ADR-0007 Q1: one-time migration — restore box.isParent from old layout.groups, then discard
    if (!raw._meta || !raw._meta.__groupsMigrated) {
      if (Array.isArray(raw.groups) && raw.groups.length > 0) {
        for (const g of raw.groups) {
          if (!g || !g.parentId) continue;
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
    // ADR-0007 Q4c: backfill connection.props for older layouts
    for (const c of result.connections) { if (c && c.props == null) c.props = {}; }
    return result;
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
       settings: Object.assign(raw.settings || { selectedLanguage: 'en', rememberLastPos: true, zoomLevel: 1.0, darkMode: false, fontSize: 14, syncProvider: 'local' }, { theme: raw.settings?.theme || 'beige' })
      };
    }
    return defaultLayout();
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

export { CANVAS_GRID, INNER_GRID, LARGE_DEF_H, LARGE_DEF_W, LARGE_MIN_H, LARGE_MIN_W, MAX_ZOOM, MIN_ZOOM, RESIZE_SNAP, SMALL_DEF_H, SMALL_DEF_W, SMALL_MIN_H, SMALL_MIN_W, SPATIAL_THRESHOLD, ZOOM_STEPS, buildSpatialGrid, clampToEdge, defaultLayout, elasticSnap, hexToRgbTriplet, largeKey, mergeById, migrateLayout, normalizeBookmarkUrl, querySpatialNearby, rectsOverlap, screenToWorld, smallKey, snapCanvas, snapInner, zoomAtPoint };
