# docs/history/

History layer: versioned runbooks and process-product documents.

These files track what happened during development — version histories,
debt ledgers, completed one-shot plans, and similar artifacts. They are not
loaded into context by default; query on demand.

## Reader and purpose

**Reader**: agents who need historical context (bug patterns, removed code
rationale, version-specific rules) and humans browsing prior work.
**Purpose**: a long-term memory layer. Live operating rules live in AGENTS.md
and CONTEXT.md; this directory holds the retired detail behind those rules —
completed plans, per-version changelogs, and the ponytail debt
ledger. Consulted only when a current task needs to understand *what
happened before* for trace/audit purposes — not as the home of operating
rules or hard boundaries (those live in AGENTS.md and docs/agents/).

## Contents

- boxing-changelog.md — per-version feature lists, BX-DEV rule additions, i18n key references
- ponytail-debt.md — ponytail technical debt ledger
- grill-plan-ui-audit-fix.md — completed grill UI audit fix plan (one-shot workflow deliverable, retired)

## Git history declaration (ticket 62, 2026-09-12)

**Authoritative history**: `origin/main` on GitHub
(<https://github.com/Xxx91n/boxing>). The remote branch is the only
authoritative history line; local refs and the GitButler workspace commit are
regenerable and are never the source of truth. Never rewrite pushed history:
no force-push, no history surgery. Past local-only ref drift (ticket 58, six
stale duplicate commits) was resolved by pointing the local ref at the remote,
verifying zero content loss by patch-id comparison.

**CI run URLs**: CI evidence is cited from
`https://github.com/Xxx91n/boxing/actions/runs/<id>` run pages and their
artifacts. Run URLs remain resolvable while the repository exists but are not
guaranteed to survive history rewrites of the branch they ran against;
treat the run page plus its artifact as the evidence pair. Currently cited
baseline runs: 34626507101 (ticket 48 residual-red ledger, WORKFLOW.md),
34641377036 (ticket 49 G-B manual golden path). If a cited run URL ever goes
stale, record the replacement in the citing document rather than editing
history.
