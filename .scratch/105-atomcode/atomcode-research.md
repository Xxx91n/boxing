[dev] auto-update disabled
[warning] 正在以管理员权限运行 — 模型可能可以访问系统文件。
searches: 11（web_search×6、tavily_search×1、anysearch batch×4）| angles: Official / Criticism / Currency / Community | full reads: 11（Datadog、GitLab handbook+docs、Dropbox、Google Testing Blog、Chromium tree-sheriffs、Azure DevOps、rushstack#4465、Mill、Tenki、Meta PFS）| gaps: Google/Meta/Dropbox 均未公开「撤账连续绿阈值」、trunk.io 转述未整页核验（见文末缺口清单）

---

# 调研报告：flaky 豁免「撤账/复权」判据的工业成熟方案（票 105 / B69 / A-059）

## 执行摘要（Tl;dr）

工业界没有统一的「连续 N 次全绿」魔法数字，但收敛在一个清晰的结构上：**撤账判据 = 「连续多轮全绿」的事件闸 + 「时间窗/复查窗」的时间闸 + 「复发即重进」的安全网**，且各家都明确否定了「单次零出现即撤账」（Datadog 用 30 天窗，GitLab 用 >100 次本地运行 + 1 周观察，社区实践用 3~10+ 次连续通过）。**broken 不得以「连续绿」出账**（Datadog 明确拒绝把 100% 失败的测试自动转 Fixed），**N 家族（数据完整性类）在工业映射中属于「必须修绿或删除」的门禁测试，不存在「撤账」这个出口**。本仓已定的「连续 2 个全量 main run」与工业下限一致，但应以 **corroboration（同码重跑）作为其中一环 + 最低观察窗 + 机器校验**来补齐 premature-dequarantine 防线。Confidence：**高**（核心机制均有 2+ 独立信源交叉验证）；**中**（「N=2 是否足够」的推荐值是推断，工业下限依据见 Q4）。

---

## 工业机制对比矩阵

| 项 | 进入/维持判据 | 撤账/复权判据 | 时间闸 | 复发安全网 | 备注 |
|---|---|---|---|---|---|
| **Datadog** | 检出 flaky → Quarantined | 30 天无 flake 自动转 Fixed（默认行为，不可自定义）；或 attempt-to-fix 流程在修复 commit 上重试、合并后自动 Fixed | 30 天窗；broken 校验：近 7 天 100% 失败率则**拒绝**自动转 Fixed | Disabled 态永不自动转 Fixed（无数据即无信号） | 撤账自动化最强 |
| **GitLab** | 首次失败即隔离；fast(3天)→long-term(3个月) | 出隔离前提：**>100 次本地运行一致通过 + 根因已修**；出隔离后**监控 1 周**，承诺复发立即重隔离 | fast 3 天 / 长期 3 个月硬顶 → 自动删除 | 1 周观察期 + 立即重隔离承诺 | 唯一公开量化「>100 次」的厂商 |
| **Google** | flaky 标记：连续失败 3 次才算失败 | **无公开撤账阈值**；缓解手段为重跑失败用例 | — | — | 3-in-a-row 是「失败判定」口径，非撤账口径 |
| **Chromium** | FLAKY_ 前缀已废弃（2012），builder 自动重试 3 次 | **无 CI 撤账阈值**；修后本地 `--gtest_repeat=100`/`--repeat-each=N` 复现验证 | — | — | 前缀机制整体退役，改用自动重试 |
| **Azure DevOps** | 同一 pipeline 内重跑通过 → 标记 flaky | **无自动撤账**：标记后一直保持 flaky 直到人工 unmark | — | — | 唯一明确「纯手动撤账」的厂商 |
| **Dropbox Athena** | 同 commit 重跑 10 次结果不一致 → flake → 自动隔离 | 文章未公开 un-quarantine 阈值 | — | breakage（bisect + 10 次重跑确认）走修复/回滚，不走隔离 | 同码重跑是 flake 判定的原语 |
| **Meta** | PFS 概率化 flakiness 分数持续监控 | 未公开 quarantine 流程阈值（PFS 是度量不是流程） | — | — | 度量层参考 |
| **社区实践**（rushstack #4465 / Mill / Tenki） | 同码 pass+fail 即证明 flaky | 「连续多次成功才可出隔离」（rushstack，N 未定）；Tenki 建议 **10+ 连续通过**自动出隔离 | Tenki：14/30/45 天升级/删除阶梯 | Mill：出隔离后复发会被自动隔离系统「再抓回来」，故判据不必完美 | 三者独立收敛于「连续绿 + 安全网」 |

