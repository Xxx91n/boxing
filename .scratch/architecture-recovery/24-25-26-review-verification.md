# 24/25/26 Independent Review Verification

> 本文件由只读复核生成，不修改项目源码、README 或测试。
> 复核工作区：`D:/Aworker/crx/boxing`
> 生成日期：2026-09-05

## 1. Final Judgments

| Ticket | Judgment | Source-level issue | Relaunch a fix starter? |
| --- | --- | --- | --- |
| 24 README beautify | FAIL | None | Yes, docs-only targeted relaunch |
| 25 Test mutex | PASS with residual | None | No |
| 26 Feature import whitelist | PASS | None | No |

## 2. Repository and Branch Evidence

- `but status` shows these target branches:
  - `arch-recovery-24-readme-beautify` at `c0f6b8f` (`wvm` in GitButler UI).
  - `arch-recovery-25-test-mutex` at `8f5b00a`, with `036204f` as its implementation commit and `8f5b00a` as the report commit.
  - `ticket-26-feature-layer-import-whitelist` at `5ca41d7`.
- Common base is `26a5182` for tickets 25 and 26.
- Ticket 24 is stacked on `bc-branch-1` (`f9e4ed3`) and earlier docs commits. Its own commit patch is still limited to the 15 README/i18n/report files shown below.
- `zz` uncommitted area exists and includes the issue/handoff/prompt files for tickets 23 through 27, `.zcode/`, modified scratch `README.md` and `spec.md`, and deleted `dev-chrome`.
- `git diff --check` exited 0.

## 3. Ticket 24 Completion Definition

| Criterion | Evidence | Conclusion |
| --- | --- | --- |
| Exactly one language selector at top and no footer duplicate | Root README has one `Languages:` line. All 13 `docs/i18n/README.*.md` files have exactly one `Languages:` line. `README-I18N:START:FOOTER` and `END:FOOTER` have zero matches. | PASS |
| Existing screenshots replace placeholder notes; all local image links resolve | Five PNG paths are referenced. Scanner found 276 local refs across root and 13 locale files, 0 broken. However 11 locale files still contain 2 placeholder `> [!NOTE]` blocks each: `ar`, `de`, `es`, `fr`, `ja`, `ko`, `pt_BR`, `ru`, `th`, `vi`, `zh_TW`. `zh_CN` and `hi` were cleaned, but the report incorrectly states the other 11 had no placeholder blocks. | FAIL |
| Install/usage/privacy/development commands remain true to `package.json` | Ticket 24 commit touches no `package.json`, no test source, no NTP source, no scripts. Existing README commands still match package scripts inspected for this review. | PASS |
| Localized README generation remains compatible or explicitly verified | `scripts/gen-i18n-readme.js` was not changed. Root README still has one `README-I18N:START`/`END` pair, first `## What Makes It Different` at line 50, and `## Quarantined tests` exists. Generator still writes localized files to repo root, matching the report's recorded pre-existing drift. | PASS for compatibility; no evidence of generator regression |
| `git diff --check` clean and report exists | `git diff --check` exited 0. Report file exists at the required path. | PASS |

### Ticket 24 verdict

`FAIL`. The language selector and footer criteria are satisfied, but the explicit screenshot-placeholder criterion is not complete. The same defect is falsely described as zero-hit in the closure report.

## 4. Ticket 25 Completion Definition

| Criterion | Evidence | Conclusion |
| --- | --- | --- |
| Small Node wrapper permits one local Playwright process | `scripts/test-mutex.mjs` exists and `node scripts/test-mutex-verify.mjs` reports all 5 programmatic gates PASS, including collision rejection with exit 75. | PASS |
| Package scripts expose wrapper and changed-surface as standard local path | `package.json` has `test`, `test:all`, `test:changed`, `test:chromium`, `test:firefox`, `test:failed`, `test:quarantine`, and `test:debug` all routed through `scripts/test-mutex.mjs`; `test:changed` uses `changed`. | PASS |
| Configuration/test changes still fall back to full suite | `scripts/test-surface.mjs` has `isFullSuiteTrigger` for `package.json`, `package-lock.json`, `.github/`, and `test/`, plus unmapped-leaf and minimum-spec fallbacks. Ticket 25 commit does not alter `test-surface.mjs`. | PASS |
| Second concurrent process is rejected or waits | Mutex verifier confirms non-blocking rejection with status 75 and PID diagnostic, dead-PID recovery, wait mode, and CI bypass. | PASS |
| Bounded source-only change runs bounded subset and affected lane remains green | Cluster map maps `ntp/utils.js` to the reported 8 specs, including `boxing-state-sync.spec.ts`. The report's real run was 86 passed / 10 failed, reduced to 3 unique existing failures at `boxing-state-sync.spec.ts` lines 144, 167, and 222. The affected lane did not end green, so this criterion is only partially evidenced. | PARTIAL |
| Closure report exists | `25-test-process-mutex-changed-default-report.md` exists and is committed on branch `8f5b00a`. | PASS |

