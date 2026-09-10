# 05 — fix(firefox-scroll): audit modal-overlay backdrop-filter residual jank

**What to build:** audit modal-overlay backdrop-filter residual jank

**Blocked by:** None — can start immediately

**Status:** done (commit pvy @ ticket-05-firefox-scroll)

**GitHub:** https://github.com/Xxx91n/boxing/issues/5

## Acceptance criteria

- [x] backdrop-filter on/off A/B evidence for Firefox smoothScroll
- [x] boxing-state-sync.spec.ts scrollOwners assertion actually fires
- [x] No Chrome visual regression; ADR-0014 not re-broken

Closure (2026-09-10): see reports/05-firefox-scroll-report.md — backdrop-filter removed (visually inert over opaque BX-DEV-140 background, pure Firefox rasterization tax), reduced-motion defensive rule added, scrollOwners dead assert fixed, ADR-0014 Update v3 appended. CI-only policy: local build/test not run, CI verification dispatched by brain agent.
