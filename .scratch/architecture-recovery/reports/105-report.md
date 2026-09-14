# 105 报告 — 撤账判据写入规则（B69）

> 票: **105** · covers **A-059** · Blocked by: **97**（A-051，已 implemented → 阻塞解除）
> 波: Wave9.15（目标版本 **2026.9.15**，持有 2026.9.12 不热修）· 段: ④ 文档
> 日期: 2026-09-14 · 版本控制: WORKFLOW §4.2（GitButler `but`）
> 分支: `ticket/105-unflaky-criteria-b69`（本票独立分支，未 push、未开 PR）
> 调研原始输出: `.scratch/105-atomcode/prompt.md` · `atomcode-research.md`（成稿，16.4 KB）；首次尝试日志 `atomcode-raw.log` 被 `.gitignore` 的 `*.log` 规则排除，属本地临时产物（限流中断证据，不入库）

---

## 0. 开工复述（启动器「开工第一句」三项）

**① 阻塞 / 被阻塞关系**

- 本票 **Blocked by: 97**。账本 A-051 = `implemented`（2026-09-14），`docs/release-status.md` 已落盘（git log `e656ed3f` / `21c2eff1`）→ **阻塞已解除**。
- 本票**不阻塞他票**；同段④兄弟票 103(B67) / 99(B63) 并行、互不依赖。
- wave915 scratch 票 `issues/09-unflaky-criteria-b69.md` 记 `Blocked by: 01-release-status-rui6（欠账指针互链）`，同已解除。

**② 必读清单存在性**（启动器 7 项 + handoff 表追加 D 账本/plan，**全部存在且 UTF-8 无损坏**）

| 来源 | 路径 | 体量 |
|---|---|---|
| 启动器 | `.scratch/architecture-recovery/prompts/105-unflaky-criteria-b69.md` | 741 B / 27 行 |
| handoff | `.../handoffs/105-unflaky-criteria-b69-handoff.md` | 1664 B / 51 行 |
| issue | `.../issues/105-unflaky-criteria-b69.md` | 602 B / 22 行 |
| spec | `.../spec.md` | 2194 B / 58 行 |
| 过程 | `.../WORKFLOW.md` | 33454 B / 175 行（改后 36250 B / 183 行） |
| 门禁 | `docs/adr/0017-release-data-gate.md` | 10313 B / 88 行 |
| 领域 | `docs/CONTEXT.md` | 32044 B / 178 行 |
| A 账本 | `.../decision-ledger.md` | 18080 B / 140 行 |
| D 账本 + Plan | `.scratch/wave9-915-release-grill/{decision-ledger.md,plan.md}` | 8990 B / 1775 B |

**③ handoff 内通用调研三项**：① atomcode 深度调研（串行一次）② 回顾 `docs/adr` / `docs/CONTEXT.md` 现有心智模型（冲突不得静默改向）③ 对标工业级实现/测试策略。结论见 §1（先行于实现）。

---

## 1. 通用调研摘要（handoff 通用三项）

### 1.1 atomcode 深度调研（串行一次）

- **载体**：`node.exe` 绝对路径直拉全局 `@atomgit.com/atomcode/bin/atomcode.js`（票 28/89 配方），headless `--prompt-file … --no-telemetry --dev`，后台串行。
- **第一次尝试**：exit 0 / 5m01s，但在第二阶段被 **5h 限流**截断（日志 `atomcode-raw.log`），**未产出成稿**；未将进度叙事当结论。
- **续跑**：按日志打印的 resume id `98fda889-c424-4e36-b6d6-6aa6f6be80c5`，在限流窗口重置后 `--resume` 成稿 → **exit 0 / 11m02s**，成稿 `atomcode-research.md`（16.4 KB）。
- **自述配额**：searches 11（web_search×6 / tavily×1 / anysearch batch×4）· full reads 11（Datadog、GitLab handbook+docs、Dropbox、Google Testing Blog、Chromium tree-sheriffs、Azure DevOps、rushstack#4465、Mill、Tenki、Meta PFS）· 13 条来源清单。
- **核心结论（六问，均附来源）**：

