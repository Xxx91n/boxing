<!-- BOXING-CTX-ROUTING-OVERRIDE:START -->
<!-- Project-level hard contract: compresses + localizes host AGENTS.md Tool routing precedence. Do not remove. -->
> **TOOL ROUTING — READ FIRST.** `ctx_*` (context-mode) PREFERRED over `shell`/inline `python -c`/inline `node -e` whenever both can do the job:
>
> - **Analyze/count/transform/read** source (ntp/*.js ES modules (entry ntp.js ~2.2k lines), background.js, _locales) → `ctx_execute`/`ctx_execute_file` in-sandbox. Print only the distilled answer (counts, offsets, hashes). Never `node -e "s.indexOf(...)"` + `print(s[i:i+N])` to dump source into the window.
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

# Browser Extension Agent Guide

## Applicability

| Field | Value |
|---|---|
| Scope | Browser extension development under `D:\Aworker\crx\boxing` |
| Primary reader | Future AI coding agents |
| Style | Machine-readable first: tables, command blocks, MUST/MUST NOT rules |
| Target browsers | Chrome + Firefox unless a project-specific guide narrows scope |
| Default implementation style | Minimal dependencies, standards-first WebExtension code |

## Hard Rules

| Rule ID | Type | Rule |
|---|---|---|
| CRX-R-001 | MUST | Treat this file as project-local operating instructions for browser extension work only. |
| CRX-R-002 | MUST | Prefer Manifest V3 for new or migrated Chrome/Firefox extension work. |
| CRX-R-003 | MUST | Preserve browser-extension constraints: popup, options page, new tab page, content scripts, background service worker, permissions, host permissions, and store submission metadata. |
| CRX-R-004 | MUST | Use the available Chrome extension development guidance before changing extension APIs, Manifest V3 behavior, service workers, content scripts, popup UI, side panel UI, or Chrome Web Store metadata. |
| CRX-R-005 | MUST | Use the available modern web guidance before choosing CSS, browser APIs, storage APIs, security patterns, or Baseline-sensitive features. |
| CRX-R-006 | MUST | Use the available frontend design guidance before changing popup, side panel, options page, new tab page, or injected content script UI aesthetics. |
| CRX-R-007 | MUST | Use available browser runtime tooling for screenshot, DOM, CSS, console, and network validation when visual or runtime behavior changes. |
| CRX-R-008 | MUST | Keep Chrome + Firefox compatibility visible in design and validation steps. |
| CRX-R-009 | MUST NOT | Do not add npm dependencies unless the user explicitly approves. |
| CRX-R-010 | MUST NOT | Do not default to shadcn/ui, Tailwind, Figma, React, Plasmo, Browserbase, or Stagehand. |
| CRX-R-011 | MUST NOT | Do not migrate an existing unpacked extension into WXT unless the user explicitly requests a full framework migration. |
| CRX-R-012 | IF-THEN | If a project-specific `agent.md` exists in a subdirectory, follow it after this guide. |
| CRX-R-013 | MUST | After every code/config/asset batch edit, immediately persist the work through the GitButler workflow (WORKFLOW §4.2, `.scratch/architecture-recovery/WORKFLOW.md`): `but diff` to confirm the changes, then `but commit -b <branch> -m "<summary>" <change-id...>`. NEVER only `node --check` or build-run without persisting a commit. Reason: working tree diff is NOT a record — only the committed history survives. Lone edits without commits have repeatedly lost weeks of work after a turn reset or context compression. Do not push or open a PR unless the user explicitly asks (§4.2); a local `but commit` is the minimum bar to persist the user's work before claiming exit, and CI dispatch can sync later. |
| CRX-R-014 | MUST | Treat working-tree diff as transient: if you end a turn (or the user aborts) without a commit, every untracked edit risks being lost. Commit early, commit small, through the GitButler workflow (§4.2): `but diff` then `but commit -b <branch> -m <scoped-message> <change-id...>`. Use scoped commit messages (e.g. `fix(boxing): NTP surface clamp top:40px`) rather than one huge blob. |
| CRX-R-015 | MUST NOT | Do not discard user-owned working-tree changes destructively — no hard reset of the working tree, no forced whole-file revert, no clearing uncommitted edits to blank the tree — unless the user explicitly authorizes it. Version control follows WORKFLOW §4.2 (GitButler only; never rewrite other agents' commits or move HEAD to throw away work). A user pulling back a regression means surgical file revert by `apply_patch`/Edit, never a destructive branch operation. |

## Approved CRX Capabilities

| Capability | Use when | Constraint |
|---|---|---|
| Chrome extension guidance | Manifest V3, service workers, popup/options/newtab UI, content scripts, permissions, Chrome Web Store readiness | Use for API correctness and publishing readiness. |
| Modern web guidance | Modern CSS, Baseline-compatible APIs, browser-platform behavior | Use for CSS/API currency and cross-browser support. |
| Frontend design guidance | High-aesthetic UI decisions for popup, side panel, options, new tab, or injected UI | Use before visual redesigns. |
| Browser runtime validation | Screenshot, DOM/CSS/runtime/console/network validation | Use after UI, manifest, service worker, or runtime changes. |
| Cross-browser validation | Firefox behavior checks and Chrome/Firefox parity | Use when feature behavior may differ by browser. |
| WXT framework | New Chrome+Firefox extension scaffolds | Use only for new scaffolds or explicit migration requests. |

## Build and Verification

| Scenario | Command or action | Expected result |
|---|---|---|
| Existing unpacked extension validation | Load unpacked extension in Chrome/Firefox | Extension loads without manifest errors. |
| UI verification | Use available browser runtime screenshot/DOM/console inspection | Visual result matches requested state. |
| Syntax pre-check | `node --check ntp/ntp.js && node --check background.js` | Both exit 0. |
| Full e2e | `cd D:/Aworker/crx/boxing && npx playwright test --config=test/playwright.config.ts --project=chromium --reporter=line` | ~3-4 min, all Boxing specs PASS (`extension-test.spec.ts` + `boxing-*` specs). |
| Standard local verification | `npm run test:changed` (ticket 25: process-level mutex + changed-surface selection; ambiguous/config/test changes auto-fall back to the full suite) | Bounded subset green; second concurrent run rejected with exit 75. |

## Playwright & Browser Testing

Test dir: `D:/Aworker/crx/boxing/test` (after `npm install` at repo root). `test/playwright.config.ts` `EXTENSION_PATH` path-resolves to `..` = repo root. Specs live in `test/tests/` and are prefixed `boxing-*`.
- Chromium project (headed, persistent context, `--load-extension`) is the primary lane.
- Firefox project uses `-no-remote`; LibreWolf is manual-verify only (no remote debug).
- Run a single spec: `npx playwright test --config=test/playwright.config.ts test/tests/boxing-viewstate-sync.spec.ts --project=chromium`.
- Test files: 33 spec files in `test/tests/` (31 `boxing-*`, plus `extension-test.spec.ts` and `data-recovery.spec.ts`), including `boxing-audit`, `boxing-auto-expand`, and conn/DSU specs; they cover NTP rendering, DOM, WebDAV sync, onboarding, memory, zoom, connections, and export/import. Run from repo root via `npm test` (full suite, mutex-guarded; `pretest` runs the import-graph guard `scripts/import-graph-guard.mjs`). Every local Playwright lane is wrapped by `scripts/test-mutex.mjs` (ticket 25): one test process at a time, second concurrent run rejected with exit 75, stale locks auto-recovered, mutex skipped on CI. Concurrency gate: `node scripts/test-mutex-verify.mjs`.

## Chrome Extension Workflow

- **Dev load (recommended)**: `npm run dev:chrome` or `npm run dev:firefox` — uses web-ext (Mozilla official tool) to auto-launch browser with correct dist loaded. Requires `npm install` first.
-   `npm run build` runs automatically (chained in the dev script — see BX-MANIFEST-004b). This prevents the "stale dist" bug where source was fixed but dist was never recompiled.
- **GUI load** (browser extensions page): Chrome -> Load unpacked -> select `dev-chrome/` | Firefox -> Load Temporary Add-on -> select `dev-firefox/manifest.json`. Run `npm run build` first to create the junctions.
- **Fast reload** (skip build): `npm run dev:chrome:no-build` or `npm run dev:firefox:no-build` — web-ext loads existing `dist/` without rebuilding. Only safe after at least one `npm run build` in the current session.
- Load unpacked (Chrome): `chrome://extensions` -> Developer mode -> Load unpacked -> select `dist/boxing-chrome/` (auto-discover from project root — do NOT load repo root in Chrome).
- Load unpacked (Firefox): `about:debugging` -> This Firefox -> Load Temporary Add-on -> select `dist/boxing-firefox/manifest.json` (or raw repo root for Firefox dev).
- Tip: If you accidentally load the repo root (`D:/Aworker/crx/boxing`) in Chrome, Chrome will show `background.scripts requires MV2` (older checkouts that still declared `browserSettings` may also warn `Permission 'browserSettings' unknown`) — this is expected. Rebuild with `node .github/scripts/build.mjs` and load `dist/boxing-chrome/` instead.
- Inspect: service worker (`chrome://extensions` -> Details -> service worker), popup (right-click toolbar icon -> Inspect popup), errors (Errors button on extension card).
- MV3 requirements: valid `manifest.json`, service worker active, only declared permissions requested.
- New tab override should load `ntp/index.html` with beige theme and zero console errors.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in [Xxx91n/boxing](https://github.com/Xxx91n/boxing); use the `gh` CLI for all operations. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles mapped verbatim: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout: root `CONTEXT-MAP.md` points at root `CONTEXT.md` (build/dev-load) and `docs/CONTEXT.md` (domain glossary); all ADRs live in `docs/adr/`. See `docs/agents/domain.md`.
New ADRs MUST follow the template in `docs/adr/0000-adr-template.md` - a `## Consequences` section and a review date of decision date + 30 days are mandatory; the existing 16 ADRs are grandfathered (no bulk rewrite).

# Boxing Project Specialization

### Documentation governance

Three-layer separation (agent-era practice, 2026-08-19):
- Human layer: README, CONTRIBUTING, docs/ top-level product docs (CONTEXT, DESIGN, css-dual-write-convention, adr/, publishing, i18n, privacy)
- Agent instruction layer: this AGENTS.md (canonical) + docs/agents/ (on-demand reference for grill plans, UI audits)
- History layer: docs/history/ (version history, ponytail debt ledger) + docs/archive/ — not loaded by default, query on demand

docs/agents/ holds one-shot agent workflow deliverables. docs/history/ holds versioned runbooks.
Both are referenced from here, never bulk-loaded into context.

## Applicability

| Field | Value |
|---|---|
| Project path | D:\Aworker\crx\boxing |
| Current extension | Boxing (manifest version 2026.8.21, calver) |
| Current manifest | Manifest V3 |
| Target browsers | Chrome + Firefox |
| Main UI surface | New tab override: ntp/index.html, ntp/ntp.js (CSS via build artifact ntp/ntp.css — see ADR-0011) |

## i18n Requirements

| Rule ID | Type | Rule |
|---|---|---|
| BX-I18N-003 | MUST | Keys with $1$ or $2$ must include a placeholders object: { "1": { "content": "$1" } }. |
| BX-I18N-005 | MUST | English fallback (I18N_FALLBACK) in ntp/i18n.js must cover every i18n key in case fetch fails. |
| BX-I18N-006 | MUST | data-i18n, data-i18n-title, data-i18n-placeholder attributes in HTML must match a real key. |

BX-I18N-001/002 (14-locale key completeness) are enforced at build time by the A7 validator in `.github/scripts/build.mjs` (ADR-0005). The custom i18n store/fallback lives in `ntp/i18n.js` (was BX-I18N-004), guarded by `test/tests/boxing-i18n-module.spec.ts` (source contract + forced-fallback + three-language switch).

## NTP module map

ntp/index.html loads native ES modules directly (zero build): `ntp.js` (entry orchestration) → `render.js` (canvas render / drag / connections) / `state.js` (shared state) / `storage.js` (storage write facade) / `persist.js` (layout persistence + theme packs) / `i18n.js` (dictionary + fallback + store) / `utils.js` (pure helpers) / `favicon.js` (favicon cache). Settings/init domain (ticket 10, ADR-0016 four layers): `credentials.js` (PBKDF2/AES-GCM envelope) / `sync-engine.js` (WebDAV+Gist transport, outbox merge, alarms backup — persists only via storage.js) / `settings-ui.js` (settings modal + controls + import/export) / `onboarding.js` (bg onInstalled signal → NTP tour). UI behavior invariants are carried by these module boundaries, the E2E suite (`test/tests/boxing-*.spec.ts`), and the ADRs (`docs/adr/`); refactor decisions are consolidated in docs/adr/0007-architecture-refactor-decisions.md.

## Code Exploration

| Rule ID | Type | Rule |
|---|---|---|
| BX-EXPLORE-001 | MUST | All project exploration (searching files, reading source, analyzing structure) MUST use .codegraph (ctx tools / codegraph DB) as the primary index. Direct filesystem traversal (ls, dir, Get-ChildItem for source discovery) is prohibited unless .codegraph is unavailable or the task is trivially scoped to one known file. |
| BX-EXPLORE-002 | MUST | Before answering any "where is X", "how many Y", "what does Z do" question about the codebase, query .codegraph first (via ctx_search or ctx_execute_file over the DB). Only fall back to direct file reads when .codegraph lacks the needed granularity. |
| BX-EXPLORE-003 | MUST | After every project modification (edit, add, delete, rename a source file), run `codegraph sync` from the repo root so the index reflects the change. Do NOT wait until session end — index staleness makes all downstream exploration (BX-EXPLORE-001/002) return wrong results. CLI: `codegraph sync` (incremental) or `codegraph index` (full rebuild). |
| BX-EXPLORE-004 | MUST | Before planning, bug-hunting, or grilling architectural questions, query .codegraph first (`codegraph explore <query>`, `codegraph callers <symbol>`, `codegraph impact <symbol>`, or `codegraph query <name>`). Use the symbol graph to trace call paths, find dependents, and measure blast radius before editing. Only fall back to ad-hoc grep/read when .codegraph genuinely lacks the needed symbol (e.g. new code added in the same turn but not yet synced). |

## CSS Dual-Write Convention (Global)

**Global convention document: [docs/css-dual-write-convention.md](docs/css-dual-write-convention.md)** — every CSS rule that affects both `.large-box` and `.small-box` MUST be written in paired selectors (`.large-box` + `.small-box`) with a `BX-CSS-DUAL-WRITE` marker comment (the A8 build validator in `.github/scripts/build.mjs`, ADR-0005, checks the marker). When adding a new visual rule, check the convention doc first for the required markers.
**Design system document: [docs/DESIGN.md](docs/DESIGN.md)** — token architecture (primitive→semantic→component), palette, typography, component state specs, dark mode strategy (ADR-0008).

## Critical Lessons Learned

See [docs/agents/critical-lessons.md](docs/agents/critical-lessons.md) — Past design traps and mutation-path footguns (TDZ, tombstone contract, derived-index liabilities, DSU/CSS invariants).

## Performance Anti-Patterns (DO NOT DO — ADR-0013)

See [docs/agents/performance-anti-patterns.md](docs/agents/performance-anti-patterns.md) — Rejected optimizations permanently documented so a new model does not re-investigate them (BX-PERF-A1..A5).

## Boxing Version History

Historical version notes (v3.3 → v3.6.6 features and incremental dev rules) have been moved to `docs/history/boxing-changelog.md` to keep this operating contract lean. See that file for per-version feature lists, BX-DEV rule additions, and i18n key references by version.

Top-level behavior rules (BX-DEV / A1-A5 class) were thinned in ticket 09 (2026-09-01): their invariants are now carried by the ntp module structure, the E2E suite (test/tests/boxing-*.spec.ts), and the ADRs — full rule text preserved in git history. All incremental rules from v3.3..v3.6.6 (BX-DEV-014..112) live in `docs/history/boxing-changelog.md` alongside their release context. The Security Rules section below is the authoritative SEC-series list.

## Manifest Source-of-Truth Contract (2026 calver manifests)

See [docs/agents/manifest-contract.md](docs/agents/manifest-contract.md) — HARD CONSTRAINT dual-declaration manifest rules (BX-MANIFEST-001..007) — source manifest keeps the Firefox-compat dual background declaration + gecko block (browserSettings is build-time injected by the Firefox Tailor), Chrome must load dist/.

## Security Rules (SEC series — v3.7.9f security audit)

| Rule | Level | Description |
|---|---|---|
| SEC-01 | MUST | Mock fallback api = mock MUST NOT pollute self.chrome / self.browser globals. Keep mock local to avoid breaking other extensions or browser internals in file:// test mode. |
| SEC-03 | MUST | All contentEditable title elements MUST have a paste event listener that forces plain-text insertion via document.execCommand('insertText', false, ...). Prevents rich-text/HTML injection through paste. Applies to: large box title, small box title, inner crumb title. |
| SEC-06 | MUST | Import JSON payloads MUST be size-capped at 2MB (JSON.stringify(data).length > 2_000_000 → rejected). Prevents stack overflow / OOM from excessively deep or large malicious imports. |
| SEC-08 | MUST | High-frequency saveLayout() calls (drag end, pan end, zoom) MUST use saveLayoutDebounced() with 300ms debounce. Direct saveLayout() retained for critical paths: enter/exit boxes, delete, pin/expand toggle, title blur, import. Note: as of A6, layoutStorage uses storage.local (10MB / unlimited with permission), not storage.sync — storage.sync has a 100KB total / 8KB per-item quota and a 120 writes/min (2/sec) rate limit. storage.local removes the rate limit but keep the debounce for I/O performance. |
| SEC-11 | MUST | ensureHttpsUrl() MUST reject javascript:, data:, vbscript: protocols before any URL construction. These dangerous protocols are returned as-is (unmodified) so callers can reject them further. |
| SEC-15 | MUST | ntp/index.html MUST include a <meta> Content-Security-Policy header: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' https: data:; connect-src 'self' https:;. This prevents XSS, inline script injection, and unauthorized external resource loading. |
