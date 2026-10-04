# Wave 2026.10.11 — 实施计划表

> 每项声明覆盖的账本 D-xxx；owner=agent（我可代办）/ user（用户侧不可代办）。
> 数据源：`decision-ledger.md` + `spec.md`。顺序按前置依赖排布。
> 版本假设：calver `2026.10.11`（账本内嵌约定，发布前与用户复核）。

## 计划表

| # | 任务 | D-xxx | owner | 前置 | 出口/验证 |
|---|---|---|---|---|---|
| P-01 | `but` 建本波工作分支（wave-2026-10-11），确认基线干净 | 全部 | agent | — | `but status` 新分支 active |
| P-02 | Spaceship DNS：`boxing` CNAME → `xxx91n.github.io.`；（推荐）GitHub 账户级域名验证 TXT | D-002 | **user** | — | DNS CNAME 链解析生效 |
| P-03 | env 修复：`gh api` 加 `{"name":"v*","type":"tag"}` deployment-branch-policy + 删 3 条 branch 死条目（保留 main/gh-pages）。权限不足 → 呈报用户手动（Settings→Environments→github-pages→Ref type=Tag） | D-001 | agent | — | policy 列表含 tag 型 v*、3 条死条目清除 |
| P-04 | URL 单源机制 + 全仓迁移 + `build-demo.mjs` 写 CNAME；构建期一致性 guard | D-002 | agent | — | demo artifact 含 CNAME；F2 清单零旧域残留 |
| P-05 | 标题 focus 状态机：render.js 共享 helper + 3 站点接入 + mouseup 防护 | D-003 | agent | — | 既有 e2e 不回归 + 新断言（二次点击 caret/方向键/拖选/Esc/Enter/首点不被吞） |
| P-06 | `--fs-*` 阶梯（design-system.css primitive 层）+ ~70 CSS / ~15 JS 迁移 + `max()` 下限 + 防回归 guard | D-004 | agent | — | 滑块全局生效 + 新 e2e + guard 通过 |
| P-07 | favicon Phase-1：骨架 + `decode()` + 会话热池 + `is-loading`/`is-cached` 状态类 | D-005 | agent | — | 同会话重进≈零闪 + e2e |
| P-08 | About tab：nav+tab+内容+外链 `tabs.create` + 14 locale + `I18N_FALLBACK` | D-006 | agent | P-04（消费单源常量） | 构建 i18n 闸过 + tab e2e + 4 外链新页打开 |
| P-09 | 文档同步：CONTEXT.md/docs/CONTEXT.md 术语刷新、发布 runbook 记 env tag-policy 坑、新 ADR×2（域名绑定 / 字号阶梯） | D-002 / D-004 | agent | P-04、P-06 落地后 | ADR 按 0000 模板（Consequences + 30d review） |
| P-10 | 商店后台隐私 URL 更新（CWS/AMO，随下次提交） | D-002 | **user** | P-11 后/提交时 | 商店字段=新域 |
| P-11 | 用户发 tag `v2026.10.11` 并发布 Release（本人账号）→ demo-deploy 自动部署 → CNAME 生效 | D-001 / D-002 | **user** | P-02✅ + P-03✅ + 代码全合入 | `npm run verify:pages-gc` 新域全绿：version.json==tag |
| P-12 | 收尾门禁（贯穿全程）：分批 `but commit`（CRX-R-013/014）、`codegraph sync`（BX-EXPLORE-003）、最终 `npm test`/test:changed、`git diff --check` | 全部 | agent | 各 P 完成即做 | 全绿 |

## 里程碑

- **M1 代码就绪**：P-04..P-08 合入、e2e 绿 → 具备 G-A/G-B 评审条件
- **M2 域名生效**：P-02 + P-11 后 `verify:pages-gc` 新域全绿 → G-C 满足
- **M3 商店字段**：P-10 随下次商店提交完成

## 关键时序

- P-04（含 CNAME 代码）合入**不需要**等 DNS；但 P-11 release 触发 deploy 前 P-02 必须完成（时序硬约束，D-002）。
- P-03 独立可先做；真实链路验证依赖 P-11。
- P-08 依赖 P-04 的单源常量（隐私链接消费）。
- P-02 用户可在任意时刻并行推进，越早越好。

## 用户侧动作汇总（不可代办）

1. P-02：Spaceship DNS CNAME（+推荐 TXT 验证）
2. P-10：CWS/AMO 后台隐私 URL 改新域（下次提交时）
3. P-11：本人发布 tag v2026.10.11 的 Release
4. 条件触发：P-03 若 agent 无 gh 权限 → 手动加 Tag 型 v* 放行