| 问 | 结论（推荐） | 关键来源 |
|---|---|---|
| Q1 撤销/复权判据 | 结构 = **事件闸（连续多轮全绿）+ 时间闸（观察窗/硬到期）+ 复发安全网**；各家阈值：Datadog **30 天窗内零复发自动转 Fixed**；GitLab **>100 次本地一致通过 + 根因已修**，出隔离后**监控 1 周 + 复发立即重隔离**；Tenki **10+ 连续通过**；rushstack「**multiple times in a row**」；Azure DevOps **无自动撤账**（纯人工 unmark）。**无一家以单次全绿为判据** | Datadog Docs（现行）；GitLab Handbook（2026-08）；Tenki Blog（2026-05）；rushstack#4465（2023-12）；Microsoft Learn（2025-05） |
| Q2 单次 run 零出现是否足够 | **不足**。flaky 定义（同码 pass+fail）使单次绿无证明力；工业撤账判据**全部是多采样结构**；防 premature de-quarantine 靠**安全网**而非完美判据（Mill：出隔离后仍 flaky 会被自动隔离系统「抓回」） | Google Testing Blog（2016）；Dropbox Athena（2019）；Mill Blog（2025） |
| Q3 与 N/B/F 耦合 | **F 可撤账**；**B 不得以连续绿撤账**（Datadog 自动转 Fixed 前专设 broken 防线：近 7 天 100% 失败率则**拒绝**自动转 Fixed）；**N 不存在撤账出口**，只允许修绿（映射 Datadog **Disabled 例外**：无运行信号即无撤账证据） | Datadog Docs；GitLab Handbook；Dropbox Athena |
| Q4 到期机制 | 保留「硬到期不得续期」为**时间闸**（同构 GitLab 3 个月硬顶 / Tenki 14/30/45 天阶梯）；「连续绿次数」为**事件闸**提前出账通道；**N=2 维持**（工业下限），但加 corroboration + 观察窗约束 | GitLab Handbook；Tenki Blog；rushstack#4465 |
| Q5 文档层级 | **三层分工**：ADR 记「为什么」、台账规则文件记「判据本体（机器可读）」、校验脚本做「执行点」；**ADR 与脚本引用台账文件，不复制阈值**（单一真相源） | GitLab Handbook ↔ GitLab Docs 双页互链而非互抄（两页均核验）；Datadog 单页状态机 + 引用 |
| Q6 corroboration 是否必须 | **必须**；≥2 次全绿中**至少 1 次为同码 corroboration run**（最小合计 2 次）。「同码重跑」正是工业判 flake 的**第一原语**（Dropbox：在它曾通过的 commit 上重跑）；同码重跑控制代码变量，证据干净；「等新 main run」分不清「修好了」与「代码绕开了触发条件」 | Dropbox Athena（2019）；rushstack#4465；Tenki（2026） |

- **对本仓三条建议（已采纳并落地，见 §2）**：① N=2 + ≥1 corroboration + 不同触发源/≥24h 观察窗 + 复发即重新入账；② 应做成机器校验（扩展现有发行前脚本）；③ 撤账行最小证据字段（撤账日期 + 证据 run ×2 含 SHA + corroboration 标记 + 复发承诺）。

### 1.2 ADR / CONTEXT.md 心智模型回顾

