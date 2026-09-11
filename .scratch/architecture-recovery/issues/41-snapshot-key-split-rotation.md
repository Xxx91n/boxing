# 41 — 快照分键存储 + Time Machine 分层轮转

**What to build:** 将 boxingSnapshots[] 单键拆为 snap.v1.<ts> 分键 + index；实现近24h每小时/近30天每日/更早每周的分层轮转；保留总量闸；提供 listSnapshots/saveSnapshot/restore API 供后续票使用。

**Blocked by:** None — can start immediately

**Status:** done — 验收经 41R 补齐（reports/41R-snapshot-tests-debug-api-report.md）

- [x] storage 中不存在巨型 boxingSnapshots 数组主键（或仅作只读兼容迁移源）
- [x] saveSnapshot 写入独立键并在 index 登记
- [x] 轮转后满足分层保留策略且总量不超预算
- [x] 旧 boxingSnapshots[] 一次性迁移逻辑 + 单测
- [x] Playwright 或单测覆盖：连续多次快照后 list 数量与键隔离
