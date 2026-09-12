# Destination Reconciliation — Wave8

> 日期: 2026-09-12 · 唯一数据源: `decision-ledger.md`（禁止对话回忆补写）
> 规则: 每条 current 必须有去向；无去向清单非空则停止整理

## 1. Current 记录清单与去向

| ID | 规范化需求摘要 | 去向 | 去向类型 |
|---|---|---|---|
| D-001 | 三轨全收 A→B→C；G-B 前禁 tag；不解耦记忆；禁 G-D | `plan.md` §0 范围与红线；`handoffs/next-round.md` 总目标 | 计划表 §0 |
| D-002 | 发行号 2026.9.12；新 build；G-B 用新包；闪现进本版；CHANGELOG 须鉴别同号历史 CI 包 | `plan.md` P-REL1；G-B 执行卡/CHANGELOG 实施项 | 计划表 P-REL1 |
| D-003 | G4/G5 基线只用 v2026.9.11；G5b fixture 独立 | `plan.md` P-REL2；B42 人工项说明 | 计划表 P-REL2 |
| D-004 | build 授权 amo_sign=true / make_release=false；不 tag | 已执行: run **34689649760** success；`plan.md` P-REL0 证据行 | 计划表 + 已执行证据 |
| D-005 | G-A 先分桶 atomcode 调研；冲突禁静默 revised | 已交付: `atomcode-ga-residual-research.md`；协议保留于 `plan.md` §协议 | 范围内已交付 |
| D-006 | G-A 不成立；N/B 禁豁免；T-GA1..5；与 G-B 并行；tag 锁 | `plan.md` P-GA1..P-GA5 | 计划表 P-GA* |
| D-007 | R1–R8 全量升格；Wave7 A-021..024 显式重开 | `plan.md` P-R1..P-R8 | 计划表 P-R* |
| D-008 | B40–B48 映射收敛；B41/B42/B43 独立人工项 | `plan.md` §映射表；B45/B46/B47/B48 **不再并行维护** | 计划表 + 废止映射 |

## 2. 无去向记录清单

**空。** 8/8 current 均有去向。

## 3. 计划表条目索引（详见 plan.md）

| 计划号 | 覆盖 D-xxx |
|---|---|
| §0 范围与红线 | D-001 |
| P-REL0 候选包证据 | D-004 |
| P-REL1 发行号 2026.9.12 | D-002 |
| P-REL2 G4/G5 基线 | D-003 |
| P-GA1..5 | D-006（调研协议 D-005 已满足） |
| P-R1..R8 | D-007 |
| §映射 | D-008 |
| P-HUM1 B41 慢放 | D-008 |
| P-HUM2 B42 G-B | D-001/002/003/008 |
| P-HUM3 B43 #9 | D-008 |
