# Research Report — Round 4 · 票 19 心智模型与测试执行治理深度调研

- 日期: 2026-09-04
- 票: 19 mental model and test governance deep research (Blocked by: None; 状态 done)
- 方法: 单次串行 atomcode 调研（verbatim 提示词照发，WORKFLOW §4.3，全程仅 1 次在途，无并行调用）。载体说明: 本窗口无 ctx\_\* 工具，按启动器降级条款以 Node 脚本承载 atomcode CLI —— prompt 经 argv verbatim 传入（无 shell 引号嵌套）、stdout 落盘 `.codex-tmp/atomcode-ticket19-answer.md`（25,505 字节，exit 0），仅字节数/退出码回传上下文，避免嵌套转义与对话断裂。
- 只读票: 零源码/manifest/测试改动；本文件为唯一新增产物。
- 本地校验: atomcode 报告中的本地代码断言经逐项实测复核，**1 项被证伪**（§3.7 浏览器 API 触点数据），已修正后再纳入结论；2 项独立确认（test.yml 治理字段缺位、模块行数）。

## 1. 现有心智模型（外部调研前记录 — 16 份必读全读后）

必读清单（prompts/19、handoffs/19、issues/19、spec.md、WORKFLOW.md、round4-architecture-report.md、research-report-round3.md、AGENTS.md、根 CONTEXT.md、docs/CONTEXT.md、docs/DESIGN.md、ADR-0013、ADR-0016、test/playwright.config.ts、test/playwright.quarantine.config.ts、package.json）读全后记录：

1. **实现形态**: 零构建原生 ES modules，14 个模块，ntp.js（实测 993 行）为入口编排 + 组合根；无循环 import、无 barrel（round4 快照 + 本地 wc 实测: render 1612 / conn-layer 787 / sync-engine 827 / popups 432 / settings-ui 331 / storage 378 / state 136）。
2. **边界机制**: 正向 ESM import、反向 initXxxFacade(deps) 一次性注入；ADR-0016 四层（port=storage / envelope=credentials / engine=sync-engine / presentation=settings-ui+onboarding）。round4 实测 settings-ui/onboarding/sync-engine/render 存在 feature 级兄弟互 import，与 ADR-0016 单向规则矛盾 —— 这是票 21 的修复对象，不是本票范围。
3. **测试治理现状**: 双 Playwright 配置（主车道 workers=4 本地（票01 8 核 headed 浏览器饿死证据）/ CI=1，firefox 项目 grepInvert @quarantine）；222 leaf tests、14 个 @quarantine 跨 7 specs（round4 快照），本地实测 spec 文件 33 个（31 个 boxing-\*）。主 CI `test.yml` **无 timeout-minutes、无 concurrency 取消、无 last-failed 重跑缓存**（grep 实证，仅 quarantine.yml 有 timeout:30 + continue-on-error + 每日 cron）。失败重跑目前靠人工 `--last-failed` 收敛（票15 实操路径已写进 WORKFLOW §6）。
4. **调研前心智模型一句话**: 架构侧 = "不变量驱动拆分 + 组合根门面注入 + 单写变更入口 commit(op) + 派生结构不落盘 + storage 门面唯一化"；测试侧 = "全量双车道 + firefox quarantine 排除面 + 人工 last-failed 收敛"。外部调研回答的问题是: 这套测试执行治理离工业共识多远、最小增量是什么。

## 2. 对比矩阵（6 个心智模型 × 7 维度）— atomcode

图例: ★ = web_fetch 全文核验；◐ = 搜索/摘要片段级。

