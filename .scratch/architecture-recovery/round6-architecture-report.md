# Round 6 Architecture Report (2026-09-05)

## Evidence snapshot

- Round 5 tickets are complete locally and pushed to `origin`, `gitlab`, and
  `codeberg`, but they are only published as feature branches. `origin/main`
  still points at the Round 4 closure commit `26a5182`, while `bc-branch-5` is
  10 commits ahead.
- Local `main` points at `be0d6b8` and is `ahead 6, behind 55` relative to
  `origin/main`; it is a divergent stale branch, not the integration target.
- `bc-branch-1`, local `main`, `ticket-16-mental-model-research`, and
  `ticket-17-doc-consistency` have local commits with no matching remote branch.
- `npm ci --dry-run --ignore-scripts` fails with `EUSAGE`: the lockfile is
  missing `crx3@1.1.3` and six transitive dependencies. The lockfile root still
  says version `3.7.0` while `package.json` says `2026.8.21`.
- `AGENTS.md` lines 47-49 still require raw Git commands and directly conflict
  with the GitButler-only control section in the local WORKFLOW.
- Three `boxing-state-sync` multi-tab failures remain unclassified as either
  app defects or host-environment failures.
- The Round 5 summary says "Nothing was pushed", which contradicts the actual
  remote state and the final handoff.
- `README.md` in the current integration branch has one language selector and
  real screenshots; `origin/main` still contains a duplicate footer language
  block that is removed only after the integration branch reaches main.

## Proposed ticket decomposition

| Ticket | Title | Blocked by | Purpose |
|---|---|---|---|
| 28 | Release merge and governance deep research | None | Choose the Round 6 mental model for branch integration, CI lockfile repair, and flaky-test handling |
| 29 | Lockfile and CI sync | 28 | Make `npm ci` deterministic on all three CI OS runners |
| 30 | Agent version-control rule reconciliation | 28 | Align project agent rules with the GitButler-only workflow |
| 31 | Multi-tab state-sync failure diagnosis | 28 | Classify and repair or explicitly quarantine the remaining multi-tab failures |
| 32 | Main convergence and Round 5 merge | 29, 30, 31 | Bring the verified Round 5 stack into `origin/main` and its mirrors |
| 33 | Documentation and stale-branch reconciliation | 32 | Align summaries, backlog, and README status with the merged reality |

## Non-goals

Do not add a framework, test runner, monorepo tool, coverage selector, or
runtime dependency. Do not start another line-count-driven module split. Do not
force-push the divergent local `main` branch. Do not discard stale branches
without an explicit user decision.
