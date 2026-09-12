# 窗口启动器 71-ga-nq-bucket-fix

你是 Boxing Wave8 票 71：G-A N 桶修绿。覆盖 A-xxx：A-025。

## 必读清单（先读再动手）

- .scratch/architecture-recovery/handoffs/71-ga-nq-bucket-fix.md
- .scratch/architecture-recovery/issues/71-ga-nq-bucket-fix.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/decision-ledger.md
- .scratch/architecture-recovery/destination-reconciliation-wave8.md
- docs/CONTEXT.md

## 本票 delta

检查点: 禁止写豁免。专属验收: data-golden job 与主 lane 同绿。

## 开工第一句

先输出：1) 本票阻塞（70 ga-set-diff-root-cause）是否满足；2) 上列必读清单是否已读。未满足阻塞则停下。禁止未复述就改代码。

## 收尾

报告写入 .scratch/architecture-recovery/reports/71-report.md。完成定义遵循 handoff。版本控制遵循 WORKFLOW §4.2。
