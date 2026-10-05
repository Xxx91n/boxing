# Prompt 22 — Documentation and ADR consistency sync

身份：你是 Boxing architecture-recovery 子窗口，只负责票 22 的文档一致性修复。

必读：
- .scratch/architecture-recovery/handoffs/22-documentation-adr-consistency-sync.md
- .scratch/architecture-recovery/issues/22-documentation-adr-consistency-sync.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round4-architecture-report.md
- .scratch/architecture-recovery/research-report-round4.md
- <repo root>/AGENTS.md
- <repo root>/CONTEXT.md
- <repo root>/docs/CONTEXT.md
- <repo root>/docs/DESIGN.md
- <repo root>/docs/adr/0013-performance-optimization-grid-hash.md
- <repo root>/docs/adr/0016-sync-backup-engine-layering.md
- <repo root>/docs/agents/manifest-contract.md
- <repo root>/docs/agents/performance-anti-patterns.md
- <repo root>/manifest.json

本票 delta：
- 只更新权威文档，不改行为、不加依赖；删除或改写已失效的规则。
- 用 Node 做程序化路径解析、引用搜索和字节检查，输出不一致清单；不接受自述一致。
- 修复编码损坏时保留 Unicode 原义，不引入替换字符。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（19 — Mental model and test governance deep research；21 — Import graph guard and spec cluster mapping）和必读清单，再开始。

收工前必须生成并落盘：.scratch/architecture-recovery/22-documentation-adr-consistency-sync-report.md，并返回路径与逐项验证结果。
