# 99 — locale README 14 语对齐（B63 / A-053）报告

- 窗口: Boxing Wave9.15 实施子窗口 · ticket 99
- 日期: 2026-09-14
- Covers: A-053 · Blocked by: 97（已 done，前置解除）· Status: implemented
- 产物: `docs/i18n/README.*.md`（13 语 Install 段）· `scripts/locale-readme-guard.mjs`（新增）· `package.json`（pretest + guard:locale-readme）
- 账本: `decision-ledger.md` A-053 由 current → implemented
- 调研: `.scratch/99-atomcode/atomcode-research.md`（ctx source: atomcode-99；atomcode 5.0.9，`--prompt-file` headless，exit 0，6m57s，20695 bytes）
- 版本控制: WORKFLOW §4.2（GitButler，独立分支，不 push 不开 PR）

## 1. 一句话

13 份 locale README 的 Install 段由「从 Release 包下载 .xpi / .crx + 商店仍在推进中」的旧口径，对齐为「商店正式安装优先 + 只链接唯一真值源」；hi 语硬编码的 2026.9.11 一并清除；并新增零依赖门禁把该类漂移变成 CI 硬失败。

## 2. 通用调研三项（handoff 强制，每票一次）

### 2.1 atomcode 深度调研（串行一次，ctx source=atomcode-99）

核心结论（均有官方文档 / 源码原文支撑，Confidence 高）：

1. **防漂移推荐组合 = (c) 只同步不变量 为主 + (a) 源语言唯一并给出机器过期信号 + (d) 轻量人工契约**；不引入 (b) 翻译管理平台——Weblate FAQ 原文明确平台不替你同步正文文件，且引入外部服务违反 CRX-R-009。
2. **多语言场景下 locale 不应出现版本号字面量与分发方式描述**。硬编码版本号在 14 语场景维护成本最高、漂移风险最大，本仓 hi 语钉死 2026.9.11 即其一手案例。locale 应只保留指向英文源锚点与 `/releases/latest`、商店列表页等**服务端恒定 URL**。
3. **store 口径不要用徽章表达**：CWS / Edge 的 shields 徽章源已不存在（Chromium 扩展组 2022 年终止 badging 项目），静态 badge 本质又是一个会过期的字面量；改用含日期的状态行（as of 2026-09-13 模式），且只活在英文源 + 状态页，locale 链接过去。
4. **门禁形态**：零依赖脚本 + 语言无关检查项（ASCII 制品名 / URL / 版本号正则 / 标记块存在性）+ 每项配一个 mutant 的负向自检 + 非零退出。

**对本票的关键取舍**：原计划的「把 2026.9.12 翻译成 13 份副本」被调研结论否掉——那等于把 1 个字面量复制成 14 个，正是漂移成因。改为 locale Install 段**不含任何版本号**，只链接 `../../README.md#install`、`../../docs/release-status.md` 与两个商店 URL。AC-2「与 README store_published / GitHub latest 口径一致」由「指向唯一真值源」+ 门禁 BX-LOCALE-006（英文源 badge 字面量必须等于 release-status.md 的已发布版本）共同保证。

**信息缺口（如实记账）**：Rust 各翻译仓过期横幅未读到一手文件；MDN 的 English-updated 横幅未找到一手页面（已核验的是相反方向的极端方案：归档非活跃 locale + `l10n.sourceCommit` 同步点）；Codecademy 相关说法原文 404，未计入证据。上述缺口不影响本票结论。
### 2.2 docs/adr 与 docs/CONTEXT.md 心智模型回顾 — 冲突检查

| 既有心智模型 | 是否冲突 | 处置 |
|---|---|---|
| ADR-0017 三门合取 G-A ∧ G-B ∧ G-C，残红禁 tag | 否 | 本票只动文档口径，不判定可发行；未宣称门禁达成，未代签 G-B |
| ADR-0017 修订：2026.9.12 持有不热修，商店可见 ≠ 三门合取 | 否 | locale 不再自造 store 状态表述，改为链接 release-status.md |
| CONTEXT.md「Wave9 version surface（票 94 / A-048）」版本面 2026.9.15 | 否 | 门禁只校验**已发布**口径（2026.9.12），不参与目标版本面（归 calver-guard） |
| 票 61 delta「i18n README 同步策略在报告说明」 | 否，且本票即为其收口 | i18n 对齐由「可选」升为本票正式范围 |
| 票 34「EN 为结构基线」 | 否 | 门禁 BX-LOCALE-007 复用该基线（H2 数奇偶） |

