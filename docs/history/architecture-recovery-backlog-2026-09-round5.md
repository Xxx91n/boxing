# Architecture Recovery Backlog — 2026-09 Round 5

These items were recorded after Round 5. Status recomputed from evidence on 2026-09-06
by ticket 33 (docs and stale-branch reconciliation); each entry cites the evidence that
changed its state.

## Merge blocker

**RESOLVED (2026-09-06, tickets 32+33).** The blocker was that `arch-recovery-24-readme-beautify`
depended on `bc-branch-1` and stacking produced a README.md multi-base conflict. Evidence of
resolution: after ticket 32 landed the round 5 + round 6 stacks to `origin/main` (`6588fed`),
`bc-branch-1`'s six commits apply cleanly in the GitButler workspace on the new `origin/main`
base — the workspace history is `6588fed → b920349 (bc-branch-1) → ddca844 (ticket 16) →
e1dee80 (ticket 17) → e097fbe (ticket 32 report)` with no conflict. Remaining: landing that
workspace stack to the three mirrors' `main` is a push operation that awaits an explicit user
request (WORKFLOW §4.2).

## Residual defects

- ~~Three pre-existing `boxing-state-sync` multi-tab failures are environmental~~ —
  **RESOLVED (ticket 31, 2026-09-06):** classified environment-only (host-load browser
  instability, not app defects); registered in the README "Host-environment incident register"
  with CI re-verification due 2026-10-06. Deliberately not `@quarantine`-tagged.
- ~~CI `npm ci` fails on all three OS runners~~ — **RESOLVED (ticket 29):** lockfile
  regenerated; `npm ci --dry-run --ignore-scripts` exit 0; landed to all three mirrors'
  `main` at `6588fed` (verified by `git ls-remote` on 2026-09-06).
- ~~Original ticket 24 closure report still contains a stale zero-placeholder claim~~ —
  **RESOLVED as documented:** the 24R repair report
  (`.scratch/architecture-recovery/24-readme-beautify-language-entry-repair-report.md`)
  root-caused the false claim (the original scan regex missed 11 locales' placeholder text)
  and repaired the gap; the original report is retained as history and superseded by 24R.
- ~~`test/playwright.quarantine.config.ts:17` still has one `quarantine-ref` comment~~ —
  **RESOLVED (verified 2026-09-06):** `grep -n 'quarantine-ref' test/playwright.quarantine.config.ts`
  returns no matches.

## Found by ticket 33 (2026-09-06)

- **README screenshot assets were never in git.** `.gitignore` line 72 (`**/screenshot*.png`,
  added to keep test/debug captures out) also ignored the five store screenshots that the
  merged README references (`docs/store-assets/screenshots/screenshot-1..5-*.png`), so the
  default-branch README rendered broken images for any clone. Fixed in ticket 33: negation
  rule `!docs/store-assets/screenshots/screenshot-*.png` added and the five PNGs tracked.
  Landing to the mirrors' `main` remains pending (see merge blocker note above). Related:
  ticket 24's "0 断链" verification used `fs.existsSync` on disk and could not see this
  git-level gap.

## Optional follow-ups

- Align `scripts/gen-i18n-readme.js` output path with the `docs/i18n/` layout.
- Consider `node --test` middle-layer coverage when CI duration crosses roughly ten minutes.