---

## 第 1 问：撤销/复权判据 —— 工业口径与阈值

**推荐**：采用「**事件闸（连续 N 全绿）+ 时间闸（最低观察窗 / 硬到期）**」双闸结构，N 取 2 为下限、配 corroboration 与观察窗（详见第 4、6 问）。

工业口径逐家列示：

- **Datadog（时间窗派）**：「If a flaky test no longer flakes for **30 days**, it is automatically moved to the Fixed state. This automation is default behavior and can't be customized.」撤账不要求人为确认连续 N 次，而以**时间窗内零复发**为判据；另有 remediation 派：attempt-to-fix 在修复 commit 上重试指定次数、合并进默认分支后自动 Fixed。——来源：Flaky Tests Management，Datadog Docs（现行文档，2025 年仍在更新），https://docs.datadoghq.com/tests/flaky_management/
- **GitLab（运行次数派，最保守）**：出隔离前提是「The test **passes consistently (more than 100 local runs)**, and the root cause is identified and fixed」，且出隔离后「have a plan to **monitor the test for 1 week** after dequarantine, and commit to **re-quarantine immediately** if failures occur」。——来源：Test Quarantine Process，The GitLab Handbook（2026-08 更新），https://handbook.gitlab.com/handbook/engineering/testing/quarantine-process/
- **Google（失败判定口径，非撤账口径）**：「a way to denote a test as flaky - causing it to report a failure only if it **fails 3 times in a row**」；注意这是「豁免期内何时算真失败」的口径，Google **没有公开**「标记为 flaky 后需连续多少次绿才能摘标记」的官方阈值。——来源：Flaky Tests at Google and How We Mitigate Them，Google Testing Blog，2016-05-27，https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html
- **Chromium（前缀机制已退役）**：「FAILS_ and FLAKY_ are no longer used…… the builder will **automatically retry any tests 3** times」；修复验证走本地复现：`--gtest_repeat=100`（或 `--gtest_repeat=20 --gtest_also_run_disabled_tests`）、web tests 用 `--repeat-each=N`/`--iterations=N`。即 Chromium 的口径是「**同码高强度重复运行验证**」而非「等 N 个 CI run」。——来源：Handling a failing test，Chromium Tree Sheriffs docs（现行），https://www.chromium.org/developers/tree-sheriffs/handling-a-failing-test/ ；Addressing Flaky Web Tests，chromium.googlesource.com（搜索摘要核验，未整页抓取，标注为部分核验）
- **Azure DevOps（无自动撤账）**：「After a test is marked as flaky, Azure DevOps will continue to treat it as such **until it is manually unmarked**」；unmark 是人工操作，无自动判据。——来源：Manage flaky tests，Microsoft Learn / Azure Pipelines（2025-05-28 更新），https://learn.microsoft.com/en-us/azure/devops/pipelines/test/flaky-test-management?view=azure-devops
- **Dropbox Athena**：flake 判定原语是「**rerun it on a commit where it has passed before**」「retrying the same test **up to ten times**, and if the result isn't consistent across the runs, we're confident that the test is exhibiting a flake. We settled on **ten retries** after some experimentation」。文章未公开 un-quarantine 自动化阈值（缺口）。——来源：Athena: Our automated build health management system，Dropbox Tech Blog，2019-05-22，https://dropbox.tech/infrastructure/athena-our-automated-build-health-management-system
- **Meta**：PFS（probabilistic flakiness score）量化每个测试的 flaky 程度并持续监控其可靠性随时间的变化；未公开 quarantine 退出阈值。——来源：Probabilistic flakiness: How do you test your tests?，Meta Engineering Blog，2020-12-10，https://engineering.fb.com/2020/12/10/developer-tools/probabilistic-flakiness/
- **社区实践（阈值样本）**：rushstack 设计讨论：「For a unit test in quarantine to "escape", it must **succeed multiple times in a row**. You could do a **periodic process on a main branch** to achieve this.」（microsoft/rushstack#4465，2023-12-31，https://github.com/microsoft/rushstack/issues/4465 ）；Tenki 工程指南：「If a quarantined test **passes consistently for 10+ consecutive quarantine runs**, automatically remove it from quarantine」（Flaky Test Quarantine in GitHub Actions，Tenki Blog，2026-05-22，https://tenki.cloud/blog/flaky-test-quarantine-github-actions ）。

