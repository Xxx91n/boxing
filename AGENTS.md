<!-- BOXING-CTX-ROUTING-OVERRIDE:START -->
<!-- Project-level hard contract: compresses + localizes host AGENTS.md Tool routing precedence. Do not remove. -->
> **TOOL ROUTING — READ FIRST.** `ctx_*` (context-mode) PREFERRED over `shell`/inline `python -c`/inline `node -e` whenever both can do the job:
>
> - **Analyze/count/transform/read** source (ntp/*.js ES modules (entry ntp.js ~1k lines), background.js, _locales) → `ctx_execute`/`ctx_execute_file` in-sandbox. Print only the distilled answer (counts, offsets, hashes). Never `node -e "s.indexOf(...)"` + `print(s[i:i+N])` to dump source into the window.
> - **Run shell + collect >20 lines or ≥3 commands** (git, ls, test runs) → `ctx_batch_execute(commands, queries)` so only matched windows return; cap before entering conversation.
> - **Multi-file edits/patch scripts** → write the patch script as a file, invoke it via `ctx_execute_file` (shell/bash) OR `ctx_execute` (node/python) with `cwd`. Use `apply_patch` for small literal edits; do NOT chain PowerShell heredoc/`cat <<EOF` for content with `$`/Unicode/template literals (host swallows `$`, corrupts payload).
> - **Web fetch / repo research** → `ctx_fetch_and_index` + `ctx_search`; `curl`/`wget` are FORBIDDEN by host policy.
> - **Recall prior session /诚信记忆** → `ctx_search(source: "decision|error|user-prompt", sort: "timeline")` BEFORE asking the user what we did.
>
> **Boxing-local hot traps (Windows + MV3 + large ntp.js):**
> 1. `python -c "replace(...)"` for ntp.js minified blocks — `//` comments eat single-line-coerced blocks; whole-block edits MUST go through a real multi-line file write, not string `replace` with `"  "` separators.
> 2. IPv6 hosts: `new URL("https://[::1]/").hostname` keeps brackets — `isSafeExtUrl` strips `^[|]$` before matching `AUD_PRIVATE_HOST_RE`.
> 3. PowerShell `Remove-Item -Recurse -Force` is host-policy blocked; use `python pathlib.unlink()` or per-file `node fs.unlinkSync`.
> 4. CRLF: this repo is LF in source. `.gitattributes` enforces it; don't introduce CRLF via PS `Set-Content`. Verify with `git diff --check` before completion.
> 5. Large file patch rounds via `apply_patch` on minified-style lines: after 2 failures, do ONE verified whole-file rewrite (Node `fs.writeFileSync` with literal multi-line string), then `node --check` + `git diff --check`.
<!-- BOXING-CTX-ROUTING-OVERRIDE:END -->

# Boxing — Agent Guide

Boxing is a vanilla-JS Manifest V3 browser extension (Chrome + Firefox) that organizes bookmarks hierarchically on an infinite canvas; the main surface is the new-tab override (`ntp/`).

## How to run

| Task | Command |
| --- | --- |
| Install | `npm install` (repo root) |
| Build | `npm run build` → `dist/boxing-chrome/` + `dist/boxing-firefox/` (`.github/scripts/build.mjs`) |
| Dev load | `npm run dev:chrome` / `npm run dev:firefox` — builds, then web-ext auto-launches (`dev:chrome:no-build` variants skip the rebuild) |
| Syntax check | `node --check ntp/ntp.js && node --check background.js` |
| Full tests | `npm test` — Playwright suite, mutex-guarded; `pretest` runs import-graph + migration-golden + css-balance guards |
| Bounded tests | `npm run test:changed`; single spec: `npx playwright test --config=test/playwright.config.ts test/tests/<spec>.spec.ts --project=chromium` |
| Demo build | `node .github/scripts/build-demo.mjs` (injects chrome-stub + the `__BOXING_DEMO__` flag) |

Chrome: load unpacked `dist/boxing-chrome/` (never the repo root). Firefox: `about:debugging` → Temporary Add-on → `dist/boxing-firefox/manifest.json`. The Firefox Playwright lane is headless; LibreWolf is manual-verify only. Second concurrent test run is rejected with exit 75 (process mutex, `scripts/test-mutex.mjs`).

## Tech stack

- Manifest V3, dual-declaration `manifest.json` (Chrome + Firefox compat — `docs/agents/manifest-contract.md`)
- Vanilla ES modules in `ntp/`, no framework, no bundler (zero-build); `ntp/ntp.css` is a build artifact (ADR-0011)
- `chrome.storage.local` + `unlimitedStorage` (ADR-0002); optional WebDAV/Gist sync engine
- Calver versioning (`vYYYY.M.D`); 14 locales via `_locales/` + build-time validator (ADR-0005)

## Directory conventions

| Path | Role |
| --- | --- |
| `ntp/` | New-tab-page source (ES modules + CSS sources) |
| `background.js` | MV3 service worker |
| `_locales/` | 14 locale message files |
| `test/` | Playwright suite (`test/tests/boxing-*.spec.ts` + config; see `test/README.md`) |
| `scripts/` | Build/test/gate tooling |
| `.github/scripts/` | Build pipeline (`build.mjs`, `build-demo.mjs`, tailor steps) |
| `docs/` | Product + architecture docs (`adr/`, `agents/`, `history/`, `archive/`, `i18n/`) |
| `dist/`, `dev-chrome`, `dev-firefox` | Build outputs / web-ext junctions (gitignored) |
| `.scratch/` | Local agent work-log area — untracked, cited as evidence, never a product claim |

## Issue tracker

GitHub issues at [Xxx91n/boxing](https://github.com/Xxx91n/boxing) via `gh` — conventions: `docs/agents/issue-tracker.md`; triage roles: `docs/agents/triage-labels.md`.

## Domain docs

- Root `CONTEXT-MAP.md` routes to root `CONTEXT.md` (build/dev-load vocabulary) and `docs/CONTEXT.md` (domain glossary + invariants).
- ADRs: `docs/adr/` (start with 0007, 0008, 0013, 0017). New ADRs MUST follow `docs/adr/0000-adr-template.md` (`## Consequences` + `## Review` = decision date + 30 days).
- Design: `docs/DESIGN.md`; CSS pairing rules: `docs/css-dual-write-convention.md`.
- On-demand agent references (`docs/agents/`): `manifest-contract.md`, `critical-lessons.md`, `performance-anti-patterns.md`, `security-rules.md`, `engineering-invariants.md` — loaded on demand, not preloaded.
- Testing governance: `docs/testing-governance.md` (quarantine register, waiver ledger).

## Working & VCS discipline

- No npm dependencies, no framework/UI-library adoption, no WXT migration without explicit user approval.
- Preserve MV3 Chrome+Firefox constraints: manifest contract, service worker, permissions, i18n keys across all locales.
- GitButler (`but`) is the only version-control interface: `but diff` → `but commit -b <branch> -m "<summary>" <change-ids>`. Commit early and small — working-tree diffs are transient. No push/PR without explicit instruction; never rewrite history or discard user-owned changes.
- After any source-file modification run `codegraph sync` (exploration rules: `docs/agents/engineering-invariants.md`).
