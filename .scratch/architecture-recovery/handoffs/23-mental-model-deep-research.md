# Handoff — 23 Mental model deep research

## Next agent focus

Read the current product README, test governance, ADRs, and CONTEXT files, then use one serialized atomcode research pass to choose the Round 5 canonical model for README information architecture and local test-process governance. Do not change source, manifest, tests, or the product README.

## Required files

- .scratch/architecture-recovery/issues/23-mental-model-deep-research.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round5-architecture-report.md
- <repo root>/README.md
- <repo root>/AGENTS.md
- <repo root>/CONTEXT.md
- <repo root>/docs/CONTEXT.md
- <repo root>/docs/adr/0016-sync-backup-engine-layering.md
- <repo root>/scripts/test-surface.mjs
- <repo root>/test/playwright.config.ts
- <repo root>/package.json

## Completion definition

- `research-report-round5.md` exists at `.scratch/architecture-recovery/research-report-round5.md`.
- The report contains a comparison matrix, a missing-piece list, and one final recommendation with sources.
- The report explicitly rules out unsuitable mental models for a zero-dependency native ES-module extension.
- No source, manifest, test, or product README files changed; no parallel atomcode calls were started.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$atomcode-research`

