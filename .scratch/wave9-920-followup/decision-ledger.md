# Decision Ledger — Wave9.20 Followup Grill

> 规则: 每条含 ID / 原问题 / 用户原回答原文 / 规范化需求 / 显式约束/负向需求 / 状态
> 源: W920-closeout-handoff + W920-postrelease-backlog + .codex-tmp/锐.txt + origin/main 57d2ff61 实物
> 日期: 2026-09-22
> grill 中不修源码；一次一问；结论必须落盘
> 前序 D 账本: `.scratch/wave9-920-grill/decision-ledger.md` D-001..D-008（仍 current，不重写）
> 前序 A 账本: `.scratch/architecture-recovery/decision-ledger.md` A-001..A-071 · A-P01..03
> 前序更早: wave9-915-release-grill D-001..D-009 · wave9-postrelease-grill D-001..D-010

| ID | 原问题 | 用户原回答 | 规范化需求 | 显式约束/负向需求 | 状态 |
|---|---|---|---|---|---|
| D-007 | 定稿/进入整理（用户令：激活 ctx；/goal 防丢失+message 步骤；开始 grill 后整理文档环节） | 开始 grill 结束后的整理文档环节。默认执行环境。【数据源纪律】整理的唯一数据源是 decision-ledger.md，禁止从对话回忆中补充任何结论……生成后使用but对文档进行commit防止丢失，之后停住 | **Grill 定稿，进入整理**：①唯一数据源=本账本；②产物=destination-reconciliation + spec + plan + CONTEXT settle（domain-modeling）+ 知识收口（neat-freak）+ handoffs/next-round.md（每项任务声明覆盖 D-xxx + suggested skills + message 步骤）；③无去向清单非空则停下；④but commit 文档后停住，不实施源码；⑤/goal 防丢失=message 步骤写入任务书 | 负向：禁止从对话回忆补写结论；账本没有的结论先列出再问；不建 GH Issue（D-006）；不代签 G-B；不做 C08；整理后不直接改 ntp/** 产品源码 | current |
| D-006 | Q6 票务形态（A .scratch 单票 / B 混合 GH+scratch / C 全 GH Issue） | A | **不建 GitHub Issue，.scratch 单票清单实施**：工作项以本账本 + followup `plan.md` 勾选表落地（C01–C07 按 D-004 主序）；审计链=decision-ledger + `but commit` + `reports/`；实施完成后一次性回填 release-notes/账本，不做票务前置同步 | 负向：本波不创建 GitHub Issue；不把「无 issue」解释成无审计；C08 仍归用户；不代签 G-B；未三门齐不 tag/宣称可发行 | current |
| D-005 | Q5 C07 白名单长尾终点（调研后呈报，**待用户拍板**） | 采纳 | **已拍板终点 = 分层（2026-09-22 用户「采纳」；对齐 Q5-B / 调研）**：①**删除/墓碑/集合删除类 = 零豁免**（必须 `commit(op)`/mutationHandlers；现状 delete+reorder 已收编，维持 0）；②**非集合改写类**允许保留少量具名 `// layout-bypass-allow`（reason≥12 字）+ **每条到期日/工单路径**，禁止无到期永久豁免；③**棘轮只减不增**（已有 orphan=红）+ 配 downcounting（本波能收则收，收不完留预算不归零）；④**C05 addBookmark 收编进 commit** 仍执行（与 D-004 主序一致，属写路径一致性非删除类）；⑤C07 本波**不**以「9→0」为完成定义；完成定义=删除类 0 + 改写豁免均有名有到期 + 计数不升 | 负向：否决本波 A「9 处全收至 0」（调研：大爆炸 diff 错误交付物）；不把分层说成门禁已满；不采纳无出处的「必须零豁免才能发版」；D-004 主序不变仅澄清 C07 终点；**拍板前不实施** | current |
| D-004 | Q4 实施主序 × G-B 重签交互（A 全量代码先行 / B 合规优先两轮 G-B / C 代码出波） | A | **全量代码先行，G-B 重签殿后**：主序=①C05(+C07 本波收编) 改码 → ②C01 按 D-003 处置豁免 → ③C04 放行 github-pages environment → ④新 tip **G-A**（test.yml 四 job 全绿 + 0 active F）→ ⑤**用户对新 2026.9.20 zip 重签 G-B**（版本+日期）→ ⑥**G-C**（升格：三 URL + version.json==tag + deploy-tail）。发行件变更 ⇒ 2026-09-15 G-B 声明对**新产物**失效，不得沿用 | 负向：禁止用 09-15 G-B 覆盖改码后的新 zip；禁止 B 的两轮 G-B 偷换为一轮；C 与 D-001 冲突不得静默采用；agent 只备包+检查单、不代签 G-B；C08 tag/商店仍归用户 | **revised**（2026-09-22 · Q5 调研：主序六步**不变**；仅「C07 本波收编」若读成 9→0 全收则与调研冲突，终点改由 D-005 呈报=分层。原记录保留） |
| D-003 | Q3 C01 过期豁免处置形态（调研后呈报，**待用户拍板**；原 Q3 选项 A/B/C） | 采纳 | **已拍板改向（2026-09-22 用户「采纳」）**：①**否决 C 续期**（发行在即，有动作续期仍占 active，违 D-006「0 active F」）；②默认 **A 修复后撤账**，但**先已修后撤账**——empty-state/search 以 A-055 40/40 为已修证据、zoom-dblclick 以票110 根因修复为已修证据，合入/证实后按 105「≥2 连续 main 全绿 + 签名零出现」撤账；③**禁止**在 active+过期状态下挂账等 2 绿；④任一条无已修证据或 G-A 复发 → **B 书面退役**（禁用或删除 + 失败签名存档 + 理由 + issue 链），不续期；⑤三案裁决句=「发行时该行为要不要裸奔」 | 负向：不采纳 atomcode 噪声 ADR-0023/0027/TTL/续期上限2（非本仓）；不静默改 W920 D-004/D-005（已标 revised，**等拍板前不实施改向**）；不把撤账写成豁免成立或 G-A 达成；N/数据完整性永不入账 | current |
| D-002 | Q2 「能解决」的责任边界（C04 environment / C08 tag商店 / G-B） | C08我来，其他的扩大授权给 agent | **C08 归用户，其余扩大授权 agent**：①C08 tag / 商店提交 2026.9.20 = **用户亲自做**，agent 不 tag、不传商店、不代替发行动作；②其余原 Q2 所列及 D-001 全量可解项（含 **C04** github-pages environment 放行、C01/C02/C03/C05/C06/C07/C09、账本措辞、handoff 脏指针、release-status 口径等）**扩大授权 agent 直接解决**；③G-B：**不新签/不代签**——沿用用户已声明「测试通过」2026.9.20 · 2026-09-15；若后续改动导致发行件相对该声明失效，须用户重测后重签，agent 只准备包与检查单 | 负向：agent 禁止执行 C08（tag/商店）；禁止伪造新的 G-B 测试声明；禁止把「扩大授权」解释成可 force-push / 可宣称未实测的三门达成；C04 仅限用 gh/API 放行 environment 等仓库配置，不得顺手 tag；grill 内仍不修源码 | current |
| D-001 | Q1 本轮 grill 的目标边界（A 仅发行闭环 / B 发行+残余债 / C 仅合规处置 / D 另指） | 全部问题都要本次直接解决，全部都能解决的 | **全量本次收口**：本轮目标不是只推发行三门，而是把 backlog C01–C09 与具名残余（N-108-01、F-113-01、豁免过期、账本措辞病、handoff 路径脏指针等）中**一切可解项**全部纳入本次解决范围；不设「可选项挂起」。不可解/须用户侧动作项（如 C04 environment、C08 tag/商店）须显式列出并标责任方，不得静默丢弃 | 负向：grill 内仍不修源码；一次一问；结论必须落盘；版本面保持 2026.9.20；不代签 G-B；未明令不 tag/商店；N/数据完整性永不豁免；禁止把「可解」扩大成「可越权」（C04/C08 仍按 D-006 边界）；禁止用旧 G-C 口径冒充升格达成 | current |

## 覆盖自评（随轮更新）

- 已确认决策: **7**（D-001..D-007）
- 呈报待拍板: **0**
- 连带 revised: W920 D-004⑨ / D-005③（原记录保留）
- 覆盖: 目标边界 ✓ · 责任边界 ✓ · C01 处置 ✓ · 主序+G-B 重签 ✓ · C07 终点分层 ✓ · 票务形态 ✓
- 未覆盖（设计树）: **无** — 主目标/责任/C01/C05+C07/主序-G-B/票务均已决；其余为实施细节（C04 gh environment 具体 API、C06 并入 C03、C09 销账、A-P03 措辞、release-status 口径、handoff 路径）不阻塞定稿
- 与 current 冲突: 已处理 — W920 D-004⑨/D-005③=revised（原记录保留）；D-004 主序执行、C07 以 D-005 为准；Q3/Q5 调研纪要在 reports/；无静默改向
- 调研落盘: `.scratch/wave9-920-followup/reports/Q3-waiver-disposition-research.md`
