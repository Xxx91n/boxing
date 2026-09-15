# Handoff — Ticket 107: P0 书签删除走 commit + 墓碑

> Covers: A-062 · Blocked by: None  
> Spec: `.scratch/architecture-recovery/spec.md` · Issue: `issues/107-bookmark-delete-commit-p0.md`

## 一句话

用户删除单书签后，退出再进/跨表合并不再复活；删除经 commit(deleteBookmark) 写墓碑。

## 必读

| 用途 | 路径 |
|---|---|
| 本票 | issues/107-bookmark-delete-commit-p0.md |
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
调研结论写入 `reports/107-report.md` 开头，再进入实现。

## 本票 delta

- mutationHandlers.deleteBookmark 返回 tombstoneIds:[bmId]
- popups 删除按钮走 commit，废弃裸 splice
- 回归：add→delete→陈旧合并/reload→不复活 + _meta.deleted 含 bmId
- never-quarantine：禁豁免
- open note: add/reorder 是否同票收编

## 完成定义

遵循本 handoff：AC 全勾或具名 F/N 注明；附 CI/实测锚点；A 账本 A-062 状态更新；报告落盘。  
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
