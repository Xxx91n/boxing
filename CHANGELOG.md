# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.7.0] - 2026-07-26

### Added
- SVG connection layer: self-drawn `<line>` elements replace LeaderLine vendor lib (BX-142)
- Edge-midpoint drag-to-connect: mousedown on 4 edge anchors, drag to target box, mouseup connects
- Star-mark parent boxes: group drag moves members together with elastic boundary clamp (BX-143)
- Vietnamese (vi) + Chinese Traditional (zh_TW) i18n — 14 locales total
- WebDAV cloud backup with runtime permission request (Chrome optional_host_permissions)
- GitHub Gist backup option
- Privacy policy for store submission

### Changed
- Connection persistence: cross-tab sync, state-change refresh, zoom-follow lines
- Firefox strict_min_version raised to 112.0 for background.type support

### Security
- Manifest permissions hardened
- WebDAV import guards, CORS redirect blocked
- Full security audit pass

## [3.6.0] - 2026-07-10

### Added
- Remember-last-position: saves/restores zoom + pan for canvas and inner surfaces
- New i18n keys: settingsNavGeneral/Appearance/Data/Sync, syncProviderHint — all locales

### Changed
- Box drag clamp: boxes constrained to visible canvas area with edge-snap
- Elastic snap rewritten with while-loop for complete overlap resolution
- Dark mode comprehensive fix: body/html dark, all edges covered, settings synced
- Header pin defaults ON; toggle for fullscreen animation
- Small boxes now rounded (border-radius: var(--radius-card))
- All i18n gaps fixed across 14 locales
- Tests: in-tree Playwright suite at `test/tests/`; 28 specs portable across OS

## [3.5.0] - 2026-07-10

### Added
- Canvas boundary clamp at 30% zoom, inner canvas pan support
- Dark mode comprehensive UI adaptation, header autohide fullscreen mode
- Settings tabbed layout (General/Appearance/Data/Sync & Backup)
- Bookmark right-click edit, URL open fix for all browsers
- Square corners toggle, 9 new i18n keys, small box bar enlarged

## [3.4.0] - 2026-07-10

### Added
- Export/Import data backup
- Dark mode initial implementation
- In-page delete confirmation, settings modal enlarged
- 12 new i18n keys

### Changed
- Background colors lighter/less saturated
- Header autohide default ON

## [3.3.0] - 2026-07-10

### Added
- Browser language auto-detect
- Pin/expand buttons redesigned
- Box index recycling, auto-expand transition

### Changed
- Small box default size 640x420
- Elastic snap iterative

## [2.0.0]

### Added
- Dual-level boxes, infinite canvas, drag/snap, list/grid, i18n, storage

## [1.0.0]

### Added
- Initial scaffold: beige design system, MV3 skeleton
