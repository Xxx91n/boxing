# ADR-0003: star-mark moved onto box.isParent, layout.groups deleted

## Date
2026-08-02

## Status
Accepted

## Context
Before A5, Boxing stored the parent-child group relation in two parallel places:
1. `layout.connections` — the edges (each edge unions two boxes' DSU components)
2. `layout.groups` — an explicit array of `{ parentId, members: [...] }` entries
   mirroring the starred parents and their members.

This was a denormalization: `groups` was derivable from `connections` + the
`starred` flag, but instead it was hand-maintained at each connect/disconnect/star/
delete site, which produced drift bugs over many rounds. `markDeleted`, `mergeConcurrentLayout`,
`addMember`, `toggleStarMark`, `applyExternalLayout` all patched `layout.groups`.
A stale `groupIdx` Map cache (introduced as a perf optimization) returned stale lookups
after cross-tab merges, causing group-drag members to either not move or to snap to
far-off positions.

## Decision
Delete `layout.groups` entirely. Move the star-mark onto the box itself as a boolean
`isParent` field:
- `toggleStarMark(parentId)` now flips `box.isParent` on the underlying large-box object.
- `dsuRebuildFromConnections` scans `layout.boxes` once, populating `groupStar` from
  `b.isParent === true`.
- `ensureGroups()` is kept as a *compat shim*: it derives a synthetic `layout.groups`
  array from `layout.boxes.filter(b => b.isParent)`, so any legacy reader (e.g.
  import/backup/webext sync code) that reads `layout.groups` continues to work.
- `addMember` is now a no-op: the DSU auto-unions whenever a connection is created, so
  explicit membership bookkeeping is unnecessary.

`getGroupByParent(parentId)` uses a *lazy DSU rebuild guard*: if `groupStar.size === 0`
on first access after a page load, it calls `ensureGroups()` once. This preserves the
fast-path (O(1) `groupStar.has`) on subsequent calls while ensuring correctness for
tests and UI that read group state before any other call populated it.

## Consequences
- Single source of truth for the star-mark: `box.isParent` on the box object.
  Persistence is automatic because the box is already serialized in `layout.boxes` by
  `saveLayout`.
- `layout.groups` is still emitted by `ensureGroups` for back-compat with any reader
  that depends on it (export/import, pre-A5 backups). It is *derived*, not authoritative.
  Future work could delete the field once all readers migrate.
- The `groupIdx` Map cache is gone. Lookups are direct `groupStar.has(parentId)` (O(1))
  or `dsuGroupMembers(parentId)` (O(α) amortized via path compression in DSU).
- Regression guard: a Playwright spec (`A4/Bug4: parent drag moves group members rigidly`)
  asserts that starring A, connecting B to A, then moving A moves B proportionally
  with grid-snap slack.
