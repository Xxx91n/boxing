# Decision Ledger — Wave9 发行后纸面债 / G-A 定评 / 锐评 Top-5 Grill

> 规则: 每条含 ID / 原问题 / 用户原回答原文 / 规范化需求 / 显式约束/负向需求 / 状态
> 源: `.codex-tmp/锐.txt` 2026-09-13 新锐评 + W8-backlog B50–B57 + handoff W8-closeout-archived
> 日期: 2026-09-13
> grill 中不修源码；一次一问；结论必须落盘

## 覆盖自评（随轮更新）

- 轨道: A+B+C 三轨全收（D-001）· 主序 B→A→C（D-002）
- 已确认决策: **10**（D-001..D-010）
- 覆盖: 轨 B G-A 定谳+姿态 ✓（D-003/004，run 34749813393）· 9.15 边界 ✓（D-005）· 商店/G-B 口径 ✓（D-006/007）· 历史模型 ✓（D-008）· B55 整票 ✓（D-009）· live notes+票务 ✓（D-010）· 轨 A 纸面债已纳入 1–8 与 10a · 轨 C B54/B56 在 D-005，B55 在 D-009
- 与 current 冲突: 无 revised
- 整理: 账本+定谳报告+基线已落盘；未修源码；未立 issue（待定稿后）
- 定稿: **是**（2026-09-13）· 纸面债已实施 · Issues #10/#11/#12 已建 · 实施波待 push/开码

## 决策表

