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
| A-061 | D-002/D-004 中间 G-A 34808080000 ≠ 发行终谳；B 轨 land 后须新 tip 重跑 | 发行 G-A 绑最终 tip test.yml 四 job 全绿；等用户 G-B | 禁止用旧 run 冒充；tag/商店另令（D-007） | implemented（2026-09-14 · 发行 tip 8a8798c9 · test.yml run https://github.com/Xxx91n/boxing/actions/runs/34857433215 conclusion=success：data-golden + ubuntu + macos + windows 四 job 全绿 · docs-gov 34857433250 success · 等用户 G-B 声明 2026.9.15+日期） + **G-B 用户声明「通过」2026-09-14** + GitHub Release v2026.9.15 已发布 target cc30edcc） |
| A-060 | D-003⑪ B70 innerclip firefox 本地 flaky | CI 复现则修，否则书面观察结案 | 禁止静默丢弃 | implemented（2026-09-14 · 票106：**CI 不复现 → 书面观察结案**。裁决面 9 个完整矩阵 main run / 216 次 innerclip 执行零出现（Wilson 95% 上界≈1.75%），含 ≥2 连续同码绿链 34773593267+34778641702（`compare/16ce5d27...02d31657` 差异仅 `.scratch/**`，tip 等价）；新基线 run 34808080000 @ 9fa4666c 亦零出现。2026-09-12 两次出现（34672647167/34686760142）定性为 **B(broken)**：113 编号失败、三 OS×双车道同签名、含 data-golden gate4、失败点为元素存在性断言（`metrics.found`/`g.ok`）且 Retry#1/#2 全败 → 非本票 F 面，已修绿。本地复测（firefox 车道，`--retries 0`）：workers=2 → 4/4 failed；workers=1 → 1 failed/2 passed，签名均为共享夹具 `resetBoxing` 导航 30s 超时（firefox 冷启动 + 宿主争用），属**装置层**、非几何断言、非产品缺陷。具名残余 **N-106-01**（两 spec 未设 `test.setTimeout` 预算，票13 同类修复在手）；登记 `docs/testing-governance.md` 本地观察行（到期 2026-10-14）；**不入 G-A 豁免台账**（该面从未成 CI 残红，入账会扩大豁免面，违票105棘轮）；报告 reports/106-report.md） |
| A-059 | D-003⑩ B69 撤账判据未写入规则 | 「≥2 连续 main 绿」等判据写入测试治理/豁免规则 | 与 ADR-0017 豁免规则不冲突 | implemented（2026-09-14 · 票105：撤账判据（≥2 连续 main 全绿 + N/B/F 分桶约束 + `撤账证据:` 字段）写入 WORKFLOW.md §4.4 台账规则本体（机器校验解析面）+ docs/testing-governance.md（docs 层记录）+ docs/release-status.md §四硬约束；waiver-ledger-check.mjs 扩展为机器校验（规则节存在 / closed 行 ≥2 distinct run 撤账证据 / NQ 名单含 closed 行），5 例负向对照全咬合；与 ADR-0017 无冲突（撤账≠豁免成立≠G-A 达成）；报告 reports/105-report.md） |
| A-058 | D-003⑨ B68 boot-theme 早退路径无 failsafe（92 P-92-1） | 早退 failsafe；不破坏零闪现 | 产品行为变更须 e2e/否证；GH #15 | implemented（2026-09-14 · 票104：failsafe 注册前移至 mask 之后 / try 之前；新增 3 例 e2e（早退双路径行为 + 源码顺序契约）双车道 7/7；M2 mutant 杀 3/3；报告 reports/104-report.md） |
| A-057 | D-003⑧ B67 DESIGN.md hairline 语义 | 文档 revised 闭环 | 不与既有暗色 token 修正冲突 | implemented（2026-09-14 · ticket 103 · `docs/DESIGN.md` 新增「Hairline 与控件边界的语义契约」三档决策表：`--color-hairline` = 弱分隔线（亮 1.11:1 / 暗 1.20:1），**禁作**交互控件唯一示能边界；控件边界改用 `--color-muted`（亮 3.81:1 / 暗 4.45:1）+ 字形 `--color-ink-soft`（9.78 / 7.73）；§2 Button 按代码现实校正并加 SC 1.4.11 豁免脚注（`.btn` 填充 + 文字 12.11:1）；新增 §2b ghost 按钮表，与票 88（暗）/ 102（亮）实际修复逐字对齐，**暗色 CSS 零改动**；§1 Box / §6 Zoom 代码现实偏差记 N-103-01/02；Industry Benchmark 补 ttoss / Carbon / Polaris 对标（Carbon #14597 同构事故）；**零 CSS/JS/测试改动**，pretest 5 门 + contrast-guard 8/8 + docs-link-guard 0 dead + Markdown 结构自检 20 表零畸形；报告 reports/103-report.md）[ticket-103 窗口] |
| A-056 | D-003⑦ B66 亮色 bm-add-btn 对比度（88 Q1） | 达标或书面 token 决策 | 与暗色修复不矛盾；GH #16 | implemented（2026-09-14 · ticket 102 · ntp/base.css 亮色 token 配对改为 --color-ink-soft / --color-muted：字形 3.81:1→9.78:1（SC 1.4.3 ≥4.5），边框 1.11:1→3.81:1（SC 1.4.11 ≥3，留细线抗锯齿余量 27%），hover 边框 1.3:1→5.04:1、focus 边框 2.91:1→5.52:1；与暗色 ticket 88 同一配对、暗色 CSS 零改动；新增 scripts/contrast-guard.mjs 并接入 test.yml「Contrast guard」步骤（Run tests 前；本机 8/8 PASS exit 0）；**未**串入 package.json pretest（N-102-03 跨窗口行级依赖，报告 §6）；新增 Bug5-light contrast e2e（全 spec 22/22）；报告 reports/102-report.md） [ticket-102 窗口] |
| A-055 | D-003⑥ B65 fire-and-forget 测试族 flaky | 家族清单 + deflake 或稳定 skip+票；CI 证据 | N 桶/数据完整性永不豁免；GH #14 | implemented（2026-09-14 · ticket 101 · 新增 test/helpers/onboarding.ts 单一真相（门 = 轮询 initOnboarding 自身分支条件：overlay.hidden / settings.onboardingCompleted / boxes.length，无需 ?debug=1、零产品改动）；23 spec / 26 处 fire-and-forget 调用点全量迁移；boxing-empty-state-buttons 于 hover 前补 assertPointerReaches；boxing-search 三例固定等待改重试式断言；新增 scripts/onboarding-guard.mjs 防回流并串入 pretest（自测 7/7、46 specs 零反模式）；本机 pretest 全绿、46 spec 复扫零残留、全量 613 passed / 5 skipped @workers=2；**家族本体已 deflake，2/3 在册面复测全绿（Bug5-dark 40/40、search 40/40）**；**zoom-dblclick 未 deflake**：旧签名（L172 遮罩 poll 超时）在 80 次运行中零复发，但暴露出**异源新签名**（L192 一次 dblclick 双建，firefox ~5%，属 BX-DEV-112C/112D 创建冷却族）→ 具名 N-101-06 待开票，**未**采用 skip（该断言捕获真实产品不变式）；CI 侧证据具名 F-101-01（未获 push 授权）；WORKFLOW §4.4 三条豁免行**未自撤**（zoom 行签名需按报告 §6.5 更正）；报告 reports/101-report.md） [ticket-101 窗口] |
| A-054 | D-003⑤ B64 calver 一致性无门禁 | pre-commit/CI 校验 manifest/package/notes 版本面一致，失败非零退出 | 不阻断策略与仓库约定冲突时须书面说明 | implemented（2026-09-14 · ticket 100 · scripts/calver-guard.mjs 接入 pretest；报告 reports/100-report.md） |
| A-053 | D-003④ B63 locale README 14 语滞后（曾 hi 钉 9.11） | 与主 README/Release status 版本口径对齐 | 不扩写无关 i18n 重构 | implemented（2026-09-14 · ticket 99 · docs/i18n/README.*.md Install 段 13 语对齐 + scripts/locale-readme-guard.mjs 接入 pretest；报告 reports/99-report.md） |
| A-052 | D-003③ 锐评8：ntp.js [''] 与 i18n 重复键无冻结注释 | 就地 // frozen by ticket 83/66 + 报告指针；不改字节契约 | 禁止修改冻结语义 | implemented（2026-09-14 · ticket 98 · ntp/ntp.js:578 与 ntp/i18n.js:79 各加 `FROZEN by ticket 83/66` 六要素指针注释；git diff 仅注释行（+18/-0），零契约字节改动；报告 reports/98-report.md） |
| A-051 | D-003② 锐评6：可发行状态只活在 .scratch/ADR 修订，docs 层无 live Release status | docs/ 层落地当前版本/三门状态/在效豁免/欠账指针；记中间里程碑 34808080000 与发行终谳预留 | 不得只活在 .scratch；不宣称三门达成 | implemented（2026-09-14 · ticket 97 · 新增 docs/release-status.md：当前版本 2026.9.15 + G-A/G-B/G-C 三门状态 + 在效豁免表（waiver-ledger-check exit 0）+ 欠账指针 A-050..A-061；记中间里程碑 run 34808080000 @ 9fa4666c 与发行终谳预留（待填）；导航接入 docs/START-HERE.md §4 与 docs/CONTEXT.md release gate 段；结论维持「不可发行」，未代签 G-B、未宣称三门合取达成；报告 reports/97-report.md） |
| A-050 | D-003① AI Docs Governance dead-link 红（run 34808079960 @ 9fa4666c）：naive regex 将 markdown ](path 吞进路径 | 修 CI regex 与/或 AGENTS/CONTEXT 链接写法至治理 workflow success；不得静默删检查 | 不与 test.yml G-A 混写；不热修 9.12；GH #13 | implemented（2026-09-14 · 票96：naive grep 字符类替换为 scripts/docs-link-guard.mjs 手写扫描器（allowlist tokenizer + markdown 链接目标解析 + 7 fixture 自测 + 反空洞断言）；workflow dead-link 步骤与双端 paths 触发面同步更新；本地 job 三步等价模拟全绿 exit 0；反向对照真死链仍 exit 1 且 AGENTS.md 字节级还原 sha256 一致；CI green run URL 具名 F 待 push 授权） |

## Wave9.20 → Tickets（A-062.. · 2026-09-15）

> 源: `.scratch/wave9-920-grill/decision-ledger.md` D-001..D-008 + reports/Q2·Q3 + W915-backlog B71–B77
> 每条: ID / 问题描述（原文摘录）/ 规范化需求 / 显式约束 / 状态

| ID | 问题描述（原文摘录） | 规范化需求 | 显式约束 | 状态 |
|---|---|---|---|---|
| A-062 | D-002 · Q2 调研 · popups.js:189 · 用户日志：P0 书签单条删除旁路 commit：splice 后 fire-and-forget saveLayout、不写墓碑；mergeById 并集复活；盒删除路径已正确 tomb bookmarks | deleteBookmark mutationHandler 走 commit，tombstoneIds:[bmId]；废弃裸 splice；never-quarantine 回归 add→delete→陈旧合并/reload | 禁手术式单行 markDeleted 而不留门禁；禁绕过 commit；数据完整性禁豁免；add/reorder 是否同票实施时裁定；不热修 9.15 | current |
| A-063 | D-002② · 锐评 Top-5 #5：layout 数据删除/改写可绕过 mutationHandlers（popups add L282/301、reorder L407 等旁路） | 静态门禁：ntp/** 中 layout 集合删除/改写不在 handlers 即 exit 1（白名单注释豁免）；串 pretest 或 test.yml | 白名单须具名；不得静默删检查；与 A-062 同波/紧随 | current |
| A-064 | D-001/D-003 · Q3 调研 · B75：G-C 仅三 URL 200，无法发现「过时但 200」；Pages 发行后同步无新鲜度断言 | G-C=200 + GET demo/version.json(cache-buster)==最新 tag；deploy 尾部 verify ≤180s；保留人工检查单；修订 ADR-0017 G-C 行；吸收 B75 | 不做 mike 多版本；不取消人工复核；失败两态写入检查单；核查 environment 放行 tag、Pages 仅 Actions | current |
| A-065 | D-004① · B71 · N-101-06：zoom-dblclick 异源签名：一次 dblclick 双建 small box（firefox ~%，创建冷却族） | 根因修复或稳定化；禁 skip 冒充绿；回归可复现 | 不弱化该断言不变式；属创建冷却族非 fire-and-forget | current |
| A-066 | D-004② · B72 · N-106-01：innerclip 两 spec 未设 test.setTimeout 预算（原观察至 2026-10-14，D-004 提前进 9.20） | 为相关 spec 设合理 setTimeout 预算或等价稳定性措施 | 不得再以观察未到期推迟；不入 G-A 豁免台账扩大面 | current |
| A-067 | D-004③ · B73 · N-102-03：contrast-guard 仅 test.yml，未串 package.json pretest，本地 npm test ≠ 对比度门禁 | 一行集成串入 pretest（或书面接受 CI-only 并记账） | 不破坏既有 pretest 6 门；跨窗口行级依赖已过期可修 | implemented（2026-09-15 · ticket 112 · package.json pretest 链在 css-balance-guard 后插入 `node scripts/contrast-guard.mjs`（单行 +35 B，无 BOM/纯 LF，JSON.parse 通过）；本机链内实测 8/8 PASS exit 0（中位 185.8 ms，含 node 启动）；test.yml 零改动（on.*.paths 与基线逐字一致）；CI 显式步骤保留为 `--ignore-scripts` 陷阱缓解（调研风险[高]），双跑 ~2×186 ms 幂等；既有 6 门零改动；commit `uqz` / `3751ada5` @ 分支 `ticket/112-contrast-guard-pretest`；整链红 = 非本票面 N-112-01（票107 在途）+ N-111-01（既有，复用票111 具名）；报告 reports/112-report.md） [ticket-112 窗口] |
| A-068 | D-005① · 锐评 #2：release-status.md 同页三套状态并存：页首「三门达成」vs §一「不可发行」vs §三 实测；终谳预留仍待填 | 收敛单一现役状态块；删/降级矛盾表；终谳块填 09-14 实测；旧 run 标 Superseded；页内规则「有且只有一个状态块」 | 禁止只改标题不删矛盾；不代写未发生的 9.20 三门 | current |
| A-069 | D-004④ · B74 · N-103-01/02：DESIGN.md Box/Zoom 表与代码现实偏差注记未收 | 偏差注记或表校正；不回退 hairline 契约（票103） | 不扩写无关重构；零非必要 CSS/JS 改动 | implemented |
| A-070 | D-004⑦ · B77：CHANGELOG [2026.9.15] 段偏薄，与 release-notes 不对齐 | 与 docs/release-notes/2026.9.15.md 要点对齐扩写 | 不虚构未落地功能 | current |
| A-071 | D-007 · calver-guard 票100：版本面仍为 2026.9.15；9.20 发行需 calver 一致推进 | 实施波内 manifest×2/package/notes/CHANGELOG/脚注等一致推至 2026.9.20，过 calver-guard | 不前导零；与 store 真源不冲突；G-B 前禁宣称可发行 | current |
| A-P01 | D-005② 线性追加红线 | 9.20 全部提交只在 a1acaaac 之上线性追加 | 第二次 root 导出即停波；导出工具做不到先改工具 | current（过程红线，无独立票） |
| A-P02 | D-004⑨/D-005③ 豁免清零出口 | 3 条 active F 09-19 到期；按 105 撤账至 0 active F | 绑 9.20 G-A；不得无动作续期 | current（出口条件） |
| A-P03 | D-006 发行出口 | G-A 新 tip 四 job 全绿 + G-B 用户声明 + G-C 升格；tag/商店另令 | 禁 agent 代签 G-B；9.15 不热修 | current（出口边界） |

