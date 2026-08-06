# Boxing Build & Dev-Load

Boxing is a Chrome/Firefox browser extension built from a single source tree. The source manifest.json is intentionally Firefox-loadable / Chrome-rejectable (MV3 + browserSettings permission incompatibility). A cross-platform build script (.github/scripts/build.mjs) produces browser-tailored output trees.

## Implementation Status

Historical grill phase tables live in git history and `docs/roadmap-architecture-refactor.md` / `docs/adr/`. This file is a **glossary only** — not a status board.



Boxing is a Chrome/Firefox browser extension built from a single source tree. The source manifest.json is intentionally Firefox-loadable / Chrome-rejectable (MV3 + browserSettings permission incompatibility). A cross-platform build script (.github/scripts/build.mjs) produces browser-tailored output trees.

## Language

**Source tree**:
The raw checked-out repository root (D:/Aworker/crx/boxing). Contains manifest.json (Firefox-tailored), ntp/, background.js, _locales/, icons/, popup/. Can be loaded directly in Firefox for dev, but Chrome rejects it due to MV3 service_worker + background.scripts dual-spec and browserSettings permission.
_Avoid_: repo root, project root (ambiguous in multi-workspace setups)

**dist/boxing-chrome**:
Build output directory for Chrome. Contains manifest.json rewritten to Chrome-compatible form (background.scripts removed, service_worker only, browserSettings stripped) plus all ntp/ assets. Created by build.mjs on each run. This is the canonical Chrome extension directory.
_Avoid_: chromium build, chrome dist

**dist/boxing-firefox**:
Build output directory for Firefox. Contains manifest.json with browser_specific_settings.gecko block plus all ntp/ assets. Created by build.mjs on each run. This is the canonical Firefox extension directory.
_Avoid_: gecko build, firefox dist

**dev-chrome**:
NTFS junction (symlink on macOS/Linux) at repo root pointing to dist/boxing-chrome. Created by build.mjs as a post-build step. Exists solely as a convenience path for browser GUI Load Unpacked. Gitignored, machine-specific, zero storage cost.
_Avoid_: chrome symlink, chrome dev-link

**dev-firefox**:
NTFS junction (symlink on macOS/Linux) at repo root pointing to dist/boxing-firefox. Same pattern as dev-chrome. Loaded via about:debugging in Firefox.
_Avoid_: firefox symlink, firefox dev-link

**release artifacts**:
Packaged extension bundles produced by build.mjs inside dist/boxing-chrome/release/chrome/{boxing/, boxing-<ver>.zip, boxing-<ver>.crx} and dist/boxing-firefox/release/firefox/{boxing/, boxing-<ver>.zip, boxing-<ver>.xpi}. Three files per browser: unzipped dir, zip, and browser-native package (.crx for Chrome, .xpi for Firefox).
_Avoid_: packaged build, distribution bundle

