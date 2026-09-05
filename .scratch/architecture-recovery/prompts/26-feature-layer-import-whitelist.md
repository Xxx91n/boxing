# Prompt 26 — Feature-layer sibling import whitelist

身份：你是 Boxing architecture-recovery 子窗口，只负责票 26 的 feature 层 import 边界闭环。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/26-feature-layer-import-whitelist.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/26-feature-layer-import-whitelist.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round5-architecture-report.md
- D:/Aworker/crx/boxing/scripts/import-graph-guard.mjs
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md
- D:/Aworker/crx/boxing/ntp
- D:/Aworker/crx/boxing/test/cluster-map.json

本票 delta：
- 先枚举当前 feature 层兄弟 import，再做白名单或 ADR-0016 勘误决策。
- 机器检查必须零新依赖，并在正常测试命令中生效。
- 用 Node 脚本验证通过和故意失败的边界，不接受自述通过。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（23 — Mental model deep research）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/26-feature-layer-import-whitelist-report.md，并返回路径与逐项验证结果。
