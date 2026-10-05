> ⚠️ ARCHIVED — Round-1 任务书已执行完毕（49 commit 落 origin/main，2026-10-04）。当前任务书见 `next-round.md`。

# Handoff — Wave 2026.10.11 实施轮

> 面向：任意接手 Agent · 生成：2026-10-04 · 阶段：grill 已收口 → 实施
> 仓库：D:\Aworker\crx\boxing（Windows；shell=bash/Git Bash；ctx_* 工具可用且优先——见 AGENTS.md 顶部 BOXING-CTX-ROUTING 块）

## 0. 必读制品（按序）

1. `.scratch/wave10-1011-grill/decision-ledger.md` — **决策权威**：D-001..D-006 全 current + 负向约束 + F1-F6 事实底稿
2. `.scratch/wave10-1011-grill/spec.md` — 实施契约 S-01..S-06 + 范围外清单 + ADR 候选
3. `.scratch/wave10-1011-grill/implementation-plan.md` — P-01..P-12 依赖、owner、验证门
4. `AGENTS.md`（CRX-R-* / BX-* 硬规则、工具路由覆盖块）、`CONTEXT.md`、`docs/CONTEXT.md`
5. 历史参考：`.codex-tmp/# Handoff — W920 Followup.md`

## 1. 现状快照

- `but status`：工作区干净（zz），common base `32df9e9f`；本波工作分支未建——P-01 建。
- `github-pages` environment：5 条 branch 型放行（gh-pages/main/refs-tags-v*/v*/v2026.9.20），P-03 修。
- Pages API：`cname:null`、`https://xxx91n.github.io/boxing/`、build_type=workflow、https 强制开。
- 最新 release `v2026.9.20`（用户本人发）；release→deploy 断链根因已定位（账本 F1）。
- 5 次 atomcode 深调输出已入 ctx 索引，`ctx_search` 可召回；账本已吸收其结论。

## 2. 任务总览（D-xxx 覆盖声明；详规见 spec/plan）

| 任务 | 覆盖 D-xxx | owner |
|---|---|---|
| P-03 env tag-policy 修复 | D-001 | agent（无权限→用户手动兜底） |
| P-02 DNS CNAME + TXT 验证 | D-002 | **user** |
| P-04 URL 单源 + 全仓迁移 + CNAME | D-002 | agent |
| P-05 标题 focus 状态机 | D-003 | agent |
| P-06 全局字号阶梯 | D-004 | agent |
| P-07 favicon Phase-1 | D-005 | agent |
| P-08 About tab + i18n | D-006 | agent（依赖 P-04 常量） |
| P-09 文档/ADR 同步 | D-002/D-004 | agent |
| P-10 商店隐私 URL | D-002 | **user** |
| P-11 发布 v2026.10.11 | D-001/D-002 | **user** |
| P-12 门禁（贯穿） | 全部 | agent |

## 3. 红线速查（账本负向约束 + 仓库硬规则蒸馏）

- 版本控制**只许 `but`**：每批改完即 `but diff` + `but commit -b <branch> -m <scoped>`（CRX-R-013/014）；禁 `git add/commit`；不主动 push。
- 源码每改即 `codegraph sync`（BX-EXPLORE-003）；探索先查 .codegraph。
- i18n 新键必须 14 locale + `I18N_FALLBACK` 全覆盖（构建闸强制）；data-i18n 键须真实存在。
- 隐私/站点 URL 单源，禁散写多文件。
- 字号↔缩放正交红线：Font Size 与 zoomLevel 代码/存储永不互写。
- 不引入新 npm 依赖 / 新权限 / Cache API / IndexedDB / lazy loading / `_favicon` API。
- 发行三门合取（ADR-0017）：不代签 G-B；tag/商店操作归用户。
- `ntp/index.html` CSP 不动；contenteditable 纯文本粘贴不动（SEC-03）；不改滑块 11–20 与 `fontSize` 键名。
- LF 行尾；提交前 `git diff --check`。

## 4. 待确认项（非阻塞）

- calver `2026.10.11` 为账本内嵌假设——发布前与用户复核一次。

## 5. Suggested skills

- `gitbutler`（but）：全部版本控制操作——必须。
- `domain-modeling`：P-09 写 ADR/更新 CONTEXT 时的三判据。
- `neat-freak`：波末文档/规则一致性收尾。
- `atomcode-research`：实施中遇账本外新未知时按「回顾账本→深调→冲突走 revised 流程」执行。
- 工具路由：ctx_* 优先于 shell；写文件用 node；不 curl/wget；不 `rg` 直调（用搜索工具）。

## 6. 接手第一步

`but` 建分支（P-01）→ 并行启动 P-03（env 修复）与 P-04（单源+迁移）→ 余按 plan 依赖序推进；用户侧 P-02 随时可插单提醒。
