# Decision Ledger — Wave9 → 2026.9.15 发行收口 Grill

> 规则: 每条含 ID / 原问题 / 用户原回答原文 / 规范化需求 / 显式约束/负向需求 / 状态
> 源: W9-closeout-handoff + W9-backlog B60–B70 + `.codex-tmp/锐.txt` + origin/main 9fa4666c 实物
> 日期: 2026-09-14
> grill 中不修源码；一次一问；结论必须落盘
> 前序 D 账本: `.scratch/wave9-postrelease-grill/decision-ledger.md` D-001..D-010（仍 current，不重写）

| ID | 原问题 | 用户原回答 | 规范化需求 | 显式约束/负向需求 | 状态 |
|---|---|---|---|---|---|
| D-001 | Q1 本轮 grill 主目标（A 发行收口 / B 治理修复 / C 组合 / D 另指） | C | **组合，A 为主序 + B 并行纸面债**：①主序 A = 9.15 三门发行收口——盯 tip `9fa4666c` test.yml（run 34808080000）至 G-A 定谳 → 绿后关 GitHub #10/#11/#12（附 run URL + 实施证据）→ 等待你 G-B 声明（版本+日期）→ tag/商店另议不自动做；②并行 B = G-A 等待窗内处理治理纸面债——`AI Docs Governance` dead-link 红（run 34808079960）修绿；锐评 6（docs 层 live release-status）与 8（冻结 hack 就地注释）及 backlog B60–B70 在**定稿前**逐项裁定「进 2026.9.15 / 挂后续 / 不做」 | grill 中不修源码（修复只立票/写方案，实施在定稿后）；一次一问；结论必须落盘；版本=2026.9.15；不热修 9.12；不 force-push/换 root；agent 不代签 G-B；不宣称三门达成直至 G-A 实测 + 你的 G-B + G-C；未明令不 tag/push 发行；B60–B70 不自动立票须你裁定；docs-gov 红 ≠ G-A（G-A 只认 test.yml），但 main 治理面红须记账 | current |

| D-002 | Q2 9.15 G-A 是否以 tip 单次全绿定谳并关 #10/#11/#12（A 成立 / B 双绿 / C 加条件 / D 另定） | A | **G-A 成立**：发行 tip `9fa4666c` 上 test.yml run [`34808080000`](https://github.com/Xxx91n/boxing/actions/runs/34808080000) conclusion=success（data-golden + ubuntu/macos/windows 全绿）即视为 ADR-0017 G-A 满足；**不必**对同 tip 再跑第二次。关 #10/#11/#12 时评论须写入该 run URL + 实施证据指针（#10→票87 `boot({reset})` 夹具与报告；#11→票91 `mergeLayoutThreeWay`/`syncBase` + `boxing-merge-three-way.spec.ts`；#12→R1–R3 修绿与本 run）。docs-gov 红**不**阻断本 G-A 定谳（按 D-001 进 B 轨） | 负向：不把 docs-gov 绿写成 G-A；不因单绿宣称「永久无 flaky」；关票不代签 G-B；不 tag/不发商店；不在关票评论宣称三门合取达成（G-B/G-C 未齐） | current |

| D-003 | Q3 B 轨并行纸面债边界（A 仅 docs-gov / B +锐评6/8 / C 全挂后续 / D 点名） | 所有内容都要完成 | **B 轨无「挂后续」，全部进 2026.9.15 收口实施范围**（定稿后实施，grill 中仍不改源码）：①`AI Docs Governance` dead-link 修绿（修 CI regex 与/或 AGENTS/CONTEXT 链接写法）；②锐评 6 = docs 层 live Release status（当前版本/三门状态/在效豁免/欠账指针，不得只活在 .scratch）；③锐评 8 = `ntp.js` `['']` 与 i18n 重复键就地冻结注释（指向票 83/66 报告）；④B63 locale README 14 语对齐；⑤B64 calver 一致性 pre-commit/CI；⑥B65 fire-and-forget 测试族 deflake；⑦B66 亮色 bm-add-btn 对比度；⑧B67 DESIGN.md hairline 语义 revised；⑨B68 boot-theme 早退 failsafe；⑩B69 撤账判据写入规则；⑪B70 innerclip（CI 复现则修，否则观察结案说明）。B60 已由 D-002 完成（G-A 绿）；B61=G-B 仅用户；B62=发行后 G-C | 负向：实施波不得借「完成所有内容」扩成无关重构；B67/B70 等可文档/观察收口但须留下书面结论；仍不热修 9.12；不代签 G-B；未明令不 tag | current |

| D-004 | Q4 B 轨 land 后 9.15 发行 G-A 判据（A 必重跑 / B 纸面豁免 / C 沿用旧 run / D 另定） | A | **发行 G-A 必以最终 tip 重跑为准**：D-003 范围内任一提交进入 main 后，对**新 tip** 再跑 `test.yml`；四 job（data-golden + 三 OS）全绿才满足 9.15 发行 G-A。run `34808080000` @ `9fa4666c` 仍有效，但是 **R1–R3 修复证明 / 中间里程碑 G-A**，**不是** B 轨 land 后的发行终谳。主序：B 轨实施 land → 新 tip G-A 全绿 → 你 G-B 声明（版本+日期）→ 再议 tag/商店 | 负向：不得用 `34808080000` 冒充 B 轨 land 后的发行 G-A；纸面 docs 变更也不自动继承旧绿（统一按 A，不搞 B 的分叉豁免）；G-B 仍禁止 agent 代签；G-C 发行后核；未明令不 tag | current |

