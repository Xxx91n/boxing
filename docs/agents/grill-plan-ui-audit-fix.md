# Grill Plan: UI Audit Fix (Q1-Q4)

> Status: Completed (commit 08a5a1b + this maintenance commit)
> Created: 2026-08-15
> ADRs: [0014](adr/0014-cross-browser-scrollbar-standardization.md), [0015](adr/0015-chip-locate-highlight-unify.md)
> CONTEXT.md: UI Standardization Glossary section (appended)

---

## Decision Summary

| # | Problem | Decision | Phase |
|---|---------|----------|-------|
| Q1 | `clickToOpen` hint text regression on large boxes | B — Delete JS code + CSS rule + 14 locale i18n keys | 1 |
| Q2 | Scrollbar inconsistency (Firefox janky / Chrome ugly) | A (audited) — `scrollbar-width: thin` + `scrollbar-color` tokens, remove `contain: layout style paint` from `.settings-content`, NO `::-webkit-scrollbar` width, NO global `*` selector | 2 |
| Q3 | Chip click locate + highlight not landing | C (A+B) — rAF guard + outline highlight + unify pan formula | 3 |
| Q4 | Pin tooltip i18n semantic inverted | A — Swap JS mapping, fix HTML data-i18n-title, correct 14 locale messages to action-descriptive | 4 |

---

## Phase 1: Q1 — Delete `clickToOpen` Hint Regression

### Goal
The `"Click to open"` hint text on large box initial state was deleted in a prior round but regressed back. Delete it permanently — the large box initial state already has button-based empty state (from commit b885879). Only the stale hint text + CSS + i18n keys remain.

### Code Changes

**ntp/ntp.js L2584-2587** — Delete this block:
```js
const openHint = document.createElement('div');
openHint.className = 'large-box__open-hint';
openHint.textContent = i18n('clickToOpen');
body.appendChild(openHint);
```

**ntp/base.css L790** — Delete the `.large-box__open-hint` CSS rule.

**14 locale files** — Delete the `clickToOpen` key from each `messages.json`:
- `_locales/ar/messages.json`
- `_locales/de/messages.json`
- `_locales/en/messages.json`
- `_locales/es/messages.json`
- `_locales/fr/messages.json`
- `_locales/hi/messages.json`
- `_locales/ja/messages.json`
- `_locales/ko/messages.json`
- `_locales/pt_BR/messages.json`
- `_locales/ru/messages.json`
- `_locales/th/messages.json`
- `_locales/vi/messages.json`
- `_locales/zh_CN/messages.json`
- `_locales/zh_TW/messages.json`

### Acceptance Criteria
- [x] No `clickToOpen` string remains in ntp.js or any messages.json
- [x] No `.large-box__open-hint` CSS rule remains in base.css
- [x] Large box initial state shows button-based empty state (not hint text)
- [x] Playwright test: navigate to large box with no small boxes, verify no `clickToOpen` text in DOM
- [x] Build passes (`npm run build`)

---

## Phase 2: Q2 — Cross-Browser Scrollbar Standardization (ADR-0014)

### Goal
Firefox: thin overlay scrollbar but janky scrolling. Chrome: smooth scrolling but ugly classic scrollbar. Standardize to thin overlay scrollbar in both browsers with smooth scrolling.

### Code Changes

**ntp/settings.css L864** — Remove `contain: layout style paint` from `.settings-content` (root cause of Firefox jank per ADR-0014).

**ntp/settings.css L865** — Remove `will-change: scroll-position` (contributes to jank, not needed without contain).

**ntp/design-system.css** — Add scrollbar design tokens:
```css
--scrollbar-thumb: var(--warm-300, #c4b9a8);
--scrollbar-track: var(--warm-100, #f5f0e8);
```

**ntp/settings.css L856 area** — Add to `.settings-content`:
```css
scrollbar-width: thin;
scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
```

Apply `scrollbar-width: thin` + `scrollbar-color` to ALL scroll containers (not just `.settings-content`). Find all containers with `overflow-y: auto` or `overflow-y: scroll` and add the same rule.

**KEEP** `scrollbar-gutter: stable` on `.settings-content` (harmless on overlay, protective if Chrome falls back to classic).

**DO NOT** add `::-webkit-scrollbar` width/height — forces Chrome into classic mode.
**DO NOT** use global `*` selector — apply only to scroll containers.

