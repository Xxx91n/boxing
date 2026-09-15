# 116 — calver 版本面推进至 2026.9.20（A-071）实施报告

- 窗口: Boxing Wave9.20 实施子窗口 · ticket 116
- 日期: 2026-09-15
- 目标版本面: **2026.9.20**（上一已发行 2026.9.15，持有不热修）
- 产物: manifest/package/lock/CHANGELOG/release-notes/ntp 脚注 + 伴随文档面（详见 §二）
- 版本控制: WORKFLOW §4.2（GitButler，独立分支，不 push 不开 PR）
- 调研产物: `.scratch/116-atomcode/prompt.md`；调研全文已索引 ctx source=`atomcode-116-calver-version-surface`

## 一、通用调研三项（handoff 强制，每票一次）

### 1. atomcode 深度调研 — 工业成熟方案与推荐

调研对象：多文件版本号同步、CalVer 非零填充的排序语义与平台约束、版本面一致性门禁形态。三引擎检索 + 官方文档全文核验（Chrome version 格式、Firefox MV3 迁移指南、calver.org、release-please customizing.md、semantic-release 生态对比文），要点：

**结论一（高置信）**：对无构建管线、零 npm 依赖的 MV3 扩展，「人工改 + 零依赖 CI/测试期一致性门禁」是最合适形态。release-please / semantic-release / changesets 三者全部深绑 SemVer + npm 生态并需引入依赖链，与 CRX-R-009（禁未批准 npm 依赖）、zero-build、ADR-0017（禁无人复核自动发行）三重约束直接冲突；「manifest 为版本权威 + 门禁校验 N 面 + git tag 作单调性事实源」有 DuckDuckGo、immersive-translate、Dark Reader 等扩展项目一手先例。

**结论二（高置信）**：CalVer 非零填充是浏览器平台硬约束而非风格选择——Chrome 官方「非零整数不能以 0 开头」（`2026.09.20` 非法），Firefox 同规则（`2.01` 禁）；`YYYY.M.D` 非填充是双平台唯一同时合法形态。排序上 Chrome 更新机制为逐段数值比较（非填充不影响），但 **git tag 字典序 ≠ 数值序**（`"2026.10.1" < "2026.9.15"` 字典序为真、数值序为假）——单调性校验必须逐段数值化。本仓 `calver-guard.mjs` 的 `cmpCalver` 已是逐段数值比较，符合该结论。

**结论三（高置信）**：版本面门禁成熟形态 =「检查项清单化 + 负向自检（变异测试）+ 挂测试链而非仅 pre-commit」。本仓 calver-guard（8 面硬检 + 13 例自检 + pretest 串链）已达该水位；调研建议的唯一增量是「发行工作流入口补 tag==manifest 断言」，属后续改进面，不属本票 AC。

### 2. docs/adr 与 docs/CONTEXT.md 心智模型回顾 — 冲突检查

| 既有心智模型 | 本票是否冲突 | 处置 |
|---|---|---|
| ADR-0017 三门合取（G-A∧G-B∧G-C）、残红禁 tag、G-B 禁 agent 代签 | 否 | 本票只推进版本面；不宣称可发行、不碰三门判定 |
| ADR-0017「2026.9.12/9.15 持有不热修」+ 线性追加红线（A-P01） | 否，受其约束 | 2026.9.20 高于已发行最高 tag v2026.9.15，单调性通过；全部提交线性追加于 a1acaaac 之上 |
| CONTEXT.md「Wave9 version surface（票 94 / A-048）」面清单 | 否，作为执行依据 | 本票面集合 = 票 94 bump commit `7eaf7135` 的 13 文件先例（核心 8 面 + 伴随文档面 + gb-dryrun 重定向） |
| CONTEXT.md「user-visible version strings read manifest calver」 | 否 | ntp 静态脚注随 manifest 同步推进 |
| A-071 约束「不前导零；与 store 真源不冲突；G-B 前禁宣称可发行」 | 否 | 2026.9.20 无前导零；README 商店徽章/已发布口径保持 2026.9.15 不动（商店真源仍 9.15） |

