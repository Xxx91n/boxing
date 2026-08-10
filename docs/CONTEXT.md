# CONTEXT.md — Boxing Domain Glossary & Architecture

> Source-of-truth glossary for the Boxing browser extension project.
> Maintained alongside ADRs under `docs/adr/`.
> Update this file when adding domain concepts, data structures, or architectural invariants.

## Project Summary
Boxing is a vanilla-JS browser extension (Chrome + Firefox) that organizes bookmarks hierarchically on an infinite canvas. Large boxes contain small boxes; small boxes contain bookmarks. Boxes can be connected with lines to form visual relationships. A DSU (disjoint-set union) groups boxes that share connection lines, enabling parent-star propagation and group movement.

## Core Domain Terms

### Boxes
- **Large box** — top-level container rendered on the outer canvas. Has `id: 'L<n>'`, `x`, `y`, `w`, `h`, `title`, `isParent` (star mark), `autoExpand`, `viewState` (inner zoom/pan).
- **Small box** — leaf container inside a large box's inner surface. Has `id: 'S<n>'`, same geometry fields, `bookmarks: [{title,url}]`.
- **isParent** — boolean star-mark on a box indicating it's the movement-leader of its DSU group. Visualized as a filled star (empty star = not parent). See ADR-0003.
- **autoExpand** — boolean: when true, the box renders expanded on hover without needing a click toggle.

### Connections (Lines)
- **Connection** — `{ id, from, to, createdAt?, props:{} }` — undirected edge between two boxes.
- **connLine** — SVG `<line>` element rendered on a dedicated SVG layer (`connSvg`). Tracked in `connLines: Map<connId, SVGLineElement>`.
- **connById** — `Map<connId, Connection>` O(1) lookup.
- **boxConnIdx** — `Map<boxId, Set<connId>>` O(1) reverse index: which conns touch which box.
- **DSU** — Disjoint-Set Union over box ids. `dsuRebuildFromConnections()` rebuilds parent/child after connect/disconnect. A group is all boxes sharing the same DSU root.
- **scheduleConnRefresh(ids)** — rAF-coalesced refresh that updates SVG line endpoints from box DOM positions. Avoids sync layout thrash (BX-DEV-PERF).
- **Viewport culling** — lines outside the visible canvas/inner area get `display:none` to avoid SVG GPU cost. Pan/zoom handlers must call `scheduleConnRefresh(all conn ids)` to re-evaluate culling. See ADR-0004, BX-EXPLORE-008.

### Box Key Format (Tiered Keys)
- **Large box key**: `large:L1` (prefix `large:` + box id)
- **Small box key**: `small:L1:S1` (prefix `small:` + large box id + `:` + small box id)
- **Legacy keys**: Raw ids (`L1`, `S1`) without prefix — supported for backwards compat, normalized in `ensureConnArrays`
- Used in: `connection.from`, `connection.to`, `groupStar` Set, `boxConnIdx` Map, DSU `boxGroupId`/`groupMembers`
- Note: `layout.groups` is **runtime-only** after ADR-0007 Phase 1.1 — never persisted (`stripGroupsForPersist`); `ensureGroups()` computes on demand and mirrors into in-memory `layout.groups` for debug/tests; star truth is `box.isParent`; starred parents with zero connections still get `dsuMake` so `getGroupByParent` works
- **MUST be documented** when adding new data structures that reference box identities

### Mutation API (ADR-0007)
- **commit(op, payload, opts)** — single mutation entry (tldraw Store pattern). Ops: `addConn`, `removeConn`, `toggleStar`, `deleteLargeBox`, `deleteSmallBox`, `applyExternal`. Owns tombstones, DSU dirty, viewState clear, optional save/render.
- **boxById / smallBoxById** — O(1) box lookups; rebuilt on load/external apply.
- **__dsuDirty / markDsuDirty()** — skip full DSU rebuild on hot path when clean.
- **Spatial hash (elasticSnap)** — threshold 32; cell = 2× max box dim (GDevelop pattern).

### Architecture Audit & Refactor Roadmap (ADR-0007)
- **Audit document**: [docs/archive/architecture-audit.md](archive/architecture-audit.md) — bug pattern taxonomy (archived, absorbed into ADRs)
- **ADR-0007**: [docs/adr/0007-architecture-refactor-decisions.md](adr/0007-architecture-refactor-decisions.md)
- **ADR-0008**: [docs/adr/0008-design-system-three-layer-tokens.md](adr/0008-design-system-three-layer-tokens.md) — three-layer token architecture + CSS source split + dark mode consolidation
- **DESIGN.md**: [docs/DESIGN.md](DESIGN.md) — visual design system: token architecture, palette, typography, component state specs, dark mode strategy — grill-confirmed decisions for all 9 audit recommendations
- **Roadmap**: [docs/archive/roadmap-architecture-refactor.md](archive/roadmap-architecture-refactor.md) — decision matrix (archived, implemented in ADR-0007)
- **Implementation status (ADR-0007)**: Phase 1.1–1.3 + Phase 2.1–2.3 + Phase 3 landed in `ntp/ntp.js` (groups computed-only, `commit(op)`, `boxById` maps, `__dsuDirty`, spatial hash ≥32, tombstone 24h GC, conn `props`, delete viewState clear).
- **Verification evidence (2026-08-05)**: ADR acceptance gates (`boxing-adr-0007-acceptance`) 5/5; critical suite (`star-sync`+`conn-delete`+`conn-dsu`+`conn-persist`) 38/38 isolated; acceptance+critical combined 43/43 (workers=2). BX-144 Bug1b/1c + star-only `dsuMake` covered.
- **Confirmed decisions (grill Q1-Q4)**:
  - Q1: layout.groups stops being persisted -> computed-only runtime value + one-time migration (ADR-0007)
  - Q2: Unified commit(op) mutation API with modular handlers — all 6 paths route through one entry
  - Q3a: boxById/smallBoxById Map for O(1) lookups (replacing Array.find)
  - Q3b: elasticSnap spatial hash grid, threshold=32 (GDevelop pattern), cell size = 2x max box dimension
  - Q4a: Tombstone GC — trim _meta.deleted older than 24h after saveLayout
  - Q4b: DSU dirty flag — replace __dsuBuilt boolean with __dsuDirty, skip rebuild when clean
  - Q4c: connection objects get props:{} field (migrateLayout backfills)
  - Q4d: viewState explicitly cleared on box delete

