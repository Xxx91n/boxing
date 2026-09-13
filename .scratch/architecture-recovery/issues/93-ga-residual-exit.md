# 93: G-A 残红治理出口（test.yml 绿）

**Covers A-xxx:** A-047

**What to build:** main test.yml 全绿或仅存不导致 job failure 的具名 F；作为 2026.9.15 的 G-A 证据。

**Blocked by:** 87, 88, 89

**Status:** done（2026-09-14 · G-A 出口 run https://github.com/Xxx91n/boxing/actions/runs/34773593267 全绿 + corroboration run https://github.com/Xxx91n/boxing/actions/runs/34778641702（tip 02d31657）全绿 · 报告 reports/93-report.md）

## Acceptance criteria

- [x] R1–R3 关闭或具名 F（R1 关闭 · R3 关闭 · R2 具名 F）
- [x] N 桶/数据完整性零豁免
- [x] 附 green run URL；更新账本状态
- [x] reports/93-report.md

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #12
