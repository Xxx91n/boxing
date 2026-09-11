# 报告 — 53 构建期 CSS 括号 balance 门禁

- 日期: 2026-09-12
- 票: .scratch/architecture-recovery/issues/53-css-brace-balance-gate.md（覆盖 A-010，spec D6，Wave5 deferred 补齐）
- 阻塞: None（已按启动器要求开工即完成）
- 版本控制: 遵循 WORKFLOW §4.2（GitButler `but` CLI，独立分支，未 push、未开 PR）

## 实现

新增 build 校验器系列 **A10**（延续 A7 i18n / A8 dual-write / A9 store-compliance 编号），对全部 shipped 源 CSS 做注释/字符串感知的花括号深度扫描，fail-closed：

| 文件 | 角色 |
|---|---|
| `.github/scripts/css-balance.mjs` | 新增。共享扫描器：`scanCssBalance(text)` 返回 `{finalDepth, strayCloses, nestedHidden}`；`checkCssFiles(root, files)` 汇总违规。`SOURCE_CSS` 单一清单 = 6 个 shipped 源 CSS（base/settings/onboarding/conn + design-system + popup.css）；gitignored 工件 `ntp/ntp.css` 由输入平衡性派生，不重复扫。 |
| `.github/scripts/ntp-css.mjs` | `buildNtpCss()` 在写工件**之前**过门禁——一条接线覆盖 extension dist、`build.mjs --css-only`、`build-demo.mjs` Pages 三条产物路径（2026-09-12 冻结事故正是产物路径无检查）。 |
| `.github/scripts/build.mjs` | `build()` 内新增 `validateCssBalance()`（A10），打包前对全量 `SOURCE_CSS`（含不经拼接直发的 design-system.css / popup.css）fail-closed：违规 throw → 进程 exit 1，dist 不产出。 |
| `scripts/css-balance-guard.mjs` | 新增。pretest 半（对齐票 45 migration-golden-guard 先例）：(1) 真实源扫描；(2) **负向自检**（issue AC-3）——把故意破坏的 CSS 样本喂给扫描器，断言 missing-`}`、stray-`}`、嵌套 `[hidden]`（含 `@media` 套 `[hidden]`）全部被检出，且顶层 `[hidden]` 兜底对（BX-DEV-020 约定，正对照）不误报、注释/字符串内花括号免疫。自检失明 = exit 1。零磁盘写、零构建产物。 |
| `package.json` | `pretest` 追加 `node scripts/css-balance-guard.mjs`（import-graph-guard、migration-golden-guard 之后），CI test.yml 经 pretest 生命周期自动执行，红灯阻断。 |

检测语义（spec D6 逐条）：
1. 任一源 CSS final depth ≠ 0 → build fail ✓
2. 嵌套 `[hidden]` 选择器（`{` 处 depth≥1）→ build fail ✓（含 `&`-嵌套与 @media 套嵌两形态）
3. 附加：depth 走负（stray `}`）亦 fail——同一冻结失效类的镜像错误。

## 验收项 → 证据

| AC | 证据 |
|---|---|
| 源 CSS final depth≠0 时 build fail | 负向实测（OS temp 目录故意破坏 base.css）：`NEG ok=false`，报 `ntp/base.css: final brace depth 1 != 0`；同一 `checkCssFiles` 即 build.mjs A10 / ntp-css 所调，violations 非空 → throw。 |
| 嵌套 [hidden] 选择器 build fail | 负向实测（temp settings.css 内嵌 `[hidden]`）：`NEGHID ok=false`，报 `ntp/settings.css:L3 [hidden] selector nested at depth 1 (must be top-level): [hidden]`；guard 自检另含 `@media { .x[hidden]{...} }` 样本必检出。 |
| 负向测试/脚本自检 | `scripts/css-balance-guard.mjs` 双半 + 两条 OS-temp 真实文件负向实测，均如上。 |
| 存量无红（门禁落点基线） | 6 文件全量扫描 finalDepth=0、nestedHidden=0；guard `GUARD_EXIT=0`；`build.mjs --css-only` `CSS_ONLY_EXIT=0`（产物 ntp.css 63325 chars，与票 47 基线一致）。 |
| 语法/行尾 | `node --check` 4 个 .mjs 全过；package.json JSON 解析过；改动文件 `grep -lU '\r'` 无 CRLF；`git diff --check` exit 0。 |

## 调研来源（通用调研要求）

本票无新增调研问题，按 handoff 许可复用 Wave5/6 已索引 atomcode 结论：冻结根因与 CSS Nesting 吞规则机制来自票 40/46 调研链（ctx source=atomcode，2026-09-11/12，ADR-0017 Context 引用）；fail-closed 构建门禁形态对标票 45 golden guard 与 ADR-0017「构建产物级 CI 必绿」。工业对标（postcss 全解析器）刻意不引入——MV3 零依赖 build 面 + A9/A7/A8 先例均为自研确定性小扫描器，纯文本深度扫描已完备覆盖两类根因，不产生新依赖（CRX-R-009）。

## 剩余风险 / 移交事项

- CI-only 构建政策：本窗口未跑 `npm test` / Playwright。门禁红绿的权威证据 = CI run（test.yml 的 pretest 半 + "Build extension" 步骤均会执行 A10）；由大脑 Agent 推送 CI 验证分支触发（WORKFLOW 流程），本窗不本地自证。本窗已提供的是零产物纯扫描实测（上表），CI run 落地前不得宣称门禁绿。
- `[hidden]` 顶层配对「必须成对存在」属票 40 约定（BX-DEV-020），spec D6 只要求检测「嵌套即 fail」，本票按 spec 执行；配对存在性检测若需升级为门禁，另立票。
- 扫描器为纯文本深度模型，不解析选择器语义：`@media` 预lude 本身含 `[hidden]`（合法，如查询语法）不在源 CSS 出现；如未来 CSS 引入自定义属性块 `{...}` 值（`--foo: {a:b}`），depth 模型会误计——现源无此形态（实测 0 违规），出现时按报错行人工裁决。

## 变更文件清单

- 新增: `.github/scripts/css-balance.mjs`、`scripts/css-balance-guard.mjs`、本报告
- 修改: `.github/scripts/ntp-css.mjs`、`.github/scripts/build.mjs`、`package.json`、`.scratch/architecture-recovery/issues/53-css-brace-balance-gate.md`（AC 勾选）
