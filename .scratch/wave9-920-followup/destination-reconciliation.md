# 去向对账 — Wave9.20 Followup（唯一数据源: decision-ledger.md）

> 日期: 2026-09-22 · 步骤 1–3 · 账本外结论一律不写入
> 状态口径: **current** 全量枚举；`revised` 单列且保留（来自本账本状态列，非回忆）

## 1. current 记录全量枚举与去向

| ID | 状态 | 去向 |
|---|---|---|
| D-001 | current | **spec §1 范围** + **plan §0 总则**（全量可解项收口；C08 显式范围外=用户） |
| D-002 | current | **spec §2 责任矩阵** + **plan 各步 Owner 列**（C08=用户；其余=agent；G-B 不代签） |
| D-003 | current | **plan-02 C01 豁免处置** + **spec §3.1**（先已修后撤账 / 未修书面退役；否决续期） |
| D-005 | current | **plan-01 C05+C07** + **spec §3.2**（分层终点：删除类 0 + 改写具名有到期 + 棘轮） |
| D-006 | current | **plan §形态** + **spec §4 过程约束**（.scratch 单票、无 GH Issue、审计链） |
| D-007 | current | **本整理产物合同** + **handoffs/next-round.md**（message 步骤 / goal 防丢失） |

## 2. revised 记录（同账本，非 current 但不得丢失）

| ID | 状态 | 去向 |
|---|---|---|
| D-004 | revised（主序六步不变；C07 终点以 D-005 为准） | **plan-01..06 主序**（唯一执行顺序来源） |

## 3. 无去向记录清单

**（空）** — 7 条 current + 1 条 revised-operative 均已有去向。

## 4. 范围外（显式 + 理由，来自账本负向/责任列）

| 项 | 理由（账本原文依据） |
|---|---|
| C08 tag / 商店 2026.9.20 | D-002 用户原答「C08我来」；agent 禁止执行 |
| 代签 / 新签 G-B | D-002/D-007 负向：禁止伪造测试声明 |
| 本整理环节改产品源码 | D-007 负向：整理后不直接改 ntp/** |
| GitHub Issue 建票 | D-006 用户选 A |
| 本波 9→0 全收白名单 | D-005 负向：否决 A |
| 豁免续期 | D-003 负向：否决 C |

## 5. 计划表条目号预告（供 spec/plan 对齐，不在此展开实施细节）

| plan 条目 | 覆盖 D |
|---|---|
| plan-00 总则/责任/形态 | D-001 D-002 D-006 |
| plan-01 C05 addBookmark + C07 分层 | D-005（+D-004 步骤①） |
| plan-02 C01 豁免处置 | D-003（+D-004 步骤②） |
| plan-03 C04 environment 放行 | D-002（+D-004 步骤③） |
| plan-04 G-A | D-004 步骤④ |
| plan-05 G-B 重签准备（包+检查单） | D-002/D-004 步骤⑤ |
| plan-06 G-C | D-004 步骤⑥ |
| plan-07 文档账本收口（C09 销账、A-P03 措辞、release-status、handoff 路径） | D-001/D-002/D-007 |
