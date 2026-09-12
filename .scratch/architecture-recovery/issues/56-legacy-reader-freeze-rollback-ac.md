# 56 — legacyReader 冻结读端升格 rollback AC（P2）

**What to build:** 将 migration-golden-guard 中 legacy 读路径抽为独立冻结模块并升格为 rollback 验收。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-12，票56 窗口；证据 = reports/56-legacy-reader-freeze-rollback-ac-report.md §1–§5，rollback AC 升格条款已落 ADR-0017/CONTEXT.md）

**覆盖 A-xxx:** A-010

- [x] 识别 migration-golden-guard 中 legacy 读路径边界
- [x] 设计独立冻结读端模块接口（可不在本波落地代码）
- [x] rollback AC 列出至少 1 条具名检查项
- [x] 不改主迁移语义
