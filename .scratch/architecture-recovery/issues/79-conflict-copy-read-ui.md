# 79: 冲突副本读取口

**Covers A-xxx:** A-029

**What to build:** 设置数据区列表展示 conflict 副本并支持单条导出 JSON。

**Blocked by:** None (can start immediately)

**Status:** implemented（源码+测试落地；e2e 取证走 CI，见 reports/79-report.md）

## Acceptance criteria

- [x] 列表可见（refreshDataHealth 渲染 ts/reason/side/size + per-row Export；有副本时 UI 非空，无副本时 hidden）
- [x] 单条导出可用（exportConflictCopy 下载 boxing-conflict-<ts>.json，含 verbatim entry）
- [x] 不改归档写入语义（只读 getter getConflictArchive；archiveConflictLayouts 未动；spec AC3 断言 index/body 不变）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
