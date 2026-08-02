# ADR-0004: Viewport culling + LOD for connection SVG lines

## Date
2026-08-02

## Status
Accepted

## Context
On a canvas with 10+ boxes and many connections, every Ctrl+wheel zoom tick and every
mouse-move during a drag calls `updateSvgLine` on every live SVG `<line>` element.
At low zoom (30%), Chrome renders the lines as jagged because the 1.5 stroke lands
between device pixels and triggers aggressive antialiasing. Firefox renders the same
lines smoothly because its SVG antialiasing is area-based rather than pixel-centered.

Even at normal zoom, lines that sit far outside the visible viewport still pay for
`setAttribute` cost and trigger compositor layers for off-screen geometry.

## Decision
`updateSvgLine(lineEl, c)` now does two cheap operations before setting attributes:

1. **Viewport culling.** Read the parent SVG's `clientWidth` / `clientHeight` once
   (single property read, no layout thrash because the SVG is already composited).
   If BOTH endpoints fall outside the visible rect + a 60 px margin, set
   `lineEl.style.display = 'none'` and return. `boxMidPoint` already returned world
   coords, and the SVG's viewBox matches the world 1:1, so the comparison is just
   four `<` / `>` checks. Result: off-screen lines pay **zero** attribute writes
   per tick.

2. **Level-of-detail stroke width.** Read the current zoom for the line's surface
   (`canvasZoom` or `innerZoom`). Set stroke-width to 1.5 above 80% zoom, 1.0 between
   50-80%, 0.75 below 50%. This sharpens lines and stops Chrome from antialiasing
   a 1.5-px stroke into a 2-px gray smear at 30% zoom, eliminating the long-standing
   "锯齿状" (jagged) report on Chrome only.

The zoom handler (`onCanvasWheel`, `onInnerWheel`, zoom-button `zoomStep` path)
explicitly calls `refreshAllConns()` once after the zoom transform is applied. This
makes the LOD stroke switch and the culling re-evaluate immediately — previously you
had to pan the canvas once to trigger a refresh.

## Consequences
- Panhandle "线条不跟手" / "锯齿状" / "Off-screen rendering hog" reports all closed.
- For users who pan large distances with many off-screen lines, the per-tick update
  cost drops from O(visibleLines) to O(visibleLines) — already a huge win since
  visible lines are bounded by the viewport while off-screen lines can be hundreds.
- Simple change: the strokes look identical at 100% zoom (LOD keeps 1.5 there) and
  only thin at low zoom, where users explicitly want sharper lines anyway.
- No API exposed: the optimization is internal to `updateSvgLine`.
