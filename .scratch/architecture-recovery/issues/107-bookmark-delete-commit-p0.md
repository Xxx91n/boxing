# 107: P0 书签删除走 commit + 墓碑

**Covers A-xxx:** A-062

**What to build:** 用户删除单书签后，退出再进/跨表合并不再复活；删除经 commit(deleteBookmark) 写墓碑。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-15 · W1 首脑复核采信 · commit 1a7d572e · 报告 reports/107-report.md）

## Acceptance criteria

- [ ] mutationHandlers.deleteBookmark 返回 tombstoneIds:[bmId]
- [ ] popups 删除按钮走 commit，废弃裸 splice
- [ ] 回归：add→delete→陈旧合并/reload→不复活 + _meta.deleted 含 bmId
- [ ] never-quarantine：禁豁免
- [ ] open note: add/reorder 是否同票收编

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 报告: reports/107-report.md
