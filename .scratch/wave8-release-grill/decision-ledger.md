# Decision Ledger — Wave8 发行收口 / 锐评未关 / Backlog Grill

> 日期: 2026-09-12 · 规则: 一次一问；仅用户确认后的结论入账；grill 中不修源码
> 恢复入口: W7-closeout-audit → wave7 decision-ledger A-012..024 → backlog B40–B48 → 本账本
> 源锐评: .codex-tmp/锐.txt（Wave6 快照，Wave7 已按 D-004 分诊落地 61–66）

## 覆盖自评（随轮更新）

- 轨道: 3/3 已纳入 D-001（发行收口 / 锐评未关项 / backlog）
- 已确认决策: 9
- 覆盖: grill 范围 ✓ · 发行号 2026.9.12 + 新 build G-B ✓ · G4/G5 基线=v2026.9.11 ✓ · build 授权=amo_sign=true/make_release=false ✓ · G-A 分桶调研已交付 atomcode-ga-residual-research.md（无 revised）· G-A 裁定已采纳 D-006 ✓ · 轨 B=R1–R8 全量升格 D-007 ✓ · 轨 C 收敛映射 D-008 ✓ · frontier 见出口自评
- 整理: 未新开 ADR · 未立 GitHub issue · 未改源码
- 待定: 用户是否确认定稿 / 是否授权立 issue 与实施

## 决策表

