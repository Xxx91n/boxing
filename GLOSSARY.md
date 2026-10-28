# Boxing Glossary

Boxing is a vanilla-JS Manifest V3 extension (Chrome + Firefox) that organizes bookmarks hierarchically on an infinite canvas; the main surface is the new-tab override (`ntp/`).

## Domain

**Large box** — Top-level container on the outer canvas (`id: L<n>`) holding small boxes. It carries geometry, title, star mark, auto-expand and inner view state.

**Small box** — Leaf container inside a large box (`id: S<n>`) holding bookmarks. Bookmark ids are the merge and tombstone key.

**isParent** — Per-box boolean star mark identifying the movement leader of its DSU group. Star truth is this field, not the runtime groups mirror.

**autoExpand** — Boolean: the box renders expanded on hover without a click.

**Connection** — Undirected edge `{ id, from, to, props }` between two boxes. Connection data persists even when its line is not renderable.

**connLine** — SVG `<line>` element on the dedicated connection layer, tracked per connection id.

**connById / boxConnIdx** — Lookup indexes from a connection id to the connection, and from a box id to the connections touching it.

**DSU (Disjoint Set Union)** — Groups boxes connected by lines. A group is every box sharing the same DSU root; membership drives star propagation and group drag.

**resolveConnSurface(from, to)** — Determines which surface owns a connection; cross-parent small-to-small lines are hidden while the connection data is kept.

**scheduleConnRefresh(ids)** — Coalesced refresh of line endpoints after box geometry or viewport changes.

**Viewport culling** — Lines outside the visible canvas or inner area are hidden to avoid SVG cost.

**Box key** — `large:L1` for a large box and `small:L1:S1` for a small box. Legacy unprefixed ids are normalized on load.

**commit(op, payload, opts)** — The single mutation entry for layout data. It owns tombstones, DSU invalidation, view-state cleanup, and optional save and render.

**boxById / smallBoxById** — Lookup maps rebuilt on load and after an external layout apply.

**runtime groups mirror** — In-memory `layout.groups` computed from `isParent` and connections. It is never persisted; star truth is `box.isParent`.

**grid hash** — Spatial index used by group-drag collision checks above 32 boxes.

**connDeleteAction** — Setting that selects how a connection is deleted: alt, ctrl, or shift click; double-click; or select and delete.

**selectedConnId** — Id of the connection selected in select-and-delete mode; cleared on mode change.

## Settings and themes

**layout.settings** — Persisted settings object inside `layout`; cross-tab merge is `{ ...remote.settings, ...local.settings }`.

**auto-title rule** — Ordered list of URL match-pattern rules with an extraction preset. First match wins, with a built-in default last.

**extraction type** — One of eight presets that derive a bookmark title from URL structure; users never write regex.

**THEME_PACKS** — Five curated themes (`beige`, `graphite`, `coastal`, `forest`, `pure`), each defining full light and dark ramps.

**theme** — `layout.settings.theme` key, defaulting to `beige`. It replaces the old accent hue and preset pair.

**applyTheme(themeKey)** — Writes all theme CSS variables onto `document.documentElement`.

**applyDarkMode()** — Toggles the `ntp--dark` class on the single host `document.documentElement`.

**dark-mode preference** — `layout.settings.darkMode`, one of `light`, `dark`, or `system` (default `light`). A legacy boolean reads as light/dark, and every write stores the three-valued string.

**effective dark state** — The derived display value: the preference for `light`/`dark`, and the live `prefers-color-scheme` value for `system`. It is never persisted; the preference is.

**boxingBootTheme.v1** — Sync-readable first-paint cache of theme and dark mode. It is not a second layout source.

**__BOXING_DEMO__** — Build-time window flag for the standalone demo; it suppresses the first-run tour.

## Storage and resilience

**saveLayoutDebounced()** — Debounced persist of the layout to local storage.

**mergeConcurrentLayout** — Cross-tab merge where local settings win field by field.

**snap.v1 snapshot** — Each snapshot is its own `snap.v1.<ts>` key, with metadata in `snap.v1.index`. The storage facade owns them.

**Time Machine rotation** — Tiered retention: hourly within a day, daily within a month, weekly beyond, with a raw keep floor and a total-byte cap.

