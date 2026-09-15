# 108 报告 — layout 旁路静态门禁（A-063 · 含 109R / 113R 返工）

> 票: **108** · covers **A-063** · 启动器 `.scratch/architecture-recovery/prompts/108-layout-bypass-static-gate.md`
> Blocked by: **107**（W1 复核已判 done，依赖已解除）· 波次: Wave9.20 W2 frontier · 目标发行版本 **2026.9.20**
> 日期: 2026-09-15 · 版本控制: WORKFLOW §4.2（GitButler `but`；不 push、不开 PR、不 tag）
> 分支: `ticket/108-layout-bypass-static-gate`
> 改动面: 新增门禁脚本 + 覆盖 spec；`ntp/**` 一处架构修复 + 九处具名白名单注释；`package.json` pretest / `test.yml` lane / `cluster-map.json` / `docs/CONTEXT.md` / `docs/release-status.md`

---

## 0. 开工复述（启动器「开工第一句」四项）

### ① 阻塞 / 被阻塞关系

| 关系 | 内容 |
|---|---|
| **Blocked by 107** | A-062（`deleteBookmark` 走 `commit` + 墓碑）。W1 首脑复核实物证据判 **done**：`ntp/render.js:172` `deleteBookmark` 返回 `tombstoneIds`；`ntp/popups.js` 删除按钮走 `commit`；裸 `bookmarks.splice(index,1)` 已不存在；回归 spec 242 行；commit `1a7d572e`。**依赖解除，可开工** |
| **本票阻塞谁** | 无下游票。但 A-063 是 spec 目标版本 2026.9.20 的 G-A 前置（pretest 七守卫全绿）之一 |
| **本票覆盖** | A-063（主）+ **109R** + **113R**（W1 复核返工） |
| **波次定位** | W1 复核判 108 = W2 frontier；`issue status: ready-for-agent`；A-063 = `current` |

### ② 必读清单存在性（8/8 全部存在，已逐字读完）

| # | 路径 | 核验 |
|---|---|---|
| 1 | `.scratch/architecture-recovery/handoffs/108-layout-bypass-static-gate-handoff.md` | 1831 B / 59 行 |
| 2 | `.scratch/architecture-recovery/issues/108-layout-bypass-static-gate.md` | 629 B / 24 行 |
| 3 | `.scratch/architecture-recovery/spec.md` | 2397 B / 65 行 |
| 4 | `.scratch/architecture-recovery/WORKFLOW.md`（§4.2 / §4.3 / §4.4） | 36915 B / 186 行 |
| 5 | `docs/adr/0017-release-data-gate.md` | 13483 B / 115 行（含 09-15 G-C 升格修订） |
| 6 | `docs/CONTEXT.md` | 33981 B / 183 行 |
| 7 | `.scratch/architecture-recovery/decision-ledger.md`（A-062 节） | 32155 B / 163 行 |
| 8 | `.scratch/architecture-recovery/reports/W920-W1-brain-review.md` | 5706 B / 88 行 |

handoff 自身「必读」表另列 `.scratch/wave9-920-grill/decision-ledger.md`（D-001..D-008）与 `plan.md`，已一并纳入。注：`prompts/107-*.md` 不存在属正常（107 已 done，启动器已归档）。

### ③ handoff 内通用调研三项

1. **atomcode 深度调研**（串行，一次一个）——见 §1.1。
2. **回顾 `docs/adr` 与 `docs/CONTEXT.md` 现有心智模型**，冲突不得静默改向——见 §1.2。
3. **对标工业级实现 / 测试策略**——见 §1.3。

### ④ 109R / 113R 两道返工（开工前均已实测确认）

| 项 | 开工前实测（复现） | 根因 | 目标 |
|---|---|---|---|
| **109R** | `node scripts/import-graph-guard.mjs` → **exit 1**，`CM-1: spec is not covered by any cluster: boxing-pages-gc-version.spec.ts` | 票 109 新增 spec 未入 `test/cluster-map.json` | 补 cluster → exit 0 |
| **113R** | `node scripts/locale-readme-guard.mjs` → **exit 1**，`BLOCK BX-LOCALE-006 README.md store_published 2026.9.15 != docs/release-status.md published 2026.9.12` | `docs/release-status.md` §二「上一已发布版本」仍为 2026.9.12（写于 9.12 为最新时） | 对齐 **2026.9.15** → exit 0（**不得静默改 guard 基线**） |

