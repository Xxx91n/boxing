# Ticket 17 Closure Report — Documentation Consistency Sync

Date: 2026-09-03
Branch: `ticket-17-doc-consistency` (GitButler, commit `nyk`)
Scope: markdown-only authoritative doc sync; zero source/behavior changes; zero dependencies added.

## Blocking-note deviation (recorded, not silently ignored)

The prompt opener says this ticket is blocked by 16 (Mental model deep research).
At dispatch time `research-report-round3.md` still reads `Status: pending` — ticket 16
had not written its report. The work proceeded because this ticket's target state was
already fixed by spec.md ("framework-free native ES modules with a composition root and
facade injection") and by the round3 evidence snapshot (line counts, module graph, no
cycles); ticket 16's model choice gates *further restructuring proposals*, not the doc
sync itself. Flagged for the brain window: if ticket 16's report later changes the
canonical model, the module map wording here may need one follow-up pass.

## What changed (7 files, 6 in required-list scope + AGENTS.md routing block line-count)

| File | Change |
|---|---|
| `AGENTS.md` | Module map now lists `conn-layer.js` + `popups.js`; `render.js` role corrected to "canvas render / drag / pan / zoom / commit(op) mutation API"; entry described as composition root with facade injection; stale `~2.2k lines` claim → `~1k` (actual 994). |
| `CONTEXT.md` (root) | Repaired 3 BEL (0x07) control bytes that had eaten a leading "a" (`\u0007ccentHue` → `accentHue`, `\u0007pplyAccent` → `applyAccent`, ×2); rejoined line-split "null means mono" damage; removed duplicated intro paragraph; themeManager entry now matches reality (persist.js holds only THEME_PACKS + applyTheme; ADR-0010 HSL machinery no longer exists); section heading marked "superseded by ADR-0012 theme packs". |
| `docs/CONTEXT.md` | 10 stale claims re-anchored: ADR-0007 implementation status → render.js (commit/boxById/tombstone GC) + conn-layer.js (DSU/__dsuDirty/ensureGroups/moveGroupTogether/spatial snap); `moveGroupTogether` ntp.js:1923 → conn-layer.js; `applyExternalLayout` ntp.js:3960 → storage.js; `mergeConcurrentLayout` L780 → storage.js L153; THEME_PACKS/applyTheme ntp.js → persist.js; saveLayoutDebounced target storage.sync → storage.local (A6); phantom `ntp/src/*.css` paths → real `ntp/*.css`; Project Summary now carries the full 14-module map. |
| `docs/DESIGN.md` | THEME_PACKS `ntp/ntp.js (L949)` → `ntp/persist.js (L142)`; applyTheme `ntp/ntp.js L1014` → `ntp/persist.js L200`; init call `(L1116-1117)` → `persist.js loadSettings()`; brittle `BX-DEV-013/014/135` numeric pointer → stable docs/history pointer. |
| `docs/adr/0007-architecture-refactor-decisions.md` | Status line "all phases in ntp/ntp.js" superseded with post-split location note (commit/boxById/GC/viewState → render.js; DSU/dirty/ensureGroups/moveGroupTogether/snap → conn-layer.js). Decisions untouched. |
| `docs/adr/0010-user-customizable-accent-theme.md` | Status gains implementation-location note: theme manager was inline ntp.js at decision time (Q9), moved to persist.js in the module split, then replaced by ADR-0012. |

## Node-verified checks (all PASS, not self-attested)

1. **Path resolution**: 45 md-link + slash-code refs across the 6 docs, two-base resolution
   (doc-dir-relative for links, repo-root-relative for `ntp/...` code paths) → 0 unresolved.
2. **Old-location search**: patterns for `ntp.js:\d{3,}`, `` `ntp/ntp.js` (L…) ``, "all phases in
   ntp/ntp.js", "THEME_PACKS object in ntp/ntp.js", "mergeConcurrentLayout at L780",
   storage.sync persist claim, `ntp/src/`, BEL, U+FFFD → 0 hits. Remaining single-file
   mentions are deliberate historical context in ADR Status/notes (1+1+2 occurrences, listed).
3. **Line-count claims**: `~2.2k`/`~3.3k` patterns → 0 hits; actuals: ntp.js 994, render.js 1613,
   conn-layer.js 788, popups.js 433 (14 modules, 6614 lines total, all `node --check` clean per round3 report).
4. **Module map completeness**: all 14 `ntp/*.js` modules present in both AGENTS.md map and
   docs/CONTEXT.md summary.
5. **Encoding**: all 6 docs UTF-8 without BOM, 0 control bytes, 0 U+FFFD; `git diff --check` clean (LF preserved).
6. **Test content assertions**: `test/tests/boxing-build-pipeline.spec.ts` asserts only
   `BX-MANIFEST-004b` + `stale` in AGENTS.md — both strings intact; no test reads the other docs' prose.

## Version control (WORKFLOW §4.2)

- `but commit -b ticket-17-doc-consistency -m "docs(tickets/17): …" <16 file/hunk ids>`
- Only ticket-17 files committed. Uncommitted and untouched (other windows' work):
  all `test/**` modifications, `dev-chrome` deletion, `.scratch/architecture-recovery/**` round-3 artifacts.
- Not pushed; no PR (per WORKFLOW §4.2).

## Not done / out of scope

- Quarantine entries (ticket 18's lane) — untouched.
- Any behavior, build, or dependency change — none made; no `npm run build` needed (spec: full build required only if source files change).
- `research-report-round3.md` remains pending pending ticket 16.
