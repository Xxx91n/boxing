# Handoff — 22 Documentation and ADR consistency sync

## Next agent focus
Use the round 4 research decision and the machine-checked module map from ticket 21 to update authoritative documents, remove stale law-like rules, and repair damaged text without changing behavior.

## Required files
- .scratch/architecture-recovery/issues/22-documentation-adr-consistency-sync.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round4-architecture-report.md
- .scratch/architecture-recovery/research-report-round4.md
- <repo root>/AGENTS.md
- <repo root>/CONTEXT.md
- <repo root>/docs/CONTEXT.md
- <repo root>/docs/DESIGN.md
- <repo root>/docs/adr/0013-performance-optimization-grid-hash.md
- <repo root>/docs/adr/0016-sync-backup-engine-layering.md
- <repo root>/docs/agents/manifest-contract.md
- <repo root>/docs/agents/performance-anti-patterns.md
- <repo root>/manifest.json

## Completion definition
- Every current module appears in the module map and stale line-count claims are gone.
- Stale ADR status and old-location references are superseded or corrected.
- Manifest and agent rules that no longer match the source manifest are removed or rewritten.
- All referenced paths resolve and a search finds no remaining old-location claim.
- Closure report exists at .scratch/architecture-recovery/22-documentation-adr-consistency-sync-report.md.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:
- `$neat-freak`
- `$handoff`
