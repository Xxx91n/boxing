# Architecture Recovery Backlog — 2026-09 Round 7

Status recomputed from worktree evidence on 2026-09-09.

## Resolved This Round

- Stale release download links in all 13 locale READMEs.
- `dev-chrome` historical tracking; `.gitignore` now ignores both generated junction names.
- Ticket 36 visual correctness was accepted by the human; this head did not read pixels.

## Residuals For User Decision

- CI `build.yml` has known pre-existing workflow issues: Ubuntu AMO signing and Windows
  artifact-naming steps. Local build completes.
- Firefox headed cold-start environmental tests remain register-based, not quarantined.
- GitHub Pages root remains 404 because `docs/` has no index page; privacy policy URL is live.
- Question of whether to create a GitHub Release and/or submit a store listing remains a
  maintainer decision; local CRX/XPI are unsigned placeholders.

## Optional Follow-Ups

- Align `scripts/gen-i18n-readme.js` with the current `docs/i18n/README.*.md` structure.
- Add `docs/index.md` if the root Pages URL should resolve.
- Replace the screenshot capture script's build-time dependency on an existing `dist/` with
  a fresh local build before capture, if the current stale-dist check proves fragile.
