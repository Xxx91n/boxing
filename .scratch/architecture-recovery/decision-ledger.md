# Decision Ledger — Wave6 → Tickets（A-xxx）

> 源: `.scratch/wave6-dr-grill/decision-ledger.md` D-001..D-011（grill 定稿）
> 规则: 每条含 ID / 问题描述原文摘录 / 规范化需求 / 显式约束 / 状态
> 日期: 2026-09-12

| ID | 问题描述（源 D-xxx） | 规范化需求 | 显式约束 | 状态 |
|---|---|---|---|---|
| A-001 | D-001 主目标：容灾/门禁/票务/urlOpenMode 四选一或全都要 | 四轨全包含，拆多张票 | grill 不修源码；票在定稿后立 | implemented |
| A-002 | D-002 红线绑 tag-only vs 禁止 land | 红线只约束 tag/宣称可发行；功能可并行 land | 三门禁前禁 tag | implemented |
| A-003 | D-003 容灾验收边界 M0/M1/M2 | M1 产品化五项 | deferred: B18 UI、OPFS、CRDT、导出加密 | implemented |
| A-004 | D-004 urlOpenMode 实机：新装/重置默认仍是新标签 | 票：保证新装/重置 default=sameTab | 不接受用存量 newTab 解释新装 | implemented |
| A-005 | D-005 与 main 源码矛盾时验收口径 | 以实机为准：点书签=当前标签 | 不接受仅改下拉显示关票 | implemented |
| A-006 | D-006 导出是否含快照正文（atomcode） | 默认=layout+meta 索引；可选完整包 | 默认禁内嵌正文 | implemented |
| A-007 | D-007 #9 关闭条件 | 绑 G-A/G-B 完成后 close | 完成前只更新不关闭 | implemented |
| A-008 | D-008 G-A 残红治理 | 修绿优先+受控豁免；数据完整性永不豁免 | 禁 waiver-first/永久豁免/Skip 失明 | implemented |
| A-009 | D-009 G-B 归属 | ready-for-human 用户亲自执行 | 禁纯自动化宣称 G-B | deferred |
| A-010 | D-010 B15–B23 立票范围 | 本轮全立；P2 不占带宽 | B18 实施仍 deferred | implemented |
| A-011 | D-011 容灾 M1 拆票 | α=回滚UI+安全快照；β=导出+副本+ADR | 不合并大票 | implemented |

## 覆盖自评

- 源 D-xxx: 11 · 映射 A-xxx: 11 · 无去向: 无

## 结算（2026-09-12 Wave6 收口）

- A-001..A-008, A-010, A-011: **implemented**（代码/文档/测试落地，见 W6-W1/W2 复核 + reports 48–59）
- A-009: **deferred** — G-B 本体待用户实机（交付物已齐 evidence/49）
- 无 stale
- 实现摘要已沉淀 docs/CONTEXT.md + ADR-0009 票51修订 + ADR-0017 票56 RA 具名；本账本随 .scratch 归档
