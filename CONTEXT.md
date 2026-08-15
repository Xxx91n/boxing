# Boxing Build & Dev-Load

Boxing is a Chrome/Firefox browser extension built from a single source tree. The source manifest.json is intentionally Firefox-loadable / Chrome-rejectable (MV3 + browserSettings permission incompatibility). A cross-platform build script (.github/scripts/build.mjs) produces browser-tailored output trees.

## Cross-Platform Pipeline Invariants (BX-XPLAT)

- **BX-XPLAT-001**: build.mjs is the single canonical build entry. tools/build.sh and tools/build.ps1 are thin wrappers (5 lines each) that call it — no duplicate build logic. The deleted scripts/build-release.js is NOT a valid reference.
- **BX-XPLAT-002**: dev-junctions created via fs.symlinkSync(target, path, type) where type is "junction" on Windows (no admin rights needed) or "dir" on Unix. Never use execSync mklink.
- **BX-XPLAT-003**: Test files use url.pathToFileURL(path.resolve(...)).href for file:// URLs. Never manually concatenate "file:///" + path.replace(/\\/g, '/').
- **BX-XPLAT-004**: CI workflows use OS matrix [ubuntu-latest, macos-latest, windows-latest]. Playwright browser cache paths differ per runner.os (~/.cache/ms-playwright on Linux, ~/Library/Caches/ms-playwright on macOS, ~\AppData\Local\ms-playwright on Windows).
- **BX-XPLAT-005**: CRX signing uses crx3 npm devDependency (Node-based, cross-platform). CRX key decoded via node -e Buffer.from(base64), not base64 -d (Linux-only).
- **BX-XPLAT-006**: .gitattributes has explicit text eol=lf rules for .sh, .mjs, .ts, .json, plus eol=crlf for .bat, .cmd, .ps1.

## Implementation Status

Historical grill phase tables live in git history and `docs/archive/` / `docs/adr/`. This file is a **glossary only** — not a status board.



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

**tools/build.sh / tools/build.ps1**:
Thin cross-platform wrappers that spawn build.mjs. `tools/build.sh` (Linux/macOS bash) and `tools/build.ps1` (Windows PowerShell) — both just call `node .github/scripts/build.mjs`. No duplicate build logic.
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

- **optional_host_permissions**: Chrome MV3 manifest field. Broad host access (e.g. `https://*/*`) moved here from `host_permissions` for Chrome Web Store compliance. Requested at runtime via `chrome.permissions.request({origins})` when user enables WebDAV backup. Firefox build keeps `host_permissions` as required (AMO review is more tolerant of WebDAV use cases).
- **privacy policy URL**: HTTPS-accessible URL required by Chrome Web Store and AMO for listing. For Boxing: `https://xxx91n.github.io/boxing/privacy-policy.html` via GitHub Pages from `docs/privacy-policy.md`.
- **CRX3 signing**: Chrome extension packaging format. RSA 2048-bit `.pem` key generated via `openssl genrsa`. CI packs zip into `.crx` using `crx3` npm tool with key from GitHub Secret `CRX_PRIVATE_KEY_PEM` (base64-encoded). Key loss = new extension ID required.
- **AMO signing**: Firefox add-on signing via `web-ext sign --api-key XXX --api-secret YYY --source-dir path --channel unlisted`. Credentials from AMO Developer Hub → API Keys page. Stored as GitHub Secrets `AMO_API_KEY` + `AMO_API_SECRET`.
- **store listing**: Chrome Web Store / AMO listing metadata. Short description (132 chars, from manifest `description`), detailed description (up to 16K chars, store-specific), screenshots (1280x800 PNG), promo images (440x280 small, 920x680 large).
- **dev-junctions**: NTFS junctions (`dev-chrome` → `dist/boxing-chrome`, `dev-firefox` → `dist/boxing-firefox`) created by build.mjs for browser GUI Load Unpacked convenience. Gitignored, machine-specific.

## UI Standardization Glossary (ADR-0014, ADR-0015)

- **scrollbar-width: thin**: CSS Scrollbars Styling Module Level 1 standard property. Applied to all scroll containers in the extension. Makes Chrome (121+) and Firefox (64+) render thin overlay scrollbars that don't occupy layout space. Overrides legacy `::-webkit-scrollbar` pseudos when set to non-initial value (CSSWG 2024 resolution). Paired with `scrollbar-color` using `--scrollbar-thumb` / `--scrollbar-track` design tokens.
_Avoid_: ::-webkit-scrollbar width hack, custom JS scrollbar

- **Pin tooltip action semantic**: Tooltip on the header pin button describes the *action that clicking will perform*, not the current state. When pinned (⊙), tooltip says "Unpin header" (取消固定); when unpinned (○), tooltip says "Pin header" (固定顶栏). JS mapping: `headerPinned ? i18n('headerPinOff') : i18n('headerPin')` — keys are inverted from their message-name intuition because they describe the click action, not the visual state.
_Avoid_: state-descriptive tooltip ("Header unpinned"), static HTML data-i18n-title without JS sync

- **enterAndLocateSmallBox(largeId, smallId)**: Function that enters a large box and centers a specific small box in the inner canvas viewport, then flashes a 2s highlight ring. Uses the same center-align pan formula as `openSearchHit()` — target box center maps to viewport center, clamped to canvas bounds. Highlight uses `outline` + `outline-offset` (not `box-shadow`) because `contain: layout style` on `.small-box` clips box-shadow spread beyond the border box. Wrapped in `requestAnimationFrame` to ensure DOM and `innerZoom` are settled after `enterLargeBox()`.
_Avoid_: corner-align pan formula (legacy openSearchHit), box-shadow pulse (clipped by contain)


## Accent Theme Glossary (ADR-0010)

- **AccentHue**: Integer 0-360 stored in layout.settings.accentHue. Drives HSL derivation of accent-300/500/600 (light + dark). Default 30 (warm earth). 
ull means mono (grayscale) preset.
- **AccentPreset**: String key stored in layout.settings.accentPreset (e.g. 'warm', 'mist', 'ink', 'plum', 'brick', 'pure'). Maps to a preset hue value for UI button highlight; the actual color source is ccentHue.
- **themeManager**: ~80-line inline module in ntp.js. Contains preset list, HSL constants (ACCENT_LIGHT/ACCENT_DARK), derivation function, and pplyAccent(hue) entry point. Overrides Layer 1 accent primitives at runtime via document.documentElement.style.setProperty.
- **HSL derivation**: Fixed S/L constants per accent tier. Light: {300:{29%,60%}, 500:{25%,50%}, 600:{27%,34%}}. Dark: {300:{30%,64%}, 500:{30%,58%}, 600:{33%,69%}}. Hue is the only variable. Low saturation preserves brand matte aesthetic.
- **Mono preset (Pure White)**: Special preset where ccentHue = null. JS injects grayscale ramp (#888/#777/#555 light, #AAA/#AAA/#CCC dark) instead of HSL derivation. Inspired by Codex App's minimalist white aesthetic.