# 79R: 79 返工：cluster-map 登记 conflict-copy spec

**Covers A-xxx:** A-029

**What to build:** 返工轮：先复核首脑 W8-W1-brain-review.md 对本票的违规点，再做最小修复，并重跑同一套验收（node --check + import-graph-guard；相关测试）。

**Blocked by:** None (can start immediately)

**Status:** implemented（返工轮 2026-09-12；CM-1 转绿，见 reports/79-report.md 返工轮次节）

## Acceptance criteria

- [x] 已复核 reports/W8-W1-brain-review.md 对应违规条目并写明认同/修正（PV-W8-79-1：认同 — 验证清单补 import-graph-guard；CM-1 按 seam 准则归 storage cluster）
- [x] 修复后 `node scripts/import-graph-guard.mjs` exit 0（CM-1 零命中；残红仅 credentials.js B-6×4，属票 81 范围）
- [x] `node --check` 相关文件 exit 0（storage/settings-ui/i18n 3/3 + cluster-map.json parse OK）
- [x] 报告**追加**写入原 reports/79-report.md，标题含「返工轮次」，不覆盖原记录

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
