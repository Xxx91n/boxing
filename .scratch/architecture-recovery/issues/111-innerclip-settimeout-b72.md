# 111: B72 innerclip setTimeout 预算（N-106-01）

**Covers A-xxx:** A-066

**What to build:** innerclip 相关 spec 具备明确超时预算，装置层争用不再误伤。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-15 · 两 spec 各加 test.setTimeout(120_000)+书面理由（票 13 同签名同形）；断言逐字未动；firefox/chromium 双车道 4/4，workers=4 争用亦 4/4；waiver-ledger-check exit 0（台账零改动）；docs/testing-governance.md 观察行 closed 2026-09-15；具名残余 N-111-01（locale-readme-guard 既有红，属 113/99 面）· N-111-02（worker 预热 fixture）· 报告 reports/111-report.md）

## Acceptance criteria

- [x] 为相关 spec 设合理 test.setTimeout 预算或等价稳定性措施
- [x] 不扩大豁免面
- [x] testing-governance 观察行可结案更新

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 报告: reports/111-report.md
