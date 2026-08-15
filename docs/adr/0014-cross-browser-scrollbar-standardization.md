# Cross-Browser Scrollbar Standardization

## Status
Accepted — pending implementation.

## Date
2026-08-15

## Context
Settings panel scrollbars behaved inconsistently between Chrome and Firefox. Firefox rendered thin overlay scrollbars (via native `scrollbar-width: thin` support since FF64) but scrolling was janky due to `contain: layout style paint` + `will-change: scroll-position` on `.settings-content`. Chrome used classic scrollbars (occupying ~15px gutter) because `scrollbar-gutter: stable` reserved space and no `scrollbar-width` was set, so Chrome fell back to platform default wide scrollbars.

The CSS Scrollbars Styling Module Level 1 spec (`scrollbar-width` + `scrollbar-color`) is Baseline available since Dec 2024 — Chrome 121+, Firefox 64+, Safari 26.2+. CSSWG resolved (2024) that non-initial `scrollbar-width`/`scrollbar-color` values override `::-webkit-scrollbar-*` pseudos entirely.

## Decision
Use standard CSS `scrollbar-width: thin` + `scrollbar-color` (with design tokens) on all scroll containers. Remove `contain: layout style paint` from `.settings-content` (root cause of Firefox jank). Do NOT set `::-webkit-scrollbar` width/height — setting width forces Chrome into classic mode (Chrome for Developers docs: "setting width on ::-webkit-scrollbar effectively turns it into a classic scrollbar"). Do NOT use global `*` selector — apply only to scroll containers (kimi + Google modern-web-guidance: global wildcard causes inconsistent results and performance issues).

`scrollbar-gutter: stable` is retained on `.settings-content` — it only affects classic scrollbars (no-op for overlay), so it's harmless on Chrome overlay and protective if Chrome ever falls back to classic.

## Consequences
- Both Chrome and Firefox render thin, non-space-occupying overlay scrollbars inside the extension.
- Firefox jank eliminated (contain removed, will-change: scroll-position alone is safe).
- Scrollbar colors themed via `--scrollbar-thumb` / `--scrollbar-track` tokens with dark mode override.
- If a future browser version ignores `scrollbar-width`, `scrollbar-gutter: stable` prevents layout shift.