| ID | 原问题 | 用户原回答 | 规范化需求 | 显式约束/负向需求 | 状态 |
|---|---|---|---|---|---|
| D-001 | Q1 本轮 grill 主目标（A 发行收口 / B 锐评未关再分诊 / C backlog 全量 / D 组合） | D | 三轨全收，主序 A→B→C：①发行收口（G-B 执行边界、#9 关闭条件、CI/票务卫生，目标=用户能安全实机并最终 tag）②锐评未关项再分诊（冲突副本读取口 / CRED per-install / WebDAV opt-in / merge 质量是否升实施票）③backlog B40–B48 重排与合并。G-B 本体仍由用户实机，不阻塞 grill | grill 中不修源码；一次一问；结论必须落盘；G-B 未完成前禁 tag/禁宣称可发行；不扩 ADR-0017 合取（仍禁 G-D）；闪现红线（D-002 不解耦记忆）继续有效 | current |
| D-002 | Q2/Q2b 候选包与版本号（闪现进不进本版；「进 2026.9.12」含义） | 「我只是想让这个在2026.9.12版本里面给出来修复结果」 | **正式发行号 = 2026.9.12**：从当前 main（含零闪现 898119eb + Wave6/7 全部落地）**重 build** 发行 zip；G-B 六项必须在**新 build 解包产物**上执行，**不得**复用 D:/gb-2026.9.13 旧树；此前从未存在 v2026.9.12 tag/release，属「把被事故卡住的版本号做成真正可发行的那一版」而非覆盖已发布包 | 负向：在 G-A∧G-B∧G-C 齐备前禁 tag v2026.9.12、禁宣称 2026.9.12 可发行（README 仍保持 Latest published=v2026.9.11 直至过闸）；须在 CHANGELOG 补 2026.9.12 条目并写明与「同号历史 CI 存量包」的鉴别方式；执行卡「勿复用 2026.9.12」按用户发布权限方裁定降级为「须显式鉴别说明」，不阻止本口径；闪现修复必须进入本版（用户痛点）；不解耦记忆 | current |
| D-003 | Q3 G4/G5 上一发行版基线（v2026.9.11 / v3.7.8 / 双基线） | A | G4 升级演练与 G5 回滚读回**只用 v2026.9.11** 作上一发行版（GitHub Release Latest，2026-09-09）；双浏览器各一轮；v3.7.8 事故档**不进**本轮 G-B 勾选行 | 负向：不把 v3.7.8 写成 G-B 必测基线；G5b legacy-v2 fixture 注入仍按 ADR-0017 具名项执行（与基线包独立）；G4 须同时记录 v2026.9.11 → 2026.9.12 两版本号 | current |
| D-004 | Q4 2026.9.12 候选包产出方式（谁触发 build / amo_sign / make_release） | A | 授权触发：`gh workflow run build.yml -f version=2026.9.12 -f make_release=false -f amo_sign=true`；产物仅作 G-B 解包取证；**不建 release、不打 tag**；AMO 签名跳过以免烧掉 2026.9.12 版本号 | 负向：G-B 完成前禁 tag/禁宣称可发行；amo_sign 必须 true（演练不烧号）；make_release 必须 false；G-A test.yml 残红另问处置，不因「已授权 build」被忽略 | current |
| D-005 | Q5 G-A 残红处置（分桶调查 / 直接豁免 / 挂起） | A，并且具体让将当前问题提交 atomcode 深度调研 | 先对 run 34686760142（main 票 66 test.yml failure）做**分桶调查**：既有已知残红 vs 新引入 vs flaky；再决定修绿或受控豁免。调研协议：**atomcode 深度调研串行一次一个**；必须回顾 decision-ledger 全部 current、docs/adr 与 CONTEXT.md 现有条目、工业界成熟落地心智模型（重点）；给出推荐与理由。若调研结论与任何 current 决策冲突：**禁止静默改向**——将对应 D-xxx 标 revised（保留原记录），生成新 D-xxx 呈报用户，**等拍板后才继续下探** | 负向：禁止 waiver-first 在未分桶前写豁免；禁止把数据完整性用例豁免；禁止静默 revised；禁止因已授权 build 而忽略 G-A；grill 调查阶段不修源码 | current |
| D-006 | Q6 是否采纳 atomcode G-A 分桶裁定与立票范围（T-GA1..5） | 采纳 | **G-A 当前不成立**：禁止将 ~37 红用 2 条 active 豁免折算为绿；N 桶（data-golden gate4 / state-sync 并发 / dr-export WebDAV，建议含 dr-export AC1/AC2）与 B 桶 broken **禁止写豁免**；候选包 34689649760 保留作 G-B 取证；**G-A 治理与 G-B 人工并行**；**tag 仍锁**直至 N/B 修绿或合法退役。建议实施票（落地另波）：T-GA1 集合差+根因（H1–H4）P0 · T-GA2 N 桶修绿 P0 · T-GA3 B 桶修绿 P1 · T-GA4 boot-pending/e2e 就绪契约（若 H1，不回滚零闪现）P1 · T-GA5 既有豁免复查 P2。详细: atomcode-ga-residual-research.md | 负向：不改 ADR-0017 合取；不扩 G-D；不回滚票 60 零闪现；不把 G-A 红解释为「G-B 可以跳过」；grill 本波不实施 T-GA* 源码修复 | current |
| D-007 | Q7 轨 B 锐评未关项哪些升格本轮立票/实施（R1–R8） | 全部 | **R1–R8 全部进入 Wave8 立票/实施范围**：R1 冲突副本读取口（列表+单条导出）P1；R2 WebDAV merge 质量（子盒/id 级）先方案后实施 P2；R3 CRED per-install 运行时 key（含迁移/备份兼容）P2；R4 WebDAV 私网 opt-in 设置+i18n+README P2；R5 性能债第一批（至少搜索 debounce；全量重建维持 ADR-0013 Q3=B）P2；R6 popup/ 纳入本波（原先 A-022 不立票）；R7 .scratch/README 产品化（原先 A-023 发行后）；R8 票务/过程卫生（B40 补勾等，**禁止**升为发行门禁）。Wave7 A-021/A-022/A-023/A-024 的 deferred **在 Wave8 被用户显式重开**，记于本条，不静默改写 Wave7 结算原文 | 负向：不扩 ADR-0017；R8 禁止变 G-A/B/C；R6 非阻塞 tag；R7 不阻塞 G-B/G-A；实施仍待 grill 定稿后另波；本波 grill 不修源码；T-GA* 仍优先于部分 R 项的源码面（G-A 是发行硬门） | current |
| D-008 | Q8 轨 C backlog B40–B48 收敛方式 | A | **映射收敛（单一来源）**：B45→并入 T-GA2（data-golden gate4）· B46→并入 T-GA1–5（原「CI 定谳」由 T-GA 承载）· B47→并入 R4（i18n/README Privacy/WebDAV）· B48→并入 R5/R7 · B40+B44→R8 一单票务/过程卫生（补勾 AC 等）· **B41**（60 慢放人工证据）**保持独立人工项** · **B42 G-B** / **B43 #9 close** 保持独立 P0 人工/关账项。Wave7 backlog 编号不再与 T-GA/R 并行维护 | 负向：不保留 B45/B46/B47/B48 平行台账；R8 禁止升发行门禁；B42 仍 ready-for-human；B43 绑 G-B 完成前只更新不关闭 | current |
| D-009 | 76/77 强制通过是否免证据产物 | 「强制通过76 77不需要产物」 | **发布权限方裁定：票 76 G-B 与票 77 慢放证据以用户强制通过关闭，不要求勾选单/录屏/console 证据产物。** Agent 可将 issues/76、issues/77 置为 done（标注 user-forced, no artifacts），并在 reports 中如实记录该豁免。**不**等价于 ADR-0017 G-B「人工黄金路径取证完成」；**不**自动满足 G-A∧G-B∧G-C 合取中的可审计 G-B。78（#9 close）可随 76 强制通过推进，但关闭评论须写明 G-B 为用户强制通过、无证据包。 | 负向：禁止在 README/CHANGELOG/对外表述中写「G-B 证据齐全 / 黄金路径已取证」；禁止把强制通过写成 ADR-0017 合取已满足；禁止 tag 除非用户另行明令并接受门禁被人工豁免的事实；须在台账留下 PV/豁免记录 | current |

## Wave8 覆盖自评（出口 · 2026-09-12）

- 已确认决策: **8**（D-001..D-008）
- 轨道覆盖: A 发行收口 ✓（G-A 裁定+候选包+G4/G5 基线；G-B 仍人工）· B 锐评未关 R1–R8 全量升格 ✓ · C backlog 映射收敛 ✓
- 与 current 冲突: **无 revised**；Wave7 A-021..024 deferred 被 D-007 显式重开（记于 D-007，不改写 Wave7 结算原文）
- 整理: atomcode-ga-residual-research.md ✓ · decision-ledger.md ✓ · 未新开 ADR · 未立 GitHub issue · 未改源码
- 实施票建议名（定稿后另波）: T-GA1..5 · R1..R8 · R8 卫生并入 B40/B44 · 人工项 B41/B42/B43
- 待定: 用户是否确认定稿 / 是否授权立 issue 与实施 / G-B 实机时间

## Wave8 结算（2026-09-12 收口）

- D-001..D-009: 全部 **current → 已落地**
- 映射: D-001..D-008 → A-025..A-037；D-009 → A-038/A-039
- 无 stale；D-009 为用户强制豁免（免产物）
- 归档伴随 .scratch/architecture-recovery 与本目录
