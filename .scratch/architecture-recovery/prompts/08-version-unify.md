# 窗口启动器 — 08 版本字符串统一 + version_name 注入

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/08-version-unify.md
- .scratch/architecture-recovery/issues/08-version-unify.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md（仅 §4.2 版本控制、§4.3 调研纪律）
- AGENTS.md
- docs/CONTEXT.md
- （无必需 ADR）38-2026-09-12-release-architecture-investigation.md §2

## 阻塞
Blocked by: 01 icons, 02 readme-sync, 03 store-i18n

## 本票 delta
全部版本位置 → 2026.9.12；build.mjs 同时覆盖 version_name；页脚不再 v3.6.6。清单见 investigation §2。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止在本文件或回复中出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时：先读本票 handoff 内的 atomcode 提示词，用 ctx_batch_execute 串行调用 atomcode-research；并回顾 docs/adr 与 docs/CONTEXT.md。
- 不改写他人提交；不动其他票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态：Blocked by: 01 icons, 02 readme-sync, 03 store-i18n
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/08-version-unify-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
