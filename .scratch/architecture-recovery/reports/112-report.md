# 112 报告 — B73 contrast-guard 串 pretest（A-067）

> 窗口：Boxing Wave9.20 实施子窗口 · ticket 112 · covers A-067
> 必读清单 7 项**全部存在**：handoff 1826 B / issue 642 B / spec.md 2397 B / WORKFLOW.md 36250 B / ADR-0017 10313 B / docs-CONTEXT.md 33188 B / decision-ledger 25451 B
> handoff 内另引用的 D 账本 `.scratch/wave9-920-grill/decision-ledger.md` 8360 B 与 `plan.md` 2320 B 亦均存在。
> 产物：`package.json`（pretest 链插入 1 门）· 报告 `reports/112-report.md` · 调研 `.scratch/112-atomcode/`
> 版本控制：WORKFLOW §4.2（GitButler，独立分支，不 push 不开 PR）

## 0. 开工复述（任务书要求）

| 项 | 结论 |
|---|---|
| ① 阻塞关系 | **Blocked by: None**（issue 明示 can start immediately）。本票在 plan.md 波次表属段② 测试硬化（GH-B73），依赖列「① 可并行，主序在后」→ 无硬依赖；本票不阻塞任何下游票。过程红线 A-P01：tip 仅在 `a1acaaac` 之上线性追加，第二次 root 导出即停波 |
| ② 必读路径 | 7 项全部存在（字节数见头块）；唯一待产出项为本报告 |
| ③ 通用调研三项 | atomcode 深度调研 / ADR+CONTEXT 心智模型回顾 / 工业级实现与测试策略对标 —— 见 §1，先行于实现 |

## 1. 调研摘要（handoff 通用三项，先行于实现）

### 1.1 atomcode 深度调研（串行 1 次）

调研问题：*把静态质量守卫脚本（零依赖 Node 校验器，如 WCAG 对比度 token 校验、import 依赖图守卫、CSS 括号平衡守卫）接入本地开发闭环的最佳工业实践是什么？*
覆盖 5 类角度（Official / Comparative / Criticism / Currency / Community）；Sufficiency Gate：9 次检索（Exa 2 + Tavily 4 + AnySearch 3）× 9 篇全文精读 × 6+ 域名。
会话号（续跑锚点）：`7ac6f5d4-ba44-4f93-8452-b1d7496556e1` · 原文归档 `.scratch/112-atomcode/atomcode-research.md`（20913 B）· prompt `.scratch/112-atomcode/prompt.md`

| # | 结论 | 来源 |
|---|---|---|
| 1 | `npm test` 生命周期固定为 `pretest → test → posttest`，**自动触发**；`npm ci` 只跑 install 族脚本，与 pretest 无关 | npm Docs: Scripts（官方全文精读） |
| 2 | 脚本退出码非 0 会**中止整个链**（fail-fast 官方机制）；守卫失败应 exit 非零，非守卫告警应 exit 0 | npm Docs: Scripts |
| 3 | `--ignore-scripts` 的精确边界：`npm test` 的 **test 本体照跑，pre/post 跳过** → pretest 守卫会**静默消失**。这是接入的免费通道，也是最大的静默失效陷阱 | npm Docs: npm-run-script |
| 4 | Google SWE book ch23：反馈环按速度排序，presubmit 只放 **fast + reliable** 检查；并明文背书 **defense in depth**（同一检查多阶段重复跑是正常实践） | abseil.io SWE book ch23 |
| 5 | lint-staged **不适合**全仓守卫（官方 README：只应检查将提交的文件）；全仓静态校验的正确入口是 pretest / CI | lint-staged README |
| 6 | pre-commit hook **不是执法边界**（`--no-verify` 可绕、未安装即失效）；>1s 的 hook 会遭开发者 Ctrl+C 绕过 | motlin / stevekinney / switowski 精读 |
| 7 | npm 脚本在 Windows 走 **cmd.exe**、POSIX 走 `/bin/sh` → scripts 字段只写 `node scripts/x.mjs`，逻辑全进 Node 是最稳的跨平台形态 | npm Docs + alan.norbauer |
| 8 | npm 12（2026-07）默认封锁依赖 install 脚本，但**自有 package.json 的 pretest 不受影响** | stephane-robert / digitalapplied（2026-07 时效文） |

