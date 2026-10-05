# Handoff — 16 Mental model deep research

## Next agent focus
Read the current domain and ADR model, then use one serialized atomcode research pass to decide the canonical industrial mental model. Do not change code.

## Required files
- .scratch/architecture-recovery/issues/16-mental-model-deep-research.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round3-architecture-report.md
- <repo root>/docs/CONTEXT.md
- <repo root>/CONTEXT.md
- <repo root>/docs/adr/0007-architecture-refactor-decisions.md
- <repo root>/docs/adr/0010-user-customizable-accent-theme.md
- <repo root>/docs/adr/0016-sync-backup-engine-layering.md

## Atomcode prompt
Send the verbatim prompt contained in `prompts/16-mental-model-deep-research.md`; do not rewrite it.

## Completion definition
- A research report exists at .scratch/architecture-recovery/research-report-round3.md.
- The report has a comparison matrix, missing-piece list, and one final recommendation with sources.
- No source files changed; no parallel atomcode calls were started.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:
- `$atomcode-research`
