# ADR-0007: Architecture Refactor — Computed-Only Groups + Unified Mutation API + O(1) Lookups + Spatial Index

## Date
2026-08-05

## Status
Accepted + Implemented (2026-08-05) — all phases in ntp/ntp.js; acceptance gates + critical Playwright suite green

## Context

The architecture audit (docs/archive/architecture-audit.md, archived) identified 9 recommendations across
3 priorities. Through a grill-with-docs process, the user confirmed decisions for each
recommendation after reviewing industrial patterns (tldraw Store/BindingUtil, React Flow
Edge, Excalidraw Delta, GDevelop SpatialHashGrid) and code-level analysis of the current
ntp.js architecture.

### Problem Summary

1. **layout.groups dual persistence**: layout.groups is both derived (by ensureGroups)
   and persisted (merged cross-tab via mergeByIdUnion). This circular dependency caused
   the "scenario 3" test failure — unstar on tab A, tab B fixes stale isParent survives
   because mergeByIdUnion re-adopts from stale remote groups.

2. **6 scattered mutation paths**: addConnection, removeConnection, toggleStarMark,
   _execDeleteLargeBox, _execDeleteSmallBox, applyExternalLayout — each with its own
   tombstone/index-cleanup/DSU-rebuild/save logic. Missing one cleanup step in any path
   produced bugs (cross-tab resurrection, star loss after box delete, etc.).

3. **O(n) box lookups**: getLargeBox uses Array.find, called 38 times; getSmallBox is
   O(n*m), called 12 times. At 60fps drag, this is significant.

4. **O(50n^2) elasticSnap**: while(50) * for(others) * for(4 candidates) * others.some()
   — problematic at 30+ boxes especially during group drag (m * 50n^2).

5. **Unbounded tombstones**: _meta.deleted only capped at 2000 entries, no time-based GC.

6. **DSU rebuild on every ensureGroups**: __dsuBuilt is boolean, not dirty flag —
   ensureGroups always calls dsuRebuildFromConnections even when nothing changed.

## Decisions

### Q1: layout.groups -> computed-only + one-time migration (Plan 2)

**Choice**: Stop persisting layout.groups. Make it a runtime-only computed value.
Old users get a one-time migration: on first load with __groupsMigrated flag absent,
read stale layout.groups to restore box.isParent, then discard groups forever.

**Rationale**: tldraw bindings index is a computed value that "updates incrementally
as bindings change. Lookups are fast and never scan all records." layout.groups being
both derived and persisted is the root cause of cross-tab star sync bugs.

**Rejected alternatives**:
- Plan 1 (pure computed, no migration): old users lose star marks on upgrade.
- Plan 3 (single-writer via background script): 3-5x the work, overkill for non-collab
  browser extension with low concurrency.
- Plan 4 (defer): scenario 3 bug cannot be root-caused without this.

### Q2: Unified mutation API — commit(op) + modular handlers (Plan A)

**Choice**: All 6 mutation paths route through a single commit(op, payload) function.
Each op has a handler that only modifies data. commit() handles cleanup: markDeleted ->
pruneConnIndices -> DSU rebuild -> saveLayout -> renderConnections.

**Rationale**: tldraw uses store.put() / store.remove() as the only entry points.
Side effects (BindingUtil callbacks: onBeforeDelete, onAfterChange, etc.) are registered
per type, not scattered across 6 functions. Adding a new operation = add a handler +
side effect, not modify existing code.

**Rejected alternatives**:
- Plan B (shared cleanup helpers, no unified entry): still relies on "each function
  remembers to call cleanup" — the same failure mode that produced 3+ bugs already.
- Plan C (status quo): next bug already queued.

### Q3a: boxById/smallBoxById Map

**Choice**: Add Map<id, box> for O(1) lookups. Rebuild on load, incrementally update
on add/delete.

**Rationale**: Pure win, zero risk. 38 getLargeBox + 12 getSmallBox call sites benefit
automatically. No behavior change, just lookup mechanism.

### Q3b: elasticSnap spatial hash grid (threshold 32)

**Choice**: Add spatial hash grid with GDevelop threshold=32. Below 32 boxes, brute
force is faster (grid construction overhead not amortized). At 32+, grid reduces
O(n^2) to O(n) amortized. Cell size = 2x largest box dimension.

**Rationale**: GDevelop PR #8289 benchmarks: at N=50 brute=0.097ms vs grid=0.021ms
(4.7x). At N=100, brute=0.414ms vs grid=0.048ms (8.6x). Below 32, grid overhead makes
it slower. 0fps.net: "for a small set, there is no sure win for using a broad phase."

Key parameters:
- Threshold: 32 objects (GDevelop calibrated)
- Cell size: 2x average object dimension (minimum 32px)
- Grid reused across frames, only cleared and rebuilt

### Q4a: Tombstone GC — 24h time window

**Choice**: After saveLayout success, trim _meta.deleted entries older than 24 hours.

**Rationale**: Cross-tab resurrection only a risk during sync window (seconds to
minutes). Old tombstones serve no purpose and bloat persisted data / slow mergeByIdUnion.

### Q4b: DSU dirty flag

**Choice**: Replace __dsuBuilt boolean with __dsuDirty flag. Set true on connection
mutation, dsuRebuildFromConnections checks and skips if not dirty.

**Rationale**: During drag (60fps), getGroupByParent triggers ensureGroups ->
dsuRebuildFromConnections O(n) every frame. With dirty flag, DSU only rebuilds when
connections actually change — once per connect/disconnect, not 60x/sec.

### Q4c: connection props field

**Choice**: Add empty props:{} to connection objects. migrateLayout backfills.

**Rationale**: tldraw TLBaseBinding has props: Props. React Flow Edge has data: {}.
Future-proofs for connection metadata (color, weight, label) without schema change.

### Q4d: viewState cleanup on box delete

**Choice**: Explicitly delete lb.viewState when deleting a box (in commit handler).

**Rationale**: Minor memory leak. Box removed from array but viewState may survive
in tombstone-merged transient state.

## Consequences

### Positive
- Cross-tab star sync bugs eliminated (root cause: groups dual persistence)
- New features only need a handler + side effect (modular, no scattered cleanup)
- O(1) box lookups, O(n) collision detection at scale
- Tombstones do not grow unbounded
- DSU does not rebuild during drag

### Negative
- One-time migration flag (__groupsMigrated) adds ~20 lines to migrateLayout
- commit(op) wrapper adds one function-call indirection (negligible)
- Spatial grid adds ~50 lines (only used at 32+ boxes)
- boxById Map adds O(n) rebuild cost on load (one-time, amortized)

## Implementation Order

1. boxById Map (zero risk, no dependencies)
2. groups migration (depends on boxById)
3. commit API (depends on groups cleanup removal)
4. DSU dirty flag + tombstone GC (depends on commit)
5. Spatial index (depends on boxById)
6. Connection props + viewState cleanup (depends on commit)

## Verification

- boxing-star-sync-audit.spec.ts (3 scenarios pass)
- 167 existing tests pass
- New: migration test (old groups -> isParent -> groups discarded)
- New: commit cleanup test (tombstone + index + DSU + save)
- New: spatial index benchmark (100 boxes drag >= 30fps)
