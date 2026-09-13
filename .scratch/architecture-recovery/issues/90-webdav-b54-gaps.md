# 90: B54 WebDAV .local 与 opt-in 导出传播

**Covers A-xxx:** A-044

**What to build:** checkUrlValid 正确处理 .local；webdavAllowPrivateHost 在导出/同步路径一致生效。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] 默认仍拒私网
- [ ] opt-in 设置在导出与 pull 路径传播
- [ ] 报告 reports/90-report.md

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: 无
