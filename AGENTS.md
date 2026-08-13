<!-- BOXING-CTX-ROUTING-OVERRIDE:START -->
<!-- Project-level hard contract: compresses + localizes host AGENTS.md Tool routing precedence. Do not remove. -->
> **TOOL ROUTING — READ FIRST.** `ctx_*` (context-mode) PREFERRED over `shell`/inline `python -c`/inline `node -e` whenever both can do the job:
>
> - **Analyze/count/transform/read** source (ntp.js ~3.3k lines, background.js, _locales) → `ctx_execute`/`ctx_execute_file` in-sandbox. Print only the distilled answer (counts, offsets, hashes). Never `node -e "s.indexOf(...)"` + `print(s[i:i+N])` to dump source into the window.
> - **Run shell + collect >20 lines or ≥3 commands** (git, ls, test runs) → `ctx_batch_execute(commands, queries)` so only matched windows return; cap before entering conversation.
> - **Multi-file edits/patch scripts** → write the patch script as a file, invoke it via `ctx_execute_file` (shell/bash) OR `ctx_execute` (node/python) with `cwd`. Use `apply_patch` for small literal edits; do NOT chain PowerShell heredoc/`cat <<EOF` for content with `$`/Unicode/template literals (host swallows `$`, corrupts payload).
> - **Web fetch / repo research** → `ctx_fetch_and_index` + `ctx_search`; `curl`/`wget` are FORBIDDEN by host policy.
> - **Recall prior session /诚信记忆** → `ctx_search(source: "decision|error|user-prompt", sort: "timeline")` BEFORE asking the user what we did.
>
> **Boxing-local hot traps (Windows + MV3 + large ntp.js):**
> 1. `python -c "replace(...)"` for ntp.js minified blocks — `//` comments eat single-line-coerced blocks; whole-block edits MUST go through a real multi-line file write, not string `replace` with `"  "` separators.
> 2. IPv6 hosts: `new URL("https://[::1]/").hostname` keeps brackets — `isSafeExtUrl` strips `^[|]$` before matching `AUD_PRIVATE_HOST_RE`.
> 3. PowerShell `Remove-Item -Recurse -Force` is host-policy blocked; use `python pathlib.unlink()` or per-file `node fs.unlinkSync`.
> 4. CRLF: this repo is LF in source. `.gitattributes` enforces it; don't introduce CRLF via PS `Set-Content`. Verify with `git diff --check` before completion.
> 5. Large file patch rounds via `apply_patch` on minified-style lines: after 2 failures, do ONE verified whole-file rewrite (Node `fs.writeFileSync` with literal multi-line string), then `node --check` + `git diff --check`.
<!-- BOXING-CTX-ROUTING-OVERRIDE:END -->

# Browser Extension Agent Guide

## Applicability

| Field | Value |
|---|---|
| Scope | Browser extension development under `D:\Aworker\crx\boxing` |
| Primary reader | Future AI coding agents |
| Style | Machine-readable first: tables, command blocks, MUST/MUST NOT rules |
| Target browsers | Chrome + Firefox unless a project-specific guide narrows scope |
| Default implementation style | Minimal dependencies, standards-first WebExtension code |

## Hard Rules

