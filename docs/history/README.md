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
