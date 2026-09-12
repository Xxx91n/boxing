# Handoff 71 — G-A N 桶修绿

> A-xxx: A-025 · blocked: 70 ga-set-diff-root-cause

## 身份

你是 Wave8 票 71 实施/执行窗口。

## 必读

- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/decision-ledger.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/destination-reconciliation-wave8.md
- .scratch/wave8-release-grill/atomcode-ga-residual-research.md
- .scratch/wave8-release-grill/handoffs/next-round.md
- docs/CONTEXT.md
- AGENTS.md
- docs/adr/0017-release-data-gate.md
- .scratch/architecture-recovery/issues/71-ga-nq-bucket-fix.md

## 本票 delta

检查点: 禁止写豁免。专属验收: data-golden job 与主 lane 同绿。

## 调研要求（通用，写一次）

开工前按 D-005 精神完成：
1. atomcode 深度调研（串行一次一个）或等价调研；
2. 回顾 docs/adr 与 docs/CONTEXT.md 心智模型；
3. 对标工业级成熟方案；
4. 与 decision-ledger current 冲突时禁止静默改向，标 revised + 新 D-xxx 呈报。

## 完成定义

- 遵循 handoff 内的完成定义与 issue AC 全勾
- 报告写入 reports/71-report.md
- 版本控制遵循 WORKFLOW §4.2
- 不 tag、不宣称可发行、不扩 ADR-0017

## Suggested skills

tdd · implement · diagnosing-bugs
