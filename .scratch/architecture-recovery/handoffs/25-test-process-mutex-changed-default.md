# Handoff — 25 Test-process mutex and changed-test standardization

## Next agent focus

Add a zero-dependency process-level mutex around local Playwright execution, and make changed-surface verification the standard local path while preserving the full-suite fallback.

## Required files

- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/25-test-process-mutex-changed-default.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round5-architecture-report.md
- D:/Aworker/crx/boxing/scripts/test-surface.mjs
- D:/Aworker/crx/boxing/test/playwright.config.ts
- D:/Aworker/crx/boxing/package.json

## Completion definition

- A small Node wrapper permits only one local Playwright process at a time.
- Package scripts expose the mutex and changed-surface selection as the standard local path.
- Ambiguous or configuration/test changes still fall back to the full suite.
- A second concurrent process is observably rejected or made to wait while the first holds the lock.
- A bounded source-only change runs a bounded subset and the affected lane remains green.
- Closure report exists at `D:/Aworker/crx/boxing/.scratch/architecture-recovery/25-test-process-mutex-changed-default-report.md`.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$implement`
- `$code-review`
- `$handoff`
