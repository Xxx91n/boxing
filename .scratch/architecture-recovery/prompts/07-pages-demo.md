# 窗口启动器 — 07 pages-demo (release 自动 Pages 预览) [复核后重发]

身份: Boxing 子窗口实施代理, 只做本票, 不跨票。

## 背景 (首脑复核)

Wave1 复核: 06 pages-index 已 DONE (ticket-06-pages-index @ sup,lnv), 本票阻塞边解除, 进入 frontier。
复核报告: .scratch/architecture-recovery/reports/40-wave1-brain-review.md

## 必读 (动手前全部读完)

- .scratch/architecture-recovery/handoffs/07-pages-demo.md
- .scratch/architecture-recovery/issues/07-pages-demo.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md (仅 §4.2 版本控制、§4.3 调研纪律)
- AGENTS.md
- docs/CONTEXT.md
- docs/adr/0016-sync-backup-engine-layering.md
- docs/index.md (06 产出, 预览入口已预留)
- .scratch/architecture-recovery/reports/40-wave1-brain-review.md

## 阻塞

已解除: 06 pages-index DONE (branch ticket-06-pages-index @ sup,lnv)

## 本票 delta

路径锚点: demo/, .github/workflows/demo-deploy.yml, version.json。
1. demo/ 子工程: NTP 静态镜像 + chrome.* stub (storage/local mock)。
2. .github/workflows/demo-deploy.yml: 官方 artifact 模式 (upload-pages-artifact + deploy-pages)。
3. 触发: release published + workflow_dispatch; 注入 version.json = release tag。
4. 人工步骤写进报告: Settings → Pages → Source = GitHub Actions (不代操作)。
5. 不使用 gh-pages 分支模式 (GITHUB_TOKEN 推不触发 Pages)。
6. 与 06 的 docs/index.md Preview 段衔接: demo 落地后可链到预览路径。

## 硬约束

- 版本控制表述只写「遵循 WORKFLOW §4.2」, 禁止在本文件或回复中出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时: 先读本票 handoff 内的 atomcode 提示词, 用 ctx_batch_execute 串行调用 atomcode-research; 并回顾 docs/adr 与 docs/CONTEXT.md。
- 不改写他人提交; 不动其他票文件。
- 分支并行: 与 01/02/04/05/06 各分支互不影响, 只写本票文件。

## 开工第一句 (必须先输出)

1. 复述阻塞状态: 已解除 (06 DONE)
2. 复述必读清单 (逐条路径)
3. 复述首脑复核结论: 本票进入 frontier
4. 然后才开始读文件/改代码

## 质检要求

提交前先自检一次: demo 入口可 standalone 打开 (无扩展 API 崩溃)、workflow YAML 语法、version.json 注入点存在。

## 完成时

- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/07-pages-demo-report.md
- 报告须含: demo 结构、stub API 面、workflow 触发条件、人工 Pages source 步骤
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
