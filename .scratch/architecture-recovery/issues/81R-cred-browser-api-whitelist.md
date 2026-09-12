# 81R: 81 返工：credentials.js B-6 白名单合规

**Covers A-xxx:** A-031

**What to build:** 返工轮：先复核首脑 W8-W1-brain-review.md 对本票的违规点，再做最小修复，并重跑同一套验收（node --check + import-graph-guard；相关测试）。

**Blocked by:** None (can start immediately)

**Status:** done (81R 返工闭环; 守卫绿 + 报告追加, 见 reports/81-report.md 返工轮次节)

## Acceptance criteria

- [x] 已复核 reports/W8-W1-brain-review.md 对应违规条目并写明认同/修正
- [x] 修复后 `node scripts/import-graph-guard.mjs` exit 0
- [x] `node --check` 相关文件 exit 0
- [x] 报告**追加**写入原 reports/81-report.md，标题含「返工轮次」，不覆盖原记录

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
