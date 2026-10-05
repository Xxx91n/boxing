# Handoff — 32 Main convergence and Round 5 merge

## Next agent focus

Merge the verified Round 5 integration stack into main, synchronize mirrors, and prove the default branch contains the recovered architecture.

## Required files

- .scratch/architecture-recovery/issues/32-main-convergence.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round6-architecture-report.md
- .scratch/architecture-recovery/research-report-round6.md
- <repo root>/docs/architecture-recovery-summary-2026-09-round5.md
- <repo root>/docs/architecture-recovery-backlog-2026-09-round5.md

## Completion definition

- The integration stack is based on the current remote main with no missing upstream commits.
- The reviewed merge path is executed and remote main contains the integration top.
- Mirrors receive the update.
- Build, import-graph guard, and process-mutex verification remain green.
- Closure report exists at `.scratch/architecture-recovery/32-main-convergence-report.md`.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$implement`
- `$code-review`
- `$handoff`
