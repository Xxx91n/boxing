# 票 96 报告 — docs-gov dead-link 修绿

- Covers: A-050 · 镜像: GitHub #13 · Blocked by: None
- 日期: 2026-09-14
- 版本控制: 遵循 WORKFLOW §4.2（GitButler but；未 push、未开 PR、未 tag）
- 分支: ticket/96-docsgov-deadlink

## 0. 调研摘要（atomcode 2026-09-14 · session 0d02f171）

协议: §4.3 串行联网调研（同时在途 1 次）。检索 7 次、原文实读 6 篇，覆盖 Official / Comparative / Criticism / Currency / Community 五角度。

### 0.1 工业主流方案对比

| 工具 | 形态 | 适用边界 | 活跃度 |
|---|---|---|---|
| lychee | Rust 静态二进制 + 官方 Action | Markdown/HTML/RST 全覆盖；--offline 只查本地相对路径；.lycheeignore 白名单 | 活跃，功能天花板 |
| markdown-link-check | Node CLI + Action | 仅 Markdown；gaurav-nelson Action 2025-04 官宣弃用 | 上游弃用 |
| linkspector | Node + Puppeteer | markdown-link-check 作者推荐继任，假阳性更少 | 活跃，但需 npm + Chrome |
| linkinator / muffet / htmltest | TS / Go / Go | 各有侧重（爬站 / SSG 产物） | 活跃，非本场景 |
| Vale | Go prose linter | 只查文风术语，不做死链 | 排除 |
| mkdocs --strict / docusaurus onBrokenLinks | SSG 内建 | 仅当采用对应 SSG | 本仓库无 SSG，排除 |
| GitHub 原生渲染 | 平台 | 只渲染，不校验相对路径死链 | 排除 |

### 0.2 解析层面结论（事故根因的工业定性）

结论: **字符类正则在本场景是不可修复性使用**。markdown 的链接语法、反引号、表格分隔符、行内代码、粗体嵌套无法被单一字符类穷举；每补一个排除项就冒出新假阳性 —— 这正是 run 34808079960 的形态。

推荐: **手写扫描器**（链接语法配对识别 + 外链/锚点/空串过滤 + path.resolve + existsSync）。引入完整 CommonMark AST 需 markdown-it 等依赖，违反本仓库禁新增 npm 依赖约束；当前规模下手写扫描器更便宜且够用。

### 0.3 测试策略（防假绿 / 防假红）

| fixture 类型 | 构造 | 期望 |
|---|---|---|
| positive | 合法 markdown 链接指向 docs/agents/xxx.md | 0 缺失，exit 0 |
| negative | 链接指向 docs/agents/不存在.md | 1 缺失，exit != 0 |
| 对抗-防假红 | 同一路径出现在行内代码 / 表格单元格 / 粗体 | 0 缺失（不误吞语法） |
| 对抗-防假绿 | 合法引用路径被改名但引用未更新 | 必须报缺失 |

### 0.4 本仓库推荐落地

保留手写 .mjs guard 路径，不引入外部工具（禁新增依赖 + 已有手写扫描器先例 + 引入 Rust 二进制对纯 Node/bash 管道是净增复杂度）。

### 0.5 现有心智模型回顾与冲突处置（不得静默改向）

| 项 | 内容 | 处置 |
|---|---|---|
| 调研建议 | 复用既有 scripts/docs-pointer-check.mjs（已有配对逻辑） | **revised**：该脚本被 A-035 / 票 85 冻结为 NON-gate，明令「不得加入任何必需 CI job」。故新建同思路专用 guard，不复用该文件 |
| 调研建议 | 按 §0.3 补 pretest 用例 | **revised**：issue note 明令「不与 test.yml G-A 混写」，pretest 即 G-A 面。故自测内置于 guard（每次 CI 调用必跑），不进 pretest |
| docs/CONTEXT.md | release gate 三条件合取（ADR-0017） | 本票不触碰；docs-gov 红 != G-A（D-001/D-002） |
| docs/adr/0017 | 豁免规则 / never-quarantine | 本票不涉豁免面 |

## 1. 基线

- 红 run: AI Docs Governance 34808079960 @ 9fa4666c（D-001 记账）
- 本地复现（同一 grep）: **8 条 DEAD，全部假阳性**

