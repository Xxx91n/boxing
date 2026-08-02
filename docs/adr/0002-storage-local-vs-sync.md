# ADR-0002: storage.local over storage.sync for layout

## Date
2026-08-02

## Status
Accepted

## Context
Until A6, Boxing stored its entire `boxingLayout` object in `chrome.storage.sync` (Firefox `storage.sync`).
The sync area is hard-capped at 100 KB total / 8 KB per item, and Chrome throttles
writes to 120 writes/min (2/sec). With more boxes and connections (each connection is
small but they accumulate), and especially during continuous Ctrl+wheel zoom / drag /
pan events, the layout JSON grows past the 100 KB limit and frequent saveLayout calls
risk `QUOTA_BYTES` / `MAX_WRITE_OPERATIONS_PER_MINUTE` errors.

The earlier SEC-08 rule in AGENTS.md codified a 300ms debounce as the only protection,
and stated the rate-limit as 1200 writes/min — that number was wrong per MDN/Chrome;
the actual limit is 120 writes/min.

## Decision
Migrate the primary layout storage area to `chrome.storage.local`:
- chrome.storage.local: 10 MB by default, unlimited with the `unlimitedStorage` permission (added in A6).
- `storage.local` and `storage.sync` both fire `storage.onChanged` events for cross-tab sync, so the existing cross-tab `applyExternalLayout` flow works unchanged.

Layout load (`loadLayout`) keeps a one-time legacy migration: if storage.local has no
`boxingLayout` but storage.sync does, copy into local and then remove the sync copy so
stale sync data never diverges from local in the future.

## Consequences
- Larger capacity: layout can now safely grow past 100 KB; a user's full graph of
  hundreds of boxes + connections is permanently stored locally.
- Cross-device sync is *lost* in favor of per-device storage. The user could opt to
  back up via the existing WebDAV / GitHub Gist / export flows if cross-device sync
  is needed. (The grill audit explicitly chose A6 = sync -> local because the user
  had not requested Cloud sync of layout vs the prior sync-only model.)
- The 300ms `saveLayoutDebounced` is still kept for I/O performance and to avoid
  blocking the main thread, but it no longer exists to defend against a rate limit.
- SEC-08 in AGENTS.md updated to reflect the corrected rate-limit number and the
  area change.
