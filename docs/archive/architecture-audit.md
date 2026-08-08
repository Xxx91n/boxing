# Architecture Audit — Bug Pattern Taxonomy & Lessons

> Archived: 2026-08-08. 9 recommendations absorbed into ADR-0007/0008 + roadmap.
> This archive preserves the bug pattern taxonomy for future reference.

## Bug Categories and Root Causes

| Bug Category | Root Cause | Fix Pattern | Lesson |
|---|---|---|---|
| Cross-tab resurrection | mergeConcurrentLayout re-adds deleted items | markDeleted(id) tombstone before filter | Delete ops must tombstone, not just filter |
| Parent star lost after box delete | _execDelete didn't prune derived indices | Filter all derived indices on delete | Every delete path must clean ALL derived indices |
| DSU rebuild performance | dsuRebuild called on every mousemove | __dsuBuilt lazy flag + dirty check | DSU is O(n) — gate behind dirty flag |
| Viewport culling line vanish | Cull used screen coords not world coords | World-coord cull accounting for pan | Cull in world coords, not screen coords |
| Lines appear above boxes | SVG z-index override during drag | Enforce z-index:0 on conn-layer, z-index:1 on boxes | Z-index is a layout invariant — never override per-state |
| Chrome font blur at low zoom | will-change:transform forces fixed-bitmap raster | Remove GPU hints, use backface-visibility:hidden | Chrome rasterizes will-change elements as fixed bitmaps |
| Jagged lines at low zoom | SVG stroke at sub-pixel coordinates | shape-rendering:geometricPrecision + vector-effect | Use vector-effect for resolution-independent rendering |
| Alt+Click delete needs two clicks | Hit area too small | Enlarge hit area with transparent padding | Interaction hit areas need generous padding |
| Group move sends children flying | moveGroupTogether used raw delta without collision resolve | Per-member elasticSnap against out-of-group boxes | Group drag must resolve collisions per-member |

## Fix Pattern Taxonomy

- **Pattern A: Tombstone-then-filter** — markDeleted → filter array → clean derived indices
- **Pattern B: World-coordinate culling** — cull in world coords accounting for pan offset
- **Pattern C: O(1) hot-path lookups** — mousemove functions use Map/Set, never Array.find
- **Pattern D: Lazy DSU rebuild** — O(n) rebuild gated behind dirty flag
- **Pattern E: Per-member collision resolution** — group drag resolves each member via elasticSnap
