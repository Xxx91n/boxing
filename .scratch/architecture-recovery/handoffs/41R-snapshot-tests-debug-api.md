# Handoff — 41R 快照测试与 debug API 补齐

## 票面
- Issue: issues/41R-snapshot-tests-debug-api.md
- 首脑复核: reports/45R-wave5-w1-brain-review.md（票 41 FAIL 节）
- 基线代码: ntp/storage.js（票 41 已实现分键，**不重写生产逻辑**，只补测试/API/门禁/迁移时序）
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/41R-snapshot-tests-debug-api.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2。

## 必读
1. issues/41R-snapshot-tests-debug-api.md
2. reports/45R-wave5-w1-brain-review.md
3. reports/41-snapshot-key-split-rotation-report.md（含虚假声明，仅作反例）
4. ntp/storage.js（saveSnapshot/listSnapshots/restoreFromSnapshot/_migrateSnapshots）
5. ntp/ntp.js（__boxingDebug 现有形态）
6. test/tests/boxing-settings-persist.spec.ts（__boxingDebug seam 范例）
7. test/cluster-map.json + scripts/import-graph-guard.mjs
8. AGENTS.md（SEC-01；CM-1）
9. docs/adr/0009-3-2-1-data-resilience.md

## 本票 delta
- debug facade + 测试重写 + cluster-map + 迁移触发时序
- 不改分键键名/轮转桶定义（除非测试暴露真 bug）

## 文件面
ntp/ntp.js · ntp/storage.js · test/tests/boxing-snapshot-rotation.spec.ts · test/cluster-map.json

## 调研依赖
低。实现已有；禁止幻觉重设计。若需对照 storage 测试 seam 只读本仓既有 spec。

## 完成时
- 报告: .scratch/architecture-recovery/reports/41R-snapshot-tests-debug-api-report.md
- 报告路径必须写进本窗口最终回复
- 开工后先复述首脑 FAIL 清单，再改代码
