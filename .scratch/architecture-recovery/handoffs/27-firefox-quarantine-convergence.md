# Handoff — 27 Firefox quarantine residual convergence

## Next agent focus

Repair or retire the remaining Firefox quarantine entries before their due date, and update the README governance table with fresh evidence.

## Required files

- .scratch/architecture-recovery/issues/27-firefox-quarantine-convergence.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round5-architecture-report.md
- <repo root>/README.md
- <repo root>/test/playwright.config.ts
- <repo root>/test/playwright.quarantine.config.ts
- <repo root>/test/tests

## Completion definition

- The quarantine lane is run and every remaining failure is classified.
- Every entry is repaired or retired with a recorded decision; no entry auto-extends.
- The README quarantine table reflects the new Chromium and Firefox counts.
- The Firefox lane and quarantine lane are verified after the change.
- Closure report exists at `.scratch/architecture-recovery/27-firefox-quarantine-convergence-report.md`.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$implement`
- `$code-review`
- `$handoff`
