[headless] --dangerously-skip-permissions：所有工具调用将自动批准
[warning] 正在以管理员权限运行 — 模型可能可以访问系统文件。
我将按你的调研协议执行：先召回知识库，再启动三引擎多角度检索，最后定点精读官方文档。先并行发起第一轮广泛搜索。知识库确认为空，首轮已获 npm 官方文档线索。继续第二阶段：三引擎并行覆盖 pre-commit/lint-staged 分工、CI 去重、失败模式等角度。继续第二阶段：定点精读官方文档与高价值原文（npm 官方 scripts/run-script/ci 三页 + Google SWE book + 社区对比文）。第三轮：精读 Google SWE book 原文 + husky/lint-staged 实践文 + pre-commit 绕过安全分析，同时补搜 Windows 跨平台与 bypass/强制执行角度。配额已基本达成（5 角度搜索 ×3 引擎、8 次全文精读、6+ 域名）。补最后一轮：lint-staged 官方文档与 Google 工程实践补充，然后综合输出。三阶段调研完成，配额已达成。以下为综合报告。

---

# 深度调研报告：静态质量守卫脚本接入本地开发闭环的工业实践

**Sufficiency Gate**: searches: 9 (Exa 2 + Tavily 4 + AnySearch 3) | angles: 5 类全覆盖（Official / Comparative / Criticism / Currency / Community） | full reads: 9 篇原文精读 | gaps: GitLab/Meta 对「去重 vs 双跑」无一手官方立场文档（仅有可类比的 Google/Pigweed 实践）；npm 12 官方 release note 原文未直接精读（经两篇二手文交叉确认）。

---

## 一、执行摘要（Tl;dr）

**推荐方案**（Confidence: 高——官方 npm 文档事实 + Google 官方工程实践 + 多源社区共识三方一致）：

> **守卫脚本单源存放（`scripts/*.mjs`，零依赖 Node ESM），通过两条独立的 npm script 入口暴露（如 `guard` 与 `pretest`）；本地 `npm test` 经 pretest 链自动触发守卫，CI 用显式步骤调用同一个 npm script 并可设环境变量跳过 pretest 防双跑；pre-commit hook 只放毫秒级守卫子集，完整守卫的「最终执法权」永远在 CI 必过检查。** 核心原则是「逻辑单源、执行多层」——去重的对象是守卫逻辑（一份脚本），不是执行点（本地 + CI 双层是纵深防御，Google 明确认可）。

关键事实锚点：`npm test` **永远自动**跑 `pretest`→`test`→`posttest`（官方文档），`--ignore-scripts` 会让 `npm test` **跳过 pretest 但仍跑 test 本体**（官方文档明文），这既是接入的免费通道，也是最大的静默失效陷阱。

---

## 二、五个问题的分点结论

### 1. pretest 链 / pre-commit hook / lint-staged 的成熟分工

**【官方文档事实】**（https://docs.npmjs.com/cli/v11/using-npm/scripts/ ，全文精读）：

- `npm test` 的生命周期固定为 `pretest` → `test` → `posttest`；任意 `npm run <x>` 也会自动跑 `pre<x>`/`post<x>`。**`npm ci` + `npm test` 组合中，pretest 由 `npm test` 这一步自动触发**——`npm ci` 本身只跑 install 族脚本（preinstall/install/postinstall/prepare 等），与 pretest 无关。
- 脚本退出码非 0 会**中止整个链**（"If the script exits with a code other than 0, then this will abort the process"）——这是守卫 fail-fast 的官方机制。
- **`--ignore-scripts` 的精确边界**（https://docs.npmjs.com/cli/v10/commands/npm-run-script/ ，全文精读）："commands explicitly intended to run a particular script, such as npm start, npm stop, npm restart, npm test, and npm run-script **will still run their intended script if ignore-scripts is set, but they will not run any pre- or post-scripts**"。即：它跳过 **pretest/posttest**，但 `npm test` 的 test 本体照跑。对 `npm ci` 而言则跳过所有依赖的 install 脚本 **和你自己 package.json 的 install 族脚本**（https://docs.npmjs.com/cli/v11/commands/npm-ci/ 确认 ignore-scripts 配置同样作用于 ci）。

**【社区共识】**（https://stevekinney.com/courses/enterprise-ui/husky-and-lint-staged ，全文精读；https://raw.githubusercontent.com/lint-staged/lint-staged/master/README.md ，全文精读）：

成熟的三层分工是：

