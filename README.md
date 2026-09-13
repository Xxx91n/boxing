<!-- README-I18N:START -->
**Languages:** **English** · [简体中文](docs/i18n/README.zh_CN.md) · [繁體中文](docs/i18n/README.zh_TW.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Français](docs/i18n/README.fr.md) · [Deutsch](docs/i18n/README.de.md) · [Español](docs/i18n/README.es.md) · [Português (Brasil)](docs/i18n/README.pt_BR.md) · [Русский](docs/i18n/README.ru.md) · [العربية](docs/i18n/README.ar.md) · [हिन्दी](docs/i18n/README.hi.md) · [ไทย](docs/i18n/README.th.md) · [Tiếng Việt](docs/i18n/README.vi.md) — see [TRANSLATIONS.md](TRANSLATIONS.md)
<!-- README-I18N:END -->

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo-dark-theme.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/brand/logo-light-theme.png">
  <img src="docs/brand/logo.png" width="220" height="220" alt="Boxing logo — beige minimalist cube with orange bookmark stripe" />
</picture>

# Boxing

**Your new tab is a spatial bookmark board.** Organize bookmarks into labeled boxes on an infinite, hierarchical canvas — drag, connect, and nest them spatially.

<p>
  <a href="#install">Install</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#what-makes-it-different">Why</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="docs/store-publishing-plan.md">Store rollout</a>
</p>

<p>
  <a href="https://github.com/Xxx91n/boxing/releases/latest"><img alt="Latest published release: v2026.9.11 on GitHub Releases" src="https://img.shields.io/badge/Latest_published-v2026.9.11-brightgreen?style=for-the-badge&logo=github" /></a>
  <a href="https://microsoftedge.crxsoso.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi"><img alt="Edge Add-ons — published" src="https://img.shields.io/badge/Edge_Add--ons-Published-0C88C5?style=for-the-badge&logo=microsoftedge&logoColor=white" /></a>
  <a href="https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/"><img alt="Firefox Add-ons — published" src="https://img.shields.io/badge/Firefox_Add--ons-Published-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white" /></a>
</p>

<p>
  <a href="https://github.com/Xxx91n/boxing/releases/tag/v2026.9.11"><img alt="Latest published release: v2026.9.11 (tag; code baseline at v2026.9.11 — newer builds ship only after the G-A/G-B/G-C release gate)" src="https://img.shields.io/badge/latest_published_release-v2026.9.11-orange?style=flat-square" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/Xxx91n/boxing?style=flat-square" /></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-orange?style=flat-square" />
  <img alt="Languages" src="https://img.shields.io/badge/i18n-14%20languages-brightgreen?style=flat-square" />
</p>

</div>

Think Obsidian canvas meets bookmarks.

**Proof — the new tab page, out of the box:**

<p align="center">
  <img src="docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing new tab page: dotted infinite canvas with top bar for search, box count, add, sync and theme controls" width="1280">
</p>

## What Makes It Different

**Infinite Canvas** — Pan and zoom freely (Ctrl+scroll). Create unlimited boxes on a single canvas. Connect boxes with lines to show relationships. Set parent-child relationships — move a parent and its children follow.

**Two-Level Hierarchy** — Large boxes hold small boxes. Small boxes hold bookmarks. Click into a box to enter its sub-canvas. Breadcrumb navigation shows your path. Nest as deep as needed.

**Bookmark Management** — Each box has its own bookmark collection with list and grid views. Add, edit, delete with a clean dialog. Open in current tab or new tab (configurable). Drag to reorder.

**Connectivity** — Visual SVG connection lines between boxes. Alt+Click a line to delete it (configurable: single-click or double-click). Parent-child movement propagation with elastic boundary clamping.

**Design & Theme** — Beige/cream minimalist aesthetic. Light and dark mode with automatic system detection. Adjustable font size and zoom. Square or rounded corners toggle.

**14 Languages** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi with auto browser-language detection.

## Screenshots

| Canvas | Boxes & Bookmarks | Connections |
|--------|-------------------|-------------|
| ![Canvas overview](docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Box hierarchy](docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Connection lines](docs/store-assets/screenshots/screenshot-3-connections.png) |

