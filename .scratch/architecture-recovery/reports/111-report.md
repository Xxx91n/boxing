# 111 报告 — B72 innerclip setTimeout 预算（N-106-01）

> 票: **111** · covers **A-066** · 镜像: 无（本地票）· Blocked by: **None**
> 波: Wave9.20（目标发行版本 **2026.9.20**，基线 `a1acaaac` 线性追加，不热修 2026.9.15）
> 日期: 2026-09-15 · 版本控制: WORKFLOW §4.2（GitButler `but`；不 push、不开 PR、不 tag）
> 分支: `ticket/111-innerclip-settimeout-b72`

## 0. 开工复述（启动器「开工第一句」三项）

### ① 本票阻塞 / 被阻塞关系

- **Blocked by: None**（issue 与 handoff 一致：可立即开工）。
- **本票不阻塞他票**。D-006 五段主序中本票属第 ② 段（B71/72/73 测试硬化），与第 ① 段（P0 书签删除 + 静态门禁）及第 ④ 段文档票并行。
- **上游语义约束（不得违反）**：A-P01 —— 9.20 全部提交只在 `a1acaaac` 之上线性追加（第二次 root 导出即停波）；A-P03 —— G-A 须以新 tip 四 job 全绿为准，**禁止用旧 run 冒充**；G-B 只能用户声明，**禁 agent 代签**。本报告全程不宣称三门合取达成。

### ② 必读清单存在性（7 项，全部存在）

| # | 路径 | 行数 | 字节 |
|---|---|---|---|
| 1 | `.scratch/architecture-recovery/handoffs/111-innerclip-settimeout-b72-handoff.md` | 57 | 1828 |
| 2 | `.scratch/architecture-recovery/issues/111-innerclip-settimeout-b72.md` | 22 | 648 |
| 3 | `.scratch/architecture-recovery/spec.md` | 64 | 2397 |
| 4 | `.scratch/architecture-recovery/WORKFLOW.md` | 182 | 36250 |
| 5 | `docs/adr/0017-release-data-gate.md` | 88 | 10313 |
| 6 | `docs/CONTEXT.md` | 181 | 33188 |
| 7 | `.scratch/architecture-recovery/decision-ledger.md` | 162 | 25451 |

### ③ handoff 内通用调研三项（结论见 §1）

1. **atomcode 深度调研**（串行一次）→ §1.1
2. **docs/adr 与 docs/CONTEXT.md 心智模型复核** → §1.2
3. **工业级实现 / 测试策略对标** → §1.3

## 1. 通用调研摘要

### 1.1 atomcode 深度调研

- **题目（verbatim）**：浏览器扩展的端到端测试中，同一个 spec 文件里的首个用例承担浏览器冷启动开销，在宿主资源争用下被 30 秒默认超时预算判死：工业界成熟的处置方案是什么？给出推荐做法与理由
- **载体**：`ctx_batch_execute(commands:[{label:"atomcode-111", ...}], concurrency:1, timeout:600000)`；串行一次（开工前 `tasklist` 探测：无在途 atomcode 进程）。exit 0，FTS5 索引 8 sections（source=`atomcode-111`）。
- **结果**：9 个来源（8 个外部 + 1 个本地证据面），5 条结论（atomcode 自述 Confidence **高**；机制层结论均有官方文档 + ≥ 2 独立信源交叉验证）。

