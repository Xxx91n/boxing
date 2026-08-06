# ADR-0008: Design System Three-Layer Token Architecture + CSS Source Split + Dark Mode Token Consolidation

## Date
2026-08-06

## Status
Accepted — Phase 1 (primitive + semantic layers) implemented in design-system.css; Phase 2-4 pending.

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

### Phase 2: CSS source split + build concatenation
- Split ntp.css into `ntp/base.css`, `box.css`, `settings.css`, `canvas.css`, `search.css`,
  `conn.css`, `zoom.css`, `onboarding.css`
- build.mjs: cat step produces `ntp.css` artifact
- Verify: git diff --check, build output byte-identical to pre-split ntp.css

### Phase 3: Dark mode override audit + deletion
- For each of 105 `.ntp--dark .xxx` blocks: test if token layer covers the property
- Delete if tokenizable; keep with `/* DARK-EXCEPTION */` if structural
- Verify: visual parity test (light + dark) via Playwright screenshot

### Phase 4: docs/DESIGN.md + 10 component state tables
- Write DESIGN.md with token architecture, palette, typography, dark mode strategy
- Write state tables for all 10 core components
- Update AGENTS.md to reference DESIGN.md

## Anti-Regression
- Pre-split: snapshot ntp.css for byte comparison after Phase 2 cat
- Pre-delete: Playwright screenshot of light + dark mode before Phase 3
- build.mjs A8 validator (L205-238) continues to enforce dual-write markers
