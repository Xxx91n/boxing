# Handoff — 20 Test execution governance

## Next agent focus
Implement the minimal test governance model selected by ticket 19. Bound repeated CI runs, allow failure reruns, and add changed-surface selection without adding a build system.

## Required files
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/20-test-execution-governance.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round4-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round4.md
- D:/Aworker/crx/boxing/package.json
- D:/Aworker/crx/boxing/test/playwright.config.ts
- D:/Aworker/crx/boxing/test/playwright.quarantine.config.ts
- D:/Aworker/crx/boxing/.github/workflows/test.yml
- D:/Aworker/crx/boxing/.github/workflows/quarantine.yml

## Completion definition
- Repeated CI runs have an explicit timeout and cancellation policy.
- A native failure rerun path exists and is verifiable without a new dependency.
- Changed-surface selection chooses a bounded subset; ambiguous leaf changes fall back to the full suite.
- The normal Playwright lane passes on the affected browser project after the changes.
- Closure report exists at D:/Aworker/crx/boxing/.scratch/architecture-recovery/20-test-execution-governance-report.md.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:
- `$implement`
- `$code-review`
- `$handoff`
