# Spec — Wave9.20 全收 + Pages 同步门禁 + P0 书签删除

> 上游: `.scratch/wave9-920-grill/decision-ledger.md` D-001..D-008  
> A 账本: 本目录 decision-ledger.md A-062..A-071 · A-P01..P03  
> 目标版本: **2026.9.20** · 基线 `a1acaaac` 线性追加

## Problem Statement

1. 用户删除书签后退出再进，书签复活（P0，商店产品内，数据完整性家族）。
2. G-C 仅 HTTP 200，Pages 可过时而不红。
3. B71–B77 与 release-status 矛盾、豁免到期未清（全收）。

## Solution

①P0 deleteBookmark+门禁 → ②测试硬化 → ③Pages G-C → ④文档 → ⑤G-A → 用户 G-B → tag 另令。

## A-xxx 覆盖声明

| A-xxx | 来源 | 覆盖票 |
|---|---|---|
| A-062 | grill/research | **107** |
| A-063 | grill/research | **108** |
| A-064 | grill/research | **109** |
| A-065 | grill/research | **110** |
| A-066 | grill/research | **111** |
| A-067 | grill/research | **112** |
| A-068 | grill/research | **113** |
| A-069 | grill/research | **114** |
| A-070 | grill/research | **115** |
| A-071 | grill/research | **116** |
| A-P01 | D-005② | 全票过程红线（无独立票） |
| A-P02 | D-004⑨ | G-A 出口（无独立票） |
| A-P03 | D-006 | 出口边界（无独立票） |

## User Stories

1. 作为用户，删除书签后重进/同步不再复活。
2. 作为维护者，layout 旁路删除会被静态门禁拦下。
3. 作为发行检查员，G-C 断言 version.json == 最新 tag。
4. 作为审计者，release-status 只有一个现役状态块。
5. 作为用户，9.20 在 G-A∧G-B∧G-C 前不被宣称可发行。

## Implementation Decisions

- A-062: `deleteBookmark` + `commit` + never-quarantine 回归；add/reorder 实施裁定。
- A-063: 静态门禁白名单注释；与 A-062 同波。
- A-064: G-C 升格 + deploy verify；ADR-0017 显式修订。
- A-065..A-071: 见各 issue AC。
- 票务: 本地 issue 107–116（本命令授权 scratch 票；GitHub Issue 仍待另令）。

## Testing Decisions

- 外部行为：删除后 reload/合并不复活 + 墓碑键存在。
- 门禁：故意旁路应 exit 1。
- G-A: 新 tip test.yml 四 job 全绿；active F=0。

## Out of Scope

- B76 商店 listing；B78；tag/商店/G-B 执行；9.15 热修；GitHub Issue 创建（另令）。

## Further Notes

- Grill spec/plan: ../wave9-920-grill/
- 调研: ../wave9-920-grill/reports/
