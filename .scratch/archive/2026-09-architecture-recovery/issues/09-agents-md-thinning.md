# 09 — AGENTS.md 薄化

**What to build:** 拆分结构落地后, 把 AGENTS.md 中已被模块边界、测试或 ADR 承担的规则 (BX-DEV / A1-A5 禁令类) 删除或降级为指向结构的一句话指针。只保留不可从仓库推断的约定: 测试命令、ADR 指针、SEC 硬规则。

**Blocked by:** 08

**Status:** done (2026-09-01, closure fix by brain: header was stale ready-for-agent, boxes were full — see README 收口)

- [x] 每条被删规则在 commit message 中点名其替代承担者 (哪个模块/哪个测试/哪份 ADR)
- [x] SEC 系列与"不可推断约定"保留原样
- [x] 残余 AGENTS.md 引用全部有效 (无指向已删结构的悬空规则)
