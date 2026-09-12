# 61 — README 发行声明收窄（P1）

**What to build:** README 只陈述已发布事实，不再暗示当前 main/未过门禁包 ready-to-use。

**Blocked by:** None (can start immediately)

**Status:** done（票 86 关账 2026-09-12：票面=源码实测一致，证据 reports/86-report.md；PV-W7-61-1 已处置）

**覆盖 A-xxx:** A-015

- [x] Install/徽章区改为 Latest published release: v2026.9.11（或等价真实表述）—— 实测：两徽章 + IMPORTANT 均 v2026.9.11
- [x] 说明后续构建须过 G-A/G-B/G-C 后发布；候选保持 draft/pre-release 语义 —— README IMPORTANT + CHANGELOG [Unreleased] 头部在文
- [x] CHANGELOG 补 v2026.9.11 条目或显式跳版说明 —— 实测 ## [2026.9.11] - 2026-09-09 条目存在
- [x] 全文不得出现「2026.9.12 / main 包 ready-to-use」类宣称 —— 实测 README/CHANGELOG/docs/i18n README：ready-to-use 0 命中、2026.9.12 0 命中
- [x] 与 ADR-0017 一致性自检写入报告 —— reports/61 §ADR-0017 一致性自检在案；门禁合取未被本票修改
