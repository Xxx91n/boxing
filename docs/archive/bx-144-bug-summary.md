# BX-144 Bug: Star State Loss After Child Deletion

> Archived: 2026-08-08. Bug fixed; core lessons preserved.
> Full root-cause analysis was in docs/bx-144-bug-summary.md (pre-archive).

## Bug

Delete a child box B connected to parent A → A's isParent star state lost.

## Root Cause

`toggleStarMark` unstar path called `markDeleted("large:A")` (tombstone),
writing it to storage. Later `saveLayout()` async merge resurrected the
tombstone from another tab, causing A's star state to be cleared on next
`dsuRebuildFromConnections`.

## Lessons (codified into AGENTS.md + ADRs)

1. **Tombstones are for physical deletion only** — never reuse for state
   flips (star/unstar). Use dedicated state-transition mechanisms.
2. **Async merge spread has blind spots** — explicit cleanup operations need
   an independent ledger, not spread-merge overwrite semantics.
3. **Test star-unstar-star cycles** — single star → delete won't trigger;
   must go through unstar → star cycle to expose tombstone resurrection.
4. **Per-tab state vs persisted state boundary** — `groupStar` (Set),
   `clearedTombstones` (Set) are per-tab memory; `layout.boxes`,
   `layout.connections`, `layout._meta.deleted` are persisted. Never mix.
