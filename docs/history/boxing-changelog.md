# Boxing Version History (Consolidated)

This file records Boxing extension version-by-version feature lists and incremental development rules. Moved out of AGENTS.md per neat-freak slimming directive. Active operating contract lives in AGENTS.md; this file is for historical reference only.


## v3.3 Features (2026-07-10)

| Feature | Description |
|---|---|
| Browser language auto-detect | On first run (no explicit user selection), detects navigator.language and matches to a supported locale.
| Header auto-hide on scroll | Button `○` in header toggles auto-hide mode: scroll down hides header, scroll up shows it.
| Pin/expand buttons redesigned | Emoji replaced with clean typographic symbols: `○`/`⊙` for pin, `⊟`/`⊞` for expand. Default state is OFF.
| Elastic snap iterative | elasticSnap now iterates through all overlapping boxes (while-loop style) instead of single-pass return.
| Box index recycling | Deleting a large box recalculates nextLargeIndex from remaining boxes.
| Auto-expand transition | Collapse/expand uses CSS transition on max-height (0.3s ease). expandBtn toggles between ⊟ (collapsed) and ⊞ (expanded).
| Small box default size | Increased from 320x340 to 640x420 (2x width).
| Bar dimensions | large-box__bar padding increased to 12px 16px; small-box__bar padding 4px 10px, min-height 32px.
| Inner caption real-time | updateInnerCaption() refreshes caption (smallBoxesCount) after add/delete small box.
| key headerPinOff | Added to all 13 locales for header unpinned state.
| key fontSizeLabel | Now translated in all non-English locales.

