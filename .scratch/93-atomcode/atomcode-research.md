[headless] --dangerously-skip-permissions：所有工具调用将自动批准
[warning] 正在以管理员权限运行 — 模型可能可以访问系统文件。
我先建调研计划，然后按「知识库召回 → 三引擎广泛搜索 → 定点深抓 → 交叉验证 → 综合」执行。知识库召回无命中（只有通用用户配置，无本仓库 G-A 台账内容）——联网调研是必需路径。进入第一轮三引擎并行搜索。第一轮命中了 Google/GitLab/Datadog/Microsoft/Chromium/学术侧的主线材料。继续补齐 Meta、Chromium 政策文档、ICSE 2020 误判数据、发布门禁合取与过度声明角度的搜索。GitLab handbook 403（登录墙）、Datadog 抓到的是导航壳——换 .md 端点和其他镜像源继续核验。继续定点核验：补 Google SWE book、Meta PFS、GitLab flaky 文档正文、GitLab quarantine 手册（换引擎）、Chromium 禁测文档与 ICSE 2020 误判率出处。任务 3 的原文核验已超额完成（Datadog .md、GitLab docs、Azure Learn、Chromium sheriff、Playwright、Google 测试博客、GitLab handbook（经 Tavily extract）、Meta PFS、SWE book、contextqa 等 10+ 篇全文）。收尾任务 3，转入交叉验证，最后补一轮 ICSE 2020 出处定位。任务 #4 收尾：补最后两块核验——Microsoft CloudBuild 原文（Q1/Q2 关键证据）与 Dutta ICSE 2020 出处定位。五项任务全部完成，配额自查：`searches: 16+ | angles: Official/Comparative/Criticism/Currency/Community 全五类 | full reads: 11 篇成功全文（Datadog .md、GitLab docs×2、GitLab handbook×2 经 Tavily 高级提取、Azure Learn、Chromium sheriff、Playwright、Google 测试博客、SWE book ch11、Meta PFS、contextqa）| gaps: 见文末`。以下为最终报告。

---

# 残红治理出口的工业成熟方案调研报告

## 执行摘要（Tl;dr）

**业界明确允许把「job 全绿 + 内部存在重试后通过的 flaky」声明为 release gate 绿**——Google/Meta/Microsoft/GitLab/Datadog/Chromium 全部采用「重试消解 + 残余具名收编（quarantine/台账）」机制，其前提是残余被**具名、归属、限期、机器可校验**，而不是被重试机制悄悄吞掉（Confidence：高，6 家一线厂商政策原文交叉验证）。**单次 run 内「首次失败+重试通过」足以触发 flaky 判定（几乎所有厂商的系统检测逻辑），但作为台账定谳证据建议至少补一次同 commit 复现或跨 run 翻转记录**；broken 与 flaky 的分界业界有成熟口径（Datadog：7 天 100% 失败率 = broken）（Confidence：高）。你们现有的 5 字段豁免台账结构与 GitLab/Datadog 的设计高度同构，**本次可以诚实声明 G-A 绿，残余 4 条 flaky 应「入账 + 限期修绿」并行，且应另立票抽公共 helper**（Confidence：高/中/高）。

## 工业机制对比矩阵