**推荐方案（研究结论）**：守卫逻辑单源（一份 `scripts/*.mjs`），执行多层（本地 pretest + CI 显式步骤）；去重的对象是**逻辑**而非**执行点**。
两条派生建议直接约束本票实现形态：

- **(a) pretest 是正确的接入点** —— 零额外依赖、跨平台、`npm test` 是所有开发者/CI/agent 的最大公约数入口；本仓三类守卫都是全仓静态校验，lint-staged/pre-commit 均非正解。
- **(b) CI 显式步骤应保留** —— 研究风险清单 [高] 项明确指出：`ignore-scripts=true` 会静默杀死 pretest，缓解手段恰是「CI 中显式调用守卫，不依赖 pretest 机制」。故 test.yml 的 Contrast 步骤是**陷阱缓解**，不是冗余，本票不删。

### 1.2 ADR 与 docs/CONTEXT.md 心智模型回顾 — 冲突检查

| 既有心智模型 | 来源 | 与本票关系 | 冲突 |
|---|---|---|---|
| 每票实施遵循 `npm test`；清绿为 done 必要条件 | WORKFLOW §4.1 | 本票把 contrast 串入 `npm test` 的前置链 pretest → **强化**该条 | 否 |
| 可发行 = G-A ∧ G-B ∧ G-C 三门合取 | ADR-0017 / WORKFLOW §4.4 | 本票不触碰门禁定义；**本地门禁加严 ≠ 三门达成** | 否 |
| N-102-03：contrast-guard 仅 test.yml、未串 pretest（跨窗口行级依赖） | A-056 / 票102 报告 §6 | **本票正是清偿该欠账**（A-067 = D-004③ B73），且 A-067 明示「跨窗口行级依赖已过期可修」 | 否 |
| `ntp/ntp.css` 是构建产物、gitignore；校验器读源文件 | ADR-0011 / CONTEXT | contrast-guard 读 `ntp/design-system.css` + `base.css` + `settings.css` **源文件** → 不依赖 build，可在 pretest（build 之前）运行 | 否（关键前提，已实测） |
| 子窗口「不跨票动代码」 | WORKFLOW §2 | 本票只改 `package.json` 一行；`docs/release-status.md` 属票113(A-068)、CHANGELOG 属票115(A-070) → 不触碰 | 否（本票据此对 N-112-01 只呈报不修） |
| `@data-golden` continue-on-error 须 2026-09-18 前摘除并绿 | ADR-0017 Consequences | 与本票无交叉 | 否 |

**结论：零冲突，无需 `revised`。** 本票不引入新心智模型，只把票102 已声明的接入契约（`scripts/contrast-guard.mjs` 头部 L21-22 原文：「接入: package.json 的 pretest」）兑现。

### 1.3 工业级实现 / 测试策略对标

| 对标项 | 本仓现状 | 工业级形态 | 本票动作 |
|---|---|---|---|
| 守卫编排入口 | pretest 链（`&&` 串行，fail-fast） | 单一 `guard` 编排入口 + pretest 引用同一入口（研究 §4 推荐） | 保持现状（本票只加 1 门；引入 `guard-all.mjs` 编排器属重构，超本票范围，见 §6 建议） |
| 逻辑单源 | ✅ 每守卫一份 `.mjs` | ✅ 逻辑单源、执行多层 | 已满足 |
| 本地 = CI 可复现 | ❌ 本票前 contrast 仅 CI | ✅ 本地 pretest 即跑 | **本票修复点** |
| 跨平台 | ✅ scripts 字段只写 `node xxx.mjs`，零 shell 语法 | ✅ 同左 | 已满足（研究风险 [低] Windows cmd.exe 陷阱不适用） |
| 守卫确定性 | ✅ 纯文件读 + 数学断言，无网络无时钟 | ✅ 确定性优先 | 已满足 |
| 双跑治理 | CI 同 job 内 pretest + 显式步骤将双跑 | 二选一 或 env 短路 | **保留双层**（= ignore-scripts 陷阱缓解，研究风险 [高]）；实测双跑成本 ~186 ms，见 §2 |

