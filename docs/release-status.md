# Release Status — Boxing 发行状态

> 面向：发布者（用户）、维护者、审计者。只读本页即可知当前版本、三门状态、在效豁免与在办欠账。
> 本页是**状态页**，不是门禁定义：与 [ADR-0017](adr/0017-release-data-gate.md) 冲突时以 ADR-0017 为准，并在此记 `revised`。
> 检查单模板与豁免台账全表见仓库内 `.scratch/architecture-recovery/WORKFLOW.md` §4.4（工作日志层，仅作证据引用）。

**最后核验（Last verified）：2026-09-22** · 现役 tag **`v2026.9.20`** · 现役发行版本 **2026.9.20（已发布）** · GitHub Release 已发布 · 商店 **2026.9.20 已上架（用户声明「已经稳定」）** · G-C version.json=`2026.9.20`

## 一、结论（§三 的投影，非独立状态块）

**现役结论：2026.9.20 三门合取达成 · v2026.9.20 已发布。** tag `v2026.9.20` 已打；GitHub Release 已发布（chrome / firefox / source zip + SHA256SUMS）；商店 **2026.9.20 已上架（用户声明 2026-09-22「已经稳定」）**；G-C `verify:pages-gc` **PASS**（version.json=`2026.9.20`）。9.15 历史不回溯改判。

> 本节只把 §三「发行终谳（2026-09-14 实测）」的结论投影到首屏；**本节不设状态表、不独立陈述门状态**。页内唯一现役状态块是 §三。

三条件为**合取**：任一未满足即禁止打发行标记，不得宣称可发行（ADR-0017）。

## 二、当前版本

| 面 | 值 | 证据 |
|---|---|---|
| 目标发行版本 | 2026.9.15 | `manifest.json` 与 `package.json` version 均为 2026.9.15；`docs/release-notes/2026.9.15.md` |
| 版本面一致性 | 通过 | `scripts/calver-guard.mjs` 接入 pretest（票 100 / A-054） |
| 上一已发布版本（可回滚目标） | 2026.9.15 | AMO + Edge 同日已过审上线（用户声明 2026-09-14）；再上一版 2026.9.12 仍在架，但为事故版 —— 连续两次回滚会回到它 |
| 当前 tip | `8a8798c9` | 发行 G-A 证据提交；现役 tag `v2026.9.15` target = `cc30edcc`（`8a8798c9` 为其祖先）。原记 `41fcf1e4` 系 GitButler 工作区临时提交，不在 HEAD 血缘内，票 113 按 git 血缘修正 |

回滚口径：CWS = 以新版本号重发上一版（注意连续两次回滚会回到事故版）；AMO = 回退至上一已批准版本，且限退一版、按 24h 更新窗口生效。

## 三、三门状态（页内唯一现役状态块）

> **单一状态块契约**：本页**有且只有一个现役状态块** = 本节（三门状态 + 发行终谳）。§一 只投影本节结论；§四 / §五 只承载证据与欠账；其余各节不得再陈述门状态、不得新建第二张状态表。

