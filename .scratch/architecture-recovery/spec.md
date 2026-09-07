# Spec — Round 6: Release Merge, CI Lockfile, and Governance Closure

## Problem Statement

Boxing has a working modular core, but the repository is not converging. Round 5
work is pushed only as remote branches and has not reached the main branch. The
local main branch has diverged. CI cannot run a clean install because the lockfile
is out of sync. Project agent rules still require raw Git operations that conflict
with the GitButler-only workflow. Several multi-tab state-sync tests remain
unclassified, and the summary documents contradict the actual pushed state.

## Solution

First use one serialized deep-research pass to confirm the release-merge,
lockfile-repair, and flaky-test governance model. Then execute three independent
governance slices: synchronize the lockfile and CI, reconcile the agent
version-control rules, and classify the remaining multi-tab failures. Once those
gates pass, merge the verified Round 5 integration stack into main and update the
mirrors. Finally reconcile the documentation and stale-branch state against the
merged repository.

## User Stories

1. As a maintainer, I want the verified Round 5 stack merged into main, so that the
   shipped default branch contains the recovered architecture.
2. As a maintainer, I want a clean install to succeed in CI, so that every matrix
   runner starts from the same deterministic dependency set.
3. As a future agent, I want the version-control rules to match the GitButler
   workflow, so that no agent is told to run raw Git commands.
4. As a maintainer, I want the remaining multi-tab state-sync failures to be either
   repaired or explicitly quarantined with an expiry, so that the suite is trustworthy.
5. As a dispatcher, I want blocking edges to define the wave table, so that parallel
   windows are assigned safely.
6. As a visitor, I want the default README to keep one language selector and real
   screenshots, so that the repository landing page is coherent.
7. As a maintainer, I want the summaries, backlog, and status table to agree with
   the actual branch and merge state, so that the next round starts from one truth.

## Implementation Decisions

- The research ticket is read-only and uses one serialized atomcode call.
- The verified Round 5 integration stack is the top branch already containing the
  10 commits that lead the current remote main.
- The divergent local main branch is not force-pushed or used as an integration
  target; its disposition is handled by the reconciliation ticket.
- The lockfile is regenerated from the current package metadata and verified with a
  clean-install dry run before merge.
- Agent version-control rules are translated into GitButler operations; the local
  workflow control section remains the single authority.
- Multi-tab state-sync failures are classified from logs, reproduced in isolation,
  and either repaired or quarantined with a registered expiry.
- Integration into main is a merge or reviewed pull-request operation, followed by
  mirror synchronization, not another branch-only push.
- The wave table is derived only from issue blocking edges.

## Testing Decisions

- A good test observes externally visible behavior. Internal assertions are
  reserved for the existing import-graph and process-mutex gates.
- Lockfile repair is verified with `npm ci --dry-run --ignore-scripts`.
- Agent-rule reconciliation is verified by scanning for prohibited raw Git
  commands and by checking that referenced authority files still resolve.
- Multi-tab failures are verified by a focused repeat of the state-sync lane and a
  documented classification report.
- Merge completion is verified by confirming the remote main contains the
  integration top and by rerunning the build and static guards.
- Documentation reconciliation is verified by cross-checking the summary, backlog,
  status table, and remote branch state.

## Out of Scope

Framework migration, new dependencies beyond repairing the existing lockfile,
another line-count-driven module split, coverage-based test selection, distributed
sharding, and rewriting historical ADRs beyond the rule conflicts identified by the
governance tickets.

## Further Notes

The source evidence and proposed ticket decomposition are recorded in
`round6-architecture-report.md`. Issue blocking edges are the single source for
the wave table.