| 机制 | Google (TAP) | Meta | Microsoft CloudBuild/Azure DevOps | GitLab | Datadog Test Optimization | Chromium |
|---|---|---|---|---|---|---|
| flaky 判定 | 同码 pass+fail；失败 transition 重跑 **10×** 验证 | 重试后能通过 ⇒ 该次失败即 flaky（PFS 概率评分） | run 内失败+重试通过 ⇒ 系统检测标 flaky | 失败自动重试一次（独立 RSpec 进程） | run 内翻转 / 同 commit 跨 run 不一致 | 构建器自动重试；LUCI Analysis 出报告 |
| 残余处置 | 自动 quarantine 出关键路径 + 开 bug | 标 flaky ⇒ 不再参与变更测试（激励惩罚） | 抑制其结果但仍全量运行；UI 显式标注 | `:quarantine` 元数据；fast/长期两档 | Quarantined/Disabled 状态机 + 自动化策略 | `DISABLED_` 前缀 + bug + 指定 owner |
| 台账字段 | bug + hotlist + owner | owner 票 + 恶化自动标记 | bug 票（关闭即解除） | owner + 48h 响应 + 周更 + **3 个月硬到期** | 稳定指纹 ID + 状态 + 7 天失败率规则 | bug：日志粘贴 + owner + 组件 |
| 出口 | 修复；Flakiness Scorer 评分 | PFS 恢复 ⇒ 恢复资格 | bug 关闭 ⇒ 自动出隔离 | **修复/删除/降级三选一，必须选一** | 连续 30 天不 flake ⇒ 自动 Fixed | 修复后移除前缀 |
| 防「坟场」 | 专职团队 + 自动隔离 | 资格惩罚的激励结构 | 不修复期自动解除 | **到期自动删除** + SLO 升级 | 30 天不修自动 Disabled + Broken 识别 | sheriff 流程 + 可见的 DISABLED |

---

## 第 1 问：重试后通过的 run 能否声明为 release gate 绿？

**推荐：可以，但声明必须写成「绿 + 具名残余」而不是「全部用例通过」。** 这是六家一线厂商的共同实践：

- **Google**（官方政策原文）："To release a project, we require that all these tests pass with the latest code changes" ——但同时提供了成套消解机制：重跑失败用例、自动重跑、把测试标记为 flaky（连败 3 次才报红）、以及「flakiness 过高自动 quarantine 出关键路径并开 bug」。换言之，Google 的「全绿声明」是通过**把 flaky 移出门禁路径**来成立的，而不是假装它不存在。
- **Meta**（官方工程博客原话）："A passing test indicates the absence of corresponding regression, while a failure is merely a hint to run the test again" ——官方承认业界通行的不对称语义：重试通过 ⇒ 该次失败按 flaky 处理。Meta 的 PFS 系统在此基础上给每个测试打概率分，恶化测试被取消参与变更测试的资格。
- **Microsoft**（CloudBuild 工程博客）：官方流程就是「失败且重试通过 ⇒ 标记 flaky ⇒ quarantine ⇒ **抑制其结果但仍全量运行所有测试** ⇒ bug 关闭后自动解除隔离」。该系统服务 100+ 产品团队、识别约 4.9 万条 flaky。
- **Azure DevOps**（官方文档）：系统检测 = "rerunning failed tests within the same pipeline execution. If a test case fails initially but passes on a rerun, it is marked as flaky"，并提供「让 flaky 失败不弄红 pipeline」的开关。
- **GitLab**（官方开发文档）："Failing tests are automatically retried once in a separate RSpec process."
- **Playwright**（你们所用框架的官方语义）：重试后通过被显式归类为 **"flaky"**（区别于 passed / failed），即框架本身承认这是一类合法的、可区分的绿色结局。
- **Chromium**：构建器自动重试失败用例以避免 tree closure，同时把 flake 记入仪表盘追踪。

**反向约束（批评视角）**：contextqa 2026 年长文与 Google 自己的警告——quarantine "could easily mask a real race condition"；「重试把红色洗绿」若不配套具名追踪，等于丢弃测试的全部信号价值。GitLab 文档同样承认重试会漏掉「flaky 测试偶然揭示的真实缺陷」。

**结论**：门禁绿声明成立的充分条件不是「0 flaky」，而是「0 未收编的失败」。重试通过合法地构成绿色，**前提是残余进入可见的、有主的处理通道**——这正是你们 waiver 台账的角色。

