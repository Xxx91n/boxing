# ADR-0012: Curated Theme Pack System (Supersedes ADR-0010)

## Date
2026-08-10

## Status
Accepted — implemented. Supersedes ADR-0010.

## Context
ADR-0010 implemented a free hue slider (0-360) + preset buttons for accent color customization. User feedback: the free slider allowed ugly color combinations, and the hue-only approach meant background and accent were coupled to the same hue. Designer control was insufficient.

The project needed a more Linear/Notion-like approach: curated themes where a designer selects complete color ramps (background + accent) per theme, and users pick from a small set of well-designed options.

## Decision
Replace the free hue slider + HSL derivation system (ADR-0010) with 5 curated theme packs:

| Theme | Key | Description |
|-------|-----|-------------|
| Beige | beige | Default warm earth (current design-system.css values) |
| Graphite | graphite | Cool neutral gray |
| Coastal | coastal | Muted blue-green |
| Forest | forest | Deep green |
| Pure White | pure | Codex-like clean grayscale |

Each theme stores complete color ramps:
- Warm bg ramp: 9 tiers (50, 100, 150, 200, 300, 700, 800, 850, 900) for light + dark.
- Accent ramp: 3 tiers (300, 500, 600) for light + dark.

### Key changes from ADR-0010:
- Deleted: ACCENT_SL, BG_SL, DEFAULT_BG_HUE, hslToHex, applyBgHue, applyAccent, hue slider, accent preset buttons.
- Added: THEME_PACKS (5 themes), applyTheme(themeKey).
- Storage: layout.settings.theme (string key, default 'beige') replaces accentHue + accentPreset.
- HTML: 5 theme-preset buttons replace 6 accent-preset buttons + hue slider.
- CSS: .theme-preset replaces .accent-preset + .accent-hue-slider.
- i18n: themeColorLabel/themeColorHint replace accentColorLabel/accentColorHint in 14 locales.

### Migration
migrateLayout maps old accentHue/accentPreset fields to theme: 'beige' (default). Old accentHue values are not preserved (the old HSL-derived colors were deemed too unpredictable).

## Consequences
- Users can only pick from 5 designer-curated themes — no ugly combinations.
- Adding a new theme = adding one entry to THEME_PACKS (no code changes needed).
- Background and accent are coupled per-theme (designed together, not independently varied).
- THEME_PACKS is ~70 lines of static data — no runtime computation, no HSL math.
- Default 'beige' theme matches existing design-system.css hardcoded values exactly (zero visual change for existing users).
