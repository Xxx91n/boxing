# 28 Review Verification

> 本文件由只读复核生成，不修改项目源码、README、测试或状态表。
> 工作区：`D:/Aworker/crx/boxing`
> 日期：2026-09-05

## 1. Overall Verdict

| Item | Result |
| --- | --- |
| Ticket 28 | PASS with residuals |
| Frontier | Can advance to 29, 30, 31 after recording two residuals below |
| Source-level issue | None |
| Relaunch fix starter | Not required for source code; a small report correction is required |

## 2. Completion Definition

| Criterion | Claim | Evidence | Conclusion |
| --- | --- | --- | --- |
| Report exists at required path | `research-report-round6.md` exists | `fs.existsSync` returned true | PASS |
| Report contains cited sources | 18 cited S1-S18 rows plus local evidence | Report contains exactly 18 `S<number>` source rows; local paths referenced in the source list exist | PASS |
| One recommendation for branch integration | C6 form + C1 merge action, no merge queue | Report section 4.1 gives a serialized GitButler integration template and explicitly rejects merge queue | PASS |
| One recommendation for lockfile repair | Regenerate from current package metadata and verify with CI | Report section 4.2 gives a lockfile template; `npm ci --dry-run --ignore-scripts` independently reproduced EUSAGE | PASS |
| One recommendation for flaky-test handling | Classify first, repair or quarantine with expiry, keep full merge gate | Report section 4.3 gives classification/quarantine/full-gate template | PASS |
| Report identifies gaps without inventing evidence | Eight gaps listed; lockfile lacks external source and is disclosed | Report section 7 explicitly discloses lockfile external-source gap, ESM performance baseline gap, merge-queue ROI gap, and mirror-semantics gap | PASS |

## 3. Key Local Claims

| Claim | Evidence | Conclusion |
| --- | --- | --- |
| Import guard is clean | `node scripts/import-graph-guard.mjs` exit 0: 14 modules, 48 edges, 0 violations | PASS |
| Guard has B-1 through B-9 | Source contains `add('B-1')` through `add('B-9')`; B-9 exists | PASS |
| `test-surface.mjs` has conservative changed-surface selection | Source contains full fallback for `package.json`, `package-lock.json`, `.github/`, `test/`, missing mapping, unmapped leaf, and minimum-spec threshold; `--last-failed` is excluded from selection | PASS |
| `test-mutex.mjs` has mutex, CI bypass, and stale lock handling | Source contains atomic `mkdirSync(lockDir)`, PID/age stale checks, CI bypass, wait mode, dry-run, exit 75, and signal cleanup | PASS |
| `test/cluster-map.json` schema exists and parses | Parsed: schemaVersion 1, specDirectory `test/tests`, minimumFullSuiteSpecs 18, 14 clusters, no empty or non-array clusters | PASS |
| Cluster map has 15 clusters | Actual cluster count is 14, not 15 | FAIL |
| `ntp.js` is 994 lines with zero dynamic import | Node byte/line scan: 994 lines, 0 `import(` matches | PASS |
| `origin/main` is still Round 4 `26a5182` | `git branch -a -vv` and rev-list evidence confirm | PASS |
| `bc-branch-5` is 10 commits ahead of `origin/main` | `git rev-list --left-right --count origin/main...bc-branch-5` => `0 10` | PASS |
| Local `main` is ahead 6, behind 55 | `git rev-list --left-right --count origin/main...main` => `55 6`; branch output shows `ahead 6, behind 55` | PASS |
| Lockfile is out of sync | `npm ci --dry-run --ignore-scripts` exit 1 EUSAGE, missing `crx3@1.1.3` and six transitive packages; lockfile root version 3.7.0 versus package 2026.8.21 | PASS |
| Dry-run did not modify lockfile | Lockfile mtime was unchanged after the dry-run | PASS |
| Ticket 28 branch exists and contains only research/governance files | `ticket-28-governance-research` at `7b3dc09`; commit stat changes `WORKFLOW.md` lesson write-back, issue file, and report only | PASS for scope |
| Referenced local files exist | Required issue/handoff/prompt/spec/workflow/report paths, guard scripts, cluster map, ADR, package files, and handoffs 19/21/25/28/32/33 all resolve | PASS |

## 4. Unverified or Incorrect Statements

| Statement | Status | Evidence |
| --- | --- | --- |
| Changed-surface model has 15 clusters | Incorrect | `test/cluster-map.json` has 14 cluster keys |
| Only one serialized atomcode run was used | Not independently verifiable from repository | Report supplies session ID and source table, but no machine-readable run log was found in the repo; external URLs were not re-fetched during this review |
| `bc-branch-1`, local `main`, `ticket-16`, and `ticket-17` have local commits with no matching remote branch | Partially imprecise | `bc-branch-1` has no matching remote; `ticket-16` and `ticket-17` do have matching remote branches, but their local heads diverge from those remote heads. Local `main` also has a matching `origin/main` but is stale/divergent |
| External source conclusions are current and accurately quoted | Not re-verified | This review did not fetch external URLs; it checked only that the report contains a source table and local evidence |

## 5. Process Violations

| Check | Finding | Evidence |
| --- | --- | --- |
| Checkpoint not awaited | No evidence found | No incomplete prior gate was found that ticket 28 bypassed |
| Unauthorized commit of another agent's changes | No evidence found | Ticket 28 commit only adds/marks ticket 28 artifacts and writes one lesson row in WORKFLOW |
| Scope exceeded ticket 28 | No source/manifest/test scope expansion found | Commit changes are `WORKFLOW.md`, issue 28, and report 28 |
| Raw Git write commands | No evidence found in the reviewed artifacts | Branch was recorded as a GitButler branch; no worktree or raw-write artifact was found |
| Worktree use | No evidence found | `git worktree list` shows only the primary workspace |
| Research tool routing | Violation / nonconformance | Prompt says atomcode through ctx, WORKFLOW section 4.3 also requires ctx-wrapped atomcode. Report explicitly says this window had no ctx and used Node.js direct execution of atomcode. This is a governance deviation, even though the report was produced |

## 6. Frontier

The substantive research gates for 29, 30, and 31 are present, so the frontier can advance.

Before doing so, record these residuals:
- Correct the local fact `15 clusters` to `14 clusters` in `research-report-round6.md`.
- Record or adjudicate the no-ctx atomcode execution deviation against WORKFLOW section 4.3; this review does not retroactively approve it.
- Preserve the disclosed lockfile external-source gap: ticket 29 can proceed from spec/local evidence, but no new external lockfile claim should be added without a new cited source.

## 7. Commands Run

- `node scripts/import-graph-guard.mjs`
- `npm ci --dry-run --ignore-scripts`
- `but status`
- `git status --short`
- `git branch -a -vv`
- `git rev-list --left-right --count origin/main...bc-branch-5`
- `git rev-list --left-right --count origin/main...main`
- `git worktree list`
- `git show --stat --oneline ticket-28-governance-research`
- Node read-only scans of guard, test-surface, mutex, cluster map, package files, line counts, and local path existence

