# ADR-0010: User-Customizable Accent Theme (Hue-Based Preset + Slider)

## Date
2026-08-10

## Status
Proposed — grill-confirmed, pending implementation.

## Context
ADR-0008 established a three-layer CSS token architecture (primitive → semantic → component) with
fixed warm-earth accent values hardcoded in design-system.css. Users cannot customize the accent color.
Grill-with-docs session (2026-08-10) confirmed the need for user-adjustable overall tone in settings.

PWM research (kimi_k26, web source) surveyed enterprise patterns from VS Code, Obsidian, Notion, Linear:
consensus is a hybrid approach — curated preset palettes + fine-tuning via a single hue control.
The project's vanilla JS single-file architecture (ntp.js, no bundler) and warm-neutral brand identity
constrain the solution to minimal, dependency-free implementation.

## Decisions (grill-confirmed Q1-Q10)

### Q1: Theme customization UI mode — (C) Hybrid: preset + hue slider
- 5 curated preset buttons (one-click switch) + 1 hue slider for fine-tuning.
- Presets store only a hue degree value; slider is a 0-360 range with rainbow gradient background.
- All derived from HSL math, no full palette JSON per theme.

### Q2: Preset storage model — (B) Hue-only presets
- Each preset is `{ name: '雾蓝', hue: 212 }` — a single number, not a full color ramp.
- JS generates `--color-accent-300/500/600` (light + dark) via HSL from the hue value.
- Neutral warm ramp (warm-50~900) unchanged across all themes — brand base stays consistent.

### Q3: HSL derivation parameters — (A) Fixed S/L per accent tier
- Light mode: accent-300 = hsl(h, 30%, 60%), accent-500 = hsl(h, 25%, 50%), accent-600 = hsl(h, 26%, 34%).
- Dark mode: separate S/L constants (see Q8).
- Low saturation (25-33%) preserves the brand's muted/matte aesthetic across all hues.

### Q4: Hue control UI — (A) Color hue slider only
- Single `<input type="range" min="0" max="360">` with rainbow gradient CSS background.
- No `<input type="color">` — avoids the hue-extraction mismatch problem.
- Slider shows current hue degree (e.g. `30°`) beside it.

### Q5: Preview strategy — (A) Real-time preview
- `setProperty` called on every `input` event during slider drag.
- Only 6 CSS variables change (accent-300/500/600 × light/dark) — negligible repaint cost.
- Matches existing darkMode toggle's instant-feedback behavior.

### Q6: Preset list — 6 presets (5 colored + 1 mono)
| Preset | Hue | Reference |
|--------|-----|-----------|
| 暖土 Warm Earth | 30 | Existing default |
| 雾蓝 Mist Blue | 212 | Vercel Geist / Apple System Blue |
| 墨绿 Ink Green | 142 | ui-ux-pro-max Forest Green |
| 暮紫 Dusk Plum | 267 | Obsidian accent |
| 砖红 Brick Red | 347 | ui-ux-pro-max Rose |
| 素白 Pure White | — | Codex App (mono: grayscale ramp) |

Pure White uses `special: 'mono'` flag → JS injects grayscale values instead of HSL derivation.

### Q7: Storage location — (A) layout.settings
- `layout.settings.accentHue: 30` (number, default = existing warm earth hue).
- `layout.settings.accentPreset: 'warm'` (string key, for preset button active state).
- Zero new storage logic — reuses existing load/save path.

### Q8: Dark mode accent derivation — (A) Two S/L parameter sets
- Light and dark each have their own S/L constants for accent-300/500/600.
- Dark mode uses higher L (more visible on dark background), same pattern as existing design-system.css.
- Dark accent-500 L corrected from 64% → 58% (Q10 decision, fixes existing 300==500 duplication bug).

### Q9: themeManager code location — (A) Inline in ntp.js
- ~80-line block within ntp.js settings region.
- Preset list constant + hslToHex function + applyAccent function + settings panel wiring.
- No new script files, no ES modules — matches existing single-file convention.

### Q10: Dark accent-500 L correction — (A) Fix L=64% → L=58%
- Current dark accent-300 and accent-500 are both #C4A882 (identical) — no visual hierarchy.
- Correct dark accent-500 to L=58%, creating a 3-tier progression: 300(64%) > 500(58%) > implied darker 600.
- Minimal change, no regression risk.

## Precise S/L Parameter Table (Implementation Spec)

### Accent S/L Constants
```javascript
const ACCENT_LIGHT = {
  300: { s: 30, l: 60 },
  500: { s: 25, l: 50 },
  600: { s: 26, l: 34 },
};

const ACCENT_DARK = {
  300: { s: 36, l: 64 },
  500: { s: 36, l: 58 },  // corrected from 64% (ADR-0010 Q10)
  600: { s: 45, l: 69 },
};
```

