# 108 atomcode 深度调研 — 原始产出（逐字）

> 票: 108 / A-063 · 日期: 2026-09-15 · 载体: `atomcode --prompt-file .scratch/108-atomcode/prompt.md`（ctx_execute 包裹，串行，在途 1 次）
> 会话号（可 resume）: `7a9f0cdb-acfb-4794-993f-966637ef9565`
> 原始 stdout 日志（被 `.gitignore` 的 `*.log` 排除，故逐字留档于此）: `.scratch/108-atomcode/atomcode-raw.log`
> 调研问题全文: `.scratch/108-atomcode/prompt.md`
> 蒸馏结论见报告 `.scratch/architecture-recovery/reports/108-report.md` §1.1。

---
[headless] --dangerously-skip-permissions：所有工具调用将自动批准
[warning] 正在以管理员权限运行 — 模型可能可以访问系统文件。
我将按「research 技能 + 调研专精模式」执行：先召回知识库，再本地代码佐证，随后三引擎联网调研。先加载技能并检索知识库。知识库已命中关键本地上下文（A-062/A-063 决策台账、既有门禁先例、render.js 结构）。现在进入联网调研：三引擎、多角度检索「数据层单一写入口的静态/运行时防护」主题。继续定点深挖：抓取关键原文（Notion 棘轮、ESLint 官方、Immer/Object.freeze 运行时兜底、mutation testing）。继续定点深挖：运行时兜底（Immer/Redux 官方文档）与豁免审计（ESLint 官方 suppression 指令机制）。**Sufficiency Gate**: searches: 8+ | angles: Official / Comparative / Criticism / Currency / Community 全覆盖 | full reads: 6（Notion 棘轮博客、ESLint no-restricted-syntax 官方文档、Immer 官方文档、Redux Immutable Update Patterns、Mainmatter lttf 博客、Stryker 官方文档多页）| gaps: 「正则门禁噪音」缺少专门学术论文，以 Stryker/ESLint/Notion 的一手工程实践替代；tldraw Store 文档未直接读原文（结论不依赖它）。

---

# 调研报告：零依赖源码级静态检查如何阻止「数据层变更绕过唯一写入口」

## 执行摘要（Tl;dr）

**Confidence: 高**（结论基于官方文档 × 3、一线大厂工程博客 × 2、多引擎交叉验证，且与本仓库既有门禁先例同构）。纯 JS 零依赖仓库的工业成熟做法是**三层组合**：① 结构上把 layout 集合收进单一模块、用既有导入图门禁加一条「谁可以 import 谁」规则，让旁路在结构上不存在（(c)，首选，成本最低、漏报最少）；② 行级/正则扫描作为廉价补充，捕获结构层看不见的 `splice/push/=` 写操作，配具名豁免注释（(a)，覆盖剩余旁路如别名引用只能靠运行时兜底）；③ `Object.freeze` 运行时兜底（(b) 的零依赖形态），把漏网变异变成开发期硬错误。存量违规用**基线冻结 + 棘轮**（Notion 同款），不用一次性大修。门禁本身必须配**负向自测**证明「有牙齿」（Stryker 的 mutant 思想：故意注入违规，门禁必须 exit 非 0）。

---

## 第 1 问：三种工业成熟做法对比

### 对比矩阵

| 方案 | 能捕获 | 必然漏掉 | 误报率 | 本仓库落地成本 |
|---|---|---|---|---|
| (a) 正则/行级扫描 + 具名豁免 | `boxes.splice()`、`layout.connections.length = 0`、`obj.push()` 等字面写操作 | 别名引用（`const a = obj.arr; a.splice()`）、解构、属性动态计算名、跨行拼接 | 中高（注释/字符串/合法读操作误伤） | 极低：一个 `scripts/*.mjs`，复用 import-graph-guard 模式 |
| (b) Proxy / Object.freeze 运行时兜底 | **一切**变异路径，包括别名、Reflect、未来新写法（运行时真实发生才拦截） | 拦截点之外新建的副本上的变异；生产环境若关闭兜底则完全不设防（开发期能抓到） | 极低（真实变异才报错） | 低：零依赖 `Object.freeze` 可用；完整 Proxy 需手写约百行 |
| (c) 模块边界 + 导入图门禁 | 结构性旁路：`state.js` 不导出可变句柄给非 handler 模块，则旁路代码**写不出来** | 同模块内的旁路；handler 文件自身的非法写；导出后仍被别名传播 | 极低（规则是「能否 import」而非「代码长什么样」） | 极低：已有 `scripts/import-graph-guard.mjs`，加一条边规则即可 |

