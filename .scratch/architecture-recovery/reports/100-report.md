# 100 — calver 一致性门禁（B64 / A-054）实施报告

- 窗口: Boxing Wave9.15 实施子窗口 · ticket 100
- 日期: 2026-09-14
- 目标版本面: **2026.9.15**
- 产物: `scripts/calver-guard.mjs`（新增） · `package.json`（pretest + guard:calver）
- 版本控制: WORKFLOW §4.2（GitButler，独立分支，不 push 不开 PR）

## 一、通用调研三项（handoff 强制，每票一次）

### 1. atomcode 深度调研 — 工业成熟方案与推荐

调研对象为「版本面一致性门禁」的工业做法，取权威官方文档全文核验，结论如下。

| 约束源 | 规则（原文核验） | 对本票的含义 |
|---|---|---|
| Chrome Web Store | 1–4 个点分整数，每个 0–65535；非零整数不得以 0 开头（`032` 非法）；不得全零 | `2026.9.15` 合法；`2026.09.15` 非法 |
| AMO / Firefox | 版本串逐段匹配 `(0|[1-9][0-9]{0,8})`，同样禁前导零；Firefox 108 起对不合规格式告警 | 同上 |
| npm / semver | `package.json.version` 须可解析为 semver；数字标识符禁止前导零 | `2026.9.15` 可解析；`2026.09.15` 不可 |

**推荐与理由**：采用「单一真值源 + 全量比对 + fail-closed 退出码」的门禁形态，而非引入 release 自动化框架。

- 不选 `semantic-release` / `release-please`：二者以 Conventional Commits 推导版本号并**自动发版**，与 ADR-0017「三门合取（G-A∧G-B∧G-C）方可发行、agent 不得代签 G-B、未过闸禁 tag」直接冲突；且本仓已锁定 CalVer，语义化推导无用。
- 不选 npm 侧工具（如 `check-dependency-version-consistency`）：它只管依赖版本一致，不管 manifest / release-notes / CHANGELOG，覆盖面不足；引入它等于为 20% 的需求新增一个依赖，违反 CRX-R-009。
- 选零依赖自研脚本：与本仓已落地的 `import-graph-guard` / `migration-golden-guard` / `css-balance-guard` / `waiver-ledger-check` 同形态（纯 Node、pretest 链、非零退出、自带负向自检），心智负担为零，且不改变任何既有发行流程。

### 2. docs/adr 与 docs/CONTEXT.md 心智模型回顾 — 冲突检查

| 既有心智模型 | 本票是否冲突 | 处置 |
|---|---|---|
| ADR-0017 三门合取（G-A∧G-B∧G-C），残红禁 tag | 否 | 本门禁只做版本面一致性，不判定可发行；不并入三门，不宣称门禁达成 |
| ADR-0017「2026.9.12 持有不热修；禁 tag / 禁宣称可发行」 | 否，且为其补强 | 新增单调性检查 BX-CALVER-014：manifest 版本不得低于已发行最高 tag，机械阻止回退/重发旧号 |
| CONTEXT.md「Wave9 version surface（票 94 / A-048）」：manifest version+version_name、package.json/lock、settings-footer 静态兜底、AGENTS.md、CHANGELOG、`docs/release-notes/<ver>.md` | 否，作为覆盖面依据 | 门禁按该清单落地；其中 AGENTS.md 属文档面，降级为**提示不阻断**（见第三节） |
| CONTEXT.md「user-visible version strings read manifest calver」 | 否 | `ntp/index.html` 静态脚注纳入硬检，防止展示面与更新面分裂 |
| 票 08 结论「calver 注入须同时覆盖 version_name」 | 否 | 门禁把 `version_name == version` 列为硬检（BX-CALVER-002/003） |

**无冲突，无需记 revised。**

### 3. 工业级实现 / 测试策略对标

- **fail-closed 退出码**：门禁失职比门禁误报更贵。参照 `css-balance-guard` 的做法，本脚本内置**负向自检**——每次运行都构造临时 fixture 树，逐项注入 11 种故障，断言各自错误码必现；自检失败与真实校验失败同等对待（均 exit 1）。这解决「门禁自己坏了但一直绿」的静默失效。
- **零磁盘写入 / 零构建产物**：自检 fixture 建在 OS 临时目录并在 finally 中清理，不污染工作树。
- **错误码化**：每条规则一个 `BX-CALVER-0xx`，让失败信息可被脚本与台账引用，而非靠人读散文。
- **文档面降级为告警**：历史引用型文档（含 grill 决策行、区间写法）天然携带旧版本号，硬拦会产生常驻噪声并训练人忽略告警——故只把「纯当前口径」文档纳入提示范围。

## 二、实现

`scripts/calver-guard.mjs`（零依赖，Node ESM）。硬检 8 面，任一不一致即 exit 1：

