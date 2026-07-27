# Box Connections (tree/network) - Design

Status: proposal; not yet implemented. Resolve scope with user before code lands.

## Goal
- Black/white line from dynamic mid-edge of one box to mid-edge of another box.
- Mouse cursor shows `+` while connecting; click a target box's mid-edge to terminate.
- Star-mark a parent box.
- Moving a parent averages the position of group-members; whole group moves together.
- Collision resolves together with the group.
- Persistence (no stack blowup); perf-safe at high box counts.

## Library decision (research-backed; do NOT roll our own)
- **anseki/leader-line** - selected.
  - SVG path between two DOM elements; `startSocket`/`endSocket` = 'top'|'right'|'bottom'|'left'|'auto' (mid-edge on demand).
  - `.position()` re-fits when elements move; supports dynamic world.
  - Single file, ~12 KB, no deps. License MIT.
  - Used by arrows in chrome-devtools-style panels and many doc tools.
- Rejected for now:
  - **power-link** (drag-and-drop Bezier node graph with pan/zoom + snap) - over-reaches our scope (mouse-node drag semantics steal our existing pan).
  - **react-archer / react-xarrows** - react-only; Boxing is vanilla JS.
  - hand-rolled SVG - user explicitly said do not write a wheel.

## Data model (additive, no rewrites)
- `layout.connections = Array<{ id, from, to, createdAt }>` — `from`/`to` are **tiered keys**:
  `large:boxId` for large boxes, `small:largeId:smallId` for small boxes.
  Legacy raw-id format (Round 1) is back-compat: `resolveBoxEl` and `pruneConnArrays` accept both.
- `layout.groups = Array<{ id, parentId, members:[boxKey] }>` — for star-mark/group-move.
  `parentId` and `members` use tiered keys (large boxes only for star-mark per user confirmation).
- Box records unchanged — connections/groups live at `layout` root.
- Prune on save: cap `MAX_CONNECTIONS = 5000`; `pruneConnArrays` validates keys via `allValidKeys()`
  set (all `large:` + `small:` keys) plus legacy raw-id set; drop oldest when exceeded.
  `ponytail: bounded array, upgrade to pagination if growing past 5k`

## Hot path / perf
- Reuse `initSizeObserver()` ResizeObserver already in ntp.js (L478).
  On box resize/move, call `.position()` on each affected connection only.
- Connections render on a single SVG layer above canvas, below popups.
- rAF-coalesce position updates (Nolan Lawson pattern) so 1000 boxes * 4 edges
  does not issue 4000 synchronous `.position()` calls per pan frame.
- Defer LeaderLine for offscreen boxes via `content-visibility:auto` already in place (BX-DEV-123). When hidden, call `.hide()` not `.remove()`.

## Collision / group-move semantics
- Star-mark sets `parentId` on chosen parent; group = parent + members.
- `onBoxDragMove` for a parent: compute delta and apply to all members' x/y,
  then `saveLayout` (debounced). Collision resolve runs over the group as a unit:
  `elasticSnap(pos, w, h, others, ...)` iterates per-member with siblings excluding
  other group members (they move together, no internal collisions).
- Per-member drag (non-parent): individual move; group membership unchanged.
- `ponytail: O(m*n) elastic-snap inside group; fine up to ~50 members/group; switch to R-tree if exceeded.`

## Cursor
- Canvas: `cursor: crosshair` on hover over a box's middle edge anchor (CSS hover).
- During active connect: `body.cx--connecting { cursor: crosshair }` toggles via classList.

## Storage / sync view-state
- `viewState` unchanged - connections/groups are part of `layout` and flow through
  existing `saveLayout` debounce + chrome.storage.sync path. No new persist code.

## Tests (new spec)
- connect two boxes via mid-edge; line present after reload.
- star-mark parent; drag parent; members follow; assert positions.
- delete a connected box; orphan connection pruned on saveLayout.
- 200 boxes + 50 connections: pan < 16ms frame budget (perf guard).

## Skipped (YAGNI until requested)
- Curved/bezier paths (leader-line `path:'fluid'` opt available later).
- Bidirectional link labels.
- Weighted-average other than centroid.
- Undo for connection deletion (use existing layout undo when it exists).

## Open questions for user — RESOLVED (Round 2, BX-DEV-137+)
- ~~Allow connections ONLY large-to-large, or also large-to-small and small-to-small?~~
  **RESOLVED:** Cross-level enabled via tiered keys (`large:boxId` / `small:largeId:smallId`).
  Connections store tiered keys; `resolveBoxEl(key)` routes to the correct DOM element at any
  nesting level. Legacy raw-id connections (Round 1 format) remain back-compat via fallback.
  Visual line rendering requires both endpoint DOMs to exist simultaneously: a small box DOM
  only exists inside the inner-canvas of its parent large box (after `enterLargeBox`). If either
  endpoint is offscreen/not rendered, leader-line skips creating the line (graceful degradation).
  Data-layer persistence is unaffected — connections survive regardless of render state.
- ~~Star-mark: only large boxes qualify as parent, or any box?~~
  **RESOLVED:** Large boxes only. Small-box star button is omitted (per user confirmation).
  Rationale: `moveGroupTogether` resolves members against `layout.boxes` (large-box array);
  extending to small-box parents would require context lookup into `lb.children` with a
  separate collision set (inner coordinates vs canvas coordinates). Not worth the complexity
  until users request it; the ↗ connect button on small boxes covers cross-level visualization.
- ~~Confirm we want ONLY black/white line, or a third accent color for primary link?~~
  **RESOLVED:** Black/white only (`--connection-color: var(--color-ink)`), adapts to dark/light
  theme automatically via `currentColor`-based CSS. No third accent color added.