来源：Google Testing Blog *Flaky Tests at Google and How We Mitigate Them*（Google，2016，testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html，已读全文）；Meta *Probabilistic flakiness*（Engineering at Meta，2020-12-10，engineering.fb.com，已读全文）；Microsoft *Improving developer productivity via flaky test management*（Engineering at Microsoft，2022-02，devblogs.microsoft.com——二次直抓 404，内容取自搜索引擎全文高亮，已注明）；Azure DevOps *Manage flaky tests*（Microsoft Learn，更新于 2025-05-28，已读全文）；GitLab *Unhealthy tests*（docs.gitlab.com，已读全文）；Playwright *Retries*（playwright.dev/docs/test-retries，已读全文）；Chromium *Handling a failing test*（chromium.org，已读全文）；contextqa *Flaky Tests in CI/CD: Fix Them Without Retries*（2026-07，已读全文）。

## 第 2 问：flaky vs broken 的工业分类阈值

**推荐：单次 run 内「首败+重试过」= 足够的 flaky 触发信号（provisional），台账定谳建议至少两证据；broken 判定用「时间窗内全败」口径。**

分阈值层级：

| 层级 | 业界口径 | 证据强度 |
|---|---|---|
| **触发**（标为疑似 flaky） | run 内一次翻转即触发——Azure 系统检测、GitLab 重试一次、Meta 统计模型（重试 1 次）、Playwright 分类、Microsoft CloudBuild 默认逻辑全部如此 | 1 次 flip |
| **定谳**（入台账） | Google ICST 2017 keynote："We re-run test failure transitions (10x) to verify flakiness — if we observe a pass the test was flaky"；Dropbox Athena 实验后定为重试 10 次；Meta ICSE-SEIP 2019 论文：训练数据中失败用例最多重试 10 次，且称该方法 "accepted across the industry" | 2–10 次重复或跨 run 翻转 |
| **broken 判定** | **Datadog 官方：最近 7 天执行 100% 失败率 = broken**，禁止自动标 Fixed；另有 7 天失败率阈值驱动的自动 quarantine/disable 策略 | 7 天窗口 |
| **修复确认（出账）** | Datadog：不再 flake 满 **30 天** 自动转 Fixed；修复确认流程 = 修复合并后自动重试 20 次 + 等 fix 到达默认分支 + 14 天宽限期 | 事件 + 时间混合 |
| **收编硬上限** | GitLab：隔离 3 个月未解决自动删除；修复 SLO 24 小时，逾期升级 Severity 3 事故 | 事件到期 |

关于误判率：**«ICSE 2020 自动分类误判率»这个具体出处本轮未能定位核验**（见文末缺口）。可核验的相邻证据：Tahir et al. 的多声部综述（Journal of Systems and Software, 2023）指出基于有限执行次数的动态检测存在固有局限，且 flaky 测试有强揭示真实缺陷的能力（隔离有漏真 bug 的风险）；卢森堡大学对 Chromium CI 的研究（博士论文，2022 语境）量化了误分类代价：**flaky 测试揭示了全部回归缺陷的 1/3 以上，56.2% 由非 flaky 测试产生的故障触发失败会被「按测试」预测方法误判为 flaky**。Microsoft ISSTA 2019（Godefroid et al.）：86% 的 flaky 在本地 100 次重跑也无法复现——只在 CI 管道里 flaky，说明「本地无法复现」不构成 broken 证据。

**对结论 ② 的推论**：你们 4 条残余（每 OS 重试后通过）满足触发级证据；入账时把「基线 run URL + 失败签名」写死，之后任何一次同签名重现或下一次 run 翻转即可升级为定谳；若后续某条连续 2 个全量 run 全签名一致失败 ⇒ 按 broken 处理、**出账转修绿票**（你们的「broken 不得豁免」规则与 Datadog 口径一致）。

