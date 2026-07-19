<!-- BOXING-CTX-ROUTING-OVERRIDE:START -->
<!-- Project-level hard contract: compresses + localizes host AGENTS.md Tool routing precedence. Do not remove. -->
> **TOOL ROUTING — READ FIRST.** `ctx_*` (context-mode) PREFERRED over `shell`/inline `python -c`/inline `node -e` whenever both can do the job:
>
> - **Analyze/count/transform/read** source (ntp.js ~3.3k lines, background.js, _locales) → `ctx_execute`/`ctx_execute_file` in-sandbox. Print only the distilled answer (counts, offsets, hashes). Never `node -e "s.indexOf(...)"` + `print(s[i:i+N])` to dump source into the window.
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
| Syntax pre-check | `node --check ntp.js && node --check background.js` | Both exit 0. |
| Full e2e | `cd D:/Aworker/crx/playwright && npx playwright test --project=chromium --reporter=line` | ~3-4 min, all Boxing specs PASS (extension-load Qlearly spec is known-dead). |

## Playwright & Browser Testing

Test repo: `D:/Aworker/crx/playwright` (`playwright.config.ts` `EXTENSION_PATH` points to `../boxing`). Specs live in `tests/` and are prefixed `boxing-*`.
- Chromium project (headed, persistent context, `--load-extension`) is the primary lane.
- Firefox project uses `-no-remote`; LibreWolf is manual-verify only (no remote debug).
- Run a single spec: `npx playwright test tests/boxing-viewstate-sync.spec.ts --project=chromium`.
- Known dead spec: `tests/extension-load.test.ts` references a nonexistent Qlearly directory (historical residue); ignore that one failure.

## Chrome Extension Workflow

- Load unpacked: `chrome://extensions` -> Developer mode -> Load unpacked -> select `D:/Aworker/crx/boxing`.
- Inspect: service worker (`chrome://extensions` -> Details -> service worker), popup (right-click toolbar icon -> Inspect popup), errors (Errors button on extension card).
- MV3 requirements: valid `manifest.json`, service worker active, only declared permissions requested.
- New tab override should load `ntp/index.html` with beige theme and zero console errors.

# Boxing Project Specialization

## Applicability

| Field | Value |
|---|---|
| Project path | D:\Aworker\crx\boxing |
| Current extension | Boxing v3.1.0 |
| Current manifest | Manifest V3 |
| Target browsers | Chrome + Firefox |
| Main UI surface | New tab override: ntp/index.html, ntp/ntp.css, ntp/ntp.js |

## i18n Requirements

| Rule ID | Type | Rule |
|---|---|---|
| BX-I18N-001 | MUST | All 13 supported languages (en, zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi) must have complete translations for every i18n key used in the UI. |
| BX-I18N-002 | MUST | New i18n keys must be added to _locales/<lang>/messages.json for all 13 languages before claiming completion. |
| BX-I18N-003 | MUST | Keys with $1$ or $2$ must include a placeholders object: { "1": { "content": "$1" } }. |
| BX-I18N-004 | MUST | Chrome i18n API (chrome.i18n.getMessage) is NOT used; the custom i18n store in ntp.js loads messages.json via fetch. |
| BX-I18N-005 | MUST | English fallback (I18N_FALLBACK) in ntp.js must cover every i18n key in case fetch fails. |
| BX-I18N-006 | MUST | data-i18n, data-i18n-title, data-i18n-placeholder attributes in HTML must match a real key. |

## Development Rules

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-001 | MUST | Use Obsidian-style CSS transform (translate + scale) for infinite canvas pan/zoom. |
| BX-DEV-002 | MUST | Drag uses mousedown/mousemove/mouseup (manual drag), NOT HTML5 drag-and-drop API. |
| BX-DEV-003 | MUST | Title editing zones (.large-box__title, .small-box__title) must block mousedown propagation to prevent drag and click-through. |
| BX-DEV-004 | MUST | Elastic snap on drag-end: collision detection -> find nearest non-overlapping edge -> snap. |
| BX-DEV-005 | MUST | Canvas pan via left-click-drag on empty canvas area; Ctrl+scroll zooms at cursor point. |
| BX-DEV-006 | MUST | Zoom controls in canvas bottom-right corner are fixed-position, unaffected by canvas transform. |
| BX-DEV-007 | MUST | Settings modal is an in-page overlay (not a separate options page). |
| BX-DEV-008 | MUST | Small boxes use list mode only; grid/list toggle removed. |
| BX-DEV-009 | MUST | Bookmark rows are editable via three-dots edit button (inline popup for title+URL). |
| BX-DEV-010 | MUST | Font size adjustable via CSS variable --font-size-base controlled by settings. |
| BX-DEV-011 | MUST NOT | Do not add shadcn/ui, Tailwind, React, Vue, or npm dependencies. |
| BX-DEV-012 | MUST NOT | Do not use brand__mark brown color block (removed). |


## i18n Development Requirements