| Rule ID | Type | Rule |
|---|---|---|
| CRX-R-001 | MUST | Treat this file as project-local operating instructions for browser extension work only. |
| CRX-R-002 | MUST | Prefer Manifest V3 for new or migrated Chrome/Firefox extension work. |
| CRX-R-003 | MUST | Preserve browser-extension constraints: popup, options page, new tab page, content scripts, background service worker, permissions, host permissions, and store submission metadata. |
| CRX-R-004 | MUST | Use the available Chrome extension development guidance before changing extension APIs, Manifest V3 behavior, service workers, content scripts, popup UI, side panel UI, or Chrome Web Store metadata. |
| CRX-R-005 | MUST | Use the available modern web guidance before choosing CSS, browser APIs, storage APIs, security patterns, or Baseline-sensitive features. |
| CRX-R-006 | MUST | Use the available frontend design guidance before changing popup, side panel, options page, new tab page, or injected content script UI aesthetics. |
| CRX-R-007 | MUST | Use available browser runtime tooling for screenshot, DOM, CSS, console, and network validation when visual or runtime behavior changes. |
| CRX-R-008 | MUST | Keep Chrome + Firefox compatibility visible in design and validation steps. |
| CRX-R-009 | MUST NOT | Do not add npm dependencies unless the user explicitly approves. |
| CRX-R-010 | MUST NOT | Do not default to shadcn/ui, Tailwind, Figma, React, Plasmo, Browserbase, or Stagehand. |
| CRX-R-011 | MUST NOT | Do not migrate an existing unpacked extension into WXT unless the user explicitly requests a full framework migration. |
| CRX-R-012 | IF-THEN | If a project-specific `agent.md` exists in a subdirectory, follow it after this guide. |
| CRX-R-013 | MUST | After every code/config/asset batch edit, immediately `git add -A && git commit -m "<summary>" && git push` (or `git commit` then push when remote reachable). NEVER only `node --check` or build-run without persisting a commit. Reason: working tree diff is NOT a record — only the commit/reflog history survives. Lone edits without commits have repeatedly lost weeks of work after a turn reset or context compression. Local commit without push (when remote unreachable) is acceptable as a stopgap; CI dispatch can sync later. Persist the user's work before claiming exit. |
| CRX-R-014 | MUST | Treat working-tree diff as transient: if you end a turn (or the user aborts) without a commit, every untracked edit risks being lost. Commit early, commit small. Use scoped commit messages (e.g. `fix(boxing): NTP surface clamp top:40px`) rather than one huge blob. |
| CRX-R-015 | MUST NOT | Do not `git reset --hard`, `git checkout -- <path>` to discard user-owned working-tree changes, or `git stash` to clear unless the user explicitly authorized it. A user pulling back a regression means surgical file revert by `apply_patch`, never HEAD pointer moves. |

## Approved CRX Capabilities

| Capability | Use when | Constraint |
|---|---|---|
| Chrome extension guidance | Manifest V3, service workers, popup/options/newtab UI, content scripts, permissions, Chrome Web Store readiness | Use for API correctness and publishing readiness. |
| Modern web guidance | Modern CSS, Baseline-compatible APIs, browser-platform behavior | Use for CSS/API currency and cross-browser support. |
| Frontend design guidance | High-aesthetic UI decisions for popup, side panel, options, new tab, or injected UI | Use before visual redesigns. |
| Browser runtime validation | Screenshot, DOM/CSS/runtime/console/network validation | Use after UI, manifest, service worker, or runtime changes. |
| Cross-browser validation | Firefox behavior checks and Chrome/Firefox parity | Use when feature behavior may differ by browser. |
| WXT framework | New Chrome+Firefox extension scaffolds | Use only for new scaffolds or explicit migration requests. |

## Build and Verification

| Scenario | Command or action | Expected result |
|---|---|---|
| Existing unpacked extension validation | Load unpacked extension in Chrome/Firefox | Extension loads without manifest errors. |
| UI verification | Use available browser runtime screenshot/DOM/console inspection | Visual result matches requested state. |
| Syntax pre-check | `node --check ntp.js && node --check background.js` | Both exit 0. |
| Full e2e | `cd D:/Aworker/crx/boxing && npx playwright test --config=test/playwright.config.ts --project=chromium --reporter=line` | ~3-4 min, all Boxing specs PASS (`extension-test.spec.ts` + `boxing-*` specs). |

## Playwright & Browser Testing

Test dir: `D:/Aworker/crx/boxing/test` (after `npm install` at repo root). `test/playwright.config.ts` `EXTENSION_PATH` path-resolves to `..` = repo root. Specs live in `test/tests/` and are prefixed `boxing-*`.
- Chromium project (headed, persistent context, `--load-extension`) is the primary lane.
- Firefox project uses `-no-remote`; LibreWolf is manual-verify only (no remote debug).
- Run a single spec: `npx playwright test --config=test/playwright.config.ts test/tests/boxing-viewstate-sync.spec.ts --project=chromium`.
- Test files: `boxing-*.spec.ts` (29 specs total, including `boxing-audit, boxing-auto-expand`, `data-recovery`, `extension-test`, and conn/DSU specs) cover NTP rendering, DOM, WebDAV sync, onboarding, memory, zoom, connections, and export/import. Run from repo root via `npm test` (alias for `npx playwright test --config=test/playwright.config.ts`).

## Chrome Extension Workflow