**完成门**：pretest 七守卫（含 import-graph + locale-readme）全绿。

---

## 1. 调研摘要（写在实现之前）

### 1.1 atomcode 深度调研（结论优先）

调研问题：在**没有 AST / 没有 lint 框架**的纯 JavaScript 仓库里，如何用零依赖源码级静态检查阻止「数据集合变更绕过唯一写入口」，以及廉价门禁的失败模式、豁免机制形态、存量违规处置。
载体：`ctx_execute` 包裹 `atomcode --prompt-file`（WORKFLOW §4.3：联网调研只经 ctx 包裹的 atomcode，串行；本次会话在途 1 次）。提示词落盘 `.scratch/108-atomcode/prompt.md`；原始产出 `.scratch/108-atomcode/atomcode-raw.log`；会话号 `7a9f0cdb-acfb-4794-993f-966637ef9565`（可 resume）。
Confidence：**高**（13 条来源，其中 6 条官方文档全文/摘要核验 + 本仓一手代码）。

- **结论一（方案组合）**：三种工业做法互补而非三选一——**(c) 模块边界/导入图门禁**（结构性消灭旁路，dependency-cruiser、Nx `enforce-module-boundaries` 同构，即「架构即测试」）为主防线；**(a) 行级/正则扫描 + 具名豁免**为次防线（捕获同模块内及经合法 import 后的字面写操作）；**(b) 运行时冻结/Proxy 兜底**（Redux《Immutable Update Patterns》官方立场：直接变异只能靠约定 + 运行时检测；Immer 以「检测意外变异并抛错」为核心卖点）捕获前两者都漏掉的别名/间接引用。**推荐组合 (c)+(a)+(b)，分工明确**。
  *对本票的映射*：本次落地 (a)（本票 AC 所指），(b)/(c) 列为具名建议（见 §4 N-108-02 / N-108-03）。
- **结论二（门禁噪音与豁免腐化）**：ESLint 官方对警告泛滥的制度性回应是 `--report-unused-disable-directives`（v8.56.0，2023-12）——**豁免必须「被使用且具名」，未使用的豁免指令本身报错**；Notion 工程博客（2025-03，ratcheting system）明确 warnings 会堆积成噪音，对策是「只允许 error 存在 + 豁免增一需审批」。**可迁移规则**：门禁只输出阻断性 violation；每个豁免必须当前正在豁免一个真实站点，否则视为孤儿豁免并报错。
  *对本票的映射*：**LB-3「未用豁免即红」** 与 **豁免必须具名 + 理由 ≥ 12 字符**直接实现该结论；**活豁免清单每次运行打印到 stdout**（CI 日志/PR diff 可见）。
- **结论三（避免误报）**：规则须**从窄到宽**（Mainmatter「Lint to the Future」2025-03：一次性对 6k 文件启用宽规则 = 灾难）；误报不许「放宽断言」换绿，只能二选一：修代码 或 加具名豁免。
  *对本票的映射*：本票只覆盖**布局集合**这一个接收面（非全仓写操作），且实施中发现并修掉两类自身误报（见 §3.2）。
- **结论四（存量违规处置）**：工业标准是「存量多、分布广 → 基线冻结 + 棘轮（Notion TSV / eslint-seatbelt）；存量少、可枚举 → 逐条具名豁免 + 到期」。本仓库存量实测为**个位数**，故推荐「**能改走 handler 的先改完**，残余确实改不动的用具名豁免 + ledger ID 过渡，不引入完整棘轮」。
  *对本票的映射*：唯一真实删除类旁路（书签拖拽重排）**改走 handler 修完**；九处非 handler 归属的合法改写以具名注释豁免。
