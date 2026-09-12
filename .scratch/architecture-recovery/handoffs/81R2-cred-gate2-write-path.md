# Handoff 81R2 — data-golden gate2 / PIK 写路径

> A-xxx: A-031, A-025 · 前置阅读: W8-W2-brain-review.md

## 身份

你是 Wave8 票 81R2 返工窗口。

## 必读

- .scratch/architecture-recovery/reports/W8-W2-brain-review.md
- .scratch/architecture-recovery/reports/71-report.md §6.1
- .scratch/architecture-recovery/reports/81-report.md（含 81R 节）
- .scratch/architecture-recovery/issues/81R2-cred-gate2-write-path.md
- test/tests/boxing-data-golden.spec.ts（gate 2 / gate 2b）
- ntp/credentials.js · ntp/storage.js
- scripts/import-graph-guard.mjs
- .scratch/architecture-recovery/WORKFLOW.md

## 本票 delta

使 gate2 绿：PIK 的 storage.local.set 不得再被扫描判为非法；优先收口到 storage facade 或钉死形状的窄例外。禁止恢复 credentials 对 layout 的写入；禁止全局关闭 gate2。

## 调研要求

先复核首脑结论再动手；与 current 冲突禁止静默改向。

## 完成定义

- issue AC 全勾
- gate2 + import-graph + node --check 绿
- 报告追加 reports/81-report.md 标注「返工轮次 81R2」
- 版本控制遵循 WORKFLOW §4.2

## Suggested skills

diagnosing-bugs · implement · tdd
