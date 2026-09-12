# Handoff — Wave8 收口归档（2026-09-12）

> 下一轮用途: land/push 决策 · main CI 定谳 G-A · 可选补 G-B 证据 · 发行门禁

## 一句话状态

Wave8 票 70–86 + 79R/81R/81R2 源码面闭环；本地硬验收绿（build/guards/gate2/e2e-subset 18）；**G-B 为用户强制豁免（无产物）**；**#9 已过程性关账**；**tag 仍禁**。

## 必读（勿复述其内容）

- `.scratch/architecture-recovery/reports/W8-closeout-hard-acceptance.md`
- `.scratch/architecture-recovery/reports/W8-closeout-crosscheck.md`
- `.scratch/architecture-recovery/reports/W8-merge-plan.md`
- `.scratch/architecture-recovery/reports/W8-backlog.md`
- `.scratch/architecture-recovery/reports/W8-W1|W2|W3-brain-review.md`
- `.scratch/architecture-recovery/decision-ledger.md`（A-025..A-039 已结算）
- `.scratch/wave8-release-grill/decision-ledger.md`（D-001..D-009）
- `docs/CONTEXT.md` Wave8 settle · `docs/adr/0017-release-data-gate.md`
- WORKFLOW §4.2 / §4.4

## 已就绪证据

| 项 | 值 |
|---|---|
| 候选包 | run 34689649760 · `D:/rel-2026.9.12` · 本地 build 亦产出 2026.9.12 zip |
| 本地门禁 | import-graph 0 · waiver OK · docs-pointers OK · gate2 2/2 · e2e 18/18 |
| Issue #9 | CLOSED 2026-09-12T18:04:30Z（过程性，A-039） |
| 强制豁免 | D-009/A-038：76/77 无证据产物 |

## 下一轮动作

1. 用户决定是否 `but land`（按 merge-plan 序）→ **push 须明令**
2. land 后盯 main `test.yml` 定谳 G-A
3. backlog B50–B57 由用户裁定立票
4. **禁止**在 G-A 未绿时 tag/宣称可发行

## Suggested skills

| 场景 | Skill |
|---|---|
| 版本控制 | GitButler `but` skill |
| CI/根因 | `diagnosing-bugs` · `research` |
| 实施 | `implement` · `tdd` |
| 复核 | `code-review` |
| 知识收尾 | `neat-freak` · `handoff` |
| 发行 | 遵循 ADR-0017 / WORKFLOW §4.4，不扩 G-D |

## 禁止

- 未明令不 push / 不 tag
- 不把强制 G-B 写成「证据齐全」
- 不扩 ADR-0017