**可见的谱系**：厂商 SaaS 按时间窗（Datadog 30 天）、大型 monorepo 按运行次数（GitLab >100、Tenki 10+）、小团队实践按「连续若干 run」（rushstack 未定量）。**没有任何一家使用「单次全绿」作为撤账判据**。

---

## 第 2 问：「单次 run 零出现」是否足以撤账？

**推荐**：**不足以**。本仓既有事故结论与工业实践完全一致，可直接引用以下三重依据固化「≥2 次连续全绿」门槛。

理由与证据：

1. **flaky 的定义本身使单次绿无证明力**。Google 对 flaky 的定义是「a test that exhibits both a passing and a failing result **with the same code**」（同上 Google Testing Blog，2016）；Dropbox 的判定方法正是「**在它曾经通过的 commit 上重跑**，若跨多次运行从 pass 翻到 fail 即隔离」（Athena，2019）。既然 flake 是同码下的非确定性事件，一次绿 run 只是采样一次，对「已修绿」没有任何统计效力——这正是本仓「撤账过早 → 下次 run 复发」事故的机理。
2. **工业撤账判据全部是多采样结构**：Datadog 30 天窗内零复发（时间维度多次采样）、GitLab >100 次一致通过（次数维度多次采样）、Tenki 10+ 连续、rushstack「multiple times in a row」、Mill 的经验观察「If a test **passes, fails, then passes on three consecutive commit test runs** post-merge, it is likely to be flaky」（How To Manage Flaky Tests in your CI Workflows，Mill Build Engineering Blog，Li Haoyi，2025-01-01，https://mill-build.org/blog/4-flaky-tests.html ）——Mill 作者同时是 Dropbox/Databricks flaky 管理系统的早期建设者。
3. **工业以「安全网」而非「完美判据」防 premature dequarantine**。Mill 明确指出撤账判据不需要完美：「If you try to fix a test, take it out of quarantine, and it turns out to be still flaky, **the auto-quarantine system will just put it back**」；GitLab 要求出隔离后 1 周观察 + 复发立即重隔离。对本仓的含义：撤账行应保留「复发即重新入账」条款，使 N=2 的判定误差可被安全网兜住。

---

## 第 3 问：撤账判据与 N/B/F 分桶的耦合

**推荐**：F 可撤账（连续绿判据）；**B 不得以连续绿撤账**，只能修绿或退役（删除/改写用例）；**N 不存在「撤账」出口**，只允许修绿——若 N 家族用例在账上，本身就是分类错误，应回改分类而非走撤账流程。

工业依据：

