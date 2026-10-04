# Handoff — Wave 2026.10.11 重修闭环 · 第 2 轮审计后交接

> 面向：下一轮 grill 主持 Agent / 任意接手 Agent 及用户 · 生成：2026-10-04 · 阶段：**重修闭环（第 2 轮审计）→ 本轮不发版 → 进入下一轮 grill（新问题）**
> 仓库：`D:\Aworker\crx\boxing`（Windows；shell=bash/Git Bash；`ctx_*` 工具优先——见 AGENTS.md 顶部 BOXING-CTX-ROUTING 块）

## 1. 现状快照

- **分支**：GitButler 分支 `wave-2026-10-11`（审计报告在并行分支 `audit-wave10-1011`，互不影响）；工作区干净（`zz [uncommitted] (no changes)`）。
- **提交堆叠**（自 base `32df9e9f`，由旧到新）：`lxq`(契约) → `lxo`(D-002 URL单源+CNAME) → `msx`(D-004 字号阶梯) → `wvv`(D-003/005/006) → `lvy`(D-003 修) → `oms`(报告) → **`vqn`(整改 H1/H2/M1/M2/L1-L4)** → **`rrp`(报告/交接更新)**。
- **硬验收（第 2 轮审计独立复跑）**：`node --check` 6/6、`npm run pretest` **10/10**、`npm run build` exit 0、`playwright` **10/10**、`git diff --check` clean、`codegraph sync` 最新、`guard-fontsize` 0 硬编码、`guard-site-constants` self-test+实跑通过。
- **本轮不发版**（用户指令）。

## 2. 本轮闭环结论

- **第 1 轮 6 类整改项全部独立复核闭环**：H1 单源机制（新增 `ntp/site-constants.js` + `scripts/guard-site-constants.mjs` 真校验并入 pretest）、H2 ADR 复核日期 `2026-11-10`、M1 rem 移除、M2 商店文案/文档旧域迁移、L1 字号字面量清除、L2 focus 状态机重构、L3/L4 favicon 去冗余/去语义矛盾。
- **遗留 1 条规格缺口 R1（并入下一轮）**：spec S-03 / 账本 D-003 要求的新增 e2e 未落地（二次点击落 caret / 方向键折叠 / 局部拖选 / 双击选词 / 首点全选不被吞）；且整改改动了 D-003 行为却无测试覆盖。
- 详见：[第 2 轮审计报告](file:///D:/Aworker/crx/boxing/.scratch/wave10-1011-grill/reports/2026-10-04-audit-round2.md)、[第 1 轮审计报告](file:///D:/Aworker/crx/boxing/.scratch/wave10-1011-grill/reports/2026-10-04-audit.md)。

## 3. 下一轮 grill 方向指示（下一轮开场即用）

1. **R1（首选）**：为 D-003 补行为级 e2e——二次点击落 caret、方向键折叠选区、局部拖选、双击选词、首点全选不被吞（Chromium 必测，Firefox 语义对齐）；并把 `selectedThisFocus` / `guardFirstMouseUp` 的语义纳入源契约断言。
2. **用户新问题**：用户在开场提出的新议题（**待下一轮开场收集并逐条落账本**；本条为本轮交接触发原因）。
3. **延续观察项（低优先）**：O1 历史 release-notes 被改写（可回滚或接受）；O2 旧报告/交接「待发版」口径需随本轮交接更正；O3 ADR-0018「彻底清理」措辞。

## 4. 未决的用户侧动作（不可代办）

- **DNS**：`boxing` CNAME → `xxx91n.github.io.` **已配置生效**（独立核实 `resolveCname` 指向 `xxx91n.github.io`）。
- **发版（本轮推迟）**：待下一轮 grill 收口后，再合 `wave-2026-10-11` 至 `main` 并发布 Tag `v2026.10.11`；届时 `demo-deploy.yml` 自动写入 `CNAME` 并绑定自定义域，`https://boxing.xxx91n.com/demo/` 生效（旧址 301）。注意：绑定后**路径不再带 `/boxing` 前缀**。
- **商店后台**：CWS/AMO 隐私 URL 随下次提交更新为 `https://boxing.xxx91n.com/privacy-policy.html`。

## 5. 必读制品（引用，不重复）

- 决策账本 `D-001..D-006`：`.scratch/wave10-1011-grill/decision-ledger.md`
- 实施规格 `S-01..S-06`：`.scratch/wave10-1011-grill/spec.md`
- 实施计划 `P-01..P-12`：`.scratch/wave10-1011-grill/implementation-plan.md`
- 两轮审计报告：`.scratch/wave10-1011-grill/reports/2026-10-04-audit.md`、`.../2026-10-04-audit-round2.md`
- ADR-0018 / ADR-0019：`docs/adr/0018-custom-domain-boxing-xxx91n-com.md`、`docs/adr/0019-global-font-size-ladder.md`

## 6. Suggested Skills

- `grilling` / `grill-with-docs`：下一轮开场逐条 grill 新议题并落账本。
- `code-review`：R1 补齐后做 Standards + Spec 双轴复核。
- `gitbutler` (`but`)：全部分支/提交操作（禁 `git` 写命令；不主动 push）。
- `atomcode-research`：账本外新未知时的深调（回顾账本→深调→冲突走 revised 流程）。
- 工具路由：`ctx_*` 优先于 shell；写文件用 node；不 curl/wget。
