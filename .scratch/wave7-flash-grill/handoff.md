# Wave7 Grill 整理 Handoff（2026-09-12）

## 一句话

D-001..D-004 已定稿入账；去向对账无去向 0；计划表 W7-T1..T7 与范围外 R1–R9 已落盘；CONTEXT 已增补零闪现词条；未修源码、未开 GitHub issue、未改 ADR-0017。

## 读序

1. .scratch/wave7-flash-grill/decision-ledger.md（唯一权威 current）
2. .scratch/wave7-flash-grill/destination-reconciliation.md
3. .scratch/wave7-flash-grill/plan.md
4. docs/CONTEXT.md → UX / Cache invariants（zero-flash / paint-critical boot mirror）

## 下一步（需用户令）

| 步 | 动作 |
|---|---|
| 1 | 确认定稿 / 授权立 GitHub issue（W7-T1 优先） |
| 2 | G-B 仍由用户按 evidence/49 实机（并行，不阻塞 T1） |
| 3 | 实施 T1 前再开实现窗口；本整理窗口不写 ntp 源码 |

## 红线（重申账本）

- G-B 完成前禁 tag / 禁宣称可发行
- 闪现不解耦记忆；不扩 ADR-0017；不设 G-D