| 码 | 检查面 | 规则 |
|---|---|---|
| BX-CALVER-001 | manifest.version 格式 | CalVer `YYYY.M.D`，月/日**非零填充**，且为真实日期 |
| BX-CALVER-002/003 | manifest.version_name | 必须存在且等于 version |
| BX-CALVER-004/005 | package.json | version 等于 manifest.version |
| BX-CALVER-006/007/008 | package-lock.json | 根 version 与根包 version 均等于 manifest.version |
| BX-CALVER-009 | `docs/release-notes/<ver>.md` | 必须存在（build.yml `body_path` 硬依赖） |
| BX-CALVER-010/011 | CHANGELOG.md | 必须含 `## [<ver>]` 小节 |
| BX-CALVER-012/013 | `ntp/index.html` | 必须含静态脚注 `Boxing v<ver>` |
| BX-CALVER-014 | 单调性 | manifest 版本不得低于已发行最高 `v<calver>` tag |
| BX-CALVER-W | 文档面（AGENTS.md、publishing-guide.md） | 仅告警，不阻断 |

接入方式：

- `package.json` 的 `pretest` 追加 `&& node scripts/calver-guard.mjs` → 随 `npm test` 在 **CI 主 lane** 生效（test.yml 的 test job 走 `npm test`）。
- 新增 `npm run guard:calver` 便于单机/CI 单独调用。

## 三、验收对照（issues/100 AC）

| AC | 结论 | 证据 |
|---|---|---|
| 覆盖 manifest version+version_name、package.json、对应 release-notes 文件名 | **达成** | 三项均为硬检（BX-CALVER-002/003、004/005、009）；另按仓库约定补 lock / CHANGELOG / ntp 脚注 / 单调性共 8 面 |
| 失败时非零退出 | **达成** | `process.exit(failed ? 1 : 0)`；真仓负向实测 exit=1（见锚点 A2） |
| 策略与仓库约定一致或书面说明 | **达成并书面说明** | 见下 |

### AC-3 书面说明（覆盖面为何大于 AC 三项，以及为何有一处降级）

1. **扩面依据**：CONTEXT.md「Wave9 version surface（票 94 / A-048）」把 package-lock、settings-footer、CHANGELOG 与 manifest/package/release-notes 一并列为版本面。门禁若只查 AC 三项，会在其余面上留缺口，与既有约定不一致——故按约定扩到 8 面。
2. **release-notes 为何是硬依赖而非软提示**：`.github/workflows/build.yml` 以 `docs/release-notes/<version>.md` 作为 Release `body_path`，文件缺失即发行步骤失败，不是文档洁癖问题。
3. **AGENTS.md 为何从硬检降级为告警**：它是文档，且可能被并行子窗口协同编辑；把它纳入硬检会把文档编辑节奏绑死在版本号上。当前口径文档（AGENTS.md、publishing-guide.md）保留告警，历史/区间引用型文档（store-publishing-plan.md、STORE-COPY.md）明确排除，避免常驻噪声。
4. **pre-commit 或 CI 的取舍**：本仓 `.git/hooks/pre-commit` 由 GitButler 托管（钩子头 `GITBUTLER_MANAGED_HOOK_V1`），且 `.git/hooks` 不入版本控制——本地钩子无法随仓库分发，覆盖它还会破坏 GitButler 的工作区保护。因此选择 **CI（pretest）作为权威门禁**；需要本地拦截时，把 `node scripts/calver-guard.mjs` 挂到 GitButler 预留的 `.git/hooks/pre-commit-user` 即可，脚本头部注释已写明，不在仓库内新增钩子安装器（避免引入本仓不存在的新抽象）。
5. **单调性检查为何 fail-open**：`git tag --list` 取不到标签时（浅克隆等）跳过该项，避免把环境差异误判为版本违规；主路径由 pretest 承担。

## 四、实测锚点

| # | 场景 | 命令 / 操作 | 结果 |
|---|---|---|---|
| A1 | 语法检查 | `node --check scripts/calver-guard.mjs` | exit 0 |
| A2 | 门禁自校验（真仓） | `node scripts/calver-guard.mjs` | exit 0，`OK version=2026.9.15`，8 面一致，无告警 |
| A3 | 负向自检（脚本内置） | 同上，随每次运行执行 | 13 例通过（2 正例 + 11 反例） |
| A4 | **真仓负向实测** | 临时将 `package.json` version 改为 2026.9.14 后运行门禁 | **exit 1**，命中 `BX-CALVER-005 package.json version (2026.9.14) != manifest.version (2026.9.15)`；随后字节级还原（sha256 前后一致 `7484d8e1c8742083`），还原后复跑 exit 0 |
| A5 | pretest 链整体 | `npm run pretest` | exit 0，4/4 门禁通过（import-graph 0 violations / migration-golden 28/28 / css-balance OK / calver OK） |

**CI 锚点说明**：本窗口按 WORKFLOW §4.2 不 push、不开 PR，故 CI run URL 需待提交 land 后由发行 G-A 重跑产出。本票**不宣称** G-A/G-B/G-C 任何一项达成（ADR-0017 / handoff 禁止项）。

## 五、账本与后续

- `.scratch/architecture-recovery/decision-ledger.md` A-054 状态 `current` → `implemented`，锚点指向本票。
- 后续版本面推进（如 2026.9.16）时，须同步：manifest `version`+`version_name`、`package.json`、`package-lock.json`（根 + 根包）、`docs/release-notes/<ver>.md`、`CHANGELOG.md` 的 `## [<ver>]`、`ntp/index.html` 静态脚注——任一遗漏即 pretest 红。
- 未做的事：未引入任何新依赖；未改动 ADR-0017；未触碰三门合取定义；未 push / 未建 PR / 未打 tag。
