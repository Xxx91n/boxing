# Store Listing

## Short Description (132 chars max)

> A hierarchical, infinite-canvas bookmark organizer with beige minimalist design. Organize bookmarks into labeled boxes with list and grid views.

## Detailed Description

Boxing transforms your new tab page into a visual, infinite-canvas workspace for your bookmarks. Instead of flat folders and lists, organize your bookmarks into labeled boxes on an infinite canvas — drag, connect, and nest them exactly how you think.

### Features

**Infinite Canvas**
- Pan and zoom freely with Ctrl+scroll
- Create unlimited boxes on a single canvas
- Connect boxes with lines to show relationships
- Set parent-child relationships — move a parent box and its children follow
- Double-click empty space to create a new box
- Right-click to go back to the parent canvas level

**Bookmark Management**
- Each box contains its own bookmark collection with list and grid views
- Add, edit, and delete bookmarks with a clean dialog
- Open bookmarks in current tab or new tab (configurable)
- Custom bookmark titles, URLs, and descriptions
- Drag bookmarks to reorder within boxes

**Hierarchical Organization**
- Boxes can contain their own sub-canvas — click into a box to enter its space
- Breadcrumb navigation shows your path through the hierarchy
- Nest canvases as deep as you need
- Each level is fully independent and isolated

**Design & Theme**
- Beige/cream minimalist aesthetic — calm and distraction-free
- Light and dark mode with automatic system detection
- Adjustable font size and zoom levels
- Smooth SVG-based connection lines
- Rounded corner option for boxes

**Privacy First**
- All data stored locally — nothing leaves your device
- Optional WebDAV cloud backup (your server, your control)
- Optional GitHub Gist backup
- No analytics, no tracking, no third-party services
- 100% open source (Apache-2.0) — audit the code yourself

**Connectivity**
- Connection delete via Alt+Click (configurable: also single-click or double-click)
- Visual connection lines between boxes
- Parent-child movement propagation

### Permissions Explained

| Permission | Why We Need It |
|------------|---------------|
| `storage` | Store your bookmarks, layout, and settings locally |
| `tabs` | Open bookmarks in new tabs when configured |
| `optional_host_permissions (Chrome)` | Request access to your WebDAV server only when you configure cloud backup |
| `host_permissions (Firefox)` | Same — access to your WebDAV server for cloud backup |

**We do NOT request:** browsing history, downloads, clipboard, content settings, or any permission that accesses your browsing activity.

### Use Cases

- Research project organization — one canvas per project, boxes per topic
- Bookmark collection management — organize years of saved links visually
- Knowledge mapping — connect related resources in a spatial layout
- Quick access dashboard — pin your most-used bookmarks on the new tab page

### Technical

- Vanilla JavaScript — no frameworks, no bundlers, no external runtime dependencies
- Works on Chrome, Edge, Firefox, and other Chromium-based browsers
- Manifest V3 compatible
- Open source: [https://github.com/Xxx91n/boxing](https://github.com/Xxx91n/boxing)

### License

Apache-2.0