- **结论五（负向自测）**：门禁必须有**负向自测**证明「有牙齿」（Stryker mutation testing 思想：故意注入违规，门禁必须 exit 非 0）；且负向自测**不得假装门禁有它没有的能力**——别名逃逸样本应如实标注「门禁抓不到，靠运行时冻结兜底」。
  *对本票的映射*：`--self-test` 18 例（含故意旁路、别名逃逸、无具名豁免、孤儿豁免、标记缺失 fail-closed）；**别名逃逸的限制在 §4 N-108-03 具名披露**，未伪装成已覆盖。
- **信息缺口（调研自述，照录）**：① 「正则门禁误报率」无专门学术研究，只能本仓自积累；② tldraw Store 官方文档未读原文；③ `Object.freeze` 在 10MB 级布局树上的冻结耗时无公开 benchmark；④ 行内豁免 vs 集中清单在小团队场景无一手对比研究。

### 1.2 回顾 docs/adr 与 docs/CONTEXT.md（冲突呈报）

| 文件 | 现有心智模型 | 与本票关系 | 是否记 `revised` |
|---|---|---|---|
| `docs/CONTEXT.md` Mutation API (ADR-0007) | `commit(op,payload,opts)` 是唯一变更入口；ops 清单列举 6 项 | **本票是它的执行载体**：门禁把「唯一入口」从文档约定变为机器可验；新增 `reorderBookmarks` 后 op 清单同步 | **否**（无冲突，是补强） |
| `docs/adr/0017-release-data-gate.md` | 三门合取；G-A 残红 N/B/F 分桶；数据完整性 never-quarantine 永不豁免 | 本票属 A-063（静态门禁），**未宣称三门达成、未代签 G-B、未 push/tag** | **否** |
| ADR-0007 Q2 | 「统一 commit(op) + 模块化 handler —— 全部 6 条路径路由到一个入口」 | 本票把该决策升级为**可执行门禁**；`popups.js` 重排是第 7 条路径的补录 | **否**（强化既有决策） |
| `docs/CONTEXT.md` BX-EXPLORE-014 | storage 写链是单一持久面 | 九处豁免中的 `storage-facade-merge*` 两处正是该约定的落点 | **否** |

**呈报结论：本票未发现需记 `revised` 的静默改向。**

### 1.3 工业对标（实现 / 测试策略）

- **实现对标**：门禁形态对齐本仓既有 `import-graph-guard.mjs`（自写解析 + 白名单 + JSON 输出 + exit 非 0 即阻断）与 `calver-guard.mjs`（负向自检 `--self-test`）；豁免形态对齐 ESLint disable 指令生态（行内、与违规物理同址、git blame 可定位）而非集中清单（清单易漂移出孤儿条目）。
- **测试对标**：分层 —— ① 门禁脚本内 `--self-test` 离线负向用例（不依赖浏览器）；② Playwright 离线契约断言 spec（对齐票 109 的 `boxing-pages-gc-version.spec.ts` 模式）；③ 接线断言（pretest 链 + CI lane）。网络/外部依赖一律不进常规 lane。

---

## 2. AC 对照

### 2.1 本票 AC（issue 108 / handoff delta）

