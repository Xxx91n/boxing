# 71: G-A N 桶修绿

**Covers A-xxx:** A-025

**What to build:** 修复 never-quarantine：data-golden gate4、state-sync 并发、dr-export WebDAV（及定谳为数据面的 AC1/AC2）。

**Blocked by:** 70 ga-set-diff-root-cause

**Status:** done

## Acceptance criteria

- [x] data-golden gate4 绿或退役
- [x] state-sync 并发绿
- [x] dr-export WebDAV 绿
- [x] waiver 无 N 桶行

## Notes

- 跨窗口移交：data-golden gate2 因票 81 `credentials.js` 直接写 `boxingCredKey.v1` 而红；2026-09-12 用户裁定交票 81/81R 处理，可直接套用的补丁方案见 `reports/71-report.md` §6.1。本票 4 项 AC 不受影响，均已达。
- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
