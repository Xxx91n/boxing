# 70: G-A 集合差与根因定谳（H1–H4）

**Covers A-xxx:** A-025, A-037

**What to build:** 对比 run 34626507101 与 34686760142 失败面集合差，对 H1–H4 给出证据化定谳，输出分桶终表。

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-12 · 收口审计 · 定谳报告+evidence 在盘)

## Acceptance criteria

- [x] 产出集合差表（evidence/70-set-diff-evidence.md/.json · A8 / B20 / C20 面，增量 17 / 存量 3 / 消失 5）
- [x] H1–H4 有支持或否证证据（H1 否证 · H2 部分成立 · H3 成立 · H4 否证）
- [x] 终表写入 reports/70-report.md
- [x] 不改豁免台账、不改产品行为

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
