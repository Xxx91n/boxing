# Wave 5 收口 backlog（由首脑呈报，是否立票由用户裁定）

> 日期: 2026-09-12 · 来源: 票 40–47 收口 / 复核 caveats / decision-ledger deferred

| ID | 事项 | 优先级 | 建议 |
|---|---|---|---|
| B14 | land 42R/43R/45R/44/46 栈到 main（**待用户明确 push 指令**） | P0 | 收口后立刻 |
| B15 | G-A 主 lane 残红清零：title-select-all×N、empty-state Bug5-dark、auto-expand、state-sync、snapshot-rotation 等 | P0 | 另立 CI 清红票；或逐条书面豁免进 WORKFLOW §4.4 |
| B16 | G-B 人工 zip 黄金路径（Chrome+Firefox，含升级 pre-update 快照与回滚演练） | P0 | ready-for-human；按 §4.4 检查单勾选归档 |
| B17 | 构建期 CSS 括号 balance 门禁（spec D6 / A-40-1 deferred） | P1 | build.mjs 增加源 CSS depth=0 fail-closed |
| B18 | 冲突副本解决 UI（对比/合并/删除）（A-44-2） | P2 | 数据区入口已有 |
| B19 | legacyReader 独立冻结读端升格 rollback AC（A-45-3） | P2 | migration-golden-guard 抽模块 |
| B20 | `@data-golden` burn-in 2026-09-18 摘除 continue-on-error | P1 | 日历项；逾期需豁免登记 |
| B21 | ADR-0017 复核 2026-10-12 | P2 | 日历项 |
| B22 | 本地 main ref 与 origin/main 历史对齐（历史 backlog B3） | P2 | 待授权 |
| B23 | sync-engine 空凭据也 saveLayout 的冗余写（42R 报告遗留） | P2 | 非 COW 序 |
| B24 | 书签数据找回 | closed | 用户确认无法恢复；仅作事故档案 |

## 发行门禁现状（ADR-0017）

| Gate | 状态 |
|---|---|
| G-A CI 定谳 | **未满足**（主 lane 残红） |
| G-B 人工黄金路径 | **未满足** |
| G-C Pages 200 | 已满足（2026-09-11） |
| 结论 | **2026.9.12 包不可发行** |
