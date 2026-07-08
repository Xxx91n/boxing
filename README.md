# Boxing — Hierarchical Bookmark Organizer

A beige, minimalist browser extension for Chrome & Firefox that organizes bookmarks into hierarchical boxes with infinite-canvas layouts.

## Features

- **📦 Two-Level Hierarchy** — Organize bookmarks into large boxes, then small boxes within each large box
- **♾️ Infinite Canvas** — Drag, arrange, and organize boxes with magnetic snap-to-grid alignment
- **🎨 Beige Minimalist Design** — Modern, clean aesthetic with warm terracotta accents
- **👁️ Flexible Display** — Switch between list and grid views for bookmark containers
- **📝 Editable Names** — Rename large and small boxes directly
- **⌨️ Keyboard Shortcuts** — Right-click to return to parent level; `/` to search
- **🌍 Multi-Language** — i18n support for global users
- **⚡ Zero Dependencies** — Pure vanilla JavaScript, no frameworks

## Quick Start

### Chrome / Edge

1. Clone this repo or download the source
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select this `boxing` directory
6. Open a new tab → see your organized bookmarks

### Firefox

1. Clone this repo or download the source
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `manifest.json`
5. Open a new tab → see your organized bookmarks

### Development with web-ext

```bash
# Install dependencies
npm install
# Or use web-ext directly
npm run dev:firefox
```

## Architecture

### Directory Structure

```
boxing/
├── manifest.json          # MV3 extension config
├── background.js          # Service worker
├── ntp/
│   ├── index.html        # New tab page
│   ├── ntp.js            # Bookmark rendering + hierarchy logic
│   ├── ntp.css           # NTP styles
│   └── design-system.css # Color tokens & variables
├── popup/
│   ├── popup.html        # Extension popup
│   ├── popup.js          # Recent/favorite bookmarks
│   └── popup.css         # Popup styles
├── options/
│   ├── options.html      # Settings page
│   ├── options.js        # Preferences manager
│   └── options.css       # Settings styles
├── i18n/
│   ├── en.json          # English strings
│   ├── zh-CN.json       # Simplified Chinese
│   └── ...              # Additional languages
├── docs/                 # Documentation
├── icons/                # Extension icons (48px, 128px)
└── README.md            # This file
```

### Design System

**Colors:**
- **Canvas (Beige)**: `#F4EFE5` — Main background
- **Accent (Terracotta)**: `#B05D3C` — Interactive elements
- **Ink**: `#2A2520` — Text color
- **Muted**: `#7B7167` — Secondary text

**Spacing**: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px  
**Radius**: 12px (tile), 18px (card), 999px (pill)

### Key Concepts

1. **Large Boxes** — First-level containers that hold small boxes
   - Have infinite canvas within
   - Editable names
   - Can be dragged and positioned
   - Fixed size with magnetic snap

2. **Small Boxes** — Second-level bookmark containers
   - Can be pinned (always expanded) or hover-to-expand
   - Display bookmarks as lists or grids
   - Can be dragged by title bar only
   - Fixed size prevents overlap; others snap adjacent

3. **Infinite Canvas** — Zoomable/pannable workspace
   - Allows unlimited repositioning
   - Magnetic snap-to-grid for alignment
   - Exclusive area protection (boxes don't overlap)

## Browser Support

| Browser | Status | Version |
|---------|--------|---------|
| Chrome  | ✅ Supported | 100+ |
| Edge    | ✅ Supported | 100+ |
| Firefox | ✅ Supported | 109+ |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `↑` `↓` | Navigate items |
| `Enter` | Open selected bookmark |
| `Esc` | Clear search / close popup |
| Right-click | Return to parent level |

## Development Workflow

### Build for Firefox (with web-ext)

```bash
npm run dev:firefox          # Dev with hot reload
npm run build:firefox       # Build for submission
npm run lint                # Lint manifest
npm test                    # Run tests
```

### Testing

```bash
npm test                    # Run Playwright tests
npm run test:firefox        # Firefox-specific tests
```

## Privacy & Security

- **Local-only**: All bookmarks processed on-device, no cloud sync
- **Minimal permissions**: Only `bookmarks`, `storage`, `tabs`
- **No tracking**: No analytics, no phoning home
- **Open source**: Code auditable on GitHub

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/xyz`)
3. Make your changes
4. Test thoroughly (especially cross-browser)
5. Submit a PR

## License

MIT — See LICENSE file

## Acknowledgments

Built with ☕ for bookmark enthusiasts who value simplicity and beauty.