| 来源 | 现行模型 | 与本票关系 | 是否冲突 |
|---|---|---|---|
| **ADR-0017**（修订 2026-09-13） | 可发行 = G-A ∧ G-B ∧ G-C；G-A = 残红清零**或**每条有书面定谳豁免；豁免条目 5 字段；**不得永久豁免**；每次发行前复查；N/B 不得豁免 | 本票只**细化豁免台账的撤账判据**，**不改三门定义、不改 ADR-0017 一字**、不扩门禁、不宣称三门达成、不代签 G-B | **无冲突** |
| **WORKFLOW §4.4** 台账规则 | 修绿优先 / broken-flaky 分界 / never-quarantine / 5 字段 / 硬到期不得续期 / 发行前复查 | 本票在该规则列表内**新增「撤账判据」条**（原列表**未**定义「如何合法出账」，这正是票 74 事故的结构成因） | **无冲突**（补口而非改口） |
| **docs/CONTEXT.md** release gate 段 | release gate = G-A∧G-B∧G-C；release status page 为 live 看板 | 本票不改产品代码、不触不变量；仅补测试治理记录 | **无冲突** |
| **D-003⑩ / D-006④ / D-008** | B69 = 撤账判据写入规则；属段④文档；scratch 票 | 本票按此实施 | **无冲突** |

**revised 呈报：无**（未发现需改向的冲突）。

### 1.3 工业对标（Playwright 扩展 e2e / CI 门禁）

- 本仓门禁结构不变：`test.yml` = 3 OS × test job + 独立 `data-golden` job；CI `workers: 2` + `retries: 2`，本地 `workers: 4` + `retries: 0`（票 20 策略）→ **CI 是定谳口径，本地绿不得替代**（D-003 负向约束）。
- 本票**未引入新依赖、未改任何 spec、未改 workflow、未改 manifest**。
- **未把新校验接入 `pretest`**：`waiver-ledger-check` 的既有定位是「发行前 G-A 步骤」的手工闸门（§4.4），不是 test.yml/G-A 面；把本票混入 pretest 会与 G-A 面纠缠（同票 96 对 `docs-link-guard` 的处置原则）。

---

## 2. 实施内容

### 2.1 规则写入面（4 处 + 2 处指针）

| # | 文件 | 改动 | 定位 |
|---|---|---|---|
| 1 | `.scratch/architecture-recovery/WORKFLOW.md` §4.4 | 新增「**撤账判据 (Revocation Criteria — 票105/B69)**」规则条（6 点：连续绿次数 / 连续语义 / 撤账证据 / N-B-F 分桶 / 门禁边界 / 复发即重新入账） | **判据本体（SSOT）**；`waiver-ledger-check.mjs` 的解析面 |
| 2 | `docs/testing-governance.md` | 新增 `## Waiver ledger revocation criteria (ticket 105 / B69)` 章节（docs 层记录） | 测试治理文档（docs 层可读） |
| 3 | `docs/release-status.md` §四 | 新增「撤账判据」硬约束条 + 机器校验行补注 + 变更记录 + A-059 行置 implemented | 发行状态看板 |
| 4 | `test/README.md` | 新增「Waiver revocation criteria」指针段 | 测试套件入口可发现性 |
| 5 | `docs/START-HERE.md` §3 | 指针描述补 `waiver revocation criteria` | 新读者入口 |
| 6 | `scripts/waiver-ledger-check.mjs` | 机器校验扩展（见 2.2） | 执行点 |
| 7 | `.scratch/architecture-recovery/README.md` | Wave9.15 波次表：105 → **implemented**（agent 侧闭环 · 待首脑复核）；Frontiers 移除 105 | 大脑派发表（防重复派发） |

### 2.2 撤账判据本体（六点，WORKFLOW §4.4）

