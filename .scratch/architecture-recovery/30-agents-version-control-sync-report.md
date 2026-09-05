# Ticket 30 Closure Report — Agent version-control rule reconciliation

- Date: 2026-09-06
- Ticket: `issues/30-agents-version-control-sync.md`
- Handoff: `handoffs/30-agents-version-control-sync.md`
- Blocker 28: done — `research-report-round6.md` delivered; its §5/§8 pointers direct this ticket to translate raw Git wording in `AGENTS.md` into `but` operations with WORKFLOW §4.2 as the single authority.
- Branch: `ticket-30-agents-vc-sync` (GitButler virtual branch per WORKFLOW §4.2; not pushed, no PR)
- Window: Boxing architecture-recovery subwindow (ticket 30), ctx tools active throughout

## What changed

`AGENTS.md` Hard Rules rows CRX-R-013/014/015 (lines 47-49) — the only project-rule lines in the reconciled rule set that still mandated raw Git commands (round6-architecture-report evidence: "AGENTS.md lines 47-49 still require raw Git commands").

- **CRX-R-013**: the `git add -A && git commit -m ... && git push` mandate was translated to the WORKFLOW §4.2 authoritative path: `but diff` to confirm changes, then `but commit -b <branch> -m "<summary>" <change-id...>`. Loss-avoidance intent preserved in full: persist immediately after every code/config/asset batch edit, working-tree diff is not a record, a commit is the minimum bar before claiming exit. The old row contradicted §4.2 by mandating push; the row now defers push and PR to explicit user authorization per §4.2, keeping the local commit as the persistence stopgap.
- **CRX-R-014**: "Commit early, commit small" now names the §4.2 path (`but diff` then `but commit -b <branch> -m <scoped-message> <change-id...>`); the scoped-commit-message guidance and the transient-working-tree rationale are unchanged.
- **CRX-R-015**: the destructive-discard red line is preserved and rewritten without raw command words: no hard reset of the working tree, no forced whole-file revert, no clearing uncommitted edits to blank the tree, unless the user explicitly authorizes it; WORKFLOW §4.2 is named as the sole version-control authority (GitButler only, never rewrite commits of other agents or move HEAD to throw away work); surgical file revert via `apply_patch`/Edit remains the regression-recovery path.

No other project rule file mentions raw version-control commands: all 9 `docs/agents/*.md` files scanned with zero matches before and after the edit.

## Item-by-item verification (issue checklist)

1. **Locate every project rule that mentions raw version-control commands — DONE.** Scan pattern (case-insensitive) over the agent-rule set: `\bgit\s+(add|commit|push|pull|reset|checkout|stash|branch|merge|rebase|switch|restore|cherry-pick|revert|fetch|clone|init|mv|rm)\b | \bgit\s+-- | \bworktree\b`. Pre-edit hits: `AGENTS.md` L47 (`git add` / `git commit` / `git push`) and L49 (`git reset --hard` / `git checkout -- <path>` / `git stash`) = 2 lines; `docs/agents/` (README, critical-lessons, domain, issue-tracker, manifest-contract, performance-anti-patterns, triage-labels, ui-audit) = 0 hits.
2. **Translate to the GitButler workflow without losing loss-avoidance intent — DONE.** Mapping above; no rule was deleted or weakened, and no raw version-control command was added to project rules (new text adds only `but` commands plus the §4.2 reference, per the ticket delta).
3. **Every referenced authority path resolves — DONE.** 15/15 referenced paths exist, including the newly referenced `.scratch/architecture-recovery/WORKFLOW.md` (contains §4.2 with the `but commit -b` path) and every `docs/...` / `CONTEXT*.md` / `.github/scripts/build.mjs` path named in `AGENTS.md`. (An initial scan false-missed markdown-link syntax like `docs/DESIGN.md](docs/DESIGN.md` and globs such as `ntp/*.js`; the clean path list re-verified 0 missing.)
4. **Zero matches for prohibited raw control commands in the reconciled rule set — DONE.** Post-edit scan over `AGENTS.md` + `docs/agents/*.md` = **0 hits**. Remaining `git` mentions in `AGENTS.md` are allowed read-only inspection per §4.2 and the GitButler skill: the `.gitattributes` filename, `git` as a generic shell example in the ctx routing block, the `git diff --check` formatting guard, and "git history" as a concept. Informational sweep outside the agent-rule scope: `CONTEXT.md` / `CONTEXT-MAP.md` / `docs/CONTEXT.md` = 0 hits; `docs/adr/*.md` = 1 historical mention (0011-ntp-css-build-artifact.md L16: 2. git rm --cached ntp/ntp.css to untrack it from git.), untouched — spec Out of Scope excludes ADR rewrites beyond governance-ticket rule conflicts.
5. **Repository formatting guard + closure report — DONE.** `git diff --check` exit 0 (clean) after the edit; this file is the closure artifact named by the handoff.

## Completion definition (handoff) verification

- Project agent rules no longer require raw version-control commands — verified (zero-hit scan above).
- Loss-avoidance intent preserved through the GitButler workflow — verified (CRX-R-013/014 keep persist-always + commit-early; CRX-R-015 keeps the no-destructive-discard red line).
- Every referenced authority path resolves — verified (15/15 exist; WORKFLOW §4.2 present and reachable).
- Repository formatting guard is clean — verified (`git diff --check` exit 0).
- Closure report exists — this file.

## Notes

- The handoff suggested skills `$implement` / `$code-review` / `$handoff`; they are user-invocable mattpocock skills and are not installed in this window (absent from the available skill catalog), so they were not invoked. Their intent was fulfilled directly: minimal implementation, self-review against the completion definition, and this handoff report. The user-invoked `$but` skill was loaded and followed for all version-control operations.
- Ticket delta compliance: no loss-protection intent deleted; no raw version-control commands added to project rules; zero-hit scan evidence recorded above.
- Files committed by this window: `AGENTS.md`, `issues/30-agents-version-control-sync.md`, `handoffs/30-agents-version-control-sync.md`, `prompts/30-agents-version-control-sync.md`, and this report. All other working-tree changes (round6 planning artifacts for tickets 28/32/33) belong to other windows and were left untouched.
