# Architecture Refactor Roadmap — Decision Summary

> Archived: 2026-08-08. All decisions implemented and absorbed into ADR-0007.
> This archive preserves the decision matrix and industrial template references.

## Decision Summary

| # | Issue | Decision | Scenario |
|---|---|---|---|
| Q1 | Persist layout.groups | Computed-only + one-time migration | Don't store group list; old users get one-time recovery of isParent |
| Q2 | Mutation API | commit(op) + modular handlers | Single entry point; handler manages data, commit manages cleanup→DSU→store→render |
| Q3a | boxById/smallBoxById Map | Done | Array.find O(n) → Map.get O(1), 38 call sites |
| Q3b | elasticSnap spatial index | Done | Spatial hash grid, threshold 32, cell size = max box diameter |
| Q4a | Tombstone GC | Done | Clean >24h tombstones after saveLayout |
| Q4b | DSU dirty flag | Done | __dsuBuilt → __dsuDirty, rebuild only on connection change |
| Q4c | Connection props | Done | Add props:{} field, migrateLayout backfills |
| Q4d | viewState cleanup | Done | Delete lb.viewState on box deletion |

## Industrial Template References

| Template | Reference Point | Source |
|---|---|---|
| tldraw Store | put/remove entry + sideEffects hooks + computedCache | github.com/tldraw/tldraw Store.ts |
| tldraw BindingUtil | onBeforeDelete/onAfterChange callbacks | tldraw.dev/sdk-features/bindings |
| React Flow Edge | { id, source, target, data, props } structure | reactflow.dev/api-reference/types/edge |
| Excalidraw Delta | Soft delete isDeleted + delta.applyTo | github.com/excalidraw/excalidraw delta.ts |
| GDevelop SpatialHashGrid | Threshold 32, cell size = 2× avg object size | github.com/4ian/GDevelop PR #8289 |
| CSS-Tricks vanilla Store | commit(mutationKey, payload) + Proxy state | css-tricks.com/build-a-state-management-system |
