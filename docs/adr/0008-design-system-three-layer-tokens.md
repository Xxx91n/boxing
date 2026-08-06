# ADR-0008: Design System Three-Layer Token Architecture + CSS Source Split + Dark Mode Token Consolidation

## Date
2026-08-06

## Status
Accepted — Phase 1-4 implemented (2026-08-06).
- Phase 1: three-layer token architecture in design-system.css (34 primitive + 26 semantic)
- Phase 2: ntp.css split into 4 sources (base/settings/onboarding/conn), build.mjs cat step (commit 0801c3a)
- Phase 3: 60 redundant dark-mode overrides deleted (commit cb66f17); 31 true-exception blocks kept
- Phase 4: 10 component state spec tables in docs/DESIGN.md aligned to code reality; checkbox hover rule added (commit 6da765a)

## Context
The architecture audit (docs/architecture-audit.md) and grill-with-docs review identified
that Boxing's design system has 6 structural problems:

1. **Flat token architecture** — 42 CSS variables in a single :root block, no primitive→semantic→component
   layering. Industry standard (Linear, Stripe, Vercel, W3C DTCG) uses three layers.
2. **Single 2284-line CSS monolith** — ntp.css contains 22 sections (base/box/canvas/search/settings/
   modal/zoom/onboarding/conn/onboarding) in one 55KB file. BX-DEV-013 dual-write compliance is
   hard to maintain at this scale.
3. **105 redundant dark-mode per-component overrides** — ntp.css L1509-2250 has ~120 `.ntp--dark .xxx`
   blocks. Code-level analysis: 165 properties are token-replaceable (bg/color/border), only ~5 are
   structural exceptions (conn-line opacity, onboarding flex layout). These exist because the original
   code didn't trust the token layer to propagate.
4. **No settings CSS separation** — modal/settings/zoom-controls/onboarding (~500 lines) mixed into
   ntp.css. Root cause of the Chrome settings slider visibility bug.
5. **No design decision source document** — CSS decisions scattered across design-system.css comments,
   css-dual-write-convention.md, AGENTS.md BX-DEV rules, CONTEXT.md, ADR-0003/0006. No single entry.
6. **No component state specifications** — 10+ components each define hover/active/disabled ad-hoc,
   using different semantic sources (`--color-card-edge` vs `--color-accent` for hover borders).

## Decisions (grill-confirmed)

### Q1: Token architecture — (C) Progressive migration to three layers
- **Final state**: Full three-layer architecture (primitive → semantic → component).
- **Development**: Phase 1 adds primitive layer (~30 raw values) to design-system.css; existing 42
  variables become semantic layer, their values changed to reference primitives. ntp.css zero changes
  in Phase 1. Phase 3+ introduces component-layer tokens per new feature.
- **Primitive palette**: 9 warm-neutral ramp stops (50/100/150/200/300/700/800/850/900) + 3 accent
  stops (300/500/600) + dark equivalents. RGB triplets (`--warm-900-rgb`) for rgba-derived tokens.

### Q2: CSS source split — (D) Source files + build concatenation
- **Final state**: Source CSS split into `ntp/base.css`, `box.css`, `settings.css`, `canvas.css`,
  `search.css`, `conn.css`, `zoom.css`, `onboarding.css`. build.mjs adds a cat step to produce
  single `ntp.css` artifact. HTML zero changes (still loads `design-system.css` → `ntp.css`).
- **No new dependencies** — cat is a Node fs concatenation, no build tool added.

### Q3: Dark mode override consolidation — (C) Delete tokenizable + keep exceptions
- **Final state**: ~100 of 105 `.ntp--dark .xxx` blocks in ntp.css deleted (token layer covers them).
  ~5 structural exceptions kept with `/* DARK-EXCEPTION: <reason> */` comments:
  - `.ntp--dark .conn-line { opacity: 0.82 }` — contrast aliasing mitigation (BX-145)
  - `.ntp--dark .onboarding__lang { flex layout }` — layout override, not color

### Q4: Design decision document — (B) Create docs/DESIGN.md
- **Final state**: Single source of truth for CSS token architecture, color palette, typography rules,
  component state specifications, dark mode strategy. css-dual-write-convention.md stays independent.
  CONTEXT.md keeps domain glossary only (no CSS implementation details).

### Q5: Component state specifications — (B) All 10 core components
- **Final state**: State tables for box/button/search/search-results/modal/zoom-controls/bm-row/
  crumbs/onboarding/checkbox written into DESIGN.md. Each defines Default/Hover/Active/Disabled with
  token references. Components reference these as the normative spec.

## Constraints Preserved
- BX-DEV-013: CSS dual-write (large-box + small-box paired selectors) — maintained in split source files
- BX-EXPLORE-005/006: No translate3d/will-change on boxes — not affected by token changes
- BX-DEV-011: No npm dependencies — build.mjs cat step uses Node fs built-in
- Chrome + Firefox parity — design-system.css is single-source; both browsers load same file
- Vanilla JS — no build tool, no PostCSS, no Tailwind

## Phases

### Phase 1 (DONE): Primitive + semantic layers in design-system.css
- Add 21 primitive values (9 warm light + 3 accent light + 9 warm dark + 3 accent dark + RGB triplets)
- Rewrite 42 semantic variables to reference primitives
- Dark mode overrides reference dark primitives
- ntp.css zero changes

### Phase 2: CSS source split + build concatenation ✅ (commit 0801c3a)
- Split ntp.css into 4 contiguous source files: `ntp/base.css`, `ntp/settings.css`, `ntp/onboarding.css`, `ntp/conn.css`
  (Sections map: base = layout/header/search/library/canvas/largebox/boxpin/inner/smallbox/footer; settings = modal/zoom/resize/bookmark-add/edit; onboarding; conn)
- build.mjs A8.0: concatenate source files → `ntp.css` artifact; A8.0b: strip CSS source files from dist (only ntp.css ships)
- Verify: byte-identical (cat output == original ntp.css 55444 chars); git diff --check clean

### Phase 3: Dark mode override audit + deletion ✅ (commit cb66f17)
- Audited 91 `.ntp--dark .xxx` blocks against design-system.css dark semantic layer (L126-155, 19 tokens)
- Deleted 60 fully-safe blocks (197 lines / 4870 chars) — same var(--xxx) token in light and dark, dark semantic layer already covers
- Kept 31 true-EXCEPTION blocks: 17 "prop not in light rule" (dark adds new behavior), 14 different-token light vs dark (semantic switch), 1 mixed (checkbox bg vs transparent)
- new ntp.css: 50574 chars (was 55444); build DONE_BUILD; node --check OK

### Phase 4: docs/DESIGN.md + 10 component state tables ✅ (commit 6da765a)
- DESIGN.md created with token architecture, palette, typography, dark mode strategy, 10 component state spec tables
- Phase 4 audit found 6 spec/code mismatches; resolved by updating DESIGN.md 4 tables to match code reality (box/button hover border accent→card-edge; box default bg canvas→elevated; search-results shadow pop→shadow-2; crumbs hover color+underline→bg surface) and adding code hover rule for checkbox per spec
- CONTEXT.md keeps domain glossary only (per Q4 decision A)
- css-dual-write-convention.md remains independent (per Q4 decision A)

## Anti-Regression
- Pre-split: snapshot ntp.css for byte comparison after Phase 2 cat
- Pre-delete: Playwright screenshot of light + dark mode before Phase 3
- build.mjs A8 validator (L205-238) continues to enforce dual-write markers
