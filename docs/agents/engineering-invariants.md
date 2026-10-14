# Engineering invariants

Externalized from AGENTS.md (2026-10-14 governance pass). Live rules loaded on
demand: i18n hard rules, NTP module map, code-exploration discipline, CSS
dual-write pointer.

## i18n Requirements

| Rule ID | Type | Rule |
|---|---|---|
| BX-I18N-003 | MUST | Keys with $1$ or $2$ must include a placeholders object: { "1": { "content": "$1" } }. |
| BX-I18N-005 | MUST | English fallback (I18N_FALLBACK) in ntp/i18n.js must cover every i18n key in case fetch fails. |
| BX-I18N-006 | MUST | data-i18n, data-i18n-title, data-i18n-placeholder attributes in HTML must match a real key. |

BX-I18N-001/002 (14-locale key completeness) are enforced at build time by the A7 validator in `.github/scripts/build.mjs` (ADR-0005). The custom i18n store/fallback lives in `ntp/i18n.js` (was BX-I18N-004), guarded by `test/tests/boxing-i18n-module.spec.ts` (source contract + forced-fallback + three-language switch).

## NTP module map

ntp/index.html loads native ES modules directly (zero build): `ntp.js` (entry orchestration + composition root, facade injection) → `render.js` (canvas render / drag / pan / zoom / commit(op) mutation API) / `conn-layer.js` (connection lines + DSU + grouping + spatial snap) / `popups.js` (bookmark popups + row rendering) / `state.js` (shared state) / `storage.js` (storage write facade) / `persist.js` (layout persistence + theme packs) / `i18n.js` (dictionary + fallback + store) / `utils.js` (pure helpers) / `favicon.js` (favicon cache). Settings/init domain (ticket 10, ADR-0016 four layers): `credentials.js` (PBKDF2/AES-GCM envelope) / `sync-engine.js` (WebDAV+Gist transport, outbox merge, alarms backup — persists only via storage.js) / `settings-ui.js` (settings modal + controls + import/export) / `onboarding.js` (bg onInstalled signal → NTP tour). UI behavior invariants are carried by these module boundaries, the E2E suite (`test/tests/boxing-*.spec.ts`), and the ADRs (`docs/adr/`); refactor decisions are consolidated in docs/adr/0007-architecture-refactor-decisions.md.

## Code Exploration

| Rule ID | Type | Rule |
|---|---|---|
| BX-EXPLORE-001 | MUST | All project exploration (searching files, reading source, analyzing structure) MUST use .codegraph (ctx tools / codegraph DB) as the primary index. Direct filesystem traversal (ls, dir, Get-ChildItem for source discovery) is prohibited unless .codegraph is unavailable or the task is trivially scoped to one known file. |
| BX-EXPLORE-002 | MUST | Before answering any "where is X", "how many Y", "what does Z do" question about the codebase, query .codegraph first (via ctx_search or ctx_execute_file over the DB). Only fall back to direct file reads when .codegraph lacks the needed granularity. |
| BX-EXPLORE-003 | MUST | After every project modification (edit, add, delete, rename a source file), run `codegraph sync` from the repo root so the index reflects the change. Do NOT wait until session end — index staleness makes all downstream exploration (BX-EXPLORE-001/002) return wrong results. CLI: `codegraph sync` (incremental) or `codegraph index` (full rebuild). |
| BX-EXPLORE-004 | MUST | Before planning, bug-hunting, or grilling architectural questions, query .codegraph first (`codegraph explore <query>`, `codegraph callers <symbol>`, `codegraph impact <symbol>`, or `codegraph query <name>`). Use the symbol graph to trace call paths, find dependents, and measure blast radius before editing. Only fall back to ad-hoc grep/read when .codegraph genuinely lacks the needed symbol (e.g. new code added in the same turn but not yet synced). |

## CSS dual-write

See [docs/css-dual-write-convention.md](../css-dual-write-convention.md) — every CSS rule that affects both `.large-box` and `.small-box` MUST be written in paired selectors (`.large-box` + `.small-box`) with a `BX-CSS-DUAL-WRITE` marker comment (the A8 build validator in `.github/scripts/build.mjs`, ADR-0005, checks the marker).