- **Dev load (recommended)**: `npm run dev:chrome` or `npm run dev:firefox` — uses web-ext (Mozilla official tool) to auto-launch browser with correct dist loaded. Requires `npm install` first.
- **GUI load** (browser extensions page): Chrome -> Load unpacked -> select `dev-chrome/` | Firefox -> Load Temporary Add-on -> select `dev-firefox/manifest.json`. Run `npm run build` first to create the junctions.
- Load unpacked (Chrome): `chrome://extensions` -> Developer mode -> Load unpacked -> select `dist/boxing-chrome/` (auto-discover from project root — do NOT load repo root in Chrome).
- Load unpacked (Firefox): `about:debugging` -> This Firefox -> Load Temporary Add-on -> select `dist/boxing-firefox/manifest.json` (or raw repo root for Firefox dev).
- Tip: If you accidentally load the repo root (`D:/Aworker/crx/boxing`) in Chrome, Chrome will show `background.scripts requires MV2` or `Permission 'browserSettings' unknown` — this is expected. Rebuild with `node .github/scripts/build.mjs` and load `dist/boxing-chrome/` instead.
- Inspect: service worker (`chrome://extensions` -> Details -> service worker), popup (right-click toolbar icon -> Inspect popup), errors (Errors button on extension card).
- MV3 requirements: valid `manifest.json`, service worker active, only declared permissions requested.
- New tab override should load `ntp/index.html` with beige theme and zero console errors.

# Boxing Project Specialization

## Applicability

| Field | Value |
|---|---|
| Project path | D:\Aworker\crx\boxing |
| Current extension | Boxing v3.7.0 |
| Current manifest | Manifest V3 |
| Target browsers | Chrome + Firefox |
| Main UI surface | New tab override: ntp/index.html, ntp/ntp.js (CSS via build artifact ntp/ntp.css — see ADR-0011) |

## i18n Requirements

| Rule ID | Type | Rule |
|---|---|---|
| BX-I18N-001 | MUST | All 14 supported languages (en, zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi, zh_TW) must have complete translations for every i18n key used in the UI. |
| BX-I18N-002 | MUST | New i18n keys must be added to _locales/<lang>/messages.json for all 14 languages before claiming completion. |
| BX-I18N-003 | MUST | Keys with $1$ or $2$ must include a placeholders object: { "1": { "content": "$1" } }. |
| BX-I18N-004 | MUST | Chrome i18n API (chrome.i18n.getMessage) is NOT used; the custom i18n store in ntp.js loads messages.json via fetch. |
| BX-I18N-005 | MUST | English fallback (I18N_FALLBACK) in ntp.js must cover every i18n key in case fetch fails. |
| BX-I18N-006 | MUST | data-i18n, data-i18n-title, data-i18n-placeholder attributes in HTML must match a real key. |

