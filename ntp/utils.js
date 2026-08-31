/** Boxing — pure utility functions + geometry constants extracted from ntp.js (ticket 05, architecture-recovery).
 * Zero storage/DOM side effects: snapping, collision, layout data shaping, URL normalization, tiered key builders.
 * Blocks byte-verbatim from ntp.js (indentation preserved).
 * Purity exclusions (audited, see issues/05): makeId (session writerId + idSequence), mergeConcurrentLayout (reads layout/clearedTombstones identity),
 * clampCanvasPan/clampInnerPan (live DOM + size state), isSafeExtUrl/ensureHttpsUrl (window.__boxingIsSafeExtUrl entry contract). */

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

export { CANVAS_GRID, INNER_GRID, LARGE_DEF_H, LARGE_DEF_W, LARGE_MIN_H, LARGE_MIN_W, MAX_ZOOM, MIN_ZOOM, RESIZE_SNAP, SMALL_DEF_H, SMALL_DEF_W, SMALL_MIN_H, SMALL_MIN_W, SPATIAL_THRESHOLD, ZOOM_STEPS, buildSpatialGrid, clampToEdge, elasticSnap, querySpatialNearby, rectsOverlap, snapCanvas, snapInner };
