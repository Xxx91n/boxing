# 96: docs-gov dead-link 修绿

**Covers A-xxx:** A-050

**What to build:** AI Docs Governance Dead-link check 在 main 恢复 success：修 naive regex 与/或 AGENTS/CONTEXT 链接写法，不得静默删检查。

**Blocked by:** None (can start immediately)

**Status:** implemented-pending-ci（2026-09-14 首脑复核 · 本地 guard 全绿；AC1/2 CI 具名 F 待 push）

## Acceptance criteria

- [x] AGENTS/CONTEXT 仍保留 agents/history 引用能力（本机 8/8 OK）
- [ ] 修复后 tip 上 AI Docs Governance conclusion=success（具名 F · 待 push）
- [ ] 附 green run URL（具名 F · 待 push）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的 完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #13
- 报告: reports/96-report.md