**推荐：组合 (c) + (a) + (b)，分工明确。**

- **(c) 是主防线**（结构性消灭旁路）：把 `layout` 集合的持有权收紧——只有 `render.js`（mutationHandlers 所在模块）可以拿到可变引用；`popups.js` 等消费方只 import 选择器/只读快照。然后在 import-graph-guard 里加一条规则：`render.js` 之外禁止 import 持有可变 layout 的模块导出。这是 dependency-cruiser（sverweij/dependency-cruiser，GitHub，2016–持续维护；官方 rules-reference.md）和 Nx `enforce-module-boundaries`（Nx 官方文档，nx.dev/docs/kb/enforce-module-boundaries）的通用模式——「架构即测试」（architecture fitness function，Xebia 博客 2023）。**社区共识（Atomic Object、dev.to 等二手观点一致）**：边界规则的价值在于让新开发者不读文档也知道规则存在。
- **(a) 是次防线**（捕获结构层看不见的字面写法）：同模块内、以及经合法 import 拿到引用后的 `splice/push/直接赋值`，结构门禁无能为力，行级扫描补上。这正是本仓库 A-063 决策台账已经定的方向。
- **(b) 是兜底**（捕获前两者都漏掉的别名/间接引用）：ESLint 官方生态对「不能静态判定」的场景的标准答案是运行时兜底——Redux 官方文档《Immutable Update Patterns》（redux.js.org，2019/持续更新）明确说 reducer 直接变异「只能靠约定 + 运行时检测」；Immer 官方文档（immerjs.github.io）的核心卖点之一就是「Immer will detect accidental mutations and throw an error」。**零依赖版**：`commit` 入口处对 `layout.boxes/connections/_meta.deleted` 及每个 box 的 `children/bookmarks` 做 `Object.freeze`（开发/测试构建），任何 handler 外变异在 dev 加载时直接 TypeError，P0 故障从「静默数据丢失」降级为「开发期即崩」。注意 Chrome MV3 里 deep-freeze 全量 layout 有性能成本，建议只在 dev 构建 + Playwright 测试环境开启，生产不冻结（Immer 默认 `autoFreeze` 在生产关闭是同一权衡，Immer 官方文档）。

单选其一的话：**纯现状下 (a) 最快见效但必然漏别名；(c) 治本但本次 P0 是「同模块内合法 import 后的 splice」，结构层抓不到**。所以三者是互补而非三选一。

---

## 第 2 问：廉价门禁（正则/行级）的已知失败模式与对策

### 2.1 门禁噪音 → 被绕过或被放宽

**官方文档事实**：ESLint 官方对「警告泛滥」的制度性回应是 `--report-unused-disable-directives`（ESLint v8.56.0 release notes，2023-12，eslint.org/blog）及后续默认开启的演进（eslint/rfcs#100，2022–2023）——即**豁免必须是「被使用且具名」的，未使用的豁免指令本身报错**。这直接回应了「豁免腐化」。

**一线工程证据**：Notion 工程博客（"How we evolve code: Notion's ratcheting system"，notion.com/blog，2025-03）明确指出：**ESLint warnings 会被开发者忽略并堆积成噪音，真正的问题被淹没**。Notion 的对策是「只允许 error 存在，被棘轮系统批准的降级为 warning，其余 error 直接阻断合并」。可迁移到本仓库的规则：门禁**只输出阻断性 violation**，不输出 warning 级别；每个豁免必须「当前正在豁免一个真实存在的东西」，否则视为死豁免并报错——这与 ESLint 的 unused-directive 思想同构，且零依赖可实现（豁免注释 ↔ 实际违规做集合差运算）。

