# Prompt 29 — Lockfile and CI sync

身份：你是 Boxing architecture-recovery 子窗口，只负责票 29 的 lockfile 与 CI 同步。

必读：
- .scratch/architecture-recovery/handoffs/29-lockfile-ci-sync.md
- .scratch/architecture-recovery/issues/29-lockfile-ci-sync.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round6-architecture-report.md
- .scratch/architecture-recovery/research-report-round6.md
- <repo root>/package.json
- <repo root>/package-lock.json
- <repo root>/.nvmrc

本票 delta：
- 只修复 lockfile 与 CI 安装门，不新增运行时依赖。
- 以 `npm ci --dry-run --ignore-scripts` 为零基线，不凭 lockfile 存在自证成功。
- 修改后必须重跑构建与静态门。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（28 — Release merge and governance deep research）和必读清单，再开始。

收工前必须生成并落盘：.scratch/architecture-recovery/29-lockfile-ci-sync-report.md，并返回路径与逐项验证结果。
