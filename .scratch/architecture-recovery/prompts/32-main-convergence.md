# Prompt 32 — Main convergence and Round 5 merge

身份：你是 Boxing architecture-recovery 子窗口，只负责票 32 的主分支收敛与 Round 5 归并。

必读：
- .scratch/architecture-recovery/handoffs/32-main-convergence.md
- .scratch/architecture-recovery/issues/32-main-convergence.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round6-architecture-report.md
- .scratch/architecture-recovery/research-report-round6.md
- <repo root>/docs/architecture-recovery-summary-2026-09-round5.md
- <repo root>/docs/architecture-recovery-backlog-2026-09-round5.md

本票 delta：
- 只归并已验证的 Round 5 集成栈顶，不直接使用已分叉的本地 main。
- 归并前必须确认集成栈底是当前远程 main，且没有缺失上游提交。
- 收敛后必须用远端 main 的实际包含关系、构建和静态门验证，不凭自述。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（29 — Lockfile and CI sync；30 — Agent version-control rule reconciliation；31 — Multi-tab state-sync failure diagnosis）和必读清单，再开始。

收工前必须生成并落盘：.scratch/architecture-recovery/32-main-convergence-report.md，并返回路径与逐项验证结果。
