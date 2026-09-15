# 113 报告 — release-status 单一状态块（A-068）

> 票: **113** · covers **A-068** · 镜像: 无（本地票）· Blocked by: **None**
> 波: Wave9.20（目标发行版本 **2026.9.20**；持有 2026.9.15 不热修）
> 日期: 2026-09-15 · 版本控制: WORKFLOW §4.2（GitButler `but`；不 push、不开 PR、不 tag）
> 分支: `ticket/113-release-status-single-block`
> 改动面: **纯文档**（`docs/release-status.md` + `.scratch/.../decision-ledger.md` + 本报告）；**零源码 / 零测试 / 零脚本改动**

---

## 0. 开工复述（启动器「开工第一句」三项）

### ① 本票阻塞 / 被阻塞关系

- **本票 Blocked by: None**（issue 113 Status = `ready-for-agent`，handoff 同口径）→ 可立即开工。
- **本票不阻塞他票**。A-068 属 Wave9.20 文档收敛面，与 107/108/109（源码面）、110/111/112（测试面）、114/115/116（文档面）并行；本票只动 `docs/release-status.md`，不与其他窗口产生行级冲突。
- **上游语义约束（不得违反）**：ADR-0017 三门合取（G-A ∧ G-B ∧ G-C）；G-B 仅用户本人可签、agent 不得代签；`handoff` 禁止项——不宣称（G-B/G-C 未齐前的）三门合取达成、不代签 G-B、无 N 桶/数据完整性豁免、未明令不 push/tag/force-push、不热修 2026.9.15、不第二次 root 导出（A-P01）。本报告全程按此口径表述。

### ② 必读清单存在性（7 项，全部存在）

| 来源 | 路径 | 体量（核验时） |
|---|---|---|
| 启动器 | `.scratch/architecture-recovery/prompts/113-release-status-single-block.md` | 1043 B / 29 行 |
| handoff | `.scratch/architecture-recovery/handoffs/113-release-status-single-block-handoff.md` | 59 行 |
| 本票 | `.scratch/architecture-recovery/issues/113-release-status-single-block.md` | 24 行 |
| Spec | `.scratch/architecture-recovery/spec.md` | 65 行 |
| 过程 | `.scratch/architecture-recovery/WORKFLOW.md`（§4.2 / §4.3 / §4.4） | 183 行 |
| 门禁 | `docs/adr/0017-release-data-gate.md` | 89 行 |
| 领域 | `docs/CONTEXT.md` | 182 行 |
| 账本 | `.scratch/architecture-recovery/decision-ledger.md` | 163 行 |

### ③ handoff 内通用调研三项

1. **atomcode 深度调研**（串行，一次一个）——见 §1.1。
2. **回顾 `docs/adr` 与 `docs/CONTEXT.md` 现有心智模型**；冲突不得静默改向——记 `revised` 并呈报——见 §1.2。
3. **对标工业级实现 / 测试策略**——见 §1.3。

---

## 1. 调研摘要（三项，写在实现之前）

### 1.1 atomcode 深度调研（结论优先）

调研问题：`深度调研：发行状态页如何保证单一现役结论与已打 tag 和商店上架状态一致，并防止同页出现多套互相矛盾的状态表`
载体：`ctx_batch_execute` 包裹 `atomcode -p`（WORKFLOW §4.3 要求：联网调研只经 ctx 包裹的 atomcode，串行；本次会话在途 1 次）。提示词落盘 `.scratch/113-atomcode/prompt.md`。
Confidence：**高**（本仓一手材料 + GitHub Releases API / AMO v5 API / Pages 实况三源实测 + 机制类结论多源交叉）。

- **结论一（结构性机制）**：保证「单一现役结论」的根本机制是——**判定规则上收至 ADR（单一权威），状态页降级为 ADR 的只读投影；现役结论在页内有且只有一个承载块，且必须机器可查证（tag SHA + CI run URL + 商店 API 实测版本三绑定）**。凡是手写在第二处的状态复述（另一张表、另一份文档的「现况」栏）都会漂移。
  *依据*：ADR 模板自身 `Proposed → Accepted → Superseded` 生命周期（docsie / adr-template）；git-scm 官方手册对 tag「指向确切 ship commit 的不可变引用」的定位；hugotunius（2024）关于 SSOT 应为 git 内文件的论证。
