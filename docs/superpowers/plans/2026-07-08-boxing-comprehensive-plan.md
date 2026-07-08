# Boxing Extension — Comprehensive Implementation Plan

**Status**: Phase 1-4 ✅ Complete | Phase 5 (Testing & Polish) 🔧

---

## Phase 1: Foundation & Setup ✅

- [x] Directory renamed: `qlearly_bookmark-0.0.2` → `boxing`
- [x] Manifest ID updated (new Firefox gecko UUID: `{2F5A8F1E-9B3C-4D7E-A2B1-6F4C8E9D3A7F}`)
- [x] Git initialized + `.gitignore`, `LICENSE`, `README.md` complete
- [x] `opencode.json` configured
- [x] UI fixes: back button (left-top), settings button (opens options), consistent header styling
- [x] Brand rename: "Qlearly" → "Boxing" across popup/options/NTP

---

## Phase 2: Dual-Level Hierarchy & Infinite Canvas ✅

### Implemented Architecture

**Level 1: Large Boxes** (`ntp/ntp.js` + `ntp/ntp.css`)
- Fixed size: 320×220px, draggable via header bar only
- Infinite 2D canvas with CSS grid background pattern (24px grid)
- Editable title (`contenteditable`) with blur-to-save
- Click body/title → drill into inner canvas
- Reserved space: collision detection + magnetic snap-to-grid
- Ghost preview during drag with magnet guide lines

**Level 2: Small Boxes** (inside large box)
- Fixed size: 200×140px, draggable via title bar only
- Inner canvas with 16px finer grid
- Pinned/unpinned toggle (📌/📍) — currently UI toggle only
- Bookmark list/grid rendered inside
- Editable title, delete button
- Collision resolution: push right then down on grid

### Implementation Tasks Completed

1. **Canvas Infrastructure** ✅
   - [x] Canvas container in NTP HTML (`#canvas`, `#canvas-surface`)
   - [x] Grid coordinate system (24px outer, 16px inner)
   - [x] Magnet guide overlay (vertical/horizontal lines)
   - [x] Empty state with CTA

2. **Large Box Rendering** ✅
   - [x] `.large-box` template with header bar, title, meta, delete
   - [x] Drag handle on bar only (`draggable="true"`)
   - [x] Click handler → enter inner view
   - [x] `contenteditable` title with save-on-blur
   - [x] Chip preview of child small boxes (max 8 + "+N")

3. **Small Box Rendering** ✅
   - [x] `.small-box` template with title bar (drag handle only)
   - [x] Pinned/unpinned toggle button
   - [x] List mode (vertical) / Grid mode (2-col) rendering
   - [x] `contenteditable` title, delete button

4. **Drag & Drop Logic** ✅
   - [x] `dragstart` / `drag` / `dragend` on bars
   - [x] Ghost element follows cursor
   - [x] Magnetic snap: `snapCanvas()` (24px) / `snapInner()` (16px)
   - [x] Collision resolution: `resolveCanvasCollision()` / `resolveInnerCollision()`
   - [x] Adjacent push (right then down)

5. **State Management** ✅
   - [x] Data structure: `{ id, title, type, x, y, width, height, children[], pinned, displayMode, bookmarks[] }`
   - [x] Persist to `chrome.storage.sync` (`boxingLayout` key) after every mutation
   - [x] Restore on NTP reload (`loadLayout()` → `renderCanvas()`)

---

## Phase 3: Display Modes & Editing ✅

- [x] View-mode toggle button (header + inner header) — list ↔ grid
- [x] List mode: vertical stack with favicon dot + title
- [x] Grid mode: 2-column tile layout
- [x] Inline edit via `contenteditable` on titles (Enter/Escape handled)
- [x] Save renamed title to storage immediately on blur

---

## Phase 4: Enhanced Interactions ✅

- [x] Right-click context menu → back to parent level (canvas or inner)
- [x] Fixed size & exclusion: boxes never overlap; collision pushes to next grid cell
- [x] Pinned/unpinned toggle UI (persisted in layout)
- [x] i18n Support: **Chrome MV3 `_locales` structure**
  - [x] `_locales/en/messages.json`
  - [x] `_locales/zh_CN/messages.json`
  - [x] `_locales/ja/messages.json`
  - [x] `chrome.i18n.getMessage()` in JS + `data-i18n` attributes in HTML
  - [x] Auto-applied on init via `applyI18n()`

---

## Phase 5: Testing & Polish 🔧

### Pending

1. [ ] Playwright tests:
   - [ ] Load NTP → verify large box renders
   - [ ] Click large box → enter inner canvas
   - [ ] Drag small box → verify snap-to-grid
   - [ ] Right-click → return to parent
   - [ ] Edit title → persists after reload

