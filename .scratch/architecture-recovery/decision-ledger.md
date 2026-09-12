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

## Wave7 → Tickets（A-012.. · 2026-09-12）

> 源: `.scratch/wave7-flash-grill/decision-ledger.md` D-001..D-004 + destination-reconciliation + plan W7-T*
> 每条: ID / 问题描述原文摘录 / 规范化需求 / 显式约束 / 状态

| ID | 问题描述（原文摘录） | 规范化需求 | 显式约束 | 状态 |
|---|---|---|---|---|
| A-012 | D-001 本轮范围 All：闪现/发行收口/锐评 | 三轨全收；主序闪现→锐评→发行票务 | G-B 前禁 tag/禁宣称；不解耦记忆 | implemented |
| A-013 | D-002 零闪现验收 A+B 合成 | 主题层首帧记忆态 + 内容层禁错误盒子 | 禁 C 双真源；禁 inline；镜像不进迁移/同步/导出 | implemented |
| A-014 | D-003 拆票 A+2 | 一张 P1 票；不改 ADR-0017；并行 G-B | 禁 G-D；闪现不进 G1–G6 | implemented |
| A-015 | D-004#1 README vs ADR-0017 | 收窄声明到 Latest published v2026.9.11 | 禁写 main/2026.9.12 ready-to-use | implemented |
| A-016 | D-004#2 Git 历史/平行宇宙 | 无正式声明则条件立票；有则台账 | 整理不预判是否已有声明 | implemented |
| A-017 | D-004#3 CRED_APP_SECRET | 诚实标注或 per-install key 二选一 | 禁 passphrase 真加密重设计 | implemented |
| A-018 | D-004#4 WebDAV 私网未文档化 | README Privacy 写明封锁 | opt-in 后置 | implemented |
| A-019 | D-004#5 版本串 v3.7.8/v3.1 | 统一用户可见版本串 | — | implemented |
| A-020 | D-004#8 债务标记合并 | footer add / syncProviderHint / __lastSaveError 一张票 | 不清理 i18n 重复键 | implemented |
| A-021 | D-004#6 性能债 | 台账/backlog | 不立实施票 | deferred |
| A-022 | D-004#7 popup/ 零改动 | 不立票 | 非缺陷 | deferred |
| A-023 | D-004#9 .scratch/README 工作日志 | 台账；发行后 docs 里程碑 | 本波不搬家 | deferred |
| A-024 | D-004#10 V6 违规仅归档 | 台账+月复核 | 禁止变发行门禁 | deferred |

#
### Wave7 结算（2026-09-12 收口审计）

- A-012..A-020: **implemented**（票 60–66 源码/文档落地；W1/W2 首脑复核 + 收口硬验收 build/guards/spot FAIL_COUNT=0）
- A-021..A-024: **deferred**（按 D-004 不立实施票 / 禁升门禁）
- stale: 0
- 实现摘要已沉淀 docs/CONTEXT.md（zero-flash / paint-critical boot mirror；CRED 混淆诚实；WebDAV 私网文档化要点）
- 报告: reports/60–66-report.md · W1/W2-brain-review.md · W7-closeout-audit.md
- PV: 61/63/64/66 issue AC 未勾；60 慢放人工证据待补 — 不追认，见 backlog
