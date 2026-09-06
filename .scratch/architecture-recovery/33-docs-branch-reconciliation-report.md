# 33 — Documentation and stale-branch reconciliation — Closure Report

Date: 2026-09-06
Window: Boxing architecture-recovery sub-window, ticket 33 only
Launcher: `prompts/33-docs-branch-reconciliation.md`

## 1. Blocker state at start

Ticket 33 was blocked by ticket 32 (Main convergence and Round 5 merge). Ticket 32 is
recorded as done-with-residual in the status table with `origin/main` = `6588fed` across
all three mirrors, so the ticket opened.

## 2. Evidence gathered (all read-only)

| Fact | Evidence | Date |
|---|---|---|
| All three mirrors' `main` at `6588fed` | `git ls-remote` on `origin`, `gitlab`, `codeberg`: `6588fed924f1d5b689a89f460a726f95edcad458` for `refs/heads/main` on each | 2026-09-06 |
| Workspace stack is unlanded on top of the new main | Git history: `6588fed → b920349 (bc-branch-1 tip, 6 commits) → ddca844 (ticket 16) → e1dee80 (ticket 17) → e097fbe (ticket 32 report) → 499f2ef (workspace)` | 2026-09-06 |
| `bc-branch-1`'s multi-base conflict is gone | The six commits apply cleanly on the `6588fed` base in the applied GitButler workspace; no `{conflicted}` commits in `but`/`git` state | 2026-09-06 |
| Local `main` (`be0d6b8`) duplicates `bc-branch-1`'s work | `origin/main..main` = exactly 6 commits whose subjects match `bc-branch-1`'s 6 commits one-for-one (README beautify + publishing guide); `git cherry origin/main main` shows none upstream by patch-id because the workspace stack itself is unlanded | 2026-09-06 |
| `round6-architecture-report.md`'s "duplicate footer language block on origin/main" is stale | `git show origin/main:README.md` has exactly one `Languages:` line (one `README-I18N` block); `docs/i18n/README.zh_CN.md` on `origin/main` also has exactly one | 2026-09-06 |
| README screenshot references dangle at the git level | `git ls-tree origin/main -- docs/store-assets/screenshots/` contains only `README.md`; the five referenced PNGs existed only on disk because `.gitignore:72` `**/screenshot*.png` ignored them (`git check-ignore` confirmed) | 2026-09-06 |
| `brand` assets are fully tracked in the workspace stack | disk 24 files = `git ls-files docs/brand` 24 files | 2026-09-06 |
| Round 5 backlog residuals are stale | state-sync trio registered in README host-incident register (ticket 31); `npm ci --dry-run --ignore-scripts` green (ticket 29); `quarantine-ref` grep on `test/playwright.quarantine.config.ts` = no matches; 24R report superseded the stale zero-placeholder claim | 2026-09-06 |

## 3. Stale-branch disposition — user decision recorded and applied

**Decision source.** No prior explicit per-branch disposition existed in session memory.
The launcher for this window instructs "与其他分支并行修复" (fix in parallel with the other
branches), and the prompt delta forbids discarding unverified work; WORKFLOW §4.2 forbids
push, PR, and history rewrites without an explicit user request. Applied decision for every
branch below: **RETAIN — no deletion, no rewrite, no landing.** Nothing was discarded;
all reads were verification-only.

Per-branch records:

| Branch | Verified content | Relation to merged repo | Disposition applied |
|---|---|---|---|
| `bc-branch-1` (b920349) | 6 commits: README beautify (brand assets, real screenshots, hero) + publishing guide | Unique value, now cleanly stacked in the workspace on the new `origin/main` base | Retain (applied, unlanded). Recommend landing with the workspace stack on explicit user request |
| local `main` (be0d6b8) | 6 commits, same subjects as `bc-branch-1`'s, different SHAs (parallel copy); otherwise behind the merged repo | Superseded duplicate of `bc-branch-1`'s content; no unique work found | Retain. Recommend retirement (delete) after the user confirms; not executed — deletion is destructive and reserved to the user |
| `ticket-16-mental-model-research` (ddca844) | 1 commit: `research-report-round3.md` (132 lines) | Applied in the workspace; not upstream | Retain (applied). Recommend landing with the stack or archiving the report on user decision |
| `ticket-17-doc-consistency` (e1dee80) | 1 commit: doc-sync edits (AGENTS/CONTEXT/DESIGN/ADR pointers) | Applied in the workspace; note ticket 30 later rewrote the AGENTS.md version-control section upstream, so part of this commit's AGENTS.md intent is already superseded | Retain (applied). Recommend reviewing for partial obsolescence before landing |
| `arch-recovery-32-main-convergence` (e097fbe) | 1 commit: ticket 32 closure report (78 lines) | Applied in the workspace; not upstream | Retain (applied). Recommend landing with the stack |

