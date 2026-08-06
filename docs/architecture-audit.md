# ADR-0007 implementation landed — see roadmap 落地状态 + CONTEXT Mutation API.

# Architecture Audit — Connection System & Data Structure Health

> Generated: 2026-08-04
> Method: grill-with-docs source-level analysis + pwm research (tldraw bindings, React Flow edges, Excalidraw arrow-binding)
> Scope: connection system coupling, data structure alignment, algorithm complexity

## Part 1: Bug Fix Retrospective — How Were Bugs Fixed, What Lessons to Codify

### 1.1 Bug Categories and Root Causes

| Bug Category | Root Cause | Fix Pattern | Lesson |
|---|---|---|---|
| Cross-tab resurrection (Bug 3+4) | `mergeConcurrentLayout` mergeByIdUnion re-adds deleted conns from remote | `markDeleted(connId)` tombstone before filter | Delete operations must tombstone, not just filter |
| Parent star lost after box delete | `_execDeleteLargeBox` didn't prune `layout.groups` member entries | Added `matchesDeletedKey` filter on groups + tombstone conn ids | Every delete path must clean ALL derived indices |
| DSU rebuild performance | `dsuRebuildFromConnections` called on every mousemove | `__dsuBuilt` lazy flag + `getGroupByParent` checks `__dsuBuilt` | DSU is O(n) rebuild — gate it behind a dirty flag |
| Viewport culling line vanish | `connSvgVisibleRect` didn't account for pan offset | World-coord cull: `[-panX/zoom, (-panY+h)/zoom]` | Cull in world coords, not screen coords |
| Lines appear above boxes | SVG `z-index:2` override during drag | Enforce `z-index:0` on conn-layer, `z-index:1` on boxes (BX-DEV-014) | Z-index is a layout invariant — never override per-state |
| Chrome font blur at low zoom | `will-change:transform` / `translateZ(0)` forces fixed-bitmap raster | Remove GPU hints, use `backface-visibility:hidden` instead | Chrome rasterizes will-change elements as fixed bitmaps |
| Jagged lines at low zoom | Fixed `geometricPrecision` at all zoom levels | Dynamic `shape-rendering`: `crispEdges` <0.5, `geometricPrecision` >=0.5 | shape-rendering must be zoom-adaptive |
| Connection not following drag | `refreshConnsForBoxSync` used `layout.connections.find()` O(n) | Use `boxConnIdx.get(boxKey)` O(1) reverse index | Hot-path lookups must use pre-built indices |
| Alt+Click delete needs two clicks | Hit area too small + early-return logic | Enlarge hit area (stroke-width + transparent padding) | Interaction hit areas need generous padding |
| Group move sends children flying | `moveGroupTogether` used raw delta without collision resolve | Per-member `elasticSnap` against out-of-group boxes | Group drag must resolve collisions per-member, not rigid translate |

### 1.2 Fix Pattern Taxonomy

**Pattern A: Tombstone-then-filter** — Every delete operation (box, connection, star) must:
1. `markDeleted(id)` to add to `layout._meta.deleted` tombstone set
2. Filter the array to remove the item
3. Clean ALL derived indices (`connById`, `boxConnIdx`, `connLines`, `groupStar`, `layout.groups`)
4. `dsuRebuildFromConnections()` to rebuild group connectivity
5. `saveLayoutDebounced()` to persist

**Pattern B: World-coordinate viewport culling** — Line visibility must be computed in world coordinates accounting for pan offset, not screen coordinates.

**Pattern C: O(1) hot-path lookups** — Any function called during `mousemove` must use Map/Set indices, never Array.find/filter.

**Pattern D: Lazy DSU rebuild** — DSU rebuild is O(n); gate behind `__dsuBuilt` dirty flag, rebuild only when connections change or on first access.

**Pattern E: Per-member collision resolution** — Group drag must resolve each member's position via `elasticSnap` against non-group obstacles, not rigid delta translate.

