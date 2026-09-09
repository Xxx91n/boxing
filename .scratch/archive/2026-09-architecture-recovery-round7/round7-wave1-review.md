# Round 7 Wave 1 Review

Review mode: direct evidence audit. The agent window could not expose a separate subagent;
all evidence below was re-read from the current worktree and re-run locally.

## Incident Before Ticket Review

The review request names two reports:

- `35-authoritative-publication-surface-verification-report.md`
- a second report identified only as `36`

The current worktree contains the first report. It does **not** contain
`36-english-store-screenshot-capture-report.md`, no branch is present for ticket 36, and no
screenshot asset under `docs/store-assets/screenshots/` has changed. Therefore ticket 36
cannot be reviewed and must not be marked complete. The review below covers the two actual
implemented wave-1 branches: ticket 34 and ticket 35.

## Ticket 34: Multilingual README structure repair

| Claim | Evidence | Conclusion |
|---|---|---|
| Repair is on a dedicated GitButler branch | `but status -fv` shows `ticket-34-readme-structure`, tip `44d3db4`, stacked on common base `04f9d04` | Pass |
| Branch changes only the intended files | `git diff --name-only 04f9d04..ticket-34-readme-structure` lists 12 locale files, validator, report; no runtime/manifest/test source | Pass |
| Structural validator is executable and passes | `node .scratch/architecture-recovery/34-locale-structure-check.mjs` exit 0, printed 14/14 pass, 0 findings | Pass |
| Validator syntax is valid | `node --check .scratch/architecture-recovery/34-locale-structure-check.mjs` exit 0 | Pass |
| Diff is whitespace/line-ending clean | `git diff --check 04f9d04..ticket-34-readme-structure` empty | Pass |
| zh_TW malformed Usage/Privacy action is fixed | validator C2/C3/C5/C6 pass for all locales, including zh_TW | Pass |
| No other-window changes were claimed | branch diff contains no ticket 35/36/37 files | Pass |

## Ticket 35: Authoritative publication-surface verification

| Claim | Evidence | Conclusion |
|---|---|---|
| Dedicated branch and commit | `but status -fv` shows `ticket-35-publication-verification`, tip `15c0793` | Pass |
| Commit scope only report | `git diff --name-only 04f9d04..ticket-35-publication-verification` returns only the report | Pass |
| Owner gecko GUID used, not a guessed ID | manifest.json 1-based lines 41-43 contain exactly `{2F5A8F1E-9B3C-4D7E-A2B1-6F4C8E9D3A7F}` | Pass |
| Zero local git tags | `git tag --list` count 0 | Pass |
| Pages root lacks index | `docs/index.md` absent; `docs/_config.yml` and `docs/privacy-policy.md` exist | Pass |
| Root Pages URL 404 | independent fetch returned HTTP 404 | Pass |
| Privacy policy URL 200 | independent fetch returned HTTP 200 | Pass |
| GitHub Releases empty | independent fetch to releases API returned `[]`; `/latest` returned 404 | Pass |
| User-site repo absent | independent fetch to user-site repo API returned 404 | Pass |
| AMO author search count zero | independent fetch returned `{count:0,results:[]}` | Pass |
| AMO owner-GUID probe 401 | independent fetch returned HTTP 401 | Pass |
| Edge search has no Boxing listing | report's detail came from a rendered edge search; this review fetched a 200 response but Node fetch did not render the SPA content | Unverified on search-result contents; status only |
| Serialized atomcode execution | report self-describes one run, but local repo has no machine evidence of process/session/quota state | Unverifiable from current evidence |
| No checkpoint-before-execution violation | no repo artifact records checkpoint acknowledgements; current scope cannot prove or disprove | Unverifiable, not approved |

## Process Violations

- No branch contains files from another ticket.
- Ticket 34 branch contains 14 files, all within its documented scope.
- Ticket 35 branch contains one report, matching its documented scope.
- Uncommitted brain-window files and unrelated `dev-firefox` entry remain in `zz`; neither
  ticket branch claimed them.
- No raw Git write command evidence was found in the inspected branches or reports.

## Ticket 36: Human screenshot-only task

Status: **not reviewable / report missing**. Since the instruction forbids this agent from
reading screenshots, the only reviewable evidence for ticket 36 is a human-produced outcome
report plus changed/store-tracked screenshot assets. Neither exists in the current worktree.
Ticket 36 should remain blocked on human input and cannot advance the frontier.

## Current Recheck

- Locale validator rerun: 14/14 pass, zero findings.
- Ticket 34 branch file set: 12 locale files, validator, report. No runtime source.
- Ticket 35 branch file set: only the publication report.
- External probes rerun: Pages root 404; privacy 200; Releases `[]`; user-site repo 404;
  AMO author count zero; owner GUID 401.
- Git tags: zero.
- Ticket 36 report still absent; no screenshot diff.

## Ticket 36: Human-accepted screenshot capture

Human acceptance received 2026-09-09 for the five screenshot images. The review did not read
the screenshot pixels; visual correctness is human-owned evidence as instructed.

| Claim | Evidence | Conclusion |
|---|---|---|
| Dedicated branch | `but status -fv` shows `ticket-36-store-screenshots` with two commits | Pass |
| Capture command persisted | `test/tests/take-store-screenshots.mjs` present, `node --check` pass | Pass |
| Scope is bounded | commit `f46fa26` changes 5 PNGs + capture script; commit `fb11b91` adds report only | Pass |
| Five files are valid 1280x800 PNGs | PNG header audit: all signature PNG, width 1280, height 800 | Pass |
| Visual semantics are correct | human acceptance, as this head is forbidden from reading screenshots | Pass by human evidence |
| Diff line-ending clean | `git diff --check 04f9d04..ticket-36-store-screenshots` empty | Pass |