1. **连续绿次数 (≥2)**：目标面须在 **≥2 个连续的 main 全量 `test.yml` run** 中**签名零出现**；**单 run 零出现不足以撤账**（票 74 事故具名）；附工业口径来源指针。
2. **连续语义**：两次 run 之间被测面代码若变（`ntp/**` · `test/**` · `.github/workflows/test.yml` · `manifest.json`），计数**重置**；仅 `.scratch/**` 差异可按 tip 等价性沿用。
3. **撤账证据（机器校验字段）**：处置记录须含 `撤账证据:` 标记 + **≥2 个 distinct run 引用** + 撤账日期；其中 **≥1 个必须是 corroboration run**（同码重跑）并**显式标注 `corroboration`**；两次 run 须**分属不同触发源**或**间隔 ≥24h**。
4. **N/B/F 分桶约束**：仅 **F** 可入账、因而仅 F 可撤账；**B 不得入账 → 无撤账路径**（只能修绿或书面退役）；**N 永不入账、永不撤账**（红灯只允许修绿）。
5. **门禁边界**：撤账只改变「该残红是否仍在效」，**不**等于豁免成立、**不**等于 G-A 达成、**不**解除 ADR-0017 三门合取；「不得永久豁免」与「发行前复查」义务不因撤账而变。
6. **复发即重新入账**：撤账后同签名在任意后续 main run 再现 → 该行**立即恢复 `active`** 并记为一次撤账失败（GitLab 1 周观察 + Mill 自动回抓的安全网）。

### 2.3 机器校验扩展（`scripts/waiver-ledger-check.mjs`）

在既有 3 条（active 5 字段 / 硬到期 / never-quarantine）之上新增 **3 条**，均 exit≠0 阻断发行：

| 新检查 | 含义 |
|---|---|
| 规则节存在 | 台账段必须仍含「撤账判据」——规则被删即闸门失败 |
| `closed` 行 ≥2 distinct run | `撤账证据:` 标记区须引用 **≥2 个去重后的 run**（同一 run 写两次计 1） |
| `closed` 行含 corroboration 标注 | 标记区须含 `corroboration`——把「≥1 次同码重跑」由纸面变硬约束 |
| （既有）never-quarantine **含 closed 行** | NQ 名单拦截从 active 扩到全部行 |

### 2.4 台账存量行回填（事实正确性说明）

唯一 `closed` 行（`boxing-auto-expand` / chromium）补录 `撤账证据:` 标记，引用 **34773593267（push, headSha 16ce5d27）** 与 **34778641702（corroboration, workflow_dispatch, 同码 02d31657）**。

**事实核验**：票 93 台账「基线 2026-09-14」段载明 corroboration run 34778641702 的 4 条 flaky 为 Bug5-dark(ubuntu ff+ch ×2、windows ff ×1) 与 search(macos ff ×1)，**不含 auto-expand** → 该面在两个全量 main run 中均零出现，两个 run 触发源不同（push vs workflow_dispatch），**满足新判据**，非追溯放宽。

---

## 3. AC 对照

| Acceptance criteria | 状态 | 证据 |
|---|---|---|
| **规则文档含连续绿次数与 N/B/F 约束** | **done** | WORKFLOW §4.4 六点（点 1 = 连续绿次数 ≥2；点 4 = N/B/F）；`docs/testing-governance.md` 同载；`docs/release-status.md` §四同载；`test/README.md` 指针同载。机器校验 `node scripts/waiver-ledger-check.mjs` exit 0（§4） |
| **与 ADR-0017 书面豁免规则不冲突** | **done** | ADR-0017 **零字节改动**；规则点 5「门禁边界」显式声明撤账 ≠ 豁免成立 ≠ G-A 达成，不放松三门合取、不放松「不得永久豁免」与「发行前复查」；ADR-0017 要求的 5 字段 / 硬到期 / N-B 不得豁免均**未被削弱**（新判据只增不减） |

---

## 4. 验证锚点（实测）