### 1.3 Lessons to Codify

1. **Every derived index is a liability.** When you add a new data structure (connById, boxConnIdx, groupStar, layout.groups), EVERY mutation path must update ALL of them. Missing one = bug. The tombstone mechanism mitigates this for cross-tab sync, but local mutations still need explicit cleanup.

2. **The tombstone system is the cross-tab delete contract.** `markDeleted` + `mergeByIdUnion` filter is the ONLY mechanism that prevents resurrection. Any new delete path must use it.

3. `dsuRebuildFromConnections` is the single source of truth for group connectivity. `layout.groups` is a compat shim rebuilt by `ensureGroups`. Never trust `layout.groups` without a DSU rebuild first.

4. **CSS invariants are load-bearing.** `z-index`, `will-change`, `shape-rendering`, `translate3d` vs `left/top` — each has a specific reason. Violating them causes visual regressions that are hard to debug.

5. **The code has a "fix one bug, introduce another" pattern** because mutation paths are scattered across `removeConnection`, `_execDeleteLargeBox`, `_execDeleteSmallBox`, `toggleStarMark` — each with its own cleanup logic. A single unified mutation API would eliminate this.

## Part 2: Data Structure Alignment & Decoupling Audit

### 2.1 Current Data Structures

```
layout (persisted to storage.local)
├── boxes: [{ id, x, y, w, h, title, isParent, autoExpand, viewState, children }]
│   └── children (small boxes): [{ id, x, y, w, h, title, isParent, bookmarks }]
├── connections: [{ id, from, to }]   ← persisted
├── groups: [{ parentId, members }]    ← compat shim, rebuilt by ensureGroups
├── settings: { connDeleteAction, darkMode, ... }
├── _meta: { deleted: { id: timestamp } }  ← tombstones
└── nextLargeIndex, nextSmallIndex

Runtime-only (not persisted):
├── connLines: Map<connId, SVGLineElement>
├── connById: Map<connId, Connection>
├── boxConnIdx: Map<boxKey, Set<connId>>
├── groupStar: Set<boxKey>
├── boxGroupId: Map<boxKey, rootKey>       ← DSU parent
├── groupMembers: Map<rootKey, Set<boxKey>> ← DSU children
└── __dsuBuilt: boolean
```

### 2.2 Alignment Issues

**Issue 1: `layout.groups` is a compat shim but still persisted and merged cross-tab.**
- `ensureGroups()` rebuilds it from `box.isParent` + DSU, overwriting stored value
- `mergeConcurrentLayout` merges it via `mergeByIdUnion` with `parentId` key
- `dsuRebuildFromConnections` reads it to restore `box.isParent` (BX-144 remote star adoption)
- This creates a circular dependency: groups are both derived (from DSU) and input (to DSU star restoration)

**Recommendation:** `layout.groups` should be read-only on load (for BX-144 migration) and never written to storage. `ensureGroups()` should produce a runtime-only `runtimeGroups` that is never persisted. This eliminates the merge-resurrection risk for groups entirely.

**Issue 2: `box.isParent` is the source of truth for star-mark, but `groupStar` Set is the runtime mirror.**
- `toggleStarMark` updates both `box.isParent` and `groupStar`
- `dsuReset` clears `groupStar` — but doesn't clear `box.isParent`
- `dsuRebuildFromConnections` restores `box.isParent` from `layout.groups` — but only for tombstone-clear keys
- If `dsuReset` runs without a subsequent `ensureGroups`, `groupStar` is empty but `box.isParent` may still be true

**Recommendation:** `box.isParent` should be the single source of truth. `groupStar` should be a computed view: `groupStar = new Set(boxes.filter(b => b.isParent).map(b => key(b)))`. `dsuReset` should NOT clear `groupStar` — it should be rebuilt from `box.isParent` after DSU rebuild.

