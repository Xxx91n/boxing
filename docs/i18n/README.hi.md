<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · **हिन्दी** · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

> [!WARNING]
> **Translation in progress.** This file currently mirrors the English README. If you can help translate to Hindi, see [TRANSLATIONS.md](../../TRANSLATIONS.md).


# Boxing

A hierarchical, infinite-canvas bookmark organizer with beige minimalist design.

Boxing transforms your new tab page into a visual workspace for bookmarks. Instead of flat folders, organize bookmarks into labeled boxes on an infinite canvas — drag, connect, and nest them spatially. Think Obsidian canvas meets bookmarks.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing canvas overview" width="1280">
</picture>

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Brand Assets](#brand-assets)
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
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Box hierarchy and bookmarks" width="1280">
</picture>

## Screenshots

| Canvas | Boxes & Bookmarks | Connections |
|---|---|---|
| ![Canvas](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Boxes & Bookmarks](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Connections](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Settings | Bookmark Editing |
|---|---|
| ![Settings](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Bookmark Editing](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Brand Assets

Light/dark logos, extension icons, favicons, store tiles, and the variants showcase are vendored in [`docs/brand/`](../../docs/brand/) (24 files, from the `box_png` asset kit). Reuse these for store listings, docs, and the GitHub social preview.

## Install

> [!TIP]
> Ready-to-use packages are published on GitHub Releases: the [latest release](https://github.com/Xxx91n/boxing/releases/latest) ships `boxing-chrome-<version>.zip` / `.crx`, `boxing-firefox-<version>.zip` / `.xpi`, and `SHA256SUMS.txt`. Store listings are still rolling out (Edge in progress, Chrome Web Store deferred, no public AMO listing) — the release `.xpi` is the self-hosted Firefox install path.

### Chrome / Edge (Chromium)

**From the release package (no build tools needed)**

1. Download `boxing-chrome-<version>.zip` from the [latest release](https://github.com/Xxx91n/boxing/releases/latest) and unzip it
2. Go to `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the unzipped `boxing-chrome/` folder

**From source**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**From the release package**

1. Download `boxing-firefox-<version>.xpi` from the [latest release](https://github.com/Xxx91n/boxing/releases/latest) and open it in Firefox — AMO-signed builds install directly; unsigned builds load only in Firefox Developer Edition/Nightly
2. Or download `boxing-firefox-<version>.zip`, unzip it, go to `about:debugging#/runtime/this-firefox`, and click **Load Temporary Add-on...** pointing at the unzipped `manifest.json`

**From source**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Node.js and npm are only required for the from-source build; installing from the GitHub release package needs neither. Once the store listings are live, end-user installs are one click.

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
- Full privacy policy: [docs/privacy-policy.md](../../docs/privacy-policy.md)

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
npm test          # Playwright tests (Chrome + Firefox)
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full development guide.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for setup, workflow, and code style.

## License

Apache-2.0 — see [LICENSE](../../LICENSE)
