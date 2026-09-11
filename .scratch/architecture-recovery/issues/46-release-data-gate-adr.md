# 46 — 发行数据门禁策略 + ADR-0017 + 发行检查单

**What to build:** 将「CI 绿 + 人工 zip 黄金路径 + HTTP 200」写入 ADR-0017 与 WORKFLOW；发行检查单模板；明确红灯禁 tag/禁宣称可发行；记录 2026-09-12 事故教训。

**Blocked by:** 40,42,45

**Status:** done（2026-09-12，票 46 子窗口；证据见 reports/46-release-data-gate-adr-report.md）

- [x] docs/adr/0017 存在且含 Consequences + 审阅日期 → docs/adr/0017-release-data-gate.md（Review 复核日期 2026-10-12）
- [x] WORKFLOW 含发行门禁节 → WORKFLOW.md §4.4（G-A/G-B/G-C 合取 + 渠道条款 + 检查单模板 + 复盘义务）
- [x] CONTEXT.md 增补容灾术语（snap.v1 / fork restore / pre-update snapshot）→ §Data Resilience & Release Gate（8 词条）
- [x] 检查单可被子窗口逐项勾选 → §4.4 代码块模板，逐行 `- [ ]` 形态
