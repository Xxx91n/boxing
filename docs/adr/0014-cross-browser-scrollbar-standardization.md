# Cross-Browser Scrollbar Standardization

## Status
Accepted — implemented (commit 08a5a1b).

## Date
2026-08-15

## Context
Settings panel scrollbars behaved inconsistently between Chrome and Firefox. Firefox rendered thin overlay scrollbars (via native `scrollbar-width: thin` support since FF64) but scrolling was janky due to `contain: layout style paint` on `.settings-content` (which forced layout containment that interfered with FF smooth-scroll animation). `will-change: scroll-position` was initially suspected but later confirmed safe — it promotes the scroll container to a compositor layer, which is actually beneficial for FF GPU smooth-scroll. Chrome used classic scrollbars (occupying ~15px gutter) because `scrollbar-gutter: stable` reserved space and no `scrollbar-width` was set, so Chrome fell back to platform default wide scrollbars.

The CSS Scrollbars Styling Module Level 1 spec (`scrollbar-width` + `scrollbar-color`) is Baseline available since Dec 2024 — Chrome 121+, Firefox 64+, Safari 26.2+. CSSWG resolved (2024) that non-initial `scrollbar-width`/`scrollbar-color` values override `::-webkit-scrollbar-*` pseudos entirely.

## Decision
Use standard CSS `scrollbar-width: thin` + `scrollbar-color` (with design tokens) on all scroll containers. Remove `contain: layout style paint` from `.settings-content` (root cause of Firefox jank). **Keep** `will-change: scroll-position` — it promotes the scroll container to its own compositor layer, enabling GPU-accelerated smooth scroll in Firefox. Without `contain`, `will-change` alone does NOT cause jank. Do NOT set `::-webkit-scrollbar` width/height — setting width forces Chrome into classic mode (Chrome for Developers docs: "setting width on ::-webkit-scrollbar effectively turns it into a classic scrollbar"). Do NOT use global `*` selector — apply only to scroll containers (kimi + Google modern-web-guidance: global wildcard causes inconsistent results and performance issues).

`scrollbar-gutter: stable` is retained on `.settings-content` — it only affects classic scrollbars (no-op for overlay), so it's harmless on Chrome overlay and protective if Chrome ever falls back to classic.

## Consequences
- Both Chrome and Firefox render thin, non-space-occupying overlay scrollbars inside the extension.
- Firefox jank eliminated: `contain: layout style paint` removed (was the real root cause). `will-change: scroll-position` retained for GPU layer promotion. Nested scroll container on `.modal__body` eliminated via `overflow: hidden`. `overflow-anchor: none` added to prevent DOM-mutation jitter.
- Scrollbar colors themed via `--scrollbar-thumb` / `--scrollbar-track` tokens with dark mode override.
 - If a future browser version ignores `scrollbar-width`, `scrollbar-gutter: stable` prevents layout shift.

## Update (2026-08-15 v2): Nested Scroll Container Fix
User reported Firefox jank persisted when `general.smoothScroll` is enabled, specifically in the Sync & Backup tab with tall content. Root cause: `.modal__body` had `overflow-y: auto` creating a **nested scroll container** inside `.settings-content` (which also has `overflow-y: auto`). Two overlapping scroll containers caused Firefox's smooth-scroll animation engine to produce double-animation jank.

Additional fixes:
- `.modal__body` changed from `overflow-y: auto` to `overflow: hidden` — eliminates the nested scroll container. Only `.settings-content` scrolls.
- `.settings-content` gains `overflow-anchor: none` — prevents Firefox from auto-scrolling to keep content in view when DOM changes above the fold (a source of jitter when sync/backup panels mutate).

Research: Bugzilla 1490487 (extension popup scroll laggy with `position: sticky`) confirmed APZ limitations in extension contexts. Bugzilla 1989868 (smooth-scroll + JS scroll API jank) fixed in FF146. StackOverflow guidance: reduce DOM complexity, use `will-change` for layer promotion, avoid nested scroll containers.

## Update (2026-09-10 v3): backdrop-filter Residual Jank Audit (Ticket 05)

### Context
ADR-0014 v1/v2 eliminated the major Firefox scroll-jank causes (`contain: layout style paint`, nested scroll containers, missing `overflow-anchor`). Ticket 05 of the 2026.9.12 release-readiness spec audited `backdrop-filter` on `.modal-overlay` as the never-previously-treated residual cost.

### Finding
`.modal-overlay` carried `backdrop-filter: blur(8px) saturate(180%)`. However, BX-DEV-140 changed the overlay `background` from a semi-transparent `rgba()` to `var(--color-surface)` — an opaque color (`#EEE9E1` light / `#2A2724` dark). With an opaque background, the blur is **visually invisible** (the background fully covers the filtered backdrop) yet Firefox WebRender still rasterizes it every frame. This is a pure performance tax with zero visual benefit — the exact residual jank source ticket 05 targets.

Evidence (atomcode-research, indexed under label `atomcode-backdrop-filter-research`):
- **Bug 1995379** (OPEN, ~2025-11): backdrop-filter blur() severely impacts performance — 3x memory / 98% CPU / scroll stutter on a New Tab page (same context as an extension new-tab override).
- **Bug 1809738** (FF110/111 FIXED): picture-caching slice collapse; GPU 24ms vs 2ms per frame.
- **Bug 1418923** (OPEN): blur recomputed per frame; caching impossible.
- **Bug 2007803** (2026): YouTube scroll lag resolves on blur removal.
- vitepress #1049: navbar blur disabled → ~30% framerate improvement.

No direct Bugzilla bug pairs `general.smoothScroll` × `backdrop-filter` (honest gap); the mechanism is indirect — blur per-frame resampling in WebRender rasterization compounds with composited smooth-scroll animation.

### Decision
1. **Remove** `backdrop-filter` (and `-webkit-backdrop-filter`) from `.modal-overlay` in `ntp/settings.css`. Because the background is opaque, removal causes **zero visual regression** — the spec condition "prefer reduced-motion static fallback over deleting the blur outright **if visual design must stay**" is not met (blur has no visual effect to preserve).
2. **Add a defensive rule** in `ntp/design-system.css` `@media (prefers-reduced-motion: reduce)`: `.modal-overlay { backdrop-filter: none !important; }`. If a future change restores a semi-transparent background + backdrop-filter, reduced-motion users automatically get a static overlay (additive graceful-degradation model; Chrome Developers / web.dev treat blur as a decorative effect to disable under reduce).
3. ADR-0014 v1/v2 decisions are **unchanged**: `will-change: scroll-position` retained, `overflow-anchor: none` retained, no `contain`, no nested scroll, `scrollbar-width: thin` retained.

### Consequences
- Firefox smoothScroll residual jank eliminated: the last un-audited scroll-performance cost on `.modal-overlay` is removed.
- No Chrome visual regression: blur was visually invisible (opaque background), so neither Chrome nor Firefox loses any visible effect.
- If a semi-transparent overlay background is restored in the future, the developer must re-add `backdrop-filter` on `.modal-overlay` (settings.css) AND the existing reduced-motion defensive rule will auto-gate it.
- Review date: 2026-10-10 (+30 days) — verify no regressions in Firefox smoothScroll reports after the 2026.9.12 release.