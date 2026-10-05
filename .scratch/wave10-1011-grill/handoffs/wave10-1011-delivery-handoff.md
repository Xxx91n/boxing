# Handoff — Wave 2026.10.11 实施交付完成交接（重修闭环 + 域名定向版）

> 面向：下一轮 grill 主持 Agent / 后续运维 / 审计 Agent 及用户 · 生成：2026-10-04 · 阶段：重修闭环 + 域名定向完成 → **本轮不发版**，转入下一轮 grill（新问题）
> 本轮权威交接：[wave10-1011-next-round-handoff.md](file:///.scratch/wave10-1011-grill/handoffs/wave10-1011-next-round-handoff.md)

## 1. 现状快照

- **分支状态**：`wave-2026-10-11` 与 `audit-wave10-1011` 已 `but land` 并入 `origin/main`（tip `d1c985ae`）并推送；工作区干净、无剩余分支。
- **提交堆叠**（自 base `32df9e9f`，均已并入 main）：
  - `lxq`: grill 制品与契约定稿
  - `lxo` (`68d09336`): P-04 URL 单源 + CNAME + full F2 迁移 + ADR-0018
  - `msx` (`eb7704b2`): P-06 全局字号 `--fs-*` 阶梯 + CSS/JS 迁移 + Guard + ADR-0019
  - `wvv` (`8bd624d1`): P-05 / P-07 / P-08 标题状态机 + Favicon Phase-1 + About tab + 14 语言 i18n
  - `lvy`: fix(D-003) mousedown 激活时聚焦与单次激活 mouseup 防护
  - `oms`: delivery 报告与初始 handoff
  - `vqn`: fix(rework) 审计发现闭环整改（H1/H2/M1/M2/L1-L4）
  - `rrp`: 报告/交接更新
  - `mwt`: test(D-003) S-03 行为级 e2e（audit R1 闭环）
  - `ptl` / `tpv`: 两轮独立审计报告与本轮交接（audit 分支，已并入）
- **验证门禁（最近一次独立复跑）**：
  - `npm run pretest`: **10/10 守卫全绿**（含 `guard-site-constants`、`guard-fontsize`）。
  - `npm run build`: Chrome 与 Firefox 产物编译成功，A7/A8/A10 静态校验通过。
  - `npx playwright test`: **14/14 用例通过**（含 4 个新增 D-003 行为级用例）。
  - `git diff --check`: 纯 LF 行尾，无空格瑕疵。`codegraph sync`: 索引同步。
- **域名状态（本轮已达成，非发版路径）**：`boxing.xxx91n.com` 已通过 Pages API 绑定并 `verified`；新域三路径 200、旧 `xxx91n.github.io/boxing/*` 301→新域、`https_enforced=true`。
- **详细验收报告**：[2026-10-04-report.md](file:///.scratch/wave10-1011-grill/reports/2026-10-04-report.md)
- **独立审计报告**：[2026-10-04-audit.md](file:///.scratch/wave10-1011-grill/reports/2026-10-04-audit.md) · [2026-10-04-audit-round2.md](file:///.scratch/wave10-1011-grill/reports/2026-10-04-audit-round2.md)

## 2. 审计重修整改结果摘要

1. **H1 单源**：`ntp/site-constants.js` 建立；`settings-ui.js` 导入消费；`guard-site-constants.mjs` 接入 pretest。
2. **H2 ADR 日期**：ADR-0018 与 ADR-0019 复核日期纠正为严格符合 Date+30 的 `2026-11-10`。
3. **M1 rem**：`onboarding.css` 两处 rem 迁移为 `--fs-md` / `--fs-xs`。
4. **M2 商店文案**：14 份商店描述及发布文档旧域全量迁移为 `https://boxing.xxx91n.com`。
5. **L1-L4**：移除 CSS 兜底字面量；`makeTitleFocusMachine` 与 `loadFavicon` 精简去冗余。
6. **R1（本轮补齐）**：新增 4 个 D-003 行为级 e2e（原生 caret / 方向键折叠 / 局部选择 / 鼠标拖选）。「双击选词」因账本 D-003 负向「不引入双击/F2 心智」存在口径冲突，移交下一轮澄清。

## 3. 关联制品链接

- **决策账本**：[.scratch/wave10-1011-grill/decision-ledger.md](file:///.scratch/wave10-1011-grill/decision-ledger.md)
- **实施规格**：[.scratch/wave10-1011-grill/spec.md](file:///.scratch/wave10-1011-grill/spec.md)
- **实施计划**：[.scratch/wave10-1011-grill/implementation-plan.md](file:///.scratch/wave10-1011-grill/implementation-plan.md)
- **详细验收报告**：[.scratch/wave10-1011-grill/reports/2026-10-04-report.md](file:///.scratch/wave10-1011-grill/reports/2026-10-04-report.md)
- **新增 ADRs**：
  - [docs/adr/0018-custom-domain-boxing-xxx91n-com.md](file:///<repo root>/docs/adr/0018-custom-domain-boxing-xxx91n-com.md)
  - [docs/adr/0019-global-font-size-ladder.md](file:///<repo root>/docs/adr/0019-global-font-size-ladder.md)

## 4. Suggested Skills

- `grilling` / `grill-with-docs`：下一轮开场 grill 新议题并落账本。
- `gitbutler` (`but`)：分支/提交操作（禁 `git` 写命令；不主动 push）。
- `code-review`：新议题实现后的 Standards + Spec 双轴复核。
- `atomcode-research`：账本外新未知时的深调。