- **B（broken）**：Datadog 在自动化撤账前专门做了 broken 防线：「Before Datadog automatically moves a flaky test to Fixed, it checks whether the test may be **broken** rather than fixed. A broken test is a flaky test whose recent executions all failed, resulting in a **100% failure rate over the last 7 days**. **Datadog does not automatically mark these tests as fixed**, which helps prevent quarantined tests that still fail from breaking CI again」（Datadog Docs，同上）。即：**确定性失败禁止自动复权**，必须走修复确认。Dropbox 同理：breakage 检出后走「通知作者 revert / 修复」而非隔离轮转（Athena，2019）；Mill 观察到 breakage 表现为「连续多次失败直到被修复或 revert」（Mill Blog，2025）。GitLab 虽有 `:broken` 隔离类型，但其生命周期仍然是 3 个月内 fix / remove / 降级三选一，**不存在「连续绿自动出账」分支**（GitLab Handbook，同上）。与本仓规则「broken 不得豁免」完全同构：B 的出口只有修绿（此时失败签名消失、按流程出账并注明「修绿」）或退役。
- **N（never-quarantine：数据完整性/迁移往返/回滚演练）**：工业上没有完全同构的桶，但有两个可映射的锚点：① **Datadog 的 Disabled 例外**——「Tests in the Disabled state are excluded from this automation and are **never automatically moved to Fixed**. Because disabled tests are skipped in CI, Datadog has no signal about whether they are still flaky」：对「不参与常规门禁信号」的用例，Datadog 拒绝自动复权，因为**没有运行信号就没有撤账证据**；② Dropbox/GitLab 把不可妥协的正确性失败（bisect 确认的 breakage）一律导向修复/回滚而非豁免。结论：N 家族是**发布正确性的承重墙**，工业惯例是不给它们任何「绕过门禁」的状态出口——本仓「永不出账、只允许修绿」与 Datadog Disabled 例外、Dropbox breakage 处理在精神上一致，可放心保留。

---

## 第 4 问：台账到期机制 —— 事件到期 + 时间到期双闸

**推荐**：保留本仓「硬到期不得续期」为**时间闸**（这与 GitLab 的 3 个月硬顶自动删除、Tenki 的 14/30/45 天升级阶梯同构），将「连续绿次数」作为**事件闸**提前出账通道；事件阈值 **N=2 维持不变**（与既有修绿票验收标准一致，且为工业下限），但加两条约束防形同虚设。

推荐值论证：

- **为什么 N=2 可接受（下限）**：本仓已用 corroboration run 把「单 run」升级为「连续 2 个全量 main run」，这跨过了「单次零出现」的证明力红线；rushstack 的「multiple times in a row」、Mill 的 3 连观测都表明小步多采样即可起步。N=2 的实际效力取决于**两次 run 的独立性**（见第 6 问）。
- **为什么不能再低**：第 2 问已证单次绿无证明力，N=1 不可行。
- **为什么不必追高（如 Tenki 的 10+ / GitLab 的 >100）**：GitLab 的 >100 是在其每日数千 pipeline 的 monorepo 规模下取的；Tenki 的 10+ 针对的是持续运行的 quarantine lane。本仓是 35 个 spec 的扩展 e2e 套件，main 全量 run 频率有限，N=10 意味着数周等待，会激励「拖着不撤」的台账腐化（Tenki 文称未维护的 quarantine 为「quarantine rot」，同构风险）。**用 corroboration + 观察窗补足 N=2 的统计弱点的性价比较高**。
- **双闸的具体形状**：事件闸 = 连续 2 个全量 main run 全绿且无同签名复发（其中 ≥1 次为 corroboration，见第 6 问）；时间闸 = 既有的硬到期（到期未修 → 禁用/删除 + 回填处置），可选加一个**最低观察窗**（如出账证据的两次 run 需 ≥24 小时间隔或分属不同触发源），防止两次背靠背 run 被 同一环境毛刺同时「洗绿」。Datadog 的 30 天窗对本仓 run 频率而言过长，不建议照搬。

---

## 第 5 问：判据应写在哪个文档层级