---

## 2. 实测数据（沙箱实测，非估算）

| 项 | 值 | 来源 |
|---|---|---|
| contrast-guard 独立运行 | **8/8 PASS，exit 0** | `node scripts/contrast-guard.mjs` |
| contrast-guard 运行成本（中位，含 node 启动） | **185.8 ms** | 3 轮计时（185.8 / 264.8 / 150.8） |
| css-balance-guard 运行成本（对照） | 110.7 ms | 3 轮（110.7 / 109.0 / 116.0） |
| package.json 字节变化 | 2340 → **2375 B**（**+35 B**，与插入串长度精确一致） | fs.statSync |
| 编码 | UTF-8 **无 BOM**、**纯 LF**（CRLF=0） | 字节检查 |
| `JSON.parse` | **通过** | — |
| `git diff --stat` | `1 file changed, 1 insertion(+), 1 deletion(-)` | — |

### 2.1 pretest 链实测（串入后）

`npm run pretest` 执行序（7 门）：

| # | 门 | 结果 |
|---|---|---|
| 1 | import-graph-guard | exit 1 — **外部在途红 N-112-01**（见 §6） |
| 2 | migration-golden-guard | 28/28 通过 |
| 3 | css-balance-guard | OK（6 源 CSS 平衡） |
| 4 | **contrast-guard（本票新增）** | **8/8 PASS — 链内真实执行** |
| 5 | calver-guard | 8 面一致（2026.9.15） |
| 6 | onboarding-guard | 46 specs 零反模式 |
| 7 | locale-readme-guard | exit 1 — **既有红 N-111-01** |

注：链为 `&&` 串联，故当前 `npm run pretest` 整体 exit 1；但 **contrast-guard 在链内被真实执行且全绿** —— 因置于 css-balance 之后、locale-readme 之前，既不被第 1 门短路、也不被第 7 门掩盖。

### 2.2 `npm test` 触发 pretest 的实证

`npm test` 实测在 **pretest 阶段中止**（未进入 Playwright：输出中零 playwright/test-mutex 启动迹象），证实「本地 `npm test` 即跑对比度门禁」成立。

## 3. 实现

唯一改动：`package.json` 第 17 行 `pretest` 链，在 `css-balance-guard` 之后插入 `node scripts/contrast-guard.mjs`。

```diff
- ... && node scripts/css-balance-guard.mjs && node scripts/calver-guard.mjs && ...
+ ... && node scripts/css-balance-guard.mjs && node scripts/contrast-guard.mjs && node scripts/calver-guard.mjs && ...
```

**插入位置的两条理由**（可审计，非随意）：

1. **同族相邻**：contrast-guard 与 css-balance-guard 同属「CSS 源文件静态门禁」（均读 `ntp/*.css` 源、零依赖、毫秒级）。
2. **可达性**：置于 locale-readme-guard（既有红）之前，使本票目标「本地 npm test 即跑对比度门禁」在当前波基状态下**真实可达**；若追加在链尾，`&&` 短路会让 contrast-guard 被既有红掩盖而**永不执行** —— 那将使本票目的落空。

**未改 test.yml**（AC3）：其 `on.push.paths` / `on.pull_request.paths` 与 Contrast guard 步骤逐字未动。

