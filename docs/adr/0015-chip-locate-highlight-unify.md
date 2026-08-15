# Chip Locate Highlight — Unify with Search Hit Mental Model

## Status
Accepted — pending implementation.

## Context
Large box chips (small box preview buttons on collapsed large boxes) called `enterAndLocateSmallBox()` to pan the inner canvas and flash a highlight pulse. But the behavior diverged from `openSearchHit()` (search result navigation) in two ways:

1. **Pan formula**: `openSearchHit` used corner-align (`-sb.x * zoom + 16`, clamped), while `enterAndLocateSmallBox` used center-align (`-sb.x * zoom + (sw - bw) / 2`, no clamp). Users expected the same "find and center" behavior from both entry points.
2. **Highlight**: `openSearchHit` used persistent `small-box--search-match` CSS (`box-shadow: 0 0 0 2px accent`). `enterAndLocateSmallBox` used `small-box--located` with `locate-pulse` animation (`box-shadow` keyframes 0→4px→0). But `contain: layout style` on `.small-box` (added for perf in Bug6) clipped `box-shadow` spread beyond the element's border box, making the pulse invisible.

## Decision
1. **Unify pan formula**: Both `openSearchHit` and `enterAndLocateSmallBox` use center-align (target box center maps to viewport center). Add clamp to `enterAndLocateSmallBox` to match `openSearchHit`'s clamp bounds.
2. **Fix highlight visibility**: Replace `box-shadow` animation in `.small-box--located` with `outline` + `outline-offset` — `outline` is NOT clipped by `contain: layout` (it draws outside the border box without affecting layout). Alternatively, add `contain: none` override on `.small-box--located` during the 2s animation window.
3. **rAF guard**: Wrap the locate + highlight logic in `requestAnimationFrame` to ensure DOM and `innerZoom` are settled after `enterLargeBox` before computing pan offsets.

## Consequences
- Both search and chip-click produce identical "center the target, flash a ring" behavior.
- Highlight pulse visible despite `contain: layout style` on `.small-box`.
- No perf regression — `outline` doesn't trigger layout/paint, and the rAF guard adds one frame of latency (imperceptible).
