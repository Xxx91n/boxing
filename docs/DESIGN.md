# DESIGN.md — Boxing Visual Design System

> Source of truth for CSS token architecture, color palette, typography, component state specs,
> and dark mode strategy. Maintained alongside ADRs under docs/adr/.
> Reference: ADR-0008 (token architecture), docs/css-dual-write-convention.md (dual-write rules).

## Token Architecture (ADR-0008)

Boxing uses a three-layer CSS custom property system:

```
Layer 1: Primitive (raw values — --color-warm-50..900, --color-accent-300..600)
    ↓
Layer 2: Semantic (purpose aliases — --color-canvas, --color-ink, --color-accent)
    ↓
Layer 3: Component (component-specific — defined per-component below, applied in ntp.css)
```

- **Layer 1** lives in `design-system.css :root`. Never reference primitive values directly in
  component CSS — always go through Layer 2 semantic tokens.
- **Layer 2** lives in `design-system.css :root` (light mode) and `.ntp--dark` (dark mode overrides).
  Components reference only Layer 2.
- **Layer 3** is applied in `ntp.css` (or its split source files after ADR-0008 Phase 2). Each
  component may override a semantic token for its specific surface (e.g. `--button-bg: var(--color-accent)`).

### Color Palette

#### Warm Neutral Ramp (Light)
| Primitive | Hex | Semantic mapping |
|-----------|-----|------------------|
| `--color-warm-50` | #F1EEE8 | canvas |
| `--color-warm-100` | #EEE9E1 | surface |
| `--color-warm-150` | #EBE5DB | elevated |
| `--color-warm-200` | #E0D8CB | card-edge |
| `--color-warm-300` | #ECE8E0 | canvas-2 |
| `--color-warm-700` | #A89F92 | faint |
| `--color-warm-800` | #7B7167 | muted |
| `--color-warm-850` | #3B342C | ink-soft |
| `--color-warm-900` | #2A2520 | ink |

#### Accent Ramp (Light)
| Primitive | Hex | Semantic mapping |
|-----------|-----|------------------|
| `--color-accent-300` | #B89878 | focus |
| `--color-accent-500` | #A08060 | accent |
| `--color-accent-600` | #6E5540 | accent-ink |

#### Dark Mode Ramps
Same ramp structure (`--color-warm-dark-*`, `--color-accent-dark-*`) with inverted lightness.
Dark mode overrides only Layer 2 semantic tokens to reference dark primitives — component CSS unchanged.

### Typography
| Token | Stack | Usage |
|-------|-------|-------|
| `--font-display` | Fraunces, Source Serif Pro, Songti SC, serif | Titles, hero text |
| `--font-stack-ui` | system-ui, -apple-system, Segoe UI, PingFang SC, sans-serif | All UI text |
| `--font-stack-mono` | JetBrains Mono, ui-monospace, SFMono-Regular, monospace | Code/URL display |
| `--font-size-base` | 14px (adjustable via settings) | Base size |

**Font smoothing** (set on `html, body` in ntp.css):
`-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; font-feature-settings: "kern" 1, "liga" 1, "calt" 1; font-synthesis: weight style;`
(BX-DEV-135 — root cause of Firefox font blur was ntp.css overwriting design-system.css font features)

### Spacing Scale
`--space-1` (4px) through `--space-16` (64px). Linear progression: 4/8/12/16/20/24/32/40/48/64.

