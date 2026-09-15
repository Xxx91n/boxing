# Plan — Wave9.20 实施 + 发行门

> 数据源: 本目录 decision-ledger.md · spec.md · destination-reconciliation.md
> 红线: tip 仅在 a1acaaac 之上线性追加（D-005②）；第二次 root 导出即停波

## 波次表（D-007 主序，权威）

| 段 | 内容 | 票 | 依赖 |
|---|---|---|---|
| ① P0+门禁 | deleteBookmark 走 commit + 回归 spec；layout 旁路静态门禁 | GH-P0 · GH-gate | 无（最高优先） |
| ② 测试硬化 | B71 zoom-dblclick；B72 innerclip setTimeout；B73 contrast-guard 串 pretest | GH-B71 · GH-B72 · GH-B73 | ① 可并行，主序在后 |
| ③ Pages/G-C | version.json + G-C 升格 + deploy verify + ADR-0017 修订 + B75 并入 | GH-pages | 无硬依赖，主序在②后 |
| ④ 文档收口 | release-status 单一状态块；B74 DESIGN；B77 CHANGELOG | 01-release-status · 02-B74 · 03-B77 | ①–③ 可穿插 |
| ⑤ 发行 G-A | calver 2026.9.20 齐面后新 tip test.yml 全绿；豁免按 105 撤账至 0 active F | 执行动作 | ①–④ land |
| 出口 | 等用户 G-B（2026.9.20+日期）；G-C 复检；tag/商店另令 | — | ⑤ 绿 |

## 票务索引（D-007）

### GitHub Issue（**建票须用户下令实施后**，D-008）

| 占位名 | 对应 | 段 |
|---|---|---|
| GH-P0 | deleteBookmark + never-quarantine 回归（open: add/reorder 是否同票） | ① |
| GH-gate | 静态门禁：layout 删除/改写不得绕过 mutationHandlers | ① |
| GH-pages | G-C 升格 + deploy verify + ADR-0017/publishing-guide 修订 + B75 | ③ |
| GH-B71 | N-101-06 zoom-dblclick 异源签名 | ② |
| GH-B72 | N-106-01 innerclip setTimeout 预算 | ② |
| GH-B73 | contrast-guard 串 pretest | ② |

### Scratch 票（本目录 issues/）

| 文件 | 对应 | 段 |
|---|---|---|
| 01-release-status-single-block.md | D-005① | ④ |
| 02-design-box-zoom-b74.md | B74 | ④ |
| 03-changelog-915-b77.md | B77 | ④ |

## 出口边界（D-006）

- 实施完成 ≠ 可发行。
- G-A = 新 tip 四 job 全绿且 active F=0（豁免 105 撤账）。
- G-B = 用户声明（版本+日期）；禁 agent 代签。
- G-C = D-003 升格断言。
- tag/商店另令；9.15 持有不热修。

## 版本面（D-007）

实施波内 calver 一致推至 **2026.9.20**（manifest×2 / package / notes / CHANGELOG 等，票 100 门禁）。