**无冲突，无需记 revised。**

### 3. 工业级实现 / 测试策略对标

- **面集合对标**：成熟检查项清单（manifest 双平台格式、version_name 一致、package/lock 双点、CHANGELOG 小节、release-notes 文件存在性、静态脚注、单调性）与本仓 calver-guard 8 面逐一对应，无缺口（调研 4.1 节对照表）。
- **执行形态对标**：票 94 已建立「单 commit 推进全部面 + 门禁验收」先例，本票复刻该形态（含 gb-dryrun 默认目标与升级基线随版本滚动、store-publishing-plan 按「上一已发行 + 当前目标」双口径重写）。
- **测试策略**：本票不产生新运行时代码；验收锚点 = `node scripts/calver-guard.mjs` exit 0（含 13 例负向自检）+ `npm run pretest` 六门全绿 + `git diff --check` 零告警（CRLF/尾随空白）。

## 二、实现

按票 94（commit `7eaf7135`，9.12→9.15）建立的面集合逐面推进 2026.9.15 → **2026.9.20**：

**calver-guard 8 硬检面**

| 面 | 文件 | 改动 |
|---|---|---|
| manifest version / version_name | `manifest.json` | `2026.9.15` → `2026.9.20`（两处） |
| package version | `package.json` | `2026.9.15` → `2026.9.20` |
| lock version + 根包 version | `package-lock.json` | `2026.9.15` → `2026.9.20`（两处） |
| release-notes 文件（build.yml body_path SSOT） | `docs/release-notes/2026.9.20.md` | 新建（34 行 zh 用户向 SSOT，沿用 9.15 结构：感受变化/安装表/开发者/已知说明） |
| CHANGELOG 小节 | `CHANGELOG.md` | 新增 `## [2026.9.20] - 2026-09-20`（Fixed×2 + Internal×4 + Install）；`[Unreleased]` 行改为「after 2026.9.20」 |
| ntp 静态版本脚注 | `ntp/index.html` | `Boxing v2026.9.15` → `Boxing v2026.9.20`（L354 `modal__version`） |
| 单调性 | git tag 事实源 | 已发行最高 tag = `v2026.9.15`，2026.9.20 > 9.15 通过；不前导零（`2026.09.20` 形态未出现） |

**伴随面（票 94 先例的文档/工具面）**

| 文件 | 改动 |
|---|---|
| `AGENTS.md` | 「manifest version 2026.9.15」→ 2026.9.20（calver-guard 提示面清零） |
| `docs/publishing-guide.md` | 修订日期 → 2026-09-15；「当前发行口径」→ 2026.9.20；渠道行「9.15 已上线；9.20 由你提交」；Part 1/2 三个 zip 名与 CHANGELOG 引用 → 2026.9.20 |
| `docs/store-publishing-plan.md` | 标题/执行表口径 → 2026.9.20；状态行 =「9.15 已上架（真源不动）+ 9.20 待三门合取另令」；现况表日期 → 2026-09-15；三门行补 9.20 未启动；版本行 = 目标 2026.9.20（未发行）；材料包/清单 zip 名 → 2026.9.20；§C 改回发行前形态（gh workflow run -f version=2026.9.20，notes SSOT 指 2026.9.20.md，保留 9.15 已发布参考链） |
| `docs/store-assets/STORE-COPY.md` | 「2026.9.15 商店提交请使用 en.txt/zh-CN.txt」→ 2026.9.20 |
| `scripts/gb-dryrun-chrome.mjs` | 默认 EXT → `D:/rel-2026.9.20/chrome`；P0 断言 `manifest.version === "2026.9.20"`；升级基线注释/outOfScope `v2026.9.12` → `v2026.9.15`（9.20 的 G4 升级安装基线 = 上一发行 9.15） |
| `docs/CONTEXT.md` | 追加「Wave9.20 version surface」条目（心智模型记账，与票 94 同位） |

