# Browser Extension Agent Guide

## Applicability

| Field | Value |
|---|---|
| Scope | Browser extension development under `D:\Aworker\crx\boxing` |
| Primary reader | Future AI coding agents |
| Style | Machine-readable first: tables, command blocks, MUST/MUST NOT rules |
| Target browsers | Chrome + Firefox unless a project-specific guide narrows scope |
| Default implementation style | Minimal dependencies, standards-first WebExtension code |

## Hard Rules

| Rule ID | Type | Rule |
|---|---|---|
| CRX-R-001 | MUST | Treat this file as project-local operating instructions for browser extension work only. |
| CRX-R-002 | MUST | Prefer Manifest V3 for new or migrated Chrome/Firefox extension work. |
| CRX-R-003 | MUST | Preserve browser-extension constraints: popup, options page, new tab page, content scripts, background service worker, permissions, host permissions, and store submission metadata. |
| CRX-R-004 | MUST | Use the available Chrome extension development guidance before changing extension APIs, Manifest V3 behavior, service workers, content scripts, popup UI, side panel UI, or Chrome Web Store metadata. |
| CRX-R-005 | MUST | Use the available modern web guidance before choosing CSS, browser APIs, storage APIs, security patterns, or Baseline-sensitive features. |
| CRX-R-006 | MUST | Use the available frontend design guidance before changing popup, side panel, options page, new tab page, or injected content script UI aesthetics. |
| CRX-R-007 | MUST | Use available browser runtime tooling for screenshot, DOM, CSS, console, and network validation when visual or runtime behavior changes. |
| CRX-R-008 | MUST | Keep Chrome + Firefox compatibility visible in design and validation steps. |
| CRX-R-009 | MUST NOT | Do not add npm dependencies unless the user explicitly approves. |
| CRX-R-010 | MUST NOT | Do not default to shadcn/ui, Tailwind, Figma, React, Plasmo, Browserbase, or Stagehand. |
| CRX-R-011 | MUST NOT | Do not migrate an existing unpacked extension into WXT unless the user explicitly requests a full framework migration. |
| CRX-R-012 | IF-THEN | If a project-specific `agent.md` exists in a subdirectory, follow it after this guide. |

## Approved CRX Capabilities

| Capability | Use when | Constraint |
|---|---|---|
| Chrome extension guidance | Manifest V3, service workers, popup/options/newtab UI, content scripts, permissions, Chrome Web Store readiness | Use for API correctness and publishing readiness. |
| Modern web guidance | Modern CSS, Baseline-compatible APIs, browser-platform behavior | Use for CSS/API currency and cross-browser support. |
| Frontend design guidance | High-aesthetic UI decisions for popup, side panel, options, new tab, or injected UI | Use before visual redesigns. |
| Browser runtime validation | Screenshot, DOM/CSS/runtime/console/network validation | Use after UI, manifest, service worker, or runtime changes. |
| Cross-browser validation | Firefox behavior checks and Chrome/Firefox parity | Use when feature behavior may differ by browser. |
| WXT framework | New Chrome+Firefox extension scaffolds | Use only for new scaffolds or explicit migration requests. |

## WXT Usage Recipes

### New-project scaffold

Use WXT only for new scaffolds unless the user requests migration.

```powershell
npx -y wxt@latest init my-extension -t vanilla --pm pnpm
cd my-extension
pnpm install
```

Use `--pm`, not `--package-manager`.

### Direct WXT CLI fallback

If pnpm dependency status checks fail, run WXT directly:

```powershell
node node_modules/wxt/dist/cli/index.mjs build
node node_modules/wxt/dist/cli/index.mjs build -b firefox --mv3
node node_modules/wxt/dist/cli/index.mjs zip -b firefox --mv3
```

## Build and Verification

