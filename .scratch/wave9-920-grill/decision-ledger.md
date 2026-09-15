# Decision Ledger — Wave9.20 Grill

> 规则: 每条含 ID / 原问题 / 用户原回答原文 / 规范化需求 / 显式约束/负向需求 / 状态
> 源: W915-release-handoff + B71–B78 + `.codex-tmp/锐.txt` + 用户 bug 日志 + origin/main a1acaaac 实物
> 日期: 2026-09-15
> grill 中不修源码；一次一问；结论必须落盘
> 前序 D 账本: `.scratch/wave9-915-release-grill/decision-ledger.md` D-001..D-009（仍 current，不重写）
> 前序更早: `.scratch/wave9-postrelease-grill/decision-ledger.md` D-001..D-010
> 前序 A 账本: `.scratch/architecture-recovery/decision-ledger.md` A-001..A-061

| ID | 原问题 | 用户原回答 | 规范化需求 | 显式约束/负向需求 | 状态 |
|---|---|---|---|---|---|
| D-008 | Q 定稿/进入整理（用户令：开始 grill 结束后的整理文档环节） | 开始整理文档环节 | **Grill 定稿，进入整理**：唯一数据源=本账本 D-001..D-007；整理产物=destination-reconciliation + spec + plan + issues + handoff；无去向记录非空则停下呈报；CONTEXT settle 仅写本 grill 已确认事实 | 负向：禁止从对话回忆补写结论；无去向不得进 spec/plan；整理环节仍不修源码；不创建 GitHub Issue 直至用户下令实施建票 | current |
| D-007 | Q7 9.20 票务形态与实施主序 | OK | **混合票务 + 五段主序**：①GitHub Issue=P0 deleteBookmark+回归 spec、静态门禁、Pages G-C 升格+deploy verify（含 ADR-0017 修订+B75 并入）、B71、B72、B73；②.scratch 票=release-status 单一状态块、B74 DESIGN 注记、B77 CHANGELOG；③主序五段：P0+门禁 → 测试硬化(B71/72/73+豁免路径) → Pages/G-C → 文档收口(release-status/B74/B77) → 新 tip G-A 全绿→用户 G-B→另令 tag；④版本面实施波内推 calver 至 2026.9.20；⑤tip 在 a1acaaac 线性追加 | 负向：不把全项塞进一张大票；P0 不得排在文档之后；定稿后按本账本建票再实施；grill 内仍不修源码 | current |
| D-006 | Q6 9.20 发行出口与 tag/商店边界 | OK | **钉死三门出口 + tag 另令**：①G-A=实施 land 后新 tip test.yml 四 job 全绿；豁免按 105 撤账后应 0 条 active F；N/数据完整性永不豁免；②G-B=用户对 9.20 发行 zip 声明 pass（版本+日期），禁 agent 代签；③G-C=按 D-003 升格（三 URL 200 + version.json==tag + 部署尾部 verify）；④三门齐后 tag/商店仍须用户另一次明令，商店人工上传；⑤9.15 商店包持有不热修，P0 以 9.20 发行为准；⑥B76 维持不做 | 负向：不宣称三门达成直至 G-A 实测+用户 G-B+G-C；不代签 G-B；未明令不 tag；不把 9.15 热修塞进本波 | current |
| D-005 | Q5 锐评 Top-5 剩余治理项是否进 9.20 | 全部进 | **三项全进**：①release-status 收敛单一状态块——删 §一 旧「不可发行」表、终谳预留块填 09-14 实测、旧 run 标 Superseded、页内规则「有且只有一个状态块」（文档票进 9.20）；②D-008 线性证明=过程红线——9.20 全部提交只在 a1acaaac 之上线性追加，导出工具做不到先改工具再开波；③豁免清零=9.20 G-A 出口条件——09-19 到期，前两轮 main CI 全绿按 105 判据撤 3 条 F 行；④静态门禁维持 D-002 姊妹票 | 负向：release-status 禁止只改标题不删矛盾表；D-008 第二次 root 导出即违规须停波；豁免不得无动作续期；grill 内不实施 | current |
| D-004 | Q4 B71–B78 逐项去向 | 全部调用进表，除了B76不需要更新 | **B71–B75+B77 全部进 9.20 实施表；B76 不做不更新；B78 维持已消**：①B71 N-101-06 zoom-dblclick 异源签名 — 立票进 9.20；②B72 N-106-01 innerclip setTimeout 预算 — **不再挂观察**，进 9.20 修；③B73 contrast-guard 串 pretest — 进 9.20；④B74 DESIGN Box/Zoom 偏差注记 — 进 9.20 文档；⑤B75 demo version 抽查 — 进表并入 D-003 升级 G-C 实施（同票 AC）；⑥B76 商店 listing 文案/截图 — **不更新、不立票**；⑦B77 CHANGELOG 9.15 扩写 — 进 9.20；⑧B78 维持已消；⑨3 条 active 豁免 09-19 到期 → 9.20 前两轮 CI 全绿按 105 判据撤账（实施出口，非 backlog 票） | 负向：B76 不进 agent 范围；B72 不得再以「观察未到期」推迟；B75 不得另开与 D-003 重复的抽查票；grill 内不实施 | current |
| D-003 | Q3 Pages 发行后严格同步门禁形态（A 纯流程 / B version 断言 / C 全自动部署 / D 另定） | ok | **B 升级 G-C + 部署尾部自动 verify**：①G-C 从「三 URL 200 + 状态码」扩写为「三 URL 200 **且** GET demo/version.json（cache-buster）解析 version == 最新 release tag」；②demo-deploy.yml deploy job 尾部 verify step ≤180s 轮询至收敛，不收敛红；③build-demo 稳定产出 version.json={version,deployedAt} 待实施核验；④保留人工检查单（不取消 ADR-0017 人工黄金路径）；⑤吸收关闭 B75；⑥一次性核查 github-pages environment 放行 tag、Pages 仅 Actions 模式；⑦实施时显式修订 ADR-0017 G-C 行 + release-status + publishing-guide（保留原句+修订段，非静默改向）；调研 reports/Q3-pages-sync-gate-research.md；无 D 冲突 | 负向：不做 mike 多版本目录；不取消人工复核；不把自动 verify 写成「三门已达成」；失败两态（不匹配=部署链路 / 读不到=存活）写入检查单；grill 内不改源码 | current |
| D-002 | Q2 P0 书签删除复活修法形态（A 手术 markDeleted / B 架构 deleteBookmark 走 commit / C A+静态门禁 / D 另定） | ok | **B 架构式 + 姊妹票静态门禁**：①`mutationHandlers.deleteBookmark(state,{largeId,smallId,bmId})` 返回 `tombstoneIds:[bmId]`；popups 删除按钮走 `commit('deleteBookmark',…)`，废弃 L189 裸 splice；②同波或紧随姊妹票：静态门禁扫描 ntp/** 中 layout 集合删除/改写不在 mutationHandlers 即 exit 1（白名单注释豁免）；③回归 spec never-quarantine：add→delete→陈旧存储合并/reload→不复活 + `_meta.deleted` 含 bmId；④add L282/301 与 reorder L407 是否同票收编，实施时再裁定优先级（不阻塞选型）；调研报告 reports/Q2-bookmark-delete-fix-research.md；与 ADR-0007 Q2 零冲突、无 revised | 负向：禁止只做手术式 A 而不门禁；禁止绕过 commit 继续旁路删除；数据完整性类回归禁豁免；grill 内仍不修源码；不热修商店 9.15；目标 tip a1acaaac 线性追加 | current |
| D-001 | Q1 本轮 9.20 主目标（A 发行修复 / B 治理收口 / C 组合全收 / D 另指） | 全部ALL收口，同时再新增一个门禁：必须保证发行版每次发行后严格同步部署pages更新保证不过时的票据 | **C 全收 + 新增 Pages 同步门禁**：①主序全收——P0 书签删除复活必进 9.20；锐评 Top-5（P0 修墓碑/收编 commit、release-status 单一状态块、D-008 线性证明、B75+豁免清零、绕过 commit 的删除静态门禁）全部进范围；B71–B78 在本 grill 内逐项裁定去向（进 9.20 / 挂后续 / 不做）；②新增门禁：**每次发行后 Pages 必须严格同步部署、保证不过时**——需立票据（形态待 Q2+ 细化：G-C 从「三 URL 200」升格或另加内容新鲜度断言） | grill 中不修源码；一次一问；结论必须落盘；版本=2026.9.20；目标 tip 在 a1acaaac 之上线性追加（证明 D-008）；agent 不代签 G-B；不宣称三门达成直至 G-A 实测 + 用户 G-B + G-C；未明令不 tag/push 发行；数据完整性 never-quarantine 不豁免；B71–B78 不自动立票须逐项裁定 | current |

## 覆盖自评（随轮更新）

- 已确认决策: **8**（D-001..D-008）
- 覆盖: 主目标+Pages 门禁 ✓ · P0 修法(B+静态门禁) ✓ · Pages G-C 升格 ✓ · B71–B78 ✓ · Top-5 治理三件套 ✓ · 发行三门/tag 边界 ✓ · 票务+五段主序 ✓
- 遗留实施细节（不阻塞定稿）: D-002④ add/reorder 是否与 delete 同票；addBookmark 是否强制 id 迁移
- 与 current 冲突: 无 revised；ADR-0017 G-C 行为计划内扩写（D-003）
- 调研落盘: reports/Q2-bookmark-delete-fix-research.md · Q3-pages-sync-gate-research.md
- 定稿: **是**（2026-09-15 用户令进入整理 · D-008）
- 与 current 冲突: 无