**避免误报的具体手段**（源自上述实践的归纳，属工程共识）：
1. 规则从窄到宽：先只禁 `boxes.splice` / `boxes.push` / `boxes[` 这类高置信模式，跑两周看误报，再扩到通配写操作。Mainmatter《Lint to the Future 流程》（mainmatter.com/blog，2025-03）的核心教训：**一次性对 6k 文件启用宽规则 = 灾难**，必须窄起步、分批烧图。
2. 误报不许「放宽断言」换绿（团队已有此规矩），只能二选一：修代码，或加具名豁免。这正是 Notion 「require approval when they increase violation counts」的本地化。

### 2.2 豁免形态对比：注释 vs 集中清单 vs 基线文件

| 形态 | 审计链 | 腐化风险 | 代表实践 |
|---|---|---|---|
| 行内注释标记（如 `// MUTATION-EXEMPT(jira-id/reason)`） | git blame 可直接定位到人和理由；豁免与违规**物理同址**，不漂移 | 散落各处、无总量视图；无人再看的豁免永久滞留 | ESLint disable 指令生态（官方）；Stryker 的行级 ignore 注释（stryker-mutator.io 文档） |
| 集中清单（`gate-exemptions.json`） | 一处 review、一处统计总量 | 清单与代码漂移：违规被移走后清单条目变孤儿 | 依赖主裁：ESLint RFC #15466 结论就是「行内指令是 blind spot」，倾向集中化 + 自动报孤儿 |
| 基线文件（棘轮） | 按 文件+规则 记数，只许减不许增 | 合并冲突（Notion 用 TSV 逐行原子化解决）；文件移动需同步改路径 | Notion ratchet（2025）；Lint to the Future（Mainmatter/mansona，开源） |

**推荐（本仓库规模，~15 模块）**：**行内具名豁免（必须带 `@ticket` 或 ledger ID + 理由）+ 门禁自报孤儿豁免**。集中清单在 15 个模块的规模下收益不足；棘轮适合豁免量大时再升级。防永久债务的两条硬规则（均有一手实践背书）：
- **孤儿豁免即违规**：豁免注释指向的行不再匹配违规模式 → exit 1（对应 ESLint `reportUnusedDisableDirectives: "error"`，官方 RFC #100 / v8.56.0 changelog）。
- **豁免带 TTL**：Notion 的棘轮数据进 Datadog/Notion 看板持续监控（官方博客原文），本仓库简化为：豁免注释必须含日期或 ledger ID，门禁输出中把所有活豁免打成一个清单随每次运行打印，进 code review 视野。Mainmatter 的 lttf dashboard（已全文阅读）证明「图表持续可见」本身就是烧债的驱动力。

### 2.3 别名/间接引用：静态判定的边界

这是正则门禁的**结构性硬伤**，工业处理分三档（Confidence 高，Immer/Redux 官方 + PR 实证）：
1. **静态层：明说抓不到，靠规则缩小别名产生面**。ESLint `no-restricted-syntax` 的 AST selector（官方文档已全文阅读）能抓 `CallExpression[callee.property.name='splice']` 但**不做数据流分析**，`const a = obj.arr` 后的 `a.splice()` 需要作用域+引用追踪，超出「廉价门禁」预算。缓解办法是规则化「不许把集合赋给新变量」——本身可以再写一条正则规则（`const\s+\w+\s*=\s*(layout\.\w+|box\.(children|bookmarks))`）。
2. **运行时层：冻结**。任何别名拿到的是同一个冻结对象，`a.splice()` 同样 TypeError（Object.freeze 冻结的是对象不是变量名）。这是对别名问题的**完备**回答——Immer 的 autoFreeze 和 Redux Toolkit 的默认 immutableCheck 都是这个机制的工业级应用（Redux Toolkit 讨论 #1189，2021，官方仓库：freezing 就是「为了防止意外变异，本质上是把你原有的 bug 显形」）。
3. **实证案例**：本文调研中检索到的真实 PR（oh-my-openagent #4133，2026-05）正是此模式的样本：Immer 冻结 `output.args` 后，**9 处变异点（含别名变异）全部被运行时审计测试枚举出来逐一修复**，并附带一条「audit test：正则 grep 全仓 `output.args.` 赋值 + `Object.assign`，_helper 外命中即 FAIL」——说明工业界对别名的现实答案是「冻结 + 审计测试组合」，而非更聪明的静态分析。