| Scenario | Command or action | Expected result |
|---|---|---|
| Chrome WXT build | `node node_modules/wxt/dist/cli/index.mjs build` | `.output\chrome-mv3\manifest.json` exists. |
| Firefox WXT build | `node node_modules/wxt/dist/cli/index.mjs build -b firefox --mv3` | `.output\firefox-mv3\manifest.json` exists. |
| Firefox sources zip | `node node_modules/wxt/dist/cli/index.mjs zip -b firefox --mv3` | `.output\*-sources.zip` exists. |
| Existing unpacked extension validation | Load unpacked extension in Chrome/Firefox | Extension loads without manifest errors and console errors are reviewed. |
| UI verification | Use available browser runtime screenshot/DOM/console inspection | Visual result matches requested style and console is clean. |

## UI/Aesthetic Workflow

| Step | Required action |
|---:|---|
| 1 | Establish visual direction before UI edits. |
| 2 | Check modern CSS/browser API constraints before choosing implementation patterns. |
| 3 | Prefer project-local CSS variables and native browser APIs before adding UI dependencies. |
| 4 | For content script UI, prefer Shadow DOM or isolated styles to avoid host-page style collisions. |
| 5 | Validate visual changes through browser screenshots and console inspection when available. |
| 6 | Keep extension bundle size and startup cost visible for popup/newtab surfaces. |

## Forbidden Defaults

| Default | Rule |
|---|---|
| shadcn/ui | Do not add unless user explicitly selects it. |
| Tailwind | Do not add unless user explicitly selects it. |
| Figma workflow | Do not add unless a Figma file/design workflow exists. |
| Plasmo | Do not add unless user requests Plasmo migration. |
| React/Vue rewrite | Do not add unless user approves a framework rewrite. |
| Cloud browser automation | Do not add for sensitive extension sessions unless user approves. |

## Known CRX Development Traps

| Trap | Correct handling |
|---|---|
| Existing unpacked extension is not a framework scaffold | Do not assume package scripts or node dependencies exist. |
| WXT init package manager flag | Use `--pm`. |
| pnpm build-script status checks block a WXT scaffold | Use direct WXT CLI fallback. |
| Missing extension-specific runtime tooling | Verify extension UI manually in browser and record console/manifest errors. |
| Manifest V2 legacy extension | Prefer explicit MV3 migration planning before changing background behavior. |

## Playwright & Firefox Extension Development

### Tooling Summary

| Tool | Purpose | Status |
|---|---|---|
| `@playwright/test` | Cross-browser automation, E2E tests | Installed |
| `web-ext` | Firefox extension development, hot reload, lint | Installed |
| Playwright Firefox | Automated testing (headless/headed) | Working |
| LibreWolf | Manual verification only | No remote debugging support |

### Playwright Configuration

