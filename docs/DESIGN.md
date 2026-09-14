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

### Hairline 与控件边界的语义契约（revised 2026-09-14 · ticket 103 / A-057 / B67）

`--color-hairline` / `--color-hairline-strong` 的语义是**弱分隔线（decorative divider）**：
只负责在视觉上分组与收边，本身不承担任何可访问性义务。二者由 ink 基色经 rgba 派生
（亮色 `rgba(42,37,32,0.06)` / 暗色 `rgba(255,255,255,0.06)`），刻意贴近背景。

| 场景 | 能否用 `--color-hairline` | 依据 |
|---|---|---|
| 非交互元素的分隔线 / 收边（卡片内部分隔、栏头下划线、面板装饰描边） | 可以 | 纯装饰，无识别义务 |
| 交互控件上**附加**的描边，且该控件已有其他达标示能（如 `.btn`：填充 + 文字 `--color-ink` = 12.11:1 ≥ 4.5:1） | 可以 | SC 1.4.11 豁免：控件有文字 / 位置 / 上下文等区分指示时，边界不额外要求 3:1 |
| 交互控件的**唯一或主要示能边界**（透明填充 ghost 按钮、纯图标按钮、以虚线为唯一线索的输入与按钮） | **禁止** | 边界为唯一线索时必须 ≥ 3:1；hairline 亮色实测 1.11:1、暗色 1.20:1，远低于阈值 |

**控件边界的替代 token**：描边用 `--color-muted`（亮 `#7B7167` 对 `--color-elevated` = 3.81:1、
暗 `#9A9285` = 4.45:1），字形同步用 `--color-ink-soft`（亮 9.78:1、暗 7.73:1），使「边界 + 文字」双通道达标。
细线受抗锯齿侵蚀，实际渲染对比度低于声明值，故取 3.81:1 而非压线值（相对 3:1 约留 27% 余量）。

**已按此契约修正的实现**（本文档据此同步）：
- `.bm-add-row .bm-add-btn`（透明填充 ghost）：暗色由 ticket 88（A-042）、亮色由 ticket 102（A-056）
  统一改为 `--color-muted` 边界 + `--color-ink-soft` 字形；两主题使用同一 token 配对，不再漂移。
- 门禁：`scripts/contrast-guard.mjs`（ticket 102）从 CSS 源文件读取真实契约，任何改回 hairline 的提交立即非零退出。

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

> 注意（代码现实偏差 · 登记 N-103-01，本票不改）：`ntp/base.css` 中 `.large-box` / `.small-box` 的
> **default** 描边是 `1px solid var(--color-hairline)`（hover 才切 `--color-card-edge`、拖拽切 `--color-accent`），
> 与本表 default = `--color-card-edge` 不符；`border-radius` 代码为 `--radius-card`。该偏差早于本票且涉及
> 「容器边界是否承担示能」的产品判定，已具名登记，待专项票按代码现实校正（ADR-0008 Phase 4 同款对齐原则）。

### 2. Button (.btn)

| Property | Default | Hover | Active | Disabled |
|----------|---------|-------|--------|---------|
| background | `var(--color-elevated)` | `var(--color-surface)` | `var(--color-surface)` | `var(--color-canvas)` |
| color | `var(--color-ink)` | (same) | (same) | `var(--color-faint)` |
| border | 1px solid `var(--color-hairline)` | 1px solid `var(--color-card-edge)` | (same as hover) | 1px solid `var(--color-hairline)` |
| cursor | pointer | pointer | pointer | not-allowed |
| opacity | 1 | 1 | 0.9 | 0.5 |

> **hairline 适用性（ticket 103 / A-057）**：`.btn` 是**填充**按钮（背景 `--color-elevated`、
> 文字 `--color-ink` = 12.11:1 ≥ 4.5:1），命中 SC 1.4.11 的「控件已有其他区分指示」豁免，
> 因此 hairline 作为**附加**描边成立，本表保留。该豁免**不适用于**透明填充的 ghost 按钮 —— 见 §2b。