| # | 结论 | 对本票的落点 |
|---|---|---|
| R1 | **机制**：Playwright 官方明文 —— 测试超时（默认 30_000ms）**包含 fixture setup 与 beforeEach**；同 worker 首个用例额外承担 context 创建 + 首导航冷启动，争用下 30s 被吃光。签名特征 = `page.goto` 卡死、error-context **无页面快照**（页面从未加载） | 与票 106 §3.1 观测逐字吻合 → 证实本票问题不在断言层，而在 **setup 计入超时** 这一官方设计 |
| R2 | **反模式红线**：全局抬 `config.timeout` / `timeout: 0` / 硬等待，被 4 个独立信源一致列为反模式（Currents 2025-10、Semaphore 2024-03、TestDino 2026-09、Bondar 2026-04）；`test.slow()` 是**诊断工具**非永久修复 | 本票**不**改全局 `config.timeout`，只在两个 spec 内定向放宽 |
| R3 | **首选根因修复**：把冷启动成本从「首用例」挑到「worker 一次性 setup」（worker-scoped fixture / `beforeAll` 预热导航，hook 可单独设预算）；官方支持「保持整体超时小、给慢 fixture 单独预算」 | 本票**未做**（跨票重构 + 并行窗口新失败面）→ 具名残余 **N-111-02**，建议后续立票 |
| R4 | **定向放宽是官方背书第二选择**：官方三粒度 = `test.slow()`（×3）/ `test.setTimeout(120_000)`（单测精确预算）/ `beforeEach` 内 `testInfo.setTimeout`；qaskills（2026-08）要求**每个放宽必须留书面理由**，否则 annotation 会变成产品回归的藏身处 | **本票采用**：两 spec 各加 `test.setTimeout(120_000)` + 9/3 行书面理由注释（含证据链） |
| R5 | **兜底与判据**：CI `retries` 用于吸收基础设施抖动并区分「持续 bug」与「flaky」；但全局 retries 不能替代根因修复；`trace: on-first-retry` 下冷启动型（首动作卡死 + 无快照）与断言型（页面已加载、定位错）肉眼可分 | 本仓 `retries: CI?2:0` / `trace: on-first-retry` / worker 上限（票 20）**已配**，本票不动 |

- **完整来源清单**：① Playwright 官方 Timeouts 文档（常青）② Currents「Debugging Playwright Timeouts」2025-10-23 ③ QASkills「Timeout Budgets」2026-08-07 ④ Bondar Academy「Flaky Tests 3 Causes」2026-04-20 ⑤ Semaphore「Avoid Flaky Tests」2024-03-13 ⑥ TestDino「Playwright Timeout」2026-09-02 ⑦ Medium/adequatica「Timeouts Against Flaky Tests」2024-09-04 ⑧ r/Playwright「BeforeEach timeout 30s by default」2024-12（摘要级旁证）⑨ 本地证据：票 01/13/20/106（`.scratch/architecture-recovery`）

### 1.2 docs/adr 与 docs/CONTEXT.md 心智模型复核

- **ADR-0017（含 2026-09-13 修订）**：可发行 = G-A ∧ G-B ∧ G-C；残红分桶 **N / B / F**。本票的 timeout 预算**不是豁免**（它不隐藏残红，只是把装置层 setup 预算调到与冷启动成本匹配），不入台账 → **不触碰门禁面**，无冲突。
- **WORKFLOW §4.4 台账规则（含票 105 撤账判据）**：「豁免文件只许缩小」（棘轮）；N 桶永不入账。本票**零台账改动**，`waiver-ledger-check` exit 0 → 与棘轮一致。
- **docs/CONTEXT.md**（`release gate` / `release status page` 两条）：三门齐备前禁止 tag 与任何可发行宣称 —— 本报告只写「不可发行 / 未定谳」。
- **docs/testing-governance.md**（票 85 / 99 / 105）：已含 Quarantined tests、**Host-environment incident register**、**Local-only flake observations** 三节 —— 本票结案落在**同一治理面**（新增第三结案路径），属既有心智模型的自然延伸，非新造机制。
- 结论：**无 silent 改向、无 revised**。

### 1.3 工业对标（实现 / 测试策略）

- **Playwright 车道**：本仓 `test/playwright.config.ts` = CI `retries: 2` / `workers: 2`，本地 `retries: 0` / `workers: 4`（票 20 明文策略）。调研 R5 确认这三项均属行业实践，本票**不动配置**。
- **判定面**：工业做法是「拉 CI 历史 run」而非「本地反复复现」（票 106 R1）；本票沿用，本地双车道复跑仅作**零回归 + 余量量化**证据（§3）。
- **结案面**：GitLab / minware / Mozilla 三源一致要求「owner + 到期 + 证据矩阵」（票 106 R3/R4）；本票把观察行从 `active` 转为 `closed` 并保留行体，使结案证据留在治理记录内。

## 2. 实施

