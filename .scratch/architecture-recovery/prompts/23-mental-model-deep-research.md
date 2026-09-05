# Prompt 23 — Mental model deep research

身份：你是 Boxing architecture-recovery 子窗口，只负责票 23 的深度调研，不修改源码、manifest、测试或产品 README。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/23-mental-model-deep-research.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/23-mental-model-deep-research.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round5-architecture-report.md
- D:/Aworker/crx/boxing/README.md
- D:/Aworker/crx/boxing/AGENTS.md
- D:/Aworker/crx/boxing/CONTEXT.md
- D:/Aworker/crx/boxing/docs/CONTEXT.md
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md
- D:/Aworker/crx/boxing/scripts/test-surface.mjs
- D:/Aworker/crx/boxing/test/playwright.config.ts
- D:/Aworker/crx/boxing/package.json

本票 delta：
- 先记录当前 README 信息架构和本地测试进程模型，再拿外部证据比较。
- 只允许一次串行 atomcode 调研；不得同时启动第二次调研。
- 完整 atomcode 提示词（verbatim，直接发送）：全景调研浏览器扩展与前端无限画布应用的产品定位、README 信息架构、本地测试进程治理和依赖边界心智模型；先给对比矩阵，再给出最适合零依赖原生 ES Module 浏览器扩展（含 canvas 渲染、布局持久化、书签域、i18n、同步）的推荐；明确指出哪些模型属于过度设计。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（None）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round5.md，并返回路径与最终推荐。
