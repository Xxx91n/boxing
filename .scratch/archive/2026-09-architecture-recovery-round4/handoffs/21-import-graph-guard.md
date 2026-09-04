# Handoff — 21 Import graph guard and spec cluster mapping

## Next agent focus
Add a no-dependency import graph gate to the normal test command, and publish the module-to-spec cluster mapping required by changed-surface selection.

## Required files
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/21-import-graph-guard.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round4-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round4.md
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md
- D:/Aworker/crx/boxing/ntp
- D:/Aworker/crx/boxing/test
- D:/Aworker/crx/boxing/package.json

## Completion definition
- The normal test command runs a Node import graph assertion with zero new dependencies.
- Forbidden edges include background imports, reverse facade/leaf imports, cycles, and barrel-style re-exports.
- A module-to-spec cluster mapping exists and is used by the selector.
- The gate fails on an intentionally introduced forbidden edge and passes on the current graph.
- Closure report exists at D:/Aworker/crx/boxing/.scratch/architecture-recovery/21-import-graph-guard-report.md.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:
- `$implement`
- `$code-review`
- `$handoff`
