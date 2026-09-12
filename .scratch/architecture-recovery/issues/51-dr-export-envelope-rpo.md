# 51 — 导出信封/完整包 + 覆盖必先副本 + RPO/RTO ADR

**What to build:** 默认导出=主布局+meta 索引（不含快照正文）；可选完整容灾包；同步/导入覆盖必先本地副本；RPO/RTO 写入 ADR-0009/0017。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**覆盖 A-xxx:** A-001, A-003, A-006, A-011

- [ ] 默认导出含 layout + meta 索引不含正文
- [ ] 可选完整包含正文；体积预估+5MB 处理
- [ ] 文件名 boxing-backup-YYYYMMDD.json
- [ ] 同步/导入覆盖必先本地副本+测试
- [ ] RPO/RTO 入 ADR-0009 修订并交叉 ADR-0017
- [ ] 导入信封可还原当前布局