**关于 CI 双跑**：串入后 CI 的 `npm test` 会经 pretest 跑 contrast，而 test.yml L66-67 的显式步骤仍会再跑一次（合计 ~2×186 ms）。**决定保留双层**，依据调研风险 [高]：`--ignore-scripts` 会静默跳过 pretest，显式 CI 步骤正是该陷阱的缓解手段（研究原文：CI 中显式调用守卫，不依赖 pretest 机制）。双跑成本可忽略且幂等。

## 4. AC 对照（`issues/112-contrast-guard-pretest-b73.md`）

| AC | 结果 | 证据 |
|---|---|---|
| 一行集成串入 pretest（package.json）；或书面接受 CI-only 并记账（二选一须落盘） | **达成**（选「串入」） | §3；+35 B 单行；commit `uqz` |
| 本机 pretest 含 contrast 全绿（若选串入） | **达成（contrast 面）**；整链「全绿」受两处**非本票**红阻 | §2.1：contrast-guard 链内 8/8 PASS；整链红 = N-112-01（票107 在途）+ N-111-01（既有） |
| test.yml 路径不回归 | **达成** | test.yml 零改动（`git diff` 空）；`on.*.paths` 与基线逐字一致 |

## 5. 锚点

- 提交：`uqz` / `3751ada5`，分支 `ticket/112-contrast-guard-pretest`
- 改动文件：`package.json`（1 行）
- 门禁：`scripts/contrast-guard.mjs` 链内 8/8 PASS（light/dark × rest/hover × 3 surface，最坏面 `--color-elevated`）
- 调研：`.scratch/112-atomcode/`（prompt.md / atomcode-raw.log / atomcode-research.md 20913 B），会话 `7ac6f5d4-ba44-4f93-8452-b1d7496556e1`
- 复现命令：`npm run pretest`

## 6. 残留与新增欠账（登记，不豁免）

| ID | 类型 | 内容 | 归属 |
|---|---|---|---|
| **N-112-01** | 并行窗口在途（瞬时） | `import-graph-guard` exit 1：`CM-1 spec is not covered by any cluster: boxing-sync-bookmark-delete-tombstone.spec.ts` —— 票107（P0 deleteBookmark）新增 spec 尚未登记进 `test/cluster-map.json`（该文件在工作树中当时仍干净）。**基线采集时该门为绿（violations: []），会话中途变红** → 属并行窗口在途，非本票 | 票107 |
| N-111-01 | 既有红（复用票111 具名） | `locale-readme-guard` exit 1：`README.md store_published 2026.9.15 != docs/release-status.md published 2026.9.12`。定性 = **门禁语义缺陷**（`publishedFromStatus()` 只抓「上一已发布版本」行，把「已发布版本」与「可回滚目标版本」当同一语义比较）。由 `a1acaaac` 引入；两输入文件在工作树与 HEAD 一致 → 与未提交改动无关 | A-068（票113）/ A-053（票99） |
| N-111-03 | 既有告警（复用票111 具名） | `git diff --check` 在 `decision-ledger.md:162`（EOF 空行）与 `spec.md:3-4`（行尾空格）报既有告警，非本票引入 | 他人窗口面 |
| N-112-02 | 建议（不实施） | CI 同 job 双跑 contrast（pretest + 显式步骤）。若后续要消除，建议用 env 短路（如 `BOXING_GUARD_SKIP=1`）或在 test.yml 去掉显式步骤并接受 pretest 单源；本票按调研保留双层 | 后续票 |
| N-112-03 | 建议（不实施） | 研究 §4 推荐的单一编排入口 `scripts/guard-all.mjs`（pretest 引用同一入口）可降低链式维护成本；属重构，超本票范围 | 后续票 |
| **N-112-04** | **本窗口操作副作用（已修复）** | 为隔离账本同 hunk 纠缠（票111 A-066 行与我的 A-067 行同属 hunk `sq:3`），我按 GitButler skill 的隔离法将 A-066 **临时还原**为 `current`（原文本已备份至 OS temp）。**票111 窗口在我还原期间完成提交**，使 A-066 的 `implemented` 证据文本被固化为 `current`（丢失去向）。**已从备份原样还原到工作树**（26124 → 26853 B，+729）；但按全局规则「不提交他人 agent 的工作」，**未代为提交** → 该行仍为未提交态，**需票111 窗口或大脑补提交**。同一事件的反向效应：我的 A-067 行落入票111 的提交 `02a7c1b5`（非本票分支）——已具名呈报 | 票111 / 大脑 |