```
DEAD docs/agents/critical-lessons.md](docs/agents/critical-lessons.md
DEAD docs/agents/domain.md`.
DEAD docs/agents/issue-tracker.md`.
DEAD docs/agents/manifest-contract.md](docs/agents/manifest-contract.md
DEAD docs/agents/performance-anti-patterns.md](docs/agents/performance-anti-patterns.md
DEAD docs/agents/triage-labels.md`.
DEAD docs/agents/ui-audit.md](agents/ui-audit.md
DEAD docs/history/boxing-changelog.md`
```

8 条对应目标文件**全部真实存在** -> 纯假阳性，非真实死链。

## 2. 根因定谳

原步骤用 grep -ohE 抽取 docs/agents/... 与 docs/history/... 路径引用，字符类只排除了空格、单双引号、右括号与大于号，**未排除** 右方括号、左圆括号、左方括号、反引号、星号、竖线。

后果: markdown 链接被吞成 路径+右方括号+左圆括号+路径（非真实路径）；行内代码被吞成 路径+反引号+句点。均非真实路径，于是每一条都判为死链，整步 exit 1。

## 3. 改动清单

| 文件 | 类型 | 说明 |
|---|---|---|
| scripts/docs-link-guard.mjs | 新增（189 行 / 7300 B） | 手写扫描器 + 7 fixture 自测 + 反空洞断言；allowlist tokenizer（路径安全字符集，末位限定为字母数字/下划线/连字符）；同时解析 markdown 链接目标 |
| .github/workflows/ai-docs-governance.yml | 修改 | dead-link 步骤 18 行 bash grep 换为 1 行 node scripts/docs-link-guard.mjs；pull_request.paths 与 push.paths 各增 scripts/docs-link-guard.mjs |

检查仍存在且被**加强**（未静默删检查）: 同一步骤、同一 scope（AGENTS.md + docs/CONTEXT.md，docs/agents/** 与 docs/history/**），新增自测与反空洞断言。

## 4. 验证锚点（实测）

| # | 检查 | 结果 |
|---|---|---|
| V1 | node --check scripts/docs-link-guard.mjs | exit 0 |
| V2 | guard 自测（7 fixture + delimiter-leak 不变式） | PASS |
| V3 | 全量扫描 | 8 reference(s) checked, 0 dead, exit 0 |
| V4 | 反向对照: 临时追加 docs/agents/does-not-exist.md | exit 1；DEAD AGENTS.md -> docs/agents/does-not-exist.md（9 checked / 1 dead） |
| V5 | 反向对照后还原 | AGENTS.md sha256 前后一致（854434b528f0b6d5...），byte_identical=true；重跑 exit 0 |
| V6 | workflow YAML 解析 | YAML OK；steps 4 个；paths 双端各 6 项 |
| V7 | 本地模拟 job 三步 | step1 exit 0 / step2 exit 0 / step3 exit 0（AGENTS.md 185 行 20732 B，无 warning） |
| V8 | 字节完整性 | guard BOM=false CRLF=false 7300 B；workflow CRLF=false 2051 B |

## 5. AC 对照

| # | AC | 状态 | 证据 |
|---|---|---|---|
| 1 | 修复后 tip 上 AI Docs Governance conclusion=success | **具名 F** | 需 push 到 main 才产生 CI run；§4.2 与 handoff 禁止「未明令 push」。替代锚点 = V2-V7 本地等价模拟全绿 |
| 2 | 附 green run URL | **具名 F** | 同上；授权后一条命令即可（见 §8） |
| 3 | AGENTS/CONTEXT 仍保留 agents/history 引用能力 | **勾** | 8 条引用全部保留且解析成功（V3）；guard 内置 refs==0 则 exit 1 反空洞断言（V2 覆盖） |

F 归因: 非技术阻塞，属授权边界（D-001 明令「未明令不 tag/push 发行」）。

## 6. 明确未做（防 scope creep）

1. 未把 guard 接入 pretest —— pretest 是 test.yml / G-A 面，issue note 明令隔离。
2. 未改 scripts/docs-pointer-check.mjs —— A-035 / 票 85 冻结其为非门禁。
3. 未引入 lychee / linkspector / 任何 npm 依赖 —— CRX-R-009。
4. 未改 AGENTS.md / docs/CONTEXT.md 链接写法 —— 根因在解析侧；AC-3 要求保留引用能力。
5. 未触碰 ADR-0017 / 豁免台账 / test.yml / 版本面。
6. 未 push / 未 tag / 未开 PR。
7. 未跑 Playwright 全套 —— 本票零产品代码改动（仅 .github/workflows + scripts/*.mjs + .scratch 文档），且 issue note 明令「不与 test.yml G-A 混写」；等价验证为 §4 的 V1-V8。

## 7. 账本状态更新

decision-ledger.md A-050: current -> implemented（附本报告与实测锚点）。

## 8. 交大脑 — CI 验证启动卡

授权后（大脑或用户执行，§4.2）:

```
but push <branch>            # 或按大脑既有 CI 派发流程
gh workflow run ai-docs-governance.yml --ref main
gh run list --workflow=ai-docs-governance.yml --limit 1
```

预期: conclusion=success；日志含 docs-link-guard: 8 reference(s) checked, 0 dead。将 run URL 回填 §5 AC-1/AC-2。

## 9. 风险与遗留

- 遗留 R1: green run URL 待授权（唯一未闭环项）。
- 遗留 R2: docs/CONTEXT.md:57 链接文本本身写作路径 —— 风格问题非缺陷；当前 guard 双路（token + 链接目标）均能正确解析，故不改动。
- 风险 R3: guard 对 refs==0 硬失败；若未来把 agent/history 引用整体迁出 AGENTS/CONTEXT，需同步调整该反空洞断言（已在脚本头注释说明）。
- 调研信息缺口: 无重大缺口（lychee 活跃度、linkspector 状态、markdown-link-check 弃用均双源交叉验证）。