| 层 | 放什么 | 理由 |
|---|---|---|
| **pretest 链**（npm test 前置） | 全量、快速(<1-2s)的确定性守卫（对比度 token 校验、import 图守卫、括号平衡） | 每次 `npm test` 必触发，无需额外安装 hook，天然跨平台 |
| **pre-commit hook**（husky 管理） | 只放**毫秒级、 staged 文件相关**的子集（格式化、linter --fix） | hook 是"速度与反馈工具，不是执法边界" |
| **lint-staged** | staged 文件级任务编排（prettier/eslint）；**不适合**全仓守卫（如 tsc、全仓 import 图检查） | lint-staged 官方 FAQ 明示全项目工具应放 hook 直跑或 CI |

lint-staged 官方 README 原文定位："running a task on a whole project can be slow…Ultimately you only want to check files that will be committed" —— 你的三类守卫都是**全仓静态校验**，正确入口是 pretest/CI，而不是 lint-staged。

### 2. 下沉到「本地 npm test 自动跑」的收益与失败模式

**收益**【官方 + Google 官方立场】：
- Google《Software Engineering at Google》第 23 章（https://abseil.io/resources/swe-book/html/ch23.html ，全文精读）：反馈回路按速度排序，"edit-compile-debug loop of local development" 是**最快**的一环；"which tests should be run on presubmit? Our general rule of thumb is: **only fast, reliable ones**"。你的零依赖静态校验器恰好是"fast + reliable"的完美候选，放进最内环完全符合该章原则。
- 下沉到 pretest 的独特优势：**零额外依赖**（不需要 husky 安装 hook、不需要 CI 配置改动），且 `npm test` 是所有开发者/CI/agent 的最大公约数入口。

**失败模式**（均有信源支撑）：
1. **静默跳过（最危险）**：CI 或 `.npmrc` 设了 `ignore-scripts=true`（供应链安全流行做法，如 Platform One Party Bus 全管线强制 `npm ci --ignore-scripts`，https://p1docs.dso.mil/party-bus/security-and-compliance-fundamentals/npm-security-flags ，搜索级信源）→ pretest 静默不跑，test 照跑绿灯。**缓解**：CI 里显式跑一次守卫入口脚本（不依赖 pretest 机制），或在守卫脚本开头检测 `process.env.npm_config_ignore_scripts` 并警告。
2. **阻断迭代**：守卫若 >1s，开发者会 Ctrl+C + `--no-verify`（https://motlin.medium.com/pre-commit-or-ci-cd-5779d3a0e566 ，全文精读："If git commit is taking over 1 second, I'll Ctrl+C it and add --no-verify"）。毫秒级纯 Node 校验器无此问题。
3. **跨平台 shell 差异**【官方文档事实】：npm 脚本在 POSIX 用 `/bin/sh`、Windows 用 **cmd.exe**（https://docs.npmjs.com/cli/v10/commands/npm-run-script/ ）。社区实证：环境变量语法 `$VAR` vs `%VAR%`、`&` 语义不同（https://alan.norbauer.com/articles/cross-platform-nodejs ，搜索级）。**缓解**：scripts 字段只写 `node scripts/guard.mjs`，所有逻辑进 Node——这是零依赖纯 ESM 守卫的最大红利（无 shebang 问题、无 shell 语法）。注意 Windows 下 `.mjs` 双击关联可能不是 node，经 `node xxx.mjs` 显式调用则无此问题。
4. **守卫自身 flaky**：Google 明言不可靠测试不该进 presubmit（"We don't want to run unreliable tests on presubmit, because the cost of having many engineers affected by them…is too high"）。守卫必须是确定性的纯函数式校验（读文件→断言→退出码），无网络无时钟依赖。
5. **重复执行**：见问题 3。

### 3. CI 显式步骤与本地 pretest 同时存在：去重还是纵深防御？

**【官方/工业界立场：保留双层，逻辑单源】**

- Google SWE book 原文（精读）明确背书双层："Continuous testing at each step…serves as a reminder of the value in a **defense in depth approach** to catching bugs—it isn't just one bit of technology or policy that we rely upon"。同一个测试套件在 presubmit 和 post-submit RC 阶段**重复跑**是明文实践（sanity check + auditability + cherry-pick 三理由）。
- Pigweed（Google 项目）presubmit 文档给出精细化版本：定义 **`quick`（本地）与 `full`（CI）两档 program**（https://pigweed.googlesource.com/pigweed/sandbox/+/20639e3b66cdceaade4862bae7df8a98095b4e12/pw_presubmit/docs.rst ，搜索级但引文量大）："only run fast (< 15 seconds) and trivial checks as push hooks, and perform slower or more complex ones in CI"。
- 安全领域同样结论：Truffle Security（精读）"Pre-commit, pre-receive and CI/CD secrets detection all contribute…we recommend combining all four scanning tactics together to establish a **defense-in-depth posture**"。
- 社区的「double accounting」反对声音（motlin 精读中引用 pre-commit 框架的著名 rebuttal："Whatever test runs during pre-commit must also run during normal CI/CD…It must run during normal CI/CD because pre-commit hooks can be skipped"）反对的其实是**逻辑双写**（同一检查配置两份），其结论恰恰是：CI 是必须的那份，本地是便捷副本——即**执行双份、逻辑一份**。

