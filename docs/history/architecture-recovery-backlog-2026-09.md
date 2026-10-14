# Architecture Recovery Backlog (2026-09)

Candidates listed for user decision. They are not ticketized yet.

## Documentation Consistency

- Update or supersede ADR-0007 module-location statement after the round 2 split.
- Update or supersede ADR-0010 `themeManager` location after `ntp/persist.js` extraction.
- Repair the apparent encoding artifacts in the Accent Theme section of `CONTEXT.md`.

## Environment And Test Governance

- Decide whether Firefox headed cold-start timeouts should be governed by worker
  configuration or by increased per-spec timeouts.
- Review the quarantine ledger before its 2026-10-02 due date.

## Version Control

- Confirm whether `dev-chrome` and `dev-firefox` junction noise should remain ignored
  or be handled by a repository-level rule.
