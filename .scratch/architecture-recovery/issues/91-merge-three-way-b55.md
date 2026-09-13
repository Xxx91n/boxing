# 91: B55 layout/WebDAV merge 三向整票

**Covers A-xxx:** A-045

**What to build:** 双端同大盒各加小盒后 pull，双方小盒均可见；消灭静默吞没。实施票 80 方案（baseRevision 或等价）。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] 子盒/id 级合并落地
- [ ] 冲突副本 UI（票 79）接线
- [ ] e2e：双端加子盒 → pull → 双方可见
- [ ] 若改 newer-wins 语义，同步更新 80 报告/文档
- [ ] 相关 CI 绿；reports/91-report.md

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #11