| ID | 原问题 | 用户原回答 | 规范化需求 | 显式约束/负向需求 | 状态 |
|---|---|---|---|---|---|
| D-001 | Q1 本轮 grill 主目标（A 纸面债 / B G-A 定谳 / C 技术债分诊 / D 组合） | ABC | **三轨全收**：A 纸面债收口（ADR-0017 修订、release-notes 修正通道、徽章+AGENTS+历史模型）· B G-A 定谳（B50：main test.yml 定谳 + 残红分桶 + 发行姿态裁决条件）· C 技术债实施分诊（B54–B56 是否立下一波票）。商店 AMO/Edge 上传仍为你侧并行，不阻塞 grill | grill 中不修源码；一次一问；结论必须落盘；G-B 维持 D-009 强制豁免口径除非你另令；不扩 ADR-0017 合取（仍禁 G-D）；不把强制 G-B 写成可审计 G-B；版本控制 but；公开文档禁本机绝对路径 | current |
| D-002 | Q2 三轨主序（B→A→C / A→B→C / B→C→A / 并行） | B→A→C | 主序冻结为 **B→A→C**：①B G-A 定谳（b4f3df2 上 test.yml + 残红分桶 + 发行姿态裁决）→ ②A 纸面债（ADR-0017 修订须引用 B 结论；release-notes/徽章/AGENTS/历史模型）→ ③C B54–B56 仅立票分诊。A 的非依赖项（如 release-notes 病句规范、AGENTS 路径规范）可在 B 等待 CI 时并行起草，但 **ADR-0017 修订落盘必须在 B 定谳之后** | 负向：不因 A/C 问题抢先而打乱主序；C 不在本 grill 动源码；B 定谳前不改 ADR-0017 关于 G-A 的表述 | current |
| D-003 | Q3 是否授权触发 test.yml 对 b4f3df2 做 G-A 定谳跑（A/B/C/D） | D | **授权触发定谳跑 + 预取对照**：①`gh workflow run test.yml` 打在 origin/main（b4f3df2）；②同步拉取 run 34737182812（c2952aa5）失败日志/签名作分桶对照基线；③结果出来后按 N/B/F 分桶，再呈报发行姿态选项。定谳对象必须是 **b4f3df2（发行 tip）**，不得用中间态 run 冒充 | 负向：不改源码、不 push、不 tag、不宣称 G-A 绿直至三 OS+data-golden 实测；分桶时 N 桶 never-quarantine / 数据完整性禁豁免；禁止用本地 Windows 绿代替 CI 定谳 | current |
| D-004 | Q4 2026.9.12 发行姿态（持有/热修.1/挂起/豁免折绿） | 面向下一个版本2026.9.15开发，全部修复 | **2026.9.12 持有不热修**；下一正式版本号 = **2026.9.15**；本波目标改为「面向 2026.9.15 全部修复」：G-A 残红（R1 star-sync B 桶 / R2 empty-state 待分诊 / R3 auto-expand F）+ 既有 backlog 与纸面债中的可修项，以 2026.9.15 可过闸发行（或至少 G-A 绿 + 纸面对齐）为出口。商店若已/将提交 2026.9.12 则不因本决策回撤；未提交则可等 .15 | 负向：不对 2026.9.12 发热修 tag；不把 R1 豁免折绿；grill 本阶段仍不修源码；「全部」边界待 Q5 冻结（默认含 R1–R3 + ADR-0017 修订 + release-notes/徽章/AGENTS/历史模型 + B54/B55/B56 分诊去留）；不扩 ADR-0017 三门合取；不宣称 2026.9.12 门禁达成 | current |
| D-005 | Q5 2026.9.15「全部修复」边界（A/B/C/D） | A（12-14已经全部解决，应该全部pass） | **采纳 A**：必进 1–8（R1–R3 + ADR-0017 + release-notes + 徽章 + AGENTS/CI 路径门禁 + 历史模型真话）；9–11 进 2026.9.15，**B55 允许拆票**（核心进 .15，边缘可挂后续）；**12–14 用户声明已全部解决、应全部 pass**——G-B/慢放/商店上传不进本波 agent 代码清单，账本记为 user-resolved，不再立实施票。出口：main test.yml 绿（或仅具名 F 且不拖 job）+ 纸面 1–8 落盘 + 2026.9.15 版本就绪 | 负向：不把 12–14 重开为 agent 任务除非用户另令；B55 不许假装已实施；不对 9.12 热修；grill 仍不修源码；不宣称 9.12 三门达成 | current |
| D-006 | Q6 商店 2026.9.12 状态 + G-B/慢放是否免证据路径（A/B/C/D + 是/否） | A，是 | **两店 2026.9.12 已过审并对外可见**（AMO + Edge）；README/徽章/发行文档应改为「store latest = 2026.9.12」，不得再写 store remains 9.11。**G-B/慢放（12/13）以用户侧已完成为准，不需要证据路径/截图归档**；账本仅记 user-resolved pass | 负向：不把「商店可见」写成 G-A/G-B 达成；不索要 G-B 证据包；不因商店已上架而宣称三门合取满足；9.15 发行门禁另问（Q7） | current |
| D-007 | Q7 2026.9.15 G-B 口径（A 免证据用户声明 / B 检查单 / C 证据包 / D 非阻塞） | A | **G-B 证据形态正式改为「用户声明 pass」**（含版本号+日期；用户实机，可无勾选单/截图）。ADR-0017 修订写入该口径，并保留 **禁止 agent 代签 G-B**。G-A 仍必须 CI 绿；G-C 仍 200。D-009 不再被描述为「一次性事故豁免」而被升格为常设 G-B 形态之一 | 负向：agent 不得伪造/代填 G-B pass；不把 G-B 非阻塞化；不扩三门为四门；不因商店已上架跳过 9.15 门禁 | current |
| D-008 | Q8 Git 历史模型（A 线性 / B 快照 / C 线性+例外） | A | **9.15 波在 b4f3df2 之上线性追加，禁止换 root / 禁止对已推送 main 做历史手术**。同步修订 docs/history/README.md：删除/改写「Never rewrite」与行为不符的措辞，改为真实约束——权威=GitHub origin/main；本地 workspace 可重生；**已推送提交只追加不重写**。用本波提交证明声明 | 负向：实施波不得 force-push 新 root；未明令不 rebase 已推送 main；不把声明写成「永不 force-push 任何分支」而限制 workspace 内 but 操作 | current |
| D-009 | Q9 B55 拆法 + 实施主序 | B | **B55 整票进 2026.9.15**（不拆边缘）：实施 80 方案 baseRevision/等价 + 子盒/id 级合并，消灭静默吞没；冲突副本 UI 接线；自动化双端子盒 e2e。主序你未另指，**暂按推荐**：纸面快赢 ∥ R1 分诊 → R1 修 → R2/R3 → B54 → B55 → 版本 2026.9.15 → G-A 定谳；若要改主序在下一条 revised | 负向：B55 不许只落方案；不许静默改 newer-wins 而不更新 80 报告；grill 仍不修源码；主序可经用户下一条 revised | current |
| D-010 | Q10a 9.12 live 病句通道 + Q10b 票务形态 | AC | **10a=A**：修 `docs/release-notes/2026.9.12.md`（npm ci、拆 bullet、去反斜杠）并用 `gh release edit --notes-file` 刷新 v2026.9.12 公开正文；不改 tag/附件。**10b=C 混合票务**：P0 立 GitHub Issue（R1 star-sync、B55 merge 三向、G-A 出口/残红治理）；纸面债（ADR-0017/徽章/AGENTS/history/CI grep/release-notes）不立 issue，进 W9 计划票直接实施 | 负向：release edit 只改 body 不重传资产；不把纸面债拆成一堆空 issue；P0 issue 须带 AC 与桶依据；仍不 force-push | current |
