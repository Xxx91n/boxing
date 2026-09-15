# Spec — Wave9.20 全收 + Pages 同步门禁

> 唯一数据源: `.scratch/wave9-920-grill/decision-ledger.md` D-001..D-008
> 目标版本: **2026.9.20** · 基线 `origin/main a1acaaac` 之上线性追加（D-001/D-005/D-007）

## Problem Statement

2026.9.15 已三门齐并发行/商店上架，但：

1. **P0**：书签单条删除旁路 commit、不写墓碑，经 mergeById 并集复活（D-002）；用户实测日志与代码实物一致。
2. **Pages 不过时无门禁**：G-C 仅三 URL 200，无法发现「过时但 200」（D-001/D-003）。
3. **锐评 Top-5 与 B71–B77 未收**；用户要求全收（D-001/D-004/D-005）。
4. **release-status 自相矛盾**（D-005）；**3 条 F 豁免 09-19 到期**（D-004⑨/D-005③）。
5. **D-008 线性追加**须用本波提交证明（D-005②）。

## Solution

按 D-007 五段：①P0+静态门禁 → ②测试硬化 → ③Pages/G-C → ④文档收口 → ⑤新 tip G-A 全绿 → 等用户 G-B → tag/商店另令。

## User Stories

- 作为用户，删除书签后重进/同步不再复活；删除走 commit 且墓碑可被 merge 过滤。
- 作为发行检查员，G-C 能断言 demo version.json == 最新 tag，而非仅 200。
- 作为审计者，release-status 只有一个现役状态块，与 tag/商店事实一致。
- 作为维护者，layout 数据删除旁路会被 pretest 静态门禁拦下。

## Implementation Decisions

- **P0**（D-002）：`deleteBookmark` mutationHandler + `commit`；姊妹静态门禁；never-quarantine 回归 spec。add/reorder 是否同票 = P0 票 open note。
- **Pages**（D-003）：G-C = 200 + version.json（cache-buster）== tag；deploy 尾部 verify ≤180s；保留人工检查单；实施时显式修订 ADR-0017 G-C 行。
- **Backlog**（D-004）：B71/B72/B73/B74/B75(并入 Pages)/B77 进表；B76/B78 范围外。
- **治理**（D-005）：release-status 单一状态块；线性追加红线；豁免清零绑 G-A。
- **票务**（D-007）：GitHub = P0、static-gate、pages-gc、B71、B72、B73；scratch = release-status、B74、B77。
- **版本**（D-007）：calver 推至 2026.9.20。

## Testing Decisions

- 回归：add → delete → 陈旧合并/reload → 不复活 + `_meta.deleted` 含 bmId（D-002，禁豁免）。
- G-A：新 tip test.yml 四 job 全绿；active F 应 0（D-006）。
- G-C：升级断言 + 部署 verify（D-003/D-006）。

## Out of Scope

- B76 商店 listing；B78；tag/商店提交；G-B 执行；9.15 热修；grill 内修源码；未下令前创建 GitHub Issue（D-004/D-006/D-008）。

## Further Notes

- 调研: reports/Q2-bookmark-delete-fix-research.md · Q3-pages-sync-gate-research.md
- 前序 D/A 账本不重写。
