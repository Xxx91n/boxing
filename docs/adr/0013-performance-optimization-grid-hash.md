# ADR-0013: Performance Optimization — Grid Hash Spatial Index

## Status
Proposed (2026-08-15) — not yet implemented

## Context
The grill performance optimization session identified moveGroupTogether (ntp.js:1923) as the single confirmed performance hotspot. It runs O(m x n) per drag frame: for each group member, it calls lasticSnap against all non-member boxes to handle collision avoidance. With groups of 5+ boxes and 50+ total boxes, this becomes 250+ collision checks per mousemove frame.

All other areas investigated (saveLayout serialization, event listeners, renderCanvas DOM diff, rAF batching, WeakMap caches) were confirmed as NOT bottlenecks:
- saveLayout: cold-path only (drag end, create/delete), 120ms debounced, 30KB << 5MB quota
- Event listeners: 154 add / 30 remove, but dynamic listeners GC by innerHTML='', popup/drag listeners properly removed -- no leak
- renderCanvas DOM diff: risk to multi-tab sync semantics (9 callers depend on clean DOM after rebuild) -- deferred
- rAF batching: adds 1-frame latency, violates follow-hand UX -- not needed
- WeakMap caches: boxMidPoint is O(1) already, cache miss during drag = low value -- not needed

## Decision
**Phase 1: Grid hash spatial index for elasticSnap collision queries.**

Replace the linear scan in moveGroupTogether with a grid-based spatial index:
- Cell size = 2x max box dimension (GDevelop pattern, already used in elasticSnap spatial hash >=32 threshold)
- Build the grid at drag-start (O(n)), query only neighboring cells during drag (O(k) where k = boxes in adjacent cells, typically 0-5)
- Rebuild grid only when box positions change outside drag (markDsuDirty pattern)
- Invalidation: on drag end, if box moved, mark grid dirty; next drag-start rebuilds

**Phase 2 (deferred): SVG line pooling for renderConnections.**
Pool removed <line> SVG elements in a Map<poolKey, Element[]>. When renderConnections needs a new line, check pool first. Only applies to renderConnections -- renderCanvas full rebuild semantics unchanged (preserves multi-tab sync safety).

**Not doing (YAGNI confirmed by code analysis):**
- renderCanvas DOM diff (Q3=A chose B instead -- multi-tab sync risk)
- rAF batching for mousemove (Q4=C -- adds latency, not needed)
- WeakMap geometry caches (Q4=C -- boxMidPoint is O(1))
- saveLayout incremental storage (Q5=C -- cold path, within quota)
- Event listener audit (no leak found)

## Constraints (MUST NOT violate)
| Constraint | Reason |
|---|---|
| BX-EXPLORE-005 | Drag uses left/top only, NEVER translate3d() |
| BX-EXPLORE-006 | NEVER will-change:transform/translateZ(0) on boxes -- Chrome font blur |
| BX-EXPLORE-007 | mousemove hot path MUST use O(1) Map lookups |
| BX-EXPLORE-008 | pan/zoom MUST call scheduleConnRefresh(all conn ids) |
| Critical Lesson #10 | O(1) Map/Set lookups in hot-path, never .find() |
| Critical Lesson #11 | DSU rebuild gated behind __dsuDirty, never on mousemove |
| Critical Lesson #12 | moveGroupTogether is O(m x n) -- this ADR fixes it with grid hash |

## Industry Research (exa + pplx kimi)
- **tldraw**: R-tree (RBush) for spatial indexing -- O(log n) queries, buildFromScratch on page change, processIncrementalUpdate for same-page, hit-testing skipped during camera movement, dispose() clears R-tree. v4.4.0 release notes confirm R-tree for O(log n) shape queries.
- **Excalidraw**: WeakMap for per-element geometry caching (auto GC on deletion), single-entry hit cache during drag, AABB bounds intersect first then precise detection, drag mutates coords via scene.mutateElement -- no DOM recreation.
- **tldraw culling**: shapes outside viewport get display:none, stay in store. getEfficientZoomLevel() freezes zoom >500 shapes during camera movement.
- **tldraw z-index**: CSS z-index (DOM order stays stable in ID order) -- avoids expensive reflows. Boxing already uses this pattern (BX-DEV-014: SVG z-index:0 below boxes).
- Boxing uses <200 boxes -> grid hash sufficient. R-tree would be overkill (ponytail).

## Consequences
- Grid build at drag-start: O(n) one-time cost per drag -- negligible
- Grid query during drag: O(k) per member, k = 0-5 neighboring boxes -- massive improvement over O(n)
- Memory: Map<cellKey, Set<boxId>> -- ~n entries, ~same as existing boxById Map
- Multi-tab sync: grid invalidated on applyExternalLayout (markGridDirty alongside markDsuDirty)
- No risk to renderCanvas semantics or multi-tab sync safety

## Implementation Plan
1. Add __spatialGrid Map + __spatialGridDirty flag alongside existing __dsuDirty pattern
2. uildSpatialGrid() -- rebuilds grid from layout.boxes positions, called when dirty
3. querySpatialGrid(x, y, w, h, margin) -- returns Set of box IDs in overlapping cells
4. Modify lasticSnap to accept grid-based candidates instead of others array
5. Modify moveGroupTogether to build grid once at drag-start, query per member
6. Add markSpatialGridDirty() calls alongside existing markDsuDirty() call sites
7. Playwright test: verify drag performance with 50+ boxes and group of 10 (both chromium + firefox)