**Issue 3: Tombstone set `_meta.deleted` grows unbounded.**
- `markDeleted` adds entries but they're never cleaned up except via `clearedTombstones` (per-tab, not persisted)
- Over time, `_meta.deleted` accumulates IDs of every deleted box/conn/bookmark
- This bloats the persisted layout and slows `mergeByIdUnion` (which checks every item against tombstones)

**Recommendation:** Add a tombstone GC: after `saveLayout` succeeds, trim `_meta.deleted` to entries newer than 24h. Cross-tab resurrection is only a risk during the sync window; old tombstones serve no purpose.

**Issue 4: `connection.from`/`to` use tiered keys (`large:L1`, `small:L1:S1`) but `layout.groups.members` uses the same keys.**
- The key format is undocumented in the persisted data
- Legacy connections may use raw IDs (`L1`) without the `large:` prefix
- `ensureConnArrays` filters invalid keys but doesn't normalize them

**Recommendation:** Add a migration step in `ensureConnArrays` that normalizes legacy raw-id connections to tiered keys. Document the key format in CONTEXT.md.

### 2.3 PWM Industrial Pattern Comparison

**tldraw binding model** (from tldraw bindings docs):
- Binding record: `{ id, typeName:'binding', type, fromId, toId, props, meta }`
- `props` stores binding-specific data (normalizedAnchor, isPrecise, etc.)
- Side effects: `onAfterChangeToShape` for position updates, `onBeforeDeleteToShape` for cascading deletion
- Store is the single source of truth; bindings are derived queries

**React Flow edge model** (from React Flow edge API):
- Edge: `{ id, source, target, sourceHandle, targetHandle, data, deletable, selectable, zIndex }`
- Edges are stored in a flat array; lookups via Map indices
- Delete is explicit: `onEdgesChange` with `remove` type
- No tombstone — deletion is immediate and atomic

**Excalidraw arrow-binding model**:
- Arrow element stores `startBinding`/`endBinding`: `{ elementId, focus, gap }`
- Binding is stored ON the arrow, not as a separate entity
- Deleting a bound element nullifies the binding (no resurrection risk)
- Group movement is computed from element positions, not a separate group structure

**Key insight:** All three industrial systems use a **single flat store** for entities (shapes/elements). Bindings/edges are either (a) a separate flat array with from/to references, or (b) embedded in the connecting element. None of them maintain a separate `groups` structure that's both derived and persisted — groups are always computed at query time.

**Boxing's deviation:** `layout.groups` is both derived (by `ensureGroups`) and persisted (merged cross-tab). This is the root cause of the "fix one bug, introduce another" pattern. The industrial pattern is: **groups are always computed, never persisted**.

## Part 3: Connection Architecture Coupling Analysis

### 3.1 Coupling Map

```
removeConnection (L990)
  ├─ layout.connections.filter     ← data mutation
  ├─ connById.delete               ← runtime index
  ├─ markDeleted                   ← tombstone
  ├─ layout.groups prune           ← compat shim mutation
  ├─ dsuRebuildFromConnections     ← DSU rebuild O(n)
  └─ (caller must) renderConnections + saveLayoutDebounced

_execDeleteLargeBox (L3420)
  ├─ markDeleted (box + children + bookmarks)
  ├─ ensureConnArrays
  ├─ matchesDeletedKey filter on connections
  ├─ markDeleted on each affected conn id
  ├─ layout.connections.filter
  ├─ layout.groups prune
  ├─ dsuRebuildFromConnections
  ├─ layout.boxes.filter
  ├─ saveLayout (NOT debounced — immediate)
  └─ renderCanvas

toggleStarMark (L1529)
  ├─ groupStar add/delete
  ├─ box.isParent set/clear
  ├─ markDeleted (on unstar) / clear tombstone (on star)
  ├─ clearedTombstones.add (on star)
  ├─ ensureGroups
  └─ (caller must) saveLayoutDebounced + renderStarButtons
```

