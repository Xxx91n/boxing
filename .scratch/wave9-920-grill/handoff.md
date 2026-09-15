# Handoff — Wave9.20 Grill 定稿（2026-09-15）

> 下一轮入口: 按 plan 五段建票并实施（建票/GitHub Issue 创建须用户下令）

## 一句话

P0 书签删除复活 + Pages G-C 升格 + B71–B77 全收 + Top-5 治理，目标版本 **2026.9.20**；tip 在 a1acaaac 线性追加；三门/tag 边界沿 ADR-0017。

## 必读

| 主题 | 路径 |
|---|---|
| 账本（唯一数据源） | .scratch/wave9-920-grill/decision-ledger.md |
| 去向对账 | destination-reconciliation.md |
| Spec / Plan | spec.md · plan.md |
| Scratch 票 | issues/01..03 |
| Q2/Q3 调研 | reports/Q2-bookmark-delete-fix-research.md · Q3-pages-sync-gate-research.md |
| 前序 handoff | ../architecture-recovery/handoffs/W915-release-handoff.md |

## 下一轮建议

1. 用户下令后创建 GH Issue：P0、gate、pages、B71、B72、B73
2. 按 plan 段①开工 P0
3. 实施波内 calver → 2026.9.20
4. 五段完成 → 新 tip G-A → 等 G-B

## 禁止

- agent 代签 G-B
- 未明令 tag / 商店
- 未明令创建 GitHub Issue（D-008）
- force-push / 换 root（D-005②）
- 恢复真实凭据
- 热修商店 9.15
- 从对话回忆补写结论（唯一数据源=账本）

## Suggested skills

| 场景 | Skill |
|---|---|
| 建票拆分 | to-spec · to-tickets（账本已成 spec/plan） |
| 实施 | implement · tdd |
| 版本控制 | but |
| 复核 | code-review |
