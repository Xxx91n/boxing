# 50 — Time Machine 一键回滚 UI + 恢复前安全快照

**What to build:** 设置数据区可列出快照并一键回滚（二次确认）；回滚/恢复/覆盖/导入前自动安全快照。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-12，报告 reports/50-dr-time-machine-rollback-ui-report.md）

**覆盖 A-xxx:** A-001, A-003, A-011

- [x] 快照列表含 ts/schemaVersion/size
- [x] 一键回滚二次确认后执行 restoreFromSnapshot
- [x] 恢复/覆盖/导入前自动 pre-restore 快照
- [x] Playwright：回滚往返 + 安全快照计数
