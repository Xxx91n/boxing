# Round 7 Ticket 37 Review

Evidence audited from the current worktree. No screenshot pixels were read by this head.

## Claim-to-Evidence Table

| Claim | Evidence | Conclusion |
|---|---|---|
| Dedicated GitButler branch | `but status -fv` shows `ticket-37-readme-release-claims` | Pass |
| Code commit scopes README only | commit `9adc9e7` changes only `README.md` | Pass |
| Report is separate commit | commit `88080d8` changes only the report | Pass |
| No GitHub Release download links remain | `rg` for `github.com/Xxx91n/boxing/releases` and `Download the latest` returns no matches | Pass |
| No-package-published callout present | README line 79 has the IMPORTANT callout | Pass |
| Signing semantics present | README lines 103-105 distinguish CRX self-signing, unsigned XPI, and store/AMO signing | Pass |
| Screenshots reference ticket 36 pixels | five SHA256 prefixes match ticket 36 report exactly | Pass |
| Locale structure remains valid | validator rerun: 14/14 pass, zero findings | Pass |
| Whitespace clean | `git diff --check 04f9d04..ticket-37-readme-release-claims` empty | Pass |
| Blocker state accurate | status table recorded 37 ready after 35 and 36 acceptance | Pass |

## Process Findings

- No cross-ticket files were included in the branch.
- No raw Git write command evidence.
- No checkpoint-before-execution violation is provable or disprovable from the worktree; not approved by silence.
- Report correctly admits 13 locale files still contain stale release links; this is a documentation residual, not ticket 37 source code.

## dev-chrome vs dev-firefox Anomaly

Current authoritative state:

- `git ls-tree HEAD dev-chrome dev-firefox`: only `dev-chrome` exists (symlink mode 120000).
- `git ls-tree origin/main dev-chrome dev-firefox`: only `dev-chrome`.
- Current index contains both `dev-chrome` and `dev-firefox`; `dev-firefox` is an uncommitted
  `A` entry, while both paths show working-tree deletion status relative to the index.
- `.gitignore` already intends `dev-chrome/` and `dev-firefox/` to be ignored.

Interpretation: `dev-chrome` is a historical tracked symlink despite the ignore rule.
`dev-firefox` has no matching historical commit and is being re-added by the local build
workflow, producing the asymmetric GitHub view you observed. Both are generated junctions
and should not be source-tracked. This is a separate repository-hygiene defect, not part of
ticket 37.

Recommended next ticket: remove tracked `dev-chrome`, stop creating/tracking both dev
junctions, and verify build output remains loadable from `dist/boxing-chrome` /
`dist/boxing-firefox`.

## Frontier

No existing Round 7 ticket remains open: 34, 35, 36, and 37 have reviewed evidence. Two
unaddressed residuals are visible: locale stale-release links and the dev-junction tracking
anomaly. Both need the brain's approval before ticket creation or repair.
