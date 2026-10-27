# Boxing Test Suite

Playwright end-to-end tests for the Boxing browser extension.

## Setup (first time after clone)

```bash
npm install
npx playwright install firefox chromium
```

> **Required:** You must run `npx playwright install firefox chromium` once after cloning.
> The `postinstall` hook will remind you if you forget. Without the browser binaries,
> tests will fail with "Executable doesn't exist" errors.

## Running tests

```bash
# All tests (both browsers)
npm test

# Chrome only
npm run test:chromium

# Firefox only
npm run test:firefox

# Rerun only what failed last run (native Playwright cache, no new dependency)
npm run test:failed
npm run test:failed -- --project=chromium-extension

# Bounded changed-surface run (see Test governance below)
npm run test:changed
TEST_SURFACE_DRY_RUN=1 npm run test:changed   # print the command only

# Debug mode (Chrome, headed, slow)
npm run test:debug
```

## Configuration

- Config: `test/playwright.config.ts`
- Specs: `test/tests/boxing-*.spec.ts`
- Extension path: resolved from config via `__dirname/..` (repo root)
- Projects: `firefox-extension` and `chromium-extension` only; the Firefox lane runs
  headless (wave-2026.10.11) — native-input realness specs stay chromium-scoped.

## CI

Tests run on GitHub Actions via `.github/workflows/test.yml`. Browser binaries are
cached via `actions/cache` keyed on `package-lock.json` hash.

## Test governance

Model: file-level spec-cluster mapping + native Playwright filtering, full suite as
the conservative fallback. No new runner, build system, or dependency.

**Resource ceilings (explicit policy, not ad hoc flags)**

| Surface | Policy |
| --- | --- |
| Local workers | 2 — 4 still produced rotating chromium timeouts under desktop-app contention on this 8-thread host (issue #36) |
| CI workers | 2 — GitHub standard runners have 4 cores; 2–4 workers is the measured sweet spot |
| Firefox content processes | 4 per browser — Playwright's `dom.ipc.processCount=60000` default let every `file://` page take a process and the suite accumulated 156 processes / ~6GB (issue #36) |
| Default test timeout | 60s — slow-host headroom; specs that need more set their own |
| CI job budget | `timeout-minutes: 30` on every matrix job (main + quarantine lanes) |
| CI cancellation | `concurrency` + `cancel-in-progress: true`; a superseded push cancels its stale run |
| Linux headed browsers | run under `xvfb-run` (same pattern the quarantine lane already proves) |

**Failure recovery**

`npm run test:failed` reruns only the last run's failures via Playwright's
native `--last-failed` cache (`test-results/.last-run.json`, uploaded as a CI
artifact). Convergence method: batch `--last-failed` rerun first, then a solo
rerun for any straggler; a timeout-only failure must pass a solo run before being
called environmental. Failure history is never used to *select* what runs on a
change — only to *retry*.

**Changed-surface selection**

`npm run test:changed` (see `scripts/test-surface.mjs`) diffs the working tree
(plus `$GITHUB_BASE_SHA` in CI, plus the last commit as a local fallback), maps
each changed file through `test/cluster-map.json`, and runs the union of the
matched clusters' specs. Conservative rules — any of these means the **full
suite**, never a silent skip:

- the mapping file is missing or malformed;
- a changed file is under `test/`, `.github/`, or is `package(.lock).json`;
- a changed file maps to zero clusters (entry surface: `ntp/ntp.js`,
  `background.js`, `manifest.json`, css, `index.html`) or to more than one.

The import-graph gate fails on stale cluster entries. CI itself still runs the
full suite; the selector is the local/agent fast path.

**Hot-file single-agent convention**

When several agent windows are parallel, `ntp/ntp.js`, `ntp/render.js`, and
`ntp/sync-engine.js` are worked by at most one agent at a time (ticket 05
hunk-claim lesson); other windows must not edit them concurrently.
