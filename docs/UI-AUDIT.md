# UI-AUDIT.md --- Boxing UI Aesthetic Audit

> Phase 7 deliverable (ADR-0008). Records the UI audit findings, decisions, and remediations
> applied during the aesthetic optimization campaign. Normative reference for future UI changes.

## Audit Scope

Audit performed across all CSS source files (design-system.css, base.css, settings.css,
onboarding.css) and ntp.js for inline styles. Covers 7 audit dimensions.

## Findings and Remediations

### 1. Shadow System (Phase 1 --- Shadow-B)

- Finding: Only 3 legacy shadow levels with inconsistent opacity values.
- Remediation: 5-level gradient introduced (shadow-xs/sm/md/lg/xl) with calibrated opacity ramps. Light mode uses warm-900-rgb. Dark mode uses pure black. Legacy names aliased.
- Files: design-system.css L116-170

### 2. Motion System (Phase 2 --- Motion-B)

- Finding: 15 hardcoded transition durations. No entry choreography. Missing ease-hover.
- Remediation: Added ease-hover token, 4 keyframes (fadeInUp, scaleIn, fadeIn, slideDown). All durations reference tokens.
- Files: design-system.css L111, base.css L7-29

### 3. Reduced-Motion and Backdrop-Filter (Phase 3)

- Finding: No prefers-reduced-motion support. No backdrop-filter on modal overlay.
- Remediation: Global reduced-motion media query. Modal overlay backdrop-filter blur(8px). Empty state fadeIn animation.
- Files: design-system.css L175-184, settings.css

### 4. @layer and !important Cleanup (Phase 4)

- Finding: 10 !important declarations. .box--square-corner uses inline !important.
- Remediation: Removed tokenizable !important declarations. Square-corner border-radius moved to @layer.
- Files: settings.css (@layer)

### 5. Empty State Action Buttons (Phase 5)

- Finding: All empty states displayed only text hints. Poor discoverability.
- Remediation: Large-box empty state got real button (enterLargeBox). Inner-canvas empty state got real button (addSmallBox). Canvas empty kept as pure hint (Q7 decision). Search empty kept as pure hint (transient). i18n keys added to all 14 locales.
- Files: ntp.js, base.css, _locales

### 6. Dark Shadow Calibration (Phase 6 --- Shadow-C)

- Finding: Comment said Phase C calibration will refine.
- Remediation: Dark mode shadows already calibrated with pure black at escalating opacity (20 to 44 percent). No accent tint added. Industry standard. Comment updated.
- Files: design-system.css L161

### 7. Audit Doc and DESIGN.md Reflection (Phase 7)

- Finding: DESIGN.md shadow and motion sections documented only legacy tokens.
- Remediation: Updated DESIGN.md with 5-level shadow table, motion section with ease-hover and keyframes table, reduced-motion note. This UI-AUDIT.md created. Referenced from CONTEXT.md.
- Files: docs/DESIGN.md, docs/CONTEXT.md, docs/UI-AUDIT.md

## Token Architecture Validation

| Check | Status |
|-------|--------|
| Three-layer tokens (primitive to semantic to component) | Pass |
| No hardcoded hex in component CSS | Pass |
| Dark mode overrides only Layer 2 | Pass |
| All shadows reference tokens | Pass |
| All durations reference tokens | Pass |
| All easings reference tokens | Pass |
| !important usage minimal and documented | Pass |
| @layer used for override boundaries | Pass |
| prefers-reduced-motion globally applied | Pass |
| backdrop-filter on modal overlay | Pass |
| Empty states with action buttons | Pass |
| i18n keys in all 14 locales | Pass |