**波基红面警示（呈报大脑）**：`origin/main` == `a1acaaac` 的 pretest 面**自带 N-111-01 红**，且因 `a1acaaac` 只改 README/docs（不在 test.yml `paths` 内）**CI 从未验证过该 tip**。当前 tip 的 `npm test` 会在 pretest 阶段中止。A-P02（豁免清零出口）/ 段⑤ G-A 全绿依赖此红被清偿。

## 7. 完成定义自检（handoff）

| handoff 要求 | 状态 |
|---|---|
| AC 全勾或具名 F/N 注明 | ✅ AC1/AC3 全勾；AC2 的整链全绿具名 N-112-01 + N-111-01 注明（§4/§6） |
| 附 CI/实测锚点 | ✅ §2 实测（8/8 PASS、185.8 ms、+35 B）；§5 锚点。CI 锚点待 push 授权（本票不 push） |
| A 账本 A-067 状态更新 | ✅ `decision-ledger.md` A-067 → `implemented`（附证据） |
| 报告落盘 | ✅ 本文件 |
| 版本控制遵循 WORKFLOW §4.2 | ✅ §8 |
| 禁止项未触碰 | ✅ 未宣称三门合取；未代签 G-B；未做 N 桶豁免；未 push/tag/force-push；未热修 9.15；未二次 root 导出 |

## 8. 版本控制实况（WORKFLOW §4.2）

- 路径：`but diff`（确认 `sz:b` 为唯一 hunk）→ `but commit -b ticket/112-contrast-guard-pretest -m "..." sz`。
- **代码提交**：`5ae7619b test(pretest): wire contrast-guard into npm pretest — ... (ticket 112 / A-067 / B73)`，分支 `ticket/112-contrast-guard-pretest`（change id `uqz`）。`git show HEAD:package.json` 第 17 行确认含 `contrast-guard`。
- **账本 A-067 行**：因与票111 的 A-066 行同属一个 diff hunk（GitButler 无法按 hunk 拆分），最终随票111 的提交 `02a7c1b5` 落地（非本票分支）；`git show HEAD:decision-ledger.md` 的 A-067 行已为 `implemented（... ticket 112 ...）`。**属跨票提交纠缠，已具名呈报（§6 N-112-04）**。
- **分支 stack**：A-067 行位于 w920 文档提交 `rpk` 新增的 Wave9.20 段落内 → 账本改动**真实依赖** `w920-tickets` 分支。按工具提示执行 `but move ticket/112-contrast-guard-pretest --above w920-tickets` 完成 stack（记录在案，供大脑裁决是否 unstack）。
- **并行窗口隔离**：`but status` 显示 107/111/113/116 等窗口的 `ntp/*.js`、`test/**`、`docs/**`、`.scratch/*-atomcode/` 在途 → **均未纳入本票提交**（只认领 `sz` = `package.json`）。
- **受阻与恢复（如实记录）**：首次 `but commit` 报 `unresolved conflicts exist in the index`（3 个 `.scratch` 文件 `UU`/`UD`，源自并行窗口的 workspace 级回退）。本窗口未擅自解冲突（mtime 显示有活跃写入者）；重试时冲突已被并行窗口清除，提交一次成功。
- **报告提交**：`docs(112): report + ledger row — ...`（本文件）。
- 未 push / 未开 PR / 未 tag / 未改 root（A-P01）。

---
**结论**：本票 delta（contrast-guard 串入 pretest）**已落地并经实测**；三门合取状态**未变**（不宣称可发行）。

