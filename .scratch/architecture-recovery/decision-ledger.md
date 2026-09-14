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

## Wave9 → Tickets（A-040.. · 2026-09-13）

> 源: `.scratch/wave9-postrelease-grill/` plan.md + ga-definitive-b4f3df2.md + decision-ledger D-001..D-010
> 架构报告路径: 同上（定谳 run 34749813393）
> 每条: ID / 问题描述（原文摘录）/ 规范化需求 / 显式约束 / 状态

| ID | 问题描述（原文摘录） | 规范化需求 | 显式约束 | 状态 |
|---|---|---|---|---|
| A-040 | W9-P1..P5 纸面债（ADR-0017 修订 / release-notes live / 徽章 / AGENTS+路径门禁 / history 真话） | 已随 wave9-paper-debt 落盘；不立实施票 | 数据源仅 D-001..D-010；不宣称三门达成 | implemented |
| A-041 | R1 boxing-star-sync-audit Scenario 1（跨 tab isParent 领养）三 OS × ff+ch 稳定残红（ga-definitive） | 产品或测试根因分诊后修绿；禁止豁免折绿 | 目标 2026.9.15；线性提交；关联 GH #10 | implemented（2026-09-14 · CI https://github.com/Xxx91n/boxing/actions/runs/34773593267 green） |
| A-042 | R2 empty-state Bug5-dark bm-add 暗色透明（ubuntu）— **已分诊**：CI 残红 = env（onboarding 遮罩拦截 + 140ms 过渡竞态，票 48/72 已修）；产品侧暗色对比度缺陷（字形 4.45:1、边界 1.20:1）已修至 7.73:1 / 4.45:1（票 88） | 分诊 env vs 产品；产品则修 | 不得只改断言掩盖产品缺陷 | implemented（2026-09-14 · CI https://github.com/Xxx91n/boxing/actions/runs/34773593267 green） |
| A-043 | R3 auto-expand collapseHover（ubuntu flaky） | 去 flaky 或稳定具名 skip+票 | 禁止永久 silent skip | implemented（2026-09-14 · CI https://github.com/Xxx91n/boxing/actions/runs/34773593267 green） |
| A-044 | B54 票 82 已知缺口：checkUrlValid .local、opt-in 导出传播 | 小修收口 | 维持默认拒私网 | implemented（2026-09-14 · CI https://github.com/Xxx91n/boxing/actions/runs/34773593267 green） |
| A-045 | B55 merge 质量：票 80 方案未实施；子盒静默吞没（D-009 整票） | baseRevision/等价 + 子盒/id 级合并 + e2e | 禁只落方案；禁静默改 newer-wins；关联 GH #11 | implemented（2026-09-14 · CI https://github.com/Xxx91n/boxing/actions/runs/34773593267 green） |
| A-046 | B56 boot-pending 专项 e2e（73 呈报 P-73-1） | 防零闪现回归自动化 | 不回滚零闪现实现 | implemented（2026-09-14 · CI https://github.com/Xxx91n/boxing/actions/runs/34773593267 green） |
| A-047 | G-A 不成立（run 34749813393）：三 OS test 红；出口=main test.yml 绿或仅具名 F | 残红治理至可发行 G-A | N 桶/数据完整性永不豁免；关联 GH #12 | implemented（2026-09-14 · CI https://github.com/Xxx91n/boxing/actions/runs/34773593267 green：4 job 全 success / 0 failed；R1 star-sync 与 R3 auto-expand 零出现→关闭，R2 empty-state Bug5-dark 具名 F + 2 条新 flaky（zoom-dblclick windows / search macos）入台账；data-golden 绿、never-quarantine 零命中、waiver-ledger-check exit 0；corroboration 同码重跑 https://github.com/Xxx91n/boxing/actions/runs/34778641702（headSha = tip 02d31657）亦 4 job 全 success / 0 failed，3/4 签名逐字复发、无新增 broken → 连续 2 个全量 main run 全绿，稳定态声明成立） |
| A-048 | 目标版本 2026.9.15 全部修复出口（D-004/005）：版本串+notes+G-A∧G-B∧G-C | 版本就绪且门禁可宣称前禁止夸大 | 持有 9.12 不热修；G-B=用户声明 pass 禁 agent 代签 | implemented（2026-09-14 · 版本面/notes 一致至 2026.9.15 + 门禁重跑备妥；G-A 证据 run 34773593267 + corroboration 34778641702 双绿；G-B 用户声明与发行后 G-C 复核为出口余项，未宣称达成） |
| A-049 | 存量 spec 真实 WebDAV 凭据（91R R4：cred-encrypt / dr-export / import-merge / memory / sync 等 + .codex-tmp 副本） | 统一 env 化占位；工作树 grep 0 | 不改写历史；不弱化断言；密码轮换仍属用户 | implemented（2026-09-14 · CI https://github.com/Xxx91n/boxing/actions/runs/34773593267 green） |
| A-061 | D-002/D-004 中间 G-A 34808080000 ≠ 发行终谳；B 轨 land 后须新 tip 重跑 | 发行 G-A 绑最终 tip test.yml 四 job 全绿；等用户 G-B | 禁止用旧 run 冒充；tag/商店另令（D-007） | current |
| A-060 | D-003⑪ B70 innerclip firefox 本地 flaky | CI 复现则修，否则书面观察结案 | 禁止静默丢弃 | current |
| A-059 | D-003⑩ B69 撤账判据未写入规则 | 「≥2 连续 main 绿」等判据写入测试治理/豁免规则 | 与 ADR-0017 豁免规则不冲突 | current |
| A-058 | D-003⑨ B68 boot-theme 早退路径无 failsafe（92 P-92-1） | 早退 failsafe；不破坏零闪现 | 产品行为变更须 e2e/否证；GH #15 | current |
| A-057 | D-003⑧ B67 DESIGN.md hairline 语义 | 文档 revised 闭环 | 不与既有暗色 token 修正冲突 | current |
| A-056 | D-003⑦ B66 亮色 bm-add-btn 对比度（88 Q1） | 达标或书面 token 决策 | 与暗色修复不矛盾；GH #16 | implemented（2026-09-14 · ticket 102 · ntp/base.css 亮色 token 配对改为 --color-ink-soft / --color-muted：字形 3.81:1→9.78:1（SC 1.4.3 ≥4.5），边框 1.11:1→3.81:1（SC 1.4.11 ≥3，留细线抗锯齿余量 27%），hover 边框 1.3:1→5.04:1、focus 边框 2.91:1→5.52:1；与暗色 ticket 88 同一配对、暗色 CSS 零改动；新增 scripts/contrast-guard.mjs 接入 pretest（8/8 PASS，负向自检 exit 1 且源码字节还原）；新增 Bug5-light contrast e2e（全 spec 22/22）；报告 reports/102-report.md） |
| A-055 | D-003⑥ B65 fire-and-forget 测试族 flaky | 家族清单 + deflake 或稳定 skip+票；CI 证据 | N 桶/数据完整性永不豁免；GH #14 | current |
| A-054 | D-003⑤ B64 calver 一致性无门禁 | pre-commit/CI 校验 manifest/package/notes 版本面一致，失败非零退出 | 不阻断策略与仓库约定冲突时须书面说明 | current |
| A-053 | D-003④ B63 locale README 14 语滞后（曾 hi 钉 9.11） | 与主 README/Release status 版本口径对齐 | 不扩写无关 i18n 重构 | current |
| A-052 | D-003③ 锐评8：ntp.js [''] 与 i18n 重复键无冻结注释 | 就地 // frozen by ticket 83/66 + 报告指针；不改字节契约 | 禁止修改冻结语义 | implemented（2026-09-14 · ticket 98 · ntp/ntp.js:578 与 ntp/i18n.js:79 各加 `FROZEN by ticket 83/66` 六要素指针注释；git diff 仅注释行（+18/-0），零契约字节改动；报告 reports/98-report.md） |
| A-051 | D-003② 锐评6：可发行状态只活在 .scratch/ADR 修订，docs 层无 live Release status | docs/ 层落地当前版本/三门状态/在效豁免/欠账指针；记中间里程碑 34808080000 与发行终谳预留 | 不得只活在 .scratch；不宣称三门达成 | current |
| A-050 | D-003① AI Docs Governance dead-link 红（run 34808079960 @ 9fa4666c）：naive regex 将 markdown ](path 吞进路径 | 修 CI regex 与/或 AGENTS/CONTEXT 链接写法至治理 workflow success；不得静默删检查 | 不与 test.yml G-A 混写；不热修 9.12；GH #13 | current |
