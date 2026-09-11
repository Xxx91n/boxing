# 窗口启动器 — 40 P0 修复 settings.css 缺失花括号导致 hidden 遮罩失效

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/40-css-hidden-brace-p0.md
- .scratch/architecture-recovery/issues/40-css-hidden-brace-p0.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2 / §4.3）
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0009-3-2-1-data-resilience.md
- docs/adr/0016-sync-backup-engine-layering.md

## 阻塞
None — can start immediately

## 本票 delta
只动 settings.css（补一个 }）+ 必要时 onboarding.css 拼接边界；不改 JS 行为；build 后跑 onboarding+extension-test。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时：用 handoff 内 atomcode 提示词 + ctx_batch_execute 串行调用；并回顾 docs/adr 与 docs/CONTEXT.md。
- 不改写他人提交；不动其他票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态：None — can start immediately
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/40-css-hidden-brace-p0-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
