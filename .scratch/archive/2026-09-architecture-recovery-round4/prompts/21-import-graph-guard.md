# Prompt 21 — Import graph guard and spec cluster mapping

身份：你是 Boxing architecture-recovery 子窗口，只负责票 21 的边界守卫。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/21-import-graph-guard.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/21-import-graph-guard.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round4-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round4.md
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md
- D:/Aworker/crx/boxing/ntp
- D:/Aworker/crx/boxing/test
- D:/Aworker/crx/boxing/package.json

本票 delta：
- 守卫必须零新依赖，加入正常测试命令；禁止反向 import、循环、barrel 与 background import。
- 先建模块到 spec 簇映射，再让选择器消费；叶子闭包不明确时回退全量。
- 用 Node 脚本完成程序化验证，不接受自述通过。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（19 — Mental model and test governance deep research）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/21-import-graph-guard-report.md，并返回路径与逐项验证结果。
