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

- **UI-AUDIT.md**: [docs/UI-AUDIT.md](UI-AUDIT.md) — Phase 7 aesthetic audit: 7-dimension findings + remediations, token validation checklist (ADR-0008 Phase 7)

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
- **theme i18n** — buttons carry `data-i18n-title="themeBeige"` etc; `applyI18n()` sets `.title` from `_locales/<lang>/messages.json`. All 14 locales have `themeBeige`/`themeGraphite`/`themeCoastal`/`themeForest`/`themePure` keys; `I18N_FALLBACK` holds English fallbacks. Any new theme must add the key to all 14 locale files AND to `I18N_FALLBACK`.
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
- **BX-EXPLORE-010**: `setBodyExpandHeight(el)` MUST measure natural content height, NOT the max-height-clamped `scrollHeight`. Temporarily set `el.style.maxHeight = 'none'`, `void el.offsetHeight` to force reflow, read `scrollHeight`, then restore `maxHeight`. Measuring under collapsed `max-height: 60px` returns the clamped visible height (~58px) instead of the real expand target (~220px), making hover no-op. This invariant supersedes the pattern BX-DEV-140d removed; restoring it is what BX-EXP-REGR fixed.
- **BX-EXPLORE-011**: A `ReferenceError` in a function body aborts the entire frame callback (rAF), silently skipping every subsequent statement. When fixing a ReferenceError, scan the lines BELOW the reference and ask: "Was some meaningful setProperty / saveLayout / state update being silently skipped because the error aborted the callback?" Fix the reference AND restore the correct behavior of those skipped lines. `savedMaxH` referror in `setBodyExpandHeight` masked a wrong-value bug for 7 commits because the error silently prevented `el.style.setProperty('--expand-height', fullH + 'px')` from ever running; the drawer kept working by luck via the 800px CSS fallback.
- **BX-EXPLORE-012**: Never add `scrollbar-gutter: stable` to a container with `overflow: hidden` just to prevent a transition scrollbar flash. `scrollbar-gutter: stable` reserves a scrollbar lane EVEN WHEN no scrollbar appears — Chrome renders this as a visible right-side indent on collapsed hover-expand boxes. Firefox does not reserve the gutter for `overflow: hidden` so it was silently unaffected. The real flash prevention lives on the body layer (`overflow: visible` on `:hover` and `:not(.box--collapsed)`), not on the box itself.
- **BX-EXPLORE-013**: All messaging between background.js and ntp.js MUST use `msg.type` as the field name — never `msg.action`. The `sendToBackground(msg)` function and `background.js` dispatch table both read `msg.type`. The auto-backup trigger from background to NTP also uses `msg.type`. Mixing `msg.type` and `msg.action` creates a silent failure: the receiver never matches and the message is dropped without error. Fixed in a7cc8aa.
- **BX-EXPLORE-014**: `storageWriteChain = storageWriteChain.then(async () => {...})` MUST have a chain-level `.catch(err => debugErr(...))` after the `.then()`. If the inner async function throws OUTSIDE the inner try/catch (e.g. `mergeConcurrentLayout` or `layoutStorage.get` rejects), the `.then()` returns a rejected promise — the chain permanently dies and ALL future `saveLayout()` calls silently queue onto a dead chain. The `.catch()` swallows the error (logged via `debugErr`) and returns resolved `undefined`, keeping the chain alive. This prevents silent data loss. Fixed in a7cc8aa.
- **BX-EXPLORE-015**: All `catch` blocks in ntp.js and background.js MUST be classified and annotated: A-class (critical paths: storage, sync, render state) use `catch (e) { debugErr("context", e); }`; B-class (soft failures: DOM removal, ResizeObserver, localStorage cleanup, popup reposition, favicon cache, alert guard) use `catch (e) { /* silent: <reason> */ }`. Empty `catch (_) {}` without annotation is FORBIDDEN — it makes debugging impossible. Zero empty catch blocks remain as of a7cc8aa.