### 2.4 门禁自测（negative test / mutation test）的工业标准

**官方文档事实**：Stryker Mutator 官方文档（stryker-mutator.io/docs）定义的标准范式：**向被测对象注入变异 → 期望测试失败 → 失败即 "killed"，存活即测试无效**。「用 mutation testing 测试你的测试」（Stryker 官方博客 "Introduction to mutation testing"）。对门禁而言，「被测对象」是门禁脚本自身，mutant 是**注入的违规代码样本**。

**CI 阈值门禁的官方机制**：Stryker `thresholds.break`——分数低于阈值时 `stryker run` exit 非 0、CI 红灯（多个 2026 年一手教程均确认，qaskills.sh、loiane.com、oneuptime.com 三源一致）。本仓库零依赖版的等价物：

- `scripts/mutation-gate-selftest.mjs`（或并入现有 guard 的 `--selftest` 模式）：内置一组**固定样本文件对**（fixture），每个 fixture = 「一个必然违规的代码片段」+ 期望结果。门禁跑在 fixture 上，必须全部 exit 非 0（违规被抓住）；跑在合规样本上必须 exit 0（无误报）。任一 fixture 逃逸 → 自测 exit 非 0 → pretest 阻断。这与 import-graph-guard 已经有的 `test/cluster-map.json` 覆盖检查同构。
- **防「恒真门禁」的用例必须包括**：见第 4 问③。
- Notion 的对应实践：棘轮文件计数只许自动减少、增加需审批（官方博客原文）——本质是给门禁「不许被静默放松」上了锁；本仓库团队规矩「不得静默删除检查 / 不得放宽断言」应落在：**门禁脚本与 fixture 同一个 commit 内 review，fixture 删除或期望值放宽必须在 commit message 中具名说明**。

---

## 第 3 问：存量违规的工业标准处理

三个候选的一手证据：

| 方案 | 一手来源 | 结论 |
|---|---|---|
| 一次修完（big bang） | Mainmatter 2025 博客：明确反对对 6k 文件 `eslint --fix` 一次过——reviewer 认知负荷、回归风险、合并冲突（全文已读） | ❌ 反对（大规模时）；本仓库存量预计 <10 处，**小规模时例外，可一次修完** |
| 基线冻结 + 棘轮 | Notion 2025 官方博客（全文已读）：TSV ratchet file、修一处自动减一、增一需审批、Datadog 监控烧债曲线；开源版 eslint-seatbelt（github.com/justjake/eslint-seatbelt） | ✅ 工业标准，适合存量多、分布广的场景 |
| 逐条具名豁免 + 到期 | ESLint disable 指令生态 + `reportUnusedDisableDirectives`（官方）+ lttf 的 file-based ignore + dashboard | ✅ 适合存量少、可枚举的场景 |

**推荐：本仓库存量规模（popups.js 的 add L282/301、reorder L407 等个位数点位）→ 先一次修完（reorder 改走 handler，add 新增 handler），残余确实短期改不动的用「具名豁免 + ledger ID + 门禁打印活豁免清单」过渡，不引入完整棘轮**。理由：棘轮的运维成本（TSV 维护、合并冲突处理、监控看板）是给百文件级存量设计的；本仓库直接修完的成本低于棘轮基建成本。防债务腐化的保证机制照 2.2：孤儿豁免即违规 + 豁免必须带 ID/日期 + 每次运行打印全量活豁免。若未来豁免数失控（>5 条活豁免），再升级为 Notion 式 TSV 棘轮——升级路径已验证可行（eslint-seatbelt 开源实现可参考其 TSV 格式，社区项目）。

---

## 对本仓库的具体建议

