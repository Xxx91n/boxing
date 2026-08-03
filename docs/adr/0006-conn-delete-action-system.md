# ADR-0006: Configurable Connection Delete Action System

**Date**: 2026-08-04
**Status**: Accepted
**Supersedes**: BX-EXPLORE-008 (hardcoded Alt+Click delete)

## Context

The connection line system (ADR-0004) started with a single hardcoded delete trigger: Alt+mousedown on a conn-line SVG element (React Flow community pattern). As the extension grows, different users have different muscle memory — some prefer Backspace-on-selected (tldraw), some prefer double-click, some want right-click. The hardcoded approach violates the grill principle of decoupling user-configurable concerns from core data operations.

Prior agent (commit 5ce971c) fixed two related bugs:
- BX-EXPLORE-009: onConnLineAltDown called `persistLayoutDebounced()` (undefined) instead of `saveLayoutDebounced()` — Alt+Click delete silently failed to persist
- Enlarged hit area by switching `click` → `mousedown` and stroke-width 1.5 → 2.5 (hover: 4)

This ADR formalizes the next step: make the trigger itself user-configurable.

## Research

| Project | Pattern | Key Insight |
|---|---|---|
| React Flow | `deleteKeyCode` prop (string array) + Alt+Click community | Configurable key list is a single prop |
| tldraw | Actions system: `{ id, label, icon, kbd, onSelect }` | Each action owns its own key test + handler |
| Excalidraw | `actionDeleteSelected` with `keyTest(event, appState, elements)` | Functional key test — flexible but coupling key logic to action |

## Decision

Adopt a **single config field + unified event detector** pattern (tldraw simplified to vanilla JS):

### Data
- Add `layout.settings.connDeleteAction: string` to `defaultLayout().settings`
- Default: `'alt+click'` (matches existing behavior, no user-visible change on upgrade)
- Enum: `'alt+click' | 'ctrl+click' | 'shift+click' | 'right-click' | 'double-click' | 'select+delete'`
- Spread-merge at L780 covers new field for existing users automatically

### Event Architecture
- Single `onConnLinePointerDown(e)` replaces `onConnLineAltDown` — reads `layout.settings.connDeleteAction` to decide if delete fires
- For `right-click` mode: register `contextmenu` listener with `preventDefault`
- For `double-click` mode: register `dblclick` listener
- For `select+delete` mode: click selects line (CSS class), Backspace/Delete removes
- `renderConnections` registers the appropriate listener per mode (cheap — called on connection changes only, not every drag frame)

### UI
- Settings general tab: new section after `url-open-mode-select` with `<select id="conn-delete-action-select">`
- Each option has `data-i18n` attribute; i18n keys added to `I18N_FALLBACK` in ntp.js (no external _locales dir — matches existing pattern)

### CSS
- `.conn-line--selected` class: `stroke-width: 4; filter: drop-shadow(0 0 3px var(--color-accent)); cursor: pointer;`
- Both large-box and small-box canvases share the same conn-line CSS (dual-write convention not violated — single source)

### Invariants Preserved
- `removeConnection(connId)` interface unchanged
- `connById` / `connLines` / `boxConnIdx` O(1) indices unchanged
- SVG layer rendering architecture unchanged
- DSU group system unchanged
- BX-EXPLORE-005..009 anti-regression constraints respected:
  - No `translate3d()` during drag
  - No `will-change: transform` / `translateZ(0)` on box/surface
  - O(1) lookups in hot paths (mousemove not affected — only renderConnections registers listeners)
  - `scheduleConnRefresh(all conn ids)` after `applyCanvasTransform`/`applyInnerTransform` untouched
  - Persistence uses `saveLayoutDebounced()` (BX-EXPLORE-009 lesson applied)

## Grilling Self-Review

**Q1: Is alt+click the right default?**
YES — matches React Flow community pattern, user already chose it in prior round, no behavior change on upgrade.

**Q2: Should right-click mode suppress the browser context menu?**
YES — `preventDefault()` on `contextmenu` event when mode is `right-click`. Without this, the browser's native menu pops up alongside the delete.

**Q3: Should select+delete highlight the selected line?**
YES — `.conn-line--selected` with `stroke-width: 4` + `filter: drop-shadow(0 0 3px var(--color-accent))`. Without visual feedback the user doesn't know which line is selected.

**Q4: What happens if user changes mode while a line is selected?**
Clear `selectedConnId` on mode change (in the change listener). Stale selection across modes is undefined behavior.

**Q5: Does the setting sync cross-tab?**
YES — it lives in `layout.settings`, covered by the spread-merge `{ ...remote.settings, ...local.settings }` at L780. `syncSettingsDOM` is already called after `applyExternalLayout` (L3528).

## Consequences

**Positive**:
- Users choose their preferred delete gesture
- No external dependency (vanilla JS, matches project constraint)
- Minimal code surface (~60 lines new + ~10 lines replaced)
- Full i18n coverage via existing I18N_FALLBACK pattern
- Backward compatible (default = current behavior)

**Negative**:
- 6 modes = 6 event handler paths to test (mitigated: Playwright tests cover each)
- select+delete mode requires keyboard listener on document/connSvg — tiny global state (`selectedConnId`)
- right-click mode disables browser context menu on lines only (users who want browser menu on lines must switch mode)

**Neutral**:
- Old `onConnLineAltDown` function removed — any external references would break (none exist in this codebase per codegraph)