**File**: `D:\Aworker\crx\playwright\playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.resolve(__dirname, '..', 'qlearly_bookmark-0.0.2');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    headless: false,
  },
  projects: [
    {
      name: 'firefox-extension',
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
        launchOptions: {
          args: ['-no-remote'],
        },
      },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

### Package.json Scripts

**File**: `D:\Aworker\crx\playwright\package.json`

```json
{
  "scripts": {
    "test": "playwright test",
    "test:firefox": "playwright test --project=firefox-extension",
    "dev:firefox": "web-ext run --source-dir=../qlearly_bookmark-0.0.2 --firefox=\"C:\\\\Users\\\\Administrator\\\\AppData\\\\Local\\\\ms-playwright\\\\firefox-1532\\\\firefox\\\\firefox.exe\" --no-reload --keep-profile-changes",
    "dev:firefox:librewolf": "web-ext run --source-dir=../qlearly_bookmark-0.0.2 --firefox=\"D:\\\\LibreWolf\\\\librewolf.exe\" --no-reload --keep-profile-changes",
    "build:firefox": "web-ext build --source-dir=../qlearly_bookmark-0.0.2 --artifacts-dir=../dist/firefox",
    "lint": "web-ext lint --source-dir=../qlearly_bookmark-0.0.2"
  }
}
```

### Firefox Extension Development Workflow

| Scenario | Command | Notes |
|---|---|---|
| Automated testing | `npm run test:firefox` | Uses Playwright Firefox (headless capable) |
| Local dev with hot reload | `npm run dev:firefox` | Uses web-ext + Playwright Firefox binary |
| Lint manifest | `npm run lint` | Validates manifest.json |
| Build for Firefox | `npm run build:firefox` | Outputs to `dist/firefox/` |
| LibreWolf manual test | Open LibreWolf → `about:debugging` → Load Temporary Add-on | LibreWolf blocks remote debugging (privacy hardening) |

### Key Constraints

| Constraint | Details |
|---|---|
| LibreWolf automation | **Not supported** — LibreWolf disables `--start-debugger-server` / remote debugging for privacy. Use only for manual verification. |
| Firefox extension loading | Playwright Firefox doesn't support loading unpacked extensions directly. Use `web-ext` for development. |
| Profile persistence | `--keep-profile-changes` preserves installed extensions across restarts. |
| Cross-browser parity | Test Chrome with `chromium` project, Firefox with `firefox-extension` project. |

---

## Chrome Extension Development Workflow

### Chrome-Specific Operations

| Scenario | Command / Action | Notes |
|---|---|---|
| Load unpacked MV3 | Open `chrome://extensions` → Developer mode → Load unpacked → Select `qlearly_bookmark-0.0.2` | Manual or via opencode browser tools |
| Reload extension | Click reload button on extension card or run `chrome.management.setEnabled(id, true)` in console | Browser tools: `browser_click` + `browser_evaluate` |
| Inspect popup | Right-click extension toolbar icon → Inspect popup | Opens DevTools attached to popup |
| Inspect side panel | `chrome://extensions` → Details → Inspect views: side panel | Opens DevTools for side panel |
| Inspect background service worker | `chrome://extensions` → Details → Inspect views: service worker | Opens DevTools for background.js |
| View extension errors | `chrome://extensions` → Errors button on extension card | Shows manifest/background/content script errors |

### Automated Chrome Extension Testing (CI)

| Tool | Configuration | Notes |
|---|---|---|
| Playwright Chromium | `chromium-extension` project with `--load-extension` | Requires headed mode + persistent context |
| chrome-devtools MCP | CDP commands for install/reload/inspect | Already configured in opencode |

### Extension Validation Checklist

| Check | Command / Action | Expected |
|---|---|---|
| Manifest V3 validity | Load unpacked in Chrome | No manifest parse errors |
| Service worker registration | `chrome://extensions` → Service worker status | Shows "Active" or "Starting" |
| Popup opens | Click toolbar icon | Popup renders without console errors |
| New tab override | Open new tab | `ntp/index.html` loads with beige theme |
| Permissions | `chrome://extensions` → Details → Permissions | Only declared permissions requested |

---

# Qlearly Project Specialization

## Applicability

| Field | Value |
|---|---|
| Project path | `D:\Aworker\crx\qlearly_bookmark-0.0.2` |
| Current extension | `Qlearly_bookmark` v0.0.2 |
| Current manifest | Manifest V2 |
| Target browsers | Chrome + Firefox |
| Main UI surface | New tab override: `ntp/index.html`, `ntp/ntp.css`, `ntp/ntp.js` |
| Secondary UI surfaces | `popup/`, `options/` |
| Target style | Beige, modern minimal, high whitespace, bookmark boxes/layered cards preserved |

## Project Facts

| Fact | Value |
|---|---|
| Existing new tab entry | `ntp/index.html` loads `ntp.css` and `ntp.js`. |
| Existing popup entry | `popup/popup.html`, `popup/popup.css`, `popup/popup.js`. |
| Existing options entry | `options/options.html`, `options/options.css`, `options/options.js`. |
| Existing visual asset | `ntp/ntp.css` is the main aesthetic asset and must be mined before rewriting. |
| Existing JS state | `ntp/ntp.js` contains built/minified Vue 2 runtime and renders minimal placeholder UI. |
| Existing package state | This unpacked project is not a WXT scaffold and has no WXT scripts. |
| OAuth state | Manifest includes Google Drive OAuth scope, but do not build Drive sync unless user explicitly scopes it. |