**去重的正确姿势**：守卫逻辑只有一份脚本文件；CI 中若 `npm test` 已隐式跑 pretest，就不要再加一个显式守卫步骤（或反之，显式守卫步骤设 `GUARD_SKIP=1 npm test` 之类跳过 pretest）。npm 官方提供 `npm_lifecycle_event` 环境变量（精读自 scripts 文档）可用于让同一脚本区分上下文。

### 4. 零依赖纯 Node ESM 守卫的推荐接入形态与工程纪律

综合官方文档事实 + 社区实践（ stevekinney 精读："keep the hook as a tiny shell entrypoint and call your real script from there…keep complicated logic out of shell. Shell is wonderful right up until it isn't"）：

```
scripts/
  guard-contrast.mjs    # WCAG 对比度 token 校验
  guard-import-graph.mjs
  guard-css-braces.mjs
  guard-all.mjs         # 串行编排入口
```
```json
{
  "scripts": {
    "guard": "node scripts/guard-all.mjs",
    "guard:ci": "node scripts/guard-all.mjs --json",
    "pretest": "node scripts/guard-all.mjs",
    "test": "playwright test ..."
  }
}
```

工程纪律清单（每条的信源）：
- **fail-fast 顺序**：最便宜的守卫先跑（括号平衡 < token 对比度 < import 图），第一个非零退出码即中止整链（官方：退出码非 0 abort，https://docs.npmjs.com/cli/v11/using-npm/scripts/ ）。这也符合 npm 官方 Best Practices："Don't exit with a non-zero error code unless you really mean it"——守卫失败就该非零，非守卫问题（如可选警告）应 exit 0 + 打警告。
- **退出码**：守卫用 `process.exitCode = 1`（而非 throw，避免堆栈噪音）；让 npm 链自然中止。
- **`--json` 输出**：CI 模式输出机器可读 JSON 供 CI 注解/工件；本地人读模式输出精简行。这是社区通行模式（qlty.sh 等工具明确以"local CLI + IDE + hook + cloud 同一套结果"为卖点，https://qlty.sh/blog/developer-experience-gaps-of-linting-on-ci ，搜索级）。
- **与 test runner 的关系**：守卫是 pretest 的**前置依赖**而非 test 的一部分——失败时 test 根本不启动，节省 Playwright 启动成本（你们仓库 pretest 已有此结构：import-graph guard + migration golden guard）。
- **串行 vs 并行**：毫秒级守卫串行即可（总耗时 <100ms，并行的收益不抵确定性损失与 Windows 并发文件句柄风险）；只有当守卫长到秒级才值得并行（Google："We also run tests concurrently"——但那是为了分摊秒/分级测试）。
- **工作目录**【官方】：脚本总是从 package root 运行（"Scripts are always run from the root of the package folder"），需要区分时用 `INIT_CWD`——守卫脚本可以放心用相对路径。

### 5. 反面教训与边界（真实失败实例）