**刻意不动**（商店真源/历史记录/他票面）：

- `README.md` store_published 徽章与「Latest published store version: 2026.9.15」——商店真源仍 9.15，9.20 未发行不得宣称上架。
- `docs/release-status.md` —— 票 113 票面相位（本工作树已有其在飞改动），且其「上一已发布版本（可回滚目标）=2026.9.12」为正确语义。
- `docs/store-publishing-plan.md` 现况表 AMO/Edge「2026.9.15 已过审上线」行——商店事实保留。
- `scripts/calver-guard.mjs` `FIXTURE_VERSION`/`BASE_TAGS` —— 自检夹具非版本面，任意合法 calver 即可，不随发行滚动。
- `docs/release-notes/2026.9.15.*`、历史报告、`docs/adr/0017` 修订段、`docs/history/` —— 历史事实不改写。
- 9.20 的 `.en.md`/`.bilingual.md` 暂不建——按 9.15 先例（`7eaf7135` 只建 zh SSOT；en/bilingual 在发行段补齐）。

## 三、验收对照（issues/116 AC）

| AC | 结果 | 证据 |
|---|---|---|
| 实施波内一致推至 2026.9.20：manifest version+version_name | ✅ | manifest.json L6/L51 = `2026.9.20` |
| package.json/lock | ✅ | package.json L3；package-lock.json L3+L9（根 version + 根包 version）均 = `2026.9.20` |
| notes/CHANGELOG/脚注 | ✅ | `docs/release-notes/2026.9.20.md` 新建；CHANGELOG `## [2026.9.20] - 2026-09-20`；ntp/index.html `Boxing v2026.9.20` |
| calver-guard exit 0 | ✅ | `node scripts/calver-guard.mjs` → `OK version=2026.9.20`（8 面一致 + 13 例自检通过） |

A-071 显式约束逐条：不前导零 ✅（`2026.9.20` 三段非填充）；与 store 真源不冲突 ✅（README/现况表保留 9.15 已上架）；G-B 前禁宣称可发行 ✅（无任何三门达成表述，plan/CONTEXT 均写「待三门合取」）。

## 四、实测锚点

| 命令 | 结果 |
|---|---|
| `node scripts/calver-guard.mjs` | **exit 0** — `负向自检 13 例通过 (2 正 + 11 反)`；`OK version=2026.9.20`（8 面一致）；1 条 advisory WARN（publishing-guide L101 历史事故记录含 2026.9.12，基线既有、非阻断） |
| `node --check scripts/gb-dryrun-chrome.mjs` | 语法 OK |
| `git diff --check`（本票面文件） | 本票改动行零告警；既有告警属 .scratch 并行在飞文件（spec.md 行尾空白、decision-ledger EOF 空行——非本票 hunks） |
| `node scripts/migration-golden-guard.mjs` | exit 0（28/28） |
| `node scripts/css-balance-guard.mjs` | exit 0（6 CSS 平衡） |
| `node scripts/contrast-guard.mjs` | exit 0（8/8 PASS） |
| `node scripts/onboarding-guard.mjs` | exit 0（自检 7/7，48 specs） |
| `npm run pretest` 全链 | **具名红×2（均非本票面，见下）** |

**具名残余红（跨窗口/既有，非本票责任面）**：

