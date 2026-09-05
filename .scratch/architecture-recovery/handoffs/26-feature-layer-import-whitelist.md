# Handoff — 26 Feature-layer sibling import whitelist

## Next agent focus

Make accepted feature-layer sibling imports explicit with a machine-checked whitelist or as recorded ADR-0016 errata. Do not add a dependency.

## Required files

- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/26-feature-layer-import-whitelist.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round5-architecture-report.md
- D:/Aworker/crx/boxing/scripts/import-graph-guard.mjs
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md
- D:/Aworker/crx/boxing/ntp
- D:/Aworker/crx/boxing/test/cluster-map.json

## Completion definition

- Current feature-layer sibling imports are enumerated from the current graph.
- The accepted edges are either machine-checked or recorded as ADR-0016 errata.
- The guard passes the current graph and fails an intentionally unapproved edge.
- Relevant ADR and cluster-map references are updated to match the decision.
- Closure report exists at `D:/Aworker/crx/boxing/.scratch/architecture-recovery/26-feature-layer-import-whitelist-report.md`.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$implement`
- `$code-review`
- `$handoff`