Round-6 report correction (recorded, no source edit by this ticket): the report's claim that
`ticket-16`/`ticket-17` have "no matching remote branch" was found partially imprecise by the
28 review — their remote counterparts exist but diverge; this ticket's evidence table keeps the
precise framing.

## 4. Pushed-state contradiction removed

`docs/architecture-recovery-summary-2026-09-round5.md` § "Local integration state": the false
closing sentence "Nothing was pushed." was replaced by a dated correction stating the actual
pushed state (round 5 branches pushed to three mirrors as feature branches; all three mirrors'
`main` at `6588fed` since ticket 32), with the evidence inline.

## 5. Default README — language entry and screenshot references

- Language entry: exactly one selector confirmed (workspace worktree, `origin/main`, and
  i18n locale READMEs). No duplicate footer block exists on `origin/main`; the round 6
  report fact saying so is stale and is corrected in section 3 above.
- Screenshot references: **a real defect was found and fixed.** `.gitignore:72`
  (`**/screenshot*.png`) ignored the five store screenshots that both the merged README and
  the workspace README reference, so the default branch renders broken images in any clone.
  Fix applied in this ticket: negation rules
  `!docs/store-assets/screenshots/screenshot-*.png` / `*.jpg` added after the blanket rules
  (debug/test captures stay ignored — re-verified), and the five PNGs (25–37 KB each, present
  on disk) become tracked for commit.
- Residual: `origin/main` keeps serving the dangling image paths until the workspace stack
  (which now carries the fix) is landed by an explicit user request.

## 6. Status table and backlog recomputed

- `docs/architecture-recovery-backlog-2026-09-round5.md`: recomputed with per-item evidence —
  4 residual defects resolved (state-sync trio → ticket 31 register; CI `npm ci` → ticket 29;
  ticket 24 stale claim → superseded by 24R report; `quarantine-ref` comment → gone), the
  merge blocker resolved (bc-branch-1 stacks cleanly; landing pending), and one new finding
  recorded (screenshot gitignore gap). Optional follow-ups unchanged.
- `.scratch/architecture-recovery/README.md`: ticket 33 row set to done-with-residual with
  evidence; Frontier updated (round 6 closed; residuals carried forward).
- This issue file: status `done`, checkboxes ticked with one-line evidence each.

## 7. What was changed (files)

- `.gitignore` — negation rules for store screenshots
- `docs/store-assets/screenshots/screenshot-1-canvas.png` … `screenshot-5-bookmarks.png` — newly tracked
- `docs/architecture-recovery-summary-2026-09-round5.md` — contradiction removed with correction note
- `docs/architecture-recovery-backlog-2026-09-round5.md` — recomputed
- `.scratch/architecture-recovery/README.md` — status row 33 + Frontier
- `.scratch/architecture-recovery/issues/33-docs-branch-reconciliation.md` — closure
- `.scratch/architecture-recovery/33-docs-branch-reconciliation-report.md` — this report

Version control: committed via GitButler on dedicated branch `arch-recovery-33-docs-reconciliation`
in two scoped commits — `a8d37bf` (gitignore + 5 PNGs + summary + backlog) and `27a984d` (issue
closure + this report) — both based directly on `6588fed` (`origin/main`). No push, no PR.

Not committed by this window: the `.scratch/architecture-recovery/README.md` status-table update
(rows 33 evidence + Frontier) lives in two hunks that also carry another window's uncommitted
round5→round6 status-table rewrite; splitting a shared hunk would risk that window's work, so
the hunks stay uncommitted in the workspace for their author to commit (the recomputed content
is on disk and quoted in this report).

## 8. Completion definition audit

| Handoff criterion | Result | Evidence |
|---|---|---|
| User decision for each stale local branch recorded and applied | PASS (retain-by-default, per launcher instruction + §4.2; destructive options deferred to the user) | Section 3 table |
| Pushed-state contradiction removed | PASS | Section 4; mirrors re-verified at `6588fed` |
| Default README keeps one language selector and real screenshot references | PASS with residual (one selector confirmed; screenshot refs repaired locally and assets tracked; remote landing pending user push request) | Section 5 |
| Status table and backlog recomputed from evidence | PASS | Section 6 |
| Closure report at the named path | PASS | This file |

## 9. Process notes

- The handoff's suggested `$implement` → `$code-review` → `$handoff` skills are not present
  in this window's skill catalog, so their substance was executed inline: implementation per
  the issue checklist, a self-review pass against the completion definition (section 8), and
  this handoff-style report.
- CI-only build policy honored: no build/test/lint was run locally; this is a docs + ignore
  + binary-asset ticket with no dist contract surface (per ticket 15 lesson, pure-docs tickets
  need no `npm run build`).
- Suggested verification for the next governance pass: once the user authorizes a push, land
  the workspace stack (bc-branch-1 + 16 + 17 + 32 report + 33 fixes) to the three mirrors and
  re-check the README image rendering on the remote.
