# Handoff 81R — 81 返工：credentials.js B-6 白名单合规（返工）

> A-xxx: A-031 · 前置: reports/W8-W1-brain-review.md

## 身份

你是 Wave8 票 81R **返工窗口**。

## 必读

- .scratch/architecture-recovery/reports/W8-W1-brain-review.md
- .scratch/architecture-recovery/reports/81-report.md
- .scratch/architecture-recovery/issues/81R-cred-browser-api-whitelist.md
- .scratch/architecture-recovery/WORKFLOW.md
- scripts/import-graph-guard.mjs
- ntp/credentials.js
- scripts/import-graph-guard.mjs

## 本票 delta

最小修复二选一（优先 1）：1) 调整 import-graph-guard.mjs 对 credentials.js 的 B-6 白名单，仅放行 PIK 所需 storage.local 访问并注释 ADR/票号；或 2) 将 PIK 存取改为经既有 storage facade（若不破坏 leaf 约定）。禁止削弱全局 B-6。重跑 import-graph-guard + node --check + 相关 cred 测试。

## 调研要求

返工以复核首脑结论为先；如与 current 决策冲突禁止静默改向。

## 完成定义

- 遵循 issue AC 与本 handoff
- 报告追加至 reports/81-report.md（标注返工轮次）
- 版本控制遵循 WORKFLOW §4.2
- 重跑 node --check + import-graph-guard 必须绿

## Suggested skills

diagnosing-bugs · implement · tdd
