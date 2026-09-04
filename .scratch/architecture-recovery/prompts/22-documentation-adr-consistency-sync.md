# Prompt 22 — Documentation and ADR consistency sync

身份：你是 Boxing architecture-recovery 子窗口，只负责票 22 的文档一致性修复。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/22-documentation-adr-consistency-sync.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/22-documentation-adr-consistency-sync.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round4-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round4.md
- D:/Aworker/crx/boxing/AGENTS.md
- D:/Aworker/crx/boxing/CONTEXT.md
- D:/Aworker/crx/boxing/docs/CONTEXT.md
- D:/Aworker/crx/boxing/docs/DESIGN.md
- D:/Aworker/crx/boxing/docs/adr/0013-performance-optimization-grid-hash.md
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md
- D:/Aworker/crx/boxing/docs/agents/manifest-contract.md
- D:/Aworker/crx/boxing/docs/agents/performance-anti-patterns.md
- D:/Aworker/crx/boxing/manifest.json

本票 delta：
- 只更新权威文档，不改行为、不加依赖；删除或改写已失效的规则。
- 用 Node 做程序化路径解析、引用搜索和字节检查，输出不一致清单；不接受自述一致。
- 修复编码损坏时保留 Unicode 原义，不引入替换字符。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（19 — Mental model and test governance deep research；21 — Import graph guard and spec cluster mapping）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/22-documentation-adr-consistency-sync-report.md，并返回路径与逐项验证结果。