**test/**:
In-tree Playwright test root at `test/` (NOT a separate `playwright/` sibling repo). `test/playwright.config.ts` resolves EXTENSION_PATH to repo root via `__dirname/..`. Specs in `test/tests/boxing-*.spec.ts` use a POSIX-safe `fileURLToPath` `__dirname` shim (required because `package.json` has `"type":"module"`). Run via `npm test` (= `npx playwright test --config=test/playwright.config.ts`). After `npm install`, browsers are NOT auto-installed; first-time users run `npx playwright install`. No hardcoded absolute paths; portable across Windows/Linux/macOS.
_Avoid_: playwright repo, separate test repo, ../playwright

**web-ext**:
Mozilla official dev tool (npm devDependency). npm run dev:chrome / dev:firefox launches browser with --source-dir pointing directly at dist/boxing-chrome / dist/boxing-firefox. Does not use dev-junctions.
_Avoid_: web-ext-cli, dev launcher

**build.mjs**:
Single canonical cross-platform build entry point at .github/scripts/build.mjs. Produces dist/boxing-chrome + dist/boxing-firefox + release artifacts + dev-junctions. Zero third-party deps (Node fs + minimal STORE-mode zip writer). No hardcoded absolute paths.
_Avoid_: build script, packaging script

**build-release.js**:
Thin cross-platform wrapper at scripts/build-release.js that spawns build.mjs. Supports BOXING_BUILD_VERSION env override.
_Avoid_: release wrapper


## Architecture Glossary (Post-Grill)

- **box.isParent**: Per-box boolean field (large + small). Replaces the deleted `layout.groups` array as the primary star-mark source. `groupStar` Set is populated from this field in `dsuRebuildFromConnections` and `ensureGroups`.
- **DSU (Disjoint Set Union)**: Group system for connection-based box grouping. `dsuRebuildFromConnections` unions connected boxes on tab load. `getGroupByParent(key)` returns members. `layout.groups` is a compat shim rebuilt by `ensureGroups()` — tests may reference it but new code should prefer DSU API.
- **SVG connection layer**: Self-drawn `<line>` elements in a `.conn-layer` SVG overlay (`z-index:0`, `pointer-events:none`). Replaces the previous LeaderLine vendor library (BX-142). Lines live inside `canvasSurface` / `innerSurfaceContent` and transform with the surface.
- **box drag positioning (BX-EXPLORE-005)**: Box dragging writes `el.style.left` / `el.style.top` only. Never use `transform: translate3d()` during drag (double-offset flash). See AGENTS.md BX-EXPLORE-005.
- **shape-rendering dynamic**: SVG lines switch `shape-rendering` to `crispEdges` at `zoom < 0.5` and `geometricPrecision` at `zoom >= 0.5` to prevent Chrome jagged-line rendering at low zoom.
- **storage.local**: Layout storage migrated from `storage.sync` (8KB/item, 120 writes/min) to `storage.local` (10MB / unlimited with permission) in A6. `saveLayoutDebounced()` retained for I/O performance.
- **web-ext**: Mozilla dev tool (npm devDependency). `npm run dev:chrome` / `dev:firefox` launches browser pointing at `dist/boxing-chrome` / `dist/boxing-firefox`.
- **Data Resilience (ADR-0009)**: Three copies (primary `storage.local` + up to 10 timestamped snapshots + JSON export), two transports (WebDAV + GitHub Gist), one crash rescue + field-level merge.
- **boxingSnapshots**: `Array<Snapshot>` stored under `storage.local`. `MAX_SNAPSHOTS=10`, single cap 2MB, total cap 8MB, LRU-pruned. Written by `saveSnapshot()` on every `performBackup()`; read by `getLatestSnapshot()`.
- **Snapshot**: `{ ts, schemaVersion, data }` where `data` is `stripGroupsForPersist(layout)` (no runtime `groups` field).
- **crashRescue()**: Invoked when `loadLayout` catch fires (corrupt/missing primary); rolls back to latest healthy snapshot via `migrateLayout(snap.data)`. If snapshot also corrupt → `defaultLayout()`.
- **schemaVersion**: `layout.schemaVersion:number` (default 1). Tracked on persisted layout + each snapshot, enables forward-only migrations on extension update.
- **mergeLayoutFields(cloudData, localData)**: Outbox-style field-level auto-merge on WebDAV concurrent-change detection (both sides changed since `lastSyncAt`). Box fields diverge ≤3 → merge; >3 fields diverge → keep local (newer-wins heuristic). Returns null → fall back to newer-wins + warn.
- **boxing-auto-backup alarm**: `chrome.alarms` alarm name `boxing-auto-backup` replaces `setInterval` so auto-backup survives NTP page close + service worker eviction. Listener registered ONCE at module scope via `ensureAutoBackupAlarmListener()`; `setupAutoBackup(sec)` only creates/refreshes the alarm (same name overwrites). Background SW listens + sends `boxing-auto-backup-trigger` message to open NTP tabs.