**推荐**：三层分工——**ADR 记「为什么」，台账规则文件记「判据本体（机器可读）」，校验脚本做「执行点」**；ADR 与校验脚本都**引用**台账文件，不复制阈值。

- **分层依据（工业同构）**：GitLab 明确做了这个拆分——handbook 承载流程（when to quarantine, ownership, timelines），docs 页承载技术实现（quarantine metadata 语法），两页互相链接而非互抄内容（GitLab Handbook「For process information… see the Test Quarantine Process handbook page」；GitLab Docs「For process information… see the handbook」，两页均已核验）。Datadog 把状态机定义放在单一 docs 页，自动化与 troubleshooting 章节引用它。
- **落点建议**：
  1. **台账规则本体**（如 waiver ledger 的 README / schema 文件）：承载可执行判据——「F 桶撤账：连续 ≥2 全量 main run 全绿 + ≥1 corroboration + 最低观察窗；B/N 桶无撤账出口」+ 撤账行必填字段（见下节）。这是 **single source of truth**。
  2. **门禁 ADR**：只记录决策与理由（为何 N=2、为何 B/N 不可撤、为何硬到期不可续期），并用相对链接指向台账规则文件，**不重复写阈值数字**——阈值只出现一次，杜绝语义漂移。新增 ADR 须按本仓模板含 `## Consequences` 与复审日期。
  3. **机器校验脚本**：发行前既有的逐行比对脚本扩展撤账校验（见下节）。**脚本是把「文档不漂移」变成「文档不敢漂移」的执行点**——Dropbox 的经验是「Automation helps reduce bikeshedding：自动化能避免关于门槛的无尽争论」（Athena，2019）。

---

## 第 6 问：撤账是否必须要求 corroboration（同码重跑）

**推荐**：**必须**。撤账证据的 ≥2 次全绿中，**至少 1 次应为同码 corroboration run**；最小 corroboration 次数 = 1（合计 2 次全绿）。

- **corroboration 的工业等价物**：「对同一 commit 重跑」正是工业界**判定 flake 的第一原语**，同构证据：Dropbox「To determine whether a test is flaky, we **rerun it on a commit where it has passed before**」（Athena，2019）；rushstack「if you manage to get a specific unit test to both pass and fail **on the same compiled code**, you've proven it is flaky」（#4465）；Tenki 把「Variance across identical commits」列为三大自动检出信号之一：「The same test fails on commit abc123 in one workflow run but passes in another…… that's a flake」（Tenki，2026）；Airtable 在决定隔离前用同码压力测试（stress tests）快速确认而非等待周期性全量构建（How Airtable manages flaky tests in a large-scale monorepo，Airtable Engineering / Medium，2022，仅搜索摘要核验，标注为部分核验）。既然「同码多采样」是入账的证据标准，**出账用同一原语在方法论上是对称的**。
- **「同码重跑」vs「等新的 main run」的语义差异**：
  - **同码 corroboration run**：控制了代码变量，纯测非确定性——若同码下连续 2 次全绿，直接证明「签名未在同码上复现」，证据干净；缺点是不能反映代码库继续演化后用例是否仍然健康。
  - **新的 main run**：代码在变，绿了也分不清是「修好了」还是「代码恰好绕开了触发条件」；但它是 G-A 门禁实际面对的环境，且能捕捉环境性漂移。
  - **两者互补**：corroboration 给出「同码已稳定」的干净证据，后续 main run 给出「演化环境无复发」的现实证据——这正是 Datadog 双通道的结构（remediation flow 在修复 commit 上重试 = 同码验证；30 天窗在默认分支上观察 = 演化验证）。
- **「等新的 main run」单独作为撤账证据的风险**：若两个 main run 相邻且环境无变化，对**环境性** flake（本仓允许入账的类型之一）的区分度低——一次环境毛刺消失即可连续两次洗绿；corroboration run（尤其与首次全绿隔开时间/触发源）能压低这种假阳性。因此 corroboration 应为**必要条件**而非可选加分项。

