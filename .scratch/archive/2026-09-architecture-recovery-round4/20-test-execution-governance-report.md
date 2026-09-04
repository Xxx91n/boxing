# 20 — Test execution governance — closure report

**Status: CLOSED.** Branch `ticket-20-test-execution-governance`, commit `bb88128` (amended; GitButler, not pushed, WORKFLOW §4.2).

## §A Issue acceptance checklist — item-by-item evidence

| # | Issue item | Status | Evidence |
|---|---|---|---|
| 1 | Explicit timeout, cancellation, and resource ceiling on the normal test workflow | ✅ PASS | `test.yml`: `timeout-minutes: 30` per matrix job + `concurrency: group: test-${{ github.ref }}, cancel-in-progress: true` (a superseded push cancels its stale run); `playwright.config.ts`: CI workers 1 → 2 (resource ceiling; local 4 unchanged). Validated: both workflows parse via js-yaml. |
| 2 | Native failure-rerun path without a new dependency | ✅ PASS | `package.json` `test:failed` = `playwright test --config=test/playwright.config.ts --last-failed`. Zero deps added. **Live proof**: full-suite run produced 1 launch-timeout flake (`boxing-viewstate-sync.spec.ts:24`); `npm run test:failed -- --project=chromium-extension` → `1 passed (12.3s)`. Same for the bounded run: 2 launch-timeout flakes → `2 passed (12.4s)`. |
| 3 | Changed-surface selection using the approved minimal model | ✅ PASS | `scripts/test-surface.mjs` + `npm run test:changed`: file-level spec-cluster mapping (consumes ticket 21's `test/cluster-map.json`) + native Playwright filtering + conservative full-suite fallback. 12-scenario probe matrix green (§C). |
| 4 | Quarantine lane separate, non-blocking when patrol-only | ✅ PASS | `quarantine.yml`: own `concurrency: quarantine-patrol` group with `cancel-in-progress` so overlapping patrols stay bounded; `continue-on-error` patrol semantics untouched (verified by diff hunk: only concurrency lines added). |
| 5 | Small source-only change runs a bounded subset AND full suite passes on the relevant lane | ✅ PASS | E2E probe: comment-only append to `ntp/conn-layer.js` → selector chose 6 conn specs → `npm run test:changed -- --project=chromium-extension` → **86 passed + 2 launch-flake → rerun → 88/88** (3.0m). Full suite: **218 passed + 1 flake → rerun → 219/219** (3.5m). Probe reverted byte-exact (`git diff --stat` empty). |

## §B Implemented governance model (ticket 19 §5 minimal model, zero new deps)

1. **Explicit ceilings (test.yml)** — per-job `timeout-minutes: 30`; `concurrency` group keyed on `github.ref` with `cancel-in-progress`: a new push to the same PR/branch cancels the superseded run. Xvfb added for headed browser projects on Linux runners. Failure-rerun guidance notices point at `npm run test:failed`; `.last-run.json` uploaded with the report artifacts (`if-no-files-found: ignore`).
2. **Workers policy (playwright.config.ts)** — CI: 2 workers on the 4-core hosted runner (currents.dev evidence in research-report-round4 §3.1: diminishing returns beyond 2 on 4 cores); local unchanged at 4.
3. **Native rerun (package.json)** — `test:failed`: Playwright `--last-failed` re-executes only the failing specs from the previous run's `.last-run.json`. This mechanizes the ticket-15 flake-convergence method (rerun-only-failures instead of rerun-everything). No new dependency: Playwright ships this natively.
4. **Changed-surface selector (scripts/test-surface.mjs + test:changed)** — reads the changed-file baseline (working tree diff, cached diff, GITHUB_BASE_SHA range in CI; falls back to `HEAD^..HEAD` locally post-commit), maps each changed file through ticket 21's `test/cluster-map.json` clusters, unions the spec subsets, and passes them as file args to the same playwright config. Extra args after `npm run test:changed -- --` pass through to Playwright (e.g. `--project=chromium-extension`).

### Full-suite fallback rules (conservative, never a silent skip)
- test/`, `.github/`, `package.json`, `package-lock.json` changes → full suite.
- Any changed file with no cluster entry → full suite (ambiguous closure: `ntp.css`, `background.js`, `manifest.json`, `ntp.js` entry module).
- Union of matched specs ≥ `minimumFullSuiteSpecs` (18) → full suite (a closure already spanning half the suite gives selection no benefit).
- Mapping file missing/malformed → full suite.
- Empty baseline → full suite.
- Failure history is NEVER used for selection (flaky specs stay in every run of their cluster).
- Local web-ext junction pointers (`dev-chrome`, `dev-firefox`) are filtered from the baseline: they are local dev conveniences re-created by `npm run dev:*` in parallel windows, never consumed by tests (`EXTENSION_PATH` resolves to the repo root). Discovered live: a parallel window's junction flip had pinned every `test:changed` invocation to the full suite.

## §C Selector verification — 12-scenario probe matrix (dry-run, patched root)

| Scenario | Changed files | Outcome |
|---|---|---|
| Single leaf | `ntp/conn-layer.js` | bounded: 6 specs (conn-delete-action, conn-dsu, conn-persist, connections, star-sync-audit, state-sync) |
| Two leaves union | `ntp/popups.js` + `ntp/sync-engine.js` | bounded: 9 specs |
| Entry module | `ntp/ntp.js` | full (33 ≥ 18: closure spans half the suite) |
| Wide facade | `ntp/render.js` | bounded: 16 specs |
| Unmapped leaf (css) | `ntp/ntp.css` | full (ambiguous closure) |
| Unmapped leaf (bg) | `background.js` | full |
| Unmapped leaf (manifest) | `manifest.json` | full |
| Test change | `test/tests/boxing-v3.spec.ts` | full (config/test trigger) |
| Package change | `package.json` | full |
| Empty baseline | — | full |
| Facade union | `ntp/onboarding.js` + `ntp/settings-ui.js` | bounded: 8 specs |
| Small leaf | `ntp/favicon.js` | bounded: 3 specs |

**minimumFullSuiteSpecs semantics bug found and fixed during verification**: the first implementation inverted ticket 21's §G contract ("closure ≥ half suite → full"), treating 18 as a minimum for bounding. Probe round 4 caught it (`conn-layer.js` 6-spec cluster fell back to full); fixed to `specs.size >= minimum → full suite`. All 12 scenarios then matched the §G contract exactly.

## §D Real E2E (probe method)

1. Commit ticket-20 changes (clean baseline; working tree empty).
2. Append comment-only probe to `ntp/conn-layer.js` (`node --check` green) — a pure source-only change with zero behavior delta.
3. `npm run test:changed -- --project=chromium-extension` → selected exactly the 6 conn specs → **86 passed, 2 failed on `browserType.launch` 180s timeouts (environment flake, not logic)**.
4. `npm run test:failed -- --project=chromium-extension` → **2 passed (12.4s)** — the native rerun path converging the launch flakes.
5. Full suite `npx playwright test --project=chromium-extension` → **218 passed, 1 flake (viewstate-sync storage.onChanged)** → `test:failed` → **1 passed (12.3s)**.
6. Probe reverted byte-exact: `git diff --stat -- ntp/conn-layer.js` empty; `git diff --check` clean; `node --check` green.

## §E Other gates

- `node .github/scripts/build.mjs` — ok (dist contract unchanged; re-run after probe revert).
- Both workflows parse (js-yaml).
- `npm run pretest` (ticket 21's import-graph guard, added by the parallel window) — `{"ok":true,"modules":14,"edges":48,"violations":[]}` — the two tickets compose: the selector consumes ticket 21's mapping; the guard runs before every test command.
- `codegraph sync` after every edit batch.

## §F Parallel-window coordination (ticket 21)

- Ticket 21 landed `test/cluster-map.json`, `scripts/import-graph-guard.mjs`, `package.json` `pretest`/`guard:import-graph` hooks in a parallel window. My initial duplicate seed mapping (`test/spec-clusters.json`) was **deleted in favor of ticket 21's mapping** — single source of truth; the selector consumes their schema (`specDirectory`, `clusters`, `fallback.minimumFullSuiteSpecs`).
- Cross-claims respected: ticket-20 commit contains ONLY the 6 ticket-20 files (verified via `git show --stat bb88128`); the ticket-21 files (guard, cluster-map, pretest hunks, their closure report, `dev-chrome` deletion) are committed on `ticket-21-import-graph-guard` as `f3d75c5` — per the "never claim another window's hunks" rule.
- The `dev-chrome` junction flip from their window motivated the DEV_POINTERS filter (documented in §B).

## §G WORKFLOW §4.2 version control

- Branch: `ticket-20-test-execution-governance` (dedicated, created via `but commit -b`).
- Commit: `bb88128` "test(governance): bounded CI, native failure rerun, changed-surface selection (ticket 20)" — 6 files, +258/−5. The DEV_POINTERS filter was amended into the same commit (`but amend --target ticket-20-test-execution-governance`).
- Not pushed, no PR (per WORKFLOW §4.2).
- This closure report is committed to the same branch separately.
