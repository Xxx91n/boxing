# Handoff — 33 Documentation and stale-branch reconciliation

## Next agent focus

Reconcile summaries, backlog, status table, README language entry, and stale-branch records with the merged repository, after the user decides stale-branch disposition.

## Required files

- .scratch/architecture-recovery/issues/33-docs-branch-reconciliation.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round6-architecture-report.md
- <repo root>/docs/architecture-recovery-summary-2026-09-round5.md
- <repo root>/docs/architecture-recovery-backlog-2026-09-round5.md
- .scratch/architecture-recovery/README.md
- <repo root>/README.md

## Completion definition

- The user decision for each stale local branch is recorded and applied.
- The pushed-state contradiction is removed.
- The default README keeps one language selector and real screenshot references.
- The status table and backlog are recomputed from evidence.
- Closure report exists at `.scratch/architecture-recovery/33-docs-branch-reconciliation-report.md`.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$implement`
- `$code-review`
- `$handoff`
