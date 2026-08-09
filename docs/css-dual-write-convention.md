# CSS Dual-Write Convention (BX-CSS-DUAL-WRITE)

## Problem

Boxing has two parallel rendering surfaces:
- **Large box** (canvas page): `.large-box` — top-level bookmark containers on the main canvas
- **Small box** (inner page): `.small-box` — nested bookmark containers inside a large box

Both surfaces share the same visual language (shadows, borders, radius, animations, z-index, drag states). When a CSS property is added or changed on one surface but not the other, the mismatch manifests as visual bugs (e.g. drag corner radius regression, z-order flicker, content-visibility pan lag).

## Convention

Every CSS rule that affects a box selector MUST be classified with one of three markers:

| Marker | Meaning | Action when modifying |
|--------|---------|----------------------|
| `BX-CSS-DUAL-WRITE` | Paired rule — large-box and small-box share the same property | Changing one side **requires** changing the other side in the same commit |
| `BX-CSS-DUAL-WRITE-SHARED` | Both selectors already in one rule (comma-separated) | Safe — no duplication needed; just edit the shared rule |
| `LARGE-ONLY` | Large-box design difference (no small-box counterpart) | No mirroring needed; document why large-box is unique |
| `SMALL-ONLY` | Small-box design difference (no large-box counterpart) | No mirroring needed; document why small-box is unique |

## Marked Rules (as of BX-145)

### BX-CSS-DUAL-WRITE (paired — editing one requires editing the other)

| Large-box rule | Small-box counterpart | Property shared |
|---------------|---------------------|-----------------|
| `.large-box` | `.small-box` | position, width, height, display, bg, border, radius, shadow |
| `.large-box:hover` | `.small-box:hover` | hover border/shadow |
| `.large-box--dragging` | `.small-box--dragging` | z-index:5, cursor:grabbing, border-radius, overflow, will-change |
| `.large-box--ghost` | `.small-box--ghost` | ghost outline |
| `.large-box__bar` | `.small-box__bar` | title bar bg, padding, border-bottom, flex layout |
| `.large-box__title` | `.small-box__title` | font-size, font-weight, color, ellipsis |
| `.large-box__title[contenteditable]:focus` | `.small-box__title[contenteditable]:focus` | focus outline/bg |
| `.large-box__delete` | `.small-box__delete` | delete button position, size, color |
| `.large-box__delete:hover` | `.small-box__delete:hover` | hover color |
| `.large-box__body` | `.small-box__body` | body padding, overflow |
| `.large-box:not(...)` content-visibility:auto | `.small-box:not(...)` content-visibility:auto | perf: skip offscreen box rendering |
| `.panning .large-box` | `.panning .small-box` | override content-visibility during canvas pan |

### BX-CSS-DUAL-WRITE-SHARED (comma-separated — both selectors in one rule)

| Rule | Property |
|------|----------|
| `.large-box--search-match, .small-box--search-match` | search highlight glow |
| `.large-box--search-hidden, .small-box--search-hidden` | search dim opacity |
| `.large-box:hover .box-resize-handle, .small-box:hover .box-resize-handle` | resize handle visibility |
| `.ntp--square-corners .large-box, .ntp--square-corners .small-box` | square corner toggle |
| `.large-box:hover .box-edge-anchor, .small-box:hover .box-edge-anchor` | edge anchor hotspot visibility |
| `.box--hover-expand.box--collapsed .large-box__body, .small-box__body` | hover-expand collapsed body height |

### LARGE-ONLY (large-box-only design — no small-box counterpart needed)

| Rule | Reason |
|------|--------|
| `.large-box__icon` | Large boxes have an icon element; small boxes do not |
| `.large-box__meta` | Large boxes show meta text (item count); small boxes do not |
| `.large-box__chips` / `.large-box__chip` | Large boxes have chip tags; small boxes do not |
| `.large-box__empty-hint` | Large boxes show hint when empty; small boxes inherit |
| `.large-box__open-hint` | Large boxes show double-click hint; small boxes do not |

### SMALL-ONLY (small-box-only design — no large-box counterpart needed)

| Rule | Reason |
|------|--------|
| `.small-box__mode` | Small boxes have list/grid view toggle; large boxes do not |
| `.small-box--list .small-box__body` | Small-box list view layout |
| `.small-box--grid .small-box__body` | Small-box grid view layout |

## Checklist for new CSS rules

When adding or modifying a CSS rule that touches `.large-box` or `.small-box`:

1. Does the same property apply to both surfaces? → Add the rule to **both** selectors and mark with `/* BX-CSS-DUAL-WRITE */`.
2. Is it a comma-separated shared rule? → Put both selectors in one rule and mark with `/* BX-CSS-DUAL-WRITE-SHARED */`.
3. Is it surface-specific (e.g. only large-box has `__icon`)? → Mark with `/* LARGE-ONLY */` or `/* SMALL-ONLY */` and document the reason.
4. **If you skip the marker, the code review will block the commit.**

## hidden override pairing (BX-DEV-020)

Any CSS selector that sets a layout `display` value (**flex/block/grid/inline-flex**)
MUST also define `.selector[hidden] { display: none; }` as a fallback pair.
Without the pair, the HTML `hidden` attribute is overridden by the CSS `display` rule
and the container stays visible despite `hidden`.

Reference: MDN — "changing the value of the CSS `display` property on a hidden element
will override the `hidden` state."
(https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden)

Pairs currently enforced in `ntp/base.css`:

| Layout selector | Hidden fallback | Note |
|----------------|----------------|------|
| `.canvas { display: flex; … }` | `.canvas[hidden] { display: none; }` | `#canvas` is the large-box surface; defensive pair for any future code path that sets `canvasContainer.hidden = true` |
| `.inner  { display: flex; … }` | `.inner[hidden]  { display: none; }` | `#inner` is the inner (small-box) surface; initial `hidden` attribute on `<div id="inner" class="inner" hidden>` would otherwise be overridden |

Exceptions: a container that owns visibility purely through a class toggle (and whose
rules NEVER set `display` directly) does not need the `[hidden]` pair. When in doubt,
add the pair — it is a one-line, zero-cost invariant.

Checklist:

1. New CSS selector sets `display: flex|block|grid|inline-flex` on a container? → add `.selector[hidden] { display: none; }`.
2. Touching `.large-box` AND `.small-box`? → follow BX-CSS-DUAL-WRITE (the previous section) AND the hidden pair rule above.
3. Build-time check: `.github/scripts/build.mjs` (CSS source-concat / dual-write validator / strip-dist) will surface syntax errors; the `[hidden]` invariant is enforced by the Playwright regression test `boxing-canvas-hidden.spec.ts`.

## Related

- [ntp/ntp.css](../ntp/ntp.css) — the CSS file with all markers
- BX-145: the commit that introduced this convention after finding `.panning .small-box` was missing while `.panning .large-box` existed
- BX-DEV-020: hidden override pairing rule (see above)

## Accent Theme Tokens (ADR-0010)

Accent color tokens (--color-accent-300/500/600, --color-accent-dark-*) are **shared** across
large-box and small-box surfaces — they flow through Layer 2 semantic tokens (--color-accent,
--color-accent-ink) which both box types reference identically.

Therefore accent theme CSS is **not** subject to BX-CSS-DUAL-WRITE pairing. The 	hemeManager
in 
tp.js overrides Layer 1 primitives at runtime via document.documentElement.style.setProperty,
which automatically propagates to both surfaces through the token cascade. No CSS dual-write is needed
for accent-theme-related rules (.accent-presets, .accent-hue-slider, .accent-preset are
settings-panel-only selectors that affect neither .large-box nor .small-box).