### Ticket 25 residual diagnosis

- Ticket 25 commit `036204f` changes only `.gitignore`, `AGENTS.md`, `package.json`, `scripts/test-mutex.mjs`, and `scripts/test-mutex-verify.mjs`.
- `git diff 26a5182..036204f -- test/tests ntp background.js scripts/test-surface.mjs test/cluster-map.json` is empty.
- The three failing tests are multi-tab state-sync cases; the reported error signature is `Protocol error (Runtime.callFunctionOn): Internal server error, session closed`. Read-only inspection supports the claim that ticket 25 did not modify the failing tests or runtime code.
- No full Playwright run was performed during this review. The environmental-versus-introduced classification is therefore based on commit scope and code inspection, not an independent fresh baseline.

### Ticket 25 verdict

`PASS with residual`. The wrapper and standard-path changes are implemented and programmatically verified. The remaining green-lane requirement is unresolved due to three pre-existing/environmental state-sync failures.

## 5. Ticket 26 Completion Definition

| Criterion | Evidence | Conclusion |
| --- | --- | --- |
| Enumerate current feature-layer sibling imports from graph | `scripts/import-graph-guard.mjs` contains a 9-edge accepted set. Current graph reports 14 modules, 48 edges, 0 violations. ADR table lists the same 9 edges. | PASS |
| Choose whitelist or ADR errata | Both were implemented: B-9 whitelist and ADR-0016 `勘误-26`. | PASS |
| Implement without adding dependency | Ticket 26 changes only the guard script, ADR, and report. No package dependency change. | PASS |
| Update guard and relevant ADR text | B-9 rule exists in `scripts/import-graph-guard.mjs`; ADR-0016 contains `勘误-26` with the 9-edge table. | PASS |
| Guard passes current graph and fails an intentionally unapproved edge | `node scripts/import-graph-guard.mjs` exit 0 with zero violations. In an OS-temp copy, injecting `conn-layer.js -> sync-engine.js` produced exit 1 with B-2 cycle and B-9 unaccepted-edge violations; temp copy was deleted. | PASS |
| Closure report exists | `26-feature-layer-import-whitelist-report.md` exists and is committed on branch `5ca41d7`. | PASS |

### Ticket 26 verdict

`PASS`. Guard and ADR are synchronized and the negative boundary was independently reproduced in a temporary copy.

## 6. Process Violation Review

- No evidence was found that ticket 24, 25, or 26 own commit patches modified unrelated source/test files outside their declared scope.
- No evidence was found of a reviewed ticket committing another ticket's scratch issue/handoff/prompt files; those remain in the uncommitted `zz` area.
- Potential GitButler concern: ticket 25's report explicitly says it ran `but pull`, removed 5 merged-upstream branches, and rebased 9 branches. `git reflog --all` shows parallel branch commit identities were rewritten after that window, for example ticket 24 `d6dbc12` later appears as `c0f6b8f`, and ticket 26 `7bdde00` later appears as `5ca41d7`, while their own patch content remained the same. This is evidence of commit-identity rewriting and should be judged against WORKFLOW `§4.2` (`不改写他人/其他窗口的提交`).
- `git status --short` identified uncommitted files in `zz`; no status-table or README edits were made by this review.

## 7. Commands Run

- `node scripts/import-graph-guard.mjs` -> exit 0, 14 modules, 48 edges, 0 violations.
- `npm run pretest` -> exit 0, same clean guard result.
- `node scripts/test-mutex-verify.mjs` -> all 5 gates PASS.
- `node --check scripts/test-mutex.mjs` -> exit 0.
- `node --check scripts/test-mutex-verify.mjs` -> exit 0.
- `node --check scripts/import-graph-guard.mjs` -> exit 0.
- `git diff --check` -> exit 0.
- `but status` -> branch and `zz` evidence captured.

