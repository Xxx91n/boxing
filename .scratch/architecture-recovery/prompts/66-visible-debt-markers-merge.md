# 窗口启动器 — 66 用户可见债务标记合并清理（P2）

身份: 实施票 66 的子窗口；覆盖 A-xxx: A-020。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/66-visible-debt-markers-merge.md
- .scratch/architecture-recovery/issues/66-visible-debt-markers-merge.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/decision-ledger.md
- .scratch/architecture-recovery/WORKFLOW.md
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0017-release-data-gate.md
- .scratch/wave7-flash-grill/decision-ledger.md

## 阻塞
None (can start immediately)

## 本票 delta
- ntp/index.html
- 覆盖: A-020

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时：按 handoff 内 atomcode 提示词 + ctx_batch_execute 串行调用。
- 不改写他人提交；不动其他票文件。
- 不创建隔离工作区；只在当前工作区按本票实施。

## 开工第一句（必须先输出）
先复述：阻塞状态 + 必读清单已读毕 + 本票覆盖 A-xxx；未完成复述不得改代码。

## 完成时
报告写入 .scratch/architecture-recovery/reports/66-report.md；版本控制遵循 WORKFLOW §4.2；完成定义遵循 handoff 内的完成定义。
