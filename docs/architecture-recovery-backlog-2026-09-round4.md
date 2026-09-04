# Architecture Recovery Backlog — 2026-09 Round 4

These items remain after Round 4. They are not tickets yet.

## Feature-layer sibling imports

The current import graph guard forbids cycles, barrels, background imports, leaf reverse imports, and unwhitelisted browser APIs. It intentionally does not forbid feature-to-feature imports such as `settings-ui -> render` and `sync-engine -> render`.

Decision needed:

- Add a machine-checked feature-layer edge whitelist.
- Or record the current sibling edges as accepted ADR-0016 errata.

## Node middle-layer tests

The pure logic modules may benefit from `node --test` coverage when CI duration crosses roughly ten minutes. The trigger was recorded but no ticket was opened.

## Firefox quarantine residual

The quarantine lane remains patrol-only and non-blocking. A fresh Firefox full-run still needs convergence evidence before treating any future `14/14 Firefox green` statement as authoritative.

## Existing backlog

See `docs/architecture-recovery-backlog-2026-09.md` for earlier carry-over items.
