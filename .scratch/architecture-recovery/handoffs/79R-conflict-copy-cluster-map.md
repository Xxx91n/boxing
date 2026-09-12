# Handoff 79R — 79 返工：cluster-map 登记 conflict-copy spec（返工）

> A-xxx: A-029 · 前置: reports/W8-W1-brain-review.md · **状态: implemented（2026-09-12，报告 79-report.md 返工轮次节，issue AC 4/4 勾；CM-1 转绿零命中，guard exit 0）**

## 身份

你是 Wave8 票 79R **返工窗口**。

## 必读

- .scratch/architecture-recovery/reports/W8-W1-brain-review.md
- .scratch/architecture-recovery/reports/79-report.md
- .scratch/architecture-recovery/issues/79R-conflict-copy-cluster-map.md
- .scratch/architecture-recovery/WORKFLOW.md
- scripts/import-graph-guard.mjs
- test/cluster-map.json

## 本票 delta

最小修复：将 boxing-conflict-copy-readout.spec.ts 归入 test/cluster-map.json 的 ntp/storage.js（或 settings-ui.js，按 seam 以 storage getter 为准则优先 storage）cluster；不改生产逻辑；重跑 import-graph-guard。

## 调研要求

返工以复核首脑结论为先；如与 current 决策冲突禁止静默改向。

## 完成定义

- 遵循 issue AC 与本 handoff
- 报告追加至 reports/79-report.md（标注返工轮次）
- 版本控制遵循 WORKFLOW §4.2
- 重跑 node --check + import-graph-guard 必须绿

## Suggested skills

diagnosing-bugs · implement · tdd
