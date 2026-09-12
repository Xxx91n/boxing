# 72: G-A B 桶 broken 修绿

**Covers A-xxx:** A-025

**What to build:** 修复三 OS/双浏览器一致失败面：conn-delete、innerclip、search、zoom-arrow、Bug5-dark、star-sync 等（以 70 终表为准）。

**Blocked by:** 70 ga-set-diff-root-cause

**Status:** done (2026-09-12)

## Acceptance criteria

- [x] 70 终表 B 桶用例绿（chromium 52/52 + firefox 52/52；13 面实红全绿，第 14 条为环境性 launch 超时，见 reports/72-report.md §6）
- [x] 不向豁免台账加 broken 行（未改 waiver ledger）
- [x] node --check / import-graph-guard 通过（node --check ntp/ntp.js + ntp/storage.js exit 0；guard ok 0 violations；git diff --check 干净）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