### Acceptance Criteria
- [x] Firefox: thin scrollbar, smooth scrolling (no jank)
- [x] Chrome: thin overlay scrollbar (not classic wide)
- [x] No `contain: layout style paint` on `.settings-content`
- [x] `will-change: scroll-position` RETAINED on `.settings-content` (GPU layer promotion for FF smooth-scroll; ADR-0014 v2 confirms safe without `contain`)
- [x] `scrollbar-gutter: stable` retained
- [x] Playwright Firefox test: scroll settings panel, verify smooth
- [x] Playwright Chrome test: verify thin scrollbar rendered
- [x] Build passes

---

## Phase 3: Q3 — Chip Locate + Highlight Unify (ADR-0015)

### Goal
Clicking a small box chip on a collapsed large box should pan the inner canvas to center the target small box and flash a highlight ring — same mental model as search hit navigation. Currently: pan formula diverges, highlight clipped by `contain: layout`.

### Code Changes

**ntp/ntp.js L4322 area** — `enterAndLocateSmallBox`:
1. Wrap the locate + highlight logic in `requestAnimationFrame` to ensure DOM and `innerZoom` are settled after `enterLargeBox` before computing pan offsets.
2. Unify pan formula to match `openSearchHit` (L4282): center-align with clamp bounds.

**ntp/base.css L747-756** — Replace `box-shadow` animation with `outline` + `outline-offset`:
```css
.small-box--located {
  animation: locate-pulse 2s ease-out;
  outline: 2px solid var(--color-accent-500);
  outline-offset: 2px;
}

@keyframes locate-pulse {
  0% { outline-width: 0; outline-offset: 0; }
  50% { outline-width: 4px; outline-offset: 4px; }
  100% { outline-width: 0; outline-offset: 0; }
}
```
`outline` is NOT clipped by `contain: layout` (draws outside border box without affecting layout).

### Acceptance Criteria
- [x] Clicking a chip pans inner canvas to center the target small box
- [x] Highlight ring (outline pulse) is visible despite `contain: layout style` on `.small-box`
- [x] Pan formula matches `openSearchHit` (center-align + clamp)
- [x] rAF guard ensures innerZoom is settled before pan calculation
- [x] Playwright test: click chip, verify canvas pan + visible highlight ring
- [x] Build passes

---

## Phase 4: Q4 — Pin Tooltip i18n Semantic Fix

### Goal
The pin/unpin button tooltip shows inverted semantics. When pinned, tooltip should say action (Unpin header), not state (Pin header). All 14 locale `headerPinOff` messages must be action-descriptive, not state-descriptive.

### Code Changes

**ntp/ntp.js L2309** — Swap mapping:
```js
// BEFORE (inverted):
headerPinBtn.title = headerPinned ? i18n('headerPin') : i18n('headerPinOff');
// AFTER (correct — action semantic):
headerPinBtn.title = headerPinned ? i18n('headerPinOff') : i18n('headerPin');
```

**ntp/index.html L49** — Change `data-i18n-title="headerPinOff"` to `data-i18n-title="headerPin"` (the HTML attribute represents the button function name, not the dynamic tooltip state).

**14 locale files** — Update `headerPinOff` message from state-descriptive to action-descriptive:

| Locale | Before (state) | After (action) |
|--------|---------------|----------------|
| en | Header unpinned | Unpin header |
| zh_CN | 已取消固定顶栏 | 取消固定顶栏 |
| zh_TW | 已取消固定頂欄 | 取消固定頂欄 |
| ja | ヘッダーの固定を解除しました | ヘッダーの固定を解除 |
| ko | 헤더 고정 해제됨 | 헤더 고정 해제 |
| es | Encabezado des fijado | Desfijar encabezado |
| fr | En-tete desepingle | Desepingler l'en-tete |
| de | Kopfzeile fixiert aufgehoben | Kopfzeile losen |
| ru | Закрепление заголовка снято | Открепить заголовок |
| pt_BR | Cabecalho desafixado | Desafixar cabecalho |
| ar | تم إلغاء تثبيت الرأس | إلغاء تثبيت الرأس |
| hi | हेडर अनपिन किया गया | हेडर अनपिन करें |
| th | ยกเลิกการปักหมุดส่วนหัวแล้ว | ยกเลิกการปักหมุดส่วนหัว |
| vi | Đa bo ghir tieu de | Bo ghir tieu de |

