# 109: G-C 升格：version.json 新鲜度 + deploy verify

**Covers A-xxx:** A-064

**What to build:** 发行后 Pages demo version == 最新 tag；部署尾部自动 verify；人工检查单保留。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance criteria

- [x] build-demo 稳定产出 version.json={version,deployedAt}（含回读校验与版本归一化）
- [x] G-C=三 URL 200 且 version==最新 release tag（cache-buster）（gate 模式；线上实跑 MISMATCH 红）
- [x] demo-deploy.yml deploy 尾部 verify ≤180s（Verify Pages freshness 位于 Deploy 之后）
- [x] ADR-0017 G-C 行 + publishing-guide + release-status 显式修订（保留原句 + 追加修订段）
- [x] 吸收关闭 B75（backlog 行标已关闭；demo 渲染版本机器化）
- [x] 核查 environment 放行 tag、Pages 仅 Actions（Pages=Actions 单一 ok；environment 未放行 tag -> 需人工放行 v*）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 报告: reports/109-report.md
