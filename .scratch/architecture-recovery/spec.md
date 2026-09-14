# Spec — Wave9.15 发行收口 + B 轨全完成（A-050..A-061）

> 数据源: `.scratch/wave9-915-release-grill/decision-ledger.md` D-001..D-009  
> 前序 Wave9 票 87–95 已 done；本 spec 仅覆盖 W915 波。  
> 目标版本: **2026.9.15** · 基线 tip `9fa4666c`（中间 G-A run 34808080000）

## A-xxx Coverage（强制全集）

| A-xxx | 票 | 段 |
|---|---|---|
| A-050 | 96 | ① |
| A-051 | 97 | ④ |
| A-052 | 98 | ② |
| A-053 | 99 | ④ |
| A-054 | 100 | ① |
| A-055 | 101 | ③ |
| A-056 | 102 | ② |
| A-057 | 103 | ④ |
| A-058 | 104 | ② |
| A-059 | 105 | ④ |
| A-060 | 106 | ③ |
| A-061 | 无票（执行：新 tip G-A + 等 G-B） | ⑤ |

## Problem Statement

Wave9 实施 land 后 tip 全绿（R1–R3/B55/版本面 2026.9.15），但 GitHub #10–12 曾 open（已按 D-005 关闭）、docs-gov dead-link 红、锐评 6/8 与 B63–B70 未收。用户要求「所有内容都要完成」（D-003）。B 轨再 land 改变 tip → 发行 G-A 必须重跑（D-004）。

## Solution

按 D-006 五段完成 A-050..A-060 → 新 tip 发行 G-A（A-061）→ 用户 G-B（2026.9.15+日期）→ tag/商店另令。

## User Stories

- 维护者只读 docs 层 Release status 即知版本/三门/欠账（A-051）。
- CI 治理面 dead-link 恢复绿（A-050）。
- 冻结点现场可读到票号指针（A-052）。
- 用户在 G-B 前不会被 agent 宣称可发行或自动 tag（A-061 / D-007）。

## Implementation Decisions

- 主序五段见 D-006 / plan；波次由 Blocked by 推导（见 README）。
- 票务混合：GH #13–#16 镜像 96/101/104/102；其余本地 issues/。
- 中间 G-A 34808080000 有效但非发行终谳（A-061）。
- G-B 用户声明；禁止 agent 代签；tag/商店另令。

## Testing Decisions

- 发行 G-A = 最终 tip test.yml 四 job 全绿。
- A-050 以 docs-gov success 为证。
- A-055/A-060 不得用 silent skip 冒充绿；A-060 无复现须书面结案。

## Out of Scope

- B61 用户 G-B 本体；B62 发行后 G-C；tag；商店上传；9.12 热修；无关重构。

## Further Notes

- 前序账本 A-040..A-049 与 D 账本 wave9-postrelease / wave9-915 保持 current，不重写。
