# Round 5 Architecture Report (2026-09-04)

## Evidence snapshot

- The NTP core is split into 14 native ES modules. `node scripts/import-graph-guard.mjs`
  currently returns `ok:true`, 48 edges, and 0 violations.
- The single-file `ntp.js` governance failure is resolved: the current `ntp/ntp.js` is
  about 57 KB, with rendering, persistence, bookmarks, i18n, storage, and sync split into
  separate modules.
- Test execution has per-process Playwright worker caps and a changed-surface selector,
  but there is no cross-process mutex. Multiple agent windows can still run `npm test`
  concurrently and launch enough headed browsers to overload the host.
- `npm test` remains a full-suite command. `npm run test:changed` exists but is not the
  mandated local verification command.
- Feature-level sibling imports still exist without a machine-checked whitelist. The
  Round 4 backlog explicitly left this as either a whitelist implementation or an
  ADR-0016 errata.
- The product README has no Markdown image embeds, uses HTML picture tags for two
  screenshots, leaves screenshot placeholder notes, and repeats the language selector at
  both the top and footer.
- Five Firefox quarantine entries remain failing. Chromium is 19/19 and Firefox is 14/19
  in the current README table.

## Proposed ticket decomposition

| Ticket | Title | Blocked by | Purpose |
|---|---|---|---|
| 23 | Mental model deep research | None — can start immediately | Choose the Round 5 canonical model for product/README positioning and local test-process governance |
| 24 | README beautify and language entry reposition | 23 — Mental model deep research | Improve README information architecture and visuals; keep one language selector |
| 25 | Test-process mutex and changed-test standardization | 23 — Mental model deep research | Stop multiple local test processes from oversubscribing the host; make changed-surface verification the default |
| 26 | Feature-layer sibling import whitelist | 23 — Mental model deep research | Machine-check accepted feature-to-feature imports or record them as ADR-0016 errata |
| 27 | Firefox quarantine residual convergence | 23 — Mental model deep research; 24 — README beautify and language entry reposition | Repair or retire the remaining Firefox failures and update the README governance table |

## Non-goals

Do not add a test runner, monorepo tool, coverage-based selector, framework, bundler,
TypeScript, or runtime dependency. Do not start another line-count-driven module split.
Do not replace GitButler.
