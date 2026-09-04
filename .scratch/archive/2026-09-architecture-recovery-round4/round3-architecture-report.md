# Round 3 Architecture Report (2026-09-03)

## Evidence snapshot

- `ntp/ntp.js`: 994 lines; `render.js`: 1613; `conn-layer.js`: 788; `popups.js`: 433.
- All 15 source JavaScript files pass `node --check`.
- Module dependency graph contains no cycles.
- CodeGraph sync: 65 files, 926 nodes; new `conn-layer.js` and `popups.js` are indexed.
- Workspace has no source diff; only the machine-local dev junction is visible.

## Remaining gaps

1. The structure changed, but authoritative documents still describe the pre-round-2 layout:
   `AGENTS.md` module map, ADR-0007, ADR-0010, domain `CONTEXT.md`, `DESIGN.md`, and root
   `CONTEXT.md`. The root `CONTEXT.md` also contains encoding damage in the Accent Theme
   section.
2. Five Firefox quarantine entries remain failing and are due for a repair-or-retire decision
   by 2026-10-02.
3. The project needs a fresh, cited decision on which industrial mental model should be the
   canonical target before any further restructuring is proposed.

## Proposed ticket decomposition

| Ticket | Blocked by | Purpose |
|---|---|---|
| 16 mental-model deep research | None | Cited industrial-model decision |
| 17 documentation consistency sync | 16 | Make docs match the implemented structure |
| 18 quarantine expiry decision | None | Repair or retire five Firefox failures before due date |

## Non-goals

Do not perform another line-count-driven split, add a framework, replace GitButler, or change
product positioning in this round.