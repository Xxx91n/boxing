# Handoff — 17 Documentation consistency sync

## Next agent focus
Use the research decision from ticket 16 and the local evidence in the round report to update only authoritative documents and repair encoding damage.

## Required files
- .scratch/architecture-recovery/issues/17-documentation-consistency-sync.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round3-architecture-report.md
- .scratch/architecture-recovery/research-report-round3.md
- <repo root>/AGENTS.md
- <repo root>/CONTEXT.md
- <repo root>/docs/CONTEXT.md
- <repo root>/docs/DESIGN.md
- <repo root>/docs/adr/0007-architecture-refactor-decisions.md
- <repo root>/docs/adr/0010-user-customizable-accent-theme.md

## Completion definition
- Every current module appears in the module map and stale line-count claims are gone.
- All changed references resolve and a search finds no remaining old-location claim.
- Encoding bytes are valid UTF-8 without BOM and the damaged glyphs are gone.
- Closure report exists at .scratch/architecture-recovery/17-documentation-consistency-sync-report.md.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:
- `$neat-freak`
- `$handoff`
