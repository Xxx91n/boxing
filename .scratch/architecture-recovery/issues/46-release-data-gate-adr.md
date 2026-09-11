# 46 — 发行数据门禁策略 + ADR-0017 + 发行检查单

**What to build:** 将「CI 绿 + 人工 zip 黄金路径 + HTTP 200」写入 ADR-0017 与 WORKFLOW；发行检查单模板；明确红灯禁 tag/禁宣称可发行；记录 2026-09-12 事故教训。

**Blocked by:** 40,42,45

**Status:** ready-for-agent

- [ ] docs/adr/0017 存在且含 Consequences + 审阅日期
- [ ] WORKFLOW 含发行门禁节
- [ ] CONTEXT.md 增补容灾术语（snap.v1 / fork restore / pre-update snapshot）
- [ ] 检查单可被子窗口逐项勾选
