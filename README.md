# Boxing v3.1 — Hierarchical Bookmark Organizer

A beige, minimalist browser extension (Chrome & Firefox) that organizes bookmarks into hierarchical boxes with an infinite-canvas layout. MV3-native, zero dependencies.

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Dual-Level Hierarchy** | Large boxes contain small boxes; small boxes hold bookmarks |
| 2 | **Infinite Canvas** | Drag, arrange, resize boxes with magnetic snap-to-grid |
| 3 | **Double-Click Create** | Dblclick canvas → new large box; dblclick inner → new small box |
| 4 | **Resizable Boxes** | Drag bottom-right corner to resize any box (large: 200+, small: 140+) |
| 5 | **Zoom Controls** | Per-surface zoom (50%–150%), stored per surface |
| 6 | **Remember Last Position** | Optionally auto-reopen last visited large box on new tabs |
| 7 | **Auto-Numbered Boxes** | Large boxes auto-named "Box 1", "Box 2"… in sequence |
| 8 | **Settings Modal** | In-page overlay: language, remember pos, zoom slider |
| 9 | **13-Language i18n** | en, zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi |
| 10 | **Keyboard Shortcuts** | `/` search, `Esc` back/close, right-click return |
| 11 | **Manual Bookmark Input** | Paste URL directly into small boxes |
| 12 | **List/Grid Views** | Toggle between compact list and 3-column grid |

## Quick Start

### Chrome / Edge

1. Open `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select the `boxing` directory
3. Open a new tab → Boxing replaces your new tab page

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** → select `manifest.json`
3. Open a new tab → Boxing is active

## Architecture

```
boxing/
├── manifest.json            # MV3 config, permissions: storage, tabs
├── background.js            # Minimal service worker
├── ntp/
│   ├── index.html           # New tab shell (settings modal inline)
│   ├── ntp.js               # Core engine: render, drag, resize, zoom, i18n store
│   ├── ntp.css              # Layout, box, modal, zoom, resize styles
│   └── design-system.css    # CSS token system (beige palette)
├── popup/
│   ├── popup.html/css/js    # Toolbar popup (recent bookmarks)
├── _locales/                # 13-language i18n messages
├── icons/                   # Extension icons (48px, 128px)
├── docs/superpowers/        # Design specs and plans
├── .codegraph/              # Codebase index
└── README.md
```

## Design Tokens

| Token | Value | Role |
|-------|-------|------|
| `--color-canvas` | `#F4EFE5` | Main beige background |
| `--color-elevated` | `#EDE5D8` | Card/hover layer |
| `--color-ink` | `#2A2520` | Primary text |
| `--color-accent` | `#B05D3C` | Terracotta interactive |
| `--radius-card` | `18px` | Box container radius |
| `--radius-tile` | `12px` | Small element radius |

## Data Model

### Layout (persisted to `chrome.storage.sync`)

```ts
{
  version: 3,
  boxes: LargeBox[],
  nextLargeIndex: number,
  lastLargeBoxId: string | null,
  settings: {
    selectedLanguage: string,  // 'en' | 'zh_CN' | …
    rememberLastPos: boolean,
    zoomLevel: number          // 0.5–1.5
  }
}
```

### LargeBox / SmallBox

```ts
LargeBox {
  id, title, x, y, width, height, nextSmallIndex, children: SmallBox[]
}
SmallBox {
  id, title, x, y, width, height, pinned, displayMode, bookmarks: Bookmark[]
}
```

## Limits

| Constraint | Value |
|------------|-------|
| Max large boxes | 1000 |
| Max small boxes per large box | 500 |
| Max bookmarks per small box | 50 |
| Min box size (large) | 200×120 |
| Min box size (small) | 140×100 |
| Zoom range | 50%–150% |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search (canvas mode) |
| `Esc` | Close modal / clear search / return to canvas |
| Right-click | Return to canvas from inner view |

## Debug

Boxing logs to the browser console with `[Boxing]` prefix when `DEBUG = true` (default). Open DevTools on the new tab page to inspect state, errors, and layout persistence.

To toggle debug off, set `const DEBUG = false` at line 19 of `ntp/ntp.js`.

## Browser Support

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 100+ | MV3, full support |
| Edge | 100+ | Chromium-based, identical |
| Firefox | 109+ | MV3 via `browser_specific_settings` |

## Development

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
- Permissions: `storage`, `tabs` only

## License

MIT

## Changelog

### v3.1.0 (2026-07-09)
- Full NTP rewrite: settings modal, zoom controls, resize handles, dblclick create
- Custom i18n store supporting 13 languages with runtime switching
- Auto-numbered box naming, remember-last-position
- Edge clamping during drag, mousedown-propagation fix for title editing
- Canvas zoom per-surface, resize snap-to-grid
- MV3 manifest cleanup, bookmarks permission removed
- Debug logging system, codegraph index

### v2.0.0
- Dual-level boxes, infinite canvas, drag/snap, list/grid, i18n, storage

### v1.0.0
- Initial scaffold: beige design system, MV3 skeleton



### v3.1.0 — July 2026
- **Obsidian-style infinite canvas**: CSS transform(translate+scale) pan/zoom; left-drag pan, Ctrl+scroll zoom at point, Ctrl+/- step zoom
- **Manual drag**: Replaced HTML5 drag API with mousedown/mousemove/mouseup for real-time mouse-following (no jump-to-corner bug)
- **Title-only edit zone**: Title bars block drag and click-through; only text editing allowed on titles
- **Elastic snap**: Box collision detection sorts to nearest non-overlapping edge rather than returning to original position
- **Font size control**: Settings slider adjusts --font-size-base CSS variable (11–20px)
- **Bookmark CRUD**: Each bookmark row has a three-dots edit button (inline popup for title+URL editing); + button adds new bookmarks
- **Removed list/grid toggle**: Small boxes always use list mode
- **Redesigned color palette**: Lower saturation warm-neutral (less red-brown, higher clarity)
- **Removed brand__mark**: Deleted the brown color block from the header
- **i18n sync**: All 13 languages updated with new keys (fontSizeLabel, editBookmarkLabel, bookmarkTitlePlaceholder, bookmarkUrlPlaceholder, smallBoxCountLabel)
- **Agent.md**: Added Boxing Project Specialization with i18n and development rules
