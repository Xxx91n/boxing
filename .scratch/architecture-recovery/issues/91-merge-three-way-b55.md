# 91: B55 layout/WebDAV merge 三向整票

**Covers A-xxx:** A-045

**What to build:** 双端同大盒各加小盒后 pull，双方小盒均可见；消灭静默吞没。实施票 80 方案（baseRevision 或等价）。

**Blocked by:** None (can start immediately)

**Status:** blocked-rework（91R）— 凭据 + fileURLToPath · 见 W1-brain-review

## Acceptance criteria

- [x] 子盒/id 级合并落地（utils.mergeChildrenById/mergeLayoutThreeWay + sync-engine 三参化）
- [x] 冲突副本 UI（票 79）接线（webdav-child-conflict 经归档键族入读取口；performBackup 反馈；e2e AC2 断言）
- [x] e2e：双端加子盒 → pull → 双方可见（boxing-merge-three-way.spec.ts AC1；执行证据=CI）
- [x] 未改 newer-wins 语义；80 报告 §6.1 + ADR-0009 修订 + CONTEXT 行已同步
- [ ] 相关 CI 绿（具名 F-91-CI，待大脑派发 run）；reports/91-report.md ✅

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #11