2. [ ] Cross-browser validation:
   - [ ] Chrome: load unpacked → full workflow
   - [ ] Firefox: load temporary add-on → full workflow

3. [ ] Performance:
   - [ ] Benchmark with 100+ small boxes
   - [ ] Optimize drag (currently uses ghost clone; could use `transform`)
   - [ ] Debounce storage writes (currently immediate)

4. [ ] Polish:
   - [ ] Smooth animations (transitions in place)
   - [ ] Hover states (shadow lift implemented)
   - [ ] Mobile responsiveness (basic media queries in CSS)
   - [ ] Favicon loading for bookmarks (currently placeholder dot)
   - [ ] Unpinned hover-expand behavior (currently just pinned toggle)

---

## Actual Data Structure (Implemented)

```json
{
  "version": 2,
  "boxes": [
    {
      "id": "large-1720456789012",
      "type": "large",
      "title": "Work",
      "x": 20,
      "y": 20,
      "width": 320,
      "height": 220,
      "children": [
        {
          "id": "small-1720456790001",
          "type": "small",
          "title": "Dev Resources",
          "x": 20,
          "y": 20,
          "width": 200,
          "height": 140,
          "pinned": true,
          "displayMode": "list",
          "bookmarks": [
            { "url": "https://github.com", "title": "GitHub" },
            { "url": "https://stackoverflow.com", "title": "Stack Overflow" }
          ]
        }
      ]
    }
  ]
}
```

---

## CSS Class Map (Implemented)

| Class | Purpose |
|-------|---------|
| `.canvas` / `.canvas__surface` | Top-level infinite canvas |
| `.canvas__guides` / `.canvas__guide` | Magnet guide lines |
| `.large-box` | Draggable large box (fixed 320×220) |
| `.large-box__bar` | Drag handle + title + actions |
| `.large-box__title` | Editable title |
| `.large-box__body` | Chip preview / empty hint |
| `.inner` / `.inner__surface` | Drill-in canvas |
| `.small-box` / `.small-box--list` / `.small-box--grid` | Small box with mode variants |
| `.small-box__bar` | Drag handle (only this area) |
| `.small-box__title` | Editable title |
| `.small-box__mode` | Pinned toggle |
| `.small-box__body` | List/grid bookmark container |
| `.bm-row` | Single bookmark row |
| `.bm-empty` | Empty state |

---

## File Summary (Core)

| File | Role |
|------|------|
| `manifest.json` | MV3, Chrome+Firefox, gecko ID, permissions |
| `background.js` | Minimal service worker |
| `ntp/index.html` | NTP shell: header, canvas, inner, footer |
| `ntp/ntp.css` | Full beige design system + canvas/box styles |
| `ntp/ntp.js` | All logic: render, drag, storage, i18n, keyboard |
| `ntp/design-system.css` | Color/spacing/typography tokens |
| `_locales/{en,zh_CN,ja}/messages.json` | i18n strings |
| `popup/*.html|js|css` | Quick access (legacy Qlearly → Boxing rename) |
| `options/*.html|js|css` | Settings page (legacy rename) |

---

## Milestones (Actual)

| Milestone | Status |
|-----------|--------|
| Phase 1: Foundation | ✅ Done |
| Phase 2: Dual-level canvas | ✅ Done |
| Phase 3: List/grid + edit | ✅ Done |
| Phase 4: Interactions + i18n | ✅ Done |
| Phase 5: Tests + polish | 🔧 Pending |
| **Release Candidate** | **Ready for manual validation** |

---

## Known Risks & Mitigations (Updated)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas performance with 100+ boxes | Medium | Current ghost-clone drag is simple; could switch to `transform` + `requestAnimationFrame` |
| Storage sync latency | Low | Immediate writes; debounce (500ms) easy to add |
| Drag edge cases (overlap at boundaries) | Low | Collision resolution pushes right then down; works for typical usage |
| i18n maintenance | Low | 3 locales, ~25 keys; JSON + `getMessage()` scales fine |
| Firefox `browser.i18n` vs `chrome.i18n` | Low | Wrapper `i18n(key)` handles both |

---

## Next Immediate Actions

1. **Manual validation**: Load unpacked in Chrome → new tab → create boxes → drag → edit → right-click back → reload → verify persistence
2. **Firefox validation**: `about:debugging` → Load Temporary Add-on → same flow
3. **Playwright test scaffolding** (if CI needed)
4. **Polish**: favicon loading, unpinned hover-expand, debounced storage

---

**Plan owner**: Boxing Contributors  
**Last updated**: 2026-07-08  
**Status**: Core implementation complete — ready for cross-browser validation