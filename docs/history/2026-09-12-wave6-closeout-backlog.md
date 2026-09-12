# Wave6 收口 backlog（由首脑呈报，是否立票由用户裁定）

> 日期: 2026-09-12 · 来源: 票 48–59 收口 / 复核 caveat / ledger 结算

| ID | 事项 | 优先级 | 建议 |
|---|---|---|---|
| B30 | G-A：main test.yml 全绿定谳（land 后 CI 34672647167 等）；豁免台账 2026-09-19 到期处置 | P0 | CI 完成后复核 |
| B31 | G-B：用户按 evidence/49 执行卡实机勾选并回传 | P0 | ready-for-human |
| B32 | #9：G-A+G-B 完成后 close 并链证据 | P0 | 绑 B30/B31 |
| B33 | 51/54/59 local issue AC 关账勾选（代码已 land） | P1 | 票务卫生 |
| B34 | data-golden gate4 跨页 flaky（revision 3vs4） | P1 | 并入状态同步治理或独立票 |
| B35 | 56 后续：legacy-reader-frozen.mjs 接线落地 | P2 | 设计已在 ADR/报告 |
| B36 | 55 后续：冲突副本解决 UI 实施 | P2 | A-003 deferred |
| B37 | 57：ADR-0017 复核 2026-10-12 | P2 | 日历 |
| B38 | 镜像 codeberg/gitlab 残留功能分支清理 | P2 | 用户手动 |
| B39 | 过程违规台账：V6-51/52/54/58/59 等 | P2 | 不追认，仅归档 |

## 发行门禁现状（ADR-0017）

| Gate | 状态 |
|---|---|
| G-A CI | **未定谳**（main 已 land Wave6，Test pending） |
| G-B 人工 | **未满足** |
| G-C Pages | 已满足 |
| 结论 | **仍不可 tag / 不可宣称可发行** |