- **结论二（拉取而非抄写）**：与 tag 一致用 GitHub Releases API 核验（`tag_name` + `target_commitish` + 资产 digest）；与商店一致用免鉴权 AMO v5 API（`current_version.version` + `file.status == "public"`）与 CWS `publishers.items.fetchStatus`（`state == "PUBLISHED"`）。商店是外部异步事实（AMO 24h 生效窗口、CWS 审核期），**手写副本必然过时**。
  *实测*：AMO live API 确认 `boxing-newtab` 的 `current_version.version == "2026.9.15"`、`file.status == "public"`、reviewed `2026-09-14T17:06:30Z`；listed 版本含 2026.9.15 / 2026.9.12 / 2026.9.11（回滚目标确在架上）。
- **结论三（矛盾表根因）**：根因是**多个 surface 各自拥有答案 + 无 staleness 检测**（atlan / datadef / solhelps / jostle 文献根因矩阵）。对策矩阵：单写路径（结论块与标题同次原子更新）+ 机器 gate + 旧块显式标 **Superseded**（保留不删，审计链不断裂）+ 复核日期契约。
- **机制对比矩阵（调研原文 §2.6 摘录）**

  | 机制 | 与 tag 一致 | 与商店一致 | 矛盾表风险 | 成本 | 备注 |
  |---|---|---|---|---|---|
  | 纯手写状态页（113 之前） | 依赖人记得填 | 手写「已上架」必过时 | **高**（本页 4 处矛盾为实证） | 低 | drift 温床 |
  | 全生成式看板（API 拉取渲染） | 高 | 高 | 低 | 高（需基建 + 鉴权托管，单人 OSS 过重） | ReleaseBar / Control Room 类 |
  | **混合：手写页 + 机器一致性 gate（推荐）** | gate 断言页内 SHA/run 与 API 相等 | gate 断言渠道行与 AMO/CWS API 相等 | 中→低（矛盾在 pretest 即被阻断） | 低（本仓已有 `waiver-ledger-check.mjs` / `calver-guard.mjs` 同构先例） | 与 G-B「用户声明」的人工性质兼容 |

- **顺带实测到的活漂移**：Pages demo（`https://xxx91n.github.io/boxing/demo/`）渲染 **v2026.9.12**，而现役 release 为 v2026.9.15 ——「三 URL live 200」只验存活不验版本。已具名为 **F-113-01**（见 §4）。

### 1.2 回顾 docs/adr 与 docs/CONTEXT.md（冲突呈报）

| 文件 | 现有心智模型 | 与本票关系 | 是否记 `revised` |
|---|---|---|---|
| `docs/adr/0017-release-data-gate.md` | 三条件合取可发行；残红禁 tag；G-B 为用户声明、agent 不得代签 | 本票全程遵守：终谳块的 G-B 行沿用页面既有用户声明原文，未代签；结论句与已存在 tag `v2026.9.15` 对齐 | **否**（无冲突） |
| `docs/CONTEXT.md` L181（Wave9.20 grill settle 2026-09-15） | 明载「release-status single status block」（D-005①） | 本票即该条的落地，心智模型一致 | **否**（无冲突） |
| `docs/CONTEXT.md` L126 | release status page = live per-release status board | 与本票「首屏给唯一现役结论」一致 | **否** |

**呈报结论：本票未发现需记 `revised` 的静默改向。**（若后续把 G-C 定义升级为「渲染版本 == 最新 tag」，属 A-064 / 9.20 B75 面，届时须修订 ADR-0017 G-C 行，不在本票。）

### 1.3 工业对标（实现 / 测试策略）

