# Handoff — Ticket 92: B56 boot-pending 专项 e2e

> Covers: A-046 · Blocked by: None (can start immediately)  
> Spec: `.scratch/architecture-recovery/spec.md` · Issue: `issues/92-boot-pending-e2e-b56.md`

## 一句话

B56 boot-pending 专项 e2e（2026.9.15 波）。

## 必读

| 用途 | 路径 |
|---|---|
| 本票 | issues/92-boot-pending-e2e-b56.md |
| Spec | spec.md |
| A 账本 | decision-ledger.md（A-040..） |
| D 账本 | ../wave9-postrelease-grill/decision-ledger.md |
| 定谳 | ../wave9-postrelease-grill/ga-definitive-b4f3df2.md |
| 计划 | ../wave9-postrelease-grill/plan.md |
| 门禁 | docs/adr/0017-release-data-gate.md |
| 领域 | docs/CONTEXT.md |
| 过程 | WORKFLOW.md §4.2 |

## 通用调研（每票必做一次）

1. **atomcode 深度调研**（串行一次一个）：与本票技术点相关的工业成熟方案，给出推荐与理由。  
2. **回顾** docs/adr 与 docs/CONTEXT.md 现有心智模型；冲突不得静默改向——记 revised 并呈报。  
3. **对标** 工业级实现/测试策略（Playwright 扩展 e2e、合并策略、CI 门禁等）。  
调研结论写入 `reports/92-report.md` 开头，再进入实现。

## 完成定义

遵循本 handoff：AC 全勾或具名 F/N 注明；附 CI/实测锚点；账本状态更新；报告落盘。  
版本控制遵循 WORKFLOW §4.2。禁止对已推送 main 换 root。

## 禁止

- 宣称 2026.9.12 三门达成  
- agent 代签 G-B  
- N 桶/数据完整性豁免  
- 未明令 push/tag/force-push  

## 建议 Skill

| 场景 | Skill |
|---|---|
| 实施 | implement · tdd |
| 根因 | diagnosing-bugs · research |
| 复核 | code-review |
| 版本控制 | but |