| 文件 | 改动 | 行数变化 |
|---|---|---|
| `test/tests/boxing-innerclip.spec.ts` | `test.describe` 块首插入 9 行书面理由注释 + `test.setTimeout(120_000)` | 189 → 199（+10） |
| `test/tests/boxing-innerclip-pan.spec.ts` | 同上（精简注释 3 行 + `test.setTimeout(120_000)`） | 113 → 117（+4） |

- **形态依据**：票 13 先例（`boxing-i18n-module.spec.ts` 对**同一签名**用 `test.setTimeout(120_000)`）+ 调研 R4 官方粒度。全仓已有 5+ 处 `120_000` 同形用法。
- **零断言改动**：两 spec 的几何断言与 `expect.poll` 预算**逐字未动**；`git diff` 仅新增行（+14 / -0）。
- **不扩大豁免面**：未改 `WORKFLOW.md` §4.4 台账；未新增 `@quarantine` 标签；`waiver-ledger-check` exit 0（4 行，1 closed，never-quarantine 零命中）。

## 3. 验证锚点（实测）

| 场景 | 命令要点 | 结果 |
|---|---|---|
| firefox 车道（CI 口径） | `--project=firefox-extension --workers=2 --reporter=line` | **4 passed (11.3s)** |
| chromium 车道 | `--project=chromium-extension --workers=2 --reporter=line` | **4 passed (6.9s)** |
| 争用压力（firefox） | `--project=firefox-extension --workers=4 --reporter=list`（4 并发冷启动） | **4 passed (20.5s)**；单测 16.4s / 15.7s / 13.0s / 12.0s |

**诚实披露（未复现 30s 超时）**：本机当前负载低于票 106 观测时，30s 超时**未复现**。上表的价值是：

1. **零回归** —— 断言逐字未动，双车道 4/4 绿；
2. **余量量化** —— 空闲态下首用例 setup（冷启动 + 3 次导航）已吃 **12.0–16.4s**，相对 30s 默认仅约 **1.8–2.5×** 余量，正是票 106 观测到「争用即越界」的机制来源；120s 预算把余量提到约 **7–10×**。

**效力论证方式（不越界）**：按票 106 R1（CI 为唯一裁决面）+ 本票调研 R4，效力 = 「官方机制（setup 计入测试超时）× 先例（票 13 同签名同预算）× 余量量化」，**不是**「本地复现后转绿」。

**门禁核验**：`npm run pretest` 6 门中 **5 绿** —— import-graph（15 模块 / 48 边 / 0 违规）、migration-golden（28/28）、css-balance（OK）、calver-guard（8 面一致）、onboarding-guard（46 specs 零反模式）；`waiver-ledger-check.mjs` **exit 0**。第 6 门 `locale-readme-guard` **exit 1 = 既有红**（非本票引入，见 §7 N-111-01）。

## 4. AC 对照（`issues/111-innerclip-settimeout-b72.md`）

| AC | 结果 | 证据 |
|---|---|---|
| 为相关 spec 设合理 `test.setTimeout` 预算或等价稳定性措施 | **达成** | 两 spec `describe` 首各加 `test.setTimeout(120_000)` + 书面理由注释；§2 / §3 |
| 不扩大豁免面 | **达成** | `WORKFLOW.md` §4.4 台账**零改动**；`waiver-ledger-check` exit 0；未新增 quarantine 标签 |
| testing-governance 观察行可结案更新 | **达成** | `docs/testing-governance.md` 行 → `Status = **closed 2026-09-15**`；新增「第三结案路径（预防性修复）」规则 + 结案证据段 |

## 5. 结案登记（书面结案的落点）

| 载体 | 内容 |
|---|---|
| `.scratch/architecture-recovery/reports/111-report.md` | 本文件：调研摘要 + 实施 + 验证锚点 + AC 对照 + 残余 |
| `test/tests/boxing-innerclip.spec.ts` · `test/tests/boxing-innerclip-pan.spec.ts` | 修复本体（预算 + 书面理由） |
| `docs/testing-governance.md` | 观察行 → `closed 2026-09-15`；规则新增第三结案路径 |
| `.scratch/architecture-recovery/decision-ledger.md` | A-066 状态 → `implemented`（附证据） |
| `.scratch/architecture-recovery/issues/111-innerclip-settimeout-b72.md` | AC 三项勾选 + Status 更新 |
| `.scratch/architecture-recovery/README.md` | 波次表 W1/111 行状态更新 |

