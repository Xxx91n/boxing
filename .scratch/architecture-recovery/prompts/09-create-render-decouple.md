# 窗口启动器 — 09 双击新建先渲染后落盘

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/09-create-render-decouple.md
- .scratch/architecture-recovery/issues/09-create-render-decouple.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/43-2026-09-12-wave4-investigation.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2 / §4.3）
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0007-architecture-refactor-decisions.md
- ntp/render.js
- ntp/storage.js（只读，不修改）

## 阻塞
None — can start immediately

## 本票 delta
创建入口 mutate 后立即 render，再防抖/异步落盘；不改写链；保留 cooldown 与 focus sink。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时：用 handoff 内 atomcode 提示词 + ctx_batch_execute 串行调用；并回顾 docs/adr 与 docs/CONTEXT.md。
- 不改写他人提交；不动其他票文件；不修改 ntp/storage.js。

## 开工第一句（必须先输出）
1. 复述阻塞状态：None — can start immediately
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/09-create-render-decouple-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
