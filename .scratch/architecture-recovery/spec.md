# Spec — Round 5: Product Readme, Test Mutex, and Boundary Closure

## Problem Statement

Boxing now has a modular native ES-module core and machine-checked import boundaries,
but several governance gaps remain. Local agent windows can still run the full Playwright
suite concurrently with no process-level ceiling. The product README is visually weak,
repeats its language selector, and leaves screenshot placeholders. Feature-level sibling
imports remain accepted by convention only, and the Firefox quarantine residual is still
unresolved.

## Solution

First use one serialized deep-research pass to choose the smallest industrial mental
model for product/README information architecture and local test-process governance.
Then execute that model in four independent slices: improve the README and language
selector, add a zero-dependency local test mutex, make feature-layer imports explicit,
and converge the Firefox quarantine residual.

## User Stories

1. As a visitor, I want the first README screen to explain Boxing with real screenshots, so that I can judge the extension quickly.
2. As a multilingual visitor, I want one clear language selector, so that the README does not repeat the same links at top and footer.
3. As a maintainer, I want local test processes to respect a single-instance ceiling, so that parallel agent windows cannot exhaust the host.
4. As a maintainer, I want changed-surface verification to be the default local path, so that small edits do not always run the full suite.
5. As a maintainer, I want feature-layer imports to be machine-checked, so that accepted sibling edges cannot silently drift.
6. As a maintainer, I want the Firefox quarantine residual to be repaired or retired by its due date, so that the suite can be trusted.
7. As a dispatcher, I want the wave table derived only from blocking edges, so that parallel windows can be assigned safely.

## Implementation Decisions

- The research ticket is read-only. It uses one serialized atomcode call and produces a cited report.
- README work uses the existing five PNG screenshots under `docs/store-assets/screenshots/`.
- The language selector is kept once, at the top. The footer duplicate is removed.
- The local test mutex is implemented as a small Node wrapper around Playwright without a new dependency.
- Changed-surface selection remains the existing `test-surface.mjs` model. The wrapper only adds process-level coordination.
- Feature-layer sibling imports either receive a machine-checked whitelist or are recorded as accepted ADR-0016 errata.
- Firefox quarantine entries follow the existing repair-or-retire rule. No entry auto-extends.
- Version control is GitButler-only and follows the local WORKFLOW control section.

## Testing Decisions

- A good test observes externally visible behavior rather than internal symbol names, except for import-graph and process-mutex gates.
- The research ticket is verified by a non-empty cited report with one recommendation.
- README changes are verified with path resolution, link checks, byte checks, and `git diff --check`.
- The mutex gate is verified by observing that a second concurrent process cannot start while the first holds the lock.
- Import whitelist changes are verified by a guard run on the current graph and on an intentionally forbidden edge.
- Quarantine convergence is verified in the dedicated quarantine lane and, when repaired, by rejoining the Firefox lane.

## Out of Scope

Further render-module splitting, framework migration, sync protocol replacement, monorepo
tooling, distributed sharding, coverage-based selection, and broad ADR rewriting beyond
the accepted feature-layer errata.

## Further Notes

The source evidence and ticket decomposition are recorded in
`round5-architecture-report.md`. Issue blocking edges are the single source for the
wave table.
