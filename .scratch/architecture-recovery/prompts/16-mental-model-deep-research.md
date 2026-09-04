# Prompt 16 — Mental model deep research

身份：你是 Boxing architecture-recovery 子窗口，只负责票 16 的深度调研，不修改代码。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/16-mental-model-deep-research.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/16-mental-model-deep-research.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round3-architecture-report.md
- D:/Aworker/crx/boxing/docs/CONTEXT.md
- D:/Aworker/crx/boxing/CONTEXT.md
- D:/Aworker/crx/boxing/docs/adr/0007-architecture-refactor-decisions.md
- D:/Aworker/crx/boxing/docs/adr/0010-user-customizable-accent-theme.md
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md

本票 delta：
- 调用 $atomcode-research；同会话一次只允许一个调研在途，先串行完成再报告。
- 先回顾指定文档中的现有心智模型，再拿外部证据比较。
- 完整 atomcode 提示词（verbatim，直接发送）：全景调研 2026 年浏览器扩展新标签页的无框架 ES module 架构心智模型，重点对比当前工业界已落地、可复用的模块边界与治理模板；先给出对比矩阵，再判断哪些心智模型适合一个已经按不变量拆分的 vanilla JS 新标签页项目，指出还缺什么以及最优组合。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（None）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round3.md，并返回路径与最终推荐。