## CSS Dual-Write Convention
Both large-box and small-box canvases share the same CSS class for conn-line styles. Source files: `ntp/src/base.css` + `ntp/src/conn.css` + `ntp/src/settings.css` + `ntp/src/onboarding.css` (ADR-0011: `ntp/ntp.css` is a build artifact produced by `build.mjs`; edit source files, not the concatenated output). See `docs/css-dual-write-convention.md` for rules on properties that MUST stay in sync across large/small box selectors.

## Disposal Invariant
Any code that clears `canvasSurface.innerHTML` or `innerSurfaceContent.innerHTML` MUST call `disposeAllConns()` first — otherwise `connLines` Map holds stale SVG refs and `renderConnections()` skips rebuild (lines invisible forever).

## Selection Invariant (BX-SEL-01)
Chrome native `dblclick` on selectable canvas text (empty-state title, footer hint, etc.) creates a `Selection` range that survives `canvasSurface.innerHTML = ''`. When new text nodes appear, Chrome re-anchors the stale range to them — visually mimicking a "copy-select" of the fullscreen button / box name. All canvas-related surfaces (`.canvas`, `.canvas__surface`, `.canvas__empty`, `.inner__surface`, `.inner__canvas`, `.foot__txt`) MUST use `user-select: none`. `contenteditable="true"` titles are exempted via explicit `user-select: text` override. `renderCanvas()` MUST call `window.getSelection()?.removeAllRanges()` BEFORE the DOM wipe. Firefox is unaffected natively but shares the same code path for parity.

## Build Pipeline Invariant (BX-MANIFEST-004b)
`npm run dev:chrome` and `npm run dev:firefox` MUST chain `npm run build && web-ext run ...` — the dev script compiles (build) before loading `dist/` into the browser. This prevents the "stale dist" bug (session 019ffa4d): LLM or developer runs `npm run dev:chrome` thinking the latest source changes are loaded, but `dist/` was never rebuilt — the browser loads the old compiled output. The `dev:chrome:no-build` / `dev:firefox:no-build` variants skip build for fast reload and MUST retain `--no-reload`. `build.mjs` emits `[STALE_DIST]` warnings when the prior build's `BUILD_INFO.json` commit differs from current `git HEAD`. The deleted `dev-load.mjs` (commit ab436d7) had this stale-detection; web-ext npm scripts replaced it but lost the guard — BX-MANIFEST-004b restores it at the script level.

## Performance Optimization (ADR-0013)
- **ADR-0013**: [docs/adr/0013-performance-optimization-grid-hash.md](adr/0013-performance-optimization-grid-hash.md) -- grid hash spatial index for moveGroupTogether
- **moveGroupTogether** (ntp.js:1923) -- O(m x n) per drag frame: each group member calls elasticSnap against all non-member boxes. Main performance hotspot. ADR-0013 replaces linear scan with grid hash O(k) neighbor query.
- **Grid hash** -- cell size = 2x max box dimension (GDevelop pattern). Built at drag-start O(n), queried per member O(k) where k = 0-5 neighboring boxes. Reuses existing spatial hash >=32 threshold pattern from elasticSnap.
- **__spatialGridDirty** / **markSpatialGridDirty()** -- lazy rebuild flag, same pattern as __dsuDirty / markDsuDirty(). Set on box create/delete/move/cross-tab sync. Grid rebuilt on next drag-start.
- **Q3=B**: renderConnections SVG line pooling only -- renderCanvas full rebuild semantics preserved (multi-tab sync safety). renderCanvas DOM diff deferred (9 callers depend on clean DOM after rebuild).
- **Q4=C**: No rAF batching (adds 1-frame latency, violates follow-hand UX). No WeakMap geometry caches (boxMidPoint is O(1)).
- **Q5=C**: No saveLayout incremental storage (cold-path, 120ms debounced, 30KB << 5MB quota).