### 3.2 Coupling Problems

**Problem 1: No unified mutation API.** Each mutation path (removeConnection, deleteBox, toggleStar) has its own cleanup sequence. Adding a new mutation (e.g., "merge two boxes") requires manually replicating the cleanup logic.

**Problem 2: `saveLayout` vs `saveLayoutDebounced` inconsistency.** `_execDeleteLargeBox` calls `saveLayout` (async, not awaited); `removeConnection` relies on the caller to persist. This creates race conditions if the caller also calls `saveLayoutDebounced`` — the debounced call may fire before the async `saveLayout` resolves.

**Problem 3: DSU rebuild is called from 4 different places** (`removeConnection`, `_execDeleteLargeBox`, `_execDeleteSmallBox`, `ensureGroups`). Each caller assumes DSU is invalid after their mutation, but none checks if another caller already rebuilt it in the same tick.

**Problem 4: `layout.groups` is mutated in-place** by `removeConnection` (pruning members) and `_execDeleteLargeBox` (pruning members + tombstoning parentId). But `ensureGroups` overwrites it entirely. If `ensureGroups` runs after a prune but before `saveLayout`, the prune is lost.

### 3.3 Box State Cleanliness

Current box state fields:
- `x, y, w, h` — geometry (clean)
- `title` — display (clean)
- `isParent` — star mark (source of truth, but `groupStar` is a stale mirror)
- `autoExpand` — display mode (clean)
- `viewState` — inner zoom/pan (clean, but never cleaned up on box delete)
- `children` — small boxes (clean, but `smallKey` format is implicit)

**Verdict:** Box state is mostly clean. The main issue is `isParent` / `groupStar` duality and `viewState` not being cleaned on delete (minor memory leak).

### 3.4 Connection State Cleanliness

Current connection state:
- `layout.connections: [{ id, from, to }]` — persisted (clean structure, but no `createdAt`/`updatedAt` for merge conflict resolution)
- `connById`, `boxConnIdx`, `connLines` — runtime indices (clean)
- No connection metadata (no type, no anchor, no weight)

**Verdict:** Connection structure is minimal and clean. The problem is not the structure but the mutation paths around it.

### 3.5 Modularity Assessment

**Can new features be added modularly?**

| Feature | Effort | Coupling Risk |
|---|---|---|
| Connection color/style | Low — add `props` to connection object | Low |
| Directional arrows | Medium — add `direction` field, update `updateSvgLine` | Low |
| Connection labels | Medium — add `label` field, render text element | Medium (SVG layer) |
| Multi-parent groups | High — DSU only supports single root; would need a different structure | High |
| Connection waypoints | High — `updateSvgLine` assumes straight lines | High |

**Recommendation:** Adopt tldraw's `props` pattern: `connection = { id, from, to, props: {} }`. This allows adding metadata without schema changes. The `props` field is spread-merged in `mergeConcurrentLayout` automatically.

## Part 4: Algorithm Complexity Audit

### 4.1 Hot Paths and Complexity

| Function | Called By | Complexity | Issue |
|---|---|---|---|
| `onBoxDragMove` | mousemove (60fps) | O(1) for position + O(m*n) for group | `moveGroupTogether` is O(m*n) |
| `refreshConnsForBoxSync` | mousemove (60fps) | O(k) where k = conns for box | Good — uses `boxConnIdx` O(1) |
| `dsuRebuildFromConnections` | connect/disconnect/delete | O(n) where n = connections | Acceptable — gated by `__dsuBuilt` |
| `ensureGroups` | first group access | O(n + b) where b = boxes | Acceptable — lazy |
| `mergeConcurrentLayout` | storage.onChanged | O(n + m + g) where n=boxes, m=conns, g=groups | Acceptable — infrequent |
| `renderConnections` | render/zoom/mode-change | O(n) where n = connections | Acceptable |
| `updateSvgLine` | per-conn refresh | O(1) + viewport cull O(1) | Good |
| `elasticSnap` | per-member in group drag | O(n) where n = other boxes | Called m times = O(m*n) total |
| `getLargeBox` | various | O(n) — `layout.boxes.find()` | Should use a Map |
| `getSmallBox` | various | O(n*m) — find large, then find small | Should use a Map |

### 4.2 Critical Hotspots

**Hotspot 1: `moveGroupTogether` is O(m*n) per mousemove frame.**
- m = group members, n = total boxes on canvas
- For each member, `elasticSnap` scans all non-group boxes
- At 10+ boxes with 5+ group members, this is 50+ iterations per frame
- Comment at L1593: "ponytail: O(m*n) elastic pass per group; swap in rbush R-tree at >100 boxes"

**Fix:** Pre-compute a spatial index (grid hash or rbush) once per drag-start, update incrementally during drag. This reduces `elasticSnap` from O(n) to O(log n) or O(1) with grid hash.

**Hotspot 2: `getLargeBox` is O(n) Array.find.**
- Called from `dsuRebuildFromConnections` (L1401), `moveGroupTogether` (L1621), `toggleStarMark` (L1535)
- Should be O(1) via a `boxById: Map<id, LargeBox>` index

**Fix:** Add `boxById` Map, rebuild on `renderCanvas`. `getLargeBox` becomes `boxById.get(id)`.

**Hotspot 3: `getSmallBox` is O(n*m).**
- Finds large box, then finds small box in children array
- Should be O(1) via `smallBoxById: Map<key, SmallBox>` where key = `largeId:smallId`

**Fix:** Add `smallBoxById` Map, rebuild on `renderInnerSurface`.

### 4.3 DSU Complexity

Current DSU operations:
- `dsuFind`: O(alpha(n)) ~= O(1) with path compression
- `dsuUnion`: O(alpha(n)) ~= O(1) with union by rank
- `dsuRebuildFromConnections`: O(n) — iterates all connections
- `dsuGroupMembers`: O(k) where k = members of one group

**Verdict:** DSU itself is optimal. The issue is the rebuild frequency — it's called from 4 places, and the `__dsuBuilt` flag only prevents redundant rebuilds within the same tick, not across ticks.

**Recommendation:** Add a `__dsuDirty` flag set by any mutation (addConnection, removeConnection, deleteBox, toggleStar). `dsuRebuildFromConnections` only rebuilds if `__dsuDirty` is true. `getGroupByParent` checks `__dsuDirty` before returning.

## Part 5: Recommendations Summary

### Priority 1 (Architecture)
1. **Stop persisting `layout.groups`.** Make it runtime-only. Eliminates merge-resurrection risk entirely.
2. **Unify mutation paths** into a single `mutateLayout(operation)` function that handles tombstone + index cleanup + DSU rebuild + persist.
3. **Add `boxById` and `smallBoxById` Maps** for O(1) box lookups.

### Priority 2 (Performance)
4. **Spatial index for `elasticSnap`** — grid hash is sufficient for <100 boxes.
5. **Tombstone GC** — trim `_meta.deleted` to 24h window after save.
6. **`__dsuDirty` flag** — set on mutation, check before rebuild.

### Priority 3 (Modularity)
7. **Add `props: {}` to connection objects** — future-proofs for connection metadata.
8. **Document key format** (`large:L1`, `small:L1:S1`) in CONTEXT.md.
9. **Clean up `viewState` on box delete** — minor memory leak fix.

---

## ADR-0008: Design System Three-Layer Token Architecture

Status: Phase 1-4 implemented (primitive + semantic layers; CSS source split + build cat; dark override deletion; DESIGN.md component state specs aligned).

See: [ADR-0008](adr/0008-design-system-three-layer-tokens.md) | [DESIGN.md](DESIGN.md)
