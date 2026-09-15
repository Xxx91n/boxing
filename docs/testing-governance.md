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


### Local-only flake observations (not CI residual reds)

Tests observed failing **only on a contended local host** and never in the CI main lane are recorded
here, not in the G-A waiver ledger (`../.scratch/architecture-recovery/WORKFLOW.md` §4.4). The ledger
holds main-lane residual reds; filing a never-red test there would *widen* the waiver surface, against
the ratchet rule (the waiver file may only shrink). Closure follows the industry "downgrade + SLA" path:
the row keeps an owner, a due date, and a concrete escalation trigger, so the observation is never
silently dropped and never becomes a `worksforme` close.

| Test (spec) | Lane | Classification | Observed | Registered | Due | Status | Escalation trigger |
| --- | --- | --- | --- | --- | --- | --- |
| `boxing-innerclip.spec.ts` + `boxing-innerclip-pan.spec.ts` | firefox | environment-only (host-load) | local full run (ticket 94) and local targeted rerun (ticket 106): the **first test in the file** consumes the Firefox headed cold-start cost under host contention and hits the 30s default budget at the shared `resetBoxing` fixture — never a geometry assertion | 2026-09-14 | 2026-10-14 | the face shows `failed`/`flaky` in any main full `test.yml` run, or the `resetBoxing` navigation-timeout signature reappears in CI logs → apply the ticket-13 repair (`test.setTimeout` budget bump) to the two specs and validate on both lanes | **closed 2026-09-15** |

CI evidence for the row (ticket 106): across 9 full-matrix main `test.yml` runs spanning 2026-09-11 →
2026-09-14 the face shows **zero occurrence in 216 executions** (Wilson 95% upper bound ≈ 1.75%). The two
2026-09-12 runs that did show it were a **B (broken)** commit-wide failure — 113 numbered failures,
identical signature on all three OSes and both lanes, including `data-golden` gate 4 — not this
observation. Row rule: a row is resolved (deleted) when the escalation trigger fires and the repair
lands, or when the due date passes with the face green across ≥2 consecutive full `test.yml` runs on
main and the classification re-confirmed as environment-only. Rows do not auto-extend.

**Third closure path - preemptive repair (added 2026-09-15, ticket 111 / A-066).** A row is also
resolved when a wave decision promotes the observation into a repair ticket and that repair lands
- without waiting for the CI escalation trigger or the due date. The row is then marked `closed`
in place (not deleted), so the closure evidence stays in the governance record. First use: the
`boxing-innerclip` firefox row above was closed 2026-09-15 by ticket 111 / A-066 / B72 - the
wave-9.20 grill (D-004 item 2) promoted residual **N-106-01** into the 9.20 implementation wave
ahead of the 2026-10-14 due date, and the ticket-13 repair (`test.setTimeout(120_000)`, with a
written rationale comment in both specs) landed with both lanes green. Evidence:
`.scratch/architecture-recovery/reports/111-report.md`.

## Waiver ledger revocation criteria (ticket 105 / B69)

The G-A residual-red written-waiver ledger (`.scratch/architecture-recovery/WORKFLOW.md` §4.4) is
the release-gate evidence surface for residual flaky reds. The ledger holds the operational rule
text; this section is the docs-layer record of its **revocation criterion**. Revoking an entry
(`active` → `closed`) is a **two-run** decision, never a one-run observation.

**The criterion (conjunctive):**

- **Consecutive-green count (≥2).** A row may be closed only after the target test shows **zero
  recurrence of its recorded signature across ≥2 consecutive full `test.yml` runs on main**. A
  single run with zero occurrence is **not** sufficient. Ticket 74 closed `boxing-zoom-dblclick`
  on one clean run; ticket 93 observed the same face recur on the next run. That premature
  revocation is the incident this rule exists to prevent.
- **Consecutive means consecutive.** Any change to the tested surface between the two runs
  (`ntp/**`, `test/**`, `.github/workflows/test.yml`, `manifest.json`) **resets** the count. A
  `.scratch/**`-only difference may be carried over via the tip-equivalence rule (`test.yml`
  `on.push.paths` excludes `.scratch`).
- **Evidence shape.** At least one of the two runs must be a same-commit corroboration run
  (`workflow_dispatch` on the same headSha, or a re-verification run on identical tested code)
  annotated `corroboration`; the two runs must come from **different trigger sources** (push vs
  `workflow_dispatch`/`schedule`) **or be ≥24h apart**. The closed row disposal record must carry a
  `撤账证据:` marker followed by **≥2 distinct run references** and the revocation date.
- **Recurrence re-enters the ledger.** If the same signature recurs in any later main run, the row
  immediately returns to `active` and the revocation counts as a failure. This is the safety net
  (GitLab: monitor for 1 week after de-quarantine; Mill: the auto-quarantine system catches it back).
- **N / B / F bucket constraints.** Only **F** (flaky — same code, different outcomes) is ever
  waivable, so only F can be revoked. **B** (broken — identical signature on every lane) is never
  waivable, so it has **no revocation path**: repair, or retire with a written reason. **N**
  (never-quarantine: data-integrity / migration-roundtrip / rollback-drill families) never enters
  the ledger and is never revoked — red there is fix-only.
- **Gate boundary.** Revocation changes only whether a red is still in effect. It is not a waiver,
  not G-A satisfaction, and it does not relax ADR-0017 (G-A ∧ G-B ∧ G-C), the no-permanent-waiver
  rule, or the per-release re-check.

**Machine check.** `node scripts/waiver-ledger-check.mjs` (extended by ticket 105) exits non-zero
when the criteria section is missing from the ledger, when a `closed` row cites fewer than two run
references or lacks the `corroboration` annotation, or when any row (including `closed`) matches the
never-quarantine family list.