| 心智模型 | 核心机制 | 成熟度/信源 | 适用规模门槛 | 零构建 ESM 扩展适配度 | 主要风险 |
|---|---|---|---|---|---|
| **A. 测试金字塔 + 分层 CI 门** | 单元(多/快)→集成(中)→E2E(少/慢)，CI 按速度排序 fail-fast | 极高（Fowler 一手 ★ + 多源） | 任何规模，门槛最低 | ★★★★★ 纯逻辑模块可 `node --test` 直跑原生 ESM，零构建器 | 沦为"冰激凌甜筒"（E2E 过多）——Boxing 33 spec 全浏览器级，中段缺失 |
| **B. 静态依赖图影响面** | git diff → 依赖图 → 只跑受影响包（Nx affected / turbo --filter / Bazel） | 高（官方+实测 ★◐） | 15-20+ 包才值得（<15 包是复杂性税） | ★★☆☆☆ 单扩展包内无包图可算 | 静态图抓不到动态 import/运行时路径 |
| **C. 运行时覆盖图测试选择** | 覆盖率映射"哪个测试实际执行了哪段代码"，diff 后只跑受影响测试 | 中-高（testpick 一手 ★ / Testplane ◐） | 套件 >10min 才值得，需维护 map 基线 | ★★★☆☆ 需 V8 覆盖率 + SourceMap；纯 E2E 无单元层的适配度未实证 | map 过期=静默漏测，必须保守回退 |
| **D. Playwright workers×shards** | workers=单机多进程并行；shards=多机切分；fullyParallel=测试级粒度 | 极高（playwright.dev 官方一手 ★ + currents.dev 实测 ★） | workers: 100-800 测试；shards: 1500+ 或单机 >1h | ★★★★☆ Boxing 已在用 workers(4/1)；shards 对 33 spec 纯过度 | CPU 过订阅超时；shard 静态不均衡 |
| **E. 六边形/依赖规则 + 门面隔离** | 依赖只向内；模块经公共门面协作；架构规则进 CI 强制 | 高（hexagonal 多源 ◐ + ArchUnit 系工具） | 任何规模，按需裁剪 | ★★★★☆ storage/persist/sync-engine 门面已立，零构建下 import 图 grep 即可强制 | 过度分层（每模块一个门面）是常见反模式 |
| **F. 多智能体 worktree + zone-claim** | 每 agent 独立 worktree，文件/symbol 级声明占用，CI 容量 4-5x 预配 | 新兴（tianpan 实测 ★ + auravcs ◐ + 批评面 ◐） | 并行 agent >3 且共享热点文件 | ★★★☆☆ GitButler 每票独立分支已是其本仓库对应物 | 治理层本身成为复杂度来源；冲突率 15-25%（>10 agent） |

### 2.2 增量测试选择方案细分 — atomcode

| 方案 | 选择依据 | 精度 | 保守性 | 基础设施成本 | 代表工具 |
|---|---|---|---|---|---|
| 静态文件夹映射 | 文件→测试目录约定 | 低 | 差（映射过期=静默漏测） | 零 | 手写 |
| 静态依赖图(包级) | git diff → 包依赖图 | 中(包粒度) | 中 | 中（需 monorepo 工具） | Nx / turbo / Bazel |
| 运行时覆盖率图 | 测试实际执行的代码行→文件 | 高(文件级，抓动态 import) | 高（"拿不准就跑更多"+未知文件跑全量） | 中（map 基线+SourceMap） | testpick |
| 浏览器端选择性 | CDP 收集浏览器内依赖 | 高 | 高（incomplete dump 禁用于选择） | 高（CDP+SourceMap+服务端排除） | Testplane |

### 2.3 并发上限实测数据 — atomcode

| 维度 | 数据点 | 来源 |
|---|---|---|
| workers 甜点 | 100-800 测试、单测 <30s、4-8 workers 下 <20min，workers 足够 | currents.dev (2025-12) ★ |
| CPU 过订阅 | 4 核 runner 配 2-4 workers；8 核配 6-8；超配即超时（实测 4 过 / 15-20 挂） | currents.dev 引 GitHub issue |
| 何时上 shards | 1500+ 测试或单机 8 workers 仍 >1h | currents.dev |
| shard 不均衡 | 字母序切分慢文件集中（20min vs 5min 实例） | currents.dev |
| 多智能体冲突率 | >10 并行 agent、共享依赖多时 15-25%，每冲突需人工/二次 agent | tianpan.co (2026-02) ★ |
| 冲突面 | N 分支 ~N(N-1)/2 超线性；合并 A 使 B..N 基准失效 | thedailydeveloper ◐ |
| CI 容量 | 多 agent 场景需 4x 容量 + 预合并轻量检查（lint/编译 2-3min）分流 | tianpan.co ★ |

## 3. 关键分点结论（关键结论均 ≥2 独立信源；冲突点如实呈现）

