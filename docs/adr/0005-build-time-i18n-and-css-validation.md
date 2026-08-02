# ADR-0005: Build-time i18n key consistency + CSS dual-write marker validation

## Date
2026-08-02

## Status
Accepted

## Context
Boxing supports 14 locales (en + 13 others). Per BX-I18N-DEV-002/003, every key in
`_locales/en/messages.json` must exist in all 13 other locale files. Drift was
previously caught only when a user with a non-en language saw a missing translation,
which is a slow feedback path.

Per BX-DEV-013 (added in a previous round), CSS rules that affect both `.large-box`
and `.small-box` must be written as paired selectors with a `BX-CSS-DUAL-WRITE`
marker comment. Drift here produces subtle bugs where a rule is added for large boxes
but not mirrored to small, so small-box canvas looks different — but the bug only
surfaces when the user enters a small-box surface or toggles between them.

## Decision
Add two validators to `.github/scripts/build.mjs` that run *before* dist tree
generation:

1. **A7 (i18n key consistency)**: parse `_locales/en/messages.json`, build the key set,
   then iterate every other `_locales/<lang>/messages.json` and report missing/extra
   keys. Currently silent-passing (0 missing, 0 extra across all 14 locales); the
   validator catches future regressions in CI before they reach users.

2. **A8 (CSS dual-write marker)**: parse `ntp/ntp.css` line by line; for any selector
   line that contains BOTH `.large-box` and `.small-box`, check the 3 preceding
   lines for a `BX-CSS-DUAL-WRITE` comment. Report violations.

Both validators are currently *soft* warnings: they log to build output but do not
abort the build. This is intentional — once drift is discovered, the abort can be
flipped on for CI gating. For now, surfacing the issues via build logs is enough to
guide engineering attention without blocking local development.

## Consequences
- Future i18n drift is surfaced within seconds of a build instead of after release.
- CSS authoring drift on large/small pairing shows up in build logs.
- Build script reads ~14 _locales JSON files (each ~10-20 KB) on every build — adds
  <50ms to a build that already takes ~1s. Negligible.
- The validator writes no files; it is read-only. Safe to extend with stricter fail
  modes (`throw new Error(...)`) once a baseline is confirmed stable.
