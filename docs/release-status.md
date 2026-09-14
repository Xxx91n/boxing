# Release Status — Boxing 发行状态

> 面向：发布者（用户）、维护者、审计者。只读本页即可知当前版本、三门状态、在效豁免与在办欠账。
> 本页是**状态页**，不是门禁定义：与 [ADR-0017](adr/0017-release-data-gate.md) 冲突时以 ADR-0017 为准，并在此记 `revised`。
> 检查单模板与豁免台账全表见仓库内 `.scratch/architecture-recovery/WORKFLOW.md` §4.4（工作日志层，仅作证据引用）。

**最后核验（Last verified）：2026-09-14** · 核验时 tip `41fcf1e4` · 目标发行版本 **2026.9.15**

## 一、结论：不可发行

| 项 | 值 |
|---|---|
| 可发行（G-A ∧ G-B ∧ G-C） | **否** |
| 已满足 | G-C（三 URL live 200，2026-09-14 实测） |
| 未满足 | G-A（待新 tip 定谳）· G-B（待用户声明） |
| 唯一合法对外表述 | 「不可发行」 |
| tag / 商店提交 | 禁止；三门齐备后仍须用户另一次明令 |

三条件为**合取**：任一未满足即禁止打发行标记，不得宣称可发行（ADR-0017）。

## 二、当前版本

| 面 | 值 | 证据 |
|---|---|---|
| 目标发行版本 | 2026.9.15 | `manifest.json` 与 `package.json` version 均为 2026.9.15；`docs/release-notes/2026.9.15.md` |
| 版本面一致性 | 通过 | `scripts/calver-guard.mjs` 接入 pretest（票 100 / A-054） |
| 上一已发布版本（可回滚目标） | 2026.9.12 | AMO + Edge 已上线（用户声明，2026-09-13） |
| 当前 tip | `41fcf1e4` | 本页核验时的工作区 tip |

回滚口径：CWS = 以新版本号重发上一版（注意连续两次回滚会回到事故版）；AMO = 回退至上一已批准版本，且限退一版、按 24h 更新窗口生效。

## 三、三门状态

| 门 | 状态 | 证据 | 说明 |
|---|---|---|---|
| **G-A CI** | 未定谳（在效证据为中间里程碑） | 中间 G-A run [34808080000](https://github.com/Xxx91n/boxing/actions/runs/34808080000) @ `9fa4666c` | 仅中间里程碑，**不是发行终谳**；B 轨 land 后 tip 已前进 18 个提交，发行 G-A 须对新 tip 重跑 `test.yml` 四 job 全绿 |
| **G-B 人工黄金路径** | 未达成 | 无 | 仅可由**用户**对发行 zip 解包产物声明 pass（须含 2026.9.15 + 日期）；禁止 agent 代签或伪造 |
| **G-C Pages** | 达成 | 三 URL live HTTP 200（2026-09-14 实测） | 见下表 |

### G-C 实测锚点（2026-09-14）

| URL | 结果 |
|---|---|
| `https://xxx91n.github.io/boxing/demo/` | 200 · 渲染 NTP 预览界面 |
| `https://xxx91n.github.io/boxing/demo/ntp.css` | 200 · 返回样式表正文 |
| `https://xxx91n.github.io/boxing/privacy-policy.html` | 200 · 含政策正文，Last updated 2026-09-12 |

### G-A 历史证据（已被新 tip 取代为中间态，保留不删）

| run | tip | 结果 | 语义 |
|---|---|---|---|
| 34773593267 | 16ce5d27 | 4 job 全 success / 0 failed | 连续绿基线之一（票 93 G-A 出口） |
| 34778641702 | 02d31657 | 4 job 全 success / 0 failed | 同码重跑佐证 |
| 34808080000 | 9fa4666c | 全绿 | **中间里程碑**：满足 GH #10–#12 关票 AC，不等于发行终谳 |

语义约定：被新证据取代的旧证明保留并标 **Interim / Superseded**，不删除——审计链不断裂。

### 发行终谳预留（待填）

| 项 | 值 |
|---|---|
| 新 tip | （待填：B 轨 land 后的最终 tip） |
| 发行 G-A run URL | （待填） |
| 四 job 结果 | （待填） |
| G-B 用户声明 | （待填：2026.9.15 + 日期，仅用户可签） |
| G-C 发行后复检 | （待填：三 URL 200 且渲染版本 == v2026.9.15） |
| 结论 | （待填） |

## 四、在效豁免（Waiver Ledger）

机器校验：`node scripts/waiver-ledger-check.mjs` → **exit 0**（2026-09-14 实测：台账 4 行、字段齐全、无过期、never-quarantine 零命中**含 closed 行**、撤账判据节存在；票 105 扩展后并校验 closed 行撤账证据 ≥2 run）。

| 状态 | 用例 | 基线 run | 归属票 | 到期 |
|---|---|---|---|---|
| active | `boxing-empty-state-buttons` › Bug5-dark：bm-add-btn 暗色透明（ubuntu firefox + chromium） | 34773593267 | 93 | 2026-09-19 |
| active | `boxing-zoom-dblclick` › single click enters; later dblclick inner creates one small box（windows firefox） | 34773593267 | 93 | 2026-09-19 |
| active | `boxing-search` › search filters large boxes by title on main canvas（macos firefox） | 34773593267 | 93 | 2026-09-19 |
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
| A-061 | 发行终谳 G-A 绑最终 tip 四 job 全绿 + 等 G-B | 无票（执行） | 进行中 |

A-058 的具名 F：`no-mirror` e2e chromium 启动超时（环境性），源码契约测试绿。

## 六、如何更新本页（防过时契约）

1. **tip 变更或 G-A 重跑**：更新页首「最后核验」与 tip，把新 run 写入 G-A 行；旧 run 改标 Interim / Superseded，不删除。
2. **发行前**：先跑 `node scripts/waiver-ledger-check.mjs`（exit 非 0 即阻断），再逐行比对失败签名与最新基线 run 日志。
3. **豁免变动**：同步第四节表格；closed 行保留。
4. **A 账本变动**：同步第五节表格。
5. **G-B 达成**：仅在用户给出含版本号 + 日期的 pass 声明后，方可把 G-B 改为达成，并把声明与日期记入本页。
6. **三门齐备**：才允许把第一节结论改为可发行；tag 与商店提交仍须用户另一次明令。

禁止：agent 代签 G-B；用中间里程碑 34808080000 冒充本波 land 后的发行 G-A；在 G-A / G-B 未齐时把结论改为可发行。

## 七、来源与交叉引用

- 门禁定义：[ADR-0017 Release Data Gate](adr/0017-release-data-gate.md)
- 发布路径：[发行指南](publishing-guide.md) · [上架计划](store-publishing-plan.md)
- 测试治理（隔离登记 / 事故登记）：[testing-governance.md](testing-governance.md)
- 检查单模板与豁免台账全表：`.scratch/architecture-recovery/WORKFLOW.md` §4.4（工作日志层）
- 本页由票 97（A-051）建立；报告：`.scratch/architecture-recovery/reports/97-report.md`

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-14 | 票 97 / A-051 建立本页；G-C 三 URL 实测 200；豁免台账 exit 0 |
| 2026-09-14 | 票 105 / A-059：撤账判据（≥2 连续 main 全绿 + N/B/F 约束）写入 WORKFLOW §4.4 与 testing-governance.md；waiver-ledger-check 扩展为机器校验（closed 行须 ≥2 run 撤账证据） |
