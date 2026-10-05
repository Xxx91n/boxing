# Handoff — 31 Multi-tab state-sync failure diagnosis

## Next agent focus

Classify the remaining multi-tab state-sync failures and either repair them deterministically or register them with an expiry.

## Required files

- .scratch/architecture-recovery/issues/31-state-sync-flaky-diagnosis.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round6-architecture-report.md
- .scratch/architecture-recovery/research-report-round6.md
- <repo root>/test/tests/boxing-state-sync.spec.ts
- <repo root>/test/playwright.config.ts
- <repo root>/test/playwright.quarantine.config.ts

## Completion definition

- Every remaining failure has a log-backed classification.
- Application defects are fixed and the focused state-sync lane is green.
- Environment-only remainders are registered with a due date.
- Closure report exists at `.scratch/architecture-recovery/31-state-sync-flaky-diagnosis-report.md`.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$implement`
- `$code-review`
- `$handoff`
