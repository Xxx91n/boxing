# 98: 冻结 hack 就地注释（锐评8）

**Covers A-xxx:** A-052

**What to build:** ntp.js 冻结点与 i18n 重复键增加 // frozen by ticket 83/66 及报告指针，不改契约字节。

**Blocked by:** 96, 100

**Status:** done（2026-09-14 首脑复核 · FROZEN 注释实物 + node --check）

## Acceptance criteria

- [x] ntp.js 冻结点有票 83 指针注释 — ntp/ntp.js:578 `FROZEN by ticket 83`（见的 reports/83-report.md §7）
- [x] i18n.js 重复键有票 66 指针注释 — ntp/i18n.js:79 `FROZEN by ticket 66`（见的 reports/66-report.md §2/§5）
- [x] 冻结契约行为不变 — git diff -U0 仅注释行（+18/-0），node --check ×2 绿，npm run build DONE_BUILD，测试见 reports/98-report.md

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的 完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 无 GitHub 镜像（本地票）
- 报告: reports/98-report.md