来源：Datadog *Flaky Tests Management*（docs.datadoghq.com/tests/flaky_management.md，已读全文）；Google *The State of Continuous Integration Testing @Google*（ICST 2017 keynote，aster.or.jp，搜索引擎高亮级）；Dropbox *Athena*（dropbox.tech，2019-05，高亮级）；Meta *Predictive Test Selection*（ICSE-SEIP 2019, doi:10.1109/icse-seip.2019.00018，高亮级）；GitLab *Test Quarantine Process*（handbook.gitlab.com，经 Tavily 高级提取读得，页面标注最后修改 2026-08-05）；Godefroid et al. *Root Causing Flaky Tests in a Large-Scale Industrial Setting*（ISSTA 2019，高亮级）；Tahir et al. 2023（sciencedirect.com，摘要级）；卢森堡大学博士论文 *Test Flakiness Prediction Techniques for Evolving Software Systems*（orbilu.uni.lu，高亮级）。

## 第 3 问：quarantine / waiver 台账的成熟设计

**推荐：保留你们 5 字段骨架，补 4 项；到期用「时间 + 事件」双闸；named-F 出口是业界主流做法，强烈推荐。**

**字段设计**（对照业界）：

| 字段 | 业界对应 | 现状 |
|---|---|---|
| 用例名（稳定指纹） | Datadog 用 repo ID + FQN 哈希作唯一 ID | ✅ 已有 |
| 基线 run URL | Chromium 要求把日志粘贴进 bug（"logs eventually get deleted"——URL 会失效，签名要落文本） | ✅ 已有，建议签名存全文文本 |
| 失败签名 | Datadog 按错误信息分组；GitLab 按根因分类打标（`flaky-test::state-leak` 等 8 类） | ✅ 已有 |
| 归属票 / owner | GitLab 强制 owner + 48h 确认 + 周更；Meta 给 owner 开票 | ✅ 已有，建议加「owner 确认时限」 |
| 到期 | GitLab 3 个月硬到期自动删；Datadog 30 天不修自动 Disabled | ✅ 已有（硬到期不得续期 = 业界最严口径，好） |
| **建议补①：退出条件（事件到期）** | GitLab 三选一出口；社区成熟实践（javascript-testing.com 隔离指南）：根因修复后连续 50 次绿灯才复权，「让复权成为测量事件而非主观判断」 | 补：修复合并 + 连续 N 个全量 run 不复发 ⇒ 出账 |
| **建议补②：影响域（OS/浏览器/根因类）** | Azure 按 branch 记录 flaky 数据；GitLab 按根因分类 | 补：ubuntu-ff/ch、windows、macos 维度 |
| **建议补③：准入裁决日期与裁决者** | Chromium bug 要求记录处理动作 | 补：审计链 |
| **建议补④：never-quarantine 家族标记** | 你们自有约束（Datadog 的 broken 排除逻辑同构） | ✅ 已有，脚本校验 |

**避免坟场**：GitLab 的机制最完整——隔离是临时的（"Quarantining a test should be temporary: tests must be fixed, removed, or moved to a lower test level"），3 个月不解决**自动删除**（不是自动续期），owner 不响应则测试被删且影响团队测试健康指标，外加 24h 修复 SLO 逾期升级为 S3 生产事故。Datadog 用状态机 + 自动策略（30 天未修 ⇒ Disabled、7 天失败率超阈 ⇒ 自动动作）把「拖」变成不可行选项。Meta 用激励结构（恶化测试失去变更测试资格 = 作者自伤）。**关于「a queue, not a graveyard」逐字短语：本轮只在第三方（contextqa 2026）看到该表述，未能在 GitLab 自有域名核验逐字出处**——但 GitLab 的 3 个月自动删除机制在功能上就是这句话的制度化。

**Named-F 出口是否推荐**：推荐。具名残余（每条绑定归属票 + 到期日）正是 GitLab（具名隔离 + owner + 硬期限）、Chromium（具名 bug + 指定 owner + 组件标签）、Meta（owner 票）三家的共同做法；它与「无条件重试隐藏 flaky」是光谱两端，Chromium 甚至因为 FLAKY_ 前缀机制「造成构建变慢和对开发者的假失败」而在 2012 年**废弃了自动豁免前缀**，回归「具名 bug + 禁用 + 指派 owner」模式。把残余 flaky 明确命名并绑定归属票，是被审计时唯一站得住的姿势。

