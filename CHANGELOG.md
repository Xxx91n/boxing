# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project used SemVer until v3.7.0, then switched to CalVer (YYYY.M.D) starting v2026.8.21.

## [Unreleased]

Internal work after 2026.9.12. Per [ADR-0017](docs/adr/0017-release-data-gate.md) store
uploads and GitHub tags still follow the release gate. Install from official store pages
(see [publishing guide](docs/publishing-guide.md)); GitHub Releases are changelog-first
and no longer ship `.xpi` / `.crx`.

## [2026.9.12] - 2026-09-13

User-facing notes for store listings and the GitHub Release body.

### Added
- **Zero-flash new tab** — first paint already uses your remembered theme and dark mode; no beige flash.
- **Conflict copy browser** — settings Data tab lists archived conflict copies and can export each as JSON.
- **WebDAV private/LAN host opt-in** — default still blocks private hosts; you can explicitly allow your own NAS/server in Settings → Sync.
- **Search debounce** — canvas search no longer re-queries on every keystroke.

### Improved
- **Credential hardening** — backup passwords/tokens use a per-install random key (obfuscation-grade at rest, not passphrase encryption).
- Stronger data-integrity write-path checks so layout writes stay behind the storage facade.
- Popup primary button uses the design-system accent color.
- Docs: clearer store/release guides; GitHub Releases point at official store pages.

### Fixed
- Unload race that could drop a just-deleted connection or seeded boxes on reload.
- Cross-tab / snapshot consistency issues behind the data-resilience suite.
- UI version strings follow the manifest calver.

### Install
- Firefox: [AMO listing](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/)
- Edge / Chromium: [Edge Add-ons listing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
- Source: [GitHub](https://github.com/Xxx91n/boxing) · Privacy: [policy](https://xxx91n.github.io/boxing/privacy-policy.html)

### Changed
- Toolbar icons realigned with the curated docs/brand assets (ticket 01).
- README install steps, screenshots and locale claims synced to live releases (ticket 02).
- manifest `name`/`description` switched to `__MSG_extensionName__`/`__MSG_extensionDescription__`
  placeholders so AMO/Edge auto-detect the 14 shipped locales (ticket 03).
- Settings backup page regrouped into distinct WebDAV and GitHub Gist sections (ticket 04).
- The settings footer now reads `version_name` from the manifest at runtime instead of a
  hardcoded legacy `v3.6.6` string (ticket 08).

### Fixed
- Firefox settings-page scroll regression: removed the visually-inert `backdrop-filter`
  and a dead assert (ticket 05).
- GitHub Pages root 404: `docs/` now serves a landing index (ticket 06).
- Release flow: published releases auto-redeploy the interactive NTP preview demo (ticket 07).
- `.github/scripts/build.mjs`: `BOXING_BUILD_VERSION` now overrides `version_name` alongside
  `version`, closing the stale-calver gap in dist injection (ticket 08).

## [2026.9.11] - 2026-09-09

Latest published release ([tag f2ab29c](https://github.com/Xxx91n/boxing/releases/tag/v2026.9.11),
dist manifest version 2026.9.11 via `BOXING_BUILD_VERSION` injection, CI run 34384723535).

### Changed
- manifest `description` shortened to 131 chars to fit the Edge/Chrome 132-character store limit.
- Brand icons regenerated from the docs/brand logo (white-body `logo-light-theme`) before packaging;
  the icon step moved into the build pipeline with a setup-python step for macOS (PEP 668).
- Store listing pack: field-ready AMO + Edge listings (EN/zh-CN) added under docs/store-assets
  (store-listings-2026-09.md).

### Fixed
- CI: `amo_sign` build input to skip unlisted signing for versions reserved for the AMO
  listed-channel upload.

## [2026.9.9] - 2026-09-09

### Changed
- First public release packaging: version bump 2026.8.21 -> 2026.9.9 (calver) because version
  2026.8.21 was consumed on AMO by the unlisted signing submission (CI run 34010200764) and
  AMO version numbers cannot be reused.
- No application-content changes versus 2026.8.21; this line exists so GitHub Release artifacts,
  store submissions, and the manifest all share one version string.

### Fixed
- Packaging: zip local-file-header byte layout (one extra u16) that made strict zip parsers
  reject the release zips; build.mjs now self-validates the produced zip against the spec.
- CI packaging workflow: windows leg shell, single-leg AMO/CRX signing, per-leg artifact names,
  deterministic CRX signing key path.

## [2026.8.21] - 2026-08-21

### Changed
- Version scheme: SemVer (3.7.0) -> CalVer (2026.8.21, non-zero-padded)
- Added manifest.json version_name field for store display
- Added .github/workflows/mirror.yml: push-to-main mirror to GitLab + Codeberg
- Updated screenshots: 5 real Playwright-captured 1280x800 PNG (was placeholders)
- docs governance: hard boundaries to docs/agents/, process to docs/history/

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
