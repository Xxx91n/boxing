# Store Listing Screenshots

Screenshots for the Chrome Web Store and AMO listings. Prerequisite for
regeneration: a built `dist/boxing-chrome/` (run `npm run build` first).

All images are 1280x800 PNG captures of the Boxing new tab page, taken via
Playwright. To regenerate:

```bash
node test/tests/take-store-screenshots.mjs
```

## Required Screenshots

| File | Content |
|------|---------|
| `screenshot-1-canvas.png` | Main canvas view — show the infinite canvas with several boxes |
| `screenshot-2-boxes.png` | Box detail — show a box with bookmarks in list/grid view |
| `screenshot-3-connections.png` | Connection lines — show boxes linked with parent-child connections |
| `screenshot-4-settings.png` | Settings panel — show the settings/modal with theme, font, zoom options |
| `screenshot-5-bookmarks.png` | Bookmark editing — show the bookmark add/edit dialog |

## Specifications

- **Size:** 1280x800 pixels (Chrome Web Store requirement)
- **Format:** PNG with transparency
- **Chrome Web Store:** minimum 1, maximum 5 screenshots
- **AMO:** minimum 1 screenshot, up to 5 recommended

## How to Replace

1. Take a screenshot of the extension in your browser
2. Crop/resize to 1280x800
3. Save under the same filename
4. `git add docs/store-assets/screenshots/ && git commit`