1. **测试金字塔按"速度+范围"而非类型分层**（Fowler 一手 + codilime/virtuosoqa 等多源）。Boxing 33 spec 全是浏览器级测试、无 Node 单元层 —— 是金字塔中段缺失，"甜筒化"前兆而非结论；触发条件成熟（CI >10min）前不开票（见 G6'）。
2. **增量测试选择的工业正解是"运行时覆盖图 + 保守回退"，静态图有盲区**（testpick 一手: 动态 import/DI 注册表是静态图盲区，安全规则 = 拿不准跑更多、未知文件跑全量、AI 建议永不导致跳过；Testplane 独立佐证 + 失败 dump 禁用于选择）。两源都面向 Jest/Vitest 生态 —— **Boxing 当前 CI 分钟级规模不满足触发条件，不引入**（诚实呈现: 该判据是规模推断，非纯 E2E 场景实证）。
3. **影响面检测分"包级"(Nx/Turbo/Bazel) 与 "symbol 级"(blast-radius 类)**（gazar.dev + nx.dev + birjob 多源: <15 包不值得上 monorepo 工具；Bazel "wrong answer almost everywhere else"）。Boxing 已有 codegraph 符号图（AGENTS.md BX-EXPLORE 系列）= 本地影响面检测已落地，无需新工具。
4. **并发上限共识: workers 优先、shards 最后、显式 CPU 上限、失败即降级**（playwright.dev 官方 + currents.dev 实测）。Boxing 现状核对: workers `CI?1:4` + retries `CI?2:0` —— 本地 4 有票01 证据背书；**CI=1 放弃了 4 核 runner 的合法并行**（甜点区间 2-4），可升 2；33 spec 规模上 shards 纯属过度设计。
5. **多智能体并行治理: 隔离执行 + 显式占用 + 容量预配，且"少即是多"**（tianpan 实测 15-25% 冲突率 + auravcs worktree/zone-claim 方案 + thedailydeveloper 反面激进观点"冲突吃掉 30-50% 时间"）。Boxing 对应物已存在: WORKFLOW §4.2 每票独立 GitButler 分支 + but diff 逐 hunk 认领（票05 教训）；缺的是"热点文件（ntp.js/render.js/sync-engine.js）同时段单 agent"约定未成文。
6. **门面隔离 + 依赖规则是唯一同时服务"测试性"与"并行修改"的架构模型**（hexagonal/ports-adapters 多源 + ArchUnit/import-linter 工具化先例）。Boxing storage.js/persist.js/sync-engine.js 门面已立、ntp.js 是组合根；边界规则散在 ADR/约定里，无机检 —— 即 round3 G1 缺口仍未闭合，归票 21。
7. **本地校验证伪修正（本窗口对 atomcode 断言的实测复核）**: atomcode 称"浏览器 API 触点 render 13 / popups 15 / settings-ui 12 处直接碰 chrome./browser."。实测（grep `\bchrome\.|\bbrowser\.`）: render.js **1**、popups.js **2**、settings-ui.js **1**、onboarding.js **1**、conn-layer.js **0**、persist.js **3** —— 除 popups.js:60-61 的 `browser.browserSettings.openBookmarksInNewTabs`（合法 Firefox 专用 API 调用）外**全部是注释**。计数污染源推断: 把 `window.*`/`localStorage` 并入（render 12 / popups 13 / settings-ui 7 处 window|localStorage）。**治理含义反转**: "浏览器 API 触点审计"不是大面积违规面，而是一条现成可白的 grep 断言 —— 票 21 可直接加一条 "除 storage.js/sync-engine.js/credentials.js/popups.js(browserSettings 例外登记) 外，ntp 模块 0 chrome./browser. 直呼"，成本 ~10 行。教训: 外部调研的"本地读码"结论必须本地复核后才能进 ADR/票面。
8. **零构建 ESM 扩展测试的官方路径 = persistent context + --load-extension + 原生 ESM 直载**（playwright.dev 官方一手 + helpmetest/kzar 佐证 Firefox 侧实验性是行业现状）。Boxing 的双车道设计与官方支持面完全对齐，不需要也不应该为测试引入构建器。

## 4. 还缺什么（缺口清单，按性价比排序）

