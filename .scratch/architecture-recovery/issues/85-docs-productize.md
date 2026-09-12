# 85: 文档产品化

**Covers A-xxx:** A-035

**What to build:** 收敛 agent 工作日志观感，产品向入口清晰。

**Blocked by:** None (can start immediately)

**Status:** done

## Acceptance criteria

- [x] 新人入口清晰 — docs/START-HERE.md 单一路由页 + README/CONTRIBUTING/docs-agents 三处挂载; README 248→207 行, .scratch 引用与票号黑话归零
- [x] 不阻塞 G-A/G-B — 纯文档 + 一个非门禁脚本 (docs-pointer-check.mjs 未挂 pretest、未进必过 CI); 未改 test/CI/门禁/豁免台账任一文件
- [x] 不删唯一证据链 — 3 份 .scratch 报告均 EXISTS; 治理块字节级原样迁至 docs/testing-governance.md, 仅路径前缀改 ../

## Notes

- 版本控制遵循 WORKFLOW §4.2 (已执行: but commit -b 85-docs-productize)
- 完成定义遵循 handoff 内的完成定义 (报告: reports/85-report.md)
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