### ① 门禁覆盖的操作与边界

**覆盖**（在 `ntp/**` 除 `render.js` 内 `mutationHandlers`/`commit` 定义区之外，匹配以下写模式）：
- `boxes.splice|push|pop|shift|unshift|sort|reverse|fill|copyWithin`、`connections.*`、`groups.*`、`_meta.deleted.*` 同类
- 对 `box.children` / `box.bookmarks` 的同上方法 + `bookmarks[...] =` / `children[...] =` 索引赋值 + `.length =` 赋值
- `Object.assign(layout.<集合>, ...)`、`delete layout.<集合>[...]`

**边界画法**：
- **白名单边界**：`render.js` 的 `mutationHandlers` 表内（handler 只改数据是设计约定，表内自由）；`test/**` 全域豁免（测试构造 fixture 需要直改）；`storage.js` 的序列化/清理路径若确需直改，具名豁免。
- **结构边界**（import-graph-guard 加一条）：持有可变 layout 导出的模块，其消费方集合收敛为白名单；`state.js`/`persist.js` 对外只暴露只读访问器。先跑 `codegraph impact` / `trace_callers commit` 确认现状消费面再定白名单（BX-EXPLORE-004）。
- **运行时边界**：dev/测试构建对 layout 树做 `Object.freeze`（浅冻结集合 + 各 box 的两个数组即可，不必深冻结全树）；生产不冻结。

### ② 豁免机制形态

```
// GATE-EXEMPT(mutation-gate): <ledger-ID 如 A-063> — <一句话理由> — <日期 YYYY-MM-DD>
<违规行>
```
硬规则：无 ID 或无理由 = 无效豁免 = 违规；豁免行不再匹配违规模式 = 孤儿豁免 = exit 1（对齐 ESLint `reportUnusedDisableDirectives` 思想）；每次门禁运行末尾打印「活豁免清单」进 stdout，随 PR diff 可见。

### ③ 负向自测必须包含的用例

每个用例 = fixture 片段 + 期望门禁结果，全部纳入 pretest（对齐 Stryker「测试你的测试」范式 + 本仓库已有 guard 自测先例）：
1. 正例（必须 exit 0）：handler 表内的 `boxes.splice`；`const list = [...box.bookmarks]` 后对新数组 splice（拷贝是合法的）；`box.bookmarks.map/filter/find` 等纯读。
2. 违规样本（必须全部被抓住，exit 非 0）：字面 `splice`/`push`；索引赋值；`.length =`；`Object.assign`；`delete`。
3. **别名逃逸样本（必须如实标注「门禁抓不到，靠 freeze 兜底」）**：`const a = box.bookmarks; a.splice(0,1)` —— 这条 fixture 的期望结果不是「门禁报错」，而是**进 freeze 运行时测试**：Playwright 或 node 测试里对冻结 layout 执行该片段必须 TypeError。别让负向自测假装它有它没有的能力——这正是「门禁漏报清单」制度化。
4. **自测必须含一个「恒真探针」**：一个故意构造的、旧版本门禁曾漏掉（后来修过）的违规样本，永久保留——它死了（门禁回归放行）自测就红。
5. 豁免机制用例：具名豁免被命中时不报违规；孤儿豁免报违规；无理由豁免报违规。

### ④ 存量合规点处置

1. 盘点全量命中点（`grep -c` 级别的产出即可，预计个位数），按「改走 handler 的改造成本」排序：reorder 的先删后插改为**一个 `reorderBookmarks` handler**（payload: boxId + from/to 或新数组），add 书签改为 `addBookmark` handler——两者都是 handler 表加一行 + tombstone/persist 语义沿用 `commit` 现有管线，成本低于豁免。
2. 修完后门禁以**零活豁免**上线（存量一次清零，符合第 3 问结论）；若个别点位确需过渡期，具名豁免挂 ledger ID，两周后复查烧掉。
3. 门禁挂进 pretest（与 import-graph-guard、migration-golden-guard 并列），fixture 自测同 commit 落地；改门禁脚本的 commit 必须 message 具名（团队规矩「不得静默删除检查」的执行载体）。
4. 完成后按 BX-EXPLORE-003 跑 `codegraph sync`，并按 CRX-R-013 走 GitButler 提交持久化。

