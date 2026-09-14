# 105: 撤账判据写入规则（B69）

**Covers A-xxx:** A-059

**What to build:** 将「≥2 连续 main 绿才撤 flaky 帐」等判据写入测试治理/豁免规则。

**Blocked by:** 97

**Status:** done（2026-09-14 · 撤账判据写入 WORKFLOW §4.4 + docs/testing-governance.md + docs/release-status.md；waiver-ledger-check 机器校验 5/5 负向对照咬合 · 报告 reports/105-report.md）

## Acceptance criteria

- [x] 规则文档含连续绿次数与 N/B/F 约束（≥2 连续 main 全绿；仅 F 可撤账 / B 无撤账路径 / N 永不出账）
- [x] 与 ADR-0017 书面豁免规则不冲突（撤账仅改变残红是否在效，不构成豁免成立/G-A 达成，不放松三门合取与不得永久豁免）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的 完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 无 GitHub 镜像（本地票）
- 报告: reports/105-report.md
