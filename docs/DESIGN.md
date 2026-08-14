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
| `--ease-hover` | cubic-bezier(0.34, 1.56, 0.64, 1) | Hover: subtle bounce-back |
| `--dur-fast` | 140ms | Hover, focus |
| `--dur-base` | 220ms | Modal, panel |
| `--dur-slow` | 360ms | Header auto-hide, large layout |

#### Entry Choreography (@keyframes)
| Name | Duration | Usage |
|------|----------|-------|
| `fadeInUp` | 0.3s | Modal/panel entrance |
| `scaleIn` | 0.2s | Popover entrance |
| `fadeIn` | 0.3s | Empty state entrance |
| `slideDown` | 0.3s | Dropdown/list entrance |

#### Reduced Motion
`prefers-reduced-motion: reduce` globally sets all `transition-duration` and `animation-duration` to `0.01ms` (WCAG 2.2 compliance). See `design-system.css` L178.

### Shadows
5-level elevation gradient (ADR-0008 Phase: Shadow-B). Light mode uses `--warm-900-rgb` for warm shadows; dark mode uses pure black with calibrated opacity.
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--shadow-xs` | warm-900 5% | black 20% | Subtle elevation |
| `--shadow-sm` | warm-900 6% | black 24% | Hairline separation |
| `--shadow-md` | warm-900 8% | black 30% | Cards, buttons |
| `--shadow-lg` | warm-900 10% | black 36% | Modals, popovers |
| `--shadow-xl` | warm-900 14% | black 44% | Floating panels |

**Aliased for backward compat:** `--shadow-1` = `--shadow-xs`, `--shadow-2` = `--shadow-md`, `--shadow-pop` = `--shadow-lg`.

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

## Accent Theme System (ADR-0012)

Users can customize the overall color scheme via Settings → Appearance → Theme.
The system uses **curated theme packs** — designer-selected complete color palettes.
No free hue slider; users select from fixed, aesthetically coherent theme presets.
This supersedes ADR-0010 (hue slider + HSL derivation) which was replaced for simpler UX and guaranteed visual quality.

### Theme Packs

Five curated themes are defined as the static `THEME_PACKS` object in `ntp/ntp.js` (L949):

| Key | i18n Label | Light Bg Character | Light Accent |
|---|---|---|---|
| `beige` (default) | themeBeige | Warm cream/beige | Terracotta brown |
| `graphite` | themeGraphite | Cool gray | Monochrome gray |
| `coastal` | themeCoastal | Cool blue-gray | Slate teal |
| `forest` | themeForest | Warm green-gray | Sage green |
| `pure` | themePure | Neutral white-gray | Medium gray |

Each theme stores a **complete** color ramp:
- `light.warm` — 9-tier background ramp (50 through 900)
- `light.accent` — 3-tier accent ramp (300/500/600)
- `dark.warm` — 9-tier dark-mode background ramp
- `dark.accent` — 3-tier dark-mode accent ramp

### Runtime Application (`applyTheme`)

`applyTheme(themeKey)` at `ntp/ntp.js` L1014 uses delta-diff (enterprise pattern):
1. Look up theme: `THEME_PACKS[themeKey] || THEME_PACKS.beige` (safe fallback)
2. For each warm tier, set `--color-warm-{tier}` and `--color-warm-dark-{tier}` only if changed
3. For accent tiers 300/500/600, set `--color-accent-{tier}` and `--color-accent-dark-{tier}` only if changed
4. Set `--accent-500-rgb` and `--accent-dark-500-rgb` triplet vars (for `rgba()` usage)
5. Layer 2 semantic tokens (`--color-accent`, `--color-accent-ink`) auto-update via `var()` references

### Storage

- `layout.settings.theme`: string key (`beige` | `graphite` | `coastal` | `forest` | `pure`), default `beige`
- Persisted via existing `saveLayoutDebounced()` → `chrome.storage.local`
- On init: `applyTheme(layout.settings.theme)` called if theme ≠ `beige` (L1116-1117)

### CSS Class

- Settings UI uses `.theme-preset` class (see `settings.css`) for theme swatch buttons
- Each swatch shows a 2-color gradient preview of the theme's bg + accent

### Dark Mode

Dark mode is handled by the `darkMode` boolean setting which triggers `applyTheme()` to
switch from light to dark warm/accent ramps. The `--color-warm-dark-*` and `--color-accent-dark-*`
CSS variables are always set regardless of current mode, so toggling is instantaneous.

### Related

- [ADR-0008](adr/0008-design-system-three-layer-tokens.md) — token architecture decision
- [css-dual-write-convention.md](css-dual-write-convention.md) — large-box/small-box CSS parity rule
- [CONTEXT.md](CONTEXT.md) — domain glossary (no CSS implementation details)
- AGENTS.md BX-DEV-013/014/135 — CSS development rules
