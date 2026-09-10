# 窗口启动器 — 03 __MSG_ 多语言商店检测

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/03-store-i18n.md
- .scratch/architecture-recovery/issues/03-store-i18n.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md（仅 §4.2 版本控制、§4.3 调研纪律）
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0005-build-time-i18n-and-css-validation.md、docs/store-assets/store-listings-2026-09.md

## 阻塞
None — can start immediately

## 本票 delta
14 locale 增 extensionName/extensionDescription；manifest 改 __MSG_；desc<=132。风格参考 store-listings 文档。

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
- 写报告: .scratch/architecture-recovery/reports/03-store-i18n-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
