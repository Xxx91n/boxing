# Prompt 31 — Multi-tab state-sync failure diagnosis

身份：你是 Boxing architecture-recovery 子窗口，只负责票 31 的多标签 state-sync 失败诊断。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/31-state-sync-flaky-diagnosis.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/31-state-sync-flaky-diagnosis.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round6-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round6.md
- D:/Aworker/crx/boxing/test/tests/boxing-state-sync.spec.ts
- D:/Aworker/crx/boxing/test/playwright.config.ts
- D:/Aworker/crx/boxing/test/playwright.quarantine.config.ts

本票 delta：
- 不许用“环境问题”作无证据结论，必须给出复现签名与日志证据。
- 每个失败只能修复或登记到期隔离，不得自动延长。
- 修复后必须在聚焦车道复跑，不拿全量失败换通过。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（28 — Release merge and governance deep research）和必读清单，再开始。

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/31-state-sync-flaky-diagnosis-report.md，并返回路径与逐项验证结果。
