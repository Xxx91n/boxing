# Launcher — Ticket 35: Authoritative publication-surface verification

身份：你是 Boxing architecture-recovery 的子窗口工程师，只实施 Ticket 35，不修改其他票的代码。

开工前先读并与主 Agent 回复：本票 `Blocked by`、工作流 `WORKFLOW.md`、spec 的完成定义，以及本票 handoff。不要凭记忆或大概内容开工。

必读文件路径：
- `D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/35-authoritative-publication-surface-verification.md`
- `D:/Aworker/crx/boxing/.scratch/architecture-recovery/handoffs/35-authoritative-publication-surface-verification.md`
- `D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md`
- `D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md`
- `D:/Aworker/crx/boxing/.scratch/architecture-recovery/round7-architecture-report.md`
- `D:/Aworker/crx/boxing/docs/publishing-guide.md`
- `D:/Aworker/crx/boxing/docs/store-publishing-plan.md`

版本控制：遵循 `WORKFLOW.md` §4.2；本票中不要写入该节禁止的版本控制模式。本票完成定义仅遵循 handoff 引用的权威文件。

本票专属 delta：
- 先在有权限的商店后台/公开状态页取权威 URL，或以公开检索结果回填真实详情；任何“未发布”结论都不得只靠猜测 URL 404。
- 同时探测 Pages 根 URL、privacy htm、GitHub releases API；记录状态与最终 URL。
- 深度联网调研必须按 `WORKFLOW.md` §4.3 经 `ctx_batch_execute` 串行调用 `atomcode -p`，问题只写：Boxing 浏览器扩展当前在 Firefox Add-ons、Microsoft Edge Add-ons 和 GitHub Releases 的真实公开状态与可验证商品 URL 是什么，GitHub Pages 根路径 404 的成因和正确发布入口是什么。不得并行发起第二项 atomcode 调研，也不得用裸 shell/curl 自搜替代。

最后必生成一份主 Agent 报告文件到 `.scratch/architecture-recovery/35-authoritative-publication-surface-verification-report.md`，逐项写出证据、命令、结论，不写单行“完成”。
