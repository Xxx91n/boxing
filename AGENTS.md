# Boxing — Agent Guide

Boxing is a vanilla-JS Manifest V3 extension (Chrome + Firefox) that organizes bookmarks hierarchically on an infinite canvas; the main surface is `ntp/`.

## Run
- `npm install`; `npm run build` → `dist/boxing-chrome/` + `dist/boxing-firefox/`
- `npm run dev:chrome` / `npm run dev:firefox` (builds first); `npm test` (Playwright, mutex-guarded; `pretest` runs guards)
- Single spec: `npx playwright test --config=test/playwright.config.ts test/tests/<spec>.spec.ts --project=chromium`

## Do not change
- Load Chrome from `dist/boxing-chrome/`, never the repo root; `ntp/ntp.css` is a gitignored build artifact — edit the split CSS sources.
- No npm runtime deps, framework, bundler, or WXT migration; preserve the dual-declaration manifest, service worker, permissions, and all 14 `_locales/` keys.

## Non-obvious traps
- Never edit large or minified-style `ntp/ntp.js` blocks with `python -c replace(...)`; write the whole multi-line block, then `node --check`.
- `isSafeExtUrl` strips `^[|]$` from IPv6 hostnames before the private-host regex.
- PowerShell `Remove-Item -Recurse -Force` is blocked; use `node fs.unlinkSync` or `pathlib.unlink`.
- Sources are LF: verify `git diff --check`; a concurrent test run exits 75.
- After source changes run `codegraph sync`.

## Agent skills

### Issue tracker

GitHub issues at [Xxx91n/boxing](https://github.com/Xxx91n/boxing) via `gh` — conventions: `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five roles, label strings 1:1: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` — mapping: `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — consumer rules: `docs/agents/domain.md`.