**无冲突，无需记 revised。**

### 2.3 工业对标（实现与测试策略）

- 每个检查项配一个 mutant，失效即失败 → perfgate / srdcheck 式棘轮。
- 语言无关检查（ASCII 制品名、URL、版本号正则、标记块）→ 对应 Sphinx / Docusaurus「不变量不进入翻译集合」。
- 每处口径只留一个真值源 + 外链 → 对应 MDN / K8s 的同步点思想。

## 3. 实现

### 3.1 13 份 locale README（docs/i18n/）

Install 段整体替换为与英文源同构的四段式：IMPORTANT（商店优先 + 指向真值源）→ Firefox 正式安装（AMO 链接）→ Edge / Chromium 正式安装（Edge 链接）→ 开发者从源码构建 → NOTE（zip 仅用于商店上传 / 本地调试，GitHub Release 不再分发 .xpi / .crx）。

- 覆盖 13 语：ar / de / es / fr / hi / ja / ko / pt_BR / ru / th / vi / zh_CN / zh_TW
- 各语原有的本地化 H2 标题原样保留（如 `## インストール`、`## Cài đặt`），未改动 README-I18N 标记块；`node scripts/gen-i18n-readme.js` 复跑 = 0 rewritten
- hi 语额外清除：`v2026.9.11` 硬编码、`boxing-chrome-2026.9.11.zip` / `boxing-firefox-2026.9.11.xpi` 制品名、「商店仍在推进中 / AMO 无公开列表」过期表述
- 统计：13 files changed, 260 insertions(+), 351 deletions(-)；改动仅落在 Install 段，未扩写 Usage / Privacy / Development 等无关段落（遵守「不扩写无关 i18n 重构」）

### 3.2 scripts/locale-readme-guard.mjs（新增，零依赖）

| 检查项 | 级别 | 内容 |
|---|---|---|
| BX-LOCALE-001 | block | 13 语文件与英文 README 均存在 |
| BX-LOCALE-002 | block | locale 内不得出现 calver 字面量（含 `v2026.9.11` 形态） |
| BX-LOCALE-003 | block | 不得出现 `boxing-chrome/firefox-*.zip/.crx/.xpi`、`releases/download/` 旧制品引用 |
| BX-LOCALE-004 | block | 每语必须同时含 AMO 与 Edge 商店 URL |
| BX-LOCALE-005 | block | README-I18N:START/END 标记块存在 |
| BX-LOCALE-006 | block | 英文源 `store_published-v<X>` 必须等于 `docs/release-status.md` 的已发布版本 |
| BX-LOCALE-007 | warn（`--strict` 升 block） | locale H2 数与英文基线一致 |

自检：`--self-test` 跑 5 类 mutant + 对齐正例，全过才 exit 0。接入 `pretest` 与 `guard:locale-readme`，与既有 calver-guard / onboarding-guard 同形态（纯 Node、零依赖、非零退出、自带负向自检）。
## 4. AC 对照

| AC | 结果 | 证据 |
|---|---|---|
| 14 语无过时版本残留 | **通过** | grep 全库 docs/i18n 无 9.11 / calver 字面量残留（结果 NONE）；门禁 BX-LOCALE-002/003 零命中 |
| 与 README store_published / GitHub latest 口径一致 | **通过** | 13 语均链接 `../../README.md#install` + `../../docs/release-status.md` + `/releases/latest` + AMO/Edge 商店 URL；BX-LOCALE-004/006 零命中（基线 2026.9.12） |
## 5. 验证锚点（本窗口实测，2026-09-14）