| # | 反面案例 | 机制 | 信源 |
|---|---|---|---|
| 1 | **`--no-verify` 绕过 pre-commit** | 本地 hook 从来不是执法边界；"CI is still the final authority" | stevekinney 精读；https://ma.ttias.be/git-commit-without-pre-commit-hook/ （搜索级）；Truffle 精读 |
| 2 | **`ignore-scripts=true` 静默杀死 pretest** | Party Bus 等安全管线全局设 ignore-scripts → 你的 pretest 守卫在 CI 里消失，test 照绿 | npm run-script 文档（官方机制）+ P1 docs（实例，搜索级） |
| 3 | **`--ignore-scripts` ≠ "不执行任何东西"** | git 依赖的 prepare、外部二进制调用仍可执行——反过来也说明：指望 ignore-scripts 当安全边界是误解 | https://thinkingthroughcode.medium.com/i-thought-ignore-scripts-made-npm-installs-safe-it-doesnt-f409b852e7c5 （搜索级，2026-02 文） |
| 4 | **CI 里 npm test 隐式跑 pretest + 显式守卫步骤 = 双跑** | 同一 CI job 中 `npm test`（含 pretest）再叠一个 guard step → 守卫跑两次，浪费且日志混淆；Google 的对应教训是 presubmit 只放"fast, reliable"集合，且明确接受 presubmit/postsubmit 双跑是**跨阶段**而非同 job 内 | Google ch23 精读 + npm scripts 文档推演 |
| 5 | **pre-commit 放全量守卫 → 团队集体关 hook** | motlin 精读："pre-commit hooks suffer from tragedy of the commons, they will never become ubiquitous" | motlin 精读；switowski 精读（"It's unsuitable for running slow tasks…No one wants to wait a few minutes each time"） |
| 6 | **npm 12（2026-07）默认封锁依赖 install 脚本** | 只封依赖脚本，**你自己 package.json 的 pretest 不受影响**（"Only dependency scripts are blocked, yours keep running"）——但若团队顺势在 .npmrc 写死 ignore-scripts=true 则会触发案例 2 | https://blog.stephane-robert.info/en/post/npm-no-longer-runs-install-scripts/ + https://www.digitalapplied.com/blog/npm-12-install-scripts-blocked-supply-chain-guide-2026 （均搜索级，2026-07/08 时效文） |
| 7 | ** husky 的 prepare 脚本依赖 `npm install` 无参运行** | hook 未安装的新环境里 pre-commit 形同虚设；"You still rely on their good will to install" | stevekinney 精读 + switowski 精读 |

---

## 三、推荐 vs 备选对比矩阵

| 方案 | 反馈速度 | 执法强度 | Windows 兼容 | 双跑风险 | 适用守卫 | 备注 |
|---|---|---|---|---|---|---|
| **✅ pretest 链 + CI 同脚本显式调用（推荐）** | 每次 npm test 即触发 | CI 必过 = 强执法 | ✅ 纯 node 调用无 shell 语法 | 需用 env 开关防同 job 双跑 | 全部三类守卫 | 零额外依赖；逻辑单源执行双层 |
| pre-commit hook（husky）放全量守卫 | 提交即反馈 | 弱（--no-verify 可绕） | ⚠️ hook 是 shell 脚本需 POSIX 写法 | 与 CI 天然双跑（可接受） | 仅毫秒级子集 | >1s 即遭社区实证抵制 |
| lint-staged 全仓守卫 | 快（staged only） | 弱 | ✅ | 中 | ❌ 不适合全仓校验 | lint-staged 官方明示全项目工具是 bad fit |
| 仅 CI 显式步骤（现状） | 慢（push 后才知道） | 强 | ✅ | 无 | 全部 | Google 明言丢失了最快反馈环 |
| 独立 `npm run guard`（不挂 pretest） | 手动，易忘 | 同 CI | ✅ | 无 | 全部 | 只适合作为 CI 之外的显式逃生口 |
| 专用任务运行器（nx/turbo 等） | 中 | 强 | ✅ | 低 | 大型 monorepo | 对本项目是过度工程 |

---

## 四、风险清单

1. **[高] `ignore-scripts=true` 静默禁用 pretest** —— 守卫脚本启动时自检 `npm_config_ignore_scripts` 并 stderr 警告；CI 中显式调用 `node scripts/guard-all.mjs` 不依赖 pretest 机制。
2. **[中] 同一 CI job 内 pretest + 显式守卫步骤双跑** —— 二选一，或用环境变量（如 `BOXING_GUARD_SKIP=1`）在 pretest 内短路。
3. **[中] 守卫误报阻断所有人** —— Google 原则：不可靠的检查禁止进入 presubmit/pretest 环；新守卫先以「警告模式」灰度（exit 0 + 输出告警），稳定后再切硬失败。
4. **[低] Windows cmd.exe 陷阱** —— scripts 字段永不通配符/管道/env 语法，一律 `node scripts/x.mjs`；`--json` 等参数由 Node 内部解析 argv，不经过 shell。
5. **[低] npm 版本演进** —— npm 12 封依赖脚本不波及自有 pretest；但关注 `allowScripts`/`strict-allow-scripts` 政策演进（npm ci 官方文档已收录这两个配置）。

---

## 五、完整来源清单