**为何不入 G-A 豁免台账**：台账收「main 车道残红」；本面在 CI 车道**从未成为残红**（唯一出现是 B 型全局失败 run，已修绿），且本票改动是**消除装置层预算缺口**而非豁免失败 —— 写入台账会**扩大**豁免面，与票 105「棘轮：豁免文件只许缩小」相悖。故仍落**测试治理面**，**不触碰门禁面**。

## 6. 版本控制（WORKFLOW §4.2）

- 路径：`but status` 取 change id → `but commit -b ticket/111-innerclip-settimeout-b72 -m "..." nt sq qls zk tw to zn`。
- **结果**：分支 `ticket/111-innerclip-settimeout-b72` 上两个提交（详见 §6.2）：`szy`（`694195ac`）7 文件 + `uqq`（`c8e7e9d4`）ledger 隔离提交。
- **并行窗口隔离**：提交时 `but status` 在途面含 107 / 112 / 113 / 115 / 116 各窗口文件（`ntp/*.js`、`docs/CONTEXT.md`、`CHANGELOG.md`、`.scratch/*-atomcode/*`、`reports/107|112-report.md` 等）→ **逐文件比对 hunk 归属后只提交本票 7 项**（`git diff HEAD -- <file>` 逐文件确认每文件仅含本票 hunk）。
- 未 push / 未开 PR / 未 tag / 未改 root（A-P01）。

### 6.1 版本控制过程事故（如实披露 · 必读）

三处偏离与处置，**全部已恢复，零内容丢失**：

1. **首次提交失败（预期内）**：`but commit -b ticket/111-...` 报 `Cannot commit: 3 changes could not be applied ... depends on commit rpk` —— 本票 3 个文件（README / decision-ledger / issues-111）的改动**构建在 rpk 提交内容之上**，而 `-b` 新建分支默认**独立**（不 stack）。属 WORKFLOW §6 票 10 已备案形态。
2. **建栈分支时误用短 ID**：`but branch new <name> --above g0` 报 `Reference name cannot end with a slash` —— GitButler **0.22.3 下 `--above <CLI 短 ID>` 不可用**；须用**完整分支名**或 **commit 锚点**。
3. **探针分支吞掉波分支（严重）**：为验证锚点形态执行 `but branch new zzprobe111 --above trw`，**结果把原波分支（元数据名 `grill/w920-docs`，头 `trw`）整栈 4 个提交（rrm / mvs / rpk / trw）归入新分支**；随后 `but branch delete zzprobe111` 触发工作区 checkout，**未提交改动被写成冲突标记**（`README.md` 1/43/44 行、`decision-ledger.md` 141/164/165 行），且波分支被移出工作区。
   - **恢复**：`but undo` → 工作区与 4 个提交**全部复原**（提交对象从未丢失；`git cat-file -t` 对 3fed0742 / 1a61730a / b305c3f9 / 56529571 / aa2a625b 均返回 `commit`）。
   - **波分支改名**：原元数据名 `grill/w920-docs` 被孤立条目永久占用（`but branch delete` 报 `Could not find branch`、`but clean` 报 `No empty branches found`、`but reword` 报 `already exists` 三者互相矛盾），**无法还原原名**；已改名为中性描述名 **`w920-tickets`**（仍持有原 4 个提交，内容零改动）。**此改名需大脑窗口知悉**。
   - **最终栈结构**：`w920-tickets`（rrm / mvs / rpk / trw）← `ticket/112-contrast-guard-pretest`（uqz）← **`ticket/111-innerclip-settimeout-b72`（szy，本票）**。
   - **教训（建议写入 WORKFLOW §6）**：① GitButler 0.22.3 下**禁止用 `but branch delete` 删除已应用分支**（会把未提交改动写成冲突标记并重排栈）；② `but branch new --above` **只用完整分支名**，**禁用** CLI 短 ID，**禁用** commit 锚点去“验证”（会吞并既有提交）；③ 探针应在**独立临时 repo** 验证，不在活动工作区建探针。
### 6.2 提交与 amend 的两次修正（如实披露）

