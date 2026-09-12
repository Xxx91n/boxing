# 84: popup/ 纳入本波

**Covers A-xxx:** A-034

**What to build:** 评估 popup/ 零改动债，修明显缺陷或书面维持。

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-12 · 首脑 AC 卫生补勾 · terracotta→accent 已落地 · 证据 reports/84-report.md + popup.css 实测)

## Acceptance criteria

- [x] 评估结论入报告 — reports/84-report.md（1 P1 修复 + 4 项书面维持）
- [x] 若改则测试绿 — popup.css terracotta=0 / a3513a=0 / --color-accent=8（W1+W3 实测；无独立 e2e 面）
- [x] 若维持记录理由 — dark mode / i18n 文案 / Recent DFS / bookmarklet 均书面维持

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
