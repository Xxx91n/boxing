# Handoff — Wave 2026.10.11 Round-3 Grill（Round-2 技术收口后的新问题）

> 面向：任意接手 Agent · 生成：2026-10-05 · 阶段：Round-2 grill 已收口 → 实施
> 仓库：<repo root>（Windows；shell=bash/Git Bash；ctx_* 工具优先——见 AGENTS.md BOXING-CTX-ROUTING；写文件用 node）
> 历史：Round-1（S-01..S-06）已实施并 `but land` 至 origin/main（49 commit，tip 06e51fdb），未发版。本文件取代已归档的 `handoffs/round1-executed-next-round.md`。
> 当前口径：Round-2 P-13..P-18 已完成，Chromium 356/0 失败，Firefox 351/0 失败（5 个已登记 skip）；技术 gate PASS。P-19/P-20 仍需用户授权/外部发布。

## 0. 必读制品（按序）

1. `.scratch/wave10-1011-grill/decision-ledger.md` — **决策权威**：D-001..D-011 全 current（D-007..011 为本轮新增）+ 负向约束 + 事实底稿
2. `.scratch/wave10-1011-grill/spec.md` — 实施契约；Round-2 为 S-07..S-11 + §X-追加范围外表
3. `.scratch/wave10-1011-grill/implementation-plan.md` — Round-2 为 P-13..P-20
4. `AGENTS.md`、`CONTEXT.md`、`docs/CONTEXT.md`、docs/adr（0018/0019 为本波新增）
5. 旧任务书：`handoffs/round1-executed-next-round.md`（Round-1，已执行完毕，仅作历史）

## 1. Round-2 现状快照（已关闭）

- `but status`：Round-2 两个工作分支待合并；合并后删除已确认落地的 wave 分支，保留 `main` 历史。
- 线上 demo 仍 `v2026.9.20`（2026-09-22 dispatch）——三 bug 修复随 10.11 发版上线。
- 三 bug 归因已写死（D-011，见 spec 各节"归因"段）：connId 多面投影泄漏 / 暗色双缺陷（html 类泄漏 + 远端合并不收敛）/ onboarding overlay 拦截。
- atomcode 深调 4 次结论已入 ctx 索引（`ctx_search` 可召回），账本已吸收。

## 1.1 Round-3 新测试问题（下一轮 grill 输入）

这些是最终测试门暴露的测试基础设施/覆盖问题，不是已关闭的 Round-2 产品回归：

1. **Firefox native mouse drag 限制**：最终 Firefox 全量有 5 个已登记 skip，根因与 Playwright #16095 的原生输入挂起相关；需要决定替代行为覆盖、专用 lane 或继续 waiver。
2. **并行负载 flake 防控**：此前 Chromium `conflict-copy-readout` 在并行负载下出现过 flake，隔离与重复运行通过；下一轮需用固定 worker/重复矩阵确认是否存在资源争用。
3. **双浏览器运行策略**：评估 Firefox headed/headless 与 extension persistent context 的 CI/本地分层，目标是减少耗时但不削弱真实启动和 `__boxingDebug` 活体覆盖。
4. **证据口径自动化**：为最终报告自动收集 pass/fail/skip、waiver ledger、浏览器项目与 commit，避免历史报告与最终复跑口径漂移。

## 1.2 Round-3 进入规则

- 先复现、分类（产品 / 测试 / 浏览器环境）、登记，再决定是否改源码。
- 每个新问题必须带：浏览器/项目、测试标题、复现次数、最小日志、是否隔离后消失、建议 owner。
- Round-2 已修复问题没有新 reproducer 不得重开；P-19/P-20 不阻塞本轮测试 grill。

## 2. 任务总览（D-xxx 覆盖声明；详规见 spec/plan）

| 任务 | 覆盖 D-xxx | owner |
|---|---|---|
| P-13 bug1 连接线面域过滤（resolveConnSurface） | D-007, D-011 | agent |
| P-14 bug2 暗色收敛（applyDarkMode + CSS 前缀 + 五调用点） | D-008, D-011 | agent |
| P-15 bug3 demo（__BOXING_DEMO__ + onboarding 抑制 + Escape） | D-009, D-011 | agent |
| P-16 文档口径三项 + zip gitignore 政策 | D-010 | agent |
| P-17 README badge → workflow 动态 | D-010 | agent |
| P-18 测试门：三族断言 + 双浏览器全量（发版 gate） | D-011 | agent |
| P-19 重写 v2026.9.20 Release notes | D-010 | agent（需授权）/ user |
| P-20 发布 v2026.10.11 | D-010, D-001, D-002 | **user** |

## 3. 红线速查（账本负向约束 + 仓库硬规则蒸馏）

- 版本控制只许 `but`（CRX-R-013/014）；禁 `git add/commit`；不主动 push。
- 源码每改即 `codegraph sync`（BX-EXPLORE-003）；LF 行尾；`git diff --check`。
- **WORKFLOW §6**：storage.onChanged 监听注册严禁搬出 storage.js——回调体内调 applyDarkMode。
- **Disposal Invariant**：清 surface innerHTML 前必 `disposeAllConns()`。
- **bug1**：跨父连接数据保留不删；归属每帧现算不缓存；不向 UI 警告。
- **bug2**：`.ntp--dark` 唯一宿主=documentElement；boot-theme.js 保持 classic script 自含最小逻辑；matchMedia 回退禁回写 settings；settings 维持远端全赢 LWW。
- **bug3**：`__BOXING_DEMO__` 构建期注入且先于 ntp.js 就绪；file:// 调试道不抑制；Escape 监听仅浮层打开时挂载、优先于画布 Escape 语义。
- **bugfix 与文档清理分开 commit**（D-010⑦）。
- 发行三门合取（ADR-0017）；tag/商店操作归用户；P-18 全绿前禁发版。
- 不做：数据净化/分注册表/system-follow/字段级 LWW/demo 保留导览/历史 release body 改写/issue 镜像追平。

## 4. 待确认项（非阻塞）

- calver `2026.10.11` 为账本内嵌约定（发布日漂移风险已知——若实际发版日晚于 10.11，发版前与用户复核版本号）。
- P-19 `gh release edit` 为外部产物改写，执行前向用户要授权。

## 5. Suggested skills

- `gitbutler`（but）：全部版本控制操作——必须。
- `domain-modeling`：touch CONTEXT.md/新 ADR 时按三判据。
- `neat-freak`：波末文档/规则一致性收尾。
- `atomcode-research`：遇账本外新未知时按「回顾账本→深调→冲突走 revised 流程」。
- `code-review`：实施后自审（上轮两轮审计惯例）。
- 工具路由：ctx_* 优先于 shell；写文件用 node；不 curl/wget；不 `rg` 直调。

## 6. 接手第一步

`but` 建 Round-3 grill 分支 → 先复跑并登记 §1.1 三类测试问题 → 再由用户逐条确认是否进入 decision-ledger/spec → 实施与双浏览器验证 → 最后再评估 P-19/P-20。
