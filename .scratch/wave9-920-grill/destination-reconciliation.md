# Wave9.20 destination reconciliation（D 账本 D-001..D-008）

> 唯一数据源: `.scratch/wave9-920-grill/decision-ledger.md`
> 日期: 2026-09-15 · 定稿后整理
> 纪律: 禁止从对话回忆补充；无去向非空则不得进入 spec/plan

| ID | 规范化要点（摘自账本） | 去向 |
|---|---|---|
| D-001 | C 全收 + 新增 Pages 同步门禁；版本 2026.9.20；tip 在 a1acaaac 线性追加 | spec Problem/Solution/范围 · plan 总述 · 版本面段 |
| D-002 | P0 = deleteBookmark 走 commit + 姊妹静态门禁 + never-quarantine 回归；add/reorder 实施时裁定 | GH 票 P0 · GH 票 static-gate · plan 段① · spec Implementation/Testing · P0 票内 open note |
| D-003 | G-C 升格：200 + version.json==tag + deploy 尾部 verify；保留人工检查单；修订 ADR-0017/release-status/publishing-guide；吸收 B75 | GH 票 pages-gc · plan 段③ · spec Implementation · ADR-0017 修订属实施 AC |
| D-004 | B71/B72/B73/B74/B75/B77 进 9.20；B76 不做；B78 已消；豁免清零=出口条件 | GH B71 · GH B72 · GH B73 · scratch B74 · Pages 票含 B75 · scratch B77 · plan 出口 · 范围外表 |
| D-005 | release-status 单一状态块；D-008 线性=过程红线；豁免清零= G-A 出口；静态门禁= D-002 | scratch release-status · plan 红线节 · plan 出口 · （门禁见 D-002） |
| D-006 | G-A/G-B/G-C 出口 + tag/商店另令 + 9.15 不热修 | plan 出口边界 · spec Testing/Out of Scope · handoff 禁止 |
| D-007 | 混合票务 + 五段主序 + calver 2026.9.20 | plan 波次表（权威）+ 票务索引 · issues/* · spec Solution |
| D-008 | 定稿进入整理；唯一数据源=账本 | 本文件 · handoff 入口 |

## 无去向记录清单

（空）

## 显式范围外（来自账本，非回忆）

| 项 | 理由（账本原文约束） |
|---|---|
| B76 商店 listing 文案/截图 | D-004：不更新、不立票 |
| B78 F-101-01 等 | D-004：维持已消 |
| tag / 商店提交 | D-006：三门齐后仍须另一次明令 |
| G-B 执行本身 | D-006：仅用户声明，禁 agent 代签 |
| 对 2026.9.15 热修 | D-006：持有不热修，P0 以 9.20 为准 |
| grill 内修源码 / 立 GitHub Issue | D-001/D-002/D-008：实施与建票在定稿后、用户下令后 |
| add/reorder 是否与 delete 同票 | D-002④：实施时再裁定，不阻塞选型（进 P0 票 open note，非范围外丢弃） |

## 对账结论

- current 记录: **8**（D-001..D-008）
- 有去向: **8**
- 无去向: **0** → **允许进入 spec/plan/issues/handoff**