### Radii
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-card` | 18px | Cards, modals, search results |
| `--radius-tile` | 12px | Boxes, tiles |
| `--radius-pill` | 999px | Toggle pills, tags |

### Motion
| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | Most transitions (smooth decel) |
| `--ease-default` | cubic-bezier(0.4, 0, 0.2, 1) | State toggles |
| `--dur-fast` | 140ms | Hover, focus |
| `--dur-base` | 220ms | Modal, panel |
| `--dur-slow` | 360ms | Header auto-hide, large layout |

### Shadows
Derived from `--warm-900-rgb` in light mode, black in dark mode.
| Token | Usage |
|-------|-------|
| `--shadow-1` | Subtle elevation (flat surfaces) |
| `--shadow-2` | Cards, hover elevation |
| `--shadow-pop` | Modals, popovers |

## Component State Specifications

Each component defines four states with token references. These are normative — `ntp.css` must
implement these exact mappings.

### 1. Box (.large-box / .small-box — BX-DUAL-WRITE)

| Property | Default | Hover | Active (dragging) | Disabled |
|----------|---------|-------|--------------------|---------|
| background | `var(--color-elevated)` | (same) | (same) | `var(--color-surface)` |
| border-color | `var(--color-card-edge)` | `var(--color-card-edge)` | `var(--color-card-edge)` | `var(--color-hairline)` |
| box-shadow | `var(--shadow-1)` | `var(--shadow-2)` | `var(--shadow-2)` | none |
| cursor | default | default | grabbing | not-allowed |
| z-index | 1 | 2 | 5 | 0 |
| border-radius | `var(--radius-tile)` | (same) | (same, no regression BX-145) | (same) |

### 2. Button (.btn)

| Property | Default | Hover | Active | Disabled |
|----------|---------|-------|--------|---------|
| background | `var(--color-elevated)` | `var(--color-surface)` | `var(--color-surface)` | `var(--color-canvas)` |
| color | `var(--color-ink)` | `var(--color-card-edge)` | `var(--color-card-edge)` | `var(--color-faint)` |
| border | 1px solid `var(--color-hairline)` | 1px solid `var(--color-card-edge)` | 1px solid `var(--color-card-edge)` | 1px solid `var(--color-hairline)` |
| cursor | pointer | pointer | pointer | not-allowed |
| opacity | 1 | 1 | 0.9 | 0.5 |

### 3. Search (.search)

| Property | Default | Focus-within | (no hover state) | (no disabled) |
|----------|---------|--------------|------------------|---------------|
| background | `var(--color-elevated)` | (same) | — | — |
| border | 1px solid `var(--color-hairline)` | 1px solid `var(--color-accent)` | — | — |
| box-shadow | none | `0 0 0 3px var(--color-accent-soft)` | — | — |

### 4. Search Results (.search-results)

| Property | Default | Item hover | (no active) | (no disabled) |
|----------|---------|------------|-------------|---------------|
| background | `var(--color-elevated)` | (same) | — | — |
| border | 1px solid `var(--color-hairline)` | (same) | — | — |
| item bg | transparent | `var(--color-surface)` | — | — |
| box-shadow | `var(--shadow-2)` | (same) | — | — |

### 5. Modal (.modal)

| Property | Default | (no hover) | Active (open) | (no disabled) |
|----------|---------|------------|---------------|---------------|
| background | `var(--color-canvas)` | — | (same) | — |
| border | 1px solid `var(--color-card-edge)` | — | (same) | — |
| box-shadow | `var(--shadow-pop)` | — | (same) | — |
| z-index | 100 | — | 100 | — |

### 6. Zoom Controls (.zoom-controls)

| Property | Default | Button hover | Active (pressing) | (no disabled) |
|----------|---------|-------------|-------------------|---------------|
| background | `var(--color-elevated)` | — | — | — |
| button bg | transparent | `var(--color-surface)` | `var(--color-surface)` | — |
| button color | `var(--color-muted)` | `var(--color-ink)` | `var(--color-ink)` | — |
| button border | 1px solid `var(--color-hairline)` | 1px solid `var(--color-accent)` | 1px solid `var(--color-accent)` | — |

### 7. Bookmark Row (.bm-row)

| Property | Default | Hover | Active | (no disabled) |
|----------|---------|-------|--------|---------------|
| background | transparent | `var(--color-surface)` | `var(--color-surface)` | — |
| cursor | default | pointer | pointer | — |

### 8. Crumbs (.crumbs__item)

| Property | Default | Hover | Current (--active) | (no disabled) |
|----------|---------|-------|--------------------|---------------|
| background | transparent | `var(--color-surface)` | (same) | — |

### 9. Onboarding (.onboarding__step)

| Property | Default | (no hover) | Active (current step) | (no disabled) |
|----------|---------|------------|----------------------|---------------|
| icon color | `var(--color-accent)` | — | `var(--color-accent-ink)` | — |
| title color | `var(--color-ink)` | — | `var(--color-ink)` | — |

### 10. Checkbox (.checkbox-label)

| Property | Default | Hover | Checked | Disabled |
|----------|---------|-------|---------|---------|
| border | 2px solid `var(--color-card-edge)` | 2px solid `var(--color-accent)` | 2px solid `var(--color-accent)` | 2px solid `var(--color-hairline)` |
| checkmark color | — | — | `var(--color-accent-ink)` | `var(--color-faint)` |
| label color | `var(--color-ink)` | (same) | (same) | `var(--color-faint)` |

## Dark Mode Strategy

Dark mode works by overriding Layer 2 semantic tokens in `.ntp--dark`:
- Light mode: `--color-canvas: var(--color-warm-50)` → #F1EEE8
- Dark mode: `--color-canvas: var(--color-warm-dark-50)` → #1E1C1A

Component CSS (`ntp.css`) references `var(--color-canvas)` and automatically gets the right value.
After ADR-0008 Phase 3, the ~100 redundant `.ntp--dark .xxx` per-component overrides in ntp.css
are deleted. Only ~5 structural exceptions remain (opacity, layout), marked with
`/* DARK-EXCEPTION: <reason> */`.

## Industry Benchmark

Based on PWM research (W3C DTCG spec 2025.10, Vercel Geist, Linear, Stripe, Apple HIG):
- **Three-layer tokens** — matches W3C DTCG + Linear + Stripe pattern
- **System-ui font stack** — matches Vercel Geist philosophy (legible, geometric, native)
- **Warm earth accent** — distinct from Linear's blue or Stripe's purple; matches Boxing's
  beige minimalist identity
- **Dark mode via token override** — industry standard; per-component overrides are an anti-pattern

## Related
- [ADR-0008](adr/0008-design-system-three-layer-tokens.md) — token architecture decision
- [css-dual-write-convention.md](css-dual-write-convention.md) — large-box/small-box CSS parity rule
- [CONTEXT.md](CONTEXT.md) — domain glossary (no CSS implementation details)
- AGENTS.md BX-DEV-013/014/135 — CSS development rules

## Accent Theme System (ADR-0010)

Users can customize the overall color tone via Settings → Appearance → Accent Color.
The system uses a hybrid approach: 6 curated presets + a hue slider for fine-tuning.

### Presets

| Preset | hue | Mode | Reference |
|--------|-----|------|-----------|
| 暖土 Warm Earth | 30° | HSL | Existing default |
| 雾蓝 Mist Blue | 212° | HSL | Vercel Geist / Apple blue |
| 墨绿 Ink Green | 142° | HSL | Forest green |
| 暮紫 Dusk Plum | 267° | HSL | Obsidian accent |
| 砖红 Brick Red | 347° | HSL | Rose |
| 素白 Pure White | null | mono | Codex App (grayscale) |

### HSL Derivation Constants

**Light mode:**
| Token | S | L | Example (hue=30) |
|-------|---|---|-------------------|
| accent-300 | 29% | 60% | #B89878 |
| accent-500 | 25% | 50% | #A08060 |
| accent-600 | 27% | 34% | #6E5540 |

**Dark mode:**
| Token | S | L | Example (hue=30) |
|-------|---|---|-------------------|
| accent-dark-300 | 30% | 64% | #C4A882 |
| accent-dark-500 | 30% | 58% | #BEA075 (corrected from 64%) |
| accent-dark-600 | 33% | 69% | #D4B88C |

### Runtime Override Flow

1. On init: read layout.settings.accentHue (default 30).
2. If null → inject grayscale mono ramp.
3. Else → hslToHex(hue, s, l) for each of the 6 tokens (3 light + 3 dark).
4. document.documentElement.style.setProperty('--color-accent-300', hex) etc.
5. Also update --accent-500-rgb and --accent-dark-500-rgb triplet vars for rgba-derived tokens.
6. Layer 2 semantic tokens (--color-accent, --color-accent-ink) auto-update because they reference Layer 1 via ar().
7. On slider drag: repeat steps 3-6 with real-time preview (only 6 vars change, negligible repaint).
8. On preset click: set hue, update slider position, repeat steps 3-6, highlight active preset.

### Storage

- layout.settings.accentHue: integer 0-360 (default 30) or null (mono preset).
- layout.settings.accentPreset: string key for UI highlight state (e.g. 'warm', 'pure').
- Persisted via existing saveLayoutDebounced() → chrome.storage.local.

### No-JS Fallback

design-system.css still contains hardcoded accent values (the warm-earth defaults).
If JS fails to load or no user preference is stored, the extension renders with the default palette.
JS setProperty overrides are additive — they shadow the CSS values, never delete them.

### Dark Accent-500 Correction (ADR-0010 Q10)

Previous: dark accent-300 and accent-500 were both #C4A882 (identical — no visual hierarchy).
Fixed: dark accent-500 L adjusted from 64% → 58%, creating 3-tier progression: 300(64%) > 500(58%) > 600(69%).