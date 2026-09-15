# 108: 静态门禁：layout 旁路不得绕过 mutationHandlers

**Covers A-xxx:** A-063

**What to build:** pretest/test.yml 能拦下 layout 集合在 handlers 外的删除/改写调用。

**Blocked by:** 107

**Status:** ready-for-agent

## Acceptance criteria

- [ ] 扫描 ntp/** 删除类调用
- [ ] 白名单注释豁免具名
- [ ] 故意旁路 exit 1
- [ ] 接入 pretest 或 test.yml 并记录 lane

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 报告: reports/108-report.md