- **实现策略对标**：ADR 生命周期 `Superseded` 语义（不删旧、显式标记）→ 本票把该语义从「ADR / CI run」推广到「结论块」与「页内契约」。
- **测试策略对标**：本仓既有 `scripts/waiver-ledger-check.mjs`（exit 非 0 即阻断）与 `scripts/calver-guard.mjs`（pretest 链）是「机器 gate 而非自觉」的已落地先例。调研建议同构增加 **release-status 一致性 gate**：① §一 投影句 == §三 终谳块结论；② 存在终谳数据时禁止残留「（待填）」占位；③ 页内声明的 tag / 版本与 GitHub + AMO API 实测相等。**该 gate 不属本票 AC，列入 §5 后续建议**（避免扩写面、避免与其他窗口抢 `package.json` pretest 行级）。

---

## 2. AC 对照（逐项，含锚点）

| # | AC（issue 113 / handoff delta） | 状态 | 落地位置 | 锚点 |
|---|---|---|---|---|
| 1 | 删/降级 §一 矛盾表 | ✅ 完成（**删表 + 降级为投影句**） | `docs/release-status.md` §一（L9–L15） | 原表六行（可发行=否 / G-A 待新 tip 定谳 / G-B 待用户声明 / tag·商店禁止）已整表删除；改为一段结论 + 引用块声明「本节不设状态表、不独立陈述门状态」。校验：`待填` 残留 = 0、`可发行（G-A` 残留 = 0、`商店待人工同步` = GONE |
| 2 | 终谳块填 2026-09-14 实测 | ✅ 完成 | §三「发行终谳（2026-09-14 实测）」（L56–L69） | 八项全填：tip `8a8798c9` / run [34857433215](https://github.com/Xxx91n/boxing/actions/runs/34857433215) / 4 job 全 success / G-B 用户声明 2026-09-14「通过」2026.9.15（Chrome+Firefox 本地 zip）/ G-C 三 URL live 200 / tag `v2026.9.15` @ `cc30edcc` / AMO+Edge 已过审上线·CWS 可选未上架 / 结论「三门合取达成 → 2026.9.15 已发布，后续 tag·商店仍须用户另令」 |
| 3 | 旧 run 标 Superseded | ✅ 完成 | §三「G-A 历史证据（全部 **Superseded**，保留不删）」（L46–L54） | `34773593267` / `34778641702` / `34808080000` 三行语义列均加 **Superseded**；保留不删（审计链不断裂）；`34773593267` 另注「仍作 §四 豁免失败签名基线」，避免与 §四 台账基线语义冲突 |
| 4 | 页内规则：有且只有一个状态块 | ✅ 完成（**双处写入**） | §三 契约引用块（L30）+ §六 防过时契约（L111） | §三：「本页**有且只有一个现役状态块** = 本节（三门状态 + 发行终谳）」；§六 新增「单一状态块（页内硬契约）」段，并要求**同一次编辑同时**更新 §三 与 §一 投影句，只改其一 = 非法中间态；§六 禁止项追加「新建第二张状态表 / 只改标题不改结论块 / 静默删旧块而非标 Superseded」 |

**AC 全勾，无 N 项。** 具名 F 见 §4。

### 2.1 附带的证据一致性修正（非 AC，但属「与 tag 一致」的必要前提）

`docs/release-status.md` 原记「核验时 tip `41fcf1e4`」。实测：

- `git merge-base --is-ancestor 41fcf1e4 HEAD` → **NO**（该提交为 *GitButler Workspace Commit*，虚拟工作区提交，不在 HEAD 血缘内）
- `git merge-base --is-ancestor 8a8798c9 cc30edcc` → **YES**；`git log -1 cc30edcc` → `docs(w915): release G-A evidence — run 34857433215 @ 8a8798c9 success; A-061 implemented; release-status update`

→ 已把 tip 修正为 `8a8798c9`（发行 G-A 证据提交），并补现役 tag `v2026.9.15` @ `cc30edcc`。修正同时在 §二 与「变更记录」留痕，**未删改任何已推送提交**。

---

## 3. 实测锚点（可复现命令）

| 项目 | 命令 | 结果 |
|---|---|---|
| 现役 tag | `git rev-list -n 1 v2026.9.15` | `cc30edccf9118f88cd5a07eac68b81b53a77f607` |
| tag 列表 | `git tag --list` | `v2026.9.9 / .10 / .11 / .12 / .15` |
| 发行证据血缘 | `git merge-base --is-ancestor 8a8798c9 cc30edcc` | YES（exit 0） |
| 旧 tip 血缘 | `git merge-base --is-ancestor 41fcf1e4 HEAD` | NO（exit 1） |
| 证据提交 | `git log -1 --format="%h %s %ci" 8a8798c9` | `8a8798c9 docs(ledger): A-061 annotate land audit pending release G-A · 2026-09-14 22:42:17 +0800` |
| tag 提交 | `git log -1 --format="%h %s" cc30edcc` | `cc30edcc docs(w915): release G-A evidence — run 34857433215 @ 8a8798c9 success; A-061 implemented; release-status update` |
| 商店口径 | `docs/store-publishing-plan.md` L3 / L11–L14 | 「2026.9.15 已过审上架（AMO+Edge，用户声明）+ GitHub Release 已发布」；CWS「可选；历史上 Edge 优先」 |
| 外部实测（atomcode） | AMO v5 API `current_version.version` | `2026.9.15`，`file.status == "public"`，reviewed `2026-09-14T17:06:30Z` |
| 文件完整性 | 行数 / CRLF / BOM | 137 行 · `CRLF=false` · `BOM=false`（纯 LF，UTF-8 无 BOM） |
| 替换安全性 | 11 组 `old→new` 逐组 `occurrences == 1` 校验 | 11/11 命中 1 次，全部应用 |

---

## 4. 具名 F / N

| ID | 类型 | 内容 | 处置 |
|---|---|---|---|
| **F-113-01** | F（已知、具名、不静默） | 2026-09-15 实测 Pages demo 底部渲染 **v2026.9.12**，与现役 `v2026.9.15` 不一致；release-status 的 G-C 锚点只记「三 URL 200」，未记「渲染版本 == 现役 tag」，故该漂移此前未被状态页发现 | **不计入 9.15 G-C 判定**（9.15 波次 G-C 定义为三 URL live 200，已达成）；已在 §三 终谳块 G-C 行与 F-113-01 引用块**显式落页**；按 9.20 波次 **B75 欠账**（demo `version.json` == 最新 tag，对应 A-064）跟踪。**不在本票修复**（避免扩写进源码/CI 面） |

无 N 项（本票纯文档，未触碰 N 桶 / 数据完整性面，未新增任何豁免）。

---

## 5. 后续建议（不在本票，供大脑派票）

1. **release-status 一致性 gate**（调研 §2.2/§2.5 推荐，对标 `waiver-ledger-check.mjs`）：零依赖脚本断言 ① §一 投影句 == §三 终谳结论；② 有终谳数据时禁止残留「（待填）」；③ 页内 tag/SHA 与 GitHub API、渠道行与 AMO API 实测相等。**注意**：接入 `package.json` pretest 属行级热区（票 112 刚动过该行），建议独立票 + 独立窗口。
2. **跨文件第四套状态**：`docs/store-publishing-plan.md` 的「现况」表是页外第 4 套状态复述，建议改为引用 `docs/release-status.md` 而非复述（调研 §2.5）。**本票未改动该文件**（非本票面，且可能与其他窗口冲突）。
3. **G-C 定义升格**：把「渲染版本 == 现役 tag」纳入 G-C 并修订 ADR-0017 G-C 行，属 A-064 / 9.20 B75，届时须走 `revised` 流程。
4. **复核日期契约**：ADR-0017 已有 2026-10-12 review date，状态页建议对齐加一行「下次复核」。

---

## 6. 版本控制（WORKFLOW §4.2）

- 提交路径：`but diff` 确认改动 → `but commit -b ticket/113-release-status-single-block -m "docs(w920): ..." <改动id...>`。
- **不 push、不开 PR、不 tag、不 force-push**；不改写他人/其他窗口的提交；不对已推送的 main 换 root（A-P01）。
- 本次改动文件：`docs/release-status.md`、`.scratch/architecture-recovery/decision-ledger.md`、本报告 `reports/113-report.md`、`.scratch/113-atomcode/prompt.md`。
- 完成定义遵循 handoff：AC 全勾（§2）· 附实测锚点（§3）· A 账本 A-068 状态更新（decision-ledger L155 → `implemented`）· 报告落盘（本文件）。

### 6.1 提交结果（含一处受阻项，如实记录）

| 改动 | 分支 | 结果 |
|---|---|---|
| `docs/release-status.md` + `reports/113-report.md` + `.scratch/113-atomcode/prompt.md` | `ticket/113-release-status-single-block` | ✅ 已提交（commit `spm`） |
| `.scratch/architecture-recovery/decision-ledger.md`（A-068 → implemented） | 同上 | ⚠️ **受阻，仍在工作区未提交** |

**受阻原因（GitButler 原生报错，非本票失误）**：该文件为多窗口共享文件。本票只改 A-068 一行，但 GitButler 以**文件**为最小提交粒度，而该文件的 A-062..A-071 段（含 A-068 行本身）源自 `w920-tickets` 分支的 `rpk` 提交，于是整份文件被判定为：

```
Error: Cannot commit: 1 change could not be applied:
  .scratch/architecture-recovery/decision-ledger.md
    line 155 depends on w920-tickets (rpk)
    line 158 depends on w920-tickets (rpk)
```

已按工具提示执行 `but move ticket/113-release-status-single-block --above w920-tickets`（返回 `Stacked branch ... on top of branch 'w920-tickets'`），随后重试 `but commit -b ...` 与 `but commit --above spm ...` **仍报同一错误**；未再做强制操作（不强推、不 uncommit 他窗提交、不改他窗分支）。

**当前状态**：A-068 的 `implemented` 翻转**已在工作区文件里生效**（`decision-ledger.md` L155，纯 LF 无 BOM），但尚未进入任何提交。由于该文件已被 `but move` 检出过一次并被回滚（已当场重新施加），存在被再次回滚的风险，故把该行的最终状态逐字留在下文，便于一键恢复。

**恢复 / 解锁路径**（任一即可）：

1. 在 `w920-tickets` 落地（合入或被 target 吸收）后重跑：`but commit -b ticket/113-release-status-single-block -m "docs(113): A-068 ledger row -> implemented" <decision-ledger 的 change id>`；
2. 或由大脑窗口统一收口共享账本文件后再提交。

**A-068 行 · 状态格逐字内容（恢复用）**：

```
implemented（2026-09-15 · ticket 113 · docs/release-status.md 收敛单一现役状态块：① §一 矛盾表（可发行=否 / G-A 待新 tip 定谳 / G-B 待用户声明 / 禁 tag）**删除**，降级为 §三 的投影句（首屏仍给唯一现役结论，但不设第二张状态表）；② §三「发行终谳预留（待填）」→「发行终谳（2026-09-14 实测）」，八项全填：tip `8a8798c9` / run 34857433215 / 4 job 全 success / G-B 用户声明 2026-09-14「通过」2026.9.15（用户本人签，agent 未代签）/ G-C 三 URL live 200 / tag `v2026.9.15` @ `cc30edcc` / AMO+Edge 已过审上线·CWS 可选未上架 / 结论「三门合取达成 → 2026.9.15 已发布，后续 tag/商店仍须用户另令」；③ 三条旧 G-A run（34773593267、34778641702、34808080000）语义列标 **Superseded**（保留不删，审计链不断；34773593267 仍作 §四 豁免签名基线）；④ 「有且只有一个现役状态块」页内硬契约写入 §三 与 §六 双处，并禁止「新建第二张状态表 / 只改标题不改结论块 / 静默删旧块」；⑤ 按 git 血缘把 tip `41fcf1e4`（GitButler 工作区临时提交，`merge-base --is-ancestor` = NO）修正为 `8a8798c9`（现役 tag `v2026.9.15` target `cc30edcc` 的祖先）；⑥ A-061 回填 implemented；⑦ 具名 **F-113-01**：2026-09-15 实测 Pages demo 渲染 v2026.9.12 ≠ 现役 v2026.9.15，9.15 波次 G-C 定义为三 URL 200 故不计入 9.15 判定，按 9.20 B75 欠账跟踪；零源码/测试改动；报告 reports/113-report.md）
```