#### 2b. Ghost / 透明填充按钮（.bm-add-row .bm-add-btn）

透明填充时边框是**唯一**示能线索，3:1 义务成立，**禁止** `--color-hairline`。

| Property | Default | Hover | Focus-visible |
|---|---|---|---|
| background | transparent | `var(--color-accent-soft)` | (same as default) |
| border | 1px dashed `var(--color-muted)` | 1px solid `var(--color-accent-ink)` | 1px solid `var(--color-accent-ink)` |
| color | `var(--color-ink-soft)` | `var(--color-accent-ink)` | (same as default) |

实测（对 `--color-elevated`）：亮色边界 3.81:1 / 字形 9.78:1，暗色边界 4.45:1 / 字形 7.73:1。
契约由 `scripts/contrast-guard.mjs` 锁死（ticket 102）；暗色侧见 `ntp/settings.css` 的 ticket 88 注释，
亮色侧见 `ntp/base.css` 的 ticket 102 注释。

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

> 注意（代码现实偏差 · 登记 N-103-02，本票不改）：`ntp/settings.css` 的 `.zoom-btn` 为 `border: 0`
> （hover 仅改 background / color），本表「button border」的 hairline / accent 值与代码不符。
> 按 §Hairline 契约，透明填充的 `.zoom-btn` 即使有描边也**不得**用 `--color-hairline`；已具名登记，待专项票校正。

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
- **Divider 与 control boundary 分家**（ticket 103 / A-057 调研，2026-09-14）：ttoss 把 `border.divider`
  的契约写成 “purely structural; low emphasis”、`border.outline.control` 写成 “defines control boundary”；
  Carbon 用 `$border-subtle`（分隔）/ `$border-strong`（控件边界）并逐组件分列；Polaris 在 v11 迁移里
  把复合的 `--p-border-divider` 拆解废弃，只保留颜色 alias + Divider 组件。三者结论一致：**弱分隔线
  与控件边界必须是两个语义 token，且后者须按主题重算对比度**
  （Carbon issue #14597 即为 `$border-subtle` 在暗色下与背景同值、边界隐形的真实事故）。

## Related
- [ADR-0008](adr/0008-design-system-three-layer-tokens.md) — token architecture decision
- [css-dual-write-convention.md](css-dual-write-convention.md) — large-box/small-box CSS parity rule
- [CONTEXT.md](CONTEXT.md) — domain glossary (no CSS implementation details)
- AGENTS.md CSS development rules (BX-DEV series, see docs/history/boxing-changelog.md)

## Accent Theme System (ADR-0012)

Users can customize the overall color scheme via Settings → Appearance → Theme.
The system uses **curated theme packs** — designer-selected complete color palettes.
No free hue slider; users select from fixed, aesthetically coherent theme presets.
This supersedes ADR-0010 (hue slider + HSL derivation) which was replaced for simpler UX and guaranteed visual quality.

### Theme Packs

Five curated themes are defined as the static `THEME_PACKS` object in `ntp/persist.js` (L142):

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

`applyTheme(themeKey)` at `ntp/persist.js` L200 uses delta-diff (enterprise pattern):
1. Look up theme: `THEME_PACKS[themeKey] || THEME_PACKS.beige` (safe fallback)
2. For each warm tier, set `--color-warm-{tier}` and `--color-warm-dark-{tier}` only if changed
3. For accent tiers 300/500/600, set `--color-accent-{tier}` and `--color-accent-dark-{tier}` only if changed
4. Set `--accent-500-rgb` and `--accent-dark-500-rgb` triplet vars (for `rgba()` usage)
5. Layer 2 semantic tokens (`--color-accent`, `--color-accent-ink`) auto-update via `var()` references

### Storage

- `layout.settings.theme`: string key (`beige` | `graphite` | `coastal` | `forest` | `pure`), default `beige`
- Persisted via existing `saveLayoutDebounced()` → `chrome.storage.local`
- On init: `applyTheme(layout.settings.theme)` called if theme ≠ `beige` (`ntp/persist.js` `loadSettings()`)

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
