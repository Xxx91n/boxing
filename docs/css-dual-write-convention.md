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
| `BX-DUAL-WRITE` | Paired rule — large-box and small-box share the same property | Changing one side **requires** changing the other side in the same commit |
| `BX-DUAL-WRITE-SHARED` | Both selectors already in one rule (comma-separated) | Safe — no duplication needed; just edit the shared rule |
| `LARGE-ONLY` | Large-box design difference (no small-box counterpart) | No mirroring needed; document why large-box is unique |
| `SMALL-ONLY` | Small-box design difference (no large-box counterpart) | No mirroring needed; document why small-box is unique |

## Marked Rules (as of BX-145)

### BX-DUAL-WRITE (paired — editing one requires editing the other)

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

### BX-DUAL-WRITE-SHARED (comma-separated — both selectors in one rule)

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

1. Does the same property apply to both surfaces? → Add the rule to **both** selectors and mark with `/* BX-DUAL-WRITE */`.
2. Is it a comma-separated shared rule? → Put both selectors in one rule and mark with `/* BX-DUAL-WRITE-SHARED */`.
3. Is it surface-specific (e.g. only large-box has `__icon`)? → Mark with `/* LARGE-ONLY */` or `/* SMALL-ONLY */` and document the reason.
4. **If you skip the marker, the code review will block the commit.**

## Related

- [ntp/ntp.css](../ntp/ntp.css) — the CSS file with all markers
- [docs/design-box-connections.md](design-box-connections.md) — connection line system architecture
- BX-145: the commit that introduced this convention after finding `.panning .small-box` was missing while `.panning .large-box` existed
