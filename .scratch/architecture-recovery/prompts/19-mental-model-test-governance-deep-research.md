# Prompt 19 — Mental model and test governance deep research

身份：你是 Boxing architecture-recovery 子窗口，只负责票 19 的深度调研，不修改代码。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/19-mental-model-test-governance-deep-research.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/19-mental-model-test-governance-deep-research.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round4-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round3.md
- D:/Aworker/crx/boxing/AGENTS.md
- D:/Aworker/crx/boxing/CONTEXT.md
- D:/Aworker/crx/boxing/docs/CONTEXT.md
- D:/Aworker/crx/boxing/docs/DESIGN.md
- D:/Aworker/crx/boxing/docs/adr/0013-performance-optimization-grid-hash.md
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md
- D:/Aworker/crx/boxing/test/playwright.config.ts
- D:/Aworker/crx/boxing/test/playwright.quarantine.config.ts
- D:/Aworker/crx/boxing/package.json

本票 delta：
- 调用 $atomcode-research；同会话一次只允许一个调研在途，先串行完成再报告。
- 先回顾指定文档中的现有心智模型和测试现状，再拿外部证据比较。
- 完整 atomcode 提示词（verbatim，直接发送）：对比工业级前端浏览器扩展项目在测试执行治理与多智能体并行修改时的成熟架构心智模型，重点覆盖增量测试选择、影响面检测、并发上限、模块依赖边界与门面隔离；要求先给对比矩阵和单一最小落地建议，说明哪些适合零构建原生 ES module 的 Chrome/Firefox 新标签页扩展，并指出常见的过度设计反模式。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（None）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round4.md，并返回路径与最终推荐。