- **N-116-01**：`import-graph-guard` CM-1 — `test/tests/boxing-pages-gc-version.spec.ts` 未登记 `test/cluster-map.json`。属票 109（pages-gc-version-verify）在飞产物（本工作树 `??` 新 spec + `pages-gc-verify.mjs`）；其窗口补 cluster-map 即解。本票不碰（不替他人票面结账）。
- **N-116-02**：`locale-readme-guard` BX-LOCALE-006 — `README.md store_published 2026.9.15 != docs/release-status.md published 2026.9.12`。**基线 `a1acaaac` 上即红**（已实测 `git show a1acaaac:...`：README 徽章 9.15 与 status「上一已发布版本 2026.9.12」并存）。语义裂缝：该 status 行意为「上一已发布=回滚目标」（9.12 正确），而 BX-LOCALE-006 把它当「当前已发布」基线读。归口：文档治理/113 后续票（改 guard 读规则或 status 行语义均可，需大脑裁定，非本票擅自改向）。

## 五、账本与后续

- A-071 → `implemented`（decision-ledger 已回填实测锚点）。
- README 波次表 W1 行 116 → `**done**（AC 4/4 · calver-guard exit 0 · 报告 reports/116-report.md）`。
- issue `issues/116-calver-2026-9-20.md` → `done`，AC 4/4 勾选。
- 调研建议（不属本票 AC，呈报供后续票）：① 发行工作流入口补 `tag==manifest` 断言（调研结论三，消除 `release_tag` 自定义漂移）；② `docs/agents/manifest-contract.md` 记「非填充=平台硬约束」防止好心补零；③ calver-guard 负向自检可补「tag 字典序陷阱」例（构造 2026.10.1 vs 2026.9.15 断言数值逐段比较——现状 `cmpCalver` 已正确，属加固非修复）。
- 未做：tag/push/PR/商店动作（D-006：另令）；未宣称三门达成。

## 六、版本控制（WORKFLOW §4.2）

- 提交方式：`but diff` → hunk 级选择 → `but commit -b ticket/116-calver-2026-9-20 …` → commit **`szq`**（sha `ce7aea5c`，15 files +227/-43）。分支以 `but branch new --anchor` + `but move --above ticket/115-changelog-915-b77` 置栈顶——本票 README/issue hunks 的上下文依赖 `w920-tickets` 且需见到 114/115 已落账的 done 行（系列在顶）。
- 本票 hunk/文件集（15 提交单元）：文件级 `mt`（atomcode prompt）· `pk`（116-report）· `pw`（issue 116 status/AC）· `nt`（README W1 行）· `ws`（AGENTS）· `nn`（CONTEXT 波条目）· `wz`（publishing-guide 3 hunks 全本票）· `wu`（release-notes 9.20）· `ms`（STORE-COPY）· `xzu`（store-publishing-plan 4 hunks 全本票）· `np`（manifest ×2）· `kp`（package-lock ×2）· `szw`（package.json）· `xzw`（gb-dryrun ×4）；hunk 级 `zw:54`（ntp 脚注——同文件其余 19 个 zw:* 为并行窗口的 onboarding 排版改动，未取）。

### 跨窗口文件归属披露（内容均已在工作树，按 109 先例不夹带他人 hunks）

| 项 | 现状 | 归属/处置 |
|---|---|---|
| `CHANGELOG.md` `## [2026.9.20]` 小节 + `[Unreleased]` 行 | **已落盘**：随 115 窗口提交 `e9c5014d`（`ticket/115-changelog-915-b77` 分支）——其 file/hunk 级提交先于本窗 hunk 选择，夹带了本票新增的 24 行 | 内容逐字为本窗所写并已实测（calver-guard 绿依赖之）；**co-mingling 披露**给首脑对账，不 rewrite 他人提交（CRX-R-015/红线） |
| `decision-ledger.md` A-071 行 → implemented | 已在工作树；GitButler 仅暴露不可拆分 hunk `sq:e`（同时含 113 的 A-068 落账） | 按 109 先例**未**并入本票提交，避免夹带 113 改动；待归属方/首脑 reconcile |
| `issues/116` / `README` 波表行 | 已并入本票提交（`pw:2`/`nt:c` 均为纯本票 hunk） | — |

- **未 push、未开 PR、未 tag**（§4.2 默认；发行动作需用户另令）。
