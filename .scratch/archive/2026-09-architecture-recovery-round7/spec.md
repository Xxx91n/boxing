# Spec — Round 7: Public-Facing Release Integrity

## Problem Statement

The repository has a coherent modular core, but its public-facing and release surfaces do not
match the code. The English README is much more complete than the localized copies, one
locale is structurally corrupted, the store/release links suggest products that do not yet
exist, the root Pages URL 404s while its privacy subpage works, and the generated CRX/XPI
packages are unsigned placeholders for local distribution.

## Solution

Repair the documentation surface first, independently of screenshot capture. Separately,
establish authoritative store and release facts from the maintainer or public search.
Capture all five English store screenshots with Playwright only after the documentation
surface is repaired and the authoritative facts are known. Finally, reconcile the public
README installation and packaging claims with the resulting release policy.

## User Stories

1. As a non-English visitor, I want a complete localized README with the same product
   structure as English, so that I can understand and install Boxing accurately.
2. As a maintainer, I want generated locale documentation checked against the English
   structure, so that drift is caught before it reaches users.
3. As a maintainer, I want authoritative Firefox and Edge store URLs or IDs recorded with
   their public state, so that the README and handoff do not claim unpublished listings live.
4. As a maintainer, I want the GitHub Pages root to resolve, so that opening the documented
   project URL is not a 404.
5. As a store reviewer, I want five English 1280x800 screenshots that match each captured
   label, so that the listing represents the actual product.
6. As an end user, I want installation links to point to assets that exist and are correctly
   signed or clearly marked unsigned, so that following the README works without silent fake
   success.
7. As a future agent, I want the release status table to distinguish zip exclusivity,
   store-side signing, and self-signed local packages, so that the same mistake is not replayed.

## Implementation Decisions

- Locale parity is documentation-only. Treat English as the structure baseline; preserve all
  language-specific links and explanatory text, repair only structure and missing parity.
- Publication truth must be based on authoritative owner-provided URLs or a store's lookup
  result, not on guessed store affinity text.
- Screenshot capture is a later bounded ticket and is not performed while this plan is created.
- Local packaging remains zip for submission and unpacked loading. Store signing is provided
  by each store or AMO/web-ext; the local crx and xpi placeholders must not be presented as
  production-signed installation artifacts without clear qualification.
- Ticket 37 derives its final text from tickets 35 and 36 and is blocked by both.

## Testing Decisions

- Locale repair uses a structural comparison of headings, image links, install links, privacy
  links, and contribution links against English.
- Publication verification uses status codes and authoritative lookup output, never a guessed
  ID or a self-authored assertion.
- Screenshot capture uses a persisted Playwright script and validates each PNG exists at
  approximately 1280x800 with nonblank pixel content.
- Release reconciliation checks GitHub Release count/assets and local artifact presence using
  only evidence gathered by ticket 35.

## Out of Scope

Store submission, browser tooling migration, codebase module restructuring, public repo
redesign, and any release upload not explicitly authorized by the maintainer.

## Further Notes

Source report: `.scratch/architecture-recovery/round7-architecture-report.md`.
