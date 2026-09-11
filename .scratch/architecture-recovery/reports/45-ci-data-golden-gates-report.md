# Ticket 45 — CI Data-Compatibility Golden Gates Report

**Date:** 2026-09-11
**Status:** Implemented — CI evidence below
**Branch:** ci/data-golden-gates @ origin (5fbcb1a tests + docs close-out commit; 6887714/e992693 were superseded by amend/uncommit surgery — final state is 5fbcb1a + ba1e7e9)
**Files changed:** test/fixtures/schema/{v1,legacy-groups,legacy-v2}.json (new) · scripts/migration-golden-guard.mjs (new) · test/tests/boxing-migration-golden.spec.ts (new) · test/tests/boxing-data-golden.spec.ts (new) · test/cluster-map.json · test/playwright.config.ts · package.json · .github/workflows/test.yml · AGENTS.md

## Summary

Landed both halves of the ticket-45 acceptance:

1. **issues/45 (golden fixture + migration/rollback, blocking from day one)**
   - `test/fixtures/schema/` golden JSON per historical format: `v1.json` (current
     schemaVersion=1 canonical), `legacy-groups.json` (pre-ADR-0007 Q1: persisted
     groups, no schemaVersion, conns without props), `legacy-v2.json` (BX-DEV-085
     v2 shape).
   - `scripts/migration-golden-guard.mjs` — 28 named checks: bookmark/box/conn
     preservation per fixture, groups -> isParent restoration, groups stripping,
     props backfill, schemaVersion defaulting, migration idempotency, and
     rollback safety (a frozen pre-Q1 reader must see identical user-visible
     data from current writes — expand/contract). Wired into **pretest**
     (`npm run pretest` / `npm test` lifecycle) so failure = red job.
   - `boxing-migration-golden.spec.ts` — same checks surfaced as Playwright
     report entries + **node/page migrateLayout parity** for every fixture
     (the guard's Node context and the in-NTP page context must agree).

2. **launcher (runtime data-layer gates, burn-in)**
   - `boxing-data-golden.spec.ts`, 5 gates + 1 companion (describe tag
     `@data-golden`): (1) roundtrip — 50 awaited writes, reload, storage/DOM
     equality + revision-monotonicity + quiescence (stale snapshot cannot
     overwrite); (2) single write path — static scan: zero direct chrome.storage
     writes outside ntp/storage.js, the storage.js header contract line pinned,
     the ONLY allowed exception is the exact 3-line __boxingDebug passthrough
     trio (ticket 41R) pinned by text — a fourth handle goes red; background.js
     must never touch boxingLayout and its two SW small-key writes (bgErrLog,
     boxingInstallSignal) stay whitelisted; (3) undici keep-alive — explicit
     skip(reason): the ADR-0016 transports are browser-side fetch (MV3 network
     stack), no Node/undici connection surface to observe; (4) cross-page —
     window A write syncs into window B in a fresh non-incognito browser profile,
     loop guard must converge (revision stable across settle windows, no write
     storm); (5) import quota guard — Storage.prototype setItem patched to throw
     QUOTA_BYTES on boxingLayout (audit-spec cross-engine pattern), import via
     real filechooser flow: no throw, BX-AUD-04 __lastSaveError flag set,
     emergency boxingLayoutFallback.v1 snapshot written, imported box rendered,
     and recovery after pressure clears resets the flag. 5b: SEC-06 2MB JSON cap
     + 5MB file cap rejections must raise visible alerts.
   - CI wiring: `test.yml` gains a dedicated `data-golden` job (ubuntu + xvfb,
     `--grep=@data-golden`) with **continue-on-error until 2026-09-18** (first
     week per launcher). Main lane excludes the tag via
     `BOXING_EXCLUDE_GREP=@data-golden` + new `grepInvert` config hook. Flip-back
     steps are inlined in both test.yml and the spec header.

## CI evidence (runs on ci/data-golden-gates)

- Run 34577413715 (first dispatch): exposed two of my own wiring bugs —
  `config.grepInvert must be a RegExp` (killed all three main lanes at load)
  and gate 2 flagging the two __boxingDebug passthrough writes as violations.
  Also proved the guard already runs: pretest printed {"ok":true,"passed":28,
  "total":28} on all 3 OSes. Fixed both in 5fbcb1a.
- Run 34578668227 (final):
  - `data-golden` job: **success** (6 tests: 5 gates + 5b; gate 3 explicit skip).
  - Main lanes: 480-482 passed vs pre-branch baseline 472-474 = +8 = my 4
    migration-golden tests x 2 projects, all green; 0 failures attributed to
    any ticket-45 file (failed list = pre-existing baseline, see below).
  - Migration/rollback blocking property demonstrated: guard red = pretest
    exit 1 = job red (npm test lifecycle), per issues/45.

## Findings handed upstream (NOT disabled in this ticket)

- **Pre-existing main-lane red (baseline run 34569565899 on main, predates this
  branch, identical across all 3 OSes):** 9-10 toHaveCount failures in
  boxing-title-select-all (x3), boxing-empty-state-buttons, boxing-auto-expand,
  boxing-state-sync, boxing-conn-dsu, boxing-snapshot-rotation. Likely the
  ticket-40/41R W1 landing area; belongs to whichever branch owns those specs
  (parallel windows per user dispatch). Listed here for brain triage.
- **migrateLayout v2-path known gap:** the version===2 branch returns without
  `connections`/`groups`/`schemaVersion` keys; normalization lands on the next
  load through the >=3 branch. The guard pins current behavior
  (v2-second-pass-normalized) and flags the gap by name instead of red-
  fltering: a one-pass v2 -> first-load crash-rescue path should be reviewed
  in the ticket-46 release-gate ADR.

## Repo incident (same day, repaired here)

The 14:30 hard reboot lost deferred writes: 17 loose objects +
.git/gitbutler/operations-log.toml landed as all-zero files; git log/status
and but were dead. Repair: moved zero files aside (backup /tmp/boxing-git-
corrupt-backup), rm'd the torn refs/remotes/origin/main + HEAD, ran
`git fetch --refetch origin` (full re-fetch bypassing have-negotiation which
tried to read the missing objects), reset operations-log.toml to empty.
fsck: 0 corrupt / 0 missing; but status healthy; no local-only loss (all
lost objects were fetch-reachable; workspace commit is regenerable).

## Acceptance mapping (issues/45)

- [x] golden fixture per historical schemaVersion (v1 + pre-versioning shapes)
- [x] migration tests run in npm test / CI, failure red (pretest guard, all 3 OSes)
- [x] rollback safety covers expand/contract assumption (frozen legacy reader gate; v1->current data)
- [x] cluster-map registers new specs (CM-1 clean: uncovered=[] ghost=[])
- [x] launcher 5 gates with assertions or explicit skip(reason); burn-in CI wiring landed
