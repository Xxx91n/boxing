# 窗口启动器 — 07 release 自动 Pages 预览

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/07-pages-demo.md
- .scratch/architecture-recovery/issues/07-pages-demo.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md（仅 §4.2 版本控制、§4.3 调研纪律）
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0016-sync-backup-engine-layering.md（storage 路径）、已索引 atomcode 报告

## 阻塞
Blocked by: 06 pages-index

## 本票 delta
demo/ NTP 镜像 + chrome stub；demo-deploy.yml 官方 artifact 模式；version.json=tag。人工 Pages source 切换写进报告。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止在本文件或回复中出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时：先读本票 handoff 内的 atomcode 提示词，用 ctx_batch_execute 串行调用 atomcode-research；并回顾 docs/adr 与 docs/CONTEXT.md。
- 不改写他人提交；不动其他票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态：Blocked by: 06 pages-index
2. 复述必读清单（逐条路径）
3. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/07-pages-demo-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
