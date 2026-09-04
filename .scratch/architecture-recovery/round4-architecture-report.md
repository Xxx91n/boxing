# Round 4 Architecture Report (2026-09-04)

## Evidence snapshot

- `ntp/` has 14 native ES modules and no static import cycle, no barrel file, and no NTP module imports `background.js`.
- `ntp/ntp.js` is 994 lines; the remaining 13 modules total 5620 lines. The original single-file governance problem has been structurally reduced.
- Several feature-level modules import sibling feature modules: `settings-ui.js`, `onboarding.js`, `sync-engine.js`, and `render.js`. This contradicts the single-direction import rule in ADR-0016 and the G1 import-graph guard that was recommended in round 3.
- The main Playwright config runs 222 leaf tests, 14 of which are tagged quarantine across 7 specs. CI has no timeout, concurrency cancellation, failure-rerun cache, or sharding.
- `test.yml` lacks `timeout-minutes`, `concurrency`, `cancel-in-progress`, `last-failed`, and Xvfb/headless handling. `quarantine.yml` uses `continue-on-error: true`.
- Authoritative docs still contain stale facts: ADR-0013 says the spatial grid is not implemented; `performance-anti-patterns.md` references an old `ntp.js` line; `manifest-contract.md` requires a permission that no longer exists in the source manifest.
- Round 3 research gaps G1-G6 are still open. The export-count baseline in the round 3 report is also stale.

## Proposed ticket decomposition

| Ticket | Blocked by | Purpose |
|---|---|---|
| 19 mental model and test governance deep research | None | Produce the canonical industrial model and minimal incremental-testing decision |
| 20 test execution governance | 19 | Stop full-suite and unlimited parallel execution using the chosen minimal model |
| 21 import graph guard and spec cluster mapping | 19 | Turn the module boundary rules into a machine-checked test gate |
| 22 documentation and ADR consistency sync | 19, 21 | Remove stale law-like rules and make authoritative docs match code |

## Non-goals

Do not add Nx, Turborepo, Bazel, Vitest/Jest, a bundler, TypeScript, or any new runtime dependency. Do not do another line-count-driven split. Do not replace GitButler.