### Acceptance Criteria
- [x] JS L2309 swapped to `headerPinned ? i18n('headerPinOff') : i18n('headerPin')`
- [x] HTML L49 data-i18n-title changed to `headerPin`
- [x] All 14 locale `headerPinOff` messages are action-descriptive
- [x] When pinned (default), tooltip shows action text (Unpin header / Cancel pin)
- [x] When unpinned, tooltip shows action text (Pin header)
- [x] Playwright test: hover pin button in pinned state, verify tooltip = action text
- [x] Build passes

---

## Post-Implementation

1. `npm run build` — rebuild ntp.css from source files
2. Playwright regression tests (Chrome + Firefox) for all 4 phases
3. `codegraph` CLI sync index
4. Git commit with conventional commit message
5. Update CONTEXT.md with UI Standardization Glossary section (3 new domain terms)

### CONTEXT.md UI Standardization Glossary (to append)

```markdown
## UI Standardization Glossary (ADR-0014, ADR-0015)
- **scrollbar-width: thin** (ADR-0014) — Standard CSS Scrollbars Styling Module Level 1 property applied to all scroll containers. Baseline available Dec 2024 (Chrome 121+, Firefox 64+). Replaces browser-default classic scrollbars with thin overlay style. Combined with `scrollbar-color` using design tokens (`--scrollbar-thumb` / `--scrollbar-track`). NEVER set `::-webkit-scrollbar` width — forces Chrome into classic mode. NEVER use global `*` selector.
- **Pin tooltip action semantic** (ADR-0015) — Pin/unpin button tooltip shows the AVAILABLE action, not current state: pinned -> `headerPinOff` (Unpin header), unpinned -> `headerPin` (Pin header). All `headerPinOff` locale messages must be action-descriptive, not state-descriptive.
- **enterAndLocateSmallBox** (ADR-0015) — Function that pans inner canvas to center a target small box and flashes an outline pulse highlight. Unified mental model with `openSearchHit`: same center-align + clamp pan formula, same highlight ring. Uses `outline` + `outline-offset` (not `box-shadow`) to escape `contain: layout style` clipping on `.small-box`. Wrapped in `requestAnimationFrame` to ensure `innerZoom` settled after `enterLargeBox`.
```

---

---

## Implementation Notes (post-commit 08a5a1b)

### Actual Implementation Deviations from Plan

**Phase 2 (Q2) — will-change: scroll-position RETAINED:**
The original plan called for removing will-change: scroll-position from .settings-content. However, ADR-0014 v2 discovered the real root cause was contain: layout style paint (layout containment interfering with FF smooth-scroll engine), NOT will-change. After removing contain, will-change: scroll-position actually HELPS by promoting the scroll container to a GPU compositor layer. The acceptance criterion was updated accordingly.

**Phase 2 (Q2) — .modal__body overflow:hidden (nested scroll fix):**
Additional fix not in original plan: .modal__body changed from overflow-y: auto to overflow: hidden to eliminate a nested scroll container that caused double-animation jank in Firefox with smooth-scroll enabled.

**Phase 2 (Q2) — overflow-anchor: none added:**
Additional CSS property not in original plan: .settings-content gains overflow-anchor: none to prevent Firefox auto-scroll jitter when DOM mutates above the fold.

### Post-Implementation Cleanup (this commit)

- Removed duplicate I18N_FALLBACK line in ntp.js (L284 was a stale 4-space-indented duplicate of L285)
- Removed stale i18n keys from I18N_FALLBACK: dblclickHint, clickPlusHint, headerPinOffState, headerPinOn
- Removed stale i18n keys from all 14 locale files: emptyLargeHint, dblclickHint, clickPlusHint, headerPinOffState, headerPinOn (70 entries total)
- Updated ADR-0014: Status to Implemented, corrected will-change narrative

## Execution Order

1. Phase 1 (Q1) — Delete hint text + CSS + i18n keys
2. Phase 2 (Q2) — Scrollbar standardization
3. Phase 3 (Q3) — Chip locate + highlight unify
4. Phase 4 (Q4) — Pin tooltip i18n fix
5. Build + Test + CONTEXT.md update + Commit
