# Handoff 07 — storage 写入门面

## 目标
storageWriteChain + applyingExternalLayout + onChanged 监听收敛为唯一写入门面模块; 全部写入经门面。存储区选型不动 (storage.local, ADR-0002/A6)。

## 上游上下文
- 验收单: ../issues/07-storage-facade-module.md
- 调研依据: Chrome 官方定性 storage API 无事务有竞态; 现有写链形态即官方推荐形态 — 本票只收敛搬迁, 不重新设计。
- AGENTS.md SEC-08 的写路径分类 (debounced vs direct) 必须原样保留。

## 完成定义
issues/07 验收项全勾; 双标签页手动验证不回环、不丢写。