## Qlearly Hard Rules

| Rule ID | Type | Rule |
|---|---|---|
| QL-R-001 | MUST | Preserve the bookmark box/card hierarchy concept. |
| QL-R-002 | MUST | Use CSS Variables Tokens as the aesthetic dependency model. |
| QL-R-003 | MUST | Keep the visual direction beige, modern, minimal, and spacious. |
| QL-R-004 | MUST | Prefer vanilla JS + CSS tokens over framework rewrites. |
| QL-R-005 | MUST | Inspect and mine `ntp/ntp.css` before replacing styles. |
| QL-R-006 | MUST | Keep Chrome + Firefox compatibility visible during API and manifest edits. |
| QL-R-007 | MUST NOT | Do not introduce shadcn/ui, Tailwind, Figma workflow, Plasmo, React, or Vue rewrite by default. |
| QL-R-008 | MUST NOT | Do not remove the new tab override behavior unless user explicitly approves. |
| QL-R-009 | MUST NOT | Do not activate Google Drive sync/OAuth work unless user explicitly scopes it. |
| QL-R-010 | IF-THEN | If converting to MV3, map `browser_action` to `action` and `background.scripts` to `background.service_worker`. |

## CSS Token Baseline

| Token | Value | Purpose |
|---|---|---|
| `--color-canvas` | `#FAF7F2` | Main beige-white canvas. |
| `--color-surface` | `#F2EDE5` | Card surface. |
| `--color-elevated` | `#EDE5D8` | Hover/selected/elevated layer. |
| `--color-ink` | `#2A2520` | Primary near-black brown text. |
| `--color-muted` | `#7B7167` | Secondary text. |
| `--radius-card` | `16px` | Bookmark/card container radius. |
| `--radius-tile` | `12px` | Small bookmark tile radius. |
| `--space-1` | `4px` | Base spacing unit. |
| `--space-2` | `8px` | Small spacing. |
| `--space-3` | `12px` | Medium spacing. |
| `--space-4` | `16px` | Default spacing. |
| `--space-6` | `24px` | Section spacing. |
| `--space-8` | `32px` | Large whitespace. |
| `--font-stack-ui` | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | UI font stack. |

## Source Layout

| Path | Role | Edit guidance |
|---|---|---|
| `manifest.json` | Extension metadata and permissions | Treat as high-risk. Prefer MV3 when migrating. |
| `background.js` | Background behavior | Preserve unless implementing explicit background/service-worker task. |
| `ntp/index.html` | New tab shell | Keep `#app` or equivalent mount target. |
| `ntp/ntp.css` | Main design system and new tab visual language | Mine and tokenise before deleting or replacing. |
| `ntp/ntp.js` | New tab runtime | Candidate for vanilla JS rewrite when implementing real bookmark rendering. |
| `popup/popup.*` | Toolbar popup | Empty/near-empty shell; safe to enable when scoped. |
| `options/options.*` | Options page | Empty/near-empty shell; safe to enable when scoped. |
| `icons/`, `images/`, `fonts/` | Static assets | Preserve paths unless manifest/UI references are updated. |

## Safe Modification Rules

| Change type | Rule |
|---|---|
| Aesthetic refinements | Start with CSS variables and class-level refactors. |
| Bookmark rendering | Use native browser bookmark APIs where possible. |
| New dependencies | Require explicit user approval. |
| Framework migration | Require explicit user approval. |
| MV3 migration | Allowed when scoped; verify Chrome and Firefox behavior separately. |
| Store metadata | Track permission justifications if Chrome Web Store submission becomes in-scope. |

## Validation Rules

