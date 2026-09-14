# 100: calver 一致性门禁（B64）

**Covers A-xxx:** A-054

**What to build:** manifest/package/release-notes 等版本面一致性校验接入 pre-commit 或 CI，不一致非零退出。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-14 首脑复核 · pretest/负向实测）

## Acceptance criteria

- [x] 覆盖 manifest version+version_name、package.json、对应 release-notes 文件名
- [x] 失败时非零退出（负向 exit 1）
- [x] 策略与仓库约定一致或书面说明（报告 AC-3）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的 完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 无 GitHub 镜像（本地票）
- 报告: reports/100-report.md