### HSL Derivation
```javascript
function hslToHex(h, s, l) {
  // Standard HSL → hex conversion
  // Returns e.g. hslToHex(30, 25, 50) → '#A08060'
}

function deriveAccentRamp(hue) {
  const isDark = document.getElementById('app').classList.contains('ntp--dark');
  const params = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  return {
    '300': hslToHex(hue, params[300].s, params[300].l),
    '500': hslToHex(hue, params[500].s, params[500].l),
    '600': hslToHex(hue, params[600].s, params[600].l),
  };
}

function applyAccent(hue) {
  // Special: mono preset uses grayscale, not HSL
  if (hue === null) {  // mono/pure-white
    setRootVar('--color-accent-300', '#888888');
    setRootVar('--color-accent-500', '#777777');
    setRootVar('--color-accent-600', '#555555');
    // Dark variants
    setRootVar('--color-accent-dark-300', '#AAAAAA');
    setRootVar('--color-accent-dark-500', '#AAAAAA');
    setRootVar('--color-accent-dark-600', '#CCCCCC');
    return;
  }
  const light = deriveAccentRamp(hue, false);
  const dark  = deriveAccentRamp(hue, true);
  setRootVar('--color-accent-300', light['300']);
  setRootVar('--color-accent-500', light['500']);
  setRootVar('--color-accent-600', light['600']);
  setRootVar('--color-accent-dark-300', dark['300']);
  setRootVar('--color-accent-dark-500', dark['500']);
  setRootVar('--color-accent-dark-600', dark['600']);
  // Also set RGB triplets for rgba-derived tokens
  setRgbTriplet('--accent-500-rgb', light['500']);
  setRgbTriplet('--accent-dark-500-rgb', dark['500']);
}
```

### RGB Triplet Helper
```javascript
function setRgbTriplet(varName, hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  document.documentElement.style.setProperty(varName, `${r}, ${g}, ${b}`);
}
```


### No-Override Default (Sentinel)
When `accentHue` is unset (undefined) or matches the default sentinel value, JS does NOT call
`setProperty` at all — CSS hardcoded values in design-system.css remain the source of truth.
This guarantees zero visual change for users who never touch the theme setting.
Only when the user explicitly selects a preset or drags the slider does JS inject overrides.

Default sentinel: `accentHue === undefined || accentHue === 0` (0 = "no preference / use CSS default").
Stored after user choice: actual hue value (30, 212, 142, 267, 347) or `null` (mono preset).

## Constraints Preserved
- ADR-0008 three-layer architecture: theme manager only modifies Layer 1 primitives (accent-300/500/600).
  Layer 2 semantic tokens (--color-accent, --color-accent-ink) recalculated automatically because they
  still reference Layer 1 values via `var()`.
- DESIGN.md: updated to document the accent derivation system and the 6 presets.
- css-dual-write-convention.md: unaffected — accent tokens are shared, not dual-write.
- BX-DEV-011: no npm dependencies — pure JS HSL math, no color library.
- Vanilla JS single-file: themeManager inline in ntp.js, no new script files.
- Dark mode: both ramp sets pre-computed and injected; switching darkMode doesn't re-call applyAccent
  (dark overrides are in CSS, not JS — the :root values become dark accent values via .ntp--dark override).
- i18n: preset names need i18n keys (accentPresetWarm, accentPresetMist, etc.).

## CSS Changes Required

### design-system.css
- Lines L33-35 (--color-accent-300/500/600): keep as-is (these are the default/fallback values).
  JS will override them at runtime via setProperty. CSS values are the "no-JS" fallback.
- Lines L51-53 (dark accent): same — fallback only. JS overrides at runtime.
- L36/L54 (RGB triplets): same — JS must also set these for rgba-derived tokens to work.
- No structural CSS changes — only JS runtime injection on top.

### settings.css (or ntp.css settings region)
- Add styles for: preset button row (6 buttons, 40x40px color swatches), hue slider
  (rainbow gradient track, 200px width), hue degree label.

## Phases

### Phase 1: themeManager core (ntp.js)
- Add ACCENT_LIGHT / ACCENT_DARK constants + hslToHex + deriveAccentRamp + applyAccent.
- Add setRgbTriplet helper.
- Wire applyAccent into init sequence (after darkMode apply, before first render).
- Load accentHue/accentPreset from layout.settings on init.

### Phase 2: Settings panel UI
- Add preset button row (6 swatches) + hue slider + degree label to settings HTML (in ntp.js DOM builder).
- Wire onChange: slider → applyAccent(hue) → saveDebounced; preset click → set hue + slider + applyAccent.
- Active preset highlight (border/ring on selected swatch).
- i18n keys for preset names.

### Phase 3: DESIGN.md + CONTEXT.md + css-dual-write-convention.md update
- DESIGN.md: add "Accent Theme System" section documenting presets, S/L table, derivation algorithm.
- CONTEXT.md: add glossary terms (AccentHue, AccentPreset, themeManager).
- css-dual-write-convention.md: note accent tokens are shared (not dual-write).
- AGENTS.md: add BX-DEV rule for accent token management.

### Phase 4: Test
- Playwright test: change accent hue → verify CSS var changes on DOM.
- Playwright test: preset click → verify layout.settings.accentHue persisted.
- Playwright test: mono preset → verify grayscale values injected.
- Playwright test: dark mode + custom hue → verify dark S/L applied.

## Anti-Regression
- Default hue (30°) must produce identical colors to current hardcoded values (byte-compare hslToHex(30,25,50) === '#A08060').
- Dark accent-500 correction (L=58%) changes one visual value — document in DESIGN.md.
- No-JS fallback: design-system.css still contains all hardcoded values; JS only overrides when user has a setting.
