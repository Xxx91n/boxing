# 窗口启动器 — 12 favicon single-flight + SWR

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/12-favicon-cache-hardening.md
- .scratch/architecture-recovery/issues/12-favicon-cache-hardening.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/43-2026-09-12-wave4-investigation.md
- .scratch/architecture-recovery/WORKFLOW.md（§4.3）
- AGENTS.md
- docs/CONTEXT.md
- ntp/favicon.js（全文）
- ctx_search source=atomcode-favicon（首脑调研）

## 阻塞
None — can start immediately

## 本票 delta
single-flight + SWR hydrate；仅改 ntp/favicon.js；禁止新依赖/权限/IDB/Cache API/_favicon。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 调研：优先复用 ctx 已索引 atomcode-favicon；若加赛，只用 handoff 提示词，串行，同会话仅一个在途。
- 不改写他人提交；不动其他票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态：None — can start immediately
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/12-favicon-cache-hardening-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