## Development Rules (v3.3 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-013 | MUST | elasticSnap must handle all overlapping boxes iteratively; single-pass return is a bug.
| BX-DEV-014 | MUST | Box indices recalculate on delete: nextLargeIndex = max(all titles' numeric suffix) + 1.
| BX-DEV-015 | MUST | Browser language auto-detection on first run (layout.settings.selectedLanguage === 'en' and never manually changed).
| BX-DEV-016 | MUST | Pin/expand buttons use clean typographic symbols (○⊙⊟⊞), not emoji. Default state is OFF (unpinned, always-expanded).
| BX-DEV-017 | MUST | Auto-expand uses CSS transition on max-height; body collapses upward (not hidden text).
| BX-DEV-018 | MUST | Small box default width = 640px, height = 420px.
| BX-DEV-019 | MUST | updateInnerCaption() called after every small box add/delete to keep caption accurate.
| BX-DEV-020 | MUST | Screenshots for debugging must be saved to cache dir (not project directory). Path: D:/Aworker/crx/.cache/screenshots/.
| BX-DEV-021 | MUST NOT | Do not save screenshots, debug images, or visual assets into the project directory. Use D:/Aworker/crx/.cache/screenshots/ exclusively.
| BX-DEV-022 | MUST | When viewing/displaying screenshots, load them from D:/Aworker/crx/.cache/screenshots/ via absolute path; never embed image files into the project workspace.

## i18n Key Reference (v3.3 additions)

| Key | en | Usage |
|---|---|---|
| headerPinOff | Header unpinned | Header pin toggle OFF state tooltip
| fontSizeLabel | Font Size | Settings slider label (translated in 12 non-en locales)

## v3.4 Features (2026-07-10)

| Feature | Description |
|---|---|
| Background clarity | Canvas colors shifted lighter/less saturated: canvas #F1EEE8, surface #EEE9E1, elevated #EBE5DB |
| Dark mode | Full dark theme via .ntp--dark class. Toggle button in header bar (☀/☽) and checkbox in settings. Dark palette: ink #E8E4DB, canvas #1E1C1A, accent #C4A882 |
| In-page delete confirm | Replaced browser confirm() with a custom <div> modal overlay. Supports large and small box delete with cancel. Confirms sync to all 13 locales. |
| smallBoxCountLabel fix | Removed stray backslash from smallBoxCountLabel in all 13 locales. Now displays "0 small boxes" not "\\0 small boxes" |
| Settings modal enlarged | Width from 440px to 600px to accommodate more settings |
| Export / Import data | Settings modal now has Export button (downloads oxing-backup.json) and Import button (file picker, validates & replaces layout) |
| Header autohide default ON | Default: header auto-hides (fullscreen canvas). Pin button toggles. Footer hidden when autohide active. |
| Dark mode in settings | Checkbox synchronized with header bar toggle button |
| 12 new i18n keys | confirmDeleteTitle, confirmDeleteLargeBody, confirmDeleteSmallBody, confirmYes, confirmCancel, darkMode, darkModeHint, exportData, importData, importSuccess, importFailed, dblclickCreateHint |
| All 13 locales updated | New keys translated for zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi. JSON parse-valid for all 13. |

## Development Rules (v3.4 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-023 | MUST | Deletion confirmation must use the in-page modal (confirm-modal element), NOT browser confirm()/lert(). |
| BX-DEV-024 | MUST | Dark mode toggle must sync: header button AND settings checkbox always reflect the same layout.settings.darkMode value. |
| BX-DEV-025 | MUST | Export creates a JSON blob with layout (version, boxes, settings); Import validates oxes array before replacing. |
| BX-DEV-026 | MUST | Header autohide defaults ON (headerPinned = false, 
tp--autohide active). Footer hidden in autohide mode. |
| BX-DEV-027 | MUST | All locale messages.json files must be valid JSON parseable by JSON.parse. Run a parse check after any locale edit. |
| BX-DEV-028 | MUST | smallBoxCountLabel must NOT contain a backslash escape in any locale. Value format: $1$ small boxes. |

## i18n Key Reference (v3.4 additions)

| Key | en | Usage |
|---|---|---|
| confirmDeleteTitle | Confirm Delete | Delete confirmation modal title |
| confirmDeleteLargeBody | Delete this large box and all its small boxes? This action cannot be undone. | Large box delete confirm body |
| confirmDeleteSmallBody | Delete this small box and all its bookmarks? This action cannot be undone. | Small box delete confirm body |
| confirmYes | Delete | Confirm yes button |
| confirmCancel | Cancel | Confirm cancel button |
| darkMode | Dark Mode | Dark mode toggle label |
| darkModeHint | Switch between light and dark appearance | Dark mode hint |
| exportData | Export Data | Export button |
| importData | Import Data | Import button |
| importSuccess | Data imported successfully | Import success toast |
| importFailed | Import failed: invalid data format | Import failed toast |
| dblclickCreateHint | Double-click to create | Dblclick hint |

## 
## v3.5 Features (2026-07-10)

| Feature | Description |
|---|---|
| Canvas boundary clamp | Pan constrained at 10% zoom; boxes cannot exceed virtual canvas bounds |
| Inner canvas pan | Small-box canvas now supports drag-pan like large canvas |
| Dark mode comprehensive | Full UI dark adaptation: every element (body, header, box bars, modals, zoom, bookmarks, popup) inverts correctly |
| Header autohide fullscreen | Unpinned mode: header + footer disappear, only canvas + zoom + floating pin button remain. Full immersive canvas. |
| Settings tabbed layout | Side-category navigation: General / Appearance / Data / Sync & Backup. Modal wider for future settings. |
| Backup sync | Backup Now button with timestamped JSON download. Auto-backup interval (daily/weekly). Sync provider selector. |
| Bookmark edit i18n | Save/Delete/Cancel buttons in bookmark editing popup now use i18n translations |
| Bookmark right-click edit | Right-clicking a bookmark row opens the edit popup instead of exiting the canvas |
| URL open fix | Bookmark click uses direct URL without moz-extension prefix; supports Chrome/Firefox/LibreWolf |
| Square corners option | Setting toggle for sharp square corners vs rounded (default: rounded). CSS class .ntp--square-corners |
| Import immediate render | Import replaces layout and force-renders without needing refresh |
| Small box bar enlarged | small-box__bar padding unified with large box (12px 16px), min-height 40px, title font 13px |
| 9 new i18n keys | bookmarkSave, bookmarkDelete, bookmarkEditTitle, backupNow, backupNowHint, autoBackupInterval, syncProvider, squareCorners, squareCornersHint — all 13 locales translated |
| Version bump | 3.4.0 → 3.5.0 |

## Development Rules (v3.5 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-029 | MUST | Canvas pan must be clamped: at 10% zoom, max pan range ≈ 10x container. clampCanvasPan/clampInnerPan enforce this boundary. |
| BX-DEV-030 | MUST | Inner canvas must support drag-pan (onInnerPanStart/onInnerPanMove/onInnerPanEnd bound to innerCanvas mousedown). |
| BX-DEV-031 | MUST | Dark mode (.ntp--dark) must cover ALL visible elements: body, header, search, buttons, modals, canvas, boxes, bookmarks, popups, crumbs, zoom controls, resize handles. No white gaps. |
| BX-DEV-032 | MUST | Header autohide fullscreen mode: when headerPinned=false, .ntp__bar display:none, .foot display:none, headerPinBtn becomes fixed floating button at top-right. Only canvas + zoom controls visible. |
| BX-DEV-033 | MUST | Settings modal uses tabbed layout: side nav (settings-nav) + content panels (settings-tab). Clicking a nav item hides other tabs and shows the selected one. |
| BX-DEV-034 | MUST | Bookmark edit popup buttons (Save/Delete/Cancel) must use i18n() with keys bookmarkSave, bookmarkDelete, confirmCancel. |
| BX-DEV-035 | MUST | Right-click on bm-row opens edit popup (trigger the three-dots editBtn click). Only right-click on empty inner canvas goes back. |
| BX-DEV-036 | MUST | Bookmark URL opens via api.tabs.create with direct URL; failover to window.open for environments without tabs API. |
| BX-DEV-037 | MUST | Small box header bar (.small-box__bar) must match large box bar dimensions: padding 12px 16px, gap spacing-3, min-height 40px, title font-size 13px with -0.2px letter-spacing. |
| BX-DEV-038 | MUST | Square corners toggle: layout.settings.squareCorners, CSS class .ntp--square-corners on #app, checkbox #square-corners-cb in Appearance tab. Applied on load. |
| BX-DEV-039 | MUST | Import must exitToCanvas() before renderCanvas() to clear any drill-in state, then apply both canvas + inner transforms immediately. |
| BX-DEV-040 | MUST | Backup Now creates timestamped JSON download via Blob + URL.createObjectURL. Auto-backup interval stored in layout.settings.autoBackupInterval. |

## i18n Key Reference (v3.5 additions)

| Key | en | Usage |
|---|---|---|
| bookmarkSave | Save | Bookmark edit popup save button |
| bookmarkDelete | Delete | Bookmark edit popup delete button |
| bookmarkEditTitle | Edit Bookmark | Bookmark edit popup title |
| backupNow | Backup Now | Backup button in settings |
| backupNowHint | Create a timestamped backup of all layout data | Backup hint |
| autoBackupInterval | Auto-Backup Interval | Auto-backup selector label |
| syncProvider | Sync Provider | Sync provider selector label |
| squareCorners | Square Corners | Square corners checkbox label |
| squareCornersHint | Use sharp square corners instead of rounded | Square corners hint |

Updated CSS Tokens (v3.4)

| Token | Old Value | New Value | Rationale |
|---|---|---|---|
| --color-canvas | #F7F3ED | #F1EEE8 | Less red-brown, higher clarity |
| --color-surface | #F3EFE7 | #EEE9E1 | Lower saturation |
| --color-elevated | #F0EBE2 | #EBE5DB | Lower saturation |
| --color-card-edge | #E8E0D4 | #E0D8CB | Lower saturation |
| --color-hairline | rgba(42,37,32,0.07) | rgba(42,37,32,0.06) | Subtler borders |


## Security Audit (v3.5 post-release)

| Date | 2026-07-10 |
|---|---|
| Report | [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) |
| Result | No Critical/High findings. 2 Medium (manifest fix applied), 4 Low (background.js fix applied). |
| XSS | All 6 candidates verified safe (textContent used throughout). |
| Secrets | 0 hardcoded keys/tokens found. |
| Dependencies | 0 packages (pure vanilla JS). |

### Audit fixes applied
- M-001: Removed duplicate ersion field in manifest.json
- M-002: Added ookmarks permission to manifest.json
- L-003: Catch blocks now log to console.error instead of silent swallow


## v3.6 Features (2026-07-10)

| Feature | Description |
|---|---|
| Box drag clamp | Large and small boxes clamp to visible canvas area (30% zoom boundary); edge-snap prevents lost boxes |
| Elastic snap iterative (fixed) | Rewrote elasticSnap with while-loop for complete overlap resolution (BX-DEV-013) |
| Dark mode comprehensive (fixed) | body+html gets .ntp--dark class via JS toggle; CSS covers all edges, canvas surfaces, settings modal, header bar when pinned |
| Header pin default ON | Default: header visible, pin button sits on header bar (not floating). Unpinned: header fades out (0.35s animate), canvas fills viewport, pin button floats at top-right |
| smallBoxCountLabel i18n (fixed) | All 12 non-English locales now use real translations (e.g. zh_CN: "小盒子") instead of English "small boxes" |
| Bookmark placeholder i18n (fixed) | bookmarkTitlePlaceholder and bookmarkUrlPlaceholder translated in all 13 locales |
| Settings nav i18n (fixed) | settings-nav buttons use data-i18n keys (settingsNavGeneral/Appearance/Data/Sync) with translations in all locales |
| Small box rounded corners | .small-box now uses border-radius: var(--radius-card) (18px) by default, keeping UI unified |
| Remember last position enhanced | Now saves/restores canvas zoom+pan AND inner zoom+pan in addition to last box ID |
| New i18n keys (v3.6) | settingsNavGeneral, settingsNavAppearance, settingsNavData, settingsNavSync, syncProviderHint, lastPositionLabel, lastZoomLabel, lastPageLabel — all 13 locales translated |
| Tests updated | boxing-v3.spec.ts: 10 tests all passing; updated for current CSS tokens (#F1EEE8), box sizes, bookmarks permission |
| .gitignore updated | Added .codegraph/ entry |

## Development Rules (v3.6 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-041 | MUST | Box drag clamp: large boxes clamp to worldMaxX/Y = canvasContainer.clientWidth*3.333/canvasZoom - width. Small boxes similarly for inner canvas. |
| BX-DEV-042 | MUST | Dark mode must be applied to both #app AND document.body via classList.toggle('ntp--dark', val). CSS must cover .ntp padding area, .ntp__bar when pinned, .canvas__surface, .inner__surface, .settings-content, all modal elements. |
| BX-DEV-043 | MUST | Header pin defaults ON (headerPinned=true). Button sits on header bar. When toggled OFF: header fades with 0.35s animation, canvas fills viewport, pin button floats at fixed top-right (class .header-pin--floating). |
| BX-DEV-044 | MUST | Small boxes (.small-box) must have border-radius: var(--radius-card) matching large boxes and canvas. Square corners toggle applies to both. |
| BX-DEV-045 | MUST | Remember-last-position also saves/restores lastZoom, lastPanX/Y, lastInnerZoom, lastInnerPanX/Y in layout. Restore on init (canvas) and enterLargeBox (inner). |
| BX-DEV-046 | MUST | All settings nav items (settings-nav__item) must have data-i18n attribute for language switching. |
| BX-DEV-047 | MUST | All hardcoded English text in bookmark popup placeholders, setting labels, sync provider hints must be i18n-covered across all 13 locales. |

## v3.6.2 Features (2026-07-10)

| Feature | Description |
|---|---|
| Drag-click fix | Track actual movement distance (3px threshold) for wasDragging, not just any mousedown+mouseup |
| Header pin button relocation | When pinned: button sits on header bar. When unpinned: button moves to canvas container (absolute-positioned at canvas top-right), not page-fixed |
| Zoom pan clamp immediate | clampCanvasPan/clampInnerPan called RIGHT AFTER zoomAtPoint in wheel zoom and keyboard Ctrl+/Ctrl- zoom, preventing flash-snap on next move |
| Bookmark URL scheme fix | ensureHttpsUrl() adds https:// to bare domains (fixes moz-extension prefix bug on Firefox/LibreWolf) |
| Header autohide animation | Footer fades out with transition; header bar uses 0.35s cubic-bezier slide-up; canvas expands with matching timing |
| Floating pin button | Absolute-positioned inside canvas container, not page-fixed. Top-right of canvas viewport regardless of zoom/pan |
| Small box default size | Width reduced from 640→480px, height 420→340px |
| Auto-expand redesign | Uses translateY slide-down from title bar with opacity+fade; cubic-bezier(0.22,1,0.36,1) for natural pull-down feel |
| Settings modal min-height | Added min-height:460px to prevent size jumping when switching between tabs |
| Version bump | 3.6.1 → 3.6.2 |

## Development Rules (v3.6.2 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-048 | MUST | wasDragging must track actual movement distance (3px threshold), not just any mousedown+mouseup pair. First click after drag must work immediately. |
| BX-DEV-049 | MUST | clampCanvasPan/clampInnerPan must be called immediately after zoomAtPoint in wheel and keyboard zoom handlers. Unclamped intermediate pan values cause a flash-snap when next pan move triggers clamp. |
| BX-DEV-050 | MUST | Auto-expand must use translateY + opacity + max-height transition with cubic-bezier(0.22,1,0.36,1) for a natural slide-down-from-title-bar animation. Previous max-height-only approach was visually jarring. |
| BX-DEV-051 | MUST | Floating pin button must be positioned inside canvas container (absolute), not page-fixed. This ensures it stays at canvas top-right regardless of viewport changes. |
| BX-DEV-052 | MUST | Bookmark URLs must be normalized with ensureHttpsUrl() before opening or saving. Bare domain names (www.baidu.com) get https:// prefix to prevent moz-extension prefix bugs on Firefox/LibreWolf. |
| BX-DEV-053 | MUST | Settings modal must have min-height to prevent size jumping between tabs. Minimum 460px ensures consistent presentation across all settings categories. |
| BX-DEV-054 | MUST | Small box default width = 480px, default height = 340px. This is wide enough for bookmark content but not overly wide. |

## i18n Key Reference (v3.6 additions)

| Key | en | Usage |
|---|---|---|
| settingsNavGeneral | General | Settings side nav category |
| settingsNavAppearance | Appearance | Settings side nav category |
| settingsNavData | Data | Settings side nav category |
| settingsNavSync | Sync & Backup | Settings side nav category |
| syncProviderHint | Boxing stores data... | Sync provider description |
| lastPositionLabel | Last position | (reserved for future UI) |
| lastZoomLabel | Last zoom | (reserved for future UI) |
| lastPageLabel | Last page | (reserved for future UI) |


## v3.6.3 Features (2026-07-11)

| Feature | Description |
|---|---|
| Drag-click fix v2 | wasDragging replaced with bar-down-position vs click-position comparison. No persistent state — comparisons are per-event. First click after ANY drag (even from previous lifetime) now works. |
| Floating pin on inner canvas | headerPinBtn moves to innerCanvas (not just canvasContainer) when inner page is active. updateAutohideUI called on enterLargeBox/exitToCanvas transitions. |
| Intranet URL scheme | ensureHttpsUrl detects private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, localhost) and uses http:// instead of https://. |
| Settings footer fixed | .modal uses overflow:hidden; .modal__body gets flex:1 + overflow-y:auto + min-height:0. Footer stays at bottom regardless of content length. |
| Bookmark drag-to-reorder | Each bm-row has a grip handle (⋮⋮) on the left. Drag up/down to reorder bookmarks within a small box. Visual dashed outline on target row. |
| Enter key to add/save bookmark | Both add-bookmark popup and edit-bookmark popup respond to Enter key in title/url inputs as save action. |
| Version bump | 3.6.2 → 3.6.3 |

## Development Rules (v3.6.3 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-055 | MUST | ensureHttpsUrl must detect private/intranet IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, localhost) and use http:// for those. All other bare domains get https://. |
| BX-DEV-056 | MUST | Bookmark rows must have a left-side grip handle (bm-row__grip) for drag-to-reorder. Drag swaps positions in sb.bookmarks array. Visual dashed outline indicates target row during drag. |
| BX-DEV-057 | MUST | Both add-bookmark and edit-bookmark input fields must respond to Enter key as the submit action (equivalent to clicking Save/Add button). |
| BX-DEV-058 | MUST | Settings modal: .modal must use overflow:hidden; .modal__body must use flex:1 + overflow-y:auto + min-height:0 so footer stays at bottom without scrolling away. |
| BX-DEV-059 | MUST | Floating header pin button must move to the currently active canvas (innerCanvas when on inner page, canvasContainer when on canvas page). updateAutohideUI must be called after every enterLargeBox/exitToCanvas transition. |
| BX-DEV-060 | MUST | Box drag vs click detection: compare mousedown position on bar with click position on body. Distance >3px → was drag, skip enter. No persistent state — comparison is per-event so first click always works. |

## v3.6.4 Hotfix (2026-07-11) — TDZ Fixes

| Feature | Description |
|---|---|
| API mock condition fix | `!api` → `!api \|\| !api.storage \|\| !api.storage.sync`. In file:/// or non-extension contexts, chrome/browser may exist but storage is unavailable. Mock now activates correctly. |
| DEBUG TDZ fix | `debug('Using localStorage mock')` moved from line 15 (before `const DEBUG`) to after DEBUG init. Was causing `Cannot access 'DEBUG' before initialization`. |
| I18N_FALLBACK external reference fix | `I18N_FALLBACK.syncProviderHint = ...` was outside IIFE, causing `I18N_FALLBACK is not defined`. Moved inside IIFE into object literal. |
| headerPinned TDZ fix | `let headerPinned` moved from line 1619 (inside init) to line ~222 (early declarations). Functions referencing it (renderCanvas, enterLargeBox) run before it was initialized. |
| window._boxingOpenSettings exposure | Exposed `openSettingsModal` and `addLargeBox` on `window` for Playwright testability in file:/// mode. |
| Version bump | 3.6.3 → 3.6.4 |

## Development Rules (v3.6.4 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-061 | MUST | API detection must check `!api \|\| !api.storage \|\| !api.storage.sync`, not just `!api`. In file:/// or non-extension contexts where chrome/browser exists but storage is unavailable, localStorage mock must activate. |
| BX-DEV-062 | MUST | All `const`/`let` declarations must appear before any function that references them can be called. This includes `DEBUG` (before any `debug()` call), `headerPinned` (before renderCanvas/enterLargeBox), and I18N_FALLBACK (must stay within IIFE). |
| BX-DEV-063 | MUST | I18N_FALLBACK and all i18n fallback extensions must remain INSIDE the IIFE scope. No external references to IIFE-scoped variables. |
| BX-DEV-064 | MUST | Key debug/test functions must be exposed on `window` (e.g., `window._boxingOpenSettings`) for Playwright testing in file:/// mode where button clicks may be blocked by canvas event handlers. |



| Change | Description |
|---|---|
| META-INF removed | Firefox signing artifacts — never in source repo. Added to .gitignore. |
| fonts/ + images/ removed | Legacy junk: element-ui node_modules, remotestorage-widget scraps, old NTP assets (~40 unused PNGs). No code references existed. |
| manifest.json dual-background | Uses BOTH `service_worker` AND `scripts` pointing to same `background.js`. Chromium uses service_worker; Firefox falls back to scripts when `extensions.backgroundServiceWorker.enabled=false`. This is the only cross-browser MV3 strategy. |
| Debug system upgraded | `window.__BOXING_DEBUG__` runtime flag (URL params: `?debug=1`, `?debug=0`, `?debug=verbose`). `window.__boxingDebug` API (`.state()`, `.dumpLayout()`, `.dumpStorage()`, `.triggerGC()`) for DevTools console inspection. |
| background.js + popup.js logging | Unified `bgLog/bgErr` and `popupLog/popupErr` with `[Boxing:BG]` / `[Boxing:Popup]` prefixes. |
| Build script | `tools/build.ps1` — universal PowerShell build (Chromium .zip, Firefox .zip, .crx via Chrome). Zero hardcoded paths. CI/CD-ready. |
| .gitignore expanded | `package/`, `*.xpi`, `META-INF/`, `_metadata/` added. `tools/` removed from ignore (build script is part of repo). |
| Project tree slimmed | `fonts/`, `images/`, `META-INF/` removed. Project now contains only necessary source + docs + 13 locales.
| Version bump | 3.6.5 → 3.6.6 |

## Development Rules (v3.6.6 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-071 | MUST | All debug logging must use `window.__BOXING_DEBUG__` runtime flag, not `const DEBUG`. URL params `?debug=1`/`?debug=0`/`?debug=verbose` override. `window.__boxingDebug` API must be exposed on `window` for DevTools inspection. |
| BX-DEV-072 | MUST | `background.js` and `popup.js` must use unified log helpers (`bgLog/bgErr`, `popupLog/popupErr`) with consistent prefixes `[Boxing:BG]` / `[Boxing:Popup]`. |
| BX-DEV-073 | MUST | `manifest.json` must contain BOTH `background.service_worker` AND `background.scripts` pointing to same file. Chromium uses service_worker; Firefox falls back to scripts when extensions.backgroundServiceWorker.enabled=false. This dual-key pattern is the only cross-browser MV3 strategy. |
| BX-DEV-074 | MUST | No META-INF, _metadata, or Firefox signing artifacts in source repo. Added to .gitignore permanently. |
| BX-DEV-075 | MUST | Build/packaging must use `tools/build.ps1` (no hardcoded paths). Output in `package/` (gitignored). Compatible with CI/CD agents (Windows). |
| BX-DEV-076 | MUST | Project must stay lean: no unused fonts/images/node_modules in source tree. Any asset added must have a code reference.
| BX-DEV-077 | MUST | After onBoxDragEnd for a large box, set `lastDragEndId = id`. In renderLargeBox body click handler, if `lastDragEndId === box.id`, set `lastDragEndId = null` and `barDownWasDragZone = false`. This prevents stale drag-zone detection from swallowing the first click after a drag on the same box. |
| BX-DEV-078 | MUST | Pin button uses two-position strategy. When headerPinned=true (default): button stays in header bar (`.ntp__bar`), header visible. When headerPinned=false: header hidden (display:none), button moved onto active canvas as absolute floating overlay. #header-pin-btn always has z-index:10 (pinned) or 1000 (floating) to beat canvas__surface stacking context. Called from renderCanvas and enterLargeBox. BX-DEV-098: base CSS fixes pointer-event interception. |
| BX-DEV-096 | MUST | Bookmark URL opening follows browser default. Firefox: query browser.browserSettings.openBookmarksInNewTabs.get({}); if true -> tabs.create (new tab), else -> tabs.update (current tab). Chrome: fallback to tabs.update (current tab, safest). Fallback: window.location.href (current) or window.open(url,_blank) (new). Cross-browser (Chrome+Firefox+LibreWolf). |
| BX-DEV-081 | MUST | Boxing NTP page must follow browser default navigation behavior. Do NOT intercept or redirect navigation away from NTP page (e.g. browser bookmark clicks, address bar input). Let the browser handle navigation naturally — current tab or new tab per browser settings. No special options or settings for this; just stay out of the way. Cross-browser (Chrome+Firefox+LibreWolf). |
| BX-DEV-083 | MUST | onCanvasPanStart and onInnerPanStart exclusion checks must include `.header-pin-btn` to prevent canvas pan handlers from swallowing pin button clicks. |
| BX-DEV-084 | MUST | body click handler: `lastDragEndId === box.id` cleanup (resetting barDownWasDragZone) must execute BEFORE the barDownWasDragZone distance check, not after it. Otherwise stale drag state blocks the first post-drag click. |

| BX-DEV-097 | MUST | Navigation state persistence: saveLayout() called immediately in enterLargeBox() and exitToCanvas(). Position restore only on new-tab navigation (detected via performance.navigation.type != 1 and getEntriesByType("navigation")[0].type != "reload"). On refresh/F5, always start fresh at canvas root. Memory includes: lastLargeBoxId, lastZoom, lastPanX, lastPanY, lastInnerZoom, lastInnerPanX, lastInnerPanY.
| BX-DEV-098 | MUST | #header-pin-btn base CSS: position:relative; z-index:10; cursor:pointer!important. This prevents .canvas__surface (position:absolute + transform stacking context) from intercepting pointer events on the pin button. Without this, the surface overlay swallows all clicks on sibling elements inside canvas.
| BX-DEV-100 | NOTE | Superseded by BX-DEV-109 (scaleY+max-height combo) and BX-DEV-105 (JS-measured --body-max-height). Inner head row replaced by inner__canvas-head with title + add button. Inner surface top offset 40px for bar clearance. |
| BX-DEV-101 | MUST | In inner view (enterLargeBox), header #add-box (+) button must be hidden (display:none). In exitToCanvas, restored. This prevents confusion: the header + creates large boxes, but inner view should only create small boxes via inner__canvas-head + button. Also: floating pin button in inner canvas offset to top:54px to clear inner__canvas-head bar (~40px). |
| BX-DEV-102 | MUST | manifest.json must include "browserSettings" permission for Firefox bookmark-open behavior detection (browser.browserSettings.openBookmarksInNewTabs). Chrome ignores unknown permissions safely. |
| BX-DEV-103 | MUST | Square corners mode (.ntp--square-corners) must cover settings UI: .settings-nav, .settings-nav__item, .settings-content input/select/button -- all border-radius:0!important. |
| BX-DEV-104 | MUST | Auto-expand uses pure max-height clipping -- NO opacity. Collapsed: max-height:0 overflow:hidden. Expanded (hover/focus-within): max-height:600px/500px. Content physically clips under title bar. |
| BX-DEV-105 | MUST | Auto-expand animation uses CSS var --body-max-height set by JS via setBodyExpandHeight(el). Function measures body.scrollHeight in requestAnimationFrame and sets precise max-height on body element. CSS uses max-height:var(--body-max-height,400px) for hover states with ease-out 0.35s transition. This ensures the drawer animation exactly matches content height — not overshooting with a hardcoded 500/600px value that expands too fast. Called in both createLargeBoxEl and createSmallBoxEl after DOM assembly. |
| BX-DEV-106 | MUST | Elastic-snap on box creation: addLargeBoxAt (dblclick) and addSmallBoxAt (dblclick) must run elasticSnap() before finalizing position, just like the header + button create functions. Without this, double-click created boxes overlap existing ones without snap-shifting. Also: renderCanvas and renderInnerSurface use DocumentFragment for batch DOM insertion to minimize reflows. |
| BX-DEV-107 | MUST | Favicon loading uses multi-source CDN fallback with volatile session cache (cleared on browser restart). Priority order: DuckDuckGo icons.duckduckgo.com (CN-friendly) → Google S2 → direct /favicon.ico. loadFavicon(img, url) async-loads each source sequentially with 3s timeout. Cached hosts skip probing; null cache means all sources failed — hide icon permanently for session. |
| BX-DEV-108 | MUST | Inner canvas floating pin button (header-pin--floating) top offset: 64px to clear inner__canvas-head bar + spacer. This keeps the pin button below the canvas-head divider line and away from the add-box (+) button. |
| BX-DEV-109 | MUST | Auto-expand animation uses scaleY(0→1) with transform-origin:top center ON TOP of max-height. This produces real 'pull-down tissue' body-panel animation from under title bar — the entire __body panel scales out, not just internal text fading/appearing. Collapsed: transform:scaleY(0) max-height:0 padding:0 overflow:hidden. Hovered: transform:scaleY(1) max-height:var(--body-max-height). Transition: transform+max-height+padding all ease-out 0.35s. |
| BX-DEV-110 | MUST | Settings tab switching uses opacity transition (0.12s) instead of display:none for smooth category navigation without flicker. Tabs use position:absolute when hidden to avoid layout space. openSettingsModal delays initial tab activation via double-requestAnimationFrame to let modal paint first. |
| BX-DEV-111 | MUST | v3.7.9+ comprehensive session-persistence + drawer animation + CDN package: |
| BX-DEV-111a | MUST | headerPinned read AFTER loadLayout+loadSettings complete (not before). Default: true; persisted in layout.settings.headerPinned. Toggle saves immediately. beforeunload writes emergency localStorage backup; loadLayout restores from localStorage if sync storage was stale. |
| BX-DEV-111b | MUST | Canvas pan+zoom saveLayout auto-persists lastPanX/Y/Zoom on every save. onInnerPanEnd and onInnerWheel also persist. On REFRESH: restore canvas pan position AND inner view via layout.lastLargeBoxId (enterLargeBox if last page was inside a box). New-tab restore respects rememberLastPos setting. |
| BX-DEV-111c | MUST | Box collapsed/pinned state restored on DOM creation: createLargeBoxEl/createSmallBoxEl apply `box--pinned`, `box--hover-expand`, `box--collapsed` classes from persisted box.collapseHover and box.pinned properties after bar+body appended. |
| BX-DEV-111d | MUST | Auto-expand drawer: box--hover-expand.box--collapsed sets `height:auto!important;max-height:54px` (bar-only), overflow:hidden. Hover: max-height:var(--expand-height). JS `setBodyExpandHeight()` measures full box scrollHeight by temporarily removing max-height constraint, writes `--expand-height` in px. Called for all collapsed boxes after renderCanvas/renderInnerSurface appends to DOM. Transition: cubic-bezier(0.4,0,0.2,1) collapse / cubic-bezier(0,0,0.2,1) expand. Body+resize-handle opacity 0→1 with 0.08s delay. |
| BX-DEV-111e | MUST | Favicon CDN race: 4 sources (bytecook CN→duckduckgo→google s2→favicon.im). On first request, `raceCDN()` probes all in parallel via Image() promises, locks fastest winner for session. Fallback order: winner → remaining sources → direct /favicon.ico. URL validation (`isValidPublicUrl`) skips intranet/localhost/raw-IP/non-http — prevents resource waste and dead loops. |
| BX-DEV-111f | MUST | Memory restore policy refined in v3.7.9+: Refresh (type=reload) NEVER restores memory — stays fresh. New tab / browser restart ALWAYS restores canvas position (lastZoom/lastPanX/lastPanY). If rememberLastPos is ON and last page was inside a large box, drills into that box with inner position. High sensitivity: `visibilitychange` listener saves current view state immediately when tab becomes hidden, capturing last active tab's state. Auto-expand resize-handle no longer flashes: uses opacity+pointer-events transition instead of display:none/block. ensureHttpsUrl rejects pure-numeric inputs (e.g. '1' → 0.0.0.1) to prevent invalid IP URL resolution. Bookmark save validates final URL format with `new URL()` before persisting. beforeunload replaced by visibilitychange for reliable state capture. |
| BX-DEV-111f-v2 | MUST | Further refinements: (1) Resize-handle uses visibility+opacity with 0.35s sync delay — invisible until drawer fully expands, no flash. (2) Refresh now preserves page LEVEL (canvas vs inner large box via `_enterLargeBox(id, skipPosRestore=true)`) without restoring pan/zoom — user stays on same page but at origin. (3) canvas__empty HTML cleared of hardcoded English fallback texts; renderCanvas ensures i18n applied to empty elements before display. (4) Settings nav `.settings-nav__item--active:hover` overrides hover background to retain active item's distinct appearance. (5) Import: BOM stripping, 5MB size cap, per-box field validation (id/x/y), settings sanitization (NaN/Infinity→defaults). Export: UTF-8 charset header, `_exportedAt` timestamp. (6) `importTooLarge` i18n key added to all 13 locale JSONs + I18N_FALLBACK. |
| BX-DEV-111d v2 | MUST | setBodyExpandHeight MUST temporarily set el.style.maxHeight='none', void el.offsetHeight to force reflow, read scrollHeight, then restore maxHeight — INSTEAD of reading scrollHeight under the collapsed max-height:60px constraint. Reading clamped returns ~58px (visible region), not the natural ~220px expand target. BX-EXP-REGR fix (c6b59ad): the savedMaxH ReferenceError previously prevented the (wrong) setProperty call from executing, so the drawer kept working by luck with the 800px CSS fallback. |
| BX-SEL-01 | MUST | Chrome dblclick on selectable canvas text creates a Selection range that survives innerHTML wipe; new text nodes in the next render get re-anchored to it, visually mimicking copy-select of toolbar buttons. ALL canvas-related surfaces (.canvas, .canvas__surface, .canvas__empty, .inner__surface, .inner__canvas, .foot__txt) MUST use user-select:none. contenteditable=true titles via user-select:text exception. renderCanvas() MUST call window.getSelection()?.removeAllRanges() BEFORE innerHTML=''. Firefox unaffected natively but shares code path. Fixed in 6163ca2. |
| BX-DEV-140e | MUST | scrollbar-gutter: stable on a overflow:hidden container reserves a scrollbar lane EVEN WHEN no scrollbar is shown — Chrome renders this as a visible right-side indent on collapsed hover-expand boxes. Never add scrollbar-gutter:stable to a container that relies on overflow:hidden for clipping. Real flash prevention for hover-expand lives on the body layer (overflow:visible on :hover and :not(.box--collapsed)), not on the box. Fixed in 72f78f8. |
| BX-DEV-140f | MUST | When adding a locale-visible HTML title attribute to a theme-preset or similar element, use data-i18n-title and ensure the i18n key exists in (a) I18N_FALLBACK and (b) ALL 14 _locales/<lang>/messages.json. Forgetting (b) leaves the fallback English text visible on every non-en locale despite the UI being localized. Theme tooltip i18n added to all 14 locales in 8767ee1. |

| BX-DEV-141 | MUST | Cross-platform build/test/CI pipeline (Q1-Q8 grill): build.mjs dev-junctions use fs.symlinkSync(type=junction/dir) instead of execSync mklink — Node native API, no shell subprocess. CI workflows (build.yml + test.yml) use OS matrix (ubuntu/macos/windows-latest) with per-OS Playwright browser cache paths. tools/build.sh + tools/build.ps1 deprecated to thin wrappers (5 lines each) calling node .github/scripts/build.mjs. crx3 added to devDependencies for cross-platform CRX signing. All 33 test files migrated from file:///+replace hack to url.pathToFileURL(). .gitattributes gains explicit eol=lf for .sh/.mjs/.ts/.json. scripts/build-release.js dead reference removed from AGENTS.md + CONTEXT.md. |
| BX-DEV-142 | MUST | IPC channel alignment + silent failure audit + bgErr bridge (grill Q1-Q5): (1) All background.js ↔ ntp.js messaging unified to `msg.type` — `msg.action` eliminated entirely. (2) 30+ empty `catch(_) {}` blocks audited: 8 A-class (critical paths) → `debugErr()`, 23 B-class (soft failures) → `/* silent: <reason> */` annotations. Zero empty catches remain. (3) `__boxingDebug` getters (buildSyncPayload/resolveWebDAVFileUrl/backupToGist) return no-op `() => undefined` + `debugWarn` when `__bxSync` not ready, instead of null. (4) `storageWriteChain.then()` gains chain-level `.catch()` — prevents permanent chain death if `mergeConcurrentLayout`/`layoutStorage.get` throws outside inner try/catch. (5) `bgErr` in background.js persists errors to `chrome.storage.local.bgErrLog` (ring buffer, max 50); `exportLog()` in ntp.js merges bgErrLog entries via `__bgErrLogCache` (init sync + storage.onChanged listener). Users can now see background SW errors in diagnostics export. Fixed in a7cc8aa. |
| BX-MANIFEST-004b | MUST | npm run dev:chrome and dev:firefox MUST chain npm run build -> web-ext run ... so the dev script compiles before loading dist/ into the browser. dev:chrome:no-build / dev:firefox:no-build skip build for fast reload and MUST retain --no-reload. build.mjs emits [STALE_DIST] warnings when prior BUILD_INFO.json commit differs from current git HEAD. Restores stale-detection lost when dev-load.mjs was replaced by web-ext npm scripts in ab436d7. |

| BX-PERF-001 | MUST | moveGroupTogether MUST use spatial grid query for collision candidates, not linear others array scan. Grid built at drag-start O(n), queried per member O(k) where k = 0-5 neighbors. Mark grid dirty on box position change outside drag (__spatialGridDirty pattern, same as __dsuDirty). ADR-0013. |
| BX-PERF-002 | MUST | renderConnections SVG line pooling: pool removed <line> elements in Map<poolKey, Element[]>. renderCanvas full-rebuild semantics (innerHTML='' + disposeAllConns() + full box recreation) MUST NOT change -- preserves multi-tab sync safety (applyExternalLayout depends on clean DOM after render). |
| BX-PERF-003 | MUST | Do NOT add rAF batching to onBoxDragMove. Synchronous per-frame execution is required for follow-hand UX. rAF batching adds 1-frame latency (~16ms). moveGroupTogether O(m x n) is fixed by grid hash (BX-PERF-001), not frame batching. |
| BX-PERF-004 | MUST | Do NOT add WeakMap geometry caches for boxMidPoint. boxMidPoint reads el.style.left/top + width/height -- already O(1). Cache hit rate near-zero during drag (moved box invalidates its entry every frame). Premature optimization. |
| BX-PERF-005 | MUST | Do NOT split saveLayout into incremental storage writes. chrome.storage.set() does not support partial key updates. Full JSON.stringify of 30KB = <1ms. saveLayout is cold-path + 120ms debounced. Splitting complicates cross-tab merge + adds async round-trips. |
