# 101: fire-and-forget 测试族 deflake（B65）

**Covers A-xxx:** A-055

**What to build:** 识别并降低 fire-and-forget 测试族 flaky；清单落盘；N/数据完整性不豁免。

**Blocked by:** 104

**Status:** ready-for-agent

## Acceptance criteria

- [ ] 家族清单落盘
- [ ] deflake 或稳定 skip+票
- [ ] 附 CI 证据

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的 完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #14
- 报告: reports/101-report.md
