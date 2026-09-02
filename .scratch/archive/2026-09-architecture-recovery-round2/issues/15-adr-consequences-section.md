# 15 — ADR 模板补 Consequences / 复核小节

**What to build:** 更新 docs/adr 模板约定: 新 ADR 必须包含 Consequences 小节与 30 天后复核日期; 在 AGENTS.md 或 docs/agents 指引中加一行引用要求; 存量 16 份 ADR 不批量重写, 自下一票起适用。

**Blocked by:** None — can start immediately

**Status:** done (2026-09-02, ticket-15 window)

- [x] 模板片段落盘 docs/adr 下, 含 Consequences 与复核日期字段 — docs/adr/0000-adr-template.md (1445B, ## Consequences 必填妥协记录 + ## Review 复核日期=决策日期+30天, MADR 4.0+joelparkerhenderson 轮子, 结论复用 ctx source=atomcode-arch-maturity 未重查)
- [x] AGENTS.md/指引内加一行引用, 不复述模板全文 — AGENTS.md L105 (### Domain docs 节) 净增一行: 指向模板 + Consequences/复核日期强制 + 存量 16 份 grandfathered; 净 diff = 1 insertion
- [x] 不动存量 ADR 内容 — git status 证实 docs/adr/ 下仅新增 0000 模板文件, 0001-0016 零改动
