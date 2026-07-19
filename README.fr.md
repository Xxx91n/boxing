# 🥊 Boxing — organiser les favoris hiérarchiquement

**Languages:** [English](README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Français** · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md)

### organiser les favoris hiérarchiquement

> Cliquez ＋ pour créer une grande boîte

> Français README — canonical feature list and technical specs are in the [English README](README.md).

---

## ✨ Features

- **Infinite canvas** — Obsidian-style pan & zoom (Ctrl+scroll, zoom buttons, drag pan) with 30% boundary clamping
- **Two-level hierarchy** — Large boxes → Small boxes → Bookmarks
- **Drag & drop boxes** — Manual drag with elastic iterative snap alignment
- **Pin boxes** — Lock boxes in place to prevent accidental dragging
- **Auto-expand toggle** — Set boxes to expand only on hover
- **Resizable boxes** — Drag the bottom-right handle
- **Bookmark management** — Add bookmarks via popup (title + URL), edit inline with three-dots button, right-click edit
- **14 languages** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi with auto browser-language detection
- **Settings modal** — In-page overlay with tabbed layout (General / Appearance / Data / Sync & Backup)
- **Dark mode** — Full dark theme toggle, visually comprehensive across all elements
- **Header auto-hide** — Default pinned header; toggle for fullscreen immersive canvas
- **Export / Import** — Backup data to JSON, restore from file
- **Debug-ready** — DEBUG flag + console logging for troubleshooting
- **Warm neutral design** — Beige-based design system with high readability and adjustable font size
- **Square/rounded corners** — Settings toggle for corner style

## Development

### Syntax Check
```bash
node --check ntp/ntp.js
```

### Playwright Testing
```bash
cd ../playwright
npm test                    # All browsers
npm run test:firefox        # Firefox-specific
```

### web-ext (Firefox)
```bash
npm run dev:firefox         # Hot-reload dev
npm run build:firefox       # Package .xpi
npm run lint                # Manifest validation
```

## Privacy

- All data stored locally in `chrome.storage.sync`
- No network requests (except loading `_locales/` from extension bundle)
- No analytics, tracking, or third-party services
- Permissions: `storage`, `tabs`, `bookmarks`

## License

GPL-3.0 (see [LICENSE](LICENSE))

## Changelog

### v3.6.0 (2026-07-10)
- Box drag clamp: boxes now constrained to visible canvas area with edge-snap
- Elastic snap rewritten with while-loop for complete overlap resolution
- Dark mode comprehensive fix: body/html now dark, all edges covered, settings synced
- Header pin defaults ON: header visible, button on bar; toggle for fullscreen animation
- Small boxes now rounded (border-radius: var(--radius-card)) matching large boxes
- All i18n gaps fixed: smallBoxCountLabel, bookmark placeholders, settings nav labels — all 13 locales
- Remember-last-position now saves/restores zoom + pan for both canvas and inner surfaces
- New i18n keys: settingsNavGeneral/Appearance/Data/Sync, syncProviderHint — all locales translated
- Tests: boxing-v3.spec.ts 10/10 passing, updated for current version

### v3.5.0 (2026-07-10)
- Canvas boundary clamp at 30% zoom, inner canvas pan support
- Dark mode comprehensive UI adaptation, header autohide fullscreen mode
- Settings tabbed layout (General/Appearance/Data/Sync & Backup)
- Bookmark right-click edit, URL open fix for all browsers
- Square corners toggle, 9 new i18n keys, small box bar enlarged

### v3.4.0 (2026-07-10)
- Background clarity (colors lighter/less saturated)
- Dark mode initial, in-page delete confirm, settings modal enlarged
- Export/Import data, header autohide default ON, 12 new i18n keys

### v3.3.0 (2026-07-10)
- Browser language auto-detect, header auto-hide on scroll
- Pin/expand buttons redesigned, small box default size 640×420
- Elastic snap iterative, box index recycling, auto-expand transition

### v2.0.0
- Dual-level boxes, infinite canvas, drag/snap, list/grid, i18n, storage

### v1.0.0
- Initial scaffold: beige design system, MV3 skeleton