| # | 缺口 | 本地证据 | 归属 | 最小实现 |
|---|---|---|---|---|
| G1' | **CI 执行治理缺位**: 无 timeout-minutes、无 concurrency 取消、重复 push 会排队并耗尽机器 | test.yml grep 实证（仅 quarantine.yml 有 timeout:30） | 票 20 | test.yml 加 `timeout-minutes` + `concurrency: { group, cancel-in-progress: true }` |
| G2' | **失败重跑非机制化**: last-failed 靠人工记忆（票15 实操），无 CI 惯例 | WORKFLOW §6 票15 行 | 票 20 | CI 失败 job 产出 `--last-failed` 重跑指引/artifact；本地沿用票15 两轮收敛法 |
| G3' | **无 spec↔模块簇映射**: 33 spec 文件 vs 14 模块无机器可读映射，变更选测全凭人脑 | round4 快照 + 本地 ls | 票 21 | 映射表（spec 文件 ↔ ntp 模块簇）落 docs + 进断言 gate，映射过期即测试失败 |
| G4' | **import 边界无机检**: ADR-0016 单向规则被 feature 级兄弟 import 违反而无告警；round3 G1 仍开放 | round4 报告实测 | 票 21 | import-graph 断言 spec（无 barrel / 无循环 / storage 门面唯一 layoutStorage 触碰）挂 npm test |
| G5' | **浏览器 API 触点白名单未立**（修正后比预想小得多） | §3.7 实测 | 票 21 顺带 | grep 断言 + popups.js browserSettings 例外登记 |
| G6' | **测试金字塔中段缺失**（33 spec 全浏览器级，纯逻辑模块 utils/i18n/credentials 可 Node 直测） | 本地 spec 清单 | 不开票，记录触发条件 | 触发条件 = CI 套件 >10min；届时先 `node --test` 补中段，再评估覆盖图选择器 |
| G7' | **多智能体并发上限未成文**: workers 政策只活在配置注释；热点文件单 agent 约定未写入任何权威文档 | workers 注释 + WORKFLOW 票05 hunk 认领教训 | 票 20 文档化 | 并发政策一节（本地 4 / CI 1→2 / 热点文件清单 + 单 agent 约定）写进 test-governance 文档 |

## 5. 最终推荐（唯一结论）

**选型: "文件级 spec-cluster 映射 + Playwright 原生过滤"为增量测试选择模型，"显式 CI 治理字段"为执行治理，"grep import 断言"为边界守卫，全量跑作为保守回退。** 即 spec.md 目标模型"依赖图 → 变更闭包 → 增量执行"的最小机械化子集 —— 零新依赖、零构建器、零新 runner，全部落在现有 Playwright + Node 能力内。

- **增量测试选择（票 20/21 输入）**: 不引入 testpick/Testplane/覆盖图（当前 33 spec 分钟级规模不满足 >10min 触发条件）。用 ① 票 21 的 spec↔模块簇映射表（gate 防过期）② Playwright 原生 `--last-failed`（票15 已实证的两轮收敛法）③ 按映射表直跑相关 spec 文件。保守规则照 testpick/Testplane 双源采纳: **拿不准跑全量；失败 dump 不得用于选择**。
- **并发上限（票 20）**: 本地 workers=4 保持（票01 证据）；CI workers 1→2（4 核 runner 甜点区间，currents.dev 实测）；test.yml 加 timeout-minutes + concurrency.cancel-in-progress；政策成文（G7'）而非 ad hoc flag。
- **边界守卫（票 21）**: import-graph 断言 4 条 —— 无 barrel 文件、无 render↔conn/popups 循环 import、storage.js 唯一 layoutStorage 触碰、浏览器 API 触点白名单（§3.7 修正后 ~10 行 grep）。
- **影响面检测**: 保留 codegraph（BX-EXPLORE）为 symbol 级工具，不引入新依赖。
- **多智能体并行**: 沿用 GitButler 每票独立分支 + but diff 逐 hunk 认领；新增"热点文件（ntp.js / render.js / sync-engine.js）同时段单 agent"约定入票 20 文档；不建 agent 编调基础设施（现实是 1-3 个 agent 偶发并行，冲突率远低于 15-25% 实测区间的前提）。
- **明确不引入（防回潮）**: Nx/Turbo/Bazel（单包无图可算）、testpick/Testplane/覆盖图选择器（触发条件未到且纯 E2E 适配未实证）、shard 矩阵（33 spec 太小）、每模块一个门面（过度分层）、agent 编排层、`node --test` 中段层（触发条件未到，先记录）。

