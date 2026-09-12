# Testing Governance

> Audience: maintainers, CI owners, and agents doing test-governance work.
> This is a governance **record**, not a status board.

> Moved out of `README.md` (ticket 85 / A-035, 2026-09-12): the quarantine register and
> host-environment incident register are English-only governance records that were inlined in the
> product-facing README, while all 13 localized READMEs never carried them. Relocating the block
> converges the agent-work-log impression on the product entry and re-aligns English with the
> localized set. Evidence lives in `../.scratch/architecture-recovery/` (relative to this file) and is referenced, never deleted.

Original location: `README.md` § Quarantined tests / § Host-environment incident register.

## Quarantined tests

The quarantine program is **converged as of 2026-09-05** (ticket 27): no test titles carry the
`@quarantine` tag anymore. The final 14 entries were repaired by converting their native-input
dispatch to synthetic events (the established repair pattern — the guarded behavior is
app-level, not input realness) and rejoined the Firefox main lane; the only native-input block
kept (double-click selection realness in `boxing-focus-steal.spec.ts`) is chromium-scoped
because native input on the Firefox persistent context stalls (the
[playwright#16095](https://github.com/microsoft/playwright/issues/16095) class). The history:
tags were introduced in architecture-recovery ticket 01, governed since ticket 14, first five
entries repaired at the ticket 18 expiry pass
([.scratch/architecture-recovery/18-quarantine-expiry-report.md](../.scratch/architecture-recovery/18-quarantine-expiry-report.md)),
final 14 at ticket 27
([.scratch/architecture-recovery/27-firefox-quarantine-convergence-report.md](../.scratch/architecture-recovery/27-firefox-quarantine-convergence-report.md)).

| Test (spec › title) | Chromium | Firefox | Registered | Due (30d) |
| --- | --- | --- | --- | --- |
| *(none — quarantine table empty since ticket 27, 2026-09-05)* | — | — | — | — |

Baseline at convergence: chromium 14/14 and firefox 14/14 pass in the quarantine lane
(2026-09-05, ticket 27); after the tag removal the firefox main lane absorbed all 14 tests and
`npm run test:quarantine` selects 0 tests (exit 0 via `--pass-with-no-tests`).

**Expiry rule.** Every entry must be resolved by its due date — either **repaired** (remove the
`@quarantine` tag + `quarantine-ref` comment, rejoin the Firefox lane, delete the row) or
**retired** (delete the test and the row, recording the decision in the governance ticket).
Entries do **not** auto-extend: at expiry the next governance pass forces the decision, defaulting
to retirement. A newly tagged quarantine must be registered in this table the same day, with
due = registered + 30 days. The quarantine lane is patrolled daily by CI
(`.github/workflows/quarantine.yml`, `continue-on-error`).

### Host-environment incident register

Tests that failed from host-load browser instability — not app defects — are registered here
with a CI re-verification due date instead of a `@quarantine` tag: they pass and stay in every
lane, and the repair-or-retire default of tagged quarantine does not fit a host incident.
Classification protocol and evidence: ticket 31
([.scratch/architecture-recovery/31-state-sync-flaky-diagnosis-report.md](../.scratch/architecture-recovery/31-state-sync-flaky-diagnosis-report.md)).

| Test (spec › title) | Incident | Classification | Registered | Due (30d) |
| --- | --- | --- | --- | --- |
| boxing-state-sync.spec.ts › two tabs synchronize creation and protect a view whose large box is deleted | 2026-09-05 host-load; chromium CDP session closed mid-test; same-day green in ticket 27 full run; runtime identical by git diff | environment-only | 2026-09-06 | 2026-10-06 |
| boxing-state-sync.spec.ts › concurrent creation in two tabs converges without losing either box | same incident | environment-only | 2026-09-06 | 2026-10-06 |
| boxing-state-sync.spec.ts › concurrent small-box creation converges and persists the merged children | same incident | environment-only | 2026-09-06 | 2026-10-06 |

Incident-row rule: a row is resolved (deleted) once a CI run after the lockfile repair (ticket 29)
shows its test green in the chromium lane. Rows do not auto-extend: past due without CI-green
evidence, the next governance pass must reclassify — defect repair or tagged quarantine.
