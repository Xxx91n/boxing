# 窗口启动器 — 10 点击标题全选

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/10-title-select-all.md
- .scratch/architecture-recovery/issues/10-title-select-all.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md（§4.2）
- AGENTS.md（SEC-03）
- docs/CONTEXT.md
- ntp/render.js（title mousedown 三处）
- test/tests/boxing-focus-steal.spec.ts

## 阻塞
09 — create-render-decouple（必须先确认 09 已完成；勿与 09 并行改同一文件）

## 本票 delta
三处 title 点击 focus+全选；crumb 补 focus；不碰创建管线。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 不改写他人提交；不动其他票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态与 09 完成情况
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/10-title-select-all-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
