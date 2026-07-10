# 🥊 Boxing — Hierarchical Bookmark Manager

**v3.2** · Chrome Extension (MV3) · Firefox compatible

Boxing organizes your bookmarks in a two-level infinite canvas — large boxes hold small boxes, small boxes hold bookmarks. Think Obsidian canvas meets bookmarks.

## ✨ Features (v3.2)

- **Infinite canvas** — Obsidian-style pan & zoom (Ctrl+scroll, zoom buttons, drag pan)
- **Two-level hierarchy** — Large boxes → Small boxes → Bookmarks
- **Drag & drop boxes** — Manual drag with elastic snap alignment
- **Pin boxes** — Lock boxes in place to prevent accidental dragging
- **Auto-expand toggle** — Set boxes to expand only on hover
- **Resizable boxes** — Drag the bottom-right handle
- **Bookmark management** — Add bookmarks via popup (title + URL), edit inline with three-dots button
- **13 languages** — en, zh_CN, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi
- **Settings modal** — In-page overlay for language, font size, zoom, remember-last-position
- **Debug-ready** — DEBUG flag + console logging for troubleshooting
- **Warm neutral design** — Beige-based design system with high readability

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

### v3.2.0 (2026-07-09)
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



### v3.2.0 — July 2026
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
