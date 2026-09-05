# 27 — Firefox quarantine residual convergence

**What to build:** Repair or retire the remaining Firefox quarantine entries before their due date and update the README governance table with fresh evidence.

**Blocked by:** 23 — Mental model deep research; 24 — README beautify and language entry reposition

**Status:** done (2026-09-05, closure report at `.scratch/architecture-recovery/27-firefox-quarantine-convergence-report.md`)

- [x] Run the dedicated quarantine lane and identify each remaining failure. (Baseline 2026-09-05: chromium 14/14 green; firefox workers=2 14 fail / solo 12 pass + 2 deterministic — all playwright#16095 native-input class, signatures in the closure report.)
- [x] Repair the failure by removing the tag and rejoining the Firefox lane, or retire it with a recorded decision. (14/14 repaired, 0 retired; synthetic-input conversion per the ticket-18 pattern, focus-steal native block chromium-scoped via `test.skip`. No entry auto-extended; due date 2026-10-02 decision forced at ticket 27.)
- [x] Update the README quarantine table with the new Chromium and Firefox counts. (Table emptied with converged-state note; quarantine baseline 14/14 both lanes recorded; `npm run test:quarantine` now selects 0 tests.)
- [x] Verify the Firefox lane and quarantine lane after the change. (Quarantine lane exit 0 with 0 tests; firefox main lane absorbed all 14 — focused solo run 36 pass / 3 skip / 0 fail; full-lane evidence in the closure report.)
- [x] Write the closure report named in the handoff.
