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