## 6. 常见过度设计反模式（映射本项目，警惕对象）

| 反模式 | 工业证据 | 本项目具体形态 |
|---|---|---|
| 过早采用 monorepo 工具链 | "需要前采用 Nx/Bazel = 付多年复杂性税"(birjob)；Bazel "wrong answer almost everywhere"(nx.dev) | 为 33 spec 引入 Nx affected —— 单扩展无包图可算 |
| 过早切分/过度分层 | "不必要的复杂架构"官方定义(architecture-antipatterns ★) | 为每个 ntp 模块建门面 —— 门面只应在跨层边界出现（storage/persist/sync-engine 已是，render/popups 再加即过度） |
| 测试流程仪式化 (testing fundamentalism) | "每个 PR 都要正式测试计划+多条新 E2E = 流程债务"(medium 2026-01) | 每个改动都要求新增浏览器 E2E spec；纯逻辑改动应等中段单元层（G6' 触发后），UI 行为改动才进 Playwright |
| 为不存在的高负载优化 | shards 是"规模化策略而非默认优化"(currents.dev) | 33 spec 上 shard 矩阵；为 20+ agent 预建协调基础设施（现实 1-3 agent 偶发并行） |
| 测试选择器静默漏测 | "静默跳过比慢更糟，制造虚假信心"(qaskills ★)；incomplete dump 禁用于选择(Testplane) | 未来若引入选择器必须双规则: 拿不准跑全量 + 失败 dump 禁用于选择 |
| 静态图/手写映射当万能药 | 静态 import 图抓不到运行时路径(testpick 一手) | "改了 render.js 就跑 conn spec"式手写映射，过期即静默漏测 —— 所以票 21 的映射表必须进断言 gate 防过期 |

## 7. 来源清单（atomcode；★=web_fetch 全文核验，◐=搜索/摘要片段级）

| # | 标题 | URL | 角度 | 贡献 |
|---|---|---|---|---|
| ★1 | Playwright Docs: Sharding | playwright.dev/docs/test-sharding | Official | shard/fullyParallel/blob 合并/GH 矩阵一手 |
| ★2 | Playwright Docs: Chrome extensions | playwright.dev/docs/chrome-extensions | Official | 扩展测试唯一官方路径: persistent context + --load-extension；MV3 SW 挂起恢复 |
| ★3 | Optimizing Test Runtime: Sharding vs. Workers | currents.dev/posts/optimizing-test-runtime-playwright-sharding-vs-workers | Comparative (2025-12) | workers/shards 决策矩阵、100-800 甜点、4 核 2-4 workers 区间 |
| ★4 | Orchestrating 20+ Parallel AI Agents | tianpan.co/forum/t/.../726 | Community (2026-02) | 冲突率 15-25% 实测、CI 4x 容量、预合并轻量门 |
| ◐5 | Run multiple coding agents in parallel | auravcs.com/learn/run-multiple-coding-agents-in-parallel | Community (2026-07) | worktree + zone-claim 正解方案（厂商自述，无第三方实测） |
| ◐6 | Stop parallelizing your AI agents | thedailydeveloper.substack.com | Criticism (2026) | 冲突面 N(N-1)/2、30-50% 时间耗在冲突 |
| ◐7 | Power and Peril of Multiple Simultaneous AI Agents | eqengineered.com | Community | worktree 社区主流、YOLO 权限危险 |
| ★8 | The Practical Test Pyramid | martinfowler.com/articles/practical-test-pyramid.html | Official (2018) | 按速度/范围分层、管道阶段 |
| ◐9 | Test Impact Analysis in CI | qaskills.sh/blog/test-impact-analysis-ci-guide-2026 | Currency (2026-07) | 四种 TIA 对比、静默跳过=虚假信心 |
| ★10 | testpick — coverage-based test selection | github.com/TwistTheoryGames/testpick | Community/Currency (2026-06) | 覆盖图 vs 静态图盲区实测、保守回退规则一手 |
| ◐11 | Testplane selectivity docs | testplane.dev | Official (2026) | 浏览器端选择性、CDP 依赖收集、incomplete dump 禁用规则 |
| ◐12 | blast-radius (incremental AST call graph) | github.com/brokenbartender/blast-radius | Community (2026) | symbol 级影响面、god-node 检测 |
| ◐13 | Monorepo Tools Compared | gazar.dev/devops/monorepo-tools-comparison-nx-turborepo-bazel-rush | Comparative (2026) | nx affected 生效条件、规模门槛 |
| ◐14 | Nx vs Bazel | nx.dev/docs/kb/nx-vs-bazel | Official | 强制级差异、选型指引 |
| ◐15 | Monorepo vs Polyrepo: Real Tradeoffs | birjob.com/blog/monorepo-polyrepo | Comparative (2026) | 过早采用 = 复杂性税 |
| ★16 | Antipattern: Over-Engineering | architecture-antipatterns.tech | Criticism | 过度工程定义: 过早为灵活性/可扩展性/高负载优化 |
| ◐17 | Not every change needs a formal test plan | medium.com/@ruwanta | Criticism (2026-01) | testing fundamentalism 判据 |
| ◐18 | Modular Monoliths with Logical Boundaries | softwareseni.com | Official | 依赖规则工具化（ArchUnit/NetArchTest/import-linter） |
| ◐19 | Playwright Browser Extension Testing | helpmetest.com (2026-05) | Currency | Firefox 实验性支持细节 |
| ◐20 | kzar/firefox-webext-playwright-harness | github.com/kzar | Community | Firefox 侧需 hack 的自述，佐证行业现状 |

