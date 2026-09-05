<!-- README-I18N:START -->
**Languages:** **English** · [简体中文](docs/i18n/README.zh_CN.md) · [繁體中文](docs/i18n/README.zh_TW.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Français](docs/i18n/README.fr.md) · [Deutsch](docs/i18n/README.de.md) · [Español](docs/i18n/README.es.md) · [Português (Brasil)](docs/i18n/README.pt_BR.md) · [Русский](docs/i18n/README.ru.md) · [العربية](docs/i18n/README.ar.md) · [हिन्दी](docs/i18n/README.hi.md) · [ไทย](docs/i18n/README.th.md) · [Tiếng Việt](docs/i18n/README.vi.md)
<!-- README-I18N:END -->

# Boxing

A hierarchical, infinite-canvas bookmark organizer with beige minimalist design.

Boxing transforms your new tab page into a visual workspace for bookmarks. Instead of flat folders, organize bookmarks into labeled boxes on an infinite canvas — drag, connect, and nest them spatially. Think Obsidian canvas meets bookmarks.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing canvas overview" width="1280">
</picture>

> [!NOTE]
> Replace this placeholder with a real screenshot showing the main canvas with boxes and connections.

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [Privacy](#privacy)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

**Infinite Canvas** — Pan and zoom freely (Ctrl+scroll). Create unlimited boxes on a single canvas. Connect boxes with lines to show relationships. Set parent-child relationships — move a parent and its children follow.

**Two-Level Hierarchy** — Large boxes hold small boxes. Small boxes hold bookmarks. Click into a box to enter its sub-canvas. Breadcrumb navigation shows your path. Nest as deep as needed.

**Bookmark Management** — Each box has its own bookmark collection with list and grid views. Add, edit, delete with a clean dialog. Open in current tab or new tab (configurable). Drag to reorder.

**Connectivity** — Visual SVG connection lines between boxes. Alt+Click a line to delete it (configurable: single-click or double-click). Parent-child movement propagation with elastic boundary clamping.

**Design & Theme** — Beige/cream minimalist aesthetic. Light and dark mode with automatic system detection. Adjustable font size and zoom. Square or rounded corners toggle.

**14 Languages** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi with auto browser-language detection.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Box hierarchy and bookmarks" width="1280">
</picture>

> [!NOTE]
> Replace this placeholder with a real screenshot showing box hierarchy and bookmark management.

## Install

### Chrome / Edge (Chromium)

1. Download the latest [release ZIP](https://github.com/Xxx91n/boxing/releases)
2. Unzip to a folder
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the unzipped folder

### Firefox

1. Download the latest [release XPI](https://github.com/Xxx91n/boxing/releases)
2. Go to `about:addons`
3. Click the gear icon → **Install Add-on From File**
4. Select the downloaded XPI

> [!TIP]
> End users don't need Node.js or npm. Those are only for development.

## Usage

- **Double-click** empty canvas → create a new box
- **Drag** box title bar → move box
- **Ctrl+scroll** → zoom canvas (30% to 200%)
- **Drag** empty canvas → pan
- **Right-click** → go back to parent canvas level
- **Click** a box → enter its sub-canvas
- **Drag** from box edge midpoint → connect to another box
- **Alt+Click** a connection line → delete it
- **Star icon** on a box → mark as parent (children move together)
- **Pin icon** → lock box position
- **Canvas top-right circle button** → unpin header for fullscreen mode

## Privacy

- All data stored locally in `chrome.storage.local` — nothing leaves your device unless you configure optional cloud backup
- Optional WebDAV / GitHub Gist backup is the only outbound network usage
- No analytics, no tracking, no third-party services
- 100% open source (Apache-2.0) — audit every line
- Full privacy policy: [docs/privacy-policy.md](docs/privacy-policy.md)

## Development

### Prerequisites

- Node.js >= 18
- npm

### Setup

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Build

```bash
npm run build     # Dev build → dist/boxing-chrome + dist/boxing-firefox
npm run dev:chrome   # Build + launch Chrome with extension loaded (web-ext)
npm run dev:firefox  # Build + launch Firefox with extension loaded (web-ext)
npm run dev:chrome:no-build   # Fast reload without rebuilding (requires prior build)
npm run dev:firefox:no-build  # Fast reload without rebuilding (requires prior build)
npm test          # Playwright tests (Chrome + Firefox)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

### Quarantined tests

The quarantine program is **converged as of 2026-09-05** (ticket 27): no test titles carry the
`@quarantine` tag anymore. The final 14 entries were repaired by converting their native-input
dispatch to synthetic events (the established repair pattern — the guarded behavior is
app-level, not input realness) and rejoined the Firefox main lane; the only native-input block
kept (double-click selection realness in `boxing-focus-steal.spec.ts`) is chromium-scoped
because native input on the Firefox persistent context stalls (the
[playwright#16095](https://github.com/microsoft/playwright/issues/16095) class). The history:
tags were introduced in architecture-recovery ticket 01, governed since ticket 14, first five
entries repaired at the ticket 18 expiry pass
([.scratch/architecture-recovery/18-quarantine-expiry-report.md](.scratch/architecture-recovery/18-quarantine-expiry-report.md)),
final 14 at ticket 27
([.scratch/architecture-recovery/27-firefox-quarantine-convergence-report.md](.scratch/architecture-recovery/27-firefox-quarantine-convergence-report.md)).

| Test (spec › title) | Chromium | Firefox | Registered | Due (30d) |
| --- | --- | --- | --- | --- |
| *(none — quarantine table empty since ticket 27, 2026-09-05)* | — | — | — | — |

Baseline at convergence: chromium 14/14 and firefox 14/14 pass in the quarantine lane
(2026-09-05, ticket 27); after the tag removal the firefox main lane absorbed all 14 tests and
`npm run test:quarantine` selects 0 tests (exit 0 via `--pass-with-no-tests`).

**Expiry rule.** Every entry must be resolved by its due date — either **repaired** (remove the
`@quarantine` tag + `quarantine-ref` comment, rejoin the Firefox lane, delete the row) or
**retired** (delete the test and the row, recording the decision in the governance ticket).
Entries do **not** auto-extend: at expiry the next governance pass forces the decision, defaulting
to retirement. A newly tagged quarantine must be registered in this table the same day, with
due = registered + 30 days. The quarantine lane is patrolled daily by CI
(`.github/workflows/quarantine.yml`, `continue-on-error`).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and code style.

## License

Apache-2.0 — see [LICENSE](LICENSE)

<!-- README-I18N:START:FOOTER -->
> Translations: [简体中文](docs/i18n/README.zh_CN.md) · [繁體中文](docs/i18n/README.zh_TW.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Français](docs/i18n/README.fr.md) · [Deutsch](docs/i18n/README.de.md) · [Español](docs/i18n/README.es.md) · [Português (Brasil)](docs/i18n/README.pt_BR.md) · [Русский](docs/i18n/README.ru.md) · [العربية](docs/i18n/README.ar.md) · [हिन्दी](docs/i18n/README.hi.md) · [ไทย](docs/i18n/README.th.md) · [Tiếng Việt](docs/i18n/README.vi.md) — see [TRANSLATIONS.md](TRANSLATIONS.md)
<!-- README-I18N:END:FOOTER -->