| Rule ID | Type | Rule |
|---|---|---|
| BX-I18N-DEV-001 | MUST | Every UI string visible to users must use the i18n(key) function, never hard-coded English/Chinese text. |
| BX-I18N-DEV-002 | MUST | All 13 supported languages (en, zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi) must have translations for every i18n key. |
| BX-I18N-DEV-003 | MUST | When adding a new i18n key, add it to _locales/en/messages.json first, then copy to all 12 other locale files with proper translations. |
| BX-I18N-DEV-004 | MUST | I18N_FALLBACK in ntp.js must contain every i18n key as a fallback for when fetch fails. |
| BX-I18N-DEV-005 | MUST | All data-i18n, data-i18n-title, data-i18n-placeholder attributes in HTML must match an existing key in messages.json. |
| BX-I18N-DEV-006 | MUST | Keys with placeholders ($1$, $2$) in messages.json must include a "placeholders" object per Chrome i18n spec. |
| BX-I18N-DEV-007 | MUST | The custom i18n loader in ntp.js fetches _locales/<lang>/messages.json; chrome.i18n.getMessage API is NOT used. |
| BX-I18N-DEV-008 | MUST NOT | Never add hardcoded language strings in JS or HTML that bypass the i18n(key) function. |
| BX-I18N-DEV-009 | MUST | After changing language in settings, re-render all visible UI (canvas, inner surface, crumbs, caption) to reflect new language immediately. |

## Debug Development

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEBUG-001 | INFO | Set DEBUG = true in ntp.js during development; all [Boxing] prefixed console logs help trace issues. |
| BX-DEBUG-002 | MUST | Use Playwright (D:\Aworker\crx\playwright) for automated e2e testing during development. |
| BX-DEBUG-003 | MUST | After each major change, run "node --check ntp.js" to verify syntax before testing in browser. |
## CSS Token Baseline (Boxing v3.1)

| Token | Value | Purpose |
|---|---|---|
| --color-canvas | #F7F3ED | Main warm-neutral canvas. |
| --color-surface | #F3EFE7 | Card surface. |
| --color-elevated | #F0EBE2 | Hover/selected/elevated layer. |
| --color-ink | #2A2520 | Primary near-black text. |
| --color-accent | #A08060 | Muted warm earth accent. |
| --font-size-base | 14px | Adjustable base font size. |

## Architecture (v3.1)

- Infinite canvas: CSS transform(translateX, translateY) scale(Z) on canvas__surface
- Pan: drag empty canvas area (mousedown+mousemove)
- Zoom: Ctrl+scroll at point, Ctrl+/- step zoom, zoom buttons
- Nodes (boxes): absolute positioning in world coordinates
- Dual-level: Canvas (large boxes) -> Inner canvas (small boxes inside one large box)
- Bookmarks: list rows with favicon + three-dots edit button (inline popup for title+URL)
- No grid/list toggle — small boxes are always list mode

## Critical Lessons Learned

1. **Never place executable code before `const`/`let` declarations it references.** `debug()` calling before `const DEBUG` causes TDZ ReferenceError that silently breaks the entire IIFE execution — all subsequent functions and DOM bindings are never defined.
2. **Never place IIFE-scoped code outside the IIFE closing `})();`.** External references to `I18N_FALLBACK` etc throw ReferenceError and halt execution.
3. **Function hoisting does NOT mean safe to call before `let`/`const` init.** Functions referencing `let`/`const` variables in their closure will throw TDZ errors if called before the variable declaration executes.
4. **When debugging "all box creation broken", check console errors FIRST.** Two TDZ errors (`I18N_FALLBACK is not defined`, `Cannot access 'DEBUG' before initialization`) caused the entire init to fail silently — no functions were defined, no events were bound.

## Boxing Version History

Historical version notes (v3.3 → v3.6.6 features and incremental dev rules) have been moved to `docs/boxing-changelog.md` to keep this operating contract lean. See that file for per-version feature lists, BX-DEV rule additions, and i18n key references by version.

Current TOP-LEVEL operating dev rules are consolidated in the tables above (BX-DEV-001..012). All incremental rules from v3.3..v3.6.6 (BX-DEV-013..112) live in `docs/boxing-changelog.md` alongside their release context. The Security Rules section below is the authoritative SEC-series list.

## Security Rules (SEC series — v3.7.9f security audit)

| Rule | Level | Description |
|---|---|---|
| SEC-01 | MUST | Mock fallback api = mock MUST NOT pollute self.chrome / self.browser globals. Keep mock local to avoid breaking other extensions or browser internals in file:// test mode. |
| SEC-03 | MUST | All contentEditable title elements MUST have a paste event listener that forces plain-text insertion via document.execCommand('insertText', false, ...). Prevents rich-text/HTML injection through paste. Applies to: large box title, small box title, inner crumb title. |
| SEC-06 | MUST | Import JSON payloads MUST be size-capped at 2MB (JSON.stringify(data).length > 2_000_000 → rejected). Prevents stack overflow / OOM from excessively deep or large malicious imports. |
| SEC-08 | MUST | High-frequency saveLayout() calls (drag end, pan end, zoom) MUST use saveLayoutDebounced() with 300ms debounce. Direct saveLayout() retained for critical paths: enter/exit boxes, delete, pin/expand toggle, title blur, import. Prevents exceeding Chrome's ~120 writes/min storage.sync rate limit. |
| SEC-11 | MUST | ensureHttpsUrl() MUST reject javascript:, data:, vbscript: protocols before any URL construction. These dangerous protocols are returned as-is (unmodified) so callers can reject them further. |
| SEC-15 | MUST | ntp/index.html MUST include a <meta> Content-Security-Policy header: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' https: data:; connect-src 'self' https:;. This prevents XSS, inline script injection, and unauthorized external resource loading. |