| Validation | Command or action | Expected result |
|---|---|---|
| Manifest sanity | Load unpacked extension in Chrome | No manifest parse errors. |
| Firefox sanity | Load temporary add-on in Firefox | No manifest parse errors or unsupported API warnings that block load. |
| New tab UI | Open a new tab | Beige minimal card layout appears and no console errors are present. |
| Popup UI | Open toolbar action popup | Popup opens without layout overflow or console errors. |
| Options UI | Open options page if enabled | Options page opens without console errors. |
| Visual inspection | Use browser screenshot/DOM/CSS inspection when available | Screenshot/DOM/CSS inspection confirms high whitespace and card hierarchy. |


---

# Boxing Project Specialization

## Applicability

| Field | Value |
|---|---|
| Project path | D:\Aworker\crx\boxing |
| Current extension | Boxing v3.1.0 |
| Current manifest | Manifest V3 |
| Target browsers | Chrome + Firefox |
| Main UI surface | New tab override: ntp/index.html, ntp/ntp.css, ntp/ntp.js |

## i18n Requirements

| Rule ID | Type | Rule |
|---|---|---|
| BX-I18N-001 | MUST | All 13 supported languages (en, zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi) must have complete translations for every i18n key used in the UI. |
| BX-I18N-002 | MUST | New i18n keys must be added to _locales/<lang>/messages.json for all 13 languages before claiming completion. |
| BX-I18N-003 | MUST | Keys with $1$ or $2$ must include a placeholders object: { "1": { "content": "$1" } }. |
| BX-I18N-004 | MUST | Chrome i18n API (chrome.i18n.getMessage) is NOT used; the custom i18n store in ntp.js loads messages.json via fetch. |
| BX-I18N-005 | MUST | English fallback (I18N_FALLBACK) in ntp.js must cover every i18n key in case fetch fails. |
| BX-I18N-006 | MUST | data-i18n, data-i18n-title, data-i18n-placeholder attributes in HTML must match a real key. |

## Development Rules

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-001 | MUST | Use Obsidian-style CSS transform (translate + scale) for infinite canvas pan/zoom. |
| BX-DEV-002 | MUST | Drag uses mousedown/mousemove/mouseup (manual drag), NOT HTML5 drag-and-drop API. |
| BX-DEV-003 | MUST | Title editing zones (.large-box__title, .small-box__title) must block mousedown propagation to prevent drag and click-through. |
| BX-DEV-004 | MUST | Elastic snap on drag-end: collision detection -> find nearest non-overlapping edge -> snap. |
| BX-DEV-005 | MUST | Canvas pan via left-click-drag on empty canvas area; Ctrl+scroll zooms at cursor point. |
| BX-DEV-006 | MUST | Zoom controls in canvas bottom-right corner are fixed-position, unaffected by canvas transform. |
| BX-DEV-007 | MUST | Settings modal is an in-page overlay (not a separate options page). |
| BX-DEV-008 | MUST | Small boxes use list mode only; grid/list toggle removed. |
| BX-DEV-009 | MUST | Bookmark rows are editable via three-dots edit button (inline popup for title+URL). |
| BX-DEV-010 | MUST | Font size adjustable via CSS variable --font-size-base controlled by settings. |
| BX-DEV-011 | MUST NOT | Do not add shadcn/ui, Tailwind, React, Vue, or npm dependencies. |
| BX-DEV-012 | MUST NOT | Do not use brand__mark brown color block (removed). |


## i18n Development Requirements

| Rule ID | Type | Rule |
|---|---|---|
| BX-I18N-DEV-001 | MUST | Every UI string visible to users must use the i18n(key) function, never hard-coded English/Chinese text. |
| BX-I18N-DEV-002 | MUST | All 13 supported languages (en, zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi) must have translations for every i18n key. |
| BX-I18N-DEV-003 | MUST | When adding a new i18n key, add it to _locales/en/messages.json first, then copy to all 12 other locale files with proper translations. |
| BX-I18N-DEV-004 | MUST | I18N_FALLBACK in ntp.js must contain every i18n key as a fallback for when fetch fails. |
| BX-I18N-DEV-005 | MUST | All data-i18n, data-i18n-title, data-i18n-placeholder attributes in HTML must match an existing key in messages.json. |
| BX-I18N-DEV-006 | MUST | Keys with placeholders ($1$, $2$) in messages.json must include a "placeholders" object per Chrome i18n spec. |
| BX-I18N-DEV-007 | MUST | The custom i18n loader in ntp.js fetches _locales/<lang>/messages.json; chrome.i18n.getMessage API is NOT used. |
| BX-I18N-DEV-008 | MUST NOT | Never add hardcoded language strings in JS or HTML that bypass the i18n(key) function. |
| BX-I18N-DEV-009 | MUST | After changing language in settings, re-render all visible UI (canvas, inner surface, crumbs, caption) to reflect new language immediately. |

