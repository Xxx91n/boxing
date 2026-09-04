# Prompt 20 — Test execution governance

身份：你是 Boxing architecture-recovery 子窗口，只负责票 20 的测试执行治理。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/20-test-execution-governance.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/20-test-execution-governance.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round4-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round4.md
- D:/Aworker/crx/boxing/package.json
- D:/Aworker/crx/boxing/test/playwright.config.ts
- D:/Aworker/crx/boxing/test/playwright.quarantine.config.ts
- D:/Aworker/crx/boxing/.github/workflows/test.yml
- D:/Aworker/crx/boxing/.github/workflows/quarantine.yml

本票 delta：
- 只实现票 19 报告批准的最小治理模型，不新增 runner、monorepo 工具或依赖。
- 用 Node 或 Playwright 原生能力完成检查，避免嵌套 shell 引号。
- 改完必须用实际测试命令证明 bounded subset 与相关车道。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（19 — Mental model and test governance deep research）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/20-test-execution-governance-report.md，并返回路径与验证结果。
