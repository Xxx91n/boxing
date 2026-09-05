# Architecture Recovery Backlog — 2026-09 Round 5

These items remain after Round 5.

## Merge blocker

`arch-recovery-24-readme-beautify` depends on `bc-branch-1`. Stacking it on the Round 5
stack causes a README.md multi-base conflict that GitButler cannot resolve with
`--theirs` or a manual edit in resolution mode. Needs a user decision on whether to
include `bc-branch-1`, rebase ticket 24 onto the current stack without the old README
history, or handle ticket 24 separately.

## Residual defects

- Three pre-existing `boxing-state-sync` multi-tab failures are environmental and were not fixed in ticket 25.
- CI `npm ci` fails on all three OS runners in about 26-28 seconds.
- Original ticket 24 closure report still contains a stale zero-placeholder claim.
- `test/playwright.quarantine.config.ts:17` still has one `quarantine-ref` comment.

## Optional follow-ups

- Align `scripts/gen-i18n-readme.js` output path with the `docs/i18n/` layout.
- Consider `node --test` middle-layer coverage when CI duration crosses roughly ten minutes.