### Connection Delete Action (ADR-0006)
- **connDeleteAction** — `layout.settings.connDeleteAction: string` enum field. Determines how the user deletes a connection line.
  - `'alt+click'` (default) — Alt + left mouse down on a conn-line
  - `'ctrl+click'` — Ctrl + left mouse down
  - `'shift+click'` — Shift + left mouse down
  - `'double-click'` — dblclick event on conn-line
  - `'select+delete'` — click selects line (CSS `conn-line--selected`), Backspace/Delete removes
- **onConnLinePointerDown(e)** — unified event detector; reads connDeleteAction to decide if removeConnection fires.
- **selectedConnId** — state for select+delete mode; the currently-selected conn-line id. Cleared on mode change.
- **conn-line--selected** — CSS class for visual highlight of selected line.

### Settings
- **layout.settings** — persisted settings object inside `layout`. Spread-merged on cross-tab sync: `{ ...remote.settings, ...local.settings }`.
- Fields: `selectedLanguage`, `rememberLastPos`, `zoomLevel`, `darkMode`, `fontSize`, `squareCorners`, `autoBackupInterval`, `headerPinned`, `syncProvider`, `urlOpenMode`, `connDeleteAction`, `theme`.

### Theme Pack System (ADR-0012)
- **THEME_PACKS** — static object in ntp.js with 5 curated themes: `beige` (default), `graphite`, `coastal`, `forest`, `pure`. Each stores complete warm bg ramp (9 tiers) + accent ramp (3 tiers) for light + dark.
- **theme** — `layout.settings.theme: string` (default `'beige'`). Replaces old `accentHue` + `accentPreset` (migrated in migrateLayout).
- **applyTheme(themeKey)** — injects all theme CSS variables via setProperty. Called on init if theme !== 'beige', and on theme button click.
- **theme-preset** — CSS class for the 5 theme buttons in settings modal (`.theme-preset`, `.theme-preset--active`).
- **ADR-0010** — superseded by ADR-0012 (free hue slider replaced by curated themes).
- **ADR-0011** — ntp.css is a build artifact, gitignored, validator reads source files.
- **syncSettingsDOM()** — reads layout.settings → DOM (select values, checkboxes). Called on modal open and after applyExternalLayout.
- **addEventListener('change')** — settings modal writes DOM → layout.settings + `saveLayoutDebounced()`.

### Storage
- **saveLayoutDebounced()** — debounced persist to `chrome.storage.sync` / `browser.storage.sync`. Correct function name (BX-EXPLORE-009: `persistLayoutDebounced` was a typo that was never defined).
- **mergeConcurrentLayout** — cross-tab merge at L780: `settings: { ...remote.settings, ...local.settings }` — new fields covered automatically.
- **diagnostics** — bounded log ring buffer under `.omx/logs/`; exportable via Diagnostics UI (BX-AUD-05).

## Architectural Invariants (BX-EXPLORE-005..009)
- **BX-EXPLORE-005**: Box dragging uses `left`/`top` only — NEVER `translate3d()` (causes 2x position flash).
- **BX-EXPLORE-006**: NEVER add `will-change: transform` / `translateZ(0)` to `.large-box`, `.small-box`, `--dragging`, `canvasSurface`, `innerSurfaceContent`, or `.conn-line`. Chrome rasterizes to fixed bitmaps → blurry text at low zoom.
- **BX-EXPLORE-007**: Hot-path mousemove functions use O(1) lookups via `connById` Map — never `.find()`.
- **BX-EXPLORE-008**: Pan/zoom handlers call `scheduleConnRefresh(all conn ids)` after `applyCanvasTransform`/`applyInnerTransform`.
- **BX-EXPLORE-009**: Persistence calls `saveLayoutDebounced()` — never `persistLayoutDebounced()` (undefined typo).

## CSS Dual-Write Convention
Both large-box and small-box canvases share the same CSS class for conn-line styles. Single source of truth in `ntp/ntp.css`. See `docs/css-dual-write-convention.md` for rules on properties that MUST stay in sync across large/small box selectors.

## Disposal Invariant
Any code that clears `canvasSurface.innerHTML` or `innerSurfaceContent.innerHTML` MUST call `disposeAllConns()` first — otherwise `connLines` Map holds stale SVG refs and `renderConnections()` skips rebuild (lines invisible forever).
