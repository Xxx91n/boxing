# Handoff — 19 Mental model and test governance deep research

## Next agent focus
Read the current domain, ADR, and test model, then use one serialized atomcode research pass to decide the canonical industrial mental model and the minimal incremental-testing implementation. Do not change code.

## Required files
- .scratch/architecture-recovery/issues/19-mental-model-test-governance-deep-research.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round4-architecture-report.md
- .scratch/architecture-recovery/research-report-round3.md
- <repo root>/AGENTS.md
- <repo root>/CONTEXT.md
- <repo root>/docs/CONTEXT.md
- <repo root>/docs/DESIGN.md
- <repo root>/docs/adr/0013-performance-optimization-grid-hash.md
- <repo root>/docs/adr/0016-sync-backup-engine-layering.md
- <repo root>/test/playwright.config.ts
- <repo root>/test/playwright.quarantine.config.ts
- <repo root>/package.json

## Atomcode prompt
Send the verbatim prompt contained in `prompts/19-mental-model-test-governance-deep-research.md`; do not rewrite it.

## Completion definition
- A research report exists at .scratch/architecture-recovery/research-report-round4.md.
- The report has a comparison matrix, missing-piece list, one final recommendation with sources, and an explicit over-engineering anti-pattern list.
- No source files changed; no parallel atomcode calls were started.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:
- `$atomcode-research`
