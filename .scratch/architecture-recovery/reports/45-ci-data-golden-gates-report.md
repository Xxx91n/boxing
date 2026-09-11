# Ticket 45 — CI Data-Compatibility Golden Gates Report

**Date:** 2026-09-11
**Status:** Implemented — CI evidence below
**Branch:** ci/data-golden-gates @ origin — ledger corrected per 45R (W2 review: ba1e7e9 was dangling). Post-restack (branch stacked above w2-brain-review-fix-launchers per GitButler dependency for the 45R docs): nnk = eab4151, vmm = 334c973, ovx (45R gate2 rework) = e261b38; this close-out docs commit itself is vrp (tip at push time = the commit whose tree contains this line). Pre-restack shas 5fbcb1a/e614852/efaeac7 are superseded; tree content is identical and the 34603576542 evidence applies.
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


## 返工轮次 45R — gate2 写路径扫描（2026-09-11，W2 wave5 复核触发）

**触发:** W2-wave5-brain-review 票 45 P1 碰撞: gate2 的 `expect(bg).not.toContain('boxingLayout')`
子串禁令与 ticket-42 合法**读** (takePreUpdateSnapshot 的
`api.storage.local.get({ boxingLayout: null })`) 在合并后必然红; 同时旧 bgWrites 白名单
(/bgErrLog|boxingInstallSignal/) 漏了 t42 的 snap.v1 split-key 写。首脑禁止把 t42 的读
改成迁就旧断言 — 修的是断言。

**新 gate2 语义 (写调用扫描):**
- `scanBackgroundWrites(src)`: 剥注释 → 引号归一 → 压平空白, 只抓四类**写**:
  object-literal set/remove/clear 携带 boxingLayout key (含跨行)、quoted-key 写、
  key-array remove、`directSetBoxingLayout(` 旁路调用。合法读 (get / destructure /
  `.schemaVersion` 字段访问) 与 `boxingLayoutFallback.v1` 这类非精确 key 一律放行。
  残留限制与 ntp 侧一致: 中间变量转发的写 (`const p = { boxingLayout }; set(p)`) 不做数据流分析。
- gate2 主体改为 `expect(scanBackgroundWrites(bgSrc)).toEqual([])`;
  bgWrites 白名单扩展接受 SW_SNAP_KEY_PREFIX/SW_SNAP_INDEX_KEY/'snap.v1. (t42 快照写)。
- 新增 **gate 2b** 表驱动自测 (9 例): t42 单读与完整读+snap.v1 写 = 0 violations;
  直写字面量/quoted remove/跨行 set/key-array remove/directSet 旁路 = 恰 1;
  destructure-only 与 fallback-key 子串 = 0。旧 not.toContain 禁令的 P1 红基线由
  Node 复演确认 (merged-future 树 violations 非空), 未用禁用断言迁就。
- ntp 侧不变: 写站点扫描、storage.js 头契约、41R 调试三通道 pin 全保留。

**CI 证据 (run 34603576542, ref efaeac7):**
- data-golden job: Running 7 tests → 6 passed, 1 skipped (gate 3 显式 skip(reason);
  gate 2 与 gate 2b 均在 6 passed 内) — job conclusion success。
- ubuntu 主 lane pretest 双 guard: import-graph "ok": true;
  migration-guard {"ok":true,"passed":28,"total":28,"failures":[]}。
- 主 lane (含 BOXING_EXCLUDE_GREP=@data-golden 生效) 480 passed / 11 failed / 3 skipped —
  11 失败全为既有 baseline (title-select-all×6、empty-state-buttons×2、auto-expand×2、
  state-sync×1, 两项目镜像), 0 条落在 migration-golden / data-golden 上;
  migration-golden 4 tests x 2 projects 通过 (passed 总数较 W1 基线 +8)。
- gate2 对合并后 t42 background.js 的绿灯由「merged-future violations: []」Node 复演预检,
  待 42R+45R 合入 main 后由 CI 主 lane 终证。

**账本:** 票 45 裁决 PASS-with-caveats → caveats 中 gate2 碰撞与 SHA 账本失真两项已在
45R (commit efaeac7) 关闭; flip 前置条件满足。