| 面 | 命令 / 证据 | 结果 |
|---|---|---|
| 机器校验（当日） | `node scripts/waiver-ledger-check.mjs` | **exit 0** — 4 行（1 closed 含 ≥2-run + corroboration 撤账证据），字段齐全、无过期、NQ 零命中（含 closed）、规则节存在 |
| 机器校验（硬到期边界日） | 同上 `--as-of 2026-09-19` | **exit 0** |
| 机器校验（越界 1 天） | 同上 `--as-of 2026-09-20` | **exit 1** — 3 条 active 全部 EXPIRED（硬到期机制咬合，非纸面） |
| **负向对照（7 例，沙箱副本跑，不污染工作树）** | 见下表 | **7/7 如预期** |
| 语法 | `node --check scripts/waiver-ledger-check.mjs` | exit 0 |
| 文档指针 | `node scripts/docs-pointer-check.mjs` | **PASSED** — 74 指针 / 9 入口文档 / 0 broken / 0 machine paths |
| 导入图门禁 | `node scripts/import-graph-guard.mjs` | exit 0 |
| 迁移 golden 门禁 | `node scripts/migration-golden-guard.mjs` | **28/28** ok |
| CSS 平衡门禁 | `node scripts/css-balance-guard.mjs` | OK（6 源平衡、无嵌套 `[hidden]`） |
| calver 门禁 | `node scripts/calver-guard.mjs` | OK version=2026.9.15（8 面一致） |
| onboarding 门禁 | `node scripts/onboarding-guard.mjs` | self-test 7/7、46 specs、零反模式 |
| docs 链接门禁 | `node scripts/docs-link-guard.mjs` | 8 引用 / 0 dead |
| 行尾 / 空白 | `git diff --check` | exit 0（clean） |
| 字节完整性 | 10 个改动/新增文件逐字节复读 | 无 BOM、无 CRLF、无 NUL |

**负向对照明细（把「文档不漂移」变成「文档不敢漂移」的证明）**

| 变异 | 预期 | 实测 |
|---|---|---|
| baseline（未变异） | exit 0 | exit 0 |
| 删 `撤账证据:` 标记 | exit 1 | exit 1（no marker） |
| 证据只引 1 个 run | exit 1 | exit 1（cites 1 distinct run） |
| 证据引同一 run 两次 | exit 1 | exit 1（去重后仍 1） |
| 证据引 2 run 但无 `corroboration` 标注 | exit 1 | exit 1（lacks corroboration annotation） |
| 抹掉「撤账判据」规则节 | exit 1 | exit 1（missing revocation criteria rule） |
| `closed` 行命中 NQ 名单（改成 `data-golden`） | exit 1 | exit 1（never-quarantine, closed 行同受约束） |

---

## 5. 偏离 / 呈报（不静默）

**P-105-1（过程倒置，如实记账）**：手off 要求「调研结论写入报告开头，**再**进入实现」。实际执行中，第一轮 atomcode 因 5h 限流中断且未成稿，而核心判据（≥2 连续 main 全绿）在本仓已有**独立于本次调研的先例**（票 93 §1.2 revised-1 + §7 S2 呈报；票 101 验收标准「连续 2 个全量 CI run 无同签名复发」；票 93 已实跑 corroboration run）——因此先落了核心判据，**在续跑成稿后**按调研第 ①②③ 条建议**回填了三项强化**（corroboration 必须为条件之一 / 不同触发源或 ≥24h 观察窗 / 复发即重新入账），并**重跑了全部校验与负向对照**。不存在「调研未回填」或「先结论后编来源」。

**S-105-1（呈报大脑，本窗口不擅自动作）**：调研建议 ADR 层只记「为什么」并以相对链接指向台账规则文件，**不复制阈值**。本票**未新建 ADR、未改 ADR-0017**（B69 边界 = 写入规则；ADR 增改属独立决策）。当前判据阈值只出现在 WORKFLOW §4.4（本体）与 docs 层记录/指针中。若大脑认为需要 ADR-0017 增一条「撤账判据」交叉引用（或其 own ADR），请另行下令。

**S-105-2（呈报大脑）**：调研建议机器校验进一步通过 CI API（`gh run list`）验证「≥2 run 全绿 + 含同 SHA + 满足观察窗」。**本票未实现**——现有脚本是**离线**解析（只读 WORKFLOW.md），引入网络/鉴权会改变其性质并在沙箱/CI 下脆弱。故「同码/SHA/≥24h」作为**文档化人工核验项**，机器只卡**结构证据**（标记 + ≥2 distinct run + corroboration 标注）。若需 API 级校验，建议另立票。