| D-005 | Q5 #10/#11/#12 关票时机（A 现在关 / B 等终谳 / C 拆分 / D 另定） | A | **现在关三张**：#10/#11/#12 的 AC（R1 star-sync 修绿、B55 三向实施、G-A 残红出口）已由 tip `9fa4666c` run `34808080000` 全绿满足。关票评论按 D-002：run URL + 实施证据指针（87 夹具 / 91 三向 spec / R2 empty-state token + R3 auto-expand 确定性）。B 轨 land 后的**发行终谳 G-A** 不回开这三张，只写入账本 + 锐评6 Release status | 负向：关票评论不宣称三门达成；不代签 G-B；不顺手 tag；不把 docs-gov 红写进「G-A 已满足」句子造成歧义（须分句写清） | current |

| D-006 | Q6 B 轨实施主序（A 治理→产品→测试→文档→一次 G-A / B 最小可发行 / C 单票流水 / D 另排） | A | **主序冻结为 A 五段**：①治理灭红——docs-gov 死链 + B64 calver 门禁；②产品/注释——锐评8 冻结注释 + B68 boot failsafe + B66 对比度；③测试——B65 deflake + B70 内 clip 观察结论（CI 复现则修）；④文档收口——锐评6 Release status + B63 locale README + B67 DESIGN hairline + B69 撤账判据写入；⑤对**新 tip** 跑发行 `test.yml` G-A（D-004）→ 你 G-B。每段可多 commit，**不必每票烧三 OS**；G-A 只在⑤终谳（以及若①–④中途你另令抽测） | 负向：不打乱五段主序抢跑 tag；②–④ 不得在①红着时宣称「治理已收口」；B70 无 CI 复现也须书面观察结论不得静默丢弃；实施仍待 grill 定稿后 | current |

| D-007 | Q7 9.15 G-B/tag/商店边界（A 维持前序 / B 自动 tag / C 旧产物 G-B / D 另定） | A | **维持前序并钉死实施波出口**：①G-B = 你对 **B 轨 land 后新 tip** 构建的发行 zip（Chrome + Firefox）声明 pass，须含 **2026.9.15 + 日期**；禁止 agent 代签；②G-C = 发行后核 Pages 三 URL / version.json == v2026.9.15；③**tag + 商店提交不在本实施波授权**，三门齐后仍须你另一次明令；④实施波出口 = B 轨完成 + 新 tip G-A 绿 + **等待你的 G-B**，不是自动进入 tag | 负向：不得对 `9fa4666c` 旧产物要 G-B（与 D-004 冲突）；不得三门齐后自动 tag/上传商店；不得把「等 G-B」写成「可发行已达成」 | current |

| D-008 | Q8 B 轨票务形态（A 混合 / B 全 GitHub / C 全 scratch / D 点名） | A | **混合票务**：GitHub Issue = docs-gov 灭红、B65 deflake、B68 boot failsafe、B66 对比度（动产品/CI/测试、影响发行面）；`.scratch` 票 + reports = 锐评6 Release status、锐评8 冻结注释、B63 locale、B64 calver、B67 DESIGN hairline、B69 撤账判据、B70 innerclip 观察结论。锐评6 的**产物**仍必须落 docs/ 层（不得只活在 .scratch）；票可以住在 scratch | 负向：不把 11 项塞进一张大票；不把 Release status 只写在 .scratch；定稿后按 D-006 五段主序建票再实施 | current |

| D-009 | Q 定稿（是否可以定稿） | 采纳 | **Grill 定稿**：D-001..D-008 全部 current 生效；进入整理文档环节（唯一数据源=本账本）；定稿后动作顺序=关 #10–12 → 按 D-008 建 B 轨票 → handoff/CONTEXT settle。实施仍按 D-006 五段，tag/商店仍按 D-007 另令 | 负向：整理环节禁止从对话回忆补写结论；无去向记录不得进入 spec/plan 落笔；grill 内仍不修源码 | current |

## 覆盖自评（随轮更新）

- 轨道: A 发行收口主序 + B 治理/产品/测试/文档全完成（D-001/003）
- 已确认决策: **9**（D-001..D-009）
- 覆盖: 主目标 ✓ · G-A 中间里程碑 ✓（D-002）· B 轨全范围 ✓（D-003）· 发行 G-A 必重跑 ✓（D-004）· #10–12 现在关 ✓（D-005）· 五段主序 ✓（D-006）· G-B/tag 边界 ✓（D-007）· 票务混合 ✓（D-008）
- 与 current 冲突: 无 revised；D-002 的 `34808080000` 明确降级为中间里程碑，发行终谳见 D-004
- 整理: dest-recon/spec/plan/scratch票/handoff 已落盘；#10–12 已关；GH #13–#16 已建；CONTEXT settle 已插入
- 定稿: **是**（2026-09-14 用户「采纳」· D-009）

## 整理落盘（2026-09-14 · D-009 后）

- destination-reconciliation-wave915.md · 无去向=空
- spec.md · plan.md · issues/01,02,03,04,07,09,10 · handoffs/W915-grill-handoff.md
- GitHub Issue 关票/建票与 CONTEXT settle 见执行步
