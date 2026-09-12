# 83: 搜索 debounce

**Covers A-xxx:** A-033

**What to build:** 搜索输入 debounce，不改结果语义。

**Blocked by:** None (can start immediately)

**Status:** done — 实现见 ntp/ntp.js（A-033 / 票 83）；报告 reports/83-report.md

## Acceptance criteria

- [x] 停顿后才重查询
- [x] 结果一致
- [x] 不改 renderCanvas 全量重建语义

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