**S-105-3（接续票 93 呈报，仍开放）**：票 93 §7 S4（「a queue, not a graveyard」引证归属更正：GitLab 自有域名未核验到逐字出处）与 S5（台账补 4 项建议字段：退出条件/事件到期、影响域 OS·浏览器、准入裁决日期与裁决者、NQ 标记）**不属本票**，未擅自改规则正文，维持呈报。

**S-105-4**：本票**未**把 `waiver-ledger-check` 接入 `pretest`（理由见 §1.3）。

**禁止项自查**：未宣称三门合取达成；未代签 G-B；未做 N 桶/数据完整性豁免；未 push/tag/force-push；未热修 2026.9.12；未用 run 34808080000 冒充 land 后发行 G-A。

---

## 6. 版本控制（WORKFLOW §4.2）

- 唯一来源 GitButler `but`：`but diff` 确认 → `but commit -b ticket/105-unflaky-criteria-b69 -m "…" <id…>`。
- **未 push、未开 PR、未改 tag、未 force-push**（§4.2 + handoff 禁止项）。
- **未改写他人/其它窗口的提交**；`.scratch/99-atomcode/**`（并行窗口 B63 产物）**未被纳入本票提交**。
- 本票改动面：`scripts/waiver-ledger-check.mjs` · `docs/{testing-governance,release-status,START-HERE}.md` · `test/README.md` · `.scratch/architecture-recovery/{README.md,WORKFLOW.md,decision-ledger.md,issues/105-…,reports/105-report.md}` · `.scratch/wave9-915-release-grill/issues/09-…` · `.scratch/105-atomcode/**`（证据）。**未触碰产品代码、spec、workflow、manifest**。

---

## 7. 残余风险 / 信息缺口

**残余风险**

1. **判据只约束「出账」，不约束「入账」质量**：入账仍靠人工判 F/B/N 分桶；若误把 B 当 F 入账，撤账判据无法自证。已有 `broken/flaky 分界` 规则（§4.4）与 NQ 机器名单部分兜底，但 B/F 分界本身无机器校验（需历史 run 日志，超本票离线闸能力）。
2. **`closed` 行的 corroboration 标注可被写成无意义文本**（机器只验 token 存在）。这是「结构证据 vs 语义证据」的固有上限；语义层靠发行前逐行人工比对（§4.4 既有步骤）。
3. **active 三条硬到期 2026-09-19**：到期未修 → 禁用/删除 + 回填处置；2026-09-20 起机器校验直接 exit≠0 阻断发行（§4 已实测）。

**信息缺口（来自调研，未写成事实）**：① Google 未公开「摘除 flaky 标记所需连续全绿 run 数」（3-in-a-row 是失败判定口径，不得当撤账阈值引用）；② Dropbox Athena 未公开 un-quarantine 阈值；③ Meta 未公开 quarantine 流程阈值（PFS 是度量）；④ Azure DevOps 无自动撤账判据可引；⑤ GitLab「>100 次本地运行」不可直接迁移到本仓规模；⑥ Datadog 30 天窗的 run 频率换算无现成依据（本报告以「最低观察窗」近似，属推断）；⑦ Chromium googlesource 两页仅搜索摘要核验；⑧ **「N=2 够不够」无工业直接背书**——工业下限是「多于一次采样 + 安全网」，N=2 + corroboration + 观察窗是本仓规模下的**工程推断（置信度中）**。

---

## 8. 完成定义自查（handoff）

- AC 全勾：**是**（§3，两项均 done）
- 附 CI/实测锚点：**是**（§4，含 7 例负向对照与硬到期边界实测；本票为文档/脚本票，不触发三 OS 全量 CI）
- 账本状态更新：**是**（A-059 → implemented；issue 105 + w915 issue 09 置 done；release-status §五同步）
- 报告落盘：**是**（本文件）
- 版本控制遵循 §4.2：**是**（§6）
