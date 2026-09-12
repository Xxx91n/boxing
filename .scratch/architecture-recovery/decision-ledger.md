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

## Wave8 → Tickets（A-025.. · 2026-09-12）

> 源: `.scratch/wave8-release-grill/decision-ledger.md` D-001..D-008 + handoffs/next-round.md
> 每条: ID / 问题描述（原文摘录）/ 规范化需求 / 显式约束 / 状态

| ID | 问题描述（原文摘录） | 规范化需求 | 显式约束 | 状态 |
|---|---|---|---|---|
| A-025 | D-006 G-A 残红裁定：N/B 禁豁免；T-GA1..5；与 G-B 并行；tag 锁 | G-A 治理票 70–74；禁假绿 | 不改 ADR-0017；禁 G-D；不回滚零闪现 | implemented |
| A-026 | D-002/D-004 发行号 2026.9.12 新 build；amo_sign=true；make_release=false | 工件下载票 75 + G-B 用新包；闪现进本版 | 过闸前禁 tag/禁宣称；勿复用 gb-2026.9.13 | implemented |
| A-027 | D-003/D-008 G-B 基线 v2026.9.11；#9 close 绑 G-B | 人工票 76 + 关账票 78 | 禁纯自动化宣称 G-B | implemented |
| A-028 | D-008 B41 60 慢放人工证据 | 人工票 77 | 不进 G1–G6 合取 | implemented-user-forced |
| A-029 | D-007 R1 冲突副本读取口 | 票 79 | 列表+单条导出；不扩门禁 | implemented |
| A-030 | D-007 R2 WebDAV merge 质量 | 票 80 方案先行 | 勿静默改 newer-wins | implemented |
| A-031 | D-007 R3 CRED per-install key | 票 81 | 含迁移/备份兼容；禁 passphrase 真加密重设计 | implemented |
| A-032 | D-007 R4 WebDAV 私网 opt-in（含旧 B47） | 票 82 | 设置+i18n+README | implemented |
| A-033 | D-007 R5 搜索 debounce（含旧 B48 性能） | 票 83 | 全量重建维持 ADR-0013 Q3=B | implemented |
| A-034 | D-007 R6 popup/ 纳入（重开 A-022） | 票 84 | 非阻塞 tag | implemented |
| A-035 | D-007 R7 文档产品化（重开 A-023） | 票 85 | 不阻塞 G-A/G-B | implemented |
| A-036 | D-007/D-008 R8 票务卫生 B40+B44 | 票 86 | 禁止升发行门禁 | implemented |
| A-037 | D-001/D-005 三轨范围 + atomcode 调研协议（已交付 research） | 本 spec 红线与协议 + research 文件 | 冲突须 revised；禁静默改向 | implemented |

### Wave8 覆盖自评

- 源 D-001..D-008: 8 · 映射 A-025..A-037: 13 · 无去向: 无
- Wave7 A-021..024 deferred 被 D-007 显式重开 → 实施去向 A-033/A-034/A-035/A-036（不改写 Wave7 结算原文）

### Wave8 补记（D-009 · 2026-09-12）

| ID | 问题描述 | 规范化需求 | 显式约束 | 状态 |
|---|---|---|---|---|
| A-038 | D-009 76/77 强制通过免产物 | 用户强制关闭 G-B/慢放票；票面 done + 强制标注 | 非 ADR-0017 可审计 G-B；禁对外宣称证据齐全；tag 仍须明令 | implemented-user-forced |

### Wave8 补记（78 关账偏离 · 2026-09-12）

| ID | 问题描述 | 规范化需求 | 显式约束 | 状态 |
|---|---|---|---|---|
| A-039 | 78 报告：#9 在 G-A 未满足下关闭，与 A-007 前置张力 | 用户强制路径（D-009）下的过程性关账；**不**等于 A-007 门禁达成 | 关闭评论已写 G-A 未满足 + G-B 强制无证据包；对外仍「不可发行」；不扩 ADR-0017 | implemented |

### Wave8 结算（2026-09-12 收口审计）

- A-025..A-037: **implemented**（票 70–86 源码/文档/守卫落地；W1–W3 首脑复核 + 收口硬验收 build/guards/gate2/e2e-subset 绿）
- A-028 / A-038: **implemented-user-forced**（D-009 免产物强制通过；非 ADR-0017 可审计 G-B）
- A-039: **implemented**（#9 过程性关账偏离已显式记账）
- stale: 0 · deferred: 无（Wave8 未另挂 deferred）
- 实现摘要已沉淀 docs/CONTEXT.md Wave8 settle
- 报告: W8-W1/W2/W3-brain-review · W8-closeout-crosscheck · 70–86-report · 79R/81R/81R2 返工节
- G-A 仍依赖 main CI 复跑；G-B 为强制豁免；**tag 仍禁**直至用户明令