| 门 | 状态 | 证据 | 说明 |
|---|---|---|---|
| **G-A CI** | **达成** | run [35694278677](https://github.com/Xxx91n/boxing/actions/runs/35694278677) 四 job 全 success | 2026-09-22 终谳 |
| **G-B 人工黄金路径** | **达成（用户声明）** | 2026-09-22 用户声明「人工已经声明通过，执行人 **Xxx91n**」2026.9.20 | 禁止 agent 代签 |
| **G-C Pages** | **达成（升格口径）** | `npm run verify:pages-gc` **G-C PASS** expected=**2026.9.20** · version.json=`2026.9.20` deployedAt=2026-09-22T08:23:10Z · 三 URL 200 | deploy run [35704498181](https://github.com/Xxx91n/boxing/actions/runs/35704498181) + deploy-tail 收敛 |

### G-C 实测锚点（2026-09-14）

| URL | 结果 |
|---|---|
| `https://xxx91n.github.io/boxing/demo/` | 200 · 渲染 NTP 预览界面 |
| `https://xxx91n.github.io/boxing/demo/ntp.css` | 200 · 返回样式表正文 |
| `https://xxx91n.github.io/boxing/privacy-policy.html` | 200 · 含政策正文，Last updated 2026-09-12 |

### G-C 2026-09-15 实测（升格口径 · 票 109 / A-064）

| 项 | 实测值 |
|---|---|
| 三 URL live | `demo/` 200 · `demo/ntp.css` 200 · `privacy-policy.html` 200 |
| `demo/version.json?<cache-buster>` | `version=2026.9.12` · `deployedAt` 缺失（旧产物） |
| 最新 release tag | `v2026.9.15` |
| 判定 | **MISMATCH → G-C 不成立（升格口径）**；旧口径（仅 200）会误判为达成 |
| 根因 | release 触发的 `demo-deploy` run [34860199679](https://github.com/Xxx91n/boxing/actions/runs/34860199679) **deploy job 0 step、2 秒内失败** = `github-pages` environment 未放行 tag 引用；dispatch（main）同流程成功（run 34741247614） |
| 处置 | 需**人工**放行 environment tag（`v*`）；放行前 release 触发的 Pages 同步不会发生 |

### G-A 历史证据（全部 **Superseded**，保留不删）

| run | tip | 结果 | 语义 |
|---|---|---|---|
| 34773593267 | 16ce5d27 | 4 job 全 success / 0 failed | **Superseded**（票 93 G-A 出口，被 2026-09-14 终谳 run 34857433215 取代）—— 保留：仍作 §四 豁免失败签名基线 |
| 34778641702 | 02d31657 | 4 job 全 success / 0 failed | **Superseded**（同码重跑佐证，被 34857433215 取代） |
| 34808080000 | 9fa4666c | 全绿 | **Superseded**（**中间里程碑**：满足 GH #10–#12 关票 AC，**不等于**发行终谳，禁止冒充） |

语义约定：被新证据取代的旧证明保留并标 **Interim / Superseded**，不删除——审计链不断裂。

### 发行终谳（2026-09-14 实测）

| 项 | 值 |
|---|---|
| 发行 tip | `8a8798c9`（G-A 证据提交；现役 tag `v2026.9.15` target = `cc30edcc`，`8a8798c9` 为其祖先） |
| 发行 G-A run | [34857433215](https://github.com/Xxx91n/boxing/actions/runs/34857433215) |
| 四 job 结果 | 4 job 全 success / 0 failed |
| G-B 用户声明 | 2026-09-14 用户声明「通过」2026.9.15（Chrome + Firefox 本地 zip）—— 含版本号 + 日期，仅用户本人可签 |
| G-C 发行后复检 | 三 URL live 200（2026-09-14 复测，见下）；**渲染版本 == 现役 tag 未达成** → 具名 **F-113-01** |
| tag / Release | tag `v2026.9.15` @ `cc30edcc` 已打 · GitHub Release 已发布（chrome / firefox / source zip + SHA256SUMS） |
| 商店 | AMO + Edge：2026.9.15 已过审上线（用户声明 2026-09-14）· CWS：可选渠道，本版无上架声明 |
| 结论 | 三门合取达成 → **2026.9.15 已发布**；后续任何 tag / 商店动作仍须用户另一次明令 |

> **具名 F-113-01 — 已收敛（2026-09-22）**：曾渲染 **v2026.9.12**；经 C04 放行 `v*` + demo-deploy run 35701446566 后 version.json=`2026.9.15` == 最新 tag，**收敛**。原文：2026-09-15 实测 Pages demo 渲染 v2026.9.12。9.15 波次 G-C 定义为「三 URL live 200」，故不计入 9.15 G-C 判定；该项按 9.20 波次 B75 欠账（demo `version.json` == 最新 tag）跟踪。**2026-09-15 补充根因**：`version.json` 实测 `2026.9.12`、最新 tag `v2026.9.15`；release 触发的 deploy job 被 `github-pages` environment 保护规则拦截（run 34860199679，0 step、2 秒失败），dispatch（main）成功 —— 故 Pages 停在 2026-09-13 的 dispatch 产物。B75 已由票 109 吸收关闭。

## 四、在效豁免（Waiver Ledger）

机器校验：`node scripts/waiver-ledger-check.mjs` → **exit 0**（2026-09-22 C01 处置后：台账 4 行 = 3 closed + 1 expired-handled；**active=0**；无过期；never-quarantine 零命中；撤账判据节存在）。

| 状态 | 用例 | 基线 run | 归属票 | 到期 |
|---|---|---|---|---|
| closed | `boxing-empty-state-buttons` › Bug5-dark | 34773593267 | 93 | 2026-09-19 | C01 2026-09-22：A-055 已修 + 105 双绿撤账（34857433215 + 34955347673） |
| expired-handled | `boxing-zoom-dblclick` › single click enters; later dblclick… | 34773593267 | 93 | 2026-09-19 | C01 2026-09-22：票110 已修；105 双绿不足 → 非 active 非续期；用例保留 |
| closed | `boxing-search` › search filters large boxes by title | 34773593267 | 93 | 2026-09-19 | C01 2026-09-22：A-055 已修 + 105 双绿撤账 |
| closed | `boxing-auto-expand` › large box with collapseHover=true still expands（chromium） | 34626507101 | 48 | 已撤账（票 93，2026-09-14） |

硬约束：

- 三条 active 均属 **F（flaky）** 桶；**N（never-quarantine）与数据完整性类永不豁免**。
- **撤账判据（票 105 / B69）**：`closed` 行须满足「**≥2 连续 main 全绿 run 且签名零出现，其中 ≥1 次须为同码 corroboration run**」——单 run 零出现**不构成**撤账（票 74 撤账过早事故：`boxing-zoom-dblclick` 单 run 撤账后于下一 run 复发）；**仅 F 可撤账**，**B 无撤账路径**（只能修或书面退役），**N 永不入账/永不撤账**；**复发即重新入账**；撤账 ≠ 豁免成立 ≠ G-A 达成。
- 到期未修 → 主 lane 禁用或删除并回填处置记录；禁止无动作续期（棘轮：豁免文件只许缩小）。
- 逐行失败签名与最新基线 run 的人工比对，是每次发行 G-A 步骤的必做项。
- 台账全表与签名正文见 `.scratch/architecture-recovery/WORKFLOW.md` §4.4（工作日志层证据）。

## 五、在办欠账（A 账本 A-050..A-061）

| 条目 | 内容 | 票 | 状态 |
|---|---|---|---|
| A-050 | AI Docs Governance 死链灭红 | 96 | implemented |
| A-051 | docs 层 live Release status（本页） | 97 | implemented |
| A-052 | 锐评8：`ntp.js` / `i18n.js` 冻结注释 | 98 | implemented |
| A-053 | B63 locale README 与 Release status 版本口径对齐 | 99 | 进行中 |
| A-054 | B64 calver 一致性门禁 | 100 | implemented |
| A-055 | B65 fire-and-forget 测试族 deflake | 101 | 进行中 |
| A-056 | B66 亮色 bm-add-btn 对比度 | 102 | implemented |
| A-057 | B67 DESIGN.md hairline 语义 | 103 | implemented |
| A-058 | B68 boot-theme 早退 failsafe | 104 | done-with-named-F |
| A-059 | B69 撤账判据写入规则 | 105 | implemented |
| A-060 | B70 innerclip firefox 本地 flaky（CI 复现则修，否则书面结案） | 106 | 进行中 |
| A-061 | 发行终谳 G-A 绑最终 tip 四 job 全绿 + 等 G-B | 无票（执行） | implemented（票 113 / 2026-09-15 回填：终谳见 §三「发行终谳（2026-09-14 实测）」） |

A-058 的具名 F：`no-mirror` e2e chromium 启动超时（环境性），源码契约测试绿。

## 六、如何更新本页（防过时契约）

**单一状态块（页内硬契约）**：本页**有且只有一个现役状态块** = §三（三门状态 + 发行终谳）。§一 只投影 §三 的结论，**不得**另设状态表或独立陈述门状态；§四 / §五 只承载证据与欠账。更新结论必须**同一次编辑同时**改 §三 与 §一 投影句——只改其一 = 非法中间态。新增结论前必须先把旧结论块标 **Superseded**（保留不删，审计链不断裂）。

1. **tip 变更或 G-A 重跑**：更新页首「最后核验」与 tip，把新 run 写入 G-A 行；旧 run 改标 Interim / Superseded，不删除。
2. **发行前**：先跑 `node scripts/waiver-ledger-check.mjs`（exit 非 0 即阻断），再逐行比对失败签名与最新基线 run 日志。
3. **豁免变动**：同步第四节表格；closed 行保留。
4. **A 账本变动**：同步第五节表格。
5. **G-B 达成**：仅在用户给出含版本号 + 日期的 pass 声明后，方可把 G-B 改为达成，并把声明与日期记入本页。
6. **三门齐备**：才允许把第一节结论改为可发行；tag 与商店提交仍须用户另一次明令。

禁止：agent 代签 G-B；用中间里程碑 34808080000 冒充本波 land 后的发行 G-A；在 G-A / G-B 未齐时把结论改为可发行；在 §一 或其余节新建第二张状态表；只改标题不改结论块（或反之）造成非法中间态；把旧结论块静默删除而非标 Superseded。

## 七、来源与交叉引用

- 门禁定义：[ADR-0017 Release Data Gate](adr/0017-release-data-gate.md)
- 发布路径：[发行指南](publishing-guide.md) · [上架计划](store-publishing-plan.md)
- 测试治理（隔离登记 / 事故登记）：[testing-governance.md](testing-governance.md)
- 检查单模板与豁免台账全表：`.scratch/architecture-recovery/WORKFLOW.md` §4.4（工作日志层）
- 本页由票 97（A-051）建立，报告：`.scratch/architecture-recovery/reports/97-report.md`；票 113（A-068）收敛单一现役状态块，报告：`.scratch/architecture-recovery/reports/113-report.md`

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-14 | 票 97 / A-051 建立本页；G-C 三 URL 实测 200；豁免台账 exit 0 |
| 2026-09-14 | 票 105 / A-059：撤账判据（≥2 连续 main 全绿 + N/B/F 约束）写入 WORKFLOW §4.4 与 testing-governance.md；waiver-ledger-check 扩展为机器校验（closed 行须 ≥2 run 撤账证据） |
| 2026-09-15 | 票 107–116 land origin/main tip `2f167ca7`；版本面 2026.9.20；**G-B 用户声明「测试通过」2026.9.20**（zip 黄金路径）；G-A CI / G-C Pages 待发行动作 |
| 2026-09-22 | **2026.9.20 三门齐 + 发行**：G-A 35694278677 · G-B Xxx91n · G-C PASS（version.json=2026.9.20）· tag/Release v2026.9.20 · 商店已上架（用户「已经稳定」）· AMO lint 清零（去 data_collection_permissions + innerHTML→textContent）· 多余 zip/crx 清理（15→2） |
| 2026-09-15 | 票 113 / A-068：收敛单一现役状态块 —— 删/降级 §一 矛盾表（改为 §三 投影句）；§三 发行终谳填 2026-09-14 实测；三条旧 G-A run 标 **Superseded**；新增「有且只有一个状态块」页内硬契约（§三 / §六）；按 git 血缘把 tip `41fcf1e4` 修正为 `8a8798c9`（现役 tag `v2026.9.15` @ `cc30edcc`）；录具名 F-113-01（demo 渲染 v2026.9.12） |