| 命令 | 结果 |
|---|---|
| `node scripts/locale-readme-guard.mjs --self-test` | `self-test PASS`（exit 0，6/6） |
| `node scripts/locale-readme-guard.mjs` | `13 locales checked, store_published baseline 2026.9.12; 0 blocking, 0 warning(s).` exit 0 |
| 修复前同一命令（漂移基线） | `28 blocking`：13×2 缺商店 URL + hi 的 2026.9.11 + `boxing-chrome-2026.9.11.zip` |
| `node scripts/gen-i18n-readme.js` | `switcher sync done: 0 file(s) rewritten; marker blocks only.` || `npm run pretest` | exit 0：import-graph 15 modules / 48 edges / 0 violations；migration-golden 28/28；css-balance OK；calver-guard 13 例自检 + 8 面一致；onboarding-guard 7/7；locale README gate 0 blocking |
| `node scripts/docs-link-guard.mjs` | `8 reference(s) checked, 0 dead` |
| `npm run docs:pointers` | `PASSED - 74 key pointers resolve across 9 entry documents; 0 machine paths` |
| `git diff --stat -- docs/i18n` | `13 files changed, 260 insertions(+), 351 deletions(-)` |

本票为 docs + 门禁脚本，未改运行时代码与 manifest，故未跑 e2e；`pretest` 链为本次验证边界。
## 6. 偏离与决策（如实记账）

1. **locale 不保留版本号字面量**：偏离「逐语翻译 store 版本行」的直觉做法，依据调研第 2 问结论。副作用是 13 语不再直读版本号，需点一次链接；已用 IMPORTANT 块把链接前置以抵消。
2. **H2 数奇偶默认只 warn**：结构奇偶属「可能需要改」而非「一定漂移」，避免误伤翻译风格差异；`--strict` 可升为阻断。
3. **BX-LOCALE-006 校验「已发布版本」而非 manifest 版本**：本仓 store_published（2026.9.12）与目标发行版本（2026.9.15）本就不同，若照调研原文建议校验 manifest 版本会产生必然误报；故改为与 `docs/release-status.md` 的「上一已发布版本」对齐——这是对调研建议的**显式偏离**。
## 7. 版本控制

遵循 WORKFLOW §4.2：GitButler 逐 hunk 认领（并行窗口存在他人未提交改动，禁止整文件认领）后提交到独立分支。不 push、不开 PR、不动他人提交、不对已推送 main 换 root。
### 7.1 版本控制实况（跨窗口依赖与提交构成）

- **提交**：commit `xwo`，分支 `ticket-99-locale-readme-b63`（新建）。
- **依赖阻塞与处置**：首次 `but commit` 被拒——`issues/99-...md` 的 Status / AC 行依赖 `wave915-grill-settle (xxx)`，`package.json` 的 pretest 行依赖 `ticket/101-deflake-b65 (lzl)`。按 GitButler 恢复路径先建分支，再 `but move ticket-99-locale-readme-b63 --above ticket/101-deflake-b65`（该分支本就在 wave915-grill-settle 之上，一处堆叠同时满足两个依赖），随后提交成功。
- **账本行的 hunk 纠缠**：`decision-ledger.md` 中本票 A-053 行与 ticket-103 窗口的 A-057 行落在同一 hunk。`but diff` 逐 hunk 认领的隔离法执行前，ticket-103 窗口先一步提交，A-053 行随之进入 HEAD（内容为本票原文，已逐字核实）。因此本票提交内不含 ledger 文件，账本状态以 HEAD 为准。
- **未纳入本票提交（属其他窗口）**：`docs/release-status.md`、`docs/START-HERE.md`、`docs/testing-governance.md`、`WORKFLOW.md`、`.scratch/architecture-recovery/README.md`、`.scratch/105-atomcode/*`。
- **遵守项**：未 push、未开 PR、未动他人提交、未对已推送 main 换 root。

## 8. 遗留

- 门禁只覆盖 Install 段的口径不变量；Usage / Privacy 等段落的散文级翻译未做一致性校验，超出本票范围。
- 维护契约：任何 store 状态 / 版本变更只改英文 README + release-status.md；locale 只维护链接与散文，门禁会拦截任何重新引入的字面量。