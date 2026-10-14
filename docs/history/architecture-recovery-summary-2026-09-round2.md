# Architecture Recovery Round 2 Summary (2026-09)

## Scope

Round 2 continued the boxing architecture recovery after round 1 archived the initial
single-file split. The remaining tickets 11-15 were implemented and reviewed by the
brain window.

## Completed Tickets

| Ticket | Result | Evidence |
|---|---|---|
| 11 render geometry downsink | done | `zoomAtPoint` moved to `ntp/utils.js`, build/test green |
| 12 conn layer module | done | `ntp/conn-layer.js` extracted, build/test green |
| 13 popups module | done after rework | `ntp/popups.js` extracted; Firefox i18n checkpoint fixed with 120s budget |
| 14 quarantine governance | done | quarantine refs, ledger, CI patrol added |
| 15 ADR consequences section | done | `docs/adr/0000-adr-template.md` added |

## Build Closure Evidence

- `npm run build`: `BUILD_EXIT=0`, `DONE_BUILD`, Chrome and Firefox dists generated.
- `npx playwright test --config=test/playwright.config.ts --project=chromium-extension test/tests/boxing-build-pipeline.spec.ts`: 6 passed.
- `git diff --check`: exit 0.
- `node --check ntp/popups.js ntp/render.js ntp/ntp.js`: exit 0.

## Documentation Consistency Findings

The following stale references are recorded as backlog candidates, not modified in this
round:

- `docs/adr/0007-architecture-refactor-decisions.md` still says all phases are in
  `ntp/ntp.js`; the implementation is now split across `render.js`, `conn-layer.js`,
  `popups.js`, and `utils.js`.
- `docs/adr/0010-user-customizable-accent-theme.md` still says `themeManager` is inline
  in `ntp.js`; it now lives in `ntp/persist.js`.
- `CONTEXT.md` contains apparent encoding artifacts in the Accent Theme glossary.

## Archive

Round 2 scratch artifacts were moved to
`.scratch/archive/2026-09-architecture-recovery-round2/`.
