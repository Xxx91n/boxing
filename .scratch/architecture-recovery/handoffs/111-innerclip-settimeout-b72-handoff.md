# Handoff — Ticket 111: B72 innerclip setTimeout 预算（N-106-01）

> Covers: A-066 · Blocked by: None  
> Spec: `.scratch/architecture-recovery/spec.md` · Issue: `issues/111-innerclip-settimeout-b72.md`

## 一句话

innerclip 相关 spec 具备明确超时预算，装置层争用不再误伤。

## 必读

| 用途 | 路径 |
|---|---|
| 本票 | issues/111-innerclip-settimeout-b72.md |
| Spec | spec.md |
| A 账本 | decision-ledger.md（A-062 节） |
| D 账本 | ../wave9-920-grill/decision-ledger.md |
| Plan | ../wave9-920-grill/plan.md |
| 门禁 | docs/adr/0017-release-data-gate.md |
| 领域 | docs/CONTEXT.md |
| 过程 | WORKFLOW.md §4.2 |

## 通用调研（每票必做一次）

1. **atomcode 深度调研**（串行，一次一个）：与本票技术点相关的工业成熟方案，给出推荐与理由。  
2. **回顾** docs/adr 与 docs/CONTEXT.md 现有心智模型；冲突不得静默改向——记 revised 并呈报。  
3. **对标** 工业级实现/测试策略。  
调研结论写入 `reports/111-report.md` 开头，再进入实现。

## 本票 delta

- 为相关 spec 设合理 test.setTimeout 预算或等价稳定性措施
- 不扩大豁免面
- testing-governance 观察行可结案更新

## 完成定义

遵循本 handoff：AC 全勾或具名 F/N 注明；附 CI/实测锚点；A 账本 A-066 状态更新；报告落盘。  
版本控制遵循 WORKFLOW §4.2。禁止对已推送 main 换 root。

## 禁止

- 宣称三门合取达成（G-B/G-C 未齐前）  
- agent 代签 G-B  
- N 桶/数据完整性豁免  
- 未明令 push/tag/force-push  
- 热修 2026.9.15  
- 第二次 root 导出（A-P01）  

## 建议 Skill

| 场景 | Skill |
|---|---|
| 实施 | implement · tdd |
| 根因 | diagnosing-bugs · research |
| 复核 | code-review |
| 版本控制 | but |
