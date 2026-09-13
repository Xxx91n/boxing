# 89: R3 auto-expand collapseHover 去 flaky

**Covers A-xxx:** A-043

**What to build:** auto-expand enter+exit 回归稳定；不再作为 ubuntu flaky 拖垮 job。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance criteria

- [x] 稳定通过（本地锚点：CI worker 数 --repeat-each=3 --workers=2 → 6/6；负例具名 "pointer intercepted by DIV#onboarding-overlay"；禁止 silent 永久 skip 已遵守）
- [ ] CI 证据（**待补**：本票分支未 push，遵循 WORKFLOW §4.2；本地证据链 + 全量 595 passed/5 skipped 见 reports/89-report.md §4）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: 无