**本地代码证据**（atomcode 读码 + 本窗口复核）: test/playwright.config.ts 与 quarantine.config.ts（workers/grepInvert/launch args）、test.yml 与 quarantine.yml（治理字段 grep）、package.json（test 脚本面）、ntp/ 八模块 wc 行数、浏览器 API 触点 grep 复核（§3.7）、AGENTS.md BX-EXPLORE（codegraph）、WORKFLOW §6（票01/05/14/15 教训）。

**Sufficiency Gate**（atomcode 自报）: searches 12（Exa 4 / Tavily 5 / AnySearch 3）| angles: Official/Comparative/Criticism/Currency/Community 五类全覆盖 | full reads 7 | 关键结论均 ≥2 独立信源交叉验证；本地断言 1 项被本窗口证伪并修正（§3.7）。

## 8. 信息缺口（诚实声明）

1. testpick/Testplane 对"纯 Playwright E2E 无单元层"项目无实证 —— 两源均面向 Jest/Vitest 生态；本报告的"暂不引入"判据是规模推断而非适配实证。若未来触发 G6'，需先自测 SourceMap 与浏览器内覆盖率收集成本。
2. Aura Crew 的 zone-claim 机制仅厂商自述，无独立第三方实测冲突率降幅；可信基准只有 tianpan 单点 15-25%。
3. Firefox 扩展 Playwright 支持仍处实验态（kzar harness 自述 hack）—— 行业缺口，项目侧接受现状。
4. "Nx 式包级图 vs codegraph 文件级图"在本仓库规模下的收益对比无数据（本地已有 codegraph，预期收益≈0，未实测验证）。
5. 1-3 个 agent 碰单扩展热点文件的系统性研究缺失 —— 现有文献聚焦 20-30 agent 大 monorepo；本报告的"少即是多"判断是外推。
6. 本窗口补充: atomcode 的本地"浏览器 API 触点"数据被证伪（§3.7）—— 已按实测修正结论方向（从"大面积审计"降为"一条 grep 断言"），但该证伪同时意味着 atomcode 报告其余本地断言均需谨慎对待，本报告仅采信经复核的两项（test.yml 字段缺位、模块行数）。

## 9. 完成定义对照（handoffs/19）

- [x] 报告落盘于 D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round4.md（本文件）。
- [x] 含对比矩阵（§2）、缺口/missing-piece 清单（§4）、唯一最终推荐 + 来源（§5/§7）、显式过度设计反模式清单（§6）。
- [x] 现有心智模型先于外部调研记录（§1，回应 issues/19 复选框 1）。
- [x] 恰一次串行 atomcode 调研（exit 0，25,505 字节答案已捕获并纳入 §2/§3/§5/§6/§7；无并行调用）。
- [x] 零源码改动（源码/manifest/测试均未触碰；本文件为唯一新增产物）。
- [x] 版本控制遵循 WORKFLOW §4.2（GitButler，独立票分支提交，不 push）。