---

## 完整来源清单

| # | 标题 / 项目 | URL | 角度 | 贡献 |
|---|---|---|---|---|
| 1 | Notion: ratcheting system with custom ESLint rules（官方博客，2025-03，**全文已读**） | notion.com/blog/how-we-evolved-our-code-notions-ratcheting-system… | Official/Currency | 棘轮机制全貌：TSV 基线、warnings 是噪音、孤儿计数治理、监控防债 |
| 2 | ESLint `no-restricted-syntax` 官方文档（**全文已读**） | eslint.org/docs/latest/rules/no-restricted-syntax | Official | AST selector 能力边界（不做数据流分析）的官方事实 |
| 3 | ESLint v8.56.0 release notes + RFC #100/#15466（2021–2023） | eslint.org/blog/2023/12/eslint-v8.56.0-released/ | Official | 豁免指令审计机制（unused disable directives）的官方演进 |
| 4 | Immer 官方文档（**全文已读**） | immerjs.github.io/immer/ | Official | 运行时冻结/检测意外变异的官方机制与生产权衡 |
| 5 | Redux《Immutable Update Patterns》（官方文档，**tavily 全文提取**） | redux.js.org/usage/structuring-reducers/immutable-update-patterns | Official | 直接变异只能靠约定+运行时检测的官方立场 |
| 6 | Stryker Mutator 官方文档/博客（docs + introduction 博文） | stryker-mutator.io/docs | Official | mutation testing 定义、thresholds.break CI 门禁机制 |
| 7 | dependency-cruiser（官方 README + rules-reference，sverweij，2016–持续） | github.com/sverweij/dependency-cruiser | Official | 模块边界规则引擎的工业参照 |
| 8 | Nx enforce-module-boundaries（官方文档，2026 更新） | nx.dev/docs/kb/enforce-module-boundaries | Official | 边界规则官方实现第二例 |
| 9 | Mainmatter: Lint to the Future（2025-03，**全文已读**） | mainmatter.com/blog/2025/03/03/lttf-process/ | Criticism/Community | 廉价门禁噪音/大爆炸迁移的反面教训；file-ignore + dashboard 实践 |
| 10 | Xebia: Taking Frontend Architecture Serious（2023） | xebia.com/blog/taking-frontend-architecture-serious… | Community | dependency-cruiser vs eslint 编辑器反馈权衡（二手对比观点） |
| 11 | oh-my-openagent PR #4133（2026-05，检索命中全文） | github.com/code-yeongyu/oh-my-openagent/pull/4133 | Community/实证 | 冻结 + 审计测试捕获别名变异的真实工业案例（9 变异点枚举修复） |
| 12 | eslint-seatbelt（Notion 棘轮开源版） | github.com/justjake/eslint-seatbelt | Currency | 棘轮基线文件格式的可参考开源实现 |
| 13 | 本仓库决策台账 A-062/A-063、scripts/import-graph-guard.mjs、render.js（ctx_search 本地召回） | 本地 | Local | 既有门禁模式、P0 故障事实、方案落点 |

## 信息缺口

1. 「正则门禁误报率/噪音治理」没有找到专门学术论文或系统化实证研究，以上以一线工程实践（Notion/Mainmatter/ESLint 生态）替代；若需要量化误报率，只能本仓库自己积累数据。
2. tldraw Store 的 put/remove 官方文档未直接读原文（本结论不依赖 tldraw 特性，但若要引用其 API 契约需另行核验）。
3. `Object.freeze` 在 10MB 级 storage.local 布局树上的冻结耗时无公开 benchmark；建议实现时先测（dev-only 开启可规避此风险）。
4. 行内豁免注释 vs 集中清单在**小团队**场景的对比研究未见一手来源，2.2 表中的规模判断是工程推断而非实证结论。

继续此会话，运行：atomcode -p "…" --resume 7a9f0cdb-acfb-4794-993f-966637ef9565