| Settings | Bookmark Editing |
|----------|------------------|
| ![Settings panel](docs/store-assets/screenshots/screenshot-4-settings.png) | ![Bookmark dialog](docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Brand Assets

Light/dark logos, extension icons, favicons, store tiles, and the variants showcase are vendored in [`docs/brand/`](docs/brand/) (24 files, from the `box_png` asset kit). Reuse these for store listings, docs, and the GitHub social preview.

## Install

> [!IMPORTANT]
> **Install from official store pages** (recommended). GitHub Releases are a **user-facing
> changelog** and optional source/sideload zips — they **no longer ship `.xpi` / `.crx`**.
> Version **2026.9.12** store packages are prepared for AMO / Edge upload by the publisher;
> the **latest published store version remains 2026.9.11** until you finish those submissions.
> Gate background: [ADR-0017](docs/adr/0017-release-data-gate.md). Publisher workflow:
> [publishing guide](docs/publishing-guide.md) · [store plan](docs/store-publishing-plan.md).

### Firefox（正式安装）

1. 打开 [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/)
2. 点击 **Add to Firefox**，按浏览器提示完成安装

### Edge / Chromium（正式安装）

1. 打开 [Edge Add-ons — Boxing](https://microsoftedge.crxsoso.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. 点击 **Get** / **获取** 完成安装（Chromium 系请使用 Edge 商店页面）

### 开发者：从源码构建

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge：`chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选 `dist/boxing-chrome/`
- Firefox：`about:debugging#/runtime/this-firefox` → **临时载入附加组件** → 选 `dist/boxing-firefox/manifest.json`

> [!NOTE]
> 构建产物 zip 供**商店上传或本地调试**，不是用户正式安装渠道。正式安装请走上方商店链接。
> 签名由商店完成；本仓 GitHub Release **不再**分发 `.xpi` / `.crx`。

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
- **WebDAV targets must be public HTTPS endpoints.** Private, loopback, and link-local hosts are refused by design: `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16` (including the cloud metadata address `169.254.169.254`), `172.16.0.0/12`, `*.local`, and `*.internal`.
  - **Why:** a WebDAV URL you enter is later fetched by the extension background proxy. Allowing private addresses would turn a mistyped or hand-supplied URL into a request originating from inside your network (SSRF-style exposure) — router admin pages, NAS interfaces, cloud metadata endpoints — so the refusal is unconditional rather than a warning.
  - **Also refused:** non-HTTPS URLs, URLs longer than 2048 characters, and URLs with an embedded username/password. The check runs in the settings UI and again in the background proxy before any request leaves the browser.
  - **Self-hosted WebDAV on your LAN or on `localhost` is refused by default and can be allowed by an explicit opt-in:** Settings → Sync → WebDAV → *Allow private / local network hosts (advanced)*. The checkbox ships off. Turning it on relaxes the private-host refusal above and nothing else — the HTTPS requirement, the no-embedded-credentials rule, and the 2048-character URL limit all still apply.
  - **Why the opt-in is explicit:** enabling it removes the only barrier between a mistyped or hand-supplied URL and a request that Boxing issues from inside your network, addressed to router admin pages, NAS interfaces, or cloud metadata endpoints such as `169.254.169.254`. Enable it only for a server you own, and prefer a name you control on a public HTTPS endpoint wherever that option exists.
- No analytics, no tracking, no third-party services
- **Credential storage is obfuscation, not user-keyed encryption:** WebDAV passwords and GitHub tokens are wrapped in an AES-GCM envelope whose key is derived from a **random per-install key** that is generated on first use and never leaves your browser profile — it is not part of the layout, JSON exports, WebDAV/Gist backups, or snapshots, so a copy of an export or backup read in isolation cannot unlock it. The key does live in `chrome.storage.local` next to the ciphertext, so anyone who can read your browser profile (or the running extension) can still recover your credentials. Boxing never asks for a passphrase and holds no user-supplied key.
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

## Testing governance

The quarantine register, its expiry rule, and the host-environment incident register are no longer
inlined in this product-facing entry: they are English-only governance records (all 13 localized
READMEs omit them) that carried agent work-log paths.

See [docs/testing-governance.md](docs/testing-governance.md).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and code style.

New to the repository? [docs/START-HERE.md](docs/START-HERE.md) routes users, contributors, and agents to the right entry point.

## License

Apache-2.0 — see [LICENSE](LICENSE)
