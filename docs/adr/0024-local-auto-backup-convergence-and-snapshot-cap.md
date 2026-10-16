# ADR-0024: 自动备份本地模式收敛静默快照与快照 30 条硬上限

## Date
2026-10-16

## Status
Accepted - wave 2026.10.17 grill 决策 D-001 / D-004 (atomcode 行业调研交叉印证)

## Context

1. **自动备份弹窗缺陷 (D-001)**：ADR-0022 落地后，`performBackup()` 沿用旧逻辑 `if (p === 'local') backupToLocal()`，每次新标签页启动触发闹钟补跑或冷启动检查时，均调用 `a.click()` 弹出浏览器下载保存对话框。atomcode 深度调研表明：工业界共识为“内部快照为常态，文件导出为显式动作（snapshot-by-default, export-on-demand）”；自动备份绑定文件下载会将用户 Downloads 文件夹当成扩展内部数据库，属于严重 UX 反模式。
2. **快照单调递增无上限 (D-004)**：ADR-0009 引入了 GFS 阶梯保留（最新 10 条 + 24h 小时级 + 30 天天级 + 周级），并设置了 8MB 存储容量硬上限。但由于书签配置极轻（通常仅数十 KB），8MB 容量门槛难以触发；长期使用下周级历史快照会单调增长至 100+ 条，引起用户对存储膨胀的焦虑。

## Decision

1. **自动备份在 Local 模式下行为收敛**：
   - 当 `syncProvider === 'local'` 时，自动备份（定时器、alarms 或启动补跑）**仅执行 `await saveSnapshot()` 内部版本快照**，绝不调用 `backupToLocal()` 触发浏览器下载；
   - `backupToLocal()`（导出备份 JSON 文件）严格收敛为用户在“设置 > 同步与备份”中主动点击“立即备份（Backup Now）”时的显式操作；
   - `defaultLayout().settings` 初始赋予 `lastBackupAt: Date.now()`，消除冷启动时 `!last` 误判导致的逾期击穿；Demo 环境 (`__BOXING_DEMO__`) 显式切断自动备份与补跑。
2. **快照绝对数量上限（MAX_SNAPSHOT_COUNT = 30）**：
   - 在 `ntp/storage.js` 中新增绝对数量硬上限 `MAX_SNAPSHOT_COUNT = 30`；
   - 轮转逻辑：先走现有 GFS 阶梯桶去重；若条目仍超过 30，从最古老历史快照开始 FIFO 剔除，并同步调用 `layoutStorage.remove(snap.v1.<ts>)` 物理删除散列键，杜绝孤儿键；
   - 保持 8MB 总字节与 2MB 单快照上限双重容量防护；
   - 设置文案更新为明确声明“最多保留 30 个分层快照”。

## Consequences

- 正面: 彻底根除每次开标签页弹窗下载的严重侵入性 bug；将自动备份行为统一到 ADR-0009 内部快照系统；快照键数量与索引常数化（$le 30$），消除存储膨胀风险与用户疑虑。
- 负面/妥协: 本地模式下卸载扩展且清空数据时，内部快照无法存活（工业界公认折中，通过显式“立即备份”导出和 WebDAV/Gist 远端同步覆盖此防线）。
- 中性/约束: 自动备份路径严禁调用任何下载/导出方法；数量淘汰严禁侵蚀最新 10 条（`RAW_KEEP_FLOOR = 10`）无条件保留底线。

## Review

- 复核日期: 2026-11-15
- 复核项: 
  1. 长期使用下快照总数是否平稳维持在 30 条以内，是否存在孤儿键残留；
  2. 本地模式自动快照静默保存与 Time Machine 回滚功能是否完备；
  3. WebDAV/Gist 远端自动备份是否保持不受影响。
- 复核结论: <待回填>
