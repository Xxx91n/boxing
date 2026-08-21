# docs/agents/

Agent instruction layer: on-demand reference files for agent workflows.

These files are not loaded into context by default. They are referenced from
AGENTS.md `## Agent skills` block or `docs/CONTEXT.md` via context pointers and
consulted only when a specific workflow branch triggers.

## Reader and purpose

**Reader**: AI agents working on this repo (Codex / Claude / equivalent).
**Purpose**: a lookup surface for agent workflows — issue tracker conventions,
triage label mapping, domain doc layout, and one-shot audit deliverables.
These files describe *where* skills should look for project conventions and
*what vocabulary to use*; they are not a status board or a changelog.

## Contents

### Setup-owned (from `/setup-matt-pocock-skills`)

- issue-tracker.md — GitHub issues conventions, `gh` CLI operations, wayfinder workflow
- triage-labels.md — canonical five triage roles mapped to this repo's labels
- domain.md — multi-context domain doc layout, glossary consumer rules

### One-shot workflow deliverables

- ui-audit.md — Phase 7 aesthetic audit findings and remediations (ADR-0008)

### Externalized hard boundaries (from AGENTS.md slimming)

These are live red lines that would crowd AGENTS.md if kept inline. Loaded on
demand when a task touches the relevant area — bug pattern, performance choice,
or manifest build rule.

- critical-lessons.md — past design traps and mutation-path footguns (TDZ, tombstone contract, derived-index liabilities, DSU/CSS invariants)
- performance-anti-patterns.md — rejected optimizations permanently documented so a new model does not re-investigate them (BX-PERF-A1..A5, ADR-0013)
- manifest-contract.md — HARD CONSTRAINT dual-declaration manifest rules (BX-MANIFEST-001..005): source manifest Firefox-tailored, Chrome must load dist/