### Performance Grill Decisions (2026-08-15)
- **Q1**: A -- all three layers (frame rate + memory + storage) planned together, executed in phases. Only frame rate (grid hash) confirmed as needed; memory and storage confirmed YAGNI.
- **Q2**: Grid hash spatial index (confirmed) -- boxing uses <200 boxes, R-tree overkill. Grid hash matches existing elasticSnap >=32 threshold pattern.
- **Q3**: B -- SVG line pooling only. Multi-tab sync analysis: applyExternalLayout (ntp.js:3960) calls renderCanvas() and depends on full rebuild semantics to handle cross-tab add/delete/move. DOM diff would require auditing all 9 renderCanvas callers for fresh-DOM assumptions -- risk too high for incremental gain.
- **Q4**: C -- no rAF batching, no WeakMap caches. onBoxDragMove hot path: style.left/top O(1), refreshConnsForBoxSync O(k), moveGroupTogether O(m x n) -> fixed by grid hash. All other operations O(1)/O(k). No additional optimization needed.
- **Q5**: C -- no storage optimization. saveLayout cold-path only (drag end, create/delete/rename, settings change). 120ms debounced. Pan/zoom uses persistViewState(true), not saveLayout(). 100-box layout = 15-30KB, chrome.storage.local limit 5MB.

### Performance Invariants (BX-PERF-001..003)
- **BX-PERF-001 (MUST)**: moveGroupTogether MUST use spatial grid query for collision candidates, not linear others array scan. Grid built at drag-start, queried per member. Mark grid dirty on box position change outside drag (same pattern as __dsuDirty).
- **BX-PERF-002 (MUST)**: renderConnections SVG line pooling MUST NOT change renderCanvas full-rebuild semantics. Pool only the <line> SVG element creation/disposal in renderConnections. renderCanvas still does innerHTML='' + disposeAllConns() + full box recreation -- this preserves multi-tab sync safety (applyExternalLayout depends on clean DOM after render).
- **BX-PERF-003 (MUST)**: Do NOT add rAF batching to onBoxDragMove. The drag loop is synchronous per mousemove event: style.left/top update + refreshConnsForBoxSync + moveGroupTogether. rAF batching adds 1-frame (~16ms) latency that violates the follow-hand UX principle. moveGroupTogether O(m x n) is fixed by grid hash, not by frame batching.
- **BX-PERF-004 (MUST)**: Do NOT add WeakMap geometry caches for boxMidPoint. boxMidPoint reads el.style.left/top + width/height -- already O(1). A WeakMap cache would have near-zero hit rate during drag (the cached box is being moved every frame, invalidating its cache entry). Premature optimization.
- **BX-PERF-005 (MUST)**: Do NOT split saveLayout into incremental storage writes. chrome.storage.set() does not support partial key updates. Full JSON.stringify of 30KB layout takes <1ms. saveLayout is cold-path + 120ms debounced. Splitting into multiple keys would complicate cross-tab merge and add async round-trips.

## UI Standardization Glossary (ADR-0014, ADR-0015)
- **scrollbar-width: thin** (ADR-0014) — Standard CSS Scrollbars Styling Module Level 1 property applied to all scroll containers. Baseline available Dec 2024 (Chrome 121+, Firefox 64+). Replaces browser-default classic scrollbars with thin overlay style. Combined with `scrollbar-color` using design tokens (`--scrollbar-thumb` / `--scrollbar-track`). NEVER set `::-webkit-scrollbar` width — forces Chrome into classic mode. NEVER use global `*` selector.
- **Pin tooltip action semantic** (ADR-0015) — Pin/unpin button tooltip shows the AVAILABLE action, not current state: pinned -> `headerPinOff` (Unpin header), unpinned -> `headerPin` (Pin header). All `headerPinOff` locale messages must be action-descriptive, not state-descriptive.
- **enterAndLocateSmallBox** (ADR-0015) — Function that pans inner canvas to center a target small box and flashes an outline pulse highlight. Unified mental model with `openSearchHit`: same center-align + clamp pan formula, same highlight ring. Uses `outline` + `outline-offset` (not `box-shadow`) to escape `contain: layout style` clipping on `.small-box`. Wrapped in `requestAnimationFrame` to ensure `innerZoom` settled after `enterLargeBox`.
