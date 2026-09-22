# Spec — Wave9.20 Followup（唯一数据源: decision-ledger.md D-001..D-007）

> 2026-09-22 · 整理环节 · 禁止账本外结论
> 关联: destination-reconciliation.md · plan.md · handoffs/next-round.md

## §1 范围（D-001）

**目标**：把 backlog 可解项与具名残余**全部本次收口**；不设「可选项挂起」。

| 项 | 纳入 | 说明（账本） |
|---|---|---|
| C01 豁免清零 | 是 | 按 D-003 处置 |
| C02 发行 G-A | 是 | 新 tip test.yml |
| C03 G-C 升格复检 | 是 | version.json==tag + deploy-tail |
| C04 github-pages environment | 是（agent） | D-002 扩大授权 |
| C05 addBookmark→commit | 是 | D-005④ |
| C06 F-113-01 | 是 | 与 C03 同核 |
| C07 白名单长尾 | 是 | 终点=分层（D-005），非 9→0 |
| C08 tag/商店 | **范围外** | 用户亲自做（D-002） |
| C09 收口 push 销账 | 是 | 账面清理 |
| N-108-01 | 是 | = C05 |
| 账本措辞病（A-P03 等） | 是 | plan-07 |
| handoff 脏指针 | 是 | plan-07 / 本整理 |

版本面保持 **2026.9.20**。三门齐前禁止宣称可发行；禁止用旧 G-C 口径冒充升格达成。

## §2 责任矩阵（D-002）

| 动作 | Owner |
|---|---|
| C08 tag / 商店提交 | **用户** |
| C04 environment 放行（gh/API 仓库配置） | agent |
| C01/C02/C03/C05/C06/C07/C09 及文档账本 | agent |
| G-B 测试声明（版本+日期） | **仅用户** |
| 发行 zip / 检查单准备 | agent |

G-B：不新签/不代签。2026-09-15 声明对**未变更产物**可沿用；**发行件变更 ⇒ 对新产物失效**，须用户重测重签（D-004）。

## §3 行为需求

### §3.1 C01 过期豁免（D-003）

1. **否决续期**（含「有动作临时续期」用于本波腾时间）。
2. 默认 **先已修、后撤账**：
   - empty-state / search：已修证据 = A-055 40/40（账本 D-003 原文）
   - zoom-dblclick：已修证据 = 票 110 根因修复（账本 D-003 原文）
   - 撤账判据 = 票 105：≥2 连续 main 全绿 + 签名零出现
3. **禁止** active+过期挂账等 2 绿。
4. 无已修证据或 G-A 复发 → **书面退役**（禁用或删除 + 失败签名存档 + 理由）。
5. 裁决句：「发行时该行为要不要裸奔？」

### §3.2 C05 / C07（D-005）

1. 删除/墓碑/集合删除类：**零豁免**，必须 commit(op)/mutationHandlers（维持现状 0）。
2. 非集合改写：可留少量 `// layout-bypass-allow`（reason≥12 字）+ **到期日/工单路径**；禁止无到期永久豁免。
3. 棘轮只减不增 + downcounting；本波**不以 9→0 为完成定义**。
4. **C05 addBookmark 收编进 commit**（写路径一致性）。
5. C07 完成定义 = 删除类 0 + 改写豁免有名有到期 + 计数不升。

## §4 过程约束（D-006/D-007）

- 票务：**不建 GitHub Issue**；工作项=本 spec + plan 勾选表。
- 审计链 = decision-ledger + but commit + reports/。
- 整理唯一数据源 = decision-ledger.md；账本外结论须先停下问用户。
- 主序见 plan-01..06（来源 D-004 revised：主序六步不变）。

## §5 非目标 / 负向

- 不代签 G-B；不做 C08；不 force-push；未三门齐不 tag/不宣称可发行。
- 不采纳调研噪声（ADR-0023/0027 等非本仓编号）。
- 整理环节不改产品源码 ntp/**；实施另启 plan 执行窗。

