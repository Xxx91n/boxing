# 93: G-A 残红治理出口（test.yml 绿）

**Covers A-xxx:** A-047

**What to build:** main test.yml 全绿或仅存不导致 job failure 的具名 F；作为 2026.9.15 的 G-A 证据。

**Blocked by:** 87, 88, 89

**Status:** ready-for-agent

## Acceptance criteria

- [ ] R1–R3 关闭或具名 F
- [ ] N 桶/数据完整性零豁免
- [ ] 附 green run URL；更新账本状态
- [ ] reports/93-report.md

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #12
