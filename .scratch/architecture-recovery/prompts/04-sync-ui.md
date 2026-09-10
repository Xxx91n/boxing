# 窗口启动器 — 04 Sync 页视觉分组

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/04-sync-ui.md
- .scratch/architecture-recovery/issues/04-sync-ui.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md（仅 §4.2 版本控制、§4.3 调研纪律）
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0016-sync-backup-engine-layering.md、docs/css-dual-write-convention.md

## 阻塞
None — can start immediately

## 本票 delta
tab-sync 共享 vs WebDAV vs Gist 分组；不改 sync-engine 互斥；加 Playwright 互斥断言。CSS 遵循 dual-write。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止在本文件或回复中出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时：先读本票 handoff 内的 atomcode 提示词，用 ctx_batch_execute 串行调用 atomcode-research；并回顾 docs/adr 与 docs/CONTEXT.md。
- 不改写他人提交；不动其他票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态：None — can start immediately
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/04-sync-ui-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
