# Boxing Build & Dev-Load

Boxing is a Chrome/Firefox browser extension built from a single source tree. The source manifest.json is intentionally Firefox-loadable / Chrome-rejectable (MV3 + browserSettings permission incompatibility). A cross-platform build script (.github/scripts/build.mjs) produces browser-tailored output trees.

## Grill Audit 2026-08-02 — Phase Status

Six-phase plan executed. Phases 1-6 done.

| Phase | Status | Commit | Summary |
|---|---|---|---|
| 1 Baseline tests | ✅ done | cc45cbf | 10 conn-DSU Playwright specs + CONTEXT.md + ADR-0001 |
| 2 A5: star-mark on box.isParent | ✅ done | b570908 | layout.groups deleted; groupStar populated from box.isParent; lazy DSU rebuild guard in getGroupByParent |
| 3 A6: storage.sync -> storage.local | ✅ done | 959d6bb | layoutStorage = storage.local; unlimitedStorage permission; one-time sync->local migration cleanup in loadLayout |
| 4 A4: 4 perf optimizations | ✅ done | 4e29804 | viewport culling + LOD stroke + zoom-triggered refreshAllConns |
| 5 A7+A8: build-time validators | ✅ done | 80c182f | i18n key consistency + CSS dual-write marker validators in build.mjs |
| 6 Docs + ADRs + AGENTS.md | ✅ done | 1d76ca2 + this commit | CSS dual-write global section in AGENTS.md; SEC-08 corrected; ADR-0002..0005 written |
| Bug-4 regression test | ✅ done | (worktree+playwright) | A4/Bug4 spec asserts parent drag moves members rigidly |

Bug 4 (DSU group drag members flying off) is not a regression: verified by new spec
that B moves by dX=100 with grid-snap slack (observed dx=56; snapped back to grid)


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

**web-ext**:
Mozilla official dev tool (npm devDependency). npm run dev:chrome / dev:firefox launches browser with --source-dir pointing directly at dist/boxing-chrome / dist/boxing-firefox. Does not use dev-junctions.
_Avoid_: web-ext-cli, dev launcher

**build.mjs**:
Single canonical cross-platform build entry point at .github/scripts/build.mjs. Produces dist/boxing-chrome + dist/boxing-firefox + release artifacts + dev-junctions. Zero third-party deps (Node fs + minimal STORE-mode zip writer). No hardcoded absolute paths.
_Avoid_: build script, packaging script

**build-release.js**:
Thin cross-platform wrapper at scripts/build-release.js that spawns build.mjs. Supports BOXING_BUILD_VERSION env override.
_Avoid_: release wrapper