| # | AC | 状态 | 落地位置 | 锚点 |
|---|---|---|---|---|
| 1 | 扫描 ntp/** 删除类调用 | ✅ | `scripts/layout-bypass-guard.mjs` LB-1：`splice` / `pop` / `shift` / `unshift`；接收面 = `layout.boxes` / `layout.connections` / `layout.groups` / `layout._meta.deleted` / `state.boxes` / `state.connections` / `<ident>.children` / `<ident>.bookmarks` + 别名（4 轮不动点） | 扫描 15 模块 / 8541 行；`allowedInHandlers: 9` |
| 2 | 白名单注释豁免具名 | ✅ | 语法 `// layout-bypass-allow: <name> - <reason>`（同行或紧邻上一行）；`<name>` 须匹配 `[a-z0-9][a-z0-9._-]*`，`<reason>` ≥ 12 字符；**不支持模块级一把梭豁免**（防止豁免面被静默扩大）；**LB-3 孤儿豁免即红**（棘轮） | 9 条活豁免，每次运行打印清单 |
| 3 | 故意旁路 exit 1 | ✅ | `--self-test` **18/18 PASS**，含：书签删除旁路、**别名旁路**（`const bms = sb.bookmarks; bms.splice`）、墓碑删除、成员改写、索引赋值、`Object.assign`、`length=0`；反向用例（handler 内变异合法 / 归一化护栏合法 / DOM `.children` 非布局集合 / 具名豁免生效 / **无名豁免不生效** / **孤儿豁免红** / **标记缺失 fail-closed**） | `node scripts/layout-bypass-guard.mjs --self-test` → exit 0 |
| 4 | 接入 pretest 或 test.yml 并记录 lane | ✅ | ① `package.json` pretest 链**第 2 位**（紧随 import-graph-guard）：`import-graph → layout-bypass → migration-golden → css-balance → contrast → calver → onboarding → locale-readme`（**八门**）；② `.github/workflows/test.yml` 新增显式步骤 `Layout bypass guard (ticket 108 / A-063)`（紧随 Contrast guard，Run tests 之前），与票 102/112 的「pretest + 显式 CI 步骤」双落点惯例一致。**lane 记录 = 主 lane `test` job（三 OS）的 pretest 链 + 显式步骤**；data-golden job 不涉及 | `npm run pretest` → exit 0 |

### 2.2 专属验收（启动器「专属验收」行）

| 项 | 状态 | 证据 |
|---|---|---|
| 静态门禁：layout 旁路不得绕过 mutationHandlers | ✅ | 门禁 exit 0（零违规）；唯一真实删除类旁路已修（§2.3）；负向自测证明有牙齿 |

### 2.3 A-063 收编裁定（D-002④ / A-062「add/reorder 裁定不同票收编→票 108」）

开工实测：`ntp/**` 中**删除类**旁路仅剩 **1 处** —— `ntp/popups.js:411` 书签拖拽重排 `bms.splice(dragIdx, 1); bms.splice(targetIdx, 0, item);`（`bms` 为 `sb.bookmarks` 别名）。

| 项 | 裁定 | 理由 |
|---|---|---|
| **reorder** | **本票修完**：新增 `mutationHandlers.reorderBookmarks`（净中性的先删后插，不返回 tombstoneIds），`popups.js` 改走 `commit("reorderBookmarks", …, { save: true })` | ① D-002 负向需求「禁止绕过 commit 继续旁路删除」；② 若豁免它，门禁就等于豁免了它自己存在的理由；③ 调研结论四「能改走 handler 的先改完」；④ 改动仅「handler 加一段 + 调用点换一行」，零行为差异（重排结果与 save 时机逐字等价，仍保留 BX-DEV-111k 的局部重绘不重建整面） |
| **add（push）** | **本票不实施，具名残留 N-108-01** | ① 本票 AC 字面为「**删除类**调用」，`push` 既非删除也非改写，不在 LB-1/LB-2 判定面；② 调研建议补 `addBookmark` handler，但同一形态在 `render.js` 的 `addLargeBox`/`addLargeBoxAt`/`addSmallBox`/`addSmallBoxAt` 也有 4 处 `layout.boxes.push` / `lb.children.push`，一并收编是**波级改动**（新增 4 个 handler + 触及创建路径的全部 e2e），不适合在门禁票内夹带 |

---

## 3. 实测锚点（可复现命令）

### 3.1 完成门与回归

| 项 | 命令 | 结果 |
|---|---|---|
| pretest 全链（八门） | `npm run pretest` | **exit 0**；import-graph `ok:true` / layout-bypass `ok:true`（9 allowed / 9 exempted / 0 violations）/ migration-golden `28/28` / css-balance `OK` / contrast `8/8 PASS` / calver `exit 0`（8 面一致）/ onboarding `OK 7/7, 49 specs` / locale-readme `13 locales, 0 blocking` |
| 门禁本体 | `node scripts/layout-bypass-guard.mjs` | **exit 0**（15 模块 / 8541 行 / 0 违规 / 9 活豁免） |
| 门禁负向自测 | `node scripts/layout-bypass-guard.mjs --self-test` | **exit 0 · 18/18 PASS** |
| 109R 门 | `node scripts/import-graph-guard.mjs` | **exit 0**（`ok:true, violations:[]`，原 CM-1 消失） |
| 113R 门 | `node scripts/locale-readme-guard.mjs` | **exit 0**（`store_published baseline 2026.9.15; 0 blocking`，原 BX-LOCALE-006 消失） |
| 113R 门自测未被弱化 | `node scripts/locale-readme-guard.mjs --self-test` | **self-test PASS**（含 `BX-LOCALE-006 mismatch detected` 反向用例仍在） |
| 语法 | `node --check ntp/*.js scripts/layout-bypass-guard.mjs` | 16/16 OK |
| **全量 e2e** | `npm run test:all -- --reporter=line` | **639 passed / 5 skipped / 0 failed · exit 0**（5.4m，644 例，双车道） |
| 新 spec（双车道） | `npx playwright test --config=test/playwright.config.ts test/tests/boxing-layout-bypass-gate.spec.ts` | **10 passed (4.4s)**（5 例 × chromium + firefox） |
| 空白/CRLF | `git diff --check` | 本票改动面零告警（仅 `.scratch/spec.md`、`.scratch/decision-ledger.md` 两处**他人窗口**存量告警，非本票引入） |
| 文件完整性 | BOM / CRLF 检查 | 本票全部改动文件 `BOM=false` `CRLF=false`（纯 LF，UTF-8 无 BOM） |

### 3.2 实施中发现并修掉的两类自身误报（自查记录）

门禁初版（原型）在真实代码上产生 25 条违规，其中 14 条为误报。两类根因均已定位并修复，且各自成为永久负向用例：

| # | 误报形态 | 根因 | 修复 | 永久用例 |
|---|---|---|---|---|
| 1 | `const others = (lb.children || []).filter(...)` 被登记为「布局集合别名」，导致 `others` 的每次赋值被误判 | 别名识别时把**任意位置**的 `|| []` 当作空数组回退并截断 RHS，于是 `(lb.children` 被误认为接收面 | 只剥离**尾部** `|| []` | `alias whose RHS is a || [] fallback is NOT a layout alias` |
| 2 | `const bms = sb.bookmarks, item = bms[0];` 这行**声明**被误判为「改写」 | 赋值规则未区分「声明初始化」与「重新赋值」 | 新增 `isDeclarationOf()` 守卫（前置 `const/let/var/,` 即跳过） | 已由别名旁路用例与 `index assignment` 用例共同锁定 |

### 3.3 门禁设计要点（供复核）

- **allow-region 由标记定位，缺失即 fail-closed**：`ntp/render.js` 的 `mutationHandlers` 对象字面量与 `commit()` 函数体是唯一免注释合法区；标记（`export const mutationHandlers = {` / `export function commit(`）任缺一 → `LB-0` 违规。防「把允许区标记悄悄删掉 = 门禁恒真」。
- **归一化护栏按模式排除**（`X = X || []`、`!Array.isArray(X)` 下的 `X = []`）：语义上无法删除或重排成员；这是**结构性排除**而非注释豁免，已在脚本头部文档化。
- **别名追踪为文件级 4 轮不动点**：能抓 `const bms = sb.bookmarks` 这类同文件别名（这正是票 107 事故的形态）；**跨函数/跨文件/重绑定传播抓不到** —— 该限制具名披露（N-108-03）。
- **零依赖、零反斜杠陷阱**：脚本按仓库惯例用 `String.fromCharCode(10)` 等构造，字符类避免未转义 `]`（实现中曾踩到 `[^]]` 语义歧义，已修为 `[^\]]` 并加负向用例）。

---

## 4. 具名 F / N（不静默）

| ID | 类型 | 内容 | 处置 |
|---|---|---|---|
| **N-108-01** | N（具名残留） | **书签新增（`push`）未走 handler**：`ntp/popups.js` 两处 `sb.bookmarks.push({...})`（点击按钮 + Enter 键路径）。属 **add 类**，不在本票 AC（删除类）与门禁 LB-1/LB-2 判定面 | 本票裁定不同票收编（§2.3）。**建议立票**：新增 `addBookmark` handler；若同票一并收编 `render.js` 的 4 处创建路径 `push`（`addLargeBox`/`addLargeBoxAt`/`addSmallBox`/`addSmallBoxAt`），并把门禁扩展到 add 类（`push`/`unshift`）。**到期条件**：2026.9.20 波次 G-A 之前由大脑裁定是否立票 |
| **N-108-02** | N（具名建议） | **模块边界（调研方案 c）未落地**：门禁当前为「行级扫描（a）」，9 条活豁免中多数本可由「只允许 `render.js` 持有可变 layout 引用」的结构约束消灭。dependency-cruiser / Nx `enforce-module-boundaries` 同构做法 | 不在本票 AC（且属 import-graph-guard 的规则面，跨票）。**建议**：后续票在 `import-graph-guard.mjs` 增设「可变 layout 句柄的消费方白名单」规则，目标是把活豁免降到 0（调研结论四「零活豁免上线」的更强形态） |
| **N-108-03** | N（能力边界，如实披露） | **别名/间接引用逃逸**：门禁只追踪**文件内**别名（4 轮不动点）。跨函数返回、跨模块导出、重绑定等形态**抓不到** —— 调研结论一指出这类只能靠运行时冻结兜底 | **不伪装成已覆盖**（负向自测不写假用例）。**建议**：后续票在 dev/test 构建对 `layout.boxes`/`connections`/`_meta.deleted` 及每个 box 的 `children`/`bookmarks` 做 `Object.freeze`（浅冻结集合 + 两个数组即可），生产不冻结（Immer `autoFreeze` 同款权衡）；调研已标注「冻结耗时无公开 benchmark，实现前先测」 |
| **N-108-04** | N（观察，非本票面） | `npm run pretest` 中 calver-guard 输出**非阻断**告警：`WARN BX-CALVER-W docs/publishing-guide.md 提到非当前版本号 2026.9.12（当前 2026.9.20）` | 该文件属**票 116** 的伴随面（`MM` 在途，非本票改动）。本票**不越界修改**，仅具名上报供大脑裁决 |
| **N-108-06** | N（观察，邻域） | `docs/release-status.md` §二「目标发行版本」仍为 **2026.9.15**，而票 116 已把版本面推至 2026.9.20（`manifest.json`/`package.json` 均为 2026.9.20）—— 该页的快照停在其「最后核验 2026-09-14」时点 | **本票不修**：该行与 §三「三门状态（页内唯一现役状态块）」语义耦合，改它必须**同一次编辑**同步改 §三 与 §六 的单一状态块契约（A-068 冻结的契约面），属状态页语义变更。**建议**：由大脑在 9.20 门禁收尾时派一张状态页刷新票，连带处理 §三 对 2026.9.20 的现役性表述 |
| **N-108-05** | N（观察，非本票面） | `git diff --check` 在本票改动面零告警；`.scratch/architecture-recovery/spec.md:3-4`（尾随空白）与 `.scratch/architecture-recovery/decision-ledger.md:162`（EOF 多空行）为**其他窗口在途**的存量告警 | 不属本票面，不动他人工作树；具名上报 |

**无 F 项**（本票无 flaky / 环境性失败需要豁免；全量 e2e 0 failed）。**未新增任何 G-A 豁免台账行**（该台账只收 flaky，本票面全绿）。

---

## 5. 改动文件

| 文件 | 改动 | 性质 |
|---|---|---|
| `scripts/layout-bypass-guard.mjs` | **新增**（约 350 行）：LB-0/LB-1/LB-2/LB-3 规则 + 别名追踪 + 具名豁免解析 + 活豁免清单 + `--self-test` 18 例 + `--json` | 门禁 |
| `test/tests/boxing-layout-bypass-gate.spec.ts` | **新增**：5 例离线断言（自测有牙齿 / 门禁绿 / allow-region 契约仍在 / reorder 走 commit 且 popups 无 `bookmarks.splice(` / pretest+CI lane 接线） | 测试 |
| `ntp/render.js` | `mutationHandlers` 新增 `reorderBookmarks`（净中性、不写墓碑） | 架构修复 |
| `ntp/popups.js` | 拖拽重排改走 `commit("reorderBookmarks", …)`；删除裸 `bms.splice` + 局部别名 | 架构修复 |
| `ntp/conn-layer.js` | 3 条具名豁免注释（`conn-layer-prune-validity` / `conn-layer-max-cap` / `runtime-groups-mirror`） | 注释 |
| `ntp/settings-ui.js` | 2 条具名豁免注释（`import-preserve-conns` / `import-overwrite-preserve-conns`） | 注释 |
| `ntp/storage.js` | 2 条具名豁免注释（`storage-facade-merge` / `storage-facade-merge-bookmarks`） | 注释 |
| `ntp/sync-engine.js` | 1 条具名豁免注释（`sync-preserve-conns`） | 注释 |
| `ntp/utils.js` | 1 条具名豁免注释（`pure-merge-output`） | 注释 |
| `package.json` | pretest 链第 2 位插入 `node scripts/layout-bypass-guard.mjs` | 接线 |
| `.github/workflows/test.yml` | 新增 `Layout bypass guard (ticket 108 / A-063)` 步骤（Contrast guard 之后） | 接线 |
| `test/cluster-map.json` | **109R**：`ntp/ntp.js` cluster 补 `boxing-pages-gc-version.spec.ts`；另补本票新 spec 到 `ntp/ntp.js` + `ntp/popups.js` | 返工 |
| `docs/release-status.md` | **113R**：§二「上一已发布版本（可回滚目标）」2026.9.12 → **2026.9.15**（附商店证据与 CWS 两版循环陷阱说明） | 返工 |
| `docs/CONTEXT.md` | Mutation API op 清单补 `reorderBookmarks` | 文档 |
| `.scratch/architecture-recovery/decision-ledger.md` | A-063 → `implemented` | 账本 |
| `.scratch/architecture-recovery/issues/108-…md` | AC 勾选 | 票面 |
| `.scratch/108-atomcode/prompt.md` · `atomcode-raw.log` | 调研提示词 + 原始产出（证据） | 证据 |

**零**：未改 `manifest.json`、未改版本面、未改 ADR-0017、未改 `docs/release-status.md` 的三门状态块/单一状态块契约、未改任何 G-A 豁免台账行、未改 `.gitattributes`。

### 5.1 对 `docs/release-status.md` 的边界声明（避免误读为越界）

本票对状态页**只改 §二 的「上一已发布版本」一行**（113R 的 AC）。实测该页 §二「目标发行版本」仍为 2026.9.15（票 116 已把版本面推到 2026.9.20），但**本票不修**：该行与 §三「三门状态（页内唯一现役状态块）」语义耦合，改它必须同步改 §三/§六 的**单一状态块契约**（A-068 冻结的契约面），属**状态页语义变更**，须由大脑裁决而非门禁票夹带。已具名 **N-108-06** 上报（见 §4），未越界修改。

---

## 6. 完成定义与残留风险

- **AC 全勾**（§2），无 F 项（§4）。
- **未**宣称三门合取达成（G-A/G-B/G-C 不属本票）；**未**代签 G-B；**未** push / tag / force-push；**未**热修 2026.9.15；**未**第二次 root 导出（A-P01）；提交在 `a1acaaac` 之上线性追加。
- **残留风险 1（门禁能力边界）**：别名逃逸（跨函数/跨模块/重绑定）抓不到 —— 具名 N-108-03，不静默。
- **残留风险 2（豁免面）**：9 条活豁免存在（均为非 handler 归属的合法改写）。LB-3 保证它们不会腐化成孤儿；调研建议的「零活豁免」需结构面（N-108-02）配合。
- **残留风险 3（add 类未覆盖）**：`push` 不在判定面 —— 具名 N-108-01。
- **残留风险 4（门禁只扫 `ntp/*.js` 顶层）**：`ntp/` 目录当前只有 15 个 `.js` 模块 + CSS/HTML，无子目录；若将来 `ntp/` 出现子目录，扫描面需同步递归（`readdirSync` 非递归已在脚本中显式，非隐式遗漏）。

---

## 7. 版本控制（WORKFLOW §4.2）

- 提交路径：`but diff` 确认改动 → `but commit -b ticket/108-layout-bypass-static-gate -m "<消息>" <改动id...>`。
- **hunk 级选择**：`package.json` 只取 pretest 行（不夹带票 116 的版本行与票 109 的 `verify:pages-gc`）；`docs/CONTEXT.md` 只取 Mutation API 行（不夹带票 116 的 Wave9.20 条目）。
- **不 push、不开 PR、不 tag、不 force-push**；不改写他人/其他窗口的提交；不对已推送的 main 换 root（A-P01）。

### 7.1 提交结果与排除项（如实记账）

| 项 | 值 |
|---|---|
| commit | **`a234b23f`**（GitButler change id **`yry`**）@ 分支 `ticket/108-layout-bypass-static-gate` |
| 规模 | **18 文件 / 895 insertions / 11 deletions** |
| 栈位 | 分支 stack 在 **`ticket/116-calver-2026-9-20`** 之上。实证栈序（`git log --graph`）：主干链 = `a1acaaac` → w920-tickets → 113 → 109 → 114 → 112 → 111 → w920-107 → 115 → 116（tip `76454dc9`）；`ticket/110-zoom-dblclick-b71`（`53cdadd5`）是**从 `a1acaaac` 拉出的平行分支**，不是主干链成员 —— 故本票分支只能取主干链顶端 116 为基（先试 `--above ticket/110` 仍报依赖，已改为 `--above ticket/116` 后一次通过） |
| hunk 级选择 | 已实现：`package.json` 提交体只含 pretest 行（`+2/-2`，不夹带票 116 版本行与票 109 的 `verify:pages-gc`）；`docs/CONTEXT.md` 只含 Mutation API 行（票 116 的 Wave9.20 行在提交体中为上下文行，未入 diff） |
| 防夹带核验 | `git show a234b23f --stat` 逐项确认；`decision-ledger.md` 在提交中命中数 **0** |

**排除项 1（重要，需大脑收口）**：`.scratch/architecture-recovery/decision-ledger.md` 的 **A-063 → implemented 翻转未入本提交**。原因：该文件在 GitButler 中只暴露**一个不可拆分 hunk `sq:f`**，其中同时携带 **A-065（票 110）、A-068（票 113/114）、A-071（票 116）** 三行他人窗口的在途改动（实测：`sq:f` 段内 `+` 行的 A-xxx 为 A-063 / A-065 / A-068 / A-071 四行）。提交它 = 代他人窗口提交其工作，违 AGENTS.md「不得提交他人工作」。**与票 109 / 113 / 110 的同类处置一致**（110 的提交信息也明写同一排除）。

  *A-063 行·状态格逐字内容（恢复用，与工作区现文一致）*：

  > `implemented（2026-09-15 · ticket 108 · `scripts/layout-bypass-guard.mjs` 静态门禁上线 …（全文见工作区 `.scratch/architecture-recovery/decision-ledger.md` A-063 行）`

  **恢复/解锁路径**（任一即可）：① 在 `w920-tickets` 落地后重跑 `but commit -b ticket/108-layout-bypass-static-gate -m "docs(108): A-063 ledger row -> implemented" <sq:f 的 change id>`；② 或由大脑窗口统一收口共享账本文件后再提交。

**排除项 2（非本票）**：`.scratch/architecture-recovery/prompts/108-layout-bypass-static-gate.md`（change id `vs:3` / `vs:b`）是**大脑的窗口启动器**，非本票产出，未提交。

**未提交的其他在途改动（非本票，仅报告事实）**：`.scratch/architecture-recovery/reports/109-report.md`（`pr:1`）、`ntp/index.html`（`zw:*`，票 116 面）、`.scratch/architecture-recovery/README.md`（`nt:9`）、`.scratch/112-atomcode/*`（`sm:1`/`sx:5`）。

- 完成定义遵循 handoff：AC 全勾 · 附 CI/实测锚点 · A 账本 A-063 状态更新（**已在工作区生效，提交见上排除项 1**）· 报告落盘（本文件）。