来源：GitLab *Test Quarantine Process* / *Flaky tests* handbook（handbook.gitlab.com，Tavily 提取，含 2026-08 最新 SLO 条款）；Datadog Flaky Tests Management（已读全文）；Meta PFS（已读全文）；Chromium *Handling a failing test*（已读全文）；javascript-testing.com *Quarantine Flaky Tests in CI: A Practical Guide*（2026-05，搜索结果全文级）；contextqa（已读全文）；Atlassian *Flakinator*（2025-12，高亮级：检测后自动建带 deadline 的 Jira 票 + 健康期复权）。

## 第 4 问：release gate 与 CI 绿的关系

**推荐：CI 绿是必要条件、绝非充分条件；用合取门禁把人工项并入。**

- **必要性**：Google 官方口径 "all of the tests for a particular project must report a passing result before submitting code or releasing a project"；SWE book 记载 Google Test Certified 体系把 "no releases with broken tests" 写进等级要求。
- **不充分性**：① CI 无法覆盖真实用户路径的黄金流程验证（Chromium 把 flaky 失败设为非阻塞、代码照常进入下一阶段——ISST/SEIP 2022 论文明言 Chrome 的 flaky 失败 non-blocking，说明他们不把 CI 绿当作发布充分条件，而依赖分层兜底）；② Google SWE book：flakiness 逼近 1% 时测试即开始失去价值——CI 绿本身可能是失真的；③ 各家发布清单（Octopus Deploy、Cortex、LaunchDarkly、Growthbook）一致要求**人工项**：回滚演练（Octopus 原话：用实际部署清单做「仿真模式」演练，"treat it like a fire drill"）、发布前审批确认、监控就绪验证、回滚决策预文档化（Growthbook：回滚决策必须定义于发布开始前，而非事故中即兴）。
- **合取门禁公式**（对本仓库形态）：

```
G-A 门禁绿 ⇔ (test.yml 全 job success)
          ∧ (残余 flaky 全部入账 ∧ 台账机器校验脚本通过)
          ∧ (无 broken 未处置 ∧ never-quarantine 家族 0 入账)
          ∧ (data-golden job success)
          ∧ (人工黄金路径执行通过)
          ∧ (回滚演练通过)
```

每一项都是必要条件，任何一项缺失 ⇒ 不得声明。CI 绿的失效模式（flaky 洗绿、环境性假绿、数据竞态）恰好由后四项兜住；人工项的失效模式（凭记忆跳步）由 checklist + 留痕兜住。

来源：Google Testing Blog 2016（已读全文）；*Software Engineering at Google* ch11（abseil.io，已读全文）；ISST/SEIP 2022 *The impact of flaky tests on historical test prioritization on Chrome*（dl.acm.org/doi/10.1145/3510457.3513038，摘要级）；Octopus Deploy *Ultimate 16-step Deployment Checklist*（octopus.com，搜索全文级）；Cortex *Software Release Checklist*、LaunchDarkly *Release Management Checklist*、Growthbook *Release management best practices*（均为搜索结果级，结论一致）。

## 第 5 问：退出残红治理波时最易被质疑的过度声明

**推荐表述纪律（每条对应一个真实质疑点）**：