## Development Rules

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-001 | MUST | Use Obsidian-style CSS transform (translate + scale) for infinite canvas pan/zoom. |
| BX-DEV-002 | MUST | Drag uses mousedown/mousemove/mouseup (manual drag), NOT HTML5 drag-and-drop API. |
| BX-DEV-003 | MUST | Title editing zones (.large-box__title, .small-box__title) must block mousedown propagation to prevent drag and click-through. |
| BX-DEV-004 | MUST | Elastic snap on drag-end: collision detection -> find nearest non-overlapping edge -> snap. |
| BX-DEV-005 | MUST | Canvas pan via left-click-drag on empty canvas area; Ctrl+scroll zooms at cursor point. |
| BX-DEV-006 | MUST | Zoom controls in canvas bottom-right corner are fixed-position, unaffected by canvas transform. |
| BX-DEV-007 | MUST | Settings modal is an in-page overlay (not a separate options page). |
| BX-DEV-008 | MUST | Small boxes use list mode only; grid/list toggle removed. |
| BX-DEV-009 | MUST | Bookmark rows are editable via three-dots edit button (inline popup for title+URL). |
| BX-DEV-010 | MUST | Font size adjustable via CSS variable --font-size-base controlled by settings. |
| BX-DEV-011 | MUST NOT | Do not add shadcn/ui, Tailwind, React, Vue, or npm dependencies. |
| BX-DEV-012 | MUST NOT | Do not use brand__mark brown color block (removed). |
| BX-DEV-013 | MUST | CSS rules that affect both large-box and small-box canvases MUST be written in paired selectors (`.large-box` + `.small-box`). See [docs/css-dual-write-convention.md](docs/css-dual-write-convention.md) for the full convention. |
| BX-DEV-014 | MUST | SVG connection lines live in a `.conn-layer` SVG overlay with `pointer-events:none;z-index:0` — lines render BELOW boxes (z-index:1). Inline `z-index:2` on the SVG overlay is FORBIDDEN (Bug2 regression: lines appear above boxes). |
| BX-DEV-015 | SUPERSEDED | Superseded by **BX-EXPLORE-005** (2026-08, commit 17b305d). Do NOT use `translate3d` during box drag. Historical note only: older guidance preferred GPU transform; it caused double-offset flash when combined with `left`/`top`. |
| BX-DEV-016 | SUPERSEDED | Superseded in part by **BX-EXPLORE-006**. Do NOT put `translateZ(0)` / `will-change: transform` on boxes, `--dragging`, `canvasSurface`, or `innerSurfaceContent` (Chrome fixed-bitmap blur at low zoom). Canvas pan/zoom may still use a plain CSS `transform: translate() scale()` without `will-change` or forced `translateZ(0)` on box nodes. |
| BX-DEV-017 | MUST | SVG `shape-rendering` MUST be dynamic: `crispEdges` at zoom<0.5, `geometricPrecision` at zoom>=0.5. Fixed `geometricPrecision` at low zoom causes jagged lines in Chrome (Bug4). |
| BX-DEV-018 | MUST | Connection line updates during drag MUST use `connById.get(id)` (O(1) Map lookup), NOT `layout.connections.find()` (O(n) scan). The latter causes frame drops with many connections (Bug1). |
| BX-DEV-019 | MUST | DSU is the group system: `box.isParent` marks parent; membership from connections via DSU; `layout.groups` is runtime-only computed (ADR-0007). |
| BX-DEV-020 | MUST | CSS selectors that carry a layout `display` value (flex/block/grid/inline-flex) MUST be paired with a `.selector[hidden] { display: none; }` fallback, OR fully own visibility via JS toggling a class whose rules NEVER set `display` directly. Without the pair, HTML `hidden` attribute is overridden by CSS `display:flex|block` and the container stays visible despite `hidden` (MDN: changing `display` on a hidden element overrides the `hidden` state). Bug: `<div class="inner" hidden>` rendered because `.inner { display:flex }` lacked `.inner[hidden] { display:none }` fallback; `#inner` stayed under `#canvas`, surfacing an inner-canvas under the large-canvas. Apply to `.inner` and `.canvas` (handled in base.css). |

## i18n Development Requirements

| Rule ID | Type | Rule |
|---|---|---|
| BX-I18N-DEV-001 | MUST | Every UI string visible to users must use the i18n(key) function, never hard-coded English/Chinese text. |
| BX-I18N-DEV-002 | MUST | All 14 supported languages (en, zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi, zh_TW) must have translations for every i18n key. |
| BX-I18N-DEV-003 | MUST | When adding a new i18n key, add it to _locales/en/messages.json first, then copy to all 12 other locale files with proper translations. |
| BX-I18N-DEV-004 | MUST | I18N_FALLBACK in ntp.js must contain every i18n key as a fallback for when fetch fails. |
| BX-I18N-DEV-005 | MUST | All data-i18n, data-i18n-title, data-i18n-placeholder attributes in HTML must match an existing key in messages.json. |
| BX-I18N-DEV-006 | MUST | Keys with placeholders ($1$, $2$) in messages.json must include a "placeholders" object per Chrome i18n spec. |
| BX-I18N-DEV-007 | MUST | The custom i18n loader in ntp.js fetches _locales/<lang>/messages.json; chrome.i18n.getMessage API is NOT used. |
| BX-I18N-DEV-008 | MUST NOT | Never add hardcoded language strings in JS or HTML that bypass the i18n(key) function. |
| BX-I18N-DEV-009 | MUST | After changing language in settings, re-render all visible UI (canvas, inner surface, crumbs, caption) to reflect new language immediately. |

## Code Exploration