**pre-update snapshot** — Copy-on-write snapshot taken before any schema migration so the pre-update bytes remain recoverable.

**needsMigration(raw)** — Detector for a layout that a migration would rewrite. A false positive only costs one extra snapshot.

**conflict copy** — Losing subtree archived verbatim instead of being silently overwritten during import or sync merge.

**conflict field path** — Address of one adjudicable field inside a conflict comparison: the object's box key (plus the bookmark id for bookmark fields) and the field-group name, joined with `#` — `large:L1#title`, `small:L1:S1:bm1#url`. It is a UI address only; it never becomes a stored id.

**staleness signature** — Fingerprint of the current side of a conflict comparison, taken when the user saw the diff. Applying re-compares and refuses when the signature moved, so an unreviewed verdict can never overwrite a later edit.

**export envelope** — The plain JSON a manual export writes: `{ _exportedAt, meta, layout[, _bodies] }` (ticket 51). "Envelope" in this repo means this structure, the credential envelope below, or a passphrase backup file — say which one.

**passphrase backup file** — Manual export (standard envelope or full DR package) sealed with a user-typed passphrase in a versioned `boxingBackup: 1` envelope (PBKDF2-SHA-256 → AES-GCM). Keyed on the passphrase alone, never on the install key, so another install can open it; Boxing does not store the passphrase and cannot recover it. Distinct from the credential envelope, which is per-install obfuscation of sync secrets.

**credential envelope** — Sync secrets (`_encWebdavPass` / `_encGistToken`) obfuscated at rest with the per-install key. It is not file encryption, and the per-install key never leaves the profile — so a **v3** envelope is unusable to whoever holds a backup file. Legacy **v1** envelopes bundled their own key and **v2** used a constant shipped in the source, so any of those still living in a profile do travel inside an exported file and can be recovered by its holder (see the version history in `ntp/credentials.js`). Treat every backup file, sealed or plain, as secret-bearing.

**autoBackupDue** — Storage flag written by the service worker's alarm listener and consumed by the NTP, which runs the backup and clears it.

**MAX_SNAPSHOT_COUNT** — Hard ceiling of 30 snapshots; older snapshots are physically deleted beyond it.

**Auto-backup local mode** — With `syncProvider: local`, auto-backup only writes silent internal snapshots and never triggers a browser download.

**favicon pixel layer** — Best-effort 32×32 PNG data URIs captured from the source that won a favicon probe. It is a discardable accelerator, never a second source of truth: at most 16 KiB per entry and 1 MiB for the whole serialized layer, evicting the oldest write first, refreshed on the same 7-day-fresh / 90-day-stale clock as favicon URLs, and falling back to the URL path on any failure.

## Build and dev-load

**Source tree** — The checked-out repository root. It is Firefox-loadable as-is; Chrome rejects it until built.

**dist/boxing-chrome** — Chrome build output with a Chrome-tailored manifest and all assets. The canonical Chrome extension directory.

**dist/boxing-firefox** — Firefox build output with the gecko block and all assets. The canonical Firefox extension directory.

**dev-chrome / dev-firefox** — Gitignored junctions to the corresponding dist directory, for GUI load-unpacked convenience.

**build.mjs** — The single canonical cross-platform build entry. It produces both dist trees, release artifacts, and dev junctions.

**release artifacts** — Per-browser bundles inside `dist/*/release/`: unzipped directory, zip, and native package.

**test/** — In-tree Playwright root. `npm test` runs it; browsers require `npx playwright install` once.

**web-ext** — Mozilla's dev launcher used by the dev npm scripts. It points at the dist directory.

**ntp.css** — Gitignored build artifact concatenated from the split CSS sources. Edit the sources, never the artifact.

## UI conventions

**scrollbar-width: thin** — Standard thin overlay scrollbar applied to every scroll container. Never set `::-webkit-scrollbar` width.

**Pin tooltip action semantic** — The pin button tooltip names the action a click will perform, not the current state.

**CSS dual-write** — Large-box and small-box canvases share connection-line classes, so paired selectors must stay in sync.

**Disposal invariant** — Any code clearing the canvas inner HTML must call `disposeAllConns()` first.
