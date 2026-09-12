# 窗口启动器 70-ga-set-diff-root-cause

你是 Boxing Wave8 票 70：G-A 集合差与根因定谳（H1–H4）。覆盖 A-xxx：A-025, A-037。

## 必读清单（先读再动手）

- .scratch/architecture-recovery/handoffs/70-ga-set-diff-root-cause.md
- .scratch/architecture-recovery/issues/70-ga-set-diff-root-cause.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/decision-ledger.md
- .scratch/architecture-recovery/destination-reconciliation-wave8.md
- docs/CONTEXT.md

## 本票 delta

检查点: 先拉两 run 完整失败标题。专属验收: 终表点名 data-golden/state-sync/dr-export 是否增量。

## 开工第一句

先输出：1) 本票阻塞（None (can start immediately)）是否满足；2) 上列必读清单是否已读。未满足阻塞则停下。禁止未复述就改代码。

## 收尾

报告写入 .scratch/architecture-recovery/reports/70-report.md。完成定义遵循 handoff。版本控制遵循 WORKFLOW §4.2。
