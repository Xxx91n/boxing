# Prompt 28 — Release merge and governance deep research

身份：你是 Boxing architecture-recovery 子窗口，只负责票 28 的 Round 6 治理调研，不实施代码改动。

必读：
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/28-release-merge-governance-research.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/28-release-merge-governance-research.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round6-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round5.md
- D:/Aworker/crx/boxing/docs/adr/0016-sync-backup-engine-layering.md

本票 delta：
- 只允许一次串行 atomcode 调研，完成前不得发起第二次。
- 调研问题必须原样发给 atomcode，不得预列搜索角度、关键产品或来源域名。
- 报告必须给出对比矩阵、推荐模板、来源清单和诚实的信息缺口。

版本控制：遵循 WORKFLOW §4.2。
完成定义：遵循 handoff 内的完成定义。

开工第一句：先复述本票阻塞（None — can start immediately）和必读清单，再开始。

atomcode 调研命令（通过 ctx 包裹，串行）：

atomcode -p "全景调研零依赖浏览器扩展大型新标签页代码库的工业级成熟架构心智模型：原生 ES Module 模块边界、测试选择与 Git 多分支归并主分支的最佳实践，先给对比矩阵，再给落地模板。"

收工前必须生成并落盘：D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round6.md，并返回路径与逐项验证结果。
