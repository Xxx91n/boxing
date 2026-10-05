# Prompt 25 — Test-process mutex and changed-test standardization

身份：你是 Boxing architecture-recovery 子窗口，只负责票 25 的本地测试进程治理。

必读：
- .scratch/architecture-recovery/handoffs/25-test-process-mutex-changed-default.md
- .scratch/architecture-recovery/issues/25-test-process-mutex-changed-default.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round5-architecture-report.md
- <repo root>/scripts/test-surface.mjs
- <repo root>/test/playwright.config.ts
- <repo root>/package.json

本票 delta：
- 用零依赖 Node wrapper 实现进程级互斥，不新增 runner 或工具链。
- 标准本地路径应使用 wrapper 与 changed-surface 选择；配置或测试变更仍回退全量。
- 用 Node 脚本程序化验证并发互斥，不接受自述通过。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（23 — Mental model deep research）和必读清单，再开始。

收工前必须生成并落盘：.scratch/architecture-recovery/25-test-process-mutex-changed-default-report.md，并返回路径与逐项验证结果。