| # | 过度声明（审计方会打的点） | 纪律 |
|---|---|---|
| 1 | 「main 已全绿」 | 改为「run `<URL>`：4 job 全 success；Playwright 各 OS 603/604 passed、5 skipped、flaky 4 条（ubuntu 2 / win 1 / mac 1）」。Google 对 flaky 的定义是「同码既过又败」——只要重试发生过，绿里就有残余，藏起来即 overclaim |
| 2 | 「没有失败」 | 603/604 之外的 **5 skipped 必须逐条说明原因**（条件跳过？平台限定？）——skipped 不等于通过，审计方第一个问的就是这个 |
| 3 | 「这些是 flaky」 | 单次 flip 只构成触发级证据。声明中写明证据链：基线 run URL + 失败签名文本 + 重试通过事实；有跨 run 翻转/同 commit 复现则注明（Google 10× 验证口径） |
| 4 | 「豁免台账已覆盖」 | 附机器校验脚本的输出；逐条展示 5 字段齐全 + 未到期 + 非 never-quarantine 家族 + 非 broken。GitLab 口径：owner 缺位 = 台账无效 |
| 5 | 「flaky 会自己好」 | 每条带硬到期日且不续期；到期即出账转修绿（GitLab 3 个月自动删除是同构的硬约束） |
| 6 | 「根因已修」 | 修复合并 ≠ 修复确认。Datadog 口径：合并后还要自动重试确认 + 等待到达默认分支 + 宽限期不复发才叫 Fixed。表述用「修复已合并，观察 N 个 run 未复发，出账」 |
| 7 | 「治理波完成」 | 只能声明「本波次出口条件达成」：门禁绿 + 残余具名 + helper 票立案。残红治理是持续机制不是一次性事件（Google：insertion rate ≈ fix rate，"we are stuck with a certain rate"） |
| 8 | 混淆「重试通过率」与「通过率」 | 603/604 是首跑通过数，不是总通过数；两个数都要报 |

来源：第 1/2/3 问全部来源 + Google 测试博客评论区官方答复（"It is quite common to ignore legitimate failures in flaky tests due to the high number of false-positives"——Google 自己承认假绿风险是首要审计点）。

## 第 6 问：同一根因横跨约 10 个 spec——抽 helper 还是逐 spec 修？

**推荐：抽公共 helper 统一治理，且这几乎是唯一正确解。** 理由：

1. **GitLab 官方根因分类直接命中本案例**：其 `flaky-test::state-leak` 类目的官方裁决是 "**The actual cause is probably not the flaky test here.** Fix the previous tests and/or places where the test data or environment is modified"——根因在装置而非各 spec，修装置是官方指定动作。你们的「fire-and-forget 关闭引导遮罩导致指针拦截竞态」本质是同一形态：竞态源在共享测试装置，10 个 spec 只是受害者。
2. **修症状的经济学**：逐 spec 修 = 10 份 review 成本 + 10 处将来漂移的风险 + 第 11 个 spec 复写同款 bug；抽 helper = 1 处修复 + 10 处调用点替换 + 根因免疫。Google 的 De-Flake/Flakiness Debugger（ICSME 2020）整条产品线的前提就是「定位并修根因，而不是逐个糊」。
3. **测试独立性是框架级公理**：Playwright 官方 "It is usually better to make your tests isolated"；helper 化的显式等待（等遮罩真正关闭）正是把「隐式时序假设」收敛到一处的方式——Google 2021 flakiness 系列明确警告 "Do NOT add arbitrary delays as these can become flaky again over time"，即 helper 里必须用事件等待而非 sleep。
4. **例外条款**：若 10 处的失败签名并不真正同源（表面相似、根因各异），则先逐 spec 分诊再合并——所以 helper 票的第一步是「验证 10 处签名确属同一根因」（你们已有的签名字段就是干这个的）。

落地形态：canonical helper（显式等待遮罩关闭/无指针拦截）→ 替换 10 处 → 每处至少本地 `--repeat` 20 次验证（Chromium 对 flaky 排查的标准动作 `--gtest_repeat=20` 的 Playwright 等价物）→ 全绿后 10 条台账出账。

来源：GitLab *Unhealthy tests*（已读全文，state-leak 官方裁决）；Google *De-Flake Your Tests*（ICSME 2020，computer.org，高亮级）；Google Testing Blog *Test Flakiness Part II*（2021-03，高亮级）；Playwright *Retries*（已读全文）；Chromium *Addressing Flaky GTests*（chromium.googlesource.com，gtest_repeat=20 口径，高亮级）。

