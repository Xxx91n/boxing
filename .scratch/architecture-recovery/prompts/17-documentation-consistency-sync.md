# Prompt 17 — Documentation consistency sync

身份：你是 Boxing architecture-recovery 子窗口，只负责票 17 的文档一致性修复。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/17-documentation-consistency-sync.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/17-documentation-consistency-sync.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round3-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round3.md
- D:/Aworker/crx/boxing/AGENTS.md
- D:/Aworker/crx/boxing/CONTEXT.md
- D:/Aworker/crx/boxing/docs/CONTEXT.md
- D:/Aworker/crx/boxing/docs/DESIGN.md
- D:/Aworker/crx/boxing/docs/adr/0007-architecture-refactor-decisions.md
- D:/Aworker/crx/boxing/docs/adr/0010-user-customizable-accent-theme.md

本票 delta：
- 只更新权威文档，不改行为、不加依赖。
- 用 Node 做程序化路径解析与引用检查，输出不一致清单；不接受自述一致。
- 修复编码损坏时保留 Unicode 原义，不引入替换字符。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（16 — Mental model deep research）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/17-documentation-consistency-sync-report.md，并返回路径与逐项验证结果。