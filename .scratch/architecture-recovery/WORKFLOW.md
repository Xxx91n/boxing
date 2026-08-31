# WORKFLOW.md — 架构修复全流程 (巡检 → 收口)

- 生成日期: 2026-08-31
- 生成依据: `$ask-matt` / `$to-spec` / `$to-tickets` SKILL 本体 (C:/Users/Administrator/.agents/skills/grill/engineering/) + 本仓库约束 (大脑/子窗口双轨、GitButler、atomcode 优先、多窗口人工派发) + 同目录 research-report.md (atomcode 调研)。
- 效力声明: 本文件与 skill 本体冲突时, 以 skill 本体为准。本文件只为本地固化与记忆压缩。

## §1 总览: 从巡检到收口的九环节

| # | 环节 | 入口技能 | 产出物 |
|---|------|---------|--------|
| 1 | 巡检 (找深化机会) | /improve-codebase-architecture | 候选清单 (会话内) |
| 2 | 深度调研 (成熟轮子优先, 不自研) | atomcode-research (ctx 包裹, 串行) | research-report.md + ctx 索引 |
| 3 | 隔谈明确范围 (可选) | /grill-with-docs | CONTEXT.md / ADR |
| 4 | 落 spec | /to-spec | spec.md |
| 5 | 拆票 (tracer-bullet, blockers-first) | /to-tickets | issues/NN-slug.md |
| 6 | 写 handoff 与窗口启动器 | (大脑会话) | handoffs/NN-slug.md, prompts/NN-slug.md |
| 7 | 多窗口人工派发 | 人工 | 子窗口开工 (prompts/NN-slug.md 为唯一入口) |
| 8 | 子窗口实施 | /implement (内含 /tdd) → /code-review | 代码改动 + 测试绿 |
| 9 | 收口: commit + 教训写回 | GitButler (见 §4.2) | commit + 本文件 §5 追加 |

## §2 大脑 / 子窗口 双轨分工

- 大脑窗口 (本会话): 巡检、调研、spec、拆票、handoff、启动器、跨票裁决、收口审查。不带实施。
- 子窗口: 只拿 prompts/NN-slug.md 开工; 实施遵循 /implement → /tdd → /code-review; 遇阻塞回报大脑, 不跨票动代码。
- 派发是人工动作: 大脑生成 prompts 后由人逐窗贴入启动器。无自动调度。
- 子窗口上下文在票完成后可弃 (票自包含); 大脑窗口在 to-tickets 完成前保持单一连续上下文 (ask-matt Context hygiene)。

## §3 边界处决 (phase boundaries)

按 ask-matt 五选项树: Continue → /clear → /handoff → subagent → /compact (默认)。
- 同一票内: Continue。
- 票与票之间: 子窗口整个新开, 无需 compact。
- 大脑窗口逼近 smart zone: 在阶段边界 /compact, 不中途压缩。

## §4 工程约束

### §4.1 测试与验证
- 每票实施遵循现有 Playwright 配置: `npm test` (test/playwright.config.ts); 清绿为本票 done 的必要条件。
- 拆分类票额外验收: `npm run build` 绿 + dist 产物结构与 manifest 契约不变。

### §4.2 版本控制 (唯一来源)
- 使用 GitButler (`but` CLI) 进行所有提交操作。每个子窗口对应一张票, 独立但 branch。
- 提交路径: `but diff` 确认改动 → `but commit -b <branch名> -m "<消息>" <改动id...>`。
- 不改写他人/其他窗口的提交; 不 push, 不开 PR (除非用户明确要求)。
- 提交信息: 说清变什么、为什么、关键决策。小修复 amend 进所属 commit, 不造 fixup 垃圾。
- 启动器与子窗口禁止出现 worktree / git checkout / git branch 等字样; 版本控制表述一律引用本节。

### §4.3 调研纪律
- 联网调研只允许经 ctx 包裹的 atomcode, 串行 (同会话同时在途最多 1 次)。
- 优先复用工业成熟心智模型/轮子, 不重复开发。

## §5 偏离点清单 (本地适配, 待用户确认后生效)

| # | 原 skill 流程 | 本地适配 | 理由 |
|---|--------------|---------|------|
| D1 | /to-spec → 发布到 issue tracker | 发布为本地文件 spec.md | tracker 是本地文件制, 见 to-tickets local 分支 |
| D2 | 实施由 /implement 在同窗口或新会话自动进行 | 多窗口人工派发, 子窗口以 prompts/NN-slug.md 启动 | 用户约束: 大脑/子窗口双轨 |
| D3 | 提交用 git | 全部走 GitButler but CLI (§4.2) | 用户约束 + 多窗口并行避免互相干扰 |
| D4 | 调研用 /research (后台 agent 写 md) | 用 atomcode 联网深度调研, 报告 ctx 索引 | 用户约束: atomcode 优先 + 成熟轮子优先 |
| D5 | to-tickets 步骤 4 "Quiz the user" 逐票确认 | 大脑生成全部产出物后由用户对整包过目 | 减少回合; 用户拥有否决权 |
| D6 | 调研报告路径按用户占位符 {架构报告路径} | 固化为 research-report.md (同目录) | 占位符未指定, 取就近路径 |

## §6 教训回放 (爆炸写回, 不许随会话蒸发)

新教训追加到本表, 注明日期与来源票号。

| 日期 | 来源 | 教训 |
|------|------|------|
| 2026-08-31 | 历史 (AGENTS.md / ADR-0013) | BX-DEV/A1-A5 禁令是伤疤立法 — 结构缺位时规则代理隔离; 拆分落地后应大面积失效 |
| 2026-08-31 | 调研 | ntp.js file:// mock 在 ESM 下因 CORS 失效; 拆首票时必须先处理或接受该调试路径断裂 |
| 2026-08-31 | 调研 | storage 写链/防回环/onChanged 是单一体, 严禁拆散到多模块; 拆散即引入竞态 |