---

## 对本仓库的具体建议

**① 本次是否可声明 G-A 绿：可以，用受限措辞，且建议加一条 corroboration 动作。**
声明模板：「test.yml 最新全量 run（附 URL）：4 job 全 success、0 failed；Playwright 各 OS 603/604 passed、5 skipped（逐条注明原因）、flaky 4 条（ubuntu 2 条同一 spec 双浏览器、windows 1、macos 1），全部满足 flaky 准入（首败+重试过、签名留存）；waiver 台账机器校验通过、无 broken、never-quarantine 家族 0 入账；data-golden job success；人工黄金路径与回滚演练已执行（附 checklist 留痕）。本声明仅对上述 run 有效。」
corroboration 动作：在声明落笔前后跑 1–2 次同 commit 重跑（或等下一次 scheduled run），确认同样只有这 4 条、无新增签名——这是把「单 run 声明」升级为「稳定态声明」的最低成本动作（Google 10× 口径的务实缩比）。

**② 残余 flaky：入账 + 限期修绿并行，不要二选一。**
4 条全部满足 flaky 准入（非 broken：broken = 全签名一致失败，与现状相反）。ubuntu 2 条同 spec 双浏览器同根因 ⇒ 同一归属票；windows/macos 各一票（或合并为同一根因票的三条目）。每条给硬到期（建议 ≤2 周——因为根因已知且是测试装置问题，修复成本低；GitLab 对 master 阻塞 flaky 的 SLO 是 24h，2 周已是宽限）。到期不续期；修复合并 + 后续 run 不复发 ⇒ 出账（Datadog Fixed 语义）。

**③ 公共 helper 票：立。**
先修根因票（helper 抽取就是根因修复的实现形式，可以一票两阶段：helper 落地 → 10 处替换验证），helper 票本身作为可审计的追踪载体。验收标准写死：10 处调用点全部替换 + 每处 repeat ≥20 次本地验证 + 连续 2 个全量 CI run 无同签名复发 ⇒ 关票并从台账出账全部 10 条。

---

## 信息缺口（未核验，未写成事实）

1. **ICSE 2020 «自动分类误判率»具体出处与数值**：多轮检索（含 AnySearch/Exa/学术源）未能定位到该年该会含误判率数字的原论文；仅有相邻研究可核验（Tahir et al. 2023 综述；卢森堡大学 Chromium CI 研究 56.2% 误分类数据，2022 语境）。用户提示词中的「ICSE 2020 误判率」可能指向 Dutta et al. *Lifecycle of a Flaky Test*（ICSE 2020）——该论文存在性有二手引用，但原文与具体数字本轮未核验。
2. **"a queue, not a graveyard" 逐字出处**：仅在 contextqa（第三方博客，2026）见到该表述；GitLab 自有域名未核验到逐字原话（其 3 个月自动删除机制在功能上等价）。引用时应归给 contextqa 或作为业界格言而非 GitLab 原话。
3. **Microsoft CloudBuild 博客原文**：devblogs.microsoft.com 二次直抓 404（URL 可能变更），内容取自 Exa 搜索引擎全文高亮，未做到逐字全文核验。
4. **Chrome "flaky 失败非阻塞" 论文**：ACM 付费墙，仅摘要级（"on Google Chrome, flaky failures are non-blocking"），未读全文。
5. **发布清单类来源**（Octopus/Cortex/LaunchDarkly/Growthbook）均为搜索结果级，未逐篇全文抓取；其结论（回滚演练、预文档化）多方一致，但不宜作逐字引用。
6. **本仓库 run 数据**：本次为只读调研，未访问 GitHub API 核实 run URL、台账实际内容与 5 skipped 的具体原因；报告中的仓库事实均以用户陈述为准。
