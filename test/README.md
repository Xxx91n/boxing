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
- Projects: `firefox-extension` and `chromium-extension` only

## CI

Tests run on GitHub Actions via `.github/workflows/test.yml`. Browser binaries are
cached via `actions/cache` keyed on `package-lock.json` hash.

## Test governance (ticket 20, architecture-recovery)

Model chosen by the round-4 research (`research-report-round4.md` §5): file-level
spec-cluster mapping + native Playwright filtering, full suite as the
conservative fallback. No new runner, build system, or dependency.

**Resource ceilings (explicit policy, not ad hoc flags)**

| Surface | Policy |
| --- | --- |
| Local workers | 4 — the 8-thread host starves with 8 headed browsers (ticket 01 evidence) |
| CI workers | 2 — GitHub standard runners have 4 cores; 2–4 workers is the measured sweet spot |
| CI job budget | `timeout-minutes: 30` on every matrix job (main + quarantine lanes) |
| CI cancellation | `concurrency` + `cancel-in-progress: true`; a superseded push cancels its stale run |
| Linux headed browsers | run under `xvfb-run` (same pattern the quarantine lane already proves) |

**Failure recovery**

`npm run test:failed` reruns only the last run's failures via Playwright's
native `--last-failed` cache (`test-results/.last-run.json`, uploaded as a CI
artifact). Known convergence method (ticket 15): batch `--last-failed` rerun
first, then a solo rerun for any straggler; a timeout-only failure must pass a
solo run before being called environmental. Failure history is never used to
*select* what runs on a change — only to *retry*.

**Changed-surface selection**

`npm run test:changed` (see `scripts/test-surface.mjs`) diffs the working tree
(plus `$GITHUB_BASE_SHA` in CI, plus the last commit as a local fallback), maps
each changed file through `test/spec-clusters.json`, and runs the union of the
matched clusters' specs. Conservative rules — any of these means the **full
suite**, never a silent skip:

- the mapping file is missing or malformed;
- a changed file is under `test/`, `.github/`, or is `package(.lock).json`;
- a changed file maps to zero clusters (entry surface: `ntp/ntp.js`,
  `background.js`, `manifest.json`, css, `index.html`) or to more than one.

The mapping is seeded by ticket 20 and owned by ticket 21, whose import-graph
gate fails on stale cluster entries. CI itself still runs the full suite; the
selector is the local/agent fast path.

**Hot-file single-agent convention**

When several agent windows are parallel, `ntp/ntp.js`, `ntp/render.js`, and
`ntp/sync-engine.js` are worked by at most one agent at a time (ticket 05
hunk-claim lesson); other windows must not edit them concurrently.