---

## 对本仓库的具体建议

**① 「≥N 连续 main 全绿」的 N 推荐值：N=2，维持既有约定，但加两条可执行约束**：
- 两次全绿中 **≥1 次为 corroboration（同 commit 重跑的全量 CI）**，另 1 次为后续 main run；
- 两次 run **不得在同一小时窗内背靠背**（最低观察窗建议 ≥24h，或分属不同触发源 push/schedule），防同一环境毛刺同时洗绿两条证据；
- 撤账行保留「**复发即重新入账**」条款（同签名在撤账后任意 main run 复现 → 立即恢复豁免并计入一次撤账失败），对应 GitLab 的 1 周观察承诺与 Mill 的自动回抓安全网。

**② 是否机器校验：是，扩展现有发行前校验脚本**。最小可校验字段：
- 台账行：`waiver_id | 用例名 | 失败签名 | 归属票 | 基线 run URL | 到期 | 桶(F/B/N) | 状态(active/delisted/disabled/removed)`
- 撤账行追加：`撤账日期 | 撤账证据 run URLs[]（≥2，须含 commit SHA）| corroboration 标记 | 复发处置承诺`
- 脚本校验逻辑：F 桶撤账行 → 通过 CI API（`gh run list` 对基线 SHA）验证 ≥2 个全量 main run 全绿、无同签名失败、其中 ≥1 run 与基线同 SHA、两次 run 满足最低观察窗；B/N 桶出现撤账行 → 直接判 FAIL；到期未处置 → 判 FAIL（既有逻辑）。这与本仓「发行前逐行比对失败签名与最新基线 run」的既有脚本天然衔接。

**③ 撤账行最小证据字段**：`用例名 | 失败签名 | 撤账日期 | 证据 run URL ×2（含 SHA 与结论全绿）| corroboration run URL | 复发再入账承诺（默认条款引用）| 复核人/票号`。字段设计对标 Tenki 的 registry（`consecutivePasses / quarantinedAt / trackingIssue / slaDeadline`）与本仓既有 5 字段格式的超集，不引入新概念。

---

## 完整来源清单

