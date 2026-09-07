# Prompt 31R — State-sync focused-lane rework

身份：你是 Boxing architecture-recovery 子窗口，只负责票 31 的 focused state-sync 车道重跑与收口。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/31-review-verification.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/31-state-sync-flaky-diagnosis-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/31-state-sync-flaky-diagnosis.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/31-state-sync-flaky-diagnosis.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/test/tests/boxing-state-sync.spec.ts
- D:/Aworker/crx/boxing/test/playwright.config.ts

本票 delta：
- 必须实际执行 focused state-sync lane，不得再用历史全量证据替代。
- 执行命令必须经 test-mutex 包裹，禁止多窗口无互斥并发。
- 完成后把 issue 31 的 Status 改为 done，并保留 host-incident 到期日不自动延长。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（28 — Release merge and governance deep research）和复核缺口（focused state-sync lane 未实际重跑），再开始。

建议执行命令：

node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts test/tests/boxing-state-sync.spec.ts --project=chromium-extension

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/31-state-sync-focused-rerun-report.md，并返回路径与逐项验证结果。
