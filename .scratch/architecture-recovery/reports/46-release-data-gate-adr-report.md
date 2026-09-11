# 报告 — 46 发行数据门禁策略 + ADR-0017 + 发行检查单

- 日期: 2026-09-12
- 窗口: 子窗口实施代理（入口 prompts/46-release-data-gate-adr.md）
- 分支: ticket-46-release-data-gate（版本控制遵循 WORKFLOW §4.2）
- 阻塞核实: 40 / 42 / 45 均有收口报告（reports/40-css-hidden-brace-p0-report.md、reports/42-update-cow-before-migrate-report.md 含 §7 返工、reports/45-ci-data-golden-gates-report.md 含 45R）→ 开工时解除
- 调研: atomcode 2026-09-12（handoff 推荐提示词 verbatim，ctx source=atomcode，18 信源，CWS/AMO 官方文档全文核验）

## 完成定义对照（issues/46 全项）

| 验收项 | 状态 | 证据 |
|---|---|---|
| docs/adr/0017 存在且含 Consequences + 审阅日期 | ✅ | docs/adr/0017-release-data-gate.md — `## Consequences`（正/负/中三态）+ `## Review` 复核日期 2026-10-12（= Date+30d，ADR 模板硬性约定） |
| WORKFLOW 含发行门禁节 | ✅ | WORKFLOW.md §4.4 — G-A/G-B/G-C 合取定义 + 书面豁免规则 + CWS/AMO 渠道条款 + 复盘义务；§6 追加 2026-09-12 事故教训行 |
| CONTEXT.md 增补容灾术语 | ✅ | docs/CONTEXT.md 新 §「Data Resilience & Release Gate」8 词条：snap.v1（分键+index）、Time Machine rotation、pre-update snapshot、needsMigration、fork restore（corrupt 归档）、conflict copy、golden fixture、release gate |
| 检查单可被子窗口逐项勾选 | ✅ | §4.4 代码块模板「发行检查单 — <版本号>」，逐行 `- [ ]` 形态（G-A 3 项 / G-B 6 项 / G-C 3 项 / 渠道 2 项 / 结论 2 项），每次发行复制到该票报告 |

## 门禁本体（ADR-0017 裁决摘要）

- 「可发行」= **G-A ∧ G-B ∧ G-C** 合取：main 全量 CI 主 lane 残红清零**或逐条书面定谳豁免** ∧ 对 zip 解包产物的人工黄金路径（Chrome+Firefox，含升级安装 pre-update 快照与回滚演练）∧ Pages 三 URL live 200。齐备前禁 tag / 禁宣称可发行。
- Rollback 兼容义务（两商店官方文本共同要求）：schema 永不前向破坏（golden guard expand/contract 阻断）；发行记录可回滚目标版本；CWS 回滚 ~1 分钟免审但有两版循环陷阱且丢弃进行中百分比；AMO 限退一版、需 ≥2 批准版本、生效按 24h 窗口。
- 渠道现实约束（atomcode 核验）：CWS 百分比发布门槛 >10k 七日活跃（Boxing 未达标 → 灰度替代 = 可信测试者/自托管 zip canary）；AMO 截至 2026 无百分比发布（unlisted canary 或功能开关替代，禁远程代码）；首次上架必须人工。
- 书面豁免规则：条目含失败用例名/基线 run URL/失败签名/归属票号/到期条件，发行前复查，禁永久豁免。
- 事故复盘模板（P0/P1 恢复后 48h 内，blameless）：时间线 UTC+证据源、影响量化、**触发-检测-修复三段分离**（审核通过≠推送生效）、回滚目标状态、纠偏表（Prevent/Detect/Mitigate/Respond + Owner + Done-when）。

## 2026-09-12 事故教训记录落点

- ADR-0017 §Context 首段：双层根因（CSS 缺 `}` 冻结 + 无 COW 回退掏空数据）与流程成因（zip 零门禁发布）。
- WORKFLOW §6 教训表新增行：「CI 绿是必要不充分，可发行必须三条件合取」。
- WORKFLOW §4.4 / ADR-0017 将红线固化为后续票的强制引用面。

## 票 45 移交项处置

reports/45-ci-data-golden-gates-report.md 点名「v2 单程缺口应在票 46 ADR 评审」：ADR-0017 裁定**不阻断门禁**（golden guard 已 pin 现状并具名），列为 G-B 回滚演练必查项，并登记 docs/history/2026-09-12-backlog.md **B13**（P2，立票时裁决是否改单程）。

## 撰写时门禁现状（如实记录，非本票收口条件）

- 已满足: G-C（2026-09-11 dispatch 后三 URL 均 200，origin/main cf8a271 W1 收口记录）。
- 未满足: G-A — main 全量 test.yml 仍红（run 34569565899 exit 1，wave4 存量残红）；G-B — 发行 zip 人工黄金路径未执行（票 40 报告该项即转 ready-for-human）。
- 42/43/44/45 仍在 stacked 分支待合 main。
- 结论: 按本门禁，2026.9.12 存量包状态 = **不可发行**；红线维持至残红清零/豁免定谳 + 黄金路径勾选归档。

## 验证

- 纯文档票：无源码/manifest/dist 改动面，无构建/测试证据需求（WORKFLOW §4.1 拆分类票条款不适用）。
- 字节校验（Windows 文件完整性协议）：5 个改动文件逐一确认 UTF-8 无 BOM、LF 行尾（`git diff --check` 干净 + 首 3 字节非 EF BB BF）；markdown 围栏配对检查（§4.4 代码块开闭各 1）。
- 术语一致性：snap.v1 / boxingLayout.corrupt / boxingLayout.conflict / takePreUpdateSnapshot / ensurePreUpdateSnapshot / needsMigration / migration-golden-guard 拼写与 41/42/43/44/45 收口报告及代码实态逐一对照。
- 硬约束合规：新增文本不含 worktree / git checkout / git branch / 版本控制命令原词（版本控制表述一律「遵循 §4.2」）；「tag」为发行标记语义，非命令；未动其他票文件（backlog/issues/46/CONTEXT/WORKFLOW/ADR-0017 均在本票文件面：docs/adr/0017 · docs/CONTEXT.md · WORKFLOW.md · docs/history/）；未改写他人提交。

## 遗留 / 回报大脑

- 检查单首次执行时机：42/43/44/45 合入 main 后的第一个候选发行，届时按 §4.4 复制模板逐项勾选。
- `@data-golden` burn-in 到期日 2026-09-18（test.yml continue-on-error 摘除）为 G-A 的前置在效项，逾期即需豁免登记。
- ADR-0017 复核日期 2026-10-12（三项复核见其 Review 节）。