| # | 标题 | 发布方 | 年份 | URL | 抓取角度 | 贡献 |
|---|---|---|---|---|---|---|
| 1 | Flaky Tests Management | Datadog Docs | 现行（2025 更新） | https://docs.datadoghq.com/tests/flaky_management/ | Official | 30 天自动转 Fixed、broken(7天100%失败)拒转、Disabled 例外、remediation flow |
| 2 | Test Quarantine Process | GitLab Handbook | 2026-08 更新 | https://handbook.gitlab.com/handbook/engineering/testing/quarantine-process/ | Official | 出隔离 >100 次 + 根因已修 + 1 周观察、3 天/3 个月时间闸、自动删除 |
| 3 | Quarantining tests | GitLab Docs | 现行 | https://docs.gitlab.com/development/testing_guide/quarantining_tests/ | Official | 隔离类型（flaky/broken/…）、修/降级/删除三出口 |
| 4 | Athena: Our automated build health management system | Dropbox Tech Blog（Utsav Shah） | 2019-05-22 | https://dropbox.tech/infrastructure/athena-our-automated-build-health-management-system | Official | 同码重跑 10 次 flake 判定、breakage 走 revert/修复、自动化减少争论 |
| 5 | Flaky Tests at Google and How We Mitigate Them | Google Testing Blog（John Micco） | 2016-05-27 | https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html | Official | flaky 定义（同码 pass+fail）、3-in-a-row 失败口径、重跑缓解 |
| 6 | Handling a failing test | Chromium Tree Sheriffs | 现行 | https://www.chromium.org/developers/tree-sheriffs/handling-a-failing-test/ | Official | FLAKY_/FAILS_ 前缀废弃（2012）、builder 自动重试 3 次 |
| 7 | Manage flaky tests | Microsoft Learn / Azure DevOps | 2025-05-28 | https://learn.microsoft.com/en-us/azure/devops/pipelines/test/flaky-test-management?view=azure-devops | Official | 标记后保持至人工 unmark（无自动撤账） |
| 8 | [rush] Flaky Test Quarantine（#4465） | microsoft/rushstack（GitHub Issue） | 2023-12-31 | https://github.com/microsoft/rushstack/issues/4465 | Community | 出隔离需「连续多次成功」、main 分支周期性进程 |
| 9 | How To Manage Flaky Tests in your CI Workflows | Mill Build Engineering Blog（Li Haoyi） | 2025-01-01 | https://mill-build.org/blog/4-flaky-tests.html | Criticism/Community | pass-fail-pass 三连观测、出隔离复发会被自动回抓、判据不必完美 |
| 10 | Flaky Test Quarantine in GitHub Actions | Tenki Blog（Eddie Wang） | 2026-05-22 | https://tenki.cloud/blog/flaky-test-quarantine-github-actions | Currency | 10+ 连续通过自动出隔离、registry 字段（consecutivePasses/SLA）、14/30/45 天阶梯、quarantine rot |
| 11 | Probabilistic flakiness: How do you test your tests? | Meta Engineering Blog | 2020-12-10 | https://engineering.fb.com/2020/12/10/developer-tools/probabilistic-flakiness/ | Official | PFS 持续度量测试可靠性（度量层参考） |
| 12 | How Airtable manages flaky tests in a large-scale monorepo | Airtable Engineering（Medium） | 2022 | https://medium.com/airtable-eng/how-airtable-manages-flaky-tests-in-a-large-scale-monorepo-5fe09922e90c | Community | 同码 stress test 快速确认 flaky（**仅搜索摘要核验，未整页抓取**） |
| 13 | Addressing Flaky Web Tests / Web Test Expectations | chromium.googlesource.com | 现行 | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/testing/web_tests_addressing_flake.md | Official | `--repeat-each=N`/`--iterations=N`/`--gtest_repeat=100` 本地复现口径（**仅搜索摘要核验**） |

---

## 信息缺口（无法核验，未写成事实）

1. **Google 未公开「摘除 flaky 标记所需连续全绿 run 数」**——其 3-in-a-row 是失败判定口径，不能当作撤账阈值引用。
2. **Dropbox Athena 未公开 un-quarantine 自动化阈值**——文章只写了入隔离与 breakage 判定。
3. **Meta 未公开 quarantine 流程阈值**——PFS 是度量分数，Trunk.io 对 Meta 流程的转述（二手信源）未整页核验，不作为证据。
4. **Azure DevOps 无自动撤账判据可引**（unmark 纯手动）——「7 天自动重置」类说法未在官方文档找到，不得引用。
5. **GitLab「>100 次本地运行」** 是其 monorepo + 高频 pipeline 规模下的内部流程，数值不可直接迁移到本仓，只可迁移其「多采样 + 观察窗 + 复发即回」的结构。
6. **Datadog 30 天窗的适用前提**是其持续采集每个 run 的数据；本仓 main 全量 run 频率低，30 天窗口与本仓 run 数之间的换算没有现成依据（本报告以「最低观察窗」近似，属推断而非引用）。
7. **Chromium googlesource 的两个 flaky 文档页**仅通过搜索摘要核验（页面为 codeberg 渲染，未整页抓取），其中 `--gtest_repeat=100` 等具体数字建议使用前自行点开确认。
8. **「N=2 够不够」没有工业直接背书**——工业下限是「多于一采样 + 安全网」，N=2 + corroboration + 观察窗是本仓规模下的工程推断（置信度中）。

继续此会话，运行：atomcode -p "…" --resume 98fda889-c424-4e36-b6d6-6aa6f6be80c5
