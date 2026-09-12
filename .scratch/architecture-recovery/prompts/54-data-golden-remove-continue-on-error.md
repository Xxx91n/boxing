# 窗口启动器 — 54 @data-golden 摘除 continue-on-error

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/54-data-golden-remove-continue-on-error.md
- .scratch/architecture-recovery/issues/54-data-golden-remove-continue-on-error.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/decision-ledger.md
- .scratch/architecture-recovery/WORKFLOW.md
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0009-3-2-1-data-resilience.md
- docs/adr/0017-release-data-gate.md

## 阻塞
None (can start immediately)

## 本票 delta
2026-09-18 前摘 continue-on-error 且绿。
调研与工业对标细节只看 handoff，不在此复述。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时：按 handoff 内 atomcode 提示词 + ctx_batch_execute 串行调用。
- 不改写他人提交；不动其他票文件。
- 不创建隔离工作区、不切换分支；只在当前工作区按本票实施。

## 开工第一句（必须先输出）
1. 复述阻塞状态：None (can start immediately)
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/54-data-golden-remove-continue-on-error-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
