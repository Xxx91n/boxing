# ADR-0009: 3-2-1 Data Resilience for Boxing Extension

## Date
2026-08-07

## Status
Accepted（**2026-09-12 修订**：快照存储形态由单键 `boxingSnapshots[]` 改为分键 `snap.v1.<ts>` + `snap.v1.index` 与 Time Machine 分层轮转，见 ADR-0017 / CONTEXT「Data Resilience」/ 票 41–41R。本 ADR 的 3-2-1 策略与 transports 不变；「last 10 LRU」由 RAW_KEEP_FLOOR + 分层轮转取代。**同日二次修订（票 51）**：导出副本信封化 + 覆盖必先本地副本 + RPO/RTO 定量化，见文末「修订 2026-09-12（票 51）」。）

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
3. **Export**: JSON export for offline/manual backup — since ticket 51 the default
   export is an envelope ({ _exportedAt, meta:{ schemaVersion, snapshots[], corrupt[],
   conflicts[] }, layout }) carrying layout + lightweight indices and NO snapshot
   bodies; an opt-in full DR package embeds the verbatim snap.v1/corrupt/conflict
   bodies with 5MB-cap trimming (see revision below). Filename:
   boxing-backup-YYYYMMDD.json.

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

## 修订 2026-09-12（票 51 · spec W6-D2 / D-006）：导出信封、覆盖必先副本、RPO/RTO

### 导出信封（hybrid export strategy）
- 默认导出 = 主布局 + 轻量 meta 索引（`snapshots[] / corrupt[] / conflicts[]` 仅
  `{ts, schemaVersion, size…}` 元数据），**不含快照正文**。工业对标（atomcode
  2026-09-12 调研，ctx source=wave6-dr-grill）：pg_dump 当前态与 WAL/PITR 历史分离、
  Notion/1Password/Raindrop 导出=当前态、Chrome 卸载即清 storage.local ⇒ 导出内容 =
  换机可恢复性全部承诺。
- 可选「完整容灾包」（`meta.fullPackage=true` + `_bodies`）才内嵌 snap.v1 /
  corrupt / conflict 正文；下载前做体积预估，超过 5MB 恢复上限时从最旧快照正文开始
  裁剪（`meta.bodyTrimmed` 记录），索引永远保留；裁剪到纯元数据仍超限则回退标准信封
  并提示用户。文件名统一 `boxing-backup-YYYYMMDD.json`。
- 导入端 `unwrapExportEnvelope`（ntp/utils.js，纯函数）同时接受新信封与旧裸
  layout dump（BX-DEV-111f 校验、SEC-06 2MB 深度上限作用于解包后的 layout 载荷）。
- 历史纵深不靠单文件承载：多次导出 + WebDAV/Gist 传输（3-2-1 的 offsite 语义不变）。

### 覆盖必先本地副本（copy-before-overwrite invariant）
每一条以远端/文件整体替换主键的路径，在破坏性写入**之前**必须留下本地副本：
| 入口 | 副本形态 | 落点 |
|---|---|---|
| 导入「覆盖恢复」两段式确认 | `saveSnapshot()` | ntp/settings-ui.js（票 44 已建，票 51 测试钉死） |
| WebDAV cloud-newer pull（含 merge 失败 newer-wins） | `saveSnapshot()` | ntp/sync-engine.js（票 51 新增） |
| WebDAV data-loss 用户确认 restore-from-cloud | conflict 归档 + `saveSnapshot()` | ntp/sync-engine.js（票 44 归档 + 票 51 快照统一口径） |
| 首拉且本地为空 / 空画布导入 | 无需副本（无可丢数据） | — |
crash-fork 与 pre-update 的 COW 语义（票 42/43）与本表同族，构成完整写前副本矩阵。

### RPO / RTO（定量化承诺）
- **RPO（Recovery Point Objective）＝距最近一次留存点的编辑丢失窗口**：
  - 破坏性入口（导入覆盖 / pull 覆盖 / data-loss restore / 升级迁移 / 损坏 fork）：
    写前 COW 使该次事件 RPO = 0（被丢弃侧 verbatim 留存）。
  - 稳态：自动备份经 chrome.alarms 驱动（最小周期 1 小时），每轮
    `performBackup()` 落一次 `saveSnapshot()` + 远端推送 ⇒ 开启自动备份后
    RPO ≤ 所选间隔（≥1h）；未开启时快照仅在手动备份与破坏性入口产生，RPO
    由用户行为界定（UI 数据健康区展示最近快照时间）。
  - 离线副本：RPO = 距上一次导出的时间；导出 meta 索引内的 `_exportedAt` 即承诺点。
- **RTO（Recovery Time Objective）＝恢复到可用布局的时间**：
  - 同机损坏：loadLayout crash-rescue 自动 fork+重建，用户侧 RTO ≈ 0（下次加载即健康
    布局，损坏载荷在隔离区可查）。
  - 同机误操作：Time Machine 回滚（票 50 UI）/ 导入端恢复，秒级。
  - 整机丢失：装扩展 → 导入信封 → 布局落位，单文件一次导入，目标 RTO ≤ 5 分钟；
    完整容灾包额外带走快照/隔离区正文，恢复历史纵深不需额外换机操作。
- 交叉引用：本修订的留存义务是 ADR-0017 发行门禁「数据兼容义务」的度量基线；G-B
  黄金路径检查单须对解包产物验证「信封导出→导入还原」往返。复核日期：2026-10-12。
