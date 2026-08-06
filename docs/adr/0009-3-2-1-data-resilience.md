# ADR-0009: 3-2-1 Data Resilience for Boxing Extension

## Date
2026-08-07

## Status
Accepted

## Context
Boxing stores all user data (boxes, connections, bookmarks) in chrome.storage.local
with unlimitedStorage permission. Existing backup features include manual backupNow,
WebDAV sync, GitHub Gist backup, JSON export/import, and a setInterval-based auto-backup.

However, the current system lacks several engineering-grade resilience patterns:
- No versioned snapshots: backupNow stores a single dump; user errors are irreversible.
- No crash rescue: schema migration failures or storage corruption have no automatic recovery.
- setInterval auto-backup stops when the NTP page is closed (not using chrome.alarms).
- WebDAV sync uses last-write-wins, silently losing data on multi-device conflicts.

## Decision
Implement a complete 3-2-1 data resilience strategy:

### 3 copies of data
1. **Primary**: chrome.storage.local (live working copy, unlimitedStorage)
2. **Versioned snapshots**: boxingSnapshots[] in storage.local — last 10 timestamped
   snapshots with schema version, auto-pruned LRU
3. **Export**: JSON export for offline/manual backup (already exists)

### 2 backup transports
1. **WebDAV** (existing): background.js proxy with BX-AUD-01/02/03 security hardening
2. **GitHub Gist** (existing): user-granted token, non-secret data only

### 1 crash rescue + conflict resolution
- **Crash rescue**: loadLayout validates data integrity on every load; on detected
  corruption or schema failure, auto-rolls back to the most recent healthy snapshot.
- **chrome.alarms**: Replace setInterval auto-backup with chrome.alarms in background.js
  so backups survive NTP page closure and Service Worker eviction.
- **Outbox pattern**: WebDAV sync uses a local outbox (pending sync queue) with
  baseVersion tracking. On 409 conflict, field-level auto-merge for non-overlapping
  changes; manual-merge UI for same-field divergence.

### Schema versioning
layout.schemaVersion added to track data format version, enabling forward-only
migrations on extension update (onInstalled with reason === 'update').

## Consequences
- ~500 lines of new code in ntp.js + background.js
- Storage cost: 10 snapshots × ~50KB each = ~500KB (well within unlimitedStorage)
- chrome.alarms requires 'alarms' permission in manifest.json
- Outbox adds a boxingOutbox[] key to storage.local (~1KB per pending operation)
- Conflict resolution UI adds a modal to the settings page
- All changes are backward-compatible: existing layouts without schemaVersion are
  treated as version 3 (matching existing migrateLayout behavior)