## Debug Development

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEBUG-001 | INFO | Set DEBUG = true in ntp.js during development; all [Boxing] prefixed console logs help trace issues. |
| BX-DEBUG-002 | MUST | Use Playwright (D:\Aworker\crx\playwright) for automated e2e testing during development. |
| BX-DEBUG-003 | MUST | After each major change, run "node --check ntp.js" to verify syntax before testing in browser. |
## CSS Token Baseline (Boxing v3.1)

| Token | Value | Purpose |
|---|---|---|
| --color-canvas | #F7F3ED | Main warm-neutral canvas. |
| --color-surface | #F3EFE7 | Card surface. |
| --color-elevated | #F0EBE2 | Hover/selected/elevated layer. |
| --color-ink | #2A2520 | Primary near-black text. |
| --color-accent | #A08060 | Muted warm earth accent. |
| --font-size-base | 14px | Adjustable base font size. |

## Architecture (v3.1)

- Infinite canvas: CSS transform(translateX, translateY) scale(Z) on canvas__surface
- Pan: drag empty canvas area (mousedown+mousemove)
- Zoom: Ctrl+scroll at point, Ctrl+/- step zoom, zoom buttons
- Nodes (boxes): absolute positioning in world coordinates
- Dual-level: Canvas (large boxes) -> Inner canvas (small boxes inside one large box)
- Bookmarks: list rows with favicon + three-dots edit button (inline popup for title+URL)
- No grid/list toggle — small boxes are always list mode

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
- L-002: Renamed __qlearly_last_install__ → __boxing_last_install__
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

## Critical Lessons Learned

1. **Never place executable code before `const`/`let` declarations it references.** `debug()` calling before `const DEBUG` causes TDZ ReferenceError that silently breaks the entire IIFE execution — all subsequent functions and DOM bindings are never defined.
2. **Never place IIFE-scoped code outside the IIFE closing `})();`.** External references to `I18N_FALLBACK` etc throw ReferenceError and halt execution.
3. **Function hoisting does NOT mean safe to call before `let`/`const` init.** Functions referencing `let`/`const` variables in their closure will throw TDZ errors if called before the variable declaration executes.
4. **When debugging "all box creation broken", check console errors FIRST.** Two TDZ errors (`I18N_FALLBACK is not defined`, `Cannot access 'DEBUG' before initialization`) caused the entire init to fail silently — no functions were defined, no events were bound.

## v3.6.5 Features (2026-07-11)

