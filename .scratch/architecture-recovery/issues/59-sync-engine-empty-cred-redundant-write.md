# 59 — sync-engine 空凭据冗余写（P2）

**What to build:** 消除空凭据路径上不必要的 saveLayout 冗余写（42R 遗留）。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**覆盖 A-xxx:** A-010

- [ ] 定位空凭据仍触发 saveLayout 的路径
- [ ] 去掉冗余写且不影响有凭据备份路径
- [ ] 相关 data/COW 回归不新增红
- [ ] 报告含改动面与验证命令结果
