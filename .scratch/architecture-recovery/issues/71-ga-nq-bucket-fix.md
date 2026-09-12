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

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