| Feature | Description |
|---|---|
| Drag-click fix v3 | `lastDragEndTime` global timestamp (60ms window). After any box drag ends, clicks within 60ms are ignored to prevent drag-then-accidental-enter. Fixes the "move box then first click does nothing" bug. |
| Autohide overflow fix | `.ntp--autohide` adds `overflow:hidden` on `.ntp` and `.library` to prevent browser scroll. JS also sets `document.body.style.overflow='hidden'` when header unpinned. |
| Autohide smoother animation | Transition timing kept at 0.35s cubic-bezier(0.22,1,0.36,1). CSS `overflow:hidden` prevents jarring scroll jank during transition. |
| Small box width | Default width reduced from 480px → 360px. |
| Footer hint updated | Added "Left-drag to pan" to footerHint in I18N_FALLBACK and en locale. Now reads: "Ctrl+scroll to zoom · Left-drag to pan · / to search · Dblclick to add" |
| Bookmark drag-click fix | After bookmark drag (grip handle), `setTimeout` blocks the subsequent click event with a capture-phase once-listener. Fix: dragging to reorder no longer opens the bookmark URL. |
| Pin button default | Large and small box pin buttons now default to UNPINNED (○ icon, opacity 0.4, title "Pin"). `box.pinned` normalized with `=== true`. Previously they showed ⊙ (pinned) icon but opacity 0.4 (contradiction). |
| Auto-expand redesign v2 | Changed from `max-height` animation to `scaleY(0→1)` with `transform-origin:top center`. Natural pull-down-from-title-bar effect. Transition 0.35s cubic-bezier(0.22,1,0.36,1). |
| Duplicate `let headerPinned` removed | Second declaration at line ~1627 was a TDZ duplicate. Only the early declaration at line ~226 remains. |
| Version bump | 3.6.4 → 3.6.5 |

## Development Rules (v3.6.5 additions)

| Rule ID | Type | Rule |
|---|---|---|
| BX-DEV-065 | MUST | After any box drag end (onBoxDragEnd), set `lastDragEndTime = Date.now()`. All box body click handlers check `Date.now() - lastDragEndTime < 60` and skip entry if true. |
| BX-DEV-066 | MUST | After bookmark reorder drag, use `setTimeout(() => row.addEventListener('click', blocker, {once:true, capture:true}), 0)` to prevent the lift-off click from triggering bookmark open. |
| BX-DEV-067 | MUST | When headerPinned=false (autohide), both `document.body.style.overflow` and `document.documentElement.style.overflow` must be set to `'hidden'` to prevent browser page scroll. Restored to `''` when pinned. |
| BX-DEV-068 | MUST | Box pin buttons must default to UNPINNED state: ○ icon, opacity 0.4, title "Pin". `box.pinned` (or `sb.pinned`) normalized with `=== true` check. |
| BX-DEV-069 | MUST | Auto-expand must use `transform: scaleY(0→1)` with `transform-origin: top center` for natural pull-down effect. NOT max-height animation. Transition: 0.35s cubic-bezier(0.22,1,0.36,1). |
| BX-DEV-070 | MUST | No duplicate `let`/`const` declarations in the same scope. Each state variable declared exactly once in early declarations block.
| |

## v3.6.6 — Cleanup & Build System (2026-07-11)

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
| BX-DEV-100 | MUST | Auto-expand uses max-height drawer animation (not scaleY). Collapsed: max-height:0; overflow:hidden. Hovered: max-height:600px (large) or 500px (small) with cubic-bezier(0.22,1,0.36,1) 0.45s transition. This produces natural pull-down tissue effect from under title bar. Also: inner head row removed; replaced by inner__canvas-head (absolute bar inside canvas with title + add button). Inner surface top offset 40px to accommodate bar. Pin unpin mode extends .library to height:100vh hiding footer. |
| BX-DEV-101 | MUST | In inner view (enterLargeBox), header #add-box (+) button must be hidden (display:none). In exitToCanvas, restored. This prevents confusion: the header + creates large boxes, but inner view should only create small boxes via inner__canvas-head + button. Also: floating pin button in inner canvas offset to top:54px to clear inner__canvas-head bar (~40px). |
| BX-DEV-102 | MUST | manifest.json must include "browserSettings" permission for Firefox bookmark-open behavior detection (browser.browserSettings.openBookmarksInNewTabs). Chrome ignores unknown permissions safely. |
| BX-DEV-103 | MUST | Square corners mode (.ntp--square-corners) must cover settings UI: .settings-nav, .settings-nav__item, .settings-content input/select/button -- all border-radius:0!important. |
| BX-DEV-104 | MUST | Auto-expand uses pure max-height clipping -- NO opacity. Collapsed: max-height:0 overflow:hidden. Expanded (hover/focus-within): max-height:600px/500px. Content physically clips under title bar. |