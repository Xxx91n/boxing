# Prompt 17 — Documentation consistency sync

身份：你是 Boxing architecture-recovery 子窗口，只负责票 17 的文档一致性修复。

必读：
- .scratch/architecture-recovery/handoffs/17-documentation-consistency-sync.md
- .scratch/architecture-recovery/issues/17-documentation-consistency-sync.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round3-architecture-report.md
- .scratch/architecture-recovery/research-report-round3.md
- <repo root>/AGENTS.md
- <repo root>/CONTEXT.md
- <repo root>/docs/CONTEXT.md
- <repo root>/docs/DESIGN.md
- <repo root>/docs/adr/0007-architecture-refactor-decisions.md
- <repo root>/docs/adr/0010-user-customizable-accent-theme.md

本票 delta：
- 只更新权威文档，不改行为、不加依赖。
- 用 Node 做程序化路径解析与引用检查，输出不一致清单；不接受自述一致。
- 修复编码损坏时保留 Unicode 原义，不引入替换字符。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（16 — Mental model deep research）和必读清单，再开始。

收工前必须生成并落盘：.scratch/architecture-recovery/17-documentation-consistency-sync-report.md，并返回路径与逐项验证结果。