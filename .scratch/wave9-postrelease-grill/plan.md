# W9 计划 — 面向 2026.9.15 全部修复

> 唯一数据源: `.scratch/wave9-postrelease-grill/decision-ledger.md`（D-001..D-010）
> 对账: destination-reconciliation.md（无去向=0）
> 日期: 2026-09-13 · 版本控制: GitButler `but` · 禁换 root

## 1. 目标与三轨（D-001）

A 纸面债收口 · B G-A 定谳与修绿 · C 技术债实施。  
出口（D-005）: main `test.yml` 绿（或仅具名 F 且不拖 job）+ 纸面 1–8 落盘 + 2026.9.15 版本就绪。

## 2. 主序（D-002 / D-009）

纸面快赢 ∥ R1 分诊 → R1 修 → R2/R3 → B54 → B55 → 版本 2026.9.15 → G-A 定谳。  
（grill 期间已先完成 B 定谳取证，见 §7）

## 3. 版本与发行姿态（D-004 / D-006）

| 项 | 值 |
|---|---|
| 当前持有 | **v2026.9.12**（不热修、不回撤） |
| 商店 | AMO + Edge **已过审可见 2026.9.12**（user） |
| 下一版本 | **2026.9.15** |
| G-B | 用户声明 pass（版本号+日期）；**禁止 agent 代签**（D-007） |
| G-A | 必须 CI 绿（D-005/007） |
| G-C | Pages/privacy 200 |

## 4. 范围表（D-005 / D-009）

### 必进 1–8

| # | 计划号 | 内容 | Issue |
|---|---|---|---|
| 1 | W9-T1 | R1 star-sync Scenario 1 修绿 | W9-I1 |
| 2 | W9-T2 | R2 empty-state Bug5-dark 分诊+修 | — |
| 3 | W9-T3 | R3 auto-expand 去 flaky | — |
| 4 | W9-P1 | ADR-0017 修订（9.12 强制豁免事实 + G-B 用户声明口径） | 否 |
| 5 | W9-P2 | release-notes 9.12 病句修 + gh release edit 刷新 live | 否 |
| 6 | W9-P3 | README/徽章：store latest=2026.9.12；GitHub latest 动态或 as-of | 否 |
| 7 | W9-P4 | AGENTS.md 去本机绝对路径 + CI grep 门禁 | 否 |
| 8 | W9-P5 | docs/history/README.md 线性追加真话 | 否 |

### 进 .15（B55 整票）

| # | 计划号 | 内容 | Issue |
|---|---|---|---|
| 9 | W9-T5 | B55 merge 三向整票（80 方案实施 + 子盒 e2e） | W9-I2 |
| 10 | W9-T4 | B54 WebDAV 缺口 | — |
| 11 | W9-T6 | B56 boot-pending e2e | — |

### 范围外 user-resolved pass（不立票、不重开）

| # | 项 | 依据 |
|---|---|---|
| 12 | G-B 证据包 | D-005/006/007 |
| 13 | 60 慢放录屏 | D-005/006 |
| 14 | 商店上传 | D-005/006 已过审 |

## 5. P0 Issues（D-010b=C）

| ID | 标题方向 | AC 要点 |
|---|---|---|
| W9-I1 | R1 star-sync B桶修绿 | 三 OS test 不再红该签名；附 run URL |
| W9-I2 | B55 merge 三向 | 双端加子盒 pull 后双方可见；禁静默吞没 |
| W9-I3 | G-A 残红治理出口 | main test.yml 绿或仅具名 F；N 桶禁豁免 |

## 6. 过程约束（D-008 / D-002）

- 在 **b4f3df2 之上线性追加**；禁 force-push 新 root；禁已推送 main 历史手术
- 版本控制仅 GitButler `but`
- 公开文档禁本机绝对路径
- 不宣称 2026.9.12 三门达成；不把 G-B 写成可审计证据包

## 7. 已完成取证（D-003，grill 期）

- 定谳 run: https://github.com/Xxx91n/boxing/actions/runs/34749813393  
- 结论: data-golden 绿；三 OS test 红 → **G-A 不成立**  
- 分桶: R1=B 稳定 · R2=F/B 待分诊 · R3=F  
- 文件: `ga-definitive-b4f3df2.md` · `ga-baseline-34737182812.md`

## 8. 实施清单（执行序，授权后）

1. 纸面 W9-P1..P5（可并行起草；P1 引用 §7）
2. 立 W9-I1..I3
3. W9-T1 → T2/T3 → T4 → T5 → T6
4. 版本串 2026.9.15 + notes
5. CI 定谳 G-A + 用户 G-B 声明 + G-C