1. **amend 丢改动**：为把报告更新（§6.1）折进同一提交，执行 `but amend -t ticket/111-innerclip-settimeout-b72 zk` → 报告更新已进提交，但**同一文件的 ledger 改动被重新置为未提交**（A-066 不在提交内）。教训：本版本下 **amend 后必须做字节级比对**（`git show <sha>:<path>` vs 工作树），不能只信 “Amended szy” 回显。
2. **同文件跨窗口共提交（工具粒度限制）**：GitButler 的 change id 是**整文件粒度**；提交时 `decision-ledger.md` 的单一 change id 同时含**本票 A-066** 与**窗口 112 的 A-067** 两行 → 首次提交把窗口 112 的 A-067 行一并带入。非人为越界（无法用整文件 id 切分，除非用隔离法）；**内容正确、零损失**，但**归属落在票 111 的提交内**，特此披露。
3. **修正**：按「隔离法」暂摘窗口 114 的 A-069 行 → 单独提交本票 A-066（commit `uqq` / `c8e7e9d4`）→ 原样还回 A-069 行（字节级一致，仍留在未提交区归窗口 114）。

**最终提交**：

| commit | change id | 内容 |
|---|---|---|
| `694195ac` | `szy` | 7 文件：README 行 111 · decision-ledger（本票 A-066 + 窗口 112 的 A-067 行）· issues/111 · reports/111-report.md（含 §6.1）· docs/testing-governance.md · 两个 spec |
| `c8e7e9d4` | `uqq` | decision-ledger：A-066 → implemented（隔离提交） |

栈结构：`w920-tickets`（rrm/mvs/rpk/trw）← `ticket/112-contrast-guard-pretest`（uqz）← **`ticket/111-innerclip-settimeout-b72`（szy + uqq，本票）**。
## 7. 残余与风险

- **N-111-01（既有红，非本票面）**：`npm run pretest` 第 6 门 `locale-readme-guard` exit 1 —— `README.md` 的 `store_published-v2026.9.15` != `docs/release-status.md` 的「上一已发布版本（可回滚目标）= 2026.9.12」。**定性：门禁语义缺陷**（guard 把「已发布版本」与「可回滚目标版本」当同一语义比较，`publishedFromStatus()` 只抓「上一已发布版本」行）。由 `a1acaaac`（README 徽章随 2026.9.15 发布前移）引入；两个输入文件在工作树与提交中**一致**（`git status --short -- README.md docs/release-status.md` 为空）→ **与任何未提交改动无关**。**影响**：CI 的 `Run tests: npm test` 会先跑 pretest → 当前 tip 的 pretest 面为红（仅记事实，**不宣称 G-A 状态**）。归属：A-068（票 113 release-status 单状态块）/ A-053（票 99 的 guard 本体）。**本票不动**（跨票面，避免与 113/116 窗口冲突）。
- **N-111-02（调研建议，建议立票）**：工业首选根因修复 = **worker-scoped 预热 fixture**（调研 R3），可把冷启动从「首用例预算」挑到「每 worker 一次性 setup」。本票**未做**：对全仓 46 spec 改共享夹具属跨票重构，且在并行窗口波内会新增失败面。建议 9.20 后单独立票。
- **N-111-03（仓库既有）**：`git diff --check` 在 `.scratch/architecture-recovery/decision-ledger.md:162`（EOF 空行）与 `spec.md:3-4`（行尾空格）报既有告警，**非本票引入**，未改（他人窗口面）。
- **N-111-04（本票引入的过程副作用，已处置）**：波分支名 `grill/w920-docs` → **`w920-tickets`**（原名被孤立元数据占用，`branch delete`/`clean`/`reword` 三路均无法释放，**无法还原**）；提交对象与提交内容**零损失**，仅分支名变化。建议大脑窗口在波收口时确认该名，或在干净工作区重建原名。详见 §6.1。
- **风险（预算边界）**：若未来某次真回归导致断言层死循环，失败反馈会晚 4 倍；缓解 = 断言自带 `expect.poll` 预算（本票未动）+ CI `retries: 2` + `trace: on-first-retry` 保留。

---

**结论**：本票 delta（两个 innerclip spec 的超时预算 + 治理面结案）**已全部落地**；三门合取状态**未变**（不宣称可发行）。
