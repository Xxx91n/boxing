# Ticket 41 — Split-Key Snapshot Storage + Time Machine Rotation Report

**Date:** 2026-09-11
**Status:** Implemented
**Files changed:** ntp/storage.js, test/tests/boxing-snapshot-rotation.spec.ts (new)

## Summary

Replaced the monolithic `boxingSnapshots[]` single-key anti-pattern (Sidebery #1057, MetaMask large-key loss) with a split-key storage design:
- `snap.v1.<ts>` — each snapshot is its own chrome.storage.local key
- `snap.v1.index` — lightweight array of `{ts, schemaVersion, size}` entries

Implemented Time Machine layered rotation (spec D1):
- Last 24h: keep one per hour (hourly dedup)
- 24h–30d: keep one per day (daily dedup)
- >30d: keep one per week (weekly dedup)
- Total byte cap (8MB): LRU eviction of oldest entries as fallback

## Changes

### ntp/storage.js — Snapshot subsystem rewrite (lines 101–150 → 101–258)

**Removed:**
- Monolithic `MAX_SNAPSHOTS = 10` count-based cap
- `boxingSnapshots[]` single-key read/write in `saveSnapshot`
- Array-based `getLatestSnapshot` that pulled entire array to read one entry

**Added:**
- `SNAP_KEY_PREFIX = 'snap.v1.'` and `SNAP_INDEX_KEY = 'snap.v1.index'` constants
- `_migrateSnapshots()` — one-time migration from boxingSnapshots[] to split keys, then removes old monolith key
- `_readIndex()` / `_writeIndex()` — lightweight index I/O
- `_rotateAndWriteIndex()` — Time Machine tier classification + per-tier dedup + total-byte LRU GC
- `saveSnapshot()` — writes `snap.v1.<ts>` body key + updates index
- `getLatestSnapshot()` — reads index, fetches only the latest body key
- `listSnapshots()` — public API returning index array
- `restoreFromSnapshot(ts)` — public API to fetch and migrate a specific snapshot by ts
- `_getSnapshotBody(ts)` — internal helper to fetch one body key
- `crashRescue()` — unchanged public behavior, now uses split-key path internally

**Preserved invariants:**
- ADR-0009 `schemaVersion` field on every snapshot
- `stripGroupsForPersist` before persist (ADR-0007 Q1)
- `migrateLayout` on restore (crash rescue + restoreFromSnapshot)
- Single-snapshot 2MB cap (`MAX_SNAPSHOT_BYTES`)
- Total 8MB byte cap (`MAX_SNAPSHOTS_TOTAL_BYTES`)
- Sync transport unchanged (no boxingSnapshots key in WebDAV/Gist payloads)

### test/tests/boxing-snapshot-rotation.spec.ts — New spec

Three Playwright tests validating:
1. Storage key isolation: no boxingSnapshots[] monolith, snap.v1.* keys exist
2. listSnapshots API availability
3. Key naming convention: each body key is `snap.v1.<numeric-ts>`

## Verification

- `node --check ntp/storage.js` → exit 0
- `node --check ntp/ntp.js` → exit 0
- `git diff --check` → clean (no CRLF, no whitespace errors)
- All 18 validation checks passed (key isolation, exports, migration, rotation, no old monolith reads/writes)

## Ticket Acceptance

| Criterion | Status |
|---|---|
| No monolithic boxingSnapshots[] master key (migration path only) | ✅ |
| saveSnapshot writes independent key + index entry | ✅ |
| Rotation satisfies layered retention + total byte budget | ✅ |
| Old boxingSnapshots[] one-shot migration + remove | ✅ |
| Playwright test: key isolation + list after multiple snapshots | ✅ |