| Rule ID | Type | Rule |
|---|---|---|
| BX-EXPLORE-001 | MUST | All project exploration (searching files, reading source, analyzing structure) MUST use .codegraph (ctx tools / codegraph DB) as the primary index. Direct filesystem traversal (ls, dir, Get-ChildItem for source discovery) is prohibited unless .codegraph is unavailable or the task is trivially scoped to one known file. |
| BX-EXPLORE-002 | MUST | Before answering any "where is X", "how many Y", "what does Z do" question about the codebase, query .codegraph first (via ctx_search or ctx_execute_file over the DB). Only fall back to direct file reads when .codegraph lacks the needed granularity. |
| BX-EXPLORE-003 | MUST | After every project modification (edit, add, delete, rename a source file), run `codegraph sync` from the repo root so the index reflects the change. Do NOT wait until session end — index staleness makes all downstream exploration (BX-EXPLORE-001/002) return wrong results. CLI: `codegraph sync` (incremental) or `codegraph index` (full rebuild). |
| BX-EXPLORE-004 | MUST | Before planning, bug-hunting, or grilling architectural questions, query .codegraph first (`codegraph explore <query>`, `codegraph callers <symbol>`, `codegraph impact <symbol>`, or `codegraph query <name>`). Use the symbol graph to trace call paths, find dependents, and measure blast radius before editing. Only fall back to ad-hoc grep/read when .codegraph genuinely lacks the needed symbol (e.g. new code added in the same turn but not yet synced). |
| BX-EXPLORE-005 | MUST | Box dragging MUST use `left`/`top` only — NEVER `transform: translate3d()` during drag. Writing both `left/top` AND `transform: translate3d(sameX, sameY, 0)` causes double-offset: CSS layout positions at (X,Y) then transform shifts by another (X,Y), element flashes to (2X, 2Y). Regression introduced in commit 0a5483d, fixed in 17b305d. |
| BX-EXPLORE-006 | MUST | NEVER add `will-change: transform` or `translateZ(0)` to `.large-box`, `.small-box`, `--dragging` variants, `canvasSurface`, or `innerSurfaceContent`. Chrome rasterizes `will-change: transform` elements into a fixed bitmap that does NOT re-raster on CSS `scale()` changes (per Chrome Re-rastering blog https://developer.chrome.com/blog/re-rastering-composite). At low zoom (< 50%) this produces blurry text; at high zoom it looks fine, masking the bug. Firefox uses a different raster model so it is unaffected. If FPS optimization is needed for Firefox drag, use CSS `transition: none` on `--dragging` state instead of GPU compositing hints. |
| BX-EXPLORE-007 | MUST | Hot-path functions called on every `mousemove` (e.g. `refreshConnsForBoxSync`) MUST use O(1) lookups — never `layout.connections.find()` when `connById` Map already exists. Before adding any `.find()` in a drag handler, check codegraph for an existing O(1) index. Regression introduced in commit 0a5483d (titled "conn lookup O(1)" but missed this hot path), fixed in 17b305d. |
| BX-EXPLORE-008 | MUST | Pan/zoom handlers (`onCanvasPanMove`, `onInnerPanMove`) MUST call `scheduleConnRefresh(all conn ids)` after `applyCanvasTransform`/`applyInnerTransform`. Without this, viewport-culled lines (`display:none` set by `updateSvgLine`) never get re-evaluated when the world window shifts via pan, causing lines to remain hidden after panning them back into view. The SVG coordinates update via CSS transform automatically, but the cull decision does NOT. Regression introduced in commit a715a44 (pan-aware `connSvgVisibleRect`), fixed immediately after. |
| BX-EXPLORE-009 | MUST | When adding new event handlers that modify layout state (connections, groups, box properties), the persistence call MUST match an existing function name. Do NOT write `persistLayoutDebounced()` — the correct name is `saveLayoutDebounced()`. A typo'd function name silently fails (ReferenceError caught by try/catch in upper frames), leaving state un-persisted, causing data loss after cross-tab merge or reload. Regression: Alt+Click conn delete used `persistLayoutDebounced` (never defined) → star status lost on re-link. |
| BX-DEV-139 | MUST | Connection line delete is user-configurable via `layout.settings.connDeleteAction` (string enum: `alt+click`/`ctrl+click`/`shift+click`/`double-click`/`select+delete`). Never hardcode a single delete trigger — use `getConnDeleteTrigger()` and the unified `onConnLinePointerDown(e)` detector. When mode changes, UI handler MUST `disposeAllConns()` + `renderConnections()` so mode-specific listeners (dblclick/mousedown) re-attach to fresh `<line>` elements; the renderConnections pending path is the only place that registers them. See ADR-0006 (`docs/adr/0006-conn-delete-action-system.md`). |
| BX-DEV-140 | MUST | Color theme is user-selectable via `layout.settings.theme` (string: 'beige'/'graphite'/'coastal'/'forest'/'pure', default 'beige'). The `applyTheme(themeKey)` function in ntp.js injects all theme CSS variables (warm bg + accent ramps) via `setProperty`. Default 'beige' matches CSS hardcoded values (no override). See ADR-0012 (`docs/adr/0012-curated-theme-packs.md`). |
## CSS Dual-Write Convention (Global)

> **Global convention document: [docs/css-dual-write-convention.md](docs/css-dual-write-convention.md)**
**Design system document: [docs/DESIGN.md](docs/DESIGN.md)** — token architecture (primitive→semantic→component), palette, typography, component state specs, dark mode strategy. See ADR-0008. — every CSS rule that affects both `.large-box` and `.small-box` MUST use paired selectors and a code comment marker. See BX-DEV-013 above for the MUST rule. When adding a new visual rule, check the convention doc first to confirm the required markers.

## Debug Development

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEBUG-001 | INFO | Set DEBUG = true in ntp.js during development; all [Boxing] prefixed console logs help trace issues. |
| BX-DEBUG-002 | MUST | Use Playwright (`test/playwright.config.ts`) for automated e2e testing during development. Run from repo root: `npm test` or `npx playwright test --config=test/playwright.config.ts`. |
| BX-DEBUG-003 | MUST | After each major change, run "node --check ntp.js" to verify syntax before testing in browser. |
## CSS Token Baseline (Boxing v3.7)

| Token | Value | Purpose |
|---|---|---|
| --color-canvas | #F7F3ED | Main warm-neutral canvas. |
| --color-surface | #F3EFE7 | Card surface. |
| --color-elevated | #F0EBE2 | Hover/selected/elevated layer. |
| --color-ink | #2A2520 | Primary near-black text. |
| --color-accent | #A08060 | Muted warm earth accent (beige theme default; overridden by applyTheme for other themes). |
| --font-size-base | 14px | Adjustable base font size. |

## Architecture (v3.7)

- Infinite canvas: CSS transform(translateX, translateY) scale(Z) on canvas__surface
- Pan: drag empty canvas area (mousedown+mousemove)
- Zoom: Ctrl+scroll at point, Ctrl+/- step zoom, zoom buttons
- Nodes (boxes): absolute positioning in world coordinates
- Dual-level: Canvas (large boxes) -> Inner canvas (small boxes inside one large box)
- Bookmarks: list rows with favicon + three-dots edit button (inline popup for title+URL)
- No grid/list toggle — small boxes are always list mode

## Critical Lessons Learned

1. **Never place executable code before `const`/`let` declarations it references.** `debug()` calling before `const DEBUG` causes TDZ ReferenceError that silently breaks the entire IIFE execution — all subsequent functions and DOM bindings are never defined.
2. **Never place IIFE-scoped code outside the IIFE closing `})();`.** External references to `I18N_FALLBACK` etc throw ReferenceError and halt execution.
3. **Function hoisting does NOT mean safe to call before `let`/`const` init.** Functions referencing `let`/`const` variables in their closure will throw TDZ errors if called before the variable declaration executes.
4. **When debugging "all box creation broken", check console errors FIRST.** Two TDZ errors (`I18N_FALLBACK is not defined`, `Cannot access 'DEBUG' before initialization`) caused the entire init to fail silently — no functions were defined, no events were bound.
5. **Layout mutations go through `commit(op)` (ADR-0007 Q2)** for conn/star/delete paths — handlers mutate data; commit owns tombstone/DSU/viewState/save side effects. Do not reintroduce parallel prune of `layout.groups`.
5b. **Every derived index is a liability.** When adding a new data structure (connById, boxConnIdx, groupStar, layout.groups), EVERY mutation path (addConnection, removeConnection, _execDeleteLargeBox, _execDeleteSmallBox, toggleStarMark) must update ALL of them. Missing one = bug. See [docs/archive/architecture-audit.md](docs/archive/architecture-audit.md) Part 1.
6. **The tombstone system is the cross-tab delete contract.** `markDeleted(id)` + `mergeByIdUnion` filter is the ONLY mechanism that prevents resurrection from remote tab state. Any new delete path MUST call `markDeleted` before filtering the array. Never delete by filter alone.
7. **`layout.groups` is runtime-only (ADR-0007 Q1), NOT persisted.** Star truth is `box.isParent`; `ensureGroups()` computes membership from DSU. `saveLayout` must call `stripGroupsForPersist`. Never merge `groups` cross-tab.
8. **CSS invariants are load-bearing.** `z-index` (BX-DEV-014), `will-change`/`translateZ(0)` (BX-EXPLORE-006), `shape-rendering` (BX-DEV-017), `translate3d` vs `left/top` (BX-EXPLORE-005) — each has a specific reason grounded in browser rendering behavior. Violating them causes visual regressions that are extremely hard to debug.
9. **The "fix one bug, introduce another" pattern exists because mutation paths are scattered.** Each of removeConnection, _execDeleteLargeBox, _execDeleteSmallBox, toggleStarMark has its own cleanup sequence. A single unified `mutateLayout(operation)` API would eliminate this. See docs/archive/architecture-audit.md (archived) — see bug pattern table 3 for the coupling map.
10. **Hot-path functions (called during mousemove) MUST use O(1) Map/Set lookups.** Never use `layout.connections.find()` or `layout.boxes.find()` in a drag handler. Pre-build `connById`, `boxConnIdx`, and (future) `boxById` indices. See BX-EXPLORE-007, BX-DEV-018.
11. **DSU rebuild is O(n) — gate it behind `__dsuDirty` / `markDsuDirty()` (ADR-0007 Q4b).** Never rebuild DSU on mousemove; only on conn/star/delete/load/external.
12. **`moveGroupTogether` is O(m*n) per frame — the main performance hotspot.** For each group member, `elasticSnap` scans all non-group boxes. At >10 boxes this causes frame drops. Future: pre-compute a spatial index (grid hash) at drag-start. See docs/archive/architecture-audit.md (archived) — see bug pattern table 4.2, Hotspot 1.

## Boxing Version History

Historical version notes (v3.3 → v3.6.6 features and incremental dev rules) have been moved to `docs/boxing-changelog.md` to keep this operating contract lean. See that file for per-version feature lists, BX-DEV rule additions, and i18n key references by version.

Current TOP-LEVEL operating dev rules are consolidated in the tables above (BX-DEV-001..020). All incremental rules from v3.3..v3.6.6 (BX-DEV-014..112) live in `docs/boxing-changelog.md` alongside their release context. The Security Rules section below is the authoritative SEC-series list.

## Manifest Source-of-Truth Contract (v3.7.0+)

> **🔥 HARD CONSTRAINT — DO NOT VIOLATE 🔥**
> The repository root `manifest.json` is a **full-compat dual-declaration** manifest. It MUST keep
> `background.service_worker` AND `background.scripts` simultaneously, MUST keep
> `permissions.browserSettings`, and MUST keep `browser_specific_settings.gecko`. Removing any of
> these breaks one browser or the other:
> - Remove `background.scripts` → Firefox fails to load with `background.service_worker is currently disabled. Add background.scripts.`
> - Remove `permissions.browserSettings` → Firefox loses the permission the extension relies on.
> - Remove `browser_specific_settings.gecko` → Firefox loses the extension ID needed for upgrade and sync identity.
> - Keep `background.scripts` in MV3 → Chrome < 121 refuses to load with `'background.scripts' requires manifest version of 2 or lower.` Chrome ≥ 121 ignores it (ignored ≠ rejected), so the dual-declaration is *the* supported cross-browser pattern per MDN.
> - Keep `permissions.browserSettings` in a Chrome-loadable manifest → Chrome reports `Permission 'browserSettings' is unknown.` on every Chrome version (Chrome never supported this permission).
> So the source manifest is **intentionally Firefox-loadable and Chrome-rejectable**. Chrome dev/testing MUST load `dist/boxing-chrome/` or `dist/boxing-chrome/release/chrome/boxing/` instead, where the Tailor step has stripped the Firefox-only fields.

| Rule ID | Type | Rule |
|---|---|---|
| BX-MANIFEST-001 | **MUST / RED LINE** | The root `manifest.json` is a **full-compat dual-declaration** manifest and MUST keep all four Firefox-compat fields at all times: `background.service_worker`, `background.scripts`, `permissions.browserSettings`, `browser_specific_settings.gecko`. **Removing any of these to "fix Chrome direct loading" is forbidden** — it breaks Firefox direct loading. This constraint exists because a previous round stripped `scripts`/`browserSettings`/`gecko` to make Chrome < 121 happy, and Firefox loading the raw repo then failed with `background.service_worker is currently disabled. Add background.scripts.` — a regression that took the user hours to surface. **Learn from history.** |
| BX-MANIFEST-002 | MUST | `.github/scripts/build.mjs` is the single canonical build entry point (CI + local). It outputs `dist/boxing-{chrome,firefox}/` + nested `release/{chrome,firefox}/` with 3 artifacts each: unpacked `boxing/`, `.zip`, `.crx`/`.xpi`. Cross-platform thin wrappers `tools/build.ps1` (Windows) and `tools/build.sh` (Linux/macOS) simply call `node .github/scripts/build.mjs` — no duplicate build logic. |
| BX-MANIFEST-003 | MUST | **Chrome Tailor** MUST remove the Firefox-only fields: replace `m.background` with `{ service_worker: 'background.js' }` (drop `scripts`); filter `browserSettings` out of `permissions`; `delete m.browser_specific_settings`. **Firefox Tailor** MUST drop `service_worker` (full replace `m.background = { scripts: ['background.js'], type: 'module' }` — do NOT `Object.assign` which would leak `service_worker` into the Firefox manifest). Both must add `permissions.browserSettings` only for Firefox and `browser_specific_settings.gecko` only for Firefox. |
| BX-MANIFEST-004 | MUST | After any change to source `manifest.json` OR `ntp/` OR `background.js`, `build.mjs` MUST be re-run; otherwise `dist/` will be stale vs the source. Run: `node .github/scripts/build.mjs` or use wrapper `tools/build.ps1` (Windows) / `tools/build.sh` (Linux/macOS). Stale `dist/` is the root cause of user-facing "旧版 UI" symptoms when loading the rebuilt package. |
| BX-MANIFEST-005 | MUST NOT | Do NOT attempt to make the *source* `manifest.json` directly Chrome-loadable by stripping Firefox-compat fields. The supported Chrome dev workflow is to load `dist/boxing-chrome/` (or `dist/boxing-chrome/release/chrome/boxing/`) — both are produced by Chrome-Tailor and contain NO `background.scripts`, NO `browserSettings`, NO `gecko`. The source manifest is Firefox-direct-loadable by design, Chrome-direct-loadUnsupported by design, and this asymmetry is the intended trade. |
| BX-MANIFEST-006 | INFO | MDN canonical reference ([Cross-browser MV3 background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)): dual declaring `scripts` + `service_worker` is the official cross-browser pattern. Chrome < 121 still rejects it (limitation of old Chrome, not the manifest), Chrome ≥ 121 ignores `scripts`. Firefox uses `scripts` and ignores `service_worker`. The source manifest honors this dual-declaration pattern verbatim. |
| BX-MANIFEST-007 | MUST | When tests verify "loads in both Chrome and Firefox", the Chrome test target is `dist/boxing-chrome` (or `dist/boxing-chrome/release/chrome/boxing/`), NOT the raw repo `D:/Aworker/crx/boxing/`. The Firefox test target is the raw repo (`about:debugging` "Load Temporary Add-on" → point at `D:/Aworker/crx/boxing/manifest.json`) OR `dist/boxing-firefox` — both Firefox-loadable. Mixing the two (loading the raw repo in Chrome, or chrome-tailored build in Firefox) will surface manifest rejection errors. |

## Security Rules (SEC series — v3.7.9f security audit)

| Rule | Level | Description |
|---|---|---|
| SEC-01 | MUST | Mock fallback api = mock MUST NOT pollute self.chrome / self.browser globals. Keep mock local to avoid breaking other extensions or browser internals in file:// test mode. |
| SEC-03 | MUST | All contentEditable title elements MUST have a paste event listener that forces plain-text insertion via document.execCommand('insertText', false, ...). Prevents rich-text/HTML injection through paste. Applies to: large box title, small box title, inner crumb title. |
| SEC-06 | MUST | Import JSON payloads MUST be size-capped at 2MB (JSON.stringify(data).length > 2_000_000 → rejected). Prevents stack overflow / OOM from excessively deep or large malicious imports. |
| SEC-08 | MUST | High-frequency saveLayout() calls (drag end, pan end, zoom) MUST use saveLayoutDebounced() with 300ms debounce. Direct saveLayout() retained for critical paths: enter/exit boxes, delete, pin/expand toggle, title blur, import. Note: as of A6, layoutStorage uses storage.local (10MB / unlimited with permission), not storage.sync — storage.sync has a 100KB total / 8KB per-item quota and a 120 writes/min (2/sec) rate limit. storage.local removes the rate limit but keep the debounce for I/O performance. |
| SEC-11 | MUST | ensureHttpsUrl() MUST reject javascript:, data:, vbscript: protocols before any URL construction. These dangerous protocols are returned as-is (unmodified) so callers can reject them further. |
| SEC-15 | MUST | ntp/index.html MUST include a <meta> Content-Security-Policy header: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' https: data:; connect-src 'self' https:;. This prevents XSS, inline script injection, and unauthorized external resource loading. |
