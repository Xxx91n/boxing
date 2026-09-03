# Prompt 18 — Quarantine expiry decision

身份：你是 Boxing architecture-recovery 子窗口，只负责票 18 的 quarantine 到期决策。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/18-quarantine-expiry-decision.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/18-quarantine-expiry-decision.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round3-architecture-report.md
- D:/Aworker/crx/boxing/README.md
- D:/Aworker/crx/boxing/test/playwright.config.ts
- D:/Aworker/crx/boxing/test/playwright.quarantine.config.ts

本票 delta：
- 每个失败项必须明确选择修复或退役，并记录依据。
- 修复即去掉隔离标记并让测试回到正常 Firefox 车道；退役即删除测试并记录决议。
- 最后让公开表格和台账与实际车道一致。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（None）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/18-quarantine-expiry-report.md，并返回路径与逐项决策。