# Spec — Round 4: Test Governance and Boundary Closure

## Problem Statement

Boxing now has a modular native ES-module new-tab core, but testing still runs the full Playwright suite and multi-window work has no explicit concurrency ceiling. The module boundary rules remain documentation and convention rather than machine-enforced guarantees, and several authoritative documents still contradict the implemented structure. Agents therefore pay repeat costs for stale law-like rules and for full test runs that do not select by changed surface.

## Solution

Make the governance model explicit and executable. First, run one serialized deep-research pass to choose the smallest industrial mental model for incremental test selection, blast-radius detection, worker limits, and import-boundary enforcement. Then implement that model without adding a build system. In parallel after the research decision, add a machine-checked import graph gate and align the authoritative documents with the current modules.

## User Stories

1. As a maintainer, I want changed-code selection instead of always running the full suite, so that a small edit no longer spends time on unrelated tests.
2. As a maintainer, I want a hard timeout and cancellation for repeated CI pushes, so that stale jobs cannot queue and exhaust the machine.
3. As a maintainer, I want worker and project limits expressed as explicit policy, so that multiple browser lanes cannot oversubscribe a single host.
4. As a maintainer, I want failed tests to be machine-recoverable through a repeat command, so that environment flakes do not hide real failures.
5. As a maintainer, I want forbidden import directions detected by the test gate, so that module-boundary drift fails automatically.
6. As a maintainer, I want a spec-to-module cluster mapping, so that changed-file selection can choose the smallest reliable subset.
7. As a maintainer, I want stale ADR and agent rules updated or deleted, so that every authoritative document resolves and matches code.
8. As a maintainer, I want the round status table derived only from blocking edges, so that human dispatchers can see which tickets are parallel.

## Implementation Decisions

- The deep-research ticket is read-only. It uses one serialized atomcode research call and produces a cited report with a comparison matrix and one minimal recommendation.
- The target model is dependency graph to changed closure to incremental execution. The authoritative dependency graph must be protected by no barrel files and no reverse-layer imports.
- Incremental test selection may use native Playwright filtering plus a small Node script; it must not require a new runner or build graph.
- Test execution keeps a resource ceiling. Concurrency and timeout are explicit policy rather than ad hoc command flags.
- The import graph gate is an external-behavior test that reads the module graph and fails on forbidden edges. It is part of the normal test command.
- Documentation changes remove stale rules and stale line references. They do not redefine product behavior.
- Version control is GitButler-only and follows the local WORKFLOW control section.

## Testing Decisions

- A good test observes externally visible behavior rather than internal symbol names, except for the boundary gate whose external contract is the import graph itself.
- The research ticket has no code test; its gate is a non-empty cited report with a recommendation.
- Test-governance changes are verified through the existing Playwright lanes and a repeat run.
- The import graph gate is a Node smoke assertion that fails on forbidden imports, cycles, barrel exports, and stale module-cluster mappings.
- Documentation changes are verified with path resolution, reference search, byte checks, and a build only when source files change.

## Out of Scope

Further render-module splitting, framework migration, sync protocol replacement, product positioning, monorepo tooling, distributed test sharding, and broad ADR rewriting beyond the stale references found in this round.

## Further Notes

The source evidence and ticket decomposition are recorded in the round 4 report. Issue blocking edges are the single source for the README wave table.