| # | 标题 | URL | 角度 | 日期 | 贡献 |
|---|---|---|---|---|---|
| 1 | npm Docs: Scripts | https://docs.npmjs.com/cli/v11/using-npm/scripts/ | Official | 2026-05 更新 | pretest/test/posttest 生命周期、退出码中止、cmd.exe/sh、INIT_CWD、Best Practices（全文精读） |
| 2 | npm Docs: npm-run-script | https://docs.npmjs.com/cli/v10/commands/npm-run-script/ | Official | 2022-10 | **--ignore-scripts 精确边界**：test 本体照跑、pre/post 跳过；if-present（全文精读） |
| 3 | npm Docs: npm-ci | https://docs.npmjs.com/cli/v11/commands/npm-ci/ | Official | 2025-10 | npm ci 生命周期序、allowScripts/strict-allow-scripts 新配置（全文精读） |
| 4 | Software Engineering at Google, Ch23 CI | https://abseil.io/resources/swe-book/html/ch23.html | Official | — | presubmit 只放 fast+reliable、defense in depth 明文、反馈环排序（全文精读） |
| 5 | Pigweed pw_presubmit docs | https://pigweed.googlesource.com/pigweed/sandbox/+/20639e3b66cdceaade4862bae7df8a98095b4e12/pw_presubmit/docs.rst | Official(社区项目) | — | quick/full 双档 program；push hook 只放 <15s 检查（搜索级） |
| 6 | Pre-Commit or CI/CD — Craig Motlin | https://motlin.medium.com/pre-commit-or-ci-cd-5779d3a0e566 | Community/Criticism | 2024-03 | --no-verify 代价实证、double accounting 辩论原文（全文精读） |
| 7 | pre-commit vs. CI — Sebastian Witowski | https://switowski.com/blog/pre-commit-vs-ci/ | Comparative | 2023-11 | 两者并用结论、测试放 CI 的分层（全文精读） |
| 8 | Husky and lint-staged — Steve Kinney | https://stevekinney.com/courses/enterprise-ui/husky-and-lint-staged | Comparative | 2026-09 更新 | husky=接线/lint-staged=staged 编排、hook 非执法边界、POSIX shell 纪律（全文精读） |
| 9 | lint-staged README | https://raw.githubusercontent.com/lint-staged/lint-staged/master/README.md | Official | — | 全仓工具 bad fit、tsc 函数签名解法（全文精读） |
| 10 | Do Pre-Commit Hooks Prevent Secrets Leakage? — Truffle Security | https://trufflesecurity.com/blog/do-pre-commit-hooks-prevent-secrets-leakage | Criticism/Official | 2023-08 | pre-commit 不 scale、defense-in-depth 四层扫描（全文精读） |
| 11 | Platform One: npm ci Lifecycle Script Security Controls | https://p1docs.dso.mil/party-bus/security-and-compliance-fundamentals/npm-security-flags | Official(实例) | — | **ignore-scripts 杀死自有 pretest 的真实管线实例**（搜索级） |
| 12 | npm 12 Blocks Install Scripts — Digital Applied | https://www.digitalapplied.com/blog/npm-12-install-scripts-blocked-supply-chain-guide-2026 | Currency | 2026-07 | npm 12/pnpm10 时线、Shai-Hulud 背景（搜索级） |
| 13 | npm no longer runs install scripts — Stephane Robert | https://blog.stephane-robert.info/en/post/npm-no-longer-runs-install-scripts/ | Currency | 2026-07 | **"yours keep running"——自有 pretest 不受 npm 12 影响**（搜索级） |
| 14 | Cross-platform Node.js — Alan Norbauer | https://alan.norbauer.com/articles/cross-platform-nodejs | Criticism | — | npm 脚本逐字传给 cmd/sh 的平台陷阱（搜索级） |
| 15 | The Developer Experience Gaps of Linting on CI — Qlty | https://qlty.sh/blog/developer-experience-gaps-of-linting-on-ci | Community | — | 「本地/IDE/hook/CI 同一套结果」的工具化趋势（搜索级） |

---

## 六、信息缺口（诚实声明）

1. **GitLab / Meta** 对「同守卫 CI+本地双跑是否去重」没有公开的一手立场文档——本报告以 Google（SWE book + Pigweed）+ 安全厂商（Truffle）+ GitHub 生态实践三角推断，置信度中高。
2. **GitHub required status checks 作为最终执法机制**的官方文档本轮未精读（仅 freecodecamp 2026 新文提及"pre-commit hooks…aren't enforcement"，搜索级）。
3. npm 12 release note 原文未直接读取，npm 12 相关结论依赖两篇独立二手文交叉验证。
4. `npm_config_ignore_scripts` 环境变量在守卫内自检的可行性基于 npm 环境变量通则（`npm_config_*` 前缀映射配置，官方文档有 env 机制描述但未逐字列出该变量），落地前应做一次冒烟验证。

继续此会话，运行：atomcode -p "…" --resume 7ac6f5d4-ba44-4f93-8452-b1d7496556e1
